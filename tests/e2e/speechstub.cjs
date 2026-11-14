// A pretend `speechSynthesis` for the tests (run it in the page with addInitScript(speechInit, arg)); with `ios: true` it behaves like iOS / WKWebView / Safari:
//  - speak() from a context that is not a user gesture is IGNORED until speak() was called once inside a tap / click / key handler (a "gesture" = the synchronous
//    handlers of pointerup / touchend / click / keydown; a timer is not one),
//  - getVoices() is empty until `voiceschanged` (arg.delay ms after the page opened),
//  - an utterance without a chosen voice is silent (no event at all),
//  - cancel() fires `error` on the utterance that was speaking.
// (window.__silent = true / false switches the silent engine on and off while the page runs)
// arg: { voices: [{lang}] | null (null = no speech API at all), ios, delay, silent (an engine that never makes a sound: speak is accepted, no event), dur (ms an utterance lasts) }
// What would have been heard is collected in window.__says as [text, lang, voice.lang]; ignored / silent ones in window.__ignored; silent unlock utterances (volume 0 / blank) are in neither.
function speechInit(arg) {
  window.__says = []; window.__ignored = []; window.__resumes = 0;
  if (!arg || !arg.voices) { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); return; }
  let unlocked = !arg.ios, inGesture = false, loaded = !arg.delay, cur = null, tStart = 0, tEnd = 0;
  const voices = arg.voices.map((v) => ({ localService: true, name: v.lang, voiceURI: v.lang, default: false, ...v }));
  const listeners = [];
  const mark = () => { inGesture = true; setTimeout(() => { inGesture = false; }, 0); };
  ['pointerup', 'touchend', 'click', 'keydown'].forEach((e) => window.addEventListener(e, mark, true));
  if (arg.delay) setTimeout(() => { loaded = true; listeners.forEach((f) => f({ type: 'voiceschanged' })); }, arg.delay);
  const synth = {
    speaking: false, pending: false, paused: false,
    addEventListener(t, f) { if (t === 'voiceschanged') listeners.push(f); }, removeEventListener() { /* nothing */ },
    getVoices: () => (loaded ? voices : []),
    resume() { window.__resumes++; },
    cancel() { clearTimeout(tStart); clearTimeout(tEnd); const u = cur; cur = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    speak(u) {
      if (!unlocked) { if (!inGesture) { window.__ignored.push([u.text, u.lang, 'locked']); return; } unlocked = true; }
      const blank = !String(u.text).trim() || u.volume === 0;
      if (blank) return;
      const silent = window.__silent !== undefined ? window.__silent : arg.silent;
      if (silent || (arg.ios && !u.voice)) { window.__ignored.push([u.text, u.lang, silent ? 'silent' : 'novoice']); return; }
      window.__says.push([u.text, u.lang, u.voice ? u.voice.lang : '']);
      cur = u;
      tStart = setTimeout(() => u.onstart && u.onstart({}), 20);
      tEnd = setTimeout(() => { if (cur === u) cur = null; u.onend && u.onend({}); }, arg.dur || 300);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (x) { this.text = x; this.lang = ''; this.voice = null; this.volume = 1; this.rate = 1; this.pitch = 1; };
}
module.exports = { speechInit };
