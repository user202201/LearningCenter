/**
 * Classical poems (古诗词) of 识字: `#/poems/<kid>` with the tabs Today | Recorded | Poets, the poem page (`/poem/<id>`: big text, pinyin above every character,
 * a tap on a line reads it aloud, underlined words open their note, practice buttons), the practice rounds (`/practice/<id>/<mode>`: five questions, answers by
 * taps, instant feedback; sorting by dragging) and the recitation (`/recite`: the child recites aloud, the grown-up taps). The rules are in poemmodel.ts;
 * everything is part of the program (nothing is fetched); the speech is the device's own voice.
 */
import { h, toast, confirmDlg } from "./ui";
import * as M from "./model";
import * as api from "./api";
import * as P from "./profile";
import * as G from "./game";
import * as PM from "./poemmodel";
import { pickKidGrade } from "./gradeui";
import { shortcuts } from "./hub";
import { mascot } from "./art";
import { speakText } from "./speech";
import type { Ctx } from "./english";

let X!: Ctx;
export const initPoems = (c: Ctx) => { X = c; };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const cache = new Map<string, M.KidData>();
const loadKid = async (id: string) => { const d = (await api.readJson<M.KidData>(PM.poemsPath(id))) ?? M.EMPTY_KID; cache.set(id, d); return d; };
const reviewOf = async (id: string) => (await api.readJson<PM.PoemReview>(PM.poemsReviewPath(id))) ?? PM.EMPTY_POEM_REVIEW;
const today = () => M.todayLocal();
const poemHash = (kid: string, pid: string) => `#/poems/${kid}/poem/${pid}`;

// ---------- settings of this device ----------
const KEY = "learn.poems.v1";
interface Local { pinyin: boolean; level: number }
const loadLocal = (): Local => { try { const o = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return { pinyin: o.pinyin !== false, level: [1, 2, 3].includes(o.level) ? o.level : 1 }; } catch { return { pinyin: true, level: 1 }; } };
const saveLocal = (l: Local) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private window: forgotten on reload */ } };

// ---------- speech and pinyin ----------
/** says a text with the device's own Chinese voice, slowly (offline; silently nothing where a device has no speech) */
export function speak(text: string, rate = 0.8): void {
  speakText(text.replace(/[“”‘’]/g, ""), "zh-CN", { rate });
}
let pyFn: ((t: string) => string[]) | null = null;
/** the pinyin of every character of a poem, one list per line, read IN CONTEXT (so that a character with two readings gets the right one); "" for punctuation */
export async function pinyinOfPoem(p: PM.Poem): Promise<string[][]> {
  if (!pyFn) { const m = await import("pinyin-pro"); pyFn = (t) => m.pinyin(t, { type: "array", toneType: "symbol" }) as string[]; }
  const all = PM.textOf(p);
  let arr = pyFn(all);
  if (arr.length !== [...all].length) arr = p.lines.flatMap((l) => { const a = pyFn!(l); return a.length === [...l].length ? a : [...l].map(() => ""); });
  const out: string[][] = [];
  let at = 0;
  for (const l of p.lines) { const n = [...l].length; out.push([...l].map((c, i) => (PM.isHan(c) ? arr[at + i] : ""))); at += n; }
  return out;
}

// ---------- small pieces ----------
/** the memory level of a poem: five dots (box 1-5 filled; box 0 = failed last time; none = never practised) */
function memEl(level: number): HTMLElement {
  const dots = [1, 2, 3, 4, 5].map((i) => h("i", { class: i <= level ? "on" : "" }));
  return h("span", { class: "pm-mem", "data-level": String(level), title: level < 0 ? "未练习" : "记忆程度", "aria-label": level < 0 ? "未练习" : "记忆程度" }, ...dots);
}
/** a poem in a list: title, who and when, memory dots; a tap opens it */
function poemCard(kid: M.Kid, p: PM.Poem, level: number): HTMLElement {
  return h("button", { class: "pm-card", "data-poem": p.id, onclick: () => (location.hash = poemHash(kid.id, p.id)) },
    h("span", { class: "pm-card-main" },
      h("b", { class: "pm-card-title user" }, p.title),
      h("span", { class: "pm-card-by user" }, `${p.dynasty} · ${p.author}`)),
    memEl(level),
    h("span", { class: "chev" }, "›"));
}
const hero = (k: M.Kid, back: string, label = "返回") => h("header", { class: "top hero kid-hero" }, X.back(back, label), h("h1", { class: "user-title" }, X.avatarEl(k), k.name), shortcuts(k.id, "chinese"));

async function saveReview(kidId: string, fn: (r: PM.PoemReview) => PM.PoemReview, tag: string): Promise<void> {
  const done = toast("正在保存…", 0, true);
  try {
    await api.update<PM.PoemReview>(PM.poemsReviewPath(kidId), PM.EMPTY_POEM_REVIEW, fn, `poems ${tag} ${kidId}`);
    done();
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}

// ---------- the pages of a child ----------
type Tab = "today" | "learned" | "poets";
let curDay = "";
let curKid = "";
let curPoet = "";

/** a day gets its new poem once (opening the page on a day that has none makes it) */
async function ensureDay(k: M.Kid, lib: PM.Library): Promise<void> {
  const kid = cache.get(k.id) ?? M.EMPTY_KID;
  const day = today();
  if (M.weekOf(kid, day)?.chars.length) return;
  const grade = P.gradeOf(k.id) ?? 1;
  const done = toast("正在选择今天的古诗词…", 0, true);
  try {
    let added = 0;
    const review = await reviewOf(k.id).catch(() => PM.EMPTY_POEM_REVIEW);
    const out = await api.update<M.KidData>(PM.poemsPath(k.id), M.EMPTY_KID, (cur) => {
      if (M.weekOf(cur, day)?.chars.length) return cur;       // (another device was first)
      const r = PM.addToDay(cur, day, PM.pickDaily(lib, cur, grade, day, (id) => (review.cards[id]?.box ?? 1) === 0, k.id));
      added = r.added;
      return r.data;
    }, `poems ${k.id}`);
    cache.set(k.id, out);
    done();
    if (added) toast("已选好今天的古诗词");
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}
async function learnOneMore(k: M.Kid, lib: PM.Library, again: () => void): Promise<void> {
  const grade = P.gradeOf(k.id) ?? 1;
  const done = toast("正在选择古诗词…", 0, true);
  try {
    let added = 0;
    const review = await reviewOf(k.id).catch(() => PM.EMPTY_POEM_REVIEW);
    const out = await api.update<M.KidData>(PM.poemsPath(k.id), M.EMPTY_KID, (cur) => {
      const r = PM.addToDay(cur, today(), PM.pickDaily(lib, cur, grade, today(), (id) => (review.cards[id]?.box ?? 1) === 0, k.id));
      added = r.added;
      return r.data;
    }, `poems more ${k.id}`);
    cache.set(k.id, out);
    done();
    toast(added ? "已增加一首" : "暂无更多古诗词");
    again();
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}

export async function renderKid(id: string, tab: Tab) {
  const my = X.epoch();
  X.showLoading();
  let lib: PM.Library;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    lib = await PM.loadPoems();
    await loadKid(id);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderKid(id, tab)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) { toast("未找到该孩子"); return void (location.hash = "#/chinese"); }
  if (P.gradeOf(id) === null) {
    const g = await pickKidGrade(k);
    if (my !== X.epoch()) return;
    if (g === null) return void (location.hash = `#/kid/${id}`);
    cache.delete(id);
    await loadKid(id);
  }
  if (curKid !== id || !curDay) { curKid = id; curDay = today(); }
  await ensureDay(k, lib);
  if (my !== X.epoch()) return;
  const kid = cache.get(id) ?? M.EMPTY_KID;
  const tabs = h("div", { class: "seg tabs" },
    h("button", { class: tab === "today" ? "on" : "", "data-tab": "today", onclick: () => (location.hash = `#/poems/${id}`) }, "今天"),
    h("button", { class: tab === "learned" ? "on" : "", "data-tab": "learned", onclick: () => (location.hash = `#/poems/${id}/learned`) }, `已入库 ${PM.allIds(kid).length}`),
    h("button", { class: tab === "poets" ? "on" : "", "data-tab": "poets", onclick: () => (location.hash = `#/poems/${id}/poets`) }, "诗人"));
  const body = h("div", { class: "scroll" });
  const gradeBtn = h("button", { class: "link", id: "grade-btn", title: "修改年级", onclick: () => void changeGrade(k) }, "年级：", P.gradeName(P.gradeOf(id) ?? 1));
  X.show(h("div", { class: "page pm-page", style: `--kid:${k.color}` }, hero(k, `#/kid/${id}`, "返回"),
    h("div", { class: "pm-title-row" }, h("h2", { class: "pm-title", id: "pm-title" }, "古诗词")),
    h("div", { class: "tabs-row" }, tabs), h("div", { class: "grade-row" }, gradeBtn), body));
  if (tab === "today") await renderToday(body, k, kid, lib);
  else if (tab === "learned") await renderLearned(body, k, kid, lib);
  else await renderPoets(body, k, kid, lib);
}
async function changeGrade(k: M.Kid) {
  if ((await pickKidGrade(k)) === null) return;
  cache.delete(k.id);
  toast("年级已记住");
  X.route();
}

async function renderToday(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: PM.Library) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: PM.PoemReview;
  try { review = await reviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const t = today();
  const days = kid.weeks.filter((w) => w.chars.length).map((w) => w.start).sort();
  const at = days.indexOf(curDay);
  const go = (d: string | undefined) => { if (d) { curDay = d; void renderToday(body, k, cache.get(k.id) ?? M.EMPTY_KID, lib); } };
  const bar = h("div", { class: "weekbar" },
    h("button", { class: "icon", title: "前一天", "aria-label": "前一天", disabled: at <= 0, onclick: () => go(days[at - 1]) }, "‹"),
    h("div", { class: "wlabel", id: "week-label" }, h("strong", {}, curDay === t ? "今天" : curDay), h("span", { class: "muted" }, curDay === t ? curDay : "")),
    h("button", { class: "icon", title: "后一天", "aria-label": "后一天", disabled: at < 0 || at >= days.length - 1, onclick: () => go(days[at + 1]) }, "›"));
  const mine = (M.weekOf(kid, curDay)?.chars ?? []).map((i) => lib.byId.get(i)).filter((p): p is PM.Poem => !!p);
  const again = curDay === t ? PM.reviewIds(kid, review, t).map((i) => lib.byId.get(i)).filter((p): p is PM.Poem => !!p && !mine.includes(p)) : [];
  body.replaceChildren(h("div", { class: "narrow week-narrow" }, bar,
    curDay === t ? null : h("button", { class: "link", onclick: () => go(t) }, "回到今天"),
    h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "day-title" }, `新诗（${mine.length}）`), curDay === t ? h("span", { class: "muted small" }, "每天推荐学一首") : null),
    mine.length ? h("div", { class: "pm-list", id: "pm-today" }, ...X.stagger(mine.map((p) => poemCard(k, p, PM.levelOf(review, p.id))))) : h("p", { class: "empty" }, "这一天没有古诗词。"),
    curDay === t ? h("div", { class: "pm-more-row" }, h("button", { class: "mopt pm-more", id: "pm-more", onclick: () => void learnOneMore(k, lib, () => void renderKid(k.id, "today")) }, "再学一首")) : null,
    again.length ? h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "again-title" }, `该回顾的旧诗（${again.length}）`), h("span", { class: "muted small" }, "按记忆曲线复习")) : null,
    again.length ? h("div", { class: "pm-list", id: "again-list" }, ...X.stagger(again.map((p) => poemCard(k, p, PM.levelOf(review, p.id))))) : null));
}

async function renderLearned(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: PM.Library) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: PM.PoemReview;
  try { review = await reviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const all = PM.allIds(kid).map((i) => lib.byId.get(i)).filter((p): p is PM.Poem => !!p);
  body.replaceChildren(h("div", { class: "narrow" },
    all.length
      ? h("div", {},
          h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "learned-title" }, `已学过的古诗词（${all.length}）`),
            h("button", { class: "sheet-btn", id: "pm-recite-btn", onclick: () => (location.hash = `#/poems/${k.id}/recite`) }, "抽背")),
          h("div", { class: "pm-list", id: "pm-learned" }, ...X.stagger(all.map((p) => poemCard(k, p, PM.levelOf(review, p.id))))))
      : h("p", { class: "empty" }, "暂无已入库的古诗词。请先查看“今天”。")));
}

/** the poets by dynasty: a timeline of the dynasties, then the poets of the chosen one with their poems */
async function renderPoets(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: PM.Library) {
  const my = X.epoch();
  let review: PM.PoemReview;
  try { review = await reviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const counts = new Map<string, number>();
  for (const p of lib.poems) counts.set(p.dynasty, (counts.get(p.dynasty) ?? 0) + 1);
  const dyns = lib.dynasties.filter((d) => counts.has(d.n));
  if (!curPoet || !dyns.some((d) => d.n === curPoet)) {
    const last = lib.byId.get(PM.allIds(kid)[0] ?? "");
    curPoet = dyns.find((d) => d.n === last?.dynasty)?.n ?? dyns.find((d) => d.years)?.n ?? dyns[0].n;
  }
  const draw = () => {
    const strip = h("div", { class: "pm-line-tl", "aria-hidden": "true" }, ...dyns.map((d) => h("i", { class: d.n === curPoet ? "on" : "", style: `flex:${Math.max(1, counts.get(d.n) ?? 1)}` })));
    const chips = h("div", { class: "pm-tl", id: "pm-timeline" }, ...dyns.map((d) => h("button", { class: "pm-dyn" + (d.n === curPoet ? " on" : ""), "data-dynasty": d.n, onclick: () => { curPoet = d.n; draw(); } },
      h("b", { class: "user" }, d.n), h("small", { class: "user" }, d.years || " "), h("em", {}, String(counts.get(d.n))))));
    const poets = PM.poetsOf(lib, curPoet);
    body.replaceChildren(h("div", { class: "narrow" }, strip, chips,
      h("div", { class: "pm-poets", id: "pm-poets" }, ...poets.map((e) => h("section", { class: "pm-poet", "data-poet": e.author },
        h("h3", { class: "pm-poet-name user" }, e.author, h("small", { class: "user" }, ` ${curPoet}`)),
        h("div", { class: "pm-poet-list" }, ...e.poems.map((p) => h("button", { class: "pm-pill user", "data-poem": p.id, onclick: () => (location.hash = poemHash(k.id, p.id)) }, p.title))))))));
  };
  draw();
}

// ---------- the poem page ----------
export async function renderPoem(kidId: string, pid: string) {
  const my = X.epoch();
  X.showLoading();
  let lib: PM.Library, py: string[][];
  try {
    if (!X.kids().kids.length) await X.loadShared();
    lib = await PM.loadPoems();
    await loadKid(kidId);
    const p0 = lib.byId.get(pid);
    py = p0 ? await pinyinOfPoem(p0) : [];
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderPoem(kidId, pid)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === kidId);
  const p = lib.byId.get(pid);
  if (!k || !p) { toast("未找到这首诗"); return void (location.hash = `#/poems/${kidId}`); }
  const local = loadLocal();
  const review = await reviewOf(kidId).catch(() => PM.EMPTY_POEM_REVIEW);
  if (my !== X.epoch()) return;

  const noteBox = h("div", { class: "pm-notebox", id: "pm-note", hidden: true });
  const showNote = (n: PM.Note) => { noteBox.hidden = false; noteBox.replaceChildren(h("b", { class: "user" }, n.w), h("span", { class: "user" }, n.x)); noteBox.dataset.word = n.w; };
  // the characters of every line; the words of the notes are underlined (a tap opens the note; a tap elsewhere in the line reads the line)
  const lines = p.lines.map((line, li) => {
    const chars = [...line];
    const noteAt = new Map<number, PM.Note>();
    for (const n of p.notes) { const s = line.indexOf(n.w); if (s >= 0) for (let i = s; i < s + [...n.w].length; i++) noteAt.set(i, n); }
    const row = h("div", { class: "pm-line", "data-line": String(li), role: "button", tabindex: "0", title: "点击朗读", "aria-label": "点击朗读" },
      ...chars.map((c, i) => {
        const nt = noteAt.get(i);
        return h("span", { class: "pm-ch" + (PM.isHan(c) ? "" : " punct") + (nt ? " nw" : ""), "data-note": nt ? nt.w : undefined },
          h("span", { class: "pm-py" }, py[li]?.[i] ?? ""), h("span", { class: "pm-han user" }, c));
      }));
    const read = () => speak(line);
    row.addEventListener("click", (e) => {
      const nw = (e.target as HTMLElement).closest<HTMLElement>(".nw");
      if (nw) { const n = p.notes.find((x) => x.w === nw.dataset.note); if (n) return showNote(n); }
      read();
    });
    row.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), read()));
    return row;
  });
  const text = h("div", { class: "pm-poem" + (local.pinyin ? "" : " no-py"), id: "pm-poem", style: `--n:${Math.min(12, Math.max(...p.lines.map((l) => [...l].length)))}` }, ...lines);
  const pyBtn = h("button", { class: "mopt" + (local.pinyin ? " on" : ""), id: "pm-py-toggle", onclick: () => { local.pinyin = !local.pinyin; saveLocal(local); text.classList.toggle("no-py", !local.pinyin); pyBtn.classList.toggle("on", local.pinyin); } }, "拼音");
  const level = loadLocal().level;
  const levelBtns = [1, 2, 3].map((n) => h("button", { class: "mopt" + (n === level ? " on" : ""), id: `pm-level-${n}`, "data-level": String(n), onclick: () => { const l = loadLocal(); l.level = n; saveLocal(l); levelBtns.forEach((b, i) => b.classList.toggle("on", i + 1 === n)); } }, ["简单", "中等", "较难"][n - 1]));
  const MODE_NAMES: Record<PM.Mode, string> = { fill: "填空", next: "接句", prev: "上句", order: "排序", match: "作者与朝代", key: "关键词" };
  const modes = h("div", { class: "pm-modes", id: "pm-modes" }, ...PM.MODES.map((m) => h("button", { class: "pm-mode", id: `pm-mode-${m}`, "data-mode": m, onclick: () => (location.hash = `#/poems/${kidId}/practice/${pid}/${m}`) }, MODE_NAMES[m])));
  const lv = PM.levelOf(review, pid);
  X.show(h("div", { class: "page pm-page", style: `--kid:${k.color}` }, hero(k, `#/poems/${kidId}`, "返回"),
    h("main", { class: "scroll" }, h("div", { class: "narrow pm-read" },
      h("div", { class: "pm-head" },
        h("h2", { class: "pm-ptitle user", id: "pm-ptitle" }, p.title),
        h("p", { class: "pm-by user" }, `${p.dynasty} · ${p.author}`),
        h("div", { class: "pm-meta" }, memEl(lv))),
      text,
      noteBox,
      h("div", { class: "pm-actions" },
        h("button", { class: "primary", id: "pm-read", onclick: () => speak(PM.speechText(p)) }, "朗读全诗"), pyBtn),
      h("section", { class: "pm-sec" }, h("h3", {}, "诗意"), h("p", { class: "pm-gist user", id: "pm-gist" }, p.gist)),
      p.notes.length ? h("section", { class: "pm-sec" }, h("h3", {}, "注释"), h("ul", { class: "pm-notes user" }, ...p.notes.map((n) => h("li", {}, h("b", {}, n.w), h("span", { class: "sep" }, " - "), n.x)))) : null,
      h("section", { class: "pm-sec" }, h("h3", {}, "练习"),
        h("div", { class: "pm-level" }, h("span", { class: "muted small" }, "填空难度"), ...levelBtns),
        modes)))));
}

// ---------- practice ----------
const ASK_TEXT: Record<PM.Ask, string> = {
  fill: "选字补全诗句", next: "下一句是什么？", prev: "上一句是什么？", order: "把下面的诗句按顺序排好",
  author: "这首诗的作者是谁？", dynasty: "这位诗人是哪个朝代的？", title: "这句诗出自哪一首？", word: "诗中这个词语是什么意思？", gist: "哪一项是这首诗的意思？",
};

export async function renderPractice(kidId: string, pid: string, mode: PM.Mode) {
  const my = X.epoch();
  X.showLoading();
  let lib: PM.Library;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    lib = await PM.loadPoems();
    await loadKid(kidId);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderPractice(kidId, pid, mode)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === kidId);
  if (!k || !lib.byId.has(pid) || !PM.MODES.includes(mode)) return void (location.hash = `#/poems/${kidId}`);
  const questions = PM.makeRound(lib, mode, pid, PM.allIds(cache.get(kidId) ?? M.EMPTY_KID), Math.random, loadLocal().level);
  if (!questions.length) { toast("这首诗暂时无法出这类题目"); return void (location.hash = poemHash(kidId, pid)); }
  runRound(k, lib, mode, pid, questions);
}

/** the question screen: `quit` = × (asks first when something was answered) */
function runRound(k: M.Kid, lib: PM.Library, mode: PM.Mode, pid: string, questions: PM.Question[]) {
  const outcomes: PM.Outcome[] = [];
  let idx = 0, score = 0, saved = 0, finished = false;
  const progress = h("span", { class: "gprogress", id: "pq-progress" });
  const scoreEl = h("span", { class: "gscore", id: "pq-score" }, "★ 0");
  const label = h("div", { class: "pq-label", id: "pq-label" });
  const subject = h("div", { class: "pq-subject user", id: "pq-subject" });
  const ctx = h("div", { class: "pq-ctx user", id: "pq-ctx" });
  const area = h("div", { class: "pq-area", id: "pq-area" });
  const explain = h("div", { class: "pq-explain", id: "pq-explain", hidden: true });
  const next = h("button", { class: "primary wide pq-next", id: "pq-next", hidden: true });
  const quit = h("button", { class: "gquit", id: "pq-quit", title: "退出", "aria-label": "退出", onclick: () => void leave() }, "×");
  const body = h("div", { class: "pq-body" }, label, subject, ctx, area, explain, next);
  const root = h("div", { class: "page pm-page pm-prac", id: "pm-prac", style: `--kid:${k.color}` },
    h("div", { class: "gtop" }, quit, h("div", { class: "gmid" }, progress), scoreEl), h("main", { class: "scroll" }, body));
  X.show(root);

  const back = () => (location.hash = poemHash(k.id, pid));
  const save = async (summary?: { score: number; total: number }) => {
    const fresh = outcomes.slice(saved);
    if (!fresh.length) return;
    saved = outcomes.length;
    await saveReview(k.id, (cur) => PM.applyRound(cur, fresh, today(), summary), mode);
  };
  async function leave() {
    if (finished || !outcomes.length) return back();
    if (!(await confirmDlg("退出练习？", "已回答的题目会被保存。", "退出"))) return;     // cancelled: nothing happens
    await save();
    back();
  }
  const record = (q: PM.Question, right: boolean) => { outcomes.push({ poem: q.poem, mode, right }); if (right) score++; scoreEl.textContent = `★ ${score}`; };
  const feedback = (q: PM.Question, right: boolean) => {
    explain.hidden = false;
    explain.dataset.right = right ? "1" : "0";
    explain.replaceChildren(h("b", { class: right ? "ok" : "no" }, right ? "正确" : "不对"), h("span", {}, " "), h("span", { class: "user" }, q.explain.replace(/ \| /g, " · ")));
    next.hidden = false;
    next.textContent = idx + 1 >= questions.length ? "完成" : "下一题";
    next.focus({ preventScroll: true });
  };
  next.addEventListener("click", () => { idx++; ask(); });

  function ask() {
    if (idx >= questions.length) return void end();
    const q = questions[idx];
    progress.textContent = `${idx + 1} / ${questions.length}`;
    explain.hidden = true; next.hidden = true; ctx.textContent = ""; ctx.hidden = true;
    label.textContent = ASK_TEXT[q.ask];
    area.replaceChildren();
    root.dataset.mode = q.kind;
    if (q.kind === "fill") return askFill(q);
    if (q.kind === "order") return askOrder(q);
    subject.hidden = false;
    subject.textContent = q.subject;
    subject.classList.toggle("line", q.ask === "next" || q.ask === "prev" || q.ask === "title");
    if (q.context) { ctx.hidden = false; ctx.textContent = q.context; }
    const long = q.choices.some((c) => PM.hanLen(c) > 12);
    const grid = h("div", { class: "pq-choices" + (long ? " long" : ""), id: "pq-choices" });
    q.choices.forEach((c, i) => grid.append(h("button", { class: "pq-opt user", "data-i": String(i), "data-right": i === q.answer ? "1" : "0" }, c)));
    grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".pq-opt");
      if (!b || grid.classList.contains("done")) return;
      const right = Number(b.dataset.i) === q.answer;
      grid.classList.add("done");
      [...grid.children].forEach((x) => { const el = x as HTMLButtonElement; el.disabled = true; if (el.dataset.right === "1") el.classList.add("right"); });
      if (!right) b.classList.add("wrong");
      record(q, right);
      feedback(q, right);
    });
    area.append(grid);
  }

  /** a line with 1-3 blanks, one blank after the other with four characters each */
  function askFill(q: PM.FillQ) {
    subject.hidden = false;
    subject.classList.add("line");
    const picked: string[] = [];
    let bi = 0;
    const slots = [...q.line].map((c, i) => { const b = q.blanks.indexOf(i); return b >= 0 ? h("span", { class: "pq-slot", "data-blank": String(b) }, "") : h("span", { class: "pq-c" }, c); });
    subject.replaceChildren(...slots);
    const grid = h("div", { class: "pq-choices chars", id: "pq-choices" });
    const mark = () => slots.forEach((s) => s.classList.toggle("cur", s.dataset.blank === String(bi)));
    const show = () => {
      grid.replaceChildren(...q.choices[bi].map((c, i) => h("button", { class: "pq-opt pq-char user", "data-i": String(i), "data-right": c === q.answers[bi] ? "1" : "0" }, c)));
      mark();
    };
    grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".pq-opt");
      if (!b || grid.classList.contains("done")) return;
      const c = b.textContent ?? "";
      const slot = slots.find((s) => s.dataset.blank === String(bi))!;
      picked.push(c);
      slot.textContent = c;
      if (c !== q.answers[bi]) {                         // wrong: the right characters are shown, the question is lost
        grid.classList.add("done");
        [...grid.children].forEach((x) => { const el = x as HTMLButtonElement; el.disabled = true; if (el.dataset.right === "1") el.classList.add("right"); });
        b.classList.add("wrong");
        slot.classList.add("bad");
        q.blanks.forEach((_, j) => { const s = slots.find((x) => x.dataset.blank === String(j))!; if (j >= bi) { s.textContent = q.answers[j]; s.classList.add(j === bi ? "bad" : "fix"); } s.classList.remove("cur"); });
        record(q, false);
        return feedback(q, false);
      }
      slot.classList.add("ok");
      bi++;
      if (bi >= q.blanks.length) {
        grid.classList.add("done");
        [...grid.children].forEach((x) => { (x as HTMLButtonElement).disabled = true; });
        slots.forEach((s) => s.classList.remove("cur"));
        record(q, PM.fillRight(q, picked));
        return feedback(q, true);
      }
      show();
    });
    area.append(grid);
    show();
  }

  /** shuffled lines: drag a line up / down (a finger, a pencil or the mouse), or tap one and then another to swap them; "check" judges */
  function askOrder(q: PM.OrderQ) {
    subject.hidden = true;
    const list = h("div", { class: "pq-order", id: "pq-order" });
    let selected: HTMLElement | null = null;
    q.items.forEach((t) => list.append(h("div", { class: "pq-oitem user", role: "button", tabindex: "0", "data-line": t, "aria-label": "拖动或点击以调整顺序" },
      h("span", { class: "grip", "aria-hidden": "true" }, "⋮⋮"), h("span", { class: "otext" }, t))));
    const current = () => [...list.children].map((c) => (c as HTMLElement).dataset.line ?? "");
    const check = h("button", { class: "primary wide", id: "pq-check" }, "检查");
    let drag: { el: HTMLElement; startY: number; moved: boolean; id: number } | null = null;
    list.addEventListener("pointerdown", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".pq-oitem");
      if (!el || list.classList.contains("done") || drag) return;
      drag = { el, startY: e.clientY, moved: false, id: e.pointerId };
      try { list.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }   // (on the LIST: moving the line in the page would end a capture held by the line itself)
    });
    list.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      let dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) < 6) return;
      if (!drag.moved) { drag.moved = true; drag.el.classList.add("drag"); selected?.classList.remove("sel"); selected = null; }
      const el = drag.el;
      const centre = () => el.offsetTop + el.offsetHeight / 2 + dy;           // (layout positions: no animation can confuse them)
      for (const s of [...list.children] as HTMLElement[]) {
        if (s === el) continue;
        const sc = s.offsetTop + s.offsetHeight / 2, before = !!(el.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
        const c = centre();
        if (before && c > sc) { const was = el.offsetTop; s.after(el); dy -= el.offsetTop - was; drag.startY = e.clientY - dy; }
        else if (!before && c < sc) { const was = el.offsetTop; s.before(el); dy -= el.offsetTop - was; drag.startY = e.clientY - dy; }
      }
      el.style.transform = `translateY(${dy}px)`;
    });
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { el, moved } = drag;
      drag = null;
      el.style.transform = "";
      el.classList.remove("drag");
      try { list.releasePointerCapture(e.pointerId); } catch { /* released */ }
      if (moved) return;
      // a tap: select, then a second tap swaps the two
      if (selected && selected !== el) {
        const a = selected, b = el;
        const mark = document.createComment("");
        b.before(mark); a.before(b); mark.replaceWith(a);
        a.classList.remove("sel"); selected = null;
      } else if (selected === el) { el.classList.remove("sel"); selected = null; }
      else { selected = el; el.classList.add("sel"); }
    };
    list.addEventListener("pointerup", up);
    list.addEventListener("pointercancel", (e) => { if (drag && e.pointerId === drag.id) { drag.el.style.transform = ""; drag.el.classList.remove("drag"); drag = null; } });
    list.addEventListener("keydown", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".pq-oitem");
      if (!el || list.classList.contains("done")) return;
      if (e.key === "ArrowUp" && el.previousElementSibling) { e.preventDefault(); el.previousElementSibling.before(el); el.focus(); }
      else if (e.key === "ArrowDown" && el.nextElementSibling) { e.preventDefault(); el.nextElementSibling.after(el); el.focus(); }
    });
    check.addEventListener("click", () => {
      if (list.classList.contains("done")) return;
      const now = current();
      const right = PM.orderRight(q, now);
      list.classList.add("done");
      selected?.classList.remove("sel");
      [...list.children].forEach((c, i) => { const el = c as HTMLElement; el.classList.add(now[i] === q.solution[i] ? "right" : "wrong"); el.setAttribute("tabindex", "-1"); });
      check.hidden = true;
      record(q, right);
      feedback(q, right);
    });
    area.append(list, check);
  }

  async function end() {
    finished = true;
    const total = questions.length;
    await save({ score, total });
    const stars = G.starsFor(score, total);
    progress.textContent = `${total} / ${total}`;
    root.dataset.mode = "end";
    body.replaceChildren(h("div", { class: "pq-end", id: "pq-end" },
      h("span", { class: "mascot big" }, mascot()),
      h("h2", {}, score === total ? "全部正确。" : "练习完成。"),
      h("p", { class: "pq-score", id: "pq-final" }, `${score} / ${total}`),
      h("p", { class: "stars", "aria-hidden": "true" }, "★".repeat(stars) + "☆".repeat(3 - stars)),
      h("div", { class: "pq-end-btns" },
        h("button", { class: "primary", id: "pq-again", onclick: () => { const qs = PM.makeRound(lib, mode, pid, PM.allIds(cache.get(k.id) ?? M.EMPTY_KID), Math.random, loadLocal().level); qs.length ? runRound(k, lib, mode, pid, qs) : back(); } }, "再练一次"),
        h("button", { id: "pq-done", onclick: back }, "返回"))));
  }
  ask();
}

// ---------- recitation: the child recites aloud, the grown-up taps ----------
export async function renderRecite(kidId: string) {
  const my = X.epoch();
  X.showLoading();
  let lib: PM.Library;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    lib = await PM.loadPoems();
    await loadKid(kidId);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderRecite(kidId)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === kidId);
  if (!k) return void (location.hash = "#/chinese");
  const pool = PM.allIds(cache.get(kidId) ?? M.EMPTY_KID).map((i) => lib.byId.get(i)).filter((p): p is PM.Poem => !!p);
  const back = () => (location.hash = `#/poems/${kidId}/learned`);
  const box = h("div", { class: "narrow pm-recite", id: "pm-recite" });
  X.show(h("div", { class: "page pm-page", style: `--kid:${k.color}` }, hero(k, `#/poems/${kidId}/learned`, "返回"), h("main", { class: "scroll" }, box)));
  if (!pool.length) return void box.replaceChildren(h("p", { class: "empty" }, "暂无已入库的古诗词。请先查看“今天”。"));
  let last = "", n = 0;
  const show = () => {
    const cands = pool.length > 1 ? pool.filter((p) => p.id !== last) : pool;
    const p = cands[Math.floor(Math.random() * cands.length)];
    last = p.id; n++;
    let shown = false;
    const first = h("p", { class: "rc-first user", id: "rc-first" }, p.lines[0]);
    const rest = h("div", { class: "rc-rest user", id: "rc-rest", hidden: true }, ...p.lines.map((l) => h("p", {}, l)));
    const judge = async (ok: boolean) => {
      await saveReview(kidId, (cur) => PM.applyRecite(cur, p.id, ok, today()), "recite");
      toast(ok ? "已记录：记得" : "已记录：没记住");
      show();
    };
    box.replaceChildren(
      h("p", { class: "muted small center", id: "rc-count" }, `抽背 ${n}`),
      h("div", { class: "rc-card" },
        h("h2", { class: "rc-title user", id: "rc-title" }, p.title),
        h("p", { class: "rc-by user" }, `${p.dynasty} · ${p.author}`),
        first, rest),
      h("p", { class: "muted center rc-tip" }, "请孩子背出这首诗，由大人点击下面的按钮。"),
      h("div", { class: "rc-btns" },
        h("button", { class: "pm-mode", id: "rc-show", onclick: () => { shown = !shown; rest.hidden = !shown; first.hidden = shown; } }, "看全诗"),
        h("button", { class: "pm-mode", id: "rc-listen", onclick: () => speak(PM.speechText(p)) }, "朗读")),
      h("div", { class: "rc-btns" },
        h("button", { class: "primary rc-yes", id: "rc-yes", onclick: () => void judge(true) }, "记得"),
        h("button", { class: "rc-no", id: "rc-no", onclick: () => void judge(false) }, "没记住")),
      h("div", { class: "row center" }, h("button", { class: "link", id: "rc-end", onclick: back }, "结束")));
  };
  show();
}

/** the routes below `#/poems/<kid>` */
export function render(kidId: string, rest: string): void {
  if (rest === "" ) return void renderKid(kidId, "today");
  if (rest === "learned") return void renderKid(kidId, "learned");
  if (rest === "poets") return void renderKid(kidId, "poets");
  if (rest === "recite") return void renderRecite(kidId);
  const pm = /^poem\/(p\d+)$/.exec(rest);
  if (pm) return void renderPoem(kidId, pm[1]);
  const pr = /^practice\/(p\d+)\/(\w+)$/.exec(rest);
  if (pr) return void renderPractice(kidId, pr[1], pr[2] as PM.Mode);
  location.hash = `#/poems/${kidId}`;
}
