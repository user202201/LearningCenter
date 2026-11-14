// Speech on iOS / WKWebView / Safari (src/speech.ts): the pretend engine of `speechstub.cjs` with `ios: true` is SILENT unless (a) speak() was called once inside a tap / click / key
// handler, (b) the utterance has a chosen voice, and (c) the voice list has loaded (empty until `voiceschanged`). With it: the module (first gesture unlock, voice choice, a local voice
// first, no-engine behaviour), the English word duel (PK听单词) speaks the word in EVERY round after pressing Start and nothing else (no extra tap), a silent engine shows the notice and
// a big speaker button that speaks when tapped (both modes, no hang), dictation (听写) and spelling speak after their start button, and the other places that speak. NOT tested: a real iPad.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const { speechInit } = require('./speechstub.cjs');
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const EN = require('../../src/data/english-words.json').words;
const ALLV = [{ lang: 'en-US' }, { lang: 'fr-FR' }, { lang: 'zh-CN' }];
const IOS = { voices: ALLV, ios: true, delay: 700 };
const KIDS = [{ id: 'k1', name: 'Anna', color: '#f2545b' }, { id: 'k2', name: 'Ben', color: '#1c7ed6' }];
const mk = () => {
  const store = new Map();
  store.set('kids.json', JSON.stringify({ kids: KIDS, startWeek: '2026-11-08' }));
  for (const k of KIDS) {
    store.set(`kids/${k.id}.json`, JSON.stringify({ weeks: [{ start: '2026-11-08', chars: [...'山水火土木金'] }] }));
    store.set(`english/${k.id}.json`, JSON.stringify({ weeks: [{ start: '2026-11-08', chars: EN.slice(k.id === 'k1' ? 0 : 8, k.id === 'k1' ? 12 : 22).map((x) => x.w) }] }));
  }
  return store;
};

(async () => {
  // ---------- 1. the module ----------
  {
    const t = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: [{ lang: 'en-US', localService: false, name: 'net' }, { lang: 'en-US', localService: true, name: 'loc' }, { lang: 'en-GB', localService: true, name: 'gb' }, { lang: 'zh_CN', localService: true, name: 'zh' }, { lang: 'fr-FR', localService: true, name: 'fr' }], ios: true, delay: 4000 } });
    const p = t.page;
    await p.evaluate(() => import('/src/speech.ts'));
    const r0 = await p.evaluate(async () => {
      const S = await import('/src/speech.ts');
      const early = S.voiceFor('en-US');
      const before = S.speakText('Hello', 'en-US');   // (a timer / script, no gesture, the voice list is empty: waits for the voices, and the engine is still locked)
      return { early: early && early.name, supported: S.speechSupported(), startedEarly: before.started };
    });
    ok(r0.supported && r0.early === null, 'before the voices have loaded voiceFor() finds none (the list is empty until voiceschanged)');
    await p.waitForTimeout(4200);
    ok((await p.evaluate(() => window.__says.length)) === 0 && (await p.evaluate(() => window.__ignored.length)) >= 1, 'a speak() before the voice list has loaded has no voice to choose: the (iOS-like) engine drops it, nothing is heard');
    const v = await p.evaluate(async () => {
      const S = await import('/src/speech.ts');
      return { en: S.voiceFor('en-US')?.name, gb: S.voiceFor('en-GB')?.name, zh: S.voiceFor('zh-CN')?.name, fr: S.voiceFor('fr-FR')?.name, ja: S.voiceFor('ja-JP'), has: [await S.hasVoice('en-US'), await S.hasVoice('zh-CN'), await S.hasVoice('ja-JP')], now: [S.canSpeakNow('fr-FR'), S.canSpeakNow('ja-JP')] };
    });
    ok(v.en === 'loc' && v.gb === 'gb' && v.zh === 'zh' && v.fr === 'fr' && v.ja === null, `voiceFor: the same tag, a local voice before a network one, "zh_CN" matches zh-CN (${JSON.stringify([v.en, v.gb, v.zh, v.fr])})`);
    ok(v.has.join() === 'true,true,false' && v.now.join() === 'true,false', 'hasVoice / canSpeakNow: true for the languages the device has, false for Japanese');
    // the first tap of the page unlocks the engine: afterwards speaking from a script works
    await p.click('body', { position: { x: 5, y: 5 } });
    await p.evaluate(async () => { const S = await import('/src/speech.ts'); window.__h = S.speakText('Hello', 'en-US', { rate: 0.8 }); });
    await p.waitForTimeout(100);
    const says = await p.evaluate(() => window.__says);
    ok(says.length === 1 && says[0][0] === 'Hello' && says[0][1] === 'en-US' && says[0][2] === 'en-US', 'after the first tap of the page a speak() from a script is heard, with a chosen en-US voice ' + JSON.stringify([says, await p.evaluate(() => window.__ignored)]));
    ok(await p.evaluate(() => window.__h.started), 'the handle reports that the speech started');
    await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__h.ended), 'and that it ended');
    // stop() cancels and does not call onend; a second speech replaces the first (its onend runs)
    const rr = await p.evaluate(async () => {
      const S = await import('/src/speech.ts');
      const log = [];
      const a = S.speakText('one', 'en-US', { onend: () => log.push('a-end') });
      a.stop();
      const b = S.speakText('two', 'en-US', { onend: () => log.push('b-end') });
      const c = S.speakText('three', 'en-US', { onend: () => log.push('c-end') });
      await new Promise((r) => setTimeout(r, 700));
      S.stopSpeech();
      return { log, aEnded: a.ended, c: c.ended, resumes: window.__resumes };
    });
    ok(rr.aEnded && !rr.log.includes('a-end') && rr.log.includes('b-end') && rr.log.includes('c-end') && rr.resumes >= 2, `stop() ends silently, a new speech replaces the old one (${rr.log.join()}), the engine is resumed before every speak (${rr.resumes})`);
    await t.browser.close();
  }
  {
    // a page where nobody has tapped yet: the engine is locked; the first tap unlocks it for good (also for a later speak() from a timer)
    const t = await start(mk(), { noLogin: true, viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: ALLV, ios: true } });
    const p = t.page;
    await p.waitForTimeout(300);
    await p.evaluate(async () => { const S = await import('/src/speech.ts'); S.speakText('first', 'en-US'); });
    await p.waitForTimeout(150);
    ok((await p.evaluate(() => window.__says.length)) === 0 && (await p.evaluate(() => window.__ignored.map((x) => x[2]).join())) === 'locked', 'before any tap the engine is locked: a speak() from a script is refused');
    await p.mouse.click(8, 8);
    await p.evaluate(async () => { const S = await import('/src/speech.ts'); S.speakText('second', 'en-US'); });
    await p.waitForTimeout(150);
    ok((await p.evaluate(() => window.__says.map((x) => x[0]).join())) === 'second', 'after the first tap of the page (ensureUnlockedOnFirstGesture) a speak() from a script is heard');
    await t.browser.close();
  }
  {
    const t = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: null } });
    const r = await t.page.evaluate(async () => { const S = await import('/src/speech.ts'); let called = 0; const h = S.speakText('x', 'en-US', { onend: () => called++ }); S.unlockSpeech(); S.stopSpeech(); S.ensureUnlockedOnFirstGesture(); return { sup: S.speechSupported(), ended: h.ended, called, has: await S.hasVoice('en-US'), now: S.canSpeakNow('en-US') }; });
    ok(!r.sup && r.ended && r.called === 0 && !r.has && !r.now, 'no speech engine: every function is a quiet no-op, hasVoice is false');
    await t.browser.close();
  }

  // ---------- 2. the English word duel with the iOS-like engine ----------
  const duel = async (spec, mode, fn) => {
    const t = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: spec });
    const p = t.page;
    await p.evaluate(() => (location.hash = '#/english/pk')); await p.waitForSelector('#pk-slot-1');
    for (const [slot, id] of [[1, 'k1'], [2, 'k2']]) { await p.click('#pk-slot-' + slot); await p.waitForSelector('#pk-pick'); await p.click(`.pk-pick-kid[data-kid=${id}]`); await p.waitForSelector('#pk-pick', { state: 'detached' }); }
    if (mode) await p.click(`.pk-mode[data-mode=${mode}]`);
    await p.click('#pk-start'); await p.waitForFunction(() => window.__pk);
    await p.evaluate(() => window.__pk.manual(true));
    const S = () => p.evaluate(() => window.__pk.state());
    const step = (ms) => p.evaluate((m) => window.__pk.step(m), ms);
    const toQ = async () => { for (let i = 0; i < 200; i++) { const s = await S(); if (s.phase === 'question') return s; await step(100); } throw new Error('no question'); };
    try { await fn({ t, p, S, step, toQ }); } finally { await t.browser.close(); }
  };
  await duel(IOS, null, async ({ p, S, step, toQ }) => {
    let s = await toQ();
    await p.waitForTimeout(150);
    let says = await p.evaluate(() => window.__says);
    ok(says.length === 1 && says[0][0] === s.items[0].prompt && says[0][1] === 'en-US' && says[0][2] === 'en-US', `iOS-like engine, round 1: the word "${s.items[0].prompt}" is spoken after Start with no other tap (voice en-US)`);
    for (let r = 2; r <= 5; r++) {
      await p.evaluate(([a]) => window.__pk.tap(0, a), [s.items[0].answers[0]]);
      await step(1600);
      s = await toQ(); await p.waitForTimeout(120);
      says = await p.evaluate(() => window.__says);
      if (says.length !== r || says[r - 1][0] !== s.items[0].prompt) { ok(false, `round ${r}: the word is spoken (${says.length} utterances so far, last "${says[says.length - 1]?.[0]}", expected "${s.items[0].prompt}")`); break; }
      if (r === 5) ok(true, 'rounds 2-5: every word is spoken from the game clock without any tap');
    }
    ok(!(await p.evaluate(() => window.__ignored.length)), 'nothing was dropped by the engine (no speak() was refused or without a voice)');
    ok((await p.locator('.pk-panel.nosound').count()) === 0 && (await p.evaluate(() => getComputedStyle(document.querySelector('.pk-nosnd')).display)) === 'none', 'no "no sound" notice while the sound works');
    // the speaker button on each half: >= 44 px, speaks again, not counted as an answer
    const sizes = await p.evaluate(() => [...document.querySelectorAll('.pk-replay')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok(sizes.length === 2 && sizes.every(([w, h]) => w >= 44 && h >= 44), `a speaker button on each half, >= 44 px (${JSON.stringify(sizes)})`);
    const n0 = (await p.evaluate(() => window.__says)).length;
    await p.click('.pk-panel[data-side="1"] .pk-replay', { force: true }); await p.waitForTimeout(100);
    ok((await p.evaluate(() => window.__says)).length === n0 + 1 && (await S()).scores.join() === '0,0' || (await S()).scores[0] >= 0, 'the speaker button speaks the word again');
    await p.screenshot({ path: OUT + 'speech-duel-ok.png' });
  });
  // a silent engine (speak is accepted, no sound, no event): the notice, the big speaker, and the round never hangs
  for (const mode of ['word', 'meaning']) {
    await duel({ voices: ALLV, silent: true }, mode, async ({ p, S, step, toQ }) => {
      let s = await toQ();
      await p.waitForTimeout(1500);
      const v = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`), n = e.querySelector('.pk-nosnd'), c = e.querySelector('.pk-char').getBoundingClientRect(), nr = n.getBoundingClientRect(), rp = e.querySelector('.pk-replay'), rr = rp.getBoundingClientRect(), cs = getComputedStyle(n);
        return { shown: cs.display !== 'none', text: n.textContent, inside: nr.left >= c.left - 1 && nr.right <= c.right + 1 && nr.top >= c.top - 1 && nr.bottom <= c.bottom + 1 && n.scrollHeight <= n.clientHeight + 1, noOverlap: !(nr.left < rr.right - 1 && nr.right > rr.left + 1 && nr.top < rr.bottom - 1 && nr.bottom > rr.top + 1), attn: rp.classList.contains('attn'), rw: rr.width, rh: rr.height, ch: e.querySelector('.pk-ch').textContent }; }));
      if (mode === 'word') {
        ok(v.every((x) => x.shown && x.text === '没有声音。请点喇叭重听。' && x.inside && x.noOverlap && x.ch === ''), 'silent engine, 听音选词: ' + JSON.stringify(v) + ' both halves show "没有声音。请点喇叭重听。" inside the card, the word is NOT shown (the options are words)');
      } else {
        ok(v.every((x) => !x.shown && x.ch === s.items[0].prompt), 'silent engine, 听音选义: the word is shown as text on both halves (the options are meanings, nothing is given away)');
      }
      ok(v.every((x) => x.attn && x.rw >= 44 && x.rh >= 44), `the speaker button is highlighted and >= 44 px (${Math.round(v[0].rw)} x ${Math.round(v[0].rh)})`);
      if (mode === 'word') await p.screenshot({ path: OUT + 'speech-duel-silent.png' });
      // the engine comes back: a tap on the speaker speaks and the notice goes
      await p.evaluate(() => { window.__silent = false; });
      const n0 = (await p.evaluate(() => window.__says)).length;
      await p.click('.pk-panel[data-side="0"] .pk-replay'); await p.waitForTimeout(200);
      ok((await p.evaluate(() => window.__says)).length === n0 + 1 && (await p.locator('.pk-panel.nosound').count()) === 0, 'a tap on the speaker speaks (it is a user gesture) and the notice disappears once the sound starts');
      // the round never hangs: answers and time out go on
      await p.evaluate(([a]) => window.__pk.tap(1, a), [s.items[0].answers[0]]);
      await step(1600); s = await toQ();
      ok(s.round === 1, 'the game goes on to round 2 (nothing waited for the voice)');
    });
  }
  // the voices load late (700 ms) and the engine is locked: the question of round 1 still gets its word
  await duel({ voices: ALLV, ios: true, delay: 900 }, null, async ({ p, toQ }) => {
    const s = await toQ(); await p.waitForTimeout(1200);
    const says = await p.evaluate(() => window.__says);
    ok(says.length >= 1 && says[0][0] === s.items[0].prompt, 'late voice list: the first word is still spoken');
  });

  // ---------- 3. dictation (听写) and spelling with the iOS-like engine ----------
  {
    const WEEK = [...'假辣酸贫纺炒缸锅烛扇'];
    const init = ({ spec, src }) => {
      localStorage.setItem('learn.storage', 'local');
      localStorage.setItem('learn.local.kids.json', JSON.stringify({ kids: [{ id: 'kdory', name: 'Dory', color: '#f2545b' }], startWeek: '2026-10-25' }));
      localStorage.setItem('learn.local.kids/kdory.json', JSON.stringify({ weeks: [{ start: '2026-11-08', chars: spec.week }] }));
      localStorage.setItem('learn.local.idioms.json', JSON.stringify({ weeks: [] }));
      localStorage.setItem('learn.local.english/kdory.json', JSON.stringify({ weeks: [{ start: '2026-11-08', chars: spec.eng }] }));
      localStorage.setItem('learn.profile.v1', JSON.stringify({ kids: { kdory: { grade: 3, setOn: '2026-11-01' } } }));
      localStorage.setItem('learn.settings.v1', JSON.stringify({ lang: 'auto' }));
      (0, eval)('(' + src + ')')(spec.speech);
    };
    const t = await start(new Map(), { noLogin: true, init, initArg: { spec: { week: WEEK, eng: EN.slice(0, 12).map((x) => x.w), speech: IOS }, src: speechInit.toString() }, viewport: { width: 390, height: 844 } });
    const p = t.page;
    await p.waitForSelector('.hub-grid');
    await p.evaluate(() => (location.hash = '#/dictation/kdory')); await p.waitForSelector('#dw-start');
    await p.click('#dw-pause button[data-pause="3"]');
    await p.click('#dw-start'); await p.waitForSelector('#dw-dial');
    await p.waitForFunction(() => window.__says.length >= 1, null, { timeout: 4000 }).catch(() => {});
    let sy = await p.evaluate(() => window.__says);
    ok(sy.length >= 1 && sy[0][1] === 'zh-CN' && sy[0][2] === 'zh-CN', 'dictation: the first item is spoken after the start button (zh-CN voice)');
    await p.waitForFunction(() => window.__says.length >= 3, null, { timeout: 12000 }).catch(() => {});
    sy = await p.evaluate(() => window.__says);
    ok(sy.length >= 3 && !(await p.evaluate(() => window.__ignored.length)), `dictation: the next items are spoken from the timer, nothing refused (${sy.length} utterances, refused: ${JSON.stringify(await p.evaluate(() => window.__ignored))}, says: ${JSON.stringify(sy)})`);
    await p.evaluate(() => (location.hash = '#/english/kdory')); await p.waitForSelector('#dict-btn');
    const before = (await p.evaluate(() => window.__says)).length;
    await p.click('#dict-btn'); await p.waitForSelector('#sp-input');
    await p.waitForFunction((n) => window.__says.length > n, before, { timeout: 4000 }).catch(() => {});
    sy = await p.evaluate(() => window.__says);
    const w0 = await p.$eval('#sp-input', (e) => e.dataset.word);
    ok(sy.length > before && sy[sy.length - 1][0] === w0 && sy[sy.length - 1][2] === 'en-US', `spelling: the first word "${w0}" is spoken (en-US voice) after the dictation button`);
    await p.click('#sp-hear'); await p.waitForTimeout(150);
    ok((await p.evaluate(() => window.__says)).length === sy.length + 1, 'spelling: the "listen again" button speaks again');
    ok(!(await p.evaluate(() => window.__ignored.length)), 'nothing was refused by the engine in dictation or spelling');
    await t.browser.close();
  }
  await done();
})();
