/**
 * Math, part 1: mental arithmetic. The screens are the same as in 识字 / English: the list of children -> a child with three tabs (Game | This week | Recorded).
 * Every DAY a child gets 3 NEW topics of his grade (mathmodel.ts, kept in `math/<kid>.json`, `start` = the date of the day: practice is not memory work, so it changes every day); the questions are made on the spot (mathgen.ts). The game
 * (mathui.ts) has a total time and four choices; its results are in `math/<kid>.review.json`.
 */
import { h, toast } from "./ui";
import * as M from "./model";
import * as api from "./api";
import * as P from "./profile";
import * as W from "./words";
import * as MM from "./mathmodel";
import * as MG from "./mathgen";
import { pickKidGrade } from "./gradeui";
import { openMathGame } from "./mathui";
import { renderRich } from "./mathtext";
import { mountFig } from "./mathfig";
import * as MT from "./mathtables";
import * as MS from "./mathsettings";
import { mascot } from "./art";
import { subjectArt, shortcuts } from "./hub";
import type { Ctx } from "./english";

let X!: Ctx;
export const initMath = (c: Ctx) => { X = c; };
/** the times table page (口诀表) of a child */
export const renderTables = (kidId: string) => MT.renderTables(X, kidId);

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const cache = new Map<string, M.KidData>();
const loadKid = async (id: string) => { const d = (await api.readJson<M.KidData>(MM.mathPath(id))) ?? M.EMPTY_KID; cache.set(id, d); return d; };
let curDay = "";   // the day shown on the "today" tab (a new set of topics every day)
let curKid = "";
const today = () => M.todayLocal();
const COLOR = "#1c7ed6";
const known = (id: string) => id in MG.GEN;
const reviewOf = async (id: string) => (await api.readJson<MM.MathReview>(MM.mathReviewPath(id))) ?? MM.EMPTY_MATH_REVIEW;
const distinctTopics = (kid: M.KidData): string[] => [...new Set(kid.weeks.slice().reverse().flatMap((w) => w.chars))];

// ---------- the list of children ----------
export async function renderHome() {
  const my = X.epoch();
  X.showLoading();
  try {
    await X.loadShared();
    await Promise.all(X.kids().kids.map((k) => loadKid(k.id)));
  } catch (e) {
    return my === X.epoch() ? X.showError(e, renderHome) : undefined;
  }
  if (my !== X.epoch()) return;
  const kids = X.kids().kids;
  const hero = h("header", { class: "top hero home-hero subj-hero", style: `--kid:${COLOR}` },
    X.back("#/", "选择学科"),
    h("span", { class: "subj-ico" }, subjectArt("math")),
    h("div", { class: "hero-text" }, h("h1", {}, "数学"), h("p", {}, "请选择孩子")),
    X.gear("#/subject/math"));
  if (!kids.length) {
    return X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero,
      h("main", { class: "scroll" }, h("div", { class: "narrow home-empty empty-home" },
        h("button", { class: "add-big", id: "add-kid-big", title: "添加孩子", "aria-label": "添加孩子", onclick: () => void X.addKid(() => X.route()) }, "＋"),
        h("p", {}, "暂无孩子。请先添加。")))));
  }
  const list = h("div", { class: "kids" });
  for (const k of kids) {
    const n = distinctTopics(cache.get(k.id) ?? M.EMPTY_KID).length;
    const g = P.gradeOf(k.id);
    list.append(h("button", { class: "kid", style: `--kid:${k.color}`, "data-kid": k.id, onclick: () => (location.hash = `#/math/${k.id}`) },
      X.avatarEl(k),
      h("span", { class: "kinfo" }, h("span", { class: "kname user" }, k.name), h("span", { class: "ksub" }, h("span", {}, g ? P.gradeName(g) : "未选年级"), " · ", h("span", {}, `已入库 ${n} 个知识点`))),
      h("span", { class: "chev" }, "›")));
  }
  X.stagger([...list.querySelectorAll<HTMLElement>(".kid")]);
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero, h("main", { class: "scroll" }, h("div", { class: "narrow" }, list))));
}

// ---------- a child ----------
type Tab = "week" | "learned" | "game";

/** a DAY gets its 3 topics once (new topics every day; earlier days are never made up, the future is not made in advance) */
async function ensureWeek(k: M.Kid, start: string): Promise<void> {
  const kid = cache.get(k.id) ?? M.EMPTY_KID;
  if (M.weekOf(kid, start)?.chars.length || start !== today()) return;
  const data = await MM.loadMath();
  const grade = P.gradeOf(k.id) ?? 1;
  const done = toast("正在生成今天的知识点…", 0, true);
  try {
    let added = 0;
    const review = await reviewOf(k.id).catch(() => MM.EMPTY_MATH_REVIEW);   // (a new round of the grade's topics starts with the ones he answered worst)
    const out = await api.update<M.KidData>(MM.mathPath(k.id), M.EMPTY_KID, (cur) => { const r = W.addWeek(cur, start, MM.pickTopics(data, cur, grade, known, MM.WEEKLY_TOPICS, (id) => MM.accuracy(review.topics[id]))); added = r.added; return r.data; }, `math ${k.id} ${start}`);
    cache.set(k.id, out);
    done();
    if (added) toast(`已生成今天的 ${added} 个知识点`);
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}

export async function renderKid(id: string, tab: Tab) {
  const my = X.epoch();
  X.showLoading();
  let data: MM.MathData;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    data = await MM.loadMath();
    await loadKid(id);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderKid(id, tab)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) { toast("未找到该孩子"); return void (location.hash = "#/subject/math"); }
  if (P.gradeOf(id) === null) {
    const g = await pickKidGrade(k);
    if (my !== X.epoch()) return;
    if (g === null) return void (location.hash = "#/subject/math");
    cache.delete(id);
    await loadKid(id);
  }
  if (curKid !== id || !curDay) { curKid = id; curDay = today(); }
  await ensureWeek(k, curDay);
  if (my !== X.epoch()) return;
  const kid = cache.get(id) ?? M.EMPTY_KID;
  const names = new Map(data.topics.map((t) => [t.id, t]));
  const tabs = h("div", { class: "seg tabs" },
    h("button", { class: tab === "game" ? "on" : "", "data-tab": "game", id: "tab-game", onclick: () => (location.hash = `#/math/${id}/game`) }, "游戏"),
    h("button", { class: tab === "week" ? "on" : "", "data-tab": "week", onclick: () => (location.hash = `#/math/${id}`) }, "今天"),
    h("button", { class: tab === "learned" ? "on" : "", "data-tab": "learned", onclick: () => (location.hash = `#/math/${id}/learned`) }, `已入库 ${distinctTopics(kid).length}`));
  const body = h("div", { class: "scroll" });
  const gradeBtn = h("button", { class: "link", id: "grade-btn", title: "修改年级", onclick: () => void changeGrade(k) }, "年级：", P.gradeName(P.gradeOf(id) ?? 1));
  const page = h("div", { class: "page", style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero" }, X.back("#/subject/math", "孩子"), h("h1", { class: "user-title" }, X.avatarEl(k), k.name), shortcuts(k.id, "math")),
    h("div", { class: "tabs-row" }, tabs),
    h("div", { class: "grade-row" }, gradeBtn),
    body);
  X.show(page);
  if (tab === "week") await renderWeek(body, k, kid, names);
  else if (tab === "learned") await renderLearned(body, k, kid, names);
  else await renderLobby(body, k, kid, names);
}

async function changeGrade(k: M.Kid) {
  if ((await pickKidGrade(k)) === null) return;
  cache.delete(k.id);
  toast("年级已记住");
  X.route();
}

/** the card that opens the times table (口诀表): a little coloured table, a title and one line */
const tablesCard = (id: string) => h("button", { class: "mtables-card", id: "tables-card", onclick: () => (location.hash = `#/math/${id}/tables`) },
  h("span", { class: "mtables-ico", "aria-hidden": "true" }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h("i", { style: `--hue:${n * 40}` }, String(n * 2 % 10 || 9)))),
  h("span", { class: "mtables-txt" }, h("b", {}, "口诀表"), h("span", {}, "点一点听口诀，再练一练")));

const chip = (a: number | null) => h("span", { class: "macc" + (a === null ? " none" : a >= 80 ? " good" : a >= 50 ? " mid" : " low") }, a === null ? "还没练过" : `答对率 ${a}%`);

function topicCard(id: string, names: Map<string, MM.Topic>, review: MM.MathReview, onPractice?: () => void): HTMLElement {
  const t = names.get(id);
  return h("div", { class: "mtcard", "data-topic": id },
    h("div", { class: "mtinfo" }, h("b", { class: "mtname user" }, t?.name ?? id), h("span", { class: "mtdesc user" }, t?.desc ?? ""), chip(MM.accuracy(review.topics[id]))),
    onPractice ? h("button", { class: "primary mpractice", "data-topic": id, onclick: onPractice }, "练习") : null);
}

async function renderWeek(body: HTMLElement, k: M.Kid, kid: M.KidData, names: Map<string, MM.Topic>) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: MM.MathReview;
  try { review = await reviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const t = today();
  const days = [...new Set([...kid.weeks.filter((w) => w.chars.length).map((w) => w.start), t])].sort();
  const at = days.indexOf(curDay);
  const go = async (day: string) => { curDay = day; await ensureWeek(k, day); void renderWeek(body, k, cache.get(k.id) ?? M.EMPTY_KID, names); };
  const bar = h("div", { class: "weekbar" },
    h("button", { class: "icon", title: "前一天", "aria-label": "前一天", disabled: at <= 0, onclick: () => void go(days[at - 1]) }, "‹"),
    h("div", { class: "wlabel", id: "week-label" }, h("strong", {}, curDay === t ? "今天" : curDay), h("span", { class: "muted" }, curDay === t ? curDay : "")),
    h("button", { class: "icon", title: "后一天", "aria-label": "后一天", disabled: at < 0 || at >= days.length - 1, onclick: () => void go(days[at + 1]) }, "›"));
  const list = M.weekOf(kid, curDay)?.chars ?? [];
  body.replaceChildren(h("div", { class: "narrow week-narrow" }, bar,
    curDay === t ? null : h("button", { class: "link", onclick: () => void go(t) }, "回到今天"),
    tablesCard(k.id),
    h("div", { class: "sec-row" }, h("h2", { class: "sec" }, `知识点（${list.length}）`)),
    list.length ? h("div", { class: "mtlist" }, ...X.stagger(list.map((id) => topicCard(id, names, review, () => practice(k, [id], names))))) : h("p", { class: "empty" }, "该日暂无知识点。")));
}

async function renderLearned(body: HTMLElement, k: M.Kid, kid: M.KidData, names: Map<string, MM.Topic>) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: MM.MathReview;
  try { review = await reviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const all = distinctTopics(kid);
  const mistakes = review.mistakes ?? [];
  const book = h("div", { class: "mmistakes", id: "mistakes" },
    h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "mistakes-title" }, `错题本（${mistakes.length}）`),
      mistakes.length ? h("button", { class: "sheet-btn", id: "redo-mistakes", onclick: () => playMistakes(k, mistakes, names) }, "重做错题") : null),
    mistakes.length
      ? h("div", {}, ...mistakes.slice(0, 20).map((m) => { const q = h("span", { class: "user" }), a = h("b", { class: "user" }); renderRich(q, m.q, !/[　-〿一-鿿＀-￯]/.test(m.q)); renderRich(a, m.a, true); if (!m.fig) return h("div", { class: "mmis", "data-topic": m.topic }, q, a); const fig = h("div", { class: "mmis-fig" }); mountFig(fig, m.fig); return h("div", { class: "mmis has-fig", "data-topic": m.topic }, fig, h("div", { class: "mmis-txt" }, q), a); }))
      : h("p", { class: "muted small" }, "还没有错题。"));
  body.replaceChildren(h("div", { class: "narrow" }, book,
    all.length ? h("div", { class: "mtlist" }, ...X.stagger(all.map((id) => topicCard(id, names, review)))) : h("p", { class: "empty" }, "暂无已入库的知识点。请先查看“本周”。")));
}

/** the errors book: the wrong questions again (the choices are shuffled anew); a right answer takes a question out of the book */
function playMistakes(k: M.Kid, mistakes: MG.Q[], names: Map<string, MM.Topic>) {
  const questions = mistakes.slice(0, 20).map((q) => ({ ...q, choices: q.choices.length === 3 ? q.choices : [...q.choices].sort(() => Math.random() - 0.5) }));
  playQuestions(k, questions, questions.reduce((s, q) => s + MG.secOf(q.topic), 0), names, () => void reviewOf(k.id).then((r) => playMistakes(k, r.mistakes ?? [], names)));
}

// ---------- games ----------
function playQuestions(k: M.Kid, questions: MG.Q[], seconds: number, names: Map<string, MM.Topic>, again: () => void) {
  openMathGame({
    color: k.color, questions, seconds, mode: MS.loadMathSettings().mode, pad: true,
    topicName: (id) => names.get(id)?.name ?? id,
    onSave: async (answers, score, total, used, finished) => {
      const done = toast("正在保存…", 0, true);
      try {
        await api.update<MM.MathReview>(MM.mathReviewPath(k.id), MM.EMPTY_MATH_REVIEW, (cur) => MM.applyMath(cur, answers, M.todayLocal(), finished ? { score, total, seconds: used } : undefined), `math game ${k.id}`);
        done();
        toast("已记录这次练习");
      } catch (e) {
        done();
        toast(errText(e), 6000);
      }
    },
    onAgain: again,
    onClose: () => X.route(),
  });
}
/** a quick practice of one topic from the week page: 10 questions */
function practice(k: M.Kid, topics: string[], names: Map<string, MM.Topic>) {
  const questions = MG.makeSet(topics, MM.PRACTICE_QUESTIONS);
  playQuestions(k, questions, questions.reduce((s, q) => s + MG.secOf(q.topic), 0), names, () => practice(k, topics, names));
}
/** the game: today's topics (+ a few of the topics of the day before) */
function play(k: M.Kid, kid: M.KidData, names: Map<string, MM.Topic>) {
  const day = latestWeek(kid);
  if (!day) return X.route();
  const g = MM.buildGame(M.weekOf(kid, day)?.chars ?? [], dayBefore(kid, day));
  const minutes = MS.loadMathSettings().minutes;
  playQuestions(k, g.questions, minutes ? minutes * 60 : g.seconds, names, () => void api.readJson<M.KidData>(MM.mathPath(k.id)).then((d) => play(k, d ?? kid, names)));
}
/** the day to play: the newest day that has started and has topics (older data made WEEKLY works the same way: a "day" is any entry) */
const latestWeek = (kid: M.KidData): string | null => {
  const now = today();
  const days = kid.weeks.filter((w) => w.chars.length && w.start <= now).map((w) => w.start).sort();
  return days.length ? days[days.length - 1] : null;
};
/** the topics of the entry before this day (the last day he had topics), to mix a few into the game */
const dayBefore = (kid: M.KidData, day: string): string[] => {
  const before = kid.weeks.filter((w) => w.chars.length && w.start < day).sort((a, b) => (a.start < b.start ? -1 : 1));
  return before.length ? before[before.length - 1].chars : [];
};

async function renderLobby(body: HTMLElement, k: M.Kid, kid: M.KidData, names: Map<string, MM.Topic>) {
  const day = latestWeek(kid);
  const todays = day ? M.weekOf(kid, day)?.chars ?? [] : [];
  const prev = day ? dayBefore(kid, day) : [];
  const topics = MM.gameTopics(todays, prev);
  const set = MS.loadMathSettings();
  const auto = Math.max(1, Math.round(topics.reduce((s, t) => s + MG.secOf(t), 0) / 60));
  const minutes = set.minutes || auto;
  const change = (patch: Partial<MS.MathSettings>) => { MS.saveMathSettings({ ...set, ...patch }); void renderLobby(body, k, kid, names); };
  const opt = (on: boolean, label: string, id: string, onclick: () => void) => h("button", { class: "mopt" + (on ? " on" : ""), "data-opt": id, onclick }, label);
  const settings = h("div", { class: "msettings", id: "math-settings" },
    h("div", { class: "mset-row" }, h("b", {}, "总时间"), h("div", { class: "mset-opts", id: "set-time" },
      ...MS.MINUTES.map((m) => opt(set.minutes === m, m ? `${m} 分钟` : "自动", String(m), () => change({ minutes: m }))))),
    h("div", { class: "mset-row" }, h("b", {}, "答题方式"), h("div", { class: "mset-opts", id: "set-mode" },
      opt(set.mode === "choice", "四选一", "choice", () => change({ mode: "choice" })), opt(set.mode === "keypad", "键盘输入", "keypad", () => change({ mode: "keypad" })))));
  body.replaceChildren(h("div", { class: "narrow lobby" },
    h("div", { class: "lobby-hero" }, h("span", { class: "mascot big" }, mascot()), h("h2", {}, "准备好了吗？")),
    topics.length ? h("p", { class: "muted center", id: "math-info" }, `共 ${topics.length} 题，限时约 ${minutes} 分钟`) : h("p", { class: "empty" }, "暂无知识点。请先查看“今天”。"),
    settings,
    tablesCard(k.id),
    h("div", { class: "lobby-go" }, h("button", { class: "primary wide", id: "game-start", disabled: topics.length === 0, onclick: () => play(k, kid, names) }, "开始游戏"))));
}
