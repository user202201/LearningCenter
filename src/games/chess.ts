/** 国际象棋 / Chess: cartoon pieces, sliding moves, funny capture / check / mate animations, a computer opponent with four levels (see chess-logic.ts). */
import type { GameCtx } from "./ctx";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { pieceSVG } from "./chess-art";
import type { PieceType, Mood } from "./chess-art";
import { Searcher, LEVELS, VALUE, outcomeOf } from "./chess-logic";
import type { Level, Outcome } from "./chess-logic";
import "./chess.css";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="24" fill="#fdf1d3" stroke="#0ca678" stroke-width="5"/><g fill="#63c9b0"><rect x="8" y="60" width="26" height="26"/><rect x="60" y="60" width="26" height="26"/><rect x="34" y="34" width="26" height="26"/><rect x="86" y="34" width="26" height="26"/><rect x="8" y="86" width="26" height="26" opacity="0"/></g><g stroke-linejoin="round" stroke-linecap="round"><path d="M30 98 Q30 90 40 90 H80 Q90 90 90 98 Q90 104 80 104 H40 Q30 104 30 98Z" fill="#ffd43b" stroke="#5b4670" stroke-width="4"/><path d="M38 91 Q38 62 60 52 Q82 62 82 91Z" fill="#fff3d2" stroke="#5b4670" stroke-width="4.5"/><path d="M36 58 L28 24 L46 42 L60 16 L74 42 L92 24 L84 58Z" fill="#fff3d2" stroke="#5b4670" stroke-width="4.5"/><circle cx="28" cy="22" r="6" fill="#ff8fab" stroke="#5b4670" stroke-width="3.5"/><circle cx="60" cy="14" r="6.5" fill="#ff8fab" stroke="#5b4670" stroke-width="3.5"/><circle cx="92" cy="22" r="6" fill="#ff8fab" stroke="#5b4670" stroke-width="3.5"/></g><circle cx="50" cy="72" r="6.5" fill="#fff" stroke="#2b2236" stroke-width="2.2"/><circle cx="70" cy="72" r="6.5" fill="#fff" stroke="#2b2236" stroke-width="2.2"/><circle cx="51" cy="73" r="3.2" fill="#2b2236"/><circle cx="71" cy="73" r="3.2" fill="#2b2236"/><ellipse cx="43" cy="82" rx="4.5" ry="3" fill="#ff7f9e" opacity=".8"/><ellipse cx="77" cy="82" rx="4.5" ry="3" fill="#ff7f9e" opacity=".8"/><path d="M55 82 Q60 88 65 82" fill="none" stroke="#2b2236" stroke-width="2.6" stroke-linecap="round"/></svg>`;

type Color = "w" | "b";
interface Piece { type: PieceType; color: Color; el: HTMLElement; inner: HTMLElement }
interface Rec { w: number; d: number; l: number }
const FILES = "abcdefgh";
const CHARS: Record<string, string> = { p: "p", n: "n", b: "b", r: "r", q: "q" };
void CHARS;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  // ---------- state ----------
  let game = new Chess();
  let mode: "cpu" | "two" = ctx.store.get<string>("mode", "cpu") === "two" ? "two" : "cpu";
  let side: Color = ctx.store.get<string>("side", "w") === "b" ? "b" : "w";
  let level: Level = Math.max(0, Math.min(3, ctx.store.get("level", 1))) as Level;
  let flipped = mode === "cpu" && side === "b";
  let selected: string | null = null;
  let legal: Move[] = [];
  let last: { from: string; to: string } | null = null;
  let hintMove: { from: string; to: string } | null = null;
  let over: Outcome = null;
  let thinking = false, hinting = false;
  let msg = "";
  let token = 0;
  let checkPiece: Piece | null = null;
  const pieces = new Map<string, Piece>();
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const clearTimers = () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  let disposed = false;

  // ---------- DOM ----------
  const status = h("div", { class: "chess-status", id: "chess-status" });
  const mkTray = (cls: string) => h("div", { class: `chess-tray ${cls}`, id: `chess-tray-${cls}` });
  const trayTop = mkTray("top"), trayBottom = mkTray("bottom");
  const board = h("div", { class: "chess-board", id: "chess-board" });
  const piecesLayer = h("div", { class: "chess-pieces" });
  const fx = h("div", { class: "chess-fx", id: "chess-fx" });
  const wrap = h("div", { class: "chess-boardwrap" }, board, piecesLayer, fx);
  const mkBtn = (label: string, id: string, fn: () => void) => h("button", { class: "chess-btn", id, type: "button", onclick: fn }, label);
  const bNew = mkBtn("新局", "chess-new", () => openNew());
  const bUndo = mkBtn("悔棋", "chess-undo", () => undo());
  const bHint = mkBtn("提示", "chess-hint", () => hint());
  const bFlip = mkBtn("翻转", "chess-flip", () => { flipped = !flipped; fullRedraw(); ctx.sfx("tap"); });
  const ctl = h("div", { class: "chess-ctl" }, bNew, bUndo, bHint, bFlip);
  const main = h("div", { class: "chess-main" }, status, trayTop, wrap, trayBottom, ctl);
  const area = h("div", { class: "chess-root" }, main);
  root.append(area);
  const sqEls: HTMLElement[] = [];
  for (let i = 0; i < 64; i++) { const s = h("div", { class: "chess-sq" }); sqEls.push(s); board.append(s); }

  // ---------- geometry ----------
  const sqAt = (col: number, row: number) => `${FILES[flipped ? 7 - col : col]}${flipped ? row + 1 : 8 - row}`;
  const colRow = (sq: string) => { const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1; return flipped ? { col: 7 - f, row: r } : { col: f, row: 7 - r }; };
  const place = (el: HTMLElement, sq: string) => { const { col, row } = colRow(sq); el.style.transform = `translate(${col * 100}%, ${row * 100}%)`; el.dataset.sq = sq; };
  const bs = () => board.clientWidth || 300;

  function layout() {
    const W = area.clientWidth, H = area.clientHeight;
    if (!W || !H) return;
    const land = W >= 520 && W > H * 1.25;
    main.classList.toggle("chess-land", land);
    let S: number;
    if (land) S = Math.min(H - 4, W - 200);
    else {
      main.style.setProperty("--S", `${Math.min(W, H)}px`);
      const others = status.offsetHeight + trayTop.offsetHeight + trayBottom.offsetHeight + ctl.offsetHeight + 4 * 5 + 2;
      S = Math.min(W - 2, H - others);
    }
    S = Math.max(160, Math.floor(S / 8) * 8);
    main.style.setProperty("--S", `${S}px`);
    // re-measure once: the trays / status may wrap at the final width
    if (!land) { const others = status.offsetHeight + trayTop.offsetHeight + trayBottom.offsetHeight + ctl.offsetHeight + 4 * 5 + 2; if (S + others > H) { S = Math.max(160, Math.floor((H - others) / 8) * 8); main.style.setProperty("--S", `${S}px`); } }
  }

  // ---------- drawing ----------
  const mkPiece = (type: PieceType, color: Color): Piece => {
    const inner = h("div", { class: "chess-pc-in" });
    inner.innerHTML = pieceSVG(type, color);
    const el = h("div", { class: "chess-pc", "data-p": color + type }, inner);
    return { type, color, el, inner };
  };
  const setMood = (p: Piece, mood: Mood) => { p.inner.innerHTML = pieceSVG(p.type, p.color, mood); };

  function syncPieces() {
    pieces.clear(); piecesLayer.textContent = "";
    game.board().forEach((rank, r) => rank.forEach((c, f) => {
      if (!c) return;
      const sq = `${FILES[f]}${8 - r}`, p = mkPiece(c.type as PieceType, c.color);
      place(p.el, sq); piecesLayer.append(p.el); pieces.set(sq, p);
    }));
    checkPiece = null;
  }

  const kingSq = (c: Color): string | null => { for (const [sq, p] of pieces) if (p.type === "k" && p.color === c) return sq; return null; };

  function paint() {
    const inChk = !over || over.kind === "mate" ? game.inCheck() : false;
    const ksq = inChk ? kingSq(game.turn()) : null;
    for (let i = 0; i < 64; i++) {
      const row = i >> 3, col = i & 7, sq = sqAt(col, row), el = sqEls[i];
      const cls = ["chess-sq"];
      if ((row + col) % 2 === 1) cls.push("dark");
      if (last && (sq === last.from || sq === last.to)) cls.push("last");
      if (sq === selected) cls.push("sel");
      if (hintMove && (sq === hintMove.from || sq === hintMove.to)) cls.push("hint");
      if (sq === ksq) cls.push("incheck");
      el.className = cls.join(" "); el.dataset.sq = sq;
      let html = "";
      if (row === 7) html += `<span class="chess-co f">${sq[0]}</span>`;
      if (col === 0) html += `<span class="chess-co r">${sq[1]}</span>`;
      const mv = legal.find((m) => m.to === sq);
      if (mv) html += `<i class="chess-dot${mv.captured ? " cap" : ""}"></i>`;
      el.innerHTML = html;
    }
    piecesLayer.querySelectorAll(".chess-pc-in.selected").forEach((e) => e.classList.remove("selected"));
    if (selected) pieces.get(selected)?.inner.classList.add("selected");
  }

  function fullRedraw() {
    syncPieces(); paint(); trays(); updateStatus();
    if (checkPiece === null && !over && game.inCheck()) { const k = pieces.get(kingSq(game.turn()) ?? ""); if (k) { checkPiece = k; setMood(k, "scared"); k.inner.classList.add("chess-check"); } }
    if (over) endLook(false);
  }

  function trays() {
    const caps: Record<Color, string[]> = { w: [], b: [] };   // pieces CAPTURED BY white / black
    for (const m of game.history({ verbose: true })) if (m.captured) caps[m.color].push(m.captured);
    const val = (c: Color) => caps[c].reduce((a, t) => a + VALUE[t], 0);
    const render = (el: HTMLElement, c: Color, label: string) => {
      const mine = caps[c].slice().sort((a, b) => VALUE[b] - VALUE[a]);
      const adv = Math.round((val(c) - val(c === "w" ? "b" : "w")) / 100);
      el.textContent = "";
      const list = h("span", { class: "chess-caps" });
      for (const t of mine) { const i = h("i"); i.innerHTML = pieceSVG(t as PieceType, c === "w" ? "b" : "w"); list.append(i); }
      el.append(h("b", {}, label), list, h("span", { class: "chess-adv" }, adv > 0 ? `+${adv}` : ""));
    };
    const bottom: Color = flipped ? "b" : "w", topC: Color = bottom === "w" ? "b" : "w";
    const name = (c: Color) => (mode === "cpu" ? (c === side ? "玩家" : "电脑") : c === "w" ? "白方" : "黑方");
    render(trayBottom, bottom, name(bottom)); render(trayTop, topC, name(topC));
  }

  function resultText(o: NonNullable<Outcome>): { title: string; sub: string } {
    if (o.kind === "mate") {
      if (mode === "cpu") return o.winner === side ? { title: "你赢啦！", sub: "将杀！你真棒！" } : { title: "电脑赢了", sub: "再试试，下一局一定行！" };
      return { title: o.winner === "w" ? "白方获胜！" : "黑方获胜！", sub: "将杀！" };
    }
    const sub = o.kind === "stalemate" ? "逼和：无子可动" : o.kind === "threefold" ? "三次重复局面" : o.kind === "fifty" ? "五十步没有吃子" : "双方子力不足";
    return { title: "和棋", sub };
  }

  function updateStatus() {
    status.className = "chess-status";
    let t: string;
    if (over) { const r = resultText(over); t = r.title; }
    else if (thinking) { t = "电脑思考中…"; status.classList.add("think"); }
    else if (hinting) { t = "思考中…"; status.classList.add("think"); }
    else {
      const turn = mode === "cpu" ? "轮到你了" : game.turn() === "w" ? "轮到白方" : "轮到黑方";
      if (game.inCheck()) { t = "将军！"; status.classList.add("warn"); }
      else t = msg || turn;
    }
    status.textContent = t;
    bUndo.disabled = game.history().length === 0;
    layout();
  }

  // ---------- effects ----------
  const center = (sq: string) => { const { col, row } = colRow(sq); return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 }; };
  const addFx = (el: HTMLElement, ms: number) => { fx.append(el); later(() => el.remove(), ms); return el; };
  const STAR = `<svg viewBox="-50 -50 100 100"><polygon points="0,-48 11,-17 44,-26 24,2 48,26 14,25 6,48 -8,24 -40,36 -26,6 -48,-14 -14,-18" fill="#ffd43b" stroke="#e8590c" stroke-width="5" stroke-linejoin="round"/><text x="0" y="9" font-size="25" font-weight="900" text-anchor="middle" fill="#e03131" stroke="#fff" stroke-width="4" paint-order="stroke" font-family="Arial Black, Arial, sans-serif">POW!</text></svg>`;

  function captureFx(mv: Move, att: Piece, victim: Piece, capSq: string) {
    att.el.classList.add("cap"); att.inner.classList.add(`atk-${mv.piece}`);
    later(() => { att.el.classList.remove("cap"); att.inner.classList.remove(`atk-${mv.piece}`); }, 700);
    const a = colRow(mv.from), b = colRow(mv.to);
    let dx = b.col - a.col, dy = b.row - a.row; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    victim.el.classList.add("gone");
    victim.inner.style.setProperty("--fx", `${dx * 360}%`); victim.inner.style.setProperty("--fy", `${dy * 360 - 30}%`);
    victim.inner.classList.add("victim");
    later(() => victim.el.remove(), 1300);
    const c = center(capSq);
    const pow = h("div", { class: "chess-pow", style: `left:${c.x}%;top:${c.y}%` }); pow.innerHTML = STAR; addFx(pow, 1100);
    const px = bs() / 8;
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + Math.random() * 0.5, r = px * (0.9 + Math.random() * 0.8);
      const s = h("span", { class: "chess-star", style: `left:${c.x}%;top:${c.y}%;--sx:${Math.cos(ang) * r}px;--sy:${Math.sin(ang) * r}px;animation-delay:${0.25 + Math.random() * 0.1}s;animation-fill-mode:both` }, i % 2 ? "★" : "✦");
      addFx(s, 1300);
    }
  }

  function animateMove(mv: Move) {
    const p = pieces.get(mv.from);
    if (!p) { fullRedraw(); return; }
    pieces.delete(mv.from);
    const capSq = mv.flags.includes("e") ? mv.to[0] + mv.from[1] : mv.to;
    const victim = mv.captured ? pieces.get(capSq) : undefined;
    if (victim) pieces.delete(capSq);
    if (mv.flags.includes("k") || mv.flags.includes("q")) {
      const rk = mv.from[1], [rf, rt] = mv.flags.includes("k") ? ["h", "f"] : ["a", "d"];
      const rook = pieces.get(rf + rk);
      if (rook) { pieces.delete(rf + rk); place(rook.el, rt + rk); pieces.set(rt + rk, rook); rook.el.classList.add("moving"); later(() => rook.el.classList.remove("moving"), 450); }
    }
    p.el.classList.add("moving"); later(() => p.el.classList.remove("moving"), 600);
    place(p.el, mv.to); pieces.set(mv.to, p);
    if (mv.promotion) later(() => { p.type = mv.promotion as PieceType; setMood(p, "normal"); p.el.dataset.p = p.color + p.type; }, 260);
    if (victim) captureFx(mv, p, victim, capSq);
  }

  function showCheck(kc: Color) {
    const sq = kingSq(kc); const k = sq ? pieces.get(sq) : undefined;
    if (!sq || !k) return;
    checkPiece = k; setMood(k, "scared"); k.inner.classList.add("chess-check");
    const c = center(sq);
    const low = colRow(sq).row < 2;
    const bub = h("div", { class: "chess-bubble" + (low ? " below" : ""), id: "chess-bubble", style: `left:${c.x}%;top:${c.y + (low ? 10 : -6)}%` }, "将军！");
    addFx(bub, 2000);
    const sw = h("div", { class: "chess-sweat chess-sweat-1", style: `left:${c.x + 3}%;top:${c.y - 9}%` }); sw.innerHTML = `<svg viewBox="0 0 20 28"><path d="M10 2 Q2 14 3 19 Q4 26 10 26 Q16 26 17 19 Q18 14 10 2Z" fill="#74c0fc" stroke="#1971c2" stroke-width="2.4"/></svg>`;
    fx.append(sw);   // removed by clearCheck
  }
  function clearCheck() {
    fx.querySelectorAll(".chess-sweat, .chess-bubble").forEach((e) => e.remove());
    if (checkPiece) { checkPiece.inner.classList.remove("chess-check"); setMood(checkPiece, "normal"); checkPiece = null; }
  }

  function endLook(animate: boolean) {
    // checkmate: the loser's king is dizzy, the winner's pieces cheer; draws: nothing special
    if (!over || over.kind !== "mate") return;
    const loser: Color = over.winner === "w" ? "b" : "w";
    const ks = kingSq(loser);
    let i = 0;
    for (const [sq, p] of pieces) {
      if (p.color === over.winner) { setMood(p, "happy"); p.inner.classList.add("chess-cheer"); p.inner.style.setProperty("--d", `${(i++ % 8) * 0.09}s`); }
      else if (sq === ks) { setMood(p, "dizzy"); p.inner.classList.add("chess-dizzy"); const c = center(sq); const lw = colRow(sq).row < 2; const st = h("div", { class: "chess-bubble" + (lw ? " below" : ""), style: `left:${c.x}%;top:${c.y + (lw ? 10 : -6)}%;border-color:#7048e8;color:#7048e8;box-shadow:0 3px 0 #5f3dc4` }, "★ ✦ ★"); addFx(st, 1900); }
    }
    if (animate) {
      const cf = h("div", { class: "chess-confetti", id: "chess-confetti" });
      const colors = ["#ff6b6b", "#ffd43b", "#51cf66", "#339af0", "#cc5de8", "#ff922b"];
      for (let k = 0; k < 44; k++) cf.append(h("span", { style: `left:${Math.random() * 100}%;background:${colors[k % 6]};animation-delay:${Math.random() * 2.4}s;animation-duration:${2 + Math.random() * 1.6}s` }));
      wrap.append(cf); later(() => cf.remove(), 7000);
    }
  }

  // ---------- the game flow ----------
  const rec = (): Rec => ctx.store.get<Rec>(`rec${level}`, { w: 0, d: 0, l: 0 });

  function finish(o: NonNullable<Outcome>) {
    over = o; thinking = false; hinting = false; selected = null; legal = []; hintMove = null;
    paint(); endLook(true); updateStatus();
    const r = resultText(o);
    if (mode === "cpu") {
      const x = rec();
      if (o.kind === "mate") { if (o.winner === side) x.w++; else x.l++; } else x.d++;
      ctx.store.set(`rec${level}`, x);
    }
    const won = o.kind === "mate" && (mode === "two" || o.winner === side), lost = o.kind === "mate" && !won;
    later(() => ctx.sfx(won ? "win" : lost ? "lose" : "good"), 300);
    later(() => showResult(r, o, won), o.kind === "mate" ? 1500 : 700);
  }

  function play(from: string, to: string, promo?: string) {
    let mv: Move;
    try { mv = game.move({ from, to, promotion: promo }); } catch { return false; }
    token++; thinking = false; hinting = false; msg = "";
    clearCheck(); hintMove = null; selected = null; legal = []; last = { from: mv.from, to: mv.to };
    animateMove(mv);
    const o = outcomeOf(game);
    ctx.sfx(mv.captured ? "capture" : mv.promotion ? "good" : "move");
    if (!o && game.inCheck()) { showCheck(game.turn()); later(() => ctx.sfx("check"), mv.captured ? 260 : 60); }
    paint(); trays();
    if (o) finish(o);
    else { updateStatus(); maybeAI(); }
    return true;
  }

  function maybeAI() {
    if (over || mode !== "cpu" || game.turn() === side) return;
    const my = token;
    thinking = true; updateStatus();
    later(() => {
      if (my !== token) return;
      const s = new Searcher(game.fen(), level);
      const tick = () => {
        if (my !== token || disposed) return;
        if (s.step(14)) {
          thinking = false;
          const m = s.best;
          if (m) play(m.from, m.to, m.promotion);
        } else later(tick, 0);
      };
      tick();
    }, 480);
  }

  function hint() {
    if (over) return;
    if (thinking || (mode === "cpu" && game.turn() !== side)) { ctx.toast("还没轮到你"); return; }
    if (hinting) return;
    hinting = true; hintMove = null; msg = ""; updateStatus(); paint();
    const my = token, s = new Searcher(game.fen(), 3, { ms: 700 });
    const tick = () => {
      if (my !== token || disposed) return;
      if (s.step(14)) {
        hinting = false;
        if (s.best) { hintMove = { from: s.best.from, to: s.best.to }; msg = "提示：试试这一步"; ctx.sfx("good"); }
        paint(); updateStatus();
      } else later(tick, 0);
    };
    later(tick, 30);
  }

  function undo() {
    const n = game.history().length;
    if (!n) { ctx.toast("没有可以悔的棋"); return; }
    token++; thinking = false; hinting = false;
    if (mode === "cpu") { do game.undo(); while (game.history().length > 0 && game.turn() !== side); }
    else game.undo();
    over = null; msg = ""; selected = null; legal = []; hintMove = null;
    const hist = game.history({ verbose: true }), lm = hist[hist.length - 1];
    last = lm ? { from: lm.from, to: lm.to } : null;
    closeCover(); wrap.querySelector(".chess-confetti")?.remove();
    fullRedraw(); ctx.sfx("tap");
    maybeAI();
  }

  function newGame() {
    token++; clearTimers(); thinking = false; hinting = false;
    game = new Chess(); over = null; msg = ""; selected = null; legal = []; last = null; hintMove = null;
    flipped = mode === "cpu" && side === "b";
    closeCover(); fx.textContent = ""; wrap.querySelector(".chess-confetti")?.remove();
    fullRedraw(); maybeAI();
  }

  // ---------- dialogs ----------
  function closeCover() { wrap.querySelectorAll(".chess-cover").forEach((e) => e.remove()); }
  const cover = (card: HTMLElement) => { closeCover(); const c = h("div", { class: "chess-cover" }, card); wrap.append(c); return c; };

  function showResult(r: { title: string; sub: string }, o: NonNullable<Outcome>, won: boolean) {
    if (disposed || over !== o) return;
    const hero = h("div", { class: "chess-hero" });
    hero.innerHTML = pieceSVG(won ? "k" : "p", won ? (o.kind === "mate" ? o.winner : "w") : o.kind === "mate" ? o.winner : "w", o.kind === "mate" ? "happy" : "normal");
    const stats = mode === "cpu" ? (() => { const x = rec(); return h("p", {}, `战绩：${x.w}胜 ${x.d}和 ${x.l}负`); })() : null;
    cover(h("div", { class: "chess-card", id: "chess-result" }, hero, h("h3", {}, r.title), h("p", {}, r.sub), stats,
      h("div", { class: "chess-row" },
        h("button", { class: "chess-btn big on", id: "chess-again", type: "button", onclick: () => { newGame(); } }, "再来一局"),
        h("button", { class: "chess-btn big", id: "chess-look", type: "button", onclick: () => closeCover() }, "看看棋盘"))));
  }

  function openNew() {
    let m = mode, s = side, l = level;
    const card = h("div", { class: "chess-card", id: "chess-newcard" });
    const draw = () => {
      card.textContent = "";
      const chip = (txt: string, on: boolean, id: string, fn: () => void) => h("button", { class: "chess-btn" + (on ? " on" : ""), id, type: "button", onclick: () => { fn(); ctx.sfx("tap"); draw(); } }, txt);
      const x = ctx.store.get<Rec>(`rec${l}`, { w: 0, d: 0, l: 0 });
      const kids = [h("h3", {}, "新的一局"),
        h("div", { class: "chess-lbl" }, "对手"), h("div", { class: "chess-row" }, chip("电脑", m === "cpu", "chess-m-cpu", () => (m = "cpu")), chip("双人", m === "two", "chess-m-two", () => (m = "two"))),
        m === "cpu" ? h("div", { class: "chess-lbl" }, "我执") : null,
        m === "cpu" ? h("div", { class: "chess-row" }, chip("白棋", s === "w", "chess-s-w", () => (s = "w")), chip("黑棋", s === "b", "chess-s-b", () => (s = "b"))) : null,
        m === "cpu" ? h("div", { class: "chess-lbl" }, "难度") : null,
        m === "cpu" ? h("div", { class: "chess-row" }, ...LEVELS.map((L, i) => chip(L.name, l === i, `chess-l-${i}`, () => (l = i as Level)))) : null,
        m === "cpu" ? h("p", {}, `战绩：${x.w}胜 ${x.d}和 ${x.l}负`) : null,
        h("div", { class: "chess-row" },
          h("button", { class: "chess-btn big on", id: "chess-start", type: "button", onclick: () => { mode = m; side = s; level = l; ctx.store.set("mode", m); ctx.store.set("side", s); ctx.store.set("level", l); newGame(); ctx.sfx("good"); } }, "开始"),
          h("button", { class: "chess-btn big", id: "chess-cancel", type: "button", onclick: () => closeCover() }, "取消"))];
      for (const k of kids) if (k) card.append(k);
    };
    draw(); cover(card); ctx.sfx("tap");
  }

  function askPromotion(from: string, to: string, color: Color) {
    const names: [string, string][] = [["q", "皇后"], ["r", "战车"], ["b", "主教"], ["n", "骑士"]];
    const grid = h("div", { class: "chess-promo" }, ...names.map(([t, n]) => {
      const b = h("button", { class: "chess-btn", type: "button", "data-promo": t, onclick: () => { closeCover(); play(from, to, t); } }, h("span", {}), n);
      b.firstElementChild!.innerHTML = pieceSVG(t as PieceType, color);
      return b;
    }));
    cover(h("div", { class: "chess-card", id: "chess-promo" }, h("h3", {}, "升变成什么？"), grid, h("button", { class: "chess-btn", id: "chess-promo-cancel", type: "button", onclick: () => { closeCover(); selected = null; legal = []; paint(); } }, "取消")));
  }

  // ---------- input: tap, tap / drag (pointer events) ----------
  let drag: { sq: string; piece: Piece; id: number; x0: number; y0: number; moved: boolean; wasSel: boolean } | null = null;
  const sqFromEvent = (e: PointerEvent): string | null => {
    const r = board.getBoundingClientRect(), x0 = r.left + board.clientLeft, y0 = r.top + board.clientTop, w = board.clientWidth;
    const col = Math.floor(((e.clientX - x0) / w) * 8), row = Math.floor(((e.clientY - y0) / w) * 8);
    return col < 0 || col > 7 || row < 0 || row > 7 ? null : sqAt(col, row);
  };
  const humanTurn = () => !over && !thinking && !wrap.querySelector(".chess-cover") && (mode === "two" || game.turn() === side);

  function tryMove(from: string, to: string): boolean {
    const ms = legal.length && selected === from ? legal.filter((m) => m.to === to) : game.moves({ square: from as never, verbose: true }).filter((m) => m.to === to);
    if (!ms.length) return false;
    if (ms[0].promotion) { askPromotion(from, to, game.turn()); return true; }
    play(from, to); return true;
  }
  function select(sq: string | null) {
    selected = sq; hintMove = null;
    legal = sq ? game.moves({ square: sq as never, verbose: true }) : [];
    if (sq) { ctx.sfx("tap"); msg = ""; }
    paint();
  }

  board.addEventListener("pointerdown", (e) => {
    if (!humanTurn() || drag) return;
    const sq = sqFromEvent(e); if (!sq) return;
    const p = pieces.get(sq);
    if (p && p.color === game.turn()) {
      const wasSel = selected === sq;
      if (!wasSel) select(sq);
      drag = { sq, piece: p, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, wasSel };
      try { board.setPointerCapture(e.pointerId); } catch { /* synthetic events have no capture */ }
    } else if (selected && legal.some((m) => m.to === sq)) { tryMove(selected, sq); }
    else if (selected) select(null);
  });
  board.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
    drag.moved = true;
    const r = board.getBoundingClientRect(), px = board.clientWidth / 8;
    drag.piece.el.classList.add("drag");
    drag.piece.el.style.transform = `translate(${e.clientX - r.left - board.clientLeft - px / 2}px, ${e.clientY - r.top - board.clientTop - px * 0.7}px) scale(1.12)`;
  });
  const endDrag = (e: PointerEvent, cancel: boolean) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    try { board.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    d.piece.el.classList.remove("drag");
    if (d.moved) {
      const to = cancel ? null : sqFromEvent(e);
      if (to && to !== d.sq && legal.some((m) => m.to === to)) {
        // the piece is already under the finger: no slide from the old square
        d.piece.el.classList.add("drag"); place(d.piece.el, to); d.piece.el.getBoundingClientRect(); d.piece.el.classList.remove("drag");
        const from = d.sq; place(d.piece.el, from);
        tryMove(from, to);
      } else place(d.piece.el, d.sq);
    } else if (d.wasSel) select(null);
  };
  board.addEventListener("pointerup", (e) => endDrag(e, false));
  board.addEventListener("pointercancel", (e) => endDrag(e, true));

  // ---------- go ----------
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(area);
  const onResize = () => layout();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  // a small hook for the tests (positions and state): nothing here is needed to play
  (window as unknown as { __chess: unknown }).__chess = {
    fen: () => game.fen(), turn: () => game.turn(), busy: () => thinking || hinting, over: () => over, level: () => level, side: () => side, mode: () => mode,
    setFen: (fen: string) => { token++; clearTimers(); game = new Chess(fen); over = null; selected = null; legal = []; last = null; hintMove = null; thinking = false; closeCover(); fx.textContent = ""; fullRedraw(); maybeAI(); },
  };
  fullRedraw(); layout(); requestAnimationFrame(() => { if (!disposed) layout(); });
  maybeAI();
  return () => {
    disposed = true; token++; clearTimers(); ro?.disconnect();
    window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize);
    delete (window as unknown as { __chess?: unknown }).__chess;
  };
}
