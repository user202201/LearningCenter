import type { GameCtx } from "./ctx";
import "./watersort.css";
import { CAP, LEVELS, levelTubes, colorsOf, pour, pourAmount, isWon, topColor, topRun, cloneTubes, type Tubes } from "./watersort-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d0ebff"/><g stroke="#1971c2" stroke-width="4"><path d="M18 36 h24 v44 a12 12 0 0 1 -24 0z" fill="#fff"/><path d="M48 36 h24 v44 a12 12 0 0 1 -24 0z" fill="#fff"/><path d="M78 36 h24 v44 a12 12 0 0 1 -24 0z" fill="#fff"/></g><path d="M20 62 h20 v18 a10 10 0 0 1 -20 0z" fill="#fa5252"/><path d="M20 50 h20 v12 h-20z" fill="#fcc419"/><path d="M50 56 h20 v24 a10 10 0 0 1 -20 0z" fill="#339af0"/><path d="M80 48 h20 v32 a10 10 0 0 1 -20 0z" fill="#51cf66"/><circle cx="60" cy="70" r="3" fill="#fff"/><circle cx="52" cy="22" r="6" fill="#339af0" stroke="#1971c2" stroke-width="3"/><circle cx="50" cy="20" r="1.8" fill="#fff"/><path d="M34 100 q26 8 52 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>`;

/** ten clear hues; every colour also has its own white mark (a shape) so that children who can not tell the hues apart still can */
export const COLORS = ["#fa5252", "#ff922b", "#fcc419", "#94d82d", "#20a84d", "#22b8cf", "#339af0", "#ae3ec9", "#f06595", "#a9743a"];
const SHAPES = [
  `<circle cx="10" cy="10" r="6.5"/>`,
  `<rect x="4" y="4" width="12" height="12" rx="1.5"/>`,
  `<path d="M10 3 L17.5 16.5 H2.5z"/>`,
  `<path d="M10 2 L12.4 7.6 L18.4 8 L13.8 11.9 L15.3 17.8 L10 14.6 L4.7 17.8 L6.2 11.9 L1.6 8 L7.6 7.6z"/>`,
  `<path d="M10 2 L17.5 10 L10 18 L2.5 10z"/>`,
  `<path d="M10 17 C2 11 2 4 6.5 4 C8.5 4 9.6 5.2 10 6.4 C10.4 5.2 11.5 4 13.5 4 C18 4 18 11 10 17z"/>`,
  `<path d="M7.5 2.5 h5 v5 h5 v5 h-5 v5 h-5 v-5 h-5 v-5 h5z"/>`,
  `<path d="M13.5 3 A7.5 7.5 0 1 0 17 13.5 A6 6 0 0 1 13.5 3z"/>`,
  `<path d="M10 2.5 L16.5 6.2 V13.8 L10 17.5 L3.5 13.8 V6.2z"/>`,
  `<circle cx="10" cy="10" r="5.8" fill="none" stroke-width="3.2"/>`,
];
const mark = (c: number) => `<svg viewBox="0 0 20 20" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="1.6" stroke-linejoin="round">${SHAPES[c % SHAPES.length]}</svg>`;
const FACE = `<svg class="ws-face" viewBox="0 0 36 19" aria-hidden="true"><g fill="#3a2e39"><circle class="eye" cx="11" cy="7" r="2.6"/><circle class="eye" cx="25" cy="7" r="2.6"/></g><path class="smile" d="M13 12.5 Q18 17 23 12.5" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"/><ellipse class="open" cx="18" cy="13.5" rx="3" ry="3.6" fill="#c92a2a"/><g class="happy" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"><path d="M8 8 Q11 4 14 8"/><path d="M22 8 Q25 4 28 8"/><path d="M13 12.5 Q18 18 23 12.5" fill="#c92a2a"/></g></svg>`;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(fn, ms); timers.push(t); };
  const solvedMap = () => ctx.store.get<Record<string, number>>("solved", {});
  let level = Math.max(1, Math.min(LEVELS, Math.floor(ctx.store.get<number>("level", 1)) || 1));

  const levelEl = h("span", { class: "ws-stat", id: "ws-level" }, "");
  const movesEl = h("span", { class: "ws-stat", id: "ws-moves" }, "");
  const bestEl = h("span", { class: "ws-stat best", id: "ws-best" }, "");
  const undoBtn = h("button", { class: "mopt", id: "ws-undo", onclick: () => { ctx.sfx("tap"); undo(); } }, "撤销");
  const restartBtn = h("button", { class: "mopt", id: "ws-restart", onclick: () => { ctx.sfx("tap"); load(level); } }, "重来");
  const extraBtn = h("button", { class: "mopt", id: "ws-extra", onclick: () => { ctx.sfx("place"); addTube(); } }, "加一管");
  const pickBtn = h("button", { class: "mopt", id: "ws-pick", onclick: () => { ctx.sfx("tap"); togglePicker(); } }, "选关");
  const hud = h("div", { class: "ws-hud" }, levelEl, movesEl, bestEl, undoBtn, restartBtn, extraBtn, pickBtn);

  const tubesEl = h("div", { class: "ws-tubes", id: "ws-tubes" });
  const title = h("h2", {}, ""), msg = h("p", {}, "");
  const nextBtn = h("button", { class: "primary", id: "ws-next", onclick: () => { ctx.sfx("tap"); if (level < LEVELS) load(level + 1); else { togglePicker(true); } } }, "下一关");
  const againBtn = h("button", { class: "ws-ghost", id: "ws-again", onclick: () => { ctx.sfx("tap"); load(level); } }, "再玩一次");
  const ovl = h("div", { class: "ws-ovl", id: "ws-ovl", hidden: "" }, title, msg, h("div", { class: "ws-btns" }, nextBtn, againBtn));
  const gridEl = h("div", { class: "ws-grid", id: "ws-grid" });
  const pickCount = h("p", { class: "ws-stat", id: "ws-count" }, "");
  const picker = h("div", { class: "ws-pick", id: "ws-picker", hidden: "" }, h("h2", {}, "选一关"), pickCount, gridEl);
  const field = h("div", { class: "ws-field", id: "ws-field" }, tubesEl, ovl, picker);
  const board = h("div", { class: "ws-board" }, field);
  root.append(h("div", { class: "ws-wrap" }, hud, board));

  let tubes: Tubes = [], start: Tubes = [], history: Tubes[] = [], extraUsed = false, won = false, sel = -1, cur = 0, pickerOpen = false;
  const best = () => solvedMap()[String(level)];

  function refreshHud() {
    levelEl.textContent = `第${level}关`;
    movesEl.textContent = `步数：${history.length}`;
    const b = best();
    bestEl.textContent = b ? `最少：${b}` : "最少：-";
    undoBtn.disabled = history.length === 0 || won || pickerOpen;
    restartBtn.disabled = pickerOpen;
    extraBtn.disabled = extraUsed || won || pickerOpen; extraBtn.classList.toggle("on", extraUsed);
    pickBtn.textContent = pickerOpen ? "继续" : "选关"; pickBtn.classList.toggle("on", pickerOpen);
  }
  function render(newIn = -1, newN = 0) {
    tubesEl.textContent = "";
    tubes.forEach((t, i) => {
      const full = t.length === CAP && t.every((x) => x === t[0]);
      const glass = h("span", { class: "ws-glass" });
      t.forEach((c, k) => {
        const u = h("span", { class: "ws-u" + (i === newIn && k >= t.length - newN ? " new" : ""), "data-c": String(c) });
        u.style.background = COLORS[c % COLORS.length]; u.innerHTML = mark(c);
        glass.append(u);
      });
      const el = h("button", { class: "ws-tube" + (i === sel ? " sel" : "") + (i === cur ? " cur" : "") + (full ? " done" : ""), "data-i": String(i), "data-n": String(t.length), "aria-label": `${i + 1}`, onclick: () => choose(i) });
      el.insertAdjacentHTML("afterbegin", FACE); el.append(glass);
      tubesEl.append(el);
    });
    refreshHud();
    layout();
  }
  const tubeEl = (i: number) => tubesEl.children[i] as HTMLElement | undefined;
  function layout() {
    const W = field.clientWidth - 28, H = field.clientHeight - 28, T = tubes.length;
    if (W < 40 || H < 40 || !T) return;
    let bestW = 0, bestCols = T;
    for (let r = 1; r <= 3; r++) {
      const cols = Math.ceil(T / r);
      const w1 = (W - (cols - 1) * 10) / cols;
      const w2 = (H - (r - 1) * 20 - 8 * r) / (r * 3.7);
      const w = Math.min(88, w1, w2);
      if (w > bestW) { bestW = w; bestCols = cols; }
    }
    const w = Math.max(18, Math.floor(bestW));
    tubesEl.style.setProperty("--w", `${w}px`);
    tubesEl.style.width = `${bestCols * w + (bestCols - 1) * 10 + 2}px`;
  }

  function load(n: number) {
    level = Math.max(1, Math.min(LEVELS, n)); ctx.store.set("level", level);
    start = levelTubes(level); tubes = cloneTubes(start); history = []; extraUsed = false; won = false; sel = -1; cur = 0;
    ovl.hidden = true; pickerOpen = false; picker.hidden = true;
    render();
  }
  function addTube() { if (extraUsed || won) return; tubes.push([]); extraUsed = true; render(); }
  function undo() {
    if (!history.length || won) return;
    tubes = history.pop()!; sel = -1; render();
  }
  function choose(i: number) {
    if (won || pickerOpen || i < 0 || i >= tubes.length) return;
    cur = i;
    if (sel < 0) {
      if (!tubes[i].length) { ctx.sfx("bad"); render(); return; }
      sel = i; ctx.sfx("tap"); render(); return;
    }
    if (sel === i) { sel = -1; ctx.sfx("tap"); render(); return; }
    const a = sel;
    if (!pourAmount(tubes, a, i)) {
      ctx.sfx("bad");
      sel = tubes[i].length ? i : -1; render();
      const e = tubeEl(i); if (e && !reduced()) { e.classList.add("bad"); later(() => e.classList.remove("bad"), 320); }
      return;
    }
    const color = topColor(tubes[a]);
    history.push(cloneTubes(tubes));
    const k = pour(tubes, a, i);
    sel = -1; ctx.sfx("drop");
    render(i, k);
    if (!reduced()) animate(a, i, color, k);
    if (isWon(tubes)) finish();
  }
  function animate(a: number, b: number, color: number, k: number) {
    const ea = tubeEl(a), eb = tubeEl(b); if (!ea || !eb) return;
    const fr = field.getBoundingClientRect(), ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    const dir = rb.left >= ra.left ? 1 : -1;
    const dx = rb.left - ra.left - dir * ra.width * 0.55;
    ea.style.setProperty("--dx", `${dx}px`); ea.style.setProperty("--rot", `${dir * 38}deg`);
    ea.classList.add("pouring"); later(() => ea.classList.remove("pouring"), 520);
    const unit = rb.width * 0.6, top = rb.bottom - 3 - Math.min(CAP, tubes[b].length) * unit;
    const s = h("div", { class: "ws-stream" });
    s.style.background = COLORS[color % COLORS.length];
    const x = rb.left + rb.width / 2 - fr.left - 3.5, y0 = rb.top - fr.top - rb.width * 0.2, y1 = top - fr.top + k * 0 + 2;
    s.style.left = `${x}px`; s.style.top = `${y0}px`; s.style.height = `${Math.max(8, y1 - y0)}px`;
    field.append(s); later(() => s.remove(), 520);
  }
  function finish() {
    won = true; sel = -1;
    const m = history.length, map = { ...solvedMap() }, old = map[String(level)];
    const newBest = !old || m < old;
    if (newBest) { map[String(level)] = m; ctx.store.set("solved", map); }
    ctx.sfx("win"); refreshHud(); render();
    const last = level >= LEVELS;
    title.textContent = last ? "全部通关！" : "过关啦！";
    msg.textContent = newBest && old ? `新纪录：${m}步` : `用了${m}步`;
    nextBtn.textContent = last ? "选关" : "下一关";
    ovl.hidden = false;
  }

  function buildPicker() {
    gridEl.textContent = "";
    const map = solvedMap();
    let n = 0;
    for (let i = 1; i <= LEVELS; i++) {
      const done = map[String(i)] !== undefined; if (done) n++;
      const b = h("button", { class: "ws-lv" + (done ? " solved" : "") + (i === level ? " now" : ""), "data-level": String(i), "aria-label": `${i}`, onclick: () => { ctx.sfx("tap"); load(i); } }, String(i));
      if (done) b.append(h("span", { class: "ws-tick" }, "★"));
      gridEl.append(b);
    }
    pickCount.textContent = `已通关：${n} / ${LEVELS}`;
  }
  function togglePicker(force?: boolean) {
    pickerOpen = force === undefined ? !pickerOpen : force;
    if (pickerOpen) { buildPicker(); ovl.hidden = true; } else if (won) ovl.hidden = false;
    picker.hidden = !pickerOpen; refreshHud();
  }

  // ---- keyboard: digits choose a tube, arrows move the yellow frame, Enter / Space chooses it ----
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (pickerOpen) { if (k === "Escape") { e.preventDefault(); togglePicker(false); } return; }
    if (/^[0-9]$/.test(k)) { e.preventDefault(); choose(k === "0" ? 9 : Number(k) - 1); return; }
    if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); cur = (cur + 1) % tubes.length; render(); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); cur = (cur - 1 + tubes.length) % tubes.length; render(); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); if (won) { if (level < LEVELS) load(level + 1); else togglePicker(true); } else choose(cur); }
    else if (k === "u" || k === "U" || k === "z" || k === "Z" || k === "Backspace") { e.preventDefault(); undo(); }
    else if (k === "r" || k === "R") { e.preventDefault(); load(level); }
    else if (k === "Escape") { if (sel >= 0) { sel = -1; render(); } }
  };
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(field);

  load(level);
  (window as unknown as Record<string, unknown>).__watersort = {
    tubes: () => tubes.map((t) => t.slice()), level: () => level, moves: () => history.length, won: () => won, extra: () => extraUsed,
    selected: () => sel, w: () => parseFloat(tubesEl.style.getPropertyValue("--w")), top: (i: number) => [topColor(tubes[i]), topRun(tubes[i])], colors: () => colorsOf(level),
  };
  return () => {
    timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__watersort;
  };
}
