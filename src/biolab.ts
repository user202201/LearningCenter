/**
 * 生物实验室 (`#/science/bio`, under 科学): junior-high biology (七年级 + 八年级) as interactive simulations, built like the physics lab (`physlab.ts`): a grid of cards by grade, each opening
 * `#/science/bio/<id>` = the module `src/bio/<id>.ts`, mounted in a stage with the physics lab's kit (sliders, readouts, tasks, quiz). The models are pure (`src/bio/model-<id>.ts`).
 * Progress (tasks done, best quiz score) stays on this device (`learn.bio.v1`). Nothing is fetched.
 */
import { h, toast } from "./ui";
import { subjectArt } from "./hub";
import { CATALOG, ORDER, type BioId } from "./bio/catalog";
import { loadSaved } from "./bio/kit";
import type { PhysCtx } from "./phys/kit";
import type { Ctx } from "./english";

const COLOR = "#2f9e44";
const LOADERS: Record<BioId, () => Promise<{ mount: (root: HTMLElement, ctx: PhysCtx) => () => void }>> = {
  foodweb: () => import("./bio/foodweb"), population: () => import("./bio/population"), microscope: () => import("./bio/microscope"), cells: () => import("./bio/cells"), division: () => import("./bio/division"),
  levels: () => import("./bio/levels"), seed: () => import("./bio/seed"), photo: () => import("./bio/photo"), respiration: () => import("./bio/respiration"), transpiration: () => import("./bio/transpiration"),
  flower: () => import("./bio/flower"), digest: () => import("./bio/digest"), breathing: () => import("./bio/breathing"), blood: () => import("./bio/blood"), nerve: () => import("./bio/nerve"),
  hormone: () => import("./bio/hormone"), eye: () => import("./bio/eye"), motion: () => import("./bio/motion"), ferment: () => import("./bio/ferment"), classify: () => import("./bio/classify"),
  genetics: () => import("./bio/genetics"), selection: () => import("./bio/selection"), epidemic: () => import("./bio/epidemic"),
};
const hero = (X: Ctx, title: string, back: string, backLabel: string, self: string) =>
  h("header", { class: "top hero home-hero subj-hero" }, X.back(back, backLabel), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, title)), X.gear(self));

export function renderLab(X: Ctx): void {
  const saved = loadSaved();
  const body = h("div", { class: "pl-home", id: "bl-home" });
  for (const grade of [7, 8] as const) {
    const ids = ORDER.filter((id) => CATALOG[id].grade === grade);
    body.append(h("h2", { class: "sec pl-grade", "data-grade": String(grade) }, grade === 7 ? "七年级" : "八年级"));
    const row = h("div", { class: "pl-cards", "data-grade": String(grade) });
    for (const id of ids) {
      const m = CATALOG[id], done = (saved.done[id] ?? []).length;
      const ico = h("span", { class: "pl-ico" }); ico.innerHTML = m.icon;
      row.append(h("button", { class: "pl-sc" + (done >= m.tasks ? " all" : ""), "data-sim": id, "data-chapter": m.chapter, onclick: () => (location.hash = `#/science/bio/${id}`) },
        h("span", { class: "pl-chtag" }, m.chapter), ico, h("b", { class: "pl-ct" }, m.title), h("span", { class: "muted small pl-cs" }, `实验任务 ${done} / ${m.tasks}`)));
    }
    body.append(row);
  }
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, "生物实验室", "#/subject/science", "返回", "#/science/bio"),
    h("main", { class: "scroll" }, h("div", { class: "wide pl-wrap" }, h("p", { class: "muted small center" }, "拖动滑块或图中的物体，观察结果；完成实验任务，再做小测验。"), body,
      h("p", { class: "center" }, h("a", { class: "mopt pl-link", id: "bl-notes", href: "#/science/notes" }, "相关：知识总结（生物）"))))));
}

export async function renderSim(X: Ctx, id: string): Promise<void> {
  if (!(id in CATALOG)) { location.hash = "#/science/bio"; return; }
  const meta = CATALOG[id as BioId];
  const stage = h("div", { class: "pl-stagebox", id: "pl-stagebox" });
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, meta.title, "#/science/bio", "生物实验室", `#/science/bio/${id}`),
    h("main", { class: "scroll" }, h("div", { class: "wide pl-wrap" }, h("p", { class: "muted small pl-chap user-chapter" }, meta.chapter), stage)));
  X.show(root);
  let stop: (() => void) | null = null;
  try {
    const mod = await LOADERS[id as BioId]();
    if (!root.isConnected) return;
    stop = mod.mount(stage, { id, exit: () => (location.hash = "#/science/bio") });
  } catch (e) { toast(`该实验出错：${e instanceof Error ? e.message : String(e)}`, 6000); }
  const watch = new MutationObserver(() => { if (!root.isConnected) { try { stop?.(); } catch { /* ok */ } stop = null; watch.disconnect(); } });
  watch.observe(document.body, { childList: true, subtree: true });
}
