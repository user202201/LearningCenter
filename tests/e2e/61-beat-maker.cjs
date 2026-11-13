// Beat maker (节奏编辑器, #/music/beats): the pure pattern logic (tap, paint, presets, tempo -> step time, swing, undo), the look-ahead scheduler driven by a FAKE clock
// (every lit cell plays the right instrument at the right time, muted rows stay silent, edits and tempo changes apply at once), the MIDI export parsed back,
// and the screen (card on the music home, grid, tap / drag-paint, play head, panel, save / load / delete, undo, keyboard, full screen, phones and tablets, EN / FR, offline).
// Real fingers, real audio latency and the real sound of an iPad / iPhone are NOT tested.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

/** a minimal Standard MIDI File reader: tempo, time signature, and the note-on / note-off events with their absolute tick and channel */
function parseMidi(b) {
  const r = { fmt: b.readUInt16BE(8), tracks: b.readUInt16BE(10), tpq: b.readUInt16BE(12), tempo: 0, sig: null, on: [], off: [], end: 0 };
  let i = 14; if (b.slice(i, i + 4).toString() !== 'MTrk') throw new Error('no MTrk');
  const len = b.readUInt32BE(i + 4); i += 8; const stop = i + len; let tick = 0, st = 0;
  const vlq = () => { let v = 0, c; do { c = b[i++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
  while (i < stop) {
    tick += vlq(); let s = b[i];
    if (s === 0xff) { const type = b[i + 1]; i += 2; const n = vlq(); const d = b.slice(i, i + n); i += n; if (type === 0x51) r.tempo = (d[0] << 16) | (d[1] << 8) | d[2]; if (type === 0x58) r.sig = [d[0], d[1]]; if (type === 0x2f) r.end = tick; continue; }
    if (s & 0x80) { st = s; i++; }
    const hi = st & 0xf0, ch = st & 15;
    if (hi === 0xc0 || hi === 0xd0) { i += 1; continue; }
    const a = b[i], v = b[i + 1]; i += 2;
    if (hi === 0x90 && v > 0) r.on.push({ tick, ch, n: a, v }); else if (hi === 0x80 || hi === 0x90) r.off.push({ tick, ch, n: a });
  }
  return r;
}

(async () => {
  // ================= the pure logic =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/beatlogic.ts'), R = await import('/src/musicrec.ts');
      const out = {};
      const p = L.emptyPattern();
      out.tracks = L.TRACKS.map((x) => x.id).join();
      out.cols = L.cols(p);
      // tap: a drum cell toggles; a melodic cell: same choice = off, another choice = changes it
      out.d1 = L.decide(p, 'kick', 0, 1); L.setCell(p, 'kick', 0, 'on'); out.d2 = L.decide(p, 'kick', 0, 1); out.v1 = p.tracks.kick[0];
      L.setCell(p, 'piano', 3, 'on', 4); out.pv = p.tracks.piano[3]; out.pd_same = L.decide(p, 'piano', 3, 4); out.pd_other = L.decide(p, 'piano', 3, 2);
      // paint: the first cell decides
      const q = L.emptyPattern();
      const cells = [0, 1, 2, 3, 4].map((s) => ({ t: 'snare', s }));
      const n1 = L.paint(q, cells, () => 1); out.paintOn = q.tracks.snare.slice(0, 6).join('');
      const n2 = L.paint(q, cells, () => 1); out.paintOff = q.tracks.snare.slice(0, 6).join('');
      L.setCell(q, 'snare', 2, 'on'); L.paint(q, [{ t: 'snare', s: 3 }, { t: 'snare', s: 2 }, { t: 'snare', s: 4 }], () => 1); out.paintMixed = q.tracks.snare.slice(0, 6).join('');
      out.n = [n1, n2];
      // tempo -> step time, swing
      const s = L.emptyPattern(); s.bpm = 120; s.res = 4; out.step120 = L.stepSeconds(s); s.bpm = 90; s.res = 2; out.step90 = L.stepSeconds(s);
      s.bpm = 120; s.res = 4; out.bar = L.barSeconds(s); out.off1 = L.stepOffset(s, 1); s.swing = true; out.off1sw = L.stepOffset(s, 1); out.off2sw = L.stepOffset(s, 2);
      // presets
      out.presets = L.PRESETS.map((pr) => { const x = L.emptyPattern(); L.applyPreset(x, pr); return { id: pr.id, cols: L.cols(x), lit: L.countLit(x), bpm: x.bpm, kick: x.tracks.kick.slice(0, L.cols(x)).map((v) => (v ? 'x' : '.')).join('') }; });
      // 16 -> 8 steps keeps the hits in place
      const g = L.emptyPattern(); L.setCell(g, 'kick', 0, 'on'); L.setCell(g, 'kick', 8, 'on'); L.setCell(g, 'kick', 5, 'on'); L.setRes(g, 2);
      out.res8 = g.tracks.kick.slice(0, 8).join(''); L.setRes(g, 4); out.res16 = g.tracks.kick.slice(0, 16).join('');
      // safe reading
      const bad = L.sanitize({ bpm: 9999, beats: 7, res: 9, tracks: { kick: [5, 1, 'x', -2, 1], piano: [99, 3] }, mute: ['kick', 'nothing'], vol: { kick: 5 } });
      out.bad = { bpm: bad.bpm, beats: bad.beats, res: bad.res, kick: bad.tracks.kick.slice(0, 5).join(''), piano: bad.tracks.piano.slice(0, 2).join(''), mute: bad.mute.join(), vol: bad.vol.kick };
      // what plays at a step: muted rows / zero volume are left out
      const e = L.emptyPattern(); L.setCell(e, 'kick', 0, 'on'); L.setCell(e, 'hat', 0, 'on'); L.setCell(e, 'bass', 0, 'on', 3); L.setCell(e, 'guitar', 0, 'on', 2);
      out.ev = L.eventsAt(e, 0).map((x) => x.track + ':' + (x.drum || x.midi.join('/'))).join(' ');
      e.mute = ['hat']; e.vol.kick = 0; out.ev2 = L.eventsAt(e, 0).map((x) => x.track).join();
      // choices: scales
      out.piano = L.choicesOf('piano', 'penta').map((c) => c.label + c.midi[0]).join(' '); out.major = L.choicesOf('piano', 'major').map((c) => c.midi[0]).join(); out.minor = L.choicesOf('piano', 'minor').map((c) => c.midi[0]).join();
      out.bass = L.choicesOf('bass', 'penta').map((c) => c.midi[0]).join(); out.chords = L.choicesOf('guitar', 'penta').map((c) => c.label + ':' + c.midi.join('/')).join(' ');
      // history
      const hh = new L.History(); const a = L.emptyPattern(); hh.push(a); L.setCell(a, 'kick', 1, 'on'); hh.push(a); out.hist = [hh.size, hh.pop().tracks.kick[1], hh.pop().tracks.kick[1], hh.pop()];
      // random: always something, only valid values
      const rr = L.emptyPattern(); L.randomize(rr, () => 0.99); out.rndMin = L.countLit(rr); L.randomize(rr); out.rndOk = L.TRACKS.every((x) => rr.tracks[x.id].every((v) => v >= 0 && v <= (L.isMelodic(x.id) ? L.choicesOf(x.id, rr.scale).length : 1)));
      return out;
    });
    ok(r.tracks === 'kick,snare,hat,open,tom,crash,ride,piano,guitar,bass' && r.cols === 16, 'logic: ten tracks (7 drums, piano, guitar, bass), 16 steps of 4/4: ' + r.tracks);
    ok(r.d1 === 'on' && r.d2 === 'off' && r.v1 === 1 && r.pv === 4 && r.pd_same === 'off' && r.pd_other === 'on', 'logic: a drum cell toggles; a melodic cell: the same note = off, another note = change it');
    ok(r.paintOn === '111110' && r.paintOff === '000000' && r.paintMixed === '001110', 'logic: paint - the first cell decides: ' + [r.paintOn, r.paintOff, r.paintMixed].join(' '));
    ok(Math.abs(r.step120 - 0.125) < 1e-9 && Math.abs(r.step90 - 1 / 3) < 1e-9 && Math.abs(r.bar - 2) < 1e-9, `logic: tempo -> step time (120 BPM x 16 = ${r.step120} s a step, a bar 2 s; 90 BPM x 8 = ${r.step90.toFixed(4)})`);
    ok(r.off1 === 0.125 && Math.abs(r.off1sw - (0.125 + 0.3 * 0.125)) < 1e-9 && r.off2sw === 0.25, 'logic: swing delays only the odd steps (30 % of a step): ' + r.off1sw);
    const P = Object.fromEntries(r.presets.map((x) => [x.id, x]));
    ok(r.presets.length === 5 && P.rock.kick === 'x.......x.x.....' && P.waltz.cols === 12 && P.disco.kick === 'x...x...x...x...' && r.presets.every((x) => x.lit >= 4 && x.bpm >= 60 && x.bpm <= 180), 'logic: five presets (rock, disco, hip-hop, bossa, waltz 3/4 = 12 steps) fill the grid');
    ok(r.res8 === '10101000' && r.res16 === '1000100010000000', 'logic: 16 -> 8 steps keeps every hit in its place (two neighbours become one) and back again: ' + r.res8 + ' / ' + r.res16);
    ok(r.bad.bpm === 180 && r.bad.beats === 4 && r.bad.res === 4 && r.bad.kick === '01001' && r.bad.piano === '03' && r.bad.mute === 'kick' && r.bad.vol === 1, 'logic: a pattern read from storage is made safe: ' + JSON.stringify(r.bad));
    ok(r.ev === 'kick:kick hat:hihat guitar:53/57/60 bass:40', 'logic: what plays at a step (kick, closed hat, guitar chord F, bass note D2): ' + r.ev);
    ok(r.ev2 === 'guitar,bass', 'logic: a muted row and a row with volume 0 are left out: ' + r.ev2);
    ok(r.piano === 'C60 D62 E64 G67 A69 C72 D74 E76' && r.major === '60,62,64,65,67,69,71,72' && r.minor === '60,62,63,65,67,68,70,72' && r.bass === '36,38,40,43,45' && r.chords === 'C:48/52/55 F:53/57/60 G:55/59/62 Am:45/48/52', 'logic: pentatonic / major / minor notes, bass notes, chords');
    ok(r.hist[0] === 2 && r.hist[1] === 1 && r.hist[2] === 0 && r.hist[3] === null, 'logic: the history gives back the steps one by one, then nothing');
    ok(r.rndMin === 1 && r.rndOk, 'logic: random always lights at least one cell and only valid values');
    await t.browser.close();
  }

  // ================= the scheduler, driven by a fake clock =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/beatlogic.ts');
      const out = {};
      const mk = () => {
        const p = L.emptyPattern(); p.bpm = 120; p.res = 4;
        [0, 8].forEach((s) => L.setCell(p, 'kick', s, 'on')); [4, 12].forEach((s) => L.setCell(p, 'snare', s, 'on'));
        return p;
      };
      const run = (p, seconds, hook) => {
        let now = 10; const ev = [], late = [];
        const seq = new L.Sequencer(() => p, () => now, (e, when, step) => { ev.push({ track: e.track, when, step, at: now }); });
        seq.start(0.05);
        for (let k = 0; now < 10 + seconds; k++) { now += 0.025; if (hook) hook(now - 10, p); seq.tick(); }
        return { ev, seq };
      };
      let p = mk();
      let { ev } = run(p, 4.6);
      // every event at the right time: start at 10.05, step 0.125 s
      out.n = ev.length;
      out.exact = ev.every((e) => Math.abs(e.when - (10.05 + (Math.floor((e.when - 10.05 + 1e-9) / 0.125)) * 0.125)) < 1e-9);
      out.kinds = ev.slice(0, 8).map((e) => `${e.track}@${(e.when - 10.05).toFixed(3)}`).join(' ');
      out.ahead = Math.max(...ev.map((e) => e.when - e.at)) <= 0.1 + 1e-9;   // never scheduled further ahead than the look-ahead
      out.early = Math.min(...ev.map((e) => e.when - e.at)) >= -1e-9;   // never in the past
      // a muted row stays silent, a row with no volume too
      p = mk(); p.mute = ['kick']; out.muted = run(p, 3).ev.map((e) => e.track).filter((x, i, a) => a.indexOf(x) === i).join();
      // editing while it plays takes effect (a hat added at 1.0 s is heard from the next time its step comes)
      p = mk(); const added = run(p, 5, (s, pp) => { if (s > 1.0 && !pp.tracks.hat[2]) pp.tracks.hat[2] = 1; }).ev.filter((e) => e.track === 'hat');
      out.edit = added.map((e) => (e.when - 10.05).toFixed(3)).join(' ');
      // tempo change: faster from the next step on
      p = mk(); const fast = run(p, 4, (s, pp) => { if (s > 1.0) pp.bpm = 240; }).ev.filter((e) => e.track === 'kick').map((e) => e.when - 10.05);
      out.tempo = fast.slice(0, 6).map((x) => x.toFixed(3)).join(' ');
      // swing: the odd steps come late
      p = mk(); p.swing = true; L.setCell(p, 'hat', 1, 'on'); L.setCell(p, 'hat', 2, 'on');
      out.swing = run(p, 0.6).ev.filter((e) => e.track === 'hat').map((e) => (e.when - 10.05).toFixed(4)).join(' ');
      // 3/4: the loop is 12 steps
      p = mk(); p.beats = 3; p.tracks.kick.fill(0); p.tracks.kick[0] = 1; out.waltz = run(p, 3).ev.filter((e) => e.track === 'kick').map((e) => (e.when - 10.05).toFixed(3)).join(' ');
      // the page was asleep for 5 s: no burst of missed steps
      p = mk(); let now = 10; const seen = []; const seq = new L.Sequencer(() => p, () => now, (e, w) => seen.push(w)); seq.start(0.05); seq.tick(); const n0 = seen.length; now = 15; seq.tick(); out.burst = seen.length - n0;
      // the play head follows the audio clock
      p = mk(); now = 10; const s2 = new L.Sequencer(() => p, () => now, () => {}); s2.start(0.05); s2.tick(); const heads = [];
      for (let k = 0; k <= 41; k++) { now = 10 + k * 0.025; s2.tick(); if ([0, 8, 12, 20, 41].includes(k)) heads.push(s2.current()); }
      out.heads = heads.join(); s2.stop(); out.stopped = [s2.running, s2.current()].join();
      return out;
    });
    ok(r.kinds === 'kick@0.000 snare@0.500 kick@1.000 snare@1.500 kick@2.000 snare@2.500 kick@3.000 snare@3.500', 'scheduler: kick on 1 and 3, snare on 2 and 4 at 120 BPM x 16 steps, at the exact times: ' + r.kinds);
    ok(r.n === 10 && r.exact, `scheduler: ${r.n} events, every one exactly on the step grid (no drift over 4.6 s)`);
    ok(r.ahead && r.early, 'scheduler: nothing is scheduled further ahead than the 100 ms look-ahead, nothing in the past');
    ok(r.muted === 'snare', 'scheduler: a muted row stays silent: ' + r.muted);
    ok(r.edit === '2.250 4.250', 'scheduler: a cell lit while it plays is heard from its next step on: ' + r.edit);
    const tt = r.tempo.split(' ').map(Number);
    ok(tt[0] === 0 && Math.abs(tt[1] - 1) < 1e-6 && Math.abs(tt[2] - 1.5625) < 1e-3 && Math.abs(tt[3] - 2.0625) < 1e-3, 'scheduler: a tempo change takes effect at once: ' + r.tempo);
    ok(r.swing.split(' ')[0] === '0.1625' && r.swing.split(' ')[1] === '0.2500', 'scheduler: swing - step 1 comes at 0.1625 s instead of 0.125, step 2 stays: ' + r.swing);
    ok(r.waltz.startsWith('0.000 1.500 3.000'), 'scheduler: 3/4 loops after 12 steps (a bar of 1.5 s): ' + r.waltz);
    ok(r.burst <= 4, `scheduler: after the page slept 5 s there is no burst of missed steps (${r.burst})`);
    ok(r.heads === '-1,1,2,3,7' && r.stopped === 'false,-1', 'scheduler: the play head follows the clock (steps ' + r.heads + ') and is off after stop');
    await t.browser.close();
  }

  // ================= the MIDI file =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/beatlogic.ts'), R = await import('/src/musicrec.ts');
      const p = L.emptyPattern(); p.bpm = 100; p.res = 4;
      [0, 8].forEach((s) => L.setCell(p, 'kick', s, 'on')); L.setCell(p, 'snare', 4, 'on'); L.setCell(p, 'hat', 2, 'on'); L.setCell(p, 'open', 6, 'on'); L.setCell(p, 'tom', 10, 'on'); L.setCell(p, 'crash', 0, 'on'); L.setCell(p, 'ride', 12, 'on');
      L.setCell(p, 'piano', 1, 'on', 3); L.setCell(p, 'bass', 3, 'on', 2); L.setCell(p, 'guitar', 5, 'on', 4); L.setCell(p, 'hat', 14, 'on');
      p.mute = ['hat'];
      const a = [...R.buildPatternMidi(p, 2, 'Test')], b = [...R.buildPatternMidi(p, 8, 'Test')];
      p.beats = 3; p.res = 2; p.swing = true; p.bpm = 90;
      const c = [...R.buildPatternMidi(p, 2, 'W')];
      return { a, b, c };
    });
    const A = parseMidi(Buffer.from(r.a)), Bm = parseMidi(Buffer.from(r.b)), C = parseMidi(Buffer.from(r.c));
    const key = (x) => `${x.ch}:${x.n}@${x.tick}`;
    const set = (m) => m.on.map(key);
    ok(A.fmt === 0 && A.tracks === 1 && A.tpq === 480 && A.tempo === 600000 && A.sig.join() === '4,2', `midi: format 0, 480 ticks, 100 BPM = ${A.tempo} us per quarter, 4/4`);
    // 16 steps x 120 ticks = a bar of 1920 ticks
    const want = ['9:36@0', '9:36@960', '9:38@480', '9:46@720', '9:45@1200', '9:49@0', '9:51@1440', '0:64@120', '2:38@360', '1:45@600', '1:48@600', '1:52@600'];
    const wantAll = want.flatMap((k) => { const [h, t] = k.split('@'); return [h + '@' + t, h + '@' + (+t + 1920)]; });
    const got = set(A).map((k) => { const [h, t] = k.split('@'); return h + '@' + t; });
    ok(wantAll.every((k) => got.includes(k)) && got.length === wantAll.length, 'midi: drums on channel 10 with the General MIDI notes (kick 36, snare 38, open hat 46, tom 45, crash 49, ride 51), piano ch 1 (E4 = 64), bass ch 3, guitar chord Am as three notes; two bars; a muted row (closed hat 42) is not in the file: ' + (got.length));
    ok(!A.on.some((x) => x.n === 42), 'midi: the muted closed hat is not exported');
    ok(A.off.length === A.on.length && A.on.every((x) => A.off.some((o) => o.ch === x.ch && o.n === x.n && o.tick > x.tick)), 'midi: every note is closed again');
    ok(A.end === 3840 && Bm.end === 4 * 3840 && Bm.on.length === 4 * A.on.length, `midi: the length follows the bars chosen (2 bars = ${A.end} ticks, 8 bars = ${Bm.end}, four times the notes)`);
    ok(C.tempo === Math.round(60000000 / 90) && C.sig.join() === '3,2' && C.end === 2 * 6 * 240, `midi: 3/4 at 90 BPM with 6 steps (eighths): tempo ${C.tempo}, signature ${C.sig}, two bars = ${C.end} ticks`);
    const sw = C.on.filter((x) => x.ch === 9 && x.n === 36).map((x) => x.tick);
    ok(sw.join() === '0,1440', 'midi: the 3/4 loop (6 steps of 240 ticks): kick on step 1 of each bar: ' + sw.join());
    await t.browser.close();
  }

  // ================= the screen =================
  const ptr = (page, type, id, x, y) => page.evaluate(([type, id, x, y]) => document.querySelector('#bt-grid').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true })), [type, id, x, y]);
  const center = (page, t, s) => page.evaluate(([t, s]) => { const el = document.querySelector(`.bt-cell[data-t="${t}"][data-s="${s}"]`); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [t, s]);
  const tap = async (page, t, s, id = 1) => { const c = await center(page, t, s); await ptr(page, 'pointerdown', id, c.x, c.y); await ptr(page, 'pointerup', id, c.x, c.y); };
  const drag = async (page, t, s0, s1, id = 1) => {
    const a = await center(page, t, s0); await ptr(page, 'pointerdown', id, a.x, a.y);
    const step = s1 >= s0 ? 1 : -1;
    for (let s = s0 + step; s !== s1 + step; s += step) { const c = await center(page, t, s); await ptr(page, 'pointermove', id, c.x, c.y); }
    const z = await center(page, t, s1); await ptr(page, 'pointerup', id, z.x, z.y);
  };
  const lit = (page, t) => page.evaluate((t) => [...document.querySelectorAll(`.bt-cell[data-t="${t}"]`)].map((c) => (c.classList.contains('lit') ? 1 : 0)).join(''), t);
  const vals = (page, t) => page.evaluate((t) => [...document.querySelectorAll(`.bt-cell[data-t="${t}"]`)].map((c) => c.dataset.v).join(''), t);
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.music.beats.v1')));
  const plays = (page) => page.evaluate(() => window.__music.plays.slice());
  const clearPlays = (page) => page.evaluate(() => { window.__music.plays.length = 0; });

  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 1180, height: 820 } });
  const p = t.page;
  // ---- the card, the route, back ----
  await p.evaluate(() => (location.hash = '#/subject/music')); await p.waitForSelector('#mus-theory');
  const names = await p.locator('.mus-card b').allTextContents();
  ok(names.join() === '乐理,钢琴,架子鼓,吉他,节奏编辑器', 'the music home has the new card next to the four others: ' + names.join());
  const cardArt = await p.evaluate(() => { const c = document.querySelector('#mus-beats'), a = c.querySelector('.mus-art svg'), r = c.querySelector('.mus-art').getBoundingClientRect(), r0 = document.querySelector('#mus-guitar .mus-art').getBoundingClientRect(); return { svg: !!a && a.querySelectorAll('rect').length > 6, same: Math.abs(r.width - r0.width) < 1, bshadow: getComputedStyle(c).boxShadow === getComputedStyle(document.querySelector('#mus-guitar')).boxShadow }; });
  ok(cardArt.svg && cardArt.same && cardArt.bshadow, 'the card has its cartoon picture, the same size and 3D shadow as the other cards');
  await p.screenshot({ path: OUT + 'beats-home-desktop.png' });
  await p.click('#mus-beats'); await p.waitForSelector('.bt-cell');
  ok((await p.evaluate(() => location.hash)) === '#/music/beats' && (await p.textContent('.hero h1')) === '节奏编辑器', 'the card opens #/music/beats with the title in the usual band');
  await p.click('.hero .back, .hero button[aria-label], .hero a');
  await p.waitForSelector('#mus-theory').catch(() => {});
  ok((await p.evaluate(() => location.hash)) === '#/subject/music', 'back goes to the music home');
  await p.evaluate(() => (location.hash = '#/music/beats')); await p.waitForSelector('.bt-cell');

  // ---- the grid ----
  const g = await p.evaluate(() => ({ rows: document.querySelectorAll('.bt-track').length, cells: document.querySelectorAll('.bt-cell').length, per: document.querySelectorAll('.bt-track[data-t="kick"] .bt-cell').length, beats: [...document.querySelectorAll('.bt-hc')].map((e) => e.textContent).join(''), strong: document.querySelectorAll('.bt-hc.beat').length, w: document.querySelector('.bt-cell').getBoundingClientRect().width, labs: document.querySelectorAll('.bt-lab svg').length, pager: !document.querySelector('#bt-pager').hidden }));
  ok(g.rows === 10 && g.per === 16 && g.cells === 160 && g.labs === 10, `the grid: ${g.rows} rows x ${g.per} steps, a round label with a picture on every row`);
  ok(g.beats === '1···2···3···4···' && g.strong === 4, 'the beat count above the grid: 1 . . . 2 . . . 3 . . . 4 . . . with the downbeats stronger: ' + g.beats);
  ok(g.w >= 20 && !g.pager, `on a wide screen all 16 steps fit (cells ${Math.round(g.w)} px), no pages`);
  ok((await p.locator('.bt-name').allTextContents()).join() === '底鼓,军鼓,踩镲,开镲,嗵鼓,吊镲,叮叮镲,钢琴,吉他,贝斯', 'rows: kick, snare, closed hat, open hat, tom, crash, ride, piano, guitar, bass');
  // tap and drag
  await clearPlays(p);
  await tap(p, 'kick', 0);
  ok((await lit(p, 'kick')).startsWith('1000') && (await vals(p, 'kick'))[0] === '1' && (await plays(p)).some((x) => x.id === 'kick'), 'tap a cell: it lights (and the instrument is heard)');
  await tap(p, 'kick', 0);
  ok((await lit(p, 'kick')) === '0'.repeat(16), 'tap it again: it goes out');
  await drag(p, 'hat', 0, 7);
  ok((await lit(p, 'hat')) === '11111111' + '0'.repeat(8), 'drag across eight empty cells: all eight light (a paint stroke)');
  await drag(p, 'hat', 2, 5);
  ok((await lit(p, 'hat')) === '11' + '0000' + '11' + '0'.repeat(8), 'start the drag on a lit cell: the cells it crosses go out');
  await drag(p, 'hat', 7, 3);
  ok((await lit(p, 'hat')) === '1100000000000000', 'dragging backwards works too: ' + (await lit(p, 'hat')));
  const st1 = await stored(p);
  ok(st1.cur.tracks.hat.slice(0, 2).join('') === '11' && st1.cur.bpm === 110, 'the pattern is kept on this device (learn.music.beats.v1)');
  // one undo step per stroke
  await p.click('#bt-clear'); await p.waitForTimeout(100);
  ok((await p.locator('.bt-cell.lit').count()) === 0, 'clear all empties the grid');
  await p.click('#bt-undo');
  ok((await lit(p, 'hat')).startsWith('110') && await p.locator('.bt-cell.lit').count() > 0, 'undo brings it back');
  await p.click('#bt-clear'); await p.click('#bt-undo'); await p.click('#bt-undo'); await p.click('#bt-undo'); await p.click('#bt-undo').catch(() => {});
  // start clean for the next checks
  await p.evaluate(() => { localStorage.removeItem('learn.music.beats.v1'); }); await p.reload(); await p.waitForSelector('.bt-cell');
  ok((await p.locator('.bt-cell.lit').count()) === 0 && await p.locator('#bt-undo').isDisabled(), 'a fresh grid is empty and undo is off');
  await drag(p, 'snare', 0, 4);
  ok((await lit(p, 'snare')).startsWith('11111'), 'a stroke of five cells...');
  await p.click('#bt-undo');
  ok((await p.locator('.bt-cell.lit').count()) === 0 && await p.locator('#bt-undo').isDisabled(), '...is ONE undo step (all five go out together, then undo is off)');
  await tap(p, 'kick', 3); await tap(p, 'kick', 7); await p.click('#bt-undo');
  ok((await lit(p, 'kick')).startsWith('0001' + '0000') , 'two taps are two undo steps (the last one is undone)');
  await p.click('#bt-clear-track');
  ok((await p.locator('.bt-cell.lit').count()) === 0, 'clear this row');
  await p.click('#bt-undo');
  ok((await lit(p, 'kick')).startsWith('0001'), 'clear row can be undone');
  // melodic rows
  await p.click('#bt-lab-piano');
  ok(await p.locator('.bt-pitch').count() === 8 && (await p.locator('.bt-pitch').allTextContents()).join('') === 'CDEGACDE', 'the piano row offers 8 notes of the C pentatonic scale: ' + (await p.locator('.bt-pitch').allTextContents()).join(''));
  await clearPlays(p);
  await p.click('.bt-pitch[data-i="3"]');
  ok((await plays(p)).some((x) => x.kind === 'piano' && x.id === 'E4'), 'choosing a note previews it (E4)');
  await tap(p, 'piano', 2);
  ok((await vals(p, 'piano'))[2] === '3' && (await p.textContent('.bt-cell[data-t="piano"][data-s="2"]')) === 'E', 'a tap lights the cell with the chosen note (E)');
  await p.click('.bt-pitch[data-i="5"]'); await tap(p, 'piano', 2);
  ok((await vals(p, 'piano'))[2] === '5' && (await lit(p, 'piano'))[2] === '1', 'another note chosen, a tap on the lit cell changes its note (A)');
  await tap(p, 'piano', 2);
  ok((await lit(p, 'piano'))[2] === '0', 'the same note again: it goes out');
  await tap(p, 'piano', 4); await p.click('#bt-scale-major');
  ok((await p.locator('.bt-pitch').allTextContents()).join('') === 'CDEFGABC' && (await p.textContent('.bt-cell[data-t="piano"][data-s="4"]')) === 'G', 'the scale picker changes the notes (major: C D E F G A B C), the cell shows the new note');
  await p.click('#bt-scale-minor');
  ok((await p.locator('.bt-pitch').allTextContents()).join('') === 'CDD#FGG#A#C', 'minor scale: ' + (await p.locator('.bt-pitch').allTextContents()).join(''));
  await p.click('#bt-scale-penta');
  await p.click('#bt-lab-guitar');
  ok((await p.locator('.bt-pitch').allTextContents()).join() === 'C,F,G,Am', 'the guitar row picks a chord: C F G Am');
  await p.click('.bt-pitch[data-i="4"]'); await clearPlays(p); await tap(p, 'guitar', 6);
  ok((await vals(p, 'guitar'))[6] === '4' && (await p.textContent('.bt-cell[data-t="guitar"][data-s="6"]')) === 'Am' && (await plays(p)).filter((x) => x.kind === 'guitar').map((x) => x.id).join() === 'A2,C3,E3', 'a guitar cell = the chord Am (A2 C3 E3 plucked): ' + (await plays(p)).map((x) => x.id));
  await p.click('#bt-lab-bass'); await p.click('.bt-pitch[data-i="2"]'); await clearPlays(p); await tap(p, 'bass', 0);
  ok((await p.locator('.bt-pitch').count()) === 5 && (await plays(p)).some((x) => x.kind === 'bass' && x.id === 'D2'), 'the bass row: five low notes, D2 plays low (bass sound)');
  await p.click('#bt-lab-open'); ok(await p.locator('.bt-pitch').count() === 0 || await p.locator('#bt-pitches').isHidden(), 'a drum row has no note picker');
  await clearPlays(p); await p.click('#bt-lab-snare');
  ok((await plays(p)).some((x) => x.id === 'snare'), 'tapping a round label previews that instrument');
  await p.click('#bt-clear');

  // ---- play, play head, scheduling on the audio clock ----
  await p.evaluate(() => { window.__timeouts = 0; window.__intervals = []; const st = window.setTimeout, si = window.setInterval; window.setTimeout = (...a) => { window.__timeouts++; return st(...a); }; window.setInterval = (...a) => { window.__intervals.push(a[1]); return si(...a); }; });
  // 120 BPM, 16 steps: kick 0 / 8, snare 4 / 12, hat 0,2,4... on the eighths
  await p.evaluate(() => { const s = document.querySelector('#bt-tempo'); s.value = '120'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap(p, 'kick', 0); await tap(p, 'kick', 8); await tap(p, 'snare', 4); await tap(p, 'snare', 12);
  ok((await p.textContent('#bt-bpm')) === '120' && (await stored(p)).cur.bpm === 120, 'the tempo slider sets 120 BPM (shown and kept)');
  await clearPlays(p); await p.evaluate(() => (window.__timeouts = 0));
  await p.click('#bt-play');
  ok((await p.textContent('#bt-play')).includes('停止') && await p.locator('#bt-play.on').count() === 1, 'play turns into stop');
  await p.waitForTimeout(700);
  const mid = await p.evaluate(() => [...document.querySelectorAll('.bt-cell.now')].map((c) => c.dataset.s));
  await p.waitForTimeout(500);
  const mid2 = await p.evaluate(() => [...document.querySelectorAll('.bt-cell.now')].map((c) => c.dataset.s));
  ok(mid.length === 10 && mid2.length === 10 && mid[0] !== mid2[0] && new Set(mid).size === 1, `the play head runs along the grid (column ${mid[0]} -> ${mid2[0]}), one whole column lit`);
  await p.waitForTimeout(1200);
  const pl = (await plays(p)).filter((x) => x.t !== undefined && (x.kind === 'drum'));
  const seq = pl.map((x) => x.id).slice(0, 5).join();
  ok(seq === 'kick,snare,kick,snare,kick', 'the sounds come in the order kick, snare, kick, snare, kick: ' + pl.map((x) => x.id).join());
  const dts = pl.slice(1, 5).map((x, i) => x.t - pl[i].t);
  ok(dts.every((d) => Math.abs(d - 0.5) < 1e-6), 'scheduled on the audio clock: 0.5 s between the hits at 120 BPM (' + dts.map((d) => d.toFixed(6)).join(' ') + ')');
  const tos = await p.evaluate(() => window.__timeouts), ints = await p.evaluate(() => window.__intervals);
  ok(tos <= 3 && ints.includes(25), `a 25 ms timer looks ahead; no timer per note (${tos} setTimeout calls while it played; intervals ${ints.join()})`);
  // an edit while playing is heard at once
  await clearPlays(p); await tap(p, 'tom', 5); await tap(p, 'tom', 13);
  await p.waitForTimeout(2300);
  ok((await plays(p)).filter((x) => x.id === 'tom1').length >= 2, 'a cell lit while it plays is heard on the next round');
  // mute
  await p.click('#bt-lab-kick'); await p.click('#bt-mute');
  ok(await p.locator('.bt-track[data-t="kick"].muted').count() === 1 && (await stored(p)).cur.mute.join() === 'kick', 'mute: the row is dimmed, kept');
  await p.waitForTimeout(200); await clearPlays(p); await p.waitForTimeout(2200);
  const after = (await plays(p)).filter((x) => x.kind === 'drum').map((x) => x.id);
  ok(after.includes('snare') && !after.includes('kick'), 'a muted row stays silent while the others play: ' + [...new Set(after)].join());
  await p.click('#bt-mute');
  await p.click('#bt-play');
  ok((await p.textContent('#bt-play')).includes('播放') && await p.locator('.bt-cell.now').count() === 0, 'stop: the play head goes away');
  await clearPlays(p); await p.waitForTimeout(500);
  ok((await plays(p)).filter((x) => x.kind !== undefined).length === 0, 'and nothing sounds after stop');
  // leaving the page stops it
  await p.click('#bt-play'); await p.waitForTimeout(300); await p.evaluate(() => (location.hash = '#/subject/music')); await p.waitForSelector('#mus-theory');
  await p.waitForTimeout(700); await clearPlays(p); await p.waitForTimeout(700);
  ok((await plays(p)).length === 0, 'leaving the page stops the loop');
  await p.evaluate(() => (location.hash = '#/music/beats')); await p.waitForSelector('.bt-cell');

  // ---- tempo, signature, steps, swing, presets, random ----
  await p.click('#bt-faster'); ok((await p.textContent('#bt-bpm')) === '125', 'tempo +5');
  await p.click('#bt-slower'); await p.click('#bt-slower'); ok((await p.textContent('#bt-bpm')) === '115', 'tempo -5');
  await p.evaluate(() => { const s = document.querySelector('#bt-tempo'); s.value = '60'; s.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('#bt-slower');
  ok((await p.textContent('#bt-bpm')) === '60', 'the slowest tempo is 60 BPM');
  await p.evaluate(() => { const s = document.querySelector('#bt-tempo'); s.value = '180'; s.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('#bt-faster');
  ok((await p.textContent('#bt-bpm')) === '180' && (await stored(p)).cur.bpm === 180, 'the fastest tempo is 180 BPM');
  await p.click('#bt-swing'); ok(await p.locator('#bt-swing.on').count() === 1 && (await stored(p)).cur.swing === true, 'swing on (kept)'); await p.click('#bt-swing');
  await p.click('#bt-preset-rock');
  ok((await lit(p, 'kick')) === 'x.......x.x.....'.replace(/x/g, '1').replace(/\./g, '0') && (await p.textContent('#bt-bpm')) === '110', 'preset rock: kick on 1, 3 and the "and" of 3, 110 BPM');
  await p.click('#bt-sig-3');
  ok(await p.locator('.bt-track[data-t="kick"] .bt-cell').count() === 12 && (await p.locator('#bt-res-2').textContent()) === '6 格' && (await p.locator('#bt-res-4').textContent()) === '12 格' && (await p.locator('.bt-hc.beat').count()) === 3, '3/4: 12 steps (or 6), three beats counted');
  await p.click('#bt-sig-4'); await p.click('#bt-res-2');
  ok(await p.locator('.bt-track[data-t="kick"] .bt-cell').count() === 8 && (await lit(p, 'kick')) === '10001100', '8 steps a bar: the grid has 8 columns and the hits moved with it: ' + (await lit(p, 'kick')));
  await p.click('#bt-undo'); await p.click('#bt-undo');
  await p.click('#bt-preset-waltz');
  ok(await p.locator('.bt-track[data-t="kick"] .bt-cell').count() === 12 && (await p.locator('#bt-sig-3.on').count()) === 1, 'preset waltz: 3/4 with 12 steps');
  for (const id of ['disco', 'hiphop', 'bossa']) { await p.click(`#bt-preset-${id}`); ok((await p.locator('.bt-cell.lit').count()) >= 8, `preset ${id} fills the grid`); }
  ok(await p.locator('#bt-swing.on').count() === 0, 'bossa has no swing (hip-hop has)');
  const before = await p.locator('.bt-cell.lit').count();
  await p.click('#bt-random'); const after2 = await p.evaluate(() => [...document.querySelectorAll('.bt-cell.lit')].map((c) => c.dataset.t + c.dataset.s).join());
  ok(await p.locator('.bt-cell.lit').count() >= 1, 'random makes a pattern');
  await p.click('#bt-undo');
  ok((await p.locator('.bt-cell.lit').count()) === before, 'and undo brings the old one back');

  // ---- saving, loading, renaming, deleting (at most 12) ----
  await p.click('#bt-preset-rock'); await p.click('#bt-clear');
  ok((await p.textContent('#bt-count')) === '0 / 12', 'my beats: none yet');
  await p.click('#bt-save'); ok((await p.textContent('#bt-count')) === '0 / 12', 'an empty grid is not saved (a message tells why)');
  await p.click('#bt-preset-rock'); await p.click('#bt-save');
  ok((await p.textContent('#bt-count')) === '1 / 12' && await p.locator('.bt-slot').count() === 1 && (await p.inputValue('.bt-slot .pn-take-name')) === '节奏 1', 'save: "节奏 1" is in the list');
  const slot = (await stored(p)).slots[0];
  ok(slot.p.tracks.kick[0] === 1 && slot.p.bpm === 110, 'the saved slot holds the pattern (on this device)');
  await p.fill('.bt-slot .pn-take-name', 'My rock'); await p.dispatchEvent('.bt-slot .pn-take-name', 'change');
  ok((await stored(p)).slots[0].name === 'My rock', 'rename');
  await p.click('#bt-clear');
  await p.click(`#bt-load-${slot.id}`);
  ok((await lit(p, 'kick')).startsWith('1000') && (await p.textContent('#bt-bpm')) === '110', 'load: the pattern comes back');
  await p.click(`#bt-del-${slot.id}`); await p.waitForSelector('dialog'); await p.click('dialog button:not(.danger)');
  await p.waitForTimeout(200);
  ok(await p.locator('.bt-slot').count() === 1 && await p.locator('dialog').count() === 0, 'delete asks first; cancel keeps it');
  ok((await p.locator('#toasts .toast').allTextContents()).every((x) => !x.includes('已删除')), 'cancelling gives no "done" message');
  await p.click(`#bt-del-${slot.id}`); await p.waitForSelector('dialog'); await p.click('dialog button.danger');
  await p.waitForFunction(() => document.querySelectorAll('.bt-slot').length === 0);
  ok((await stored(p)).slots.length === 0, 'confirmed: the slot is gone');
  for (let i = 0; i < 12; i++) await p.click('#bt-save');
  ok((await p.textContent('#bt-count')) === '12 / 12', 'twelve beats can be saved');
  await p.click('#bt-save');
  ok((await p.textContent('#bt-count')) === '12 / 12' && (await stored(p)).slots.length === 12 && (await p.locator('#toasts .toast').last().textContent()).includes('12'), 'the 13th is refused with a message');
  // survives a reload
  await p.click('#bt-clear'); await p.click('#bt-preset-disco');
  await p.reload(); await p.waitForSelector('.bt-cell');
  ok((await lit(p, 'kick')) === '1000100010001000' && (await p.locator('.bt-slot').count()) === 12 && (await p.textContent('#bt-bpm')) === '120', 'after a reload the pattern, the tempo and the 12 saved beats are still there');

  // ---- export ----
  await p.click('#bt-preset-rock'); await p.click('#bt-bars-2');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bt-export')]);
  const bytes = fs.readFileSync(await dl.path()); const M = parseMidi(bytes);
  ok(dl.suggestedFilename().endsWith('.mid') && bytes.slice(0, 4).toString() === 'MThd', 'export: a .mid file: ' + dl.suggestedFilename());
  const kicks = M.on.filter((x) => x.ch === 9 && x.n === 36).map((x) => x.tick).join();
  ok(kicks === '0,960,1200,1920,2880,3120' && M.end === 3840 && M.tempo === Math.round(60000000 / 110), 'the file holds the rock loop twice: kick at 0 960 1200 (and again one bar later), tempo 110: ' + kicks);
  ok(M.on.filter((x) => x.ch === 9 && x.n === 38).length === 4 && M.on.filter((x) => x.ch === 9 && x.n === 42).length === 16 && M.on.filter((x) => x.ch === 9 && x.n === 49).length === 2, 'snare x4, closed hat x16, crash x2 on channel 10');
  ok((await stored(p)).bars === 2, 'the chosen length is kept');

  // ---- keyboard ----
  await p.click('#bt-clear');
  await p.focus('#bt-grid');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown');
  ok(await p.locator('.bt-cell.cur[data-t="snare"][data-s="2"]').count() === 1, 'arrow keys move a cursor over the grid');
  await p.keyboard.press('Space');
  ok((await lit(p, 'snare'))[2] === '1', 'Space lights the cell under the cursor');
  await p.keyboard.press('Enter');
  ok((await lit(p, 'snare'))[2] === '0', 'Enter toggles it again');
  await p.keyboard.press('Space'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
  ok(await p.locator('.bt-cell.cur[data-t="kick"][data-s="0"]').count() === 1, 'the cursor stops at the edges');
  await p.keyboard.press('p');
  ok((await p.textContent('#bt-play')).includes('停止'), 'P plays');
  await p.keyboard.press('p'); ok((await p.textContent('#bt-play')).includes('播放'), 'P stops');
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('Space');
  ok((await p.textContent('#bt-play')).includes('停止'), 'Space outside the grid plays / stops');
  await p.keyboard.press('Space'); await p.focus('#bt-grid'); await p.keyboard.press('Shift+Space');
  ok((await p.textContent('#bt-play')).includes('停止'), 'Shift+Space plays from the grid too');
  await p.keyboard.press('Shift+Space');
  await p.screenshot({ path: OUT + 'beats-desktop.png' });

  // ---- full screen ----
  await p.click('#bt-preset-rock');
  await p.click('#bt-full'); await p.waitForTimeout(500);
  const f = await p.evaluate(() => { const r = document.querySelector('#bt-grid').getBoundingClientRect(), w = document.querySelector('.bt-wrap').getBoundingClientRect(); const rows = [...document.querySelectorAll('.bt-track')].map((e) => e.getBoundingClientRect()); return { hero: getComputedStyle(document.querySelector('.inst-page > .top')).display, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, label: document.querySelector('#bt-full').textContent, bottom: w.bottom, rowsIn: rows.every((x) => x.top >= w.top - 1 && x.bottom <= w.bottom + 1), minH: Math.min(...rows.map((x) => x.height)), sw: document.documentElement.scrollWidth, panel: document.querySelector('#bt-panel').getBoundingClientRect().bottom }; });
  ok(f.hero === 'none' && f.label.includes('退出') && f.w >= f.vw * 0.94 && f.h >= f.vh * 0.6 && f.sw <= f.vw && f.panel <= f.vh + 1, `full screen: the title band is gone, the grid fills ${Math.round(f.w)} x ${Math.round(f.h)} of ${f.vw} x ${f.vh}, the track panel stays on screen`);
  ok(f.rowsIn && f.minH >= 24, `full screen: all ten rows are inside the grid area (smallest row ${Math.round(f.minH)} px)`);
  await p.screenshot({ path: OUT + 'beats-fullscreen-desktop.png' });
  await clearPlays(p); await tap(p, 'snare', 6); await p.click('#bt-play'); await p.waitForTimeout(400); await p.click('#bt-play');
  ok(await p.locator('.bt-cell.lit').count() > 3, 'still editable and playable in full screen');
  await p.click('#bt-full'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => getComputedStyle(document.querySelector('.inst-page > .top')).display)) !== 'none', 'leaving full screen brings the page back');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ================= screens and phones =================
  for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }], ['ipad-land', { width: 1180, height: 820 }], ['phone-land', { width: 844, height: 390 }], ['small-phone', { width: 320, height: 568 }]]) {
    const s = await start(new Map(), { local: true, viewport: vp, today: '2026-11-12' });
    await s.page.evaluate(() => (location.hash = '#/music/beats')); await s.page.waitForSelector('.bt-cell');
    await s.page.click('#bt-preset-rock'); await s.page.waitForTimeout(250);
    const m = await s.page.evaluate(() => { const vw = document.documentElement.clientWidth, r = document.querySelector('#bt-grid').getBoundingClientRect(), c = [...document.querySelectorAll('.bt-track[data-t="kick"] .bt-cell')].map((e) => e.getBoundingClientRect()); const out = [...document.querySelectorAll('.bt-bar > *, .bt-presets > *, .bt-panel > *, .bt-grid, .bt-export > *, .bt-mine-h > *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 1 || b.left < -1); }).length; return { sw: document.documentElement.scrollWidth <= vw, vw, l: r.left, r: vw - r.right, cells: c.length, cw: Math.min(...c.map((x) => x.width)), pager: !document.querySelector('#bt-pager').hidden, info: document.querySelector('#bt-page-info').textContent, firstS: document.querySelector('.bt-cell').dataset.s, out, rows: document.querySelectorAll('.bt-track').length }; });
    ok(m.sw && m.out === 0, `${dn}: no horizontal scroll, every control inside the screen`);
    ok(Math.abs(m.l - m.r) <= 2 && m.l >= 0, `${dn}: the grid has equal space left and right (${Math.round(m.l)} / ${Math.round(m.r)} px)`);
    ok(m.cw >= 20 && m.rows === 10, `${dn}: ${m.cells} steps shown, the smallest cell is ${m.cw.toFixed(1)} px wide (>= 20)${m.pager ? ', paged ' + m.info : ''}`);
    if (dn === 'phone' || dn === 'small-phone') {
      ok(m.pager && m.cells === 8 && m.firstS === '0', `${dn}: 16 steps do not fit at 20 px, so 8 steps per page with page buttons (${m.info})`);
      await s.page.click('#bt-page-next');
      const second = await s.page.evaluate(() => ({ first: document.querySelector('.bt-cell').dataset.s, info: document.querySelector('#bt-page-info').textContent, hc: [...document.querySelectorAll('.bt-hc')].map((e) => e.textContent).join(''), lit: [...document.querySelectorAll('.bt-track[data-t="kick"] .bt-cell')].map((e) => (e.classList.contains('lit') ? 1 : 0)).join('') }));
      ok(second.first === '8' && second.info === '2 / 2' && second.lit === '10100000' && second.hc === '3···4···', `${dn}: page 2 shows steps 9-16 with their hits (${second.lit}) and the beat count ${second.hc}`);
      // a tap on page 2 is a tap on step 8+
      const c = await center(s.page, 'snare', 12); await ptr(s.page, 'pointerdown', 1, c.x, c.y); await ptr(s.page, 'pointerup', 1, c.x, c.y);
      ok((await s.page.evaluate(() => JSON.parse(localStorage.getItem('learn.music.beats.v1')).cur.tracks.snare[12])) === 0, `${dn}: a tap on the lit snare of page 2 (step 13) puts it out`);
      await s.page.click('#bt-page-prev');
      // the page follows the play head
      await s.page.evaluate(() => { const x = document.querySelector('#bt-tempo'); x.value = '180'; x.dispatchEvent(new Event('input', { bubbles: true })); });
      await s.page.click('#bt-play'); await s.page.waitForTimeout(1000);
      const now = await s.page.evaluate(() => [...document.querySelectorAll('.bt-cell.now')].map((e) => +e.dataset.s));
      await s.page.click('#bt-play');
      ok(now.length > 0 && now.every((x) => x >= 0 && x <= 15), `${dn}: the page follows the play head while it plays (step ${now[0]})`);
    }
    await s.page.screenshot({ path: OUT + `beats-${dn}.png` });
    await s.browser.close();
  }
  // full screen on the small landscape phone and a tall phone
  for (const [dn, vp] of [['phone-land', { width: 844, height: 390 }], ['phone', { width: 390, height: 844 }]]) {
    const s = await start(new Map(), { local: true, viewport: vp, today: '2026-11-12' });
    await s.page.evaluate(() => (location.hash = '#/music/beats')); await s.page.waitForSelector('.bt-cell');
    await s.page.click('#bt-preset-disco'); await s.page.click('#bt-full'); await s.page.waitForTimeout(500);
    const f = await s.page.evaluate(() => { const w = document.querySelector('.bt-wrap').getBoundingClientRect(), g = document.querySelector('#bt-grid').getBoundingClientRect(); return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, wb: w.bottom, wt: w.top, gl: g.left, gr: innerWidth - g.right, panelB: document.querySelector('#bt-panel').getBoundingClientRect().bottom, scrolls: document.querySelector('.bt-wrap').scrollHeight > document.querySelector('.bt-wrap').clientHeight + 1, cw: document.querySelector('.bt-cell').getBoundingClientRect().width }; });
    ok(f.sw <= f.vw && f.panelB <= f.vh + 1 && Math.abs(f.gl - f.gr) <= 3 && f.cw >= 20, `${dn} full screen: fits the screen (grid ${Math.round(f.gl)} / ${Math.round(f.gr)} px from the sides, panel ends at ${Math.round(f.panelB)} of ${f.vh}, rows ${f.scrolls ? 'scroll' : 'all visible'}, cell ${Math.round(f.cw)} px)`);
    await s.page.screenshot({ path: OUT + `beats-fullscreen-${dn}.png` });
    await s.browser.close();
  }

  // ================= languages =================
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }], ['land', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await s.page.evaluate(() => (location.hash = '#/subject/music')); await s.page.waitForSelector('#mus-beats'); await s.page.waitForTimeout(250);
      const home = await s.page.evaluate(() => { const b = document.querySelector('#mus-beats b'); return { ok: b.scrollWidth <= b.clientWidth + 1, text: b.textContent, sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
      await s.page.evaluate(() => (location.hash = '#/music/beats')); await s.page.waitForSelector('.bt-cell');
      await s.page.click('#bt-preset-rock'); await s.page.click('#bt-lab-piano'); await s.page.waitForTimeout(250);
      await s.page.click('#bt-save'); await s.page.waitForTimeout(100);
      const r = await s.page.evaluate(() => { const vw = document.documentElement.clientWidth; const attrs = [...document.querySelectorAll('[title],[aria-label]')].flatMap((e) => [e.getAttribute('title'), e.getAttribute('aria-label')]).filter(Boolean).join(' '); const slotName = document.querySelector('.bt-slot .pn-take-name').value; const body = (document.querySelector('main').innerText || '') + ' ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' '); const out = [...document.querySelectorAll('.bt-bar > *, .bt-presets > *, .bt-panel > *, .bt-grid, .bt-export > *, .bt-mine-h > *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 1 || b.left < -1); }).length; return { sw: document.documentElement.scrollWidth <= vw, out, cjk: /[一-鿿]/.test(body), cjkAttr: /[一-鿿]/.test(attrs), title: document.querySelector('.hero h1').textContent, slotName, labels: [...document.querySelectorAll('.bt-name')].map((e) => e.textContent).join(), pre: document.querySelector('#bt-presets').innerText.replace(/\n/g, ' ') }; });
      ok(r.sw && r.out === 0 && home.sw && home.ok, `${name} ${dn}: the page and the card name fit the screen (${home.text})`);
      if (name !== 'zh') ok(!r.cjk && !r.cjkAttr && !/[一-鿿]/.test(r.title) && !/[一-鿿]/.test(r.slotName), `${name} ${dn}: no Chinese left on the page, in titles / labels, or in the saved name "${r.slotName}": ${r.title}`);
      if (name === 'en' && dn === 'ipad') ok(r.labels === 'Bass drum,Snare,Hi-hat,Open hi-hat,Tom,Crash,Ride,Piano,Guitar,Bass', 'en: the instrument names: ' + r.labels);
      if (dn === 'ipad') await s.page.screenshot({ path: OUT + `beats-${name}-ipad.png` });
      if (name !== 'zh' && dn === 'phone') await s.page.screenshot({ path: OUT + `beats-${name}-phone.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
})();
