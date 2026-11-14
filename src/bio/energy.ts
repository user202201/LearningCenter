import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-energy";
import { COL, lab, rect, circle, line, ell, poly } from "./draw";
export const meta = CATALOG.energy;
export const def: SimDef = {
  meta,
  lesson: [
    "食物中储存着能量，可以用燃烧的方法测定：把一定质量的食物点燃，放出的热量加热一定质量的水，根据水温的升高计算水吸收的热量 Q = c × m × ΔT（水的比热容 c = 4.2 J/(g·℃)，1 mL 水约重 1 g）。每克食物的能量 = Q ÷ 食物的质量。",
    "实验中燃烧放出的热量并没有全部被水吸收，所以测得的数值总是比食物实际含有的能量小。给火焰加上挡风罩（金属罩）能减少热量散失，使结果更接近真实值。水温升高到 100 ℃ 就会沸腾，数据无效。食物的能量值是取整的教学数据。",
  ],
  links: [{ text: "相关：合理营养", href: "#/science/bio/diet" }],
  params: [
    { id: "m", label: "食物的质量", min: 0.5, max: 3, step: 0.5, value: 0.5, unit: "g" },
    { id: "vw", label: "水的体积", min: 20, max: 100, step: 10, value: 50, unit: "mL" },
  ],
  choices: [
    { id: "food", label: "食物", value: 0, options: Mo.FOODS.map((f, i) => [i, f[0]] as [number, string]) },
    { id: "shield", label: "挡风罩", value: 0, options: [[0, "没有"], [1, "有"]] },
  ],
  readouts: (s) => {
    const bo = Mo.boils(s.food, s.m, s.vw, s.shield), dT = Mo.rise(s.food, s.m, s.vw, s.shield), e = Mo.FOODS[s.food][1], me = Mo.measured(s.food, s.m, s.vw, s.shield);
    return [{ label: "水温升高", value: fmt(dT, 1), unit: "℃" }, { label: "水吸收的热量", value: fmt(Mo.heat(s.vw, dT), 0), unit: "J" },
      { label: "测得的能量", value: bo ? "—" : fmt(me, 1), unit: bo ? "" : "kJ/g" }, { label: "标准值", value: String(e), unit: "kJ/g" },
      { label: "测得值占标准值", value: bo ? "—" : fmt((me / e) * 100, 0), unit: bo ? "" : "%" }, { label: "状态", value: bo ? "水已沸腾，数据无效" : "正常" }];
  },
  draw(c, w, h, s) {
    const dT = Mo.rise(s.food, s.m, s.vw, s.shield), bo = Mo.boils(s.food, s.m, s.vw, s.shield), T = Mo.T0 + dT;
    rect(c, 40, 396, 300, 14, "#adb5bd", COL.ink, 3, 4);
    line(c, 190, 396, 190, 330, COL.ink, 4); line(c, 140, 330, 240, 330, COL.ink, 4);
    ell(c, 190, 322, 18 + 4 * s.m, 12 + 3 * s.m, Mo.FOODS[s.food][0] === "大米" ? "#fff3bf" : "#d9a066", COL.ink, 3);
    c.beginPath(); c.moveTo(190, 312); c.bezierCurveTo(168, 290, 190, 270, 190, 248); c.bezierCurveTo(192, 270, 214, 290, 190, 312); c.fillStyle = "#ff922b"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 2.5; c.stroke();
    const hw = 40 + 0.6 * s.vw, hh = 40 + 0.5 * s.vw;
    poly(c, [[190 - hw, 232 - hh], [190 + hw, 232 - hh], [190 + hw - 6, 232], [190 - hw + 6, 232]], "#e7f5ff", COL.ink, 4);
    poly(c, [[190 - hw + 3, 232 - hh * 0.8], [190 + hw - 3, 232 - hh * 0.8], [190 + hw - 7, 229], [190 - hw + 7, 229]], bo ? "#ffa8a8" : "#a5d8ff", null);
    lab(c, "水", 190, 232 - hh * 0.4, 18, COL.ink);
    if (s.shield) { c.setLineDash([8, 6]); rect(c, 190 - hw - 24, 232 - hh - 14, 2 * hw + 48, hh + 150, "rgba(173,181,189,0.15)", COL.grey, 3, 10); c.setLineDash([]); lab(c, "挡风罩", 190 - hw - 24 + 34, 232 - hh - 28, 15, COL.grey); }
    rect(c, 400, 60, 22, 260, "#fff", COL.ink, 3, 11); circle(c, 411, 332, 18, COL.red, COL.ink, 3);
    const f = Math.min(1, (T - 0) / 100); rect(c, 405, 320 - 258 * f, 12, 258 * f, COL.red, null, 0, 6);
    for (const v of [0, 20, 40, 60, 80, 100]) { line(c, 424, 320 - 258 * v / 100, 434, 320 - 258 * v / 100, COL.ink, 2); lab(c, String(v), 458, 320 - 258 * v / 100, 14, COL.grey); }
    lab(c, `${fmt(T, 1)} ℃`, 540, 190, 34, bo ? COL.red : COL.ink); lab(c, "thermometer", 540, 230, 14, COL.grey);
  },
  tasks: [
    { id: "shield", text: "加上挡风罩，使测得值达到标准值的 70 % 以上", check: (s) => s.shield === 1 && !Mo.boils(s.food, s.m, s.vw, 1) && Mo.measured(s.food, s.m, s.vw, 1) >= 0.7 * Mo.FOODS[s.food][1] },
    { id: "rice", text: "加上挡风罩，测定大米的能量", check: (s) => s.food === 3 && s.shield === 1 && !Mo.boils(3, s.m, s.vw, 1) },
    { id: "heat", text: "使水温升高 50 ℃ 以上，但水不沸腾", check: (s) => !Mo.boils(s.food, s.m, s.vw, s.shield) && Mo.rise(s.food, s.m, s.vw, s.shield) >= 50 },
  ],
  aspect: 0.75,
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
