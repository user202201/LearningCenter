/**
 * The times table page of the math subject (rule 52): `#/math/<kid>/tables`, "口诀表". The 9 x 9 table as a colourful grid: a tap on a cell reads its 口诀 aloud
 * ("三四十二", the device's own Chinese voice) and lights its row, its column and the partner cell (3 x 4 / 4 x 3). "练习" asks the 口诀 aloud ("三四") and the child
 * types the product on a keypad; right / wrong counts per cell are kept for the child in `math/<kid>.tables.json` (shape `{topics: {"3x4": {right, wrong, last}}}`, so
 * `mergeDocs` merges two devices by the larger counts like the math results) and the weak cells are shown in orange. Pure model first, then the screen.
 */
import { h, toast } from "./ui";
import * as M from "./model";
import * as api from "./api";
import { kj, kjHead } from "./mathcn";
import type { Ctx } from "./english";

export interface CellStat { right: number; wrong: number; last?: string }
export interface TablesDoc { topics: Record<string, CellStat>; plays?: number }
export const EMPTY_TABLES: TablesDoc = { topics: {} };
export const tablesPath = (kidId: string): string => `math/${kidId}.tables.json`;
export const cellKey = (a: number, b: number): string => `${a}x${b}`;
/** questions of one practice round */
export const ROUND = 10;

export interface TAnswer { a: number; b: number; right: boolean }
/** adds the answers of a round to the counts of the cells */
export function applyTables(doc: TablesDoc, answers: TAnswer[], today: string): TablesDoc {
  const topics = { ...doc.topics };
  for (const x of answers) {
    const k = cellKey(x.a, x.b), c = topics[k] ?? { right: 0, wrong: 0 };
    topics[k] = { right: c.right + (x.right ? 1 : 0), wrong: c.wrong + (x.right ? 0 : 1), last: today };
  }
  return { topics, plays: (doc.plays ?? 0) + (answers.length ? 1 : 0) };
}
/** a cell is weak when it was answered wrong at least as often as right (and at least once wrong) */
export const isWeak = (s: CellStat | undefined): boolean => !!s && s.wrong > 0 && s.wrong >= s.right;
/** the cells of a round: weak cells first in the draw, cells never asked next, cells known well last (the factor 1 is rarely asked); never the same cell twice */
export function pickRound(doc: TablesDoc, n = ROUND, rnd: () => number = Math.random): [number, number][] {
  const cells: { a: number; b: number; w: number }[] = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
    const s = doc.topics[cellKey(a, b)];
    let w = isWeak(s) ? 8 : !s ? 2 : s.right >= 3 && s.wrong === 0 ? 0.6 : 1.2;
    if (a === 1 || b === 1) w *= 0.12;
    cells.push({ a, b, w });
  }
  const out: [number, number][] = [];
  while (out.length < n && cells.length) {
    const total = cells.reduce((s, c) => s + c.w, 0);
    let r = rnd() * total, i = 0;
    for (; i < cells.length - 1; i++) { r -= cells[i].w; if (r <= 0) break; }
    out.push([cells[i].a, cells[i].b]);
    cells.splice(i, 1);
  }
  return out;
}

// ---------------------------------------------------------------- the screen
let X!: Ctx;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** says a text with the device's own Chinese voice (offline; nothing where the device has no voice) */
export function sayZh(text: string): void {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.8;
    s.speak(u);
  } catch { /* no speech on this device */ }
}
const hue = (a: number) => Math.round(((a - 1) * 360) / 9 + 8);
let offKey: (() => void) | null = null;
/** a practice round that is left (another tab, the back button) saves what was answered */
let leaveP: (() => void) | null = null;

export async function renderTables(ctx: Ctx, kidId: string, mode: "view" | "practice" = "view"): Promise<void> {
  X = ctx;
  leaveP?.(); leaveP = null;
  offKey?.(); offKey = null;
  const my = X.epoch();
  X.showLoading();
  let doc: TablesDoc;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    doc = (await api.readJson<TablesDoc>(tablesPath(kidId))) ?? EMPTY_TABLES;
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderTables(ctx, kidId, mode)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === kidId);
  if (!k) { toast("未找到该孩子"); return void (location.hash = "#/subject/math"); }

  const body = h("div", { class: "scroll" });
  const seg = (m: "view" | "practice") => h("button", { class: mode === m ? "on" : "", id: m === "view" ? "tt-view" : "tt-practice", "data-tab": m, onclick: () => void renderTables(ctx, kidId, m) }, m === "view" ? "口诀表" : "练习");
  X.show(h("div", { class: "page", style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero" }, X.back(`#/math/${kidId}`, "数学"), h("h1", { class: "user-title" }, X.avatarEl(k), k.name)),
    h("div", { class: "tabs-row" }, h("div", { class: "seg tabs" }, seg("view"), seg("practice"))),
    body));
  if (mode === "view") viewTable(body, doc);
  else practice(body, kidId, doc);
}

function viewTable(body: HTMLElement, doc: TablesDoc): void {
  const caption = h("div", { class: "kj-caption", id: "kj-caption" }, "请点击格子，听口诀。");
  const grid = h("div", { class: "kj-grid", id: "kj-grid" });
  grid.append(h("span", { class: "kj-h kj-corner" }, "×"));
  for (let b = 1; b <= 9; b++) grid.append(h("span", { class: "kj-h", "data-col": b }, String(b)));
  for (let a = 1; a <= 9; a++) {
    grid.append(h("span", { class: "kj-h", "data-row": a }, String(a)));
    for (let b = 1; b <= 9; b++) {
      grid.append(h("button", { class: "kj-cell" + (isWeak(doc.topics[cellKey(a, b)]) ? " weak" : ""), "data-a": a, "data-b": b, style: `--hue:${hue(a)}`, "aria-label": `${a} × ${b} = ${a * b}`, onclick: () => tap(a, b) }, String(a * b)));
    }
  }
  const cells = () => [...grid.querySelectorAll<HTMLElement>(".kj-cell")];
  function tap(a: number, b: number) {
    for (const c of cells()) {
      const ca = Number(c.dataset.a), cb = Number(c.dataset.b);
      c.classList.toggle("hl-row", ca === a && cb !== b);
      c.classList.toggle("hl-col", cb === b && ca !== a);
      c.classList.toggle("hl-self", ca === a && cb === b);
      c.classList.toggle("hl-twin", ca === b && cb === a && a !== b);
    }
    caption.replaceChildren(h("b", {}, `${a} × ${b} = ${a * b}`), "  ", h("span", { class: "user kj-rhyme", id: "kj-rhyme" }, kj(a, b)),
      ...(a !== b ? [h("span", { class: "muted kj-twin" }, `(${b} × ${a} = ${a * b})`)] : []));
    sayZh(kj(a, b));
  }
  const weakN = cells().filter((c) => c.classList.contains("weak")).length;
  body.replaceChildren(h("div", { class: "narrow kj-narrow" }, caption, grid,
    h("p", { class: "kj-legend muted small", id: "kj-legend" }, h("i", { class: "kj-dot" }), weakN ? `橙色格子需要多练（${weakN} 个）。` : "答错的格子会变成橙色。")));
}

function practice(body: HTMLElement, kidId: string, doc0: TablesDoc): void {
  let doc = doc0;
  const round = pickRound(doc);
  const answers: TAnswer[] = [];
  let idx = 0, typed = "", phase: "ask" | "feedback" | "end" = "ask";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const progress = h("div", { class: "kj-progress", id: "kj-progress" });
  const q = h("div", { class: "kj-q user", id: "kj-q" });
  const input = h("div", { class: "minput user", id: "kj-input" }, "?");
  const hint = h("div", { class: "mhint", id: "kj-hint" });
  const say = h("button", { class: "kj-say", id: "kj-say", title: "再听一遍", "aria-label": "再听一遍", onclick: () => ask(true) }, "🔊");
  const keys = h("div", { class: "mkeys kj-keys", id: "kj-keys" }, ...["7", "8", "9", "⌫", "4", "5", "6", "0", "1", "2", "3", "✓"].map((c) =>
    h("button", { class: "mkey" + (c === "✓" ? " ok" : c === "⌫" ? " del" : ""), "data-k": c, title: c === "✓" ? "确定" : c === "⌫" ? "删除" : c, "aria-label": c === "✓" ? "确定" : c === "⌫" ? "删除" : c, onclick: () => press(c) }, c)));
  const box = h("div", { class: "narrow kj-narrow kj-practice", id: "kj-practice" }, progress, h("div", { class: "kj-card" }, q, say), input, hint, keys);
  body.replaceChildren(box);

  const cur = (): [number, number] => round[idx];
  function ask(again = false) {
    const [a, b] = cur();
    if (!again) {
      phase = "ask"; typed = "";
      input.textContent = "?"; input.className = "minput user"; hint.textContent = "";
      keys.querySelectorAll<HTMLButtonElement>(".mkey").forEach((x) => (x.disabled = false));
      q.textContent = `${a} × ${b} = ?`;
      progress.textContent = `${idx + 1} / ${round.length}`;
    }
    sayZh(kjHead(a, b));   // (the 口诀 without its product: "三四", "二三得")
  }
  function press(c: string) {
    if (phase !== "ask") return;
    if (c === "✓") { if (typed) check(); return; }
    typed = c === "⌫" ? typed.slice(0, -1) : typed.length < 3 ? typed + c : typed;
    input.textContent = typed || "?";
  }
  function check() {
    const [a, b] = cur(), right = Number(typed) === a * b;
    phase = "feedback";
    answers.push({ a, b, right });
    input.classList.add(right ? "right" : "wrong");
    keys.querySelectorAll<HTMLButtonElement>(".mkey").forEach((x) => (x.disabled = true));
    if (!right) { hint.textContent = ""; hint.append("正确答案：", h("b", { class: "user", id: "kj-right" }, `${a * b}  ${kj(a, b)}`)); sayZh(kj(a, b)); }
    box.dataset.last = right ? "right" : "wrong";
    timer = setTimeout(() => { idx++; if (idx >= round.length) void finish(); else ask(); }, right ? 450 : 1700);
  }
  async function save(): Promise<void> {
    if (!answers.length) return;
    const done = toast("正在保存…", 0, true);
    try {
      doc = await api.update<TablesDoc>(tablesPath(kidId), EMPTY_TABLES, (cur0) => applyTables(cur0, answers, M.todayLocal()), `tables ${kidId}`);
      done();
      toast("已记录这次练习");
    } catch (e) {
      done();
      toast(errText(e), 6000);
    }
  }
  async function finish() {
    phase = "end";
    leaveP = null;
    offKey?.(); offKey = null;
    const right = answers.filter((x) => x.right).length;
    await save();
    const wrongCells = answers.filter((x) => !x.right);
    box.replaceChildren(h("div", { class: "gend kj-end", id: "kj-end" },
      h("h2", {}, right === answers.length ? "全部正确。" : "练习完成。"),
      h("div", { class: "gresult" }, h("strong", { id: "kj-final" }, String(right)), ` / ${answers.length}`),
      wrongCells.length ? h("div", { class: "kj-wrong", id: "kj-wrong" }, ...wrongCells.map((x) => h("span", { class: "kj-chip user" }, `${x.a} × ${x.b} = ${x.a * x.b}`))) : null,
      h("div", { class: "row end" },
        h("button", { id: "kj-back", onclick: () => void renderTables(X, kidId, "view") }, "口诀表"),
        h("button", { class: "primary", id: "kj-again", onclick: () => void renderTables(X, kidId, "practice") }, "再练一次"))));
  }
  const onKey = (e: KeyboardEvent) => {
    if (!box.isConnected) { offKey?.(); offKey = null; return; }
    if (document.querySelector("dialog[open]")) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === "Enter") press("✓");
    else if (e.key === "Backspace") press("⌫");
  };
  document.addEventListener("keydown", onKey);
  offKey = () => { document.removeEventListener("keydown", onKey); clearTimeout(timer); };
  // leaving the page (another tab, the back button) keeps what was answered
  leaveP = () => { if (phase !== "end" && answers.length) { phase = "end"; void save(); } };
  window.addEventListener("hashchange", () => { leaveP?.(); leaveP = null; offKey?.(); offKey = null; }, { once: true });
  ask();
}
