// OFFLINE FIRST with the GitHub storage: the newest copy of every file is kept on the device. Without network the app opens and shows its data from those
// copies, every change (a game result, a new child) is kept on the device and marked "not sent yet", and when the network is back the changes are sent -
// MERGED with what another device did meanwhile (nothing of either side is lost). Also: moving between screens does not ask the network each time.
const { start, checks, addKid, setGrade, REPO } = require('./harness.cjs');
const { ok, done } = checks();

(async () => {
  // ---- merging two versions of a file (pure) ----
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const { mergeDocs } = await import('/src/sync.ts');
      const weeks = mergeDocs({ weeks: [{ start: '2026-11-01', chars: ['a', 'b'] }, { start: '2026-11-08', chars: ['x'] }] }, { weeks: [{ start: '2026-11-01', chars: ['b', 'c'] }, { start: '2026-10-25', chars: ['z'] }] });
      const kids = mergeDocs({ kids: [{ id: '1', name: 'Local' }], startWeek: '2026-11-08' }, { kids: [{ id: '1', name: 'Old' }, { id: '2', name: 'Other' }], startWeek: '2026-11-01' });
      const cards = mergeDocs({ cards: { a: { box: 2, last: '2026-11-10' } }, plays: 3 }, { cards: { a: { box: 1, last: '2026-11-05' }, b: { box: 4, last: '2026-11-02' } }, plays: 5 });
      const math = mergeDocs({ topics: { t1: { right: 5, wrong: 1 } }, mistakes: [{ q: '1+1' }], plays: 2 }, { topics: { t1: { right: 2, wrong: 0 }, t2: { right: 1, wrong: 1 } }, mistakes: [{ q: '2+2' }, { q: '1+1' }], plays: 4 });
      const idioms = mergeDocs({ weeks: [{ start: 'w', items: ['甲'] }], stories: { 甲: 'a' } }, { weeks: [{ start: 'w', items: ['乙'] }], stories: { 乙: 'b' }, pool: ['丙'] });
      return { weeks, kids, cards, math, idioms, none: [mergeDocs(null, { a: 1 }), mergeDocs({ a: 1 }, null), mergeDocs({ x: 1 }, { y: 2 })] };
    });
    ok(JSON.stringify(r.weeks.weeks.map((w) => [w.start, w.chars.join('')])) === JSON.stringify([['2026-10-25', 'z'], ['2026-11-01', 'bca'], ['2026-11-08', 'x']]), 'merge weeks: the weeks of both sides, the characters of a week from both, in order of the weeks');
    ok(r.kids.kids.length === 2 && r.kids.kids[0].name === 'Local' && r.kids.startWeek === '2026-11-01', 'merge children: both lists, this device\'s version of the same child, the earlier start week');
    ok(r.cards.cards.a.box === 2 && r.cards.cards.b.box === 4 && r.cards.plays === 5, 'merge game boxes: the later answer of each item, the higher play count');
    ok(r.math.topics.t1.right === 5 && r.math.topics.t2.right === 1 && r.math.mistakes.map((m) => m.q).join() === '1+1,2+2' && r.math.plays === 4, 'merge math results: the larger count per topic, the errors book of both without doubles');
    ok(r.idioms.weeks[0].items.slice().sort().join('') === '乙甲' && r.idioms.stories['甲'] === 'a' && r.idioms.stories['乙'] === 'b' && r.idioms.pool.join() === '丙', 'merge idioms: items of both, stories of both, the library');
    ok(JSON.stringify(r.none) === JSON.stringify([{ a: 1 }, { a: 1 }, { x: 1 }]), 'nothing on one side: the other side; unknown shapes: this device\'s version');
    await t.browser.close();
  }

  // ---- the whole flow with the pretend GitHub ----
  const store = new Map();
  const { browser, page, log, version, opts } = await start(store, { today: '2026-11-12', viewport: { width: 390, height: 844 } });
  await addKid(page, 'Dory');
  await setGrade(page, 'Dory', 3);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.sync.v1.demo/LearningData.kids.json')).json.kids[0].id);
  ok(!!id, 'the copy of kids.json is kept on the device (learn.sync.v1.<repo>.kids.json)');
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await page.click('.subject[data-subject=english]'); await page.waitForSelector('.kids');
  await page.click('.kid'); await page.waitForSelector('.wrow');
  const words = await page.locator('.wrow').evaluateAll((els) => els.map((e) => e.dataset.w));
  ok(words.length === 20 && !!store.get(`english/${id}.json`), 'online: 20 words made and saved in the repository');
  ok(!!(await page.evaluate((i) => localStorage.getItem('learn.sync.v1.demo/LearningData.english/' + i + '.json'), id)), 'and a copy of english/<child>.json is kept on the device');

  // moving between screens does not ask the network again and again
  await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids');
  const g0 = log.gets.length;
  for (let i = 0; i < 3; i++) { await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid'); await page.evaluate(() => (location.hash = '#/subject/english')); await page.waitForSelector('.kids'); }
  ok(log.gets.length - g0 <= 2, 'going back and forth between screens within a few seconds made ' + (log.gets.length - g0) + ' requests (the data of the last seconds is reused)');

  // ---- the network goes away ----
  opts.offline = true;
  const t0 = Date.now();
  await page.reload(); await page.waitForSelector('.kids', { timeout: 20000 });   // (the address is still the English list)
  ok((await page.locator('.kid .kname').first().textContent()) === 'Dory', 'OFFLINE: after a reload the children are there (from the copy on this device)');
  await page.click('.kid'); await page.waitForSelector('.wrow', { timeout: 20000 });
  ok((await page.locator('.wrow').count()) === 20, 'OFFLINE: the child\'s 20 words of the week are there');
  ok(Date.now() - t0 < 25000, 'and it did not wait on every screen for a network that is not there (' + Math.round((Date.now() - t0) / 1000) + ' s for all of it)');
  // play the whole game offline: the result is kept on the device
  await page.click('#tab-game'); await page.click('#game-start'); await page.waitForSelector('#game-char');
  for (let i = 0; i < 40 && !(await page.locator('#game-end').count()); i++) { if (await page.locator('#game-right:enabled').count()) await page.click('#game-right'); await page.waitForTimeout(700); }
  await page.waitForSelector('#game-end', { timeout: 30000 });
  await page.waitForFunction(() => (document.querySelector('#toasts')?.textContent ?? '').includes('已保存在这台设备上'), null, { timeout: 15000 });
  ok(true, 'OFFLINE: playing a game works and the user is told it is kept on this device');
  ok(!store.has(`english/${id}.review.json`), 'nothing of it is in the repository yet');
  await page.click('#game-done'); await page.waitForSelector('.tabs');
  // a second child, added offline
  await addKid(page, 'Leo');
  ok(JSON.parse(store.get('kids.json')).kids.length === 1, 'a child added offline is not in the repository yet');
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.sync.v1.demo/LearningData.__dirty') ?? '[]'));
  ok(pending.includes('kids.json') && pending.includes(`english/${id}.review.json`), 'the files with changes not sent yet are listed: ' + pending.join(', '));

  // ---- meanwhile ANOTHER device adds a week to the same file ----
  const remote = JSON.parse(store.get(`english/${id}.json`));
  remote.weeks.unshift({ start: '2026-10-04', chars: ['elsewhere'] });
  store.set(`english/${id}.json`, JSON.stringify(remote)); version.set(`english/${id}.json`, (version.get(`english/${id}.json`) || 0) + 1);
  // and this device adds a word to the same file offline
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await page.evaluate(async ({ id }) => {
    const api = await import('/src/api.ts');
    await api.update(`english/${id}.json`, { weeks: [] }, (cur) => ({ ...cur, weeks: [...cur.weeks, { start: '2026-11-15', chars: ['offline'] }] }), 'test');
  }, { id });

  // ---- the network is back ----
  opts.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => (document.querySelector('#toasts')?.textContent ?? '').includes('同步到 GitHub'), null, { timeout: 20000 });
  ok(true, 'the network is back: "synced to GitHub" is shown');
  const kids = JSON.parse(store.get('kids.json')).kids.map((k) => k.name);
  ok(kids.includes('Dory') && kids.includes('Leo'), 'the child added offline is now in the repository: ' + kids.join(', '));
  ok(Object.keys(JSON.parse(store.get(`english/${id}.review.json`)).cards).length === 20, 'the game result is now in the repository (20 words with their boxes)');
  const merged = JSON.parse(store.get(`english/${id}.json`));
  const weeks = merged.weeks.map((w) => w.start + ':' + (w.chars.length > 3 ? w.chars.length : w.chars.join('')));
  ok(weeks.includes('2026-10-04:elsewhere') && weeks.includes('2026-11-15:offline') && merged.weeks.some((w) => w.chars.length === 20), 'the file holds BOTH the other device\'s week and this device\'s offline change, nothing lost: ' + weeks.join(' | '));
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('learn.sync.v1.demo/LearningData.__dirty') ?? '[]'))).length === 0, 'nothing is marked "not sent yet" any more');
  await page.reload(); await page.waitForSelector('.hub-grid, .kids');
  ok(true, 'and the app keeps working after the sync');

  // ---- no outside request, ever, except the data repository ----
  ok(log.external.length === 0, 'OFFLINE: no request outside the app and the data repository: ' + log.external.join(', '));
  await browser.close();
  await done();
})();
