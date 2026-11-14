/** 改变内能的两种方式 (pure): work done on / by an object (all of it goes into internal energy), heat flowing from the hotter to the colder body (calorimetry). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const SUBS: [string, number][] = [["水", 4200], ["铝", 880], ["铜", 390], ["空气", 1000]];       // J/(kg·℃)
export const T0 = 20;
export const ACTIONS = ["搓手（克服摩擦做功）", "压缩气体（对气体做功）", "气体膨胀（气体对外做功）"];
export const dU = (action: number, W: number) => (action === 2 ? -W : W);
/** the temperature change when the whole change of internal energy goes into one body of mass m (g) */
export const dT = (action: number, W: number, mg: number, c: number) => dU(action, W) / ((c * mg) / 1000);
export interface Flow { Tf: number; Q: number; dir: "AB" | "BA" | "none" }
/** two bodies in contact reach a common temperature Tf; Q = heat that leaves A (negative = heat leaves B) */
export function exchange(cA: number, mA: number, TA: number, cB: number, mB: number, TB: number): Flow {
  const a = (cA * mA) / 1000, b = (cB * mB) / 1000, Tf = (a * TA + b * TB) / (a + b);
  return { Tf, Q: a * (TA - Tf), dir: TA > TB ? "AB" : TA < TB ? "BA" : "none" };
}
/** internal energy above that at 0 ℃ (a reference only: the textbook never gives the absolute value) */
export const relEnergy = (c: number, mg: number, T: number) => (c * mg * T) / 1000;
export function quiz(rng: () => number): Q[] {
  const [nm, c, mg, W] = pick(rng, [["水", 4200, 100, 2100], ["水", 4200, 200, 8400], ["铜", 390, 100, 780], ["铝", 880, 500, 4400]] as [string, number, number, number][]);
  const [t1, t2] = pick(rng, [[20, 80], [30, 90], [10, 50], [40, 100], [25, 75]]);
  const m = pick(rng, [0.5, 1, 2]), [h1, h2] = pick(rng, [[80, 30], [90, 40], [70, 20], [100, 50]]);
  const way = pick(rng, [
    ["下列现象中，通过做功的方式改变物体内能的是：", pick(rng, ["搓手取暖", "用打气筒打气时筒壁发热", "钻木取火"]), ["把手放在热水袋上取暖", "用炉火烧水", "太阳晒热地面"], "做功是其他形式的能与内能之间的转化。"],
    ["下列现象中，通过热传递的方式改变物体内能的是：", pick(rng, ["把手放在热水袋上取暖", "用炉火烧水", "太阳晒热地面"]), ["搓手取暖", "用打气筒打气时筒壁发热", "钻木取火"], "热传递是内能从高温物体转移到低温物体（或物体的高温部分转移到低温部分）。"],
  ] as [string, string, string[], string][]);
  const dir = pick(rng, [
    ["一大桶 20 ℃ 的水和一小杯 80 ℃ 的水接触，热量的传递方向是：", "从小杯 80 ℃ 的水传向大桶 20 ℃ 的水", ["从大桶水传向小杯水，因为大桶水的内能多", "没有热传递，因为大桶水的内能比小杯水多", "两者互相传递相同的热量"]],
    ["两个物体接触时，热量总是从：", "温度高的物体传向温度低的物体", ["内能多的物体传向内能少的物体", "质量大的物体传向质量小的物体", "比热容大的物体传向比热容小的物体"]],
  ] as [string, string, string[]][]);
  return [
    numQ(rng, "dT", [c, mg, W], `对 ${mg} g 的${nm}做了 ${W} J 的功，功全部变成它的内能（${nm}的比热容取 ${c} J/(kg·℃)），它的温度升高多少摄氏度？`, W / ((c * mg) / 1000), "℃", 1, "Δt = W / (cm)。"),
    numQ(rng, "final", [t1, t2], `质量相等的两杯水，温度分别是 ${t1} ℃ 和 ${t2} ℃，混合后（不计热量损失）的温度是多少？`, (t1 + t2) / 2, "℃", 1, "质量相等的同种物质混合，放出的热量等于吸收的热量，末温是两个温度的平均值。"),
    numQ(rng, "Qflow", [m, h1, h2], `${m} kg 的水从 ${h1} ℃ 降低到 ${h2} ℃，放出多少焦的热量？（水的比热容取 4.2×10³ J/(kg·℃)）`, 4200 * m * (h1 - h2), "J", 0, "Q = cm(t₀ − t)。"),
    makeQ(rng, "way", [], way[0], way[1], way[2], way[3]),
    makeQ(rng, "direction", [], dir[0], dir[1], dir[2], "热量总是从高温物体传向低温物体，是否传递热量与物体的温度有关，与内能的多少、质量大小无关。"),
  ];
}
