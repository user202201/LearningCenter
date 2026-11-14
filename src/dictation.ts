/**
 * Dictation (听写) for 识字 (rule 51): `#/dictation/<kid>`. The page lists what can be dictated (this week's characters, optionally this week's idioms and last
 * week's); "开始听写" makes the device read each item with its own voice (a character as a common word that holds it, "朋友，朋友的朋"), a pause between
 * the items, a calm ring, repeat / previous / next / pause, nothing typed (the child writes on paper, or on the scratch sheet of the math game); then the
 * grown-up checks each answer with a tick or a cross (like the game), the wrong ones are listed and saved in `dictation/<kid>.json`, go back into the memory
 * boxes of the game, and "错字再练" dictates only those. The rules are in dictlogic.ts.
 */
import { h, toast } from "./ui";
import * as api from "./api";
import * as M from "./model";
import * as G from "./game";
import * as D from "./dictlogic";
import { loadPinyin, pinyinOf } from "./pinyin";
import { createPad, type Pad } from "./scratchpad";
import { sfx } from "./games/sfx";
import { X, errText, frame, icon, ring, say, stopSpeech, unlockSpeech, loadSettings, saveSettings, weekOr } from "./dwshell";

const dictPath = (id: string) => `dictation/${id}.json`;
const reviewPath = (id: string) => `kids/${id}.review.json`;
let charWords: Record<string, string> | null = null;
export async function loadCharWords(): Promise<Record<string, string>> {
  return (charWords ??= ((await import("./data/char-words.json")).default as { words: Record<string, string> }).words);
}

/** the screen: the list of what can be dictated, the options, the start button */
export async function renderDictation(id: string): Promise<void> {
  const my = X.epoch();
  X.showLoading();
  let kid: M.KidData, doc: D.DictDoc, words: Record<string, string>;
  try {
    await X.loadShared();
    [kid, doc, words] = await Promise.all([
      api.readJson<M.KidData>(`kids/${id}.json`).then((x) => x ?? M.EMPTY_KID),
      api.readJson<D.DictDoc>(dictPath(id)).then((x) => x ?? D.EMPTY_DICT),
      loadCharWords(), loadPinyin(),
    ]);
  } catch (e) {
    return my === X.epoch() ? X.showError(e, () => void renderDictation(id)) : undefined;
  }
  if (my !== X.epoch()) return;
  const k = X.kids().kids.find((x) => x.id === id);
  if (!k) return void (location.hash = "#/chinese");
  const start = weekOr(M.sundayOf(M.todayLocal()));
  const idioms = X.idioms();
  const src: D.Source = {
    chars: M.weekOf(kid, start)?.chars ?? [], idioms: idioms.weeks.find((w) => w.start === start)?.items ?? [],
    lastChars: M.weekOf(kid, D.lastWeekOf(start))?.chars ?? [], lastIdioms: idioms.weeks.find((w) => w.start === D.lastWeekOf(start))?.items ?? [],
  };
  const st = loadSettings();
  const opt = { idioms: st.idioms, last: st.last };
  const summary = h("p", { class: "dw-count", id: "dw-count" });
  const list = h("div", { class: "dw-chips", id: "dw-list" });
  const go = h("button", { class: "primary wide", id: "dw-start" }, "开始听写") as HTMLButtonElement;
  const refresh = () => {
    const items = D.buildItems(src, opt);
    list.replaceChildren(...items.map((it) => h("span", { class: "dw-chip user" + (it.kind === "idiom" ? " idiom" : ""), "data-item": it.text }, it.text)));
    summary.textContent = items.length ? `共 ${items.length} 项` : "暂无可听写的内容。请先录入本周汉字。";
    go.disabled = items.length === 0;
    for (const [el, f] of labels) el.textContent = f();
  };
  const labels: [HTMLElement, () => string][] = [];
  const toggle = (label: () => string, idAttr: string, on: boolean, change: (v: boolean) => void) => {
    const box = h("input", { type: "checkbox", id: idAttr, checked: on, onchange: () => { change(box.checked); refresh(); } }) as HTMLInputElement;
    const text = h("span", {}, label());
    labels.push([text, label]);
    return h("label", { class: "dw-switch" }, box, text);
  };
  const pauses = h("div", { class: "seg dw-pause", id: "dw-pause" },
    ...D.PAUSES.map((p) => h("button", { class: p === st.pause ? "on" : "", "data-pause": String(p), onclick: (e: Event) => {
      saveSettings({ pause: p });
      pauses.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget));
    } }, `${p} 秒`)));
  go.addEventListener("click", () => {
    unlockSpeech();   // (iOS: the voice must be unlocked inside this tap; every later word is spoken from a timer)
    const items = D.buildItems(src, opt);
    if (items.length) void startDictation(k, items, start, words, false);
  });
  const recent = doc.sessions.slice(0, 5);
  X.show(frame(k, "听写", `#/kid/${id}`, h("main", { class: "scroll" }, h("div", { class: "narrow dw-narrow" },
    h("h2", { class: "sec" }, `汉字（${src.chars.length}）`),
    list,
    summary,
    toggle(() => `同时听写本周成语（${src.idioms.length}）`, "dw-opt-idioms", st.idioms, (v) => { opt.idioms = v; saveSettings({ idioms: v }); }),
    toggle(() => `加上上一周的内容（${src.lastChars.length + (opt.idioms ? src.lastIdioms.length : 0)}）`, "dw-opt-last", st.last, (v) => { opt.last = v; saveSettings({ last: v }); }),
    toggle(() => "在屏幕上书写", "dw-opt-screen", st.screen, (v) => { saveSettings({ screen: v }); }),
    h("p", { class: "dw-label" }, "每项之间的停顿"),
    pauses,
    h("div", { class: "lobby-go" }, go),
    recent.length ? h("div", { class: "dw-recent", id: "dw-recent" }, h("h2", { class: "sec" }, "最近的听写"),
      ...recent.map((s) => h("div", { class: "dw-rec", "data-id": s.id },
        h("span", { class: "muted" }, s.date), h("span", {}, s.wrong.length ? `错 ${s.wrong.length} 项` : "全部正确"),
        h("span", { class: "user dw-rec-wrong" }, s.wrong.join(" "))))) : null))));
  refresh();
}

/** the dictation itself: reads the items one after the other */
export async function startDictation(k: M.Kid, items: D.Item[], week: string, words: Record<string, string>, again: boolean): Promise<void> {
  await loadPinyin();
  const st = loadSettings();
  const pauseMs = st.pause * 1000;
  let idx = 0, paused = false, phase: "speaking" | "waiting" = "speaking";
  let remaining = pauseMs, deadline = 0, tick = 0, cancelSay: (() => void) | null = null, token = 0, finished = false;

  const progress = h("div", { class: "dw-progress", id: "dw-progress" });
  const status = h("div", { class: "dw-status", id: "dw-status" });
  const secs = h("span", { class: "dw-secs", id: "dw-secs" });
  const rg = ring();
  const hear = h("span", { class: "dw-hear" }, icon("speaker"));
  const dial = h("div", { class: "dw-dial", id: "dw-dial" }, rg.el, hear, secs);
  const mk = (id: string, label: string, ic: SVGSVGElement, fn: () => void) => h("button", { class: "dw-ctl", id, title: label, "aria-label": label, onclick: fn }, ic);
  const pauseBtn = mk("dw-pause-btn", "暂停", icon("pause"), () => togglePause());
  const controls = h("div", { class: "dw-controls" },
    mk("dw-prev", "上一项", icon("prev"), () => go(idx - 1)), pauseBtn, mk("dw-next", "下一项", icon("next"), () => go(idx + 1)), mk("dw-repeat", "再读一遍", icon("repeat"), () => speak()));
  let pad: Pad | null = null;
  const padBox = h("div", { class: "dw-padbox" });
  if (st.screen) { pad = createPad(); padBox.append(pad.el); }
  const quit = h("button", { class: "gquit dw-quit", id: "dw-quit", title: "结束听写", "aria-label": "结束听写", onclick: () => { stop(); void renderDictation(k.id); } }, "×");
  const body = h("main", { class: "scroll dw-run" }, h("div", { class: "narrow dw-narrow" },
    h("div", { class: "dw-runtop" }, quit, progress), status, dial, controls, padBox));
  X.show(frame(k, "听写", `#/kid/${k.id}`, body, "dw-playing"));
  document.querySelector(".dw-page")?.setAttribute("data-again", again ? "1" : "0");

  const stop = () => { finished = true; window.clearInterval(tick); cancelSay?.(); stopSpeech(); };
  const show = () => {
    progress.textContent = `${idx + 1} / ${items.length}`;
    dial.dataset.idx = String(idx); dial.dataset.item = items[idx].text;
    pad?.clear();
  };
  const paint = () => {
    const left = phase === "waiting" ? (paused ? remaining : Math.max(0, deadline - Date.now())) : pauseMs;
    rg.set(phase === "waiting" ? left / pauseMs : 1);
    secs.textContent = phase === "waiting" ? String(Math.ceil(left / 1000)) : "";
    dial.dataset.state = paused ? "paused" : phase;
    status.textContent = paused ? "已暂停" : phase === "speaking" ? "正在朗读…" : "请书写";
    dial.dataset.left = String(Math.round(left));
  };
  /** reads the current item; the pause starts when the voice has finished */
  const speak = () => {
    window.clearInterval(tick); cancelSay?.();
    const my = ++token;
    phase = "speaking"; paused = false; remaining = pauseMs;
    pauseBtn.replaceChildren(icon("pause")); pauseBtn.title = "暂停"; pauseBtn.setAttribute("aria-label", "暂停");
    paint();
    cancelSay = say(D.readingOf(items[idx], words), "zh-CN", () => { if (my === token && !paused && !finished) wait(pauseMs); });
  };
  const wait = (ms: number) => {
    phase = "waiting"; remaining = ms; deadline = Date.now() + ms;
    window.clearInterval(tick);
    tick = window.setInterval(() => {
      paint();
      if (Date.now() >= deadline) { window.clearInterval(tick); go(idx + 1); }
    }, 100);
    paint();
  };
  const go = (to: number) => {
    if (finished) return;
    if (to >= items.length) { stop(); void renderCheck(k, items, week, words, again); return; }
    idx = Math.max(0, to);
    show(); speak();
  };
  const togglePause = () => {
    if (finished) return;
    if (!paused) {
      remaining = phase === "waiting" ? Math.max(0, deadline - Date.now()) : pauseMs;
      paused = true; window.clearInterval(tick); token++; cancelSay?.(); stopSpeech();
      pauseBtn.replaceChildren(icon("play")); pauseBtn.title = "继续"; pauseBtn.setAttribute("aria-label", "继续");
      paint();
    } else {
      paused = false;
      pauseBtn.replaceChildren(icon("pause")); pauseBtn.title = "暂停"; pauseBtn.setAttribute("aria-label", "暂停");
      if (phase === "waiting") wait(remaining || pauseMs); else speak();
    }
  };
  window.addEventListener("hashchange", () => { if (!finished) stop(); }, { once: true });
  show(); speak();
}

// ---------- the check ----------
/** one answer at a time, big, with its pinyin and word; the grown-up taps tick or cross */
async function renderCheck(k: M.Kid, items: D.Item[], week: string, words: Record<string, string>, again: boolean): Promise<void> {
  await loadPinyin();
  let idx = 0;
  const marks: boolean[] = [];
  const progress = h("div", { class: "dw-progress", id: "dw-progress" });
  const card = h("div", { class: "dw-card", id: "dw-card" });
  const no = h("button", { class: "gbtn no", id: "dw-wrong", title: "写错了", "aria-label": "写错了" }, icon("cross"));
  const yes = h("button", { class: "gbtn yes", id: "dw-right", title: "写对了", "aria-label": "写对了" }, icon("tick"));
  const undo = h("button", { class: "link", id: "dw-undo", onclick: () => { if (idx > 0) { idx--; marks.length = idx; paint(); } } }, "返回上一项");
  const paint = () => {
    const it = items[idx];
    progress.textContent = `${idx + 1} / ${items.length}`;
    card.dataset.item = it.text;
    if (it.kind === "idiom") {
      card.replaceChildren(h("div", { class: "dw-idiom-cells user" }, ...[...it.text].map((c) => h("div", { class: "dw-cell" }, h("small", {}, pinyinOf(c)), h("span", { class: "ch" }, c)))));
    } else {
      const w = D.wordOf(it, words);
      card.replaceChildren(h("div", { class: "dw-py", id: "dw-py" }, pinyinOf(it.text)),
        h("div", { class: "dw-bigbox" }, h("span", { class: "ch user", id: "dw-char" }, it.text)),
        ...(w ? [h("div", { class: "dw-word user", id: "dw-word" }, w)] : []));
    }
    undo.hidden = idx === 0;
  };
  const answer = (right: boolean) => {
    marks[idx] = right;
    sfx(right ? "good" : "bad");
    if (idx + 1 >= items.length) return void finish();
    idx++; paint();
  };
  no.addEventListener("click", () => answer(false));
  yes.addEventListener("click", () => answer(true));
  const finish = async () => {
    const wrong = items.filter((_, i) => !marks[i]).map((x) => x.text);
    const today = M.todayLocal();
    const session: D.Session = { id: D.newSessionId(today), date: today, week, kind: "zh", items: items.map((x) => x.text), wrong, ...(again ? { again: true } : {}) };
    X.show(frame(k, "听写", `#/kid/${k.id}`, h("main", { class: "scroll" }, h("div", { class: "center-msg" }, h("div", { class: "spin" })))));
    const done = toast("正在保存…", 0, true);
    try {
      await api.update<D.DictDoc>(dictPath(k.id), D.EMPTY_DICT, (cur) => D.addSession(cur, session), `dictation ${k.id}`);
      const chars = wrong.filter((t) => [...t].length === 1);
      if (chars.length) await api.update<G.Review>(reviewPath(k.id), G.EMPTY_REVIEW, (cur) => D.feedReview(cur, chars, today), `dictation review ${k.id}`);
      done();
      toast(wrong.length ? `已保存听写结果：错 ${wrong.length} 项` : "已保存听写结果：全部正确");
    } catch (e) {
      done();
      toast(errText(e), 6000);
    }
    renderSummary(k, items, wrong, week, words);
  };
  X.show(frame(k, "核对", `#/kid/${k.id}`, h("main", { class: "scroll dw-check" }, h("div", { class: "narrow dw-narrow" },
    progress, h("p", { class: "ghint" }, "请对照孩子写的字，点击对勾或叉。"), card, h("div", { class: "gbar dw-bar" }, no, yes), h("div", { class: "center" }, undo))), "dw-checking"));
  paint();
}

function renderSummary(k: M.Kid, items: D.Item[], wrong: string[], week: string, words: Record<string, string>): void {
  const stars = items.length ? Math.round(((items.length - wrong.length) / items.length) * 3) : 0;
  X.show(frame(k, "听写", `#/kid/${k.id}`, h("main", { class: "scroll" }, h("div", { class: "narrow dw-narrow dw-summary", id: "dw-summary" },
    h("h2", { class: "dw-result" }, wrong.length ? `答对 ${items.length - wrong.length} / ${items.length}` : "全部正确。"),
    h("div", { class: "gstars" }, ...[0, 1, 2].map((i) => icon("star", "gstar" + (i < stars ? " on" : "")))),
    wrong.length ? h("p", { class: "muted" }, "需要再练的内容：") : null,
    wrong.length ? h("div", { class: "gmissed", id: "dw-wronglist" }, ...wrong.map((w) => h("span", { class: "gchip user", "data-w": w }, w))) : null,
    h("div", { class: "lobby-go" },
      wrong.length ? h("button", { class: "primary wide", id: "dw-again", onclick: () => void startDictation(k, D.itemsOf(wrong), week, words, true) }, "错字再练") : null,
      h("button", { class: wrong.length ? "link" : "primary wide", id: "dw-done", onclick: () => (location.hash = `#/kid/${k.id}`) }, "完成"))))));
}
