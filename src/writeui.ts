/**
 * Finger writing (写字) for 识字 (rule 51): `#/write/<kid>`. A character (this week's, a recorded one or any typed) is written stroke by stroke with a finger or an
 * Apple Pencil on a 田字格 board. 描红 shows the faint character and lights the next stroke; 默写 shows nothing and, after two wrong tries at a stroke, shows the
 * right one. Every stroke is judged by the tolerant matcher of writelogic.ts against the centre line of the expected stroke; a right stroke fills in as the
 * font's own stroke with a pop and a sound, a wrong one fades away, a stroke of a later place is "笔顺不对". The strokes and their centre lines are the app's own
 * files (public/strokes and public/medians, Make Me a Hanzi): the first use of a group of characters needs the server of the app once, after that the
 * service worker keeps them. Progress (best stars per character) is kept in `write/<kid>.json`.
 */
import { h, toast } from "./ui";
import * as api from "./api";
import * as M from "./model";
import * as L from "./writelogic";
import { strokesOf } from "./sheet";
import { loadPinyin, pinyinOf } from "./pinyin";
import { sfx } from "./games/sfx";
import { X, errText, frame, icon, loadSettings, saveSettings, reduced, weekOr } from "./dwshell";

const NS = "http://www.w3.org/2000/svg";
const sv = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls = ""): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute("class", cls);
  return e;
};
const FLIP = "translate(0 900) scale(1 -1)";
const writePath = (id: string) => `write/${id}.json`;

// ---------- the centre lines of the strokes: the app's own files (public/medians), kept by the service worker after the first use ----------
const buckets = new Map<string, Promise<Record<string, L.Pt[][]> | null>>();
export async function mediansOf(ch: string): Promise<L.Pt[][] | null> {
  const key = (ch.codePointAt(0)! >> 8).toString(16);
  if (!buckets.has(key)) {
    buckets.set(key, fetch(`${import.meta.env.BASE_URL}medians/${key}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    if (!(await buckets.get(key))) buckets.delete(key);
  }
  return (await buckets.get(key))?.[ch] ?? null;
}
const medPath = (m: L.Pt[]): string => m.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
const STROKE_MS = 650;

export async function renderWrite(id: string): Promise<void> {
  const my = X.epoch();
  X.showLoading();
  let kid: M.KidData, doc: L.WriteDoc;
  try {
    await X.loadShared();
    [kid, doc] = await Promise.all([
      api.readJson<M.KidData>(`kids/${id}.json`).then((x) => x ?? M.EMPTY_KID),
      api.readJson<L.WriteDoc>(writePath(id)).then((x) => x ?? L.EMPTY_WRITE), loadPinyin(),
    ]);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderWrite(id)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) return void (location.hash = "#/chinese");
  mount(k, kid, doc);
}

function mount(k: M.Kid, kid: M.KidData, doc0: L.WriteDoc): void {
  let doc = doc0;
  const st = loadSettings();
  let mode: "trace" | "recite" = st.mode;
  const weekChars = M.weekOf(kid, weekOr(M.sundayOf(M.todayLocal())))?.chars ?? [];
  const allChars = [...new Set(M.allChars(kid))];
  let tab: "week" | "all" | "type" = weekChars.length ? "week" : allChars.length ? "all" : "type";
  let typed = "";
  let ch = "", outlines: string[] = [], meds: L.Pt[][] = [];
  let done = new Set<number>(), nextIdx = 0, mistakes = 0, wrongRun = 0;
  let phase: "loading" | "writing" | "demo" | "done" | "nodata" | "idle" = "idle";
  let load = 0;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  // ----- the board -----
  const svg = sv("svg", { viewBox: "0 0 1024 1024" }, "wr-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.append(
    sv("rect", { x: 12, y: 12, width: 1000, height: 1000, rx: 36, fill: "#fffdf7", stroke: "var(--kid)", "stroke-width": 8 }),
    ...[["512 12", "512 1012"], ["12 512", "1012 512"], ["12 12", "1012 1012"], ["1012 12", "12 1012"]].map(([a, b]) => sv("path", { d: `M${a} L${b}`, fill: "none", stroke: "color-mix(in srgb, var(--kid) 45%, #fff)", "stroke-width": 5, "stroke-dasharray": "16 14" })));
  const faintG = sv("g", { transform: FLIP, class: "wr-faint" });
  const hiG = sv("g", { transform: FLIP, class: "wr-hi" });
  const placedG = sv("g", { transform: FLIP, class: "wr-placed" });
  const animG = sv("g", { class: "wr-anim" });
  svg.append(faintG, hiG, placedG, animG);
  const fx = sv("svg", { viewBox: "0 0 1024 1024" }, "wr-fx");
  fx.setAttribute("aria-hidden", "true");
  const canvas = h("canvas", { class: "wr-ink", id: "wr-ink", "aria-label": "书写区" }) as HTMLCanvasElement;
  const board = h("div", { class: "wr-board", id: "wr-board" }, svg, fx, canvas);
  const msg = h("div", { class: "wr-msg", id: "wr-msg", "aria-live": "polite" });
  const pyEl = h("div", { class: "wr-py", id: "wr-py" });

  const setData = () => {
    board.dataset.state = phase; board.dataset.mode = mode; board.dataset.ch = ch;
    board.dataset.strokes = String(meds.length); board.dataset.next = String(nextIdx); board.dataset.done = String(done.size);
    board.dataset.mistakes = String(mistakes);
  };
  const note = (t: string) => { msg.replaceChildren(t ? h("span", { class: "wr-note" }, t) : ""); };
  const clearAnim = () => { animG.replaceChildren(); board.dataset.hint = "0"; };

  /** the font's stroke fills in along its centre line (a hint, or the demo): the outline is the clip, a thick line along the median is swept in */
  const sweep = (i: number, colour: string, ms: number) => {
    const clip = sv("clipPath", { id: `wr-clip-${i}` });
    clip.append(sv("path", { d: outlines[i] }));
    const g = sv("g", { transform: FLIP, "data-stroke": i }, "wr-sweep-g");
    const line = sv("path", { d: medPath(meds[i]), fill: "none", stroke: colour, "stroke-width": 130, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "clip-path": `url(#wr-clip-${i})` }, "wr-sweep");
    line.style.setProperty("--ms", `${reduced() ? 0 : ms}ms`);
    g.append(clip, line);
    animG.append(g);
  };
  const showHint = (i: number) => { clearAnim(); sweep(i, "#ff922b", STROKE_MS); board.dataset.hint = "1"; };
  const markNext = () => {
    hiG.replaceChildren();
    if (phase === "writing" && nextIdx < outlines.length && mode === "trace") hiG.append(sv("path", { d: outlines[nextIdx] }, "wr-next"));
  };
  const place = (i: number, pop = true) => {
    placedG.append(sv("path", { d: outlines[i], "data-i": i }, "wr-stroke" + (pop && !reduced() ? " wr-pop" : "")));
  };
  const sparkles = () => {
    if (reduced()) return;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 330 + (i % 3) * 40;
      const s = sv("path", { d: "M0 -26 L7 -7 L26 0 L7 7 L0 26 L-7 7 L-26 0 L-7 -7 Z", transform: `translate(512 480)`, fill: ["#ffd43b", "#ff922b", "#f783ac", "#74c0fc"][i % 4] }, "wr-spark");
      (s as SVGElement).style.setProperty("--dx", `${Math.cos(a) * r}px`); (s as SVGElement).style.setProperty("--dy", `${Math.sin(a) * r}px`);
      fx.append(s);
      later(() => s.remove(), 1200);
    }
  };

  // ----- loading a character -----
  const reset = () => {
    for (const t of timers) window.clearTimeout(t);
    timers.clear();
    done = new Set(); nextIdx = 0; mistakes = 0; wrongRun = 0;
    placedG.replaceChildren(); hiG.replaceChildren(); clearAnim(); fx.replaceChildren(); redraw();
    faintG.replaceChildren(...(mode === "trace" ? outlines.map((d) => sv("path", { d })) : []));
    phase = outlines.length ? "writing" : "nodata";
    note(outlines.length ? (mode === "trace" ? "照着描一描。" : "请凭记忆书写。") : "");
    markNext(); setData(); paintList();
  };
  const pick = async (c: string) => {
    const my = ++load;
    ch = c; phase = "loading"; outlines = []; meds = [];
    pyEl.textContent = pinyinOf(c);
    setData(); note("");
    const [o, m] = await Promise.all([strokesOf(c), mediansOf(c)]);
    if (my !== load) return;
    if (!o || !m || o.length !== m.length) { outlines = []; meds = []; reset(); note("暂无这个字的笔顺数据。"); return; }
    outlines = o; meds = m;
    reset();
  };

  // ----- writing -----
  let cur: [number, number][] | null = null, active: number | null = null, penSeen = false;
  const ctx2d = () => canvas.getContext("2d")!;
  const size = () => {
    // the LAYOUT size (offsetWidth / Height), never getBoundingClientRect: a screen that grows in with a scale animation has a rectangle that is a fraction of the real size
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.offsetWidth * dpr)), hh = Math.max(1, Math.round(canvas.offsetHeight * dpr));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    redraw();
  };
  const redraw = () => {
    const c = ctx2d(), dpr = window.devicePixelRatio || 1;
    c.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.points = String(cur?.length ?? 0);
    if (!cur || !cur.length) return;
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#2d2230"; c.fillStyle = "#2d2230";
    c.lineWidth = Math.max(5, canvas.offsetWidth * 0.032) * dpr;
    if (cur.length === 1) { c.beginPath(); c.arc(cur[0][0] * dpr, cur[0][1] * dpr, c.lineWidth / 2, 0, Math.PI * 2); c.fill(); return; }
    c.beginPath(); c.moveTo(cur[0][0] * dpr, cur[0][1] * dpr);
    for (let i = 1; i < cur.length; i++) c.lineTo(cur[i][0] * dpr, cur[i][1] * dpr);
    c.stroke();
  };
  const pos = (e: PointerEvent): [number, number] => {
    // the finger's place in the board's own CSS pixels, also while an ancestor is scaled (a grow-in animation, a zoom): rectangle / layout size = that scale
    const r = canvas.getBoundingClientRect(), kx = r.width && canvas.offsetWidth ? r.width / canvas.offsetWidth : 1, ky = r.height && canvas.offsetHeight ? r.height / canvas.offsetHeight : 1;
    return [(e.clientX - r.left) / kx, (e.clientY - r.top) / ky];
  };
  /** CSS pixels of the board -> the stroke data's coordinates (1024 wide, y upwards, the box's top at 900) */
  const toFont = (p: [number, number]): L.Pt => [(p[0] / canvas.offsetWidth) * 1024, 900 - (p[1] / canvas.offsetHeight) * 1024];
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") penSeen = true;
    if (active !== null || phase !== "writing" || (penSeen && e.pointerType === "touch") || (e.pointerType === "mouse" && e.button !== 0)) return;   // one finger / pencil at a time; palms are ignored once a pencil was used
    e.preventDefault(); active = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    cur = [pos(e)]; redraw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!cur || e.pointerId !== active) return;
    let evs: PointerEvent[] = [e];
    try {
      const co = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.() ?? [];
      const last = co[co.length - 1];
      if (co.length > 1 && last && Math.abs(last.clientX - e.clientX) <= 2 && Math.abs(last.clientY - e.clientY) <= 2) evs = co.every((c) => Math.abs(c.clientX - e.clientX) < 400 && Math.abs(c.clientY - e.clientY) < 400) ? co : [e];
    } catch { /* no coalesced events here */ }
    for (const ev of evs) cur.push(pos(ev));
    redraw();
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    const pts = cur; cur = null; redraw();
    if (pts && phase === "writing") judgeStroke(pts);
  };
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(t, (e) => end(e as PointerEvent));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const fade = (pts: [number, number][]) => {
    if (pts.length < 2) return;
    const w = canvas.offsetWidth || 1, hh = canvas.offsetHeight || 1;
    const line = sv("polyline", { points: pts.map((p) => `${(p[0] / w) * 1024},${(p[1] / hh) * 1024}`).join(" "), fill: "none", stroke: "#e03131", "stroke-width": 30, "stroke-linecap": "round", "stroke-linejoin": "round" }, "wr-bad");
    fx.append(line);
    later(() => line.remove(), 800);
  };
  const judgeStroke = (pts: [number, number][]) => {
    const v = L.judge(pts.map(toFont), meds, done, nextIdx);
    board.dataset.last = v.kind;
    if (v.kind === "tap") return;
    if (v.kind === "ok") {
      clearAnim();
      done.add(nextIdx); place(nextIdx); nextIdx++; wrongRun = 0;
      sfx("pop");
      if (nextIdx >= outlines.length) return void complete();
      note(mode === "trace" ? "照着描一描。" : "请凭记忆书写。");
      markNext(); setData();
      return;
    }
    mistakes++; wrongRun++;
    fade(pts); sfx("bad");
    if (v.kind === "order") {
      note("笔顺不对。请看提示的笔画。");
      board.classList.add("wr-shake"); later(() => board.classList.remove("wr-shake"), 450);
      showHint(nextIdx);
    } else if (v.kind === "direction") {
      note("笔画方向不对。请再试一次。");
      if (mode === "recite" && wrongRun >= 2) showHint(nextIdx);
    } else {
      note("请再试一次。");
      if (mode === "recite" && wrongRun >= 2) showHint(nextIdx);
    }
    setData();
  };
  const complete = () => {
    phase = "done"; hiG.replaceChildren(); clearAnim();
    const stars = L.starsFor(mistakes);
    board.dataset.stars = String(stars);
    sfx("win"); sparkles();
    msg.replaceChildren(h("div", { class: "wr-donebar", id: "wr-donebar" },
      h("div", { class: "gstars", id: "wr-stars", "data-stars": String(stars) }, ...[0, 1, 2].map((i) => icon("star", "gstar" + (i < stars ? " on" : "")))),
      h("div", { class: "wr-donebtns" },
        h("button", { class: "primary", id: "wr-next-char", onclick: () => nextChar() }, "下一个字"),
        h("button", { class: "mopt", id: "wr-again", onclick: () => reset() }, "再写一遍"))));
    setData();
    void save(ch, stars);
  };
  const save = async (c: string, stars: number) => {
    const today = M.todayLocal();
    const working = toast("正在保存…", 0, true);
    try {
      doc = await api.update<L.WriteDoc>(writePath(k.id), L.EMPTY_WRITE, (cur) => L.addResult(cur, c, stars, today), `write ${k.id}`);
      working();
      toast("已记录这个字的成绩");
      paintList();
    } catch (e) {
      working();
      toast(errText(e), 6000);
    }
  };
  const list = () => (tab === "week" ? weekChars : tab === "all" ? allChars : typed ? [typed] : []);
  const nextChar = () => {
    const l = list();
    if (!l.length) return reset();
    const i = l.indexOf(ch);
    void pick(l[(i + 1) % l.length]);
  };

  // ----- the demo -----
  const demo = () => {
    if (phase === "loading" || phase === "nodata" || phase === "idle" || phase === "demo") return;
    reset();
    phase = "demo"; faintG.replaceChildren(); note("演示笔顺"); setData();
    const step = reduced() ? 150 : STROKE_MS + 250;
    outlines.forEach((_, i) => {
      later(() => { board.dataset.demo = String(i + 1); clearAnim(); sweep(i, "#2d2230", STROKE_MS); }, i * step);
      later(() => { clearAnim(); place(i, false); }, i * step + (reduced() ? 100 : STROKE_MS));
    });
    later(() => { delete board.dataset.demo; reset(); note("轮到你了。"); }, outlines.length * step + 700);
  };

  // ----- the panel: mode, actions, the choice of the character -----
  const modeBtn = (m: "trace" | "recite", label: string, idAttr: string) => h("button", { class: mode === m ? "on" : "", id: idAttr, "data-mode": m, onclick: () => {
    mode = m; saveSettings({ mode: m });
    modes.querySelectorAll("button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.mode === m));
    if (outlines.length) reset();
  } }, label);
  const modes = h("div", { class: "seg wr-modes", id: "wr-modes" }, modeBtn("trace", "描红", "wr-mode-trace"), modeBtn("recite", "默写", "wr-mode-recite"));
  const demoBtn = h("button", { class: "mopt", id: "wr-demo", onclick: demo }, "演示笔顺");
  const clearBtn = h("button", { class: "mopt", id: "wr-clear", onclick: () => { if (outlines.length) reset(); } }, "重新书写");
  const listEl = h("div", { class: "wr-list", id: "wr-list" });
  const typeInput = h("input", { class: "wr-type", id: "wr-type", type: "text", maxLength: 8, autocomplete: "off", "aria-label": "输入汉字", placeholder: "输入一个汉字" }) as HTMLInputElement;
  const takeTyped = () => {
    const m = [...typeInput.value].filter((c) => /[一-鿿]/.test(c)).pop();
    if (m && m !== typed) { typed = m; typeInput.value = m; void pick(m); }
    else if (!m) typeInput.value = "";
  };
  typeInput.addEventListener("input", (e) => { if (!(e as InputEvent).isComposing) takeTyped(); });
  typeInput.addEventListener("compositionend", takeTyped);
  function paintList() {
    if (tab === "type") { listEl.replaceChildren(typeInput); return; }
    const l = list();
    listEl.replaceChildren(...(l.length ? l.map((c) => {
      const s = doc.written[c]?.stars ?? 0;
      return h("button", { class: "wr-ch" + (c === ch ? " on" : ""), "data-ch": c, "data-stars": String(s), onclick: () => void pick(c) },
        h("span", { class: "user" }, c), h("small", { class: "wr-st" }, s ? "★".repeat(s) : ""));
    }) : [h("p", { class: "empty" }, tab === "week" ? "这一周还没有汉字。" : "暂无已入库的汉字。")]));
  }
  const tabBtn = (t: typeof tab, label: string) => h("button", { class: tab === t ? "on" : "", id: `wr-tab-${t}`, "data-tab": t, onclick: () => {
    tab = t; tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.tab === t));
    paintList();
    if (t === "type") typeInput.focus();
  } }, label);
  const tabs = h("div", { class: "seg wr-tabs", id: "wr-tabs" }, tabBtn("week", "本周"), tabBtn("all", "已入库"), tabBtn("type", "输入"));

  const layout = h("div", { class: "wr-layout", id: "wr-layout" },
    h("div", { class: "wr-boardwrap" }, pyEl, board, msg),
    h("div", { class: "wr-panel" }, modes, h("div", { class: "wr-actions" }, demoBtn, clearBtn), tabs, listEl));
  X.show(frame(k, "写字", `#/kid/${k.id}`, h("main", { class: "scroll wr-main" }, layout), "wr-pagewrap"));
  const ro = new ResizeObserver(() => size());
  ro.observe(canvas);
  window.requestAnimationFrame(size);
  window.setTimeout(size, 400); window.setTimeout(size, 1200);   // (after the grow-in animation of the screen)
  window.addEventListener("hashchange", () => { ro.disconnect(); for (const t of timers) window.clearTimeout(t); timers.clear(); }, { once: true });
  setData(); paintList();
  const first = list()[0];
  if (first) void pick(first);
  else note("请选择或输入一个汉字。");
}
