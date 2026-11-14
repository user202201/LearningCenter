import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-meter";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.meter;
type S = Record<string, number>;
const kwh1 = (s: S) => Mo.energyKwh(s.P, s.th);
const rate = (s: S) => Mo.RATES[s.rate];
export const def: SimDef = {
  meta,
  lesson: [
    "电流做功的过程，就是电能转化为其他形式能的过程。电流做的功叫电功，用 W 表示。电流在某段电路上做的功，等于这段电路两端的电压 U、电路中的电流 I 和通电时间 t 的乘积：W = UIt。电功的单位是焦耳（J），生活中常用千瓦时（kW·h，俗称“度”）：1 kW·h = 3.6×10⁶ J。",
    "电能表是测量一段时间内消耗电能的仪表。它的计数器最后一位是小数位，前后两次示数之差就是这段时间用的电能。铭牌上的“220 V”是额定电压，“10(20) A”表示标定电流是 10 A、额定最大电流是 20 A，“3000 r/(kW·h)”表示每消耗 1 kW·h 的电能，转盘转 3000 转。",
    "用电能表测用电器的功率：只让这一个用电器工作，数出 t 秒内转盘转过的转数 n，则消耗的电能 W = n / N（kW·h，N 是每千瓦时的转数），功率 P = W / t。",
  ],
  formulas: ["W=UIt", "1\\,\\mathrm{kW{\\cdot}h}=3.6\\times10^{6}\\,\\mathrm{J}", "P=\\dfrac{W}{t}"],
  params: [
    { id: "U", label: "电压", min: 1, max: 250, step: 1, value: 220, unit: "V", when: (s) => s.mode === 0 },
    { id: "I", label: "电流", min: 0.1, max: 10, step: 0.1, value: 1, unit: "A", when: (s) => s.mode === 0 },
    { id: "t", label: "通电时间", min: 1, max: 7200, step: 1, value: 60, unit: "s", when: (s) => s.mode === 0 },
    { id: "P", label: "用电器的功率", min: 100, max: 3000, step: 100, value: 500, unit: "W", when: (s) => s.mode === 1 },
    { id: "th", label: "工作的时间", min: 0, max: 10, step: 0.5, value: 1, unit: "h", when: (s) => s.mode === 1 },
    { id: "r0", label: "电能表原来的示数", min: 0, max: 9999, step: 1, value: 1234, unit: "kW·h", when: (s) => s.mode === 1 },
    { id: "price", label: "电价（示例）", min: 0.4, max: 1, step: 0.05, value: 0.6, unit: "元/(kW·h)", when: (s) => s.mode === 1 },
    { id: "n", label: "转盘转过的转数", min: 1, max: 200, step: 1, value: 10, when: (s) => s.mode === 2 },
    { id: "tt", label: "所用的时间", min: 10, max: 600, step: 10, value: 60, unit: "s", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "电功 W = UIt"], [1, "读电能表"], [2, "用电能表测功率"]] },
    { id: "rate", label: "电能表的参数", value: 3, options: Mo.RATES.map((r, i) => [i, `${r} r/(kW·h)`] as [number, string]), when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const W = Mo.work(s.U, s.I, s.t); return [{ label: "用电器的功率", value: fmt(s.U * s.I, 0), unit: "W" }, { label: "电流做的功", value: fmt(W, 0), unit: "J" }, { label: "合", value: fmt(Mo.toKwh(W), 4), unit: "kW·h" }]; }
    if (s.mode === 1) { const k = kwh1(s); return [{ label: "这段时间用的电能", value: fmt(k, 2), unit: "kW·h" }, { label: "电能表现在的示数", value: Mo.dialText(Mo.dial(s.r0, k)), unit: "kW·h" }, { label: "电费", value: `${fmt(Mo.cost(k, s.price), 2)} 元` }];
    }
    const W = s.n / rate(s); return [{ label: "消耗的电能", value: fmt(W, 4), unit: "kW·h" }, { label: "用电器的功率", value: fmt(Mo.powerFromRevs(s.n, s.tt, rate(s)), 0), unit: "W" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) { circle(c, 320, 190, 62, "#ffe066", COL.ink, 5); txt(c, "W = UIt", 320, 190, 30, COL.ink); txt(c, `${s.U} V`, 130, 190, 28, COL.red); txt(c, `${fmt(s.I, 1)} A`, 320, 80, 28, COL.blue); txt(c, `${s.t} s`, 510, 190, 28, COL.green); }
    else if (s.mode === 1) {
      rect(c, 100, 60, 440, 270, "#fff", COL.ink, 5, 20); txt(c, "kW h", 320, 96, 26, COL.ink);
      const d = Mo.dialText(Mo.dial(s.r0, kwh1(s))).replace(".", ""), x0 = 150;
      for (let i = 0; i < 6; i++) { rect(c, x0 + i * 58, 130, 50, 76, i === 5 ? COL.red : "#212529", COL.ink, 3, 6); txt(c, d[i], x0 + i * 58 + 25, 168, 46, "#fff"); }
      txt(c, "220V 10(20)A 50Hz", 320, 250, 24, COL.ink); txt(c, "3000 r/(kW h)", 320, 290, 24, COL.ink);
    } else {
      rect(c, 100, 60, 440, 270, "#fff", COL.ink, 5, 20); circle(c, 320, 200, 90, "#dee2e6", COL.ink, 5);
      const turn = ((s.n / rate(s)) * Math.PI * 2 * 20) % (Math.PI * 2); line(c, 320, 200, 320 + 80 * Math.sin(turn), 200 - 80 * Math.cos(turn), COL.red, 6); circle(c, 320, 200, 8, COL.ink, null);
      txt(c, `${s.n} r`, 480, 110, 28, COL.ink); txt(c, `${s.tt} s`, 480, 290, 28, COL.ink); arrow(c, 440, 200, 400, 200, COL.grey, 3);
    }
  },
  tasks: [
    { id: "kwh", text: "电功：使电流做的功不少于 1 kW·h", check: (s) => s.mode === 0 && Mo.toKwh(Mo.work(s.U, s.I, s.t)) >= 1 },
    { id: "three", text: "读电能表：使这段时间用的电能恰好是 3 kW·h", check: (s) => s.mode === 1 && Math.abs(kwh1(s) - 3) < 1e-9 },
    { id: "power", text: "测功率：使测得的用电器功率恰好是 1000 W", check: (s) => s.mode === 2 && Math.abs(Mo.powerFromRevs(s.n, s.tt, rate(s)) - 1000) < 1 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
