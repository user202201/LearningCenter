/**
 * The ONE place that talks to `speechSynthesis` (rules 32, 39, 51, 55). Pure browser feature handling, no UI. What iOS / WKWebView / Safari demand:
 *  - the engine is silent until `speak()` was called once INSIDE a user gesture (a tap, a click, a key): `unlockSpeech()` does that with a silent
 *    utterance, `ensureUnlockedOnFirstGesture()` (installed once in main.ts) does it on the first interaction of the page, and the buttons that start
 *    something that speaks later from a timer call `unlockSpeech()` in their own click handler;
 *  - voices load asynchronously (`getVoices()` is empty until `voiceschanged`); an utterance with only `lang` may stay silent, so a voice whose language
 *    matches is chosen (`voiceFor`, a local voice first);
 *  - an utterance that nobody references can be garbage collected before it ends and then stops mid-way: they are kept in `live` until they end;
 *  - after a `cancel()` the engine may stay paused / stuck: `resume()` before every `speak()`;
 *  - `onend` may never come: callers keep their own time-outs (nothing waits for a voice) and `handle.started` tells whether any sound began.
 * Everything is offline (the device's own voices). Without the API every function is a quiet no-op.
 */

export interface SpeakOpts { rate?: number; pitch?: number; volume?: number; onstart?: () => void; onend?: () => void }
export interface SpeakHandle {
  /** the engine reported that the speech began (so something is audible) */
  readonly started: boolean;
  /** the speech ended (or failed, or was replaced by another one) */
  readonly ended: boolean;
  /** cancels this speech; its `onend` is NOT called */
  stop(): void;
}

const synth = (): SpeechSynthesis | null => {
  try { return typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined" ? window.speechSynthesis : null; } catch { return null; }
};
/** does this browser have a speech engine at all? */
export const speechSupported = (): boolean => !!synth();

// ---------- voices ----------
let voiceListeners = false;
const voiceWaiters: (() => void)[] = [];
function listVoices(): SpeechSynthesisVoice[] {
  try { return synth()?.getVoices?.() ?? []; } catch { return []; }
}
function watchVoices() {
  const s = synth();
  if (!s || voiceListeners) return;
  voiceListeners = true;
  try {
    s.addEventListener?.("voiceschanged", () => { if (listVoices().length) voiceWaiters.splice(0).forEach((f) => f()); });
  } catch { /* an engine without events: the list is polled by whenVoices */ }
  listVoices();   // (asks the engine to start loading them)
}
/** resolves when the voice list is not empty, at the latest after `ms` */
export function whenVoices(ms = 1500): Promise<void> {
  const s = synth();
  if (!s) return Promise.resolve();
  watchVoices();
  if (listVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false, poll = 0;
    const fin = () => { if (done) return; done = true; window.clearTimeout(t); window.clearInterval(poll); resolve(); };
    const t = window.setTimeout(fin, ms);
    poll = window.setInterval(() => { if (listVoices().length) fin(); }, 120);   // (some engines never send "voiceschanged")
    voiceWaiters.push(fin);
  });
}
const norm = (l: string) => l.toLowerCase().replace(/_/g, "-");
/** the best voice for a language tag ("en-US", "fr-FR", "zh-CN"): the same tag first, then the same language; a local voice before a network one */
export function voiceFor(lang: string): SpeechSynthesisVoice | null {
  const want = norm(lang), prim = want.split("-")[0];
  const vs = listVoices();
  let best: SpeechSynthesisVoice | null = null, bestScore = 0;
  for (const v of vs) {
    const l = norm(v.lang || "");
    const score = l === want ? 4 : l.split("-")[0] === prim ? 2 : 0;
    if (!score) continue;
    const total = score * 10 + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
    if (total > bestScore) { best = v; bestScore = total; }
  }
  return best;
}
/** can this device say `lang`? Without a voice list yet it says yes (unknown: trying costs nothing) */
export function canSpeakNow(lang: string): boolean {
  const s = synth();
  if (!s) return false;
  watchVoices();
  const vs = listVoices();
  return vs.length === 0 ? true : !!voiceFor(lang);
}
/** like `canSpeakNow`, but waits for the voices (at most ~1.5 s); an engine that never lists any voice counts as "unknown = yes" */
export async function hasVoice(lang: string): Promise<boolean> {
  if (!synth()) return false;
  await whenVoices(1500);
  return canSpeakNow(lang);
}

// ---------- the engine ----------
let voicesWaited = false;
const live: SpeechSynthesisUtterance[] = [];   // (kept referenced until they end)
const keep = (u: SpeechSynthesisUtterance) => {
  live.push(u);
  window.setTimeout(() => drop(u), 60000);   // (an `end` that never comes must not keep it for ever)
};
const drop = (u: SpeechSynthesisUtterance) => { const i = live.indexOf(u); if (i >= 0) live.splice(i, 1); };
let current: { finish(silent: boolean): void } | null = null;

/** unlocks the engine: call it inside a tap / click / key handler (a silent utterance, then `resume`) */
export function unlockSpeech(): void {
  const s = synth();
  if (!s) return;
  watchVoices();
  try {
    if (s.paused) s.resume();
    if (s.speaking || s.pending) return;   // (it is already working: nothing to unlock, and a queued silent word must not delay a real one)
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; u.rate = 1;
    const v = voiceFor("en-US") ?? listVoices()[0];
    if (v) u.voice = v;
    keep(u);
    u.onend = u.onerror = () => drop(u);
    s.speak(u);
    s.resume();
  } catch { /* no speech here */ }
}

/** says `text` in `lang`. Without an engine nothing happens (the handle is `ended`, no callback). `onend` is called when the speech ends, fails or is replaced by the next one */
export function speakText(text: string, lang: string, o: SpeakOpts = {}): SpeakHandle {
  const s = synth();
  let utter: SpeechSynthesisUtterance | null = null;
  const h = {
    started: false, ended: false, stopped: false,
    stop() {
      if (h.stopped) return;
      h.stopped = true;
      if (utter && !h.ended && s) { try { s.cancel(); } catch { /* nothing to cancel */ } }
      finish(true);
    },
  };
  const me = { finish: (silent: boolean) => finish(silent) };
  function finish(silent: boolean) {
    if (h.ended) return;
    h.ended = true;
    if (current === me) current = null;
    if (utter) drop(utter);
    if (!silent && !h.stopped) { try { o.onend?.(); } catch { /* the caller's problem */ } }
  }
  if (!s || !text.trim()) { h.ended = true; return h; }
  const go = () => {
    if (h.stopped || h.ended) return;
    try {
      const prev = current;
      current = me;
      if (s.speaking || s.pending || s.paused) s.cancel();
      prev?.finish(false);
      s.resume?.();   // (Safari can leave the engine paused after a cancel)
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = o.rate ?? 0.85;
      if (o.pitch !== undefined) u.pitch = o.pitch;
      if (o.volume !== undefined) u.volume = o.volume;
      const v = voiceFor(lang);
      if (v) { try { u.voice = v; } catch { /* not a real voice object */ } }
      u.onstart = () => { if (!h.started) { h.started = true; try { o.onstart?.(); } catch { /* the caller's problem */ } } };
      u.onend = () => { h.started = true; finish(false); };
      u.onerror = () => finish(false);
      utter = u;
      keep(u);
      s.speak(u);
    } catch { finish(false); }
  };
  // (the voice list is empty right after the page opened: wait for it a little; with the list there the call stays synchronous, inside the gesture)
  watchVoices();
  if (listVoices().length || voicesWaited || typeof s.getVoices !== "function") go();
  else void whenVoices(1500).then(() => { voicesWaited = true; go(); });   // (only the first call can have to wait: an engine that lists no voice at all is not waited for again)
  return h;
}

/** stops whatever is being said (its `onend` is not called) */
export function stopSpeech(): void {
  const s = synth();
  current = null;
  live.length = 0;
  if (!s) return;
  try { s.cancel(); } catch { /* no speech here */ }
}

// ---------- the first gesture of the page ----------
let installed = false;
/** installed once (main.ts): the first tap / key of the page unlocks the engine, so that every later `speak` from a timer is allowed */
export function ensureUnlockedOnFirstGesture(): void {
  if (installed || typeof document === "undefined" || !speechSupported()) return;
  installed = true;
  watchVoices();
  const evs = ["pointerup", "touchend", "click", "keydown"] as const;   // (what counts as a user activation on iOS: not `pointerdown` of a finger)
  const off = () => evs.forEach((e) => document.removeEventListener(e, on, true));
  const on = (e: Event) => {
    if (e.type === "keydown" && (e as KeyboardEvent).key === "Escape") return;
    unlockSpeech();
    if (e.type !== "pointerup") off();   // (a browser may not count `pointerup` as an activation: the next touchend / click / key tries again, then it is done)
  };
  evs.forEach((e) => document.addEventListener(e, on, true));
}
