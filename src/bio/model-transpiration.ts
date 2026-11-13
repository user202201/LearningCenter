/** 蒸腾作用 (pure): water lost through the stomata as a function of opening, air dryness (vapour pressure deficit) and wind. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const esat = (T: number) => 0.611 * Math.exp((17.27 * T) / (T + 237.3));        // kPa
export const vpd = (T: number, RH: number) => esat(T) * (1 - RH / 100);
/** stomatal opening 0..1: opens with light, closes when the soil is dry */
export const opening = (light: number, wet: number) => Math.min(1, light / 50) * (wet ? 1 : 0.2);
export const loss = (area: number, o: number, v: number, wind: number) => 0.5 * (area / 100) * o * v * (1 + 0.12 * wind);   // g per hour
export const STOMATA = { lower: 250, upper: 60 };   // per mm2 (a typical leaf)
export function quiz(rng: () => number): Q[] {
  const T = pick(rng, [15, 20, 25, 30, 35]), RH = pick(rng, [20, 40, 60, 80]);
  const area = pick(rng, [50, 100, 150, 200]), o = pick(rng, [0.2, 0.5, 0.8, 1]), v = pick(rng, [0.5, 1, 1.5, 2, 3]), wind = pick(rng, [0, 2, 5, 10]);
  const k = pick(rng, [2, 3, 4]);
  return [
    numQ(rng, "vpd", [T, RH], `空气温度 ${T} °C 时饱和水汽压为 0.611 × exp(17.27T/(T+237.3)) kPa。相对湿度 ${RH}% 时，空气的饱和差（饱和水汽压 × (1 − 相对湿度)）是多少？`, vpd(T, RH), "kPa", 2, "空气越干燥，饱和差越大，蒸腾越强。"),
    numQ(rng, "loss", [area, o, v, wind], `叶面积 ${area} cm²、气孔开度 ${o * 100}%、饱和差 ${v} kPa、风速 ${wind} m/s。按模型 失水量 = 0.5 × (叶面积/100) × 开度 × 饱和差 × (1 + 0.12 × 风速)，每小时失水多少克？`, loss(area, o, v, wind), "g", 2, "其他条件不变，失水量与叶面积成正比。"),
    numQ(rng, "scale", [k], `其他条件不变，叶面积增大到原来的 ${k} 倍，蒸腾失水量是原来的几倍？`, k, "倍", 0, "失水量与叶面积成正比。"),
    makeQ(rng, "guard", [], "气孔张开时，保卫细胞的状态是：", "吸水膨胀", ["失水收缩", "细胞死亡", "细胞分裂", "细胞壁消失"], "保卫细胞吸水膨胀，气孔张开；失水收缩，气孔关闭。"),
    makeQ(rng, "organ", [], "植物体内的水分主要以水蒸气的形式通过哪个结构散失到空气中？", "气孔", ["导管", "筛管", "根毛", "叶绿体"], "气孔是植物蒸腾失水的“门户”，也是气体交换的“窗口”。"),
  ];
}
