// English, part 1 (the words): the same screens as 识字 (children -> a child with Game | This week | Recorded), 20 words a week picked by the child's grade,
// word + phonetics + meaning, the game (shared rules; the word as text, a tap shows the meaning), data kept in english/<kid>.json (not in the Chinese files),
// the grade asked ONCE (and remembered, goes up every September), a grade of its own for a child, English / French, small and large screens.
const { start, checks, addKid, REPO } = require('./harness.cjs');
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
  // ---- the grade: asked once, remembered, every subject uses it, goes up in September ----
  {
    const t = await start(new Map(), { noLogin: true, noGrade: true, today: '2026-11-12' });
    const { page } = t;
    await page.click('#local-btn');
    await page.waitForSelector('#grade-dlg');
    ok((await page.locator('#grade-dlg .grade-btn').allTextContents()).join() === '一年级,二年级,三年级,四年级,五年级,六年级,初一,初二,初三', 'the first time: "which grade?" with 9 buttons (primary 1-6, junior high 1-3)');
    ok(await page.locator('.hub-grid').count() === 1, 'the subject picker is behind the question');
    await page.click('.grade-btn[data-grade="5"]');
    await page.waitForSelector('#grade-dlg', { state: 'detached' });
    ok((await page.textContent('#hub-grade')).includes('五年级'), 'the grade is shown on the picker (五年级)');
    await page.reload(); await page.waitForSelector('.hub-grid'); await page.waitForTimeout(300);
    ok(await page.locator('#grade-dlg').count() === 0, 'asked ONCE: after a reload the question does not come again');
    await page.click('.subject[data-subject=chinese]'); await page.waitForSelector('.empty-home'); await page.click('button.back'); await page.waitForSelector('.hub-grid');
    ok(await page.locator('#grade-dlg').count() === 0, 'and not when going into another subject and back');
    await page.click('#hub-grade'); await page.waitForSelector('#grade-dlg');
    ok(await page.locator('.grade-btn.on').getAttribute('data-grade') === '5', 'the grade button opens the window again with the current grade marked');
    await page.click('#grade-dlg button >> text=取消'); await page.waitForSelector('#grade-dlg', { state: 'detached' });
    ok((await page.textContent('#hub-grade')).includes('五年级'), 'cancelling changes nothing');
    // the grade goes up by itself every September: calculated from the day it was set
    const calc = await page.evaluate(async () => {
      const P = await import('/src/profile.ts');
      const at = (grade, setOn, now) => P.advance({ grade, setOn }, new Date(now));
      return [at(5, '2026-11-12', '2026-11-12'), at(5, '2026-11-12', '2027-08-31'), at(5, '2026-11-12', '2027-09-01'), at(5, '2026-11-12', '2028-09-15'), at(3, '2026-08-31', '2026-09-01'), at(8, '2026-11-12', '2030-01-01'), at(1, '2026-11-12', '2025-01-01')];
    });
    ok(calc.join() === '5,5,6,7,4,9,1', 'the grade goes up on 1 September only (' + calc.join(',') + '), never past 初三, never down');
    // a stored grade from a year ago is one higher today
    await page.evaluate(() => localStorage.setItem('learn.profile.v1', JSON.stringify({ def: { grade: 2, setOn: '2025-10-01' } }))); await page.reload(); await page.waitForSelector('.hub-grid');
    ok((await page.textContent('#hub-grade')).includes('三年级'), 'a grade chosen last school year (二年级) is 三年级 now, without asking');
    await t.browser.close();
  }

  // ---- the words ----
  const store = new Map();
  const { browser, page, log } = await start(store, { today: '2026-11-12', viewport: { width: 390, height: 844 } });   // (grade 3 is known)
  await addKid(page, 'Dory'); await addKid(page, 'Leo');
  await openEnglish(page);
  ok((await page.locator('.kid').count()) === 2 && (await page.locator('.kid .ksub').first().textContent()).includes('三年级'), 'English: the list of children with each one\'s grade (三年级)');
  ok(await page.locator('.hero h1').textContent() === '英语', 'English: its own title');
  await page.click('.kid:has-text("Dory")'); await page.waitForSelector('.wrow');
  const week1 = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(week1.length === 20 && new Set(week1.map(keyOf)).size === 20, 'this week: exactly 20 different words (' + week1.slice(0, 5).join(' ') + ' …)');
  const lib = await page.evaluate(async () => (await (await fetch('/data/english-words.json')).json()).words);
  const g = Object.fromEntries(lib.map((x) => [keyOf(x.w), x.g]));
  ok(week1.every((w) => g[keyOf(w)] >= 3), 'for a child of grade 3 the words are those of grade 3 on (none of grade 1-2): grades ' + [...new Set(week1.map((w) => g[keyOf(w)]))].join());
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
  await page.click('[data-tab=learned]'); await page.waitForSelector('.wweek');
  ok(await page.locator('.wweek .wrow').count() === 40 && await page.locator('.wweek').count() === 2, 'Recorded: both weeks, 40 words, newest week first');
  ok((await page.locator('.tabs button').nth(2).textContent()) === '已入库 40', 'the tab counts them (已入库 40)');
  // each child has his own words
  await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
  await page.click('.kid:has-text("Leo")'); await page.waitForSelector('.wrow');
  const leo = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(JSON.stringify(leo) === JSON.stringify(week1), 'another child starts at the beginning for his grade (the words are per child)');
  // a grade of its own
  await page.click('#grade-btn'); await page.waitForSelector('#grade-dlg');
  ok(await page.locator('.grade-btn.on').getAttribute('data-grade') === '3', 'the child\'s grade window shows the shared grade marked');
  await page.click('.grade-btn[data-grade="7"]'); await page.waitForSelector('#grade-dlg', { state: 'detached' });
  ok((await page.textContent('#grade-btn')).includes('初一'), 'a child can have a grade of his own (初一)');
  await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
  const subs = await page.locator('.kid .ksub').allTextContents();
  ok(subs.some((s) => s.includes('初一')) && subs.some((s) => s.includes('三年级')), 'the list shows each child\'s grade: ' + subs.join(' / '));
  await page.click('.kid:has-text("Leo")'); await page.waitForSelector('.wrow');
  await page.click('button[title=下一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第2周');
  const leo2 = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(leo2.every((w) => g[keyOf(w)] >= 3), 'words are picked for the grade at the moment the week is made (next week: ' + [...new Set(leo2.map((w) => g[keyOf(w)]))].join() + ')');
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

  // ---- the Chinese part is unchanged: it still has no word in it ----
  await page.evaluate(() => (location.hash = '#/chinese')); await page.waitForSelector('.kids');
  ok(await page.locator('.kid .ksub').first().textContent().then((t) => /已入库 0 字/.test(t)), '识字 is untouched: still 已入库 0 字');
  await browser.close();

  // ---- screens and languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape', { width: 1180, height: 820 }]]) {
      const t = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await addKid(t.page, 'Dory'); await openEnglish(t.page, 'Dory');
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
