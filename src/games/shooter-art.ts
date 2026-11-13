/** Space shooter: all the drawing (canvas, board coordinates 360 x 640). Round cartoon characters with faces; four worlds with their own colours and parallax layers. */
import { W, H, shipR, dronePos, phaseOf, type State, type Enemy, type PKind, type WKind } from "./shooter-logic";
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const INK = "#3a2e39";

export interface Pal { bg: [string, string, string]; a: string; ad: string; b: string; bd: string; planet: [string, string][] }
export const WORLDS: Pal[] = [
  { bg: ["#1b1464", "#3b1f6e", "#6a2c91"], a: "#51cf66", ad: "#2b8a3e", b: "#ffd43b", bd: "#e67700", planet: [["#f783ac", "#c2255c"], ["#74c0fc", "#1971c2"]] },
  { bg: ["#0b1d3a", "#1d3557", "#34495e"], a: "#ffa94d", ad: "#d9480f", b: "#63e6be", bd: "#087f5b", planet: [["#adb5bd", "#495057"], ["#e8c9a0", "#a67c52"]] },
  { bg: ["#7b2cbf", "#c77dff", "#ffafcc"], a: "#ff6b9d", ad: "#c2255c", b: "#8ce99a", bd: "#2b8a3e", planet: [["#ffe066", "#f08c00"], ["#a5d8ff", "#1c7ed6"]] },
  { bg: ["#06141f", "#0c2b3a", "#12485c"], a: "#4dabf7", ad: "#1864ab", b: "#ff8787", bd: "#c92a2a", planet: [["#3bc9db", "#0b7285"], ["#9775fa", "#5f3dc4"]] },
];
// the parallax layers are fixed (a tiny generator, not the game's: drawing never touches the simulation)
let gs = 977;
const gr = () => { gs = (gs * 1664525 + 1013904223) >>> 0; return gs / 4294967296; };
const STARS = [0, 1, 2].map((l) => Array.from({ length: 34 - l * 8 }, () => ({ x: gr() * W, y: gr() * H, r: 0.6 + l * 0.7 + gr() * 0.6, p: gr() * 6 })));
const THINGS = Array.from({ length: 7 }, (_, i) => ({ x: gr() * W, y: (i / 7) * (H + 160) - 80, s: 14 + gr() * 34, sp: 10 + gr() * 22, k: i % 3, p: gr() * 6 }));

function rr(g: G, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function eyes(g: G, x: number, y: number, gap: number, r: number, look = 0, mood: "happy" | "angry" | "hurt" | "shock" = "happy") {
  g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.3);
  for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * gap, y, mood === "shock" ? r * 1.2 : r, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = INK;
  for (const d of [-1, 1]) { g.beginPath(); if (mood === "hurt") { g.moveTo(x + d * gap - r * 0.5, y - r * 0.5); g.lineTo(x + d * gap + r * 0.5, y + r * 0.5); g.moveTo(x + d * gap + r * 0.5, y - r * 0.5); g.lineTo(x + d * gap - r * 0.5, y + r * 0.5); g.stroke(); } else { g.arc(x + d * gap + look * r * 0.35, y + r * 0.1, r * (mood === "shock" ? 0.35 : 0.5), 0, TAU); g.fill(); } }
  if (mood === "angry") { g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.35); g.lineCap = "round"; g.beginPath(); g.moveTo(x - gap - r, y - r * 1.5); g.lineTo(x - gap + r * 0.8, y - r * 0.8); g.moveTo(x + gap + r, y - r * 1.5); g.lineTo(x + gap - r * 0.8, y - r * 0.8); g.stroke(); }
}
function mouth(g: G, x: number, y: number, w: number, mood: "happy" | "angry" | "hurt" | "shock") {
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = Math.max(1.5, w * 0.16); g.lineCap = "round"; g.beginPath();
  if (mood === "happy") g.arc(x, y - w * 0.15, w * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === "angry") g.arc(x, y + w * 0.5, w * 0.5, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (mood === "shock") { g.ellipse(x, y, w * 0.28, w * 0.36, 0, 0, TAU); g.fill(); }
  else { g.moveTo(x - w * 0.5, y); g.lineTo(x - w * 0.17, y - w * 0.17); g.lineTo(x + w * 0.17, y + w * 0.17); g.lineTo(x + w * 0.5, y); }
  g.stroke();
}
const mood = (e: Enemy): "happy" | "angry" | "hurt" | "shock" => (e.hurt > 0 ? "hurt" : "angry");

export function drawBackground(g: G, world: number, sc: number) {
  const P = WORLDS[world];
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, P.bg[0]); bg.addColorStop(0.55, P.bg[1]); bg.addColorStop(1, P.bg[2]);
  g.fillStyle = bg; g.fillRect(-12, 0, W + 24, H);
  // soft planets / floating things: slow layer
  for (const t of THINGS) {
    const y = ((t.y + sc * t.sp) % (H + 160)) - 80, x = t.x;
    g.globalAlpha = 0.5;
    if (world === 0) { const c = P.planet[t.k % 2]; g.fillStyle = c[0]; g.beginPath(); g.arc(x, y, t.s, 0, TAU); g.fill(); g.fillStyle = c[1]; g.globalAlpha = 0.25; g.beginPath(); g.arc(x + t.s * 0.3, y + t.s * 0.3, t.s * 0.7, 0, TAU); g.fill(); if (t.k === 0) { g.globalAlpha = 0.4; g.strokeStyle = c[0]; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, t.s * 1.5, t.s * 0.35, -0.3, 0, TAU); g.stroke(); } }
    else if (world === 1) { g.fillStyle = P.planet[t.k % 2][0]; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t.p, r = t.s * (0.7 + 0.3 * Math.sin(i * 2.3 + t.p)); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = P.planet[t.k % 2][1]; g.globalAlpha = 0.3; g.beginPath(); g.arc(x - t.s * 0.2, y - t.s * 0.1, t.s * 0.25, 0, TAU); g.fill(); }
    else if (world === 2) {
      if (t.k === 0) { g.fillStyle = "#fff"; for (const [dx, dy, r] of [[-1, 0.2, 0.7], [0, 0, 1], [1, 0.25, 0.75]] as const) { g.beginPath(); g.arc(x + dx * t.s * 0.8, y + dy * t.s * 0.5, r * t.s * 0.7, 0, TAU); g.fill(); } }
      else { const c = P.planet[t.k % 2]; g.fillStyle = c[0]; g.beginPath(); g.arc(x, y, t.s * 0.6, 0, TAU); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, t.s * 0.35, 0, TAU * 0.7); g.stroke(); if (t.k === 1) { g.strokeStyle = "#fff"; g.beginPath(); g.moveTo(x, y + t.s * 0.6); g.lineTo(x, y + t.s * 1.3); g.stroke(); } }
    } else {
      g.save(); g.translate(x, y); g.rotate(sc * 0.2 * (t.k - 1) + t.p); g.fillStyle = P.planet[t.k % 2][0]; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? t.s * 0.8 : t.s; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = P.bg[1]; g.beginPath(); g.arc(0, 0, t.s * 0.35, 0, TAU); g.fill(); g.restore();
    }
    g.globalAlpha = 1;
  }
  // stars: three layers, the near ones faster
  for (let l = 0; l < 3; l++) for (const st of STARS[l]) {
    const y = (st.y + sc * (14 + l * 26)) % H;
    g.globalAlpha = 0.45 + 0.4 * Math.sin(sc * 2 + st.p); g.fillStyle = l === 2 ? "#fff" : "#dbe4ff"; g.beginPath(); g.arc(st.x, y, st.r, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}

export function drawShip(g: G, s: State, t: number, expr: "happy" | "angry" | "hurt" | "shock") {
  if (s.over) return;
  const { x, y } = s.ship, tilt = Math.max(-0.35, Math.min(0.35, s.ship.vx / 900)), speed = Math.min(1, Math.abs(s.ship.vx) / 400);
  if (s.inv > 0 && Math.floor(t * 14) % 2 === 0 && !s.bossDead) g.globalAlpha = 0.4;
  g.save(); g.translate(x, y); g.rotate(tilt);
  // the flame grows with the speed and flickers
  const fl = 14 + speed * 10 + Math.sin(t * 40) * 3;
  g.fillStyle = "#ff922b"; g.beginPath(); g.moveTo(-7, 14); g.quadraticCurveTo(0, 14 + fl * 1.4, 7, 14); g.fill();
  g.fillStyle = "#ffe066"; g.beginPath(); g.moveTo(-4, 14); g.quadraticCurveTo(0, 14 + fl, 4, 14); g.fill();
  // fins
  g.fillStyle = "#fa5252"; g.strokeStyle = "#c92a2a"; g.lineWidth = 3; g.lineJoin = "round";
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 9, 2); g.quadraticCurveTo(d * 20, 8, d * 17, 20); g.lineTo(d * 8, 14); g.closePath(); g.fill(); g.stroke(); }
  // body
  g.fillStyle = "#fff"; g.strokeStyle = "#087f5b"; g.lineWidth = 3.5; g.beginPath(); g.ellipse(0, 0, 13, 19, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = "#12b886"; g.beginPath(); g.moveTo(-11, -9); g.quadraticCurveTo(0, -30, 11, -9); g.quadraticCurveTo(0, -13, -11, -9); g.fill(); g.stroke();
  g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-5, -3, 2.5, 6, 0.15, 0, TAU); g.fill();
  eyes(g, 0, 1, 5, 3.4, tilt * 5, expr); mouth(g, 0, 10, 6, expr);
  g.restore(); g.globalAlpha = 1;
  for (const d of dronePos(s)) { g.fillStyle = "#74c0fc"; g.strokeStyle = "#1971c2"; g.lineWidth = 2.5; g.beginPath(); g.arc(d.x, d.y, 7, 0, TAU); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(d.x - 2, d.y - 1, 1.3, 0, TAU); g.arc(d.x + 2, d.y - 1, 1.3, 0, TAU); g.fill(); }
  if (s.shield > 0) { g.strokeStyle = "rgba(99,230,190,.95)"; g.fillStyle = "rgba(99,230,190,.2)"; g.lineWidth = 3 + (s.shield - 1); g.beginPath(); g.arc(x, y, 27, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(x - 12, y - 14, 5, 3, -0.7, 0, TAU); g.fill(); }
}

function bumpy(g: G, e: Enemy, fill: string, stroke: string) {
  g.save(); g.translate(e.x, e.y); g.rotate(e.t * e.spin * 0.6);
  g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 3; g.lineJoin = "round"; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, r = e.r * (0.86 + 0.14 * Math.sin(i * 2.7 + e.id)); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.arc(e.r * 0.3, e.r * 0.25, e.r * 0.28, 0, TAU); g.arc(-e.r * 0.35, e.r * 0.4, e.r * 0.15, 0, TAU); g.fill();
  g.restore();
}
function flash(g: G, e: Enemy) { if (e.hurt > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.65, e.hurt * 6)})`; g.beginPath(); g.arc(e.x, e.y, e.r, 0, TAU); g.fill(); } }

export function drawEnemies(g: G, s: State, world: number, t: number) {
  const P = WORLDS[world];
  // snake chains: a line through the segments of one chain
  const chains = new Map<number, Enemy[]>();
  for (const e of s.enemies) if (e.kind === "snake") { const a = chains.get(e.grp) ?? []; a.push(e); chains.set(e.grp, a); }
  g.strokeStyle = P.ad; g.lineWidth = 6; g.lineCap = "round";
  for (const c of chains.values()) { c.sort((a, b) => a.id - b.id); g.beginPath(); c.forEach((e, i) => (i ? g.lineTo(e.x, e.y) : g.moveTo(e.x, e.y))); g.stroke(); }
  for (const e of s.enemies) {
    const k = e.kind, { x, y, r } = e, flap = Math.sin(t * 22 + e.id) * 0.3;
    if (k === "rock") { bumpy(g, e, world === 1 ? "#c8a97e" : "#ced4da", world === 1 ? "#7f5f3a" : "#495057"); if (e.size >= 2) { eyes(g, x, y - 1, r * 0.3, r * 0.17, 0, mood(e)); mouth(g, x, y + r * 0.35, r * 0.35, mood(e) === "hurt" ? "hurt" : "angry"); } else { g.fillStyle = INK; g.beginPath(); g.arc(x - 3, y, 1.6, 0, TAU); g.arc(x + 3, y, 1.6, 0, TAU); g.fill(); } flash(g, e); continue; }
    if (k === "snake") { g.fillStyle = P.a; g.strokeStyle = P.ad; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); eyes(g, x, y - 1, 4, 3, 0, mood(e)); flash(g, e); continue; }
    if (k === "balloon") {
      const col = ["#ff6b9d", "#ffd43b", "#74c0fc", "#8ce99a"][e.id % 4];
      g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y + r); g.quadraticCurveTo(x + 6, y + r + 12, x - 2, y + r + 24); g.stroke();
      g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r * 0.9, r, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(x - 6, y - 7, 3, 5, 0.5, 0, TAU); g.fill();
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 2; rr(g, x - 7, y - 3, 14, 11, 2); g.fill(); g.stroke(); g.fillStyle = "#fa5252"; g.fillRect(x - 1, y - 3, 2.5, 11); g.fillRect(x - 7, y + 1.5, 14, 2.5);
      continue;
    }
    if (k === "stealth") {
      g.globalAlpha = e.vis ? 0.95 : 0.22;
      g.fillStyle = "#364fc7"; g.strokeStyle = "#1b2a85"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r, y + r); g.quadraticCurveTo(x - r * 1.1, y - r * 1.2, x, y - r * 1.1); g.quadraticCurveTo(x + r * 1.1, y - r * 1.2, x + r, y + r); for (let i = 0; i < 3; i++) g.quadraticCurveTo(x + r - (i + 0.5) * (2 * r / 3), y + r * 0.5, x + r - (i + 1) * (2 * r / 3), y + r); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#ffe066"; g.beginPath(); g.arc(x - 4.5, y - 2, 3, 0, TAU); g.arc(x + 4.5, y - 2, 3, 0, TAU); g.fill();
      g.globalAlpha = 1; flash(g, e); continue;
    }
    if (k === "comet") {
      const a = Math.atan2(e.vy, e.vx), len = 70;
      const tl = g.createLinearGradient(x, y, x - Math.cos(a) * len, y - Math.sin(a) * len); tl.addColorStop(0, "rgba(255,169,77,.85)"); tl.addColorStop(1, "rgba(255,169,77,0)");
      g.fillStyle = tl; g.beginPath(); g.moveTo(x + Math.cos(a + 1.57) * r, y + Math.sin(a + 1.57) * r); g.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); g.lineTo(x + Math.cos(a - 1.57) * r, y + Math.sin(a - 1.57) * r); g.fill();
      g.fillStyle = "#fff3bf"; g.strokeStyle = "#f59f00"; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); eyes(g, x, y - 1, 4.5, 3.4, 0, "shock"); mouth(g, x, y + 7, 6, "shock"); flash(g, e); continue;
    }
    if (k === "boss") { drawBoss(g, e, world, t); continue; }
    // the rest: round ships with faces
    if (k === "flyer" || k === "zigzag") {
      g.fillStyle = k === "flyer" ? P.a : P.b; g.strokeStyle = k === "flyer" ? P.ad : P.bd; g.lineWidth = 3;
      for (const d of [-1, 1]) { g.save(); g.translate(x + d * r * 0.8, y - 3); g.rotate(d * (0.5 + flap)); g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(0, 0, r * 0.7, r * 0.38, 0, 0, TAU); g.fill(); g.restore(); }
      g.fillStyle = k === "flyer" ? P.a : P.b; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
      if (k === "zigzag") { g.strokeStyle = P.bd; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r * 0.9, y + 6); g.lineTo(x + r * 0.9, y + 6); g.stroke(); }
      g.strokeStyle = P.ad; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, y - r); g.lineTo(x - 8, y - r - 7); g.moveTo(x + 4, y - r); g.lineTo(x + 8, y - r - 7); g.stroke();
      eyes(g, x, y - 2, 4.5, 3.4, 0, mood(e)); mouth(g, x, y + 7, 6, e.hurt > 0 ? "hurt" : "angry");
    } else if (k === "diver" || k === "swarm") {
      const a = e.dive ? Math.atan2(e.vx, -e.vy) : Math.PI; g.save(); g.translate(x, y); g.rotate(a + Math.PI);
      g.fillStyle = k === "diver" ? "#9775fa" : "#fa5252"; g.strokeStyle = k === "diver" ? "#5f3dc4" : "#c92a2a"; g.lineWidth = 3; g.lineJoin = "round";
      g.beginPath(); g.moveTo(0, -r * 1.5); g.quadraticCurveTo(r * 1.2, -r * 0.2, r * 0.8, r * 0.7); g.quadraticCurveTo(0, r * 1.3, -r * 0.8, r * 0.7); g.quadraticCurveTo(-r * 1.2, -r * 0.2, 0, -r * 1.5); g.fill(); g.stroke(); g.restore();
      eyes(g, x, y, r * 0.35, r * 0.25, 0, mood(e));
    } else if (k === "shield") {
      g.fillStyle = P.b; g.strokeStyle = P.bd; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y + 4, r * 1.15, r * 0.6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "#e7f5ff"; g.beginPath(); g.arc(x, y - 3, r * 0.7, Math.PI, TAU); g.fill(); g.stroke(); eyes(g, x, y - 5, 4, 3, 0, mood(e));
      if (e.sh > 0) { g.fillStyle = "rgba(116,192,252,.28)"; g.strokeStyle = "rgba(116,192,252,.95)"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 7, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.ellipse(x - 8, y - 12, 4, 2.5, -0.6, 0, TAU); g.fill(); }
    } else if (k === "splitter" || k === "mini") {
      g.fillStyle = "#ff8787"; g.strokeStyle = "#c92a2a"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
      if (k === "splitter") { g.strokeStyle = "#c92a2a"; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x - 3, y - 3); g.lineTo(x + 3, y + 4); g.lineTo(x, y + r); g.stroke(); }
      eyes(g, x, y - 1, r * 0.38, r * 0.24, 0, mood(e)); if (k === "splitter") mouth(g, x, y + r * 0.5, 7, "angry");
    } else if (k === "bomber") {
      g.fillStyle = P.a; g.strokeStyle = P.ad; g.lineWidth = 3.5; g.beginPath(); g.ellipse(x, y, r * 1.3, r * 0.85, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = INK; rr(g, x - 8, y + r * 0.45, 16, 8, 3); g.fill();
      g.fillStyle = "#ffe066"; for (const d of [-1, 0, 1]) { g.beginPath(); g.arc(x + d * 12, y + r * 0.1, 2.2, 0, TAU); g.fill(); }
      eyes(g, x, y - 6, 6, 4.5, 0, mood(e));
    } else if (k === "mother") {
      g.fillStyle = "#ced4da"; g.strokeStyle = "#495057"; g.lineWidth = 3.5; g.beginPath(); g.ellipse(x, y, r * 1.45, r * 0.7, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "#a5d8ff"; g.beginPath(); g.arc(x, y - 6, r * 0.5, Math.PI, TAU); g.fill(); g.stroke();
      for (const d of [-1, 1]) { const tx = x + d * 24, ty = y + 8, a = Math.atan2(s.ship.x - tx, s.ship.y - ty); g.fillStyle = "#fa5252"; g.strokeStyle = "#c92a2a"; g.beginPath(); g.arc(tx, ty, 7, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.sin(a) * 12, ty + Math.cos(a) * 12); g.stroke(); }
      eyes(g, x, y - 8, 5, 3.5, 0, mood(e));
    }
    flash(g, e);
  }
}

export function drawBoss(g: G, e: Enemy, world: number, t: number, dyingT = -1) {
  const { x, y, r } = e, P = WORLDS[world], ph = e.maxhp ? phaseOf(e) : 0, ex: "happy" | "angry" | "hurt" | "shock" = e.hurt > 0 || dyingT >= 0 ? "hurt" : ph === 2 ? "shock" : "angry";
  const sh = dyingT >= 0 ? Math.sin(t * 90) * 3 : e.tele ? Math.sin(t * 70) * 2 : 0;
  g.save(); g.translate(x + sh, y);
  g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
  const bt = e.bt;
  if (bt === 0) { g.fillStyle = "#ced4da"; g.strokeStyle = "#495057"; g.beginPath(); g.ellipse(0, 0, r * 1.5, r * 0.8, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "#a5d8ff"; g.beginPath(); g.arc(0, -8, r * 0.55, Math.PI, TAU); g.fill(); g.stroke(); for (const d of [-1, 1]) { g.fillStyle = "#fa5252"; g.strokeStyle = "#c92a2a"; g.beginPath(); g.arc(d * 40, 8, 8, 0, TAU); g.fill(); g.stroke(); } }
  else if (bt === 1) { g.fillStyle = "#f783ac"; g.strokeStyle = "#c2255c"; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 15, 10); g.quadraticCurveTo(i * 15 + Math.sin(t * 5 + i) * 10, 40, i * 15 + Math.sin(t * 4 + i * 2) * 6, 58); g.lineWidth = 8; g.stroke(); } g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r, Math.PI, TAU); g.quadraticCurveTo(r, 28, 0, 22); g.quadraticCurveTo(-r, 28, -r, 0); g.fill(); g.stroke(); g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(-16, -22, 10, 6, -0.5, 0, TAU); g.fill(); }
  else if (bt === 2) { g.fillStyle = "#adb5bd"; g.strokeStyle = "#495057"; rr(g, -r * 0.95, -r * 0.75, r * 1.9, r * 1.5, 14); g.fill(); g.stroke(); g.strokeStyle = "#495057"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -r * 0.75); g.lineTo(0, -r * 1.1); g.stroke(); g.fillStyle = "#fa5252"; g.beginPath(); g.arc(0, -r * 1.1, 5, 0, TAU); g.fill(); for (const d of [-1, 1]) { g.fillStyle = "#495057"; rr(g, d * r * 0.95 - 6, 4, 12, 30, 5); g.fill(); g.fillStyle = e.tele || ph ? "#ff6b6b" : "#868e96"; g.beginPath(); g.arc(d * r * 0.95, 36, 6, 0, TAU); g.fill(); } }
  else if (bt === 3) { g.fillStyle = "#ffd8a8"; g.strokeStyle = "#d9480f"; g.beginPath(); g.moveTo(-r * 0.9, 6); g.lineTo(-r * 0.7, r * 0.9); g.lineTo(r * 0.7, r * 0.9); g.lineTo(r * 0.9, 6); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#ff8cc6"; g.strokeStyle = "#c2255c"; g.beginPath(); g.arc(0, -4, r, Math.PI, TAU); g.quadraticCurveTo(r, 14, r * 0.5, 12); g.quadraticCurveTo(r * 0.25, 22, 0, 12); g.quadraticCurveTo(-r * 0.25, 22, -r * 0.5, 12); g.quadraticCurveTo(-r, 14, -r, -4); g.fill(); g.stroke(); g.fillStyle = "#fa5252"; g.strokeStyle = "#c92a2a"; g.beginPath(); g.arc(0, -r - 6, 8, 0, TAU); g.fill(); g.stroke(); for (let i = -2; i <= 2; i++) { g.fillStyle = ["#ffd43b", "#74c0fc", "#fff"][(i + 2) % 3]; g.beginPath(); g.arc(i * 16, -r * 0.55 + Math.abs(i) * 5, 3, 0, TAU); g.fill(); } }
  else { g.strokeStyle = "#1864ab"; g.fillStyle = "#4dabf7"; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke(); g.save(); g.rotate(t * 0.6); g.fillStyle = "#1c7ed6"; for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); rr(g, r - 4, -7, 20, 14, 4); g.fill(); g.stroke(); } g.restore(); g.fillStyle = "#e7f5ff"; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.fill(); }
  // the glowing core: the weak point
  const pulse = 0.5 + 0.5 * Math.sin(t * 6), cg = g.createRadialGradient(0, 4, 2, 0, 4, 26);
  cg.addColorStop(0, "#fff9db"); cg.addColorStop(0.5, `rgba(255,212,59,${0.7 + pulse * 0.3})`); cg.addColorStop(1, "rgba(255,146,43,0)");
  g.fillStyle = cg; g.beginPath(); g.arc(0, 4, 26, 0, TAU); g.fill();
  g.fillStyle = "#ffd43b"; g.strokeStyle = "#e8590c"; g.lineWidth = 3; g.beginPath(); g.arc(0, 4, 9 + pulse * 2, 0, TAU); g.fill(); g.stroke();
  eyes(g, 0, -r * 0.42, 15, 7, Math.sin(t) * 0.6, ex); mouth(g, 0, r * 0.52, 20, ex === "hurt" ? "hurt" : ex === "shock" ? "shock" : "angry");
  if (e.hurt > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.5, e.hurt * 5)})`; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }
  g.restore();
  void P;
  // the telegraph of a charging dash
  if (e.dash && e.dash.ph === 0) { g.strokeStyle = `rgba(250,82,82,${0.4 + 0.4 * Math.sin(t * 20)})`; g.lineWidth = 6; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(e.dash.tx, e.y); g.lineTo(e.dash.tx, H); g.stroke(); g.setLineDash([]); }
}

const PCOL: Record<PKind, [string, string]> = { power: ["#ff922b", "#d9480f"], spread: ["#ff6b9d", "#c2255c"], laser: ["#4dabf7", "#1971c2"], homing: ["#cc5de8", "#862e9c"], wave: ["#22b8cf", "#0b7285"], drone: ["#74c0fc", "#1864ab"], shield: ["#63e6be", "#087f5b"], rapid: ["#ffd43b", "#e67700"], bomb: ["#868e96", "#343a40"], life: ["#fa5252", "#c92a2a"], magnet: ["#e64980", "#a61e4d"] };
const PTXT: Partial<Record<PKind, string>> = { power: "P", spread: "S", laser: "L", homing: "H", wave: "W", drone: "D", rapid: "R", magnet: "M" };
const HEART = "M9 15 C2 10 1 6 3 3.5 C5 1.5 8 2 9 4.5 C10 2 13 1.5 15 3.5 C17 6 16 10 9 15 Z";
export function drawPickup(g: G, x: number, y: number, kind: PKind, k = 1) {
  const [f, d] = PCOL[kind], w = 38 * k, hh = 24 * k;
  g.save(); g.translate(x, y); g.fillStyle = f; g.strokeStyle = d; g.lineWidth = 3 * k; rr(g, -w / 2, -hh / 2, w, hh, hh / 2); g.fill(); g.stroke();
  g.fillStyle = "rgba(255,255,255,.4)"; rr(g, -w / 2 + 6 * k, -hh / 2 + 3 * k, w - 12 * k, 4 * k, 2 * k); g.fill();
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineWidth = 2.4 * k; g.lineCap = "round";
  const tx = PTXT[kind];
  if (tx) { g.font = `900 ${14 * k}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(tx, 0, 1.5 * k); }
  else if (kind === "shield") { g.beginPath(); g.arc(0, 1 * k, 6 * k, 0, TAU); g.stroke(); }
  else if (kind === "bomb") { g.beginPath(); g.arc(0, 2 * k, 6 * k, 0, TAU); g.fill(); g.beginPath(); g.moveTo(3 * k, -3 * k); g.lineTo(6 * k, -7 * k); g.stroke(); }
  else { g.save(); g.translate(-7 * k, -6 * k); g.scale(0.78 * k, 0.78 * k); g.fill(new Path2D(HEART)); g.restore(); }
  g.restore();
}
export function weaponIcon(g: G, x: number, y: number, w: WKind, wl: number) {
  const kind: PKind = w === "blaster" ? "power" : w;
  drawPickup(g, x, y, kind, 0.8);
  for (let i = 0; i < 5; i++) { g.fillStyle = i < wl ? "#ffd43b" : "rgba(255,255,255,.25)"; g.beginPath(); g.arc(x - 16 + i * 8, y + 19, 2.6, 0, TAU); g.fill(); }
}
export function drawCoin(g: G, x: number, y: number, t: number) {
  const sx = Math.abs(Math.cos(t * 6 + x)); g.fillStyle = "#ffd43b"; g.strokeStyle = "#e67700"; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, 3 + 4.5 * sx, 7.5, 0, 0, TAU); g.fill(); g.stroke();
}
export function drawEBullet(g: G, b: { x: number; y: number; r: number; mine: boolean }, t: number) {
  if (b.mine) { g.fillStyle = "#495057"; g.strokeStyle = "#212529"; g.lineWidth = 2.5; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = "#fa5252"; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 2; g.beginPath(); g.moveTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); g.lineTo(b.x + Math.cos(a) * (b.r + 4), b.y + Math.sin(a) * (b.r + 4)); g.stroke(); } g.fillStyle = Math.floor(t * 4) % 2 ? "#fa5252" : "#ffd43b"; g.beginPath(); g.arc(b.x, b.y, 2.4, 0, TAU); g.fill(); return; }
  g.fillStyle = "#ff6b9d"; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.arc(b.x - 1.4, b.y - 1.4, 1.3, 0, TAU); g.fill();
}
export function drawPB(g: G, b: { x: number; y: number; vx: number; vy: number; r: number; kind: WKind }) {
  const a = Math.atan2(b.vx, -b.vy);
  g.save(); g.translate(b.x, b.y); g.rotate(a);
  if (b.kind === "wave") { g.fillStyle = "rgba(34,184,207,.55)"; g.strokeStyle = "#0b7285"; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, b.r, b.r * 0.5, 0, 0, TAU); g.fill(); g.stroke(); }
  else if (b.kind === "homing") { g.fillStyle = "#e599f7"; g.strokeStyle = "#862e9c"; g.lineWidth = 2; rr(g, -3, -8, 6, 13, 3); g.fill(); g.stroke(); g.fillStyle = "#ffd43b"; g.beginPath(); g.moveTo(-2, 5); g.lineTo(0, 11 + Math.random() * 3); g.lineTo(2, 5); g.fill(); }
  else { g.fillStyle = b.kind === "spread" ? "#ffa8cc" : "#fff3bf"; g.strokeStyle = b.kind === "spread" ? "#c2255c" : "#f59f00"; g.lineWidth = 2; rr(g, -2.5, -8, 5, 14, 2.5); g.fill(); g.stroke(); }
  g.restore();
}
export function drawBeam(g: G, s: State, t: number) {
  if (!s.beam) return;
  const w = 5 + s.wl, { x, y0, y1 } = s.beam, f = 0.75 + 0.25 * Math.sin(t * 60);
  g.fillStyle = "rgba(77,171,247,.35)"; g.fillRect(x - w * 1.6, y1, w * 3.2, y0 - y1);
  g.fillStyle = `rgba(165,216,255,${f})`; g.fillRect(x - w, y1, w * 2, y0 - y1); g.fillStyle = "#fff"; g.fillRect(x - w * 0.4, y1, w * 0.8, y0 - y1);
  g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y1, w * 1.3, 0, TAU); g.fill();
}
export function drawHazards(g: G, s: State, t: number) {
  for (const h of s.haz) {
    if (h.t < h.warn) { const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 16)); g.strokeStyle = `rgba(250,82,82,${a})`; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(h.x - h.w, 0); g.lineTo(h.x - h.w, H); g.moveTo(h.x + h.w, 0); g.lineTo(h.x + h.w, H); g.stroke(); g.setLineDash([]); g.fillStyle = `rgba(250,82,82,${a * 0.18})`; g.fillRect(h.x - h.w, 0, h.w * 2, H); }
    else if (h.kind === "laser") { g.fillStyle = "rgba(255,107,107,.45)"; g.fillRect(h.x - h.w, 0, h.w * 2, H); g.fillStyle = "#fff"; g.fillRect(h.x - h.w * 0.35, 0, h.w * 0.7, H); }
    else { g.strokeStyle = "#fff3bf"; g.lineWidth = 5; g.lineJoin = "round"; g.beginPath(); let yy = 56; g.moveTo(h.x, yy); while (yy < H) { yy += 34; g.lineTo(h.x + (((yy / 34) | 0) % 2 ? 12 : -12), yy); } g.stroke(); g.strokeStyle = "rgba(255,212,59,.5)"; g.lineWidth = 14; g.stroke(); }
  }
}
export function drawStorm(g: G, s: State, t: number) {
  const st = s.storm; if (!st) return;
  g.fillStyle = "#5c5f7a"; g.strokeStyle = "#343a40"; g.lineWidth = 3;
  for (const [dx, dy, r] of [[-28, 4, 18], [-8, -6, 24], [16, -2, 22], [34, 6, 15]] as const) { g.beginPath(); g.arc(st.x + dx, st.y + dy, r, 0, TAU); g.fill(); }
  g.fillStyle = "#6c7093"; g.beginPath(); g.ellipse(st.x, st.y + 4, 50, 18, 0, 0, TAU); g.fill();
  eyes(g, st.x, st.y, 9, 4.5, 0, "angry"); mouth(g, st.x, st.y + 14, 12, "angry");
  g.strokeStyle = `rgba(255,243,191,${0.5 + 0.5 * Math.sin(t * 30)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(st.x - 36, st.y + 22); g.lineTo(st.x - 30, st.y + 32); g.lineTo(st.x - 38, st.y + 32); g.stroke();
}
export function drawHole(g: G, s: State, t: number) {
  const h = s.hole; if (!h) return;
  const a = Math.min(1, h.t * 2, (h.dur - h.t) * 2);
  g.save(); g.translate(h.x, h.y); g.globalAlpha = a;
  const gg = g.createRadialGradient(0, 0, 4, 0, 0, 60); gg.addColorStop(0, "rgba(0,0,0,1)"); gg.addColorStop(0.55, "rgba(60,20,110,.9)"); gg.addColorStop(1, "rgba(120,60,200,0)");
  g.fillStyle = gg; g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
  g.rotate(t * 2.5); g.strokeStyle = "rgba(204,153,255,.8)"; g.lineWidth = 3; g.lineCap = "round";
  for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.beginPath(); g.arc(0, 0, 26, 0, 1.6); g.stroke(); g.beginPath(); g.arc(0, 0, 42, 0.5, 1.7); g.stroke(); }
  g.restore();
}

export function banner(g: G, text: string, a: number, sub = "") {
  if (a <= 0) return;
  g.save(); g.globalAlpha = Math.min(1, a); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.font = "900 40px system-ui, sans-serif"; g.strokeStyle = "#087f5b"; g.lineWidth = 8; g.strokeText(text, W / 2, 220); g.fillStyle = "#fff"; g.fillText(text, W / 2, 220);
  if (sub) { g.font = "800 18px system-ui, sans-serif"; g.lineWidth = 5; g.strokeText(sub, W / 2, 256); g.fillText(sub, W / 2, 256); }
  g.restore();
}
export const SHIP_HIT = shipR;
