/**
 * The audio engine of the DJ turntables (`dj.ts` is the screen). Everything is made in code, nothing is loaded from outside.
 * Per deck:  looping AudioBufferSourceNode (the playback rate = tempo, scratching, brake) -> low shelf -> mid peak -> high shelf -> low-pass -> high-pass -> channel
 * fader gain -> crossfader gain -> (level meter) -> mixer bus.  Mixer bus -> dry + echo (feedback delay) + flanger (short modulated delay) -> master gain -> a compressor
 * -> the speakers (and, while recording, a MediaStreamDestination). The sample pads go straight to the master.
 * Playing backwards (scratching backwards) uses a reversed copy of a WINDOW of the track (+-15 s round the position; a whole built-in loop). The motion of each deck is a
 * small model (`cur` = the rate that is heard, smoothed; `pos`, `angle`) advanced every 20 ms: the record's turning, the position and the sound all come from the same number.
 * On top of it: the beat grid per deck (bpm + first beat), hot cues, loops (the source's own loop points, wrapped in the model in step), loop roll with a slip position,
 * true SYNC (tempo AND beat phase) with an optional lock that trims the rate slowly, and imported music (decoded here, never uploaded).
 * The state is also kept in `window.__dj` (the tests read it; harmless otherwise; `probe()` reads the values that are really on the audio nodes).
 */
import * as A from "./musicaudio";
import * as L from "./djlogic";
import * as G from "./djgrid";
import { renderTrack, reversed } from "./djtracks";

export interface DeckState {
  track: string;            // a built-in id, or "file" for imported music
  key: string;              // what the grid and the cues are remembered under
  name: string;             // the name of the imported file (the user's own text)
  imported: boolean;
  dur: number;              // length of the loop / track in seconds
  loading: boolean; playing: boolean; cueHold: boolean;
  pitch: number;            // tempo fader, percent
  bpm: number;              // what is heard (grid BPM x rate of the fader)
  grid: G.Grid;             // the beat grid: BPM and the time of a beat
  beat: number;             // the beat position of `pos` (fractional)
  cues: (number | null)[];  // the hot cues (seconds)
  loop: G.Loop; roll: boolean; slip: number;
  pos: number; cue: number; // seconds in the loop
  angle: number;            // the turn of the record, degrees
  cur: number;              // the playback rate that is heard now (negative = backwards)
  dir: 1 | -1;              // the direction of the source that plays (-1 = the reversed copy)
  scratching: boolean; scratchRate: number; seeking: boolean;
  eq: { low: number; mid: number; high: number }; filter: number; vol: number;
  sounding: boolean;        // a source node is playing
  peaksN: number;           // the number of waveform bins of the loaded track
  chans: number;            // channels kept in memory (a long track is mixed to mono)
  rwin: [number, number] | null;   // the window of the track that is reversed for scratching backwards
}
export interface DJState {
  decks: [DeckState, DeckState];
  cross: number; gains: { a: number; b: number }; master: number;
  fx: { echo: boolean; flanger: boolean; brake: boolean };
  meters: [number, number];
  pads: { id: string; t: number }[];
  syncs: number; recording: boolean; ticks: number;
  quant: boolean; zoom: number;
  lock: boolean;            // SYNC LOCK: deck B keeps its beat phase on deck A's
  phase: { beats: number; ms: number };   // how far B's beat is ahead of A's
  probe: () => unknown;
}
const newDeck = (track: string): DeckState => ({ track, key: track, name: "", imported: false, dur: L.trackById(track) ? L.loopSeconds(L.trackById(track)!) : 1, loading: false, playing: false, cueHold: false, pitch: 0,
  bpm: L.trackById(track)?.bpm ?? 120, grid: { bpm: L.trackById(track)?.bpm ?? 120, offset: 0 }, beat: 0, cues: Array(G.HOT_CUES).fill(null), loop: { on: false, start: 0, end: 0 }, roll: false, slip: 0,
  pos: 0, cue: 0, angle: 0, cur: 0, dir: 1, scratching: false, scratchRate: 0, seeking: false, eq: { low: 0, mid: 0, high: 0 }, filter: 0, vol: 0.8, sounding: false, peaksN: 0, chans: 1, rwin: null });

interface DeckNodes { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; lp: BiquadFilterNode; hp: BiquadFilterNode; chan: GainNode; cross: GainNode; an: AnalyserNode; buf: Float32Array<ArrayBuffer> }
interface Nodes {
  c: AudioContext; decks: [DeckNodes, DeckNodes]; bus: GainNode; master: GainNode; echoSend: GainNode; echoDelay: DelayNode; flWet: GainNode; fxOut: GainNode; noise: AudioBuffer;
  recDest: MediaStreamAudioDestinationNode | null;
}
export type LoadError = "decode" | "size" | "long" | "empty";
const peaksCache = new WeakMap<AudioBuffer, G.Peaks>();
export const peaksOf = (b: AudioBuffer): G.Peaks => { let p = peaksCache.get(b); if (!p) { p = G.computePeaks(Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c)), b.sampleRate); peaksCache.set(b, p); } return p; };
const windowBuffer = (b: AudioBuffer, a: number, z: number): AudioBuffer => {
  const i0 = Math.floor(a * b.sampleRate), n = Math.max(1, Math.floor(z * b.sampleRate) - i0);
  const w = new AudioBuffer({ length: n, numberOfChannels: b.numberOfChannels, sampleRate: b.sampleRate });
  for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), d = w.getChannelData(c); for (let i = 0; i < n; i++) d[i] = s[i0 + n - 1 - i] ?? 0; }
  return w;
};

export class DJ {
  readonly s: DJState;
  readonly store: G.DjStore = G.loadStore();
  readonly peaks: [G.Peaks | null, G.Peaks | null] = [null, null];
  private n: Nodes | null = null;
  private bufs: [AudioBuffer | null, AudioBuffer | null] = [null, null];
  private srcs: [AudioBufferSourceNode | null, AudioBufferSourceNode | null] = [null, null];
  private win: [{ a: number; b: number } | null, { a: number; b: number } | null] = [null, null];
  private lastMove: [number, number] = [0, 0];
  private timer = 0; private last = 0;
  private rec: { mr: MediaRecorder; chunks: BlobPart[]; mime: string } | null = null;

  constructor(tracks: [string, string]) {
    const self = this;
    this.s = { decks: [newDeck(tracks[0]), newDeck(tracks[1])], cross: 0, gains: { ...L.crossGains(0) }, master: 0.8, fx: { echo: false, flanger: false, brake: false }, meters: [0, 0], pads: [], syncs: 0, recording: false, ticks: 0,
      quant: this.store.quant, zoom: this.store.zoom, lock: false, phase: { beats: 0, ms: 0 }, probe() { return self.probe(); } };
    (window as unknown as { __dj: DJState }).__dj = this.s;
    this.last = performance.now();
    this.timer = window.setInterval(() => this.tick(), 20);
  }
  dispose(): void {
    window.clearInterval(this.timer);
    for (const i of [0, 1] as const) { this.stopSource(i); this.bufs[i] = null; }
    if (this.rec) { try { this.rec.mr.stop(); } catch { /* already stopped */ } this.rec = null; this.s.recording = false; }
    try { this.n?.master.disconnect(); this.n?.fxOut.disconnect(); } catch { /* gone */ }
    this.n = null;
  }

  // ---------- the audio graph ----------
  /** builds the graph on the first touch (a browser starts sound only then); false where the device has no audio */
  ensure(): boolean {
    const c = A.unlock();
    if (!c) return false;
    if (this.n) return true;
    const mk = (): DeckNodes => {
      const low = c.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 250;
      const mid = c.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.8;
      const high = c.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 3500;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 0.9;
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 20; hp.Q.value = 0.9;
      const chan = c.createGain(), cross = c.createGain(), an = c.createAnalyser(); an.fftSize = 512;
      low.connect(mid); mid.connect(high); high.connect(lp); lp.connect(hp); hp.connect(chan); chan.connect(cross); cross.connect(an);
      return { low, mid, high, lp, hp, chan, cross, an, buf: new Float32Array(an.fftSize) };
    };
    const decks: [DeckNodes, DeckNodes] = [mk(), mk()];
    const bus = c.createGain(), fxOut = c.createGain(), master = c.createGain();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
    decks.forEach((d) => d.cross.connect(bus));
    bus.connect(fxOut);                                           // dry
    const echoSend = c.createGain(), echoDelay = c.createDelay(2), echoFb = c.createGain();   // echo
    echoSend.gain.value = 0; echoDelay.delayTime.value = 0.375; echoFb.gain.value = 0.45;
    bus.connect(echoSend); echoSend.connect(echoDelay); echoDelay.connect(echoFb); echoFb.connect(echoDelay); echoDelay.connect(fxOut);
    const flDelay = c.createDelay(0.05), flFb = c.createGain(), flWet = c.createGain(), lfo = c.createOscillator(), lfoAmt = c.createGain();   // flanger
    flDelay.delayTime.value = 0.004; flFb.gain.value = 0.5; flWet.gain.value = 0; lfo.frequency.value = 0.3; lfoAmt.gain.value = 0.0025;
    lfo.connect(lfoAmt); lfoAmt.connect(flDelay.delayTime); lfo.start();
    bus.connect(flDelay); flDelay.connect(flFb); flFb.connect(flDelay); flDelay.connect(flWet); flWet.connect(fxOut);
    master.gain.value = this.s.master;
    fxOut.connect(master); master.connect(comp); comp.connect(c.destination);
    const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.n = { c, decks, bus, master, echoSend, echoDelay, flWet, fxOut, noise, recDest: null };
    for (const i of [0, 1] as const) { this.applyEq(i); this.applyFilter(i); this.applyGains(); }
    this.applyFx();
    return true;
  }

  /** what is really set on the audio nodes (tests); null before the first touch */
  probe() {
    const n = this.n; if (!n) return null;
    return {
      decks: n.decks.map((d, i) => ({ chan: d.chan.gain.value, cross: d.cross.gain.value, low: d.low.gain.value, mid: d.mid.gain.value, high: d.high.gain.value, lp: d.lp.frequency.value, hp: d.hp.frequency.value, rate: this.srcs[i]?.playbackRate.value ?? null, loop: this.srcs[i] ? [this.srcs[i]!.loop, this.srcs[i]!.loopStart, this.srcs[i]!.loopEnd] : null, reversed: this.srcs[i] ? this.s.decks[i].dir < 0 : false })),
      master: n.master.gain.value, echo: n.echoSend.gain.value, echoTime: n.echoDelay.delayTime.value, flanger: n.flWet.gain.value, state: n.c.state,
    };
  }

  // ---------- the mixer ----------
  private applyGains(): void {
    const g = L.crossGains(this.s.cross); this.s.gains = g;
    const n = this.n; if (!n) return;
    n.decks[0].chan.gain.value = this.s.decks[0].vol; n.decks[1].chan.gain.value = this.s.decks[1].vol;
    n.decks[0].cross.gain.value = g.a; n.decks[1].cross.gain.value = g.b;
    n.master.gain.value = this.s.master;
  }
  setCross(x: number): void { this.s.cross = L.clamp(x, -1, 1); this.applyGains(); }
  setVol(i: 0 | 1, v: number): void { this.s.decks[i].vol = L.clamp(v, 0, 1); this.applyGains(); }
  setMaster(v: number): void { this.s.master = L.clamp(v, 0, 1); this.applyGains(); }
  private applyEq(i: 0 | 1): void { const n = this.n; if (!n) return; const e = this.s.decks[i].eq, d = n.decks[i]; d.low.gain.value = L.eqDb(e.low); d.mid.gain.value = L.eqDb(e.mid); d.high.gain.value = L.eqDb(e.high); }
  setEq(i: 0 | 1, band: "low" | "mid" | "high", v: number): void { this.s.decks[i].eq[band] = L.clamp(v, -1, 1); this.applyEq(i); }
  private applyFilter(i: 0 | 1): void { const n = this.n; if (!n) return; const f = L.filterFreqs(this.s.decks[i].filter); n.decks[i].lp.frequency.value = f.lp; n.decks[i].hp.frequency.value = f.hp; }
  setFilter(i: 0 | 1, v: number): void { this.s.decks[i].filter = L.clamp(v, -1, 1); this.applyFilter(i); }
  private applyFx(): void {
    const n = this.n; if (!n) return;
    n.echoSend.gain.value = this.s.fx.echo ? 0.55 : 0; n.flWet.gain.value = this.s.fx.flanger ? 0.7 : 0;
    n.echoDelay.delayTime.value = L.clamp((60 / Math.max(60, this.s.decks[0].bpm)) * 0.75, 0.05, 1.9);   // a dotted eighth of the left deck's tempo
  }
  setFx(name: "echo" | "flanger" | "brake", on: boolean): void { this.s.fx[name] = on; this.applyFx(); }

  // ---------- the decks ----------
  setPitch(i: 0 | 1, pct: number, user = true): void {
    const d = this.s.decks[i];
    d.pitch = Math.round(L.clamp(pct, -L.PITCH_RANGE, L.PITCH_RANGE) * 10) / 10;
    d.bpm = L.bpmOf(d.grid.bpm, d.pitch);
    if (i === 1 && user) this.s.lock = false;   // a hand on the tempo fader releases SYNC LOCK
    if (i === 0) this.applyFx();
  }
  private remember(i: 0 | 1): void {
    const d = this.s.decks[i];
    this.store.tracks[d.key] = { bpm: d.grid.bpm, offset: d.grid.offset, cues: d.cues.slice() };
    this.store.quant = this.s.quant; this.store.zoom = this.s.zoom;
    G.saveStore(this.store);
  }
  setQuant(on: boolean): void { this.s.quant = on; this.store.quant = on; G.saveStore(this.store); }
  setZoom(sec: number): void { this.s.zoom = sec; this.store.zoom = sec; G.saveStore(this.store); }
  /** puts a loaded buffer on a deck with its grid (remembered or given) and cues */
  private place(i: 0 | 1, b: AudioBuffer, o: { track: string; key: string; name: string; imported: boolean; grid: G.Grid }): void {
    const d = this.s.decks[i];
    this.stopSource(i);
    this.bufs[i] = b; this.win[i] = null;
    const mem = this.store.tracks[o.key];
    d.track = o.track; d.key = o.key; d.name = o.name; d.imported = o.imported; d.dur = b.duration; d.chans = b.numberOfChannels; d.rwin = null;
    d.grid = mem ? { bpm: mem.bpm, offset: mem.offset } : o.grid;
    d.cues = mem ? mem.cues.slice() : Array(G.HOT_CUES).fill(null);
    d.loop = { on: false, start: 0, end: 0 }; d.roll = false; d.pos = 0; d.cue = 0; d.slip = 0; d.cur = 0;
    d.bpm = L.bpmOf(d.grid.bpm, d.pitch);
    this.peaks[i] = peaksOf(b); d.peaksN = this.peaks[i]!.n;
    if (i === 0) this.applyFx();
  }
  async load(i: 0 | 1, id: string): Promise<boolean> {
    const def = L.trackById(id); if (!def) return false;
    const d = this.s.decks[i];
    d.track = id; d.loading = true; d.bpm = L.bpmOf(def.bpm, d.pitch);
    try {
      const b = await renderTrack(def);
      if (d.track !== id) return false;   // another track was chosen meanwhile
      this.place(i, b, { track: id, key: id, name: "", imported: false, grid: { bpm: def.bpm, offset: 0 } });
      return true;
    } catch { this.bufs[i] = null; return false; }
    finally { if (d.track === id) d.loading = false; }
  }
  /** imported music: decoded here (nothing is uploaded), at most 25 MB and 10 minutes, a long track is mixed to mono; the tempo and the first beat are detected */
  async loadFile(i: 0 | 1, file: File): Promise<{ ok: true; bpm: number } | { ok: false; error: LoadError }> {
    if (file.size > G.wavLimits.maxBytes) return { ok: false, error: "size" };
    if (file.size === 0) return { ok: false, error: "empty" };
    const d = this.s.decks[i], prev = d.track;
    d.loading = true; d.track = "file";
    try {
      const OAC: typeof OfflineAudioContext = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      let buf: AudioBuffer;
      try { buf = await new OAC(2, 1, 44100).decodeAudioData(await file.arrayBuffer()); } catch { d.track = prev; return { ok: false, error: "decode" }; }
      if (buf.duration > G.wavLimits.maxSeconds) { d.track = prev; return { ok: false, error: "long" }; }
      if (buf.duration < 0.5) { d.track = prev; return { ok: false, error: "decode" }; }
      if (buf.numberOfChannels > 1 && buf.duration > G.wavLimits.monoAfter) {   // a long track is mixed to mono: half the memory
        const m = new AudioBuffer({ length: buf.length, numberOfChannels: 1, sampleRate: buf.sampleRate }), o = m.getChannelData(0), k = 1 / buf.numberOfChannels;
        for (let c = 0; c < buf.numberOfChannels; c++) { const s = buf.getChannelData(c); for (let x = 0; x < o.length; x++) o[x] += s[x] * k; }
        buf = m;
      }
      const key = G.fileKey(file.name, file.size, buf.duration);
      const mono = buf.getChannelData(0);
      const det = this.store.tracks[key] ? null : G.detectBpm(mono, buf.sampleRate);
      this.place(i, buf, { track: "file", key, name: file.name, imported: true, grid: det ? { bpm: det.bpm, offset: det.offset } : { bpm: 120, offset: 0 } });
      if (det) this.remember(i);
      return { ok: true, bpm: d.grid.bpm };
    } finally { d.loading = false; }
  }
  play(i: 0 | 1): void { this.ensure(); this.s.decks[i].playing = true; }
  pause(i: 0 | 1): void { this.s.decks[i].playing = false; }
  toggle(i: 0 | 1): boolean { const d = this.s.decks[i]; if (d.playing) this.pause(i); else this.play(i); return d.playing; }
  /** moves the record to `t` (the sound restarts there) */
  seek(i: 0 | 1, t: number): void { const d = this.s.decks[i]; d.pos = G.mod(t, d.dur || 1); d.slip = d.pos; this.stopSource(i); }
  /** CUE: while playing it jumps back to the cue point and stops; stopped, it sets the cue point where the record is and plays from it as long as it is held */
  cuePress(i: 0 | 1): void {
    this.ensure(); const d = this.s.decks[i];
    if (d.playing) { d.playing = false; d.pos = d.cue; d.cur = 0; this.stopSource(i); return; }
    if (!d.cueHold) d.cue = d.pos;
    d.cueHold = true;
  }
  cueRelease(i: 0 | 1): void { const d = this.s.decks[i]; if (!d.cueHold) return; d.cueHold = false; d.pos = d.cue; d.cur = 0; this.stopSource(i); }

  // ---------- the beat grid ----------
  setGrid(i: 0 | 1, g: G.Grid): void { const d = this.s.decks[i]; d.grid = { bpm: Math.round(L.clamp(g.bpm, 30, 300) * 100) / 100, offset: g.offset }; d.bpm = L.bpmOf(d.grid.bpm, d.pitch); if (i === 0) this.applyFx(); this.remember(i); }
  nudgeGrid(i: 0 | 1, ms: number): void { this.setGrid(i, G.nudged(this.s.decks[i].grid, ms)); }
  scaleGrid(i: 0 | 1, f: number): void { this.setGrid(i, G.scaledGrid(this.s.decks[i].grid, f)); }
  private taps: [number[], number[]] = [[], []];
  /** TAP tempo: the taps set the BPM and the last tap is a beat; returns the BPM or null for the first tap */
  tap(i: 0 | 1, now = performance.now()): number | null {
    const t = this.taps[i]; if (t.length && now - t[t.length - 1] > 2000) t.length = 0;
    t.push(now); if (t.length > 8) t.shift();
    const bpm = G.tapBpm(t);
    if (bpm !== null && bpm >= 30 && bpm <= 300) this.setGrid(i, G.gridThrough(bpm, this.s.decks[i].pos));
    return bpm;
  }

  // ---------- hot cues ----------
  /** an empty pad sets the cue at the (quantized) position, a set pad jumps to it */
  hotCue(i: 0 | 1, k: number): "set" | "jump" {
    const d = this.s.decks[i], c = d.cues[k];
    if (c === null) { d.cues[k] = Math.min(d.dur - 0.001, G.snap(d.grid, d.pos, this.s.quant)); this.remember(i); return "set"; }
    this.seek(i, c); return "jump";
  }
  deleteCue(i: 0 | 1, k: number): void { this.s.decks[i].cues[k] = null; this.remember(i); }

  // ---------- loops ----------
  private applyLoopProps(i: 0 | 1): void {
    const s = this.srcs[i], d = this.s.decks[i]; if (!s || d.dir < 0) return;
    s.loop = true; s.loopStart = d.loop.on ? d.loop.start : 0; s.loopEnd = d.loop.on ? d.loop.end : 0;
  }
  private setLoop(i: 0 | 1, l: G.Loop): void {
    const d = this.s.decks[i];
    d.loop = l;
    if (l.on && (d.pos < l.start || d.pos >= l.end)) this.seek(i, l.start);
    else if (d.dir < 0) this.stopSource(i); else this.applyLoopProps(i);
  }
  /** an auto loop of `beats` beats from the current beat; with `roll` the position the track would have is followed (slip) and `rollEnd()` goes back to it */
  autoLoop(i: 0 | 1, beats: number, roll = false): void {
    const d = this.s.decks[i], l = G.autoLoop(d.grid, d.pos, beats, d.dur, this.s.quant);
    d.roll = roll; d.slip = d.pos;
    this.setLoop(i, { on: true, ...l });
  }
  rollEnd(i: 0 | 1): void { const d = this.s.decks[i]; if (!d.roll) return; d.roll = false; d.loop = { ...d.loop, on: false }; this.seek(i, d.slip); }
  loopIn(i: 0 | 1): void { const d = this.s.decks[i], t = G.snap(d.grid, d.pos, this.s.quant); d.loop = { on: false, start: t, end: t }; }
  loopOut(i: 0 | 1): void {
    const d = this.s.decks[i], t = G.snap(d.grid, d.pos, this.s.quant);
    if (t <= d.loop.start + 0.01) return;
    this.setLoop(i, { on: true, start: d.loop.start, end: t });
  }
  /** loop on / off: switching it on again ("reloop") jumps back to the loop */
  reloop(i: 0 | 1): void {
    const d = this.s.decks[i]; if (d.loop.end <= d.loop.start) return;
    d.roll = false;
    if (d.loop.on) { d.loop = { ...d.loop, on: false }; this.applyLoopProps(i); if (d.dir < 0) this.stopSource(i); } else { this.setLoop(i, { ...d.loop, on: true }); this.seek(i, d.loop.start); }
  }
  loopHalf(i: 0 | 1): void { const d = this.s.decks[i]; if (d.loop.end > d.loop.start) this.setLoop(i, G.loopHalf(d.loop)); }
  loopDouble(i: 0 | 1): void { const d = this.s.decks[i]; if (d.loop.end > d.loop.start) this.setLoop(i, G.loopDouble(d.loop, d.dur)); }

  // ---------- true SYNC ----------
  /** SYNC: deck B gets deck A's tempo (half / double when that fits) AND its beat phase (B is moved to the nearest place where its beat falls on A's beat) */
  sync(): { pitch: number; ok: boolean; mult: number; bpm: number; shiftMs: number } {
    const a = this.s.decks[0], b = this.s.decks[1];
    const r = L.syncPitch(a.bpm, b.grid.bpm);
    this.setPitch(1, r.pitch, false);
    const np = G.alignPosition(a.grid, a.pos, b.grid, b.pos);
    const shiftMs = ((np - b.pos) / L.rateOf(b.pitch)) * 1000;
    this.seek(1, np); this.s.syncs++;
    return { ...r, bpm: b.bpm * r.mult, shiftMs };   // (a half-time track is reported in the master's beats)
  }
  setLock(on: boolean): void { this.s.lock = on; }

  // ---------- scratching and seeking ----------
  /** a finger is put on the record: it is held (silent until it moves) */
  scratchStart(i: 0 | 1): void { this.ensure(); const d = this.s.decks[i]; d.scratching = true; d.scratchRate = 0; if (i === 1) this.s.lock = false; this.lastMove[i] = performance.now(); }
  /** the finger turned the record by `deg` degrees (+ = clockwise = forward) `seconds` after the last move */
  scratchMove(i: 0 | 1, deg: number, seconds: number): void {
    const d = this.s.decks[i]; if (!d.scratching) return;
    const inst = L.scratchRate(deg, seconds);
    d.scratchRate = L.clamp(0.4 * d.scratchRate + 0.6 * inst, -L.SCRATCH_MAX, L.SCRATCH_MAX);
    d.angle = (((d.angle + deg) % 360) + 360) % 360;
    this.lastMove[i] = performance.now();
  }
  /** the finger is lifted: the record returns to normal speed smoothly (or stops when it was not playing) */
  scratchEnd(i: 0 | 1): void { const d = this.s.decks[i]; d.scratching = false; d.scratchRate = 0; }
  /** needle search on the overview: the record is held (silent) while the finger drags, then goes on from there */
  seekStart(i: 0 | 1): void { this.ensure(); this.s.decks[i].seeking = true; }
  seekMove(i: 0 | 1, t: number): void { const d = this.s.decks[i]; if (d.seeking) this.seek(i, L.clamp(t, 0, Math.max(0, d.dur - 0.01))); }
  seekEnd(i: 0 | 1): void { this.s.decks[i].seeking = false; }

  // ---------- the motion model, every 20 ms ----------
  private stopSource(i: 0 | 1): void {
    const s = this.srcs[i]; this.srcs[i] = null; this.s.decks[i].sounding = false;
    if (!s) return;
    try { s.stop(); } catch { /* not started */ }
    try { s.disconnect(); } catch { /* gone */ }
  }
  private startSource(i: 0 | 1, dir: 1 | -1): void {
    const n = this.n, b = this.bufs[i], d = this.s.decks[i]; if (!n || !b) return;
    const s = n.c.createBufferSource();
    let off: number;
    if (dir > 0) {
      s.buffer = b; s.loop = true; s.loopStart = d.loop.on ? d.loop.start : 0; s.loopEnd = d.loop.on ? d.loop.end : 0;
      off = d.pos;
    } else {
      const w = G.reverseWindow(d.pos, d.dur); this.win[i] = w; d.rwin = [w.a, w.b];
      const whole = w.b - w.a >= d.dur - 1e-6;
      s.buffer = whole && !d.imported ? reversed(d.track, b) : windowBuffer(b, w.a, w.b);
      s.loop = whole;
      off = w.b - d.pos;
    }
    s.playbackRate.value = Math.max(0.001, Math.abs(d.cur));
    s.connect(n.decks[i].low);
    s.start(0, L.clamp(off, 0, (s.buffer?.duration ?? 1) - 0.001));
    this.srcs[i] = s; d.dir = dir; d.sounding = true;
  }
  tick(): void {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (dt <= 0) return;
    this.s.ticks++;
    const A_ = this.s.decks[0], B_ = this.s.decks[1];
    this.s.phase.beats = G.phaseError(A_.grid, A_.pos, B_.grid, B_.pos);
    this.s.phase.ms = G.phaseMs(this.s.phase.beats, Math.max(30, B_.bpm));
    for (const i of [0, 1] as const) {
      const d = this.s.decks[i], buf = this.bufs[i];
      if (d.scratching && now - this.lastMove[i] > 60) d.scratchRate = 0;   // the finger rests: the record is held
      let target = d.scratching ? d.scratchRate : d.seeking ? 0 : d.playing || d.cueHold ? L.rateOf(d.pitch) * (this.s.fx.brake ? 0 : 1) : 0;
      if (i === 1 && this.s.lock && d.playing && A_.playing && !d.scratching && !d.seeking && !d.cueHold && !this.s.fx.brake) target *= 1 + G.lockTrim(this.s.phase.beats);
      const tc = d.scratching || d.seeking ? 0.03 : this.s.fx.brake ? 0.35 : 0.15;
      d.cur += (target - d.cur) * (1 - Math.exp(-dt / tc));
      if (Math.abs(target - d.cur) < 0.002 || (target === 0 && Math.abs(d.cur) < 0.02)) d.cur = target;   // (a record that is almost still is still)
      const dur = buf?.duration ?? 1;
      const before = d.pos;
      d.pos = (((d.pos + d.cur * dt) % dur) + dur) % dur;
      if (d.loop.on) { const w = G.wrapLoop(d.pos, d.loop); if (w !== d.pos) { d.pos = w; if (d.dir < 0) this.stopSource(i); } }
      if (d.roll) d.slip = G.mod(d.slip + d.cur * dt, dur);
      else d.slip = d.pos;
      void before;
      d.beat = G.beatPos(d.grid, d.pos);
      if (!d.scratching) d.angle = (((d.angle + L.platterSpeed(d.cur) * dt) % 360) + 360) % 360;
      if (!this.n || !buf) continue;
      const audible = Math.abs(d.cur) > 0.01 || d.scratching;
      if (audible) {
        const want: 1 | -1 = d.cur < -0.01 ? -1 : d.cur > 0.01 ? 1 : d.dir;
        const w = this.win[i];
        const used = want < 0 && w && d.dur > 30 && (d.pos < w.a + 0.15 && w.a > 0 || d.pos > w.b - 0.15 && w.b < d.dur);   // the reversed window is used up: a new one
        if (!this.srcs[i] || want !== d.dir || used) { this.stopSource(i); this.startSource(i, want); }
        this.srcs[i]?.playbackRate.setTargetAtTime(Math.max(0.001, Math.abs(d.cur)), this.n.c.currentTime, 0.01);
      } else if (this.srcs[i]) this.stopSource(i);
    }
    if (this.n) for (const i of [0, 1] as const) {
      const nd = this.n.decks[i]; nd.an.getFloatTimeDomainData(nd.buf);
      let sum = 0; for (let k = 0; k < nd.buf.length; k++) sum += nd.buf[k] * nd.buf[k];
      const lvl = L.clamp(Math.sqrt(sum / nd.buf.length) * 3.2, 0, 1);
      this.s.meters[i] = lvl > this.s.meters[i] ? lvl : this.s.meters[i] * 0.85 + lvl * 0.15;
    }
  }

  // ---------- recording the master output ----------
  static canRecord(): boolean { return typeof MediaRecorder !== "undefined" && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext); }
  startRecording(): boolean {
    if (!DJ.canRecord() || this.rec || !this.ensure() || !this.n) return false;
    const n = this.n;
    try {
      if (!n.recDest) { n.recDest = n.c.createMediaStreamDestination(); n.master.connect(n.recDest); }
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const mr = new MediaRecorder(n.recDest.stream, mime ? { mimeType: mime } : undefined);
      const rec = { mr, chunks: [] as BlobPart[], mime: mr.mimeType || mime || "audio/webm" };
      mr.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
      mr.start(250);
      this.rec = rec; this.s.recording = true;
      return true;
    } catch { return false; }
  }
  stopRecording(): Promise<{ blob: Blob; ext: string } | null> {
    const rec = this.rec; this.rec = null; this.s.recording = false;
    if (!rec) return Promise.resolve(null);
    return new Promise((res) => {
      rec.mr.onstop = () => { const blob = new Blob(rec.chunks, { type: rec.mime }); res(blob.size ? { blob, ext: rec.mime.includes("mp4") ? "m4a" : rec.mime.includes("ogg") ? "ogg" : "webm" } : null); };
      try { rec.mr.stop(); } catch { res(null); }
    });
  }

  // ---------- the sample pads ----------
  pad(id: L.PadId): void {
    this.s.pads.push({ id, t: performance.now() }); if (this.s.pads.length > 200) this.s.pads.shift();
    if (!this.ensure() || !this.n) return;
    const { c, fxOut, noise } = this.n, t = c.currentTime + 0.005;
    const out = c.createGain(); out.gain.value = 0.8; out.connect(fxOut);
    const env = (peak: number, attack: number, hold: number, release: number, dest: AudioNode = out) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.setValueAtTime(peak, t + attack + hold); g.gain.exponentialRampToValueAtTime(0.0003, t + attack + hold + release); g.connect(dest); return g; };
    const osc = (type: OscillatorType, f: number, dest: AudioNode, dur: number, detune = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
    const hiss = (type: BiquadFilterType, f: number, q: number, dest: AudioNode, dur: number) => { const s = c.createBufferSource(); s.buffer = noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(dest); s.start(t, Math.random() * 0.5, dur + 0.05); return fl; };
    switch (id) {
      case "horn": {   // an air horn: three sawtooth notes through a band-pass, the pitch sags at the end
        const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 0.9; bp.connect(env(0.5, 0.02, 0.55, 0.25));
        [392, 494, 587].forEach((f, k) => { const o = osc("sawtooth", f, bp, 0.9, k * 5 - 5); o.frequency.setValueAtTime(f, t + 0.6); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.9); });
        break;
      }
      case "siren": {   // a police siren: a square wave sliding up and down
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2800; lp.connect(env(0.22, 0.03, 1.1, 0.25));
        const o = osc("square", 600, lp, 1.5);
        for (let k = 0; k < 3; k++) { o.frequency.linearRampToValueAtTime(1300, t + 0.25 + k * 0.5); o.frequency.linearRampToValueAtTime(600, t + 0.5 + k * 0.5); }
        break;
      }
      case "laser": {
        const g = env(0.35, 0.003, 0.05, 0.22);
        const o = osc("sawtooth", 2600, g, 0.3); o.frequency.exponentialRampToValueAtTime(160, t + 0.25);
        const o2 = osc("sine", 5200, g, 0.3); o2.frequency.exponentialRampToValueAtTime(320, t + 0.25);
        break;
      }
      case "clap": {
        for (const d of [0, 0.012, 0.026]) { const g = c.createGain(); g.gain.setValueAtTime(0.7, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.035); g.connect(out); const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 1.1; s.connect(f); f.connect(g); s.start(t + d, Math.random() * 0.5, 0.05); }
        const g = c.createGain(); g.gain.setValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); g.connect(out);
        const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.9; s.connect(f); f.connect(g); s.start(t + 0.03, 0.4, 0.3);
        break;
      }
      case "scratch": {   // a record scratch: noise through a sweeping band-pass, chopped by the back and forth
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
        for (let k = 0; k < 4; k++) { g.gain.linearRampToValueAtTime(0.7, t + 0.04 + k * 0.1); g.gain.linearRampToValueAtTime(0.1, t + 0.09 + k * 0.1); }
        g.gain.linearRampToValueAtTime(0.0001, t + 0.5); g.connect(out);
        const f = hiss("bandpass", 900, 3, g, 0.5);
        for (let k = 0; k < 4; k++) { f.frequency.linearRampToValueAtTime(k % 2 ? 900 : 3600, t + 0.1 + k * 0.1); }
        osc("sawtooth", 180, env(0.1, 0.01, 0.3, 0.15), 0.5).frequency.linearRampToValueAtTime(420, t + 0.25);
        break;
      }
      case "stab": {   // a bright chord stab, the filter closing quickly
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.4); lp.Q.value = 2; lp.connect(env(0.3, 0.008, 0.12, 0.3));
        [262, 330, 392, 494].forEach((f, k) => { osc("sawtooth", f, lp, 0.5, k % 2 ? 8 : -8); osc("sawtooth", f * 2, lp, 0.5, 4); });
        break;
      }
      case "drop": {   // a bass drop: a sine falling from 140 to 28 Hz
        const g = env(0.95, 0.005, 0.25, 0.9); const o = osc("sine", 140, g, 1.2); o.frequency.exponentialRampToValueAtTime(28, t + 1.0);
        hiss("lowpass", 220, 0.7, env(0.5, 0.002, 0.02, 0.15), 0.2);
        break;
      }
      case "rewind": {   // a vinyl rewind: a fast rising whine with a hiss
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(6000, t + 0.7); lp.connect(env(0.28, 0.02, 0.55, 0.15));
        const o = osc("sawtooth", 70, lp, 0.8); o.frequency.exponentialRampToValueAtTime(2200, t + 0.7);
        const f = hiss("bandpass", 1000, 1.5, env(0.18, 0.02, 0.5, 0.15), 0.8); f.frequency.exponentialRampToValueAtTime(7000, t + 0.7);
        break;
      }
    }
  }
}
