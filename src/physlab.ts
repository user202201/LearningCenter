/**
 * 物理实验室 (`#/science/physics`, under 科学): junior-high physics as interactive simulations. The page is a grid of cards grouped by grade and chapter; a card opens
 * `#/science/physics/<id>`, the simulation module (`src/phys/<id>.ts`, loaded when it is opened) mounted in a stage. The kit (sliders, readouts, tasks, quiz) is `phys/kit.ts`,
 * the physics is in `phys/model-<id>.ts` (pure, tested alone). Progress (tasks done, best quiz score) stays on this device (`learn.phys.v1`). Nothing is fetched.
 */
import { h, toast } from "./ui";
import { subjectArt } from "./hub";
import { CATALOG, ORDER, type SimId } from "./phys/catalog";
import { loadSaved, type PhysCtx } from "./phys/kit";
import type { Ctx } from "./english";

const COLOR = "#7048e8";
const LOADERS: Record<SimId, () => Promise<{ mount: (root: HTMLElement, ctx: PhysCtx) => () => void }>> = {
  motion: () => import("./phys/motion"), sound: () => import("./phys/sound"), heating: () => import("./phys/heating"), reflection: () => import("./phys/reflection"),
  refraction: () => import("./phys/refraction"), lens: () => import("./phys/lens"), spring: () => import("./phys/spring"), friction: () => import("./phys/friction"),
  newton: () => import("./phys/newton"), pressure: () => import("./phys/pressure"), buoyancy: () => import("./phys/buoyancy"), energy: () => import("./phys/energy"),
  lever: () => import("./phys/lever"), pulley: () => import("./phys/pulley"), specificheat: () => import("./phys/specificheat"), ohm: () => import("./phys/ohm"), em: () => import("./phys/em"),
};
const hero = (X: Ctx, title: string, back: string, backLabel: string, self: string) =>
  h("header", { class: "top hero home-hero subj-hero" }, X.back(back, backLabel), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, title)), X.gear(self));

export function renderLab(X: Ctx): void {
  const saved = loadSaved();
  const body = h("div", { class: "pl-home", id: "pl-home" });
  for (const grade of [8, 9] as const) {
    const ids = ORDER.filter((id) => CATALOG[id].grade === grade);
    body.append(h("h2", { class: "sec pl-grade", "data-grade": String(grade) }, grade === 8 ? "八年级" : "九年级"));
    const row = h("div", { class: "pl-cards", "data-grade": String(grade) });
    for (const id of ids) {
      const m = CATALOG[id], done = (saved.done[id] ?? []).length;
      const ico = h("span", { class: "pl-ico" }); ico.innerHTML = m.icon;
      row.append(h("button", { class: "pl-sc" + (done >= m.tasks ? " all" : ""), "data-sim": id, "data-chapter": m.chapter, onclick: () => (location.hash = `#/science/physics/${id}`) },
        h("span", { class: "pl-chtag" }, m.chapter), ico, h("b", { class: "pl-ct" }, m.title), h("span", { class: "muted small pl-cs" }, `实验任务 ${done} / ${m.tasks}`)));
    }
    body.append(row);
  }
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, "物理实验室", "#/subject/science", "返回", "#/science/physics"),
    h("main", { class: "scroll" }, h("div", { class: "wide pl-wrap" }, h("p", { class: "muted small center" }, "拖动滑块，观察结果；完成实验任务，再做小测验。"), body))));
}

export async function renderSim(X: Ctx, id: string): Promise<void> {
  if (!(id in CATALOG)) { location.hash = "#/science/physics"; return; }
  const meta = CATALOG[id as SimId];
  const stage = h("div", { class: "pl-stagebox", id: "pl-stagebox" });
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero(X, meta.title, "#/science/physics", "物理实验室", `#/science/physics/${id}`),
    h("main", { class: "scroll" }, h("div", { class: "wide pl-wrap" }, h("p", { class: "muted small pl-chap user-chapter" }, meta.chapter), stage)));
  X.show(root);
  let stop: (() => void) | null = null;
  try {
    const mod = await LOADERS[id as SimId]();
    if (!root.isConnected) return;
    stop = mod.mount(stage, { id, exit: () => (location.hash = "#/science/physics") });
  } catch (e) { toast(`该实验出错：${e instanceof Error ? e.message : String(e)}`, 6000); }
  const watch = new MutationObserver(() => { if (!root.isConnected) { try { stop?.(); } catch { /* ok */ } stop = null; watch.disconnect(); } });
  watch.observe(document.body, { childList: true, subtree: true });
}
