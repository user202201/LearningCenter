/**
 * 地理实验室 (`#/science/geo`, under 科学): primary-school and junior-high geography (七年级 and 八年级, 2022 课程标准) as interactive modules: a card per module (grouped 小学 / 七年级 /
 * 八年级), each opening `#/science/geo/<id>` = a lesson, an interactive picture, checked tasks and a 5-question quiz, made with the physics lab's kit (`phys/kit.ts`). The
 * practice page `#/science/geo/practice` mixes the questions of all modules (or one) and keeps the memory boxes of `game.ts` ON THIS DEVICE (`learn.geolab.practice.v1`; tasks and
 * best quiz scores: `learn.geolab.v1`). The pure rules and generators are `geolab-model.ts`, the content `data/geolab.json` (written from memory: a teacher must proofread it).
 */
import { h, toast } from "./ui";
import { subjectArt } from "./hub";
import { CATALOG, ORDER, GRADE_NAME, type GeoId } from "./geolab-catalog";
import { loadSaved, mountSim, mulberry32, type SimDef } from "./phys/kit";
import * as M from "./geolab-model";
import { todayLocal } from "./model";
import type { Ctx } from "./english";
import type { GeoMapProv } from "./geolab-sims2";

const COLOR = "#2b8a3e";
const KEY = "learn.geolab.v1";
const hero = (X: Ctx, title: string, back: string, backLabel: string, self: string) =>
  h("header", { class: "top hero home-hero subj-hero pl-hero" }, X.back(back, backLabel), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, title)), X.gear(self));

export function renderLab(X: Ctx): void {
  const saved = loadSaved(KEY);
  const body = h("div", { class: "pl-home", id: "gl-home" });
  for (const grade of [6, 7, 8] as const) {
    const ids = ORDER.filter((id) => CATALOG[id].grade === grade);
    body.append(h("h2", { class: "sec pl-grade", "data-grade": String(grade) }, GRADE_NAME[grade]));
    const row = h("div", { class: "pl-cards", "data-grade": String(grade) });
    for (const id of ids) {
      const m = CATALOG[id], done = (saved.done[id] ?? []).length;
      const ico = h("span", { class: "pl-ico" }); ico.innerHTML = m.icon;
      row.append(h("button", { class: "pl-sc" + (done >= m.tasks ? " all" : ""), "data-sim": id, "data-chapter": m.chapter, onclick: () => (location.hash = `#/science/geo/${id}`) },
        h("span", { class: "pl-chtag" }, m.chapter), ico, h("b", { class: "pl-ct" }, m.title), h("span", { class: "muted small pl-cs" }, `实验任务 ${done} / ${m.tasks}`)));
    }
    body.append(row);
  }
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, "地理实验室", "#/subject/science", "返回", "#/science/geo"),
    h("main", { class: "scroll" }, h("div", { class: "wide pl-wrap" }, h("p", { class: "muted small center" }, "拖动滑块或图中的标记，观察结果；完成实验任务，再做小测验。"), body,
      h("p", { class: "center" }, h("button", { class: "primary", id: "gl-practice", onclick: () => (location.hash = "#/science/geo/practice") }, "综合练习（按记忆曲线复习）"), " ", h("a", { class: "mopt pl-link", id: "gl-map", href: "#/science/map" }, "相关：地图"))))));
}

async function def(id: GeoId, D: M.GeoData): Promise<SimDef> {
  const s1 = await import("./geolab-sims1"), s2 = await import("./geolab-sims2");
  switch (id) {
    case "seasons": return s1.seasons(D); case "terrain": return s1.terrain(D); case "watercycle": return s1.watercycle(D); case "weather": return s1.weather(D);
    case "plates": return s1.plates(D); case "globe": return s1.globe(D); case "timezone": return s1.timezone(D); case "scale": return s1.scale(D); case "contour": return s1.contour(D);
    case "climate": return s2.climate(D); case "population": return s2.population(D); case "development": return s2.development(D); case "rocks": return s2.rocks(D);
    case "sustain": return s2.sustain(D); case "chinabasic": return s2.chinabasic(D); case "chinaterrain": return s2.chinaterrain(D);
    case "continents": return s2.facts(D, "continents", true, 5, [["亚洲", "选中亚洲，看它跨越的纬度范围"], ["南极洲", "选中南极洲，看它的位置"], ["太平洋", "选中太平洋，看它的范围"]]);
    case "regions": return s2.facts(D, "regions", true, D.facts.regions.entries.findIndex((e) => e.n === "德国"), [["西亚", "选中西亚，看它在亚、欧、非三洲交界处的位置"], ["日本", "选中日本，读它的自然和经济特点"], ["澳大利亚", "选中澳大利亚，读它的首都和经济特点"]]);
    case "chinanature": return s2.facts(D, "chinanature", false, 3, [["长江", "选中长江，看它流经的范围"], ["青藏高原", "选中青藏高原，读它的特征"], ["秦岭", "选中秦岭，读它的走向和意义"]]);
    case "chinaecon": return s2.facts(D, "chinaecon", false, 1, [["东北平原", "选中东北平原，读它的主要作物"], ["大庆", "选中大庆，读它的资源"], ["青藏铁路", "选中青藏铁路，读它的起止"]]);
    case "chinaregions": { const gm = (await import("./data/geomap-china.json")).default as unknown as { provinces: GeoMapProv[] }; return s2.chinaregions(D, gm.provinces); }
  }
}

export async function renderSim(X: Ctx, id: string): Promise<void> {
  if (id === "practice") return renderPractice(X);
  if (!(id in CATALOG)) { location.hash = "#/science/geo"; return; }
  const meta = CATALOG[id as GeoId];
  const stage = h("div", { class: "pl-stagebox", id: "pl-stagebox" });
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, meta.title, "#/science/geo", "地理实验室", `#/science/geo/${id}`),
    h("main", { class: "scroll" }, h("div", { class: "wide pl-wrap" }, h("p", { class: "muted small pl-chap user-chapter" }, meta.chapter), stage)));
  X.show(root);
  let stop: (() => void) | null = null;
  try {
    const D = await M.loadGeo();
    const d = await def(id as GeoId, D);
    if (!root.isConnected) return;
    stop = mountSim(d, stage, { id, exit: () => (location.hash = "#/science/geo") });
    // rule 66: the names of the places, the cards and the quiz texts are translated like everything else; a card that follows the state is made below for the modules that have one
    if (["climate", "chinaterrain", "continents", "regions", "chinanature", "chinaecon", "chinaregions"].includes(id)) stage.querySelector(".pl-main")?.after(h("section", { class: "pl-card gl-card", id: "gl-card" }));
  } catch (e) { toast(`该模块出错：${e instanceof Error ? e.message : String(e)}`, 6000); }
  const watch = new MutationObserver(() => { if (!root.isConnected) { try { stop?.(); } catch { /* ok */ } stop = null; watch.disconnect(); } });
  watch.observe(document.body, { childList: true, subtree: true });
}

// ---------- practice: the memory boxes decide what is asked ----------
const ROUND = 10;
async function renderPractice(X: Ctx): Promise<void> {
  const D = await M.loadGeo();
  let mods: string[] | null = null;
  const body = h("div", { class: "wide pl-wrap gl-practice", id: "gl-practice-page" });
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, "综合练习", "#/science/geo", "地理实验室", "#/science/geo/practice"), h("main", { class: "scroll" }, body));
  X.show(root);
  const home = () => {
    const p = M.loadProgress(), items = M.itemsOf(D, mods ?? undefined), today = todayLocal();
    const due = items.filter((i) => p.cards[i.key] && p.cards[i.key].due <= today).length, known = items.filter((i) => p.cards[i.key]).length;
    const chips = [["", "全部模块"], ...ORDER.map((id) => [id, CATALOG[id].title])].map(([id, label]) => h("button", { class: "mopt" + ((mods === null && id === "") || (mods?.[0] === id) ? " on" : ""), "data-mod": id, onclick: () => { mods = id ? [id] : null; home(); } }, label));
    body.replaceChildren(h("div", { class: "mset-opts pl-opts" }, ...chips),
      h("p", { class: "muted small", id: "gl-stats" }, `题目 ${items.length} 道，已练 ${known} 道，到期 ${due} 道`),
      h("button", { class: "primary", id: "gl-start", onclick: () => start(items) }, "开始练习（10 题）"),
      ...(p.last ? [h("p", { class: "muted small", id: "gl-last" }, `上次：${p.last.score} / ${p.last.total}`)] : []));
  };
  const start = (items: M.Item[]) => {
    const seed = Date.now() & 0xffffff, r = mulberry32(seed), today = todayLocal();
    const picked = M.selectItems(items, M.loadProgress(), today, ROUND, r);
    const qs = picked.map((it) => ({ it, q: M.questionOf(D, it, r) }));
    const answers: { key: string; right: boolean }[] = [];
    let i = 0, score = 0;
    const show = () => {
      if (i >= qs.length) {
        const p = M.applyAnswers(M.loadProgress(), answers, today, { score, total: qs.length }); M.saveProgress(p);
        body.replaceChildren(h("p", { class: "pl-score", id: "gl-score" }, `得分 ${score} / ${qs.length}`), h("button", { class: "mopt", id: "gl-again", onclick: home }, "返回"));
        toast("练习结果已保存在这台设备上", 2200);
        return;
      }
      const { it, q } = qs[i];
      const why = h("p", { class: "pl-why", id: "gl-why", hidden: true }, q.why ?? "");
      const next = h("button", { class: "primary", id: "gl-next", hidden: true, onclick: () => { i++; show(); } }, i + 1 >= qs.length ? "查看得分" : "下一题");
      const opts = q.choices.map((c, k) => h("button", { class: "mopt pl-qopt", "data-i": String(k), "data-right": k === q.a ? "1" : "0", onclick: () => {
        if (opts.some((b) => b.disabled)) return;
        const right = k === q.a; if (right) score++; answers.push({ key: it.key, right });
        opts.forEach((b, j) => { b.classList.toggle("right", j === q.a); b.classList.toggle("wrong", j === k && !right); b.disabled = true; });
        why.hidden = false; next.hidden = false;
      } }, c));
      body.replaceChildren(h("p", { class: "muted small", id: "gl-no" }, `第 ${i + 1} / ${qs.length} 题`), h("p", { class: "pl-q", id: "gl-q", "data-key": it.key }, q.q), h("div", { class: "pl-qopts" }, ...opts), why, next);
    };
    show();
  };
  home();
}
