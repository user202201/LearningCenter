/**
 * 编程: the scenes the programs run in, drawn in code (SVG, nothing from outside). A scene only SHOWS a `State`; the logic never waits for it
 * (the animation is a CSS transition on the robot, which is switched off by "reduce motion"; tests call `render` with the final state at once).
 *  - gridScene: the robot on a map (cells, walls, flag, stars, lamps, coloured tiles, variables)
 *  - turtleScene: the pen on a squared sheet (the drawing, the target as a faint dashed picture)
 */
import { State, GridWorld } from "./coding-interp";
import { Seg } from "./coding-interp";
import { pathsByColor, colorHex } from "./coding-turtle";

const NS = "http://www.w3.org/2000/svg";
const U = 40;
export type Mood = "ok" | "happy" | "crash";
export interface Scene { el: HTMLElement; kind: "grid" | "turtle"; render(s: State, mood?: Mood): void; setTarget?(show: boolean): void }

const svg = (tag: string, a: Record<string, string | number> = {}, html = ""): SVGElement => {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (html) e.innerHTML = html;
  return e as SVGElement;
};
const div = (cls: string, ...kids: (Node | string)[]) => { const d = document.createElement("div"); d.className = cls; d.append(...kids); return d; };

const STAR = "M0-13l3.800 8 8.700 1.200-6.300 6.100 1.500 8.700L0 6.800l-7.700 4.200 1.500-8.700-6.300-6.100 8.700-1.200z";
const FLAG = `<rect x="-2" y="-16" width="4" height="30" rx="2" fill="#6c4a2d"/><path d="M2-16l16 6-16 7z" fill="#e03131"/><ellipse cx="0" cy="14" rx="9" ry="3" fill="#000" opacity=".15"/>`;
const BULB = (lit: boolean) => `<ellipse cx="0" cy="13" rx="9" ry="3" fill="#000" opacity=".15"/><rect x="-5" y="6" width="10" height="7" rx="2" fill="#868e96"/><circle cx="0" cy="-2" r="10" fill="${lit ? "#ffe066" : "#dee2e6"}" stroke="${lit ? "#f59f00" : "#adb5bd"}" stroke-width="2"/>${lit ? '<path d="M-16-2h-4M16-2h4M0-18v-4M-11-13l-3-3M11-13l3-3" stroke="#f59f00" stroke-width="2.500" stroke-linecap="round"/>' : ""}`;
const TILE: Record<string, string> = { r: "#ffa8a8", g: "#8ce99a", b: "#a5d8ff", y: "#ffec99" };

/** the robot (drawn looking up; the eyes and the antenna are at the front) */
const robotSvg = (mood: Mood) => {
  const eyes = mood === "crash"
    ? '<path d="M-8-5l5 5M-3-5l-5 5M3-5l5 5M8-5l-5 5" stroke="#2d2230" stroke-width="2" stroke-linecap="round"/>'
    : mood === "happy" ? '<path d="M-8 -2q3-5 6 0M2 -2q3-5 6 0" fill="none" stroke="#2d2230" stroke-width="2.200" stroke-linecap="round"/>'
    : '<circle cx="-5.500" cy="-3" r="2.600" fill="#2d2230"/><circle cx="5.500" cy="-3" r="2.600" fill="#2d2230"/><circle cx="-4.800" cy="-3.800" r=".9" fill="#fff"/><circle cx="6.200" cy="-3.800" r=".9" fill="#fff"/>';
  const mouth = mood === "crash" ? '<path d="M-5 6q2.500-3 5 0t5 0" fill="none" stroke="#2d2230" stroke-width="1.800" stroke-linecap="round"/>'
    : mood === "happy" ? '<path d="M-6 3q6 9 12 0z" fill="#2d2230"/>' : '<path d="M-5 4q5 5 10 0" fill="none" stroke="#2d2230" stroke-width="2" stroke-linecap="round"/>';
  return `<ellipse cx="0" cy="15" rx="13" ry="4" fill="#000" opacity=".18"/>
    <path d="M0-13v-4" stroke="#495057" stroke-width="2.500" stroke-linecap="round"/><circle cx="0" cy="-18" r="3" fill="${mood === "crash" ? "#ffa94d" : "#845ef7"}"/>
    <rect x="-15" y="-13" width="30" height="27" rx="9" fill="#4dabf7" stroke="#1971c2" stroke-width="2.200"/>
    <rect x="-11.500" y="-9.500" width="23" height="17" rx="6" fill="#fff"/>
    ${eyes}${mouth}
    <rect x="-18" y="-2" width="4" height="9" rx="2" fill="#1971c2"/><rect x="14" y="-2" width="4" height="9" rx="2" fill="#1971c2"/>`;
};

function varsBar(): { el: HTMLElement; set(v: Record<string, number>): void } {
  const el = div("cs-vars");
  return { el, set(v) {
    const names = Object.keys(v).sort();
    el.hidden = names.length === 0;
    el.replaceChildren(...names.map((n) => { const c = div("cs-var"); c.append(Object.assign(document.createElement("b"), { textContent: n }), ` = ${v[n]}`); c.dataset.name = n; return c; }));
  } };
}

export function gridScene(world: GridWorld, init: State): Scene {
  const W = world.w * U, H = world.h * U;
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "cs-svg", role: "img", "aria-label": "地图", preserveAspectRatio: "xMidYMid meet" });
  const stars = new Map<string, SVGElement>(), lamps = new Map<string, SVGElement>();
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const c = world.cells[y][x];
    if (c === "#") { root.append(svg("rect", { x: x * U + 1, y: y * U + 1, width: U - 2, height: U - 2, rx: 7, fill: "#868e96" }), svg("rect", { x: x * U + 4, y: y * U + 4, width: U - 8, height: 8, rx: 4, fill: "#adb5bd" })); continue; }
    root.append(svg("rect", { x: x * U + 1, y: y * U + 1, width: U - 2, height: U - 2, rx: 7, fill: TILE[c] ?? "#fff4d6", stroke: "#f1d9a0", "stroke-width": 1.500 }));
    if (c === "F") root.append(svg("g", { transform: `translate(${x * U + 20} ${y * U + 22})`, class: "cs-flag" }, FLAG));
  }
  for (const k of Object.keys(init.stars)) { const [x, y] = k.split(",").map(Number); const s = svg("path", { d: STAR, transform: `translate(${x * U + 20} ${y * U + 21})`, fill: "#ffd43b", stroke: "#f59f00", "stroke-width": 2, "stroke-linejoin": "round", class: "cs-star", "data-at": k }); stars.set(k, s); root.append(s); }
  for (const k of Object.keys(init.lamps)) { const [x, y] = k.split(",").map(Number); const g = svg("g", { transform: `translate(${x * U + 20} ${y * U + 22})`, class: "cs-lamp", "data-at": k }, BULB(false)); lamps.set(k, g); root.append(g); }
  // the robot walks (translate); its face stays upright and a little arrow in front of it turns (rotate): a face on its side is hard to read
  const robot = svg("g", { class: "cs-robot", id: "cs-robot" });
  const dir = svg("g", { class: "cs-dir" }, '<path d="M-6-17L0-27L6-17z" fill="#ff6b6b" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>');
  const face = svg("g", { class: "cs-face" }, robotSvg("ok"));
  robot.append(dir, face);
  root.append(robot);
  const vars = varsBar();
  const wrap = div("cs-wrap cs-grid");
  wrap.style.setProperty("--ar", String(world.w / world.h));
  wrap.append(root as unknown as Node, vars.el);
  let moodNow: Mood | "" = "";
  let first = true;
  const lit = new Set<string>();
  return {
    el: wrap, kind: "grid",
    render(s, mood = "ok") {
      if (first) { wrap.classList.add("cs-instant"); }
      (robot as unknown as HTMLElement).style.transform = `translate(${s.x * U + 20}px, ${s.y * U + 21}px)`;
      (dir as unknown as HTMLElement).style.transform = `rotate(${s.rot}deg)`;
      robot.setAttribute("data-x", String(s.x)); robot.setAttribute("data-y", String(s.y)); robot.setAttribute("data-rot", String(s.rot));
      for (const [k, el] of stars) el.style.display = s.stars[k] ? "" : "none";
      for (const [k, el] of lamps) { const on = s.lamps[k] === 1; if (on !== lit.has(k)) { on ? lit.add(k) : lit.delete(k); el.innerHTML = BULB(on); } }
      if (mood !== moodNow) { moodNow = mood; face.innerHTML = robotSvg(mood); wrap.dataset.mood = mood; }
      vars.set(s.vars);
      wrap.dataset.got = String(s.got); wrap.dataset.lit = String(s.lit);
      if (first) { first = false; requestAnimationFrame(() => wrap.classList.remove("cs-instant")); }
    },
  };
}

export function turtleScene(init: State, target?: Seg[]): Scene {
  const root = svg("svg", { viewBox: "-100 -100 200 200", class: "cs-svg", role: "img", "aria-label": "画布", preserveAspectRatio: "xMidYMid meet" });
  root.append(svg("rect", { x: -100, y: -100, width: 200, height: 200, rx: 8, fill: "#fffdf5" }));
  let grid = "";
  for (let v = -80; v <= 80; v += 20) grid += `M${v} -100V100M-100 ${v}H100`;
  root.append(svg("path", { d: grid, stroke: "#e9ecef", "stroke-width": 1, fill: "none" }), svg("path", { d: "M0 -100V100M-100 0H100", stroke: "#ced4da", "stroke-width": 1, fill: "none" }));
  const tgt = svg("g", { class: "cs-target" });
  if (target) for (const p of pathsByColor(target)) tgt.append(svg("path", { d: p.d, stroke: "#868e96", "stroke-width": 3.500, fill: "none", "stroke-linecap": "round", "stroke-dasharray": "2 5", opacity: ".75" }));
  const drawn = svg("g", { class: "cs-drawn" });
  const pen = svg("g", { class: "cs-turtle", id: "cs-robot" });
  const face = svg("g", { class: "cs-face" }, `<path d="M0-9L8 8H-8z" fill="#51cf66" stroke="#2b8a3e" stroke-width="1.800" stroke-linejoin="round"/><circle cx="-2.500" cy="1" r="1.200" fill="#2d2230"/><circle cx="2.500" cy="1" r="1.200" fill="#2d2230"/>`);
  pen.append(face);
  root.append(tgt, drawn, pen);
  const vars = varsBar();
  const wrap = div("cs-wrap cs-turtle-wrap");
  wrap.append(root as unknown as Node, vars.el);
  let first = true;
  return {
    el: wrap, kind: "turtle",
    setTarget(show) { (tgt as unknown as HTMLElement).style.display = show ? "" : "none"; },
    render(s, mood = "ok") {
      if (first) { wrap.classList.add("cs-instant"); }
      drawn.replaceChildren(...pathsByColor(s.segs).map((p) => svg("path", { d: p.d, stroke: colorHex(p.color), "stroke-width": 2.500, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" })));
      (pen as unknown as HTMLElement).style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)`;
      pen.setAttribute("data-x", s.x.toFixed(2)); pen.setAttribute("data-y", s.y.toFixed(2)); pen.setAttribute("data-rot", String(s.rot));
      pen.style.opacity = s.pen ? "1" : ".45";
      wrap.dataset.mood = mood;
      wrap.dataset.segs = String(s.segs.length);
      vars.set(s.vars);
      if (first) { first = false; requestAnimationFrame(() => wrap.classList.remove("cs-instant")); }
    },
  };
}
export const sceneSize = U;
