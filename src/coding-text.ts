/**
 * 编程, text coding: the SCREENS of worlds 11-13 (文字编程入门, 函数与列表, 算法与小项目) and the free workshop (代码工坊).
 * Routes (under #/coding/<kid>/): w11 w12 w13 = the levels of a world, w11/3 = a level, code = the workshop. The section on the world map is made by `textSection`.
 * Pure parts: coding-textlang.ts (lexer, parser), coding-textrun.ts (interpreter), coding-textlevels.ts (levels), coding-textjudge.ts (judging, stars),
 * coding-textbridge.ts (blocks -> Python), coding-texteditor.ts (the editor), coding-textlessons.ts (mini-lessons).
 * Progress = `coding/<kid>.json` (the same file as the block worlds: stars and the size of the best program per level id t11-01 ...). Snippets, drafts,
 * lessons seen stay on this device (`learn.codingtext.v1`).
 */
import { h, toast, modal, confirmDlg, askText } from "./ui";
import * as M from "./model";
import * as api from "./api";
import { shortcuts } from "./hub";
import type { Ctx } from "./english";
import * as CM from "./coding-model";
import { TLevel, TEXT_WORLDS, levelsOfText, textLevelById } from "./coding-textlevels";
import { judge, parOf, starsFor, countTokens, Judgement, CaseResult, expectedOutput } from "./coding-textjudge";
import { run, RunResult, turtleColorHex } from "./coding-textrun";
import { KIND_NAME } from "./coding-textlang";
import { createCodeEditor, CodeEditor, highlightHtml } from "./coding-texteditor";
import { TLESSONS, TEMPLATES } from "./coding-textlessons";
import { blocksToPython } from "./coding-textbridge";
import { parse as parseBlocks } from "./coding-ast";
import { programEl } from "./coding-editor";
import type { Seg } from "./coding-interp";

let X!: Ctx;
export const initText = (c: Ctx) => { X = c; };
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const WCOLOR: Record<number, string> = { 11: "#0c8599", 12: "#4263eb", 13: "#d6336c" };
const WLIGHT: Record<number, string> = { 11: "#66d9e8", 12: "#91a7ff", 13: "#faa2c1" };
const WNAME = (w: number) => TEXT_WORLDS.find((x) => x.id === w)?.name ?? "";

// ---------- this device ----------
export interface Snippet { id: string; name: string; code: string; input: string; date: string }
interface TLocal { seen: string[]; drafts: Record<string, string>; snippets: Record<string, Snippet[]>; ws: Record<string, { code: string; input: string }> }
const KEY = "learn.codingtext.v1";
export const MAX_SNIPPETS = 20;
export function loadTLocal(): TLocal {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { seen: Array.isArray(j.seen) ? j.seen : [], drafts: j.drafts && typeof j.drafts === "object" ? j.drafts : {}, snippets: j.snippets && typeof j.snippets === "object" ? j.snippets : {}, ws: j.ws && typeof j.ws === "object" ? j.ws : {} };
  } catch { return { seen: [], drafts: {}, snippets: {}, ws: {} }; }
}
function patchTLocal(f: (l: TLocal) => void): TLocal { const l = loadTLocal(); f(l); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private window */ } return l; }

// ---------- small pieces ----------
const starSvg = (on: boolean) => `<svg viewBox="-14 -14 28 28" aria-hidden="true" focusable="false"><path d="M0-12l3.600 7.500 8.200 1.200-6 5.800 1.400 8.200L0 7l-7.200 3.700 1.400-8.200-6-5.800 8.200-1.200z" fill="${on ? "#ffd43b" : "#e9ecef"}" stroke="${on ? "#f59f00" : "#ced4da"}" stroke-width="2" stroke-linejoin="round"/></svg>`;
const starRow = (n: number, cls = "cl-stars") => { const s = h("span", { class: cls, "data-stars": String(n), role: "img", "aria-label": `${n} / 3` }); s.innerHTML = [1, 2, 3].map((i) => starSvg(i <= n)).join(""); return s; };
const worldStat = (doc: CM.CodingDoc, w: number) => {
  const ls = levelsOfText(w);
  const stars = ls.reduce((n, l) => n + (doc.stars?.[l.id] ?? 0), 0), solved = ls.filter((l) => (doc.stars?.[l.id] ?? 0) > 0).length;
  return { stars, max: ls.length * 3, solved, total: ls.length, done: solved === ls.length };
};
const EMB: Record<number, string> = { 11: ">_", 12: "f(x)", 13: "O(n)" };
const emblem = (w: number, got = true, size = 64) => {
  const c = got ? WCOLOR[w] : "#ced4da";
  const s = h("span", { class: "tx-emb", "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 80 80" width="${size}" height="${size}" focusable="false"><circle cx="40" cy="40" r="34" fill="${c}" stroke="#fff" stroke-width="4"/><circle cx="40" cy="40" r="34" fill="${WLIGHT[w]}" opacity=".25"/><text x="40" y="49" font-size="${EMB[w].length > 3 ? 20 : 26}" text-anchor="middle" font-weight="900" fill="#fff" font-family="ui-monospace, Menlo, Consolas, monospace">${EMB[w]}</text></svg>`;
  return s;
};
const kidHero = (k: M.Kid, back: string, label: string, title: Node | string, extra?: HTMLElement) =>
  h("header", { class: "top hero kid-hero" }, X.back(back, label), h("h1", {}, title), extra ?? shortcuts(k.id, "coding"));

// ---------- the section of the world map ----------
export function textSection(k: M.Kid, doc: CM.CodingDoc): HTMLElement {
  const cards = TEXT_WORLDS.map((w) => {
    const st = worldStat(doc, w.id);
    const a = h("a", { class: "tx-island" + (st.done ? " done" : ""), href: `#/coding/${k.id}/w${w.id}`, "data-world": String(w.id), style: `--wc:${WCOLOR[w.id]}` },
      emblem(w.id, true, 56),
      h("span", { class: "tx-isl-info" }, h("span", { class: "tx-isl-no" }, `第 ${w.id} 个世界`), h("b", { class: "tx-isl-name" }, w.name), h("span", { class: "tx-isl-sub" }, w.sub),
        h("span", { class: "tx-isl-stars" }, `★ ${st.stars} / ${st.max}`, " · ", `${st.solved} / ${st.total}`)));
    return a;
  });
  cards.push(h("a", { class: "tx-island tx-ws", id: "tx-workshop", href: `#/coding/${k.id}/code`, style: "--wc:#e8590c" },
    h("span", { class: "tx-emb", "aria-hidden": "true" }), h("span", { class: "tx-isl-info" }, h("span", { class: "tx-isl-no" }, "自由编写"), h("b", { class: "tx-isl-name" }, "代码工坊"), h("span", { class: "tx-isl-sub" }, `${(loadTLocal().snippets[k.id] ?? []).length} / ${MAX_SNIPPETS}`))));
  const ws = cards[cards.length - 1].querySelector(".tx-emb") as HTMLElement;
  ws.innerHTML = `<svg viewBox="0 0 80 80" width="56" height="56" focusable="false"><circle cx="40" cy="40" r="34" fill="#e8590c" stroke="#fff" stroke-width="4"/><text x="40" y="50" font-size="26" text-anchor="middle" font-weight="900" fill="#fff" font-family="ui-monospace, Menlo, Consolas, monospace">{ }</text></svg>`;
  return h("section", { class: "tx-section", id: "tx-section" },
    h("h2", { class: "tx-sec-title" }, "文字编程"), h("p", { class: "tx-sec-sub muted" }, "从积木走向真正的代码（Python 入门）"), h("div", { class: "tx-islands" }, ...cards));
}

// ---------- routes ----------
export function renderText(k: M.Kid, doc: CM.CodingDoc, rest: string): boolean {
  let m: RegExpExecArray | null;
  if ((m = /^w(1[1-3])$/.exec(rest))) { worldPage(k, doc, Number(m[1])); return true; }
  if ((m = /^w(1[1-3])\/(\d+)$/.exec(rest))) {
    const [w, no] = [Number(m[1]), Number(m[2])];
    const lv = levelsOfText(w).find((l) => l.no === no);
    if (lv) { levelPage(k, doc, lv); return true; }
    return false;
  }
  if (rest === "code") { workshopPage(k); return true; }
  return false;
}

function worldPage(k: M.Kid, doc: CM.CodingDoc, world: number) {
  const st = worldStat(doc, world);
  const grid = h("div", { class: "cl-levels tx-levels" });
  for (const l of levelsOfText(world)) {
    const s = doc.stars?.[l.id] ?? 0;
    grid.append(h("a", { class: "cl-lvl tx-lvl" + (l.boss ? " boss" : "") + (l.kind === "debug" ? " debug" : "") + (s ? " solved" : ""), href: `#/coding/${k.id}/w${world}/${l.no}`, "data-level": l.id, "data-stars": String(s), style: `--wc:${WCOLOR[world]}` },
      h("span", { class: "lvl-no" }, String(l.no)), starRow(s, "lvl-stars"), h("span", { class: "lvl-title user" }, l.title),
      l.boss ? h("span", { class: "lvl-tag" }, "挑战") : l.kind === "debug" ? h("span", { class: "lvl-tag" }, "找错误") : l.kind === "draw" ? h("span", { class: "lvl-tag draw" }, "画图") : null));
  }
  X.stagger([...grid.querySelectorAll<HTMLElement>(".cl-lvl")]);
  const first = levelsOfText(world)[0].lesson;
  const tools = h("div", { class: "cl-wtools" }, world === 11 ? h("button", { id: "tx-world-lesson", onclick: () => void openTextLesson("bridge") }, "先拼积木，再看代码") : null,
    first ? h("button", { id: "tx-first-lesson", onclick: () => void openTextLesson(first) }, "课程") : null);
  const medal = h("span", { class: "tx-medal" + (st.done ? " got" : ""), id: "tx-medal" }, emblem(world, st.done, 52));
  X.show(h("div", { class: "page", style: `--kid:${k.color}` }, kidHero(k, `#/coding/${k.id}`, "世界", WNAME(world)),
    h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow" },
      h("div", { class: "cl-wsum" }, medal, h("div", {}, h("b", { id: "tx-wstars" }, `★ ${st.stars} / ${st.max}`), h("span", { class: "muted" }, ` · ${st.solved} / ${st.total}`)), tools),
      grid))));
  // the first time the child opens world 11: "build with blocks first, then read the code"
  if (world === 11 && !loadTLocal().seen.includes("bridge")) void openTextLesson("bridge");
}

// ---------- mini-lessons ----------
export async function openTextLesson(id: string): Promise<void> {
  const les = TLESSONS[id];
  if (!les) return;
  await modal<boolean>((close) => {
    let i = 0;
    const text = h("p", { class: "cl-lesson-text user", id: "tx-lesson-text" });
    const blocksBox = h("div", { class: "tx-lesson-blocks user", id: "tx-lesson-blocks" });
    const out = h("pre", { class: "tx-console user", id: "tx-lesson-out" });
    const inputEl = h("textarea", { class: "tx-input", id: "tx-lesson-input", rows: 2, "aria-label": "输入" }) as HTMLTextAreaElement;
    inputEl.spellcheck = false;
    const ed = createCodeEditor({ id: "tx-lesson-ta", toolbar: false, label: "代码", onRun: () => tryIt() });
    const dots = h("div", { class: "cl-dots" });
    const prev = h("button", { id: "tx-lesson-prev", onclick: () => show(i - 1) }, "上一步");
    const next = h("button", { class: "primary", id: "tx-lesson-next", onclick: () => (i >= les.steps.length - 1 ? close(true) : show(i + 1)) }, "下一步");
    const tryBtn = h("button", { id: "tx-lesson-try", onclick: () => tryIt() }, "试一试");
    const tryIt = () => { const r = run(ed.value(), { input: inputEl.value }); ed.setError(r.error?.line ?? null); out.textContent = r.error ? `${r.stdout}${r.error.message}${r.error.hint ? "\n" + r.error.hint : ""}` : r.stdout || "（没有输出）"; out.classList.toggle("bad", !!r.error); };
    const show = (n: number) => {
      i = Math.max(0, Math.min(les.steps.length - 1, n));
      const s = les.steps[i];
      text.textContent = s.text;
      blocksBox.replaceChildren();
      let code = s.code;
      if (s.blocks) { const prog = parseBlocks(s.blocks); blocksBox.append(programEl(prog)); if (!code) code = blocksToPython(prog).code; }
      blocksBox.hidden = !s.blocks;
      ed.setValue(code); inputEl.value = s.input ?? ""; out.textContent = ""; out.classList.remove("bad");
      inputEl.hidden = s.input === undefined; ed.el.hidden = !code;
      tryBtn.hidden = !code;
      dots.replaceChildren(...les.steps.map((_, j) => h("i", { class: j === i ? "on" : "" })));
      (prev as HTMLButtonElement).disabled = i === 0;
      next.textContent = i >= les.steps.length - 1 ? "完成" : "下一步";
    };
    show(0);
    return h("div", { class: "dlg cl-lesson tx-lesson", id: "tx-lesson" }, h("h2", { class: "user" }, les.title), text, blocksBox, ed.el, inputEl, h("div", { class: "row" }, tryBtn), out, dots,
      h("div", { class: "row end" }, h("button", { id: "tx-lesson-close", onclick: () => close(true) }, "关闭"), prev, next));
  });
  patchTLocal((l) => { if (!l.seen.includes(id)) l.seen.push(id); });
}

// ---------- the turtle drawing ----------
const pathsBy = (segs: Seg[]) => {
  const by = new Map<string, string>(); const r = (v: number) => Math.round(v * 100) / 100;
  for (const s of segs) by.set(s.c, (by.get(s.c) ?? "") + `M${r(s.x1)} ${r(s.y1)}L${r(s.x2)} ${r(s.y2)}`);
  return [...by.entries()].map(([color, d]) => ({ color, d }));
};
export function drawingSvg(segs: Seg[], fills: RunResult["fills"] = [], ghost: Seg[] = []): string {
  const grid = [-100, -50, 0, 50, 100].map((v) => `<path d="M${v} -100V100M-100 ${v}H100" stroke="${v === 0 ? "#ced4da" : "#e9ecef"}" stroke-width="${v === 0 ? 1.2 : 1}"/>`).join("");
  const g = ghost.length ? `<g stroke="#adb5bd" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".45"><path d="${ghost.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join("")}"/></g>` : "";
  const f = fills.map((p) => `<path d="M${p.pts.map((q) => `${q[0]} ${q[1]}`).join("L")}Z" fill="${turtleColorHex(p.c)}" opacity=".45" stroke="none"/>`).join("");
  const paths = pathsBy(segs).map((p) => `<path d="${p.d}" stroke="${turtleColorHex(p.color)}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><rect x="-100" y="-100" width="200" height="200" rx="10" fill="#fffdf5"/>${grid}${g}${f}${paths}</svg>`;
}

// ---------- the run / step panel shared by the levels and the workshop ----------
interface Panel {
  el: HTMLElement; editor: CodeEditor;
  /** runs with the input of the box, shows output / error / drawing */
  runNow(): RunResult;
  input(): string; setInput(s: string): void;
  clearOutput(): void;
  showJudge(j: Judgement | null, level?: TLevel): void;
  stepStart(): void; stepStop(): void;
  stepping(): boolean;
  setGhost(g: Seg[]): void;
  buttons: HTMLElement;
}
function makePanel(o: { initial: string; input: string; showInput: boolean; extraButtons: HTMLElement[]; draw: boolean; ghost?: Seg[]; budget?: number; onCode?: (c: string) => void; onSubmit?: () => void; onRun?: () => void }): Panel {
  let ghost: Seg[] = o.ghost ?? [];
  const editor = createCodeEditor({ value: o.initial, onRun: () => runNow(), onChange: (v) => o.onCode?.(v) });
  const inputEl = h("textarea", { class: "tx-input", id: "tx-input", rows: 2, "aria-label": "输入", placeholder: "每行对应一次 input()" }) as HTMLTextAreaElement;
  inputEl.spellcheck = false; inputEl.value = o.input;
  const inputBox = h("label", { class: "tx-field", hidden: !o.showInput }, h("span", { class: "tx-label" }, "输入"), inputEl);
  const out = h("pre", { class: "tx-console user", id: "tx-out", "aria-live": "polite" });
  const errBox = h("div", { class: "tx-error", id: "tx-error", hidden: true, role: "alert" });
  const canvas = h("div", { class: "tx-canvas", id: "tx-canvas", hidden: !o.draw });
  const outBox = h("div", { class: "tx-outbox" }, h("span", { class: "tx-label" }, "输出"), out, errBox);
  const result = h("div", { class: "tx-result", id: "tx-result", hidden: true });
  const watch = h("div", { class: "tx-watch", id: "tx-watch", hidden: true });
  const stepbar = h("div", { class: "tx-stepbar", id: "tx-stepbar", hidden: true });
  const btns = h("div", { class: "tx-btns", id: "tx-btns" });
  btns.append(...o.extraButtons);

  const showError = (e: RunResult["error"]) => {
    editor.setError(e?.line ?? null);
    errBox.hidden = !e;
    if (!e) return;
    errBox.replaceChildren(h("b", { class: "tx-err-kind" }, KIND_NAME[e.kind]), h("p", { class: "tx-err-msg user" }, e.message), ...(e.hint ? [h("p", { class: "tx-err-hint user" }, e.hint)] : []));
  };
  const draw = (r: RunResult | null) => { if (!o.draw) return; canvas.innerHTML = drawingSvg(r?.segs ?? [], r?.fills ?? [], ghost); };
  draw(null);
  const clearOutput = () => { out.textContent = ""; showError(null); result.hidden = true; if (o.draw) draw(null); };
  function runNow(): RunResult {
    if (stepping()) stepStop();
    const code = editor.value();
    const r = run(code, { input: inputEl.value, budget: o.budget ?? 400_000, seed: 1 });
    out.textContent = r.stdout || (r.error ? "" : o.draw ? "" : "（没有输出）");
    out.classList.toggle("tx-none", !r.stdout);
    showError(r.error);
    draw(r);
    o.onRun?.();
    return r;
  }

  // ----- stepping -----
  let trace: RunResult | null = null, idx = 0, timer = 0;
  const stepping = () => trace !== null;
  const showStep = () => {
    if (!trace) return;
    const ev = trace.trace[idx];
    const n = trace.trace.length;
    stepbar.querySelector<HTMLElement>("#tx-stepinfo")!.textContent = `步骤 ${Math.min(idx + 1, n)} / ${n}`;
    (stepbar.querySelector("#tx-step-prev") as HTMLButtonElement).disabled = idx <= 0;
    (stepbar.querySelector("#tx-step-next") as HTMLButtonElement).disabled = idx >= n - 1 && true;
    if (!ev) return;
    editor.setCurrent(ev.line);
    out.textContent = trace.stdout.slice(0, ev.out);
    watch.replaceChildren(h("b", { class: "tx-label" }, "变量"), h("div", { class: "tx-watch-line" }, `第 ${ev.line} 行`));
    for (const sc of ev.scopes) {
      const rows = sc.vars;
      watch.append(h("div", { class: "tx-scope" }, h("span", { class: "tx-scope-name user" }, sc.name),
        rows.length ? h("table", { class: "tx-vars user" }, ...rows.map(([name, v]) => h("tr", {}, h("th", {}, name), h("td", {}, v)))) : h("span", { class: "muted small" }, "没有变量")));
    }
    if (idx >= n - 1) { if (trace.error) { out.textContent = trace.stdout; showError(trace.error); } else out.textContent = trace.stdout; }
  };
  const stepTo = (i: number) => { if (!trace) return; idx = Math.max(0, Math.min(trace.trace.length - 1, i)); showStep(); };
  const stopPlay = () => { clearInterval(timer); timer = 0; const pb = stepbar.querySelector("#tx-step-play"); if (pb) pb.textContent = "自动播放"; };
  const playBtn = h("button", { id: "tx-step-play", type: "button", onclick: () => { if (timer) return stopPlay(); (playBtn as HTMLElement).textContent = "暂停"; timer = window.setInterval(() => { if (!trace || idx >= trace.trace.length - 1) return stopPlay(); stepTo(idx + 1); }, 450); } }, "自动播放");
  stepbar.append(h("button", { id: "tx-step-prev", type: "button", onclick: () => { stopPlay(); stepTo(idx - 1); } }, "上一步"), h("button", { id: "tx-step-next", type: "button", class: "primary", onclick: () => { stopPlay(); stepTo(idx + 1); } }, "下一步"),
    playBtn, h("button", { id: "tx-step-stop", type: "button", onclick: () => stepStop() }, "停止"), h("span", { class: "tx-stepinfo muted", id: "tx-stepinfo" }));
  function stepStart() {
    const code = editor.value();
    const r = run(code, { input: inputEl.value, trace: true, budget: o.budget ?? 400_000 });
    if (r.error && !r.trace.length) { out.textContent = ""; showError(r.error); return; }
    clearOutput();
    trace = r; idx = 0;
    editor.setReadOnly(true); stepbar.hidden = false; watch.hidden = false;
    if (r.traceCut) toast("步数很多，只记录了前 2500 步。");
    showStep();
  }
  function stepStop() {
    stopPlay(); trace = null; stepbar.hidden = true; watch.hidden = true; editor.setCurrent(null); editor.setReadOnly(false); out.textContent = ""; showError(null);
  }
  const showJudge = (j: Judgement | null, level?: TLevel) => {
    if (!j) { result.hidden = true; return; }
    result.hidden = false; result.dataset.passed = j.passed ? "1" : "0";
    const n = j.cases.length, ok = j.cases.filter((c) => c.ok).length;
    const chips = h("div", { class: "tx-chips", id: "tx-chips" }, ...j.cases.map((c) => h("span", { class: "tx-chip " + (c.ok ? "ok" : "bad"), "data-case": String(c.index), title: c.ok ? "通过" : "未通过", "aria-label": c.ok ? "通过" : "未通过" }, c.ok ? "✓" : "✗")));
    const head = j.passed ? h("b", { class: "tx-res-title ok" }, "全部通过。") : h("b", { class: "tx-res-title bad" }, j.first ? `第 ${j.first.index + 1} 组测试没有通过。` : "还有要求没有满足。");
    result.replaceChildren(head, h("span", { class: "muted tx-res-count" }, `${ok} / ${n}`), chips);
    if (j.rule) result.append(h("p", { class: "tx-rule user" }, j.rule));
    const f = j.first;
    if (f) result.append(caseDetail(f, level));
  };
  function caseDetail(f: CaseResult, level?: TLevel): HTMLElement {
    const draw2 = level?.kind === "draw";
    const box = h("div", { class: "tx-case", id: "tx-case" });
    if (f.call) box.append(h("div", { class: "tx-case-row" }, h("span", { class: "tx-label" }, "测试代码"), h("pre", { class: "user tx-pre" }, f.call)));
    if (f.input) box.append(h("div", { class: "tx-case-row" }, h("span", { class: "tx-label" }, "输入"), h("pre", { class: "user tx-pre" }, f.input.length > 300 ? f.input.slice(0, 300) + " …" : f.input)));
    if (f.error) { box.append(h("div", { class: "tx-case-row" }, h("span", { class: "tx-label" }, f.reason === "budget" ? "运行步数超过了限制" : "程序出错了"), h("pre", { class: "user tx-pre bad" }, f.reason === "budget" ? `${f.error.message}\n${level?.budget ? `限制：${level.budget} 步。请想一个更高效的办法。` : ""}` : `${f.error.message}${f.error.hint ? "\n" + f.error.hint : ""}`))); showError(f.error); }
    else if (draw2) {
      box.append(h("p", { class: "muted small tx-draw-note" }, "你的图形和要求的图形不一样（灰色的是要求的图形）。"));
      if (level) { const refSegs = run(f.call ? level.ref.replace(/\s+$/, "") + "\n" + f.call + "\n" : level.ref).segs; const c = h("div", { class: "tx-canvas small" }); const mine = run(editor.value().replace(/\s+$/, "") + (f.call ? "\n" + f.call + "\n" : "\n")); c.innerHTML = drawingSvg(mine.segs, mine.fills, refSegs); box.append(c); }
    } else {
      const lim = (s: string) => (s.length > 600 ? s.slice(0, 600) + " …" : s);
      box.append(h("div", { class: "tx-case-row" }, h("span", { class: "tx-label" }, "期望的输出"), h("pre", { class: "user tx-pre exp" }, lim(f.expected) || "（空）")),
        h("div", { class: "tx-case-row" }, h("span", { class: "tx-label" }, "你的输出"), h("pre", { class: "user tx-pre got" }, lim(f.got) || "（空）")));
    }
    return box;
  }
  const el = h("div", { class: "tx-panel" }, editor.el, btns, stepbar, inputBox, ...(o.draw ? [canvas] : []), outBox, watch, result);
  return {
    el, editor, runNow, input: () => inputEl.value, setInput: (s) => { inputEl.value = s; }, clearOutput, showJudge, stepStart, stepStop, stepping,
    setGhost: (g) => { ghost = g; draw(null); }, buttons: btns,
  };
}

// ---------- a level ----------
async function saveProgress(kid: M.Kid, level: TLevel, stars: number, tokens: number, before: CM.CodingDoc): Promise<CM.CodingDoc> {
  const done = toast("正在保存…", 0, true);
  try {
    const out = await api.update<CM.CodingDoc>(CM.codingPath(kid.id), CM.EMPTY_CODING, (cur) => CM.applyResult(cur, level.id, stars, tokens), `coding ${kid.id} ${level.id}`);
    done(); toast("已记录进度");
    if (!worldStat(before, level.world).done && worldStat(out, level.world).done) await medalDialog(level.world);
    return out;
  } catch (e) { done(); throw e; }
}
async function medalDialog(world: number) {
  await modal<boolean>((close) => h("div", { class: "dlg cl-medal", id: "cl-medal-dlg" }, h("h2", {}, `获得徽章：${WNAME(world)}`), h("div", { class: "cl-medal-art" }, emblem(world, true, 120)),
    h("div", { class: "row end" }, h("button", { class: "primary", id: "cl-medal-ok", onclick: () => close(true) }, "继续"))));
}

function levelPage(k: M.Kid, docIn: CM.CodingDoc, level: TLevel) {
  let doc = docIn;
  const local = loadTLocal();
  const draftKey = `${k.id}:${level.id}`;
  const par = parOf(level);
  const ls = levelsOfText(level.world);
  const nextLevel = ls[ls.findIndex((l) => l.id === level.id) + 1];
  let fails = 0, submits = 0, usedAnswer = false, hintN = 0, solvedNow = false;
  const draftValid = typeof local.drafts[draftKey] === "string";
  const refSegs: Seg[] = level.kind === "draw" ? run(level.ref + (level.cases[0].call ? "\n" + level.cases[0].call + "\n" : "\n")).segs : [];
  const example = level.cases[0];
  const exampleOut = level.kind === "draw" ? "" : expectedOutput(level, 0);
  const msg = h("p", { class: "cl-msg", id: "tx-msg", role: "status" });
  const answerBtn = h("button", { id: "tx-answer", type: "button", hidden: true, onclick: () => void showAnswer() }, "看答案");
  const hintBtn = h("button", { id: "tx-hint", type: "button", onclick: () => nextHint() }, "提示");
  const b = (id: string, text: string, onclick: () => void, cls = "") => h("button", { id, class: cls, type: "button", onclick }, text);
  const panel: Panel = makePanel({
    initial: draftValid ? local.drafts[draftKey] : level.starter, input: example.input ?? "", showInput: level.cases.some((c) => c.input !== undefined), draw: level.kind === "draw", ghost: refSegs, budget: level.budget,
    onCode: (c) => patchTLocal((l) => { l.drafts[draftKey] = c; }),
    extraButtons: [b("tx-run", "运行", () => void doRun(), "primary"), b("tx-submit", "提交", () => void doSubmit(), "primary"), b("tx-step", "单步", () => panel.stepping() ? panel.stepStop() : panel.stepStart()), hintBtn, answerBtn, b("tx-reset", "重置", () => void doReset())],
  });
  const hintsBox = h("div", { class: "tx-hints user", id: "tx-hints", hidden: true });
  const doRun = () => { msg.textContent = ""; panel.showJudge(null); panel.runNow(); };
  function doSubmit() {
    if (panel.stepping()) panel.stepStop();
    panel.runNow();
    const code = panel.editor.value();
    const j = judge(level, code);
    submits++;
    panel.showJudge(j, level);
    if (!j.passed) { fails++; answerBtn.hidden = fails < 3; msg.textContent = ""; return; }
    const tokens = j.tokens;
    const stars = starsFor(tokens, par, submits === 1, usedAnswer);
    solvedNow = true;
    const res = panel.el.querySelector("#tx-result") as HTMLElement;
    res.dataset.stars = String(stars);
    res.append(h("div", { class: "cl-res-top" }, starRow(stars, "cl-res-stars")),
      h("p", { id: "tx-res-text" }, `代码长度：${tokens}（满分需要不超过 ${Math.ceil(par * 1.6)}，参考答案 ${par}）`),
      h("p", { class: "muted small", hidden: !usedAnswer }, "看过参考答案，最多得 1 颗星。"),
      h("div", { class: "row end cl-res-btns" }, b("tx-again", "再试一次", () => { panel.showJudge(null); }), nextLevel ? b("tx-next", "下一关", () => (location.hash = `#/coding/${k.id}/w${nextLevel.world}/${nextLevel.no}`), "primary") : null, b("tx-back-list", "返回", () => (location.hash = `#/coding/${k.id}/w${level.world}`))));
    void saveProgress(k, level, stars, tokens, doc).then((d) => { doc = d; }).catch((e) => toast(errText(e), 6000));
  }
  async function doReset() {
    if (panel.editor.value() !== level.starter && !(await confirmDlg("重置代码？", "你写的代码会被换成这一关开始时的代码。", "重置", true))) return;
    panel.editor.setValue(level.starter); patchTLocal((l) => { delete l.drafts[draftKey]; }); panel.clearOutput(); panel.showJudge(null); toast("已重置");
  }
  function nextHint() {
    hintN = Math.min(level.hints.length, hintN + 1);
    hintsBox.hidden = false;
    hintsBox.replaceChildren(h("b", { class: "tx-label" }, `提示（${hintN} / ${level.hints.length}）`), ...level.hints.slice(0, hintN).map((t, i) => h("p", { "data-hint": String(i + 1) }, t)));
    (hintBtn as HTMLButtonElement).textContent = hintN < level.hints.length ? "更多提示" : "提示";
  }
  async function showAnswer() {
    const use = await modal<boolean>((close) => {
      const pre = h("pre", { class: "tx-ref user", id: "tx-ref" });
      pre.innerHTML = highlightHtml(level.ref);
      return h("div", { class: "dlg cl-answer", id: "tx-answer-dlg" }, h("h2", {}, "参考答案"), pre, h("p", { class: "muted small" }, "使用参考答案后，这一关最多得 1 颗星。"),
        h("div", { class: "row end" }, h("button", { id: "tx-answer-close", onclick: () => close(false) }, "关闭"), h("button", { class: "primary", id: "tx-answer-use", onclick: () => close(true) }, "使用这个答案")));
    });
    if (!use) return;
    usedAnswer = true; panel.editor.setValue(level.ref, true); toast("已放入参考答案");
  }
  const lessonBtn = level.lesson ? h("button", { id: "tx-lesson-btn", class: "cl-round", type: "button", title: "课程", "aria-label": "课程", onclick: () => void openTextLesson(level.lesson!) }, "?") : h("span", { class: "slot" });
  const task = h("section", { class: "tx-task", id: "tx-task" },
    h("div", { class: "tx-task-top" }, h("span", { class: "tx-kind " + level.kind }, level.kind === "debug" ? "找错误" : level.kind === "fill" ? "填空" : level.kind === "draw" ? "画图" : "编程"), level.boss ? h("span", { class: "tx-kind boss" }, "挑战") : null,
      level.budget ? h("span", { class: "tx-kind budget" }, "限制步数") : null),
    h("div", { class: "tx-statement user", id: "tx-statement" }, level.task),
    level.kind !== "draw" ? h("div", { class: "tx-example", id: "tx-example" },
      example.call ? h("div", {}, h("span", { class: "tx-label" }, "测试代码示例"), h("pre", { class: "user tx-pre" }, example.call)) : null,
      example.input !== undefined ? h("div", {}, h("span", { class: "tx-label" }, "示例输入"), h("pre", { class: "user tx-pre", id: "tx-ex-in" }, example.input.length > 200 ? example.input.slice(0, 200) + " …" : example.input)) : null,
      h("div", {}, h("span", { class: "tx-label" }, "示例输出"), h("pre", { class: "user tx-pre", id: "tx-ex-out" }, exampleOut.length > 300 ? exampleOut.slice(0, 300) + " …" : exampleOut || "（空）"))) : null,
    hintsBox);
  const page = h("div", { class: "page tx-page", style: `--kid:${k.color};--wc:${WCOLOR[level.world]}` },
    h("header", { class: "top hero kid-hero tx-hero" }, X.back(`#/coding/${k.id}/w${level.world}`, "关卡"), h("h1", { id: "tx-title" }, `${level.world}-${level.no} `, h("span", { class: "user" }, level.title)), lessonBtn),
    h("main", { class: "scroll tx-scroll", id: "tx-main" }, h("div", { class: "tx-main" }, h("div", { class: "tx-left" }, task, msg), h("div", { class: "tx-right" }, panel.el))));
  X.show(page);
  if (level.lesson && !loadTLocal().seen.includes(level.lesson)) void openTextLesson(level.lesson);
  const hook = {
    get level() { return level; }, get editor() { return panel.editor; }, get panel() { return panel; },
    setCode(c: string) { panel.editor.setValue(c); },
    submit() { doSubmit(); }, run() { doRun(); },
    get submits() { return submits; }, get solved() { return solvedNow; }, get fails() { return fails; },
  };
  (window as unknown as { __codingtext: unknown }).__codingtext = hook;
}

// ---------- the workshop ----------
function workshopPage(k: M.Kid) {
  const local = loadTLocal();
  const saved = local.ws[k.id];
  let current: { id: string | null } = { id: null };
  const panel: Panel = makePanel({
    initial: saved?.code ?? TEMPLATES[0].code, input: saved?.input ?? "", showInput: true, draw: true,
    onCode: (c) => patchTLocal((l) => { l.ws[k.id] = { code: c, input: panel.input() }; }),
    extraButtons: [], onRun: () => patchTLocal((l) => { l.ws[k.id] = { code: panel.editor.value(), input: panel.input() }; }),
  });
  const b = (id: string, text: string, onclick: () => void, cls = "") => h("button", { id, class: cls, type: "button", onclick }, text);
  panel.buttons.append(b("tx-run", "运行", () => void panel.runNow(), "primary"), b("tx-step", "单步", () => (panel.stepping() ? panel.stepStop() : panel.stepStart())), b("tx-save", "保存", () => void save()), b("tx-templates", "模板", () => void templates()), b("tx-mine", "我的代码", () => void mine()), b("tx-import", "积木作品", () => void importBlocks()), b("tx-clear", "清空", () => void clear()));
  async function save() {
    const list = loadTLocal().snippets[k.id] ?? [];
    if (list.length >= MAX_SNIPPETS && !current.id) return void toast(`最多保存 ${MAX_SNIPPETS} 段代码。请先删除一段。`);
    const existing = current.id ? list.find((s) => s.id === current.id) : null;
    const name = await askText("保存代码", "名称", existing?.name ?? "");
    if (!name) return;
    patchTLocal((l) => {
      const arr = l.snippets[k.id] ?? [];
      if (existing) { const s = arr.find((x) => x.id === existing.id); if (s) { s.name = name; s.code = panel.editor.value(); s.input = panel.input(); s.date = M.todayLocal(); } }
      else arr.unshift({ id: `s${Date.now()}${Math.floor(Math.random() * 1000)}`, name, code: panel.editor.value(), input: panel.input(), date: M.todayLocal() });
      l.snippets[k.id] = arr;
      current = { id: existing?.id ?? arr[0].id };
    });
    toast("已保存到这台设备");
  }
  async function mine() {
    await modal<boolean>((close) => {
      const list = h("div", { class: "tx-snips", id: "tx-snips" });
      const draw = () => {
        const arr = loadTLocal().snippets[k.id] ?? [];
        list.replaceChildren(...(arr.length ? arr.map((s) => h("div", { class: "tx-snip", "data-id": s.id },
          h("button", { class: "tx-snip-open", type: "button", "data-id": s.id, onclick: () => { panel.editor.setValue(s.code); panel.setInput(s.input); panel.clearOutput(); current = { id: s.id }; close(true); toast("已打开"); } },
            h("b", { class: "user" }, s.name), h("span", { class: "muted small" }, s.date), h("code", { class: "tx-snip-pre user" }, s.code.split("\n").slice(0, 2).join(" ⏎ ").slice(0, 70))),
          h("button", { class: "danger tx-snip-del", type: "button", "data-id": s.id, onclick: async () => {
            if (!(await confirmDlg("删除这段代码？", "删除后不能恢复。", "删除", true))) return;
            patchTLocal((l) => { l.snippets[k.id] = (l.snippets[k.id] ?? []).filter((x) => x.id !== s.id); });
            if (current.id === s.id) current = { id: null };
            toast("已删除"); draw();
          } }, "删除"))) : [h("p", { class: "muted", id: "tx-snips-empty" }, "暂无保存的代码。")]));
      };
      draw();
      return h("div", { class: "dlg tx-snips-dlg" }, h("h2", {}, "我的代码"), list, h("div", { class: "row end" }, h("button", { id: "tx-snips-close", onclick: () => close(false) }, "关闭")));
    });
  }
  async function templates() {
    await modal<boolean>((close) => h("div", { class: "dlg tx-tpl-dlg" }, h("h2", {}, "模板"), h("div", { class: "tx-tpls", id: "tx-tpls" }, ...TEMPLATES.map((t, i) => h("button", { class: "tx-tpl", type: "button", "data-i": String(i), onclick: () => { panel.editor.setValue(t.code); panel.setInput(t.input ?? ""); panel.clearOutput(); current = { id: null }; close(true); } }, h("span", { class: "user" }, t.name)))),
      h("div", { class: "row end" }, h("button", { onclick: () => close(false) }, "关闭"))));
  }
  async function importBlocks() {
    const drawings = CM.loadLocal().drawings[k.id] ?? [];
    await modal<boolean>((close) => {
      const grid = h("div", { class: "tx-snips", id: "tx-blocks-list" });
      if (!drawings.length) grid.append(h("p", { class: "muted", id: "tx-blocks-empty" }, "暂无积木作品。请先在“创作”里保存一幅画。"));
      for (const d of drawings) {
        const br = blocksToPython(d.prog);
        grid.append(h("button", { class: "tx-snip-open tx-block-item", type: "button", "data-id": d.id, onclick: () => { panel.editor.setValue(br.code); panel.clearOutput(); current = { id: null }; close(true); toast("已把积木转换成代码"); } },
          h("b", {}, d.date), h("code", { class: "tx-snip-pre user" }, br.code.split("\n").filter(Boolean).slice(2, 4).join(" ⏎ ").slice(0, 70))));
      }
      return h("div", { class: "dlg tx-snips-dlg" }, h("h2", {}, "积木作品"), h("p", { class: "muted small" }, "把“创作”里保存的积木作品变成代码。"), grid, h("div", { class: "row end" }, h("button", { id: "tx-blocks-close", onclick: () => close(false) }, "关闭")));
    });
  }
  async function clear() {
    if (panel.editor.value().trim() && !(await confirmDlg("清空代码？", "编辑区里的代码会被清空。", "清空", true))) return;
    panel.editor.setValue(""); panel.clearOutput(); current = { id: null }; toast("已清空");
  }
  const page = h("div", { class: "page tx-page", style: `--kid:${k.color};--wc:#e8590c` },
    h("header", { class: "top hero kid-hero tx-hero" }, X.back(`#/coding/${k.id}`, "世界"), h("h1", { id: "tx-title" }, "代码工坊"), h("span", { class: "slot" })),
    h("main", { class: "scroll tx-scroll" }, h("div", { class: "tx-main tx-ws-main" }, h("div", { class: "tx-right" }, panel.el))));
  X.show(page);
  const hook = { get editor() { return panel.editor; }, get panel() { return panel; }, run: () => panel.runNow(), setCode: (c: string) => panel.editor.setValue(c) };
  (window as unknown as { __codingtext: unknown }).__codingtext = hook;
}

void textLevelById; void countTokens; void api;
