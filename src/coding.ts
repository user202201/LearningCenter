/**
 * 编程 (coding), phase 1: block programming. Screens: the list of children -> a child's world map (6 islands, trophy shelf) -> the levels of a world ->
 * a level (scene + program workspace + block palette), random practice (worlds 1-3) and the free drawing canvas.
 * Pure parts: coding-ast.ts (program data, pseudo-code), coding-interp.ts (interpreter), coding-levels.ts (levels, families, generators), coding-model.ts (progress).
 * Progress is `coding/<kid>.json` (api.update, merged by the larger star count); saved drawings and lessons seen stay on this device.
 */
import { h, toast, modal, confirmDlg } from "./ui";
import * as M from "./model";
import * as api from "./api";
import * as P from "./profile";
import { subjectArt, shortcuts } from "./hub";
import type { Ctx } from "./english";
import { Program, cloneProgram, emptyProgram, nextHint, parse, toText, countBlocks } from "./coding-ast";
import { Machine, StepInfo, State, cloneState, makeTurtle, makeGrid } from "./coding-interp";
import { LEVELS, Level, WORLDS, levelsOf, levelById, instanceOf, evaluate, Evaluation, starsFor, goalLines, randomLevel, mulberry32 } from "./coding-levels";
import * as CM from "./coding-model";
import { gridScene, turtleScene, Scene, Mood } from "./coding-scene";
import { createEditor, programEl, Editor } from "./coding-editor";
import { LESSONS, Demo } from "./coding-lessons";
import { islandSvg, badgeSvg, worldColor } from "./coding-art";
import { pathsByColor, colorHex } from "./coding-turtle";

let X!: Ctx;
export const initCoding = (c: Ctx) => { X = c; };
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const COLOR = "#0c8599";
const NS = "http://www.w3.org/2000/svg";

const docs = new Map<string, CM.CodingDoc>();
const loadDoc = async (id: string): Promise<CM.CodingDoc> => { const d = (await api.readJson<CM.CodingDoc>(CM.codingPath(id))) ?? CM.EMPTY_CODING; docs.set(id, d); return d; };
const worldName = (w: number) => WORLDS.find((x) => x.id === w)?.name ?? "";

const starSvg = (on: boolean) => `<svg viewBox="-14 -14 28 28" aria-hidden="true" focusable="false"><path d="M0-12l3.600 7.500 8.200 1.200-6 5.800 1.400 8.200L0 7l-7.200 3.700 1.400-8.200-6-5.800 8.200-1.200z" fill="${on ? "#ffd43b" : "#e9ecef"}" stroke="${on ? "#f59f00" : "#ced4da"}" stroke-width="2" stroke-linejoin="round"/></svg>`;
const starRow = (n: number, cls = "cl-stars") => { const s = h("span", { class: cls, "data-stars": String(n), role: "img", "aria-label": `${n} / 3` }); s.innerHTML = [1, 2, 3].map((i) => starSvg(i <= n)).join(""); return s; };

// ---------- the list of children ----------
export async function renderHome() {
  const my = X.epoch();
  X.showLoading();
  try {
    await X.loadShared();
    await Promise.all(X.kids().kids.map((k) => loadDoc(k.id)));
  } catch (e) {
    return my === X.epoch() ? X.showError(e, renderHome) : undefined;
  }
  if (my !== X.epoch()) return;
  const kids = X.kids().kids;
  const hero = h("header", { class: "top hero home-hero subj-hero", style: `--kid:${COLOR}` },
    X.back("#/", "选择学科"), h("span", { class: "subj-ico" }, subjectArt("coding")),
    h("div", { class: "hero-text" }, h("h1", {}, "编程"), h("p", {}, "请选择孩子")), X.gear("#/subject/coding"));
  if (!kids.length) {
    return X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero,
      h("main", { class: "scroll" }, h("div", { class: "narrow home-empty empty-home" },
        h("button", { class: "add-big", id: "add-kid-big", title: "添加孩子", "aria-label": "添加孩子", onclick: () => void X.addKid(() => X.route()) }, "＋"),
        h("p", {}, "暂无孩子。请先添加。")))));
  }
  const list = h("div", { class: "kids" });
  for (const k of kids) {
    const d = docs.get(k.id) ?? CM.EMPTY_CODING;
    const worlds = WORLDS.filter((w) => CM.worldStat(d, w.id).done).length;
    list.append(h("button", { class: "kid", style: `--kid:${k.color}`, "data-kid": k.id, onclick: () => (location.hash = `#/coding/${k.id}`) },
      X.avatarEl(k),
      h("span", { class: "kinfo" }, h("span", { class: "kname user" }, k.name), h("span", { class: "ksub" }, h("span", {}, `★ ${CM.totalStars(d)}`), " · ", h("span", {}, `已完成 ${worlds} 个世界`))),
      h("span", { class: "chev" }, "›")));
  }
  X.stagger([...list.querySelectorAll<HTMLElement>(".kid")]);
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero, h("main", { class: "scroll" }, h("div", { class: "narrow" }, list))));
}

// ---------- a child ----------
export async function renderKid(id: string, rest: string) {
  const my = X.epoch();
  X.showLoading();
  let doc: CM.CodingDoc;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    doc = await loadDoc(id);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderKid(id, rest)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) { toast("未找到该孩子"); return void (location.hash = "#/subject/coding"); }
  let m: RegExpExecArray | null;
  if (!rest) return worldMap(k, doc);
  if ((m = /^w([1-6])$/.exec(rest))) return worldPage(k, doc, Number(m[1]));
  if ((m = /^w([1-6])\/(\d+)$/.exec(rest))) {
    const [wn, ln] = [Number(m[1]), Number(m[2])];
    const lv = levelsOf(wn).find((l) => l.no === ln);
    if (lv) return levelPage(k, lv);
  }
  if ((m = /^r([1-3])$/.exec(rest))) return randomPage(k, Number(m[1]) as 1 | 2 | 3);
  if (rest === "free") return freePage(k);
  location.hash = `#/coding/${id}`;
}

const kidHero = (k: M.Kid, backTo: string, backLabel: string) =>
  h("header", { class: "top hero kid-hero" }, X.back(backTo, backLabel), h("h1", { class: "user-title" }, X.avatarEl(k), k.name), shortcuts(k.id, "coding"));

function worldMap(k: M.Kid, doc: CM.CodingDoc) {
  const rec = CM.recommendedWorld(doc, P.gradeOf(k.id));
  const shelf = h("div", { class: "cl-shelf", id: "trophies", "aria-label": "徽章" },
    ...WORLDS.map((w) => { const got = CM.worldStat(doc, w.id).done; const t = h("span", { class: "cl-trophy" + (got ? " got" : ""), "data-world": String(w.id), title: got ? worldName(w.id) : "", "aria-label": got ? worldName(w.id) : "未获得" }); t.innerHTML = badgeSvg(w.id, got); return t; }),
    h("span", { class: "cl-total", id: "cl-total" }, `★ ${CM.totalStars(doc)}`));
  const trail = h("div", { class: "cl-trail" });
  WORLDS.forEach((w, i) => {
    const st = CM.worldStat(doc, w.id);
    const card = h("a", { class: "cl-island" + (i % 2 ? " right" : "") + (rec === w.id ? " rec" : "") + (st.done ? " done" : ""), href: `#/coding/${k.id}/w${w.id}`, "data-world": String(w.id), style: `--wc:${worldColor(w.id)}` },
      h("span", { class: "isl-art" }), h("span", { class: "isl-info" },
        h("span", { class: "isl-no" }, `第 ${w.id} 个世界`), h("b", { class: "isl-name" }, w.name),
        h("span", { class: "isl-stars" }, `★ ${st.stars} / ${st.max}`), h("span", { class: "isl-prog" }, `${st.solved} / ${st.total}`)));
    card.querySelector(".isl-art")!.innerHTML = islandSvg(w.id);
    if (rec === w.id) card.append(h("span", { class: "isl-rec" }, "推荐"));
    trail.append(card);
    if (i < WORLDS.length) { const seg = h("span", { class: "cl-seg" + (i % 2 ? " flip" : ""), "aria-hidden": "true" }); seg.innerHTML = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M${i % 2 ? 78 : 22} 0C${i % 2 ? 78 : 22} 24 ${i % 2 ? 22 : 78} 14 ${i % 2 ? 22 : 78} 40" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9"/></svg>`; trail.append(seg); }
  });
  trail.append(h("a", { class: "cl-island free", id: "cl-free", href: `#/coding/${k.id}/free`, style: "--wc:#d6336c" },
    h("span", { class: "isl-art" }), h("span", { class: "isl-info" }, h("span", { class: "isl-no" }, "自由画图"), h("b", { class: "isl-name" }, "创作"), h("span", { class: "isl-stars" }, `${(CM.loadLocal().drawings[k.id] ?? []).length} / ${CM.MAX_DRAWINGS}`))));
  trail.querySelector("#cl-free .isl-art")!.innerHTML = islandSvg(6);
  X.show(h("div", { class: "page", style: `--kid:${k.color}` }, kidHero(k, "#/subject/coding", "孩子"), h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow" }, shelf, trail))));
}

function worldPage(k: M.Kid, doc: CM.CodingDoc, world: number) {
  const st = CM.worldStat(doc, world);
  const lessonId = levelsOf(world)[0].lesson;
  const grid = h("div", { class: "cl-levels" });
  for (const l of levelsOf(world)) {
    const s = doc.stars?.[l.id] ?? 0;
    const a = h("a", { class: "cl-lvl" + (l.boss ? " boss" : "") + (l.debug ? " debug" : "") + (s ? " solved" : ""), href: `#/coding/${k.id}/w${world}/${l.no}`, "data-level": l.id, "data-stars": String(s), style: `--wc:${worldColor(world)}` },
      h("span", { class: "lvl-no" }, String(l.no)), starRow(s, "lvl-stars"), h("span", { class: "lvl-title" }, l.title),
      l.boss ? h("span", { class: "lvl-tag" }, "挑战") : l.debug ? h("span", { class: "lvl-tag" }, "找错误") : null);
    grid.append(a);
  }
  X.stagger([...grid.querySelectorAll<HTMLElement>(".cl-lvl")]);
  const tools = h("div", { class: "cl-wtools" },
    lessonId ? h("button", { id: "cl-world-lesson", onclick: () => void openLesson(lessonId) }, "课程") : null,
    world <= 3 ? h("button", { class: "primary", id: "cl-random", onclick: () => (location.hash = `#/coding/${k.id}/r${world}`) }, "随机挑战") : null);
  const medal = h("span", { class: "cl-trophy" + (st.done ? " got" : ""), id: "cl-medal" });
  medal.innerHTML = badgeSvg(world, st.done);
  X.show(h("div", { class: "page", style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero" }, X.back(`#/coding/${k.id}`, "世界"), h("h1", {}, worldName(world)), shortcuts(k.id, "coding")),
    h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow" },
      h("div", { class: "cl-wsum" }, medal, h("div", {}, h("b", { id: "cl-wstars" }, `★ ${st.stars} / ${st.max}`), h("span", { class: "muted" }, ` · ${st.solved} / ${st.total}`)), tools),
      grid))));
}

// ---------- mini-lessons ----------
function demoRunner(box: HTMLElement, demo: Demo): () => void {
  let timer = 0, dead = false;
  const build = () => {
    const prog = parse(demo.program);
    let scene: Scene, mach: Machine;
    if (demo.turtle) {
      const t = makeTurtle(); t.state.x = demo.origin?.x ?? -25; t.state.y = demo.origin?.y ?? 25;
      scene = turtleScene(t.state); mach = new Machine(prog, t.world, t.state);
    } else {
      const g = makeGrid(demo.rows!, demo.start); scene = gridScene(g.world, g.state); mach = new Machine(prog, g.world, g.state);
    }
    box.replaceChildren(scene.el);
    scene.render(mach.state);
    const tick = () => {
      if (dead) return;
      const info = mach.step();
      if (info) scene.render(mach.state, info.crash ? "crash" : "ok");
      if (info && mach.status === "running") timer = window.setTimeout(tick, 420);
      else { scene.render(mach.state, mach.status === "crash" ? "crash" : "happy"); timer = window.setTimeout(build, 1600); }
    };
    timer = window.setTimeout(tick, 600);
  };
  build();
  return () => { dead = true; clearTimeout(timer); };
}

/** opens a mini-lesson (and remembers on this device that it was seen) */
export async function openLesson(id: string): Promise<void> {
  const les = LESSONS[id];
  if (!les) return;
  let stop = () => {};
  await modal<boolean>((close) => {
    let i = 0;
    const demoBox = h("div", { class: "cl-demo", id: "cl-demo" });
    const text = h("p", { class: "cl-lesson-text", id: "cl-lesson-text" });
    const dots = h("div", { class: "cl-dots" });
    const prev = h("button", { id: "cl-lesson-prev", onclick: () => show(i - 1) }, "上一步");
    const next = h("button", { class: "primary", id: "cl-lesson-next", onclick: () => (i >= les.steps.length - 1 ? close(true) : show(i + 1)) }, "下一步");
    const show = (n: number) => {
      i = Math.max(0, Math.min(les.steps.length - 1, n));
      stop(); stop = demoRunner(demoBox, les.steps[i].demo);
      text.textContent = les.steps[i].text;
      dots.replaceChildren(...les.steps.map((_, j) => h("i", { class: j === i ? "on" : "" })));
      (prev as HTMLButtonElement).disabled = i === 0;
      next.textContent = i >= les.steps.length - 1 ? "完成" : "下一步";
    };
    show(0);
    return h("div", { class: "dlg cl-lesson", id: "cl-lesson" }, h("h2", {}, les.title), demoBox, text, dots,
      h("div", { class: "row end" }, h("button", { id: "cl-lesson-close", onclick: () => close(true) }, "关闭"), prev, next));
  });
  stop();
  CM.patchLocal((l) => { if (!l.seen.includes(id)) l.seen.push(id); });
}

// ---------- the play screen (a level, a random challenge, the free canvas) ----------
interface Play {
  kid: M.Kid; level: Level; mode: "level" | "random" | "free";
  backTo: string; backLabel: string; title: (Node | string)[];
  /** called after a solved level (stars, blocks) */
  won?: (stars: number, blocks: number) => Promise<void>;
  next?: () => void; again?: () => void;
}
const SPEED = { slow: 900, normal: 450, fast: 140 } as const;

function playScreen(p: Play) {
  const { level, kid } = p;
  const free = p.mode === "free";
  const local = CM.loadLocal();
  const inst0 = instanceOf(level);
  const scene: Scene = inst0.world.kind === "grid" ? gridScene(inst0.world, inst0.state) : turtleScene(inst0.state, inst0.target);
  scene.render(inst0.state);
  let editor!: Editor;
  let mach: Machine | null = null, timer = 0, dry: Evaluation | null = null, failures = 0, usedAnswer = false, running = false, stepMode = false, cap = Infinity, shown = 0;
  const codeEl = h("pre", { class: "cl-code user", id: "cl-code", hidden: !local.code && !free && level.world < 3 });
  const showCode = () => { codeEl.textContent = toText(editor.program()) || "// "; };
  editor = createEditor({
    palette: level.palette, funcs: level.funcs, vars: level.vars, conds: level.conds, max: level.max, program: level.givenProg,
    onChange: () => { showCode(); hintClear(); },
  });
  const hintClear = () => editor.hint(null);
  const msg = h("p", { class: "cl-msg", id: "cl-msg", role: "status" });
  const result = h("div", { class: "cl-result", id: "cl-result", hidden: true });
  const setMsg = (t: string, kind = "") => { msg.textContent = t; msg.className = "cl-msg " + kind; };
  const btn = (id: string, text: string, onclick: () => void, cls = "") => h("button", { id, class: cls, type: "button", onclick }, text);

  const delay = () => SPEED[CM.loadLocal().speed];
  const setSceneMs = () => (scene.el.style.setProperty("--cs-ms", `${Math.round(delay() * 0.8)}ms`));
  const ui = {
    run: btn("cl-run", "运行", () => void start(false), "primary"),
    step: btn("cl-step", "单步", () => void start(true)),
    stop: btn("cl-stop", "停止", () => reset(true)),
    hint: btn("cl-hint", "提示", () => doHint()),
    answer: btn("cl-answer", "看答案", () => void showAnswer()),
    code: btn("cl-code-btn", "显示代码", () => { const hid = codeEl.hidden; codeEl.hidden = !hid; CM.patchLocal((l) => { l.code = hid; }); ui.code.textContent = hid ? "隐藏代码" : "显示代码"; showCode(); }),
    lesson: h("button", { id: "cl-lesson-btn", class: "cl-round", type: "button", title: "课程", "aria-label": "课程", onclick: () => level.lesson && void openLesson(level.lesson) }, "?"),
  };
  ui.answer.hidden = true;
  ui.code.hidden = !(free || level.world >= 3);
  ui.code.textContent = codeEl.hidden ? "显示代码" : "隐藏代码";
  const speeds = (["slow", "normal", "fast"] as const).map((s) => h("button", { class: "mopt" + (local.speed === s ? " on" : ""), "data-speed": s, id: `cl-sp-${s}`, type: "button", onclick: () => { CM.patchLocal((l) => { l.speed = s; }); speeds.forEach((b) => b.classList.toggle("on", b.dataset.speed === s)); setSceneMs(); } }, s === "slow" ? "慢速" : s === "fast" ? "快速" : "中速"));
  const lockBtns = (on: boolean) => { (ui.run as HTMLButtonElement).disabled = on; };

  function reset(user: boolean) {
    clearTimeout(timer); mach = null; running = false; dry = null;
    editor.highlight(null); editor.setLocked(false);
    const inst = instanceOf(level);
    scene.render(inst.state);
    (ui.run as HTMLButtonElement).disabled = false;
    result.hidden = true;
    if (user) setMsg("已停止，机器人回到起点。");
  }
  async function start(single: boolean) {
    if (running && single && mach) return void tick();   // the next step of a step-by-step run
    if (running) return;
    const prog = editor.program();
    if (countBlocks(prog) === 0) return void setMsg("请先搭一些积木。");
    result.hidden = true;
    const inst = instanceOf(level);
    scene.render(inst.state);
    dry = free ? null : evaluate(level, prog);
    cap = dry && (dry.status === "infinite" || dry.status === "budget") ? 60 : Infinity;
    mach = new Machine(prog, inst.world, inst.state, { budget: dry?.status === "budget" ? 400 : undefined });
    running = true; stepMode = single; shown = 0;
    editor.setLocked(true); lockBtns(true); setSceneMs();
    setMsg(single ? "单步运行：每按一次“单步”执行一块积木。" : "");
    if (single) return void tick();
    tick();
  }
  function tick() {
    if (!mach) return;
    const info: StepInfo | null = mach.step();
    shown++;
    if (info) { editor.highlight(info.id); scene.render(mach.state, info.crash ? "crash" : "ok"); }
    if (!info || mach.status !== "running" || shown >= cap) return void finish();
    if (!stepMode) timer = window.setTimeout(tick, delay());
  }
  /** runs the whole program at once (tests, and the hook of coding) */
  function instant() {
    if (!mach || !running) return;
    while (mach.status === "running" && shown < cap) { const info = mach.step(); shown++; if (info) scene.render(mach.state, info.crash ? "crash" : "ok"); }
    finish();
  }
  function finish() {
    clearTimeout(timer);
    const m = mach!;
    running = false; stepMode = false;
    editor.highlight(null); editor.setLocked(false); (ui.run as HTMLButtonElement).disabled = false;
    if (free) { scene.render(m.state, m.status === "crash" ? "crash" : "ok"); setMsg(m.status === "done" ? "已画完。" : m.message); return; }
    const d = dry!;
    if (d.status === "done" && d.won) return void success();
    scene.render(m.state, d.status === "crash" ? "crash" : "ok");
    setMsg(d.missing[0] ?? d.message, "bad");
    failures++;
    ui.answer.hidden = failures < 3;
  }
  async function success() {
    const blocks = editor.count();
    const stars = usedAnswer ? 1 : starsFor(blocks, level.par);
    scene.render(mach!.state, "happy");
    setMsg("");
    result.replaceChildren(
      h("div", { class: "cl-res-top" }, starRow(stars, "cl-res-stars"), h("b", { id: "cl-res-title" }, "完成。")),
      h("p", { id: "cl-res-text" }, `使用了 ${blocks} 块积木，满分需要 ${level.par} 块以内。`),
      h("p", { class: "muted small", hidden: !usedAnswer }, "看过参考答案，最多得 1 颗星。"),
      h("div", { class: "row end cl-res-btns" },
        btn("cl-again", "再试一次", () => { reset(false); }),
        p.again ? btn("cl-new", "再来一个", () => p.again!(), "primary") : null,
        p.next ? btn("cl-next", "下一关", () => p.next!(), "primary") : null,
        btn("cl-back-list", "返回", () => (location.hash = p.backTo))));
    result.hidden = false;
    result.dataset.stars = String(stars);
    if (p.won) { try { await p.won(stars, blocks); } catch (e) { toast(errText(e), 6000); } }
  }

  function doHint() {
    const h2 = nextHint(editor.program(), level.sol);
    editor.hint(h2);
    if (h2.done) return void setMsg("积木的顺序已经正确。请检查数字和条件。");
    setMsg(h2.wrongId ? "高亮的积木需要修改。" : h2.extraId ? "多了一块积木。" : "请使用高亮的积木。");
  }
  async function showAnswer() {
    const ok = await modal<boolean>((close) => h("div", { class: "dlg cl-answer", id: "cl-answer-dlg" }, h("h2", {}, "参考答案"),
      h("div", { class: "cl-answer-body" }, programEl(level.sol, { funcs: level.funcs, vars: level.vars })),
      h("p", { class: "muted small" }, "使用参考答案后，这一关最多得 1 颗星。"),
      h("div", { class: "row end" }, h("button", { id: "cl-answer-close", onclick: () => close(false) }, "关闭"), h("button", { class: "primary", id: "cl-answer-use", onclick: () => close(true) }, "使用这个答案"))));
    if (!ok) return;
    usedAnswer = true;
    editor.setProgram(cloneProgram(level.sol, true));
    setMsg("已放入参考答案。");
  }

  const goals = goalLines(level, inst0);
  const info = h("div", { class: "cl-goal", id: "cl-goal" }, ...goals.map((g) => h("p", {}, g)), level.note ? h("p", { class: "cl-note" }, level.note) : null, level.debug ? h("p", { class: "cl-note" }, "程序里有一个错误。请修改它。") : null);
  const tools = h("div", { class: "cl-tools" },
    h("div", { class: "cl-row" }, ui.run, ui.step, ui.stop, ui.hint, ui.answer),
    h("div", { class: "cl-row" }, h("div", { class: "seg cl-speed", id: "cl-speed" }, ...speeds), ui.code));
  const extra: HTMLElement[] = [];
  if (free) {
    extra.push(btn("cl-clear", "清空", async () => { if (editor.count() && (await confirmDlg("清空程序？", "所有积木都会被移走。", "清空", true))) { editor.setProgram(emptyProgram()); reset(false); toast("已清空"); } }),
      btn("cl-save", "保存", () => saveDrawing(kid, editor.program(), () => refreshGallery())), btn("cl-gallery", "我的作品", () => void gallery(kid, editor, reset)));
    tools.append(h("div", { class: "cl-row" }, ...extra));
  }
  const refreshGallery = () => { ui.step.focus(); };
  const page = h("div", { class: "page cl-page", style: `--kid:${kid.color}` },
    h("header", { class: "top hero kid-hero cl-hero" }, X.back(p.backTo, p.backLabel), h("h1", { id: "cl-title" }, ...p.title), level.lesson ? ui.lesson : h("span", { class: "slot" })),
    h("main", { class: "cl-main", id: "cl-main" },
      h("section", { class: "cl-left" }, h("div", { class: "cl-scene", id: "cl-scene" }, scene.el), info, msg, tools, result),
      h("section", { class: "cl-right" }, editor.el, codeEl)));
  X.show(page);
  setSceneMs(); showCode();
  if (level.lesson && !CM.loadLocal().seen.includes(level.lesson) && !free && p.mode === "level") void openLesson(level.lesson);
  // the hook for tests: run programs at once, look at the state
  const hook = {
    get level() { return level; },
    get state(): State { return cloneState(mach?.state ?? instanceOf(level).state); },
    get editor() { return editor; },
    get scene() { return scene; },
    run(src: Program | string) { const prog = typeof src === "string" ? parse(src) : src; editor.setProgram(cloneProgram(prog, true)); return free ? null : evaluate(level, prog); },
    runUI(src?: Program | string) { if (src !== undefined) hook.run(src); reset(false); void start(false).then(() => instant()); },
    step() { if (!running) void start(true); else tick(); return mach?.status ?? null; },
    get status() { return mach?.status ?? null; },
  };
  (window as unknown as { __coding: unknown }).__coding = hook;
}

async function saveProgress(kid: M.Kid, level: Level, stars: number, blocks: number): Promise<void> {
  const before = docs.get(kid.id) ?? CM.EMPTY_CODING;
  const done = toast("正在保存…", 0, true);
  try {
    const out = await api.update<CM.CodingDoc>(CM.codingPath(kid.id), CM.EMPTY_CODING, (cur) => CM.applyResult(cur, level.id, stars, blocks), `coding ${kid.id} ${level.id}`);
    docs.set(kid.id, out);
    done();
    toast("已记录进度");
    if (!CM.worldStat(before, level.world).done && CM.worldStat(out, level.world).done) await medalDialog(level.world);
  } catch (e) { done(); throw e; }
}
async function medalDialog(world: number) {
  await modal<boolean>((close) => {
    const art = h("div", { class: "cl-medal-art" });
    art.innerHTML = badgeSvg(world, true);
    return h("div", { class: "dlg cl-medal", id: "cl-medal-dlg" }, h("h2", {}, `获得徽章：${worldName(world)}`), art, h("div", { class: "row end" }, h("button", { class: "primary", id: "cl-medal-ok", onclick: () => close(true) }, "继续")));
  });
}

function levelPage(k: M.Kid, level: Level) {
  const nextId = CM.nextLevelId(level.id);
  const nxt = nextId ? levelById(nextId) : null;
  playScreen({
    kid: k, level, mode: "level", backTo: `#/coding/${k.id}/w${level.world}`, backLabel: "关卡", title: [`${level.world}-${level.no} `, h("span", {}, level.title)],
    won: (stars, blocks) => saveProgress(k, level, stars, blocks),
    next: () => { location.hash = nxt ? `#/coding/${k.id}/w${nxt.world}/${nxt.no}` : `#/coding/${k.id}/w${level.world}`; },
  });
}

let lastKey = "";
function randomPage(k: M.Kid, world: 1 | 2 | 3) {
  const make = () => {
    const c = randomLevel(world, mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0), lastKey);
    lastKey = c.key;
    return c.level;
  };
  const show = () => {
    const level = make();
    playScreen({
      kid: k, level, mode: "random", backTo: `#/coding/${k.id}/w${world}`, backLabel: "关卡", title: [h("span", {}, worldName(world)), " · ", h("span", {}, level.title)],
      won: async () => {
        const done = toast("正在保存…", 0, true);
        try { docs.set(k.id, await api.update<CM.CodingDoc>(CM.codingPath(k.id), CM.EMPTY_CODING, CM.addChallenge, `coding ${k.id} random`)); done(); toast("已记录进度"); } catch (e) { done(); throw e; }
      },
      again: show,
    });
  };
  show();
}

// ---------- free drawing ----------
const FREE: Level = {
  id: "free", world: 6, no: 0, title: "创作", kind: "turtle", palette: ["fd", "tl", "tr", "penup", "pendown", "color", "repeat", "set", "change"], vars: ["n", "m"], solution: "", max: 60, par: 0,
  sol: emptyProgram(), fixed: (() => { const t = makeTurtle(); return { world: t.world, state: t.state, goal: {} }; })(),
};
function freePage(k: M.Kid) {
  playScreen({ kid: k, level: FREE, mode: "free", backTo: `#/coding/${k.id}`, backLabel: "世界", title: [h("span", {}, "创作")] });
}
function saveDrawing(k: M.Kid, prog: Program, after: () => void) {
  if (countBlocks(prog) === 0) return void toast("请先搭一些积木。");
  const l = CM.loadLocal();
  const list = l.drawings[k.id] ?? [];
  if (list.length >= CM.MAX_DRAWINGS) return void toast(`最多保存 ${CM.MAX_DRAWINGS} 幅作品。请先删除一幅。`);
  list.unshift({ id: `d${Date.now()}${Math.floor(Math.random() * 1000)}`, date: M.todayLocal(), prog });
  l.drawings[k.id] = list;
  CM.saveLocal(l);
  toast("已保存到这台设备");
  after();
}
const thumb = (prog: Program): string => {
  const t = makeTurtle();
  const r = new Machine(prog, t.world, t.state, { budget: 20000 }).run();
  const paths = pathsByColor(r.state.segs).map((p) => `<path d="${p.d}" stroke="${colorHex(p.color)}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><rect x="-100" y="-100" width="200" height="200" rx="14" fill="#fffdf5"/>${paths}</svg>`;
};
async function gallery(k: M.Kid, editor: Editor, reset: (u: boolean) => void) {
  await modal<boolean>((close) => {
    const grid = h("div", { class: "cl-gal", id: "cl-gal" });
    const draw = () => {
      const list = CM.loadLocal().drawings[k.id] ?? [];
      grid.replaceChildren(...(list.length ? list.map((d) => {
        const open = h("button", { class: "cl-gal-open", "data-id": d.id, type: "button", "aria-label": "打开作品", onclick: () => { editor.setProgram(cloneProgram(d.prog, true)); reset(false); close(true); toast("已打开作品"); } });
        open.innerHTML = thumb(d.prog);
        return h("div", { class: "cl-gal-item", "data-id": d.id }, open, h("span", { class: "muted small" }, d.date),
          h("button", { class: "danger cl-gal-del", type: "button", "data-id": d.id, onclick: async () => {
            if (!(await confirmDlg("删除这幅作品？", "删除后不能恢复。", "删除", true))) return;
            CM.patchLocal((l) => { l.drawings[k.id] = (l.drawings[k.id] ?? []).filter((x) => x.id !== d.id); });
            toast("已删除"); draw();
          } }, "删除"));
      }) : [h("p", { class: "muted", id: "cl-gal-empty" }, "暂无作品。")]));
    };
    draw();
    return h("div", { class: "dlg cl-gallery-dlg" }, h("h2", {}, "我的作品"), grid, h("div", { class: "row end" }, h("button", { id: "cl-gal-close", onclick: () => close(false) }, "关闭")));
  });
}

void LEVELS; void NS;
