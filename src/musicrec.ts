/**
 * Recordings of the piano ("demos"): what was played (which key went down and up, and when) is kept on this device only (`learn.music.takes.v1`), can be played
 * back, renamed, deleted and exported as a standard MIDI file (.mid) that any music program opens. No network, no account.
 */
export interface NoteEvent { t: number; m: number; on: 0 | 1 }
export interface Take { id: string; name: string; date: string; ms: number; events: NoteEvent[] }
import { tr } from "./i18n";
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
export function downloadMidi(take: Take): void {
  const blob = new Blob([buildMidi(take.events, take.name) as BlobPart], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${take.name.replace(/[^\w一-鿿-]+/g, "_") || "demo"}.mid`;
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
