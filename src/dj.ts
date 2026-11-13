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
import { DJ } from "./djaudio";
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

const cell = (text: string, ...kids: (Node | string)[]) => h("div", { class: "dj-cell" }, ...kids, h("span", { class: "dj-lab" }, text));
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} %`;
const prefersAudio = (): boolean => !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export function renderDJ(d: Deps): void {
  const { X } = d;
  const dj = new DJ([L.DEFAULT_TRACKS[0], L.DEFAULT_TRACKS[1]]);
  const names = ["a", "b"] as const;
  const idx = [0, 1] as const;

  interface DeckUi { platter: HTMLElement; disc: SVGSVGElement; play: HTMLButtonElement; cue: HTMLButtonElement; bpm: HTMLElement; pct: HTMLElement; load: HTMLElement; prog: HTMLElement; sel: HTMLSelectElement; pitch: Ctl; ctls: Ctl[]; finger: number | null; last: { a: number; t: number }; shownPlay: boolean | null }
  const ui: DeckUi[] = [];

  const loadDeck = async (i: 0 | 1, id: string) => {
    const u = ui[i]; u.load.hidden = false; u.sel.disabled = true;
    const ok = await dj.load(i, id);
    if (dj.s.decks[i].track === id) { u.load.hidden = true; u.sel.disabled = false; }
    if (!ok && dj.s.decks[i].track === id) toast("无法生成这首曲目。", 3000);
    if (i === 0) dj.setPitch(0, dj.s.decks[0].pitch);
  };

  const deckEl = (i: 0 | 1): HTMLElement => {
    const n = names[i], def = L.trackById(dj.s.decks[i].track)!;
    const disc = recordArt(i === 0 ? "#f783ac" : "#74c0fc");
    const prog = h("i", {});
    const platter = h("div", { class: "dj-platter", id: `dj-platter-${n}`, "data-angle": "0", "data-deck": n, role: "img", "aria-label": i === 0 ? "A 唱盘，可用手指搓碟" : "B 唱盘，可用手指搓碟" }, disc);
    const play = h("button", { class: "primary dj-play", id: `dj-play-${n}`, onclick: () => toggle(i) }, "▶ 播放");
    const cue = h("button", { class: "pn-shift dj-cue", id: `dj-cue-${n}`, "aria-label": "提示点：按住试听，松开回到原位" }, "CUE");
    cue.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); dj.cuePress(i); try { cue.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) cue.addEventListener(t, () => dj.cueRelease(i));
    cue.addEventListener("contextmenu", (e) => e.preventDefault());
    const sel = h("select", { class: "dj-select", id: `dj-track-${n}`, "aria-label": i === 0 ? "A 盘曲目" : "B 盘曲目", onchange: (e: Event) => { const id = (e.target as HTMLSelectElement).value; dj.setPitch(i, 0); ui[i].pitch.set(0); ui[i].last = { a: 0, t: 0 }; void loadDeck(i, id); } },
      ...L.TRACKS.map((t) => h("option", { value: t.id }, `${tr(t.name)} · ${t.bpm}`)));
    sel.value = def.id;
    const pitch = ctl({ id: `dj-pitch-${n}`, kind: "hfader", min: -L.PITCH_RANGE, max: L.PITCH_RANGE, value: 0, step: 0.1, label: "速度", reset: 0, onInput: (v) => dj.setPitch(i, v) });
    const mk = (id: string, label: string, band: "low" | "mid" | "high" | "filter") => ctl({ id: `dj-${id}-${n}`, kind: "knob", min: -1, max: 1, value: 0, step: 0.02, label, reset: 0, onInput: (v) => (band === "filter" ? dj.setFilter(i, v) : dj.setEq(i, band, v)) });
    const low = mk("low", "低音", "low"), mid = mk("mid", "中音", "mid"), high = mk("high", "高音", "high"), filt = mk("filter", "滤波", "filter");
    const bpm = h("b", { id: `dj-bpm-${n}` }, def.bpm.toFixed(1)), pc = h("span", { class: "dj-pct", id: `dj-pct-${n}` }, pct(0)), load = h("span", { class: "dj-load", id: `dj-load-${n}` }, "生成中…");
    ui[i] = { platter, disc, play, cue, bpm, pct: pc, load, prog, sel, pitch, ctls: [low, mid, high, filt], finger: null, last: { a: 0, t: 0 }, shownPlay: null };
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
    return h("section", { class: `dj-deck dj-deck-${n}`, id: `dj-deck-${n}`, "data-deck": n },
      h("div", { class: "dj-head" }, h("span", { class: "dj-badge" }, n.toUpperCase()), h("span", { class: "dj-bpmbox" }, bpm, h("span", { class: "muted small" }, " BPM")), load),
      h("div", { class: "dj-plat-wrap" }, platter, h("div", { class: "dj-prog" }, prog)),
      h("div", { class: "dj-ctrl" },
        h("div", { class: "dj-cmain" },
          h("div", { class: "dj-trans" }, play, cue),
          sel,
          h("div", { class: "dj-pitchrow" }, h("span", { class: "muted small dj-pl" }, "速度"), pitch.el, pc)),
        h("div", { class: "dj-knobs" }, cell("低音", low.el), cell("中音", mid.el), cell("高音", high.el), cell("滤波", filt.el))));
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
  const mixer = h("section", { class: "dj-mixer", id: "dj-mixer" },
    h("div", { class: "dj-bar" }, recBtn, fullBtn),
    h("div", { class: "dj-faders" },
      h("div", { class: "dj-chan" }, h("div", { class: "dj-fwrap" }, meter("a"), volA.el), h("span", { class: "dj-lab" }, "A")),
      h("div", { class: "dj-mastercell" }, cell("总音量", master.el)),
      h("div", { class: "dj-chan" }, h("div", { class: "dj-fwrap" }, volB.el, meter("b")), h("span", { class: "dj-lab" }, "B"))),
    h("div", { class: "dj-crossrow" }, h("span", { class: "dj-lab" }, "A"), cross.el, h("span", { class: "dj-lab" }, "B")),
    h("div", { class: "dj-fxrow" }, syncBtn, fxBtn("echo", "回声"), fxBtn("brake", "刹车"), fxBtn("flanger", "镶边")));

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
  const root: HTMLElement = h("div", { class: "page inst-page dj-page", style: `--kid:${d.color}` }, d.hero("DJ 打碟", "#/subject/music", "音乐", "#/music/dj"),
    h("main", { class: "scroll" }, h("div", { class: "narrow dj-narrow" },
      h("div", { class: "dj-rig" }, deckEl(0), mixer, deckEl(1)),
      pads,
      h("p", { class: "muted small center dj-help" }, "手指按住唱盘并来回转动即可搓碟；空格 / 回车：播放左 / 右盘；A / D：交叉渐变；1–8：音效垫。"))));
  X.show(root);
  if (!prefersAudio()) toast("此设备没有音频功能，仅显示界面。", 4000);
  root.addEventListener("pointerdown", () => { dj.ensure(); }, true);
  for (const i of idx) void loadDeck(i, dj.s.decks[i].track);

  // ---------- drawing: the turning records, the meters, the labels ----------
  let raf = 0;
  const frame = () => {
    for (const i of idx) {
      const u = ui[i], s = dj.s.decks[i];
      u.disc.style.transform = `rotate(${s.angle.toFixed(2)}deg)`; u.platter.dataset.angle = s.angle.toFixed(1);
      u.platter.classList.toggle("turning", Math.abs(s.cur) > 0.05);
      u.platter.dataset.rate = s.cur.toFixed(3);
      u.bpm.textContent = s.bpm.toFixed(1); u.pct.textContent = pct(s.pitch);
      const on = s.playing; if (on !== u.shownPlay) { u.shownPlay = on; u.play.textContent = on ? "❚❚ 暂停" : "▶ 播放"; u.play.classList.toggle("on", on); }
      const len = L.loopSeconds(L.trackById(s.track)!); (u.prog as HTMLElement).style.width = `${((s.pos / len) * 100).toFixed(1)}%`;
      const m = document.getElementById(`dj-meter-${names[i]}`);
      if (m) { const lv = Math.round(dj.s.meters[i] * 100); m.style.setProperty("--l", `${lv}%`); m.dataset.level = String(lv); }
    }
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
