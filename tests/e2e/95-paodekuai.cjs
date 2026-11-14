// 跑得快 (Run Fast): the pure rules (classifier against a complete reference table, beats, the enumerator against brute force, first lead, "one card left" rule, scoring,
// 300 AI games), the screen (deal, select by tap / drag / keys, play, pass, hint, a full game, win overlay), layout on 5 screens, EN / FR, real touch drag (CDP, dpr 2).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[一-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/paodekuai')); await p.waitForSelector('#pdk-field');

  // ---------- 1. the rules ----------
  const R = await p.evaluate(async () => {
    const M = await import('/src/games/paodekuai-logic.ts');
    const res = { bad: [], keys: 0, subsets: 0, enumCases: 0, enumPlays: 0, games: 0, turns: 0, passes: 0, bombs: 0, lastShort: 0, wins: { hard: 0, games: 0 } };
    const bad = (m) => { if (res.bad.length < 8) res.bad.push(m); };
    // ---- the deck
    const deck = M.makeDeck();
    if (deck.length !== 48 || new Set(deck).size !== 48) bad('deck size');
    const has = (r, s) => deck.includes(r * 4 + s);
    if (has(12, 0) || has(12, 1) || has(12, 2) || !has(12, 3) || has(11, 3) || !has(11, 0) || !has(11, 1) || !has(11, 2) || !has(0, 0)) bad('deck: wrong cards removed');
    if (deck.length - [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, r) => a + [0, 1, 2, 3].filter((s) => has(r, s)).length, 0) !== 4) bad('deck: ace / two count');
    const AVAIL = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 1];
    // ---- the reference: EVERY combination as a vector of rank counts (own construction from the written rules)
    const ref = new Map();   // "c0,c1,..." -> Set("type|k|rank|short|n") for last = false; and for last = true
    const keyOf = (v) => v.join(',');
    const put = (v, type, k, rank, short, which) => {
      const n = v.reduce((a, b) => a + b, 0); if (n > 16) return;
      const key = keyOf(v); let e = ref.get(key); if (!e) { e = { f: new Set(), l: new Set() }; ref.set(key, e); }
      const s = `${type}|${k}|${rank}|${short ? 1 : 0}|${n}`;
      if (which !== 'l') e.f.add(s);
      e.l.add(s);
    };
    const zero = () => new Array(13).fill(0);
    for (let r = 0; r < 13; r++) { const v = zero(); v[r] = 1; put(v, 'single', 1, r, false); if (AVAIL[r] >= 2) { const w = zero(); w[r] = 2; put(w, 'pair', 1, r, false); } if (AVAIL[r] >= 4) { const w = zero(); w[r] = 4; put(w, 'bomb', 1, r, false); } }
    for (let s = 0; s <= 11; s++) for (let e = s + 4; e <= 11; e++) { const v = zero(); for (let r = s; r <= e; r++) v[r] = 1; put(v, 'straight', e - s + 1, e, false); }
    for (let s = 0; s <= 11; s++) for (let e = s + 1; e <= 11 && 2 * (e - s + 1) <= 16; e++) { const v = zero(); for (let r = s; r <= e; r++) v[r] = 2; put(v, 'pairs', e - s + 1, e, false); }
    const wingSets = (forbid, size, from, cur, out) => {   // all count vectors of `size` cards over ranks not in forbid, within availability
      if (size === 0) { out.push(cur.slice()); return; }
      if (from >= 13) return;
      for (let c = Math.min(size, AVAIL[from]); c >= 0; c--) {
        if (forbid.has(from) && c > 0) continue;
        cur[from] = c; wingSets(forbid, size - c, from + 1, cur, out); cur[from] = 0;
      }
    };
    for (let k = 1; 3 * k <= 16; k++) for (let s = 0; s + k - 1 <= 11; s++) {
      const run = new Set(); for (let r = s; r < s + k; r++) run.add(r);
      if ([...run].some((r) => AVAIL[r] < 3)) continue;
      for (let w = 0; w <= 2 * k && 3 * k + w <= 16; w++) {
        const out = []; wingSets(run, w, 0, zero(), out);
        for (const wv of out) { const v = wv.slice(); for (const r of run) v[r] = 3; put(v, 'triple', k, s + k - 1, w < 2 * k, w === 2 * k ? 'f' : 'l'); }
      }
    }
    res.keys = ref.size;
    // ---- cards from a count vector
    const cardsOf = (v) => { const out = []; for (let r = 0; r < 13; r++) { let c = 0; for (let s = 0; s < 4 && c < v[r]; s++) if (has(r, s)) { out.push(r * 4 + s); c++; } } return out; };
    const sigs = (ints) => new Set(ints.map((c) => `${c.type}|${c.k}|${c.rank}|${c.short ? 1 : 0}|${c.n}`));
    const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    let shown = 0;
    for (const [key, e] of ref) {
      const v = key.split(',').map(Number), cards = cardsOf(v);
      const gotF = sigs(M.interpretations(cards, false)), gotL = sigs(M.interpretations(cards, true));
      if (!same(gotF, e.f) || !same(gotL, e.l)) { if (shown++ < 3) bad('classify ' + key + ' got ' + [...gotF] + ' / ' + [...gotL] + ' want ' + [...e.f] + ' / ' + [...e.l]); }
    }
    // random subsets: what is not in the table is not a combination
    let seed = 99; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 60000; i++) {
      const sub = M.shuffle(deck, rng).slice(0, 1 + Math.floor(rng() * 16)), key = keyOf(M.rankCounts(sub)), e = ref.get(key);
      res.subsets++;
      const gotF = sigs(M.interpretations(sub, false)), gotL = sigs(M.interpretations(sub, true));
      if (!same(gotF, e ? e.f : new Set()) || !same(gotL, e ? e.l : new Set())) bad('random subset ' + key);
    }
    // ---- beats: scripted
    const C = (type, k, rank, short = false, n) => ({ type, k, rank, short, n: n ?? (type === 'single' ? 1 : type === 'pair' ? 2 : type === 'bomb' ? 4 : type === 'straight' ? k : type === 'pairs' ? 2 * k : 5 * k) });
    const B = (a, b) => M.beatsCombo(a, b);
    const T = (c, m) => { if (!c) bad('beats: ' + m); };
    T(B(C('single', 1, 2), C('single', 1, 3)), 'single higher'); T(!B(C('single', 1, 3), C('single', 1, 3)), 'single equal'); T(!B(C('single', 1, 3), C('single', 1, 2)), 'single lower');
    T(!B(C('single', 1, 2), C('pair', 1, 9)), 'pair vs single'); T(B(C('pair', 1, 2), C('pair', 1, 5)), 'pair higher');
    T(B(C('straight', 5, 7), C('straight', 5, 8)), 'straight higher'); T(!B(C('straight', 5, 7), C('straight', 6, 10)), 'longer straight does not beat');
    T(!B(C('pairs', 2, 4), C('pairs', 3, 9)), 'pairs lengths differ'); T(B(C('pairs', 2, 4), C('pairs', 2, 5)), 'pairs higher');
    T(B(C('triple', 1, 3), C('triple', 1, 4)), 'triple higher'); T(!B(C('triple', 1, 3), C('triple', 2, 9)), 'plane vs triple');
    T(B(C('triple', 1, 3), C('triple', 1, 6, true, 4)), 'short triple beats a full one when higher'); T(!B(C('triple', 1, 6), C('triple', 1, 5, true, 4)), 'short triple lower');
    T(B(C('straight', 5, 11), C('bomb', 1, 0)), 'bomb beats straight'); T(B(C('single', 1, 12), C('bomb', 1, 0)), 'bomb beats the two');
    T(B(C('bomb', 1, 2), C('bomb', 1, 7)), 'bigger bomb'); T(!B(C('bomb', 1, 7), C('bomb', 1, 2)), 'smaller bomb'); T(!B(C('bomb', 1, 2), C('straight', 5, 11)), 'nothing but a bomb beats a bomb');
    // ---- the game helpers
    const mk = (hands, o = {}) => ({ hands, turn: 0, table: null, passes: 0, plays: [1, 1, 1], bombs: 0, winner: -1, firstPlay: false, shown: [null, null, null], started: 0, ...o });
    const rk = (...rs) => rs.map((r, i) => r * 4 + (i % 4));   // distinct cards of the given ranks (suit by position; callers avoid > 4 of a rank)
    const tab = (cards, combo, player = 2) => ({ player, cards, combo });
    // ---- the enumerator against brute force on random small hands
    for (let i = 0; i < 900; i++) {
      let hand = M.sortCards(M.shuffle(deck, rng).slice(0, 4 + Math.floor(rng() * 9)));
      if (i % 3 === 0 && !hand.includes(0)) hand = M.sortCards(hand.slice(1).concat([0]));
      if (i % 5 === 0) {   // a hand with a triple / a bomb to exercise the wings
        const r = Math.floor(rng() * 11), extra = [r * 4, r * 4 + 1, r * 4 + 2].filter((c) => !hand.includes(c)); hand = M.sortCards(hand.concat(extra).slice(0, 12));
      }
      const N = hand.length, others = M.shuffle(deck.filter((c) => !hand.includes(c)), rng);
      let table = null;
      if (i % 2 === 0) { const hh = others.slice(0, 5 + Math.floor(rng() * 6)), pl = M.enumeratePlays(hh, {}); if (pl.length) { const q = pl[Math.floor(rng() * pl.length)]; table = tab(q.cards, q.combo); } }
      const must = hand.includes(0) && rng() < 0.4 && !table;
      const nextOne = rng() < 0.4;
      const g = mk([hand, nextOne ? [others[0]] : others.slice(0, 5), others.slice(6, 11)], { table, firstPlay: !!must });
      const legal = M.legalPlays(g, 0), keys = new Set(legal.map((q) => q.cards.map((c) => c >> 2).sort((a, b) => a - b).join(',')));
      const maxRank = Math.max(...hand.map((c) => c >> 2));
      const brute = new Set();
      for (let mask = 1; mask < (1 << N); mask++) {
        const sub = []; for (let b = 0; b < N; b++) if (mask & (1 << b)) sub.push(hand[b]);
        const r = M.check(g, 0, sub);
        let want = false;
        const ints = M.interpretations(sub, sub.length === N);
        let pool = ints;
        if (must && !sub.includes(0)) pool = [];
        if (table) pool = pool.filter((c) => {
          if (c.type === 'bomb') return table.combo.type !== 'bomb' || c.rank > table.combo.rank;
          return table.combo.type !== 'bomb' && table.combo.type === c.type && table.combo.k === c.k && c.rank > table.combo.rank && (c.n === table.combo.n || (c.short && c.n < table.combo.n));
        });
        if (nextOne) pool = pool.filter((c) => c.type !== 'single' || c.rank === maxRank);
        want = pool.length > 0;
        if (want !== r.ok) bad('check disagrees with brute force on ' + sub.join());
        res.subsets++;
        if (want) brute.add(sub.map((c) => c >> 2).sort((a, b) => a - b).join(','));
      }
      res.enumCases++; res.enumPlays += legal.length;
      if (!same(keys, brute)) bad(`enumerator differs from brute force: ${[...keys].filter((k) => !brute.has(k)).slice(0, 2)} extra, ${[...brute].filter((k) => !keys.has(k)).slice(0, 2)} missing (hand ${hand.join()})`);
      for (const q of legal) { if (q.cards.some((c) => !hand.includes(c)) || new Set(q.cards).size !== q.cards.length || (must && !q.cards.includes(0))) bad('enumerated play not from the hand'); if (!M.check(g, 0, q.cards).ok) bad('enumerated play fails check'); }
    }
    // ---- first lead
    for (let i = 0; i < 100; i++) {
      const g = M.newGame(M.mulberry(1000 + i)), all = g.hands.flat();
      if (g.hands.some((h) => h.length !== 16) || new Set(all).size !== 48 || all.some((c) => !deck.includes(c))) bad('deal');
      if (!g.hands[g.turn].includes(0) || !g.firstPlay) bad('the holder of the 3 of diamonds leads');
      const h = g.hands[g.turn], other = h.find((c) => c !== 0);
      if (M.check(g, g.turn, [other]).why !== 'first') bad('first play without the 3 of diamonds accepted');
      if (M.check(g, (g.turn + 1) % 3, [g.hands[(g.turn + 1) % 3][0]]).why !== 'turn') bad('play out of turn accepted');
      if (M.legalPlays(g, g.turn).some((q) => !q.cards.includes(0)) || !M.legalPlays(g, g.turn).length) bad('first lead plays');
      if (M.canPass(g, g.turn)) bad('cannot pass when leading');
      if (!M.check(g, g.turn, [0]).ok) bad('the 3 of diamonds alone is a legal first play');
    }
    // ---- the "one card left" rule
    {
      const hand = [...rk(0, 4, 7, 10)];   // 3 7 10 K
      const g = mk([hand, [44], rk(1, 2)], { table: null });
      if (M.check(g, 0, [hand[0]]).why !== 'biggest' || M.check(g, 0, [hand[2]]).why !== 'biggest' || !M.check(g, 0, [hand[3]]).ok) bad('biggest single when the next player has one card');
      const pairHand = [0, 1, 8, 9, 30]; const g2 = mk([pairHand, [44], rk(1, 2)]);
      if (!M.check(g2, 0, [0, 1]).ok || !M.check(g2, 0, [8, 9]).ok || M.check(g2, 0, [0]).why !== 'biggest' || !M.check(g2, 0, [30]).ok) bad('pairs are free, the single must be the biggest');
      const g3 = mk([hand, [44], rk(1, 2)], { table: tab(rk(1), { type: 'single', k: 1, n: 1, rank: 1, short: false }) });
      const ls = M.legalPlays(g3, 0);
      if (ls.length !== 1 || ls[0].cards[0] !== hand[3]) bad('replying to a single with one card left: only the biggest');
      const g4 = mk([hand, [44, 45], rk(1, 2)]);
      if (!M.check(g4, 0, [hand[0]]).ok) bad('rule only for exactly one card');
      const g5 = mk([hand, [44], rk(1, 2)], { turn: 2, hands: [hand, [44], [0 + 4, 8, 12, 16]] });   // seat 2 has the next player = seat 0 (4 cards)
      if (M.check(g5, 2, [4]).ok !== true) bad('next player of seat 2 is seat 0');
    }
    // ---- must reply, pass, bombs optional
    {
      const hand = rk(0, 2, 5, 9);
      const lead = mk([hand, rk(1, 3, 6, 8), rk(1, 3, 6, 8)]);
      if (M.canPass(lead, 0)) bad('no pass when leading');
      const t1 = mk([hand, [44, 45], [48 + 3]], { table: tab([4 * 10], { type: 'single', k: 1, n: 1, rank: 10, short: false }) });
      if (!M.canPass(t1, 0)) bad('pass allowed when nothing beats the single K');   // no card above K: nothing
      const t2 = mk([hand, [44, 45], [51]], { table: tab([4 * 1], { type: 'single', k: 1, n: 1, rank: 1, short: false }) });
      if (M.canPass(t2, 0)) bad('must reply when a card beats the single');
      const bombHand = [0, 1, 2, 3, 20];
      const t3 = mk([bombHand, [44, 45], [51]], { table: tab([4 * 5], { type: 'single', k: 1, n: 1, rank: 5, short: false }) });
      if (!M.canPass(t3, 0)) bad('only a bomb beats: pass is allowed');
      if (!M.check(t3, 0, [0, 1, 2, 3]).ok) bad('a bomb beats a single');
      // two passes give the lead back
      const g = M.newGame(M.mulberry(5)); const p0 = g.turn; M.play(g, p0, [0]);
      if (!M.pass(g, g.turn)) { /* the next player may have a reply: make him able to pass by emptying his options */ }
    }
    // ---- scoring
    {
      const g = mk([[], rk(1, 2, 3, 4, 5), rk(1, 2, 3)], { winner: 0, plays: [4, 2, 0] });
      let d = M.scoreGame(g); if (d[0] !== 11 || d[1] !== -5 || d[2] !== -6) bad('score ' + d);
      g.bombs = 1; d = M.scoreGame(g); if (d[0] !== 22 || d[1] !== -10 || d[2] !== -12) bad('score with a bomb ' + d);
      const g2 = mk([rk(1), [], rk(1, 2, 3)], { winner: 1, plays: [3, 4, 3] }); d = M.scoreGame(g2); if (d[1] !== 4 || d[0] !== -1 || d[2] !== -3 || d.reduce((a, b) => a + b, 0) !== 0) bad('score 2 ' + d);
    }
    // ---- 300 games of the computer against itself (levels 0 / 1 / 2 on every seat), checked against the reference table
    const sigOf = (cards, last) => { const e = ref.get(keyOf(M.rankCounts(cards))); return e ? (last ? e.l : e.f) : new Set(); };
    const refBeats = (prev, cards, last) => {
      const set = sigOf(cards, last); if (!set.size) return false;
      for (const s of set) {
        const [type, k, rank, short, n] = s.split('|'); const a = { type, k: +k, rank: +rank, short: short === '1', n: +n };
        let beat;
        if (!prev) beat = true;
        else if (a.type === 'bomb') beat = prev.type !== 'bomb' || a.rank > prev.rank;
        else beat = prev.type === a.type && prev.k === a.k && a.rank > prev.rank && (a.n === prev.n || (a.short && a.n < prev.n));
        if (beat) return a;
      }
      return false;
    };
    const mixes = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [2, 0, 0], [0, 2, 1], [1, 2, 1]];
    for (let gi = 0; gi < 330; gi++) {
      const lv = mixes[gi % mixes.length], rg = M.mulberry(7000 + gi), g = M.newGame(rg);
      const played = []; let n = 0; res.games++;
      while (g.winner < 0 && n++ < 500) {
        const pl = g.turn, hand = g.hands[pl].slice(), move = M.aiChoose(g, pl, lv[pl], rg);
        res.turns++;
        if (move) {
          const last = move.length === hand.length;
          if (move.some((c) => !hand.includes(c)) || new Set(move).size !== move.length) { bad('ai plays cards it does not hold'); break; }
          if (g.firstPlay && !move.includes(0)) { bad('first play without 3 of diamonds'); break; }
          const tc = g.table ? g.table.combo : null, rb = refBeats(tc, move, last);
          if (!rb) { bad('ai play is not a legal combination / does not beat the table: ' + move + ' on ' + JSON.stringify(tc)); break; }
          if (g.hands[(pl + 1) % 3].length === 1 && rb.type === 'single' && rb.rank !== Math.max(...hand.map((c) => c >> 2))) { bad('ai broke the one-card rule'); break; }
          const r = M.play(g, pl, move); if (!r.ok) { bad('play refused: ' + r.why); break; }
          played.push(...move); if (rb.type === 'bomb') res.bombs++; if (rb.short) res.lastShort++;
        } else {
          if (!g.table) { bad('ai passed while leading'); break; }
          if (M.legalPlays(g, pl).some((q) => q.combo.type !== 'bomb')) { bad('ai passed with a reply in hand'); break; }
          if (!M.pass(g, pl)) { bad('pass refused'); break; }
          res.passes++;
        }
        if (g.hands.flat().length + played.length !== 48) { bad('cards not conserved'); break; }
      }
      if (g.winner < 0) { bad('game did not end'); continue; }
      if (g.hands[g.winner].length !== 0 || g.hands.filter((h) => h.length === 0).length !== 1) bad('exactly the winner has no cards');
      const all = g.hands.flat().concat(played); if (new Set(all).size !== 48) bad('cards duplicated');
      const d = M.scoreGame(g); if (d.reduce((a, b) => a + b, 0) !== 0 || d[g.winner] <= 0) bad('score sum');
      if (d[g.winner] < g.hands.reduce((a, h) => a + h.length, 0)) bad('winner gets at least the cards left');
    }
    // strength: a hard player against two easy ones wins clearly more than a third of the games
    for (let gi = 0; gi < 240; gi++) {
      const rg = M.mulberry(31000 + gi), g = M.newGame(rg), lv = [2, 0, 0]; let n = 0;
      while (g.winner < 0 && n++ < 500) { const pl = g.turn, mv = M.aiChoose(g, pl, lv[pl], rg); if (mv) M.play(g, pl, mv); else M.pass(g, pl); }
      res.wins.games++; if (g.winner === 0) res.wins.hard++;
    }
    return res;
  });
  ok(R.bad.length === 0, `rules: ${R.keys} reference combinations, ${R.subsets} subsets, ${R.enumCases} brute-force hands (${R.enumPlays} plays), ${R.games} AI games / ${R.turns} turns / ${R.passes} passes / ${R.bombs} bombs / ${R.lastShort} short last plays${R.bad.length ? ' -> ' + R.bad.join(' | ') : ''}`);
  ok(R.keys > 20000 && R.bombs > 5 && R.passes > 500, 'the checks really covered combinations, bombs and passes');
  ok(R.wins.hard / R.wins.games > 0.5, `the hard level beats two easy players (${R.wins.hard} of ${R.wins.games})`);

  // ---------- 2. the screen ----------
  const seeds = await p.evaluate(async () => {
    const M = await import('/src/games/paodekuai-logic.ts'); const out = { mine: [], other: [] };
    for (let s = 1; s < 200 && (out.mine.length < 4 || out.other.length < 4); s++) { const g = M.newGame(M.mulberry(s)); (g.turn === 0 ? out.mine : out.other).push(s); }
    return out;
  });
  const st = () => p.evaluate(() => { const g = window.__pdk.game(); return { phase: window.__pdk.phase(), turn: g.turn, hand: g.hands[0].length, n1: g.hands[1].length, n2: g.hands[2].length, sel: window.__pdk.selected(), table: g.table && g.table.player, first: g.firstPlay, winner: g.winner }; });
  const cardPos = (id) => p.evaluate((id) => { const e = document.querySelector(`#pdk-hand .pdk-card[data-id="${id}"]`), r = e.getBoundingClientRect(), els = [...document.querySelectorAll('#pdk-hand .pdk-card')], i = els.indexOf(e); return { x: r.left + (i === els.length - 1 ? r.width / 2 : 6), y: r.top + r.height * 0.5, w: r.width, i }; }, id);
  const tapCard = async (id) => { const c = await cardPos(id); await p.mouse.click(c.x, c.y); };
  const myTurn = () => p.waitForFunction(() => { const x = window.__pdk; const g = x.game(); return x.phase() !== 'play' || g.turn === 0; }, null, { timeout: 8000 });
  const msgText = () => p.textContent('#pdk-msg');
  const setState = (fn, args) => p.evaluate(([src, a]) => { const g = window.__pdk.game(); new Function('g', 'a', src)(g, a); window.__pdk.refresh(); }, [fn.toString().replace(/^[^{]*\{|\}$/g, ''), args]);

  await p.screenshot({ path: OUT + 'paodekuai-ready.png' });
  ok(await p.locator('#pdk-ovl').isVisible() && (await p.textContent('#pdk-ovl h2')) === '跑得快' && (await p.textContent('#pdk-start')) === '开始', 'ready: the overlay with the name and the start button');
  ok((await p.textContent('#pdk-score0')) === '我：0' && (await p.textContent('#pdk-level')) === '难度：普通' && (await p.textContent('#pdk-best')) === '最高：0', 'ready: score pills, level button, best');
  ok(await p.locator('#pdk-play').isDisabled() && await p.locator('#pdk-pass').isDisabled(), 'before the start the play / pass buttons are off');
  // rules dialog
  await p.click('#pdk-rules'); ok(await p.locator('#pdk-rules-ovl').isVisible() && (await p.locator('#pdk-rules-ovl p').count()) >= 6, 'the rules dialog opens');
  await p.screenshot({ path: OUT + 'paodekuai-rules.png' });
  await p.keyboard.press('Escape'); ok(!(await p.locator('#pdk-rules-ovl').isVisible()), 'Esc closes the rules');
  await p.click('#pdk-rules'); await p.click('#pdk-rules-close'); ok(!(await p.locator('#pdk-rules-ovl').isVisible()), 'the close button closes the rules');
  // level button
  await p.click('#pdk-level'); ok((await p.textContent('#pdk-level')) === '难度：较难', 'level: normal -> hard');
  await p.click('#pdk-level'); ok((await p.textContent('#pdk-level')) === '难度：简单', 'level: hard -> easy');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).paodekuai.level)) === 0, 'the level is kept on this device');
  await p.click('#pdk-level'); // normal again
  await p.evaluate(() => window.__pdk.fast(true));

  // a deal where I lead: Enter starts
  await p.evaluate((s) => { window.__pdkSeed = s; }, seeds.mine[0]);
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Enter');
  await p.waitForSelector('#pdk-hand .pdk-card');
  let a = await st();
  ok(a.phase === 'play' && a.hand === 16 && a.n1 === 16 && a.n2 === 16 && a.turn === 0 && a.first, 'Enter starts: 16 cards each, I hold the 3 of diamonds and lead');
  ok((await p.locator('#pdk-hand .pdk-card').count()) === 16 && (await p.textContent('#pdk-n1')) === '16 张' && (await p.textContent('#pdk-n2')) === '16 张', '16 cards in the hand, the counts of both players are shown');
  ok((await msgText()).includes('方块 3') && await p.locator('#pdk-pass').isDisabled(), 'first-lead message; no pass when leading');
  const hand0 = await p.evaluate(() => window.__pdk.game().hands[0].slice());
  const ranks0 = await p.$$eval('#pdk-hand .pdk-card', (els) => els.map((e) => e.dataset.rank));
  ok(JSON.stringify(ranks0) === JSON.stringify(hand0.map((c) => ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'][c >> 2])), 'the hand is shown sorted with the right faces');
  // tap selects / unselects; the first play must include the 3 of diamonds
  const other = hand0.find((c) => c !== 0);
  await tapCard(other); a = await st(); ok(a.sel.length === 1 && a.sel[0] === other && await p.locator(`#pdk-hand .pdk-card[data-id="${other}"].sel`).count() === 1, 'a tap lifts a card');
  await p.click('#pdk-play');
  ok((await msgText()).includes('必须包含方块 3') && (await st()).turn === 0 && (await st()).hand === 16, 'a first play without the 3 of diamonds is refused with a message');
  await tapCard(other); ok((await st()).sel.length === 0, 'a second tap puts it back');
  // drag across cards selects a run, dragging back shrinks it
  const c2 = await cardPos(hand0[2]), c5 = await cardPos(hand0[5]), c3 = await cardPos(hand0[3]);
  await p.mouse.move(c2.x, c2.y); await p.mouse.down(); await p.mouse.move(c5.x, c5.y, { steps: 8 }); a = await st();
  ok(a.sel.length === 4 && [2, 3, 4, 5].every((i) => a.sel.includes(hand0[i])), 'dragging across cards selects them all (4)');
  await p.mouse.move(c3.x, c3.y, { steps: 5 }); a = await st(); ok(a.sel.length === 2, 'dragging back shrinks the selection (2)');
  await p.mouse.up();
  await p.click('#pdk-reset'); ok((await st()).sel.length === 0 && await p.locator('#pdk-reset').isDisabled(), 'Reset clears the selection');
  // a drag starting on a selected card un-selects
  await tapCard(hand0[7]); await tapCard(hand0[8]);
  const d7 = await cardPos(hand0[7]), d8 = await cardPos(hand0[8]);
  await p.mouse.move(d7.x, d7.y); await p.mouse.down(); await p.mouse.move(d8.x, d8.y, { steps: 4 }); await p.mouse.up(); a = await st();
  ok(a.sel.length === 0, 'a drag that starts on a selected card un-selects the cards it crosses');
  // hint: legal and cycling
  await p.click('#pdk-hint'); a = await st();
  ok(a.sel.length >= 1 && a.sel.includes(0), 'hint selects a legal first play (it includes the 3 of diamonds)');
  const hint1 = a.sel.join(); await p.click('#pdk-hint'); const hint2 = (await st()).sel.join();
  ok(hint1 !== hint2, 'a second hint shows another play');
  await p.click('#pdk-reset');
  // keyboard: arrows move the cursor, space toggles, enter plays
  await p.keyboard.press('End'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Home'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft');
  await p.keyboard.press(' '); a = await st(); ok(a.sel.length === 1 && a.sel[0] === 0, 'keyboard: the cursor is on the first card (the 3 of diamonds), Space selects it');
  await p.screenshot({ path: OUT + 'paodekuai-selected.png' });
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__pdk.game().plays[0] === 1);
  a = await st(); ok(a.hand === 15 && await p.locator('#pdk-t0 .pdk-card').count() === 1, 'Enter plays the selected card: 15 cards left, my lane shows it');
  ok((await p.$$eval('#pdk-hand .pdk-card', (e) => e.length)) === 15, 'the card left the hand');
  await myTurn(); a = await st();
  ok(a.turn === 0 || a.phase !== 'play', 'the computer players answer by themselves and the turn returns to me');

  // pass: a hand with nothing that beats the table
  await setState(function (g) { g.turn = 0; g.firstPlay = false; g.table = { player: 2, cards: [44], combo: { type: 'single', k: 1, n: 1, rank: 11, short: false } }; g.hands[0] = [0, 5, 9, 13]; g.hands[1] = [20, 21, 22, 23, 24]; g.hands[2] = [30, 31, 32, 33, 34, 35]; g.shown = [null, null, { cards: [44], combo: { type: 'single', k: 1, n: 1, rank: 11, short: false } }]; });
  ok(!(await p.locator('#pdk-pass').isDisabled()), 'nothing beats the ace: the pass button is on');
  await p.evaluate(() => window.__pdk.fast(false));
  await p.click('#pdk-pass');
  ok(await p.locator('#pdk-t0 .pdk-pass').count() === 1 && (await p.textContent('#pdk-t0 .pdk-pass')) === '不出' && (await st()).turn === 1, 'passing shows "不出" in my lane and moves on to the next player');
  await p.evaluate(() => window.__pdk.fast(true)); await myTurn();
  // must reply when able; the 报单 rule on the screen
  await setState(function (g) { g.turn = 0; g.firstPlay = false; g.table = null; g.shown = [null, null, null]; g.hands[0] = [4, 17, 30, 41]; g.hands[1] = [20]; g.hands[2] = [32, 33, 34, 35, 36]; g.plays = [1, 1, 1]; });
  ok((await p.textContent('#pdk-n1')) === '只剩一张！', 'a player with one card left is announced');
  await tapCard(4); await p.click('#pdk-play');
  ok((await msgText()).includes('最大') && (await st()).turn === 0 && (await st()).hand === 4, 'the one-card-left rule: a small single is refused with a message');
  await p.click('#pdk-reset'); await tapCard(41); await p.click('#pdk-play'); await p.waitForTimeout(30);
  a = await st(); ok(a.hand === 3, 'the biggest single is accepted');
  // a bomb is shown with its label
  await setState(function (g) { g.turn = 0; g.firstPlay = false; g.table = { player: 2, cards: [44], combo: { type: 'single', k: 1, n: 1, rank: 11, short: false } }; g.hands[0] = [8, 9, 10, 11, 21, 33]; g.hands[1] = [20, 22, 24]; g.hands[2] = [30, 31, 34, 35, 36]; g.shown = [null, null, { cards: [44], combo: { type: 'single', k: 1, n: 1, rank: 11, short: false } }]; });
  await p.evaluate(() => window.__pdk.fast(false));
  for (const id of [8, 9, 10, 11]) await tapCard(id);
  await p.click('#pdk-play');
  ok(await p.locator('#pdk-t0 .pdk-tag.bomb').count() === 1 && (await p.textContent('#pdk-t0 .pdk-tag')) === '炸弹', 'a bomb is played and labelled');
  await p.screenshot({ path: OUT + 'paodekuai-bomb.png' });
  await p.evaluate(() => window.__pdk.fast(true)); await myTurn();
  // win overlay: I play my last card
  await setState(function (g) { g.turn = 0; g.firstPlay = false; g.table = null; g.shown = [null, null, null]; g.hands[0] = [40]; g.hands[1] = [20, 22, 24, 26]; g.hands[2] = [30, 31, 34]; g.plays = [5, 2, 0]; g.bombs = 0; });
  await tapCard(40); await p.click('#pdk-play');
  await p.waitForSelector('#pdk-ovl:not([hidden])');
  a = await st(); ok(a.phase === 'over' && a.winner === 0, 'my last card ends the game');
  ok((await p.textContent('#pdk-ovl h2')) === '你赢了。' && (await p.textContent('#pdk-start')) === '再来一局', 'win overlay with "play again"');
  const sc = 4 + 3 * 2;
  ok((await p.textContent('#pdk-ovl p')).includes(String(sc)) && (await p.textContent('#pdk-score0')) === '我：' + sc && (await p.textContent('#pdk-score1')) === '小熊：-4' && (await p.textContent('#pdk-score2')) === '小兔：-6', `score: +${sc} for me, -4 and -6 for the others, the pills follow`);
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).paodekuai.best)) === sc && (await p.textContent('#pdk-best')) === '最高：' + sc, 'the best score is kept on this device');
  await p.screenshot({ path: OUT + 'paodekuai-win.png' });
  await p.click('#pdk-start'); a = await st();
  ok(a.phase === 'play' && a.hand === 16 && (await p.textContent('#pdk-best')) === '最高：' + sc, 'play again: a new deal, the best stays');
  // a loss: the computer wins
  await setState(function (g) { g.turn = 1; g.firstPlay = false; g.table = null; g.shown = [null, null, null]; g.hands[1] = [20]; g.hands[0] = [4, 8, 12]; g.plays = [1, 1, 1]; });
  await p.evaluate(() => window.__pdk.schedule());
  await p.waitForSelector('#pdk-ovl:not([hidden])');
  ok((await p.textContent('#pdk-ovl h2')) === '小熊赢了。' && (await p.evaluate(() => window.__pdk.totals()[0])) === sc - 3, 'the computer can win: "小熊赢了。" and I lose a point per card left');

  // ---------- full games through the real buttons, at three levels ----------
  const fullGame = async (lv) => {
    for (let i = 0; i < 3; i++) { const cur = await p.evaluate(() => window.__pdk.level()); if (cur === lv) break; await p.click('#pdk-level'); }
    await p.evaluate(() => { window.__pdkSeed = undefined; delete window.__pdkSeed; });
    await p.click('#pdk-start');
    let turns = 0, plays = 0, passes = 0;
    for (; turns < 120; turns++) {
      await myTurn(); a = await st(); if (a.phase !== 'play') break;
      if (!(await p.locator('#pdk-pass').isDisabled())) { await p.click('#pdk-pass'); passes++; continue; }
      await p.click('#pdk-hint');
      const before = a.hand; await p.click('#pdk-play');
      a = await st(); if (a.hand >= before && a.phase === 'play' && a.turn === 0) { await p.waitForTimeout(20); a = await st(); }
      plays++;
    }
    await p.waitForSelector('#pdk-ovl:not([hidden])', { timeout: 8000 });
    const end = await p.evaluate(() => { const g = window.__pdk.game(); return { winner: g.winner, hands: g.hands.map((h) => h.length), h2: document.querySelector('#pdk-ovl h2').textContent }; });
    return { lv, plays, passes, ...end };
  };
  for (const lv of [0, 1, 2]) {
    const r = await fullGame(lv);
    ok(r.winner >= 0 && r.hands[r.winner] === 0 && r.plays > 3 && /赢了/.test(r.h2), `a full game at level ${lv} through the buttons: ${r.plays} plays, ${r.passes} passes, winner seat ${r.winner}, "${r.h2}"`);
  }
  await p.screenshot({ path: OUT + 'paodekuai-over.png' });
  // a deal where somebody else leads: the computer plays first and includes the 3 of diamonds
  await p.evaluate((s) => { window.__pdkSeed = s; }, seeds.other[0]);
  await p.click('#pdk-start');
  await p.waitForFunction(() => window.__pdk.game().plays.some((x) => x > 0));
  const firstPlay = await p.evaluate(() => { const g = window.__pdk.game(); const q = g.shown.find((s) => s && s !== 'pass'); return q ? q.cards : []; });
  ok(firstPlay.includes(0), 'when the computer holds the 3 of diamonds it leads and plays it first');
  await p.evaluate(() => { delete window.__pdkSeed; });

  // ---------- 3. layout ----------
  const sizes = [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['wide', 1180, 820], ['side', 844, 390], ['ipadl', 1024, 768]];
  for (const [name, w, hgt] of sizes) {
    const s = await start(new Map(), { local: true, viewport: { width: w, height: hgt } });
    const q = s.page;
    await q.evaluate(() => (location.hash = '#/games/paodekuai')); await q.waitForSelector('#pdk-field');
    await q.evaluate((sd) => { window.__pdkSeed = sd; }, seeds.mine[1]); await q.click('#pdk-start'); await q.evaluate(() => window.__pdk.fast(true));
    await q.waitForSelector('#pdk-hand .pdk-card'); await q.waitForTimeout(250);
    // some cards on the table and a selection
    await q.evaluate(() => { const g = window.__pdk.game(); g.turn = 0; g.firstPlay = false; g.table = { player: 2, cards: [4, 8, 12, 16, 20, 24, 28], combo: { type: 'straight', k: 7, n: 7, rank: 7, short: false } }; g.shown = [{ cards: [5, 9, 13, 17, 21, 25, 29, 33, 37], combo: { type: 'straight', k: 9, n: 9, rank: 9, short: false } }, 'pass', { cards: [4, 8, 12, 16, 20, 24, 28], combo: { type: 'straight', k: 7, n: 7, rank: 7, short: false } }]; window.__pdk.refresh(); });
    await q.waitForTimeout(150);
    const hand = await q.evaluate(() => window.__pdk.game().hands[0]);
    const cp = await q.evaluate((id) => { const e = document.querySelector(`#pdk-hand .pdk-card[data-id="${id}"]`); const r = e.getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height / 2 }; }, hand[1]);
    await q.mouse.click(cp.x, cp.y); await q.waitForTimeout(200);
    const m = await q.evaluate(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const f = R(document.querySelector('#pdk-field')), vw = document.documentElement.clientWidth, vh = innerHeight;
      const cards = [...document.querySelectorAll('#pdk-hand .pdk-card')].map(R), lanes = [...document.querySelectorAll('.pdk-lane')].map(R);
      const minis = [...document.querySelectorAll('.pdk-lane .pdk-card')].map(R);
      const btns = [...document.querySelectorAll('.pdk-act, .pdk-hud .mopt')].map(R);
      const fieldIn = (b) => b.l >= f.l - 1 && b.r <= f.r + 1 && b.t >= f.t - 1 && b.b <= f.b + 1;
      const lefts = cards.map((c) => c.l), steps = lefts.slice(1).map((x, i) => x - lefts[i]);
      const hudR = R(document.querySelector('.pdk-hud')), btnsR = R(document.querySelector('.pdk-btns'));
      return { f, vw, vh, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, handIn: cards.every(fieldIn), lanesIn: lanes.every(fieldIn), minisIn: minis.every((b) => b.l >= f.l && b.r <= f.r && b.t >= f.t && b.b <= f.b), btnMin: Math.min(...[...document.querySelectorAll('.pdk-act')].map((e) => e.getBoundingClientRect().height)), btnsIn: btns.every((b) => b.l >= 0 && b.r <= vw && b.t >= 0 && b.b <= vh), minStep: Math.min(...steps), cw: cards[0].w, hudR, btnsR, n: cards.length, laneH: Math.min(...lanes.map((l) => l.h)), miniW: minis.length ? Math.min(...minis.map((b) => b.w)) : 0, side: document.querySelectorAll('.pdk-card.sel').length, lift: (() => { const sel = document.querySelector('#pdk-hand .pdk-card.sel'), other = document.querySelector('#pdk-hand .pdk-card:not(.sel)'); return sel && other ? other.getBoundingClientRect().top - sel.getBoundingClientRect().top : 0; })(), cardTop: Math.min(...cards.map((c) => c.t)), handBottom: Math.max(...cards.map((c) => c.b)), fieldBottom: f.b };
    });
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name} ${w}x${hgt}: no page scrolling`);
    ok(m.handIn && m.lanesIn && m.minisIn && m.btnsIn, `${name}: the hand, the lanes and the played cards are inside the board, the buttons on the screen`);
    ok(m.btnMin >= 40, `${name}: the action buttons are at least 40 px high (${Math.round(m.btnMin)})`);
    ok(m.minStep >= 13 && m.cw >= 30, `${name}: the fan shows at least 13 px of every card (step ${Math.round(m.minStep)}, card ${Math.round(m.cw)} px)`);
    ok(m.lift > 3 && m.side === 1, `${name}: a selected card is lifted (${Math.round(m.lift)} px)`);
    ok(m.miniW >= 20, `${name}: played cards are readable (${Math.round(m.miniW)} px wide)`);
    const gapL = m.f.l, gapR = m.vw - m.f.r;
    ok(Math.abs(gapL - gapR) <= 3, `${name}: the board is centred (${Math.round(gapL)} / ${Math.round(gapR)})`);
    if (name === 'side') ok(m.hudR.l - 0 > 4 && Math.abs((m.hudR.l) - (m.vw - m.btnsR.r)) <= 40 && m.btnsR.l >= m.f.r - 1, `${name}: the scores sit left and the buttons right of the board`);
    await q.screenshot({ path: OUT + `paodekuai-${name}.png` });
    await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-grid');
    ok(await q.evaluate(() => !window.__pdk), `${name}: leaving removes the hook`);
    ok(s.log.external.length === 0, `${name}: no outside request`);
    await s.browser.close();
  }

  // ---------- 4. English and French ----------
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [vn, vp] of [['phone', { width: 320, height: 568 }], ['side', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp }), q = s.page;
      await q.evaluate(() => (location.hash = '#/games/paodekuai')); await q.waitForSelector('#pdk-field');
      const tapNth = async (n) => { const pos = await q.evaluate((n) => { const els = [...document.querySelectorAll('#pdk-hand .pdk-card')], r = els[n - 1].getBoundingClientRect(); return { x: r.left + (n === els.length ? r.width / 2 : 6), y: r.top + r.height / 2 }; }, n); await q.mouse.click(pos.x, pos.y); };
      const text = () => q.evaluate(() => document.querySelector('.pdk-wrap').innerText + '\n' + document.querySelector('.gm-hero, header')?.innerText);
      const bad = [];
      const look = async (tag) => { const tx = await text(); if (CJK.test(tx)) bad.push(tag + ': ' + (tx.match(/[^\n]*[一-鿿][^\n]*/g) || []).join(' / ')); };
      await look('ready'); const cardName = await q.textContent('.pdk-ovl h2');
      await q.click('#pdk-rules'); await look('rules'); await q.click('#pdk-rules-close');
      await q.evaluate((sd) => { window.__pdkSeed = sd; }, seeds.mine[2]); await q.click('#pdk-start'); await q.evaluate(() => window.__pdk.fast(true)); await q.waitForSelector('#pdk-hand .pdk-card');
      await look('first lead');
      await tapNth(2); await q.click('#pdk-play'); await look('refused play');
      await q.click('#pdk-reset'); await q.click('#pdk-hint'); await look('hint'); await q.click('#pdk-play'); await q.waitForTimeout(100); await look('after a play');
      await q.evaluate(() => { const g = window.__pdk.game(); g.turn = 0; g.firstPlay = false; g.table = null; g.shown = [null, null, null]; g.hands[0] = [8, 9, 10, 11, 21, 33]; g.hands[1] = [20]; window.__pdk.refresh(); });
      await look('one card left'); await tapNth(5); await q.click('#pdk-play'); await look('one-card rule');
      await q.evaluate(() => { const g = window.__pdk.game(); g.turn = 0; g.table = { player: 2, cards: [44], combo: { type: 'single', k: 1, n: 1, rank: 11, short: false } }; g.hands[0] = [0, 5, 9, 13]; g.shown = [null, null, { cards: [44], combo: { type: 'single', k: 1, n: 1, rank: 11, short: false } }]; window.__pdk.refresh(); });
      await q.click('#pdk-pass'); await look('pass');
      await q.evaluate(() => { const g = window.__pdk.game(); g.turn = 0; g.table = null; g.shown = [{ cards: [8, 9, 10, 11], combo: { type: 'bomb', k: 1, n: 4, rank: 2, short: false }, }, 'pass', { cards: [4, 5, 6, 7, 20], combo: { type: 'triple', k: 1, n: 5, rank: 1, short: false } }]; g.hands[0] = [40]; g.hands[1] = [20, 22]; g.hands[2] = [30, 31]; window.__pdk.refresh(); }); await look('labels');
      await tapNth(1); await q.click('#pdk-play'); await q.waitForSelector('#pdk-ovl:not([hidden])'); await look('win');
      await q.screenshot({ path: OUT + `paodekuai-${name}-${vn}.png` });
      ok(bad.length === 0 && !CJK.test(cardName), `${name} ${vn}: no Chinese left in any state of the game (name "${cardName}")${bad.length ? ' -> ' + bad.join(' | ') : ''}`);
      const wrapped = await q.evaluate(() => [...document.querySelectorAll('.pdk-stat, .pdk-hud .mopt, .pdk-act, .pdk-name, .pdk-count')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.textContent));
      ok(wrapped.length === 0, `${name} ${vn}: no label is cut off${wrapped.length ? ' -> ' + wrapped : ''}`);
      await s.browser.close();
    }
  }

  // ---------- 5. real touch: drag across cards at dpr 2 ----------
  {
    const s = await start(new Map(), { local: true, touch: true, dpr: 2, viewport: { width: 390, height: 844 } }), q = s.page;
    await q.evaluate(() => (location.hash = '#/games/paodekuai')); await q.waitForSelector('#pdk-field');
    await q.evaluate((sd) => { window.__pdkSeed = sd; }, seeds.mine[3]); await q.tap('#pdk-start'); await q.evaluate(() => window.__pdk.fast(true)); await q.waitForSelector('#pdk-hand .pdk-card');
    const cdp = await q.context().newCDPSession(q);
    const pos = (i) => q.evaluate((i) => { const r = [...document.querySelectorAll('#pdk-hand .pdk-card')][i].getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height * 0.5 }; }, i);
    const sel = () => q.evaluate(() => window.__pdk.selected().length);
    const a0 = await pos(3), a1 = await pos(8);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a0] });
    for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a0.x + (a1.x - a0.x) * k / 8, y: a0.y }] });
    await q.waitForTimeout(150); const mid = await sel();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok(mid === 6 && (await sel()) === 6, `a finger dragged over cards 4..9 selects them (${mid})`);
    const sy = await q.evaluate(() => window.scrollY);
    ok(sy === 0, 'the drag did not scroll the page');
    const b0 = await pos(5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [b0] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok((await sel()) === 5, 'a finger tap on a selected card puts it back');
    await q.tap('#pdk-reset'); ok((await sel()) === 0, 'Reset by tap');
    ok(s.log.external.length === 0, 'touch session: no outside request');
    await s.browser.close();
  }

  // ---------- leaving ----------
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  ok(await p.evaluate(() => !window.__pdk), 'leaving the game removes the hook');
  await p.keyboard.press('Enter'); await p.keyboard.press('ArrowLeft');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();
  await done();
})();
