// Math, part 1 (mental arithmetic): the questions are made on the spot, so the generators are tested hard (thousands of questions per topic: the right
// answer is right, four different choices, ranges of the grade), then the screens: children -> a child (Game | This week | Recorded), 3 topics a week by
// the child's grade, a game of 20 questions with a TOTAL time and four choices (right goes on, wrong shows the answer), time up, leaving, previous week mixed in,
// a quick practice of one topic, results saved in math/<kid>.review.json, grade change picks the topics again, English / French and small screens.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const openMath = async (page, name) => {
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await page.click('.subject[data-subject=math]'); await page.waitForSelector('.kids, .empty-home');
  if (name) { await page.click(`.kid:has-text("${name}")`); await page.waitForSelector('.mtcard, .empty'); }
};
const kidIdOf = (page, i = 0) => page.evaluate((n) => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[n].id, i);
/** plays a whole game answering with the first choice; returns the topic names asked, in order */
const playAll = async (page, n = 20) => {
  const asked = [];
  for (let i = 0; i < n; i++) {
    await page.waitForSelector('#math-q');
    asked.push(await page.textContent('#math-topic'));
    const prog = await page.textContent('#game-progress');
    await page.click('.mchoice >> nth=0');
    if (i < n - 1) await page.waitForFunction((p) => document.querySelector('#game-progress')?.textContent !== p, prog, { timeout: 5000 });
  }
  await page.waitForSelector('#game-end', { timeout: 8000 });
  return asked;
};

(async () => {
  // ---- the generators, in the browser, with the real module ----
  {
    const t = await start(new Map(), { local: true, today: '2026-11-12' });
    const r = await t.page.evaluate(async () => {
      const G = await import('/src/mathgen.ts');
      const data = (await import('/src/data/math-topics.json')).default;
      const ids = G.topicIds();
      const inGrades = new Set(Object.values(data.grades).flat());
      const res = { ids: ids.length, missingGen: [...inGrades].filter((x) => !ids.includes(x)), notInList: data.topics.map((x) => x.id).filter((x) => !ids.includes(x)), bad: [], total: 0, ranges: [] };
      const nonNeg = new Set(['ratadd', 'ratmul', 'lineq1', 'lineq2', 'linfn', 'liketerms', 'polymul', 'quadeq', 'sqrt', 'trig', 'fracsame', 'fracdiff']);
      for (const id of ids) {
        const seen = new Set();
        for (let i = 0; i < 1500; i++) {
          const q = G.make(id); res.total++;
          let why = '';
          if (!Function('return (' + q.chk + ')')()) why = 'wrong answer';
          else if (q.choices.length !== (id === 'compare' ? 3 : 4) || new Set(q.choices).size !== q.choices.length) why = 'choices ' + q.choices.join('|');
          else if (!q.choices.includes(q.a)) why = 'answer not among the choices';
          else if (/NaN|undefined|Infinity|null/.test(q.q + q.choices.join())) why = 'NaN';
          else if (!nonNeg.has(id) && q.a.startsWith('−')) why = 'negative answer in a primary topic';
          if (why && res.bad.length < 8) res.bad.push(id + ': ' + why + ' :: ' + q.q + ' => ' + q.a);
          seen.add(q.q);
        }
        res.ranges.push([id, seen.size]);
      }
      // ranges of the lowest grades
      const chk = (id, f, n = 800) => { for (let i = 0; i < n; i++) { const q = G.make(id), m = q.q.match(/-?\d+/g).map(Number); if (!f(m, +q.a)) return q.q + ' => ' + q.a; } return ''; };
      res.range = [
        chk('add10', (m, a) => m[0] + m[1] === a && a <= 10), chk('sub10', (m, a) => m[0] <= 10 && a >= 0), chk('add20', (m, a) => a >= 10 && a <= 20), chk('sub20', (m, a) => m[0] <= 20 && a >= 1),
        chk('add100', (m, a) => a <= 99), chk('sub100', (m, a) => a >= 0), chk('multable', (m, a) => m[0] <= 9 && m[1] <= 9), chk('div2', (m) => m[1] >= 11),
        chk('mul1', (m) => m[1] <= 9), chk('add3', (m, a) => a <= 999 && m[0] >= 100),
      ];
      // a set of questions: never the same text twice, as many as asked
      const set = G.makeSet(['add10', 'sub10'], 20);
      res.setSize = set.length; res.setDistinct = new Set(set.map((x) => x.q)).size;
      return res;
    });
    ok(r.ids === 49 && r.missingGen.length === 0, 'every topic of math-topics.json (all grades) has a generator: ' + r.ids + ' generators' + (r.missingGen.length ? ' missing ' + r.missingGen : ''));
    ok(r.notInList.length === 0, 'and every generator is a listed topic');
    ok(r.bad.length === 0, r.total + ' questions made: every answer is right, always 4 different choices that contain it, no NaN' + (r.bad.length ? ' -> ' + r.bad.join(' | ') : ''));
    ok(r.range.every((x) => x === ''), 'ranges of the lowest grades hold (sums up to 10 / 20 / 99, tables, 3-digit): ' + r.range.filter(Boolean).join(' | '));
    ok(r.setSize === 20, 'a set of 20 questions has 20 (' + r.setDistinct + ' different texts: small topics may repeat only when they must)');
    await t.browser.close();
  }

  // ---- screens ----
  const store = new Map();
  const { browser, page, log } = await start(store, { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  await addKid(page, 'Dory'); await addKid(page, 'Leo');
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  ok(await page.locator('.subject[data-subject=math] .s-soon').count() === 0, 'the math card is open now (no "coming soon" label)');
  await page.click('.subject[data-subject=math]'); await page.waitForSelector('.kids');
  ok(await page.textContent('.hero h1') === '数学' && (await page.locator('.kid').count()) === 2 && (await page.locator('.kid .ksub').first().textContent()).includes('未选年级'), 'Math: the list of children, grade not chosen yet');
  await page.click('.kid:has-text("Dory")'); await page.waitForSelector('#grade-dlg');
  ok((await page.textContent('#grade-dlg h2')).includes('Dory'), 'the first time a child is opened: his grade is asked');
  await page.click('.grade-btn[data-grade="4"]'); await page.waitForSelector('.mtcard');
  const topics = await page.locator('.mtcard').evaluateAll((els) => els.map((e) => e.dataset.topic));
  const gradeList = await page.evaluate(async () => (await import('/src/data/math-topics.json')).default.grades['4']);
  ok(topics.length === 3 && topics.every((x) => gradeList.includes(x)) && JSON.stringify(topics) === JSON.stringify(gradeList.slice(0, 3)), 'this week: 3 topics of grade 4, in the list\'s order (' + topics.join(', ') + ')');
  ok((await page.locator('.mtcard .mtname').allTextContents()).every((x) => x.length > 1) && await page.locator('.mtcard .macc.none').count() === 3, 'each shows its name, a short description and "not practised yet"');
  const id1 = await kidIdOf(page, 0);
  ok(await page.evaluate((i) => !!localStorage.getItem('learn.local.math/' + i + '.json') && !localStorage.getItem('learn.local.english/' + i + '.json'), id1), 'saved in math/<child>.json only (nothing in the English or Chinese files)');
  ok((await page.locator('.tabs button').allTextContents()).join('|') === '游戏|本周|已入库 3', 'tabs like 识字: 游戏 | 本周 | 已入库 3');
  await page.reload(); await page.waitForSelector('.mtcard');
  ok(JSON.stringify(await page.locator('.mtcard').evaluateAll((els) => els.map((e) => e.dataset.topic))) === JSON.stringify(topics), 'opening again: the same 3 topics');
  await page.click('button[title=下一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第2周');
  const next = await page.locator('.mtcard').evaluateAll((els) => els.map((e) => e.dataset.topic));
  ok(next.length === 3 && next.every((x) => !topics.includes(x)), 'next week: 3 other topics (' + next.join(', ') + ')');
  ok(await page.locator('button[title=下一周]').isDisabled(), 'the right arrow stops at next week');
  await page.click('button[title=上一周]'); await page.waitForFunction(() => document.querySelector('#week-label strong')?.textContent === '第1周');

  // quick practice of one topic
  await page.click('.mpractice >> nth=0'); await page.waitForSelector('#math-q');
  ok((await page.textContent('#game-progress')) === '1 / 10' && (await page.textContent('#math-topic')).length > 0, 'practice: 10 questions of that one topic');
  const t0 = await page.textContent('#math-time');
  ok(/^\d+:\d\d$/.test(t0), 'a total time runs down at the top (' + t0 + ')');
  await page.evaluate(() => document.querySelectorAll('.mchoice').length);
  ok(await page.locator('.mchoice').count() === 4, 'four choices');
  // right answer: goes on at once; wrong: shows the right one
  const info = await page.evaluate(async () => { const G = await import('/src/mathgen.ts'); return G.topicIds().length; });
  await page.click('.mchoice >> nth=0');
  await page.waitForSelector('.mchoice.right');
  ok(await page.locator('.mchoice.right').count() === 1 && (await page.locator('.mchoice:disabled').count()) === 4, 'after an answer the right choice is marked green and the choices are locked');
  await page.waitForFunction(() => document.querySelector('#game-progress')?.textContent === '2 / 10', null, { timeout: 4000 });
  ok(true, 'then the next question comes by itself');
  // leaving: cancel = nothing happens, leave = saved (answered ones)
  await page.click('#game-quit'); await page.waitForSelector('dialog');
  await page.click('dialog button >> text=取消'); await page.waitForSelector('dialog', { state: 'detached' });
  ok(await page.locator('#math-q').count() === 1, 'cancel on the leave question: the game goes on');
  await page.click('#game-quit'); await page.click('dialog button.danger'); await page.waitForSelector('.mtcard');
  await page.waitForFunction((i) => !!localStorage.getItem('learn.local.math/' + i + '.review.json'), id1);
  const rev0 = JSON.parse(await page.evaluate((i) => localStorage.getItem('learn.local.math/' + i + '.review.json'), id1));
  ok(Object.values(rev0.topics).reduce((s, x) => s + x.right + x.wrong, 0) >= 1 && !rev0.last, 'leaving saves what was answered (no "last time" for a game left early)');
  ok(await page.locator('.mtcard .macc.none').count() < 3, 'the topic now shows its answer rate');

  // the game: 20 questions, this week's topics + last week's
  const prev = ['add3', 'sub3', 'mul1'];
  await page.evaluate(([i, p]) => { const k = 'learn.local.math/' + i + '.json'; const cur = JSON.parse(localStorage.getItem(k)); cur.weeks.unshift({ start: '2026-11-01', chars: p }); localStorage.setItem(k, JSON.stringify(cur)); }, [id1, prev]);
  await page.reload(); await page.waitForSelector('.mtcard');
  await page.click('#tab-game'); await page.waitForSelector('#game-start');
  const infoTxt = await page.textContent('#math-info');
  ok(/共 20 题，限时约 \d+ 分钟/.test(infoTxt), 'the lobby: ' + infoTxt);
  await page.click('#game-start'); await page.waitForSelector('#math-q');
  const names = await page.evaluate(async () => Object.fromEntries((await import('/src/data/math-topics.json')).default.topics.map((t) => [t.id, t.name])));
  const prevNames = prev.map((x) => names[x]), thisNames = topics.map((x) => names[x]);
  const asked = await playAll(page, 20);
  ok(asked.length === 20 && asked.filter((n) => thisNames.includes(n)).length === 14 && asked.filter((n) => prevNames.includes(n)).length === 6, 'the game: 20 questions = 14 of this week\'s 3 topics + 6 of last week\'s (' + asked.filter((n) => prevNames.includes(n)).length + ' of last week)');
  const end = await page.evaluate(() => ({ final: document.querySelector('#game-final').textContent, rows: [...document.querySelectorAll('.mrow')].map((r) => r.textContent), stars: document.querySelector('.gstars').dataset.stars, head: document.querySelector('#game-end h2').textContent }));
  ok(/^\d+$/.test(end.final) && +end.final <= 20 && end.rows.length >= 4, 'the end screen: score ' + end.final + ' / 20, a line per topic (' + end.rows.length + ')');
  await page.screenshot({ path: OUT + 'math-end-phone.png' });
  await page.click('#game-done'); await page.waitForSelector('.tabs');
  const rev1 = JSON.parse(await page.evaluate((i) => localStorage.getItem('learn.local.math/' + i + '.review.json'), id1));
  ok(rev1.last && rev1.last.total === 20 && rev1.last.score === +end.final && rev1.plays >= 2 && Object.keys(rev1.topics).length >= 4, 'saved in math/<child>.review.json: last time ' + rev1.last?.score + ' / 20, per topic counts');
  await page.click('[data-tab=learned]'); await page.waitForSelector('.mtcard');
  ok(await page.locator('.mtcard').count() === 9 && (await page.textContent('.tabs button:nth-child(3)')) === '已入库 9', 'Recorded: all 9 topics (last week\'s, this week\'s and next week\'s, which was opened) with their answer rates');
  // another child: nothing shared
  await page.evaluate(() => (location.hash = '#/subject/math')); await page.waitForSelector('.kids');
  await page.click('.kid:has-text("Leo")'); await page.waitForSelector('#grade-dlg'); await page.click('.grade-btn[data-grade="1"]'); await page.waitForSelector('.mtcard');
  const leo = await page.locator('.mtcard').evaluateAll((els) => els.map((e) => e.dataset.topic));
  ok(leo.join() === 'compare,seq,add10' && await page.locator('.macc.none').count() === 3, 'Leo (一年级): his own 3 topics of grade 1 (' + leo.join(', ') + '), nothing of Dory\'s results');
  // changing the grade picks this week's and next week's topics again
  await page.click('#grade-btn'); await page.waitForSelector('#grade-dlg'); await page.click('.grade-btn[data-grade="6"]');
  await page.waitForFunction(() => !document.querySelector('.mtcard[data-topic=compare]') && document.querySelector('.mtcard'), null, { timeout: 8000 });
  const leo6 = await page.locator('.mtcard').evaluateAll((els) => els.map((e) => e.dataset.topic));
  const g6 = await page.evaluate(async () => (await import('/src/data/math-topics.json')).default.grades['6']);
  ok(JSON.stringify(leo6) === JSON.stringify(g6.slice(0, 3)), 'changing Leo to 六年级 picks this week\'s topics again for grade 6 (' + leo6.join(', ') + ')');
  ok(log.external.length === 0, 'OFFLINE: the whole math flow (list, grade, topics, practice, games, results) made no request outside the app: ' + log.external.join(', '));
  await browser.close();

  // ---- the total time runs out ----
  {
    const t = await start(new Map(), { local: true, clock: '2026-11-12T10:00:00', viewport: { width: 390, height: 844 } });
    await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 2);
    await openMath(t.page, 'Dory');
    await t.page.click('#tab-game'); await t.page.click('#game-start'); await t.page.waitForSelector('#math-q');
    const total = await t.page.textContent('#math-time');
    await t.page.click('.mchoice >> nth=0');
    await t.page.clock.runFor(600000);
    await t.page.waitForSelector('#game-end', { timeout: 10000 });
    ok((await t.page.textContent('#game-end h2')) === '时间到！' && (await t.page.textContent('#game-end .muted')).includes(total) , 'time up: "时间到！" and the time used is the whole time (' + total + ')');
    await t.browser.close();
  }

  // ---- screens, languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape', { width: 1180, height: 820 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const t = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 7); await openMath(t.page, 'Dory');
      const m = await t.page.evaluate(() => {
        const vw = document.documentElement.clientWidth, cards = [...document.querySelectorAll('.mtcard')];
        const bad = cards.filter((c) => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > vw + 1).length;
        const l = Math.min(...cards.map((c) => c.getBoundingClientRect().left)), r = vw - Math.max(...cards.map((c) => c.getBoundingClientRect().right));
        return { sw: document.documentElement.scrollWidth, vw, bad, l, r, n: cards.length, cjk: /[一-鿿]/.test(document.querySelector('.hero h1').textContent + document.querySelector('.tabs').textContent + document.querySelector('.grade-row').textContent + [...document.querySelectorAll('.mpractice, .macc')].map((x) => x.textContent).join('')) };
      });
      ok(m.sw <= m.vw && m.bad === 0 && m.n === 3, `${name} ${dn}: 3 topic cards, nothing cut off or sideways`);
      ok(Math.abs(m.l - m.r) <= 2, `${name} ${dn}: equal space left and right (${Math.round(m.l)} / ${Math.round(m.r)})`);
      if (name !== 'zh') ok(!m.cjk, `${name} ${dn}: title, tabs, grade, buttons and labels are translated`);
      // the game: the longest questions of every topic fit the card, the choices fit the screen
      await t.page.click('#tab-game'); await t.page.click('#game-start'); await t.page.waitForSelector('#math-q');
      const fit = await t.page.evaluate(async () => {
        const G = await import('/src/mathgen.ts'), U = await import('/src/mathui.ts');
        const all = []; for (const id of G.topicIds()) for (let i = 0; i < 60; i++) all.push(G.make(id));
        const longest = all.sort((a, b) => b.q.length - a.q.length).slice(0, 12).concat(all.filter((x) => /hypotenuse|斜边|probab|概率/.test(x.q)).slice(0, 3));
        const el = document.querySelector('#math-q'), card = document.querySelector('#math-card'), bad = [];
        for (const q of longest) { el.textContent = q.q; U.fitQuestion(el, card); await new Promise((res) => setTimeout(res, 0)); /* (the translation observer runs now) */ const r = el.getBoundingClientRect(), c = card.getBoundingClientRect(); if (r.left < c.left || r.right > c.right || r.top < c.top || r.bottom > c.bottom || el.scrollWidth > el.clientWidth + 1) bad.push(q.q + ' [' + el.textContent + ']'); }
        const vw = document.documentElement.clientWidth, ch = [...document.querySelectorAll('.mchoice')].filter((b) => b.getBoundingClientRect().right > vw || b.scrollWidth > b.clientWidth + 1).length;
        return { bad, ch, sw: document.documentElement.scrollWidth, vw, top: document.querySelector('.mchoices').getBoundingClientRect().bottom <= window.innerHeight + 1 };
      });
      ok(fit.bad.length === 0 && fit.ch === 0 && fit.sw <= fit.vw, `${name} ${dn}: the longest questions stay inside the card, the choices fit` + (fit.bad.length ? ' -> ' + fit.bad.join(' | ') : ''));
      ok(fit.top, `${name} ${dn}: the four choices are all on the screen (no scrolling in the game)`);
      if (dn === 'phone') await t.page.screenshot({ path: OUT + `math-game-${name}-phone.png` });
      await t.browser.close();
    }
  }
  await done();
})();
