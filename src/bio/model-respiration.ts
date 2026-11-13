/** 呼吸作用 (pure): a plant's gas exchange over 24 hours (photosynthesis minus respiration) and the limewater test of germinating seeds. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const PS_MAX = 30;
export const light = (t: number) => (t <= 6 || t >= 18 ? 0 : Math.sin((Math.PI * (t - 6)) / 12));
export const ps = (t: number, cover: number) => (cover ? 0 : PS_MAX * light(t));
export const resp = (T: number) => 10 * 2 ** ((T - 20) / 10);
export const net = (t: number, T: number, cover: number) => ps(t, cover) - resp(T);
/** the two times of day at which photosynthesis equals respiration (null when respiration is the larger even at noon) */
export function compensation(T: number): [number, number] | null {
  const r = resp(T);
  if (r >= PS_MAX) return null;
  const d = (12 / Math.PI) * Math.asin(r / PS_MAX);
  return [6 + d, 18 - d];
}
/** the net oxygen released over 24 hours (arbitrary units): the integral of net, exactly */
export const daily = (T: number, cover: number) => (cover ? 0 : (PS_MAX * 24) / Math.PI) - 24 * resp(T);
/** the carbon dioxide (mL) given off by `mass` g of seeds in `minutes` minutes, and how cloudy the limewater is (0..1) */
export const co2 = (mass: number, minutes: number, T: number, live: number) => (live ? mass * 0.06 * (resp(T) / 10) * minutes : 0);
export const turbidity = (v: number) => 1 - Math.exp(-v / 100);
export function quiz(rng: () => number): Q[] {
  const T1 = pick(rng, [10, 20, 30, 40]), T2 = pick(rng, [10, 20, 30]), t2 = pick(rng, [8, 9, 12, 15, 16]);
  const T3 = pick(rng, [15, 20, 25]);
  return [
    numQ(rng, "resp", [T1], `某植物在 20 °C 时的呼吸速率为 10 个单位，温度每升高 10 °C，速率约增大为原来的 2 倍。${T1} °C 时的呼吸速率是多少？`, resp(T1), "个单位", 1, "呼吸作用受酶活性影响，温度升高，速率增大。"),
    numQ(rng, "net", [T2, t2], `某植物在 ${t2} 时的光合速率为 30 × sin(π(t−6)/12)，呼吸速率在 ${T2} °C 时为 10 × 2^((T−20)/10)。${t2} 时，净氧气释放速率是多少？`, net(t2, T2, 0), "个单位", 1, "净释放 = 光合 − 呼吸。"),
    numQ(rng, "comp", [T3], `${T3} °C 时，上午光合速率第一次等于呼吸速率的时刻是几点？（光合速率 = 30 × sin(π(t−6)/12)，日出 6 时）`, compensation(T3)![0], "时", 1, "此时光合速率 = 呼吸速率（补偿点）。"),
    makeQ(rng, "night", [], "夜间，绿色植物（无光照）的气体交换是：", "吸收氧气，释放二氧化碳", ["吸收二氧化碳，释放氧气", "不进行气体交换", "只释放氧气", "只吸收二氧化碳"], "夜间只进行呼吸作用。"),
    makeQ(rng, "lime", [], "把萌发的种子放在密闭的瓶中，一段时间后澄清石灰水变浑浊，说明种子呼吸时产生了：", "二氧化碳", ["氧气", "氮气", "水蒸气", "淀粉"], "二氧化碳使澄清石灰水变浑浊。"),
  ];
}
