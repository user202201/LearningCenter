import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-diffuse";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.diffuse;
type S = Record<string, number>;
const br = (s: S) => Mo.brightness(s.r, s.theta, s.alpha);
const Y0 = 290;
export const def: SimDef = {
  meta,
  lesson: [
    "平行光射到光滑的表面（如平面镜、平静的水面）上，反射光仍然是平行的，只射向一个方向，这叫镜面反射。只有在反射光的方向上，才能看到明亮的光，在其他方向上看不到。",
    "平行光射到粗糙的表面（如纸、墙壁、衣服）上，表面上许多小平面的方向各不相同，反射光射向各个方向，这叫漫反射。漫反射使我们从各个方向都能看到不发光的物体。",
    "无论镜面反射还是漫反射，每一条光线都遵守光的反射定律：反射角等于入射角。镜面反射也会造成“光污染”，例如玻璃幕墙耀眼的反光。拖动滑块改变表面的粗糙程度，观察反射光的方向有什么变化。",
  ],
  params: [
    { id: "r", label: "表面的粗糙程度（0 为镜面）", min: 0, max: 1, step: 0.05, value: 0.5 },
    { id: "theta", label: "入射角", min: 0, max: 70, step: 1, value: 30, unit: "°" },
    { id: "alpha", label: "眼睛的位置（与法线的夹角）", min: -70, max: 70, step: 1, value: -20, unit: "°" },
  ],
  aspect: 0.62,
  readouts: (s) => [
    { label: "反射的类型", value: Mo.isMirror(s.r) ? "镜面反射" : "漫反射" },
    { label: "反射光的范围", value: `${fmt(s.theta - Mo.spread(s.r), 0)}° ~ ${fmt(s.theta + Mo.spread(s.r), 0)}°` },
    { label: "眼睛看到的亮度", value: fmt(br(s) * 100, 0), unit: "%" },
    { label: "每条光线", value: "反射角等于入射角" },
  ],
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    const cx = 320, th = (s.theta * Math.PI) / 180;
    rect(c, 80, Y0, 480, 44, Mo.isMirror(s.r) ? "#a5d8ff" : "#e9d8a6", COL.ink, 4, 4);
    // the facets (bumps) of a rough surface
    const nb = 9;
    for (let i = 0; i < nb; i++) {
      const x = 130 + i * 55, tilt = (25 * s.r * Mo.TILTS[i] * Math.PI) / 180;
      line(c, x - 22 * Math.cos(tilt), Y0 - 3 + 22 * Math.sin(tilt), x + 22 * Math.cos(tilt), Y0 - 3 - 22 * Math.sin(tilt), COL.ink, 5);
      const out = (Mo.outAngle(s.r, s.theta, i) * Math.PI) / 180;
      arrow(c, x - 110 * Math.sin(th), Y0 - 110 * Math.cos(th), x, Y0 - 3, COL.orange, 3);
      arrow(c, x, Y0 - 3, x + 120 * Math.sin(out), Y0 - 3 - 120 * Math.cos(out), COL.red, 3);
    }
    // the eye
    const al = (s.alpha * Math.PI) / 180, ex = cx + 170 * Math.sin(al) + 0, ey = Y0 - 20 - 150 * Math.cos(al);
    const b = br(s);
    circle(c, ex, ey, 26, b > 0 ? `rgba(255,224,102,${0.35 + 0.65 * b})` : "#e9ecef", COL.ink, 4); circle(c, ex, ey, 9, COL.ink, null);
    txt(c, `${fmt(b * 100, 0)}%`, ex, ey - 42, 20, b > 0 ? COL.orange : COL.grey);
  },
  tasks: [
    { id: "mirror", text: "镜面反射：用平面镜，使眼睛恰好在反射光的方向上，看到明亮的光", check: (s) => s.r === 0 && Math.abs(s.alpha - s.theta) <= 2 },
    { id: "dark", text: "镜面反射：用平面镜，使眼睛离开反射光的方向（相差 20° 以上），看不到光", check: (s) => s.r === 0 && Math.abs(s.alpha - s.theta) > 20 },
    { id: "diffuse", text: "漫反射：用粗糙的表面，使眼睛离开镜面反射的方向 20° 以上，仍然能看到光", check: (s) => !Mo.isMirror(s.r) && Math.abs(s.alpha - s.theta) >= 20 && br(s) > 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
