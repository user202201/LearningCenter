/**
 * The game screen (full screen): one character at a time in a round 田字格, a ring around it that runs down, and below it a big green tick and a big
 * red cross for the adult to press. Wrong ones (and time-outs) come back after the round, until all are right (at most MAX_ROUNDS rounds).
 * The rules are in game.ts; saving the result is up to the caller (`onSave`).
 */
import { h, confirmDlg } from "./ui";
import { loadPinyin, pinyinOf } from "./pinyin";
import * as G from "./game.ts";

export interface GameOpts {
  color: string;
  seconds: number;
  queue: G.Q[];
  /** called once at the end (finished = all rounds done) or when the game is left early with something answered */
  onSave: (results: G.Result[], score: number, total: number, finished: boolean) => Promise<void>;
  /** "play again": a new game from fresh data (called after saving) */
  onAgain: () => void;
  /** the game is closed (Done, or left early) */
  onClose: () => void;
  /** English words instead of characters: the word is plain text, a tap shows its meaning (not the pinyin), a speaker button says it aloud */
  words?: { meaning: (w: string) => string; speak?: (w: string) => void };
}

/**
 * Makes a word fit: it starts at the normal size (from the style sheet) and, when it is wider than 88 % of the board, the size is reduced by the
 * measured ratio, so ANY word (a 14-letter one, a phrase) is shown completely whatever the screen is. Exported for the tests.
 */
export function fitWord(ch: HTMLElement): void {
  const box = ch.closest<HTMLElement>(".gbox");
  if (!box) return;
  const run = () => {
    ch.style.fontSize = "";
    // inside the ring with a margin all round: the layout width (not the one of the animated / scaled box), 76 % of the board
    const avail = box.clientWidth * 0.76;
    const w = ch.offsetWidth || ch.getBoundingClientRect().width;
    if (avail > 0 && w > avail) ch.style.fontSize = `${(parseFloat(getComputedStyle(ch).fontSize) * avail) / w}px`;
  };
  run();
  // the font of the device may arrive after the first measure, and the board may still be growing in: measure again
  const text = ch.textContent;
  requestAnimationFrame(() => { if (ch.isConnected && ch.textContent === text) run(); });
  void document.fonts?.ready.then(() => { if (ch.isConnected && ch.textContent === text) run(); });
}
const SVG = "http://www.w3.org/2000/svg";
const R = 48.5;                                // radius of the ring in a 100 x 100 drawing (a thin ring on the very edge)
const C = 2 * Math.PI * R;
const tickSvg = (colour = "#fff") => { const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("aria-hidden", "true"); s.innerHTML = `<path d="M9 25l10 10L39 13" fill="none" stroke="${colour}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`; return s; };
const crossSvg = (colour = "#fff") => { const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("aria-hidden", "true"); s.innerHTML = `<path d="M12 12l24 24M36 12L12 36" fill="none" stroke="${colour}" stroke-width="7" stroke-linecap="round"/>`; return s; };
const speakerSvg = () => { const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("aria-hidden", "true"); s.innerHTML = '<path d="M6 18h8l10-8v28l-10-8H6z" fill="currentColor"/><path d="M31 17q6 7 0 14M37 12q11 12 0 24" fill="none" stroke="currentColor" stroke-width="3.500" stroke-linecap="round"/>'; return s; };
const starSvg = (on: boolean) => { const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "gstar" + (on ? " on" : "")); s.innerHTML = '<path d="M12 1.800l3 6.500 7.100.9-5.200 4.900 1.400 7L12 17.600 5.700 21.100l1.400-7L1.900 9.200l7.100-.9z" stroke-width="1.500" stroke-linejoin="round"/>'; return s; };

export function openGame(o: GameOpts): void {
  const total = o.queue.length;
  let queue = o.queue.slice();
  let idx = 0, round = 1, score = 0, answered = 0;
  let wrong: G.Q[] = [];
  const results = new Map<string, G.Result>();
  let phase: "banner" | "ask" | "feedback" | "end" = "banner";
  let timer: ReturnType<typeof setInterval> | undefined;
  let next: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => void) | null = null;       // what the timer `next` will do (held while the quit question is open)
  const later = (fn: () => void, ms: number) => { pending = fn; next = setTimeout(() => { pending = null; fn(); }, ms); };
  let deadline = 0;
  const secs = Math.max(1, o.seconds);

  const quit = h("button", { class: "gquit", id: "game-quit", title: "退出游戏", "aria-label": "退出游戏" }, "×");
  const progress = h("span", { class: "gprogress", id: "game-progress" });
  const scoreEl = h("span", { class: "gscore", id: "game-score" }, "★ 0");
  const roundTag = h("span", { class: "groundtag", id: "game-round" });
  const py = h("div", { class: "gpy", id: "game-py" });
  const ch = h("span", { class: "ch user", id: "game-char" });
  const box = h("div", { class: "gbox" }, ch);
  const fg = document.createElementNS(SVG, "circle");
  fg.setAttribute("class", "fg"); fg.setAttribute("cx", "50"); fg.setAttribute("cy", "50"); fg.setAttribute("r", String(R));
  fg.style.strokeDasharray = String(C);
  const ring = document.createElementNS(SVG, "svg");
  ring.setAttribute("viewBox", "0 0 100 100"); ring.setAttribute("class", "gring"); ring.setAttribute("aria-hidden", "true");
  ring.append(fg);
  const sec = h("span", { class: "gsec", id: "game-seconds" });
  const flash = h("div", { class: "gflash", id: "game-flash" });
  const dial = h("div", { class: "gdial", id: "game-dial" }, py, ring, flash, box, sec);   // (the flash is before the board: it is painted BEHIND the character)
  const no = h("button", { class: "gbtn no", id: "game-wrong", title: "答错了", "aria-label": "答错了" }, crossSvg());
  const yes = h("button", { class: "gbtn yes", id: "game-right", title: "答对了", "aria-label": "答对了" }, tickSvg());
  const banner = h("div", { class: "gbanner", id: "game-banner" });
  const hint = h("p", { class: "ghint" }, o.words ? "点一下屏幕可以看中文" : "点一下屏幕可以看拼音");
  const hintOf = (c: string) => (o.words ? o.words.meaning(c) : pinyinOf(c));
  const speak = o.words?.speak ? h("button", { class: "gspeak", id: "game-speak", title: "听发音", "aria-label": "听发音", onclick: (e: Event) => { e.stopPropagation(); if (phase === "ask" || phase === "feedback") o.words?.speak?.(queue[idx].ch); } }, speakerSvg()) : null;
  const stage = h("div", { class: "gstage" }, dial, banner, speak);
  const bar = h("div", { class: "gbar" }, no, yes);
  const root = h("div", { class: "game" + (o.words ? " words" : ""), id: "game", role: "dialog", "aria-modal": "true", style: `--kid:${o.color}` },
    h("div", { class: "gtop" }, quit, h("div", { class: "gmid" }, progress, roundTag), scoreEl), stage, hint, bar);

  const stop = () => { clearInterval(timer); clearTimeout(next); timer = undefined; };
  /** the ring burns away like a loading bar played backwards, and its colour moves smoothly from green through yellow and orange to red */
  const setRing = (left: number) => {
    const ratio = Math.max(0, Math.min(1, left / (secs * 1000)));
    const colour = `hsl(${Math.round(130 * ratio)} 72% 42%)`;
    fg.style.strokeDashoffset = String(C * (1 - ratio));
    fg.style.stroke = colour;
    sec.style.color = colour;
    sec.textContent = String(Math.max(0, Math.ceil(left / 1000)));
    dial.dataset.left = String(Math.max(0, Math.round(left)));
    dial.dataset.hue = String(Math.round(130 * ratio));
  };
  const reveal = (on: boolean) => { py.classList.toggle("show", on); };

  function ask() {
    if (idx >= queue.length) return nextRound();
    phase = "ask";
    const q = queue[idx];
    ch.textContent = q.ch;
    if (o.words) fitWord(ch);   // (measured: a long word gets a smaller size so that it stays inside the ring)
    py.textContent = hintOf(q.ch);
    reveal(false);
    dial.classList.remove("ok", "bad");
    flash.className = "gflash";
    banner.className = "gbanner";
    progress.textContent = `${idx + 1} / ${queue.length}`;
    roundTag.textContent = round > 1 ? "再练一遍" : "";
    dial.dataset.q = q.ch;
    no.disabled = yes.disabled = false;
    deadline = Date.now() + secs * 1000;
    setRing(secs * 1000);
    clearInterval(timer);
    timer = setInterval(() => {
      const left = deadline - Date.now();
      setRing(left);
      if (left <= 0) answer(false);
    }, 50);
  }

  function answer(correct: boolean) {
    if (phase !== "ask") return;
    phase = "feedback";
    clearInterval(timer);
    no.disabled = yes.disabled = true;
    const q = queue[idx];
    if (round === 1) {
      results.set(q.ch, { ch: q.ch, firstTry: correct, fixed: false });
      if (correct) score++;
      answered++;
    } else if (correct) {
      const r = results.get(q.ch);
      if (r) r.fixed = true;
    }
    if (!correct) wrong.push(q);
    scoreEl.textContent = `★ ${score}`;
    dial.classList.add(correct ? "ok" : "bad");
    fg.style.stroke = correct ? "#2f9e44" : "#e03131";
    flash.className = "gflash show " + (correct ? "yes" : "no");
    flash.replaceChildren(correct ? tickSvg("#2f9e44") : crossSvg("#e03131"));
    if (!o.words) void loadPinyin().then(() => { py.textContent = pinyinOf(q.ch); });
    if (!correct) reveal(true);                              // a miss shows the right reading (the meaning, for a word)
    dial.dataset.last = correct ? "right" : "wrong";
    later(() => { idx++; ask(); }, correct ? 650 : 1700);
  }

  function nextRound() {
    if (wrong.length === 0 || round >= G.MAX_ROUNDS) return finish();
    round++;
    queue = G.shuffle(wrong);
    wrong = [];
    idx = 0;
    phase = "banner";
    banner.textContent = o.words ? `再练一遍：${queue.length} 个词` : `再练一遍：${queue.length} 个字`;
    banner.className = "gbanner show";
    dial.classList.remove("ok", "bad");
    flash.className = "gflash";
    ch.textContent = "";
    py.textContent = "";
    roundTag.textContent = "再练一遍";
    no.disabled = yes.disabled = true;
    later(ask, 1600);
  }

  function finish() {
    stop();
    phase = "end";
    document.removeEventListener("keydown", onKey);
    const list = [...results.values()];
    const saving = o.onSave(list, score, total, true);
    const stars = G.starsFor(score, total);
    const missed = list.filter((r) => !r.firstTry).map((r) => r.ch);
    const open = missed.filter((c) => !list.find((r) => r.ch === c)?.fixed);
    const chips = h("div", { class: "gmissed" }, ...missed.map((c) => h("span", { class: "gchip user" + (open.includes(c) ? " open" : "") }, c)));
    pinyinReady(missed, chips);
    const again = h("button", { class: "primary", id: "game-again", onclick: async () => { await saving; root.remove(); o.onAgain(); } }, "再玩一次");
    const fin = h("button", { id: "game-done", onclick: async () => { await saving; root.remove(); o.onClose(); } }, "完成");
    root.replaceChildren(h("div", { class: "gend", id: "game-end" },
      h("h2", {}, score === total ? "全对了！" : "练完了！"),
      h("div", { class: "gstars", "data-stars": String(stars) }, ...[1, 2, 3].map((n) => starSvg(n <= stars))),
      h("div", { class: "gresult" }, h("strong", { id: "game-final" }, String(score)), ` / ${total}`),
      missed.length ? h("p", { class: "muted" }, o.words ? (open.length ? "还没记牢的词（下次接着练）：" : "刚才答错、后来练对了的词：") : (open.length ? "还没记牢的字（下次接着练）：" : "刚才答错、后来练对了的字：")) : h("p", { class: "muted" }, "一个都没错，太棒了！"),
      chips,
      h("div", { class: "row end" }, fin, again)));
  }
  /** the pinyin under the missed characters of the end screen */
  function pinyinReady(list: string[], chips: HTMLElement) {
    if (o.words) return chips.querySelectorAll<HTMLElement>(".gchip").forEach((c, i) => c.append(h("small", {}, o.words!.meaning(list[i]))));
    void loadPinyin().then(() => {
      chips.querySelectorAll<HTMLElement>(".gchip").forEach((c, i) => c.append(h("small", {}, pinyinOf(list[i]))));
    });
  }

  async function leave() {
    if (phase === "end") return;
    const wasAsking = phase === "ask";
    const resume = pending;                                  // the next question that was about to appear
    clearTimeout(next); pending = null;
    if (wasAsking) { clearInterval(timer); timer = undefined; deadline = deadline - Date.now(); }   // the clock stops while the question is open
    const yes2 = await confirmDlg("退出游戏？", answered ? "已经答过的题会保存下来。" : "还没有答题，不会保存。", "退出", true);
    if (!yes2) {
      if (resume) later(resume, 400);
      if (wasAsking && phase === "ask") {
        deadline = Date.now() + deadline;                    // go on with the time that was left
        timer = setInterval(() => { const left = deadline - Date.now(); setRing(left); if (left <= 0) answer(false); }, 50);
      }
      return;
    }
    stop();
    document.removeEventListener("keydown", onKey);
    root.remove();
    if (answered) void o.onSave([...results.values()], score, total, false);
    o.onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "ArrowRight" || e.key === "Enter") answer(true);
    else if (e.key === "ArrowLeft" || e.key === "Backspace") answer(false);
    else if (e.key === " ") { e.preventDefault(); reveal(!py.classList.contains("show")); }
    else if (e.key === "Escape") void leave();
  }

  no.addEventListener("click", () => answer(false));
  yes.addEventListener("click", () => answer(true));
  quit.addEventListener("click", () => void leave());
  // a tap anywhere on the screen (not on a button) shows / hides the pinyin: the whole screen is the target, not only the small board
  root.addEventListener("click", (e) => { if (phase === "ask" && !(e.target as HTMLElement).closest("button")) reveal(!py.classList.contains("show")); });
  document.addEventListener("keydown", onKey);
  const onResize = () => {   // (turning the device: the board changes size)
    if (!root.isConnected) return window.removeEventListener("resize", onResize);
    if (o.words && phase !== "end" && ch.textContent) fitWord(ch);
  };
  window.addEventListener("resize", onResize);
  document.body.append(root);
  if (!o.words) void loadPinyin().then(() => { if (phase === "ask") py.textContent = pinyinOf(queue[idx].ch); });
  ask();
}
