/**
 * 中国象棋 (Xiangqi) against the computer. Rules and search: xiangqi-logic.ts (pure code); drawings: xiangqi-art.ts; look: xiangqi.css.
 * The screen: a cartoon bamboo board with round wooden pieces (cute faces), tap-tap or drag moves, legal-move dots, last-move frame, hint, undo,
 * captured pieces, and cartoon scenes for a capture (cannon ball / galloping horse / rushing chariot), a check (sweating general) and a checkmate (dizzy general, confetti).
 * Test hook: window.__xq.
 */
import "./xiangqi.css";
import type { GameCtx } from "./ctx";
import * as L from "./xiangqi-logic";
import { pieceSvg, boardSvg, powSvg, ICON as ART_ICON } from "./xiangqi-art";

export const ICON = ART_ICON;

interface Rec { m: number; cap: number; mover: number }
const KIND_NAME = ["", "general", "advisor", "elephant", "horse", "chariot", "cannon", "soldier"];
const PAD = 0.7; // board units between the frame and the first line

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => !!mq?.matches;
  let dead = false;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
  const sleep = (ms: number) => new Promise<void>((res) => { later(res, ms); });

  // ---------- state ----------
  let pos = L.startPosition();
  let human: L.Side = ctx.store.get<number>("side", 1) === -1 ? L.BLACK : L.RED;
  let level = Math.min(3, Math.max(0, ctx.store.get<number>("level", 1)));
  let history: Rec[] = [];
  let sel = -1;
  let targets: number[] = [];
  let hintMove = 0;
  let busy = false;      // an animation is running
  let thinking = false;  // the computer is searching
  let over = false;
  let epoch = 0;         // changes on restart / undo: stale async work stops
  let U = 30;
  let shown = new Set<number>();

  // ---------- screen ----------
  const wrap = h("div", { class: "xq-wrap", id: "xq-wrap" });
  const status = h("div", { class: "xq-status", id: "xq-status" });
  const rec = h("span", { class: "xq-rec", id: "xq-rec" });
  const tray = h("div", { class: "xq-tray", id: "xq-tray" });
  const board = h("div", { class: "xq-board", id: "xq-board" });
  board.innerHTML = boardSvg();
  const marks = h("div", { class: "xq-layer", id: "xq-marks" });
  const fxl = h("div", { class: "xq-fxl", id: "xq-fx" });
  board.append(marks, fxl);
  const boxEl = h("div", { class: "xq-boardbox" }, board);
  const btnHint = h("button", { class: "xq-btn xq-go", id: "xq-hint", onclick: () => void hint() }, "提示");
  const btnUndo = h("button", { class: "xq-btn", id: "xq-undo", onclick: () => undo() }, "悔棋");
  const btnNew = h("button", { class: "xq-btn", id: "xq-new", onclick: () => restart("新的一局开始了") }, "重来");
  const levelSel = h("select", { class: "xq-select", id: "xq-level", "aria-label": "难度", onchange: () => setLevel(Number(levelSel.value) as L.LevelId) });
  const sideSel = h("select", { class: "xq-select", id: "xq-sidesel", "aria-label": "执子", onchange: () => setSide(Number(sideSel.value) === -1 ? L.BLACK : L.RED) });
  levelSel.append(...L.LEVELS.map((l) => h("option", { value: String(l.id) }, l.name)));
  sideSel.append(h("option", { value: "1" }, "我执红"), h("option", { value: "-1" }, "我执黑"));
  const refreshChips = () => { levelSel.value = String(level); sideSel.value = String(human); };
  wrap.append(
    h("div", { class: "xq-top" }, h("div", { class: "xq-head" }, status, rec), tray),
    h("div", { class: "xq-play" }, boxEl),
    h("div", { class: "xq-bottom" }, h("div", { class: "xq-ctl" }, btnHint, btnUndo, btnNew), h("div", { class: "xq-opts" }, levelSel, sideSel)),
  );
  root.append(wrap);

  // ---------- coordinates ----------
  const flip = () => human === L.BLACK;
  const vcol = (c: number) => (flip() ? 8 - c : c);
  const vrow = (r: number) => (flip() ? 9 - r : r);
  const bx = (s: number) => PAD + vcol(L.colOf(s));
  const by = (s: number) => PAD + vrow(L.rowOf(s));
  const setXY = (el: HTMLElement, s: number) => { el.style.setProperty("--x", String(bx(s))); el.style.setProperty("--y", String(by(s))); el.dataset.sq = String(s); };
  const setUV = (el: HTMLElement, x: number, y: number) => { el.style.setProperty("--x", x.toFixed(3)); el.style.setProperty("--y", y.toFixed(3)); };
  /** the board point under a pointer (or -1) */
  const squareAt = (e: PointerEvent): number => {
    const r = board.getBoundingClientRect();
    const fx = (e.clientX - r.left - board.clientLeft) / U - PAD, fy = (e.clientY - r.top - board.clientTop) / U - PAD;
    const c = Math.round(fx), rr = Math.round(fy);
    if (Math.abs(fx - c) > 0.62 || Math.abs(fy - rr) > 0.62 || c < 0 || c > 8 || rr < 0 || rr > 9) return -1;
    return L.sq(flip() ? 9 - rr : rr, flip() ? 8 - c : c);
  };
  const land = typeof window.matchMedia === "function" ? window.matchMedia("(orientation: landscape) and (max-height: 560px)") : null;
  const fit = () => {
    const r = boxEl.getBoundingClientRect();
    if (r.height < 10) return;
    if (land?.matches) {
      // board + side panel are centred together
      const availW = Math.max(120, root.clientWidth - 232);
      U = Math.max(12, Math.min((availW - 6) / 10.1, (r.height - 6) / 11.4));
      wrap.style.maxWidth = Math.ceil(U * 10.1 + 224) + "px";
    } else {
      if (r.width < 10) return;
      U = Math.max(12, Math.min((r.width - 6) / 10.1, (r.height - 6) / 11.4));
      wrap.style.maxWidth = "";
    }
    wrap.style.setProperty("--u", U.toFixed(2) + "px");
  };

  // ---------- pieces ----------
  const els = new Map<number, HTMLElement>();
  const makePiece = (s: number): HTMLElement => {
    const p = pos.b[s];
    const inner = h("div", { class: "xq-pi" });
    inner.innerHTML = pieceSvg(p);
    const el = h("div", { class: "xq-p", "data-piece": (p > 0 ? "r" : "b") + KIND_NAME[Math.abs(p)], "data-side": p > 0 ? "r" : "b" }, inner);
    setXY(el, s);
    return el;
  };
  const rebuild = () => {
    for (const el of els.values()) el.remove();
    els.clear();
    fxl.replaceChildren();
    for (let s = 0; s < 90; s++) if (pos.b[s]) { const el = makePiece(s); els.set(s, el); board.insertBefore(el, fxl); }
  };
  const clearStates = () => {
    for (const el of els.values()) {
      el.classList.remove("xq-scared", "xq-dizzy", "xq-fallen", "xq-cheer", "xq-sel", "xq-drag", "xq-top");
      el.querySelectorAll(".xq-ring, .xq-stars").forEach((x) => x.remove());
    }
    wrap.dataset.check = "";
  };
  const addMark = (cls: string, s: number, id?: string) => {
    const el = h("div", { class: "xq-sqmark " + cls, "data-sq": String(s), id });
    setUV(el, bx(s), by(s));
    marks.append(el);
    return el;
  };
  const drawMarks = () => {
    marks.replaceChildren();
    const last = history[history.length - 1];
    if (last) { addMark("xq-last", L.fromOf(last.m)); addMark("xq-last", L.toOf(last.m)); }
    if (hintMove) { addMark("xq-hint", L.fromOf(hintMove)); addMark("xq-hint", L.toOf(hintMove)); }
    for (const t of targets) addMark("xq-dot" + (pos.b[t] ? " xq-cap" : ""), t);
    for (const [s, el] of els) el.classList.toggle("xq-sel", s === sel);
  };
  const relayout = () => { for (const [s, el] of els) setXY(el, s); drawMarks(); };

  // ---------- texts ----------
  const setStatus = (text: string, cls = "") => { status.className = "xq-status" + (cls ? " " + cls : ""); status.replaceChildren(text); status.dataset.state = cls || "ok"; };
  const showRecord = () => {
    const w = ctx.store.get<number>("wins", 0), l = ctx.store.get<number>("losses", 0), d = ctx.store.get<number>("draws", 0);
    rec.textContent = w + l + d ? `战绩：胜 ${w} 负 ${l} 和 ${d}` : "";
  };
  const sideName = (s: L.Side) => (s === L.RED ? "红方" : "黑方");
  const refreshStatus = () => {
    if (over) return;
    if (thinking) { setStatus("电脑在想", "xq-think xq-dots"); return; }
    const chk = L.inCheck(pos, pos.turn);
    if (pos.turn === human) setStatus(chk ? "你被将军了，快想办法！" : `轮到你了（${sideName(human)}）`, chk ? "xq-chk" : "");
    else setStatus(chk ? "电脑被将军了！" : "电脑走棋", chk ? "xq-chk" : "xq-think");
  };
  const renderTray = (animateLast = false) => {
    const caps = history.filter((r) => r.cap).map((r) => r.cap);
    caps.sort((a, b) => b * human - a * human || Math.abs(b) - Math.abs(a));
    tray.replaceChildren(h("span", { class: "xq-lab" }, "吃掉的子"));
    caps.forEach((p, i) => {
      const m = h("span", { class: "xq-mini" + (animateLast && i === caps.length - 1 ? " xq-new" : ""), "data-piece": (p > 0 ? "r" : "b") + KIND_NAME[Math.abs(p)] });
      m.innerHTML = pieceSvg(p);
      tray.append(m);
    });
    if (!caps.length) tray.append(h("span", { class: "xq-lab" }, "还没有"));
  };

  // ---------- effects ----------
  const spawn = (cls: string, x: number, y: number, html = ""): HTMLElement => {
    const el = h("div", { class: "xq-fx " + cls });
    setUV(el, x, y);
    if (html) el.innerHTML = html;
    fxl.append(el);
    return el;
  };
  const dropLater = (el: HTMLElement, ms: number) => later(() => el.remove(), ms);
  const stars = (x: number, y: number, n = 7) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = 1 + Math.random() * 1.2;
      const el = spawn("xq-star", x, y, i % 2 ? "★" : "✦");
      el.style.color = ["#ffd43b", "#ff922b", "#ff6b6b", "#74c0fc"][i % 4];
      el.style.setProperty("--px", (Math.cos(a) * d).toFixed(2));
      el.style.setProperty("--py", (Math.sin(a) * d).toFixed(2));
      dropLater(el, 800);
    }
  };
  const pow = (x: number, y: number) => { const el = spawn("xq-pow", x, y, powSvg()); dropLater(el, 700); };
  const puffs = (x: number, y: number) => {
    for (let i = 0; i < 6; i++) {
      const el = spawn("xq-puff", x, y);
      const a = Math.PI + (i / 5) * Math.PI * 1.0 - Math.PI * 0.0;
      el.style.setProperty("--px", (Math.cos(a) * 1.1 * (0.6 + Math.random() * 0.6)).toFixed(2));
      el.style.setProperty("--py", (Math.sin(a) * 0.6 - 0.1).toFixed(2));
      dropLater(el, 650);
    }
  };
  const flyAway = (el: HTMLElement, dx: number, dy: number) => {
    el.style.setProperty("--fx", String(dx * 3 + (Math.random() - 0.5) * 2));
    el.style.setProperty("--fy", String(dy * 3 - 2 + (Math.random() - 0.5) * 2));
    el.classList.remove("xq-squash");
    el.classList.add("xq-fly");
    dropLater(el, 760);
  };
  const shakeBoard = () => { wrap.classList.add("xq-shake"); later(() => wrap.classList.remove("xq-shake"), 320); };

  /** slides the piece; a capture plays a little scene that fits the capturing piece. Resolves when the scene is over. */
  async function animateMove(el: HTMLElement, vel: HTMLElement | undefined, f: number, t: number, mover: number, ep: number): Promise<void> {
    const kind = Math.abs(mover);
    const tx = bx(t), ty = by(t), fxp = bx(f), fyp = by(f);
    const dx = Math.sign(tx - fxp), dy = Math.sign(ty - fyp);
    wrap.dataset.anim = vel ? "capture-" + KIND_NAME[kind] : "move";
    if (vel) wrap.classList.add("xq-capturing");
    const done = () => { el.classList.remove("xq-top", "xq-fast", "xq-slow", "xq-gallop", "xq-rush", "xq-recoil"); wrap.classList.remove("xq-capturing"); };
    if (reduced()) {
      setXY(el, t);
      vel?.remove();
      if (vel) ctx.sfx("capture"); else ctx.sfx("move");
      done();
      return;
    }
    el.classList.add("xq-top");
    if (!vel) {
      ctx.sfx("move");
      setXY(el, t);
      await sleep(300);
      done();
      return;
    }
    if (kind === L.C) {
      el.classList.add("xq-recoil");
      ctx.sfx("tap");
      await sleep(160);
      if (ep !== epoch) return;
      const ball = spawn("xq-ball", fxp, fyp);
      void ball.offsetWidth;
      setUV(ball, tx, ty);
      await sleep(280);
      ball.remove();
      pow(tx, ty); stars(tx, ty);
      ctx.sfx("capture"); shakeBoard();
      flyAway(vel, dx, dy);
      await sleep(380);
      if (ep !== epoch) return;
      setXY(el, t);
      await sleep(280);
    } else if (kind === L.H) {
      el.classList.add("xq-gallop", "xq-slow");
      setXY(el, t);
      await sleep(520);
      if (ep !== epoch) return;
      puffs(tx, ty); ctx.sfx("capture");
      vel.classList.add("xq-squash");
      await sleep(200);
      stars(tx, ty, 5);
      flyAway(vel, dx || 1, dy);
      await sleep(360);
    } else if (kind === L.R) {
      el.classList.add("xq-fast", "xq-rush");
      for (let i = 1; i <= 3; i++) {
        const sp = spawn("xq-speed", fxp + (tx - fxp) * (i * 0.12), fyp + (ty - fyp) * (i * 0.12));
        if (dy !== 0) sp.style.transform = `translate(calc(var(--u) * var(--x)), calc(var(--u) * var(--y))) rotate(90deg)`;
        sp.style.setProperty("--px", String(-dx * 0.8)); sp.style.setProperty("--py", String(-dy * 0.8));
        dropLater(sp, 500);
      }
      setXY(el, t);
      await sleep(210);
      if (ep !== epoch) return;
      ctx.sfx("capture"); shakeBoard();
      pow(tx, ty); stars(tx, ty, 6);
      vel.classList.add("xq-bonk");
      vel.style.setProperty("--fx", String(dx * 4 + (Math.random() - 0.5)));
      vel.style.setProperty("--fy", String(dy * 4 - 1.5));
      dropLater(vel, 700);
      await sleep(420);
    } else {
      setXY(el, t);
      await sleep(240);
      if (ep !== epoch) return;
      ctx.sfx("capture"); stars(tx, ty, 6);
      flyAway(vel, dx, dy);
      await sleep(360);
    }
    done();
  }

  // ---------- the flow of a game ----------
  function clearSelection() { sel = -1; targets = []; }
  function afterMove(animateTray = true) {
    if (dead) return;
    clearStates();
    renderTray(animateTray);
    drawMarks();
    const st = L.status(pos);
    busy = false;
    if (st.state === "play") {
      if (st.check) showCheck(pos.turn);
      refreshStatus();
      updateButtons();
      if (pos.turn !== human) void think();
    } else finish(st);
    updateButtons();
  }

  async function play(m: number) {
    const ep = epoch;
    busy = true; hintMove = 0; clearSelection();
    const f = L.fromOf(m), t = L.toOf(m), mover = pos.b[f];
    const el = els.get(f)!, vel = els.get(t);
    const cap = L.make(pos, m);
    history.push({ m, cap, mover });
    els.delete(f); els.delete(t); els.set(t, el);
    clearStates();
    el.dataset.sq = String(t);
    drawMarks();
    updateButtons();
    await animateMove(el, vel, f, t, mover, ep);
    if (ep !== epoch) return;
    vel?.remove();
    afterMove(true);
  }

  function showCheck(side: L.Side) {
    const k = pos.ks[L.sideIdx(side)];
    const el = els.get(k);
    if (!el) return;
    el.classList.add("xq-scared");
    el.append(h("div", { class: "xq-ring" }));
    const b = spawn("xq-bubble", bx(k), by(k), "");
    b.append(h("b", { id: "xq-check-bubble" }, "将军！"));
    dropLater(b, 1700);
    ctx.sfx("check");
    wrap.dataset.check = side === L.RED ? "red" : "black";
  }

  function finish(st: ReturnType<typeof L.status>) {
    over = true; thinking = false;
    wrap.dataset.check = "";
    const draw = st.state === "draw";
    const humanWon = !draw && st.loser !== human;
    const key = draw ? "draws" : humanWon ? "wins" : "losses";
    ctx.store.set(key, ctx.store.get<number>(key, 0) + 1);
    if (humanWon) {
      const best = ctx.store.get<number>("bestLevel", -1);
      if (level > best) ctx.store.set("bestLevel", level);
    }
    showRecord();
    ctx.sfx(draw ? "tap" : humanWon ? "win" : "lose");
    if (!draw) {
      const loserSide = st.loser!;
      const g = els.get(pos.ks[L.sideIdx(loserSide)]);
      if (g) {
        g.classList.add("xq-dizzy", "xq-top");
        const sp = h("div", { class: "xq-stars" }, "★ ✦ ★");
        g.append(sp);
        later(() => { g.classList.remove("xq-dizzy"); g.classList.add("xq-fallen"); sp.remove(); }, reduced() ? 0 : 1000);
      }
      for (const [, el] of els) if (el.dataset.side === (loserSide === L.RED ? "b" : "r")) el.classList.add("xq-cheer");
      setStatus(humanWon ? "你赢了！" : "电脑赢了", humanWon ? "" : "xq-think");
      const conf = h("div", { class: "xq-conf", id: "xq-confetti" });
      const colors = ["#ff6b6b", "#ffd43b", "#51cf66", "#4dabf7", "#da77f2", "#ff922b"];
      for (let i = 0; i < 46; i++) {
        const c = h("i", {});
        c.style.left = Math.round(Math.random() * 100) + "%";
        c.style.background = colors[i % colors.length];
        c.style.animationDelay = (-Math.random() * 2.4).toFixed(2) + "s";
        c.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + "s";
        conf.append(c);
      }
      board.append(conf);
    } else setStatus("和棋", "");
    const ep = epoch;
    later(() => { if (ep === epoch) showOverlay(st, humanWon, draw); }, reduced() ? 0 : 1300);
    updateButtons();
  }

  function showOverlay(st: ReturnType<typeof L.status>, humanWon: boolean, draw: boolean) {
    board.querySelector(".xq-over")?.remove();
    const why = draw ? "太久没有吃子了，我们和棋吧。" : st.check ? (humanWon ? "对方的将被将死了！" : "你的帅被将死了。") : (humanWon ? "对方无路可走了！" : "你无路可走了。");
    const card = h("div", { class: "xq-card" + (humanWon || draw ? "" : " xq-lose"), id: "xq-result", "data-result": draw ? "draw" : humanWon ? "win" : "lose" },
      h("h2", {}, draw ? "和棋" : humanWon ? "你赢了！" : "电脑赢了！"), h("p", {}, why),
      h("div", { class: "xq-ctl" }, h("button", { class: "xq-btn xq-go", id: "xq-again", onclick: () => restart("新的一局开始了") }, "再来一局"),
        h("button", { class: "xq-btn", id: "xq-look", onclick: () => ov.remove() }, "看看棋盘")));
    const ov = h("div", { class: "xq-over", id: "xq-over" }, card);
    board.append(ov);
  }

  async function think() {
    if (thinking || over) return;
    const ep = epoch;
    thinking = true;
    refreshStatus(); updateButtons();
    const lv = L.LEVELS[level];
    const t0 = performance.now();
    const g = L.searchGen(pos, { depth: lv.depth, ms: lv.ms, all: lv.noise > 0 || lv.blunder > 0 });
    let res: L.SearchResult;
    for (;;) {
      const s0 = performance.now();
      let r = g.next();
      while (!r.done && performance.now() - s0 < 10) r = g.next();
      if (r.done) { res = r.value; break; }
      await sleep(0);
      if (ep !== epoch) return;
    }
    const wait = 420 - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (ep !== epoch) return;
    thinking = false;
    refreshStatus();
    const m = L.pickMove(res, lv);
    if (!m) { afterMove(false); return; }
    await play(m);
  }

  async function hint() {
    if (busy || thinking || over || pos.turn !== human) { if (thinking) ctx.toast("电脑正在思考，请稍等。"); return; }
    const ep = epoch;
    busy = true; updateButtons();
    const close = ctx.toast("正在想一步好棋", 8000, true);
    const g = L.searchGen(pos, { depth: 4, ms: 450 });
    let res: L.SearchResult;
    for (;;) {
      const s0 = performance.now();
      let r = g.next();
      while (!r.done && performance.now() - s0 < 10) r = g.next();
      if (r.done) { res = r.value; break; }
      await sleep(0);
      if (ep !== epoch) { close(); return; }
    }
    close();
    busy = false;
    if (ep !== epoch) return;
    hintMove = res.move;
    clearSelection();
    drawMarks();
    updateButtons();
    ctx.sfx("good");
    ctx.toast("提示：试试闪着蓝框的这一步。");
  }

  function canUndo(): boolean {
    if (busy || !history.length) return false;
    // plies to take back: until it is the human's turn again (at least one)
    let t = pos.turn, n = 0;
    do { n++; t = -t as L.Side; } while (t !== human && n < history.length);
    return t === human;
  }
  function undo() {
    if (busy) return;
    if (!canUndo()) { ctx.toast("现在不能悔棋。"); return; }
    epoch++; thinking = false; over = false;
    board.querySelectorAll(".xq-over, .xq-conf").forEach((x) => x.remove());
    do { L.unmake(pos); history.pop(); } while (pos.turn !== human && history.length);
    clearSelection(); hintMove = 0;
    rebuild(); renderTray(false); drawMarks();
    wrap.dataset.check = "";
    const chk = L.inCheck(pos, pos.turn);
    if (chk) { clearStates(); showCheck(pos.turn); }
    refreshStatus(); updateButtons();
    ctx.sfx("tap");
    ctx.toast("已悔棋。");
    if (pos.turn !== human) void think();
  }

  function restart(msg: string, fen?: string) {
    epoch++; thinking = false; over = false; busy = false;
    pos = fen ? L.parseFen(fen) : L.startPosition();
    history = []; clearSelection(); hintMove = 0;
    board.querySelectorAll(".xq-over, .xq-conf").forEach((x) => x.remove());
    wrap.dataset.check = ""; wrap.dataset.anim = ""; wrap.classList.remove("xq-capturing");
    rebuild(); renderTray(false); drawMarks();
    refreshStatus(); updateButtons(); showRecord();
    if (msg) ctx.toast(msg);
    ctx.sfx("place");
    const st = L.status(pos);
    if (st.state === "play") { if (st.check) showCheck(pos.turn); if (pos.turn !== human) void think(); } else finish(st);
  }
  function setLevel(id: L.LevelId) {
    level = id; ctx.store.set("level", id); refreshChips();
    ctx.toast(`难度：${L.LEVELS[id].name}`);
    ctx.sfx("tap");
  }
  function setSide(s: L.Side) {
    if (s === human) return;
    human = s; ctx.store.set("side", s); refreshChips();
    restart(s === L.RED ? "你执红方，先走。" : "你执黑方，电脑先走。");
  }
  function updateButtons() {
    btnUndo.disabled = !canUndo();
    btnHint.disabled = busy || thinking || over || pos.turn !== human;
  }

  // ---------- pointer: tap a piece then a target, or drag ----------
  let dragFrom = -1, dragEl: HTMLElement | null = null, dragging = false, downX = 0, downY = 0, toggleOff = false, activePtr = -1;
  const canPlay = () => !busy && !thinking && !over && pos.turn === human;
  const select = (s: number) => {
    sel = s; hintMove = 0;
    targets = L.legalFrom(pos, s).map(L.toOf);
    ctx.sfx("tap");
    drawMarks();
  };
  const resetDrag = () => {
    if (dragEl) { dragEl.classList.remove("xq-drag"); const s = Number(dragEl.dataset.sq); setXY(dragEl, s); }
    dragEl = null; dragging = false; dragFrom = -1; toggleOff = false; activePtr = -1;
  };
  board.addEventListener("pointerdown", (e) => {
    if (!canPlay() || activePtr !== -1) return;
    const s = squareAt(e);
    if (s < 0) { clearSelection(); drawMarks(); return; }
    if (sel >= 0 && targets.includes(s)) { void play(L.mv(sel, s)); return; }
    const p = pos.b[s];
    if (p && L.sideOf(p) === human) {
      toggleOff = sel === s;
      if (!toggleOff) select(s);
      dragFrom = s; dragEl = els.get(s) ?? null; downX = e.clientX; downY = e.clientY; activePtr = e.pointerId;
      try { board.setPointerCapture(e.pointerId); } catch { /* fine */ }
    } else { clearSelection(); drawMarks(); }
  });
  board.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePtr || !dragEl) return;
    if (!dragging && Math.hypot(e.clientX - downX, e.clientY - downY) > Math.max(6, U * 0.25)) {
      dragging = true; toggleOff = false;
      if (sel !== dragFrom) select(dragFrom);
      dragEl.classList.add("xq-drag");
      dragEl.classList.remove("xq-sel");
    }
    if (dragging) {
      const r = board.getBoundingClientRect();
      setUV(dragEl, (e.clientX - r.left - board.clientLeft) / U, (e.clientY - r.top - board.clientTop) / U - 0.25);
    }
  });
  const endDrag = (e: PointerEvent, cancel: boolean) => {
    if (e.pointerId !== activePtr) return;
    const was = dragging, from = dragFrom, off = toggleOff;
    const s = cancel ? -1 : squareAt(e);
    try { board.releasePointerCapture(e.pointerId); } catch { /* fine */ }
    if (was) {
      if (s >= 0 && targets.includes(s) && from === sel) { dragEl?.classList.remove("xq-drag"); dragEl = null; dragging = false; activePtr = -1; dragFrom = -1; void play(L.mv(from, s)); return; }
      resetDrag(); clearSelection(); drawMarks();
      return;
    }
    resetDrag();
    if (off) { clearSelection(); drawMarks(); }
  };
  board.addEventListener("pointerup", (e) => endDrag(e, false));
  board.addEventListener("pointercancel", (e) => endDrag(e, true));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { clearSelection(); drawMarks(); }
    else if (e.key === "u" || e.key === "U") undo();
    else if (e.key === "h" || e.key === "H") void hint();
  };
  document.addEventListener("keydown", onKey);

  // ---------- start ----------
  refreshChips();
  fit();
  const onResize = () => { fit(); };
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => fit()) : null;
  ro?.observe(boxEl);
  requestAnimationFrame(fit);
  rebuild(); renderTray(false); drawMarks(); showRecord();
  refreshStatus(); updateButtons();
  if (pos.turn !== human) void think();

  const hook = {
    get pos() { return pos; },
    get human() { return human; },
    get level() { return level; },
    get over() { return over; },
    get busy() { return busy || thinking; },
    get history() { return history.map((r) => r.m); },
    /** a test sets a position (fen), the side the human plays and the level */
    load(fen: string, side: L.Side = L.RED, lv = level) { human = side; level = lv; refreshChips(); restart("", fen); },
    relayout,
  };
  (window as unknown as { __xq: typeof hook }).__xq = hook;

  return () => {
    dead = true;
    epoch++;
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey);
    ro?.disconnect();
    delete (window as unknown as { __xq?: unknown }).__xq;
  };
}
