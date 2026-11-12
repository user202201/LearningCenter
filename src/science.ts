/**
 * Science, part 1. The screens are the same as in the other subjects: the list of children -> a child with Game | This week | Recorded; the game is the
 * math game's screen (a total time, four choices). Besides: the periodic table (`#/science/periodic`) and the formulas / equations (`#/science/formulas`),
 * for everybody (no child needed). Everything is in the program, nothing is fetched.
 */
import { h, toast, modal } from "./ui";
import * as M from "./model";
import * as api from "./api";
import * as P from "./profile";
import * as W from "./words";
import * as MM from "./mathmodel";
import * as SM from "./sciencemodel";
import { pickKidGrade } from "./gradeui";
import { openMathGame } from "./mathui";
import { mascot } from "./art";
import { subjectArt } from "./hub";
import type { Ctx } from "./english";

let X!: Ctx;
export const initScience = (c: Ctx) => { X = c; };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const cache = new Map<string, M.KidData>();
const loadKid = async (id: string) => { const d = (await api.readJson<M.KidData>(SM.sciencePath(id))) ?? M.EMPTY_KID; cache.set(id, d); return d; };
let curWeek = "";
let curKid = "";
const todayWeek = () => M.sundayOf(M.todayLocal());
const COLOR = "#7048e8";
const reviewOf = async (id: string) => (await api.readJson<MM.MathReview>(SM.scienceReviewPath(id))) ?? MM.EMPTY_MATH_REVIEW;
const allIds = (kid: M.KidData): string[] => [...new Set(kid.weeks.slice().reverse().flatMap((w) => w.chars))];

// ---------- the list of children (+ the two reference pages) ----------
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
    h("span", { class: "subj-ico" }, subjectArt("science")),
    h("div", { class: "hero-text" }, h("h1", {}, "科学"), h("p", {}, "今天探索什么？")),
    X.gear("#/subject/science"));
  const refs = h("div", { class: "sci-refs" },
    h("button", { class: "sci-ref", id: "open-periodic", onclick: () => (location.hash = "#/science/periodic") }, h("b", {}, "元素周期表"), h("span", { class: "muted small" }, "118 个元素")),
    h("button", { class: "sci-ref", id: "open-formulas", onclick: () => (location.hash = "#/science/formulas") }, h("b", {}, "公式与方程式"), h("span", { class: "muted small" }, "物理 · 化学")));
  const list = h("div", { class: "kids" });
  for (const k of kids) {
    const n = allIds(cache.get(k.id) ?? M.EMPTY_KID).length;
    const g = P.gradeOf(k.id);
    list.append(h("button", { class: "kid", style: `--kid:${k.color}`, "data-kid": k.id, onclick: () => (location.hash = `#/science/${k.id}`) },
      X.avatarEl(k),
      h("span", { class: "kinfo" }, h("span", { class: "kname user" }, k.name), h("span", { class: "ksub" }, h("span", {}, g ? P.gradeName(g) : "未选年级"), " · ", h("span", {}, `已入库 ${n} 张知识卡`))),
      h("span", { class: "chev" }, "›")));
  }
  X.stagger([...list.querySelectorAll<HTMLElement>(".kid")]);
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero, h("main", { class: "scroll" }, h("div", { class: "narrow" },
    kids.length ? list : h("div", { class: "home-empty empty-home" }, h("button", { class: "add-big", id: "add-kid-big", title: "添加孩子", "aria-label": "添加孩子", onclick: () => void X.addKid(() => X.route()) }, "＋"), h("p", {}, "还没有孩子，先添加一个吧。")),
    refs))));
}

// ---------- a child ----------
type Tab = "week" | "learned" | "game";

async function ensureWeek(k: M.Kid, start: string, lib: SM.Library): Promise<void> {
  const kid = cache.get(k.id) ?? M.EMPTY_KID;
  const t = todayWeek();
  if (M.weekOf(kid, start)?.chars.length || start < t || start > M.addDays(t, 7)) return;
  const grade = P.gradeOf(k.id) ?? 1;
  const done = toast("正在生成这一周的知识卡…", 0, true);
  try {
    let added = 0;
    const review = await reviewOf(k.id).catch(() => MM.EMPTY_MATH_REVIEW);
    const wrong = new Set((review.mistakes ?? []).map((m) => m.q));
    const out = await api.update<M.KidData>(SM.sciencePath(k.id), M.EMPTY_KID, (cur) => { const r = W.addWeek(cur, start, SM.pickCards(lib, cur, grade, (id) => wrong.has(lib.byId.get(id)?.q ?? ""))); added = r.added; return r.data; }, `science ${k.id} ${start}`);
    cache.set(k.id, out);
    done();
    if (added) toast(`已生成这一周的 ${added} 张知识卡`);
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}

export async function renderKid(id: string, tab: Tab) {
  const my = X.epoch();
  X.showLoading();
  let lib: SM.Library;
  try {
    if (!X.kids().kids.length) await X.loadShared();
    lib = await SM.loadScience();
    await loadKid(id);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderKid(id, tab)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) { toast("找不到这个孩子"); return void (location.hash = "#/subject/science"); }
  if (P.gradeOf(id) === null) {
    const g = await pickKidGrade(k);
    if (my !== X.epoch()) return;
    if (g === null) return void (location.hash = "#/subject/science");
    cache.delete(id);
    await loadKid(id);
  }
  if (curKid !== id || !curWeek) { curKid = id; curWeek = todayWeek(); }
  await ensureWeek(k, curWeek, lib);
  if (my !== X.epoch()) return;
  const kid = cache.get(id) ?? M.EMPTY_KID;
  const tabs = h("div", { class: "seg tabs" },
    h("button", { class: tab === "game" ? "on" : "", "data-tab": "game", id: "tab-game", onclick: () => (location.hash = `#/science/${id}/game`) }, "游戏"),
    h("button", { class: tab === "week" ? "on" : "", "data-tab": "week", onclick: () => (location.hash = `#/science/${id}`) }, "本周"),
    h("button", { class: tab === "learned" ? "on" : "", "data-tab": "learned", onclick: () => (location.hash = `#/science/${id}/learned`) }, `已入库 ${allIds(kid).length}`));
  const body = h("div", { class: "scroll" });
  const gradeBtn = h("button", { class: "link", id: "grade-btn", title: "修改年级", onclick: () => void changeGrade(k) }, "年级：", P.gradeName(P.gradeOf(id) ?? 1));
  X.show(h("div", { class: "page", style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero" }, X.back("#/subject/science", "孩子"), h("h1", { class: "user-title" }, X.avatarEl(k), k.name), h("span", { class: "slot" })),
    h("div", { class: "tabs-row" }, tabs), h("div", { class: "grade-row" }, gradeBtn), body));
  if (tab === "week") await renderWeek(body, k, kid, lib);
  else if (tab === "learned") await renderLearned(body, k, kid, lib);
  else renderLobby(body, k, kid, lib);
}

async function changeGrade(k: M.Kid) {
  if ((await pickKidGrade(k)) === null) return;
  cache.delete(k.id);
  toast("年级已记住");
  X.route();
}

/** a card: the topic, the question; a tap shows / hides the answer */
function cardEl(c: SM.Card, lib: SM.Library): HTMLElement {
  const ans = h("div", { class: "sans user" }, h("b", {}, c.a), h("span", { class: "sfun" }, c.e));
  const el = h("div", { class: "scard tappable", "data-card": c.id, role: "button", tabindex: "0" },
    h("span", { class: "stopic" }, lib.topics[c.t] ?? c.t), h("b", { class: "sq user" }, c.q), ans);
  const flip = () => el.classList.toggle("open");
  el.addEventListener("click", flip);
  el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), flip()));
  return el;
}

async function renderWeek(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: SM.Library) {
  const t = todayWeek();
  const anchor = kid.weeks[0]?.start ?? curWeek;
  const lowest = [t, ...kid.weeks.map((x) => x.start)].sort()[0];
  const highest = [M.addDays(t, 7), ...kid.weeks.map((x) => x.start)].sort().at(-1)!;
  const go = async (start: string) => { curWeek = start; await ensureWeek(k, start, lib); void renderWeek(body, k, cache.get(k.id) ?? M.EMPTY_KID, lib); };
  const bar = h("div", { class: "weekbar" },
    h("button", { class: "icon", title: "上一周", "aria-label": "上一周", disabled: curWeek <= lowest, onclick: () => void go(M.addDays(curWeek, -7)) }, "‹"),
    h("div", { class: "wlabel", id: "week-label" }, h("strong", {}, `第${M.weekNo(curWeek, anchor)}周`), h("span", { class: "muted" }, `${curWeek} ~ ${M.addDays(curWeek, 6)}`)),
    h("button", { class: "icon", title: "下一周", "aria-label": "下一周", disabled: curWeek >= highest, onclick: () => void go(M.addDays(curWeek, 7)) }, "›"));
  const ids = M.weekOf(kid, curWeek)?.chars ?? [];
  const cards = ids.map((i) => lib.byId.get(i)).filter((c): c is SM.Card => !!c);
  body.replaceChildren(h("div", { class: "narrow week-narrow" }, bar,
    curWeek === t ? null : h("button", { class: "link", onclick: () => void go(t) }, "回到本周"),
    h("div", { class: "sec-row" }, h("h2", { class: "sec" }, `知识卡（${cards.length}）`), cards.length ? h("span", { class: "muted small" }, "点一下看答案") : null),
    cards.length ? h("div", { class: "slist" }, ...X.stagger(cards.map((c) => cardEl(c, lib)))) : h("p", { class: "empty" }, "这一周没有知识卡。")));
}

async function renderLearned(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: SM.Library) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: MM.MathReview;
  try { review = await reviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const mistakes = review.mistakes ?? [];
  const all = allIds(kid);
  const show = () => {
    const sample = [...all].sort(() => Math.random() - 0.5).slice(0, W.RECORDED_SAMPLE).map((i) => lib.byId.get(i)).filter((c): c is SM.Card => !!c);
    const book = h("div", { class: "mmistakes", id: "mistakes" },
      h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "mistakes-title" }, `错题本（${mistakes.length}）`),
        mistakes.length ? h("button", { class: "sheet-btn", id: "redo-mistakes", onclick: () => playQuestions(k, mistakes.slice(0, 20).map((q) => ({ ...q, choices: [...q.choices].sort(() => Math.random() - 0.5) })), lib, () => X.route()) }, "重做错题") : null),
      mistakes.length ? h("div", {}, ...mistakes.slice(0, 20).map((m) => h("div", { class: "mmis", "data-topic": m.topic }, h("span", { class: "user" }, m.q), h("b", { class: "user" }, m.a)))) : h("p", { class: "muted small" }, "还没有错题。"));
    body.replaceChildren(h("div", { class: "narrow" }, book,
      all.length
        ? h("div", {},
            h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "sample-title" }, `随机 ${sample.length} 张`), h("span", { class: "muted small" }, `共 ${all.length} 张`),
              all.length > sample.length ? h("button", { class: "sheet-btn", id: "reshuffle", onclick: show }, "换一批") : null),
            h("div", { class: "slist" }, ...X.stagger(sample.map((c) => cardEl(c, lib)))))
        : h("p", { class: "empty" }, "还没有入库的知识卡，先去“本周”看看吧。")));
  };
  show();
}

// ---------- the game ----------
function playQuestions(k: M.Kid, questions: ReturnType<typeof SM.cardToQ>[], lib: SM.Library, again: () => void) {
  const byQ = new Map(lib.cards.map((c) => [c.q, c]));
  openMathGame({
    color: k.color, questions, seconds: questions.length * SM.SEC_PER_QUESTION,
    relaxed: true, explain: (q) => byQ.get(q.q)?.e ?? "",
    topicName: (id) => lib.topics[id] ?? id,
    onSave: async (answers, score, total, used, finished) => {
      const done = toast("正在保存…", 0, true);
      try {
        await api.update<MM.MathReview>(SM.scienceReviewPath(k.id), MM.EMPTY_MATH_REVIEW, (cur) => MM.applyMath(cur, answers, M.todayLocal(), finished ? { score, total, seconds: used } : undefined), `science game ${k.id}`);
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
const latestWeek = (kid: M.KidData): string | null => {
  const now = todayWeek();
  const weeks = kid.weeks.filter((w) => w.chars.length && w.start <= now).map((w) => w.start).sort();
  return weeks.length ? weeks[weeks.length - 1] : null;
};
function renderLobby(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: SM.Library) {
  const week = latestWeek(kid);
  const thisWeek = week ? M.weekOf(kid, week)?.chars ?? [] : [];
  const prev = week ? M.weekOf(kid, M.addDays(week, -7))?.chars ?? [] : [];
  const n = thisWeek.length + (prev.length ? Math.min(SM.GAME_PREVIOUS, prev.length) : 0);
  const start = () => {
    const g = SM.buildGame(lib, thisWeek, prev);
    playQuestions(k, g.questions, lib, () => void api.readJson<M.KidData>(SM.sciencePath(k.id)).then((d) => { const wk = latestWeek(d ?? kid); const gg = SM.buildGame(lib, (wk && M.weekOf(d ?? kid, wk)?.chars) || thisWeek, (wk && M.weekOf(d ?? kid, M.addDays(wk, -7))?.chars) || []); playQuestions(k, gg.questions, lib, () => X.route()); }));
  };
  body.replaceChildren(h("div", { class: "narrow lobby" },
    h("div", { class: "lobby-hero" }, h("span", { class: "mascot big" }, mascot()), h("h2", {}, "准备好了吗？")),
    n ? h("p", { class: "muted center", id: "math-info" }, `共 ${n} 题，不限时，慢慢来`) : h("p", { class: "empty" }, "还没有知识卡，先到“本周”看看吧。"),
    h("div", { class: "lobby-go" }, h("button", { class: "primary wide", id: "game-start", disabled: n === 0, onclick: start }, "开始游戏"))));
}

// ---------- the periodic table ----------
const CATS: Record<string, string> = { alkali: "碱金属", alkaline: "碱土金属", transition: "过渡金属", post: "后过渡金属", metalloid: "类金属", nonmetal: "非金属", halogen: "卤素", noble: "稀有气体", lanthanide: "镧系", actinide: "锕系" };

export async function renderPeriodic() {
  const lib = await SM.loadScience();
  let juniorOnly = false;
  const grid = h("div", { class: "pt-grid", id: "pt-grid" });
  const draw = () => {
    grid.replaceChildren(...lib.elements.map((e) => h("button", { class: `pt-cell cat-${e.cat}` + (juniorOnly && !e.junior ? " dim" : ""), "data-n": String(e.n), style: `grid-row:${e.row};grid-column:${e.col}`, title: e.zh, "aria-label": e.zh, onclick: () => void details(e) },
      h("small", {}, String(e.n)), h("b", {}, e.sym), h("span", { class: "user" }, e.zh))));
  };
  const chip = (label: string, id: string, on: () => void, active: () => boolean) => { const b = h("button", { class: "mopt" + (active() ? " on" : ""), id, onclick: () => { on(); chips.forEach((c) => c.refresh()); } }, label); return { el: b, refresh: () => b.classList.toggle("on", active()) }; };
  const chips = [chip("全部", "pt-all", () => { juniorOnly = false; draw(); }, () => !juniorOnly), chip("初中常考", "pt-junior", () => { juniorOnly = true; draw(); }, () => juniorOnly)];
  draw();
  const legend = h("div", { class: "pt-legend" }, ...Object.entries(CATS).map(([c, name]) => h("span", { class: "pt-key" }, h("i", { class: `cat-${c}` }), name)));
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` },
    h("header", { class: "top hero home-hero subj-hero" }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "元素周期表")), X.gear("#/science/periodic")),
    h("main", { class: "scroll" }, h("div", { class: "narrow" },
      h("div", { class: "mset-opts pt-filter" }, ...chips.map((c) => c.el)),
      h("div", { class: "pt-wrap" }, grid), legend, h("p", { class: "muted small center" }, "点一下元素看详情；横向滑动可以看到全部。")))));
}
async function details(e: SM.Element) {
  await modal<boolean>((close) => h("div", { class: "dlg pt-dlg", id: "pt-dlg" },
    h("div", { class: `pt-big cat-${e.cat}` }, h("small", {}, String(e.n)), h("b", {}, e.sym)),
    h("h2", { class: "user" }, `${e.zh}  ${e.en}`),
    h("div", { class: "pt-rows" },
      h("div", {}, h("span", {}, "原子序数"), h("b", {}, String(e.n))),
      h("div", {}, h("span", {}, "相对原子质量"), h("b", {}, String(e.mass))),
      h("div", {}, h("span", {}, "类别"), h("b", {}, CATS[e.cat] ?? e.cat)),
      h("div", {}, h("span", {}, "周期"), h("b", {}, String(e.row >= 8 ? (e.row === 8 ? 6 : 7) : e.row))),
      e.row <= 7 ? h("div", {}, h("span", {}, "族"), h("b", {}, String(e.col))) : null,
      e.junior ? h("div", {}, h("span", {}, "初中常考"), h("b", {}, "✓")) : null),
    h("div", { class: "row end" }, h("button", { class: "primary", onclick: () => close(true) }, "完成"))));
}

// ---------- formulas ----------
interface Formula { g: number; k: string; n: string; f: string }
export async function renderFormulas() {
  const list = ((await import("./data/science.json")).default.formulas as Formula[]).slice();
  let kind = "";
  const body = h("div", {});
  const draw = () => {
    const items = list.filter((x) => !kind || x.k === kind);
    body.replaceChildren(...items.map((x) => h("div", { class: "fm-row", "data-k": x.k },
      h("div", { class: "fm-head" }, h("span", { class: "stopic" }, x.k), h("span", { class: "muted small" }, P.gradeName(x.g))),
      h("div", { class: "fm-name user" }, x.n), h("div", { class: "fm-formula user" }, x.f))));
  };
  const chip = (label: string, v: string, id: string) => { const b = h("button", { class: "mopt" + (kind === v ? " on" : ""), id, onclick: () => { kind = v; chips.forEach((c) => c.classList.toggle("on", c.id === id)); draw(); } }, label); return b; };
  const chips = [chip("全部", "", "fm-all"), chip("物理", "物理", "fm-phys"), chip("化学", "化学", "fm-chem")];
  draw();
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` },
    h("header", { class: "top hero home-hero subj-hero" }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "公式与方程式")), X.gear("#/science/formulas")),
    h("main", { class: "scroll" }, h("div", { class: "narrow" }, h("div", { class: "mset-opts pt-filter" }, ...chips), body))));
}
