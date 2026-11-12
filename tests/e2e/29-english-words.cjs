// English, part 1 (the words): the same screens as 识字 (children -> a child with Game | This week | Recorded), 20 words a week picked by the child's grade,
// word + phonetics + meaning, the game (shared rules; the word as text, a tap shows the meaning), data kept in english/<kid>.json (not in the Chinese files),
// the grade asked ONCE (and remembered, goes up every September), a grade of its own for a child, English / French, small and large screens.
const { start, checks, addKid, setGrade, openManage, manageOff } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const keyOf = (s) => s.toLowerCase();

/** opens English -> the child, waiting for the week to be generated */
const openEnglish = async (page, name) => {
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await page.click('.subject[data-subject=english]'); await page.waitForSelector('.kids, .empty-home');
  if (name) { await page.click(`.kid:has-text("${name}")`); await page.waitForSelector('.wrow, .empty'); }
};

(async () => {
  // ---- the grade belongs to each CHILD: asked the first time a child is opened, changed in Settings, goes up in September ----
  {
    const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
    const { page } = t;
    ok(await page.locator('#grade-dlg').count() === 0 && await page.locator('#hub-grade').count() === 0, 'the subject picker asks nothing and has no grade button (the grade is not a question for everybody)');
    await page.click('button.back'); await page.waitForSelector('.hub-grid');
    await page.click('.subject[data-subject=english]'); await page.waitForSelector('.empty-home');
    ok(await page.locator('#grade-dlg').count() === 0, 'English with no child yet: no grade question either');
    await page.evaluate(() => (location.hash = '#/chinese')); await page.waitForSelector('.empty-home');
    await addKid(page, 'Dory'); await addKid(page, 'Leo');
    await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
    await page.click('.subject[data-subject=english]'); await page.waitForSelector('.kids');
    ok((await page.locator('.kid .ksub').allTextContents()).every((x) => x.includes('未选年级')), 'English list: no child has a grade yet (未选年级), nothing is assumed (not grade 3)');
    // the first time a child is opened: the question, for THAT child
    await page.click('.kid:has-text("Dory")'); await page.waitForSelector('#grade-dlg');
    ok((await page.textContent('#grade-dlg h2')).includes('Dory') && (await page.locator('#grade-dlg .grade-btn').allTextContents()).join() === '一年级,二年级,三年级,四年级,五年级,六年级,初一,初二,初三', 'opening Dory the first time: "Dory读几年级？" with 9 buttons (primary 1-6, junior high 1-3)');
    ok(await page.locator('#grade-dlg .grade-btn.on').count() === 0, 'nothing is marked: no default');
    await page.click('#grade-dlg button >> text=取消');
    await page.waitForSelector('.kids');
    ok((await page.evaluate(() => location.hash)) === '#/subject/english' && (await page.locator('.kid .ksub').first().textContent()).includes('未选年级') && await page.locator('.toast').count() === 0, 'cancelling goes back to the list, nothing is saved, no message');
    await page.click('.kid:has-text("Dory")'); await page.waitForSelector('#grade-dlg');
    await page.click('.grade-btn[data-grade="3"]'); await page.waitForSelector('.wrow');
    ok((await page.textContent('#grade-btn')).includes('三年级'), 'Dory: 三年级 chosen, the week is made for it');
    await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
    const subs = await page.locator('.kid .ksub').allTextContents();
    ok(subs[0].includes('三年级') && subs[1].includes('未选年级'), "each child has his own grade: Dory 三年级, Leo still 未选年级 (" + subs.join(' / ') + ')');
    await page.click('.kid:has-text("Leo")'); await page.waitForSelector('#grade-dlg');
    ok((await page.textContent('#grade-dlg h2')).includes('Leo'), 'Leo is asked on his own');
    await page.click('#grade-dlg button >> text=取消'); await page.waitForSelector('.kids');
    // Settings -> manage mode -> Children: a grade button on every child, the window marks the current grade
    await openManage(page);
    ok(await page.locator('.kidrow .kid-grade').count() === 2, 'Settings (manage mode) -> Children: a 年级 button for every child');
    await page.click('.kidrow:has-text("Dory") .kid-grade'); await page.waitForSelector('#grade-dlg');
    ok(await page.locator('#grade-dlg .grade-btn.on').getAttribute('data-grade') === '3', 'it shows the current grade marked (三年级)');
    await page.click('.grade-btn[data-grade="7"]'); await page.waitForSelector('#grade-dlg', { state: 'detached' });
    await page.click('.kidrow:has-text("Leo") .kid-grade'); await page.waitForSelector('#grade-dlg'); await page.click('.grade-btn[data-grade="5"]'); await page.waitForSelector('#grade-dlg', { state: 'detached' });
    await manageOff(page);
    await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
    const subs2 = await page.locator('.kid .ksub').allTextContents();
    ok(subs2[0].includes('初一') && subs2[1].includes('五年级'), 'changed in Settings: Dory 初一, Leo 五年级 (' + subs2.join(' / ') + ')');
    await page.click('.kid:has-text("Leo")'); await page.waitForSelector('.wrow');
    ok(await page.locator('#grade-dlg').count() === 0, 'a child with a grade is not asked again (also after a reload)');
    await page.reload(); await page.waitForSelector('.wrow');
    ok(await page.locator('#grade-dlg').count() === 0, 'and not after a reload');
    // the grade goes up by itself every September: calculated from the day it was set
    const calc = await page.evaluate(async () => {
      const P = await import('/src/profile.ts');
      const at = (grade, setOn, now) => P.advance({ grade, setOn }, new Date(now));
      return [at(5, '2026-11-12', '2026-11-12'), at(5, '2026-11-12', '2027-08-31'), at(5, '2026-11-12', '2027-09-01'), at(5, '2026-11-12', '2028-09-15'), at(3, '2026-08-31', '2026-09-01'), at(8, '2026-11-12', '2030-01-01'), at(1, '2026-11-12', '2025-01-01')];
    });
    ok(calc.join() === '5,5,6,7,4,9,1', 'the grade goes up on 1 September only (' + calc.join(',') + '), never past 初三, never down');
    const id = await page.evaluate(() => location.hash.split('/')[2]);
    await page.evaluate((i) => localStorage.setItem('learn.profile.v1', JSON.stringify({ kids: { [i]: { grade: 2, setOn: '2025-10-01' } } })), id);
    await page.reload(); await page.waitForSelector('.wrow');
    ok((await page.textContent('#grade-btn')).includes('三年级'), 'a grade chosen last school year (二年级) is 三年级 now, without asking');
    await t.browser.close();
  }

  // ---- the words ----
  const store = new Map();
  const { browser, page, log } = await start(store, { today: '2026-11-12', viewport: { width: 390, height: 844 } });
  await addKid(page, 'Dory'); await addKid(page, 'Leo');
  await setGrade(page, 'Dory', 3); await setGrade(page, 'Leo', 3);   // (the way a user does it: Settings -> Children)
  await openEnglish(page);
  ok((await page.locator('.kid').count()) === 2 && (await page.locator('.kid .ksub').first().textContent()).includes('三年级'), 'English: the list of children with each one\'s grade (三年级)');
  ok(await page.locator('.hero h1').textContent() === '英语', 'English: its own title');
  await page.click('.kid:has-text("Dory")'); await page.waitForSelector('.wrow');
  const week1 = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(week1.length === 20 && new Set(week1.map(keyOf)).size === 20, 'this week: exactly 20 different words (' + week1.slice(0, 5).join(' ') + ' …)');
  const lib = await page.evaluate(async () => (await import('/src/data/english-words.json')).default.words);
  const g = Object.fromEntries(lib.map((x) => [keyOf(x.w), x.g]));
  ok(week1.filter((w) => g[keyOf(w)] === 3).length === 12 && week1.every((w) => g[keyOf(w)] <= 3), 'the grade is the child\'s HIGHEST level: 12 of the 20 words are of grade 3, the other 8 of the lower grades (consolidation): grades ' + week1.map((w) => g[keyOf(w)]).join(''));
  ok(await page.locator('.wrow .wword').first().textContent() === week1[0] && (await page.locator('.wrow .wzh').first().textContent()).length > 0 && await page.locator('.wrow .wph').count() > 10, 'each row shows the word, its phonetics and its meaning');
  const files = [...store.keys()];
  ok(files.includes('english/' + (await page.evaluate(() => location.hash)).split('/')[2] + '.json') || files.some((f) => /^english\/[\w-]+\.json$/.test(f)), 'saved in english/<child>.json: ' + files.filter((f) => f.startsWith('english')).join(', '));
  ok(!files.some((f) => f === 'kids.json' && /english|word/i.test(store.get(f))), "the Chinese files are not touched by the words");
  const tabs = await page.locator('.tabs button').allTextContents();
  ok(tabs.join('|') === '游戏|本周|已入库 20', 'tabs like 识字: 游戏 | 本周 | 已入库 20 (' + tabs.join('|') + ')');
  // opening again does not make a second batch
  const puts = log.puts.filter((p) => p.startsWith('english/')).length;
  await page.reload(); await page.waitForSelector('.wrow');
  ok(JSON.stringify(await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w))) === JSON.stringify(week1) && log.puts.filter((p) => p.startsWith('english/')).length === puts, 'opening the week again shows the same 20 words and writes nothing');
  // next week: 20 NEW words; the week before today stays empty
  await page.click('button[title=下一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第2周');
  const week2 = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(week2.length === 20 && week2.every((w) => !week1.map(keyOf).includes(keyOf(w))), 'next week: 20 other words (never one already recorded)');
  ok(await page.locator('button[title=下一周]').isDisabled(), 'the right arrow stops at next week');
  await page.click('button[title=上一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第1周');
  ok(await page.locator('button[title=上一周]').isDisabled(), 'the left arrow stops at the first week (nothing is made up for the past)');
  ok(JSON.stringify(await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w))) === JSON.stringify(week1), 'back to this week: the same 20 words');
  // recorded
  await page.click('[data-tab=learned]'); await page.waitForSelector('#sample-title');
  ok(await page.locator('.wrow').count() === 30 && (await page.textContent('#sample-title')) === '随机 30 个', 'Recorded: a random 30 out of the 40 recorded words');
  const shown = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(new Set(shown.map(keyOf)).size === 30 && shown.every((w) => week1.concat(week2).map(keyOf).includes(keyOf(w))), '30 different words, all of them recorded ones (from both weeks)');
  const sets = [shown.join()];
  for (let i = 0; i < 3; i++) { await page.click('#reshuffle'); sets.push((await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w))).join()); }
  ok(new Set(sets).size >= 3, 'the shuffle button gives other words each time');
  ok((await page.locator('.tabs button').nth(2).textContent()) === '已入库 40', 'the tab counts all of them (已入库 40)');
  // each child has his own words
  await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
  await page.click('.kid:has-text("Leo")'); await page.waitForSelector('.wrow');
  const leo = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(JSON.stringify(leo) === JSON.stringify(week1), 'another child starts at the beginning for his grade (the words are per child)');
  // the grade can also be changed from the child's own page
  await page.click('#grade-btn'); await page.waitForSelector('#grade-dlg');
  ok(await page.locator('.grade-btn.on').getAttribute('data-grade') === '3', 'the grade link on the child\'s page opens the window with the current grade marked');
  await page.click('.grade-btn[data-grade="7"]'); await page.waitForSelector('#grade-dlg', { state: 'detached' });
  await page.waitForFunction(() => document.querySelector('#grade-btn')?.textContent.includes('初一'));
  ok((await page.textContent('#grade-btn')).includes('初一'), 'Leo changed to 初一');
  await page.waitForFunction((w0) => document.querySelector('.wrow')?.dataset.w !== w0, week1[0]);
  const leoNew = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(leoNew.length === 20 && leoNew.filter((w) => g[keyOf(w)] === 7).length === 12 && leoNew.every((w) => g[keyOf(w)] <= 7) && leoNew.every((w) => !week1.includes(w)), "changing the grade (三年级 -> 初一) picks THIS week's words again for the new grade (12 of grade 7, 8 of lower grades): " + leoNew.slice(0, 4).join(' ') + ' …');
  await page.click('button[title=下一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第2周');
  ok((await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w))).filter((w) => g[keyOf(w)] === 7).length >= 10, "and next week's words too (mostly grade 7)");
  await page.click('button[title=上一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第1周');
  await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
  const subs = await page.locator('.kid .ksub').allTextContents();
  ok(subs.some((s) => s.includes('初一')) && subs.some((s) => s.includes('三年级')), 'the list shows each child\'s grade: ' + subs.join(' / '));
  await page.click('.kid:has-text("Leo")'); await page.waitForSelector('.wrow');
  await page.click('button[title=下一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第2周');
  const leo2 = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(leo2.filter((w) => g[keyOf(w)] === 7).length >= 10 && leo2.every((w) => g[keyOf(w)] <= 7), 'words are picked for the grade at the moment the week is made (next week: ' + [...new Set(leo2.map((w) => g[keyOf(w)]))].join() + ')');
  await page.screenshot({ path: OUT + 'english-week-phone.png' });

  // ---- the game ----
  await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids'); await page.click('.kid:has-text("Dory")'); await page.waitForSelector('.wrow');
  await page.click('#tab-game'); await page.waitForSelector('#game-start');
  ok(await page.locator('#game-start').isEnabled(), 'Game tab: ready + start (like 识字)');
  await page.click('#game-start'); await page.waitForSelector('#game-char');
  ok(await page.locator('#game.words').count() === 1, 'the game runs in words mode');
  const q1 = await page.textContent('#game-char');
  ok(week1.includes(q1), 'it asks one of this week\'s words: ' + q1);
  const meaning = await page.evaluate(() => document.querySelector('#game-py').textContent);
  ok(meaning.length > 0 && !/^[a-zɑ-ɿ:ˈ]+$/i.test(meaning), 'a tap shows the meaning, not pinyin: ' + meaning);
  ok(await page.locator('#game-speak').count() === 1, 'there is a speaker button');
  const fit = await page.evaluate(() => { const c = document.querySelector('#game-char').getBoundingClientRect(), d = document.querySelector('#game-dial').getBoundingClientRect(); return c.left >= d.left && c.right <= d.right; });
  ok(fit, 'the word stays inside the ring');
  const longest = lib.map((x) => x.w).sort((x, y) => y.length - x.length).slice(0, 25).concat(['table tennis', 'responsibility', 'internationalization', 'WWWWWWWWWWWW']);
  const bad = await page.evaluate(async (list) => {
    const { fitWord } = await import('/src/gameui.ts');
    const ch = document.querySelector('#game-char'), dial = document.querySelector('#game-dial');
    const out = [];
    for (const w of list) { ch.textContent = w; fitWord(ch); const r = ch.getBoundingClientRect(), d = dial.getBoundingClientRect(); if (r.left < d.left + 1 || r.right > d.right - 1) out.push(w + ' ' + Math.round(r.width) + '>' + Math.round(d.width)); }
    return out;
  }, longest);
  ok(bad.length === 0, 'the ' + longest.length + ' longest words of the library (and 20 letters, 12 wide W) are shown completely inside the ring' + (bad.length ? ' -> ' + bad.join(' | ') : ''));
  const sized = await page.evaluate(() => { const ch = document.querySelector('#game-char'); ch.textContent = 'school'; window.dispatchEvent(new Event('resize')); return parseFloat(getComputedStyle(ch).fontSize); });
  const small = await page.evaluate(() => { const ch = document.querySelector('#game-char'); ch.textContent = 'internationalization'; window.dispatchEvent(new Event('resize')); return parseFloat(getComputedStyle(ch).fontSize); });
  ok(small < sized * 0.7, 'a long word is set smaller than a short one (' + Math.round(small) + ' px vs ' + Math.round(sized) + ' px), a short one keeps the big size');
  await page.evaluate((w) => { const ch = document.querySelector('#game-char'); ch.textContent = w; window.dispatchEvent(new Event('resize')); }, q1);
  for (let i = 0; i < 40 && !(await page.locator('#game-end').count()); i++) { if (await page.locator('#game-right:enabled').count()) await page.click('#game-right'); await page.waitForTimeout(700); }
  await page.waitForSelector('#game-end', { timeout: 30000 });
  ok((await page.textContent('#game-final')) === '20', 'all 20 right: the score is 20 / 20');
  await page.click('#game-done'); await page.waitForSelector('.tabs');
  ok(store.has('english/' + [...store.keys()].find((k) => /^english\/[\w-]+\.review\.json$/.test(k)).split('/')[1]), 'progress saved in english/<child>.review.json');
  const rev = JSON.parse(store.get([...store.keys()].find((k) => /\.review\.json$/.test(k))));
  ok(Object.keys(rev.cards).length === 20 && Object.values(rev.cards).every((c) => c.box === 1), 'the memory boxes work as in 识字: 20 words in box 1');
  ok(!files.some((f) => /^kids\/.*review/.test(f)) && ![...store.keys()].some((f) => /^kids\/.*review/.test(f)), 'the Chinese game progress is untouched');

  // ---- the game takes the week before into account: this week's 20 + 10 random words of last week = 30; no week before = only this week ----
  {
    const store2 = new Map();
    const t = await start(store2, { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
    await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 3);
    const kidId = await t.page.evaluate(() => Object.keys(localStorage).map((k) => k).length && JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
    const lib2 = await t.page.evaluate(async () => (await import('/src/data/english-words.json')).default.words.map((x) => x.w));
    const prev = lib2.slice(0, 20);
    await t.page.evaluate(([id, list]) => localStorage.setItem('learn.local.english/' + id + '.json', JSON.stringify({ weeks: [{ start: '2026-11-01', chars: list }] })), [kidId, prev]);
    await openEnglish(t.page, 'Dory');
    const thisWeek = await t.page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
    ok(thisWeek.length === 20 && thisWeek.every((w) => !prev.includes(w)), "this week's 20 words are new (last week's are not repeated)");
    await t.page.click('#tab-game'); await t.page.click('#game-start'); await t.page.waitForSelector('#game-char');
    const asked = [];
    for (let i = 0; i < 40; i++) {
      if (await t.page.locator('#game-end').count()) break;
      await t.page.waitForSelector('#game-right:enabled', { timeout: 5000 }).catch(() => {});
      if (await t.page.locator('#game-end').count()) break;
      asked.push(await t.page.textContent('#game-char')); await t.page.click('#game-right'); await t.page.waitForTimeout(700);
    }
    await t.page.waitForSelector('#game-end', { timeout: 20000 });
    ok(asked.length === 30 && new Set(asked).size === 30, 'the game asks 30 different words (' + asked.length + ')');
    ok(thisWeek.every((w) => asked.includes(w)) && asked.filter((w) => prev.includes(w)).length === 10, "all 20 of this week + 10 of last week's words");
    await t.page.click('#game-done'); await t.browser.close();
    // no week before: this week is the first week, only its own words
    const t2 = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
    await addKid(t2.page, 'Leo'); await setGrade(t2.page, 'Leo', 3); await openEnglish(t2.page, 'Leo');
    await t2.page.click('#tab-game'); await t2.page.click('#game-start'); await t2.page.waitForSelector('#game-char');
    const asked2 = [];
    for (let i = 0; i < 25; i++) { if (await t2.page.locator('#game-end').count()) break; asked2.push(await t2.page.textContent('#game-char')); await t2.page.click('#game-right'); await t2.page.waitForTimeout(700); }
    ok(asked2.length === 20, 'no week before: the first week, only its own 20 words (' + asked2.length + ')');
    await t2.browser.close();
  }

  // ---- a child whose words were made BEFORE he had a grade (earlier version: everybody was grade 3): choosing a grade picks this week again ----
  {
    const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
    await addKid(t.page, 'Dory'); await addKid(t.page, 'Leo');
    const ids = await t.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids.map((k) => k.id));
    const lib3 = await t.page.evaluate(async () => (await import('/src/data/english-words.json')).default.words);
    const old3 = lib3.filter((x) => x.g === 3).slice(0, 20).map((x) => x.w);
    await t.page.evaluate(([list, ids]) => ids.forEach((id) => localStorage.setItem('learn.local.english/' + id + '.json', JSON.stringify({ weeks: [{ start: '2026-11-08', chars: list }] }))), [old3, ids]);
    await setGrade(t.page, 'Dory', 3); await setGrade(t.page, 'Leo', 6);
    const got = {};
    for (const n of ['Dory', 'Leo']) { await openEnglish(t.page, n); got[n] = await t.page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w)); }
    const gr = Object.fromEntries(lib3.map((x) => [keyOf(x.w), x.g]));
    ok(got.Dory.length === 20 && got.Leo.length === 20 && got.Dory.filter((w) => gr[keyOf(w)] === 3).length >= 10 && got.Dory.every((w) => gr[keyOf(w)] <= 3), 'one child 三年级, one 六年级 (old words already stored): Dory has words of grade 3 and below');
    ok(got.Leo.filter((w) => gr[keyOf(w)] === 6).length >= 10 && got.Leo.every((w) => gr[keyOf(w)] <= 6) && JSON.stringify(got.Leo) !== JSON.stringify(got.Dory), 'Leo (六年级) has words of grade 6 and below, NOT the same as Dory\'s: ' + got.Leo.slice(0, 4).join(' ') + ' vs ' + got.Dory.slice(0, 4).join(' '));
    await t.browser.close();
  }

  ok(log.external.length === 0, 'OFFLINE: English (library, weeks, game, speech) made no request outside the app and GitHub storage: ' + log.external.join(', '));

  // ---- the Chinese part is unchanged: it still has no word in it ----
  await page.evaluate(() => (location.hash = '#/chinese')); await page.waitForSelector('.kids');
  ok(await page.locator('.kid .ksub').first().textContent().then((t) => /已入库 0 字/.test(t)), '识字 is untouched: still 已入库 0 字');
  await browser.close();

  // ---- screens and languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape', { width: 1180, height: 820 }]]) {
      const t = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 3); await openEnglish(t.page, 'Dory');
      const m = await t.page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const rows = [...document.querySelectorAll('.wrow')];
        const bad = rows.filter((r) => r.scrollWidth > r.clientWidth + 1 || r.getBoundingClientRect().right > vw + 1 || r.getBoundingClientRect().left < -1).length;
        const l = Math.min(...rows.map((r) => r.getBoundingClientRect().left)), r = vw - Math.max(...rows.map((x) => x.getBoundingClientRect().right));
        return { sw: document.documentElement.scrollWidth, vw, bad, l, r, n: rows.length, cjk: /[一-鿿]/.test(document.querySelector('.hero h1').textContent + document.querySelector('.tabs').textContent + document.querySelector('.grade-row').textContent) };
      });
      ok(m.sw <= m.vw && m.bad === 0 && m.n === 20, `${name} ${dn}: 20 rows, nothing cut off or sideways`);
      ok(Math.abs(m.l - m.r) <= 2, `${name} ${dn}: equal space left and right (${Math.round(m.l)} / ${Math.round(m.r)})`);
      if (name !== 'zh') ok(!m.cjk, `${name} ${dn}: title, tabs and grade are translated`);
      if (dn === 'phone') await t.page.screenshot({ path: OUT + `english-${name}-phone.png` });
      if (name === 'zh' && dn === 'phone') {
        await t.page.click('#tab-game'); await t.page.click('#game-start'); await t.page.waitForSelector('#game-char'); await t.page.click('#game');
        await t.page.screenshot({ path: OUT + 'english-game-phone.png' });
        const inside = await t.page.evaluate(() => { const c = document.querySelector('#game-char').getBoundingClientRect(), d = document.querySelector('#game-dial').getBoundingClientRect(); return c.left >= d.left && c.right <= d.right; });
        ok(inside, 'game on a 320 px phone: the word stays inside the ring');
      }
      await t.browser.close();
    }
  }
  await done();
})();
