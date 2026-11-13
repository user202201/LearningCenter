/**
 * 化学 (`#/science/chem`, under 科学): the screens. A home with the practice modes and the levels, one round of 10 questions per mode (balance with a live
 * balance scale, writing equations from formula tiles, valences, reaction types, calculation by the equation, solutions, 复分解, metal activity, classification by
 * drag, indicators and pH, gas preparation) and a page of reference tables. Everything is made in code from `src/data/chem.json`; the progress of the memory
 * boxes is kept on this device (`learn.chem.v1`). No child is needed.
 */
import { h, toast } from "./ui";
import * as M from "./model";
import * as C from "./chemlogic";
import * as FG from "./chemfig";
import { subjectArt } from "./hub";
import type { Ctx } from "./english";

let X!: Ctx;
export const initChem = (c: Ctx) => { X = c; };
const COLOR = "#7048e8";
const today = () => M.todayLocal();

// ---------- text pieces ----------
/** a formula with real subscripts: Fe2(SO4)3 */
export function formulaEl(f: string): HTMLElement {
  const el = h("span", { class: "chem-f user" });
  let prev = "", buf = "";
  const flush = () => { if (buf) { el.append(buf); buf = ""; } };
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (/\d/.test(ch) && /[A-Za-z)]/.test(prev)) { flush(); let n = ch; while (/\d/.test(f[i + 1] ?? "")) n += f[++i]; el.append(h("sub", {}, n)); prev = "0"; continue; }
    buf += ch; prev = ch;
  }
  flush();
  return el;
}
const condEl = (c: string[]): HTMLElement => h("span", { class: "chem-cond" }, ...c.flatMap((x, i) => (i ? [h("span", { class: "user" }, "+"), h("span", {}, x)] : [h("span", {}, x)])));
/** the equation of a reaction of the library, with or without coefficients */
export function eqEl(rx: C.Rx, coefs?: number[]): HTMLElement {
  const side = (ts: C.Term[], off: number) => ts.flatMap((t, i) => {
    const c = coefs ? coefs[off + i] : t.c;
    return [...(i ? [h("span", { class: "chem-plus user" }, "+")] : []), h("span", { class: "chem-term" }, ...(c > 1 ? [h("span", { class: "chem-coef user" }, String(c))] : []), formulaEl(t.f), ...(t.mark ? [h("span", { class: "chem-mark user" }, t.mark)] : []))];
  });
  return h("span", { class: "chem-eqs", "data-rx": rx.id }, ...side(rx.l, 0), h("span", { class: "chem-arrow" }, h("small", {}, ...rx.cond.flatMap((x, i) => (i ? [h("span", { class: "user" }, " + "), x] : [x]))), h("i", { class: "user" }, "→")), ...side(rx.r, rx.l.length));
}
export function partsEl(parts: C.Part[]): HTMLElement {
  const box = h("div", { class: "chem-parts" });
  for (const p of parts) {
    if (typeof p === "string") box.append(h("span", { class: "chem-t" }, p));
    else if ("u" in p) box.append(h("span", { class: "user chem-u" }, p.u));
    else if ("f" in p) box.append(formulaEl(p.f));
    else if ("eq" in p) box.append(h("div", { class: "chem-eqline" }, eqEl(C.rxById(p.eq)!)));
    else { const d = h("div", { class: "chem-crossbox" }); d.innerHTML = FG.crossSvg(p.cross.cat, p.cross.cc, p.cross.an, p.cross.ac); box.append(d); }
  }
  return box;
}
const ARline = (els: string[]): HTMLElement => h("p", { class: "chem-ar muted small" }, h("span", {}, "相对原子质量："), h("span", { class: "user" }, els.map((e) => `${e} = ${+C.ar(e).toFixed(1)}`).join("  ")));

// ---------- page shell ----------
const header = (title: string, back: string, backLabel = "返回"): HTMLElement => h("header", { class: "top hero home-hero subj-hero", style: `--kid:${COLOR}` }, X.back(back, backLabel), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", {}, title)), X.gear("#/science/chem"));
const page = (head: HTMLElement, ...body: (HTMLElement | null)[]) => X.show(h("div", { class: "page chem-page", style: `--kid:${COLOR}` }, head, h("main", { class: "scroll" }, h("div", { class: "narrow chem-narrow" }, ...body))));

const LEVELS: [string, number][] = [["全部", 0], ["初级", 1], ["中级", 2], ["高级", 3]];
const lastKey = new Map<string, string>();

// ---------- the home ----------
export async function renderChem(sub: string): Promise<void> {
  const my = X.epoch();
  X.showLoading();
  try { await C.loadChem(); } catch (e) { return my === X.epoch() ? X.showError(e, () => void renderChem(sub)) : undefined; }
  if (my !== X.epoch()) return;
  if (sub === "ref") return renderRef();
  if (C.MODES.some((m) => m.id === sub)) return play(sub);
  renderHome();
}

function renderHome(): void {
  const prog = C.loadProgress();
  const lvBtns = LEVELS.map(([label, v]) => h("button", { class: "mopt" + (prog.lv === v ? " on" : ""), id: `chem-lv-${v}`, "data-v": String(v), onclick: () => { prog.lv = v; C.saveProgress(prog); lvBtns.forEach((b) => b.classList.toggle("on", b.dataset.v === String(v))); } }, label));
  const count = (mode: string) => Object.keys(prog.cards).filter((k) => k.startsWith(mode + ":")).length;
  const grid = h("div", { class: "chem-modes", id: "chem-modes" }, ...C.MODES.map((m) => {
    const n = count(m.id);
    return h("button", { class: "chem-mode", id: `chem-m-${m.id}`, "data-mode": m.id, onclick: () => (location.hash = `#/science/chem/${m.id}`) },
      h("span", { class: "chem-badge user" }, m.badge), h("b", {}, m.name), h("span", { class: "muted small" }, m.sub), h("span", { class: "chem-n small" }, n ? `已练习 ${n} 项` : "尚未开始"));
  }), h("button", { class: "chem-mode chem-refcard", id: "chem-ref", onclick: () => (location.hash = "#/science/chem/ref") }, h("span", { class: "chem-badge user" }, "Ar"), h("b", {}, "查阅表格"), h("span", { class: "muted small" }, "溶解性表、活动性顺序、化合价、方程式"), h("span", { class: "chem-n small" }, "157")));
  page(header("化学", "#/subject/science"),
    h("p", { class: "muted small center chem-lead" }, "每轮 10 题，答完马上讲解。进度保存在这台设备上。"),
    h("div", { class: "mset-opts chem-levels", id: "chem-levels" }, ...lvBtns), grid);
}

// ---------- a round ----------
type Win = Window & { __chemSeed?: number; __chemQ?: C.Q; __chem?: Record<string, unknown> };
function play(mode: string): void {
  const m = C.modeOf(mode);
  let prog = C.loadProgress();
  const seed = (window as Win).__chemSeed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const avoid = lastKey.get(mode)?.replace(/^[a-z]+:/, "");
  const qs = C.buildRound(mode, prog.lv, seed, prog, today(), C.ROUND, avoid);
  if (!qs.length) { toast("暂无题目。"); location.hash = "#/science/chem"; return; }
  let idx = 0, score = 0, locked = false;
  const wrong: C.Q[] = [];
  const stat = h("span", { class: "chem-count", id: "chem-count" });
  const bar = h("div", { class: "chem-bar" }, h("i", {}));
  const body = h("div", { class: "chem-card", id: "chem-q" });
  const next = h("button", { class: "primary wide chem-next", id: "chem-next", disabled: true }, "下一题");
  const sc = h("span", { class: "chem-score muted small", id: "chem-score" });
  page(header(m.name, "#/science/chem", "化学"),
    h("div", { class: "chem-top" }, stat, sc), bar, body, h("div", { class: "chem-foot" }, next));
  const refreshTop = () => { stat.textContent = `第 ${idx + 1} 题 / 共 ${qs.length} 题`; sc.textContent = `得分：${score}`; (bar.firstElementChild as HTMLElement).style.width = `${(idx / qs.length) * 100}%`; };
  /** a question is finished: remember it (memory boxes), show the explanation */
  const finish = (q: C.Q, right: boolean, expl: HTMLElement, keys?: { key: string; right: boolean }[]) => {
    locked = true;
    if (right) score++; else wrong.push(q);
    prog = C.applyAnswers(prog, keys ?? [{ key: q.key, right }], today());
    C.saveProgress(prog);
    lastKey.set(mode, q.key);
    body.dataset.done = right ? "right" : "wrong";
    expl.prepend(h("p", { class: "chem-verdict " + (right ? "ok" : "bad"), id: "chem-verdict" }, right ? "回答正确。" : "回答不正确。"));
    body.append(expl);
    next.disabled = false;
    next.textContent = idx === qs.length - 1 ? "完成" : "下一题";
    sc.textContent = `得分：${score}`;
    expl.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  };
  const draw = () => {
    locked = false; body.dataset.done = ""; next.disabled = true;
    const q = qs[idx];
    (window as Win).__chemQ = q;
    refreshTop();
    body.replaceChildren(h("div", { class: "chem-stem", id: "chem-stem" }, partsEl(q.stem)));
    body.dataset.mode = q.t;
    if (q.t === "choice") drawChoice(q);
    else if (q.t === "num") drawNum(q);
    else if (q.t === "bal") drawBal(q);
    else if (q.t === "write") drawWrite(q);
    else drawClass(q);
  };
  next.addEventListener("click", () => {
    if (idx < qs.length - 1) { idx++; draw(); body.scrollIntoView?.({ block: "start" }); return; }
    summary();
  });

  // --- choice
  function drawChoice(q: C.ChoiceQ) {
    if (q.fig) { const f = h("div", { class: "chem-fig", id: "chem-fig" }); f.innerHTML = FG.apparatusRow(q.fig); body.append(f); }
    if (q.tbl) {
      body.append(h("div", { class: "chem-tblwrap" }, h("table", { class: "chem-tbl", id: "chem-tbl" }, h("thead", {}, h("tr", {}, ...q.tbl.head.map((x) => h("th", { class: "user" }, x)))), h("tbody", {}, ...q.tbl.rows.map((r) => h("tr", {}, ...r.map((x, i) => (i ? h("td", { class: "user" }, x) : h("th", { class: "user" }, formulaEl(x))))))))));
    }
    const btns = q.choices.map((c, i) => h("button", { class: "mopt chem-ch", "data-i": String(i), onclick: () => pick(i) }, h("span", { class: "chem-key user" }, String(i + 1)), partsEl(c)));
    body.append(h("div", { class: "chem-choices" + (q.fig ? " compact" : ""), id: "chem-choices" }, ...btns));
    const pick = (i: number) => {
      if (locked) return;
      const right = i === q.right;
      btns.forEach((b, j) => { b.disabled = true; if (j === q.right) b.classList.add("right"); });
      if (!right) btns[i].classList.add("wrong");
      finish(q, right, h("div", { class: "chem-expl", id: "chem-expl" }, partsEl(q.expl)));
    };
    (window as Win).__chem = { pick };
  }

  // --- numbers (one or several steps)
  function drawNum(q: C.NumQ) {
    if (q.els) body.append(ARline(q.els));
    let step = 0, allRight = true;
    const rows = h("div", { class: "chem-steps", id: "chem-steps" });
    body.append(rows);
    const addRow = () => {
      const s = q.steps[step], k = step;
      const input = h("input", { type: "text", inputMode: "decimal", class: "chem-in", id: `chem-in-${k}`, autocomplete: "off", "aria-label": "答案" }) as HTMLInputElement;
      const msg = h("p", { class: "chem-say small", id: `chem-say-${k}` });
      const ok = h("button", { class: "primary chem-ok", id: `chem-ok-${k}` }, "检查");
      const row = h("div", { class: "chem-step" }, h("div", { class: "chem-steplab" }, partsEl(s.label)), h("div", { class: "chem-inrow" }, input, ...(s.unit ? [h("span", { class: "chem-unit user" }, s.unit)] : []), ok), msg);
      rows.append(row);
      const check = () => {
        if (locked || input.disabled) return;
        const v = parseFloat(input.value.replace(/,/g, ".").replace(/[^\d.+-]/g, ""));
        if (!Number.isFinite(v)) { msg.textContent = "请输入数字。"; msg.className = "chem-say small bad"; return; }
        const right = Math.abs(v - s.answer) <= s.tol + 1e-9;
        input.disabled = true; ok.disabled = true;
        row.classList.add(right ? "ok" : "bad");
        msg.className = "chem-say small " + (right ? "ok" : "bad");
        msg.replaceChildren(h("span", {}, right ? "正确：" : "正确答案："), ...s.say.map((p) => partsEl([p])));
        if (!right) allRight = false;
        step++;
        if (step < q.steps.length) { addRow(); return; }
        finish(q, allRight, h("div", { class: "chem-expl", id: "chem-expl" }, partsEl(q.expl)));
      };
      ok.addEventListener("click", check);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
      setTimeout(() => input.focus({ preventScroll: true }), 0);
    };
    addRow();
  }

  // --- balance with a live scale
  function scalesEl(rows: { e: string; l: number; r: number }[], id = "chem-scales"): HTMLElement {
    const box = h("div", { class: "chem-scales", id, "data-balanced": rows.length && rows.every((x) => x.l === x.r) ? "1" : "0" });
    for (const x of rows) { const t = h("div", { class: "chem-scale" + (x.l === x.r ? " eq" : ""), "data-e": x.e, "data-l": String(x.l), "data-r": String(x.r) }); t.innerHTML = FG.scaleSvg(x.e, x.l, x.r); box.append(t); }
    return box;
  }
  function drawBal(q: C.BalQ) {
    const rx = C.rxById(q.rx)!;
    const terms = [...rx.l, ...rx.r];
    const coefs = terms.map(() => 1);
    let hinted = false, attempts = 0;
    const msg = h("p", { class: "chem-msg", id: "chem-msg", "aria-live": "polite" });
    const scales = h("div", { id: "chem-scales-wrap" });
    const cells = terms.map((t, i) => {
      const val = h("b", { class: "chem-val user", id: `chem-c-${i}` }, "1");
      const dec = h("button", { class: "chem-step-btn", "aria-label": "-", id: `chem-dec-${i}`, onclick: () => set(i, coefs[i] - 1) }, "−");
      const inc = h("button", { class: "chem-step-btn", "aria-label": "+", id: `chem-inc-${i}`, onclick: () => set(i, coefs[i] + 1) }, "+");
      const el = h("span", { class: "chem-term bal", "data-i": String(i) }, h("span", { class: "chem-stepper" }, dec, val, inc), formulaEl(t.f), ...(t.mark ? [h("span", { class: "chem-mark user" }, t.mark)] : []));
      return { el, val, dec, inc };
    });
    const eq = h("div", { class: "chem-eqline bal", id: "chem-eq" });
    cells.forEach((c, i) => { if (i === rx.l.length) eq.append(h("span", { class: "chem-arrow" }, h("small", {}, ...rx.cond.flatMap((x, j) => (j ? [h("span", { class: "user" }, " + "), x] : [x]))), h("i", { class: "user" }, "→"))); else if (i) eq.append(h("span", { class: "chem-plus user" }, "+")); eq.append(c.el); });
    const rowsOf = () => C.balanceRows(rx.l.map((t, i) => ({ c: coefs[i], f: t.f })), rx.r.map((t, i) => ({ c: coefs[rx.l.length + i], f: t.f })));
    const refresh = () => { cells.forEach((c, i) => { c.val.textContent = String(coefs[i]); c.dec.disabled = locked || coefs[i] <= 1; c.inc.disabled = locked || coefs[i] >= 20; }); scales.replaceChildren(scalesEl(rowsOf())); };
    function set(i: number, v: number) { if (locked) return; coefs[i] = Math.max(1, Math.min(20, v)); msg.textContent = ""; msg.className = "chem-msg"; refresh(); }
    const hint = h("button", { class: "mopt chem-hint", id: "chem-hint", onclick: () => {
      if (locked) return;
      const i = terms.findIndex((t, j) => coefs[j] !== t.c);
      if (i < 0) { msg.textContent = "系数已经全部正确，请点“检查”。"; return; }
      coefs[i] = terms[i].c; hinted = true; msg.textContent = "已填入一个系数。"; msg.className = "chem-msg"; refresh();
      cells[i].el.classList.add("flash");
    } }, "提示");
    const check = h("button", { class: "primary chem-check", id: "chem-check", onclick: () => {
      if (locked) return;
      const rows = rowsOf();
      const l = rx.l.map((t, i) => ({ c: coefs[i], f: t.f })), r = rx.r.map((t, i) => ({ c: coefs[rx.l.length + i], f: t.f }));
      if (C.isBalanced(l, r) && C.lowestTerms(l, r)) {
        const first = attempts === 0 && !hinted;
        locked = true; refresh();
        msg.textContent = "已配平。"; msg.className = "chem-msg ok";
        const ex = h("div", { class: "chem-expl", id: "chem-expl" }, partsEl(q.expl), h("p", { class: "small" }, h("span", {}, "条件："), condEl(rx.cond)), h("p", { class: "small user" }, rx.ph));
        finish(q, first, ex);
      } else if (C.isBalanced(l, r)) {
        attempts++; msg.textContent = "已配平，但系数不是最简整数比。"; msg.className = "chem-msg bad";
      } else {
        attempts++; msg.textContent = `还没有配平。不相等的元素：${rows.filter((x) => x.l !== x.r).map((x) => x.e).join(" ")}`; msg.className = "chem-msg bad";
      }
    } }, "检查");
    body.append(h("div", { class: "chem-eqwrap" }, eq), scales, msg, h("div", { class: "chem-actions" }, hint, check));
    refresh();
    (window as Win).__chem = { set, coefs };
  }

  // --- write an equation from formula tiles
  function drawWrite(q: C.WriteQ) {
    const rx = C.rxById(q.rx)!;
    const sides: { f: string; c: number }[][] = [[], []];
    let active = 0, attempts = 0;
    const msg = h("p", { class: "chem-msg", id: "chem-msg", "aria-live": "polite" });
    const zones = [0, 1].map((s) => h("div", { class: "chem-zone", id: `chem-zone-${s ? "r" : "l"}`, "data-side": String(s), onclick: () => { active = s; paint(); } }));
    const scales = h("div", { id: "chem-scales-wrap" });
    const tiles = q.tiles.map((f) => { const b = h("button", { class: "chem-tile", "data-f": f, onclick: () => add(f) }, formulaEl(f)); return b; });
    const paint = () => {
      zones.forEach((z, s) => {
        z.classList.toggle("active", active === s);
        z.replaceChildren(h("small", { class: "chem-zlab" }, s ? "生成物" : "反应物"), ...sides[s].map((t, i) => h("span", { class: "chem-chip", "data-f": t.f }, h("span", { class: "chem-stepper" }, h("button", { class: "chem-step-btn", "aria-label": "-", onclick: (e: Event) => { e.stopPropagation(); t.c = Math.max(1, t.c - 1); paint(); } }, "−"), h("b", { class: "chem-val user" }, String(t.c)), h("button", { class: "chem-step-btn", "aria-label": "+", onclick: (e: Event) => { e.stopPropagation(); t.c = Math.min(20, t.c + 1); paint(); } }, "+")), formulaEl(t.f), h("button", { class: "chem-x", "aria-label": "×", onclick: (e: Event) => { e.stopPropagation(); sides[s].splice(i, 1); paint(); } }, "×"))));
        if (!sides[s].length) z.append(h("span", { class: "muted small chem-zhint" }, "点下面的化学式放到这里"));
      });
      tiles.forEach((b) => b.classList.toggle("used", sides.some((sd) => sd.some((t) => t.f === b.dataset.f))));
      const both = sides[0].length && sides[1].length;
      scales.replaceChildren(both ? scalesEl(C.balanceRows(sides[0], sides[1])) : h("span", {}));
    };
    function add(f: string) {
      if (locked) return;
      if (sides.some((sd) => sd.some((t) => t.f === f))) { msg.textContent = "这个化学式已经放进方程式了。"; msg.className = "chem-msg"; return; }
      sides[active].push({ f, c: 1 }); msg.textContent = ""; msg.className = "chem-msg"; paint();
    }
    const clear = h("button", { class: "mopt", id: "chem-clear", onclick: () => { if (locked) return; sides[0].length = 0; sides[1].length = 0; active = 0; msg.textContent = ""; paint(); } }, "清除");
    const check = h("button", { class: "primary chem-check", id: "chem-check", onclick: () => {
      if (locked) return;
      const j = C.judgeWrite(rx, sides[0], sides[1]);
      if (j.ok) {
        const first = attempts === 0;
        locked = true; msg.textContent = "方程式正确。"; msg.className = "chem-msg ok";
        finish(q, first, h("div", { class: "chem-expl", id: "chem-expl" }, partsEl(q.expl), h("p", { class: "small" }, h("span", {}, "条件："), condEl(rx.cond)), h("p", { class: "small user" }, rx.ph)));
        return;
      }
      attempts++; msg.className = "chem-msg bad";
      if (j.problems.includes("empty")) msg.textContent = "请先把化学式放进反应物和生成物。";
      else if (j.problems.includes("formulas")) msg.textContent = "物质或位置不对。请检查反应物和生成物各有哪些。";
      else if (j.problems.includes("balance")) msg.textContent = `还没有配平。不相等的元素：${C.balanceRows(sides[0], sides[1]).filter((x) => x.l !== x.r).map((x) => x.e).join(" ")}`;
      else msg.textContent = "已配平，但系数不是最简整数比。";
    } }, "检查");
    body.append(h("div", { class: "chem-desc user", id: "chem-desc" }, q.desc), h("div", { class: "chem-sides" }, zones[0], h("span", { class: "chem-arrow big user" }, "→"), zones[1]), h("div", { class: "chem-tiles", id: "chem-tiles" }, ...tiles), scales, msg, h("div", { class: "chem-actions" }, clear, check));
    paint();
    (window as Win).__chem = { add, sides, setActive: (s: number) => { active = s; paint(); } };
  }

  // --- classification by drag (and by tap)
  function drawClass(q: C.ClassQ) {
    const placed = new Map<string, string>();   // item id -> bucket
    let sel: string | null = null;
    const tray = h("div", { class: "chem-tray", id: "chem-tray" });
    const buckets = q.buckets.map((b) => h("div", { class: "chem-bucket", id: `chem-bk-${b}`, "data-b": b, role: "button", tabindex: "0", onclick: () => { if (sel) place(sel, b); } }, h("b", {}, C.BUCKETS[b]), h("div", { class: "chem-bk-items" })));
    const chips = new Map<string, HTMLElement>();
    const msg = h("p", { class: "chem-msg", id: "chem-msg", "aria-live": "polite" });
    const check = h("button", { class: "primary chem-check", id: "chem-check", disabled: true, onclick: () => grade() }, "检查");
    for (const it of q.items) {
      const chip = h("button", { class: "chem-item", "data-id": it.id, "data-cat": it.cat, style: "touch-action:none" }, it.f ? formulaEl(it.f) : null, h("span", { class: "chem-iname user" }, it.n));
      chips.set(it.id, chip);
      chip.addEventListener("pointerdown", (e) => dragStart(e, it.id, chip));
      chip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectItem(it.id); } });
      tray.append(chip);
    }
    const selectItem = (id: string | null) => { sel = sel === id ? null : id; chips.forEach((c, k) => c.classList.toggle("sel", k === sel)); };
    const refresh = () => {
      buckets.forEach((b) => { const box = b.querySelector(".chem-bk-items")!; box.replaceChildren(...[...placed].filter(([, v]) => v === b.dataset.b).map(([k]) => chips.get(k)!)); });
      tray.replaceChildren(...q.items.filter((i) => !placed.has(i.id)).map((i) => chips.get(i.id)!));
      check.disabled = placed.size < q.items.length;
      tray.classList.toggle("empty", placed.size === q.items.length);
    };
    const place = (id: string, b: string) => { if (locked) return; placed.set(id, b); sel = null; chips.forEach((c) => c.classList.remove("sel")); refresh(); };
    const unplace = (id: string) => { if (locked) return; placed.delete(id); refresh(); };
    function dragStart(e: PointerEvent, id: string, chip: HTMLElement) {
      if (locked || (e.pointerType === "mouse" && e.button !== 0)) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost: HTMLElement | null = null, over: HTMLElement | null = null, moved = false;
      const was = placed.get(id);
      try { chip.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      const bucketAt = (x: number, y: number): HTMLElement | null => (document.elementsFromPoint(x, y).find((n) => (n as HTMLElement).classList?.contains("chem-bucket")) as HTMLElement | undefined) ?? null;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        if (!moved) { moved = true; ghost = chip.cloneNode(true) as HTMLElement; ghost.classList.add("chem-ghost"); ghost.removeAttribute("id"); document.body.append(ghost); chip.classList.add("dragging"); }
        ghost!.style.left = `${ev.clientX}px`; ghost!.style.top = `${ev.clientY}px`;
        const b = bucketAt(ev.clientX, ev.clientY);
        if (b !== over) { over?.classList.remove("over"); over = b; over?.classList.add("over"); }
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        chip.removeEventListener("pointermove", move); chip.removeEventListener("pointerup", up); chip.removeEventListener("pointercancel", up);
        try { chip.releasePointerCapture(e.pointerId); } catch { /* released */ }
        ghost?.remove(); chip.classList.remove("dragging"); over?.classList.remove("over");
        if (moved) {
          const b = ev.type === "pointercancel" ? null : bucketAt(ev.clientX, ev.clientY);
          if (b?.dataset.b) place(id, b.dataset.b); else if (was && ev.type !== "pointercancel") unplace(id);
        } else if (was) { if (sel && sel !== id) place(sel, was); else unplace(id); }   // (with another item selected, a tap on a placed item means "that class")
        else selectItem(id);
      };
      chip.addEventListener("pointermove", move); chip.addEventListener("pointerup", up); chip.addEventListener("pointercancel", up);
    }
    function grade() {
      if (locked || placed.size < q.items.length) return;
      const keys = q.items.map((it) => ({ key: `cls:${it.id}`, right: placed.get(it.id) === it.cat }));
      const bad = q.items.filter((it) => placed.get(it.id) !== it.cat);
      for (const it of q.items) { const c = chips.get(it.id)!; const ok = placed.get(it.id) === it.cat; c.classList.add(ok ? "ok" : "bad"); (c as HTMLButtonElement).disabled = true; if (!ok) c.append(h("em", { class: "chem-right" }, C.BUCKETS[it.cat])); }
      msg.textContent = bad.length ? `有 ${bad.length} 个放错了，正确的类别已标在物质旁边。` : "全部正确。"; msg.className = "chem-msg " + (bad.length ? "bad" : "ok");
      check.disabled = true;
      finish(q, bad.length === 0, h("div", { class: "chem-expl", id: "chem-expl" }, partsEl(q.expl)), keys);
    }
    body.append(tray, h("div", { class: "chem-buckets", id: "chem-buckets" }, ...buckets), msg, h("div", { class: "chem-actions" }, check));
    refresh();
    (window as Win).__chem = { place, items: q.items };
  }

  // --- end of the round
  function summary() {
    prog = C.applyAnswers(prog, [], today(), { score, total: qs.length });
    C.saveProgress(prog);
    toast(`本轮完成：${score} / ${qs.length}`);
    (bar.firstElementChild as HTMLElement).style.width = "100%";
    body.dataset.mode = "sum"; (window as Win).__chemQ = undefined;
    body.replaceChildren(h("div", { class: "chem-sum", id: "chem-sum" },
      h("h2", { class: "chem-big" }, `本轮得分：${score} / ${qs.length}`),
      ...(wrong.length ? [h("h3", {}, "需要再看一遍的题目"), ...wrong.map((q) => h("div", { class: "chem-wrong" }, partsEl(q.stem), partsEl(q.expl)))] : [h("p", {}, "全部正确。")]),
      h("div", { class: "chem-actions" }, h("button", { class: "primary", id: "chem-again", onclick: () => play(mode) }, "再来一轮"), h("button", { class: "mopt", id: "chem-back", onclick: () => (location.hash = "#/science/chem") }, "返回"))));
    next.hidden = true;
    stat.textContent = "";
  }
  draw();
}

// ---------- reference tables ----------
const SUP: Record<string, string> = { "+": "⁺", "-": "⁻", "2": "²", "3": "³" };
const ionText = (f: string, ch: number): string => C.sub(f) + (Math.abs(ch) > 1 ? (Math.abs(ch) === 2 ? "²" : "³") : "") + SUP[ch > 0 ? "+" : "-"];
const CHAPTER_NAMES: Record<string, string> = { air: "空气和氧气", water: "自然界的水", carbon: "碳和碳的氧化物", fuel: "燃料及其利用", metal: "金属和金属材料", acid: "酸和碱", salt: "盐和化肥" };
const REF_TABS: [string, string][] = [["sol", "溶解性表"], ["act", "活动性顺序"], ["val", "化合价"], ["subs", "常见物质"], ["ind", "指示剂与 pH"], ["rx", "化学方程式"]];
function renderRef(): void {
  const D = C.data();
  let tab = "sol", cat = "", chap = "";
  const out = h("div", { id: "chem-ref-body" });
  const chips = (list: [string, string][], cur: () => string, set: (v: string) => void, idp: string) => h("div", { class: "mset-opts pt-filter" }, ...list.map(([v, label]) => h("button", { class: "mopt" + (cur() === v ? " on" : ""), id: `${idp}-${v || "all"}`, "data-v": v, onclick: () => { set(v); draw(); } }, label)));
  const draw = () => {
    const tabs = chips(REF_TABS.map(([v, l]) => [v, l] as [string, string]), () => tab, (v) => (tab = v), "rt");
    const body: HTMLElement[] = [tabs];
    if (tab === "sol") {
      const sol = D.ions.sol;
      const head = h("tr", {}, h("th", {}), ...D.ions.an.map((a) => { const an = C.IONS.AN.find((x) => x.k === a)!; return h("th", { class: "user" }, ionText(an.f, an.ch)); }));
      const rows = D.ions.cat.map((c, ci) => { const ion = C.IONS.catByK(c); return h("tr", {}, h("th", { class: "user" }, ionText(ion.f, ion.ch), h("small", {}, ` ${C.catName(ion.k)}`)), ...D.ions.an.map((a) => h("td", { class: `chem-sol-${sol[a][ci] === "-" ? "n" : sol[a][ci]} user`, "data-c": c, "data-a": a }, sol[a][ci] === "-" ? "–" : sol[a][ci]))); });
      body.push(h("div", { class: "chem-tblwrap" }, h("table", { class: "chem-tbl chem-soltbl", id: "chem-soltbl" }, h("thead", {}, head), h("tbody", {}, ...rows))),
        h("ul", { class: "chem-legend small" }, h("li", {}, h("b", { class: "user" }, "s"), " 溶于水"), h("li", {}, h("b", { class: "user" }, "i"), " 不溶于水"), h("li", {}, h("b", { class: "user" }, "m"), " 微溶于水"), h("li", {}, h("b", { class: "user" }, "v"), " 溶于水，易挥发或易分解"), h("li", {}, h("b", { class: "user" }, "–"), " 这种物质不存在或遇水就分解")));
    } else if (tab === "act") {
      body.push(h("p", { class: "chem-actlab small" }, "金属活动性由强到弱"), h("div", { class: "chem-actrow", id: "chem-act" }, ...D.activity.map((e) => h("span", { class: "chem-actchip user" + (e === "H" ? " h" : ""), "data-e": e }, e))),
        h("ul", { class: "chem-rules small" }, h("li", {}, "排在氢前面的金属，能与稀盐酸、稀硫酸反应放出氢气（钾、钙、钠与水反应，不在此列）。"), h("li", {}, "排在前面的金属，能把排在后面的金属从它的盐溶液中置换出来（钾、钙、钠除外）。"), h("li", {}, "铁与酸或盐溶液发生置换反应时，生成的是亚铁盐（+2 价）。")));
    } else if (tab === "val") {
      body.push(h("table", { class: "chem-tbl chem-valtbl" }, h("thead", {}, h("tr", {}, h("th", {}, "元素"), h("th", {}, "常见化合价"))), h("tbody", {}, ...D.elements.map((e) => h("tr", {}, h("th", { class: "user" }, `${e.s} `, h("small", {}, e.n)), h("td", { class: "user" }, e.v.map((v) => (v > 0 ? `+${v}` : `${v}`)).join("  ")))))),
        h("h3", {}, "常见原子团"), h("table", { class: "chem-tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "原子团"), h("th", {}, "化合价"))), h("tbody", {}, ...D.groups.map((g) => h("tr", {}, h("th", { class: "user" }, formulaEl(g.f), h("small", {}, ` ${g.n}`)), h("td", { class: "user" }, g.c > 0 ? `+${g.c}` : `${g.c}`))))));
    } else if (tab === "subs") {
      const cats: [string, string][] = [["", "全部"], ["elem", "单质"], ["oxide", "氧化物"], ["acid", "酸类"], ["base", "碱类"], ["salt", "盐类"], ["org", "有机物"]];
      body.push(chips(cats, () => cat, (v) => (cat = v), "rc"), h("table", { class: "chem-tbl chem-subtbl", id: "chem-subtbl" }, h("tbody", {}, ...D.subs.filter((s) => s.c !== "other" && (!cat || s.c === cat)).map((s) => h("tr", { "data-f": s.f }, h("th", { class: "user" }, s.n), h("td", {}, formulaEl(s.f)), h("td", { class: "user small" }, s.a))))));
    } else if (tab === "ind") {
      body.push(h("table", { class: "chem-tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "指示剂"), h("th", {}, "酸性"), h("th", {}, "中性"), h("th", {}, "碱性"))), h("tbody", {}, ...D.indicators.map((i) => h("tr", {}, h("th", { class: "user" }, i.n), h("td", { class: "user" }, i.acid), h("td", { class: "user" }, i.neutral), h("td", { class: "user" }, i.base))))),
        h("h3", {}, "常见物质的 pH"), h("div", { class: "chem-ph", id: "chem-ph" }, ...D.ph.map((p) => h("div", { class: "chem-phrow", "data-ph": String(p.v) }, h("span", { class: "user chem-phn" }, p.n), h("span", { class: "chem-phbar" }, h("i", { style: `width:${(p.v / 14) * 100}%;background:hsl(${Math.round((p.v / 14) * 240)} 70% 50%)` })), h("b", { class: "user" }, String(p.v))))));
    } else {
      const chaps = [["", "全部"], ...Object.entries(CHAPTER_NAMES)] as [string, string][];
      body.push(chips(chaps, () => chap, (v) => (chap = v), "rr"), h("div", { class: "chem-rxlist", id: "chem-rxlist" }, ...D.reactions.filter((r) => !chap || r.ch === chap).map((r) => h("div", { class: "chem-rxrow", "data-rx": r.id }, h("div", { class: "chem-eqline" }, eqEl(r)), h("div", { class: "small" }, h("span", { class: "chem-tag" }, C.TYPE_NAME[r.type]), " ", h("span", { class: "user muted" }, r.ph))))));
    }
    out.replaceChildren(...body);
  };
  draw();
  page(header("查阅表格", "#/science/chem", "化学"), out);
}
