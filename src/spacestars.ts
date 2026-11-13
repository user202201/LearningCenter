/** Stars and the sky: the Sun's layers, the life of a star, 12 constellations (dots and lines) with their stories and how to find the Pole Star, the ladder of sizes from the Earth to the universe, and the timeline of space exploration. */
import { h } from "./ui";
import { tr } from "./i18n";
import { user, chips } from "./spaceui";
import { constSvg, finderSvg } from "./spaceart";
import { nameOf, type Space } from "./spacemodel";

const svgEl = (svg: string): HTMLElement => { const d = h("div", { class: "sp-svg" }); d.innerHTML = svg; return d; };

function sunSection(S: Space): HTMLElement {
  const layers = S.sun.layers, size = 100;
  const circles = layers.slice().sort((a, b) => b.r - a.r).map((l) => `<circle class="sp-sunl" data-id="${l.id}" cx="0" cy="0" r="${l.r * size * 0.95}" fill="${l.color}" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>`).join("");
  const svg = svgEl(`<svg viewBox="-150 -150 300 300" role="img" aria-label="Sun">${circles}</svg>`);
  const info = h("div", { class: "sp-sun-info", id: "sp-sun-info" });
  const list = h("div", { class: "sp-layers" });
  const pick = (id: string) => {
    const l = layers.find((x) => x.id === id)!;
    info.replaceChildren(h("b", {}, tr(l.zh)), user(l.text, "p"));
    list.querySelectorAll<HTMLElement>("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
    svg.querySelectorAll<SVGElement>(".sp-sunl").forEach((c) => c.setAttribute("opacity", c.dataset.id === id ? "1" : "0.78"));
  };
  for (const l of layers) list.append(h("button", { class: "mopt", "data-id": l.id, id: `sp-sun-${l.id}`, onclick: () => pick(l.id) }, h("i", { style: `background:${l.color}` }), l.zh));
  svg.querySelectorAll<SVGElement>(".sp-sunl").forEach((c) => c.addEventListener("click", () => pick(c.dataset.id!)));
  pick("core");
  return h("section", { class: "sp-sec", id: "sp-sun" }, h("h2", { class: "sec" }, "太阳的结构"),
    h("div", { class: "sp-sun-row" }, svg, h("div", {}, list, info)),
    h("div", { class: "sp-grid sp-sunstats" }, ...S.sun.stats.map(([k, v]) => h("div", { class: "sp-card" }, h("span", { class: "muted small" }, k), user(v, "b")))));
}
function lifeSection(S: Space): HTMLElement {
  const card = (l: Space["life"][0]) => h("div", { class: `sp-life sp-life-${l.id}`, "data-id": l.id }, h("b", {}, l.zh), l.id === "main" ? h("em", {}, tr("太阳在这里")) : null, user(l.text, "p"));
  const common = S.life.filter((l) => l.path === "both"), small = S.life.filter((l) => l.path === "small"), big = S.life.filter((l) => l.path === "big");
  return h("section", { class: "sp-sec", id: "sp-life" }, h("h2", { class: "sec" }, "恒星的一生"),
    h("p", { class: "muted" }, "恒星也有出生、成长和结局，质量不同，结局就不同。"),
    h("div", { class: "sp-life-row" }, ...common.map(card)),
    h("div", { class: "sp-life-branch" }, h("div", { class: "sp-life-path", id: "sp-life-small" }, h("h3", { class: "sp-h3" }, "像太阳这样的恒星"), ...small.map(card)),
      h("div", { class: "sp-life-path", id: "sp-life-big" }, h("h3", { class: "sp-h3" }, "质量大得多的恒星"), ...big.map(card))));
}
function constSection(S: Space): HTMLElement {
  const bear = S.constellations.find((c) => c.id === "ursa-major")!;
  const grid = h("div", { class: "sp-consts", id: "sp-consts" });
  for (const c of S.constellations) {
    const fig = svgEl(constSvg(c));
    const more = h("div", { class: "sp-const-more" }, h("p", { class: "muted small" }, h("b", {}, tr("最佳观测：")), user(c.season)), user(c.story, "p"), h("p", { class: "sp-tip" }, h("b", {}, tr("怎样找到：")), user(c.tip)));
    const card = h("button", { class: "sp-const", "data-id": c.id, "aria-expanded": "false", onclick: () => {
      const open = card.classList.toggle("open"); card.setAttribute("aria-expanded", String(open));
      fig.replaceChildren(svgEl(constSvg(c, open)).firstElementChild!);
    } }, fig, h("b", { class: "user" }, nameOf(c)), more);
    grid.append(card);
  }
  return h("section", { class: "sp-sec", id: "sp-const-sec" }, h("h2", { class: "sec" }, "星座"),
    h("p", { class: "muted" }, "古人把天上的亮星连成图案，编成故事。点开一个星座，看它的名字和故事。图案是示意，不是真实的天空位置。"),
    h("div", { class: "sp-polaris", id: "sp-polaris" }, svgEl(finderSvg(bear)), h("div", {}, h("h3", { class: "sp-h3" }, "怎样找到北极星"),
      h("ol", {}, h("li", {}, "先找到北斗七星，它像一把勺子。"), h("li", {}, "勺口外侧的两颗星（天璇、天枢）连成一条线，向勺口方向延长约 5 倍的距离。"), h("li", {}, "那里孤零零的一颗不太亮的星，就是北极星。"), h("li", {}, "仙后座的“W”在北极星的另一侧，也能帮助定位。")),
      h("p", { class: "muted small" }, "面对北极星，你就面向正北。"))),
    grid);
}
function ladderSection(S: Space): HTMLElement {
  const lo = 6.5, hi = 27.2;
  return h("section", { class: "sp-sec", id: "sp-ladder" }, h("h2", { class: "sec" }, "从地球到宇宙"),
    h("p", { class: "muted" }, "每一级比上一级大得多。横条的长度按对数画，每多一小格，就是 10 倍。"),
    h("div", { class: "sp-lad" }, ...S.ladder.map((l, i) => h("div", { class: "sp-rung", "data-id": l.id },
      h("div", { class: "sp-rung-head" }, h("i", {}, String(i + 1)), h("b", {}, l.zh)),
      h("div", { class: "sp-bar" }, h("span", { style: `width:${Math.max(3, ((Math.log10(l.m) - lo) / (hi - lo)) * 100).toFixed(1)}%` })),
      user(l.text, "p"), l.light ? user(l.light, "p", "muted small") : null))));
}
function timelineSection(S: Space): HTMLElement {
  let only = false;
  const list = h("div", { class: "sp-time-list", id: "sp-timeline" });
  const draw = () => list.replaceChildren(...S.timeline.filter((t) => !only || t.cn).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((t) => h("div", { class: "sp-tl" + (t.cn ? " cn" : ""), "data-date": t.date }, h("time", {}, t.date.slice(0, 4), h("small", {}, t.date.slice(5))), h("div", {}, user(t.zh, "b"), user(t.text, "p")))));
  const c = chips([{ id: "sp-tl-all", label: "全部", on: true, click: () => { only = false; c.set("sp-tl-all"); draw(); } }, { id: "sp-tl-cn", label: "中国航天", on: false, click: () => { only = true; c.set("sp-tl-cn"); draw(); } }]);
  draw();
  return h("section", { class: "sp-sec", id: "sp-explore" }, h("h2", { class: "sec" }, "宇宙探索"), c.el, list);
}
export const mountStars = (S: Space): HTMLElement => h("div", { class: "sp-stars", id: "sp-stars" }, sunSection(S), lifeSection(S), constSection(S), ladderSection(S), timelineSection(S));
