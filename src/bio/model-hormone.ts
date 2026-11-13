/** 激素调节 (pure): blood sugar after a meal. A small model: glucose appears from the meal, is taken up with the help of insulin, the pancreas releases insulin when the sugar is above normal (not in diabetes). Integrated by RK4, one-minute steps. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const GB = 5, IB = 10, KG = 0.012, KI = 0.0007, N_CLEAR = 0.08, TAU = 25, VD = 15, KA = 0.03, GAIN = 3, GAMMA = 3;
export const NORMAL: [number, number] = [3.9, 6.1], KIDNEY = 10;   // mmol/L: fasting range, the level above which sugar appears in the urine
export interface Run { G: number[]; I: number[] }
/** minutes 0..tmax: blood glucose (mmol/L) and insulin (mU/L); carbs in g; diabetes 1 = no insulin made by the body; dose = injected insulin (units) */
export function simulate(carbs: number, diabetes: number, dose: number, tmax = 240, dt = 1): Run {
  const A = (carbs * 1000) / 180 / VD, gamma = diabetes ? 0 : GAMMA;
  const Ra = (t: number) => (A * t) / (TAU * TAU) * Math.exp(-t / TAU);
  const f = (t: number, G: number, I: number, D: number) => [Ra(t) - KG * (G - GB) - KI * Math.max(I - IB, 0) * G, -N_CLEAR * (I - IB) + gamma * Math.max(G - GB, 0) + KA * D, -KA * D];
  let G = GB, I = IB, D = dose * GAIN;
  const out: Run = { G: [], I: [] };
  for (let t = 0; t <= tmax + 1e-9; t += dt) {
    out.G.push(G); out.I.push(I);
    const a = f(t, G, I, D), b = f(t + dt / 2, G + (dt / 2) * a[0], I + (dt / 2) * a[1], D + (dt / 2) * a[2]), c = f(t + dt / 2, G + (dt / 2) * b[0], I + (dt / 2) * b[1], D + (dt / 2) * b[2]), d = f(t + dt, G + dt * c[0], I + dt * c[1], D + dt * c[2]);
    G += (dt / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); I += (dt / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1]); D += (dt / 6) * (a[2] + 2 * b[2] + 2 * c[2] + d[2]);
  }
  return out;
}
export const peak = (r: Run) => { const m = Math.max(...r.G); return { v: m, t: r.G.indexOf(m) }; };
export const GLANDS: [string, string][] = [["生长激素", "垂体"], ["甲状腺激素", "甲状腺"], ["胰岛素", "胰岛"], ["肾上腺素", "肾上腺"], ["性激素", "性腺"]];
export const LACK: [string, string][] = [["幼年时生长激素分泌不足", "侏儒症"], ["幼年时生长激素分泌过多", "巨人症"], ["成年时生长激素分泌过多", "肢端肥大症"], ["幼年时甲状腺激素分泌不足", "呆小症"], ["甲状腺激素分泌过多", "甲亢"], ["胰岛素分泌不足", "糖尿病"]];
export function quiz(rng: () => number): Q[] {
  const mm = pick(rng, [3.9, 5, 5.5, 6.1, 7, 8, 10]);
  const g = pick(rng, GLANDS), l = pick(rng, LACK);
  return [
    numQ(rng, "conv", [mm], `血糖浓度 ${mm} mmol/L，按 1 mmol/L = 18 mg/dL 换算，是多少 mg/dL？`, mm * 18, "mg/dL", 0, "葡萄糖的摩尔质量为 180 g/mol。"),
    makeQ(rng, "gland", [GLANDS.indexOf(g)], `${g[0]}由哪个内分泌腺分泌？`, g[1], GLANDS.map((x) => x[1]).filter((x) => x !== g[1]).concat(["肝脏"]), "内分泌腺没有导管，激素直接进入血液。"),
    makeQ(rng, "lack", [LACK.indexOf(l)], `${l[0]}，会患：`, l[1], LACK.map((x) => x[1]).filter((x) => x !== l[1]), "激素在血液中含量很少，但作用很大。"),
    makeQ(rng, "insulin", [], "胰岛素的作用是：", "促进血糖合成糖原、加速血糖分解，使血糖浓度降低", shuffle(rng, ["使血糖浓度升高", "促进脂肪的消化", "促进骨的生长", "加快心跳"]), "胰岛素分泌不足会引起糖尿病。"),
    makeQ(rng, "urine", [], "糖尿病患者的尿液中会出现葡萄糖，主要原因是：", "血糖浓度过高，超过了肾脏重吸收的限度", ["吃的糖太多直接进入尿液", "胰岛素直接排入尿液", "肾脏制造了葡萄糖", "膀胱吸收了葡萄糖"], "正常人的血糖浓度约为 3.9–6.1 mmol/L。"),
  ];
}
