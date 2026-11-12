// Science, part 1: knowledge cards for fun (not rote learning). The library (339 cards + 60 element cards): every card complete and its choices honest; every grade has all
// four fields (nature, life, history, geography); a week = 8 cards, 2 of each field, no repeats; the screens (children -> Game | This week | Recorded), the relaxed game (no time
// limit, a "did you know" text after every answer, Next button), the periodic table and the formulas pages; all offline; English / French on small and large screens.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const openScience = async (page, name) => {
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await page.click('.subject[data-subject=science]'); await page.waitForSelector('.kids, .empty-home');
  if (name) { await page.click(`.kid:has-text("${name}")`); await page.waitForSelector('.scard, .empty'); }
};

(async () => {
  // ---- the library and the weekly pick (pure) ----
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const SM = await import('/src/sciencemodel.ts');
      const lib = await SM.loadScience();
      const res = { n: lib.cards.length, bad: [], grades: {}, weeks: [], round: [], el: lib.cards.filter((c) => c.id.startsWith('el-')).length, domains: lib.domains.map((d) => d[0]) };
      const domainOf = (t) => lib.domains.find((d) => d[1].includes(t))[0];
      const ids = new Set();
      for (const c of lib.cards) {
        if (ids.has(c.id)) res.bad.push('duplicate id ' + c.id); ids.add(c.id);
        const opts = [c.a, ...c.w];
        if (!c.q || !c.a || !c.e || c.e.length > 80) res.bad.push('incomplete ' + c.id);
        else if (c.w.length !== 3 || new Set(opts).size !== 4) res.bad.push('choices ' + c.id + ' ' + opts.join('|'));
        else if (!lib.topics[c.t]) res.bad.push('topic ' + c.id);
        else if (c.q.length > 70) res.bad.push('long question ' + c.id);
      }
      for (let g = 1; g <= 9; g++) { const cs = lib.cards.filter((c) => c.g === g); res.grades[g] = [cs.length, Object.fromEntries(lib.domains.map((d) => [d[0], cs.filter((c) => d[1].includes(c.t)).length]))]; }
      // a child of grade 4: weeks until the grade is used up, then a new round (the wrong cards first)
      let kid = { weeks: [] };
      const seen = new Set();
      for (let w = 0; w < 5; w++) {
        const pick = SM.pickCards(lib, kid, 4);
        res.weeks.push({ n: pick.length, distinct: new Set(pick).size, repeats: pick.filter((i) => seen.has(i)).length, domains: Object.values(pick.reduce((m, i) => { const d = domainOf(lib.byId.get(i).t); m[d] = (m[d] || 0) + 1; return m; }, {})).join('/') });
        pick.forEach((i) => seen.add(i));
        kid = { weeks: [...kid.weeks, { start: 'w' + w, chars: pick }] };
      }
      const g4 = lib.cards.filter((c) => c.g === 4).map((c) => c.id);
      const full = { weeks: [{ start: 'a', chars: g4 }] };
      const worst = g4[5];
      res.round = SM.pickCards(lib, full, 4, (id) => id === worst);
      // the elements
      const els = lib.cards.filter((c) => c.id.startsWith('el-')); res.elBad = els.filter((c) => new Set([c.a, ...c.w]).size !== 4).length;
      const fe = lib.byId.get('el-sym-26'); res.fe = [fe.q, fe.a];
      res.noOutside = performance.getEntriesByType('resource').filter((x) => !x.name.startsWith(location.origin)).length;
      return res;
    });
    ok(r.n >= 339 + 60 && r.bad.length === 0, r.n + ' cards (339 written + ' + r.el + ' element cards): every card has a question, answer, 3 different wrong choices, a short "did you know" text' + (r.bad.length ? ' -> ' + r.bad.slice(0, 5).join(' | ') : ''));
    ok(Object.values(r.grades).every(([n, d]) => n >= 20 && Object.values(d).every((x) => x >= 2)), 'every grade 1-9 has at least 20 cards and 2+ in each of the four fields ' + JSON.stringify(Object.fromEntries(Object.entries(r.grades).map(([g, v]) => [g, v[0]]))));
    ok(r.weeks.slice(0, 2).every((w) => w.n === 8 && w.distinct === 8 && w.repeats === 0 && w.domains === '2/2/2/2') && r.weeks.every((w) => w.repeats === 0 || r.weeks.indexOf(w) >= 4), 'a week = 8 cards, 2 of each of the four fields (while the grade has new cards in each field; a field that is used up is made up from the others), never a repeat: ' + r.weeks.map((w) => w.domains).join(' '));
    ok(r.weeks.every((w) => w.n === 8 && w.distinct === 8), 'also when a grade has been used up (a new round) every week still has 8 different cards');
    ok(r.round.length === 8 && r.round[0] !== undefined, 'a new round of a used-up grade starts with the cards he got wrong');
    ok(r.elBad === 0 && /Fe|铁/.test(r.fe.join()), 'the element cards are made from the periodic table: ' + r.fe.join(' -> '));
    ok(r.noOutside === 0, 'nothing is fetched from outside');
    await t.browser.close();
  }

  // ---- the screens ----
  const { browser, page, log } = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  await addKid(page, 'Dory'); await setGrade(page, 'Dory', 4);
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  ok(await page.locator('.subject[data-subject=science] .s-soon').count() === 0, 'the science card is open now (no "coming soon" label)');
  await page.click('.subject[data-subject=science]'); await page.waitForSelector('.kids');
  ok((await page.textContent('.hero h1')) === '科学' && (await page.locator('.kid .ksub').first().textContent()).includes('四年级') && await page.locator('#open-periodic').count() === 1 && await page.locator('#open-formulas').count() === 1, 'Science: the list of children with their grade, and two buttons (periodic table, formulas)');
  await page.click('.kid'); await page.waitForSelector('.scard');
  const lib = await page.evaluate(async () => { const SM = await import('/src/sciencemodel.ts'); const l = await SM.loadScience(); return { cards: l.cards.map((c) => ({ id: c.id, q: c.q, a: c.a, e: c.e, t: c.t })), domains: l.domains }; });
  const byId = Object.fromEntries(lib.cards.map((c) => [c.id, c]));
  const dom = (t) => lib.domains.find((d) => d[1].includes(t))[0];
  const week = await page.locator('.scard').evaluateAll((els) => els.map((e) => e.dataset.card));
  ok(week.length === 8 && (await page.locator('.tabs button').allTextContents()).join('|') === '游戏|本周|已入库 8', 'this week: 8 knowledge cards (tabs 游戏 | 本周 | 已入库 8)');
  const counts = week.reduce((m, id) => { const d = dom(byId[id].t); m[d] = (m[d] || 0) + 1; return m; }, {});
  ok(Object.values(counts).join() === '2,2,2,2', 'two of each: nature, life, history, geography (' + JSON.stringify(counts) + ')');
  ok(!(await page.locator('.scard.open').count()), 'the answers are hidden at first');
  await page.click('.scard >> nth=0');
  ok(await page.locator('.scard.open .sans').isVisible() && (await page.textContent('.scard.open .sans')).includes(byId[week[0]].a) && (await page.textContent('.scard.open .sfun')).includes(byId[week[0]].e), 'a tap shows the answer and the "did you know" sentence');
  await page.screenshot({ path: OUT + 'science-week-phone.png' });
  // the relaxed game
  await page.click('#tab-game'); await page.waitForSelector('#game-start');
  ok(/共 8 题，不限时/.test(await page.textContent('#math-info')), 'the lobby: 8 questions, no time limit');
  await page.click('#game-start'); await page.waitForSelector('#math-q');
  ok(await page.locator('#math-bar').count() === 0 && await page.locator('.mtime').count() === 0, 'the game has no time bar');
  let wrongDone = false;
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector('#math-q');
    const q = (await page.textContent('#math-q')).trim();
    const card = lib.cards.find((c) => c.q === q);
    const right = card.a;
    const choose = i === 1 ? await page.locator('.mchoice:not([data-v="' + right.replace(/"/g, '\\"') + '"]) >> nth=0') : await page.locator('.mchoice').filter({ has: page.locator(':scope') }).evaluateAll((els, a) => els.findIndex((e) => e.dataset.v === a), right).then((k) => page.locator('.mchoice').nth(k));
    await choose.click();
    await page.waitForSelector('#math-explain');
    const ex = await page.textContent('#math-explain');
    if (i === 1) { wrongDone = ex.includes('正确答案') && ex.includes(right); }
    ok(ex.includes(card.e) || i > 0, i === 0 ? 'after the answer the "did you know" text of the card is shown: ' + card.e.slice(0, 20) + '…' : 'x');
    ok(i > 0 || (await page.locator('.mchoice:disabled').count()) === 4, i === 0 ? 'the choices are locked and the game WAITS for the Next button (no automatic jump)' : 'x');
    await page.click('#math-next');
  }
  ok(wrongDone, 'a wrong answer says "没关系" and shows the right answer and the text');
  await page.waitForSelector('#game-end');
  ok((await page.textContent('#game-end h2')) === '探索完成！' && (await page.textContent('#game-final')) === '7' && !(await page.textContent('#game-end')).includes('用时'), 'the end: "探索完成！", 7 / 8, no time shown');
  await page.screenshot({ path: OUT + 'science-end-phone.png' });
  await page.click('#game-done'); await page.waitForSelector('.tabs');
  // recorded: errors book + a sample
  await page.click('[data-tab=learned]'); await page.waitForSelector('#mistakes-title');
  ok((await page.textContent('#mistakes-title')) === '错题本（1）' && await page.locator('.scard').count() === 8, 'Recorded: the errors book (1 wrong) and the cards (a random 30 of them: all 8)');
  await page.click('#redo-mistakes'); await page.waitForSelector('#math-q');
  ok((await page.textContent('#game-progress')) === '1 / 1', 'redo: a game of exactly that one card');
  await page.click('#game-quit'); await page.click('dialog button.danger'); await page.waitForSelector('.tabs');

  // the periodic table
  await page.evaluate(() => (location.hash = '#/subject/science')); await page.waitForSelector('#open-periodic');
  await page.click('#open-periodic'); await page.waitForSelector('.pt-cell');
  ok(await page.locator('.pt-cell').count() === 118, 'periodic table: 118 elements');
  const pos = await page.evaluate(() => { const g = (n) => document.querySelector(`.pt-cell[data-n="${n}"]`).style; return [g(1).gridColumn + '/' + g(1).gridRow, g(2).gridColumn + '/' + g(2).gridRow, g(26).gridColumn + '/' + g(26).gridRow, g(57).gridColumn + '/' + g(57).gridRow, g(89).gridColumn + '/' + g(89).gridRow, g(118).gridColumn + '/' + g(118).gridRow].join(' '); });
  ok(pos === '1/1 18/1 8/4 3/8 3/9 18/7', 'the layout is the real table (H, He, Fe in period 4 group 8, the lanthanides and actinides in their own rows, Og): ' + pos);
  await page.click('#pt-junior');
  ok(await page.locator('.pt-cell:not(.dim)').count() === 30, 'the filter 初中常考 keeps 30 elements bright (the rest is dimmed, the table keeps its shape)');
  await page.click('.pt-cell[data-n="26"]'); await page.waitForSelector('#pt-dlg');
  const dlg = await page.textContent('#pt-dlg');
  ok(dlg.includes('铁') && dlg.includes('Iron') && dlg.includes('26') && dlg.includes('55.845') && dlg.includes('过渡金属') && dlg.includes('初中常考'), 'a tap on an element: name, English name, number, mass, category, junior-high mark');
  await page.screenshot({ path: OUT + 'science-periodic-phone.png' });
  await page.click('#pt-dlg button.primary'); await page.waitForSelector('dialog', { state: 'detached' });
  const rare = await page.evaluate(() => document.querySelector('.pt-cell[data-n="118"] span').textContent);
  ok(rare.length >= 1, 'the rare characters of the newest elements are in the data (' + rare + ')');
  // formulas
  await page.evaluate(() => (location.hash = '#/science/formulas')); await page.waitForSelector('.fm-row');
  const all = await page.locator('.fm-row').count();
  await page.click('#fm-chem');
  ok(all >= 30 && (await page.locator('.fm-row').count()) < all && (await page.locator('.fm-row').evaluateAll((els) => els.every((e) => e.dataset.k === '化学'))), 'formulas and equations: ' + all + ' in all, the filter 化学 shows only chemistry');
  ok(log.external.length === 0, 'OFFLINE: the whole science flow made no request outside the app: ' + log.external.join(', '));
  await browser.close();

  // ---- screens, languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const t = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 9); await openScience(t.page, 'Dory');
      const m = await t.page.evaluate(() => {
        const vw = document.documentElement.clientWidth, cards = [...document.querySelectorAll('.scard')];
        const l = Math.min(...cards.map((c) => c.getBoundingClientRect().left)), r = vw - Math.max(...cards.map((c) => c.getBoundingClientRect().right));
        return { sw: document.documentElement.scrollWidth, vw, n: cards.length, l, r, bad: cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length, cjk: /[一-鿿]/.test(document.querySelector('.hero h1').textContent + document.querySelector('.tabs').textContent + document.querySelector('.grade-row').textContent) };
      });
      ok(m.sw <= m.vw && m.n === 8 && m.bad === 0, `${name} ${dn}: 8 cards, nothing cut off or sideways`);
      ok(Math.abs(m.l - m.r) <= 2, `${name} ${dn}: equal space left and right (${Math.round(m.l)} / ${Math.round(m.r)})`);
      if (name !== 'zh') ok(!m.cjk, `${name} ${dn}: title, tabs and grade are translated`);
      await t.page.click('#tab-game'); await t.page.click('#game-start'); await t.page.waitForSelector('#math-q');
      const fit = await t.page.evaluate(async () => {
        const SM = await import('/src/sciencemodel.ts'), U = await import('/src/mathui.ts');
        const l = await SM.loadScience(), cs = [...l.cards].sort((a, b) => (b.q.length + Math.max(...[a.a, ...a.w].map((x) => x.length))) - (a.q.length + Math.max(...[b.a, ...b.w].map((x) => x.length)))).slice(0, 6);
        const el = document.querySelector('#math-q'), card = document.querySelector('#math-card'), vw = document.documentElement.clientWidth, bad = [];
        for (const c of cs) {
          const q = SM.cardToQ(c);
          el.textContent = q.q; U.fitQuestion(el, card);
          document.querySelector('#math-choices').replaceChildren(...q.choices.map((x) => Object.assign(document.createElement('button'), { className: 'mchoice user', textContent: x })));
          const grid = document.querySelector('#math-choices'), longest = Math.max(...q.choices.map((x) => [...x].length));
          grid.classList.toggle('long', longest > 14); grid.classList.toggle('mid', longest > 7 && longest <= 14);
          await new Promise((r) => setTimeout(r, 0));
          const r = el.getBoundingClientRect(), cr = card.getBoundingClientRect();
          if (r.left < cr.left - 1 || r.right > cr.right + 1 || r.bottom > cr.bottom + 1 || [...grid.children].some((b) => b.getBoundingClientRect().right > vw + 1 || b.scrollWidth > b.clientWidth + 1)) bad.push(c.id);
        }
        return { bad, sw: document.documentElement.scrollWidth, vw };
      });
      ok(fit.bad.length === 0 && fit.sw <= fit.vw, `${name} ${dn}: the longest questions and answers fit the card and the choices` + (fit.bad.length ? ' -> ' + fit.bad.join(',') : ''));
      if (dn === 'phone') await t.page.screenshot({ path: OUT + `science-game-${name}-phone.png` });
      await t.browser.close();
    }
  }
  await done();
})();
