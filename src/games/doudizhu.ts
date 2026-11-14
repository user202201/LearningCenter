import type { GameCtx } from "./ctx";
import "./doudizhu.css";
import * as L from "./doudizhu-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#d3f9d8"/>
<g stroke="#3b2f2f" stroke-width="4" stroke-linejoin="round"><rect x="14" y="34" width="40" height="58" rx="9" fill="#fff8e1" transform="rotate(-16 34 63)"/><rect x="66" y="34" width="40" height="58" rx="9" fill="#fff8e1" transform="rotate(16 86 63)"/><rect x="40" y="26" width="42" height="64" rx="9" fill="#fff8e1"/></g>
<path d="M30 80c-8-5-11-11-11-15 0-4 3-6 6-6 3 0 5 2 5 4 1-2 3-4 6-4 3 0 6 2 6 6 0 4-3 10-12 15z" fill="#f03e3e" stroke="#3b2f2f" stroke-width="2.6" stroke-linejoin="round" transform="rotate(-16 34 63)"/>
<path d="M91 47 103 61 91 75 79 61z" fill="#343a40" stroke="#3b2f2f" stroke-width="2.6" stroke-linejoin="round" transform="rotate(16 86 63)"/>
<path d="M47 50 52 38 58 46 61 36 64 46 70 38 75 50z" fill="#fcc419" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round"/>
<circle cx="56" cy="62" r="2.8" fill="#3b2f2f"/><circle cx="66" cy="62" r="2.8" fill="#3b2f2f"/><path d="M55 70q6 6 12 0" fill="none" stroke="#3b2f2f" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="68" r="3" fill="#ffa8a8"/><circle cx="70" cy="68" r="3" fill="#ffa8a8"/></svg>`;

// ------------------------------------------------------------------ drawing: suits, jokers, faces
const DARK = "#3b2f2f";
const FACE = [{ ey: 21, my: 26 }, { ey: 18, my: 23 }, { ey: 15, my: 21 }, { ey: 21, my: 27 }];
function suitSvg(suit: number, face: boolean): string {
  const red = suit === 1 || suit === 2;
  const fill = red ? "#f03e3e" : "#495057";
  let body: string;
  if (suit === 0) {
    const shapes = `<circle cx="20" cy="12" r="8.5"/><circle cx="10.5" cy="25" r="8.5"/><circle cx="29.5" cy="25" r="8.5"/><path d="M17 24h6l3 13H14z"/>`;
    body = `<g fill="${DARK}" stroke="${DARK}" stroke-width="6" stroke-linejoin="round">${shapes}</g><g fill="${fill}">${shapes}</g>`;
  } else {
    const d = suit === 1 ? "M20 2.5 36.5 20 20 37.5 3.5 20z"
      : suit === 2 ? "M20 35C6 25 3 17.5 3 12 3 7 7 3.5 11.5 3.5 15 3.5 18 5.5 20 9.5 22 5.5 25 3.5 28.5 3.5 33 3.5 37 7 37 12 37 17.5 34 25 20 35z"
        : "M20 3C14 12 3.5 17 3.5 25.5 3.5 30.5 7.5 33.5 12 33.5 15 33.5 17 32 18 30 18 34 16 36.5 13 37.5H27C24 36.5 22 34 22 30 23 32 25 33.5 28 33.5 32.5 33.5 36.5 30.5 36.5 25.5 36.5 17 26 12 20 3z";
    body = `<path d="${d}" fill="${fill}" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  let f = "";
  if (face) {
    const { ey, my } = FACE[suit];
    f = `<circle cx="14.5" cy="${ey}" r="3.4" fill="#fff"/><circle cx="25.5" cy="${ey}" r="3.4" fill="#fff"/><circle cx="15" cy="${ey + 0.6}" r="1.7" fill="${DARK}"/><circle cx="26" cy="${ey + 0.6}" r="1.7" fill="${DARK}"/><path d="M16 ${my}q4 4.2 8 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${body}${f}</svg>`;
}
const SUIT_SMALL = [0, 1, 2, 3].map((s) => suitSvg(s, false));
const SUIT_BIG = [0, 1, 2, 3].map((s) => suitSvg(s, true));
function jokerSvg(big: boolean): string {
  const c = big ? "#f03e3e" : "#495057", c2 = big ? "#fcc419" : "#adb5bd";
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M6 17 5 4l9 7 6-9 6 9 9-7-1 13z" fill="${c}" stroke="${DARK}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="5" cy="4" r="2.4" fill="${c2}" stroke="${DARK}" stroke-width="1.6"/><circle cx="20" cy="2.4" r="2.4" fill="${c2}" stroke="${DARK}" stroke-width="1.6"/><circle cx="35" cy="4" r="2.4" fill="${c2}" stroke="${DARK}" stroke-width="1.6"/><circle cx="20" cy="26" r="11.5" fill="#fff8e1" stroke="${DARK}" stroke-width="2.6"/><circle cx="15.5" cy="24" r="2.2" fill="${DARK}"/><circle cx="24.5" cy="24" r="2.2" fill="${DARK}"/><path d="M14.5 29.5q5.5 5 11 0" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/><circle cx="12.5" cy="28.5" r="2.2" fill="#ffa8a8"/><circle cx="27.5" cy="28.5" r="2.2" fill="#ffa8a8"/></svg>`;
}
const JOKER_SMALL = jokerSvg(false), JOKER_BIG = jokerSvg(true);
const STAR = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 3l5 11.5 12.5 1.2-9.4 8.3 2.8 12.3L20 29.8 9.1 36.3l2.8-12.3-9.4-8.3L15 14.5z" fill="currentColor" stroke="${DARK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

type Mood = "n" | "happy" | "sad";
/** cartoon faces of the three players: 0 bear (you), 1 bunny (right), 2 cat (left); the landlord wears a crown */
function faceSvg(kind: number, mood: Mood, crown: boolean): string {
  const skin = kind === 0 ? "#d9a066" : kind === 1 ? "#fff0f6" : "#ffc078";
  const ear = kind === 0 ? "#c58a4f" : kind === 1 ? "#ffc9de" : "#ff922b";
  let ears: string;
  if (kind === 1) ears = `<ellipse cx="16" cy="9" rx="5" ry="12" fill="${skin}" stroke="${DARK}" stroke-width="2.4"/><ellipse cx="16" cy="10" rx="2.4" ry="8" fill="${ear}"/><ellipse cx="32" cy="9" rx="5" ry="12" fill="${skin}" stroke="${DARK}" stroke-width="2.4"/><ellipse cx="32" cy="10" rx="2.4" ry="8" fill="${ear}"/>`;
  else if (kind === 2) ears = `<path d="M8 22 9 6l11 8z" fill="${skin}" stroke="${DARK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 22 39 6 28 14z" fill="${skin}" stroke="${DARK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 17 12 11l5 4zM36 17 36 11l-5 4z" fill="${ear}"/>`;
  else ears = `<circle cx="10" cy="14" r="6.5" fill="${skin}" stroke="${DARK}" stroke-width="2.4"/><circle cx="10" cy="14" r="3" fill="${ear}"/><circle cx="38" cy="14" r="6.5" fill="${skin}" stroke="${DARK}" stroke-width="2.4"/><circle cx="38" cy="14" r="3" fill="${ear}"/>`;
  const eyes = mood === "happy"
    ? `<path d="M14 25q3.5-4 7 0M27 25q3.5-4 7 0" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`
    : mood === "sad"
      ? `<circle cx="17.5" cy="25" r="3" fill="${DARK}"/><circle cx="30.5" cy="25" r="3" fill="${DARK}"/><path d="M13 20l8 2M35 20l-8 2" stroke="${DARK}" stroke-width="2.2" stroke-linecap="round"/><path d="M15.5 30q-1.6 4 0 6" fill="none" stroke="#74c0fc" stroke-width="2.4" stroke-linecap="round"/>`
      : `<circle cx="17.5" cy="25" r="3.2" fill="#fff" stroke="${DARK}" stroke-width="1.6"/><circle cx="30.5" cy="25" r="3.2" fill="#fff" stroke="${DARK}" stroke-width="1.6"/><circle cx="18" cy="25.6" r="1.6" fill="${DARK}"/><circle cx="31" cy="25.6" r="1.6" fill="${DARK}"/>`;
  const mouth = mood === "happy" ? `<path d="M18 33q6 7 12 0z" fill="#f03e3e" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`
    : mood === "sad" ? `<path d="M19 37q5-5 10 0" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<path d="M19 33q5 5 10 0" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`;
  const cr = crown ? `<path d="M15 12 17 1l7 6 7-6 2 11z" fill="#fcc419" stroke="${DARK}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="17" cy="1.5" r="1.7" fill="#f03e3e"/><circle cx="31" cy="1.5" r="1.7" fill="#f03e3e"/><circle cx="24" cy="6" r="1.7" fill="#f03e3e"/>` : "";
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${ears}<circle cx="24" cy="28" r="17" fill="${skin}" stroke="${DARK}" stroke-width="2.6"/>${eyes}<ellipse cx="24" cy="29.5" rx="2.4" ry="1.7" fill="${DARK}"/>${mouth}<circle cx="11.5" cy="32" r="2.6" fill="#ffa8a8" opacity=".8"/><circle cx="36.5" cy="32" r="2.6" fill="#ffa8a8" opacity=".8"/>${cr}</svg>`;
}

// ------------------------------------------------------------------ the screen
interface Win { __dz?: unknown }
export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let level = Math.max(1, Math.min(3, ctx.store.get<number>("level", 2))) as L.Level;
  let auto = false;
  let started = false;
  let rng: L.Rng = Math.random;
  let nextSeed: number | null = null;
  let first = Math.floor(Math.random() * 3);
  const best = (): number => ctx.store.get<number>("best", 0);
  const OTHER = ["", "小兔", "小猫"];   // seat 1 = right, seat 2 = left

  // ---- HUD
  const baseEl = h("span", { class: "dz-stat", id: "dz-base" }, "");
  const multEl = h("span", { class: "dz-stat", id: "dz-mult" }, "");
  const bestEl = h("span", { class: "dz-stat best", id: "dz-best" }, "");
  const levelBtn = h("button", { class: "mopt", id: "dz-level", onclick: () => { level = ((level % 3) + 1) as L.Level; ctx.store.set("level", level); ctx.sfx("tap"); reset(); } }, "");
  const autoBtn = h("button", { class: "mopt", id: "dz-auto", onclick: () => { auto = !auto; ctx.sfx("tap"); sel.clear(); render(); if (started) proceed(); } }, "");
  const hud = h("div", { class: "dz-hud" }, baseEl, multEl, bestEl, levelBtn, autoBtn);

  // ---- the table
  const panels = [1, 2].map((seat) => {
    const av = h("div", { class: "dz-av" });
    const cnt = h("span", { class: "dz-cnt" }, "");
    const role = h("span", { class: "dz-role" }, "");
    const el = h("div", { class: `dz-pl seat${seat}`, "data-seat": seat }, av, cnt, role);
    return { el, av, cnt, role };
  });
  const bcLabel = h("span", { class: "dz-bclabel" }, "底牌");
  const bcCards = h("div", { class: "dz-bcards", id: "dz-bottom" });
  const bc = h("div", { class: "dz-bc" }, bcLabel, bcCards);
  const zones = [0, 1, 2].map((seat) => {
    const cards = h("div", { class: "dz-zc" });
    const say = h("span", { class: "dz-say" }, "");
    say.hidden = true;
    const el = h("div", { class: `dz-zone z${seat}`, id: `dz-zone-${seat}`, "data-seat": seat }, cards, say);
    return { el, cards, say };
  });
  const zonesEl = h("div", { class: "dz-zones" }, zones[2].el, zones[1].el, zones[0].el);
  const mid = h("div", { class: "dz-mid" }, bc, zonesEl);
  const table = h("div", { class: "dz-table" }, panels[1].el, panels[0].el, mid);
  // the two panels: left = seat 2, right = seat 1 (play goes round counter-clockwise: you, right, left)
  panels[1].el.classList.add("left"); panels[0].el.classList.add("right");

  const meAv = h("div", { class: "dz-av small" });
  const meRole = h("span", { class: "dz-role" }, "");
  const meCnt = h("span", { class: "dz-cnt" }, "");
  const msgEl = h("div", { class: "dz-msg", id: "dz-msg" }, "");
  const status = h("div", { class: "dz-status" }, meAv, meRole, meCnt, msgEl);
  const fan = h("div", { class: "dz-fan", id: "dz-fan" });
  const hand = h("div", { class: "dz-hand", id: "dz-hand" }, fan);
  const act = h("div", { class: "dz-act", id: "dz-act" });

  const title = h("h2", {}, ""), line1 = h("p", {}, ""), line2 = h("p", {}, "");
  const startBtn = h("button", { class: "primary", id: "dz-start", onclick: () => { ctx.sfx("tap"); if (overShown) reset(); started = true; ovl.hidden = true; render(); proceed(); } }, "开始");
  const extra = h("p", {}, ""); extra.hidden = true;
  const ovl = h("div", { class: "dz-ovl", id: "dz-ovl" }, title, line1, line2, extra, startBtn);
  const stage = h("div", { class: "dz-stage", id: "dz-stage" }, table, status, hand, act, ovl);
  root.append(h("div", { class: "dz-wrap" }, hud, stage));

  // ---- the game
  let s!: L.DZState;
  const sel = new Set<number>();
  let timer = 0;
  const timers: number[] = [];
  let cursor = -1, cursorShown = false;
  let hintList: number[][] = [], hintIdx = 0;
  const zoneKey: string[] = ["", "", ""];
  let fly: { seat: number; key: string } | null = null;
  let pendingMsg = "";
  let overShown = false;
  let handStep = 20, handCw = 40;
  let zoneCw = 28;
  let dealt = 0;
  let hold = false;   // test hook: no computer move is scheduled

  function newGame(): void {
    clearTimeout(timer); timer = 0;
    rng = nextSeed !== null ? L.mulberry(nextSeed) : Math.random; nextSeed = null;
    s = L.newDeal(rng, first);
    sel.clear(); cursor = -1; hintList = []; hintIdx = 0; fly = null; pendingMsg = ""; overShown = false; dealt++;
  }
  function reset(): void {
    started = false;
    first = Math.floor(Math.random() * 3);
    newGame();
    setOvl("斗地主", "叫分决定地主，地主先出牌；先出完手牌的一方获胜。", "", "开始", true);
    render();
  }
  const setOvl = (t: string, a: string, b: string, btn: string, show: boolean, ex = ""): void => { title.textContent = t; line1.textContent = a; line2.textContent = b; line2.hidden = !b; extra.textContent = ex; extra.hidden = !ex; startBtn.textContent = btn; ovl.hidden = !show; };
  const myTurn = (): boolean => started && !auto && s.turn === 0 && s.phase !== "over";
  const roleName = (seat: number): string => (s.landlord < 0 ? "" : seat === s.landlord ? "地主" : "农民");
  const say = (msg: string): void => { pendingMsg = msg; msgEl.textContent = msg; };

  // ---- the flow
  const fastMs = (): number => (reduced ? 30 : 520 + Math.floor(Math.random() * 380));
  function proceed(): void {
    clearTimeout(timer); timer = 0;
    if (!started || s.phase === "over") return;
    if (s.turn === 0 && !auto) { pendingMsg = ""; render(); return; }
    if (!hold) timer = window.setTimeout(aiStep, fastMs());
    render();
  }
  function aiStep(): void {
    timer = 0;
    if (!started || s.phase === "over") return;
    const seat = s.turn;
    const lv = (seat === 0 ? Math.max(2, level) : level) as L.Level;
    if (s.phase === "bid") { doBid(seat, L.aiBid(s.hands[seat], s.high, lv, rng)); return; }
    const cards = L.aiPlay(s, seat, lv, rng);
    if (cards) doPlay(seat, cards); else doPass(seat);
  }
  function doBid(seat: number, v: number): void {
    const r = L.bid(s, seat, v);
    if (r === "illegal") return;
    ctx.sfx(v ? "good" : "tap");
    if (r === "redeal") {
      ctx.toast("无人叫分，重新发牌。", 1600);
      render();
      timers.push(window.setTimeout(() => { first = (first + 1) % 3; newGame(); render(); proceed(); }, reduced ? 60 : 1100));
      return;
    }
    if (r === "landlord") {
      ctx.sfx("win");
      say(s.landlord === 0 ? "你是地主。" : s.landlord === 1 ? "小兔是地主。" : "小猫是地主。");
      render();
      if (s.landlord === 0) sel.clear();
      timers.push(window.setTimeout(proceed, reduced ? 40 : 900));
      return;
    }
    render(); proceed();
  }
  function doPlay(seat: number, cards: number[]): boolean {
    const r = L.checkPlay(s, seat, cards);
    if (!r.ok) return false;
    L.play(s, seat, cards);
    fly = { seat, key: cards.join(",") };
    const t = r.combo.type;
    if (t === "rocket") { ctx.sfx("check"); flash("rocket"); }
    else if (t === "bomb") { ctx.sfx("capture"); flash("bomb"); }
    else ctx.sfx(seat === 0 ? "place" : "move");
    sel.clear(); hintList = []; hintIdx = 0; pendingMsg = "";
    render();
    fly = null;
    if (s.phase === "over") { finish(); return true; }
    proceed();
    return true;
  }
  function doPass(seat: number): boolean {
    if (!L.pass(s, seat)) return false;
    ctx.sfx("move"); sel.clear(); hintList = []; hintIdx = 0; pendingMsg = "";
    render(); proceed();
    return true;
  }
  function flash(kind: "bomb" | "rocket"): void {
    if (reduced) return;
    const f = h("div", { class: `dz-flash ${kind}` });
    for (let i = 0; i < 10; i++) { const st = h("i", {}); st.style.setProperty("--a", `${i * 36}deg`); f.append(st); }
    stage.append(f);
    stage.classList.add("shake");
    timers.push(window.setTimeout(() => { f.remove(); stage.classList.remove("shake"); }, 750));
  }
  function confetti(): void {
    if (reduced) return;
    const cols = ["#12b886", "#fcc419", "#f06595", "#4dabf7", "#ff922b", "#9775fa"];
    for (let i = 0; i < 26; i++) {
      const c = h("i", { class: "dz-conf" });
      c.style.left = `${Math.random() * 100}%`; c.style.background = cols[i % cols.length];
      c.style.setProperty("--h", `${stage.clientHeight + 20}px`); c.style.animationDuration = `${1.6 + Math.random() * 1.2}s`; c.style.animationDelay = `${Math.random() * 0.4}s`;
      stage.append(c);
      timers.push(window.setTimeout(() => c.remove(), 3400));
    }
  }
  function finish(): void {
    const win = L.sideWon(s, 0);
    const sc = L.finalScore(s);
    const old = best();
    const newBest = win && sc > old;
    if (newBest) ctx.store.set("best", sc);
    ctx.store.set("games", ctx.store.get<number>("games", 0) + 1);
    if (win) ctx.store.set("wins", ctx.store.get<number>("wins", 0) + 1);
    ctx.sfx(win ? "win" : "lose");
    if (win) confetti();
    render();
    ctx.toast(`得分：${sc}`, 1500);
    timers.push(window.setTimeout(() => {
      if (s.phase !== "over") return;
      const landWon = L.landlordWon(s);
      const ex = s.spring === 1 ? "春天！倍数加倍。" : s.spring === 2 ? "反春天！倍数加倍。" : "";
      setOvl(win ? "你赢了。" : "你输了。", landWon ? "地主获胜。" : "农民获胜。", newBest ? `新纪录：${sc}` : `得分：${sc}`, "再来一局", true, ex);
      overShown = true;
    }, reduced ? 80 : 1100));
  }

  // ---- my actions
  function toggleCard(id: number, on?: boolean): void {
    const want = on ?? !sel.has(id);
    if (want) sel.add(id); else sel.delete(id);
  }
  function onPlay(): void {
    if (!myTurn()) return;
    if (!sel.size) { ctx.sfx("bad"); say("请先选牌。"); return; }
    const r = L.checkPlay(s, 0, [...sel]);
    if (!r.ok) {
      ctx.sfx("bad"); shake();
      say(r.why === "weak" ? "没有大过上家。" : "牌型不符。");
      return;
    }
    doPlay(0, [...sel]);
  }
  function onPass(): void { if (myTurn() && L.canPass(s, 0)) doPass(0); }
  function onClear(): void { if (!sel.size) return; ctx.sfx("tap"); sel.clear(); render(); }
  function onHint(): void {
    if (!myTurn()) return;
    if (!hintList.length) { hintList = L.hintPlays(s, 0, rng); hintIdx = 0; }
    if (!hintList.length) { ctx.sfx("bad"); say("没有能大过的牌，请选择不出。"); render(); return; }
    ctx.sfx("tap");
    sel.clear(); for (const c of hintList[hintIdx % hintList.length]) sel.add(c);
    hintIdx++;
    say("");
    render();
  }
  function shake(): void {
    if (reduced) return;
    fan.classList.remove("nope"); void fan.offsetWidth; fan.classList.add("nope");
    timers.push(window.setTimeout(() => fan.classList.remove("nope"), 450));
  }

  // ---- drag across cards
  let drag: { pid: number; a: number; mode: boolean; base: Set<number> } | null = null;
  const idxAt = (clientX: number): number => {
    const r = fan.getBoundingClientRect();
    const n = s.hands[0].length;
    const i = Math.floor((clientX - r.left) / handStep);
    return Math.max(0, Math.min(n - 1, i));
  };
  const applyDrag = (b: number): void => {
    if (!drag) return;
    const lo = Math.min(drag.a, b), hi = Math.max(drag.a, b);
    sel.clear();
    drag.base.forEach((c) => sel.add(c));
    for (let i = lo; i <= hi; i++) { const c = s.hands[0][i]; if (drag.mode) sel.add(c); else sel.delete(c); }
    paintSel();
  };
  hand.addEventListener("pointerdown", (e) => {
    if (drag || !e.isPrimary && e.pointerType === "touch") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!myTurn() || s.phase !== "play") return;
    const el = (e.target as HTMLElement).closest(".dz-card") as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    const a = idxAt(e.clientX);
    const base = new Set(sel);
    drag = { pid: e.pointerId, a, mode: !sel.has(s.hands[0][a]), base };
    try { hand.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    cursorShown = false;
    hintList = [];
    applyDrag(a);
    ctx.sfx("move");
  });
  hand.addEventListener("pointermove", (e) => { if (drag && e.pointerId === drag.pid) applyDrag(idxAt(e.clientX)); });
  const endDrag = (e: PointerEvent): void => { if (drag && e.pointerId === drag.pid) { drag = null; try { hand.releasePointerCapture(e.pointerId); } catch { /* gone */ } renderAct(); renderStatus(); } };
  hand.addEventListener("pointerup", endDrag);
  hand.addEventListener("pointercancel", endDrag);

  // ---- keyboard
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
    const k = e.key;
    if (!ovl.hidden) { if (k === "Enter") { e.preventDefault(); startBtn.click(); } return; }
    if (!started) return;
    if (s.phase === "bid" && s.turn === 0 && !auto && /^[0-3]$/.test(k)) { e.preventDefault(); doBid(0, Number(k)); return; }
    if (s.phase !== "play") return;
    const n = s.hands[0].length;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      cursorShown = true;
      cursor = cursor < 0 ? (k === "ArrowLeft" ? 0 : n - 1) : Math.max(0, Math.min(n - 1, cursor + (k === "ArrowLeft" ? -1 : 1)));
      renderHand(); return;
    }
    if ((k === " " || k === "ArrowUp" || k === "ArrowDown") && myTurn()) {
      e.preventDefault();
      if (cursor < 0) cursor = 0;
      cursorShown = true;
      const c = s.hands[0][Math.min(cursor, n - 1)];
      if (c !== undefined) toggleCard(c);
      hintList = []; renderHand(); renderAct(); return;
    }
    if (k === "Enter" && myTurn()) { e.preventDefault(); onPlay(); return; }
    if ((k === "p" || k === "P" || k === "Backspace" || k === "Delete") && myTurn()) { e.preventDefault(); onPass(); return; }
    if ((k === "h" || k === "H") && myTurn()) { e.preventDefault(); onHint(); return; }
    if (k === "Escape") { onClear(); return; }
    if (k === "t" || k === "T") { autoBtn.click(); }
  };
  window.addEventListener("keydown", onKey);

  // ---- rendering
  const cardEl = (id: number, extra = ""): HTMLElement => {
    const r = L.rankOf(id), su = L.suitOf(id);
    const joker = su === 4;
    const red = joker ? id === L.BIG_JOKER : su === 1 || su === 2;
    const e = h("div", { class: `dz-card ${red ? "red" : "blk"}${joker ? " jk" : ""} ${extra}`, "data-id": id, "data-r": L.RANK_LABEL[r] });
    const corner = joker ? `<span class="dz-rk">JK</span><span class="dz-sm" style="color:${red ? "#f03e3e" : "#495057"}">${STAR}</span>` : `<span class="dz-rk">${L.RANK_LABEL[r]}</span><span class="dz-sm">${SUIT_SMALL[su]}</span>`;
    const big = joker ? (red ? JOKER_BIG : JOKER_SMALL) : SUIT_BIG[su];
    e.innerHTML = `<div class="dz-in"><div class="dz-cr${L.RANK_LABEL[r].length > 1 ? " long" : ""}">${corner}</div><div class="dz-big">${big}</div></div>`;
    return e;
  };
  const backEl = (): HTMLElement => { const e = h("div", { class: "dz-card back" }); e.innerHTML = `<div class="dz-in"><div class="dz-star">${STAR}</div></div>`; return e; };

  function layout(): void {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const n = Math.max(17, s?.hands[0].length ?? 17);
    const fitW = (W - 10) / (1 + (n - 1) * 0.34);
    const capH = (H * 0.3) / 1.4;
    handCw = Math.max(30, Math.min(70, Math.floor(Math.min(fitW, capH))));
    stage.style.setProperty("--hcw", `${handCw}px`);
    stage.style.setProperty("--lift", `${Math.round(handCw * 0.32)}px`);
  }
  function renderPanels(): void {
    [1, 2].forEach((seat, i) => {
      const p = panels[i];
      const lord = s.landlord === seat;
      const mood: Mood = s.phase === "over" ? (L.sideWon(s, seat) ? "happy" : "sad") : "n";
      p.av.innerHTML = faceSvg(seat === 1 ? 1 : 2, mood, lord);
      p.cnt.textContent = String(s.hands[seat].length);
      p.role.textContent = roleName(seat);
      p.role.className = `dz-role${lord ? " lord" : s.landlord >= 0 ? " peas" : ""}`;
      p.el.classList.toggle("turn", started && s.turn === seat && s.phase !== "over");
      p.el.setAttribute("data-count", String(s.hands[seat].length));
    });
    const lord = s.landlord === 0;
    const mood: Mood = s.phase === "over" ? (L.sideWon(s, 0) ? "happy" : "sad") : "n";
    meAv.innerHTML = faceSvg(0, mood, lord);
    meRole.textContent = roleName(0);
    meRole.className = `dz-role${lord ? " lord" : s.landlord >= 0 ? " peas" : ""}`;
    meRole.hidden = s.landlord < 0;
    meCnt.textContent = String(s.hands[0].length);
    status.classList.toggle("turn", started && s.turn === 0 && s.phase !== "over");
  }
  function renderBottom(): void {
    bcCards.innerHTML = "";
    const known = s.landlord >= 0;
    for (const c of s.bottom) bcCards.append(known ? cardEl(c, "mini") : backEl());
    bc.classList.toggle("open", known);
  }
  function renderZones(): void {
    for (let seat = 0; seat < 3; seat++) {
      const z = zones[seat];
      z.el.classList.toggle("turn", started && s.turn === seat && s.phase !== "over");
      const lastNow = s.last[seat];
      const zk = `${s.phase}|${s.phase === "bid" ? s.bids[seat] : lastNow === "pass" ? "p" : lastNow ? lastNow.cards.join(",") : ""}|${z.el.clientWidth}|${zoneCw}`;
      if (zoneKey[seat] === zk) continue;
      zoneKey[seat] = zk;
      z.cards.innerHTML = "";
      z.say.hidden = true;
      let sayText = "";
      if (s.phase === "bid") { const b = s.bids[seat]; if (b !== null) sayText = b === 0 ? "不叫" : `${b}分`; }
      else {
        const l = s.last[seat];
        if (l === "pass") sayText = "不出";
        else if (l) {
          const w = z.el.clientWidth;
          const n = l.cards.length;
          const cw = zoneCw;
          const step = n > 1 ? Math.min(cw * 0.62, (w - cw - 6) / (n - 1)) : 0;
          const total = cw + (n - 1) * step;
          z.cards.style.width = `${total}px`;
          z.cards.style.setProperty("--cw", `${cw}px`);
          z.cards.style.height = `${cw * 1.4}px`;
          const isFly = fly && fly.seat === seat && fly.key === l.cards.join(",") || false;
          // the table order: low cards left, high cards right for runs; the big cards of a bomb last
          const ordered = l.cards.slice().sort((a, b) => L.rankOf(a) - L.rankOf(b) || a - b);
          ordered.forEach((c, i) => {
            const e = cardEl(c, isFly ? "fly" : "");
            e.style.left = `${i * step}px`; e.style.top = "0px"; e.style.zIndex = String(i + 1);
            if (isFly) { e.style.setProperty("--fx", seat === 0 ? "0px" : seat === 1 ? "60px" : "-60px"); e.style.setProperty("--fy", seat === 0 ? "90px" : "-30px"); e.style.animationDelay = `${i * 12}ms`; }
            z.cards.append(e);
          });
          z.cards.setAttribute("data-type", l.combo.type);
        }
      }
      if (sayText) { z.say.textContent = sayText; z.say.hidden = false; }
      z.el.classList.toggle("has", !!sayText || (s.last[seat] !== null && s.last[seat] !== "pass"));
    }
  }
  function renderHand(): void {
    fan.innerHTML = "";
    const cs = s.hands[0];
    const n = cs.length;
    const W = stage.clientWidth;
    const cw = handCw;
    handStep = n > 1 ? Math.max(8, Math.min(cw * 0.62, (W - 10 - cw) / (n - 1))) : cw;
    const total = cw + (n - 1) * handStep;
    fan.style.width = `${total}px`;
    fan.style.setProperty("--cw", `${cw}px`);
    cs.forEach((c, i) => {
      const e = cardEl(c, `${sel.has(c) ? "sel" : ""}${cursorShown && cursor === i ? " cur" : ""}${s.landlord === 0 && s.plays[0] === 0 && s.bottom.includes(c) ? " fresh" : ""}`);
      e.style.left = `${i * handStep}px`; e.style.zIndex = String(i + 1);
      fan.append(e);
    });
    hand.classList.toggle("off", !myTurn() || s.phase !== "play");
  }
  function paintSel(): void {
    const els = fan.children;
    for (let i = 0; i < els.length; i++) { const id = Number((els[i] as HTMLElement).dataset.id); els[i].classList.toggle("sel", sel.has(id)); }
  }
  function btn(id: string, text: string, cls: string, fn: () => void, off = false): HTMLElement {
    const b = h("button", { class: `dz-btn ${cls}`, id, onclick: () => { fn(); } }, text) as HTMLButtonElement;
    b.disabled = off;
    return b;
  }
  function renderAct(): void {
    act.innerHTML = "";
    if (!started || s.phase === "over") return;
    if (s.phase === "bid") {
      if (!(s.turn === 0 && !auto)) return;
      act.append(btn("dz-bid0", "不叫", "alt", () => doBid(0, 0)));
      for (let v = 1; v <= 3; v++) act.append(btn(`dz-bid${v}`, `${v}分`, "", () => doBid(0, v), v <= s.high));
      return;
    }
    const mine = myTurn();
    const can = mine && L.canPass(s, 0);
    act.append(
      btn("dz-pass", "不出", "alt", onPass, !can),
      btn("dz-clear", "重选", "alt", onClear, !mine || !sel.size),
      btn("dz-hint", "提示", "alt", onHint, !mine),
      btn("dz-play", "出牌", "", onPlay, !mine || !sel.size),
    );
  }
  function renderStatus(): void {
    let m = pendingMsg;
    if (!m) {
      if (!started) m = "";
      else if (s.phase === "over") m = "";
      else if (auto) m = "托管中。";
      else if (s.turn === 0) m = s.phase === "bid" ? "请叫分。" : s.table && s.table.by !== 0 ? "请出牌或选择不出。" : "请出牌。";
      else m = s.turn === 1 ? "小兔思考中…" : "小猫思考中…";
    }
    msgEl.textContent = m;
  }
  function renderHud(): void {
    baseEl.textContent = s.high > 0 ? `底分：${s.high}` : "底分：-";
    multEl.textContent = `倍数：×${L.multiplier(s)}`;
    bestEl.textContent = `最高：${best()}`;
    levelBtn.textContent = level === 1 ? "难度：简单" : level === 2 ? "难度：普通" : "难度：较难";
    autoBtn.textContent = auto ? "托管：开" : "托管：关";
    autoBtn.classList.toggle("on", auto);
  }
  function render(): void {
    layout();
    zoneCw = measureZone();
    stage.style.setProperty("--zcw", `${zoneCw}px`);
    renderHud(); renderPanels(); renderBottom(); renderZones(); renderHand(); renderAct(); renderStatus();
  }
  function measureZone(): number {
    const zw = zones[0].el.clientWidth || 120;
    const zh = zones[0].el.clientHeight || 60;
    const mw = zones[1].el.clientWidth || zw;
    const byW = Math.min(zw, mw) / 6.5;
    const byH = (Math.min(zh, zones[1].el.clientHeight || zh) - 6) / 1.4;
    return Math.max(22, Math.min(62, Math.floor(Math.min(byW, byH))));
  }

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (s) render(); }); }) : null;
  let raf = 0;
  ro?.observe(stage);

  // ---- test hooks
  const w = window as unknown as Win;
  w.__dz = {
    state: () => ({ phase: s.phase, turn: s.turn, started, landlord: s.landlord, high: s.high, bids: s.bids.slice(), hands: s.hands.map((x) => x.slice()), bottom: s.bottom.slice(), table: s.table ? { by: s.table.by, combo: s.table.combo, cards: s.table.cards.slice() } : null, last: s.last.map((l) => (l === "pass" ? "pass" : l ? l.cards.slice() : null)), bombs: s.bombs, plays: s.plays.slice(), winner: s.winner, spring: s.spring, moves: s.moves, sel: [...sel], auto, level, dealt, over: overShown, handStep, handCw, zoneCw }),
    seed: (n: number) => { nextSeed = n; },
    redeal: (n?: number) => { if (n !== undefined) nextSeed = n; reset(); },
    /** replace the state (a test sets up a position); missing fields keep their value */
    load: (p: Partial<L.DZState>) => { clearTimeout(timer); timer = 0; Object.assign(s, p); sel.clear(); started = true; ovl.hidden = true; overShown = false; render(); proceed(); },
    freeze: () => { clearTimeout(timer); timer = 0; },
    ai: () => { clearTimeout(timer); timer = 0; aiStep(); },
    setLevel: (l: number) => { level = l as L.Level; render(); },
    pending: () => timer !== 0,
    hold: (on: boolean) => { hold = on; if (!on) proceed(); },
  };

  reset();
  const lateLayout = window.setTimeout(() => { if (s) render(); }, 60);

  return () => {
    clearTimeout(timer); clearTimeout(lateLayout); timers.forEach((t) => clearTimeout(t));
    cancelAnimationFrame(raf); ro?.disconnect();
    window.removeEventListener("keydown", onKey);
    delete w.__dz;
  };
}
