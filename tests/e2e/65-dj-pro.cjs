// DJ turntables, the professional features (rule 49): waveforms + overview + counters, the beat grid and BPM detection, TRUE sync (tempo + beat phase, lock, phase meter),
// hot cues, CUE behaviour, loops (auto, IN / OUT, reloop, halve / double, roll with slip), imported music (decode, limits, mono for long tracks, reversed window for long
// tracks, name, remembered grid and cues) and the layout. Pure logic first (src/djgrid.ts), then the screen with GENERATED audio files (click tracks of a known BPM).
// NOT tested: real files from the Files app of an iPad, decoding of every format on iOS, BPM detection of real music (only synthetic and generated tracks), real fingers.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);

/** a PCM WAV: a click (10 ms of 1 kHz) on every beat of `bpm` starting at `off`, stereo by default (nothing but silence when bpm is 0) */
function wav(sec, bpm, off, o = {}) {
  const sr = o.sr || 44100, ch = o.ch || 2, n = Math.floor(sec * sr), b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  if (bpm) for (let t = off; t < sec; t += 60 / bpm) { const s0 = Math.floor(t * sr); for (let i = 0; i < 0.012 * sr && s0 + i < n; i++) { const v = Math.sin((2 * Math.PI * 1000 * i) / sr) * Math.exp(-i / (0.003 * sr)) * 0.8; for (let c = 0; c < ch; c++) b.writeInt16LE(Math.round(v * (c ? 0.7 : 1) * 32767), 44 + ((s0 + i) * ch + c) * 2); } }
  return b;
}
const file = (name, buffer) => ({ name, mimeType: 'audio/wav', buffer });
const installHelpers = (page) => page.evaluate(() => {
  const el = (s) => document.querySelector(s);
  const ev = (s, type, id, x, y) => el(s).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
  const geo = (s) => { const r = el(s).getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2, l: r.left, t: r.top, w: r.width, h: r.height }; };
  const at = (s, deg, f = 0.7) => { const g = geo(s); return [g.cx + Math.cos((deg * Math.PI) / 180) * g.r * f, g.cy + Math.sin((deg * Math.PI) / 180) * g.r * f]; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__t = { ev, geo, at, sleep, down: (s, id, deg) => ev(s, 'pointerdown', id, ...at(s, deg)), up: (s, id, deg) => ev(s, 'pointerup', id, ...at(s, deg)), tapAt: (s, frac, id = 9) => { const g = geo(s); ev(s, 'pointerdown', id, g.l + g.w * frac, g.cy); ev(s, 'pointerup', id, g.l + g.w * frac, g.cy); } };
});

(async () => {
  // ================= the pure logic =================
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const G = await import('/src/djgrid.ts'), L = await import('/src/djlogic.ts'), T = await import('/src/djtracks.ts');
      const o = {};
      const sr = 44100;
      let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const gen = (bpm, off, kind) => {
        const x = new Float32Array(sr * 30), beat = 60 / bpm;
        for (let k = 0; ; k++) {
          const tb = off + k * beat; if (tb >= 30) break;
          const hit = (t0, f, dur, amp, noise) => { const s0 = Math.floor(t0 * sr); for (let i = 0; i < dur * sr && s0 + i < x.length; i++) { const env = Math.exp(-i / ((dur * sr) / 4)); x[s0 + i] += amp * env * (noise ? rnd() * 2 - 1 : Math.sin((2 * Math.PI * f * i) / sr)); } };
          if (kind === 'click') hit(tb, 1000, 0.02, 0.8);
          else { hit(tb, 60, 0.15, 0.9); if (k % 2) hit(tb, 0, 0.12, 0.6, true); hit(tb + beat / 2, 0, 0.03, 0.2, true); }
        }
        return x;
      };
      o.det = [];
      for (const kind of ['click', 'drum']) for (const bpm of [80, 100, 120, 128, 140, 174]) {
        const off = rnd() * (60 / bpm), d = G.detectBpm(gen(bpm, off, kind), sr), per = 60 / bpm;
        let eo = Math.abs(d.offset - off); eo = Math.min(eo, per - eo);
        o.det.push({ kind, bpm, got: d.bpm, off, goff: d.offset, errMs: eo * 1000 });
      }
      o.silence = G.detectBpm(new Float32Array(sr * 20), sr);
      o.short = G.detectBpm(new Float32Array(sr), sr);
      o.built = [];
      for (const def of L.TRACKS) { const b = await T.renderTrack(def); const d = G.detectBpm(b.getChannelData(0), sr); o.built.push({ id: def.id, bpm: def.bpm, got: d.bpm }); }
      o.fold = [G.foldBpm(60), G.foldBpm(200), G.foldBpm(90), G.foldBpm(35), G.foldBpm(360), G.foldBpm(174), G.foldBpm(70)];
      o.tap = [G.tapBpm([0]), G.tapBpm([0, 500]), G.tapBpm([0, 500, 1000, 1500]), G.tapBpm([0, 500, 1000, 5000, 5500]), G.tapBpm([])];
      // phase alignment: two decks at different BPM and offsets
      o.align = [];
      for (let k = 0; k < 40; k++) {
        const gl = { bpm: 80 + rnd() * 100, offset: rnd() }, gf = { bpm: 80 + rnd() * 100, offset: rnd() };
        const posL = rnd() * 100, posF = rnd() * 100, rateL = 0.95 + rnd() * 0.1, rateF = (gl.bpm * rateL) / gf.bpm;   // after the tempo sync both are heard at the same BPM
        const np = G.alignPosition(gl, posL, gf, posF);
        const before = G.phaseError(gl, posL, gf, posF), after = G.phaseError(gl, posL, gf, np);
        const walls = (g, p, r) => { const first = Math.ceil(G.beatPos(g, p) - 1e-9); return Array.from({ length: 16 }, (_, n) => (G.beatTime(g, first + n) - p) / r); };
        const wa = walls(gl, posL, rateL), wb = walls(gf, np, rateF);
        const worst = Math.max(...wa.map((x) => Math.min(...wb.map((y) => Math.abs(x - y)))));
        o.align.push({ before, after, worstMs: worst * 1000, moved: Math.abs(np - posF) <= G.beatSeconds(gf) / 2 + 1e-9 });
      }
      o.phase = [G.phaseError({ bpm: 120, offset: 0 }, 1.0, { bpm: 120, offset: 0 }, 1.125), G.phaseMs(0.25, 120), G.phaseMs(-0.1, 100), G.lockTrim(0.4), G.lockTrim(-0.4), G.lockTrim(0.01), G.lockTrim(0)];
      o.shortest = [G.shortest(0.6), G.shortest(-0.6), G.shortest(0.5), G.shortest(-0.5), G.shortest(2.25)];
      // grid, quantize
      const g = { bpm: 120, offset: 0.25 };
      o.grid = [G.beatPos(g, 0.25), G.beatPos(g, 1.25), G.beatTime(g, 4), G.nearestBeat(g, 3.3), G.nearestBeat(g, 3.1), G.nearestBeat(g, 0.0), G.snap(g, 3.3, true), G.snap(g, 3.3, false), G.barBeat(g, 0.25), G.barBeat(g, 2.3), G.barBeat(g, 0.0), G.nudged(g, 10).offset, G.scaledGrid(g, 2).bpm, G.scaledGrid(g, 0.5).bpm, G.scaledGrid({ bpm: 200, offset: 0 }, 2).bpm, G.gridThrough(120, 3.3).offset];
      // loops
      const l = G.autoLoop(g, 3.3, 4, 30, true), l2 = G.autoLoop(g, 3.3, 4, 30, false), l3 = G.autoLoop(g, 29.6, 4, 30, true), l4 = G.autoLoop(g, 3.3, 0.25, 30, true);
      const lp = { on: true, start: 3.25, end: 5.25 };
      o.loops = { l, l2, l3, l4, f1: G.wrapLoop(5.35, lp), f2: G.wrapLoop(3.15, lp), f3: G.wrapLoop(4, lp), f4: G.wrapLoop(5.35, { ...lp, on: false }), f5: G.wrapLoop(5.25 + 4.5, lp), half: G.loopHalf(lp), dbl: G.loopDouble(lp, 30), dbl2: G.loopDouble({ on: true, start: 28, end: 29.5 }, 30), len: G.loopLength(lp) };
      // reversed window, peaks
      o.win = [G.reverseWindow(100, 600), G.reverseWindow(2, 600), G.reverseWindow(598, 600), G.reverseWindow(5, 12)];
      const sin = (f, n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / sr); return a; };
      const pl = G.computePeaks([sin(80, sr * 2)], sr), ph = G.computePeaks([sin(9000, sr * 2)], sr);
      const ok01 = (a) => a.every((v) => Number.isFinite(v) && v >= 0 && v <= 1.0001);
      const mid = Math.floor(pl.n / 2);
      o.peaks = { n: pl.n, per: pl.perSec, minmax: Math.min(...pl.min), maxmax: Math.max(...pl.max), finite: [...pl.min, ...pl.max].every(Number.isFinite), bands: ok01(pl.low) && ok01(pl.mid) && ok01(pl.high), lowDom: pl.low[mid] > pl.high[mid] * 5, highDom: ph.high[Math.floor(ph.n / 2)] > ph.low[Math.floor(ph.n / 2)] * 5, st: G.computePeaks([sin(80, sr), sin(120, sr)], sr).n, empty: G.computePeaks([new Float32Array(10)], sr).n };
      // the store
      const bad = G.sanitizeStore({ quant: 'x', zoom: 7, tracks: { a: { bpm: 120, offset: 0.1, cues: [1, null, 'x', -3, 9] }, b: { bpm: 5, offset: 0 }, c: 'nope', d: { bpm: 100, offset: NaN } } });
      o.store = { quant: bad.quant, zoom: bad.zoom, keys: Object.keys(bad.tracks).join(), cues: JSON.stringify(bad.tracks.a?.cues), none: JSON.stringify(G.sanitizeStore(null)), key: G.fileKey('a.wav', 12, 3.14159) };
      return o;
    });
    for (const k of ['click', 'drum']) {
      const rows = r.det.filter((x) => x.kind === k);
      ok(rows.every((x) => Math.abs(x.got - x.bpm) < 0.5 && x.errMs < 25), `detection on ${k} tracks at 80 / 100 / 120 / 128 / 140 / 174 BPM with random first beats: ` + rows.map((x) => `${x.bpm}->${x.got} (${x.errMs.toFixed(0)} ms)`).join(' '));
    }
    ok(r.silence.bpm >= 70 && r.silence.bpm <= 180 && r.short.confidence === 0, 'detection never fails on silence or a very short sound: it gives a tempo in range / zero confidence');
    const exact = r.built.filter((x) => Math.abs(x.got - x.bpm) < 0.5), octave = r.built.every((x) => [1, 2, 0.5].some((f) => Math.abs(x.got * f - x.bpm) < 0.01 * x.bpm + 0.5));
    ok(octave && exact.length >= 5, `detection on the eight built-in tracks rendered in the browser: ${exact.length} of 8 exact, the others a half / double of the real BPM (octave ambiguity of syncopated drum patterns): ` + r.built.map((x) => `${x.id} ${x.bpm}->${x.got}`).join(' '));
    ok(r.fold.join() === '120,100,90,70,180,174,70', 'folding half / double into 70-180 BPM: ' + r.fold.join());
    ok(r.tap[0] === null && r.tap[1] === 120 && r.tap[2] === 120 && r.tap[3] === 120 && r.tap[4] === null, 'tap tempo: one tap = nothing, 500 ms taps = 120 BPM, a gap of more than 2 s starts again: ' + r.tap.join());
    ok(r.align.every((x) => Math.abs(x.after) < 1e-9 && x.moved && x.worstMs < 10), `phase alignment (40 random pairs of decks at different BPM and offsets): after sync the beats coincide within ${Math.max(...r.align.map((x) => x.worstMs)).toFixed(4)} ms over the next 16 beats, the follower moves by at most half a beat; before it was off by up to ${Math.max(...r.align.map((x) => Math.abs(x.before))).toFixed(2)} beat`);
    ok(r.align.some((x) => Math.abs(x.before) > 0.2), 'the test pairs really were out of phase before the sync');
    ok(Math.abs(r.phase[0] - 0.25) < 1e-9, 'phase error of 0.125 s at 120 BPM = a quarter beat: ' + r.phase[0]);
    ok(Math.abs(r.phase[1] - 125) < 1e-9 && Math.abs(r.phase[2] + 60) < 1e-9, 'phase in milliseconds: 0.25 beat at 120 BPM = 125 ms, -0.1 beat at 100 BPM = -60 ms');
    ok(r.phase[3] === -0.004 && r.phase[4] === 0.004 && Math.abs(r.phase[5] + 0.0008) < 1e-12 && r.phase[6] === 0, 'sync lock: the rate trim is slow (at most 0.4 %), against the error, zero when aligned: ' + r.phase.slice(3).join());
    ok(r.shortest.join() === '-0.4,0.4,0.5,0.5,0.25', 'shortest phase distance: ' + r.shortest.join());
    const gr = r.grid;
    ok(gr[0] === 0 && gr[1] === 2 && gr[2] === 2.25 && gr[3] === 3.25 && gr[4] === 3.25 && gr[5] === 0.25 && gr[6] === 3.25 && gr[7] === 3.3, 'beat grid: beat positions and times, quantize snaps to the nearest beat (never before the start), no quantize = untouched: ' + gr.slice(0, 8).join());
    ok(gr[8].bar === 1 && gr[8].beat === 1 && gr[9].bar === 2 && gr[9].beat === 1 && gr[10].bar === 1 && gr[10].beat === 1 && Math.abs(gr[11] - 0.26) < 1e-12 && gr[12] === 240 && gr[13] === 60 && gr[14] === 300 && Math.abs(gr[15] - 0.3) < 1e-9, 'bar.beat counter (bar 2 beat 1 at 2.3 s, bar 1 beat 1 before the first beat), nudge +10 ms, x2 / ÷2 (limited to 300), a grid through a tapped time: ' + JSON.stringify(gr.slice(8)));
    const lo = r.loops;
    ok(Math.abs(lo.l.start - 3.25) < 1e-9 && Math.abs(lo.l.end - 5.25) < 1e-9 && Math.abs(lo.l2.start - 3.3) < 1e-9 && Math.abs(lo.l2.end - 5.3) < 1e-9 && Math.abs(lo.l3.end - 30) < 1e-9 && Math.abs(lo.l3.start - 28) < 1e-9 && Math.abs(lo.l4.end - lo.l4.start - 0.125) < 1e-9, 'auto loops: 4 beats from the nearest beat (quantize), from the position (no quantize), kept inside the track, 1/4 beat = 125 ms at 120 BPM');
    ok(Math.abs(lo.f1 - 3.35) < 1e-9 && Math.abs(lo.f2 - 5.15) < 1e-9 && lo.f3 === 4 && lo.f4 === 5.35 && Math.abs(lo.f5 - 3.75) < 1e-9, 'loop wrapping: past the end goes back in keeping the overshoot, before the start goes to the end, a long overshoot wraps by modulo, off = unchanged: ' + [lo.f1, lo.f2, lo.f3, lo.f4, lo.f5].join());
    ok(Math.abs(lo.half.end - 4.25) < 1e-9 && Math.abs(lo.dbl.end - 7.25) < 1e-9 && lo.dbl2.end === 30 && lo.len === 2, 'halve / double the loop (doubling stops at the end of the track)');
    ok(r.win[0].a === 85 && r.win[0].b === 115 && r.win[1].a === 0 && r.win[1].b === 30 && r.win[2].a === 570 && r.win[2].b === 600 && r.win[3].a === 0 && r.win[3].b === 12, 'reversed window for a long track: +-15 s round the position, inside the track, the whole of a short one: ' + JSON.stringify(r.win));
    const pk = r.peaks;
    ok(pk.n === 400 && pk.per === 200 && pk.minmax >= -0.51 && pk.minmax < -0.45 && pk.maxmax <= 0.51 && pk.maxmax > 0.45 && pk.finite && pk.bands && pk.lowDom && pk.highDom && pk.st === 200 && pk.empty === 1, `peaks: 200 bins a second (${pk.n} for 2 s), min / max in range, no NaN, bands 0..1, a low tone is low, a high tone is high, stereo and tiny inputs are fine`);
    const st = r.store;
    ok(st.quant === true && st.zoom === 8 && st.keys === 'a' && st.cues === '[1,null,null,null]' && st.none === '{"tracks":{},"quant":true,"zoom":8}' && st.key === 'file:a.wav|12|3.14', 'the remembered data is made safe: bad values dropped, four cues, key = name + size + length: ' + JSON.stringify(st));
    ok(t.log.external.length === 0, 'no outside request');
    await t.browser.close();
  }

  // ================= the screen: generated files =================
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const p = t.page;
  const D = (i) => p.evaluate((i) => { const d = window.__dj.decks[i]; return JSON.parse(JSON.stringify(d)); }, i);
  const probe = () => p.evaluate(() => window.__dj.probe());
  const setPlay = async (i, want) => { const is = (await D(i)).playing; if (is !== want) await p.click(i === 0 ? '#dj-play-a' : '#dj-play-b'); };
  const openDJ = async () => { await p.evaluate(() => (location.hash = '#/music/dj')); await p.waitForSelector('#dj-platter-a'); await p.waitForFunction(() => window.__dj.decks.every((d) => !d.loading)); await installHelpers(p); };
  const load = async (i, f) => { await p.setInputFiles(i === 0 ? '#dj-file-a' : '#dj-file-b', f); await p.waitForFunction((i) => window.__dj.decks[i].track === 'file' && !window.__dj.decks[i].loading, i, { timeout: 20000 }); };
  const W120 = wav(20, 120, 0.25), W120b = wav(20, 120, 0.1), W100 = wav(20, 100, 0.1);
  await openDJ();

  // ---- the built-in tracks have waveform, grid, counters ----
  const b0 = await D(0);
  ok(b0.peaksN === Math.ceil(b0.dur * 200) && b0.grid.bpm === 124 && b0.grid.offset === 0 && !b0.imported && b0.chans === 1, `built-in track: ${b0.peaksN} waveform bins, grid 124 BPM from the generator, first beat at 0`);
  const px = (sel) => p.evaluate((s) => { const c = document.querySelector(s), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let col = 0, dark = 0, pink = 0, purple = 0, cyan = 0; for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (Math.max(r, g, b) - Math.min(r, g, b) > 60) { col++; if (r > 200 && g < 130 && b < 170) pink++; if (b > 200 && r > 100 && r < 170 && g < 130) purple++; if (b > 150 && g > 130 && r < 80) cyan++; } if (r < 90 && g < 90 && b < 100) dark++; } return { col, dark, pink, purple, cyan, w: c.width, h: c.height }; }, sel);
  await wait(p, 300);
  const wp = await px('#dj-wave-a');
  ok(wp.col > 300 && wp.dark > 20, `the zoomed waveform of the built-in track is drawn (${wp.col} coloured pixels, ${wp.dark} dark ones: beat lines and the playhead)`);
  ok(wp.pink > 20 && (wp.purple + wp.cyan) > 20, `the waveform is coloured by frequency band (pink low ${wp.pink}, purple mid ${wp.purple}, cyan high ${wp.cyan} samples)`);
  const ov = await px('#dj-ovw-a');
  ok(ov.col > 100, `the overview strip of the whole track is drawn (${ov.col})`);
  await setPlay(0, true); await wait(p, 700);
  const tm = await p.evaluate(() => ({ t: document.querySelector('#dj-time-a').textContent, bar: document.querySelector('#dj-time-a').dataset.bar, beat: document.querySelector('#dj-time-a').dataset.beat }));
  const pa = await D(0);
  const kT = (+tm.bar - 1) * 4 + (+tm.beat - 1);
  ok(/^\d+:\d\d\.\d −\d+:\d\d\.\d · \d+\.\d$/.test(tm.t) && Math.abs(pa.beat - (pa.pos * 124) / 60) < 0.001 && Math.abs(kT - Math.floor(pa.beat)) <= 1 && pa.pos > 0.4, 'elapsed / remaining time and the bar.beat counter are shown and follow the grid: ' + tm.t);
  const scrolled = await p.evaluate(async () => { const c = document.querySelector('#dj-wave-a'); const a = c.toDataURL(); await new Promise((r) => setTimeout(r, 250)); return a !== c.toDataURL(); });
  ok(scrolled, 'the waveform scrolls under the playhead while the deck plays');
  await setPlay(0, false); await wait(p, 600);
  const still = await p.evaluate(async () => { const c = document.querySelector('#dj-wave-a'); const a = c.toDataURL(); await new Promise((r) => setTimeout(r, 300)); return a === c.toDataURL(); });
  ok(still, 'and stands still when the deck is paused');
  // beat lines at the right places: seek to 1.0 s and look at the pixels at the beat x
  await p.evaluate(() => window.__t.tapAt('#dj-ovw-a', 0));
  await wait(p, 200);
  const lines = await p.evaluate(() => { const c = document.querySelector('#dj-wave-a'), d = window.__dj.decks[0], k = c.width / c.offsetWidth, W = c.offsetWidth, pps = W / window.__dj.zoom, x = c.getContext('2d'); const lum = (cx) => { const q = x.getImageData(Math.round(cx * k), 3 * k, 1, 1).data; return q[0] + q[1] + q[2]; }; const beat = W / 2 + (60 / d.grid.bpm - d.pos) * pps; return { pos: d.pos, beat: lum(beat), off: lum(beat + 0.25 * (60 / d.grid.bpm) * pps), bar: lum(W / 2 + (4 * 60 / d.grid.bpm - d.pos) * pps) }; });
  ok(lines.beat < lines.off - 150 && lines.bar < lines.beat - 100 && lines.off > 600, `beat lines sit on the grid (the beat line is darker ${lines.beat} than the space between beats ${lines.off}, the bar line is darker still ${lines.bar})`);
  // zoom
  await p.click('#dj-zoom-in');
  ok((await p.evaluate(() => window.__dj.zoom)) === 4 && (await p.textContent('#dj-zoomval')) === '4 秒', 'zoom in: the window is 4 s');
  await p.click('#dj-zoom-in'); await p.click('#dj-zoom-in');
  ok((await p.evaluate(() => window.__dj.zoom)) === 4, 'zoom in stops at 4 s');
  await p.click('#dj-zoom-out'); await p.click('#dj-zoom-out'); await p.click('#dj-zoom-out');
  ok((await p.evaluate(() => window.__dj.zoom)) === 16 && (await p.evaluate(() => JSON.parse(localStorage.getItem('learn.music.dj.v1')).zoom)) === 16, 'zoom out to 16 s and stops; the choice is kept on this device');
  await p.click('#dj-zoom-in'); await p.click('#dj-zoom-in');

  // ---- import: WAV with a known BPM ----
  await load(0, file('clicks-120.wav', W120));
  const f0 = await D(0);
  ok(f0.imported && f0.track === 'file' && f0.name === 'clicks-120.wav' && Math.abs(f0.dur - 20) < 0.05 && f0.chans === 2 && f0.peaksN === Math.ceil(f0.dur * 200), `a stereo WAV is decoded: ${f0.name}, ${f0.dur.toFixed(2)} s, ${f0.chans} channels, ${f0.peaksN} waveform bins`);
  let e0 = Math.abs(f0.grid.offset - 0.25); e0 = Math.min(e0, 0.5 - e0);
  ok(Math.abs(f0.grid.bpm - 120) < 0.5 && e0 < 0.025, `BPM detected from the file: ${f0.grid.bpm} (120), first beat ${f0.grid.offset.toFixed(3)} s (0.25), off by ${(e0 * 1000).toFixed(0)} ms`);
  ok((await p.textContent('#dj-name-a')) === 'clicks-120.wav' && (await p.locator('#dj-name-a').isVisible()) && (await p.evaluate(() => document.querySelector('#dj-name-a').classList.contains('user'))) && (await p.inputValue('#dj-track-a')) === 'file', 'the file name is shown on the deck as the user\'s own text (class user, never translated) and in the picker');
  ok((await p.locator('#toasts .toast').last().textContent()).includes('已载入') && (await p.textContent('#dj-bpm-a')) === f0.grid.bpm.toFixed(1), 'the load is answered with a message; the BPM of the deck shows the detected tempo');
  ok((await p.locator('.dj-hint').first().textContent()).includes('重新选择'), 'a line under the button says the file must be chosen again after a reload');
  await wait(p, 300);
  const wi = await px('#dj-wave-a'), oi = await px('#dj-ovw-a');
  ok(wi.col > 20 && wi.dark > 20 && oi.col > 20, `the waveform and the overview of the imported file are drawn (${wi.col} / ${oi.col} coloured pixels)`);
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('learn.music.dj.v1'))).tracks['file:clicks-120.wav|' + W120.length + '|20.00'] !== undefined, 'only the small grid / cue record is stored (key = name + size + length)');
  ok((await p.evaluate(() => Object.keys(localStorage).filter((k) => /dj/.test(k)).join())) === 'learn.music.dj.v1', 'nothing else is stored');

  // ---- overview: tap and drag = needle search ----
  await setPlay(0, true); await wait(p, 500);
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-ovw-a'); T.ev('#dj-ovw-a', 'pointerdown', 5, g.l + g.w * 0.25, g.cy); });
  await wait(p, 200);
  const sk = await D(0);
  ok(sk.seeking && Math.abs(sk.pos - 5) < 0.6 && Math.abs(sk.cur) < 0.05 && !sk.sounding, `a touch on the overview jumps there (25 % = ${sk.pos.toFixed(2)} s of 20) and the record is held, silent, while the finger is down`);
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-ovw-a'); T.ev('#dj-ovw-a', 'pointermove', 5, g.l + g.w * 0.75, g.cy); });
  await wait(p, 100);
  ok(Math.abs((await D(0)).pos - 15) < 0.6, 'dragging along the strip searches (75 % = ' + (await D(0)).pos.toFixed(2) + ' s)');
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-ovw-a'); T.ev('#dj-ovw-a', 'pointerup', 5, g.l + g.w * 0.75, g.cy); });
  await wait(p, 600);
  const sk2 = await D(0);
  ok(!sk2.seeking && sk2.cur > 0.9 && sk2.sounding && sk2.pos > 15 && sk2.pos < 17, 'released: the deck goes on playing from there');
  await setPlay(0, false); await wait(p, 600);

  // ---- hot cues ----
  const seekTo = async (frac) => { await p.evaluate((f) => window.__t.tapAt('#dj-ovw-a', f), frac); await wait(p, 120); };
  await seekTo(0.3);
  const posA = (await D(0)).pos;
  await p.click('#dj-hc-a-0');
  let c0 = (await D(0)).cues[0];
  const onBeat = (t, g = gridNow) => { const k = ((t - g.offset) * g.bpm) / 60; return Math.abs(k - Math.round(k)) < 1e-6; };
  let gridNow = (await D(0)).grid;
  gridNow = (await D(0)).grid; await wait(p, 120);
  ok(c0 !== null && onBeat(c0, gridNow) && Math.abs(c0 - posA) <= 0.26 && (await p.evaluate(() => document.querySelector('#dj-hc-a-0').classList.contains('set'))), `an empty hot cue pad sets the cue; with quantize on it snaps to the grid (${posA.toFixed(3)} s -> ${c0.toFixed(3)} s, a beat)`);
  await seekTo(0.7);
  await p.click('#dj-hc-a-0');
  ok(Math.abs((await D(0)).pos - c0) < 0.02, 'a pad that is set jumps to its cue point');
  await p.click('#dj-quant');
  ok(!(await p.evaluate(() => window.__dj.quant)), 'quantize off');
  await seekTo(0.5);
  const posB = (await D(0)).pos;
  await p.click('#dj-hc-a-1');
  const c1 = (await D(0)).cues[1];
  ok(Math.abs(c1 - posB) < 0.02 && !onBeat(c1, (await D(0)).grid), `with quantize off the cue is set exactly where the record is (${posB.toFixed(3)} -> ${c1.toFixed(3)})`);
  await seekTo(0.9); await p.click('#dj-hc-a-2');
  await wait(p, 200);
  const wm = await px('#dj-wave-a'), om = await px('#dj-ovw-a');
  ok((await D(0)).cues.filter((x) => x !== null).length === 3 && om.col > 20, 'three cues set; they are drawn on the overview');
  // the marker on the zoomed waveform: seek close to cue 1 and look for its colour (red flag at the cue x)
  await p.evaluate((c) => { const d = window.__dj.decks[0]; }, c1);
  await p.click('#dj-hc-a-1'); await wait(p, 300);
  const flag = await p.evaluate(() => { const c = document.querySelector('#dj-wave-a'), k = c.width / c.offsetWidth, x = c.getContext('2d'), q = x.getImageData(Math.round((c.offsetWidth / 2 + 6) * k), 6 * k, 1, 1).data; return [q[0], q[1], q[2]]; });
  ok(flag[0] > 200 && flag[1] > 150 && flag[2] < 80, 'the hot cue 2 marker (amber flag) is drawn on the waveform at the cue point: ' + flag.join());
  // delete: the toggle and the long press
  await p.click('#dj-hcdel-a'); await p.click('#dj-hc-a-2');
  ok((await D(0)).cues[2] === null && (await p.getAttribute('#dj-hcdel-a', 'aria-pressed')) === 'true', 'delete toggle + a pad removes that cue');
  await p.click('#dj-hc-a-0');
  ok((await D(0)).cues[0] === null, 'with the toggle on a tap on a set pad deletes it');
  await p.click('#dj-hcdel-a');
  await p.click('#dj-hc-a-2'); await p.evaluate(() => window.__t.tapAt('#dj-ovw-a', 0.4));
  const cl = (await D(0)).cues[2];
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-hc-a-2'); T.ev('#dj-hc-a-2', 'pointerdown', 6, g.cx, g.cy); });
  await wait(p, 800);
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-hc-a-2'); T.ev('#dj-hc-a-2', 'pointerup', 6, g.cx, g.cy); });
  ok(cl !== null && (await D(0)).cues[2] === null && (await D(0)).pos < 20, 'a long press (0.8 s) on a set pad deletes it, without jumping');
  await p.click('#dj-quant');
  // persistence: nudge the grid, keep two cues, reload, load the same file again
  await seekTo(0.2); await p.click('#dj-hc-a-0'); await seekTo(0.6); await p.click('#dj-hc-a-3');
  await p.click('#dj-gridb-a');
  ok(await p.locator('#dj-gridp-a').isVisible(), 'the grid tools open');
  const g0 = (await D(0)).grid.offset;
  await p.click('#dj-np-a');
  ok(Math.abs((await D(0)).grid.offset - (g0 + 0.01)) < 1e-6, 'grid nudge +10 ms');
  await p.click('#dj-nm-a'); await p.click('#dj-nm-a');
  ok(Math.abs((await D(0)).grid.offset - (g0 - 0.01)) < 1e-6, 'grid nudge -10 ms (twice)');
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-np-a'); T.ev('#dj-np-a', 'pointerdown', 7, g.cx, g.cy); });
  await wait(p, 1100);
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-np-a'); T.ev('#dj-np-a', 'pointerup', 7, g.cx, g.cy); });
  const gh = (await D(0)).grid.offset - (g0 - 0.01);
  ok(gh > 0.05 && gh < 0.12, `holding the + button repeats (${(gh * 1000).toFixed(0)} ms in 1.1 s)`);
  const before = await D(0);
  await p.click('#dj-gx2-a'); await wait(p, 120); ok((await D(0)).grid.bpm === before.grid.bpm * 2 && (await p.textContent('#dj-bpm-a')) === (before.grid.bpm * 2).toFixed(1), 'BPM ×2 (the display follows)');
  await p.click('#dj-gd2-a'); await p.click('#dj-gd2-a'); await p.click('#dj-gx2-a');
  ok(Math.abs((await D(0)).grid.bpm - before.grid.bpm) < 0.02, '÷2 ÷2 ×2 comes back to the detected BPM');
  const savedCues = (await D(0)).cues, savedGrid = (await D(0)).grid;
  // tap tempo
  await seekTo(0.4);
  for (let k = 0; k < 6; k++) { await p.click('#dj-tap-a'); await wait(p, 500); }
  const tp = await D(0);
  ok(tp.grid.bpm > 100 && tp.grid.bpm < 130, `tap tempo: six taps about 500 ms apart set the BPM (${tp.grid.bpm})`);
  await p.evaluate(({ g }) => { /* restore the detected grid for the next steps */ }, { g: savedGrid });
  await p.evaluate(() => { const d = window.__dj; });
  // restore through the grid buttons is not possible exactly: reload and use the stored record of the last change; so set it back through the real tools
  await p.evaluate((g) => { const s = JSON.parse(localStorage.getItem('learn.music.dj.v1')); const k = Object.keys(s.tracks).find((x) => x.startsWith('file:clicks-120')); s.tracks[k] = { bpm: g.bpm, offset: g.offset, cues: s.tracks[k].cues }; localStorage.setItem('learn.music.dj.v1', JSON.stringify(s)); }, savedGrid);
  await p.reload(); await p.waitForSelector('.hub-grid, .kids, .empty-home, #dj-platter-a', { timeout: 15000 }).catch(() => {});
  await openDJ();
  ok((await D(0)).track !== 'file' && !(await p.locator('#dj-name-a').isVisible()), 'after a reload the file is gone (it has to be chosen again), the built-in track is back');
  await load(0, file('clicks-120.wav', W120));
  const re = await D(0);
  ok(JSON.stringify(re.cues) === JSON.stringify(savedCues) && re.cues.filter((x) => x !== null).length === 3 && Math.abs(re.grid.bpm - savedGrid.bpm) < 1e-9 && Math.abs(re.grid.offset - savedGrid.offset) < 1e-9, 'the same file chosen again finds its hot cues and its (corrected) grid: ' + JSON.stringify(re.cues));
  const zq = await p.evaluate(() => [window.__dj.zoom, window.__dj.quant]);
  ok(zq[0] === 4 && zq[1] === true, 'the zoom and the quantize choice survive the reload: ' + zq.join());
  await load(1, file('other-name.wav', W120));
  ok((await D(1)).cues.every((x) => x === null), 'another file has no cues (they belong to a name + size + length)');
  await p.selectOption('#dj-track-b', 'house'); await p.waitForFunction(() => !window.__dj.decks[1].loading);
  ok((await D(1)).track === 'house' && !(await p.locator('#dj-name-b').isVisible()) && (await p.locator('#dj-track-b option[value=file]').count()) === 0, 'choosing a built-in track again removes the file from the deck (its memory is released)');
  await p.selectOption('#dj-track-a', 'house'); await p.waitForFunction(() => !window.__dj.decks[0].loading);
  const hb = await D(0);
  await seekTo(0.35); await p.click('#dj-hc-a-0');
  ok((await D(0)).cues[0] !== null && hb.cues.every((x) => x === null), 'built-in tracks get hot cues too (kept under their own id)');
  await p.click('#dj-hcdel-a'); await p.click('#dj-hc-a-0'); await p.click('#dj-hcdel-a');

  // ---- the CUE button: three behaviours ----
  await setPlay(0, false); await seekTo(0.1);
  const pc = (await D(0)).pos;
  await p.evaluate(() => window.__t.ev('#dj-cue-a', 'pointerdown', 5, 10, 10)); await wait(p, 400);
  const cb = await D(0);
  ok(Math.abs(cb.cue - pc) < 0.02 && cb.cueHold && cb.cur > 0.9 && cb.sounding, `paused: CUE sets the cue point to the position (${pc.toFixed(2)}) and plays from it while held`);
  await p.evaluate(() => window.__t.ev('#dj-cue-a', 'pointerup', 5, 10, 10)); await wait(p, 200);
  const ca = await D(0);
  ok(!ca.cueHold && !ca.sounding && Math.abs(ca.pos - ca.cue) < 1e-6, 'released: it stops and returns to the cue point');
  await setPlay(0, true); await wait(p, 900);
  await p.click('#dj-cue-a'); await wait(p, 200);
  const cp = await D(0);
  ok(!cp.playing && Math.abs(cp.pos - cp.cue) < 1e-6 && Math.abs(cp.cue - pc) < 0.02, 'while playing: CUE jumps back to the cue point and pauses');

  // ---- loops ----
  await p.selectOption('#dj-track-a', 'house'); await load(0, file('clicks-120.wav', W120));
  await setPlay(0, false); await seekTo(0.2);
  await p.click('#dj-loop-a-4'); await setPlay(0, true); await wait(p, 200);
  let lp = await D(0);
  ok(lp.loop.on && Math.abs(lp.loop.end - lp.loop.start - 2) < 1e-6 && onBeat(lp.loop.start, lp.grid), `an auto loop of 4 beats: ${lp.loop.start.toFixed(3)} - ${lp.loop.end.toFixed(3)} s (2.0 s at 120 BPM), starting on a beat`);
  const pr = await probe();
  ok(pr.decks[0].loop && pr.decks[0].loop[0] === true && Math.abs(pr.decks[0].loop[1] - lp.loop.start) < 1e-4 && Math.abs(pr.decks[0].loop[2] - lp.loop.end) < 1e-4, 'the audio source itself loops between those points (loopStart / loopEnd): ' + JSON.stringify(pr.decks[0].loop));
  const trace = await p.evaluate(async () => { const out = []; for (let k = 0; k < 90; k++) { await new Promise((r) => setTimeout(r, 40)); out.push(window.__dj.decks[0].pos); } return out; });
  const wraps = trace.filter((x, k) => k && x < trace[k - 1] - 0.5).length;
  ok(trace.every((x) => x >= lp.loop.start - 0.001 && x < lp.loop.end + 0.001) && wraps >= 1, `the position stays inside the loop for 3.6 s and wraps ${wraps} time(s) (${Math.min(...trace).toFixed(2)} - ${Math.max(...trace).toFixed(2)})`);
  await p.click('#dj-lhalf-a');
  lp = await D(0);
  ok(Math.abs(lp.loop.end - lp.loop.start - 1) < 1e-6, 'halve: 1.0 s'); 
  await p.click('#dj-ldbl-a'); await p.click('#dj-ldbl-a');
  lp = await D(0);
  ok(Math.abs(lp.loop.end - lp.loop.start - 4) < 1e-6, 'double twice: 4.0 s');
  await p.click('#dj-lreloop-a'); await wait(p, 100);
  ok(!(await D(0)).loop.on && (await probe()).decks[0].loop[2] === 0, 'loop off: the source plays on (loopEnd 0 = the whole track)');
  const out = (await D(0)).pos; await wait(p, 300);
  ok((await D(0)).pos > out, 'the position goes on after the loop end');
  await p.click('#dj-lreloop-a'); await wait(p, 100);
  const rl = await D(0);
  ok(rl.loop.on && Math.abs(rl.pos - rl.loop.start) < 0.3, 'reloop: the loop is on again and the record is back at its start');
  await p.click('#dj-loop-a-8'); await wait(p, 100);
  ok(!(await D(0)).loop.on, 'the active loop button (8 beats = the doubled loop) turns the loop off when pressed again');
  // IN / OUT
  await setPlay(0, false); await seekTo(0.4); await p.click('#dj-lin-a'); const lin = (await D(0)).loop.start;
  await setPlay(0, true); await wait(p, 1300); await p.click('#dj-lout-a');
  const lio = await D(0);
  ok(lio.loop.on && lio.loop.end - lio.loop.start > 0.9 && lio.loop.end - lio.loop.start < 2.1 && Math.abs(lio.loop.start - lin) < 1e-9 && onBeat(lio.loop.end, lio.grid), `manual loop: IN ${lin.toFixed(2)}, OUT ${lio.loop.end.toFixed(2)} (both on the grid), ${(lio.loop.end - lio.loop.start).toFixed(2)} s`);
  await p.click('#dj-lreloop-a');
  // quantize off: the loop starts at the position
  await p.click('#dj-quant'); await setPlay(0, false); await seekTo(0.55);
  const p0 = (await D(0)).pos; await p.click('#dj-loop-a-2');
  const lq = await D(0);
  ok(Math.abs(lq.loop.start - p0) < 0.02 && !onBeat(lq.loop.start, lq.grid), 'quantize off: the loop starts exactly at the position (' + p0.toFixed(3) + ')');
  await p.click('#dj-quant'); await p.click('#dj-lreloop-a');
  // ROLL: hold = loop, release = where the track would have been
  await setPlay(0, false); await seekTo(0.15); await setPlay(0, true); await wait(p, 300);
  await p.click('#dj-lroll-a');
  const st0 = await D(0); const t0 = Date.now();
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-loop-a-1_2'); T.ev('#dj-loop-a-1_2', 'pointerdown', 8, g.cx, g.cy); });
  await wait(p, 100);
  const inRoll = await D(0);
  await wait(p, 1300);
  const mid = await D(0);
  ok(inRoll.loop.on && inRoll.roll && Math.abs(inRoll.loop.end - inRoll.loop.start - 0.25) < 1e-6 && mid.pos >= inRoll.loop.start - 0.001 && mid.pos < inRoll.loop.end + 0.001, `roll: while the pad is held a 1/2-beat loop (${(inRoll.loop.end - inRoll.loop.start) * 1000} ms) repeats, the position stays in it`);
  await p.evaluate(() => { const T = window.__t, g = T.geo('#dj-loop-a-1_2'); T.ev('#dj-loop-a-1_2', 'pointerup', 8, g.cx, g.cy); });
  const el = (Date.now() - t0) / 1000;
  await wait(p, 100);
  const aft = await D(0);
  ok(!aft.loop.on && !aft.roll && Math.abs(aft.pos - (st0.pos + el + 0.1)) < 0.35, `released: the track goes on where it would have been (slip): ${aft.pos.toFixed(2)} s, expected ${(st0.pos + el + 0.1).toFixed(2)} s (no loop for ${(el).toFixed(2)} s: it would have been here)`);
  await p.click('#dj-lroll-a'); await setPlay(0, false);

  // ---- true SYNC ----
  await p.selectOption('#dj-track-a', 'house'); await p.waitForFunction(() => !window.__dj.decks[0].loading);
  await load(1, file('clicks-120b.wav', W120b));
  await setPlay(0, true); await wait(p, 200);
  await p.evaluate(() => window.__t.tapAt('#dj-ovw-b', 0.31));
  await setPlay(1, true); await wait(p, 500);
  const pre = await p.evaluate(() => ({ ms: window.__dj.phase.ms, beats: window.__dj.phase.beats }));
  ok(Math.abs(pre.beats) > 0.05, `before the sync the beats of the two decks do not coincide (${pre.ms.toFixed(0)} ms apart)`);
  await p.click('#dj-sync'); await wait(p, 400);
  const after = await p.evaluate(() => { const a = window.__dj.decks[0], b = window.__dj.decks[1], fr = (x) => x - Math.floor(x); let d = fr(b.beat) - fr(a.beat); d -= Math.round(d); return { d, ms: window.__dj.phase.ms, pitch: b.pitch, bpmA: a.bpm, bpmB: b.bpm, dom: document.querySelector('#dj-phase').dataset.ms, text: document.querySelector('#dj-phase-ms').textContent }; });
  ok(Math.abs(after.bpmB - after.bpmA) < 0.1 && Math.abs(after.d) < 0.04 && Math.abs(after.ms) < 20, `SYNC moves deck B onto deck A's beat as well as its tempo (B ${after.bpmB.toFixed(2)} = A ${after.bpmA.toFixed(2)} BPM, phase difference ${after.d.toFixed(3)} beat = ${after.ms.toFixed(1)} ms)`);
  ok(Math.abs(+after.dom - after.ms) < 15 && /ms$/.test(after.text) && (await p.locator('#dj-phase.ok').count()) === 1, 'the phase meter between the decks shows the difference in ms and turns green when aligned: ' + after.text);
  const syncToast = await p.locator('#toasts .toast').last().textContent();
  await wait(p, 3000);
  const drift = await p.evaluate(() => window.__dj.phase.ms);
  ok(Math.abs(drift) < 25, `after 3 s of playing together the decks are still on the same beat (${drift.toFixed(1)} ms)`);
  ok(syncToast.includes('已同步'), 'SYNC is answered with a message');
  // lock
  await p.click('#dj-lock'); await wait(p, 120);
  ok((await p.evaluate(() => window.__dj.lock)) && (await p.locator('#dj-lock.on').count()) === 1, 'sync lock on');
  await p.evaluate(() => { const b = window.__dj.decks[1]; });
  await p.evaluate(() => { /* push deck B 14 ms off the beat */ const T = window.__t; });
  const off0 = await p.evaluate(async () => { const d = window.__dj; const b = d.decks[1]; const before = d.phase.ms; /* a small shift through the overview: 0.014 s of B */ const g = window.__t.geo('#dj-ovw-b'); const frac = (b.pos + 0.014 * 1) / b.dur; window.__t.ev('#dj-ovw-b', 'pointerdown', 4, g.l + g.w * frac, g.cy); window.__t.ev('#dj-ovw-b', 'pointerup', 4, g.l + g.w * frac, g.cy); await new Promise((r) => setTimeout(r, 150)); return { before, after: d.phase.ms }; });
  await wait(p, 4000);
  const off1 = await p.evaluate(() => window.__dj.phase.ms);
  ok(Math.abs(off0.after) > 3 && Math.abs(off1) < Math.abs(off0.after) * 0.8 + 1 && (await p.evaluate(() => window.__dj.lock)), `sync lock corrects the phase slowly while both play (${off0.after.toFixed(1)} ms -> ${off1.toFixed(1)} ms in 4 s) and stays on`);
  await p.evaluate(() => { const T = window.__t; T.ev('#dj-platter-b', 'pointerdown', 31, ...T.at('#dj-platter-b', 0)); });
  await wait(p, 120);
  ok(!(await p.evaluate(() => window.__dj.lock)) && (await p.locator('#dj-lock.on').count()) === 0, 'touching deck B (scratch) releases the sync lock');
  await p.evaluate(() => { const T = window.__t; T.ev('#dj-platter-b', 'pointerup', 31, ...T.at('#dj-platter-b', 0)); });
  await p.click('#dj-lock'); await p.focus('#dj-pitch-b'); await p.keyboard.press('ArrowRight');
  ok(!(await p.evaluate(() => window.__dj.lock)), 'moving the tempo fader of deck B releases the sync lock');
  await setPlay(0, false); await setPlay(1, false);

  // ---- errors and limits ----
  const before2 = await D(0);
  await p.setInputFiles('#dj-file-a', { name: 'notes.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('this is not audio at all, just text'.repeat(40)) });
  await p.waitForFunction(() => document.querySelector('#toasts .toast')?.textContent.includes('无法解码'), null, { timeout: 15000 });
  const afterBad = await D(0);
  ok(afterBad.track === before2.track && afterBad.name === before2.name && !afterBad.loading && !(await p.locator('select#dj-track-a').isDisabled()), 'a file that is not audio: a formal error message, the deck keeps what it had');
  await p.setInputFiles('#dj-file-a', { name: 'empty.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(0) });
  await p.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some((x) => x.textContent.includes('文件为空')), null, { timeout: 8000 });
  ok(true, 'an empty file: its own message');
  await p.setInputFiles('#dj-file-a', { name: 'huge.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(26 * 1024 * 1024) });
  await p.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some((x) => x.textContent.includes('文件过大')), null, { timeout: 15000 });
  ok((await D(0)).track === before2.track, 'a file over about 25 MB is refused before it is read: "文件过大"');
  await p.setInputFiles('#dj-file-a', file('eleven-minutes.wav', wav(660, 0, 0, { sr: 8000, ch: 1 })));
  await p.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some((x) => x.textContent.includes('曲目过长')), null, { timeout: 40000 });
  ok((await D(0)).track === before2.track, 'a track over 10 minutes is refused: "曲目过长"');
  // a long stereo track is mixed to mono; scratching backwards reverses only a window
  await p.setInputFiles('#dj-file-b', file('long-stereo.wav', wav(390, 100, 0.2, { sr: 8000, ch: 2 })));
  await p.waitForFunction(() => window.__dj.decks[1].track === 'file' && !window.__dj.decks[1].loading, null, { timeout: 60000 });
  const lg = await D(1);
  ok(lg.chans === 1 && lg.dur > 389 && Math.abs(lg.grid.bpm - 100) < 1, `a 6.5 minute stereo file is mixed to mono in memory (${lg.chans} channel, ${lg.dur.toFixed(0)} s, BPM ${lg.grid.bpm}); a 20 s stereo file keeps two channels (above)`);
  await p.evaluate(() => window.__t.tapAt('#dj-ovw-b', 0.5));
  await setPlay(1, true); await wait(p, 300);
  await p.evaluate(() => window.__t.down('#dj-platter-b', 12, 0));
  await p.evaluate(async () => { const T = window.__t; for (let k = 1; k <= 14; k++) { await T.sleep(16); T.ev('#dj-platter-b', 'pointermove', 12, ...T.at('#dj-platter-b', -10 * k)); } });
  const rw = await D(1);
  ok(rw.dir === -1 && rw.rwin && rw.rwin[1] - rw.rwin[0] <= 30.5 && rw.rwin[1] - rw.rwin[0] > 20 && rw.pos > rw.rwin[0] && rw.pos < rw.rwin[1] && rw.rwin[1] - rw.rwin[0] < rw.dur / 5, `scratching backwards on a long track reverses only a window (${rw.rwin.map((x) => x.toFixed(0)).join(' - ')} s of ${rw.dur.toFixed(0)} s), not the whole file`);
  await p.evaluate(() => window.__t.up('#dj-platter-b', 12, -140)); await setPlay(1, false);

  // ---- drag and drop ----
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()));
  await p.evaluate(async () => {
    const bytes = new Uint8Array(0); const dt = new DataTransfer(); dt.items.add(new File([bytes], 'dropped.wav', { type: 'audio/wav' }));
    const deck = document.querySelector('#dj-deck-a'); deck.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    window.__over = deck.classList.contains('drop');
    deck.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  ok(await p.evaluate(() => window.__over), 'dragging a file over a deck highlights it');
  await p.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some((x) => x.textContent.includes('文件为空')), null, { timeout: 8000 });
  ok(true, 'dropping a file on a deck loads it (an empty dropped file gives the empty-file message)');
  const wdrop = wav(12, 120, 0.2);
  await p.evaluate(async (b64) => {
    const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'dropped-120.wav', { type: 'audio/wav' }));
    document.querySelector('#dj-deck-a').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, wdrop.toString('base64'));
  await p.waitForFunction(() => window.__dj.decks[0].name === 'dropped-120.wav' && !window.__dj.decks[0].loading, null, { timeout: 20000 });
  ok(Math.abs((await D(0)).grid.bpm - 120) < 0.5, 'a dropped WAV is loaded and its BPM detected');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app (the files are decoded here and never uploaded)');
  await t.browser.close();

  // ================= canvases at dpr 2 with animations ON =================
  {
    const s = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 }, dpr: 2, motion: true });
    await s.page.evaluate(() => (location.hash = '#/music/dj')); await s.page.waitForSelector('#dj-wave-a');
    const first = await s.page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => ({ id: c.id, w: c.width, h: c.height, ow: c.offsetWidth, oh: c.offsetHeight, rw: c.getBoundingClientRect().width })));
    await wait(s.page, 1200);
    const later = await s.page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => ({ id: c.id, w: c.width, h: c.height, ow: c.offsetWidth, oh: c.offsetHeight, rw: c.getBoundingClientRect().width })));
    const good = (a) => a.length >= 4 && a.every((c) => !c.ow || (Math.abs(c.w - c.ow * 2) <= 1 && Math.abs(c.h - c.oh * 2) <= 1));
    ok(good(later) && later.every((c) => Math.abs(c.rw - c.ow) <= 1), `at dpr 2 every canvas is exactly twice its layout size (${later.map((c) => c.id + ' ' + c.w + 'x' + c.h).join(', ')}) and the page is at full size after its entrance`);
    ok(good(first), `...and also while the page is still growing in (animations on): canvas ${first[0].w}x${first[0].h} for a layout of ${first[0].ow}x${first[0].oh} (the page was drawn at ${Math.round((first[0].rw / first[0].ow) * 100)} % of its size at that moment)`);
    await s.page.screenshot({ path: OUT + 'dj-pro-dpr2.png' });
    ok(s.log.external.length === 0, 'dpr 2: no outside request');
    await s.browser.close();
  }

  // ================= screens =================
  const SIZES = [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }], ['ipad-land', { width: 1180, height: 820 }], ['ipad-pro', { width: 1366, height: 1024 }], ['phone-land', { width: 844, height: 390 }], ['small-phone', { width: 320, height: 568 }]];
  for (const [dn, vp] of SIZES) {
    const s = await start(new Map(), { local: true, viewport: vp });
    await s.page.evaluate(() => (location.hash = '#/music/dj')); await s.page.waitForSelector('#dj-platter-a');
    await s.page.waitForFunction(() => window.__dj && window.__dj.decks.every((d) => !d.loading));
    await s.page.click('#dj-play-a'); await wait(s.page, 500);
    if (dn === 'phone-land') { ok(await s.page.locator('.dj-page.dj-less').count() === 1 && !(await s.page.locator('#dj-loopc-a').isVisible()), 'phone-land: the compact variant hides loops, grid tools and the overview behind "更多"'); await s.page.click('#dj-more'); await wait(s.page, 200); ok(await s.page.locator('#dj-loopc-a').isVisible() && await s.page.locator('#dj-ovw-a').isVisible(), 'phone-land: the toggle brings them back'); }
    const m = await s.page.evaluate(() => {
      const vw = document.documentElement.clientWidth, rig = document.querySelector('.dj-rig').getBoundingClientRect(), wv = document.querySelector('.dj-waves').getBoundingClientRect();
      const els = [...document.querySelectorAll('.dj-deck, .dj-mixer, .dj-pads, .dj-pad, .dj-ctl, .dj-platter, .dj-select, .dj-page button, .dj-wave, .dj-ovw, .dj-waves')].filter((e) => e.offsetParent !== null);
      const outside = els.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1; }).map((e) => e.id || e.className);
      const small = [...document.querySelectorAll('.dj-page button, .dj-select, .dj-ctl, .dj-pad, .dj-ovw')].filter((e) => e.offsetParent !== null && !e.closest('.top')).filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 39.5; }).map((e) => `${e.id}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      const clip = [...document.querySelectorAll('.dj-page button, .dj-lab, .dj-pad b, .dj-bpmbox, .dj-pct, .dj-select, .dj-time, .dj-zoomval')].filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.textContent);
      const cv = [...document.querySelectorAll('canvas')].filter((c) => c.offsetWidth).map((c) => Math.abs(c.width - Math.round(c.offsetWidth * (window.devicePixelRatio || 1))) <= 1);
      return { sw: document.documentElement.scrollWidth <= vw, outside, small, clip, l: rig.left, r: vw - rig.right, wl: wv.left, wr: vw - wv.right, cv: cv.every(Boolean) && cv.length >= 4 };
    });
    ok(m.sw && m.outside.length === 0, `${dn}: no horizontal scroll, every control inside the screen${m.outside.length ? ' (outside: ' + m.outside.join() + ')' : ''}`);
    ok(Math.abs(m.l - m.r) <= 2 && Math.abs(m.wl - m.wr) <= 2 && m.l >= 0, `${dn}: equal space left and right (decks ${Math.round(m.l)} / ${Math.round(m.r)}, waveforms ${Math.round(m.wl)} / ${Math.round(m.wr)} px)`);
    ok(m.small.length === 0, `${dn}: every button, fader, knob, pad, cue, loop button and strip is at least 40 px${m.small.length ? ' (too small: ' + m.small.join() + ')' : ''}`);
    ok(m.clip.length === 0 && m.cv, `${dn}: no text is cut off, canvases match their layout size${m.clip.length ? ' (cut: ' + m.clip.join() + ')' : ''}`);
    await s.page.screenshot({ path: OUT + `dj-pro-${dn}.png` });
    await s.page.click('#dj-full'); await wait(s.page, 500);
    const fl = await s.page.evaluate(() => { const r = document.querySelector('.dj-rig'), vw = document.documentElement.clientWidth; return { over: r.scrollHeight - r.clientHeight, padsB: document.querySelector('#dj-pads').getBoundingClientRect().bottom, vh: innerHeight, sw: document.documentElement.scrollWidth <= vw, doc: document.documentElement.scrollHeight - innerHeight, l: r.getBoundingClientRect().left, r: vw - r.getBoundingClientRect().right }; });
    ok(fl.sw && fl.padsB <= fl.vh + 1 && Math.abs(fl.l - fl.r) <= 3, `${dn} full screen: fits the width, the pads end at ${Math.round(fl.padsB)} of ${fl.vh}, ${fl.over > 1 ? 'the decks scroll by ' + fl.over + ' px' : 'nothing scrolls'}`);
    if (dn === 'ipad-land' || dn === 'ipad-pro') ok(fl.over <= 1 && fl.doc <= 1, `${dn} full screen: waveforms, both decks, the mixer and the pads fit without any vertical scroll`);
    await s.page.screenshot({ path: OUT + `dj-pro-fullscreen-${dn}.png` });
    ok(s.log.external.length === 0, `${dn}: no outside request`);
    await s.browser.close();
  }

  // ================= languages =================
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }], ['land', { width: 1180, height: 820 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp });
      await s.page.evaluate(() => (location.hash = '#/music/dj')); await s.page.waitForSelector('#dj-platter-a');
      await s.page.waitForFunction(() => window.__dj && window.__dj.decks.every((d) => !d.loading));
      await s.page.setInputFiles('#dj-file-a', file('歌曲 click.wav', wav(12, 120, 0.2)));
      await s.page.waitForFunction(() => window.__dj.decks[0].track === 'file' && !window.__dj.decks[0].loading, null, { timeout: 20000 });
      await s.page.click('#dj-gridb-a'); await s.page.click('#dj-hc-a-0'); await s.page.click('#dj-loop-a-2'); await s.page.click('#dj-sync'); await wait(s.page, 400);
      const r = await s.page.evaluate(() => {
        const vw = document.documentElement.clientWidth, strip = (root) => { const c = root.cloneNode(true); c.querySelectorAll('.user').forEach((e) => e.remove()); return c; };
        const body = strip(document.querySelector('main')).innerText + ' ' + [...document.querySelectorAll('option:not(.user)')].map((o) => o.textContent).join(' ') + ' ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent.replace(/歌曲 click\\.wav/g, '')).join(' ');
        const attrs = [...document.querySelectorAll('[title],[aria-label]')].flatMap((e) => [e.getAttribute('title'), e.getAttribute('aria-label')]).filter(Boolean).join(' ');
        const clip = [...document.querySelectorAll('.dj-page button, .dj-lab, .dj-pad b, .dj-bpmbox, .dj-select, .dj-time, .dj-zoomval')].filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.textContent);
        return { sw: document.documentElement.scrollWidth <= vw, cjk: /[一-鿿]/.test(body.replace(/歌曲 click\.wav/g, '')), attrs: /[一-鿿]/.test(attrs), clip, name: document.querySelector('#dj-name-a').textContent, labels: [...document.querySelectorAll('#dj-import-a, #dj-hcdel-a, #dj-gridb-a, #dj-quant, #dj-more, #dj-lock')].map((e) => e.textContent).join(' | '), toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || ') };
      });
      ok(r.sw && r.clip.length === 0, `${name} ${dn}: the page fits, no text is cut off${r.clip.length ? ' (cut: ' + r.clip.join() + ')' : ''}`);
      ok(!r.cjk && !r.attrs && r.name === '歌曲 click.wav', `${name} ${dn}: no Chinese left except the file name, which stays as it is ("${r.name}"): ${r.labels}`);
      if (dn === 'ipad') await s.page.screenshot({ path: OUT + `dj-pro-${name}-ipad.png` });
      if (dn === 'land') await s.page.screenshot({ path: OUT + `dj-pro-${name}-land.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
})();
