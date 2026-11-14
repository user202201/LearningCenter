// Dou Dizhu: the pure rules (classifier against an independent constructive reference, beats, the enumerator against brute force, bidding, scoring, 300+ computer-vs-computer games)
// and the screen (deal, bid, tap / drag / key selection, play, pass, hint, a game to its end, win / lose / spring overlays, best score, 5 sizes, EN / FR, real touch, offline).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

// card ids: rank r (3..15) of suit k -> (r - 3) + 13 k; 16 / 17 = the jokers 52 / 53
const card = (r, k = 0) => (r >= 16 ? 52 + (r - 16) : r - 3 + 13 * k);
const rk = (id) => (id < 52 ? 3 + (id % 13) : 16 + id - 52);
const sortDesc = (cs) => cs.slice().sort((a, b) => rk(b) - rk(a) || a - b);
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/doudizhu')); await p.waitForSelector('#dz-stage');

  // ================================================================ 1. the rules
  const R = await p.evaluate(async () => {
    const M = await import('/src/games/doudizhu-logic.ts');
    const res = { bad: [], info: {} };
    const bad = (m) => { if (res.bad.length < 40) res.bad.push(m); };
    let seed = 987654; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const rint = (n) => Math.floor(rng() * n);
    const rk = (id) => (id < 52 ? 3 + (id % 13) : 16 + id - 52);
    // ---- an independent reference: every legal rank-count vector built from the written rules
    const rankId = (r, k) => (r >= 16 ? 52 + r - 16 : r - 3 + 13 * k);
    const key = (v) => v.slice(3, 18).join('');
    const ref = new Map();            // key -> [meta]
    const addRef = (v, type, rank, len) => {
      const n = v.reduce((a, b) => a + b, 0); if (n > 20) return;
      const k = key(v); const m = { type, rank, len, n };
      const arr = ref.get(k) || []; if (!arr.some((x) => x.type === type && x.rank === rank && x.len === len)) arr.push(m); ref.set(k, arr);
    };
    const V = () => new Array(18).fill(0);
    for (let r = 3; r <= 17; r++) { const v = V(); v[r] = 1; addRef(v, 'single', r, 1); }
    for (let r = 3; r <= 15; r++) {
      let v = V(); v[r] = 2; addRef(v, 'pair', r, 1);
      v = V(); v[r] = 3; addRef(v, 'triple', r, 1);
      v = V(); v[r] = 4; addRef(v, 'bomb', r, 1);
      for (let w = 3; w <= 17; w++) if (w !== r) { v = V(); v[r] = 3; v[w] = 1; addRef(v, 'triple1', r, 1); }
      for (let w = 3; w <= 15; w++) if (w !== r) { v = V(); v[r] = 3; v[w] = 2; addRef(v, 'triple2', r, 1); }
    }
    { const v = V(); v[16] = 1; v[17] = 1; addRef(v, 'rocket', 17, 1); }
    for (let s = 3; s <= 14; s++) for (let len = 5; s + len - 1 <= 14; len++) { const v = V(); for (let r = s; r < s + len; r++) v[r] = 1; addRef(v, 'straight', s, len); }
    for (let s = 3; s <= 14; s++) for (let len = 3; s + len - 1 <= 14; len++) { const v = V(); for (let r = s; r < s + len; r++) v[r] = 2; addRef(v, 'pairs', s, len); }
    const multisets = (avail, k, cb) => {       // every multiset of k singles from avail, the two jokers never together
      const w = V();
      const rec = (r, left) => {
        if (left === 0) { if (!(w[16] && w[17])) cb(w.slice()); return; }
        if (r > 17) return;
        for (let c = Math.min(avail[r], left); c >= 0; c--) { w[r] = c; rec(r + 1, left - c); }
        w[r] = 0;
      };
      rec(3, k);
    };
    for (let s = 3; s <= 14; s++) for (let k = 2; s + k - 1 <= 14 && 3 * k <= 20; k++) {
      const core = V(); for (let r = s; r < s + k; r++) core[r] = 3;
      addRef(core, 'plane', s, k);
      const avail = V(); for (let r = 3; r <= 17; r++) avail[r] = (r >= 16 ? 1 : 4) - core[r];
      if (4 * k <= 20) multisets(avail, k, (w) => { const v = core.map((x, i) => x + w[i]); addRef(v, 'plane1', s, k); });
      if (5 * k <= 20) {
        const ranks = []; for (let r = 3; r <= 15; r++) if (avail[r] >= 2) ranks.push(r);
        const pick = (i, left, w) => { if (left === 0) { addRef(core.map((x, j) => x + w[j]), 'plane2', s, k); return; } if (ranks.length - i < left) return; w[ranks[i]] = 2; pick(i + 1, left - 1, w); w[ranks[i]] = 0; pick(i + 1, left, w); };
        pick(0, k, V());
      }
    }
    for (let r = 3; r <= 15; r++) {
      const avail = V(); for (let x = 3; x <= 17; x++) avail[x] = x === r ? 0 : (x >= 16 ? 1 : 4);
      multisets(avail, 2, (w) => { const v = w.slice(); v[r] = 4; addRef(v, 'four2', r, 1); });
      for (let a = 3; a <= 15; a++) for (let b = a + 1; b <= 15; b++) if (a !== r && b !== r) { const v = V(); v[r] = 4; v[a] = 2; v[b] = 2; addRef(v, 'four22', r, 1); }
    }
    res.info.refSize = ref.size;
    const vecOf = (cards) => { const v = V(); for (const c of cards) v[c < 52 ? 3 + (c % 13) : 16 + c - 52]++; return v; };
    const cardsOfVec = (v) => { const out = []; for (let r = 3; r <= 17; r++) for (let i = 0; i < v[r]; i++) out.push(rankId(r, i)); return out; };
    const vecFromKey = (k) => { const v = V(); for (let i = 0; i < 15; i++) v[3 + i] = Number(k[i]); return v; };

    // (a) completeness: every reference vector is recognised, with the right meta when unambiguous
    let amb = 0;
    for (const [k, metas] of ref) {
      const cards = cardsOfVec(vecFromKey(k));
      const c = M.classify(cards);
      if (!c) { bad('not recognised: ' + k + ' ' + metas[0].type); continue; }
      if (c.n !== cards.length) bad('n wrong ' + k);
      const hit = metas.some((m) => m.type === c.type && m.rank === c.rank && m.len === c.len);
      if (!hit) bad('meta mismatch ' + k + ' got ' + c.type + '/' + c.rank + '/' + c.len + ' want ' + metas.map((m) => m.type + '/' + m.rank + '/' + m.len).join('|'));
      if (metas.length > 1) amb++;
    }
    res.info.ambiguous = amb;
    // (b) no false positives: random sets and mutations of legal ones
    const deck = Array.from({ length: 54 }, (_, i) => i);
    const draw = (n) => { const d = deck.slice(); for (let i = d.length - 1; i > 0; i--) { const j = rint(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d.slice(0, n); };
    const keys = [...ref.keys()];
    let tested = 0, accepted = 0;
    const same = (cards) => { const c = M.classify(cards); const inRef = ref.has(key(vecOf(cards))); tested++; if (c) accepted++; if (!!c !== inRef) bad('classify ' + (c ? c.type : 'null') + ' but reference says ' + inRef + ' for ' + vecOf(cards).slice(3).join('')); };
    for (let i = 0; i < 20000; i++) {
      const n = 1 + rint(i % 3 === 0 ? 20 : 8);
      let cards;
      if (i % 4 === 0) cards = draw(n);
      else {                                         // a legal set with a card added / removed / swapped
        const v = vecFromKey(keys[rint(keys.length)]); cards = cardsOfVec(v);
        const mode = rint(4);
        if (mode === 1 && cards.length) cards.splice(rint(cards.length), 1);
        else if (mode === 2 && cards.length < 20) { const extra = deck.filter((c) => !cards.includes(c)); cards.push(extra[rint(extra.length)]); }
        else if (mode === 3 && cards.length) { const extra = deck.filter((c) => !cards.includes(c)); cards[rint(cards.length)] = extra[rint(extra.length)]; }
      }
      if (cards.length) same(cards);
    }
    // the neighbourhood of a few hand-made sets
    const hand = [[3, 4, 5, 6, 7], [3, 4, 5, 6], [10, 11, 12, 13, 14], [11, 12, 13, 14, 15], [3, 3, 4, 4, 5, 5], [3, 3, 4, 4], [3, 3, 3, 4, 4, 4], [3, 3, 3, 4, 4, 4, 5, 6], [3, 3, 3, 4, 4, 4, 5, 5, 6, 6], [3, 3, 3, 3, 4, 5], [3, 3, 3, 3, 4, 4, 5, 5], [14, 14, 14, 15, 15, 15], [3, 3, 3, 5, 5, 5], [16, 17], [16, 17, 3, 3, 3, 3]];
    for (const hs of hand) { const used = {}; const cs = hs.map((r) => { used[r] = (used[r] || 0); return rankId(r, used[r]++); }); same(cs); }
    res.info.tested = tested; res.info.accepted = accepted;
    // the checker itself can fail: a classifier that also accepts any two cards is caught
    let caught = 0;
    for (let i = 0; i < 400; i++) { const cs = draw(2); const c = M.classify(cs) || { type: 'pair' }; if (!!c !== ref.has(key(vecOf(cs)))) caught++; }
    res.info.mutantCaught = caught;

    // (c) beats against the reference (unambiguous keys only): same type and length and a higher rank; bombs and the rocket
    let bt = 0;
    const unamb = keys.filter((k) => ref.get(k).length === 1);
    for (let i = 0; i < 30000; i++) {
      const ka = unamb[rint(unamb.length)], kb = rint(5) === 0 ? ka : unamb[rint(unamb.length)];
      const ma = ref.get(ka)[0], mb = ref.get(kb)[0];
      const a = M.classify(cardsOfVec(vecFromKey(ka))), b = M.classify(cardsOfVec(vecFromKey(kb)));
      let want;
      if (ma.type === 'rocket') want = true;
      else if (mb.type === 'rocket') want = false;
      else if (ma.type === 'bomb') want = mb.type !== 'bomb' || ma.rank > mb.rank;
      else if (mb.type === 'bomb') want = false;
      else want = ma.type === mb.type && ma.len === mb.len && ma.n === mb.n && ma.rank > mb.rank;
      bt++;
      if (M.beats(a, b) !== want) bad('beats ' + ma.type + ma.rank + ' vs ' + mb.type + mb.rank);
    }
    if (!M.beats(M.classify([card(5)]), null)) bad('a free lead is always allowed');
    function card(r) { return rankId(r, 0); }
    res.info.beatsTested = bt;

    // (d) the enumerator against brute force on small hands (every subset classified), free lead and against a table
    const subsetsKeys = (hand, table) => {
      const out = new Set(); const n = hand.length;
      for (let m = 1; m < (1 << n); m++) {
        const cs = []; for (let i = 0; i < n; i++) if (m & (1 << i)) cs.push(hand[i]);
        const c = M.classify(cs); if (c && M.beats(c, table)) out.add(key(vecOf(cs)));
      }
      return out;
    };
    let enumTests = 0, lowChecked = 0;
    const structured = () => {              // a hand with pairs, triples, runs and a bomb now and then
      const n = 5 + rint(9); const h = [];
      const pool = [];
      for (let i = 0; i < 3 + rint(3); i++) { const r = 3 + rint(13); const c = 1 + rint(4); for (let k = 0; k < c; k++) pool.push(rankId(r, k)); }
      if (rint(4) === 0) { pool.push(52); pool.push(53); }
      if (rint(3) === 0) { const s = 3 + rint(6); for (let r = s; r < s + 5; r++) pool.push(rankId(r, 1)); }
      const uniq = [...new Set(pool)]; for (let i = uniq.length - 1; i > 0; i--) { const j = rint(i + 1); [uniq[i], uniq[j]] = [uniq[j], uniq[i]]; }
      return uniq.slice(0, n);
    };
    for (let i = 0; i < 260; i++) {
      const hnd = i % 2 ? structured().slice(0, 13) : draw(5 + rint(8));
      let table = null;
      if (i % 3) { const k = keys[rint(keys.length)]; table = M.classify(cardsOfVec(vecFromKey(k))); }
      const want = subsetsKeys(hnd, table);
      const got = M.plays(hnd, table);
      const gotKeys = new Set(got.map((c) => key(vecOf(c))));
      if (got.length !== gotKeys.size) bad('enumerator lists a play twice');
      for (const c of got) {
        if (new Set(c).size !== c.length || c.some((x) => !hnd.includes(x))) bad('a play uses cards that are not in the hand');
        const cb = M.classify(c); if (!cb || !M.beats(cb, table)) bad('an enumerated play is not legal');
      }
      for (const k of want) if (!gotKeys.has(k)) { bad('a legal play is missing: ' + k + ' table ' + (table && table.type)); break; }
      for (const k of gotKeys) if (!want.has(k)) { bad('an extra play: ' + k); break; }
      const low = M.plays(hnd, table, { lowWings: true });
      for (const c of low) if (!gotKeys.has(key(vecOf(c)))) bad('a lowWings play is not in the full list');
      if ((low.length === 0) !== (got.length === 0)) bad('lowWings is empty although a play exists (or the other way round)');
      lowChecked += low.length; enumTests++;
    }
    res.info.enumTests = enumTests; res.info.lowChecked = lowChecked;
    // a long hand (20 cards): the enumerator is fast and every play is legal
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) { const hnd = structured().concat(draw(20)).filter((x, j, a) => a.indexOf(x) === j).slice(0, 20); for (const c of M.plays(hnd, null)) if (!M.classify(c)) bad('long hand: illegal play'); }
    res.info.longMs = Math.round(performance.now() - t0);

    // (e) dealing, bidding, scoring
    const d = M.newDeal(M.mulberry(5), 1);
    const all = d.hands.flat().concat(d.bottom);
    if (new Set(all).size !== 54 || d.hands.some((h) => h.length !== 17) || d.bottom.length !== 3) bad('deal: 54 different cards, 17 + 17 + 17 + 3');
    if (d.turn !== 1 || d.phase !== 'bid') bad('the bidding starts with the chosen seat');
    for (const h of d.hands) for (let i = 1; i < h.length; i++) if (M.rankOf(h[i - 1]) < M.rankOf(h[i])) bad('hands are sorted high to low');
    let s = M.newDeal(M.mulberry(6), 0);
    if (M.bid(s, 1, 1) !== 'illegal') bad('bidding out of turn');
    if (M.bid(s, 0, 4) !== 'illegal') bad('bid 4');
    if (M.bid(s, 0, 1) !== 'ok' || s.turn !== 1 || s.high !== 1) bad('bid 1');
    if (M.bid(s, 1, 1) !== 'illegal' || M.bid(s, 1, 0) !== 'ok') bad('a bid must be higher; passing is allowed');
    if (M.bid(s, 2, 2) !== 'landlord' || s.high !== 2 || s.highBy !== 2 || s.landlord !== 2) bad('the third bid ends the bidding: 2 wins');
    s = M.newDeal(M.mulberry(6), 0); M.bid(s, 0, 1); M.bid(s, 1, 0);
    const r3 = M.bid(s, 2, 0);
    if (r3 !== 'landlord' || s.landlord !== 0 || s.hands[0].length !== 20 || s.phase !== 'play' || s.turn !== 0) bad('all bids made: the highest bidder (1) is the landlord, 20 cards, leads');
    if (!s.bottom.every((c) => s.hands[0].includes(c))) bad('the landlord holds the bottom cards');
    s = M.newDeal(M.mulberry(7), 2);
    M.bid(s, 2, 1); if (M.bid(s, 0, 3) !== 'landlord' || s.landlord !== 0 || s.hands[0].length !== 20) bad('a bid of 3 ends the bidding at once');
    s = M.newDeal(M.mulberry(8), 0); M.bid(s, 0, 0); M.bid(s, 1, 0);
    if (M.bid(s, 2, 0) !== 'redeal') bad('three passes = a new deal');
    s = M.newDeal(M.mulberry(9), 0); M.bid(s, 0, 2); M.bid(s, 1, 3);
    if (s.landlord !== 1 || s.high !== 3) bad('3 beats 2');

    // scripted play
    const mk = (hands, landlord) => { const st = M.newDeal(M.mulberry(1), 0); st.hands = hands.map((h) => M.sortCards(h)); st.bottom = []; st.phase = 'play'; st.landlord = landlord; st.turn = landlord; st.high = 2; st.highBy = landlord; return st; };
    s = mk([[rankId(3, 0), rankId(3, 1), rankId(9, 0)], [rankId(4, 0), rankId(5, 0), rankId(6, 0), rankId(7, 0), rankId(8, 0), rankId(5, 1)], [rankId(10, 0), rankId(10, 1), rankId(11, 0)]], 0);
    if (M.pass(s, 0)) bad('no passing on a free lead');
    if (M.play(s, 1, [rankId(4, 0)]).ok) bad('playing out of turn');
    if (M.play(s, 0, [rankId(3, 0), rankId(9, 0)]).ok) bad('two different cards are not a combination');
    if (M.play(s, 0, [rankId(11, 3)]).ok) bad('cards not in the hand');
    if (M.play(s, 0, [rankId(3, 0), rankId(3, 0)]).ok) bad('the same card twice');
    if (!M.play(s, 0, [rankId(3, 0), rankId(3, 1)]).ok || s.turn !== 1) bad('a pair');
    if (M.play(s, 1, [rankId(4, 0)]).ok) bad('a single does not beat a pair');
    if (!M.pass(s, 1) || s.turn !== 2) bad('pass');
    if (M.play(s, 2, [rankId(10, 0), rankId(10, 1)]).ok !== true || s.turn !== 0) bad('a higher pair beats it');
    if (!M.pass(s, 0) || !M.pass(s, 1) || s.table !== null || s.turn !== 2) bad('two passes: the table clears and the last player leads again');
    if (M.pass(s, 2)) bad('the leader may not pass');
    if (M.play(s, 2, [rankId(11, 0)]).over !== true || s.phase !== 'over' || s.winner !== 2) bad('playing the last card ends the game');
    // bombs and the rocket count; spring and anti-spring
    s = mk([[rankId(3, 0), rankId(13, 0), 52, 53], [rankId(5, 0), rankId(5, 1), rankId(5, 2), rankId(5, 3), rankId(8, 0), rankId(6, 0)], [rankId(9, 0), rankId(9, 1)]], 0);
    M.play(s, 0, [52, 53]); if (s.bombs !== 1) bad('rocket counts as a bomb');
    M.pass(s, 1); M.pass(s, 2);
    M.play(s, 0, [rankId(3, 0)]);
    if (M.play(s, 1, [rankId(5, 0), rankId(5, 1), rankId(5, 2), rankId(5, 3)]).ok !== true || s.bombs !== 2) bad('a bomb beats a single and counts');
    M.pass(s, 2); M.pass(s, 0);
    M.play(s, 1, [rankId(8, 0)]); M.pass(s, 2);
    if (M.play(s, 0, [rankId(13, 0)]).over !== true) bad('the landlord went out');
    if (s.spring !== 0 || M.multiplier(s) !== 4 || M.finalScore(s) !== 8 || !M.landlordWon(s) || !M.sideWon(s, 0) || M.sideWon(s, 1)) bad('score: base 2 x 4 (two bombs), sides');
    s = mk([[rankId(3, 0), rankId(4, 0)], [rankId(5, 0), rankId(6, 0), rankId(7, 0)], [rankId(9, 0), rankId(9, 1), rankId(10, 0)]], 0);
    M.play(s, 0, [rankId(3, 0)]); M.pass(s, 1); M.pass(s, 2); M.play(s, 0, [rankId(4, 0)]);
    if (s.spring !== 1 || M.multiplier(s) !== 2 || M.finalScore(s) !== 4) bad('spring: the peasants played nothing, x2');
    s = mk([[rankId(3, 0), rankId(4, 0), rankId(6, 0)], [rankId(5, 0), rankId(11, 0)], [rankId(9, 0), rankId(10, 0)]], 0);
    M.play(s, 0, [rankId(3, 0)]); M.play(s, 1, [rankId(11, 0)]);
    M.pass(s, 2); M.pass(s, 0); M.play(s, 1, [rankId(5, 0)]);
    if (s.winner !== 1 || s.spring !== 2 || M.multiplier(s) !== 2 || M.landlordWon(s) || !M.sideWon(s, 2) || M.sideWon(s, 0)) bad('anti-spring: the landlord played once, peasants win, x2');
    s = mk([[rankId(3, 0), rankId(4, 0), rankId(6, 0)], [rankId(5, 0), rankId(11, 0)], [rankId(9, 0), rankId(10, 0)]], 0);
    M.play(s, 0, [rankId(3, 0)]); M.play(s, 1, [rankId(11, 0)]); M.pass(s, 2); M.play(s, 0, [rankId(4, 0)]);   // the landlord plays twice
    M.pass(s, 1); M.pass(s, 2); M.play(s, 0, [rankId(6, 0)]);
    if (s.spring !== 0) bad('no spring when a peasant played');

    // (f) the computer players: whole games, three levels and mixed
    const played = (list) => list.reduce((a, b) => a + b.length, 0);
    const simGame = (sd, levels) => {
      const r = M.mulberry(sd);
      let st = M.newDeal(r), redeals = 0;
      while (st.phase === 'bid') {
        const seat = st.turn, v = M.aiBid(st.hands[seat], st.high, levels[seat], r), res2 = M.bid(st, seat, v);
        if (res2 === 'illegal') { bad('the computer made an illegal bid'); return null; }
        if (res2 === 'redeal') { redeals++; st = M.newDeal(r, (st.first + 1) % 3); }
      }
      const log = [], out = [];
      let guard = 0;
      while (st.phase === 'play' && guard++ < 700) {
        const seat = st.turn;
        const cards = M.aiPlay(st, seat, levels[seat], r);
        if (cards === null) {
          if (!M.canPass(st, seat)) { bad('the computer passed on a free lead'); return null; }
          M.pass(st, seat); log.push({ seat, pass: true });
        } else {
          const before = st.table;
          const c = M.classify(cards);
          if (!c) { bad('the computer played an illegal shape'); return null; }
          if (!ref.has(key(vecOf(cards)))) bad('the computer played something the reference does not know');
          if (before && before.by !== seat && !M.beats(c, before.combo)) { bad('the computer played a play that does not beat the table'); return null; }
          const res2 = M.play(st, seat, cards);
          if (!res2.ok) { bad('the computer play was refused: ' + res2.why); return null; }
          log.push({ seat, cards, type: c.type }); out.push(cards);
        }
        const total = st.hands.reduce((a, h) => a + h.length, 0) + played(out);
        if (total !== 54) { bad('cards were lost or made: ' + total); return null; }
      }
      if (st.phase !== 'over') { bad('a game did not end'); return null; }
      const all2 = st.hands.flat().concat(out.flat());
      if (new Set(all2).size !== 54) bad('a card exists twice');
      if (st.hands[st.winner].length !== 0) bad('the winner still holds cards');
      const bombs = log.filter((e) => e.cards && ((e.cards.length === 4 && new Set(e.cards.map(rk)).size === 1) || (e.cards.length === 2 && e.cards.every((x) => x >= 52)))).length;
      if (bombs !== st.bombs) bad('bombs counted ' + st.bombs + ' vs ' + bombs);
      const l = st.landlord, np = (seat) => log.filter((e) => e.seat === seat && e.cards).length;
      const lw = st.winner === l;
      const spring = lw ? (np((l + 1) % 3) === 0 && np((l + 2) % 3) === 0 ? 1 : 0) : (np(l) === 1 ? 2 : 0);
      if (spring !== st.spring) bad('spring recomputed ' + spring + ' vs ' + st.spring);
      const mult = Math.pow(2, bombs) * (spring ? 2 : 1);
      if (M.multiplier(st) !== mult || M.finalScore(st) !== Math.max(1, st.high) * mult) bad('score recomputed');
      if (st.high < 1 || st.high > 3) bad('the base bid is 1..3');
      return { winner: st.winner, landlord: l, moves: log.length, bombs, spring, redeals, high: st.high };
    };
    const stats = { games: 0, moves: 0, bombs: 0, springs: 0, redeals: 0, landlordWins: 0 };
    const perLevel = {};
    for (const lv of [1, 2, 3]) {
      perLevel[lv] = { n: 0, lw: 0, moves: 0 };
      for (let g = 0; g < 100; g++) {
        const r = simGame(1000 * lv + g, [lv, lv, lv]); if (!r) continue;
        stats.games++; stats.moves += r.moves; stats.bombs += r.bombs; stats.springs += r.spring ? 1 : 0; stats.redeals += r.redeals; if (r.winner === r.landlord) stats.landlordWins++;
        perLevel[lv].n++; perLevel[lv].lw += r.winner === r.landlord ? 1 : 0; perLevel[lv].moves += r.moves;
      }
    }
    for (let g = 0; g < 60; g++) { const r = simGame(9000 + g, [1 + rint(3), 1 + rint(3), 1 + rint(3)]); if (r) { stats.games++; stats.moves += r.moves; } }
    // a hard pair against an easy player: the hard players win more often
    let easyWins = 0, hardWins = 0, strengthGames = 0;
    for (let g = 0; g < 240; g++) {
      const levels = [1, 3, 3]; const r2 = M.mulberry(40000 + g);
      let st = M.newDeal(r2, g % 3);
      while (st.phase === 'bid') { const seat = st.turn, v = M.aiBid(st.hands[seat], st.high, levels[seat], r2), x = M.bid(st, seat, v); if (x === 'redeal') st = M.newDeal(r2, (st.first + 1) % 3); }
      let guard = 0;
      while (st.phase === 'play' && guard++ < 700) { const seat = st.turn, cs = M.aiPlay(st, seat, levels[seat], r2); if (cs) M.play(st, seat, cs); else M.pass(st, seat); }
      if (st.phase !== 'over') continue;
      strengthGames++;
      if (M.sideWon(st, 0)) easyWins++;
      for (const seat of [1, 2]) if (M.sideWon(st, seat)) hardWins += 0.5;
    }
    res.info.strength = { easy: easyWins / strengthGames, hard: hardWins / strengthGames };
    res.info.stats = stats; res.info.perLevel = perLevel;
    // hints: a legal play that beats the table, the smallest first
    s = mk([[rankId(3, 0), rankId(7, 0), rankId(9, 0), rankId(15, 0)], [rankId(8, 0)], [rankId(4, 0)]], 0);
    M.play(s, 0, [rankId(7, 0)]); M.pass(s, 1); M.pass(s, 2);
    s.table = { by: 1, combo: M.classify([rankId(8, 0)]), cards: [rankId(8, 0)] }; s.turn = 0; s.hands[0] = M.sortCards([rankId(3, 0), rankId(7, 1), rankId(9, 0), rankId(15, 0)]);
    const hp = M.hintPlays(s, 0, M.mulberry(1));
    if (!hp.length || hp[0].length !== 1 || M.rankOf(hp[0][0]) !== 9) bad('the hint is the smallest card that beats the table');
    if (hp.some((c) => !M.beats(M.classify(c), s.table.combo))) bad('every hint beats the table');
    s.table = { by: 1, combo: M.classify([52, 53]), cards: [52, 53] };
    if (M.hintPlays(s, 0, M.mulberry(1)).length !== 0) bad('nothing beats the rocket');
    return res;
  });
  console.log('rules info: ' + JSON.stringify(R.info));
  ok(R.bad.length === 0, 'the rules: no problem found' + (R.bad.length ? ': ' + R.bad.join(' | ') : ''));
  ok(R.info.refSize > 50000, 'the reference lists ' + R.info.refSize + ' legal rank vectors');
  ok(R.info.tested >= 20000 && R.info.accepted > 3000 && R.info.accepted < R.info.tested, 'the classifier agrees with the reference on ' + R.info.tested + ' sets (' + R.info.accepted + ' legal)');
  ok(R.info.mutantCaught > 100, 'the comparison fails on a classifier that accepts any two cards: ' + R.info.mutantCaught);
  ok(R.info.beatsTested >= 30000, 'beats agrees with the reference on ' + R.info.beatsTested + ' pairs');
  ok(R.info.enumTests === 260 && R.info.lowChecked > 500, 'the enumerator equals brute force on ' + R.info.enumTests + ' hands (free lead and against tables), cheap wings: ' + R.info.lowChecked);
  ok(R.info.longMs < 8000, 'a 20 card hand is enumerated quickly: ' + R.info.longMs + ' ms for 40 hands');
  ok(R.info.stats.games >= 360, 'computer games played: ' + R.info.stats.games + ' (' + R.info.stats.moves + ' moves, ' + R.info.stats.bombs + ' bombs, ' + R.info.stats.springs + ' springs, ' + R.info.stats.redeals + ' redeals)');
  ok(R.info.stats.bombs > 20 && R.info.stats.redeals >= 0, 'bombs and rockets do occur in the games');
  ok(R.info.strength.hard > R.info.strength.easy + 0.03, 'the hard players beat the easy one more often: easy ' + R.info.strength.easy.toFixed(2) + ' vs hard ' + R.info.strength.hard.toFixed(2));

  // ================================================================ 2. the screen
  const st = () => p.evaluate(() => window.__dz.state());
  const mkState = (o) => ({ hands: [[], [], []], bottom: [], phase: 'play', first: 0, turn: 0, bids: [3, 0, 0], high: 3, highBy: 0, landlord: 0, table: null, passes: 0, last: [null, null, null], bombs: 0, plays: [1, 0, 0], winner: -1, spring: 0, moves: 3, ...o });
  const cmb = (type, rank, len, n) => ({ type, rank, len, n });
  const load = async (o) => { await p.evaluate((x) => window.__dz.load(x), mkState(o)); await p.waitForTimeout(80); };
  const ovlVisible = () => p.evaluate(() => { const o = document.querySelector('#dz-ovl'); return !!o && !o.hidden; });
  const waitOvl = (ms = 20000) => p.waitForFunction(() => { const o = document.querySelector('#dz-ovl'); return !!o && !o.hidden; }, null, { timeout: ms });
  const cardBox = async (i) => p.locator('#dz-fan .dz-card').nth(i).boundingBox();
  const tapCard = async (i) => { const b = await cardBox(i); const s2 = (await st()).handStep; await p.mouse.click(b.x + Math.min(b.width, s2) / 2, b.y + b.height / 2); };

  // opening
  ok(await ovlVisible() && (await p.textContent('#dz-ovl h2')) === '斗地主' && (await p.locator('#dz-start').count()) === 1, 'the game opens with the start panel');
  let a = await st();
  ok(!a.started && a.phase === 'bid' && a.hands.every((h) => h.length === 17) && a.bottom.length === 3 && new Set(a.hands.flat().concat(a.bottom)).size === 54, 'a new deal: 17 + 17 + 17 and 3 bottom cards, 54 different cards');
  ok((await p.locator('#dz-fan .dz-card').count()) === 17 && (await p.locator('#dz-bottom .dz-card.back').count()) === 3, 'my 17 cards are shown and the 3 bottom cards are face down');
  ok((await p.textContent('#dz-base')) === '底分：-' && (await p.textContent('#dz-mult')) === '倍数：×1' && (await p.textContent('#dz-best')) === '最高：0', 'HUD: base, multiplier, best');
  await p.screenshot({ path: OUT + 'doudizhu-start.png' });
  await p.evaluate(() => window.__dz.redeal(11));
  await p.keyboard.press('Enter');                       // Enter starts
  await p.waitForFunction(() => !document.querySelector('#dz-ovl').hidden === false);
  a = await st();
  ok(a.started && !(await ovlVisible()), 'Enter starts the game');
  await p.waitForFunction(() => { const s = window.__dz.state(); return s.turn === 0 && s.phase === 'bid'; }, null, { timeout: 8000 }).catch(() => {});
  a = await st();
  if (!(a.turn === 0 && a.phase === 'bid')) await load({ phase: 'bid', turn: 0, bids: [null, null, null], high: 0, highBy: -1, landlord: -1, hands: a.hands, bottom: a.bottom, plays: [0, 0, 0], moves: 0 });
  a = await st();
  ok(a.phase === 'bid' && a.turn === 0, 'the bidding comes round to me');
  ok((await p.locator('#dz-act .dz-btn').count()) === 4 && (await p.textContent('#dz-bid0')) === '不叫' && (await p.textContent('#dz-bid3')) === '3分', 'bid buttons: pass, 1, 2, 3');
  ok((await p.textContent('#dz-msg')) === '请叫分。', 'the message asks for a bid');
  await p.screenshot({ path: OUT + 'doudizhu-bid.png' });
  // a bid of 2 by someone before me makes 1 and 2 unavailable
  await load({ phase: 'bid', turn: 0, bids: [null, 0, 2], high: 2, highBy: 2, landlord: -1, hands: a.hands, bottom: a.bottom, plays: [0, 0, 0], moves: 0 });
  ok((await p.locator('#dz-bid1').isDisabled()) && (await p.locator('#dz-bid2').isDisabled()) && !(await p.locator('#dz-bid3').isDisabled()) && !(await p.locator('#dz-bid0').isDisabled()), 'only a higher bid is possible after a bid of 2');
  ok((await p.textContent('#dz-zone-1 .dz-say')) === '不叫' && (await p.textContent('#dz-zone-2 .dz-say')) === '2分', 'the bids of the others are shown');
  await p.click('#dz-bid3');
  await p.waitForTimeout(150);
  a = await st();
  ok(a.landlord === 0 && a.hands[0].length === 20 && a.phase === 'play' && a.turn === 0 && a.high === 3, '3 points: I am the landlord with 20 cards and lead');
  ok((await p.locator('#dz-bottom .dz-card:not(.back)').count()) === 3 && (await p.locator('#dz-fan .dz-card').count()) === 20, 'the bottom cards are shown to everybody; they are in my hand');
  ok((await p.textContent('#dz-base')) === '底分：3' && (await p.locator('.dz-role.lord').count()) >= 1, 'base 3, the landlord badge');
  await p.screenshot({ path: OUT + 'doudizhu-landlord.png' });

  // selection: tap, tap again, clear, drag, keys
  await load({ hands: [sortDesc([card(15, 0), card(14, 0), card(13, 0), card(12, 1), card(11, 0), card(10, 0), card(9, 0), card(9, 1), card(8, 0), card(7, 0), card(6, 0), card(5, 0), card(4, 0), card(3, 0)]), [card(3, 1), card(3, 2), card(6, 1)], [card(4, 1), card(4, 2), card(5, 1)]], landlord: 0, turn: 0, table: null, plays: [0, 0, 0] });
  const hand0 = (await st()).hands[0];
  await tapCard(3);
  a = await st();
  ok(a.sel.length === 1 && a.sel[0] === hand0[3] && (await p.locator('#dz-fan .dz-card.sel').count()) === 1, 'a tap selects (lifts) a card');
  const lifted = await p.evaluate(() => { const c = document.querySelector('#dz-fan .dz-card.sel'); const o = document.querySelectorAll('#dz-fan .dz-card')[0]; return c.getBoundingClientRect().top < o.getBoundingClientRect().top - 3; });
  ok(lifted, 'a selected card stands higher than the others');
  await tapCard(3);
  ok((await st()).sel.length === 0, 'a second tap deselects');
  // drag across cards 2..6 with the mouse
  let b2 = await cardBox(2), b6 = await cardBox(6);
  const sstep = (await st()).handStep;
  await p.mouse.move(b2.x + sstep / 2, b2.y + 30); await p.mouse.down();
  await p.mouse.move(b2.x + sstep * 2.5, b2.y + 30, { steps: 4 });
  a = await st(); ok(a.sel.length === 3, 'while dragging the cards under the finger are selected (live): ' + a.sel.length);
  await p.mouse.move(b6.x + sstep / 2, b6.y + 30, { steps: 4 }); await p.mouse.up();
  a = await st();
  ok(a.sel.length === 5 && JSON.stringify(a.sel.slice().sort()) === JSON.stringify(hand0.slice(2, 7).sort()), 'dragging across five cards selects exactly those five');
  // dragging back shrinks, dragging over selected cards from a selected card deselects
  await p.mouse.move(b6.x + sstep / 2, b6.y + 30); await p.mouse.down(); await p.mouse.move(b2.x + sstep * 2.5, b2.y + 30, { steps: 4 }); await p.mouse.up();
  a = await st();
  ok(a.sel.length === 2 && a.sel.every((c) => [hand0[2], hand0[3]].includes(c)), 'a drag that starts on a selected card deselects the cards it crosses');
  await p.click('#dz-clear'); a = await st();
  ok(a.sel.length === 0 && (await p.locator('#dz-clear').isDisabled()), 'Clear deselects everything');
  // an illegal selection
  await tapCard(0); await tapCard(1); await p.click('#dz-play');
  a = await st();
  ok((await p.textContent('#dz-msg')) === '牌型不符。' && a.table === null && a.hands[0].length === 14 && a.turn === 0, 'two different cards are refused: not a combination');
  await p.click('#dz-clear');
  // a straight by dragging, played
  await p.evaluate(() => 0);
  const rs = (await st()).hands[0].map(rk);                 // [15,14,13,12,11,10,9,9,8,7,6,5,4,3]
  const iA = rs.indexOf(13), iB = rs.indexOf(9);            // K Q J 10 9
  let ba = await cardBox(iA), bb = await cardBox(iB);
  await p.mouse.move(ba.x + sstep / 2, ba.y + 40); await p.mouse.down(); await p.mouse.move(bb.x + sstep / 2, bb.y + 40, { steps: 5 }); await p.mouse.up();
  a = await st(); ok(a.sel.length === 5, 'K Q J 10 9 selected by a drag');
  ok(!(await p.locator('#dz-play').isDisabled()) && (await p.locator('#dz-pass').isDisabled()), 'Play is on; Pass is off on a free lead');
  await p.evaluate(() => window.__dz.hold(true));
  await p.click('#dz-play');
  a = await st();
  ok(a.table && a.table.by === 0 && a.table.combo.type === 'straight' && a.table.combo.len === 5 && a.table.combo.rank === 9 && a.hands[0].length === 9, 'the straight is played and leaves my hand');
  ok((await p.locator('#dz-zone-0 .dz-card').count()) === 5 && (await p.getAttribute('#dz-zone-0 .dz-zc', 'data-type')) === 'straight', 'the played cards are shown on the table in front of me');
  await p.screenshot({ path: OUT + 'doudizhu-played.png' });
  await p.evaluate(() => window.__dz.hold(false));
  // the opponents (3 and 4 cards) cannot beat a straight: they pass, I lead again
  await p.waitForFunction(() => { const s = window.__dz.state(); return s.turn === 0 && s.table === null; }, null, { timeout: 5000 });
  a = await st();
  ok(a.turn === 0 && a.table === null && a.last[1] === 'pass' && a.last[2] === 'pass', 'both computer players pass and I lead again');
  ok((await p.textContent('#dz-zone-1 .dz-say')) === '不出', 'a pass is shown as a bubble');

  // following, passing, hint
  await load({ hands: [sortDesc([card(15, 0), card(12, 0), card(9, 0), card(7, 0), card(7, 1), card(4, 0), card(3, 0)]), [card(3, 1), card(3, 2), card(6, 1), card(8, 1)], [card(4, 1), card(4, 2), card(5, 1), card(6, 2)]], landlord: 1, turn: 0, table: { by: 1, combo: cmb('single', 8, 1, 1), cards: [card(8, 1)] }, last: [null, [card(8, 1)].length ? { cards: [card(8, 1)], combo: cmb('single', 8, 1, 1) } : null, null], plays: [0, 1, 0] });
  a = await st();
  ok(!(await p.locator('#dz-pass').isDisabled()) && (await p.textContent('#dz-msg')) === '请出牌或选择不出。', 'against a single, Pass is possible');
  await p.click('#dz-hint'); a = await st();
  ok(a.sel.length === 1 && rk(a.sel[0]) === 9, 'the hint selects the smallest card that beats the table (9 over 8)');
  await p.click('#dz-hint'); a = await st();
  ok(a.sel.length === 1 && rk(a.sel[0]) === 12, 'a second hint shows the next play (Q)');
  await tapCard(5); a = await st();          // select a 4: not enough
  await p.click('#dz-clear');
  await tapCard(hand0.length ? (await st()).hands[0].map(rk).indexOf(7) : 0); await p.click('#dz-play'); a = await st();
  ok((await p.textContent('#dz-msg')) === '没有大过上家。' && a.table.by === 1 && a.hands[0].length === 7, 'a card that does not beat the table is refused: ' + (await p.textContent('#dz-msg')));
  await p.keyboard.press('Escape'); a = await st(); ok(a.sel.length === 0, 'Escape clears the selection');
  await p.click('#dz-pass'); a = await st();
  ok(a.last[0] === 'pass' && a.hands[0].length === 7 && a.turn !== 0, 'Pass passes');
  // nothing beats a rocket: the hint says so
  await load({ hands: [sortDesc([card(15, 0), card(3, 0), card(4, 0)]), [card(5, 0), card(5, 1)], [card(6, 0), card(6, 1)]], landlord: 1, turn: 0, table: { by: 2, combo: cmb('rocket', 17, 1, 2), cards: [52, 53] }, last: [null, null, { cards: [52, 53], combo: cmb('rocket', 17, 1, 2) }], plays: [0, 1, 1], bombs: 1 });
  await p.click('#dz-hint');
  ok((await p.textContent('#dz-msg')) === '没有能大过的牌，请选择不出。' && (await st()).sel.length === 0, 'nothing beats the rocket: the hint says so');
  ok((await p.textContent('#dz-mult')) === '倍数：×2', 'a rocket doubles the multiplier');

  // keyboard
  await load({ hands: [sortDesc([card(14, 0), card(14, 1), card(9, 0), card(5, 0)]), [card(3, 1), card(3, 2)], [card(4, 1), card(4, 2)]], landlord: 0, turn: 0, table: null, plays: [0, 0, 0] });
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  ok((await p.locator('#dz-fan .dz-card.cur').count()) === 1, 'arrow keys move a cursor over my cards');
  await p.keyboard.press('Space');
  a = await st(); ok(a.sel.length === 1 && rk(a.sel[0]) === 5, 'Space selects the card under the cursor');
  await p.keyboard.press('Escape');
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('Space'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Space');
  a = await st(); ok(a.sel.length === 2 && a.sel.every((c) => rk(c) === 14), 'two aces selected by keys');
  await p.evaluate(() => window.__dz.hold(true));
  await p.keyboard.press('Enter'); a = await st();
  ok(a.table && a.table.combo.type === 'pair' && a.table.combo.rank === 14, 'Enter plays the selection (a pair of aces)');
  await p.evaluate(() => window.__dz.hold(false));

  // winning: the last card, a bomb in the game, best score kept
  await p.evaluate(() => localStorage.removeItem('learn.games.v1'));
  await load({ hands: [[card(15, 0)], [card(3, 1), card(4, 1)], [card(5, 1), card(6, 1)]], landlord: 0, turn: 0, table: null, bombs: 1, high: 3, plays: [2, 1, 1] });
  await tapCard(0); await p.click('#dz-play');
  await waitOvl();
  ok((await p.textContent('#dz-ovl h2')) === '你赢了。' && (await p.locator('#dz-ovl p').nth(0).textContent()) === '地主获胜。' && (await p.locator('#dz-ovl p').nth(1).textContent()) === '新纪录：6', 'win: the panel says so with the score (3 x 2 bomb = 6)');
  const bestStore = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).doudizhu);
  ok(bestStore.best === 6 && (await p.textContent('#dz-best')) === '最高：6' && bestStore.wins === 1, 'the best score is kept in learn.games.v1: ' + JSON.stringify(bestStore));
  await p.screenshot({ path: OUT + 'doudizhu-win.png' });
  // lose and the spring line: the computer landlord goes out at once
  await p.click('#dz-start'); await p.waitForTimeout(100);
  a = await st(); ok(a.started && a.phase === 'bid' && a.dealt >= 2 && !(await ovlVisible()), 'Play again: a new deal, the best stays');
  ok((await p.textContent('#dz-best')) === '最高：6', 'the best score stays after a new game');
  await load({ hands: [[card(15, 0), card(14, 0)], [card(3, 1)], [card(5, 1), card(6, 1)]], landlord: 1, turn: 1, table: null, bombs: 0, high: 2, plays: [0, 0, 0] });
  await waitOvl();
  a = await st();
  ok((await p.textContent('#dz-ovl h2')) === '你输了。' && (await p.locator('#dz-ovl p').nth(0).textContent()) === '地主获胜。' && a.spring === 1 && (await p.locator('#dz-ovl p').nth(2).textContent()) === '春天！倍数加倍。' && (await p.locator('#dz-ovl p').nth(1).textContent()) === '得分：4', 'lose with a spring: the panel names it, score 2 x 2');
  ok((await p.textContent('#dz-mult')) === '倍数：×2' && (await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).doudizhu.best)) === 6, 'x2 in the HUD, a lost game does not change the best');
  await p.screenshot({ path: OUT + 'doudizhu-lose.png' });
  await p.click('#dz-start'); await p.waitForTimeout(50);
  await load({ hands: [[card(15, 0)], [card(3, 1), card(4, 1)], [card(5, 1), card(6, 1)]], landlord: 1, turn: 0, table: null, high: 1, plays: [0, 1, 0] });
  await tapCard(0); await p.click('#dz-play'); await waitOvl();
  a = await st();
  ok((await p.textContent('#dz-ovl h2')) === '你赢了。' && (await p.locator('#dz-ovl p').nth(0).textContent()) === '农民获胜。' && a.spring === 2 && (await p.locator('#dz-ovl p').nth(2).textContent()) === '反春天！倍数加倍。', 'a peasant win with an anti-spring');
  // the level button starts a new deal at the next level
  await p.click('#dz-start'); await p.waitForTimeout(50);
  const lv0 = (await st()).level; await p.click('#dz-level'); await p.waitForTimeout(50);
  a = await st();
  ok(a.level === (lv0 % 3) + 1 && a.dealt >= 1 && (await ovlVisible()) && (await p.textContent('#dz-level')) === ['难度：简单', '难度：普通', '难度：较难'][a.level - 1], 'the level button cycles 简单 / 普通 / 较难 and deals again');
  await p.click('#dz-start');
  // 托管: the computer plays for me, a whole game from the deal to the end panel
  await p.evaluate(() => window.__dz.redeal(23)); await p.click('#dz-start');
  await p.click('#dz-auto');
  ok((await p.textContent('#dz-auto')) === '托管：开', 'auto-play switched on');
  await waitOvl(60000);
  a = await st();
  const total = a.hands.flat().length;
  ok(a.phase === 'over' && a.winner >= 0 && a.hands[a.winner].length === 0 && total + 0 <= 54 && (await p.textContent('#dz-ovl h2')).length > 0, 'a whole game with auto-play ended: winner seat ' + a.winner + ', ' + a.moves + ' moves');
  ok(a.auto, 'auto-play stays on for the next game');
  await p.click('#dz-auto');
  ok((await p.textContent('#dz-auto')) === '托管：关', 'auto-play switched off');

  // the bomb flash with motion on (a second page)
  const t2 = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 }, motion: true });
  const p2 = t2.page;
  await p2.evaluate(() => (location.hash = '#/games/doudizhu')); await p2.waitForSelector('#dz-stage');
  await p2.evaluate((x) => window.__dz.load(x), mkState({ hands: [sortDesc([card(8, 0), card(8, 1), card(8, 2), card(8, 3), card(4, 0), card(3, 0)]), [card(3, 1), card(3, 2), card(6, 1)], [card(4, 1), card(4, 2), card(5, 1)]], landlord: 0, turn: 0, table: null, plays: [0, 0, 0] }));
  await p2.waitForTimeout(100);
  const hb = (await p2.evaluate(() => window.__dz.state())).hands[0];
  const boxes = []; for (let i = 0; i < hb.length; i++) boxes.push(await p2.locator('#dz-fan .dz-card').nth(i).boundingBox());
  const stp = (await p2.evaluate(() => window.__dz.state())).handStep;
  await p2.mouse.move(boxes[0].x + stp / 2, boxes[0].y + 40); await p2.mouse.down(); await p2.mouse.move(boxes[3].x + stp / 2, boxes[3].y + 40, { steps: 4 }); await p2.mouse.up();
  await p2.click('#dz-play');
  await p2.waitForSelector('.dz-flash.bomb', { timeout: 2000 });
  const as = await p2.evaluate(() => window.__dz.state());
  ok(as.bombs === 1 && as.table.combo.type === 'bomb', 'a bomb: the flash plays and the multiplier counts it');
  ok(await p2.evaluate(() => document.querySelectorAll('#dz-zone-0 .dz-card.fly').length === 4), 'the played cards fly to the table (motion on)');
  await p2.screenshot({ path: OUT + 'doudizhu-bomb.png' });
  ok(t2.log.external.length === 0, 'no outside request (second page)');
  await t2.browser.close();

  // ================================================================ 3. layout on 5 sizes
  const sizes = [[390, 844, 'phone'], [820, 1180, 'ipad-portrait'], [1180, 820, 'ipad-landscape'], [844, 390, 'phone-landscape'], [320, 568, 'small-phone']];
  const longHand = sortDesc([card(15, 0), card(15, 1), card(14, 0), card(14, 1), card(13, 0), card(12, 0), card(11, 0), card(10, 0), card(9, 0), card(8, 0), card(7, 0), card(6, 0), card(5, 0), card(5, 1), card(4, 0), card(4, 1), card(3, 0), card(3, 1), 52, 53]);
  for (const [w, hgt, name] of sizes) {
    await p.setViewportSize({ width: w, height: hgt }); await p.waitForTimeout(250);
    await load({ hands: [longHand, [card(3, 2), card(4, 2), card(5, 2)], Array.from({ length: 17 }, (_, i) => card(3 + (i % 13), 3))], landlord: 0, turn: 0, table: null, plays: [0, 0, 0] });
    await p.evaluate(() => 0);
    await p.waitForTimeout(150);
    // a long play on the table on the left (12 cards) and my selection
    await p.evaluate((x) => window.__dz.load(x), mkState({ hands: [longHand, [card(3, 2), card(4, 2), card(5, 2)], Array.from({ length: 17 }, (_, i) => card(3 + (i % 13), 3))], landlord: 1, turn: 0, table: { by: 2, combo: cmb('straight', 3, 12, 12), cards: Array.from({ length: 12 }, (_, i) => card(3 + i, 0)) }, last: [null, { cards: [card(7, 1), card(7, 2)], combo: cmb('pair', 7, 1, 2) }, { cards: Array.from({ length: 12 }, (_, i) => card(3 + i, 0)), combo: cmb('straight', 3, 12, 12) }], plays: [0, 1, 1] }));
    await p.waitForTimeout(150);
    for (const i of [1, 2, 3]) { /* select three */ }
    const g = await p.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
      const stage = r(document.querySelector('#dz-stage')), fan = r(document.querySelector('#dz-fan'));
      const inside = (c, o, tol = 1.5) => c.l >= o.l - tol && c.r <= o.r + tol && c.t >= o.t - tol && c.b <= o.b + tol;
      const out = { sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, stage, fan };
      out.fanIn = inside(fan, stage);
      out.cards = [...document.querySelectorAll('#dz-fan .dz-card')].map((c) => r(c)).every((c) => inside(c, stage));
      out.zoneBad = 0; out.zoneCards = 0;
      for (const z of document.querySelectorAll('.dz-zone')) { const zr = r(z); for (const c of z.querySelectorAll('.dz-card')) { out.zoneCards++; if (!inside(r(c), zr)) out.zoneBad++; } }
      out.btnMin = Math.min(...[...document.querySelectorAll('.dz-btn')].map((b) => r(b).h));
      out.btnIn = [...document.querySelectorAll('.dz-btn')].every((b) => inside(r(b), stage));
      out.hudBtn = Math.min(...[...document.querySelectorAll('.dz-hud .mopt')].map((b) => r(b).h));
      out.panels = [...document.querySelectorAll('.dz-pl')].every((x) => inside(r(x), stage));
      out.status = inside(r(document.querySelector('.dz-status')), stage);
      out.wrapL = r(document.querySelector('.dz-hud')).l; out.cw = window.__dz.state().handCw; out.step = window.__dz.state().handStep;
      out.msgs = [...document.querySelectorAll('.dz-msg, .dz-stat, .dz-hud .mopt')].every((e) => e.scrollWidth <= e.clientWidth + 2 || getComputedStyle(e).whiteSpace === 'nowrap');
      out.zonesOverlap = (() => { const zs = [...document.querySelectorAll('.dz-zone')].map(r); for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) { const A = zs[i], B = zs[j]; if (A.l < B.r - 1 && B.l < A.r - 1 && A.t < B.b - 1 && B.t < A.b - 1) return true; } return false; })();
      return out;
    });
    const tag = name + ' ' + w + 'x' + hgt;
    ok(g.sw <= g.iw && g.sh <= g.ih + 1, tag + ': nothing overflows the screen (' + g.sw + '/' + g.iw + ', ' + g.sh + '/' + g.ih + ')');
    ok(g.fanIn && g.cards, tag + ': my 20 cards stay inside the table (card width ' + Math.round(g.cw) + ', step ' + Math.round(g.step) + ')');
    ok(g.zoneBad === 0 && g.zoneCards >= 14, tag + ': the played cards (a 12 card straight too) stay inside their zones: ' + g.zoneCards);
    ok(g.btnMin >= 40 && g.btnIn && g.hudBtn >= 30, tag + ': buttons are at least 40 px high and inside: ' + Math.round(g.btnMin));
    ok(g.panels && g.status && !g.zonesOverlap, tag + ': panels, status line and the three zones fit and do not overlap');
    ok(g.cw >= 28 && g.step >= 9, tag + ': cards are readable (width ' + Math.round(g.cw) + ', visible strip ' + Math.round(g.step) + ')');
    // equal space left and right
    const leftGap = name === 'phone-landscape' ? g.wrapL : g.stage.l, rightGap = g.iw - g.stage.r;
    ok(Math.abs(leftGap - rightGap) <= 3, tag + ': equal space left and right (' + Math.round(leftGap) + ' / ' + Math.round(rightGap) + ')');
    await p.screenshot({ path: OUT + 'doudizhu-' + name + '.png' });
    // the start panel and the bid state fit too
    await p.evaluate(() => window.__dz.redeal()); await p.waitForTimeout(120);
    const ov = await p.evaluate(() => { const o = document.querySelector('#dz-ovl').getBoundingClientRect(), s = document.querySelector('#dz-stage').getBoundingClientRect(), b = document.querySelector('#dz-start').getBoundingClientRect(); return { inS: o.left >= s.left - 1 && o.right <= s.right + 1 && o.top >= s.top - 1 && o.bottom <= s.bottom + 1, bh: b.height, bIn: b.left >= s.left && b.right <= s.right && b.bottom <= s.bottom }; });
    ok(ov.inS && ov.bh >= 46 && ov.bIn, tag + ': the start panel covers the board, its button is big (' + Math.round(ov.bh) + ' px)');
  }

  // ================================================================ 4. real touch at dpr 2
  const tt = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, touch: true, dpr: 2 });
  const tp = tt.page;
  await tp.evaluate(() => (location.hash = '#/games/doudizhu')); await tp.waitForSelector('#dz-stage');
  await tp.evaluate((x) => window.__dz.load(x), mkState({ hands: [longHand, [card(3, 2), card(4, 2), card(5, 2)], [card(3, 3), card(4, 3)]], landlord: 0, turn: 0, table: null, plays: [0, 0, 0] }));
  await tp.waitForTimeout(150);
  const cdp = await tt.ctx.newCDPSession(tp);
  const tstate = () => tp.evaluate(() => window.__dz.state());
  const ts = await tstate();
  const fanBox = await tp.locator('#dz-fan').boundingBox();
  const xOf = (i) => fanBox.x + i * ts.handStep + ts.handStep / 2, yTouch = fanBox.y + fanBox.height * 0.6;
  const touch = async (i0, i1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xOf(i0), y: yTouch }] });
    const n = Math.max(1, Math.abs(i1 - i0)); for (let k = 1; k <= n; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: xOf(i0 + ((i1 - i0) * k) / n), y: yTouch }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await tp.waitForTimeout(120);
  };
  await touch(4, 4);
  let ta = await tstate(); ok(ta.sel.length === 1 && ta.sel[0] === ts.hands[0][4], 'a real touch tap selects a card');
  await touch(4, 4);
  ta = await tstate(); ok(ta.sel.length === 0, 'a second touch tap deselects it');
  await touch(6, 11);
  ta = await tstate(); ok(ta.sel.length === 6 && JSON.stringify(ta.sel.slice().sort()) === JSON.stringify(ts.hands[0].slice(6, 12).sort()), 'a real touch drag over six cards selects exactly them: ' + ta.sel.length);
  await touch(9, 7);
  ta = await tstate(); ok(ta.sel.length === 3 && JSON.stringify(ta.sel.slice().sort()) === JSON.stringify([ts.hands[0][6], ts.hands[0][10], ts.hands[0][11]].sort()), 'a drag that starts on a selected card deselects the cards it crosses: ' + ta.sel.length);
  // two fingers: the second one is ignored while the first drags
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xOf(0), y: yTouch, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xOf(0), y: yTouch, id: 1 }, { x: xOf(15), y: yTouch, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: xOf(2), y: yTouch, id: 1 }, { x: xOf(16), y: yTouch, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await tp.waitForTimeout(120);
  ta = await tstate(); ok(ta.sel.every((c) => !ts.hands[0].slice(14).includes(c)), 'a second finger does not select cards');
  // play by touching the buttons
  await tp.click('#dz-clear');
  await touch(2, 3);
  await tp.evaluate(() => window.__dz.hold(true));
  await tp.click('#dz-play');   // (after a CDP drag Chromium sends no click for the next tap: the button is clicked with the mouse)
  await tp.waitForTimeout(150);
  ta = await tstate(); ok(ta.table && ta.table.by === 0 && ta.table.combo.type === 'pair' && ta.hands[0].length === 18, 'two 2s selected by a touch drag and played: ' + JSON.stringify(ta.table && ta.table.combo) + ' ' + ta.hands[0].length);
  ok(tt.log.external.length === 0, 'touch page: no outside request');
  await tt.browser.close();

  // ================================================================ 5. English and French
  for (const [loc, name] of [['en-US', 'English'], ['fr-FR', 'French']]) {
    const tl = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 }, locale: loc });
    const lp = tl.page;
    await lp.evaluate(() => (location.hash = '#/games/doudizhu')); await lp.waitForSelector('#dz-stage');
    const texts = [];
    const grab = async (tag) => { await lp.waitForTimeout(120); const x = await lp.evaluate(() => { const w = document.querySelector('.dz-wrap'); return w.innerText + '|' + [...w.querySelectorAll('[title],[aria-label],[placeholder]')].map((e) => (e.title || '') + (e.getAttribute('aria-label') || '')).join('|'); }); texts.push([tag, x]); };
    await grab('start');
    await lp.evaluate((x) => window.__dz.load(x), mkState({ phase: 'bid', turn: 0, bids: [null, 0, 1], high: 1, highBy: 2, landlord: -1, hands: [longHand.slice(0, 17), [card(3, 2)], [card(4, 2)]], bottom: [card(5, 2), card(6, 2), card(7, 2)], plays: [0, 0, 0] }));
    await grab('bid');
    await lp.evaluate((x) => window.__dz.load(x), mkState({ hands: [longHand, [card(3, 2)], [card(4, 2)]], landlord: 1, turn: 0, table: { by: 1, combo: cmb('single', 3, 1, 1), cards: [card(3, 2)] }, last: [null, { cards: [card(3, 2)], combo: cmb('single', 3, 1, 1) }, 'pass'] }));
    await grab('play');
    await lp.locator('#dz-fan .dz-card').nth(0).click({ position: { x: 3, y: 30 } }); await lp.locator('#dz-fan .dz-card').nth(5).click({ position: { x: 3, y: 30 } }); await lp.click('#dz-play'); await grab('error');
    await lp.evaluate((x) => window.__dz.load(x), mkState({ hands: [[card(15, 0)], [card(3, 2)], [card(4, 2)]], landlord: 0, turn: 0, plays: [4, 0, 0], high: 2 }));
    await lp.click('#dz-fan .dz-card'); await lp.click('#dz-play'); await waitOvlOn(lp); await grab('win-spring');
    await lp.evaluate((x) => window.__dz.load(x), mkState({ hands: [[card(15, 0), card(3, 0)], [card(4, 2)], [card(5, 2), card(6, 2)]], landlord: 1, turn: 1, plays: [1, 0, 1], high: 1 }));
    await waitOvlOn(lp); await grab('lose');
    await lp.click('#dz-start'); await lp.waitForTimeout(100);
    await lp.evaluate((x) => window.__dz.load(x), mkState({ phase: 'bid', turn: 2, bids: [null, null, null], high: 0, highBy: -1, landlord: -1, hands: [longHand.slice(0, 17), [card(3, 2)], [card(4, 2)]], bottom: [] }));
    await lp.evaluate(() => window.__dz.freeze()); await grab('thinking');
    const left = texts.filter(([, x]) => CJK.test(x));
    ok(left.length === 0, name + ': no Chinese left on any state (' + texts.map((x) => x[0]).join(', ') + ')' + (left.length ? ' -> ' + left.map(([tg, x]) => tg + ': ' + (x.match(/[㐀-鿿]+/g) || []).join(',')).join(' | ') : ''));
    const shown = texts.map(([, x]) => x).join(' ');
    ok(loc === 'en-US' ? /Landlord/.test(shown) && /Please bid\./.test(shown) && /You win\./.test(shown) && /Spring!/.test(shown) : /Propriétaire/.test(shown) && /Veuillez enchérir\./.test(shown) && /Vous avez gagné\./.test(shown) && /Printemps/.test(shown), name + ': the texts are really translated');
    if (loc === 'en-US') await lp.screenshot({ path: OUT + 'doudizhu-en.png' });
    ok(tl.log.external.length === 0, name + ': no outside request');
    await tl.browser.close();
  }

  ok(t.log.external.length === 0, 'no outside request: ' + t.log.external.join(', '));
  await p.evaluate(() => (location.hash = '#/games')); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !window.__dz), 'leaving the game removes its hook and its listeners (no timer left to play on)');
  await done(t.browser);

  async function waitOvlOn(page) { await page.waitForFunction(() => { const o = document.querySelector('#dz-ovl'); return !!o && !o.hidden; }, null, { timeout: 8000 }); }
})();
