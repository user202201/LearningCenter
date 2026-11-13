// The weekly English reading: 52 passages for every grade (original or adapted from public-domain works), one per week of the year; a card under the words, the
// reading page (tap a glossed word, read aloud, three questions), the French glosses on the French screen, nothing on the French track (English screen).
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  // ---- the data ----
  {
    const t = await start(new Map(), { local: true });
    const d = await t.page.evaluate(async () => {
      const R = await import('/src/readings.ts'), all = await R.loadReadings();
      const res = { grades: Object.keys(all).length, bad: [], wc: {}, adapted: 0, weekOf: [R.weekOfYear('2026-01-04'), R.weekOfYear('2026-11-08'), R.weekOfYear('2026-12-27')] };
      for (const [g, list] of Object.entries(all)) {
        const titles = new Set();
        if (list.length !== 52) res.bad.push(g + ': ' + list.length);
        list.forEach((r, i) => {
          if (r.w !== i + 1) res.bad.push(`${g}/${r.w} order`);
          titles.add(r.t);
          const text = r.text.toLowerCase();
          if (r.q.length !== 3 || r.q.some((q) => new Set([q.a, ...q.w]).size !== 4)) res.bad.push(`${g}/${r.w} questions`);
          if (r.gl.length < 3 || r.gl.some((x) => !x.zh || !x.fr || !text.includes(x.w.toLowerCase()))) res.bad.push(`${g}/${r.w} glosses`);
          if (r.src !== 'original' && !/public domain/.test(r.src)) res.bad.push(`${g}/${r.w} source`);
          if (r.src !== 'original') res.adapted++;
        });
        if (titles.size !== 52) res.bad.push(g + ' titles');
        const wc = list.map((r) => r.text.split(/\s+/).length);
        res.wc[g] = [Math.min(...wc), Math.max(...wc)];
      }
      res.growing = Object.values(res.wc).every((x, i, a) => i === 0 || x[1] >= a[i - 1][1]);
      return res;
    });
    ok(d.grades === 9 && d.bad.length === 0, `9 grades x 52 passages, each with 3 questions (4 different choices), 3+ glossed words in the text, a source${d.bad.length ? ' -> ' + d.bad.slice(0, 5).join('; ') : ''}`);
    ok(d.growing && d.wc['1'][1] <= 60 && d.wc['9'][0] >= 200, 'the passages get longer with the grade: ' + Object.entries(d.wc).map(([g, w]) => g + ':' + w.join('-')).join(' '));
    ok(d.adapted >= 30, d.adapted + ' passages are adapted from public-domain works (marked in "src"), the rest is original');
    ok(d.weekOf[0] === 1 && d.weekOf[1] >= 44 && d.weekOf[2] === 52, 'the passage of a week follows the week of the year: ' + d.weekOf.join(','));
    await t.browser.close();
  }

  // ---- the screens: Chinese screen, grade 4 ----
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  const p = t.page;
  await addKid(p, 'Dory'); await setGrade(p, 'Dory', 4);
  const id = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  await p.evaluate((i) => (location.hash = '#/english/' + i), id); await p.waitForSelector('.wrow');
  await p.waitForSelector('#read-card');
  const expect = await p.evaluate(async () => { const R = await import('/src/readings.ts'), all = await R.loadReadings(); const sunday = document.querySelector('#week-label span').textContent.split(' ')[0]; const r = R.readingFor(all, 4, sunday); return { t: r.t, n: r.gl.length, first: r.gl[0], q: r.q.length }; });
  ok((await p.textContent('#read-card .rd-title')) === expect.t, 'the week page has a reading card with this week\'s title: ' + expect.t);
  await p.screenshot({ path: OUT + 'reading-card-phone.png' });
  await p.click('#read-card'); await p.waitForSelector('#rd-text');
  ok((await p.textContent('#rd-title')) === expect.t && (await p.locator('.rd-p').count()) >= 1, 'the card opens the passage');
  ok((await p.locator('.rw-gl').count()) >= 1 && (await p.locator('.rd-w').count()) === expect.n, 'glossed words are underlined in the text and listed below (' + expect.n + ')');
  const gl = p.locator('.rw-gl').first();
  const word = (await gl.textContent()), g0 = await gl.getAttribute('data-w');
  await gl.click();
  const bubble = await p.textContent('#rd-gloss');
  ok(bubble.includes(word) && /[一-鿿]/.test(bubble), 'a tap on an underlined word shows its Chinese meaning: ' + bubble);
  ok(await p.locator('#rd-speak').count() === 1, 'there is a read-aloud button');
  const opts = await p.locator('.rd-q').evaluateAll((qs) => qs.map((q) => q.querySelectorAll('.rd-opt').length));
  ok(opts.length === 3 && opts.every((n) => n === 4), 'three questions with four choices');
  for (let i = 0; i < 3; i++) {
    const q = p.locator('.rd-q').nth(i);
    const wrong = i === 1;
    await q.locator(`.rd-opt[data-right="${wrong ? 0 : 1}"]`).first().click();
    ok(await q.locator('.rd-opt.right').count() === 1 && (await q.locator('.rd-opt.wrong').count()) === (wrong ? 1 : 0), `question ${i + 1}: ${wrong ? 'a wrong choice shows red and the right one green' : 'the right choice turns green'}`);
  }
  ok((await p.textContent('#rd-score')) === '答对 2 / 3 题', 'the score: 答对 2 / 3 题');
  await p.screenshot({ path: OUT + 'reading-page-phone.png', fullPage: false });
  const fit = await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  ok(fit, 'nothing sideways on a phone');
  // another week -> another passage
  await p.evaluate((i) => (location.hash = '#/english/' + i), id); await p.waitForSelector('.wrow');
  await p.click('.weekbar button >> nth=1'); await p.waitForFunction((t) => document.querySelector('#read-card .rd-title')?.textContent !== t, expect.t);
  ok(true, 'next week has another passage');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ---- French screen: French meanings; English screen (French track): no reading yet ----
  for (const [loc, name] of [['fr-FR', 'fr'], ['en-US', 'en']]) {
    const s = await start(new Map(), { local: true, locale: loc, today: '2026-11-12', viewport: { width: 390, height: 844 } });
    await addKid(s.page, 'Dory'); await setGrade(s.page, 'Dory', 5);
    const kid = await s.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
    await s.page.evaluate((i) => (location.hash = '#/english/' + i), kid); await s.page.waitForSelector('.wrow');
    await s.page.waitForTimeout(500);
    if (name === 'fr') {
      await s.page.click('#read-card'); await s.page.waitForSelector('#rd-text');
      await s.page.click('.rw-gl');
      const b = await s.page.textContent('#rd-gloss');
      ok(!/[一-鿿]/.test(b) && b.includes('—'), 'the French screen shows the French meaning: ' + b);
      ok(!/[一-鿿]/.test(await s.page.locator('.rd-narrow h2.sec').allTextContents().then((x) => x.join(''))), 'the headings are translated');
    } else {
      ok(await s.page.locator('#read-card').count() === 0, 'English screen = French words: no reading card (the passages are English)');
    }
    await s.browser.close();
  }
  await done();
})();
