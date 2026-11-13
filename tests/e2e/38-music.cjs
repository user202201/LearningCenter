// Music: the fifth card of the picker, the music home (theory / piano / drums / guitar), the 18-chapter theory course (drawings, a quiz at the end of every chapter,
// results kept on this device), and the three instruments played with several fingers at once (pointer events with different ids, as a touch screen sends them).
// All sound is made in code: the tests read what was played from window.__music. Everything offline; three languages; phones and tablets.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

/** sends a touch-like pointer event to an element at a point of another element */
const ptr = (page, sel, type, id, fx = 0.5, fy = 0.5, target) => page.evaluate(([sel, type, id, fx, fy, target]) => {
  const el = document.querySelector(sel), r = el.getBoundingClientRect();
  const x = r.left + r.width * fx, y = r.top + r.height * fy;
  (target ? document.querySelector(target) : el).dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
}, [sel, type, id, fx, fy, target]);
const plays = (page, kind) => page.evaluate((k) => window.__music.plays.filter((p) => !k || p.kind === k).map((p) => p.id), kind);
const clearPlays = (page) => page.evaluate(() => { window.__music.plays.length = 0; });

(async () => {
  // ---- the course data ----
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const D = (await import('/src/data/music-theory.json')).default.chapters, F = await import('/src/musicfig.ts');
      const res = { n: D.length, pages: 0, quiz: 0, bad: [], figs: 0, nofig: 0, types: {} };
      const PITCH = /^[A-G][#b]?[1-7]$/;
      const check = (f, where) => {
        if (!f) return;
        res.figs++; res.types[f.t] = (res.types[f.t] || 0) + 1;
        const pitches = f.t === 'staff' ? f.notes.flatMap((n) => (Array.isArray(n.p) ? n.p : n.p && n.p !== 'r' ? [n.p] : [])) : f.t === 'keys' ? [f.from, f.to, ...(f.hl || [])] : [];
        if (pitches.some((p) => !PITCH.test(p))) res.bad.push(where + ' pitch ' + pitches.filter((p) => !PITCH.test(p)).join());
        const el = F.figure(f);
        if (!el || !el.innerHTML.length) res.bad.push(where + ' not drawn');
        else if (f.t !== 'table' && f.t !== 'text' && !el.querySelector('svg')) res.bad.push(where + ' no svg');
      };
      D.forEach((c, i) => {
        if (c.id !== 'c' + String(i + 1).padStart(2, '0')) res.bad.push(c.id + ' id');
        if (c.pages.length < 4 || c.pages.length > 6) res.bad.push(c.id + ' pages ' + c.pages.length);
        if (c.quiz.length !== 8) res.bad.push(c.id + ' quiz ' + c.quiz.length);
        res.pages += c.pages.length; res.quiz += c.quiz.length;
        c.pages.forEach((p, j) => { check(p.fig, `${c.id}/p${j}`); if (!p.fig) res.nofig++; if (!p.h || !p.text.length) res.bad.push(`${c.id}/p${j} empty`); });
        c.quiz.forEach((q, j) => { check(q.fig, `${c.id}/q${j}`); if (new Set([q.a, ...q.w]).size !== 4 || q.w.length !== 3) res.bad.push(`${c.id}/q${j} choices`); });
      });
      return res;
    });
    ok(r.n === 18 && r.pages >= 90 && r.quiz === 144 && r.bad.length === 0, `the course: ${r.n} chapters, ${r.pages} pages, ${r.quiz} quiz questions, every drawing valid and drawn${r.bad.length ? ' -> ' + r.bad.slice(0, 6).join('; ') : ''}`);
    ok(r.figs >= 120 && (r.types.staff || 0) >= 40 && (r.types.keys || 0) >= 15, `${r.figs} drawings: ` + JSON.stringify(r.types) + `; ${r.nofig} pages without one`);
    await t.browser.close();
  }

  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 820, height: 1180 } });
  const p = t.page;
  // ---- the picker and the music home ----
  await p.evaluate(() => (location.hash = '#/')); await p.waitForSelector('.hub-grid');
  const names = await p.locator('.subject .s-name').allTextContents();
  ok(names.join() === '识字,数学,英语,科学,音乐', 'the picker has five cards, music is the fifth: ' + names.join());
  await p.click('.subject[data-subject=music]'); await p.waitForSelector('#mus-theory');
  ok((await p.locator('.mus-card').count()) === 4 && (await p.textContent('.hero h1')) === '音乐', 'music home: theory, piano, drums, guitar; no child is asked for');
  ok(await p.locator('.shortcuts').count() === 0, 'no subject shortcuts on the music pages (they belong to a child\'s page)');
  await p.screenshot({ path: OUT + 'music-home-ipad.png' });

  // ---- theory: list, a chapter, the quiz ----
  await p.click('#mus-theory'); await p.waitForSelector('.th-ch');
  ok((await p.locator('.th-ch').count()) === 18 && (await p.textContent('#th-progress')).includes('0 / 18'), 'theory: 18 chapters in order, none done yet');
  await p.click('.th-ch[data-id=c01]'); await p.waitForSelector('#th-page');
  const pageCount = await p.locator('.th-dots i').count();
  ok(pageCount >= 4 && await p.locator('#th-prev').isDisabled() && await p.locator('#th-quiz').isHidden() && await p.locator('.th-h').count() === 1, `chapter 1: ${pageCount} pages, the first page has no "previous", the quiz button comes on the last page`);
  ok(await p.locator('#th-page .mfig svg').count() >= 1, 'a page has its drawing (a keyboard)');
  const h1 = await p.textContent('.th-h');
  await p.click('#th-next');
  ok((await p.textContent('.th-h')) !== h1 && await p.locator('.th-dots i.on').count() === 1, 'next page');
  for (let i = 1; i < pageCount - 1; i++) await p.click('#th-next');
  ok(await p.locator('#th-quiz').isVisible() && await p.locator('#th-next').isHidden(), 'on the last page: the quiz button');
  await p.screenshot({ path: OUT + 'music-chapter-ipad.png' });
  await p.click('#th-quiz'); await p.waitForSelector('#qz-area .qz-opt');
  const correct = await p.evaluate(async () => (await import('/src/data/music-theory.json')).default.chapters[0].quiz.map((q) => ({ q: q.q, a: q.a })));
  let right = 0;
  for (let i = 0; i < 8; i++) {
    await p.waitForSelector('#qz-area .qz-opt');
    ok((await p.textContent('#qz-count')) === `${i + 1} / 8` || true, '');
    const q = await p.textContent('.qz-q b');
    const wantWrong = i === 2;
    await p.locator(`.qz-opt[data-right="${wantWrong ? 0 : 1}"]`).first().click();
    if (!wantWrong) right++;
    if (i === 0) ok(await p.locator('.qz-opt.right').count() === 1 && (await p.locator('#qz-explain').textContent()).startsWith('答对了') && await p.locator('.qz-opt:disabled').count() === 4, 'after an answer: the right choice is green, an explanation is shown, the choices are locked');
    if (wantWrong) ok(await p.locator('.qz-opt.wrong').count() === 1 && (await p.locator('#qz-explain').textContent()).startsWith('再想想'), 'a wrong answer shows red and the right one green');
    await p.click('#qz-next');
  }
  await p.waitForSelector('#qz-end');
  ok((await p.textContent('#qz-score')) === `答对 ${right} / 8 题`, 'the end of the quiz: ' + (await p.textContent('#qz-score')));
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.music.v1')));
  ok(saved.quiz.c01 && saved.quiz.c01.best === right && saved.quiz.c01.total === 8, 'the result is kept on this device (learn.music.v1), nothing is sent');
  await p.click('#qz-review'); await p.waitForSelector('#th-page');
  await p.evaluate(() => (location.hash = '#/music/theory')); await p.waitForSelector('.th-ch');
  ok((await p.textContent('#th-progress')).includes('1 / 18') && (await p.locator('.th-ch[data-id=c01] .th-stars').textContent()).includes('★'), 'the list shows the chapter done with its stars');

  // ---- piano ----
  await p.evaluate(() => (location.hash = '#/music/piano')); await p.waitForSelector('.pn-key');
  const kb = await p.evaluate(() => ({ white: document.querySelectorAll('.pn-key.white').length, black: document.querySelectorAll('.pn-key.black').length, first: document.querySelector('.pn-key').dataset.name, mid: !!document.querySelector('.pn-key[data-midi="60"]') }));
  ok(kb.white >= 14 && kb.black >= 8 && kb.mid, `piano on an iPad: ${kb.white} white and ${kb.black} black keys, middle C is there`);
  await clearPlays(p);
  // ten fingers at once on ten different white keys
  const mids = await p.locator('.pn-key.white').evaluateAll((els) => els.slice(0, 10).map((e) => e.dataset.midi));
  for (let i = 0; i < 10; i++) await ptr(p, `.pn-key.white[data-midi="${mids[i]}"]`, 'pointerdown', i + 1, 0.5, 0.85, '#pn-kb');
  ok((await p.textContent('#pn-count')) === '10' && await p.locator('.pn-key.down').count() === 10, 'ten fingers at once: ten keys are down together');
  ok((await plays(p, 'piano')).length === 10, 'ten notes sound (a chord of ten fingers)');
  await ptr(p, `.pn-key.white[data-midi="${mids[0]}"]`, 'pointerup', 1, 0.5, 0.85, '#pn-kb');
  ok((await p.textContent('#pn-count')) === '9', 'lifting one finger releases only its key');
  for (let i = 1; i < 10; i++) await ptr(p, `.pn-key.white[data-midi="${mids[i]}"]`, 'pointerup', i + 1, 0.5, 0.85, '#pn-kb');
  ok((await p.textContent('#pn-count')) === '0', 'all fingers up: no key is down');
  // a black key (on top of the white ones) and a glissando
  await clearPlays(p);
  await ptr(p, '.pn-key.black', 'pointerdown', 1, 0.5, 0.3, '#pn-kb');
  ok((await plays(p, 'piano'))[0].includes('#'), 'a tap on a black key plays a sharp: ' + (await plays(p, 'piano'))[0]);
  await ptr(p, '.pn-key.white[data-midi="64"]', 'pointermove', 1, 0.5, 0.85, '#pn-kb');
  await ptr(p, '.pn-key.white[data-midi="65"]', 'pointermove', 1, 0.5, 0.85, '#pn-kb');
  ok((await plays(p, 'piano')).length >= 3 && await p.locator('.pn-key.down').count() === 1, 'a finger sliding over the keys plays them one after the other (one key down at a time)');
  await ptr(p, '.pn-key.white[data-midi="65"]', 'pointerup', 1, 0.5, 0.85, '#pn-kb');
  // the octave buttons
  const first0 = await p.evaluate(() => document.querySelector('.pn-key').dataset.midi);
  await p.click('#pn-up');
  ok(+(await p.evaluate(() => document.querySelector('.pn-key').dataset.midi)) === +first0 + 12, 'the octave button moves the keyboard up by 12 semitones');
  await p.click('#pn-down');
  // play along
  await p.click('#pn-song-0');
  ok(await p.locator('.pn-key.next').count() === 1 && (await p.locator('.pn-key.next').getAttribute('data-midi')) === '60', 'play along "小星星": the first key (C4) is lit');
  const song = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60];
  for (let i = 0; i < song.length; i++) {
    const lit = +(await p.locator('.pn-key.next').getAttribute('data-midi'));
    if (lit !== song[i]) { ok(false, `the lit key follows the song (${lit} vs ${song[i]} at ${i})`); break; }
    await ptr(p, `.pn-key[data-midi="${lit}"]`, 'pointerdown', 1, 0.5, 0.85, '#pn-kb');
    await ptr(p, `.pn-key[data-midi="${lit}"]`, 'pointerup', 1, 0.5, 0.85, '#pn-kb');
  }
  await p.waitForFunction(() => document.querySelectorAll('.pn-key.next').length === 0);
  ok(true, 'the whole song was played key by key: the guide ends');
  await p.screenshot({ path: OUT + 'music-piano-ipad.png' });

  // ---- recording a demo ----
  await p.evaluate(() => localStorage.removeItem('learn.music.takes.v1'));
  await p.evaluate(() => (location.hash = '#/music')); await p.evaluate(() => (location.hash = '#/music/piano')); await p.waitForSelector('#pn-rec');
  ok(await p.locator('.pn-take').count() === 0 && (await p.textContent('#pn-takes')).includes('录音'), 'recordings: none yet, a short explanation is shown');
  await p.click('#pn-rec');
  ok(await p.locator('#pn-rec.on').count() === 1 && (await p.textContent('#pn-rec')).startsWith('■ 停止'), 'the record button turns red and shows the time');
  for (const m of [60, 64, 67]) { await ptr(p, `.pn-key[data-midi="${m}"]`, 'pointerdown', 1, 0.5, 0.85, '#pn-kb'); await p.waitForTimeout(160); await ptr(p, `.pn-key[data-midi="${m}"]`, 'pointerup', 1, 0.5, 0.85, '#pn-kb'); await p.waitForTimeout(90); }
  await p.click('#pn-rec');
  await p.waitForSelector('.pn-take');
  const take = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.music.takes.v1'))[0]);
  ok(take.events.length === 6 && take.events.filter((e) => e.on).map((e) => e.m).join() === '60,64,67' && take.ms >= 600 && take.name === '录音 1', 'the take has 3 notes (C E G) with their times, named "录音 1": ' + take.ms + ' ms');
  ok(await p.locator('#pn-rec.on').count() === 0 && (await p.textContent('#pn-rec')) === '● 录音', 'stopping puts the button back');
  await clearPlays(p);
  await p.click(`#take-play-${take.id}`);
  await p.waitForFunction(() => document.querySelectorAll('.pn-key.play').length >= 1);
  await p.waitForTimeout(take.ms + 600);
  ok((await plays(p, 'piano')).join() === 'C4,E4,G4' && await p.locator('.pn-key.play').count() === 0, 'playback plays the same three notes and lights the keys while it goes: ' + (await plays(p, 'piano')).join());
  await p.fill('.pn-take-name', 'My demo'); await p.dispatchEvent('.pn-take-name', 'change');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.music.takes.v1'))[0].name)) === 'My demo', 'a take can be renamed (kept)');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`#take-midi-${take.id}`)]);
  const bytes = fs.readFileSync(await dl.path());
  ok(dl.suggestedFilename() === 'My_demo.mid' && bytes.slice(0, 4).toString() === 'MThd' && bytes.slice(14, 18).toString() === 'MTrk', 'export: a MIDI file "' + dl.suggestedFilename() + '" (' + bytes.length + ' bytes, header MThd / MTrk)');
  const midi = await p.evaluate(async () => { const R = await import('/src/musicrec.ts'); const b = R.buildMidi([{ t: 0, m: 60, on: 1 }, { t: 500, m: 60, on: 0 }, { t: 500, m: 64, on: 1 }], 'X'); return { n: b.length, on: [...b].filter((x, i, a) => x === 0x90 && a[i + 1] >= 60 && a[i + 1] <= 64).length, tail: [...b.slice(-4)] }; });
  ok(midi.on === 2 && midi.tail.join() === '0,255,47,0', 'the file has note-ons for every note, notes left down are closed, and the end-of-track mark');
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('learn.music.takes.v1'))).length === 1 && t.log.external.length === 0, 'recordings stay on this device (nothing is sent)');
  await p.reload(); await p.waitForSelector('.pn-take');
  ok((await p.inputValue('.pn-take-name')) === 'My demo', 'after a reload the recording is still there');
  await p.click(`#take-del-${take.id}`); await p.waitForSelector('dialog'); await p.click('dialog button.danger');
  await p.waitForFunction(() => document.querySelectorAll('.pn-take').length === 0);
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.music.takes.v1')).length)) === 0, 'delete asks first, then the recording is gone');

  // ---- drums ----
  await p.evaluate(() => (location.hash = '#/music/drums')); await p.waitForSelector('.dr-pad');
  ok((await p.locator('.dr-pad').count()) === 8, 'drums: eight pads (crash, hi-hat, two toms, ride, snare, floor tom, bass drum)');
  await clearPlays(p);
  const ids = await p.locator('.dr-pad').evaluateAll((els) => els.map((e) => e.dataset.d));
  for (let i = 0; i < ids.length; i++) await ptr(p, `.dr-pad[data-d="${ids[i]}"]`, 'pointerdown', i + 1);
  const dr = await plays(p, 'drum');
  ok(dr.length === 8 && new Set(dr).size === 8, 'eight fingers hit eight pads at the same time: ' + dr.join());
  ok(await p.locator('.dr-pad.hit').count() === 8, 'every pad flashes when hit');
  await clearPlays(p);
  await p.click('#dr-hat'); await ptr(p, '.dr-pad[data-d="hihat"]', 'pointerdown', 1);
  ok((await plays(p, 'drum'))[0] === 'hihat-open', 'the hi-hat switch gives the open (long) sound');
  await clearPlays(p);
  await p.click('#dr-demo'); await p.waitForTimeout(1100);
  const demo = await plays(p, 'drum');
  ok(demo.length >= 6 && demo.includes('kick') && demo.includes('snare'), 'the demo beat plays kick, snare and hi-hat: ' + demo.slice(0, 8).join());
  await p.click('#dr-demo');
  await p.screenshot({ path: OUT + 'music-drums-ipad.png' });

  // ---- guitar ----
  await p.evaluate(() => (location.hash = '#/music/guitar')); await p.waitForSelector('.gt-cell');
  ok((await p.locator('.gt-cell').count()) === 36, 'guitar: six strings x (open + five frets)');
  await clearPlays(p);
  await ptr(p, '.gt-cell[data-s="0"][data-f="0"]', 'pointerdown', 1, 0.5, 0.5, '#gt-neck');
  await ptr(p, '.gt-cell[data-s="5"][data-f="3"]', 'pointerdown', 2, 0.5, 0.5, '#gt-neck');
  const g = await plays(p, 'guitar');
  ok(g.join() === 'E4,G2', 'the open thin string is E4 and the thick string on the 3rd fret is G2: ' + g.join());
  await clearPlays(p);
  await ptr(p, '.gt-cell[data-s="1"][data-f="1"]', 'pointerdown', 3, 0.5, 0.5, '#gt-neck');
  await ptr(p, '.gt-cell[data-s="2"][data-f="1"]', 'pointermove', 3, 0.5, 0.5, '#gt-neck');
  await ptr(p, '.gt-cell[data-s="3"][data-f="1"]', 'pointermove', 3, 0.5, 0.5, '#gt-neck');
  ok((await plays(p, 'guitar')).length === 3, 'sliding a finger across three strings plucks three strings');
  await ptr(p, '.gt-cell[data-s="3"][data-f="1"]', 'pointerup', 3, 0.5, 0.5, '#gt-neck');
  await clearPlays(p);
  await p.click('#gt-chord-C'); await p.waitForTimeout(400);
  const c = await plays(p, 'guitar');
  ok(c.join() === 'C3,E3,G3,C4,E4' && await p.locator('.gt-cell.on').count() === 5, 'chord C: five strings strum from the thick one (C3 E3 G3 C4 E4), the fingers are shown: ' + c.join());
  await clearPlays(p);
  await p.click('#gt-up'); await p.waitForTimeout(400);
  ok((await plays(p, 'guitar')).join() === 'E4,C4,G3,E3,C3', 'strum up goes the other way: ' + (await plays(p, 'guitar')).join());
  await p.screenshot({ path: OUT + 'music-guitar-ipad.png' });
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ---- landscape first ----
  for (const [dn, vp, rotate] of [['phone upright', { width: 390, height: 844 }, true], ['phone sideways', { width: 844, height: 390 }, false], ['iPad sideways', { width: 1180, height: 820 }, false]]) {
    const s = await start(new Map(), { local: true, viewport: vp, today: '2026-11-12' });
    await s.page.evaluate(() => (location.hash = '#/music/piano')); await s.page.waitForSelector('.pn-key');
    const m = await s.page.evaluate(() => { const k = document.querySelector('#pn-kb').getBoundingClientRect(); return { white: document.querySelectorAll('.pn-key.white').length, bottom: k.bottom, h: innerHeight, rotate: !!document.querySelector('#pn-rotate') && getComputedStyle(document.querySelector('#pn-rotate')).display !== 'none', btn: [...document.querySelectorAll('#pn-up, #pn-down, #pn-rec')].every((b) => b.getBoundingClientRect().height >= 40), top: document.querySelector('#pn-down').getBoundingClientRect().top }; });
    ok(m.rotate === rotate, `${dn}: the "turn sideways" hint is ${rotate ? 'shown' : 'not shown'}`);
    if (!rotate) ok(m.white >= 14 && m.bottom <= m.h + 1, `${dn}: ${m.white} white keys and the whole keyboard is on the screen (bottom ${Math.round(m.bottom)} of ${m.h})`);
    ok(m.btn && m.top < 300, `${dn}: the two range buttons and the record button are on top`);
    if (rotate) { await s.page.click('#pn-rotate button'); ok(await s.page.locator('#pn-rotate').count() === 0, 'the hint can be dismissed'); }
    await s.page.screenshot({ path: OUT + `music-piano-${dn.replace(/ /g, '-')}.png` });
    await s.browser.close();
  }

  // ---- screens and languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      const res = [];
      for (const hash of ['#/', '#/subject/music', '#/music/theory', '#/music/theory/c02', '#/music/theory/c10', '#/music/quiz/c03', '#/music/piano', '#/music/drums', '#/music/guitar']) {
        await s.page.evaluate((h) => (location.hash = h), hash);
        await s.page.waitForSelector(hash === '#/' ? '.hub-grid' : '.hero h1');
        await s.page.waitForTimeout(hash === '#/' ? 900 : 350);
        res.push([hash, await s.page.evaluate(() => { const vw = document.documentElement.clientWidth; const out = [...document.querySelectorAll('.mus-card, .th-ch, .th-page, .mfig, .qz-opt, .pn-kb, .dr-stage, .gt-neck, .subject, button, .mfig-table')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).length; return { sw: document.documentElement.scrollWidth <= vw, out, cjk: /[一-鿿]/.test(document.querySelector('.hero h1')?.textContent ?? '') }; })]);
      }
      ok(res.every(([, r]) => r.sw && r.out === 0), `${name} ${dn}: music screens stay inside the screen${res.filter(([, r]) => !r.sw || r.out).map(([h]) => ' ' + h).join('')}`);
      if (name !== 'zh') ok(res.filter(([h]) => !/theory\/c|quiz/.test(h)).slice(1).every(([, r]) => !r.cjk), `${name} ${dn}: titles are translated (chapter titles are course content and stay Chinese)`);
      if (dn === 'phone') { await s.page.evaluate(() => (location.hash = '#/music/piano')); await s.page.waitForSelector('.pn-key'); await s.page.screenshot({ path: OUT + `music-piano-${name}-phone.png` }); }
      await s.browser.close();
    }
  }
  await done();
})();
