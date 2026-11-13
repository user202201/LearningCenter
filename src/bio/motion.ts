import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-motion";
import { COL, lab, txt, circle, ell, line, rect } from "./draw";
export const meta = CATALOG.motion;
type S = Record<string, number>;
const th = (s: S) => Mo.angle(s.b, s.t);
const F = (s: S) => Mo.force(s.m, s.d2, s.d1, th(s));
export const def: SimDef = {
  meta,
  lesson: [
    "动物的运动系统由骨、骨连结（主要是关节）和骨骼肌组成。运动时，骨骼肌受到神经传来的刺激而收缩，牵动骨绕关节转动：骨起杠杆作用，关节起支点作用，骨骼肌起动力作用。",
    "一个动作需要多组肌肉相互配合：屈肘时肱二头肌收缩、肱三头肌舒张；伸肘时相反。前臂是费力杠杆（动力臂小于阻力臂），费力但可以省距离、动作灵活。",
  ],
  formulas: ["F\\, l_1 = G\\, l_2"],
  links: [{ text: "相关：物理实验室·杠杆", href: "#/science/physics/lever" }, { text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "b", label: "肱二头肌收缩程度", min: 0, max: 100, step: 5, value: 0, unit: "%" },
    { id: "t", label: "肱三头肌收缩程度", min: 0, max: 100, step: 5, value: 0, unit: "%" },
    { id: "m", label: "手中重物的质量", min: 0, max: 10, step: 0.5, value: 2, unit: "kg" },
    { id: "d1", label: "肌肉附着点到肘的距离", min: 0.03, max: 0.08, step: 0.01, value: 0.04, unit: "m", dec: 2 },
    { id: "d2", label: "手到肘的距离", min: 0.2, max: 0.35, step: 0.05, value: 0.3, unit: "m", dec: 2 },
  ],
  aspect: 0.62,
  readouts: (s) => [
    { label: "肘关节的角度", value: fmt(th(s), 0), unit: "°" }, { label: "肱二头肌的拉力", value: fmt(F(s), 0), unit: "N" },
    { label: "前臂的杠杆类型", value: Mo.kind(s.d1, s.d2) }, { label: "肱二头肌的长度变化", value: fmt(-(s.b - s.t) * 0.05, 1), unit: "cm" }],
  draw(c, w, h, s) {
    const sx = 230, sy = 50, ex = 230, ey = 200, phi = ((180 - th(s)) * Math.PI) / 180, L = 170;
    const hx = ex + L * Math.sin(phi), hy = ey + L * Math.cos(phi);
    rect(c, sx - 14, sy, 28, 150, "#e9ecef", COL.ink, 4, 12); line(c, ex, ey, hx, hy, "#e9ecef", 24); line(c, ex, ey, hx, hy, COL.ink, 4);
    const ax = ex + Mo.angle(0, 0) * 0 + s.d1 / 0.3 * L * Math.sin(phi), ay = ey + s.d1 / 0.3 * L * Math.cos(phi);
    // biceps in front (right), triceps behind (left)
    const thick = 10 + s.b * 0.22, thick2 = 10 + s.t * 0.22;
    line(c, sx + 22, sy + 40, ax + 16, ay, "#e03131", thick); line(c, sx - 22, sy + 40, ex - 20, ey - 10, "#f08c00", thick2);
    lab(c, "肱二头肌", sx + 60, sy + 70, 17, "#c92a2a", "left"); lab(c, "肱三头肌", sx - 56, sy + 70, 17, "#e8590c", "right");
    circle(c, ex, ey, 14, "#ffd43b", COL.ink, 4); lab(c, "肘关节", ex - 26, ey + 36, 16, COL.grey, "right");
    rect(c, hx - 24, hy + 4, 48, 40, "#74c0fc", COL.ink, 3, 6); txt(c, `${fmt(s.m, 1)} kg`, hx, hy + 24, 15, COL.ink);
    ell(c, hx, hy, 12, 12, COL.skin, COL.ink, 3);
    txt(c, `${fmt(th(s), 0)}°`, 30, 28, 22, COL.purple, "left");
    rect(c, 420, 60, 200, 28, "#f1f3f5", COL.grey, 2, 8); rect(c, 422, 62, Math.min(196, (F(s) / 1200) * 196), 24, F(s) > 600 ? COL.red : COL.orange, null, 0, 6); txt(c, `${fmt(F(s), 0)} N`, 620, 110, 18, COL.ink, "right");
    lab(c, "肱二头肌的拉力", 420, 40, 16, COL.grey, "left");
  },
  tasks: [
    { id: "flex", text: "屈肘：肱二头肌收缩 70% 以上、肱三头肌放松（20% 以下），肘角小于 60°", check: (s) => s.b >= 70 && s.t <= 20 && th(s) < 60 },
    { id: "heavy", text: "握 4 kg 以上的重物：肱二头肌的拉力超过 300 N", check: (s) => s.m >= 4 && F(s) > 300 },
    { id: "arm", text: "把肌肉附着点移到离肘 6 cm 以上：握 2 kg 重物时拉力小于 150 N", check: (s) => s.d1 >= 0.06 && s.m === 2 && F(s) < 150 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
