/**
 * The beat maker (节奏编辑器), pure part: no screen, no sound. The pattern (which cell of which track is lit), editing it (tap, paint, presets, random, undo),
 * the time of every step (tempo, swing), what plays at a step, the look-ahead scheduler (a fake clock can drive it in a test) and what is kept on this device.
 * The screen is `beats.ts`, the MIDI file is `musicrec.ts` `buildPatternMidi`.
 */
import type { Drum } from "./musicaudio";

export type TrackId = "kick" | "snare" | "hat" | "open" | "tom" | "crash" | "ride" | "piano" | "guitar" | "bass";
export interface TrackDef { id: TrackId; name: string; kind: "drum" | "piano" | "guitar" | "bass"; drum?: Drum; gm?: number; color: string }
/** one row each; the drums use the General MIDI drum notes (channel 10) in the exported file: kick 36, snare 38, closed hat 42, open hat 46, tom 45, crash 49, ride 51 */
export const TRACKS: TrackDef[] = [
  { id: "kick", name: "底鼓", kind: "drum", drum: "kick", gm: 36, color: "#f03e3e" },
  { id: "snare", name: "军鼓", kind: "drum", drum: "snare", gm: 38, color: "#ff922b" },
  { id: "hat", name: "踩镲", kind: "drum", drum: "hihat", gm: 42, color: "#fab005" },
  { id: "open", name: "开镲", kind: "drum", drum: "hihat-open", gm: 46, color: "#82c91e" },
  { id: "tom", name: "嗵鼓", kind: "drum", drum: "tom1", gm: 45, color: "#12b886" },
  { id: "crash", name: "吊镲", kind: "drum", drum: "crash", gm: 49, color: "#15aabf" },
  { id: "ride", name: "叮叮镲", kind: "drum", drum: "ride", gm: 51, color: "#339af0" },
  { id: "piano", name: "钢琴", kind: "piano", color: "#845ef7" },
  { id: "guitar", name: "吉他", kind: "guitar", color: "#be4bdb" },
  { id: "bass", name: "贝斯", kind: "bass", color: "#e64980" },
];
export const trackDef = (id: TrackId): TrackDef => TRACKS.find((t) => t.id === id)!;
export const isMelodic = (id: TrackId): boolean => trackDef(id).kind !== "drum";

export type ScaleId = "penta" | "major" | "minor";
export const SCALES: { id: ScaleId; name: string; degrees: number[] }[] = [
  { id: "penta", name: "五声音阶", degrees: [0, 2, 4, 7, 9, 12, 14, 16] },
  { id: "major", name: "大调", degrees: [0, 2, 4, 5, 7, 9, 11, 12] },
  { id: "minor", name: "小调", degrees: [0, 2, 3, 5, 7, 8, 10, 12] },
];
/** the guitar's chords (root first): C F G Am as plain triads */
export const CHORDS: { name: string; midi: number[] }[] = [
  { name: "C", midi: [48, 52, 55] }, { name: "F", midi: [53, 57, 60] }, { name: "G", midi: [55, 59, 62] }, { name: "Am", midi: [45, 48, 52] },
];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteLetter = (m: number): string => NAMES[m % 12];
/** the choices of a melodic row: piano = 8 notes from C4 of the chosen scale, bass = the first 5 notes from C2, guitar = 4 chords. Each is a list of MIDI notes (a chord has several). */
export function choicesOf(id: TrackId, scale: ScaleId): { label: string; midi: number[] }[] {
  const deg = SCALES.find((s) => s.id === scale)!.degrees;
  const k = trackDef(id).kind;
  if (k === "piano") return deg.map((d) => ({ label: noteLetter(60 + d), midi: [60 + d] }));
  if (k === "bass") return deg.slice(0, 5).map((d) => ({ label: noteLetter(36 + d), midi: [36 + d] }));
  if (k === "guitar") return CHORDS.map((c) => ({ label: c.name, midi: c.midi }));
  return [];
}

export const MAXC = 16;
export interface Pattern {
  beats: 3 | 4;           // 4/4 or 3/4
  res: 2 | 4;             // steps per beat (4/4: 8 or 16 steps a bar; 3/4: 6 or 12)
  bpm: number;
  swing: boolean;
  scale: ScaleId;
  tracks: Record<TrackId, number[]>;   // 0 = off; drums 1 = on; a melodic row holds the number (1..) of the chosen note / chord
  mute: TrackId[];
  vol: Record<TrackId, number>;        // 0..1
}
export const BPM_MIN = 60, BPM_MAX = 180;
export const SWING = 0.3;   // an odd step is played this much of a step late
const rowOf = (): number[] => new Array(MAXC).fill(0);
export function emptyPattern(): Pattern {
  const tracks = {} as Record<TrackId, number[]>, vol = {} as Record<TrackId, number>;
  TRACKS.forEach((t) => { tracks[t.id] = rowOf(); vol[t.id] = 0.8; });
  return { beats: 4, res: 4, bpm: 110, swing: false, scale: "penta", tracks, mute: [], vol };
}
export const cols = (p: Pattern): number => p.beats * p.res;
export const clone = (p: Pattern): Pattern => JSON.parse(JSON.stringify(p));
/** a pattern read from storage / a file, made safe (every row there, right lengths, numbers in range) */
export function sanitize(x: unknown): Pattern {
  const p = emptyPattern();
  if (!x || typeof x !== "object") return p;
  const o = x as Partial<Pattern>;
  p.beats = o.beats === 3 ? 3 : 4; p.res = o.res === 2 ? 2 : 4;
  p.bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(o.bpm) || 110)));
  p.swing = !!o.swing; p.scale = o.scale === "major" || o.scale === "minor" ? o.scale : "penta";
  for (const t of TRACKS) {
    const r = o.tracks?.[t.id], n = t.kind === "drum" ? 1 : choicesOf(t.id, p.scale).length;
    if (Array.isArray(r)) for (let i = 0; i < MAXC; i++) { const v = Math.round(Number(r[i]) || 0); p.tracks[t.id][i] = v >= 1 && v <= n ? v : 0; }
    const v = Number(o.vol?.[t.id]); p.vol[t.id] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
  }
  p.mute = Array.isArray(o.mute) ? o.mute.filter((m): m is TrackId => TRACKS.some((t) => t.id === m)) : [];
  return p;
}

// ---------- editing ----------
/** what a touch on a cell would do: switch it on (with this choice) or off. A drum cell: lit = off. A melodic cell: the same choice = off, another choice (or empty) = on. */
export const decide = (p: Pattern, t: TrackId, s: number, choice: number): "on" | "off" => (p.tracks[t][s] === (isMelodic(t) ? choice : 1) ? "off" : "on");
/** sets one cell; true when it changed */
export function setCell(p: Pattern, t: TrackId, s: number, mode: "on" | "off", choice = 1): boolean {
  if (s < 0 || s >= MAXC) return false;
  const v = mode === "off" ? 0 : isMelodic(t) ? choice : 1;
  if (p.tracks[t][s] === v) return false;
  p.tracks[t][s] = v; return true;
}
/** the cells touched in one stroke: the first cell decides on / off for all the others */
export function paint(p: Pattern, cells: { t: TrackId; s: number }[], choice: (t: TrackId) => number): number {
  if (!cells.length) return 0;
  const mode = decide(p, cells[0].t, cells[0].s, choice(cells[0].t));
  let n = 0;
  for (const c of cells) if (setCell(p, c.t, c.s, mode, choice(c.t))) n++;
  return n;
}
export const clearTrack = (p: Pattern, t: TrackId): void => { p.tracks[t] = rowOf(); };
export const clearAll = (p: Pattern): void => { TRACKS.forEach((t) => clearTrack(p, t.id)); };
export const countLit = (p: Pattern, t?: TrackId): number => (t ? [t] : TRACKS.map((x) => x.id)).reduce((n, id) => n + p.tracks[id].slice(0, cols(p)).filter(Boolean).length, 0);
/** 8 / 16 steps: the lit cells move to the same place of the new grid (to 8: two neighbours become one) */
export function setRes(p: Pattern, res: 2 | 4): void {
  if (res === p.res) return;
  const n = cols(p);
  for (const t of TRACKS) {
    const old = p.tracks[t.id], nw = rowOf();
    if (res < p.res) for (let i = 0; i < n; i += 2) nw[i / 2] = old[i] || old[i + 1] || 0;
    else for (let i = 0; i < n; i++) nw[i * 2] = old[i];
    p.tracks[t.id] = nw;
  }
  p.res = res;
}
export function setScale(p: Pattern, scale: ScaleId): void { p.scale = scale; }

/** a short history: one entry per change of the cells (not of tempo / volume) */
export class History {
  private stack: string[] = [];
  constructor(private max = 60) {}
  push(p: Pattern): void { this.stack.push(JSON.stringify(p)); if (this.stack.length > this.max) this.stack.shift(); }
  get size(): number { return this.stack.length; }
  pop(): Pattern | null { const s = this.stack.pop(); return s ? sanitize(JSON.parse(s)) : null; }
  clear(): void { this.stack = []; }
}

// ---------- presets and random ----------
export interface Preset { id: string; name: string; beats: 3 | 4; res: 2 | 4; bpm: number; swing: boolean; rows: Partial<Record<TrackId, string>> }
/** 'x' = on (drums); a digit = the choice of a melodic row; '.' = off. Strings are one bar. */
export const PRESETS: Preset[] = [
  { id: "rock", name: "摇滚", beats: 4, res: 4, bpm: 110, swing: false, rows: { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", crash: "x...............", bass: "1.......1.1....3." } },
  { id: "disco", name: "迪斯科", beats: 4, res: 4, bpm: 120, swing: false, rows: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", open: "..x...x...x...x.", bass: "1.1.1.1.1.1.1.1.", piano: "..4...4...5...5." } },
  { id: "hiphop", name: "嘻哈", beats: 4, res: 4, bpm: 90, swing: true, rows: { kick: "x.....x..x......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.xx", bass: "1.....1..1......" } },
  { id: "bossa", name: "波萨诺瓦", beats: 4, res: 4, bpm: 120, swing: false, rows: { kick: "x..x..x.x..x..x.", tom: "x..x..x...x..x..", hat: "x.x.x.x.x.x.x.x.", bass: "1.....3.1.....3.", guitar: "1.....1.......3." } },
  { id: "waltz", name: "华尔兹 3/4", beats: 3, res: 4, bpm: 100, swing: false, rows: { kick: "x...........", hat: "....x...x...", bass: "1...........", piano: "....3...3..." } },
];
export function applyPreset(p: Pattern, pr: Preset): void {
  clearAll(p);
  p.beats = pr.beats; p.res = pr.res; p.bpm = pr.bpm; p.swing = pr.swing;
  for (const [id, row] of Object.entries(pr.rows) as [TrackId, string][]) {
    const n = isMelodic(id) ? choicesOf(id, p.scale).length : 1;
    for (let i = 0; i < Math.min(row.length, MAXC); i++) {
      const ch = row[i];
      p.tracks[id][i] = ch === "." ? 0 : ch === "x" ? 1 : Math.min(n, Math.max(1, +ch || 1));
    }
  }
}
/** a random pattern: every row gets its own chance of a hit, stronger on the beats; at least one cell is lit */
export function randomize(p: Pattern, rnd: () => number = Math.random): void {
  clearAll(p);
  const n = cols(p);
  const chance: Record<TrackId, number> = { kick: 0.22, snare: 0.15, hat: 0.5, open: 0.1, tom: 0.1, crash: 0.04, ride: 0.1, piano: 0.2, guitar: 0.1, bass: 0.2 };
  for (const t of TRACKS) {
    const k = isMelodic(t.id) ? choicesOf(t.id, p.scale).length : 1;
    for (let i = 0; i < n; i++) {
      const onBeat = i % p.res === 0;
      let c = chance[t.id] * (onBeat ? 1.8 : 1);
      if (t.id === "kick" && i === 0) c = 1;
      if (rnd() < c) p.tracks[t.id][i] = isMelodic(t.id) ? 1 + Math.floor(rnd() * k) : 1;
    }
  }
  if (!countLit(p)) p.tracks.kick[0] = 1;
}

// ---------- time ----------
export const stepSeconds = (p: Pattern): number => 60 / p.bpm / p.res;
export const barSeconds = (p: Pattern): number => stepSeconds(p) * cols(p);
/** seconds from the start of the bar to the sound of a step (an odd step is late when swing is on) */
export const stepOffset = (p: Pattern, step: number): number => step * stepSeconds(p) + (p.swing && step % 2 === 1 ? SWING * stepSeconds(p) : 0);

/** what sounds at one step: muted rows are left out */
export interface Ev { track: TrackId; kind: TrackDef["kind"]; drum?: Drum; midi: number[]; vel: number; hold: number }
export function eventsAt(p: Pattern, step: number): Ev[] {
  const out: Ev[] = [], dur = stepSeconds(p);
  for (const t of TRACKS) {
    const v = p.tracks[t.id][step];
    if (!v || p.mute.includes(t.id) || p.vol[t.id] <= 0) continue;
    out.push({ track: t.id, kind: t.kind, drum: t.drum, midi: t.kind === "drum" ? [] : choicesOf(t.id, p.scale)[v - 1].midi, vel: p.vol[t.id], hold: Math.max(0.12, dur * 0.9) });
  }
  return out;
}

// ---------- the scheduler ("a tale of two clocks": a timer wakes every ~25 ms; it schedules the notes of the next ~100 ms at exact audio-clock times) ----------
export const LOOKAHEAD = 0.1, INTERVAL_MS = 25;
export class Sequencer {
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** what was scheduled (step + audio time), for the play head */
  private queue: { step: number; time: number }[] = [];
  running = false;
  constructor(private get: () => Pattern, private now: () => number, private fire: (e: Ev, when: number, step: number) => void, private setTimer: (f: () => void, ms: number) => ReturnType<typeof setInterval> = (f, ms) => setInterval(f, ms), private clearTimer: (t: ReturnType<typeof setInterval>) => void = (t) => clearInterval(t)) {}
  start(delay = 0.06): void {
    this.stop();
    this.running = true; this.step = 0; this.queue = []; this.last = -1;
    this.nextTime = this.now() + delay;
    this.tick();
    this.timer = this.setTimer(() => this.tick(), INTERVAL_MS);
  }
  stop(): void { if (this.timer !== null) this.clearTimer(this.timer); this.timer = null; this.running = false; this.queue = []; }
  tick(): void {
    if (!this.running) return;
    const p = this.get(), now = this.now();
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.02;   // the page was asleep: do not play the missed steps in a burst
    while (this.nextTime < now + LOOKAHEAD) {
      const n = cols(p), step = this.step % n;
      const when = this.nextTime + (p.swing && step % 2 === 1 ? SWING * stepSeconds(p) : 0);
      for (const e of eventsAt(p, step)) this.fire(e, when, step);
      this.queue.push({ step, time: when });
      this.nextTime += stepSeconds(p);
      this.step = (step + 1) % n;
    }
  }
  /** the step that is sounding now (for the play head); -1 before the first one */
  current(): number {
    const now = this.now();
    while (this.queue.length && this.queue[0].time <= now) this.last = this.queue.shift()!.step;
    return this.running ? this.last : -1;
  }
  private last = -1;
}

// ---------- kept on this device ----------
export interface Slot { id: string; name: string; date: string; p: Pattern }
export interface Store { cur: Pattern; slots: Slot[]; bars: 2 | 4 | 8 }
export const KEY = "learn.music.beats.v1";
export const MAX_SLOTS = 12;
export function loadStore(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object") {
      const slots: Slot[] = Array.isArray(v.slots) ? v.slots.filter((s: Slot) => s && typeof s.id === "string" && typeof s.name === "string").slice(0, MAX_SLOTS).map((s: Slot) => ({ id: s.id, name: s.name, date: String(s.date ?? ""), p: sanitize(s.p) })) : [];
      return { cur: sanitize(v.cur), slots, bars: v.bars === 2 || v.bars === 8 ? v.bars : 4 };
    }
  } catch { /* nothing kept */ }
  return { cur: emptyPattern(), slots: [], bars: 4 };
}
export function saveStore(s: Store): boolean { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; } }
