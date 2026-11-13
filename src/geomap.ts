/**
 * The 地图 page (`#/science/map`, for everybody, under 科学): maps of China (the 34 province-level divisions, rivers, mountains, lakes, land forms, cities) and of the
 * world (countries, continents, oceans) and the flags, to LOOK at (tap a region = a card) and to PRACTISE (rounds of 10, no time limit, the answer and a sentence
 * after every question). Progress: with a child chosen it is kept in `geomap/<kid>.json` (memory boxes, `api.update`), without a child on this device only
 * (`learn.geomap.v1`). The data is part of the program (works offline). Rules: geomapgeo.ts / geomapmodel.ts; the drawing: geomapview.ts; flags: geoflags.ts.
 */
import { h, toast, confirmDlg } from "./ui";
import * as M from "./model";
import * as api from "./api";
import * as P from "./profile";
import * as G from "./game";
import { tr } from "./i18n";
import { subjectArt } from "./hub";
import { loadGeo, provincesAlong, continentOf, type Geo, type Prov, type Country, type Hit, type Pt } from "./geomapgeo";
import * as GM from "./geomapmodel";
import { MapView } from "./geomapview";
import { flagSvg, FLAG_IDS } from "./geoflags";
import type { Ctx } from "./english";

const COLOR = "#7048e8";
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- what this device remembers (a convenience: the tab, the child, the guest's progress) ----------
interface Local { kid: string; tab: GM.Tab; guest: GM.GeoDoc }
const KEY = "learn.geomap.v1";
const loadLocal = (): Local => {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return { kid: typeof p.kid === "string" ? p.kid : "", tab: ["china", "world", "flags"].includes(p.tab) ? p.tab : "china", guest: p.guest && typeof p.guest.cards === "object" ? p.guest : GM.EMPTY_GEO }; } catch { return { kid: "", tab: "china", guest: GM.EMPTY_GEO }; }
};
const saveLocal = (l: Local) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private mode: nothing is remembered */ } };

/** a sentence with {0} {1} ...: the sentence is translated, the names in it are marked as the user's own text (never translated) */
export function fmt(t: GM.Text): (Node | string)[] {
  const s = tr(t.tpl), out: (Node | string)[] = [];
  let last = 0;
  for (const m of s.matchAll(/\{(\d+)\}/g)) { out.push(s.slice(last, m.index)); out.push(h("span", { class: "user" }, t.args[Number(m[1])] ?? "")); last = (m.index ?? 0) + m[0].length; }
  out.push(s.slice(last));
  return out.filter((x) => x !== "");
}
/** reads a name aloud with the device's own voice (nothing where there is none) */
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
function speak(text: string) {
  if (!canSpeak()) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = 0.85; speechSynthesis.speak(u); } catch { /* no voice */ }
}
const svgFlag = (id: string, cls = ""): HTMLElement => { const d = h("span", { class: "gmap-flagbox " + cls }); d.innerHTML = flagSvg(id); return d; };

export async function renderMap(X: Ctx): Promise<void> {
  const my = X.epoch();
  X.showLoading();
  let geo: Geo;
  try { geo = await loadGeo(); } catch (e) { return my === X.epoch() ? X.showError(e, () => void renderMap(X)) : undefined; }
  let kids: M.Kid[] = [];
  try { await X.loadShared(); kids = X.kids().kids; } catch { /* no data repository reachable: the page still works for a guest */ }
  if (my !== X.epoch()) return;
  const local = loadLocal();
  if (local.kid && !kids.some((k) => k.id === local.kid)) local.kid = "";
  let tab = local.tab;
  let level = 4;
  let doc: GM.GeoDoc = GM.EMPTY_GEO;
  let view: MapView | null = null;
  let selected: string | null = null;
  const layers = { river: false, mountain: false, lake: false, area: false };
  let flagCont = "";

  const kidName = () => kids.find((k) => k.id === local.kid)?.name ?? "";
  async function loadDoc() {
    if (!local.kid) { doc = local.guest; return; }
    try { doc = (await api.readJson<GM.GeoDoc>(GM.geomapPath(local.kid))) ?? GM.EMPTY_GEO; } catch (e) { doc = GM.EMPTY_GEO; toast(errText(e), 6000); }
  }
  const setLevelFromGrade = () => { level = GM.levelOfGrade(local.kid ? P.gradeOf(local.kid) : null); };

  // ---------- saving ----------
  async function save(answers: { key: string; right: boolean }[], score: number, total: number, finished: boolean) {
    if (!answers.length) return;
    const today = M.todayLocal();
    const done = toast("正在保存…", 0, true);
    try {
      if (local.kid) doc = await api.update<GM.GeoDoc>(GM.geomapPath(local.kid), GM.EMPTY_GEO, (cur) => GM.applyAnswers(cur, answers, today, finished ? { score, total } : undefined), `geomap ${local.kid}`);
      else { doc = GM.applyAnswers(doc, answers, today, finished ? { score, total } : undefined); local.guest = doc; saveLocal(local); }
      done();
      toast("已记录这次练习");
    } catch (e) { done(); toast(errText(e), 6000); }
  }

  // ---------- the page ----------
  const page = h("div", { class: "page", style: `--kid:${COLOR}` });
  const body = h("div", { class: "gmap-body" });
  const hero = h("header", { class: "top hero home-hero subj-hero" }, X.back("#/subject/science", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, "地图")), X.gear("#/science/map"));
  page.append(hero, h("main", { class: "scroll" }, h("div", { class: "wide gmap-wrap" }, body)));

  const chip = (label: string, on: boolean, id: string, fn: () => void, user = false) => h("button", { class: "mopt" + (on ? " on" : ""), id, onclick: fn }, user ? h("span", { class: "user" }, label) : label);

  function head(): HTMLElement {
    const who = h("div", { class: "mset-opts gmap-who", id: "gmap-who" }, h("span", { class: "gmap-lab" }, "学习者："),
      chip("访客", !local.kid, "who-guest", () => void pickKid("")),
      ...kids.map((k) => chip(k.name, local.kid === k.id, `who-${k.id}`, () => void pickKid(k.id), true)));
    const where = h("p", { class: "muted small gmap-where", id: "gmap-where" }, local.kid ? h("span", {}, "练习记录保存在：", h("b", { class: "user" }, kidName())) : "未选择孩子：练习记录只保存在这台设备上。");
    const lev = h("div", { class: "mset-opts gmap-level", id: "gmap-level" }, h("span", { class: "gmap-lab" }, "范围："),
      ...GM.LEVEL_NAMES.map((n, i) => chip(n, level === i + 1, `lev-${i + 1}`, () => { level = i + 1; selected = null; draw(); })));
    const tabs = h("div", { class: "seg tabs gmap-tabs", id: "gmap-tabs" },
      ...([["china", "中国"], ["world", "世界"], ["flags", "国旗"]] as const).map(([v, label]) => h("button", { class: tab === v ? "on" : "", "data-tab": v, id: `gmap-tab-${v}`, onclick: () => { tab = v; local.tab = v; saveLocal(local); selected = null; draw(); } }, label)));
    return h("div", { class: "gmap-head" }, who, where, lev, tabs);
  }
  async function pickKid(id: string) {
    local.kid = id; saveLocal(local);
    setLevelFromGrade();
    await loadDoc();
    selected = null;
    draw();
  }

  // ---------- the info card ----------
  const info = h("div", { class: "gmap-card", id: "gmap-card" });
  const speakBtn = (text: string) => (canSpeak() ? h("button", { class: "gmap-speak", id: "gmap-speak", title: "朗读", "aria-label": "朗读", onclick: () => speak(text) }, "🔊") : null);
  const row = (k: string, ...v: (Node | string)[]) => h("div", { class: "gmap-row" }, h("span", {}, k), h("b", {}, ...v));
  const userB = (t: string) => h("span", { class: "user" }, t);
  function provCard(p: Prov) {
    const nbs = p.nb.map((id) => geo.china.provinces.find((x) => x.id === id)!);
    info.replaceChildren(
      h("div", { class: "gmap-card-top" }, h("h2", { class: "user gmap-name", id: "gmap-name" }, p.n), h("span", { class: "muted gmap-py user" }, p.py), speakBtn(p.n)),
      row("全称", userB(p.full)), row("简称", userB(p.ab)),
      row(p.ct === "省会" || p.ct === "首府" ? p.ct : "类型", userB(p.ct === "省会" || p.ct === "首府" ? p.cap : p.type)),
      row("地理区域", userB(p.reg)),
      h("div", { class: "gmap-row gmap-nbs" }, h("span", {}, "相邻"), nbs.length ? h("div", { class: "gmap-chips" }, ...nbs.map((n) => h("button", { class: "gmap-nb user", "data-id": n.id, onclick: () => select("prov", n.id) }, n.n))) : h("b", {}, "无陆地相邻")));
  }
  function countryCard(c: Country) {
    const nbs = c.nb.map((id) => geo.world.countries.find((x) => x.id === id)!);
    const cont = geo.world.continents.find((k) => k.id === c.cont)!;
    info.replaceChildren(
      h("div", { class: "gmap-card-top" }, FLAG_IDS.includes(c.id) ? svgFlag(c.id, "gmap-bigflag") : null, h("div", { class: "gmap-titles" }, h("h2", { class: "user gmap-name", id: "gmap-name" }, c.n), h("span", { class: "muted gmap-py user" }, c.py)), speakBtn(c.n)),
      row("首都", userB(c.cap)), row("大洲", userB(c.tc ? (c.id === "eg" ? "非洲、亚洲" : c.id === "ru" ? "欧洲、亚洲" : "亚洲、欧洲") : cont.n)),
      h("div", { class: "gmap-row gmap-nbs" }, h("span", {}, "相邻（本页收录）"), nbs.length ? h("div", { class: "gmap-chips" }, ...nbs.map((n) => h("button", { class: "gmap-nb user", "data-id": n.id, onclick: () => select("country", n.id) }, n.n))) : h("b", {}, "无")));
  }
  function featCard(layer: string, id: string) {
    const c = geo.china;
    const list = layer === "river" ? c.rivers : layer === "mountain" ? c.mountains : layer === "lake" ? c.lakes : c.areas;
    const f = list.find((x) => x.id === id)!;
    const kind = layer === "river" ? "河流" : layer === "mountain" ? "山脉" : layer === "lake" ? "湖泊" : f.kind ?? "地形区";
    const shape = view!.shapes.find((s) => s.layer === layer && s.id === id)!;
    const provs = provincesAlong(view!.shapes.filter((s) => s.layer === "prov"), shape).map((pid) => c.provinces.find((p) => p.id === pid)!).filter(Boolean);
    info.replaceChildren(
      h("div", { class: "gmap-card-top" }, h("h2", { class: "user gmap-name", id: "gmap-name" }, f.n), speakBtn(f.n)),
      row("类别", kind),
      h("div", { class: "gmap-row gmap-nbs" }, h("span", {}, layer === "river" ? "流经" : "位于"), provs.length ? h("div", { class: "gmap-chips" }, ...provs.map((n) => h("button", { class: "gmap-nb user", "data-id": n.id, onclick: () => select("prov", n.id) }, n.n))) : h("b", {}, "——")));
  }
  function contCard(id: string) {
    const k = geo.world.continents.find((x) => x.id === id), o = geo.world.oceans.find((x) => x.id === id);
    const n = (k ?? o)!.n;
    const cs = k ? geo.world.countries.filter((c) => c.cont === id) : [];
    info.replaceChildren(
      h("div", { class: "gmap-card-top" }, h("div", { class: "gmap-titles" }, h("h2", { class: "user gmap-name", id: "gmap-name" }, n), k ? h("span", { class: "muted gmap-py user" }, k.py) : null), speakBtn(n)),
      row("类别", k ? "大洲" : "大洋"),
      ...(cs.length ? [h("div", { class: "gmap-row gmap-nbs" }, h("span", {}, "本页收录的国家"), h("div", { class: "gmap-chips" }, ...cs.map((c) => h("button", { class: "gmap-nb user", "data-id": c.id, onclick: () => select("country", c.id) }, c.n))))] : []));
  }
  const hint = () => info.replaceChildren(h("p", { class: "muted gmap-hint", id: "gmap-hint" }, tab === "flags" ? "点击国旗，查看国家的信息。" : "点击地图上的地区，查看详细信息。"));
  /** select a region: light it up on the map and show its card */
  function select(layer: string, id: string) {
    selected = `${layer}:${id}`;
    view?.unmark("pick");
    if (view) { view.mark(layer, id, "pick"); }
    if (layer === "prov") provCard(geo.china.provinces.find((p) => p.id === id)!);
    else if (layer === "country") { countryCard(geo.world.countries.find((c) => c.id === id)!); }
    else if (layer === "land" || layer === "ocean") contCard(layer === "land" ? (id === "ruEu" ? "eu" : id === "ruAs" ? "as" : id) : id);
    else featCard(layer, id);
    info.dataset.sel = selected;
  }
  function onMapTap(hit: Hit | null, at: Pt) {
    if (!hit) return;
    if (tab === "world" && (hit.layer === "land")) { const k = continentOf(geo.world, hit, at[0]); if (k) return select("land", k); }
    if (tab === "world" && hit.layer === "country" && hit.id === "ru") { /* a country card */ }
    select(hit.layer, hit.id);
  }

  // ---------- the tabs ----------
  function modesBox(tabId: GM.Tab): HTMLElement {
    const cards = GM.MODES.filter((m) => m.tab === tabId).map((m) => {
      const ms = GM.mastery(doc, geo, m.id, level);
      const pct = ms.total ? Math.round((ms.known / ms.total) * 100) : 0;
      return h("button", { class: "gmap-mode", id: `mode-${m.id}`, "data-mode": m.id, disabled: ms.total === 0, onclick: () => void startQuiz(m.id) },
        h("b", {}, m.name), h("span", { class: "muted small" }, m.sub),
        h("span", { class: "gmap-prog" }, h("i", { style: `width:${pct}%` })),
        h("span", { class: "muted small gmap-known", "data-known": String(ms.known), "data-total": String(ms.total) }, `已掌握 ${ms.known} / ${ms.total}`));
    });
    return h("div", { class: "gmap-practice" }, h("h2", { class: "sec", id: "gmap-practice" }, "练习"), h("p", { class: "muted small" }, "每轮 10 题，没有时间限制。"), h("div", { class: "gmap-modes", id: "gmap-modes" }, ...cards));
  }
  function mapChips(): HTMLElement | null {
    if (tab !== "china") return null;
    const items: [keyof typeof layers, string][] = [["river", "河流"], ["mountain", "山脉"], ["lake", "湖泊"], ["area", "地形区"]];
    return h("div", { class: "mset-opts gmap-layers", id: "gmap-layers" }, ...items.map(([k, label]) => h("button", { class: "mopt" + (layers[k] ? " on" : ""), id: `layer-${k}`, "aria-pressed": String(layers[k]), onclick: (e: Event) => { layers[k] = !layers[k]; view?.setLayer(k, layers[k]); (e.currentTarget as HTMLElement).classList.toggle("on", layers[k]); (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(layers[k])); } }, label)));
  }
  function flagGrid(): HTMLElement {
    const list = geo.world.countries.filter((c) => FLAG_IDS.includes(c.id) && c.lv <= level && (!flagCont || c.cont === flagCont));
    const chips = h("div", { class: "mset-opts gmap-layers", id: "gmap-fconts" }, chip("全部", flagCont === "", "fc-all", () => { flagCont = ""; draw(); }),
      ...geo.world.continents.filter((k) => k.id !== "an").map((k) => chip(k.n, flagCont === k.id, `fc-${k.id}`, () => { flagCont = k.id; draw(); })));
    const grid = h("div", { class: "gmap-flags", id: "gmap-flags" }, ...list.map((c) => h("button", { class: "gmap-flagtile" + (selected === `country:${c.id}` ? " pick" : ""), "data-id": c.id, onclick: () => { select("country", c.id); grid.querySelectorAll(".gmap-flagtile").forEach((b) => b.classList.toggle("pick", (b as HTMLElement).dataset.id === c.id)); } }, svgFlag(c.id), h("span", { class: "user" }, c.n))));
    return h("div", {}, chips, grid);
  }
  function draw() {
    view?.dispose(); view = null;
    const head0 = head();
    let main: HTMLElement;
    if (tab === "flags") {
      main = h("div", { class: "gmap-cols gmap-flagcols" }, h("div", { class: "gmap-left" }, flagGrid()), h("div", { class: "gmap-side" }, info, modesBox("flags")));
    } else {
      view = new MapView({ kind: tab === "china" ? "china" : "world", geo, learn: true, layers: Object.entries(layers).filter(([, v]) => v).map(([k]) => k), scrollPage: true, onTap: onMapTap });
      main = h("div", { class: "gmap-cols" }, h("div", { class: "gmap-left" }, h("div", { class: "gmap-stage", id: "gmap-stage" }, view.el), mapChips(), h("p", { class: "muted small center gmap-tip" }, "两指缩放，单指拖动；点击地区查看信息。")), h("div", { class: "gmap-side" }, info, modesBox(tab)));
    }
    body.replaceChildren(head0, main);
    if (selected) { const [l, id] = selected.split(":"); if (tab === "flags" || view) select(l, id); else hint(); } else hint();
  }

  // ---------- the quiz ----------
  async function startQuiz(mode: string) {
    await loadDoc();
    const rnd = Math.random;
    const qs = GM.buildRound(geo, doc, mode, level, M.todayLocal(), rnd);
    if (!qs.length) return;
    playRound(qs, mode);
  }
  function playRound(qs: GM.Question[], mode: string) {
    const def = GM.modeById(mode);
    const answers: { key: string; right: boolean; q: GM.Question; picked?: string }[] = [];
    let idx = 0, score = 0, phase: "ask" | "feedback" | "end" = "ask";
    const quit = h("button", { class: "gquit", id: "game-quit", title: "退出游戏", "aria-label": "退出游戏", onclick: () => void leave() }, "×");
    const progress = h("span", { class: "gprogress", id: "game-progress" });
    const scoreEl = h("span", { class: "gscore", id: "game-score" }, "★ 0");
    const promptEl = h("div", { class: "mq-text gmap-q", id: "gmap-q" });
    const qBox = h("div", { class: "mq gmap-qbox", id: "math-card" }, promptEl);
    const mapBox = h("div", { class: "gmap-qmap", id: "gmap-qmap" });
    const grid = h("div", { class: "mchoices gmap-choices", id: "math-choices" });
    const fb = h("div", { class: "gmap-fb", id: "gmap-fb" });
    const root = h("div", { class: "game mathgame gmap-quiz", id: "game", role: "dialog", "aria-modal": "true", "data-mode": mode, style: `--kid:${COLOR}` },
      h("div", { class: "gtop" }, quit, h("div", { class: "gmid" }, progress), scoreEl),
      h("div", { class: "mwrap" }, h("div", { class: "mbody gmap-qbody" }, h("div", { class: "mtopic" }, def.name), qBox, mapBox, grid, fb)));
    let qview: MapView | null = null;

    const lock = (right: boolean, picked: string, q: GM.Question) => {
      phase = "feedback";
      answers.push({ key: q.key, right, q, picked });
      if (right) score++;
      scoreEl.textContent = `★ ${score}`;
      root.classList.add(right ? "ok" : "bad");
      root.dataset.last = right ? "right" : "wrong";
      const last = idx + 1 >= qs.length;
      fb.replaceChildren(h("div", { class: "mexplain", id: "math-explain" }, h("b", { class: right ? "yes" : "no" }, right ? "回答正确。" : "回答有误。"),
        h("p", { id: "gmap-explain" }, ...fmt(q.explain)),
        h("button", { class: "primary", id: "math-next", onclick: next }, last ? "完成" : "下一题")));
      fb.querySelector<HTMLElement>("#math-next")?.focus({ preventScroll: true });
      qview?.update();
    };
    const next = () => { if (phase !== "feedback") return; idx++; ask(); };
    function choose(k: string) {
      if (phase !== "ask") return;
      const q = qs[idx], right = k === q.answer;
      grid.querySelectorAll<HTMLElement>(".mchoice").forEach((b) => { b.setAttribute("disabled", ""); if (b.dataset.v === q.answer) b.classList.add("right"); else if (b.dataset.v === k) b.classList.add("wrong"); });
      lock(right, k, q);
    }
    function tapped(hit: Hit | null, at: Pt) {
      if (phase !== "ask" || !hit) return;
      const q = qs[idx];
      let got: string | null = null;
      if (mode === "w-ktap") {
        if (hit.layer === "ocean") got = hit.id;
        else { const k = continentOf(geo.world, hit, at[0]); if (k) got = k; }
        if (!got) return;
        const right = got === q.answer;
        // light: the right region (the continent's land or the ocean) and the one touched
        const lightC = (id: string, cls: string) => { if (geo.world.continents.some((c) => c.id === id)) { for (const c of geo.world.countries.filter((c) => c.cont === id)) qview!.mark("country", c.id, cls); for (const k of Object.keys(geo.world.land)) if (continentOf(geo.world, { id: k, layer: "land", via: "inside" }, 0) === id) qview!.mark("land", k, cls); } else qview!.mark("ocean", id, cls); };
        if (!right) lightC(got, "wrong"); lightC(q.answer, "right");
        return lock(right, got, q);
      }
      if (!q.layers?.includes(hit.layer)) return;
      const right = hit.id === q.answer;
      if (!right) qview!.mark(hit.layer, hit.id, "wrong");
      qview!.mark(q.layers.includes("prov") ? "prov" : q.layers.includes("country") ? "country" : answerLayer(q), q.answer, "right");
      lock(right, hit.id, q);
    }
    const answerLayer = (q: GM.Question) => ["river", "mountain", "lake", "area"].find((l) => (qview as MapView).shapes.some((s) => s.layer === l && s.id === q.answer)) ?? "river";

    function ask() {
      if (idx >= qs.length) return finish();
      phase = "ask";
      root.classList.remove("ok", "bad");
      const q = qs[idx];
      progress.textContent = `${idx + 1} / ${qs.length}`;
      root.dataset.qkey = q.key;
      fb.replaceChildren();
      promptEl.replaceChildren(...(q.flag ? [svgFlag(q.flag, "gmap-qflag")] : []), h("span", { class: "gmap-qtext" }, ...fmt(q.prompt)));
      // the map (only for questions that use it)
      mapBox.style.display = q.map ? "" : "none";
      if (q.map) {
        if (qview && qview.svg.dataset.kind !== q.map) { qview.dispose(); qview = null; mapBox.replaceChildren(); }
        if (!qview) {
          qview = new MapView({ kind: q.map, geo, learn: false, layers: ["river", "mountain", "lake", "area"], onTap: tapped });
          mapBox.replaceChildren(qview.el);
        }
        qview.unmark(); qview.dimOthers(false); qview.reset();
        qview.el.classList.toggle("gmap-notap", q.type !== "tap");
        if (q.lit) { qview.mark(q.map === "china" ? "prov" : "country", q.lit, "lit"); qview.dimOthers(true); }
        // the layers of the land forms are only shown when they are what is asked
        if (q.map === "china") for (const l of ["river", "mountain", "lake", "area"]) qview.setLayer(l, mode === "cn-feat");
        if (q.map === "world") { qview.setLayer("ocean", mode === "w-ktap"); qview.hide("country", "ru", mode === "w-ktap"); }
      }
      // choices
      grid.style.display = q.choices.length ? "" : "none";
      const flagsC = q.choices.some((c) => c.flag);
      const longest = Math.max(0, ...q.choices.map((c) => [...c.t].length));
      grid.classList.toggle("long", !flagsC && longest > 14);
      grid.classList.toggle("flagc", flagsC);
      grid.replaceChildren(...q.choices.map((c) => { const b = h("button", { class: "mchoice" + (flagsC ? " flagch" : " user"), "data-v": c.k, onclick: () => choose(c.k) }); if (c.flag) { b.append(svgFlag(c.flag)); b.setAttribute("aria-label", c.t); } else b.textContent = c.t; return b; }));
      qview?.update();
    }
    function finish() {
      if (phase === "end") return;
      phase = "end";
      document.removeEventListener("keydown", onKey);
      qview?.dispose();
      const saving = save(answers.map((a) => ({ key: a.key, right: a.right })), score, qs.length, true);
      const stars = G.starsFor(score, qs.length);
      const wrong = answers.filter((a) => !a.right);
      const starSvg = (on: boolean) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "gstar" + (on ? " on" : "")); s.innerHTML = '<path d="M12 1.800l3 6.500 7.100.9-5.200 4.900 1.400 7L12 17.600 5.700 21.100l1.400-7L1.900 9.200l7.100-.9z" stroke-width="1.500" stroke-linejoin="round"/>'; return s; };
      root.replaceChildren(h("div", { class: "gend", id: "game-end" },
        h("h2", {}, score === qs.length ? "全部正确。" : "练习完成。"),
        h("div", { class: "gstars", "data-stars": String(stars) }, ...[1, 2, 3].map((n) => starSvg(n <= stars))),
        h("div", { class: "gresult" }, h("strong", { id: "game-final" }, String(score)), ` / ${qs.length}`),
        wrong.length ? h("div", { class: "mrows", id: "gmap-wrong" }, h("p", { class: "muted small" }, "需要复习："), ...wrong.map((a) => h("div", { class: "mrow", "data-key": a.key }, h("span", { class: "user" }, a.q.name)))) : null,
        h("div", { class: "row end" },
          h("button", { id: "game-done", onclick: async () => { await saving; root.remove(); draw(); } }, "完成"),
          h("button", { class: "primary", id: "game-again", onclick: async () => { await saving; root.remove(); void startQuiz(mode); } }, "再玩一次"))));
    }
    async function leave() {
      if (phase === "end") return;
      const yes = await confirmDlg("退出游戏？", answers.length ? "已完成的题目将被保存。" : "尚未答题，不会保存。", "退出", true);
      if (!yes) return;
      document.removeEventListener("keydown", onKey);
      qview?.dispose();
      root.remove();
      if (answers.length) void save(answers.map((a) => ({ key: a.key, right: a.right })), score, qs.length, false).then(() => draw());
      else draw();
    }
    function onKey(e: KeyboardEvent) {
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") void leave();
      else if (phase === "feedback" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); }
      else if (phase === "ask" && /^[1-4]$/.test(e.key)) grid.querySelectorAll<HTMLElement>(".mchoice")[Number(e.key) - 1]?.click();
    }
    document.addEventListener("keydown", onKey);
    document.body.append(root);
    ask();
  }

  // ---------- start ----------
  setLevelFromGrade();
  await loadDoc();
  if (my !== X.epoch()) return;
  X.show(page);
  draw();
}
