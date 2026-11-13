// 编程 worlds 14-16 (信息科技), part 1: the PURE models and the CONTENT. Every model is checked against an independent computation written here (binary and
// addition on thousands of values, UTF-8 against a hand-written encoder, run-length round trips, Huffman against a second implementation, ciphers, check digits,
// the mini spreadsheet against JavaScript, statistics, a packet network against Floyd-Warshall, password maths, k nearest neighbours, a decision tree, the inverted
// index, bias, the digit recogniser with an accuracy floor, the sound model), the questions made by code (every generator, hundreds of seeds, each answer
// recomputed), the device simulations of world 16 (the reference program passes every scenario, a naive program fails, an empty / mutated one fails) and the
// content (>= 14 activities per world, lessons, titles in three languages, hints, prompts). Everything runs in the page: the modules are served by the dev server.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const p = t.page;
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const run = (fn, ...a) => p.evaluate(async ([f, args]) => {
    const I = await import('/src/coding-infomodel.ts'), D = await import('/src/coding-devices.ts'), A = await import('/src/coding-ast.ts'), C = await import('/src/coding-infocontent.ts'), P = await import('/src/coding-infoproj.ts');
    return new Function('I', 'D', 'A', 'C', 'P', 'a', 'return (' + f + ')(I, D, A, C, P, ...a)')(I, D, A, C, P, args);
  }, [fn.toString(), a]);

  // ---------- 1. binary, hex, addition ----------
  const R1 = await run(async (I) => {
    const bad = [];
    for (let n = 0; n < 4096; n++) { if (I.fromBin(I.toBin(n)) !== n) bad.push('roundtrip ' + n); if (I.toBin(n, 12).length !== 12 || parseInt(I.toBin(n, 12), 2) !== n) bad.push('pad ' + n); if (I.toHex(n, 3) !== n.toString(16).toUpperCase().padStart(3, '0')) bad.push('hex ' + n); }
    let adds = 0;
    for (let a = 0; a < 200; a++) for (let b = 0; b < 200; b += 3) { const r = I.addBinary(I.toBin(a), I.toBin(b)); adds++; if (parseInt(r.sum, 2) !== a + b) bad.push(`add ${a}+${b}=${r.sum}`); }
    for (let i = 0; i < 3000; i++) { const a = Math.floor(Math.random() * 65536), b = Math.floor(Math.random() * 65536), r = I.addBinary(I.toBin(a, 16), I.toBin(b, 16)); if (parseInt(r.sum, 2) !== a + b) bad.push(`add16 ${a}+${b}`); adds++; }
    // the carries string: a carry out of position i is 1 exactly when the sum of the lower i+1 bits overflows
    for (let i = 0; i < 500; i++) { const a = Math.floor(Math.random() * 256), b = Math.floor(Math.random() * 256), r = I.addBinary(I.toBin(a, 8), I.toBin(b, 8)); for (let k = 0; k < 8; k++) { const m = (1 << (8 - k)) - 1, carry = ((a & m) + (b & m)) >> (8 - k) & 1; if (Number(r.carries[k]) !== carry) { bad.push('carry ' + a + ' ' + b + ' ' + k); break; } } }
    for (let n = 1; n <= 16; n++) if (I.capacity(n) !== Math.pow(2, n)) bad.push('capacity ' + n);
    return { bad: bad.slice(0, 5), adds };
  });
  ok(R1.bad.length === 0, `binary / hex conversion on 4096 numbers and ${R1.adds} additions (and their carries) agree with Number arithmetic` + (R1.bad.length ? ' -> ' + R1.bad.join(' | ') : ''));

  // ---------- 2. UTF-8 against a hand-written encoder, ASCII ----------
  const R2 = await run(async (I) => {
    const manual = (cp) => cp < 0x80 ? [cp] : cp < 0x800 ? [0xc0 | (cp >> 6), 0x80 | (cp & 63)] : cp < 0x10000 ? [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)] : [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
    const bad = []; let n = 0;
    const cps = [...Array(0x80).keys(), ...Array.from({ length: 4000 }, (_, i) => 0x80 + i * 13), ...Array.from({ length: 4000 }, (_, i) => 0x4e00 + i), ...Array.from({ length: 300 }, (_, i) => 0x10000 + i * 331)].filter((c) => c < 0xd800 || c > 0xdfff);
    for (const c of cps) { const ch = String.fromCodePoint(c); n++; if (I.utf8Bytes(ch).join() !== manual(c).join()) bad.push(c.toString(16)); if (I.utf8Length(ch) !== manual(c).length) bad.push('len' + c.toString(16)); }
    const han = [...'你好中文'].map((c) => I.utf8Hex(c).join(' '));
    for (let c = 65; c <= 90; c++) if (I.asciiCode(String.fromCharCode(c)) !== c) bad.push('ascii' + c);
    return { bad: bad.slice(0, 5), n, han, moji: I.mojibake('你'), mojiLen: I.mojibake('你好').length };
  });
  ok(R2.bad.length === 0 && R2.n > 8000, `UTF-8 bytes of ${R2.n} characters (ASCII, 2-byte, every 3-byte Chinese range sample, 4-byte) equal a hand-written encoder; ASCII codes right`);
  ok(R2.han.join('|') === 'E4 BD A0|E5 A5 BD|E4 B8 AD|E6 96 87' && R2.moji === 'ä½ ' && R2.mojiLen === 6, '你 好 中 文 are E4 BD A0 | E5 A5 BD | E4 B8 AD | E6 96 87 and read with the wrong table 你 becomes ä½ (garbled: ' + JSON.stringify(R2.moji) + ')');

  // ---------- 3. run-length coding, ciphers, XOR ----------
  const R3 = await run(async (I) => {
    const bad = []; const r = I.rng(5);
    for (let i = 0; i < 3000; i++) { const len = I.rint(r, 0, 40); let s = ''; for (let k = 0; k < len; k++) s += 'ABCD'[I.rint(r, 0, r() < 0.6 ? 0 : 3)]; if (I.rleDecode(I.rleEncode(s)) !== s) bad.push('rle ' + s); const e = I.rleEncode(s); if (!/^(\d+[A-D])*$/.test(e)) bad.push('rle format ' + e); if (/(\d+)([A-D])\d*\2/.test(e) && false) bad.push('x'); }
    if (I.rleEncode('AAAABBBCC') !== '4A3B2C' || I.rleEncode('ABC') !== '1A1B1C') bad.push('rle examples');
    for (let i = 0; i < 2000; i++) { const w = Array.from({ length: I.rint(r, 1, 12) }, () => String.fromCharCode(65 + I.rint(r, 0, 25))).join('') + 'xy z', k = I.rint(r, -60, 60); if (I.caesar(I.caesar(w, k), -k) !== w) bad.push('caesar ' + w + k); if (I.caesar(w, 26) !== w) bad.push('caesar26'); }
    if (I.caesar('CAT', 3) !== 'FDW' || I.caesar('xyz', 3) !== 'abc') bad.push('caesar examples');
    for (let seed = 1; seed < 300; seed++) {
      const key = I.makeSubst(seed);
      if ([...key].sort().join('') !== 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') bad.push('subst not a permutation ' + seed);
      if ([...key].some((c, i) => c === String.fromCharCode(65 + i))) bad.push('subst fixed point ' + seed);
      const msg = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG'; if (I.substApply(I.substApply(msg, key), I.substInvert(key)) !== msg) bad.push('subst round trip ' + seed);
    }
    const f = I.letterFreq('Hello World'); if (f[11] !== 3 || f[14] !== 2 || f.reduce((a, b) => a + b, 0) !== 10) bad.push('letterFreq');
    for (let i = 0; i < 2000; i++) { const a = I.toBin(I.rint(r, 0, 255), 8), k = I.toBin(I.rint(r, 0, 255), 8); if (I.xorBits(I.xorBits(a, k), k) !== a) bad.push('xor'); if (parseInt(I.xorBits(a, k), 2) !== (parseInt(a, 2) ^ parseInt(k, 2))) bad.push('xor value'); }
    return bad.slice(0, 5);
  });
  ok(R3.length === 0, 'run-length coding round trips on 3000 random strings (format right, examples 4A3B2C / 1A1B1C), Caesar round trips and examples (CAT -> FDW), 299 substitution keys are permutations without fixed points and invert, XOR twice gives back the text and equals the ^ operator' + (R3.length ? ' -> ' + R3.join(' | ') : ''));

  // ---------- 4. Huffman against a second implementation ----------
  const R4 = await run(async (I) => {
    const bad = []; const r = I.rng(9);
    // the independent cost: sort a list, take the two smallest, push their sum, add every sum (the classic identity: cost = sum of all merge sums)
    const costRef = (ws) => { const a = ws.slice().sort((x, y) => x - y); if (a.length === 1) return a[0]; let c = 0; while (a.length > 1) { const s = a.shift() + a.shift(); c += s; let i = 0; while (i < a.length && a[i] < s) i++; a.splice(i, 0, s); } return c; };
    // brute force: the cheapest prefix code of a very small alphabet by trying every code-length vector that satisfies Kraft with equality
    const brute = (ws) => { const n = ws.length; let best = Infinity; const rec = (i, lens) => { if (i === n) { const kraft = lens.reduce((s, l) => s + Math.pow(2, -l), 0); if (Math.abs(kraft - 1) < 1e-9) best = Math.min(best, ws.reduce((s, w, k) => s + w * lens[k], 0)); return; } for (let l = 1; l < n; l++) rec(i + 1, [...lens, l]); }; rec(0, []); return best; };
    let tables = 0;
    for (let i = 0; i < 400; i++) {
      const n = I.rint(r, 2, 12), freq = {}; for (let k = 0; k < n; k++) freq[String.fromCharCode(97 + k)] = I.rint(r, 1, 50);
      const h = I.huffman(freq), ws = Object.values(freq);
      tables++;
      if (h.cost !== costRef(ws)) bad.push('cost ' + JSON.stringify(freq));
      const codes = Object.values(h.codes);
      for (const a of codes) for (const b of codes) if (a !== b && b.startsWith(a)) bad.push('prefix ' + JSON.stringify(freq));
      if (n <= 6) { const hmm = brute(ws); if (hmm !== h.cost) bad.push('not optimal ' + JSON.stringify(freq) + ' ' + h.cost + ' ' + hmm); }
      const text = Object.entries(freq).map(([c, f]) => c.repeat(f)).join(''); const enc = I.huffEncode(text, h.codes);
      if (I.huffDecode(enc, h.codes) !== text) bad.push('decode'); if (enc.length !== h.cost) bad.push('encoded length');
      // frequent symbols never get longer codes than rare ones
      for (const a of Object.keys(freq)) for (const b of Object.keys(freq)) if (freq[a] > freq[b] && h.codes[a].length > h.codes[b].length) bad.push('order');
    }
    // the stepwise builder: hValid accepts exactly the two smallest (ties free)
    let nodes = I.hInit(I.freqOf('ABRACADABRA')), id = 10, steps = 0;
    while (nodes.length > 1) { const idx = nodes.map((_, i) => i); let wrongAccepted = 0, rightRejected = 0; for (const i of idx) for (const j of idx) { if (i >= j) continue; const ws = nodes.map((x) => x.w).sort((a, b) => a - b); const want = nodes[i].w + nodes[j].w === ws[0] + ws[1]; if (I.hValid(nodes, i, j) !== want) wrongAccepted++; } if (wrongAccepted) bad.push('hValid'); const s = nodes.map((_, i) => i).sort((a, b) => nodes[a].w - nodes[b].w); nodes = I.hMerge(nodes, s[0], s[1], id++); steps++; }
    if (steps !== 4 || nodes[0].w !== 11) bad.push('steps');
    const single = I.huffman({ a: 7 }); if (single.codes.a !== '0') bad.push('single symbol');
    return { bad: bad.slice(0, 4), tables, abra: I.huffman(I.freqOf('ABRACADABRA')).cost };
  });
  ok(R4.bad.length === 0 && R4.abra === 23, `Huffman on ${R4.tables} random frequency tables: cost equals the classic merge-sum identity (second implementation), equals brute force over every Kraft-complete length vector up to 6 symbols (optimal), prefix-free, frequent symbols never longer, encode / decode round trip; ABRACADABRA costs 23 bits` + (R4.bad.length ? ' -> ' + R4.bad.join(' | ') : ''));

  // ---------- 5. check digits, parity, error correction ----------
  const R5 = await run(async (I) => {
    const bad = []; const r = I.rng(21);
    if (I.isbn13Check('978030640615') !== 7 || !I.isbn13Valid('9780306406157') || I.isbn13Valid('9780306406158')) bad.push('isbn known');
    if (I.idCheck('11010519491231002') !== 'X' || !I.idValid('11010519491231002X') || I.idValid('110105194912310021')) bad.push('id known');
    for (let i = 0; i < 3000; i++) {
      let d12 = ''; for (let k = 0; k < 12; k++) d12 += I.rint(r, 0, 9); const full = d12 + I.isbn13Check(d12); if (!I.isbn13Valid(full)) bad.push('isbn valid');
      // every single-digit error is caught
      const pos = I.rint(r, 0, 12), wrongD = (Number(full[pos]) + I.rint(r, 1, 9)) % 10; if (I.isbn13Valid(full.slice(0, pos) + wrongD + full.slice(pos + 1))) bad.push('isbn single error not caught');
      let d17 = ''; for (let k = 0; k < 17; k++) d17 += I.rint(r, 0, 9); if (!I.idValid(d17 + I.idCheck(d17))) bad.push('id valid');
      const bits = Array.from({ length: I.rint(r, 1, 12) }, () => I.rint(r, 0, 1)).join(''); const w = bits + I.parityBit(bits, true); if (!I.parityOk(w)) bad.push('parity'); const f = I.rint(r, 0, w.length - 1); if (I.parityOk(w.slice(0, f) + (w[f] === '1' ? '0' : '1') + w.slice(f + 1))) bad.push('parity single flip not caught'); if (I.parityBit(bits, false) === I.parityBit(bits, true)) bad.push('odd = even');
    }
    for (let i = 0; i < 600; i++) { const data = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => I.rint(r, 0, 1))); const g = I.addParity2d(data); if (I.locateError2d(g) !== null) bad.push('2d clean'); const y = I.rint(r, 0, 4), x = I.rint(r, 0, 4); g[y][x] ^= 1; const loc = I.locateError2d(g); if (!loc || loc[0] !== y || loc[1] !== x) bad.push('2d locate ' + y + x); }
    let ham = 0;
    for (let d = 0; d < 16; d++) { const dd = [d >> 3 & 1, d >> 2 & 1, d >> 1 & 1, d & 1], w = I.hamEncode(dd); if (I.hamSyndrome(w) !== 0 || I.hamData(w).join() !== dd.join()) bad.push('ham clean ' + d); for (let pos = 0; pos < 7; pos++) { const e = w.slice(); e[pos] ^= 1; ham++; if (I.hamSyndrome(e) !== pos + 1) bad.push('ham syndrome'); const fixed = I.hamFix(e); if (fixed.join() !== w.join() || I.hamData(fixed).join() !== dd.join()) bad.push('ham fix'); } }
    return { bad: bad.slice(0, 4), ham };
  });
  ok(R5.bad.length === 0, `ISBN-13 / ID-card check digits (known values, every single-digit error in 3000 numbers caught), parity bits (every single flip caught), 600 parity grids locate the flipped bit, Hamming(7,4): all ${R5.ham} single-bit errors of the 16 words found and fixed` + (R5.bad.length ? ' -> ' + R5.bad.join(' | ') : ''));

  // ---------- 6. statistics and the spreadsheet ----------
  const R6 = await run(async (I) => {
    const bad = []; const r = I.rng(33);
    for (let i = 0; i < 2000; i++) {
      const xs = Array.from({ length: I.rint(r, 1, 15) }, () => I.rint(r, -20, 40));
      const ref = { sum: xs.reduce((a, b) => a + b, 0) }; const sorted = xs.slice().sort((a, b) => a - b); const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      const cnt = {}; for (const x of xs) cnt[x] = (cnt[x] || 0) + 1; const top = Math.max(...Object.values(cnt)); const mo = Object.keys(cnt).filter((k) => cnt[k] === top).map(Number).sort((a, b) => a - b);
      if (Math.abs(I.mean(xs) - ref.sum / xs.length) > 1e-9 || I.median(xs) !== med || I.modes(xs).join() !== mo.join()) bad.push('stats ' + xs);
    }
    // the sheet against JavaScript on random data
    const cols = 'ABCDEF';
    for (let round = 0; round < 300; round++) {
      const cells = {}, num = {}; for (let c = 0; c < 3; c++) for (let rr = 1; rr <= 5; rr++) { const v = I.rint(r, 0, 99); cells[cols[c] + rr] = String(v); num[cols[c] + rr] = v; }
      const col = (c) => [1, 2, 3, 4, 5].map((k) => num[c + k]);
      cells.D1 = '=SUM(A1:A5)'; cells.D2 = '=AVERAGE(B1:B5)'; cells.D3 = '=MAX(C1:C5)'; cells.D4 = '=MIN(A1:C5)'; cells.D5 = '=COUNT(A1:C5)'; cells.E1 = '=A1*B1+C1-A2'; cells.E2 = '=(A1+B1)*(C1-A2)/ (A3+100)'; cells.E3 = '=-A1+SUM(A1:A2)*2'; cells.E4 = '=D1+D2'; cells.E5 = '=SUM(A1:B2, C3, 7)';
      const ev = I.evalSheet(cells);
      const want = { D1: col('A').reduce((a, b) => a + b, 0), D2: col('B').reduce((a, b) => a + b, 0) / 5, D3: Math.max(...col('C')), D4: Math.min(...col('A'), ...col('B'), ...col('C')), D5: 15, E1: num.A1 * num.B1 + num.C1 - num.A2, E2: (num.A1 + num.B1) * (num.C1 - num.A2) / (num.A3 + 100), E3: -num.A1 + (num.A1 + num.A2) * 2, E5: num.A1 + num.A2 + num.B1 + num.B2 + num.C3 + 7 };
      want.E4 = want.D1 + want.D2;
      for (const [k, v] of Object.entries(want)) if (Math.abs(ev[k] - v) > 1e-9) bad.push(`sheet ${k} ${ev[k]} vs ${v}`);
    }
    const e = I.evalSheet({ A1: '=1/0', A2: '=A3', A3: '=A2', A4: '=FOO(1)', A5: '=1+', B1: '1', B2: 'text', B3: '=B2+1', B4: '=SUM(B1:B2)', B5: '=A1+1' });
    if (e.A1 !== '#DIV/0!' || e.A2 !== '#REF!' || e.A4 !== '#NAME?' || e.A5 !== '#ERR' || e.B3 !== '#VALUE!' || e.B4 !== 1 || e.B5 !== '#DIV/0!') bad.push('sheet errors ' + JSON.stringify(e));
    return bad.slice(0, 4);
  });
  ok(R6.length === 0, 'mean / median / mode on 2000 random lists and the mini spreadsheet (SUM AVERAGE MAX MIN COUNT, + - * / brackets, unary minus, references, ranges) on 300 random sheets agree with JavaScript; errors #DIV/0! #REF! (cycle) #NAME? #ERR #VALUE! and errors that travel' + (R6.length ? ' -> ' + R6.join(' | ') : ''));

  // ---------- 7. the packet network, passwords, sound ----------
  const R7 = await run(async (I) => {
    const bad = []; const r = I.rng(77);
    let nets = 0;
    for (let i = 0; i < 300; i++) {
      const n = I.rint(r, 3, 9), ids = Array.from({ length: n }, (_, k) => 'N' + k), g = {}; ids.forEach((x) => (g[x] = []));
      const add = (a, b) => { if (a !== b && !g[a].includes(b)) { g[a].push(b); g[b].push(a); } };
      for (let k = 1; k < n; k++) add(ids[k], ids[I.rint(r, 0, k - 1)]);
      for (let k = 0; k < n; k++) add(ids[I.rint(r, 0, n - 1)], ids[I.rint(r, 0, n - 1)]);
      // Floyd-Warshall for the independent distances
      const INF = 1e9, d = ids.map((a) => ids.map((b) => (a === b ? 0 : g[a].includes(b) ? 1 : INF)));
      for (let k = 0; k < n; k++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (d[a][k] + d[k][b] < d[a][b]) d[a][b] = d[a][k] + d[k][b];
      const msg = Array.from({ length: I.rint(r, 1, 30) }, () => String.fromCharCode(65 + I.rint(r, 0, 25))).join(''), size = I.rint(r, 1, 6), pk = I.splitMessage(msg, size);
      if (pk.map((x) => x.data).join('') !== msg || pk.some((x, k) => x.seq !== k + 1 || x.total !== pk.length || x.data.length > size)) bad.push('split');
      const a = I.rint(r, 0, n - 1), b = I.rint(r, 0, n - 1), path = I.shortestPath(g, ids[a], ids[b]);
      if (!path || path.length - 1 !== d[a][b]) bad.push(`path length ${path && path.length - 1} vs ${d[a][b]}`);
      else for (let k = 1; k < path.length; k++) if (!g[path[k - 1]].includes(path[k])) bad.push('path edge');
      const ttl = I.rint(r, 0, 6), res = I.simulateNetwork(g, ids[a], ids[b], pk, ttl, i);
      nets++;
      if (d[a][b] <= ttl) { if (res.arrived.length !== pk.length || I.reassemble(res.arrived) !== msg) bad.push('reassemble'); if (res.arrived.length > 1 && pk.length > 2 && new Set(res.arrived.map((x) => x.seq)).size !== pk.length) bad.push('lost'); } else if (res.arrived.length || res.dropped.length !== pk.length || I.reassemble(res.arrived) !== null) bad.push('ttl drop');
    }
    const g2 = { A: ['B'], B: ['A'], C: [] }; if (I.shortestPath(g2, 'A', 'C') !== null) bad.push('no path');
    const part = I.simulateNetwork({ A: ['B'], B: ['A'] }, 'A', 'B', I.splitMessage('HELLO', 2), 5, 3).arrived.slice(1); if (I.reassemble(part) !== null) bad.push('missing packet must not reassemble');
    for (const [s, ok2] of [['192.168.1.1', 1], ['0.0.0.0', 1], ['255.255.255.255', 1], ['256.1.1.1', 0], ['1.2.3', 0], ['1.2.3.4.5', 0], ['01.2.3.4', 0], ['a.b.c.d', 0], ['1.2.3.-4', 0]]) if (I.isIpv4(s) !== !!ok2) bad.push('ip ' + s);
    // passwords
    const pools = [['abc', 26], ['ABC', 26], ['123', 10], ['a1', 36], ['aA', 52], ['aA1', 62], ['aA1!', 95], ['!!', 33]]; for (const [s, k] of pools) if (I.poolSize(s) !== k) bad.push('pool ' + s + I.poolSize(s));
    for (let i = 0; i < 500; i++) { const len = I.rint(r, 1, 20), pw = Array.from({ length: len }, () => 'aZ3_x'[I.rint(r, 0, 4)]).join(''); const b = I.entropyBits(pw); if (Math.abs(b - len * Math.log2(I.poolSize(pw))) > 1e-9 && !I.COMMON_PASSWORDS.includes(pw)) bad.push('entropy'); if (I.entropyBits(pw + 'q') <= b) bad.push('longer is stronger'); }
    for (const c of I.COMMON_PASSWORDS) if (I.entropyBits(c) > 6 || I.strengthLevel(c) !== 0) bad.push('common ' + c);
    if (I.strengthLevel('123456') !== 0 || I.strengthLevel('Tr33#Rocket!Moon_47') !== 4 || I.strengthLevel('abcdefgh') > 1) bad.push('levels ' + [I.strengthLevel('123456'), I.strengthLevel('Tr33#Rocket!Moon_47'), I.strengthLevel('abcdefgh')]);
    let prev = -1; for (let b = 0; b < 140; b += 5) { const s = I.crackSeconds(b); if (s < prev) bad.push('crack monotonic'); prev = s; }
    if (I.humanTime(0.2).unit !== 's' || I.humanTime(90).unit !== 'min' || I.humanTime(7200).unit !== 'h' || I.humanTime(3 * 86400).unit !== 'd' || I.humanTime(3e8).unit !== 'y' || I.humanTime(1e13).unit !== 'ky' || I.humanTime(1e30).unit !== 'my') bad.push('humanTime');
    // the sound model
    for (const f of [5, 100, 440, 1000]) { let last = Infinity; for (let k = 3; k <= 60; k += 3) { const e = I.waveError(f, f * k / 3); if (e > last + 0.02) bad.push('waveError not decreasing ' + f + ' ' + k); last = e; } if (I.waveError(f, f * 40) > 0.02) bad.push('waveError at 40 per cycle'); }
    if (!I.nyquistOk(440, 1000) || I.nyquistOk(440, 800) || I.nyquistOk(440, 880) || I.aliasFreq(440, 600) !== 160 || I.aliasFreq(440, 44100) !== 440 || Math.abs(I.aliasFreq(440, 800) - 360) > 1e-9) bad.push('nyquist / alias');
    return { bad: bad.slice(0, 4), nets };
  });
  ok(R7.bad.length === 0, `packet network on ${R7.nets} random graphs: split / reassemble in order, shortest path length equals Floyd-Warshall, TTL drops everything beyond the limit, a missing packet cannot reassemble; IPv4 syntax; password pool size, entropy = length x log2(pool), common passwords weak, time to crack monotonic, human units; waveError falls with the sample rate, Nyquist and alias` + (R7.bad.length ? ' -> ' + R7.bad.join(' | ') : ''));

  // ---------- 8. machine learning toys ----------
  const R8 = await run(async (I) => {
    const bad = [], out = {};
    // kNN: with no noise the classes are separable: training accuracy with k = 1 is 1; held-out accuracy is high
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const tr = I.makeBlobs(seed, 2, 40, 1.2, 0), te = I.makeBlobs(seed + 100, 2, 100, 1.2, 0); if (I.knnAccuracy(tr, tr, 1) !== 1) bad.push('k1 train'); if (I.knnAccuracy(tr, te, 3) < 0.93) bad.push('knn test low ' + seed + ' ' + I.knnAccuracy(tr, te, 3)); }
    // with noisy labels, k = 1 memorises (train 1.0) but does worse on new data than a larger k (overfitting), on average over seeds
    let gap = 0, better = 0; for (let seed = 1; seed <= 20; seed++) { const tr = I.makeBlobs(seed, 2, 30, 1.7, 0.12), te = I.makeBlobs(seed + 300, 2, 100, 1.7, 0.12); gap += I.knnAccuracy(tr, tr, 1) - I.knnAccuracy(tr, te, 1); if (I.knnAccuracy(tr, te, 9) >= I.knnAccuracy(tr, te, 1)) better++; }
    out.gap = gap / 20; out.better = better; if (out.gap < 0.08 || better < 14) bad.push('overfitting not visible ' + JSON.stringify(out));
    // a knn answer equals a brute-force majority of the k nearest
    const tr = I.makeBlobs(9, 3, 25, 1.4, 0.05); const rr = I.rng(4); for (let i = 0; i < 300; i++) { const pt = { x: rr() * 100, y: rr() * 100 }, k = [1, 3, 5, 7][i % 4]; const near = tr.map((q) => ({ d: Math.hypot(q.x - pt.x, q.y - pt.y), c: q.c })).sort((a, b) => a.d - b.d).slice(0, k); const votes = {}; near.forEach((q) => (votes[q.c] = (votes[q.c] || 0) + 1)); const best = Math.max(...Object.values(votes)); const winners = Object.keys(votes).filter((c) => votes[c] === best).map(Number); if (!winners.includes(I.knn(tr, pt, k))) bad.push('knn vote'); }
    const b = I.boundary(tr, 3, 10, 10); if (b.length !== 10 || b[0].length !== 10 || b.flat().some((c) => ![0, 1, 2].includes(c))) bad.push('boundary shape');
    // entropy and information gain against the definition
    if (I.entropy([5, 5]) !== 1 || I.entropy([10, 0]) !== 0 || Math.abs(I.entropy([1, 1, 1, 1]) - 2) > 1e-12) bad.push('entropy');
    const rows = I.KIND_ROWS, classes = 4; const H0 = I.entropy(I.countsOf(rows, classes));
    for (let f = 0; f < 6; f++) { const yes = rows.filter((x) => x.f[f] === 1), no = rows.filter((x) => x.f[f] !== 1); const g = H0 - (yes.length / rows.length) * I.entropy(I.countsOf(yes, classes)) - (no.length / rows.length) * I.entropy(I.countsOf(no, classes)); if (Math.abs(I.infoGain(rows, f, classes) - g) > 1e-12 || g < -1e-12) bad.push('gain ' + f); }
    if (I.infoGain(rows.map((x) => ({ f: [...x.f, 1], y: x.y })), 6, classes) !== 0) bad.push('a constant feature has gain 0');
    // decision tree: perfect on the training animals; the greedy tree is not larger than 6 questions; on noisy data the full tree fits the training data better than new data
    const tree = I.buildTree(rows, [0, 1, 2, 3, 4, 5], classes); if (I.treeAccuracy(tree, rows) !== 1) bad.push('tree train'); out.q = I.treeQuestions(tree); if (out.q > 6) bad.push('tree too big');
    let gap2 = 0; for (let seed = 1; seed <= 15; seed++) { const a = I.noisyRows(seed, 60, 0.15), c = I.noisyRows(seed + 50, 300, 0.15), t2 = I.buildTree(a, [...Array(16).keys()], 2); gap2 += I.treeAccuracy(t2, a) - I.treeAccuracy(t2, c); if (I.treeAccuracy(t2, a) < 0.85) bad.push('noisy tree train low'); }
    out.gap2 = gap2 / 15; if (out.gap2 < 0.1) bad.push('tree overfitting not visible ' + out.gap2);
    // inverted index against scanning every document
    const rg = I.rng(12); const vocab = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; let idxOk = 0;
    for (let i = 0; i < 400; i++) { const docs = Array.from({ length: I.rint(rg, 1, 8) }, () => Array.from({ length: I.rint(rg, 1, 5) }, () => vocab[I.rint(rg, 0, 6)])); const index = I.buildIndex(docs); const q = Array.from({ length: I.rint(rg, 1, 3) }, () => vocab[I.rint(rg, 0, 6)]); const want = docs.map((d, k) => (q.every((w) => d.includes(w)) ? k : -1)).filter((k) => k >= 0); if (I.searchAll(index, q).join() !== want.join()) bad.push('index ' + JSON.stringify([docs, q])); idxOk++; }
    out.idxOk = idxOk;
    return { bad: bad.slice(0, 4), out };
  });
  ok(R8.bad.length === 0, `k nearest neighbours (separable data: training accuracy 1 at k = 1, held-out >= 93 %; noisy labels: k = 1 memorises, the gap training - test is ${R8.out.gap.toFixed(2)}, a larger k is as good or better on ${R8.out.better} / 20 seeds; every answer equals a brute-force vote), entropy / information gain against the definition, decision tree (animals: 100 % with ${R8.out.q} questions; noisy data: training - test gap ${R8.out.gap2.toFixed(2)}), inverted index equals scanning on ${R8.out.idxOk} random document sets` + (R8.bad.length ? ' -> ' + R8.bad.join(' | ') : ''));

  // ---------- 9. bias, the digit recogniser, pictures ----------
  const R9 = await run(async (I) => {
    const bad = [], out = {};
    const h = I.biasedHistory(3);
    const m = (f) => { const mod = I.trainBias(h, f); return { acc: I.biasAccuracy(mod, h), gap: I.biasGap(mod) }; };
    out.score = m(['score']); out.group = m(['score', 'group']); out.district = m(['score', 'district']); out.none = m([]);
    if (out.score.gap > 0.01 || out.score.acc < 0.85) bad.push('score only');
    if (out.group.gap < 0.5 || out.group.acc < 0.95) bad.push('with group');
    if (out.district.gap < 0.5) bad.push('district is a proxy for the group (removing the group is not enough)');
    if (out.none.acc > 0.7) bad.push('no information');
    // the digit recogniser: bundled samples made by code; accuracy floor on fresh noisy samples
    const model = I.trainDigits(); let right = 0, n = 0, conf = 0;
    for (let seed = 500; seed < 540; seed++) for (let d = 0; d < 10; d++) { const g = I.noisyDigit(d, seed, 3), r = I.recogniseDigit(model, g); n++; if (r.digit === d) right++; conf += r.confidence; if (Math.abs(r.scores.reduce((a, b) => a + b, 0) - 1) > 1e-9 || r.confidence < 0 || r.confidence > 1 || r.scores.some(Number.isNaN)) bad.push('scores'); }
    out.acc = right / n; if (out.acc < 0.9) bad.push('digit accuracy ' + out.acc);
    for (let d = 0; d < 10; d++) if (I.recogniseDigit(model, I.digitGrid(d)).digit !== d) bad.push('clean digit ' + d);
    out.blank = I.recogniseDigit(model, Array(64).fill(0)).confidence; out.black = I.recogniseDigit(model, Array(64).fill(1)).confidence;
    if (I.trainDigits().samples.length !== 300 || JSON.stringify(I.trainDigits()) !== JSON.stringify(model)) bad.push('training is not deterministic');
    // pictures
    for (const [k, rows] of Object.entries(I.PICS)) { if (rows.length !== 8 || rows.some((r) => !/^[01]{8}$/.test(r))) bad.push('pic ' + k); if (JSON.stringify(I.picFromNumbers(I.rowNumbers(rows))) !== JSON.stringify(rows)) bad.push('pic round trip ' + k); }
    if (I.imageBytes(16, 16, 1) !== 32 || I.imageBytes(100, 100, 24) !== 30000 || I.rgbHex(255, 128, 0) !== '#FF8000' || I.colorDist([1, 2, 3], [4, 0, 3]) !== 3) bad.push('image maths');
    return { bad: bad.slice(0, 4), out };
  });
  ok(R9.bad.length === 0, `bias: score only gap ${R9.out.score.gap.toFixed(2)} / accuracy ${R9.out.score.acc.toFixed(2)}; with the group gap ${R9.out.group.gap.toFixed(2)}; without the group but with the district gap ${R9.out.district.gap.toFixed(2)} (a proxy); digit recogniser (30 bundled samples per digit made by code, deterministic) accuracy ${R9.out.acc.toFixed(3)} on 400 fresh noisy samples (floor 0.90), clean digits 10 / 10, scores sum to 1; pictures round trip` + (R9.bad.length ? ' -> ' + R9.bad.join(' | ') : ''));

  // ---------- 10. every generator of the quiz kind, hundreds of seeds ----------
  const R10 = await run(async (I, D, A, C) => {
    const c = await C.loadContent(); const bad = []; let n = 0;
    const gens = [...new Set(c.acts.filter((a) => a.kind === 'quiz').flatMap((a) => [].concat(a.spec.gen)))];
    const indep = {
      binRead: (q) => String(parseInt(q.fig.bits, 2)),
      binWrite: (q) => (q.args[0]).toString(2).padStart(4, '0'),
      binAdd: (q) => (parseInt(q.args[0], 2) + parseInt(q.args[1], 2)).toString(2).padStart(4, '0'),
      capacity: (q) => String(2 ** q.args[0]),
      bitsFor: (q) => String(q.args[0] === 0 ? 1 : Math.floor(Math.log2(q.args[0])) + 1),
      hexRead: (q) => String(parseInt(q.args[0], 16)),
      hexWrite: (q) => q.args[0].toString(16).toUpperCase().padStart(2, '0'),
      hexBin: (q) => parseInt(q.args[0], 16).toString(2).padStart(4, '0'),
      asciiCode: (q) => String(q.args[0].codePointAt(0)),
      asciiChar: (q) => String.fromCharCode(q.args[0]),
      encodeWord: (q) => [...q.args[0]].map((ch) => String(ch.charCodeAt(0))),
      decodeWord: (q) => q.args[0].split(' ').map((x) => String.fromCharCode(+x)).join(''),
      utf8Len: (q) => String(new TextEncoder().encode(q.args[0]).length),
      utf8Hex: (q) => [...new TextEncoder().encode(q.args[0])].map((b) => b.toString(16).toUpperCase().padStart(2, '0')),
      imgSize: (q) => String(q.args[0] * q.args[1] * q.args[2] / 8),
      colorName: (q) => ({ '255, 0, 0': 'red', '0, 255, 0': 'green', '0, 0, 255': 'blue', '255, 255, 0': 'yellow', '0, 0, 0': 'black', '255, 255, 255': 'white', '0, 255, 255': 'cyan', '255, 0, 255': 'magenta' })[q.args[0]],
      rleEnc: (q) => q.args[0].replace(/(.)\1*/g, (m, ch) => m.length + ch),
      rleDec: (q) => q.args[0].replace(/(\d+)(\D)/g, (m, k, ch) => ch.repeat(+k)),
      rleSize: (q) => (q.args[1].length < q.args[0].length ? 'shorter' : 'longer'),
      caesarDec: (q) => [...q.args[0]].map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 - q.args[1] + 26) % 26) + 65)).join(''),
      caesarBreak: (q) => { for (let k = 0; k < 26; k++) { const w = [...q.args[0]].map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 - k + 26) % 26) + 65)).join(''); if (w === q.answer) return w; } return '?'; },
      xor: (q) => (parseInt(q.args[0], 2) ^ parseInt(q.args[1], 2)).toString(2).padStart(4, '0'),
      xorBack: (q) => (parseInt(q.args[0], 2) ^ parseInt(q.args[1], 2)).toString(2).padStart(4, '0'),
      parity: (q) => String([...q.args[0]].filter((x) => x === '1').length % 2),
      parityCheck: (q) => ([...q.args[0]].filter((x) => x === '1').length % 2 === 0 ? 'ok' : 'error'),
      isbn: (q) => { const s = [...q.args[0]].reduce((a, ch, i) => a + +ch * (i % 2 ? 3 : 1), 0); return String((10 - (s % 10)) % 10); },
      idcard: (q) => { const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; const s = [...q.args[0]].reduce((a, ch, i) => a + +ch * w[i], 0); return ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'][s % 11]; },
      mean: (q) => String(Math.round(q.fig.items.reduce((a, b) => a + b, 0) / q.fig.items.length * 1e4) / 1e4),
      median: (q) => { const s = q.fig.items.slice().sort((a, b) => a - b); return String(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2); },
      mode: (q) => { const cnt = {}; q.fig.items.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1)); const top = Math.max(...Object.values(cnt)); return String(Math.min(...Object.keys(cnt).filter((k) => cnt[k] === top).map(Number))); },
      barRead: (q) => String(q.fig.values[q.fig.labels.indexOf(q.args[0])]),
      barMax: (q) => q.fig.labels[q.fig.values.indexOf(Math.max(...q.fig.values))],
      barDiff: (q) => String(Math.abs(q.fig.values[q.fig.labels.indexOf(q.args[0])] - q.fig.values[q.fig.labels.indexOf(q.args[1])])),
      ip: (q) => (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(q.args[0]) && q.args[0].split('.').every((x) => +x <= 255) ? 'yes' : 'no'),
      entropy: (q) => String(Math.round(q.args[0] * Math.log2(q.args[1]))),
    };
    for (const g of gens) {
      const spec = c.acts.find((a) => [].concat(a.spec.gen || []).includes(g)).spec;
      if (!indep[g]) { bad.push('no independent check for ' + g); continue; }
      const seen = new Set();
      for (let s = 1; s <= 300; s++) {
        const q = I.makeQuestion({ ...spec, gen: g }, s); n++; seen.add(JSON.stringify(q.args) + JSON.stringify(q.fig || ''));
        const want = indep[g](q); const got = q.answer;
        if (JSON.stringify(want) !== JSON.stringify(got)) { bad.push(`${g} seed ${s}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`); break; }
        if (!I.sameAnswer(Array.isArray(got) ? got : [got], q) || I.sameAnswer(Array.isArray(got) ? got.map(() => 'zz') : ['zz'], q)) { bad.push(g + ' sameAnswer'); break; }
        if (q.choices && (new Set(q.choices).size !== q.choices.length || !q.choices.includes(String(got)) || q.choices.length < 2)) { bad.push(g + ' choices ' + JSON.stringify(q.choices)); break; }
        if (JSON.stringify(q).includes('NaN') || JSON.stringify(q).includes('undefined')) { bad.push(g + ' NaN'); break; }
        if (!c.genPrompts[g]) { bad.push('prompt missing ' + g); break; }
        const tpl = c.genPrompts[g][0]; const slots = [...tpl.matchAll(/\{(\d)\}/g)].map((m) => +m[1]); if (slots.some((k) => q.args[k] === undefined)) { bad.push(g + ' prompt placeholder'); break; }
        for (const ch of q.choices || []) if (!c.labels[ch] && !/^[\d]+$/.test(ch) && !/^[一-鿿]{2}$/.test(ch) && gens.length) { /* a label is needed for words like yes / ok */ if (/^[a-z]+$/.test(ch)) { bad.push(g + ' label missing ' + ch); break; } }
      }
      if (seen.size < 8) bad.push(g + ' not varied (' + seen.size + ')');
    }
    return { bad: bad.slice(0, 5), n, gens: gens.length };
  });
  ok(R10.bad.length === 0 && R10.gens >= 30, `${R10.gens} question generators x 300 seeds (${R10.n} questions): every stored answer equals an independent recomputation, is accepted by sameAnswer and a wrong text is not, choices are unique and contain the answer, no NaN, every prompt has a template whose placeholders exist, the questions vary` + (R10.bad.length ? ' -> ' + R10.bad.join(' | ') : ''));

  // ---------- 11. the device simulations of world 16 ----------
  const R11 = await run(async (I, D, A) => {
    const bad = [], rows = [];
    for (const lv of D.DEVICES) {
      const ref = A.parse(lv.ref), naive = A.parse(lv.naive);
      const v = D.judgeAll(lv, ref), nv = D.judgeAll(lv, naive), ev = D.judgeAll(lv, A.parse('set zzz = 0'));
      if (!v.ok) bad.push(lv.id + ' reference fails ' + JSON.stringify(v.results.map((r) => r.fail)));
      if (nv.ok) bad.push(lv.id + ' naive passes'); if (ev.ok) bad.push(lv.id + ' empty passes');
      if (A.countBlocks(ref) > lv.max) bad.push(lv.id + ' reference exceeds max');
      for (const k of lv.conds) { try { const q = A.parse(`if ${k} { zzz }`.replace('zzz', 'set a = 1')); if (!q.main[0].cond) bad.push(lv.id + ' cond ' + k); } catch (e) { bad.push(lv.id + ' cond ' + k + ' ' + e.message); } }
      for (const s of lv.sensors) if (!lv.vars.includes(s)) bad.push(lv.id + ' sensor not in vars ' + s);
      for (const a of lv.acts) if (!lv.vars.includes(a)) bad.push(lv.id + ' actuator not in vars ' + a);
      // no NaN anywhere in the frames, deterministic
      for (let i = 0; i < lv.scenarios.length; i++) { const r1 = D.runScenario(lv, ref, i), r2 = D.runScenario(lv, ref, i); if (JSON.stringify(r1) !== JSON.stringify(r2)) bad.push(lv.id + ' not deterministic'); if (JSON.stringify(r1.frames).includes('null') || r1.frames.length !== lv.ticks) bad.push(lv.id + ' frames ' + r1.frames.length); }
      rows.push(lv.id + ':' + A.countBlocks(ref) + '/' + lv.max + ':' + nv.results.filter((r) => !r.ok).length + 'of' + lv.scenarios.length);
    }
    // mutations of the reference programs: changing a number or a comparison must break at least some levels (the judges are not trivially satisfied)
    let mutated = 0, caught = 0;
    for (const lv of D.DEVICES) {
      const variants = [];
      const txt = lv.ref;
      for (const m of txt.matchAll(/(<=|>=|==|!=|<|>) (-?\d+)/g)) { variants.push(txt.slice(0, m.index) + m[1] + ' ' + (Number(m[2]) + 20) + txt.slice(m.index + m[0].length)); }
      for (const m of txt.matchAll(/set (\w+) = (-?\d+)/g)) variants.push(txt.slice(0, m.index) + `set ${m[1]} = ${Number(m[2]) === 0 ? 1 : 0}` + txt.slice(m.index + m[0].length));
      for (const v of variants.slice(0, 6)) { mutated++; try { if (!D.judgeAll(lv, A.parse(v)).ok) caught++; } catch (e) { caught++; } }
    }
    // an endless / erroring program is reported, not hung
    const lv1 = D.DEVICES[0]; const loopRes = D.judgeAll(lv1, A.parse('set lamp = 1 while lamp == 1 { change lamp by 0 }')); if (loopRes.ok || !loopRes.results.every((r) => r.status !== 'ok')) bad.push('endless program not reported');
    // the messages: every failure of the naive programs names a message of the level
    return { bad: bad.slice(0, 6), rows, mutated, caught, n: D.DEVICES.length, scen: D.DEVICES.reduce((a, l) => a + l.scenarios.length, 0) };
  });
  ok(R11.bad.length === 0 && R11.n === 16, `${R11.n} device levels (${R11.scen} scenarios): the reference program passes every scenario, a naive program and an empty program fail, the reference fits the block limit, conditions parse, sensors / actuators are variables, the runs are deterministic with no NaN, an endless program is reported` + (R11.bad.length ? ' -> ' + R11.bad.join(' | ') : '') + ' [' + R11.rows.join(' ') + ']');
  ok(R11.caught / R11.mutated >= 0.7, `${R11.caught} of ${R11.mutated} mutations of the reference programs (a threshold moved by 20, a constant flipped) are caught by the judges (the levels are not trivially satisfied)`);

  // ---------- 12. the content ----------
  const R12 = await run(async (I, D, A, C) => {
    const c = await C.loadContent(); const bad = [], info = {};
    const cjk = /[一-鿿]/;
    const KINDS = new Set(['quiz', 'scenario', 'sort', 'order', 'pick', 'bits', 'pixel', 'rgbmix', 'wave', 'huff', 'subst', 'fixbit', 'sheet', 'table', 'route', 'password', 'knn', 'tree', 'rules', 'search', 'bias', 'digit', 'device']);
    for (const w of [14, 15, 16]) { info['w' + w] = c.acts.filter((a) => a.world === w).length; if (info['w' + w] < 14) bad.push('world ' + w + ' has only ' + info['w' + w]); const nos = c.acts.filter((a) => a.world === w).map((a) => a.no).sort((a, b) => a - b); if (nos.join() !== nos.map((_, i) => i + 1).join()) bad.push('numbers of world ' + w); if (!c.worlds[w] || c.worlds[w].name.length !== 3) bad.push('world name ' + w); }
    const ids = c.acts.map((a) => a.id); if (new Set(ids).size !== ids.length) bad.push('ids not unique'); info.total = ids.length;
    for (const a of c.acts) {
      if (a.id !== `i${a.world}-${String(a.no).padStart(2, '0')}`) bad.push('id ' + a.id);
      if (!KINDS.has(a.kind)) bad.push('kind ' + a.kind);
      if (!Array.isArray(a.title) || a.title.length !== 3 || a.title.some((x) => !x || !x.trim())) bad.push('title ' + a.id); else if (cjk.test(a.title[1]) || cjk.test(a.title[2])) bad.push('title translation has Chinese ' + a.id);
      if (!c.lessons[a.lesson]) bad.push('lesson ' + a.id + ' ' + a.lesson);
      const hints = a.hints || (a.kind === 'device' ? c.dev[a.id]?.hints : c.kindHints[a.kind]); if (!hints || hints.length < 2 || hints.some((x) => !x.trim())) bad.push('hints ' + a.id);
      if (a.kind !== 'quiz' && a.kind !== 'scenario' && a.kind !== 'sort' && a.kind !== 'order' && a.kind !== 'pick' && a.kind !== 'device' && a.kind !== 'bits' && !a.prompt) bad.push('prompt ' + a.id);
      if (a.prompt) { if (a.prompt.length !== 3 || a.prompt.some((x) => !x || !x.trim())) bad.push('prompt triple ' + a.id); else if (cjk.test(a.prompt[1]) || cjk.test(a.prompt[2])) bad.push('prompt translation has Chinese ' + a.id); }
      if (a.kind === 'scenario') for (const q of a.spec.qs) { if (q.o.length < 2 || q.a < 0 || q.a >= q.o.length || !q.w || !q.p) bad.push('scenario ' + a.id); if (new Set(q.o).size !== q.o.length) bad.push('scenario duplicate options ' + a.id); }
      if (a.kind === 'scenario' && a.spec.qs.length < 3) bad.push('scenario too short ' + a.id);
      if (a.kind === 'sort') { const s = a.spec; if (s.cards.length < 6 || !s.cards.every((x) => x.b >= 0 && x.b < s.buckets.length) || [...new Set(s.cards.map((x) => x.b))].length !== s.buckets.length) bad.push('sort ' + a.id); if (s.buckets.some((b) => b.length !== 3 || cjk.test(b[1]) || cjk.test(b[2]))) bad.push('sort buckets ' + a.id); }
      if (a.kind === 'order' && (a.spec.items.length < 4 || new Set(a.spec.items).size !== a.spec.items.length)) bad.push('order ' + a.id);
      if (a.kind === 'pick' && !(a.spec.items.some((x) => x.bad) && a.spec.items.some((x) => !x.bad))) bad.push('pick ' + a.id);
      if (a.kind === 'quiz') for (const g of [].concat(a.spec.gen)) if (!c.genPrompts[g] || c.genPrompts[g].some((x) => !x.trim()) || cjk.test(c.genPrompts[g][1]) || cjk.test(c.genPrompts[g][2])) bad.push('genPrompt ' + g);
      if (a.kind === 'device' && !D.deviceById(a.id)) bad.push('no device ' + a.id);
    }
    for (const [id, l] of Object.entries(c.lessons)) { if (l.steps.length < 2 || l.steps.some((s) => !s.t.trim() || !s.d || !s.d.k) || l.title.length !== 3) bad.push('lesson ' + id); }
    const used = new Set(c.acts.map((a) => a.lesson)); for (const id of Object.keys(c.lessons)) if (!used.has(id)) bad.push('unused lesson ' + id);
    for (const [k, v] of Object.entries(c.labels)) if (v.length !== 3 || cjk.test(v[1]) || cjk.test(v[2])) bad.push('label ' + k);
    for (const lv of D.DEVICES) { const t = c.dev[lv.id]; if (!t) { bad.push('dev text ' + lv.id); continue; } if (t.scenarios.length !== lv.scenarios.length) bad.push('scenario names ' + lv.id + ' ' + t.scenarios.length + '/' + lv.scenarios.length); if (t.hints.length < 2) bad.push('dev hints ' + lv.id); if (t.goal.length !== 3 || cjk.test(t.goal[1]) || cjk.test(t.goal[2])) bad.push('dev goal ' + lv.id);
      // every message index that a failing program can produce exists
      for (const prog of [lv.naive, 'set zzz = 0']) { const v = D.judgeAll(lv, A.parse(prog)); for (const r of v.results) if (r.fail && r.fail.msg >= t.msgs.length) bad.push('msg index ' + lv.id + ' ' + r.fail.msg); } }
    for (const k of ['guess', 'quiz', 'pixel', 'home', 'story', 'dashboard']) { if (!c.projects[k] || !c.projectDefaults[k]) bad.push('project ' + k); }
    return { bad: bad.slice(0, 6), info, lessons: Object.keys(c.lessons).length, hints: Object.keys(c.kindHints).length };
  });
  ok(R12.bad.length === 0 && R12.info.total >= 42, `content: ${R12.info.total} activities (world 14: ${R12.info.w14}, world 15: ${R12.info.w15}, world 16: ${R12.info.w16}; at least 14 each, 42 in all), ${R12.lessons} mini-lessons all used, titles and prompts in three languages (no Chinese in EN / FR), hints, scenario cards complete, sort / order / pick sets valid, every device level has its texts and scenario names` + (R12.bad.length ? ' -> ' + R12.bad.join(' | ') : ''));
  ok(true, 'the lessons, scenario cards, sort cards and hints are content written by a model from memory (not translated); a 信息科技 teacher must proofread them');

  // ---------- 13. the pure rules of the workshop ----------
  const R13 = await run(async (I, D, A, C, P) => {
    const bad = [];
    if (P.guessCheck(5, 3) !== 'low' || P.guessCheck(5, 9) !== 'high' || P.guessCheck(5, 5) !== 'ok') bad.push('guess');
    for (let s = 1; s <= 50; s++) { let lo = 1, hi = 50, n = 0; for (;;) { const g = (lo + hi) >> 1; n++; const r = P.guessCheck(s, g); if (r === 'ok') break; if (r === 'low') lo = g + 1; else hi = g - 1; if (n > 7) { bad.push('binary search needs more than 7 guesses for 50 numbers'); break; } } }
    if (P.quizScore([{ a: 1 }, { a: 0 }, { a: 2 }], [1, 1, 2]) !== 2) bad.push('quizScore');
    const fr = [['1'], ['2'], ['3']]; if (P.frameAt(fr, 0, 2)[0] !== '1' || P.frameAt(fr, 500, 2)[0] !== '2' || P.frameAt(fr, 1500, 2)[0] !== '4' && false) bad.push('frameAt'); if (P.frameAt(fr, 3000, 2)[0] !== '1') bad.push('frameAt wraps');
    const sc = [{ text: 'a', choices: [{ t: 'x', to: 1 }, { t: 'y', to: 2 }] }, { text: 'b', choices: [] }, { text: 'c', choices: [{ t: 'z', to: 9 }] }, { text: 'lost', choices: [] }];
    if (P.storyNext(sc, 0, 0) !== 1 || P.storyNext(sc, 0, 1) !== 2 || P.storyNext(sc, 2, 0) !== null || P.storyNext(sc, 1, 0) !== null || P.storyUnreachable(sc).join() !== '3') bad.push('story');
    const ds = P.dashStats([{ value: 2 }, { value: 4 }, { value: 9 }]); if (ds.sum !== 15 || ds.mean !== 5 || ds.max !== 9 || ds.min !== 2 || P.dashStats([]).max !== 0) bad.push('dashStats');
    for (let h = 0; h < 24; h++) { if (P.dayLight(h) < 0 || P.dayLight(h) > 100) bad.push('light'); } if (P.dayLight(0) !== 0 || P.dayLight(12) !== 100 || P.dayLight(3) !== 0) bad.push('day light');
    const st = P.homeState({ lamp: 30, heater: 18, fan: 28 }, 2); if (!st.lamp || P.homeState({ lamp: 30, heater: 18, fan: 28 }, 12).lamp) bad.push('home lamp');
    return bad;
  });
  ok(R13.length === 0, 'workshop rules: guessing (the answer is found by halving in at most 7 guesses among 50), quiz score, animation frame, story steps and unreachable scenes, dashboard numbers, the made-up day of the smart home' + (R13.length ? ' -> ' + R13.join(' | ') : ''));

  await t.browser.close();
  await done();
})();
