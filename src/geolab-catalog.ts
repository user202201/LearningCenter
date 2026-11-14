/**
 * The list of the geography lab's modules (static: the page shows its cards without loading any module). `grade` 6 = 小学, 7 = 七年级, 8 = 八年级 (the main stage of the module,
 * the chapter names the textbook-neutral unit). `tasks` = how many 实验任务 the module has (the tests compare it with the module). Icons are drawn in code (Latin letters only).
 */
import type { Meta } from "./phys/kit";
const S = (inner: string) => `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const K = "#2d2230";
const bg = (c: string) => `<rect x="6" y="6" width="108" height="108" rx="26" fill="${c}"/>`;
const st = (extra = "") => `fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${extra}`;
const m = (id: string, title: string, grade: 6 | 7 | 8, chapter: string, tasks: number, icon: string): Meta => ({ id, title, grade, chapter, tasks, icon: S(icon) });
const globe = `<circle cx="60" cy="60" r="34" fill="#a5d8ff" stroke="${K}" stroke-width="4"/><path d="M26 60H94M60 26C46 40 46 80 60 94C74 80 74 40 60 26M32 42H88M32 78H88" ${st(`stroke-width="3"`)}/>`;
export const CATALOG = {
  seasons: m("seasons", "昼夜与四季", 6, "小学常识 · 地球的运动", 3, bg("#fff3bf") + `<circle cx="40" cy="60" r="16" fill="#fcc419" stroke="${K}" stroke-width="4"/><circle cx="84" cy="60" r="12" fill="#74c0fc" stroke="${K}" stroke-width="4"/><path d="M84 40L84 80" ${st(`stroke-dasharray="4 5" transform="rotate(23 84 60)"`)}/>`),
  terrain: m("terrain", "五种地形", 6, "小学常识 · 地形", 3, bg("#ebfbee") + `<path d="M12 90L40 46L58 70L78 38L108 90Z" fill="#8ce99a" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  watercycle: m("watercycle", "水循环", 6, "小学常识 · 水", 3, bg("#e7f5ff") + `<path d="M12 94C30 84 40 104 60 94S90 84 108 94" ${st(`stroke="#1c7ed6"`)}/><path d="M30 76V40M24 48L30 40L36 48M90 40V76M84 68L90 76L96 68" ${st(`stroke="#e03131"`)}/><ellipse cx="62" cy="30" rx="26" ry="12" fill="#fff" stroke="${K}" stroke-width="4"/>`),
  weather: m("weather", "天气与天气预报", 6, "小学常识 · 天气", 3, bg("#e3fafc") + `<circle cx="46" cy="46" r="16" fill="#fcc419" stroke="${K}" stroke-width="4"/><ellipse cx="68" cy="68" rx="28" ry="16" fill="#fff" stroke="${K}" stroke-width="4"/><path d="M56 90L52 102M72 90L68 102M88 88L84 100" ${st(`stroke="#1c7ed6"`)}/>`),
  plates: m("plates", "板块、地震与火山", 6, "小学常识 · 地震", 3, bg("#fff5f5") + `<path d="M12 62H56L62 70H108" ${st()}/><path d="M12 62L40 90H80L108 70" fill="#ffc9c9" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M52 62L60 38L68 62" fill="#fa5252" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  chinabasic: m("chinabasic", "我们的国家", 6, "小学常识 · 疆域、行政区、民族", 3, bg("#ffe3e3") + `<path d="M26 56C34 36 52 30 64 36C80 28 96 40 92 56C98 70 78 82 60 84C44 90 28 76 26 56Z" fill="#ff8787" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  globe: m("globe", "地球与经纬网", 7, "七年级上 · 地球和地图", 4, bg("#e7f5ff") + globe + `<circle cx="74" cy="46" r="7" fill="#e03131" stroke="${K}" stroke-width="3"/>`),
  timezone: m("timezone", "时区与日界线", 7, "七年级上 · 地球和地图", 3, bg("#f3f0ff") + globe + `<path d="M60 20V100" ${st(`stroke="#f08c00" stroke-width="6"`)}/>`),
  scale: m("scale", "地图的三要素", 7, "七年级上 · 地球和地图", 3, bg("#fff9db") + `<path d="M16 76H104" ${st()}/><path d="M16 68V84M44 72V80M72 72V80M104 68V84" ${st()}/><path d="M60 22L50 46H70Z" fill="#e03131" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`),
  contour: m("contour", "等高线与地形图", 7, "七年级上 · 地球和地图", 4, bg("#f4fce3") + `<ellipse cx="60" cy="62" rx="44" ry="32" ${st(`stroke="#74b816"`)}/><ellipse cx="60" cy="62" rx="30" ry="21" ${st(`stroke="#74b816"`)}/><ellipse cx="60" cy="62" rx="15" ry="10" ${st(`stroke="#e8590c"`)}/>`),
  continents: m("continents", "大洲、大洋与陆海分布", 7, "七年级上 · 陆地和海洋", 3, bg("#d0ebff") + `<path d="M20 40C30 26 52 30 56 44C62 56 46 74 36 70C24 64 14 52 20 40ZM70 30C82 24 100 32 98 48C96 62 80 66 74 56C68 48 66 38 70 30Z" fill="#8ce99a" stroke="${K}" stroke-width="4"/>`),
  climate: m("climate", "气温曲线与降水柱状图", 7, "七年级上 · 天气与气候", 3, bg("#fff4e6") + `<rect x="24" y="64" width="12" height="30" fill="#74c0fc"/><rect x="44" y="52" width="12" height="42" fill="#74c0fc"/><rect x="64" y="40" width="12" height="54" fill="#74c0fc"/><path d="M18 74C40 54 70 44 104 34" ${st(`stroke="#e03131"`)}/>`),
  population: m("population", "人口与人种、语言、宗教", 7, "七年级上 · 居民与聚落", 3, bg("#fff0f6") + `<circle cx="40" cy="42" r="12" fill="#ffd8a8" stroke="${K}" stroke-width="4"/><circle cx="76" cy="42" r="12" fill="#e8c9a0" stroke="${K}" stroke-width="4"/><path d="M22 90C22 66 58 66 58 90M58 90C58 66 94 66 94 90" ${st()}/>`),
  development: m("development", "发展中国家与发达国家", 7, "七年级上 · 发展与合作", 3, bg("#edf2ff") + `<path d="M18 94H102M18 94V24" ${st()}/><circle cx="34" cy="78" r="6" fill="#f76707"/><circle cx="50" cy="70" r="6" fill="#f76707"/><circle cx="76" cy="40" r="6" fill="#1c7ed6"/><circle cx="90" cy="34" r="6" fill="#1c7ed6"/>`),
  regions: m("regions", "世界重要地区与国家", 7, "七年级下 · 我们生活的大洲", 3, bg("#e6fcf5") + globe + `<rect x="62" y="40" width="22" height="18" rx="4" fill="none" stroke="#e03131" stroke-width="4"/>`),
  rocks: m("rocks", "岩石圈、岩石与内外力", 7, "七年级上 · 地球的内部", 3, bg("#f1f3f5") + `<circle cx="60" cy="60" r="38" fill="#ffd8a8" stroke="${K}" stroke-width="4"/><circle cx="60" cy="60" r="26" fill="#ffa94d" stroke="${K}" stroke-width="3"/><circle cx="60" cy="60" r="12" fill="#e03131" stroke="${K}" stroke-width="3"/>`),
  chinaterrain: m("chinaterrain", "中国地势三级阶梯", 8, "八年级上 · 中国的自然环境", 3, bg("#fff9db") + `<path d="M12 90V30H40V54H70V74H108V90Z" fill="#ffd43b" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  chinanature: m("chinanature", "中国的山河湖泊与地形", 8, "八年级上 · 中国的自然环境", 3, bg("#e3fafc") + `<path d="M14 40C34 30 50 54 70 50S96 66 106 80" ${st(`stroke="#1c7ed6" stroke-width="6"`)}/><path d="M20 92L44 62L62 86L82 56L104 92Z" fill="#8ce99a" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  chinaecon: m("chinaecon", "中国的农业、工业与交通", 8, "八年级上 · 中国的经济发展", 3, bg("#fff9db") + `<path d="M24 92V60M40 92V50M56 92V62M72 92V48" ${st(`stroke="#2f9e44" stroke-width="6"`)}/><path d="M20 38H100" ${st()}/><circle cx="34" cy="38" r="6" fill="#e03131"/><circle cx="86" cy="38" r="6" fill="#e03131"/>`),
  sustain: m("sustain", "资源、环境与可持续发展", 8, "八年级上 · 资源与环境", 3, bg("#ebfbee") + `<path d="M60 96V50" ${st(`stroke="#2f9e44"`)}/><path d="M60 62C36 62 30 44 30 32C50 34 60 44 60 62ZM60 52C80 52 90 38 90 26C70 28 60 38 60 52Z" fill="#69db7c" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  chinaregions: m("chinaregions", "四大地理区域与省区", 8, "八年级下 · 中国的区域差异", 4, bg("#ffe8cc") + `<path d="M26 56C34 36 52 30 64 36C80 28 96 40 92 56C98 70 78 82 60 84C44 90 28 76 26 56Z" fill="#ffa94d" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M58 38L60 84M30 62H92" ${st(`stroke-width="3"`)}/>`),
} satisfies Record<string, Meta>;
export type GeoId = keyof typeof CATALOG;
export const ORDER: GeoId[] = ["seasons", "terrain", "watercycle", "weather", "plates", "chinabasic", "globe", "timezone", "scale", "contour", "continents", "rocks", "climate", "population", "development", "regions", "chinaterrain", "chinanature", "chinaecon", "sustain", "chinaregions"];
export const GRADE_NAME: Record<number, string> = { 6: "小学", 7: "七年级", 8: "八年级" };
