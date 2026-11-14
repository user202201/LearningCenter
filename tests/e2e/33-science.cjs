// Science, part 1: knowledge cards for fun (not rote learning), NEW EVERY DAY. The library (every card complete, choices honest, every grade has all four fields, a year of
// cards per grade); a day = 6 new cards (the four fields take turns, about 30 % of the grade's lower levels because the grade is the child's HIGHEST level, no repeats);
// old cards come back by the memory curve; the screens (children -> Game | Today | Recorded), the relaxed game (no time limit, a "did you know" text after every answer,
// Next button), the periodic table (fills the width, no scrollbar), typeset formulas, circuits and rules; all offline; English / French on small and large screens.
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


// ---- the cards in English / French (rules 35 / 38 / 65): every text of a card is drawn through `cct`, the logic keeps the Chinese original ----
const CJK_RE = /[一-鿿]/;
const stripBr = (s) => s.replace(/\([^()]*\)|（[^（）]*）/g, '');
async function cardsTranslated() {
  const lib = JSON.parse(fs.readFileSync('src/data/science-cards.json', 'utf8'));
  const sameTex = (a, b) => { const x = a.match(/\$[^$]*\$/g) || [], y = [...(b.match(/\$[^$]*\$/g) || [])]; if (x.length !== y.length) return false; for (const p of x.filter((q) => !CJK_RE.test(q))) { const i = y.indexOf(p); if (i < 0) return false; y.splice(i, 1); } return true; };
  for (const [loc, lang] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    if (process.env.CARDS_LANG && process.env.CARDS_LANG !== lang) continue;   // (development: one language)
    // ---- the whole library against the tables (Node) ----
    const main = JSON.parse(fs.readFileSync(`src/data/trans/${lang}.json`, 'utf8')), cm = JSON.parse(fs.readFileSync(`src/data/trans/cards.${lang}.json`, 'utf8'));
    const tr = (x) => (!CJK_RE.test(x) ? x : cm[x] ?? main[x] ?? x);
    const miss = [], left = [], tex = [], same = [], empty = [];
    for (const c of lib.cards) {
      for (const [f, x] of [['q', c.q], ['a', c.a], ['e', c.e], ...c.w.map((w, i) => ['w' + i, w])]) {
        const v = tr(x);
        if (CJK_RE.test(x) && cm[x] === undefined && main[x] === undefined) miss.push(c.id + f);
        else if (!v.trim()) empty.push(c.id + f);
        else if (CJK_RE.test(stripBr(v))) left.push(`${c.id}.${f}: ${v.slice(0, 30)}`);
        else if (x.includes('$') && !sameTex(x, v)) tex.push(`${c.id}.${f}: ${x.slice(0, 30)} -> ${v.slice(0, 30)}`);
      }
      const ch = [c.a, ...c.w].map(tr);
      if (new Set(ch).size < 4) same.push(c.id + ' ' + ch.join(' | '));
    }
    for (const v of Object.values(lib.topics)) { if (!cm[v] || CJK_RE.test(stripBr(cm[v]))) miss.push('topic ' + v); }
    ok(lib.cards.length === 3501 && miss.length === 0 && empty.length === 0, `${lang}: all ${lib.cards.length} cards (question, answer, "did you know" sentence, every wrong choice) and the ${Object.keys(lib.topics).length} topic labels have a translation` + (miss.length ? ' -> missing ' + miss.slice(0, 4).join(',') : ''));
    ok(left.length === 0, `${lang}: no Chinese left outside brackets in any translated card text` + (left.length ? ' -> ' + left.slice(0, 3).join(' | ') : ''));
    ok(tex.length === 0, `${lang}: the TeX pieces ($...$) of the cards are untouched (only a \\text{...} is translated)` + (tex.length ? ' -> ' + tex.slice(0, 2).join(' | ') : ''));
    ok(same.length === 0, `${lang}: the four choices of every card stay four different texts after the translation` + (same.length ? ' -> ' + same.slice(0, 3).join(' | ') : ''));
    ok(new Set(lib.cards.map((c) => c.id)).size === 3501, 'the card ids are unchanged (3501 unique)');
    // the sample: the longest translated texts, cards with TeX, some random ones (a fixed generator)
    let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const weight = (c) => tr(c.q).length + Math.max(...[c.a, ...c.w].map((x) => tr(x).length)) + tr(c.e).length / 2;
    const longest = [...lib.cards].sort((a, b) => weight(b) - weight(a)).slice(0, 6);
    const withTex = lib.cards.filter((c) => /\$/.test([c.q, c.a, c.e, ...c.w].join('|'))).sort(() => rnd() - 0.5).slice(0, 6);
    const ids = new Set([...longest, ...withTex].map((c) => c.id));
    for (const c of [...lib.cards].sort(() => rnd() - 0.5)) { if (ids.size >= 20) break; ids.add(c.id); }
    const sample = lib.cards.filter((c) => ids.has(c.id)).sort((a, b) => weight(b) - weight(a)).map((c) => ({ id: c.id, t: c.t, q: c.q, a: c.a, w: c.w, e: c.e }));
    ok(sample.length === 20, `${lang}: 20 sampled cards (the 6 longest, 6 with TeX, random): ${sample.slice(0, 3).map((c) => c.id).join(', ')} ...`);
    const plainOf = (x) => tr(x).replace(/\$/g, '');
    const sampleX = sample.map((c) => ({ ...c, qp: plainOf(c.q), ap: plainOf(c.a), ep: plainOf(c.e), tp: tr(lib.topics[c.t]) }));
    // earlier days with other cards (old knowledge to review, the recorded list)
    const older = lib.cards.filter((c) => c.g <= 9 && !ids.has(c.id)).sort(() => rnd() - 0.5).slice(0, 36).map((c) => c.id);

    for (const [dn, vp] of [['phone320', { width: 320, height: 568 }], ['phone390', { width: 390, height: 844 }]]) {
      if (process.env.CARDS_DN && process.env.CARDS_DN !== dn) continue;
      const t = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      const page = t.page, tag = `${lang} ${dn}`;
      await addKid(page, 'Dory'); await setGrade(page, 'Dory', 9);
      await page.evaluate(({ older, sample }) => {
        const kid = JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id;
        localStorage.setItem(`learn.local.science/${kid}.json`, JSON.stringify({ weeks: [0, 1, 2].map((d) => ({ start: `2026-11-0${9 + d}`, chars: older.slice(d * 12, d * 12 + 12) })) }));
        // the errors book: the 20 sampled cards (the same Q the game makes)
        localStorage.setItem(`learn.local.science/${kid}.review.json`, JSON.stringify({ topics: {}, mistakes: sample.map((c) => ({ topic: c.t, q: c.q, a: c.a, choices: [c.a, ...c.w], chk: 'true' })), cards: {} }));
      }, { older, sample });
      await openScience(page, 'Dory');
      const day = await page.evaluate(() => ({ today: [...document.querySelectorAll('.slist:not(#again-list) .scard')].map((e) => e.dataset.card), again: [...document.querySelectorAll('#again-list .scard')].map((e) => e.dataset.card) }));
      ok(day.today.length === 6 && day.again.length === 10, `${tag}: today 6 new cards and 10 old ones to review (${day.today.length} / ${day.again.length})`);
      const byId = Object.fromEntries(lib.cards.map((c) => [c.id, c]));
      // every card on the page: nothing Chinese outside brackets, the choices are the translations, the right one is found by the Chinese original
      const scan = async (label) => {
        const r = await page.evaluate(() => {
          const strip = (s) => s.replace(/\([^()]*\)|（[^（）]*）/g, ''), CJK = /[一-鿿]/, out = { cjk: [], keys: [], layout: [] };
          const vw = document.documentElement.clientWidth;
          const w = document.createTreeWalker(document.querySelector('.scroll') || document.body, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) if (CJK.test(strip(n.nodeValue))) out.cjk.push(n.nodeValue.trim().slice(0, 30));
          for (const e of document.querySelectorAll('.scard')) {
            const id = e.dataset.card, r = e.getBoundingClientRect();
            const opts = [...e.querySelectorAll('.sopt')];
            out.keys.push({ id, k: opts.map((o) => o.dataset.k), right: opts.filter((o) => o.dataset.right === '1').map((o) => o.dataset.k), plain: opts.map((o) => o.querySelector('.sopt-t').dataset.plain), q: e.querySelector('.sq').dataset.plain, e: e.querySelector('.sfun').dataset.plain, topic: e.querySelector('.stopic').textContent });
            if (r.left < -1 || r.right > vw + 1 || e.scrollWidth > e.clientWidth + 1) out.layout.push('card ' + id);
            for (const o of opts) { const b = o.getBoundingClientRect(); if (b.right > r.right + 1 || b.left < r.left - 1 || o.scrollWidth > o.clientWidth + 1) out.layout.push('opt ' + id + ' ' + o.textContent.slice(0, 20)); }
          }
          if (document.documentElement.scrollWidth > vw) out.layout.push('page sideways');
          return out;
        });
        ok(r.cjk.length === 0, `${tag} ${label}: no Chinese outside brackets on the screen (${r.cjk.length}: ${r.cjk.slice(0, 3).join(' | ')})`);
        const wrong = [];
        for (const k of r.keys) {
          const c = byId[k.id];
          const good = k.right.length === 1 && k.right[0] === c.a && JSON.stringify([...k.k].sort()) === JSON.stringify([c.a, ...c.w].sort()) && k.plain.every((p, i) => p === plainOf(k.k[i])) && k.q === plainOf(c.q) && k.e === plainOf(c.e) && k.topic === tr(lib.topics[c.t]);
          if (!good) wrong.push(k.id);
        }
        ok(r.keys.length > 0 && wrong.length === 0, `${tag} ${label}: ${r.keys.length} cards show the translated question, four translated choices, topic and sentence; the right choice is the one of the Chinese original (data-k)` + (wrong.length ? ' -> ' + wrong.slice(0, 3).join(',') : ''));
        ok(r.layout.length === 0, `${tag} ${label}: nothing cut off or sideways (long choices wrap)` + (r.layout.length ? ' -> ' + r.layout.slice(0, 3).join(' | ') : ''));
        return r;
      };
      await scan('today + review');
      await page.click('.scard >> nth=0');
      const open = await page.evaluate(() => { const e = document.querySelector('.scard.open'); return { sans: getComputedStyle(e.querySelector('.sans')).display, right: getComputedStyle(e.querySelector('.sopt[data-right="1"]')).backgroundColor, other: getComputedStyle(e.querySelector('.sopt[data-right="0"]')).backgroundColor, id: e.dataset.card, e: e.querySelector('.sfun').dataset.plain }; });
      ok(open.sans === 'block' && open.right !== open.other && open.e === plainOf(byId[open.id].e), `${tag}: a tap marks the right choice and shows the translated "did you know" sentence`);
      if (dn === 'phone390') await page.screenshot({ path: OUT + `science-cards-${lang}-${dn}.png` });
      // recorded: the errors book + a random 30 (with another batch)
      await page.click('[data-tab=learned]'); await page.waitForSelector('#mistakes-title');
      const book = await page.evaluate(() => [...document.querySelectorAll('.mmis')].map((e) => ({ q: e.firstChild.dataset.plain, a: e.lastChild.dataset.plain, k: e.lastChild.dataset.k })));
      ok(book.length === 20 && book.every((m, i) => m.q === sampleX[i].qp && m.a === sampleX[i].ap && m.k === sampleX[i].a), `${tag}: the errors book lists the 20 questions and answers in ${lang} (the Chinese answer stays in data-k)`);
      await scan('recorded');
      await page.click('#reshuffle'); await scan('recorded, another batch');
      // the game: the 20 cards of the errors book, right and wrong answers
      await page.click('#redo-mistakes'); await page.waitForSelector('#math-q');
      const gameCjk = () => page.evaluate(() => { const strip = (s) => s.replace(/\([^()]*\)|（[^（）]*）/g, ''), out = []; const w = document.createTreeWalker(document.querySelector('#game'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[一-鿿]/.test(strip(n.nodeValue))) out.push(n.nodeValue.trim().slice(0, 30)); for (const e of document.querySelectorAll('#game [title], #game [aria-label]')) for (const a of ['title', 'aria-label']) { const v = e.getAttribute(a); if (v && /[一-鿿]/.test(strip(v))) out.push(a + ':' + v.slice(0, 30)); } return out; });
      const gameLayout = () => page.evaluate(() => {
        const vw = document.documentElement.clientWidth, bad = [];
        if (document.documentElement.scrollWidth > vw) bad.push('page sideways');
        const q = document.querySelector('#math-q'), card = document.querySelector('#math-card'), r = q.getBoundingClientRect(), c = card.getBoundingClientRect();
        if (r.left < c.left - 1 || r.right > c.right + 1 || r.bottom > c.bottom + 1 || q.scrollWidth > q.clientWidth + 1) bad.push('question');
        for (const b of document.querySelectorAll('.mchoice')) { const x = b.getBoundingClientRect(); if (x.left < -1 || x.right > vw + 1 || b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) bad.push('choice ' + b.textContent.slice(0, 18)); }
        const g = document.querySelector('#game').getBoundingClientRect(); if (g.width > vw + 1) bad.push('game wider than the screen');
        return bad;
      });
      const badCjk = [], badLayout = [], badLogic = [];
      for (let i = 0; i < 20; i++) {
        await page.waitForSelector('#math-q');
        const c = sampleX[i];
        const st = await page.evaluate(() => ({ q: document.querySelector('#math-q').dataset.plain, vs: [...document.querySelectorAll('.mchoice')].map((b) => ({ v: b.dataset.v, p: b.dataset.plain })), topic: document.querySelector('#math-topic').textContent, prog: document.querySelector('#game-progress').textContent }));
        const expChoices = [c.a, ...c.w];
        if (st.q !== c.qp || JSON.stringify(st.vs.map((x) => x.v).sort()) !== JSON.stringify([...expChoices].sort()) || st.vs.some((x) => x.p !== plainOf(x.v)) || st.topic !== c.tp || st.prog !== `${i + 1} / 20`) badLogic.push(`${c.id}: q=${(st.q || '').slice(0, 30)} topic=${st.topic}`);
        let cj = await gameCjk(); if (cj.length) badCjk.push(`${c.id} ask: ${cj[0]}`);
        const ly = await gameLayout(); if (ly.length) badLayout.push(`${c.id} ask: ${ly.slice(0, 2).join(',')}`);
        const wrongPick = i % 2 === 1;
        const pick = wrongPick ? st.vs.find((x) => x.v !== c.a).v : c.a;
        await page.locator('.mchoice').evaluateAll((els, v) => els.find((e) => e.dataset.v === v).click(), pick);
        await page.waitForSelector('#math-explain');
        const fb = await page.evaluate(() => ({ right: [...document.querySelectorAll('.mchoice.right')].map((b) => b.dataset.v), wrong: [...document.querySelectorAll('.mchoice.wrong')].map((b) => b.dataset.v), e: [...document.querySelectorAll('#math-explain p.user')].pop()?.dataset.plain, locked: document.querySelectorAll('.mchoice:disabled').length, answerShown: [...document.querySelectorAll('#math-explain b.user')].map((b) => b.dataset.plain) }));
        const okFb = fb.right.length === 1 && fb.right[0] === c.a && fb.locked === 4 && fb.e === c.ep && (wrongPick ? fb.wrong.length === 1 && fb.wrong[0] === pick && fb.answerShown.includes(c.ap) : fb.wrong.length === 0);
        if (!okFb) badLogic.push(`${c.id} feedback: ${JSON.stringify({ r: fb.right, w: fb.wrong, e: (fb.e || '').slice(0, 20), shown: fb.answerShown })}`);
        cj = await gameCjk(); if (cj.length) badCjk.push(`${c.id} feedback: ${cj[0]}`);
        const ly2 = await gameLayout(); if (ly2.length) badLayout.push(`${c.id} feedback: ${ly2.slice(0, 2).join(',')}`);
        if (i === 1 && dn === 'phone390') await page.screenshot({ path: OUT + `science-game-wrong-${lang}-${dn}.png` });
        await page.click('#math-next');
      }
      await page.waitForSelector('#game-end');
      ok(badLogic.length === 0, `${tag}: the game of the 20 sampled cards: translated question / choices / topic, the right choice marked (green) and the wrong one (red) by the Chinese original, translated sentence` + (badLogic.length ? ' -> ' + badLogic.slice(0, 2).join(' | ') : ''));
      ok(badCjk.length === 0, `${tag}: no Chinese outside brackets anywhere in the game (asking and after the answer)` + (badCjk.length ? ' -> ' + badCjk.slice(0, 3).join(' | ') : ''));
      ok(badLayout.length === 0, `${tag}: the long questions, choices and sentences fit (no overflow, nothing clipped)` + (badLayout.length ? ' -> ' + badLayout.slice(0, 3).join(' | ') : ''));
      const end = await page.evaluate(() => ({ h2: document.querySelector('#game-end h2').textContent, final: document.querySelector('#game-final').textContent, rows: [...document.querySelectorAll('.mrow')].map((r) => r.firstChild.textContent) }));
      ok(end.final === '10' && end.rows.length > 0 && end.rows.every((r) => !CJK_RE.test(stripBr(r))) && !CJK_RE.test(stripBr(end.h2)), `${tag}: the end screen: 10 / 20, "${end.h2}", the topic rows are translated (${end.rows.slice(0, 2).join(', ')}) ${end.final}`);
      await page.click('#game-done'); await page.waitForSelector('.tabs');
      // the memory boxes and the errors book work by the Chinese original: 10 right (box 1), 10 wrong (box 0)
      const saved = await page.evaluate(() => { const k = JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id; return JSON.parse(localStorage.getItem(`learn.local.science/${k}.review.json`)); });
      const boxes = sample.map((c) => saved.cards && saved.cards[c.id] && saved.cards[c.id].box);
      ok(boxes.every((b, i) => b === (i % 2 === 1 ? 0 : 1)) && saved.mistakes.length === 10 && saved.mistakes.every((m) => sample.some((c) => c.q === m.q && c.a === m.a)), `${tag}: saved by the Chinese original: right answers box 1, wrong box 0, the errors book keeps the 10 wrong ones (Chinese q / a) ${JSON.stringify(boxes)} ${saved.mistakes.length}`);
      // the whole library, rendered like the cards do, KaTeX included: no TeX error, no Chinese outside brackets
      if (dn === 'phone390') {
        const r = await page.evaluate(async ({ items }) => {
          const M = await import('/src/mathtext.ts'); const C = await import('/src/contenttr.ts');
          await C.loadCardTr();
          const box = document.createElement('div'); document.body.append(box);
          const els = items.map((s) => { const e = document.createElement('div'); box.append(e); M.renderRich(e, C.cct(s)); return e; });
          await new Promise((res) => setTimeout(res, 2500));
          const strip = (s) => s.replace(/\([^()]*\)|（[^（）]*）/g, '');
          const errs = els.filter((e) => e.querySelector('.katex-error')).length, cjk = els.filter((e) => /[一-鿿]/.test(strip(e.textContent))).length, typeset = els.filter((e) => e.querySelector('.katex')).length;
          box.remove(); return { n: els.length, errs, cjk, typeset };
        }, { items: [...new Set(lib.cards.flatMap((c) => [c.q, c.a, c.e, ...c.w]).filter((x) => x.includes('$')))] });
        ok(r.n > 100 && r.errs === 0 && r.cjk === 0 && r.typeset >= r.n - 3, `${lang}: ${r.n} card texts with TeX typeset by KaTeX in ${lang}: ${r.typeset} typeset, ${r.errs} TeX errors, ${r.cjk} with Chinese left`);
      }
      ok(t.log.external.length === 0, `${tag}: no request outside the app (the card tables are part of the program)` + (t.log.external.length ? ' -> ' + t.log.external[0] : ''));
      await t.browser.close();
    }
  }
  // zh stays what it was: Chinese texts, the choices equal their data-k, and no translation table is loaded
  {
    const t = await start(new Map(), { local: true, locale: 'zh-CN', viewport: { width: 390, height: 844 }, today: '2026-11-12' });
    const reqs = []; t.page.on('request', (r) => { if (/trans\//.test(r.url())) reqs.push(r.url()); });
    await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 9); await openScience(t.page, 'Dory');
    const r = await t.page.evaluate(() => ({ n: document.querySelectorAll('.scard').length, zh: [...document.querySelectorAll('.scard')].every((e) => /[一-鿿]/.test(e.querySelector('.sq').textContent) && [...e.querySelectorAll('.sopt')].every((o) => o.dataset.k.replace(/\$/g, '') === o.querySelector('.sopt-t').dataset.plain)) }));
    ok(r.n === 6 && r.zh, 'zh: the cards show the Chinese texts exactly as before (every choice equals its data-k)');
    ok(reqs.length === 0, 'zh: no translation table is loaded for Chinese');
    await t.browser.close();
  }
}

(async () => {
  if (process.env.CARDS_ONLY) { await cardsTranslated(); await done(); return; }
  // ---- the library, the daily pick and the memory curve (pure) ----
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const SM = await import('/src/sciencemodel.ts'), G = await import('/src/game.ts');
      const lib = await SM.loadScience();
      const res = { n: lib.cards.length, bad: [], grades: {}, days: [], round: [], el: lib.cards.filter((c) => c.id.startsWith('el-')).length, domains: lib.domains.map((d) => d[0]) };
      const domainOf = (t) => lib.domains.find((d) => d[1].includes(t))[0];
      const ids = new Set();
      for (const c of lib.cards) {
        if (ids.has(c.id)) res.bad.push('duplicate id ' + c.id); ids.add(c.id);
        const opts = [c.a, ...c.w];
        if (!c.q || !c.a || !c.e || c.e.length > 90) res.bad.push('incomplete ' + c.id);
        else if (c.w.length !== 3 || new Set(opts).size !== 4) res.bad.push('choices ' + c.id + ' ' + opts.join('|'));
        else if (!lib.topics[c.t]) res.bad.push('topic ' + c.id);
        else if (c.q.length > 90) res.bad.push('long question ' + c.id);
      }
      for (let g = 1; g <= 9; g++) { const cs = lib.cards.filter((c) => SM.inGrade(c, g)); res.grades[g] = [cs.length, Object.fromEntries(lib.domains.map((d) => [d[0], cs.filter((c) => d[1].includes(c.t)).length]))]; }
      // a child of grade 4: 60 days in a row
      let kid = { weeks: [] };
      const seen = new Set();
      for (let d = 0; d < 60; d++) {
        const day = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
        const pick = SM.pickDaily(lib, kid, 4, day, () => false, 'k1');
        const cs = pick.map((i) => lib.byId.get(i));
        res.days.push({ n: pick.length, distinct: new Set(pick).size, repeats: pick.filter((i) => seen.has(i)).length, domains: new Set(cs.map((c) => domainOf(c.t))).size, lower: cs.filter((c) => SM.isLower(c, 4)).length, above: cs.filter((c) => c.g > 4).length });
        pick.forEach((i) => seen.add(i));
        kid = { weeks: [...kid.weeks, { start: day, chars: pick }] };
      }
      res.same = JSON.stringify(SM.pickDaily(lib, { weeks: [] }, 4, '2026-11-12', () => false, 'k1')) === JSON.stringify(SM.pickDaily(lib, { weeks: [] }, 4, '2026-11-12', () => false, 'k1'));
      res.other = JSON.stringify(SM.pickDaily(lib, { weeks: [] }, 4, '2026-11-12', () => false, 'k1')) !== JSON.stringify(SM.pickDaily(lib, { weeks: [] }, 4, '2026-11-12', () => false, 'k2'));
      // grade 1: nothing lower exists; grade 9 uses lower grades too
      const g1 = SM.pickDaily(lib, { weeks: [] }, 1, '2026-11-12', () => false, 'x').map((i) => lib.byId.get(i));
      res.g1 = [g1.length, g1.every((c) => c.g <= 1 && (c.gx ?? c.g) >= 1)];
      const g9 = SM.pickDaily(lib, { weeks: [] }, 9, '2026-11-12', () => false, 'x').map((i) => lib.byId.get(i));
      res.g9 = [g9.length, g9.every((c) => c.g <= 9)];
      // a grade used up: a new round, the wrong cards first
      const mine = lib.cards.filter((c) => SM.inGrade(c, 4) || SM.isLower(c, 4)).map((c) => c.id);
      const full = { weeks: [{ start: '2000-01-01', chars: mine }] };
      const worst = mine[5];
      res.round = SM.pickDaily(lib, full, 4, '2026-11-12', (id) => id === worst, 'x');
      res.worst = worst;
      // the memory curve: seen on day 1 (right) -> due again after 1 day; a wrong one comes back at once; cards of earlier days never asked come back too
      const k2 = { weeks: [{ start: '2026-11-01', chars: ['a', 'b', 'c'] }, { start: '2026-11-02', chars: ['d'] }, { start: '2026-11-12', chars: ['z'] }] };
      let rv = { cards: {} };
      rv = SM.applyScience(rv, [{ topic: 't', right: true, q: { q: 'qa' } }, { topic: 't', right: false, q: { q: 'qb' } }], new Map([['qa', { id: 'a' }], ['qb', { id: 'b' }]]), '2026-11-01');
      res.box = [rv.cards.a.box, rv.cards.a.due, rv.cards.b.box, rv.cards.b.due];
      res.rv = { later: SM.reviewIds(k2, rv, '2026-11-12'), tooEarly: SM.reviewIds({ weeks: [{ start: '2026-11-01', chars: ['a'] }] }, rv, '2026-11-01') };
      // an old card that is due, with the stats of today's game
      const lib2 = { byId: new Map(['a', 'b', 'c', 'd', 'z'].map((i) => [i, { id: i, t: 't', q: 'q' + i, a: 'A', w: ['x', 'y', 'w'], e: 'e', g: 1 }])) };
      const game = SM.buildGame(lib2, k2, rv, '2026-11-12');
      res.game = [game.questions.length, game.fresh, game.again];
      res.noOutside = performance.getEntriesByType('resource').filter((x) => !x.name.startsWith(location.origin)).length;
      const hp = lib.cards.filter((c) => c.id.startsWith('x-hp-')), hc = lib.cards.filter((c) => c.id.startsWith('x-hc-')), hb = lib.cards.filter((c) => c.id.startsWith('x-hb-'));
      res.phys = [hp.length, hc.length, hb.length, ['电流表应该怎样接入电路？', '通电导体在磁场中受力的方向，用什么判断？', '导体切割磁感线产生感应电流的方向，用什么判断？', '通电螺线管的磁场方向用什么来判断？'].filter((q) => lib.cards.some((c) => c.q === q)).length, lib.cards.filter((c) => /\$/.test(c.a)).length];
      const els = lib.cards.filter((c) => c.id.startsWith('el-')); res.elBad = els.filter((c) => new Set([c.a, ...c.w]).size !== 4).length;
      const fe = lib.byId.get('el-sym-26'); res.fe = fe ? [fe.q, fe.a] : [];
      return res;
    });
    ok(r.n >= 2000 && r.bad.length === 0, r.n + ' cards: every card has a question, answer, 3 different wrong choices, a short "did you know" text' + (r.bad.length ? ' -> ' + r.bad.slice(0, 5).join('; ') : ''));
    ok(Object.entries(r.grades).every(([g, [n, d]]) => n >= 300 && Object.values(d).every((x) => x >= 30)), 'every grade 1-9 has >= 300 cards and 30+ in each of the four fields (the fields are not equally big: a field that runs out is made up from the others) ' + JSON.stringify(Object.fromEntries(Object.entries(r.grades).map(([g, [n]]) => [g, n]))));
    ok(r.days.every((d) => d.n === 6 && d.distinct === 6 && d.repeats === 0), '60 days in a row: 6 different NEW cards every day, never a card he already had');
    ok(r.days.every((d) => d.domains >= 3) && r.days.filter((d) => d.domains === 4).length >= 30, 'the four fields take turns (every day 3-4 of them, most days all four)');
    ok(r.days.every((d) => d.above === 0) && r.days.reduce((s, d) => s + d.lower, 0) >= 20, 'the grade is his HIGHEST level: never a card of a higher grade, and lower-grade cards are mixed in (' + r.days.reduce((s, d) => s + d.lower, 0) + ' of 360 are lower)');
    ok(r.same && r.other, 'the day\'s cards are the same on every call of the same day for one child, and different for another child');
    ok(r.g1[0] === 6 && r.g1[1] && r.g9[0] === 6 && r.g9[1], 'grade 1 (nothing lower exists) and grade 9 both get 6 cards');
    ok(r.round.length === 6 && r.round.includes(r.worst), 'a used-up grade starts a new round with the cards he got wrong');
    ok(r.box[0] === 1 && r.box[1] === '2026-11-02' && r.box[2] === 0, 'memory curve: a right answer climbs a box (due the next day), a wrong one drops to box 0: ' + r.box.join(' '));
    ok(r.rv.later.includes('a') && r.rv.later.includes('b') && !r.rv.later.includes('z') && r.rv.later.every((i) => i !== 'z'), 'old cards come back (due ones and ones never asked), today\'s own cards are not "old": ' + r.rv.later.join());
    ok(r.game[1] === 1 && r.game[2] >= 3 && r.game[0] === r.game[1] + r.game[2], 'the game = today\'s new cards + the old ones that are due: ' + r.game.join('/'));
    ok(r.elBad === 0 && (r.fe.length === 0 || /Fe|铁/.test(r.fe.join())), 'the element cards (if any) are made from the periodic table');
    ok(r.phys[0] >= 150 && r.phys[1] >= 70 && r.phys[2] >= 70 && r.phys[3] === 4 && r.phys[4] >= 20, 'junior-high physics (circuits, the left-hand / right-hand / Ampère rules ...), chemistry and biology cards are there: ' + r.phys.join(' / ') + ' (physics / chemistry / biology / rule cards / answers typeset as TeX)');
    ok(r.noOutside === 0, 'nothing is fetched from outside');
    await t.browser.close();
  }

  // ---- the screens ----
  const { browser, page, log } = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  await addKid(page, 'Dory'); await setGrade(page, 'Dory', 4);
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  ok(await page.locator('.subject[data-subject=science] .s-soon').count() === 0, 'the science card is open now (no "coming soon" label)');
  await page.click('.subject[data-subject=science]'); await page.waitForSelector('.kids');
  ok((await page.textContent('.hero h1')) === '科学' && (await page.locator('.kid .ksub').first().textContent()).includes('四年级') && await page.locator('#open-periodic').count() === 1 && await page.locator('#open-formulas').count() === 1 && await page.locator('#open-circuits').count() === 1, 'the science page: the children (with their grade) and the periodic table, formulas and circuits buttons');
  await page.click('.kid'); await page.waitForSelector('.scard');
  const lib = await page.evaluate(async () => { const SM = await import('/src/sciencemodel.ts'); const l = await SM.loadScience(); return { cards: l.cards.map((c) => ({ id: c.id, q: c.q, a: c.a, e: c.e, t: c.t, g: c.g, gx: c.gx })), domains: l.domains }; });
  const byId = Object.fromEntries(lib.cards.map((c) => [c.id, c]));
  const todayIds = await page.locator('.scard').evaluateAll((els) => els.map((e) => e.dataset.card));
  ok(todayIds.length === 6 && (await page.locator('.tabs button').allTextContents()).join('|') === '游戏|今天|已入库 6', 'today: 6 new knowledge cards (tabs 游戏 | 今天 | 已入库 6)');
  ok((await page.textContent('#day-title')) === '新知识（6）' && await page.locator('#again-title').count() === 0, 'the first day has no old knowledge to review yet');
  ok(todayIds.every((id) => byId[id].g <= 4), 'every card is of grade 4 or lower (his highest level)');
  ok(!(await page.locator('.scard.open').count()), 'the answers are hidden at first');
  const optsOk = await page.locator('.scard').evaluateAll((els, byId) => els.every((e) => { const o = [...e.querySelectorAll('.sopt')]; const c = byId[e.dataset.card]; return o.length === 4 && o.filter((x) => x.dataset.right === '1').length === 1 && o.some((x) => x.textContent.replace(/[ABCD]/, '').includes(c.a.replace(/\$/g, '').slice(0, 3))) && o.every((x) => x.getBoundingClientRect().height > 20 && e.getBoundingClientRect().right >= x.getBoundingClientRect().right); }), byId);
  ok(optsOk, 'every question card shows its four choices (A-D) on the card, so the question can be answered by looking at it');
  ok(await page.locator('.scard .sopt.right, .scard.open').count() === 0, 'the right choice is not marked before the tap');
  await page.click('.scard >> nth=0');
  ok(await page.locator('.scard.open .sans').isVisible() && (await page.textContent('.scard.open .sans')).includes(byId[todayIds[0]].a.replace(/\$/g, '')) && (await page.textContent('.scard.open .sfun')).includes(byId[todayIds[0]].e.replace(/\$/g, '')), 'a tap shows the answer and the "did you know" sentence');
  ok(await page.locator('.scard.open .sopt[data-right="1"]').evaluate((e) => getComputedStyle(e).backgroundColor !== getComputedStyle(e.parentElement.querySelector('.sopt[data-right="0"]')).backgroundColor), 'a tap marks the right choice (green) among the four');
  await page.screenshot({ path: OUT + 'science-day-phone.png' });
  // reload: the same cards (made once)
  await page.reload(); await page.waitForSelector('.scard');
  ok(JSON.stringify(await page.locator('.scard').evaluateAll((els) => els.map((e) => e.dataset.card))) === JSON.stringify(todayIds), 'the day\'s cards are made once: after a reload they are the same');
  // the relaxed game
  await page.click('#tab-game'); await page.waitForSelector('#game-start');
  ok(/今天：6 个新知识，0 个回顾，不限时/.test(await page.textContent('#math-info')), 'the lobby: 6 new, 0 to review, no time limit');
  await page.click('#game-start'); await page.waitForSelector('#math-q');
  ok(await page.locator('#math-bar').count() === 0 && await page.locator('.mtime').count() === 0, 'the game has no time bar');
  let wrongDone = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('#math-q');
    const q = (await page.getAttribute('#math-q', 'data-plain')).trim();
    const card = lib.cards.find((c) => c.q.replace(/\$/g, '') === q);
    const right = card.a;
    const k = i === 1
      ? await page.locator('.mchoice').evaluateAll((els, a) => els.findIndex((e) => e.dataset.v !== a), right)
      : await page.locator('.mchoice').evaluateAll((els, a) => els.findIndex((e) => e.dataset.v === a), right);
    await page.locator('.mchoice').nth(k).click();
    await page.waitForSelector('#math-explain');
    const ex = await page.textContent('#math-explain');
    if (i === 1) wrongDone = ex.includes('正确答案');
    if (i === 0) {
      ok(ex.replace(/\$/g, '').includes(card.e.replace(/\$/g, '')), 'after the answer the "did you know" text of the card is shown: ' + card.e.slice(0, 20) + '…');
      ok((await page.locator('.mchoice:disabled').count()) === 4, 'the choices are locked and the game WAITS for the Next button (no automatic jump)');
    }
    await page.click('#math-next');
  }
  ok(wrongDone, 'a wrong answer says "没关系" and shows the right answer and the text');
  await page.waitForSelector('#game-end');
  ok((await page.textContent('#game-end h2')) === '探索完成。' && (await page.textContent('#game-final')) === '5' && !(await page.textContent('#game-end')).includes('用时'), 'the end: "探索完成。", 5 / 6, no time shown');
  await page.screenshot({ path: OUT + 'science-end-phone.png' });
  await page.click('#game-done'); await page.waitForSelector('.tabs');
  // saved: boxes of the cards in science/<kid>.review.json
  const saved = await page.evaluate(() => { const k = JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id; return JSON.parse(localStorage.getItem(`learn.local.science/${k}.review.json`) || 'null'); });
  ok(saved && Object.keys(saved.cards || {}).length === 6 && Object.values(saved.cards).filter((c) => c.box === 1).length === 5 && Object.values(saved.cards).filter((c) => c.box === 0).length === 1, 'the memory boxes are saved: 5 cards in box 1 (right), 1 in box 0 (wrong)');
  // recorded: errors book + a sample
  await page.click('[data-tab=learned]'); await page.waitForSelector('#mistakes-title');
  ok((await page.textContent('#mistakes-title')) === '错题本（1）' && await page.locator('.scard').count() === 6, 'Recorded: the errors book (1 wrong) and the cards (a random 30 of them: all 6)');
  await page.click('#redo-mistakes'); await page.waitForSelector('#math-q');
  ok((await page.textContent('#game-progress')) === '1 / 1', 'redo: a game of exactly that one card');
  await page.click('#game-quit'); await page.click('dialog button.danger'); await page.waitForSelector('.tabs');

  // the periodic table
  await page.evaluate(() => (location.hash = '#/subject/science')); await page.waitForSelector('#open-periodic');
  await page.click('#open-periodic'); await page.waitForSelector('.pt-cell');
  ok(await page.locator('.pt-cell').count() === 118, 'periodic table: 118 elements');
  const pos = await page.evaluate(() => { const g = (n) => document.querySelector(`.pt-cell[data-n="${n}"]`).style; return [g(1).gridColumn + '/' + g(1).gridRow, g(2).gridColumn + '/' + g(2).gridRow, g(26).gridColumn + '/' + g(26).gridRow, g(57).gridColumn + '/' + g(57).gridRow, g(89).gridColumn + '/' + g(89).gridRow, g(118).gridColumn + '/' + g(118).gridRow].join(' '); });
  ok(pos === '1/1 18/1 8/4 3/9 3/10 18/7', 'the layout is the real table (H, He, Fe in period 4 group 8, the lanthanides and actinides in their own rows, Og): ' + pos);
  const fitW = await page.evaluate(() => { const w = document.querySelector('.pt-wrap'), g = document.querySelector('#pt-grid'); const r = g.getBoundingClientRect(); return { scroll: w.scrollWidth <= w.clientWidth + 1 && document.documentElement.scrollWidth <= document.documentElement.clientWidth, inside: r.left >= 0 && r.right <= innerWidth, ov: getComputedStyle(w).overflowX }; });
  ok(fitW.scroll && fitW.inside && fitW.ov !== 'auto' && fitW.ov !== 'scroll', 'the periodic table fits the screen width (phone): no scroll bar, nothing outside: ' + JSON.stringify(fitW));
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
  await page.click('#fm-化学');
  ok(all >= 30 && (await page.locator('.fm-row').count()) < all && (await page.locator('.fm-row').evaluateAll((els) => els.every((e) => e.dataset.k === '化学'))), 'formulas and equations: ' + all + ' in all, the filter 化学 shows only chemistry');
  await page.click('#fm-all');
  await page.waitForFunction(() => document.querySelectorAll('.fm-formula .katex').length > 10, null, { timeout: 8000 });
  const ty = await page.evaluate(() => ({ stacked: document.querySelectorAll('.fm-formula .mfrac').length, sup: document.querySelectorAll('.fm-formula .msupsub').length, rows: document.querySelectorAll('.fm-row').length }));
  ok(ty.stacked >= 5 && ty.sup >= 5, 'formulas are typeset (stacked fractions ' + ty.stacked + ', exponents / subscripts ' + ty.sup + ' of ' + ty.rows + ' formulas)');
  await page.screenshot({ path: OUT + 'science-formulas-phone.png' });
  ok(await page.locator('.fm-row').count() >= 150, 'the formulas page holds all subjects: ' + (await page.locator('.fm-row').count()) + ' formulas');
  ok(await page.locator('#fm-数学').count() === 1 && (await page.locator('.fm-group').evaluateAll((els) => els.map((e) => e.dataset.k))).some((k) => /数学/.test(k)), 'maths formulas (geometry, factorisation …) are on the formulas page too');
  await page.click('#fm-数学'); await page.waitForFunction(() => [...document.querySelectorAll('.fm-row')].every((e) => e.dataset.k === '数学'));
  ok(await page.locator('.fm-row').count() >= 40, 'the filter 数学 shows only maths formulas (' + (await page.locator('.fm-row').count()) + ')');
  // circuits and rules
  await page.evaluate(() => (location.hash = '#/science/circuits')); await page.waitForSelector('.dg-card');
  const dg = await page.evaluate(() => ({ symbols: document.querySelectorAll('#dg-symbols svg').length, circuits: document.querySelectorAll('.dg-card[data-circuit]').length, rules: [...document.querySelectorAll('.dg-card[data-rule]')].map((e) => e.dataset.rule).join(), sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
  ok(dg.symbols >= 10 && dg.circuits >= 4 && dg.rules.split(',').length >= 3 && dg.sw, 'circuit symbols (' + dg.symbols + '), circuit diagrams (' + dg.circuits + ') and the right-hand / left-hand / Ampère rules (' + dg.rules + '), nothing sideways');
  await page.screenshot({ path: OUT + 'science-circuits-phone.png' });
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
      ok(m.sw <= m.vw && m.n === 6 && m.bad === 0, `${name} ${dn}: 6 cards, nothing cut off or sideways`);
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
  await cardsTranslated();
  await done();
})();
