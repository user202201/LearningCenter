// Xiangqi (games subject, `#/games/xiangqi`): the rules engine (every piece on constructed positions, perft numbers, random games, check / mate / stalemate), the computer
// (mate in one, does not hang a chariot, takes a free chariot), and the screen (select, move, drag, capture scenes, check, checkmate, undo, restart, side, hint, layout on 3 screens).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

/** screen point of a board point */
const pt = (page, s) => page.evaluate((s) => {
  const b = document.querySelector('#xq-board'), r = b.getBoundingClientRect();
  const U = parseFloat(getComputedStyle(document.querySelector('#xq-wrap')).getPropertyValue('--u'));
  const flip = window.__xq.human === -1, row = Math.floor(s / 9), col = s % 9;
  const vc = flip ? 8 - col : col, vr = flip ? 9 - row : row;
  return { x: r.left + b.clientLeft + (0.7 + vc) * U, y: r.top + b.clientTop + (0.7 + vr) * U };
}, s);
const click = async (page, s) => { const p = await pt(page, s); await page.mouse.click(p.x, p.y); };
const sq = (r, c) => r * 9 + c;
const load = (page, fen, side = 1, lv = 0) => page.evaluate(([f, s, l]) => window.__xq.load(f, s, l), [fen, side, lv]);
const waitIdle = (page) => page.waitForFunction(() => window.__xq && !window.__xq.busy, null, { timeout: 15000 });

(async () => {
  // ================= the rules (pure code, in the page) =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/games/xiangqi-logic.ts');
      const res = { fails: [] };
      const check = (c, m) => { if (!c) res.fails.push(m); };
      const dests = (fen, r, c) => { const p = L.parseFen(fen); return L.legalFrom(p, L.sq(r, c)).map((m) => `${L.rowOf(L.toOf(m))},${L.colOf(L.toOf(m))}`).sort(); };
      const pdests = (fen, r, c) => { const p = L.parseFen(fen); return L.pseudoMoves(p).filter((m) => L.fromOf(m) === L.sq(r, c)).map((m) => `${L.rowOf(L.toOf(m))},${L.colOf(L.toOf(m))}`).sort(); };
      const same = (a, b) => JSON.stringify(a) === JSON.stringify([...b].sort());
      // start position
      const p0 = L.startPosition();
      res.opening = L.legalMoves(p0).length;
      check(L.toFen(p0) === L.START_FEN, 'fen round trip');
      check(p0.turn === L.RED, 'red first');
      const perft = (pos, d) => { if (!d) return 1; let n = 0; for (const m of L.legalMoves(pos)) { L.make(pos, m); n += perft(pos, d - 1); L.unmake(pos); } return n; };
      res.perft = [perft(p0, 1), perft(p0, 2), perft(p0, 3)];
      // black has the same 44 after any red move? (symmetry): black to move in the mirrored start
      const pb = L.parseFen(L.START_FEN.replace(' w', ' b'));
      check(L.legalMoves(pb).length === 44, 'black 44 in the start position');
      // horse: 8 jumps, a blocked leg removes two
      check(dests('5k3/9/9/9/4N4/9/9/9/9/3K5 w', 4, 4).length === 8, 'horse free: 8');
      check(dests('5k3/9/9/4P4/4N4/9/9/9/9/3K5 w', 4, 4).length === 6 && !dests('5k3/9/9/4P4/4N4/9/9/9/9/3K5 w', 4, 4).includes('2,3'), 'horse leg up blocked by its own piece: 6');
      check(same(dests('5k3/9/9/9/4N4/4p4/9/9/9/3K5 w', 4, 4), ['2,3', '2,5', '3,2', '3,6', '5,2', '5,6']), 'horse leg down blocked by an enemy: no (6,3) / (6,5)');
      check(dests('5k3/9/9/9/N8/9/9/9/9/3K5 w', 4, 0).length === 4, 'horse on the edge: 4');
      check(same(dests('5k3/9/9/9/NP7/9/9/9/9/3K5 w', 4, 0), ['2,1', '6,1']), 'horse on the edge with the leg (4,1) blocked: 2 left');
      // elephant: two diagonal, eye, river
      check(same(dests('5k3/9/9/9/9/9/9/2B6/9/3K5 w', 7, 2), ['5,0', '5,4', '9,0', '9,4']), 'elephant 4 moves');
      check(same(dests('5k3/9/9/9/9/9/9/2B6/3P5/3K5 w', 7, 2), ['5,0', '5,4', '9,0']), 'elephant eye (8,3) blocked: no (9,4)');
      check(same(dests('5k3/9/9/9/9/2B6/9/9/9/3K5 w', 5, 2), ['7,0', '7,4']), 'elephant cannot cross the river');
      check(dests('2b2k3/9/9/9/9/9/9/9/9/3K5 b', 0, 2).join() === '2,0,2,4', 'black elephant');
      // advisor and general in the palace
      check(same(dests('5k3/9/9/9/9/9/9/9/4A4/3K5 w', 8, 4), ['7,3', '7,5', '9,5']), 'advisor in the centre: 3 (own general on one corner)');
      check(same(dests('5k3/9/9/9/9/9/9/9/9/3AK4 w', 9, 3), ['8,4']), 'advisor in the corner: 1');
      check(same(pdests('3k5/9/9/9/9/9/9/9/4K4/9 w', 8, 4), ['7,4', '8,3', '8,5', '9,4']), 'general: 4 steps');
      check(same(dests('3k5/9/9/9/9/9/9/9/4K4/9 w', 8, 4), ['7,4', '8,5', '9,4']), '... but not onto the file of the other general (flying general)');
      check(same(dests('5k3/9/9/9/9/9/9/3K5/9/9 w', 7, 3), ['7,4', '8,3']), 'general in the palace corner: 2 (stays in the palace)');
      // chariot
      check(dests('5k3/9/9/9/4R4/9/9/9/9/3K5 w', 4, 4).length === 17, 'chariot free in the middle: 17');
      check(same(dests('5k3/9/9/9/R1Pp5/9/9/9/9/3K5 w', 4, 0).filter((x) => x.startsWith('4,')), ['4,1']), 'chariot stops before its own piece');
      check(dests('5k3/9/9/9/R2p1p3/9/9/9/9/3K5 w', 4, 0).includes('4,3') && !dests('5k3/9/9/9/R2p1p3/9/9/9/9/3K5 w', 4, 0).includes('4,5'), 'chariot takes the first enemy only');
      // cannon
      const cb = (row) => `5k3/9/9/9/${row}/9/9/9/9/3K5 w`;
      check(!dests(cb('C1p6'), 4, 0).includes('4,2'), 'cannon cannot capture without a screen');
      check(dests(cb('Cpp6'), 4, 0).includes('4,2') && !dests(cb('Cpp6'), 4, 0).includes('4,1'), 'cannon jumps exactly one piece to capture');
      check(!dests(cb('Cppp5'), 4, 0).includes('4,3'), 'cannon cannot jump two pieces');
      check(!dests(cb('CpP6'), 4, 0).includes('4,2'), 'cannon does not capture its own piece');
      check(same(dests(cb('C1p1p4'), 4, 0).filter((x) => x.startsWith('4,')), ['4,1', '4,4']), 'cannon: moves up to the screen, captures behind it');
      // soldiers
      check(same(dests('5k3/9/9/9/9/9/4P4/9/9/3K5 w', 6, 4), ['5,4']), 'red soldier before the river: forward only');
      check(same(dests('5k3/9/9/9/4P4/9/9/9/9/3K5 w', 4, 4), ['3,4', '4,3', '4,5']), 'red soldier after the river: forward or sideways');
      check(same(dests('5k3/4P4/9/9/9/9/9/9/9/3K5 w', 1, 4), ['0,4', '1,3', '1,5']), 'soldier on row 1');
      check(same(dests('4Pk3/9/9/9/9/9/9/9/9/3K5 w', 0, 4), ['0,3']), 'soldier on the last row: only sideways (taking the general is not a move)');
      check(same(dests('5k3/9/9/9/9/4p4/9/9/9/3K5 b', 5, 4), ['5,3', '5,5', '6,4']), 'black soldier after the river');
      check(same(dests('5k3/9/9/4p4/9/9/9/9/9/3K5 b', 3, 4), ['4,4']), 'black soldier before the river: forward (down) only');
      // flying general
      const pin = '4k4/9/9/9/9/4R4/9/9/9/4K4 w';
      check(dests(pin, 5, 4).length > 0 && dests(pin, 5, 4).every((x) => x.endsWith(',4')), 'the chariot between the generals can only move along the file');
      check(!dests('3k5/9/9/9/9/9/9/9/9/4K4 w', 9, 4).includes('9,3'), 'a general may not step onto the file of the other general');
      check(dests('3k5/9/9/9/9/9/9/9/9/4K4 w', 9, 4).length === 2, 'general in the bottom middle with the enemy on file 3: (9,5) and (8,4)');
      check(L.inCheck(L.parseFen('4k4/9/9/9/9/9/9/9/9/4K4 w'), L.RED), 'facing generals = check');
      check(!L.inCheck(L.parseFen('4k4/9/9/9/9/4R4/9/9/9/4K4 w'), L.RED), 'a piece between: no check');
      // check detection
      const isChk = (fen, side) => L.inCheck(L.parseFen(fen), side);
      check(isChk('R3k4/9/9/9/9/9/9/9/9/3K5 b', L.BLACK), 'rook check along the row');
      check(!isChk('R2pk4/9/9/9/9/9/9/9/9/3K5 b', L.BLACK), 'a blocker stops the rook');
      check(isChk('4k4/9/3N5/9/9/9/9/9/9/5K3 b', L.BLACK), 'horse at (2,3) checks (0,4) through the free leg');
      check(!isChk('4k4/3r5/3N5/9/9/9/9/9/9/5K3 b', L.BLACK), 'hobbled horse (leg (1,3) occupied) does not check');
      check(!isChk('4k3C/9/9/9/9/9/9/9/9/3K5 b', L.BLACK), 'cannon without a screen: no check');
      check(isChk('4kp2C/9/9/9/9/9/9/9/9/3K5 b', L.BLACK), 'cannon check with exactly one screen');
      check(!isChk('4kpp1C/9/9/9/9/9/9/9/9/3K5 b', L.BLACK), 'two screens: no check');
      check(isChk('4k4/4P4/9/9/9/9/9/9/9/3K5 b', L.BLACK), 'soldier check from the front');
      check(!isChk('4k4/9/4P4/9/9/9/9/9/9/3K5 b', L.BLACK), 'a soldier two steps away: no check');
      check(isChk('3Pk4/9/9/9/9/9/9/9/9/5K3 b', L.BLACK), 'a crossed soldier beside the general checks');
      check(isChk('4k4/9/9/9/9/9/9/9/5p3/5K3 w', L.RED), 'a black soldier in front of the red general checks it');
      check(isChk('4k4/9/9/9/9/9/9/9/9/4pK3 w', L.RED), 'a black soldier beside the general on the last row checks it (it has crossed)');
      // checkmate in one for red: make the move and look
      const mate = L.parseFen('4k4/R8/9/9/9/8R/9/9/9/3K5 w');
      const mm = L.legalMoves(mate).find((m) => L.fromOf(m) === L.sq(5, 8) && L.toOf(m) === L.sq(0, 8));
      check(!!mm, 'the mating move is legal');
      L.make(mate, mm);
      const sm = L.status(mate);
      check(sm.state === 'checkmate' && sm.loser === L.BLACK && sm.check, 'checkmate: black has no move and is in check');
      L.unmake(mate);
      check(L.status(mate).state === 'play', 'and before it the game goes on');
      // stalemate counts as a loss
      const stale = L.status(L.parseFen('3k5/7R1/9/9/9/9/9/9/9/4RK3 b'));
      check(stale.state === 'stalemate' && stale.loser === L.BLACK && !stale.check, 'no move and no check: stalemate = LOSS for the side to move');
      // draw by the move limit
      const dp = L.parseFen(L.START_FEN); dp.quiet = L.NOCAPTURE_LIMIT;
      check(L.status(dp).state === 'draw', 'draw after the move limit without a capture');
      // legal moves never leave the own general in check; make / unmake restore the position
      let games = 0, plies = 0, mates = 0, draws = 0, stales = 0, capt = 0;
      for (let g = 0; g < 160; g++) {
        const pos = L.startPosition();
        for (let i = 0; i < 260; i++) {
          const st = L.status(pos);
          if (st.state !== 'play') { if (st.state === 'checkmate') mates++; else if (st.state === 'stalemate') stales++; else draws++; break; }
          const moves = L.legalMoves(pos);
          const fen = L.toFen(pos);
          for (const m of moves.slice(0, 6)) { L.make(pos, m); const side = -pos.turn; check(!L.inCheck(pos, side), 'own general in check after a legal move'); check(!L.inCheck(pos, -side) || true, ''); L.unmake(pos); }
          check(L.toFen(pos) === fen, 'make / unmake restores the position');
          const m = moves[Math.floor(Math.random() * moves.length)];
          if (pos.b[L.toOf(m)]) capt++;
          L.make(pos, m); plies++;
          check(pos.ks[0] >= 0 && pos.ks[1] >= 0 && pos.b[pos.ks[0]] === L.K && pos.b[pos.ks[1]] === -L.K, 'both generals on the board and the bookkeeping right');
          const rk = pos.ks[0], bk = pos.ks[1];
          if (L.colOf(rk) === L.colOf(bk)) { let open = true; for (let r = L.rowOf(bk) + 1; r < L.rowOf(rk); r++) if (pos.b[L.sq(r, L.colOf(rk))]) open = false; check(!open, 'the generals face each other after a legal move'); }
        }
        games++;
        if (res.fails.length > 20) break;
      }
      res.games = { games, plies, mates, stales, draws, capt };
      return res;
    });
    ok(r.opening === 44, `the opening position has 44 legal moves for red (${r.opening})`);
    ok(JSON.stringify(r.perft) === JSON.stringify([44, 1920, 79666]), `perft 1-3 = ${r.perft} (the known 44 / 1920 / 79666)`);
    ok(r.fails.length === 0, 'rules on constructed positions: horse leg, elephant eye + river, advisor / general in the palace, chariot, cannon screen, soldiers, flying general, check, mate, stalemate, draw' + (r.fails.length ? ' -> ' + r.fails.slice(0, 5).join(' | ') : ''));
    ok(r.games.games >= 100 && r.games.plies > 5000 && r.games.capt > 300, `${r.games.games} random games (${r.games.plies} moves, ${r.games.capt} captures, ${r.games.mates} mates, ${r.games.stales} stalemates, ${r.games.draws} draws): no illegal state, make / unmake exact`);

    // ---- the computer ----
    const ai = await t.page.evaluate(async () => {
      const L = await import('/src/games/xiangqi-logic.ts');
      const out = {};
      const lv = (i) => L.LEVELS[i];
      const mateRed = L.parseFen('4k4/R8/9/9/9/8R/9/9/9/3K5 w');
      const m1 = L.chooseMoveSync(mateRed, lv(2));
      L.make(mateRed, m1); out.mateRed = L.status(mateRed).state;
      const mateBlack = L.parseFen('3k5/9/9/9/8r/9/9/9/r8/4K4 b');
      const m2 = L.chooseMoveSync(mateBlack, lv(3));
      L.make(mateBlack, m2); out.mateBlack = L.status(mateBlack).state;
      // even the weakest level takes a mate in one
      const p3 = L.parseFen('4k4/R8/9/9/9/8R/9/9/9/3K5 w');
      const m3 = L.chooseMoveSync(p3, lv(1)); L.make(p3, m3); out.mateWeak = L.status(p3).state;
      // a black chariot attacked by a red soldier that is not protected: black must not leave it hanging (levels 2 and 3)
      out.hang = [];
      for (const i of [2, 3]) {
        const p = L.parseFen('4k4/9/9/9/4r4/4P4/9/9/9/3K5 b');
        const m = L.chooseMoveSync(p, lv(i));
        L.make(p, m);
        const lost = L.legalMoves(p).some((x) => p.b[L.toOf(x)] === -L.R);
        out.hang.push({ lost, move: m });
      }
      // black chariot on (4,4) attacked by a red horse as well: it must be saved (moved or the horse taken)
      for (const i of [2, 3]) {
        const p = L.parseFen('4k4/9/9/9/4r4/9/3N5/9/9/3K5 b');
        const m = L.chooseMoveSync(p, lv(i));
        L.make(p, m);
        out.hang.push({ lost: L.legalMoves(p).some((x) => p.b[L.toOf(x)] === -L.R), move: m });
      }
      // a hanging red chariot is taken
      out.take = [];
      for (const i of [2, 3]) {
        // the black rook at (4,0) can take the red chariot at (4,4) over an empty row
        const q = L.parseFen('4k4/9/9/9/r3R4/9/9/9/9/3K5 b');
        const m = L.chooseMoveSync(q, lv(i));
        out.take.push(q.b[L.toOf(m)] === L.R);
      }
      // a full game between the levels: every computer move is legal; it finishes or reaches 160 plies; timing
      let slow = 0;
      const pos = L.startPosition();
      let n = 0;
      for (; n < 80; n++) {
        if (L.status(pos).state !== 'play') break;
        const l = n % 2 ? lv(1) : lv(0);
        const t0 = performance.now();
        const m = L.chooseMoveSync(pos, l);
        slow = Math.max(slow, performance.now() - t0);
        if (!L.legalMoves(pos).includes(m)) { out.illegal = true; break; }
        L.make(pos, m);
      }
      out.gamePlies = n; out.slow = slow;
      // levels respond in time
      const t0 = performance.now(); L.chooseMoveSync(L.startPosition(), lv(3)); out.hardMs = performance.now() - t0;
      // sliced search: the generator yields many times (the screen can breathe)
      const g = L.searchGen(L.startPosition(), { depth: 4, ms: 500 });
      let yields = 0, r;
      while (!(r = g.next()).done) yields++;
      out.yields = yields; out.depth = r.value.depth;
      return out;
    });
    const nomove = (x) => x === 'checkmate' || x === 'stalemate';   // (in xiangqi a stalemating move wins as well)
    ok(nomove(ai.mateRed) && nomove(ai.mateBlack) && nomove(ai.mateWeak), `the computer finds a mate in one (普通 as red, 困难 as black, even 简单): ${ai.mateRed} / ${ai.mateBlack} / ${ai.mateWeak}`);
    ok(ai.hang.every((x) => !x.lost), 'the computer does not leave its chariot hanging (attacked by a soldier / by a horse), levels 普通 and 困难');
    ok(ai.take.every(Boolean), 'the computer takes a free chariot');
    ok(!ai.illegal && ai.gamePlies >= 40, `a game between two levels runs ${ai.gamePlies} plies with legal moves only (slowest move ${Math.round(ai.slow)} ms)`);
    ok(ai.hardMs < 1500, `困难 answers within its time budget (${Math.round(ai.hardMs)} ms)`);
    ok(ai.yields > 20 && ai.depth >= 3, `the search runs in slices (${ai.yields} hand-backs, depth ${ai.depth})`);
    await t.browser.close();
  }

  // ================= the screen (reduced motion: moves at once) =================
  {
    const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
    const { page } = t;
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.evaluate(() => (location.hash = '#/subject/games'));
    await page.waitForSelector('#gm-xiangqi');
    ok(await page.$eval('#gm-xiangqi .gm-art svg', (s) => !/[一-鿿]/.test(s.outerHTML)), 'the card of the games list has a picture without Chinese text');
    await page.click('#gm-xiangqi');
    await page.waitForSelector('#xq-board .xq-p');
    ok((await page.$$('#xq-board .xq-p')).length === 32, '32 pieces on the board');
    const faces = await page.evaluate(() => [...document.querySelectorAll('#xq-board .xq-p')].map((p) => p.querySelector('text')?.textContent).sort().join(''));
    ok(faces.split('').sort().join('') === ['帅仕仕相相马马车车炮炮兵兵兵兵兵', '将士士象象马马车车炮炮卒卒卒卒卒'].join('').split('').sort().join(''), 'every piece shows its Chinese character (red 帅仕相马车炮兵, black 将士象马车炮卒)');
    ok(await page.$eval('#xq-board', (b) => /楚河/.test(b.textContent) && /汉界/.test(b.textContent)), 'the river says 楚河 汉界');
    ok(await page.$$eval('#xq-board .xq-p svg circle', (c) => c.length > 100) && await page.$$eval('#xq-board .xq-p svg ellipse', (c) => c.length > 100), 'pieces are drawn as cartoon coins with eyes and cheeks');
    // select, legal dots
    await click(page, sq(6, 4)); // red soldier
    ok((await page.$$('#xq-board .xq-p.xq-sel')).length === 1 && (await page.$$('#xq-marks .xq-dot')).length === 1, 'tap a soldier: it is selected (bounce) and its one legal move shows a dot');
    await click(page, sq(7, 1)); // red cannon
    const cdots = await page.$$eval('#xq-marks .xq-dot', (d) => d.length), ccaps = await page.$$eval('#xq-marks .xq-dot.xq-cap', (d) => d.length);
    ok(cdots === 12 && ccaps === 1, `tap the cannon: ${cdots} dots (12 expected: 7 along the row / column... ) with ${ccaps} capture ring`);
    await click(page, sq(0, 0)); // empty target is not a legal target
    ok((await page.$$('#xq-marks .xq-dot')).length === 0, 'tapping elsewhere clears the selection');
    // level 新手 so the answer is quick
    await page.selectOption('#xq-level', '0');
    await click(page, sq(6, 4)); await click(page, sq(5, 4));
    ok(await page.$eval('#xq-wrap', () => window.__xq.history.length >= 1), 'tap piece then dot: the move is made');
    await page.waitForFunction(() => window.__xq.history.length === 2 && !window.__xq.busy, null, { timeout: 8000 });
    ok(await page.$$eval('#xq-marks .xq-last', (m) => m.length === 2), 'the computer answered; the last move is framed');
    ok(/轮到你了/.test(await page.textContent('#xq-status')), 'status: your turn again');
    // undo takes back the pair
    await page.click('#xq-undo');
    ok(await page.evaluate(() => window.__xq.history.length === 0), 'undo takes back the pair (your move and the computer\'s)');
    ok(await page.evaluate(async () => { const L = await import('/src/games/xiangqi-logic.ts'); return L.toFen(window.__xq.pos) === L.START_FEN; }), '... the start position is back');
    ok(await page.$eval('#xq-undo', (b) => b.disabled), 'undo is off when nothing is left to take back');
    ok(/已悔棋/.test(await page.evaluate(() => document.querySelector('#toasts')?.textContent || '')), 'a message answers the undo');
    // drag
    {
      const a = await pt(page, sq(6, 2)), b = await pt(page, sq(5, 2));
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
      ok(await page.$eval('#xq-board .xq-p.xq-drag', () => true).catch(() => false), 'dragging: the piece follows the pointer');
      await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
      await page.waitForFunction(() => window.__xq.history.length >= 1, null, { timeout: 4000 });
      ok(await page.evaluate(() => window.__xq.history[0] === (6 * 9 + 2) + ((5 * 9 + 2) << 7)), 'drag and drop makes the move');
      await page.waitForFunction(() => window.__xq.history.length === 2 && !window.__xq.busy, null, { timeout: 8000 });
      // a drag onto an illegal point snaps back
      const c = await pt(page, sq(6, 6)), d = await pt(page, sq(3, 3));
      const before = await page.evaluate(() => window.__xq.history.length);
      await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(d.x, d.y, { steps: 5 }); await page.mouse.up();
      await page.waitForTimeout(150);
      ok(await page.evaluate((n) => window.__xq.history.length === n, before) && await page.$$eval('#xq-board .xq-p.xq-drag', (x) => x.length === 0), 'a drop on an illegal point: the piece goes back and no move is made');
    }
    // hint
    await page.click('#xq-new');
    ok(await page.evaluate(() => window.__xq.history.length === 0) && (await page.$$('#xq-board .xq-p')).length === 32, 'restart: the start position');
    await page.click('#xq-hint');
    await page.waitForSelector('#xq-marks .xq-hint', { timeout: 5000 });
    ok((await page.$$('#xq-marks .xq-hint')).length === 2, 'the hint button marks the two points of a good move');
    ok(/提示/.test(await page.evaluate(() => document.querySelector('#toasts')?.textContent || '')), 'a message answers the hint');
    // choose a side: black, the computer opens, the board is turned
    await page.selectOption('#xq-sidesel', '-1');
    await page.waitForFunction(() => window.__xq.history.length === 1 && !window.__xq.busy, null, { timeout: 8000 });
    const ys = await page.evaluate(() => { const y = (k) => parseFloat(document.querySelector(`#xq-board .xq-p[data-piece="${k}"]`).style.getPropertyValue('--y')); return [y('rgeneral'), y('bgeneral')]; });
    ok(ys[0] < ys[1] && ys[1] > 9, 'playing black: the board is turned, your general is at the bottom (the red general at the top)');
    ok(await page.evaluate(() => window.__xq.human === -1 && window.__xq.history.length === 1), 'the computer (red) made the first move');
    ok(await page.$eval('#xq-undo', (b) => b.disabled), 'no undo of the computer\'s opening move');
    await page.selectOption('#xq-sidesel', '1');
    await page.waitForFunction(() => window.__xq.history.length === 0 && !window.__xq.busy);

    // check: the general shakes, sweats, red ring, bubble
    await load(page, '4k4/9/9/9/9/9/9/9/R8/3K5 w', 1, 0);
    await page.evaluate(() => { window.__xq.noReply = true; });
    await click(page, sq(8, 0)); await click(page, sq(0, 0));
    await page.waitForSelector('#xq-check-bubble', { timeout: 4000 });
    const ck = await page.evaluate(() => {   // (one call: the computer answers 0.4 s after the check)
      const g = document.querySelector('#xq-board .xq-p[data-piece="bgeneral"]');
      return { text: document.querySelector('#xq-check-bubble').textContent, scared: g.classList.contains('xq-scared'), ring: !!g.querySelector('.xq-ring'), sweat: !!g.querySelector('.xq-sweat'), who: document.querySelector('#xq-wrap').dataset.check, chk: document.querySelector('#xq-status').className };
    });
    ok(ck.text.includes('将军'), 'check: the speech bubble 将军！ appears');
    ok(ck.scared && ck.ring && ck.sweat, 'check: the threatened general is "scared" (shaking, sweat drop, red ring)');
    ok(ck.who === 'black' && /xq-chk/.test(ck.chk), 'check: the board states whose general is in check, the status turns red');
    await page.screenshot({ path: OUT + 'xq-check.png' });
    await page.evaluate(() => { window.__xq.noReply = false; });
    await waitIdle(page);
    // checkmate: you mate
    await load(page, '4k4/R8/9/9/9/8R/9/9/9/3K5 w', 1, 0);
    await click(page, sq(5, 8)); await click(page, sq(0, 8));
    await page.waitForSelector('#xq-result', { timeout: 5000 });
    ok(await page.$eval('#xq-result', (r) => r.dataset.result === 'win' && /你赢了/.test(r.textContent)), 'checkmate by you: the friendly "你赢了！" card');
    ok(await page.$eval('#xq-board .xq-p[data-piece="bgeneral"]', (g) => g.classList.contains('xq-fallen')), 'the losing general has fallen over');
    ok(await page.$$eval('#xq-board .xq-p.xq-cheer', (x) => x.length) === 3 && await page.$$eval('#xq-confetti i', (x) => x.length) > 20, 'the winners cheer and there is confetti');
    await page.screenshot({ path: OUT + 'xq-mate.png' });
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).xiangqi.wins === 1), 'the win is kept in learn.games.v1');
    ok(/胜 1/.test(await page.textContent('#xq-rec')), 'the record line shows the win');
    await page.click('#xq-look');
    ok((await page.$$('#xq-over')).length === 0, '"看看棋盘" closes the card');
    await page.click('#xq-new');
    ok((await page.$$('#xq-confetti')).length === 0 && (await page.$$('#xq-board .xq-p')).length === 32, 'restart removes the confetti and sets the pieces again');
    // the computer mates you
    await load(page, '3k5/9/9/9/8r/9/9/9/r8/4K4 b', 1, 3);
    await page.waitForSelector('#xq-result', { timeout: 8000 }).catch(async (e) => { console.log('DBG', await page.evaluate(() => JSON.stringify({ h: window.__xq.history, o: window.__xq.over, b: window.__xq.busy, n: document.querySelectorAll('#xq-result').length, st: document.querySelector('#xq-status').textContent }))); throw e; });
    ok(await page.$eval('#xq-result', (r) => r.dataset.result === 'lose'), 'the computer mates you: the card says you lost, kindly');
    ok(await page.$eval('#xq-board .xq-p[data-piece="rgeneral"]', (g) => g.classList.contains('xq-fallen')), 'your general has fallen');
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).xiangqi.losses === 1), 'the loss is counted');
    // stalemate = loss
    await load(page, '3k5/7R1/9/9/9/9/9/9/9/4RK3 b', 1, 0);
    await page.waitForSelector('#xq-result', { timeout: 8000 });
    ok(await page.$eval('#xq-result', (r) => r.dataset.result === 'win' && /无路可走/.test(r.textContent)), 'stalemate is a loss for the side without a move (here: black, the computer)');
    // draw
    await load(page, '3k5/9/9/9/9/9/9/9/9/4K4 w', 1, 0);
    await page.evaluate(() => { window.__xq.pos.quiet = 119; });
    await click(page, sq(9, 4)); await click(page, sq(8, 4));
    await page.waitForSelector('#xq-result', { timeout: 5000 });
    ok(await page.$eval('#xq-result', (r) => r.dataset.result === 'draw'), 'the move limit without a capture gives a draw message');
    ok(errs.length === 0, 'no script errors: ' + errs.join('; '));
    // leaving the game removes the hook
    await page.evaluate(() => (location.hash = '#/subject/games'));
    await page.waitForSelector('#gm-xiangqi');
    ok(await page.evaluate(() => window.__xq === undefined), 'leaving the game disposes it');
    ok(t.log.external.length === 0, 'OFFLINE: no request left the app: ' + t.log.external.join(', '));
    await t.browser.close();
  }

  // ================= the capture scenes (motion on) =================
  {
    const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 }, motion: true });
    const { page } = t;
    await page.evaluate(() => (location.hash = '#/games/xiangqi'));
    await page.waitForSelector('#xq-board .xq-p');
    const scene = async (name, fen, from, to, cls, anim) => {
      await load(page, fen, 1, 0);
      const n0 = await page.$$eval('#xq-board .xq-p', (x) => x.length);
      await click(page, from);
      const t0 = Date.now();
      await click(page, to);
      await page.waitForSelector('#xq-wrap.xq-capturing', { timeout: 3000 });
      ok(await page.$eval('#xq-wrap', (w, a) => w.dataset.anim === a, anim), `${name}: the capture scene starts (data-anim = ${anim})`);
      if (cls) await page.waitForSelector(cls, { timeout: 3000 }).then(() => ok(true, `${name}: ${cls} shows`), () => ok(false, `${name}: ${cls} never showed`));
      await page.screenshot({ path: OUT + `xq-${name}.png` });
      await page.waitForFunction(() => !document.querySelector('#xq-wrap').classList.contains('xq-capturing'), null, { timeout: 5000 });
      ok(Date.now() - t0 > 400, `${name}: it takes a moment (the piece slides, it is not instant)`);
      ok(await page.$$eval('#xq-board .xq-p', (x) => x.length) === n0 - 1 && await page.$$eval('#xq-tray .xq-mini', (x) => x.length) === 1, `${name}: the captured piece is gone from the board and sits in the tray`);
      ok(await page.evaluate(([s]) => { const e = document.querySelector(`#xq-board .xq-p[data-sq="${s}"]`); return !!e && e.dataset.side === 'r'; }, [to]), `${name}: the capturing piece stands on the target`);
      await waitIdle(page);
    };
    await scene('cannon', '4k4/1r7/9/9/9/1p7/9/1C7/9/3K5 w', sq(7, 1), sq(1, 1), '.xq-ball, .xq-pow', 'capture-cannon');
    await scene('horse', '4k4/9/9/9/9/3r5/9/2N6/9/5K3 w', sq(7, 2), sq(5, 3), '.xq-puff, .xq-star', 'capture-horse');
    await scene('chariot', '4k4/9/9/9/9/p8/9/9/9/R2K5 w', sq(9, 0), sq(5, 0), '.xq-speed, .xq-pow', 'capture-chariot');
    // a plain move slides (transition) and a soldier capture uses the generic scene
    await load(page, '4k4/9/9/9/9/4p4/4P4/9/9/3K5 w', 1, 0);
    await click(page, sq(6, 4)); await click(page, sq(5, 4));
    await page.waitForSelector('#xq-wrap.xq-capturing', { timeout: 2000 });
    ok(await page.$eval('#xq-wrap', (w) => w.dataset.anim === 'capture-soldier'), 'a soldier takes with the general bonk scene');
    await waitIdle(page);
    // check and mate with motion: bubble and dizzy general
    await load(page, '4k4/9/9/9/9/9/9/9/R8/3K5 w', 1, 0);
    await page.evaluate(() => { window.__xq.noReply = true; });
    await click(page, sq(8, 0)); await click(page, sq(0, 0));
    await page.waitForSelector('#xq-check-bubble', { timeout: 3000 });
    const an = await page.evaluate(() => ({
      bubble: getComputedStyle(document.querySelector('#xq-check-bubble')).animationName,
      shake: getComputedStyle(document.querySelector('#xq-board .xq-p.xq-scared .xq-pi')).animationName,
      ring: getComputedStyle(document.querySelector('#xq-board .xq-ring')).animationName,
    }));
    ok(an.bubble.includes('xq-bubble'), 'check: the bubble animates (pop-in)');
    ok(an.shake.includes('xq-shake') && an.ring.includes('xq-ringflash'), 'check: the general shakes and the red ring flashes');
    await page.evaluate(() => { window.__xq.noReply = false; });
    await waitIdle(page);
    await load(page, '4k4/R8/9/9/9/8R/9/9/9/3K5 w', 1, 0);
    await click(page, sq(5, 8)); await click(page, sq(0, 8));
    await page.waitForSelector('#xq-board .xq-p.xq-dizzy', { timeout: 4000 });
    ok(true, 'checkmate: the losing general gets dizzy first ...');
    await page.waitForSelector('#xq-board .xq-p.xq-fallen', { timeout: 4000 });
    await page.waitForSelector('#xq-result', { timeout: 4000 });
    ok(true, '... then falls over and the result card comes');
    await page.screenshot({ path: OUT + 'xq-mate-motion.png' });
    ok(t.log.external.length === 0, 'OFFLINE with motion: ' + t.log.external.join(', '));
    await t.browser.close();
  }

  // ================= layout =================
  for (const [name, w, hh] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390], ['ipad-side', 1180, 820]]) {
    const t = await start(new Map(), { local: true, viewport: { width: w, height: hh } });
    const { page } = t;
    await page.evaluate(() => (location.hash = '#/games/xiangqi'));
    await page.waitForSelector('#xq-board .xq-p');
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
      const board = r('#xq-board'), top = r('.xq-top'), bottom = r('.xq-bottom'), hint = r('#xq-hint'), sel = r('#xq-sidesel');
      const pieces = [...document.querySelectorAll('#xq-board .xq-p')].map((p) => p.getBoundingClientRect());
      const bo = document.querySelector('#xq-board').getBoundingClientRect();
      return { board, top, bottom, hint, sel, W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
        inside: pieces.every((p) => p.left >= bo.left - 1 && p.right <= bo.right + 1 && p.top >= bo.top - 1 && p.bottom <= bo.bottom + 1),
        bodySw: document.body.scrollWidth, u: parseFloat(getComputedStyle(document.querySelector('#xq-wrap')).getPropertyValue('--u')),
        minTouch: Math.min(...pieces.map((p) => p.width)) };
    });
    ok(m.sw <= m.W && m.bodySw <= m.W, `${name} ${w}x${hh}: no horizontal overflow`);
    ok(m.board.l >= 0 && m.board.r <= m.W && m.bottom.b <= m.H + 1 && m.top.t >= 0, `${name}: board and controls are inside the screen (board ${Math.round(m.board.w)}x${Math.round(m.board.h)}, u=${m.u.toFixed(1)})`);
    ok(m.inside, `${name}: every piece is inside the board`);
    if (name === 'side') {
      const left = m.board.l, right = m.W - Math.max(m.bottom.r, m.top.r, m.hint.r);
      ok(Math.abs(left - right) <= 40, `${name}: board + panel are centred (space left ${Math.round(left)} / right ${Math.round(right)})`);
    } else {
      const cx = (m.board.l + m.board.r) / 2;
      ok(Math.abs(cx - m.W / 2) <= 3, `${name}: the board is centred (centre ${Math.round(cx)} of ${m.W / 2})`);
    }
    ok(m.board.w >= 160, `${name}: the board is big enough to play (${Math.round(m.board.w)} px wide, piece ${m.minTouch.toFixed(0)} px)`);
    await page.screenshot({ path: OUT + `xq-${name}.png` });
    // a resize re-lays out
    const u0 = m.u;
    await page.setViewportSize({ width: w === 320 ? 400 : 320, height: w === 320 ? 700 : 568 });
    await page.waitForTimeout(300);
    const u1 = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#xq-wrap')).getPropertyValue('--u')));
    ok(u1 !== u0, `${name}: resizing the window re-lays out the board (u ${u0.toFixed(1)} -> ${u1.toFixed(1)})`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: still no overflow after the resize`);
    ok(t.log.external.length === 0, `${name}: nothing left the app`);
    await t.browser.close();
  }
  await done();
})();
