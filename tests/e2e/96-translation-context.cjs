// One Chinese text, two meanings: the tables are keyed by the Chinese text, so a text used with two meanings used to get ONE translation (the user found
// "退出" = Sign out AND Quit the game). Since then the minority use has its own key `text@ctx` (src/i18n.ts `cx`, documented in scripts/i18n-contexts.json).
// Part 1 (Node): cx / tr in en / fr / zh (the Chinese a reader sees does not change, nothing invisible reaches en / fr), every documented key, the script that checks
// the documentation. Part 2 (browser, en and fr): the real screens: sign out vs quit the game, speed vs tempo, the new-puzzle buttons, the quiz counter, the valves,
// yes / no vs none. NOT tested: whether the translations are good English / French (written by a model: see docs/verify/translation-context-audit.md).
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const { start, checks, adminOn } = require('./harness.cjs');
const { ok, done } = checks();
const ROOT = path.resolve(__dirname, '../..');
const TODAY = '2026-11-10';
const INVISIBLE = /[⁣​‌]/;

(async () => {
  // ================= part 1: the mechanism and the documented keys
  // [text, ctx, English, French]; ctx '' = the plain text
  const EXP = [
    ['退出', '', 'Quit', 'Quitter'], ['退出登录', '', 'Sign out', 'Se déconnecter'], ['退出游戏', '', 'Quit the game', 'Quitter le jeu'],
    ['速度', '', 'Speed', 'Vitesse'], ['速度', 'tempo', 'Tempo', 'Tempo'],
    ['继续', '', 'Resume', 'Reprendre'], ['继续', 'next', 'Continue', 'Continuer'],
    ['挑战', '', 'Hard', 'Difficile'], ['挑战', 'boss', 'Challenge', 'Défi'],
    ['排序', '', 'Order', 'Ordre'], ['排序', 'sorting', 'Sorting', 'Tri'],
    ['顺序', '', 'Sequence', 'Séquence'], ['顺序', 'order', 'Order', 'Ordre'],
    ['关闭', '', 'Close', 'Fermer'], ['关闭', 'closed', 'Closed', 'Fermée'],
    ['没有', '', 'No', 'Non'], ['没有', 'none', 'None', 'Aucune'],
    ['无', '', 'None', 'Aucun'], ['无', 'no', 'No', 'Non'],
    ['输入', '', 'Type', 'Saisir'], ['输入', 'input', 'Input', 'Entrée'],
    ['地图', '', 'Maps', 'Cartes'], ['地图', 'single', 'Map', 'Carte'],
    ['应用', '', 'App', 'Application'], ['应用', 'use', 'Uses', 'Usages'],
    ['形成', '', 'Forms', 'Se forme'], ['形成', 'formation', 'Formation', 'Formation'],
    ['清除记录', '', 'Clear record', "Effacer l'historique"], ['清除记录', 'data', 'Clear data', 'Effacer les mesures'],
    ['新题', '', 'New hand', 'Nouvelle main'], ['新题', 'puzzle', 'New puzzle', 'Nouvelle grille'],
    ['返回', '', 'Back', 'Retour'], ['返回', 'return', 'Return', 'Retourner'],
    ['种', '', 'types', 'types'], ['种', 'species', 'species', 'espèces'],
    ['重置', '', 'Reset', 'Réinitialiser'],
  ];
  // (run inside the app's own page: the dev server resolves the TypeScript modules)
  const tb = await start(new Map(), { local: true, locale: 'zh-CN' });
  const R = await tb.page.evaluate(async (EXP) => {
    const I = await import('/src/i18n.ts');
    const { tr, cx } = I, bare = (s) => s.replace(/[\u2063\u200b\u200c]/g, '');
    const inv = /[\u2063\u200b\u200c]/;
    return {
      rows: EXP.map(([t, c, en, fr]) => { const s = c ? cx(t, c) : t; return { t, c, en, fr, gotEn: tr(s, 'en'), gotFr: tr(s, 'fr') }; }),
      leak: EXP.some(([t, c]) => inv.test(tr(c ? cx(t, c) : t, 'en')) || inv.test(tr(c ? cx(t, c) : t, 'fr'))),
      zhSame: EXP.every(([t, c]) => bare(tr(c ? cx(t, c) : t, 'zh')) === t) && bare(cx('速度', 'tempo')) === '速度' && cx('速度', 'tempo') !== '速度',
      fallback: [tr(cx('速度', 'nonsense'), 'en'), tr(cx('速度', 'nonsense'), 'fr')],
      pat: [tr(cx('第 3 / 10 题', 'q'), 'en'), tr('第 3 / 10 题', 'en'), tr(cx('第 3 / 10 题', 'q'), 'fr'), tr('第 3 / 10 题', 'fr')],
      read: [I.splitCx(cx('速度', 'tempo')).ctx, I.splitCx('速度').ctx],
    };
  }, EXP);
  await tb.browser.close();
  for (const r of R.rows) ok(r.gotEn === r.en && r.gotFr === r.fr, `${r.t}${r.c ? ' @' + r.c : ''}: en "${r.gotEn}" fr "${r.gotFr}"`);
  ok(!R.leak, 'nothing invisible reaches the English or French text');
  ok(R.zhSame, 'in Chinese the text is the same to the eye (only invisible marks are added)');
  ok(R.fallback[0] === 'Speed' && R.fallback[1] === 'Vitesse', 'a context without an entry falls back to the plain translation');
  ok(R.pat.join('|') === 'Question 3 / 10|Round 3 / 10|Question 3 / 10|Manche 3 / 10', 'a pattern text has contexts too: the quiz says Question n / m, the duel says Round n / m');
  ok(R.read[0] === 'tempo' && R.read[1] === '', 'the context can be read back');
  // the script that keeps the documentation honest
  const run = spawnSync('node', [path.join(ROOT, 'scripts/check-i18n-contexts.mjs')], { encoding: 'utf8' });
  ok(run.status === 0 && /keys with more than one meaning documented/.test(run.stdout), 'scripts/check-i18n-contexts.mjs passes: ' + (run.stdout || run.stderr).trim().slice(0, 80));
  const doc = require(path.join(ROOT, 'scripts/i18n-contexts.json'));
  ok(Object.keys(doc).length >= 18 && EXP.every(([t, c]) => doc[t === '退出游戏' ? '退出' : t] !== undefined || t === '退出游戏'), 'every key of the checks above is documented in scripts/i18n-contexts.json (' + Object.keys(doc).length + ' keys)');

  // ================= part 2: the real screens
  const initSeed = () => {
    localStorage.setItem('learn.storage', 'local');
    localStorage.setItem('learn.local.kids.json', JSON.stringify({ kids: [{ id: 'kdory', name: 'Dory', color: '#f2545b' }], startWeek: '2026-10-25' }));
    localStorage.setItem('learn.local.kids/kdory.json', JSON.stringify({ weeks: [{ start: '2026-11-08', chars: Array.from('波坡板炭') }] }));
  };
  const LANGS = [['en-US', { out: 'Sign out', outQ: 'Sign out?', quitQ: 'Quit the game?', quit: 'Quit', speed: 'Speed', tempo: 'Tempo', np: 'New puzzle', nh: 'New hand', q: 'Question 1 /', yes: 'Yes', no: 'No' }],
    ['fr-FR', { out: 'Se déconnecter', outQ: 'Se déconnecter ?', quitQ: 'Quitter le jeu ?', quit: 'Quitter', speed: 'Vitesse', tempo: 'Tempo', np: 'Nouvelle grille', nh: 'Nouvelle main', q: 'Question 1 /', yes: 'Oui', no: 'Non' }]];
  for (const [locale, E] of LANGS) {
    const L = locale.slice(0, 2);
    // --- sign out (signed in with GitHub: the button is in Settings)
    let t = await start(new Map(), { locale, viewport: { width: 390, height: 844 } });
    let p = t.page;
    await p.evaluate(() => (location.hash = '#/settings')); await p.waitForSelector('#manage-mode'); await adminOn(p);
    ok((await p.textContent('button.danger')).trim() === E.out, `${L}: the Settings button says "${E.out}" (not Quit)`);
    await p.click('button.danger'); await p.waitForSelector('dialog');
    const sd = await p.evaluate(() => ({ h: document.querySelector('dialog h2')?.textContent.trim(), b: [...document.querySelectorAll('dialog .row button')].map((b) => b.textContent.trim()) }));
    ok(sd.h === E.outQ && sd.b.includes(E.out) && !sd.b.includes(E.quit), `${L}: the sign-out question is "${sd.h}" with the button "${sd.b.join(' / ')}"`);
    await p.click('dialog button:not(.danger)'); await t.browser.close();

    // --- quit the game (a game of the 识字 child page)
    t = await start(new Map(), { noLogin: true, clock: TODAY + 'T10:00:00', locale, viewport: { width: 390, height: 844 }, init: initSeed });
    p = t.page;
    await p.evaluate(() => (location.hash = '#/kid/kdory/game')); await p.waitForSelector('#game-start');
    await p.click('#game-start'); await p.waitForSelector('#game'); await p.click('#game-quit'); await p.waitForSelector('dialog');
    const qd = await p.evaluate(() => ({ h: document.querySelector('dialog h2')?.textContent.trim(), danger: document.querySelector('dialog button.danger')?.textContent.trim() }));
    ok(qd.h === E.quitQ && qd.danger === E.quit, `${L}: leaving the game asks "${qd.h}" with the button "${qd.danger}" (not Sign out)`);
    await t.browser.close();

    // --- the other screens (this device)
    t = await start(new Map(), { local: true, locale, viewport: { width: 1180, height: 820 } });
    p = t.page;
    await p.evaluate(() => (location.hash = '#/science/physics/motion')); await p.waitForSelector('#pl-readouts');
    let ro = await p.textContent('#pl-readouts');
    ok(ro.includes(E.speed) && !ro.includes('Tempo'), `${L}: the velocity readout of the physics lab says "${E.speed}", not "Tempo"`);
    await p.click('#quiz-start'); await p.waitForSelector('#quiz-no');
    ok((await p.textContent('#quiz-no')).trim().startsWith(E.q), `${L}: the quiz of a lab counts "${(await p.textContent('#quiz-no')).trim()}" (a question, not a round)`);
    await p.evaluate(() => (location.hash = '#/science/physics/eye')); await p.waitForFunction(() => window.__phys && /Extra power|Puissance|镜片/.test(document.querySelector('#pl-readouts')?.textContent || ''));
    ro = await p.textContent('#pl-readouts'); const none = L === 'en' ? 'None' : 'Aucune';
    ok(ro.includes(none), `${L}: "no glasses" reads "${none}" (not the yes / no word)`);
    await p.evaluate(() => (location.hash = '#/science/bio/vessels')); await p.waitForFunction(() => window.__bio && location.hash.endsWith('vessels') && document.querySelector('#pl-readouts')?.textContent);
    await p.evaluate(() => { window.__bio.set('mode', 1); window.__bio.set('v', 0); });   // "three kinds of vessel": an artery has no valves
    ro = await p.evaluate(() => [...document.querySelectorAll('#pl-readouts > *')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    ok(new RegExp('Valves\\W*' + E.no + '(\\W|$)').test(ro), `${L}: the valves of an artery read "${E.no}" in the biology lab (a yes / no answer): ${ro.slice(-40)}`);
    await p.evaluate(() => (location.hash = '#/music/beats')); await p.waitForSelector('.bt-cell');
    ok((await p.getAttribute('#bt-tempo', 'aria-label')) === E.tempo, `${L}: the beat maker's slider is "${E.tempo}"`);
    await p.evaluate(() => (location.hash = '#/music/dj')); await p.waitForSelector('#dj-platter-a');
    ok((await p.locator('.dj-pl').first().textContent()).trim() === E.tempo, `${L}: the DJ pitch fader is "${E.tempo}"`);
    await p.evaluate(() => (location.hash = '#/games/lightsout')); await p.waitForSelector('#lo-new');
    ok((await p.textContent('#lo-new')).trim() === E.np, `${L}: Lights out: "${E.np}"`);
    await p.evaluate(() => (location.hash = '#/games/game24')); await p.waitForSelector('#g24-new');
    ok((await p.textContent('#g24-new')).trim() === E.nh, `${L}: Make 24 keeps "${E.nh}"`);
    await t.browser.close();
  }
  // zh: the same screens read as before
  const tz = await start(new Map(), { local: true, locale: 'zh-CN', viewport: { width: 1180, height: 820 } });
  await tz.page.evaluate(() => (location.hash = '#/games/lightsout')); await tz.page.waitForSelector('#lo-new');
  ok((await tz.page.textContent('#lo-new')).replace(/[⁣​‌]/g, '') === '新题', 'zh: the button still reads 新题 (the context marks are invisible)');
  ok(tz.log.external.length === 0, 'no outside request');
  await done(tz.browser);
})().catch((e) => { console.error(e); process.exit(1); });
