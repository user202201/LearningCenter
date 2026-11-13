import type { GameCtx } from "./ctx";
import "./gomoku.css";
import * as G from "./gomoku-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="gi-b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6c757d"/><stop offset="1" stop-color="#14171a"/></radialGradient><radialGradient id="gi-w" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ced4da"/></radialGradient></defs>
<rect x="8" y="8" width="104" height="104" rx="22" fill="#e0a458" stroke="#8d5524" stroke-width="5"/>
<path d="M26 30H94M26 60H94M26 90H94M30 26V94M60 26V94M90 26V94" stroke="#8d5524" stroke-width="3" stroke-linecap="round"/>
<g transform="translate(36 36)"><circle r="17" fill="url(#gi-b)" stroke="#000" stroke-width="2"/><circle cx="-6" cy="-2" r="3.4" fill="#fff"/><circle cx="6" cy="-2" r="3.4" fill="#fff"/><circle cx="-5.5" cy="-1.5" r="1.6" fill="#111"/><circle cx="6.5" cy="-1.5" r="1.6" fill="#111"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>
<g transform="translate(84 60)"><circle r="17" fill="url(#gi-w)" stroke="#868e96" stroke-width="2"/><circle cx="-6" cy="-2" r="2.8" fill="#222"/><circle cx="6" cy="-2" r="2.8" fill="#222"/><circle cx="-11" cy="5" r="3.4" fill="#ff8787" opacity=".6"/><circle cx="11" cy="5" r="3.4" fill="#ff8787" opacity=".6"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#c2255c" stroke-width="2.5" stroke-linecap="round"/></g>
<g transform="translate(60 84)"><circle r="17" fill="url(#gi-b)" stroke="#000" stroke-width="2"/><circle cx="-6" cy="-2" r="3.4" fill="#fff"/><circle cx="6" cy="-2" r="3.4" fill="#fff"/><circle cx="-5.5" cy="-1.5" r="1.6" fill="#111"/><circle cx="6.5" cy="-1.5" r="1.6" fill="#111"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>
</svg>`;

const S = 40, M = 26, SIZE = (G.N - 1) * S + 2 * M, R = 18;
const px = (i: number) => { const [x, y] = G.xy(i); return [M + x * S, M + y * S] as const; };
const stoneBody = (c: number) => c === 1
  ? `<circle r="${R}" fill="url(#gm-b)" stroke="#000" stroke-width="1.5"/><ellipse cx="-7" cy="-9" rx="6" ry="3.2" fill="#fff" opacity=".35" transform="rotate(-35 -7 -9)"/><circle cx="-6" cy="-1" r="3.4" fill="#fff"/><circle cx="6" cy="-1" r="3.4" fill="#fff"/><circle cx="-5.4" cy="-.5" r="1.7" fill="#111"/><circle cx="6.6" cy="-.5" r="1.7" fill="#111"/><circle cx="-11" cy="6" r="3" fill="#ff8787" opacity=".55"/><circle cx="11" cy="6" r="3" fill="#ff8787" opacity=".55"/><path d="M-5 6 Q0 11.5 5 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`
  : `<circle r="${R}" fill="url(#gm-w)" stroke="#868e96" stroke-width="1.5"/><ellipse cx="-7" cy="-9" rx="6" ry="3.2" fill="#fff" opacity=".9" transform="rotate(-35 -7 -9)"/><circle cx="-6" cy="-1" r="2.9" fill="#222"/><circle cx="6" cy="-1" r="2.9" fill="#222"/><circle cx="-6.8" cy="-2" r="1" fill="#fff"/><circle cx="5.2" cy="-2" r="1" fill="#fff"/><circle cx="-11" cy="6" r="3.2" fill="#ff8787" opacity=".6"/><circle cx="11" cy="6" r="3.2" fill="#ff8787" opacity=".6"/><path d="M-5 6 Q0 11.5 5 6" fill="none" stroke="#c2255c" stroke-width="2.4" stroke-linecap="round"/>`;
const stoneSvg = (i: number, c: number, cls = "", k = 0) => { const [x, y] = px(i); return `<g class="gomoku-stone ${cls}" data-i="${i}" data-c="${c}" style="--k:${k}"><g class="gs"><g transform="translate(${x} ${y})">${stoneBody(c)}</g></g></g>`; };
const turnIcon = (c: number) => `<svg viewBox="-20 -20 40 40" class="gomoku-turn"><g>${stoneBody(c)}</g></svg>`;

interface Settings { mode: "ai" | "two"; level: G.Level; first: 1 | 2 }   // first: who moves first (the colour; vs the computer the human is black when he moves first)
interface Rec { w: number; l: number; d: number }

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const timers = new Set<number>();
  let disposed = false, cleanup: (() => void) | null = null;
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const holder = h("div", { class: "gomoku-root" });
  root.append(holder);
  const settings = (): Settings => { const s = ctx.store.get<Partial<Settings>>("settings", {}); return { mode: s.mode === "two" ? "two" : "ai", level: (["easy", "normal", "hard"] as const).includes(s.level as G.Level) ? (s.level as G.Level) : "normal", first: s.first === 2 ? 2 : 1 }; };
  const records = () => ctx.store.get<Record<string, Rec>>("stats", {});
  const clear = () => { cleanup?.(); cleanup = null; holder.replaceChildren(); };

  /* ================= setup ================= */
  function showSetup() {
    clear();
    let st = settings();
    const body = h("div", { class: "gomoku-setup", id: "gomoku-setup" });
    const pics = h("div", { class: "gomoku-pics" }); pics.innerHTML = `<svg viewBox="-22 -22 44 44"><defs><radialGradient id="gm-b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6c757d"/><stop offset="1" stop-color="#14171a"/></radialGradient><radialGradient id="gm-w" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ced4da"/></radialGradient></defs>${stoneBody(1)}</svg><svg viewBox="-22 -22 44 44">${stoneBody(2)}</svg>`;
    const group = (title: string, key: keyof Settings, opts: [string, string | number][], id: string) => {
      const row = h("div", { class: "gomoku-row", id }, h("b", {}, title));
      const box = h("div", { class: "gomoku-opts" });
      for (const [label, val] of opts) box.append(h("button", { class: "gomoku-opt" + (st[key] === val ? " on" : ""), "data-v": String(val), onclick: () => { ctx.sfx("tap"); (st as unknown as Record<string, unknown>)[key] = val; ctx.store.set("settings", st); render(); } }, label));
      row.append(box); return row;
    };
    const render = () => {
      body.replaceChildren(...([h("h2", {}, "五子棋"), pics,
        group("玩法", "mode", [["和电脑下", "ai"], ["两个人下", "two"]], "gomoku-g-mode"),
        st.mode === "ai" ? group("难度", "level", [["简单", "easy"], ["普通", "normal"], ["困难", "hard"]], "gomoku-g-level") : null,
        st.mode === "ai" ? group("谁先下", "first", [["我先下", 1], ["电脑先下", 2]], "gomoku-g-first") : group("谁先下", "first", [["黑棋先", 1], ["白棋先", 2]], "gomoku-g-first"),
        st.mode === "ai" ? (() => { const r = records()[st.level] ?? { w: 0, l: 0, d: 0 }; return h("p", { class: "gomoku-record", id: "gomoku-record" }, `战绩：胜 ${r.w} 负 ${r.l} 平 ${r.d}`); })() : null,
        h("button", { class: "gomoku-go", id: "gomoku-go", onclick: () => { ctx.sfx("tap"); showPlay(st); } }, "开始游戏")] as (HTMLElement | null)[]).filter((x): x is HTMLElement => !!x));
    };
    render();
    holder.append(h("div", { class: "gomoku-scroll" }, body));
  }

  /* ================= a game ================= */
  function showPlay(cfg: Settings) {
    clear();
    const ai = cfg.mode === "ai";
    // vs the computer: whoever moves first is black. Two players: colours are fixed, `first` is the one who starts.
    const human: G.Stone = ai ? (cfg.first === 1 ? 1 : 2) : 0 as G.Stone;
    const cpu: G.Stone = ai ? G.other(human as G.Stone) : 0 as G.Stone;
    const firstColour: G.Stone = ai ? 1 : cfg.first;
    let board = G.newBoard(), turn: G.Stone = firstColour, hist: { i: number; p: G.Stone }[] = [], over = false, busy = false, pending = 0;

    const status = h("div", { class: "gomoku-status", id: "gomoku-status" });
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`); svg.setAttribute("class", "gomoku-svg"); svg.id = "gomoku-board";
    let lines = "";
    for (let k = 0; k < G.N; k++) lines += `<path d="M${M} ${M + k * S}H${M + (G.N - 1) * S}M${M + k * S} ${M}V${M + (G.N - 1) * S}" stroke="#7a4a1d" stroke-width="${k === 0 || k === G.N - 1 ? 3 : 1.6}" stroke-linecap="round" fill="none"/>`;
    const stars = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]].map(([x, y]) => `<circle cx="${M + x * S}" cy="${M + y * S}" r="4.5" fill="#7a4a1d"/>`).join("");
    svg.innerHTML = `<defs><linearGradient id="gm-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0be72"/><stop offset="1" stop-color="#dc9a4a"/></linearGradient>
      <radialGradient id="gm-b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6c757d"/><stop offset="1" stop-color="#14171a"/></radialGradient>
      <radialGradient id="gm-w" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ced4da"/></radialGradient></defs>
      <rect width="${SIZE}" height="${SIZE}" rx="22" fill="url(#gm-wood)" stroke="#8d5524" stroke-width="6"/>${lines}${stars}<g id="gm-ghost" class="gomoku-ghost"></g><g id="gm-stones"></g><g id="gm-over"></g>`;
    const stonesG = svg.querySelector("#gm-stones") as SVGGElement, overG = svg.querySelector("#gm-over") as SVGGElement, ghostG = svg.querySelector("#gm-ghost") as SVGGElement;
    const wrap = h("div", { class: "gomoku-wrap" }, svg as unknown as HTMLElement);
    const undoBtn = h("button", { id: "gomoku-undo", onclick: () => undo() }, "撤销");
    const resetBtn = h("button", { id: "gomoku-reset", onclick: () => restart() }, "重新开始");
    const setBtn = h("button", { id: "gomoku-setup-btn", onclick: () => { ctx.sfx("tap"); showSetup(); } }, "设置");
    holder.append(h("div", { class: "gomoku-play" }, status, wrap, h("div", { class: "gomoku-btns" }, setBtn, undoBtn, resetBtn)));

    const say = (c: number, text: string) => {
      const icon = h("span", {}); icon.innerHTML = c ? turnIcon(c) : "";
      status.replaceChildren(...(icon.firstChild ? [icon.firstChild] : []), h("span", {}, text));
    };
    const setStatus = () => {
      status.className = "gomoku-status"; status.id = "gomoku-status";
      if (busy) say(turn, "电脑在想…");
      else if (ai) say(turn, turn !== human ? "电脑在想…" : turn === 1 ? "轮到你了（黑棋）" : "轮到你了（白棋）");
      else say(turn, turn === 1 ? "轮到黑棋" : "轮到白棋");
      status.dataset.turn = String(turn);
    };
    const redraw = (anim: number | null) => {
      stonesG.innerHTML = hist.map((m, k) => stoneSvg(m.i, m.p, k === anim ? "" : "still")).join("");
      overG.replaceChildren();
      const last = hist[hist.length - 1];
      if (last) { const [x, y] = px(last.i); overG.insertAdjacentHTML("beforeend", `<circle class="gomoku-last" id="gomoku-last" cx="${x}" cy="${y}" r="${R + 4}"/>`); }
      undoBtn.disabled = busy || !canUndo();
      setStatus();
    };
    const layout = () => {
      const W = wrap.clientWidth, Hh = wrap.clientHeight, s = Math.max(120, Math.floor(Math.min(W, Hh)));
      svg.style.width = `${s}px`; svg.style.height = `${s}px`;
    };
    const place = (i: number) => {
      board[i] = turn; hist.push({ i, p: turn });
      const line = G.winLine(board, i);
      redraw(hist.length - 1);
      ctx.sfx("place");
      if (line) return finish(line, turn);
      if (G.isFull(board)) return finish(null, 0);
      turn = G.other(turn); setStatus();
      if (ai && turn === cpu) { busy = true; undoBtn.disabled = true; setStatus(); const my = ++pending; later(() => { if (my === pending) cpuMove(); }, 380); }
    };
    const cpuMove = () => {
      busy = false;
      if (over || turn !== cpu) return;
      const i = G.chooseMove(board, cpu, cfg.level);
      if (board[i]) { const e = G.candidates(board).find((c) => !board[c]); if (e === undefined) return; place(e); return; }
      place(i);
    };
    function finish(line: number[] | null, winner: G.Stone) {
      over = true; busy = false;
      if (line) {
        const keep = line.slice(0, line.length);
        redraw(null);
        stonesG.querySelectorAll<SVGGElement>(".gomoku-stone").forEach((g) => { const k = keep.indexOf(Number(g.dataset.i)); if (k >= 0) { g.classList.add("win"); g.style.setProperty("--k", String(k)); } });
        const [x1, y1] = px(line[0]), [x2, y2] = px(line[line.length - 1]);
        overG.insertAdjacentHTML("beforeend", `<line class="gomoku-winline" id="gomoku-winline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
        keep.forEach((c) => { const [x, y] = px(c); overG.insertAdjacentHTML("beforeend", `<circle class="gomoku-ring" cx="${x}" cy="${y}" r="${R + 3}"/>`); });
      }
      status.className = "gomoku-status won";
      let msg: string, kind: "win" | "lose" | "good" = "win";
      if (!line) { msg = "平局！棋盘下满了。"; kind = "good"; }
      else if (ai) { if (winner === human) msg = "你赢了！太棒了！"; else { msg = "电脑赢了，再来一局吧！"; kind = "lose"; } }
      else msg = winner === 1 ? "黑棋赢了！太棒了！" : "白棋赢了！太棒了！";
      say(line ? winner : 0, msg);
      status.dataset.result = line ? String(winner) : "draw";
      ctx.sfx(kind); ctx.toast(msg, 3500);
      if (ai) {
        const all = records(), r = { ...(all[cfg.level] ?? { w: 0, l: 0, d: 0 }) };
        if (!line) r.d++; else if (winner === human) r.w++; else r.l++;
        ctx.store.set("stats", { ...all, [cfg.level]: r });
      }
      undoBtn.disabled = !canUndo();
    }
    const canUndo = () => (ai ? hist.some((m) => m.p === human) : hist.length > 0);
    function undo() {
      if (busy || !canUndo()) return;
      // against the computer: take back the move pair (the computer's answer and the move of the player); alone: one move
      pending++;
      if (ai) { while (hist.length) { const m = hist.pop()!; board[m.i] = 0; if (m.p === human) break; } }
      else { const m = hist.pop()!; board[m.i] = 0; }
      over = false; turn = hist.length ? G.other(hist[hist.length - 1].p) : firstColour;
      ctx.sfx("tap"); redraw(null);
      if (ai && turn === cpu) { busy = true; setStatus(); const my = ++pending; later(() => { if (my === pending) cpuMove(); }, 380); }
    }
    function restart() {
      pending++; board = G.newBoard(); hist = []; over = false; busy = false; turn = firstColour;
      ctx.sfx("tap"); redraw(null);
      if (ai && turn === cpu) { busy = true; setStatus(); const my = ++pending; later(() => { if (my === pending) cpuMove(); }, 380); }
    }

    // pointer: a tap puts a stone on the nearest crossing
    const cellAt = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect(), k = SIZE / r.width;
      const fx = ((ev.clientX - r.left) * k - M) / S, fy = ((ev.clientY - r.top) * k - M) / S;
      const x = Math.round(fx), y = Math.round(fy);
      if (x < 0 || y < 0 || x >= G.N || y >= G.N || Math.hypot(fx - x, fy - y) > 0.62) return -1;
      return G.idx(x, y);
    };
    const mine = () => !over && !busy && (!ai || turn === human);
    svg.addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const i = cellAt(ev);
      ghostG.innerHTML = i >= 0 && !board[i] && mine() ? stoneSvg(i, turn, "still") : "";
    });
    svg.addEventListener("pointerleave", () => { ghostG.innerHTML = ""; });
    svg.addEventListener("pointerup", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      ghostG.innerHTML = "";
      const i = cellAt(ev);
      if (i < 0 || !mine()) return;
      if (board[i]) { ctx.sfx("bad"); return; }
      place(i);
    });
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    cleanup = () => window.removeEventListener("resize", onResize);
    redraw(null); layout(); later(layout, 60);
    if (ai && turn === cpu) { busy = true; setStatus(); const my = ++pending; later(() => { if (my === pending) cpuMove(); }, 450); }
  }

  showSetup();
  return () => { disposed = true; void disposed; cleanup?.(); timers.forEach((t) => clearTimeout(t)); timers.clear(); };
}
