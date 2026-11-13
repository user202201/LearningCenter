/**
 * The DJ turntables (DJ 打碟, `#/music/dj`), pure part: no screen, no sound. The equal-power crossfader, tempo -> playback rate, BPM sync, the angle of a finger
 * round the platter and the scratch rate that follows from how fast it turns, the EQ and filter mapping, the list of the eight built-in tracks (the patterns the
 * tracks are rendered from, see `djtracks.ts`) and the list of the eight sample pads. The screen is `dj.ts`, the audio engine `djaudio.ts`.
 */

// ---------- the mixer ----------
/** the crossfader: x from -1 (only deck A) to +1 (only deck B); an equal-power curve (cos / sin), so the loudness stays the same in the middle (both 0.707) */
export function crossGains(x: number): { a: number; b: number } {
  const v = (Math.max(-1, Math.min(1, x)) + 1) / 2;
  return { a: Math.cos((v * Math.PI) / 2), b: Math.sin((v * Math.PI) / 2) };
}
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ---------- tempo ----------
export const PITCH_RANGE = 8;   // the tempo fader: +- 8 %
/** the playback rate of a deck whose tempo fader stands at `pitch` percent (+8 = 8 % faster) */
export const rateOf = (pitch: number): number => 1 + clamp(pitch, -PITCH_RANGE, PITCH_RANGE) / 100;
/** the BPM that is heard */
export const bpmOf = (trackBpm: number, pitch: number): number => trackBpm * rateOf(pitch);
/**
 * SYNC: the tempo fader (percent) that makes a track of `trackBpm` run at `masterBpm`. When that is outside +- 8 %, the half or double speed is tried (a 62 BPM
 * track can follow a 124 one); when nothing fits the fader goes as far as it can (`ok` false).
 */
export function syncPitch(masterBpm: number, trackBpm: number): { pitch: number; ok: boolean; mult: number } {
  let best = { pitch: 0, mult: 1, err: Infinity, ok: false };
  for (const mult of [1, 0.5, 2]) {   // (the plain tempo first: it wins a tie)
    const raw = (masterBpm / (trackBpm * mult) - 1) * 100, pitch = Math.round(clamp(raw, -PITCH_RANGE, PITCH_RANGE) * 10) / 10;
    const err = Math.abs(trackBpm * mult * (1 + pitch / 100) - masterBpm);   // how far from the master BPM the fader can get
    if (err < best.err - 1e-9) best = { pitch, mult, err, ok: Math.abs(raw) <= PITCH_RANGE + 1e-9 };
  }
  return { pitch: best.pitch, ok: best.ok, mult: best.mult };
}

// ---------- the platter ----------
export const PLATTER_DEG_PER_SEC = 200;   // 33 1/3 turns a minute
/** the angle (degrees, clockwise on the screen, 0 = to the right) of a point seen from the centre of the platter */
export const angleOf = (cx: number, cy: number, x: number, y: number): number => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
/** the shortest turn from one angle to the next (-180..180], so that crossing the +-180 line is no jump */
export function angleDelta(prev: number, next: number): number {
  let d = (next - prev) % 360;
  if (d > 180) d -= 360; else if (d <= -180) d += 360;
  return d;
}
export const SCRATCH_MAX = 4;
/** the playback rate that follows from a finger turning the record by `deg` degrees in `seconds` (the record at normal speed turns 200 degrees a second; backwards = negative) */
export const scratchRate = (deg: number, seconds: number): number => clamp(deg / Math.max(0.004, seconds) / PLATTER_DEG_PER_SEC, -SCRATCH_MAX, SCRATCH_MAX);
/** how fast the platter turns (degrees a second) at a playback rate */
export const platterSpeed = (rate: number): number => rate * PLATTER_DEG_PER_SEC;

// ---------- EQ and filter ----------
/** a 3-band EQ knob, -1..+1: 0 = flat, +1 = +6 dB, -1 = -30 dB (the band is cut, a DJ's "kill") */
export const eqDb = (v: number): number => { const x = clamp(v, -1, 1); return x >= 0 ? 6 * x : 30 * x; };
/** the filter knob, -1..+1: 0 = open; to the left a low-pass sweeps down from 20 kHz to 200 Hz, to the right a high-pass sweeps up from 20 Hz to 8 kHz */
export function filterFreqs(v: number): { lp: number; hp: number } {
  const x = clamp(v, -1, 1);
  return { lp: x < 0 ? 20000 * Math.pow(0.01, -x) : 20000, hp: x > 0 ? 20 * Math.pow(400, x) : 20 };
}

// ---------- the tracks ----------
export const SR = 44100;
export interface TrackDef {
  id: string; name: string; bpm: number; bars: number; color: string;
  key: number;                 // MIDI note of the key's root (bass register)
  minor: boolean;
  prog: number[];              // the root of each bar, in semitones above the key (repeats)
  kick: string; snare: string; hat: string;   // 16 steps a bar: x = hit, o = soft hit, . = nothing
  oh?: string; clap?: string; fill?: string;  // open hat, clap, snare of the last bar (a drum fill)
  bass: (number | null)[];     // 16 steps: semitones above the bar's root (null = rest)
  bassType: "sub" | "saw" | "pluck";
  chord: "stab" | "pad" | "arp" | "none"; chordSteps: string;
  swing?: number;              // an odd step is this much of a step late
}
const R = null;
export const TRACKS: TrackDef[] = [
  { id: "house", name: "浩室", bpm: 124, bars: 4, color: "#f03e3e", key: 45, minor: true, prog: [0, -4, -2, -5],
    kick: "x...x...x...x...", snare: "................", clap: "....x.......x...", hat: ".x.x.x.x.x.x.x.x", oh: "..x...x...x...x.",
    bass: [R, R, 0, R, R, R, 0, R, R, R, 12, R, R, R, 0, R], bassType: "saw", chord: "stab", chordSteps: ".x..x..x.x..x..." },
  { id: "boombap", name: "嘻哈", bpm: 90, bars: 4, color: "#ff922b", key: 43, minor: true, prog: [0, 0, -2, -4],
    kick: "x.....x...x.....", snare: "....x.......x...", fill: "....x.......x.xx", hat: "x.x.x.x.x.x.x.xx", swing: 0.25,
    bass: [0, R, R, R, R, R, 0, R, R, R, 7, R, R, R, R, R], bassType: "sub", chord: "pad", chordSteps: "x..............." },
  { id: "funk", name: "放克", bpm: 108, bars: 4, color: "#fab005", key: 40, minor: false, prog: [0, 0, 5, 7],
    kick: "x..x..x...x..x..", snare: "....x..o.o..x..o", fill: "....x..o.o.xxxxx", hat: "xoxoxoxoxoxoxoxo",
    bass: [0, R, 0, 12, R, 0, R, 7, 0, R, 0, R, 10, R, 7, R], bassType: "pluck", chord: "stab", chordSteps: "..x...x...x..x.." },
  { id: "synthwave", name: "合成器浪潮", bpm: 118, bars: 4, color: "#845ef7", key: 45, minor: true, prog: [0, -4, -9, -2],
    kick: "x...x...x...x..x", snare: "....x.......x...", fill: "....x.......xxxx", hat: "x.x.x.x.x.x.x.x.", oh: "..............x.",
    bass: [0, R, 0, 0, R, 0, 0, R, 0, R, 0, 0, R, 0, 12, R], bassType: "saw", chord: "arp", chordSteps: "xxxxxxxxxxxxxxxx" },
  { id: "techno", name: "科技舞曲", bpm: 130, bars: 4, color: "#339af0", key: 38, minor: true, prog: [0, 0, 0, -2],
    kick: "x...x...x...x...", snare: "................", clap: "....x.......x...", hat: "..x...x...x...x.", oh: "x.x.x.x.x.x.x.x.",
    bass: [R, 0, R, 0, R, 0, R, 12, R, 0, R, 0, R, 0, R, 7], bassType: "saw", chord: "stab", chordSteps: "x.....x.x...x..." },
  { id: "disco", name: "迪斯科", bpm: 120, bars: 4, color: "#e64980", key: 43, minor: false, prog: [0, 5, 7, 5],
    kick: "x...x...x...x...", snare: "....x.......x...", clap: "....x.......x...", hat: "xxxxxxxxxxxxxxxx", oh: "..x...x...x...x.",
    bass: [0, R, 12, 0, R, 12, 0, R, 0, R, 12, 0, R, 12, 0, 7], bassType: "pluck", chord: "stab", chordSteps: ".x.x.x.x.x.x.x.x" },
  { id: "lofi", name: "低保真", bpm: 84, bars: 4, color: "#12b886", key: 41, minor: false, prog: [0, 7, 9, 4],
    kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.xo", swing: 0.3,
    bass: [0, R, R, R, R, R, 7, R, R, R, 0, R, R, R, R, R], bassType: "sub", chord: "pad", chordSteps: "x.......x......." },
  { id: "dnb", name: "鼓打贝斯", bpm: 172, bars: 8, color: "#15aabf", key: 38, minor: true, prog: [0, 0, -4, -2],
    kick: "x.........x.....", snare: "....x.......x...", fill: "....x.......xxxx", hat: "x.x.x.x.x.x.x.x.", oh: "......x.......x.",
    bass: [0, R, R, R, R, R, R, R, 0, R, R, 7, R, R, 5, R], bassType: "sub", chord: "pad", chordSteps: "x..............." },
];
export const trackById = (id: string): TrackDef | undefined => TRACKS.find((t) => t.id === id);
/** the length of one loop in seconds, and in samples */
export const loopSeconds = (t: TrackDef): number => (t.bars * 4 * 60) / t.bpm;
export const loopFrames = (t: TrackDef): number => Math.round(loopSeconds(t) * SR);
/** the seconds of a step (a 16th note) */
export const stepSeconds = (t: TrackDef): number => 60 / t.bpm / 4;
/** the notes of a triad on `root` (MIDI) */
export const triad = (root: number, minor: boolean): number[] => [root, root + (minor ? 3 : 4), root + 7];

// ---------- the sample pads ----------
export type PadId = "horn" | "siren" | "laser" | "clap" | "scratch" | "stab" | "drop" | "rewind";
export const PADS: { id: PadId; name: string; color: string }[] = [
  { id: "horn", name: "气喇叭", color: "#f03e3e" },
  { id: "siren", name: "警笛", color: "#ff922b" },
  { id: "laser", name: "激光", color: "#fab005" },
  { id: "clap", name: "拍手", color: "#82c91e" },
  { id: "scratch", name: "搓碟声", color: "#12b886" },
  { id: "stab", name: "Yeah 和弦", color: "#339af0" },
  { id: "drop", name: "低音炮", color: "#845ef7" },
  { id: "rewind", name: "倒带", color: "#e64980" },
];
/** the keys 1..8 play the pads */
export const padOfKey = (k: string): PadId | null => { const n = Number(k); return Number.isInteger(n) && n >= 1 && n <= PADS.length ? PADS[n - 1].id : null; };

export const DEFAULT_TRACKS = ["house", "disco"];
