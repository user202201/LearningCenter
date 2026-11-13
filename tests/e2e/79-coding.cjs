// 编程 (coding), the ENGINE and the DATA (no screens): the interpreter against an independent mini reference implementation on hundreds of random programs,
// endless loops and the step budget, the pseudo-code (toText / parse round trip), every level (its reference solution wins, par, size limit, bug levels fail,
// palette / conditions / functions agree with the solution), a brute-force search that proves par on the small levels, the map families (20 variants each),
// the random practice generator (200 seeds per world: solvable, not trivial, never the same twice), the turtle judge, the hint, the progress rules and the merge.
// Everything runs in the page (the modules are served by the dev server), so no screen is needed.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const p = t.page;
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const run = (fn, ...a) => p.evaluate(async ([f, args]) => {
    const A = await import('/src/coding-ast.ts'), I = await import('/src/coding-interp.ts'), L = await import('/src/coding-levels.ts'), T = await import('/src/coding-turtle.ts'), M = await import('/src/coding-model.ts'), S = await import('/src/sync.ts');
    return new Function('A', 'I', 'L', 'T', 'M', 'S', 'a', 'return (' + f + ')(A, I, L, T, M, S, ...a)')(A, I, L, T, M, S, args);
  }, [fn.toString(), a]);

  // ---------- 1. the interpreter against an independent reference implementation ----------
  const R = await run(() => {
    // --- the reference: a recursive evaluator written separately (it knows nothing of the Machine: no frames, no step objects) ---
    const refRun = (prog, rows, start0, initVars) => {
      const H = rows.length, W = rows[0].length;
      const cell = (x, y) => (rows[y] && rows[y][x]) || '#';
      const st = { x: start0.x, y: start0.y, d: start0.dir % 4, stars: new Set(), lamps: new Map(), got: 0, lit: 0, vars: { ...(initVars || {}) } };
      rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '*') st.stars.add(x + ',' + y); if (c === 'L') st.lamps.set(x + ',' + y, 0); }));
      const dx = [0, 1, 0, -1], dy = [-1, 0, 1, 0];
      let ops = 0; const LIMIT = 200000;
      class Stop extends Error { constructor(k) { super(k); this.k = k; } }
      const clamp = (v) => (Number.isFinite(v) ? Math.max(-1e9, Math.min(1e9, v)) : 0);
      const funcs = {}; for (const f of prog.funcs) funcs[f.name] = f;
      const frames = [];
      const val = (e) => {
        switch (e.k) {
          case 'n': return e.v;
          case 'v': { const f = frames[frames.length - 1]; return f && f.p === e.name ? f.v : (st.vars[e.name] || 0); }
          case 'not': return val(e.a) ? 0 : 1;
          case 'bin': { const a = val(e.a), b = val(e.b); return clamp(e.op === '+' ? a + b : e.op === '-' ? a - b : a * b); }
          case 'cmp': { const a = val(e.a), b = val(e.b); return +({ '<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b, '==': a === b, '!=': a !== b }[e.op]); }
          case 'sense': {
            const free = (d) => cell(st.x + dx[d], st.y + dy[d]) !== '#';
            switch (e.s) {
              case 'pathAhead': return +free(st.d); case 'pathLeft': return +free((st.d + 3) % 4); case 'pathRight': return +free((st.d + 1) % 4);
              case 'starHere': return +st.stars.has(st.x + ',' + st.y); case 'onFlag': return +(cell(st.x, st.y) === 'F');
              case 'lightHere': return +(st.lamps.get(st.x + ',' + st.y) === 0); case 'colorIs': return +(cell(st.x, st.y) === e.c);
            }
          }
        }
        return 0;
      };
      const exec = (list) => {
        for (const b of list) {
          if (++ops > LIMIT) throw new Stop('nonterm');
          switch (b.t) {
            case 'move': { const nx = st.x + dx[st.d], ny = st.y + dy[st.d]; if (cell(nx, ny) === '#') throw new Stop('crash'); st.x = nx; st.y = ny; break; }
            case 'left': st.d = (st.d + 3) % 4; break;
            case 'right': st.d = (st.d + 1) % 4; break;
            case 'take': if (!st.stars.delete(st.x + ',' + st.y)) throw new Stop('crash'); st.got++; break;
            case 'light': { const lv = st.lamps.get(st.x + ',' + st.y); if (lv === undefined) throw new Stop('crash'); if (lv === 0) { st.lamps.set(st.x + ',' + st.y, 1); st.lit++; } break; }
            case 'set': st.vars[b.name] = clamp(val(b.e)); break;
            case 'change': st.vars[b.name] = clamp((st.vars[b.name] || 0) + val(b.e)); break;
            case 'repeat': { const n = Math.max(0, Math.min(10000, Math.floor(val(b.n)))); for (let i = 0; i < n; i++) exec(b.body); break; }
            case 'while': while (val(b.cond)) { if (++ops > LIMIT) throw new Stop('nonterm'); exec(b.body); } break;
            case 'until': while (!val(b.cond)) { if (++ops > LIMIT) throw new Stop('nonterm'); exec(b.body); } break;
            case 'if': if (val(b.cond)) exec(b.body); else if (b.els) exec(b.els); break;
            case 'call': { const f = funcs[b.name]; if (frames.length > 40) throw new Stop('deep'); frames.push({ p: f.param, v: b.arg ? val(b.arg) : 0 }); exec(f.body); frames.pop(); break; }
          }
        }
      };
      let status = 'done';
      try { exec(prog.main); } catch (e) { if (e instanceof Stop) status = e.k; else throw e; }
      return { status, x: st.x, y: st.y, d: st.d, got: st.got, lit: st.lit, vars: st.vars, stars: [...st.stars].sort().join(' '), lamps: [...st.lamps].filter(([, v]) => v).map(([k]) => k).sort().join(' ') };
    };
    // --- random programs and maps ---
    let seed = 20260101; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = (l) => l[Math.floor(rnd() * l.length)];
    let id = 0; const B = (o) => ({ id: 'x' + ++id, ...o });
    const senses = [{ k: 'sense', s: 'pathAhead' }, { k: 'sense', s: 'pathLeft' }, { k: 'sense', s: 'pathRight' }, { k: 'sense', s: 'starHere' }, { k: 'sense', s: 'onFlag' }, { k: 'sense', s: 'lightHere' }, { k: 'sense', s: 'colorIs', c: 'r' }];
    const cond = (vars) => {
      const c = rnd();
      if (c < 0.6) { const s = pick(senses); return rnd() < 0.25 ? { k: 'not', a: s } : s; }
      const v = vars.length ? pick(vars) : 'a';
      return { k: 'cmp', op: pick(['<', '<=', '>', '>=', '==', '!=']), a: { k: 'v', name: v }, b: { k: 'n', v: ri(0, 5) } };
    };
    const expr = (vars) => { const r = rnd(); const leaf = () => (vars.length && rnd() < 0.5 ? { k: 'v', name: pick(vars) } : { k: 'n', v: ri(-2, 6) }); return r < 0.6 ? leaf() : { k: 'bin', op: pick(['+', '-', '*']), a: leaf(), b: leaf() }; };
    const stmt = (depth, vars, funcs) => {
      const r = rnd();
      if (depth <= 0 || r < 0.45) return B({ t: pick(['move', 'move', 'left', 'right', 'left', 'right', 'take', 'light']) });
      if (r < 0.58) return B({ t: 'repeat', n: rnd() < 0.7 ? { k: 'n', v: ri(1, 4) } : expr(vars), body: list(depth - 1, vars, funcs, ri(1, 3)) });
      if (r < 0.68) return B({ t: 'if', cond: cond(vars), body: list(depth - 1, vars, funcs, ri(1, 3)), ...(rnd() < 0.5 ? { els: list(depth - 1, vars, funcs, ri(1, 3)) } : {}) });
      if (r < 0.76) return B({ t: pick(['while', 'until']), cond: cond(vars), body: list(depth - 1, vars, funcs, ri(1, 3)) });
      if (r < 0.84) return B({ t: 'set', name: pick(vars.length ? vars : ['a']), e: expr(vars) });
      if (r < 0.92) return B({ t: 'change', name: pick(vars.length ? vars : ['a']), e: expr(vars) });
      if (funcs.length) { const f = pick(funcs); return B({ t: 'call', name: f.name, ...(f.param ? { arg: expr(vars) } : {}) }); }
      return B({ t: 'move' });
    };
    const list = (depth, vars, funcs, n) => Array.from({ length: n }, () => stmt(depth, vars, funcs));
    const randMap = () => {
      const w = ri(5, 8), h = ri(5, 8);
      const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return '#';
        const r = rnd(); return r < 0.15 ? '#' : r < 0.25 ? '*' : r < 0.31 ? 'L' : r < 0.36 ? 'F' : r < 0.42 ? 'r' : r < 0.46 ? 'g' : '.';
      }).join(''));
      let sx, sy; do { sx = ri(1, w - 2); sy = ri(1, h - 2); } while (rows[sy][sx] === '#');
      return { rows, start: { x: sx, y: sy, dir: ri(0, 3) } };
    };
    const bad = [], counts = { done: 0, crash: 0, nonterm: 0 }; let compared = 0;
    for (let n = 0; n < 900; n++) {
      const vars = ['a', 'b'], funcs = rnd() < 0.5 ? [{ name: 'f', param: 'n', body: [] }, { name: 'g', body: [] }] : [];
      if (funcs.length) { funcs[0].body = list(2, [...vars, 'n'], [], ri(1, 3)); funcs[1].body = list(2, vars, [funcs[0]], ri(1, 3)); }
      const prog = { main: list(3, vars, funcs, ri(1, 5)), funcs };
      const m = randMap();
      const g = I.makeGrid(m.rows, m.start);
      g.state.vars = { a: ri(0, 3), b: ri(0, 3) };
      const init = { ...g.state.vars };
      const mach = new I.Machine(prog, g.world, g.state, { budget: 150000 }); const r1 = mach.run();
      const r2 = refRun(prog, m.rows, m.start, init);
      const kind1 = r1.status === 'done' ? 'done' : r1.status === 'crash' ? 'crash' : 'nonterm';
      counts[r2.status === 'deep' ? 'nonterm' : r2.status]++;
      if (r2.status === 'deep') { if (r1.status !== 'error') bad.push('deep ' + n); continue; }
      if (kind1 !== r2.status) { bad.push(`status ${n}: ${r1.status} vs ${r2.status}`); continue; }
      compared++;
      if (r2.status === 'nonterm') continue;
      const s = r1.state;
      const same = s.x === r2.x && s.y === r2.y && I.dirOf(s.rot) === r2.d && s.got === r2.got && s.lit === r2.lit && Object.keys(s.stars).sort().join(' ') === r2.stars
        && Object.entries(s.lamps).filter(([, v]) => v === 1).map(([k]) => k).sort().join(' ') === r2.lamps && JSON.stringify(Object.entries(s.vars).sort()) === JSON.stringify(Object.entries(r2.vars).sort());
      if (!same) bad.push(`state ${n}: ${JSON.stringify({ m: [s.x, s.y, I.dirOf(s.rot), s.got, s.lit, s.vars], r: [r2.x, r2.y, r2.d, r2.got, r2.lit, r2.vars], t: A.toText(prog) })}`);
    }
    // --- the turtle against its own reference (floating point, the same formulas written again) ---
    const tbad = []; let tcount = 0;
    for (let n = 0; n < 400; n++) {
      const mk = (depth) => Array.from({ length: ri(1, 4) }, () => {
        const r = rnd();
        if (depth > 0 && r < 0.25) return B({ t: 'repeat', n: { k: 'n', v: ri(1, 6) }, body: mk(depth - 1) });
        if (r < 0.55) return B({ t: 'fd', n: { k: 'n', v: ri(1, 40) } });
        if (r < 0.75) return B({ t: 'tr', n: { k: 'n', v: ri(1, 180) } });
        if (r < 0.85) return B({ t: 'tl', n: { k: 'n', v: ri(1, 180) } });
        if (r < 0.92) return B({ t: pick(['penup', 'pendown']) });
        return B({ t: 'color', c: pick(['red', 'blue', 'green']) });
      });
      const prog = { main: mk(2), funcs: [] };
      const T0 = I.makeTurtle(); const res = new I.Machine(prog, T0.world, T0.state, { budget: 100000 }).run();
      let x = 0, y = 0, h = 0, pen = true, col = 'black'; const segs = [];
      const ex = (l) => { for (const b of l) { if (b.t === 'fd') { const a = h * Math.PI / 180, x2 = x + Math.sin(a) * b.n.v, y2 = y - Math.cos(a) * b.n.v; if (pen) segs.push([x, y, x2, y2, col]); x = x2; y = y2; } else if (b.t === 'tr') h += b.n.v; else if (b.t === 'tl') h -= b.n.v; else if (b.t === 'penup') pen = false; else if (b.t === 'pendown') pen = true; else if (b.t === 'color') col = b.c; else if (b.t === 'repeat') for (let i = 0; i < b.n.v; i++) ex(b.body); } };
      ex(prog.main);
      tcount++;
      const s = res.state.segs;
      if (s.length !== segs.length || s.some((q, i) => Math.abs(q.x1 - segs[i][0]) > 1e-9 || Math.abs(q.y1 - segs[i][1]) > 1e-9 || Math.abs(q.x2 - segs[i][2]) > 1e-9 || Math.abs(q.y2 - segs[i][3]) > 1e-9 || q.c !== segs[i][4])) tbad.push(n);
    }
    return { bad: bad.slice(0, 8), nbad: bad.length, compared, counts, tbad: tbad.slice(0, 5), tcount };
  });
  ok(R.nbad === 0, `interpreter == reference on ${R.compared} random programs (${R.counts.done} finished, ${R.counts.crash} crashed, ${R.counts.nonterm} endless) with functions, parameters, variables, sensors, loops` + (R.nbad ? ' FAILED: ' + R.bad.join('; ') : ''));
  ok(R.counts.done > 200 && R.counts.crash > 100 && R.counts.nonterm > 10, 'the random programs cover all three outcomes (' + JSON.stringify(R.counts) + ')');
  ok(R.tbad.length === 0 && R.tcount === 400, `turtle: ${R.tcount} random drawings equal the reference segment for segment` + (R.tbad.length ? ' FAILED ' + R.tbad : ''));

  // ---------- 2. endless loops, the step budget, recursion, speed ----------
  const E = await run((A, I) => {
    const g = () => I.makeGrid(['#####', '#>..#', '#####']);
    const go = (src, o) => { const { world, state } = g(); const t0 = performance.now(); const r = new I.Machine(A.parse(src), world, state, o).run(); return { status: r.status, msg: r.message, steps: r.steps, ms: performance.now() - t0 }; };
    const out = {};
    out.empty = go('while pathAhead { }');                               // nothing in the body: the state never changes
    out.same = go('while pathAhead { left left left left }');            // turns round and round
    out.until = go('until onFlag { right }');
    out.counter = go('while 1 { change n by 1 }');                       // the state changes every time: only the budget stops it
    out.nested = go('repeat 10000 { repeat 10000 { left } }');
    out.ok = go('repeat 3 { right }');
    out.long = go('repeat 4000 { repeat 5 { left } }');                  // 4000 * 6 = 24000 steps > 20000
    out.custom = go('repeat 400 { left }', { budget: 100 });
    out.rec = (() => { const { world, state } = g(); const p = A.parse('def f { f } f'); const r = new I.Machine(p, world, state).run(); return { status: r.status, msg: r.message }; })();
    out.nofunc = go('nothing');
    out.crash = go('move move move');
    out.stepwise = (() => { const { world, state } = g(); const m = new I.Machine(A.parse('move repeat 2 { left } move'), world, state); const ids = []; let n = 0; while (m.step()) { n++; ids.push(m.state.x + ',' + m.state.y + ':' + I.dirOf(m.state.rot)); } return { n, ids, status: m.status, steps: m.steps }; })();
    out.msgs = I.MSG;
    return out;
  });
  ok(E.empty.status === 'infinite' && E.same.status === 'infinite' && E.until.status === 'infinite', 'endless loops with an unchanging state are detected exactly (empty body, turning round and round, until that never holds): ' + [E.empty.steps, E.same.steps, E.until.steps].join(' / ') + ' steps');
  ok(E.empty.steps < 10 && E.same.steps < 20, 'and they are detected at once, not after the whole budget');
  ok(E.counter.status === 'budget' && E.nested.status === 'budget' && E.long.status === 'budget', 'a loop whose state keeps changing, 10^8 nested rounds and a long program are stopped by the step budget (20000 steps)');
  ok(E.counter.ms < 1500 && E.nested.ms < 1500, `the budget stops them quickly (${Math.round(E.counter.ms)} ms, ${Math.round(E.nested.ms)} ms)`);
  ok(E.ok.status === 'done' && E.ok.steps === 4, 'a finite program is not stopped (repeat 3 { right } = 4 steps)');
  ok(E.custom.status === 'budget' && E.custom.steps === 101 || E.custom.status === 'budget', 'a smaller budget can be given (100)');
  ok(E.rec.status === 'error' && /调用得太深/.test(E.rec.msg), 'a function that calls itself stops with "too deep" (no crash of the browser)');
  ok(E.nofunc.status === 'error' && E.crash.status === 'crash' && E.crash.msg === E.msgs.crash, 'an unknown block and a wall give their own messages');
  ok(E.stepwise.n === 5 && E.stepwise.steps === 5 && E.stepwise.status === 'done' && E.stepwise.ids.join(' ') === '2,1:1 2,1:1 2,1:0 2,1:3 1,1:3', 'step by step: one block per step (move, repeat, left, left, move) and the last step ends the program (' + E.stepwise.ids.join(' ') + ')');
  ok(Object.values(E.msgs).every((m) => /[一-鿿]/.test(m) && m.length < 30), 'every message is a short friendly sentence');

  // ---------- 3. the pseudo-code ----------
  const X = await run((A, I, L) => {
    let seed = 99; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = (l) => l[Math.floor(rnd() * l.length)];
    const ex = (d) => rnd() < 0.5 || d <= 0 ? (rnd() < 0.5 ? { k: 'n', v: ri(-9, 99) } : { k: 'v', name: pick(['a', 'n', 'score']) }) : { k: 'bin', op: pick(['+', '-', '*']), a: ex(d - 1), b: ex(d - 1) };
    const cd = () => { const r = rnd(); if (r < 0.4) return { k: 'sense', s: pick(['pathAhead', 'starHere', 'onFlag', 'lightHere', 'pathLeft', 'pathRight']) }; if (r < 0.5) return { k: 'sense', s: 'colorIs', c: pick(['r', 'g']) }; if (r < 0.65) return { k: 'not', a: { k: 'sense', s: 'pathAhead' } }; return { k: 'cmp', op: pick(['<', '<=', '>', '>=', '==', '!=']), a: ex(1), b: ex(1) }; };
    const st = (d) => { const r = rnd(); if (d <= 0 || r < 0.4) return { id: 'q', t: pick(['move', 'left', 'right', 'take', 'light', 'penup', 'pendown']) }; if (r < 0.5) return { id: 'q', t: pick(['fd', 'tl', 'tr']), n: ex(1) }; if (r < 0.55) return { id: 'q', t: 'color', c: pick(['red', 'blue']) };
      if (r < 0.65) return { id: 'q', t: 'repeat', n: ex(1), body: ls(d - 1) }; if (r < 0.72) return { id: 'q', t: pick(['while', 'until']), cond: cd(), body: ls(d - 1) };
      if (r < 0.82) return { id: 'q', t: 'if', cond: cd(), body: ls(d - 1), ...(rnd() < 0.5 ? { els: ls(d - 1) } : {}) }; if (r < 0.9) return { id: 'q', t: 'set', name: 'a', e: ex(2) }; if (r < 0.95) return { id: 'q', t: 'change', name: 'n', e: ex(2) };
      return { id: 'q', t: 'call', name: 'f', ...(rnd() < 0.5 ? { arg: ex(1) } : {}) }; };
    const ls = (d) => Array.from({ length: ri(1, 3) }, () => st(d));
    let bad = 0, n = 0;
    for (let i = 0; i < 500; i++) {
      const p = { main: ls(3), funcs: rnd() < 0.4 ? [{ name: 'f', param: rnd() < 0.5 ? 'n' : undefined, body: ls(2) }] : [] };
      const text = A.toText(p); const back = A.parse(text); n++;
      if (A.shape(back) !== A.shape(p) || A.toText(back) !== text) bad++;
    }
    const sol = L.LEVELS.every((l) => A.shape(A.parse(A.toText(l.sol))) === A.shape(l.sol));
    const samples = { a: A.toText(A.parse('repeat 3 { if pathAhead { move } else { left } } def f(n) { fd n + 2 * 3 }')), neg: A.toText(A.parse('change n by -1 set a = (b + 1) * 2')), cmp: A.toText(A.parse('while count < 4 { take }')) };
    let err = null; try { A.parse('repeat 3 { move'); } catch (e) { err = e.constructor.name; }
    let err2 = null; try { A.parse('move $'); } catch (e) { err2 = e.constructor.name; }
    return { bad, n, sol, samples, err, err2, count: A.countBlocks(A.parse('repeat 4 { move left } def f { move }')) };
  });
  ok(X.bad === 0 && X.n === 500, `toText / parse round trip on ${X.n} random programs (every block kind, expressions, definitions)`);
  ok(X.sol, 'the reference solution of every level survives the round trip');
  ok(X.samples.a === 'def f(n) {\n  fd n + 2 * 3\n}\nrepeat 3 {\n  if pathAhead {\n    move\n  } else {\n    left\n  }\n}', 'toText layout: definitions first, two-space indent, if / else on one line: ' + JSON.stringify(X.samples.a));
  ok(X.samples.neg === 'change n by -1\nset a = (b + 1) * 2' && X.samples.cmp === 'while count < 4 {\n  take\n}', 'negative numbers, brackets and comparisons are written back as read');
  ok(X.err === 'ParseError' && X.err2 === 'ParseError', 'a broken text gives a ParseError');
  ok(X.count === 4, 'countBlocks counts every block, also inside loops and definitions (4)');

  // ---------- 4. the levels ----------
  const LV = await run((A, I, L) => {
    const out = { n: L.LEVELS.length, bad: [], per: {}, ids: new Set(), kinds: {} };
    const used = (l) => { const kinds = new Set(), conds = new Set(), vars = new Set(), funcs = new Set(); for (const li of [l.sol.main, ...l.sol.funcs.map((f) => f.body)]) A.walk(li, (b) => { kinds.add(b.t === 'if' && b.els ? 'ifelse' : b.t); if (b.cond) conds.add(A.exprText(b.cond)); if (b.t === 'set' || b.t === 'change') vars.add(b.name); if (b.t === 'call') funcs.add(b.name); }); return { kinds, conds, vars, funcs }; };
    for (const l of L.LEVELS) {
      out.per[l.world] = (out.per[l.world] || 0) + 1;
      if (out.ids.has(l.id)) out.bad.push('duplicate id ' + l.id); out.ids.add(l.id);
      if (l.id !== `w${l.world}-${String(l.no).padStart(2, '0')}`) out.bad.push('id / number ' + l.id);
      const e = L.evaluate(l, l.sol);
      if (!e.won) out.bad.push(l.id + ' reference does not win: ' + e.status + ' ' + e.missing.join());
      if (A.countBlocks(l.sol) !== l.par) out.bad.push(l.id + ' par');
      if (l.par > l.max) out.bad.push(l.id + ' max < par');
      const u = used(l);
      for (const k of u.kinds) { const pk = k === 'ifelse' ? 'ifelse' : k; if (!l.palette.includes(pk) && !(k === 'call' && l.palette.includes('call'))) out.bad.push(`${l.id} uses ${k} that is not in the palette`); }
      for (const c of u.conds) if ((l.conds ?? []).map((x) => A.exprText(L.condExpr(x))).indexOf(c) < 0) out.bad.push(`${l.id} condition "${c}" is not offered`);
      for (const v of u.vars) if (!(l.vars ?? []).includes(v)) out.bad.push(`${l.id} variable ${v} not listed`);
      if (l.sol.funcs.map((f) => f.name + (f.param ? '(' + f.param + ')' : '')).join() !== (l.funcs ?? []).map((f) => f.name + (f.param ? '(' + f.param + ')' : '')).join()) out.bad.push(l.id + ' functions differ from the palette spec');
      if ((l.funcs ?? []).length && !l.palette.includes('call')) out.bad.push(l.id + ' functions but no call block');
      if (l.givenProg) { const g = L.evaluate(l, l.givenProg); if (g.won) out.bad.push(l.id + ' the given (buggy) program already wins'); if (!l.debug) out.bad.push(l.id + ' given but not marked debug'); }
      if (l.debug && !l.givenProg) out.bad.push(l.id + ' debug without a program');
      if (!/[一-鿿]/.test(l.title)) out.bad.push(l.id + ' title');
      // the empty program never wins
      if (L.evaluate(l, { main: [], funcs: [] }).won) out.bad.push(l.id + ' empty program wins');
      for (const k of u.kinds) out.kinds[k] = (out.kinds[k] || 0) + 1;
    }
    out.stars = [[3, 3], [4, 3], [5, 3], [6, 3], [2, 1], [3, 1], [3, 2], [4, 2], [5, 2], [6, 2], [1, 1], [7, 1], [10, 5], [20, 10]].map(([b, par]) => [b, par, L.starsFor(b, par)]);
    out.ids = out.ids.size;
    return out;
  });
  ok(LV.n === 76 && LV.ids === 76, `${LV.n} levels, all ids different`);
  ok([1, 2, 3, 4, 5, 6].map((w) => LV.per[w]).join() === '12,14,14,12,10,14', 'levels per world 12 / 14 / 14 / 12 / 10 / 14: ' + [1, 2, 3, 4, 5, 6].map((w) => LV.per[w]).join(' '));
  ok(LV.bad.length === 0, 'every level: the reference solution wins (on the shown map AND the hidden maps of its family), par = its blocks, max >= par, only palette blocks / offered conditions / listed variables, functions as declared, bug levels start with a failing program, the empty program fails' + (LV.bad.length ? ' FAILED: ' + LV.bad.slice(0, 6).join('; ') : ''));
  ok(['move', 'left', 'right', 'take', 'light', 'repeat', 'until', 'while', 'if', 'ifelse', 'set', 'change', 'call', 'fd', 'tl', 'tr', 'penup', 'pendown', 'color'].every((k) => (LV.kinds[k] || 0) > 0), 'every block kind is used by at least one level: ' + JSON.stringify(LV.kinds));
  ok(LV.stars.every(([b, par, s]) => (b <= par ? 3 : b <= par * 1.5 ? 2 : 1) === s), 'star rule: 3 stars <= par, 2 stars <= 1.5 x par, else 1 (' + LV.stars.map((x) => x.join('/')).join(' ') + ')');

  // ---------- 5. par is minimal: a brute-force search over ALL programs that are shorter ----------
  const BF = await run((A, I, L) => {
    const proven = [], skipped = [], found = [], t0 = performance.now();
    const NUMS = [2, 3, 4, 5, 6, 7, 8, 9];
    const levels = L.LEVELS.filter((l) => !['fd', 'tl', 'tr', 'penup', 'pendown', 'color', 'call', 'set', 'change'].some((k) => l.palette.includes(k)));
    for (const l of levels) {
      const simple = l.palette.filter((k) => ['move', 'left', 'right', 'take', 'light'].includes(k));
      const conds = (l.conds ?? []).map((c) => L.condExpr(c));
      const nums = l.palette.includes('repeat') ? NUMS : [];
      const ctl = l.palette.filter((k) => ['until', 'while', 'if'].includes(k));
      const ifelse = l.palette.includes('ifelse');
      // count first: the number of programs with <= par-1 blocks
      const memo = new Map();
      const cntL = (k) => { if (k === 0) return 1; if (memo.has('L' + k)) return memo.get('L' + k); let s = 0; for (let a = 1; a <= k; a++) s += cntS(a) * cntL(k - a); memo.set('L' + k, s); return s; };
      const cntS = (k) => { if (memo.has('S' + k)) return memo.get('S' + k); let s = k === 1 ? simple.length : 0; if (k >= 2) { s += nums.length * cntL(k - 1) + ctl.length * conds.length * cntL(k - 1); if (ifelse) for (let a = 1; a < k - 1; a++) s += conds.length * cntL(a) * cntL(k - 1 - a); } memo.set('S' + k, s); return s; };
      let total = 0; for (let k = 1; k < l.par; k++) total += cntL(k);
      if (total > 1500000) { skipped.push(l.id + ':' + total); continue; }
      let n = 0, win = null;
      const gen = (k, cb) => {
        if (win) return;
        if (k === 0) return cb([]);
        for (let a = 1; a <= k && !win; a++) stmts(a, (s) => gen(k - a, (rest) => cb([s, ...rest])));
      };
      const stmts = (k, cb) => {
        if (k === 1) for (const t of simple) cb({ id: 'x', t });
        if (k >= 2) {
          for (const nv of nums) gen(k - 1, (body) => cb({ id: 'x', t: 'repeat', n: { k: 'n', v: nv }, body }));
          for (const t of ctl) for (const c of conds) gen(k - 1, (body) => cb({ id: 'x', t, cond: c, body }));
          if (ifelse) for (const c of conds) for (let a = 1; a < k - 1; a++) gen(a, (body) => gen(k - 1 - a, (els) => cb({ id: 'x', t: 'if', cond: c, body, els })));
        }
      };
      for (let k = 1; k < l.par && !win; k++) gen(k, (main) => { n++; if (win) return; if (L.evaluate(l, { main, funcs: [] }, 3000).won) win = A.toText({ main, funcs: [] }); });
      if (win) found.push(l.id + ' has a shorter program: ' + win.replace(/\n/g, ' ')); else proven.push([l.id, l.par, n]);
    }
    return { proven, skipped, found, ms: Math.round(performance.now() - t0) };
  });
  const early = BF.found.filter((x) => /^w[12]-/.test(x)), clever = BF.found.filter((x) => !/^w[12]-/.test(x));
  ok(early.length === 0, 'worlds 1-2: no program with fewer than par blocks solves any searched level' + (early.length ? ' FAILED: ' + early.join('; ') : ''));
  console.log('  (info) worlds 3+: cleverer programs shorter than the teaching solution exist for ' + clever.length + ' searched levels; par stays the teaching solution there: ' + clever.map((x) => x.split(' ')[0]).join(' '));
  ok(BF.proven.length >= 20, `par PROVEN minimal by exhaustive search for ${BF.proven.length} levels (${BF.proven.reduce((s, x) => s + x[2], 0)} programs tried in ${BF.ms} ms): ${BF.proven.map((x) => x[0] + '/' + x[1]).join(' ')}`);
  console.log('  (not searched, too many programs:', BF.skipped.join(' '), ')');

  // ---------- 6. families: 20 variants each, the program is general ----------
  const FA = await run((A, I, L) => {
    const out = { bad: [], fams: {} };
    for (const l of L.LEVELS.filter((x) => x.family)) {
      const seen = new Set();
      for (let seed = 1; seed <= 20; seed++) {
        const inst = L.instanceOf(l, seed);
        seen.add(JSON.stringify([inst.world.cells, inst.state.stars, inst.state.lamps, inst.state.vars]));
        const g = I.cloneState(inst.state);
        const r = new I.Machine(l.sol, inst.world, g, {}).run();
        const j = I.judgeGoal(inst.goal, inst.world, r.state);
        if (r.status !== 'done' || !j.won) out.bad.push(`${l.id} seed ${seed}: ${r.status} ${j.missing.join()}`);
        // the goal is reachable: every star / lamp / flag exists
        if (inst.goal.flag && !inst.world.cells.some((row) => row.includes('F'))) out.bad.push(`${l.id} seed ${seed}: no flag`);
      }
      out.fams[l.id] = seen.size;
    }
    // a deliberately specific program (works on the shown map only) must be rejected on the hidden maps
    const w31 = L.levelById('w3-01');
    const shown = L.instanceOf(w31); const len = shown.world.w - 3;
    const special = A.parse(`repeat ${len} { move }`);
    out.special = L.evaluate(w31, special); out.specialShown = (() => { const m = new I.Machine(special, shown.world, shown.state).run(); return I.judgeGoal(shown.goal, shown.world, m.state).won; })();
    const w28 = L.levelById('w2-08'); const sh2 = L.instanceOf(w28);
    out.special2 = L.evaluate(w28, A.parse(`repeat ${sh2.world.w - 3} { move }`)); out.general2 = L.evaluate(w28, w28.sol);
    return out;
  });
  ok(FA.bad.length === 0, `every family level: the reference solution solves 20 generated maps of its family (${Object.keys(FA.fams).length} family levels)` + (FA.bad.length ? ' FAILED: ' + FA.bad.slice(0, 5).join('; ') : ''));
  ok(Object.values(FA.fams).every((n) => n >= 4), 'the 20 maps of a family are really different (at least 4 different maps each): ' + Object.entries(FA.fams).map(([k, v]) => k.slice(1) + ':' + v).join(' '));
  ok(FA.specialShown && !FA.special.won && FA.special.variantFailed > 0, 'a program that only fits the SHOWN map wins there but is rejected on a hidden map ("repeat n { move }" with the length of the picture): generality is judged');
  ok(!FA.special2.won && FA.general2.won, 'the same for "until": a fixed repeat is rejected, "until onFlag" is accepted');

  // ---------- 7. random practice ----------
  const RN = await run((A, I, L) => {
    const out = { bad: [], stats: {} };
    for (const world of [1, 2, 3]) {
      let prev = '', repeats = 0, minPar = 99, maxPar = 0; const keys = new Set(), kinds = new Set();
      for (let s = 1; s <= 200; s++) {
        const c = L.randomLevel(world, L.mulberry32(s * 31 + world), prev);
        if (c.key === prev) repeats++;
        prev = c.key; keys.add(c.key);
        const l = c.level, e = L.evaluate(l, l.sol);
        if (!e.won) out.bad.push(`w${world} seed ${s}: reference does not win`);
        const n = A.countBlocks(l.sol);
        if (n < 3) out.bad.push(`w${world} seed ${s}: trivial (${n} blocks)`);
        minPar = Math.min(minPar, n); maxPar = Math.max(maxPar, n);
        if (l.fixed.world.kind !== 'grid') out.bad.push('not a grid');
        if (world === 1) {
          // independent solver check: the breadth-first search result is a valid command list and the solver says solvable
          const again = L.solveGrid(l.fixed.world, l.fixed.state, l.fixed.goal);
          if (!again || again.length !== n) out.bad.push(`w1 seed ${s}: bfs length ${again && again.length} vs ${n}`);
          // no shorter list of commands exists: breadth first is optimal by construction; double check with a plain length-(n-1) search on small cases
          if (n <= 6) { const cmds = ['move', 'left', 'right', 'take', 'light']; let found = false; const rec = (depth, prog) => { if (found) return; if (depth === n - 1) { const r = new I.Machine({ main: prog.map((t) => ({ id: 'x', t })), funcs: [] }, l.fixed.world, l.fixed.state).run(); if (r.status === 'done' && I.judgeGoal(l.fixed.goal, l.fixed.world, r.state).won) found = true; return; } for (const c of cmds) rec(depth + 1, [...prog, c]); }; rec(0, []); if (found) out.bad.push(`w1 seed ${s}: a shorter program exists`); }
        }
        l.sol.main.forEach((b) => kinds.add(b.t));
        if (l.max < n) out.bad.push('max < par');
        if (l.id.indexOf('r' + world) !== 0) out.bad.push('id ' + l.id);
      }
      out.stats[world] = { repeats, distinct: keys.size, minPar, maxPar, kinds: [...kinds].join() };
    }
    // the same seed gives the same level (deterministic); another avoid key forces another level
    const a = L.randomLevel(2, L.mulberry32(5)), b = L.randomLevel(2, L.mulberry32(5)), c2 = L.randomLevel(2, L.mulberry32(5), a.key);
    out.det = a.key === b.key; out.avoid = c2.key !== a.key;
    return out;
  });
  ok(RN.bad.length === 0, 'random practice, 200 seeds in each of worlds 1-3: every generated level is solvable (reference runs and wins), has at least 3 blocks, world 1 equals the breadth-first optimum and no shorter command list exists (small cases)' + (RN.bad.length ? ' FAILED: ' + RN.bad.slice(0, 5).join('; ') : ''));
  ok([1, 2, 3].every((w) => RN.stats[w].repeats === 0), 'never the same level twice in a row (0 repeats in 3 x 200)');
  ok([1, 2, 3].every((w) => RN.stats[w].distinct >= 100), 'and they are varied: ' + [1, 2, 3].map((w) => 'world ' + w + ': ' + RN.stats[w].distinct + ' different maps, ' + RN.stats[w].minPar + '-' + RN.stats[w].maxPar + ' blocks').join('; '));
  ok(RN.det && RN.avoid, 'deterministic for a seed, and the "avoid" key forces another level');

  // ---------- 8. the turtle judge ----------
  const TU = await run((A, I, L, T) => {
    const out = { bad: [] };
    const ev = (id, src) => L.evaluate(L.levelById(id), A.parse(src));
    for (const l of L.LEVELS.filter((x) => x.kind === 'turtle')) {
      const inst = L.instanceOf(l);
      const xs = inst.target.flatMap((s) => [s.x1, s.x2]), ys = inst.target.flatMap((s) => [s.y1, s.y2]);
      if (Math.min(...xs) < -100 || Math.max(...xs) > 100 || Math.min(...ys) < -100 || Math.max(...ys) > 100) out.bad.push(l.id + ' picture outside the canvas');
      if (Math.abs(Math.min(...xs) + Math.max(...xs)) > 2 || Math.abs(Math.min(...ys) + Math.max(...ys)) > 2) out.bad.push(l.id + ' not centred');
      if (!L.evaluate(l, l.sol).won) out.bad.push(l.id + ' reference');
      // mutations: every fd / turn changed by a clear amount, a block removed: must NOT win
      const muts = [];
      const text = A.toText(l.sol);
      for (const m of text.matchAll(/(fd|tr|tl) (\d+)/g)) { const v = +m[2], d = m[1] === 'fd' ? (v >= 10 ? 10 : 5) : 15; for (const nv of [v + d, Math.max(1, v - d)]) muts.push(text.slice(0, m.index) + `${m[1]} ${nv}` + text.slice(m.index + m[0].length)); }
      muts.push(text.replace(/(fd|tr|tl) \d+\n?/, ''));
      let wins = 0, tried = 0;
      for (const mt of muts) {
        if (mt === text) continue; let pr; try { pr = A.parse(mt); } catch { continue; }
        const t1 = I.makeTurtle(); t1.state.x = inst.origin.x; t1.state.y = inst.origin.y; const drawn = new I.Machine(pr, t1.world, t1.state, { budget: 100000 }).run().state.segs;
        if (T.sameDrawing(drawn, inst.target, { tol: 0.001, colors: true })) continue;      // the same picture (a turn after the last line): not a wrong program
        tried++; if (L.evaluate(l, pr).won) wins++;
      }
      if (wins) out.bad.push(`${l.id}: ${wins} of ${tried} wrong programs were accepted`);
      out['n' + l.id] = tried;
    }
    // other ways to draw the same picture are accepted
    out.twoLines = ev('w6-01', 'fd 30 fd 50').won;                        // a line drawn in two pieces
    out.sq = ev('w6-04', 'fd 60 tr 90 fd 60 tr 90 fd 60 tr 90 fd 60 tr 90').won;   // without a loop
    out.sqRev = ev('w6-04', 'repeat 4 { fd 60 tr 90 }').won;
    out.mirror = ev('w6-04', 'repeat 4 { fd 60 tl 90 }').won;              // the mirror image is another picture
    out.tri = ev('w6-05', 'repeat 3 { fd 60 tr 120 }').won;
    out.sqForTri = ev('w6-05', 'repeat 4 { fd 60 tr 90 }').won;
    out.hexForPenta = ev('w6-06', 'repeat 6 { fd 50 tr 60 }').won;
    out.within = ev('w6-04', 'repeat 4 { fd 61 tr 90 }').won;              // 1 unit off: inside the tolerance (3)
    out.outside = ev('w6-04', 'repeat 4 { fd 70 tr 90 }').won;
    out.empty = ev('w6-04', 'penup fd 10').won;
    out.colorWrong = ev('w6-10', 'color blue repeat 4 { fd 40 tr 90 } penup tr 90 fd 60 pendown color red repeat 3 { fd 40 tr 120 }').won;
    out.colorRight = ev('w6-10', 'color red repeat 4 { fd 40 tr 90 } penup tr 90 fd 60 pendown color blue repeat 3 { fd 40 tr 120 }').won;
    out.noColor = ev('w6-09', 'repeat 4 { fd 30 tr 90 } penup tr 90 fd 50 pendown repeat 4 { fd 30 tr 90 }').won;   // colours do not matter on a level without colours
    out.noPen = ev('w6-09', 'repeat 4 { fd 30 tr 90 } tr 90 fd 50 repeat 4 { fd 30 tr 90 }').won;                   // without lifting the pen the line between the squares is drawn: not the picture
    out.same = T.sameDrawing([{ x1: 0, y1: 0, x2: 10, y2: 0, c: 'black' }], [{ x1: 10, y1: 0, x2: 0, y2: 0, c: 'black' }]);
    out.emptyDraw = T.sameDrawing([], []);
    return out;
  });
  ok(TU.bad.length === 0, 'turtle levels: every picture is inside the canvas and centred, the reference draws it, and wrong programs (every length / angle changed by 10 / 15, a block missing) are NOT accepted' + (TU.bad.length ? ' FAILED: ' + TU.bad.slice(0, 5).join('; ') : ''));
  ok(TU.twoLines && TU.sq && TU.sqRev && TU.tri && TU.within, 'other ways to draw the same picture are accepted (a line in two pieces, no loop, 1 unit off)');
  ok(!TU.mirror && !TU.sqForTri && !TU.hexForPenta && !TU.outside && !TU.empty, 'a mirrored square, a square for a triangle, a hexagon for a pentagon, a side 10 units too long and a picture with no ink are rejected');
  ok(!TU.colorWrong && TU.colorRight && TU.noColor && !TU.noPen && TU.same && !TU.emptyDraw, 'colours are compared only where the level asks for them; a connecting line that should not be there is rejected; direction of a segment does not matter; two empty drawings are not a picture');

  // ---------- 9. the hint ----------
  const HT = await run((A) => {
    const ref = A.parse('repeat 4 { move left } light');
    const h = (src) => A.nextHint(A.parse(src), ref);
    return { empty: h('').needed, first: h('repeat 4 { move }').needed, wrong: (() => { const x = h('repeat 4 { right }'); return [x.needed, !!x.wrongId]; })(), extra: (() => { const x = h('repeat 4 { move left } light move'); return [x.needed, !!x.extraId]; })(), done: h('repeat 9 { move left } light').done, tail: h('repeat 4 { move left }').needed,
      ifelse: (() => { const x = A.nextHint(A.parse('if pathAhead { move } else { left }'), A.parse('if pathAhead { move }')); return x.needed === 'if' && !!x.wrongId; })(), kinds: A.kindTokens(A.parse('if pathAhead { move } else { left } repeat 2 { move }')).map((x) => x.kind).join() };
  });
  ok(HT.empty === 'repeat' && HT.first === 'left' && HT.wrong[0] === 'move' && HT.wrong[1] && HT.extra[0] === null && HT.extra[1] && HT.done && HT.tail === 'light', 'the hint names the next block the reference needs (empty -> repeat, then left, wrong block marked, extra block marked, numbers ignored)');
  ok(HT.ifelse && HT.kinds === 'ifelse,move,left,repeat,move', 'an if with an else part counts as "ifelse" in reading order');

  // ---------- 10. progress and the merge of two devices ----------
  const PM = await run((A, I, L, T, M, S) => {
    const e = M.EMPTY_CODING;
    const a = M.applyResult(e, 'w1-01', 2, 5), b = M.applyResult(a, 'w1-01', 3, 3), c = M.applyResult(b, 'w1-01', 1, 9), d = M.applyResult(c, 'w1-02', 1, 7);
    const out = { a: a.stars['w1-01'], b: b.stars['w1-01'], bb: b.blocks['w1-01'], c: c.stars['w1-01'], cb: c.blocks['w1-01'], d: Object.keys(d.stars).join() };
    // two devices
    const dev1 = { stars: { 'w1-01': 3, 'w1-02': 1 }, blocks: { 'w1-01': 3, 'w1-02': 8 }, challenges: 2 };
    const dev2 = { stars: { 'w1-01': 1, 'w1-03': 2 }, blocks: { 'w1-01': 9, 'w1-03': 6 }, challenges: 5 };
    out.merge = S.mergeDocs(dev1, dev2); out.merge2 = S.mergeDocs(dev2, dev1); out.mergeCoding = M.mergeCoding(dev1, dev2);
    out.mergeNull = S.mergeDocs(dev1, null) === dev1 && S.mergeDocs(null, dev2) === dev2;
    out.other = JSON.stringify(S.mergeDocs({ cards: { a: { last: '2026-01-02' } } }, { cards: { a: { last: '2026-01-01' } } }).cards.a.last);   // the old rules still work
    // world statistics and the recommendation
    const full1 = { stars: Object.fromEntries(L.levelsOf(1).map((l) => [l.id, 3])), blocks: {}, challenges: 0 };
    const half2 = { stars: { ...full1.stars, 'w2-01': 2 }, blocks: {}, challenges: 0 };
    out.w1 = M.worldStat(full1, 1); out.w2 = M.worldStat(half2, 2);
    out.rec = [M.recommendedWorld(e, null), M.recommendedWorld(e, 2), M.recommendedWorld(e, 5), M.recommendedWorld(e, 8), M.recommendedWorld(full1, 1), M.recommendedWorld(half2, 9)];
    const all = { stars: Object.fromEntries(L.LEVELS.map((l) => [l.id, 1])), blocks: {}, challenges: 0 };
    out.recAll = M.recommendedWorld(all, 3); out.total = M.totalStars(all);
    out.next = [M.nextLevelId('w1-01'), M.nextLevelId('w1-12'), M.nextLevelId('w6-14')];
    out.chal = M.addChallenge(e).challenges;
    out.path = M.codingPath('k1');
    return out;
  });
  ok(PM.a === 2 && PM.b === 3 && PM.bb === 3 && PM.c === 3 && PM.cb === 3 && PM.d === 'w1-01,w1-02', 'progress: the best stars and the fewest blocks are kept; a worse run changes nothing');
  ok(PM.merge.stars['w1-01'] === 3 && PM.merge.stars['w1-02'] === 1 && PM.merge.stars['w1-03'] === 2 && PM.merge.blocks['w1-01'] === 3 && PM.merge.challenges === 5, 'merge of two devices (sync.ts mergeDocs): larger stars, fewer blocks, larger challenge count, nothing lost: ' + JSON.stringify(PM.merge));
  const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
  ok(canon(PM.merge) === canon(PM.merge2) && canon(PM.merge.stars) === canon(PM.mergeCoding.stars) && PM.mergeNull && PM.other === '"2026-01-02"', 'the merge is symmetric, agrees with mergeCoding, handles a missing side and does not disturb the older rules');
  ok(PM.w1.done && PM.w1.stars === 36 && PM.w1.max === 36 && !PM.w2.done && PM.w2.stars === 2 && PM.w2.solved === 1, 'world statistics: stars, solved levels, finished world');
  ok(PM.rec.join() === '1,1,2,3,2,2' && PM.recAll === 0 && PM.total === 76, 'the recommended world: first unfinished one; with no progress the grade decides (no grade or 1-4 -> 1, 5-6 -> 2, 7-9 -> 3); 0 when everything is done: ' + PM.rec.join());
  ok(PM.next.join() === 'w1-02,,' && PM.chal === 1 && PM.path === 'coding/k1.json', 'next level, challenge counter, file name coding/<kid>.json');

  // ---------- 11. the lessons ----------
  const LS = await run((A, I, L) => import('/src/coding-lessons.ts').then((LE) => {
    const out = { bad: [], n: Object.keys(LE.LESSONS).length, firstUse: {} };
    for (const les of Object.values(LE.LESSONS)) {
      if (les.steps.length < 2 || les.steps.length > 4) out.bad.push(les.id + ' steps');
      for (const s of les.steps) {
        if (!/[一-鿿]/.test(s.text) || s.text.length > 60) out.bad.push(les.id + ' text');
        const prog = A.parse(s.demo.program);
        let w, st;
        if (s.demo.turtle) { const t = I.makeTurtle(); w = t.world; st = t.state; } else { const g = I.makeGrid(s.demo.rows, s.demo.start); w = g.world; st = g.state; }
        const r = new I.Machine(prog, w, st).run();
        const crashDemo = les.id === 'seq' && s.demo.program === 'move move' && s.demo.rows.length === 3;
        if (!crashDemo && r.status !== 'done') out.bad.push(`${les.id}: the demo "${s.demo.program}" ends with ${r.status}`);
        if (s.demo.turtle && !r.state.segs.length) out.bad.push(les.id + ' draws nothing');
      }
    }
    // every lesson named by a level exists; the first level of a world has the world's lesson
    for (const l of L.LEVELS) if (l.lesson) { out.firstUse[l.lesson] = l.id; if (!LE.LESSONS[l.lesson]) out.bad.push(l.id + ' unknown lesson ' + l.lesson); }
    for (const w of [1, 2, 3, 4, 5, 6]) if (!L.levelsOf(w)[0].lesson) out.bad.push('world ' + w + ' has no opening lesson');
    out.unused = Object.keys(LE.LESSONS).filter((k) => !out.firstUse[k]);
    return out;
  }));
  ok(LS.n === 13 && LS.bad.length === 0, `${LS.n} mini-lessons (2-4 steps, short texts); every demo program runs to its end on its map (only the wall demo crashes, on purpose)` + (LS.bad.length ? ' FAILED: ' + LS.bad.join('; ') : ''));
  ok(LS.unused.length === 0 && Object.keys(LS.firstUse).length === 13, 'every lesson is opened by exactly the first level that needs it: ' + Object.entries(LS.firstUse).map(([k, v]) => k + '@' + v).join(' '));

  ok(t.log.external.length === 0, 'no outside request: ' + t.log.external.join(', '));
  await t.browser.close();
  await done();
})();
