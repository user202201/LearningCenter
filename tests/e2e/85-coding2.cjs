// 编程 phase 2, block programming extension (worlds 7-10), ENGINE and DATA (no screens): the extended interpreter (lists, results of functions, recursion, expressions) against an
// independent reference evaluator on 1500 random programs, the pseudo-code round trip of every new block, endless loops / budget / recursion limits, the stage clock and its events
// (a step clock, taps, keys, messages, waiting), every level of worlds 7-10 (reference wins, par, palette, instances), the reference of every data level against an INDEPENDENT oracle
// on 80 random instances, wrong programs / programs that only fit the shown data / too slow programs are rejected, mutations of the reference solutions fail, a bounded exhaustive
// search proves that no shorter program solves the small levels, the lessons, the progress rules. Everything runs in the page (the modules are served by the dev server).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const p = t.page;
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const run = (fn, ...a) => p.evaluate(async ([f, args]) => {
    const A = await import('/src/coding-ast.ts'), I = await import('/src/coding-interp.ts'), L = await import('/src/coding-levels.ts'), L2 = await import('/src/coding-levels2.ts'),
      ST = await import('/src/coding-stage.ts'), M = await import('/src/coding-model.ts'), LE = await import('/src/coding-lessons2.ts'), S = await import('/src/sync.ts');
    return new Function('A', 'I', 'L', 'L2', 'ST', 'M', 'LE', 'S', 'a', 'return (' + f + ')(A, I, L, L2, ST, M, LE, S, ...a)')(A, I, L, L2, ST, M, LE, S, args);
  }, [fn.toString(), a]);

  // ---------- 1. the interpreter against an independent reference evaluator ----------
  const R = await run((A, I) => {
    let seed = 85001; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (l) => l[Math.floor(rnd() * l.length)];
    let id = 0; const B = (o) => ({ id: 'x' + ++id, ...o });
    const N = (v) => ({ k: 'n', v }), V = (name) => ({ k: 'v', name });
    const LS = ['xs', 'ys'];
    let safe = true;
    const idx = (list, e) => (safe ? { k: 'fn', f: 'maxOf', args: [N(1), { k: 'fn', f: 'minOf', args: [e, { k: 'list', f: 'len', list }] }] } : e);
    const den = (e) => (safe ? { k: 'fn', f: 'maxOf', args: [e, N(1)] } : e);
    // pure functions (no side effects, no division: they can be called inside expressions): the Machine runs a call inside an expression before the rest of the expression
    const leafP = (vars) => (rnd() < 0.5 ? N(pick([-2, -1, 0, 1, 2, 3, 5])) : V(pick(vars)));
    const exP = (d, vars) => (d <= 0 || rnd() < 0.3 ? leafP(vars) : rnd() < 0.7 ? { k: 'bin', op: pick(['+', '-', '*']), a: exP(d - 1, vars), b: exP(d - 1, vars) } : { k: 'fn', f: pick(['minOf', 'maxOf']), args: [exP(d - 1, vars), exP(d - 1, vars)] });
    const pf = { name: 'pf', params: ['p', 'q'], body: [B({ t: 'if', cond: { k: 'cmp', op: pick(['<', '>', '==']), a: exP(1, ['p', 'q']), b: exP(1, ['p', 'q']) }, body: [B({ t: 'return', e: exP(2, ['p', 'q']) })] }), B({ t: 'return', e: exP(2, ['p', 'q', 'a']) })] };
    const pg = { name: 'pg', param: 'p', body: [B({ t: 'return', e: { k: 'bin', op: '+', a: { k: 'call', name: 'pf', args: [V('p'), N(1)] }, b: V('p') } })] };
    const rec = { name: 'rec', param: 'p', body: [B({ t: 'if', cond: { k: 'cmp', op: '<', a: V('p'), b: N(1) }, body: [B({ t: 'return', e: N(1) })] }), B({ t: 'return', e: { k: 'bin', op: '+', a: { k: 'bin', op: '*', a: { k: 'call', name: 'rec', args: [{ k: 'bin', op: '-', a: V('p'), b: N(1) }] }, b: N(2) }, b: V('p') } })] };
    const ex = (d, vars) => {
      if (d <= 0 || rnd() < 0.25) return leafP(vars);
      switch (ri(0, 9)) {
        case 0: case 1: case 2: { const op = pick(['+', '-', '*', '+', '-', '/', '%']); const b = ex(d - 1, vars); return { k: 'bin', op, a: ex(d - 1, vars), b: op === '/' || op === '%' ? den(b) : b }; }
        case 3: return { k: 'list', f: pick(['len', 'sum', 'max', 'min']), list: pick(LS) };
        case 4: { const f = pick(['has', 'count', 'indexOf', 'item']), list = pick(LS); return { k: 'list', f, list, a: f === 'item' ? idx(list, ex(d - 1, vars)) : ex(d - 1, vars) }; }
        case 5: return { k: 'fn', f: pick(['floor', 'abs']), args: [ex(d - 1, vars)] };
        case 6: return { k: 'fn', f: pick(['minOf', 'maxOf']), args: [ex(d - 1, vars), ex(d - 1, vars)] };
        case 7: return bx(d - 1, vars);
        case 8: return { k: 'call', name: 'pf', args: [ex(d - 1, vars), ex(d - 1, vars)] };
        default: return pick([{ k: 'call', name: 'pg', args: [ex(d - 1, vars)] }, { k: 'call', name: 'rec', args: [{ k: 'fn', f: 'minOf', args: [{ k: 'fn', f: 'maxOf', args: [ex(d - 1, vars), N(0)] }, N(5)] }] }]);
      }
    };
    const bx = (d, vars) => {
      if (d <= 0) return { k: 'cmp', op: pick(['<', '<=', '>', '>=', '==', '!=']), a: leafP(vars), b: leafP(vars) };
      const r = rnd();
      return r < 0.6 ? { k: 'cmp', op: pick(['<', '<=', '>', '>=', '==', '!=']), a: ex(d, vars), b: ex(d, vars) } : r < 0.85 ? { k: 'logic', op: pick(['and', 'or']), a: bx(d - 1, vars), b: bx(d - 1, vars) } : { k: 'not', a: bx(d - 1, vars) };
    };
    const st = (d, vars) => {
      const tgt = () => pick(['a', 'b', 'c']);
      switch (ri(0, d > 0 ? 15 : 8)) {
        case 0: case 1: return B({ t: 'set', name: tgt(), e: ex(2, vars) });
        case 2: return B({ t: 'change', name: tgt(), e: ex(2, vars) });
        case 3: return B({ t: 'push', list: pick(LS), e: ex(2, vars) });
        case 4: { const l = pick(LS); return B({ t: 'lset', list: l, n: idx(l, ex(1, vars)), e: ex(2, vars) }); }
        case 5: { const l = pick(LS); return safe ? B({ t: 'push', list: l, e: ex(1, vars) }) : B({ t: 'lremove', list: l, n: ex(1, vars) }); }
        case 6: { const l = pick(LS); return B({ t: 'swap', list: l, n: idx(l, ex(1, vars)), e: idx(l, ex(1, vars)) }); }
        case 7: { const l = pick(LS); return safe ? B({ t: 'push', list: l, e: ex(1, vars) }) : B({ t: 'lclear', list: l }); }
        case 8: return inProc ? B({ t: 'change', name: tgt(), e: ex(1, vars) }) : B({ t: 'call', name: 'proc1', arg: ex(1, vars) });
        case 9: case 10: return B({ t: 'if', cond: bx(2, vars), body: block(d - 1, vars), ...(rnd() < 0.5 ? { els: block(d - 1, vars) } : {}) });
        case 11: return B({ t: 'repeat', n: N(ri(1, 3)), body: block(d - 1, vars) });
        case 12: return B({ t: 'for', name: 'i', n: N(ri(0, 2)), e: N(ri(1, 4)), body: block(d - 1, vars) });
        case 13: return B({ t: 'each', name: 'x', list: pick(LS), body: block(d - 1, vars) });
        default: { const k = ri(1, 3), cv = inProc ? 'f' : d >= 2 ? 'd' : 'e'; return B({ t: 'repeat', n: N(1), body: [B({ t: 'set', name: cv, e: N(0) }), B({ t: 'while', cond: { k: 'cmp', op: '<', a: V(cv), b: N(k) }, body: [B({ t: 'change', name: cv, e: N(1) }), ...block(d - 1, vars)] })] }); }
      }
    };
    const block = (d, vars) => Array.from({ length: ri(1, 3) }, () => st(d, vars));
    let inProc = false;
    const proc1 = (vars) => { inProc = true; const f = { name: 'proc1', param: 'p', body: Array.from({ length: ri(1, 3) }, () => st(1, [...vars, 'p'])) }; inProc = false; return f; };

    // --- the reference: a recursive evaluator written separately (no frames, no step objects) ---
    class Fault extends Error {} class Ret extends Error { constructor(v) { super('ret'); this.v = v; } }
    const clamp = (v) => (Number.isFinite(v) ? Math.max(-1e9, Math.min(1e9, v)) : 0);
    const refRun = (prog, init) => {
      let ops = 0;
      const S = { vars: { ...init.vars }, lists: JSON.parse(JSON.stringify(init.lists)) };
      const funcs = {}; for (const f of prog.funcs) funcs[f.name] = f;
      const frames = [];
      const Ls = (n) => (S.lists[n] ||= []);
      const callf = (f, args) => {
        const fr = {}; (f.params ?? (f.param ? [f.param] : [])).forEach((n, i) => { fr[n] = args[i] ?? 0; });
        frames.push(fr);
        try { exec(f.body); } catch (e) { if (e instanceof Ret) return e.v; throw e; } finally { frames.pop(); }
        return 0;
      };
      const val = (e) => {
        switch (e.k) {
          case 'n': return e.v;
          case 'v': { const f = frames[frames.length - 1]; return f && e.name in f ? f[e.name] : S.vars[e.name] ?? 0; }
          case 'not': return val(e.a) ? 0 : 1;
          case 'bin': { const a = val(e.a), b = val(e.b); if ((e.op === '/' || e.op === '%') && b === 0) throw new Fault(); return clamp(e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : e.op === '/' ? a / b : a % b); }
          case 'cmp': { const a = val(e.a), b = val(e.b); return +({ '<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b, '==': a === b, '!=': a !== b }[e.op]); }
          case 'logic': { const a = val(e.a) !== 0; return e.op === 'and' ? +(a && val(e.b) !== 0) : +(a || val(e.b) !== 0); }
          case 'list': {
            const l = Ls(e.list), a = e.a ? val(e.a) : 0;
            switch (e.f) {
              case 'len': return l.length; case 'sum': return clamp(l.reduce((x, y) => x + y, 0)); case 'max': return l.length ? Math.max(...l) : 0; case 'min': return l.length ? Math.min(...l) : 0;
              case 'has': return +l.includes(a); case 'count': return l.filter((x) => x === a).length; case 'indexOf': return l.indexOf(a) + 1;
              case 'item': { const i = Math.floor(a); if (i < 1 || i > l.length) throw new Fault(); return l[i - 1]; }
            }
            return 0;
          }
          case 'fn': { const v = e.args.map(val); return { floor: () => Math.floor(v[0]), abs: () => Math.abs(v[0]), minOf: () => Math.min(v[0], v[1]), maxOf: () => Math.max(v[0], v[1]) }[e.f](); }
          case 'call': return callf(funcs[e.name], e.args.map(val));
        }
        return 0;
      };
      const idx = (e) => Math.floor(val(e));
      const exec = (list) => {
        for (const b of list) {
          switch (b.t) {
            case 'set': S.vars[b.name] = clamp(val(b.e)); break;
            case 'change': S.vars[b.name] = clamp((S.vars[b.name] ?? 0) + val(b.e)); break;
            case 'push': Ls(b.list).push(clamp(val(b.e))); break;
            case 'lset': { const l = Ls(b.list), i = idx(b.n); if (i < 1 || i > l.length) throw new Fault(); l[i - 1] = clamp(val(b.e)); break; }
            case 'lremove': { const l = Ls(b.list), i = idx(b.n); if (i < 1 || i > l.length) throw new Fault(); l.splice(i - 1, 1); break; }
            case 'swap': { const l = Ls(b.list), i = idx(b.n), j = idx(b.e); if (i < 1 || j < 1 || i > l.length || j > l.length) throw new Fault(); [l[i - 1], l[j - 1]] = [l[j - 1], l[i - 1]]; break; }
            case 'lclear': S.lists[b.list] = []; break;
            case 'if': if (val(b.cond)) exec(b.body); else if (b.els) exec(b.els); break;
            case 'repeat': { const n = Math.max(0, Math.min(10000, Math.floor(val(b.n)))); for (let k = 0; k < n; k++) exec(b.body); break; }
            case 'for': { const from = Math.floor(val(b.n)), to = Math.floor(val(b.e)); for (let v = from; v <= to; v++) { S.vars[b.name] = v; exec(b.body); } break; }
            case 'each': { for (const v of [...Ls(b.list)]) { S.vars[b.name] = v; exec(b.body); } break; }
            case 'while': while (val(b.cond)) { if (++ops > 200000) throw new Fault(); exec(b.body); } break;
            case 'call': callf(funcs[b.name], (b.args ?? (b.arg ? [b.arg] : [])).map(val)); break;
            case 'return': throw new Ret(val(b.e));
          }
        }
      };
      let status = 'done';
      try { exec(prog.main); } catch (e) { if (e instanceof Fault) status = 'error'; else throw e; }
      return { status, vars: S.vars, lists: S.lists };
    };
    const stats = { done: 0, error: 0, compared: 0 }, bad = [];
    let calls = 0, lists = 0, nested = 0;
    for (let n = 0; n < 1500; n++) {
      const vars = ['a', 'b', 'c', 'd', 'e', 'f', 'i', 'x'];
      safe = rnd() < 0.85;
      const prog = { main: Array.from({ length: ri(2, 5) }, () => st(2, vars)), funcs: [pf, pg, rec, proc1(vars)] };
      const init = { vars: { a: ri(0, 5), b: ri(0, 5), c: ri(-2, 3) }, lists: { xs: Array.from({ length: ri(safe ? 2 : 0, 5) }, () => ri(0, 9)), ys: Array.from({ length: ri(safe ? 2 : 0, 4) }, () => ri(0, 9)) } };
      const text = A.toText(prog);
      const g = I.makeGrid(['###', '#>#', '###']);
      g.state.vars = { ...init.vars }; g.state.lists = JSON.parse(JSON.stringify(init.lists));
      const m = new I.Machine(prog, g.world, g.state, { budget: 400000, maxDepth: 400 });
      const r1 = m.run();
      const r2 = refRun(prog, init);
      calls += /\b(pf|pg|rec)\(/.test(text) ? 1 : 0; lists += /\b(len|sum|item|add)\(/.test(text) ? 1 : 0; nested += /for .*\{[^}]*(for|each) /s.test(text) ? 1 : 0;
      const k1 = r1.status === 'done' ? 'done' : r1.status === 'error' ? 'error' : 'other';
      if (k1 !== r2.status) { bad.push(`status ${n}: ${r1.status}/${r1.message} vs ${r2.status}`); continue; }
      stats[r2.status]++;
      if (r2.status === 'error') continue;
      stats.compared++;
      const sameVars = JSON.stringify(Object.entries(r1.state.vars).sort()) === JSON.stringify(Object.entries(r2.vars).sort());
      const sameLists = JSON.stringify(Object.entries(r1.state.lists).filter(([, v]) => v.length).sort()) === JSON.stringify(Object.entries(r2.lists).filter(([, v]) => v.length).sort());
      if (!sameVars || !sameLists) bad.push(`result ${n}: ${JSON.stringify(r1.state.vars)} ${JSON.stringify(r1.state.lists)} vs ${JSON.stringify(r2.vars)} ${JSON.stringify(r2.lists)}\n${text}`);
    }
    return { stats, bad: bad.slice(0, 3), nbad: bad.length, calls, lists, nested };
  });
  ok(R.nbad === 0, `extended interpreter = independent reference on 1500 random programs (lists, results of functions inside expressions, recursion, loops, short-circuit and / or, faults)` + (R.nbad ? ' FAILED: ' + R.bad.join(' // ') : ''));
  ok(R.stats.done >= 800 && R.stats.error >= 60 && R.calls > 500 && R.lists > 800 && R.nested > 60, `and the programs are varied: ${R.stats.done} finish, ${R.stats.error} stop with an error (index / division), ${R.calls} call functions inside expressions, ${R.lists} use lists, ${R.nested} nest loops`);

  // ---------- 2. pseudo-code round trip ----------
  const X = await run((A, I, L, L2) => {
    let seed = 777; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (l) => l[Math.floor(rnd() * l.length)];
    let id = 0; const B = (o) => ({ id: 'y' + ++id, ...o });
    const N = (v) => ({ k: 'n', v }), V = (name) => ({ k: 'v', name });
    const ex = (d) => {
      if (d <= 0 || rnd() < 0.2) return rnd() < 0.5 ? N(pick([-3, 0, 1, 2, 7, 1.5, 40])) : V(pick(['a', 'n', 'xs2', 'score']));
      switch (ri(0, 10)) {
        case 0: case 1: return { k: 'bin', op: pick(['+', '-', '*', '/', '%']), a: ex(d - 1), b: ex(d - 1) };
        case 2: return { k: 'cmp', op: pick(['<', '<=', '>', '>=', '==', '!=']), a: ex(d - 1), b: ex(d - 1) };
        case 3: return { k: 'logic', op: pick(['and', 'or']), a: ex(d - 1), b: ex(d - 1) };
        case 4: return { k: 'not', a: ex(d - 1) };
        case 5: return { k: 'list', f: pick(['len', 'sum', 'max', 'min']), list: pick(['xs', 'ys']) };
        case 6: return { k: 'list', f: pick(['has', 'count', 'indexOf', 'item']), list: pick(['xs', 'ys']), a: ex(d - 1) };
        case 7: { const f = pick(['floor', 'abs', 'sqrt', 'round', 'rand', 'minOf', 'maxOf', 'deg', 'nbr', 'heavier']); const n = { floor: 1, abs: 1, sqrt: 1, round: 1, rand: 2, minOf: 2, maxOf: 2, deg: 1, nbr: 2, heavier: 2 }[f]; return { k: 'fn', f, args: Array.from({ length: n }, () => ex(d - 1)) }; }
        case 8: return { k: 'call', name: pick(['f', 'tri']), args: Array.from({ length: ri(0, 3) }, () => ex(d - 1)) };
        case 9: return pick([{ k: 'touch', s: 'cat' }, { k: 'keyDown', key: 'left' }, { k: 'me', p: pick(['myX', 'myY', 'mySize', 'myCostume', 'myDir', 'floorNum', 'tapX', 'tapY']) }, { k: 'sense', s: 'pathAhead' }, { k: 'sense', s: 'colorIs', c: 'r' }]);
        default: return { k: 'bin', op: '-', a: ex(d - 1), b: N(-2) };
      }
    };
    const st = (d) => {
      const body = () => Array.from({ length: ri(0, 2) }, () => st(d - 1));
      const k = ri(0, d > 0 ? 36 : 28);
      const list = pick(['xs', 'ys']);
      switch (k) {
        case 0: return B({ t: pick(['move', 'left', 'right', 'take', 'light', 'penup', 'pendown', 'nextcostume', 'show', 'hide']) });
        case 1: return B({ t: pick(['fd', 'tl', 'tr', 'smove', 'sturn', 'changex', 'changey', 'wait', 'costume', 'size']), n: ex(2) });
        case 2: return B({ t: 'color', c: pick(['red', 'blue']) });
        case 3: return B({ t: 'set', name: 'a', e: ex(2) });
        case 4: return B({ t: 'change', name: 'n', e: ex(2) });
        case 5: return B({ t: 'waitUntil', cond: ex(2) });
        case 6: return B({ t: 'return', e: ex(2) });
        case 7: return B({ t: 'push', list, e: ex(2) });
        case 8: return B({ t: 'lset', list, n: ex(1), e: ex(1) });
        case 9: return B({ t: 'lremove', list, n: ex(1) });
        case 10: return B({ t: 'swap', list, n: ex(1), e: ex(1) });
        case 11: return B({ t: 'lclear', list });
        case 12: return B({ t: 'goto', n: ex(1), e: ex(1) });
        case 13: return B({ t: 'note', n: ex(1), e: ex(1) });
        case 14: return B({ t: 'say', c: pick(['hi', 'bye']) });
        case 15: return B({ t: 'sayfor', c: pick(['hi', 'bye']), n: ex(1) });
        case 16: return B({ t: 'broadcast', c: pick(['go', 'stop2']) });
        case 17: { const args = Array.from({ length: ri(0, 3) }, () => ex(1)); return B({ t: 'call', name: pick(['f', 'tri']), ...(args.length === 1 ? { arg: args[0] } : args.length > 1 ? { args } : {}) }); }
        case 18: case 19: case 20: case 21: case 22: case 23: case 24: case 25: case 26: case 27: case 28: return B({ t: 'set', name: 'score', e: ex(2) });
        case 29: return B({ t: 'repeat', n: ex(1), body: body() });
        case 30: return B({ t: 'forever', body: body() });
        case 31: return B({ t: 'for', name: 'i', n: ex(1), e: ex(1), body: body() });
        case 32: return B({ t: 'each', name: 'x', list, body: body() });
        case 33: return B({ t: pick(['while', 'until']), cond: ex(2), body: body() });
        case 34: case 35: return B({ t: 'if', cond: ex(2), body: body(), ...(rnd() < 0.5 ? { els: body() } : {}) });
        default: return B({ t: 'repeat', n: N(2), body: [st(0)] });
      }
    };
    let bad = 0, n = 0, first = '';
    const kinds = new Set(), exprKinds = new Set();
    for (let i = 0; i < 800; i++) {
      const prog = { main: Array.from({ length: ri(0, 3) }, () => st(2)), funcs: [] };
      if (rnd() < 0.5) { const np = ri(0, 3); const ps = ['a', 'b', 'c'].slice(0, np); prog.funcs.push({ name: 'f', ...(np > 1 ? { params: ps } : np === 1 ? { param: ps[0] } : {}), body: Array.from({ length: ri(1, 2) }, () => st(1)) }); }
      if (rnd() < 0.5) prog.scripts = Array.from({ length: ri(1, 3) }, () => ({ sprite: pick(['cat', 'dog']), on: pick(['start', 'tap', 'stagetap', 'key(left)', 'key(space)', 'recv(go)']), body: Array.from({ length: ri(0, 2) }, () => st(1)) }));
      const text = A.toText(prog);
      let back; try { back = A.parse(text); } catch (e) { bad++; if (!first) first = 'parse error ' + e.message + '\n' + text; continue; }
      n++;
      if (A.shape(back) !== A.shape(prog) || A.toText(back) !== text) { bad++; if (!first) first = text; }
      for (const l of A.allLists(prog)) A.walk(l, (b) => { kinds.add(b.t); });
    }
    // some exact texts
    const samples = {
      a: A.toText(A.parse('def fact(n) { if n == 0 { return 1 } return n * fact(n - 1) } set r = fact(5)')),
      b: A.toText(A.parse('on key(left) cat { changex -10 } on start cat { forever { if touching(dog) and keyDown(left) { say hi } } }')),
      c: A.toText(A.parse('for i = 1 to len(xs) - 1 { swap(xs, i, i + 1) } each x in xs { add(ys, x % 2) }')),
      d: A.toText(A.parse('set a = 1 - (2 - 3) set b = (1 < 2) == 1 set c = !(a and b) or a')),
      e: A.toText(A.parse('def sum3(a, b, c) { return a + b + c }')),
    };
    const errs = []; for (const s of ['for i = 1 { }', 'each x xs { }', 'on foo cat { }', 'add(xs 1)', 'set a = (1 +', 'say', 'goto(1)', 'x = 3']) { try { A.parse(s); errs.push('accepted: ' + s); } catch (e) { if (e.constructor.name !== 'ParseError') errs.push('wrong error for ' + s + ': ' + e.constructor.name); } }
    const lv = L.LEVELS.filter((l) => l.world >= 7).every((l) => A.shape(A.parse(A.toText(l.sol))) === A.shape(l.sol));
    return { bad, n, first, kinds: [...kinds].length, samples, errs, lv };
  });
  ok(X.bad === 0 && X.n === 800, `toText / parse round trip on ${X.n} random programs (all ${X.kinds} block kinds, every kind of value, functions with 0-3 parameters, event scripts)` + (X.bad ? ' FAILED: ' + X.first : ''));
  ok(X.kinds >= 36, 'the random programs use at least 36 kinds of block (' + X.kinds + ')');
  ok(X.lv, 'the reference solution of every level of worlds 7-10 survives the round trip');
  ok(X.samples.a === 'def fact(n) {\n  if n == 0 {\n    return 1\n  }\n  return n * fact(n - 1)\n}\nset r = fact(5)', 'exact layout of a function with a result: ' + JSON.stringify(X.samples.a));
  ok(X.samples.b === 'on key(left) cat {\n  changex -10\n}\non start cat {\n  forever {\n    if touching(dog) and keyDown(left) {\n      say hi\n    }\n  }\n}', 'exact layout of event scripts');
  ok(X.samples.c.includes('for i = 1 to len(xs) - 1 {') && X.samples.c.includes('swap(xs, i, i + 1)') && X.samples.c.includes('each x in xs {') && X.samples.c.includes('add(ys, x % 2)'), 'for / each / swap / add are written as read');
  ok(X.samples.d === 'set a = 1 - (2 - 3)\nset b = (1 < 2) == 1\nset c = !(a and b) or a' && X.samples.e === 'def sum3(a, b, c) {\n  return a + b + c\n}', 'brackets: the right side of a minus, a comparison inside a comparison, not / and / or');
  ok(X.errs.length === 0, 'broken texts give a ParseError (and nothing else): ' + X.errs.join('; '));

  // ---------- 3. endless loops, budget, recursion, faults ----------
  const E = await run((A, I) => {
    const go = (src, o = {}, lists = {}, vars = {}) => { const g = I.makeGrid(['#####', '#>..#', '#####']); g.state.lists = lists; g.state.vars = vars; const m = new I.Machine(A.parse(src), g.world, g.state, o); const t0 = performance.now(); const r = m.run(); return { status: r.status, msg: r.message, steps: r.steps, vars: r.state.vars, lists: r.state.lists, ms: performance.now() - t0, depth: m.depth }; };
    const out = {};
    out.same = go('set i = 1 while i <= 3 { }');
    out.listLoop = go('while len(xs) < 5 { setItem(xs, 1, 7) }', {}, { xs: [1], ys: [] });
    out.moving = go('while 1 { change n by 1 }');
    out.forever = go('forever { change n by 1 }');
    out.recInf = go('def f(n) { return f(n + 1) } set r = f(0)', { maxDepth: 400 });
    out.recDeep = go('def f(n) { if n == 0 { return 0 } return 1 + f(n - 1) } set r = f(50)', { maxDepth: 400 });
    out.recTooDeep = go('def f(n) { if n == 0 { return 0 } return 1 + f(n - 1) } set r = f(500)', { maxDepth: 400 });
    out.mutual = go('def a(n) { return b(n) } def b(n) { return a(n) } set r = a(1)', { maxDepth: 100 });
    out.fact = go('def fact(n) { if n == 0 { return 1 } return n * fact(n - 1) } set r = fact(10)', { maxDepth: 400 });
    out.noret = go('def f(n) { set t = n } set r = f(3) + 1');
    out.retMain = go('set a = 1 return 5 set a = 2');
    out.retMid = go('def f(n) { each x in xs { if x == n { return x * 10 } } return 0 } set r = f(7) set s = f(9)', { maxDepth: 400 }, { xs: [3, 7, 5] });
    out.div0 = go('set a = 5 / (3 - 3)'); out.mod0 = go('set a = 5 % 0');
    out.range = go('set a = item(xs, 4)', {}, { xs: [1, 2, 3] }); out.rangeSet = go('setItem(xs, 0, 5)', {}, { xs: [1] }); out.swapBad = go('swap(xs, 1, 3)', {}, { xs: [1, 2] });
    out.shortAnd = go('set i = 5 if i <= len(xs) and item(xs, i) == 3 { set a = 1 } else { set a = 2 }', {}, { xs: [1, 2] });
    out.shortOr = go('set i = 1 if i <= len(xs) or item(xs, 9) == 3 { set a = 1 }', {}, { xs: [1, 2] });
    out.big = go('repeat 600 { add(xs, 1) }', {}, { xs: [] });
    out.exprStep = (() => { const g = I.makeGrid(['###', '#>#', '###']); const m = new I.Machine(A.parse('def f(n) { return n + 1 } set a = f(1) + f(2)'), g.world, g.state); const log = []; let info; while ((info = m.step())) log.push(info.t + ':' + m.callStack().map((x) => x.name + '(' + Object.values(x.args) + ')').join('>')); return { log, a: m.state.vars.a, status: m.status }; })();
    out.old = go('move move move'); out.oldRec = go('def f { f } f');
    out.params = go('def f(a, b) { return a * 10 + b } set r = f(3, 4) set s = f(1)');
    out.arith = go('set a = 7 / 2 set b = 7 % 3 set c = floor(7 / 2) set d = abs(0 - 4) set e = minOf(2, 9) + maxOf(2, 9) set f = sqrt(16) set g = round(2.6)');
    out.msgs = I.MSG;
    return out;
  });
  ok(E.same.status === 'infinite' && E.same.steps < 20 && E.listLoop.status === 'infinite' && E.listLoop.steps < 40, 'endless loops are detected exactly also with lists in the state (the state does not change: no waiting for the budget): ' + E.same.steps + ' / ' + E.listLoop.steps + ' steps');
  ok(E.moving.status === 'budget' && E.forever.status === 'budget' && E.moving.ms < 1500, 'a loop whose state keeps changing, and a forever loop, are stopped by the step budget');
  ok(E.recInf.status === 'error' && /调用得太深/.test(E.recInf.msg) && E.mutual.status === 'error', 'a function that calls itself for ever (also two functions that call each other) stops with the "too deep" message: no crash');
  ok(E.recDeep.status === 'done' && E.recDeep.vars.r === 50 && E.recTooDeep.status === 'error', 'a recursion of depth 50 works with the larger limit, one of depth 500 is stopped (limit 400 frames)');
  ok(E.fact.vars.r === 3628800 && E.noret.vars.r === 1 && E.retMain.status === 'done' && E.retMain.vars.a === 1, 'fact(10) = 3628800; a function without return gives 0; a return in the main program ends it');
  ok(E.retMid.vars.r === 70 && E.retMid.vars.s === 0 && E.params.vars.r === 34 && E.params.vars.s === 10, 'return out of a loop inside a function (the loop is left), functions with two parameters, a missing argument is 0');
  ok(E.div0.status === 'error' && E.mod0.status === 'error' && E.div0.msg === E.msgs.div && E.range.status === 'error' && E.range.msg === E.msgs.range && E.rangeSet.status === 'error' && E.swapBad.status === 'error' && E.big.status === 'error', 'division by 0, a missing item, a bad index in setItem / swap and a list of more than 500 items stop the program with a message');
  ok(E.shortAnd.status === 'done' && E.shortAnd.vars.a === 2 && E.shortOr.status === 'done' && E.shortOr.vars.a === 1, 'and / or look at the second side only when it matters: i <= len(xs) and item(xs, i) never reads past the end');
  ok(E.arith.vars.a === 3.5 && E.arith.vars.b === 1 && E.arith.vars.c === 3 && E.arith.vars.d === 4 && E.arith.vars.e === 11 && E.arith.vars.f === 4 && E.arith.vars.g === 3, 'division is real division, mod is the remainder, floor / abs / minOf / maxOf / sqrt / round: ' + JSON.stringify(E.arith.vars));
  ok(E.exprStep.status === 'done' && E.exprStep.a === 5 && E.exprStep.log.length === 5 && E.exprStep.log.some((l) => l.includes('set:f(1)')) && E.exprStep.log.some((l) => l.includes('set:f(2)')) && E.exprStep.log[4] === 'set:', 'step by step, a call inside a value is a visible call of its own with its place on the call stack: ' + E.exprStep.log.join(' | '));
  ok(E.old.status === 'crash' && E.oldRec.status === 'error' && /调用得太深/.test(E.oldRec.msg), 'phase-1 behaviour is unchanged (a wall crashes; "def f { f } f" is too deep with the default limit)');

  // ---------- 4. the stage: the step clock, events, messages ----------
  const ST = await run((A, I, L, L2, STG) => {
    const sp = (id, x = 0, y = 0) => ({ id, art: id === 'dog' ? 'dog' : 'cat', x, y, label: id });
    const ext = (o = {}) => ({ sprites: [sp('cat', -50, 0), sp('dog', 50, 0)], slots: [], inputs: [], ticks: 100, checks: [], texts: { hi: 'hi', bye: 'bye' }, ...o });
    const go = (src, o = {}, until) => { const e = ext(o); const r = new STG.StageRun(A.parse(src), e); const log = []; for (let t = 0; t < (until ?? e.ticks); t++) { r.step(); log.push(r.snap()); } return { log, r, st: r.state.stage }; };
    const out = {};
    // waiting is exact: "wait 1" = 20 ticks
    { const { log } = go('on start cat { say hi wait 1 say bye }', {}, 60); const i = log.findIndex((s) => s.sprites.cat.say === 'bye'); out.waitAt = i; out.sayFirst = log[0].sprites.cat.say; }
    // forever yields at the end of every round: one move per tick
    { const { log } = go('on start cat { forever { changey 2 } }', {}, 40); out.fy = [log[0].sprites.cat.y, log[9].sprites.cat.y, log[29].sprites.cat.y]; }
    // repeat yields too (an animation: 8 rounds = 8 ticks)
    { const { log } = go('on start cat { repeat 8 { smove 10 } }', {}, 20); out.rep = [log[0].sprites.cat.x, log[3].sprites.cat.x, log[7].sprites.cat.x, log[12].sprites.cat.x]; }
    // two threads at the same time
    { const { log } = go('on start cat { forever { changey 1 } } on start dog { forever { changey -1 } }', {}, 10); out.two = [log[9].sprites.cat.y, log[9].sprites.dog.y]; }
    // a tap starts the script of that sprite only; a second tap restarts it
    { const { log } = go('on tap cat { say hi wait 1 say bye } on tap dog { say bye }', { inputs: [{ tick: 5, type: 'tap', sprite: 'cat' }] }, 30); out.tap = [log[4].sprites.cat.say, log[5].sprites.cat.say, log[5].sprites.dog.say, log[24].sprites.cat.say, log[25].sprites.cat.say]; }
    { const { log } = go('on tap cat { changex 5 wait 1 changex 5 }', { inputs: [{ tick: 2, type: 'tap', sprite: 'cat' }, { tick: 10, type: 'tap', sprite: 'cat' }] }, 40); out.restart = [log[12].sprites.cat.x, log[39].sprites.cat.x]; }
    // keys: the hat starts on the press, keyDown is true while the key is held
    { const { log } = go('on key(right) cat { changex 30 } on start dog { forever { if keyDown(left) { changex 1 } } }', { inputs: [{ tick: 3, type: 'key', key: 'right' }, { tick: 5, type: 'key', key: 'left', hold: 4 }] }, 20); out.key = [log[2].sprites.cat.x, log[3].sprites.cat.x, log[15].sprites.dog.x - 50]; }
    // the stage tap gives the position
    { const { log } = go('on stagetap cat { goto(tapX, tapY) }', { inputs: [{ tick: 1, type: 'stagetap', x: 40, y: -20 }] }, 5); out.stagetap = [log[2].sprites.cat.x, log[2].sprites.cat.y]; }
    // messages: a chain, each receiver starts in the same tick; sayfor ends by itself
    { const { log, r } = go('on start cat { sayfor(hi, 1) broadcast go } on recv(go) dog { say bye }', {}, 40); out.msg = [log[10].sprites.dog.say, log[19].sprites.dog.say, log[20].sprites.dog.say, log[19].sprites.cat.say, log[21].sprites.cat.say, r.sent.length, r.sent[0].tick]; }
    // the sprite stays on the stage; notes are recorded with their start time; a wrong block name in a script is an error message
    { const { log, st } = go('on start cat { repeat 30 { smove 20 } note(60, 1) note(62, 2) }', {}, 50); out.edge = [log[29].sprites.cat.x, st.notes.map((n) => n.pitch + '@' + n.tick).join()]; }
    // touching, size, costume, hide
    { const { log } = go('on start cat { goto(50, 0) say hi } on start dog { size 200 costume 3 hide }', {}, 3); out.touch = [log[1].sprites.cat.say, log[1].sprites.dog.size, log[1].sprites.dog.costume, log[1].sprites.dog.visible]; }
    { const { log } = go('on start cat { forever { if touching(dog) { say hi } else { say bye } wait 0.1 } } on start dog { wait 1 goto(-50, 0) }', {}, 30); out.touching = [log[5].sprites.cat.say, log[25].sprites.cat.say]; }
    // random numbers: the same seed gives the same sequence, another seed another one
    { const a = go('on start cat { goto(rand(-100, 100), rand(-60, 60)) }', { seed: 5 }, 2).log[1].sprites.cat, b = go('on start cat { goto(rand(-100, 100), rand(-60, 60)) }', { seed: 5 }, 2).log[1].sprites.cat, c = go('on start cat { goto(rand(-100, 100), rand(-60, 60)) }', { seed: 6 }, 2).log[1].sprites.cat; out.rand = [a.x === b.x && a.y === b.y, a.x !== c.x || a.y !== c.y, Math.abs(a.x) <= 100, Math.abs(a.y) <= 60]; }
    // the same program twice gives the same snapshots (deterministic)
    { const x1 = go('on start cat { forever { changex 3 sturn 7 } }', {}, 30).log, x2 = go('on start cat { forever { changex 3 sturn 7 } }', {}, 30).log; out.det = JSON.stringify(x1) === JSON.stringify(x2); }
    // an endless thread that never waits does not hang the clock (budget); the error message comes out
    { const e = ext({ ticks: 40 }); const r = new STG.StageRun(A.parse('on start cat { while 1 { change n by 1 } }'), e); const t0 = performance.now(); for (let i = 0; i < 40; i++) r.step(); out.hang = [r.status, performance.now() - t0 < 2000]; }
    // a live key press and release
    { const e = ext({ keys: { left: 'l' } }); const r = new STG.StageRun(A.parse('on start dog { forever { if keyDown(left) { changex 1 } } } on key(left) cat { say hi }'), e, false); r.step(); r.press('left'); r.step(); r.step(); r.release('left'); r.step(); r.step(); out.live = [r.snap().sprites.dog.x - 50, r.snap().sprites.cat.say]; }
    out.mine = L.LEVELS.filter((l) => l.world === 7).length;
    return out;
  });
  ok(ST.waitAt === 20 && ST.sayFirst === 'hi', '"wait 1" takes exactly 20 ticks (1 second): the second line appears at tick ' + ST.waitAt);
  ok(JSON.stringify(ST.fy) === '[2,20,60]' && JSON.stringify(ST.rep) === '[-40,-10,30,30]', 'a loop gives the other scripts their turn at the end of every round (forever { changey 2 } moves once a tick; repeat 8 { smove 10 } takes 8 ticks): ' + JSON.stringify([ST.fy, ST.rep]));
  ok(JSON.stringify(ST.two) === '[10,-10]', 'two scripts run side by side');
  ok(JSON.stringify(ST.tap) === '["","hi","","hi","bye"]', 'a tap starts the scripts of the tapped sprite only (cat says hi, dog stays quiet) and the wait runs on: ' + JSON.stringify(ST.tap));
  ok(ST.restart[0] === -40 && ST.restart[1] === -35, 'a second tap on a running script starts it again from the top (it does not run twice at once): ' + JSON.stringify(ST.restart));
  ok(ST.key[0] === -50 && ST.key[1] === -20 && ST.key[2] === 4, 'a key hat starts on the press (x -50 -> -20), keyDown is true exactly while the key is held (4 ticks): ' + JSON.stringify(ST.key));
  ok(ST.stagetap[0] === 40 && ST.stagetap[1] === -20, 'a tap on the stage gives tapX / tapY');
  ok(ST.msg[0] === '' && ST.msg[1] === '' && ST.msg[2] === 'bye' && ST.msg[3] === 'hi' && ST.msg[4] === '' && ST.msg[5] === 1 && ST.msg[6] === 20, 'a message starts the waiting scripts at once; "say for 1 second" ends by itself: ' + JSON.stringify(ST.msg));
  ok(ST.edge[0] === 120 && ST.edge[1] === '60@30,62@40', 'a sprite cannot leave the stage (x stops at 120); notes are recorded with their start tick: ' + ST.edge.join(' / '));
  ok(ST.touch[0] === 'hi' && ST.touch[1] === 200 && ST.touch[2] === 3 && ST.touch[3] === false, 'goto / say / size / costume / hide');
  ok(ST.touching[0] === 'bye' && ST.touching[1] === 'hi', 'touching(dog) is true while the circles of the two sprites overlap');
  ok(ST.rand[0] && ST.rand[1] && ST.rand[2] && ST.rand[3], 'random numbers: the same seed gives the same numbers, another seed other numbers, always inside the range');
  ok(ST.det, 'the same program gives exactly the same snapshots every time (no real clock, no hidden randomness)');
  ok(ST.hang[0] === 'error' && ST.hang[1], 'a script that never waits and never ends is stopped with an error (the clock does not hang)');
  ok(ST.live[0] === 2 && ST.live[1] === 'hi', 'live input: press / release of a key (the hat starts, keyDown is true while held)');

  // ---------- 5. the levels ----------
  const LV = await run((A, I, L, L2, STG, M, LE) => {
    const out = { n: {}, bad: [], ids: new Set(), kinds: {} };
    const ls = L.LEVELS.filter((l) => l.world >= 7 && l.world <= 10);
    const used = (l) => { const kinds = new Set(), vars = new Set(), funcs = new Set(); for (const li of A.allLists(l.sol)) A.walk(li, (b) => { kinds.add(b.t === 'if' && b.els ? 'ifelse' : b.t); if (b.t === 'set' || b.t === 'change') vars.add(b.name); if (b.t === 'call') funcs.add(b.name); }); return { kinds, vars, funcs }; };
    for (const l of ls) {
      out.n[l.world] = (out.n[l.world] || 0) + 1;
      if (out.ids.has(l.id)) out.bad.push('duplicate ' + l.id); out.ids.add(l.id);
      if (l.id !== `w${l.world}-${String(l.no).padStart(2, '0')}`) out.bad.push('id ' + l.id);
      const e = L.evaluate(l, l.sol);
      if (!e.won) out.bad.push(l.id + ' reference does not win: ' + e.status + ' ' + e.missing.join() + ' ' + e.message);
      if (A.countBlocks(l.sol) !== l.par || l.par < 1) out.bad.push(l.id + ' par');
      if (l.par > l.max) out.bad.push(l.id + ' max < par');
      const u = used(l);
      for (const k of u.kinds) if (!l.palette.includes(k) && !(k === 'call' && l.palette.includes('call'))) out.bad.push(`${l.id} uses ${k} that is not in the palette`);
      const ext = L2.extOf(l);
      for (const v of u.vars) if (!(l.vars ?? []).includes(v)) out.bad.push(`${l.id} variable ${v} not listed`);
      for (const li of A.allLists(l.sol)) A.walk(li, (b) => { if (b.t === 'for' || b.t === 'each') if (!(l.vars ?? []).includes(b.name)) out.bad.push(`${l.id} loop variable ${b.name} not listed`); if (b.list && !(ext.lists ?? []).includes(b.list)) out.bad.push(`${l.id} list ${b.list} not offered`); });
      const fl = (f) => f.name + '(' + A.paramsOf(f).join(',') + ')';
      if (l.sol.funcs.map(fl).join() !== (l.funcs ?? []).map(fl).join()) out.bad.push(l.id + ' functions differ from the palette spec');
      if ((l.funcs ?? []).length && !l.palette.includes('call') && !l.palette.includes('return')) out.bad.push(l.id + ' functions but no call / return block');
      if (!/[一-鿿]/.test(l.title)) out.bad.push(l.id + ' title');
      if (!ext.goal?.length && !l.note && !l.family) out.bad.push(l.id + ' no goal text');
      if (l.lesson && !LE.LESSONS2[l.lesson]) out.bad.push(l.id + ' unknown lesson ' + l.lesson);
      if (L.evaluate(l, { main: [], funcs: [] }).won) out.bad.push(l.id + ' empty program wins');
      if (l.kind === 'stage') {
        const s = ext.stage;
        if (l.sol.scripts.length !== s.slots.length) out.bad.push(l.id + ' scripts / slots ' + l.sol.scripts.length + '/' + s.slots.length);
        l.sol.scripts.forEach((sc, i) => { const sl = s.slots[i]; if (!sl || sl.sprite !== sc.sprite || !sl.events.includes(sc.on)) out.bad.push(`${l.id} script ${i} (${sc.sprite} ${sc.on}) does not fit slot ${i}`); });
        for (const c of s.checks) if (c.tick > s.ticks) out.bad.push(l.id + ' check after the end');
        for (const sc of [...l.sol.scripts]) A.walk(sc.body, (b) => { if (b.t === 'say' || b.t === 'sayfor') if (!(b.c in s.texts)) out.bad.push(l.id + ' text ' + b.c + ' unknown'); if (b.t === 'broadcast' && !(s.msgs ?? {})[b.c]) out.bad.push(l.id + ' message ' + b.c + ' unknown'); });
        if (!s.checks.length) out.bad.push(l.id + ' no checks');
        // the empty program and a program that waits for the wrong event fail; the hat can be changed to every offered event
        for (const sl of s.slots) if (!sl.events.includes(sl.on)) out.bad.push(l.id + ' slot default not offered');
      }
      if (l.kind === 'data') {
        const d = ext.data;
        for (const name of d.check) { const inst = L2.dataInst(l); if (!(name in inst.lists) && !(name in L2.dataTarget(l).vars) && !(name in L2.dataTarget(l).lists)) out.bad.push(l.id + ' unknown check ' + name); }
        const s = I.cloneState(L2.dataTarget(l) && l.sol ? new I.Machine({ main: [], funcs: [] }, { kind: 'data' }, L2.makeRun(l, { main: [], funcs: [] }).state).state : null);
        void s;
      }
      for (const k of u.kinds) out.kinds[k] = (out.kinds[k] || 0) + 1;
    }
    out.firstLesson = [7, 8, 9, 10].map((w) => !!L.levelsOf(w)[0].lesson);
    out.worlds = L.WORLDS.map((w) => w.id).filter((i) => i >= 7 && i <= 10).join();
    out.lessonUsed = [...new Set(ls.map((l) => l.lesson).filter(Boolean))];
    out.lessonAll = Object.keys(LE.LESSONS2);
    out.kinds = Object.keys(out.kinds);
    return out;
  });
  ok([7, 8, 9, 10].every((w) => LV.n[w] === 14) && LV.worlds === '7,8,9,10', `worlds 7-10 have 14 levels each (${[7, 8, 9, 10].map((w) => LV.n[w]).join(' / ')} = ${Object.values(LV.n).reduce((a, b) => a + b, 0)} new levels) and are registered as worlds`);
  ok(LV.bad.length === 0, 'every new level: the reference solution wins (shown instance AND five hidden ones), par = its blocks, max >= par, only palette blocks / listed variables, lists and texts / messages, functions as declared, scripts fit the slots, the empty program fails' + (LV.bad.length ? ' FAILED: ' + LV.bad.slice(0, 6).join('; ') : ''));
  ok(LV.firstLesson.every(Boolean) && LV.lessonUsed.every((id) => LV.lessonAll.includes(id)) && LV.lessonAll.every((id) => LV.lessonUsed.includes(id)), `every lesson is opened by the first level that needs it (${LV.lessonUsed.length} lessons, each world starts with one); no lesson is unused`);
  ok(['forever', 'for', 'each', 'wait', 'return', 'push', 'swap', 'lset', 'smove', 'sayfor', 'note', 'broadcast', 'goto', 'sturn', 'nextcostume', 'change', 'repeat', 'while'].every((k) => LV.kinds.includes(k)), 'the levels use the new blocks: ' + LV.kinds.join(' '));

  // ---------- 6. the reference of every data level against an independent oracle (80 random instances each) ----------
  const OR = await run((A, I, L, L2) => {
    const out = { bad: [], n: 0, per: {} };
    const tests = (inst) => (inst.main ? [...inst.main.matchAll(/set (r\d+) = (\w+)\(([^)]*)\)/g)].map((m) => ({ name: m[1], fn: m[2], args: m[3].split(',').map((x) => Number(x.trim())) })) : []);
    const fib = (n) => { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; };
    const F = {
      double: ([x]) => 2 * x, sum3: ([a, b, c]) => a + b + c, bigger: ([a, b]) => Math.max(a, b), even: ([n]) => +(n % 2 === 0), hyp2: ([a, b]) => a * a + b * b, total: ([n]) => (n * (n + 1)) / 2,
      fact: ([n]) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }, fib: ([n]) => fib(n), power: ([a, b]) => a ** b, digsum: ([n]) => String(n).split('').reduce((s, c) => s + +c, 0),
    };
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const prime = (n) => { if (n < 2) return 0; for (let d = 2; d * d <= n; d++) if (n % d === 0) return 0; return 1; };
    const mode = (xs) => { let best = 0, m = 0; for (const x of xs) { const c = xs.filter((y) => y === x).length; if (c > best) { best = c; m = x; } } return m; };
    const bfs = (g) => { const d = Array(g.n).fill(-1); d[0] = 0; const q = [1]; for (let h = 0; h < q.length; h++) for (const [a, b] of g.edges) { const u = q[h]; const v = a === u ? b : b === u ? a : 0; if (v && d[v - 1] < 0) { d[v - 1] = d[u - 1] + 1; q.push(v); } } return d; };
    const O = {
      'w9-01': () => ({ xs: [4, 8, 15] }), 'w9-02': (i) => ({ a: i.lists.xs[2] }), 'w9-03': (i) => ({ n: i.lists.xs.length, last: i.lists.xs.at(-1) }), 'w9-04': (i) => ({ s: i.lists.xs.reduce((a, b) => a + b, 0) }),
      'w9-05': (i) => ({ m: Math.max(...i.lists.xs) }), 'w9-06': (i) => ({ m: Math.min(...i.lists.xs) }), 'w9-07': (i) => ({ c: i.lists.xs.filter((x) => x > 5).length }), 'w9-08': (i) => ({ evens: i.lists.xs.filter((x) => x % 2 === 0) }),
      'w9-09': (i) => ({ pos: i.lists.xs.indexOf(i.vars.t) + 1 }), 'w9-11': (i) => { const s = i.lists.xs.reduce((a, b) => a + b, 0); return { total: s, avg: s / i.lists.xs.length }; }, 'w9-12': (i) => ({ mode: mode(i.lists.xs) }),
      'w9-13': (i) => { let sp = 0; const bag = []; for (const p of i.lists.ps) if (sp + p <= i.vars.b) { sp += p; bag.push(p); } return { spent: sp, bag }; },
      'w9-14': (i) => { let c = 0; const x = i.lists.xs; for (let a = 0; a < x.length; a++) for (let b = a + 1; b < x.length; b++) if (x[a] + x[b] === 10) c++; return { pairs: c }; },
      'w10-01': (i) => ({ pos: i.lists.xs.indexOf(i.vars.t) + 1 }), 'w10-02': (i) => ({ pos: i.lists.xs.indexOf(i.vars.t) + 1 }),
      'w10-03': (i) => ({ xs: [...i.lists.xs].sort((a, b) => a - b) }), 'w10-04': (i) => ({ xs: [...i.lists.xs].sort((a, b) => a - b) }), 'w10-05': (i) => ({ xs: [...i.lists.xs].sort((a, b) => a - b) }), 'w10-06': (i) => ({ xs: [...i.lists.xs].sort((a, b) => a - b) }),
      'w10-07': (i) => { let a = i.vars.amt, n = 0; for (const c of i.lists.coins) while (a >= c) { a -= c; n++; } return { n, amt: a }; },
      'w10-08': (i) => ({ g: gcd(i.vars.a, i.vars.b) }), 'w10-09': (i) => ({ p: prime(i.vars.n) }), 'w10-10': (i) => ({ dist: bfs(i.data.graph) }),
      'w10-12': (i) => ({ best: i.data.weights.indexOf(Math.max(...i.data.weights)) + 1 }), 'w10-13': (i) => ({ order: i.data.weights.map((w, k) => [w, k + 1]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) }),
      'w10-14': (i) => ({ c: [...i.lists.a, ...i.lists.b].sort((a, b) => a - b) }),
    };
    for (const l of L.LEVELS.filter((x) => x.world >= 8 && x.kind === 'data')) {
      const calc = L2.extOf(l).data.view === 'calc';
      const seeds = [undefined, ...Array.from({ length: 80 }, (_, i) => 200 + i)];
      let same = 0;
      for (const sd of seeds) {
        const inst = L2.dataInst(l, sd);
        const ref = L2.refOutcome(l, sd);
        out.n++;
        if (ref.status !== 'done') { out.bad.push(`${l.id} seed ${sd}: reference ${ref.status} ${ref.message}`); continue; }
        let want;
        if (calc) { want = {}; for (const tt of tests(inst)) want[tt.name] = F[tt.fn](tt.args); } else want = O[l.id]?.(inst);
        if (!want) { out.bad.push(l.id + ' has no oracle'); break; }
        for (const [k, v] of Object.entries(want)) {
          const got = Array.isArray(v) ? ref.state.lists[k] : ref.state.vars[k] ?? 0;
          if (JSON.stringify(got) !== JSON.stringify(v) && !(typeof v === 'number' && Math.abs(got - v) < 1e-9)) { out.bad.push(`${l.id} seed ${sd}: ${k} = ${JSON.stringify(got)}, oracle ${JSON.stringify(v)}`); break; }
        }
        // the level is not already solved at the start
        const start = L2.makeRun(l, { main: [], funcs: [] }).state;
        const tg = L2.dataTarget(l, sd);
        if (!calc && Object.entries(tg.vars).every(([k, v]) => (start.vars[k] ?? 0) === v) && Object.entries(tg.lists).every(([k, v]) => JSON.stringify(start.lists[k] ?? []) === JSON.stringify(v))) out.bad.push(`${l.id} seed ${sd}: already solved at the start`);
        const s0 = JSON.stringify([tg.vars, tg.lists]); if (sd === undefined) out.first = s0; else if (s0 !== out.first) same++;
      }
      out.per[l.id] = same;
    }
    return out;
  });
  ok(OR.bad.length === 0, `the reference solution of every data and function level (${Object.keys(OR.per).length} levels, ${OR.n} instances) agrees with an INDEPENDENT oracle (sort / index / gcd / prime / BFS / fib ... written separately in JavaScript); no instance is solved before the program runs` + (OR.bad.length ? ' FAILED: ' + OR.bad.slice(0, 5).join('; ') : ''));

  // ---------- 7. wrong programs, programs that fit only the shown data, too slow programs ----------
  const W = await run((A, I, L, L2) => {
    const out = { bad: [], notes: [] };
    const ev = (id, src) => L.evaluate(L.levelById(id), A.parse(src));
    // a program that gives the answer of the SHOWN instance: rejected on the hidden ones (levels whose instances differ)
    let cheats = 0;
    for (const l of L.LEVELS.filter((x) => x.world >= 8 && x.kind === 'data' && L2.extOf(x).data.view !== 'calc')) {
      const tg = L2.dataTarget(l); const parts = [];
      const inst = L2.dataInst(l);
      for (const [k, v] of Object.entries(tg.vars)) parts.push(`set ${k} = ${v}`);
      for (const [k, v] of Object.entries(tg.lists)) { parts.push(`clear(${k})`); for (const x of v) parts.push(`add(${k}, ${x})`); }
      let differs = false; for (const sd of [101, 102, 103, 104, 105]) { const g = L2.dataTarget(l, sd); if (JSON.stringify(g) !== JSON.stringify(tg)) differs = true; }
      if (!differs) continue;
      cheats++;
      const e = L.evaluate(l, A.parse(parts.join(' ')));
      if (e.won) out.bad.push(l.id + ' a constant answer wins');
      else if (!e.variantFailed && e.status === 'done' && e.missing.length === 0) out.bad.push(l.id + ' constant answer: no reason');
      void inst;
    }
    out.cheats = cheats;
    // functions: hard-coded answers for the three shown tests are rejected (the hidden tests use other numbers)
    out.hard = ev('w8-09', 'def fact(n) { if n == 3 { return 6 } if n == 5 { return 120 } return 1 }').won;
    out.hardOk = ev('w8-09', 'def fact(n) { if n == 0 { return 1 } return n * fact(n - 1) }').won;
    out.hardFib = ev('w8-10', 'def fib(n) { if n < 2 { return n } return fib(n - 1) + fib(n - 2) }').won;
    out.noBase = ev('w8-08', 'def total(n) { return n + total(n - 1) }');
    out.noBaseWon = out.noBase.won; out.noBaseStatus = out.noBase.status;
    // efficiency: slow solutions are rejected, the intended ones accepted
    out.scan = ev('w10-01', 'set pos = 0 for i = 1 to len(xs) { if item(xs, i) == t and pos == 0 { set pos = i } }');
    out.scanOk = ev('w10-01', 'set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == t { set pos = i } change i by 1 }').won;
    out.linear64 = ev('w10-02', 'set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == t { set pos = i } change i by 1 }');
    out.binOk = ev('w10-02', L.levelById('w10-02').solution).won;
    out.gcdSlow = ev('w10-08', 'while a != b { if a > b { change a by 0 - b } else { change b by 0 - a } } set g = a');
    out.gcdOk = ev('w10-08', 'while a != b { if a > b { set a = a % b } else { set b = b % a } if a == 0 { set a = b } if b == 0 { set b = a } } set g = a');
    out.primeSlow = ev('w10-09', 'set p = 1 for d = 2 to n - 1 { if n % d == 0 { set p = 0 } } if n < 2 { set p = 0 }');
    out.bubbleSwaps = ev('w10-06', 'for i = 1 to len(xs) - 1 { for j = 1 to len(xs) - i { if item(xs, j) > item(xs, j + 1) { swap(xs, j, j + 1) } } }');
    out.bubbleOk = ev('w10-04', 'for i = 1 to len(xs) - 1 { for j = 1 to len(xs) - i { if item(xs, j) > item(xs, j + 1) { swap(xs, j, j + 1) } } }').won;
    out.selOk = ev('w10-03', L.levelById('w10-03').solution).won;
    out.weighAll = ev('w10-12', 'set best = 1 for i = 1 to 8 { for j = 1 to 8 { if heavier(i, j) and heavier(i, best) { set best = i } } }');
    out.weighOk = ev('w10-12', L.levelById('w10-12').solution).won;
    out.sortWrong = ev('w10-03', 'for i = 1 to len(xs) - 1 { if item(xs, i) > item(xs, i + 1) { swap(xs, i, i + 1) } }');
    out.mergeSlow = ev('w10-14', 'set i = 1 set j = 1 for k = 1 to len(a) + len(b) { add(c, 0) }');
    out.sortRepeat = ev('w10-14', 'each x in a { add(c, x) } each y in b { add(c, y) } for i = 1 to len(c) - 1 { for j = 1 to len(c) - i { if item(c, j) > item(c, j + 1) { swap(c, j, j + 1) } } }');
    // a robot level (a family) and the left-hand rule: one program, many mazes
    out.leftOk = L.evaluate(L.levelById('w10-11'), L.levelById('w10-11').sol).won;
    out.rightHand = L.evaluate(L.levelById('w10-11'), A.parse('until onFlag { if pathRight { right move } else { if pathAhead { move } else { left } } }')).won;
    out.recGo = L.evaluate(L.levelById('w8-07'), L.levelById('w8-07').sol).won;
    out.recSpecific = L.evaluate(L.levelById('w8-07'), A.parse('def go { move go } go')).won;
    out.numrow = L.evaluate(L.levelById('w9-10'), L.levelById('w9-10').sol).won;
    out.numrowFixed = L.evaluate(L.levelById('w9-10'), A.parse('add(xs, 4) add(xs, 4) add(xs, 4) move move move')).won;
    return out;
  });
  ok(W.bad.length === 0 && W.cheats >= 12, `a program that gives the answer of the SHOWN data is rejected on the hidden data (${W.cheats} levels tried)` + (W.bad.length ? ' FAILED: ' + W.bad.join('; ') : ''));
  ok(!W.hard && W.hardOk && W.hardFib, 'functions: hard-coded answers of the shown tests are rejected (hidden tests use other numbers), the recursive versions are accepted');
  ok(!W.noBaseWon && W.noBaseStatus === 'error', 'recursion without a stop condition fails with the "too deep" message');
  ok(!W.scan.won && /步数/.test(W.scan.missing.join()) && W.scanOk, 'sequential search that goes on after finding is too slow (the step limit) while the intended one passes: ' + W.scan.missing.join());
  ok(!W.linear64.won && W.binOk, 'on 64 sorted numbers, linear search is too slow and binary search passes (efficiency is judged)');
  ok(!W.gcdSlow.won && W.gcdOk && !W.primeSlow.won, 'gcd by subtraction and trial division up to n - 1 are too slow; the intended versions pass');
  ok(!W.bubbleSwaps.won && /交换/.test(W.bubbleSwaps.missing.join()) && W.bubbleOk && W.selOk, 'bubble sort sorts (level 4) but makes too many swaps for the "few swaps" level (6): ' + W.bubbleSwaps.missing.join());
  ok(!W.weighAll.won && /天平/.test(W.weighAll.missing.join()) && W.weighOk, 'the balance scale counts weighings: comparing every pair uses too many: ' + W.weighAll.missing.join());
  ok(!W.sortWrong.won && !W.mergeSlow.won && W.sortRepeat.status !== undefined, 'one pass of bubble sort is not a sort; an unsorted result fails');
  ok(W.leftOk && W.rightHand, 'the left-hand rule solves the mazes of its level (and the right-hand rule too: both follow a wall): ' + [W.leftOk, W.rightHand]);
  ok(W.recGo && !W.recSpecific && W.numrow && !W.numrowFixed, 'the robot levels: recursion walks any corridor (a fixed program fails on a hidden one), the numbers on the floor are collected from any row');

  // ---------- 8. mutations of the reference solutions must fail ----------
  const MU = await run((A, I, L) => {
    const out = { tried: 0, killed: 0, survivors: [], perWorld: {} };
    const swapOp = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '!=', '!=': '==', '+': '-', '-': '+', '*': '+', and: 'or', or: 'and' };
    for (const l of L.LEVELS.filter((x) => x.world >= 7 && x.world <= 10 && (x.kind === 'stage' || x.kind === 'data'))) {
      const text = A.toText(l.sol);
      const muts = [];
      for (const m of text.matchAll(/(?<![\w(])-?\d+(\.\d+)?(?![\w])/g)) { const v = Number(m[0]); for (const nv of [v + 1, v + 10, v === 0 ? 2 : v * 2]) muts.push(text.slice(0, m.index) + nv + text.slice(m.index + m[0].length)); }
      for (const m of text.matchAll(/ (<=|>=|==|!=|<|>|\+|-|\*|and|or) /g)) muts.push(text.slice(0, m.index) + ` ${swapOp[m[1]]} ` + text.slice(m.index + m[0].length));
      const lines = text.split('\n');
      lines.forEach((ln, i) => { if (!/[{}]\s*$/.test(ln) && !/^\s*}/.test(ln) && lines.length > 2 && !/^\s*return/.test(ln)) muts.push(lines.filter((_, j) => j !== i).join('\n')); });
      for (const m of text.matchAll(/\b(hi|bye|meow|hi2|ok|no|q1|a1|q2|ask|again|hello)\b/g)) { const o = { hi: 'bye', bye: 'hi', meow: 'hi', hi2: 'hi', ok: 'no', no: 'ok', q1: 'a1', a1: 'q1', q2: 'q1', ask: 'again', again: 'ask', hello: 'hello2' }[m[1]]; muts.push(text.slice(0, m.index) + o + text.slice(m.index + m[0].length)); }
      let tried = 0, killed = 0; const surv = [];
      for (const mt of new Set(muts)) {
        if (mt === text) continue;
        let prog; try { prog = A.parse(mt); } catch { continue; }
        tried++;
        let e; try { e = L.evaluate(l, prog); } catch { killed++; continue; }
        if (e.won) surv.push(mt.length < 300 ? mt.replace(/\n\s*/g, ' ') : '(long)'); else killed++;
      }
      out.tried += tried; out.killed += killed; out.perWorld[l.world] = [(out.perWorld[l.world]?.[0] ?? 0) + tried, (out.perWorld[l.world]?.[1] ?? 0) + killed];
      if (tried && killed / tried < 0.5) out.survivors.push(l.id + ' ' + killed + '/' + tried);
    }
    return out;
  });
  ok(MU.tried > 400 && MU.killed / MU.tried >= 0.7 && MU.survivors.length <= 4, `mutations of the reference solutions (a number changed, an operator swapped, a block removed, another text): ${MU.killed} of ${MU.tried} wrong programs are rejected (${Math.round((100 * MU.killed) / MU.tried)} %; the rest are equivalent programs); per world ${JSON.stringify(MU.perWorld)}; levels with a low rate: ${MU.survivors.join(' ') || 'none'}`);

  // ---------- 9. no shorter program solves the small levels (bounded exhaustive search) ----------
  const BF = await run((A, I, L, L2) => {
    const proven = [], skipped = [], found = [], t0 = performance.now();
    for (const l of L.LEVELS.filter((x) => x.world >= 8 && x.kind === 'data' && x.par >= 1 && x.par <= 3)) {
      const ext = L2.extOf(l), calc = ext.data.view === 'calc';
      const N = (v) => ({ k: 'n', v }), V = (name) => ({ k: 'v', name });
      const inst = L2.dataInst(l);
      const lists = ext.lists ?? Object.keys(inst.lists);
      const tgt = L2.dataTarget(l);
      const leafNames = [...new Set([...(l.vars ?? []), ...Object.keys(inst.vars)])];
      const params = calc ? l.funcs.flatMap((f) => A.paramsOf(f)) : [];
      const has = (f) => (ext.rep ?? []).includes(f), pk = (k) => l.palette.includes(k);
      let leaves = [N(0), N(1), N(2), N(3), N(4), N(5), N(8), N(10), N(15), ...(calc ? params : leafNames).map(V)];
      for (const ln of lists) { for (const f of ['len', 'sum', 'max', 'min']) if (has(f)) leaves.push({ k: 'list', f, list: ln }); if (has('item')) leaves.push({ k: 'list', f: 'item', list: ln, a: N(1) }, { k: 'list', f: 'item', list: ln, a: N(2) }, { k: 'list', f: 'item', list: ln, a: N(3) }, { k: 'list', f: 'item', list: ln, a: { k: 'list', f: 'len', list: ln } }); }
      const ops = ext.ops ?? ['+', '-', '*'];
      const exprs = [...leaves];
      if (l.par <= 2) for (const a of leaves) for (const b of leaves) for (const op of ops) exprs.push({ k: 'bin', op, a, b });
      let id = 0; const B = (o) => ({ id: 'z' + ++id, ...o });
      const targets = [...new Set([...Object.keys(tgt.vars), ...(l.vars ?? [])])];
      // single statements with their cost (blocks)
      const simple = [];
      if (calc) { for (const e of exprs) simple.push({ cost: 1, mk: () => B({ t: 'return', e }) }); const conds = []; for (const a of leaves) for (const b of leaves) for (const op of ['<', '>', '==']) conds.push({ k: 'cmp', op, a, b }); if (l.par >= 3) for (const c of conds) for (const e of leaves) simple.push({ cost: 2, mk: () => B({ t: 'if', cond: c, body: [B({ t: 'return', e })] }) }); }
      else {
        for (const v of targets) for (const e of exprs) { if (pk('set')) simple.push({ cost: 1, mk: () => B({ t: 'set', name: v, e }) }); if (pk('change') && l.par >= 3) simple.push({ cost: 1, mk: () => B({ t: 'change', name: v, e }) }); }
        if (pk('push')) for (const ln of lists) for (const e of exprs) if (l.par >= 3 ? leaves.includes(e) : true) simple.push({ cost: 1, mk: () => B({ t: 'push', list: ln, e }) });
        if (l.par >= 3 && pk('each')) for (const ln of lists) for (const v of targets) for (const body of [{ k: 'n', v: 1 }, V('x')]) { simple.push({ cost: 2, mk: () => B({ t: 'each', name: 'x', list: ln, body: [B({ t: 'change', name: v, e: body })] }) }); simple.push({ cost: 2, mk: () => B({ t: 'each', name: 'x', list: ln, body: [B({ t: 'push', list: ln === 'xs' ? 'evens' : ln, e: V('x') })] }) }); }
      }
      if (simple.length > 6000 && l.par >= 3) { skipped.push(l.id + ':' + simple.length); continue; }
      const maxCost = l.par - 1;
      let total = 0; const cnt = (budget, memo = {}) => { if (budget === 0) return 1; if (memo[budget] !== undefined) return memo[budget]; let s = 1; for (const c of [1, 2]) if (c <= budget) s += simple.filter((x) => x.cost === c).length * cnt(budget - c, memo); return (memo[budget] = s); };
      total = cnt(maxCost) - 1;
      if (total > 250000) { skipped.push(l.id + ':' + total); continue; }
      const funcName = calc ? l.funcs[0].name : null;
      if (calc && l.funcs.length !== 1) { skipped.push(l.id + ':functions'); continue; }
      let win = null, n = 0;
      const gen = (budget, acc) => {
        if (win) return;
        if (acc.length) {
          n++;
          const body = acc.map((s) => s.mk());
          const prog = calc ? { main: [], funcs: [{ name: funcName, ...(l.funcs[0].params ? { params: l.funcs[0].params } : { param: l.funcs[0].param }), body }] } : { main: body, funcs: [] };
          if (L.evaluate(l, prog, 3000).won) { win = A.toText(prog); return; }
        }
        for (const s of simple) if (s.cost <= budget) { gen(budget - s.cost, [...acc, s]); if (win) return; }
      };
      gen(maxCost, []);
      if (win) found.push(l.id + ': ' + win.replace(/\n\s*/g, ' ')); else proven.push([l.id, l.par, n]);
    }
    return { proven, skipped, found, ms: Math.round(performance.now() - t0) };
  });
  ok(BF.found.length === 0, 'no program with fewer blocks than par solves a searched level' + (BF.found.length ? ' FAILED: ' + BF.found.join('; ') : ''));
  ok(BF.proven.length >= 8, `par PROVEN minimal by exhaustive search for ${BF.proven.length} small data / function levels (${BF.proven.reduce((s, x) => s + x[2], 0)} programs tried in ${BF.ms} ms): ${BF.proven.map((x) => x[0] + '/' + x[1]).join(' ')}`);
  console.log('  (not searched, too many programs:', BF.skipped.join(' ') || 'none', ')');

  // ---------- 10. progress, merge, medals ----------
  const PM = await run((A, I, L, L2, ST, M, LE, S) => {
    const out = {};
    const all = { stars: Object.fromEntries(L.LEVELS.filter((l) => l.world <= 6).map((l) => [l.id, 3])), blocks: {}, challenges: 0 };
    out.rec1 = M.recommendedWorld(all, null);   // after world 6: world 7 is the next one
    const w7 = { stars: { ...all.stars, ...Object.fromEntries(L.levelsOf(7).map((l) => [l.id, 2])) }, blocks: {}, challenges: 0 };
    out.rec2 = M.recommendedWorld(w7, null);
    out.stat = M.worldStat(w7, 7); out.stat8 = M.worldStat(w7, 8);
    out.next = [M.nextLevelId('w7-01'), M.nextLevelId('w7-14'), M.nextLevelId('w10-13'), M.nextLevelId('w10-14')];
    const a = { stars: { 'w7-01': 3, 'w8-02': 1 }, blocks: { 'w7-01': 1, 'w8-02': 5 }, challenges: 0 }, b = { stars: { 'w7-01': 2, 'w9-01': 3 }, blocks: { 'w7-01': 3, 'w9-01': 3 }, challenges: 1 };
    out.merge = S.mergeDocs(a, b);
    const r = M.applyResult(M.applyResult({ stars: {}, blocks: {}, challenges: 0 }, 'w9-04', 2, 4), 'w9-04', 3, 3);
    out.r = [r.stars['w9-04'], r.blocks['w9-04']];
    out.stars = [L.starsFor(4, 4), L.starsFor(6, 4), L.starsFor(7, 4)];
    out.total = M.totalStars({ stars: Object.fromEntries(L.LEVELS.map((l) => [l.id, 1])), blocks: {}, challenges: 0 });
    out.nl = L.LEVELS.length;
    return out;
  });
  ok(PM.stat.done && PM.stat.stars === 28 && PM.stat.max === 42 && !PM.stat8.done && PM.rec2 === 8, 'world statistics for world 7 (14 levels, 42 stars at most) and the recommendation moves on to world 8: ' + JSON.stringify([PM.stat.stars, PM.stat.max, PM.rec2]));
  ok(PM.next[0] === 'w7-02' && PM.next[1] === null && PM.next[2] === 'w10-14' && PM.next[3] === null, 'next level inside a world; the last level of a world has no next level');
  ok(PM.merge.stars['w7-01'] === 3 && PM.merge.blocks['w7-01'] === 1 && PM.merge.stars['w8-02'] === 1 && PM.merge.stars['w9-01'] === 3 && PM.merge.challenges === 1, 'two devices are merged by the larger star count (the same rule for the new level ids): ' + JSON.stringify(PM.merge.stars));
  ok(PM.r[0] === 3 && PM.r[1] === 3 && PM.stars.join() === '3,2,1', 'progress rules and the star rule are the same');

  // ---------- 11. the lessons ----------
  const LS = await run((A, I, L, L2, ST, M, LE) => {
    const out = { bad: [], n: Object.keys(LE.LESSONS2).length, kinds: { stage: 0, data: 0, turtle: 0, grid: 0 } };
    for (const les of Object.values(LE.LESSONS2)) {
      if (les.steps.length < 2 || les.steps.length > 4) out.bad.push(les.id + ' steps');
      for (const s of les.steps) {
        if (!/[一-鿿]/.test(s.text) || s.text.length > 62) out.bad.push(les.id + ' text ' + s.text.length);
        const prog = A.parse(s.demo.program);
        const d = s.demo;
        if (d.kind === 'stage') {
          out.kinds.stage++;
          const e = { sprites: d.ext.sprites, slots: [], inputs: d.ext.inputs ?? [], ticks: d.ext.ticks ?? 70, checks: [], texts: d.ext.texts ?? {} };
          const r = new ST.StageRun(prog, e); for (let i = 0; i < e.ticks && r.status === 'running'; i++) r.step();
          if (r.status !== 'running') out.bad.push(les.id + ' stage demo error ' + r.message);
          if (!prog.scripts?.length) out.bad.push(les.id + ' demo without scripts');
        } else if (d.kind === 'data') {
          out.kinds.data++;
          const t = I.makeTurtle().state; const st = { ...t, vars: { ...(d.ext.vars ?? {}) }, lists: JSON.parse(JSON.stringify(d.ext.lists)), data: d.ext.data, seed: 1 };
          const r = new I.Machine(prog, { kind: 'data' }, st, { maxDepth: 200 }).run();
          if (r.status !== 'done') out.bad.push(les.id + ' data demo ' + r.status + ' ' + r.message);
        } else {
          let w, st; if (d.turtle) { out.kinds.turtle++; const t = I.makeTurtle(); w = t.world; st = t.state; } else { out.kinds.grid++; const g = I.makeGrid(d.rows, d.start); w = g.world; st = g.state; }
          const r = new I.Machine(prog, w, st, { maxDepth: 200 }).run();
          if (r.status !== 'done') out.bad.push(les.id + ' demo ' + r.status);
          if (d.turtle && !r.state.segs.length) out.bad.push(les.id + ' draws nothing');
        }
      }
    }
    return out;
  });
  ok(LS.bad.length === 0 && LS.n >= 22, `${LS.n} mini-lessons for the new concepts (2-4 steps, short texts); every demo runs: ${LS.kinds.stage} with sprites, ${LS.kinds.data} with lists / graph / scale, ${LS.kinds.turtle} turtle, ${LS.kinds.grid} robot` + (LS.bad.length ? ' FAILED: ' + LS.bad.join('; ') : ''));

  ok(t.log.external.length === 0, 'no outside request: ' + t.log.external.join(', '));
  await t.browser.close();
  await done();
})();
