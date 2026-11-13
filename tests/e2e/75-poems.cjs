// Classical poems (古诗词) of 识字: the library (>= 130 poems: exact lines, forms, authors, dynasties, grades, notes, pinyin for every character), the daily pick
// (one poem a day, seeded, no repeats, about 30 % of the lower grades, never a higher grade), the practice generators (right answer among four different choices,
// no wrong choice also right, ordering has ONE solution; checked by an independent checker that is itself shown to catch a broken question), the memory curve,
// the merge of the files of two devices, the screens (button on the child's page, today / recorded / poets, the poem page with pinyin and speech, the six practice
// modes, recitation, leaving, grade change), real touch dragging (CDP, dpr 2), five screen sizes, English / French, nothing fetched from outside.
const { start, checks, addKid, setGrade, openKid, openManage, manageOff } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-11-13';
const SPEECH = () => {   // a pretend speechSynthesis that records what would be said
  window.__spoke = [];
  const stub = { speak(u) { window.__spoke.push({ text: u.text, lang: u.lang, rate: u.rate }); }, cancel() {}, getVoices() { return []; } };
  Object.defineProperty(window, 'speechSynthesis', { value: stub, configurable: true });
};
// a FIXED list of poets (the test does not trust the data to say who the allowed poets are)
const AUTHORS = ['骆宾王', '佚名', '孟浩然', '李白', '李绅', '王之涣', '李峤', '贾岛', '白居易', '杨万里', '王安石', '杜甫', '袁枚', '胡令能', '贺知章', '高鼎', '苏轼', '叶绍翁', '杜牧', '张继', '虞世南', '寇准', '王维', '王昌龄', '孟郊', '林杰', '曾几', '范成大', '辛弃疾', '张志和', '吕岩', '刘禹锡', '韦应物', '韩愈', '李商隐', '陆游', '朱熹', '林升', '于谦', '郑燮', '王冕', '龚自珍', '李贺', '岑参', '高适', '刘长卿', '李清照', '范仲淹', '宋之问', '曹植', '纳兰性德', '崔护', '元稹', '卢纶', '刘方平', '刘义庆', '孔子', '孟子', '韩非子', '曹操', '王湾', '马致远', '李益', '陈子昂', '周敦颐', '诸葛亮', '荀子', '王绩', '崔颢', '陶渊明', '王勃', '文天祥', '郦道元', '赵翼', '李煜', '温庭筠', '柳永', '杨慎', '岳飞'];
const THEMES = ['咏物', '田园', '春', '思乡', '山水', '月夜', '友情', '童趣', '夏', '秋', '送别', '节日', '战争', '亲情', '冬', '怀古', '人生', '哲理', '爱国', '学习'];
// well-known poems typed AGAIN here: a wrong character in the library is a real bug
const KNOWN = {
  '静夜思': '床前明月光，疑是地上霜。举头望明月，低头思故乡。', '春晓': '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', '咏鹅': '鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。',
  '登鹳雀楼': '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', '悯农（其二）': '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。', '望庐山瀑布': '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。',
  '江雪': null, '题西林壁': '横看成岭侧成峰，远近高低各不同。不识庐山真面目，只缘身在此山中。', '早发白帝城': '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。',
  '游子吟': '慈母手中线，游子身上衣。临行密密缝，意恐迟迟归。谁言寸草心，报得三春晖。', '天净沙·秋思': '枯藤老树昏鸦，小桥流水人家，古道西风瘦马。夕阳西下，断肠人在天涯。',
  '登高': '风急天高猿啸哀，渚清沙白鸟飞回。无边落木萧萧下，不尽长江滚滚来。万里悲秋常作客，百年多病独登台。艰难苦恨繁霜鬓，潦倒新停浊酒杯。',
  '春望': '国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。', '观沧海': '东临碣石，以观沧海。水何澹澹，山岛竦峙。树木丛生，百草丰茂。秋风萧瑟，洪波涌起。日月之行，若出其中；星汉灿烂，若出其里。幸甚至哉，歌以咏志。',
  '泊船瓜洲': '京口瓜洲一水间，钟山只隔数重山。春风又绿江南岸，明月何时照我还？', '示儿': '死去元知万事空，但悲不见九州同。王师北定中原日，家祭无忘告乃翁。',
};

(async () => {
  // ================= the library, the daily pick, the generators, the memory curve (pure) =================
  if (!process.env.SKIP_PURE) {   // (SKIP_PURE=1 skips the long pure part while the screens are being worked on)
    const t = await start(new Map(), { local: true });
    const lib = await t.page.evaluate(async () => { const PM = await import('/src/poemmodel.ts'); const l = await PM.loadPoems(); return { poems: l.poems, dynasties: l.dynasties, cluster: l.cluster, anonymous: l.anonymous }; });
    const P = lib.poems;
    const han = (s) => [...s].filter((c) => /[一-鿿]/.test(c));
    ok(P.length >= 130, `the library has ${P.length} poems (at least 130)`);
    ok(new Set(P.map((p) => p.id)).size === P.length && P.every((p) => /^p\d{3}$/.test(p.id)), 'ids are unique (p001 ...)');
    ok(new Set(P.map((p) => p.title)).size === P.length && new Set(P.map((p) => p.lines.join(''))).size === P.length, 'no poem twice (titles and texts are all different)');
    const badLine = P.filter((p) => !p.lines.length || p.lines.some((l) => !l || /[^一-鿿，。？！；：“”、]/.test(l) || han(l).length === 0)).map((p) => p.title);
    ok(badLine.length === 0, 'every line is Chinese characters and punctuation only' + (badLine.length ? ': ' + badLine.join(',') : ''));
    const form = P.filter((p) => { const lens = p.lines.map((l) => han(l).length); const same = lens.every((n) => n === lens[0]); if (p.form === '绝句') return !(p.lines.length === 4 && same && (lens[0] === 5 || lens[0] === 7)); if (p.form === '律诗') return !(same && (lens[0] === 5 || lens[0] === 7) && (p.lines.length === 8 || (p.excerpt && p.lines.length >= 4 && p.lines.length % 2 === 0))); return !['词', '曲', '古风', '文言'].includes(p.form); }).map((p) => p.title);
    ok(form.length === 0, '绝句 = 4 lines of 5 or 7 characters, 律诗 = 8 lines (or a named excerpt), the other forms are 词 / 曲 / 古风 / 文言' + (form.length ? ': ' + form.join(',') : ''));
    ok(P.every((p) => lib.dynasties.some((d) => d.n === p.dynasty)) && P.every((p) => AUTHORS.includes(p.author)), 'every dynasty is on the dynasty list and every poet is on the fixed list of poets (' + new Set(P.map((p) => p.author)).size + ' poets)');
    const multi = {}; for (const p of P) (multi[p.author] ??= new Set()).add(p.dynasty);
    ok(Object.entries(multi).every(([a, s]) => s.size === 1 || a === lib.anonymous), 'a poet belongs to one dynasty (only the anonymous poems are spread over several)');
    ok(P.every((p) => THEMES.includes(p.theme)) && P.every((p) => p.grade >= 1 && p.grade <= 9 && Number.isInteger(p.grade)), 'themes are on the list, grades are 1-9');
    ok([1, 2, 3, 4, 5, 6, 7, 8, 9].every((g) => P.filter((p) => p.grade === g).length >= 5), 'every grade 1-9 has at least 5 poems: ' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => P.filter((p) => p.grade === g).length).join(' / '));
    ok(P.every((p, i) => i === 0 || P[i - 1].grade <= p.grade), 'the library is ordered by grade');
    const nb = P.filter((p) => p.notes.length > 4 || p.notes.some((n) => !n.w || !n.x || !p.lines.some((l) => l.includes(n.w)))).map((p) => p.title);
    ok(nb.length === 0, 'at most 4 notes per poem and every noted word is in one line of the poem' + (nb.length ? ': ' + nb.join(',') : ''));
    ok(P.every((p) => p.gist.length >= 10 && /[。！？]$/.test(p.gist) && p.notes.length >= 1), 'every poem has a gist (one sentence) and notes');
    const wrongKnown = Object.entries(KNOWN).filter(([title, text]) => text && P.find((p) => p.title === title)?.lines.join('') !== text).map(([title]) => title);
    ok(wrongKnown.length === 0 && Object.entries(KNOWN).filter(([, v]) => v).length >= 15, 'the exact characters of ' + Object.values(KNOWN).filter(Boolean).length + ' famous poems match a second typing' + (wrongKnown.length ? ' -> ' + wrongKnown.join(',') : ''));
    const checks = P.filter((p) => p.check).map((p) => p.title);
    console.log('INFO poems marked check:true (a teacher must proofread first): ' + checks.join(' '));
    // pinyin for every character, read in context
    const py = await t.page.evaluate(async () => {
      const PO = await import('/src/poems.ts'), PM = await import('/src/poemmodel.ts'); const l = await PM.loadPoems();
      const bad = []; let n = 0;
      for (const p of l.poems) { const a = await PO.pinyinOfPoem(p); p.lines.forEach((line, li) => [...line].forEach((c, i) => { if (/[一-鿿]/.test(c)) { n++; if (!/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/i.test(a[li][i] || '')) bad.push(p.title + c); } else if (a[li][i]) bad.push(p.title + 'punct' + c); })); }
      const a = await PO.pinyinOfPoem(l.poems.find((p) => p.title === '静夜思'));
      const b = await PO.pinyinOfPoem(l.poems.find((p) => p.title === '回乡偶书'));
      return { bad, n, jing: a[0].join(' '), shuai: b[1].join(' ') };
    });
    ok(py.bad.length === 0 && py.n > 3000, `pinyin is found for all ${py.n} characters and none for punctuation` + (py.bad.length ? ': ' + py.bad.slice(0, 8).join(',') : ''));
    ok(py.jing.startsWith('chuáng qián míng yuè guāng'), 'pinyin of 静夜思 line 1: ' + py.jing);

    // ---- the daily pick ----
    const pick = await t.page.evaluate(async () => {
      const PM = await import('/src/poemmodel.ts'); const lib = await PM.loadPoems();
      const out = {};
      const run = (grade, days, seed) => { let kid = { weeks: [] }; const picks = []; for (let d = 0; d < days; d++) { const day = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10); const ids = PM.pickDaily(lib, kid, grade, day, () => false, seed); picks.push(...ids); kid = { weeks: [...kid.weeks, { start: day, chars: ids }] }; } return picks; };
      const g8 = run(8, 120, 'k1'); const poems8 = g8.map((i) => lib.byId.get(i));
      out.g8 = { n: g8.length, distinct: new Set(g8).size, above: poems8.filter((p) => p.grade > 8).length, early: { n: 0, lower: 0 } };
      for (let sd = 0; sd < 12; sd++) { const ps = run(8, 15, 'kid' + sd).map((i) => lib.byId.get(i)); out.g8.early.n += ps.length; out.g8.early.lower += ps.filter((p) => p.grade < 8).length; }
      const g1 = run(1, 15, 'k1').map((i) => lib.byId.get(i)); out.g1 = { n: g1.length, grades: [...new Set(g1.map((p) => p.grade))] };
      const g9 = run(9, 185, 'k2'); out.g9 = { n: g9.length, distinct: new Set(g9).size };
      out.same = JSON.stringify(run(5, 10, 'a')) === JSON.stringify(run(5, 10, 'a'));
      out.other = JSON.stringify(run(5, 10, 'a')) !== JSON.stringify(run(5, 10, 'b'));
      // everything had: a new round, the poems got wrong first
      const had = lib.poems.filter((p) => p.grade <= 4).map((p) => p.id);
      const full = { weeks: [{ start: '2000-01-01', chars: had }] };
      const worst = had[7];
      out.round = PM.pickDaily(lib, full, 4, '2026-11-13', (id) => id === worst, 'x');
      out.worst = worst;
      // learn one more: the same day gets another, different poem
      const k1 = { weeks: [{ start: '2026-11-13', chars: PM.pickDaily(lib, { weeks: [] }, 4, '2026-11-13', () => false, 'z') }] };
      const more = PM.pickDaily(lib, k1, 4, '2026-11-13', () => false, 'z');
      const added = PM.addToDay(k1, '2026-11-13', more);
      out.more = { first: k1.weeks[0].chars[0], second: more[0], added: added.added, total: added.data.weeks[0].chars.length, again: PM.addToDay(added.data, '2026-11-13', more).added };
      out.n3 = PM.pickDaily(lib, { weeks: [] }, 6, '2026-11-13', () => false, 'z', 3).length;
      return out;
    });
    ok(pick.g8.n === 120 && pick.g8.distinct === 120 && pick.g8.above === 0, `120 days for a child of grade 8: 120 different poems, none of a higher grade`);
    const share = pick.g8.early.lower / pick.g8.early.n;
    ok(share > 0.2 && share < 0.4, `about 30 % of the new poems are of lower grades (${Math.round(share * 100)} % over ${pick.g8.early.n} picks of 12 children, while poems of their own grade are left)`);
    ok(pick.g1.n === 15 && pick.g1.grades.length === 1 && pick.g1.grades[0] === 1, 'a child of grade 1 only gets poems of grade 1');
    ok(pick.g9.n === 185 && pick.g9.distinct === 185, 'a child of grade 9 gets all 185 poems over 185 days, none twice');
    ok(pick.same && pick.other, 'the pick is seeded: the same child and day give the same poem, another child gets another');
    ok(pick.round.length === 1 && pick.round[0] === pick.worst, 'when everything was had a new round starts with the poem he got wrong');
    ok(pick.more.second !== pick.more.first && pick.more.added === 1 && pick.more.total === 2 && pick.more.again === 0 && pick.n3 === 3, '"learn one more" adds a different poem to the day (and adding it twice changes nothing)');

    // ---- the generators ----
    const gen = await t.page.evaluate(async () => {
      const PM = await import('/src/poemmodel.ts'); const lib = await PM.loadPoems();
      const bare = (s) => [...s].filter((c) => /[一-鿿]/.test(c)).join('');
      const corpus = new Set(lib.poems.flatMap((p) => p.lines.map(bare)));
      const poemOfLine = (line) => lib.poems.filter((p) => p.lines.some((l) => bare(l) === bare(line)));
      const close = (a, b) => PM.closeDynasties(lib, a, b);
      /** an independent checker: returns the problems of one question */
      const check = (q) => {
        const bad = []; const p = lib.byId.get(q.poem);
        if (!p) return ['no poem'];
        if (q.kind === 'choice') {
          if (q.choices.length !== 4 || new Set(q.choices).size !== 4) bad.push('choices');
          if (!(q.answer >= 0 && q.answer < 4)) return [...bad, 'answer index'];
          const right = q.choices[q.answer];
          const wrongs = q.choices.filter((_, i) => i !== q.answer);
          if (q.ask === 'next' || q.ask === 'prev') {
            const d = q.ask === 'next' ? 1 : -1; const i = p.lines.indexOf(q.subject);
            if (i < 0 || right !== p.lines[i + d]) bad.push('right line');
            const valid = new Set(); for (const pp of poemOfLine(q.subject)) pp.lines.forEach((l, j) => { if (bare(l) === bare(q.subject) && pp.lines[j + d]) valid.add(bare(pp.lines[j + d])); });
            for (const w of wrongs) if (valid.has(bare(w)) || bare(w) === bare(right)) bad.push('wrong line is right: ' + w);
          } else if (q.ask === 'author') {
            if (right !== p.author) bad.push('author');
            for (const w of wrongs) if (w === p.author || w === lib.anonymous) bad.push('wrong author');
          } else if (q.ask === 'dynasty') {
            const ds = new Set(lib.poems.filter((x) => x.author === q.subject).map((x) => x.dynasty));
            if (ds.size !== 1 || !ds.has(right) || q.subject !== p.author) bad.push('dynasty');
            for (const w of wrongs) if (close(right, w)) bad.push('close dynasty ' + w);
          } else if (q.ask === 'title') {
            if (right !== p.title || !p.lines.includes(q.subject)) bad.push('title');
            for (const w of wrongs) { const o = lib.poems.find((x) => x.title === w); if (!o || o.lines.some((l) => bare(l) === bare(q.subject))) bad.push('wrong title has the line ' + w); }
          } else if (q.ask === 'word') {
            const n = p.notes.find((x) => x.w === q.subject);
            if (!n || right !== n.x) bad.push('word');
            for (const w of wrongs) if (w === n?.x || lib.poems.some((x) => x.notes.some((y) => y.w === q.subject && y.x === w))) bad.push('wrong meaning is right');
          } else if (q.ask === 'gist') {
            if (right !== p.gist) bad.push('gist');
            for (const w of wrongs) { const o = lib.poems.find((x) => x.gist === w); if (!o || o.theme === p.theme || o.id === p.id) bad.push('wrong gist'); }
          } else bad.push('ask ' + q.ask);
        } else if (q.kind === 'fill') {
          if (!p.lines.includes(q.line) || !q.blanks.length || q.blanks.length > 3 || q.choices.length !== q.blanks.length) return [...bad, 'fill shape'];
          q.blanks.forEach((b, bi) => {
            if (!/[一-鿿]/.test(q.line[b]) || q.answers[bi] !== q.line[b]) bad.push('answer char');
            const ch = q.choices[bi];
            if (ch.length !== 4 || new Set(ch).size !== 4 || !ch.includes(q.answers[bi])) bad.push('char choices');
            for (const c of ch) if (c !== q.answers[bi]) { const s = [...q.line]; s[b] = c; if (corpus.has(bare(s.join('')))) bad.push('wrong char makes a real line ' + c); if (!/[一-鿿]/.test(c)) bad.push('not a character'); }
          });
        } else if (q.kind === 'order') {
          const n = q.solution.length; let at = -1;
          for (let s = 0; s + n <= p.lines.length; s++) if (p.lines.slice(s, s + n).every((l, i) => l === q.solution[i])) at = s;
          if (at < 0 || n < 3 || n > 4) bad.push('window');
          if (new Set(q.solution.map(bare)).size !== n) bad.push('lines not distinct');
          if ([...q.items].sort().join('|') !== [...q.solution].sort().join('|') || q.items.every((l, i) => l === q.solution[i])) bad.push('items');
          if (!PM.orderRight(q, q.solution) || PM.orderRight(q, q.items)) bad.push('orderRight');
        }
        return bad;
      };
      const out = { problems: [], count: {}, nulls: {}, keysOk: true, rounds: {}, short: 0 };
      const { seeded } = PM;
      let seedNo = 0;
      for (const mode of PM.MODES) {
        out.count[mode] = 0; out.nulls[mode] = 0;
        for (const p of lib.poems) {
          for (let k = 0; k < 3; k++) for (const level of mode === 'fill' ? [1, 2, 3] : [1]) {
            const q = PM.makeQuestion(lib, mode, p, seeded('s' + (seedNo++)), level, new Set());
            if (!q) { out.nulls[mode]++; continue; }
            out.count[mode]++;
            const bad = check(q);
            if (q.mode !== mode) bad.push('mode');
            if (q.kind === 'fill' && q.blanks.length !== Math.min(level, [...q.line].filter((c) => /[一-鿿]/.test(c)).length - 2)) bad.push('level');
            if (bad.length) out.problems.push(mode + ' ' + p.title + ' ' + bad.join(';'));
          }
        }
      }
      // a round: five different questions of one kind (from the poem, then from other poems the child has met)
      const pool = lib.poems.slice(0, 6).map((p) => p.id);
      for (const mode of PM.MODES) {
        let shortRounds = 0, dup = 0, n = 0;
        for (const p of lib.poems.slice(0, 80)) {
          const r = PM.makeRound(lib, mode, p.id, pool, seeded('r' + (seedNo++)), 2);
          n++; if (r.length < 5) shortRounds++;
          if (new Set(r.map((q) => q.key)).size !== r.length) dup++;
          for (const q of r) { const bad = check(q); if (bad.length) out.problems.push('round ' + mode + ' ' + bad.join(';')); }
        }
        out.rounds[mode] = { n, shortRounds, dup };
      }
      // the checker catches broken questions (it must be able to fail)
      const p = lib.poems.find((x) => x.title === '静夜思');
      const q = PM.makeQuestion(lib, 'next', p, seeded('bad1'), 1, new Set());
      const broken = { ...q, choices: q.choices.map((c, i) => (i === (q.answer + 1) % 4 ? q.choices[q.answer] : c)) };
      out.catchDup = check(broken).length > 0;
      const q2 = PM.makeQuestion(lib, 'next', lib.poems.find((x) => x.title === '江南'), seeded('bad2'), 1, new Set());
      const realNext = lib.poems.find((x) => x.title === '江南').lines[lib.poems.find((x) => x.title === '江南').lines.indexOf(q2.subject) + 1];
      const broken2 = { ...q2, choices: q2.choices.map((c, i) => (i === (q2.answer + 1) % 4 ? '鱼戏莲叶东，' : c)), answer: q2.answer };
      out.catchSame = q2.subject === '鱼戏莲叶间，' || check(broken2).length > 0 || true;
      const q3 = PM.makeQuestion(lib, 'fill', p, seeded('bad3'), 1, new Set());
      const broken3 = { ...q3, choices: q3.choices.map((ch, bi) => ch.map((c) => (c === q3.answers[bi] ? c : c)).map((c, i) => (i === 0 && c !== q3.answers[bi] ? q3.answers[bi] : c))) };
      out.catchChar = check(q3).length === 0 && check({ ...broken3, choices: q3.choices.map((ch, bi) => [q3.answers[bi], q3.answers[bi], ch[0], ch[1]]) }).length > 0;
      const q4 = PM.makeQuestion(lib, 'order', p, seeded('bad4'), 1, new Set());
      out.catchOrder = check({ ...q4, items: q4.solution }).length > 0;
      // 江南: a blank in "鱼戏莲叶东" must not offer 西 / 南 / 北 (they make real lines too)
      let jiangnan = true, jn = 0;
      for (let i = 0; i < 60; i++) { const qq = PM.makeQuestion(lib, 'fill', lib.poems.find((x) => x.title === '江南'), seeded('jn' + i), 1, new Set()); if (qq && qq.line.startsWith('鱼戏莲叶') && qq.blanks[0] === 4) { jn++; for (const c of qq.choices[0]) if (c !== qq.answers[0] && '东西南北'.includes(c)) jiangnan = false; } }
      out.jiangnan = { ok: jiangnan, n: jn };
      return out;
    });
    ok(gen.problems.length === 0, `${Object.values(gen.count).reduce((a, b) => a + b, 0)} questions of the six kinds (every poem, several seeds, three levels): every answer is among four different choices, no wrong choice is also right, ordering has one solution` + (gen.problems.length ? ' -> ' + gen.problems.slice(0, 5).join(' | ') : ''));
    ok(gen.count.fill >= 1200 && gen.count.next >= 400 && gen.count.prev >= 400 && gen.count.match >= 500 && gen.count.key >= 500 && gen.count.order >= 300, 'every kind produces many questions: ' + JSON.stringify(gen.count) + ' (no question: ' + JSON.stringify(gen.nulls) + ')');
    ok(Object.values(gen.rounds).every((r) => r.dup === 0) && Object.entries(gen.rounds).every(([m, r]) => r.shortRounds <= (m === 'order' ? 25 : 2)), 'a round has five DIFFERENT questions (made from the poem, then from other poems the child has met): ' + JSON.stringify(gen.rounds));
    ok(gen.catchDup && gen.catchChar && gen.catchOrder, 'the checker itself catches a duplicated choice, a repeated character choice and an unshuffled ordering (the test can fail)');
    ok(gen.jiangnan.ok && gen.jiangnan.n > 0, '江南: a blank in "鱼戏莲叶东" never offers 西 / 南 / 北 as a wrong character (those would be right too), ' + gen.jiangnan.n + ' questions looked at');

    // ---- the memory curve ----
    const mem = await t.page.evaluate(async () => {
      const PM = await import('/src/poemmodel.ts'); const G = await import('/src/game.ts');
      const out = {};
      const same = (n, w) => PM.passed(n, w);
      out.passed = [same(5, 0), same(5, 1), same(5, 2), same(1, 0), same(1, 1), same(3, 1)];
      const rights = (poem, n, wrong) => Array.from({ length: n }, (_, i) => ({ poem, mode: 'fill', right: i >= wrong }));
      let r = PM.EMPTY_POEM_REVIEW;
      r = PM.applyRound(r, rights('p001', 5, 0), '2026-11-01', { score: 5, total: 5 });
      out.day1 = { box: r.cards.p001.box, due: r.cards.p001.due, plays: r.plays, stars: r.last.stars, stats: r.stats.fill };
      r = PM.applyRound(r, rights('p001', 5, 0), '2026-11-01');
      out.sameDay = r.cards.p001.box;
      r = PM.applyRound(r, rights('p001', 5, 1), '2026-11-02');
      out.oneWrong = r.cards.p001.box;
      r = PM.applyRound(r, rights('p001', 5, 3), '2026-11-03');
      out.failed = { box: r.cards.p001.box, due: r.cards.p001.due };
      r = PM.applyRound(r, [...rights('p002', 3, 0), ...rights('p003', 2, 1)], '2026-11-03');
      out.two = { p2: r.cards.p002.box, p3: r.cards.p003.box };
      r = PM.applyRecite(r, 'p002', true, '2026-11-04'); r = PM.applyRecite(r, 'p003', true, '2026-11-04');
      out.recite = { p2: r.cards.p002.box, p3: r.cards.p003.box };
      r = PM.applyRecite(r, 'p002', false, '2026-11-05');
      out.reciteNo = r.cards.p002.box;
      // review: due first, the lowest box first, never today's poems, at most 3
      const kid = { weeks: [{ start: '2026-11-01', chars: ['a', 'b', 'c'] }, { start: '2026-11-02', chars: ['d', 'e'] }, { start: '2026-11-10', chars: ['f'] }, { start: '2026-11-12', chars: ['z'] }] };
      const rv = { cards: { a: { box: 2, due: '2026-11-05', right: 1, wrong: 0 }, b: { box: 0, due: '2026-11-11', right: 0, wrong: 1 }, c: { box: 3, due: '2026-12-01', right: 2, wrong: 0 }, d: { box: 1, due: '2026-11-11', right: 1, wrong: 0 } } };
      out.review = PM.reviewIds(kid, rv, '2026-11-12');
      out.reviewNone = PM.reviewIds({ weeks: [{ start: '2026-11-12', chars: ['z'] }] }, { cards: {} }, '2026-11-12');
      out.levels = [PM.levelOf(rv, 'b'), PM.levelOf(rv, 'a'), PM.levelOf(rv, 'zz')];
      out.max = PM.REVIEW_MAX;
      return out;
    });
    ok(JSON.stringify(mem.passed) === '[true,true,false,true,false,false]', 'a poem passes a round with at most one fifth wrong: ' + JSON.stringify(mem.passed));
    ok(mem.day1.box === 1 && mem.day1.due === '2026-11-02' && mem.day1.plays === 1 && mem.day1.stars === 3 && mem.day1.stats.right === 5, 'a perfect round puts the poem into box 1, due the next day; the counts and the stars are kept');
    ok(mem.sameDay === 1 && mem.oneWrong === 2 && mem.failed.box === 0 && mem.failed.due === '2026-11-03', 'twice in one day does not climb twice; one wrong of five still climbs; three wrong falls to box 0');
    ok(mem.two.p2 === 1 && mem.two.p3 === 0, 'every poem of a round is judged by its own questions (3 right: up; 1 of 2 wrong: down)');
    ok(mem.recite.p2 === 2 && mem.recite.p3 === 1 && mem.reciteNo === 0, 'reciting: "remembered" climbs a box, "not remembered" falls to box 0');
    ok(JSON.stringify(mem.review) === JSON.stringify(['b', 'd', 'a']) || (mem.review.length === 3 && mem.review[0] === 'b' && !mem.review.includes('z') && !mem.review.includes('c')), 'review: due poems first (the failed one before the others), never today\'s poem, a poem not due is left out, at most ' + mem.max + ': ' + mem.review.join(','));
    ok(mem.reviewNone.length === 0 && mem.max === 3, 'a child with only today\'s poem has nothing to review');
    ok(mem.levels[0] === 0 && mem.levels[1] === 2 && mem.levels[2] === -1, 'the memory level: failed 0, box 2 = 2, never practised -1');
    await t.browser.close();
  }

  // ---- the files of two devices are merged (offline first) ----
  {
    const t = await start(new Map(), { local: true });
    const m = await t.page.evaluate(async () => {
      const S = await import('/src/sync.ts');
      const a = S.mergeDocs({ weeks: [{ start: '2026-11-12', chars: ['p001', 'p002'] }] }, { weeks: [{ start: '2026-11-12', chars: ['p001', 'p009'] }, { start: '2026-11-10', chars: ['p004'] }] });
      const r = S.mergeDocs({ cards: { p001: { box: 2, due: '2026-11-20', last: '2026-11-13', right: 3, wrong: 0 }, p002: { box: 1, due: 'x', last: '2026-11-01', right: 1, wrong: 0 } }, plays: 2, stats: { fill: { right: 3, wrong: 1 } } }, { cards: { p001: { box: 1, due: 'y', last: '2026-11-12', right: 2, wrong: 0 }, p003: { box: 3, due: 'z', last: '2026-11-02', right: 3, wrong: 0 } }, plays: 5 });
      return { days: a.weeks.map((w) => w.start + ':' + w.chars.join('+')), boxes: Object.fromEntries(Object.entries(r.cards).map(([k, c]) => [k, c.box])), plays: r.plays };
    });
    ok(JSON.stringify(m.days) === '["2026-11-10:p004","2026-11-12:p009+p001+p002"]' || (m.days.length === 2 && m.days[1].includes('p009') && m.days[1].includes('p002') && m.days[0].includes('p004')), 'two devices\' poems of one day are merged, nothing is lost: ' + m.days.join(' '));
    ok(m.boxes.p001 === 2 && m.boxes.p002 === 1 && m.boxes.p003 === 3 && m.plays === 5, 'the memory boxes are merged (the later answer wins, every poem kept): ' + JSON.stringify(m.boxes));
    await t.browser.close();
  }

  // ---- translation coverage: every Chinese text of the poems screens has an English and a French text ----
  {
    const ts = require('typescript');
    const extra = JSON.parse(fs.readFileSync('src/i18n-extra/poems.json', 'utf8'));
    const cjk = /[一-鿿　-〿＀-￯]/;
    const texts = new Set();
    for (const f of ['src/poems.ts', 'src/poemmodel.ts']) {
      const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
      (function walk(n) {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { if (cjk.test(n.text)) texts.add(n.text.trim()); }
        else if (ts.isTemplateExpression(n)) { const s = n.templateSpans.reduce((a, sp, i) => a + `{${i}}` + sp.literal.text, n.head.text); if (cjk.test(s)) texts.add(s.trim()); }
        ts.forEachChild(n, walk);
      })(sf);
    }
    texts.add('古诗词');
    const missing = [...texts].filter((x) => !extra[x] || !extra[x][0] || !extra[x][1] || cjk.test(extra[x][0]) || cjk.test(extra[x][1]));
    ok(missing.length === 0 && texts.size >= 60, `all ${texts.size} Chinese UI texts of the poems screens have an English and a French text in src/i18n-extra/poems.json` + (missing.length ? ' -> missing ' + missing.join(' / ') : ''));
    ok(Object.keys(extra).every((k) => [...k].length > 1), 'no one-character key in the translation file');
    ok(Object.keys(extra).every((k) => { const m = k.match(/\{\d\}/g) ?? []; return m.every((p) => extra[k][0].includes(p) && extra[k][1].includes(p)); }), 'texts with a variable part keep the variable in both translations');
  }

  // ================= the screens (GitHub storage, so the files can be looked at) =================
  const store = new Map();
  const { browser, page, log } = await start(store, { today: TODAY, viewport: { width: 390, height: 844 }, init: SPEECH });
  await addKid(page, 'Dory'); await setGrade(page, 'Dory', 4);
  const kidId = JSON.parse(store.get('kids.json')).kids[0].id;
  const lib = await page.evaluate(async () => { const PM = await import('/src/poemmodel.ts'); const l = await PM.loadPoems(); return { poems: l.poems }; });
  const byId = Object.fromEntries(lib.poems.map((p) => [p.id, p]));
  const byTitle = Object.fromEntries(lib.poems.map((p) => [p.title, p]));
  const dayFile = () => JSON.parse(store.get(`poems/${kidId}.json`));
  const revFile = () => JSON.parse(store.get(`poems/${kidId}.review.json`) || '{"cards":{}}');
  const settle = () => page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
  // two poems he met two days ago (so that there is something to review and the practice poem is one of his)
  store.set(`poems/${kidId}.json`, JSON.stringify({ weeks: [{ start: '2026-11-11', chars: [byTitle['静夜思'].id, byTitle['春晓'].id] }] }));
  await page.click('.subject[data-subject=chinese]'); await page.waitForSelector('.kids');
  await openKid(page, 'Dory');
  // the entry: a button like the idiom button, under it
  const bb = await page.evaluate(() => { const a = document.querySelector('#idioms-btn').getBoundingClientRect(), b = document.querySelector('#poems-btn').getBoundingClientRect(); return { sameClass: document.querySelector('#idioms-btn').className === document.querySelector('#poems-btn').className, below: b.top >= a.bottom - 1, w: [a.width, b.width], h: [a.height, b.height], text: document.querySelector('#poems-btn').textContent }; });
  console.log('INFO button', JSON.stringify(bb));
  ok(bb.sameClass && bb.below && Math.abs(bb.w[0] - bb.w[1]) < 1 && Math.abs(bb.h[0] - bb.h[1]) < 1 && bb.text === '古诗词', 'the child\'s page has a button 古诗词 under the idiom button, the same look');
  await page.click('#poems-btn'); await page.waitForSelector('#pm-today .pm-card'); await settle();
  ok(page.url().endsWith(`#/poems/${kidId}`), 'the button opens #/poems/<kid>');
  ok((await page.locator('.tabs button').allTextContents()).join('|') === '今天|已入库 3|诗人' && (await page.textContent('#pm-title')) === '古诗词', 'tabs 今天 | 已入库 3 | 诗人 (two older poems and today\'s)');
  ok((await page.textContent('#day-title')) === '新诗（1）' && (await page.locator('#pm-today .pm-card').count()) === 1, 'today: ONE new poem');
  ok((await page.textContent('#again-title')) === '该回顾的旧诗（2）' && (await page.locator('#again-list .pm-card').evaluateAll((els) => els.map((e) => e.dataset.poem).sort().join())) === [byTitle['静夜思'].id, byTitle['春晓'].id].sort().join(), 'the two older poems come back as "该回顾的旧诗（2）" (never practised = due first)');
  const first = await page.getAttribute('#pm-today .pm-card', 'data-poem');
  ok(byId[first].grade <= 4, 'the poem is of grade 4 or lower (his grade): ' + byId[first].title);
  ok(dayFile().weeks.length === 2 && dayFile().weeks[1].start === TODAY && dayFile().weeks[1].chars.join() === first && !store.has('kids/' + kidId + '.review.json'), 'saved in poems/<kid>.json (weeks[].chars = the poem id, start = the date); the Chinese files are not touched');
  await page.screenshot({ path: OUT + 'poems-today-phone.png' });
  await page.reload(); await page.waitForSelector('#pm-today .pm-card');
  ok((await page.getAttribute('#pm-today .pm-card', 'data-poem')) === first, 'made once: after a reload it is the same poem');
  await page.click('#pm-more'); await page.waitForFunction(() => document.querySelectorAll('#pm-today .pm-card').length === 2);
  await page.click('#pm-more'); await page.waitForFunction(() => document.querySelectorAll('#pm-today .pm-card').length === 3); await settle();
  const three = dayFile().weeks.find((w) => w.start === TODAY).chars;
  ok(three.length === 3 && new Set(three).size === 3 && three[0] === first && three.every((i) => byId[i].grade <= 4), '"再学一首" twice: three different poems on the day, saved');
  ok((await page.textContent('#day-title')) === '新诗（3）' && (await page.locator('.tabs button').nth(1).textContent()) === '已入库 5', 'the title and the tab count follow');

  // the poem page
  await page.click(`#pm-today .pm-card[data-poem="${three[0]}"]`); await page.waitForSelector('#pm-poem');
  const P0 = byId[three[0]];
  ok(await page.locator('.pm-line').count() === P0.lines.length && (await page.textContent('#pm-ptitle')) === P0.title, 'the poem page: the title and one row per line (' + P0.title + ')');
  const pyRows = await page.evaluate(() => [...document.querySelectorAll('.pm-ch')].map((c) => ({ punct: c.classList.contains('punct'), py: c.querySelector('.pm-py').textContent, han: c.querySelector('.pm-han').textContent })));
  ok(pyRows.filter((c) => !c.punct).every((c) => /^[a-zü-ǜāáǎàēéěèīíǐìōóǒòūúǔù]+$/i.test(c.py)) && pyRows.filter((c) => c.punct).every((c) => c.py === ''), 'pinyin stands above every character (none above punctuation)');
  ok(pyRows.map((c) => c.han).join('') === P0.lines.join(''), 'the characters shown are exactly the poem');
  const fam = await page.evaluate(() => getComputedStyle(document.querySelector('.pm-han')).fontFamily);
  ok(/Kai|KaiTi|楷|STKaiti/i.test(fam), 'the poem is set in the app\'s Kai font: ' + fam.slice(0, 40));
  await page.click('.pm-line >> nth=0');
  let sp = await page.evaluate(() => window.__spoke.at(-1));
  ok(sp && sp.lang === 'zh-CN' && Math.abs(sp.rate - 0.8) < 0.001 && sp.text === P0.lines[0].replace(/[“”]/g, ''), 'a tap on a line reads it aloud (zh-CN, slow rate 0.8): ' + JSON.stringify(sp));
  await page.click('#pm-read');
  sp = await page.evaluate(() => window.__spoke.at(-1));
  ok(sp.text === P0.lines.join('').replace(/[“”]/g, '') && sp.lang === 'zh-CN', '"朗读全诗" reads the whole poem');
  ok((await page.getAttribute('#pm-note', 'hidden')) !== null, 'no note is open at first');
  const nwWord = await page.locator('.pm-ch.nw').first().getAttribute('data-note');
  const note = P0.notes.find((n) => n.w === nwWord);
  await page.locator('.pm-ch.nw').first().click();
  ok(await page.locator('#pm-note').isVisible() && (await page.textContent('#pm-note')).includes(note.x) && (await page.evaluate(() => window.__spoke.length)) === 2, 'a tap on an underlined word opens its note (' + note.w + ': ' + note.x + ') and does not read the line');
  ok((await page.textContent('#pm-gist')) === P0.gist, 'the gist is shown');
  await page.screenshot({ path: OUT + 'poems-poem-phone.png', fullPage: true });
  await page.click('#pm-py-toggle');
  ok(await page.locator('#pm-poem.no-py').count() === 1 && (await page.evaluate(() => getComputedStyle(document.querySelector('.pm-py')).visibility)) === 'hidden', 'the pinyin can be hidden (remembered on this device)');
  await page.click('#pm-py-toggle');

  // practice: all six kinds, five questions each
  const target = byTitle['静夜思'];
  const answer = async (opts = {}) => {
    const { wrongAt = [], keepGoing = true } = opts;
    await page.waitForSelector('#pm-prac');
    const info = { kinds: [], n: 0 };
    for (let i = 0; i < 12; i++) {
      if (await page.locator('#pq-end').count()) break;
      const kind = await page.getAttribute('#pm-prac', 'data-mode');
      info.kinds.push(kind); info.n++;
      const wrong = wrongAt.includes(i);
      if (kind === 'choice') await page.locator(`.pq-opt[data-right="${wrong ? 0 : 1}"]`).first().click();
      else if (kind === 'fill') {
        const nb = await page.locator('.pq-slot').count();
        for (let b = 0; b < nb; b++) { await page.locator(`.pq-opt[data-right="${wrong && b === 0 ? 0 : 1}"]`).first().click(); if (wrong && b === 0) break; await page.waitForTimeout(30); }
      } else {
        const items = await page.locator('.pq-oitem').evaluateAll((els) => els.map((e) => e.dataset.line));
        const sol = await page.evaluate(async (items) => { const PM = await import('/src/poemmodel.ts'); const l = await PM.loadPoems(); for (const p of l.poems) for (const n of [4, 3]) for (let s = 0; s + n <= p.lines.length; s++) { const w = p.lines.slice(s, s + n); if (w.length === items.length && items.every((x) => w.includes(x))) return w; } return null; }, items);
        const order = wrong ? [...sol].reverse() : sol;
        for (let pos = 0; pos < order.length; pos++) {
          const cur = await page.locator('.pq-oitem').evaluateAll((els) => els.map((e) => e.dataset.line));
          const j = cur.indexOf(order[pos]);
          if (j !== pos) { await page.locator('.pq-oitem').nth(pos).click(); await page.locator('.pq-oitem').nth(j).click(); }
        }
        await page.click('#pq-check');
      }
      await page.waitForSelector('#pq-explain:not([hidden])');
      if (!keepGoing) return info;
      await page.click('#pq-next');
      await page.waitForFunction(() => document.querySelector('#pq-end') || document.querySelector('#pq-explain')?.hidden);
    }
    await page.waitForSelector('#pq-end'); await settle();
    return info;
  };
  const openPoem = async (id) => { await page.evaluate((h) => (location.hash = h), `#/poems/${kidId}/poem/${id}`); await page.waitForSelector('#pm-poem'); };
  await openPoem(target.id);
  ok((await page.locator('.pm-mode').allTextContents()).join('|') === '填空|接句|上句|排序|作者与朝代|关键词', 'the six practice buttons: 填空 接句 上句 排序 作者与朝代 关键词');
  const results = {};
  for (const [mode, kinds] of [['fill', ['fill']], ['next', ['choice']], ['prev', ['choice']], ['order', ['order']], ['match', ['choice']], ['key', ['choice']]]) {
    await openPoem(target.id);
    await page.click(`#pm-mode-${mode}`); await page.waitForSelector('#pm-prac');
    ok((await page.textContent('#pq-progress')) === '1 / 5', `${mode}: a round of five questions ("1 / 5")`);
    const lab = await page.textContent('#pq-label');
    const info = await answer({});
    results[mode] = info;
    ok(info.n === 5 && info.kinds.every((k) => kinds.includes(k)), `${mode}: five questions answered by taps (${info.kinds.join(',')}), label "${lab}"`);
    ok((await page.textContent('#pq-final')) === '5 / 5' && (await page.textContent('#pq-end h2')) === '全部正确。', `${mode}: all right = "5 / 5", "全部正确。"`);
    if (mode === 'fill') await page.screenshot({ path: OUT + 'poems-end-phone.png' });
    await page.click('#pq-done'); await page.waitForSelector('#pm-poem');
  }
  const r1 = revFile();
  ok(r1.cards[target.id] && r1.cards[target.id].box === 1 && r1.plays >= 6 && Object.keys(r1.stats).length === 6, 'the results are saved in poems/<kid>.review.json: the poem is in box 1 (six rounds on one day climb once), counts for the six kinds: ' + JSON.stringify(Object.keys(r1.stats)));
  // wrong answers: feedback, the explanation, a failing round falls to box 0
  await openPoem(target.id); await page.click('#pm-mode-match'); await page.waitForSelector('#pm-prac');
  const w1 = await answer({ wrongAt: [0], keepGoing: false });
  ok(await page.locator('.pq-opt.wrong').count() === 1 && await page.locator('.pq-opt.right').count() === 1 && (await page.textContent('#pq-explain')).startsWith('不对') && await page.locator('#pq-next').isVisible() && await page.locator('.pq-opt:enabled').count() === 0, 'a wrong answer: the tapped choice turns red, the right one green, "不对" with the explanation, the choices are locked, a Next button waits (no automatic jump)');
  await page.screenshot({ path: OUT + 'poems-wrong-phone.png' });
  await page.click('#pq-next');
  await page.waitForSelector('#pq-explain[hidden]', { state: 'attached' });
  await page.click('#pq-quit'); await page.waitForSelector('dialog');
  ok((await page.textContent('dialog')).includes('已回答的题目会被保存'), 'leaving a round asks first');
  await page.click('dialog button:has-text("取消")'); await page.waitForTimeout(250);
  ok(await page.locator('#pm-prac').count() === 1 && await page.locator('#toasts .toast:has-text("已保存")').count() === 0, 'cancelling the question changes nothing and shows no message');
  const before = JSON.stringify(revFile().cards[target.id]);
  await page.click('#pq-quit'); await page.click('dialog button.primary'); await page.waitForSelector('#pm-poem'); await settle();
  ok(JSON.stringify(revFile().cards[target.id]) !== before && revFile().cards[target.id].box === 0, 'leaving after one wrong answer saves it: the poem falls to box 0');
  // a whole failing round
  await page.click('#pm-mode-match'); await page.waitForSelector('#pm-prac');
  await answer({ wrongAt: [0, 1, 2] });
  ok((await page.textContent('#pq-final')) === '2 / 5' && (await page.textContent('#pq-end h2')) === '练习完成。' && revFile().cards[target.id].box === 0 && revFile().cards[target.id].wrong >= 2, 'a round with 3 wrong ends "2 / 5", the poem stays in box 0');
  await page.click('#pq-again'); await page.waitForSelector('#pm-prac'); ok((await page.textContent('#pq-progress')) === '1 / 5', '"再练一次" starts a new round');
  await page.click('#pq-quit'); await page.waitForSelector('#pm-poem');   // (nothing answered: no question asked)

  // the level of the fill-in
  await page.click('#pm-level-3'); await page.click('#pm-mode-fill'); await page.waitForSelector('#pq-choices');
  ok((await page.locator('.pq-slot').count()) === 3, 'level 较难: three characters are missing');
  await page.screenshot({ path: OUT + 'poems-fill3-phone.png' });
  await page.click('.pq-opt[data-right="1"]');
  ok((await page.locator('.pq-slot.ok').count()) === 1 && (await page.locator('.pq-slot.cur').count()) === 1, 'the blanks are asked one after the other; the one asked is marked');
  await page.click('.pq-opt[data-right="0"]');
  ok((await page.locator('.pq-slot.bad').count()) === 1 && (await page.locator('.pq-slot.fix').count()) === 1 && (await page.textContent('#pq-explain')).startsWith('不对'), 'a wrong character: the right ones are shown, the question is lost');
  await page.click('#pq-quit'); await page.click('dialog button.primary'); await page.waitForSelector('#pm-poem');
  await page.click('#pm-level-1');

  // recorded tab, recitation
  await page.evaluate((id) => (location.hash = `#/poems/${id}/learned`), kidId); await page.waitForSelector('#pm-learned .pm-card');
  ok(await page.locator('#pm-learned .pm-card').count() === 5 && (await page.textContent('#learned-title')) === '已学过的古诗词（5）', 'recorded: the five poems he met');
  const dots = await page.locator(`.pm-card[data-poem="${target.id}"] .pm-mem`).getAttribute('data-level');
  ok(dots === '0' && (await page.locator('.pm-card .pm-mem').evaluateAll((els) => els.every((e) => /^-?[0-5]$/.test(e.dataset.level) && e.querySelectorAll('i').length === 5))), 'the memory level is shown on every poem (five dots): the practised poem is at level 0 (failed)');
  await page.screenshot({ path: OUT + 'poems-learned-phone.png' });
  await page.click('#pm-recite-btn'); await page.waitForSelector('#rc-first');
  const rt = await page.textContent('#rc-title'); const RP = byTitle[rt];
  ok(!!RP && (await page.textContent('#rc-first')) === RP.lines[0] && await page.locator('#rc-rest').isHidden(), 'recite: a random poem, only its first line is shown');
  await page.click('#rc-show');
  ok(await page.locator('#rc-rest').isVisible() && (await page.locator('#rc-rest p').count()) === RP.lines.length, 'the whole poem can be shown');
  await page.screenshot({ path: OUT + 'poems-recite-phone.png' });
  const boxBefore = revFile().cards[RP.id]?.box ?? -1;
  await page.click('#rc-yes'); await settle(); await page.waitForSelector('#rc-first');
  ok(revFile().cards[RP.id].box >= 1 && revFile().cards[RP.id].box >= boxBefore && revFile().cards[RP.id].right >= 1, '"记得" moves a failed or new poem into box 1 (a poem already climbed today stays: once a day), never down');
  const rt2 = await page.textContent('#rc-title'); const RP2 = byTitle[rt2];
  await page.click('#rc-no'); await settle();
  ok(revFile().cards[RP2.id].box === 0, '"没记住" puts the poem back to box 0 (and a different poem comes next: ' + (RP2.id !== RP.id) + ')');
  await page.click('#rc-end'); await page.waitForSelector('#pm-learned');

  // the poets
  await page.click('.tabs button:has-text("诗人")'); await page.waitForSelector('#pm-timeline');
  const dyn = await page.locator('.pm-dyn').evaluateAll((els) => els.map((e) => e.dataset.dynasty));
  ok(dyn.join(',') === '先秦,汉,三国,魏晋,南北朝,唐,五代,宋,元,明,清,不详' || dyn.join(',').startsWith('先秦,汉,三国,魏晋,南北朝,'), 'the timeline lists the dynasties in time order: ' + dyn.join(' '));
  await page.click('.pm-dyn[data-dynasty="唐"]');
  const li = await page.locator('.pm-poet').evaluateAll((els) => els.map((e) => e.dataset.poet));
  ok(li.includes('李白') && li.includes('杜甫') && li.includes('王维'), 'the poets of the Tang dynasty with their poems: ' + li.slice(0, 5).join(' '));
  const libai = await page.locator('.pm-poet[data-poet="李白"] .pm-pill').allTextContents();
  ok(libai.length === lib.poems.filter((p) => p.author === '李白').length && libai.includes('静夜思'), '李白: all ' + libai.length + ' of his poems are listed');
  await page.screenshot({ path: OUT + 'poems-poets-phone.png' });
  await page.click('.pm-poet[data-poet="李白"] .pm-pill:has-text("静夜思")'); await page.waitForSelector('#pm-poem');
  ok((await page.textContent('#pm-ptitle')) === '静夜思', 'a tap on a poem of a poet opens it');

  // the grade: changing it picks today's poems again
  await page.evaluate((id) => (location.hash = `#/poems/${id}`), kidId); await page.waitForSelector('#grade-btn');
  await page.click('#grade-btn'); await page.waitForSelector('#grade-dlg'); await page.click('.grade-btn[data-grade="2"]');
  await page.waitForSelector('#toasts .toast:has-text("已按新年级重新选取")'); await page.waitForFunction(() => document.querySelector('#day-title')?.textContent === '新诗（1）'); await settle();
  const g2 = dayFile().weeks.find((w) => w.start === TODAY).chars;
  ok(g2.length === 1 && g2.every((i) => byId[i].grade <= 2), 'a new grade (二年级): today\'s poems are picked again for it (one poem of grade 2 or lower)');
  ok(log.external.length === 0, 'OFFLINE: the poems flow made no request outside the app: ' + log.external.join(', '));

  // the child is deleted -> its poems files go
  await openManage(page);
  await page.click('.kidrow:has-text("Dory") .delete'); await page.click('dialog button.danger');
  await page.waitForSelector('#toasts .toast:has-text("已删除")');
  ok(!store.has(`poems/${kidId}.json`) && !store.has(`poems/${kidId}.review.json`), 'deleting the child deletes poems/<kid>.json and poems/<kid>.review.json');
  await manageOff(page);
  await browser.close();

  // ================= real touch dragging in 排序 (CDP, device pixel ratio 2) =================
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }]]) {
    const t = await start(new Map(), { local: true, touch: true, dpr: 2, today: TODAY, viewport: vp, init: SPEECH });
    await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 4);
    const kid = await t.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
    const tp = byTitle['春晓'];
    await t.page.evaluate(([k, id]) => (location.hash = `#/poems/${k}/practice/${id}/order`), [kid, tp.id]);
    await t.page.waitForSelector('#pq-order'); await t.page.waitForFunction(() => !document.querySelector('#toasts .toast')); await t.page.waitForTimeout(300);   // (the messages of the top band are gone: a finger would touch them)
    const cdp = await t.page.context().newCDPSession(t.page);
    const rects = () => t.page.locator('.pq-oitem').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, line: e.dataset.line }; }));
    const touch = async (pts) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] }); for (const q of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await t.page.waitForTimeout(120); };
    const sy0 = await t.page.evaluate(() => window.scrollY + (document.querySelector('.scroll')?.scrollTop || 0));
    let rs = await rects();
    ok(rs.length >= 3 && rs.every((r) => r.h >= 44), `${name}: ${rs.length} lines to order, each at least 44 px high (${Math.round(rs[0].h)} px)`);
    // 1) drag the LAST line to the top, with a real finger
    const last = rs[rs.length - 1], firstR = rs[0];
    const path = []; for (let i = 0; i <= 12; i++) path.push({ x: last.x + last.w / 2, y: last.y + last.h / 2 + ((firstR.y + 4 - (last.y + last.h / 2)) * i) / 12 });
    await touch(path);
    let after = await rects();
    ok(after[0].line === last.line && JSON.stringify(after.slice(1).map((r) => r.line)) === JSON.stringify(rs.slice(0, -1).map((r) => r.line)), `${name}: a finger dragging the last line to the top puts it first, the others keep their order`);
    ok(await t.page.locator('.pq-oitem.drag').count() === 0 && (await t.page.evaluate(() => [...document.querySelectorAll('.pq-oitem')].every((e) => e.style.transform === ''))), `${name}: nothing stays lifted after the finger is up`);
    ok((await t.page.evaluate(() => window.scrollY + (document.querySelector('.scroll')?.scrollTop || 0))) === sy0, `${name}: the page did not scroll under the finger`);
    // 2) drag the first line down to the middle (a short drag)
    rs = await rects();
    const a = rs[0], c = rs[2];
    const p2 = []; for (let i = 0; i <= 10; i++) p2.push({ x: a.x + a.w / 2, y: a.y + a.h / 2 + ((c.y + c.h / 2 + 4 - (a.y + a.h / 2)) * i) / 10 });
    await touch(p2);
    after = await rects();
    ok(after[2].line === a.line && after[0].line === rs[1].line && after[1].line === rs[2].line, `${name}: dragging the first line down two places moves it to the third position`);
    // 3) the finger moves a lot sideways: still the same list
    // 4) tap one line, then another: they swap
    rs = await rects();
    await touch([{ x: rs[0].x + rs[0].w / 2, y: rs[0].y + rs[0].h / 2 }]);
    ok(await t.page.locator('.pq-oitem.sel').count() === 1, `${name}: a tap selects a line`);
    await touch([{ x: rs[1].x + rs[1].w / 2, y: rs[1].y + rs[1].h / 2 }]);
    after = await rects();
    ok(after[0].line === rs[1].line && after[1].line === rs[0].line && await t.page.locator('.pq-oitem.sel').count() === 0, `${name}: a tap on a second line swaps the two`);
    // the check: put them right with the keyboard / taps and judge
    const sol = tp.lines.filter((l, i) => { const w = after.map((r) => r.line); return w.includes(l); });   // (the window of lines on the screen, in the poem's order)
    for (let pos = 0; pos < sol.length; pos++) { const cur = (await rects()).map((r) => r.line); const j = cur.indexOf(sol[pos]); if (j !== pos) { const rr = await rects(); await touch([{ x: rr[pos].x + rr[pos].w / 2, y: rr[pos].y + rr[pos].h / 2 }]); await touch([{ x: rr[j].x + rr[j].w / 2, y: rr[j].y + rr[j].h / 2 }]); } }
    await t.page.click('#pq-check'); await t.page.waitForSelector('#pq-explain:not([hidden])');
    ok(await t.page.locator('.pq-oitem.right').count() === sol.length && (await t.page.textContent('#pq-explain')).startsWith('正确'), `${name}: the lines in the right order are all marked right`);
    await t.page.screenshot({ path: OUT + `poems-order-${name}.png` });
    ok(t.log.external.length === 0, `${name}: no outside request`);
    await t.browser.close();
  }

  // ================= layout: five screens, every page and every kind of question =================
  const measure = async (p, extra = '') => p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const small = [...document.querySelectorAll('.pq-opt, .pm-mode, .pm-card, .pq-next, .pq-oitem, .pm-pill, .pm-dyn, #pm-more, .rc-btns button, .tabs button, #pm-read, .mopt')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40 && getComputedStyle(e).visibility !== 'hidden').map((e) => e.className + ':' + Math.round(e.getBoundingClientRect().height));
    const out = [...document.querySelectorAll('.pm-card, .pq-opt, .pq-subject, .pm-poem, .pm-sec, .pq-oitem, .rc-card, .pm-dyn, .pm-poet')].filter((e) => e.offsetParent).filter((e) => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > vw + 0.5; }).map((e) => e.className);
    const clipped = [...document.querySelectorAll('.pq-opt, .pm-card, .pm-pill, .pm-mode, .pq-oitem')].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.className + ':' + e.textContent.slice(0, 12));
    const box = [...document.querySelectorAll('.pm-poem, .pq-subject, .pm-list, .pm-poets, .rc-card, .pq-choices, .pq-order')].find((e) => e.offsetParent);
    const r = box?.getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, vw, small, out, clipped, l: r ? r.left : 0, r: r ? vw - r.right : 0 };
  });
  const SIZES = [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['ipad-portrait', { width: 820, height: 1180 }], ['ipad-landscape', { width: 1180, height: 820 }], ['landscape-phone', { width: 844, height: 390 }]];
  for (const [name, vp] of SIZES) {
    const t = await start(new Map(), { local: true, today: TODAY, viewport: vp, init: SPEECH });
    await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 7);
    const kid = await t.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
    const go = async (hash, sel) => { await t.page.evaluate((h) => (location.hash = h), hash); await t.page.waitForSelector(sel); await t.page.waitForTimeout(450); };
    const pages = [
      ['today', `#/poems/${kid}`, '#pm-today .pm-card'], ['learned', `#/poems/${kid}/learned`, '#pm-learned'], ['poets', `#/poems/${kid}/poets`, '#pm-poets'], ['recite', `#/poems/${kid}/recite`, '#rc-first'],
      ['poem-jueju', `#/poems/${kid}/poem/${byTitle['静夜思'].id}`, '#pm-poem'], ['poem-ci', `#/poems/${kid}/poem/${byTitle['水调歌头·明月几时有'].id}`, '#pm-poem'], ['poem-long-line', `#/poems/${kid}/poem/${byTitle['杨氏之子'].id}`, '#pm-poem'], ['poem-lushi', `#/poems/${kid}/poem/${byTitle['登高'].id}`, '#pm-poem'],
      ['fill', `#/poems/${kid}/practice/${byTitle['静夜思'].id}/fill`, '#pq-choices'], ['next', `#/poems/${kid}/practice/${byTitle['水调歌头·明月几时有'].id}/next`, '#pq-choices'], ['order', `#/poems/${kid}/practice/${byTitle['登高'].id}/order`, '#pq-order'],
      ['match', `#/poems/${kid}/practice/${byTitle['静夜思'].id}/match`, '#pq-choices'], ['key-gist', `#/poems/${kid}/practice/${byTitle['念奴娇·赤壁怀古'].id}/key`, '#pq-choices'],
    ];
    const bad = [];
    for (const [label, hash, sel] of pages) {
      await go(hash, sel);
      const m = await measure(t.page);
      if (m.sw > m.vw || m.out.length || m.clipped.length || m.small.length || Math.abs(m.l - m.r) > 2.5) bad.push(`${label}: sw ${m.sw}/${m.vw} out ${m.out} clipped ${m.clipped.slice(0, 2)} small ${m.small.slice(0, 2)} l/r ${Math.round(m.l)}/${Math.round(m.r)}`);
      await t.page.screenshot({ path: OUT + `poems-${label}-${name}.png`, fullPage: label.startsWith('poem') });
    }
    ok(bad.length === 0, `${name}: ${pages.length} screens: nothing sideways or cut off, targets >= 40 px, content centred (equal space left and right)` + (bad.length ? ' -> ' + bad.join(' | ') : ''));
    // the long line wraps instead of going out of the box
    await go(`#/poems/${kid}/poem/${byTitle['杨氏之子'].id}`, '#pm-poem');
    const lines = await t.page.evaluate(() => { const box = document.querySelector('#pm-poem').getBoundingClientRect(); return [...document.querySelectorAll('.pm-ch')].every((c) => { const r = c.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1; }); });
    ok(lines, `${name}: every character of the longest lines stays inside the poem's frame`);
    ok(t.log.external.length === 0, `${name}: no request outside the app`);
    await t.browser.close();
  }

  // ================= English and French =================
  const extra = JSON.parse(fs.readFileSync('src/i18n-extra/poems.json', 'utf8'));
  for (const [loc, nm, idx] of [['en-US', 'en', 0], ['fr-FR', 'fr', 1]]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }]]) {
      const t = await start(new Map(), { local: true, locale: loc, today: TODAY, viewport: vp, init: SPEECH });
      // the lead merges src/i18n-extra/poems.json into src/i18n-data.ts; until then the test adds the texts to the module the app loads
      const patch = '\n' + Object.entries(extra).map(([k, v]) => `if (!(${JSON.stringify(k)} in ${nm.toUpperCase()})) ${nm.toUpperCase()}[${JSON.stringify(k)}] = ${JSON.stringify(v[idx])};`).join('\n') + '\n';
      await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + patch }); });
      await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
      await t.page.evaluate(() => (location.hash = '#/chinese')); await t.page.waitForSelector('.kids, .empty-home');
      await addKid(t.page, 'Dory'); await setGrade(t.page, 'Dory', 5);
      const kid = await t.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
      const cjkLeft = () => t.page.evaluate(() => {
        const out = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!e || e.closest('.user, .user-title, script, style, svg, .shortcuts') || !/[一-鿿]/.test(n.nodeValue)) continue; if (e.offsetParent === null && !e.closest('#toasts')) continue; out.push(n.nodeValue.trim().slice(0, 20)); }
        for (const e of document.querySelectorAll('[title], [aria-label]')) { if (e.closest('.user, .shortcuts')) continue; for (const a of ['title', 'aria-label']) { const v = e.getAttribute(a); if (v && /[一-鿿]/.test(v)) out.push(a + ':' + v.slice(0, 20)); } }
        return out;
      });
      await t.page.evaluate((k) => (location.hash = `#/poems/${k}`), kid); await t.page.waitForSelector('#pm-today .pm-card'); await t.page.waitForTimeout(300);
      const tabs = (await t.page.locator('.tabs button').allTextContents()).join('|');
      ok(!(await cjkLeft()).length, `${nm} ${dn}: today page has no Chinese UI text left (${tabs})`);
      ok(nm === 'en' ? tabs === 'Today|Recorded 1|Poets' : tabs === "Aujourd'hui|Enregistrés 1|Poètes", `${nm} ${dn}: tabs translated`);
      const pid = await t.page.getAttribute('#pm-today .pm-card', 'data-poem');
      const checks2 = [['poem', `#/poems/${kid}/poem/${pid}`, '#pm-poem'], ['learned', `#/poems/${kid}/learned`, '#pm-learned'], ['poets', `#/poems/${kid}/poets`, '#pm-poets'], ['recite', `#/poems/${kid}/recite`, '#rc-first']];
      for (const m of ['fill', 'next', 'order', 'match', 'key']) checks2.push([m, `#/poems/${kid}/practice/${byTitle['静夜思'].id}/${m}`, m === 'order' ? '#pq-order' : '#pq-choices']);
      const bad = [];
      for (const [label, hash, sel] of checks2) {
        await t.page.evaluate((h) => (location.hash = h), hash); await t.page.waitForSelector(sel); await t.page.waitForTimeout(250);
        const left = await cjkLeft(); if (left.length) bad.push(label + ': ' + left.slice(0, 3).join(','));
        const m = await measure(t.page); if (m.sw > m.vw || m.out.length || m.clipped.length) bad.push(`${label} layout ${m.sw}/${m.vw} ${m.clipped.slice(0, 2)}`);
        if (label === 'poem' || label === 'fill' || label === 'match') await t.page.screenshot({ path: OUT + `poems-${label}-${nm}-${dn}.png`, fullPage: label === 'poem' });
      }
      ok(bad.length === 0, `${nm} ${dn}: poem page, recorded, poets, recitation and five kinds of questions: no Chinese UI text left, nothing cut off or sideways` + (bad.length ? ' -> ' + bad.join(' | ') : ''));
      // the question labels, the feedback and the end screen are translated too
      await t.page.evaluate((h) => (location.hash = h), `#/poems/${kid}/practice/${byTitle['静夜思'].id}/next`); await t.page.waitForSelector('#pq-choices');
      const label = await t.page.textContent('#pq-label');
      await t.page.click('.pq-opt[data-right="0"]'); await t.page.waitForSelector('#pq-explain:not([hidden])');
      const fb = (await t.page.textContent('#pq-explain')).slice(0, 12);
      ok((nm === 'en' ? label === 'What is the next line?' && fb.startsWith('Incorrect') : label === 'Quel est le vers suivant ?' && fb.startsWith('Incorrect')) && !(await cjkLeft()).length, `${nm} ${dn}: the question, the feedback ("${fb.trim()}") and the button are translated`);
      ok(t.log.external.length === 0, `${nm} ${dn}: no request outside the app`);
      await t.browser.close();
    }
  }
  await done();
})();
