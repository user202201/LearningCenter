// The Languages subject teaches the OTHER language of the screen: Chinese screen -> English words with Chinese meanings; French screen -> English words with FRENCH
// meanings; English screen -> FRENCH words with English meanings (their own files french/<kid>.json). The card, the title and the shortcuts are named accordingly.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();

const kidIdOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
const run = async (loc, expect) => {
  const t = await start(new Map(), { local: true, locale: loc, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  const p = t.page;
  await addKid(p, 'Dory'); await setGrade(p, 'Dory', 3);
  const id = await kidIdOf(p);
  await p.evaluate(() => (location.hash = '#/')); await p.waitForSelector('.hub-grid');
  const names = await p.locator('.subject .s-name').allTextContents();
  ok(names.includes(expect.card), `${loc}: the card of the language subject is called "${expect.card}" (cards: ${names.join(', ')})`);
  await p.click('.subject[data-subject=english]'); await p.waitForSelector('.kids');
  ok((await p.textContent('.hero h1')).trim() === expect.card, `${loc}: the title is "${expect.card}"`);
  await p.click('.kid'); await p.waitForSelector('.wrow');
  const rows = await p.locator('.wrow').evaluateAll((els) => els.map((e) => ({ w: e.dataset.w, m: e.querySelector('.wzh').textContent })));
  ok(rows.length === 20 && rows.every((r) => r.m.trim().length > 0), `${loc}: 20 words, each with a meaning`);
  ok(expect.words(rows), `${loc}: ${expect.say} (${rows.slice(0, 4).map((r) => r.w + '=' + r.m).join(' ')})`);
  const stored = await p.evaluate((id) => ({ en: localStorage.getItem('learn.local.english/' + id + '.json') !== null, fr: localStorage.getItem('learn.local.french/' + id + '.json') !== null }), id);
  ok(stored.fr === expect.french && stored.en === !expect.french, `${loc}: the words are kept in ${expect.french ? 'french/' : 'english/'}<kid>.json`);
  const sc = await p.locator('.shortcuts .sc-name').allTextContents();
  ok(!sc.includes(expect.card) && sc.length === 3, `${loc}: the shortcuts on this page are the three OTHER subjects (${sc.join(', ')})`);
  // the game says the word and shows the meaning on a tap
  await p.click('#tab-game'); await p.click('#game-start'); await p.waitForSelector('#game-char');
  await p.click('#game-dial');
  const meaning = await p.textContent('#game-py');
  ok(meaning.trim().length > 0 && expect.meaning(meaning), `${loc}: a tap in the game shows the meaning (${meaning})`);
  ok(t.log.external.length === 0, `${loc}: no request left the app`);
  await t.browser.close();
};
(async () => {
  await run('zh-CN', { card: '英语', french: false, say: 'English words with Chinese meanings', words: (r) => r.every((x) => /^[A-Za-z' -]+$/.test(x.w)) && r.every((x) => /[一-鿿]/.test(x.m)), meaning: (m) => /[一-鿿]/.test(m) });
  await run('fr-FR', { card: 'Anglais', french: false, say: 'English words with French meanings', words: (r) => r.every((x) => /^[A-Za-z' -]+$/.test(x.w)) && r.every((x) => !/[一-鿿]/.test(x.m)), meaning: (m) => !/[一-鿿]/.test(m) });
  await run('en-US', { card: 'French', french: true, say: 'FRENCH words with English meanings', words: (r) => r.every((x) => /[a-zàâçéèêëîïôûùüÿœ]/i.test(x.w)) && r.every((x) => !/[一-鿿]/.test(x.m)) && r.some((x) => /^(le|la|l'|les|un|une|[a-zéèêàç]+)/i.test(x.w)), meaning: (m) => /[A-Za-z]/.test(m) && !/[一-鿿]/.test(m) });
  await done();
})();
