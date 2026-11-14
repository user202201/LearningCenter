import { mountSim, type SimDef, type PhysCtx, type St, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-sound";
import { COL, line, rect, txt } from "./draw";

export const meta = CATALOG.sound;
// the sound: one oscillator whose waveform is made from the same harmonics as the drawing
let ac: AudioContext | null = null, osc: OscillatorNode | null = null, gain: GainNode | null = null;
const wave = (a: AudioContext, timbre: number) => { const b = Mo.harmonics(timbre); return a.createPeriodicWave(new Float32Array(b.length), Float32Array.from(b)); };
const sound = {
  start(s: St) {
    try {
      ac ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      void ac.resume();
      this.stop();
      osc = ac.createOscillator(); gain = ac.createGain();
      osc.setPeriodicWave(wave(ac, s.timbre)); osc.frequency.value = s.f; gain.gain.value = 0;
      osc.connect(gain).connect(ac.destination); osc.start();
      this.update(s);
    } catch { /* no audio on this device */ }
  },
  update(s: St) {
    if (!ac || !osc || !gain) return;
    osc.setPeriodicWave(wave(ac, s.timbre));
    osc.frequency.setTargetAtTime(s.f, ac.currentTime, 0.02);
    gain.gain.setTargetAtTime(0.35 * s.A, ac.currentTime, 0.02);   // (the peak is 0.35 * A: never loud)
  },
  stop() { try { osc?.stop(); osc?.disconnect(); gain?.disconnect(); } catch { /* already stopped */ } osc = null; gain = null; },
};
export const def: SimDef = {
  meta,
  lesson: [
    "声音由物体的振动产生。音调（高低）由频率决定：频率越高，音调越高；响度（大小）由振幅决定：振幅越大，响度越大。",
    "音色（品质）由波形决定：相同音调和响度的声音，波形不同，听起来也不同。屏幕上的示波器和播放的声音来自同一个公式。",
    "人耳能听到的频率大约是 20 Hz 到 20000 Hz；声音在 15 °C 空气中的速度约为 340 m/s，不能在真空中传播。",
  ],
  formulas: ["f=\\dfrac{1}{T}", "v=\\lambda f"],
  params: [
    { id: "f", label: "频率", min: 100, max: 2000, step: 10, value: 300, unit: "Hz" },
    { id: "A", label: "振幅", min: 0.1, max: 1, step: 0.05, value: 0.6 },
  ],
  choices: [{ id: "timbre", label: "音色（波形）", value: 0, options: [[0, "纯音"], [1, "方波"], [2, "锯齿波"], [3, "三角波"]] }],
  aspect: 0.5,
  readouts: (s) => [
    { label: "频率", value: fmt(s.f, 0), unit: "Hz" },
    { label: "周期", value: fmt(1000 * Mo.period(s.f), 2), unit: "ms" },
    { label: "声音强弱（分贝）", value: fmt(Mo.levelDb(s.A), 0), unit: "dB" },
    { label: "最接近的音名", value: `${Mo.nearestNote(s.f).name} (${Mo.nearestNote(s.f).cents >= 0 ? "+" : "−"}${Math.abs(Mo.nearestNote(s.f).cents)})`, unit: "" },
    { label: "空气中的波长", value: fmt(Mo.wavelength(s.f), 2), unit: "m" },
  ],
  draw(c, w, hh, s) {
    rect(c, 14, 14, 612, 292, "#10222b", COL.ink, 4, 18);
    for (let i = 1; i < 8; i++) line(c, 14 + (612 * i) / 8, 14, 14 + (612 * i) / 8, 306, "#1f4a58", 1.5);
    for (let i = 1; i < 4; i++) line(c, 14, 14 + (292 * i) / 4, 626, 14 + (292 * i) / 4, "#1f4a58", 1.5);
    line(c, 14, 160, 626, 160, "#2d7186", 2.5);
    // the oscilloscope window is 10 ms wide; the vertical axis is the amplitude (1 = 130 units)
    c.beginPath();
    for (let i = 0; i <= 600; i++) { const t = (i / 600) * 0.01; const y = 160 - 130 * Mo.wave(s.timbre, s.f, s.A, t); const x = 20 + i; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.strokeStyle = "#69db7c"; c.lineWidth = 4; c.stroke();
    txt(c, "10 ms", 616, 292, 17, "#99e9f2", "right"); txt(c, "A", 28, 32, 18, "#99e9f2", "left");
    // the amplitude marker
    line(c, 20, 160 - 130 * s.A, 40, 160 - 130 * s.A, COL.yellow, 3);
  },
  tasks: [
    { id: "a4", text: "把频率调到 440 Hz（标准音 A4），使用纯音", check: (s) => s.f === 440 && s.timbre === 0 },
    { id: "loud", text: "增大振幅，使声音强弱不低于 58 dB", check: (s) => Mo.levelDb(s.A) >= 58 },
    { id: "timbre", text: "选择方波，并把频率调到 880 Hz（比 A4 高一个八度）", check: (s) => s.timbre === 1 && s.f === 880 },
  ],
  sound,
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
