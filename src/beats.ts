/**
 * The beat maker (节奏编辑器, `#/music/beats`): a drum-machine grid like GarageBand's beat sequencer. One row per instrument (7 drums, piano, guitar, bass), the columns are the
 * steps of one bar; a tap lights a cell, a finger dragged across the cells paints many (the first cell decides on / off), a play head runs along the grid and loops.
 * The rules are in `beatlogic.ts` (pure, tested without a screen), the sound in `musicaudio.ts` (made in code), the MIDI file in `musicrec.ts`.
 * The notes are scheduled on the audio clock (a timer every 25 ms schedules the next 100 ms), never one timer per note.
 */
import { h, toast, confirmDlg } from "./ui";
import * as A from "./musicaudio";
import * as B from "./beatlogic";
import * as R from "./musicrec";
import { tr } from "./i18n";
import type { Ctx } from "./english";

interface Deps { X: Ctx; hero: (title: string, back: string, backLabel: string, gearBack: string) => HTMLElement; fullToggle: (get: () => HTMLElement, id: string, onChange?: (on: boolean) => void) => HTMLButtonElement; color: string }

// ---------- little cartoon faces for the round labels ----------
const eyes = (x: number, y: number) => `<circle cx="${x - 4}" cy="${y}" r="1.8" fill="#2d2230"/><circle cx="${x + 4}" cy="${y}" r="1.8" fill="#2d2230"/><path d="M${x - 3} ${y + 4}q3 3 6 0" fill="none" stroke="#2d2230" stroke-width="1.6" stroke-linecap="round"/>`;
const GLYPH: Record<B.TrackId, string> = {
  kick: `<circle cx="20" cy="21" r="13" fill="#fff"/><circle cx="20" cy="21" r="9" fill="none" stroke="#2d2230" stroke-width="1.4" opacity=".3"/>${eyes(20, 19)}`,
  snare: `<path d="M7 15v11q0 5 13 5t13-5V15" fill="#fff"/><ellipse cx="20" cy="15" rx="13" ry="5" fill="#fff" stroke="#2d2230" stroke-width="1.4" opacity=".95"/>${eyes(20, 24)}<path d="M5 6l12 7M35 6L23 13" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  hat: `<ellipse cx="20" cy="14" rx="14" ry="3.6" fill="#fff"/><ellipse cx="20" cy="20" rx="14" ry="3.6" fill="#fff"/><path d="M20 8v26" stroke="#fff" stroke-width="2.4"/>${eyes(20, 28)}`,
  open: `<ellipse cx="20" cy="11" rx="14" ry="3.6" fill="#fff"/><ellipse cx="20" cy="21" rx="14" ry="3.6" fill="#fff"/><path d="M20 6v28" stroke="#fff" stroke-width="2.4"/>${eyes(20, 30)}`,
  tom: `<path d="M9 16v10q0 5 11 5t11-5V16" fill="#fff"/><ellipse cx="20" cy="16" rx="11" ry="4.6" fill="#fff" stroke="#2d2230" stroke-width="1.4" opacity=".95"/>${eyes(20, 24)}`,
  crash: `<path d="M5 22q15-14 30 0q-15 5-30 0z" fill="#fff"/><circle cx="20" cy="18" r="2.4" fill="#2d2230" opacity=".35"/>${eyes(20, 27)}<path d="M8 8l4 4M32 8l-4 4M20 4v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  ride: `<ellipse cx="20" cy="17" rx="15" ry="5" fill="#fff"/><circle cx="20" cy="17" r="3" fill="#2d2230" opacity=".35"/>${eyes(20, 27)}`,
  piano: `<rect x="6" y="9" width="28" height="22" rx="4" fill="#fff"/><path d="M13 9v22M20 9v22M27 9v22" stroke="#2d2230" stroke-width="1.1" opacity=".3"/><rect x="11" y="9" width="4.4" height="12" rx="1" fill="#2d2230"/><rect x="24.6" y="9" width="4.4" height="12" rx="1" fill="#2d2230"/>${eyes(20, 25)}`,
  guitar: `<path d="M26 6l8 8-9 9" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M17 14q-8-2-10 6t0 12q8 6 13-2t0-10q-2-4-3-6z" fill="#fff"/><circle cx="16" cy="25" r="2.6" fill="#2d2230" opacity=".4"/>${eyes(14, 20)}`,
  bass: `<circle cx="14" cy="28" r="7" fill="#fff"/><path d="M20 28V8l10 4" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${eyes(14, 26)}`,
};
export const trackIcon = (id: B.TrackId): SVGSVGElement => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 40 40"); s.setAttribute("aria-hidden", "true"); s.innerHTML = GLYPH[id]; return s; };
const speaker = (muted: boolean): SVGSVGElement => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("width", "22"); s.setAttribute("height", "22"); s.innerHTML = `<path d="M3 9v6h4l5 4V5L7 9z" fill="currentColor"/>${muted ? `<path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>` : `<path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`}`; return s; };

export function renderBeats(d: Deps): void {
  const { X } = d;
  const store = B.loadStore();
  let p = store.cur;
  const hist = new B.History();
  let sel: B.TrackId = "kick";
  const choice = {} as Record<B.TrackId, number>;
  B.TRACKS.forEach((t) => (choice[t.id] = 1));
  let pg = 0, paged = false, curCell = { t: 0, s: 0 }, shownStep = -1, raf = 0;

  const persist = () => { store.cur = p; B.saveStore(store); };

  // ---------- sound ----------
  const fire = (e: B.Ev, when?: number) => {
    if (e.kind === "drum") A.drumHit(e.drum!, e.vel, when);
    else if (e.kind === "piano") A.pianoDown(e.midi[0], e.vel * 0.9, when, e.hold);
    else if (e.kind === "bass") A.bassNote(e.midi[0], e.vel, when, e.hold);
    else e.midi.forEach((m, i) => A.pluck(m, e.vel * 0.85, when === undefined ? undefined : when + i * 0.012));
  };
  const preview = (t: B.TrackId, c = choice[t]) => {
    A.unlock();
    const def = B.trackDef(t);
    fire({ track: t, kind: def.kind, drum: def.drum, midi: def.kind === "drum" ? [] : B.choicesOf(t, p.scale)[c - 1].midi, vel: p.vol[t], hold: 0.35 });
  };
  const seq = new B.Sequencer(() => p, A.now, (e, when) => fire(e, when));

  // ---------- elements ----------
  const grid = h("div", { class: "bt-grid", id: "bt-grid", tabIndex: 0, role: "grid", "aria-label": "节奏格子" });
  const wrap = h("div", { class: "bt-wrap" }, grid);
  const pagerInfo = h("span", { class: "bt-pg-info", id: "bt-page-info" });
  const pager = h("div", { class: "bt-pager", id: "bt-pager", hidden: true },
    h("button", { class: "pn-shift", id: "bt-page-prev", "aria-label": "上一页", title: "上一页", onclick: () => setPage(pg - 1) }, "‹"), pagerInfo,
    h("button", { class: "pn-shift", id: "bt-page-next", "aria-label": "下一页", title: "下一页", onclick: () => setPage(pg + 1) }, "›"));
  const cellEls = new Map<string, HTMLElement>();   // "track:step"
  const rowEls = new Map<B.TrackId, HTMLElement>();
  const headEls = new Map<number, HTMLElement>();

  const cellKey = (t: B.TrackId, s: number) => `${t}:${s}`;
  const build = () => {
    const n = B.cols(p), w = wrap.clientWidth || window.innerWidth - 20;
    const wide = w >= 560, lab = wide ? 128 : 36;
    paged = n > 8 && (w - 16 - lab - 2 * n) / n < 20;
    const size = paged ? n / 2 : n;
    if (!paged || pg * size >= n) pg = 0;
    const from = paged ? pg * size : 0;
    grid.style.setProperty("--lab", `${lab}px`); grid.style.setProperty("--cols", String(size));
    grid.classList.toggle("wide", wide);
    cellEls.clear(); rowEls.clear(); headEls.clear();
    const head = h("div", { class: "bt-row bt-head", "aria-hidden": "true" }, h("span", { class: "bt-hsp" }, ""));
    for (let s = from; s < from + size; s++) {
      const beat = s % p.res === 0;
      const c = h("span", { class: "bt-hc" + (beat ? " beat" : "") + (Math.floor(s / p.res) % 2 ? " g1" : ""), "data-s": String(s) }, beat ? String(s / p.res + 1) : "·");
      headEls.set(s, c); head.append(c);
    }
    const rows: HTMLElement[] = [head];
    for (const t of B.TRACKS) {
      const lb = h("button", { class: "bt-lab", id: `bt-lab-${t.id}`, "data-t": t.id, title: t.name, "aria-label": t.name, onpointerdown: (e: Event) => { e.preventDefault(); selectTrack(t.id); preview(t.id); }, onclick: (e: MouseEvent) => { if (e.detail === 0) { selectTrack(t.id); preview(t.id); } } }, trackIcon(t.id));
      const row = h("div", { class: "bt-row bt-track", "data-t": t.id, style: `--c:${t.color}` }, h("div", { class: "bt-labbox" }, lb, h("span", { class: "bt-name" }, t.name)));
      for (let s = from; s < from + size; s++) {
        const c = h("div", { class: "bt-cell" + (Math.floor(s / p.res) % 2 ? " g1" : ""), "data-t": t.id, "data-s": String(s), role: "gridcell" });
        cellEls.set(cellKey(t.id, s), c); row.append(c);
      }
      rowEls.set(t.id, row); rows.push(row);
    }
    grid.replaceChildren(...rows);
    pager.hidden = !paged;
    pagerInfo.textContent = `${pg + 1} / ${n / size}`;
    (pager.querySelector("#bt-page-prev") as HTMLButtonElement).disabled = pg === 0;
    (pager.querySelector("#bt-page-next") as HTMLButtonElement).disabled = pg >= n / size - 1;
    shownStep = -1;
    paintAll();
  };
  const paintCell = (t: B.TrackId, s: number) => {
    const c = cellEls.get(cellKey(t, s)); if (!c) return;
    const v = p.tracks[t][s];
    c.classList.toggle("lit", v > 0);
    c.dataset.v = String(v);
    c.textContent = v > 0 && B.isMelodic(t) ? B.choicesOf(t, p.scale)[v - 1].label : "";
  };
  const paintAll = () => {
    for (const t of B.TRACKS) {
      for (let s = 0; s < B.MAXC; s++) paintCell(t.id, s);
      const row = rowEls.get(t.id)!;
      row.classList.toggle("muted", p.mute.includes(t.id));
      row.classList.toggle("sel", t.id === sel);
    }
    markCursor();
    undoBtn.disabled = hist.size === 0;
  };
  const markCursor = () => {
    grid.querySelectorAll(".cur").forEach((e) => e.classList.remove("cur"));
    cellEls.get(cellKey(B.TRACKS[curCell.t].id, curCell.s))?.classList.add("cur");
  };
  const setPage = (n: number) => { pg = Math.max(0, Math.min(1, n)); if (paged) build(); };

  // ---------- selecting a row and its panel ----------
  const panel = h("div", { class: "bt-panel", id: "bt-panel" });
  const selectTrack = (t: B.TrackId) => { sel = t; rowEls.forEach((r, id) => r.classList.toggle("sel", id === t)); drawPanel(); };
  const volInput = h("input", { type: "range", class: "bt-slider", id: "bt-vol", min: "0", max: "100", value: "80", "aria-label": "音量", oninput: (e: Event) => { p.vol[sel] = +(e.target as HTMLInputElement).value / 100; persist(); } });
  const muteBtn = h("button", { class: "pn-shift bt-mute", id: "bt-mute", onclick: () => toggleMute(sel) });
  const panelName = h("span", { class: "bt-pname", id: "bt-pname" });
  const panelIco = h("span", { class: "bt-pico" });
  const pitchBox = h("div", { class: "bt-pitches", id: "bt-pitches" });
  const scaleBox = h("div", { class: "bt-scales", id: "bt-scales" });
  const toggleMute = (t: B.TrackId) => {
    p.mute = p.mute.includes(t) ? p.mute.filter((x) => x !== t) : [...p.mute, t];
    rowEls.get(t)?.classList.toggle("muted", p.mute.includes(t)); persist(); drawPanel();
    toast(p.mute.includes(t) ? `${tr(B.trackDef(t).name)}：静音` : `${tr(B.trackDef(t).name)}：有声`, 1600);
  };
  const drawPanel = () => {
    const def = B.trackDef(sel), muted = p.mute.includes(sel);
    panel.style.setProperty("--c", def.color);
    panelIco.replaceChildren(trackIcon(sel));
    panelName.textContent = def.name;
    muteBtn.replaceChildren(speaker(muted)); muteBtn.classList.toggle("on", muted);
    muteBtn.title = muted ? "取消静音" : "静音"; muteBtn.setAttribute("aria-label", muted ? "取消静音" : "静音");
    volInput.value = String(Math.round(p.vol[sel] * 100));
    const ch = B.choicesOf(sel, p.scale);
    pitchBox.replaceChildren(...ch.map((c, i) => h("button", { class: "mopt bt-pitch" + (choice[sel] === i + 1 ? " on" : ""), "data-i": String(i + 1), onclick: () => { choice[sel] = i + 1; preview(sel); drawPanel(); } }, c.label)));
    pitchBox.hidden = !ch.length;
    scaleBox.hidden = def.kind !== "piano" && def.kind !== "bass";
    scaleBox.replaceChildren(...B.SCALES.map((s) => h("button", { class: "mopt" + (p.scale === s.id ? " on" : ""), id: `bt-scale-${s.id}`, onclick: () => { p.scale = s.id; persist(); paintAll(); drawPanel(); preview(sel); } }, s.name)));
    hint.hidden = ch.length > 0;
  };
  const hint = h("span", { class: "muted small bt-hint" }, "点击格子点亮；手指拖过可连续绘制。");
  panel.append(h("div", { class: "bt-pl" }, panelIco, panelName), muteBtn, h("label", { class: "bt-vl" }, h("span", { class: "muted small" }, "音量"), volInput), pitchBox, scaleBox, hint,
    h("button", { class: "sheet-btn", id: "bt-clear-track", onclick: () => { if (!B.countLit(p, sel)) return void toast("该行已为空。", 1800); remember(); B.clearTrack(p, sel); changed(); toast(`已清空：${tr(B.trackDef(sel).name)}（可撤销）`, 2200); } }, "清空这一行"));

  // ---------- changing the cells ----------
  const remember = () => { hist.push(p); };
  const changed = () => { persist(); paintAll(); };
  let stroke: { id: number; mode: "on" | "off"; seen: Set<string>; changed: boolean } | null = null;
  const cellAt = (x: number, y: number): HTMLElement | null => { const e = document.elementFromPoint(x, y); return e instanceof HTMLElement ? e.closest<HTMLElement>(".bt-cell") : null; };
  const touchCell = (c: HTMLElement, first: boolean) => {
    if (!stroke) return;
    const t = c.dataset.t as B.TrackId, s = +c.dataset.s!, k = cellKey(t, s);
    if (stroke.seen.has(k)) return;
    stroke.seen.add(k);
    const v = stroke.mode === "off" ? 0 : B.isMelodic(t) ? choice[t] : 1;
    if (p.tracks[t][s] === v) return;
    if (!stroke.changed) { remember(); stroke.changed = true; }
    B.setCell(p, t, s, stroke.mode, choice[t]);
    paintCell(t, s);
    if (first && stroke.mode === "on" && !seq.running) preview(t, choice[t]);
  };
  grid.addEventListener("pointerdown", (e) => {
    const c = cellAt(e.clientX, e.clientY); if (!c) return;
    e.preventDefault(); A.unlock();
    const t = c.dataset.t as B.TrackId, s = +c.dataset.s!;
    curCell = { t: B.TRACKS.findIndex((x) => x.id === t), s };
    if (sel !== t) selectTrack(t);
    stroke = { id: e.pointerId, mode: B.decide(p, t, s, choice[t]), seen: new Set(), changed: false };
    try { grid.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
    touchCell(c, true); markCursor();
  });
  grid.addEventListener("pointermove", (e) => { if (!stroke || stroke.id !== e.pointerId) return; const c = cellAt(e.clientX, e.clientY); if (c) touchCell(c, false); });
  const endStroke = (e: Event) => { if (!stroke || stroke.id !== (e as PointerEvent).pointerId) return; const ch = stroke.changed; stroke = null; if (ch) changed(); };
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) grid.addEventListener(t, endStroke);
  grid.addEventListener("contextmenu", (e) => e.preventDefault());
  grid.addEventListener("keydown", (e) => {
    const n = B.cols(p);
    const go = (dt: number, ds: number) => { e.preventDefault(); curCell = { t: Math.max(0, Math.min(B.TRACKS.length - 1, curCell.t + dt)), s: Math.max(0, Math.min(n - 1, curCell.s + ds)) }; const size = paged ? n / 2 : n; if (paged && Math.floor(curCell.s / size) !== pg) { pg = Math.floor(curCell.s / size); build(); } sel = B.TRACKS[curCell.t].id; rowEls.forEach((r, id) => r.classList.toggle("sel", id === sel)); drawPanel(); markCursor(); };
    if (e.key === "ArrowRight") go(0, 1); else if (e.key === "ArrowLeft") go(0, -1); else if (e.key === "ArrowDown") go(1, 0); else if (e.key === "ArrowUp") go(-1, 0);
    else if ((e.key === " " || e.key === "Enter") && !e.shiftKey) {
      e.preventDefault();
      const t = B.TRACKS[curCell.t].id, mode = B.decide(p, t, curCell.s, choice[t]);
      remember(); B.setCell(p, t, curCell.s, mode, choice[t]); changed();
      if (mode === "on" && !seq.running) preview(t);
    }
  });

  // ---------- playing ----------
  const playBtn = h("button", { class: "primary bt-play", id: "bt-play", onclick: () => toggle() }, "▶ 播放");
  const showHead = (s: number) => {
    if (s === shownStep) return;
    if (paged && s >= 0) { const size = B.cols(p) / 2, want = Math.floor(s / size); if (want !== pg && want < 2) { pg = want; build(); } }
    headEls.get(shownStep)?.classList.remove("now");
    for (const t of B.TRACKS) cellEls.get(cellKey(t.id, shownStep))?.classList.remove("now");
    shownStep = s;
    if (s < 0) return;
    headEls.get(s)?.classList.add("now");
    for (const t of B.TRACKS) cellEls.get(cellKey(t.id, s))?.classList.add("now");
  };
  const frame = () => { if (!seq.running) return; showHead(seq.current()); raf = window.requestAnimationFrame(frame); };
  const toggle = () => {
    A.unlock();
    if (seq.running) {
      seq.stop(); window.cancelAnimationFrame(raf); showHead(-1);
      playBtn.textContent = "▶ 播放"; playBtn.classList.remove("on");
    } else {
      seq.start(); playBtn.textContent = "■ 停止"; playBtn.classList.add("on");
      raf = window.requestAnimationFrame(frame);
    }
  };

  // ---------- the controls ----------
  const bpmNum = h("b", { class: "bt-bpm", id: "bt-bpm" }, String(p.bpm));
  const tempo = h("input", { type: "range", class: "bt-slider", id: "bt-tempo", min: String(B.BPM_MIN), max: String(B.BPM_MAX), value: String(p.bpm), "aria-label": "速度", oninput: (e: Event) => setBpm(+(e.target as HTMLInputElement).value) });
  const setBpm = (v: number) => { p.bpm = Math.max(B.BPM_MIN, Math.min(B.BPM_MAX, Math.round(v))); bpmNum.textContent = String(p.bpm); tempo.value = String(p.bpm); persist(); };
  const chip = (id: string, text: string, on: boolean, f: () => void) => h("button", { class: "mopt" + (on ? " on" : ""), id, onclick: f }, text);
  const sigBox = h("div", { class: "bt-chips", id: "bt-sig" });
  const resBox = h("div", { class: "bt-chips", id: "bt-res" });
  const swingBtn = h("button", { class: "mopt", id: "bt-swing", onclick: () => { p.swing = !p.swing; persist(); drawControls(); } }, "摇摆");
  const undoBtn = h("button", { class: "pn-shift", id: "bt-undo", "aria-label": "撤销", title: "撤销", onclick: () => undo() }, "↶ 撤销");
  const undo = () => {
    const prev = hist.pop();
    if (!prev) return;
    prev.bpm = p.bpm; prev.vol = p.vol; prev.mute = p.mute;
    p = prev; persist(); drawControls(); build(); drawPanel();
    toast("已撤销", 1500);
  };
  const drawControls = () => {
    sigBox.replaceChildren(chip("bt-sig-4", "4/4", p.beats === 4, () => { if (p.beats === 4) return; remember(); p.beats = 4; persist(); drawControls(); build(); }), chip("bt-sig-3", "3/4", p.beats === 3, () => { if (p.beats === 3) return; remember(); p.beats = 3; persist(); drawControls(); build(); }));
    const set = (r: 2 | 4) => () => { if (p.res === r) return; remember(); B.setRes(p, r); persist(); drawControls(); build(); };
    resBox.replaceChildren(chip("bt-res-2", tr("{0} 格").replace("{0}", String(p.beats * 2)), p.res === 2, set(2)), chip("bt-res-4", tr("{0} 格").replace("{0}", String(p.beats * 4)), p.res === 4, set(4)));
    swingBtn.classList.toggle("on", p.swing);
    bpmNum.textContent = String(p.bpm); tempo.value = String(p.bpm);
  };
  const presetBox = h("div", { class: "bt-presets", id: "bt-presets" }, h("span", { class: "muted small" }, "节奏模板："), ...B.PRESETS.map((pr) => h("button", { class: "mopt", id: `bt-preset-${pr.id}`, onclick: () => { remember(); B.applyPreset(p, pr); persist(); drawControls(); build(); drawPanel(); toast(`已填入：${tr(pr.name)}`, 2000); } }, pr.name)));
  const randomBtn = h("button", { class: "sheet-btn", id: "bt-random", onclick: () => { remember(); B.randomize(p); persist(); build(); toast("已随机生成一段节奏，可撤销。", 2200); } }, "随机");
  const clearBtn = h("button", { class: "sheet-btn", id: "bt-clear", onclick: () => { if (!B.countLit(p)) return void toast("格子已为空。", 1800); remember(); B.clearAll(p); changed(); toast("已全部清空（可撤销）", 2200); } }, "全部清空");
  const fullBtn = d.fullToggle(() => root, "bt-full", () => { build(); window.setTimeout(build, 150); });

  // ---------- my rhythms (kept on this device, at most 12) ----------
  const mine = h("div", { class: "bt-mine", id: "bt-mine" });
  const nextName = () => { let n = store.slots.length + 1; while (store.slots.some((s) => s.name === tr(`节奏 ${n}`))) n++; return tr(`节奏 ${n}`); };
  const drawMine = () => {
    mine.replaceChildren(
      h("div", { class: "bt-mine-h" }, h("h3", { class: "pn-takes-h" }, "我的节奏"), h("span", { class: "muted small", id: "bt-count" }, `${store.slots.length} / ${B.MAX_SLOTS}`),
        h("button", { class: "sheet-btn", id: "bt-save", onclick: () => save() }, "保存当前节奏")),
      store.slots.length ? h("div", { class: "pn-take-list" }, ...store.slots.map((s) => h("div", { class: "pn-take bt-slot", "data-id": s.id },
        h("input", { class: "pn-take-name user", value: s.name, "aria-label": "节奏名字", maxLength: 30, onchange: (e: Event) => { s.name = (e.target as HTMLInputElement).value.trim() || s.name; persist(); } }),
        h("span", { class: "muted small" }, `${s.p.bpm} BPM · ${B.countLit(s.p)}`),
        h("button", { class: "icon", id: `bt-load-${s.id}`, title: "读取", "aria-label": "读取", onclick: () => load(s) }, "▶"),
        h("button", { class: "icon", id: `bt-del-${s.id}`, title: "删除", "aria-label": "删除", onclick: async () => { if (!(await confirmDlg("删除这个节奏？", `“${s.name}”删除后将无法恢复。`, "删除", true))) return; store.slots = store.slots.filter((x) => x.id !== s.id); persist(); drawMine(); toast("已删除"); } }, "✕"))))
        : h("p", { class: "muted small" }, "编好节奏后，点击“保存当前节奏”：节奏将保存在此处，可随时读取。"));
  };
  const save = () => {
    if (store.slots.length >= B.MAX_SLOTS) return void toast(`最多保存 ${B.MAX_SLOTS} 个节奏，请先删除一个再保存。`, 4000);
    if (!B.countLit(p)) return void toast("请先点亮部分格子，再保存。", 2500);
    const s: B.Slot = { id: `b${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, name: nextName(), date: new Date().toISOString().slice(0, 16).replace("T", " "), p: B.clone(p) };
    store.slots = [s, ...store.slots]; persist(); drawMine(); toast(`已保存：${s.name}`);
  };
  const load = (s: B.Slot) => {
    remember(); p = B.sanitize(s.p); persist(); drawControls(); build(); drawPanel();
    toast(`已读取：${s.name}`, 2000);
  };

  // ---------- export ----------
  const barsBox = h("div", { class: "bt-chips", id: "bt-bars" });
  const drawBars = () => barsBox.replaceChildren(...([2, 4, 8] as const).map((n) => chip(`bt-bars-${n}`, tr("{0} 小节").replace("{0}", String(n)), store.bars === n, () => { store.bars = n; persist(); drawBars(); })));
  const exportBtn = h("button", { class: "primary", id: "bt-export", onclick: () => {
    if (!B.countLit(p)) return void toast("请先点亮部分格子，再导出。", 2500);
    const bytes = R.buildPatternMidi(p, store.bars, "Beat");
    const file = `beat_${p.bpm}bpm_${store.bars}bars.mid`;
    R.downloadBytes(bytes, file);
    toast(`已导出：${file}`);
  } }, "导出 MIDI");

  // ---------- the page ----------
  const root: HTMLElement = h("div", { class: "page inst-page bt-page", style: `--kid:${d.color}` }, d.hero("节奏编辑器", "#/subject/music", "音乐", "#/music/beats"),
    h("main", { class: "scroll" }, h("div", { class: "narrow bt-narrow" },
      h("div", { class: "bt-ctl" }, h("div", { class: "bt-bar" }, playBtn, h("button", { class: "pn-shift", id: "bt-slower", "aria-label": "慢一点", title: "慢一点", onclick: () => setBpm(p.bpm - 5) }, "−"), h("span", { class: "bt-bpmbox" }, bpmNum, h("span", { class: "muted small" }, "BPM")), h("button", { class: "pn-shift", id: "bt-faster", "aria-label": "快一点", title: "快一点", onclick: () => setBpm(p.bpm + 5) }, "+"), tempo),
      h("div", { class: "bt-bar" }, h("span", { class: "muted small" }, "拍号"), sigBox, resBox, swingBtn, undoBtn, randomBtn, clearBtn, fullBtn)),
      presetBox, pager, wrap, panel, mine,
      h("div", { class: "bt-export" }, h("span", { class: "muted small" }, "导出长度："), barsBox, exportBtn),
      h("p", { class: "muted small center bt-help" }, "点击格子点亮，手指拖过可连续绘制；键盘：方向键移动，空格或回车点亮，P 播放。"))));
  X.show(root);
  drawControls(); drawBars(); build(); drawPanel(); drawMine();
  const onResize = () => { if (root.isConnected) build(); };
  window.addEventListener("resize", onResize);
  const onKey = (e: KeyboardEvent) => {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.tagName === "SELECT" || tg.isContentEditable)) return;
    if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggle(); }
    else if (e.key === " " && (e.shiftKey || !(tg && (tg === grid || tg.tagName === "BUTTON")))) { e.preventDefault(); toggle(); }
  };
  document.addEventListener("keydown", onKey);
  const guard = window.setInterval(() => {
    if (root.isConnected) return;
    seq.stop(); window.cancelAnimationFrame(raf); window.clearInterval(guard);
    window.removeEventListener("resize", onResize); document.removeEventListener("keydown", onKey);
  }, 300);
}
