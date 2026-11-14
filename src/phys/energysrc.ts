import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-energysrc";
import { COL, circle, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.energysrc;
const kinds = (s: Record<string, number>) => Mo.SOURCES[s.src];
/** a small cartoon of each energy source, drawn in code (index = the order of Mo.SOURCES) */
function icon(c: CanvasRenderingContext2D, i: number, x: number, y: number) {
  switch (i) {
    case 0: poly(c, [[x - 60, y + 40], [x - 40, y - 30], [x + 10, y - 50], [x + 60, y - 10], [x + 50, y + 40]], "#495057", COL.ink, 4); break;
    case 1: c.beginPath(); c.moveTo(x, y - 60); c.bezierCurveTo(x + 60, y + 10, x + 50, y + 60, x, y + 60); c.bezierCurveTo(x - 50, y + 60, x - 60, y + 10, x, y - 60); c.fillStyle = "#212529"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke(); break;
    case 2: c.beginPath(); c.moveTo(x, y - 60); c.bezierCurveTo(x + 70, y, x + 40, y + 60, x, y + 60); c.bezierCurveTo(x - 50, y + 60, x - 50, y, x, y - 60); c.fillStyle = "#4dabf7"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke(); break;
    case 3: circle(c, x, y, 10, COL.red); for (const a of [0, 60, 120]) { c.save(); c.translate(x, y); c.rotate((a * Math.PI) / 180); c.beginPath(); c.ellipse(0, 0, 62, 22, 0, 0, Math.PI * 2); c.strokeStyle = COL.purple; c.lineWidth = 4; c.stroke(); c.restore(); } break;
    case 4: for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; line(c, x + 42 * Math.cos(a), y + 42 * Math.sin(a), x + 64 * Math.cos(a), y + 64 * Math.sin(a), COL.orange, 6); } circle(c, x, y, 34, COL.yellow, COL.ink, 4); break;
    case 5: line(c, x, y + 60, x, y - 10, COL.ink, 8); for (const a of [-90, 30, 150]) { const r = (a * Math.PI) / 180; poly(c, [[x, y - 10], [x + 56 * Math.cos(r) - 8 * Math.sin(r), y - 10 + 56 * Math.sin(r) + 8 * Math.cos(r)], [x + 56 * Math.cos(r) + 8 * Math.sin(r), y - 10 + 56 * Math.sin(r) - 8 * Math.cos(r)]], "#e9ecef", COL.ink, 3); } break;
    case 6: for (const dy of [-24, 4, 32]) { c.beginPath(); for (let k = 0; k <= 60; k++) { const px = x - 60 + k * 2, py = y + dy + 8 * Math.sin(k / 4); (k ? c.lineTo : c.moveTo).call(c, px, py); } c.strokeStyle = COL.blue; c.lineWidth = 6; c.stroke(); } break;
    case 7: c.beginPath(); c.ellipse(x, y, 60, 34, -0.6, 0, Math.PI * 2); c.fillStyle = "#69db7c"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke(); line(c, x - 50, y + 30, x + 40, y - 24, COL.ink, 3); break;
    case 8: poly(c, [[x - 70, y + 50], [x - 20, y - 30], [x + 20, y - 30], [x + 70, y + 50]], "#a0522d", COL.ink, 4); for (const dx of [-14, 8]) { c.beginPath(); c.moveTo(x + dx, y - 40); c.bezierCurveTo(x + dx - 16, y - 56, x + dx + 16, y - 66, x + dx, y - 84); c.strokeStyle = COL.grey; c.lineWidth = 5; c.stroke(); } break;
    case 9: poly(c, [[x + 14, y - 64], [x - 36, y + 8], [x - 4, y + 8], [x - 16, y + 64], [x + 40, y - 12], [x + 6, y - 12]], COL.yellow, COL.ink, 4); break;
    default: circle(c, x, y, 52, "#d0ebff", COL.ink, 4); txt(c, "H2", x, y, 38, COL.blue);
  }
}
export const def: SimDef = {
  meta,
  lesson: [
    "能源是能够提供能量的物质或资源。按能否直接从自然界获得分为一次能源（煤、石油、天然气、风能、水能、太阳能、核能等）和二次能源（电能、氢能等）；按能否在短期内从自然界得到补充分为可再生能源（太阳能、风能、水能、生物质能、地热能）和不可再生能源（煤、石油、天然气、核能）。化石能源的使用会排放二氧化碳等，造成环境污染和气候变暖。",
    "能量的转化有方向性：发电就是把其他形式的能转化为电能。火力发电要经过化学能→内能→机械能→电能三次转化，每一步都有损失，总效率等于各步效率的乘积，只有三分之一到五分之二；水力发电环节少，效率高；太阳能电池板把光能直接转化为电能。能量虽然守恒，但转化为内能散失到环境中的能量不能再被利用，所以要节约能源、提高效率、开发新能源。",
    "可持续发展：既满足当代人的需要，又不损害后代人满足其需要的能力。调整电力结构，减少煤的比例，增加水能、风能、太阳能和核能的比例，可以明显降低每度电的碳排放。1 kW·h = 3.6×10⁶ J = 3.6 MJ。",
  ],
  formulas: ["\\eta=\\eta_1\\eta_2\\eta_3", "1\\,\\text{kW·h}=3.6\\times10^6\\,\\text{J}"],
  params: [
    { id: "Ein", label: "输入的能量", min: 100, max: 1000, step: 100, value: 1000, unit: "MJ", when: (s) => s.mode === 1 },
    { id: "boost", label: "把效率最低的环节提高", min: 0, max: 20, step: 1, value: 0, unit: "百分点", when: (s) => s.mode === 1 },
    { id: "coal", label: "煤电的比例", min: 0, max: 100, step: 5, value: 60, unit: "%", when: (s) => s.mode === 2 },
    { id: "hydro", label: "水电的比例", min: 0, max: 100, step: 5, value: 15, unit: "%", when: (s) => s.mode === 2 },
    { id: "nuc", label: "核电的比例", min: 0, max: 100, step: 5, value: 5, unit: "%", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "能源分类"], [1, "发电的能量转化"], [2, "电力结构与碳排放"]] },
    { id: "src", label: "能源", value: 0, options: Mo.SOURCES.map((x, i) => [i, x.name] as [number, string]), when: (s) => s.mode === 0 },
    { id: "guess", label: "你的判断", value: 0, options: [[0, "还没有判断"], [1, "可再生能源"], [2, "不可再生能源"]], when: (s) => s.mode === 0 },
    { id: "plant", label: "发电方式", value: 0, options: Mo.PLANTS.map((x, i) => [i, x.name] as [number, string]), when: (s) => s.mode === 1 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const k = kinds(s), ok = s.guess === 0 ? "还没有判断" : k.renew === null ? "二次能源不分可再生与否" : (s.guess === 1) === k.renew ? "判断正确" : "判断错误"; return [{ label: "能源", value: k.name }, { label: "来源", value: k.from }, { label: "可再生吗", value: k.renew === null ? "不适用（二次能源）" : k.renew ? "可再生能源" : "不可再生能源" }, { label: "一次还是二次", value: k.primary ? "一次能源" : "二次能源" }, { label: "你的判断", value: ok }]; }
    if (s.mode === 1) { const t = Mo.total(s.plant, s.boost); return [{ label: "能量的转化", value: Mo.PLANTS[s.plant].chain }, { label: "输出的电能", value: fmt(s.Ein * t, 1), unit: "MJ" }, { label: "合计的效率", value: fmt(t * 100, 1), unit: "%" }, { label: "损失的能量", value: fmt(s.Ein * (1 - t), 1), unit: "MJ" }, { label: "效率最低的环节", value: Mo.weakest(s.plant) }]; }
    const m = Mo.mix(s.coal, s.hydro, s.nuc);
    return [{ label: "风电和光伏的比例", value: fmt(m.wind, 0), unit: "%" }, { label: "可再生能源的比例", value: fmt(m.renew, 0), unit: "%" }, { label: "每度电的碳排放", value: fmt(m.co2, 2), unit: "kg" }, { label: "三项合计", value: s.coal + s.hydro + s.nuc > 100 ? "超过 100%，已按比例缩小" : "未超过 100%" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const k = kinds(s); rect(c, 140, 40, 360, 300, k.renew ? "#d3f9d8" : "#e9ecef", COL.ink, 5, 20); icon(c, s.src, 320, 170);
      txt(c, k.renew === null ? "n/a" : k.renew ? "renewable" : "non-renewable", 320, 290, 24, k.renew ? COL.green : COL.grey); txt(c, k.primary ? "primary" : "secondary", 320, 320, 20, COL.purple);
      if (s.guess !== 0 && k.renew !== null) txt(c, (s.guess === 1) === k.renew ? "OK" : "X", 560, 60, 40, (s.guess === 1) === k.renew ? COL.green : COL.red);
      return;
    }
    if (s.mode === 1) {
      const e = Mo.steps(s.plant, s.boost), cols = [COL.orange, COL.purple, COL.teal, COL.blue];
      let h0 = 280; const x0 = 70, bw = 70, gap = (560 - bw * (e.length + 1)) / e.length;
      rect(c, x0, 60, bw, h0, "#ffe8cc", COL.ink, 3, 4); txt(c, "100%", x0 + bw / 2, 50, 18, COL.ink);
      let acc = 1;
      e.forEach((v, i) => { const x = x0 + (i + 1) * (bw + gap); const loss = acc * (1 - v); acc *= v; const hh2 = acc * h0; rect(c, x, 60 + (h0 - hh2), bw, hh2, cols[i % 4], COL.ink, 3, 4); rect(c, x - gap * 0.6, 60 + h0 - hh2 - loss * h0, 18, loss * h0, "#adb5bd", null, 0, 2); txt(c, `${fmt(acc * 100, 0)}%`, x + bw / 2, 50, 18, COL.ink); line(c, x - gap + bw, 60 + (h0 - hh2), x, 60 + (h0 - hh2), COL.grey, 2, [4, 4]); });
      return;
    }
    const m = Mo.mix(s.coal, s.hydro, s.nuc), parts: [number, string][] = [[m.coal, "#495057"], [m.nuclear, COL.purple], [m.hydro, COL.blue], [m.wind, COL.green]];
    let x = 60; for (const [v, col] of parts) { const wd = (v / 100) * 520; rect(c, x, 90, wd, 80, col, null, 0, 0); x += wd; } rect(c, 60, 90, 520, 80, "", COL.ink, 4, 0);
    rect(c, 60, 230, 520, 30, "#fff", COL.ink, 3, 6); rect(c, 60, 230, Math.min(520, (m.co2 / 1) * 520), 30, m.co2 > 0.5 ? COL.red : COL.green, null, 0, 6); line(c, 60 + 260, 220, 60 + 260, 270, COL.ink, 3, [4, 4]); txt(c, `${fmt(m.co2, 2)} kg/kWh`, 320, 310, 24, COL.ink);
  },
  tasks: [
    { id: "wind", text: "能源分类：选择风能，并正确判断它是可再生能源", check: (s) => s.mode === 0 && s.src === 5 && s.guess === 1 },
    { id: "nuclear", text: "能源分类：选择核能，并正确判断它是不可再生能源", check: (s) => s.mode === 0 && s.src === 3 && s.guess === 2 },
    { id: "improve", text: "发电的能量转化：用火力发电，通过技术改进使总效率超过 45%", check: (s) => s.mode === 1 && s.plant === 0 && Mo.total(0, s.boost) > 0.45 },
    { id: "mix", text: "电力结构：使可再生能源的比例达到 50% 以上，且每度电的碳排放不超过 0.5 kg", check: (s) => { if (s.mode !== 2) return false; const m = Mo.mix(s.coal, s.hydro, s.nuc); return m.renew >= 50 && m.co2 <= 0.5; } },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
