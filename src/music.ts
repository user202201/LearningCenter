/**
 * The music subject: a game for everybody, no child and no account needed (what is saved - which quizzes were done - stays on this device only).
 * Home (`#/subject/music`) -> Music theory (`#/music/theory`: 18 chapters in the order a piano teacher teaches, each page with a drawing, a quiz at the end of
 * each chapter `#/music/quiz/<id>`) and three instruments played on the screen with several fingers at once: a piano (`#/music/piano`), a drum kit
 * (`#/music/drums`) and a guitar (`#/music/guitar`). All sounds are made in code (musicaudio.ts); the course is `src/data/music-theory.json`.
 */
import { h, toast, confirmDlg } from "./ui";
import * as A from "./musicaudio";
import { figure, type Fig } from "./musicfig";
import { subjectArt } from "./hub";
import { tr } from "./i18n";
import * as R from "./musicrec";
import type { Ctx } from "./english";

let X!: Ctx;
export const initMusic = (c: Ctx) => { X = c; };
const COLOR = "#e64980";

// ---------- what is remembered (this device only) ----------
interface Saved { quiz: Record<string, { best: number; total: number }> }
const KEY = "learn.music.v1";
const readSaved = (): Saved => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); return v && typeof v === "object" && v.quiz ? v : { quiz: {} }; } catch { return { quiz: {} }; } };
const writeSaved = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: nothing is kept */ } };

// ---------- the course ----------
interface Page { h: string; text: string[]; fig: Fig | null; tip?: string }
interface QuizQ { q: string; fig?: Fig | null; a: string; w: string[]; e?: string }
interface Chapter { id: string; title: string; emoji: string; intro: string; pages: Page[]; quiz: QuizQ[] }
let course: Chapter[] | null = null;
const loadCourse = async (): Promise<Chapter[]> => (course ??= (await import("./data/music-theory.json")).default.chapters as unknown as Chapter[]);
const shuffle = <T,>(l: readonly T[]): T[] => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- little cartoon pictures of the four parts ----------
const art = (svg: string): SVGSVGElement => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 120 120"); s.setAttribute("aria-hidden", "true"); s.innerHTML = svg; return s; };
const face = (x: number, y: number) => `<circle cx="${x - 7}" cy="${y}" r="3.2" fill="#2d2230"/><circle cx="${x + 7}" cy="${y}" r="3.2" fill="#2d2230"/><path d="M${x - 5} ${y + 7}q5 5 10 0" fill="none" stroke="#2d2230" stroke-width="2.4" stroke-linecap="round"/>`;
const ARTS: Record<string, string> = {
  theory: `<rect x="14" y="30" width="92" height="60" rx="10" fill="#fff"/><g stroke="#868e96" stroke-width="2">${[44, 54, 64, 74, 84].map((y) => `<path d="M20 ${y - 6}H100"/>`).join("")}</g><ellipse cx="46" cy="64" rx="9" ry="6.5" transform="rotate(-20 46 64)" fill="#2d2230"/><path d="M54 62V34" stroke="#2d2230" stroke-width="3"/><ellipse cx="80" cy="52" rx="9" ry="6.5" transform="rotate(-20 80 52)" fill="#e64980"/><path d="M88 50V24" stroke="#e64980" stroke-width="3"/><path d="M54 34L88 24" stroke="#2d2230" stroke-width="4"/>${face(60, 100)}`,
  piano: `<rect x="10" y="38" width="100" height="62" rx="10" fill="#fff" stroke="#495057" stroke-width="3"/>${[30, 50, 70, 90].map((x) => `<path d="M${x} 62V100" stroke="#adb5bd" stroke-width="2"/>`).join("")}${[24, 44, 76, 96].map((x) => `<rect x="${x - 6}" y="38" width="12" height="38" rx="2" fill="#2d2230"/>`).join("")}${face(60, 90)}<ellipse cx="34" cy="22" rx="6" ry="4.5" transform="rotate(-20 34 22)" fill="#e64980"/><path d="M40 21V6" stroke="#e64980" stroke-width="2.5"/>`,
  drums: `<ellipse cx="60" cy="74" rx="38" ry="12" fill="#ffa8a8" stroke="#c92a2a" stroke-width="3"/><path d="M22 74V98q0 12 38 12t38-12V74" fill="#ff8787" stroke="#c92a2a" stroke-width="3"/>${face(60, 92)}<path d="M26 14L58 58M96 12L66 56" stroke="#8d6e63" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="14" r="5" fill="#ffd43b"/><circle cx="96" cy="12" r="5" fill="#ffd43b"/>`,
  guitar: `<path d="M84 8l8 8-34 34" stroke="#8d6e63" stroke-width="9" stroke-linecap="round"/><path d="M88 6l10 10" stroke="#5f3dc4" stroke-width="10" stroke-linecap="round"/><path d="M52 46q-16-4-26 8t-2 20q-12 10-2 24t30 6q14-6 12-20q16-4 12-22q-6-14-24-16z" fill="#fcc419" stroke="#e67700" stroke-width="3"/><circle cx="52" cy="76" r="8" fill="#5c3d2e"/>${face(46, 62)}<path d="M52 76L88 28" stroke="#fff" stroke-width="1.5"/>`,
};
export const musicArtFor = (id: string): SVGSVGElement => art(ARTS[id] ?? ARTS.theory);

const hero = (title: string, back: string, backLabel: string, gearBack: string) =>
  h("header", { class: "top hero home-hero subj-hero", style: `--kid:${COLOR}` }, X.back(back, backLabel), h("span", { class: "subj-ico" }, subjectArt("music")), h("div", { class: "hero-text" }, h("h1", {}, title)), X.gear(gearBack));

// ---------- home ----------
export function renderMusic() {
  const card = (id: string, name: string, sub: string, to: string) =>
    h("button", { class: "mus-card", id: `mus-${id}`, onclick: () => { A.unlock(); location.hash = to; } }, h("span", { class: "mus-art" }, musicArtFor(id)), h("b", {}, name), h("span", { class: "muted small" }, sub));
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero("音乐", "#/", "选择学科", "#/subject/music"),
    h("main", { class: "scroll" }, h("div", { class: "narrow" },
      h("p", { class: "muted small center mus-lead" }, "不用登录，也不需要联网：学乐理，也可以自己弹一弹。"),
      h("div", { class: "mus-grid" },
        card("theory", "乐理", "18 章 · 每章有小测验", "#/music/theory"),
        card("piano", "钢琴", "可以同时按好几个键", "#/music/piano"),
        card("drums", "架子鼓", "九个鼓和镲", "#/music/drums"),
        card("guitar", "吉他", "拨弦、扫弦、和弦", "#/music/guitar"))))));
}

// ---------- theory: the list of chapters ----------
const stars = (best: number, total: number) => (total === 0 ? 0 : best / total >= 0.9 ? 3 : best / total >= 0.6 ? 2 : best > 0 ? 1 : 0);
export async function renderTheory() {
  const my = X.epoch();
  const ch = await loadCourse();
  if (my !== X.epoch()) return;
  const saved = readSaved();
  const done = ch.filter((c) => saved.quiz[c.id]).length;
  X.show(h("div", { class: "page", style: `--kid:${COLOR}` }, hero("乐理", "#/subject/music", "音乐", "#/music/theory"),
    h("main", { class: "scroll" }, h("div", { class: "narrow" },
      h("p", { class: "muted small center mus-lead", id: "th-progress" }, `已通过小测验：${done} / ${ch.length} 章`),
      h("div", { class: "th-list" }, ...ch.map((c, i) => {
        const q = saved.quiz[c.id], s = q ? stars(q.best, q.total) : 0;
        return h("button", { class: "th-ch" + (q ? " done" : ""), "data-id": c.id, onclick: () => (location.hash = `#/music/theory/${c.id}`) },
          h("span", { class: "th-emoji" }, c.emoji), h("span", { class: "th-text" }, h("b", { class: "user" }, `${i + 1}. ${c.title}`), h("span", { class: "muted small user" }, c.intro)),
          h("span", { class: "th-stars", title: "小测验成绩" }, q ? "★".repeat(s) + "☆".repeat(3 - s) : "›"));
      }))))));
}

// ---------- theory: a chapter, page by page ----------
const pageAt = new Map<string, number>();
export async function renderChapter(id: string) {
  const my = X.epoch();
  const ch = await loadCourse();
  if (my !== X.epoch()) return;
  const idx = ch.findIndex((c) => c.id === id);
  if (idx < 0) return void (location.hash = "#/music/theory");
  const c = ch[idx];
  let at = Math.min(pageAt.get(id) ?? 0, c.pages.length - 1);
  const body = h("div", { class: "th-page", id: "th-page" });
  const dots = h("div", { class: "th-dots" });
  const prev = h("button", { class: "sheet-btn", id: "th-prev", onclick: () => go(at - 1) }, "‹ 上一页");
  const next = h("button", { class: "primary", id: "th-next", onclick: () => go(at + 1) }, "下一页 ›");
  const quizBtn = h("button", { class: "primary", id: "th-quiz", onclick: () => (location.hash = `#/music/quiz/${id}`) }, "去小测验 ★");
  const draw = () => {
    const p = c.pages[at];
    body.replaceChildren(...[h("h2", { class: "th-h user" }, p.h), figure(p.fig), ...p.text.map((t) => h("p", { class: "th-p user" }, t)), p.tip ? h("p", { class: "th-tip user" }, h("b", {}, "小知识："), p.tip) : null].filter((x): x is HTMLElement => !!x));
    dots.replaceChildren(...c.pages.map((_, i) => h("i", { class: i === at ? "on" : "" })));
    prev.disabled = at === 0;
    next.style.display = at === c.pages.length - 1 ? "none" : "";
    quizBtn.style.display = at === c.pages.length - 1 ? "" : "none";
    pageAt.set(id, at);
    body.scrollTop = 0;
  };
  const go = (n: number) => { at = Math.max(0, Math.min(c.pages.length - 1, n)); draw(); document.querySelector(".scroll")?.scrollTo(0, 0); };
  draw();
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero(`${idx + 1}. ${c.title}`, "#/music/theory", "目录", `#/music/theory/${id}`),
    h("main", { class: "scroll" }, h("div", { class: "narrow th-narrow" }, dots, body, h("div", { class: "th-nav" }, prev, next, quizBtn))));
  let from: { x: number; y: number } | null = null;   // a swipe turns the page
  root.addEventListener("touchstart", (e) => { from = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  root.addEventListener("touchend", (e) => {
    if (!from) return; const t = e.changedTouches[0], dx = t.clientX - from.x, dy = t.clientY - from.y; from = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(at + (dx < 0 ? 1 : -1));
  }, { passive: true });
  X.show(root);
}

// ---------- the quiz of a chapter ----------
export async function renderQuiz(id: string) {
  const my = X.epoch();
  const ch = await loadCourse();
  if (my !== X.epoch()) return;
  const idx = ch.findIndex((c) => c.id === id);
  if (idx < 0) return void (location.hash = "#/music/theory");
  const c = ch[idx];
  const qs = shuffle(c.quiz);
  let n = 0, right = 0;
  const area = h("div", { class: "qz-area", id: "qz-area" });
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero(`小测验 · ${c.title}`, `#/music/theory/${id}`, "返回", `#/music/quiz/${id}`),
    h("main", { class: "scroll" }, h("div", { class: "narrow qz-narrow" }, area)));
  const ask = () => {
    if (n >= qs.length) return end();
    const q = qs[n];
    const explain = h("div", { class: "qz-explain user", id: "qz-explain" });
    const nextBtn = h("button", { class: "primary", id: "qz-next", style: "display:none", onclick: () => { n++; ask(); } }, n === qs.length - 1 ? "看成绩" : "下一题 ›");
    const btns = shuffle([q.a, ...q.w]).map((x) => h("button", { class: "qz-opt user", "data-right": x === q.a ? "1" : "0", onclick: (e: Event) => {
      if (btns.some((b) => b.disabled)) return;
      btns.forEach((b) => { b.disabled = true; if (b.dataset.right === "1") b.classList.add("right"); });
      const ok = x === q.a; if (ok) right++; else (e.currentTarget as HTMLElement).classList.add("wrong");
      explain.textContent = (ok ? "答对了！" : "再想想：") + (q.e ? ` ${q.e}` : "");
      explain.classList.add(ok ? "ok" : "bad");
      nextBtn.style.display = "";
    } }, x));
    area.replaceChildren(h("div", { class: "qz-count", id: "qz-count" }, `${n + 1} / ${qs.length}`), h("div", { class: "qz-q" }, figure(q.fig ?? null), h("b", { class: "user" }, q.q)), h("div", { class: "qz-opts" }, ...btns), explain, nextBtn);
  };
  const end = () => {
    const s = stars(right, qs.length), saved = readSaved(), old = saved.quiz[id];
    if (!old || right > old.best) { saved.quiz[id] = { best: right, total: qs.length }; writeSaved(saved); }
    const nextCh = ch[idx + 1];
    area.replaceChildren(h("div", { class: "qz-end", id: "qz-end" },
      h("div", { class: "qz-stars" }, "★".repeat(s) + "☆".repeat(3 - s)),
      h("h2", { id: "qz-score" }, `答对 ${right} / ${qs.length} 题`),
      h("p", { class: "muted" }, right === qs.length ? "全对！太棒了！" : right / qs.length >= 0.6 ? "不错，再看看错的地方吧。" : "没关系，回去再看一遍这一章，再来一次。"),
      h("div", { class: "qz-end-btns" },
        h("button", { class: "sheet-btn", id: "qz-again", onclick: () => X.route() }, "再来一次"),
        h("button", { class: "sheet-btn", id: "qz-review", onclick: () => { pageAt.set(id, 0); location.hash = `#/music/theory/${id}`; } }, "回去复习"),
        nextCh ? h("button", { class: "primary", id: "qz-nextch", onclick: () => (location.hash = `#/music/theory/${nextCh.id}`) }, "下一章 ›") : h("button", { class: "primary", onclick: () => (location.hash = "#/music/theory") }, "回到目录"))));
    toast(`已记录：${c.title} ${right} / ${qs.length}`);
  };
  ask();
  X.show(root);
}

// ---------- the piano ----------
const SONGS: { name: string; notes: string[] }[] = [
  { name: "小星星", notes: ["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4"] },
  { name: "欢乐颂", notes: ["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4", "C4", "C4", "D4", "E4", "E4", "D4", "D4"] },
  { name: "两只老虎", notes: ["C4", "D4", "E4", "C4", "C4", "D4", "E4", "C4", "E4", "F4", "G4", "E4", "F4", "G4"] },
];
const midiOf = (p: string): number => { const m = /^([A-G])([#b]?)(\d)$/.exec(p)!; return (+m[3] + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as "C"] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
const LETTERS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function renderPiano() {
  let startMidi = 60, whites = 8, names = true, full = false;
  const kb = h("div", { class: "pn-kb", id: "pn-kb" });
  const count = h("span", { class: "pn-count", id: "pn-count" }, "0");
  const info = h("span", { class: "muted small", id: "pn-range" });
  const active = new Map<number, { el: HTMLElement; voice: A.Voice }>();
  let song: { notes: number[]; at: number; name: string } | null = null;
  let rec: { t0: number; events: R.NoteEvent[] } | null = null;   // a recording in progress
  let playing: { timers: number[]; voices: Map<number, A.Voice[]>; id: string } | null = null;
  const songBar = h("div", { class: "pn-songbar", id: "pn-songbar" });

  const keyEls = new Map<number, HTMLElement>();
  const build = () => {
    const wpx = Math.max(280, kb.clientWidth || (X ? window.innerWidth - 24 : 360));
    // full screen: keys about 37 px wide (an iPad sideways: 32 white keys = 55 keys with the black ones); normal: about 46 px
    whites = full ? Math.max(14, Math.min(36, Math.round(wpx / 37))) : Math.max(7, Math.min(21, Math.round(wpx / 46)));
    if (startMidi + 0 < 24) startMidi = 24;
    // the first white key is always a C
    startMidi = startMidi - ((startMidi % 12) === 0 ? 0 : (startMidi % 12));
    kb.replaceChildren(); keyEls.clear();
    kb.classList.toggle("names", names);
    let wi = 0; const blacks: HTMLElement[] = [];
    for (let m = startMidi; wi < whites; m++) {
      if (A.isBlack(m)) continue;
      const el = h("div", { class: "pn-key white", "data-midi": String(m), "data-name": LETTERS[m % 12] + (m % 12 === 0 ? String(Math.floor(m / 12) - 1) : "") });
      el.style.left = `${(wi / whites) * 100}%`; el.style.width = `${100 / whites}%`;
      kb.append(el); keyEls.set(m, el);
      if (A.isBlack(m + 1) && wi < whites - 1) {
        const b = h("div", { class: "pn-key black", "data-midi": String(m + 1), "data-name": LETTERS[(m + 1) % 12] });
        b.style.left = `${((wi + 1) / whites) * 100 - 100 / whites * 0.3}%`; b.style.width = `${100 / whites * 0.6}%`;
        blacks.push(b); keyEls.set(m + 1, b);
      }
      wi++;
    }
    blacks.forEach((b) => kb.append(b));
    info.textContent = `${A.midiName(startMidi)} – ${A.midiName(startMidi + 12 * Math.floor(whites / 7) + (whites % 7 ? [0, 2, 4, 5, 7, 9, 11][whites % 7 - 1] : -1) )}`;
    markNext();
  };
  const markNext = () => {
    keyEls.forEach((e) => e.classList.remove("next"));
    if (song) keyEls.get(song.notes[song.at])?.classList.add("next");
  };
  const keyAt = (x: number, y: number): HTMLElement | null => { const e = document.elementFromPoint(x, y); return e instanceof HTMLElement ? e.closest<HTMLElement>(".pn-key") : null; };
  const press = (id: number, el: HTMLElement) => {
    const m = +el.dataset.midi!;
    active.set(id, { el, voice: A.pianoDown(m) });
    el.classList.add("down");
    if (rec) rec.events.push({ t: Math.round(performance.now() - rec.t0), m, on: 1 });
    count.textContent = String(active.size);
    if (song) {
      if (m === song.notes[song.at]) {
        song.at++;
        if (song.at >= song.notes.length) { toast(`《${tr(song.name)}》弹完了，太棒了！`); song = null; songBar.classList.remove("on"); }
        markNext();
      } else { el.classList.add("miss"); window.setTimeout(() => el.classList.remove("miss"), 220); }
    }
  };
  const lift = (id: number) => {
    const a = active.get(id); if (!a) return;
    a.voice.release(); a.el.classList.remove("down"); active.delete(id);
    if (rec) rec.events.push({ t: Math.round(performance.now() - rec.t0), m: +a.el.dataset.midi!, on: 0 });
    count.textContent = String(active.size);
  };
  kb.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); const el = keyAt(e.clientX, e.clientY); if (el) press(e.pointerId, el); try { kb.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ } });
  kb.addEventListener("pointermove", (e) => {
    const a = active.get(e.pointerId); if (!a) return;
    const el = keyAt(e.clientX, e.clientY);
    if (el && el !== a.el) { lift(e.pointerId); press(e.pointerId, el); }   // sliding over the keys plays them one after the other
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) kb.addEventListener(t, (e) => lift((e as PointerEvent).pointerId));
  kb.addEventListener("contextmenu", (e) => e.preventDefault());

  const shift = (d: number) => { startMidi = Math.max(24, Math.min(84, startMidi + d * 12)); build(); };
  const startSong = (s: (typeof SONGS)[number]) => {
    song = { notes: s.notes.map(midiOf), at: 0, name: s.name };
    const lo = Math.min(...song.notes), hi = Math.max(...song.notes);
    const span = whites > 7 ? 12 * Math.floor(whites / 7) : 12;
    if (lo < startMidi || hi > startMidi + span) { startMidi = lo - (lo % 12); build(); }
    songBar.classList.add("on"); songBar.querySelector<HTMLElement>("#pn-song-name")!.textContent = `跟着弹：《${tr(s.name)}》（亮着的键就是下一个）`;
    markNext();
  };
  songBar.append(h("span", { id: "pn-song-name", class: "small" }), h("button", { class: "sheet-btn", id: "pn-song-stop", onclick: () => { song = null; songBar.classList.remove("on"); markNext(); } }, "不练了"));
  const setFull = (on: boolean) => {
    full = on;
    root.classList.toggle("pn-full", on);
    fullBtn.textContent = on ? "✕ 退出全屏" : "⛶ 全屏";
    if (on) {
      startMidi = 36;   // a wide keyboard starts at C2 (C2 to G6 = 55 keys on an iPad sideways); middle C stays in view
      try { void (root.requestFullscreen?.() ?? Promise.resolve()).catch(() => { /* the page-wide mode is enough (an iPhone has no element full screen) */ }); } catch { /* same */ }
    } else {
      startMidi = 60;
      try { if (document.fullscreenElement) void document.exitFullscreen(); } catch { /* same */ }
    }
    window.requestAnimationFrame(() => { build(); window.setTimeout(build, 120); });
  };
  const fullBtn = h("button", { class: "pn-fullbtn", id: "pn-full", onclick: () => setFull(!full) }, "⛶ 全屏");
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && full && root.isConnected) setFull(false); });
  const names_btn = h("button", { class: "mopt on", id: "pn-names", onclick: (e: Event) => { names = !names; (e.currentTarget as HTMLElement).classList.toggle("on", names); kb.classList.toggle("names", names); } }, "音名");

  // ----- recording: a demo of what was played, kept on this device, can be played back and exported as a MIDI file -----
  const takesBox = h("div", { class: "pn-takes", id: "pn-takes" });
  let takes = R.loadTakes();
  let timer = 0;
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const recBtn = h("button", { class: "rec-btn", id: "pn-rec", onclick: () => toggleRec() }, "● 录音");
  const stopPlay = () => {
    if (!playing) return;
    playing.timers.forEach((t) => window.clearTimeout(t));
    playing.voices.forEach((vs) => vs.forEach((v) => v.release()));
    keyEls.forEach((e) => e.classList.remove("play"));
    playing = null; drawTakes();
  };
  const toggleRec = () => {
    A.unlock();
    if (rec) {
      const r = rec; rec = null; window.clearInterval(timer); recBtn.classList.remove("on"); recBtn.textContent = "● 录音";
      active.forEach((a, id) => { r.events.push({ t: Math.round(performance.now() - r.t0), m: +a.el.dataset.midi!, on: 0 }); void id; });
      const notes = r.events.filter((e) => e.on).length;
      if (!notes) return void toast("没有录到音：先按下录音，再弹琴。");
      const ms = r.events[r.events.length - 1].t;
      takes = [{ id: `t${Date.now()}`, name: R.nextName(takes), date: new Date().toISOString().slice(0, 16).replace("T", " "), ms, events: r.events }, ...takes].slice(0, R.MAX_TAKES);
      if (!R.saveTakes(takes)) toast("这台设备不能保存录音（可能是无痕模式）。", 5000);
      else toast(`已保存录音：${takes[0].name}（${notes} 个音）`);
      drawTakes();
    } else {
      stopPlay();
      if (song) { song = null; songBar.classList.remove("on"); markNext(); }
      rec = { t0: performance.now(), events: [] };
      recBtn.classList.add("on");
      const tick = () => { recBtn.textContent = `■ 停止  ${fmt(performance.now() - rec!.t0)}`; };
      tick(); timer = window.setInterval(tick, 250);
    }
  };
  const playTake = (t: R.Take) => {
    A.unlock();
    const wasThis = playing?.id === t.id; stopPlay(); if (wasThis) return;
    const st = { timers: [] as number[], voices: new Map<number, A.Voice[]>(), id: t.id };
    playing = st;
    t.events.forEach((e) => st.timers.push(window.setTimeout(() => {
      if (playing !== st) return;
      const vs = st.voices.get(e.m) ?? [];
      if (e.on) { vs.push(A.pianoDown(e.m)); st.voices.set(e.m, vs); keyEls.get(e.m)?.classList.add("play"); }
      else { vs.shift()?.release(); if (!vs.length) keyEls.get(e.m)?.classList.remove("play"); }
    }, e.t)));
    st.timers.push(window.setTimeout(() => { if (playing === st) { playing = null; keyEls.forEach((k) => k.classList.remove("play")); drawTakes(); } }, t.ms + 400));
    drawTakes();
  };
  const drawTakes = () => {
    if (!takesBox.isConnected && takesBox.dataset.ready) return;
    takesBox.dataset.ready = "1";
    takesBox.replaceChildren(
      h("h3", { class: "pn-takes-h" }, "我的录音"),
      takes.length ? h("div", { class: "pn-take-list" }, ...takes.map((t) => h("div", { class: "pn-take", "data-id": t.id },
        h("input", { class: "pn-take-name user", value: t.name, "aria-label": "录音名字", maxlength: "30", onchange: (e: Event) => { t.name = (e.target as HTMLInputElement).value.trim() || t.name; R.saveTakes(takes); } }),
        h("span", { class: "muted small" }, `${fmt(t.ms)} · ${t.events.filter((e) => e.on).length} 个音`),
        h("button", { class: "icon", id: `take-play-${t.id}`, title: playing?.id === t.id ? "停止" : "播放", "aria-label": playing?.id === t.id ? "停止" : "播放", onclick: () => playTake(t) }, playing?.id === t.id ? "■" : "▶"),
        h("button", { class: "icon", id: `take-midi-${t.id}`, title: "导出 MIDI 文件", "aria-label": "导出 MIDI 文件", onclick: () => { R.downloadMidi(t); toast(`已导出：${t.name}.mid`); } }, "⇩"),
        h("button", { class: "icon", id: `take-del-${t.id}`, title: "删除", "aria-label": "删除", onclick: async () => { if (!(await confirmDlg("删除这段录音？", `“${t.name}”删除后找不到了。`, "删除", true))) return; if (playing?.id === t.id) stopPlay(); takes = takes.filter((x) => x.id !== t.id); R.saveTakes(takes); drawTakes(); toast("已删除"); } }, "✕"))))
        : h("p", { class: "muted small" }, "按“● 录音”，弹一段，再按“■ 停止”：录音会保存在这里，可以回放，也可以导出成 MIDI 文件，拿去做自己的曲子。"));
  };
  const rotate = h("div", { class: "pn-rotate", id: "pn-rotate" }, h("span", {}, "横过来弹钢琴，键更多、更好按 ↻"), h("button", { class: "sheet-btn", onclick: () => rotate.remove() }, "还是竖着弹"));
  const root = h("div", { class: "page pn-page", style: `--kid:${COLOR}` }, hero("钢琴", "#/subject/music", "音乐", "#/music/piano"),
    h("main", { class: "scroll pn-main" }, h("div", { class: "narrow pn-narrow" }, rotate,
      h("div", { class: "pn-bar" },
        h("button", { class: "pn-shift", id: "pn-down", "aria-label": "低一个八度", title: "低一个八度", onclick: () => shift(-1) }, "‹ 低"), info,
        h("button", { class: "pn-shift", id: "pn-up", "aria-label": "高一个八度", title: "高一个八度", onclick: () => shift(1) }, "高 ›"),
        recBtn, names_btn, fullBtn, h("span", { class: "pn-fingers muted small" }, "同时按着：", count)),
      kb, songBar,
      h("div", { class: "pn-songs" }, h("span", { class: "muted small" }, "跟着弹："), ...SONGS.map((s, i) => h("button", { class: "mopt", id: `pn-song-${i}`, onclick: () => startSong(s) }, s.name))),
      takesBox,
      h("p", { class: "muted small center" }, "用好几个手指一起按，就是和弦；手指在琴键上滑过去，就是滑音。"))));
  X.show(root);
  drawTakes();
  build();
  const onResize = () => { if (!root.isConnected) { window.removeEventListener("resize", onResize); window.clearInterval(timer); stopPlay(); return; } build(); };
  window.addEventListener("resize", onResize);
}

// ---------- the drum kit ----------
const PADS: { id: A.Drum | "hihat"; name: string; x: number; y: number; s: number; c: string }[] = [
  { id: "crash", name: "吊镲", x: 4, y: 6, s: 24, c: "#ffd43b" },
  { id: "hihat", name: "踩镲", x: 3, y: 38, s: 22, c: "#fcc419" },
  { id: "tom1", name: "嗵鼓1", x: 31, y: 16, s: 19, c: "#ff8787" },
  { id: "tom2", name: "嗵鼓2", x: 52, y: 16, s: 19, c: "#ff6b6b" },
  { id: "ride", name: "叮叮镲", x: 73, y: 6, s: 23, c: "#ffe066" },
  { id: "snare", name: "军鼓", x: 20, y: 50, s: 24, c: "#f8f9fa" },
  { id: "floor", name: "落地鼓", x: 74, y: 44, s: 23, c: "#ff8787" },
  { id: "kick", name: "大鼓", x: 38, y: 62, s: 28, c: "#e03131" },
];
export function renderDrums() {
  let open = false, demo: number | null = null;
  const stage = h("div", { class: "dr-stage", id: "dr-stage" });
  const pads = new Map<string, HTMLElement>();
  const flash = (id: string) => { const el = pads.get(id); if (!el) return; el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); };
  const hit = (id: string) => { const d = id === "hihat" ? (open ? "hihat-open" : "hihat") : (id as A.Drum); A.drumHit(d); flash(id); };
  PADS.forEach((p) => {
    const el = h("div", { class: `dr-pad dr-${p.id}`, "data-d": p.id }, h("span", {}, p.name));
    el.style.cssText = `left:${p.x}%;top:${p.y}%;width:${p.s}%;--c:${p.c}`;
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); hit(p.id); });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    pads.set(p.id, el); stage.append(el);
  });
  const hat = h("button", { class: "mopt", id: "dr-hat", onclick: (e: Event) => { open = !open; (e.currentTarget as HTMLElement).classList.toggle("on", open); (e.currentTarget as HTMLElement).textContent = open ? "踩镲：开着（长音）" : "踩镲：闭着（短音）"; } }, "踩镲：闭着（短音）");
  const stopDemo = () => { if (demo !== null) { window.clearInterval(demo); demo = null; } demoBtn.textContent = "听一段示范"; demoBtn.classList.remove("on"); };
  const PATTERN: string[][] = [["kick", "hihat"], ["hihat"], ["snare", "hihat"], ["hihat"], ["kick", "hihat"], ["kick", "hihat"], ["snare", "hihat"], ["hihat"]];
  const demoBtn = h("button", { class: "sheet-btn", id: "dr-demo", onclick: () => {
    A.unlock();
    if (demo !== null) return stopDemo();
    let step = 0; demoBtn.textContent = "停止示范"; demoBtn.classList.add("on");
    const tick = () => { PATTERN[step % 8].forEach((d) => { A.drumHit(d as A.Drum); flash(d); }); step++; if (step >= 32) stopDemo(); };
    tick(); demo = window.setInterval(tick, 300);
  } }, "听一段示范");
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero("架子鼓", "#/subject/music", "音乐", "#/music/drums"),
    h("main", { class: "scroll" }, h("div", { class: "narrow dr-narrow" }, stage,
      h("div", { class: "dr-bar" }, hat, demoBtn),
      h("p", { class: "muted small center" }, "两只手、甚至更多手指可以同时打。大鼓在最下面，军鼓在左边。"))));
  X.show(root);
  const watch = new MutationObserver(() => { if (!root.isConnected) { stopDemo(); watch.disconnect(); } });
  watch.observe(document.body, { childList: true, subtree: true });
}

// ---------- the guitar ----------
const CHORDS: { name: string; frets: (number | -1)[] }[] = [   // the thick string first (E A D G B e), -1 = not played
  { name: "C", frets: [-1, 3, 2, 0, 1, 0] }, { name: "G", frets: [3, 2, 0, 0, 0, 3] }, { name: "Am", frets: [-1, 0, 2, 2, 1, 0] }, { name: "Em", frets: [0, 2, 2, 0, 0, 0] },
  { name: "D", frets: [-1, -1, 0, 2, 3, 2] }, { name: "Dm", frets: [-1, -1, 0, 2, 3, 1] }, { name: "E", frets: [0, 2, 2, 1, 0, 0] }, { name: "A", frets: [-1, 0, 2, 2, 2, 0] },
];
const FRETS = 6;   // the open string + 5 frets
const STR_NAMES = ["e", "B", "G", "D", "A", "E"];
export function renderGuitar() {
  let chord: (typeof CHORDS)[number] | null = null;
  const neck = h("div", { class: "gt-neck", id: "gt-neck" });
  const cells: HTMLElement[][] = [];
  for (let s = 0; s < 6; s++) {
    const row = h("div", { class: "gt-row", "data-s": String(s) }, h("span", { class: "gt-name" }, STR_NAMES[s]));
    cells[s] = [];
    for (let f = 0; f < FRETS; f++) {
      const c = h("div", { class: "gt-cell" + (f === 0 ? " open" : ""), "data-s": String(s), "data-f": String(f) }, h("i", { class: "gt-string" }), h("i", { class: "gt-dot" }));
      row.append(c); cells[s].push(c);
    }
    neck.append(row);
  }
  const marks = h("div", { class: "gt-marks" }, h("span", {}, ""), ...Array.from({ length: FRETS }, (_, f) => h("span", {}, f === 0 ? "空弦" : String(f))));
  const play = (c: HTMLElement) => {
    const s = +c.dataset.s!, f = +c.dataset.f!;
    A.pluck(A.guitarMidi(s, f)); c.classList.add("hit"); window.setTimeout(() => c.classList.remove("hit"), 260);
  };
  const last = new Map<number, number>();   // pointer id -> the string it is on
  const cellAt = (x: number, y: number): HTMLElement | null => { const e = document.elementFromPoint(x, y); return e instanceof HTMLElement ? e.closest<HTMLElement>(".gt-cell") : null; };
  neck.addEventListener("pointerdown", (e) => { e.preventDefault(); A.unlock(); const c = cellAt(e.clientX, e.clientY); if (c) { last.set(e.pointerId, +c.dataset.s!); play(c); } try { neck.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
  neck.addEventListener("pointermove", (e) => {
    if (!last.has(e.pointerId)) return;
    const c = cellAt(e.clientX, e.clientY);
    if (c && +c.dataset.s! !== last.get(e.pointerId)) { last.set(e.pointerId, +c.dataset.s!); play(c); }   // sliding across the strings strums them
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) neck.addEventListener(t, (e) => last.delete((e as PointerEvent).pointerId));
  neck.addEventListener("contextmenu", (e) => e.preventDefault());
  const strum = (down: boolean) => {
    A.unlock();
    const order = [0, 1, 2, 3, 4, 5].reverse();   // string index 5 = the thick E
    (down ? order : order.slice().reverse()).forEach((s, i) => {
      const f = chord ? chord.frets[5 - s] : 0;
      if (f < 0) return;
      window.setTimeout(() => { A.pluck(A.guitarMidi(s, f), 0.85); const c = cells[s][f]; c.classList.add("hit"); window.setTimeout(() => c.classList.remove("hit"), 260); }, i * 38);
    });
  };
  const showChord = (c: (typeof CHORDS)[number] | null) => {
    chord = c;
    cells.flat().forEach((e) => e.classList.remove("on"));
    c?.frets.forEach((f, k) => { if (f >= 0) cells[5 - k][f].classList.add("on"); });
    chordBtns.forEach((b) => b.classList.toggle("on", b.dataset.c === c?.name));
    info.textContent = c ? `${c.name} 和弦：${c.frets.map((f) => (f < 0 ? "×" : f)).join(" ")}（从粗弦到细弦）` : "选一个和弦，再点“向下扫”";
  };
  const info = h("p", { class: "muted small center", id: "gt-info" });
  const chordBtns = CHORDS.map((c) => h("button", { class: "mopt", id: `gt-chord-${c.name}`, "data-c": c.name, onclick: () => { showChord(c); strum(true); } }, c.name));
  const root = h("div", { class: "page", style: `--kid:${COLOR}` }, hero("吉他", "#/subject/music", "音乐", "#/music/guitar"),
    h("main", { class: "scroll" }, h("div", { class: "narrow gt-narrow" }, neck, marks,
      h("div", { class: "gt-chords" }, ...chordBtns),
      h("div", { class: "gt-strum" }, h("button", { class: "primary", id: "gt-down", onclick: () => strum(true) }, "↓ 向下扫"), h("button", { class: "sheet-btn", id: "gt-up", onclick: () => strum(false) }, "↑ 向上扫"), h("button", { class: "sheet-btn", id: "gt-clear", onclick: () => showChord(null) }, "清除")),
      info, h("p", { class: "muted small center" }, "手指在弦上滑过去就是扫弦；点格子是按在那个品上拨一根弦。"))));
  showChord(null);
  X.show(root);
}
