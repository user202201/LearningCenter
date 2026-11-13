/**
 * 编程 world 14 (数据与编码) and the shared kinds of world 15: the interactive labs. Every lab is `mount(root, io) -> { solve, wrong }`: it builds its controls in
 * `root`, judges with the pure models (coding-infomodel.ts), reports through `io` (say / bad = a mistake / win) and offers `solve` (the reference answer, set through
 * the same controls and the same check: used by the tests) and `wrong` (a wrong answer). Pointer Events for dragging, a tap does the same as a drag.
 */
import { h } from "./ui";
import * as I from "./coding-infomodel";
import { figEl, gridEl } from "./coding-infoart";
import { InfoAct, InfoContent, L, fill, Tri } from "./coding-infocontent";

export interface Io {
  act: InfoAct; c: InfoContent; seed: number;
  say(t: string, kind?: "bad" | "ok" | ""): void;
  /** a mistake (a wrong answer) */
  bad(): void;
  /** solved; `stars` overrides the stars made from mistakes and hints (levels that count blocks) */
  win(stars?: number): void;
  prompt(t: string): void;
  /** the reference answer was looked at: at most 1 star */
  cheat(): void;
}
export interface Widget { solve(): void; wrong(): void; /** the last step of the hint ladder (the editor lights the next block) */ extraHint?(): string | void }
export type Mount = (root: HTMLElement, io: Io) => Widget;

export const btn = (id: string, text: string, onclick: () => void, cls = ""): HTMLButtonElement => h("button", { id, class: "ci-btn " + cls, type: "button", onclick }, text) as HTMLButtonElement;
const user = (t: string, cls = "") => h("span", { class: "user " + cls }, t);
const lab = (io: Io, k: string): string => (io.c.labels[k] ? L(io.c.labels[k]) : k);
export const clickEl = (el: Element | null): void => { (el as HTMLElement | null)?.click(); };

/** a drag of an element: `start` after 8 px of movement, `move` with the pointer, `drop` on release; a release without movement is a tap (handled by click) */
export function dragOn(el: HTMLElement, h2: { start(e: PointerEvent): void; move(e: PointerEvent): void; drop(e: PointerEvent): void }): void {
  let id = -1, x0 = 0, y0 = 0, on = false;
  el.addEventListener("pointerdown", (e) => { if (id >= 0 || (e.pointerType === "mouse" && e.button !== 0)) return; id = e.pointerId; x0 = e.clientX; y0 = e.clientY; on = false; });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    if (!on && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { on = true; try { el.setPointerCapture(id); } catch { /* ignore */ } h2.start(e); }
    if (on) h2.move(e);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const was = on; id = -1; on = false;
    if (was) { h2.drop(e); suppress(el); }
  };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
}
/** the click that follows a drag is ignored */
function suppress(el: HTMLElement) { const f = (e: Event) => { e.stopImmediatePropagation(); e.preventDefault(); }; el.addEventListener("click", f, { capture: true, once: true }); setTimeout(() => el.removeEventListener("click", f, { capture: true }), 400); }

// ---------- quiz: questions made by code ----------
export const quiz: Mount = (root, io) => {
  const s = io.act.spec, gens: string[] = Array.isArray(s.gen) ? s.gen : [s.gen], n: number = s.n ?? 4;
  let i = 0, q!: I.Q, fields: HTMLInputElement[] = [];
  const body = h("div", { class: "ci-qbody" }), prog = h("div", { class: "ci-prog" });
  const wheel = s.wheel ? caesarWheel() : null;
  root.append(prog, body);
  if (wheel) root.append(wheel.el);
  const gen = () => gens[i % gens.length];
  const make = () => {
    const spec = { ...s, gen: gen() };
    q = I.makeQuestion(spec as { gen: string }, io.seed * 131 + i * 977 + 5);
    const tpl = io.c.genPrompts[gen()];
    io.prompt(tpl ? fill(L(tpl), q.args) : "");
    prog.textContent = `${i + 1} / ${n}`;
    body.replaceChildren();
    if (q.fig) body.append(figEl(q.fig));
    fields = [];
    if (q.choices) {
      const row = h("div", { class: "ci-choices" });
      for (const ch of q.choices) row.append(h("button", { class: "ci-btn ci-choice", type: "button", "data-v": ch, onclick: () => submit([ch]) }, h("span", { class: "user" }, lab(io, ch))));
      body.append(row);
    } else {
      const m = Array.isArray(q.answer) ? q.answer.length : 1;
      const row = h("div", { class: "ci-fields" });
      for (let k = 0; k < m; k++) {
        const inp = h("input", { class: "ci-input user", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: false, "aria-label": "答案", inputmode: "text", "data-f": String(k), style: `width:${Math.max(4, Array.isArray(q.answer) ? 4.5 : String(q.answer).length + 3)}em` }) as HTMLInputElement;
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(fields.map((f) => f.value)); });
        fields.push(inp); row.append(inp);
      }
      body.append(row, btn("ci-check", "检查", () => submit(fields.map((f) => f.value)), "primary"));
      fields[0]?.focus({ preventScroll: true });
    }
    if (wheel) wheel.reset();
  };
  const submit = (given: string[]) => {
    if (!given.some((g) => g.trim())) return io.say("请先输入答案。", "bad");
    if (I.sameAnswer(given, q)) {
      i++;
      if (i >= n) { io.say("全部正确。", "ok"); return io.win(); }
      io.say("正确。", "ok"); make();
    } else { io.bad(); io.say("不对。请再试一次。", "bad"); }
  };
  make();
  return {
    solve: () => {
      for (let k = 0; k < n; k++) {
        if (q.choices) clickEl(body.querySelector(`.ci-choice[data-v="${CSS.escape(String(q.answer))}"]`));
        else { const ans = Array.isArray(q.answer) ? q.answer : [q.answer]; fields.forEach((f, j) => (f.value = ans[j])); clickEl(root.querySelector("#ci-check")); }
      }
    },
    wrong: () => { if (q.choices) { const w = q.choices.find((c) => c !== String(q.answer))!; clickEl(body.querySelector(`.ci-choice[data-v="${CSS.escape(w)}"]`)); } else { fields.forEach((f) => (f.value = "zz")); clickEl(root.querySelector("#ci-check")); } },
  };
};

/** two rings of letters: the inner one can be turned (the key of the Caesar cipher) */
function caesarWheel() {
  let k = 0;
  const el = h("div", { class: "ci-wheel user" });
  const R1 = 92, R2 = 66, cx = 105;
  const ring = (r: number, off: number, cls: string) => [...Array(26)].map((_, i) => { const a = ((i * 360) / 26 - 90) * Math.PI / 180; return `<text class="${cls}" x="${cx + Math.cos(a) * r}" y="${cx + Math.sin(a) * r + 4}" font-size="13" text-anchor="middle" font-weight="800">${String.fromCharCode(65 + ((i + off) % 26))}</text>`; }).join("");
  const draw = () => { el.querySelector<SVGGElement>("#ci-inner")!.setAttribute("transform", `rotate(${(k * 360) / 26} ${cx} ${cx})`); el.querySelector("#ci-key")!.textContent = String(k); };
  el.innerHTML = `<svg viewBox="0 0 210 210" class="ci-wheelsvg" role="img" aria-label="wheel"><circle cx="${cx}" cy="${cx}" r="102" fill="#e7f5ff" stroke="#74c0fc" stroke-width="3"/><circle cx="${cx}" cy="${cx}" r="78" fill="#fff9db" stroke="#ffd43b" stroke-width="3"/>${ring(R1, 0, "o")}<g id="ci-inner">${ring(R2, 0, "i")}</g></svg>`;
  const ctrl = h("div", { class: "ci-wctl" }, h("button", { class: "ci-btn", id: "ci-wm", type: "button", "aria-label": "减少", onclick: () => { k = (k + 25) % 26; draw(); } }, "−"), h("span", { class: "ci-key" }, "k = ", h("b", { id: "ci-key" }, "0")), h("button", { class: "ci-btn", id: "ci-wp", type: "button", "aria-label": "增加", onclick: () => { k = (k + 1) % 26; draw(); } }, "+"));
  el.append(ctrl);
  requestAnimationFrame(draw);
  return { el, reset: () => { k = 0; if (el.isConnected || el.querySelector("#ci-inner")) draw(); } };
}

// ---------- scenario: multiple-choice cards with an explanation ----------
export const scenario: Mount = (root, io) => {
  const qs: { p: string; o: string[]; a: number; w: string }[] = io.act.spec.qs;
  let i = 0, done = false;
  const card = h("div", { class: "ci-scen user" }), why = h("p", { class: "ci-why user", hidden: true }), next = btn("ci-next", "下一题", () => { i++; show(); }, "primary");
  const prog = h("div", { class: "ci-prog" });
  root.append(prog, card, why, next);
  const show = () => {
    if (i >= qs.length) { io.say("全部完成。", "ok"); done = true; next.hidden = true; return io.win(); }
    const q = qs[i];
    prog.textContent = `${i + 1} / ${qs.length}`;
    card.replaceChildren(h("p", { class: "ci-qtext" }, q.p), h("div", { class: "ci-choices col" }, ...q.o.map((t, k) => h("button", { class: "ci-btn ci-choice", type: "button", "data-i": String(k), onclick: (e: Event) => pick(k, e.currentTarget as HTMLElement) }, t))));
    why.hidden = true; next.hidden = true;
  };
  const pick = (k: number, el: HTMLElement) => {
    const q = qs[i];
    if (done || !next.hidden) return;
    why.textContent = q.w; why.hidden = false;
    if (k === q.a) { el.classList.add("right"); card.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true)); next.hidden = false; io.say("正确。", "ok"); if (i === qs.length - 1) next.textContent = "完成"; else next.textContent = "下一题"; }
    else { el.classList.add("wrong"); (el as HTMLButtonElement).disabled = true; io.bad(); io.say("不对。请再选一次。", "bad"); }
  };
  show();
  return {
    solve: () => { for (let k = 0; k < qs.length; k++) { clickEl(card.querySelector(`.ci-choice[data-i="${qs[k].a}"]`)); clickEl(next); } },
    wrong: () => { const q = qs[i]; clickEl(card.querySelector(`.ci-choice[data-i="${(q.a + 1) % q.o.length}"]`)); },
  };
};

// ---------- sort: cards into buckets (drag or tap card, tap bucket) ----------
export const sort: Mount = (root, io) => {
  const s = io.act.spec as { buckets: Tri[]; cards: { t: string; b: number }[] };
  const order = I.shuffle(s.cards.map((_, i) => i), I.rng(io.seed + 3));
  const place: (number | null)[] = s.cards.map(() => null);
  let sel = -1;
  const pool = h("div", { class: "ci-pool" }), zones = h("div", { class: "ci-zones" + (s.buckets.length > 2 ? " three" : "") });
  const bucketEls = s.buckets.map((b, bi) => h("div", { class: "ci-bucket", "data-b": String(bi), role: "button", tabIndex: 0, onclick: () => { if (sel >= 0) { place[sel] = bi; sel = -1; draw(); } } }, h("b", {}, L(b)), h("div", { class: "ci-bcards" })));
  zones.append(...bucketEls);
  const ghost = h("div", { class: "ci-ghost user", hidden: true });
  root.append(pool, zones, ghost, btn("ci-check", "检查", () => check(), "primary"));
  const cardEl = (ci: number) => {
    const el = h("button", { class: "ci-sc user" + (sel === ci ? " sel" : ""), type: "button", "data-c": String(ci), onclick: (e: Event) => { e.stopPropagation(); if (sel >= 0 && sel !== ci && place[ci] !== null) { place[sel] = place[ci]; sel = -1; } else if (place[ci] !== null) { place[ci] = null; sel = -1; } else sel = sel === ci ? -1 : ci; draw(); } }, s.cards[ci].t);
    dragOn(el, {
      start: () => { ghost.textContent = s.cards[ci].t; ghost.hidden = false; el.classList.add("drag"); },
      move: (e) => { ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px"; },
      drop: (e) => { ghost.hidden = true; const t = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".ci-bucket"); if (t) place[ci] = Number(t.dataset.b); else if (place[ci] !== null && document.elementFromPoint(e.clientX, e.clientY)?.closest(".ci-pool")) place[ci] = null; sel = -1; draw(); },
    });
    return el;
  };
  const draw = () => {
    pool.replaceChildren(...order.filter((ci) => place[ci] === null).map(cardEl));
    bucketEls.forEach((b, bi) => b.querySelector(".ci-bcards")!.replaceChildren(...order.filter((ci) => place[ci] === bi).map(cardEl)));
    bucketEls.forEach((b) => b.classList.toggle("target", sel >= 0));
  };
  const check = () => {
    if (place.some((p) => p === null)) return io.say("请先把所有卡片放好。", "bad");
    const wrong = s.cards.map((c, i) => (place[i] === c.b ? -1 : i)).filter((i) => i >= 0);
    if (!wrong.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.bad(); io.say(`有 ${wrong.length} 张放错了，已退回。`, "bad");
    for (const i of wrong) place[i] = null;
    draw();
  };
  draw();
  return {
    solve: () => { s.cards.forEach((c, i) => (place[i] = c.b)); draw(); check(); },
    wrong: () => { s.cards.forEach((c, i) => (place[i] = i === 0 ? (c.b + 1) % s.buckets.length : c.b)); draw(); check(); },
  };
};

// ---------- order: put the steps in the right order (drag a row, or the arrow buttons) ----------
export const order: Mount = (root, io) => {
  const items: string[] = io.act.spec.items;
  let seq = I.shuffle(items.map((_, i) => i), I.rng(io.seed + 9));
  if (seq.every((v, i) => v === i)) seq = seq.slice(1).concat(seq[0]);
  const list = h("div", { class: "ci-order", role: "list" });
  root.append(list, btn("ci-check", "检查", () => check(), "primary"));
  const move = (a: number, b: number) => { if (b < 0 || b >= seq.length) return; const [x] = seq.splice(a, 1); seq.splice(b, 0, x); draw(); };
  const draw = () => {
    list.replaceChildren(...seq.map((it, pos) => h("div", { class: "ci-orow", role: "listitem", "data-it": String(it), "data-pos": String(pos) },
      h("span", { class: "ci-grip", "aria-hidden": "true" }, String(pos + 1)), h("span", { class: "ci-otext user" }, items[it]),
      h("button", { class: "ci-btn ci-up", type: "button", "aria-label": "上移", onclick: () => move(pos, pos - 1) }, "▲"), h("button", { class: "ci-btn ci-down", type: "button", "aria-label": "下移", onclick: () => move(pos, pos + 1) }, "▼"))));
  };
  // dragging: the listeners sit on the list (it never moves, so the pointer capture is never lost while rows change places)
  let d: { id: number; x: number; y: number; it: number; on: boolean } | null = null;
  list.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement, row = t.closest<HTMLElement>(".ci-orow");
    if (!row || t.closest("button") || d || (e.pointerType === "mouse" && e.button !== 0)) return;
    d = { id: e.pointerId, x: e.clientX, y: e.clientY, it: Number(row.dataset.it), on: false };
  });
  list.addEventListener("pointermove", (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { d.on = true; try { list.setPointerCapture(d.id); } catch { /* ignore */ } }
    if (!d.on) return;
    const rows = [...list.children] as HTMLElement[];
    let to = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (to < 0) to = rows.length - 1;
    const at = seq.indexOf(d.it);
    if (to !== at) { const [x] = seq.splice(at, 1); seq.splice(to, 0, x); const el = rows[at]; list.insertBefore(el, to > at ? rows[to].nextSibling : rows[to]); [...list.children].forEach((r, k) => { (r.querySelector(".ci-grip") as HTMLElement).textContent = String(k + 1); (r as HTMLElement).dataset.pos = String(k); }); }
    list.querySelectorAll(".ci-orow").forEach((r) => r.classList.toggle("drag", Number((r as HTMLElement).dataset.it) === d!.it));
  });
  const end = (e: PointerEvent) => { if (!d || e.pointerId !== d.id) return; const was = d.on; d = null; if (was) { draw(); suppress(list); } };
  list.addEventListener("pointerup", end); list.addEventListener("pointercancel", end);
  const check = () => {
    const wrong = seq.filter((v, p) => v !== p).length;
    if (!wrong) { io.say("顺序正确。", "ok"); return io.win(); }
    io.bad(); io.say("顺序不对。请再调整。", "bad");
  };
  draw();
  return { solve: () => { seq = items.map((_, i) => i); draw(); check(); }, wrong: () => { seq = items.map((_, i) => i); [seq[0], seq[1]] = [seq[1], seq[0]]; draw(); check(); } };
};

// ---------- pick: choose all that apply (the antivirus scan) ----------
export const pick: Mount = (root, io) => {
  const s = io.act.spec as { items: { t: string; bad: boolean; risk?: number; why?: string }[]; scan?: boolean; action?: string };
  const chosen = new Set<number>();
  let scanned = !s.scan;
  const list = h("div", { class: "ci-pick" }), why = h("p", { class: "ci-why user", hidden: true });
  const scanBtn = btn("ci-scan", "开始扫描", () => { scanned = true; scanBtn.hidden = true; draw(); io.say("扫描完成。", "ok"); });
  scanBtn.hidden = !s.scan;
  root.append(scanBtn, list, why, btn("ci-check", "检查", () => check(), "primary"));
  const draw = () => list.replaceChildren(...s.items.map((it, i) => h("button", { class: "ci-btn ci-file user" + (chosen.has(i) ? " sel" : ""), type: "button", "data-i": String(i), "aria-pressed": String(chosen.has(i)), onclick: () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); draw(); } },
    h("span", { class: "ci-fname" }, it.t), scanned && it.risk !== undefined ? h("span", { class: "ci-risk r" + it.risk }, "●".repeat(it.risk + 1)) : null, chosen.has(i) ? h("span", { class: "ci-mark" }, "✓") : null)));
  const check = () => {
    const wrong = s.items.map((it, i) => (chosen.has(i) !== it.bad ? i : -1)).filter((i) => i >= 0);
    if (!wrong.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.bad(); io.say("还不对。请再检查每一项。", "bad");
    why.textContent = s.items[wrong[0]].why ?? ""; why.hidden = !why.textContent;
  };
  draw();
  return { solve: () => { if (!scanned) clickEl(scanBtn); chosen.clear(); s.items.forEach((it, i) => it.bad && chosen.add(i)); draw(); check(); }, wrong: () => { chosen.clear(); draw(); check(); } };
};

// ---------- bits: switches ----------
export const bits: Mount = (root, io) => {
  const s = io.act.spec as { mode: "dec2bin" | "add"; bits: number; rounds: number };
  const r = I.rng(io.seed + 1);
  let round = 0, target = 0, a = 0, b = 0;
  const sw = Array(s.mode === "add" ? s.bits + 1 : s.bits).fill(0);
  const info = h("div", { class: "ci-bitinfo" }), row = h("div", { class: "ci-switches" }), val = h("div", { class: "ci-val" }), prog = h("div", { class: "ci-prog" });
  root.append(prog, info, row, val, btn("ci-check", "检查", () => check(), "primary"));
  const cur = () => sw.reduce((v, x) => v * 2 + x, 0);
  const draw = () => {
    const btns = sw.map((v, i) => h("button", { class: "ci-btn ci-sw" + (v ? " on" : ""), type: "button", "data-i": String(i), "aria-pressed": String(!!v), "aria-label": `bit ${sw.length - 1 - i}`, onclick: () => { sw[i] ^= 1; draw(); } }, h("small", {}, String(2 ** (sw.length - 1 - i))), h("b", {}, String(v))));
    const groups: HTMLElement[] = [];
    for (let g = sw.length; g > 0; g -= 4) groups.unshift(h("div", { class: "ci-nib" }, ...btns.slice(Math.max(0, g - 4), g)));   // groups of four from the right (a byte = two nibbles)
    row.replaceChildren(...groups);
    val.textContent = `= ${cur()}`;
  };
  const next = () => {
    sw.fill(0);
    prog.textContent = `${round + 1} / ${s.rounds}`;
    if (s.mode === "dec2bin") {
      target = I.rint(r, round === 0 ? 1 : 2, 2 ** s.bits - 1); if (round === s.rounds - 1) target = 2 ** s.bits - 1 - I.rint(r, 0, 3);
      io.prompt(fill(L(io.c.genPrompts.binWrite), [target]));
      info.replaceChildren(h("span", { class: "ci-big" }, String(target)));
    } else {
      a = I.rint(r, 1, 2 ** s.bits - 2); b = I.rint(r, 1, 2 ** s.bits - 1 - a);
      io.prompt(fill(L(io.c.genPrompts.binAdd), [I.toBin(a, s.bits), I.toBin(b, s.bits)]));
      info.replaceChildren(figEl({ t: "lamps", bits: I.toBin(a, s.bits) }), h("span", { class: "ci-plus" }, "+"), figEl({ t: "lamps", bits: I.toBin(b, s.bits) }));
      target = a + b;
    }
    draw();
  };
  const check = () => {
    if (cur() === target) { round++; if (round >= s.rounds) { io.say("全部正确。", "ok"); return io.win(); } io.say("正确。", "ok"); return next(); }
    io.bad(); io.say("数值不对。请再检查每个开关。", "bad");
  };
  next();
  const setTo = (n: number) => { const t = I.toBin(n, sw.length); sw.forEach((_, i) => (sw[i] = Number(t[i]))); draw(); };
  return {
    solve: () => { for (let k = 0; k < s.rounds; k++) { setTo(target); check(); } },
    wrong: () => { setTo((target + 1) % 2 ** sw.length); check(); },
  };
};

// ---------- pixel: paint, read the numbers, decode numbers ----------
export function paintGrid(n: number, onChange: () => void, opts: { id?: string; big?: boolean } = {}) {
  const cells = Array(n * n).fill(0);
  const el = h("div", { class: "ci-pixedit" + (opts.big ? " big" : ""), style: `--w:${n}`, "data-n": String(n), id: opts.id ?? "" });
  const refresh = () => el.querySelectorAll("i").forEach((c, i) => c.classList.toggle("on", !!cells[i]));
  el.innerHTML = Array.from({ length: n * n }, (_, i) => `<i data-i="${i}"></i>`).join("");
  let paint = -1, pid = -1, last: [number, number] | null = null;
  /** the square under the pointer, from the LAYOUT size of the grid (not from what is under the pointer: a fast drag may jump over squares) */
  const at = (e: PointerEvent): [number, number] | null => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const x = Math.floor(((e.clientX - r.left) / r.width) * n), y = Math.floor(((e.clientY - r.top) / r.height) * n);
    return x >= 0 && y >= 0 && x < n && y < n ? [x, y] : null;
  };
  /** every square on the straight line between two squares (the pointer events of a fast finger are far apart) */
  const line = (a: [number, number], b: [number, number]): [number, number][] => {
    const out: [number, number][] = [], steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= steps; i++) out.push([Math.round(a[0] + ((b[0] - a[0]) * i) / steps), Math.round(a[1] + ((b[1] - a[1]) * i) / steps)]);
    return out;
  };
  el.addEventListener("pointerdown", (e) => { const c = at(e); if (!c) return; pid = e.pointerId; try { el.setPointerCapture(pid); } catch { /* ignore */ } paint = cells[c[1] * n + c[0]] ? 0 : 1; cells[c[1] * n + c[0]] = paint; last = c; refresh(); onChange(); e.preventDefault(); });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid || !last) return;
    const c = at(e); if (!c) return;
    let changed = false;
    for (const [x, y] of line(last, c)) if (cells[y * n + x] !== paint) { cells[y * n + x] = paint; changed = true; }
    last = c;
    if (changed) { refresh(); onChange(); }
  });
  const up = (e: PointerEvent) => { if (e.pointerId === pid) { pid = -1; last = null; } };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  return { el, rows: (): string[] => Array.from({ length: n }, (_, y) => cells.slice(y * n, y * n + n).join("")), cells: (): number[] => cells.slice(), set: (rows: string[]) => { rows.forEach((r, y) => [...r].forEach((c, x) => (cells[y * n + x] = Number(c)))); refresh(); onChange(); }, clear: () => { cells.fill(0); refresh(); onChange(); }, count: () => cells.reduce((a: number, b: number) => a + b, 0) };
}
export const pixel: Mount = (root, io) => {
  const s = io.act.spec as { mode: "paint" | "nums" | "decode" | "free"; pic?: string; size?: number };
  const pic = s.pic ? I.PICS[s.pic] : null;
  io.prompt(L(io.act.prompt));
  if (s.mode === "paint" && pic) {
    const g = paintGrid(8, () => {});
    root.append(h("div", { class: "ci-pixpair" }, h("div", {}, h("small", {}, "目标"), gridEl(pic)), h("div", {}, h("small", {}, "你的图"), g.el)), btn("ci-check", "检查", () => check(), "primary"));
    const check = () => { if (g.rows().join() === pic.join()) { io.say("图案一致。", "ok"); io.win(); } else { io.bad(); io.say("图案还不一样。请对照目标。", "bad"); } };
    return { solve: () => { g.set(pic); check(); }, wrong: () => { g.set(pic.map((r) => r.replace(/1/, "0"))); check(); } };
  }
  if (s.mode === "nums" && pic) {
    const nums = I.rowNumbers(pic), inputs: HTMLInputElement[] = [];
    const rows = h("div", { class: "ci-numrows" });
    pic.forEach((r, y) => { const inp = h("input", { class: "ci-input small user", type: "text", inputmode: "numeric", "data-r": String(y), "aria-label": "答案", autocomplete: "off" }) as HTMLInputElement; inputs.push(inp); rows.append(h("div", { class: "ci-numrow" }, gridEl([r]), inp)); });
    root.append(rows, btn("ci-check", "检查", () => check(), "primary"));
    const check = () => { const bad = inputs.filter((x, y) => x.value.trim() !== String(nums[y])).length; if (!bad) { io.say("全部正确。", "ok"); io.win(); } else { io.bad(); io.say(`有 ${bad} 行不对。每一行是一个二进制数。`, "bad"); } };
    return { solve: () => { inputs.forEach((x, y) => (x.value = String(nums[y]))); check(); }, wrong: () => { inputs.forEach((x) => (x.value = "0")); check(); } };
  }
  if (s.mode === "decode" && pic) {
    const nums = I.rowNumbers(pic), g = paintGrid(8, () => {});
    root.append(h("div", { class: "ci-pixpair" }, h("div", { class: "ci-numlist user" }, ...nums.map((n) => h("span", {}, String(n)))), g.el), btn("ci-check", "检查", () => check(), "primary"));
    const check = () => { const mine = I.rowNumbers(g.rows()); if (mine.join() === nums.join()) { io.say("图案正确。", "ok"); io.win(); } else { io.bad(); io.say("有些行的数字不对。每个数字写成 8 位二进制。", "bad"); } };
    return { solve: () => { g.set(pic); check(); }, wrong: () => { g.set(pic.map(() => "00000000")); check(); } };
  }
  // free: 16 x 16 black / white, then the size in bytes
  const n = s.size ?? 16, live = h("div", { class: "ci-live user" }), ans = h("input", { class: "ci-input user", type: "text", inputmode: "numeric", id: "ci-bytes", "aria-label": "答案", autocomplete: "off" }) as HTMLInputElement;
  const g = paintGrid(n, () => { live.textContent = `${g.count()} / ${n * n}`; });
  live.textContent = `0 / ${n * n}`;
  root.append(g.el, live, h("div", { class: "ci-fields" }, ans), btn("ci-check", "检查", () => check(), "primary"));
  const check = () => {
    if (g.count() < 12) return io.say("请先画一幅图（至少 12 个黑点）。", "bad");
    if (ans.value.trim() === String(I.imageBytes(n, n, 1))) { io.say("正确。", "ok"); io.win(); } else { io.bad(); io.say("字节数不对。1 字节 = 8 位。", "bad"); }
  };
  return { solve: () => { g.set(I.PICS.heart.map((r) => r + r).concat(I.PICS.heart.map((r) => r + r))); ans.value = String(I.imageBytes(n, n, 1)); check(); }, wrong: () => { g.set(I.PICS.heart.map((r) => r + r).concat(I.PICS.heart.map((r) => r + r))); ans.value = "1"; check(); } };
};

// ---------- rgb mixing ----------
export const rgbmix: Mount = (root, io) => {
  const s = io.act.spec as { targets: number[][]; tol: number };
  let round = 0;
  const target = h("span", { class: "ci-swatch", id: "ci-target" }), mine = h("span", { class: "ci-swatch", id: "ci-mine" }), hex = h("code", { class: "user" });
  const sl = ["R", "G", "B"].map((n, i) => h("label", { class: "ci-slide user" }, n, h("input", { type: "range", min: "0", max: "255", step: "5", value: "0", "data-ch": String(i), "aria-label": n, oninput: () => upd() }), h("b", {}, "0")));
  const inputs = sl.map((l) => l.querySelector("input") as HTMLInputElement);
  const prog = h("div", { class: "ci-prog" });
  root.append(prog, h("div", { class: "ci-swatches" }, target, mine), hex, ...sl, btn("ci-check", "检查", () => check(), "primary"));
  const val = () => inputs.map((x) => Number(x.value));
  const upd = () => { const v = val(); mine.style.background = `rgb(${v.join(",")})`; hex.textContent = `rgb(${v.join(", ")})  ${I.rgbHex(v[0], v[1], v[2])}`; sl.forEach((l, i) => (l.querySelector("b")!.textContent = String(v[i]))); };
  const show = () => { const t = s.targets[round]; target.style.background = `rgb(${t.join(",")})`; prog.textContent = `${round + 1} / ${s.targets.length}`; io.prompt(L(io.act.prompt)); inputs.forEach((x) => (x.value = "0")); upd(); };
  const check = () => { if (I.colorDist(val(), s.targets[round]) <= s.tol) { round++; if (round >= s.targets.length) { io.say("全部正确。", "ok"); return io.win(); } io.say("正确。", "ok"); show(); } else { io.bad(); io.say("颜色还不够接近。请调整滑块。", "bad"); } };
  show();
  const setV = (v: number[]) => { inputs.forEach((x, i) => (x.value = String(v[i]))); upd(); };
  return { solve: () => { for (let k = 0; k < s.targets.length; k++) { setV(s.targets[round]); check(); } }, wrong: () => { setV(s.targets[round].map((v) => 255 - v)); check(); } };
};

// ---------- sampling ----------
export const wave: Mount = (root, io) => {
  const s = io.act.spec as { freq: number; rates: number[] };
  const need = s.rates.filter((r) => I.nyquistOk(s.freq, r)).sort((a, b) => a - b)[0];
  let rate = s.rates[0];
  const W = 280, H = 110, dur = 0.004;
  const svg = h("div", { class: "ci-wavebox user" }), info = h("p", { class: "ci-live user" }), chips = h("div", { class: "ci-choices" });
  root.append(svg, info, chips, h("div", { class: "ci-row" }, btn("ci-listen", "听一听", () => void listen()), btn("ci-check", "检查", () => check(), "primary")));
  io.prompt(L(io.act.prompt));
  const draw = () => {
    const real: string[] = []; for (let x = 0; x <= W; x += 2) real.push(`${x},${H / 2 - Math.sin((x / W) * dur * s.freq * 2 * Math.PI) * 40}`);
    const nS = Math.floor(rate * dur), pts: [number, number][] = []; for (let i = 0; i <= nS + 1; i++) { const t = i / rate; pts.push([(t / dur) * W, H / 2 - Math.sin(2 * Math.PI * s.freq * t) * 40]); }
    const vis = pts.filter((p) => p[0] <= W + 1);
    svg.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="ci-wave"><path d="M0 ${H / 2}H${W}" stroke="#ced4da"/><polyline points="${real.join(" ")}" fill="none" stroke="#a5d8ff" stroke-width="3"/><polyline points="${vis.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#f76707" stroke-width="2"/>${vis.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#e8590c"/>`).join("")}</svg>`;
    const heard = I.aliasFreq(s.freq, rate);
    info.textContent = `${rate} Hz  →  ${Math.round(heard)} Hz`;
    chips.querySelectorAll("button").forEach((b) => b.classList.toggle("on", Number((b as HTMLElement).dataset.r) === rate));
  };
  chips.replaceChildren(...s.rates.map((r) => h("button", { class: "ci-btn ci-choice", type: "button", "data-r": String(r), onclick: () => { rate = r; draw(); } }, String(r))));
  async function listen() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC(), sr = 44100, n = Math.floor(sr * 0.6), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
      const smp = I.sampleWave(s.freq, rate, 0.6);
      for (let i = 0; i < n; i++) d[i] = 0.25 * smp[Math.min(smp.length - 1, Math.floor((i / sr) * rate))];
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(); src.onended = () => void ctx.close();
    } catch { io.say("这台设备不能播放声音。", "bad"); }
  }
  const check = () => {
    if (rate === need) { io.say("正确。这是仍能还原音高的最小采样率。", "ok"); return io.win(); }
    io.bad();
    io.say(I.nyquistOk(s.freq, rate) ? "音高对了，但还可以更低。" : "采样太少，音高变了。", "bad");
  };
  draw();
  return { solve: () => { rate = need; draw(); check(); }, wrong: () => { rate = s.rates[0]; draw(); check(); } };
};

// ---------- Huffman builder ----------
export const huff: Mount = (root, io) => {
  const text: string = io.act.spec.text, freq = I.freqOf(text);
  let nodes = I.hInit(freq), id = nodes.length, sel: number[] = [];
  const area = h("div", { class: "ci-hnodes" }), out = h("div", { class: "ci-hout user" });
  io.prompt(L(io.act.prompt));
  root.append(h("div", { class: "ci-huffsrc user" }, text), area, out);
  const label = (n: I.HNode): string => (n.sym !== undefined ? n.sym : `(${label(n.l!)}${label(n.r!)})`);
  const draw = () => {
    area.replaceChildren(...nodes.map((n, i) => h("button", { class: "ci-btn ci-hnode user" + (sel.includes(i) ? " sel" : ""), type: "button", "data-i": String(i), onclick: () => tap(i) }, h("b", {}, label(n)), h("small", {}, String(n.w)))));
    if (nodes.length === 1) {
      const hf = I.huffman(freq), fixed = Math.ceil(Math.log2(Object.keys(freq).length)) * text.length;
      out.replaceChildren(h("div", { class: "ci-codes" }, ...Object.entries(hf.codes).map(([k, c]) => h("span", {}, `${k} = ${c}`))), h("p", {}, `${hf.cost} bits  (${fixed} bits)`));
      io.say("编码树完成。", "ok"); io.win();
    }
  };
  const tap = (i: number) => {
    if (nodes.length === 1) return;
    sel = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i];
    if (sel.length === 2) {
      const [a, b] = sel; sel = [];
      if (I.hValid(nodes, a, b)) { nodes = I.hMerge(nodes, a, b, id++); io.say("正确。", "ok"); } else { io.bad(); io.say("请选择权重最小的两个节点。", "bad"); }
    }
    draw();
  };
  draw();
  return {
    solve: () => { while (nodes.length > 1) { const idx = nodes.map((_, i) => i).sort((p, q) => nodes[p].w - nodes[q].w || nodes[p].id - nodes[q].id); sel = []; tap(idx[0]); tap(idx[1]); } },
    wrong: () => { const idx = nodes.map((_, i) => i).sort((p, q) => nodes[q].w - nodes[p].w); sel = []; tap(idx[0]); tap(idx[1]); },
  };
};

// ---------- substitution cipher ----------
export const subst: Mount = (root, io) => {
  const s = io.act.spec as { text: string; seed: number; given: string };
  const key = I.makeSubst(s.seed), cipher = I.substApply(s.text, key), inv = I.substInvert(key);
  const letters = [...new Set([...cipher].filter((c) => c >= "A" && c <= "Z"))];
  const freq = I.letterFreq(cipher);
  letters.sort((a, b) => freq[b.charCodeAt(0) - 65] - freq[a.charCodeAt(0) - 65] || (a < b ? -1 : 1));
  const guess: Record<string, string> = {};
  for (const g of s.given) guess[substApply1(g)] = g;
  function substApply1(plain: string): string { return key[plain.charCodeAt(0) - 65]; }
  const view = h("div", { class: "ci-subview user" }), grid = h("div", { class: "ci-submap" });
  io.prompt(L(io.act.prompt));
  root.append(h("div", { class: "ci-cipher user", id: "ci-cipher" }, cipher), view, grid, btn("ci-check", "检查", () => check(), "primary"));
  const max = Math.max(...freq);
  const render = () => { view.textContent = [...cipher].map((c) => (c === " " ? " " : guess[c] ?? "·")).join(""); };
  grid.replaceChildren(...letters.map((c) => { const inp = h("input", { class: "ci-input tiny user", type: "text", maxlength: "1", "data-c": c, "aria-label": c, value: guess[c] ?? "", autocapitalize: "characters", autocomplete: "off" }) as HTMLInputElement; inp.addEventListener("input", () => { const v = inp.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1); inp.value = v; if (v) guess[c] = v; else delete guess[c]; render(); }); return h("label", { class: "ci-subcell user" }, h("b", {}, c), h("i", { style: `height:${6 + (freq[c.charCodeAt(0) - 65] / max) * 34}px` }), inp); }));
  const check = () => { render(); if (view.textContent === s.text) { io.say("解密成功。", "ok"); io.win(); } else { io.bad(); io.say("还没有完全解出。请根据字母出现的次数再猜。", "bad"); } };
  render();
  return {
    solve: () => { for (const c of letters) { guess[c] = inv[c.charCodeAt(0) - 65]; grid.querySelector<HTMLInputElement>(`input[data-c="${c}"]`)!.value = guess[c]; } check(); },
    wrong: () => { for (const c of letters) guess[c] = "A"; check(); },
  };
};

// ---------- find the flipped bit (parity grid, Hamming code) ----------
export const fixbit: Mount = (root, io) => {
  const s = io.act.spec as { mode: "2d" | "ham"; rounds: number; assist: boolean };
  const r = I.rng(io.seed + 2);
  let round = 0, bad: [number, number] = [0, 0];
  const board = h("div", { class: "ci-fixboard" }), prog = h("div", { class: "ci-prog" }), checks = h("div", { class: "ci-checks user" });
  root.append(prog, board, checks);
  let grid: number[][] = [];
  const make = () => {
    prog.textContent = `${round + 1} / ${s.rounds}`;
    if (s.mode === "2d") {
      const data = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => I.rint(r, 0, 1)));
      grid = I.addParity2d(data);
      bad = [I.rint(r, 0, 4), I.rint(r, 0, 4)];
      grid[bad[0]][bad[1]] ^= 1;
      if (bad[0] === 4 && bad[1] === 4) { grid[4][4] ^= 1; bad = [0, 0]; grid[0][0] ^= 1; }
      if (I.locateError2d(grid) === null) { grid[0][0] ^= 1; bad = [0, 0]; }
    } else {
      const d = Array.from({ length: 4 }, () => I.rint(r, 0, 1)), w = I.hamEncode(d), p = I.rint(r, 0, 6);
      w[p] ^= 1; grid = [w]; bad = [0, p];
    }
    io.prompt(L(io.act.prompt));
    draw();
  };
  const draw = () => {
    const odd = s.mode === "2d" && s.assist ? I.locateError2d(grid) : null;
    board.style.setProperty("--cols", String(grid[0].length));
    board.replaceChildren(...grid.flatMap((row, y) => row.map((v, x) => h("button", { class: "ci-btn ci-bit" + (odd && (odd[0] === y || odd[1] === x) ? " odd" : "") + (s.mode === "2d" && (x === 4 || y === 4) ? " par" : "") + (s.mode === "ham" && [0, 1, 3].includes(x) ? " par" : ""), type: "button", "data-y": String(y), "data-x": String(x), onclick: () => tap(y, x) }, h("b", {}, String(v)), s.mode === "ham" ? h("small", {}, String(x + 1)) : null))));
    if (s.mode === "ham" && s.assist) { const w = grid[0]; checks.textContent = `p1: ${(w[0] + w[2] + w[4] + w[6]) % 2 ? "✗" : "✓"}   p2: ${(w[1] + w[2] + w[5] + w[6]) % 2 ? "✗" : "✓"}   p4: ${(w[3] + w[4] + w[5] + w[6]) % 2 ? "✗" : "✓"}`; }
  };
  const tap = (y: number, x: number) => {
    if (y === bad[0] && x === bad[1]) { round++; if (round >= s.rounds) { io.say("全部正确。", "ok"); return io.win(); } io.say("正确。", "ok"); return make(); }
    io.bad(); io.say("这一位没有错。请再找。", "bad");
  };
  make();
  return { solve: () => { for (let k = 0; k < s.rounds; k++) clickEl(board.querySelector(`.ci-bit[data-y="${bad[0]}"][data-x="${bad[1]}"]`)); }, wrong: () => { const y = (bad[0] + 1) % grid.length, x = grid.length === 1 ? (bad[1] + 1) % grid[0].length : bad[1]; clickEl(board.querySelector(`.ci-bit[data-y="${y}"][data-x="${x}"]`)); } };
};

// ---------- a mini spreadsheet ----------
export const sheet: Mount = (root, io) => {
  const s = io.act.spec as { cells: Record<string, string>; tasks: { cell: string; fn?: string; range?: string; expr?: string; p: string }[]; rows: number };
  const raw: Record<string, string> = { ...s.cells };
  let ti = 0, editing = "";
  const table = h("table", { class: "ci-sheet user" }), task = h("p", { class: "ci-task user" }), prog = h("div", { class: "ci-prog" });
  root.append(prog, task, h("div", { class: "ci-sheetwrap" }, table), btn("ci-check", "检查", () => check(), "primary"));
  const cols = "ABCDEF", R = s.rows ?? 6;
  const evalNow = () => I.evalSheet(raw);
  const show = (k: string, v: I.Cell | undefined): string => (v === undefined || v === "" ? "" : typeof v === "number" ? I.fmtNum(v) : String(v));
  const draw = () => {
    const ev = evalNow();
    table.replaceChildren(h("tr", {}, h("th", {}, ""), ...[...cols].map((c) => h("th", {}, c))), ...Array.from({ length: R }, (_, r) => h("tr", {}, h("th", {}, String(r + 1)), ...[...cols].map((c) => {
      const k = c + (r + 1), inp = h("input", { class: "ci-cell" + (k === s.tasks[ti]?.cell ? " goal" : ""), type: "text", "data-k": k, "aria-label": k, autocomplete: "off", autocapitalize: "off", spellcheck: false, value: editing === k ? raw[k] ?? "" : show(k, ev[k]) }) as HTMLInputElement;
      inp.addEventListener("focus", () => { editing = k; inp.value = raw[k] ?? ""; });
      inp.addEventListener("input", () => { raw[k] = inp.value; });
      inp.addEventListener("blur", () => { if (editing === k) editing = ""; raw[k] = inp.value; draw(); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { raw[k] = inp.value; editing = ""; inp.blur(); } });
      return h("td", {}, inp);
    }))));
  };
  const formulaFor = (t: (typeof s.tasks)[0]) => (t.expr ? "=" + t.expr : `=${t.fn}(${t.range})`);
  const refs: Record<string, string> = Object.fromEntries(s.tasks.map((t) => [t.cell, formulaFor(t)]));
  const check = () => {
    const t = s.tasks[ti], mine = (raw[t.cell] ?? "").trim();
    if (!mine.startsWith("=")) { io.bad(); return io.say("请输入以 = 开头的公式。", "bad"); }
    // the formula must keep working when the data changes: it is run on two other versions of the data and compared with the reference formula
    for (const d of [raw, perturb(raw, 1), perturb(raw, 2)]) {
      const want = I.evalSheet({ ...d, ...refs })[t.cell], got = I.evalSheet({ ...d, ...refs, [t.cell]: mine })[t.cell];
      if (typeof want !== "number" || typeof got !== "number" || Math.abs(got - want) > 1e-6) { io.bad(); return io.say(typeof got === "string" && got.startsWith("#") ? `公式出错：${got}` : "结果不对。请检查公式。", "bad"); }
    }
    ti++;
    if (ti >= s.tasks.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.say("正确。", "ok"); nextTask();
  };
  /** the data cells (numbers that are not formulas) changed by a seeded amount, to catch a typed result instead of a formula */
  const perturb = (d: Record<string, string>, k: number): Record<string, string> => { const o: Record<string, string> = { ...d }; for (const [c, v] of Object.entries(s.cells)) if (v !== "" && !v.startsWith("=") && !isNaN(Number(v))) o[c] = String(Number(v) + ((c.charCodeAt(0) + c.charCodeAt(1) * k) % 7) + 1); return o; };
  const nextTask = () => { prog.textContent = `${ti + 1} / ${s.tasks.length}`; task.textContent = s.tasks[ti].p; io.prompt(L(io.act.prompt)); draw(); };
  nextTask();
  return {
    solve: () => { for (let k = 0; k < s.tasks.length; k++) { const t = s.tasks[ti]; raw[t.cell] = formulaFor(t); editing = ""; draw(); check(); } },
    wrong: () => { const t = s.tasks[ti]; raw[t.cell] = String(I.evalSheet({ ...raw, ...refs })[t.cell]); editing = ""; draw(); check(); },
  };
};

// ---------- a table: sort, filter, ask ----------
export const table: Mount = (root, io) => {
  const s = io.act.spec as { cols: string[]; rows: (string | number)[][]; tasks: { type: "sort" | "filter" | "ask"; col?: number; dir?: "asc" | "desc"; op?: string; v?: number; p: string; a?: string }[] };
  let ti = 0, sortCol = -1, sortDir: "asc" | "desc" = "asc", fCol = 0, fOp = ">=", fVal = "";
  const view = h("div", { class: "ci-tblwrap user" }), task = h("p", { class: "ci-task user" }), prog = h("div", { class: "ci-prog" });
  const fc = h("select", { class: "ci-sel user", id: "ci-fcol", "aria-label": "列", onchange: () => { fCol = Number(fc.value); draw(); } }, ...s.cols.map((c, i) => h("option", { value: String(i) }, c))) as HTMLSelectElement;
  const fo = h("select", { class: "ci-sel", id: "ci-fop", "aria-label": "条件", onchange: () => { fOp = fo.value; draw(); } }, ...[">=", "<=", "=", ">", "<"].map((o) => h("option", { value: o }, o))) as HTMLSelectElement;
  const fv = h("input", { class: "ci-input small user", id: "ci-fval", type: "text", inputmode: "numeric", "aria-label": "值", autocomplete: "off", oninput: () => { fVal = fv.value; draw(); } }) as HTMLInputElement;
  const ans = h("input", { class: "ci-input user", id: "ci-ans", type: "text", "aria-label": "答案", autocomplete: "off" }) as HTMLInputElement;
  const filt = h("div", { class: "ci-filter" }, fc, fo, fv);
  root.append(prog, task, filt, view, h("div", { class: "ci-fields" }, ans), btn("ci-check", "检查", () => check(), "primary"));
  const cmp = (a: string | number, b: string | number) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
  const visible = (): (string | number)[][] => {
    let rows = s.rows.slice();
    if (fVal.trim() !== "" && !isNaN(Number(fVal))) { const v = Number(fVal); rows = rows.filter((r) => { const x = Number(r[fCol]); return fOp === ">=" ? x >= v : fOp === "<=" ? x <= v : fOp === "=" ? x === v : fOp === ">" ? x > v : x < v; }); }
    if (sortCol >= 0) rows.sort((a, b) => (sortDir === "asc" ? 1 : -1) * cmp(a[sortCol], b[sortCol]));
    return rows;
  };
  const draw = () => {
    const rows = visible();
    view.replaceChildren(h("table", { class: "ci-tbl" }, h("tr", {}, ...s.cols.map((c, i) => h("th", {}, h("button", { class: "ci-th", type: "button", "data-c": String(i), onclick: () => { if (sortCol === i) { if (sortDir === "asc") sortDir = "desc"; else sortCol = -1; } else { sortCol = i; sortDir = "asc"; } draw(); } }, c, sortCol === i ? (sortDir === "asc" ? " ▲" : " ▼") : "")))),
      ...rows.map((r) => h("tr", {}, ...r.map((x) => h("td", {}, String(x)))))));
  };
  const same = (a: (string | number)[][], b: (string | number)[][]) => a.length === b.length && a.every((r, i) => r.join("|") === b[i].join("|"));
  const check = () => {
    const t = s.tasks[ti];
    let ok = false;
    if (t.type === "ask") ok = I.norm(ans.value) === I.norm(t.a!);
    else if (t.type === "sort") ok = fVal.trim() === "" && sortCol === t.col && sortDir === t.dir;
    else { const v = t.v!; const want = s.rows.filter((r) => { const x = Number(r[t.col!]); return t.op === ">=" ? x >= v : t.op === "<=" ? x <= v : t.op === "=" ? x === v : t.op === ">" ? x > v : x < v; }); ok = fCol === t.col && fVal.trim() !== "" && same(visible().slice().sort((a, b) => a.join().localeCompare(b.join())), want.slice().sort((a, b) => a.join().localeCompare(b.join()))); }
    if (!ok) { io.bad(); return io.say("还不对。请再试一次。", "bad"); }
    ti++;
    if (ti >= s.tasks.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.say("正确。", "ok"); start();
  };
  const start = () => { const t = s.tasks[ti]; prog.textContent = `${ti + 1} / ${s.tasks.length}`; task.textContent = t.p; sortCol = -1; fVal = ""; fv.value = ""; ans.value = ""; filt.hidden = t.type !== "filter"; ans.parentElement!.hidden = t.type !== "ask"; io.prompt(L(io.act.prompt)); draw(); };
  start();
  const setFor = (t: (typeof s.tasks)[0], right: boolean) => {
    if (t.type === "ask") ans.value = right ? t.a! : "?";
    else if (t.type === "sort") { sortCol = t.col!; sortDir = right ? t.dir! : t.dir === "asc" ? "desc" : "asc"; fVal = ""; }
    else { fCol = t.col!; fc.value = String(fCol); fOp = t.op!; fo.value = fOp; fVal = String(right ? t.v : (t.v ?? 0) + 1000); fv.value = fVal; }
    draw();
  };
  return { solve: () => { for (let k = 0; k < s.tasks.length; k++) { setFor(s.tasks[ti], true); check(); } }, wrong: () => { setFor(s.tasks[ti], false); check(); } };
};
