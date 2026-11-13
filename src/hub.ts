/**
 * The subject picker (the screen between signing in and a subject): big cartoon cards, a burst of sparkles when one is tapped
 * and a coloured curtain that grows from the card and fades away on the next screen.
 * The artwork is drawn here as inline SVG (no image files, nothing from outside); the only texts in it are digits and Latin letters.
 * "识字" leads to the original Learning Chinese app (`#/chinese`); the other subjects have a "coming soon" page for now.
 */
import { h, oneLine } from "./ui";
import { mascot } from "./art";
import { getLang } from "./i18n";

export interface Subject {
  id: "chinese" | "math" | "english" | "science" | "music" | "games";
  /** the name on the card (Chinese source text, translated by i18n) */
  name: string;
  /** where the card leads */
  route: string;
  /** card colours: light top, strong bottom, dark "thickness" under the card */
  c1: string; c2: string; dark: string;
  /** false = the subject page says "coming soon" */
  ready: boolean;
  /** false = no child needed (music): not in the shortcuts of a child's page */
  kid?: boolean;
}

export const SUBJECTS: Subject[] = [
  { id: "chinese", name: "识字", route: "#/chinese", c1: "#ffa94d", c2: "#f76707", dark: "#c64f00", ready: true },
  { id: "math", name: "数学", route: "#/subject/math", c1: "#4dabf7", c2: "#1c7ed6", dark: "#1864ab", ready: true },
  { id: "english", /** the Languages subject teaches the OTHER language of the screen: English screen -> French (words.ts studyLang) */ get name() { return getLang() === "en" ? "法语" : "英语"; }, route: "#/subject/english", c1: "#69db7c", c2: "#2f9e44", dark: "#237a35", ready: true },
  { id: "science", name: "科学", route: "#/subject/science", c1: "#b197fc", c2: "#7048e8", dark: "#5430b8", ready: true },
  { id: "music", name: "音乐", route: "#/subject/music", c1: "#f783ac", c2: "#d6336c", dark: "#a61e4d", ready: true, kid: false },
  { id: "games", name: "小游戏", route: "#/subject/games", c1: "#63e6be", c2: "#12b886", dark: "#087f5b", ready: true, kid: false },
];
export const subjectById = (id: string) => SUBJECTS.find((s) => s.id === id);

// ---------- artwork ----------
const eye = (x: number, y: number, r = 4.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2d2230"/><circle cx="${x + 1.4}" cy="${y - 1.4}" r="${r * 0.36}" fill="#fff"/>`;
const cheeks = (y: number, dx: number) => `<circle cx="${60 - dx}" cy="${y}" r="5" fill="#ff8fa3" opacity=".6"/><circle cx="${60 + dx}" cy="${y}" r="5" fill="#ff8fa3" opacity=".6"/>`;
const smile = (y: number, w = 8) => `<path d="M${60 - w} ${y}q${w} ${w + 2} ${2 * w} 0" fill="none" stroke="#2d2230" stroke-width="3" stroke-linecap="round"/>`;
const star = (x: number, y: number, r: number, fill: string) => `<path transform="translate(${x} ${y}) scale(${r})" d="M0-1 .28-.28 1 0 .28.28 0 1-.28.28-1 0-.28-.28z" fill="${fill}"/>`;
const shadow = `<ellipse cx="60" cy="111" rx="36" ry="6" fill="#000" opacity=".16"/>`;
const FONT = `font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif" font-weight="900" text-anchor="middle"`;

const ART: Record<Subject["id"], string> = {
  // a smiling book, a 田字格 tile with a character being written, a pencil
  chinese: `${shadow}
    <rect x="34" y="20" width="64" height="86" rx="12" fill="#fff4d6"/>
    <rect x="28" y="14" width="64" height="86" rx="12" fill="#4c6ef5"/>
    <rect x="28" y="14" width="11" height="86" rx="5.500" fill="#3b5bdb"/>
    <path d="M74 14v26l7-5.500 7 5.500V14z" fill="#ff6b6b"/>
    ${eye(50, 62)}${eye(70, 62)}${cheeks(73, 20)}${smile(72, 8)}
    <g transform="rotate(-12 28 30)"><rect x="6" y="8" width="40" height="40" rx="7" fill="#fff" stroke="#e03131" stroke-width="3"/>
      <path d="M26 10v36M8 28h36" stroke="#f7a8a0" stroke-width="2" stroke-dasharray="4 3"/>
      <path d="M15 19q11 4 22 0M26 19v22" fill="none" stroke="#2d2230" stroke-width="4.500" stroke-linecap="round"/></g>
    <g transform="translate(-8 2) rotate(32 102 74)"><rect x="96" y="40" width="13" height="50" rx="3.500" fill="#ffd43b"/><rect x="96" y="40" width="13" height="9" rx="3.500" fill="#ff8787"/>
      <path d="M96 90h13l-6.500 14z" fill="#ffe8cc"/><path d="M99.500 99h6l-3 6z" fill="#2d2230"/></g>
    ${star(14, 78, 7, "#fff3bf")}${star(104, 20, 6, "#fff3bf")}`,
  // a smiling number block among + − × ÷ bubbles
  math: `${shadow}
    <rect x="26" y="28" width="68" height="70" rx="17" fill="#ffd43b"/>
    <rect x="26" y="28" width="68" height="70" rx="17" fill="none" stroke="#f59f00" stroke-width="4"/>
    <path d="M32 40q0-6 8-6h18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    ${eye(46, 58)}${eye(74, 58)}${cheeks(70, 26)}${smile(72, 9)}
    <text x="60" y="94" font-size="13" ${FONT} fill="#f08c00">1 2 3</text>
    <circle cx="20" cy="26" r="15" fill="#fff" stroke="#1c7ed6" stroke-width="3.500"/><text x="20" y="35" font-size="26" ${FONT} fill="#1c7ed6">+</text>
    <circle cx="100" cy="30" r="14" fill="#fff" stroke="#e03131" stroke-width="3.500"/><text x="100" y="39" font-size="24" ${FONT} fill="#e03131">×</text>
    <circle cx="100" cy="94" r="14" fill="#fff" stroke="#2f9e44" stroke-width="3.500"/><text x="100" y="103" font-size="24" ${FONT} fill="#2f9e44">=</text>
    <circle cx="18" cy="92" r="12" fill="#fff" stroke="#f76707" stroke-width="3.500"/><text x="18" y="100" font-size="21" ${FONT} fill="#f76707">÷</text>`,
  // a speech bubble that says ABC and smiles
  english: `${shadow}
    <path d="M24 14h72q12 0 12 12v50q0 12-12 12H66L44 106V88H24q-12 0-12-12V26q0-12 12-12z" fill="#fff"/>
    <path d="M24 14h72q12 0 12 12v50q0 12-12 12H66L44 106V88H24q-12 0-12-12V26q0-12 12-12z" fill="none" stroke="#2b8a3e" stroke-width="3.500" stroke-linejoin="round"/>
    <text x="60" y="54" font-size="36" ${FONT}><tspan fill="#ff6b6b">A</tspan><tspan fill="#fab005">B</tspan><tspan fill="#339af0">C</tspan></text>
    ${eye(48, 68, 3.800)}${eye(72, 68, 3.800)}${cheeks(76, 29)}${smile(74, 7)}
    ${star(16, 102, 8, "#fff3bf")}${star(106, 106, 6, "#fff3bf")}`,
  // a cheerful piano with notes dancing above it
  music: `${shadow}
    <rect x="12" y="52" width="96" height="52" rx="10" fill="#fff"/>
    <rect x="12" y="52" width="96" height="52" rx="10" fill="none" stroke="#a61e4d" stroke-width="3.500"/>
    ${[36, 60, 84].map((x) => `<path d="M${x} 76V104" stroke="#ced4da" stroke-width="2"/>`).join("")}
    ${[30, 54, 78, 98].map((x) => `<rect x="${x - 5}" y="52" width="10" height="30" rx="2" fill="#2d2230"/>`).join("")}
    ${eye(46, 92, 3.800)}${eye(74, 92, 3.800)}${smile(98, 7)}
    <ellipse cx="38" cy="30" rx="8" ry="6" transform="rotate(-20 38 30)" fill="#ffe066"/><path d="M45 28V8" stroke="#fff" stroke-width="3.500" stroke-linecap="round"/>
    <ellipse cx="78" cy="22" rx="8" ry="6" transform="rotate(-20 78 22)" fill="#fff"/><path d="M85 20V2" stroke="#fff" stroke-width="3.500" stroke-linecap="round"/><path d="M45 8L85 2" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${star(100, 40, 8, "#ffe066")}${star(16, 36, 7, "#fff3bf")}`,
  // a smiling game controller with a joystick, buttons and sparkles
  games: `${shadow}
    <path d="M30 40h60q20 0 26 28l5 22q4 18-10 18q-9 0-16-12l-6-10H31l-6 10q-7 12-16 12q-14 0-10-18l5-22q6-28 26-28z" fill="#fff"/>
    <path d="M30 40h60q20 0 26 28l5 22q4 18-10 18q-9 0-16-12l-6-10H31l-6 10q-7 12-16 12q-14 0-10-18l5-22q6-28 26-28z" fill="none" stroke="#087f5b" stroke-width="3.500" stroke-linejoin="round"/>
    <path d="M34 62h14M41 55v14" stroke="#12b886" stroke-width="6" stroke-linecap="round"/>
    <circle cx="82" cy="58" r="5.500" fill="#ff6b6b"/><circle cx="94" cy="68" r="5.500" fill="#fab005"/><circle cx="70" cy="68" r="5.500" fill="#339af0"/>
    ${eye(54, 80, 3.500)}${eye(66, 80, 3.500)}${smile(86, 6)}
    ${star(18, 24, 8, "#fff3bf")}${star(104, 22, 9, "#fff3bf")}${star(60, 14, 6, "#fff3bf")}`,
  // a bubbling flask with a smiling potion
  science: `${shadow}
    <path d="M49 12h22v6h-2.500v30l25 46q6 13-7 15H33.500q-13-2-7-15l25-46V18H49z" fill="#e7f5ff"/>
    <path d="M41.200 66q9.500-6 19 0t18.600 0L94 94q6 13-7 15H33.500q-13-2-7-15z" fill="#38d9a9"/>
    <path d="M49 12h22v6h-2.500v30l25 46q6 13-7 15H33.500q-13-2-7-15l25-46V18H49z" fill="none" stroke="#5f3dc4" stroke-width="3.500" stroke-linejoin="round"/>
    <path d="M44 14h32" stroke="#5f3dc4" stroke-width="5" stroke-linecap="round"/>
    ${eye(50, 87, 4)}${eye(70, 87, 4)}${cheeks(95, 22)}${smile(94, 6)}
    <circle cx="57" cy="52" r="4.500" fill="#fff" stroke="#5f3dc4" stroke-width="2"/><circle cx="66" cy="40" r="3.500" fill="#fff" stroke="#5f3dc4" stroke-width="2"/><circle cx="58" cy="28" r="2.800" fill="#fff" stroke="#5f3dc4" stroke-width="2"/>
    ${star(100, 30, 9, "#ffe066")}${star(14, 40, 7, "#ffe066")}${star(104, 58, 5, "#fff3bf")}`,
};

/** the picture of a subject (a fresh SVG element each time) */
export function subjectArt(id: Subject["id"]): SVGSVGElement {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 120 120");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  s.dataset.art = id;
  s.innerHTML = ART[id];
  return s;
}

/** where a child's own page is in each subject */
export const kidRoute = (subject: Subject["id"], kidId: string): string => (subject === "chinese" ? `#/kid/${kidId}` : `#/${subject}/${kidId}`);

/**
 * Three round shortcuts for the top bar of a child's page: the OTHER subjects, each leading to the same child's page there
 * (the grade is asked there the first time, as always). Right-aligned.
 */
export function shortcuts(kidId: string, current: Subject["id"]): HTMLElement {
  return h("nav", { class: "shortcuts", "aria-label": "学科" }, ...SUBJECTS.filter((s) => s.id !== current && s.kid !== false).map((s) =>
    h("a", { class: "shortcut", id: `go-${s.id}`, href: kidRoute(s.id, kidId), title: s.name, "aria-label": s.name, style: `--c1:${s.c1};--c2:${s.c2};--cd:${s.dark}` },
      h("span", { class: "sc-ico" }, subjectArt(s.id)), h("span", { class: "sc-name" }, s.name))));
}

// ---------- the screen ----------
const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const style = (s: Subject) => `--c1:${s.c1};--c2:${s.c2};--cd:${s.dark}`;

/** the grid of big cards; `go(route)` is called when one is chosen (after the effects) */
export function hubGrid(go: (route: string) => void): HTMLElement {
  let busy = false;
  const grid = h("div", { class: "hub-grid" });
  SUBJECTS.forEach((s, i) => {
    const card = h("button", { class: "subject", "data-subject": s.id, style: `${style(s)};--i:${i}`, onclick: (e: MouseEvent) => {
      if (busy) return;
      busy = true;
      choose(card, s, e, go);
      setTimeout(() => (busy = false), 2000);
    } },
      h("span", { class: "s-art" }, subjectArt(s.id)),
      h("span", { class: "s-name" }, s.name),
      s.ready ? null : h("span", { class: "s-soon" }, "即将开放"));
    grid.append(card);
  });
  oneLine([...grid.querySelectorAll<HTMLElement>(".s-name")], 12);
  return grid;
}

const SPARK_COLORS = ["#fff", "#ffe066", "#ff8787", "#74c0fc", "#8ce99a", "#e599f7"];

/** the tap effect (squash + sparkles + ring), then the curtain, then the route */
function choose(card: HTMLElement, s: Subject, e: MouseEvent, go: (route: string) => void) {
  if (reduced()) return go(s.route);
  const r = card.getBoundingClientRect();
  // a keyboard "click" has no position: use the middle of the card
  const x = e.detail === 0 || (!e.clientX && !e.clientY) ? r.left + r.width / 2 : e.clientX;
  const y = e.detail === 0 || (!e.clientX && !e.clientY) ? r.top + r.height / 2 : e.clientY;
  card.classList.add("boom");
  const layer = h("div", { class: "fx-layer", "aria-hidden": "true" });
  layer.append(h("span", { class: "fx-ring", style: `left:${x}px;top:${y}px;--c:${s.c1}` }));
  for (let i = 0; i < 18; i++) {
    const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const d = 70 + Math.random() * 110;
    layer.append(h("span", {
      class: "fx-spark " + (i % 3 === 0 ? "star" : i % 3 === 1 ? "dot" : "bit"),
      style: `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--rot:${Math.round(Math.random() * 360)}deg;--s:${8 + Math.random() * 12}px;--col:${SPARK_COLORS[i % SPARK_COLORS.length]}`,
    }));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1000);
  // the curtain: the card's colour grows from the tap over the whole screen, with the subject's picture in the middle
  setTimeout(() => {
    const curtain = h("div", { id: "curtain", class: "curtain", style: `--cx:${x}px;--cy:${y}px;--c:${s.c2}`, "aria-hidden": "true" }, h("span", { class: "c-art" }, subjectArt(s.id)));
    document.body.append(curtain);
    curtain.addEventListener("animationend", (ev) => { if ((ev as AnimationEvent).animationName === "curtain-grow") go(s.route); });
    setTimeout(() => document.getElementById("curtain") === curtain && !curtain.classList.contains("out") && go(s.route), 900);   // (safety: if the animation event never comes)
  }, 280);
}

/** called whenever a new screen is shown: lifts the curtain (if there is one) and lets the screen grow in */
export function reveal(view: HTMLElement) {
  const c = document.getElementById("curtain");
  if (!c || c.classList.contains("out")) return;
  c.classList.add("out");
  view.classList.add("enter-zoom");
  c.addEventListener("animationend", () => c.remove(), { once: true });
  setTimeout(() => c.remove(), 1200);
}

/** the "coming soon" page of a subject that is not built yet */
export function soonPage(s: Subject, back: HTMLElement, gear: HTMLElement): HTMLElement {
  return h("div", { class: "page subject-page", style: `${style(s)};--kid:${s.c2}` },
    h("header", { class: "top hero home-hero" }, back, h("div", { class: "hero-text" }, h("h1", {}, s.name)), gear),
    h("main", { class: "scroll" }, h("div", { class: "narrow soon" },
      h("div", { class: "soon-art" }, subjectArt(s.id)),
      h("h2", {}, "正在建设中"),
      h("p", { class: "muted" }, "很快就和你见面啦，先去试试别的学科吧！"))));
}

export const hubHero = (gear: HTMLElement, gradeChip?: HTMLElement) =>
  h("header", { class: "top hero home-hero hub-hero" },
    h("span", { class: "mascot" }, mascot()),
    h("div", { class: "hero-text" }, h("h1", {}, "学习乐园"), h("p", {}, "今天想学什么？"), gradeChip ?? null),
    gear);
