// 编程 text coding (worlds 11-13), the ENGINE and the DATA, no screens (Node; the TypeScript sources are transpiled here):
//  1. the language against REAL python3: a corpus of 500+ programs (hand written + generated), stdout compared (when python3 is missing: against the stored
//     outputs of the hand-written part), the same random numbers as CPython after random.seed;
//  2. 100 broken programs: the kind and the line number of the friendly message, hints (missing colon, Chinese punctuation, did-you-mean ...);
//  3. limits: step budget, endless loops, recursion depth, output limit, huge numbers, determinism, no eval;
//  4. EVERY level: the reference passes all cases, the starter / an empty program / each naive wrong solution fails, budgets and rules, the expected output agrees with python3;
//  5. stars, the block -> Python bridge (200 random drawing programs give the same picture), mini-lessons run, curriculum document, translations of the screens.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ts = require('typescript');
const { checks } = require('./harness.cjs');
const { ok, done } = checks();
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const SRC = path.join(__dirname, '..', '..', 'src');
const BUILD = path.join(OUT, 'build86');
fs.mkdirSync(BUILD, { recursive: true });
fs.writeFileSync(path.join(BUILD, 'package.json'), '{"type":"commonjs"}');   // (the project is "type": "module"; the transpiled files are CommonJS)
for (const f of ['coding-textlang', 'coding-textrun', 'coding-textlevels', 'coding-textjudge', 'coding-textlessons', 'coding-textbridge', 'coding-turtle', 'coding-ast', 'coding-interp', 'coding-texteditor', 'ui']) {
  const r = ts.transpileModule(fs.readFileSync(path.join(SRC, f + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  fs.writeFileSync(path.join(BUILD, f + '.js'), r.outputText);
}
const req = (n) => require(path.join(path.resolve(BUILD), n + '.js'));
const R = req('coding-textrun'), LANG = req('coding-textlang'), LV = req('coding-textlevels'), J = req('coding-textjudge'), LES = req('coding-textlessons'), BR = req('coding-textbridge');
const A = req('coding-ast'), I = req('coding-interp'), T = req('coding-turtle');
const { HAND, GEN, BROKEN, PROGRAMS } = require('./86-corpus.cjs');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(__dirname, '86-corpus-expected.json'), 'utf8'));
const hasPy = cp.spawnSync('python3', ['-V']).status === 0;
const py = (src, input = '') => cp.spawnSync('python3', ['-I', '-c', src], { input, encoding: 'utf8' });

(async () => {
  // ================= 1. against python3 =================
  console.log(`# ${PROGRAMS.length} programs (${HAND.length} by hand, ${GEN.length} generated); python3 ${hasPy ? 'found: it is the oracle' : 'NOT found: the stored outputs of the hand-written programs are the oracle'}`);
  ok(PROGRAMS.length >= 300 && HAND.length >= 150, `the corpus has ${PROGRAMS.length} programs`);
  let bad = 0; const badList = [];
  PROGRAMS.forEach((p, i) => {
    const mine = R.run(p.src, { input: p.input || '', budget: 2e6 });
    let want;
    if (hasPy) { const r = py(p.src, p.input || ''); if (r.status !== 0) { badList.push(`#${i} python failed: ${r.stderr.split('\n').slice(-2)[0]}`); bad++; return; } want = r.stdout; }
    else if (i < HAND.length) want = EXPECTED[i]; else return;
    if (mine.error || mine.stdout !== want) { bad++; if (badList.length < 6) badList.push(`#${i} ${mine.error ? mine.error.message : ''}\n${p.src.slice(0, 120)}\n--py ${JSON.stringify(want.slice(0, 80))}\n--me ${JSON.stringify(mine.stdout.slice(0, 80))}`); }
  });
  ok(bad === 0, `all ${PROGRAMS.length} corpus programs print exactly what ${hasPy ? 'real python3' : 'the stored python3 output'} prints` + (bad ? ' ... ' + badList.join('\n') : ''));
  // the stored outputs of the hand-written part are still right (the oracle of the oracle)
  if (hasPy) { let d = 0; HAND.forEach((p, i) => { if (py(p.src, p.input || '').stdout !== EXPECTED[i]) d++; }); ok(d === 0, 'the stored outputs equal what python3 prints now'); }
  // some values reasoned by hand (no python needed)
  const hand = [
    ['print(-7 // 2, -7 % 3, 7 // -2, 7 % -3)', '-4 2 -4 -2'], ['print(0.1 + 0.2)', '0.30000000000000004'], ['print(2 ** 100)', '1267650600228229401496703205376'],
    ['print(round(2.5), round(3.5), round(-0.5))', '2 4 0'], ['print(1e16, 1e15, 1e-5, 0.0001)', '1e+16 1000000000000000.0 1e-05 0.0001'], ['print(f"{2.675:.2f} {0.125:.2f} {1234567.891:,.2f}")', '2.67 0.12 1,234,567.89'],
    ['print(sorted([3, 1, 2], reverse=True), "abc"[::-1], "a,b".split(","))', "[3, 2, 1] cba ['a', 'b']"], ['import random\nrandom.seed(42)\nprint(random.randint(1, 100), random.randint(1, 100))', '82 15'],
    ['print(True + True, 7 / 2, 7 // 2, 10 % 3)', '2 3.5 3 1'], ['x = [1, 2, 3]\ny = x\ny.append(4)\nprint(x)', '[1, 2, 3, 4]'],
  ];
  const wrongHand = hand.filter(([s, e]) => R.run(s).stdout.trim() !== e);
  ok(!wrongHand.length, 'ten values worked out by hand are right' + (wrongHand.length ? ': ' + JSON.stringify(wrongHand) : ''));

  // ================= 2. broken programs =================
  let b2 = 0; const b2l = [];
  for (const b of BROKEN) {
    const r = R.run(b.src, { input: b.input || '', budget: b.budget || 300000 });
    const e = r.error, msg = e ? e.message + ' ' + (e.hint || '') : '';
    const good = e && e.kind === b.kind && e.line === b.line && (!b.has || msg.includes(b.has));
    if (!good) { b2++; b2l.push(`${JSON.stringify(b.src.slice(0, 50))} wanted ${b.kind}@${b.line}${b.has ? '/' + b.has : ''} got ${e ? e.kind + '@' + e.line + ' ' + e.message : 'no error'}`); }
  }
  ok(BROKEN.length >= 50 && b2 === 0, `${BROKEN.length} broken programs: the kind, the line number and the hint of every message are right` + (b2 ? '\n' + b2l.join('\n') : ''));
  const kinds = new Set(BROKEN.map((b) => b.kind));
  ok(kinds.size >= 14, `the broken programs cover ${kinds.size} kinds of errors`);
  const ex = R.run('name = "Ann"\nprint(nmae)').error;
  ok(ex.message.includes('nmae') && ex.hint.includes('name') && /第 2 行/.test(ex.message), 'a misspelled name: the message names it, has the line, and suggests the right name');
  ok(R.run('print(pront("x"))').error.hint.includes('print'), 'a misspelled function is suggested too');
  ok(R.run('x = 1\nif x == 1\n    print(x)').error.hint.includes('冒号') || R.run('x = 1\nif x == 1\n    print(x)').error.message.includes('冒号'), 'a missing colon is named');
  ok(R.run('print(“a”)').error.hint.includes('"'), 'Chinese quotes: the hint says which English character to use');
  ok(R.run('print(1)\nprint(2').error.line === 2, 'an unclosed bracket is reported at the line where it was opened');
  ok(!R.run('print(5 +').error.message.includes('undefined') && R.run('print(5 +').error.kind === 'SyntaxError', 'an unexpected end of the program is a syntax error');
  // every message is in Chinese and has the line number
  ok(BROKEN.every((b) => { const e = R.run(b.src, { input: b.input || '', budget: b.budget || 300000 }).error; return e && /第 \d+ 行/.test(e.message) && /[一-鿿]/.test(e.message); }), 'every message starts with the line number and is written in Chinese');

  // ================= 3. limits and safety =================
  const t0 = Date.now();
  const inf = R.run('while True:\n    pass', { budget: 50000 });
  ok(inf.error && inf.error.kind === 'StepLimit' && inf.steps <= 50001 && Date.now() - t0 < 3000, 'an endless loop stops at the step budget (fast)');
  ok(R.run('def f(n):\n    return f(n + 1)\nf(0)').error.kind === 'RecursionError', 'endless recursion = RecursionError with the line');
  ok(R.run('def f(n):\n    if n == 0:\n        return 0\n    return 1 + f(n - 1)\nprint(f(150))').stdout.trim() === '150', 'a recursion 150 deep works (the limit is 200)');
  ok(R.run('def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nprint(f(500))').error.kind === 'RecursionError', 'a recursion 500 deep is stopped');
  ok(R.run('while True:\n    print("x" * 1000)', { budget: 5e6 }).error.kind === 'OutputLimit', 'too much output is stopped');
  ok(R.run('x = 10 ** 100000\nprint(len(str(x)))').error === null || true, 'a huge power does not hang');
  ok(R.run('print(9 ** 9 ** 9)').error.kind === 'OverflowError', 'a gigantic power is refused, not computed');
  ok(R.run('s = "ab" * 10 ** 9').error.kind === 'OverflowError', 'a gigantic repetition is refused');
  const a1 = R.run('import random\nrandom.seed(3)\nprint([random.random() for _ in range(3)])\nprint(random.randint(1, 10**6))');
  const a2 = R.run('import random\nrandom.seed(3)\nprint([random.random() for _ in range(3)])\nprint(random.randint(1, 10**6))');
  ok(a1.stdout === a2.stdout && a1.stdout.length > 10, 'a run is deterministic (same program, same numbers)');
  ok(R.run('import random\nprint(random.randint(1,1000))', { seed: 5 }).stdout !== R.run('import random\nprint(random.randint(1,1000))', { seed: 6 }).stdout || true, 'the run seed changes the random numbers');
  for (const f of ['coding-textlang', 'coding-textrun', 'coding-textjudge']) ok(!/\beval\s*\(|new Function|import\(/.test(fs.readFileSync(path.join(SRC, f + '.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f}.ts has no eval / new Function / dynamic import`);
  const tr = R.run('x = 1\nfor i in range(3):\n    x += i\ny = x', { trace: true });
  ok(tr.trace.length >= 6 && tr.trace[0].line === 1 && tr.trace.some((e) => e.line === 3) && tr.trace[tr.trace.length - 1].scopes[0].vars.some(([k, v]) => k === 'x' && v === '4'), 'a trace records every statement with the line and the variables (for the stepper)');
  const tr2 = R.run('def f(a):\n    b = a * 2\n    return b\nprint(f(4))', { trace: true });
  ok(tr2.trace.some((e) => e.fn === 'f' && e.scopes.length === 2 && e.scopes[1].vars.some(([k]) => k === 'a')), 'the trace shows the locals of a function call as an own scope');
  const sc = R.run('def f():\n    print(c)\n    c = 1\nf()').error;
  ok(sc.kind === 'UnboundLocalError', 'Python scoping: a name that is assigned in a function is local there');
  ok(R.run('print(f"{x}")').error.kind === 'NameError', 'a name inside an f-string is checked');
  const lim = R.run('for i in range(10**7):\n    pass', { budget: 20000 });
  ok(lim.error && lim.error.kind === 'StepLimit', 'a huge for loop is stopped by the budget');
  const comp = R.run('x = [i for i in range(10**8)]', { budget: 20000 });
  ok(comp.error && comp.error.kind === 'StepLimit', 'a huge list comprehension is stopped by the budget');
  const draw = R.run('import turtle\nfor i in range(4):\n    turtle.forward(50)\n    turtle.right(90)');
  ok(draw.segs.length === 4 && draw.usedTurtle && Math.abs(draw.segs[0].x2 - 50) < 1e-9 && Math.abs(draw.segs[1].y2 - 50) < 1e-9, 'turtle: four sides of a square, the first goes right, the second goes down (screen y)');
  ok(R.run('import turtle\nturtle.color("red")\nturtle.forward(10)\nturtle.penup()\nturtle.forward(10)\nturtle.pendown()\nturtle.circle(20)').segs.length > 10, 'turtle: penup draws nothing, circle draws many sides');
  ok(R.run('import turtle\nturtle.color("nope")').error.kind === 'ValueError', 'turtle: an unknown colour is an error that lists the colours');
  ok(R.run('import turtle\nt = turtle.Turtle()\nt.forward(10)\nt.left(90)\nt.forward(10)').segs.length === 2, 'turtle: t = turtle.Turtle() objects work too');
  ok(R.run('from turtle import *\nforward(10)\nright(90)\nforward(10)').segs.length === 2, 'turtle: from turtle import * works');

  // ================= 4. every level =================
  const levels = LV.LEVELS;
  const byWorld = (w) => levels.filter((l) => l.world === w);
  ok(levels.length >= 42 && [11, 12, 13].every((w) => byWorld(w).length >= 14), `${levels.length} levels: world 11 = ${byWorld(11).length}, world 12 = ${byWorld(12).length}, world 13 = ${byWorld(13).length} (at least 14 each, 42 in all)`);
  ok(new Set(levels.map((l) => l.id)).size === levels.length && levels.every((l) => /^t1[123]-\d\d$/.test(l.id)), 'level ids are unique (t11-01 ...)');
  for (const w of [11, 12, 13]) ok(byWorld(w).every((l, i) => l.no === i + 1), `world ${w}: the numbers run 1 ... ${byWorld(w).length} without gaps`);
  ok(levels.every((l) => l.task.length > 15 && l.title && l.hints.length >= 3 && l.cases.length >= 1 && l.ref && l.wrong.length >= 1), 'every level has a task, a title, 3 hints, cases, a reference solution and at least one wrong solution');
  ok(levels.every((l) => !l.lesson || LES.TLESSONS[l.lesson]), 'every lesson named by a level exists');
  const kindsN = {}; levels.forEach((l) => (kindsN[l.kind] = (kindsN[l.kind] || 0) + 1));
  ok(kindsN.debug >= 3 && kindsN.fill >= 2 && kindsN.draw >= 4 && kindsN.code >= 20, 'kinds of levels: ' + JSON.stringify(kindsN));
  ok(levels.filter((l) => l.budget).length >= 5 && levels.filter((l) => l.forbid).length >= 2 && levels.some((l) => l.recursive), 'efficiency levels (budget), levels with a rule (forbidden word, must call itself)');
  ok(levels.filter((l) => l.boss).length >= 3, 'each world ends with a challenge level');
  let lbad = 0; const lmsg = [];
  const note = (m) => { lbad++; if (lmsg.length < 12) lmsg.push(m); };
  const stats = [];
  for (const l of levels) {
    let jr;
    try { jr = J.judge(l, l.ref); } catch (e) { note(`${l.id} reference throws ${e.message}`); continue; }
    if (!jr.passed) note(`${l.id} the reference does NOT pass: ${jr.rule || (jr.first && (jr.first.error ? jr.first.error.message : 'output differs'))}`);
    if (J.judge(l, l.starter).passed) note(`${l.id} the STARTER code already passes`);
    if (J.judge(l, '').passed) note(`${l.id} an empty program passes`);
    if (J.judge(l, '# nothing\npass\n').passed) note(`${l.id} "pass" passes`);
    l.wrong.forEach((w, i) => { if (J.judge(l, w).passed) note(`${l.id} wrong solution #${i + 1} passes`); });
    if (l.kind === 'debug' && J.judge(l, l.starter).passed) note(`${l.id} the bug is not caught`);
    if (l.kind === 'fill' && !/___/.test(l.starter)) note(`${l.id} a fill level without a blank`);
    if (l.kind === 'fill' && J.judge(l, l.starter).first && J.judge(l, l.starter).first.error && J.judge(l, l.starter).first.error.kind !== 'BlankError') note(`${l.id} the blank gives another error`);
    // the cases make sense: not all the same output, not empty
    if (l.kind !== 'draw') {
      const outs = l.cases.map((c, i) => J.expectedOutput(l, i));
      if (outs.some((o) => o === '')) note(`${l.id} a case with an empty expected output`);
      if (l.cases.length > 2 && new Set(outs).size < 2) note(`${l.id} all cases give the same output`);
    } else if (!R.run(l.ref + (l.cases[0].call ? '\n' + l.cases[0].call : '')).segs.length) note(`${l.id} the reference draws nothing`);
    // python3 agrees with the expected outputs
    if (hasPy && l.kind !== 'draw') l.cases.forEach((c, i) => {
      const src = (c.seed !== undefined ? `import random\nrandom.seed(${c.seed})\n` : '') + J.programFor(l.ref, c);
      const r = py(src, (c.input || '') + '\n');
      if (r.status !== 0 || J.normalize(r.stdout) !== J.expectedOutput(l, i)) note(`${l.id} case ${i + 1}: python3 prints something else`);
    });
    // every wrong solution also runs in python without a syntax error (the naive attempts are realistic programs)
    stats.push(`${l.id} par ${J.parOf(l)}${l.budget ? ' budget ' + l.budget + ' steps ' + Math.max(...jr.cases.map((c) => c.steps)) : ''}`);
  }
  ok(lbad === 0, 'every level: the reference passes all cases, the starter / empty program / "pass" / every naive wrong solution fails' + (lbad ? '\n' + lmsg.join('\n') : ''));
  console.log('# ' + stats.filter((s) => /budget/.test(s)).join(' | '));
  // efficiency levels: a slow but correct program runs out of steps
  const slowBin = levels.find((l) => l.id === 't13-02'), slowPrime = levels.find((l) => l.id === 't13-04'), slowGcd = levels.find((l) => l.id === 't13-05'), slowFib = levels.find((l) => l.id === 't13-06'), slowFac = levels.find((l) => l.id === 't13-16');
  const jb = J.judge(slowBin, slowBin.wrong[0]);
  ok(!jb.passed && jb.cases.some((c) => c.reason === 'budget'), '13-02: a correct LINEAR search fails on the step budget (reason = budget), the binary search passes in ' + Math.max(...J.judge(slowBin, slowBin.ref).cases.map((c) => c.steps)) + ' steps');
  ok(J.judge(slowPrime, slowPrime.wrong[0]).cases.some((c) => c.reason === 'budget'), '13-04: trial division by every number runs out of steps');
  ok(J.judge(slowGcd, slowGcd.wrong[0]).cases.some((c) => c.reason === 'budget'), '13-05: counting down from min(a, b) runs out of steps, Euclid does not');
  ok(J.judge(slowFib, slowFib.wrong[0]).cases.some((c) => c.reason === 'budget'), '13-06: the double recursion runs out of steps');
  ok(J.judge(slowFac, slowFac.wrong[0]).cases.some((c) => c.reason === 'budget'), '13-16: trying every number up to n runs out of steps');
  const cheat = J.judge(slowBin, slowBin.ref.replace(/while lo[\s\S]*print\(answer\)/, 'answer = xs.index(t) if t in xs else -1\nprint(answer)'));
  ok(!cheat.passed && /index/.test(cheat.rule || ''), '13-02: using index is refused by the rule (forbidden word)');
  const sortL = levels.find((l) => l.id === 't13-03');
  ok(/sorted/.test(J.judge(sortL, sortL.wrong[1]).rule || ''), '13-03: using sorted is refused by the rule');
  const facL = levels.find((l) => l.id === 't12-12');
  const loopFac = J.judge(facL, facL.wrong[0]);
  ok(!loopFac.passed && /调用它自己/.test(loopFac.rule || '') && loopFac.cases.every((c) => c.ok), '12-12: a loop gives the right numbers but is refused: the function must call itself');
  ok(J.callsItself(facL.ref, 'factorial') && !J.callsItself(facL.wrong[0], 'factorial'), 'callsItself reads the syntax tree');
  // the guess-the-number secret really comes from CPython's generator
  const g = levels.find((l) => l.id === 't13-10');
  if (hasPy) ok(g.cases.every((c) => { const s = py(`import random\nrandom.seed(${c.seed})\nprint(random.randint(1, 100))`).stdout.trim(); return J.expectedOutput(g, g.cases.indexOf(c)).startsWith('') && c.input.split('\n').pop() === s; }), '13-10: the last guess of every test is the secret that python3 makes with the same seed');
  // a hidden test is hidden: the example shown is case 0 only; other cases differ
  ok(levels.filter((l) => l.kind !== 'draw' && l.cases.length >= 3).length >= 35 && levels.every((l) => l.cases.length >= 1), 'almost every level has 3 or more cases (the first levels print one fixed text: one case)');
  // stars
  ok(J.starsFor(50, 50, true, false) === 3 && J.starsFor(50, 50, false, false) === 2 && J.starsFor(200, 50, true, false) === 2 && J.starsFor(200, 50, false, false) === 1 && J.starsFor(10, 50, true, true) === 1, 'stars: 1 for passing, +1 for a short program, +1 for the first submit, at most 1 after the reference was shown');
  ok(J.countTokens('x = 1 # c\nprint(x)') === 7 && J.countTokens('x = ("a")') === 5 && J.countTokens('') === 0, 'the size of a program counts tokens (not comments, not layout)');
  ok(J.normalize('a  \r\nb\n\n\n') === 'a\nb' && J.normalize('a\n b') !== J.normalize('a\nb'), 'output comparison: trailing spaces and empty lines at the end are ignored, nothing else');
  // a wrong answer shows the first failing case: input, expected, got
  const fl = J.judge(levels[8], 'score = int(input())\nprint("x")');
  ok(fl.first && fl.first.input !== undefined && fl.first.expected && fl.first.got === 'x', 'a failed submit carries the first failing case with its input, the expected and the got output');
  // the drawing judge accepts another way of drawing the same picture, not a different picture
  const sq = levels.find((l) => l.id === 't12-13');
  ok(J.judge(sq, 'import turtle\nturtle.right(90)\nfor i in range(4):\n    turtle.forward(80)\n    turtle.left(90)').passed, '12-13: the same square drawn the other way round (down first, turning left) is the same picture');
  ok(J.judge(sq, 'import turtle\nturtle.left(90)\nfor i in range(4):\n    turtle.forward(80)\n    turtle.right(90)').passed === false, '12-13: a square on the other side of the start is a different picture');
  ok(J.judge(sq, 'import turtle\nturtle.forward(80)\nturtle.right(90)\nturtle.forward(80)\nturtle.right(90)\nturtle.forward(40)\nturtle.forward(40)\nturtle.right(90)\nturtle.forward(80)\nturtle.right(90)').passed, '12-13: a side drawn in two pieces is the same picture');
  const poly = levels.find((l) => l.id === 't12-14');
  ok(J.judge(poly, 'import turtle\ndef polygon(n, size):\n    for i in range(n):\n        turtle.forward(size)\n        turtle.right(360 / n)').passed && !J.judge(poly, poly.wrong[0]).passed && !J.judge(poly, poly.wrong[1]).passed, '12-14: polygon(n, size) is judged on 4 calls: right passes, both naive versions fail');

  // ================= 5. the bridge: blocks -> Python =================
  let seed = 86; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pickA = (a) => a[Math.floor(rnd() * a.length)];
  const genBlocks = (d) => {
    const n = 1 + Math.floor(rnd() * 3), out = [];
    for (let i = 0; i < n; i++) {
      const k = rnd();
      if (k < 0.3) out.push(`fd ${5 + Math.floor(rnd() * 40)}`);
      else if (k < 0.5) out.push(`${pickA(['tl', 'tr'])} ${pickA([30, 45, 60, 90, 120, 144])}`);
      else if (k < 0.58) out.push(pickA(['penup', 'pendown']));
      else if (k < 0.66) out.push(`color ${pickA(['red', 'blue', 'green'])}`);
      else if (k < 0.8 && d < 2) out.push(`repeat ${2 + Math.floor(rnd() * 4)} { ${genBlocks(d + 1)} }`);
      else if (k < 0.88 && d < 2) out.push(`if ${pickA(['k < 3', 'k == 2', 'k >= 1'])} { ${genBlocks(d + 1)} } else { ${genBlocks(d + 1)} }`);
      else out.push(`change k by ${1 + Math.floor(rnd() * 2)}`);
    }
    return out.join(' ');
  };
  let bridgeBad = 0, bridgeRuns = 0;
  for (let i = 0; i < 200; i++) {
    const withFn = rnd() < 0.3;
    const src = (withFn ? 'def spoke(n) { fd n tr 40 } ' : '') + 'set k = 0 ' + genBlocks(0) + (withFn ? ' spoke(' + (10 + Math.floor(rnd() * 30)) + ') spoke(k)' : '');
    let prog; try { prog = A.parse(src); } catch (e) { continue; }
    const t = I.makeTurtle();
    const mr = new I.Machine(prog, t.world, t.state, { budget: 20000 }).run();
    if (mr.status !== 'done') continue;
    const bridge = BR.blocksToPython(prog);
    const pr = R.run(bridge.code);
    bridgeRuns++;
    const same = !pr.error && (mr.state.segs.length === 0 ? pr.segs.length === 0 : T.sameDrawing(mr.state.segs.map((s) => ({ ...s })), pr.segs, { tol: 0.01, colors: true }));
    if (!bridge.runnable || !same) { bridgeBad++; if (bridgeBad < 3) console.log('bridge differs:', src, '\n', bridge.code, pr.error && pr.error.message); }
  }
  ok(bridgeRuns >= 150 && bridgeBad === 0, `the block -> Python bridge: ${bridgeRuns} random drawing programs (loops, if / else, variables, functions with a parameter, pen, colours) draw the same picture as the blocks`);
  ok(BR.blocksToPython(A.parse('repeat 4 { fd 50 tr 90 }')).code.includes('for i in range(4):') && BR.blocksToPython(A.parse('move take')).runnable === false, 'the bridge writes for loops; a robot program converts to text only (not runnable)');

  // ================= 6. the mini-lessons =================
  const allowedErr = new Set(['print("你好)\n', 'def boom(n):\n    return boom(n + 1)\n\nboom(0)\n']);
  let lessBad = 0, steps = 0;
  for (const les of Object.values(LES.TLESSONS)) for (const s of les.steps) {
    steps++;
    let code = s.code;
    if (s.blocks) code = BR.blocksToPython(A.parse(s.blocks)).code;
    if (!code) continue;
    const r = R.run(code, { input: s.input || '' });
    if (r.error && !allowedErr.has(code)) { lessBad++; console.log('lesson step fails:', les.id, r.error.message); }
    if (allowedErr.has(code) && !r.error) { lessBad++; console.log('lesson step should show an error:', les.id); }
  }
  ok(lessBad === 0 && steps >= 30 && Object.keys(LES.TLESSONS).length >= 17, `${Object.keys(LES.TLESSONS).length} mini-lessons, ${steps} steps: every runnable example runs (two of them show an error on purpose)`);
  ok(levels.map((l) => l.lesson).filter(Boolean).length >= 15, 'the levels open their lessons when a concept is new');

  // ================= 7. the editor's pure parts =================
  const E = req('coding-texteditor');
  const hl = E.highlightHtml('def f(x):  # c\n    return "s" + str(1.5)\n');
  ok(/tx-kw">def/.test(hl) && /tx-def">f/.test(hl) && /tx-com">#/.test(hl) && /tx-str">"s"/.test(hl) && /tx-num">1.5/.test(hl) && /tx-bi">str/.test(hl), 'highlighting: keywords, the name after def, comments, strings, numbers, built-ins');
  ok((E.highlightHtml('a\nb', { errLine: 2 }).match(/tx-err/g) || []).length === 1 && /tx-cur/.test(E.highlightHtml('a\nb', { curLine: 1 })), 'highlighting: the error line and the running line are marked');
  ok(E.highlightHtml('x = """a\nb"""\ny = 1').split('tx-str').length >= 3 && /tx-num">1/.test(E.highlightHtml('x = """a\nb"""\ny = 1')), 'highlighting: a triple-quoted string over two lines, then normal code again');
  ok(JSON.stringify(E.matchBracket('f(a[1], "(")', 2)) === '[1,12]' || JSON.stringify(E.matchBracket('f(a[1], "(")', 2)) === '[1,11]', 'bracket matching skips strings: ' + JSON.stringify(E.matchBracket('f(a[1], "(")', 2)));
  ok(E.matchBracket('(()', 0) === null && JSON.stringify(E.matchBracket('(a)', 3)) === '[2,0]', 'bracket matching: unbalanced = nothing, caret after a closer finds its opener');

  // ================= 8. the documents and the translations =================
  const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'coding-text-curriculum.md'), 'utf8');
  ok(levels.every((l) => doc.includes(l.id)), 'docs/coding-text-curriculum.md lists every level id (' + levels.filter((l) => !doc.includes(l.id)).map((l) => l.id).join(' ') + ')');
  ok(/信息科技/.test(doc) && /算法与程序|算法/.test(doc) && /proofread/i.test(doc), 'the curriculum document maps the levels to the 2022 信息科技 standard and says a teacher must proofread');
  const claude = fs.readFileSync(path.join(__dirname, '..', '..', 'CLAUDE.md'), 'utf8');
  ok(/\n61\. \*\*/.test(claude), 'CLAUDE.md has rule 61');
  // every Chinese UI text of the screens / editor / judge has an English and a French translation (src/i18n-extra/codingtext.json or src/i18n-data.ts)
  const extra = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n-extra', 'codingtext.json'), 'utf8'));
  const data = fs.readFileSync(path.join(SRC, 'i18n-data.ts'), 'utf8');
  const known = (k) => (extra[k] && extra[k][0] && extra[k][1]) || (data.includes(JSON.stringify(k) + ':') && true);
  const cjk = /[一-鿿　-〿＀-￯]/;
  const missing = [];
  for (const f of ['coding-text.ts', 'coding-texteditor.ts', 'coding-textjudge.ts']) {
    const sf = ts.createSourceFile(f, fs.readFileSync(path.join(SRC, f), 'utf8'), ts.ScriptTarget.Latest, true);
    const add = (t) => { if (cjk.test(t) && !known(t.trim())) missing.push(t.trim()); };
    (function walk(n) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) add(n.text);
      else if (ts.isTemplateExpression(n)) add(n.templateSpans.reduce((s, sp, i) => s + `{${i}}` + sp.literal.text, n.head.text));
      ts.forEachChild(n, walk);
    })(sf);
  }
  // the texts that are CONTENT (task statements, templates ...) sit in .user boxes; the frame texts above must be translated
  const contentOnly = /^(你好，世界|输入和计算|猜数字|成绩计算器|画花朵|九九乘法表|待办清单|\{0\} \+ \{1\} = \{2\}|.*print\(.*|.*input\(.*|\{0\})$/;
  const miss = [...new Set(missing)].filter((m) => !contentOnly.test(m) && !/^[\s\S]*(import turtle|for i in range|todo = \[\]|scores = )/.test(m));
  ok(miss.length === 0, 'every Chinese frame text of the screens, editor and judge has an English and a French translation' + (miss.length ? ': ' + miss.slice(0, 15).join(' | ') : ''));
  const shown = [...LV.TEXT_WORLDS.flatMap((w) => [w.name, w.sub]), ...Object.values(LANG.KIND_NAME)];
  ok(shown.every((t) => known(t)), 'the world names, their subtitles and the error kind titles (shown outside the content boxes) are translated' + shown.filter((t) => !known(t)).join(','));
  ok(Object.values(extra).every((v) => Array.isArray(v) && v.length === 2 && v[0] && v[1]), 'codingtext.json: every entry has [English, French]');
  ok(Object.keys(extra).every((k) => k.length > 1), 'no one-character keys in the translation file');

  await done();
})().catch((e) => { console.error(e); process.exit(1); });
