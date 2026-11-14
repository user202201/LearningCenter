/**
 * Physics diagrams drawn in code (inline SVG, nothing from outside): the symbols of a circuit, the basic circuit diagrams and the three rules of electromagnetism
 * (the right-hand screw rule, the left-hand rule, the right-hand rule). The only texts inside the pictures are Latin letters (A, V, M, N, S, I, F, B, v, L1 ...);
 * the Chinese explanations are in the page that shows them (translated there).
 */
const INK = "#2d2230", BLUE = "#1c7ed6", RED = "#e03131", GREEN = "#2f9e44", ORANGE = "#f76707", SKIN = "#ffd8a8";
const line = (d: string, extra = "") => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${INK}"/>`;
const label = (x: number, y: number, t: string, size = 15, color = INK, anchor = "middle") => `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" font-family="ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" text-anchor="${anchor}" fill="${color}">${t}</text>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, w = 3, dash = "") => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 9;
  const p1 = [x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)], p2 = [x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)];
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""} fill="none"/><path d="M${x2} ${y2}L${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}Z" fill="${color}"/>`;
};
const svg = (w: number, h: number, inner: string, shift = 0) => `<svg viewBox="0 0 ${w} ${h + shift}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${shift ? `<g transform="translate(0 ${shift})">${inner}</g>` : inner}</svg>`;

// ---------------------------------------------------------------- the symbols (each in an 84 x 56 box, horizontal)
const S = (inner: string) => svg(84, 56, inner);
export const SYMBOLS: { name: string; svg: string }[] = [
  { name: "电池", svg: S(line("M2 28H34M34 10V46M46 18V38M46 28H82") + `<path d="M46 18V38" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` + label(26, 12, "+", 14, RED)) },
  { name: "电池组", svg: S(line("M2 28H18M18 12V44M28 20V36M28 28H44M44 12V44M54 20V36M54 28H82") + `<path d="M28 20V36M54 20V36" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`) },
  { name: "开关（断开）", svg: S(line("M2 28H20M64 28H82M24 28L58 8") + dot(22, 28) + dot(62, 28)) },
  { name: "开关（闭合）", svg: S(line("M2 28H82") + dot(22, 28) + dot(62, 28)) },
  { name: "灯泡", svg: S(line("M2 28H27M57 28H82") + `<circle cx="42" cy="28" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line("M31.500 17.500L52.500 38.500M52.500 17.500L31.500 38.500")) },
  { name: "定值电阻", svg: S(line("M2 28H26M58 28H82") + `<rect x="26" y="20" width="32" height="16" rx="1" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`) },
  { name: "滑动变阻器", svg: S(line("M2 28H26M58 28H82") + `<rect x="26" y="22" width="32" height="14" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + line("M14 8H42V20") + `<path d="M42 21L37 14M42 21L47 14" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`) },
  { name: "电流表", svg: S(line("M2 28H27M57 28H82") + `<circle cx="42" cy="28" r="15" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + label(42, 34, "A", 18, BLUE)) },
  { name: "电压表", svg: S(line("M2 28H27M57 28H82") + `<circle cx="42" cy="28" r="15" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + label(42, 34, "V", 18, GREEN)) },
  { name: "电动机", svg: S(line("M2 28H27M57 28H82") + `<circle cx="42" cy="28" r="15" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + label(42, 34, "M", 18, ORANGE)) },
  { name: "导线相连（连接点）", svg: S(line("M2 28H82M42 4V28") + dot(42, 28)) },
  { name: "导线交叉（不相连）", svg: S(line("M2 28H82M42 4V52")) },
];

// ---------------------------------------------------------------- the circuit diagrams
const W = 300, H = 150, TOP = 30, BOT = 120, LEFT = 30;
/** a battery on the left edge: wires up and down, long plate (+) on top */
const batteryLeft = () => line(`M${LEFT} ${TOP}V65M${LEFT} 82V${BOT}`) + line(`M${LEFT - 12} 65H${LEFT + 12}`) + `<path d="M${LEFT - 7} 74H${LEFT + 7}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` + label(LEFT - 20, 64, "+", 15, RED, "end");
export const CIRCUITS: { title: string; svg: string; notes: string[] }[] = [
  {
    title: "简单电路",
    svg: svg(W, H, batteryLeft() + line(`M${LEFT} ${TOP}H80M130 ${TOP}H230V60M230 90V${BOT}H${LEFT}`) + `<path d="M80 ${TOP}L122 ${TOP - 18}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` + dot(80, TOP) + dot(130, TOP) + label(105, TOP - 26, "S", 13)
      + `<circle cx="230" cy="75" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line("M219.500 64.500L240.500 85.500M240.500 64.500L219.500 85.500") + label(252, 80, "L", 13, INK, "start") + arrow(150, TOP - 8, 190, TOP - 8, BLUE) + label(170, TOP - 14, "I", 13, BLUE), 18),
    notes: ["组成：电源、开关、用电器（灯泡）和导线。", "电流从电源正极出发，经过用电器，回到电源负极。", "开关闭合，电路是通路，灯亮；开关断开，电路是断路，灯不亮。", "用导线直接连接电源两端，叫短路，会烧坏电源，千万不能这样做。"],
  },
  {
    title: "串联电路",
    svg: svg(W, H, batteryLeft() + line(`M${LEFT} ${TOP}H60M100 ${TOP}H130M170 ${TOP}H230V${BOT}H170M130 ${BOT}H${LEFT}`) + `<path d="M60 ${TOP}L92 ${TOP - 18}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` + dot(60, TOP) + dot(100, TOP) + label(80, TOP - 26, "S", 13)
      + `<circle cx="150" cy="${TOP}" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line(`M139.500 ${TOP - 10.5}L160.500 ${TOP + 10.5}M160.500 ${TOP - 10.5}L139.500 ${TOP + 10.5}`) + label(150, TOP - 22, "L1", 13)
      + `<circle cx="150" cy="${BOT}" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line(`M139.500 ${BOT - 10.5}L160.500 ${BOT + 10.5}M160.500 ${BOT - 10.5}L139.500 ${BOT + 10.5}`) + label(150, BOT + 30, "L2", 13), 18),
    notes: ["用电器首尾依次相连，电流只有一条路径。", "电流处处相等：I = I₁ = I₂。", "总电压等于各部分电压之和：U = U₁ + U₂。", "一个灯坏了（断路），另一个灯也不会亮；开关控制整个电路。"],
  },
  {
    title: "并联电路",
    svg: svg(W, H, batteryLeft() + line(`M${LEFT} ${TOP}H60M100 ${TOP}H210M210 ${TOP}V45M210 105V${BOT}H${LEFT}M120 ${TOP}V45M120 105V${BOT}`) + `<path d="M60 ${TOP}L92 ${TOP - 18}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` + dot(60, TOP) + dot(100, TOP) + label(80, TOP - 26, "S", 13)
      + dot(120, TOP) + dot(120, BOT) + `<circle cx="120" cy="75" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line("M109.500 64.500L130.500 85.500M130.500 64.500L109.500 85.500") + label(142, 80, "L1", 13, INK, "start")
      + `<circle cx="210" cy="75" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line("M199.500 64.500L220.500 85.500M220.500 64.500L199.500 85.500") + label(232, 80, "L2", 13, INK, "start"), 18),
    notes: ["用电器并列地接在电路两点之间，电流有两条（或更多）路径。", "干路电流等于各支路电流之和：I = I₁ + I₂。", "各支路两端的电压相等：U = U₁ = U₂。", "一条支路断开，其他支路仍能工作；家里的用电器都是并联的。"],
  },
  {
    title: "电流表和电压表的接法",
    svg: svg(W, H, batteryLeft() + line(`M${LEFT} ${TOP}H70M104 ${TOP}H170M200 ${TOP}H260V${BOT}H${LEFT}M200 ${TOP}V60M200 90V${BOT}`) + dot(200, TOP) + dot(200, BOT)
      + `<circle cx="87" cy="${TOP}" r="15" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + label(87, TOP + 6, "A", 17, BLUE)
      + `<circle cx="200" cy="75" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line("M189.500 64.500L210.500 85.500M210.500 64.500L189.500 85.500")
      + line(`M200 ${TOP}H235M235 ${TOP}V57M235 93V${BOT}H200`) + dot(235, TOP) + `<circle cx="235" cy="75" r="16" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + label(235, 81, "V", 17, GREEN) + line(`M235 ${TOP}H260`), 18),
    notes: ["电流表（A）要串联在被测电路中，电流从“+”接线柱流入、“−”接线柱流出。", "电压表（V）要并联在被测用电器两端。", "电流表的电阻很小，绝对不能直接接在电源两端（会短路）。", "不知道被测值大小时，先用大量程试触，再选合适的量程。"],
  },
  {
    title: "用滑动变阻器调节灯的亮度",
    svg: svg(W, H, batteryLeft() + line(`M${LEFT} ${TOP}H70M150 ${TOP}H230V60M230 90V${BOT}H${LEFT}`) + `<rect x="70" y="${TOP - 8}" width="80" height="16" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` + line(`M90 ${TOP - 26}H110V${TOP - 9}`) + `<path d="M110 ${TOP - 8}L105 ${TOP - 15}M110 ${TOP - 8}L115 ${TOP - 15}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
      + `<circle cx="230" cy="75" r="15" fill="#fff8db" stroke="${INK}" stroke-width="2.6"/>` + line("M219.500 64.500L240.500 85.500M240.500 64.500L219.500 85.500") + label(252, 80, "L", 13, INK, "start") + label(110, TOP + 30, "R", 14), 18),
    notes: ["滑动变阻器要和被控制的灯串联，接线要“一上一下”。", "滑片移动，改变接入电路的电阻丝的长度，从而改变电阻和电流。", "接入的电阻变大，电流变小，灯变暗；闭合开关前，滑片要放在阻值最大处，保护电路。"],
  },
];

// ---------------------------------------------------------------- the three rules of electromagnetism
/** a stylised hand seen from the palm side, fingers to the right, thumb up */
const hand = () =>
  `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round">`
  + `<rect x="68" y="72" width="74" height="62" rx="14" fill="${SKIN}"/>`
  + [74, 89, 104, 119].map((y, i) => `<rect x="${140}" y="${y}" width="${[58, 66, 62, 50][i]}" height="12" rx="6" fill="${SKIN}"/>`).join("")
  + `<rect x="78" y="26" width="16" height="56" rx="8" fill="${SKIN}" transform="rotate(-8 86 80)"/>`
  + `</g>`;
/** the same hand seen from the palm side, mirrored: a RIGHT hand with the fingers to the left, thumb up (the drawing above is a LEFT hand: palm to the viewer, fingers right, thumb up) */
const handRight = () => `<g transform="translate(300 0) scale(-1 1)">${hand()}</g>`;
/** B pointing INTO the page (the palm faces the viewer, so the field lines enter it): crossed circles, as in a school figure */
const into = (pts: [number, number][]) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${GREEN}" stroke-width="2.2"/><path d="M${x - 6.4} ${y - 6.4}L${x + 6.4} ${y + 6.4}M${x + 6.4} ${y - 6.4}L${x - 6.4} ${y + 6.4}" stroke="${GREEN}" stroke-width="2.2" stroke-linecap="round"/>`).join("");
export const RULES: { title: string; svg: string; steps: string[]; note: string }[] = [
  {
    title: "安培定则（右手螺旋定则）",
    svg: svg(300, 170,
      [60, 85, 110, 135, 160, 185, 210].map((x) => `<ellipse cx="${x}" cy="88" rx="11" ry="30" fill="none" stroke="#868e96" stroke-width="3"/><path d="M${x} 58 A11 30 0 0 1 ${x} 118" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join("")
      + line("M60 118H30V150H270V118H210") + `<path d="M30 118V150" stroke="${INK}" stroke-width="2.6"/>`
      + [90, 140, 190].map((x) => arrow(x, 112, x, 92, BLUE, 2.5)).join("")
      + arrow(215, 88, 285, 88, RED, 5) + label(272, 76, "N", 20, RED) + label(40, 76, "S", 20, BLUE)
      + `<path d="M70 52C100 20 190 20 220 52" fill="none" stroke="${ORANGE}" stroke-width="7" stroke-linecap="round" opacity=".55"/><path d="M214 40l12 13-17 4z" fill="${ORANGE}" opacity=".7"/>`),
    steps: ["用右手握住通电螺线管。", "让四指弯曲的方向和螺线管中的电流方向一致。", "大拇指所指的那一端就是螺线管的 N 极。"],
    note: "改变电流方向，N 极和 S 极也会互换；电流越大、线圈匝数越多，磁性越强。",
  },
  {
    title: "左手定则（磁场对通电导体的作用力）",
    svg: svg(300, 170,
      into([[26, 36], [26, 150], [126, 156], [274, 36], [274, 150]]) + hand()
      + arrow(150, 100, 270, 100, BLUE, 4.5) + arrow(84, 64, 84, 12, RED, 4.5)
      + label(46, 42, "B", 18, GREEN, "start") + label(272, 88, "I", 18, BLUE) + label(98, 20, "F", 18, RED)),
    steps: ["伸出左手，让磁感线（B，图中 ⊗ 表示垂直指向纸面里）垂直穿过手心。", "四指指向电流（I）的方向。", "大拇指所指的方向，就是通电导体受到的力（F）的方向。"],
    note: "电动机的工作原理：通电线圈在磁场中受力转动。电流方向或磁场方向改变，受力方向也随之改变。",
  },
  {
    title: "右手定则（电磁感应）",
    svg: svg(300, 170,
      into([[274, 36], [274, 150], [174, 156], [26, 36], [26, 150]]) + handRight()
      + arrow(150, 100, 30, 100, BLUE, 4.5) + arrow(216, 64, 216, 12, ORANGE, 4.5)
      + label(254, 42, "B", 18, GREEN, "end") + label(28, 88, "I", 18, BLUE) + label(202, 20, "v", 18, ORANGE)),
    steps: ["伸出右手，让磁感线（B，图中 ⊗ 表示垂直指向纸面里）垂直穿过手心。", "大拇指指向导体运动的方向（v）。", "四指所指的方向，就是导体中感应电流（I）的方向。"],
    note: "发电机的工作原理：闭合电路的一部分导体在磁场中做切割磁感线运动，就会产生感应电流（电磁感应）。",
  },
];
