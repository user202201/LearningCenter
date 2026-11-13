/**
 * Recordings of the piano ("demos"): what was played (which key went down and up, and when) is kept on this device only (`learn.music.takes.v1`), can be played
 * back, renamed, deleted and exported as a standard MIDI file (.mid) that any music program opens. No network, no account.
 */
export interface NoteEvent { t: number; m: number; on: 0 | 1 }
export interface Take { id: string; name: string; date: string; ms: number; events: NoteEvent[] }
import { tr } from "./i18n";
import { TRACKS, cols, choicesOf, SWING, type Pattern } from "./beatlogic";
const KEY = "learn.music.takes.v1";
export const MAX_TAKES = 20;

export function loadTakes(): Take[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => x && Array.isArray(x.events)) : []; } catch { return []; }
}
export function saveTakes(takes: Take[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(takes.slice(0, MAX_TAKES))); return true; } catch { return false; }
}
/** the next free name "录音 N" */
export const nextName = (takes: Take[]): string => { let n = takes.length + 1; while (takes.some((t) => t.name === tr(`录音 ${n}`))) n++; return tr(`录音 ${n}`); };

/** a variable-length quantity of a MIDI file */
const vlq = (n: number): number[] => { const out = [n & 0x7f]; while ((n >>= 7) > 0) out.unshift((n & 0x7f) | 0x80); return out; };
/**
 * A format-0 MIDI file, 480 ticks per quarter note, 120 beats a minute (so one second = 960 ticks), one track, piano. Notes still down at the end are closed.
 */
export function buildMidi(events: NoteEvent[], name = "Demo"): Uint8Array {
  const ev = events.slice().sort((a, b) => a.t - b.t || a.on - b.on);
  const track: number[] = [0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0, 0xc0, 0];   // tempo 500000 us per quarter, program 0 = piano
  const nm = [...new TextEncoder().encode(name.slice(0, 40))];
  track.unshift(0, 0xff, 0x03, nm.length, ...nm);
  let last = 0; const down = new Set<number>();
  const emit = (t: number, m: number, on: 0 | 1) => { const tick = Math.round(t * 0.96); track.push(...vlq(Math.max(0, tick - last)), on ? 0x90 : 0x80, m & 0x7f, on ? 90 : 0); last = Math.max(last, tick); };
  for (const e of ev) { emit(e.t, e.m, e.on); if (e.on) down.add(e.m); else down.delete(e.m); }
  const end = ev.length ? ev[ev.length - 1].t : 0;
  down.forEach((m) => emit(end + 50, m, 0));
  track.push(0, 0xff, 0x2f, 0);
  const len = track.length;
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...track]);
}
/** a file given to the person (a download); also used by the beat maker */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function downloadMidi(take: Take): void { downloadBytes(buildMidi(take.events, take.name), `${take.name.replace(/[^\w一-鿿-]+/g, "_") || "demo"}.mid`); }

/**
 * The beat maker's loop as a format-0 MIDI file: 480 ticks per quarter note, the tempo and the time signature of the pattern, `bars` bars (the pattern repeated).
 * The drums are on channel 10 (General MIDI drum notes: kick 36, snare 38, closed hat 42, open hat 46, tom 45, crash 49, ride 51); piano = channel 1, guitar (nylon, the chord
 * as three notes) = channel 2, bass (finger bass) = channel 3. Muted rows are left out; swing is written as late odd steps, as it sounds in the app.
 */
export function buildPatternMidi(p: Pattern, bars: number, name = "Beat"): Uint8Array {
  const TPQ = 480, stepTicks = TPQ / p.res, n = cols(p), barTicks = stepTicks * n;
  const evs: { tick: number; order: number; bytes: number[] }[] = [];
  const nm = [...new TextEncoder().encode(name.slice(0, 40))];
  const head: number[] = [0, 0xff, 0x03, nm.length, ...nm];
  const us = Math.round(60_000_000 / p.bpm);
  head.push(0, 0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255);
  head.push(0, 0xff, 0x58, 0x04, p.beats, 2, 24, 8);
  head.push(0, 0xc1, 24, 0, 0xc2, 33, 0, 0xc0, 0);   // programs: guitar (nylon) on ch 2, bass (finger) on ch 3, piano on ch 1
  const put = (tick: number, len: number, ch: number, note: number, vel: number) => {
    evs.push({ tick, order: 1, bytes: [0x90 | ch, note & 127, vel] }, { tick: tick + len, order: 0, bytes: [0x80 | ch, note & 127, 0] });
  };
  for (let bar = 0; bar < bars; bar++) {
    for (let s = 0; s < n; s++) {
      const t0 = bar * barTicks + s * stepTicks + (p.swing && s % 2 === 1 ? Math.round(SWING * stepTicks) : 0);
      for (const t of TRACKS) {
        const v = p.tracks[t.id][s];
        if (!v || p.mute.includes(t.id) || p.vol[t.id] <= 0) continue;
        const vel = Math.max(1, Math.min(127, Math.round(25 + p.vol[t.id] * 100)));
        if (t.kind === "drum") put(t0, Math.min(90, stepTicks - 1), 9, t.gm!, vel);
        else for (const m of choicesOf(t.id, p.scale)[v - 1].midi) put(t0, Math.round(stepTicks * 0.9), t.kind === "piano" ? 0 : t.kind === "guitar" ? 1 : 2, m, vel);
      }
    }
  }
  evs.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const track = head; let last = 0;
  for (const e of evs) { track.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
  track.push(...vlq(Math.max(0, bars * barTicks - last)), 0xff, 0x2f, 0);
  const len = track.length;
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...track]);
}
