/** 神经调节 (pure): the reflex arc (latency from the nerve lengths and speed) and the ruler-drop reaction time. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const SYN = 1, EFFECTOR = 10;   // ms per synapse, ms for the muscle to start
export interface Site { name: string; din: number; dout: number; syn: number; central: number; kind: string }
export const SITES: Site[] = [
  { name: "膝跳反射", din: 0.45, dout: 0.45, syn: 1, central: 0, kind: "非条件反射" },
  { name: "缩手反射", din: 0.6, dout: 0.6, syn: 2, central: 0, kind: "非条件反射" },
  { name: "看见红灯后刹车", din: 0.3, dout: 1.2, syn: 6, central: 150, kind: "条件反射" },
];
/** the latency in ms: conduction + synapses + central processing + the effector */
export const latency = (din: number, dout: number, v: number, syn: number, central = 0) => ((din + dout) / v) * 1000 + syn * SYN + central + EFFECTOR;
export const siteLatency = (site: number, v: number) => { const x = SITES[site]; return latency(x.din, x.dout, v, x.syn, x.central); };
export const PARTS = ["感受器", "传入神经", "神经中枢", "传出神经", "效应器"];
/** a response happens only when every part of the arc is intact (cut = 0 none, 1..5 = that part) */
export const responds = (cut: number) => cut === 0;
export const G = 9.8;
export const reaction = (dcm: number) => Math.sqrt((2 * (dcm / 100)) / G) * 1000;   // ms
export const rtText = (ms: number) => (ms < 150 ? "很快" : ms < 250 ? "正常" : "较慢");
export const EXAMPLES: [string, string][] = [["膝跳反射", "非条件反射"], ["缩手反射", "非条件反射"], ["眨眼反射", "非条件反射"], ["吃到酸梅分泌唾液", "非条件反射"], ["望梅止渴", "条件反射"], ["谈虎色变", "条件反射"], ["看见红灯停车", "条件反射"]];
export function quiz(rng: () => number): Q[] {
  const din = pick(rng, [0.3, 0.45, 0.6]), dout = pick(rng, [0.3, 0.45, 0.6, 0.9]), v = pick(rng, [30, 50, 60, 75, 100]), syn = pick(rng, [1, 2, 3]);
  const d = pick(rng, [5, 10, 15, 20, 25, 30]);
  const cut = pick(rng, [1, 2, 3, 4, 5]);
  const ex = pick(rng, EXAMPLES);
  return [
    numQ(rng, "latency", [din, dout, v, syn], `反射弧的传入神经长 ${din} m，传出神经长 ${dout} m，传导速度为 ${v} m/s，经过 ${syn} 个突触（每个延搁 1 ms），效应器需 10 ms 开始反应。从刺激到反应约需多少毫秒？`, latency(din, dout, v, syn), "ms", 1, "时间 = 路程 / 速度 + 突触延搁 + 效应器反应时间。"),
    numQ(rng, "rt", [d], `用尺子测反应时间：尺子从静止下落，被抓住时下落了 ${d} cm（g = 9.8 m/s²）。反应时间约是多少毫秒？`, reaction(d), "ms", 0, "d = ½ g t²，所以 t = √(2d/g)。"),
    makeQ(rng, "cut", [cut], `某人反射弧的“${PARTS[cut - 1]}”受到损伤，其他部分正常，刺激感受器后，反射还能发生吗？`, "不能，反射弧必须完整", shuffle(rng, ["能，但反应变慢", "能，反应完全正常", "只能发生一半"]), "反射弧由感受器、传入神经、神经中枢、传出神经、效应器组成，缺一不可。"),
    makeQ(rng, "first", [], "反射弧的第一个环节是：", "感受器", ["神经中枢", "效应器", "传出神经"], "感受器接受刺激并产生神经冲动。"),
    makeQ(rng, "reflex", [EXAMPLES.indexOf(ex)], `“${ex[0]}”属于：`, ex[1], ["条件反射", "非条件反射"].filter((x) => x !== ex[1]).concat(["激素调节", "免疫反应"]), "条件反射是后天学习获得的，需要大脑皮层参与。"),
  ];
}
