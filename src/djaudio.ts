/**
 * The audio engine of the DJ turntables (`dj.ts` is the screen). Everything is made in code, nothing is loaded.
 * Per deck:  looping AudioBufferSourceNode (the playback rate = tempo, scratching, brake) -> low shelf -> mid peak -> high shelf -> low-pass -> high-pass -> channel
 * fader gain -> crossfader gain -> (level meter) -> mixer bus.  Mixer bus -> dry + echo (feedback delay) + flanger (short modulated delay) -> master gain -> a compressor
 * -> the speakers (and, while recording, a MediaStreamDestination). The sample pads go straight to the master.
 * Playing backwards (scratching backwards) uses a reversed copy of the loop. The motion of each deck is a small model (`cur` = the rate that is heard, smoothed;
 * `pos`, `angle`) advanced every 20 ms: the record's turning, the position and the sound all come from the same number.
 * The state is also kept in `window.__dj` (the tests read it; harmless otherwise; `probe()` reads the values that are really on the audio nodes).
 */
import * as A from "./musicaudio";
import * as L from "./djlogic";
import { renderTrack, reversed } from "./djtracks";

export interface DeckState {
  track: string; loading: boolean; playing: boolean; cueHold: boolean;
  pitch: number;            // tempo fader, percent
  bpm: number;              // what is heard (track BPM x rate of the fader)
  pos: number; cue: number; // seconds in the loop
  angle: number;            // the turn of the record, degrees
  cur: number;              // the playback rate that is heard now (negative = backwards)
  dir: 1 | -1;              // the direction of the source that plays (-1 = the reversed copy)
  scratching: boolean; scratchRate: number;
  eq: { low: number; mid: number; high: number }; filter: number; vol: number;
  sounding: boolean;        // a source node is playing
}
export interface DJState {
  decks: [DeckState, DeckState];
  cross: number; gains: { a: number; b: number }; master: number;
  fx: { echo: boolean; flanger: boolean; brake: boolean };
  meters: [number, number];
  pads: { id: string; t: number }[];
  syncs: number; recording: boolean; ticks: number;
  probe: () => unknown;
}
const newDeck = (track: string): DeckState => ({ track, loading: false, playing: false, cueHold: false, pitch: 0, bpm: L.trackById(track)?.bpm ?? 120, pos: 0, cue: 0, angle: 0, cur: 0, dir: 1, scratching: false, scratchRate: 0, eq: { low: 0, mid: 0, high: 0 }, filter: 0, vol: 0.8, sounding: false });

interface DeckNodes { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; lp: BiquadFilterNode; hp: BiquadFilterNode; chan: GainNode; cross: GainNode; an: AnalyserNode; buf: Float32Array<ArrayBuffer> }
interface Nodes {
  c: AudioContext; decks: [DeckNodes, DeckNodes]; bus: GainNode; master: GainNode; echoSend: GainNode; echoDelay: DelayNode; flWet: GainNode; fxOut: GainNode; noise: AudioBuffer;
  recDest: MediaStreamAudioDestinationNode | null;
}

export class DJ {
  readonly s: DJState;
  private n: Nodes | null = null;
  private bufs: [AudioBuffer | null, AudioBuffer | null] = [null, null];
  private srcs: [AudioBufferSourceNode | null, AudioBufferSourceNode | null] = [null, null];
  private lastMove: [number, number] = [0, 0];
  private timer = 0; private last = 0;
  private rec: { mr: MediaRecorder; chunks: BlobPart[]; mime: string } | null = null;

  constructor(tracks: [string, string]) {
    const self = this;
    this.s = { decks: [newDeck(tracks[0]), newDeck(tracks[1])], cross: 0, gains: { ...L.crossGains(0) }, master: 0.8, fx: { echo: false, flanger: false, brake: false }, meters: [0, 0], pads: [], syncs: 0, recording: false, ticks: 0,
      probe() { return self.probe(); } };
    (window as unknown as { __dj: DJState }).__dj = this.s;
    this.last = performance.now();
    this.timer = window.setInterval(() => this.tick(), 20);
  }
  dispose(): void {
    window.clearInterval(this.timer);
    for (const i of [0, 1] as const) this.stopSource(i);
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
      decks: n.decks.map((d, i) => ({ chan: d.chan.gain.value, cross: d.cross.gain.value, low: d.low.gain.value, mid: d.mid.gain.value, high: d.high.gain.value, lp: d.lp.frequency.value, hp: d.hp.frequency.value, rate: this.srcs[i]?.playbackRate.value ?? null, reversed: this.srcs[i] ? this.s.decks[i].dir < 0 : false })),
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
  setPitch(i: 0 | 1, pct: number): void {
    const d = this.s.decks[i];
    d.pitch = Math.round(L.clamp(pct, -L.PITCH_RANGE, L.PITCH_RANGE) * 10) / 10;
    d.bpm = L.bpmOf(L.trackById(d.track)?.bpm ?? 120, d.pitch);
    if (i === 0) this.applyFx();
  }
  /** SYNC: the right deck follows the left deck's BPM */
  sync(): { pitch: number; ok: boolean; mult: number; bpm: number } {
    const a = this.s.decks[0], b = this.s.decks[1];
    const r = L.syncPitch(a.bpm, L.trackById(b.track)?.bpm ?? 120);
    this.setPitch(1, r.pitch); this.s.syncs++;
    return { ...r, bpm: b.bpm * r.mult };   // (a half-time track is reported in the master's beats)
  }
  async load(i: 0 | 1, id: string): Promise<boolean> {
    const def = L.trackById(id); if (!def) return false;
    const d = this.s.decks[i];
    d.track = id; d.loading = true; d.bpm = L.bpmOf(def.bpm, d.pitch);
    try {
      const b = await renderTrack(def);
      if (d.track !== id) return false;   // another track was chosen meanwhile
      this.stopSource(i);
      this.bufs[i] = b; d.pos = 0; d.cue = 0; d.cur = 0;
      return true;
    } catch { this.bufs[i] = null; return false; }
    finally { if (d.track === id) d.loading = false; }
  }
  play(i: 0 | 1): void { this.ensure(); this.s.decks[i].playing = true; }
  pause(i: 0 | 1): void { this.s.decks[i].playing = false; }
  toggle(i: 0 | 1): boolean { const d = this.s.decks[i]; if (d.playing) this.pause(i); else this.play(i); return d.playing; }
  /** CUE: while playing it jumps back to the cue point and stops; stopped, it sets the cue point where the record is and plays from it as long as it is held */
  cuePress(i: 0 | 1): void {
    this.ensure(); const d = this.s.decks[i];
    if (d.playing) { d.playing = false; d.pos = d.cue; d.cur = 0; this.stopSource(i); return; }
    if (!d.cueHold && Math.abs(d.pos - d.cue) > 0.05) d.cue = d.pos;
    d.cueHold = true;
  }
  cueRelease(i: 0 | 1): void { const d = this.s.decks[i]; if (!d.cueHold) return; d.cueHold = false; d.pos = d.cue; d.cur = 0; this.stopSource(i); }

  // ---------- scratching ----------
  /** a finger is put on the record: it is held (silent until it moves) */
  scratchStart(i: 0 | 1): void { this.ensure(); const d = this.s.decks[i]; d.scratching = true; d.scratchRate = 0; this.lastMove[i] = performance.now(); }
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

  // ---------- the motion model, every 20 ms ----------
  private stopSource(i: 0 | 1): void {
    const s = this.srcs[i]; this.srcs[i] = null; this.s.decks[i].sounding = false;
    if (!s) return;
    try { s.stop(); } catch { /* not started */ }
    try { s.disconnect(); } catch { /* gone */ }
  }
  private startSource(i: 0 | 1, dir: 1 | -1): void {
    const n = this.n, b = this.bufs[i], d = this.s.decks[i]; if (!n || !b) return;
    const buf = dir > 0 ? b : reversed(d.track, b);
    const s = n.c.createBufferSource(); s.buffer = buf; s.loop = true;
    s.playbackRate.value = Math.max(0.001, Math.abs(d.cur));
    s.connect(n.decks[i].low);
    const off = dir > 0 ? d.pos : b.duration - d.pos;
    s.start(0, L.clamp(off, 0, b.duration - 0.001));
    this.srcs[i] = s; d.dir = dir; d.sounding = true;
  }
  tick(): void {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (dt <= 0) return;
    this.s.ticks++;
    for (const i of [0, 1] as const) {
      const d = this.s.decks[i], buf = this.bufs[i];
      if (d.scratching && now - this.lastMove[i] > 60) d.scratchRate = 0;   // the finger rests: the record is held
      const target = d.scratching ? d.scratchRate : d.playing || d.cueHold ? L.rateOf(d.pitch) * (this.s.fx.brake ? 0 : 1) : 0;
      const tc = d.scratching ? 0.03 : this.s.fx.brake ? 0.35 : 0.15;
      d.cur += (target - d.cur) * (1 - Math.exp(-dt / tc));
      if (Math.abs(target - d.cur) < 0.002 || (target === 0 && Math.abs(d.cur) < 0.02)) d.cur = target;   // (a record that is almost still is still)
      const dur = buf?.duration ?? 1;
      d.pos = (((d.pos + d.cur * dt) % dur) + dur) % dur;
      if (!d.scratching) d.angle = (((d.angle + L.platterSpeed(d.cur) * dt) % 360) + 360) % 360;
      if (!this.n || !buf) continue;
      const audible = Math.abs(d.cur) > 0.01 || d.scratching;
      if (audible) {
        const want: 1 | -1 = d.cur < -0.01 ? -1 : d.cur > 0.01 ? 1 : d.dir;
        if (!this.srcs[i] || want !== d.dir) { this.stopSource(i); this.startSource(i, want); }
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
