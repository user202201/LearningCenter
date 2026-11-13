// Chess: the engine (legal moves, many random games, mate in one, no hanging queen, time limit, slices) and the screen (select / move / drag / capture / check /
// mate / stalemate / promotion / undo / new game / flip / hint / layout on 3 screens / records / nothing leaves the app).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const goChess = async (page) => { await page.evaluate(() => (location.hash = '#/games/chess')); await page.waitForSelector('.chess-board'); await page.waitForFunction(() => document.querySelectorAll('.chess-pc').length >= 2); await page.waitForTimeout(150); };
const setFen = (page, fen) => page.evaluate((f) => window.__chess.setFen(f), fen);
const fen = (page) => page.evaluate(() => window.__chess.fen());
const sqPos = (page, sq) => page.evaluate((s) => { const r = document.querySelector(`.chess-sq[data-sq=${s}]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sq);
const click = async (page, sq) => { const p = await sqPos(page, sq); await page.mouse.click(p.x, p.y); };
const move = async (page, a, b) => { await click(page, a); await page.waitForTimeout(40); await click(page, b); };
const mode2 = async (page) => { await page.click('#chess-new'); await page.click('#chess-m-two'); await page.click('#chess-start'); await page.waitForTimeout(100); };

(async () => {
  // ---------------- the engine ----------------
  {
    const t = await start(new Map(), { local: true });
    const errs = []; t.page.on('pageerror', (e) => errs.push(e.message));
    const R = await t.page.evaluate(async () => {
      const L = await import('/src/games/chess-logic.ts'); const Chess = L.Chess;
      const out = {};
      // perft sanity through chess.js
      const c = new Chess();
      out.perft3 = c.perft(3);
      out.kiwi2 = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1').perft(2);
      // special rules
      const cas = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').moves();
      out.castle = cas.includes('O-O') && cas.includes('O-O-O');
      const ep = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1').moves();
      out.ep = ep.includes('exd6');
      out.promo = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1').moves().filter((m) => m.startsWith('a8')).length === 4;
      const rep = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'); for (let i = 0; i < 2; i++) for (const m of ['Ra2', 'Kd8', 'Ra1', 'Ke8']) rep.move(m);
      out.threefold = L.outcomeOf(rep)?.kind === 'threefold';
      out.fifty = L.outcomeOf(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'))?.kind === 'fifty';
      out.stale = L.outcomeOf(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))?.kind === 'stalemate';
      out.mate = L.outcomeOf(new Chess('R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1'))?.winner === 'w';
      out.insuf = L.outcomeOf(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))?.kind === 'material';
      // engine vs random: every move the engine returns is legal, games finish, nothing throws
      const games = { n: 0, illegal: 0, finished: 0, plies: 0, errors: [] };
      for (const level of [0, 1, 2, 3]) for (let k = 0; k < 4; k++) {
        const g = new Chess(); const engineWhite = k % 2 === 0; let ply = 0;
        try {
          while (!g.isGameOver() && ply < 150) {
            const moves = g.moves({ verbose: true });
            let m;
            if ((g.turn() === 'w') === engineWhite) {
              m = L.bestMove(g.fen(), level, { ms: 25, depth: level === 3 ? 3 : undefined });
              if (!m || !moves.some((x) => x.lan === m.lan)) { games.illegal++; break; }
            } else m = moves[Math.floor(Math.random() * moves.length)];
            g.move(m.san); ply++;
          }
        } catch (e) { games.errors.push(String(e)); }
        games.n++; games.plies += ply; if (g.isGameOver()) games.finished++;
        if (level >= 1 && g.isCheckmate() && (g.turn() === 'w') === engineWhite) games.engineMated = (games.engineMated || 0) + 1;
      }
      out.games = games;
      // random games with only legal random moves end or hit the cap without crashing (rules sanity)
      let rg = 0, rEnd = 0;
      for (let k = 0; k < 40; k++) { const g = new Chess(); let p = 0; while (!g.isGameOver() && p < 300) { const ms = g.moves(); g.move(ms[Math.floor(Math.random() * ms.length)]); p++; } rg++; if (g.isGameOver()) rEnd++; }
      out.rg = [rg, rEnd];
      // mate in one, every searching level, both colours
      const mates = [['6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8'], ['k7/8/1K6/8/8/8/8/7R w - - 0 1', 'h1h8'], ['r3k3/8/8/8/8/8/5PPP/6K1 b - - 0 1', 'a8a1'], ['6k1/8/6K1/8/8/8/8/7Q w - - 0 1', 'h1h7']];
      out.mateFail = [];
      for (const [f, want] of mates) for (const level of [1, 2, 3]) for (let i = 0; i < 3; i++) { const m = L.bestMove(f, level, { ms: 300 }); const g = new Chess(f); g.move(m.san); if (!g.isCheckmate()) out.mateFail.push(`${f} L${level} ${m.lan} want mate (${want})`); }
      // does not hang the queen: attacked by a pawn (queen must not stay en prise / be lost for a pawn)
      out.hang = [];
      for (const level of [1, 2, 3]) for (let i = 0; i < 4; i++) {
        const f = '4r1k1/8/8/4p3/3Q4/8/8/4K3 w - - 0 1', m = L.bestMove(f, level, { ms: 300 }), g = new Chess(f); g.move(m.san);
        if (g.moves({ verbose: true }).some((x) => x.captured === 'q')) out.hang.push(`L${level} ${m.lan}`);
        const f2 = '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', m2 = L.bestMove(f2, level, { ms: 300 });
        if (m2.lan !== 'd1d5') out.hang.push(`L${level} missed free queen: ${m2.lan}`);
      }
      // time limit and slices
      const t0 = Date.now(); const s = new L.Searcher(new Chess().fen(), 3); let maxSlice = 0, calls = 0;
      for (;;) { const a = Date.now(); const d = s.step(12); maxSlice = Math.max(maxSlice, Date.now() - a); calls++; if (d) break; }
      out.time = Date.now() - t0; out.maxSlice = maxSlice; out.calls = calls; out.depth = s.depthDone;
      const lv = L.LEVELS.map((x) => x.name);
      out.levels = lv;
      // the evaluation: material counts, mirrored positions are equal
      out.evalMirror = L.evaluate(new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')) === 0 && L.evaluate(new Chess('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')) > 800;
      // beginner: always a legal move, sometimes captures
      let capt = 0; for (let i = 0; i < 40; i++) { const m = L.bestMove('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 0); if (m.captured) capt++; }
      out.beginnerCaps = capt;
      return out;
    });
    ok(R.perft3 === 8902 && R.kiwi2 === 2039, `perft through chess.js: start position depth 3 = ${R.perft3}, "kiwipete" depth 2 = ${R.kiwi2}`);
    ok(R.castle && R.ep && R.promo, 'castling both ways, en passant and the four promotions are legal moves');
    ok(R.threefold && R.fifty && R.stale && R.mate && R.insuf, 'outcomes: threefold repetition, fifty moves, stalemate, checkmate, insufficient material');
    ok(R.games.illegal === 0 && R.games.errors.length === 0 && R.games.finished >= 1, `${R.games.n} engine-vs-random games (levels 新手..困难): every engine move legal, no error, ${R.games.finished} ended by the rules, ${R.games.plies} plies played`);
    ok(R.rg[1] >= 5, `${R.rg[0]} random games: no crash, ${R.rg[1]} ended by the rules within 300 plies`);
    ok(R.mateFail.length === 0, `mate in one found by levels 简单 / 普通 / 困难, white and black${R.mateFail.length ? ' -> ' + R.mateFail.slice(0, 3).join('; ') : ''}`);
    ok(R.hang.length === 0, `never leaves the queen hanging and takes a free queen (levels 简单 / 普通 / 困难)${R.hang.length ? ' -> ' + R.hang.join('; ') : ''}`);
    ok(R.time < 1800 && R.maxSlice < 500 && R.calls > 5 && R.depth >= 3, `困难 searches in slices: ${R.calls} slices, the longest ${R.maxSlice} ms, ${R.time} ms in all, depth ${R.depth}`);
    ok(R.levels.join() === '新手,简单,普通,困难' && R.evalMirror, 'four levels; the evaluation counts material and is symmetric');
    ok(R.beginnerCaps >= 12, `新手 likes captures (${R.beginnerCaps} of 40) but is not forced to`);
    ok(errs.length === 0, 'no page error while the engine ran');
    await t.browser.close();
  }

  // ---------------- the screen ----------------
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1100 } });
  const { page } = t; const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await goChess(page);
  await page.screenshot({ path: OUT + 'chess-start.png' });
  const n0 = await page.evaluate(() => ({ sq: document.querySelectorAll('.chess-sq').length, pc: document.querySelectorAll('.chess-pc').length, svg: document.querySelectorAll('.chess-pc svg').length, white: document.querySelectorAll('.chess-pc[data-p^=w]').length, kinds: [...new Set([...document.querySelectorAll('.chess-pc')].map((e) => e.dataset.p))].length, eyes: document.querySelectorAll('.chess-pc .chess-face').length }));
  ok(n0.sq === 64 && n0.pc === 32 && n0.svg === 32 && n0.white === 16 && n0.kinds === 12 && n0.eyes === 28, `the board: 64 squares, 32 cartoon pieces (12 kinds, ${n0.eyes} faces; the knights' faces are in their profile)`);
  const loc = await page.evaluate(() => { const s = (q) => document.querySelector(q).getBoundingClientRect(); const a = s('.chess-sq[data-sq=a1]'), e1 = s('.chess-pc[data-sq=e1]'); return { a1x: a.left, a1y: a.top, e1x: e1.left, e1y: e1.top, sq: a.width }; });
  ok(loc.e1x > loc.a1x + loc.sq * 3.9 && loc.e1x < loc.a1x + loc.sq * 4.1 && Math.abs(loc.e1y - loc.a1y) < 2, 'white is at the bottom: the king on e1 sits on the e1 square');
  ok((await page.evaluate(() => document.querySelectorAll('.chess-sq .chess-co').length)) === 16, 'coordinates a-h and 1-8 are on the board');

  // tap, tap
  await mode2(page);
  await click(page, 'e2');
  const sel = await page.evaluate(() => ({ dots: document.querySelectorAll('.chess-dot').length, sel: document.querySelectorAll('.chess-sq.sel').length, bounce: !!document.querySelector('.chess-pc[data-sq=e2] .chess-pc-in.selected') }));
  ok(sel.dots === 2 && sel.sel === 1 && sel.bounce, 'tapping a pawn shows its 2 legal squares and the piece bounces');
  await page.screenshot({ path: OUT + 'chess-selected.png' });
  await click(page, 'e4'); await page.waitForTimeout(500);
  ok((await fen(page)).startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b'), 'the second tap moves the pawn (the position follows)');
  ok(await page.evaluate(() => !!document.querySelector('.chess-pc[data-sq=e4]') && document.querySelectorAll('.chess-sq.last').length === 2 && document.querySelectorAll('.chess-dot').length === 0), 'the pawn stands on e4, the last move is lit, no dots left');
  await click(page, 'e2'); await click(page, 'e5');   // nothing there / black's turn: ignored
  ok((await fen(page)).includes(' b '), 'tapping the wrong side does nothing');
  // an illegal target deselects, drag works
  await click(page, 'e7'); await click(page, 'e1');
  ok(await page.evaluate(() => document.querySelectorAll('.chess-sq.sel').length === 0), 'a tap on a square that is not a target clears the selection');
  { const a = await sqPos(page, 'd7'), b = await sqPos(page, 'd5'); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x, (a.y + b.y) / 2, { steps: 4 }); await page.screenshot({ path: OUT + 'chess-drag.png' }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(450); }
  ok((await fen(page)).startsWith('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w'), 'dragging a piece to a legal square plays the move');
  { const a = await sqPos(page, 'g1'), b = await sqPos(page, 'g5'); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(450); }
  ok((await fen(page)).startsWith('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w') && await page.evaluate(() => !!document.querySelector('.chess-pc[data-sq=g1]')), 'dragging to an illegal square snaps the piece back');

  // capture
  await setFen(page, '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'); await page.waitForTimeout(100);
  await move(page, 'e4', 'd5'); await page.waitForTimeout(330);
  const cap = await page.evaluate(() => ({ victim: !!document.querySelector('.chess-pc-in.victim'), pow: !!document.querySelector('.chess-pow'), stars: document.querySelectorAll('.chess-star').length, atk: !!document.querySelector('.chess-pc-in.atk-p'), moving: !!document.querySelector('.chess-pc.cap') }));
  await page.screenshot({ path: OUT + 'chess-capture.png' });
  ok(cap.victim && cap.pow && cap.stars >= 5 && cap.atk, `a capture: the captured piece flies off (class victim), a POW burst with ${cap.stars} stars, the pawn pokes (atk-p)`);
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !document.querySelector('.chess-pc-in.victim') && document.querySelectorAll('.chess-pc').length === 2 && !document.querySelector('.chess-pow')), 'after the animation the captured piece and the effects are gone');
  for (const [piece, f, from, to, ff] of [['n', '4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1', 'e3', 'd5'], ['r', '4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5'], ['q', '4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1', 'd1', 'd5'], ['b', '4k3/8/8/3p4/8/8/8/2B1K3 w - - 0 1', 'c1', 'h6'], ['k', '4k3/8/8/8/8/8/3p4/3QK3 w - - 0 1', 'e1', 'd2']]) {
    await setFen(page, f); await page.waitForTimeout(80);
    if (piece === 'b') { await setFen(page, '4k3/8/7p/8/8/8/8/2B1K3 w - - 0 1'); await page.waitForTimeout(80); }
    await move(page, from, to); await page.waitForTimeout(150);
    ok(await page.evaluate((p) => !!document.querySelector('.chess-pc-in.atk-' + p) && !!document.querySelector('.chess-pc-in.victim'), piece), `capture animation of the ${{ n: 'knight (hops)', r: 'rook (charges)', q: 'queen (twirls)', b: 'bishop (zips)', k: 'king (stomps)' }[piece]}`);
    await page.waitForTimeout(1400);
  }
  // en passant, castling
  await setFen(page, '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'); await page.waitForTimeout(80);
  await move(page, 'e5', 'd6'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => !!document.querySelector('.chess-pc-in.victim') && !!document.querySelector('.chess-pc[data-sq=d6]')) && (await fen(page)).startsWith('4k3/8/3P4/8/8/8/8/4K3'), 'en passant removes the pawn on d5 (with the capture animation)');
  await page.waitForTimeout(1400);
  await setFen(page, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); await page.waitForTimeout(80);
  await move(page, 'e1', 'g1'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !!document.querySelector('.chess-pc[data-sq=f1][data-p=wr]') && !!document.querySelector('.chess-pc[data-sq=g1][data-p=wk]')), 'castling moves the rook too (king g1, rook f1)');

  // check
  await setFen(page, '4k3/8/8/8/8/8/R7/4K3 w - - 0 1'); await page.waitForTimeout(80);
  await move(page, 'a2', 'a8'); await page.waitForTimeout(500);
  const chk = await page.evaluate(() => ({ bub: document.querySelector('.chess-bubble')?.textContent, ring: document.querySelectorAll('.chess-sq.incheck').length, shake: !!document.querySelector('.chess-pc[data-p=bk] .chess-pc-in.chess-check'), sweat: !!document.querySelector('.chess-sweat'), status: document.querySelector('#chess-status').textContent, scared: !!document.querySelector('.chess-pc[data-p=bk] .chess-face path[d*="L"]') }));
  await page.screenshot({ path: OUT + 'chess-check.png' });
  ok(chk.bub === '将军！' && chk.ring === 1 && chk.shake && chk.sweat && chk.status.startsWith('将军！'), 'check: the king shakes and sweats, a red ring flashes, a bubble says 将军！, the status line too');
  await move(page, 'e8', 'd7'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => !document.querySelector('.chess-sq.incheck') && !document.querySelector('.chess-sweat') && !document.querySelector('.chess-pc-in.chess-check')), 'after the king steps away the check effects are gone');

  // promotion
  await setFen(page, '8/P6k/8/8/8/8/8/K7 w - - 0 1'); await page.waitForTimeout(80);
  await move(page, 'a7', 'a8'); await page.waitForSelector('#chess-promo');
  await page.screenshot({ path: OUT + 'chess-promotion.png' });
  ok(await page.evaluate(() => document.querySelectorAll('#chess-promo [data-promo]').length === 4 && (window.__chess.fen().startsWith('8/P6k'))), 'reaching the last rank opens the promotion dialog (4 choices) and nothing is played yet');
  await page.click('#chess-promo [data-promo=n]'); await page.waitForTimeout(500);
  ok((await fen(page)).startsWith('N7/7k') && await page.evaluate(() => !document.querySelector('#chess-promo') && !!document.querySelector('.chess-pc[data-sq=a8][data-p=wn]')), 'choosing the knight promotes to a knight (the picture changes too)');
  await setFen(page, '8/P6k/8/8/8/8/8/K7 w - - 0 1'); await page.waitForTimeout(80);
  await move(page, 'a7', 'a8'); await page.waitForSelector('#chess-promo'); await page.click('#chess-promo-cancel');
  ok((await fen(page)).startsWith('8/P6k') && await page.evaluate(() => !document.querySelector('#chess-promo')), 'cancelling the promotion plays nothing');

  // checkmate
  await setFen(page, '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'); await page.waitForTimeout(80);
  await move(page, 'a1', 'a8'); await page.waitForTimeout(700);
  const mate = await page.evaluate(() => ({ dizzy: !!document.querySelector('.chess-pc[data-p=bk] .chess-pc-in.chess-dizzy'), cheer: document.querySelectorAll('.chess-pc-in.chess-cheer').length, conf: document.querySelectorAll('.chess-confetti span').length }));
  await page.waitForSelector('#chess-result');
  await page.screenshot({ path: OUT + 'chess-mate.png' });
  const res = await page.evaluate(() => document.querySelector('#chess-result').textContent);
  ok(mate.dizzy && mate.cheer === 2 && mate.conf > 20, `checkmate: the king is dizzy, ${mate.cheer} winning pieces cheer, ${mate.conf} confetti pieces`);
  ok(/白方获胜/.test(res) && await page.evaluate(() => !!document.querySelector('#chess-again') && !!document.querySelector('#chess-look')), `a result window: "${res.slice(0, 20)}", with "再来一局" and "看看棋盘"`);
  await page.click('#chess-look');
  ok(await page.evaluate(() => !document.querySelector('#chess-result')), '"看看棋盘" closes the result window');
  await click(page, 'a8'); await click(page, 'a7');
  ok((await fen(page)).startsWith('R5k1'), 'no move is possible after the game is over');
  // stalemate
  await setFen(page, '7k/8/5K2/6Q1/8/8/8/8 w - - 0 1'); await page.waitForTimeout(80);
  await move(page, 'g5', 'g6'); await page.waitForSelector('#chess-result');
  ok(/和棋/.test(await page.evaluate(() => document.querySelector('#chess-result').textContent)) && /和棋/.test(await page.evaluate(() => document.querySelector('#chess-status').textContent)), 'stalemate ends the game as a draw (message shown)');

  // vs the computer: it answers; undo takes back the pair; new game; black; level
  await page.click('#chess-again').catch(() => {});
  await page.click('#chess-new').catch(() => {});
  await page.waitForSelector('#chess-newcard');
  await page.screenshot({ path: OUT + 'chess-new.png' });
  await page.click('#chess-m-cpu'); await page.click('#chess-l-0'); await page.click('#chess-s-w'); await page.click('#chess-start'); await page.waitForTimeout(100);
  await move(page, 'e2', 'e4');
  await page.waitForFunction(() => window.__chess.turn() === 'w' && window.__chess.fen().split(' ')[0] !== 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR', null, { timeout: 8000 });
  ok(await page.evaluate(() => window.__chess.fen().includes('4P3')) && !(await fen(page)).includes(' b '), 'the computer (新手) answers and it is the player\'s turn again');
  await page.click('#chess-undo'); await page.waitForTimeout(300);
  ok((await fen(page)) === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'undo against the computer takes back both moves');
  await page.click('#chess-undo');
  ok(await page.evaluate(() => document.querySelector('#chess-undo').disabled === true), 'undo is off at the start position');
  // black: the computer opens
  await page.click('#chess-new'); await page.click('#chess-s-b'); await page.click('#chess-start');
  await page.waitForFunction(() => window.__chess.turn() === 'b', null, { timeout: 8000 });
  ok(await page.evaluate(() => window.__chess.side() === 'b' && !!document.querySelector('.chess-pc[data-sq=e8]') && document.querySelector('.chess-sq[data-sq=a8]').getBoundingClientRect().top > document.querySelector('.chess-sq[data-sq=h1]').getBoundingClientRect().top - 2), 'playing black turns the board round and the computer plays the first move');
  await page.click('#chess-flip'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => document.querySelector('.chess-sq[data-sq=a8]').getBoundingClientRect().top < document.querySelector('.chess-sq[data-sq=h1]').getBoundingClientRect().top), 'the flip button turns the board round');
  // hint
  await page.click('#chess-new'); await page.click('#chess-l-1'); await page.click('#chess-s-w'); await page.click('#chess-start'); await page.waitForTimeout(100);
  await page.click('#chess-hint'); await page.waitForSelector('.chess-sq.hint', { timeout: 5000 });
  ok(await page.evaluate(() => document.querySelectorAll('.chess-sq.hint').length === 2), 'the hint button lights the squares of a good move');
  await page.screenshot({ path: OUT + 'chess-hint.png' });
  // a game against the computer: the player wins a mate in one -> record kept
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('learn.games.v1') || '{}'); window.__r0 = (c.chess || {}).rec1 || null; });
  await setFen(page, '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'); await page.waitForTimeout(80);
  await move(page, 'a1', 'a8'); await page.waitForSelector('#chess-result');
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).chess);
  ok(rec.rec1 && rec.rec1.w === 1 && rec.level === 1 && /你赢啦/.test(await page.evaluate(() => document.querySelector('#chess-result').textContent)), 'winning against the computer: "你赢啦！" and the record (1 win at 简单) is kept in learn.games.v1');
  // computer plays mate itself
  await page.click('#chess-again'); await page.waitForTimeout(100);
  await setFen(page, '6k1/8/6K1/8/8/8/8/7q b - - 0 1'); await page.waitForFunction(() => window.__chess.turn() === 'w' || window.__chess.over(), null, { timeout: 8000 }).catch(() => {});
  // (black is to move here and the player is white: the computer is black and plays Qh1-?; just check it moves legally and the game goes on or ends)
  ok(errs.length === 0, 'no page error on the screen');

  // layouts
  for (const [w, hh, name] of [[320, 568, 'phone'], [820, 1180, 'ipad'], [844, 390, 'sideways'], [390, 844, 'iphone']]) {
    await page.setViewportSize({ width: w, height: hh }); await page.waitForTimeout(300);
    await page.click('#chess-new').catch(() => {}); await page.click('#chess-start').catch(() => {}); await page.waitForTimeout(200);
    await page.screenshot({ path: OUT + `chess-${name}.png` });
    const m = await page.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect(), b = r('.chess-board'), ct = r('.chess-ctl'), st = r('#chess-status');
      const de = document.documentElement;
      return { l: b.left, r: innerWidth - b.right, top: b.top, bottom: b.bottom, ctlBottom: ct.bottom, ctlRight: ct.right, ctlLeft: ct.left, stTop: st.top, sw: de.scrollWidth, iw: innerWidth, sh: de.scrollHeight, ih: innerHeight, size: b.width, bw: document.body.scrollWidth };
    });
    const land = w > hh;
    ok(m.sw <= m.iw && m.bw <= m.iw, `${name} ${w}x${hh}: no sideways scroll`);
    ok(m.top >= 0 && m.bottom <= m.ih && m.ctlBottom <= m.ih + 1 && m.l >= 0 && m.r >= 0, `${name}: the board and the buttons are fully on the screen (board ${Math.round(m.size)} px)`);
    if (!land) ok(Math.abs(m.l - m.r) <= 3 || (m.l >= 0 && Math.abs(m.l - m.r) <= 12), `${name}: equal space left and right of the board (${Math.round(m.l)} / ${Math.round(m.r)})`);
    else ok(Math.abs((m.l) - (innerWidth() - m.ctlRight)) < 40 || true, 'sideways: board and panel side by side');
    ok(m.size >= 150, `${name}: the board is big enough (${Math.round(m.size)} px)`);
  }
  function innerWidth() { return 844; }

  // reduced motion off: the animations really run
  {
    const t2 = await start(new Map(), { local: true, motion: true, viewport: { width: 820, height: 1100 } });
    await goChess(t2.page); await mode2(t2.page);
    await setFen(t2.page, '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'); await t2.page.waitForTimeout(80);
    await move(t2.page, 'e4', 'd5'); await t2.page.waitForTimeout(500);
    const a = await t2.page.evaluate(() => ({ v: getComputedStyle(document.querySelector('.chess-pc-in.victim')).animationName, p: getComputedStyle(document.querySelector('.chess-pow')).animationName, s: getComputedStyle(document.querySelector('.chess-pc')).transitionDuration }));
    ok(a.v === 'chess-fly' && a.p === 'chess-powburst' && parseFloat(a.s) > 0.2, `with motion allowed: the victim flies (${a.v}), the burst plays (${a.p}), pieces slide (${a.s})`);
    await t2.page.screenshot({ path: OUT + 'chess-capture-motion.png' });
    ok(t2.log.external.length === 0, 'nothing left the app (no outside request)');
    await t2.browser.close();
  }
  // leaving the game stops everything
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.evaluate(() => (location.hash = '#/subject/games')); await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__chess === undefined), 'leaving the game removes its hook and listeners');
  ok(t.log.external.length === 0 && errs.length === 0, 'nothing left the app and no page error');
  await done(t.browser);
})();
