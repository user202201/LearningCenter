/** 伏安法测电阻 / 测小灯泡的电阻 (pure): battery, rheostat, the unknown resistor (or a bulb), an ammeter in series and a voltmeter across it; readings with the meters' resolution. */
import { makeQ, numQ, pick, type Q } from "./qtools";
import { solve as bulbSolve, BULBS } from "./model-bulbpower";
export const E = 3, RX = [5, 10, 15, 20], BULB = 0, CELLS = 2;
export const MAXROWS = 5;
export interface Lab { I: number; U: number; Iread: number; Uread: number; R: number }
/** target 0 = a fixed resistor RX[idx], 1 = the 2.5 V bulb (its resistance grows with its temperature) */
export function lab(target: number, idx: number, Rp: number): Lab {
  let I: number, U: number;
  if (target === 0) { I = E / (Rp + RX[idx]); U = I * RX[idx]; } else { const b = bulbSolve(BULB, CELLS, Rp); I = b.I; U = b.U; }
  const Iread = Math.round(Math.round(I / 0.02) * 0.02 * 100) / 100, Uread = Math.round(Math.round(U / 0.1) * 0.1 * 10) / 10;
  return { I, U, Iread, Uread, R: Iread > 0 ? Uread / Iread : 0 };
}
export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
export const bulbNominal = BULBS[BULB].Un;
export function quiz(rng: () => number): Q[] {
  const [U, I] = pick(rng, [[2.4, 0.2], [3, 0.3], [1.5, 0.1], [2, 0.4], [4.8, 0.4]]);
  const [Eb, Rx, I3] = pick(rng, [[6, 10, 0.4], [9, 15, 0.3], [4.5, 10, 0.25], [6, 20, 0.2], [3, 10, 0.2]]);
  const [a, b, c] = pick(rng, [[9.8, 10.2, 10], [4.9, 5.1, 5.3], [20.4, 19.6, 20], [14.7, 15.3, 15]]);
  return [
    numQ(rng, "R", [U, I], `伏安法测电阻：电压表的示数是 ${U} V，电流表的示数是 ${I} A，被测电阻的阻值是多少欧？`, U / I, "Ω", 1, "R = U / I。"),
    numQ(rng, "Rp", [Eb, Rx, I3], `电源电压是 ${Eb} V，被测电阻是 ${Rx} Ω，要使电路中的电流是 ${I3} A，滑动变阻器接入电路的电阻应是多少欧？（忽略电源内阻）`, Eb / I3 - Rx, "Ω", 1, "总电阻 = U / I，减去被测电阻就是滑动变阻器的电阻。"),
    numQ(rng, "avg", [a, b, c], `三次测得定值电阻的阻值分别是 ${a} Ω、${b} Ω、${c} Ω，它的阻值应记为多少欧？`, (a + b + c) / 3, "Ω", 1, "测定值电阻时多次测量取平均值，可以减小误差。"),
    makeQ(rng, "bulbR", [], "用伏安法测小灯泡在不同电压下的电阻，发现电阻不相等，原因是：", "灯丝的电阻随温度升高而增大", ["测量时读数有误差", "电流表本身有电阻", "灯丝的长度发生了变化"], "电压越大，灯丝温度越高，电阻越大，所以不能把不同电压下的灯丝电阻求平均值。"),
    makeQ(rng, "meters", [], "伏安法测电阻时，电流表和电压表的连接方法是：", "电流表与待测电阻串联，电压表与待测电阻并联", ["电流表与待测电阻并联，电压表与待测电阻串联", "两个表都与待测电阻串联", "两个表都与待测电阻并联"], "电流表要测通过电阻的电流，所以串联；电压表要测电阻两端的电压，所以并联。"),
  ];
}
