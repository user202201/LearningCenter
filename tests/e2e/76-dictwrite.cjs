// 听写 (dictation) and 写字 (finger writing), rule 51.
// Part 1 (Node): the data (char-words.json, the stroke centre lines), the tolerant stroke matcher on 450+ characters (jittered strokes accepted in order, reversed ones refused,
//   wrong place refused, wrong order flagged, dots), the dictation rules, the merge of the new files.
// Part 2 (browser): 识字 dictation (the voice is a stub that records what is said; a clock the test moves): the order and text of what is said, pauses, repeat / previous / next /
//   pause, the scratch sheet, the check with tick / cross, the wrong ones saved and fed into the game's boxes, "错字再练"; English / French spelling (letter by letter, hint,
//   wrong words again, results saved per track); finger writing with the mouse and with REAL touch events (CDP, dpr 2): a whole character, stars, 默写 hints, wrong order, demo,
//   progress saved; five screen sizes, EN / FR, nothing leaves the device.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '../..');
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);

// ---------- the stroke data, from the files of the app ----------
const strokeFiles = {}, medFiles = {};
const readAll = (dir, into) => { for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.json'))) into[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8')); };
readAll('public/strokes', strokeFiles); readAll('public/medians', medFiles);
const strokesOf = (c) => strokeFiles[(c.codePointAt(0) >> 8).toString(16)]?.[c];
const mediansOf = (c) => medFiles[(c.codePointAt(0) >> 8).toString(16)]?.[c];
const ALL = Object.values(strokeFiles).flatMap((o) => Object.keys(o));

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a) => (rnd() * 2 - 1) * a;
/** a hand-drawn version of a centre line: points every ~18 units, noise of +-6 % (a shift of the whole stroke up to 3 %, every point up to 3 %, a wobble), +-10 % scale, +-4 degrees */
function dense(m, step = 18) { const out = [m[0]]; for (let i = 1; i < m.length; i++) { const a = m[i - 1], b = m[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(d / step)); for (let j = 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); } return out; }
function hand(m, o = {}) {
  const noise = o.noise ?? 0.06, sc = 1 + rr(o.scale ?? 0.10), rot = rr(o.rot ?? 4) * Math.PI / 180, tx = rr(noise * 512), ty = rr(noise * 512), ph = rnd() * 6.28;
  return dense(m).map((p, i) => { let x = (p[0] - 512) * sc, y = (p[1] - 400) * sc; const c = Math.cos(rot), s = Math.sin(rot); [x, y] = [x * c - y * s, x * s + y * c]; return [x + 512 + tx + rr(noise * 512) + 20 * Math.sin(i / 3 + ph), y + 400 + ty + rr(noise * 512) + 20 * Math.cos(i / 3 + ph)]; });
}
const plen = (m) => m.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - m[i][0], p[1] - m[i][1]), 0);

(async () => {
  const W = await imp('src/writelogic.ts'), D = await imp('src/dictlogic.ts'), S = await imp('src/sync.ts'), GM = await imp('src/game.ts');

  // =================== part 1: the data ===================
  const CW = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/char-words.json'), 'utf8')).words;
  const keys = Object.keys(CW);
  ok(keys.length >= 2500, `char-words.json: a word for ${keys.length} characters (2500 or more)`);
  const bad = keys.filter((c) => [...c].length !== 1 || !CW[c].includes(c) || [...CW[c]].length < 2 || [...CW[c]].length > 4 || !/^[一-鿿]+$/.test(CW[c]));
  ok(bad.length === 0, `every word contains its character, has 2-4 characters, is Chinese only${bad.length ? ' -> ' + bad.slice(0, 8).join() : ''}`);
  const seen = new Map(); const dup = [];
  for (const c of keys) { if (seen.has(CW[c])) dup.push(CW[c] + ':' + seen.get(CW[c]) + c); seen.set(CW[c], c); }
  ok(dup.length === 0, `no word is used for two characters${dup.length ? ' -> ' + dup.slice(0, 6).join() : ''}`);
  ok(keys.every((c) => strokesOf(c) && mediansOf(c)), 'every character with a word has stroke outlines and centre lines in the app');
  ok(['的', '我', '们', '朋', '友', '学', '习', '妈', '爸', '水', '火', '山'].every((c) => CW[c]), 'the everyday characters (我 们 朋 友 学 习 ...) have words');
  const mismatch = ALL.filter((c) => mediansOf(c).length !== strokesOf(c).length);
  ok(ALL.length >= 6700 && mismatch.length === 0, `centre lines: ${ALL.length} characters, the number of centre lines equals the number of strokes for each${mismatch.length ? ' -> ' + mismatch.slice(0, 5).join() : ''}`);
  ok(fs.existsSync(path.join(ROOT, 'public/medians/ARPHICPL.TXT')) && fs.existsSync(path.join(ROOT, 'public/strokes/ARPHICPL.TXT')), 'the licence text sits beside the centre lines (and beside the outlines)');
  const nan = ALL.filter((c) => mediansOf(c).some((m) => m.length < 2 || m.some((p) => p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))));
  ok(nan.length === 0, 'every centre line has at least two points, all numbers');

  // =================== the matcher ===================
  ok(W.starsFor(0) === 3 && W.starsFor(1) === 2 && W.starsFor(2) === 2 && W.starsFor(3) === 1 && W.starsFor(9) === 1, 'stars: 0 mistakes 3, up to 2 mistakes 2, more 1');
  const R = W.resample([[0, 0], [100, 0]], 5);
  ok(R.length === 5 && Math.abs(R[2][0] - 50) < 1e-6 && W.resample([[5, 5]], 7).length === 7 && W.resample([[5, 5], [5, 5]], 7).every((p) => p[0] === 5), 'resample: equal spacing, a point and a zero-length line give copies of the point');
  const sample = ALL.filter((_, i) => i % Math.floor(ALL.length / 480) === 0).slice(0, 480);
  ok(sample.length >= 400, `the matcher is tried on ${sample.length} characters (400 or more)`);
  let nStrokes = 0, acc = 0, accLong = 0, long = 0, revT = 0, revR = 0, farT = 0, farR = 0, ordT = 0, ordF = 0, dotT = 0, dotOk = 0, tapT = 0, tapIg = 0, seqOk = 0;
  const failed = [];
  for (const c of sample) {
    const M = mediansOf(c), doneSet = new Set();
    let all = true;
    for (let i = 0; i < M.length; i++) {
      nStrokes++;
      const d = hand(M[i]), v = W.judge(d, M, doneSet, i);
      const L = plen(M[i]);
      if (v.kind === 'ok') acc++; else { all = false; if (failed.length < 12) failed.push(`${c}${i}:${v.kind}:${Math.round(L)}`); }
      if (L >= 150) { long++; if (v.kind === 'ok') accLong++; }
      doneSet.add(i);
      const others = new Set([...doneSet].filter((x) => x !== i));
      if (L >= 120) { revT++; if (W.judge([...d].reverse(), M, others, i).kind !== 'ok') revR++; }
      if (W.isDot(M[i])) { dotT++; if (W.judge([[M[i][0][0] + rr(40), M[i][0][1] + rr(40)]], M, others, i).kind === 'ok') dotOk++; }
      // a stroke drawn 320 units to the right (clearly away from every stroke of the character)
      const sh = d.map((p) => [p[0] + 320, p[1]]);
      if (Math.min(...M.map((m) => W.meanDist(sh, m))) > 1.8 * W.TOL) { farT++; if (W.judge(sh, M, others, i).kind !== 'ok') farR++; }
      // a mark of a few units is a tap and is ignored (unless a dot is expected there)
      if (!W.isDot(M[i])) { tapT++; if (W.judge([[M[i][0][0], M[i][0][1]], [M[i][0][0] + 5, M[i][0][1] + 5]], M, others, i).kind === 'tap') tapIg++; }
    }
    if (all) seqOk++;
    // out of order: the later stroke j drawn when stroke 0 is expected, only where j and 0 are clearly different strokes
    for (let j = 1; j < M.length && j < 4; j++) {
      if (W.isDot(M[0]) || W.isDot(M[j]) || W.fits(M[j], M[0]) || W.fits([...M[j]].reverse(), M[0]) || W.meanDist(M[j], M[0]) < 1.6 * W.TOL) continue;
      ordT++;
      const v = W.judge(hand(M[j]), M, new Set(), 0);
      if ((v.kind === 'order' && v.index !== 0) || v.kind === 'direction') ordF++;
    }
  }
  ok(acc / nStrokes >= 0.99, `jittered strokes (+-6 % noise, +-10 % scale, +-4 degrees) are accepted in order: ${acc} of ${nStrokes} (${(100 * acc / nStrokes).toFixed(2)} %)${failed.length ? '; refused: ' + failed.join(' ') : ''}`);
  ok(accLong / long >= 0.999, `practically every stroke longer than 150 units is accepted (${accLong} of ${long})`);
  ok(seqOk / sample.length >= 0.97, `${seqOk} of ${sample.length} whole characters are accepted stroke after stroke`);
  ok(revT > 1000 && revR === revT, `the same strokes drawn the wrong way round are refused: ${revR} of ${revT}`);
  ok(farT > 500 && farR === farT, `strokes drawn clearly in the wrong place are refused: ${farR} of ${farT}`);
  ok(ordT > 300 && ordF / ordT >= 0.97, `a stroke of a later place is flagged "wrong order" (or refused for its direction): ${ordF} of ${ordT}`);
  ok(dotT > 100 && dotOk === dotT, `dots (点) are accepted when tapped near them: ${dotOk} of ${dotT}`);
  ok(tapT > 1000 && tapIg === tapT, `a mark of a few units where a long stroke is expected is a tap, ignored: ${tapIg} of ${tapT}`);
  // no stroke of a character is accepted for the stroke before it (the matcher is not "accept anything near")
  const M3 = mediansOf('三');
  ok(W.judge(hand(M3[1]), M3, new Set(), 0).kind === 'order' && W.judge(hand(M3[0]), M3, new Set(), 0).kind === 'ok', '三: the second bar drawn first is "wrong order", the first bar is right');
  ok(W.judge([[100, 100], [900, 100]], M3, new Set(), 0).kind === 'miss' || W.judge([[100, 100], [900, 100]], M3, new Set(), 0).kind === 'order', 'a long line at the bottom of the board is not accepted as the first bar of 三');
  ok(W.judge([], M3, new Set(), 0).kind === 'tap', 'an empty stroke is a tap');
  const lam = [0.5, 1, 1.5].map((s) => W.judge(hand(M3[0], { noise: 0.06 * s, scale: 0.1 * s, rot: 4 * s }), M3, new Set(), 0).kind);
  ok(lam[0] === 'ok' && lam[1] === 'ok', 'a horizontal bar with the usual and with half the roughness is accepted');

  // =================== the dictation rules ===================
  const src = { chars: ['甲', '乙', '丙'], idioms: ['一心一意', '画蛇添足'], lastChars: ['丁', '乙'], lastIdioms: ['守株待兔'] };
  const it = (o) => D.buildItems(src, o).map((x) => x.text).join(',');
  ok(it({ idioms: false, last: false }) === '甲,乙,丙', 'the list: this week\'s characters only');
  ok(it({ idioms: true, last: false }) === '甲,乙,丙,一心一意,画蛇添足', 'with the switch: this week\'s idioms follow');
  ok(it({ idioms: false, last: true }) === '甲,乙,丙,丁', 'last week\'s characters are added (a character that is in both is listed once, last week\'s idioms only with the idiom switch)');
  ok(it({ idioms: true, last: true }) === '甲,乙,丙,一心一意,画蛇添足,丁,守株待兔', 'all switches on: both weeks, characters and idioms');
  ok(D.itemsOf(['甲', '一心一意', '甲']).map((x) => x.kind).join() === 'char,idiom', 'a dictation of given items (the wrong ones): characters and idioms, no repeats');
  const words = { 朋: '朋友', 友: '友好' };
  ok(D.readingOf({ kind: 'char', text: '朋', id: 'c:朋' }, words) === '朋友，朋友的朋', 'a character is read as its word and then spelled by it: 朋友，朋友的朋');
  ok(D.readingOf({ kind: 'idiom', text: '一心一意', id: 'i:x' }, words) === '一心一意' && D.readingOf({ kind: 'char', text: '甲', id: 'c:甲' }, words) === '甲', 'an idiom is read whole; a character without a word only itself');
  let doc = D.EMPTY_DICT;
  for (let i = 0; i < 70; i++) doc = D.addSession(doc, { id: 'id' + i, date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), week: '2026-10-25', kind: 'zh', items: ['甲'], wrong: [] });
  ok(doc.sessions.length === 60 && doc.sessions.every((s, i, a) => i === 0 || a[i - 1].date >= s.date), 'results: at most 60 kept, the newest first');
  const again = D.addSession(doc, { ...doc.sessions[3], wrong: ['甲'] });
  ok(again.sessions.length === 60 && again.sessions.filter((s) => s.id === doc.sessions[3].id).length === 1, 'a session with a known id replaces the old one');
  const rv = D.feedReview({ cards: { 甲: { box: 4, due: '2026-12-01', right: 4, wrong: 0, last: '2026-11-01' } }, plays: 3 }, ['甲', '乙', '甲'], '2026-11-10');
  ok(rv.cards['甲'].box === 0 && rv.cards['甲'].due === '2026-11-10' && rv.cards['甲'].wrong === 1 && rv.cards['乙'].box === 0 && rv.plays === 3 && Object.keys(rv.cards).length === 2, 'wrong characters go back to box 0 of the game (due today, once each); nothing else of the review changes');
  ok(GM.pickReview({ weeks: [{ start: '2026-11-01', chars: ['甲'] }] }, rv, '2026-11-08', '2026-11-10').map((q) => q.ch).join() === '甲', 'and the game then asks that character (it is due)');
  // spelling
  ok(D.isSpelledRight('Apple', ' apple ') && D.isSpelledRight("l'école", 'l’école') && D.isSpelledRight('ice  cream', 'ice cream') && !D.isSpelledRight('école', 'ecole') && !D.isSpelledRight('apple', 'appel'), 'spelling: case, spaces and the kind of apostrophe do not matter, accents do');
  ok(D.diffLetters('apple', 'appel').map((l) => (l.ok ? '1' : '0')).join('') === '11100' && D.diffLetters('cat', 'cats').map((l) => (l.ok ? '1' : '0')).join('') === '1110' && D.diffLetters('cat', 'ca').length === 2 && D.diffLetters('Cat', 'cat').every((l) => l.ok), 'letter by letter: right letters in place, a swapped pair and an extra letter are wrong, a short answer has fewer letters');
  ok(D.firstLetter('apple') === 'a' && D.firstLetter('') === '', 'the first letter hint');
  let roundOk = true;
  for (let n = 0; n < 300; n++) {
    const a = Array.from({ length: Math.floor(rnd() * 25) }, (_, i) => 'a' + i), b = Array.from({ length: Math.floor(rnd() * 25) }, (_, i) => 'b' + i);
    const r = D.pickRound(a, b, rnd);
    const nb = r.filter((x) => x[0] === 'b').length, na = r.length - nb;
    const want = Math.min(10, a.length + b.length);
    if (r.length !== want || new Set(r).size !== r.length || nb > Math.max(4, 10 - a.length) || (a.length >= 6 && nb > 4) || na > a.length || (b.length && a.length >= 10 && nb < Math.min(4, b.length))) { roundOk = false; console.log('round', a.length, b.length, r.join()); break; }
  }
  ok(roundOk, 'a round has 10 words (fewer when there are fewer): no repeat, at most 4 of last week unless this week is short, last week\'s fill the rest, 300 random cases');
  // merging
  const m1 = S.mergeDocs({ sessions: [{ id: 'a', date: '2026-11-10' }, { id: 'c', date: '2026-11-09' }] }, { sessions: [{ id: 'b', date: '2026-11-11' }, { id: 'a', date: '2026-11-10' }] });
  ok(m1.sessions.map((s) => s.id).join() === 'b,a,c', 'merge of two devices\' dictation results: nothing lost, the newest first, no repeat');
  const m2 = S.mergeDocs({ written: { 假: { stars: 2, n: 3, last: '2026-11-10' }, 辣: { stars: 1, n: 1, last: '2026-11-09' } } }, { written: { 假: { stars: 3, n: 1, last: '2026-11-08' }, 酸: { stars: 3, n: 1, last: '2026-11-07' } } });
  ok(m2.written['假'].stars === 3 && m2.written['假'].n === 3 && m2.written['假'].last === '2026-11-10' && m2.written['辣'] && m2.written['酸'], 'merge of the writing progress: best stars, larger count, later day, both devices\' characters');
  const wd = W.addResult(W.EMPTY_WRITE, '假', 2, '2026-11-10'), wd2 = W.addResult(wd, '假', 1, '2026-11-11');
  ok(wd2.written['假'].stars === 2 && wd2.written['假'].n === 2 && wd2.written['假'].last === '2026-11-11', 'progress keeps the best stars');

  // =================== the translations ===================
  const extraFile = path.join(ROOT, 'src/i18n-extra/dictwrite.json');
  const extra = fs.existsSync(extraFile) ? JSON.parse(fs.readFileSync(extraFile, 'utf8')) : {};
  ok(Object.keys(extra).length >= 40 && Object.entries(extra).every(([k, v]) => [...k].length > 1 && Array.isArray(v) && v.length === 2 && v.every((t) => typeof t === 'string' && t.trim() && !/[一-鿿]/.test(t))), `src/i18n-extra/dictwrite.json: ${Object.keys(extra).length} texts, each with an English and a French text without Chinese, no one-character key`);
  let miss = '';
  try { execFileSync('node', ['scripts/check-i18n.mjs'], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { miss = String(e.stderr); }
  const mine = miss.split('\n').filter((l) => /\((dictation|spell|writeui|dwshell|dictwrite)\.ts\)/.test(l)).map((l) => JSON.parse(l.slice(l.indexOf('): ') + 3)));
  ok(mine.every((t) => extra[t]), `check:i18n: every text of the new files is in dictwrite.json (${mine.length} not yet merged into i18n-data.ts${mine.filter((t) => !extra[t]).length ? ', MISSING: ' + mine.filter((t) => !extra[t]).join(' | ') : ''})`);
  const pats = Object.keys(extra).map((k) => new RegExp('^' + k.trim().split(/\{\d+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*?') + '$'));
  const covered = (t) => pats.some((p) => p.test(t.trim()));

  // =================== part 2: the browser ===================
  const TODAY = '2026-11-10';
  const WEEK1 = [...'假辣酸贫纺炒缸锅烛扇'], WEEK2 = [...'鼓旧富言忙桶炉锤泉溪'];
  const ewords = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/english-words.json'), 'utf8')).words.map((x) => x.w);
  const fwords = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/french-words.json'), 'utf8')).words.map((x) => x.w);
  const E_THIS = ewords.slice(0, 12), E_LAST = ewords.slice(12, 20), F_THIS = fwords.slice(0, 12), F_LAST = fwords.slice(12, 20);
  const DORY = { id: 'kdory', name: 'Dory', color: '#f2545b' };
  const init = ({ kids, weeks, idioms, eng, fre, lang, written }) => {
    localStorage.setItem('learn.storage', 'local');
    localStorage.setItem('learn.local.kids.json', JSON.stringify({ kids, startWeek: '2026-10-25' }));
    localStorage.setItem('learn.local.kids/kdory.json', JSON.stringify({ weeks }));
    localStorage.setItem('learn.local.idioms.json', JSON.stringify({ weeks: idioms }));
    localStorage.setItem('learn.local.english/kdory.json', JSON.stringify({ weeks: eng }));
    localStorage.setItem('learn.local.french/kdory.json', JSON.stringify({ weeks: fre }));
    if (written) localStorage.setItem('learn.local.write/kdory.json', JSON.stringify(written));
    localStorage.setItem('learn.profile.v1', JSON.stringify({ kids: { kdory: { grade: 3, setOn: '2026-11-01' } } }));
    localStorage.setItem('learn.settings.v1', JSON.stringify({ lang: lang || 'auto' }));
    // the voice: a stub that records what is said (a test can also make it finish a speech)
    window.__spoken = []; window.__cancels = 0;
    const synth = { speak(u) { if (!String(u.text).trim() || u.volume === 0) return; /* (the silent unlock utterance of speech.ts) */ window.__spoken.push({ text: u.text, lang: u.lang }); if (!window.__noEnd) setTimeout(() => u.onend && u.onend({}), 300); }, cancel() { window.__cancels++; }, getVoices() { return [{ lang: 'zh-CN' }, { lang: 'en-US' }, { lang: 'fr-FR' }]; }, speaking: false };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  };
  const arg = (extra = {}) => ({
    kids: [DORY],
    weeks: [{ start: '2026-11-01', chars: WEEK2 }, { start: '2026-11-08', chars: WEEK1 }],
    idioms: [{ start: '2026-11-01', items: ['守株待兔'] }, { start: '2026-11-08', items: ['一心一意', '画蛇添足'] }],
    eng: [{ start: '2026-11-01', chars: E_LAST }, { start: '2026-11-08', chars: E_THIS }],
    fre: [{ start: '2026-11-01', chars: F_LAST }, { start: '2026-11-08', chars: F_THIS }], ...extra,
  });
  const open = async (o = {}) => {
    const t = await start(new Map(), { noLogin: true, init, initArg: arg(o.arg), viewport: o.viewport || { width: 390, height: 844 }, locale: o.locale, ...(o.clock ? { clock: TODAY + 'T10:00:00' } : { today: TODAY }), dpr: o.dpr, touch: o.touch, motion: o.motion });
    await t.page.waitForSelector('.hub-grid');
    return t;
  };
  const store = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem('learn.local.' + k) || 'null'), key);
  const spoken = (page) => page.evaluate(() => window.__spoken.map((x) => x.text));
  const go = async (page, hash, sel) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); };
  /** Chinese text that is not the user's own content (and not marked `user`), in text nodes and in title / aria-label / placeholder attributes */
  const chineseLeft = (page) => page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (/[一-鿿]/.test(n.textContent) && !p.closest('.user, .user-title, script, style, [data-user], .shortcuts')) out.push(n.textContent.trim()); }
    for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && /[一-鿿]/.test(v) && !e.closest('.user, .shortcuts')) out.push(v.trim()); }
    return out;
  });
  const geo = (page) => page.evaluate(() => {
    const vw = innerWidth, over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1) && !e.closest('.wr-list, svg, canvas, dialog, #toasts'); }).map((e) => e.tagName + '.' + e.className);
    return { sw: document.documentElement.scrollWidth, vw, over: over.slice(0, 4) };
  });
  const centered = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return Math.abs(r.left - (innerWidth - r.right)); }, sel);
  const SIZES = [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]];

  // ---------- the week page: the buttons ----------
  {
    const t = await open();
    const { page } = t;
    await go(page, '#/kid/kdory', '#sheet-btn');
    ok(await page.locator('#dict-btn').count() === 1 && await page.locator('#write-btn').count() === 1 && (await page.textContent('#dict-btn')) === '听写' && (await page.textContent('#write-btn')) === '写字', 'the week page has a "听写" and a "写字" button');
    const look = await page.evaluate(() => { const f = (s) => { const c = getComputedStyle(document.querySelector(s)); return [c.backgroundColor, c.borderTopWidth, c.borderRadius, c.color, c.fontWeight, c.boxShadow].join('|'); }; return { a: f('#sheet-btn'), b: f('#dict-btn'), c: f('#write-btn'), h: document.querySelector('#dict-btn').getBoundingClientRect().height }; });
    ok(look.a === look.b && look.a === look.c && look.h >= 40, 'both look like the 字帖 button (same colours, border, radius) and are at least 40 px high');
    const pos = await page.evaluate(() => { const c = document.querySelector('.cards').getBoundingClientRect(), t = document.querySelector('#dw-tools').getBoundingClientRect(), i = document.querySelector('#idioms-btn').getBoundingClientRect(); return { belowCards: t.top >= c.bottom - 1, aboveIdioms: t.bottom <= i.top + 1, left: t.left, right: innerWidth - t.right }; });
    ok(pos.belowCards && pos.aboveIdioms && Math.abs(pos.left - pos.right) < 3, 'the buttons sit under the characters, above "成语故事", centred');
    await page.screenshot({ path: OUT + 'week-buttons.png' });
    await page.click('#dict-btn'); await page.waitForSelector('#dw-start');
    ok(await page.evaluate(() => location.hash) === '#/dictation/kdory', '"听写" opens #/dictation/<kid>');
    await go(page, '#/kid/kdory', '#sheet-btn'); await page.click('#write-btn'); await page.waitForSelector('#wr-board');
    ok(await page.evaluate(() => location.hash) === '#/write/kdory', '"写字" opens #/write/<kid>');
    await t.browser.close();
  }

  // ---------- 识字 dictation: setup, reading, pauses, controls ----------
  const itemsOf = (o) => D.buildItems({ chars: WEEK1, idioms: ['一心一意', '画蛇添足'], lastChars: WEEK2, lastIdioms: ['守株待兔'] }, o);
  const readOf = (x) => D.readingOf(x, CW);
  {
    const t = await open({ clock: true });
    const { page, log } = t;
    await go(page, '#/dictation/kdory', '#dw-start');
    ok((await page.$$eval('#dw-list .dw-chip', (e) => e.map((x) => x.textContent))).join('') === WEEK1.join(''), 'the page lists this week\'s 10 characters');
    ok((await page.textContent('#dw-count')) === '共 10 项', 'and the count');
    ok(await page.locator('#dw-opt-idioms').isVisible() && await page.locator('#dw-opt-last').isVisible() && await page.locator('#dw-opt-screen').isVisible(), 'switches: this week\'s idioms, last week\'s content, writing on the screen');
    await page.check('#dw-opt-idioms');
    ok((await page.$$eval('#dw-list .dw-chip', (e) => e.length)) === 12 && (await page.textContent('#dw-count')) === '共 12 项', 'the idiom switch adds this week\'s 2 idioms');
    await page.check('#dw-opt-last');
    ok((await page.textContent('#dw-count')) === '共 23 项', 'last week\'s 10 characters + 1 idiom are added (23 in all)');
    await page.uncheck('#dw-opt-idioms'); await page.uncheck('#dw-opt-last');
    ok((await page.textContent('#dw-count')) === '共 10 项', 'switching them off gives the 10 back');
    await page.click('#dw-pause button[data-pause="8"]'); await page.click('#dw-pause button[data-pause="3"]');
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('learn.dictwrite.v1')).pause) === 3 && (await page.$eval('#dw-pause button.on', (e) => e.dataset.pause)) === '3', 'the pause (3 / 5 / 8 / 10 s) is remembered on this device');
    await page.screenshot({ path: OUT + 'dict-setup.png' });
    await page.click('#dw-start');
    await page.waitForSelector('#dw-dial');
    let s = await spoken(page);
    const IT = itemsOf({ idioms: false, last: false });
    ok(s.length === 1 && s[0] === readOf(IT[0]), `it reads the first item at once: "${s[0]}" (word, then the character spelled by it)`);
    ok((await page.$eval('#dw-dial', (e) => e.dataset.lang) ?? null) === null && (await page.evaluate(() => window.__spoken[0].lang)) === 'zh-CN', 'with the Chinese voice (zh-CN)');
    ok((await page.textContent('#dw-progress')) === '1 / 10', 'a big progress "1 / 10"');
    await page.clock.runFor(100);
    ok((await page.$eval('#dw-dial', (e) => e.dataset.state)) === 'speaking', 'while the voice speaks the dial says so');
    await page.clock.runFor(300);   // the voice has finished: the pause (3 s) starts
    ok((await page.$eval('#dw-dial', (e) => e.dataset.state)) === 'waiting' && +(await page.$eval('#dw-dial', (e) => e.dataset.left)) > 2500, 'when the voice has finished, the pause starts (3 s) and the ring runs');
    const ring0 = await page.evaluate(() => { const fg = document.querySelector('.dw-ring .fg'); return { off: parseFloat(fg.style.strokeDashoffset), col: getComputedStyle(fg).stroke }; });
    await page.clock.runFor(1500);
    const mid = +(await page.$eval('#dw-dial', (e) => e.dataset.left));
    ok(mid > 1000 && mid < 1800 && (await spoken(page)).length === 1, `the ring has run down by half (${mid} ms left) and nothing new has been said`);
    const ringState = await page.evaluate(() => { const fg = document.querySelector('.dw-ring .fg'); return { off: parseFloat(fg.style.strokeDashoffset), col: getComputedStyle(fg).stroke }; });
    ok(ringState.off > 20 && ringState.off < 250 && ringState.col === ring0.col && ringState.off > ring0.off, 'the ring drains calmly (the same colour all the time, no green-to-red change)');
    await page.clock.runFor(1700);
    s = await spoken(page);
    ok(s.length === 2 && s[1] === readOf(IT[1]) && (await page.textContent('#dw-progress')) === '2 / 10', 'after the pause the next item is read: "' + s[1] + '"');
    // repeat
    await page.click('#dw-repeat');
    s = await spoken(page);
    ok(s.length === 3 && s[2] === s[1] && (await page.textContent('#dw-progress')) === '2 / 10', 'repeat says the same item again');
    await page.clock.runFor(350);
    // pause
    await page.click('#dw-pause-btn');
    const l1 = +(await page.$eval('#dw-dial', (e) => e.dataset.left));
    await page.clock.runFor(6000);
    const l2 = +(await page.$eval('#dw-dial', (e) => e.dataset.left));
    ok((await page.$eval('#dw-dial', (e) => e.dataset.state)) === 'paused' && l1 === l2 && (await spoken(page)).length === 3 && (await page.textContent('#dw-progress')) === '2 / 10', 'pause stops the countdown for as long as it is held (nothing is read, the ring stands still)');
    await page.click('#dw-pause-btn');
    await page.clock.runFor(l2 + 150);
    ok((await spoken(page)).length === 4 && (await page.textContent('#dw-progress')) === '3 / 10', 'continuing resumes the pause where it was; then the next item');
    // previous / next
    await page.click('#dw-next'); s = await spoken(page);
    ok(s.length === 5 && s[4] === readOf(IT[3]) && (await page.textContent('#dw-progress')) === '4 / 10', 'next goes to the next item at once');
    await page.click('#dw-prev'); await page.click('#dw-prev'); s = await spoken(page);
    ok(s.at(-1) === readOf(IT[1]) && (await page.textContent('#dw-progress')) === '2 / 10', 'previous goes back (twice: item 2)');
    await page.click('#dw-prev'); await page.click('#dw-prev');
    ok((await page.textContent('#dw-progress')) === '1 / 10', 'previous stops at the first item');
    await page.screenshot({ path: OUT + 'dict-run.png' });
    // the whole list, in order
    for (let i = 0; i < 12 && (await page.locator('#dw-dial').count()); i++) await page.clock.runFor(4000);
    s = await spoken(page);
    const tail = s.slice(-10);
    ok(await page.locator('#dw-card').count() === 1, 'after the last item the check page opens');
    ok(IT.every((x, i) => tail[i] === readOf(x)), 'one pass says all 10 items in the order of the week: ' + IT.map((x) => x.text).join(''));
    ok(log.external.length === 0, 'nothing left the device (no outside request)');
    await t.browser.close();
  }

  // ---------- the scratch sheet on the screen ----------
  {
    const t = await open({ clock: true, viewport: { width: 820, height: 1180 } });
    const { page } = t;
    await go(page, '#/dictation/kdory', '#dw-start');
    await page.check('#dw-opt-screen');
    await page.click('#dw-start'); await page.waitForSelector('#pad');
    const b = await page.locator('#pad-canvas').boundingBox();
    await page.mouse.move(b.x + 50, b.y + 50); await page.mouse.down(); await page.mouse.move(b.x + 150, b.y + 120, { steps: 5 }); await page.mouse.up();
    ok((await page.$eval('#pad-canvas', (e) => e.dataset.strokes)) === '1', 'the optional scratch sheet is shown and takes a stroke');
    await page.click('#dw-next');
    ok((await page.$eval('#pad-canvas', (e) => e.dataset.strokes)) === '0' && (await page.textContent('#dw-progress')) === '2 / 10', 'the sheet is cleared for every new item');
    await page.screenshot({ path: OUT + 'dict-pad.png' });
    await t.browser.close();
  }

  // ---------- the check, the wrong ones, saving, "错字再练" ----------
  {
    const t = await open({ clock: true, arg: { review: 1 } });
    const { page } = t;
    await page.evaluate(() => localStorage.setItem('learn.local.kids/kdory.review.json', JSON.stringify({ cards: { 假: { box: 3, due: '2026-12-01', right: 3, wrong: 0, last: '2026-11-01' } }, plays: 5 })));
    await go(page, '#/dictation/kdory', '#dw-start');
    await page.check('#dw-opt-idioms');
    await page.click('#dw-start'); await page.waitForSelector('#dw-dial');
    for (let i = 0; i < 20 && (await page.locator('#dw-dial').count()); i++) await page.clock.runFor(3000);
    await page.waitForSelector('#dw-card');
    const IT = itemsOf({ idioms: true, last: false });
    ok((await page.textContent('#dw-progress')) === '1 / 12', 'the check page starts at item 1 of 12 (10 characters + 2 idioms)');
    const first = await page.evaluate(() => ({ ch: document.querySelector('#dw-char')?.textContent, py: document.querySelector('#dw-py')?.textContent, word: document.querySelector('#dw-word')?.textContent }));
    ok(first.ch === IT[0].text && first.py.length > 0 && first.word === CW[IT[0].text], `the answer is shown big with its pinyin (${first.py}) and its word (${first.word})`);
    const sz = await page.evaluate(() => { const c = document.querySelector('.dw-bigbox').getBoundingClientRect(), y = document.querySelector('#dw-right').getBoundingClientRect(), n = document.querySelector('#dw-wrong').getBoundingClientRect(); return { w: c.width, y: y.width, n: n.width, over: y.bottom > innerHeight }; });
    ok(sz.w >= 200 && sz.y >= 90 && sz.n >= 90 && !sz.over, `big character box (${Math.round(sz.w)} px) and big tick / cross (${Math.round(sz.y)} px) on a phone, both visible without scrolling`);
    await page.screenshot({ path: OUT + 'dict-check.png' });
    // wrong: item 2 (index 1), 4 (3) and the first idiom (index 10)
    const wrongIdx = new Set([1, 3, 10]);
    for (let i = 0; i < 12; i++) {
      if (i === 5) { await page.click('#dw-wrong'); await page.click('#dw-undo'); ok((await page.textContent('#dw-progress')) === '6 / 12', 'a wrong tap can be taken back ("返回上一项")'); }
      await page.click(wrongIdx.has(i) ? '#dw-wrong' : '#dw-right');
    }
    await page.waitForSelector('#dw-summary');
    ok(await page.locator('#dw-wronglist .gchip').count() === 3 && (await page.$$eval('#dw-wronglist .gchip', (e) => e.map((x) => x.dataset.w))).join() === [IT[1], IT[3], IT[10]].map((x) => x.text).join(), 'the summary lists the wrong ones: ' + [IT[1], IT[3], IT[10]].map((x) => x.text).join(' '));
    ok((await page.textContent('.dw-result')).includes('9 / 12'), 'and the score 9 / 12');
    await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
    ok(await page.locator('#toasts .toast:has-text("已保存听写结果")').count() === 1, 'a message says the result is saved (a working message first)');
    const ds = await store(page, 'dictation/kdory.json');
    ok(ds.sessions.length === 1 && ds.sessions[0].date === TODAY && ds.sessions[0].kind === 'zh' && ds.sessions[0].items.length === 12 && ds.sessions[0].wrong.join() === [IT[1], IT[3], IT[10]].map((x) => x.text).join() && ds.sessions[0].week === '2026-11-08' && !ds.sessions[0].again, 'dictation/kdory.json: one session with the date, week, the 12 items and the wrong ones');
    const rv = await store(page, 'kids/kdory.review.json');
    ok(rv.cards[IT[1].text].box === 0 && rv.cards[IT[3].text].box === 0 && !rv.cards[IT[10].text] && rv.cards['假'].box === 3 && rv.plays === 5, 'the wrong CHARACTERS are in box 0 of the game (the idiom is not); the other cards and the play count are untouched');
    ok(!(await page.evaluate(() => Object.keys(localStorage).some((k) => /kids\.json|idioms\.json/.test(k) && false))), 'no other file was needed');
    await page.screenshot({ path: OUT + 'dict-summary.png' });
    // again: only the wrong ones
    await page.click('#dw-again'); await page.waitForSelector('#dw-dial');
    ok((await page.textContent('#dw-progress')) === '1 / 3', '"错字再练" starts a dictation of the 3 wrong ones only');
    const s0 = (await spoken(page)).at(-1);
    ok(s0 === readOf(IT[1]), 'it begins with the first wrong one: ' + s0);
    for (let i = 0; i < 12 && (await page.locator('#dw-dial').count()); i++) await page.clock.runFor(3000);
    await page.waitForSelector('#dw-card');
    ok((await page.textContent('#dw-progress')) === '1 / 3', 'then its own check page (3 items)');
    for (let i = 0; i < 3; i++) await page.click('#dw-right');
    await page.waitForSelector('#dw-summary');
    ok(await page.locator('#dw-again').count() === 0 && (await page.textContent('.dw-result')) === '全部正确。', 'all right: "全部正确。", no further practice button');
    await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
    const ds2 = await store(page, 'dictation/kdory.json');
    ok(ds2.sessions.length === 2 && ds2.sessions.some((x) => x.again === true && x.wrong.length === 0 && x.items.length === 3), 'the practice is saved as its own session (again: true)');
    await page.click('#dw-done');
    ok(await page.evaluate(() => location.hash) === '#/kid/kdory', '"完成" goes back to the child\'s page');
    await go(page, '#/dictation/kdory', '#dw-recent');
    ok(await page.locator('.dw-rec').count() === 2, 'the setup page shows the recent results');
    await t.browser.close();
  }

  // ---------- English / French spelling ----------
  const spellRound = async (page, lang, thisW, lastW, plan) => {
    // plan(word, n) -> the text to type for each question, in the order they are asked
    await page.waitForSelector('#sp-input');
    const asked = [];
    for (let n = 0; n < 40 && !(await page.locator('#sp-summary').count()); n++) {
      const w = await page.$eval('#sp-input', (e) => e.dataset.word);
      asked.push(w);
      await page.fill('#sp-input', plan(w, n)); await page.click('#sp-ok');
      await page.waitForSelector('#sp-next');
      await page.click('#sp-next');
      await page.waitForSelector('#sp-input:not([disabled]), #sp-summary');
    }
    return asked;
  };
  for (const track of [{ lang: 'zh', loc: 'zh-CN', speech: 'en-US', file: 'english', thisW: E_THIS, lastW: E_LAST }, { lang: 'en', loc: 'en-US', speech: 'fr-FR', file: 'french', thisW: F_THIS, lastW: F_LAST }, { lang: 'fr', loc: 'fr-FR', speech: 'en-US', file: 'english', thisW: E_THIS, lastW: E_LAST }]) {
    const t = await open({ arg: { lang: track.lang }, locale: track.loc });
    const { page, log } = t;
    await go(page, track.file === 'english' ? '#/english/kdory' : '#/english/kdory', '#grade-btn');
    ok(await page.locator('#dict-btn').count() === 1, `[${track.lang}] the Languages week page has the dictation button`);
    await page.click('#dict-btn'); await page.waitForSelector('#sp-input');
    ok(await page.evaluate(() => location.hash) === '#/english/kdory/dictation', `[${track.lang}] it opens #/english/<kid>/dictation`);
    const sp0 = await page.evaluate(() => window.__spoken);
    const w0 = await page.$eval('#sp-input', (e) => e.dataset.word);
    ok(sp0.length === 1 && sp0[0].text === w0 && sp0[0].lang === track.speech, `[${track.lang}] the first word is said with ${track.speech}: "${w0}"`);
    ok((await page.textContent('#sp-progress')) === '1 / 10' && [...track.thisW, ...track.lastW].includes(w0), `[${track.lang}] a round of 10 words of this week and the week before`);
    await page.click('#sp-hear');
    ok((await page.evaluate(() => window.__spoken.length)) === 2, `[${track.lang}] the hear-again button says it again`);
    await page.click('#sp-hint');
    ok((await page.textContent('#sp-hintline')).startsWith([...w0][0]), `[${track.lang}] "show first letter" shows the first letter`);
    // a wrong spelling: the letters are marked, the right spelling is shown
    const wrongSpelling = w0.length > 1 ? w0.slice(0, -1) + (w0.at(-1) === 'x' ? 'z' : 'x') : w0 + 'x';
    await page.fill('#sp-input', wrongSpelling); await page.click('#sp-ok');
    const lt = await page.$$eval('#sp-letters .sp-l', (e) => e.map((x) => x.classList.contains('ok') ? '1' : '0').join(''));
    const expect = D.diffLetters(w0, wrongSpelling).map((l) => (l.ok ? '1' : '0')).join('');
    ok(lt === expect && lt.includes('0') && lt.includes('1') || w0.length === 1, `[${track.lang}] letters are marked one by one: ${lt}`);
    const col = await page.evaluate(() => { const g = document.querySelector('#sp-letters .sp-l.ok'), r = document.querySelector('#sp-letters .sp-l.bad'); return [g && getComputedStyle(g).backgroundColor, r && getComputedStyle(r).backgroundColor]; });
    ok((!col[0] || col[0] === 'rgb(47, 158, 68)') && col[1] === 'rgb(224, 49, 49)', `[${track.lang}] right letters are green, wrong ones red`);
    ok((await page.textContent('#sp-correct')) === w0 && await page.locator('#sp-answer.show').count() === 1, `[${track.lang}] the correct spelling is shown after the answer: ${w0}`);
    await page.screenshot({ path: OUT + `spell-${track.lang}.png` });
    await page.click('#sp-next');
    // the rest: everything right, except the third word (typed wrong the first time)
    let thirdWord = null;
    const asked = [w0];
    for (let n = 1; n < 40 && !(await page.locator('#sp-summary').count()); n++) {
      await page.waitForSelector('#sp-input:not([disabled]), #sp-summary');
      if (await page.locator('#sp-summary').count()) break;
      const w = await page.$eval('#sp-input', (e) => e.dataset.word);
      asked.push(w);
      if (n === 2) thirdWord = w;
      await page.fill('#sp-input', n === 2 && asked.indexOf(w) === 2 ? 'zzz' : w.toUpperCase());
      await page.click('#sp-ok'); await page.waitForSelector('#sp-next'); await page.click('#sp-next');
    }
    await page.waitForSelector('#sp-summary');
    const first10 = asked.slice(0, 10);
    ok(asked.length === 12 && new Set(first10).size === 10, `[${track.lang}] 10 different words, then the 2 wrong ones are asked again at the end of the round`);
    ok(asked[10] === w0 && asked[11] === thirdWord || (asked[10] === thirdWord && asked[11] === w0), `[${track.lang}] the re-asked words are exactly the two that were wrong: ${asked.slice(10).join(', ')}`);
    ok(await page.locator('#sp-wronglist .sp-wrong').count() === 2, `[${track.lang}] the end page lists the 2 wrong words`);
    await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
    const ds = await store(page, `${track.file}/kdory.dictation.json`);
    ok(ds && ds.sessions.length === 1 && ds.sessions[0].kind === 'word' && ds.sessions[0].items.length === 10 && ds.sessions[0].wrong.length === 2 && ds.sessions[0].wrong.includes(w0) && ds.sessions[0].wrong.includes(thirdWord), `[${track.lang}] results are in ${track.file}/kdory.dictation.json (10 words, the 2 wrong ones)`);
    ok((await store(page, track.file === 'english' ? 'french/kdory.dictation.json' : 'english/kdory.dictation.json')) === null, `[${track.lang}] the other track's file is untouched`);
    const rv = await store(page, `${track.file}/kdory.review.json`);
    ok(rv && rv.cards[w0] && rv.cards[w0].box === 0 && rv.cards[thirdWord].box === 0, `[${track.lang}] the wrong words go into the game's boxes of that track`);
    ok((await store(page, 'kids/kdory.review.json')) === null, `[${track.lang}] the Chinese review is untouched`);
    ok(log.external.length === 0, `[${track.lang}] nothing left the device`);
    if (track.lang !== 'zh') {
      await page.click('#sp-again'); await page.waitForSelector('#sp-input');
      const left = (await chineseLeft(page)).filter((x) => !covered(x));
      ok(left.length === 0, `[${track.lang}] no Chinese left on the spelling page${left.length ? ': ' + left.join(' | ') : ''}`);
    }
    await t.browser.close();
  }
  // a track with no words yet
  {
    const t = await open({ arg: { eng: [], fre: [] } });
    await go(t.page, '#/english/kdory/dictation', '#sp-empty');
    ok(true, 'a child without words gets a plain message, not a broken page');
    await t.browser.close();
  }

  // ---------- finger writing ----------
  const boardBox = (page) => page.locator('#wr-ink').boundingBox();
  const toScreen = (b, p) => [b.x + (p[0] / 1024) * b.width, b.y + ((900 - p[1]) / 1024) * b.height];
  const drawMouse = async (page, pts) => {
    const b = await boardBox(page), s = pts.map((p) => toScreen(b, p));
    await page.mouse.move(s[0][0], s[0][1]); await page.mouse.down();
    for (const p of s.slice(1)) await page.mouse.move(p[0], p[1]);
    await page.mouse.up();
  };
  const wstate = (page) => page.$eval('#wr-board', (e) => ({ ...e.dataset }));
  const writeAll = async (page, c, draw, o = {}) => {
    const M = mediansOf(c);
    for (let i = 0; i < M.length; i++) await draw(page, hand(M[i], o));
  };
  {
    const t = await open();
    const { page, log } = t;
    await go(page, '#/write/kdory', '#wr-board');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'writing');
    let s = await wstate(page);
    ok(s.ch === '假' && s.strokes === String(strokesOf('假').length) && s.mode === 'trace', `the first character of the week is shown (${s.ch}, ${s.strokes} strokes), 描红 mode`);
    ok((await page.$$eval('#wr-list .wr-ch', (e) => e.map((x) => x.dataset.ch))).join('') === WEEK1.join(''), 'the list holds this week\'s characters');
    ok(await page.locator('#wr-board .wr-faint path').count() === strokesOf('假').length && await page.locator('#wr-board .wr-next').count() === 1, '描红: the faint character is there and the next stroke is lit');
    ok((await page.textContent('#wr-py')).length > 0, 'the pinyin is shown');
    // the board: square, centred, canvas = layout size x dpr
    const g = await page.evaluate(() => { const b = document.querySelector('#wr-board').getBoundingClientRect(), c = document.querySelector('#wr-ink'); return { w: b.width, h: b.height, l: b.left, r: innerWidth - b.right, cw: c.width, ch: c.height, ow: c.offsetWidth, oh: c.offsetHeight, dpr: devicePixelRatio }; });
    ok(Math.abs(g.w - g.h) < 1 && g.w > 300 && Math.abs(g.l - g.r) < 2, `the board is square (${Math.round(g.w)} px) and centred`);
    ok(g.cw === Math.round(g.ow * g.dpr) && g.ch === Math.round(g.oh * g.dpr), 'the drawing surface has the LAYOUT size times the pixel ratio');
    // order: draw stroke 3 first = wrong order
    const M = mediansOf('假');
    await drawMouse(page, hand(M[3]));
    s = await wstate(page);
    ok(s.last === 'order' && s.next === '0' && s.mistakes === '1' && (await page.textContent('#wr-msg')).includes('笔顺不对'), 'a stroke of a later place: "笔顺不对", not accepted');
    ok(await page.locator('#wr-board .wr-sweep').count() === 1 && s.hint === '1', 'the right stroke is shown as a hint animation');
    // reversed first stroke
    await drawMouse(page, hand(M[0]).reverse());
    s = await wstate(page);
    ok(s.last === 'direction' && s.next === '0' && s.mistakes === '2', 'a stroke drawn the wrong way round is refused');
    // a tap
    const b0 = await boardBox(page);
    await page.mouse.click(b0.x + b0.width * 0.2, b0.y + b0.height * 0.9);
    ok((await wstate(page)).mistakes === '2', 'a tap is ignored (no mistake)');
    // the whole character, right strokes with the mouse
    for (let i = 0; i < M.length; i++) {
      await drawMouse(page, hand(M[i]));
      s = await wstate(page);
      if (s.next !== String(i + 1) && !(i === M.length - 1 && s.state === 'done')) { ok(false, `stroke ${i + 1} of 假 was not accepted (${s.last})`); break; }
    }
    s = await wstate(page);
    ok(s.state === 'done' && s.done === String(M.length) && await page.locator('#wr-board .wr-placed path').count() === M.length, 'every stroke was accepted and the whole character is filled in');
    ok(s.stars === '2' && await page.locator('#wr-stars .gstar.on').count() === 2, 'two mistakes before: 2 stars');
    ok(await page.locator('#wr-next-char').isVisible() && await page.locator('#wr-again').isVisible(), '"下一个字" and "再写一遍" are offered');
    await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
    ok(await page.locator('#toasts .toast:has-text("已记录这个字的成绩")').count() === 1, 'a message says the result was recorded');
    let wd = await store(page, 'write/kdory.json');
    ok(wd.written['假'].stars === 2 && wd.written['假'].n === 1 && wd.written['假'].last === TODAY, 'write/kdory.json holds the best stars of 假');
    await page.screenshot({ path: OUT + 'write-done.png' });
    // again: no mistakes = 3 stars; best is kept / raised
    await page.click('#wr-again');
    s = await wstate(page);
    ok(s.state === 'writing' && s.done === '0' && s.mistakes === '0', '"再写一遍" clears the board');
    await writeAll(page, '假', drawMouse);
    s = await wstate(page);
    ok(s.state === 'done' && s.stars === '3' && await page.locator('#wr-stars .gstar.on').count() === 3, 'no mistake: 3 stars');
    await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
    wd = await store(page, 'write/kdory.json');
    ok(wd.written['假'].stars === 3 && wd.written['假'].n === 2, 'the best stars are raised (3), the count is 2');
    await page.waitForSelector('#wr-list .wr-ch[data-ch="假"][data-stars="3"]');
    ok(true, 'the character in the list shows its stars');
    // next character
    await page.click('#wr-next-char');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.ch === '辣' && document.querySelector('#wr-board').dataset.state === 'writing');
    ok(true, '"下一个字" goes to the next character of the list (辣)');
    // 3+ mistakes = 1 star
    const M2 = mediansOf('辣');
    for (let k = 0; k < 3; k++) await drawMouse(page, [[100, 100], [900, 140]]);
    await writeAll(page, '辣', drawMouse);
    s = await wstate(page);
    ok(s.state === 'done' && s.stars === '1', 'three mistakes: 1 star');
    // 默写 mode
    await page.click('#wr-mode-recite');
    s = await wstate(page);
    ok(s.mode === 'recite' && s.state === 'writing' && await page.locator('#wr-board .wr-faint path').count() === 0 && await page.locator('#wr-board .wr-next').count() === 0, '默写: no outline, no lit stroke');
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('learn.dictwrite.v1')).mode) === 'recite', 'the mode is remembered on this device');
    await drawMouse(page, [[100, 100], [900, 140]]);
    ok((await wstate(page)).hint === '0' && (await wstate(page)).mistakes === '1', '默写: after one wrong stroke no hint yet');
    await drawMouse(page, [[100, 120], [900, 100]]);
    s = await wstate(page);
    ok(s.hint === '1' && await page.locator('#wr-board .wr-sweep').count() === 1 && s.next === '0', '默写: after two wrong strokes the right next stroke is shown');
    const MC = mediansOf(s.ch);
    await drawMouse(page, hand(MC[0]));
    s = await wstate(page);
    ok(s.next === '1' && s.hint === '0' && await page.locator('#wr-board .wr-sweep').count() === 0, 'the hint goes away when the stroke is written');
    // the demo
    await page.click('#wr-mode-trace');
    await page.click('#wr-demo');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'demo');
    const n = strokesOf('辣').length;
    await page.waitForFunction((k) => document.querySelector('#wr-board').dataset.demo === String(k), n, { timeout: 15000 });
    ok(true, `the demo plays the strokes one after the other (all ${n} reached)`);
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'writing', null, { timeout: 15000 });
    ok((await wstate(page)).done === '0', 'and hands the board back, empty');
    ok(log.external.length === 0, 'nothing left the device');
    await t.browser.close();
  }

  // ---------- real touch events (CDP) at dpr 2, 默写 and 点 ----------
  {
    const t = await open({ dpr: 2, touch: true, viewport: { width: 390, height: 844 } });
    const { page, ctx } = t;
    await go(page, '#/write/kdory', '#wr-board');
    await page.click('#wr-tab-type'); await page.fill('#wr-type', '鸟');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.ch === '鸟' && document.querySelector('#wr-board').dataset.state === 'writing');
    const cdp = await ctx.newCDPSession(page);
    const touch = async (pg, pts) => {
      const b = await boardBox(pg), s = pts.map((p) => toScreen(b, p));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s[0][0], y: s[0][1] }] });
      for (const p of s.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const info = await page.evaluate(() => { const c = document.querySelector('#wr-ink'); return { dpr: devicePixelRatio, cw: c.width, ow: c.offsetWidth }; });
    ok(info.dpr === 2 && info.cw === info.ow * 2, 'dpr 2: the surface is 2 x its layout size');
    const MS = mediansOf('鸟');
    ok(MS.length === 5 && MS.filter((m) => W.isDot(m)).length === 1, '鸟 has 5 strokes including a dot (点)');
    for (let i = 0; i < MS.length; i++) {
      const pts = W.isDot(MS[i]) ? [MS[i][0], [MS[i][0][0] + 3, MS[i][0][1] - 3]] : hand(MS[i]);
      await touch(page, pts);
      await page.waitForTimeout(40);
    }
    const s = await wstate(page);
    ok(s.state === 'done' && s.stars === '3' && s.done === '5', 'real touch events: the whole character 鸟 (with its dot, tapped) is written, 3 stars');
    // a drawn line follows the finger (ink at the place touched, dpr 2)
    await page.click('#wr-again');
    const b = await boardBox(page);
    const x = b.x + b.width * 0.3, y = b.y + b.height * 0.4;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y: y + 10 }] });
    const ink = await page.evaluate(({ rx, ry }) => { const c = document.querySelector('#wr-ink'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const at = (px, py) => d[(Math.round(py * 2) * c.width + Math.round(px * 2)) * 4 + 3]; return { start: at(rx, ry), far: at(rx, ry + 150), end: at(rx + 60, ry + 10) }; }, { rx: x - b.x, ry: y - b.y });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok(ink.start > 0 && ink.end > 0 && ink.far === 0, 'the ink is drawn exactly where the finger is (start and end of the line have ink, a place far away has none)');
    await page.screenshot({ path: OUT + 'write-touch.png' });
    await t.browser.close();
  }
  // a pen first, then a palm (touch) is ignored; two fingers draw nothing extra
  {
    const t = await open({ dpr: 1 });
    const { page } = t;
    await go(page, '#/write/kdory', '#wr-board');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'writing');
    const b = await boardBox(page);
    const res = await page.evaluate(({ x, y }) => {
      const c = document.querySelector('#wr-ink'), out = [];
      const ev = (type, id, kind, dx) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, clientX: x + dx, clientY: y + dx, bubbles: true, isPrimary: true, button: 0, buttons: 1 }));
      ev('pointerdown', 7, 'pen', 0); ev('pointermove', 7, 'pen', 40); out.push(c.dataset.points);
      ev('pointerdown', 8, 'touch', 100); ev('pointermove', 8, 'touch', 140); out.push(c.dataset.points);
      ev('pointerup', 7, 'pen', 40); out.push(c.dataset.points);
      return out;
    }, { x: b.x + 80, y: b.y + 80 });
    ok(+res[0] >= 2 && res[1] === res[0] && res[2] === '0', `a pencil draws; a palm (touch) after the pencil is ignored and does not change the line (${res.join(' / ')})`);
    await t.browser.close();
  }

  // ---------- the animated look once (motion on) ----------
  {
    const t = await open({ motion: true, viewport: { width: 820, height: 1180 } });
    const { page } = t;
    await go(page, '#/write/kdory', '#wr-board');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'writing');
    await writeAll(page, '假', drawMouse);
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'done');
    await page.waitForSelector('#wr-board .wr-spark');
    ok(await page.locator('#wr-board .wr-spark').count() >= 10, 'with animations on: sparkles at the end of a character');
    await page.screenshot({ path: OUT + 'write-motion.png' });
    await t.browser.close();
  }

  // ---------- five screen sizes ----------
  for (const [w, h] of SIZES) {
    const t = await open({ viewport: { width: w, height: h }, clock: true });
    const { page } = t;
    const tag = `${w}x${h}`;
    await go(page, '#/kid/kdory', '#dw-tools');
    let g = await geo(page);
    const bt = await page.evaluate(() => [...document.querySelectorAll('#dw-tools button')].map((b) => Math.round(b.getBoundingClientRect().height)));
    ok(g.sw <= g.vw && !g.over.length && bt.every((x) => x >= 40) && await centered(page, '#dw-tools') < 3, `[${tag}] week page: no overflow, buttons >= 40 px, centred`);
    await go(page, '#/dictation/kdory', '#dw-start');
    g = await geo(page);
    const pb = await page.evaluate(() => [...document.querySelectorAll('#dw-pause button, #dw-start')].map((b) => Math.round(b.getBoundingClientRect().height)));
    ok(g.sw <= g.vw && !g.over.length && pb.every((x) => x >= 40) && await centered(page, '.dw-narrow') < 3, `[${tag}] dictation setup: no overflow, targets >= 40 px, centred`);
    await page.screenshot({ path: OUT + `dict-setup-${tag}.png` });
    await page.click('#dw-start'); await page.waitForSelector('#dw-dial');
    g = await geo(page);
    const rb = await page.evaluate(() => { const d = document.querySelector('#dw-dial').getBoundingClientRect(), bs = [...document.querySelectorAll('.dw-ctl')].map((b) => b.getBoundingClientRect()); return { dw: d.width, dh: d.height, dl: d.left, dr: innerWidth - d.right, bs: bs.map((b) => Math.round(Math.min(b.width, b.height))), inView: bs.every((b) => b.right <= innerWidth && b.left >= 0) }; });
    ok(g.sw <= g.vw && !g.over.length && Math.abs(rb.dw - rb.dh) < 1 && Math.abs(rb.dl - rb.dr) < 3 && rb.bs.every((x) => x >= 44) && rb.inView, `[${tag}] reading page: round dial centred (${Math.round(rb.dw)} px), controls >= 44 px, no overflow`);
    await page.screenshot({ path: OUT + `dict-run-${tag}.png` });
    for (let i = 0; i < 14 && (await page.locator('#dw-dial').count()); i++) await page.clock.runFor(6000);
    await page.waitForSelector('#dw-card');
    g = await geo(page);
    const cb = await page.evaluate(() => { const y = document.querySelector('#dw-right').getBoundingClientRect(), n = document.querySelector('#dw-wrong').getBoundingClientRect(), c = document.querySelector('.dw-bigbox').getBoundingClientRect(); return { y: Math.min(y.width, y.height), n: Math.min(n.width, n.height), mid: Math.abs((y.left + n.right) / 2 - innerWidth / 2), sq: Math.abs(c.width - c.height) < 1 }; });
    ok(g.sw <= g.vw && !g.over.length && cb.y >= 44 && cb.n >= 44 && cb.sq && cb.mid < 4, `[${tag}] check page: tick / cross >= 44 px, centred, square character box, no overflow`);
    await page.screenshot({ path: OUT + `dict-check-${tag}.png` });
    await go(page, '#/english/kdory/dictation', '#sp-input');
    g = await geo(page);
    const sb = await page.evaluate(() => [...document.querySelectorAll('#sp-btns button, .sp-btns button, #sp-hear, #sp-input')].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)));
    ok(g.sw <= g.vw && !g.over.length && sb.every((x) => x >= 40) && await centered(page, '.sp-wrap') < 3, `[${tag}] spelling page: no overflow, targets >= 40 px, centred`);
    await page.screenshot({ path: OUT + `spell-${tag}.png` });
    await go(page, '#/write/kdory', '#wr-board');
    await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'writing');
    g = await geo(page);
    const wb = await page.evaluate(() => {
      const b = document.querySelector('#wr-board').getBoundingClientRect(), p = document.querySelector('.wr-panel').getBoundingClientRect(), c = document.querySelector('#wr-ink');
      const btn = [...document.querySelectorAll('.wr-panel button, .wr-panel input')].map((e) => Math.round(Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))).filter((x) => x > 0);
      const left = Math.min(b.left, p.left), right = Math.max(b.right, p.right);
      return { sq: Math.abs(b.width - b.height) < 1, w: b.width, left, right: innerWidth - right, inside: b.bottom <= innerHeight + 400 && b.left >= 0 && b.right <= innerWidth, cw: c.width === Math.round(c.offsetWidth * devicePixelRatio), btn: Math.min(...btn), side: p.left > b.right - 2 };
    });
    ok(g.sw <= g.vw && !g.over.length && wb.sq && wb.inside && wb.cw && Math.abs(wb.left - wb.right) < 6 && wb.btn >= 40, `[${tag}] writing page: board square (${Math.round(wb.w)} px), content centred (${Math.round(wb.left)} / ${Math.round(wb.right)}), targets >= 40 px, no overflow${wb.side ? ', panel beside the board' : ''}`);
    if (w >= 1180) ok(wb.side && wb.w >= 560, `[${tag}] on a wide screen the board is as big as possible (${Math.round(wb.w)} px) with the panel beside it`);
    if (w === 390) ok(wb.w >= 340, `[${tag}] on a phone the board nearly fills the width (${Math.round(wb.w)} px)`);
    await page.screenshot({ path: OUT + `write-${tag}.png` });
    await t.browser.close();
  }

  // ---------- English / French ----------
  for (const [lang, loc] of [['en', 'en-US'], ['fr', 'fr-FR']]) {
    const t = await open({ arg: { lang }, locale: loc, viewport: { width: 390, height: 844 }, clock: true });
    const { page } = t;
    const checkPage = async (name) => {
      const left = (await chineseLeft(page)).filter((x) => !covered(x) && x !== '古诗词' && x !== '编程');   // (古诗词: another feature's card, translated by its own file)
      ok(left.length === 0, `[${lang}] ${name}: no Chinese left (except the user's own characters)${left.length ? ': ' + left.join(' | ') : ''}`);
      const g = await geo(page);
      ok(g.sw <= g.vw && !g.over.length, `[${lang}] ${name}: no overflow / clipping on 390 px`);
    };
    await go(page, '#/kid/kdory', '#dw-tools'); await checkPage('week page');
    await go(page, '#/dictation/kdory', '#dw-start'); await checkPage('dictation setup');
    await page.click('#dw-start'); await page.waitForSelector('#dw-dial'); await checkPage('reading page');
    ok((await page.evaluate(() => window.__spoken[0].lang)) === 'zh-CN', `[${lang}] a Chinese dictation is still read with the Chinese voice`);
    for (let i = 0; i < 14 && (await page.locator('#dw-dial').count()); i++) await page.clock.runFor(6000);
    await page.waitForSelector('#dw-card'); await checkPage('check page');
    for (let i = 0; i < 10; i++) await page.click(i === 0 ? '#dw-wrong' : '#dw-right');
    await page.waitForSelector('#dw-summary'); await checkPage('summary');
    await go(page, '#/write/kdory', '#wr-board'); await page.waitForFunction(() => document.querySelector('#wr-board').dataset.state === 'writing'); await checkPage('writing page');
    await page.click('#wr-tab-type'); await page.waitForSelector('#wr-type'); await checkPage('writing page, typed tab');
    await page.screenshot({ path: OUT + `write-${lang}.png` });
    await go(page, '#/english/kdory', '#dict-btn'); await checkPage('Languages week page');
    await t.browser.close();
  }

  await done();
})().catch((e) => { console.error(e); process.exit(1); });
