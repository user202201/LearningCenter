import type { GameCtx } from "./ctx";
import "./idiomchain.css";
import raw from "../data/chengyu.json";
import { buildLib, needOf, validate, candidates, computerMove, openingMove, hintFor, follow, type Lib, type Raw, type Entry, type Need, type Fail } from "./idiomchain-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#e6fcf5"/><rect x="16" y="26" width="42" height="42" rx="11" fill="#fffdf5" stroke="#0ca678" stroke-width="5"/><path d="M16 26 L58 68 M58 26 L16 68" stroke="#96f2d7" stroke-width="3"/><rect x="62" y="52" width="42" height="42" rx="11" fill="#12b886" stroke="#087f5b" stroke-width="5"/><path d="M62 52 L104 94 M104 52 L62 94" stroke="#63e6be" stroke-width="3"/><path d="M52 80 q4 -2 8 -8" fill="none" stroke="#e8590c" stroke-width="5" stroke-linecap="round"/><circle cx="37" cy="52" r="3" fill="#3a2e39"/><circle cx="46" cy="52" r="3" fill="#3a2e39"/><path d="M36 58 Q41.5 63 47 58" fill="none" stroke="#3a2e39" stroke-width="2.6" stroke-linecap="round"/><circle cx="82" cy="76" r="3" fill="#fff"/><circle cx="91" cy="76" r="3" fill="#fff"/><path d="M81 82 Q86.5 87 92 82" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="92" cy="22" r="7" fill="#ffd43b"/><circle cx="24" cy="92" r="5" fill="#ffa8a8"/></svg>`;

type Mode = "choose" | "type";
type Phase = "loading" | "ready" | "player" | "cpu" | "over";
interface Link { who: "cpu" | "you"; e: Entry }
const MAX_FAILS = 3, HINTS = 3, CPU_DELAY = 650;

let libPromise: Promise<Lib> | null = null;
/** the library with its pinyin (made on this device by pinyin-pro, which is bundled; nothing is fetched) */
export function getLib(): Promise<Lib> {
  return (libPromise ??= import("pinyin-pro").then((m) => buildLib((raw as unknown as { items: Raw[] }).items, (w) => {
    const a = m.pinyin(w, { type: "array" }) as string[];
    return a.length === [...w].length ? a : [...w].map((c) => m.pinyin(c));
  })).catch(() => buildLib((raw as unknown as { items: Raw[] }).items, (w) => [...w])));
}

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let mode = ctx.store.get<Mode>("mode", "choose") === "type" ? "type" : "choose";
  let homo = ctx.store.get<boolean>("homo", false);
  const bestKey = () => `best-${mode}${homo ? "-homo" : ""}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  let lib: Lib | null = null, phase: Phase = "loading", chain: Link[] = [], used = new Set<string>(), hints = HINTS, fails = 0, disposed = false, sure = 0, selHist = -1;
  let cands: Entry[] = [], hintPrefix = "";
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { if (!disposed) fn(); }, ms); timers.push(id); return id; };

  // ---- HUD ----
  const lenEl = h("span", { class: "icn-stat", id: "icn-len" }, "");
  const bestEl = h("span", { class: "icn-stat best", id: "icn-best" }, "");
  const hintBtn = h("button", { class: "mopt", id: "icn-hint", onclick: () => useHint() }, "");
  const giveBtn = h("button", { class: "mopt", id: "icn-give", onclick: () => giveUp() }, "放弃");
  const chooseBtn = h("button", { class: "mopt", id: "icn-mode-choose", onclick: () => setMode("choose") }, "选择");
  const typeBtn = h("button", { class: "mopt", id: "icn-mode-type", onclick: () => setMode("type") }, "输入");
  const homoBtn = h("button", { class: "mopt", id: "icn-homo", onclick: () => { homo = !homo; ctx.store.set("homo", homo); ctx.sfx("tap"); reset(); } }, "");
  const hud = h("div", { class: "icn-hud" }, lenEl, bestEl, hintBtn, giveBtn, chooseBtn, typeBtn, homoBtn);

  // ---- stage: the idiom of the moment ----
  const who = h("div", { class: "icn-who", id: "icn-who" }, "");
  const strip = h("div", { class: "icn-strip", id: "icn-strip" });
  const exp = h("div", { class: "icn-exp user", id: "icn-exp" }, "");
  const stage = h("div", { class: "icn-stage" }, who, strip, exp);

  // ---- play area ----
  const needEl = h("span", { class: "icn-need user", id: "icn-need" }, "");
  const promptSub = h("span", { class: "icn-sub", id: "icn-sub" }, "");
  const prompt = h("div", { class: "icn-prompt" }, h("span", {}, "下一个成语的首字："), needEl, promptSub);
  const chipsEl = h("div", { class: "icn-chips", id: "icn-chips" });
  const input = h("input", { class: "icn-input user", id: "icn-input", type: "text", lang: "zh-CN", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "send", placeholder: "输入四字成语", "aria-label": "输入四字成语" }) as HTMLInputElement;
  const submit = h("button", { class: "primary", id: "icn-submit", onclick: () => submitTyped() }, "提交");
  const form = h("div", { class: "icn-form", id: "icn-form" }, input, submit);
  const fb = h("div", { class: "icn-fb", id: "icn-fb", "aria-live": "polite" }, "");
  const hist = h("div", { class: "icn-hist", id: "icn-hist" });
  const hexp = h("div", { class: "icn-hexp user", id: "icn-hexp" }, "");
  const play = h("div", { class: "icn-play" }, prompt, chipsEl, form, fb, hist, hexp);

  // ---- overlay ----
  const title = h("h2", {}, ""), msg = h("p", {}, ""), ans = h("p", { class: "icn-ans user", id: "icn-ans" }, "");
  const again = h("button", { class: "primary", id: "icn-start", onclick: () => { ctx.sfx("tap"); if (phase === "ready") begin(); else if (phase === "over") { reset(); begin(); } } }, "开始");
  const ovl = h("div", { class: "icn-ovl", id: "icn-ovl" }, title, msg, ans, again);
  const body = h("div", { class: "icn-body" }, stage, play, ovl);
  root.append(h("div", { class: "icn-wrap" }, hud, body));

  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submitTyped(); } });
  input.addEventListener("input", () => { if (fb.classList.contains("ok") === false) fb.textContent = ""; });

  const setOvl = (t: string, m: string, a: string, b: string, show: boolean) => { title.textContent = t; msg.textContent = m; ans.textContent = a; ans.hidden = !a; again.textContent = b; ovl.hidden = !show; };
  const last = () => chain[chain.length - 1];
  const need = (): Need => needOf(last().e);

  function refreshHud() {
    lenEl.textContent = `接龙：${chain.length}`;
    bestEl.textContent = `最高：${Math.max(best(), chain.length)}`;
    hintBtn.textContent = `提示（${hints}）`; hintBtn.disabled = phase !== "player" || hints <= 0;
    giveBtn.textContent = sure ? "再点一次放弃" : "放弃"; giveBtn.classList.toggle("sure", !!sure); giveBtn.disabled = phase !== "player";
    chooseBtn.classList.toggle("on", mode === "choose"); typeBtn.classList.toggle("on", mode === "type");
    homoBtn.textContent = homo ? "谐音：开" : "谐音：关"; homoBtn.classList.toggle("on", homo);
  }
  const cellsOf = (e: Entry) => [...e.w].map((c, i) => h("div", { class: "icn-cell" }, h("span", { class: "icn-py" }, e.syl[i] ?? ""), h("span", { class: "icn-ch user" }, c)));
  function showCurrent(animate: boolean) {
    const l = last();
    strip.replaceChildren(...(l ? cellsOf(l.e) : []));
    strip.classList.remove("pop"); if (animate) { void strip.offsetWidth; strip.classList.add("pop"); }
    who.textContent = l ? (l.who === "cpu" ? "电脑出的成语" : "你接的成语") : ""; who.classList.toggle("you", !!l && l.who === "you");
    exp.textContent = l ? l.e.e : "";
  }
  function renderHist() {
    hist.replaceChildren(...chain.map((l, i) => h("button", { class: `icn-h user${l.who === "you" ? " you" : ""}${i === selHist ? " sel" : ""}`, "data-i": String(i), onclick: () => { selHist = i; ctx.sfx("tap"); hexp.textContent = `${l.e.w}  /  ${l.e.e}`; renderHist(); } }, l.e.w)));
    hist.scrollLeft = hist.scrollWidth;
  }
  function renderTurn() {
    const n = need();
    needEl.textContent = n.ch; promptSub.textContent = homo ? "（也可以用同音字）" : "";
    chipsEl.hidden = mode !== "choose"; form.hidden = mode !== "type";
    if (mode === "choose") {
      if (!cands.length) cands = candidates(lib!, n, homo, used, Math.random, true);
      chipsEl.replaceChildren(...cands.map((e, i) => h("button", { class: "icn-chip user", id: `icn-chip-${i}`, "data-w": e.w, onclick: (ev: Event) => answer(e.w, ev.currentTarget as HTMLElement) }, e.w)));
    } else { chipsEl.replaceChildren(); }
    refreshHud();
  }
  const say = (t: string, ok = false, extra = "") => { fb.className = ok ? "icn-fb ok" : "icn-fb"; fb.replaceChildren(t, ...(extra ? [h("span", { class: "user" }, extra)] : [])); };

  function reset() {
    cands = []; chain = []; used = new Set(); hints = HINTS; fails = 0; sure = 0; selHist = -1; hintPrefix = ""; fb.textContent = ""; hexp.textContent = ""; input.value = "";
    timers.splice(0).forEach((t) => clearTimeout(t));
    if (!lib) { phase = "loading"; setOvl("成语接龙", "正在载入成语库…", "", "开始", true); again.disabled = true; strip.replaceChildren(); who.textContent = ""; exp.textContent = ""; hist.replaceChildren(); refreshHud(); return; }
    phase = "ready"; again.disabled = false;
    setOvl("成语接龙", "电脑先出一个成语，请用它的最后一个字接下一个。", "", "开始", true);
    strip.replaceChildren(); who.textContent = ""; exp.textContent = ""; needEl.textContent = ""; chipsEl.replaceChildren(); hist.replaceChildren();
    refreshHud();
  }
  function begin() {
    if (phase !== "ready" || !lib) return;
    const e = openingMove(lib, homo, Math.random, mode === "choose");
    chain = [{ who: "cpu", e }]; used.add(e.w);
    setOvl("", "", "", "", false); ctx.sfx("move");
    showCurrent(true); renderHist(); startTurn();
  }
  function startTurn() { phase = "player"; fails = 0; cands = []; hintPrefix = ""; renderTurn(); if (mode === "type") input.focus({ preventScroll: true }); }
  function setMode(m: Mode) { if (m === mode) return; mode = m; ctx.store.set("mode", m); ctx.sfx("tap"); reset(); }

  function fail(why: Fail, el?: HTMLElement) {
    fails++; ctx.sfx("bad");
    if (el) { el.classList.add("no"); (el as HTMLButtonElement).disabled = true; }
    say(why === "notfound" ? "不在成语库中。" : why === "first" ? "首字不符。" : why === "used" ? "已经用过。" : "请输入成语。");
    fb.append(h("span", { class: "icn-sub" }, ` 错误：${fails} / ${MAX_FAILS}`));
    refreshHud();
    if (fails >= MAX_FAILS) finish("fails");
  }
  function answer(word: string, el?: HTMLElement) {
    if (phase !== "player" || !lib) return;
    const r = validate(lib, word, need(), homo, used);
    if (!r.ok) { if (r.why === "empty") { say("请输入成语。"); ctx.sfx("bad"); return; } fail(r.why, el); return; }
    accept(r.entry);
  }
  function submitTyped() { if (phase !== "player") return; const v = input.value; answer(v); }
  function accept(e: Entry) {
    ctx.sfx("good");
    chain.push({ who: "you", e }); used.add(e.w); input.value = ""; fb.textContent = ""; hintPrefix = "";
    phase = "cpu"; selHist = -1; hexp.textContent = "";
    showCurrent(true); renderHist(); chipsEl.replaceChildren(); refreshHud();
    later(cpuTurn, CPU_DELAY);
  }
  function cpuTurn() {
    if (phase !== "cpu" || !lib) return;
    const m = computerMove(lib, need(), homo, used, Math.random, mode === "choose");
    if (!m) { finish("cpuStuck"); return; }
    chain.push({ who: "cpu", e: m }); used.add(m.w); ctx.sfx("move");
    showCurrent(true); renderHist();
    if (!follow(lib, needOf(m), homo, used).length) { finish("playerStuck"); return; }
    startTurn();
  }
  function useHint() {
    if (phase !== "player" || hints <= 0 || !lib) return;
    const r = hintFor(lib, need(), homo, used, Math.random);
    if (!r) return;
    hints--; ctx.sfx("tap");
    // in the choose mode the chip with that idiom is marked as well when it is among the chips
    chipsEl.querySelectorAll<HTMLElement>(".icn-chip").forEach((c) => c.classList.toggle("hint", c.dataset.w === r.entry.w));
    hintPrefix = r.prefix;
    say("提示：", true, r.prefix);
    refreshHud();
  }
  function giveUp() {
    if (phase !== "player" || !lib) return;
    if (!sure) { sure = 1; ctx.sfx("tap"); refreshHud(); later(() => { sure = 0; refreshHud(); }, 2500); return; }
    finish("gaveUp");
  }

  function finish(why: "fails" | "gaveUp" | "cpuStuck" | "playerStuck") {
    if (phase === "over" || !lib) return;
    phase = "over"; sure = 0;
    const sc = chain.length, old = best(), newBest = sc > old;
    if (newBest) ctx.store.set(bestKey(), sc);
    const win = why === "cpuStuck";
    ctx.sfx(win ? "win" : "lose"); refreshHud();
    let answerText = "";
    if (why === "gaveUp" || why === "fails" || why === "playerStuck") { const r = why === "playerStuck" ? null : hintFor(lib, need(), homo, used, Math.random); answerText = r ? r.entry.w : ""; }
    const line = newBest && sc > 1 ? `新纪录：${sc}` : `接龙长度：${sc}`;
    const t = win ? "你赢了。" : "游戏结束";
    const m = why === "cpuStuck" ? "电脑接不上了，你赢了。" : why === "fails" ? "连续三次错误，游戏结束。" : why === "gaveUp" ? "你放弃了。" : "没有可接的成语，游戏结束。";
    later(() => { if (phase !== "over") return; setOvl(t, m, "", "再玩一次", true); ans.replaceChildren(...(answerText ? ["参考答案：", h("span", { class: "user" }, answerText)] : [])); ans.hidden = !answerText; msg.append(h("br"), line); }, win ? 400 : 250);
    ctx.toast(line, 1500);
  }

  (window as unknown as Record<string, unknown>).__idiomchain = {
    phase: () => phase, chain: () => chain.map((c) => ({ who: c.who, w: c.e.w })), lib: () => lib, mode: () => mode, homo: () => homo, hints: () => hints, fails: () => fails, need: () => (chain.length ? need() : null),
    used: () => [...used], cands: () => cands.map((c) => c.w), hintPrefix: () => hintPrefix, delay: CPU_DELAY,
  };
  reset();
  getLib().then((l) => { if (disposed) return; lib = l; if (phase === "loading") reset(); });

  const onKey = (e: KeyboardEvent) => {
    if (phase !== "player" || mode !== "choose" || e.target === input) return;
    const i = ["1", "2", "3", "4"].indexOf(e.key);
    if (i >= 0) { const c = chipsEl.children[i] as HTMLButtonElement | undefined; if (c && !c.disabled) c.click(); }
  };
  window.addEventListener("keydown", onKey);
  return () => {
    disposed = true; timers.forEach((t) => clearTimeout(t));
    window.removeEventListener("keydown", onKey);
    delete (window as unknown as Record<string, unknown>).__idiomchain;
  };
}
