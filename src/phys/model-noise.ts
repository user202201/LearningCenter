/** 噪声与回声 (pure): the decibel scale, the three ways of controlling noise, the echo delay and the 0.1 s rule, sounding with ultrasound. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const LIMIT_SLEEP = 50, LIMIT_WORK = 70, LIMIT_EAR = 90;
const EXAMPLES: [number, string][] = [[30, "耳语、树叶的沙沙声"], [50, "安静的房间、图书馆"], [70, "一般交谈、办公室"], [90, "繁忙的街道、嘈杂的车间"], [110, "摇滚音乐会、电锯"], [999, "飞机起飞、近处的雷声"]];
export const example = (L: number) => EXAMPLES.find(([m]) => L <= m)![1];
export const effect = (L: number) => (L <= LIMIT_SLEEP ? "适合休息和睡眠" : L <= LIMIT_WORK ? "适合工作和学习，但会影响休息" : L <= LIMIT_EAR ? "影响工作和学习，长时间会使人烦躁" : "长时间会损害听力");
/** the three ways, each with an example (the sizes of the reductions are illustrative) */
export const MEASURES: [string, number][] = [["在声源处减弱（安装消声器）", 20], ["在传播过程中减弱（设置隔声板）", 15], ["在人耳处减弱（戴防噪声耳罩）", 15]];
export const controlled = (L0: number, on: number[]) => Math.max(0, L0 - on.reduce((a, v, i) => a + v * MEASURES[i][1], 0));
export const MEDIA: [string, number][] = [["空气（15 ℃）", 340], ["水", 1500], ["铁", 5200]];
export const MIN_GAP = 0.1;                         // s: the shortest gap at which the ear hears the echo apart from the sound
export const SEA = 1500;
export const echoDelay = (d: number, v: number) => (2 * d) / v;
export const minDistance = (v: number) => (v * MIN_GAP) / 2;
export const depth = (t: number, v = SEA) => (v * t) / 2;
export function quiz(rng: () => number): Q[] {
  const t = pick(rng, [1, 1.5, 2, 3, 4]), v = pick(rng, [340, 1500]), ts = pick(rng, [2, 4, 6, 8, 10]);
  const way = pick(rng, [
    ["给摩托车装上消声器，属于：", "在声源处减弱噪声", ["在传播过程中减弱噪声", "在人耳处减弱噪声", "不能减弱噪声"]],
    ["在马路两旁设置隔声板，属于：", "在传播过程中减弱噪声", ["在声源处减弱噪声", "在人耳处减弱噪声", "不能减弱噪声"]],
    ["在嘈杂的环境中戴防噪声耳罩，属于：", "在人耳处减弱噪声", ["在声源处减弱噪声", "在传播过程中减弱噪声", "不能减弱噪声"]],
  ] as [string, string, string[]][]);
  const lim = pick(rng, [
    ["为了保护听力，应把噪声控制在不超过：", "90 dB", ["50 dB", "70 dB", "110 dB"]],
    ["为了保证工作和学习，应把噪声控制在不超过：", "70 dB", ["50 dB", "90 dB", "110 dB"]],
    ["为了保证休息和睡眠，应把噪声控制在不超过：", "50 dB", ["30 dB", "70 dB", "90 dB"]],
  ] as [string, string, string[]][]);
  return [
    numQ(rng, "echo", [t], `对着远处的山崖大喊一声，经过 ${t} s 听到回声，声音在空气中的速度取 340 m/s，人到山崖的距离是多少米？`, (340 * t) / 2, "m", 0, "声音传到山崖再传回来，走过的路程是距离的 2 倍：s = vt / 2。"),
    numQ(rng, "mindist", [v], `人耳能把回声和原声区分开，要求两者至少相隔 0.1 s。在声速是 ${v} m/s 的介质中，障碍物到人的距离至少是多少米？`, (v * MIN_GAP) / 2, "m", 1, "最短距离 s = vt / 2，其中 t = 0.1 s。"),
    numQ(rng, "depth", [ts], `海洋探测船向海底发出超声波，经过 ${ts} s 收到回声，声音在海水中的速度取 1500 m/s，海水的深度是多少米？`, (SEA * ts) / 2, "m", 0, "超声波往返的路程是深度的 2 倍：s = vt / 2。"),
    makeQ(rng, "ways", [], way[0], way[1], way[2], "控制噪声有三条途径：在声源处、在传播过程中、在人耳处。"),
    makeQ(rng, "limit", [], lim[0], lim[1], lim[2], "保护听力不超过 90 dB，保证工作学习不超过 70 dB，保证休息睡眠不超过 50 dB。"),
  ];
}
