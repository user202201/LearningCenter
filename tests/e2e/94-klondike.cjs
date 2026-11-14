// 经典纸牌 (Klondike): the pure rules against an independent reference (random games), the solver on every shipped solvable deal, the scores, and the screen
// (deal, draw 1 / 3, tap moves, drag with the mouse and with REAL touch events through CDP at dpr 2, undo, hint, new / replay, auto-complete, win overlay and win animation,
// layout on 5 screens, EN / FR, no outside request).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[㐀-鿿＀-￯　-〿]/;

/** helpers put into the page: window.__t.mk(spec) builds a full valid position from a short description */
const HELP = `(async () => {
  const L = await import('/src/games/klondike-logic.ts');
  const R = 'A23456789TJQK', S = 'CDHS';
  const card = (n) => R.indexOf(n[0]) * 4 + S.indexOf(n[1]);
  // spec: tab = 7 arrays of card names (bottom to top), down = 7 numbers, waste = names, found = [C, D, H, S] counts, draw = 1 | 3; every other card goes to the stock
  const mk = (spec) => {
    const tab = (spec.tab || []).map((p) => p.map(card)); while (tab.length < 7) tab.push([]);
    const down = (spec.down || []).slice(); while (down.length < 7) down.push(0);
    const waste = (spec.waste || []).map(card), found = spec.found || [0, 0, 0, 0];
    const used = new Set([...tab.flat(), ...waste]);
    for (let su = 0; su < 4; su++) for (let r = 0; r < found[su]; r++) used.add(r * 4 + su);
    const stock = []; for (let c = 0; c < 52; c++) if (!used.has(c)) stock.push(c);
    const st = { tab, down, stock: (spec.stock ? spec.stock.map(card) : stock), waste, found, draw: spec.draw || 1, recycles: 0, score: spec.score || 0, moves: 0, fan: waste.length ? 1 : 0 };
    return st;
  };
  window.__t = { L, card, mk };
})()`;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/klondike')); await p.waitForSelector('#kl-board');
  await p.evaluate(HELP);

  // ======================= 1. the rules, against an independent reference =======================
  const R1 = await p.evaluate(async () => {
    const L = window.__t.L;
    const res = { bad: [], games: 0, moves: 0, listed: 0, illegalTried: 0, wins: 0, flips: 0, found: 0, recycles: 0, draws3: 0 };
    let sd = 99991; const rng = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const rank = (c) => Math.floor(c / 4), suit = (c) => c % 4, red = (c) => suit(c) === 1 || suit(c) === 2;
    // ---- an independent check that a position is valid
    const valid = (s, tag) => {
      const seen = new Array(52).fill(0);
      for (let i = 0; i < 7; i++) {
        const p = s.tab[i];
        if (p.length && s.down[i] >= p.length) res.bad.push(tag + ' top face down pile ' + i);
        for (let k = 0; k < p.length; k++) {
          seen[p[k]]++;
          if (k > s.down[i]) { const a = p[k - 1], b = p[k]; if (!(rank(a) === rank(b) + 1 && red(a) !== red(b))) res.bad.push(tag + ' run broken pile ' + i); }
        }
      }
      s.stock.forEach((c) => seen[c]++); s.waste.forEach((c) => seen[c]++);
      for (let su = 0; su < 4; su++) for (let r = 0; r < s.found[su]; r++) seen[r * 4 + su]++;
      if (seen.some((n) => n !== 1)) res.bad.push(tag + ' cards not conserved');
      if (s.score < 0) res.bad.push(tag + ' negative score');
    };
    // ---- the reference: every legal move written from the rules of the game, as strings
    const ref = (s) => {
      const out = new Set();
      if (s.stock.length || s.waste.length) out.add('D');
      const srcs = [];
      if (s.waste.length) srcs.push({ f: 'W', cards: [s.waste[s.waste.length - 1]] });
      for (let i = 0; i < 7; i++) { const p = s.tab[i]; for (let n = 1; n <= p.length - s.down[i]; n++) srcs.push({ f: 'T' + i, n, cards: p.slice(p.length - n) }); }
      for (let su = 0; su < 4; su++) if (s.found[su]) srcs.push({ f: 'F' + su, cards: [(s.found[su] - 1) * 4 + su] });
      for (const sr of srcs) {
        const n = sr.cards.length, first = sr.cards[0];
        for (let j = 0; j < 7; j++) {
          if (sr.f === 'T' + j) continue;
          const dest = s.tab[j];
          if (dest.length === 0 ? rank(first) === 12 : (rank(dest[dest.length - 1]) === rank(first) + 1 && red(dest[dest.length - 1]) !== red(first))) out.add(sr.f + '>T' + j + 'x' + n);
        }
        if (n === 1 && !sr.f.startsWith('F') && s.found[suit(first)] === rank(first)) out.add(sr.f + '>F' + suit(first) + 'x1');
      }
      return out;
    };
    const keyOf = (m) => {
      if (m.k === 'draw') return 'D';
      const f = m.from.t === 'waste' ? 'W' : (m.from.t === 'tab' ? 'T' : 'F') + m.from.i;
      const to = (m.to.t === 'tab' ? 'T' : 'F') + m.to.i;
      return f + '>' + to + 'x' + m.n;
    };
    const parseKey = (k) => {
      if (k === 'D') return { k: 'draw' };
      const [a, b] = k.split('>'); const [to, n] = b.split('x');
      const loc = (x) => x === 'W' ? { t: 'waste' } : { t: x[0] === 'T' ? 'tab' : 'found', i: Number(x.slice(1)) };
      return { k: 'move', from: loc(a), to: loc(to), n: Number(n) };
    };
    // ---- the score of a move, from the rules of Windows scoring
    const refScore = (s, m, ns) => {
      if (m.k === 'draw') { if (s.stock.length) return 0; return s.draw === 1 ? -100 : (s.recycles + 1 >= 3 ? -20 : 0); }
      let d = 0;
      if (m.from.t === 'waste') d += m.to.t === 'found' ? 10 : 5;
      if (m.from.t === 'found') d -= 15;
      if (m.from.t === 'tab') {
        if (m.to.t === 'found') d += 10;
        const left = s.tab[m.from.i].length - m.n;
        if (left > 0 && s.down[m.from.i] === left) d += 5;
      }
      return d;
    };
    for (let g = 0; g < 260; g++) {
      const draw = g % 2 ? 3 : 1;
      let s = L.deal(1 + Math.floor(rng() * 1e9), draw); res.games++;
      valid(s, 'deal');
      if (s.stock.length !== 24 || s.tab.some((p, i) => p.length !== i + 1) || s.down.some((d, i) => d !== i)) res.bad.push('deal shape');
      for (let i = 0; i < 700 && !L.isWon(s); i++) {
        const listed = L.legalMoves(s).map(keyOf), want = ref(s);
        res.listed += listed.length;
        if (new Set(listed).size !== listed.length) res.bad.push('duplicate move listed');
        if (listed.length !== want.size || listed.some((k) => !want.has(k))) { res.bad.push('move lists differ (listed ' + listed.length + ', reference ' + want.size + ') g' + g + ' i' + i + ' missing: ' + [...want].filter((k) => !listed.includes(k)).slice(0, 3) + ' extra: ' + listed.filter((k) => !want.has(k)).slice(0, 3)); break; }
        // every listed move is accepted, an unlisted random one is refused
        for (let q = 0; q < 3; q++) {
          const from = [{ t: 'waste' }, { t: 'tab', i: Math.floor(rng() * 7) }, { t: 'found', i: Math.floor(rng() * 4) }][Math.floor(rng() * 3)];
          const to = rng() < 0.5 ? { t: 'tab', i: Math.floor(rng() * 7) } : { t: 'found', i: Math.floor(rng() * 4) };
          const m = { k: 'move', from, to, n: 1 + Math.floor(rng() * 4) };
          if (!want.has(keyOf(m))) { res.illegalTried++; const before = JSON.stringify(s); if (L.apply(s, m) !== null || JSON.stringify(s) !== before) res.bad.push('illegal move accepted or state changed ' + keyOf(m)); }
        }
        // pick: prefer foundation / reveal sometimes so that the games go far
        const arr = [...want]; let pick;
        const ups = arr.filter((k) => k.includes('>F')); const drawsOnly = arr.length === 1 && arr[0] === 'D';
        if (ups.length && rng() < 0.6) pick = ups[Math.floor(rng() * ups.length)];
        else if (!drawsOnly && rng() < 0.8) { const nd = arr.filter((k) => k !== 'D'); pick = nd[Math.floor(rng() * nd.length)]; }
        else pick = arr[Math.floor(rng() * arr.length)];
        const m = parseKey(pick);
        const before = JSON.stringify(s), flipsBefore = s.down.reduce((a, b) => a + b, 0);
        const ns = L.apply(s, m);
        if (!ns) { res.bad.push('listed move refused ' + pick); break; }
        if (JSON.stringify(s) !== before) { res.bad.push('apply changed its input'); break; }
        const exp = Math.max(0, s.score + refScore(s, m, ns));
        if (ns.score !== exp) { res.bad.push('score ' + ns.score + ' != ' + exp + ' for ' + pick + ' (recycles ' + s.recycles + ', draw ' + s.draw + ')'); break; }
        if (ns.moves !== s.moves + 1) res.bad.push('move counter');
        if (m.k === 'draw') {
          if (s.stock.length) { const n = Math.min(draw, s.stock.length); if (ns.waste.length !== s.waste.length + n || ns.stock.length !== s.stock.length - n) res.bad.push('draw count'); if (draw === 3 && n === 3) res.draws3++; }
          else { if (ns.stock.length !== s.waste.length || ns.waste.length !== 0 || ns.recycles !== s.recycles + 1) res.bad.push('recycle'); else res.recycles++; if (ns.stock.join() !== s.waste.slice().reverse().join()) res.bad.push('recycle order'); }
        }
        if (s.down.reduce((a, b) => a + b, 0) !== ns.down.reduce((a, b) => a + b, 0) + 0 && s.down.reduce((a, b) => a + b, 0) - ns.down.reduce((a, b) => a + b, 0) !== 1) res.bad.push('flips more than one card');
        if (flipsBefore > ns.down.reduce((a, b) => a + b, 0)) res.flips++;
        if (pick.includes('>F')) res.found++;
        valid(ns, 'g' + g + 'i' + i);
        s = ns; res.moves++;
        if (res.bad.length > 5) break;
      }
      if (L.isWon(s)) res.wins++;
      if (res.bad.length > 5) break;
    }
    return res;
  });
  ok(R1.bad.length === 0, `rules: ${R1.games} random games, ${R1.moves} moves, ${R1.listed} listed moves = the reference's, ${R1.illegalTried} illegal moves refused, scores as Windows${R1.bad.length ? ' -> ' + R1.bad.slice(0, 4).join('; ') : ''}`);
  ok(R1.flips > 300 && R1.found > 300 && R1.recycles > 30 && R1.draws3 > 300, `the random games really turned cards (${R1.flips}), built foundations (${R1.found}), recycled (${R1.recycles}) and drew threes (${R1.draws3})`);

  // ---- hand-made scenarios: scores, floor, recycle penalty, kings, runs, foundation back
  const R2 = await p.evaluate(async () => {
    const { L, mk } = window.__t; const res = [];
    const mv = (s, from, to, n = 1) => L.apply(s, { k: 'move', from, to, n });
    const T = (i) => ({ t: 'tab', i }), F = (i) => ({ t: 'found', i }), W = { t: 'waste' };
    // waste -> tableau +5, waste -> foundation +10, tableau -> foundation +10, turning a card +5, foundation -> tableau -15
    let s = mk({ tab: [['KS', '8D'], ['9C'], ['AH'], ['3S', '2H'], [], [], []], down: [1], waste: ['7C', 'AC'], found: [0, 0, 0, 0] });
    let a = mv(s, W, F(0)); res.push(['w2f', a && a.score === 10]);
    a = mv(a, T(2), F(2)); res.push(['t2f', a && a.score === 20]);
    let b = mv(s, T(0), T(1)); res.push(['t2t turn', b && b.score === 5 && b.down[0] === 0 && b.tab[1].length === 2]);
    s = mk({ tab: [['9C'], ['8D'], [], [], [], [], []], waste: ['7C'], found: [0, 0, 0, 0] });
    s = mv(s, T(0), T(2)); res.push(['K only on empty (9C refused)', s === null]);
    s = mk({ tab: [['9C'], ['8D'], [], [], [], [], []], waste: ['7C'], found: [0, 0, 0, 0] });
    a = mv(s, T(1), T(0)); res.push(['red 8 on black 9', !!a]);
    a = a && mv(a, W, T(1)); res.push(['7C on empty refused', a === null]);
    s = mk({ tab: [['9C'], ['8D'], ['8H'], [], [], [], []], waste: ['7C'], found: [0, 0, 0, 0] });
    a = mv(s, W, T(1)); res.push(['black 7 on red 8: +5', a && a.score === 5]);
    s = mk({ tab: [['8H', '7C'], [], [], [], [], [], []], found: [0, 0, 0, 0], score: 40, waste: ['AC'], stock: [] });
    a = mv(mk({ tab: [[], [], [], [], [], [], []], waste: ['5S'], found: [13, 13, 12, 4], stock: ['KH'], score: 0 }), W, T(0)); res.push(['5S on empty refused', a === null]);
    // foundation back to the tableau: -15 and the floor of 0
    s = mk({ tab: [['9S'], [], [], [], [], [], []], found: [0, 1, 0, 0], waste: [], score: 100 });
    a = mv(s, F(1), T(0)); res.push(['AD on 9S refused', a === null]);
    s = mk({ tab: [['3C'], [], [], [], [], [], []], found: [0, 2, 0, 0], waste: [], score: 100 });
    a = mv(s, F(1), T(0)); res.push(['2D back on 3C: -15, found -1', a && a.score === 85 && a.found[1] === 1 && a.tab[0].length === 2]);
    s = mk({ tab: [['3C'], [], [], [], [], [], []], found: [0, 2, 0, 0], waste: [], score: 5 });
    a = mv(s, F(1), T(0)); res.push(['score never below 0', a && a.score === 0]);
    // recycling: draw 1 costs 100 each time, draw 3 only from the third time on, 20 each
    s = mk({ tab: [[], [], [], [], [], [], []], found: [13, 13, 13, 11], waste: ['QS'], stock: [], draw: 1, score: 250 });
    a = L.apply(s, { k: 'draw' }); res.push(['draw 1 recycle -100', a && a.score === 150 && a.recycles === 1 && a.stock.length === 1 && a.waste.length === 0]);
    a = L.apply(L.apply(a, { k: 'draw' }), { k: 'draw' }); res.push(['draw 1 second pass recycles again -100', a && a.score === 50 && a.recycles === 2]);
    let d3 = mk({ tab: [[], [], [], [], [], [], []], found: [13, 13, 13, 8], waste: ['9S', 'TS', 'JS', 'QS', 'KS'], stock: [], draw: 3, score: 100 });
    d3 = L.apply(d3, { k: 'draw' }); res.push(['draw 3 first recycle free', d3.score === 100 && d3.recycles === 1]);
    d3 = L.apply(d3, { k: 'draw' }); d3 = L.apply(d3, { k: 'draw' });
    d3 = L.apply(d3, { k: 'draw' }); res.push(['draw 3: the second recycle is free too', d3.recycles === 2 && d3.score === 100]);
    d3 = L.apply(L.apply(d3, { k: 'draw' }), { k: 'draw' }); d3 = L.apply(d3, { k: 'draw' }); res.push(['draw 3: from the third recycle -20 each', d3.recycles === 3 && d3.score === 80]);
    // draw 3 order: the three just drawn, the last on top; the fan; only the top is playable
    s = mk({ tab: [[], [], [], [], [], [], []], found: [0, 0, 0, 0], waste: [], stock: ['2C', '3C', '4C', '5C'], draw: 3 });
    a = L.apply(s, { k: 'draw' }); res.push(['draw 3 takes from the top of the stock', a.waste.join() === [s.stock[3], s.stock[2], s.stock[1]].join() && a.fan === 3 && a.stock.length === 1]);
    a = L.apply(a, { k: 'draw' }); res.push(['a short last draw', a.waste.length === 4 && a.fan === 1]);
    // legality of foundation order and suits
    s = mk({ tab: [['2H'], [], [], [], [], [], []], found: [0, 0, 0, 0], waste: ['AH'], stock: [] });
    res.push(['2H cannot go before AH', mv(s, T(0), F(2)) === null]);
    a = mv(s, W, F(2)); res.push(['AH goes up', !!a && mv(a, T(0), F(2)) !== null]);
    res.push(['AH not on the wrong suit', mv(s, W, F(1)) === null]);
    // runs move together; a run bigger than the face-up cards is refused; face-down cards are never movable
    s = mk({ tab: [['5S', 'KH', 'QC', 'JD'], ['KS'], [], [], [], [], []], down: [1] });
    res.push(['a face-down card cannot move', mv(s, T(0), T(2), 4) === null && mv(s, T(0), T(2), 1) === null]);
    a = mv(s, T(0), T(2), 3); res.push(['a King run moves to an empty pile together', !!a && a.tab[2].length === 3 && a.tab[0].length === 1 && a.down[0] === 0 && a.score === 5]);
    // pointless king moves are flagged but legal
    res.push(['K at the bottom of its pile: legal but pointless', !!mv(mk({ tab: [['KS'], [], [], [], [], [], []] }), T(0), T(1)) && L.isPointless(mk({ tab: [['KS'], [], [], [], [], [], []] }), { k: 'move', from: T(0), to: T(1), n: 1 })]);
    // the time bonus
    res.push(['time bonus', L.timeBonus(20000) === 0 && L.timeBonus(30000) === 0 && L.timeBonus(60000) === 11666 && L.timeBonus(700000) === 1000]);
    // won
    s = mk({ tab: [[], [], [], [], [], [], []], found: [13, 13, 13, 12], waste: ['KS'], stock: [] });
    a = mv(s, W, F(3)); res.push(['winning move wins', !!a && L.isWon(a) && !L.isWon(s)]);
    return res;
  });
  for (const [name, good] of R2) ok(good, 'scenario: ' + name);

  // ---- tap move rules and the hint priority
  const R3 = await p.evaluate(async () => {
    const { L, mk } = window.__t; const res = [];
    const T = (i) => ({ t: 'tab', i });
    // a tap prefers the foundation, then a pile with cards, then an empty pile (a King only)
    let s = mk({ tab: [['AS'], ['2H', ], ['3C'], [], [], [], []], found: [0, 0, 0, 0] });
    let m = L.tapMove(s, T(0), 1); res.push(['tap an Ace: foundation', m && m.to.t === 'found' && m.to.i === 3]);
    m = L.tapMove(s, T(1), 1); res.push(['tap 2H: onto 3C', m && m.to.t === 'tab' && m.to.i === 2]);
    s = mk({ tab: [['KS'], [], ['KH', 'QS'], [], [], [], []], down: [0, 0, 1] }); m = L.tapMove(mk({ tab: [['9S', 'KS'], [], [], [], [], [], []], down: [1] }), T(0), 1);
    res.push(['tap a King with a face-down card under it: first empty pile', m && m.to.t === 'tab' && m.to.i === 1]);
    m = L.tapMove(mk({ tab: [['KS'], [], [], [], [], [], []] }), T(0), 1); res.push(['tap a lone King: nothing to gain', m === null]);
    // the hint order
    const kind = (sp) => { const h = L.hint(mk(sp)); return h ? h.kind : null; };
    res.push(['hint: reveal before foundation', kind({ tab: [['9D', '8C'], ['AS'], ['9H'], [], [], [], []], down: [1], found: [0, 0, 0, 0] }) === 'reveal']);
    res.push(['hint: foundation next', kind({ tab: [['AS'], ['9S'], [], [], [], [], []], found: [0, 0, 0, 0] }) === 'found']);
    res.push(['hint: empty a pile', kind({ tab: [['8C'], ['9D'], [], [], [], [], []], found: [0, 0, 0, 0], stock: [] }) === 'space']);
    res.push(['hint: a waste card onto a pile', kind({ tab: [['9D'], [], [], [], [], [], []], waste: ['8C'], found: [0, 0, 0, 0], stock: [] }) === 'tab']);
    res.push(['hint: the stock when the waste has no use', kind({ tab: [['9D'], [], [], [], [], [], []], waste: ['5C'], stock: ['8S'], found: [0, 0, 0, 0] }) === 'draw']);
    res.push(['hint: nothing when stuck', kind({ tab: [['9D'], ['7H'], [], [], [], [], []], waste: ['5C'], stock: [], found: [0, 0, 0, 0] }) === null]);
    res.push(['hint: recycle the waste when its first card helps', kind({ tab: [['9D']], waste: ['8S', '5C'], stock: [] }) === 'recycle']);
    res.push(['hint: nothing when stuck (a real dead end)', (() => { const x = L.deal(5, 1); x.stock = []; x.waste = []; x.tab = x.tab.map(() => []); return L.hint(x) === null; })()]);
    // auto plan
    const near = mk({ tab: [['KS', 'QH', 'JS'], ['KD', 'QC', 'JD'], ['KH', 'QS', 'JH'], ['KC', 'QD', 'JC'], [], [], []], found: [10, 10, 10, 10], waste: [], stock: [] });
    const plan = L.autoPlan(near); let e = near; if (plan) for (const mm of plan) e = L.apply(e, mm);
    res.push(['autoPlan finishes a trivial position', !!plan && L.isWon(e) && plan.every((mm) => mm.k === 'move' && mm.to.t === 'found')]);
    res.push(['no autoPlan with a face-down card', L.autoPlan(mk({ tab: [['KS', 'QH'], [], [], [], [], [], []], down: [1], found: [0, 0, 0, 0] })) === null]);
    // with the last cards in the stock the plan draws them
    const drawn = mk({ tab: [['KS', 'QH'], ['KD', 'QC'], ['KH', 'QS'], ['KC', 'QD'], [], [], []], found: [10, 10, 10, 10], stock: ['JS', 'JD', 'JH', 'JC'], waste: [] });
    const p2 = L.autoPlan(drawn); let e2 = drawn; if (p2) for (const mm of p2) e2 = L.apply(e2, mm);
    res.push(['autoPlan draws from the stock when needed', !!p2 && L.isWon(e2) && p2.some((mm) => mm.k === 'draw')]);
    return res;
  });
  for (const [name, good] of R3) ok(good, 'scenario: ' + name);

  // ---- the solver finds a win for every shipped solvable deal (and replaying its moves in the engine ends in a win)
  const seeds = JSON.parse(fs.readFileSync('src/games/klondike-seeds.json', 'utf8'));
  ok(seeds['1'].length >= 100 && seeds['3'].length >= 100 && new Set(seeds['1']).size === seeds['1'].length && new Set(seeds['3']).size === seeds['3'].length, `the seed file holds ${seeds['1'].length} deals for draw 1 and ${seeds['3'].length} for draw 3, all different`);
  let solved = 0, badSolve = [];
  for (const draw of ['1', '3']) {
    for (let k = 0; k < seeds[draw].length; k += 25) {
      const r = await p.evaluate(async ({ list, draw }) => {
        const S = await import('/src/games/klondike-solver.ts'); const L = window.__t.L; const out = { ok: 0, bad: [] };
        for (const sd of list) {
          const s0 = L.deal(sd, Number(draw)); const r = S.solve(s0, 30000);
          if (!r.moves) { out.bad.push(sd + ': no solution'); continue; }
          // replay by hand, not with the solver's own helper
          let s = s0, good = true;
          for (const m of r.moves) { const n = L.apply(s, m); if (!n) { good = false; break; } s = n; }
          if (good && L.isWon(s) && JSON.stringify(s0) === JSON.stringify(L.deal(sd, Number(draw)))) out.ok++; else out.bad.push(sd + ': replay does not win');
        }
        return out;
      }, { list: seeds[draw].slice(k, k + 25), draw });
      solved += r.ok; badSolve.push(...r.bad);
    }
  }
  ok(badSolve.length === 0 && solved === seeds['1'].length + seeds['3'].length, `the solver wins all ${solved} shipped solvable deals and every solution replays to a win in the engine${badSolve.length ? ' -> ' + badSolve.slice(0, 3).join('; ') : ''}`);
  // the solver can say no: a dead position has no solution
  const dead = await p.evaluate(async () => { const S = await import('/src/games/klondike-solver.ts'); const { L, mk } = window.__t;
    const s = mk({ tab: [['9D'], ['7H'], ['5C'], [], [], [], []], found: [0, 0, 0, 0], waste: [], stock: [] }); s.stock = []; // cards missing = impossible to win anyway
    const x = L.deal(7, 1); x.tab = x.tab.map((pp) => pp.slice()); // a normal deal still solvable or not: just must not crash
    const r = S.solve(x, 2000); return { crash: false, nodes: r.nodes };
  });
  ok(!dead.crash && dead.nodes > 0, 'the solver respects its node limit');
  // a deal that is NOT solvable in draw 1 exists (so "solvable" means something): random deals are not all solvable
  const unsolvable = await p.evaluate(async () => { const S = await import('/src/games/klondike-solver.ts'); const L = window.__t.L; let none = 0;
    for (let sd = 1; sd <= 40; sd++) if (!S.solve(L.deal(sd * 31337, 1), 8000).moves) none++;
    return none; });
  ok(unsolvable > 0, `random deals are not all solvable (${unsolvable} of 40 not solved within the limit): the solvable mode really selects`);

  // ======================= 2. the screen =======================
  const st = () => p.evaluate(() => window.__klondike.state());
  const info = () => p.evaluate(() => window.__klondike.info());
  const load = (spec) => p.evaluate(async (spec) => { const { mk } = window.__t; window.__klondike.load(mk(spec)); }, spec);
  const centre = (sel, dy) => p.evaluate(({ sel, dy }) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: dy === undefined ? r.top + r.height / 2 : r.top + dy }; }, { sel, dy });
  const cardSel = (name) => `.kl-card[data-card="${name}"]`;
  const idOf = (name) => p.evaluate((n) => window.__t.card(n), name);
  const tapCard = async (name) => { const id = await idOf(name); const c = await centre(cardSel(id), 7); await p.mouse.click(c.x, c.y); await p.waitForTimeout(60); };
  const dragCard = async (name, to, steps = 8) => { const id = await idOf(name); const c = await centre(cardSel(id), 8); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(to.x, to.y, { steps }); await p.mouse.up(); await p.waitForTimeout(80); };
  const slotC = (i) => centre(`.kl-slot.pile[data-pile="${i}"]`);
  const foundC = (i) => centre(`.kl-slot.found[data-found="${i}"]`);
  const clickStock = async () => { const c = await centre('#kl-stock'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(40); };
  const inWin = () => p.locator('#kl-win').isVisible();

  await p.screenshot({ path: OUT + 'klondike-start.png' });
  let s0 = await st(), i0 = await info();
  ok(s0.tab.every((q, i) => q.length === i + 1) && s0.stock.length === 24 && s0.waste.length === 0 && i0.draw === 1, 'a new game: piles of 1..7 cards, 24 in the stock, draw 1');
  ok(await p.locator('.kl-card').count() === 52 && await p.locator('.kl-card:not(.down)').count() === 7, '52 cards on the table, only the 7 top cards face up');
  ok((await p.textContent('#kl-score')) === '得分：0' && (await p.textContent('#kl-moves')) === '步数：0' && (await p.textContent('#kl-time')) === '时间：0:00' && (await p.textContent('#kl-best')) === '最高：0', 'the four pills show score, moves, time and best');
  ok(await p.locator('#kl-undo').isDisabled() && !(await p.locator('#kl-done').isVisible()), 'undo is off and auto-complete is hidden at the start');

  // ---- tap moves
  await load({ tab: [['AC'], ['3D', '2C'], ['9S'], ['8H'], ['5H', '4S'], [], []], found: [0, 0, 0, 0] });
  await tapCard('AC'); let s = await st();
  ok(s.found[0] === 1 && s.tab[0].length === 0 && s.score === 10 && s.moves === 1, 'tap an Ace: it goes to its foundation (+10)');
  const fpos = await p.evaluate(() => { const c = document.querySelector('.kl-card[data-card="0"]').getBoundingClientRect(), sl = document.querySelector('.kl-slot.found[data-found="0"]').getBoundingClientRect(); return Math.abs(c.left - sl.left) < 2 && Math.abs(c.top - sl.top) < 2; });
  ok(fpos, 'the card sits exactly on its foundation slot');
  await tapCard('2C'); s = await st(); ok(s.found[0] === 2 && s.tab[1].join() === String(await idOf('3D')), 'tap 2C (the top of a run of 2): foundation, +10');
  await tapCard('3D'); s = await st();
  ok(s.tab[1].length === 0 && s.found[1] === 0 && s.tab[4].length === 3 && s.tab[4][2] === await idOf('3D'), 'tap 3D: onto the black 4 (a pile with cards)');
  ok(s.score === 20, `score after those moves: ${s.score}`);
  // a run: tap the first card of a run moves the whole run
  await load({ tab: [['9S', '8H', '7C'], ['9C'], [], [], [], [], []], down: [0] });
  await tapCard('8H'); s = await st();
  ok(s.tab[0].length === 1 && s.tab[1].length === 3, 'tap a card in the middle of a run: the run from it moves together');
  // a card that cannot move: a shake and no change
  await load({ tab: [['9S'], ['KD'], [], [], [], [], []] });
  await tapCard('9S'); s = await st();
  ok(s.moves === 0 && s.tab[0].length === 1, 'tap a card with nowhere to go: nothing happens');
  // a double tap does not move a second card
  await load({ tab: [['3D', '2C'], ['9S'], ['4C'], [], [], [], []], found: [1, 0, 0, 0] });
  await p.waitForTimeout(350);
  const dc = await centre(cardSel(await idOf('2C')), 7);
  await p.mouse.dblclick(dc.x, dc.y); await p.waitForTimeout(100); s = await st();
  ok(s.found[0] === 2 && s.tab[0].length === 1 && s.moves === 1, 'a double tap = one tap: the card below does not move as well');

  // ---- drawing
  await p.evaluate(() => window.__klondike.newGame(2024, 1));
  const stockC = await centre('#kl-stock');
  await p.mouse.click(stockC.x, stockC.y); await p.waitForTimeout(80); s = await st();
  ok(s.waste.length === 1 && s.stock.length === 23 && s.moves === 1 && (await p.textContent('#kl-count')) === '23', 'tap the stock (draw 1): one card to the waste, the stock count shows 23');
  const wc = await p.evaluate(() => { const c = document.querySelector('.kl-card:not(.down)[style*="z-index: 20"]'); const sl = document.querySelector('#kl-waste').getBoundingClientRect(); const r = c && c.getBoundingClientRect(); return r && Math.abs(r.left - sl.left) < 2; });
  ok(wc, 'the drawn card lies on the waste slot, face up');
  for (let k = 0; k < 23; k++) { await p.mouse.click(stockC.x, stockC.y); await p.waitForTimeout(15); }
  s = await st(); ok(s.stock.length === 0 && s.waste.length === 24, 'drawing all 24 cards empties the stock');
  const sc0 = s.score; await p.mouse.click(stockC.x, stockC.y); await p.waitForTimeout(60); s = await st();
  ok(s.stock.length === 24 && s.waste.length === 0 && s.recycles === 1 && s.score === Math.max(0, sc0 - 100), 'tap the empty stock: the waste turns over (draw 1: -100, never below 0)');
  await p.evaluate(() => window.__klondike.newGame(2024, 3));
  await p.mouse.click(stockC.x, stockC.y); await p.waitForTimeout(100); s = await st();
  ok(s.waste.length === 3 && s.stock.length === 21 && s.fan === 3, 'draw 3: three cards to the waste, fanned out');
  const fan = await p.evaluate(() => { const xs = [...document.querySelectorAll('.kl-card:not(.down)')].filter((e) => Number(e.style.zIndex) >= 20).map((e) => e.getBoundingClientRect().left).sort((a, b) => a - b); return xs; });
  ok(fan.length === 3 && fan[1] > fan[0] + 5 && fan[2] > fan[1] + 5, 'the three fanned waste cards are side by side: ' + fan.map(Math.round));
  await p.screenshot({ path: OUT + 'klondike-draw3.png' });

  // ---- drag with the mouse
  await load({ tab: [['9S'], ['8H', '7C'], ['TD'], ['KS', 'QH'], [], [], []], down: [0, 0, 0, 0] });
  await dragCard('9S', await slotC(2));
  s = await st(); ok(s.tab[2].length === 2 && s.tab[0].length === 0, 'drag 9S onto the red 10: it goes');
  await dragCard('8H', await slotC(3));   // 8H + 7C onto QH? illegal (J needed)
  s = await st(); ok(s.tab[1].length === 2 && s.tab[3].length === 2 && s.moves === 1, 'drop on a wrong pile: the cards go back, no move counted');
  const back = await p.evaluate(() => { const bad = [...document.querySelectorAll('.kl-card.drag')].length; return bad; });
  ok(back === 0, 'no card stays in the dragged state');
  await dragCard('8H', await slotC(2));   // onto 9S in pile 2: legal run of two
  s = await st(); ok(s.tab[2].length === 4 && s.tab[1].length === 0, 'a run of two cards drags together onto a 9');
  await load({ tab: [['AD'], [], [], [], [], [], []], found: [0, 0, 0, 0] });
  await dragCard('AD', await foundC(1)); s = await st(); ok(s.found[1] === 1 && s.score === 10, 'drag an Ace to its foundation');
  await dragCard('AD', await slotC(3)); s = await st(); ok(s.found[1] === 1, 'the foundation card is not a King: it cannot go to an empty pile');
  await load({ tab: [['3C'], [], [], [], [], [], []], found: [0, 2, 0, 0] });
  await dragCard('2D', await slotC(0)); s = await st();
  ok(s.found[1] === 1 && s.tab[0].length === 2 && s.score === 0, 'drag the top foundation card back onto the tableau (-15, never below 0)');
  await load({ tab: [[], [], [], [], [], [], []], waste: ['KH'], found: [0, 0, 0, 0] });
  await dragCard('KH', await slotC(4)); s = await st(); ok(s.tab[4].length === 1 && s.waste.length === 0 && s.score === 5, 'drag the waste card (a King) onto an empty pile (+5)');

  // ---- drag with REAL touch events through CDP at dpr 2
  const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true });
  const p2 = t2.page; await p2.evaluate(() => (location.hash = '#/games/klondike')); await p2.waitForSelector('#kl-board'); await p2.evaluate(HELP);
  const cdp = await t2.ctx.newCDPSession(p2);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
  await p2.evaluate(async () => { const { mk } = window.__t; window.__klondike.load(mk({ tab: [['9S', '8H', '7C'], ['TD'], ['KS'], [], [], [], []] })); });
  await p2.waitForTimeout(300);
  const cardC = async (name, dy) => p2.evaluate(({ n, dy }) => { const e = document.querySelector(`.kl-card[data-card="${window.__t.card(n)}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + dy }; }, { n: name, dy });
  const slot2 = async (i) => p2.evaluate((i) => { const e = document.querySelector(`.kl-slot.pile[data-pile="${i}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, i);
  let a = await cardC('8H', 7), b = await slot2(1);
  await touch('touchStart', a.x, a.y); for (let k = 1; k <= 8; k++) await touch('touchMove', a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8); await touch('touchEnd');
  await p2.waitForTimeout(150);
  let s2 = await p2.evaluate(() => window.__klondike.state());
  ok(s2.tab[1].length === 1 && s2.tab[0].length === 3, 'REAL touch drag (dpr 2): the run 8H-7C dropped on the red 10 (a black 9 is needed) goes back');
  await p2.evaluate(async () => { const { mk } = window.__t; window.__klondike.load(mk({ tab: [['9S', '8H', '7C'], ['TD'], ['KS'], [], [], [], []] })); });
  await p2.waitForTimeout(300);
  a = await cardC('9S', 7); b = await slot2(1);
  await touch('touchStart', a.x, a.y); for (let k = 1; k <= 8; k++) await touch('touchMove', a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8); await touch('touchEnd');
  await p2.waitForTimeout(150); s2 = await p2.evaluate(() => window.__klondike.state());
  ok(s2.tab[1].length === 4 && s2.tab[0].length === 0, 'REAL touch drag (dpr 2): the whole run of three (9S 8H 7C) moves onto the red 10');
  // a touch tap draws
  await p2.evaluate(() => window.__klondike.newGame(77, 1)); await p2.waitForTimeout(300);
  const sc = await p2.evaluate(() => { const e = document.querySelector('#kl-stock').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
  await touch('touchStart', sc.x, sc.y); await touch('touchEnd'); await p2.waitForTimeout(120);
  s2 = await p2.evaluate(() => window.__klondike.state());
  ok(s2.waste.length === 1 && s2.stock.length === 23, 'REAL touch tap on the stock draws a card');
  // a touch tap moves a card to the foundation
  await p2.evaluate(async () => { const { mk } = window.__t; window.__klondike.load(mk({ tab: [['AH'], [], [], [], [], [], []] })); }); await p2.waitForTimeout(300);
  a = await cardC('AH', 8); await touch('touchStart', a.x, a.y); await touch('touchEnd'); await p2.waitForTimeout(120);
  s2 = await p2.evaluate(() => window.__klondike.state());
  ok(s2.found[2] === 1, 'REAL touch tap on an Ace sends it to the foundation');
  ok(t2.log.external.length === 0, 'no outside request on the touch page');
  await t2.browser.close();

  // ---- undo, hint, new / replay
  await p.evaluate(() => window.__klondike.newGame(555, 1));
  const orig = await st();
  await clickStock(); await clickStock(); await p.waitForTimeout(60);
  s = await st(); ok(s.moves === 2 && s.waste.length === 2, 'two draws');
  await p.click('#kl-undo'); s = await st(); ok(s.moves === 1 && s.waste.length === 1, 'undo takes one move back');
  await p.keyboard.press('z'); s = await st(); ok(JSON.stringify(s) === JSON.stringify(orig), 'Z undoes too and the position is exactly the one before (every field)');
  ok(await p.locator('#kl-undo').isDisabled(), 'undo is off again with nothing to undo');
  await load({ tab: [['9D', '8C'], ['AS'], ['9H'], [], [], [], []], down: [1], found: [0, 0, 0, 0] });
  await p.click('#kl-hint'); await p.waitForTimeout(50);
  ok((await p.locator('.kl-board .hint').count()) >= 1 && (await p.textContent('#kl-msg')) === '提示：翻开一张暗牌。', 'hint: a highlighted card and the line "turn over a face-down card"');
  ok(await p.evaluate(() => document.querySelector('.kl-card.hint') === document.querySelector(`.kl-card[data-card="${window.__t.card('8C')}"]`)), 'the hint marks the card that uncovers the face-down one');
  await p.evaluate(async () => { const x = window.__t.L.deal(5, 1); x.stock = []; x.waste = []; x.tab = x.tab.map(() => []); x.found = [0, 0, 0, 0]; window.__klondike.load(x); });
  await p.click('#kl-hint'); ok((await p.textContent('#kl-msg')).includes('没有可用的提示') && (await p.locator('.kl-board .hint').count()) === 0, 'hint on a dead position says so and marks nothing');
  // stuck message after a move
  await load({ tab: [['9D'], ['8C'], [], [], [], [], []], found: [0, 0, 0, 0], stock: [], waste: [] });
  await tapCard('8C');
  ok((await p.textContent('#kl-msg')) === '无牌可走。请撤销或重新发牌。', 'after a move that leaves nothing to do the screen says so');
  await p.evaluate(() => window.__klondike.newGame(555, 1));
  const o2 = await st();
  await p.click('#kl-new'); await p.waitForTimeout(80);
  const n2 = await info(); const ns2 = await st();
  ok(JSON.stringify(ns2.tab) !== JSON.stringify(o2.tab), `New deal: another deal (seed ${n2.seed})`);
  await clickStock(); await p.click('#kl-replay'); await p.waitForTimeout(80);
  const rs = await st(), seedNow = (await info()).seed;
  ok(JSON.stringify(rs) === JSON.stringify(await p.evaluate((sd) => window.__t.L.deal(sd, 1), seedNow)) && rs.moves === 0, 'Replay: the same deal again, all as dealt, the move counter 0');
  // ---- modes: draw 1 / 3 and random / solvable are remembered
  await p.click('#kl-draw'); await p.waitForTimeout(60);
  ok((await p.textContent('#kl-draw')) === '翻 3 张' && (await info()).draw === 3 && (await st()).draw === 3, 'the draw button switches to 3 (a new deal)');
  await p.click('#kl-kind'); await p.waitForTimeout(60);
  let inf = await info();
  ok(inf.solvable && (await p.textContent('#kl-kind')) === '可解牌局' && seeds['3'].includes(inf.seed), `solvable mode (draw 3): the deal is one of the proved ones (#${inf.seed})`);
  let pr = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).klondike);
  ok(pr.draw === 3 && pr.solvable === true, 'the choices are kept on this device');
  // the proved deal can really be played to a win in the app: solve it and apply the moves through the screen hook
  const played = await p.evaluate(async () => { const S = await import('/src/games/klondike-solver.ts'); const L = window.__t.L; const inf = window.__klondike.info();
    const r = S.solve(L.deal(inf.seed, inf.draw), 30000); if (!r.moves) return 'no solution'; for (const m of r.moves) if (!window.__klondike.apply(m)) return 'refused'; return window.__klondike.info().won ? 'won' : 'not won'; });
  ok(played === 'won', 'the solution of the offered solvable deal, played through the game, wins: ' + played);
  await p.waitForSelector('#kl-win', { state: 'visible', timeout: 4000 });
  await p.click('#kl-draw'); await p.click('#kl-kind'); await p.waitForTimeout(60);
  inf = await info(); ok(inf.draw === 1 && !inf.solvable && !inf.won, 'back to draw 1 and random deals (the old win overlay is gone)');
  ok(await p.locator('#kl-win').isHidden(), 'a new deal hides the win overlay');
  await p.screenshot({ path: OUT + 'klondike-modes.png' });

  // ---- keyboard
  await p.evaluate(() => { window.__klondike.newGame(901, 1); document.activeElement && document.activeElement.blur(); });
  await p.keyboard.press(' '); s = await st(); ok(s.waste.length === 1, 'Space draws');
  await p.keyboard.press('d'); s = await st(); ok(s.waste.length === 2, 'D draws');
  await p.keyboard.press('Backspace'); s = await st(); ok(s.waste.length === 1, 'Backspace undoes');
  await load({ tab: [['AS', ], ['2H'], ['3C'], [], [], [], []], found: [0, 0, 0, 0], waste: ['AD'] });
  await p.keyboard.press('1'); s = await st(); ok(s.found[3] === 1, 'key 1 plays the top card of pile 1 (the Ace goes up)');
  await p.keyboard.press('w'); s = await st(); ok(s.found[1] === 1 && s.waste.length === 0, 'W plays the waste card');
  await p.keyboard.press('2'); s = await st(); ok(s.tab[2].length === 2, 'key 2 moves the 2H onto the black 3');
  await p.keyboard.press('h'); ok((await p.textContent('#kl-msg')).length > 0, 'H gives a hint');

  // ---- auto-complete
  await load({ tab: [['KS', 'QH', 'JS'], ['KD', 'QC', 'JD'], ['KH', 'QS', 'JH'], ['KC', 'QD', 'JC'], [], [], []], found: [10, 10, 10, 10], waste: [], stock: [] });
  ok(await p.locator('#kl-done').isVisible() && (await p.textContent('#kl-done')) === '自动完成', 'with every card face up the auto-complete button appears');
  await p.click('#kl-done');
  await p.waitForSelector('#kl-win', { state: 'visible', timeout: 5000 });
  s = await st(); ok(s.found.every((n) => n === 13), 'auto-complete ends with all four foundations full');
  ok((await p.textContent('#kl-win h2')) === '你赢了。' && (await p.textContent('#kl-win p')).includes('得分') && await p.locator('#kl-again').isVisible(), 'the win overlay: title, the score line and a button');
  await p.screenshot({ path: OUT + 'klondike-win.png' });
  // not offered while a face-down card exists
  await load({ tab: [['KS', 'QH'], [], [], [], [], [], []], down: [1], found: [0, 0, 0, 0] });
  ok(await p.locator('#kl-done').isHidden(), 'no auto-complete while a card is face down');

  // ---- winning with the last tap: score, time bonus, best saved
  await p.evaluate(() => { localStorage.removeItem('learn.games.v1'); });
  await load({ tab: [['KS'], [], [], [], [], [], []], found: [13, 13, 13, 12], waste: [], stock: [] });
  await p.evaluate(() => window.__klondike.shiftClock(100000));
  await tapCard('KS');
  await p.waitForSelector('#kl-win', { state: 'visible', timeout: 4000 });
  const w = await p.evaluate(() => ({ line: document.querySelector('#kl-win p').textContent, rec: document.querySelector('#kl-record').textContent, g: JSON.parse(localStorage.getItem('learn.games.v1')).klondike }));
  ok(w.g['best-1'] === 10 + 7000 && w.g.wins === 1 && w.rec === '新纪录：7010' && w.line.includes('7010'), `win: 10 points + the time bonus (700000 / 100 s = 7000) = best score saved (${w.g['best-1']}), record line "${w.rec}"`);
  ok((await p.textContent('#kl-best')) === '最高：7010' && (await p.textContent('#kl-score')) === '得分：7010', 'the pills show the score and the best');
  await p.click('#kl-again'); await p.waitForTimeout(80);
  ok((await p.locator('#kl-win').isHidden()) && (await info()).hist === 0 && (await st()).stock.length === 24, 'Play again: a new deal');

  // ---- the win animation (motion on): the originals are hidden while their clones fly
  const t3 = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 }, motion: true });
  const p3 = t3.page; await p3.evaluate(() => (location.hash = '#/games/klondike')); await p3.waitForSelector('#kl-board'); await p3.evaluate(HELP); await p3.waitForTimeout(500);
  await p3.evaluate(async () => { const { mk } = window.__t; window.__klondike.load(mk({ tab: [['KS'], [], [], [], [], [], []], found: [13, 13, 13, 12], waste: [], stock: [] })); });
  await p3.waitForTimeout(400);
  const cc = await p3.evaluate(() => { const e = document.querySelector(`.kl-card[data-card="${window.__t.card('KS')}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 7 }; });
  await p3.mouse.click(cc.x, cc.y);
  await p3.waitForTimeout(1250);
  const fl = await p3.evaluate(() => { const clones = [...document.querySelectorAll('.kl-fly')]; const orig = (c) => document.querySelector(`.kl-card[data-card="${c}"]:not(.kl-fly)`); const hiddenAll = clones.every((e) => getComputedStyle(orig(e.dataset.card)).visibility === 'hidden'); const spawned = [...document.querySelectorAll('.kl-card[data-card]')].filter((e) => !e.classList.contains('kl-fly') && getComputedStyle(e).visibility === 'hidden').length; return { clones: clones.length, hiddenAll, spawned, conf: document.querySelectorAll('.kl-conf').length }; });
  ok(fl.clones >= 6 && fl.hiddenAll && fl.spawned >= fl.clones && fl.conf > 20, `win animation: ${fl.clones} cards fly, the original of every flying card is hidden (${fl.spawned} hidden in all), confetti falls (${fl.conf})`);
  const stillKing = await p3.evaluate(() => { const k = document.querySelector(`.kl-card[data-card="${window.__t.card('KS')}"]:not(.kl-fly)`); return getComputedStyle(k).visibility; });
  ok(stillKing === 'hidden', 'the last King (which the player moved) does not stay in front of the animation');
  await p3.screenshot({ path: OUT + 'klondike-win-anim.png' });
  await p3.waitForSelector('#kl-win', { state: 'visible', timeout: 4000 });
  await p3.click('#kl-again'); await p3.waitForTimeout(200);
  const after = await p3.evaluate(() => ({ clones: document.querySelectorAll('.kl-fly').length, hidden: [...document.querySelectorAll('.kl-card[data-card]')].filter((e) => getComputedStyle(e).visibility === 'hidden').length }));
  ok(after.clones === 0 && after.hidden === 0, 'a new deal removes every flying card and shows every original again');
  // leaving mid-animation leaves nothing running
  await p3.evaluate(async () => { const { mk } = window.__t; window.__klondike.load(mk({ tab: [['KS'], [], [], [], [], [], []], found: [13, 13, 13, 12], waste: [], stock: [] })); });
  await p3.waitForTimeout(300);
  const c3 = await p3.evaluate(() => { const e = document.querySelector(`.kl-card[data-card="${window.__t.card('KS')}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 7 }; });
  await p3.mouse.click(c3.x, c3.y); await p3.waitForTimeout(500);
  await p3.evaluate(() => (location.hash = '#/subject/games')); await p3.waitForSelector('.gm-grid');
  ok(await p3.evaluate(() => !window.__klondike && document.querySelectorAll('.kl-fly').length === 0), 'leaving the game during the animation removes everything');
  ok(t3.log.external.length === 0, 'no outside request on the animation page');
  await t3.browser.close();

  // ======================= 3. layout on 5 screens =======================
  // the worst pile: six face-down cards under a full King-to-Ace run
  const worst = { tab: [['2C'], ['3C'], ['4C'], ['5C'], ['6C'], ['7C'], ['8C', '9C', 'TC', 'JC', 'QC', 'KC', 'KS', 'QH', 'JS', 'TH', '9S', '8H', '7S', '6H', '5S', '4H', '3S', '2H', 'AS']], down: [0, 0, 0, 0, 0, 0, 6] };
  // (a legal full run needs alternating colours; the face-up part here is K S, Q H, J S, T H ... A S)
  for (const [name, w0, h0] of [['phone-small', 320, 568], ['phone', 390, 844], ['ipad', 820, 1180], ['ipad-land', 1180, 820], ['phone-land', 844, 390]]) {
    await p.setViewportSize({ width: w0, height: h0 });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/klondike')); await p.waitForSelector('#kl-board');
    await p.evaluate(HELP); await p.waitForTimeout(300);
    await p.evaluate(() => window.__klondike.newGame(12345, 1)); await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const board = R(document.querySelector('#kl-board'));
      const slots = [...document.querySelectorAll('.kl-slot')].map(R);
      const piles = [...document.querySelectorAll('.kl-slot.pile')].map(R);
      const btns = [...document.querySelectorAll('.kl-hud button')].filter((b) => !b.hidden).map(R);
      const pills = [...document.querySelectorAll('.kl-stat')].map(R);
      const top = document.querySelector('.kl-card:not(.down) .kl-top');
      return { board, slots, piles, btns, pills, fs: top ? parseFloat(getComputedStyle(top).fontSize) : 0, cw: window.__klondike.info().cw, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.board) && m.btns.every(inside) && m.pills.every(inside), `${name} ${w0}x${h0}: board, buttons and pills are on the screen`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(m.piles.every((q) => q.l >= m.board.l - 0.5 && q.r <= m.board.r + 0.5), `${name}: all 7 columns fit inside the board (card ${Math.round(m.cw)} px wide)`);
    const left = m.piles[0].l - m.board.l, right = m.board.r - m.piles[6].r;
    ok(Math.abs(left - right) <= 3, `${name}: the columns are centred in the board (${Math.round(left)} / ${Math.round(right)})`);
    if (name !== 'phone-land') ok(Math.abs(m.board.l - (m.vw - m.board.r)) <= 3, `${name}: the board is centred on the screen`);
    ok(m.cw >= (name === 'phone-small' ? 36 : 40) && m.fs >= 11, `${name}: cards are readable (${Math.round(m.cw)} px wide, corner text ${m.fs.toFixed(1)} px)`);
    ok(m.btns.every((b) => b.h >= 39.5), `${name}: every button is at least 40 px high (smallest ${Math.round(Math.min(...m.btns.map((b) => b.h)))})`);
    await p.screenshot({ path: OUT + `klondike-${name}.png` });
    // the worst pile stays inside the board and its cards stay readable (rank visible: at least 11 px between cards)
    await p.evaluate(async (spec) => { const { mk } = window.__t; window.__klondike.load(mk(spec)); }, worst);
    await p.waitForTimeout(350);
    const wp = await p.evaluate(() => { const b = document.querySelector('#kl-board').getBoundingClientRect(); const els = [...document.querySelectorAll('.kl-card')].map((e) => e.getBoundingClientRect()); const maxB = Math.max(...els.map((r) => r.bottom)); const inf = window.__klondike.info(); return { over: maxB - b.bottom, du: inf.du, cw: inf.cw }; });
    ok(wp.over <= 1 && wp.du >= 10, `${name}: a pile of 6 face-down + 13 face-up cards stays inside the board (spacing ${wp.du.toFixed(1)} px, card ${Math.round(wp.cw)} px)`);
    await p.screenshot({ path: OUT + `klondike-${name}-long.png` });
  }

  // leaving removes the hook; keys do nothing afterwards
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__klondike);
  await p.keyboard.press(' ');
  ok(true, 'leaving the game removes it (the hook is gone, keys do nothing)');
  ok(await p.locator('#gm-klondike').count() === 1, 'the card of the game is in the list of games');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ======================= 4. EN / FR: no Chinese left =======================
  for (const [loc, win, hintTxt] of [['en-US', 'You win.', 'Hint'], ['fr-FR', 'Vous avez gagné.', 'Indice']]) {
    const tl = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const pl = tl.page; await pl.evaluate(() => (location.hash = '#/games/klondike')); await pl.waitForSelector('#kl-board'); await pl.evaluate(HELP); await pl.waitForTimeout(400);
    const texts = async () => pl.evaluate(() => document.querySelector('.gm-page').innerText + '\n' + [...document.querySelectorAll('.gm-page [title],.gm-page [aria-label]')].map((e) => (e.title || '') + (e.getAttribute('aria-label') || '')).join('\n'));
    let tx = await texts();
    ok(!CJK.test(tx), `${loc}: the screen has no Chinese left (${(tx.match(CJK) || [''])[0]})`);
    ok(tx.includes(hintTxt), `${loc}: the hint button is translated ("${hintTxt}")`);
    await pl.click('#kl-draw'); await pl.click('#kl-kind');
    await pl.evaluate(async () => { const x = window.__t.L.deal(5, 1); x.stock = []; x.waste = []; x.tab = x.tab.map(() => []); x.found = [0, 0, 0, 0]; window.__klondike.load(x); });
    await pl.click('#kl-hint'); tx = await texts();
    ok(!CJK.test(tx) && /(No hint|Aucun indice)/.test(tx), `${loc}: the "no hint" line is translated`);
    for (const k of ['draw', 'recycle', 'reveal', 'found', 'space', 'tab']) {
      const specs = { reveal: { tab: [['9D', '8C'], ['AS'], ['9H']], down: [1] }, found: { tab: [['AS'], ['9S']] }, space: { tab: [['8C'], ['9D']], stock: [] }, tab: { tab: [['9D']], waste: ['8C'], stock: [] }, draw: { tab: [['9D']], waste: ['5C'], stock: ['8S'] }, recycle: { tab: [['9D']], waste: ['8S', '5C'], stock: [] } };
      await pl.evaluate(async (sp) => { window.__klondike.load(window.__t.mk(sp)); }, specs[k]);
      await pl.click('#kl-hint'); tx = await pl.textContent('#kl-msg');
      ok(!CJK.test(tx) && !!tx, `${loc}: hint line "${k}" is translated -> "${tx}"`);
    }
    await pl.evaluate(async () => { const { mk } = window.__t; window.__klondike.load(mk({ tab: [['KS'], [], [], [], [], [], []], found: [13, 13, 13, 12], waste: [], stock: [] })); });
    await pl.waitForTimeout(200);
    const k = await pl.evaluate(() => { const e = document.querySelector(`.kl-card[data-card="${window.__t.card('KS')}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 7 }; });
    await pl.mouse.click(k.x, k.y); await pl.waitForSelector('#kl-win', { state: 'visible', timeout: 4000 });
    tx = await texts();
    ok(!CJK.test(tx) && tx.includes(win), `${loc}: the win overlay is translated ("${win}") and has no Chinese`);
    await pl.screenshot({ path: OUT + `klondike-win-${loc.slice(0, 2)}.png` });
    ok(tl.log.external.length === 0, `${loc}: no outside request`);
    await tl.browser.close();
  }
  await done();
})();
