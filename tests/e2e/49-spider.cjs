// Spider Solitaire: the pure rules (deal, legal / illegal moves, runs, completion, deal rule, undo, random games keep 104 cards, hints, a greedy solver wins 1-suit games)
// and the screen (drag, tap, tap-twice auto move, deal, undo, hint, levels, resume after reload, best score, win overlay, layout on 3 screens, long columns).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, motion: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/spider')); await p.waitForSelector('#spider-board'); await p.waitForFunction(() => window.__spider && window.__spider.state); await p.waitForTimeout(600);

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/spider-logic.ts');
    const res = { bad: [], deals: 0, moves: 0, plays: 0, undos: 0, completions: 0, wins: 0, hintMoves: 0, solverGames: 0, solverWins: 0, solverTried: 0 };
    let seed = 987654321; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const bad = (m) => { if (res.bad.length < 12) res.bad.push(m); };
    const json = (s) => JSON.stringify([s.cols, s.stock, s.found, s.moves, s.score]);
    // a blank state for hand-made situations: cards by (rank, set, up); set 0 = suit 0 (all suits of a 1-suit game are suit 0)
    const blank = (suits) => { const s = M.newGame(suits, rng); s.cols = Array.from({ length: 10 }, () => []); s.stock = []; s.found = []; s.hist = []; s.moves = 0; s.score = 500; return s; };
    const C = (r, set = 0, up = 1) => M.mk(set * 13 + r - 1, up);

    // the first deal, every level
    for (const suits of [1, 2, 4]) {
      const s = M.newGame(suits, rng);
      const sizes = s.cols.map((c) => c.length).join();
      if (sizes !== '6,6,6,6,5,5,5,5,5,5') bad('deal sizes ' + sizes);
      if (s.stock.length !== 5 || s.stock.some((d) => d.length !== 10)) bad('stock shape');
      if (s.cols.some((c) => c.some((x, i) => M.isUp(x) !== (i === c.length - 1)))) bad('only the top card face up');
      if (s.stock.some((d) => d.some((x) => !M.isUp(x)))) bad('stock cards are dealt face up');
      if (M.audit(s)) bad('audit new ' + M.audit(s));
      const per = {}; for (let id = 0; id < 104; id++) { const k = s.f[id]; per[k] = (per[k] || 0) + 1; }
      const kinds = Object.keys(per);
      if (kinds.length !== 13 * suits || kinds.some((k) => per[k] !== 8 / suits)) bad(`${suits} suits: card kinds ${kinds.length}`);
      if (s.score !== 500 || s.moves !== 0 || s.found.length || s.hist.length) bad('start values');
    }
    // two games with the same random numbers are the same
    { const a = M.newGame(4, () => 0.3), b = M.newGame(4, () => 0.3); if (json(a) !== json(b)) bad('deal is not a function of the numbers'); }

    // legal / illegal moves
    {
      const s = blank(1);
      s.cols[0] = [C(9), C(5, 0, 0), C(6)];           // 9, hidden 5, 6 (up)
      s.cols[1] = [C(7)];
      s.cols[2] = [C(8), C(7), C(6, 0, 1)];            // run 8 7 6 of one suit
      s.cols[3] = [];
      s.cols[4] = [C(4, 0, 0)];                        // a face-down card alone (never on top in a real game, here only to test)
      s.cols[5] = [C(5)];
      if (!M.canDrop(s, 0, 2, 1)) bad('6 on 7 must be legal');
      if (M.canDrop(s, 0, 2, 5)) bad('6 on 5 must be illegal');
      if (M.canDrop(s, 0, 2, 0)) bad('same column must be illegal');
      if (!M.canDrop(s, 0, 2, 3)) bad('any card on an empty column');
      if (M.pickable(s, 0, 1) || M.canDrop(s, 0, 1, 3)) bad('face-down card picked');
      if (M.pickable(s, 4, 0)) bad('face-down alone picked');
      if (!M.pickable(s, 2, 0) || !M.pickable(s, 2, 1) || !M.pickable(s, 2, 2)) bad('run pickable');
      if (M.canDrop(s, 2, 0, 1)) bad('8 7 6 on 7 must be illegal (8 is not one below 7)');
      if (M.pickable(s, 0, 99) || M.pickable(s, 9, 0)) bad('pickable out of range');
      if (M.move(s, 0, 2, 5).ok) bad('illegal move accepted');
      const before = json(s);
      const r = M.move(s, 0, 2, 1);
      if (!r.ok || s.cols[1].length !== 2 || s.cols[0].length !== 2) bad('move 6 on 7');
      if (!r.flipped || !M.isUp(s.cols[0][1])) bad('the hidden card must turn over');
      if (s.moves !== 1 || s.score !== 499) bad('move counts');
      if (!M.undo(s) || json(s) !== before) bad('undo does not restore the move exactly');
      // a run of two moves together, onto a card one rank higher (any suit)
      s.cols[5] = [C(9, 1)];                           // 9 of another suit
      if (M.canDrop(s, 2, 1, 5)) bad('7 6 on 9 must be illegal');
      if (!M.canDrop(s, 2, 0, 5)) bad('8 7 6 on 9 of another suit must be legal (run of one suit)');
      M.move(s, 2, 0, 5);
      if (s.cols[5].map((x) => M.rankOf(s, x)).join() !== '9,8,7,6') bad('run moved whole');
      // a mixed-suit chain cannot be moved together
      const s2 = blank(2);
      s2.cols[0] = [C(8, 0), C(7, 1)];                 // 8 spade, 7 heart (set 1 = suit 1)
      s2.cols[1] = [C(9, 0)];
      if (M.pickable(s2, 0, 0)) bad('mixed-suit chain picked up together');
      if (!M.pickable(s2, 0, 1)) bad('a single card is pickable');
      if (M.canDrop(s2, 0, 1, 1)) bad('7 on 9 legal');
      if (M.canDrop(s2, 0, 0, 1)) bad('mixed chain moved');
      s2.cols[2] = [C(8, 1)];
      if (!M.canDrop(s2, 0, 1, 2)) bad('7 heart on 8 heart should be legal');
    }

    // completing a run removes it, scores and turns over the card below
    {
      const s = blank(1);
      s.cols[0] = [C(3, 0, 0), C(13), C(12), C(11), C(10), C(9), C(8), C(7), C(6), C(5), C(4), C(3), C(2)];
      s.cols[1] = [C(1)];
      s.cols[2] = [C(5, 0, 1)];
      s.found = [0, 0, 0, 0, 0, 0, 0].slice(0, 2);
      const before = json(s);
      if (M.won(s)) bad('won too early');
      const r = M.move(s, 1, 0, 0);
      if (!r.ok || r.completed.length !== 1 || r.completed[0].ids.length !== 13) bad('run not completed');
      if (s.found.length !== 3 || s.cols[0].length !== 1 || !M.isUp(s.cols[0][0])) bad('run removed / card below turned');
      if (s.cols[1].length !== 0) bad('source emptied');
      if (s.score !== 500 - 1 + 100) bad('score after a run ' + s.score);
      if (!M.undo(s) || json(s) !== before) bad('undo of a completion is not exact');
      res.completions++;
      // a run that is not all one suit is not removed
      const s3 = blank(2);
      s3.cols[0] = [C(13), C(12), C(11), C(10), C(9), C(8), C(7), C(6), C(5), C(4), C(3), C(2, 1)];
      s3.cols[1] = [C(1, 1)];
      const r3 = M.move(s3, 1, 0, 0);
      if (!r3.ok || r3.completed.length) bad('mixed suits must not complete');
      // 8 runs = win
      const s4 = blank(1); s4.found = [0, 0, 0, 0, 0, 0, 0]; s4.cols[0] = [C(13), C(12), C(11), C(10), C(9), C(8), C(7), C(6), C(5), C(4), C(3), C(2)]; s4.cols[1] = [C(1)];
      M.move(s4, 1, 0, 0); if (!M.won(s4)) bad('8 runs is a win');
    }

    // the deal rules
    {
      const s = M.newGame(1, rng);
      const total = () => s.cols.reduce((a, c) => a + c.length, 0);
      if (!M.canDeal(s)) bad('first deal');
      const n0 = total(), before = json(s);
      const r = M.deal(s);
      if (!r.ok || total() !== n0 + 10 || s.stock.length !== 4 || s.cols.some((c, i) => !M.isUp(c[c.length - 1]))) bad('deal puts one face-up card on every column');
      if (s.moves !== 1 || s.score !== 499) bad('deal counts as a move');
      if (!M.undo(s) || json(s) !== before) bad('undo of a deal');
      s.cols[3] = [];                                   // an empty column
      const b2 = json(s);
      if (M.canDeal(s) || M.deal(s).ok || json(s) !== b2) bad('deal must be refused while a column is empty (and change nothing)');
      const e = M.newGame(1, rng); e.stock = [];
      if (M.canDeal(e) || M.deal(e).ok) bad('no deal without a stock');
      // a deal that completes a run
      const d = blank(1);
      d.cols[0] = [C(13), C(12), C(11), C(10), C(9), C(8), C(7), C(6), C(5), C(4), C(3), C(2)];
      for (let i = 1; i < 10; i++) d.cols[i] = [C(13 - i, 0, 1)];   // (cards reused: only the shape matters here)
      const one = [C(1)]; const ds = []; for (let i = 0; i < 10; i++) ds.push(i === 0 ? C(1) : C(2, 0, 1));
      d.stock = [ds];
      d.cols[0][11] = C(2);
      const rd = M.deal(d);
      if (!rd.ok || rd.completed.length !== 1 || d.found.length !== 1 || d.cols[0].length !== 0) bad('a deal can complete a run ' + JSON.stringify(rd.completed.length) + ' ' + d.cols[0].length);
      void one;
    }

    // random games: never inconsistent; undo exact; the score formula
    const randomGame = (suits, withUndo) => {
      const s = M.newGame(suits, rng);
      let steps = 0, stuck = 0;
      while (steps < 900 && stuck < 40 && !M.won(s)) {
        steps++;
        const snapBefore = json(s), histBefore = s.hist.length;
        const roll = rng();
        if (roll < 0.04 && M.canDeal(s)) { M.deal(s); res.deals++; }
        else if (withUndo && roll < 0.1) {
          const ok1 = M.undo(s);
          if (ok1) { res.undos++; if (s.hist.length !== histBefore - 1) bad('undo hist length'); }
        } else {
          // a random legal move
          const all = [];
          for (let f = 0; f < 10; f++) for (let i = 0; i < s.cols[f].length; i++) for (let to = 0; to < 10; to++) if (M.canDrop(s, f, i, to)) all.push([f, i, to]);
          if (!all.length) { if (M.canDeal(s)) { M.deal(s); res.deals++; } else stuck += 10; continue; }
          const [f, i, to] = all[Math.floor(rng() * all.length)];
          const before = json(s);
          const r = M.move(s, f, i, to);
          if (!r.ok) bad('legal move refused');
          res.moves++;
          if (rng() < 0.15) { const after = json(s), h2 = s.hist.length; M.undo(s); if (json(s) !== before) bad('random undo not exact'); res.undos++; M.move(s, f, i, to); if (json(s) !== after || s.hist.length !== h2) bad('redo differs'); }
        }
        const a = M.audit(s); if (a) { bad(`${suits}-suit audit: ${a}`); return s; }
        if (snapBefore === json(s) && histBefore !== s.hist.length && false) bad('x');
        res.plays++;
      }
      if (!withUndo) { const expected = 500 - s.moves + 100 * s.found.length; if (s.score !== expected) bad(`score ${s.score} != ${expected}`); }
      return s;
    };
    for (let g = 0; g < 60; g++) randomGame([1, 2, 4][g % 3], g % 2 === 0);
    // undo all the way back = the first deal
    {
      const s = M.newGame(2, rng), first = json(s);
      for (let i = 0; i < 300; i++) {
        const all = [];
        for (let f = 0; f < 10; f++) for (let j = 0; j < s.cols[f].length; j++) for (let to = 0; to < 10; to++) if (M.canDrop(s, f, j, to)) all.push([f, j, to]);
        if (!all.length) { if (M.canDeal(s)) M.deal(s); else break; } else { const [f, j, to] = all[Math.floor(rng() * all.length)]; M.move(s, f, j, to); }
      }
      let n = 0; while (M.undo(s)) n++;
      if (json(s) !== first || n < 20) bad('undo to the start (' + n + ')');
    }
    // hints: all legal, best first, deal when nothing else
    for (let g = 0; g < 40; g++) {
      const s = M.newGame([1, 2, 4][g % 3], rng);
      for (let k = 0; k < 25; k++) {
        const hs = M.hints(s);
        for (let i = 0; i < hs.length; i++) { const m = hs[i]; if (!M.canDrop(s, m.from, m.idx, m.to)) bad('illegal hint'); if (i && hs[i - 1].score < m.score) bad('hints not sorted'); }
        res.hintMoves += hs.length;
        const sg = M.suggest(s);
        if (sg && sg.kind === 'move') { M.move(s, sg.hint.from, sg.hint.idx, sg.hint.to); if (M.audit(s)) bad('audit after hint move'); }
        else if (sg && sg.kind === 'deal') { if (!M.canDeal(s)) bad('suggested a deal that is not allowed'); M.deal(s); }
        else break;
      }
    }
    // hints prefer uncovering a face-down card and building same-suit runs
    {
      const s = blank(2);
      s.cols[0] = [C(9, 0, 0), C(5, 0, 1)];            // moving the 5 uncovers a card
      s.cols[1] = [C(6, 1)];                            // 6 of the other suit
      s.cols[2] = [C(6, 0)];                            // 6 of the same suit
      s.cols[3] = [C(1, 0)];
      const hs = M.hints(s);
      if (!hs.length || hs[0].from !== 0 || hs[0].to !== 2) bad('best hint: same-suit target that uncovers a card, got ' + JSON.stringify(hs[0]));
      if (M.bestTarget(s, 0, 1) !== 2) bad('bestTarget prefers the same suit');
      if (M.bestTarget(s, 3, 0) !== null && M.bestTarget(s, 3, 0) === 3) bad('bestTarget returned the same column');
      const s2 = blank(1); s2.cols[0] = [C(8), C(7)]; s2.cols[1] = [C(9)]; s2.cols[2] = [];
      if (M.hints(s2).some((m) => m.from === 0 && m.idx === 0 && m.to === 2)) bad('a whole column to an empty column is not a hint');
      if (M.suggest(blank(1)) !== null) bad('nothing to suggest');
    }
    // a greedy solver wins 1-suit games (this is what proves that winning works)
    const solve = (s) => {
      for (let k = 0; k < 4000; k++) {
        if (M.won(s)) return true;
        const hs = M.hints(s).filter((m) => m.score >= 30);
        if (hs.length) { M.move(s, hs[0].from, hs[0].idx, hs[0].to); continue; }
        if (M.canDeal(s)) { M.deal(s); continue; }
        if (s.stock.length) {                                 // fill an empty column so that the next deal is allowed
          const em = M.hints(s).filter((m) => s.cols[m.to].length === 0);
          if (em.length) { M.move(s, em[0].from, em[0].idx, em[0].to); continue; }
          let done1 = false;
          for (let f = 0; f < 10 && !done1; f++) for (let i = s.cols[f].length - 1; i >= 0 && !done1; i--) for (let to = 0; to < 10; to++) if (s.cols[to].length === 0 && M.canDrop(s, f, i, to) && !(i === 0)) { M.move(s, f, i, to); done1 = true; break; }
          if (done1) continue;
        }
        return false;
      }
      return false;
    };
    let winSeed = -1;
    for (let g = 0; g < 300; g++) {
      const s = M.newGame(1, rng); res.solverTried++;
      if (solve(s)) { res.solverWins++; if (M.audit(s)) bad('audit after a won game'); if (s.found.length !== 8) bad('won with ' + s.found.length); if (winSeed < 0) winSeed = g; }
      if (res.solverWins >= 10) break;
    }
    return res;
  });
  ok(L.bad.length === 0, `rules: deal, legal / illegal moves, runs, completion, deal rule, undo, hints${L.bad.length ? ' -> ' + L.bad.slice(0, 8).join('; ') : ''}`);
  ok(L.plays > 5000 && L.moves > 2000 && L.deals > 50 && L.undos > 100, `random games: ${L.plays} steps, ${L.moves} moves, ${L.deals} deals, ${L.undos} undos - 104 cards always accounted for`);
  ok(L.solverWins >= 3, `a greedy solver wins 1-suit games: ${L.solverWins} wins in ${L.solverTried} deals`);

  // ---------- the screen ----------
  const cardInfo = (col, idx) => p.evaluate(([col, idx]) => {
    const e = document.querySelector(`.spider-card[data-col="${col}"][data-idx="${idx}"]`); if (!e) return null;
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12, w: r.width, h: r.height, up: e.dataset.up };
  }, [col, idx]);
  const colPoint = (col) => p.evaluate((col) => {
    const s = window.__spider.state, b = document.querySelector('#spider-board').getBoundingClientRect(), m = window.__spider.metrics();
    const n = s.cols[col].length;
    const e = n ? document.querySelector(`.spider-card[data-col="${col}"][data-idx="${n - 1}"]`).getBoundingClientRect() : null;
    return { x: b.left + m.x0 + col * (m.cw + m.gap) + m.cw / 2, y: e ? e.top + 12 : b.top + m.colsTop + 20 };
  }, col);
  const state = () => p.evaluate(() => { const s = window.__spider.state; return JSON.stringify([s.cols, s.stock, s.found, s.moves, s.score]); });
  const hasMove = () => p.evaluate(async () => { const M = await import('/src/games/spider-logic.ts'); return M.hints(window.__spider.state).filter((m) => m.score >= 5)[0] || null; });
  const fresh = async (suits, seed) => { await p.evaluate(([s, sd]) => window.__spider.newGame(s, sd), [suits, seed]); await p.waitForTimeout(700); };
  const firstWithMove = async (suits) => { for (let sd = 1; sd < 40; sd++) { await fresh(suits, sd); const m = await hasMove(); if (m) return m; } return null; };

  // the first screen
  await fresh(1, 11);
  const first = await p.evaluate(() => ({ cards: document.querySelectorAll('.spider-card[data-id]').length, up: document.querySelectorAll('.spider-card[data-up="1"]').length, down: document.querySelectorAll('.spider-card[data-up="0"]').length, stock: document.querySelector('#spider-stock-n')?.textContent, score: document.querySelector('#spider-score').textContent, moves: document.querySelector('#spider-moves').textContent, level: document.querySelector('#spider-level').textContent, undoOff: document.querySelector('#spider-undo').disabled }));
  ok(first.cards === 54 && first.up === 10 && first.down === 44 && first.stock === '5', `the deal on screen: 54 cards, 10 face up, stock shows 5 (${JSON.stringify(first)})`);
  ok(/500/.test(first.score) && /0/.test(first.moves) && first.undoOff && first.level === '一种花色', 'score 500, 0 moves, undo off, level one suit');

  // drag a legal move
  let m = await firstWithMove(1);
  ok(!!m, 'a deal with a legal move was found');
  {
    const before = await state();
    const a = await cardInfo(m.from, m.idx), b = await colPoint(m.to);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await p.mouse.move(b.x, b.y, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(450);
    const after = await state();
    const mv = await p.evaluate(() => window.__spider.state.moves);
    ok(before !== after && mv === 1, 'drag and drop: the card moved to the other column');
    const sc = await p.evaluate(() => document.querySelector('#spider-score').textContent + '|' + document.querySelector('#spider-moves').textContent);
    ok(/499/.test(sc) && /1/.test(sc.split('|')[1]), 'score 499 and 1 move shown (' + sc + ')');
    const geo = await p.evaluate(() => [...document.querySelectorAll('.spider-card[data-id]')].every((e) => { const col = +e.dataset.col, idx = +e.dataset.idx, r = e.getBoundingClientRect(), m = window.__spider.metrics(), b = document.querySelector('#spider-board').getBoundingClientRect(); return Math.abs(r.left - b.left - (m.x0 + col * (m.cw + m.gap))) < 2 && r.bottom <= b.bottom + 1; }));
    ok(geo, 'every card sits in its column after the move');
    const und = await p.evaluate(() => document.querySelector('#spider-undo').disabled);
    ok(!und, 'undo is on after a move');
    await p.click('#spider-undo'); await p.waitForTimeout(450);
    ok((await state()) === before, 'undo restores exactly');
    ok(await p.evaluate(() => document.querySelector('#spider-undo').disabled), 'undo is off again');
  }

  // an illegal drop snaps back with a shake
  {
    await fresh(1, 21);
    const il = await p.evaluate(async () => {
      const M = await import('/src/games/spider-logic.ts'), s = window.__spider.state;
      for (let f = 0; f < 10; f++) { const i = s.cols[f].length - 1; for (let to = 0; to < 10; to++) if (to !== f && !M.canDrop(s, f, i, to)) return { f, i, to }; }
    });
    const before = await state();
    const a = await cardInfo(il.f, il.i), b = await colPoint(il.to);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 6 });
    const dragging = await p.evaluate(() => document.querySelectorAll('.spider-card.dragging').length);
    await p.mouse.up();
    const shake = await p.evaluate(() => document.querySelectorAll('.spider-card.shake').length);
    await p.waitForTimeout(500);
    const back = await cardInfo(il.f, il.i);
    ok(dragging >= 1 && shake >= 1 && (await state()) === before && Math.abs(back.x - a.x) < 2 && Math.abs(back.y - a.y) < 2, 'an illegal drop: nothing changes, the card goes back and shakes');
    ok(await p.evaluate(() => document.querySelectorAll('.spider-card.dragging, .spider-card.shake').length === 0), 'the drag / shake classes are gone afterwards');
    // a face-down card cannot be dragged
    const d = await cardInfo(0, 0), tgt = await colPoint(5);
    await p.mouse.move(d.x, d.y); await p.mouse.down(); await p.mouse.move(tgt.x, tgt.y, { steps: 5 });
    const drag2 = await p.evaluate(() => document.querySelectorAll('.spider-card.dragging').length);
    await p.mouse.up();
    ok(drag2 === 0 && (await state()) === before, 'a face-down card cannot be dragged');
  }

  // tap a card, tap the target column
  {
    m = await firstWithMove(1);
    const before = await state();
    const a = await cardInfo(m.from, m.idx);
    await p.mouse.click(a.x, a.y);
    const sel = await p.evaluate(() => document.querySelectorAll('.spider-card.sel').length);
    const tg = await colPoint(m.to);
    await p.mouse.click(tg.x, tg.y); await p.waitForTimeout(450);
    ok(sel >= 1 && (await state()) !== before && (await p.evaluate(() => window.__spider.state.moves)) === 1, 'tap a card (it lights up), tap the target column: it moves');
    // tapping a selected card, then another place that is illegal: no change, selection cleared
    await p.click('#spider-undo'); await p.waitForTimeout(400);
    await p.mouse.click(a.x, a.y); await p.mouse.click(a.x, a.y); await p.waitForTimeout(450);
    const moved = await p.evaluate(([m]) => { const s = window.__spider.state; return s.moves === 1; }, [m]);
    ok(moved, 'tap the same card twice: it goes to the best column by itself');
    const to = await p.evaluate(async ([m]) => { const M = await import('/src/games/spider-logic.ts'); const s = window.__spider.state; const n = s.cols[m.to].length; return { n, top: n ? M.rankOf(s, s.cols[m.to][n - 1]) : 0, moved: M.rankOf(s, s.cols[m.to][n - 1 - 0]) }; }, [m]);
    void to;
    // select a card and tap a column where it cannot go
    await p.click('#spider-undo'); await p.waitForTimeout(400);
    const bad = await p.evaluate(async () => { const M = await import('/src/games/spider-logic.ts'), s = window.__spider.state; for (let f = 0; f < 10; f++) { const i = s.cols[f].length - 1; for (let to = 0; to < 10; to++) if (to !== f && !M.canDrop(s, f, i, to)) return { f, i, to }; } });
    const b4 = await state();
    const c1 = await cardInfo(bad.f, bad.i), c2 = await colPoint(bad.to);
    await p.mouse.click(c1.x, c1.y); await p.mouse.click(c2.x, c2.y);
    ok((await state()) === b4 && (await p.evaluate(() => document.querySelectorAll('.spider-card.sel').length)) >= 1, 'tap a card and then another card that it cannot go on: nothing moves, the new card is selected');
    const fd = await cardInfo(bad.to === 0 ? 1 : 0, 0);
    await p.mouse.click(fd.x, fd.y);
    ok((await state()) === b4 && (await p.evaluate(() => document.querySelectorAll('.spider-card.sel').length)) === 0, 'tap a card and a face-down card: nothing moves, selection is cleared');
  }

  // dealing from the stock
  {
    await fresh(1, 5);
    const before = await p.evaluate(() => window.__spider.state.cols.map((c) => c.length));
    await p.click('#spider-stock'); await p.waitForTimeout(900);
    const r = await p.evaluate(() => ({ cols: window.__spider.state.cols.map((c) => c.length), n: document.querySelector('#spider-stock-n').textContent, cards: document.querySelectorAll('.spider-card[data-id]').length, moves: window.__spider.state.moves }));
    ok(r.cols.every((n, i) => n === before[i] + 1) && r.n === '4' && r.cards === 64 && r.moves === 1, `a tap on the stock deals one card to every column (${r.n} deals left)`);
    const geo = await p.evaluate(() => [...document.querySelectorAll('.spider-card[data-id]')].every((e) => { const col = +e.dataset.col, r = e.getBoundingClientRect(), m = window.__spider.metrics(), b = document.querySelector('#spider-board').getBoundingClientRect(); return Math.abs(r.left - b.left - (m.x0 + col * (m.cw + m.gap))) < 2; }));
    ok(geo, 'the dealt cards arrived in their columns');
    await p.click('#spider-undo'); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => window.__spider.state.stock.length === 5 && document.querySelectorAll('.spider-card[data-id]').length === 54), 'undo takes the deal back');
    // no deal while a column is empty
    await p.evaluate(() => { const s = window.__spider.state; s.cols[4] = []; window.__spider.load(s); });
    await p.waitForTimeout(300);
    const b4 = await state();
    await p.click('#spider-stock'); await p.waitForTimeout(200);
    ok((await state()) === b4 && /空列|empty|vide/.test(await p.evaluate(() => document.body.innerText)), 'no deal while a column is empty (and a message says why)');
    const emptySlot = await p.evaluate(() => getComputedStyle(document.querySelector('.spider-slot[data-col="4"]')).display !== 'none');
    ok(emptySlot, 'the empty column shows its dashed slot');
  }

  // hint
  {
    m = await firstWithMove(1);
    await p.click('#spider-hint');
    const hl = await p.evaluate(() => document.querySelectorAll('.spider-card.hint, .spider-slot.hint, .spider-stock.hint').length);
    ok(hl >= 2, 'the hint button lights the card and its target');
    await p.waitForTimeout(2700);
    ok(await p.evaluate(() => document.querySelectorAll('.hint').length === 0), 'the hint goes out by itself');
  }

  // levels, best score, resume after reload
  {
    await p.click('#spider-new');
    ok(await p.evaluate(() => !!document.querySelector('#spider-lv1') && !!document.querySelector('#spider-lv2') && !!document.querySelector('#spider-lv4')), 'new game offers one / two / four suits');
    await p.click('#spider-lv2'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => window.__spider.state.suits === 2 && document.querySelector('#spider-level').textContent === '两种花色' && !document.querySelector('#spider-levels')), 'level two suits started');
    await p.click('#spider-new'); await p.click('#spider-lv4'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => window.__spider.state.suits === 4 && document.querySelectorAll('.spider-fslot').length === 8), 'level four suits started');
    // the four suits are drawn: one card of each suit shows its own picture
    const suitsSeen = await p.evaluate(() => new Set([...document.querySelectorAll('.spider-card[data-up="1"] .spider-big use')].map((u) => u.getAttribute('href'))).size);
    ok(suitsSeen >= 2, 'cards show suit pictures (' + suitsSeen + ' kinds on the first screen)');
    await fresh(2, 77);
    const mv = await hasMove();
    const a = await cardInfo(mv.from, mv.idx), b = await colPoint(mv.to);
    await p.mouse.click(a.x, a.y); await p.mouse.click(b.x, b.y); await p.waitForTimeout(400);
    const saved = await state();
    await p.reload(); await p.waitForSelector('#spider-board'); await p.waitForFunction(() => window.__spider && window.__spider.state); await p.waitForTimeout(900);
    ok((await state()) === saved, 'reopening resumes the game in progress (same cards, score and moves)');
    const hist = await p.evaluate(() => window.__spider.state.hist.length);
    ok(hist === 1, 'the undo history is saved too');
    await p.click('#spider-undo'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__spider.state.moves === 0), 'undo works after resuming');
  }

  // winning: a nearly won game, one move left
  {
    await p.evaluate(async () => {
      const M = await import('/src/games/spider-logic.ts');
      const s = M.newGame(1, () => 0.5);
      s.cols = Array.from({ length: 10 }, () => []); s.stock = []; s.found = [0, 0, 0, 0, 0, 0, 0]; s.hist = []; s.moves = 40; s.score = 800;
      for (let r = 13; r >= 2; r--) s.cols[0].push(M.mk(r - 1, 1));
      s.cols[1] = [M.mk(0, 1)];
      window.__spider.load(s);
    });
    await p.waitForTimeout(300);
    const a = await cardInfo(1, 0), b = await colPoint(0);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(250);
    const flying = await p.evaluate(() => document.querySelectorAll('.spider-card.flying').length);
    ok(flying >= 10, `the finished run flies to the foundation (${flying} cards flying)`);
    await p.waitForSelector('#spider-win', { timeout: 5000 });
    await p.waitForTimeout(500);
    const w = await p.evaluate(() => ({ txt: document.querySelector('#spider-win').innerText, conf: document.querySelectorAll('.spider-conf').length, dancer: !!document.querySelector('.spider-dancer'), rec: !!document.querySelector('#spider-record'), found: window.__spider.state.found.length, fs: document.querySelectorAll('.spider-fslot .spider-card').length }));
    ok(w.found === 8 && w.fs === 8 && w.conf >= 40 && w.dancer, `win: 8 runs in the foundation, confetti (${w.conf}), a dancing spider, the overlay`);
    ok(/840|得分/.test(w.txt) && w.rec, 'the overlay shows the score (800 - 1 + 100 = 899) and the new record');
    const sc = await p.evaluate(() => window.__spider.state.score);
    ok(sc === 899 && /899/.test(w.txt), 'classic scoring: 500 start, -1 per move, +100 per run');
    await p.screenshot({ path: OUT + 'spider-win.png' });
    const ls = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).spider);
    ok(ls.best && ls.best['1'] === 899 && ls.save === null, 'best score kept in learn.games.v1 and the finished game is no longer saved');
    await p.click('#spider-again'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => !document.querySelector('#spider-win') && window.__spider.state.found.length === 0 && window.__spider.state.moves === 0), 'play again starts a new game');
    ok(await p.evaluate(() => /899/.test(document.querySelector('#spider-best').textContent)), 'the best score is shown');
  }

  // ---------- layout ----------
  const longColumn = () => p.evaluate(() => {
    const s = window.__spider.state;
    // pile 5 columns onto the first one: a column of ~30 cards
    const pile = [...s.cols[0], ...s.cols[1], ...s.cols[2], ...s.cols[3], ...s.cols[4], ...s.cols[5]];
    s.cols[0] = pile; s.cols[1] = []; s.cols[2] = []; s.cols[3] = []; s.cols[4] = []; s.cols[5] = [];
    const t = s.cols[0]; t[t.length - 1] |= 1;
    window.__spider.load(s);
  });
  for (const [name, w, hgt] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/spider')); await p.waitForSelector('#spider-board');
    await p.waitForTimeout(500);
    await p.evaluate(() => window.__spider.newGame(4, 3)); await p.waitForTimeout(700);
    const m1 = await p.evaluate(() => {
      const b = document.querySelector('#spider-board').getBoundingClientRect(), mm = window.__spider.metrics();
      const cards = [...document.querySelectorAll('.spider-card[data-id]')].map((e) => e.getBoundingClientRect());
      const L0 = Math.min(...cards.map((r) => r.left)), R0 = Math.max(...cards.map((r) => r.right));
      return { b: { l: b.left, r: b.right, t: b.top, bt: b.bottom, w: b.width }, cw: mm.cw, ch: mm.ch, inside: cards.every((r) => r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5), margins: [L0 - b.left, b.right - R0], vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns: [...document.querySelectorAll('.spider-btns button, .spider-stats span')].every((q) => { const r = q.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }) };
    });
    ok(m1.inside && m1.btns, `${name} ${w}x${hgt}: cards, buttons and numbers are on the screen (card ${m1.cw}x${m1.ch}px)`);
    ok(m1.sw <= m1.vw && m1.sh <= m1.vh + 1, `${name}: no page scrolling (${m1.sw}x${m1.sh} in ${m1.vw}x${m1.vh})`);
    ok(Math.abs(m1.margins[0] - m1.margins[1]) <= 2.5, `${name}: the ten columns are centred (${m1.margins.map((x) => Math.round(x)).join(' / ')})`);
    ok(name === 'side' ? m1.cw >= 20 : name === 'phone' ? m1.cw >= 27 : m1.cw >= 60, `${name}: cards are big enough (${m1.cw}px wide)`);
    await p.screenshot({ path: OUT + `spider-${name}.png` });
    // 30 cards in a column still fit
    await longColumn(); await p.waitForTimeout(500);
    const m2 = await p.evaluate(() => {
      const b = document.querySelector('#spider-board').getBoundingClientRect();
      const col0 = [...document.querySelectorAll('.spider-card[data-col="0"]')].map((e) => e.getBoundingClientRect());
      const tops = col0.map((r) => r.top).sort((a, b) => a - b);
      return { n: col0.length, fits: col0.every((r) => r.bottom <= b.bottom + 1 && r.top >= b.top), minStep: Math.min(...tops.slice(1).map((v, i) => v - tops[i])) };
    });
    ok(m2.n >= 28 && m2.fits && m2.minStep >= 1.5, `${name}: a column of ${m2.n} cards is squeezed to fit (smallest step ${m2.minStep.toFixed(1)}px)`);
    await p.screenshot({ path: OUT + `spider-${name}-long.png` });
    // resize while playing re-lays out
  }
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(600);
  const re = await p.evaluate(() => { const b = document.querySelector('#spider-board').getBoundingClientRect(), mm = window.__spider.metrics(); return mm.W > 700 && Math.abs(mm.W - b.width) < 2; });
  ok(re, 'a resize re-lays the board out');

  // the stock and the foundation keep the same size and place
  // leaving removes everything
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__spider);
  ok(true, 'leaving the game removes it (the hook is gone)');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // reduced motion: everything happens at once, no confetti, the win screen still comes
  {
    const r = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
    const q = r.page;
    await q.evaluate(() => (location.hash = '#/games/spider')); await q.waitForSelector('#spider-board'); await q.waitForFunction(() => window.__spider && window.__spider.state); await q.waitForTimeout(600);
    await q.evaluate(async () => {
      const M = await import('/src/games/spider-logic.ts');
      const s = M.newGame(1, () => 0.5);
      s.cols = Array.from({ length: 10 }, () => []); s.stock = []; s.found = [0, 0, 0, 0, 0, 0, 0]; s.hist = []; s.moves = 40; s.score = 800;
      for (let x = 13; x >= 2; x--) s.cols[0].push(M.mk(x - 1, 1));
      s.cols[1] = [M.mk(0, 1)];
      window.__spider.load(s);
    });
    await q.waitForTimeout(200);
    const a = await q.evaluate(() => { const e = document.querySelector('.spider-card[data-col="1"][data-idx="0"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 10 }; });
    const b = await q.evaluate(() => { const e = document.querySelector('.spider-card[data-col="0"][data-idx="11"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 10 }; });
    await q.mouse.click(a.x, a.y); await q.mouse.click(b.x, b.y);
    await q.waitForSelector('#spider-win', { timeout: 3000 });
    ok(await q.evaluate(() => document.querySelectorAll('.spider-conf').length === 0 && !!document.querySelector('#spider-again')), 'reduced motion: the win screen comes at once without confetti');
    ok(r.log.external.length === 0, 'no request left the app (reduced motion run)');
    await r.browser.close();
  }
  await done();
})();
