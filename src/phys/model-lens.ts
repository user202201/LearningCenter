/** 透镜成像 (pure): the thin-lens equation 1/u + 1/v = 1/f with signs. u > 0 is an object in front of the lens. type 0 = convex (f > 0), 1 = concave (f < 0). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export interface Img { none: boolean; v: number; m: number; real: boolean; inverted: boolean; nature: string; tool: string }
const EPS = 1e-9;
/** v: the image distance, positive = real image behind the lens, negative = virtual image on the object's side; m = v / u magnification (size ratio, positive number) */
export function image(f: number, u: number, type: number): Img {
  const fs = type === 0 ? f : -f;
  if (type === 0 && Math.abs(u - f) < EPS) return { none: true, v: Infinity, m: Infinity, real: false, inverted: false, nature: "不成像（折射光线平行射出）", tool: "" };
  const v = (u * fs) / (u - fs);
  const m = Math.abs(v / u), real = v > 0;
  let nature: string, tool = "";
  if (type === 1) nature = "正立、缩小的虚像（凹透镜）";
  else if (u < f) { nature = "正立、放大的虚像（放大镜）"; tool = "放大镜"; }
  else if (Math.abs(u - 2 * f) < EPS) nature = "倒立、等大的实像";
  else if (u < 2 * f) { nature = "倒立、放大的实像（投影仪）"; tool = "投影仪"; }
  else { nature = "倒立、缩小的实像（照相机）"; tool = "照相机"; }
  return { none: false, v, m, real, inverted: real, nature, tool };
}
export const imageDistance = (f: number, u: number) => (u * f) / (u - f);
export function quiz(rng: () => number): Q[] {
  const [f1, u1] = pick(rng, [[10, 15], [10, 30], [10, 20], [12, 18], [8, 24], [6, 9], [15, 30], [20, 30], [12, 36]]);
  const f2 = pick(rng, [8, 10, 12, 15]);
  const cases: [string, (f: number) => number][] = [["u1", (f) => f * 3], ["u2", (f) => f * 1.5], ["u3", (f) => f * 0.5]];
  const [, uf] = pick(rng, cases);
  const u2 = uf(f2);
  const nat = image(f2, u2, 0).nature;
  const [f3, u3] = pick(rng, [[10, 15], [10, 30], [12, 18], [8, 24], [15, 30]]);
  const uq = pick(rng, [10, 16, 20, 24, 30]);
  const tools = ["照相机", "投影仪", "放大镜"];
  const u5 = pick(rng, [f2 * 3, f2 * 1.5, f2 * 0.5]);
  const t5 = image(f2, u5, 0).tool;
  return [
    numQ(rng, "v", [f1, u1], `凸透镜的焦距是 ${f1} cm，物体放在距透镜 ${u1} cm 处，像距是多少？`, imageDistance(f1, u1), "cm", 0, "1/u + 1/v = 1/f。"),
    makeQ(rng, "nature", [f2, u2], `凸透镜的焦距是 ${f2} cm，物距是 ${fm(u2)} cm，成什么像？`, nat, ["倒立、缩小的实像（照相机）", "倒立、放大的实像（投影仪）", "正立、放大的虚像（放大镜）", "倒立、等大的实像", "不成像（折射光线平行射出）"], "根据物距与焦距的关系判断。"),
    numQ(rng, "magnif", [f3, u3], `凸透镜的焦距是 ${f3} cm，物距 ${u3} cm，像的大小是物体的多少倍？`, Math.abs(imageDistance(f3, u3) / u3), "倍", 1, "放大倍数 = 像距 / 物距。"),
    numQ(rng, "f_from_2f", [uq], `物体放在凸透镜前 ${uq} cm 处，恰好成倒立、等大的实像，透镜的焦距是多少？`, uq / 2, "cm", 1, "u = 2f 时成等大的实像。"),
    makeQ(rng, "tool", [f2, u5], `凸透镜的焦距是 ${f2} cm，物距是 ${fm(u5)} cm，这样的成像规律应用于：`, t5, tools.filter((x) => x !== t5).concat(["潜望镜", "平面镜"]), "u > 2f 照相机；f < u < 2f 投影仪；u < f 放大镜。"),
  ];
}
const fm = (x: number) => String(Math.round(x * 10) / 10);
