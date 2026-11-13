/**
 * 编程 worlds 7-10: the play screen of the two new kinds of level: "stage" (sprites and events, world 7) and "data" (lists, functions, algorithms: worlds 8-10),
 * and the free stage ("创作": up to 12 stories saved on this device). It has the same parts as the play screen of coding.ts (goal, buttons, hints, stars, answer
 * after three failures) and the same ids, so the styles and the habits of a child are the same. The logic never waits for an animation.
 */
import { h, toast, modal, confirmDlg } from "./ui";
import * as M from "./model";
import type { Ctx } from "./english";
import { Program, cloneProgram, nextHint, toText, countBlocks, parse } from "./coding-ast";
import { Machine, StepInfo, State, cloneState, TPS } from "./coding-interp";
import { Level, evaluate, starsFor } from "./coding-levels";
import * as CM from "./coding-model";
import { createEditor, programEl, Editor } from "./coding-editor";
import { extOf, edOpts, makeRun, dataTarget, testLines, dataInst, DataExt, Ext } from "./coding-levels2";
import { StageRun, StageExt, stageState } from "./coding-stage";
import { stageView, dataView, stackPanel, StageView } from "./coding-views";

export interface Host { X: Ctx; starRow(n: number, cls?: string): HTMLElement; openLesson(id: string): Promise<void>; saveProgress(kid: M.Kid, level: Level, stars: number, blocks: number): Promise<void> }
export interface Play2 {
  kid: M.Kid; level: Level; mode: "level" | "free";
  backTo: string; backLabel: string; title: (Node | string)[];
  next?: () => void;
}
const SPEED = { slow: 900, normal: 450, fast: 140 } as const;
/** milliseconds of one tick of the stage clock for each speed (normal = real time: 20 ticks a second) */
const TICK_MS = { slow: 100, normal: 50, fast: 12 } as const;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const KEY_OF: Record<string, string> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", " ": "space" };

export function play2(host: Host, p: Play2): void {
  const { X } = host, { level, kid } = p;
  const free = p.mode === "free";
  const x = extOf(level) as Ext;
  const isStage = level.kind === "stage";
  const sext: StageExt | undefined = x.stage;
  const dext: DataExt | undefined = x.data;
  const local = CM.loadLocal();
  const btn = (id: string, text: string, onclick: () => void, cls = "") => h("button", { id, class: cls, type: "button", onclick }, text);

  // ----- the view -----
  let sview: StageView | null = null, dview: ReturnType<typeof dataView> | null = null;
  const stack = stackPanel();
  let sceneEl: HTMLElement;
  let renderIdle = () => {};
  if (isStage) {
    sview = stageView(sext!);
    sceneEl = sview.el;
    renderIdle = () => { const s = stageState(sext!); sview!.render(s.stage!, s.vars); };
  } else {
    const inst0 = dataInst(level);
    dview = dataView({
      view: dext!.view, lists: x.lists ?? Object.keys(inst0.lists), target: dext!.view === "calc" || !free ? dataTarget(level) : undefined,
      tests: dext!.view === "calc" ? testLines(level) : undefined, weights: inst0.data?.weights,
    });
    sceneEl = dview.el;
    renderIdle = () => { const { state } = makeRun(level, { main: [], funcs: [] }); dview!.render(state, { steps: 0 }); };
  }
  renderIdle();

  // ----- the editor -----
  let editor!: Editor;
  const codeOn = local.code ?? false;
  const codeEl = h("pre", { class: "cl-code user", id: "cl-code", hidden: !codeOn });
  const showCode = () => { codeEl.textContent = toText(editor.program()) || "// "; };
  const hintClear = () => editor.hint(null);
  editor = createEditor({
    palette: level.palette, funcs: level.funcs, vars: level.vars, conds: level.conds, max: level.max, program: level.givenProg,
    ...edOpts(level), onChange: () => { showCode(); hintClear(); },
  });
  const msg = h("p", { class: "cl-msg", id: "cl-msg", role: "status" });
  const result = h("div", { class: "cl-result", id: "cl-result", hidden: true });
  const setMsg = (t: string, kind = "") => { msg.textContent = t; msg.className = "cl-msg " + kind; };
  const delay = () => SPEED[CM.loadLocal().speed];
  const tickMs = () => TICK_MS[CM.loadLocal().speed];

  // ----- state of a run -----
  let timer = 0, running = false, playing = false, failures = 0, usedAnswer = false, dry: ReturnType<typeof evaluate> | null = null;
  let srun: StageRun | null = null, mach: Machine | null = null, shown = 0, cap = Infinity, stepMode = false, held: string[] = [];
  const ui = {
    run: btn("cl-run", "运行", () => void start(false), "primary"),
    step: btn("cl-step", "单步", () => void start(true)),
    play: btn("cl-play", "试玩", () => togglePlay()),
    stop: btn("cl-stop", "停止", () => reset(true)),
    hint: btn("cl-hint", "提示", () => doHint()),
    answer: btn("cl-answer", "看答案", () => void showAnswer()),
    code: btn("cl-code-btn", codeOn ? "隐藏代码" : "显示代码", () => { const hid = codeEl.hidden; codeEl.hidden = !hid; CM.patchLocal((l) => { l.code = hid; }); ui.code.textContent = hid ? "隐藏代码" : "显示代码"; showCode(); }),
    lesson: h("button", { id: "cl-lesson-btn", class: "cl-round", type: "button", title: "课程", "aria-label": "课程", onclick: () => level.lesson && void host.openLesson(level.lesson) }, "?"),
  };
  ui.answer.hidden = true;
  ui.step.hidden = isStage;
  ui.play.hidden = !isStage;
  const speeds = (["slow", "normal", "fast"] as const).map((s) => h("button", { class: "mopt" + (local.speed === s ? " on" : ""), "data-speed": s, id: `cl-sp-${s}`, type: "button", onclick: () => { CM.patchLocal((l) => { l.speed = s; }); speeds.forEach((b) => b.classList.toggle("on", b.dataset.speed === s)); } }, s === "slow" ? "慢速" : s === "fast" ? "快速" : "中速"));

  function reset(user: boolean) {
    clearTimeout(timer); mach = null; srun = null; running = false; playing = false; dry = null; held = [];
    editor.highlight(null); editor.setLocked(false);
    renderIdle(); stack.render(null);
    ui.run.removeAttribute("disabled"); ui.play.textContent = "试玩";
    if (sview) sview.onTap = null;
    result.hidden = true;
    if (user) setMsg("已停止。");
  }
  const lock = (on: boolean) => { (ui.run as HTMLButtonElement).disabled = on; editor.setLocked(on); };

  // ----- stage: the scripted run and the free play -----
  const stageTime = h("span", { class: "sv-time", id: "sv-time" });
  const showTime = (t: number) => { stageTime.replaceChildren(h("b", {}, (t / TPS).toFixed(1)), " ", h("span", {}, "秒")); };
  showTime(0);
  const paint = () => { if (srun) { sview!.render(srun.state.stage!, srun.state.vars); showTime(srun.tick); } };
  /** a tap / key of the scripted inputs is shown on the stage */
  const showInputs = (tick: number) => {
    for (const i of sext!.inputs.filter((q) => q.tick === tick)) {
      if (i.type === "stagetap") sview!.ripple(i.x, i.y);
      else if (i.type === "tap") { const s = srun!.state.stage!.sprites.find((q) => q.id === i.sprite); if (s) sview!.ripple(s.x, s.y); }
      else { const k = sceneKeys.querySelector<HTMLElement>(`[data-key="${i.key}"]`); k?.classList.add("down"); setTimeout(() => k?.classList.remove("down"), Math.max(250, (i.hold ?? 1) * 50)); }
    }
  };
  function stageTick(): boolean {
    const r = srun!;
    const t = r.tick;
    r.step();
    showInputs(t);
    paint();
    return r.status === "running" && r.tick < sext!.ticks;
  }
  function stageLoop() {
    if (!srun) return;
    if (stageTick()) timer = window.setTimeout(stageLoop, tickMs()); else stageFinish();
  }
  function stageFinish() {
    clearTimeout(timer);
    const prog = editor.program();
    running = false; lock(false);
    if (free) { setMsg(srun!.status === "error" ? srun!.message : ""); return; }
    dry = evaluate(level, prog);
    if (dry.won) return void success();
    setMsg(dry.missing[0] ?? dry.message, "bad");
    failures++; ui.answer.hidden = failures < 3;
  }
  function togglePlay() {
    if (playing) return reset(true);
    if (running) return;
    const prog = editor.program();
    if (countBlocks(prog) === 0) return void setMsg("请先搭一些积木。");
    result.hidden = true; renderIdle();
    srun = new StageRun(prog, sext!, false);
    srun.step();   // tick 0: the "when started" scripts
    playing = true; lock(true); ui.run.setAttribute("disabled", ""); ui.play.textContent = "停止试玩";
    setMsg("试玩：点一点角色或舞台，按一按键盘或下面的按键。");
    sview!.onTap = (inp) => { srun?.inject(inp); if (inp.type === "stagetap") sview!.ripple(inp.x, inp.y); };
    const loop = () => { if (!playing || !srun) return; srun.step(); paint(); if (srun.status === "error") { setMsg(srun.message, "bad"); playing = false; lock(false); ui.run.removeAttribute("disabled"); ui.play.textContent = "试玩"; return; } timer = window.setTimeout(loop, 50); };
    timer = window.setTimeout(loop, 50);
  }
  const keyDown = (k: string) => { if (playing && srun && !held.includes(k)) { held.push(k); srun.press(k); sceneKeys.querySelector(`[data-key="${k}"]`)?.classList.add("down"); } };
  const keyUp = (k: string) => { held = held.filter((q) => q !== k); srun?.release(k); sceneKeys.querySelector(`[data-key="${k}"]`)?.classList.remove("down"); };
  const sceneKeys = h("div", { class: "sv-keys", id: "sv-keys", hidden: !(isStage && sext!.keys) });
  if (isStage && sext!.keys) for (const [k, label] of Object.entries(sext!.keys)) {
    const b = h("button", { class: "sv-key", type: "button", "data-key": k, "aria-label": label }, label);
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); keyDown(k); });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => keyUp(k));
    sceneKeys.append(b);
  }
  const onKeyDown = (e: KeyboardEvent) => { const k = KEY_OF[e.key]; if (k && playing && sext?.keys?.[k] !== undefined) { e.preventDefault(); keyDown(k); } };
  const onKeyUp = (e: KeyboardEvent) => { const k = KEY_OF[e.key]; if (k) keyUp(k); };
  if (isStage) { addEventListener("keydown", onKeyDown); addEventListener("keyup", onKeyUp); }

  // ----- data: the animated run -----
  function dataStart(single: boolean) {
    const prog = editor.program();
    dry = evaluate(level, prog);
    cap = dry.status === "infinite" || dry.status === "budget" ? 80 : Infinity;
    const r = makeRun(level, prog);
    mach = r.machine; shown = 0; running = true; stepMode = single;
    lock(true);
    dview!.render(mach.state, { steps: 0 });
    stack.render(x.recursion || dext!.view === "calc" ? mach : null);
    setMsg(single ? "单步运行：每按一次“单步”执行一块积木。" : "");
    if (single) return void dataTick();
    dataTick();
  }
  function dataTick() {
    if (!mach) return;
    const info: StepInfo | null = mach.step();
    shown++;
    if (info) editor.highlight(info.id);
    dview!.render(mach.state, { steps: mach.steps });
    if (x.recursion || dext!.view === "calc") stack.render(mach);
    if (!info || mach.status !== "running" || shown >= cap) return void dataFinish();
    if (!stepMode) timer = window.setTimeout(dataTick, delay() / 3);
  }
  function dataInstant() {
    if (!mach || !running) return;
    while (mach.status === "running" && shown < cap) { mach.step(); shown++; }
    dview!.render(mach.state, { steps: mach.steps });
    dataFinish();
  }
  function dataFinish() {
    clearTimeout(timer);
    running = false; stepMode = false; editor.highlight(null); lock(false);
    dview!.render(mach!.state, { steps: mach!.steps, done: true });
    if (x.recursion || dext!.view === "calc") stack.render(mach);
    const d = dry!;
    if (d.status === "done" && d.won) return void success();
    setMsg(d.missing[0] ?? d.message, "bad");
    failures++; ui.answer.hidden = failures < 3;
  }

  async function start(single: boolean) {
    if (running && single && mach) return void dataTick();
    if (running || playing) return;
    const prog = editor.program();
    if (countBlocks(prog) === 0) return void setMsg("请先搭一些积木。");
    result.hidden = true;
    if (isStage) {
      renderIdle();
      srun = new StageRun(prog, sext!); running = true; lock(true); setMsg("");
      stageLoop();
    } else dataStart(single);
  }
  /** runs the whole program at once (tests and the hook of coding) */
  function instant() {
    if (isStage) { if (!srun || !running) return; while (stageTick()) { /* all the ticks */ } stageFinish(); } else dataInstant();
  }

  async function success() {
    const blocks = editor.count();
    const stars = usedAnswer ? 1 : starsFor(blocks, level.par);
    setMsg("");
    result.replaceChildren(
      h("div", { class: "cl-res-top" }, host.starRow(stars, "cl-res-stars"), h("b", { id: "cl-res-title" }, "完成。")),
      h("p", { id: "cl-res-text" }, `使用了 ${blocks} 块积木，满分需要 ${level.par} 块以内。`),
      h("p", { class: "muted small", hidden: !usedAnswer }, "看过参考答案，最多得 1 颗星。"),
      h("div", { class: "row end cl-res-btns" },
        btn("cl-again", "再试一次", () => reset(false)),
        p.next ? btn("cl-next", "下一关", () => p.next!(), "primary") : null,
        btn("cl-back-list", "返回", () => (location.hash = p.backTo))));
    result.hidden = false; result.dataset.stars = String(stars);
    try { await host.saveProgress(kid, level, stars, blocks); } catch (e) { toast(errText(e), 6000); }
  }
  function doHint() {
    const h2 = nextHint(editor.program(), level.sol);
    editor.hint(h2);
    if (h2.done) return void setMsg("积木的顺序已经正确。请检查数字和条件。");
    setMsg(h2.wrongId ? "高亮的积木需要修改。" : h2.extraId ? "多了一块积木。" : "请使用高亮的积木。");
  }
  async function showAnswer() {
    const ed = edOpts(level);
    const ok = await modal<boolean>((close) => h("div", { class: "dlg cl-answer", id: "cl-answer-dlg" }, h("h2", {}, "参考答案"),
      h("div", { class: "cl-answer-body" }, programEl(level.sol, { funcs: level.funcs, vars: level.vars, ed })),
      h("p", { class: "muted small" }, "使用参考答案后，这一关最多得 1 颗星。"),
      h("div", { class: "row end" }, h("button", { id: "cl-answer-close", onclick: () => close(false) }, "关闭"), h("button", { class: "primary", id: "cl-answer-use", onclick: () => close(true) }, "使用这个答案"))));
    if (!ok) return;
    usedAnswer = true;
    editor.setProgram(cloneProgram(level.sol, true));
    setMsg("已放入参考答案。");
  }

  // ----- the screen -----
  const goals = x.goal ?? [];
  const info = h("div", { class: "cl-goal", id: "cl-goal" }, ...goals.map((g) => h("p", {}, g)), level.note ? h("p", { class: "cl-note" }, level.note) : null);
  const rows = [h("div", { class: "cl-row" }, ui.run, ui.step, ui.play, ui.stop, ui.hint, ui.answer), h("div", { class: "cl-row" }, h("div", { class: "seg cl-speed", id: "cl-speed" }, ...speeds), ui.code)];
  const extra: HTMLElement[] = [];
  if (free) {
    extra.push(btn("cl-clear", "清空", async () => { if (editor.count() && (await confirmDlg("清空程序？", "所有积木都会被移走。", "清空", true))) { editor.setProgram({ main: [], funcs: [] }); reset(false); toast("已清空"); } }),
      btn("cl-save", "保存", () => saveStory(kid, editor.program())), btn("cl-gallery", "我的作品", () => void storyGallery(kid, editor, reset)));
    rows.push(h("div", { class: "cl-row" }, ...extra));
  }
  const tools = h("div", { class: "cl-tools" }, ...rows);
  const sceneBox = h("div", { class: "cl-scene cl-scene2", id: "cl-scene", "data-kind": level.kind ?? "" }, sceneEl);
  const below: (Node | null)[] = isStage ? [h("div", { class: "sv-bar" }, stageTime, sceneKeys)] : [stack.el];
  const page = h("div", { class: "page cl-page cl-page2", style: `--kid:${kid.color}` },
    h("header", { class: "top hero kid-hero cl-hero" }, X.back(p.backTo, p.backLabel), h("h1", { id: "cl-title" }, ...p.title), level.lesson ? ui.lesson : h("span", { class: "slot" })),
    h("main", { class: "cl-main", id: "cl-main" },
      h("section", { class: "cl-left" }, sceneBox, ...below, info, msg, tools, result),
      h("section", { class: "cl-right" }, editor.el, codeEl)));
  X.show(page);
  showCode();
  if (level.lesson && !CM.loadLocal().seen.includes(level.lesson) && !free) void host.openLesson(level.lesson);
  // when the page is left, the key listeners go too
  const off = () => { removeEventListener("keydown", onKeyDown); removeEventListener("keyup", onKeyUp); removeEventListener("hashchange", off); clearTimeout(timer); };
  addEventListener("hashchange", off);

  // the hook for tests
  const hook = {
    get level() { return level; },
    get editor() { return editor; },
    get state(): State { return cloneState(mach?.state ?? srun?.state ?? (isStage ? stageState(sext!) : makeRun(level, { main: [], funcs: [] }).state)); },
    get run() { return srun; },
    get machine() { return mach; },
    get view() { return sview ?? dview; },
    set(src: Program | string) { const prog = typeof src === "string" ? parse(src) : src; editor.setProgram(cloneProgram(prog, true)); return prog; },
    eval(src: Program | string) { const prog = hook.set(src); return free ? null : evaluate(level, prog); },
    runUI(src?: Program | string) { if (src !== undefined) hook.set(src); reset(false); void start(false).then(() => instant()); },
    step() { if (!running) void start(true); else dataTick(); return mach?.status ?? null; },
    get status() { return mach?.status ?? srun?.status ?? null; },
  };
  (window as unknown as { __coding: unknown }).__coding = hook;
}

// ---------- the free stage (创作): up to 12 stories on this device ----------
const STORY_KEY = "learn.coding.stories.v1";
export const MAX_STORIES = 12;
interface Story { id: string; date: string; prog: Program }
const loadStories = (): Record<string, Story[]> => { try { const j = JSON.parse(localStorage.getItem(STORY_KEY) ?? "{}"); return j && typeof j === "object" ? j : {}; } catch { return {}; } };
const saveStories = (s: Record<string, Story[]>) => { try { localStorage.setItem(STORY_KEY, JSON.stringify(s)); } catch { /* private window */ } };
export const storyCount = (kidId: string): number => (loadStories()[kidId] ?? []).length;
function saveStory(k: M.Kid, prog: Program) {
  if (countBlocks(prog) === 0) return void toast("请先搭一些积木。");
  const all = loadStories(), list = all[k.id] ?? [];
  if (list.length >= MAX_STORIES) return void toast(`最多保存 ${MAX_STORIES} 个作品。请先删除一个。`);
  list.unshift({ id: `s${Date.now()}${Math.floor(Math.random() * 1000)}`, date: M.todayLocal(), prog });
  all[k.id] = list; saveStories(all);
  toast("已保存到这台设备");
}
async function storyGallery(k: M.Kid, editor: Editor, reset: (u: boolean) => void) {
  await modal<boolean>((close) => {
    const grid = h("div", { class: "cl-gal", id: "cl-gal" });
    const draw = () => {
      const list = loadStories()[k.id] ?? [];
      grid.replaceChildren(...(list.length ? list.map((d, i) => h("div", { class: "cl-gal-item", "data-id": d.id },
        h("button", { class: "cl-gal-open story", "data-id": d.id, type: "button", "aria-label": "打开作品", onclick: () => { editor.setProgram(cloneProgram(d.prog, true)); reset(false); close(true); toast("已打开作品"); } }, h("b", {}, String(list.length - i)), h("span", { class: "muted small" }, `${countBlocks(d.prog)}`)),
        h("span", { class: "muted small" }, d.date),
        h("button", { class: "danger cl-gal-del", type: "button", "data-id": d.id, onclick: async () => {
          if (!(await confirmDlg("删除这个作品？", "删除后不能恢复。", "删除", true))) return;
          const all = loadStories(); all[k.id] = (all[k.id] ?? []).filter((x) => x.id !== d.id); saveStories(all);
          toast("已删除"); draw();
        } }, "删除"))) : [h("p", { class: "muted", id: "cl-gal-empty" }, "暂无作品。")]));
    };
    draw();
    return h("div", { class: "dlg cl-gallery-dlg" }, h("h2", {}, "我的作品"), grid, h("div", { class: "row end" }, h("button", { id: "cl-gal-close", onclick: () => close(false) }, "关闭")));
  });
}
/** the level object of the free stage (not in the list of levels) */
export function freeStageLevel(): Level {
  const msgs = { m1: "消息一", m2: "消息二" };
  const ev = ["start", "tap", "stagetap", "key(left)", "key(right)", "key(up)", "key(down)", "key(space)", "recv(m1)", "recv(m2)"];
  const texts = { hi: "你好！", bye: "再见！", meow: "喵！", wow: "真好玩！", q1: "你喜欢苹果吗？", a1: "喜欢！", ok: "答对了！", no: "再想想。" };
  const sprites = [{ id: "cat", art: "cat", x: -80, y: -30, label: "小猫" }, { id: "dog", art: "dog", x: 80, y: -30, label: "小狗" }, { id: "bird", art: "bird", x: 0, y: 40, label: "小鸟" }];
  const stage: StageExt = {
    sprites, slots: sprites.flatMap((s) => [0, 1].map(() => ({ sprite: s.id, on: "start", events: ev }))), inputs: [], ticks: 400, checks: [], texts, msgs, vars: ["score"], free: true,
    keys: { left: "←", right: "→", up: "↑", down: "↓", space: "空格" },
  };
  const ext: Ext = { free: true, rep: ["keyDown", "touching", "rand", "tapX", "tapY"], stage, goal: ["自由创作：搭出自己的动画、故事或游戏。", "点“试玩”可以点一点角色、按键。"] };
  const palette = ["smove", "sturn", "goto", "changex", "changey", "say", "sayfor", "costume", "nextcostume", "size", "show", "hide", "note", "broadcast", "repeat", "forever", "if", "ifelse", "wait", "waitUntil", "set", "change"] as Level["palette"];
  return { id: "free2", world: 7, no: 0, title: "创作", kind: "stage", palette, vars: ["score"], solution: "", max: 80, par: 0, sol: { main: [], funcs: [] }, ext } as Level;
}
void dataInst;
