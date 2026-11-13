/**
 * 编程 phase 2, the 信息科技 side: worlds 14 (数据与编码), 15 (网络与信息安全 + 人工智能启蒙) and 16 (过程控制与物联网), the 创作工坊 and the certificate.
 * This module is the SHELL: the section on the world map, the level lists, the activity page (mini-lesson, task, hint ladder, stars, progress saved in
 * `coding/<kid>.json` under the ids i14-01 ..., merged by the larger star count like every other level), the routes
 *   #/coding/<kid>/i14|i15|i16   levels of a world       #/coding/<kid>/i14/<no>   an activity
 *   #/coding/<kid>/projects[/new/<tpl> | /<id>]            #/coding/<kid>/certificate
 * The labs are in coding-infolabs.ts / coding-infolabs2.ts / coding-infodev.ts (loaded when first needed), the pure models in coding-infomodel.ts and
 * coding-devices.ts, the content in src/data/coding-info.json.
 */
import { h, toast, modal } from "./ui";
import type * as M from "./model";
import * as api from "./api";
import * as CM from "./coding-model";
import { LEVELS, WORLDS } from "./coding-levels";
import { badgeSvg } from "./coding-art";
import { shortcuts } from "./hub";
import type { Ctx } from "./english";
import type { Io, Mount, Widget } from "./coding-infolabs";
import { InfoAct, InfoContent, WORLD_IDS, L, actsOf, loadContent } from "./coding-infocontent";
import { INFO_COLOR, demoEl, infoBadgeSvg, infoIslandSvg } from "./coding-infoart";
import * as PJ from "./coding-infoproj";

let X!: Ctx;
export const initInfo = (c: Ctx) => { X = c; };
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isInfoId = (id: string) => /^i1[4-6]-\d+$/.test(id);

const starSvg = (on: boolean) => `<svg viewBox="-14 -14 28 28" aria-hidden="true" focusable="false"><path d="M0-12l3.600 7.500 8.200 1.200-6 5.800 1.400 8.200L0 7l-7.200 3.700 1.400-8.200-6-5.800 8.200-1.200z" fill="${on ? "#ffd43b" : "#e9ecef"}" stroke="${on ? "#f59f00" : "#ced4da"}" stroke-width="2" stroke-linejoin="round"/></svg>`;
const starRow = (n: number, cls: string) => { const s = h("span", { class: cls, "data-stars": String(n), role: "img", "aria-label": `${n} / 3` }); s.innerHTML = [1, 2, 3].map((i) => starSvg(i <= n)).join(""); return s; };

/** stars of the info worlds in a progress file */
export const infoStars = (doc: CM.CodingDoc): number => Object.entries(doc.stars ?? {}).reduce((n, [k, v]) => (isInfoId(k) ? n + v : n), 0);
export function worldStat(c: InfoContent, doc: CM.CodingDoc, world: number) {
  const ls = actsOf(c, world), stars = ls.reduce((n, a) => n + (doc.stars?.[a.id] ?? 0), 0), solved = ls.filter((a) => (doc.stars?.[a.id] ?? 0) > 0).length;
  return { stars, max: ls.length * 3, solved, total: ls.length, done: ls.length > 0 && solved === ls.length };
}
export const handles = (rest: string): boolean => /^i1[4-6](\/\d+)?$/.test(rest) || /^projects(\/[\w-]+(\/[\w-]+)?)?$/.test(rest) || rest === "certificate";

// ---------- the section of the world map ----------
/** appends the 信息科技 section to the world map and the three medals to the shelf; the content is loaded first (the section is filled when it is there) */
export function mapSection(k: M.Kid, doc: CM.CodingDoc, shelf: HTMLElement): HTMLElement {
  const box = h("section", { class: "ci-section", id: "ci-section" });
  void loadContent().then((c) => {
    const total = shelf.querySelector<HTMLElement>("#cl-total");
    for (const w of WORLD_IDS) {
      const got = worldStat(c, doc, w).done, t = h("span", { class: "cl-trophy ci-trophy" + (got ? " got" : ""), "data-iworld": String(w), title: got ? L(c.worlds[w].name) : "", "aria-label": got ? L(c.worlds[w].name) : "未获得" });
      t.innerHTML = infoBadgeSvg(w, got);
      shelf.insertBefore(t, total);
    }
    if (total) { const base = Number((total.textContent ?? "").replace(/\D/g, "")) || 0; total.textContent = `★ ${base + infoStars(doc)}`; }
    box.append(h("h2", { class: "ci-sech" }, "信息科技"));
    for (const w of WORLD_IDS) {
      const st = worldStat(c, doc, w);
      const card = h("a", { class: "ci-icard" + (st.done ? " done" : ""), href: `#/coding/${k.id}/i${w}`, "data-iworld": String(w), style: `--wc:${INFO_COLOR[w]}` }, h("span", { class: "isl-art" }),
        h("span", { class: "isl-info" }, h("span", { class: "isl-no" }, `第 ${w} 个世界`), h("b", { class: "isl-name user" }, L(c.worlds[w].name)), h("span", { class: "isl-stars" }, `★ ${st.stars} / ${st.max}`), h("span", { class: "isl-prog" }, `${st.solved} / ${st.total}`)));
      card.querySelector(".isl-art")!.innerHTML = infoIslandSvg(w);
      box.append(card);
    }
    const n = PJ.projectsOf(k.id).length;
    box.append(h("a", { class: "ci-icard", id: "ci-projects", href: `#/coding/${k.id}/projects`, style: "--wc:#c2255c" }, h("span", { class: "isl-info" }, h("span", { class: "isl-no" }, "毕业项目"), h("b", { class: "isl-name" }, "创作工坊"), h("span", { class: "isl-prog" }, `${n} / ${PJ.MAX_PROJECTS}`))),
      h("a", { class: "ci-icard", id: "ci-certificate", href: `#/coding/${k.id}/certificate`, style: "--wc:#e67700" }, h("span", { class: "isl-info" }, h("span", { class: "isl-no" }, "毕业"), h("b", { class: "isl-name" }, "证书"))));
  }).catch(() => { /* offline-first: the content is part of the build, this cannot fail */ });
  return box;
}

// ---------- routes ----------
export async function renderInfo(k: M.Kid, doc: CM.CodingDoc, rest: string): Promise<void> {
  const my = X.epoch();
  let c: InfoContent;
  try { c = await loadContent(); } catch (e) { return void X.showError(e, () => void renderInfo(k, doc, rest)); }
  if (my !== X.epoch()) return;
  let m: RegExpExecArray | null;
  if ((m = /^i(1[4-6])$/.exec(rest))) return worldPage(k, doc, c, Number(m[1]));
  if ((m = /^i(1[4-6])\/(\d+)$/.exec(rest))) {
    const [wn, no] = [Number(m[1]), Number(m[2])];
    const a = actsOf(c, wn).find((x) => x.no === no);
    if (a) return void (await activityPage(k, c, a));
  }
  const pctx: PJ.PCtx = { c, kid: k, X, today: todayLocal() };
  if (rest === "projects") return PJ.renderShelf(pctx);
  if ((m = /^projects\/new\/(\w+)$/.exec(rest)) && (PJ.TEMPLATES as readonly string[]).includes(m[1])) return PJ.renderProject(pctx, PJ.newProject(c, m[1] as PJ.Tpl), true);
  if ((m = /^projects\/(p[\w]+)$/.exec(rest))) { const pid = m[1], p = PJ.projectsOf(k.id).find((x) => x.id === pid); if (p) return PJ.renderProject(pctx, p, false); }
  if (rest === "certificate") return PJ.renderCertificate(pctx, medalsOf(c, doc), todayLocal());
  location.hash = `#/coding/${k.id}`;
}
const todayLocal = (): string => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** every world's medal (the block worlds of coding-levels and the three of this module) */
export function medalsOf(c: InfoContent, doc: CM.CodingDoc): PJ.Medal[] {
  const out: PJ.Medal[] = WORLDS.map((w) => ({ id: String(w.id), name: w.name, got: CM.worldStat(doc, w.id).done, svg: badgeSvg(w.id, CM.worldStat(doc, w.id).done) }));
  for (const w of WORLD_IDS) { const got = worldStat(c, doc, w).done; out.push({ id: String(w), name: L(c.worlds[w].name), got, svg: infoBadgeSvg(w, got) }); }
  return out;
}

function worldPage(k: M.Kid, doc: CM.CodingDoc, c: InfoContent, world: number) {
  const st = worldStat(c, doc, world);
  const grid = h("div", { class: "cl-levels" });
  for (const a of actsOf(c, world)) {
    const s = doc.stars?.[a.id] ?? 0;
    grid.append(h("a", { class: "cl-lvl" + (a.boss ? " boss" : "") + (s ? " solved" : ""), href: `#/coding/${k.id}/i${world}/${a.no}`, "data-level": a.id, "data-stars": String(s), style: `--wc:${INFO_COLOR[world]}` },
      h("span", { class: "lvl-no" }, String(a.no)), starRow(s, "lvl-stars"), h("span", { class: "lvl-title user" }, L(a.title)), a.boss ? h("span", { class: "lvl-tag" }, "挑战") : null));
  }
  X.stagger([...grid.querySelectorAll<HTMLElement>(".cl-lvl")]);
  const medal = h("span", { class: "cl-trophy" + (st.done ? " got" : ""), id: "cl-medal" });
  medal.innerHTML = infoBadgeSvg(world, st.done);
  X.show(h("div", { class: "page", style: `--kid:${k.color}` }, h("header", { class: "top hero kid-hero" }, X.back(`#/coding/${k.id}`, "世界"), h("h1", { class: "user-title" }, L(c.worlds[world].name)), shortcuts(k.id, "coding")),
    h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow" }, h("div", { class: "cl-wsum" }, medal, h("div", {}, h("b", { id: "cl-wstars" }, `★ ${st.stars} / ${st.max}`), h("span", { class: "muted" }, ` · ${st.solved} / ${st.total}`))), grid))));
}

// ---------- the mini-lesson ----------
export async function openLesson(c: InfoContent, id: string): Promise<void> {
  const les = c.lessons[id];
  if (!les) return;
  await modal<boolean>((close) => {
    let i = 0;
    const demoBox = h("div", { class: "cl-demo ci-demobox", id: "cl-demo" }), text = h("p", { class: "cl-lesson-text user", id: "cl-lesson-text" }), dots = h("div", { class: "cl-dots" });
    const prev = h("button", { id: "cl-lesson-prev", onclick: () => show(i - 1) }, "上一步"), next = h("button", { class: "primary", id: "cl-lesson-next", onclick: () => (i >= les.steps.length - 1 ? close(true) : show(i + 1)) }, "下一步");
    const show = (n: number) => {
      i = Math.max(0, Math.min(les.steps.length - 1, n));
      demoBox.replaceChildren(demoEl(les.steps[i].d)); text.textContent = les.steps[i].t;
      dots.replaceChildren(...les.steps.map((_, j) => h("i", { class: j === i ? "on" : "" })));
      (prev as HTMLButtonElement).disabled = i === 0; next.textContent = i >= les.steps.length - 1 ? "完成" : "下一步";
    };
    show(0);
    return h("div", { class: "dlg cl-lesson ci-lesson", id: "cl-lesson" }, h("h2", { class: "user" }, L(les.title)), demoBox, text, dots, h("div", { class: "row end" }, h("button", { id: "cl-lesson-close", onclick: () => close(true) }, "关闭"), prev, next));
  });
  CM.patchLocal((l) => { if (!l.seen.includes(id)) l.seen.push(id); });
}

// ---------- an activity ----------
const LAB1 = new Set(["quiz", "scenario", "sort", "order", "pick", "bits", "pixel", "rgbmix", "wave", "huff", "subst", "fixbit", "sheet", "table"]);
const LAB2 = new Set(["route", "password", "knn", "tree", "rules", "search", "bias", "digit"]);
export async function loadMount(kind: string): Promise<Mount> {
  const key = kind === "knn" ? "knnLab" : kind === "tree" ? "treeLab" : kind === "rules" ? "rulesLab" : kind === "bias" ? "biasLab" : kind;
  if (LAB1.has(kind)) return ((await import("./coding-infolabs")) as unknown as Record<string, Mount>)[key];
  if (LAB2.has(kind)) return ((await import("./coding-infolabs2")) as unknown as Record<string, Mount>)[key];
  if (kind === "device") return (await import("./coding-infodev")).device;
  throw new Error("unknown activity kind " + kind);
}
export const starsOf = (mistakes: number, hints: number, cheated: boolean): number => (cheated ? 1 : mistakes === 0 && hints === 0 ? 3 : mistakes <= 2 && hints <= 1 ? 2 : 1);

async function saveProgress(k: M.Kid, c: InfoContent, a: InfoAct, stars: number, mistakes: number): Promise<CM.CodingDoc> {
  const before = (await api.readJson<CM.CodingDoc>(CM.codingPath(k.id))) ?? CM.EMPTY_CODING;
  const done = toast("正在保存…", 0, true);
  try {
    const out = await api.update<CM.CodingDoc>(CM.codingPath(k.id), CM.EMPTY_CODING, (cur) => CM.applyResult(cur, a.id, stars, mistakes), `coding ${k.id} ${a.id}`);
    done(); toast("已记录进度");
    if (!worldStat(c, before, a.world).done && worldStat(c, out, a.world).done) {
      await modal<boolean>((close) => { const art = h("div", { class: "cl-medal-art" }); art.innerHTML = infoBadgeSvg(a.world, true); return h("div", { class: "dlg cl-medal", id: "cl-medal-dlg" }, h("h2", {}, "获得徽章"), h("p", { class: "user" }, L(c.worlds[a.world].name)), art, h("div", { class: "row end" }, h("button", { class: "primary", id: "cl-medal-ok", onclick: () => close(true) }, "继续"))); });
    }
    return out;
  } catch (e) { done(); throw e; }
}

async function activityPage(k: M.Kid, c: InfoContent, act: InfoAct): Promise<void> {
  const my = X.epoch();
  let mount: Mount;
  try { mount = await loadMount(act.kind); } catch (e) { return void X.showError(e, () => void activityPage(k, c, act)); }
  if (my !== X.epoch()) return;
  const list = actsOf(c, act.world), idx = list.findIndex((x) => x.id === act.id), nxt = list[idx + 1] ?? null;
  const seed = (Math.floor(Math.random() * 1e6) + 1) | 0;
  let mistakes = 0, hints = 0, cheated = false, solved = false;
  const dev = act.kind === "device", dt = c.dev[act.id];
  const hintList = act.hints ?? (dev ? [...(dt?.hints ?? [])] : c.kindHints[act.kind] ?? []);
  const prompt = h("p", { class: "ci-prompt user", id: "ci-prompt" }), msg = h("p", { class: "cl-msg ci-msg", id: "ci-msg", role: "status" }), hintBox = h("ol", { class: "ci-hints user", id: "ci-hints" });
  const result = h("div", { class: "cl-result ci-result", id: "ci-result", hidden: true }), root = h("div", { class: "ci-root", id: "ci-root" });
  const io: Io = {
    act, c, seed,
    say: (t, kind = "") => { msg.textContent = t; msg.className = "cl-msg ci-msg " + kind; },
    bad: () => { if (!solved) mistakes++; },
    cheat: () => { cheated = true; },
    prompt: (t) => { prompt.textContent = t; },
    win: (stars) => { if (solved) return; solved = true; void finish(stars); },
  };
  async function finish(over?: number) {
    const stars = over ?? starsOf(mistakes, hints, cheated);
    result.replaceChildren(h("div", { class: "cl-res-top" }, starRow(stars, "cl-res-stars"), h("b", { id: "cl-res-title" }, "完成。")), h("p", { id: "cl-res-text" }, `错误 ${mistakes} 次，提示 ${hints} 次。`),
      h("div", { class: "row end cl-res-btns" }, h("button", { id: "cl-again", onclick: () => X.route() }, "再试一次"), nxt ? h("button", { class: "primary", id: "cl-next", onclick: () => (location.hash = `#/coding/${k.id}/i${nxt.world}/${nxt.no}`) }, "下一关") : null, h("button", { id: "cl-back-list", onclick: () => (location.hash = `#/coding/${k.id}/i${act.world}`) }, "返回")));
    result.hidden = false; result.dataset.stars = String(stars);
    try { await saveProgress(k, c, act, stars, mistakes); } catch (e) { toast(errText(e), 6000); }
  }
  const lessonBtn = h("button", { id: "cl-lesson-btn", class: "cl-round", type: "button", title: "课程", "aria-label": "课程", onclick: () => void openLesson(c, act.lesson) }, "?");
  let widget!: Widget;
  const hintBtn = h("button", { id: "ci-hint", class: "ci-btn", type: "button", onclick: () => {
    const n = hintBox.children.length;
    if (n < hintList.length) { hints++; hintBox.append(h("li", {}, hintList[n])); return; }
    const extra = widget.extraHint?.();
    if (extra) { hints++; io.say(extra, ""); } else if (n) hintBox.lastElementChild!.classList.add("again");
  } }, "提示");
  const page = h("div", { class: "page cl-page ci-page" + (dev ? " wide" : ""), style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero cl-hero" }, X.back(`#/coding/${k.id}/i${act.world}`, "关卡"), h("h1", { id: "cl-title" }, `${act.world}-${act.no} `, h("span", { class: "user" }, L(act.title))), lessonBtn),
    h("main", { class: "scroll ci-main", id: "ci-main" }, h("div", { class: "narrow ci-box" }, prompt, root, msg, h("div", { class: "ci-tools" }, hintBtn), hintBox, result)));
  X.show(page);
  widget = mount(root, io);
  if (!CM.loadLocal().seen.includes(act.lesson) && c.lessons[act.lesson]) void openLesson(c, act.lesson);
  (window as unknown as { __info: unknown }).__info = { act, seed, solve: () => widget.solve(), wrong: () => widget.wrong(), get state() { return { mistakes, hints, solved, cheated }; } };
}
void isInfoId;
