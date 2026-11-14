/** 跑得快 (Run Fast): three players, 16 cards each, the first to empty the hand wins. Rules and the computer player: paodekuai-logic.ts. */
import "./paodekuai.css";
import type { GameCtx } from "./ctx";
import * as L from "./paodekuai-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#d3f9d8"/>
<g stroke="#3b2f2f" stroke-width="4" stroke-linejoin="round"><rect x="14" y="34" width="38" height="56" rx="9" fill="#fff8e1" transform="rotate(-18 33 62)"/><rect x="40" y="26" width="38" height="56" rx="9" fill="#fff8e1" transform="rotate(-3 59 54)"/><rect x="66" y="32" width="38" height="56" rx="9" fill="#fff8e1" transform="rotate(14 85 60)"/></g>
<path d="M85 78c-9-6-12-11-12-16 0-4 3-6 6-6 3 0 5 2 6 4 1-2 3-4 6-4 3 0 6 2 6 6 0 5-3 10-12 16z" fill="#f03e3e" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round" transform="rotate(14 85 60)"/>
<g transform="rotate(14 85 60)"><circle cx="81" cy="64" r="2.6" fill="#fff"/><circle cx="89" cy="64" r="2.6" fill="#fff"/><circle cx="81" cy="65" r="1.3" fill="#3b2f2f"/><circle cx="89" cy="65" r="1.3" fill="#3b2f2f"/><path d="M82 69q3 3 6 0" fill="none" stroke="#3b2f2f" stroke-width="1.8" stroke-linecap="round"/></g>
<path d="M59 36l11 13-11 13-11-13z" fill="#343a40" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round" transform="rotate(-3 59 54)"/>
<g transform="rotate(-3 59 54)"><circle cx="55" cy="47" r="2.6" fill="#fff"/><circle cx="63" cy="47" r="2.6" fill="#fff"/><circle cx="55" cy="48" r="1.3" fill="#3b2f2f"/><circle cx="63" cy="48" r="1.3" fill="#3b2f2f"/><path d="M56 52q3 3 6 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>
<path d="M28 98l22 8" stroke="#12b886" stroke-width="5" stroke-linecap="round"/><path d="M16 104l12-4M20 92l14 2" stroke="#12b886" stroke-width="4" stroke-linecap="round"/></svg>`;

const DARK = "#3b2f2f";
const FACE = [{ ey: 21, my: 26 }, { ey: 18, my: 23 }, { ey: 15, my: 21 }, { ey: 21, my: 27 }];
/** suit pictures: shapes (diamond, club, heart, spade) AND colour (red / black), with a small face on the big copies; suit numbers of paodekuai-logic: 0 diamonds, 1 clubs, 2 hearts, 3 spades */
function suitSvg(suit: number, face: boolean): string {
  const shape = [1, 0, 2, 3][suit];   // freecell's drawing order: 0 club, 1 diamond, 2 heart, 3 spade
  const red = suit === 0 || suit === 2;
  const fill = red ? "#f03e3e" : "#495057";
  let body: string;
  if (shape === 0) {
    const shapes = `<circle cx="20" cy="12" r="8.5"/><circle cx="10.5" cy="25" r="8.5"/><circle cx="29.5" cy="25" r="8.5"/><path d="M17 24h6l3 13H14z"/>`;
    body = `<g fill="${DARK}" stroke="${DARK}" stroke-width="6" stroke-linejoin="round">${shapes}</g><g fill="${fill}">${shapes}</g>`;
  } else {
    const d = shape === 1 ? "M20 2.5 36.5 20 20 37.5 3.5 20z"
      : shape === 2 ? "M20 35C6 25 3 17.5 3 12 3 7 7 3.5 11.5 3.5 15 3.5 18 5.5 20 9.5 22 5.5 25 3.5 28.5 3.5 33 3.5 37 7 37 12 37 17.5 34 25 20 35z"
        : "M20 3C14 12 3.5 17 3.5 25.5 3.5 30.5 7.5 33.5 12 33.5 15 33.5 17 32 18 30 18 34 16 36.5 13 37.5H27C24 36.5 22 34 22 30 23 32 25 33.5 28 33.5 32.5 33.5 36.5 30.5 36.5 25.5 36.5 17 26 12 20 3z";
    body = `<path d="${d}" fill="${fill}" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  let f = "";
  if (face) {
    const { ey, my } = FACE[shape];
    f = `<circle cx="14.5" cy="${ey}" r="3.4" fill="#fff"/><circle cx="25.5" cy="${ey}" r="3.4" fill="#fff"/><circle cx="15" cy="${ey + 0.6}" r="1.7" fill="${DARK}"/><circle cx="26" cy="${ey + 0.6}" r="1.7" fill="${DARK}"/><path d="M16 ${my}q4 4.2 8 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${body}${f}</svg>`;
}
const SUIT_SMALL = [0, 1, 2, 3].map((s) => suitSvg(s, false));
const SUIT_BIG = [0, 1, 2, 3].map((s) => suitSvg(s, true));

/** round cartoon faces of the two computer players: 0 bear (right), 1 rabbit (left); mood: 0 normal, 1 happy, 2 sad, 3 worried */
function avatar(kind: number, mood: number): string {
  const fur = kind === 0 ? "#e0a458" : "#fff", dark = kind === 0 ? "#a96a2a" : "#f783ac";
  const ears = kind === 0
    ? `<circle cx="11" cy="11" r="8" fill="${fur}" stroke="${DARK}" stroke-width="2.5"/><circle cx="37" cy="11" r="8" fill="${fur}" stroke="${DARK}" stroke-width="2.5"/><circle cx="11" cy="11" r="4" fill="${dark}"/><circle cx="37" cy="11" r="4" fill="${dark}"/>`
    : `<ellipse cx="16" cy="8" rx="5.5" ry="11" fill="${fur}" stroke="${DARK}" stroke-width="2.5"/><ellipse cx="32" cy="8" rx="5.5" ry="11" fill="${fur}" stroke="${DARK}" stroke-width="2.5"/><ellipse cx="16" cy="9" rx="2.5" ry="7" fill="${dark}"/><ellipse cx="32" cy="9" rx="2.5" ry="7" fill="${dark}"/>`;
  const mouth = mood === 1 ? `<path d="M18 31q6 7 12 0z" fill="#c92a2a" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`
    : mood === 2 ? `<path d="M18 35q6-6 12 0" fill="none" stroke="${DARK}" stroke-width="2.5" stroke-linecap="round"/>`
      : mood === 3 ? `<ellipse cx="24" cy="33" rx="3" ry="3.6" fill="#c92a2a" stroke="${DARK}" stroke-width="2"/>`
        : `<path d="M18 32q6 5 12 0" fill="none" stroke="${DARK}" stroke-width="2.5" stroke-linecap="round"/>`;
  const eyes = mood === 2 ? `<path d="M14 24l6 3M34 24l-6 3" stroke="${DARK}" stroke-width="2.5" stroke-linecap="round"/>`
    : `<circle cx="17" cy="25" r="3.4" fill="#fff" stroke="${DARK}" stroke-width="1.6"/><circle cx="31" cy="25" r="3.4" fill="#fff" stroke="${DARK}" stroke-width="1.6"/><circle cx="17.6" cy="25.4" r="1.8" fill="${DARK}"/><circle cx="31.6" cy="25.4" r="1.8" fill="${DARK}"/>`;
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${ears}<circle cx="24" cy="28" r="17" fill="${fur}" stroke="${DARK}" stroke-width="2.5"/><circle cx="12" cy="31" r="3" fill="#ffa8a8" opacity=".7"/><circle cx="36" cy="31" r="3" fill="#ffa8a8" opacity=".7"/>${eyes}${mouth}</svg>`;
}

const NAMES = ["", "小熊", "小兔"];   // seats: 0 me (bottom), 1 right, 2 left (the order of play is 0 -> 1 -> 2)
const LEVELS = ["简单", "普通", "较难"];
const TAGS: Record<string, string> = { pair: "对子", straight: "顺子", pairs: "连对", bomb: "炸弹" };
const tagOf = (c: L.Combo): string => c.type === "triple" ? (c.k > 1 ? "飞机" : c.n === 5 ? "三带二" : c.n === 4 ? "三带一" : "三张") : TAGS[c.type] ?? "";
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
type Phase = "ready" | "play" | "over";

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const timers = new Set<number>();
  const later = (f: () => void, ms: number): number => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); return id; };
  let level = clamp(ctx.store.get<number>("level", 1), 0, 2) as L.Level;
  const best = () => ctx.store.get<number>("best", 0);
  const totals = [0, 0, 0];
  let delay = 750;
  let g!: L.Game, phase: Phase = "ready", seedNo = 1;
  let selected = new Set<number>(), cur = 0, hintI = 0, hintKey = "", cw = 40, lefts: number[] = [];
  let rng: L.Rng = L.mulberry(1);
  const cardEls = new Map<number, HTMLElement>();

  // ---- screen
  const scoreEls = [0, 1, 2].map((i) => h("span", { class: "pdk-stat", id: `pdk-score${i}` }, ""));
  const bestEl = h("span", { class: "pdk-stat best", id: "pdk-best" }, "");
  const levelBtn = h("button", { class: "mopt", id: "pdk-level", onclick: () => { level = ((level + 1) % 3) as L.Level; ctx.store.set("level", level); ctx.sfx("tap"); refreshHud(); } }, "");
  const rulesBtn = h("button", { class: "mopt", id: "pdk-rules", onclick: () => { ctx.sfx("tap"); showRules(true); } }, "规则");
  const hud = h("div", { class: "pdk-hud" }, scoreEls[0], scoreEls[2], scoreEls[1], bestEl, levelBtn, rulesBtn);

  const badge = (i: number) => {
    const face = h("span", { class: "pdk-face" }), n = h("b", { id: `pdk-n${i}` }, "");
    const back = h("i", { class: "pdk-backcard" });
    const el = h("div", { class: `pdk-badge s${i}`, id: `pdk-b${i}` }, face, h("div", { class: "pdk-who" }, h("span", { class: "pdk-name" }, NAMES[i]), h("span", { class: "pdk-count" }, back, n)));
    return { el, face, n };
  };
  const bR = badge(1), bL = badge(2);
  const lanes = [0, 1, 2].map((i) => h("div", { class: `pdk-lane s${i}`, id: `pdk-t${i}` }));
  const table = h("div", { class: "pdk-table" }, lanes[2], lanes[1], lanes[0]);
  const msg = h("div", { class: "pdk-msg", id: "pdk-msg" }, "");
  const hand = h("div", { class: "pdk-hand", id: "pdk-hand" });
  const title = h("h2", {}, ""), line = h("p", {}, ""), startBtn = h("button", { class: "primary", id: "pdk-start", onclick: () => { ctx.sfx("tap"); startGame(); } }, "开始");
  const ovl = h("div", { class: "pdk-ovl", id: "pdk-ovl" }, title, line, startBtn);
  const rulesBox = h("div", { class: "pdk-rulesbox" }, ...[
    "每人 16 张牌，共 48 张：去掉大小王、方块 2、梅花 2、红桃 2 和黑桃 A。",
    "牌的大小：3 最小，其次 4 至 K、A，2 最大。",
    "持有方块 3 的人先出，第一手必须包含方块 3。",
    "牌型：单张、对子、顺子（5 张以上）、连对（2 对以上）、三带二、飞机（2 组以上的三张）、炸弹（四张相同）。",
    "后手须出同类型、同张数且更大的牌；有牌可压必须出（炸弹除外），否则选择不出。炸弹可压任何牌型。",
    "下家只剩 1 张牌时，出单张必须出最大的。最后一手牌可以少带牌。",
    "先出完手牌者获胜。其余每张剩牌扣 1 分，整局一张未出加倍，出现炸弹再加倍。",
  ].map((t) => h("p", {}, t)));
  const rulesOvl = h("div", { class: "pdk-ovl rules", id: "pdk-rules-ovl", hidden: true }, h("h2", {}, "规则"), rulesBox, h("button", { class: "primary", id: "pdk-rules-close", onclick: () => { ctx.sfx("tap"); showRules(false); } }, "关闭"));
  const field = h("div", { class: "pdk-field", id: "pdk-field" }, h("div", { class: "pdk-badges" }, bL.el, bR.el), table, msg, hand, ovl, rulesOvl);
  const mkBtn = (id: string, cls: string, text: string, fn: () => void) => h("button", { class: `pdk-act ${cls}`, id, onclick: (e: Event) => { (e.currentTarget as HTMLElement).blur(); fn(); } }, text);   // (the focus goes back to the game keys)
  const resetBtn = mkBtn("pdk-reset", "alt", "重选", () => { ctx.sfx("tap"); clearSel(); });
  const hintBtn = mkBtn("pdk-hint", "alt", "提示", () => hint());
  const passBtn = mkBtn("pdk-pass", "alt", "不出", () => doPass());
  const playBtn = mkBtn("pdk-play", "main", "出牌", () => doPlay());
  const btns = h("div", { class: "pdk-btns" }, resetBtn, hintBtn, passBtn, playBtn);
  root.append(h("div", { class: "pdk-wrap" }, hud, field, btns));

  // ---- cards
  function cardEl(id: number, w: number): HTMLElement {
    const r = L.rankOf(id), s = L.suitOf(id), red = s === 0 || s === 2;
    const e = h("div", { class: `pdk-card ${red ? "red" : "blk"}`, "data-id": id, "data-rank": L.RANK_LABELS[r], "data-suit": s, style: `--cw:${w}px` });
    e.innerHTML = `<div class="pdk-in"><div class="pdk-top"><span>${L.RANK_LABELS[r]}</span>${SUIT_SMALL[s]}</div><div class="pdk-big">${SUIT_BIG[s]}</div></div>`;
    return e;
  }
  const faceOf = (i: number, mood: number) => { (i === 1 ? bR : bL).face.innerHTML = avatar(i === 1 ? 0 : 1, mood); };

  // ---- layout and drawing
  function layout() {
    const fw = field.clientWidth, fh = field.clientHeight;
    if (!fw || !fh) return;
    const byW = hand.clientWidth - 12 - 14 * (L.HAND - 1), byH = (fh * (fw > fh * 1.4 ? 0.31 : 0.36)) / 1.75;
    cw = Math.round(clamp(Math.min(byW, byH, 84), 30, 84));
    field.style.setProperty("--hh", `${Math.round(cw * 1.4 * 1.3) + 4}px`);
    drawHand(); drawTable();
  }
  function drawHand() {
    const cards = g ? g.hands[0] : [];
    const n = cards.length, W = hand.clientWidth, ch = cw * 1.4;
    const step = n > 1 ? Math.min((W - 12 - cw) / (n - 1), cw * 0.72) : 0, x0 = (W - (cw + step * Math.max(0, n - 1))) / 2;
    lefts = cards.map((_, i) => x0 + step * i);
    const keep = new Set(cards);
    for (const [id, el] of cardEls) if (!keep.has(id)) { el.remove(); cardEls.delete(id); }
    cards.forEach((id, i) => {
      let el = cardEls.get(id);
      if (!el) { el = cardEl(id, cw); cardEls.set(id, el); hand.append(el); }
      el.style.setProperty("--cw", `${cw}px`);
      const sel = selected.has(id);
      el.classList.toggle("sel", sel); el.classList.toggle("cur", i === cur && phase === "play");
      el.style.transform = `translate(${lefts[i]}px, ${sel ? ch * 0.04 : ch * 0.3}px)`;
      el.style.zIndex = String(i + 1);
    });
  }
  function drawTable() {
    for (let i = 0; i < 3; i++) {
      const lane = lanes[i], sh = g?.shown[i] ?? null;
      lane.replaceChildren();
      lane.classList.toggle("pass", sh === "pass");
      if (!sh) continue;
      if (sh === "pass") { lane.append(h("span", { class: "pdk-pass" }, "不出")); continue; }
      const W = lane.clientWidth, H = lane.clientHeight, n = sh.cards.length, t0 = tagOf(sh.combo);
      const tw = Math.round(clamp((H - 6) / 1.4, 20, clamp(cw * 1.1, 56, 90)));
      const cramped = (H - tw * 1.4) / 2 < 24 && !!t0, res = cramped ? 56 : 0;   // a short lane: the name of the combination gets its own place at the left
      const step = n > 1 ? Math.min((W - res - tw - 4) / (n - 1), tw * 0.72) : 0;
      const x0 = res + (W - res - (tw + step * (n - 1))) / 2, y0 = Math.max(0, (H - tw * 1.4) / 2);
      sh.cards.forEach((c, k) => {
        const e = cardEl(c, tw); e.classList.add("mini");
        e.style.transform = `translate(${x0 + step * k}px, ${y0}px)`; e.style.zIndex = String(k + 1); e.style.animationDelay = `${k * 25}ms`;
        lane.append(e);
      });
      if (t0) lane.append(h("span", { class: `pdk-tag${sh.combo.type === "bomb" ? " bomb" : ""}${cramped ? " mid" : ""}` }, t0));
    }
  }
  function refreshHud() {
    scoreEls[0].textContent = `我：${totals[0]}`; scoreEls[1].textContent = `小熊：${totals[1]}`; scoreEls[2].textContent = `小兔：${totals[2]}`;
    bestEl.textContent = `最高：${best()}`;
    levelBtn.textContent = `难度：${LEVELS[level]}`;
  }
  function refresh() {
    if (!g) return;
    for (const i of [1, 2]) {
      const n = g.hands[i].length;
      (i === 1 ? bR : bL).n.textContent = n === 1 && phase === "play" ? "只剩一张！" : `${n} 张`;
      (i === 1 ? bR : bL).el.classList.toggle("turn", phase === "play" && g.turn === i);
      (i === 1 ? bR : bL).el.classList.toggle("one", n === 1 && phase === "play");
      if (phase === "play") faceOf(i, n === 1 ? 3 : 0);
    }
    const mine = phase === "play" && g.turn === 0 && g.winner < 0;
    field.classList.toggle("mine", mine);
    playBtn.disabled = !mine || selected.size === 0;
    passBtn.disabled = !(mine && L.canPass(g, 0));
    hintBtn.disabled = !mine;
    resetBtn.disabled = selected.size === 0;
    drawHand(); drawTable();
  }
  const say = (t: string, bad = false) => { msg.textContent = t; msg.classList.toggle("bad", bad); };
  const turnMsg = () => {
    if (phase !== "play") return;
    if (g.turn === 0) say(g.firstPlay ? "你持有方块 3，请先出牌，必须包含方块 3。" : g.table ? "轮到你出牌。" : "轮到你出牌，可任选牌型。");
    else say(g.turn === 1 ? "小熊出牌中。" : "小兔出牌中。");
  };

  // ---- game flow
  function startGame() {
    const sd = (window as unknown as { __pdkSeed?: number }).__pdkSeed;
    rng = L.mulberry(sd ?? ((Date.now() ^ (seedNo++ * 7919)) >>> 0));
    g = L.newGame(rng); phase = "play"; selected = new Set(); cur = 0; hintKey = ""; hintI = 0;
    for (const el of cardEls.values()) el.remove(); cardEls.clear();
    ovl.hidden = true; rulesOvl.hidden = true;
    faceOf(1, 0); faceOf(2, 0);
    ctx.sfx("drop");
    refresh(); layout(); turnMsg(); refreshHud();
    hand.classList.add("deal"); later(() => hand.classList.remove("deal"), 700);
    schedule();
  }
  function schedule() {
    if (phase !== "play") return;
    if (g.turn !== 0) later(aiMove, delay);
    else { cur = clamp(cur, 0, g.hands[0].length - 1); }
  }
  function aiMove() {
    if (phase !== "play" || g.turn === 0) return;
    const p = g.turn, m = L.aiChoose(g, p, level, rng);
    if (m) act(p, m); else { L.pass(g, p); ctx.sfx("tap"); afterMove(); }
  }
  function act(p: number, cards: number[]) {
    const r = L.play(g, p, cards);
    if (!r.ok) return false;
    const bomb = r.combo!.type === "bomb";
    ctx.sfx(bomb ? "capture" : "place");
    if (bomb) { field.classList.add("boom"); later(() => field.classList.remove("boom"), 450); }
    afterMove(true);
    return true;
  }
  function afterMove(played = false) {
    selected = new Set([...selected].filter((c) => g.hands[0].includes(c)));
    if (g.winner >= 0) { refresh(); finish(); return; }
    if (!played || g.turn === 0) hintKey = "";
    refresh();
    turnMsg();
    schedule();
  }
  function finish() {
    phase = "over";
    const d = L.scoreGame(g); for (let i = 0; i < 3; i++) totals[i] += d[i];
    const win = g.winner === 0, sc = d[0], old = best(), rec = win && sc > old;
    if (rec) ctx.store.set("best", sc);
    ctx.store.set("games", ctx.store.get<number>("games", 0) + 1);
    if (win) ctx.store.set("wins", ctx.store.get<number>("wins", 0) + 1);
    ctx.sfx(win ? "win" : "lose");
    for (const i of [1, 2]) faceOf(i, g.winner === i ? 1 : 2);
    field.classList.remove("mine"); field.classList.toggle("won", win);
    refreshHud(); say("");
    later(() => {
      if (phase !== "over") return;
      title.textContent = win ? "你赢了。" : g.winner === 1 ? "小熊赢了。" : "小兔赢了。";
      line.textContent = rec ? `新纪录：${sc}` : `本局得分：${sc > 0 ? `+${sc}` : sc}`;
      startBtn.textContent = "再来一局"; ovl.hidden = false; ovl.classList.toggle("win", win);
    }, delay > 100 ? 800 : 0);
  }
  function doPlay() {
    if (phase !== "play" || g.turn !== 0) return;
    const cards = [...selected];
    if (!cards.length) return;
    const r = L.check(g, 0, cards);
    if (!r.ok) {
      ctx.sfx("bad");
      const t = r.why === "first" ? "第一手必须包含方块 3。" : r.why === "cannotbeat" ? "所选的牌压不过上一手。" : r.why === "biggest" ? "下家只剩一张牌，出单张必须出最大的。" : "牌型不符，请重新选择。";
      say(t, true);
      for (const id of selected) { const e = cardEls.get(id); if (e) { e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); } }
      return;
    }
    selected = new Set(); act(0, cards);
  }
  function doPass() {
    if (phase !== "play" || g.turn !== 0) return;
    if (!L.canPass(g, 0)) { ctx.sfx("bad"); say(g.table ? "有牌可压，必须出牌。" : "你先出牌，不能选择不出。", true); return; }
    L.pass(g, 0); selected = new Set(); ctx.sfx("tap"); afterMove();
  }
  function clearSel() { selected = new Set(); drawHand(); refresh(); }
  function hint() {
    if (phase !== "play" || g.turn !== 0) return;
    const plays = L.legalPlays(g, 0);
    if (!plays.length) { ctx.sfx("bad"); say(g.table ? "没有能压过的牌，请选择不出。" : "", true); return; }
    plays.sort((a, b) => (a.combo.type === "bomb" ? 1 : 0) - (b.combo.type === "bomb" ? 1 : 0) || a.combo.rank * 4 - a.combo.n * 3 - (b.combo.rank * 4 - b.combo.n * 3));
    const key = `${g.turn}|${g.table?.cards.join(",") ?? "-"}|${g.hands[0].length}`;
    if (key !== hintKey) { hintKey = key; hintI = 0; } else hintI = (hintI + 1) % plays.length;
    selected = new Set(plays[hintI].cards); ctx.sfx("tap"); refresh(); say("轮到你出牌。");
  }
  function showRules(on: boolean) { rulesOvl.hidden = !on; if (on) (root.querySelector("#pdk-rules-close") as HTMLElement | null)?.focus(); }

  // ---- input: tap a card, or drag across cards to select several
  let drag: { id: number; from: number; mode: boolean; base: Set<number>; moved: boolean } | null = null;
  const idxAt = (clientX: number): number => {
    const n = g?.hands[0].length ?? 0; if (!n) return -1;
    const x = clientX - hand.getBoundingClientRect().left;
    if (x < lefts[0] - 2 || x > lefts[n - 1] + cw + 2) return -1;
    let k = 0; for (let i = 0; i < n; i++) if (lefts[i] <= x) k = i;
    return k;
  };
  const applyRange = (a: number, b: number) => {
    if (!drag) return;
    const lo = Math.min(a, b), hi = Math.max(a, b), s = new Set(drag.base);
    g.hands[0].forEach((id, i) => { if (i >= lo && i <= hi) { if (drag!.mode) s.add(id); else s.delete(id); } });
    selected = s; refresh();
  };
  const onDown = (e: PointerEvent) => {
    if (phase !== "play" || drag) return;
    const i = idxAt(e.clientX); if (i < 0) return;
    const id = g.hands[0][i];
    drag = { id: e.pointerId, from: i, mode: !selected.has(id), base: new Set(selected), moved: false };
    cur = i; try { hand.setPointerCapture(e.pointerId); } catch { /* ok */ }
    applyRange(i, i); ctx.sfx("tap");
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const i = idxAt(e.clientX); if (i < 0) return;
    if (i !== drag.from) drag.moved = true;
    cur = i; applyRange(drag.from, i);
  };
  const onUp = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) drag = null; };
  hand.addEventListener("pointerdown", onDown); hand.addEventListener("pointermove", onMove); hand.addEventListener("pointerup", onUp); hand.addEventListener("pointercancel", onUp);

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = e.target instanceof HTMLButtonElement;
    if (!rulesOvl.hidden) { if (e.key === "Escape" || (e.key === "Enter" && !onButton)) { e.preventDefault(); showRules(false); } return; }
    if (phase !== "play") {
      if ((e.key === "Enter" || e.key === " ") && !onButton) { e.preventDefault(); startGame(); }
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
      e.preventDefault(); field.classList.add("kb"); const n = g.hands[0].length;
      cur = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : clamp(cur + (e.key === "ArrowRight" ? 1 : -1), 0, n - 1); drawHand(); return;
    }
    if (e.key === " " && !onButton) { e.preventDefault(); const id = g.hands[0][cur]; if (id !== undefined) { if (selected.has(id)) selected.delete(id); else selected.add(id); ctx.sfx("tap"); refresh(); } return; }
    if (e.key === "Enter" && !onButton) { e.preventDefault(); doPlay(); return; }
    if (e.key === "p" || e.key === "P") { e.preventDefault(); doPass(); return; }
    if (e.key === "h" || e.key === "H") { e.preventDefault(); hint(); return; }
    if (e.key === "r" || e.key === "R" || e.key === "Escape") { e.preventDefault(); clearSel(); }
  };
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(field);

  // ---- start screen
  g = L.newGame(L.mulberry(1));
  g.shown = [null, null, null];
  const idle = () => { title.textContent = "跑得快"; line.textContent = "先出完手牌者获胜。点击开始。"; startBtn.textContent = "开始"; ovl.hidden = false; };
  for (const i of [1, 2]) { (i === 1 ? bR : bL).n.textContent = `${L.HAND} 张`; faceOf(i, 0); }
  g.hands = [[], [], []];
  idle(); refreshHud(); layout();
  playBtn.disabled = passBtn.disabled = hintBtn.disabled = resetBtn.disabled = true;
  (window as unknown as Record<string, unknown>).__pdk = {
    game: () => g, phase: () => phase, fast: (on: boolean) => { delay = on ? 0 : 750; }, refresh, layout, selected: () => [...selected], cw: () => cw, level: () => level,
    totals: () => totals.slice(), setPhase: (p: Phase) => { phase = p; }, ai: () => aiMove(), schedule, start: startGame,
  };
  return () => {
    timers.forEach(clearTimeout); timers.clear(); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__pdk;
  };
}
