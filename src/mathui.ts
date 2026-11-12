/**
 * The math game screen (full screen): a TOTAL time (a bar that runs down), one question at a time with four big choices; the child answers by himself
 * (no grown-up needed). A right answer goes on at once; a wrong one shows the right answer for a moment. The game ends when the questions are done or the
 * time is up. The rules / saving are up to the caller (`onSave`).
 */
import { h, confirmDlg } from "./ui";
import type { Q } from "./mathgen";
import { translateNow } from "./i18n";
import type { AnswerMode } from "./mathsettings";

export interface Answer { topic: string; right: boolean; q: Q }
/** answers that can be typed on the keypad: whole numbers, decimals, negatives, percents and plain fractions (the rest is always answered by choosing) */
export const typable = (a: string): boolean => /^−?\d+(\.\d+)?%?$|^−?\d+\/\d+$/.test(a);

export interface MathGameOpts {
  color: string;
  questions: Q[];
  /** the total time in seconds */
  seconds: number;
  topicName: (id: string) => string;
  /** how the child answers: by choosing (default) or by typing on a keypad (questions whose answer cannot be typed are still chosen) */
  mode?: AnswerMode;
  /** relaxed (science): no time limit, and after every answer (right or wrong) a short "did you know" text is shown with a Next button */
  relaxed?: boolean;
  explain?: (q: Q) => string;
  onSave: (answers: Answer[], score: number, total: number, usedSeconds: number, finished: boolean) => Promise<void>;
  onAgain: () => void;
  onClose: () => void;
}

const SVG = "http://www.w3.org/2000/svg";
const starSvg = (on: boolean) => { const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "gstar" + (on ? " on" : "")); s.innerHTML = '<path d="M12 1.800l3 6.500 7.100.9-5.200 4.900 1.400 7L12 17.600 5.700 21.100l1.400-7L1.900 9.200l7.100-.9z" stroke-width="1.500" stroke-linejoin="round"/>'; return s; };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const starsFor = (score: number, total: number) => (total === 0 ? 0 : score / total >= 0.9 ? 3 : score / total >= 0.6 ? 2 : 1);

/**
 * Makes a question fit its card by measuring it AS IT IS SHOWN (already translated: an English or French sentence is longer than the Chinese one): long
 * sentences wrap onto more lines, and when it is still too wide (a long expression) or too tall, the size is reduced step by step.
 */
export function fitQuestion(el: HTMLElement, box: HTMLElement): void {
  translateNow(el);
  el.style.fontSize = "";
  // a sentence may wrap onto more lines; an expression stays on one line (and is made smaller when it is too wide)
  el.style.whiteSpace = /\p{L}{3,}/u.test(el.textContent ?? "") ? "" : "nowrap";
  // the room the card really has (on a low landscape screen the card is squeezed by the screen, not made taller by its text)
  const cs = getComputedStyle(box);
  const maxH = Math.max(28, Math.min(window.innerHeight * 0.3, (box.clientHeight || 1e4) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)));
  let size = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 16; i++) {
    if (el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height <= maxH) break;
    size *= 0.92;
    el.style.fontSize = `${size}px`;
  }
}

export function openMathGame(o: MathGameOpts): void {
  const total = o.questions.length;
  const answers: Answer[] = [];
  let idx = 0, score = 0;
  let phase: "ask" | "feedback" | "end" = "ask";
  let timer: ReturnType<typeof setInterval> | undefined;
  let next: ReturnType<typeof setTimeout> | undefined;
  let started = Date.now(), leftMs = o.seconds * 1000, tickAt = Date.now();

  const quit = h("button", { class: "gquit", id: "game-quit", title: "退出游戏", "aria-label": "退出游戏" }, "×");
  const progress = h("span", { class: "gprogress", id: "game-progress" });
  const scoreEl = h("span", { class: "gscore", id: "game-score" }, "★ 0");
  const bar = h("i", { id: "math-bar" });
  const timeText = h("span", { class: "mtime-text", id: "math-time" });
  const qText = h("div", { class: "mq-text", id: "math-q" });
  const qBox = h("div", { class: "mq", id: "math-card" }, qText);
  const topic = h("div", { class: "mtopic", id: "math-topic" });
  const grid = h("div", { class: "mchoices", id: "math-choices" });
  let typed = "";
  let typing = false;   // the question on screen is answered on the keypad
  const root = h("div", { class: "game mathgame", id: "game", role: "dialog", "aria-modal": "true", style: `--kid:${o.color}` },
    h("div", { class: "gtop" }, quit, h("div", { class: "gmid" }, progress), scoreEl),
    o.relaxed ? null : h("div", { class: "mtime" }, h("div", { class: "mbar" }, bar), timeText),
    h("div", { class: "mbody" }, topic, qBox, grid));

  const used = () => Math.round(o.seconds - leftMs / 1000);
  const setTime = () => {
    const ratio = Math.max(0, Math.min(1, leftMs / (o.seconds * 1000)));
    bar.style.width = `${ratio * 100}%`;
    bar.style.background = `hsl(${Math.round(130 * ratio)} 72% 42%)`;
    timeText.textContent = fmtTime(Math.ceil(leftMs / 1000));
    root.dataset.left = String(Math.max(0, Math.round(leftMs / 1000)));
  };
  const stop = () => { clearInterval(timer); clearTimeout(next); timer = undefined; };
  const run = () => {
    tickAt = Date.now();
    clearInterval(timer);
    timer = setInterval(() => {
      const now = Date.now();
      leftMs -= now - tickAt; tickAt = now;
      setTime();
      if (leftMs <= 0) { leftMs = 0; setTime(); finish(true); }
    }, 100);
  };

  function ask() {
    if (idx >= total) return finish(false);
    phase = "ask";
    const q = o.questions[idx];
    progress.textContent = `${idx + 1} / ${total}`;
    topic.textContent = o.topicName(q.topic);
    qText.textContent = q.q;
    fitQuestion(qText, qBox);
    typing = o.mode === "keypad" && typable(q.a);
    typed = "";
    grid.classList.toggle("keypad", typing);
    if (typing) { grid.classList.remove("long", "mid"); }
    if (typing) {
      const input = h("div", { class: "minput user", id: "math-input" }, "?");
      const hint = h("div", { class: "mhint", id: "math-hint" });
      const keys = ["7", "8", "9", "⌫", "4", "5", "6", "−", "1", "2", "3", ".", "0", "/", "%", "✓"].map((k) =>
        h("button", { class: "mkey" + (k === "✓" ? " ok" : k === "⌫" ? " del" : ""), "data-k": k, title: k === "✓" ? "确定" : k === "⌫" ? "删除" : k, "aria-label": k === "✓" ? "确定" : k === "⌫" ? "删除" : k, onclick: () => press(k) }, k));
      grid.replaceChildren(input, hint, h("div", { class: "mkeys", id: "math-keys" }, ...keys));
    } else {
      const longest = Math.max(...q.choices.map((c) => [...c].length));
      grid.classList.toggle("long", longest > 14);
      grid.classList.toggle("mid", longest > 7 && longest <= 14);
      grid.replaceChildren(...q.choices.map((c) => h("button", { class: "mchoice user", "data-v": c, onclick: () => answer(c) }, c)));
    }
    root.classList.remove("ok", "bad");
  }
  /** a key of the keypad */
  function press(k: string) {
    if (phase !== "ask" || !typing) return;
    if (k === "✓") { if (typed) answer(typed); return; }
    typed = k === "⌫" ? typed.slice(0, -1) : typed.length < 9 ? typed + k : typed;
    const el = grid.querySelector<HTMLElement>("#math-input");
    if (el) el.textContent = typed || "?";
  }
  function answer(c: string) {
    if (phase !== "ask") return;
    phase = "feedback";
    const q = o.questions[idx];
    const right = c.replace(/-/g, "−").replace(/\s+/g, "") === q.a;
    answers.push({ topic: q.topic, right, q });
    if (right) score++;
    scoreEl.textContent = `★ ${score}`;
    root.classList.add(right ? "ok" : "bad");
    if (typing) {
      grid.querySelectorAll<HTMLButtonElement>(".mkey").forEach((b) => (b.disabled = true));
      grid.querySelector("#math-input")?.classList.add(right ? "right" : "wrong");
      if (!right) { const hint = grid.querySelector<HTMLElement>("#math-hint"); if (hint) { hint.textContent = ""; hint.append("正确答案：", h("b", { class: "user" }, q.a)); } }
    } else {
      grid.querySelectorAll<HTMLElement>(".mchoice").forEach((b) => {
        b.setAttribute("disabled", "");
        if (b.dataset.v === q.a) b.classList.add("right");
        else if (b.dataset.v === c) b.classList.add("wrong");
      });
    }
    root.dataset.last = right ? "right" : "wrong";
    if (o.relaxed) {
      const goNext = () => { clearTimeout(next); idx++; ask(); };
      const text = o.explain?.(q) ?? "";
      grid.append(h("div", { class: "mexplain", id: "math-explain" }, h("b", { class: right ? "yes" : "no" }, right ? "答对啦！" : "没关系，看看这个小知识～"), !right ? h("p", {}, "正确答案：", h("b", { class: "user" }, q.a)) : null, text ? h("p", { class: "user" }, text) : null,
        h("button", { class: "primary", id: "math-next", onclick: goNext }, idx + 1 < total ? "下一题" : "完成")));
      return;
    }
    next = setTimeout(() => { idx++; ask(); }, right ? 450 : 1400);
  }

  function finish(timeUp: boolean) {
    if (phase === "end") return;
    stop();
    phase = "end";
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    const usedS = timeUp ? o.seconds : used();
    const saving = o.onSave(answers, score, total, usedS, true);
    const stars = starsFor(score, total);
    const per = new Map<string, { right: number; n: number }>();
    for (const a of answers) { const c = per.get(a.topic) ?? { right: 0, n: 0 }; c.n++; if (a.right) c.right++; per.set(a.topic, c); }
    const rows = [...per.entries()].map(([t, c]) => h("div", { class: "mrow", "data-topic": t }, h("span", { class: "user" }, o.topicName(t)), h("b", {}, `${c.right} / ${c.n}`)));
    const again = h("button", { class: "primary", id: "game-again", onclick: async () => { await saving; root.remove(); o.onAgain(); } }, "再玩一次");
    const fin = h("button", { id: "game-done", onclick: async () => { await saving; root.remove(); o.onClose(); } }, "完成");
    root.replaceChildren(h("div", { class: "gend", id: "game-end" },
      h("h2", {}, timeUp ? "时间到！" : o.relaxed ? "探索完成！" : score === total ? "全对了！" : "练完了！"),
      h("div", { class: "gstars", "data-stars": String(stars) }, ...[1, 2, 3].map((n) => starSvg(n <= stars))),
      h("div", { class: "gresult" }, h("strong", { id: "game-final" }, String(score)), ` / ${total}`),
      o.relaxed ? null : h("p", { class: "muted" }, `用时 ${fmtTime(usedS)}`, answers.length < total ? `，做了 ${answers.length} 题` : ""),
      h("div", { class: "mrows" }, ...rows),
      h("div", { class: "row end" }, fin, again)));
  }

  async function leave() {
    if (phase === "end") return;
    const wasRunning = !!timer;
    stop();
    const yes = await confirmDlg("退出游戏？", answers.length ? "已经做过的题会保存下来。" : "还没有答题，不会保存。", "退出", true);
    if (!yes) {
      if (phase === "feedback" && !o.relaxed) next = setTimeout(() => { idx++; ask(); }, 500);
      if (wasRunning) run();
      return;
    }
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    root.remove();
    if (answers.length) void o.onSave(answers, score, total, used(), false);
    o.onClose();
  }
  function onKey(e: KeyboardEvent) {
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "Escape") void leave();
    else if (phase === "ask" && typing) {
      if (e.key === "Enter") press("✓");
      else if (e.key === "Backspace") press("⌫");
      else if (/^[0-9./%]$/.test(e.key)) press(e.key);
      else if (e.key === "-") press("−");
    } else if (phase === "ask" && /^[1-4]$/.test(e.key)) grid.querySelectorAll<HTMLElement>(".mchoice")[Number(e.key) - 1]?.click();
  }
  const onResize = () => { if (phase !== "end") fitQuestion(qText, qBox); };
  quit.addEventListener("click", () => void leave());
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  document.body.append(root);
  void started;
  setTime();
  ask();
  if (!o.relaxed) run();
}
