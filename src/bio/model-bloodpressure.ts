/** 血压与脉搏 (pure, 七下 · 物质的运输): a teaching model of blood pressure (cardiac output x resistance, pulse pressure from the stroke volume and the elasticity of the arteries), the cuff method and the pulse. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const R0 = 17, C0 = 1.75, KPA = 7.5;
/** cardiac output, L/min */
export const output = (sv: number, hr: number) => (sv * hr) / 1000;
/** mean arterial pressure, mmHg (resistance R0 at 100 %) */
export const mean = (sv: number, hr: number, r: number) => output(sv, hr) * R0 * (r / 100);
/** pulse pressure = stroke volume / compliance (the elasticity of the arterial wall, 100 % = normal) */
export const pulsePressure = (sv: number, el: number) => sv / (C0 * (el / 100));
export const diastolic = (sv: number, hr: number, r: number, el: number) => mean(sv, hr, r) - pulsePressure(sv, el) / 3;
export const systolic = (sv: number, hr: number, r: number, el: number) => diastolic(sv, hr, r, el) + pulsePressure(sv, el);
/** classification by the textbook ranges: systolic 90-140 and diastolic 60-90 mmHg are normal */
export const status = (sys: number, dia: number): number => (sys > 140 || dia > 90 ? 1 : sys < 90 || dia < 60 ? 2 : 0);
export const STATUS = ["血压正常", "血压偏高（高血压）", "血压偏低"];
export const kpa = (mmhg: number) => mmhg / KPA;
/** the three people of the cuff method: [name, systolic, diastolic] */
export const PEOPLE: [string, number, number][] = [["甲（正常）", 118, 76], ["乙（偏高）", 152, 96], ["丙（偏低）", 86, 56]];
/** Korotkoff sounds are heard while the cuff pressure is below the systolic and above the diastolic pressure */
export const sound = (cuff: number, sys: number, dia: number): 0 | 1 | 2 => (cuff > sys ? 0 : cuff > dia ? 1 : 2);
export const SOUND_TEXT = ["袖带压力高于收缩压：血管被压扁，血流被阻断，听不到声音", "袖带压力在收缩压和舒张压之间：血流时断时通，能听到脉搏声", "袖带压力低于舒张压：血流通畅，声音消失"];
/** pulse: the beats counted in `secs` seconds */
export const counted = (hr: number, secs: number) => Math.round((hr * secs) / 60);
export function quiz(rng: () => number): Q[] {
  const sv = pick(rng, [50, 60, 70, 80, 90]), hr = pick(rng, [60, 70, 80, 90, 100]);
  const sys = pick(rng, [100, 110, 120, 130, 140]), dia = pick(rng, [60, 70, 80, 90]);
  const mm = pick(rng, [90, 120, 140, 60, 80]);
  const s2 = pick(rng, [85, 110, 125, 135, 150, 165]), d2 = pick(rng, [55, 65, 75, 85, 95, 105]);
  return [
    numQ(rng, "co", [sv, hr], `每搏输出量为 ${sv} mL，心率为 ${hr} 次/分钟，心输出量约是多少升每分钟？`, output(sv, hr), "L/min", 2, "心输出量 = 每搏输出量 × 心率。"),
    numQ(rng, "pp", [sys, dia], `某人收缩压为 ${sys} mmHg，舒张压为 ${dia} mmHg，脉压差是多少？`, sys - dia, "mmHg", 0, "脉压差 = 收缩压 − 舒张压。"),
    numQ(rng, "kpa", [mm], `教科书用 kPa 表示血压。已知 1 kPa = 7.5 mmHg，${mm} mmHg 约是多少 kPa？`, kpa(mm), "kPa", 1, "kPa 数值 = mmHg 数值 ÷ 7.5。"),
    makeQ(rng, "status", [s2, d2], `某人的血压为 ${s2} / ${d2} mmHg（收缩压 / 舒张压），属于：`, STATUS[status(s2, d2)], STATUS.concat(["无法判断"]), "健康成年人的收缩压为 90–140 mmHg，舒张压为 60–90 mmHg；超过 140 / 90 mmHg 为偏高。"),
    makeQ(rng, "sound", [], "用袖带测血压时，袖带压力高于收缩压，听诊器里会：", "听不到声音，因为血流被阻断", ["听到清晰的脉搏声", "听到连续的声音", "声音突然变大"], "袖带压力降到收缩压时，血流冲开血管，开始听到脉搏声；降到舒张压时，声音消失。"),
  ];
}
