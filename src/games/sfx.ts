/** Cartoon sound effects of the games, made with the Web Audio API (no files). `setMuted` is the shell's sound switch. */
import { unlock } from "./../musicaudio";
import type { SfxKind } from "./ctx";
let muted = false;
export const setMuted = (m: boolean) => { muted = m; };
export const isMuted = () => muted;
const blip = (f0: number, f1: number, dur: number, type: OscillatorType = "sine", peak = 0.22, delay = 0) => {
  const c = unlock();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
};
export function sfx(kind: SfxKind): void {
  switch (kind) {
    case "tap": blip(520, 640, 0.07, "triangle", 0.18); break;
    case "move": blip(330, 300, 0.06, "triangle", 0.14); break;
    case "place": blip(220, 160, 0.1, "sine", 0.3); break;
    case "eat": blip(500, 900, 0.1, "square", 0.14); break;
    case "rotate": blip(420, 560, 0.06, "triangle", 0.16); break;
    case "swap": blip(380, 520, 0.09, "triangle", 0.18); break;
    case "pop": blip(700, 1200, 0.11, "sine", 0.26); break;
    case "drop": blip(260, 120, 0.12, "sine", 0.3); break;
    case "good": blip(523, 523, 0.09, "triangle", 0.2); blip(784, 784, 0.14, "triangle", 0.2, 0.08); break;
    case "line": [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.1, "triangle", 0.2, i * 0.06)); break;
    case "bad": blip(300, 150, 0.22, "sawtooth", 0.14); break;
    case "capture": blip(180, 70, 0.18, "square", 0.22); blip(660, 330, 0.16, "triangle", 0.2, 0.05); break;
    case "check": blip(880, 880, 0.12, "square", 0.16); blip(660, 660, 0.14, "square", 0.16, 0.13); blip(880, 880, 0.18, "square", 0.16, 0.27); break;
    case "win": [523, 659, 784, 1047, 784, 1047].forEach((f, i) => blip(f, f * 1.01, 0.16, "triangle", 0.22, i * 0.11)); break;
    case "lose": [392, 349, 330, 262].forEach((f, i) => blip(f, f * 0.98, 0.22, "triangle", 0.2, i * 0.16)); break;
  }
}
