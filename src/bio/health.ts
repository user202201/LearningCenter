import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-health";
import { COL, lab, txt, rect, circle } from "./draw";
export const meta = CATALOG.health;
export const def: SimDef = {
  meta,
  lesson: [
    "健康的生活方式：合理营养、适度运动、规律作息、不吸烟、不酗酒、拒绝毒品、保持心理健康、积极参加集体活动。运动时心率随强度增加；常用估算（成人）最大心率 = 220 − 年龄，对儿童只是粗略的参考；中等强度运动的心率约为最大心率的 50 %–70 %，较高强度约为 70 %–85 %，过高不宜持续。",
    "睡眠对生长发育很重要：教育部要求保证每天的睡眠时间：小学生 10 小时、初中生 9 小时、高中生 8 小时（本模型据此给出参考范围，具体请以医生和学校的建议为准）。",
  ],
  links: [{ text: "相关：知识总结（安全 · 健康）", href: "#/science/notes" }],
  params: [
    { id: "age", label: "年龄", min: 6, max: 18, step: 1, value: 12, unit: "岁" },
    { id: "hr", label: "运动时的心率", min: 60, max: 200, step: 5, value: 90, unit: "次/分钟", when: (s) => s.mode === 0 },
    { id: "sleep", label: "每天的睡眠时间", min: 4, max: 13, step: 0.5, value: 7, unit: "小时", dec: 1, when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "运动强度"], [1, "睡眠"]] }],
  aspect: 0.5,
  readouts: (s) => s.mode === 0 ? [
    { label: "最大心率（成人常用估算）", value: String(Mo.maxHr(s.age)), unit: "次/分钟" }, { label: "占最大心率", value: fmt(Mo.intensity(s.hr, s.age) * 100, 0), unit: "%" }, { label: "强度", value: Mo.zone(s.hr, s.age) },
    { label: "中等强度的心率范围（粗略）", value: `${Mo.moderate(s.age)[0]} – ${Mo.moderate(s.age)[1]}`, unit: "次/分钟" }, { label: "较高强度的心率范围（粗略）", value: `${Mo.target(s.age)[0]} – ${Mo.target(s.age)[1]}`, unit: "次/分钟" }] : [
    { label: "推荐的睡眠", value: `${Mo.sleepRange(s.age)[0]} – ${Mo.sleepRange(s.age)[1]}`, unit: "小时" }, { label: "评价", value: Mo.sleepOk(s.age, s.sleep) ? "睡眠充足" : s.sleep < Mo.sleepRange(s.age)[0] ? "睡眠不足" : "睡眠偏多" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const mx = Mo.maxHr(s.age), x = (v: number) => 40 + ((v - 60) / (mx + 10 - 60)) * 560, t = Mo.target(s.age);
      rect(c, 40, 120, 560, 50, "#f1f3f5", COL.grey, 2, 12); rect(c, x(0.5 * mx), 120, x(0.7 * mx) - x(0.5 * mx), 50, "#d3f9d8", null, 0, 0); rect(c, x(t[0]), 120, x(t[1]) - x(t[0]), 50, "#8ce99a", null, 0, 0); rect(c, x(0.85 * mx), 120, x(mx) - x(0.85 * mx), 50, "#ffc9c9", null, 0, 0);
      circle(c, x(s.hr), 145, 14, COL.red, COL.ink, 3); txt(c, `${s.hr}`, x(s.hr), 200, 20, COL.red); lab(c, Mo.zone(s.hr, s.age), 320, 270, 24, COL.purple);
    } else {
      const r = Mo.sleepRange(s.age), x = (v: number) => 40 + ((v - 4) / 9) * 560;
      rect(c, 40, 120, 560, 50, "#f1f3f5", COL.grey, 2, 12); rect(c, x(r[0]), 120, x(r[1]) - x(r[0]), 50, "#8ce99a", null, 0, 0); circle(c, x(s.sleep), 145, 14, Mo.sleepOk(s.age, s.sleep) ? COL.green : COL.orange, COL.ink, 3);
      txt(c, `${fmt(s.sleep, 1)} h`, x(s.sleep), 200, 20, COL.ink); lab(c, Mo.sleepOk(s.age, s.sleep) ? "睡眠充足" : "睡眠不足", 320, 270, 24, COL.purple);
    }
  },
  tasks: [
    { id: "aerobic", text: "14 岁：把心率调到较高强度运动的范围内（约 144–175 次/分钟，粗略估算）", check: (s) => s.mode === 0 && s.age === 14 && s.hr >= Mo.target(14)[0] && s.hr <= Mo.target(14)[1] },
    { id: "hard", text: "把心率调到最大心率的 85 % 以上：强度过高，不宜持续", check: (s) => s.mode === 0 && Mo.intensity(s.hr, s.age) >= 0.85 },
    { id: "sleep", text: "年龄 12 岁：把睡眠时间调到推荐范围（10–12 小时）", check: (s) => s.mode === 1 && s.age === 12 && Mo.sleepOk(12, s.sleep) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
