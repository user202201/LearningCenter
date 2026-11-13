import type { GameCtx } from "./ctx";
import "./klotski.css";
import * as K from "./klotski-logic";

const ICON_FACE = (cx: number, cy: number, r: number, skin: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${skin}" stroke="#8d5524" stroke-width="3"/>`;
export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<rect x="8" y="8" width="104" height="104" rx="20" fill="#e0a458" stroke="#8d5524" stroke-width="5"/>
<rect x="18" y="16" width="44" height="44" rx="10" fill="#ffd43b" stroke="#c47f00" stroke-width="4"/>
<path d="M26 30 L30 20 L38 27 L40 18 L42 27 L50 20 L54 30 Z" fill="#fa5252" stroke="#c92a2a" stroke-width="2" stroke-linejoin="round"/>
${ICON_FACE(40, 42, 13, "#ffe0bd")}<circle cx="35" cy="40" r="2.4" fill="#222"/><circle cx="45" cy="40" r="2.4" fill="#222"/><path d="M34 46 Q40 52 46 46" fill="none" stroke="#c92a2a" stroke-width="2.5" stroke-linecap="round"/>
<rect x="66" y="16" width="36" height="20" rx="8" fill="#40c057" stroke="#2b8a3e" stroke-width="4"/>
<path d="M76 24 q4 -4 8 0 M86 24 q4 -4 8 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
<rect x="66" y="42" width="16" height="34" rx="7" fill="#74c0fc" stroke="#1971c2" stroke-width="4"/>
<rect x="86" y="42" width="16" height="34" rx="7" fill="#ffa94d" stroke="#d9480f" stroke-width="4"/>
<rect x="18" y="66" width="20" height="20" rx="6" fill="#ced4da" stroke="#495057" stroke-width="3.5"/>
<rect x="42" y="66" width="20" height="20" rx="6" fill="#ced4da" stroke="#495057" stroke-width="3.5"/>
<rect x="18" y="90" width="20" height="14" rx="6" fill="#ced4da" stroke="#495057" stroke-width="3.5"/>
<path d="M54 100 L66 100" stroke="#2b8a3e" stroke-width="5" stroke-linecap="round"/><path d="M60 94 l8 6 -8 6" fill="none" stroke="#2b8a3e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* ---------- the cartoon faces (drawn in code) ---------- */
const eye = (x: number, y: number, r = 9) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="${x}" cy="${y + 1}" r="${r * .55}" fill="#222"/><circle cx="${x - r * .2}" cy="${y - r * .2}" r="${r * .22}" fill="#fff"/>`;
const blush = (x: number, y: number, r = 8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff8787" opacity=".55"/>`;
const smile = (x: number, y: number, w: number, d = 10) => `<path d="M${x - w} ${y} Q${x} ${y + d * 1.6} ${x + w} ${y}" fill="#fff" stroke="#a61e4d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
const brow = (x1: number, y1: number, x2: number, y2: number, w = 4) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#222" stroke-width="${w}" stroke-linecap="round"/>`;
const art: Record<K.Kind, { vb: string; svg: string }> = {
  C: { vb: "0 0 200 200", svg:
    `<path d="M20 200 Q30 150 100 150 Q170 150 180 200 Z" fill="#f08c00" opacity=".75"/>
     <path d="M60 52 L70 14 L90 40 L100 8 L110 40 L130 14 L140 52 Z" fill="#fa5252" stroke="#c92a2a" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="30" r="7" fill="#ffd43b" stroke="#c47f00" stroke-width="2"/><circle cx="76" cy="40" r="4" fill="#ffd43b"/><circle cx="124" cy="40" r="4" fill="#ffd43b"/>
     <path d="M82 134 Q100 190 118 134 Z" fill="#212529"/>
     ${ICON_FACE(100, 96, 54, "#ffe0bd")}${eye(78, 88, 11)}${eye(122, 88, 11)}${brow(64, 70, 90, 76)}${brow(136, 70, 110, 76)}${blush(64, 112, 9)}${blush(136, 112, 9)}
     <path d="M72 116 Q86 104 100 116 Q114 104 128 116 Q114 126 100 120 Q86 126 72 116Z" fill="#212529"/>${smile(100, 126, 16, 9)}` },
  G: { vb: "0 0 200 100", svg:
    `<rect x="62" y="2" width="76" height="22" rx="9" fill="#2f9e44" stroke="#1b5e20" stroke-width="3"/><rect x="62" y="12" width="76" height="6" fill="#ffd43b"/>
     <path d="M64 48 Q56 96 100 98 Q144 96 136 48 Q124 80 100 80 Q76 80 64 48Z" fill="#212529"/>
     <ellipse cx="100" cy="50" rx="39" ry="34" fill="#f76e6e" stroke="#a61e1e" stroke-width="3"/>
     <path d="M70 44 Q80 36 92 44" fill="#fff" stroke="#222" stroke-width="2.5"/><path d="M108 44 Q120 36 130 44" fill="#fff" stroke="#222" stroke-width="2.5"/><circle cx="82" cy="44" r="4.5" fill="#222"/><circle cx="118" cy="44" r="4.5" fill="#222"/>
     ${brow(66, 30, 92, 36, 5)}${brow(134, 30, 108, 36, 5)}<path d="M92 66 Q100 72 108 66" fill="none" stroke="#7a1010" stroke-width="3" stroke-linecap="round"/>${blush(70, 58, 6)}${blush(130, 58, 6)}` },
  Z: { vb: "0 0 100 200", svg:
    `<path d="M0 200 Q6 148 50 146 Q94 148 100 200Z" fill="#212529" opacity=".7"/>
     <path d="M20 40 L24 8 L36 30 L44 4 L52 30 L64 6 L68 32 L80 12 L80 44Z" fill="#212529"/>
     <path d="M16 78 Q12 128 50 132 Q88 128 84 78 Q70 104 50 104 Q30 104 16 78Z" fill="#212529"/>
     ${ICON_FACE(50, 76, 33, "#e3a76f")}${eye(38, 70, 7)}${eye(62, 70, 7)}${brow(26, 56, 45, 63, 5)}${brow(74, 56, 55, 63, 5)}
     <path d="M36 90 Q50 112 64 90 Q50 96 36 90Z" fill="#7a1010" stroke="#222" stroke-width="2"/><path d="M42 92 h16" stroke="#fff" stroke-width="3"/>` },
  R: { vb: "0 0 100 200", svg:
    `<path d="M0 200 Q6 148 50 146 Q94 148 100 200Z" fill="#1864ab" opacity=".6"/>
     <path d="M34 44 Q50 14 66 44Z" fill="#dee2e6" stroke="#495057" stroke-width="3"/><path d="M50 14 Q44 -2 56 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
     ${ICON_FACE(50, 76, 33, "#ffe0bd")}<path d="M17 66 Q50 38 83 66 Q70 52 50 52 Q30 52 17 66Z" fill="#dee2e6" stroke="#495057" stroke-width="3"/>
     ${eye(38, 76, 7)}${eye(62, 76, 7)}${brow(28, 62, 44, 66)}${brow(72, 62, 56, 66)}${blush(27, 90, 6)}${blush(73, 90, 6)}${smile(50, 92, 11, 6)}` },
  M: { vb: "0 0 100 200", svg:
    `<path d="M0 200 Q6 148 50 146 Q94 148 100 200Z" fill="#a61e00" opacity=".55"/>
     <path d="M36 40 Q24 8 6 4 Q26 12 40 32" fill="none" stroke="#fa5252" stroke-width="6" stroke-linecap="round"/><path d="M64 40 Q76 8 94 4 Q74 12 60 32" fill="none" stroke="#fa5252" stroke-width="6" stroke-linecap="round"/>
     <path d="M18 62 Q50 20 82 62Z" fill="#c92a2a" stroke="#7a1010" stroke-width="3"/>
     ${ICON_FACE(50, 78, 31, "#ffd8a8")}<path d="M19 62 Q50 40 81 62 Q50 54 19 62Z" fill="#c92a2a"/>
     ${eye(39, 78, 7)}${eye(61, 78, 7)}${brow(28, 64, 45, 69)}${brow(72, 64, 55, 69)}${blush(27, 92, 6)}${blush(73, 92, 6)}${smile(50, 94, 10, 6)}` },
  H: { vb: "0 0 100 200", svg:
    `<path d="M0 200 Q6 148 50 146 Q94 148 100 200Z" fill="#5f3dc4" opacity=".6"/>
     <path d="M16 70 Q14 28 50 24 Q86 28 84 70Z" fill="#f1f3f5" stroke="#868e96" stroke-width="3"/>
     <path d="M20 84 Q16 140 50 150 Q84 140 80 84 Q66 112 50 112 Q34 112 20 84Z" fill="#f8f9fa" stroke="#868e96" stroke-width="3"/>
     ${ICON_FACE(50, 78, 29, "#ffe0bd")}<path d="M20 66 Q50 36 80 66 Q66 52 50 52 Q34 52 20 66Z" fill="#f1f3f5" stroke="#868e96" stroke-width="2"/>
     <path d="M30 70 Q39 64 47 70" fill="none" stroke="#555" stroke-width="3.5" stroke-linecap="round"/><path d="M53 70 Q61 64 70 70" fill="none" stroke="#555" stroke-width="3.5" stroke-linecap="round"/>
     <circle cx="39" cy="78" r="4" fill="#222"/><circle cx="61" cy="78" r="4" fill="#222"/>${brow(28, 60, 44, 62, 4)}${brow(72, 60, 56, 62, 4)}${blush(30, 90, 5)}${blush(70, 90, 5)}${smile(50, 98, 9, 5)}` },
  s: { vb: "0 0 100 100", svg:
    `<path d="M10 100 Q14 78 50 76 Q86 78 90 100Z" fill="#495057" opacity=".5"/>
     <path d="M28 42 Q50 8 72 42Z" fill="#495057" stroke="#212529" stroke-width="3"/><circle cx="50" cy="14" r="6" fill="#fa5252"/>
     ${ICON_FACE(50, 52, 22, "#ffe0bd")}<path d="M28 44 Q50 28 72 44Z" fill="#495057"/>
     <circle cx="42" cy="54" r="3.6" fill="#222"/><circle cx="58" cy="54" r="3.6" fill="#222"/><circle cx="43.2" cy="52.8" r="1.1" fill="#fff"/><circle cx="59.2" cy="52.8" r="1.1" fill="#fff"/>${blush(33, 62, 4.5)}${blush(67, 62, 4.5)}<path d="M43 63 Q50 70 57 63" fill="none" stroke="#a61e4d" stroke-width="2.6" stroke-linecap="round"/>` },
};
const STAR = (on: boolean) => `<svg viewBox="0 0 24 24"><path d="M12 1.8l3 6.5 7.1.9-5.2 4.9 1.4 7L12 17.6 5.7 21.1l1.4-7L1.9 9.2l7.1-.9z" fill="${on ? "#ffd43b" : "#e9ecef"}" stroke="${on ? "#e8890c" : "#ced4da"}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const LOCK = `<svg viewBox="0 0 24 24" class="klotski-lock"><rect x="4" y="10" width="16" height="12" rx="3" fill="#adb5bd" stroke="#6c757d" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#6c757d" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const MINI_COLOR: Record<K.Kind, string> = { C: "#fcc419", G: "#40c057", Z: "#868e96", R: "#4dabf7", M: "#ff922b", H: "#9775fa", s: "#ced4da" };

/** shortest-solution cache: the search takes a fraction of a second for the big levels, so it is made once per level and per run */
const minCache = new Map<string, number>();
const minKey = (l: K.Level) => l.rows.join("/");
const minOf = (l: K.Level): number => {
  let m = minCache.get(minKey(l));
  if (m === undefined) { m = K.minMoves(l.rows) ?? -1; minCache.set(minKey(l), m); }
  return m;
};

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  let disposed = false, cleanup: (() => void) | null = null;
  const holder = h("div", { class: "klotski-root" });
  root.append(holder);

  const stars = () => ctx.store.get<Record<string, number>>("stars", {});
  const bests = () => ctx.store.get<Record<string, number>>("best", {});
  const unlocked = (i: number) => i === 0 || (stars()[K.LEVELS[i - 1].id] ?? 0) > 0;
  const starRow = (n: number) => { const e = h("div", { class: "klotski-stars" }); e.innerHTML = [1, 2, 3].map((i) => STAR(i <= n)).join(""); return e; };
  const clear = () => { cleanup?.(); cleanup = null; holder.replaceChildren(); };

  /* ================= the level list ================= */
  function showSelect() {
    clear();
    const st = stars();
    const total = K.LEVELS.reduce((a, l) => a + (st[l.id] ?? 0), 0);
    const grid = h("div", { class: "klotski-levels", id: "klotski-levels" });
    const mins: HTMLElement[] = [];
    K.LEVELS.forEach((l, i) => {
      const open = unlocked(i), ps = K.parseLayout(l.rows);
      const mini = h("div", { class: "klotski-mini" });
      for (const p of ps) { const e = h("i", { style: `left:${(p.x / 4) * 100}%;top:${(p.y / 5) * 100}%;width:${(p.w / 4) * 100}%;height:${(p.h / 5) * 100}%;background:${MINI_COLOR[p.kind]}` }); mini.append(e); }
      const min = h("span", { class: "klotski-min" }, "计算中…");
      mins.push(min);
      const card = h("button", { class: "klotski-lv" + (open ? "" : " locked"), "data-level": l.id, "data-open": open ? "1" : "0",
        onclick: () => { if (!open) { ctx.sfx("bad"); ctx.toast("通过前一关后，本关才会开放。"); return; } ctx.sfx("tap"); showPlay(i); } },
        h("span", { class: "klotski-no" }, `第${i + 1}关`), mini, h("b", {}, l.name), min, starRow(st[l.id] ?? 0));
      if (!open) { const lk = h("span", {}); lk.innerHTML = LOCK; card.append(lk.firstChild as Node); }
      grid.append(card);
    });
    holder.append(h("div", { class: "klotski-scroll" },
      h("p", { class: "klotski-lead" }, "将最大的方块（曹操）移到下方出口。"),
      h("p", { class: "klotski-total", id: "klotski-total" }, `星星：${total} / ${K.LEVELS.length * 3}`), grid));
    // the shortest solutions are searched one level after the other, so the list is there at once
    let k = 0;
    const next = () => {
      if (disposed || k >= K.LEVELS.length) return;
      const l = K.LEVELS[k], el = mins[k]; k++;
      if (el.isConnected) el.textContent = `最少 ${minOf(l)} 步`;
      later(next, 0);
    };
    later(next, 30);
  }

  /* ================= one level ================= */
  function showPlay(index: number) {
    clear();
    const level = K.LEVELS[index];
    let ps = K.parseLayout(level.rows), history: K.Piece[][] = [], moves = 0, selected = -1, won = false, hinted: { id: number; x: number; y: number } | null = null;
    let min = minCache.get(minKey(level)) ?? 0;
    const els = new Map<number, HTMLElement>();
    let cell = 60;

    const title = h("span", { class: "klotski-title" }, h("span", {}, `第${index + 1}关`), h("span", { class: "klotski-lvname" }, level.name));
    const movesChip = h("span", { class: "klotski-chip", id: "klotski-moves" });
    const minChip = h("span", { class: "klotski-chip gold", id: "klotski-min" });
    const bestChip = h("span", { class: "klotski-chip", id: "klotski-best" });
    const setChips = () => {
      movesChip.textContent = `步数 ${moves}`;
      minChip.textContent = min > 0 ? `最少 ${min} 步` : "计算中…";
      const b = bests()[level.id];
      bestChip.textContent = b ? `最好 ${b} 步` : "";
      bestChip.style.display = b ? "" : "none";
    };
    const board = h("div", { class: "klotski-board", id: "klotski-board" });
    const frame = h("div", { class: "klotski-frame" }, board, h("div", { class: "klotski-exit" }), h("div", { class: "klotski-exit-label" }, "出口"));
    const wrap = h("div", { class: "klotski-wrap" }, frame);
    const undoBtn = h("button", { id: "klotski-undo", onclick: () => undo() }, "撤销");
    const resetBtn = h("button", { id: "klotski-reset", onclick: () => restart() }, "重来");
    const hintBtn = h("button", { id: "klotski-hint", onclick: () => showHint() }, "提示");
    const listBtn = h("button", { id: "klotski-list", onclick: () => { ctx.sfx("tap"); showSelect(); } }, "关卡");
    const play = h("div", { class: "klotski-play" },
      h("div", { class: "klotski-top" }, title, movesChip, minChip, bestChip), wrap,
      h("p", { class: "klotski-help" }, "先点击方块，再点击虚线框；也可直接拖动。"),
      h("div", { class: "klotski-btns" }, listBtn, undoBtn, resetBtn, hintBtn));
    holder.append(play);

    const pos = (p: K.Piece, x = p.x, y = p.y) => {
      const e = els.get(p.id)!, g = Math.max(2, cell * 0.03);
      e.style.left = `${x * cell + g}px`; e.style.top = `${y * cell + g}px`; e.style.width = `${p.w * cell - 2 * g}px`; e.style.height = `${p.h * cell - 2 * g}px`;
    };
    const drawGhosts = () => {
      board.querySelectorAll(".klotski-ghost").forEach((g) => g.remove());
      if (selected < 0 || won) return;
      const p = ps.find((q) => q.id === selected)!;
      K.reachable(ps, selected).forEach((t, i) => {
        const g = h("div", { class: "klotski-ghost" + (hinted && hinted.id === selected && hinted.x === t.x && hinted.y === t.y ? " hinted" : ""), "data-x": t.x, "data-y": t.y,
          style: `left:${t.x * cell + 2}px;top:${t.y * cell + 2}px;width:${p.w * cell - 4}px;height:${p.h * cell - 4}px;z-index:${1}` });
        g.style.zIndex = String(1 + Math.max(0, 40 - i));
        g.addEventListener("pointerup", (ev) => { ev.stopPropagation(); if (!won) commit(p.id, t.x, t.y); });
        board.append(g);
      });
    };
    const refresh = () => {
      for (const p of ps) { pos(p); const e = els.get(p.id)!; e.dataset.x = String(p.x); e.dataset.y = String(p.y); e.classList.toggle("sel", p.id === selected); e.classList.toggle("hinted", !!hinted && hinted.id === p.id && p.id !== selected); }
      drawGhosts(); setChips();
      undoBtn.disabled = history.length === 0 || won; hintBtn.disabled = won;
    };
    const layout = () => {
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (W < 10 || H < 10) return;
      // frame = board + 2 x 12 % + the borders; the exit label needs 0.3 of a cell below
      cell = Math.max(24, Math.min(124, Math.floor(Math.min((W - 14) / 4.24, (H - 14) / 5.6))));
      frame.style.setProperty("--c", `${cell}px`);
      refresh();
    };

    // pieces
    for (const p of ps) {
      const e = h("div", { class: `klotski-piece k-${p.kind}`, "data-id": p.id, "data-kind": p.kind, "data-x": p.x, "data-y": p.y });
      e.innerHTML = `<svg viewBox="${art[p.kind].vb}" preserveAspectRatio="xMidYMid slice">${art[p.kind].svg}</svg>`;
      e.append(h("span", { class: "klotski-name" }, K.NAMES[p.kind]));
      els.set(p.id, e); board.append(e);
      attachDrag(p.id, e);
    }

    function attachDrag(id: number, e: HTMLElement) {
      let down: { x: number; y: number; px: number; py: number } | null = null, dragged = false, target = { x: 0, y: 0 }, places: { x: number; y: number }[] = [];
      e.addEventListener("pointerdown", (ev) => {
        if (won || (ev.pointerType === "mouse" && ev.button !== 0)) return;
        const p = ps.find((q) => q.id === id)!;
        down = { x: ev.clientX, y: ev.clientY, px: p.x, py: p.y }; dragged = false; target = { x: p.x, y: p.y };
        places = [{ x: p.x, y: p.y }, ...K.reachable(ps, id)];
        try { e.setPointerCapture(ev.pointerId); } catch { /* ok */ }
        ev.preventDefault();
      });
      e.addEventListener("pointermove", (ev) => {
        if (!down) return;
        const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
        if (!dragged && Math.hypot(dx, dy) < Math.max(6, cell * 0.12)) return;
        if (!dragged) { dragged = true; e.classList.add("drag"); }
        const fx = down.px + dx / cell, fy = down.py + dy / cell;
        let best = places[0], bd = Infinity;
        for (const q of places) { const d = (q.x - fx) ** 2 + (q.y - fy) ** 2; if (d < bd) { bd = d; best = q; } }
        if (best.x !== target.x || best.y !== target.y) { target = best; const p = ps.find((q) => q.id === id)!; pos(p, best.x, best.y); }
      });
      const end = (ev: PointerEvent, cancel: boolean) => {
        if (!down) return;
        ev.stopPropagation();
        const d = down, wasDrag = dragged; down = null; dragged = false;
        e.classList.remove("drag");
        try { e.releasePointerCapture(ev.pointerId); } catch { /* ok */ }
        const p = ps.find((q) => q.id === id)!;
        if (wasDrag && !cancel) {
          if (target.x !== d.px || target.y !== d.py) { selected = -1; hinted = null; commit(id, target.x, target.y); }
          else { pos(p); }
          return;
        }
        if (cancel) { pos(p); return; }
        // a tap: select / unselect
        hinted = null;
        selected = selected === id ? -1 : id;
        ctx.sfx("tap");
        refresh();
      };
      e.addEventListener("pointerup", (ev) => end(ev, false));
      e.addEventListener("pointercancel", (ev) => end(ev, true));
    }
    // a tap on the empty board: the nearest place the selected piece can go to
    board.addEventListener("pointerup", (ev) => {
      if (won || selected < 0) return;
      const r = board.getBoundingClientRect(), cx = Math.floor((ev.clientX - r.left) / cell), cy = Math.floor((ev.clientY - r.top) / cell);
      const p = ps.find((q) => q.id === selected)!;
      const t = K.reachable(ps, selected).find((q) => cx >= q.x && cx < q.x + p.w && cy >= q.y && cy < q.y + p.h);
      if (t) commit(selected, t.x, t.y); else { selected = -1; refresh(); }
    });

    function commit(id: number, x: number, y: number) {
      if (won) return;
      const legal = K.reachable(ps, id).some((q) => q.x === x && q.y === y);
      if (!legal) return;
      history.push(K.clone(ps)); moves++; selected = -1; hinted = null;
      ps = K.moveTo(ps, id, x, y);
      ctx.sfx("move"); refresh();
      if (K.solved(ps)) win();
    }
    function undo() {
      if (won || !history.length) return;
      ps = history.pop()!; moves--; selected = -1; hinted = null; ctx.sfx("tap"); refresh();
    }
    function restart() {
      if (won) return;
      ctx.sfx("tap"); ps = K.parseLayout(level.rows); history = []; moves = 0; selected = -1; hinted = null; refresh();
    }
    function showHint() {
      if (won) return;
      const hh = K.hint(ps);
      if (!hh) return;
      hinted = hh; selected = hh.id; ctx.sfx("tap"); refresh();
    }
    function win() {
      won = true; selected = -1; hinted = null; if (!min) min = minOf(level);
      refresh();
      const st = stars(), b = bests();
      const n = K.starsFor(moves, min), isBest = !b[level.id] || moves < b[level.id];
      ctx.store.set("stars", { ...st, [level.id]: Math.max(st[level.id] ?? 0, n) });
      if (isBest) ctx.store.set("best", { ...b, [level.id]: moves });
      setChips();
      ctx.sfx("win");
      const cao = els.get(ps.find((q) => q.kind === "C")!.id)!;
      cao.classList.add("escape"); cao.style.top = `${5 * cell + 6}px`;
      later(overlay, 900);
      const sNow = Math.max(st[level.id] ?? 0, n);
      function overlay() {
        const last = index === K.LEVELS.length - 1, all = K.LEVELS.every((l) => (l.id === level.id ? sNow : (stars()[l.id] ?? 0)) > 0);
        const card = h("div", { class: "klotski-card", id: "klotski-win" },
          h("h2", {}, "曹操已到达出口。"), starRow(n),
          h("p", {}, `用了 ${moves} 步`),
          h("p", {}, moves <= min ? "已达到最少步数。" : `最少 ${min} 步，你的最好成绩 ${Math.min(moves, b[level.id] ?? moves)} 步`),
          all && last ? h("p", {}, "已通过全部关卡。") : null,
          h("div", { class: "klotski-btns" },
            last ? null : h("button", { class: "primary", id: "klotski-next", onclick: () => { ctx.sfx("tap"); showPlay(index + 1); } }, "下一关"),
            h("button", { id: "klotski-again", onclick: () => { ctx.sfx("tap"); showPlay(index); } }, "再玩一次"),
            h("button", { id: "klotski-back", onclick: () => { ctx.sfx("tap"); showSelect(); } }, "关卡")));
        holder.append(h("div", { class: "klotski-over" }, card));
      }
    }

    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    cleanup = () => window.removeEventListener("resize", onResize);
    setChips();
    layout();
    later(layout, 60);
    if (!min) later(() => { if (disposed || !play.isConnected) return; min = minOf(level); setChips(); }, 40);
  }

  showSelect();
  return () => { disposed = true; cleanup?.(); timers.forEach((t) => clearTimeout(t)); timers.clear(); };
}
