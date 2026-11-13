/**
 * The sound of the music subject: everything is MADE in code with the Web Audio API (no sound files, nothing from outside, works offline).
 *  - piano: a few sine / triangle partials with a quick attack, a long decay and a short release;
 *  - drums: a sine sweep (kick, toms), noise + tone (snare), filtered noise (hi-hat, crash, ride);
 *  - guitar: a plucked string made with the Karplus-Strong algorithm (a short burst of noise circulating in a delay line that slowly loses its high notes).
 * Each call is also counted in `window.__music` (the tests read it; harmless otherwise). A browser starts sound only after a touch: `unlock()` is called by the
 * first touch of every instrument.
 */
type AC = AudioContext;
let ctx: AC | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export interface MusicLog { plays: { kind: string; id: string; t?: number }[]; started: number }
const log: MusicLog = ((window as unknown as { __music?: MusicLog }).__music ??= { plays: [], started: 0 });
/** `when` = the audio-clock time a scheduled sound was asked for (the beat maker); nothing for a sound that starts at once */
const note = (kind: string, id: string, when?: number) => { log.plays.push(when === undefined ? { kind, id } : { kind, id, t: when }); if (log.plays.length > 500) log.plays.shift(); };

/** the audio context (made on the first touch; null where the device has none) */
export function unlock(): AC | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      const comp = ctx.createDynamicsCompressor();   // (ten fingers at once must not clip)
      comp.threshold.value = -14; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(ctx.destination);
      log.started++;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
const out = (): GainNode | null => (unlock() ? master : null);
/** the audio clock in seconds (the beat maker schedules its notes on it); a device without audio falls back to the page clock so that the play head still runs */
export const now = (): number => { const c = unlock(); return c ? c.currentTime : performance.now() / 1000; };
export const midiFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const midiName = (m: number): string => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const isBlack = (m: number): boolean => [1, 3, 6, 8, 10].includes(m % 12);
export { isBlack };

// ---------- piano ----------
export interface Voice { release: () => void }
/**
 * presses a piano key: the sound goes on (and slowly dies away) until `release()`.
 * `when` (audio-clock time) starts it later; `hold` (seconds) makes it a short note that ends by itself (the beat maker's notes).
 */
export function pianoDown(m: number, vel = 0.8, when?: number, hold?: number): Voice {
  note("piano", midiName(m), when);
  const c = unlock(), o = out();
  if (!c || !o) return { release() {} };
  const t = Math.max(c.currentTime, when ?? 0), f = midiFreq(m);
  const g = c.createGain();
  const peak = 0.42 * vel, decay = hold ? hold + 0.12 : Math.max(0.9, 3.4 - (m - 36) * 0.035);   // (high notes ring shorter)
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(peak * 0.28, t + Math.min(0.35, decay * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0003, t + decay);
  g.connect(o);
  const oscs: OscillatorNode[] = [];
  [[1, "triangle", 1], [2, "sine", 0.42], [3, "sine", 0.2], [4, "sine", 0.1], [5, "sine", 0.05]].forEach(([mul, type, amp]) => {
    const os = c.createOscillator(), og = c.createGain();
    os.type = type as OscillatorType; os.frequency.value = f * (mul as number) * (1 + (Math.random() - 0.5) * 0.0008);
    og.gain.value = amp as number;
    os.connect(og); og.connect(g);
    os.start(t); os.stop(t + decay + 0.1);
    oscs.push(os);
  });
  let done = false;
  return { release() {
    if (done) return; done = true;
    const n = c.currentTime;
    g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0003), n);
    g.gain.exponentialRampToValueAtTime(0.0003, n + 0.28);
    oscs.forEach((os) => { try { os.stop(n + 0.3); } catch { /* already stopped */ } });
  } };
}
/** a short note for demonstrations (a key lights up in the app) */
export function pianoPlay(m: number, seconds = 0.5): void { const v = pianoDown(m, 0.7); window.setTimeout(() => v.release(), seconds * 1000); }

// ---------- drums ----------
const noise = (c: AC): AudioBuffer => {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
};
export type Drum = "kick" | "snare" | "hihat" | "hihat-open" | "tom1" | "tom2" | "floor" | "crash" | "ride";
export const DRUMS: Drum[] = ["kick", "snare", "hihat", "hihat-open", "tom1", "tom2", "floor", "crash", "ride"];
/** `when` = audio-clock time to play at (the beat maker); left out = now */
export function drumHit(kind: Drum, vel = 1, when?: number): void {
  note("drum", kind, when);
  const c = unlock(), o = out();
  if (!c || !o) return;
  const t = Math.max(c.currentTime, when ?? 0);
  const env = (peak: number, dur: number, dest: AudioNode = o) => { const g = c.createGain(); g.gain.setValueAtTime(peak * vel, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); g.connect(dest); return g; };
  const tone = (f0: number, f1: number, dur: number, peak: number, type: OscillatorType = "sine") => {
    const os = c.createOscillator(); os.type = type; os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    os.connect(env(peak, dur)); os.start(t); os.stop(t + dur + 0.05);
  };
  const hiss = (type: BiquadFilterType, f: number, q: number, dur: number, peak: number) => {
    const s = c.createBufferSource(); s.buffer = noise(c);
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(env(peak, dur)); s.start(t, Math.random() * 1.5, dur + 0.05);
  };
  switch (kind) {
    case "kick": tone(160, 42, 0.45, 1.0); tone(60, 40, 0.3, 0.5); hiss("lowpass", 900, 0.7, 0.04, 0.35); break;
    case "snare": tone(210, 150, 0.2, 0.55, "triangle"); hiss("bandpass", 2200, 0.6, 0.22, 0.9); hiss("highpass", 5000, 0.5, 0.12, 0.3); break;
    case "hihat": hiss("highpass", 7500, 0.7, 0.07, 0.55); break;
    case "hihat-open": hiss("highpass", 7000, 0.7, 0.5, 0.5); break;
    case "tom1": tone(230, 120, 0.45, 0.8); hiss("bandpass", 1200, 1, 0.05, 0.2); break;
    case "tom2": tone(170, 90, 0.5, 0.85); hiss("bandpass", 1000, 1, 0.05, 0.2); break;
    case "floor": tone(120, 62, 0.65, 0.95); hiss("bandpass", 800, 1, 0.05, 0.2); break;
    case "crash": hiss("highpass", 4200, 0.5, 1.6, 0.7); hiss("bandpass", 7500, 1.2, 1.1, 0.35); break;
    case "ride": hiss("bandpass", 6200, 2, 0.9, 0.4); tone(820, 800, 0.5, 0.18, "square"); break;
  }
}

// ---------- guitar (Karplus-Strong) ----------
const strings = new Map<number, AudioBuffer>();
function stringBuffer(c: AC, m: number): AudioBuffer {
  const hit = strings.get(m);
  if (hit) return hit;
  const sr = c.sampleRate, f = midiFreq(m), n = Math.round(sr / f), len = Math.floor(sr * 2.6);
  const buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  // a first pass of smoothing makes the pluck a little rounder (like a finger, not a pick)
  for (let i = 1; i < n; i++) d[i] = 0.6 * d[i] + 0.4 * d[i - 1];
  const decay = 0.9965 - Math.min(0.004, (m - 40) * 0.00006);
  for (let i = n; i < len; i++) d[i] = (d[i - n] + d[i - n + 1 < i ? i - n + 1 : i - n]) * 0.5 * decay;
  strings.set(m, buf);
  return buf;
}
/** plucks a guitar string tuned to the MIDI note `m` (the open string + the fret) */
export function pluck(m: number, vel = 0.9, when?: number): void {
  note("guitar", midiName(m), when);
  const c = unlock(), o = out();
  if (!c || !o) return;
  const s = c.createBufferSource(); s.buffer = stringBuffer(c, m);
  const g = c.createGain(); g.gain.value = 0.55 * vel;
  s.connect(g); g.connect(o); s.start(Math.max(c.currentTime, when ?? 0));
}

// ---------- bass ----------
/** a low, round bass note (a triangle with a sine an octave below, a quick attack and a short tail), `dur` seconds long, at the audio time `when` */
export function bassNote(m: number, vel = 0.9, when?: number, dur = 0.4): void {
  note("bass", midiName(m), when);
  const c = unlock(), o = out();
  if (!c || !o) return;
  const t = Math.max(c.currentTime, when ?? 0), f = midiFreq(m);
  const g = c.createGain(), peak = 0.7 * vel;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(peak * 0.55, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0003, t + dur + 0.08);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
  lp.connect(g); g.connect(o);
  [["triangle", f, 1], ["sine", f / 2, 0.6]].forEach(([type, fr, amp]) => {
    const os = c.createOscillator(), og = c.createGain();
    os.type = type as OscillatorType; os.frequency.value = fr as number; og.gain.value = amp as number;
    os.connect(og); og.connect(lp); os.start(t); os.stop(t + dur + 0.12);
  });
}
export const GUITAR_OPEN = [64, 59, 55, 50, 45, 40];   // e B G D A E (the thin string first)
export const guitarMidi = (string: number, fret: number): number => GUITAR_OPEN[string] + fret;
