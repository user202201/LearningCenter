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
import { renderRich, renderTeX } from "./mathtext";
import { SYMBOLS, CIRCUITS, RULES } from "./diagrams";
import { mascot } from "./art";
import { subjectArt, shortcuts } from "./hub";
import type { Ctx } from "./english";

let X!: Ctx;
export const initScience = (c: Ctx) => { X = c; };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const cache = new Map<string, M.KidData>();
const loadKid = async (id: string) => { const d = (await api.readJson<M.KidData>(SM.sciencePath(id))) ?? M.EMPTY_KID; cache.set(id, d); return d; };
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
    h("button", { class: "sci-ref", id: "open-formulas", onclick: () => (location.hash = "#/science/formulas") }, h("b", {}, "公式与方程式"), h("span", { class: "muted small" }, "数学 · 物理 · 化学")),
    h("button", { class: "sci-ref", id: "open-circuits", onclick: () => (location.hash = "#/science/circuits") }, h("b", {}, "电路与电磁"), h("span", { class: "muted small" }, "电路图 · 三个定则")));
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

// ---------- a child: a NEW set of cards every day, old ones come back by the memory curve ----------
type Tab = "week" | "learned" | "game";
const today = () => M.todayLocal();

/** a day gets its new cards once (opening the page on a day that has none makes them); never for another day than today */
async function ensureDay(k: M.Kid, lib: SM.Library): Promise<void> {
  const kid = cache.get(k.id) ?? M.EMPTY_KID;
  const day = today();
  if (M.weekOf(kid, day)?.chars.length) return;
  const grade = P.gradeOf(k.id) ?? 1;
  const done = toast("正在生成今天的知识卡…", 0, true);
  try {
    let added = 0;
    const review = await reviewOf(k.id).catch(() => MM.EMPTY_MATH_REVIEW);
    const wrong = new Set((review.mistakes ?? []).map((m) => m.q));
    const out = await api.update<M.KidData>(SM.sciencePath(k.id), M.EMPTY_KID, (cur) => { const r = W.addWeek(cur, day, SM.pickDaily(lib, cur, grade, day, (id) => wrong.has(lib.byId.get(id)?.q ?? ""), k.id)); added = r.added; return r.data; }, `science ${k.id} ${day}`);
    cache.set(k.id, out);
    done();
    if (added) toast(`已生成今天的 ${added} 张知识卡`);
  } catch (e) {
    done();
    toast(errText(e), 6000);
  }
}
const scienceReviewOf = async (id: string) => (await api.readJson<SM.ScienceReview>(SM.scienceReviewPath(id))) ?? MM.EMPTY_MATH_REVIEW as SM.ScienceReview;

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
  if (curKid !== id || !curDay) { curKid = id; curDay = today(); }
  await ensureDay(k, lib);
  if (my !== X.epoch()) return;
  const kid = cache.get(id) ?? M.EMPTY_KID;
  const tabs = h("div", { class: "seg tabs" },
    h("button", { class: tab === "game" ? "on" : "", "data-tab": "game", id: "tab-game", onclick: () => (location.hash = `#/science/${id}/game`) }, "游戏"),
    h("button", { class: tab === "week" ? "on" : "", "data-tab": "week", onclick: () => (location.hash = `#/science/${id}`) }, "今天"),
    h("button", { class: tab === "learned" ? "on" : "", "data-tab": "learned", onclick: () => (location.hash = `#/science/${id}/learned`) }, `已入库 ${allIds(kid).length}`));
  const body = h("div", { class: "scroll" });
  const gradeBtn = h("button", { class: "link", id: "grade-btn", title: "修改年级", onclick: () => void changeGrade(k) }, "年级：", P.gradeName(P.gradeOf(id) ?? 1));
  X.show(h("div", { class: "page", style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero" }, X.back("#/subject/science", "孩子"), h("h1", { class: "user-title" }, X.avatarEl(k), k.name), shortcuts(k.id, "science")),
    h("div", { class: "tabs-row" }, tabs), h("div", { class: "grade-row" }, gradeBtn), body));
  if (tab === "week") await renderDay(body, k, kid, lib);
  else if (tab === "learned") await renderLearned(body, k, kid, lib);
  else await renderLobby(body, k, kid, lib);
}
let curDay = "";

async function changeGrade(k: M.Kid) {
  if ((await pickKidGrade(k)) === null) return;
  cache.delete(k.id);
  toast("年级已记住");
  X.route();
}

/** a card: the topic, the question; a tap shows / hides the answer */
function cardEl(c: SM.Card, lib: SM.Library): HTMLElement {
  const aEl = h("b", {}), eEl = h("span", { class: "sfun" }), qEl = h("b", { class: "sq user" });
  renderRich(aEl, c.a); renderRich(eEl, c.e); renderRich(qEl, c.q);   // (formulas written as $...$ are typeset)
  const ans = h("div", { class: "sans user" }, aEl, eEl);
  const el = h("div", { class: "scard tappable", "data-card": c.id, role: "button", tabindex: "0" },
    h("span", { class: "stopic" }, lib.topics[c.t] ?? c.t), qEl, ans);
  const flip = () => el.classList.toggle("open");
  el.addEventListener("click", flip);
  el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), flip()));
  return el;
}

async function renderDay(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: SM.Library) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: SM.ScienceReview;
  try { review = await scienceReviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const t = today();
  const days = kid.weeks.filter((w) => w.chars.length).map((w) => w.start).sort();
  const at = days.indexOf(curDay);
  const go = (d: string | undefined) => { if (d) { curDay = d; void renderDay(body, k, cache.get(k.id) ?? M.EMPTY_KID, lib); } };
  const bar = h("div", { class: "weekbar" },
    h("button", { class: "icon", title: "前一天", "aria-label": "前一天", disabled: at <= 0, onclick: () => go(days[at - 1]) }, "‹"),
    h("div", { class: "wlabel", id: "week-label" }, h("strong", {}, curDay === t ? "今天" : curDay), h("span", { class: "muted" }, curDay === t ? curDay : "")),
    h("button", { class: "icon", title: "后一天", "aria-label": "后一天", disabled: at < 0 || at >= days.length - 1, onclick: () => go(days[at + 1]) }, "›"));
  const cards = (M.weekOf(kid, curDay)?.chars ?? []).map((i) => lib.byId.get(i)).filter((c): c is SM.Card => !!c);
  const again = curDay === t ? SM.reviewIds(kid, review, t).map((i) => lib.byId.get(i)).filter((c): c is SM.Card => !!c && !cards.includes(c)) : [];
  body.replaceChildren(h("div", { class: "narrow week-narrow" }, bar,
    curDay === t ? null : h("button", { class: "link", onclick: () => go(t) }, "回到今天"),
    h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "day-title" }, `新知识（${cards.length}）`), cards.length ? h("span", { class: "muted small" }, "点一下看答案") : null),
    cards.length ? h("div", { class: "slist" }, ...X.stagger(cards.map((c) => cardEl(c, lib)))) : h("p", { class: "empty" }, "这一天没有知识卡。"),
    again.length ? h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "again-title" }, `该回顾的旧知识（${again.length}）`), h("span", { class: "muted small" }, "按记忆曲线，隔一段时间再看一遍")) : null,
    again.length ? h("div", { class: "slist", id: "again-list" }, ...X.stagger(again.map((c) => cardEl(c, lib)))) : null));
}

async function renderLearned(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: SM.Library) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: SM.ScienceReview;
  try { review = await scienceReviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const mistakes = review.mistakes ?? [];
  const all = allIds(kid);
  const show = () => {
    const sample = [...all].sort(() => Math.random() - 0.5).slice(0, W.RECORDED_SAMPLE).map((i) => lib.byId.get(i)).filter((c): c is SM.Card => !!c);
    const book = h("div", { class: "mmistakes", id: "mistakes" },
      h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "mistakes-title" }, `错题本（${mistakes.length}）`),
        mistakes.length ? h("button", { class: "sheet-btn", id: "redo-mistakes", onclick: () => playQuestions(k, mistakes.slice(0, 20).map((q) => ({ ...q, choices: [...q.choices].sort(() => Math.random() - 0.5) })), lib, () => X.route()) }, "重做错题") : null),
      mistakes.length ? h("div", {}, ...mistakes.slice(0, 20).map((m) => { const q = h("span", { class: "user" }), a = h("b", { class: "user" }); renderRich(q, m.q); renderRich(a, m.a); return h("div", { class: "mmis", "data-topic": m.topic }, q, a); })) : h("p", { class: "muted small" }, "还没有错题。"));
    body.replaceChildren(h("div", { class: "narrow" }, book,
      all.length
        ? h("div", {},
            h("div", { class: "sec-row" }, h("h2", { class: "sec", id: "sample-title" }, `随机 ${sample.length} 张`), h("span", { class: "muted small" }, `共 ${all.length} 张`),
              all.length > sample.length ? h("button", { class: "sheet-btn", id: "reshuffle", onclick: show }, "换一批") : null),
            h("div", { class: "slist" }, ...X.stagger(sample.map((c) => cardEl(c, lib)))))
        : h("p", { class: "empty" }, "还没有入库的知识卡，先去“今天”看看吧。")));
  };
  show();
}

// ---------- the game ----------
function playQuestions(k: M.Kid, questions: ReturnType<typeof SM.cardToQ>[], lib: SM.Library, again: () => void) {
  const byQ = new Map(lib.cards.map((c) => [c.q, c]));
  openMathGame({
    color: k.color, questions, seconds: questions.length * 20,
    relaxed: true, explain: (q) => byQ.get(q.q)?.e ?? "",
    topicName: (id) => lib.topics[id] ?? id,
    onSave: async (answers, score, total, used, finished) => {
      const done = toast("正在保存…", 0, true);
      try {
        await api.update<SM.ScienceReview>(SM.scienceReviewPath(k.id), MM.EMPTY_MATH_REVIEW as SM.ScienceReview, (cur) => SM.applyScience(cur, answers, byQ, today(), finished ? { score, total, seconds: used } : undefined), `science game ${k.id}`);
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
async function renderLobby(body: HTMLElement, k: M.Kid, kid: M.KidData, lib: SM.Library) {
  const my = X.epoch();
  body.replaceChildren(h("div", { class: "center-msg" }, h("div", { class: "spin" })));
  let review: SM.ScienceReview;
  try { review = await scienceReviewOf(k.id); } catch (e) { return void body.replaceChildren(h("p", { class: "err" }, errText(e))); }
  if (my !== X.epoch()) return;
  const g = SM.buildGame(lib, kid, review, today());
  const n = g.questions.length;
  const start = () => playQuestions(k, SM.buildGame(lib, kid, review, today()).questions, lib, () => X.route());
  body.replaceChildren(h("div", { class: "narrow lobby" },
    h("div", { class: "lobby-hero" }, h("span", { class: "mascot big" }, mascot()), h("h2", {}, "准备好了吗？")),
    n ? h("p", { class: "muted center", id: "math-info" }, `今天：${g.fresh} 个新知识，${g.again} 个回顾，不限时，慢慢来`) : h("p", { class: "empty" }, "还没有知识卡，先到“今天”看看吧。"),
    h("div", { class: "lobby-go" }, h("button", { class: "primary wide", id: "game-start", disabled: n === 0, onclick: start }, "开始游戏"))));
}

// ---------- the periodic table ----------
const CATS: Record<string, string> = { alkali: "碱金属", alkaline: "碱土金属", transition: "过渡金属", post: "后过渡金属", metalloid: "类金属", nonmetal: "非金属", halogen: "卤素", noble: "稀有气体", lanthanide: "镧系", actinide: "锕系" };

export async function renderPeriodic() {
  const lib = await SM.loadScience();
  let juniorOnly = false;
  const grid = h("div", { class: "pt-grid", id: "pt-grid" });
  const draw = () => {
    grid.replaceChildren(...lib.elements.map((e) => h("button", { class: `pt-cell cat-${e.cat}` + (juniorOnly && !e.junior ? " dim" : ""), "data-n": String(e.n), style: `grid-row:${e.row >= 8 ? e.row + 1 : e.row};grid-column:${e.col}`, title: e.zh, "aria-label": e.zh, onclick: () => void details(e) },
      h("small", {}, String(e.n)), h("b", {}, e.sym), h("span", { class: "user" }, e.zh))));
  };
  const chip = (label: string, id: string, on: () => void, active: () => boolean) => { const b = h("button", { class: "mopt" + (active() ? " on" : ""), id, onclick: () => { on(); chips.forEach((c) => c.refresh()); } }, label); return { el: b, refresh: () => b.classList.toggle("on", active()) }; };
  const chips = [chip("全部", "pt-all", () => { juniorOnly = false; draw(); }, () => !juniorOnly), chip("初中常考", "pt-junior", () => { juniorOnly = true; draw(); }, () => juniorOnly)];
  draw();
  const legend = h("div", { class: "pt-legend" }, ...Object.entries(CATS).map(([c, name]) => h("span", { class: "pt-key" }, h("i", { class: `cat-${c}` }), name)));
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` },
    h("header", { class: "top hero home-hero subj-hero" }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "元素周期表")), X.gear("#/science/periodic")),
    h("main", { class: "scroll" }, h("div", { class: "wide" },
      h("div", { class: "mset-opts pt-filter" }, ...chips.map((c) => c.el)),
      h("div", { class: "pt-wrap" }, grid), legend,
      h("p", { class: "muted small center pt-tip" }, "点一下元素看详情。"),
      h("p", { class: "muted small center pt-rotate" }, "手机竖着拿时字比较小，横过来会看得更清楚。")))));
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

// ---------- formulas (math, physics, chemistry) ----------
interface Formula { g: number; k: string; s: string; n: string; t: string }
export async function renderFormulas() {
  const list = (await import("./data/formulas.json")).default.formulas as Formula[];
  let kind = "", level = "";
  const body = h("div", { id: "fm-body" });
  const draw = () => {
    const items = list.filter((x) => (!kind || x.k === kind) && (!level || (level === "primary" ? x.g <= 6 : x.g >= 7)));
    const groups = new Map<string, Formula[]>();
    for (const x of items) groups.set(`${x.k}|${x.s}`, [...(groups.get(`${x.k}|${x.s}`) ?? []), x]);
    body.replaceChildren(...[...groups.entries()].map(([key, rows]) => {
      const [k, s] = key.split("|");
      return h("section", { class: "fm-group", "data-k": k },
        h("h3", { class: "fm-title" }, h("span", { class: "stopic" }, k), s),
        ...rows.map((x) => { const f = h("div", { class: "fm-formula user" }); renderTeX(f, x.t, x.t.replace(/\\[a-z]+|[{}]/g, "")); return h("div", { class: "fm-row", "data-k": x.k, "data-g": String(x.g) }, h("div", { class: "fm-head" }, h("span", { class: "fm-name user" }, x.n), h("span", { class: "muted small" }, P.gradeName(x.g))), f); }));
    }), ...(items.length ? [] : [h("p", { class: "empty" }, "没有符合条件的公式。")]));
  };
  const chips = (opts: [string, string][], pick: (v: string) => void, idp: string) => {
    const els = opts.map(([label, v]) => h("button", { class: "mopt" + (v === "" ? " on" : ""), id: `${idp}-${v || "all"}`, "data-v": v, onclick: () => { pick(v); els.forEach((e) => e.classList.toggle("on", e.dataset.v === v)); draw(); } }, label));
    return h("div", { class: "mset-opts pt-filter" }, ...els);
  };
  draw();
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` },
    h("header", { class: "top hero home-hero subj-hero" }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "公式与方程式")), X.gear("#/science/formulas")),
    h("main", { class: "scroll" }, h("div", { class: "narrow" },
      chips([["全部", ""], ["数学", "数学"], ["物理", "物理"], ["化学", "化学"]], (v) => (kind = v), "fm"),
      chips([["全部", ""], ["小学", "primary"], ["初中", "junior"]], (v) => (level = v), "fl"), body))));
}

// ---------- circuits and electromagnetism (drawn in code) ----------
export function renderCircuits() {
  const fig = (svg: string) => { const d = h("div", { class: "dg-fig" }); d.innerHTML = svg; return d; };
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` },
    h("header", { class: "top hero home-hero subj-hero" }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "电路与电磁")), X.gear("#/science/circuits")),
    h("main", { class: "scroll" }, h("div", { class: "narrow" },
      h("h2", { class: "sec" }, "电路元件符号"),
      h("div", { class: "dg-symbols", id: "dg-symbols" }, ...SYMBOLS.map((s) => h("div", { class: "dg-sym" }, fig(s.svg), h("span", {}, s.name)))),
      h("h2", { class: "sec" }, "基本电路图"),
      ...CIRCUITS.map((c) => h("section", { class: "dg-card", "data-circuit": c.title }, h("h3", {}, c.title), fig(c.svg), h("ul", {}, ...c.notes.map((n) => h("li", {}, n))))),
      h("h2", { class: "sec" }, "电与磁的三个定则"),
      ...RULES.map((r) => h("section", { class: "dg-card", "data-rule": r.title }, h("h3", {}, r.title), fig(r.svg), h("ol", {}, ...r.steps.map((n) => h("li", {}, n))), h("p", { class: "muted small" }, r.note)))))));
}
