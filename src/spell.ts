/**
 * Spelling dictation (听写) of the Languages subject (rule 51): `#/english/<kid>/dictation`. The device says a word (en-US, or fr-FR on the English screen, which
 * teaches French), the child TYPES it; on "确定" the typed letters are marked one by one (right green, wrong red) and the right spelling is shown.
 * A round has 10 words of this week and the week before; the words that were wrong are asked once more at the end of the round; the results are kept in
 * `english/<kid>.dictation.json` (`french/` for the French track) and the wrong words go back into the memory boxes of the game.
 */
import { h, toast } from "./ui";
import * as api from "./api";
import * as M from "./model";
import * as G from "./game";
import * as D from "./dictlogic";
import * as W from "./words";
import { sfx } from "./games/sfx";
import { X, errText, frame, icon, say, stopSpeech } from "./dwshell";

const dictPath = (id: string) => `${W.wordsDir()}/${id}.dictation.json`;
const lang = () => (W.studyLang() === "fr" ? "fr-FR" : "en-US");

export async function renderSpelling(id: string): Promise<void> {
  const my = X.epoch();
  X.showLoading();
  let kid: M.KidData, all: W.Word[];
  try {
    await X.loadShared();
    [kid, all] = await Promise.all([api.readJson<M.KidData>(W.wordsPath(id)).then((x) => x ?? M.EMPTY_KID), W.loadWords()]);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderSpelling(id)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) return void (location.hash = "#/subject/english");
  const start = M.sundayOf(M.todayLocal());
  const map = W.wordMap(all);
  const thisWeek = M.weekOf(kid, start)?.chars ?? [], lastWeek = M.weekOf(kid, D.lastWeekOf(start))?.chars ?? [];
  const back = `#/english/${id}`;
  if (!thisWeek.length && !lastWeek.length) {
    return X.show(frame(k, "听写", back, h("main", { class: "scroll" }, h("div", { class: "narrow dw-narrow" }, h("p", { class: "empty", id: "sp-empty" }, "暂无单词。请先查看“本周”。")))));
  }
  newRound(k, thisWeek, lastWeek, map, back);
}

function newRound(k: M.Kid, thisWeek: string[], lastWeek: string[], map: Map<string, W.Word>, back: string): void {
  const words = D.pickRound(thisWeek, lastWeek);
  const queue = words.slice();
  const firstTry = new Map<string, boolean>();   // word -> right at the first try
  let idx = 0, hinted = false, checked = false, again = false;

  const progress = h("div", { class: "dw-progress", id: "sp-progress" });
  const roundTag = h("div", { class: "groundtag", id: "sp-round" });
  const hearBtn = h("button", { class: "dw-hearbtn", id: "sp-hear", title: "再听一遍", "aria-label": "再听一遍", onclick: () => hear() }, icon("speaker"));
  const input = h("input", { class: "sp-input", id: "sp-input", type: "text", autocomplete: "off", autocapitalize: "none", spellcheck: false, "aria-label": "拼写", lang: W.studyLang() === "fr" ? "fr" : "en" }) as HTMLInputElement;
  input.setAttribute("autocorrect", "off");
  const hintLine = h("div", { class: "sp-hintline", id: "sp-hintline" });
  const letters = h("div", { class: "sp-letters user", id: "sp-letters" });
  const answerBox = h("div", { class: "sp-answer user", id: "sp-answer" });
  const meaning = h("div", { class: "sp-meaning user", id: "sp-meaning" });
  const hintBtn = h("button", { class: "mopt", id: "sp-hint", onclick: () => { hinted = true; hintLine.textContent = `${D.firstLetter(queue[idx])} …`; input.focus(); } }, "提示首字母");
  const ok = h("button", { class: "primary", id: "sp-ok", onclick: () => submit() }, "确定");
  const next = h("button", { class: "primary", id: "sp-next", onclick: () => advance() }, "下一个");
  const quit = h("button", { class: "gquit dw-quit", id: "sp-quit", title: "结束听写", "aria-label": "结束听写", onclick: () => { stopSpeech(); location.hash = back; } }, "×");
  const body = h("main", { class: "scroll dw-run" }, h("div", { class: "narrow dw-narrow sp-wrap" },
    h("div", { class: "dw-runtop" }, quit, progress), roundTag, hearBtn, hintLine, input, letters, answerBox, meaning,
    h("div", { class: "sp-btns" }, hintBtn, ok, next)));
  X.show(frame(k, "听写", back, body, "sp-page"));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!checked) submit(); else advance(); } });

  const hear = () => { say(queue[idx], lang(), () => { /* nothing waits for the voice */ }, 0.75); };
  const ask = () => {
    checked = false; hinted = false;
    const w = queue[idx];
    progress.textContent = `${idx + 1} / ${queue.length}`;
    roundTag.textContent = again && idx >= words.length ? "再练一遍" : "";
    input.value = ""; input.disabled = false; input.dataset.word = w;
    hintLine.textContent = ""; letters.replaceChildren(); answerBox.replaceChildren(); meaning.textContent = "";
    answerBox.className = "sp-answer user";
    ok.hidden = false; next.hidden = true; hintBtn.hidden = false;
    input.focus({ preventScroll: true });
    hear();
  };
  const submit = () => {
    if (checked) return;
    const w = queue[idx], typed = input.value;
    if (!typed.trim()) { input.focus(); return; }
    checked = true;
    const right = D.isSpelledRight(w, typed);
    if (!firstTry.has(w)) firstTry.set(w, right);
    letters.replaceChildren(...D.diffLetters(w, typed).map((l) => h("span", { class: "sp-l " + (l.ok ? "ok" : "bad") }, l.ch === " " ? "·" : l.ch)));
    letters.dataset.right = right ? "1" : "0";
    // a missing tail is wrong too: the letters of the answer that were not typed
    if (!right) {
      answerBox.append(h("span", { class: "muted" }, "正确拼写："), h("b", { id: "sp-correct" }, w));
      answerBox.classList.add("show");
    }
    meaning.textContent = W.meaningOf(map.get(W.wordKey(w)));
    sfx(right ? "good" : "bad");
    input.disabled = true; ok.hidden = true; next.hidden = false; hintBtn.hidden = true;
    next.focus({ preventScroll: true });
    if (right && hinted) hintLine.textContent = "";
  };
  const advance = () => {
    if (!checked) return;
    idx++;
    if (idx >= queue.length) {
      // the first pass is over: the words that were wrong are asked once more
      if (!again) {
        const wrong = words.filter((x) => firstTry.get(x) === false);
        if (wrong.length) { again = true; queue.push(...wrong); return ask(); }
      }
      return void finish();
    }
    ask();
  };
  const finish = async () => {
    stopSpeech();
    const wrong = words.filter((x) => firstTry.get(x) === false);
    const today = M.todayLocal();
    const session: D.Session = { id: D.newSessionId(today), date: today, week: M.sundayOf(today), kind: "word", items: words, wrong };
    X.show(frame(k, "听写", back, h("main", { class: "scroll" }, h("div", { class: "center-msg" }, h("div", { class: "spin" })))));
    const done = toast("正在保存…", 0, true);
    try {
      await api.update<D.DictDoc>(dictPath(k.id), D.EMPTY_DICT, (cur) => D.addSession(cur, session), `spelling ${k.id}`);
      if (wrong.length) await api.update<G.Review>(W.wordsReviewPath(k.id), G.EMPTY_REVIEW, (cur) => D.feedReview(cur, wrong, today), `spelling review ${k.id}`);
      done();
      toast(wrong.length ? `已保存听写结果：错 ${wrong.length} 个` : "已保存听写结果：全部正确");
    } catch (e) {
      done();
      toast(errText(e), 6000);
    }
    X.show(frame(k, "听写", back, h("main", { class: "scroll" }, h("div", { class: "narrow dw-narrow dw-summary", id: "sp-summary" },
      h("h2", { class: "dw-result" }, wrong.length ? `答对 ${words.length - wrong.length} / ${words.length}` : "全部正确。"),
      wrong.length ? h("div", { class: "sp-wronglist", id: "sp-wronglist" }, ...wrong.map((x) => h("div", { class: "sp-wrong user", "data-w": x }, h("b", {}, x), h("span", {}, W.meaningOf(map.get(W.wordKey(x))))))) : null,
      h("div", { class: "lobby-go" },
        h("button", { class: "primary wide", id: "sp-again", onclick: () => newRound(k, thisWeek, lastWeek, map, back) }, "再来一轮"),
        h("button", { class: "link", id: "sp-done", onclick: () => (location.hash = back) }, "完成"))))));
  };
  ask();
}
