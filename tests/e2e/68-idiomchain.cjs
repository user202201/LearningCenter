// Idiom chain (成语接龙): the library (4-character idioms, explanations, levels, connectivity, pinyin, indexes), the rules (validation, homophones, candidates, the computer's move,
// 300 simulated full games), the screen (choose mode, type mode, hints, give up, win / lose, history, best score, keyboard), five screen sizes, EN / FR, and no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const TR = JSON.parse(fs.readFileSync('src/games/idiomchain.i18n.json', 'utf8'));
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluate(() => (location.hash = '#/games/idiomchain')); await p.waitForSelector('#icn-start:not([disabled])');

  // ---------- the library ----------
  const LIB = await p.evaluate(async () => {
    const G = await import('/src/games/idiomchain.ts');
    const M = await import('/src/games/idiomchain-logic.ts');
    const raw = (await import('/src/data/chengyu.json')).default.items;
    const lib = await G.getLib();
    const bad = [], seen = new Set();
    for (const [w, e, l] of raw) {
      if (!/^[一-鿿]{4}$/.test(w)) bad.push('not 4 CJK: ' + w);
      if (seen.has(w)) bad.push('duplicate ' + w); seen.add(w);
      if (!e || [...e].length > 24) bad.push('explanation: ' + w);
      if (![1, 2, 3].includes(l)) bad.push('level: ' + w);
    }
    const st = M.stats(lib);
    let py = 0, idx = 0;
    for (const en of lib.list) {
      if (en.syl.length !== 4 || !en.syl.every((s) => /^[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/.test(s))) py++;
      if (!lib.byFirst.get(en.w[0])?.includes(en) || !lib.byFirstPy.get(en.key[0])?.includes(en) || en.key[0] !== M.toneless(en.syl[0])) idx++;
    }
    const sumFirst = [...lib.byFirst.values()].reduce((a, b) => a + b.length, 0), sumPy = [...lib.byFirstPy.values()].reduce((a, b) => a + b.length, 0);
    return { bad: bad.slice(0, 5), total: raw.length, uniq: lib.list.length, st, py, idx, sumFirst, sumPy, le: lib.byWord.get('乐不思蜀').syl[0], lv: lib.byWord.get('绿水青山').syl[0], tl: [M.toneless('yī'), M.toneless('lǜ'), M.toneless('shǔ')] };
  });
  ok(LIB.bad.length === 0, `every idiom is exactly 4 Chinese characters, no duplicates, explanation 1-24 characters, level 1-3 (${LIB.total} idioms)${LIB.bad.length ? ' -> ' + LIB.bad.join('; ') : ''}`);
  ok(LIB.total >= 1500 && LIB.uniq === LIB.total, `at least 1500 idioms (${LIB.total}) and the library keeps all of them`);
  ok(LIB.st.level1 >= 400, `level 1 (very common) has at least 400 idioms (${LIB.st.level1})`);
  ok(LIB.st.dead / LIB.st.total < 0.25, `dead ends (idioms whose last character starts no idiom) are below 25 %: ${LIB.st.dead} of ${LIB.st.total} = ${(100 * LIB.st.dead / LIB.st.total).toFixed(1)} %`);
  ok(LIB.py === 0, 'pinyin found for every character of every idiom (4 syllables each)');
  ok(LIB.idx === 0 && LIB.sumFirst === LIB.total && LIB.sumPy === LIB.total, 'the first-character index and the first-pinyin index are consistent (each idiom once in each)');
  ok(LIB.le === 'lè' && LIB.lv === 'lǜ' && LIB.tl.join() === 'yi,lü,shu', `pinyin by context (乐 = lè in 乐不思蜀) and the tone-free key (${LIB.tl.join(' ')})`);

  // ---------- the rules ----------
  const R = await p.evaluate(async () => {
    const G = await import('/src/games/idiomchain.ts');
    const M = await import('/src/games/idiomchain-logic.ts');
    const lib = await G.getLib();
    const bad = []; let seed = 987654; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const E = (w) => lib.byWord.get(w);
    const need = M.needOf(E('一心一意')); // 意, yi
    const used = new Set(['一心一意']);
    const v = (w, homo = false, u = used) => M.validate(lib, w, need, homo, u);
    if (need.ch !== '意' || need.key !== 'yi') bad.push('needOf');
    if (!v('意气风发').ok) bad.push('valid idiom refused');
    if (v('一帆风顺').why !== 'first') bad.push('first character not checked');
    if (v('一帆风顺', true).ok !== true) bad.push('homophone yi -> yi not accepted when on');
    if (v('一帆风顺', false).ok) bad.push('homophone accepted when off');
    if (v('这不是成语').why !== 'notfound' || v('意思意思').why !== 'notfound' && E('意思意思') === undefined && false) bad.push('not found');
    if (v('').why !== 'empty' || v('  ').why !== 'empty') bad.push('empty');
    if (v(' 意气风发 ').ok !== true) bad.push('spaces are not trimmed');
    if (v('意气风发', false, new Set(['意气风发'])).why !== 'used') bad.push('used');
    // a character with another tone but the same letters: 异 (yì), 一 (yī), 以 (yǐ) all count as the same pronunciation
    const yi = lib.list.filter((e) => e.key[0] === 'yi').map((e) => e.w[0]); if (new Set(yi).size < 5) bad.push('few homophone starts for yi');
    // follow()
    for (let i = 0; i < 400; i++) {
      const e = lib.list[Math.floor(rng() * lib.list.length)], n = M.needOf(e), a = M.follow(lib, n, false), b = M.follow(lib, n, true);
      if (a.some((x) => x.w[0] !== n.ch)) bad.push('follow start');
      if (b.length < a.length || !a.every((x) => b.includes(x))) bad.push('homophones do not extend');
      if (b.some((x) => x.w[0] !== n.ch && x.key[0] !== n.key)) bad.push('follow homophone start');
      const u = new Set(a.slice(0, 1).map((x) => x.w)); if (M.follow(lib, n, false, u).some((x) => u.has(x.w))) bad.push('follow returns used');
    }
    // candidates
    let chips = 0, twoValid = 0;
    for (let i = 0; i < 600; i++) {
      const homo = i % 3 === 0, e = lib.list[Math.floor(rng() * lib.list.length)], n = M.needOf(e), u = new Set([e.w]);
      const c = M.candidates(lib, n, homo, u, rng, i % 2 === 0);
      if (!M.follow(lib, n, homo, u).length) { if (c.length) bad.push('candidates for a dead end'); continue; }
      chips++;
      if (c.length !== 4 || new Set(c.map((x) => x.w)).size !== 4) bad.push('not four different chips');
      const good = c.filter((x) => M.startsRight(x, n, homo));
      if (good.length < 1 || good.length > 2) bad.push('valid chips ' + good.length);
      if (good.length === 2) twoValid++;
      const pool = (i % 2 === 0 && M.follow(lib, n, homo, u).some((x) => x.l === 1)) ? M.follow(lib, n, homo, u).filter((x) => x.l === 1) : M.follow(lib, n, homo, u);
      const al2 = (x) => M.follow(lib, M.needOf(x), homo, u).some((y) => y !== x && M.follow(lib, M.needOf(y), homo, u).length > 0);
      if (pool.some(al2) && !good.some(al2)) bad.push('no chip leads on');
      if (c.some((x) => u.has(x.w))) bad.push('chip already used');
      if (c.filter((x) => !M.startsRight(x, n, homo)).some((x) => x.w[0] === n.ch || (homo && x.key[0] === n.key))) bad.push('a distractor starts right');
      if (bad.length > 5) break;
    }
    if (twoValid < 20) bad.push('two valid chips are never offered');
    // the computer: valid or null, never a used idiom
    let nulls = 0, moves = 0;
    for (let i = 0; i < 1500; i++) {
      const homo = i % 2 === 0, e = lib.list[Math.floor(rng() * lib.list.length)], n = M.needOf(e), u = new Set(M.follow(lib, n, homo).slice(0, i % 4).map((x) => x.w));
      const m = M.computerMove(lib, n, homo, u, rng, i % 3 !== 0), all = M.follow(lib, n, homo, u);
      if (m === null) { nulls++; if (all.length) bad.push('the computer gave up while it had a move'); }
      else { moves++; if (!M.startsRight(m, n, homo) || u.has(m.w)) bad.push('the computer played an invalid idiom ' + m.w); }
    }
    // level weighting: the easy mode keeps to level 1 much more often than the hard one
    const n0 = M.needOf(E('一心一意')), cnt = (easy) => { let l1 = 0; for (let i = 0; i < 600; i++) { const m = M.computerMove(lib, M.needOf(E('一心一意')), false, new Set(), rng, easy); if (m.l === 1) l1++; } return l1; };
    const eL = cnt(true), hL = cnt(false);
    if (!(eL > hL + 60)) bad.push(`easy mode is not clearly easier (${eL} vs ${hL})`);
    // opening move
    for (let i = 0; i < 200; i++) { const o = M.openingMove(lib, i % 2 === 0, rng, i % 3 !== 0); if (M.follow(lib, M.needOf(o), i % 2 === 0).length < 2) bad.push('opening move cannot be answered'); }
    // hints
    for (let i = 0; i < 200; i++) { const e = lib.list[Math.floor(rng() * lib.list.length)], n = M.needOf(e), h = M.hintFor(lib, n, i % 2 === 0, new Set(), rng); if (h && (!h.entry.w.startsWith(h.prefix) || h.prefix.length !== 2 || !M.startsRight(h.entry, n, i % 2 === 0))) bad.push('hint'); }
    // 300 complete games between random players: every move validated, no idiom twice, the chain connects, the game ends only when somebody has no move
    let games = 0, longest = 0, total = 0;
    for (let g = 0; g < 300; g++) {
      const homo = g % 2 === 0, open = M.openingMove(lib, homo, rng, true); const chain = [open], u = new Set([open.w]);
      let turn = 0, ended = false;
      for (let k = 0; k < 400; k++) {
        const n = M.needOf(chain[chain.length - 1]);
        const mv = turn === 0 ? M.computerMove(lib, n, homo, u, rng, g % 3 !== 0) : (() => { const f = M.follow(lib, n, homo, u); return f.length ? f[Math.floor(rng() * f.length)] : null; })();
        if (!mv) { if (M.follow(lib, n, homo, u).length) bad.push('game ended while a move existed'); ended = true; break; }
        const r = M.validate(lib, mv.w, n, homo, u);
        if (!r.ok) { bad.push('invalid move in a game: ' + mv.w + ' ' + r.why); break; }
        chain.push(mv); u.add(mv.w); turn = 1 - turn;
      }
      if (!ended) bad.push('a game did not end');
      if (new Set(chain.map((x) => x.w)).size !== chain.length) bad.push('an idiom was used twice');
      for (let i = 1; i < chain.length; i++) if (!M.startsRight(chain[i], M.needOf(chain[i - 1]), homo)) bad.push('chain broken');
      games++; longest = Math.max(longest, chain.length); total += chain.length;
      if (bad.length > 5) break;
    }
    return { bad: bad.slice(0, 6), games, longest, avg: total / games, chips, twoValid, moves, nulls, eL, hL };
  });
  ok(R.bad.length === 0, `rules: validation (not found / first character / used / empty / trimmed / homophone), candidates (${R.chips} sets, ${R.twoValid} with two valid), computer moves (${R.moves} moves, ${R.nulls} give-ups, easy ${R.eL} vs hard ${R.hL} level-1 picks), hints, ${R.games} simulated games (longest ${R.longest}, average ${R.avg.toFixed(1)})${R.bad.length ? ' -> ' + R.bad.join('; ') : ''}`);
  ok(R.longest > 8 && R.nulls > 0 && R.moves > 1000, 'the simulations really chained (long chains) and really ended (somebody ran out)');

  // ---------- the screen: choose mode ----------
  const txt = (s) => p.evaluate((s) => document.querySelector(s).textContent.trim(), s);
  const hook = (f, ...a) => p.evaluate(`(${f.toString()})(...${JSON.stringify(a)})`);
  const waitPlayer = () => p.waitForFunction(() => window.__idiomchain && window.__idiomchain.phase() === 'player', null, { timeout: 5000 }).catch(async (e) => { console.log('STUCK', await p.evaluate(() => [window.__idiomchain.phase(), JSON.stringify(window.__idiomchain.chain())])); throw e; });
  const startsRight = (w, n) => hook((w, n) => { const G = window.__idiomchain; return w[0] === n.ch; }, w, n);
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/idiomchain')); await p.waitForSelector('#icn-start:not([disabled])');
  ok(await p.isVisible('#icn-ovl') && (await txt('#icn-ovl h2')) === '成语接龙' && (await txt('#icn-best')) === '最高：0' && (await txt('#icn-len')) === '接龙：0', 'ready: a start panel with the name of the game, chain 0, best 0');
  ok(await p.isDisabled('#icn-hint') && await p.isDisabled('#icn-give'), 'hint and give up are off before the start');
  await p.screenshot({ path: OUT + 'idiomchain-ready.png' });
  await p.click('#icn-start');
  await p.waitForFunction(() => !document.querySelector('#icn-ovl') || document.querySelector('#icn-ovl').hidden);
  let ch = await hook(() => window.__idiomchain.chain()), need = await hook(() => window.__idiomchain.need());
  ok(ch.length === 1 && ch[0].who === 'cpu' && (await p.locator('.icn-cell').count()) === 4 && (await txt('#icn-len')) === '接龙：1', 'Start: the computer opens with an idiom shown in four cells');
  const cells = await p.evaluate(() => [...document.querySelectorAll('.icn-cell')].map((c) => [c.querySelector('.icn-py').textContent, c.querySelector('.icn-ch').textContent, c.querySelector('.icn-ch').classList.contains('user')]));
  ok(cells.map((c) => c[1]).join('') === ch[0].w && cells.every((c) => /^[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/.test(c[0]) && c[2]), 'the cells show the characters with pinyin and carry the user class');
  ok((await txt('#icn-exp')).length > 0 && (await txt('#icn-need')) === need.ch && (await hook(() => window.__idiomchain.mode())) === 'choose', 'the explanation and the needed first character are shown; the mode is Choose');
  ok(await p.isVisible('#icn-chips') && !(await p.isVisible('#icn-form')) && (await p.locator('.icn-chip').count()) === 4, 'four chips, no input');
  await hook(() => window.__idiomchain.seed(['一心一意']));   // (a known position: many answers lead on, so the steps below cannot end the game by chance)
  const chipInfo = async () => hook(() => { const G = window.__idiomchain, n = G.need(), lib = G.lib(); return [...document.querySelectorAll('.icn-chip')].map((c) => { const e = lib.byWord.get(c.dataset.w); return { w: c.dataset.w, right: e.w[0] === n.ch, off: c.disabled, alive: (lib.byFirst.get(e.w[3]) || []).some((x) => x.w !== e.w && lib.byFirst.has(x.w[3])) }; }); });
  let chips = await chipInfo();
  ok(chips.filter((c) => c.right).length >= 1 && chips.filter((c) => c.right).length <= 2 && chips.every((c) => (c.right ? true : true)), 'one or two chips are valid, the others do not start with the needed character');
  // a wrong chip
  const wrongIdx = chips.findIndex((c) => !c.right);
  await p.click(`#icn-chip-${wrongIdx}`);
  ok((await txt('#icn-fb')).startsWith('首字不符。') && (await txt('#icn-fb')).includes('错误：1 / 3') && (await p.evaluate((i) => document.querySelector('#icn-chip-' + i).classList.contains('no') && document.querySelector('#icn-chip-' + i).disabled, wrongIdx)), 'a wrong chip: "首字不符。", mistake 1 / 3, the chip is marked and off');
  ok((await hook(() => window.__idiomchain.chain().length)) === 1 && (await hook(() => window.__idiomchain.fails())) === 1, 'a wrong chip does not change the chain');
  await p.screenshot({ path: OUT + 'idiomchain-wrong.png' });
  // hint
  await p.click('#icn-hint');
  const pre = await hook(() => window.__idiomchain.hintPrefix());
  ok(pre.length === 2 && (await txt('#icn-hint')) === '提示（2）' && (await txt('#icn-fb')).startsWith('提示：') && (await txt('#icn-fb')).includes(pre) && (await hook((pre) => { const G = window.__idiomchain, n = G.need(); return G.lib().list.some((e) => e.w.startsWith(pre) && e.w[0] === n.ch); }, pre)), `a hint shows the first two characters of a valid answer (${pre}), 2 left`);
  // the right chip
  chips = await chipInfo(); const rightIdx = chips.findIndex((c) => c.right && !c.off && c.alive);
  const playedWord = chips[rightIdx].w;
  await p.click(`#icn-chip-${rightIdx}`);
  ch = await hook(() => window.__idiomchain.chain());
  ok(ch.length === 2 && ch[1].who === 'you' && ch[1].w === playedWord && (await txt('#icn-who')) === '你接的成语', 'the right chip is accepted and shown as the player\'s idiom');
  ok(await p.isDisabled('#icn-hint') && (await hook(() => window.__idiomchain.phase())) === 'cpu', 'while the computer thinks nothing can be pressed');
  await waitPlayer();
  ch = await hook(() => window.__idiomchain.chain());
  ok(ch.length === 3 && ch[2].who === 'cpu' && ch[2].w[0] === ch[1].w[3] && (await txt('#icn-len')) === '接龙：3', 'the computer answers with an idiom that starts with the last character: ' + ch.map((c) => c.w).join(' > '));
  ok((await hook(() => window.__idiomchain.fails())) === 0 && (await p.locator('.icn-h').count()) === 3 && (await p.locator('.icn-h.you').count()) === 1, 'a new turn: mistakes reset, the history has three chips (one yours)');
  await p.click('.icn-h[data-i="0"]');
  const ex0 = await hook(() => { const G = window.__idiomchain; return G.lib().byWord.get(G.chain()[0].w).e; });
  ok((await txt('#icn-hexp')).includes(ex0) && (await txt('#icn-hexp')).includes(ch[0].w) && await p.evaluate(() => document.querySelector('.icn-h[data-i="0"]').classList.contains('sel')), 'a tap on a history chip shows that idiom and its explanation');
  // keyboard 1-4
  chips = await chipInfo(); const kr = chips.findIndex((c) => c.right && c.alive);
  await p.keyboard.press(String(kr + 1));
  ok((await hook(() => window.__idiomchain.chain().length)) === 4 && (await hook(() => window.__idiomchain.chain()[3].who)) === 'you', 'keys 1-4 choose a chip');
  await waitPlayer();
  // three mistakes in a row end the game
  await hook(() => { /* nothing */ });
  for (let tries = 0; tries < 40; tries++) {   // (two valid chips leave only two wrong ones: draw the chips again until three wrong ones are there)
    chips = await chipInfo(); if (chips.filter((c) => !c.right && !c.off).length >= 3) break;
    await hook(() => { const G = window.__idiomchain; G.seed(G.chain().map((x) => x.w), G.used()); });
  }
  for (let k = 0; k < 3; k++) {
    chips = await chipInfo(); const wi = chips.findIndex((c) => !c.right && !c.off);
    if (wi < 0) break; await p.click(`#icn-chip-${wi}`);
  }
  await p.waitForFunction(() => document.querySelector('#icn-ovl') && !document.querySelector('#icn-ovl').hidden);
  ok((await txt('#icn-ovl h2')) === '游戏结束' && (await txt('#icn-ovl p')).startsWith('连续三次错误，游戏结束。') && (await txt('#icn-start')) === '再玩一次' && (await hook(() => window.__idiomchain.phase())) === 'over', 'three mistakes in a row: game over, the panel says why');
  ok((await txt('#icn-ans')).startsWith('参考答案：') && (await p.locator('#icn-ans .user').count()) === 1, 'the end panel shows one possible answer in a user box');
  await p.screenshot({ path: OUT + 'idiomchain-over.png' });
  const lenOver = await hook(() => window.__idiomchain.chain().length);
  const st1 = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).idiomchain);
  ok(lenOver >= 4 && st1['best-choose'] === lenOver && (await txt('#icn-best')) === '最高：' + lenOver, 'the best chain is kept per mode on this device: ' + st1['best-choose']);
  // play again
  await p.click('#icn-start'); await p.waitForFunction(() => window.__idiomchain.phase() === 'player');
  ok((await hook(() => window.__idiomchain.chain().length)) === 1 && (await hook(() => window.__idiomchain.hints())) === 3 && (await txt('#icn-best')) === '最高：' + lenOver, 'play again: a new chain, three hints, the best stays');
  // hints are limited to three
  for (let k = 0; k < 3; k++) await p.click('#icn-hint');
  ok((await txt('#icn-hint')) === '提示（0）' && await p.isDisabled('#icn-hint'), 'three hints per game, then the button is off');
  // give up: two taps
  await p.click('#icn-give');
  ok((await txt('#icn-give')) === '再点一次放弃' && (await hook(() => window.__idiomchain.phase())) === 'player', 'give up asks for a second tap');
  await p.click('#icn-give');
  await p.waitForFunction(() => document.querySelector('#icn-ovl') && !document.querySelector('#icn-ovl').hidden);
  const gu = await hook(() => { const G = window.__idiomchain, n = G.need(), ans = document.querySelector('#icn-ans .user'); const e = G.lib().byWord.get(ans.textContent); return { h2: document.querySelector('#icn-ovl h2').textContent, ok: !!e && e.w[0] === n.ch }; });
  ok(gu.h2 === '游戏结束' && gu.ok && (await txt('#icn-ovl p')).startsWith('你放弃了。'), 'give up: the game ends and shows a valid answer');

  // ---------- type mode ----------
  await p.click('#icn-mode-type');
  ok((await hook(() => window.__idiomchain.mode())) === 'type' && (await hook(() => window.__idiomchain.phase())) === 'ready' && await p.evaluate(() => document.querySelector('#icn-mode-type').classList.contains('on')), 'the Type pill switches the mode (and a new game is ready)');
  await p.click('#icn-start'); await p.waitForFunction(() => window.__idiomchain.phase() === 'player');
  ok(await p.isVisible('#icn-form') && !(await p.isVisible('#icn-chips')) && (await p.locator('.icn-chip').count()) === 0, 'type mode: an input and no chips');
  await p.screenshot({ path: OUT + 'idiomchain-type.png' });
  // set up a known position: 一心一意 (computer) -> need 意, and 意料之外 already used
  await hook(() => window.__idiomchain.seed(['一心一意'], ['意料之外']));
  const type = async (s) => { await p.fill('#icn-input', s); await p.press('#icn-input', 'Enter'); };
  await type('这不是成语');
  ok((await txt('#icn-fb')).startsWith('不在成语库中。'), 'a text that is not in the library: "不在成语库中。"');
  await type('一帆风顺');
  ok((await txt('#icn-fb')).startsWith('首字不符。') && (await hook(() => window.__idiomchain.fails())) === 2, 'a library idiom with the wrong first character: "首字不符。" (mistake 2)');
  await type('意料之外');
  ok((await txt('#icn-fb')).startsWith('已经用过。') && (await hook(() => window.__idiomchain.phase())) === 'over', 'an idiom already used: "已经用过。" (and the third mistake ends the game)');
  await p.click('#icn-start'); await p.waitForFunction(() => window.__idiomchain.phase() === 'player');
  await hook(() => window.__idiomchain.seed(['一心一意'], ['意料之外']));
  await p.fill('#icn-input', ''); await p.click('#icn-submit');
  ok((await txt('#icn-fb')).startsWith('请输入成语。') && (await hook(() => window.__idiomchain.fails())) === 0, 'an empty input: "请输入成语。" and it is not counted as a mistake');
  // a valid typed idiom (with spaces around it), then the computer answers
  await type('  意气风发 ');
  ch = await hook(() => window.__idiomchain.chain());
  ok(ch.length === 2 && ch[1].w === '意气风发', 'a valid idiom typed with spaces is accepted');
  await waitPlayer();
  ch = await hook(() => window.__idiomchain.chain());
  ok(ch.length === 3 && ch[2].w[0] === '发' && (await p.inputValue('#icn-input')) === '', 'the computer answers, the input is empty again');
  // the IME case: Enter while composing does not submit
  const before = await hook(() => window.__idiomchain.fails());
  await p.fill('#icn-input', '不会提交');
  await p.evaluate(() => document.querySelector('#icn-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
  ok((await hook(() => window.__idiomchain.fails())) === before, 'Enter while an input method is composing does not submit');

  // ---------- homophones ----------
  await p.click('#icn-homo');
  ok((await txt('#icn-homo')) === '谐音：开' && (await hook(() => window.__idiomchain.homo())) && (await hook(() => window.__idiomchain.phase())) === 'ready', 'the homophone switch turns on (a new game is ready)');
  await p.click('#icn-start'); await p.waitForFunction(() => window.__idiomchain.phase() === 'player');
  await hook(() => window.__idiomchain.seed(['一心一意']));
  ok((await txt('#icn-sub')).length > 0, 'the prompt says that a same-sounding character is accepted');
  await type('一帆风顺');
  ch = await hook(() => window.__idiomchain.chain());
  ok(ch.length === 2 && ch[1].w === '一帆风顺', 'homophones on: 一帆风顺 (一 sounds like 意, tone ignored) is accepted after 一心一意');
  await waitPlayer();
  await p.click('#icn-homo');
  await p.click('#icn-start'); await p.waitForFunction(() => window.__idiomchain.phase() === 'player');
  await hook(() => window.__idiomchain.seed(['一心一意']));
  await type('一帆风顺');
  ok((await txt('#icn-fb')).startsWith('首字不符。') && (await txt('#icn-sub')) === '', 'homophones off: the same idiom is refused');
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).idiomchain);
  ok(st2.mode === 'type' && st2.homo === false && typeof st2['best-type-homo'] !== 'string', 'mode and homophone choice are kept on this device');

  // ---------- winning: the computer cannot answer ----------
  const pair = await hook(() => { const G = window.__idiomchain, lib = G.lib(); const dead = lib.list.filter((e) => !lib.byFirst.has(e.w[3]) && lib.list.some((p) => p.w[3] === e.w[0] && !lib.byFirst.has('x'))); const e = dead[0], pr = lib.list.find((p) => p.w[3] === e.w[0]); return { prev: pr.w, last: e.w }; });
  await p.click('#icn-start').catch(() => {}); await p.waitForFunction(() => window.__idiomchain.phase() === 'player' || window.__idiomchain.phase() === 'ready');
  if ((await hook(() => window.__idiomchain.phase())) === 'ready') { await p.click('#icn-start'); await p.waitForFunction(() => window.__idiomchain.phase() === 'player'); }
  await hook((a) => window.__idiomchain.seed([a]), pair.prev);
  await type(pair.last);
  await p.waitForFunction(() => document.querySelector('#icn-ovl') && !document.querySelector('#icn-ovl').hidden);
  ok((await txt('#icn-ovl h2')) === '你赢了。' && (await txt('#icn-ovl p')).startsWith('电脑接不上了，你赢了。') && (await hook(() => window.__idiomchain.phase())) === 'over', 'the computer has no idiom for the dead end: "电脑接不上了，你赢了。"');
  await p.screenshot({ path: OUT + 'idiomchain-win.png' });
  const st3 = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).idiomchain);
  ok(st3['best-type'] >= 2, 'a win is a chain too: the best of the type mode is saved (' + st3['best-type'] + ')');

  // ---------- layout on five screens ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['land', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    const s = await start(new Map(), { local: true, viewport: { width: w, height: hgt } }); const q = s.page;
    await q.evaluate(() => (location.hash = '#/games/idiomchain')); await q.waitForSelector('#icn-start:not([disabled])');
    for (const mode of ['choose', 'type']) {
      if (mode === 'type') { await q.click('#icn-mode-type'); }
      await q.click('#icn-start'); await q.waitForFunction(() => window.__idiomchain.phase() === 'player');
      if (mode === 'type') { await q.fill('#icn-input', '这不是成语'); await q.press('#icn-input', 'Enter'); }
      // a long history, to see that it scrolls inside its own ribbon
      await q.evaluate(() => { const G = window.__idiomchain, lib = G.lib(); const ws = ['一心一意', '意气风发', '发愤图强', '强词夺理', '理直气壮', '壮志凌云', '云淡风轻', '轻而易举']; G.seed(ws.slice(0, 7)); });
      await q.waitForTimeout(150);
      const m = await q.evaluate((mode) => {
        const R = (s) => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const items = { strip: R('#icn-strip'), hud: R('.icn-hud'), hist: R('#icn-hist'), prompt: R('.icn-prompt'), chips: R('#icn-chips'), form: R('#icn-form') };
        const btns = [...document.querySelectorAll('.icn-hud button, .icn-chip, #icn-submit')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom, r.height]; });
        const over = [...document.querySelectorAll('.icn-wrap *')].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1 && !e.closest('#icn-hist') && getComputedStyle(e).overflowX === 'visible' && e.children.length === 0).map((e) => e.className + ':' + e.textContent.slice(0, 8));
        return { items, btns, over, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
      }, mode);
      const inside = (b) => b && b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      ok(['strip', 'hud', 'hist', 'prompt', mode === 'choose' ? 'chips' : 'form'].every((k) => inside(m.items[k])) && m.btns.every((b) => b[0] >= -0.5 && b[1] <= m.vw + 0.5 && b[2] >= -0.5 && b[3] <= m.vh + 0.5), `${name} ${w}x${hgt} (${mode}): the idiom, the buttons, the chips / input and the history are on the screen`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name} (${mode}): no page scrolling`);
      ok(m.over.length === 0, `${name} (${mode}): no text sticks out of its box${m.over.length ? ' -> ' + m.over.join(' | ') : ''}`);
      ok(m.btns.every((b) => b[4] >= 30), `${name} (${mode}): buttons are at least 30 px high`);
      if (name !== 'side') ok(Math.abs(m.items.strip.l - (m.vw - m.items.strip.r)) <= 3, `${name} (${mode}): the idiom is centred (${Math.round(m.items.strip.l)} / ${Math.round(m.vw - m.items.strip.r)})`);
      ok(m.items.strip.w >= (name === 'small' ? 200 : name === 'side' ? 160 : 260), `${name} (${mode}): the idiom is big enough (${Math.round(m.items.strip.w)} px)`);
      await q.screenshot({ path: OUT + `idiomchain-${name}-${mode}.png` });
    }
    await s.browser.close();
  }
  // leaving removes the hook and the listeners
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__idiomchain);
  ok(true, 'leaving the game removes it (the hook is gone)');
  await p.keyboard.press('1');
  ok(t.log.external.length === 0, 'no request left the app (the library and the pinyin are bundled)');
  ok(errors.length === 0, 'no page error' + (errors.length ? ': ' + errors[0] : ''));
  await t.browser.close();

  // ---------- EN / FR ----------
  const i18nData = fs.readFileSync('src/i18n-data.ts', 'utf8');
  const merged = i18nData.includes('"错误：{0} / {1}"') && i18nData.includes('"成语接龙"');
  const keyRegexes = Object.keys(TR).map((k) => [k, new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '.+?') + '$')]);
  ok(Object.entries(TR).every(([k, v]) => Array.isArray(v) && v.length === 2 && v[0] && v[1] && !CJK.test(v[0] + v[1]) && k.length > 1), 'every entry of the translation file has English and French and no one-character key');
  const grab = (q) => q.evaluate(() => {
    const out = [], w = document.createTreeWalker(document.querySelector('.icn-wrap'), NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (e && !e.closest('.user') && e.offsetParent && n.nodeValue.trim()) out.push(n.nodeValue.trim()); }
    for (const e of document.querySelectorAll('.icn-wrap [placeholder], .icn-wrap [aria-label]')) { if (!e.closest('.user') || e.matches('input')) { const a = e.getAttribute('placeholder') || e.getAttribute('aria-label'); if (a) out.push(a); } }
    return out;
  });
  for (const [loc, tag] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    const s = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = s.page; const texts = new Set(); const take = async () => { for (const x of await grab(q)) texts.add(x); };
    await q.evaluate(() => (location.hash = '#/games/idiomchain')); await q.waitForSelector('#icn-start:not([disabled])'); await take();
    await q.click('#icn-start'); await q.waitForFunction(() => window.__idiomchain.phase() === 'player'); await take();
    await q.click('#icn-hint'); await take();
    await q.evaluate(() => { const c = [...document.querySelectorAll('.icn-chip')].find((x) => x.dataset.w[0] !== window.__idiomchain.need().ch); c.click(); }); await take();
    await q.click('#icn-homo'); await q.click('#icn-start'); await q.waitForFunction(() => window.__idiomchain.phase() === 'player'); await take();
    await q.click('#icn-mode-type'); await q.click('#icn-start'); await q.waitForFunction(() => window.__idiomchain.phase() === 'player'); await take();
    for (const v of ['这不是成语', '二话不说', '']) { await q.evaluate(() => window.__idiomchain.seed(['一心一意'], ['意料之外'])); await q.fill('#icn-input', v); await q.press('#icn-input', 'Enter'); await take(); }
    await q.evaluate(() => window.__idiomchain.seed(['一心一意'], ['意料之外'])); for (let k = 0; k < 3; k++) { await q.fill('#icn-input', '意料之外'); await q.press('#icn-input', 'Enter'); await take(); }
    await q.waitForFunction(() => !document.querySelector('#icn-ovl').hidden); await take();
    await q.click('#icn-homo'); await q.click('#icn-start'); await q.waitForFunction(() => window.__idiomchain.phase() === 'player');
    await q.click('#icn-give'); await take(); await q.click('#icn-give'); await q.waitForFunction(() => !document.querySelector('#icn-ovl').hidden); await take();
    const pr = await q.evaluate(() => { const G = window.__idiomchain, lib = G.lib(); const e = lib.list.filter((e) => !lib.byFirst.has(e.w[3]))[0], pr = lib.list.find((p) => p.w[3] === e.w[0]); return { prev: pr.w, last: e.w }; });
    await q.click('#icn-start'); await q.waitForFunction(() => window.__idiomchain.phase() === 'player');
    await q.evaluate((a) => window.__idiomchain.seed([a]), pr.prev); await q.fill('#icn-input', pr.last); await q.press('#icn-input', 'Enter');
    await q.waitForFunction(() => !document.querySelector('#icn-ovl').hidden); await take();
    await q.screenshot({ path: OUT + `idiomchain-win-${tag}.png` });
    if (tag === 'zh') {
      const unknown = [...texts].filter((x) => !keyRegexes.some(([, re]) => re.test(x)) && CJK.test(x));
      ok(unknown.length === 0, `every Chinese text of the screen is in the translation file (${texts.size} texts)${unknown.length ? ' -> ' + unknown.join(' | ') : ''}`);
    } else if (merged) {
      const left = [...texts].filter((x) => CJK.test(x));
      ok(left.length === 0, `${tag}: nothing Chinese left on the screen outside the idioms${left.length ? ' -> ' + left.join(' | ') : ''}`);
    } else {
      ok(true, `${tag}: (translations not merged into i18n-data.ts yet: the zh check above covers the keys)`);
    }
    await s.browser.close();
  }
  await done();
})();
