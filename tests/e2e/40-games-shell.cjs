// The games subject shell: the sixth card of the picker, the home with the eight games (cartoon cards from each game's own icon), opening a game inside the stage,
// the sound switch and the full-screen button, the way back, no child needed, everything offline; three languages; phones and tablets.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const IDS = ['snake', 'tetris', 'bubble', 'match3', 'klotski', 'gomoku', 'chess', 'xiangqi', 'spider', 'freecell'];

(async () => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/')); await p.waitForSelector('.hub-grid'); await p.waitForTimeout(700);
  const names = await p.locator('.subject .s-name').allTextContents();
  ok(names.join() === '识字,数学,英语,科学,音乐,小游戏', 'the picker has six cards, games is the sixth: ' + names.join());
  await p.click('.subject[data-subject=games]'); await p.waitForSelector('.gm-card');
  ok((await p.locator('.gm-card').count()) === 10 && (await p.locator('.gm-card').evaluateAll((e) => e.map((x) => x.dataset.game))).join() === IDS.join(), 'the home has the ten games in order: ' + IDS.join(' '));
  const icons = await p.locator('.gm-art svg').evaluateAll((els) => els.map((e) => ({ n: e.querySelectorAll('*').length, ph: /马上就好/.test(e.outerHTML) || (e.querySelectorAll('text').length === 1 && e.querySelectorAll('*').length < 5) })));
  ok(icons.length === IDS.length && icons.every((i) => i.n >= 10 && !i.ph), 'every game has a real cartoon icon (not a placeholder): shapes ' + icons.map((i) => i.n).join(','));
  ok(await p.locator('.gm-art svg').count() === 10 && await p.locator('.shortcuts').count() === 0, 'every card has its cartoon picture; no child shortcuts here');
  await p.screenshot({ path: OUT + 'games-home-ipad.png' });
  for (const id of IDS) {
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-card');
    await p.click(`#gm-${id}`); await p.waitForSelector('#gm-stage');
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => ({ kids: document.querySelector('#gm-stage').childElementCount, sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth, hash: location.hash, err: document.querySelector('.toast')?.textContent ?? '' }));
    ok(r.hash === `#/games/${id}` && r.kids > 0 && r.sw && !/出错/.test(r.err), `${id}: opens in the stage, nothing sideways`);
  }
  // sound switch and full screen (on the last game)
  ok((await p.textContent('#gm-sound')) === '音效：开', 'the sound is on at first');
  await p.click('#gm-sound');
  ok((await p.textContent('#gm-sound')) === '音效：关' && (await p.evaluate(() => localStorage.getItem('learn.games.muted'))) === '1', 'the sound switch turns it off (and keeps it)');
  await p.click('#gm-sound');
  await p.click('#gm-full'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('.gm-page').classList.contains('gm-full') && getComputedStyle(document.querySelector('.gm-page > .top')).display === 'none') && (await p.textContent('#gm-full')).includes('退出'), 'full screen hides the title band and shows an exit button');
  await p.click('#gm-full'); await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => document.querySelector('.gm-page').classList.contains('gm-full'))), 'and leaves it again');
  await p.click('.gm-page .top button, .gm-page .top a'); await p.waitForSelector('.gm-card');
  ok((await p.evaluate(() => location.hash)) === '#/subject/games', 'the back button of a game returns to the home of games');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await s.page.evaluate(() => (location.hash = '#/subject/games')); await s.page.waitForSelector('.gm-card');
      await s.page.waitForTimeout(300);
      const m = await s.page.evaluate(() => { const vw = document.documentElement.clientWidth, cards = [...document.querySelectorAll('.gm-card')]; const l = Math.min(...cards.map((c) => c.getBoundingClientRect().left)), r = vw - Math.max(...cards.map((c) => c.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth <= vw, l, r, out: cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length, cjk: /[一-鿿]/.test(document.querySelector('main').textContent + document.querySelector('.hero h1').textContent) }; });
      ok(m.sw && m.out === 0 && Math.abs(m.l - m.r) <= 2, `${name} ${dn}: ten cards inside the screen, equal space left and right (${Math.round(m.l)} / ${Math.round(m.r)})`);
      const oneLineCheck = (sel) => s.page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const fs = parseFloat(getComputedStyle(e).fontSize); return e.getBoundingClientRect().height > fs * 1.7 || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.textContent), sel);
      const wrapped = await oneLineCheck('.gm-card b');
      ok(wrapped.length === 0, `${name} ${dn}: every game name stays on one line${wrapped.length ? ' -> ' + wrapped.join() : ''}`);
      await s.page.evaluate(() => (location.hash = '#/')); await s.page.waitForSelector('.hub-grid'); await s.page.waitForTimeout(900);
      const wrappedHub = await oneLineCheck('.subject .s-name');
      ok(wrappedHub.length === 0, `${name} ${dn}: every subject name on the picker stays on one line (font made smaller when needed)${wrappedHub.length ? ' -> ' + wrappedHub.join() : ''}`);
      await s.page.evaluate(() => (location.hash = '#/subject/music')); await s.page.waitForSelector('.mus-card'); await s.page.waitForTimeout(300);
      const wrappedMus = await oneLineCheck('.mus-card b');
      ok(wrappedMus.length === 0, `${name} ${dn}: the music cards stay on one line${wrappedMus.length ? ' -> ' + wrappedMus.join() : ''}`);
      if (name !== 'zh') ok(!m.cjk, `${name} ${dn}: nothing Chinese left on the games home`);
      await s.browser.close();
    }
  }
  await done();
})();
