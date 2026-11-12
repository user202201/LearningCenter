/**
 * English, part 1: the words. The screens are the same as in 识字: the list of children -> a child with three tabs (Game | This week | Recorded).
 * Every week 20 new words are picked by the child's grade (words.ts) and recorded in `english/<kid>.json`; the game is the same game as in 识字
 * (game.ts rules, gameui.ts screen in "words" mode), its progress is in `english/<kid>.review.json`.
 */
import { h, toast } from "./ui";
import * as M from "./model";
import * as G from "./game";
import * as api from "./api";
import * as P from "./profile";
import * as W from "./words";
import { askGrade } from "./gradeui";
import { openGame } from "./gameui";
import { mascot } from "./art";
import { subjectArt } from "./hub";

/** what the English screens need from the app shell (main.ts) */
export interface Ctx {
  show(v: HTMLElement): void;
  showLoading(): void;
  showError(e: unknown, retry: () => void): void;
  loadShared(): Promise<void>;
  kids(): M.KidsFile;
  avatarEl(k: M.Kid): HTMLElement;
  back(to: string, label?: string): HTMLElement;
  gear(back: string): HTMLElement;
  stagger<T extends HTMLElement>(els: T[]): T[];
  epoch(): number;
  gameSeconds(): number;
  route(): void;
  addKid(after: () => void): Promise<unknown>;
}
let X!: Ctx;
export const initEnglish = (c: Ctx) => { X = c; };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const cache = new Map<string, M.KidData>();
const loadKid = async (id: string) => { const d = (await api.readJson<M.KidData>(W.wordsPath(id))) ?? M.EMPTY_KID; cache.set(id, d); return d; };
let curWeek = "";
let curKid = "";
const FALLBACK_GRADE = 3;
const gradeFor = (id: string) => P.gradeOf(id) ?? FALLBACK_GRADE;
const todayWeek = () => M.sundayOf(M.todayLocal());

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
  const hero = h("header", { class: "top hero home-hero subj-hero", style: "--kid:#2f9e44" },
    X.back("#/", "选择学科"),
    h("span", { class: "subj-ico" }, subjectArt("english")),
    h("div", { class: "hero-text" }, h("h1", {}, "英语"), h("p", {}, "今天背几个单词？")),
    X.gear("#/subject/english"));
  if (!kids.length) {
    return X.show(h("div", { class: "page", style: "--kid:#2f9e44" }, hero,
      h("main", { class: "scroll" }, h("div", { class: "narrow home-empty empty-home" },
        h("button", { class: "add-big", id: "add-kid-big", title: "添加孩子", "aria-label": "添加孩子", onclick: () => void X.addKid(() => X.route()) }, "＋"),
        h("p", {}, "还没有孩子，先添加一个吧。")))));
  }
  const list = h("div", { class: "kids" });
  for (const k of kids) {
    const n = M.allChars(cache.get(k.id) ?? M.EMPTY_KID).length;
    list.append(h("button", { class: "kid", style: `--kid:${k.color}`, "data-kid": k.id, onclick: () => (location.hash = `#/english/${k.id}`) },
      X.avatarEl(k),
      h("span", { class: "kinfo" }, h("span", { class: "kname user" }, k.name), h("span", { class: "ksub" }, h("span", {}, P.gradeName(gradeFor(k.id))), " · ", h("span", {}, `已入库 ${n} 词`))),
      h("span", { class: "chev" }, "›")));
  }
  X.stagger([...list.querySelectorAll<HTMLElement>(".kid")]);
  X.show(h("div", { class: "page", style: "--kid:#2f9e44" }, hero, h("main", { class: "scroll" }, h("div", { class: "narrow" }, list))));
}

// ---------- a child ----------
type Tab = "week" | "learned" | "game";

/** a week gets its 20 words once: only this week and next week are generated (earlier weeks that were never opened stay empty) */
async function ensureWeek(k: M.Kid, start: string): Promise<void> {
  const kid = cache.get(k.id) ?? M.EMPTY_KID;
  const t = todayWeek();
  if (M.weekOf(kid, start)?.chars.length || start < t || start > M.addDays(t, 7)) return;
  const all = await W.loadWords();
  const grade = gradeFor(k.id);
  const done = toast("正在生成这一周的单词…", 0, true);
  try {
    let added = 0;
    const data = await api.update<M.KidData>(W.wordsPath(k.id), M.EMPTY_KID, (cur) => { const r = W.addWeek(cur, start, W.pickWords(all, cur, grade)); added = r.added; return r.data; }, `english ${k.id} ${start}`);
    cache.set(k.id, data);
    done();
    if (added) toast(`已生成这一周的 ${added} 个单词`);
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}

export async function renderKid(id: string, tab: Tab) {
  const my = X.epoch();
  X.showLoading();
  let words: W.Word[];
  try {
    if (!X.kids().kids.length) await X.loadShared();
    words = await W.loadWords();
    await loadKid(id);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderKid(id, tab)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) { toast("找不到这个孩子"); return void (location.hash = "#/subject/english"); }
  if (curKid !== id || !curWeek) { curKid = id; curWeek = todayWeek(); }
  await ensureWeek(k, curWeek);
  if (my !== X.epoch()) return;
  const kid = cache.get(id) ?? M.EMPTY_KID;
  const map = W.wordMap(words);
  const n = M.allChars(kid).length;
  const tabs = h("div", { class: "seg tabs" },
    h("button", { class: tab === "game" ? "on" : "", "data-tab": "game", id: "tab-game", onclick: () => (location.hash = `#/english/${id}/game`) }, "游戏"),
    h("button", { class: tab === "week" ? "on" : "", "data-tab": "week", onclick: () => (location.hash = `#/english/${id}`) }, "本周"),
    h("button", { class: tab === "learned" ? "on" : "", "data-tab": "learned", onclick: () => (location.hash = `#/english/${id}/learned`) }, `已入库 ${n}`));
  const body = h("div", { class: "scroll" });
  const gradeBtn = h("button", { class: "link", id: "grade-btn", title: "修改年级", onclick: () => void changeGrade(k) }, "年级：", P.gradeName(gradeFor(id)));
  const page = h("div", { class: "page", style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero" }, X.back("#/subject/english", "孩子"), h("h1", { class: "user-title" }, X.avatarEl(k), k.name), h("span", { class: "slot" })),
    h("div", { class: "tabs-row" }, tabs),
    h("div", { class: "grade-row" }, gradeBtn),
    body);
  const order: Tab[] = ["game", "week", "learned"];
  let from: { x: number; y: number } | null = null;
  page.addEventListener("touchstart", (e) => { from = e.touches.length === 1 && !(e.target as HTMLElement).closest("dialog, input, textarea") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  page.addEventListener("touchend", (e) => {
    if (!from || document.querySelector("dialog[open]")) return;
    const dx = e.changedTouches[0].clientX - from.x, dy = e.changedTouches[0].clientY - from.y;
    from = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const to = order[order.indexOf(tab) + (dx < 0 ? 1 : -1)];
    if (to) location.hash = to === "week" ? `#/english/${id}` : `#/english/${id}/${to}`;
  }, { passive: true });
  X.show(page);
  if (tab === "week") renderWeek(body, k, kid, map);
  else if (tab === "learned") renderLearned(body, kid, map);
  else void renderLobby(body, k, kid, map);
}

/** one word: the word, its phonetics, the part of speech and the meaning; a tap says it aloud */
function wordRow(w: string, map: Map<string, W.Word>): HTMLElement {
  const x = map.get(W.wordKey(w));
  const row = h("div", { class: "wrow tappable", "data-w": w, role: "button", tabindex: "0" },
    h("span", { class: "wmain" }, h("b", { class: "wword user" }, w), x?.ph ? h("span", { class: "wph user" }, `/${x.ph}/`) : null),
    h("span", { class: "wzh user" }, x?.pos ? h("i", { class: "wpos" }, x.pos) : null, x?.zh ?? ""));
  row.addEventListener("click", () => W.speak(w));
  row.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), row.click()));
  return row;
}

function renderWeek(body: HTMLElement, k: M.Kid, kid: M.KidData, map: Map<string, W.Word>) {
  body.replaceChildren();
  const t = todayWeek();
  const anchor = kid.weeks[0]?.start ?? curWeek;
  const lowest = [t, ...kid.weeks.map((x) => x.start)].sort()[0];
  const highest = [M.addDays(t, 7), ...kid.weeks.map((x) => x.start)].sort().at(-1)!;
  const go = async (start: string) => {
    curWeek = start;
    await ensureWeek(k, start);
    renderWeek(body, k, cache.get(k.id) ?? M.EMPTY_KID, map);
  };
  const bar = h("div", { class: "weekbar" },
    h("button", { class: "icon", title: "上一周", "aria-label": "上一周", disabled: curWeek <= lowest, onclick: () => void go(M.addDays(curWeek, -7)) }, "‹"),
    h("div", { class: "wlabel", id: "week-label" }, h("strong", {}, `第${M.weekNo(curWeek, anchor)}周`), h("span", { class: "muted" }, `${curWeek} ~ ${M.addDays(curWeek, 6)}`)),
    h("button", { class: "icon", title: "下一周", "aria-label": "下一周", disabled: curWeek >= highest, onclick: () => void go(M.addDays(curWeek, 7)) }, "›"));
  const list = M.weekOf(kid, curWeek)?.chars ?? [];
  body.append(h("div", { class: "narrow week-narrow" }, bar,
    curWeek === t ? null : h("button", { class: "link", onclick: () => void go(t) }, "回到本周"),
    h("div", { class: "sec-row" }, h("h2", { class: "sec" }, `单词（${list.length}）`)),
    list.length ? h("div", { class: "wlist" }, ...X.stagger(list.map((w) => wordRow(w, map)))) : h("p", { class: "empty" }, "这一周没有单词。")));
}

function renderLearned(body: HTMLElement, kid: M.KidData, map: Map<string, W.Word>) {
  body.className = "scroll";
  const anchor = kid.weeks[0]?.start;
  const weeks = kid.weeks.filter((w) => w.chars.length).slice().reverse();
  body.replaceChildren(h("div", { class: "narrow" },
    weeks.length
      ? h("div", {}, ...weeks.map((w) => h("section", { class: "wweek", "data-week": w.start },
          h("h3", { class: "sec" }, `第${M.weekNo(w.start, anchor)}周`, h("span", { class: "muted small" }, ` ${w.start}`)),
          h("div", { class: "wlist" }, ...w.chars.map((c) => wordRow(c, map))))))
      : h("p", { class: "empty" }, "还没有入库的单词，先去“本周”看看吧。")));
}

async function changeGrade(k: M.Kid) {
  let cleared = false;
  const extra = P.hasOwnGrade(k.id) ? h("button", { class: "link", id: "grade-default", onclick: (e: Event) => { cleared = true; (e.target as HTMLElement).closest("dialog")?.close(); } }, "改回和大家一样的年级") : undefined;
  const g = await askGrade(`${k.name}读几年级？`, gradeFor(k.id), "只改这个孩子；每年 9 月会自动升一级。", extra);
  if (cleared) { P.clearKidGrade(k.id); toast("年级已改回和大家一样"); return X.route(); }
  if (g === null) return;   // cancelled: nothing changes, no message
  P.setKidGrade(k.id, g);
  toast("年级已记住");
  X.route();
}

// ---------- the game ----------
function gameQueue(kid: M.KidData, review: G.Review): G.Q[] {
  const week = G.gameWeek(kid, M.todayLocal());
  if (!week) return [];
  const thisWeek = M.weekOf(kid, week)?.chars ?? [];
  return G.buildQueue(thisWeek, week, G.pickReview(kid, review, week, M.todayLocal()));
}
async function saveGame(k: M.Kid, results: G.Result[], score: number, total: number, finished: boolean) {
  const done = toast("正在保存…", 0, true);
  try {
    await api.update<G.Review>(W.wordsReviewPath(k.id), G.EMPTY_REVIEW, (cur) => G.applyResults(cur, results, M.todayLocal(), finished ? { score, total } : undefined), `english game ${k.id}`);
    done();
    toast("已记录这次练习");
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}
function play(k: M.Kid, queue: G.Q[], map: Map<string, W.Word>) {
  openGame({
    color: k.color, seconds: X.gameSeconds(), queue,
    words: { meaning: (w) => map.get(W.wordKey(w))?.zh ?? "", speak: W.speak },
    onSave: (results, score, total, finished) => saveGame(k, results, score, total, finished),
    onAgain: () => void startGame(k, map),
    onClose: () => X.route(),
  });
}
async function startGame(k: M.Kid, map: Map<string, W.Word>) {
  try {
    const kid = await loadKid(k.id);
    const review = (await api.readJson<G.Review>(W.wordsReviewPath(k.id))) ?? G.EMPTY_REVIEW;
    const q = gameQueue(kid, review);
    if (q.length) play(k, q, map); else X.route();
  } catch (e) {
    toast(errText(e), 6000);
    X.route();
  }
}
async function renderLobby(body: HTMLElement, k: M.Kid, kid: M.KidData, map: Map<string, W.Word>) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: G.Review;
  try {
    review = (await api.readJson<G.Review>(W.wordsReviewPath(k.id))) ?? G.EMPTY_REVIEW;
  } catch (e) {
    if (my !== X.epoch()) return;
    return void body.replaceChildren(h("div", { class: "center-msg" }, h("p", { class: "err" }, errText(e)), h("button", { class: "primary", onclick: () => void renderLobby(body, k, kid, map) }, "重试")));
  }
  if (my !== X.epoch()) return;
  const q = gameQueue(kid, review);
  body.replaceChildren(h("div", { class: "narrow lobby" },
    h("div", { class: "lobby-hero" }, h("span", { class: "mascot big" }, mascot()), h("h2", {}, "准备好了吗？")),
    q.length ? null : h("p", { class: "empty" }, "还没有单词，先到“本周”看看吧。"),
    h("div", { class: "lobby-go" }, h("button", { class: "primary wide", id: "game-start", disabled: q.length === 0, onclick: () => play(k, gameQueue(kid, review), map) }, "开始游戏"))));
}
