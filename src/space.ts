/**
 * 天文 (`#/science/space`, for everybody, under 科学): four tabs. 太阳系 = the moving model (spaceorrery.ts) and a card for each planet / dwarf planet; 实验室 = the Earth -
 * Moon - Sun models (spacelabs.ts); 星空 = the Sun, the life of a star, constellations, the ladder of sizes, the timeline (spacestars.ts); 小测验 = rounds of 10 (spacequiz.ts).
 * One planet: `#/science/space/<id>` (spaceplanet.ts). The data is data/space.json (from memory, to be checked); progress of the quiz stays on this device (`learn.space.v1`).
 */
import { h } from "./ui";
import { subjectArt } from "./hub";
import type { Ctx } from "./english";
import { chips, user } from "./spaceui";
import { sprite } from "./spaceart";
import { mountOrrery } from "./spaceorrery";
import * as SM from "./spacemodel";

const COLOR = "#7048e8";
type Tab = "solar" | "lab" | "stars" | "quiz";
const TABS: [Tab, string][] = [["solar", "太阳系"], ["lab", "实验室"], ["stars", "星空"], ["quiz", "小测验"]];

export async function renderSpace(X: Ctx): Promise<void> {
  const my = X.epoch();
  X.showLoading();
  let S: SM.Space;
  try { S = await SM.loadSpace(); } catch (e) { return my === X.epoch() ? X.showError(e, () => void renderSpace(X)) : undefined; }
  if (my !== X.epoch()) return;
  let doc = SM.loadDoc();
  let tab: Tab = TABS.some(([t]) => t === doc.tab) ? (doc.tab as Tab) : "solar";
  const body = h("div", { id: "sp-body" });
  let orrery: { dispose(): void } | null = null;
  const tabs = chips(TABS.map(([t, label]) => ({ id: `sp-tab-${t}`, label, on: t === tab, click: () => show(t) })));
  const show = async (t: Tab) => {
    tab = t; tabs.set(`sp-tab-${t}`); orrery?.dispose(); orrery = null;
    doc = { ...SM.loadDoc(), tab: t }; SM.saveDoc(doc);
    body.dataset.tab = t;
    if (t === "solar") body.replaceChildren(solar());
    else if (t === "lab") body.replaceChildren((await import("./spacelabs")).mountLabs());
    else if (t === "stars") body.replaceChildren((await import("./spacestars")).mountStars(S));
    else body.replaceChildren(quiz());
  };
  const solar = (): HTMLElement => {
    const o = mountOrrery(S, (id) => (location.hash = `#/science/space/${id}`)); orrery = o;
    const fact = h("div", { class: "sp-didyou", id: "sp-didyou" });
    const roll = () => { const all = SM.allBodies(S), b = all[Math.floor(Math.random() * all.length)], f = b.facts[Math.floor(Math.random() * b.facts.length)]; fact.replaceChildren(h("b", {}, "你知道吗？"), user(f, "p"), h("button", { class: "mopt", id: "sp-didyou-next", onclick: roll }, "换一条")); };
    roll();
    const cards = h("div", { class: "sp-bodies", id: "sp-bodies" }, ...SM.allBodies(S).map((b) => {
      const cv = h("canvas", { width: 96, height: 96, class: "sp-body-cv" }); cv.getContext("2d")!.drawImage(sprite(b.id, 96), 0, 0);
      return h("button", { class: "sp-body", "data-id": b.id, onclick: () => (location.hash = `#/science/space/${b.id}`) }, cv, h("b", { class: "user" }, SM.nameOf(b)), h("small", {}, b.kind === "dwarf" ? "矮行星" : "行星"));
    }));
    return h("div", {}, o.el, fact, h("h2", { class: "sec" }, "行星和矮行星"), cards);
  };
  const quiz = (): HTMLElement => {
    const keys = SM.allKeys(S), known = keys.filter((k) => (doc.cards[k]?.box ?? 0) >= 3).length;
    const d = SM.loadDoc();
    return h("div", { class: "sp-quizhome", id: "sp-quizhome" },
      h("p", { class: "muted" }, "每次 10 题：认行星、认卫星、认星座、认月相，还有地球和宇宙的知识。没有时间限制，每题答完后有解释。"),
      h("div", { class: "sp-qstat" }, h("div", {}, h("b", { id: "sp-known" }, String(known)), ` / ${keys.length}`, h("span", { class: "muted small" }, "已掌握的题目")), d.last ? h("div", {}, h("b", { id: "sp-last" }, `${d.last.score} / ${d.last.total}`), h("span", { class: "muted small" }, "上一次得分")) : null),
      h("button", { class: "primary wide", id: "sp-quiz-start", onclick: () => import("./spacequiz").then((m) => m.openQuiz(S, () => void show("quiz"))) }, "开始"));
  };
  const hero = h("header", { class: "top hero home-hero subj-hero", style: `--kid:${COLOR}` }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "天文"), h("p", {}, "太阳系 · 月相 · 星空")), X.gear("#/science/space"));
  X.show(h("div", { class: "page sp-page", style: `--kid:${COLOR}` }, hero, h("main", { class: "scroll" }, h("div", { class: "narrow sp-narrow" }, tabs.el, body))));
  await show(tab);
}
export { renderPlanet } from "./spaceplanet";
