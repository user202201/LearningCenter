/**
 * The eight built-in DJ tracks are NOT files: each one is rendered once, when a deck first loads it, by an OfflineAudioContext (drums + bass + chords / arpeggio
 * made from oscillators and noise, the same ideas as `musicaudio.ts`) into a mono 44.1 kHz AudioBuffer of one loop (4 or 8 bars, at most 12 s) and kept in a cache.
 * The loop is seamless: what rings on after the last step (a kick tail, a crash of the hat) is rendered into one extra second that is folded back onto the start.
 */
import * as L from "./djlogic";

const cache = new Map<string, Promise<AudioBuffer>>();
const rev = new Map<string, AudioBuffer>();

/** a small repeatable random generator (the same noise every time, so the same track every time) */
const prng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

type Ctx = OfflineAudioContext;
const midiFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

function voices(c: Ctx, out: AudioNode) {
  const rnd = prng(1234);
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
  const env = (t: number, peak: number, dur: number, dest: AudioNode = out) => { const g = c.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); g.connect(dest); return g; };
  const tone = (t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = "sine") => {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
    o.connect(env(t, peak, dur)); o.start(t); o.stop(t + dur + 0.02);
  };
  const hiss = (t: number, type: BiquadFilterType, f: number, q: number, dur: number, peak: number, off = 0) => {
    const s = c.createBufferSource(); s.buffer = nb; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(env(t, peak, dur)); s.start(t, off, dur + 0.02);
  };
  const synth = (t: number, midi: number, dur: number, peak: number, type: OscillatorType, cutoff: number, detune = 7) => {
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cutoff; lp.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.setValueAtTime(peak, t + Math.max(0.013, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0003, t + dur + 0.06);
    lp.connect(g); g.connect(out);
    for (const d of [-detune, detune]) { const o = c.createOscillator(); o.type = type; o.frequency.value = midiFreq(midi); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
  };
  return {
    kick: (t: number, v = 1) => { tone(t, 165, 44, 0.42, 0.95 * v); tone(t, 60, 42, 0.28, 0.45 * v); hiss(t, "lowpass", 800, 0.7, 0.03, 0.25 * v, 0.1); },
    snare: (t: number, v = 1) => { tone(t, 220, 160, 0.16, 0.4 * v, "triangle"); hiss(t, "bandpass", 2300, 0.6, 0.2, 0.75 * v, 0.3); hiss(t, "highpass", 5200, 0.5, 0.1, 0.25 * v, 0.7); },
    clap: (t: number, v = 1) => { for (const d of [0, 0.011, 0.024]) hiss(t + d, "bandpass", 1500, 1.1, 0.03, 0.5 * v, 0.2 + d); hiss(t + 0.03, "bandpass", 1500, 1, 0.16, 0.45 * v, 0.5); },
    hat: (t: number, v = 1) => hiss(t, "highpass", 7600, 0.7, 0.055, 0.34 * v, 0.9),
    oh: (t: number, v = 1) => hiss(t, "highpass", 7000, 0.7, 0.3, 0.3 * v, 0.1),
    bass: (t: number, midi: number, dur: number, type: L.TrackDef["bassType"]) => {
      const f = midiFreq(midi), g = c.createGain(), lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = type === "saw" ? 520 : type === "pluck" ? 900 : 300; lp.Q.value = type === "saw" ? 4 : 1;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.008); g.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0003, t + dur + 0.05);
      if (type === "pluck") lp.frequency.exponentialRampToValueAtTime(260, t + dur);
      lp.connect(g); g.connect(out);
      const wave: OscillatorType = type === "sub" ? "sine" : type === "saw" ? "sawtooth" : "triangle";
      const o = c.createOscillator(); o.type = wave; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + dur + 0.08);
      if (type !== "sub") { const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = f / 2; o2.connect(lp); o2.start(t); o2.stop(t + dur + 0.08); }
    },
    synth,
  };
}

/** renders one loop of a track (a sound-wave buffer); the same call twice gives the same buffer (cache) */
export function renderTrack(def: L.TrackDef): Promise<AudioBuffer> {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const p = (async () => {
    const OAC: typeof OfflineAudioContext = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const n = L.loopFrames(def), tail = L.SR;
    const c = new OAC(1, n + tail, L.SR);
    const bus = c.createGain(); bus.gain.value = 0.9; bus.connect(c.destination);
    const v = voices(c, bus);
    const st = L.stepSeconds(def), swing = def.swing ?? 0;
    for (let bar = 0; bar < def.bars; bar++) {
      const root = def.key + def.prog[bar % def.prog.length], last = bar === def.bars - 1;
      const notes = L.triad(root + 24, def.minor);
      for (let s = 0; s < 16; s++) {
        const t = (bar * 16 + s) * st + (s % 2 ? swing * st : 0);
        const at = (row: string | undefined) => (row ? row[s] : ".");
        const vel = (ch: string) => (ch === "x" ? 1 : ch === "o" ? 0.5 : 0);
        if (vel(at(def.kick))) v.kick(t, vel(at(def.kick)));
        const sn = last && def.fill ? def.fill : def.snare;
        if (vel(at(sn))) v.snare(t, vel(at(sn)));
        if (vel(at(def.clap))) v.clap(t, vel(at(def.clap)));
        if (vel(at(def.hat))) v.hat(t, vel(at(def.hat)) * (s % 4 === 0 ? 1 : 0.75));
        if (vel(at(def.oh))) v.oh(t, vel(at(def.oh)));
        const b = def.bass[s];
        if (b !== null) v.bass(t, root + b + 12, st * (def.bassType === "sub" ? 3.2 : 1.6), def.bassType);
        if (def.chordSteps[s] === "x") {
          if (def.chord === "stab") notes.forEach((m) => v.synth(t, m, st * 1.4, 0.07, "sawtooth", 2400, 9));
          else if (def.chord === "pad") notes.forEach((m) => v.synth(t, m, st * 7.5, 0.06, "triangle", 1400, 6));
          else if (def.chord === "arp") { const m = notes[[0, 1, 2, 1][s % 4]]; v.synth(t, m + (s % 8 >= 4 ? 12 : 0), st * 0.9, 0.07, "sawtooth", 3200, 8); }
        }
      }
    }
    const raw = await c.startRendering();
    const src = raw.getChannelData(0);
    const out = c.createBuffer(1, n, L.SR), d = out.getChannelData(0);
    d.set(src.subarray(0, n));
    for (let i = 0; i < tail && i < n; i++) d[i] += src[n + i];   // what rings on after the end blends into the start: no gap, no click at the loop point
    let peak = 0;
    for (let i = 0; i < n; i++) { if (!Number.isFinite(d[i])) d[i] = 0; peak = Math.max(peak, Math.abs(d[i])); }
    const k = peak > 0 ? 0.88 / peak : 1;
    for (let i = 0; i < n; i++) d[i] *= k;
    return out;
  })();
  cache.set(def.id, p);
  p.catch(() => cache.delete(def.id));
  return p;
}

/** the same loop played backwards (for scratching backwards); made once per track */
export function reversed(id: string, buf: AudioBuffer): AudioBuffer {
  const hit = rev.get(id);
  if (hit) return hit;
  const r = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const a = buf.getChannelData(ch), b = r.getChannelData(ch); for (let i = 0, n = a.length; i < n; i++) b[i] = a[n - 1 - i]; }
  rev.set(id, r);
  return r;
}
