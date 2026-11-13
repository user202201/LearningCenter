/**
 * PK: a face-to-face duel for two children on ONE device. This file is the SHELL, shared by every subject: the entry card, the setup page "对战大厅" (two player
 * cards, a PK mark, modes, the record of earlier games), the opening (a fighting-game VS screen, then 3-2-1-GO), the play stage, the results and the finals, the
 * record and the sounds. What belongs to a subject (the items, the checks of the data, how a prompt is shown, the number of rounds) is a `PkAdapter`
 * (`pkadapter.ts`; `pk-chinese.ts` = 识字, `pk-english.ts` = the Languages subject). The rules are in `pklogic.ts` (pure), the pictures / particles / sounds in
 * `pkfx.ts`. The screen is always split into a TOP half (turned by 180 degrees) and a BOTTOM half, whatever the orientation of the device; each half faces
 * its player. Everything stays on this device (`learn.pk.v1`: the record is kept per subject and track, never mixed).
 */
import { h, toast, modal, confirmDlg } from "./ui";
import * as M from "./model";
import { sfx, setMuted } from "./games/sfx";
import type { Ctx } from "./english";
import * as L from "./pklogic";
import type { PkAdapter } from "./pkadapter";
import { chineseAdapter } from "./pk-chinese";
import { englishAdapter } from "./pk-english";
import { TROPHY, CROWN, CLOUD, FACES, PK_MARK, BOLT, startFx, countUp, fanfare, trombone, jingle, openingSound, countTick, goHit } from "./pkfx";

let X!: Ctx;
export const initPk = (c: Ctx) => { X = c; };

/** the subjects that have a duel: a third one = one more adapter here (see pkadapter.ts) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: Record<string, PkAdapter<any>> = { chinese: chineseAdapter, english: englishAdapter };
const adapterOf = (id: string) => ADAPTERS[id] ?? chineseAdapter;

// ---------- what is remembered on this device ----------
interface Pair { a: string; b: string; wins: Record<string, number>; ties: number }
interface Store { mute: boolean; last: Record<string, [string, string]>; mode: Record<string, string>; rec: Record<string, Record<string, Pair>> }
const KEY = "learn.pk.v1";
const cleanPairs = (o: unknown): Record<string, Pair> => {
  const pairs: Record<string, Pair> = {};
  for (const [k, v] of Object.entries((o ?? {}) as Record<string, Partial<Pair>>)) if (v && typeof v.a === "string" && typeof v.b === "string") pairs[k] = { a: v.a, b: v.b, wins: { ...(v.wins ?? {}) }, ties: Number(v.ties) || 0 };
  return pairs;
};
const isPair2 = (x: unknown): x is [string, string] => Array.isArray(x) && x.length === 2 && x.every((y) => typeof y === "string");
function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const last: Store["last"] = {}, rec: Store["rec"] = {}, mode: Store["mode"] = {};
    if (isPair2(s.last)) last.chinese = [s.last[0], s.last[1]];                         // (the first version kept one pick and one record: they were the Chinese ones)
    else for (const [k, v] of Object.entries((s.last ?? {}) as Record<string, unknown>)) if (isPair2(v)) last[k] = [v[0], v[1]];
    if (s.pairs) rec.chinese = cleanPairs(s.pairs);
    for (const [k, v] of Object.entries((s.rec ?? {}) as Record<string, unknown>)) rec[k] = cleanPairs(v);
    for (const [k, v] of Object.entries((s.mode ?? {}) as Record<string, unknown>)) if (typeof v === "string") mode[k] = v;
    return { mute: !!s.mute, last, mode, rec };
  } catch { return { mute: false, last: {}, mode: {}, rec: {} }; }
}
let store = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private mode */ } };
const pairKey = (x: string, y: string) => [x, y].sort().join("|");
const pairsOf = (A: PkAdapter) => (store.rec[A.recordKey()] ??= {});
/** adds a finished game to the record of the pair (`winner` = a kid id, or null for a draw) */
function record(A: PkAdapter, x: string, y: string, winner: string | null) {
  const k = pairKey(x, y);
  const p = (pairsOf(A)[k] ??= { a: x, b: y, wins: {}, ties: 0 });
  if (winner) p.wins[winner] = (p.wins[winner] ?? 0) + 1; else p.ties++;
  save();
}
const winsOf = (A: PkAdapter, kid: string, opp: string) => pairsOf(A)[pairKey(kid, opp)]?.wins[kid] ?? 0;

/** full screen where the device allows it, and the portrait orientation (iOS Safari allows neither: the page-wide stage is enough) */
const fsOn = () => {
  try {
    void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("portrait")).catch(() => { /* not allowed here */ });
  } catch { /* same */ }
};
const fsOff = () => {
  try { (screen.orientation as { unlock?: () => void })?.unlock?.(); } catch { /* same */ }
  try { if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* same */ }); } catch { /* same */ }
};

// ---------- the card on the home screen of a subject ----------
export function homeSection(id = "chinese"): HTMLElement {
  const A = adapterOf(id);
  const ico = h("span", { class: "pk-ico" });
  ico.innerHTML = A.cardArt;
  return h("div", { class: "pk-refs", id: id === "chinese" ? "pk-refs" : `pk-refs-${id}`, style: `--pkc:${A.color}` },
    h("button", { class: "pk-ref", id: A.cardId, onclick: () => (location.hash = A.setupRoute) }, ico, h("span", { class: "pk-reft" }, h("b", {}, A.title()), h("span", { class: "muted small" }, A.sub()))));
}

// ---------- the setup page: the battle lobby ----------
/** the "VS" badge: bold, slanted Latin letters with an outline and a small shadow, drawn as SVG */
const VS_SVG = `<svg viewBox="0 0 64 44" aria-hidden="true"><g transform="skewX(-10)" font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif" font-weight="900" font-style="italic" font-size="34" text-anchor="middle"><text x="34" y="34" fill="#ffd43b" stroke="#e03131" stroke-width="5.500" stroke-linejoin="round" paint-order="stroke">VS</text></g></svg>`;
const vsBadge = (cls = "") => { const b = h("span", { class: "pk-vsb " + cls, "aria-hidden": "true" }); b.innerHTML = VS_SVG; return b; };
const pkMark = (cls = "") => { const b = h("span", { class: "pk-pkm " + cls, "aria-hidden": "true" }); b.innerHTML = PK_MARK; return b; };
const bolt = () => { const b = h("span", { class: "pk-bolt", "aria-hidden": "true" }); b.innerHTML = BOLT; return b; };

export async function renderSetup(id = "chinese") {
  store = load();
  const A = adapterOf(id);
  const my = X.epoch();
  X.showLoading();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    await X.loadShared();
    data = await A.load(X.kids().kids);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderSetup(id)) : undefined;
  }
  if (my !== X.epoch()) return;
  const kids = X.kids().kids;
  const kidOf = (kid: string | null) => kids.find((k) => k.id === kid) ?? null;
  const last = store.last[A.id];
  const sel: [string | null, string | null] = last && kidOf(last[0]) && kidOf(last[1]) && last[0] !== last[1] ? [last[0], last[1]] : [null, null];
  const mode = () => (A.modes?.some((m) => m.id === store.mode[A.id]) ? store.mode[A.id] : A.modes?.[0]?.id ?? "");
  const body = h("div", { class: "narrow pk-setup", "data-subject": A.id });
  const hero = h("header", { class: "top hero home-hero subj-hero", style: `--kid:${A.color}` },
    X.back(A.backRoute, "返回"), A.heroIcon(),
    h("div", { class: "hero-text" }, h("h1", {}, A.title()), h("p", {}, A.sub())), X.gear(A.setupRoute));

  const pick = (slot: 0 | 1) => modal<string>((close) => {
    const other = sel[1 - slot];
    return h("div", { class: "dlg pk-pick", id: "pk-pick" }, h("h2", {}, "选择选手"),
      h("div", { class: "pk-pick-list" }, ...kids.map((k) => h("button", { class: "pk-pick-kid", style: `--kid:${k.color}`, "data-kid": k.id, disabled: other === k.id, onclick: () => close(k.id) },
        X.avatarEl(k), h("span", { class: "kname user" }, k.name), other === k.id ? h("span", { class: "muted small" }, "已被选择") : null))),
      h("div", { class: "row end" }, h("button", { onclick: () => close(null) }, "取消")));
  });

  /** one row of the record: [A] VS [B], then the score as a scoreboard (A's wins on A's side) */
  const matchRow = (p: Pair) => {
    const a = kidOf(p.a)!, b = kidOf(p.b)!, wa = p.wins[p.a] ?? 0, wb = p.wins[p.b] ?? 0;
    const tile = (n: number, lead: boolean) => h("span", { class: "pk-tile" + (lead ? " lead" : "") }, String(n));
    const side = (k: M.Kid) => h("span", { class: "pk-pl", style: `--kid:${k.color}` }, X.avatarEl(k), h("span", { class: "pk-pn user" }, k.name));
    return h("div", { class: "pk-match", "data-pair": pairKey(p.a, p.b), role: "group", "aria-label": `${a.name} 对 ${b.name}，${wa} 比 ${wb}` },
      h("div", { class: "pk-mrow" }, side(a), " ", vsBadge("small"), " ", side(b)), " ",
      h("div", { class: "pk-score-row" }, tile(wa, wa > wb), ":", tile(wb, wb > wa), p.ties ? " " : null, p.ties ? h("span", { class: "pk-draws" }, `平 ${p.ties}`) : null));
  };

  const draw = () => {
    body.replaceChildren();
    if (kids.length < 2) {
      body.append(h("p", { class: "pk-msg", id: "pk-few" }, "至少需要两个孩子才能对战。请先在设置中添加孩子。"));
      return;
    }
    body.append(h("div", { class: "pk-lobby", id: "pk-lobby" }, bolt(), h("b", {}, "对战大厅"), bolt()));
    const slot = (i: 0 | 1) => {
      const k = kidOf(sel[i]);
      return h("button", { class: "pk-slot" + (k ? " set" : ""), id: `pk-slot-${i + 1}`, style: `--kid:${k?.color ?? "#adb5bd"}`, "data-kid": k?.id,
        onclick: async () => { const kid = await pick(i); if (kid) { sel[i] = kid; draw(); } } },
        h("span", { class: "pk-slot-cap" }, `选手 ${i + 1}`),
        k ? X.avatarEl(k) : h("span", { class: "avatar pk-empty" }, "?"),
        k ? h("span", { class: "kname user pk-slot-name" }, k.name) : h("span", { class: "muted" }, "点击选择"));
    };
    body.append(h("div", { class: "pk-slots" }, slot(0), pkMark("big"), slot(1)));
    if (A.modes) {
      body.append(h("div", { class: "pk-modes", id: "pk-modes", role: "group" }, ...A.modes.map((m) =>
        h("button", { class: "pk-mode" + (mode() === m.id ? " on" : ""), "data-mode": m.id, "aria-pressed": String(mode() === m.id), onclick: () => { store.mode[A.id] = m.id; save(); draw(); } }, m.label))));
    }

    const msgs = h("div", { class: "pk-msgs", id: "pk-msgs" });
    let ok = !!(sel[0] && sel[1]);
    if (!ok) msgs.append(h("p", { class: "pk-msg" }, "请先选择两位选手。"));
    else { const c = A.check(data, kidOf(sel[0])!, kidOf(sel[1])!, mode()); ok = c.ok; msgs.append(...c.msgs); }
    body.append(msgs);
    const info = A.info?.(data, kidOf(sel[0]), kidOf(sel[1]), mode()) ?? [];
    if (info.length) body.append(h("div", { class: "pk-msgs", id: "pk-info" }, ...info));
    body.append(h("p", { class: "pk-hint-land muted small", id: "pk-hint-land" }, "竖放设备可获得更大的答题区。"));
    body.append(h("button", { class: "primary pk-start", id: "pk-start", disabled: !ok, onclick: () => {
      store.last[A.id] = [sel[0]!, sel[1]!]; save(); fsOn(); location.hash = A.playRoute;
    } }, h("span", { class: "pk-start-t" }, "开始")));

    // the record: the pair of the current choice first, then the others (at most 5), pairs that never played are left out
    const cur = sel[0] && sel[1] ? pairKey(sel[0], sel[1]) : "";
    const pairs = Object.entries(pairsOf(A)).filter(([, p]) => kidOf(p.a) && kidOf(p.b) && ((p.wins[p.a] ?? 0) + (p.wins[p.b] ?? 0) + p.ties) > 0)
      .sort(([x], [y]) => (x === cur ? -1 : 0) - (y === cur ? -1 : 0)).slice(0, 5).map(([, p]) => p);
    const hist = h("div", { class: "pk-hist", id: "pk-hist" });
    if (pairs.length) {
      hist.append(h("h3", {}, "对战记录"), ...pairs.map(matchRow),
        h("p", { class: "muted small" }, "记录只保存在这台设备上。"),
        h("button", { class: "danger pk-reset", id: "pk-reset", onclick: async () => {
          if (!(await confirmDlg("清除对战记录？", "清除后无法恢复。", "清除", true))) return;
          store.rec[A.recordKey()] = {}; save(); toast("已清除记录"); draw();
        } }, "清除记录"));
    }
    body.append(hist);
  };
  draw();
  X.show(h("div", { class: "page", style: `--kid:${A.color}` }, hero, h("main", { class: "scroll" }, body)));
}

// ---------- the game ----------
const SPK = (off: boolean) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>${off ? '<path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.500" stroke-linecap="round"/>' : '<path d="M16 8q4 4 0 8M19 5q7 7 0 14" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/>'}</svg>`;
const SPK_BIG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 24h12l16-14v44L20 40H8z" fill="currentColor"/><path d="M44 22q10 10 0 20M50 14q18 18 0 36" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;
const MID = 44;
const KEYS: [string[], string[]] = [["1", "2", "3", "4"], ["7", "8", "9", "0"]];
/** says a word with the device's voice (one utterance at a time; nothing where there is no voice) */
function say(text: string, lang: string) {
  try {
    const sp = window.speechSynthesis;
    if (!sp) return;
    sp.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.85;
    sp.speak(u);
  } catch { /* no voice */ }
}

interface PkHook {
  seed: number;
  state(): ReturnType<typeof L.snapshot> & { items: [L.Item, L.Item]; seed: number };
  tap(side: 0 | 1, index: number): L.TapEvent;
  step(ms: number): void;
  skip(ms: number): void;
  manual(on: boolean): void;
  T(): number;
}
declare global { interface Window { __pk?: PkHook; __pkSeed?: number } }

export async function renderPlay(id = "chinese") {
  store = load();
  const A = adapterOf(id);
  const my = X.epoch();
  X.showLoading();
  const toSetup = () => { location.hash = A.setupRoute; };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  let kids: [M.Kid, M.Kid];
  try {
    await X.loadShared();
    const all = X.kids().kids;
    const l = store.last[A.id];
    const k0 = all.find((k) => k.id === l?.[0]), k1 = all.find((k) => k.id === l?.[1]);
    if (!k0 || !k1 || k0.id === k1.id) return my === X.epoch() ? toSetup() : undefined;
    kids = [k0, k1];
    data = await A.load(kids);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderPlay(id)) : undefined;
  }
  if (my !== X.epoch()) return;
  const mode = A.modes?.some((m) => m.id === store.mode[A.id]) ? store.mode[A.id] : A.modes?.[0]?.id ?? "";
  const seed = Number.isFinite(window.__pkSeed) ? (window.__pkSeed as number) : (Date.now() % 2147483000);
  const first = A.make(data, kids[0], kids[1], seed, mode);
  if (!first) return toSetup();
  mountGame(A, kids, (sd) => A.make(data, kids[0], kids[1], sd, mode), seed, first);
}

function mountGame(A: PkAdapter, kids: [M.Kid, M.Kid], makeItems: (seed: number) => [L.Item[], L.Item[]] | null, seed0: number, firstItems: [L.Item[], L.Item[]]) {
  let seed = seed0;
  const cfg = { rounds: A.rounds };
  const speechOn = A.present === "speech" && !!A.speech?.available();
  const lang = A.speech?.lang() ?? "en-US";
  // ----- the clock: real time, or a clock a test moves by hand -----
  const t0 = performance.now();
  let offset = 0, manual = false, mT = 0, pausedAt: number | null = null;
  const rawT = () => performance.now() - t0 + offset;
  const T = () => (manual ? mT : pausedAt !== null ? pausedAt : rawT());
  const pause = () => { if (pausedAt === null && !manual) pausedAt = rawT(); };
  const resume = () => { if (pausedAt !== null) { offset -= rawT() - pausedAt; pausedAt = null; } };
  const eventAt = (e: Event) => {
    if (manual || pausedAt !== null) return T();
    const at = e.timeStamp - t0 + offset, now = T();
    return Number.isFinite(at) && at > s.now - 2000 ? Math.min(at, now) : now;
  };

  let s = L.create(firstItems, T(), cfg);
  let recorded = false;
  const lastTap: [number, number] = [0, 0];
  setMuted(store.mute);

  // ----- the screen -----
  const stage = h("div", { class: "pk-stage", id: "pk-stage", "data-subject": A.id });
  interface Panel { side: 0 | 1; el: HTMLElement; round: HTMLElement; score: HTMLElement; streak: HTMLElement; ch: HTMLElement; spk: HTMLElement; replay: HTMLButtonElement; opts: HTMLButtonElement[]; labels: HTMLElement[]; over: HTMLElement; bar: HTMLElement; stops: (() => void)[]; finalBuilt: boolean; lastScore: string; lastStreak: number; againBtn: HTMLButtonElement | null }
  const mkPanel = (side: 0 | 1): Panel => {
    const k = kids[side];
    const round = h("span", { class: "pk-round" }), score = h("span", { class: "pk-score" });
    const streak = h("span", { class: "pk-streak" });
    const ch = h("span", { class: "ch user pk-ch" + (A.present === "char" ? "" : " latin") });
    const spk = h("span", { class: "pk-spkbig", "aria-hidden": "true" }); spk.innerHTML = SPK_BIG;
    const replay = h("button", { class: "pk-replay", type: "button", title: "再听一次", "aria-label": "再听一次" });
    replay.innerHTML = SPK(false);
    replay.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); say(L.current(s, 0).prompt, lang); });
    replay.addEventListener("click", (e) => { if (e.detail === 0) say(L.current(s, 0).prompt, lang); });
    const labels = [0, 1, 2, 3].map(() => h("span", { class: "pk-lab user" }));
    const opts = labels.map((lab, i) => {
      const b = h("button", { class: "pk-opt", "data-i": String(i), "data-side": String(side), type: "button" }, h("span", { class: "pk-kb" }, KEYS[side][i]), lab);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(side, i, eventAt(e)); });
      b.addEventListener("click", (e) => { if (e.detail === 0) press(side, i, T()); });   // (the keyboard: Enter / Space on a focused button)
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      return b;
    });
    const bar = h("i", {});
    const over = h("div", { class: "pk-over" });
    const deco = h("div", { class: "pk-deco", "aria-hidden": "true" }, ...[0, 1, 2, 3, 4, 5, 6].map((i) => h("i", { class: `d${i % 3}`, style: `--x:${(i * 15 + 6) % 92}%;--s:${14 + (i * 7) % 22}px;--t:${9 + (i * 3) % 7}s;--d:${-(i * 2.3)}s` })));
    const box = h("div", { class: "pk-box" },
      h("div", { class: "pk-top" }, X.avatarEl(k), h("span", { class: "pk-name kname user" }, k.name), streak, round, score),
      h("div", { class: "pk-main" }, h("div", { class: "pk-char" }, ch, spk, speechOn ? replay : null), h("div", { class: "pk-choices" }, ...opts)));
    const el = h("div", { class: "pk-panel", "data-side": String(side), style: `--kid:${k.color}` }, deco, h("div", { class: "pk-timer" }, bar), box, over);
    return { side, el, round, score, streak, ch, spk, replay, opts, labels, over, bar, stops: [], finalBuilt: false, lastScore: "", lastStreak: 0, againBtn: null };
  };
  const panels = [mkPanel(0), mkPanel(1)] as const;
  const exitBtn = h("button", { class: "pk-ctl", id: "pk-exit", type: "button", title: "退出对战", "aria-label": "退出对战", onclick: () => void leave() });
  const skipBtn = h("button", { class: "pk-ctl pk-skip", id: "pk-skip", type: "button", onclick: () => { if (L.skipIntro(s, T())) render(); } }, "跳过");
  const muteBtn = h("button", { class: "pk-ctl", id: "pk-mute", type: "button", onclick: () => { store.mute = !store.mute; save(); setMuted(store.mute); drawMute(); } });
  const dots = h("div", { class: "pk-dots" + (s.total > 10 ? " small" : ""), id: "pk-dots", "aria-hidden": "true" });
  const dotEls = Array.from({ length: s.total }, () => h("i", { class: "pk-dot" }));
  dots.append(...dotEls);
  const dotState: (number | undefined)[] = [];
  // the tug of war: the first player's colour grows from the left, the second player's from the right (seen by each player it is HIS colour on HIS left): it moves toward the leader
  const tugA = h("i", { class: "a", style: `background:${kids[0].color}` }), tugB = h("i", { class: "b", style: `background:${kids[1].color}` }), knot = h("b", { class: "knot" });
  const tug = h("div", { class: "pk-tug", id: "pk-tug", "aria-hidden": "true" }, tugA, tugB, knot);
  const mid = h("div", { class: "pk-mid", id: "pk-mid" }, exitBtn, dots, skipBtn, muteBtn, tug);
  const drawMute = () => { muteBtn.innerHTML = SPK(store.mute); const t = store.mute ? "打开声音" : "关闭声音"; muteBtn.title = t; muteBtn.setAttribute("aria-label", t); };
  drawMute();
  const frame = h("div", { class: "pk-frame", id: "pk-frame" }, panels[1].el, panels[0].el, mid);
  const hint = h("div", { class: "pk-hint", id: "pk-hint" }, "竖放设备可获得更大的答题区。");
  stage.append(frame, hint);

  // ----- places each half by LAYOUT size (never by measuring a turned element) -----
  /** The stage is ONE portrait stage (3:4 at the widest). On a portrait screen it fills the screen; on a landscape screen the same stage stands in the middle, as high as fits. */
  function place() {
    const W = stage.offsetWidth, H = stage.offsetHeight;
    const land = W > H;
    hint.style.display = land ? "" : "none";
    stage.classList.toggle("land", land);
    const fh = land ? H - 20 : H;
    const fw = Math.min(W, Math.floor(fh * 0.75));
    const mid_ = H < 460 ? 36 : MID;
    frame.style.cssText = `left:${Math.floor((W - fw) / 2)}px;top:0;width:${fw}px;height:${fh}px`;
    const hh = Math.floor((fh - mid_) / 2);
    const put = (p: Panel, top: number, rot: number) => {
      p.el.style.cssText = `--kid:${kids[p.side].color};left:0;top:${top}px;width:${fw}px;height:${hh}px;transform:rotate(${rot}deg)`;
      fit(p, fw, hh);
    };
    put(panels[1], 0, 180); put(panels[0], fh - hh, 0);
    mid.style.cssText = `left:0;top:${hh}px;width:${fw}px;height:${fh - 2 * hh}px`;
  }
  /** the inside of a half: the small band (name, round, score), the prompt card above, the four choices below (2 x 2; in a very short half 4 in a row) */
  function fit(p: Panel, w: number, hh: number) {
    const padT = 14, padB = 6, padX = 6, band = hh < 190 ? 24 : 28, gap = 6;
    const mainW = w - 2 * padX, mainH = hh - padT - padB - band - gap;
    const row4 = mainH - 2 * 56 - 4 < 70;
    p.el.classList.toggle("row4", row4);
    p.el.style.setProperty("--pk-band", `${band}px`);
    const chh = row4 ? 56 : Math.max(116, Math.round(mainH * 0.54));
    p.el.style.setProperty("--pk-choicesh", `${chh}px`);
    const px = Math.min((mainH - chh - gap) * 0.8, mainW * 0.5, 220);
    p.el.style.setProperty("--pk-chsize", `${Math.max(26, Math.round(px))}px`);
    p.el.style.setProperty("--pk-cardw", `${Math.min(mainW, Math.round(Math.max(26, px) * 2))}px`);
    const bw = row4 ? (mainW - 3 * 6) / 4 : (mainW - 8) / 2, bh = row4 ? 56 : (chh - 8) / 2;
    p.el.style.setProperty("--pk-lab", `${Math.max(13, Math.min(34, Math.floor(bh * 0.42), Math.floor(bw / 5.2)))}px`);
    p.el.style.setProperty("--pk-bd", `${Math.max(hh < 190 ? 30 : 40, Math.min(130, Math.floor(hh * 0.22), Math.floor(w * 0.2)))}px`);
    p.el.style.setProperty("--pk-av", `${Math.max(40, Math.min(120, Math.floor(hh * 0.3), Math.floor(w * 0.22)))}px`);
    fitWord(p);
  }
  /** a word as the prompt: the font shrinks until the word fits the card */
  function fitWord(p: Panel) {
    if (A.present === "char") return;
    const px = parseFloat(p.el.style.getPropertyValue("--pk-chsize")) || 60, card = parseFloat(p.el.style.getPropertyValue("--pk-cardw")) || 200;
    const len = Math.max(1, [...p.ch.textContent!].length);
    p.ch.style.fontSize = `${Math.max(14, Math.min(px * 0.8, (card - 24) / (len * 0.58)))}px`;
  }

  // ----- drawing the state -----
  let lastSig = "", lastPhase = "", lastScores: [number, number] = [0, 0], swapSide: number | null = null;
  const cur = (side: 0 | 1) => L.current(s, side);
  const sparks = (n: number, cls = "pk-spk") => Array.from({ length: n }, (_, i) => h("i", { class: cls, style: `--a:${Math.round((360 / n) * i)}deg;--d:${(i % 4) * 40}ms` }));
  const buddy = (k: M.Kid, mood: string, faces: (keyof typeof FACES)[], extra: (Node | null)[] = []) => {
    const faceEls = faces.map((f) => { const e = h("span", { class: `pk-face f-${f}` }); e.innerHTML = FACES[f]; return e; });
    return h("div", { class: `pk-buddy mood-${mood}` }, h("i", { class: "pk-arm l" }), h("i", { class: "pk-arm r" }), h("div", { class: "pk-bav", style: `--kid:${k.color}` }, X.avatarEl(k)), ...extra, ...faceEls);
  };
  function finalView(p: Panel, o: L.Outcome): HTMLElement {
    const side = p.side, me = kids[side], opp = kids[(1 - side) as 0 | 1];
    const own = s.scores[side], oth = s.scores[1 - side];
    const cnt = h("span", { class: "pk-cnt" }, String(own));
    const verdict = h("div", { class: "pk-verdict" }, o === "win" ? "你赢了。" : o === "lose" ? "你输了。" : "平局。");
    const score = h("div", { class: "pk-fscore" }, cnt, " : ", String(oth));
    const again = h("button", { class: "primary pk-again", id: `pk-again-${side + 1}`, type: "button", onclick: () => again2(side) }, h("span", {}, "再来一局"));
    p.againBtn = again;
    const text = h("div", { class: "pk-ftext" }, verdict, score);
    const root = h("div", { class: "pk-final " + o });
    if (o === "win") {
      const trophy = h("div", { class: "pk-trophy" }, h("i", { class: "pk-shine" }));
      trophy.insertAdjacentHTML("afterbegin", TROPHY);
      const crown = h("div", { class: "pk-crown" }); crown.innerHTML = CROWN;
      root.append(h("div", { class: "pk-rays" }), h("div", { class: "pk-pulse" }),
        h("div", { class: "pk-stage2" }, trophy, buddy(me, "win", ["happy"], [crown])), text, again);
      queueMicrotask(() => { if (p.finalBuilt && root.isConnected) p.stops.push(startFx(p.over, "win", me.color), countUp(cnt, own, 900)); });
    } else if (o === "lose") {
      const cloud = h("div", { class: "pk-cloud" }, h("i", { class: "r0" }), h("i", { class: "r1" }), h("i", { class: "r2" }), h("i", { class: "r3" }));
      cloud.insertAdjacentHTML("afterbegin", CLOUD);
      root.append(cloud, h("div", { class: "pk-stage2" }, buddy(me, "lose", ["sad", "plead"])), text, again);
    } else {
      const eq = h("span", { class: "pk-eq" }, "=");
      root.append(h("div", { class: "pk-stage2" }, buddy(me, "tie", ["shrug"]), eq, buddy(opp, "tie opp", ["shrug"])), text, again);
      queueMicrotask(() => { if (p.finalBuilt && root.isConnected) p.stops.push(startFx(p.over, "tie", me.color)); });
    }
    return root;
  }
  function over(p: Panel): Node[] {
    const side = p.side, me = kids[side], opp = kids[(1 - side) as 0 | 1];
    if (s.phase === "intro") {
      // a fighting-game VS screen: two colour panels slam in from opposite sides, a bright slash between them, the PK mark bursts in the middle
      const vp = (k: M.Kid, o: M.Kid, cls: string) => h("div", { class: `pk-vp ${cls}`, style: `--kid:${k.color}` },
        h("div", { class: "pk-vpin" }, X.avatarEl(k), h("b", { class: "pk-vname user" }, k.name), h("span", { class: "pk-vwins" }, `胜场 ${winsOf(A, k.id, o.id)}`)));
      const mark = h("div", { class: "pk-pkmark" }, h("i", { class: "pk-shock" }), ...sparks(10, "pk-spk2"));
      mark.append(pkMark("mark"));
      return [h("div", { class: "pk-vs" }, vp(me, opp, "me"), vp(opp, me, "opp"), h("i", { class: "pk-slash" }), h("i", { class: "pk-vsflash" }), mark, h("div", { class: "pk-announce" }, "准备"))];
    }
    if (s.phase === "countdown") {
      if (s.count > 0) return [h("div", { class: "pk-cd", style: `--opp:${opp.color}` }, h("i", { class: "pk-cflash" }), h("i", { class: "pk-cside l" }), h("i", { class: "pk-cside r" }), h("i", { class: "pk-shock" }), h("b", { class: "pk-num" }, String(s.count)))];
      return [h("div", { class: "pk-cd go", style: `--opp:${opp.color}` }, h("i", { class: "pk-cflash" }), h("i", { class: "pk-cside l" }), h("i", { class: "pk-cside r" }), h("i", { class: "pk-shock" }), h("div", { class: "pk-gotxt" }, "GO!"), ...sparks(14, "pk-spk3"))];
    }
    if (s.phase === "prep") return [h("div", { class: "pk-banner" }, h("b", {}, `第 ${Math.min(s.round + 1, s.total)} / ${s.total} 题`))];
    if (s.phase === "result") {
      if (s.winner === side) {
        const b = p.opts[lastTap[side]];
        const x = b ? b.offsetLeft + b.offsetWidth / 2 : p.el.offsetWidth / 2, y = b ? b.offsetTop + b.offsetHeight / 2 : p.el.offsetHeight / 2;
        const ms = L.reactionMs(s);
        const out: Node[] = [h("div", { class: "pk-hit", style: `left:${x}px;top:${y}px` }, h("div", { class: "pk-plus" }, "+1"), ...sparks(8))];
        if (ms !== null) { const fast = h("div", { class: "pk-fast" + (ms < 1500 ? " quick" : "") }, bolt(), h("span", {}, `抢答 ${L.secText(ms)} 秒`)); out.push(fast); }
        return out;
      }
      if (s.winner === -1) return [h("div", { class: "pk-none" }, "本题无人得分。")];
    }
    return [];
  }
  const clearFx = (p: Panel) => { p.stops.splice(0).forEach((f) => f()); };
  function render() {
    const sn = L.snapshot(s);
    const sig = JSON.stringify([sn.phase, sn.count, sn.round, sn.scores, sn.locked, sn.wrongPick, sn.winner, sn.outcome, sn.again, store.mute]);
    if (sig !== lastSig) {
      lastSig = sig;
      const changed = s.phase === "result" && L.leadSwap(s.results, s.round);
      if (sn.phase !== "result") swapSide = null; else if (changed) swapSide = L.leaderOf(sn.scores);
      lastScores = [...sn.scores];
      const tp = L.tugPos(s);
      tugA.style.width = `${(50 + 50 * tp).toFixed(1)}%`; tugB.style.width = `${(50 - 50 * tp).toFixed(1)}%`; tug.style.setProperty("--p", `${(50 + 50 * tp).toFixed(1)}%`); mid.dataset.tug = tp.toFixed(2);
      knot.classList.toggle("swap", swapSide !== null && swapSide >= 0);
      for (const p of panels) {
        const side = p.side, item = cur(side);
        const q = s.phase === "question" || s.phase === "result" || s.phase === "final";
        const fin = s.phase === "final" ? s.outcome![side] : null;
        p.el.dataset.phase = s.phase;
        p.el.classList.toggle("is-win", s.phase === "result" && s.winner === side);
        p.el.classList.toggle("is-lose", s.phase === "result" && s.winner === (1 - side));
        p.el.classList.toggle("is-none", s.phase === "result" && s.winner === -1);
        p.el.classList.toggle("is-swap", swapSide === side);
        p.el.classList.toggle("is-locked", s.phase === "question" && s.locked[side]);
        p.el.classList.toggle("is-fwin", fin === "win"); p.el.classList.toggle("is-flose", fin === "lose"); p.el.classList.toggle("is-ftie", fin === "tie");
        p.round.textContent = `第 ${Math.min(s.round + 1, s.total)} / ${s.total} 题`;
        const sc = String(s.scores[side]);
        if (p.lastScore !== sc) { if (p.lastScore !== "") { p.score.classList.remove("pop"); void p.score.offsetWidth; p.score.classList.add("pop"); } p.lastScore = sc; }
        p.score.textContent = sc;
        const st = L.streakOf(s, side);
        if (st !== p.lastStreak) { p.streak.textContent = st >= 2 ? `连胜 ×${st}` : ""; p.streak.classList.toggle("on", st >= 2); if (st >= 2) { p.streak.classList.remove("pop"); void p.streak.offsetWidth; p.streak.classList.add("pop"); } p.lastStreak = st; }
        const hidePrompt = speechOn && s.phase !== "final";
        p.ch.textContent = hidePrompt ? "" : q || s.phase === "prep" ? item.prompt : "";
        p.ch.classList.toggle("hide", s.phase === "prep");
        p.spk.classList.toggle("on", hidePrompt && (s.phase === "question" || s.phase === "result"));
        p.el.classList.toggle("speech", speechOn);
        p.el.classList.toggle("fast-lit", false);
        fitWord(p);
        p.opts.forEach((b, i) => {
          p.labels[i].textContent = item.choices[i] ?? "";
          const right = item.answers.includes(i);
          b.classList.toggle("right", s.phase === "result" && right);
          b.classList.toggle("wrong", s.wrongPick[side] === i && (s.phase === "question" || s.phase === "result"));
          b.classList.toggle("dimmed", s.phase === "question" && s.locked[side]);
          b.setAttribute("aria-disabled", String(!(s.phase === "question" && !s.locked[side])));
        });
        if (s.phase === "final") {
          if (!p.finalBuilt) { p.finalBuilt = true; clearFx(p); p.over.replaceChildren(finalView(p, fin!)); }
          else if (p.againBtn) { p.againBtn.disabled = s.again[side]; p.againBtn.firstElementChild!.textContent = s.again[side] ? "等待对方。" : "再来一局"; p.againBtn.classList.toggle("waiting", s.again[side]); }
        } else {
          p.finalBuilt = false; clearFx(p);
          p.over.replaceChildren(...over(p));
        }
        p.over.classList.toggle("on", s.phase === "intro" || s.phase === "countdown" || s.phase === "final" || s.phase === "prep" || (s.phase === "result" && s.winner !== (1 - side)));
      }
      const final = s.phase === "final", opening = s.phase === "intro" || s.phase === "countdown";
      exitBtn.classList.toggle("back", final);
      exitBtn.textContent = "";
      exitBtn.append(h("span", { class: "pk-x" }, final ? "‹" : "✕"), final ? h("span", { class: "pk-xt" }, "返回") : "");
      exitBtn.title = final ? "返回" : "退出对战"; exitBtn.setAttribute("aria-label", exitBtn.title);
      skipBtn.style.display = opening ? "" : "none"; dots.style.display = opening ? "none" : "";
      stage.classList.toggle("is-final", final);
      dotEls.forEach((d, i) => {
        const r = s.results[i];
        if (dotState[i] === r) return;
        dotState[i] = r;
        d.style.background = r === 0 || r === 1 ? kids[r].color : r === -1 ? "#ced4da" : "";
        d.classList.toggle("done", r !== undefined);
        d.classList.remove("pop"); void d.offsetWidth; if (r !== undefined) d.classList.add("pop");
      });
      dotEls.forEach((d, i) => d.classList.toggle("live", i === s.round && !final && s.results[i] === undefined && !opening));
      if (sn.phase !== lastPhase) { sounds(sn.phase); lastPhase = sn.phase; }
      if (final && !recorded) {
        recorded = true;
        record(A, kids[0].id, kids[1].id, s.outcome![0] === "win" ? kids[0].id : s.outcome![1] === "win" ? kids[1].id : null);
      }
    }
    const frac = s.phase === "question" ? Math.max(0, 1 - (T() - s.questionStart) / s.cfg.limitMs) : s.phase === "result" || s.phase === "final" ? 0 : 1;
    for (const p of panels) {
      const mixp = Math.round(Math.min(1, frac / 0.4) * 100);
      p.bar.style.width = `${(frac * 100).toFixed(1)}%`;
      p.bar.style.background = `color-mix(in srgb, ${kids[p.side].color} ${mixp}%, #ff922b)`;
    }
  }
  const sounds = (to: string) => {
    if (to === "intro") return openingSound();
    if (to === "countdown") return countTick(3);
    if (to === "prep") return;
    if (to === "question") { sfx("pop"); if (speechOn) say(cur(0).prompt, lang); return; }   // (one voice, one word: both players hear it at the same instant)
    if (to === "result") return sfx(s.winner === -1 ? "bad" : "good");
    if (to === "final") { if (s.outcome![0] === "tie") jingle(); else { fanfare(); trombone(1.3); } }
  };
  let lastCount = 3;
  const tick = () => {
    L.advance(s, T());
    if (s.phase === "countdown" && s.count !== lastCount) { lastCount = s.count; if (s.count === 0) goHit(); else countTick(s.count); }
    render();
  };

  function press(side: 0 | 1, index: number, at: number): L.TapEvent {
    const ev = L.tap(s, side, index, at);
    if (ev.type === "win" || ev.type === "steal") lastTap[side] = index;
    if (ev.type === "wrong") sfx("bad");
    render();
    return ev;
  }
  function again2(side: 0 | 1) {
    if (!L.pressAgain(s, side)) return render();
    seed += 1;
    const items = makeItems(seed);
    if (!items) return;
    s = L.create(items, T(), cfg); recorded = false; lastSig = ""; lastCount = 3; dotState.length = 0; lastScores = [0, 0]; swapSide = null; panels.forEach((p) => { p.lastStreak = 0; });
    render();
  }

  // ----- leaving -----
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer); document.removeEventListener("keydown", onKey, true); document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("resize", place); ro.disconnect(); watch.disconnect();
    panels.forEach(clearFx);
    try { window.speechSynthesis?.cancel(); } catch { /* no voice */ }
    delete window.__pk; fsOff();
  };
  let asking = false;
  async function leave() {
    if (asking) return;
    if (s.phase !== "final") {
      asking = true; pause();
      await new Promise((r) => setTimeout(r, 30));   // (the Escape key that asked must be over, or the box would be closed by the same key)
      const yes = await confirmDlg("退出对战？", "本局尚未结束。退出后本局不计入记录。", "退出对战", true);
      asking = false; resume();
      if (!yes) return;
    }
    dispose();
    location.hash = A.setupRoute;
  }
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector("dialog[open]")) return;
    stage.classList.add("kbd");   // a keyboard is there: show the key hints
    if (e.key === "Escape") { e.preventDefault(); void leave(); return; }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    for (const side of [0, 1] as const) { const i = KEYS[side].indexOf(e.key); if (i >= 0) { e.preventDefault(); press(side, i, T()); } }
  };
  const wasFs = !!document.fullscreenElement;
  const onFs = () => { if (wasFs && !document.fullscreenElement && stage.isConnected) void leave(); };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("fullscreenchange", onFs);
  window.addEventListener("resize", place);
  const ro = new ResizeObserver(() => place());
  const timer = setInterval(() => { if (!manual && pausedAt === null) tick(); }, 40);
  const watch = new MutationObserver(() => { if (!stage.isConnected) dispose(); });

  window.__pk = {
    get seed() { return seed; },
    state: () => ({ ...L.snapshot(s), items: [cur(0), cur(1)], seed }),
    tap: (side, index) => press(side, index, T()),
    step: (ms) => { if (manual) mT += ms; else offset += ms; tick(); },
    skip: (ms) => { if (manual) mT += ms; else offset += ms; tick(); },
    manual: (on) => { if (on && !manual) { mT = T(); manual = true; } else if (!on && manual) { offset = mT - (performance.now() - t0); manual = false; } },
    T,
  } as PkHook;

  X.show(stage);
  ro.observe(stage); place(); render();
  watch.observe(document.body, { childList: true, subtree: true });
}
