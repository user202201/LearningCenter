// PK认字 (src/pk.ts, pklogic.ts, pk-chinese.ts): the pure rules on hundreds of simulated games against an independent reference, the item maker (every character
// from its own child's list only), the screens (card on the 识字 home, setup, the portrait stage with a top half turned by 180 degrees, countdown, rounds, final,
// exit, record), real touch events (CDP, dpr 2) on the turned buttons, six screen sizes in both orientations, EN / FR, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const KIDS = [{ id: 'k1', name: 'Anna', color: '#f2545b' }, { id: 'k2', name: 'Ben', color: '#1c7ed6' }, { id: 'k3', name: 'Cy', color: '#2f9e44' }, { id: 'k4', name: 'Dee', color: '#e8590c' }];
const LISTS = { k1: '假辣酸贫纺炒缸锅烛扇', k2: '鼓旧富言忙桶炉锤泉溪', k3: '波坡板', k4: '山水火土木金' };
const mk = (ids, lists = LISTS) => {
  const store = new Map();
  store.set('kids.json', JSON.stringify({ kids: KIDS.filter((k) => ids.includes(k.id)), startWeek: '2026-11-08' }));
  for (const id of ids) store.set(`kids/${id}.json`, JSON.stringify({ weeks: [{ start: '2026-11-08', chars: [...lists[id]] }] }));
  return store;
};
const SIZES = [[390, 844], [844, 390], [320, 568], [568, 320], [820, 1180], [1180, 820]];

(async () => {
  // =====================================================================================================================================
  // 1. the rules (pure), in the browser through the dev server's modules
  // =====================================================================================================================================
  const t = await start(mk(['k1', 'k2', 'k3', 'k4']), { viewport: { width: 820, height: 1180 } });
  const p = t.page;
  const R = await p.evaluate(async () => {
    const L = await import('/src/pklogic.ts');
    const res = { bad: [], games: 0, taps: 0, kinds: {}, timeouts: 0, bothLocked: 0, wins: [0, 0] };
    const bad = (m) => { if (res.bad.length < 8) res.bad.push(m); };
    const mkItems = (r, n) => Array.from({ length: n }, (_, i) => { const right = Math.floor(r() * 4); return { prompt: 'x' + i, choices: ['a', 'b', 'c', 'd'], answers: [right] }; });
    // --- the random generator ---
    const a1 = L.rng(5), a2 = L.rng(5), a3 = L.rng(6);
    const s1 = [a1(), a1(), a1()].join(), s2 = [a2(), a2(), a2()].join(), s3 = [a3(), a3(), a3()].join();
    if (s1 !== s2 || s1 === s3) bad('seeded random');
    const sh = L.shuffled([1, 2, 3, 4, 5, 6, 7, 8], L.rng(3));
    if ([...sh].sort().join() !== '1,2,3,4,5,6,7,8') bad('shuffle loses items');
    // --- the exact timeline of a game nobody touches: 4400 ms of intro + countdown, then ten times prep + the 12 s limit + result ---
    {
      const s = L.create([mkItems(L.rng(1), 10), mkItems(L.rng(2), 10)], 0);
      const seen = [];
      let last = '';
      for (let t = 0; t <= 150000; t += 50) { L.advance(s, t); const k = s.phase + (s.phase === 'countdown' ? s.count : ''); if (k !== last) { seen.push(k + '@' + t); last = k; } }
      if (s.phase !== 'final' || s.scores.join() !== '0,0' || s.outcome.join() !== 'tie,tie') bad('idle game does not end as a draw');
      if (seen.slice(0, 6).join() !== 'intro@0,countdown3@1700,countdown2@2400,countdown1@3100,countdown0@3800,prep@4400') bad('opening: ' + seen.slice(0, 6).join());
      if (!seen.includes('final@147400')) bad('idle game ends at ' + seen[seen.length - 1]);
      if (s.results.length !== 10 || s.results.some((x) => x !== -1)) bad('idle results');
    }
    // --- scripted rounds ---
    const fresh = (n = 10) => { const s = L.create([mkItems(L.rng(1), n), mkItems(L.rng(2), n)], 0); L.advance(s, 4400 + 900); return s; };   // at the start of the first question
    const wrongOf = (s, side) => [0, 1, 2, 3].find((i) => !L.current(s, side).answers.includes(i));
    const rightOf = (s, side) => L.current(s, side).answers[0];
    let s = fresh(); const qs = s.questionStart;
    if (s.phase !== 'question' || qs !== 5300) bad('question start ' + qs);
    let e = L.tap(s, 0, rightOf(s, 0), qs - 1);
    if (e.type !== 'ignored' || e.why !== 'early' || s.scores.join() !== '0,0') bad('a tap before the question is shown must do nothing');
    e = L.tap(s, 1, wrongOf(s, 1), qs + 100);
    if (e.type !== 'wrong' || !s.locked[1] || s.locked[0] || s.phase !== 'question') bad('wrong tap locks that side only');
    e = L.tap(s, 1, rightOf(s, 1), qs + 150);
    if (e.type !== 'ignored' || e.why !== 'locked' || s.scores.join() !== '0,0') bad('a locked side cannot answer again');
    e = L.tap(s, 0, rightOf(s, 0), qs + 200);
    if (e.type !== 'win' || s.scores.join() !== '1,0' || s.phase !== 'result' || s.winner !== 0 || s.results[0] !== 0) bad('the other side may still win');
    e = L.tap(s, 1, rightOf(s, 1), qs + 210);
    if (e.type !== 'ignored' || s.scores.join() !== '1,0') bad('after the win nothing more counts');
    // the opening can be skipped: the first round is announced at once, then the question comes after the prep time
    { const q = L.create([mkItems(L.rng(1), 10), mkItems(L.rng(2), 10)], 0); L.advance(q, 700);
      if (!L.skipIntro(q, 700) || q.phase !== 'prep' || q.phaseEnd !== 1600) bad('skip from the intro');
      L.advance(q, 1600); if (q.phase !== 'question' || q.questionStart !== 1600) bad('question after a skip');
      if (L.skipIntro(q, 1700) || q.phase !== 'question') bad('no skip once the questions began');
      const q2 = L.create([mkItems(L.rng(1), 10), mkItems(L.rng(2), 10)], 0); L.advance(q2, 3200);
      if (q2.phase !== 'countdown' || q2.count !== 1 || !L.skipIntro(q2, 3200) || q2.phase !== 'prep') bad('skip from the countdown'); }
    // the competitive helpers
    { const q = L.create([mkItems(L.rng(1), 10), mkItems(L.rng(2), 10)], 0, { rounds: 15 }); if (q.total !== 10) bad('rounds can not exceed the items');
      const q15 = L.create([mkItems(L.rng(1), 15), mkItems(L.rng(2), 15)], 0, { rounds: 15 }); if (q15.total !== 15) bad('15 rounds');
      q15.scores = [3, 1]; if (Math.abs(L.tugPos(q15) - 2 / 15) > 1e-9) bad('tug uses the round count'); q15.scores = [15, 0]; if (L.tugPos(q15) !== 1) bad('tug end'); q15.scores = [0, 9]; if (L.tugPos(q15) !== -9 / 15) bad('tug side 1');
      const z = L.create([mkItems(L.rng(1), 10), mkItems(L.rng(2), 10)], 0); z.results = [0, 0, 1, 1, 1, -1, 0]; if (L.streakOf(z, 0) !== 1 || L.streakOf(z, 1) !== 0) bad('streak after a draw round');
      z.results = [0, 1, 1, 1]; if (L.streakOf(z, 1) !== 3 || L.streakOf(z, 0) !== 0) bad('streak 3');
      if (!L.leadSwap([0, 0, 0, 1, 1, 1, 1], 6) || L.leadSwap([0, 0, 0, 1, 1, 1, 1], 5) || L.leadSwap([0, 1], 1) || L.leadSwap([0, 0, 1], 2) || L.leadSwap([0, 0, 1, 1, 1, 0], 4) !== true || L.leadSwap([1, 1, 0, 0, 0], 4) !== true || L.leadSwap([0, -1, 0], 2)) bad('lead change');
      if (L.leaderOf([1, 1]) !== -1 || L.leaderOf([2, 1]) !== 0 || L.leaderOf([0, 4]) !== 1) bad('leader');
      if (L.secText(840) !== '0.8' || L.secText(1250) !== '1.3' || L.secText(0) !== '0.0' || L.secText(12000) !== '12.0') bad('seconds text');
      const w = fresh(); L.tap(w, 1, rightOf(w, 1), w.questionStart + 840); if (L.reactionMs(w) !== 840) bad('reaction ' + L.reactionMs(w)); const w2 = fresh(); if (L.reactionMs(w2) !== null) bad('no reaction in the question'); }
    // both locked
    s = fresh(); L.tap(s, 0, wrongOf(s, 0), qs + 10); e = L.tap(s, 1, wrongOf(s, 1), qs + 20);
    if (e.type !== 'wrong' || !e.both || s.phase !== 'result' || s.winner !== -1 || s.scores.join() !== '0,0' || s.results[0] !== -1) bad('both locked out: no winner');
    // time limit
    s = fresh(); L.advance(s, qs + 11999); if (s.phase !== 'question') bad('limit reached too early'); L.advance(s, qs + 12000);
    if (s.phase !== 'result' || s.winner !== -1 || s.results[0] !== -1) bad('time limit');
    // a tap in the prep phase and in the countdown
    const q0 = L.create([mkItems(L.rng(1), 10), mkItems(L.rng(2), 10)], 0);
    e = L.tap(q0, 0, 0, 10); if (e.type !== 'ignored' || e.why !== 'phase') bad('tap during the countdown');
    L.advance(q0, 4500); e = L.tap(q0, 0, rightOf(q0, 0), 4500); if (e.type !== 'ignored' || q0.scores.join() !== '0,0') bad('tap during prep');
    e = L.tap(s, 0, 9, qs); if (e.type !== 'ignored' || e.why !== 'index') bad('index out of range');
    // ties by order of arrival; an earlier timestamp that arrives later takes the win (at most 100 ms earlier)
    s = fresh(); L.tap(s, 1, rightOf(s, 1), qs + 500); e = L.tap(s, 0, rightOf(s, 0), qs + 500);
    if (e.type !== 'ignored' || s.winner !== 1 || s.scores.join() !== '0,1') bad('same time: the first to arrive wins');
    s = fresh(); L.tap(s, 1, rightOf(s, 1), qs + 500); e = L.tap(s, 0, rightOf(s, 0), qs + 470);
    if (e.type !== 'steal' || s.winner !== 0 || s.scores.join() !== '1,0' || s.results[0] !== 0) bad('earlier time arriving later must win: ' + JSON.stringify(e) + s.scores);
    s = fresh(); L.tap(s, 1, rightOf(s, 1), qs + 500); e = L.tap(s, 0, rightOf(s, 0), qs + 300);
    if (e.type !== 'ignored' || s.scores.join() !== '0,1') bad('200 ms earlier is too late to take the win');
    s = fresh(); L.tap(s, 1, rightOf(s, 1), qs + 500); e = L.tap(s, 0, wrongOf(s, 0), qs + 480);
    if (e.type !== 'ignored' || s.scores.join() !== '0,1') bad('a wrong tap never takes the win');
    s = fresh(); L.tap(s, 0, wrongOf(s, 0), qs + 100); L.tap(s, 1, rightOf(s, 1), qs + 500); e = L.tap(s, 0, rightOf(s, 0), qs + 480);
    if (e.type !== 'ignored' || s.scores.join() !== '0,1') bad('a locked side cannot take the win');
    // several right answers: every one of them counts
    { const it = [[{ prompt: 'y', choices: ['a', 'b', 'c', 'd'], answers: [1, 3] }], [{ prompt: 'z', choices: ['a', 'b', 'c', 'd'], answers: [0] }]];
      for (const idx of [1, 3]) { const q = L.create(it, 0); L.advance(q, 5300); if (L.tap(q, 0, idx, 5400).type !== 'win') bad('polyphone answer ' + idx); }
      const q = L.create(it, 0); L.advance(q, 5300); if (L.tap(q, 0, 0, 5400).type !== 'wrong') bad('not an answer'); }
    // fewer items than rounds: the game is as long as the shorter list; zero items goes straight to the end
    { const q = L.create([mkItems(L.rng(1), 4), mkItems(L.rng(2), 7)], 0); if (q.total !== 4) bad('total is the shorter list'); L.advance(q, 1e6); if (q.phase !== 'final' || q.results.length !== 4) bad('short game'); }
    { const q = L.create([[], []], 0); L.advance(q, 1e6); if (q.phase !== 'final') bad('empty game'); }
    // after the end: nothing changes
    s = fresh(); for (let r = 0; r < 10; r++) { L.tap(s, 0, rightOf(s, 0), s.questionStart + 5); L.advance(s, s.phaseEnd); L.advance(s, s.phaseEnd); }
    { const before = JSON.stringify(L.snapshot(s)); const ev = [L.tap(s, 0, 0, 1e7), L.tap(s, 1, 1, 1e7 + 5)]; L.advance(s, 2e7); if (s.phase !== 'final' || JSON.stringify(L.snapshot(s)) !== before || ev.some((x) => x.type !== 'ignored')) bad('state changes after the end'); if (s.scores.join() !== '10,0' || s.outcome.join() !== 'win,lose') bad('a 10-0 game: ' + s.scores + s.outcome); }
    // play again needs both sides
    { if (L.pressAgain(s, 0) !== false || L.pressAgain(s, 1) !== true) bad('play again needs both'); const q = fresh(); if (L.pressAgain(q, 0) || q.again[0]) bad('play again only in the final'); }

    // --- hundreds of random games against an independent reference ---
    for (let g = 0; g < 600; g++) {
      const r = L.rng(1000 + g), items = [mkItems(r, 10), mkItems(r, 10)];
      const st = L.create(items, 0); res.games++;
      const skill = [r(), r()], speed = [200 + r() * 6000, 200 + r() * 6000], idle = g % 25 === 0;
      const ref = { round: -1, locked: [false, false], winner: -1, results: [] };
      let t = 0, guard = 0;
      while (st.phase !== 'final' && guard++ < 4000) {
        t += Math.floor(r() * 2500) + (r() < 0.2 ? 0 : 0);
        L.advance(st, t);
        if (st.phase === 'final') break;
        if (idle) continue;
        const side = r() < 0.5 ? 0 : 1;
        const right = r() < skill[side];
        const item = L.current(st, side);
        const idx = right ? item.answers[0] : [0, 1, 2, 3].find((i) => !item.answers.includes(i));
        if (Math.abs(st.round - ref.round) > 1) bad('round jumped');
        if (st.round !== ref.round) { ref.round = st.round; ref.locked = [false, false]; ref.winner = -1; }
        // what the reference expects from this tap
        const inQ = st.phase === 'question' && t >= st.questionStart && ref.winner === -1;
        const wasLocked = ref.locked[side];
        const ev = L.tap(st, side, idx, t); res.taps++; res.kinds[ev.type] = (res.kinds[ev.type] || 0) + 1;
        let exp;
        if (!inQ) exp = 'ignored'; else if (wasLocked) exp = 'ignored'; else if (right) { exp = 'win'; ref.winner = side; ref.results[st.round] = side; } else { exp = 'wrong'; ref.locked[side] = true; if (ref.locked[0] && ref.locked[1]) { res.bothLocked++; ref.winner = -2; ref.results[st.round] = -1; } }
        if (ev.type !== exp) bad(`game ${g}: tap gave ${ev.type}, reference says ${exp} (phase ${st.phase})`);
        if (st.scores[0] + st.scores[1] !== ref.results.filter((x) => x === 0 || x === 1).length) bad('score sum');
      }
      L.advance(st, t + 200000);
      if (st.phase !== 'final') { bad('game ' + g + ' did not end'); continue; }
      const want = Array.from({ length: 10 }, (_, i) => (ref.results[i] === undefined ? -1 : ref.results[i]));
      if (st.results.join() !== want.join()) bad(`game ${g}: results ${st.results} vs ${want}`);
      if (st.scores[0] !== want.filter((x) => x === 0).length || st.scores[1] !== want.filter((x) => x === 1).length) bad('final scores');
      const [a, b] = st.scores; const o = st.outcome.join();
      if (o !== (a === b ? 'tie,tie' : a > b ? 'win,lose' : 'lose,win')) bad('outcome ' + o + ' for ' + a + ':' + b);
      if (st.total !== 10 || st.round !== 9) bad('rounds');
      res.wins[0] += a > b ? 1 : 0; res.wins[1] += b > a ? 1 : 0;
    }
    // --- determinism: the same seed and the same script give the same game ---
    const play = (seed) => { const r = L.rng(seed), st = L.create([mkItems(r, 10), mkItems(r, 10)], 0), log = []; let t = 0; while (st.phase !== 'final') { t += 400; L.advance(st, t); log.push(L.tap(st, r() < 0.5 ? 0 : 1, Math.floor(r() * 4), t).type); } return JSON.stringify([L.snapshot(st), log]); };
    if (play(42) !== play(42) || play(42) === play(43)) bad('determinism');
    return res;
  });
  ok(R.bad.length === 0, `rules: scripted rounds and ${R.games} simulated games (${R.taps} taps) agree with an independent reference${R.bad.length ? ' -> ' + R.bad.join('; ') : ''}`);
  ok(R.kinds.win > 500 && R.kinds.wrong > 300 && R.kinds.ignored > 500 && R.bothLocked > 20 && R.wins[0] > 50 && R.wins[1] > 50, 'the simulation covered wins, wrong taps, ignored taps, both locked out, and wins for each side: ' + JSON.stringify(R.kinds) + ' both-locked ' + R.bothLocked + ' wins ' + R.wins);

  // =====================================================================================================================================
  // 2. the item maker
  // =====================================================================================================================================
  const G = await p.evaluate(async () => {
    const C = await import('/src/pk-chinese.ts');
    const L = await import('/src/pklogic.ts');
    const rd = await C.loadReadings();
    const res = { bad: [], items: 0, poly: 0, polyBoth: 0, games: 0 };
    const bad = (m) => { if (res.bad.length < 8) res.bad.push(m); };
    // syllable pieces
    const SY = (await import('/src/pk-syllables.ts')).SYLLABLES;
    for (const b of SY) for (const tone of [1, 2, 3, 4]) { const m = C.markSyllable(b, tone), back = C.splitSyllable(m); if (back.base !== b || back.tone !== tone) bad('mark/split ' + b + tone + ' ' + m); if (!/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$/.test(m)) bad('letters ' + m); }
    if (C.markSyllable('hao', 3) !== 'hǎo' || C.markSyllable('liu', 2) !== 'liú' || C.markSyllable('gou', 3) !== 'gǒu' || C.markSyllable('lüe', 4) !== 'lüè' || C.markSyllable('de', 0) !== 'de' || C.markSyllable('xiao', 3) !== 'xiǎo') bad('tone mark placement');
    // a few readings
    if (rd('行').length < 3 || !rd('行').includes('xíng') || !rd('行').includes('háng')) bad('readings of 行: ' + rd('行'));
    if (rd('x').length || rd('😀').length) bad('non Chinese has readings');
    // every character of the stroke library's everyday set, many seeds
    const all = []; for (let c = 0x4e00; c <= 0x9fa5; c += 7) if (rd(String.fromCharCode(c)).length) all.push(String.fromCharCode(c));
    const polys = ['行', '的', '乐', '长', '了', '好', '重', '还', '着', '和', '为', '数', '没', '假', '间', '将'];
    for (const ch of [...all, ...polys, ...polys, ...polys]) {
      const r = L.rng(ch.codePointAt(0) + res.items);
      const it = C.makeItem(ch, rd, r); res.items++;
      const valid = rd(ch);
      if (it.prompt !== ch) bad('prompt');
      if (it.choices.length !== 4 || new Set(it.choices).size !== 4) bad(ch + ' choices not 4 distinct: ' + it.choices);
      if (!it.answers.length || it.answers.some((i) => !valid.includes(it.choices[i]))) bad(ch + ' answer is not a reading');
      it.choices.forEach((c, i) => { if (valid.includes(c) !== it.answers.includes(i)) bad(ch + ': choice ' + c + ' valid=' + valid.includes(c) + ' but answers ' + it.answers); });
      if (it.answers.length > 2 || it.answers.length > valid.length) bad('too many answers');
      if (valid.length > 1) { res.poly++; if (it.answers.length === 2) res.polyBoth++; }
      for (const c of it.choices) if (!/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$/.test(c)) bad('choice letters ' + c);
    }
    // the same seed gives the same item
    if (JSON.stringify(C.makeItem('好', rd, L.rng(9))) !== JSON.stringify(C.makeItem('好', rd, L.rng(9)))) bad('item determinism');
    // distractors are plausible: most share the syllable, the initial or the final of the answer
    let near = 0, tot = 0;
    for (let i = 0; i < 300; i++) { const ch = all[i * 3 % all.length], it = C.makeItem(ch, rd, L.rng(i)), a = C.splitSyllable(rd(ch)[0]).base; for (let k = 0; k < 4; k++) if (!it.answers.includes(k)) { tot++; const b = C.splitSyllable(it.choices[k]).base; if (b === a || b[0] === a[0] || b.slice(-2) === a.slice(-2)) near++; } }
    if (near / tot < 0.8) bad('distractors not plausible: ' + near + '/' + tot);
    // lists: every character shown on a side comes from that side's own list
    const pool = []; for (let c = 0x4e00; c < 0x4e00 + 1200; c++) if (rd(String.fromCharCode(c)).length) pool.push(String.fromCharCode(c));
    const sizes = [4, 5, 7, 9, 10, 11, 14, 25, 40];
    for (let g = 0; g < 300; g++) {
      const r = L.rng(5000 + g), pa = L.shuffled(pool.slice(0, pool.length >> 1), r), pb = L.shuffled(pool.slice(pool.length >> 1), r);
      const la = pa.slice(0, sizes[g % sizes.length]), lb = pb.slice(0, sizes[(g * 7 + 3) % sizes.length]);
      // junk the lists contain: latin letters, a number, an emoji, duplicates, a two-character word
      const A = [...la, 'a', '1', '😀', '词语', la[0]], B = [...lb, 'z', lb[0]];
      const game = C.makeGame([A, B], rd, g + 1); res.games++;
      if (!game) { bad('game not made for ' + la.length + '/' + lb.length); continue; }
      const [ia, ib] = game;
      if (ia.length !== 10 || ib.length !== 10) bad('ten rounds');
      for (const [items, list, name] of [[ia, la, 'A'], [ib, lb, 'B']]) {
        const seq = items.map((x) => x.prompt);
        if (seq.some((c) => !list.includes(c))) bad(name + ' shows a character that is not in its own list');
        if (seq.some((c) => (name === 'A' ? lb : la).includes(c))) bad(name + ' shows a character of the other list');
        if (list.length >= 10 && new Set(seq).size !== 10) bad(name + ' repeats within a game: ' + seq.join(''));
        if (list.length < 10 && new Set(seq).size !== list.length) bad(name + ' did not use its whole short list: ' + seq.join(''));
        for (let i = 1; i < 10; i++) if (seq[i] === seq[i - 1]) bad(name + ' same character twice in a row');
      }
      if (ia.map((x) => x.prompt).join('') === ib.map((x) => x.prompt).join('')) bad('same characters on both sides');
    }
    if (C.makeGame([['山', '水', '火'], [...'山水火土木金']], rd, 1) !== null) bad('3 characters must not make a game');
    if (C.makeGame([['山', '水', '火', 'a', '1'], [...'山水火土木金']], rd, 1) !== null) bad('junk does not count');
    if (!C.makeGame([[...'山水火土'], [...'山水火土']], rd, 1)) bad('4 characters make a game');
    // the same two lists are allowed (two children who know the same characters): each side is its own sequence
    const same = C.makeGame([[...'山水火土木金日月'], [...'山水火土木金日月']], rd, 3);
    if (!same || same[0].map((x) => x.prompt).join('') === same[1].map((x) => x.prompt).join('')) bad('two sides with the same list should still differ');
    return res;
  });
  ok(G.bad.length === 0, `items: ${G.items} questions (4 distinct choices, answers are readings, no wrong choice is a reading), ${G.games} games where each side shows only characters of its own list${G.bad.length ? ' -> ' + G.bad.join('; ') : ''}`);
  ok(G.poly > 40 && G.polyBoth > 5 && G.polyBoth < G.poly, `characters with several readings: ${G.poly}, of which ${G.polyBoth} offered a second right reading`);

  // =====================================================================================================================================
  // 3. the home screen, the setup page
  // =====================================================================================================================================
  await p.evaluate(() => (location.hash = '#/chinese')); await p.waitForSelector('#pk-refs');
  const H = await p.evaluate(() => { const kids = document.querySelector('.kids').getBoundingClientRect(), pk = document.querySelector('#pk-refs').getBoundingClientRect(), card = document.querySelector('#open-pk'); return { below: pk.top >= kids.bottom - 1, left: pk.left, right: innerWidth - pk.right, text: card.textContent, svg: !!card.querySelector('svg'), sw: document.documentElement.scrollWidth, vw: innerWidth }; });
  ok(H.below && Math.abs(H.left - H.right) < 2 && H.text.includes('PK认字') && H.svg && H.sw <= H.vw, 'the 识字 home: the PK card (with its drawing) stands below the list of children, centred, no overflow');
  await p.screenshot({ path: OUT + 'pk-home.png' });
  await p.click('#open-pk'); await p.waitForSelector('#pk-slot-1');
  ok((await p.evaluate(() => location.hash)) === '#/chinese/pk' && await p.isDisabled('#pk-start'), 'the card opens the setup page; Start is off until two players are chosen');
  ok((await p.textContent('#pk-msgs')).includes('请先选择两位选手。'), 'the setup page says to choose two players first');
  // pick player 1, then player 2: the first child cannot be chosen twice
  await p.click('#pk-slot-1'); await p.waitForSelector('#pk-pick');
  ok((await p.locator('.pk-pick-kid').count()) === 4, 'the list shows every child with the picture');
  await p.click('.pk-pick-kid[data-kid=k1]'); await p.waitForSelector('#pk-pick', { state: 'detached' });
  await p.click('#pk-slot-2'); await p.waitForSelector('#pk-pick');
  ok(await p.isDisabled('.pk-pick-kid[data-kid=k1]') && !(await p.isDisabled('.pk-pick-kid[data-kid=k2]')), 'the child already chosen as player 1 cannot be chosen as player 2');
  await p.click('.pk-pick-kid[data-kid=k3]'); await p.waitForSelector('#pk-pick', { state: 'detached' });
  ok(await p.isDisabled('#pk-start') && (await p.textContent('#pk-msgs')).includes('Cy') && (await p.textContent('#pk-msgs')).includes('已入库的字太少，至少需要 4 个。'), 'Cy has 3 characters: Start is off and the message names Cy');
  ok(await p.evaluate(() => !!document.querySelector('#pk-msgs .user')), 'the name in the message is marked as user text');
  await p.click('#pk-slot-2'); await p.click('.pk-pick-kid[data-kid=k4]'); await p.waitForSelector('#pk-pick', { state: 'detached' });
  ok(!(await p.isDisabled('#pk-start')) && (await p.textContent('#pk-msgs')).includes('字会重复出现'), 'Dee has 6 characters: Start is on, a short line says that characters repeat');
  await p.click('#pk-slot-2'); await p.click('.pk-pick-kid[data-kid=k2]'); await p.waitForSelector('#pk-pick', { state: 'detached' });
  ok(!(await p.isDisabled('#pk-start')) && (await p.textContent('#pk-msgs')).trim() === '', 'two children with 10 characters: no message');
  ok((await p.locator('#pk-lay-tb, #pk-lay-lr').count()) === 0 && !(await p.evaluate(() => JSON.stringify(localStorage.getItem('learn.pk.v1') || '')).then((s) => /layout/.test(s))), 'there is no layout choice (one layout only)');
  // the hint for a landscape screen is shown on a landscape screen only
  // the label of the start button is centred exactly (text box centre = button centre), no letter-spacing, no stray spaces
  const measureStart = async (tag) => {
    const m = await p.evaluate(() => { const b = document.querySelector('#pk-start'), tx = document.querySelector('.pk-start-t'), r = document.createRange(); r.selectNodeContents(tx); const a = r.getBoundingClientRect(), c = b.getBoundingClientRect(), cs = getComputedStyle(b); return { dx: a.left + a.width / 2 - (c.left + c.width / 2), dy: a.top + a.height / 2 - (c.top + c.height / 2), ls: cs.letterSpacing, ti: cs.textIndent, txt: tx.textContent, disp: cs.display, jc: cs.justifyContent, w: c.width, h: c.height }; });
    ok(Math.abs(m.dx) <= 1 && Math.abs(m.dy) <= 2.5 && (m.ls === 'normal' || m.ls === '0px') && m.ti === '0px' && m.txt === m.txt.trim() && m.disp === 'flex' && m.jc === 'center' && m.h >= 60, `${tag}: the start button's "${m.txt}" is exactly centred (dx ${m.dx.toFixed(2)}, dy ${m.dy.toFixed(2)}), no letter-spacing / indent, no stray spaces`);
  };
  await measureStart('zh');
  const hint = () => p.evaluate(() => getComputedStyle(document.querySelector('#pk-hint-land')).display);
  ok((await hint()) === 'none', 'portrait screen: no hint line on the setup page');
  await p.setViewportSize({ width: 1180, height: 820 });
  ok((await hint()) === 'block' && (await p.textContent('#pk-hint-land')).includes('竖放设备可获得更大的答题区。'), 'landscape screen: the setup page says that holding the device upright gives a larger answer area');
  await p.screenshot({ path: OUT + 'pk-setup-landscape.png' });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: OUT + 'pk-setup.png' });
  // the record reads like a match
  const setPairs = async (pairs) => { await p.evaluate((pp) => localStorage.setItem('learn.pk.v1', JSON.stringify({ last: ['k1', 'k2'], pairs: pp })), pairs); await p.evaluate(() => (location.hash = '#/chinese')); await p.waitForSelector('#pk-refs'); await p.evaluate(() => (location.hash = '#/chinese/pk')); await p.waitForSelector('#pk-slot-1'); };
  const P = (a, b, wa, wb, ties) => ({ a, b, wins: { [a]: wa, [b]: wb }, ties });
  const allPairs = { 'k1|k2': P('k1', 'k2', 2, 5, 2), 'k3|k4': P('k3', 'k4', 1, 1, 0), 'k1|k4': P('k1', 'k4', 4, 0, 0), 'k2|k3': P('k2', 'k3', 3, 1, 0), 'k2|k4': P('k2', 'k4', 0, 2, 0), 'k1|k3': P('k1', 'k3', 6, 6, 0) };
  await setPairs(allPairs);
  let rows = await p.evaluate(() => [...document.querySelectorAll('.pk-match')].map((r) => ({ pair: r.dataset.pair, text: r.textContent.replace(/\s+/g, ' ').trim(), aria: r.getAttribute('aria-label'), lead: [...r.querySelectorAll('.pk-tile.lead')].map((x) => x.textContent), tiles: [...r.querySelectorAll('.pk-tile')].map((x) => x.textContent), vs: r.querySelectorAll('.pk-vsb svg').length, draws: r.querySelector('.pk-draws')?.textContent || '' })));
  ok(rows.length === 5 && rows[0].pair === 'k1|k2', 'at most 5 rows, the pair of the current choice first (' + rows.map((r) => r.pair).join(' ') + ')');
  ok(rows[0].text === 'Anna VS Ben 2:5 平 2' && rows[0].aria === 'Anna 对 Ben，2 比 5', 'the first row reads "Anna VS Ben 2:5" in the order of the names (' + rows[0].text + ' / ' + rows[0].aria + ')');
  ok(rows[0].lead.join() === '5' && rows[0].draws === '平 2', 'the leader\'s digit is highlighted, the draws are noted after the score');
  const eqRow = rows.find((r) => r.pair === 'k3|k4'), fourRow = rows.find((r) => r.pair === 'k1|k4');
  ok(eqRow.lead.length === 0 && eqRow.tiles.join() === '1,1' && eqRow.draws === '' && fourRow.lead.join() === '4' && fourRow.tiles.join() === '4,0', 'equal score: nobody is highlighted, no draws note; 4:0 highlights the 4');
  ok(rows.every((r) => r.vs === 1), 'every row has the VS badge');
  await setPairs({ ...allPairs, 'k1|k3': { a: 'k1', b: 'k3', wins: {}, ties: 0 } });
  rows = await p.evaluate(() => [...document.querySelectorAll('.pk-match')].map((r) => r.dataset.pair));
  ok(rows.length === 5 && !rows.includes('k1|k3'), 'a pair that never played is not listed');
  for (const [w, h] of [[390, 844], [320, 568], [1180, 820]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(100);
    const m = await p.evaluate(() => { const r = document.querySelector('.pk-match').getBoundingClientRect(), st = document.querySelector('#pk-start').getBoundingClientRect(), pn = document.querySelector('.pk-pn'), vw = innerWidth; return { l: r.left, r: vw - r.right, sw: document.documentElement.scrollWidth, vw, ell: getComputedStyle(pn).textOverflow, col: getComputedStyle(pn).color, sl: st.left, sr: vw - st.right, bad: [...document.querySelectorAll('.pk-match *')].some((e) => e.getBoundingClientRect().right > r.right + 1 || e.getBoundingClientRect().left < r.left - 1) }; });
    ok(Math.abs(m.l - m.r) < 1.5 && m.sw <= m.vw && m.ell === 'ellipsis' && m.col === 'rgb(242, 84, 91)' && !m.bad && Math.abs(m.sl - m.sr) < 1.5, `${w}x${h}: the record rows are centred, inside the page, names in the child's colour with an ellipsis for long names`);
  }
  await p.screenshot({ path: OUT + 'pk-setup-record.png', fullPage: true });
  await setPairs({});
  await p.setViewportSize({ width: 390, height: 844 });
  // one child only: a formal message
  const one = await start(mk(['k1']), { viewport: { width: 390, height: 844 } });
  await one.page.click('#open-pk'); await one.page.waitForSelector('#pk-few');
  ok((await one.page.textContent('#pk-few')).includes('至少需要两个孩子') && !(await one.page.locator('#pk-slot-1').count()), 'with fewer than two children the page only says so');
  await one.browser.close();

  // =====================================================================================================================================
  // 4. the game on the screen
  // =====================================================================================================================================
  await p.setViewportSize({ width: 820, height: 1180 });
  await p.evaluate(() => { window.__pkSeed = 12345; });
  await p.click('#pk-start'); await p.waitForSelector('#pk-stage');
  await p.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 }).catch(() => {});
  ok(await p.evaluate(() => !!document.fullscreenElement), 'Start asks for full screen (the game fills the whole screen)');
  await p.evaluate(() => window.__pk.manual(true));
  await p.click('#pk-exit'); await p.waitForSelector('dialog[open]'); await p.click('dialog[open] button.danger'); await p.waitForSelector('#pk-slot-1');
  await p.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 }).catch(() => {});
  ok(await p.evaluate(() => !document.fullscreenElement), 'leaving the game leaves full screen');
  await p.evaluate(() => { document.documentElement.requestFullscreen = () => Promise.reject(new Error('off in the test: a full screen window cannot be resized')); });   // (the rest of the test resizes the window)
  await p.click('#pk-start'); await p.waitForSelector('#pk-stage');
  await p.evaluate(() => window.__pk.manual(true));
  const S = () => p.evaluate(() => window.__pk.state());
  const step = (ms) => p.evaluate((m) => window.__pk.step(m), ms);
  const toPhase = async (ph) => { for (let i = 0; i < 80; i++) { const s = await S(); if (s.phase === ph) return s; await p.evaluate(() => { const s = window.__pk.state(); window.__pk.step(Math.max(1, s.phaseEnd - window.__pk.T())); }); } throw new Error('never reached ' + ph); };
  const tap = (side, i) => p.evaluate(([a, b]) => window.__pk.tap(a, b), [side, i]);
  const geo = () => p.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const frame = document.querySelector('#pk-frame');
    const out = { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, frame: r(frame), mid: r(document.querySelector('#pk-mid')), panels: [] };
    for (const side of [0, 1]) {
      const el = document.querySelector(`.pk-panel[data-side="${side}"]`), cs = getComputedStyle(el);
      const opts = [...el.querySelectorAll('.pk-opt')];
      out.panels[side] = { box: r(el), transform: cs.transform, w: el.offsetWidth, h: el.offsetHeight, opts: opts.map(r), optOver: opts.map((o) => o.scrollWidth > o.clientWidth + 1), ch: r(el.querySelector('.pk-ch')), choices: r(el.querySelector('.pk-choices')), top: r(el.querySelector('.pk-top')), row4: el.classList.contains('row4'), chText: el.querySelector('.pk-ch').textContent, hide: el.querySelector('.pk-ch').classList.contains('hide'), chOver: el.querySelector('.pk-ch').scrollWidth > el.querySelector('.pk-char').clientWidth + 1 };
    }
    return out;
  });
  const rot = (tr) => { const m = /matrix\(([^)]+)\)/.exec(tr); if (!m) return 0; const [a, b] = m[1].split(',').map(Number); return Math.round((Math.atan2(b, a) * 180) / Math.PI); };

  let s = await S();
  ok(s.seed === 12345 && s.phase === 'intro' && s.total === 10, 'the game starts with the opening (names, VS) and 10 rounds; the test seed is used');
  let g = await geo();
  const overTexts = () => p.evaluate(() => [0, 1].map((side) => document.querySelector(`.pk-panel[data-side="${side}"] .pk-over`).textContent.trim()));
  const overHtml = (sel) => p.evaluate((q) => [0, 1].map((side) => !!document.querySelector(`.pk-panel[data-side="${side}"] .pk-over ${q}`)), sel);
  // the order of the opening, seen through the hook: intro (avatars, VS), 3, 2, 1, GO, then the first round is announced
  const seq = [];
  for (let i = 0; i < 80; i++) {
    const st = await S(), tagq = st.phase + (st.phase === 'countdown' ? st.count : '');
    const els = await p.evaluate(() => { const o = document.querySelector('.pk-panel[data-side="0"] .pk-over'); return ['.pk-vs', '.pk-vp.me', '.pk-vp.opp', '.pk-slash', '.pk-pkmark', '.pk-num', '.pk-cd.go'].filter((q) => o.querySelector(q)).join(' '); });
    if (!seq.length || seq[seq.length - 1][0] !== tagq) seq.push([tagq, els, (await overTexts()).join('|')]);
    if (st.phase === 'prep') break;
    await step(100);
  }
  ok(seq.map((x) => x[0]).join() === 'intro,countdown3,countdown2,countdown1,countdown0,prep', 'opening order: ' + seq.map((x) => x[0]).join(' > '));
  ok(seq[0][1] === '.pk-vs .pk-vp.me .pk-vp.opp .pk-slash .pk-pkmark' && seq[1][1] === '.pk-num' && seq[4][1] === '.pk-cd.go', 'the VS screen has both player panels, the slash and the PK mark; the countdown shows a huge number; GO is a burst');
  ok(seq[1][2] === '3|3' && seq[2][2] === '2|2' && seq[3][2] === '1|1' && seq[4][2] === 'GO!|GO!', 'countdown 3, 2, 1, GO on both halves');
  ok(seq[0][2].split('|').every((x) => x.includes('Anna') && x.includes('Ben') && x.includes('准备')), 'the opening names both players on both halves');
  ok((await p.evaluate(() => window.__pk.state().phaseEnd)) > 0, 'timeline');
  ok(await p.evaluate(() => [...document.querySelectorAll('.pk-vp.me .avatar')].every((a) => a.offsetWidth >= 40)), 'the avatars of the opening are big');
  await p.screenshot({ path: OUT + 'pk-intro.png' });
  // a skip button during the opening; not afterwards
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#pk-skip')).display === 'none'), 'no skip button once the round is announced');
  g = await geo();
  ok(g.panels[0].hide && g.panels[1].hide, 'before the reveal the characters are hidden on both halves');
  const before = await S();
  await tap(0, before.items[0].answers[0]);
  ok((await S()).scores.join() === '0,0', 'a tap before the reveal is ignored');
  s = await toPhase('question');
  g = await geo();
  const listA = [...LISTS.k1], listB = [...LISTS.k2];
  ok(!g.panels[0].hide && !g.panels[1].hide && listA.includes(g.panels[0].chText) && listB.includes(g.panels[1].chText) && g.panels[0].chText !== g.panels[1].chText, `question: the bottom half shows ${g.panels[0].chText} (from Anna's list), the top half ${g.panels[1].chText} (from Ben's list)`);
  ok(rot(g.panels[1].transform) === 180 && rot(g.panels[0].transform) === 0, 'the top half is turned by exactly 180 degrees, the bottom half is not turned');
  ok(g.panels[0].box.t > g.panels[1].box.t && Math.abs(g.panels[0].box.h - g.panels[1].box.h) <= 1, 'player 1 (Anna) has the bottom half, player 2 (Ben) the top half, both of the same size');
  // each half: character above the four choices, 2 x 2
  const lay = (pn, turned) => {
    const o = pn.opts;
    const rows = new Set(o.map((b) => Math.round(b.t / 4))).size, cols = new Set(o.map((b) => Math.round(b.l / 4))).size;
    const above = turned ? pn.ch.t > pn.choices.b - 1 : pn.ch.b <= pn.choices.t + 1;   // (the turned half: its top is the lower edge of the screen)
    return { rows, cols, above };
  };
  let l0 = lay(g.panels[0], false), l1 = lay(g.panels[1], true);
  ok(l0.rows === 2 && l0.cols === 2 && l1.rows === 2 && l1.cols === 2, 'four choices in a 2 x 2 grid on each half');
  ok(l0.above && l1.above, 'the character is above the choices in each player\'s own view (the top half is the mirror image)');
  ok(g.panels.every((q) => q.opts.every((b) => b.h >= 56 && b.w >= 56)) && g.panels.every((q) => q.choices.h / q.box.h >= 0.4), `choice buttons >= 56 px and the grid is ${(100 * g.panels[0].choices.h / g.panels[0].box.h).toFixed(0)} % of the half's height`);
  ok(Math.abs(g.frame.l - (g.vw - g.frame.r)) < 1.5 && g.sw <= g.vw && g.sh <= g.vh, 'the stage is centred with equal space left and right; no scrolling');
  await p.screenshot({ path: OUT + 'pk-question.png' });
  // keys are not shown without a keyboard; shown after one was used
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.pk-kb')).display === 'none'), 'no key hints before a key was pressed');
  // wrong tap locks that side only; the other may still win
  const wrongIdx = (st, side) => [0, 1, 2, 3].find((i) => !st.items[side].answers.includes(i));
  await tap(1, wrongIdx(s, 1));
  let q = await S();
  ok(q.locked.join() === 'true,false' || q.locked.join() === 'false,true', 'a wrong tap locks the player out');
  const lockedHalf = await p.evaluate(() => [...document.querySelectorAll('.pk-panel')].map((e) => [e.dataset.side, e.classList.contains('is-locked'), [...e.querySelectorAll('.pk-opt')].every((b) => b.classList.contains('dimmed') || b.classList.contains('wrong'))]));
  ok(lockedHalf.find((x) => x[0] === '1')[1] && lockedHalf.find((x) => x[0] === '1')[2] && !lockedHalf.find((x) => x[0] === '0')[1], 'the locked half dims its buttons, the other half does not');
  const re = await tap(1, s.items[1].answers[0]);
  ok(re.type === 'ignored' && (await S()).scores.join() === '0,0', 'the locked player cannot try again in this round');
  await tap(0, s.items[0].answers[0]);
  q = await S();
  ok(q.scores.join() === '1,0' && q.phase === 'result' && q.winner === 0, 'the other player taps the right reading: +1 and the round is over');
  const resView = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`); return { win: e.classList.contains('is-win'), lose: e.classList.contains('is-lose'), plus: e.querySelector('.pk-plus')?.textContent || '', right: e.querySelectorAll('.pk-opt.right').length, wrong: e.querySelectorAll('.pk-opt.wrong').length, score: e.querySelector('.pk-score').textContent }; }));
  ok(resView[0].win && resView[0].plus === '+1' && resView[0].right === 1 && resView[1].lose && resView[1].right >= 1 && resView[1].wrong === 1 && resView[0].score === '1', 'result: the winner\'s half says +1, both halves show the right reading in green, the loser\'s half is dimmed and keeps its wrong tap in red');
  await p.screenshot({ path: OUT + 'pk-result.png' });
  // 1.4 s later the next round starts by itself
  await step(1399); ok((await S()).phase === 'result', 'the result stays 1.4 seconds');
  await step(2); q = await S(); ok(q.phase === 'prep' && q.round === 1, 'then the next round starts by itself');
  ok((await p.textContent('.pk-panel[data-side="0"] .pk-round')) === '第 2 / 10 题', 'the round counter reads "第 2 / 10 题"');
  // timeout and both locked
  s = await toPhase('question'); await step(12000); q = await S();
  ok(q.phase === 'result' && q.winner === -1 && q.results[1] === -1, 'nobody answers: the round ends after 12 seconds without a point');
  ok((await p.textContent('.pk-panel[data-side="0"] .pk-over')).includes('本题无人得分。'), 'the result says nobody scored');
  await toPhase('question'); s = await S();
  await tap(0, wrongIdx(s, 0)); await tap(1, wrongIdx(s, 1)); q = await S();
  ok(q.phase === 'result' && q.winner === -1 && q.results[2] === -1 && q.scores.join() === '1,0', 'both players wrong: the round ends, no point');
  // the keyboard: player 1 keys 1-4, player 2 keys 7 8 9 0
  await toPhase('question'); s = await S();
  await p.keyboard.press('Escape'); await p.waitForSelector('dialog[open]'); await p.keyboard.press('Escape'); await p.waitForSelector('dialog', { state: 'detached' });
  ok(await p.evaluate(() => document.querySelector('#pk-stage').classList.contains('kbd') && getComputedStyle(document.querySelector('.pk-kb')).display !== 'none'), 'after a key press the key hints are shown');
  await p.keyboard.press(['7', '8', '9', '0'][s.items[1].answers[0]]);
  q = await S(); ok(q.winner === 1 && q.scores.join() === '1,1', 'keyboard: player 2 answers with 7 8 9 0');
  await toPhase('question'); s = await S();
  await p.keyboard.press(String(s.items[0].answers[0] + 1)); q = await S();
  ok(q.winner === 0 && q.scores.join() === '2,1', 'keyboard: player 1 answers with 1 2 3 4');

  // competitive touches: the tug of war, the streak badge, the fast-answer flash
  const tugNow = () => p.evaluate(() => { const t = document.querySelector('#pk-tug'), a = t.querySelector('.a').getBoundingClientRect(), r = t.getBoundingClientRect(), k = t.querySelector('.knot').getBoundingClientRect(); return { pos: document.querySelector('#pk-mid').dataset.tug, a: a.width / r.width, knot: (k.left + k.width / 2 - r.left) / r.width, ca: getComputedStyle(t.querySelector('.a')).backgroundColor, cb: getComputedStyle(t.querySelector('.b')).backgroundColor }; });
  let tg = await tugNow();
  ok(tg.pos === '0.10' && Math.abs(tg.a - 0.55) < 0.03 && Math.abs(tg.knot - 0.55) < 0.03 && tg.ca === 'rgb(242, 84, 91)' && tg.cb === 'rgb(28, 126, 214)', 'tug of war: 2 : 1 after 5 rounds and the knot sits at 55 % toward the leader (Anna, red, grows from the left; Ben, blue, from the right)');
  await toPhase('question'); s = await S(); await step(800); await tap(0, s.items[0].answers[0]);
  let cmp = await p.evaluate(() => ({ fast: document.querySelector('.pk-panel[data-side="0"] .pk-fast')?.textContent.trim(), other: !!document.querySelector('.pk-panel[data-side="1"] .pk-fast'), s0: document.querySelector('.pk-panel[data-side="0"] .pk-streak').textContent, on0: document.querySelector('.pk-panel[data-side="0"] .pk-streak').classList.contains('on') }));
  ok(cmp.fast === '抢答 0.8 秒' && !cmp.other, 'fast-answer flash on the winner\'s half only: "' + cmp.fast + '"');
  ok(cmp.on0 && cmp.s0 === '连胜 ×2', 'two rounds won in a row: the streak badge says "' + cmp.s0 + '"');
  await step(1500); await toPhase('question'); s = await S(); await tap(0, s.items[0].answers[0]);
  cmp = await p.evaluate(() => ({ s0: document.querySelector('.pk-panel[data-side="0"] .pk-streak').textContent, s1on: document.querySelector('.pk-panel[data-side="1"] .pk-streak').classList.contains('on') }));
  ok(cmp.s0 === '连胜 ×3' && !cmp.s1on, 'three in a row: "' + cmp.s0 + '", the other half shows no badge');
  tg = await tugNow();
  ok(tg.pos === '0.30' && Math.abs(tg.a - 0.65) < 0.03, 'the knot moved on toward the leader (' + tg.pos + ')');
  await step(1500);
  // play the rest: side 0 wins every remaining round; check the final screens
  while ((await S()).phase !== 'final') { const st = await toPhase('question'); await tap(0, st.items[0].answers[0]); await step(1500); }
  q = await S();
  ok(q.phase === 'final' && q.results.length === 10 && q.outcome.join() === 'win,lose', `after round 10 the game ends: ${q.scores.join(':')}`);
  const fin = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`); return { verdict: e.querySelector('.pk-verdict')?.textContent, again: e.querySelector('.pk-again')?.textContent, ico: !!e.querySelector('.pk-trophy svg, .pk-face svg'), cls: e.querySelector('.pk-final')?.className, score: e.querySelector('.pk-fscore')?.textContent }; }));
  ok(fin[0].verdict === '你赢了。' && fin[1].verdict === '你输了。' && fin[0].ico && fin[1].ico && /win/.test(fin[0].cls) && /lose/.test(fin[1].cls) && fin[0].again === '再来一局' && fin[1].again === '再来一局', 'final: the winner\'s half says 你赢了。 with a trophy, the loser\'s half 你输了。; each half has its own "play again"');
  ok(fin[0].score.split(':').map((x) => x.trim()).reverse().join(':') === fin[1].score.split(':').map((x) => x.trim()).join(':'), 'each half shows the score from its own side');
  g = await geo();
  ok(rot(g.panels[1].transform) === 180 && rot(g.panels[0].transform) === 0, 'the final screens keep the same turn: the top half is read from the top');
  const parts = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`); const q = (s) => e.querySelectorAll(s).length; return { rays: q('.pk-rays'), trophy: q('.pk-trophy svg'), crown: q('.pk-crown svg'), happy: q('.f-happy'), cloud: q('.pk-cloud svg'), sad: q('.f-sad'), plead: q('.f-plead'), eq: q('.pk-eq'), canvas: q('canvas.pk-fx'), anim: [...e.querySelectorAll('.pk-trophy, .pk-buddy, .pk-rays, .pk-verdict')].map((x) => getComputedStyle(x).animationName) }; }));
  ok(parts[0].rays === 1 && parts[0].trophy === 1 && parts[0].crown === 1 && parts[0].happy === 1 && parts[0].cloud === 0 && parts[0].sad === 0, 'winner\'s half: golden rays, trophy, crown, happy face (no cloud, no sad face)');
  ok(parts[1].cloud === 1 && parts[1].sad === 1 && parts[1].plead === 1 && parts[1].rays === 0 && parts[1].trophy === 0 && parts[1].crown === 0, 'loser\'s half: rain cloud, sad face and the pleading face (no rays, no trophy, no crown)');
  ok(parts.every((x) => x.canvas === 0 && x.anim.every((a) => a === 'none')), 'reduced motion: no particles (no canvas) and no animations on the final pictures, the still pictures stay');
  const ret = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`), b = e.querySelector('.pk-again').getBoundingClientRect(), r = e.getBoundingClientRect(); return { dx: (b.left + b.width / 2) - (r.left + r.width / 2), h: b.height, w: b.width }; }));
  ok(ret.every((x) => Math.abs(x.dx) <= 1.5 && x.h >= 55.5 && x.w >= 150), 'the "再来一局" button is centred in each half and big');
  await p.screenshot({ path: OUT + 'pk-final.png' });
  // the record
  const hist = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.pk.v1')).rec.chinese);
  ok(Object.keys(hist).length === 1 && Object.values(hist)[0].wins.k1 === 1 && (Object.values(hist)[0].wins.k2 || 0) === 0, 'the result is saved on this device (one win for Anna)');
  // play again needs both
  await p.click('#pk-again-1'); q = await S();
  ok(q.phase === 'final' && q.again.join() === 'true,false' && (await p.textContent('#pk-again-1')) === '等待对方。' && await p.isDisabled('#pk-again-1'), 'one player presses play again: the half says to wait for the other player');
  await p.click('#pk-again-2'); q = await S();
  ok(q.phase === 'intro' && q.scores.join() === '0,0' && q.seed === 12346, 'both pressed: a new game starts (new seed), scores back to 0');
  // exit: confirmation while a game runs; Escape asks too; the clock waits while the box is open
  await p.click('#pk-exit'); await p.waitForSelector('dialog[open]');
  ok((await p.textContent('dialog[open]')).includes('退出对战？'), 'leaving a game that runs asks first');
  await p.click('dialog[open] button:has-text("取消")'); await p.waitForSelector('dialog', { state: 'detached' });
  ok((await p.evaluate(() => location.hash)) === '#/chinese/pk/play' && (await S()).phase === 'intro', 'cancelling stays in the game');
  await p.keyboard.press('Escape'); await p.waitForSelector('dialog[open]');
  await p.click('dialog[open] button.danger'); await p.waitForSelector('#pk-slot-1');
  ok((await p.evaluate(() => location.hash)) === '#/chinese/pk' && !(await p.evaluate(() => !!window.__pk)), 'Escape asks too; confirming returns to the setup page');
  const histAfter = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.pk.v1')).rec.chinese);
  ok(JSON.stringify(histAfter) === JSON.stringify(hist), 'a game that was left is not recorded');
  const rowText = async () => (await p.textContent('.pk-match')).replace(/\s+/g, ' ').trim();
  ok((await rowText()) === 'Anna VS Ben 1:0', 'the record reads like a match: "' + (await rowText()) + '"');
  ok(await p.evaluate(() => document.querySelector('#pk-slot-1 .kname').textContent === 'Anna'), 'the last pick (Anna, Ben) is remembered');
  // reset of the record
  await p.click('#pk-reset'); await p.waitForSelector('dialog[open]'); await p.click('dialog[open] button:has-text("取消")'); await p.waitForSelector('dialog', { state: 'detached' });
  ok((await p.locator('.pk-match').count()) === 1, 'cancelling the reset keeps the record');
  await p.click('#pk-reset'); await p.click('dialog[open] button.danger'); await p.waitForSelector('.pk-match', { state: 'detached' });
  ok(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('learn.pk.v1')).rec.chinese).length === 0), 'the reset clears the record');
  // a tie and a loss by the first player
  const playout = async (plan, after) => { while ((await S()).phase !== 'final') { const st = await toPhase('question'); if (plan(st) !== null) { await tap(plan(st), st.items[plan(st)].answers[0]); if (after) await after(st); } else await step(12000); await step(1500); } return S(); };
  await p.click('#pk-start'); await p.waitForSelector('#pk-stage'); await p.evaluate(() => window.__pk.manual(true));
  q = await playout((st) => st.round % 2); // alternating: 5 : 5
  const tie = await p.evaluate(() => [0, 1].map((side) => document.querySelector(`.pk-panel[data-side="${side}"] .pk-verdict`).textContent));
  ok(q.outcome.join() === 'tie,tie' && tie.join() === '平局。,平局。', 'a tie shows 平局。 on both halves');
  await p.screenshot({ path: OUT + 'pk-tie.png' });
  await p.click('#pk-exit'); await p.waitForSelector('#pk-slot-1');
  ok(await p.evaluate(() => { const x = Object.values(JSON.parse(localStorage.getItem('learn.pk.v1')).rec.chinese)[0]; return x.ties === 1; }), 'finishing needs no confirmation; a tie is recorded as a tie');
  await p.click('#pk-start'); await p.waitForSelector('#pk-stage'); await p.evaluate(() => window.__pk.manual(true));
  const swaps = [];
  q = await playout((st) => (st.round < 3 ? 0 : 1), async (st) => { swaps.push([st.round, await p.evaluate(() => [...document.querySelectorAll('.pk-panel')].map((e) => e.dataset.side + (e.classList.contains('is-swap') ? 'S' : '')).join(' '))]); });
  ok(swaps.filter((x) => /1S/.test(x[1])).map((x) => x[0]).join() === '6', 'lead change: only in the round where Ben went ahead (3 : 3 -> 3 : 4) his half pulses (' + swaps.filter((x) => /S/.test(x[1])).map((x) => x[0] + ':' + x[1]).join(' / ') + ')');
  const lose = await p.evaluate(() => [0, 1].map((side) => document.querySelector(`.pk-panel[data-side="${side}"] .pk-verdict`).textContent));
  ok(q.outcome.join() === 'lose,win' && lose.join() === '你输了。,你赢了。', 'player 2 wins 7 : 3: the top half says 你赢了。, the bottom half 你输了。');
  await p.screenshot({ path: OUT + 'pk-final-top-wins.png' });
  await p.click('#pk-exit'); await p.waitForSelector('#pk-slot-1');

  // =====================================================================================================================================
  // 5. six screen sizes, both orientations: the same portrait stage
  // =====================================================================================================================================
  await p.click('#pk-start'); await p.waitForSelector('#pk-stage'); await p.evaluate(() => window.__pk.manual(true));
  await toPhase('question');
  for (const [w, h] of SIZES) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
    const gg = await geo(), land = w > h;
    const tag = `${w}x${h}`;
    const pn = gg.panels;
    ok(rot(pn[1].transform) === 180 && rot(pn[0].transform) === 0, `${tag}: top half 180 degrees, bottom half 0`);
    const inside = pn.every((q2) => q2.box.l >= gg.frame.l - 1 && q2.box.r <= gg.frame.r + 1 && q2.box.t >= gg.frame.t - 1 && q2.box.b <= gg.frame.b + 1 && q2.opts.every((b) => b.l >= q2.box.l - 1 && b.r <= q2.box.r + 1 && b.t >= q2.box.t - 1 && b.b <= q2.box.b + 1) && q2.ch.t >= q2.box.t - 1 && q2.ch.b <= q2.box.b + 1 && q2.ch.l >= q2.box.l - 1 && q2.ch.r <= q2.box.r + 1);
    ok(inside && gg.sw <= gg.vw && gg.sh <= gg.vh && pn.every((q2) => !q2.chOver && q2.optOver.every((x) => !x)), `${tag}: every half, character and button inside the screen, no overflow, no clipped label`);
    ok(pn.every((q2) => q2.opts.every((b) => b.h >= 55.5)), `${tag}: choice buttons >= 56 px high (${Math.min(...pn.flatMap((q2) => q2.opts.map((b) => Math.round(b.h))))} px)`);
    const lr = pn.map((q2, i) => lay(q2, i === 1));
    ok(land || (lr.every((x) => x.rows === 2 && x.cols === 2 && x.above) && pn.every((q2) => q2.choices.h / q2.box.h >= 0.4)), `${tag}: ${land ? 'landscape screen (the same stage, see below)' : 'portrait halves: character above a 2 x 2 grid that takes >= 40 % of the half'}`);
    ok(Math.abs(gg.frame.l - (gg.vw - gg.frame.r)) < 1.5, `${tag}: equal space left and right (${Math.round(gg.frame.l)} / ${Math.round(gg.vw - gg.frame.r)} px)`);
    if (land) ok(gg.frame.w / gg.frame.h <= 0.76 && gg.frame.w / gg.frame.h >= 0.7 && (await p.evaluate(() => getComputedStyle(document.querySelector('#pk-hint')).display !== 'none')), `${tag}: landscape shows the same 3:4 stage in the middle and the hint line`);
    else ok(Math.abs(gg.frame.w - gg.vw) <= 1 && (await p.evaluate(() => getComputedStyle(document.querySelector('#pk-hint')).display === 'none')), `${tag}: portrait fills the width, no hint line`);
    ok(pn[0].choices.h > 0 && Math.abs(pn[0].box.h - pn[1].box.h) <= 1, `${tag}: both halves have the same size`);
    await p.screenshot({ path: OUT + `pk-q-${tag}.png` });
  }
  // the final screen on each size
  await p.setViewportSize({ width: 390, height: 844 });
  await playout(() => 0);
  for (const [w, h] of SIZES) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
    const fit = await p.evaluate(() => [0, 1].map((side) => { const e = document.querySelector(`.pk-panel[data-side="${side}"]`), pb = e.getBoundingClientRect(); return [...e.querySelectorAll('.pk-stage2, .pk-verdict, .pk-fscore, .pk-again')].every((x) => { const r = x.getBoundingClientRect(); return r.left >= pb.left - 1 && r.right <= pb.right + 1 && r.top >= pb.top - 1 && r.bottom <= pb.bottom + 1; }) && e.querySelector('.pk-again').getBoundingClientRect().height >= 55.5; }));
    ok(fit.every(Boolean), `${w}x${h}: final screen: pictures, words, score and the "play again" button (>= 56 px) fit inside each half`);
    await p.screenshot({ path: OUT + `pk-f-${w}x${h}.png` });
  }
  // the exit button of the final screen sits at the centre line
  const mid = await p.evaluate(() => { const b = document.querySelector('#pk-exit').getBoundingClientRect(), m = document.querySelector('#pk-mid').getBoundingClientRect(); return { cy: b.top + b.height / 2, my: m.top + m.height / 2, text: document.querySelector('#pk-exit').getAttribute('aria-label') }; });
  ok(Math.abs(mid.cy - mid.my) < 7 && mid.text === '返回', 'the shared "返回" button is on the centre line');

  // =====================================================================================================================================
  // 6. English and French
  // =====================================================================================================================================
  await p.click('#pk-exit'); await p.waitForSelector('#pk-slot-1');
  for (const lang of ['en', 'fr']) {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(async (lg) => {
      const D = await import('/src/i18n-data.ts'), X = await import('/src/i18n-extra/pk.json'), I = await import('/src/i18n.ts');
      const x = X.default || X; Object.entries(x).forEach(([k, v]) => { D.EN[k] = v[0]; D.FR[k] = v[1]; });
      I.setLang(lg);
    }, lang);
    await p.waitForTimeout(150);
    const cjk = (sel) => p.evaluate((s2) => { const bad = []; const walk = (n) => { if (n.nodeType === 3) { if (/[一-鿿]/.test(n.nodeValue) && !n.parentElement.closest('.user, .user-title')) bad.push(n.nodeValue.trim()); } else if (n.nodeType === 1 && !['SVG', 'svg', 'SCRIPT', 'STYLE'].includes(n.tagName)) { for (const a of ['title', 'aria-label']) if (/[一-鿿]/.test(n.getAttribute(a) || '')) bad.push(a + ':' + n.getAttribute(a)); n.childNodes.forEach(walk); } }; document.querySelectorAll(s2).forEach(walk); return bad; }, sel);
    let bad = await cjk('#app');
    ok(bad.length === 0, `${lang}: setup page has no Chinese left (${bad.join(' | ')})`);
    await p.screenshot({ path: OUT + `pk-setup-${lang}.png` });
    await measureStart(lang);
    await p.click('#pk-start'); await p.waitForSelector('#pk-stage'); await p.evaluate(() => window.__pk.manual(true));
    bad = await cjk('#app'); ok(bad.length === 0, `${lang}: intro has no Chinese left (${bad.join(' | ')})`);
    await toPhase('countdown'); bad = await cjk('#app'); ok(bad.length === 0, `${lang}: countdown (${bad.join(' | ')})`);
    await toPhase('question'); bad = await cjk('#app'); ok(bad.length === 0, `${lang}: question (${bad.join(' | ')})`);
    await p.screenshot({ path: OUT + `pk-q-${lang}.png` });
    let st = await S(); await tap(0, st.items[0].answers[0]); bad = await cjk('#app'); ok(bad.length === 0, `${lang}: result (${bad.join(' | ')})`);
    await step(1500); await toPhase('question'); await step(12000); bad = await cjk('#app'); ok(bad.length === 0, `${lang}: nobody scored (${bad.join(' | ')})`);
    await p.click('#pk-exit'); await p.waitForSelector('dialog[open]'); bad = await cjk('dialog[open]'); ok(bad.length === 0, `${lang}: leave box (${bad.join(' | ')})`);
    await p.click('dialog[open] button:has-text("' + (lang === 'en' ? 'Cancel' : 'Annuler') + '")');
    await playout(() => 0); bad = await cjk('#app'); ok(bad.length === 0, `${lang}: final (${bad.join(' | ')})`);
    await p.click('#pk-again-1'); bad = await cjk('#app'); ok(bad.length === 0, `${lang}: waiting (${bad.join(' | ')})`);
    await p.screenshot({ path: OUT + `pk-f-${lang}.png` });
    await p.click('#pk-exit'); await p.waitForSelector('#pk-slot-1');
    const fits = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(fits, `${lang}: nothing sideways on the setup page`);
  }
  await p.evaluate(async () => { const I = await import('/src/i18n.ts'); I.setLang('zh'); });
  ok(t.log.external.length === 0, 'no request left the app: ' + t.log.external.join(','));
  await t.browser.close();

  // =====================================================================================================================================
  // 6b. motion on: the pictures move, particles are drawn; motion is cosmetic and nothing keeps running after the game
  // =====================================================================================================================================
  const mo = await start(mk(['k1', 'k2']), { motion: true, viewport: { width: 390, height: 844 } });
  const mp = mo.page;
  await mp.evaluate(() => {
    localStorage.setItem('learn.pk.v1', JSON.stringify({ last: ['k1', 'k2'], pairs: {} }));
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('off in the test'));
    window.__pkSeed = 9;
    const live = (window.__live = { raf: new Set(), iv: new Set() });
    const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window), si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
    window.requestAnimationFrame = (cb) => { const id = raf((ts) => { live.raf.delete(id); cb(ts); }); live.raf.add(id); return id; };
    window.cancelAnimationFrame = (id) => { live.raf.delete(id); caf(id); };
    window.setInterval = (cb, ms, ...a) => { const id = si(cb, ms, ...a); live.iv.add(id); return id; };
    window.clearInterval = (id) => { live.iv.delete(id); ci(id); };
  });
  await mp.evaluate(() => (location.hash = '#/chinese/pk')); await mp.waitForSelector('#pk-slot-1'); await mp.waitForTimeout(300);
  const animOf = (sel) => mp.evaluate((q) => { const e = document.querySelector(q); return e ? getComputedStyle(e).animationName : 'missing'; }, sel);
  const anSetup = [await animOf('#pk-start'), await animOf('.pk-slot .avatar'), await animOf('.pk-pkm.big')];
  ok(anSetup.every((x) => x !== 'none' && x !== 'missing'), 'motion on: the start button glows, the avatars bob and the VS badge wobbles (' + anSetup.join(', ') + ')');
  const base = await mp.evaluate(() => ({ raf: window.__live.raf.size, iv: window.__live.iv.size }));
  const mS = () => mp.evaluate(() => window.__pk.state());
  const mStep = (ms) => mp.evaluate((m) => window.__pk.step(m), ms);
  const mTo = async (ph) => { for (let i = 0; i < 80; i++) { if ((await mS()).phase === ph) return; await mp.evaluate(() => { const s = window.__pk.state(); window.__pk.step(Math.max(1, s.phaseEnd - window.__pk.T())); }); } };
  const mPlay = async (plan) => { while ((await mS()).phase !== 'final') { await mTo('question'); const st = await mS(), who = plan(st); if (who !== null) await mp.evaluate(([a, b]) => window.__pk.tap(a, b), [who, st.items[who].answers[0]]); await mStep(1500); } };
  const start1 = async () => { await mp.click('#pk-start', { force: true }); await mp.waitForSelector('#pk-stage'); await mp.evaluate(() => window.__pk.manual(true)); };
  await start1(); await mp.waitForTimeout(200);
  const anIntro = [await animOf('.pk-vp.me'), await animOf('.pk-vp.opp'), await animOf('.pk-pkm.mark'), await animOf('.pk-slash')];
  ok(anIntro.every((x) => x !== 'none' && x !== 'missing'), 'motion on: the player panels slam in, the PK mark stamps, the slash cuts in (' + anIntro.join(', ') + ')');
  await mTo('countdown'); await mp.waitForTimeout(100);
  ok((await animOf('.pk-num')) !== 'none' && (await animOf('.pk-cd .pk-shock')) !== 'none' && (await animOf('.pk-cflash')) !== 'none', 'motion on: the countdown number slams in with a shockwave ring and a flash');
  await mTo('question'); await mp.waitForTimeout(100);
  ok((await animOf('.pk-ch')) !== 'none' && (await mp.evaluate(() => getComputedStyle(document.querySelector('.pk-timer i')).transitionDuration)) !== '0s', 'motion on: the character pops in, the timer bar moves smoothly');
  const tapWin = async () => { const st = await mS(); await mp.evaluate(([a, b]) => window.__pk.tap(a, b), [0, st.items[0].answers[0]]); await mp.waitForTimeout(80); };
  await tapWin();
  ok((await animOf('.pk-panel[data-side="0"] .pk-opt.right')) !== 'none' && (await animOf('.pk-panel[data-side="0"] .pk-plus')) !== 'none' && (await mp.evaluate(() => document.querySelectorAll('.pk-panel[data-side="0"] .pk-hit .pk-spk').length)) === 8, 'motion on: the right answer hops, "+1" floats up and sparkles appear at the tapped button');
  await mStep(1500);
  await mPlay(() => 0);
  // fireworks and confetti are drawn on a canvas in the winner's half
  let ink = 0;
  for (let i = 0; i < 40 && ink < 25; i++) { await mp.waitForTimeout(150); ink = await mp.evaluate(() => { const c = document.querySelector('.pk-panel[data-side="0"] canvas.pk-fx'); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4 * 7) if (d[k] > 20) n++; return n; }); }
  ok(ink > 20, 'winner\'s half: the canvas shows fireworks / confetti (' + ink + ' painted samples)');
  const fx = await mp.evaluate(() => ({ w: document.querySelectorAll('.pk-panel[data-side="0"] canvas.pk-fx').length, l: document.querySelectorAll('.pk-panel[data-side="1"] canvas.pk-fx').length, size: (() => { const c = document.querySelector('.pk-panel[data-side="0"] canvas.pk-fx'), o = document.querySelector('.pk-panel[data-side="0"] .pk-over'); return [c.offsetWidth === o.offsetWidth, c.offsetHeight === o.offsetHeight, c.width >= c.offsetWidth]; })(), raf: window.__live.raf.size }));
  ok(fx.w === 1 && fx.l === 0 && fx.size.every(Boolean) && fx.raf >= 1, 'only the winner\'s half has a particle canvas, sized by layout size (dpr aware); one frame loop runs');
  await mp.waitForTimeout(1500);
  const anFin = [await animOf('.pk-panel[data-side="0"] .pk-trophy'), await animOf('.pk-panel[data-side="0"] .pk-rays'), await animOf('.pk-panel[data-side="0"] .pk-verdict'), await animOf('.pk-panel[data-side="0"] .pk-bav'), await animOf('.pk-panel[data-side="1"] .pk-cloud'), await animOf('.pk-panel[data-side="1"] .pk-final .pk-again'), await animOf('.pk-panel[data-side="1"] .pk-verdict'), await animOf('.pk-panel[data-side="1"] .pk-buddy')];
  ok(anFin.every((x) => x !== 'none' && x !== 'missing'), 'motion on: trophy drops, rays turn, the verdict shimmers, the winner jumps; the loser\'s cloud drifts, the retry button wobbles, the verdict settles, the avatar slumps (' + anFin.join(', ') + ')');
  const faces = await mp.evaluate(() => { const q = (s) => getComputedStyle(document.querySelector(`.pk-panel[data-side="1"] ${s}`)); return [q('.f-sad').opacity, q('.f-plead').opacity]; });
  ok(faces[0] === '0' && faces[1] === '1', 'after about 1.2 s the loser\'s sad face gives way to the pleading face (' + faces.join(' / ') + ')');
  await mp.screenshot({ path: OUT + 'pk-motion-final.png' });
  // leaving stops everything
  await mp.click('#pk-exit', { force: true }); await mp.waitForSelector('#pk-slot-1'); await mp.waitForTimeout(300);
  let after = await mp.evaluate(() => ({ raf: window.__live.raf.size, iv: window.__live.iv.size, hook: !!window.__pk, fx: document.querySelectorAll('canvas').length }));
  ok(after.raf === base.raf && after.iv === base.iv && !after.hook && after.fx === 0, `leaving after a win: no frame loop, no timer, no canvas left (raf ${after.raf}/${base.raf}, intervals ${after.iv}/${base.iv})`);
  // a tie draws a calmer canvas; leaving in the middle of a game (with the confirmation) leaves nothing either
  await start1(); await mPlay((st) => st.round % 2); await mp.waitForTimeout(400);
  ok((await mp.evaluate(() => document.querySelectorAll('canvas.pk-fx').length)) === 2 && (await mp.evaluate(() => document.querySelectorAll('.pk-eq').length)) === 2, 'tie: both halves show "=" and a canvas of confetti');
  await mp.click('#pk-again-1', { force: true }); await mp.click('#pk-again-2', { force: true });
  ok((await mp.evaluate(() => document.querySelectorAll('canvas').length)) === 0, 'play again: the particles of the last game are gone');
  await mp.click('#pk-exit'); await mp.waitForSelector('dialog[open]'); await mp.click('dialog[open] button.danger'); await mp.waitForSelector('#pk-slot-1'); await mp.waitForTimeout(300);
  after = await mp.evaluate(() => ({ raf: window.__live.raf.size, iv: window.__live.iv.size }));
  ok(after.raf === base.raf && after.iv === base.iv, `leaving in the middle: nothing keeps running (raf ${after.raf}/${base.raf}, intervals ${after.iv}/${base.iv})`);
  // the skip button during the opening
  await start1();
  ok(await mp.evaluate(() => getComputedStyle(document.querySelector('#pk-skip')).display !== 'none' && document.querySelector('#pk-dots').style.display === 'none'), 'during the opening the centre line has a "跳过" button instead of the round dots');
  await mp.click('#pk-skip'); await mp.waitForTimeout(50);
  ok((await mS()).phase === 'prep' && await mp.evaluate(() => getComputedStyle(document.querySelector('#pk-skip')).display === 'none'), 'skip goes straight to the first round');
  ok(mo.log.external.length === 0, 'motion session: no outside request');
  await mo.browser.close();

  // =====================================================================================================================================
  // 7. real touch events on the turned buttons (CDP, dpr 2, two fingers)
  // =====================================================================================================================================
  const tt = await start(mk(['k1', 'k2']), { touch: true, dpr: 2, viewport: { width: 820, height: 1180 }, motion: false });
  const tp = tt.page;
  await tp.addInitScript(() => { window.__pkSeed = 777; });
  await tp.evaluate(() => { localStorage.setItem('learn.pk.v1', JSON.stringify({ mute: true, last: ['k1', 'k2'], pairs: {} })); });
  await tp.evaluate(() => (location.hash = '#/chinese/pk/play')); await tp.waitForSelector('#pk-stage');
  await tp.reload(); await tp.waitForSelector('#pk-stage');
  const cdp = await tt.ctx.newCDPSession(tp);
  const where = (side, i) => tp.evaluate(([a, b]) => { const r = document.querySelector(`.pk-panel[data-side="${a}"] .pk-opt[data-i="${b}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [side, i]);
  const fingers = async (pts, ts) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i + 1 })), ...(ts ? { timestamp: ts } : {}) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const S2 = () => tp.evaluate(() => window.__pk.state());
  const toQ = async () => { for (let i = 0; i < 40; i++) { const st = await S2(); if (st.phase === 'question') return st; await tp.evaluate(() => { const st2 = window.__pk.state(); window.__pk.skip(Math.max(1, st2.phaseEnd - window.__pk.T() + 5)); }); await tp.waitForTimeout(20); } throw new Error('no question'); };
  let st = await toQ();
  // a finger on the TURNED top half's right button: that player scores
  let pt = await where(1, st.items[1].answers[0]);
  await fingers([pt]);
  st = await S2();
  ok(st.scores.join() === '0,1' && st.winner === 1, 'a real touch on the turned (top) half\'s right button scores for player 2 only');
  await tp.waitForTimeout(50);
  // the bottom half: a wrong touch locks player 1 only
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ();
  const wrongI = (side) => [0, 1, 2, 3].find((i) => !st.items[side].answers.includes(i));
  pt = await where(0, wrongI(0)); await fingers([pt]); st = await S2();
  ok(st.locked.join() === 'true,false' && st.phase === 'question', 'a real wrong touch on the bottom half locks player 1 only');
  // two fingers at once, one on each half: the right taps of both halves arrive together; only one point is given
  await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
  st = await toQ();
  const pA = await where(0, st.items[0].answers[0]), pB = await where(1, st.items[1].answers[0]);
  await fingers([pB, pA]);
  st = await S2();
  ok(st.scores.join() === '0,2', 'two fingers down in the same moment, one on each half: exactly one point is given, to the touch that arrived first (' + st.scores.join(':') + ')');
  // two touches of different times: the earlier TIME wins, also when it is delivered second (CDP carries the time of each touch)
  for (const [firstAt, secondAt, steal] of [[0.05, 0.02, true], [0.02, 0.05, false]]) {
    await tp.evaluate(() => { const s2 = window.__pk.state(); window.__pk.skip(Math.max(1, s2.phaseEnd - window.__pk.T() + 5)); });
    st = await toQ();
    await tp.evaluate(() => window.__pk.skip(500));
    const base = Date.now() / 1000 - 0.25, a = await where(0, st.items[0].answers[0]), b = await where(1, st.items[1].answers[0]);
    const sc0 = st.scores.slice();
    await fingers([b], base + firstAt); await fingers([a], base + secondAt);
    st = await S2();
    ok(st.scores[0] + st.scores[1] === sc0[0] + sc0[1] + 1, 'the two touches give exactly one point');
    ok((st.scores[0] === sc0[0] + 1) === steal, steal ? 'the touch with the EARLIER time (player 1, 30 ms before) wins although it was delivered second' : 'the touch delivered second with the LATER time does not take the point');
  }
  // dpr 2 geometry: the buttons were hit where they are drawn (checked by every tap above); the panel is exactly twice as many device pixels
  ok(await tp.evaluate(() => devicePixelRatio === 2), 'the touch checks ran at device pixel ratio 2');
  await tp.screenshot({ path: OUT + 'pk-touch.png' });
  ok(tt.log.external.length === 0, 'touch session: no outside request');
  await tt.browser.close();
  await done();
})();
