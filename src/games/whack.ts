import type { GameCtx } from "./ctx";
import "./whack.css";
import { LEVELS, DURATION, newGame, step, tap, spawnAt, remaining, keyHole, holeLabel, mult, accuracy, stars, type State, type Kind, type TapEv } from "./whack-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><ellipse cx="60" cy="92" rx="38" ry="14" fill="#a0693c" stroke="#6f4018" stroke-width="3.5"/><ellipse cx="60" cy="86" rx="26" ry="9" fill="#4a2c12"/><circle cx="60" cy="62" r="22" fill="#b9794a" stroke="#6f4018" stroke-width="3.5"/><circle cx="41" cy="46" r="6" fill="#b9794a" stroke="#6f4018" stroke-width="3"/><circle cx="79" cy="46" r="6" fill="#b9794a" stroke="#6f4018" stroke-width="3"/><ellipse cx="60" cy="71" rx="11" ry="8" fill="#f3d9b1"/><ellipse cx="60" cy="66" rx="4.5" ry="3" fill="#f06595"/><circle cx="51" cy="58" r="3" fill="#3a2e39"/><circle cx="69" cy="58" r="3" fill="#3a2e39"/><rect x="55.5" y="72" width="4.5" height="6" rx="1" fill="#fff" stroke="#6f4018" stroke-width="1.2"/><rect x="60" y="72" width="4.5" height="6" rx="1" fill="#fff" stroke="#6f4018" stroke-width="1.2"/><path d="M34 98 Q60 112 86 98 Q60 104 34 98Z" fill="#b9803f" stroke="#6f4018" stroke-width="3" stroke-linejoin="round"/><rect x="82" y="16" width="8" height="34" rx="3" transform="rotate(28 86 33)" fill="#e8a24a" stroke="#a5671a" stroke-width="3"/><rect x="74" y="12" width="26" height="16" rx="5" transform="rotate(28 87 20)" fill="#fa5252" stroke="#c92a2a" stroke-width="3"/></svg>`;

const FACE_EYES = `<g class="eyes"><circle cx="41" cy="38" r="3.4" fill="#3a2e39"/><circle cx="59" cy="38" r="3.4" fill="#3a2e39"/><circle cx="42" cy="36.8" r="1.1" fill="#fff"/><circle cx="60" cy="36.8" r="1.1" fill="#fff"/></g><g class="xeyes" stroke="#3a2e39" stroke-width="2.4" stroke-linecap="round"><path d="M37 34 L45 42 M45 34 L37 42 M55 34 L63 42 M63 34 L55 42"/></g>`;
const moleSvg = (fill: string, stroke: string, muzzle: string, extra = "") =>
  `<circle cx="29" cy="24" r="7" fill="${fill}" stroke="${stroke}" stroke-width="3.5"/><circle cx="71" cy="24" r="7" fill="${fill}" stroke="${stroke}" stroke-width="3.5"/><ellipse cx="50" cy="52" rx="26" ry="22" fill="${fill}" stroke="${stroke}" stroke-width="3.5"/><circle cx="50" cy="40" r="24" fill="${fill}" stroke="${stroke}" stroke-width="3.5"/><ellipse cx="50" cy="49" rx="12" ry="8.5" fill="${muzzle}"/><ellipse cx="50" cy="45" rx="4.6" ry="3.2" fill="#f06595"/>${FACE_EYES}<rect x="45" y="52" width="4.8" height="6.5" rx="1.2" fill="#fff" stroke="${stroke}" stroke-width="1.3"/><rect x="50.2" y="52" width="4.8" height="6.5" rx="1.2" fill="#fff" stroke="${stroke}" stroke-width="1.3"/><circle cx="33" cy="48" r="3.4" fill="#fa8fb0" opacity=".55"/><circle cx="67" cy="48" r="3.4" fill="#fa8fb0" opacity=".55"/>${extra}`;
const ART: Record<Kind, string> = {
  mole: moleSvg("#b9794a", "#6f4018", "#f3d9b1"),
  helmet: moleSvg("#b9794a", "#6f4018", "#f3d9b1", `<path d="M26 30 A24 20 0 0 1 74 30 Z" fill="#adb5bd" stroke="#495057" stroke-width="3.5" stroke-linejoin="round"/><rect x="23" y="28" width="54" height="6" rx="3" fill="#868e96" stroke="#495057" stroke-width="3"/><path d="M34 22 Q40 15 48 14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path class="crack" d="M54 11 L50 19 L56 23 L52 29" fill="none" stroke="#495057" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  golden: moleSvg("#ffd43b", "#e67700", "#fff3bf", `<path d="M20 12 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z M80 6 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#fff" stroke="#e67700" stroke-width="1.6" stroke-linejoin="round"/>`),
  bomb: `<circle cx="50" cy="42" r="23" fill="#495057" stroke="#212529" stroke-width="3.5"/><rect x="42" y="14" width="16" height="9" rx="3" fill="#868e96" stroke="#212529" stroke-width="3"/><path d="M52 14 Q58 4 68 8" fill="none" stroke="#a5671a" stroke-width="3" stroke-linecap="round"/><circle cx="69" cy="7" r="5" fill="#ffa94d" stroke="#e8590c" stroke-width="2"/><circle cx="69" cy="7" r="2" fill="#ffec99"/><path d="M33 28 Q39 24 45 29" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/><circle cx="41" cy="40" r="5.2" fill="#fff"/><circle cx="59" cy="40" r="5.2" fill="#fff"/><circle cx="42" cy="41" r="2.4" fill="#3a2e39"/><circle cx="58" cy="41" r="2.4" fill="#3a2e39"/><path d="M34 31 L46 36 M66 31 L54 36" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M40 55 L44 51 L48 55 L52 51 L56 55 L60 51" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  bunny: `<ellipse cx="38" cy="14" rx="7" ry="15" fill="#fff" stroke="#868e96" stroke-width="3.5"/><ellipse cx="62" cy="14" rx="7" ry="15" fill="#fff" stroke="#868e96" stroke-width="3.5"/><ellipse cx="38" cy="15" rx="3" ry="9" fill="#fcc2d7"/><ellipse cx="62" cy="15" rx="3" ry="9" fill="#fcc2d7"/><circle cx="50" cy="44" r="22" fill="#fff" stroke="#868e96" stroke-width="3.5"/><circle cx="41" cy="41" r="3.2" fill="#3a2e39"/><circle cx="59" cy="41" r="3.2" fill="#3a2e39"/><circle cx="42" cy="40" r="1" fill="#fff"/><circle cx="60" cy="40" r="1" fill="#fff"/><ellipse cx="50" cy="49" rx="3.6" ry="2.6" fill="#f06595"/><path d="M50 51.5 L50 55 M44 56 Q50 61 56 56" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"/><rect x="47.5" y="56" width="5" height="5" rx="1.2" fill="#fff" stroke="#868e96" stroke-width="1.4"/><circle cx="33" cy="50" r="3.6" fill="#fa8fb0" opacity=".55"/><circle cx="67" cy="50" r="3.6" fill="#fa8fb0" opacity=".55"/>`,
};
const holeSvg = (i: number, kind: Kind) => `<svg viewBox="0 0 100 100"><defs><clipPath id="whc${i}"><rect x="-10" y="-40" width="120" height="106"/></clipPath></defs><ellipse cx="50" cy="73" rx="45" ry="23" fill="#b9803f" stroke="#6f4018" stroke-width="3.5"/><ellipse cx="50" cy="66" rx="33" ry="14.5" fill="#4a2c12" stroke="#2f1a0a" stroke-width="3"/><g clip-path="url(#whc${i})"><g class="wh-crit">${ART[kind]}</g></g><path d="M17 66 A33 14.5 0 0 0 83 66 Q50 70 17 66Z" fill="#b9803f" stroke="#6f4018" stroke-width="3" stroke-linejoin="round"/><path d="M26 82 Q50 90 74 82" fill="none" stroke="#d9a15e" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;
const STAR = (on: boolean) => `<svg viewBox="0 0 40 40"><path d="M20 3 L25 15 L38 16 L28 25 L31 38 L20 31 L9 38 L12 25 L2 16 L15 15Z" fill="${on ? "#ffd43b" : "#e9ecef"}" stroke="${on ? "#e67700" : "#ced4da"}" stroke-width="3" stroke-linejoin="round"/></svg>`;
const HAMMER = `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="44" y="30" width="12" height="66" rx="5" fill="#e8a24a" stroke="#a5671a" stroke-width="4"/><rect x="14" y="8" width="72" height="34" rx="12" fill="#fa5252" stroke="#c92a2a" stroke-width="4"/><rect x="22" y="14" width="40" height="7" rx="3.5" fill="#fff" opacity=".45"/></svg>`;

type Phase = "ready" | "play" | "pause" | "over";
const NAMES = ["简单", "普通", "困难"];

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let level = Math.max(0, Math.min(2, ctx.store.get<number>("level", 1)));
  const best = () => ctx.store.get<number>(`best-${level}`, 0);

  const levelBtn = h("button", { class: "mopt", id: "wh-level", onclick: () => { if (phase === "play" || phase === "pause") return; level = (level + 1) % 3; ctx.store.set("level", level); ctx.sfx("tap"); setup(); } }, "");
  const timeEl = h("span", { class: "wh-stat", id: "wh-time" }, "");
  const scoreEl = h("span", { class: "wh-stat", id: "wh-score" }, "");
  const comboEl = h("span", { class: "wh-stat", id: "wh-combo" }, "");
  const bestEl = h("span", { class: "wh-stat best", id: "wh-best" }, "");
  const pauseBtn = h("button", { class: "mopt", id: "wh-pause", onclick: () => togglePause() }, "暂停");
  const fill = h("div", { class: "wh-fill", id: "wh-fill" });
  const hud = h("div", { class: "wh-hud" }, levelBtn, timeEl, scoreEl, comboEl, bestEl, pauseBtn, h("div", { class: "wh-bar" }, fill));
  const grid = h("div", { class: "wh-grid", id: "wh-grid" });
  const hammer = h("div", { class: "wh-hammer", id: "wh-hammer" });
  hammer.innerHTML = HAMMER;
  const title = h("h2", {}, ""), starsEl = h("div", { class: "wh-stars", id: "wh-stars" }), msg = h("p", {}, ""), msg2 = h("p", {}, "");
  const action = h("button", { class: "primary", id: "wh-start", onclick: () => { ctx.sfx("tap"); primary(); } }, "开始");
  const ovl = h("div", { class: "wh-ovl", id: "wh-ovl" }, title, starsEl, msg, msg2, action);
  const field = h("div", { class: "wh-field", id: "wh-field" }, grid, hammer, ovl);
  const board = h("div", { class: "wh-board" }, field);
  root.append(h("div", { class: "wh-wrap" }, hud, board));

  let s!: State, phase: Phase = "ready", seed = (Date.now() & 0x7fffffff) || 1;
  let manual = false, last = 0, raf = 0, cell = 80, kb = false;
  let holeEls: HTMLElement[] = [];
  let shown: string[] = [], fx: ({ kind: Kind; until: number } | null)[] = [];
  const timers = new Set<number>();
  let lastTime = -1, lastScore = -1, lastCombo = -1;

  try { kb = !!window.matchMedia?.("(pointer: fine)").matches; } catch { kb = false; }
  field.classList.toggle("kb", kb);

  const setOvl = (t: string, m: string, m2: string, b: string, show: boolean, st = -1) => {
    title.textContent = t; msg.textContent = m; msg2.textContent = m2; msg2.hidden = !m2; action.textContent = b; ovl.hidden = !show;
    starsEl.hidden = st < 0; starsEl.innerHTML = st < 0 ? "" : [1, 2, 3].map((n) => STAR(n <= st)).join("");
  };
  const buildGrid = () => {
    const L = LEVELS[level];
    grid.replaceChildren(); holeEls = []; shown = []; fx = [];
    for (let i = 0; i < L.cols * L.rows; i++) {
      const el = h("div", { class: "wh-hole", "data-i": String(i) });
      el.innerHTML = holeSvg(i, "mole");
      const key = h("span", { class: "wh-key" }, holeLabel(i, L.cols)); el.append(key);
      grid.append(el); holeEls.push(el); shown.push(""); fx.push(null);
    }
  };
  function refreshHud() {
    const rem = Math.ceil(remaining(s) / 1000);
    if (rem !== lastTime) { lastTime = rem; timeEl.textContent = `时间：${rem}`; }
    if (s.score !== lastScore) { lastScore = s.score; scoreEl.textContent = `得分：${s.score}`; }
    const cb = s.combo * 10 + mult(s.combo);
    if (cb !== lastCombo) { lastCombo = cb; const m = mult(s.combo); comboEl.textContent = `连击：${s.combo}` + (m > 1 ? ` ×${m}` : ""); comboEl.classList.toggle("hot", m > 1); }
    bestEl.textContent = `最高：${Math.max(best(), s.score)}`;
    levelBtn.textContent = `难度：${NAMES[level]}`; levelBtn.disabled = phase === "play" || phase === "pause";
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase !== "play" && phase !== "pause";
    const pct = Math.max(0, Math.min(100, (remaining(s) / DURATION) * 100));
    fill.style.width = `${pct}%`; fill.classList.toggle("low", remaining(s) <= 10000);
  }
  function render() {
    const now = performance.now();
    for (let i = 0; i < holeEls.length; i++) {
      const c = s.holes[i], el = holeEls[i];
      let key = "";
      if (c) key = `up|${c.kind}|${c.hp}`;
      else if (fx[i] && now < fx[i]!.until) key = `hit|${fx[i]!.kind}|1`;
      else fx[i] = null;
      if (key === shown[i]) continue;
      shown[i] = key;
      const [st, kind, hp] = key ? key.split("|") : ["", "", ""];
      if (kind && el.dataset.kind !== kind) { el.dataset.kind = kind; el.innerHTML = holeSvg(i, kind as Kind) + `<span class="wh-key">${holeLabel(i, LEVELS[level].cols)}</span>`; }
      el.classList.toggle("up", st === "up"); el.classList.toggle("hit", st === "hit");
      if (st === "up" && kind === "helmet") el.dataset.hp = hp; else delete el.dataset.hp;
    }
    refreshHud();
  }
  function layout() {
    const L = LEVELS[level], gap = 4, pad = 8;
    const bw = board.clientWidth, bh = board.clientHeight;
    cell = Math.max(40, Math.floor(Math.min(230, (bw - 8 - 2 * pad - (L.cols - 1) * gap) / L.cols, (bh - 8 - 2 * pad - (L.rows - 1) * gap) / L.rows)));
    const w = L.cols * cell + (L.cols - 1) * gap + 2 * pad, hh = L.rows * cell + (L.rows - 1) * gap + 2 * pad;
    field.style.width = `${w}px`; field.style.height = `${hh}px`;
    grid.style.padding = `${pad}px`; grid.style.gap = `${gap}px`; grid.style.gridTemplateColumns = `repeat(${L.cols}, ${cell}px)`; grid.style.gridTemplateRows = `repeat(${L.rows}, ${cell}px)`; grid.style.boxSizing = "border-box";
    hammer.style.width = hammer.style.height = `${Math.round(cell * 0.8)}px`;
  }
  function setup() {
    seed = (seed * 1664525 + 1013904223) >>> 0 || 1;
    s = newGame(level, testSeed ?? seed); phase = "ready"; lastTime = lastScore = lastCombo = -1;
    buildGrid(); layout();
    setOvl("打地鼠", "轻点地鼠得分，避开炸弹和兔子。", "", "开始", true); render();
  }
  let testSeed: number | null = null;
  function begin() { if (phase !== "ready") return; phase = "play"; setOvl("", "", "", "", false); last = performance.now(); render(); }
  function togglePause() {
    if (phase === "play") { phase = "pause"; setOvl("暂停", "点击继续。", "", "继续", true); }
    else if (phase === "pause") { phase = "play"; setOvl("", "", "", "", false); last = performance.now(); }
    render();
  }
  function primary() {
    if (phase === "ready") begin();
    else if (phase === "pause") togglePause();
    else if (phase === "over") { setup(); begin(); }
  }
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  function pop(hole: number, text: string, neg: boolean) {
    const el = holeEls[hole]; if (!el) return;
    const p = h("div", { class: "wh-pop" + (neg ? " neg" : "") }, text);
    p.style.left = `${el.offsetLeft + el.offsetWidth / 2}px`; p.style.top = `${el.offsetTop + el.offsetHeight * 0.1}px`;
    field.append(p); later(() => p.remove(), 750);
  }
  function swing(hole: number) {
    const el = holeEls[hole]; if (!el) return;
    const sz = Math.round(cell * 0.8);
    hammer.style.left = `${el.offsetLeft + el.offsetWidth / 2 - sz * 0.15}px`; hammer.style.top = `${el.offsetTop - sz * 0.1}px`;
    hammer.classList.remove("swing"); void hammer.offsetWidth; hammer.classList.add("swing");
  }
  function onTap(hole: number) {
    if (phase !== "play") return;
    const c = s.holes[hole];
    const ev: TapEv = tap(s, hole);
    swing(hole);
    if (ev.t === "kill") { fx[hole] = { kind: c!.kind, until: performance.now() + 260 }; pop(hole, `+${ev.pts}`, false); ctx.sfx(ev.kind === "golden" ? "good" : "pop"); }
    else if (ev.t === "dent") { ctx.sfx("tap"); }
    else if (ev.t === "bomb") { fx[hole] = { kind: "bomb", until: performance.now() + 260 }; pop(hole, `${ev.pts} -5s`, true); ctx.sfx("bad"); }
    else if (ev.t === "bunny") { fx[hole] = { kind: "bunny", until: performance.now() + 260 }; pop(hole, `${ev.pts}`, true); ctx.sfx("bad"); }
    else if (ev.t === "miss") ctx.sfx("move");
    render();
    if (s.over) finish();
  }
  function finish() {
    if (phase === "over") return;
    phase = "over"; render();
    const old = best(), rec = s.score > old;
    if (rec) ctx.store.set(`best-${level}`, s.score);
    ctx.sfx(stars(s.score, level) >= 2 ? "win" : "lose");
    setOvl("时间到！", rec && s.score > 0 ? `新纪录：${s.score}` : `得分：${s.score}`, `命中：${s.hits}，准确率：${accuracy(s)}%`, "再来一局", true, stars(s.score, level));
    render();
  }
  function advance(ms: number) { if (phase !== "play") return; step(s, ms); render(); if (s.over) finish(); }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch" && kb) { kb = false; field.classList.remove("kb"); }
    const el = (e.target as HTMLElement).closest(".wh-hole") as HTMLElement | null;
    if (!el || !grid.contains(el)) return;
    e.preventDefault(); onTap(Number(el.dataset.i));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " " || e.key === "Escape" || e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (phase === "play" || phase === "pause") togglePause(); else if (phase === "ready") begin(); else if (phase === "over" && e.key === " ") { setup(); begin(); }
      return;
    }
    if (e.key === "Enter" && phase === "over") { setup(); begin(); return; }
    const L = LEVELS[level], i = keyHole(e.key, L.cols, L.rows);
    if (i >= 0) { e.preventDefault(); if (!kb) { kb = true; field.classList.add("kb"); } onTap(i); }
  };
  const onVis = () => { if (document.hidden && phase === "play") togglePause(); };
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    if (phase === "play" && !manual) { const dt = Math.min(100, t - last); last = t; advance(dt); } else last = t;
    if (phase === "play" || fx.some(Boolean)) render();
  };
  document.addEventListener("keydown", onKey); document.addEventListener("visibilitychange", onVis);
  field.addEventListener("pointerdown", onDown);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null; ro?.observe(board);

  setup();
  raf = requestAnimationFrame(frame);
  (window as unknown as Record<string, unknown>).__whack = {
    state: () => s, phase: () => phase, cell: () => cell,
    manual: (on: boolean) => { manual = on; },
    /** move the game clock by ms (also in manual mode) */
    step: (ms: number) => { advance(ms); },
    spawn: (hole: number, kind: Kind) => { const ok = spawnAt(s, hole, kind); render(); return ok; },
    auto: (on: boolean) => { s.auto = on; },
    seed: (n: number) => { testSeed = n; setup(); },
    setLevel: (l: number) => { level = l; setup(); },
  };
  return () => {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro?.disconnect();
    if (phase === "play") { const rec = s.score > best(); if (rec) ctx.store.set(`best-${level}`, s.score); }
    document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__whack;
  };
}
