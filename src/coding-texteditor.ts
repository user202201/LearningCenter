/**
 * 编程, text coding: the CODE EDITOR for touch devices and keyboards. A `textarea` (the real input: caret, selection, the on-screen keyboard, paste) sits on top of a
 * highlight layer (a `pre` with the same font and padding, behind it); a gutter shows the line numbers. No outside library.
 * - smart typing: auto-indent after a colon (and one level back after return / break / continue / pass), Backspace in the indentation removes 4 spaces,
 *   Tab / Shift+Tab (a toolbar button too: iPad on-screen keyboards have no Tab), brackets and quotes close themselves and are typed over,
 * - a symbol toolbar (: ( ) [ ] { } " ' = + - * / % # _ , . indent dedent undo redo) that does not take the focus (the keyboard stays open),
 * - highlighting (keywords, built-ins, strings, numbers, comments, names after def), the matching bracket, the error line (wavy), the running line (stepper),
 * - own undo / redo (programmatic edits would break the native one), Ctrl / Cmd + Enter = run, Esc then Tab leaves the editor,
 * - font size 16 / 18 / 22 px (never below 16: iOS zooms into smaller inputs), kept on this device.
 */
import { h } from "./ui";
import { keywordList } from "./coding-textlang";

const KW = new Set(keywordList);
const BUILTINS = new Set(["print", "input", "len", "range", "int", "float", "str", "bool", "list", "dict", "set", "tuple", "abs", "min", "max", "sum", "sorted", "reversed", "enumerate", "zip", "round", "pow", "divmod", "any", "all", "ord", "chr", "map", "filter", "isinstance", "type", "repr", "format", "bin", "hex", "turtle", "random", "math"]);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export interface HlOpts { marks?: Set<number>; errLine?: number | null; curLine?: number | null }
/** the source as HTML, one `span.tx-line` per line (a block), tokens coloured by class; `marks` = offsets of brackets to emphasise */
export function highlightHtml(src: string, o: HlOpts = {}): string {
  const out: string[] = [];
  let off = 0, inTriple: string | null = null;
  src.replace(/\r\n?/g, "\n").split("\n").forEach((line, li) => {
    let html = "", i = 0;
    const tok = (cls: string, text: string, at: number) => {
      const t = esc(text);
      html += cls ? `<span class="${cls}">${t}</span>` : t;
      void at;
    };
    if (inTriple) {
      const end = line.indexOf(inTriple);
      if (end < 0) { tok("tx-str", line, off); i = line.length; }
      else { tok("tx-str", line.slice(0, end + 3), off); i = end + 3; inTriple = null; }
    }
    let prevWord = "";
    while (i < line.length) {
      const c = line[i];
      if (c === "#") { tok("tx-com", line.slice(i), off + i); i = line.length; break; }
      const sm = /^([fFrR]{0,2})("""|'''|"|')/.exec(line.slice(i, i + 5));
      if (sm && (sm[1] === "" || /^(f|r|fr|rf)$/i.test(sm[1]))) {
        const q = sm[2]; let j = i + sm[0].length;
        if (q.length === 3) { const end = line.indexOf(q, j); if (end < 0) { inTriple = q; tok("tx-str", line.slice(i), off + i); i = line.length; break; } j = end + 3; }
        else { while (j < line.length && line[j] !== q) { if (line[j] === "\\") j++; j++; } j = Math.min(line.length, j + 1); }
        tok("tx-str", line.slice(i, j), off + i); i = j; prevWord = ""; continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(line[i + 1] ?? ""))) {
        const m = /^(0[xXbBoO][0-9a-fA-F_]+|[0-9][0-9_]*\.?[0-9_]*(?:[eE][+-]?[0-9]+)?|\.[0-9]+(?:[eE][+-]?[0-9]+)?)/.exec(line.slice(i))!;
        tok("tx-num", m[0], off + i); i += m[0].length; prevWord = ""; continue;
      }
      if (/[\p{L}_]/u.test(c)) {
        const m = /^[\p{L}\p{N}_]+/u.exec(line.slice(i))!;
        const w = m[0];
        const cls = KW.has(w) ? "tx-kw" : prevWord === "def" ? "tx-def" : BUILTINS.has(w) ? "tx-bi" : w === "___" ? "tx-blank" : "";
        tok(cls, w, off + i); prevWord = w; i += w.length; continue;
      }
      if (c === " " || c === "\t") { let j = i; while (line[j] === " " || line[j] === "\t") j++; tok("", line.slice(i, j), off + i); i = j; continue; }
      if (o.marks?.has(off + i)) tok("tx-br", c, off + i); else tok("", c, off + i);
      prevWord = ""; i++;
    }
    const cls = "tx-line" + (o.errLine === li + 1 ? " tx-err" : "") + (o.curLine === li + 1 ? " tx-cur" : "");
    out.push(`<span class="${cls}">${html || "&#8203;"}</span>`);
    off += line.length + 1;
  });
  return out.join("");
}
/** the matching bracket of the one next to the caret: [offset of the bracket, offset of its partner] or null (strings and comments are skipped) */
export function matchBracket(src: string, caret: number): [number, number] | null {
  const mask = new Array<boolean>(src.length).fill(false);   // true = inside a string or a comment (not a bracket)
  let q: string | null = null, com = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (com) { if (c === "\n") com = false; else mask[i] = true; continue; }
    if (q) { mask[i] = true; if (c === "\\") { mask[i + 1] = true; i++; } else if (src.startsWith(q, i)) { for (let k = 0; k < q.length; k++) mask[i + k] = true; i += q.length - 1; q = null; } continue; }
    if (c === "#") { com = true; mask[i] = true; continue; }
    if (c === '"' || c === "'") { q = src.startsWith(c.repeat(3), i) ? c.repeat(3) : c; for (let k = 0; k < q.length; k++) mask[i + k] = true; i += q.length - 1; }
  }
  const open = "([{", close = ")]}";
  for (const pos of [caret - 1, caret]) {
    const c = src[pos];
    if (c === undefined || mask[pos]) continue;
    const oi = open.indexOf(c), ci = close.indexOf(c);
    if (oi >= 0) {
      let d = 0;
      for (let i = pos; i < src.length; i++) { if (mask[i]) continue; if (src[i] === open[oi]) d++; else if (src[i] === close[oi] && --d === 0) return [pos, i]; }
    } else if (ci >= 0) {
      let d = 0;
      for (let i = pos; i >= 0; i--) { if (mask[i]) continue; if (src[i] === close[ci]) d++; else if (src[i] === open[ci] && --d === 0) return [pos, i]; }
    }
  }
  return null;
}

export const FONT_SIZES = [16, 18, 22] as const;
const FONT_KEY = "learn.codingtext.font";
const loadFont = (): number => { try { const v = Number(localStorage.getItem(FONT_KEY)); return (FONT_SIZES as readonly number[]).includes(v) ? v : 16; } catch { return 16; } };
const saveFont = (v: number) => { try { localStorage.setItem(FONT_KEY, String(v)); } catch { /* private window */ } };

export interface CodeEditor {
  el: HTMLElement; ta: HTMLTextAreaElement;
  value(): string; setValue(v: string, keepHistory?: boolean): void;
  setError(line: number | null): void; setCurrent(line: number | null): void;
  setReadOnly(on: boolean): void;
  undo(): void; redo(): void; focus(): void;
  setFont(px: number): void; font(): number;
  onChange(f: (v: string) => void): void;
}
export interface EditorOpts { value?: string; onRun?: () => void; onChange?: (v: string) => void; label?: string; toolbar?: boolean; id?: string }

const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
const TOOLS: [string, string][] = [[":", ":"], ["(", "("], [")", ")"], ["[", "["], ["]", "]"], ["{", "{"], ["}", "}"], ['"', '"'], ["'", "'"], ["=", "="], ["+", "+"], ["-", "-"], ["*", "*"], ["/", "/"], ["%", "%"], ["#", "#"], ["_", "_"], [",", ","], [".", "."]];

export function createCodeEditor(o: EditorOpts = {}): CodeEditor {
  const ta = h("textarea", { class: "tx-ta", "aria-label": o.label ?? "代码", id: o.id ?? "tx-ta" }) as HTMLTextAreaElement;
  ta.spellcheck = false; ta.rows = 8; ta.wrap = "off";
  ta.setAttribute("autocapitalize", "off"); ta.setAttribute("autocomplete", "off"); ta.setAttribute("autocorrect", "off");
  const hl = h("pre", { class: "tx-hl", "aria-hidden": "true" });
  const gutter = h("div", { class: "tx-gutter", "aria-hidden": "true" });
  const wrap = h("div", { class: "tx-wrap" }, hl, ta);
  const body = h("div", { class: "tx-ed-body" }, gutter, wrap);
  let font = loadFont();
  const listeners: ((v: string) => void)[] = o.onChange ? [o.onChange] : [];
  let errLine: number | null = null, curLine: number | null = null, marks: Set<number> | undefined;
  type Snap = { v: string; a: number; b: number };
  let past: Snap[] = [], future: Snap[] = [], lastPush = 0, lastKind = "";

  const render = () => {
    hl.innerHTML = highlightHtml(ta.value, { marks, errLine, curLine });
    const n = ta.value.split("\n").length;
    if (gutter.childElementCount !== n) gutter.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join("");
    gutter.querySelectorAll("span").forEach((s, i) => { s.classList.toggle("tx-err", errLine === i + 1); s.classList.toggle("tx-cur", curLine === i + 1); });
    sync();
  };
  const sync = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; };
  const changed = () => { render(); for (const f of listeners) f(ta.value); };
  const snap = (): Snap => ({ v: ta.value, a: ta.selectionStart, b: ta.selectionEnd });
  const push = (kind: string) => {
    const now = Date.now();
    if (kind === "type" && lastKind === "type" && now - lastPush < 700 && past.length) { lastPush = now; return; }   // typing in one go = one undo step
    past.push(snap()); if (past.length > 300) past.shift();
    future = []; lastPush = now; lastKind = kind;
  };
  /** replace [a, b) with text; the caret goes to `caret` (default: after the text) */
  const edit = (a: number, b: number, text: string, kind: string, caret?: number, caretEnd?: number) => {
    push(kind);
    ta.setRangeText(text, a, b, "end");
    const c = caret ?? a + text.length;
    ta.setSelectionRange(c, caretEnd ?? c);
    changed(); markBracket();
  };
  const restore = (s: Snap) => { ta.value = s.v; ta.setSelectionRange(s.a, s.b); lastKind = ""; changed(); markBracket(); };
  const undo = () => { const s = past.pop(); if (!s) return; future.push(snap()); restore(s); };
  const redo = () => { const s = future.pop(); if (!s) return; past.push(snap()); restore(s); };
  const markBracket = () => {
    const m = ta.selectionStart === ta.selectionEnd ? matchBracket(ta.value, ta.selectionStart) : null;
    const next = m ? new Set(m) : undefined;
    const same = (!marks && !next) || (!!marks && !!next && marks.size === next.size && [...marks].every((x) => next.has(x)));
    if (!same) { marks = next; render(); }
  };

  const lineStart = (p: number) => ta.value.lastIndexOf("\n", p - 1) + 1;
  const lineEnd = (p: number) => { const i = ta.value.indexOf("\n", p); return i < 0 ? ta.value.length : i; };
  const indentOf = (s: string) => /^ */.exec(s)![0].length;

  function indentLines(dir: 1 | -1) {
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
    const s0 = lineStart(a), e0 = lineEnd(b === a ? b : Math.max(a, b - (v[b - 1] === "\n" ? 1 : 0)));
    const lines = v.slice(s0, e0).split("\n");
    let da = 0, db = 0;
    const out = lines.map((ln, i) => {
      if (dir > 0) { if (ln === "" && lines.length > 1) return ln; if (i === 0) da = 4; db += 4; return "    " + ln; }
      const k = Math.min(4, indentOf(ln)); if (i === 0) da = -k; db -= k; return ln.slice(k);
    });
    push("indent");
    ta.setRangeText(out.join("\n"), s0, e0, "end");
    ta.setSelectionRange(Math.max(s0, a + da), Math.max(s0, b + db));
    changed(); markBracket();
  }
  function tab(shift: boolean) {
    const a = ta.selectionStart, b = ta.selectionEnd;
    if (shift || (a !== b && ta.value.slice(a, b).includes("\n"))) return indentLines(shift ? -1 : 1);
    const col = a - lineStart(a);
    edit(a, b, " ".repeat(4 - (col % 4)), "tab");
  }
  function enter() {
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
    const ls = lineStart(a), before = v.slice(ls, a);
    let ind = indentOf(before);
    const code = before.replace(/#.*$/, "").trimEnd();
    if (code.endsWith(":")) ind += 4;
    else if (/^\s*(return|break|continue|pass)\b/.test(before) && ind >= 4) ind -= 4;
    // between a pair of brackets: the closing one goes on its own line
    const nextCh = v[b];
    if (v[a - 1] && "([{".includes(v[a - 1]) && nextCh && PAIRS[v[a - 1]] === nextCh) {
      const text = "\n" + " ".repeat(indentOf(before) + 4) + "\n" + " ".repeat(indentOf(before));
      return edit(a, b, text, "enter", a + 1 + indentOf(before) + 4);
    }
    edit(a, b, "\n" + " ".repeat(ind), "enter");
  }
  /** one typed character: type over a closer, close a pair; returns true when handled */
  function typed(ch: string): boolean {
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
    if (a !== b) {   // a selection is wrapped by a pair
      if (PAIRS[ch] && ch !== "'" ) { edit(a, b, ch + v.slice(a, b) + PAIRS[ch], "type", a + 1, b + 1); return true; }
      return false;
    }
    const next = v[a] ?? "", prev = v[a - 1] ?? "";
    if ((ch === ")" || ch === "]" || ch === "}" || ch === '"' || ch === "'") && next === ch) { ta.setSelectionRange(a + 1, a + 1); markBracket(); return true; }
    if (PAIRS[ch]) {
      const isQuote = ch === '"' || ch === "'";
      if (isQuote && /[\p{L}\p{N}_]/u.test(prev)) return false;   // don't -> an apostrophe, not a quote
      if (isQuote && (prev === ch)) return false;                 // """ triple quotes
      if (!(next === "" || /\s/.test(next) || ")]},:".includes(next))) return false;
      // inside a string: do not close
      const lsx = lineStart(a), seg = v.slice(lsx, a);
      const qd = (seg.match(/"/g) ?? []).length, qs = (seg.match(/'/g) ?? []).length;
      if (!isQuote && ((qd % 2) || (qs % 2))) return false;
      if (ch === '"' && (qd % 2)) return false;
      if (ch === "'" && (qs % 2)) return false;
      edit(a, b, ch + PAIRS[ch], "type", a + 1);
      return true;
    }
    return false;
  }

  ta.addEventListener("beforeinput", (e) => {
    const ev = e as InputEvent;
    if (ev.inputType === "insertLineBreak" || ev.inputType === "insertParagraph") { ev.preventDefault(); enter(); return; }
    if (ev.inputType === "historyUndo") { ev.preventDefault(); undo(); return; }
    if (ev.inputType === "historyRedo") { ev.preventDefault(); redo(); return; }
    if (ev.inputType === "insertText" && ev.data && ev.data.length === 1 && !ev.isComposing) { if (typed(ev.data)) ev.preventDefault(); }
  });
  ta.addEventListener("input", (e) => {
    const ev = e as InputEvent;
    // anything the browser typed itself (letters, paste, delete): remember the state before for undo
    if (ev.inputType === "historyUndo" || ev.inputType === "historyRedo") return;
    const now = Date.now();
    if (!(lastKind === "type" && now - lastPush < 700 && past.length)) { /* the snapshot before this change is unknown: keep the last known text */ past.push({ v: lastText, a: lastSel[0], b: lastSel[1] }); if (past.length > 300) past.shift(); }
    future = []; lastPush = now; lastKind = "type";
    changed(); markBracket();
  });
  let lastText = ta.value, lastSel: [number, number] = [0, 0];
  const remember = () => { lastText = ta.value; lastSel = [ta.selectionStart, ta.selectionEnd]; };
  ta.addEventListener("keyup", () => { remember(); markBracket(); });
  ta.addEventListener("pointerup", () => { remember(); markBracket(); });
  ta.addEventListener("select", markBracket);
  ta.addEventListener("input", remember);
  ta.addEventListener("keydown", (e) => {
    remember();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Tab" && !mod && !e.altKey) { if (escaped) { escaped = false; return; } e.preventDefault(); tab(e.shiftKey); return; }
    if (e.key === "Escape") { escaped = true; return; }
    escaped = false;
    if (e.key === "Enter" && mod) { e.preventDefault(); o.onRun?.(); return; }
    if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
    if (e.key === "Backspace" && !mod && ta.selectionStart === ta.selectionEnd) {
      const a = ta.selectionStart, v = ta.value, ls = lineStart(a), before = v.slice(ls, a);
      if (before.length > 0 && /^ +$/.test(before)) { e.preventDefault(); const k = before.length % 4 || 4; edit(a - k, a, "", "back"); return; }
      if (v[a - 1] && PAIRS[v[a - 1]] && v[a] === PAIRS[v[a - 1]]) { e.preventDefault(); edit(a - 1, a + 1, "", "back"); return; }
    }
  });
  let escaped = false;
  ta.addEventListener("scroll", sync);
  ta.addEventListener("blur", () => { escaped = false; });

  // ----- the toolbar -----
  const keep = (e: Event) => e.preventDefault();   // a tap on a toolbar button must not take the focus away from the text (the keyboard stays open)
  const tbtn = (cls: string, label: string, aria: string, act: () => void, id?: string): HTMLElement => {
    const b = h("button", { type: "button", class: "tx-key " + cls, "aria-label": aria, title: aria, ...(id ? { id } : {}) }, label);
    b.setAttribute("tabindex", "-1");
    b.addEventListener("pointerdown", keep);
    b.addEventListener("mousedown", keep);
    b.addEventListener("click", () => { act(); if (document.activeElement !== ta) ta.focus({ preventScroll: true }); });
    return b;
  };
  const insert = (s: string) => { const a = ta.selectionStart, b = ta.selectionEnd; if (s.length === 1 && typed(s)) return; edit(a, b, s, "tool"); };
  const fsRow = h("div", { class: "tx-fs", role: "group", "aria-label": "字号" },
    ...FONT_SIZES.map((px) => h("button", { type: "button", class: "tx-fsb" + (px === font ? " on" : ""), "data-fs": String(px), "aria-label": `字号 ${px}`, onclick: () => setFont(px) }, String(px))));
  const keys = h("div", { class: "tx-keys" },
    tbtn("tx-tab", "⇥", "缩进", () => tab(false), "tx-k-tab"), tbtn("tx-untab", "⇤", "减少缩进", () => tab(true), "tx-k-untab"),
    ...TOOLS.map(([label, ins]) => tbtn("", label, label === "_" ? "下划线" : label === "#" ? "注释 #" : label, () => insert(ins))),
    tbtn("tx-undo", "↶", "撤销", undo, "tx-k-undo"), tbtn("tx-redo", "↷", "重做", redo, "tx-k-redo"));
  const bar = h("div", { class: "tx-bar" }, keys, fsRow);
  const root = h("div", { class: "tx-ed", style: `--tx-fs:${font}px` }, body, ...(o.toolbar === false ? [] : [bar]));

  // the toolbar rides above the on-screen keyboard (iOS keeps the layout viewport and covers its lower part): follow the visual viewport
  const vv = window.visualViewport;
  const place = () => {
    if (!vv || o.toolbar === false) return;
    const covered = window.innerHeight - (vv.offsetTop + vv.height);
    if (document.activeElement === ta && covered > 80) { bar.classList.add("float"); bar.style.bottom = `${Math.round(covered)}px`; root.style.paddingBottom = `${bar.offsetHeight}px`; }
    else { bar.classList.remove("float"); bar.style.bottom = ""; root.style.paddingBottom = ""; }
  };
  vv?.addEventListener("resize", place); vv?.addEventListener("scroll", place);
  ta.addEventListener("focus", place); ta.addEventListener("blur", () => setTimeout(place, 50));

  function setFont(px: number) {
    font = (FONT_SIZES as readonly number[]).includes(px) ? px : 16;
    root.style.setProperty("--tx-fs", `${font}px`); saveFont(font);
    fsRow.querySelectorAll<HTMLElement>(".tx-fsb").forEach((b) => b.classList.toggle("on", b.dataset.fs === String(font)));
    render();
  }
  ta.value = o.value ?? ""; remember(); render();
  return {
    el: root, ta,
    value: () => ta.value,
    setValue(v, keep = false) { ta.value = v; if (!keep) { past = []; future = []; lastKind = ""; } errLine = null; curLine = null; marks = undefined; remember(); changed(); },
    setError(l) { errLine = l; render(); },
    setCurrent(l) { curLine = l; render(); if (l) { const lh = parseFloat(getComputedStyle(ta).lineHeight) || 24; const top = (l - 1) * lh; if (top < ta.scrollTop || top > ta.scrollTop + ta.clientHeight - 2 * lh) { ta.scrollTop = Math.max(0, top - ta.clientHeight / 3); sync(); } } },
    setReadOnly(on) { ta.readOnly = on; root.classList.toggle("ro", on); },
    undo, redo, focus: () => ta.focus(), setFont, font: () => font,
    onChange: (f) => { listeners.push(f); },
  };
}
