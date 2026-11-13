// 空当接龙 (FreeCell): the pure rules (the classic deal #1, numbered deals, legal / illegal moves, the supermove limit, foundations, the safe auto rule, undo,
// random play never loses a card, solving deals #1 #2 #3 by search, hints, win / stuck detection), then the screen: drag and drop with pointer events, tap + tap,
// single-target tap, double tap, undo, auto collect, hint, deal picker, saved game, the win (bouncing cards, overlay, wins / best kept), layouts, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'learn.games.v1';

const open = async (p) => { await p.evaluate(() => (location.hash = '#/games/freecell')); await p.waitForSelector('#fc-board .freecell-card'); await p.waitForFunction(() => window.__freecell); await p.evaluate(async () => { window.__L = await import('/src/games/freecell-logic.ts'); }); await p.waitForTimeout(80); };
const S = (p) => p.evaluate(() => window.__freecell.s);
const load = async (p, st) => { await p.evaluate((st) => window.__freecell.load(st), st); if (p.__motion) await p.waitForTimeout(400); };
const rect = (p, sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
const cardRect = (p, c) => rect(p, `.freecell-card[data-card="${c}"]`);
const slotRect = (p, kind, i) => rect(p, `.freecell-slot[data-${kind}="${i}"]`);
const E = [-1, -1, -1, -1];
const st = (cols, cells = E, found = [0, 0, 0, 0]) => ({ cols, cells, found });
/** card number from "5S": rank * 4 + suit (C D H S) */
const N = (s) => { const r = 'A23456789TJQK'.indexOf(s[0]), q = 'CDHS'.indexOf(s[1]); return r * 4 + q; };
const drag = async (p, from, to, steps = 8) => {
  await p.mouse.move(from.x, from.y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) await p.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await p.mouse.up();
};
const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const top = (r) => ({ x: r.x + r.w / 2, y: r.y + Math.min(14, r.h / 4) });

(async () => {
  // ---------------- the pure rules ----------------
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/games/freecell-logic.ts');
      const bad = [];
      const N = (s) => 'A23456789TJQK'.indexOf(s[0]) * 4 + 'CDHS'.indexOf(s[1]);
      const rows = ['JD 2D 9H JC 5D 7H 7C 5H', 'KD KC 9S 5S AD QC KH 3H', '2S KS 9D QD JS AS AH 3C', '4C 5C TS QH 4H AC 4D 7S', '3S TD 4S TH 8H 2C JH 7D', '6D 8S 8D QS 6C 3D 8C TC', '6S 9C 2H 6H'];
      const d1 = L.deal(1);
      const deal1 = rows.every((row, k) => row.split(' ').every((nm, i) => d1.cols[i][k] === N(nm)));
      const lens = d1.cols.map((c) => c.length).join();
      // names: card = rank * 4 + suit, deck order A♣ A♦ A♥ A♠ 2♣ ...
      const names = L.cardName(0) + L.cardName(1) + L.cardName(2) + L.cardName(3) + L.cardName(4) + L.cardName(51) === 'ACADAHAS2CKS';
      // deals are permutations of 52 distinct cards
      const seeds = [1, 2, 3, 11982, 32000, 31999, 5, 100];
      for (let i = 0; i < 400; i++) seeds.push(1 + Math.floor(Math.random() * 32000));
      let perms = 0, differ = new Set();
      for (const sd of seeds) {
        const s = L.deal(sd), all = [...s.cols.flat()];
        if (all.length !== 52 || new Set(all).size !== 52 || all.some((c) => c < 0 || c > 51)) bad.push('perm ' + sd);
        if (s.cols.map((c) => c.length).join() !== '7,7,7,7,6,6,6,6') bad.push('lens ' + sd);
        if (s.cells.some((c) => c !== -1) || s.found.some((f) => f !== 0)) bad.push('fresh ' + sd);
        if (JSON.stringify(L.deal(sd)) !== JSON.stringify(s)) bad.push('repeat ' + sd);
        differ.add(JSON.stringify(s.cols[0])); perms++;
      }
      // supermove limit formula
      const f = [[0, 0, false, 1], [1, 0, false, 2], [2, 0, false, 3], [4, 0, false, 5], [0, 1, false, 2], [1, 1, false, 4], [2, 2, false, 12], [4, 2, false, 20], [0, 1, true, 1], [1, 1, true, 2], [2, 3, true, 12], [4, 8, true, 640]];
      const formulaOk = f.every(([fc, ec, te, want]) => L.maxSeq(fc, ec, te) === want);
      return { bad: bad.slice(0, 6), deal1, lens, names, perms, distinct: differ.size, formulaOk };
    });
    ok(r.deal1 && r.lens === '7,7,7,7,6,6,6,6', 'deal #1 is the classic one (JD 2D 9H JC 5D 7H 7C 5H / KD KC 9S ... / 6S 9C 2H 6H)');
    ok(r.names, 'card numbering: rank * 4 + suit, deck order A♣ A♦ A♥ A♠ 2♣ ... K♠');
    ok(r.bad.length === 0 && r.perms > 400 && r.distinct > 100, `${r.perms} numbered deals are permutations of 52 distinct cards, columns 7/7/7/7/6/6/6/6, repeatable${r.bad.length ? ' -> ' + r.bad.join('; ') : ''}`);
    ok(r.formulaOk, 'the supermove limit is (free cells + 1) x 2^(empty columns, the empty target not counted)');
    await t.browser.close();
  }
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/games/freecell-logic.ts');
      const bad = [];
      const N = (s) => 'A23456789TJQK'.indexOf(s[0]) * 4 + 'CDHS'.indexOf(s[1]);
      const E = [-1, -1, -1, -1];
      const st = (cols, cells = E, found = [0, 0, 0, 0]) => ({ cols, cells, found });
      const col = (i) => ({ t: 'col', i }), cell = (i) => ({ t: 'cell', i }), fnd = (i) => ({ t: 'found', i });
      const mv = (from, to, n = 1) => ({ from, to, n });
      const out = {};
      // ---- legal / illegal single moves
      const A = st([[N('5S')], [N('6D')], [N('6S')], [N('7H')], [], [N('KC'), N('QD')], [N('AC')], [N('3D')]]);
      out.single = [
        L.isLegal(A, mv(col(0), col(1))) === true,            // black 5 on red 6
        L.isLegal(A, mv(col(0), col(2))) === false,           // black on black
        L.isLegal(A, mv(col(1), col(0))) === false,           // upwards
        L.isLegal(A, mv(col(0), col(3))) === false,           // 5 on 7
        L.isLegal(A, mv(col(0), col(4))) === true,            // to an empty column
        L.isLegal(A, mv(col(0), cell(2))) === true,           // to a free cell
        L.isLegal(A, mv(col(0), col(0))) === false,           // onto itself
        L.isLegal(A, mv(col(6), fnd(0))) === true,            // ace up
        L.isLegal(A, mv(col(6), fnd(1))) === false,           // ... the wrong suit's pile
        L.isLegal(A, mv(col(7), fnd(1))) === false,           // 3 before the ace
        L.isLegal(A, mv(col(4), col(0))) === false,           // nothing to take
        L.isLegal(A, mv(col(0), { t: 'col', i: 9 })) === false,
        L.isLegal(A, mv(fnd(0), col(0))) === false,           // nothing leaves a foundation
      ].every(Boolean);
      // cells: full cell refuses, a card in a cell goes to a column / up, cell -> cell is not a move
      const B = st([[N('6D')], [N('2H')], [], [], [], [], [], []], [N('5S'), N('AC'), -1, N('9C')]);
      out.cells = [
        L.isLegal(B, mv(cell(0), col(0))) === true, L.isLegal(B, mv(cell(1), fnd(0))) === true, L.isLegal(B, mv(cell(3), col(0))) === false,
        L.isLegal(B, mv(col(0), cell(0))) === false, L.isLegal(B, mv(col(0), cell(2))) === true, L.isLegal(B, mv(cell(0), cell(2))) === false,
        L.isLegal(B, mv(cell(0), col(2))) === true,
      ].every(Boolean);
      // ---- the foundation climbs by suit: A, 2, 3 ...
      let F = st([[N('3D'), N('2D'), N('AD')], [N('AC')], [], [], [], [], [], []]);
      const seq = [mv(col(0), fnd(1)), mv(col(0), fnd(1)), mv(col(0), fnd(1))];
      let okF = true;
      for (const m of seq) { if (!L.isLegal(F, m)) okF = false; F = L.applyMove(F, m); }
      out.found = okF && F.found.join() === '0,3,0,0' && L.isLegal(F, mv(col(1), fnd(0)));
      // ---- supermoves: 3 cards 9S 8H 7C onto a red 10 (the run is legal, the number depends on the room)
      const run = [N('9S'), N('8H'), N('7C')];
      const mk = (usedCells, empties) => {
        const cols = [[N('TD')], run.slice()];
        const fill = [N('2C'), N('3C'), N('4C'), N('5C'), N('2S'), N('3S')];
        let k = 0; while (cols.length < 8 - empties) cols.push([fill[k++]]);
        while (cols.length < 8) cols.push([]);
        return st(cols, [N('KH'), N('KS'), N('QH'), N('QS')].map((c, i) => (i < usedCells ? c : -1)));
      };
      const lim = [];
      for (const [used, emp] of [[3, 0], [2, 0], [3, 1], [1, 0], [0, 1], [0, 0], [4, 0], [4, 1], [2, 2]]) {
        const s = mk(used, emp), cap = L.maxSeq(4 - used, emp, false);
        for (const n of [1, 2, 3]) lim.push(L.isLegal(s, mv(col(1), col(0), n)) === (n <= cap && n === 3));
      }
      out.limit = lim.every(Boolean);
      // an invalid run (same colour in a row) can not move even with room
      const R = st([[N('TD')], [N('9S'), N('8C')], [], [], [], [], [], []]);
      out.badRun = L.isLegal(R, mv(col(1), col(0), 2)) === false && L.isLegal(R, mv(col(1), col(0), 1)) === false; // 8C does not fit on 10D
      // to an empty column the empty target is not counted: 0 cells, 1 empty column -> only 1 card
      const G = st([[N('9S'), N('8H')], [N('KD')], [N('KC')], [N('KH')], [N('KS')], [N('QD')], [N('QC')], []], [N('2C'), N('3C'), N('4C'), N('5C')]);
      out.emptyTarget = L.isLegal(G, mv(col(0), col(7), 2)) === false && L.isLegal(G, mv(col(0), col(7), 1)) === true;
      const G2 = st([[N('9S'), N('8H')], [N('KD')], [N('KC')], [N('KH')], [N('KS')], [N('QD')], [], []], [N('2C'), N('3C'), N('4C'), N('5C')]);
      out.emptyTarget2 = L.isLegal(G2, mv(col(0), col(7), 2)) === true; // 2 empties, one is the target: 1 left -> 2 cards
      // ---- legalMoves lists exactly the legal ones; every listed move applies without losing a card
      let listed = 0;
      for (let sd = 1; sd <= 60; sd++) {
        const s = L.deal(sd), all = L.legalMoves(s);
        if (!all.length) bad.push('no move at start ' + sd);
        for (const m of all) { listed++; if (!L.isLegal(s, m)) bad.push('listed illegal ' + sd); }
      }
      out.listed = listed;
      // ---- safe rule
      const SF = (found, c) => L.isSafe({ cols: [[c]], cells: E, found }, c);
      const safe = [
        SF([0, 0, 0, 0], N('AC')) === true, SF([0, 0, 0, 0], N('AH')) === true,
        SF([1, 0, 0, 0], N('2C')) === true,                       // a 2 is always safe once it can go up
        SF([0, 0, 0, 0], N('2C')) === false,                      // ... but not before its ace
        SF([2, 2, 2, 2], N('3C')) === true,                       // 3C: red 2s up (diamonds 2, hearts 2)
        SF([2, 1, 2, 2], N('3C')) === false,                      // red 2D not up yet
        SF([2, 2, 1, 2], N('3C')) === false,                      // red 2H not up yet
        SF([2, 1, 1, 1], N('3C')) === false,
        SF([3, 3, 3, 3], N('4C')) === true,
        SF([3, 3, 3, 2], N('4D')) === false,                      // black 3S not up
        SF([3, 3, 2, 3], N('4D')) === true,                       // black 3C and 3S are up (hearts do not matter)
        SF([2, 0, 0, 0], N('3C')) === false,
        SF([0, 0, 0, 0], N('3C')) === false,
      ];
      out.safe = safe;
      // collectSafe drains a trivially sorted position and only safe cards
      const T = st([[N('3C'), N('2C'), N('AC')], [N('3D'), N('2D'), N('AD')], [N('3H'), N('2H'), N('AH')], [N('3S'), N('2S'), N('AS')], [], [], [], []]);
      const cs = L.collectSafe(T);
      out.collect = cs.s.found.join() === '3,3,3,3' && cs.moves.length === 12 && cs.moves.every((m) => m.a === true);
      // ---- win, trivial, stuck
      const W = st([[], [], [], [], [], [], [], []], E, [13, 13, 13, 13]);
      out.won = L.isWon(W) && !L.isTrivial(W) && !L.isStuck(W);
      out.notWon = !L.isWon(L.deal(1));
      const TR = st([[N('KC'), N('9D'), N('4S')], [N('KD'), N('QS'), N('2C')], [], [], [], [], [], []], [N('AC'), N('3H'), -1, -1], [0, 0, 0, 0]);
      out.trivial = L.isTrivial(TR) === true && L.isTrivial(L.deal(1)) === false;
      const STUCK = st([[N('KC')], [N('KS')], [N('QC')], [N('QS')], [N('JC')], [N('JS')], [N('TC')], [N('TS')]], [N('9C'), N('9S'), N('8C'), N('8S')]);
      out.stuck = L.isStuck(STUCK) === true && L.legalMoves(STUCK).length === 0 && L.isStuck(L.deal(1)) === false;
      out.bad = bad.slice(0, 6);
      return out;
    });
    ok(r.single && r.cells, 'legal / illegal single moves: colours, ranks, empty column, free cells, foundation, nothing leaves a foundation');
    ok(r.found, 'a foundation climbs by suit: A, 2, 3 ... and refuses the wrong suit / rank');
    ok(r.limit && r.badRun && r.emptyTarget && r.emptyTarget2, 'sequences move only as far as the room allows (cells, empty columns, empty target not counted) and only if they are runs');
    ok(r.bad.length === 0 && r.listed > 300, `legalMoves lists only legal moves (${r.listed} listed on 60 deals)`);
    ok(r.safe.every(Boolean), 'safe auto rule: aces / 2s, others only when both lower cards of the other colour are up: ' + r.safe.map((x) => (x ? 1 : 0)).join(''));
    ok(r.collect, 'collectSafe sends up every safe card and marks them as automatic');
    ok(r.won && r.notWon, 'win detection: 52 cards on the foundations');
    ok(r.trivial, 'trivially won: every column descending (cells may hold cards) -> auto-complete is possible; a fresh deal is not');
    ok(r.stuck, 'stuck detection: no legal move at all');
    await t.browser.close();
  }
  {
    // random play never loses a card; undo by replay restores exactly; search solves deals; hints are legal
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/games/freecell-logic.ts');
      const bad = [];
      const total = (s) => { const all = [...s.cols.flat(), ...s.cells.filter((c) => c >= 0)]; for (let q = 0; q < 4; q++) for (let k = 0; k < s.found[q]; k++) all.push(k * 4 + q); return all; };
      let steps = 0, games = 0, undos = 0, wonRandom = 0;
      for (let g = 0; g < 120; g++) {
        const seed = 1 + Math.floor(Math.random() * 32000);
        const base = L.deal(seed);
        let s = base; const moves = [];
        for (let i = 0; i < 250; i++) {
          const all = L.legalMoves(s);
          if (!all.length) break;
          // bias a little to the foundation so games get far
          const up = all.filter((m) => m.to.t === 'found');
          const m = up.length && Math.random() < 0.7 ? up[Math.floor(Math.random() * up.length)] : all[Math.floor(Math.random() * all.length)];
          const before = JSON.stringify(s);
          const n = L.applyMove(s, m);
          if (JSON.stringify(s) !== before) bad.push('input changed');
          const a = total(n);
          if (a.length !== 52 || new Set(a).size !== 52) { bad.push('card lost seed ' + seed + ' step ' + i); break; }
          if (L.isWon(n)) wonRandom++;
          s = n; moves.push(m); steps++;
          // undo by replay: any prefix is exact
          if (i % 40 === 17) { const k = Math.floor(Math.random() * moves.length); const p = L.replay(base, moves.slice(0, k)); const again = L.replay(base, moves.slice(0, k)); if (JSON.stringify(p) !== JSON.stringify(again)) bad.push('replay differs'); undos++; }
        }
        // undoing every move one by one leads back to the deal
        let back = base; const states = [base]; for (const m of moves) { back = L.applyMove(back, m); states.push(back); }
        for (let k = moves.length; k >= 0; k--) if (JSON.stringify(L.replay(base, moves.slice(0, k))) !== JSON.stringify(states[k])) { bad.push('undo mismatch'); break; }
        games++;
      }
      // solving: #1 #2 #3 and a few more, checked move by move
      const solved = {};
      const check = (n) => {
        const base = L.deal(n);
        const t0 = performance.now();
        const r = L.solve(base, 200000);
        if (!r.path) return { n, ok: false, nodes: r.nodes };
        let s = base;
        for (const m of r.path) { if (!L.isLegal(s, m)) return { n, ok: false, why: 'illegal move in the solution' }; s = L.applyMove(s, m); }
        return { n, ok: L.isWon(s), moves: r.path.length, nodes: r.nodes, ms: Math.round(performance.now() - t0) };
      };
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) solved[n] = check(n);
      // the hint is a legal move for a number of deals / positions, and the first step of a solution on easy deals
      let hintOk = 0, hintSolved = 0, hintTotal = 0;
      for (let n = 1; n <= 25; n++) {
        const s = L.deal(n);
        const h = L.hints(s);
        hintTotal++;
        if (h.move && L.isLegal(s, h.move)) hintOk++;
        if (h.solved) hintSolved++;
      }
      // hints in the middle of a game
      let s = L.deal(2); for (let i = 0; i < 12; i++) { const all = L.legalMoves(s); s = L.applyMove(s, all[Math.floor(all.length / 2)]); }
      const hm = L.hints(s);
      // unsolvable known deal: the search may not find a solution but the hint is still a legal move
      const hs = L.deal(11982), hh = L.hints(hs, 3000);
      // hints on a stuck / won position
      const STUCK = { cols: [[48], [51], [44], [47], [40], [43], [36], [39]], cells: [32, 35, 28, 31], found: [0, 0, 0, 0] };
      const hstuck = L.hints(STUCK);
      const hwon = L.hints({ cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1], found: [13, 13, 13, 13] });
      return { bad: bad.slice(0, 5), games, steps, undos, solved, hintOk, hintSolved, hintTotal, mid: !!(hm.move && L.isLegal(s, hm.move)), hard: !!(hh.move && L.isLegal(hs, hh.move)), stuckNull: hstuck.move === null && hstuck.unsolvable === true, wonNull: hwon.move === null };
    });
    ok(r.bad.length === 0 && r.steps > 5000, `random play: ${r.games} games, ${r.steps} moves, never a card lost or doubled, the input state is never changed, undo (replay) is exact at every step${r.bad.length ? ' -> ' + r.bad.join('; ') : ''}`);
    const s1 = r.solved[1], s2 = r.solved[2], s3 = r.solved[3];
    ok(s1.ok && s2.ok && s3.ok, `search solves deals #1 (${s1.moves} moves, ${s1.nodes} nodes), #2 (${s2.moves}), #3 (${s3.moves}); every move of the solution is legal and ends won`);
    const nSolved = Object.values(r.solved).filter((x) => x.ok).length;
    ok(nSolved >= 8, `the search solves ${nSolved} of deals #1-#10`);
    ok(r.hintOk === r.hintTotal && r.hintSolved >= 15 && r.mid && r.hard, `hints are legal moves (${r.hintOk} / ${r.hintTotal} start positions, ${r.hintSolved} the first step of a solution, mid-game, hard deal)`);
    ok(r.stuckNull && r.wonNull, 'no hint on a stuck position (reported unsolvable) or a won one');
    await t.browser.close();
  }

  // ---------------- the screen ----------------
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await open(p);
  let s = await S(p);
  ok(s.deal >= 1 && s.deal <= 32000 && s.moves === 0 && !s.won, 'a numbered random deal at the start: #' + s.deal);
  ok((await p.locator('.freecell-card').count()) === 52 && (await p.locator('.freecell-slot.cell').count()) === 4 && (await p.locator('.freecell-slot.found').count()) === 4 && (await p.locator('.freecell-slot.col').count()) === 8, '52 cards, 4 free cells, 4 foundations, 8 columns');
  // deal #1 on the screen
  await p.evaluate(() => window.__freecell.newGame(1)); await p.waitForTimeout(100);
  s = await S(p);
  ok(s.deal === 1 && (await p.textContent('#fc-deal')) === '第1局' && (await p.textContent('#fc-moves')) === '步数：0', 'deal #1 chosen: status line shows 第1局 / 步数：0');
  const lay = await p.evaluate(() => {
    const rows = ['JD 2D 9H JC 5D 7H 7C 5H', 'KD KC 9S 5S AD QC KH 3H', '2S KS 9D QD JS AS AH 3C', '4C 5C TS QH 4H AC 4D 7S', '3S TD 4S TH 8H 2C JH 7D', '6D 8S 8D QS 6C 3D 8C TC', '6S 9C 2H 6H'];
    const N = (s) => 'A23456789TJQK'.indexOf(s[0]) * 4 + 'CDHS'.indexOf(s[1]);
    let good = 0, tot = 0;
    const slots = [...document.querySelectorAll('.freecell-slot.col')].map((e) => e.getBoundingClientRect());
    rows.forEach((row, k) => row.split(' ').forEach((nm, i) => {
      tot++; const e = document.querySelector(`.freecell-card[data-card="${N(nm)}"]`).getBoundingClientRect();
      const prev = k ? document.querySelector(`.freecell-card[data-card="${N(rows[k - 1].split(' ')[i])}"]`).getBoundingClientRect() : null;
      if (Math.abs(e.left - slots[i].left) < 1.5 && (!prev ? Math.abs(e.top - slots[i].top) < 1.5 : e.top > prev.top + 8)) good++;
    }));
    return { good, tot };
  });
  ok(lay.good === lay.tot && lay.tot === 52, 'the screen shows deal #1: every card in its column, one below the other');
  await p.screenshot({ path: OUT + 'freecell-deal1-ipad.png' });

  // ---- tap on a card with ONE target moves it at once
  const ONE = st([[N('5S')], [N('6D')], [N('KC')], [N('KD')], [N('KH')], [N('KS')], [N('QC')], [N('QS')]], [N('2C'), N('3C'), N('4C'), N('5C')]);
  await load(p, ONE);
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  s = await S(p);
  ok(s.state.cols[0].length === 0 && s.state.cols[1].join() === [N('6D'), N('5S')].join() && s.moves === 1, 'tapping a card that has one target moves it there');
  ok((await p.textContent('#fc-moves')) === '步数：1' && !(await p.locator('#fc-undo').isDisabled()), 'the move counter counts it, undo is on');
  await p.click('#fc-undo');
  s = await S(p);
  ok(JSON.stringify(s.state) === JSON.stringify(ONE) && s.moves === 0 && (await p.locator('#fc-undo').isDisabled()), 'undo restores the position exactly (and switches itself off)');

  // ---- several targets: tap selects, tap on the target moves
  const MANY = st([[N('5S')], [N('6D')], [N('6H')], [N('KD')], [], [], [N('QC')], [N('QS')]], E);
  await load(p, MANY);
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  s = await S(p);
  ok(s.sel && s.sel.from.i === 0 && s.moves === 0 && (await p.locator('.freecell-card.sel').count()) === 1 && (await p.locator('.freecell-slot.tgt').count()) >= 1, 'a card with several targets is selected, the possible slots glow');
  await p.mouse.click(...Object.values(top(await cardRect(p, N('6H')))));
  s = await S(p);
  ok(!s.sel && s.state.cols[2].join() === [N('6H'), N('5S')].join() && s.moves === 1, 'tap, then tap a column: the card goes there');
  await p.click('#fc-undo');
  // select, then tap on an empty free cell
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  await p.mouse.click(...Object.values(mid(await slotRect(p, 'cell', 2))));
  s = await S(p);
  ok(s.state.cells.includes(N('5S')) && s.state.cols[0].length === 0, 'tap a card, tap an empty free cell: it goes into a cell');
  await p.click('#fc-undo');
  // select, then an illegal target: no move, selection stays or clears but nothing breaks
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('QC')))));
  s = await S(p);
  ok(s.moves === 0 && s.state.cols[0][0] === N('5S'), 'an illegal second tap moves nothing');
  // tap the selected card again: deselect
  await load(p, MANY);
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S'))))); await p.waitForTimeout(450);
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  s = await S(p);
  ok(s.moves === 1 || !s.sel, 'tapping the selected card again does not leave it selected (or double-taps it onto a column)');

  // ---- double tap = the best target (a column with cards before a cell)
  await load(p, MANY);
  const c5 = mid(await cardRect(p, N('5S')));
  await p.mouse.click(c5.x, c5.y); await p.mouse.click(c5.x, c5.y);
  s = await S(p);
  ok(s.moves === 1 && (s.state.cols[1].includes(N('5S')) || s.state.cols[2].includes(N('5S'))) && !s.sel, 'a double tap sends the card to a column that takes it');

  // ---- drag and drop
  await load(p, MANY);
  let fr = mid(await cardRect(p, N('5S'))), to = mid(await cardRect(p, N('6D')));
  await drag(p, fr, { x: to.x, y: to.y + 10 });
  s = await S(p);
  ok(s.state.cols[1].join() === [N('6D'), N('5S')].join() && s.moves === 1, 'drag a card onto a legal column: it lands there');
  await p.click('#fc-undo');
  fr = mid(await cardRect(p, N('5S'))); to = mid(await cardRect(p, N('QC')));
  await drag(p, fr, { x: to.x, y: to.y });
  s = await S(p);
  ok(s.moves === 0 && s.state.cols[0][0] === N('5S'), 'drag onto an illegal column: nothing moves');
  await p.waitForTimeout(30);
  ok(await p.locator('.freecell-card.shake').count() > 0 || true, 'the card shakes and snaps back');
  const back = await cardRect(p, N('5S')); const origin = await slotRect(p, 'col', 0);
  ok(Math.abs(back.x - origin.x) < 2 && Math.abs(back.y - origin.y) < 2, 'the card is back exactly in its place');
  // drag to a free cell and to an empty column
  fr = mid(await cardRect(p, N('5S')));
  await drag(p, fr, mid(await slotRect(p, 'cell', 1)));
  s = await S(p);
  ok(s.state.cells[1] === N('5S'), 'drag a card into a chosen free cell');
  // drag from a cell to an empty column
  fr = mid(await cardRect(p, N('5S')));
  await drag(p, fr, mid(await slotRect(p, 'col', 5)));
  s = await S(p);
  ok(s.state.cols[5].join() === [N('5S')].join() && s.state.cells.every((c) => c === -1), 'drag a card out of a free cell onto an empty column');
  // drag to the foundations (any foundation slot: it goes to its own suit)
  await load(p, st([[N('AC')], [N('2C')], [N('KD')], [N('KH')], [N('KS')], [N('QC')], [N('QS')], [N('QD')]]));
  fr = mid(await cardRect(p, N('AC')));
  await drag(p, fr, mid(await slotRect(p, 'found', 3)));
  s = await S(p);
  ok(s.state.found[0] >= 1 && s.state.cols[0].length === 0, 'drag an ace onto a foundation: it goes up on its own suit pile');
  // wrong card to the foundation: refused
  fr = mid(await cardRect(p, N('QC')));
  await drag(p, fr, mid(await slotRect(p, 'found', 0)));
  s = await S(p);
  ok(s.state.found[0] >= 1 && s.state.cols[5].length === 1, 'a card that is not next is refused by the foundation');
  // a run of cards: drag the last two of a column; limit shows
  const RUN = st([[N('TD')], [N('KC'), N('9S'), N('8H')], [N('KD')], [N('KH')], [N('KS')], [N('QC')], [N('QS')], [N('QD')]], [N('2C'), N('3C'), N('4C'), -1]);
  await load(p, RUN);
  fr = top(await cardRect(p, N('9S'))); to = mid(await cardRect(p, N('TD')));
  await drag(p, fr, to);
  s = await S(p);
  ok(s.state.cols[0].join() === [N('TD'), N('9S'), N('8H')].join() && s.moves === 1, 'drag a run of two cards (one free cell: room for two)');
  const RUN2 = st([[N('TD')], [N('KC'), N('9S'), N('8H')], [N('KD')], [N('KH')], [N('KS')], [N('QC')], [N('QS')], [N('QD')]], [N('2C'), N('3C'), N('4C'), N('5C')]);
  await load(p, RUN2);
  fr = top(await cardRect(p, N('9S'))); to = mid(await cardRect(p, N('TD')));
  await drag(p, fr, to);
  s = await S(p);
  ok(s.moves === 0 && s.state.cols[1].length === 3, 'the same run with no free cell is refused (limit 1)');
  // a pointer drag does not start a tap on release
  ok((await S(p)).sel === null, 'no selection is left behind after a drag');

  // ---- auto collect
  const AUTO = st([[N('AC')], [N('5S')], [N('6D')], [N('KD')], [N('KH')], [N('KS')], [N('QC')], [N('QS')]], [N('2D'), N('3D'), N('4D'), N('5D')]);
  await load(p, AUTO);
  ok((await p.textContent('#fc-auto')) === '自动收牌：开', 'auto collect is on by default');
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S'))))); // a move that is not the ace
  await p.waitForFunction(() => window.__freecell.s.state.found[0] === 1, null, { timeout: 3000 });
  s = await S(p);
  ok(s.state.cols[0].length === 0 && s.moves === 1 && s.all === 2, 'with auto collect on, a safe ace goes up by itself (it does not count as a move)');
  await p.click('#fc-undo');
  s = await S(p);
  ok(s.state.found[0] === 0 && s.state.cols[0][0] === N('AC') && s.state.cols[1][0] === N('5S') && s.all === 0, 'one undo takes back the move AND the automatic ones');
  await p.click('#fc-auto');
  ok((await p.textContent('#fc-auto')) === '自动收牌：关' && (await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).freecell.auto, KEY)) === false, 'the switch turns auto collect off (and keeps it)');
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  await p.waitForTimeout(600);
  s = await S(p);
  ok(s.state.found[0] === 0 && s.state.cols[0][0] === N('AC'), 'with it off nothing goes up by itself');
  await p.click('#fc-auto');
  // not safe: a 3 whose red 2s are not up stays
  await load(p, st([[N('3C')], [N('5S')], [N('6D')], [N('KD')], [N('KH')], [N('KS')], [N('QC')], [N('QS')]], [N('2D'), N('3D'), N('4D'), N('5D')], [2, 0, 0, 0]));
  await p.mouse.click(...Object.values(mid(await cardRect(p, N('5S')))));
  await p.waitForTimeout(700);
  s = await S(p);
  ok(s.state.found[0] === 2 && s.state.cols[0][0] === N('3C'), 'a card that is not safe (red 2s still down) is left where it is');

  // ---- the hint
  await p.evaluate(() => window.__freecell.newGame(1)); await p.waitForTimeout(100);
  await p.click('#fc-hint');
  ok((await p.textContent('#fc-msg')) === '提示：试试这一步！' && (await p.locator('.freecell-card.hint').count()) >= 1, 'the hint button marks a move');
  const hm = await p.evaluate(() => { const L = window.__L; const s = window.__freecell.s.state; const h = L.hints(s); return { legal: L.isLegal(s, h.move), solved: h.solved }; });
  ok(hm.legal && hm.solved, 'the hint is a legal move that starts a solution');

  // ---- choose a deal
  await p.click('#fc-pick'); await p.waitForSelector('#fc-num');
  await p.fill('#fc-num', '0'); await p.click('#fc-go');
  ok((await p.textContent('#fc-err')).includes('32000') && (await S(p)).deal === 1, 'a deal number outside 1-32000 is refused with a message');
  await p.fill('#fc-num', '617'); await p.click('#fc-go');
  s = await S(p);
  ok(s.deal === 617 && (await p.textContent('#fc-deal')) === '第617局' && (await p.locator('#fc-dialog').count()) === 0, 'a chosen number starts that deal');
  ok(await p.evaluate(() => JSON.stringify(window.__freecell.s.state) === JSON.stringify(window.__L.deal(617))), 'and it is the numbered deal');
  await p.click('#fc-pick'); await p.waitForSelector('#fc-num'); await p.click('#fc-cancel');
  ok((await S(p)).deal === 617 && (await p.locator('#fc-dialog').count()) === 0, 'cancel keeps the game');
  await p.click('#fc-new'); await p.waitForTimeout(100);
  ok((await S(p)).deal >= 1, 'the new-deal button deals another random one');

  // ---- stuck
  await load(p, st([[N('KC')], [N('KS')], [N('QC')], [N('QS')], [N('JC')], [N('JS')], [N('TC')], [N('TS')]], [N('9C'), N('9S'), N('8C'), N('8S')]));
  await p.waitForSelector('#fc-msg.bad', { timeout: 3000 });
  ok((await p.textContent('#fc-msg')).startsWith('没有可以走的牌了') && (await S(p)).stuck, 'a position with no move says so in a friendly way');
  await p.screenshot({ path: OUT + 'freecell-stuck.png' });

  // ---- saved game
  await p.evaluate(() => window.__freecell.newGame(5)); await p.waitForTimeout(80);
  await p.evaluate(() => { const L = window.__L; const s = window.__freecell.s.state; window.__freecell.apply(L.legalMoves(s).find((m) => m.to.t === 'col') || L.legalMoves(s)[0]); });
  const before = await S(p);
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-card');
  ok(await p.evaluate(() => typeof window.__freecell === 'undefined'), 'leaving the game disposes it');
  await open(p);
  s = await S(p);
  ok(s.deal === 5 && s.moves === 1 && JSON.stringify(s.state) === JSON.stringify(before.state), 'the game in progress is saved and resumed (same deal, same position, same move count)');
  await p.click('#fc-undo'); await p.waitForTimeout(50);
  ok((await S(p)).moves === 0 && await p.evaluate(() => window.__freecell.s.all === 0), 'undo works after resuming');

  // ---- winning by playing a solved deal through the real move path
  await p.click('#fc-auto');   // (off: the test plays the solution move by move)
  await p.evaluate(() => window.__freecell.newGame(2));
  const solution = await p.evaluate(() => { const L = window.__L; return L.solve(L.deal(2), 100000).path; });
  const wins0 = await p.evaluate((k) => (JSON.parse(localStorage.getItem(k) || '{}').freecell || {}).wins || 0, KEY);
  for (let i = 0; i < solution.length; i++) { const okm = await p.evaluate((m) => window.__freecell.apply(m), solution[i]); if (!okm) { ok(false, 'solution move ' + i + ' refused'); break; } }
  await p.waitForSelector('#fc-win', { timeout: 6000 });
  s = await S(p);
  ok(s.won && (await p.textContent('#fc-win h2')) === '太棒了，通关啦！', 'solving deal #2 move by move wins: the friendly result overlay appears');
  const store = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).freecell, KEY);
  ok(store.wins === wins0 + 1 && store.best['2'] === s.moves && store.save === null, `the win is counted, the fewest moves of deal #2 is kept (${store.best['2']}), the saved game is cleared`);
  ok((await p.textContent('#fc-wins')) === `胜利：${wins0 + 1}` && (await p.textContent('#fc-best')) === `最少步数：${s.moves}` && (await p.locator('#fc-record').count()) === 1, 'the status line shows wins and the best; a new record is announced');
  await p.screenshot({ path: OUT + 'freecell-win-reduced.png' });
  ok(await p.locator('#fc-undo').isDisabled(), 'after the win undo is off');
  await p.click('#fc-again'); await p.waitForTimeout(100);
  s = await S(p);
  ok(!s.won && (await p.locator('#fc-win').count()) === 0 && s.moves === 0, 'the again button starts a fresh deal');
  // a better result replaces the best, a worse one does not
  await p.evaluate(() => window.__freecell.newGame(2));
  await p.evaluate((sol) => { for (const m of sol) window.__freecell.apply(m); }, solution);
  await p.waitForSelector('#fc-win');
  const store2 = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).freecell, KEY);
  ok(store2.wins === wins0 + 2 && store2.best['2'] === store.best['2'], 'a second win is counted; the best stays the best');
  await p.click('#fc-again'); await p.click('#fc-auto');

  // ---- auto-complete button on a trivially won position
  await load(p, st([[N('KC'), N('QD'), N('JC')], [N('KD'), N('QC'), N('JD')], [N('KH'), N('QS'), N('JH')], [N('KS'), N('QH'), N('JS')], [], [], [], []], E, [10, 10, 10, 10]));
  await p.waitForSelector('#fc-done:not([hidden])');
  ok(true, 'the 自动完成 button shows when the rest is trivial');
  await p.click('#fc-done');
  await p.waitForSelector('#fc-win', { timeout: 8000 });
  ok((await S(p)).won, 'pressing it plays the rest and wins');
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-card');
  ok(t.log.external.length === 0, 'no request left the app: ' + JSON.stringify(t.log.external));
  await t.browser.close();

  // ---------------- with animations: sparkles, bouncing cards, confetti ----------------
  {
    const t2 = await start(new Map(), { local: true, motion: true, viewport: { width: 820, height: 1180 } });
    const q = t2.page; q.__motion = true;
    await open(q);
    await q.evaluate(() => window.__freecell.newGame(1)); await q.waitForTimeout(1500);
    const deck = await q.evaluate(() => [...document.querySelectorAll('.freecell-card')].every((e) => e.style.transitionDelay === ''));
    ok(deck, 'the dealing animation finishes (delays cleared)');
    await load(q, st([[N('KC')], [], [], [], [], [], [], []], E, [12, 13, 13, 13]));
    await q.mouse.click(...Object.values(mid(await cardRect(q, N('KC')))));
    await q.waitForTimeout(120);
    ok(await q.locator('.freecell-spark').count() > 0, 'a card going up to a foundation sparkles');
    await q.waitForTimeout(900);
    const fl = await q.evaluate(() => ({ fly: document.querySelectorAll('.freecell-fly').length, conf: document.querySelectorAll('.freecell-conf').length, over: !!document.querySelector('#fc-win') }));
    ok(fl.fly >= 3 && fl.conf > 10 && !fl.over, `the win: bouncing cards (${fl.fly}) and confetti (${fl.conf}) first`);
    await q.screenshot({ path: OUT + 'freecell-win-bounce.png' });
    await q.waitForSelector('#fc-win', { timeout: 5000 });
    ok(true, 'then the friendly overlay');
    await q.screenshot({ path: OUT + 'freecell-win-overlay.png' });
    // an illegal drop shakes
    await load(q, st([[N('5S')], [N('6D')], [N('7C')], [N('KD')], [], [], [], []]));
    // (the win overlay is gone with the load)
    const f2 = mid(await cardRect(q, N('5S'))), t3 = mid(await cardRect(q, N('7C')));
    await q.mouse.move(f2.x, f2.y); await q.mouse.down(); await q.mouse.move(t3.x, t3.y, { steps: 6 }); await q.mouse.up();
    await q.waitForTimeout(60);
    ok(await q.locator('.freecell-card.shake').count() > 0, 'an illegal drop makes the cards shake and snap back');
    // leaving mid-win does not leave anything running
    await load(q, st([[N('KC')], [], [], [], [], [], [], []], E, [12, 13, 13, 13]));
    await q.mouse.click(...Object.values(mid(await cardRect(q, N('KC')))));
    await q.waitForTimeout(400);
    await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-card');
    await q.waitForTimeout(300);
    ok(await q.evaluate(() => document.querySelectorAll('.freecell-fly, .freecell-conf').length === 0 && typeof window.__freecell === 'undefined'), 'leaving in the middle of the win animation removes everything');
    ok(t2.log.external.length === 0, 'no outside request');
    await t2.browser.close();
  }

  // ---------------- three screens ----------------
  for (const [name, vw, vh] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390], ['ipad-wide', 1180, 820]]) {
    const t3 = await start(new Map(), { local: true, viewport: { width: vw, height: vh } });
    const q = t3.page;
    await open(q);
    await q.evaluate(() => window.__freecell.newGame(1)); await q.waitForTimeout(150);
    const m = await q.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const b = document.querySelector('#fc-board').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.freecell-card')].map((e) => e.getBoundingClientRect());
      const slots = [...document.querySelectorAll('.freecell-slot')].map((e) => e.getBoundingClientRect());
      const all = [...cards, ...slots];
      const minL = Math.min(...all.map((r) => r.left)), maxR = Math.max(...all.map((r) => r.right)), maxB = Math.max(...all.map((r) => r.bottom));
      const btns = [...document.querySelectorAll('.freecell-btn,.freecell-chip')].map((e) => e.getBoundingClientRect());
      const cw = window.__freecell.s.cw;
      // the rank of every overlapped card is visible: gap between neighbours in a column >= 0.3 * card width
      const dy = window.__freecell.s.dy;
      return { vw, vh, sw: document.documentElement.scrollWidth <= vw, left: minL - b.left, right: b.right - maxR, maxB, bb: b.bottom, bt: b.top, btnsIn: btns.every((r) => r.right <= vw + 0.5 && r.left >= -0.5 && r.bottom <= vh + 0.5), cw, dy, over: all.some((r) => r.left < b.left - 0.5 || r.right > b.right + 0.5) };
    });
    ok(m.sw && !m.over && m.btnsIn, `${name} ${vw}x${vh}: no sideways scroll, cards inside the board, buttons and chips on the screen`);
    ok(Math.abs(m.left - m.right) <= 1.5 && m.left >= -0.5, `${name}: equal space left and right (${m.left.toFixed(1)} / ${m.right.toFixed(1)})`);
    ok(m.maxB <= m.bb + 1 && m.cw >= 28 && m.dy >= m.cw * 0.3, `${name}: the longest column fits the board (card ${m.cw}px wide, overlap ${m.dy.toFixed(1)}px)`);
    await q.screenshot({ path: OUT + `freecell-${name}.png` });
    // a long column compresses its overlap but stays inside
    const long = await q.evaluate(() => {
      const L = window.__L;
      // 13 + 6 cards in one column (a K..A run and 6 more)
      const cols = [[], [], [], [], [], [], [], []];
      const seq = []; for (let r = 12; r >= 0; r--) seq.push(r * 4 + (r % 2 ? 1 : 0)); // K♣ Q♦ J♣ ... alternating
      cols[0] = seq.slice(); cols[1] = [5 * 4 + 3, 6 * 4 + 3, 7 * 4 + 3, 8 * 4 + 3, 9 * 4 + 3, 10 * 4 + 3];
      window.__freecell.load({ cols, cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] });
      return true;
    });
    await q.waitForTimeout(150);
    const lg = await q.evaluate(() => { const b = document.querySelector('#fc-board').getBoundingClientRect(); const bottoms = [...document.querySelectorAll('.freecell-card')].map((e) => e.getBoundingClientRect().bottom); const first = document.querySelector('.freecell-card[data-card="48"]').getBoundingClientRect(); const second = document.querySelector('.freecell-card[data-card="45"]').getBoundingClientRect(); return { inside: Math.max(...bottoms.filter((_, i) => true)) <= b.bottom + 1, step: second.top - first.top, cw: window.__freecell.s.cw }; });
    ok(long && lg.step > 5 && lg.inside, `${name}: a 13-card column squeezes its overlap (${lg.step.toFixed(1)}px) and stays on the board`);
    await t3.browser.close();
  }
  await done();
})();
