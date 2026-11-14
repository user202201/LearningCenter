/** The 天文 quiz: rounds of 10, no time limit, the explanation and a Next button after every answer. Pictures are drawn in code. Progress (memory boxes of game.ts) stays on this device. */
import { h, confirmDlg } from "./ui";
import * as G from "./game";
import { todayLocal } from "./model";
import { fmt, con } from "./spaceui";
import { sprite, drawPhase, constSvg } from "./spaceart";
import * as SM from "./spacemodel";

export function openQuiz(S: SM.Space, done: () => void): void {
  let doc = SM.loadDoc();
  const forced = (window as unknown as { __spaceKeys?: string[] }).__spaceKeys;   // (a hook for the tests: a fixed list of questions)
  const qs = forced ? forced.map((k) => SM.makeQuestion(S, k)) : SM.buildRound(S, doc, todayLocal());
  (window as unknown as { __spaceQuiz?: SM.Question[] }).__spaceQuiz = qs;
  const answers: { key: string; right: boolean; q: SM.Question }[] = [];
  let idx = 0, score = 0, phase: "ask" | "feedback" | "end" = "ask";
  const quit = h("button", { class: "gquit", id: "game-quit", title: "退出游戏", "aria-label": "退出游戏", onclick: () => void leave() }, "×");
  const progress = h("span", { class: "gprogress", id: "game-progress" }), scoreEl = h("span", { class: "gscore", id: "game-score" }, "★ 0");
  const promptEl = h("div", { class: "mq-text sp-q", id: "sp-q" }), figEl = h("div", { class: "sp-qfig", id: "sp-qfig" });
  const grid = h("div", { class: "mchoices sp-choices", id: "math-choices" }), fb = h("div", { class: "sp-fb", id: "sp-fb" });
  const kindEl = h("div", { class: "mtopic", id: "sp-kind" });
  const root = h("div", { class: "game mathgame sp-quiz", id: "game", role: "dialog", "aria-modal": "true" },
    h("div", { class: "gtop" }, quit, h("div", { class: "gmid" }, progress), scoreEl),
    h("div", { class: "mwrap" }, h("div", { class: "mbody sp-qbody" }, kindEl, h("div", { class: "mq", id: "math-card" }, promptEl), figEl, grid, fb)));
  document.body.append(root);

  const figure = (q: SM.Question): HTMLElement | null => {
    if (!q.fig) return null;
    if (q.fig.t === "const") { const d = h("div", { class: "sp-svg sp-qconst" }); d.innerHTML = constSvg(S.constellations.find((c) => c.id === q.fig!.id)!); return d; }
    const cv = h("canvas", { class: "sp-qcv", width: 320, height: 320, role: "img", "aria-label": "?" });
    const c = cv.getContext("2d")!;
    if (q.fig.t === "phase") { c.fillStyle = "#0b0d26"; c.fillRect(0, 0, 320, 320); drawPhase(c, 160, 160, 120, q.fig.E ?? 0); }
    else { const ring = q.fig.id === "saturn"; const sp = sprite(q.fig.id, 256, ring); const sz = ring ? 320 : 256; c.drawImage(sp, (320 - sz) / 2, (320 - sz) / 2, sz, sz); c.fillStyle = "rgba(0,0,0,0)"; }
    if (q.fig.t !== "phase") { cv.style.background = "radial-gradient(circle at 50% 40%, #1c1f4d, #0b0d26)"; }
    cv.dataset.fig = q.fig.id;
    return cv;
  };
  const choose = (k: string) => {
    if (phase !== "ask") return;
    const q = qs[idx], right = k === q.answer;
    grid.querySelectorAll<HTMLElement>(".mchoice").forEach((b) => { b.setAttribute("disabled", ""); if (b.dataset.v === q.answer) b.classList.add("right"); else if (b.dataset.v === k) b.classList.add("wrong"); });
    phase = "feedback"; answers.push({ key: q.key, right, q }); if (right) score++;
    scoreEl.textContent = `★ ${score}`; root.classList.add(right ? "ok" : "bad"); root.dataset.last = right ? "right" : "wrong";
    const last = idx + 1 >= qs.length;
    const ex = q.explain;
    fb.replaceChildren(h("div", { class: "mexplain", id: "math-explain" }, h("b", { class: right ? "yes" : "no" }, right ? "回答正确。" : "回答有误。"),
      ex.text ? con(ex.text, "p") : h("p", {}, ...fmt(ex.tpl!, ex.args ?? [])),
      h("button", { class: "primary", id: "math-next", onclick: () => { if (phase !== "feedback") return; idx++; ask(); } }, last ? "完成" : "下一题")));
    fb.querySelector<HTMLElement>("#math-next")?.focus({ preventScroll: true });
  };
  function ask() {
    if (idx >= qs.length) return finish();
    phase = "ask"; root.classList.remove("ok", "bad");
    const q = qs[idx];
    progress.textContent = `${idx + 1} / ${qs.length}`; root.dataset.qkey = q.key; fb.replaceChildren();
    kindEl.textContent = SM.kindName(q.kind);
    promptEl.replaceChildren(...fmt(q.stem.tpl, q.stem.args));
    const f = figure(q); figEl.replaceChildren(...(f ? [f] : [])); figEl.style.display = f ? "" : "none";
    const longest = Math.max(...q.choices.map((c) => [...c.t].length));
    grid.classList.toggle("long", longest > 14);
    grid.replaceChildren(...q.choices.map((c) => h("button", { class: "mchoice", "data-v": c.k, onclick: () => choose(c.k) }, c.t)));
  }
  const persist = (summary: boolean) => { doc = SM.applyAnswers(SM.loadDoc(), answers.map((a) => ({ key: a.key, right: a.right })), todayLocal(), summary ? { score, total: qs.length } : undefined); SM.saveDoc(doc); };
  function finish() {
    if (phase === "end") return; phase = "end"; document.removeEventListener("keydown", onKey);
    persist(true);
    const stars = G.starsFor(score, qs.length), wrong = answers.filter((a) => !a.right);
    const starSvg = (on: boolean) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "gstar" + (on ? " on" : "")); s.innerHTML = '<path d="M12 1.800l3 6.500 7.100.9-5.200 4.900 1.400 7L12 17.600 5.700 21.100l1.400-7L1.900 9.200l7.100-.9z" stroke-width="1.500" stroke-linejoin="round"/>'; return s; };
    root.replaceChildren(h("div", { class: "gend", id: "game-end" },
      h("h2", {}, score === qs.length ? "全部正确。" : "练习完成。"),
      h("div", { class: "gstars", "data-stars": String(stars) }, ...[1, 2, 3].map((n) => starSvg(n <= stars))),
      h("div", { class: "gresult" }, h("strong", { id: "game-final" }, String(score)), ` / ${qs.length}`),
      wrong.length ? h("div", { class: "mrows", id: "sp-wrong" }, h("p", { class: "muted small" }, "需要复习："), ...wrong.map((a) => h("div", { class: "mrow", "data-key": a.key }, con(a.q.explain.text ?? a.q.stem.args.join(" "))))) : null,
      h("div", { class: "row end" },
        h("button", { id: "game-done", onclick: () => { root.remove(); done(); } }, "完成"),
        h("button", { class: "primary", id: "game-again", onclick: () => { root.remove(); openQuiz(S, done); } }, "再玩一次"))));
  }
  async function leave() {
    if (phase === "end") return;
    const yes = await confirmDlg("退出游戏？", answers.length ? "已完成的题目将被保存。" : "尚未答题，不会保存。", "退出", true);
    if (!yes) return;
    document.removeEventListener("keydown", onKey); if (answers.length) persist(false); root.remove(); done();
  }
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) return document.removeEventListener("keydown", onKey);
    if (e.key === "Enter" && phase === "feedback") { e.preventDefault(); root.querySelector<HTMLElement>("#math-next")?.click(); }
    const n = Number(e.key); if (phase === "ask" && n >= 1 && n <= 4) grid.querySelectorAll<HTMLElement>(".mchoice")[n - 1]?.click();
  };
  document.addEventListener("keydown", onKey);
  ask();
}
