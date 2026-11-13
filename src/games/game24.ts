import type { GameCtx } from "./ctx";
import "./game24.css";
import { LEVEL_MAX, OPS, OP_SYMBOL, rankLabel, deal, newHand, resetHand, combine, undo, status, hint, solutionText, fracStr, isInt, type Hand, type Op, type Frac } from "./game24-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><g transform="rotate(-12 42 66)"><rect x="18" y="26" width="46" height="62" rx="9" fill="#fff" stroke="#12b886" stroke-width="4"/><text x="41" y="68" font-size="30" font-weight="900" text-anchor="middle" fill="#087f5b" font-family="Arial,sans-serif">8</text><circle cx="27" cy="36" r="4.5" fill="#fa5252"/></g><g transform="rotate(10 78 62)"><rect x="56" y="22" width="46" height="62" rx="9" fill="#fff6e5" stroke="#e8590c" stroke-width="4"/><text x="79" y="64" font-size="26" font-weight="900" text-anchor="middle" fill="#e8590c" font-family="Arial,sans-serif">24</text><circle cx="70" cy="32" r="4.5" fill="#fa5252"/></g><circle cx="52" cy="98" r="3.4" fill="#222"/><circle cx="68" cy="98" r="3.4" fill="#222"/><path d="M52 104 Q60 111 68 104" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/><path d="M96 14 l2.4 6.2 6.2 2.4 -6.2 2.4 -2.4 6.2 -2.4 -6.2 -6.2 -2.4 6.2 -2.4z" fill="#ffd43b"/></svg>`;

type Phase = "ready" | "play" | "won";
const LEVEL_NAMES = ["难度：简单", "难度：普通", "难度：挑战"];
const SUITS = [
  { name: "heart", color: "#fa5252", edge: "#c92a2a", d: "M12 21.5C4 15.5 2 10.8 2 7.6 2 4.6 4.4 2.6 7 2.6c2.4 0 4.2 1.4 5 3.4.8-2 2.6-3.4 5-3.4 2.6 0 5 2 5 5 0 3.2-2 7.9-10 13.9z" },
  { name: "diamond", color: "#fa5252", edge: "#c92a2a", d: "M12 2L21.5 12 12 22 2.5 12z" },
  { name: "spade", color: "#495057", edge: "#212529", d: "M12 2C19.5 8.6 22 11.8 22 15c0 2.8-2.3 4-4.4 4-1.8 0-3.3-.8-4.3-2.3.2 2.2.9 4 2.7 5.3H8c1.8-1.3 2.5-3.100 2.700-5.300C9.700 18.200 8.200 19 6.400 19 4.300 19 2 17.800 2 15c0-3.200 2.500-6.400 10-13z" },
  { name: "club", color: "#495057", edge: "#212529", d: "M12 1.800a5 5 0 0 1 3.400 8.700 5 5 0 1 1-1.600 8.700c.1 1.600.6 2.800 1.900 3.800H8.300c1.300-1 1.800-2.200 1.900-3.800a5 5 0 1 1-1.600-8.700A5 5 0 0 1 12 1.800z" },
];
const suitSvg = (k: number) => { const s = SUITS[k % 4]; return `<svg viewBox="0 0 24 24" class="g24-suit" aria-hidden="true"><path d="${s.d}" fill="${s.color}" stroke="${s.edge}" stroke-width="1.6" stroke-linejoin="round"/></svg>`; };

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let level = Math.max(0, Math.min(2, ctx.store.get<number>("level", 1)));
  let bestStreak = ctx.store.get<number>("best", 0);
  let phase: Phase = "ready", hand: Hand = newHand([1, 2, 3, 4]), suits: number[] = [0, 1, 2, 3];
  let sel = -1, op: Op | null = null, hintSteps: { i: number; j: number; op: Op } | null = null, hinted = false, hintUndo = false;
  let solved = 0, streak = 0, popIdx = -1, shakeIdx = -1, msg = "";
  let lastRanks: number[] | undefined;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(fn, ms); timers.push(t); };

  const solvedEl = h("span", { class: "g24-stat", id: "g24-solved" }, "");
  const streakEl = h("span", { class: "g24-stat", id: "g24-streak" }, "");
  const bestEl = h("span", { class: "g24-stat best", id: "g24-best" }, "");
  const levelBtn = h("button", { class: "mopt", id: "g24-level", onclick: (e: Event) => { blur(e); level = (level + 1) % 3; ctx.store.set("level", level); ctx.sfx("tap"); streak = 0; newDeal(); } }, "");
  const newBtn = h("button", { class: "mopt", id: "g24-new", onclick: (e: Event) => { blur(e); ctx.sfx("tap"); if (phase !== "won") streak = 0; newDeal(); } }, "新题");
  const hud = h("div", { class: "g24-hud" }, solvedEl, streakEl, bestEl, levelBtn, newBtn);

  const cardsEl = h("div", { class: "g24-cards", id: "g24-cards" });
  const opsEl = h("div", { class: "g24-ops", id: "g24-ops" }, ...OPS.map((o) => h("button", { class: "g24-op", "data-op": o, "aria-label": o, onclick: (e: Event) => { blur(e); pickOp(o); } }, OP_SYMBOL[o])));
  const msgEl = h("p", { class: "g24-msg", id: "g24-msg" }, "");
  const title = h("h2", {}, ""), omsg = h("p", {}, ""), again = h("button", { class: "primary", id: "g24-start", onclick: (e: Event) => { blur(e); ctx.sfx("tap"); go(); } }, "开始");
  const ovl = h("div", { class: "g24-ovl", id: "g24-ovl" }, title, omsg, again);
  const field = h("div", { class: "g24-field", id: "g24-field" }, cardsEl, opsEl, msgEl, ovl);
  const board = h("div", { class: "g24-board" }, field);
  const act = (id: string, label: string, fn: () => void) => h("button", { class: "g24-act", id, onclick: (e: Event) => { blur(e); fn(); } }, label);
  const undoBtn = act("g24-undo", "撤销", () => doUndo());
  const resetBtn = act("g24-reset", "重来", () => doReset());
  const hintBtn = act("g24-hint", "提示", () => doHint());
  const skipBtn = act("g24-skip", "跳过", () => doSkip());
  const pad = h("div", { class: "g24-pad" }, undoBtn, resetBtn, hintBtn, skipBtn);
  root.append(h("div", { class: "g24-wrap" }, hud, board, pad));

  function blur(e: Event) { (e.currentTarget as HTMLElement | null)?.blur(); }
  const setOvl = (t: string, m: string, b: string, show: boolean) => { title.textContent = t; omsg.textContent = m; again.textContent = b; ovl.hidden = !show; };

  function valueEl(v: Frac): HTMLElement {
    const neg = v.n < 0, n = Math.abs(v.n);
    const el = h("span", { class: "g24-val", "data-v": fracStr(v) });
    if (neg) el.append(h("span", { class: "g24-minus" }, "−"));
    if (isInt(v)) { const s = String(n); el.append(s); el.classList.add(s.length >= 4 ? "l4" : s.length === 3 ? "l3" : "l1"); }
    else { el.classList.add("fr"); el.append(h("span", { class: "g24-frac" }, h("span", {}, String(n)), h("span", {}, String(v.d)))); }
    return el;
  }
  function cardEl(i: number): HTMLElement {
    const c = hand.cards[i], orig = c.rank !== undefined;
    const cls = ["g24-card"];
    if (!orig) cls.push("merged");
    if (i === sel) cls.push("sel");
    if (hintSteps && (hintSteps.i === i || hintSteps.j === i)) cls.push("hint");
    if (i === popIdx) cls.push("pop");
    if (i === shakeIdx) cls.push("shake");
    if (phase === "won") cls.push("win");
    if (phase === "play" && hand.cards.length === 1) cls.push("fail");
    const el = h("button", { class: cls.join(" "), "data-i": String(i), "data-v": fracStr(c.v), "aria-label": fracStr(c.v), onclick: (e: Event) => { blur(e); pickCard(i); } });
    if (orig) {
      const s = suitSvg(suits[i] ?? i);
      const corner = h("span", { class: "g24-corner" }, h("b", {}, rankLabel(c.rank!)));
      const sm = h("span", { class: "g24-sm" }); sm.innerHTML = s; corner.append(sm);
      const corner2 = h("span", { class: "g24-corner b" }, h("b", {}, rankLabel(c.rank!))); const sm2 = h("span", { class: "g24-sm" }); sm2.innerHTML = s; corner2.append(sm2);
      const big = valueEl(c.v); big.classList.add("rk"); if (c.rank! > 10 || c.rank === 1) big.textContent = rankLabel(c.rank!);
      el.append(corner, big, corner2);
    } else el.append(valueEl(c.v));
    return el;
  }
  function render() {
    cardsEl.replaceChildren(...hand.cards.map((_, i) => cardEl(i)));
    popIdx = -1; shakeIdx = -1;
    opsEl.querySelectorAll<HTMLElement>(".g24-op").forEach((b) => { const o = b.dataset.op as Op; b.classList.toggle("on", o === op); b.classList.toggle("hint", !!hintSteps && hintSteps.op === o); });
    solvedEl.textContent = `解出：${solved}`; streakEl.textContent = `连胜：${streak}`; bestEl.textContent = `最高连胜：${bestStreak}`;
    levelBtn.textContent = LEVEL_NAMES[level]; levelBtn.classList.add("on");
    const failed = phase === "play" && status(hand) === "failed";
    undoBtn.disabled = hand.hist.length === 0 || phase === "won";
    undoBtn.classList.toggle("hint", (failed || hintUndo) && hand.hist.length > 0);
    resetBtn.disabled = hand.hist.length === 0 || phase === "won";
    hintBtn.disabled = phase !== "play" || failed;
    skipBtn.disabled = phase !== "play";
    msgEl.textContent = msg;
    field.classList.toggle("is-ready", phase === "ready");
  }
  function setMsg(m: string) { msg = m; msgEl.textContent = m; }
  const clearPick = () => { sel = -1; op = null; };
  const guide = () => { setMsg(sel < 0 ? "选一张牌" : op === null ? "再选一个运算符" : "再选另一张牌"); };

  function newDeal() {
    const ranks = deal(level, Math.random, 0.2, lastRanks); lastRanks = ranks;
    hand = newHand(ranks); suits = ranks.map(() => Math.floor(Math.random() * 4));
    clearPick(); hintSteps = null; hinted = false; hintUndo = false;
    if (phase === "won") phase = "play";
    if (phase === "ready") setOvl("算24点", "点一张牌，点一个运算符，再点另一张牌，把四张牌算成 24。", "开始", true); else setOvl("", "", "", false);
    guide(); render(); layout();
  }
  function go() {
    if (phase === "ready") { phase = "play"; setOvl("", "", "", false); guide(); render(); }
    else if (phase === "won") { newDeal(); }
  }
  function pickCard(i: number) {
    if (phase !== "play" || hand.cards.length < 2) return;
    hintSteps = null; hintUndo = false;
    if (sel < 0 || (op === null && sel !== i)) { sel = i; ctx.sfx("tap"); guide(); render(); return; }
    if (sel === i) { clearPick(); ctx.sfx("tap"); guide(); render(); return; }
    // card, operator, card: merge
    const r = combine(hand, sel, op as Op, i);
    if (r === "div0") { shakeIdx = i; ctx.sfx("bad"); setMsg("不能除以 0"); op = null; render(); return; }
    if (r === "same") return;
    const lo = Math.min(sel, i);
    hand = r; clearPick(); popIdx = lo;
    const st = status(hand);
    if (st === "won") { phase = "won"; won(); }
    else if (st === "failed") { ctx.sfx("bad"); setMsg(`结果是 ${fracText(hand.cards[0].v)}，不是 24，撤销再试试。`); }
    else { ctx.sfx("good"); guide(); }
    render();
  }
  const fracText = (v: Frac) => fracStr(v);
  function pickOp(o: Op) {
    if (phase !== "play" || hand.cards.length < 2) return;
    hintSteps = null; hintUndo = false;
    if (sel < 0) { ctx.sfx("bad"); setMsg("先选一张牌"); return; }
    op = op === o ? null : o; ctx.sfx("tap"); guide(); render();
  }
  function won() {
    solved++;
    if (hinted) streak = 0; else streak++;
    if (streak > bestStreak) { bestStreak = streak; ctx.store.set("best", bestStreak); }
    ctx.store.set("solved", ctx.store.get<number>("solved", 0) + 1);
    ctx.sfx("win");
    setMsg("");
    setOvl("24!", hinted ? "做对了！下次试试不看提示。" : `太棒了！连胜 ${streak}`, "下一题", true);
  }
  function doUndo() {
    if (phase !== "play" || !hand.hist.length) return;
    hand = undo(hand); clearPick(); hintSteps = null; hintUndo = false; ctx.sfx("move"); guide(); render();
  }
  function doReset() {
    if (phase !== "play" || !hand.hist.length) return;
    hand = resetHand(hand); clearPick(); hintSteps = null; hintUndo = false; ctx.sfx("rotate"); guide(); render();
  }
  function doHint() {
    if (phase !== "play" || hand.cards.length < 2) return;
    const s = hint(hand);
    clearPick(); hinted = true;
    if (!s) { hintSteps = null; hintUndo = true; ctx.sfx("bad"); setMsg("这条路走不通，先撤销一步。"); render(); return; }
    hintSteps = { i: s.i, j: s.j, op: s.op }; ctx.sfx("good");
    setMsg(`提示：试试 ${fracText(s.a)} ${OP_SYMBOL[s.op]} ${fracText(s.b)}`);
    render();
  }
  function doSkip() {
    if (phase !== "play") return;
    const sol = solutionText(hand.ranks);
    streak = 0; ctx.sfx("tap"); newDeal();
    if (sol) { setMsg(`上一题答案：${sol}`); }
  }

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (phase !== "play") { if (k === "Enter" || k === " ") { e.preventDefault(); ctx.sfx("tap"); go(); } return; }
    if (k >= "1" && k <= "4") { const i = Number(k) - 1; if (i < hand.cards.length) pickCard(i); return; }
    const o: Op | null = k === "+" ? "+" : k === "-" ? "-" : k === "*" || k === "x" || k === "X" ? "*" : k === "/" ? "/" : null;
    if (o) { e.preventDefault(); pickOp(o); return; }
    if (k === "Enter" || k === "Backspace") { e.preventDefault(); doUndo(); return; }
    if (k === "Escape") { clearPick(); hintSteps = null; guide(); render(); return; }
    if (k === "h" || k === "H") doHint();
  }

  function layout() {
    const W = board.clientWidth, H = board.clientHeight;
    if (!W || !H) return;
    const gap = 10, pad = 14, border = 8, opsH = 52, msgH = 28, ratio = 1.34, opsW = 4 * 52 + 3 * gap;
    // four cards in a row, or 2 x 2 on a tall screen: whichever gives the bigger cards
    const size = (cols: number) => {
      const rows = 4 / cols;
      const byW = (W - 2 * pad - border - (cols - 1) * gap) / cols, byH = (H - border - 2 * pad - opsH - msgH - 2 * gap - (rows - 1) * gap) / (rows * ratio);
      return Math.max(40, Math.floor(Math.min(byW, byH, 150)));
    };
    const c4 = size(4), c2 = size(2), cols = c2 > c4 * 1.25 ? 2 : 4, cw = cols === 2 ? c2 : c4, rows = 4 / cols;
    field.style.setProperty("--cw", cw + "px");
    cardsEl.style.height = Math.round(rows * cw * ratio + (rows - 1) * gap) + "px";
    field.style.width = Math.max(cols * cw + (cols - 1) * gap, opsW) + 2 * pad + "px";
    field.style.height = Math.round(rows * cw * ratio + (rows - 1) * gap + opsH + msgH + 2 * gap + 2 * pad) + "px";
    cardsEl.style.maxWidth = cols * cw + (cols - 1) * gap + "px";
  }

  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  newDeal();
  (window as unknown as Record<string, unknown>).__g24 = {
    state: () => ({ phase, ranks: hand.ranks, cards: hand.cards.map((c) => fracStr(c.v)), src: hand.cards.map((c) => c.src), solved, streak, level, best: bestStreak, hist: hand.hist.length, sel, op, hinted, msg, status: status(hand) }),
    setHand: (ranks: number[]) => { hand = newHand(ranks); suits = ranks.map((_, i) => i); clearPick(); hintSteps = null; hinted = false; hintUndo = false; if (phase === "won") { phase = "play"; setOvl("", "", "", false); } guide(); render(); },
    max: () => LEVEL_MAX[level],
  };
  return () => {
    timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__g24;
  };
}
