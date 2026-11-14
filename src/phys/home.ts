import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-home";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.home;
const on = (s: Record<string, number>) => [s.nl, s.a1, s.a2, s.a3, s.a4];
const ld = (s: Record<string, number>) => Mo.load(on(s), Mo.FUSES[s.fuse], s.sc === 1);
const body = (s: Record<string, number>) => Mo.bodyCurrent(s.touch, s.hand, s.stand);
const APPCH = Mo.APPS.map(([n, p], i) => ({ i, n, p })).filter((a) => a.i > 0).map(({ i, n, p }) => ({ id: `a${i}`, label: `${n}（${p} W）`, value: i === 1 ? 1 : 0, options: [[0, "关"], [1, "开"]] as [number, string][], when: (s: Record<string, number>) => s.mode === 0 }));
export const def: SimDef = {
  meta,
  lesson: [
    "家庭电路的电压是 220 V。进户线有火线和零线，火线与零线之间有 220 V 的电压，零线与大地之间几乎没有电压。各用电器并联，互不影响；开关接在火线上，并与它控制的用电器串联；三孔插座左零右火上接地，地线把金属外壳与大地相连，防止漏电时触电。",
    "家庭电路中电流过大的原因有两个：短路（火线与零线直接相连，电阻极小，电流极大）和用电器的总功率过大。电流过大时，导线发热，容易引起火灾。保险丝（或空气开关）串联在火线上，电流超过它的额定电流时熔断（或跳闸），切断电路，保护电路。保险丝要用电阻较大、熔点较低的铅锑合金，不能用铜丝代替。",
    "安全用电：不接触低压带电体，不靠近高压带电体；潮湿的手和站在潮湿地面上触电更危险；人体的安全电压不高于 36 V；发生触电时，先切断电源再救人；漏电保护器在漏电电流达到约 30 mA 时迅速断电。测电笔用来辨别火线和零线，使用时手要接触笔尾的金属体，笔尖接触被测的导线，氖管发光的是火线。",
  ],
  formulas: ["P=UI", "I=\\dfrac{P}{U}"],
  params: [{ id: "nl", label: "灯的盏数（每盏 60 W）", min: 0, max: 30, step: 1, value: 3, unit: "", when: (s) => s.mode === 0 }],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "家庭电路与保险丝"], [1, "触电"], [2, "测电笔"]] },
    ...APPCH,
    { id: "fuse", label: "保险丝的额定电流", value: 1, options: Mo.FUSES.map((v, i) => [i, `${v} A`] as [number, string]), when: (s) => s.mode === 0 },
    { id: "sc", label: "电路的情况", value: 0, options: [[0, "正常"], [1, "火线与零线直接相连（短路）"]], when: (s) => s.mode === 0 },
    { id: "touch", label: "手接触的导线", value: 0, options: [[0, "火线"], [1, "零线"]], when: (s) => s.mode === 1 },
    { id: "hand", label: "手的状态", value: 0, options: [[0, "干燥"], [1, "潮湿"]], when: (s) => s.mode === 1 },
    { id: "stand", label: "脚下", value: 0, options: [[0, "站在地面上"], [1, "站在绝缘垫上"]], when: (s) => s.mode === 1 },
    { id: "rcd", label: "漏电保护器", value: 0, options: [[0, "没有"], [1, "装有"]], when: (s) => s.mode === 1 },
    { id: "hole", label: "笔尖插入的插孔", value: 0, options: [[0, "左孔"], [1, "右孔"], [2, "上孔"]], when: (s) => s.mode === 2 },
    { id: "hold", label: "手的位置", value: 0, options: [[0, "没有接触笔尾的金属体"], [1, "接触笔尾的金属体"]], when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const l = ld(s); return [{ label: "总功率", value: fmt(l.P, 0), unit: "W" }, { label: "总电流", value: fmt(l.I, 1), unit: "A" }, { label: "保险丝的额定电流", value: fmt(Mo.FUSES[s.fuse], 0), unit: "A" }, { label: "保险丝", value: l.blown ? "熔断，电路断开" : "完好，电路接通" }]; }
    if (s.mode === 1) { const I = body(s), trip = s.rcd === 1 && Mo.rcdTrips(I); return [{ label: "通过人体的电流", value: fmt(I * 1000, 1), unit: "mA" }, { label: "感觉与危险", value: Mo.DANGER[Mo.danger(I)] }, { label: "漏电保护器", value: s.rcd === 0 ? "没有安装" : trip ? "动作，切断电源" : "没有动作" }];
    }
    const lit = Mo.penLit(s.hole, s.hold);
    return [{ label: "这个插孔接", value: Mo.HOLES[s.hole] }, { label: "氖管", value: lit ? "发光" : "不发光" }, { label: "测电笔的用法", value: s.hold === 1 ? "正确" : "不正确（手必须接触笔尾的金属体）" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const l = ld(s);
      line(c, 40, 80, 600, 80, COL.red, 5); line(c, 40, 320, 600, 320, COL.blue, 5); txt(c, "L", 20, 80, 20, COL.red); txt(c, "N", 20, 320, 20, COL.blue);
      rect(c, 90, 56, 60, 48, l.blown ? "#ffc9c9" : "#fff3bf", COL.ink, 4, 6); txt(c, l.blown ? "x" : "fuse", 120, 80, 18, COL.ink);
      Mo.APPS.forEach(([, p], i) => { const x = 210 + i * 82, act = on(s)[i] > 0 && !l.blown; line(c, x, 80, x, 150, COL.ink, 3); line(c, x, 250, x, 320, COL.ink, 3); circle(c, x, 200, 34, act ? "#ffe066" : "#fff", COL.ink, 4); txt(c, i === 0 ? `${on(s)[0]}x${p}` : `${p}`, x, 200, i === 0 ? 14 : 17, COL.ink); });
      if (s.sc === 1) { line(c, 580, 80, 580, 320, COL.orange, 8); txt(c, "short", 560, 200, 17, COL.orange, "right"); }
      txt(c, `${fmt(l.I, 1)} A`, 340, 36, 26, l.blown ? COL.red : COL.green);
      return;
    }
    if (s.mode === 1) {
      const I = body(s), trip = s.rcd === 1 && Mo.rcdTrips(I);
      line(c, 40, 100, 560, 100, COL.red, 5); line(c, 40, 140, 560, 140, COL.blue, 5);
      const x = 320; circle(c, x, 190, 24, "#ffd8a8", COL.ink, 4); line(c, x, 214, x, 290, COL.ink, 6); line(c, x, 240, x - 40, 270, COL.ink, 5); line(c, x, 240, s.touch === 0 ? x + 60 : x + 60, s.touch === 0 ? 100 : 140, COL.ink, 5); line(c, x, 290, x - 24, 340, COL.ink, 5); line(c, x, 290, x + 24, 340, COL.ink, 5);
      rect(c, 200, 344, 240, 18, s.stand === 1 ? "#ffe066" : "#d9a066", COL.ink, 3, 4); if (s.hand === 1) circle(c, x + 60, s.touch === 0 ? 100 : 140, 11, COL.water2, null);
      if (I > 0 && !trip) arrow(c, x + 80, s.touch === 0 ? 112 : 152, x + 80, 330, COL.red, 5);
      txt(c, `${fmt(I * 1000, 1)} mA`, 480, 240, 28, I * 1000 >= 30 ? COL.red : COL.green);
      return;
    }
    rect(c, 190, 80, 260, 200, "#e9ecef", COL.ink, 5, 16); circle(c, 250, 200, 16, "#212529", null); circle(c, 390, 200, 16, "#212529", null); circle(c, 320, 130, 16, "#212529", null);
    txt(c, "N", 250, 238, 20, COL.blue); txt(c, "L", 390, 238, 20, COL.red); txt(c, "E", 320, 100, 20, COL.green);
    const hx = [250, 390, 320][s.hole], hy = s.hole === 2 ? 130 : 200, lit = Mo.penLit(s.hole, s.hold);
    line(c, hx, hy, hx + 90, hy + 110, COL.ink, 14); line(c, hx, hy, hx + 90, hy + 110, "#adb5bd", 8);
    if (s.hold === 1) circle(c, hx + 100, hy + 126, 14, "#ffd8a8", COL.ink, 3);
    circle(c, hx + 60, hy + 74, 11, lit ? "#ff922b" : "#fff", COL.ink, 3);
  },
  tasks: [
    { id: "blow", text: "家庭电路：使保险丝熔断（用电器的总功率过大）", check: (s) => s.mode === 0 && s.sc === 0 && ld(s).blown },
    { id: "big", text: "家庭电路：换用 20 A 的保险丝，使总电流超过 15 A 而保险丝不熔断", check: (s) => s.mode === 0 && s.sc === 0 && Mo.FUSES[s.fuse] === 20 && ld(s).I > 15 && !ld(s).blown },
    { id: "mat", text: "触电：手接触火线，站在绝缘垫上，使通过人体的电流小于 1 mA", check: (s) => s.mode === 1 && s.touch === 0 && body(s) * 1000 < 1 },
    { id: "pen", text: "测电笔：正确使用，使氖管发光", check: (s) => s.mode === 2 && Mo.penLit(s.hole, s.hold) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
