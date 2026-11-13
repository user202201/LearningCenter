/** 血液循环 (pure): the cardiac cycle, the valves, cardiac output and the ABO blood groups. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const SV = 70;   // mL pumped by one ventricle per beat
/** 0 atria contract, 1 ventricles contract, 2 everything relaxed; frac = position in the cycle (0..1) */
export const stage = (frac: number) => (frac < 0.125 ? 0 : frac < 0.5 ? 1 : 2);
export const STAGES = ["心房收缩", "心室收缩", "心房心室都舒张"];
export const valves = (st: number) => ({ av: st !== 1, artery: st === 1 });
export const output = (hr: number) => (SV * hr) / 1000;   // L per minute
export const period = (hr: number) => 60 / hr;
// ---- ABO: bit 1 = antigen A, bit 2 = antigen B (O = 0, A = 1, B = 2, AB = 3); the plasma has the antibodies of the antigens the person lacks ----
export const TYPES = ["O", "A", "B", "AB"];
export const antibodies = (t: number) => (~t) & 3;
/** the donor's red cells carry no antigen that the recipient's plasma has an antibody against */
export const compatible = (donor: number, recipient: number) => (donor & antibodies(recipient)) === 0;
export const pairs = () => { let n = 0; for (let d = 0; d < 4; d++) for (let r = 0; r < 4; r++) if (compatible(d, r)) n++; return n; };
export const antigenText = (t: number) => (t === 0 ? "无抗原" : t === 1 ? "A 抗原" : t === 2 ? "B 抗原" : "A 和 B 抗原");
export const antibodyText = (t: number) => { const a = antibodies(t); return a === 0 ? "无抗体" : a === 1 ? "抗 A 抗体" : a === 2 ? "抗 B 抗体" : "抗 A 和抗 B 抗体"; };
const VALVE_TEXT = ["房室瓣打开，动脉瓣关闭", "房室瓣关闭，动脉瓣打开", "房室瓣打开，动脉瓣关闭"];
export const valveText = (st: number) => VALVE_TEXT[st];
export function quiz(rng: () => number): Q[] {
  const d = pick(rng, [0, 1, 2, 3]), r = pick(rng, [0, 1, 2, 3]), hr = pick(rng, [60, 75, 90, 100, 120, 150]), st = pick(rng, [0, 1, 2]);
  const hr2 = pick(rng, [50, 60, 75, 80, 100, 120]);
  return [
    makeQ(rng, "abo", [d, r], `${TYPES[d]} 型血的人给 ${TYPES[r]} 型血的人输血（只考虑 ABO 血型），可以吗？`, compatible(d, r) ? "可以，红细胞不会凝集" : "不可以，红细胞会发生凝集", ["可以，红细胞不会凝集", "不可以，红细胞会发生凝集", "只有输入少量血才可以", "必须先加热"], "供血者的红细胞抗原不能遇到受血者血浆中相应的抗体。"),
    numQ(rng, "co", [hr], `每搏输出量约 70 mL，心率为每分钟 ${hr} 次，每分钟心脏输出的血量是多少升？`, (SV * hr) / 1000, "L", 1, "心输出量 = 每搏输出量 × 心率。"),
    numQ(rng, "period", [hr2], `心率为每分钟 ${hr2} 次，心脏跳动一次（一个心动周期）约需多少秒？`, 60 / hr2, "s", 2, "周期 = 60 秒 / 心率。"),
    numQ(rng, "pairs", [], "ABO 血型有 O、A、B、AB 四种。供血者和受血者的血型共有 16 种搭配，其中红细胞不会凝集的搭配有几种？", pairs(), "种", 0, "O 型血可以输给所有人，AB 型血可以接受所有人。"),
    makeQ(rng, "valve", [st], `心脏处于“${STAGES[st]}”时，房室瓣和动脉瓣的状态是：`, VALVE_TEXT[st], ["房室瓣打开，动脉瓣关闭", "房室瓣关闭，动脉瓣打开", "两种瓣膜都打开", "两种瓣膜都关闭"].filter((x) => x !== VALVE_TEXT[st]), "瓣膜使血液只能朝一个方向流动：心房 → 心室 → 动脉。"),
  ];
}
