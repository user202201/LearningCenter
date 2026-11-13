/**
 * The DJ turntables, pure part 2: the beat grid (BPM + first-beat offset), BPM detection for imported music, the phase maths of a TRUE sync, quantize, loops,
 * the waveform peaks and what is remembered per track on this device (grid + hot cues, `learn.music.dj.v1`). No screen, no sound: `dj.ts` draws, `djaudio.ts` plays.
 */
export interface Grid { bpm: number; offset: number }   // offset = the time (s) of a beat in the track
export interface Loop { on: boolean; start: number; end: number }
export const HOT_CUES = 4;
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const mod = (x: number, m: number): number => ((x % m) + m) % m;

// ---------- the grid ----------
export const beatSeconds = (g: Grid): number => 60 / g.bpm;
/** the beat position (fractional beat number, 0 = the first beat of the grid) of a time in the track */
export const beatPos = (g: Grid, t: number): number => ((t - g.offset) * g.bpm) / 60;
export const beatTime = (g: Grid, k: number): number => g.offset + (k * 60) / g.bpm;
export const frac = (x: number): number => x - Math.floor(x);
/** the time of the beat nearest to `t` (never before 0) */
export const nearestBeat = (g: Grid, t: number): number => { const k = Math.round(beatPos(g, t)); return Math.max(0, beatTime(g, k) < 0 ? beatTime(g, k + 1) : beatTime(g, k)); };
/** quantize: snap to the grid when `on` */
export const snap = (g: Grid, t: number, on: boolean): number => (on ? nearestBeat(g, t) : t);
/** bar and beat (1-based) of a time, for the counter "bar.beat" */
export function barBeat(g: Grid, t: number): { bar: number; beat: number } {
  const k = Math.max(0, Math.floor(beatPos(g, t) + 1e-9));
  return { bar: Math.floor(k / 4) + 1, beat: (k % 4) + 1 };
}
/** the shortest signed distance between two phases (in beats), in (-0.5, 0.5] */
export const shortest = (d: number): number => { const x = d - Math.round(d); return x <= -0.5 ? x + 1 : x; };
/** how far the follower's beat phase is AHEAD of the leader's (beats; 0 = the beats coincide) */
export const phaseError = (gl: Grid, posL: number, gf: Grid, posF: number): number => shortest(frac(beatPos(gf, posF)) - frac(beatPos(gl, posL)));
/** the error in milliseconds at the tempo that is heard */
export const phaseMs = (errBeats: number, heardBpm: number): number => (errBeats * 60000) / heardBpm;
/** SYNC: the follower's new position so that its beat falls on the leader's beat (the nearest such position) */
export const alignPosition = (gl: Grid, posL: number, gf: Grid, posF: number): number => posF - phaseError(gl, posL, gf, posF) * beatSeconds(gf);
/** the slow phase correction of SYNC LOCK: a tiny rate trim (a fraction of the rate), at most 0.4 % */
export const lockTrim = (errBeats: number): number => clamp(-errBeats * 0.08, -0.004, 0.004);
export const nudged = (g: Grid, ms: number): Grid => ({ bpm: g.bpm, offset: g.offset + ms / 1000 });
/** BPM x2 / ÷2 for the grid (the first beat stays) */
export const scaledGrid = (g: Grid, f: number): Grid => ({ bpm: Math.round(clamp(g.bpm * f, 30, 300) * 100) / 100, offset: g.offset });
/** TAP tempo: from the times (ms) of the taps (a gap over 2 s starts again); null with fewer than 2 taps */
export function tapBpm(taps: number[]): number | null {
  const t: number[] = [];
  for (const x of taps) { if (t.length && x - t[t.length - 1] > 2000) t.length = 0; t.push(x); }
  const l = t.slice(-8);
  if (l.length < 2) return null;
  return Math.round((60000 / ((l[l.length - 1] - l[0]) / (l.length - 1))) * 10) / 10;
}
/** the grid that has a beat exactly at `t` (used by TAP: the last tap is a beat) */
export const gridThrough = (bpm: number, t: number): Grid => ({ bpm, offset: mod(t, 60 / bpm) });

// ---------- loops ----------
/** an auto loop of `beats` beats starting at the current beat (or at `pos` without quantize), kept inside the track */
export function autoLoop(g: Grid, pos: number, beats: number, dur: number, quant: boolean): { start: number; end: number } {
  const len = beats * beatSeconds(g);
  let start = snap(g, pos, quant);
  if (start + len > dur) start = Math.max(0, dur - len);
  return { start, end: Math.min(dur, start + len) };
}
export const loopLength = (l: { start: number; end: number }): number => l.end - l.start;
export const loopHalf = (l: Loop): Loop => ({ ...l, end: l.start + (l.end - l.start) / 2 });
export const loopDouble = (l: Loop, dur: number): Loop => ({ ...l, end: Math.min(dur, l.start + (l.end - l.start) * 2) });
/** a position that left the loop goes back in (forward past the end or backward past the start), the overshoot is kept */
export function wrapLoop(pos: number, l: Loop): number {
  if (!l.on || l.end <= l.start) return pos;
  const len = l.end - l.start;
  if (pos >= l.end) return l.start + ((pos - l.end) % len);
  if (pos < l.start && pos >= l.start - len * 4) return l.end - ((l.start - pos) % len || len);
  return pos;
}

// ---------- the waveform ----------
export interface Peaks { n: number; perSec: number; min: Float32Array; max: Float32Array; low: Float32Array; mid: Float32Array; high: Float32Array }
/** the min / max and the energy of three bands (low < 250 Hz, mid < 2.5 kHz, high above) per bin: computed once per loaded track */
export function computePeaks(chs: Float32Array[], sr: number, perSec = 200): Peaks {
  const len = chs[0].length, step = sr / perSec, n = Math.max(1, Math.ceil(len / step));
  const P: Peaks = { n, perSec, min: new Float32Array(n), max: new Float32Array(n), low: new Float32Array(n), mid: new Float32Array(n), high: new Float32Array(n) };
  const a1 = 1 - Math.exp((-2 * Math.PI * 250) / sr), a2 = 1 - Math.exp((-2 * Math.PI * 2500) / sr), k = 1 / chs.length;
  let l1 = 0, l2 = 0, cnt = 0, b = 0, mn = 1, mx = -1, el = 0, em = 0, eh = 0;
  const flush = () => { P.min[b] = cnt ? mn : 0; P.max[b] = cnt ? mx : 0; P.low[b] = cnt ? el / cnt : 0; P.mid[b] = cnt ? em / cnt : 0; P.high[b] = cnt ? eh / cnt : 0; mn = 1; mx = -1; el = em = eh = 0; cnt = 0; };
  for (let i = 0; i < len; i++) {
    let x = 0; for (let c = 0; c < chs.length; c++) x += chs[c][i]; x *= k;
    l1 += a1 * (x - l1); l2 += a2 * (x - l2);
    const lo = l1, mi = l2 - l1, hi = x - l2;
    if (x < mn) mn = x; if (x > mx) mx = x;
    el += Math.abs(lo); em += Math.abs(mi); eh += Math.abs(hi); cnt++;
    const nb = Math.min(n - 1, Math.floor((i + 1) / step));
    if (nb !== b || i === len - 1) { flush(); b = nb; }
  }
  let m = 1e-9; for (let i = 0; i < n; i++) m = Math.max(m, P.low[i], P.mid[i], P.high[i]);   // one scale for the three bands: the proportions between them stay
  for (let i = 0; i < n; i++) { P.low[i] /= m; P.mid[i] /= m; P.high[i] /= m; }
  for (let i = 0; i < n; i++) if (!Number.isFinite(P.min[i]) || !Number.isFinite(P.max[i])) { P.min[i] = 0; P.max[i] = 0; }
  return P;
}

// ---------- BPM detection ----------
/** folds a tempo into [lo, hi] by doubling / halving */
export function foldBpm(bpm: number, lo = 70, hi = 180): number { let b = bpm; while (b < lo) b *= 2; while (b > hi) b /= 2; return b; }
/** the onset strength (a rise of the loudness) every `hop` samples, with the local average taken away */
export function onsetEnvelope(x: Float32Array, sr: number, hop = 256): { o: Float32Array; fps: number } {
  const n = Math.floor(x.length / hop), e = new Float32Array(n), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop; j < (i + 1) * hop; j++) s += x[j] * x[j]; e[i] = Math.pow(s / hop, 0.4); }
  const w = Math.round(sr / hop / 5);
  for (let i = 1; i < n; i++) o[i] = Math.max(0, e[i] - e[i - 1]);
  const out = new Float32Array(n);
  let run = 0; for (let i = 0; i < n; i++) { run += o[i]; if (i >= w) run -= o[i - w]; out[i] = Math.max(0, o[i] - (run / Math.min(i + 1, w)) * 0.8); }
  return { o: out, fps: sr / hop };
}
/** the comb score of a tempo: the best phase and the mean onset strength on the beats of that phase */
function comb(o: Float32Array, fps: number, bpm: number): { score: number; phase: number } {
  const P = (fps * 60) / bpm, n = o.length, ip = Math.ceil(P);
  let best = -1, bp = 0;
  for (let ph = 0; ph < ip; ph++) {
    let s = 0, c = 0;
    for (let t = ph; t < n; t += P) { const i = Math.round(t); if (i < n) { s += o[i] + 0.5 * ((o[i - 1] ?? 0) + (o[i + 1] ?? 0)); c++; } }
    if (c && s / c > best) { best = s / c; bp = ph; }
  }
  return { score: best, phase: bp };
}
export interface Detected { bpm: number; offset: number; confidence: number }
/** BPM and the first-beat offset of a mono signal: onset envelope + comb filter over 70-180 BPM, half / double folded (the faster one wins when it scores nearly as well) */
export function detectBpm(x: Float32Array, sr: number, maxSeconds = 100): Detected {
  const seg = x.subarray(0, Math.min(x.length, Math.floor(maxSeconds * sr)));
  const { o, fps } = onsetEnvelope(seg, sr);
  if (o.length < fps * 4) return { bpm: 120, offset: 0, confidence: 0 };
  const LO = 70, HI = 180, scores: { b: number; s: number }[] = [];
  for (let b = LO; b <= HI; b += 0.5) scores.push({ b, s: comb(o, fps, b).score });
  let top = scores.reduce((a, c) => (c.s > a.s ? c : a));
  const at = (b: number) => { const lo = Math.max(LO, b - 1.5), hi = Math.min(HI, b + 1.5); return Math.max(...scores.filter((q) => q.b >= lo && q.b <= hi).map((q) => q.s), 0); };
  for (let guard = 0; guard < 3; guard++) {   // the faster tempo wins when it is nearly as good (a half-speed grid fits every second beat of the real one)
    const d = top.b * 2;
    if (d <= HI && at(d) >= 0.78 * top.s) top = { b: top.b * 2, s: at(d) }; else break;
  }
  // refine: 0.05 BPM steps round the coarse winner
  let bb = top.b, bs = -1, bph = 0;
  for (let b = top.b - 0.75; b <= top.b + 0.75; b += 0.05) { const c = comb(o, fps, b); if (c.score > bs) { bs = c.score; bb = b; bph = c.phase; } }
  const mean = o.reduce((a, c) => a + c, 0) / o.length || 1e-9;
  const period = 60 / bb;
  return { bpm: Math.round(bb * 10) / 10, offset: mod(bph / fps + 128 / sr, period), confidence: bs / mean };
}

// ---------- what is remembered per track (this device only) ----------
export interface TrackMemory { bpm: number; offset: number; cues: (number | null)[] }
export interface DjStore { tracks: Record<string, TrackMemory>; quant: boolean; zoom: number }
export const STORE_KEY = "learn.music.dj.v1";
export const defaultStore = (): DjStore => ({ tracks: {}, quant: true, zoom: 8 });
/** a file is told apart by name + size + length (after a reload the same file finds its grid and cues again) */
export const fileKey = (name: string, size: number, dur: number): string => `file:${name}|${size}|${dur.toFixed(2)}`;
export function sanitizeStore(v: unknown): DjStore {
  const s = defaultStore();
  if (!v || typeof v !== "object") return s;
  const o = v as Partial<DjStore>;
  if (typeof o.quant === "boolean") s.quant = o.quant;
  if (typeof o.zoom === "number" && [4, 8, 16].includes(o.zoom)) s.zoom = o.zoom;
  if (o.tracks && typeof o.tracks === "object") {
    for (const [k, m] of Object.entries(o.tracks).slice(0, 200)) {
      const t = m as Partial<TrackMemory>;
      if (!t || typeof t.bpm !== "number" || typeof t.offset !== "number" || !Number.isFinite(t.bpm) || !Number.isFinite(t.offset) || t.bpm < 30 || t.bpm > 300) continue;
      const cues = Array.from({ length: HOT_CUES }, (_, i) => (Array.isArray(t.cues) && typeof t.cues[i] === "number" && Number.isFinite(t.cues[i]) && (t.cues[i] as number) >= 0 ? (t.cues[i] as number) : null));
      s.tracks[k] = { bpm: t.bpm, offset: t.offset, cues };
    }
  }
  return s;
}
export function loadStore(): DjStore { try { return sanitizeStore(JSON.parse(localStorage.getItem(STORE_KEY) ?? "null")); } catch { return defaultStore(); } }
export function saveStore(s: DjStore): void { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* private window: nothing is kept */ } }

// ---------- reversed windows (scratching a long track) ----------
/** the part of a track that is reversed for scratching backwards: about +-15 s round the position, inside the track */
export function reverseWindow(pos: number, dur: number, half = 15): { a: number; b: number } {
  let a = Math.max(0, pos - half), b = Math.min(dur, pos + half);
  if (b - a < half * 2) { if (a === 0) b = Math.min(dur, half * 2); else a = Math.max(0, dur - half * 2); }
  return { a, b };
}
export const wavLimits = { maxBytes: 25 * 1024 * 1024, maxSeconds: 600, monoAfter: 360 };
