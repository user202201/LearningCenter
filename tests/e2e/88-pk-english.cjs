// PK听单词 (src/pk-english.ts on the shared PK shell): the word generator for both tracks (exactly one right option, plausible neighbours, no two valid meanings, no homophones),
// the word source (alternate between the two lists, 8 + 7 of 15, union, shortages), the entry card on the English home, the setup page (modes, rule line, voice message,
// shortage messages), speech through a stub (one utterance per round, language, replay, no-voice fallback), 15 rounds and 15 round dots on every screen size, the same
// shell as the Chinese duel (rotation, layout, opening order), records kept apart per subject and track, real touch with two fingers (CDP, dpr 2), EN / FR, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const EN = require('../../src/data/english-words.json').words;
const FR = require('../../src/data/french-words.json').words;

const KIDS = [{ id: 'k1', name: 'Anna', color: '#f2545b' }, { id: 'k2', name: 'Ben', color: '#1c7ed6' }, { id: 'k3', name: 'Cy', color: '#2f9e44' }, { id: 'k4', name: 'Dee', color: '#e8590c' }, { id: 'k5', name: 'Eve', color: '#7950f2' }];
const RECS = { k1: [0, 12], k2: [8, 22], k3: [30, 32], k4: [40, 41], k5: [50, 55] };   // slices of the library: Anna and Ben share four words, Cy has 2, Dee has 1, Eve 5
const mk = () => {
  const store = new Map();
  store.set('kids.json', JSON.stringify({ kids: KIDS, startWeek: '2026-11-08' }));
  for (const k of KIDS) {
    store.set(`kids/${k.id}.json`, JSON.stringify({ weeks: [{ start: '2026-11-08', chars: [...'山水火土木金'] }] }));
    const [a, b] = RECS[k.id];
    store.set(`english/${k.id}.json`, JSON.stringify({ weeks: [{ start: '2026-11-08', chars: EN.slice(a, b).map((x) => x.w) }] }));
    store.set(`french/${k.id}.json`, JSON.stringify({ weeks: [{ start: '2026-11-08', chars: FR.slice(a, b).map((x) => x.w) }] }));
  }
  return store;
};
const { speechInit } = require('./speechstub.cjs');
const ALLV = [{ lang: 'en-US' }, { lang: 'fr-FR' }, { lang: 'zh-CN' }];
const SIZES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1180, 820]];

(async () => {
  // =====================================================================================================================================
  // 1. the generator and the word source (pure), for all three screens: zh (English words, Chinese meanings), fr (English words, French meanings), en (French words, English meanings)
  // =====================================================================================================================================
  const t = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: ALLV } });
  const p = t.page;
  const R = await p.evaluate(async () => {
    const E = await import('/src/pk-english.ts');
    const L = await import('/src/pklogic.ts');
    const en = (await import('/src/data/english-words.json')).default.words, fr = (await import('/src/data/french-words.json')).default.words.map((x) => ({ w: x.w, zh: '', en: x.en, ph: '', pos: x.pos, g: x.g, t: x.t }));
    const res = { bad: [], items: 0, modes: {}, near: 0, nearTot: 0 };
    const bad = (m) => { if (res.bad.length < 10) res.bad.push(m); };
    // --- pieces ---
    if (E.baseOf('le chat') !== 'chat' || E.baseOf("l'école") !== 'école' || E.baseOf('Apple') !== 'apple') bad('baseOf');
    if (!E.homophones('write', 'right') || !E.homophones('Two', 'to') || E.homophones('cat', 'cap') || !E.homophones('le vert', 'un verre') || !E.homophones('la mer', 'la mère')) bad('homophones');
    if (E.edit('kitten', 'sitting') !== 3 || E.edit('', 'abc') !== 3 || E.edit('same', 'same') !== 0) bad('edit distance');
    if (E.senses('大的，非常的，主要的').join() !== '大,非常,主要' || E.senses('to run').join() !== 'run' || E.senses('le chat / un chat').join() !== 'chat,chat') bad('senses: ' + E.senses('大的，非常的，主要的') + ' | ' + E.senses('to run'));
    // --- items for every screen language ---
    const setups = [['zh', en], ['fr', en], ['en', fr]];
    for (const [lang, lib] of setups) {
      const withMeaning = lib.filter((x) => E.meaningIn(x, lang));
      if (withMeaning.length < lib.length * 0.98) bad(lang + ': the library lacks meanings (' + withMeaning.length + '/' + lib.length + ')');
      // an independent synonym map: every sense -> the words that have it
      const bySense = new Map();
      for (const x of lib) for (const s of E.senses(E.meaningIn(x, lang))) { if (!bySense.has(s)) bySense.set(s, new Set()); bySense.get(s).add(x.w.toLowerCase()); }
      const dupText = new Map();
      for (const x of lib) { const m = E.meaningIn(x, lang); if (m) dupText.set(m, (dupText.get(m) || 0) + 1); }
      const dups = [...dupText].filter(([, n]) => n > 1).map(([m]) => m);
      for (let i = 0; i < lib.length; i += 3) {
        const target = lib[i];
        for (const mode of ['word', 'meaning']) {
          const rnd = L.rng(i * 7 + (mode === 'word' ? 1 : 2));
          const it = E.makeWordItem(target, lib, mode, rnd, lang);
          if (!it) { res.modes[lang + mode + 'null'] = (res.modes[lang + mode + 'null'] || 0) + 1; continue; }
          res.items++; res.modes[lang + mode] = (res.modes[lang + mode] || 0) + 1;
          if (it.prompt !== target.w) bad('prompt');
          if (it.choices.length !== 4 || new Set(it.choices.map((c) => c.toLowerCase())).size !== 4) bad(lang + mode + ' choices not distinct for ' + target.w + ': ' + it.choices);
          if (it.answers.length !== 1) bad('exactly one answer: ' + target.w);
          const right = it.choices[it.answers[0]];
          if (mode === 'word') {
            if (right !== target.w) bad('right word is not the spoken word: ' + target.w);
            it.choices.forEach((c, k) => { if (k !== it.answers[0] && (E.homophones(c, target.w) || c.toLowerCase() === target.w.toLowerCase())) bad('a homophone / the same word is offered: ' + target.w + ' ~ ' + c); });
            for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (E.homophones(it.choices[a], it.choices[b])) bad('two options sound alike: ' + it.choices[a] + ' ' + it.choices[b]);
            it.choices.forEach((c, k) => { if (k !== it.answers[0]) { res.nearTot++; const a = E.baseOf(target.w), b = E.baseOf(c); if (a[0] === b[0] || E.edit(a, b) <= 3 || Math.abs(a.length - b.length) <= 1) res.near++; } });
          } else {
            if (right !== E.meaningIn(target, lang)) bad('right meaning is not the meaning of the spoken word: ' + target.w);
            // valid senses of the spoken word: its own and those of every word that shares a sense with it (independent of the generator's code)
            const own = new Set(E.senses(E.meaningIn(target, lang)));
            const valid = new Set(own);
            for (const s of own) for (const w of bySense.get(s) || []) { const e = lib.find((q) => q.w.toLowerCase() === w); for (const s2 of E.senses(E.meaningIn(e, lang))) valid.add(s2); }
            for (const x of lib) if (x.w.toLowerCase() === target.w.toLowerCase()) for (const s2 of E.senses(E.meaningIn(x, lang))) valid.add(s2);
            it.choices.forEach((c, k) => {
              if (k === it.answers[0]) return;
              if (E.senses(c).some((s) => valid.has(s))) bad(lang + ': an option could also be right for "' + target.w + '": ' + c + ' (right: ' + right + ')');
              if (c === right) bad('same meaning twice');
            });
            if (dups.includes(right) && it.choices.filter((c) => c === right).length !== 1) bad('a duplicated meaning appears twice');
          }
        }
      }
    }
    // --- the word source ---
    const A = en.slice(0, 20), B = en.slice(30, 50), map = new Map(en.map((x) => [x.w.toLowerCase(), x]));
    const names = (a) => a.map((x) => x.w);
    let eightA = 0, eightB = 0, alt = 0;
    for (let sd = 1; sd <= 300; sd++) {
      const out = E.pickWords(A, B, L.rng(sd), 15);
      if (out.length !== 15 || new Set(names(out)).size !== 15) bad('15 distinct words');
      const fromA = out.filter((x) => A.includes(x)).length, fromB = out.filter((x) => B.includes(x)).length;
      if (!((fromA === 8 && fromB === 7) || (fromA === 7 && fromB === 8))) bad('split ' + fromA + '+' + fromB);
      if (fromA === 8) eightA++; else eightB++;
      const first = A.includes(out[0]) ? 0 : 1;
      if (out.every((x, i) => (i % 2 === 0 ? (first === 0 ? A : B) : (first === 0 ? B : A)).includes(x))) alt++;
      const again = E.pickWords(A, B, L.rng(sd), 15);
      if (names(again).join() !== names(out).join()) bad('seeded word source');
    }
    res.eightA = eightA; res.eightB = eightB; res.alt = alt;
    // overlap counts once; the other list gives the rest; shortages
    { const same = E.pickWords(A, A, L.rng(5), 15); if (same.length !== 15 || new Set(names(same)).size !== 15) bad('the same list twice'); }
    { const o = E.pickWords(A.slice(0, 10), [...A.slice(5, 10), ...B.slice(0, 3)], L.rng(6), 15); if (o.length !== 13 || new Set(names(o)).size !== 13) bad('overlap counts once: ' + o.length); }
    { const o = E.pickWords(A.slice(0, 2), B, L.rng(7), 15); if (o.length !== 15 || o.filter((x) => A.includes(x)).length !== 2) bad('a short list gives all it has, the other the rest'); }
    { const o = E.pickWords(A.slice(0, 3), B.slice(0, 5), L.rng(8), 15); if (o.length !== 8) bad('8 words exist: ' + o.length); }
    { const o = E.pickWords([], [], L.rng(9), 15); if (o.length !== 0) bad('nothing'); }
    // game: recorded words only; words outside the library are ignored; fewer than 4 = no game
    const recA = A.map((x) => x.w), recB = B.map((x) => x.w);
    const g = E.makeEnglishGame([...recA, 'zzzz', 'qqq'], recB, en, 'word', 11, 'zh');
    if (!g || g[0].length !== 15 || g[0] !== g[1]) bad('the same 15 questions for both sides');
    else {
      const all = new Set([...recA, ...recB]);
      if (g[0].some((it) => !all.has(it.prompt))) bad('a word that nobody recorded');
      if (new Set(g[0].map((it) => it.prompt)).size !== 15) bad('repeated word');
    }
    if (E.makeEnglishGame(recA.slice(0, 2), recB.slice(0, 1), en, 'word', 1, 'zh') !== null) bad('3 words make no game');
    if (!E.makeEnglishGame(recA.slice(0, 2), recB.slice(0, 2), en, 'word', 1, 'zh')) bad('4 words make a game');
    const g4 = E.makeEnglishGame(recA.slice(0, 3), recB.slice(5, 9), en, 'meaning', 3, 'fr');
    if (!g4 || g4[0].length !== 7) bad('7 words, meaning mode, French meanings');
    // the meaning mode skips words that have no meaning in the language
    const noMeaning = en.map((x, i) => (i === 0 ? { ...x, fr: '' } : x));
    const g5 = E.makeEnglishGame([en[0].w, en[1].w, en[2].w, en[3].w, en[4].w], [], noMeaning, 'meaning', 4, 'fr');
    if (!g5 || g5[0].some((it) => it.prompt === en[0].w)) bad('a word without a meaning is asked in meaning mode');
    return res;
  });
  ok(R.bad.length === 0, `generator: ${R.items} questions over the three screens (zh / fr: English words, en: French words): exactly one right option, 4 distinct options, no homophone, no second valid meaning${R.bad.length ? ' -> ' + R.bad.join('; ') : ''}`);
  ok(['zhword', 'zhmeaning', 'frword', 'frmeaning', 'enword', 'enmeaning'].every((k) => R.modes[k] > 150), 'every screen and mode produced many items: ' + JSON.stringify(R.modes));
  ok(R.nearTot > 800 && R.near / R.nearTot >= 0.9, `the wrong words are plausible neighbours (same first letter / few edits / similar length): ${(100 * R.near / R.nearTot).toFixed(0)} %`);
  ok(R.eightA > 100 && R.eightB > 100 && R.alt === 300, `15 words = 8 + 7 alternating between the two lists, the player with 8 changes with the seed (${R.eightA} / ${R.eightB}); order alternates in all 300 games`);

  // =====================================================================================================================================
  // 2. the entry card, the setup page
  // =====================================================================================================================================
  await p.evaluate(() => (location.hash = '#/subject/english')); await p.waitForSelector('.kids');
  const H = await p.evaluate(() => { const kids = document.querySelector('.kids').getBoundingClientRect(), pk = document.querySelector('#pk-refs-english'), card = document.querySelector('#open-pk-en'); const r = pk && pk.getBoundingClientRect(); return { below: !!r && r.top >= kids.bottom - 1, text: card && card.textContent, svg: !!(card && card.querySelector('svg')), sw: document.documentElement.scrollWidth, vw: innerWidth, chinese: !!document.querySelector('#open-pk') }; });
  ok(H.below && H.text.includes('PK听单词') && H.svg && H.sw <= H.vw && !H.chinese, 'the English home: the "PK听单词" card (with its drawing) is below the list of children; the Chinese card is not there');
  await p.screenshot({ path: OUT + 'pke-home.png' });
  await p.evaluate(() => (location.hash = '#/chinese')); await p.waitForSelector('#open-pk');
  ok(!(await p.locator('#open-pk-en').count()), 'the Chinese home has no English card');
  await p.evaluate(() => (location.hash = '#/subject/english')); await p.waitForSelector('#open-pk-en');
  await p.click('#open-pk-en'); await p.waitForSelector('#pk-slot-1');
  ok((await p.evaluate(() => location.hash)) === '#/english/pk' && (await p.textContent('.hero-text h1')).includes('PK听单词'), 'the card opens #/english/pk (not taken for a child)');
  ok((await p.textContent('#pk-lobby')).includes('对战大厅'), 'the page is the battle lobby');
  ok(await p.evaluate(() => [...document.querySelectorAll('.pk-mode')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')).join() === '听音选词:true,听音选义:false'), 'two mode pills, "听音选词" is the default');
  ok((await p.textContent('#pk-rule')).trim() === '单词取自两位选手各自已入库的单词。' && !(await p.locator('#pk-novoice').count()), 'one formal line explains the word source; with a voice there is no voice message');
  const pickKid = async (slot, id) => { await p.click('#pk-slot-' + slot); await p.waitForSelector('#pk-pick'); await p.click(`.pk-pick-kid[data-kid=${id}]`); await p.waitForSelector('#pk-pick', { state: 'detached' }); };
  await pickKid(1, 'k3'); await pickKid(2, 'k4');
  ok(await p.isDisabled('#pk-start') && (await p.textContent('#pk-msgs')).includes('Cy') && (await p.textContent('#pk-msgs')).includes('Dee') && (await p.textContent('#pk-msgs')).includes('已入库的单词合计太少，至少需要 4 个。'), 'Cy (2 words) and Dee (1 word): fewer than 4 together: Start is off and the message names both');
  await pickKid(2, 'k2');
  await pickKid(2, 'k5');
  ok(!(await p.isDisabled('#pk-start')) && (await p.textContent('#pk-msgs')).trim() === '词量不足 15 个，本局共 7 题。', 'Cy (2 words) + Eve (5): 7 distinct words, Start is on, the note says: ' + (await p.textContent('#pk-msgs')).trim());
  await pickKid(1, 'k2'); await pickKid(2, 'k4');
  ok(!(await p.isDisabled('#pk-start')) && (await p.textContent('#pk-msgs')).trim() === '', 'Ben (14) + Dee (1): exactly 15 words, no note');
  await pickKid(1, 'k1');
  await pickKid(2, 'k2');
  ok(!(await p.isDisabled('#pk-start')) && (await p.textContent('#pk-msgs')).trim() === '', 'Anna and Ben share four words: 22 distinct words, no shortage note (a word recorded by both counts once)');
  // the mode is remembered
  await p.click('.pk-mode[data-mode=meaning]');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.pk.v1')).mode.english)) === 'meaning' && (await p.getAttribute('.pk-mode[data-mode=meaning]', 'aria-pressed')) === 'true', 'the mode pill is remembered on this device');
  await p.click('.pk-mode[data-mode=word]');
  await p.screenshot({ path: OUT + 'pke-setup.png', fullPage: true });
  // no voice: the line says so
  const nv = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: null } });
  await nv.page.evaluate(() => (location.hash = '#/english/pk')); await nv.page.waitForSelector('#pk-slot-1');
  ok((await nv.page.textContent('#pk-novoice')).trim() === '本设备没有语音，将显示单词。', 'no voice on this device: the setup page says the word will be shown');
  await nv.browser.close();
  const wv = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: [{ lang: 'zh-CN' }] } });
  await wv.page.evaluate(() => (location.hash = '#/english/pk')); await wv.page.waitForSelector('#pk-slot-1');
  ok(await wv.page.locator('#pk-novoice').count() === 1, 'voices of another language only count as no voice');
  await wv.browser.close();

  // =====================================================================================================================================
  // 3. the game: the same word and the same four options for both, one utterance per round, 15 rounds
  // =====================================================================================================================================
  await p.evaluate(() => { window.__pkSeed = 4242; document.documentElement.requestFullscreen = () => Promise.reject(new Error('off in the test')); });
  await p.click('#pk-start'); await p.waitForSelector('#pk-stage'); await p.evaluate(() => window.__pk.manual(true));
  const S = () => p.evaluate(() => window.__pk.state());
  const step = (ms) => p.evaluate((m) => window.__pk.step(m), ms);
  const toPhase = async (ph) => { for (let i = 0; i < 120; i++) { const s = await S(); if (s.phase === ph) return s; await p.evaluate(() => { const s2 = window.__pk.state(); window.__pk.step(Math.max(1, s2.phaseEnd - window.__pk.T())); }); } throw new Error('never reached ' + ph); };
  const tap = (side, i) => p.evaluate(([a, b]) => window.__pk.tap(a, b), [side, i]);
  const says = () => p.evaluate(() => window.__says.slice());
  let s = await S();
  ok(s.total === 15 && s.items[0].prompt === s.items[1].prompt && JSON.stringify(s.items[0]) === JSON.stringify(s.items[1]), 'a game has 15 rounds; both sides get the very same item (word and options in the same order)');
  ok((await says()).length === 0, 'nothing is spoken during the opening');
  // the opening runs through the same states
  const seq = [];
  for (let i = 0; i < 90; i++) { const st = await S(), k = st.phase + (st.phase === 'countdown' ? st.count : ''); if (!seq.length || seq[seq.length - 1] !== k) seq.push(k); if (st.phase === 'prep') break; await step(100); }
  ok(seq.join() === 'intro,countdown3,countdown2,countdown1,countdown0,prep', 'the same opening: ' + seq.join(' > '));
  ok((await says()).length === 0, 'nothing is spoken before the question is shown');
  const lab = () => p.evaluate(() => [0, 1].map((side) => [...document.querySelectorAll(`.pk-panel[data-side="${side}"] .pk-lab`)].map((e) => e.textContent)));
  await toPhase('question'); s = await S();
  let sp = await says();
  ok(sp.length === 1 && sp[0][0] === s.items[0].prompt && sp[0][1] === 'en-US', 'round 1: the word is spoken once, with the en-US voice (' + JSON.stringify(sp) + ')');
  let L2 = await lab();
  ok(JSON.stringify(L2[0]) === JSON.stringify(L2[1]) && L2[0].join() === s.items[0].choices.join(), 'both halves show the same four written words in the same order: ' + L2[0].join(' / '));
  let view = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`); return { ch: e.querySelector('.pk-ch').textContent, spk: getComputedStyle(e.querySelector('.pk-spkbig')).display, replay: !!e.querySelector('.pk-replay'), rd: e.querySelector('.pk-round').textContent }; }));
  ok(view.every((v) => v.ch === '' && v.spk !== 'none' && v.replay) && view[0].rd === '第 1 / 15 题', 'the word is hidden: a big speaker and a "再听一次" button on each half; the counter reads 第 1 / 15 题');
  ok(await p.evaluate(() => [...document.querySelectorAll('.pk-replay')].every((b) => b.getAttribute('aria-label') === '再听一次')), 'the replay buttons are named');
  await p.click('.pk-panel[data-side="0"] .pk-replay', { force: true });
  sp = await says();
  ok(sp.length === 2 && sp[1][0] === s.items[0].prompt, 'replay speaks the same word again (and is not counted as an answer)');
  ok((await S()).scores.join() === '0,0' && (await S()).phase === 'question', 'the replay does not change the game');
  await p.evaluate(() => { const b = document.querySelector('.pk-panel[data-side="1"] .pk-replay'); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true })); });
  ok((await says()).length === 3, 'the other half\'s button speaks too');
  await tap(1, s.items[1].answers[0]);
  ok((await S()).scores.join() === '0,1' && (await S()).winner === 1, 'the first right tap wins (player 2)');
  // one utterance per round
  await step(1500);
  for (let r = 1; r < 4; r++) { const st = await toPhase('question'); await tap(0, st.items[0].answers[0]); await step(1500); }
  sp = await says();
  ok(sp.length === 3 + 3, 'one utterance per round (plus the replays): ' + sp.length);
  await p.screenshot({ path: OUT + 'pke-round.png' });

  // dots, tug of war and round counter on every screen size
  await toPhase('question');
  for (const [w, h] of SIZES.concat([[568, 320], [1366, 1024]])) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(100);
    const g = await p.evaluate(() => {
      const stg = document.querySelector('#pk-stage'), rotd = stg.classList.contains('rot');   // (rectangles in the INNER coordinates of the stage: a landscape screen turns it by 90 degrees)
      const r = (e) => { const b = e.getBoundingClientRect(); if (!rotd) return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; const l = b.top, rr = b.bottom, t = innerWidth - b.right, bb = innerWidth - b.left; return { l, t, r: rr, b: bb, w: rr - l, h: bb - t }; };
      const rot = (e) => { const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(e).transform); if (!m) return 0; const [a, b] = m[1].split(',').map(Number); return Math.round(Math.atan2(b, a) * 180 / Math.PI); };
      const pn = [0, 1].map((side) => document.querySelector(`.pk-panel[data-side="${side}"]`));
      const mid = r(document.querySelector('#pk-mid')), dots = r(document.querySelector('#pk-dots')), ex = r(document.querySelector('#pk-exit')), mu = r(document.querySelector('#pk-mute')), frame = r(document.querySelector('#pk-frame'));
      return { rot: pn.map(rot), mid, dots, ex, mu, frame, n: document.querySelectorAll('#pk-dots .pk-dot').length, fit: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight, vw: rotd ? innerHeight : innerWidth, vh: rotd ? innerWidth : innerHeight, rvw: innerWidth, rvh: innerHeight, wrap: (() => { const b = stg.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })(), tf: getComputedStyle(stg).transform,
        opts: pn.map((e) => [...e.querySelectorAll('.pk-opt')].map(r)), box: pn.map(r), ch: pn.map((e) => r(e.querySelector('.pk-char'))), over: pn.map((e) => [...e.querySelectorAll('.pk-lab')].some((l) => l.scrollWidth > l.clientWidth + 1)), tug: r(document.querySelector('#pk-tug')) };
    });
    const tag = `${w}x${h}`;
    ok(g.rot[1] === 180 && g.rot[0] === 0, `${tag}: top half 180 degrees, bottom half 0 (the same shell as the Chinese duel)`);
    ok(g.n === 15 && g.dots.l >= g.ex.r - 1 && g.dots.r <= g.mu.l + 1 && g.dots.l >= g.mid.l && g.dots.r <= g.mid.r && g.dots.h > 0, `${tag}: 15 round dots fit between the exit and the sound buttons (${Math.round(g.dots.w)} px wide, free ${Math.round(g.mu.l - g.ex.r)} px)`);
    ok(g.tug.l >= g.mid.l && g.tug.r <= g.mid.r && g.tug.b <= g.mid.b + 1, `${tag}: the tug of war bar is inside the centre line`);
    ok(g.opts.every((o) => o.every((b) => b.h >= 55.5)) && g.fit && !g.over.some(Boolean), `${tag}: choice buttons >= 56 px, no overflow, no clipped word`);
    ok(g.opts.every((o, i) => o.every((b) => b.l >= g.box[i].l - 1 && b.r <= g.box[i].r + 1 && b.t >= g.box[i].t - 1 && b.b <= g.box[i].b + 1)) && Math.abs(g.frame.l - (g.vw - g.frame.r)) < 1.5 && Math.abs(g.frame.w - g.vw) <= 1 && Math.abs(g.frame.h - g.vh) <= 1, `${tag}: every button inside its half, the stage fills the whole viewport (${Math.round(g.frame.w)} x ${Math.round(g.frame.h)})`);
    ok(Math.abs(g.wrap[0]) <= 1 && Math.abs(g.wrap[1]) <= 1 && Math.abs(g.wrap[2] - g.rvw) <= 1 && Math.abs(g.wrap[3] - g.rvh) <= 1 && (w > h ? /matrix\(0, 1, -1, 0/.test(g.tf) : g.tf === 'none'), `${tag}: the stage covers the viewport exactly, ${w > h ? 'turned by 90 degrees (landscape)' : 'not turned (portrait)'}`);
    await p.screenshot({ path: OUT + `pke-q-${tag}.png` });
  }
  await p.setViewportSize({ width: 390, height: 844 });

  // play to the end: 15 rounds, the record is kept for this subject and track only
  while ((await S()).phase !== 'final') { const st = await toPhase('question'); await tap(st.round % 3 === 0 ? 1 : 0, st.items[0].answers[0]); await step(1500); }
  s = await S();
  ok(s.results.length === 15 && s.scores[0] + s.scores[1] === 15 && (await p.textContent('.pk-panel[data-side="0"] .pk-round')) === '第 15 / 15 题', 'the game has 15 rounds, every one decided: ' + s.scores.join(':'));
  const fin = await p.evaluate(() => [0, 1].map((side) => document.querySelector(`.pk-panel[data-side="${side}"] .pk-verdict`).textContent));
  ok(fin.join() === '你赢了。,你输了。' || fin.join() === '你输了。,你赢了。', 'the final screens say who won: ' + fin.join(' / '));
  await p.screenshot({ path: OUT + 'pke-final.png' });
  const store1 = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.pk.v1')));
  ok(Object.keys(store1.rec).join() === 'english:en' && !store1.rec.chinese && Object.keys(store1.rec['english:en']).length === 1, 'the record is kept under "english:en" (subject and track); nothing is written for the Chinese duel (' + Object.keys(store1.rec).join() + ')');
  ok(store1.last.english.join() === 'k1,k2' && !store1.last.chinese, 'the last pick is remembered per subject');
  await p.click('#pk-exit'); await p.waitForSelector('#pk-slot-1');
  ok((await p.evaluate(() => location.hash)) === '#/english/pk' && (await p.locator('.pk-match').count()) === 1 && (await p.textContent('.pk-match')).replace(/\s+/g, ' ').trim().startsWith('Anna VS Ben'), 'back on the English setup page the record reads like a match');
  await p.evaluate(() => (location.hash = '#/chinese/pk')); await p.waitForSelector('#pk-slot-1');
  ok((await p.locator('.pk-match').count()) === 0 && (await p.locator('.pk-slot.set').count()) === 0, 'the Chinese duel shows no record and no pick of the English one');

  // the meaning mode: the options are Chinese meanings, exactly one right
  await p.evaluate(() => (location.hash = '#/english/pk')); await p.waitForSelector('#pk-slot-1');
  await p.click('.pk-mode[data-mode=meaning]'); await p.click('#pk-start'); await p.waitForSelector('#pk-stage'); await p.evaluate(() => window.__pk.manual(true));
  await p.evaluate(() => { window.__says.length = 0; });
  s = await toPhase('question');
  L2 = await lab();
  ok(L2[0].every((x) => /[一-鿿]/.test(x)) && s.items[0].answers.length === 1 && JSON.stringify(L2[0]) === JSON.stringify(L2[1]), 'meaning mode: four Chinese meanings, one right, the same on both halves: ' + L2[0].join(' / '));
  ok((await says()).length === 1 && (await says())[0][0] === s.items[0].prompt, 'meaning mode: the English word is spoken');
  await tap(0, s.items[0].answers[0]);
  await p.screenshot({ path: OUT + 'pke-meaning.png' });
  await p.click('#pk-exit'); await p.waitForSelector('dialog[open]'); await p.click('dialog[open] button.danger'); await p.waitForSelector('#pk-slot-1');
  ok(t.log.external.length === 0, 'no request left the app: ' + t.log.external.join(','));
  await t.browser.close();

  // =====================================================================================================================================
  // 4. no voice: the word is shown as text, no replay button
  // =====================================================================================================================================
  const nov = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: null } });
  const q = nov.page;
  await q.evaluate(() => { localStorage.setItem('learn.pk.v1', JSON.stringify({ last: { english: ['k1', 'k2'] } })); window.__pkSeed = 7; document.documentElement.requestFullscreen = () => Promise.reject(new Error('x')); });
  await q.evaluate(() => (location.hash = '#/english/pk/play')); await q.waitForSelector('#pk-stage'); await q.evaluate(() => window.__pk.manual(true));
  const qS = () => q.evaluate(() => window.__pk.state());
  for (let i = 0; i < 90 && (await qS()).phase !== 'question'; i++) await q.evaluate(() => { const st = window.__pk.state(); window.__pk.step(Math.max(1, st.phaseEnd - window.__pk.T())); });
  const st0 = await qS();
  const nv2 = await q.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`); return { ch: e.querySelector('.pk-ch').textContent, spk: getComputedStyle(e.querySelector('.pk-spkbig')).display, replay: e.querySelectorAll('.pk-replay').length }; }));
  ok(nv2.every((v) => v.ch === st0.items[0].prompt && v.spk === 'none' && v.replay === 0), 'no voice: both halves show the word "' + st0.items[0].prompt + '" as text, no speaker, no replay button');
  const fitW = await q.evaluate(() => [0, 1].map((side) => { const c = document.querySelector(`.pk-panel[data-side="${side}"] .pk-char`), t = document.querySelector(`.pk-panel[data-side="${side}"] .pk-ch`); return t.scrollWidth <= c.clientWidth + 1; }));
  ok(fitW.every(Boolean), 'the word fits inside its card');
  await q.screenshot({ path: OUT + 'pke-novoice.png' });
  await nov.browser.close();

  // =====================================================================================================================================
  // 5. the three screens: Chinese (English words + Chinese meanings), French (English words + French meanings), English (French words, voice fr-FR)
  // =====================================================================================================================================
  for (const [locale, key, voice, mean] of [['fr', 'english:en', 'en-US', 'fr'], ['en', 'english:fr', 'fr-FR', 'en']]) {
    const sess = await start(mk(), { viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: ALLV } });
    const x = sess.page;
    const cjk = (sel) => x.evaluate((s2) => { const bad = []; const walk = (n) => { if (n.nodeType === 3) { if (/[一-鿿]/.test(n.nodeValue) && !n.parentElement.closest('.user, .user-title')) bad.push(n.nodeValue.trim()); } else if (n.nodeType === 1 && !['SVG', 'svg', 'SCRIPT', 'STYLE'].includes(n.tagName)) { for (const a of ['title', 'aria-label']) if (/[一-鿿]/.test(n.getAttribute(a) || '')) bad.push(a + ':' + n.getAttribute(a)); n.childNodes.forEach(walk); } }; document.querySelectorAll(s2).forEach(walk); return bad; }, sel);
    await x.evaluate(async (lg) => { const D = await import('/src/i18n-data.ts'), X2 = await import('/src/i18n-extra/pk.json'); const m = X2.default || X2; Object.entries(m).forEach(([k, v]) => { D.EN[k] = v[0]; D.FR[k] = v[1]; }); const I = await import('/src/i18n.ts'); I.setLang(lg); }, locale);
    await x.evaluate(() => (location.hash = '#/subject/english')); await x.waitForSelector('#open-pk-en');
    const lang = await x.evaluate(() => document.documentElement.lang);
    let bad = await cjk('#app'); ok(bad.length === 0, `${lang}: the English home with the duel card has no Chinese left (${bad.join(' | ')})`);
    const cardText = (await x.textContent('#open-pk-en .pk-reft b')).replace(/\s+/g, ' ').trim();
    ok(lang === 'fr' ? cardText.startsWith('Duel de mots') : cardText.startsWith('Word duel'), `${lang}: the card is called "${cardText}"`);
    await x.click('#open-pk-en'); await x.waitForSelector('#pk-slot-1');
    for (const [slot, id] of [[1, 'k1'], [2, 'k2']]) { await x.click('#pk-slot-' + slot); await x.waitForSelector('#pk-pick'); await x.click(`.pk-pick-kid[data-kid=${id}]`); await x.waitForSelector('#pk-pick', { state: 'detached' }); }
    bad = await cjk('#app'); ok(bad.length === 0, `${lang}: the setup page has no Chinese left (${bad.join(' | ')})`);
    await x.screenshot({ path: OUT + `pke-setup-${lang}.png`, fullPage: true });
    await x.evaluate(() => { window.__pkSeed = 99; document.documentElement.requestFullscreen = () => Promise.reject(new Error('x')); });
    await x.click('.pk-mode[data-mode=meaning]'); await x.click('#pk-start'); await x.waitForSelector('#pk-stage'); await x.evaluate(() => window.__pk.manual(true));
    const xS = () => x.evaluate(() => window.__pk.state());
    const xTo = async (ph) => { for (let i = 0; i < 120; i++) { if ((await xS()).phase === ph) return xS(); await x.evaluate(() => { const st = window.__pk.state(); window.__pk.step(Math.max(1, st.phaseEnd - window.__pk.T())); }); } };
    bad = await cjk('#app'); ok(bad.length === 0, `${lang}: the opening has no Chinese left (${bad.join(' | ')})`);
    const st = await xTo('question');
    bad = await cjk('#app'); ok(bad.length === 0, `${lang}: a question has no Chinese left (${bad.join(' | ')})`);
    const said = await x.evaluate(() => window.__says);
    ok(said.length === 1 && said[0][1] === voice && said[0][0] === st.items[0].prompt, `${lang}: the spoken word "${said[0] && said[0][0]}" uses the ${voice} voice`);
    const choices = (await x.evaluate(() => [...document.querySelectorAll('.pk-panel[data-side="0"] .pk-lab')].map((e) => e.textContent)));
    ok(choices.length === 4 && choices.every((c) => c && !/[一-鿿]/.test(c)), `${lang}: the ${mean === 'fr' ? 'French' : 'English'} meanings are the options: ${choices.join(' / ')}`);
    if (lang === 'en' || lang === 'fr') { /* the French track uses its own record */ }
    await x.screenshot({ path: OUT + `pke-q-${lang}.png` });
    await xTo('final').catch(() => {});
    // finish quickly through the hook to look at the final and check the record key
    for (let i = 0; i < 400 && (await xS()).phase !== 'final'; i++) { const s2 = await xTo('question'); if (!s2 || (await xS()).phase === 'final') break; await x.evaluate(([a]) => window.__pk.tap(0, a), [s2.items[0].answers[0]]); await x.evaluate(() => window.__pk.step(1500)); }
    bad = await cjk('#app'); ok(bad.length === 0, `${lang}: the final screens have no Chinese left (${bad.join(' | ')})`);
    const rec = await x.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('learn.pk.v1')).rec));
    ok(rec.join() === key, `${lang}: the record is kept under "${key}" (${rec.join()})`);
    await x.screenshot({ path: OUT + `pke-f-${lang}.png` });
    ok(sess.log.external.length === 0, `${lang}: no outside request`);
    await sess.browser.close();
  }

  // =====================================================================================================================================
  // 6. real touch, two fingers, dpr 2: the same word on both halves
  // =====================================================================================================================================
  const tt = await start(mk(), { touch: true, dpr: 2, viewport: { width: 820, height: 1180 }, motion: false, init: speechInit, initArg: { voices: ALLV } });
  const tp = tt.page;
  await tp.evaluate(() => { localStorage.setItem('learn.pk.v1', JSON.stringify({ mute: true, last: { english: ['k1', 'k2'] } })); window.__pkSeed = 31; });
  await tp.evaluate(() => (location.hash = '#/english/pk/play')); await tp.waitForSelector('#pk-stage'); await tp.reload(); await tp.waitForSelector('#pk-stage');
  const cdp = await tt.ctx.newCDPSession(tp);
  const where = (side, i) => tp.evaluate(([a, b]) => { const r = document.querySelector(`.pk-panel[data-side="${a}"] .pk-opt[data-i="${b}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [side, i]);
  const fingers = async (pts, ts) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts.map((q2, i) => ({ x: q2.x, y: q2.y, id: i + 1 })), ...(ts ? { timestamp: ts } : {}) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const S2 = () => tp.evaluate(() => window.__pk.state());
  const toQ = async () => { for (let i = 0; i < 60; i++) { const st = await S2(); if (st.phase === 'question') return st; await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); }); await tp.waitForTimeout(20); } throw new Error('no question'); };
  let st = await toQ();
  await fingers([await where(1, st.items[1].answers[0])]);
  st = await S2();
  ok(st.scores.join() === '0,1' && st.winner === 1, 'a real touch on the turned half\'s right option scores for player 2');
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ();
  const wrong = (side) => [0, 1, 2, 3].find((i) => !st.items[side].answers.includes(i));
  await fingers([await where(0, wrong(0))]); st = await S2();
  ok(st.locked.join() === 'true,false', 'a wrong real touch locks player 1 only');
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ();
  const a = await where(0, st.items[0].answers[0]), b = await where(1, st.items[1].answers[0]), before = (await S2()).scores.slice();
  await fingers([b, a]);
  st = await S2();
  ok(st.scores[0] + st.scores[1] === before[0] + before[1] + 1 && st.scores[1] === before[1] + 1, 'two fingers down together, one on each half, both on the right option: one point, to the touch that arrived first');
  // the same with the stage TURNED by 90 degrees (a landscape screen, 1180 x 820): real touches on the turned buttons land on the right choice
  await tp.setViewportSize({ width: 1180, height: 820 }); await tp.waitForTimeout(200);
  ok(await tp.evaluate(() => document.querySelector('#pk-stage').classList.contains('rot') && /matrix\(0, 1, -1, 0/.test(getComputedStyle(document.querySelector('#pk-stage')).transform)), 'landscape 1180 x 820: the stage is turned by 90 degrees');
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ();
  let sc0 = (await S2()).scores.slice();
  await fingers([await where(0, st.items[0].answers[0])]); st = await S2();
  ok(st.scores[0] === sc0[0] + 1 && st.winner === 0, 'turned stage: a real touch on the right option of the bottom half (player 1) scores for player 1');
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ(); sc0 = st.scores.slice();
  await fingers([await where(1, st.items[1].answers[0])]); st = await S2();
  ok(st.scores[1] === sc0[1] + 1 && st.winner === 1, 'turned stage: a real touch on the top half (turned 180 degrees inside the turned stage) scores for player 2');
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ();
  await fingers([await where(1, [0, 1, 2, 3].find((i) => !st.items[1].answers.includes(i)))]); st = await S2();
  ok(st.locked.join() === 'false,true', 'turned stage: a wrong real touch locks player 2 only');
  ok(await tp.evaluate(() => devicePixelRatio === 2), 'the touch checks ran at device pixel ratio 2');
  ok(tt.log.external.length === 0, 'touch session: no outside request');
  await tt.browser.close();
  await done();
})();
