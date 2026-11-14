/**
 * Drawings of the safety summaries (安全与生活常识, tab 安全 of #/science/notes): traffic signs, signal light, fire, extinguisher, earthquake,
 * seven-step hand washing, 20-20-20, waste bins, warning colours, CPR, burns, emergency numbers, body safety. Inline SVG made in code, 240 x 150,
 * no images. Like figures.ts its labels are translated when drawn (rule 65); check-i18n skips the file.
 * The traffic signs are also exported one by one (TRAFFIC_SIGNS: 100 x 100, `data-cls` = ban / warn / info): prohibition = red ring, warning = yellow
 * triangle, mandatory / information = blue circle.
 */
const INK = "#5b4b57", FILL = "#ffe3a3", RED = "#e03131", BLUE = "#1c7ed6", GREEN = "#2f9e44", YELLOW = "#fcc419", ORANGE = "#f76707", GRAY = "#868e96";
const W = 240, H = 150;
const wrap = (inner: string) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" class="fig-svg"><g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none" font-family="system-ui, sans-serif">${inner}</g></svg>`;
/** `extra`: more attributes of the label: `data-k` = the text to translate when the shown text is made of pieces, `data-sfx` = a suffix kept as it is (a number), `data-drop` = a second line that disappears when the first one holds the whole translated name (rule 65) */
const t = (x: number, y: number, s: string, size = 12, anchor = "middle", fill = "#2d2230", extra = "") => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" stroke="none" font-weight="700"${extra ? " " + extra : ""}>${s}</text>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, c = INK) => {
  const a = Math.atan2(y2 - y1, x2 - x1), l = 7;
  return `<path d="M${x1} ${y1}L${x2} ${y2}M${x2 - l * Math.cos(a - 0.5)} ${y2 - l * Math.sin(a - 0.5)}L${x2} ${y2}L${x2 - l * Math.cos(a + 0.5)} ${y2 - l * Math.sin(a + 0.5)}" stroke="${c}"/>`;
};
const box = (x: number, y: number, w: number, h: number, s: string, fill = FILL, size = 12) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>${t(x + w / 2, y + h / 2 + size / 3, s, size)}`;
/** a stick person at (x, y) = top of the head, height about 44 * k */
const person = (x: number, y: number, k = 1, c = "#222", sw = 4) =>
  `<g stroke="${c}" stroke-width="${sw}" fill="${c}"><circle cx="${x}" cy="${y + 6 * k}" r="${6 * k}" stroke="none"/><path fill="none" d="M${x} ${y + 14 * k}L${x} ${y + 30 * k}M${x} ${y + 30 * k}L${x - 9 * k} ${y + 46 * k}M${x} ${y + 30 * k}L${x + 9 * k} ${y + 46 * k}M${x} ${y + 19 * k}L${x - 10 * k} ${y + 28 * k}M${x} ${y + 19 * k}L${x + 10 * k} ${y + 28 * k}"/></g>`;

// ---------- traffic signs (100 x 100) ----------
export interface Sign { id: string; cls: "ban" | "warn" | "info"; name: string; inner: string }
const ring = (fill = "#fff") => `<circle cx="50" cy="50" r="42" fill="${fill}" stroke="${RED}" stroke-width="9"/>`;
const tri = `<path d="M50 8L94 86L6 86Z" fill="${YELLOW}" stroke="#222" stroke-width="6"/>`;
const disc = `<circle cx="50" cy="50" r="44" fill="${BLUE}" stroke="${BLUE}" stroke-width="2"/>`;
export const TRAFFIC_SIGNS: Sign[] = [
  { id: "limit30", cls: "ban", name: "限速30", inner: `${ring()}<text x="50" y="63" font-size="38" text-anchor="middle" fill="#111" stroke="none" font-weight="900" font-family="system-ui, sans-serif">30</text>` },
  { id: "nowalk", cls: "ban", name: "禁止行人", inner: `${ring()}${person(50, 22, 1, "#111")}<path d="M24 24L76 76" stroke="${RED}" stroke-width="7"/>` },
  { id: "nopark", cls: "ban", name: "禁止停车", inner: `${ring(BLUE)}<path d="M24 24L76 76M76 24L24 76" stroke="${RED}" stroke-width="7"/>` },
  { id: "walkers", cls: "warn", name: "注意行人", inner: `${tri}${person(50, 36, 0.85, "#111", 4)}` },
  { id: "children", cls: "warn", name: "注意儿童", inner: `${tri}${person(40, 46, 0.62, "#111", 3.4)}${person(60, 46, 0.62, "#111", 3.4)}` },
  { id: "lights", cls: "warn", name: "注意信号灯", inner: `${tri}<rect x="41" y="30" width="18" height="46" rx="4" fill="#111" stroke="none"/><circle cx="50" cy="39" r="5" fill="${RED}" stroke="none"/><circle cx="50" cy="53" r="5" fill="${YELLOW}" stroke="none"/><circle cx="50" cy="67" r="5" fill="${GREEN}" stroke="none"/>` },
  { id: "straight", cls: "info", name: "直行", inner: `${disc}<path d="M50 22L50 78M50 22L34 40M50 22L66 40" stroke="#fff" stroke-width="9" fill="none"/>` },
  { id: "right", cls: "info", name: "向右转弯", inner: `${disc}<path d="M34 78L34 48Q34 36 46 36L72 36M72 36L56 20M72 36L56 52" stroke="#fff" stroke-width="9" fill="none"/>` },
  { id: "walk", cls: "info", name: "步行", inner: `${disc}${person(50, 22, 1.05, "#fff", 5)}` },
];
export const signSvg = (s: Sign) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" class="fig-svg sign-svg" data-cls="${s.cls}" data-sign="${s.id}">${s.inner}</svg>`;
const signsFig = () => {
  const rows: [Sign["cls"], string][] = [["ban", "禁止（红圈）"], ["warn", "警告（黄三角）"], ["info", "指示（蓝圆）"]];
  return wrap(rows.map(([cls, label], r) => {
    const y = 4 + r * 48;
    return t(6, y + 28, label, 11, "start") + TRAFFIC_SIGNS.filter((s) => s.cls === cls).map((s, i) => `<g transform="translate(${100 + i * 46} ${y}) scale(0.42)" stroke-width="0">${s.inner}</g>`).join("");
  }).join(""));
};

export const SAFETY_FIGS: Record<string, string> = {
  "sf-signs": signsFig(),
  "sf-light": wrap(`<rect x="20" y="10" width="46" height="112" rx="14" fill="#343a40"/><circle cx="43" cy="34" r="13" fill="${RED}" stroke="none"/><circle cx="43" cy="66" r="13" fill="${YELLOW}" stroke="none"/><circle cx="43" cy="98" r="13" fill="${GREEN}" stroke="none"/>`
    + `${t(86, 39, "红灯停", 15, "start", RED)}${t(86, 71, "黄灯等", 15, "start", "#b08900")}${t(86, 103, "绿灯行", 15, "start", GREEN)}`
    + [0, 1, 2, 3, 4].map((i) => `<rect x="${142 + i * 18}" y="128" width="10" height="16" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`).join("") + t(190, 120, "斑马线", 11)),
  "sf-fire": wrap(`${box(8, 8, 108, 34, "湿毛巾捂口鼻", "#d0ebff", 13)}${box(124, 8, 108, 34, "低姿 贴近地面", "#ffe8cc", 13)}${box(8, 52, 108, 34, "走楼梯", "#d3f9d8", 13)}${box(124, 52, 108, 34, "不乘电梯", "#ffc9c9", 13)}${box(8, 98, 224, 38, "拨打 119，说清地址", "#fff3bf", 15)}`),
  "sf-pass": wrap(`<rect x="22" y="48" width="42" height="84" rx="12" fill="${RED}"/><rect x="34" y="34" width="18" height="16" fill="#495057"/><path d="M34 36L22 28L10 36" stroke="#495057" stroke-width="3"/><path d="M52 40L70 36" stroke="#495057" stroke-width="3"/><path d="M28 32L52 32" stroke="#495057" stroke-width="3"/>`
    + [["1", "拔掉保险销"], ["2", "握住喷管"], ["3", "压下手柄"], ["4", "对准火根扫射"]].map(([n, s], i) => `<circle cx="96" cy="${24 + i * 34}" r="11" fill="${ORANGE}" stroke="none"/>${t(96, 29 + i * 34, n, 13, "middle", "#fff")}${t(114, 29 + i * 34, s, 14, "start")}`).join("")),
  "sf-quake": wrap(`${box(6, 6, 70, 22, "伏地", "#ffe8cc", 14)}${box(86, 6, 70, 22, "遮挡", "#d0ebff", 14)}${box(166, 6, 68, 22, "避让", "#d3f9d8", 14)}`
    + `<path d="M14 114Q40 70 66 114" fill="none"/><circle cx="36" cy="86" r="8" fill="${FILL}"/>${t(40, 140, "蹲下，护住头颈", 10, "middle")}`
    + `<rect x="92" y="78" width="58" height="8" fill="#c68642"/><path d="M96 86L96 120M146 86L146 120" stroke="#c68642" stroke-width="5"/><circle cx="121" cy="108" r="8" fill="${FILL}"/><path d="M110 120Q121 100 132 120" fill="none"/>${t(121, 140, "抓牢桌腿", 10)}`
    + `<rect x="172" y="50" width="54" height="64" fill="#e7f5ff"/><path d="M172 50L226 114M226 50L172 114" stroke="${RED}" stroke-width="3"/>${arrow(200, 130, 178, 130, GREEN)}${t(200, 146, "远离窗户", 10)}`),
  "sf-wash": wrap([["内", "掌心相对搓"], ["外", "手心搓手背"], ["夹", "十指交叉"], ["弓", "指背在掌心"], ["大", "搓拇指"], ["立", "指尖搓掌心"], ["腕", "搓手腕"]].map(([c, s], i) => {
    const x = 6 + (i % 4) * 58, y = i < 4 ? 8 : 80;
    const glyph = [`<rect x="${x + 12}" y="${y + 8}" width="10" height="24" rx="4" fill="${FILL}"/><rect x="${x + 28}" y="${y + 8}" width="10" height="24" rx="4" fill="${FILL}"/>`,
      `<rect x="${x + 12}" y="${y + 10}" width="26" height="12" rx="5" fill="${FILL}"/><rect x="${x + 16}" y="${y + 20}" width="26" height="12" rx="5" fill="#ffd27a"/>`,
      `<path d="M${x + 14} ${y + 10}L${x + 14} ${y + 32}M${x + 22} ${y + 10}L${x + 22} ${y + 32}M${x + 30} ${y + 10}L${x + 30} ${y + 32}M${x + 38} ${y + 10}L${x + 38} ${y + 32}" stroke-width="4"/><path d="M${x + 12} ${y + 22}L${x + 40} ${y + 22}" stroke="${RED}" stroke-width="2"/>`,
      `<path d="M${x + 12} ${y + 32}Q${x + 12} ${y + 8} ${x + 26} ${y + 8}Q${x + 40} ${y + 8} ${x + 40} ${y + 32}" fill="none" stroke-width="5"/>`,
      `<rect x="${x + 14}" y="${y + 16}" width="22" height="16" rx="7" fill="${FILL}"/><rect x="${x + 33}" y="${y + 8}" width="6" height="14" rx="3" fill="#ffd27a"/>`,
      `<rect x="${x + 12}" y="${y + 18}" width="28" height="14" rx="5" fill="${FILL}"/><path d="M${x + 18} ${y + 8}L${x + 18} ${y + 18}M${x + 26} ${y + 8}L${x + 26} ${y + 18}M${x + 34} ${y + 8}L${x + 34} ${y + 18}" stroke-width="3"/>`,
      `<rect x="${x + 16}" y="${y + 10}" width="18" height="24" rx="4" fill="${FILL}"/><ellipse cx="${x + 25}" cy="${y + 28}" rx="15" ry="5" stroke="${RED}" stroke-width="2.5"/>`][i];
    return `<rect x="${x}" y="${y}" width="52" height="64" rx="10" fill="#fff"/>${glyph}<circle cx="${x + 9}" cy="${y + 10}" r="0"/>${t(x + 26, y + 46, c + " " + (i + 1), 12, "middle", "#2d2230", `data-k="${c}" data-sfx=" ${i + 1}"`)}${t(x + 26, y + 58, s, 8)}`;
  }).join("") + ["每步至少", "搓 15 秒", "全程不少", "于 20 秒"].map((l, i) => t(207, 92 + i * 14, l, 10)).join("")),
  "sf-2020": wrap(`<ellipse cx="42" cy="40" rx="26" ry="16" fill="#fff"/><circle cx="42" cy="40" r="9" fill="${BLUE}"/><circle cx="42" cy="40" r="3" fill="#111"/>${t(42, 74, "近距离用眼", 11)}`
    + `${arrow(76, 40, 100, 40)}${[[110, "20", "分钟", ORANGE], [166, "6", "米外", BLUE], [214, "20", "秒", GREEN]].map(([x, n, u, c], i) => `<circle cx="${x}" cy="40" r="22" fill="${c}" stroke="none"/>${t(x as number, 41, String(n), 20, "middle", "#fff")}${t(x as number, 54, String(u), 10, "middle", "#fff")}`).join("")}`
    + `${arrow(132, 40, 144, 40)}${arrow(188, 40, 192, 40)}${t(120, 98, "每看 20 分钟，远眺 6 米外至少 20 秒", 12)}${t(120, 120, "每天户外活动 2 小时", 12, "middle", GREEN)}`),
  "sf-bins": wrap([["可回收物", BLUE, "纸 塑料 金属"], ["厨余垃圾", GREEN, "剩饭 果皮"], ["有害垃圾", RED, "电池 药品"], ["其他垃圾", GRAY, "纸巾 尘土"]].map(([n, c, e], i) => {
    const x = 8 + i * 58;
    return `<path d="M${x + 2} 40L${x + 6} 112L${x + 44} 112L${x + 48} 40Z" fill="${c}"/><rect x="${x - 2}" y="30" width="54" height="12" rx="5" fill="${c}"/>${t(x + 25, 80, String(n).slice(0, 2), 14, "middle", "#fff", `data-k="${n}"`)}${t(x + 25, 96, String(n).slice(2), 11, "middle", "#fff", "data-drop=\"1\"")}${t(x + 25, 130, String(e), 9)}`;
  }).join("")),
  "sf-warn": wrap([["蓝", BLUE, "一般"], ["黄", YELLOW, "较重"], ["橙", ORANGE, "严重"], ["红", RED, "特别严重"]].map(([n, c, e], i) => {
    const x = 8 + i * 58;
    return `<circle cx="${x + 25}" cy="48" r="24" fill="${c}" stroke="none"/>${t(x + 25, 55, String(n), 20, "middle", i === 1 ? "#333" : "#fff")}${t(x + 25, 94, String(e), 12)}`;
  }).join("") + t(120, 126, "预警颜色：蓝、黄、橙、红，由轻到重", 12)),
  "sf-cpr": wrap(`<path d="M10 118L150 118" stroke="#adb5bd"/><circle cx="30" cy="104" r="9" fill="${FILL}"/><path d="M40 106L112 106M112 106L132 118M112 106L128 96" stroke-width="5"/>`
    + `<path d="M76 62L76 98M62 62L90 62" stroke="${RED}" stroke-width="5"/>${arrow(76, 34, 76, 56, RED)}<path d="M62 62L58 78M90 62L94 78" stroke="${RED}" stroke-width="4"/>`
    + `${t(190, 36, "30 : 2", 24, "middle", RED)}${t(190, 56, "按压 30 次，吹气 2 次", 10)}${t(190, 78, "100–120 次/分", 14, "middle", BLUE)}${t(190, 96, "深约 5–6 厘米（成人）", 10)}${t(120, 142, "先拨 120，再按压；有 AED 立即取来", 11)}`),
  "sf-burn": wrap([["冲", "流水冲"], ["脱", "脱衣物"], ["泡", "冷水泡"], ["盖", "纱布盖"], ["送", "去就医"]].map(([c, s], i) => {
    const x = 26 + i * 47;
    return `<circle cx="${x}" cy="50" r="19" fill="${["#d0ebff", "#ffe8cc", "#c5f6fa", "#e9ecef", "#ffc9c9"][i]}"/>${t(x, 57, c, 20)}${t(x, 90, s, 10)}${i < 4 ? arrow(x + 20, 50, x + 27, 50) : ""}`;
  }).join("") + t(120, 126, "不涂牙膏、酱油，不挑破水泡", 12, "middle", RED)),
  "sf-phones": wrap([["110", "报警", BLUE], ["119", "火警", RED], ["120", "急救", GREEN], ["122", "交通事故", ORANGE]].map(([n, s, c], i) => {
    const x = 8 + (i % 2) * 118, y = 10 + Math.floor(i / 2) * 62;
    return `<rect x="${x}" y="${y}" width="108" height="52" rx="14" fill="${c}" stroke="none"/>${t(x + 54, y + 29, String(n), 26, "middle", "#fff")}${t(x + 54, y + 45, String(s), 12, "middle", "#fff")}`;
  }).join("") + t(120, 142, "青少年心理与权益 12355", 11)),
  "sf-body": wrap(`<circle cx="60" cy="24" r="14" fill="${FILL}"/><path d="M60 38L60 96M60 50L32 80M60 50L88 80M60 96L44 140M60 96L76 140" stroke-width="9" stroke="#e9d8b4"/><rect x="46" y="66" width="28" height="32" rx="6" fill="${RED}" fill-opacity="0.55" stroke="none"/>`
    + `${t(160, 40, "内衣内裤", 15, "middle", RED)}${t(160, 58, "覆盖的地方", 15, "middle", RED)}${t(160, 84, "别人不能碰、不能看", 11)}${t(160, 104, "不舒服就说“不”", 11)}${t(160, 124, "告诉信任的大人", 11, "middle", GREEN)}`),
};
