/**
 * PK, the look of the final screens and the sounds: pictures drawn in code (inline SVG), a small canvas particle system (fireworks, confetti, streamers) and
 * two short sounds made with the Web Audio API (a fanfare, a gentle descending "trombone"). All of it is cosmetic: the rules never wait for any of it.
 * Every loop is stopped by the function that starts it returns (the game stops them when a half is rebuilt or the game is left), and nothing starts
 * when the device asks for reduced motion.
 */
import { unlock } from "./musicaudio";
import { isMuted } from "./games/sfx";

export const reducedMotion = (): boolean => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

// ---------- pictures ----------
export const TROPHY = `<svg viewBox="0 0 100 110" aria-hidden="true">
  <ellipse cx="50" cy="104" rx="30" ry="5" fill="#000" opacity=".15"/>
  <path d="M28 14h44v28a22 22 0 0 1-44 0z" fill="#ffd43b" stroke="#e67700" stroke-width="4" stroke-linejoin="round"/>
  <path d="M28 22H12q0 24 20 28M72 22h16q0 24-20 28" fill="none" stroke="#f59f00" stroke-width="5" stroke-linecap="round"/>
  <path d="M36 20q-2 20 6 30" fill="none" stroke="#fff3bf" stroke-width="5" stroke-linecap="round" opacity=".85"/>
  <rect x="43" y="62" width="14" height="20" fill="#fcc419" stroke="#e67700" stroke-width="3"/>
  <rect x="28" y="82" width="44" height="16" rx="5" fill="#fab005" stroke="#e67700" stroke-width="3"/>
  <path d="M50 24l4 8 9 1-6.500 6 2 9-8.500-4.500L41.500 48l2-9L37 33l9-1z" fill="#fff" opacity=".9"/>
</svg>`;
export const CROWN = `<svg viewBox="0 0 100 60" aria-hidden="true"><path d="M8 52L4 14l24 18 22-26 22 26 24-18-4 38z" fill="#ffd43b" stroke="#e67700" stroke-width="4" stroke-linejoin="round"/><rect x="8" y="46" width="84" height="10" rx="4" fill="#fab005" stroke="#e67700" stroke-width="3"/><circle cx="50" cy="30" r="5" fill="#fa5252"/><circle cx="24" cy="38" r="3.500" fill="#4dabf7"/><circle cx="76" cy="38" r="3.500" fill="#69db7c"/></svg>`;
export const CLOUD = `<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M30 58a20 20 0 0 1-2-40 26 26 0 0 1 48-6 22 22 0 0 1 20 28 14 14 0 0 1-6 18z" fill="#adb5bd" stroke="#868e96" stroke-width="3" stroke-linejoin="round"/><path d="M34 26q10-8 20-4" fill="none" stroke="#dee2e6" stroke-width="4" stroke-linecap="round"/></svg>`;
export const STAR4 = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="currentColor"/></svg>`;

const FACE = (inner: string) => `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#ffd43b" stroke="#f59f00" stroke-width="4"/>${inner}</svg>`;
const EYE = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="6" fill="#2d2230"/>`;
/** a round face for each mood, drawn in code */
export const FACES: Record<"happy" | "sad" | "plead" | "shrug", string> = {
  happy: FACE(`<path d="M24 40q8-10 16 0M60 40q8-10 16 0" fill="none" stroke="#2d2230" stroke-width="5" stroke-linecap="round"/><path d="M26 58q24 28 48 0z" fill="#c92a2a" stroke="#2d2230" stroke-width="4" stroke-linejoin="round"/><circle cx="22" cy="58" r="7" fill="#ff8fa3" opacity=".7"/><circle cx="78" cy="58" r="7" fill="#ff8fa3" opacity=".7"/>`),
  sad: FACE(`<path d="M22 32l18 6M78 32l-18 6" stroke="#2d2230" stroke-width="5" stroke-linecap="round"/>${EYE(32, 48)}${EYE(68, 48)}<path d="M32 76q18-18 36 0" fill="none" stroke="#2d2230" stroke-width="5" stroke-linecap="round"/><path d="M68 56q8 12 0 18q-8-6 0-18z" fill="#4dabf7" stroke="#1c7ed6" stroke-width="2"/>`),
  plead: `<svg viewBox="0 0 100 118" aria-hidden="true"><circle cx="50" cy="48" r="44" fill="#ffd43b" stroke="#f59f00" stroke-width="4"/><path d="M22 26q10-8 20-2M78 26q-10-8-20-2" fill="none" stroke="#2d2230" stroke-width="4" stroke-linecap="round"/><ellipse cx="34" cy="46" rx="11" ry="13" fill="#fff" stroke="#2d2230" stroke-width="3"/><ellipse cx="66" cy="46" rx="11" ry="13" fill="#fff" stroke="#2d2230" stroke-width="3"/><circle cx="36" cy="48" r="7.500" fill="#2d2230"/><circle cx="64" cy="48" r="7.500" fill="#2d2230"/><circle cx="39" cy="44" r="3" fill="#fff"/><circle cx="67" cy="44" r="3" fill="#fff"/><path d="M40 72q10-6 20 0" fill="none" stroke="#2d2230" stroke-width="4" stroke-linecap="round"/><ellipse cx="50" cy="98" rx="16" ry="12" fill="#ffd8a8" stroke="#e8590c" stroke-width="3"/><path d="M42 92q8 8 16 0" fill="none" stroke="#e8590c" stroke-width="3" stroke-linecap="round"/></svg>`,
  shrug: FACE(`<path d="M22 32q10-8 20-2M60 26l18-4" fill="none" stroke="#2d2230" stroke-width="5" stroke-linecap="round"/>${EYE(32, 46)}${EYE(68, 46)}<path d="M34 72q8-6 16 0t16 0" fill="none" stroke="#2d2230" stroke-width="5" stroke-linecap="round"/>`),
};

// ---------- sounds ----------
const note = (f0: number, f1: number, at: number, dur: number, type: OscillatorType, peak: number, lp = 0) => {
  const c = unlock();
  if (!c || isMuted()) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.linearRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = g;
  if (lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; g.connect(f); out = f; }
  o.connect(g); out.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
};
/** a bright, loud fanfare: a rising run, then a held major chord */
export function fanfare(): void {
  [523, 659, 784, 1047].forEach((f, i) => { note(f, f, i * 0.11, 0.16, "triangle", 0.26); note(f * 2, f * 2, i * 0.11, 0.12, "square", 0.05); });
  [523, 659, 784, 1047, 1319].forEach((f) => note(f, f, 0.5, 0.9, "sawtooth", 0.07, 2600));
  [784, 988, 1175, 1568].forEach((f, i) => note(f, f, 1.5 + i * 0.1, 0.5, "triangle", 0.14));
}
/** a soft descending "wah wah wah wahhh" */
export function trombone(): void {
  [[311, 293], [293, 277], [277, 261], [233, 196]].forEach(([a, b], i) => note(a, b, i * 0.34, i === 3 ? 0.9 : 0.3, "sawtooth", 0.1, 700));
}
export function jingle(): void { [523, 659, 523].forEach((f, i) => note(f, f, i * 0.12, 0.16, "triangle", 0.18)); }

// ---------- particles ----------
interface Part { x: number; y: number; vx: number; vy: number; g: number; life: number; age: number; c: string; w: number; h: number; rot: number; vr: number; kind: "dot" | "rect" | "star" }
const PALETTE = ["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7", "#da77f2", "#ff922b", "#38d9a9"];

/**
 * Starts fireworks / confetti cannons / streamers ("win") or a few falling confetti ("tie") on a canvas that covers `host`, until the returned function is called
 * (or `host` leaves the page). Sized by LAYOUT size (host.offsetWidth / offsetHeight), so a turned half is drawn right. Nothing runs for reduced motion.
 */
export function startFx(host: HTMLElement, mode: "win" | "tie", accent: string): () => void {
  if (reducedMotion()) return () => { /* nothing runs */ };
  const cv = document.createElement("canvas");
  cv.className = "pk-fx";
  const ctx = cv.getContext("2d");
  if (!ctx) return () => { /* no canvas */ };
  host.prepend(cv);
  const colors = [accent, ...PALETTE];
  const parts: Part[] = [];
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0, stopped = false;
  let nextBurst = 0.15, nextCannon = 0.3, nextStream = 0, burstN = 0;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  const size = () => {
    const w = host.offsetWidth, h = host.offsetHeight;
    if (w === W && h === H) return;
    W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  };
  const burst = (x: number, y: number) => {
    const c1 = pick(), c2 = pick(), n = 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1), v = rnd(60, 150) * (W / 400 + 0.6) / 1.4;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 90, life: rnd(0.8, 1.3), age: 0, c: i % 2 ? c1 : c2, w: 3.2, h: 3.2, rot: 0, vr: 0, kind: i % 5 === 0 ? "star" : "dot" });
    }
  };
  const cannon = (fromLeft: boolean) => {
    for (let i = 0; i < 16; i++) {
      const a = (fromLeft ? -Math.PI / 2 + rnd(0.15, 0.7) : -Math.PI / 2 - rnd(0.15, 0.7)), v = rnd(220, 420) * (H / 400 + 0.5) / 1.3;
      parts.push({ x: fromLeft ? 4 : W - 4, y: H - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 380, life: rnd(1.5, 2.4), age: 0, c: pick(), w: rnd(5, 9), h: rnd(3, 5), rot: rnd(0, 6), vr: rnd(-9, 9), kind: "rect" });
    }
  };
  const stream = () => {
    parts.push({ x: rnd(0, W), y: -10, vx: rnd(-14, 14), vy: rnd(60, 110), g: 10, life: rnd(2.6, 4), age: 0, c: pick(), w: 3, h: rnd(14, 26), rot: rnd(-0.4, 0.4), vr: rnd(-1.5, 1.5), kind: "rect" });
  };
  const star = (p: Part, a: number) => {
    const r = p.w * 1.8;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.4 : r, an = (k / 8) * Math.PI * 2; ctx.lineTo(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.globalAlpha = a; ctx.fill();
  };
  const frame = (ts: number) => {
    if (stopped) return;
    if (!host.isConnected) return stop();
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
    if (document.hidden) return;
    size(); t += dt;
    if (mode === "win") {
      if (t >= nextBurst && parts.length < 420) { burst(rnd(W * 0.15, W * 0.85), rnd(H * 0.12, H * 0.5)); burstN++; nextBurst = t + (burstN < 6 ? 0.42 : rnd(0.7, 1.2)); }
      if (t >= nextCannon && parts.length < 420) { cannon(true); cannon(false); nextCannon = t + 2.4; }
      if (t >= nextStream && parts.length < 420) { stream(); nextStream = t + 0.14; }
    } else if (t >= nextStream && parts.length < 160) { for (let i = 0; i < 2; i++) stream(); nextStream = t + 0.3; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life || p.y > H + 30) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= p.kind === "rect" ? 0.992 : 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = Math.max(0, Math.min(1, (p.life - p.age) / 0.5));
      ctx.fillStyle = p.c;
      if (p.kind === "dot") { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(p.x, p.y, p.w, 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === "star") star(p, a);
      else { ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  };
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    cv.remove();
  }
  raf = requestAnimationFrame(frame);
  return stop;
}

/** counts a number up in `el` (with the browser's frame clock); the returned function stops it and shows the final number */
export function countUp(el: HTMLElement, to: number, ms = 900): () => void {
  if (reducedMotion() || to <= 0) { el.textContent = String(to); return () => { /* done */ }; }
  let raf = 0, done = false;
  const t0 = performance.now();
  const step = (ts: number) => {
    if (done) return;
    const k = Math.min(1, (ts - t0) / ms), n = Math.floor(k * to + 0.0001);
    const s = String(k >= 1 ? to : n);
    if (el.textContent !== s) { el.textContent = s; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
    if (k < 1) raf = requestAnimationFrame(step); else done = true;
  };
  el.textContent = "0";
  raf = requestAnimationFrame(step);
  return () => { if (!done) { done = true; cancelAnimationFrame(raf); } el.textContent = String(to); };
}
