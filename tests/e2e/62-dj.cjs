// DJ turntables (DJ 打碟, #/music/dj): the pure logic (equal-power crossfader, tempo -> rate, BPM sync, platter angle -> scratch rate, EQ / filter mapping, the eight tracks and
// the eight pads), the eight tracks RENDERED in the browser (length, not silent, no NaN, no clipping, a seamless loop, a sound in every bar), and the screen: card + route,
// both decks play / pause / CUE, the platter turns while playing, SCRATCHING with synthetic pointer events (forward, backward = the reversed copy, held, smooth return, two decks at
// once, a paused deck), crossfader / volume / EQ / filter / master on the REAL audio nodes (window.__dj.probe()), tempo fader, SYNC, echo / brake / flanger, the pads, the meters,
// keys, recording, full screen, five screen sizes, EN / FR, no outside request.
// Real fingers, the real sound and latency on an iPad / iPhone and how good the scratch sounds are NOT tested (the test reads the model and the audio-node values, not the sound).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }], ['ipad-land', { width: 1180, height: 820 }], ['phone-land', { width: 844, height: 390 }], ['small-phone', { width: 320, height: 568 }]];
const wait = (p, ms) => p.waitForTimeout(ms);
const setPlay = async (p, i, want) => { const is = await p.evaluate((i) => window.__dj.decks[i].playing, i); if (is !== want) await p.click(i === 0 ? '#dj-play-a' : '#dj-play-b'); };

/** helpers in the page: synthetic pointers (one pointer id each) */
const installHelpers = (page) => page.evaluate(() => {
  const el = (s) => document.querySelector(s);
  const ev = (s, type, id, x, y) => el(s).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
  const geo = (s) => { const r = el(s).getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2, l: r.left, t: r.top, w: r.width, h: r.height }; };
  const at = (s, deg, f = 0.7) => { const g = geo(s); return [g.cx + Math.cos((deg * Math.PI) / 180) * g.r * f, g.cy + Math.sin((deg * Math.PI) / 180) * g.r * f]; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__t = {
    ev, geo, at, sleep,
    down: (s, id, deg) => ev(s, 'pointerdown', id, ...at(s, deg)),
    up: (s, id, deg) => ev(s, 'pointerup', id, ...at(s, deg)),
    /** moves a finger round the platter by `step` degrees `n` times, `ms` apart; returns what the deck did on the way */
    spin: async (s, id, from, step, n, ms, deck) => {
      const out = [];
      for (let k = 1; k <= n; k++) { await sleep(ms); ev(s, 'pointermove', id, ...at(s, from + step * k)); const d = window.__dj.decks[deck]; out.push({ cur: d.cur, rate: d.scratchRate, dir: d.dir, scratching: d.scratching }); }
      return out;
    },
  };
});

(async () => {
  // ================= the pure logic =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/djlogic.ts');
      const o = {};
      const g = (x) => L.crossGains(x);
      o.ends = [g(-1), g(1), g(0)];
      o.power = Array.from({ length: 41 }, (_, k) => { const q = g(-1 + k / 20); return q.a * q.a + q.b * q.b; });
      o.mono = Array.from({ length: 41 }, (_, k) => g(-1 + k / 20)).every((q, k, a) => k === 0 || (q.a <= a[k - 1].a + 1e-12 && q.b >= a[k - 1].b - 1e-12));
      o.clamp = [g(-5), g(5)];
      o.rate = [L.rateOf(0), L.rateOf(8), L.rateOf(-8), L.rateOf(30), L.rateOf(-30), L.bpmOf(120, 5), L.bpmOf(124, 0)];
      o.sync = [L.syncPitch(124, 124), L.syncPitch(124, 120), L.syncPitch(100, 104), L.syncPitch(124, 62), L.syncPitch(62, 124), L.syncPitch(120, 90), L.syncPitch(90, 172), L.syncPitch(100, 172), L.syncPitch(124, 90)];
      o.ang = [L.angleOf(0, 0, 10, 0), L.angleOf(0, 0, 0, 10), L.angleOf(0, 0, -10, 0), L.angleOf(0, 0, 0, -10), L.angleOf(5, 5, 15, 15)];
      o.delta = [L.angleDelta(170, -170), L.angleDelta(-170, 170), L.angleDelta(0, 90), L.angleDelta(10, 10), L.angleDelta(0, 180), L.angleDelta(90, 0), L.angleDelta(350, 10), L.angleDelta(0, 350)];
      o.scr = [L.scratchRate(20, 0.1), L.scratchRate(-20, 0.1), L.scratchRate(0, 0.1), L.scratchRate(400, 0.01), L.scratchRate(-400, 0.01), L.scratchRate(10, 0), L.platterSpeed(1), L.platterSpeed(-0.5), L.platterSpeed(0)];
      o.eq = [L.eqDb(0), L.eqDb(1), L.eqDb(-1), L.eqDb(0.5), L.eqDb(-0.5), L.eqDb(2), L.eqDb(-2)];
      o.flt = [L.filterFreqs(0), L.filterFreqs(-1), L.filterFreqs(1), L.filterFreqs(-0.5), L.filterFreqs(0.5), L.filterFreqs(-3)];
      o.fltMono = Array.from({ length: 21 }, (_, k) => L.filterFreqs(-1 + k / 10)).every((f, k, a) => k === 0 || (f.lp >= a[k - 1].lp - 1e-9 && f.hp >= a[k - 1].hp - 1e-9));
      o.tracks = L.TRACKS.map((x) => ({ id: x.id, bpm: x.bpm, bars: x.bars, sec: L.loopSeconds(x), frames: L.loopFrames(x), step: L.stepSeconds(x), rows: [x.kick, x.snare, x.hat, x.oh ?? '.'.repeat(16), x.clap ?? '.'.repeat(16), x.fill ?? '.'.repeat(16), x.chordSteps].every((s) => s.length === 16 && /^[x.o]+$/.test(s)), bass: x.bass.length, prog: x.prog.length, hasKick: /x/.test(x.kick), name: x.name, color: x.color }));
      o.byId = [L.trackById('house')?.bpm, L.trackById('nope')];
      o.triad = [L.triad(60, false), L.triad(60, true)];
      o.pads = L.PADS.map((p) => p.id);
      o.keys = [L.padOfKey('1'), L.padOfKey('8'), L.padOfKey('9'), L.padOfKey('0'), L.padOfKey('a'), L.padOfKey('')];
      o.def = L.DEFAULT_TRACKS;
      return o;
    });
    const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
    ok(near(r.ends[0].a, 1) && near(r.ends[0].b, 0) && near(r.ends[1].a, 0) && near(r.ends[1].b, 1) && near(r.ends[2].a, Math.SQRT1_2) && near(r.ends[2].b, Math.SQRT1_2), 'crossfader: all A at the left end, all B at the right end, 0.707 / 0.707 in the middle');
    ok(r.power.every((x) => near(x, 1, 1e-9)) && r.mono, 'crossfader: equal power everywhere (a² + b² = 1, 41 points) and A only falls, B only rises');
    ok(near(r.clamp[0].a, 1) && near(r.clamp[1].b, 1), 'crossfader: out-of-range values are clamped');
    ok(r.rate[0] === 1 && near(r.rate[1], 1.08) && near(r.rate[2], 0.92) && near(r.rate[3], 1.08) && near(r.rate[4], 0.92) && near(r.rate[5], 126) && r.rate[6] === 124, 'tempo: fader +-8 % -> playback rate 0.92..1.08 (clamped), BPM = track BPM x rate: ' + r.rate.map((x) => +x.toFixed(3)).join(' '));
    ok(r.sync[0].pitch === 0 && r.sync[0].ok && r.sync[1].pitch === 3.3 && r.sync[1].ok && r.sync[2].pitch === -3.8 && r.sync[3].pitch === 0 && r.sync[3].mult === 2 && r.sync[3].ok && r.sync[4].pitch === 0 && r.sync[4].mult === 0.5 && !r.sync[5].ok && r.sync[5].pitch === 8 && r.sync[6].ok && r.sync[6].mult === 0.5 && r.sync[6].pitch === 4.7 && !r.sync[7].ok && r.sync[8].pitch === 8 && r.sync[8].mult === 1 && !r.sync[8].ok, 'sync: 124 -> 120 = +3.3 %, 100 -> 104 = -3.8 %, half / double speed is found (62 vs 124, 90 vs 172), out of range goes to the limit in the nearer direction and says so: ' + JSON.stringify(r.sync.map((x) => [x.pitch, x.ok, x.mult])));
    ok(r.ang[0] === 0 && r.ang[1] === 90 && Math.abs(r.ang[2]) === 180 && r.ang[3] === -90 && near(r.ang[4], 45), 'platter angle: right = 0, down = 90 (clockwise on the screen), left = 180, up = -90: ' + r.ang.join(' '));
    ok(r.delta.join() === '20,-20,90,0,180,-90,20,-10', 'platter angle: the shortest turn, no jump across the +-180 line: ' + r.delta.join());
    ok(near(r.scr[0], 1) && near(r.scr[1], -1) && r.scr[2] === 0 && r.scr[3] === 4 && r.scr[4] === -4 && r.scr[5] === 4 && r.scr[6] === 200 && r.scr[7] === -100 && r.scr[8] === 0, 'scratch rate: 200 degrees a second = normal speed, backwards is negative, limited to +-4, zero time is safe: ' + r.scr.join(' '));
    ok(r.eq.join() === '0,6,-30,3,-15,6,-30', 'EQ: 0 = flat, +1 = +6 dB, -1 = -30 dB (a cut), clamped: ' + r.eq.join());
    ok(r.flt[0].lp === 20000 && r.flt[0].hp === 20 && near(r.flt[1].lp, 200, 1e-6) && r.flt[1].hp === 20 && r.flt[2].lp === 20000 && near(r.flt[2].hp, 8000, 1e-6) && near(r.flt[3].lp, 2000, 1e-6) && near(r.flt[4].hp, 400, 1e-6) && near(r.flt[5].lp, 200, 1e-6) && r.fltMono, 'filter: open in the middle, low-pass 20 kHz -> 200 Hz to the left, high-pass 20 Hz -> 8 kHz to the right, always rising');
    ok(r.tracks.length === 8 && new Set(r.tracks.map((x) => x.id)).size === 8 && new Set(r.tracks.map((x) => x.name)).size === 8 && new Set(r.tracks.map((x) => x.color)).size === 8, 'tracks: eight, each with its own id, name and colour: ' + r.tracks.map((x) => x.id).join());
    ok(r.tracks.every((x) => x.bpm >= 80 && x.bpm <= 175 && [4, 8].includes(x.bars) && x.sec <= 12 && x.sec >= 6 && x.frames === Math.round(x.sec * 44100)), 'tracks: 80-175 BPM, 4 or 8 bars, 6-12 s a loop (small buffers): ' + r.tracks.map((x) => `${x.id} ${x.bpm}/${x.sec.toFixed(1)}s`).join(' '));
    ok(r.tracks.every((x) => x.rows && x.bass === 16 && x.prog >= 1 && x.hasKick), 'tracks: every pattern row has 16 steps of x . o, a bass line of 16 steps, a chord progression and a kick');
    ok(r.byId[0] === 124 && r.byId[1] === undefined && r.triad[0].join() === '60,64,67' && r.triad[1].join() === '60,63,67', 'tracks: lookup by id, major and minor triads');
    ok(r.pads.join() === 'horn,siren,laser,clap,scratch,stab,drop,rewind' && r.keys.join() === 'horn,rewind,,,,' && r.def.join() === 'house,disco', 'pads: eight (air horn, siren, laser, clap, scratch, stab, bass drop, rewind), keys 1-8 only');
    await t.browser.close();
  }

  // ================= the eight tracks, rendered in the browser =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/djlogic.ts'), T = await import('/src/djtracks.ts');
      const out = [];
      for (const def of L.TRACKS) {
        const t0 = performance.now();
        const buf = await T.renderTrack(def);
        const ms = performance.now() - t0;
        const d = buf.getChannelData(0), n = d.length;
        let peak = 0, sum = 0, nan = 0, maxStep = 0, big = 0;
        for (let i = 0; i < n; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan++; continue; } peak = Math.max(peak, Math.abs(v)); sum += v * v; if (i) maxStep = Math.max(maxStep, Math.abs(v - d[i - 1])); }
        const seam = Math.abs(d[0] - d[n - 1]);
        // the biggest step between two samples inside the loop, measured over 1 s windows: the seam must not be a click
        const barLen = Math.round(n / def.bars), bars = [];
        for (let b = 0; b < def.bars; b++) { let s = 0; for (let i = b * barLen; i < Math.min(n, (b + 1) * barLen); i++) s += d[i] * d[i]; bars.push(Math.sqrt(s / barLen)); }
        const again = await T.renderTrack(def);
        const rev = T.reversed(def.id, buf), rd = rev.getChannelData(0);
        out.push({ id: def.id, n, want: L.loopFrames(def), sr: buf.sampleRate, ch: buf.numberOfChannels, dur: buf.duration, peak, rms: Math.sqrt(sum / n), nan, first: d[0], last: d[n - 1], seam, maxStep, minBar: Math.min(...bars), same: again === buf, rev: rd[0] === d[n - 1] && rd[n - 1] === d[0] && rd[1234] === d[n - 1 - 1234] && rev.length === n && T.reversed(def.id, buf) === rev, ms });
      }
      return out;
    });
    for (const x of r) {
      ok(x.n === x.want && x.sr === 44100 && x.ch === 1 && x.dur <= 12, `track ${x.id}: ${x.n} samples = the loop length, mono 44.1 kHz, ${x.dur.toFixed(2)} s (rendered in ${Math.round(x.ms)} ms)`);
      ok(x.nan === 0 && x.peak <= 1.0 && x.peak >= 0.5 && x.rms > 0.03 && x.minBar > 0.01, `track ${x.id}: no NaN, peak ${x.peak.toFixed(2)} (<= 1, not tiny), rms ${x.rms.toFixed(3)}, every bar sounds (quietest bar ${x.minBar.toFixed(3)})`);
      ok(Math.abs(x.first) < 0.25 && Math.abs(x.last) < 0.25 && x.seam <= 0.1 && x.seam <= x.maxStep, `track ${x.id}: loops seamlessly (first ${x.first.toFixed(3)}, last ${x.last.toFixed(3)}; the jump at the seam ${x.seam.toFixed(3)} is under 0.1 and no bigger than the biggest step inside, ${x.maxStep.toFixed(3)})`);
      ok(x.same && x.rev, `track ${x.id}: rendered once (cached), the reversed copy is the loop backwards`);
    }
    ok(t.log.external.length === 0, 'tracks: made in code, nothing was fetched');
    await t.browser.close();
  }

  // ================= the screen on a desktop =================
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const p = t.page;
  const dj = (f) => p.evaluate(f);
  const D = (i) => p.evaluate((i) => { const d = window.__dj.decks[i]; return { ...d }; }, i);
  const probe = () => p.evaluate(() => window.__dj.probe());
  await p.evaluate(() => (location.hash = '#/subject/music')); await p.waitForSelector('#mus-dj');
  ok((await p.locator('.mus-card').count()) === 6 && (await p.textContent('#mus-dj b')) === 'DJ 打碟', 'music home: the sixth card "DJ 打碟" is there');
  await p.click('#mus-dj');
  await p.waitForSelector('#dj-platter-a');
  ok((await p.evaluate(() => location.hash)) === '#/music/dj' && (await p.textContent('.hero h1')) === 'DJ 打碟', 'the card opens #/music/dj');
  await installHelpers(p);
  await p.waitForFunction(() => window.__dj && window.__dj.decks.every((d) => !d.loading));
  ok((await p.locator('#dj-load-a').isHidden()) && (await p.locator('#dj-load-b').isHidden()), 'both decks are loaded: the "generating" notes are gone');
  ok((await p.inputValue('#dj-track-a')) === 'house' && (await p.inputValue('#dj-track-b')) === 'disco' && (await p.locator('#dj-track-a option').count()) === 8, 'the track pickers hold the eight tracks (house on A, disco on B)');
  ok((await p.textContent('#dj-bpm-a')) === '124.0' && (await p.textContent('#dj-bpm-b')) === '120.0', 'the BPM of each deck is shown (124.0 / 120.0)');
  ok(JSON.stringify(await probe()) === 'null', 'no sound graph before the first touch');

  // ---- play / pause, the platter turns ----
  await p.click('#dj-play-a');
  ok((await probe()) !== null, 'the first touch builds the audio graph');
  await wait(p, 500);
  let a1 = await D(0), ang1 = await p.getAttribute('#dj-platter-a', 'data-angle'); await wait(p, 300); const ang2 = await p.getAttribute('#dj-platter-a', 'data-angle'); const a2 = await D(0);
  const pr = await probe();
  ok(a1.playing && a1.cur > 0.95 && a1.cur < 1.05 && ang1 !== ang2 && a2.pos !== a1.pos && (await p.locator('#dj-platter-a.turning').count()) === 1, `deck A plays: the platter turns (angle ${ang1} -> ${ang2}), rate ${a1.cur.toFixed(3)}, position moves`);
  ok(a2.sounding && pr.decks[0].rate > 0.95 && pr.decks[0].rate < 1.06 && (await p.textContent('#dj-play-a')).includes('暂停') && (await p.locator('#dj-play-a.on').count()) === 1, 'the audio source runs at the tempo rate; the button says pause');
  ok(!(await D(1)).playing && !(await D(1)).sounding && (await p.locator('#dj-platter-b.turning').count()) === 0, 'deck B is not affected');
  // about 200 degrees a second
  const turn = await p.evaluate(async () => { const a = +document.querySelector('#dj-platter-a').dataset.angle; await new Promise((r) => setTimeout(r, 500)); const b = +document.querySelector('#dj-platter-a').dataset.angle; return ((b - a + 360) % 360); });
  ok(turn > 80 && turn < 120, `33 1/3 turns a minute: the platter turns about 100 degrees in half a second (${turn.toFixed(0)})`);
  await p.click('#dj-play-a'); await wait(p, 900);
  const stopA = await p.getAttribute('#dj-platter-a', 'data-angle'); await wait(p, 300);
  ok(!(await D(0)).playing && (await D(0)).cur === 0 && !(await D(0)).sounding && stopA === (await p.getAttribute('#dj-platter-a', 'data-angle')) && (await p.locator('#dj-platter-a.turning').count()) === 0 && (await p.textContent('#dj-play-a')).includes('播放'), 'pause: the platter slows down and stops, the source is stopped, the position is kept');
  // CUE
  const pos0 = (await D(0)).pos;
  await p.evaluate(() => { const c = window.__t; c.ev('#dj-cue-a', 'pointerdown', 5, 10, 10); });
  await wait(p, 400);
  const cueOn = await D(0);
  await p.evaluate(() => window.__t.ev('#dj-cue-a', 'pointerup', 5, 10, 10)); await wait(p, 200);
  const cueOff = await D(0);
  ok(cueOn.cueHold && cueOn.cur > 0.9 && cueOn.sounding && !cueOff.cueHold && cueOff.cur === 0 && !cueOff.sounding && Math.abs(cueOff.pos - cueOff.cue) < 1e-6 && Math.abs(cueOff.cue - pos0) < 1e-3, `CUE: held = plays from the cue point (${pos0.toFixed(2)} s), released = stops and returns to it`);
  await p.click('#dj-play-a'); await wait(p, 600);
  await p.click('#dj-cue-a'); await wait(p, 300);
  const cueP = await D(0);
  ok(!cueP.playing && cueP.pos === cueP.cue && cueP.cue === cueOff.cue, 'CUE while playing: jumps back to the cue point and stops');

  // ---- the keys: Space = A, Enter = B, also when a button has the focus ----
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Space'); await wait(p, 100);
  ok((await D(0)).playing && !(await D(1)).playing, 'Space plays deck A');
  await p.keyboard.press('Enter'); await wait(p, 100);
  ok((await D(0)).playing && (await D(1)).playing, 'Enter plays deck B');
  await p.keyboard.press('Space'); await p.keyboard.press('Enter'); await wait(p, 100);
  ok(!(await D(0)).playing && !(await D(1)).playing, 'Space and Enter pause them again');
  const syncs0 = await p.evaluate(() => window.__dj.syncs);
  await p.focus('#dj-fx-echo'); await p.keyboard.press('Space'); await wait(p, 100);
  ok((await D(0)).playing && (await p.evaluate(() => window.__dj.fx.echo)) === false, 'Space plays the deck even when a button has the focus (the button is not pressed)');
  await p.keyboard.press('Space'); await wait(p, 600);

  // ---- tempo fader ----
  await p.focus('#dj-pitch-a'); for (let k = 0; k < 4; k++) await p.keyboard.press('ArrowRight');
  await wait(p, 120);
  const pit = await D(0);
  ok(pit.pitch > 3.0 && pit.pitch < 4.5 && Math.abs(pit.bpm - 124 * (1 + pit.pitch / 100)) < 0.01 && (await p.textContent('#dj-bpm-a')) === pit.bpm.toFixed(1) && (await p.textContent('#dj-pct-a')).includes(pit.pitch.toFixed(1)), `tempo fader by keys: +${pit.pitch} % -> ${pit.bpm.toFixed(1)} BPM shown`);
  await setPlay(p, 0, true); await wait(p, 1100);
  ok(Math.abs((await probe()).decks[0].rate - (1 + pit.pitch / 100)) < 0.01, 'the playing source follows the tempo fader (rate ' + (await probe()).decks[0].rate.toFixed(3) + ')');
  await p.evaluate(() => { const g = window.__t.geo('#dj-pitch-a'); window.__t.ev('#dj-pitch-a', 'pointerdown', 3, g.l + g.w + 30, g.cy); window.__t.ev('#dj-pitch-a', 'pointerup', 3, g.l + g.w + 30, g.cy); });
  await wait(p, 120);
  ok((await D(0)).pitch === 8 && (await p.textContent('#dj-bpm-a')) === '133.9', 'dragging the fader to the far right stops at +8 % = 133.9 BPM (never beyond)');
  await p.evaluate(() => { const g = window.__t.geo('#dj-pitch-a'); window.__t.ev('#dj-pitch-a', 'pointerdown', 3, g.l - 30, g.cy); window.__t.ev('#dj-pitch-a', 'pointerup', 3, g.l - 30, g.cy); });
  await wait(p, 120);
  ok((await D(0)).pitch === -8 && (await p.textContent('#dj-bpm-a')) === '114.1', 'far left: -8 % = 114.1 BPM');
  await p.dblclick('#dj-pitch-a'); await wait(p, 100);
  await wait(p, 150);
  ok((await D(0)).pitch === 0 && (await p.textContent('#dj-bpm-a')) === '124.0', 'double tap on the fader brings it back to 0');
  await setPlay(p, 0, true); await wait(p, 300);

  // ---- track picker ----
  const lbl = await p.evaluate(async () => { const s = document.querySelector('#dj-track-b'); s.value = 'dnb'; s.dispatchEvent(new Event('change', { bubbles: true })); return { shown: !document.querySelector('#dj-load-b').hidden, dis: s.disabled, loading: window.__dj.decks[1].loading }; });
  ok(lbl.shown && lbl.dis && lbl.loading, 'choosing a track shows "generating…" and blocks the picker while it is made');
  await p.waitForFunction(() => !window.__dj.decks[1].loading); await wait(p, 100);
  ok((await D(1)).track === 'dnb' && (await p.textContent('#dj-bpm-b')) === '172.0' && (await p.locator('#dj-load-b').isHidden()) && !(await p.locator('#dj-track-b').isDisabled()) && (await D(1)).pos < 1, 'the new track is loaded (drum and bass, 172.0 BPM), the picker works again');
  await p.selectOption('#dj-track-b', 'disco'); await p.waitForFunction(() => !window.__dj.decks[1].loading); await wait(p, 120);
  ok((await D(1)).track === 'disco' && (await p.textContent('#dj-bpm-b')) === '120.0', 'back to disco (from the cache)');
  for (const id of ['house', 'boombap', 'funk', 'synthwave', 'techno', 'disco', 'lofi', 'dnb']) {
    await p.selectOption('#dj-track-a', id); await p.waitForFunction(() => !window.__dj.decks[0].loading);
    const bpm = await p.evaluate((id) => ({ shown: document.querySelector('#dj-bpm-a').textContent, want: window.__dj.decks[0].track }), id);
    if (bpm.want !== id) ok(false, 'picker: ' + id);
  }
  await wait(p, 300);
  ok((await D(0)).track === 'dnb' && (await D(0)).sounding && (await D(0)).playing, 'all eight tracks can be loaded on a deck; the playing deck goes on with the new one');
  await p.selectOption('#dj-track-a', 'house'); await p.waitForFunction(() => !window.__dj.decks[0].loading);
  await setPlay(p, 0, true); await setPlay(p, 1, true); await wait(p, 300);

  // ---- EQ and filter on the real audio nodes ----
  await p.focus('#dj-low-a'); for (let k = 0; k < 10; k++) await p.keyboard.press('ArrowDown');
  let q = await probe();
  ok(q.decks[0].low === -30 && q.decks[0].mid === 0 && q.decks[0].high === 0 && (await p.getAttribute('#dj-low-a', 'data-v')) === '-1', 'EQ low knob all the way down (keys): the low shelf of deck A is at -30 dB, mid and high untouched');
  await p.keyboard.press('Home'); q = await probe();
  ok(q.decks[0].low === 0, 'Home puts the knob back to flat');
  await p.focus('#dj-mid-a'); for (let k = 0; k < 10; k++) await p.keyboard.press('ArrowUp');
  await p.focus('#dj-high-b'); for (let k = 0; k < 4; k++) await p.keyboard.press('ArrowDown');
  q = await probe();
  ok(Math.abs(q.decks[0].mid - 6) < 1e-4 && q.decks[1].high < -5 && q.decks[1].high > -20 && q.decks[1].low === 0 && q.decks[0].high === 0, `EQ mid +6 dB on A, high ${q.decks[1].high.toFixed(1)} dB on B: each deck and band is separate`);
  // a drag on the knob: up = more
  const kb = await p.evaluate(() => { const g = window.__t.geo('#dj-high-a'); window.__t.ev('#dj-high-a', 'pointerdown', 4, g.cx, g.cy); window.__t.ev('#dj-high-a', 'pointermove', 4, g.cx, g.cy - 37); window.__t.ev('#dj-high-a', 'pointerup', 4, g.cx, g.cy - 37); return +document.querySelector('#dj-high-a').dataset.v; });
  q = await probe();
  ok(kb > 0.4 && kb < 0.6 && Math.abs(q.decks[0].high - 6 * kb) < 0.2, `dragging a knob up by 37 px turns it to ${kb} (+${q.decks[0].high.toFixed(1)} dB)`);
  await p.dblclick('#dj-high-a'); await p.dblclick('#dj-mid-a'); await p.dblclick('#dj-high-b');
  q = await probe();
  ok(q.decks.every((d) => d.low === 0 && d.mid === 0 && d.high === 0), 'double tap resets a knob');
  await p.focus('#dj-filter-a'); for (let k = 0; k < 20; k++) await p.keyboard.press('ArrowLeft');
  q = await probe();
  ok(Math.abs(q.decks[0].lp - 200) < 2 && q.decks[0].hp === 20 && q.decks[1].lp === 20000, 'filter knob to the left: low-pass sweeps down to 200 Hz on deck A only');
  await p.focus('#dj-filter-a'); await p.keyboard.press('Home'); for (let k = 0; k < 20; k++) await p.keyboard.press('ArrowRight');
  q = await probe();
  ok(Math.abs(q.decks[0].hp - 8000) < 80 && q.decks[0].lp === 20000, 'filter knob to the right: high-pass sweeps up to 8 kHz');
  await p.keyboard.press('Home'); q = await probe();
  ok(q.decks[0].hp === 20 && q.decks[0].lp === 20000, 'filter back to open');

  // ---- volume faders, master ----
  const vol = await p.evaluate(() => { const g = window.__t.geo('#dj-vol-a'); const e = window.__t.ev; e('#dj-vol-a', 'pointerdown', 6, g.cx, g.t - 20); e('#dj-vol-a', 'pointerup', 6, g.cx, g.t - 20); const top = window.__dj.decks[0].vol; e('#dj-vol-a', 'pointerdown', 6, g.cx, g.t + g.h + 20); e('#dj-vol-a', 'pointerup', 6, g.cx, g.t + g.h + 20); const bottom = window.__dj.decks[0].vol; e('#dj-vol-a', 'pointerdown', 6, g.cx, g.cy); e('#dj-vol-a', 'pointerup', 6, g.cx, g.cy); return { top, bottom, mid: window.__dj.decks[0].vol }; });
  q = await probe();
  ok(vol.top === 1 && vol.bottom === 0 && Math.abs(vol.mid - 0.5) < 0.05 && Math.abs(q.decks[0].chan - vol.mid) < 1e-4 && q.decks[1].chan > 0.79 && q.decks[1].chan < 0.81, `channel fader A: top = 1, bottom = 0, middle ${vol.mid}; on the audio node ${q.decks[0].chan.toFixed(2)}; channel B untouched`);
  await p.dblclick('#dj-vol-a');
  await p.focus('#dj-master'); for (let k = 0; k < 5; k++) await p.keyboard.press('ArrowDown');
  q = await probe();
  ok(q.master < 0.6 && q.master > 0.4 && Math.abs(q.master - (await p.evaluate(() => window.__dj.master))) < 1e-4, `master knob: ${q.master.toFixed(2)} on the master gain`);
  await p.dblclick('#dj-master');
  ok(Math.abs((await probe()).master - 0.8) < 1e-4, 'master back to 0.8');

  // ---- crossfader and the meters ----
  q = await probe();
  ok(Math.abs(q.decks[0].cross - Math.SQRT1_2) < 1e-4 && Math.abs(q.decks[1].cross - Math.SQRT1_2) < 1e-4, 'crossfader in the middle: both channels at 0.707 (equal power)');
  await wait(p, 300);
  const lv = await p.evaluate(() => window.__dj.meters.slice());
  ok(lv[0] > 0.05 && lv[1] > 0.05 && (await p.getAttribute('#dj-meter-a', 'data-level')) > 5, `the meters move with the music (A ${lv[0].toFixed(2)}, B ${lv[1].toFixed(2)})`);
  await p.focus('body'); await p.evaluate(() => document.activeElement.blur());
  for (let k = 0; k < 10; k++) await p.keyboard.press('d');
  q = await probe();
  ok((await p.evaluate(() => window.__dj.cross)) === 1 && q.decks[0].cross < 1e-6 && Math.abs(q.decks[1].cross - 1) < 1e-6, 'key D x10: the crossfader is all the way to B (A is silent, B full) on the audio nodes');
  await wait(p, 900);
  const lv2 = await p.evaluate(() => window.__dj.meters.slice());
  ok(lv2[0] < 0.02 && lv2[1] > 0.05, `the meter of A drops to nothing when the crossfader cuts it (A ${lv2[0].toFixed(3)}, B ${lv2[1].toFixed(2)})`);
  for (let k = 0; k < 20; k++) await p.keyboard.press('a');
  q = await probe();
  ok((await p.evaluate(() => window.__dj.cross)) === -1 && Math.abs(q.decks[0].cross - 1) < 1e-6 && q.decks[1].cross < 1e-6, 'key A x20: all the way back to A');
  await p.focus('#dj-cross'); await p.keyboard.press('Home'); for (let k = 0; k < 5; k++) await p.keyboard.press('ArrowRight');
  q = await probe();
  ok(Math.abs((await p.evaluate(() => window.__dj.cross)) - 0.5) < 0.06 && Math.abs(q.decks[0].cross ** 2 + q.decks[1].cross ** 2 - 1) < 1e-4, 'arrow keys on the crossfader; the two gains always keep equal power (' + q.decks[0].cross.toFixed(3) + ' / ' + q.decks[1].cross.toFixed(3) + ')');
  await p.evaluate(() => { const g = window.__t.geo('#dj-cross'); window.__t.ev('#dj-cross', 'pointerdown', 8, g.cx, g.cy); window.__t.ev('#dj-cross', 'pointerup', 8, g.cx, g.cy); });
  q = await probe();
  ok(Math.abs(q.decks[0].cross - Math.SQRT1_2) < 0.03 && Math.abs(q.decks[1].cross - Math.SQRT1_2) < 0.03, 'a tap in the middle of the crossfader centres it');

  // ---- SYNC ----
  await p.click('#dj-pitch-b'); // (a tap somewhere on the B fader: any value)
  await p.dblclick('#dj-pitch-b');
  await p.click('#dj-sync'); await wait(p, 200);
  let sb = await D(1);
  ok(sb.pitch === 3.3 && Math.abs(sb.bpm - 124) < 0.05 && (await p.getAttribute('#dj-pitch-b', 'data-v')) === '3.3' && (await p.textContent('#dj-bpm-b')) === '124.0', `SYNC: deck B (disco 120) is set to +3.3 % = ${sb.bpm.toFixed(2)} BPM, the BPM of deck A (124.0)`);
  ok((await p.locator('#toasts .toast').last().textContent()).includes('已同步') && (await p.evaluate(() => window.__dj.syncs)) === syncs0 + 1, 'SYNC answers with a message');
  ok(Math.abs((await probe()).decks[1].rate - 1.033) < 0.01, 'the source of deck B runs at the synced rate (' + (await probe()).decks[1].rate.toFixed(3) + ')');
  await p.selectOption('#dj-track-b', 'boombap'); await p.waitForFunction(() => !window.__dj.decks[1].loading);
  await p.click('#dj-sync'); await wait(p, 200);
  sb = await D(1);
  ok(sb.pitch === 8 && (await p.locator('#toasts .toast').last().textContent()).includes('超出'), `SYNC out of range (90 vs 124): the fader goes to its limit +8 % (${sb.bpm.toFixed(1)} BPM) and the message says so`);
  await p.selectOption('#dj-track-b', 'disco'); await p.waitForFunction(() => !window.__dj.decks[1].loading);

  // ---- effects ----
  await p.click('#dj-fx-echo'); q = await probe();
  ok(q.echo > 0.3 && (await p.getAttribute('#dj-fx-echo', 'aria-pressed')) === 'true' && (await p.locator('#dj-fx-echo.on').count()) === 1 && Math.abs(q.echoTime - (60 / 124) * 0.75) < 0.05, `echo on: the echo send is open (${q.echo}), the delay is a dotted eighth of deck A's tempo (${q.echoTime.toFixed(3)} s)`);
  await p.click('#dj-fx-echo'); q = await probe();
  ok(q.echo === 0 && (await p.getAttribute('#dj-fx-echo', 'aria-pressed')) === 'false', 'echo off: the send is closed');
  await p.click('#dj-fx-flanger'); q = await probe();
  ok(q.flanger > 0.3 && (await p.evaluate(() => window.__dj.fx.flanger)), 'flanger on');
  await p.click('#dj-fx-flanger'); ok((await probe()).flanger === 0, 'flanger off');
  await p.click('#dj-fx-brake'); await wait(p, 2000);
  const br = await D(0), brAng = await p.getAttribute('#dj-platter-a', 'data-angle'); await wait(p, 300);
  ok(br.playing && br.cur < 0.05 && !(await D(0)).sounding && brAng === (await p.getAttribute('#dj-platter-a', 'data-angle')) && (await p.locator('#dj-fx-brake.on').count()) === 1, `brake: the playing deck slows to a stop (rate ${br.cur.toFixed(3)}) and the platter stands still, the play button stays "playing"`);
  await p.click('#dj-fx-brake'); await wait(p, 1200);
  const br2 = await D(0);
  ok(br2.cur > 0.95 && br2.sounding && !(await p.evaluate(() => window.__dj.fx.brake)), `brake released: the deck runs up to speed again (rate ${br2.cur.toFixed(3)})`);

  // ---- scratching ----
  await p.evaluate(() => window.__t.sleep(10));
  await p.evaluate(() => window.__t.down('#dj-platter-a', 11, -90));
  await wait(p, 300);
  const held = await D(0);
  ok(held.scratching && Math.abs(held.cur) < 0.05 && (await p.locator('#dj-platter-a.held').count()) === 1, `a finger on the record holds it (rate ${held.cur.toFixed(3)} while the deck is playing)`);
  const angHeld = await p.getAttribute('#dj-platter-a', 'data-angle'); await wait(p, 200);
  ok(angHeld === (await p.getAttribute('#dj-platter-a', 'data-angle')), 'the held record does not turn');
  const fwd = await p.evaluate(() => window.__t.spin('#dj-platter-a', 11, -90, 10, 12, 16, 0));
  const pf = await probe();
  const maxF = Math.max(...fwd.map((x) => x.cur));
  ok(maxF > 1.6 && fwd[fwd.length - 1].rate > 1.6 && fwd.every((x) => x.scratching && x.dir === 1) && pf.decks[0].rate > 1.5, `scratch forward: the faster the finger turns the record, the faster it plays (rate up to ${maxF.toFixed(2)}; the audio source ${pf.decks[0].rate.toFixed(2)})`);
  const back = await p.evaluate(() => window.__t.spin('#dj-platter-a', 11, 30, -10, 16, 16, 0));
  const pb = await probe();
  const minB = Math.min(...back.map((x) => x.cur));
  ok(minB < -1.2 && back.some((x) => x.dir === -1) && (await D(0)).dir === -1 && pb.decks[0].reversed && pb.decks[0].rate > 1, `scratch backward: the rate goes negative (${minB.toFixed(2)}) and the REVERSED copy of the loop plays (rate ${pb.decks[0].rate.toFixed(2)})`);
  // the angle follows the finger: forward 120 degrees then backward 160 = -40 net
  const posB = (await D(0)).pos;
  await p.evaluate(() => window.__t.up('#dj-platter-a', 11, -130));
  const samples = [];
  for (let k = 0; k < 14; k++) { await wait(p, 50); samples.push((await D(0)).cur); }
  const maxJump = Math.max(...samples.slice(1).map((x, k) => Math.abs(x - samples[k])));
  const rising = samples.every((x, k) => k === 0 || x >= samples[k - 1] - 1e-6);
  ok(!(await D(0)).scratching && samples[0] < 0.5 && samples[samples.length - 1] > 0.95 && samples[samples.length - 1] < 1.05 && rising && maxJump < 1.2 && (await D(0)).dir === 1, `release: the record comes back to normal speed smoothly (${samples.filter((_, k) => k % 3 === 0).map((x) => x.toFixed(2)).join(' -> ')}), forward again`);
  ok((await p.locator('#dj-platter-a.held').count()) === 0 && !(await probe()).decks[0].reversed, 'the finger is up: the record is no longer held, the forward source plays');
  // a paused deck can be scratched, too, and stops after the release
  await setPlay(p, 0, false); await wait(p, 900);
  ok(!(await D(0)).sounding, 'deck A paused');
  await p.evaluate(() => window.__t.down('#dj-platter-a', 12, 0));
  await p.evaluate(() => window.__t.spin('#dj-platter-a', 12, 0, 12, 10, 16, 0));
  const ps = await D(0);
  ok(ps.sounding && ps.cur > 0.8 && ps.scratching && !ps.playing, `a paused record can be scratched: sound while the finger moves (rate ${ps.cur.toFixed(2)})`);
  await p.evaluate(() => window.__t.up('#dj-platter-a', 12, 120)); await wait(p, 1300);
  ok(!(await D(0)).sounding && (await D(0)).cur === 0, 'released: the paused record coasts to a stop and the sound ends');
  // the crossing of the +-180 line is no jump
  await p.evaluate(() => window.__t.down('#dj-platter-a', 13, 170));
  const cross180 = await p.evaluate(() => window.__t.spin('#dj-platter-a', 13, 170, 8, 5, 16, 0));
  await p.evaluate(() => window.__t.up('#dj-platter-a', 13, 210));
  ok(cross180.every((x) => x.rate > 0 && x.rate < 4) && Math.max(...cross180.map((x) => x.cur)) > 0.5, 'turning across the left edge (+-180 degrees) is no jump backwards');
  await wait(p, 700);
  // two decks at once, a pointer id each
  await setPlay(p, 0, true); await setPlay(p, 1, true); await wait(p, 600);
  await p.evaluate(() => { window.__t.down('#dj-platter-a', 21, 0); window.__t.down('#dj-platter-b', 22, 0); });
  const both = await p.evaluate(async () => {
    const T = window.__t, out = [];
    for (let k = 1; k <= 14; k++) { await T.sleep(16); T.ev('#dj-platter-a', 'pointermove', 21, ...T.at('#dj-platter-a', 10 * k)); T.ev('#dj-platter-b', 'pointermove', 22, ...T.at('#dj-platter-b', -10 * k)); const a = window.__dj.decks[0], b = window.__dj.decks[1]; out.push({ a: a.cur, b: b.cur, sa: a.scratching, sb: b.scratching, da: a.dir, db: b.dir }); }
    return out;
  });
  const pboth = await probe(), last = both[both.length - 1];
  ok(both.every((x) => x.sa && x.sb) && Math.max(...both.map((x) => x.a)) > 1.5 && Math.min(...both.map((x) => x.b)) < -1.2 && last.da === 1 && last.db === -1 && !pboth.decks[0].reversed && pboth.decks[1].reversed, `two fingers, two decks at once: A forward (up to ${Math.max(...both.map((x) => x.a)).toFixed(2)}) while B goes backward (down to ${Math.min(...both.map((x) => x.b)).toFixed(2)}, reversed copy)`);
  await p.evaluate(() => window.__t.up('#dj-platter-a', 21, 140));
  const still = await D(1);
  ok(!(await D(0)).scratching && still.scratching, 'lifting the finger from deck A does not release deck B');
  await p.evaluate(() => { const T = window.__t; T.ev('#dj-platter-b', 'pointerdown', 23, ...T.at('#dj-platter-b', 90)); });
  ok((await p.evaluate(() => window.__t.spin('#dj-platter-b', 23, 90, 30, 3, 16, 1))).every((x) => x.scratching), 'a second finger on a deck that is already held does nothing');
  await p.evaluate(() => window.__t.up('#dj-platter-b', 22, -140)); await wait(p, 900);
  ok(!(await D(1)).scratching && (await D(1)).cur > 0.95 && (await D(0)).cur > 0.95, 'both released: both records are back at normal speed');
  // the real mouse works, too
  const gb = await p.evaluate(() => window.__t.geo('#dj-platter-a'));
  await p.mouse.move(gb.cx + gb.r * 0.6, gb.cy); await p.mouse.down();
  for (let k = 1; k <= 8; k++) { await p.mouse.move(gb.cx + gb.r * 0.6 * Math.cos(k * 0.3), gb.cy + gb.r * 0.6 * Math.sin(k * 0.3)); await wait(p, 20); }
  const mouse = await D(0); await p.mouse.up();
  ok(mouse.scratching && mouse.cur > 0.8, `the mouse scratches, too (rate ${mouse.cur.toFixed(2)})`);
  await wait(p, 600);

  // ---- pads ----
  await p.evaluate(() => { window.__dj.pads.length = 0; });
  for (const id of ['horn', 'siren', 'laser', 'clap', 'scratch', 'stab', 'drop', 'rewind']) await p.click(`#dj-pad-${id}`);
  const tapped = await p.evaluate(() => window.__dj.pads.map((x) => x.id).join());
  ok(tapped === 'horn,siren,laser,clap,scratch,stab,drop,rewind', 'the eight pads each play their own sound when tapped: ' + tapped);
  await p.evaluate(() => { window.__dj.pads.length = 0; const T = window.__t; ['#dj-pad-horn', '#dj-pad-laser', '#dj-pad-drop'].forEach((s, k) => { const g = T.geo(s); T.ev(s, 'pointerdown', 30 + k, g.cx, g.cy); }); });
  const multi = await p.evaluate(() => window.__dj.pads.slice());
  ok(multi.length === 3 && multi.map((x) => x.id).join() === 'horn,laser,drop' && multi[2].t - multi[0].t < 50 && (await p.locator('.dj-pad.hit').count()) >= 3, 'three pads with three fingers at once: all play at once');
  await p.evaluate(() => { window.__dj.pads.length = 0; }); await p.keyboard.press('3'); await p.keyboard.press('8');
  ok((await p.evaluate(() => window.__dj.pads.map((x) => x.id).join())) === 'laser,rewind', 'keys 3 and 8 play laser and rewind');
  ok((await probe()).state === 'running', 'the audio context is running');

  // ---- recording ----
  if (await p.locator('#dj-rec').isVisible()) {
    await p.click('#dj-rec'); await wait(p, 200);
    ok((await p.evaluate(() => window.__dj.recording)) && (await p.textContent('#dj-rec')).includes('停止') && (await p.locator('#dj-rec.on').count()) === 1, 'record: started (the button says stop)');
    await p.click('#dj-pad-horn'); await wait(p, 1200);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 6000 }).catch(() => null), p.click('#dj-rec')]);
    await wait(p, 300);
    ok(!(await p.evaluate(() => window.__dj.recording)) && (await p.textContent('#dj-rec')).includes('录音'), 'record: stopped');
    if (dl) { const f = await dl.path(); ok(/^dj_mix_\d{8}_\d{4}\.(webm|m4a|ogg)$/.test(dl.suggestedFilename()) && fs.statSync(f).size > 500, 'record: a file was offered: ' + dl.suggestedFilename() + ' (' + fs.statSync(f).size + ' bytes)'); }
    else ok((await p.locator('#toasts .toast').allTextContents()).some((x) => x.includes('录音为空')), 'record: no file, and the message says the recording was empty');
  } else ok(true, 'record: the button is hidden (no MediaRecorder here)');
  ok((await p.locator('.dj-rec').count()) === 1, 'the record button exists');

  // ---- full screen, desktop ----
  await p.screenshot({ path: OUT + 'dj-desktop.png' });
  await p.click('#dj-full'); await wait(p, 500);
  let f = await p.evaluate(() => { const r = document.querySelector('.dj-rig'), pd = document.querySelector('#dj-pads').getBoundingClientRect(), pl = document.querySelector('#dj-platter-a').getBoundingClientRect(); return { hero: getComputedStyle(document.querySelector('.inst-page > .top')).display, label: document.querySelector('#dj-full').textContent, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, rigScroll: r.scrollHeight > r.clientHeight + 1, padsB: pd.bottom, platter: pl.width, l: r.getBoundingClientRect().left, r: innerWidth - r.getBoundingClientRect().right }; });
  ok(f.hero === 'none' && f.label.includes('退出') && f.sw <= f.vw && f.padsB <= f.vh + 1 && f.platter >= 150 && Math.abs(f.l - f.r) <= 2, `full screen: the title band is gone, the decks and the pads fit (platter ${Math.round(f.platter)} px, pads end at ${Math.round(f.padsB)} of ${f.vh}, ${f.rigScroll ? 'the decks scroll' : 'no scrolling'})`);
  ok(!f.rigScroll, 'full screen on a wide screen: nothing needs to scroll');
  await p.screenshot({ path: OUT + 'dj-fullscreen-desktop.png' });
  const bPlay = (await D(1)).playing;
  await p.click('#dj-pad-clap'); await p.click('#dj-play-b'); await wait(p, 200);
  ok((await D(1)).playing === !bPlay && (await p.evaluate(() => window.__dj.pads.slice(-1)[0].id)) === 'clap', 'still playable in full screen (pad and deck)');
  await p.click('#dj-full'); await wait(p, 300);
  ok((await p.evaluate(() => getComputedStyle(document.querySelector('.inst-page > .top')).display)) !== 'none', 'leaving full screen brings the page back');

  // ---- leaving the page stops everything ----
  await p.click('.hero .back, .top .back, header button'); await wait(p, 800);
  const gone = await p.evaluate(() => ({ hash: location.hash, a: window.__dj.decks.map((d) => d.sounding) }));
  ok(gone.hash === '#/subject/music' && gone.a.every((x) => !x), 'back goes to the music home; the sound of both decks is stopped');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ================= screens and phones =================
  for (const [dn, vp] of SIZES) {
    const s = await start(new Map(), { local: true, viewport: vp });
    await s.page.evaluate(() => (location.hash = '#/music/dj')); await s.page.waitForSelector('#dj-platter-a');
    await s.page.waitForFunction(() => window.__dj && window.__dj.decks.every((d) => !d.loading));
    await s.page.click('#dj-play-a'); await wait(s.page, 500);
    const m = await s.page.evaluate(() => {
      const vw = document.documentElement.clientWidth, vh = innerHeight, rig = document.querySelector('.dj-rig').getBoundingClientRect();
      const els = [...document.querySelectorAll('.dj-deck, .dj-mixer, .dj-pads, .dj-pad, .dj-ctl, .dj-platter, .dj-select, .dj-page button')].filter((e) => e.offsetParent !== null);
      const outside = els.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1; }).map((e) => e.id || e.className);
      const small = [...document.querySelectorAll('.dj-page button, .dj-select, .dj-ctl, .dj-pad')].filter((e) => e.offsetParent !== null && !e.closest('.top')).filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 39.5; }).map((e) => `${e.id}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      const clip = [...document.querySelectorAll('.dj-page button, .dj-lab, .dj-pad b, .dj-bpmbox, .dj-pct, .dj-select')].filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.textContent);
      const decks = ['#dj-deck-a', '#dj-deck-b'].map((q) => document.querySelector(q).getBoundingClientRect());
      const mx = document.querySelector('.dj-mixer').getBoundingClientRect(), pl = document.querySelector('#dj-platter-a').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth <= vw, outside, small, clip, l: rig.left, r: vw - rig.right, vw, vh, plat: pl.width, round: Math.abs(pl.width - pl.height) < 1, sameDecks: Math.abs(decks[0].width - decks[1].width) < 2, pads: document.querySelector('#dj-pads').getBoundingClientRect().width, mixer: mx.width, cols: new Set(decks.map((d) => Math.round(d.top))).size };
    });
    ok(m.sw && m.outside.length === 0, `${dn}: no horizontal scroll, every control inside the screen${m.outside.length ? ' (outside: ' + m.outside.join() + ')' : ''}`);
    ok(Math.abs(m.l - m.r) <= 2 && m.l >= 0, `${dn}: equal space left and right (${Math.round(m.l)} / ${Math.round(m.r)} px)`);
    ok(m.small.length === 0, `${dn}: every button, fader, knob, pad and picker is at least 40 px${m.small.length ? ' (too small: ' + m.small.join() + ')' : ''}`);
    ok(m.clip.length === 0 && m.plat >= 100 && m.round && m.sameDecks, `${dn}: no text is cut off, round platters of ${Math.round(m.plat)} px, both decks the same size${m.clip.length ? ' (cut: ' + m.clip.join() + ')' : ''}`);
    if (dn === 'phone' || dn === 'small-phone') ok(m.cols === 1 && m.mixer > m.plat * 1.5, `${dn}: the two decks sit side by side, the mixer is under them across the screen`);
    if (dn === 'ipad-land') {
      const nos = await s.page.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight, main: (() => { const e = document.querySelector('main.scroll'); return e.scrollHeight - e.clientHeight; })() }));
      ok(nos.main <= 2 && nos.doc <= nos.vh + 1, `${dn}: the whole page fits on the screen, nothing to scroll (${nos.main} px over)`);
    }
    await s.page.screenshot({ path: OUT + `dj-${dn}.png` });
    await s.page.screenshot({ path: OUT + `dj-${dn}-full-page.png`, fullPage: true });
    // full screen
    await s.page.click('#dj-full'); await wait(s.page, 500);
    const fs2 = await s.page.evaluate(() => { const r = document.querySelector('.dj-rig'), rb = r.getBoundingClientRect(), pd = document.querySelector('#dj-pads').getBoundingClientRect(), vw = document.documentElement.clientWidth; const small = [...document.querySelectorAll('.dj-page button, .dj-select, .dj-ctl, .dj-pad')].filter((e) => e.offsetParent !== null).filter((e) => { const q = e.getBoundingClientRect(); return Math.min(q.width, q.height) < 39.5; }).length; return { sw: document.documentElement.scrollWidth <= vw, vh: innerHeight, padsB: pd.bottom, over: r.scrollHeight - r.clientHeight, plat: document.querySelector('#dj-platter-a').getBoundingClientRect().width, l: rb.left, r: vw - rb.right, small }; });
    ok(fs2.sw && fs2.padsB <= fs2.vh + 1 && Math.abs(fs2.l - fs2.r) <= 3 && fs2.plat >= 100 && fs2.small === 0, `${dn} full screen: fits the screen width, pads end at ${Math.round(fs2.padsB)} of ${fs2.vh}, platter ${Math.round(fs2.plat)} px, ${fs2.over > 1 ? 'the decks scroll by ' + fs2.over + ' px' : 'nothing scrolls'}`);
    if (dn === 'phone-land' || dn === 'ipad-land' || dn === 'ipad') ok(fs2.over <= 1, `${dn} full screen: all of both decks and the mixer are visible at once (nothing to scroll)`);
    await s.page.screenshot({ path: OUT + `dj-fullscreen-${dn}.png` });
    await s.browser.close();
  }

  // ================= languages =================
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }], ['land', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp });
      await s.page.evaluate(() => (location.hash = '#/subject/music')); await s.page.waitForSelector('#mus-dj'); await wait(s.page, 250);
      const home = await s.page.evaluate(() => { const b = document.querySelector('#mus-dj b'); return { ok: b.scrollWidth <= b.clientWidth + 1, text: b.textContent, sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
      await s.page.evaluate(() => (location.hash = '#/music/dj')); await s.page.waitForSelector('#dj-platter-a');
      await s.page.waitForFunction(() => window.__dj && window.__dj.decks.every((d) => !d.loading));
      await s.page.click('#dj-play-a'); await s.page.click('#dj-sync'); await wait(s.page, 400);
      const r = await s.page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const attrs = [...document.querySelectorAll('[title],[aria-label]')].flatMap((e) => [e.getAttribute('title'), e.getAttribute('aria-label')]).filter(Boolean).join(' ');
        const body = (document.querySelector('main').innerText || '') + ' ' + [...document.querySelectorAll('option')].map((o) => o.textContent).join(' ') + ' ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' ');
        const clip = [...document.querySelectorAll('.dj-page button, .dj-lab, .dj-pad b, .dj-bpmbox, .dj-select')].filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.textContent);
        const out = [...document.querySelectorAll('.dj-deck, .dj-mixer, .dj-pad, button')].filter((e) => e.offsetParent !== null).filter((e) => { const q = e.getBoundingClientRect(); return q.left < -1 || q.right > vw + 1; }).length;
        return { sw: document.documentElement.scrollWidth <= vw, cjk: /[一-鿿]/.test(body), cjkAttr: /[一-鿿]/.test(attrs), clip, out, title: document.title, pads: [...document.querySelectorAll('.dj-pad b')].map((e) => e.textContent).join(','), opts: [...document.querySelectorAll('#dj-track-a option')].map((o) => o.textContent).join(','), play: document.querySelector('#dj-play-a').textContent, toast: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' | '), labs: [...document.querySelectorAll('.dj-lab')].map((e) => e.textContent).join(',') };
      });
      ok(r.sw && r.out === 0 && r.clip.length === 0 && home.sw && home.ok, `${name} ${dn}: the page and the card name fit the screen (${home.text})${r.clip.length ? ', cut: ' + r.clip.join() : ''}`);
      if (name !== 'zh') ok(!r.cjk && !r.cjkAttr && !/[一-鿿]/.test(r.title), `${name} ${dn}: no Chinese left (titles, labels, track names, pads, messages): ${r.pads}`);
      if (name === 'en' && dn === 'ipad') ok(r.pads === 'Air horn,Siren,Laser,Clap,Scratch,Yeah stab,Bass drop,Rewind' && r.opts.startsWith('House · 124,Hip-hop · 90') && r.play.includes('Pause') && r.toast.includes('Synchronised'), 'en: pads / tracks / buttons / message: ' + r.pads + ' | ' + r.opts.slice(0, 40) + ' | ' + r.toast);
      if (name === 'fr' && dn === 'ipad') ok(r.pads.startsWith('Corne de brume,Sirène') && r.toast.includes('Synchronisé') && r.labs.includes('Graves'), 'fr: pads / message / labels: ' + r.pads.slice(0, 30) + ' | ' + r.toast);
      if (dn === 'ipad') await s.page.screenshot({ path: OUT + `dj-${name}-ipad.png` });
      if (name !== 'zh' && dn === 'phone') await s.page.screenshot({ path: OUT + `dj-${name}-phone.png` });
      if (name !== 'zh' && dn === 'land') await s.page.screenshot({ path: OUT + `dj-${name}-land.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
})();
