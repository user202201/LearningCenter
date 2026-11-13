/**
 * The list of the biology lab's simulations (static: the page shows its cards without loading any simulation). `icon` = a cartoon picture drawn in code (viewBox 0 0 120 120, Latin letters only);
 * `tasks` = how many 实验任务 the simulation has (the tests compare it with the module). Grade = 7 or 8 (七年级 / 八年级).
 */
import type { Meta } from "../phys/kit";
const S = (inner: string) => `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const K = "#2d2230";
const bg = (c: string) => `<rect x="6" y="6" width="108" height="108" rx="26" fill="${c}"/>`;
const st = (extra = "") => `fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${extra}`;
const m = (id: string, title: string, grade: 7 | 8, chapter: string, tasks: number, icon: string): Meta => ({ id, title, grade, chapter, tasks, icon: S(icon) });
const dot = (x: number, y: number, r: number, f: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${K}" stroke-width="3"/>`;
const ell = (x: number, y: number, rx: number, ry: number, f: string, rot = 0) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${K}" stroke-width="3.5" transform="rotate(${rot} ${x} ${y})"/>`;
export const CATALOG = {
  foodweb: m("foodweb", "食物链与食物网", 7, "七上 · 生物与环境", 4, bg("#ebfbee") + `<path d="M30 88L60 52L90 88" ${st()}/>` + dot(30, 88, 11, "#8ce99a") + dot(60, 50, 11, "#ffd8a8") + dot(90, 88, 11, "#74c0fc") + `<path d="M46 66L52 58M74 66L68 58" ${st(`stroke="#e03131"`)}/>`),
  population: m("population", "种群与生态平衡", 7, "七上 · 生物与环境", 3, bg("#fff4e6") + `<path d="M16 92V24M16 92H104" ${st()}/><path d="M18 80C32 30 44 30 56 70C66 100 76 40 88 36C96 34 100 46 104 40" ${st(`stroke="#2f9e44"`)}/><path d="M18 88C34 80 46 50 58 44C68 40 78 70 90 72" ${st(`stroke="#e03131"`)}/>`),
  microscope: m("microscope", "显微镜", 7, "七上 · 细胞", 3, bg("#e7f5ff") + `<rect x="50" y="20" width="16" height="42" rx="5" fill="#495057" stroke="${K}" stroke-width="3.5" transform="rotate(20 58 40)"/><path d="M76 30C98 50 92 84 66 92" ${st()}/><path d="M26 98H94" ${st()}/><rect x="34" y="76" width="36" height="8" rx="3" fill="#adb5bd" stroke="${K}" stroke-width="3.5"/>`),
  cells: m("cells", "植物细胞与动物细胞", 7, "七上 · 细胞", 3, bg("#f3f0ff") + `<rect x="16" y="28" width="58" height="52" rx="14" fill="#b2f2bb" stroke="${K}" stroke-width="4"/>` + dot(36, 52, 9, "#9775fa") + ell(56, 64, 7, 4, "#2f9e44") + ell(84, 80, 22, 18, "#ffc9c9") + dot(80, 78, 6, "#9775fa")),
  division: m("division", "细胞分裂", 7, "七上 · 细胞", 3, bg("#fff0f6") + ell(60, 60, 40, 28, "#fff5f5") + `<path d="M40 48L52 72M52 48L40 72" ${st(`stroke="#e03131" stroke-width="5"`)}/><path d="M68 48L80 72M80 48L68 72" ${st(`stroke="#4263eb" stroke-width="5"`)}/>`),
  levels: m("levels", "生物体的结构层次", 7, "七上 · 生物体", 3, bg("#fff9db") + dot(24, 84, 9, "#ffa8a8") + `<rect x="38" y="66" width="22" height="18" rx="4" fill="#ffd8a8" stroke="${K}" stroke-width="3.5"/>` + ell(76, 50, 14, 18, "#ff8787") + `<rect x="86" y="22" width="16" height="30" rx="7" fill="#74c0fc" stroke="${K}" stroke-width="3.5"/>`),
  seed: m("seed", "种子萌发的条件", 7, "七上 · 绿色植物", 4, bg("#fff4e6") + `<path d="M16 88H104" ${st()}/>` + ell(40, 80, 14, 9, "#f1e0b0") + `<path d="M40 74C40 54 52 46 58 34" ${st(`stroke="#37b24d" stroke-width="6"`)}/>` + ell(64, 30, 14, 8, "#69db7c", -30) + ell(86, 82, 10, 7, "#d9a066")),
  photo: m("photo", "光合作用", 7, "七上 · 绿色植物", 4, bg("#f4fce3") + dot(30, 30, 14, "#ffe066") + `<path d="M62 94C50 70 66 40 94 30C98 58 90 84 62 94Z" fill="#51cf66" stroke="${K}" stroke-width="4"/><path d="M64 90L88 40" ${st(`stroke-width="3"`)}/>`),
  respiration: m("respiration", "呼吸作用", 7, "七上 · 绿色植物", 4, bg("#e3fafc") + `<path d="M34 94V50" ${st(`stroke="#37b24d" stroke-width="6"`)}/>` + ell(24, 44, 14, 8, "#69db7c", -30) + ell(46, 36, 14, 8, "#69db7c", 30) + `<rect x="68" y="40" width="30" height="48" rx="8" fill="#fff" stroke="${K}" stroke-width="4"/><path d="M72 66H94V84H72Z" fill="#d0ebff"/>`),
  transpiration: m("transpiration", "蒸腾作用", 7, "七上 · 绿色植物", 3, bg("#e7f5ff") + ell(60, 70, 36, 18, "#8ce99a") + `<path d="M44 46C40 36 50 34 46 24M64 46C60 36 70 34 66 24M84 46C80 36 90 34 86 24" ${st(`stroke="#4dabf7"`)}/>`),
  flower: m("flower", "花与果实", 7, "七上 · 绿色植物", 3, bg("#fff0f6") + ell(42, 48, 16, 22, "#fcc2d7", -30) + ell(78, 48, 16, 22, "#fcc2d7", 30) + `<path d="M60 96V54" ${st(`stroke="#37b24d" stroke-width="6"`)}/>` + dot(60, 44, 9, "#ffd43b")),
  digest: m("digest", "消化与酶", 7, "七下 · 人体的营养", 4, bg("#fff5f5") + `<path d="M40 24V46C40 58 70 58 70 70C70 82 50 80 50 92" ${st(`stroke-width="8" stroke="#fa8c16"`)}/>` + dot(78, 34, 10, "#74c0fc")),
  breathing: m("breathing", "呼吸运动", 7, "七下 · 人体的呼吸", 3, bg("#e7f5ff") + ell(44, 56, 16, 28, "#ffa8a8") + ell(76, 56, 16, 28, "#ffa8a8") + `<path d="M24 92C50 80 70 80 96 92" ${st(`stroke="#f08c00"`)}/>`),
  blood: m("blood", "血液循环", 7, "七下 · 物质的运输", 4, bg("#ffe3e3") + `<path d="M60 30C40 14 20 40 60 90C100 40 80 14 60 30Z" fill="#fa5252" stroke="${K}" stroke-width="4"/><path d="M60 40V70" ${st(`stroke="#fff" stroke-width="3"`)}/>`),
  nerve: m("nerve", "神经调节", 7, "七下 · 生命活动的调节", 3, bg("#fff9db") + dot(26, 60, 9, "#ffd43b") + dot(60, 38, 9, "#74c0fc") + dot(94, 60, 9, "#ff8787") + `<path d="M34 56L52 42M68 42L86 56" ${st()}/>`),
  hormone: m("hormone", "激素与血糖", 7, "七下 · 生命活动的调节", 3, bg("#f3f0ff") + `<path d="M16 92V24M16 92H104" ${st()}/><path d="M18 84C34 80 40 30 52 30C66 30 66 70 104 74" ${st(`stroke="#e03131"`)}/>`),
  eye: m("eye", "眼与视觉", 7, "七下 · 感觉器官", 3, bg("#e3fafc") + ell(60, 60, 38, 22, "#fff") + dot(60, 60, 14, "#4dabf7") + dot(60, 60, 6, K)),
  motion: m("motion", "动物的运动", 8, "八上 · 动物的运动和行为", 3, bg("#fff4e6") + `<path d="M34 24L48 60L84 78" ${st(`stroke-width="9"`)}/>` + dot(48, 60, 9, "#ffd43b") + `<path d="M58 30C70 40 66 54 56 58" ${st(`stroke="#e03131"`)}/>`),
  ferment: m("ferment", "微生物与发酵", 8, "八上 · 细菌、真菌和病毒", 4, bg("#fff9db") + `<path d="M46 24H74V44L90 88H30L46 44Z" fill="#ffe8a3" stroke="${K}" stroke-width="4"/>` + dot(56, 70, 5, "#fff") + dot(70, 60, 4, "#fff") + dot(62, 80, 4, "#fff")),
  classify: m("classify", "生物的分类", 8, "八上 · 生物的多样性", 3, bg("#ebfbee") + `<path d="M60 26V50M60 50L34 74M60 50L86 74" ${st()}/>` + dot(60, 24, 9, "#8ce99a") + dot(32, 80, 9, "#ffd8a8") + dot(88, 80, 9, "#74c0fc")),
  genetics: m("genetics", "遗传", 8, "八下 · 遗传和变异", 4, bg("#f3f0ff") + `<rect x="24" y="24" width="34" height="34" rx="6" fill="#d0bfff" stroke="${K}" stroke-width="3.5"/><rect x="62" y="24" width="34" height="34" rx="6" fill="#fff" stroke="${K}" stroke-width="3.5"/><rect x="24" y="62" width="34" height="34" rx="6" fill="#fff" stroke="${K}" stroke-width="3.5"/><rect x="62" y="62" width="34" height="34" rx="6" fill="#d0bfff" stroke="${K}" stroke-width="3.5"/>`),
  selection: m("selection", "自然选择", 8, "八下 · 生物的进化", 3, bg("#fff4e6") + ell(40, 62, 20, 10, "#f1ece0", -20) + ell(80, 62, 20, 10, "#3b3532", 20) + `<path d="M20 96H100" ${st()}/>`),
  epidemic: m("epidemic", "传染病与免疫", 8, "八下 · 健康地生活", 3, bg("#ffe3e3") + dot(60, 60, 16, "#ff8787") + `<path d="M60 34V24M60 96V86M34 60H24M96 60H86M42 42L35 35M78 78L85 85M78 42L85 35M42 78L35 85" ${st(`stroke="#e03131"`)}/>`),
} satisfies Record<string, Meta>;
export type BioId = keyof typeof CATALOG;
export const ORDER: BioId[] = ["foodweb", "population", "microscope", "cells", "division", "levels", "seed", "photo", "respiration", "transpiration", "flower", "digest", "breathing", "blood", "nerve", "hormone", "eye", "motion", "ferment", "classify", "genetics", "selection", "epidemic"];
