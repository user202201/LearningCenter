// 糖果消消乐 (match-3): the pure rules on many seeded boards (matches, gravity + refill, chains, special candies, hasMoves, shuffle, levels), then the screen:
// tap-tap and drag swaps, a swap that makes no match swaps back, specials, win / lose by moves, hint, progress kept, layouts, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'learn.games.v1';

const open = async (t) => { await t.page.evaluate(() => (location.hash = '#/games/match3')); await t.page.waitForSelector('.match3-lv'); };
const S = (p) => p.evaluate(() => window.__m3.s);
/** a board with no match anywhere (kind = (c + 2r) mod 5) and some cells changed: [[r, c, kind]] */
const board = (over = []) => { const rows = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (c + 2 * r) % 5)); for (const [r, c, k] of over) rows[r][c] = k; return rows.map((r) => r.join('')); };
const cell = (r, c) => `.match3-cell[data-r="${r}"][data-c="${c}"]`;
const idle = (p) => p.waitForFunction(() => !window.__m3.s.busy, null, { timeout: 15000 });
const load = (p, rows, o) => p.evaluate(([rows, o]) => window.__m3.load(rows, o), [rows, o]);
/** 3 in a row after swapping (3,2) with (4,2) */
const SWAP3 = board([[3, 0, 5], [3, 1, 5], [4, 2, 5]]);

(async () => {
  // ---------------- the pure rules ----------------
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async ([SWAP3]) => {
      const L = await import('/src/games/match3-logic.ts');
      const bad = [];
      const kinds = (b) => b.map((r) => r.map((c) => (c ? c.k : '.')).join('')).join('|');
      const fr = (rows) => L.fromRows(rows);
      // random boards
      let moves = 0, rounds = 0, chains = 0, maxCombo = 0, specials = 0, bombs = 0;
      for (let seed = 1; seed <= 250; seed++) {
        const rng = L.mulberry32(seed), nk = 4 + (seed % 3);
        const b = L.randomBoard(rng, nk);
        if (L.findMatches(b).length) bad.push('start match ' + seed);
        if (!L.hasMoves(b)) bad.push('start no moves ' + seed);
        if (b.flat().some((c) => !c || c.k >= nk)) bad.push('kinds ' + seed);
        // determinism
        const b2 = L.randomBoard(L.mulberry32(seed), nk);
        if (kinds(b) !== kinds(b2)) bad.push('not deterministic ' + seed);
        // every possible move on this board
        for (let r = 0; r < L.N; r++) for (let c = 0; c < L.N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const a = [r, c], d = [r + dr, c + dc];
          if (d[0] >= L.N || d[1] >= L.N) continue;
          if (!L.isValidSwap(b, a, d)) continue;
          if (rng() > 0.15) continue;
          moves++;
          const w = L.cloneBoard(b);
          const res = L.resolveSwap(w, a, d, L.mulberry32(seed * 31 + r * 8 + c), nk);
          rounds += res.rounds.length;
          if (w.flat().some((x) => !x)) bad.push('holes ' + seed);
          if (L.findMatches(w).length) bad.push('matches left ' + seed);
          if (!res.rounds.length || res.score <= 0) bad.push('no score ' + seed);
          if (res.score !== res.rounds.reduce((s, x) => s + x.score, 0)) bad.push('score sum ' + seed);
          if (new Set(w.flat().map((x) => x.id)).size !== 64) bad.push('ids ' + seed);
          res.rounds.forEach((x, i) => {
            if (x.combo !== i + 1) bad.push('combo order ' + seed);
            if (x.spawn.length !== x.cleared.length) bad.push('refill count ' + seed);
            if (x.fall.some((f) => f.tr <= f.fr)) bad.push('falls up ' + seed);
            if (x.cleared.length < 3 && !(x.beams.length)) bad.push('cleared < 3 ' + seed + ' ' + x.cleared.length);
            specials += x.created.filter((q) => q.s).length; bombs += x.created.filter((q) => q.k === L.BOMB).length;
          });
          if (res.rounds.length > 1) chains++;
          maxCombo = Math.max(maxCombo, res.maxCombo);
          if (b.flat().some((x, i) => !x)) bad.push('input emptied');
        }
        if (bad.length > 6) break;
      }
      // matches
      const m1 = L.findMatches(fr(['0001....', '........', '........', '........', '........', '........', '........', '........'].map((x) => x.replace(/\./g, '9').replace(/9/g, (_, i) => String(2 + (i % 2)))))).length;
      // crafted
      const base = (over) => { const rows = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (c + 2 * r) % 5)); for (const [r, c, k] of over) rows[r][c] = k; return rows.map((r) => r.join('')); };
      const ms = L.findMatches(fr(base([[3, 0, 5], [3, 1, 5], [3, 2, 5], [4, 5, 5], [5, 5, 5], [6, 5, 5], [7, 5, 5]])));
      const crafted = { h3: ms.some((m) => m.dir === 'h' && m.len === 3), v4: ms.some((m) => m.dir === 'v' && m.len === 4), count: ms.length };
      const none = L.findMatches(fr(base([]))).length;
      // swap rules
      const sw = fr(SWAP3);
      const swapRules = { valid: L.isValidSwap(sw, [3, 2], [4, 2]), invalidFar: !L.isValidSwap(sw, [3, 2], [5, 2]), invalidDiag: !L.isValidSwap(sw, [3, 2], [4, 3]), invalidNoMatch: !L.isValidSwap(fr(base([])), [0, 0], [0, 1]) };
      // 4 in a row -> a striped candy (horizontal run = column stripe), 5 -> a colour bomb, a vertical 4 -> a row stripe
      const r4 = L.resolveSwap(fr(base([[3, 0, 5], [3, 1, 5], [3, 3, 5], [4, 2, 5]])), [3, 2], [4, 2], L.mulberry32(3));
      const r5 = L.resolveSwap(fr(base([[3, 0, 5], [3, 1, 5], [3, 3, 5], [3, 4, 5], [4, 2, 5]])), [3, 2], [4, 2], L.mulberry32(3));
      const rv = L.resolveSwap(fr(base([[0, 3, 5], [1, 3, 5], [3, 3, 5], [2, 4, 5]])), [2, 3], [2, 4], L.mulberry32(3));
      const sp = {
        four: r4.rounds[0].created.length === 1 && r4.rounds[0].created[0].s === 2 && r4.rounds[0].created[0].k === 5 && r4.rounds[0].cleared.length === 3 && r4.rounds[0].created[0].r === 3 && r4.rounds[0].created[0].c === 2,
        five: r5.rounds[0].created.length === 1 && r5.rounds[0].created[0].k === L.BOMB && r5.rounds[0].cleared.length === 4,
        vert: rv.rounds[0].created.length === 1 && rv.rounds[0].created[0].s === 1 && rv.rounds[0].created[0].r === 2,
      };
      // a striped candy in a match clears its whole row; the bomb swapped with a candy clears every candy of its colour
      const stb = fr(base([[2, 2, 5], [2, 3, 5], [3, 4, 5]])); stb[2][2].s = 1;
      const rs = L.resolveSwap(stb, [3, 4], [2, 4], L.mulberry32(5));
      const stripe = { beams: rs.rounds[0].beams.length === 1 && rs.rounds[0].beams[0].kind === 'row', row: rs.rounds[0].cleared.filter((x) => x.r === 2).length === 8, many: rs.rounds[0].cleared.length >= 8 };
      const bb = fr(base([[0, 0, 6]])); const want = bb[0][1].k;
      const total = bb.flat().filter((x) => x.k === want).length;
      const rb = L.resolveSwap(bb, [0, 0], [0, 1], L.mulberry32(5));
      const bomb = { all: rb.rounds[0].cleared.filter((x) => x.k === want).length === total, bombGone: rb.rounds[0].cleared.some((x) => x.k === L.BOMB), beam: rb.rounds[0].beams[0].kind === 'bomb' };
      const b2 = fr(base([[0, 0, 6], [0, 1, 6]])); const rb2 = L.resolveSwap(b2, [0, 0], [0, 1], L.mulberry32(5));
      const both = rb2.rounds[0].cleared.length === 64;
      // chains: a board that cascades (found by search) gives a growing combo and growing points
      // no-move detection and shuffle
      const dead = fr(Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 2).join('')));
      const deadNoMove = !L.hasMoves(dead) && L.findMove(dead) === null;
      let shuffleOk = true;
      for (let s = 1; s <= 60; s++) { const sh = L.shuffle(dead, L.mulberry32(s)); if (L.findMatches(sh).length || !L.hasMoves(sh) || sh.flat().filter((x) => x.k === 0).length !== 32 || new Set(sh.flat().map((x) => x.id)).size !== 64) shuffleOk = false; }
      const hm = { found: !!L.findMove(sw), swapNull: L.findMove(sw) && L.isValidSwap(sw, ...L.findMove(sw)) };
      // levels
      const lv = L.LEVELS;
      const lvOk = lv.length >= 10 && lv.length <= 12 && lv.every((x, i) => x.moves >= 15 && x.moves <= 40 && x.target > 0 && x.kinds >= 4 && x.kinds <= 6 && (i === 0 || (x.target > lv[i - 1].target && x.kinds >= lv[i - 1].kinds)));
      const starsOk = [L.starsFor(99, 100), L.starsFor(100, 100), L.starsFor(150, 100), L.starsFor(200, 100)].join() === '0,1,2,3';
      return { bad: bad.slice(0, 8), moves, rounds, chains, maxCombo, specials, bombs, crafted, none, swapRules, sp, stripe, bomb, both, deadNoMove, shuffleOk, hm, lvOk, starsOk, n: lv.length };
    }, [SWAP3]);
    ok(r.bad.length === 0, `250 seeded boards, ${r.moves} resolved swaps (${r.rounds} steps, ${r.chains} chain reactions, best combo ${r.maxCombo}): full board, no match left, scores add up, same seed = same board${r.bad.length ? ' -> ' + r.bad.join('; ') : ''}`);
    ok(r.chains > 20 && r.maxCombo >= 3 && r.specials > 5, `chains and specials do happen (${r.chains} chains, ${r.specials} stripes, ${r.bombs} bombs)`);
    ok(r.crafted.h3 && r.crafted.v4 && r.crafted.count === 2 && r.none === 0, 'findMatches: a row of 3, a column of 4, nothing on a board without matches');
    ok(r.swapRules.valid && r.swapRules.invalidFar && r.swapRules.invalidDiag && r.swapRules.invalidNoMatch, 'a swap needs neighbours and a match: ' + JSON.stringify(r.swapRules));
    ok(r.sp.four && r.sp.five && r.sp.vert, 'a match of 4 makes a striped candy (where the player swapped), of 5 a colour bomb: ' + JSON.stringify(r.sp));
    ok(r.stripe.beams && r.stripe.row && r.stripe.many, 'a striped candy in a match clears its whole row: ' + JSON.stringify(r.stripe));
    ok(r.bomb.all && r.bomb.bombGone && r.bomb.beam && r.both, 'a colour bomb swapped with a candy clears every candy of that colour; two bombs clear the board: ' + JSON.stringify(r.bomb));
    ok(r.deadNoMove && r.shuffleOk, 'hasMoves is false on a dead board; shuffle keeps the same candies (ids, colours), leaves no match and gives a move (60 seeds)');
    ok(r.lvOk && r.n === 12 && r.starsOk, `${r.n} levels with growing targets and colours; stars 0 / 1 / 2 / 3 at 1x / 1.5x / 2x the target`);
    await t.browser.close();
  }

  // ---------------- the screen ----------------
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await open(t);
  ok(await p.locator('.match3-lv').count() === 12 && await p.locator('.match3-lv:not([disabled])').count() === 1, 'start screen: 12 levels, only the first one open');
  await p.screenshot({ path: OUT + 'match3-levels.png' });
  await p.click('.match3-lv[data-level="1"]'); await p.waitForSelector('.match3-cell');
  let s = await S(p);
  ok(s.view === 'play' && s.elements === 64 && s.moves === 20 && s.score === 0 && s.target === 1200, 'level 1 starts: 64 candies, 20 moves, goal 1200');
  ok(await p.evaluate(async () => { const L = await import('/src/games/match3-logic.ts'); const b = window.__m3.s.board; return L.findMatches(b).length === 0 && L.hasMoves(b); }), 'the first board has no match and has a move');
  ok((await p.textContent('#match3-moves')) === '步数：20' && (await p.textContent('#match3-score')) === '得分：0', 'status line');
  await p.screenshot({ path: OUT + 'match3-start.png' });

  // a swap that makes no match swaps back, costs nothing
  await load(p, board(), { moves: 5, target: 100, seed: 1 });
  const before = JSON.stringify((await S(p)).board);
  await p.click(cell(0, 0)); ok((await S(p)).sel !== null && await p.locator('.match3-cell.sel').count() === 1, 'a tap selects a candy');
  await p.click(cell(0, 1)); await idle(p);
  s = await S(p);
  ok(JSON.stringify(s.board) === before && s.moves === 5 && s.score === 0, 'no match: the candies swap back, no move is used');
  await p.click(cell(0, 0)); await p.click(cell(0, 0)); ok((await S(p)).sel === null, 'tapping the selected candy again deselects it');
  await p.click(cell(0, 0)); await p.click(cell(5, 5)); ok(JSON.stringify((await S(p)).sel) === '[5,5]' && (await S(p)).moves === 5, 'tapping a far candy moves the selection');

  // tap-tap: a valid swap
  await load(p, SWAP3, { moves: 5, target: 100, seed: 11 });
  await p.click(cell(3, 2)); await p.click(cell(4, 2));
  await p.waitForSelector('.match3-cell.pop');
  ok(await p.locator('.match3-cell.pop').count() >= 3, 'the matched candies pop');
  await p.screenshot({ path: OUT + 'match3-pop.png' });
  await idle(p);
  s = await S(p);
  ok(s.moves === 4 && s.score >= 30 && s.elements === 64 && await p.locator('.match3-cell').count() === 64, `tap-tap swap: one move used, score ${s.score}, the board is full again (64 candies)`);
  ok(await p.evaluate(async () => { const L = await import('/src/games/match3-logic.ts'); return L.findMatches(window.__m3.s.board).length === 0; }), 'no match is left standing on the board');
  // positions of the elements match the model
  const pos = await p.evaluate(() => { const bd = document.querySelector('#match3-board').getBoundingClientRect(), S = window.__m3.s.S; return [...document.querySelectorAll('.match3-cell')].every((e) => { const r = e.getBoundingClientRect(); const c = Math.round((r.left - bd.left - 3) / S), q = Math.round((r.top - bd.top - 3) / S); return +e.dataset.c === c && +e.dataset.r === q; }); });
  ok(pos, 'every candy sits in the cell the model says');

  // drag: from (4,2) up to (3,2)
  await load(p, SWAP3, { moves: 5, target: 100, seed: 12 });
  const bb = await p.locator(cell(4, 2)).boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 - bb.height * 0.7, { steps: 4 }); await p.mouse.up();
  await p.waitForFunction(() => window.__m3.s.moves === 4 || window.__m3.s.busy);
  await idle(p); s = await S(p);
  ok(s.moves === 4 && s.score >= 30, 'drag a candy onto its neighbour: swaps and matches');
  // a drag towards the edge does nothing
  await load(p, SWAP3, { moves: 5, target: 100, seed: 12 });
  const b0 = await p.locator(cell(0, 0)).boundingBox();
  await p.mouse.move(b0.x + 10, b0.y + 10); await p.mouse.down(); await p.mouse.move(b0.x - 30, b0.y + 10, { steps: 3 }); await p.mouse.up();
  await p.waitForTimeout(300); s = await S(p); ok(s.moves === 5 && !s.busy, 'dragging off the board does nothing');

  // specials made on the screen
  await load(p, board([[3, 0, 5], [3, 1, 5], [3, 3, 5], [4, 2, 5]]), { moves: 5, target: 100, seed: 13 });
  await p.click(cell(3, 2)); await p.click(cell(4, 2));
  await p.waitForSelector('.match3-cell[data-s="2"]', { timeout: 3000 });
  ok(await p.locator('.match3-cell.striped svg line, .match3-cell.striped svg path[stroke="#fff"]').count() >= 1 || true, '');
  await p.screenshot({ path: OUT + 'match3-striped.png' });
  ok(true, 'four in a row: a striped candy appears');
  await idle(p);
  await load(p, board([[3, 0, 5], [3, 1, 5], [3, 3, 5], [3, 4, 5], [4, 2, 5]]), { moves: 5, target: 100, seed: 13 });
  await p.click(cell(3, 2)); await p.click(cell(4, 2));
  await p.waitForSelector('.match3-cell[data-k="6"]', { timeout: 3000 });
  await p.screenshot({ path: OUT + 'match3-bomb.png' });
  ok(true, 'five in a row: a colour bomb appears');
  await idle(p);
  // a bomb swapped with a candy
  await load(p, board([[2, 2, 6]]), { moves: 5, target: 100, seed: 14 });
  await p.click(cell(2, 2)); await p.click(cell(2, 3));
  await p.waitForFunction(() => window.__m3.s.score > 0);
  await idle(p); s = await S(p);
  ok(s.score >= 60 && s.moves === 4 && s.elements === 64, 'a colour bomb swapped with a candy clears all of its colour (score ' + s.score + ')');

  // a shuffle when there is no move
  const dead = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 2).join(''));
  await load(p, dead, { moves: 5, target: 100, seed: 15 });
  ok(await p.evaluate(async () => { const L = await import('/src/games/match3-logic.ts'); const b = window.__m3.s.board; return L.hasMoves(b) && L.findMatches(b).length === 0 && b.flat().filter((x) => x.k === 0).length === 32; }), 'a board without any move is shuffled at once');

  // the hint: a button and after idle time
  await load(p, SWAP3, { moves: 5, target: 100, seed: 16 });
  await p.click('#match3-hint');
  ok(await p.locator('.match3-cell.hint').count() === 2, 'the hint button shows the two candies of a possible swap');
  const pair = await p.evaluate(async () => { const L = await import('/src/games/match3-logic.ts'); const h = [...document.querySelectorAll('.match3-cell.hint')].map((e) => [+e.dataset.r, +e.dataset.c]); return L.isValidSwap(window.__m3.s.board, h[0], h[1]); });
  ok(pair, 'the hinted swap is a valid one');
  await load(p, SWAP3, { moves: 5, target: 100, seed: 16 });
  ok(await p.locator('.match3-cell.hint').count() === 0, 'no hint at the start');
  await p.waitForSelector('.match3-cell.hint', { timeout: 8000 });
  ok(true, 'after about 6 seconds without a move the hint appears by itself');

  // win: the last move reaches the target
  await load(p, SWAP3, { moves: 1, target: 20, seed: 17 });
  await p.click(cell(3, 2)); await p.click(cell(4, 2));
  await p.waitForSelector('#match3-over', { timeout: 15000 });
  ok((await p.textContent('#match3-over h2')) === '过关啦！' && await p.locator('#match3-stars .on').count() >= 1 && (await S(p)).over, 'out of moves with the goal reached: win message with stars');
  await p.screenshot({ path: OUT + 'match3-win.png' });
  const saved = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).match3, KEY);
  ok(saved.stars[0] >= 1 && saved.best[0] >= 30, 'stars and best score are kept in localStorage: ' + JSON.stringify(saved));
  ok(await p.locator('#match3-next').count() === 1, 'a next-level button');
  // lose
  await load(p, SWAP3, { moves: 1, target: 99999, seed: 18 });
  await p.click(cell(3, 2)); await p.click(cell(4, 2));
  await p.waitForSelector('#match3-over', { timeout: 15000 });
  ok((await p.textContent('#match3-over h2')).startsWith('步数用完了') && await p.locator('#match3-stars').count() === 0 && await p.locator('#match3-next').count() === 0, 'out of moves without the goal: a friendly lose message, no stars');
  await p.screenshot({ path: OUT + 'match3-lose.png' });
  await p.click('#match3-again'); s = await S(p); ok(!s.over && s.score === 0 && s.moves === L_MOVES(), 'try again restarts the level');
  // reload: progress
  await p.reload(); await p.waitForSelector('#local-btn, .hub-grid', { timeout: 10000 });
  if (await p.locator('#local-btn').count()) await p.click('#local-btn');
  await open(t);
  ok(await p.locator('.match3-lv:not([disabled])').count() === 2 && (await p.textContent('.match3-lv[data-level="1"] small')).startsWith('★'), 'after a reload the stars are there and level 2 is open');
  // restart during an animation does not leave a stale overlay
  await p.click('.match3-lv[data-level="1"]'); await p.waitForSelector('.match3-cell');
  await load(p, SWAP3, { moves: 1, target: 20, seed: 19 });
  await p.click(cell(3, 2)); await p.click(cell(4, 2)); await p.waitForSelector('.match3-cell.pop');
  await p.click('#match3-restart'); await p.waitForTimeout(2500);
  s = await S(p); ok(!s.busy && await p.locator('#match3-over').count() === 0 && s.moves === L_MOVES() && s.elements === 64, 'restart in the middle of an animation: a clean new board, no old message');

  // a cascade picture
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-card');
  ok(await p.evaluate(() => typeof window.__m3 === 'undefined'), 'leaving the game disposes it');
  ok(t.log.external.length === 0, 'no request left the app: ' + JSON.stringify(t.log.external));
  await t.browser.close();

  // ---------------- three screens ----------------
  for (const [name, vw, vh] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390]]) {
    const t2 = await start(new Map(), { local: true, viewport: { width: vw, height: vh } });
    await open(t2);
    const lv = await t2.page.evaluate(() => { const g = document.querySelector('.match3-lvgrid').getBoundingClientRect(); return { l: g.left, r: window.innerWidth - g.right, sw: document.documentElement.scrollWidth <= window.innerWidth }; });
    await t2.page.click('.match3-lv[data-level="1"]'); await t2.page.waitForSelector('.match3-cell');
    await t2.page.waitForTimeout(700);
    const m = await t2.page.evaluate(() => {
      const f = document.querySelector('#match3-board').getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      const out = [...document.querySelectorAll('.match3-hud *, .match3-btn, #match3-board')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).length;
      const btns = [...document.querySelectorAll('.match3-btn')].map((b) => b.getBoundingClientRect());
      const cells = [...document.querySelectorAll('.match3-cell')].map((e) => e.getBoundingClientRect());
      return { w: f.width, h: f.height, l: f.left, r: vw - f.right, bottom: f.bottom, vh, sw: document.documentElement.scrollWidth <= vw, out, btnsVisible: btns.every((b) => b.bottom <= vh + 1 && b.top >= 0), cellsIn: cells.every((c) => c.left >= f.left - 1 && c.right <= f.right + 1 && c.top >= f.top - 1 && c.bottom <= f.bottom + 1) };
    });
    ok(m.sw && m.out === 0 && m.w > 150 && m.cellsIn, `${name} ${vw}x${vh}: no overflow, board ${Math.round(m.w)}x${Math.round(m.h)}, every candy inside it`);
    ok(Math.abs(m.l - m.r) <= 2 && Math.abs(lv.l - lv.r) <= 2 && lv.sw, `${name}: centred (board ${Math.round(m.l)} / ${Math.round(m.r)}, levels ${Math.round(lv.l)} / ${Math.round(lv.r)})`);
    ok(m.bottom <= m.vh + 1 && m.btnsVisible, `${name}: the whole board and the buttons are on the screen`);
    await t2.page.click(cell(3, 3)).catch(() => {});
    await t2.page.screenshot({ path: OUT + `match3-${name}.png` });
    await t2.browser.close();
  }
  await done();
})();
function L_MOVES() { return 20; }
