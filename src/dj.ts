/**
 * The DJ turntables (DJ 打碟, `#/music/dj`): two decks left and right, a mixer in the middle, eight sample pads, like a real DJ controller.
 * Each deck: a record that turns while it plays (and can be SCRATCHED with a finger / the mouse: Pointer Events, one pointer per deck, so two fingers work on two decks
 * at once), play / pause, CUE, a tempo fader (+-8 %), a track picker, a 3-band EQ and a filter knob. Mixer: equal-power crossfader (keys A / D), two channel faders with
 * level meters, master volume, SYNC, echo / brake / flanger, and a recorder (where the browser has MediaRecorder).
 * The rules are in `djlogic.ts` (pure), the tracks are rendered in code by `djtracks.ts`, the sound is `djaudio.ts`. Nothing is loaded from outside.
 */
import { h, toast } from "./ui";
import * as A from "./musicaudio";
import * as L from "./djlogic";
import * as G from "./djgrid";
import { DJ, type LoadError } from "./djaudio";
import { tr } from "./i18n";
import type { Ctx } from "./english";

interface Deps { X: Ctx; hero: (title: string, back: string, backLabel: string, gearBack: string) => HTMLElement; fullToggle: (get: () => HTMLElement, id: string, onChange?: (on: boolean) => void) => HTMLButtonElement; color: string }

const NS = "http://www.w3.org/2000/svg";
const svgEl = (vb: string, inner: string): SVGSVGElement => { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", vb); s.setAttribute("aria-hidden", "true"); s.innerHTML = inner; return s; };

/** the record: dark vinyl with grooves, two shiny wedges (so that the turning can be seen), a coloured label with a little face, a marker dot near the edge */
function recordArt(color: string): SVGSVGElement {
  const wedge = (a0: number, a1: number) => { const p = (a: number) => `${100 + 98 * Math.cos((a * Math.PI) / 180)} ${100 + 98 * Math.sin((a * Math.PI) / 180)}`; return `<path d="M100 100L${p(a0)}A98 98 0 0 1 ${p(a1)}Z" fill="#fff" opacity=".09"/>`; };
  const grooves = Array.from({ length: 9 }, (_, k) => `<circle cx="100" cy="100" r="${44 + k * 5.6}" fill="none" stroke="${k % 3 === 0 ? "#5a4d66" : "#3e3348"}" stroke-width="${k % 3 === 0 ? 1.6 : 1.1}"/>`).join("");
  return svgEl("0 0 200 200", `<circle cx="100" cy="100" r="98" fill="#2b2230"/><circle cx="100" cy="100" r="95" fill="none" stroke="#4b3f55" stroke-width="2"/>${grooves}${wedge(-70, -40)}${wedge(110, 140)}`
    + `<circle cx="100" cy="100" r="37" fill="${color}" stroke="#fff" stroke-width="3"/><circle cx="100" cy="100" r="30" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 5" opacity=".7"/>`
    + `<circle cx="90" cy="95" r="3.6" fill="#2d2230"/><circle cx="110" cy="95" r="3.6" fill="#2d2230"/><path d="M92 106q8 8 16 0" fill="none" stroke="#2d2230" stroke-width="2.8" stroke-linecap="round"/><circle cx="84" cy="104" r="4" fill="#fff" opacity=".45"/><circle cx="116" cy="104" r="4" fill="#fff" opacity=".45"/>`
    + `<circle cx="100" cy="100" r="3.4" fill="#fff"/><circle cx="100" cy="16" r="5.5" fill="${color}" stroke="#fff" stroke-width="2"/>`);
}

// ---------- a knob / a fader that works with a finger, the mouse and the keyboard ----------
interface CtlOpts { id: string; kind: "knob" | "vfader" | "hfader"; min: number; max: number; value: number; step: number; label: string; reset: number; onInput: (v: number) => void }
interface Ctl { el: HTMLElement; set: (v: number, fire?: boolean) => void; get: () => number }
const THUMB = 40;   // (the same in the css)
function ctl(o: CtlOpts): Ctl {
  const span = o.max - o.min;
  let v = o.value, drag: { id: number; y0: number; v0: number } | null = null;
  const cap = h("span", { class: "dj-cap" });
  const track = h("span", { class: "dj-trk" }, cap);
  const el = h("div", { class: `dj-ctl dj-${o.kind}`, id: o.id, tabIndex: 0 }, track);
  el.setAttribute("role", "slider"); el.setAttribute("aria-label", o.label); el.setAttribute("aria-valuemin", String(o.min)); el.setAttribute("aria-valuemax", String(o.max));
  const draw = () => {
    const f = (v - o.min) / span;
    el.style.setProperty("--f", String(f)); el.dataset.v = String(v); el.setAttribute("aria-valuenow", String(v));
    if (o.kind === "knob") cap.style.transform = `rotate(${-135 + f * 270}deg)`;
  };
  const set = (x: number, fire = false) => {
    const nv = Math.round(L.clamp(Math.round((x - o.min) / o.step) * o.step + o.min, o.min, o.max) * 1000) / 1000;
    if (nv === v) return;
    v = nv; draw(); if (fire) o.onInput(v);
  };
  const fromPointer = (e: PointerEvent) => {
    const r = track.getBoundingClientRect(), vert = o.kind === "vfader";
    const len = (vert ? r.height : r.width) - THUMB, pos = vert ? r.bottom - e.clientY - THUMB / 2 : e.clientX - r.left - THUMB / 2;
    set(o.min + L.clamp(pos / Math.max(1, len), 0, 1) * span, true);
  };
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault(); A.unlock();
    drag = { id: e.pointerId, y0: e.clientY, v0: v };
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
    el.focus({ preventScroll: true });
    if (o.kind !== "knob") fromPointer(e);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (o.kind === "knob") set(drag.v0 + ((drag.y0 - e.clientY) / 150) * span, true); else fromPointer(e);
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, (e) => { if (drag && drag.id === (e as PointerEvent).pointerId) drag = null; });
  el.addEventListener("dblclick", () => set(o.reset, true));
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("keydown", (e) => {
    const k = Math.max(o.step, span / 20);
    if (e.key === "ArrowUp" || e.key === "ArrowRight") set(v + k, true);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") set(v - k, true);
    else if (e.key === "Home") set(o.reset, true);
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  draw();
  return { el, set, get: () => v };
}

const HC = ["#f03e3e", "#fab005", "#12b886", "#339af0"];   // the colours of the four hot cues
const AUTO: [string, number, string][] = [["1_4", 0.25, "1/4"], ["1_2", 0.5, "1/2"], ["1", 1, "1"], ["2", 2, "2"], ["4", 4, "4"], ["8", 8, "8"]];
const clock = (t: number) => { const x = Math.max(0, t), m = Math.floor(x / 60), sec = x - m * 60; return `${m}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`; };
const dprOf = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));
/** sizes a canvas to its LAYOUT size (offsetWidth / offsetHeight: a scale animation of the page does not change them) x the device pixel ratio; false when it is not shown */
function fitCanvas(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const w = c.offsetWidth, hh = c.offsetHeight; if (!w || !hh) return null;
  const k = dprOf(), pw = Math.round(w * k), ph = Math.round(hh * k);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  const x = c.getContext("2d"); if (!x) return null;
  x.setTransform(k, 0, 0, k, 0, 0);
  return x;
}
const mix3 = (lo: number, mi: number, hi: number): string => {
  const t = lo + mi + hi + 1e-6, r = (lo * 240 + mi * 132 + hi * 21) / t, g = (lo * 62 + mi * 94 + hi * 170) / t, b = (lo * 114 + mi * 247 + hi * 191) / t;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};
const ERRORS: Record<LoadError, string> = { decode: "无法解码此文件。请选择 MP3、WAV 或 M4A 等常见的音频文件。", size: "文件过大，上限约 25 MB。", long: "曲目过长，上限为 10 分钟。", empty: "文件为空。" };

const cell = (text: string, ...kids: (Node | string)[]) => h("div", { class: "dj-cell" }, ...kids, h("span", { class: "dj-lab" }, text));
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} %`;
const prefersAudio = (): boolean => !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export function renderDJ(d: Deps): void {
  const { X } = d;
  const dj = new DJ([L.DEFAULT_TRACKS[0], L.DEFAULT_TRACKS[1]]);
  const names = ["a", "b"] as const;
  const idx = [0, 1] as const;

  interface DeckUi { time: HTMLElement; ovw: HTMLCanvasElement; wave: HTMLCanvasElement; name: HTMLElement; hc: HTMLButtonElement[]; loops: Map<string, HTMLButtonElement>; reloop: HTMLButtonElement; rollBtn: HTMLButtonElement; delMode: boolean; rollMode: boolean; drawn: string; drawnO: string; platter: HTMLElement; disc: SVGSVGElement; play: HTMLButtonElement; cue: HTMLButtonElement; bpm: HTMLElement; pct: HTMLElement; load: HTMLElement; sel: HTMLSelectElement; pitch: Ctl; ctls: Ctl[]; finger: number | null; last: { a: number; t: number }; shownPlay: boolean | null }
  const ui: DeckUi[] = [];

  const loadDeck = async (i: 0 | 1, id: string) => {
    const u = ui[i]; u.load.hidden = false; u.sel.disabled = true;
    const ok = await dj.load(i, id);
    if (dj.s.decks[i].track === id) { u.load.hidden = true; u.sel.disabled = false; }
    if (!ok && dj.s.decks[i].track === id) toast("无法生成这首曲目。", 3000);
    if (i === 0) dj.setPitch(0, dj.s.decks[0].pitch);
  };

  const waveEls = [0, 1].map((i) => h("canvas", { class: "dj-wave", id: `dj-wave-${names[i]}`, role: "img", "aria-label": tr(i === 0 ? "A 盘波形" : "B 盘波形") }) as HTMLCanvasElement);
  /** imported music: decode, detect the tempo, show the name (the user's own text) */
  const importFile = async (i: 0 | 1, f: File) => {
    const u = ui[i]; u.load.textContent = "载入中…"; u.load.hidden = false; u.sel.disabled = true;
    const r = await dj.loadFile(i, f);
    u.load.hidden = true; u.load.textContent = "生成中…"; u.sel.disabled = false;
    if (!r.ok) return void toast(ERRORS[r.error], 4500);
    for (const o of [...u.sel.querySelectorAll("option[value=file]")]) o.remove();
    const o = h("option", { value: "file", class: "user" }, f.name); o.classList.add("user");
    u.sel.prepend(o); u.sel.value = "file";
    u.name.textContent = f.name; u.name.hidden = false;
    u.pitch.set(0); dj.setPitch(i, 0, false);
    toast(`已载入：${f.name}（${r.bpm.toFixed(1)} BPM）`, 3200);
  };

  const deckEl = (i: 0 | 1): HTMLElement => {
    const n = names[i], def = L.trackById(dj.s.decks[i].track)!;
    const disc = recordArt(i === 0 ? "#f783ac" : "#74c0fc");
    const platter = h("div", { class: "dj-platter", id: `dj-platter-${n}`, "data-angle": "0", "data-deck": n, role: "img", "aria-label": i === 0 ? "A 唱盘，可用手指搓碟" : "B 唱盘，可用手指搓碟" }, disc);
    const play = h("button", { class: "primary dj-play", id: `dj-play-${n}`, onclick: () => toggle(i) }, "▶ 播放");
    const cue = h("button", { class: "pn-shift dj-cue", id: `dj-cue-${n}`, "aria-label": "提示点：按住试听，松开回到原位" }, "CUE");
    cue.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); dj.cuePress(i); try { cue.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) cue.addEventListener(t, () => dj.cueRelease(i));
    cue.addEventListener("contextmenu", (e) => e.preventDefault());
    const sel = h("select", { class: "dj-select", id: `dj-track-${n}`, "aria-label": i === 0 ? "A 盘曲目" : "B 盘曲目", onchange: (e: Event) => { const id = (e.target as HTMLSelectElement).value; if (id === "file") return; ui[i].name.hidden = true; ui[i].sel.querySelectorAll("option[value=file]").forEach((o) => o.remove()); dj.setPitch(i, 0); ui[i].pitch.set(0); ui[i].last = { a: 0, t: 0 }; void loadDeck(i, id); } },
      ...L.TRACKS.map((t) => h("option", { value: t.id }, `${tr(t.name)} · ${t.bpm}`)));
    sel.value = def.id;
    const pitch = ctl({ id: `dj-pitch-${n}`, kind: "hfader", min: -L.PITCH_RANGE, max: L.PITCH_RANGE, value: 0, step: 0.1, label: "速度", reset: 0, onInput: (v) => dj.setPitch(i, v) });
    const mk = (id: string, label: string, band: "low" | "mid" | "high" | "filter") => ctl({ id: `dj-${id}-${n}`, kind: "knob", min: -1, max: 1, value: 0, step: 0.02, label, reset: 0, onInput: (v) => (band === "filter" ? dj.setFilter(i, v) : dj.setEq(i, band, v)) });
    const low = mk("low", "低音", "low"), mid = mk("mid", "中音", "mid"), high = mk("high", "高音", "high"), filt = mk("filter", "滤波", "filter");
    const bpm = h("b", { id: `dj-bpm-${n}` }, def.bpm.toFixed(1)), pc = h("span", { class: "dj-pct", id: `dj-pct-${n}` }, pct(0)), load = h("span", { class: "dj-load", id: `dj-load-${n}` }, "生成中…");
    const time = h("span", { class: "dj-time", id: `dj-time-${n}` }, "0:00.0 −0:00.0 · 1.1");
    const name = h("span", { class: "dj-tname user", id: `dj-name-${n}` }, "");
    name.hidden = true;
    const wave = waveEls[i];
    const ovw = h("canvas", { class: "dj-ovw", id: `dj-ovw-${n}`, "aria-label": tr("整首曲目：点击或拖动以跳转") }) as HTMLCanvasElement;
    let ovId: number | null = null;
    const ovSeek = (e: PointerEvent) => { const r = ovw.getBoundingClientRect(); dj.seekMove(i, L.clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1) * dj.s.decks[i].dur); };
    ovw.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); ovId = e.pointerId; dj.seekStart(i); ovSeek(e); try { ovw.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
    ovw.addEventListener("pointermove", (e) => { if (ovId === e.pointerId) ovSeek(e); });
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) ovw.addEventListener(t, (e) => { if (ovId === (e as PointerEvent).pointerId) { ovId = null; dj.seekEnd(i); } });
    // imported music: a file picker (the Files app on an iPad) and drag and drop
    const file = h("input", { type: "file", id: `dj-file-${n}`, class: "dj-file", accept: "audio/*", "aria-label": "载入音乐", onchange: (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = ""; if (f) void importFile(i, f); } });
    file.hidden = true;
    const importBtn = h("button", { class: "sheet-btn dj-import", id: `dj-import-${n}`, onclick: () => { A.unlock(); file.click(); } }, "载入音乐");
    const hint = h("span", { class: "muted small dj-hint" }, "刷新页面后需要重新选择文件。");
    // hot cues
    const hc = Array.from({ length: G.HOT_CUES }, (_, k) => {
      const b = h("button", { class: "dj-hc", id: `dj-hc-${n}-${k}`, "data-k": String(k), style: `--c:${HC[k]}`, "aria-label": `热点 ${k + 1}` }, String(k + 1));
      let timer = 0, long = false;
      const stop = () => window.clearTimeout(timer);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); long = false; timer = window.setTimeout(() => { long = true; if (dj.s.decks[i].cues[k] !== null) dj.deleteCue(i, k); }, 600); });
      b.addEventListener("pointerup", () => { stop(); if (long) return; act(); });
      b.addEventListener("pointercancel", stop); b.addEventListener("contextmenu", (e) => e.preventDefault());
      b.addEventListener("click", (e) => { if (e.detail === 0) act(); });
      const act = () => { if (ui[i].delMode) { if (dj.s.decks[i].cues[k] !== null) dj.deleteCue(i, k); return; } dj.hotCue(i, k); };
      return b;
    });
    const hcDel = h("button", { class: "mopt dj-hcdel", id: `dj-hcdel-${n}`, "aria-pressed": "false", onclick: (e: Event) => { const u = ui[i]; u.delMode = !u.delMode; (e.currentTarget as HTMLElement).classList.toggle("on", u.delMode); (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(u.delMode)); } }, "删除");
    const gridBtn = h("button", { class: "mopt dj-gridb", id: `dj-gridb-${n}`, "aria-pressed": "false", onclick: (e: Event) => { const open = gridP.hidden; gridP.hidden = !open; (e.currentTarget as HTMLElement).classList.toggle("on", open); (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(open)); } }, "网格");
    // loops
    const loops = new Map<string, HTMLButtonElement>();
    const loopRow = h("div", { class: "dj-looprow", id: `dj-loops-${n}` });
    for (const [id, beats, label] of AUTO) {
      const b = h("button", { class: "dj-lp", id: `dj-loop-${n}-${id}`, "data-beats": String(beats), "aria-label": `循环 ${label} 拍` }, label);
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault(); A.unlock(); const d = dj.s.decks[i];
        const same = d.loop.on && Math.abs(d.loop.end - d.loop.start - beats * G.beatSeconds(d.grid)) < 1e-3;
        if (ui[i].rollMode) dj.autoLoop(i, beats, true); else if (same) dj.reloop(i); else dj.autoLoop(i, beats, false);
      });
      for (const t of ["pointerup", "pointercancel"]) b.addEventListener(t, () => { if (ui[i].rollMode) dj.rollEnd(i); });
      b.addEventListener("click", (e) => { if (e.detail === 0) dj.autoLoop(i, beats, false); });
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      loops.set(id, b); loopRow.append(b);
    }
    const lc = (id: string, text: string, label: string, f: () => void) => h("button", { class: "mopt dj-lc", id: `dj-${id}-${n}`, "aria-label": label, title: label, onclick: f }, text);
    const reloop = lc("lreloop", "循环", "循环开 / 关（再次开启会回到循环起点）", () => dj.reloop(i));
    const rollBtn = lc("lroll", "ROLL", "滚动循环：按住时循环，松开后继续原来的进度", () => { const u = ui[i]; u.rollMode = !u.rollMode; rollBtn.classList.toggle("on", u.rollMode); rollBtn.setAttribute("aria-pressed", String(u.rollMode)); });
    rollBtn.setAttribute("aria-pressed", "false");
    const loopC = h("div", { class: "dj-loopc", id: `dj-loopc-${n}` }, lc("lin", "IN", "循环入点", () => dj.loopIn(i)), lc("lout", "OUT", "循环出点", () => dj.loopOut(i)), reloop, lc("lhalf", "÷2", "循环缩短一半", () => dj.loopHalf(i)), lc("ldbl", "×2", "循环加长一倍", () => dj.loopDouble(i)), rollBtn);
    // the grid tools: nudge (hold = faster), x2 / ÷2, tap tempo
    const gbpm = h("b", { id: `dj-gbpm-${n}`, class: "dj-gbpm" }, "0");
    const nudge = (id: string, text: string, dir: number, label: string) => {
      const b = h("button", { class: "mopt dj-gb", id: `dj-${id}-${n}`, "aria-label": label, title: label }, text);
      let t1 = 0, iv = 0, t0 = 0;
      const stop = () => { window.clearTimeout(t1); window.clearInterval(iv); };
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); dj.nudgeGrid(i, dir * 10); t0 = performance.now(); t1 = window.setTimeout(() => { iv = window.setInterval(() => dj.nudgeGrid(i, dir * (performance.now() - t0 > 1500 ? 30 : 10)), 100); }, 400); });
      for (const t of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(t, stop);
      b.addEventListener("click", (e) => { if (e.detail === 0) dj.nudgeGrid(i, dir * 10); });
      return b;
    };
    const tapBtn = h("button", { class: "mopt dj-gb", id: `dj-tap-${n}`, "aria-label": "点按定速：按节拍点击", title: "点按定速：按节拍点击", onpointerdown: (e: Event) => { e.preventDefault(); A.unlock(); dj.tap(i); } }, "TAP");
    const gridP = h("div", { class: "dj-gridp", id: `dj-gridp-${n}` }, h("span", { class: "dj-gl" }, gbpm, h("span", { class: "muted small" }, " BPM")), nudge("nm", "−10 ms", -1, "节拍网格提前 10 毫秒"), nudge("np", "+10 ms", 1, "节拍网格推迟 10 毫秒"),
      lc("gx2", "×2", "BPM 加倍", () => dj.scaleGrid(i, 2)), lc("gd2", "÷2", "BPM 减半", () => dj.scaleGrid(i, 0.5)), tapBtn);
    gridP.hidden = true;
    // drag and drop of a file on the deck
    const deckNode = { el: null as HTMLElement | null };
    void deckNode;
    ui[i] = { time, ovw, wave, name, hc, loops, reloop, rollBtn, delMode: false, rollMode: false, drawn: "", drawnO: "", platter, disc, play, cue, bpm, pct: pc, load, sel, pitch, ctls: [low, mid, high, filt], finger: null, last: { a: 0, t: 0 }, shownPlay: null };
    // scratching: the record follows the finger, the sound follows the record
    const centre = () => { const r = platter.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    platter.addEventListener("pointerdown", (e) => {
      if (ui[i].finger !== null) return;
      e.preventDefault(); A.unlock();
      const c = centre(); ui[i].finger = e.pointerId; ui[i].last = { a: L.angleOf(c.x, c.y, e.clientX, e.clientY), t: performance.now() };
      platter.classList.add("held"); platter.dataset.scratch = "1";
      dj.scratchStart(i);
      try { platter.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
    });
    platter.addEventListener("pointermove", (e) => {
      if (ui[i].finger !== e.pointerId) return;
      const c = centre(), a = L.angleOf(c.x, c.y, e.clientX, e.clientY), now = performance.now(), u = ui[i];
      const deg = L.angleDelta(u.last.a, a), secs = (now - u.last.t) / 1000;
      u.last = { a, t: now };
      if (deg !== 0) dj.scratchMove(i, deg, secs);
    });
    const release = (e: Event) => { if (ui[i].finger !== (e as PointerEvent).pointerId) return; ui[i].finger = null; platter.classList.remove("held"); delete platter.dataset.scratch; dj.scratchEnd(i); };
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) platter.addEventListener(t, release);
    platter.addEventListener("contextmenu", (e) => e.preventDefault());
    const sec = h("section", { class: `dj-deck dj-deck-${n}`, id: `dj-deck-${n}`, "data-deck": n },
      h("div", { class: "dj-head" }, h("span", { class: "dj-badge" }, n.toUpperCase()), h("span", { class: "dj-bpmbox" }, bpm, h("span", { class: "muted small" }, " BPM")), time, load, name),
      h("div", { class: "dj-top" },
        h("div", { class: "dj-plat-wrap" }, platter, ovw),
        h("div", { class: "dj-cmain" },
          h("div", { class: "dj-trans" }, play, cue),
          sel,
          h("div", { class: "dj-importrow" }, importBtn, hint),
          h("div", { class: "dj-pitchrow" }, h("span", { class: "muted small dj-pl" }, "速度"), pitch.el, pc))),
      h("div", { class: "dj-knobs" }, cell("低音", low.el), cell("中音", mid.el), cell("高音", high.el), cell("滤波", filt.el)),
      h("div", { class: "dj-hcrow", id: `dj-hcs-${n}` }, ...hc, hcDel, gridBtn),
      loopRow, loopC, gridP, file);
    sec.addEventListener("dragover", (e) => { e.preventDefault(); sec.classList.add("drop"); });
    for (const t of ["dragleave", "dragend"]) sec.addEventListener(t, () => sec.classList.remove("drop"));
    sec.addEventListener("drop", (e) => { e.preventDefault(); sec.classList.remove("drop"); const f = (e as DragEvent).dataTransfer?.files?.[0]; if (f) void importFile(i, f); });
    return sec;
  };

  const toggle = (i: 0 | 1) => { A.unlock(); dj.toggle(i); };

  // ---------- the mixer ----------
  const meter = (n: string) => h("div", { class: "dj-meter", id: `dj-meter-${n}`, "aria-hidden": "true" }, h("i", {}));
  const vol = (i: 0 | 1) => ctl({ id: `dj-vol-${names[i]}`, kind: "vfader", min: 0, max: 1, value: 0.8, step: 0.01, label: i === 0 ? "A 音量" : "B 音量", reset: 0.8, onInput: (v) => dj.setVol(i, v) });
  const volA = vol(0), volB = vol(1);
  const master = ctl({ id: "dj-master", kind: "knob", min: 0, max: 1, value: 0.8, step: 0.01, label: "总音量", reset: 0.8, onInput: (v) => dj.setMaster(v) });
  const cross = ctl({ id: "dj-cross", kind: "hfader", min: -1, max: 1, value: 0, step: 0.02, label: "交叉渐变", reset: 0, onInput: (v) => dj.setCross(v) });
  const fxBtn = (name: "echo" | "flanger" | "brake", text: string) => h("button", { class: "mopt dj-fx", id: `dj-fx-${name}`, "aria-pressed": "false", onclick: (e: Event) => {
    A.unlock(); const b = e.currentTarget as HTMLElement, on = !dj.s.fx[name]; dj.setFx(name, on); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
  } }, text);
  // ---------- recorder ----------
  const recBtn = h("button", { class: "pn-shift dj-rec", id: "dj-rec", onclick: async () => {
    A.unlock();
    if (!dj.s.recording) {
      if (!dj.startRecording()) return void toast("此设备无法录音。", 3000);
      recBtn.textContent = "■ 停止录音"; recBtn.classList.add("on"); toast("开始录音。", 1800);
      return;
    }
    const r = await dj.stopRecording();
    recBtn.textContent = "● 录音"; recBtn.classList.remove("on");
    if (!r) return void toast("录音为空，未保存。", 3000);
    const t = new Date(), p2 = (x: number) => String(x).padStart(2, "0");
    const file = `dj_mix_${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}_${p2(t.getHours())}${p2(t.getMinutes())}.${r.ext}`;
    const url = URL.createObjectURL(r.blob), a = document.createElement("a");
    a.href = url; a.download = file; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`已保存：${file}`);
  } }, "● 录音");
  recBtn.hidden = !DJ.canRecord();
  const fullBtn = d.fullToggle(() => root, "dj-full");

  const syncBtn = h("button", { class: "primary dj-sync", id: "dj-sync", onclick: () => {
    A.unlock(); const r = dj.sync();
    ui[1].pitch.set(dj.s.decks[1].pitch);
    toast(r.ok ? `已同步：B 盘 ${r.bpm.toFixed(1)} BPM` : `超出 ±8 % 范围，已调到极限：B 盘 ${r.bpm.toFixed(1)} BPM`, 2600);
  } }, "SYNC");
  const tog = (id: string, text: string, on: boolean, f: (on: boolean) => void) => { const b = h("button", { class: "mopt dj-tog" + (on ? " on" : ""), id, "aria-pressed": String(on) }, text); b.addEventListener("click", () => { A.unlock(); const v = !b.classList.contains("on"); b.classList.toggle("on", v); b.setAttribute("aria-pressed", String(v)); f(v); }); return b; };
  const quantBtn = tog("dj-quant", "量化", dj.s.quant, (v) => dj.setQuant(v));
  const ZOOMS = [4, 8, 16];
  const zoomVal = h("span", { class: "dj-zoomval", id: "dj-zoomval" }, tr("{0} 秒").replace("{0}", String(dj.s.zoom)));
  const zoom = (dir: number) => { const k = Math.max(0, Math.min(2, ZOOMS.indexOf(dj.s.zoom) + dir)); dj.setZoom(ZOOMS[k]); zoomVal.textContent = tr("{0} 秒").replace("{0}", String(ZOOMS[k])); };
  const zoomOut = h("button", { class: "pn-shift dj-zb", id: "dj-zoom-out", "aria-label": "缩小波形（显示更长时间）", title: "缩小波形（显示更长时间）", onclick: () => zoom(1) }, "−");
  const zoomIn = h("button", { class: "pn-shift dj-zb", id: "dj-zoom-in", "aria-label": "放大波形（显示更短时间）", title: "放大波形（显示更短时间）", onclick: () => zoom(-1) }, "+");
  const lessInit = window.innerHeight <= 520;
  const moreBtn = tog("dj-more", "更多功能", !lessInit, (v) => root.classList.toggle("dj-less", !v));
  const lockBtn = h("button", { class: "mopt dj-lock", id: "dj-lock", "aria-pressed": "false", "aria-label": "同步锁定：播放时持续修正节拍相位", title: "同步锁定：播放时持续修正节拍相位", onclick: () => { A.unlock(); dj.setLock(!dj.s.lock); } }, "锁定");
  const phaseMs = h("span", { class: "dj-phasems", id: "dj-phase-ms" }, "0 ms");
  const phaseDot = h("i", {});
  const phase = h("div", { class: "dj-phase", id: "dj-phase", role: "img", "aria-label": "两个唱盘的节拍相位差" }, h("span", { class: "dj-phtrack" }, phaseDot), phaseMs);
  const mixer = h("section", { class: "dj-mixer", id: "dj-mixer" },
    h("div", { class: "dj-bar" }, recBtn, fullBtn),
    h("div", { class: "dj-bar dj-bar2" }, quantBtn, zoomOut, zoomVal, zoomIn, moreBtn),
    h("div", { class: "dj-faders" },
      h("div", { class: "dj-chan" }, h("div", { class: "dj-fwrap" }, meter("a"), volA.el), h("span", { class: "dj-lab" }, "A")),
      h("div", { class: "dj-mastercell" }, cell("总音量", master.el)),
      h("div", { class: "dj-chan" }, h("div", { class: "dj-fwrap" }, volB.el, meter("b")), h("span", { class: "dj-lab" }, "B"))),
    h("div", { class: "dj-crossrow" }, h("span", { class: "dj-lab" }, "A"), cross.el, h("span", { class: "dj-lab" }, "B")),
    h("div", { class: "dj-fxrow" }, syncBtn, lockBtn, fxBtn("echo", "回声"), fxBtn("brake", "刹车"), fxBtn("flanger", "镶边")),
    phase);

  // ---------- pads ----------
  const padEls = new Map<string, HTMLElement>();
  const hit = (id: L.PadId) => { dj.pad(id); const el = padEls.get(id); if (el) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); } };
  const pads = h("div", { class: "dj-pads", id: "dj-pads" }, ...L.PADS.map((p, k) => {
    const b = h("button", { class: "dj-pad", id: `dj-pad-${p.id}`, "data-pad": p.id, style: `--c:${p.color}`, onclick: (e: MouseEvent) => { if (e.detail === 0) hit(p.id); } }, h("span", { class: "dj-padn" }, String(k + 1)), h("b", {}, p.name));
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); hit(p.id); });
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    padEls.set(p.id, b);
    return b;
  }));

  // ---------- the page ----------
  const root: HTMLElement = h("div", { class: "page inst-page dj-page" + (window.innerHeight <= 520 ? " dj-less" : ""), style: `--kid:${d.color}` }, d.hero("DJ 打碟", "#/subject/music", "音乐", "#/music/dj"),
    h("main", { class: "scroll" }, h("div", { class: "narrow dj-narrow" },
      h("div", { class: "dj-waves", id: "dj-waves" }, waveEls[0], waveEls[1]),
      h("div", { class: "dj-rig" }, deckEl(0), mixer, deckEl(1)),
      pads,
      h("p", { class: "muted small center dj-help" }, "手指按住唱盘并来回转动即可搓碟；空格 / 回车：播放左 / 右盘；A / D：交叉渐变；1–8：音效垫。"))));
  X.show(root);
  if (!prefersAudio()) toast("此设备没有音频功能，仅显示界面。", 4000);
  root.addEventListener("pointerdown", () => { dj.ensure(); }, true);
  for (const i of idx) void loadDeck(i, dj.s.decks[i].track);

  // ---------- drawing: the turning records, the meters, the labels ----------
  // the zoomed waveform: the playhead stays in the middle, the track scrolls under it; coloured by band (low = pink, mid = purple, high = cyan), beat lines (bars thicker,
  // beat numbers 1-4), hot cues and the loop. Sized by LAYOUT size (offsetWidth / offsetHeight), redrawn only when something changed.
  const drawWave = (i: 0 | 1) => {
    const u = ui[i], st = dj.s.decks[i], P = dj.peaks[i], cv = u.wave;
    if (!cv.offsetWidth || !cv.offsetHeight) return;
    const key = [st.pos.toFixed(3), dj.s.zoom, cv.offsetWidth, cv.offsetHeight, dprOf(), st.grid.bpm, st.grid.offset, st.cues.join(), st.loop.on, st.loop.start, st.loop.end, st.peaksN, st.track].join("|");
    if (key === u.drawn) return;
    const x = fitCanvas(cv); if (!x) return;
    u.drawn = key;
    const W = cv.offsetWidth, H = cv.offsetHeight, mid = H / 2, pps = W / dj.s.zoom, t0 = st.pos - W / 2 / pps, loopable = !st.imported;
    x.clearRect(0, 0, W, H);
    x.fillStyle = "#fff7fa"; x.fillRect(0, 0, W, H);
    if (P && P.n) {
      for (let px = 0; px < W; px++) {
        let t = t0 + px / pps; const t1 = t + 1 / pps;
        if (loopable) t = G.mod(t, st.dur); else if (t < 0 || t >= st.dur) continue;
        const b0 = Math.floor(t * P.perSec), b1 = Math.max(b0, Math.floor(((loopable ? t + (t1 - (t0 + px / pps)) : t1) * P.perSec) - 1e-6));
        let amp = 0, lo = 0, mi = 0, hi = 0;
        for (let b = b0; b <= b1 && b < P.n; b++) { amp = Math.max(amp, Math.abs(P.min[b]), Math.abs(P.max[b])); lo = Math.max(lo, P.low[b]); mi = Math.max(mi, P.mid[b]); hi = Math.max(hi, P.high[b]); }
        const hh = Math.max(1, amp * (H / 2 - 3));
        x.fillStyle = mix3(lo, mi, hi); x.fillRect(px, mid - hh, 1, hh * 2);
      }
    }
    // loop region
    if (st.loop.end > st.loop.start) { const xs = W / 2 + (st.loop.start - st.pos) * pps, xe = W / 2 + (st.loop.end - st.pos) * pps; x.fillStyle = st.loop.on ? "rgba(255,212,59,.38)" : "rgba(255,212,59,.16)"; x.fillRect(xs, 0, xe - xs, H); x.fillStyle = "#e67700"; x.fillRect(xs, 0, 2, H); x.fillRect(xe - 2, 0, 2, H); }
    // beat lines
    const g = st.grid, k0 = Math.floor(G.beatPos(g, t0)), k1 = Math.ceil(G.beatPos(g, t0 + W / pps));
    x.font = "bold 10px system-ui, sans-serif"; x.textBaseline = "top";
    for (let k = Math.max(k0, -64); k <= k1; k++) {
      const px = W / 2 + (G.beatTime(g, k) - st.pos) * pps, bar = G.mod(k, 4) === 0;
      x.fillStyle = bar ? "rgba(45,34,48,.85)" : "rgba(45,34,48,.35)"; x.fillRect(Math.round(px) - (bar ? 1 : 0), 0, bar ? 2 : 1, H);
      if (60 / g.bpm * pps > 18) { x.fillStyle = bar ? "#a61e4d" : "#868e96"; x.fillText(String(G.mod(k, 4) + 1), px + 3, 1); }
    }
    // hot cues
    st.cues.forEach((c, k) => { if (c === null) return; const px = W / 2 + (c - st.pos) * pps; if (px < -20 || px > W + 20) return; x.fillStyle = HC[k]; x.fillRect(px - 1, 0, 3, H); x.fillRect(px, 0, 14, 14); x.fillStyle = "#fff"; x.font = "bold 10px system-ui, sans-serif"; x.fillText(String(k + 1), px + 4, 2); });
    // the playhead
    x.fillStyle = "#2d2230"; x.fillRect(W / 2 - 1, 0, 2, H); x.beginPath(); x.moveTo(W / 2 - 6, 0); x.lineTo(W / 2 + 6, 0); x.lineTo(W / 2, 7); x.closePath(); x.fill();
  };
  /** the whole track in one strip with the playhead (tap or drag = needle search) */
  const drawOvw = (i: 0 | 1) => {
    const u = ui[i], st = dj.s.decks[i], P = dj.peaks[i], cv = u.ovw;
    if (!cv.offsetWidth || !cv.offsetHeight) return;
    const key = [st.pos.toFixed(2), cv.offsetWidth, cv.offsetHeight, dprOf(), st.cues.join(), st.loop.on, st.loop.start, st.loop.end, st.peaksN, st.track].join("|");
    if (key === u.drawnO) return;
    const x = fitCanvas(cv); if (!x) return;
    u.drawnO = key;
    const W = cv.offsetWidth, H = cv.offsetHeight, mid = H / 2;
    x.clearRect(0, 0, W, H); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    if (P && P.n) {
      for (let px = 0; px < W; px++) {
        const b0 = Math.floor((px / W) * P.n), b1 = Math.max(b0, Math.floor(((px + 1) / W) * P.n) - 1);
        let amp = 0; for (let b = b0; b <= b1 && b < P.n; b++) amp = Math.max(amp, Math.abs(P.min[b]), Math.abs(P.max[b]));
        const hh = Math.max(0.5, amp * (H / 2 - 2)); x.fillStyle = "#f783ac"; x.fillRect(px, mid - hh, 1, hh * 2);
      }
    }
    if (st.loop.end > st.loop.start) { x.fillStyle = st.loop.on ? "rgba(255,212,59,.5)" : "rgba(255,212,59,.25)"; x.fillRect((st.loop.start / st.dur) * W, 0, ((st.loop.end - st.loop.start) / st.dur) * W, H); }
    st.cues.forEach((c, k) => { if (c !== null) { x.fillStyle = HC[k]; x.fillRect((c / st.dur) * W - 1, 0, 3, H); } });
    x.fillStyle = "#e03131"; x.fillRect((st.pos / st.dur) * W - 1, 0, 2, H);
  };
  let raf = 0;
  const frame = () => {
    const visible = !document.hidden;
    for (const i of idx) {
      const u = ui[i], s = dj.s.decks[i];
      u.disc.style.transform = `rotate(${s.angle.toFixed(2)}deg)`; u.platter.dataset.angle = s.angle.toFixed(1);
      u.platter.classList.toggle("turning", Math.abs(s.cur) > 0.05);
      u.platter.dataset.rate = s.cur.toFixed(3);
      u.bpm.textContent = s.bpm.toFixed(1); u.pct.textContent = pct(s.pitch);
      const on = s.playing; if (on !== u.shownPlay) { u.shownPlay = on; u.play.textContent = on ? "❚❚ 暂停" : "▶ 播放"; u.play.classList.toggle("on", on); }
      const bb = G.barBeat(s.grid, s.pos);
      u.time.textContent = `${clock(s.pos)} −${clock(s.dur - s.pos)} · ${bb.bar}.${bb.beat}`;
      u.time.dataset.bar = String(bb.bar); u.time.dataset.beat = String(bb.beat);
      s.cues.forEach((c, k) => { const b = u.hc[k]; const set = c !== null; if (b.classList.contains("set") !== set) b.classList.toggle("set", set); });
      for (const [id, b] of u.loops) { const beats = +b.dataset.beats!, act = s.loop.on && Math.abs(s.loop.end - s.loop.start - beats * G.beatSeconds(s.grid)) < 1e-3; if (b.classList.contains("on") !== act) b.classList.toggle("on", act); }
      u.reloop.classList.toggle("on", s.loop.on);
      const gb = document.getElementById(`dj-gbpm-${names[i]}`); if (gb) gb.textContent = s.grid.bpm.toFixed(1);
      const m = document.getElementById(`dj-meter-${names[i]}`);
      if (m) { const lv = Math.round(dj.s.meters[i] * 100); m.style.setProperty("--l", `${lv}%`); m.dataset.level = String(lv); }
      if (visible) { drawWave(i); drawOvw(i); }
    }
    lockBtn.classList.toggle("on", dj.s.lock); lockBtn.setAttribute("aria-pressed", String(dj.s.lock));
    const ms = dj.s.phase.ms; phaseMs.textContent = `${ms >= 0 ? "+" : "−"}${Math.abs(ms).toFixed(0)} ms`; phase.dataset.ms = ms.toFixed(1);
    phaseDot.style.left = `${50 + L.clamp(ms / 60, -1, 1) * 48}%`; phase.classList.toggle("ok", Math.abs(ms) < 12);
    raf = window.requestAnimationFrame(frame);
  };
  raf = window.requestAnimationFrame(frame);

  // ---------- the keyboard ----------
  const typing = (t: EventTarget | null) => { const e = t as HTMLElement | null; return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable); };
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (e.type === "keydown" && !e.repeat) toggle(e.key === " " ? 0 : 1); return; }
    if (e.type !== "keydown") return;
    const k = e.key.toLowerCase();
    if (k === "a" || k === "d") { e.preventDefault(); cross.set(cross.get() + (k === "a" ? -0.1 : 0.1), true); return; }
    const p = L.padOfKey(e.key); if (p && !e.repeat) { e.preventDefault(); A.unlock(); hit(p); }
  };
  document.addEventListener("keydown", onKey, true); document.addEventListener("keyup", onKey, true);
  const guard = window.setInterval(() => {
    if (root.isConnected) return;
    window.clearInterval(guard); window.cancelAnimationFrame(raf); dj.dispose();
    document.removeEventListener("keydown", onKey, true); document.removeEventListener("keyup", onKey, true);
  }, 300);
}
