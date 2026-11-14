/**
 * The physics lab's kit (`#/science/physics`): everything a simulation needs, so that a simulation file only says WHAT it is (parameters, readouts, drawing, tasks, quiz)
 * and never HOW a slider, a readout list, a task list or a quiz works. Pure physics lives in `model-<id>.ts` (tested alone); a simulation module is
 * `export const meta` + `export const mount = (root, ctx) => mountSim(def, root, ctx)`.
 *
 * - state `St` = plain numbers (parameters and choices); every change redraws and re-checks the tasks;
 * - the drawing is made in code in a 640-unit wide box (`VW`), scaled to the LAYOUT width of the canvas (offsetWidth / offsetHeight, never getBoundingClientRect:
 *   a scale animation would give a fraction); only Latin letters / digits inside a canvas (a canvas is not translated);
 * - sliders are native range inputs 44 px high (pointer, touch and keyboard work by themselves); a drag on the canvas is optional (`pointer`, horizontal only: the page still scrolls);
 * - tasks (`实验任务`) are checked on every change and kept on this device (`learn.phys.v1`), the quiz (5 questions) is made from the model by `quiz(rng)`.
 */
import { h, toast } from "../ui";
import { renderRich, renderTeX } from "../mathtext";
import { mulberry32, clamp, fmt } from "./qtools";
import { tr } from "../i18n";
import type { Q } from "./qtools";

export type St = Record<string, number>;
export const VW = 640;
export interface Meta { id: string; title: string; grade: number; chapter: string; icon: string; tasks: number }
export interface ParamDef { id: string; label: string; min: number; max: number; step: number; value: number; unit?: string; dec?: number; when?: (s: St) => boolean }
export interface ChoiceDef { id: string; label: string; options: [number, string][]; value: number; when?: (s: St) => boolean }
export interface Readout { label: string; value: string; unit?: string }
export interface Task { id: string; text: string; check: (s: St) => boolean }
export interface SoundDef { start(s: St): void; update(s: St): void; stop(): void }
export interface SimDef {
  meta: Meta;
  lesson: string[];
  formulas?: string[];
  params: ParamDef[];
  choices?: ChoiceDef[];
  /** a play button that moves one parameter on by `rate` units per second (to its max, then back to its min when `loop`) */
  play?: { param: string; rate: number; loop?: boolean };
  readouts(s: St): Readout[];
  draw(c: CanvasRenderingContext2D, w: number, h: number, s: St): void;
  aspect?: number;
  /** a drag on the canvas: kind, x, y in drawing units; returns the changed parameters */
  pointer?: (kind: "down" | "move" | "up", x: number, y: number, s: St) => Partial<St> | void;
  tasks: Task[];
  quiz(rng: () => number): Q[];
  sound?: SoundDef;
  /** extra numeric state that has no control (a dragged item, counters); restored by 重置 */
  hidden?: St;
  /** buttons that change the state (e.g. a new random sample) */
  actions?: { id: string; label: string; run: (s: St) => Partial<St> | void }[];
  /** drags on the canvas that move in every direction (touch-action: none): the page does not scroll under a finger there */
  drag?: boolean;
  /** runs after every change of the state (a derived value; may change `s`) */
  derive?: (s: St, changed: string) => void;
  /** links under the lesson (other pages of the app) */
  links?: { text: string; href: string }[];
  /** where progress is kept (default the physics lab's) and the name of the test handle on `window` */
  storeKey?: string;
  handle?: string;
  /** rule 66: set only while the lesson / the quiz texts of a lab are NOT translated yet: they are shown in `user` boxes (never translated) as before */
  userLesson?: boolean;
  userQuiz?: boolean;
}
export interface PhysCtx { id: string; exit(): void }

export { mulberry32, pick, shuffle, clamp, rad, deg, fmt, makeQ, numQ } from "./qtools";
export type { Q } from "./qtools";
// ---------- progress on this device ----------
const KEY = "learn.phys.v1";
interface Saved { done: Record<string, string[]>; quiz: Record<string, number> }
export const loadSaved = (key: string = KEY): Saved => { try { const o = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<Saved>; return { done: o.done ?? {}, quiz: o.quiz ?? {} }; } catch { return { done: {}, quiz: {} }; } };
const putSaved = (s: Saved, key: string = KEY) => { try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* no storage: nothing is kept */ } };

declare global { interface Window { __phys?: Record<string, unknown> } }

export function mountSim(def: SimDef, root: HTMLElement, ctx: PhysCtx): () => void {
  const st: St = {};
  const KEYS = def.storeKey ?? KEY;
  const reset = () => { for (const p of def.params) st[p.id] = p.value; for (const c of def.choices ?? []) st[c.id] = c.value; Object.assign(st, def.hidden ?? {}); };
  reset();
  const saved = loadSaved(KEYS);
  const doneSet = new Set(saved.done[def.meta.id] ?? []);
  const aspect = def.aspect ?? 0.62;
  const VH = Math.round(VW * aspect);

  // ----- canvas
  const canvas = h("canvas", { class: "pl-canvas", id: "pl-canvas", style: `aspect-ratio:${VW} / ${VH}`, role: "img", "aria-label": tr(def.meta.title) });   // (a canvas is not translated by the page translator: its label is)
  const c2 = canvas.getContext("2d")!;
  let drawQueued = false;
  const redrawNow = () => {
    drawQueued = false;
    const w = canvas.offsetWidth, hh = canvas.offsetHeight;
    if (!w || !hh) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(w * dpr), bh = Math.round(hh * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    c2.setTransform(bw / VW, 0, 0, bh / VH, 0, 0);
    c2.clearRect(0, 0, VW, VH);
    c2.lineJoin = "round"; c2.lineCap = "round";
    def.draw(c2, VW, VH, st);
  };
  const redraw = () => { if (!drawQueued) { drawQueued = true; requestAnimationFrame(redrawNow); } };
  const ro = new ResizeObserver(redraw);
  ro.observe(canvas);

  // ----- readouts
  const readBox = h("div", { class: "pl-readouts", id: "pl-readouts" });
  const drawReadouts = () => {
    const rs = def.readouts(st);
    while (readBox.children.length > rs.length) readBox.lastElementChild!.remove();
    rs.forEach((r, i) => {
      let cell = readBox.children[i] as HTMLElement | undefined;
      if (!cell) { cell = h("div", { class: "pl-read" }, h("span", { class: "pl-rl" }), h("b", { class: "pl-rv" }, h("span", { class: "pl-rn" }), h("small", { class: "pl-ru" }))); readBox.append(cell); }
      const [l, v] = [cell.children[0] as HTMLElement, cell.children[1] as HTMLElement];
      if (l.textContent !== r.label) l.textContent = r.label;
      const n = v.children[0] as HTMLElement, u = v.children[1] as HTMLElement;
      if (n.textContent !== r.value) n.textContent = r.value;
      if ((u.textContent ?? "") !== (r.unit ?? "")) u.textContent = r.unit ?? "";
      cell.dataset.label = r.label;
    });
  };

  // ----- controls
  let playBtn: HTMLButtonElement | null = null;
  const ctlBox = h("div", { class: "pl-controls", id: "pl-controls" });
  const rows = new Map<string, { el: HTMLElement; update: () => void; when?: (s: St) => boolean }>();
  for (const c of def.choices ?? []) {
    const btns = c.options.map(([v, label]) => h("button", { class: "mopt pl-opt", "data-c": c.id, "data-v": String(v), onclick: () => set(c.id, v) }, label));
    const el = h("div", { class: "pl-ctl pl-choice", "data-c": c.id }, h("span", { class: "pl-lab" }, c.label), h("div", { class: "pl-opts" }, ...btns));
    rows.set(c.id, { el, when: c.when, update: () => btns.forEach((b) => b.classList.toggle("on", Number(b.dataset.v) === st[c.id])) });
  }
  for (const p of def.params) {
    const dec = p.dec ?? Math.max(0, Math.ceil(-Math.log10(p.step) - 1e-9));
    const vn = h("span", {}), vu = h("span", { class: "pl-vu" }), val = h("b", { class: "pl-val" }, vn, vu);
    const input = h("input", { type: "range", class: "pl-range", id: `pl-${p.id}`, min: String(p.min), max: String(p.max), step: String(p.step), value: String(p.value), "aria-label": p.label }) as HTMLInputElement;
    input.addEventListener("input", () => set(p.id, Number(input.value)));
    const el = h("label", { class: "pl-ctl", "data-p": p.id }, h("span", { class: "pl-lab" }, h("span", {}, p.label), val), input);
    rows.set(p.id, { el, when: p.when, update: () => { if (Number(input.value) !== st[p.id]) input.value = String(st[p.id]); vn.textContent = fmt(st[p.id], dec); vu.textContent = p.unit ? " " + p.unit : ""; } });
  }
  // choices first, then the sliders (a choice changes which sliders are there)
  for (const [, r] of rows) ctlBox.append(r.el);
  const drawControls = () => { for (const [, r] of rows) { r.update(); r.el.hidden = r.when ? !r.when(st) : false; } if (playBtn && def.play) playBtn.hidden = !!rows.get(def.play.param)?.el.hidden; };

  // ----- tasks
  const taskBox = h("ol", { class: "pl-tasks", id: "pl-tasks" }, ...def.tasks.map((t) => h("li", { class: "pl-task", "data-task": t.id }, h("span", { class: "pl-tick", "aria-hidden": "true" }, "○"), h("span", { class: "pl-tt" }, t.text))));
  const taskCount = h("span", { class: "pl-tcount", id: "pl-tcount" });
  const drawTasks = (announce: boolean, register: boolean) => {
    for (const t of register ? def.tasks : []) {
      let ok = false;
      try { ok = t.check(st); } catch { ok = false; }
      if (ok && !doneSet.has(t.id)) {
        doneSet.add(t.id);
        const s = loadSaved(KEYS); s.done[def.meta.id] = [...doneSet]; putSaved(s, KEYS);
        if (announce) toast("实验任务已完成", 2200);
      }
    }
    def.tasks.forEach((t, i) => { const d = doneSet.has(t.id); const li = taskBox.children[i] as HTMLElement; li.classList.toggle("done", d); (li.firstElementChild as HTMLElement).textContent = d ? "✓" : "○"; });
    taskCount.textContent = `${doneSet.size} / ${def.tasks.length}`;
  };

  // ----- state changes
  const update = (announce = true, register = true) => { drawControls(); drawReadouts(); drawTasks(announce, register); redraw(); if (soundOn) def.sound?.update(st); };
  function set(id: string, v: number) {
    const p = def.params.find((x) => x.id === id);
    st[id] = p ? clamp(Math.round(v / p.step) * p.step, p.min, p.max) : v;
    if (p) st[id] = Number(st[id].toFixed(6));
    def.derive?.(st, id);
    update();
  }

  // ----- play (moves one parameter on)
  let playing = false, raf = 0, last = 0;
  const advance = (dt: number) => {
    const pl = def.play!, p = def.params.find((x) => x.id === pl.param)!;
    let v = st[pl.param] + pl.rate * dt;
    if (v >= p.max) { if (pl.loop) v = p.min; else { v = p.max; stopPlay(); } }
    st[pl.param] = Number(clamp(v, p.min, p.max).toFixed(6));
    update(false);
  };
  playBtn = def.play ? h("button", { class: "mopt pl-btn", id: "pl-play", onclick: () => (playing ? stopPlay() : startPlay()) }, "播放") : null;
  function loop(ts: number) { if (!playing) return; advance(Math.min(0.1, (ts - last) / 1000)); last = ts; raf = requestAnimationFrame(loop); }
  function startPlay() {
    const pl = def.play!, p = def.params.find((x) => x.id === pl.param)!;
    if (st[pl.param] >= p.max) { st[pl.param] = p.min; update(false); }
    playing = true; last = performance.now(); raf = requestAnimationFrame(loop); if (playBtn) { playBtn.textContent = "暂停"; playBtn.classList.add("on"); }
  }
  function stopPlay() { playing = false; cancelAnimationFrame(raf); if (playBtn) { playBtn.textContent = "播放"; playBtn.classList.remove("on"); } }

  // ----- sound
  let soundOn = false;
  const soundBtn = def.sound ? h("button", { class: "mopt pl-btn", id: "pl-sound", "aria-pressed": "false", onclick: () => { soundOn = !soundOn; soundBtn!.classList.toggle("on", soundOn); soundBtn!.setAttribute("aria-pressed", String(soundOn)); soundBtn!.textContent = soundOn ? "关闭声音" : "播放声音"; if (soundOn) def.sound!.start(st); else def.sound!.stop(); } }, "播放声音") : null;

  // ----- a drag on the canvas
  let dragging = false;
  const toDrawing = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    const k = canvas.offsetWidth ? r.width / canvas.offsetWidth : 1;   // (a scaled ancestor: rectangle / layout size = that scale)
    return [((e.clientX - r.left) / k / canvas.offsetWidth) * VW, ((e.clientY - r.top) / k / canvas.offsetHeight) * VH];
  };
  if (def.pointer) {
    canvas.style.touchAction = def.drag ? "none" : "pan-y";
    const go = (kind: "down" | "move" | "up", e: PointerEvent) => { const [x, y] = toDrawing(e); const ch = def.pointer!(kind, x, y, st); if (ch) { for (const [k, v] of Object.entries(ch)) set(k, v as number); } };
    canvas.addEventListener("pointerdown", (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); go("down", e); });
    canvas.addEventListener("pointermove", (e) => { if (dragging) go("move", e); });
    const end = (e: PointerEvent) => { if (!dragging) return; dragging = false; go("up", e); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  }

  // ----- quiz
  const quizBox = h("div", { class: "pl-quiz", id: "pl-quiz" });
  let qs: Q[] = [], qi = 0, score = 0, answered = false;
  const drawQuiz = () => {
    quizBox.replaceChildren();
    const best = loadSaved(KEYS).quiz[def.meta.id];
    if (!qs.length) {
      quizBox.append(h("button", { class: "primary", id: "quiz-start", onclick: () => { qs = def.quiz(mulberry32(Date.now() & 0xffffff)); qi = 0; score = 0; answered = false; drawQuiz(); } }, "开始小测验"),
        ...(best !== undefined ? [h("span", { class: "muted small pl-best" }, `最好成绩：${best} / 5`)] : []));
      return;
    }
    if (qi >= qs.length) {
      const s = loadSaved(KEYS); s.quiz[def.meta.id] = Math.max(s.quiz[def.meta.id] ?? 0, score); putSaved(s, KEYS);
      quizBox.append(h("p", { class: "pl-score", id: "quiz-score" }, `得分 ${score} / ${qs.length}`), h("button", { class: "mopt", id: "quiz-again", onclick: () => { qs = []; drawQuiz(); } }, "再做一次"));
      return;
    }
    const q = qs[qi];
    const uq = def.userQuiz ? " user" : "", tq = (t: string) => (def.userQuiz ? t : tr(t));
    const qEl = h("p", { class: "pl-q" + uq, id: "quiz-q" });
    renderRich(qEl, tq(q.q), false);   // (content is translated, rule 66: the question text is a template, tr() fills the numbers back in)
    const why = h("p", { class: "pl-why" + uq, id: "quiz-why", hidden: true });
    const next = h("button", { class: "primary", id: "quiz-next", hidden: true, onclick: () => { qi++; answered = false; drawQuiz(); } }, qi + 1 >= qs.length ? "查看得分" : "下一题");
    const opts = q.choices.map((c, i) => h("button", { class: "mopt pl-qopt" + uq, "data-i": String(i), onclick: () => {
      if (answered) return;
      answered = true;
      if (i === q.a) score++;
      opts.forEach((b, j) => { b.classList.toggle("right", j === q.a); b.classList.toggle("wrong", j === i && i !== q.a); b.disabled = true; });
      if (q.why) { renderRich(why, tq(q.why), false); why.hidden = false; }
      next.hidden = false;
    } }, tq(c)));
    quizBox.append(h("p", { class: "muted small", id: "quiz-no" }, `第 ${qi + 1} / ${qs.length} 题`), qEl, h("div", { class: "pl-qopts" }, ...opts), why, next);
  };

  // ----- the page
  const lesson = h("div", { class: "pl-lesson" + (def.userLesson ? " user" : ""), id: "pl-lesson" }, ...def.lesson.map((t) => { const p = h("p", {}); renderRich(p, def.userLesson ? t : tr(t), false); return p; }));
  const formulas = def.formulas?.length ? h("div", { class: "pl-formulas" + (def.userLesson ? " user" : ""), id: "pl-formulas" }, ...def.formulas.map((f) => { const d = h("div", { class: "pl-formula" }); renderTeX(d, def.userLesson ? f : tr(f), def.userLesson ? f : tr(f)); return d; })) : null;
  const resetBtn = h("button", { class: "mopt pl-btn", id: "pl-reset", onclick: () => { stopPlay(); reset(); update(false, false); toast("已重置", 1500); } }, "重置");
  const actBtns = (def.actions ?? []).map((a) => h("button", { class: "mopt pl-btn pl-act", id: `pl-act-${a.id}`, onclick: () => { const ch = a.run(st); if (ch) for (const [k, v] of Object.entries(ch)) st[k] = v as number; def.derive?.(st, a.id); update(); } }, a.label));
  const stage = h("div", { class: "pl-stage" }, canvas, readBox);
  const side = h("div", { class: "pl-side" },
    h("div", { class: "pl-bar" }, playBtn, soundBtn, ...actBtns, resetBtn), ctlBox);
  const info = h("div", { class: "pl-info" },
    h("section", { class: "pl-card" }, h("h3", {}, "原理"), lesson, formulas, def.links?.length ? h("div", { class: "pl-links", id: "pl-links" }, ...def.links.map((l) => h("a", { class: "mopt pl-link", href: l.href }, l.text))) : null),
    h("section", { class: "pl-card" }, h("h3", {}, "实验任务 ", taskCount), taskBox),
    h("section", { class: "pl-card" }, h("h3", {}, "小测验"), quizBox));
  const sim = h("div", { class: "pl-sim", "data-sim": def.meta.id }, h("div", { class: "pl-main" }, stage, side), info);
  root.replaceChildren(sim);
  update(false, false);
  drawQuiz();

  // a handle for the tests (and nothing else): the state, a way to set it by name, to move the clock on, and what was done
  (window as unknown as Record<string, unknown>)[def.handle ?? "__phys"] = {
    id: def.meta.id, st, def,
    set: (id: string, v: number) => set(id, v),
    tick: (dt: number) => { if (def.play) advance(dt); },
    reset: () => { reset(); update(false, false); },
    done: () => [...doneSet],
    redraw: () => redrawNow(),
    soundOn: () => soundOn,
    quiz: () => qs,
  };
  return () => { stopPlay(); ro.disconnect(); if (soundOn) def.sound?.stop(); delete (window as unknown as Record<string, unknown>)[def.handle ?? "__phys"]; };
}
