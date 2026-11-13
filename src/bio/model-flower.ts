/** 花与果实 (pure): pollination, fertilisation and the development of fruit and seeds. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const STAGES = ["花的结构", "传粉", "花粉管伸长", "受精", "花凋谢，子房膨大", "果实和种子"];
/** every pollen grain's tube fertilises one ovule; without pollination nothing is fertilised */
export const fertilised = (ov: number, pollen: number, pol: number) => (pol ? Math.min(pollen, ov) : 0);
export const seeds = fertilised;
export const fruitForms = (ov: number, pollen: number, pol: number) => fertilised(ov, pollen, pol) >= 1;
export const DEV: [string, string][] = [["子房", "果实"], ["胚珠", "种子"], ["受精卵", "胚"], ["子房壁", "果皮"], ["珠被", "种皮"]];
export function quiz(rng: () => number): Q[] {
  const ov = pick(rng, [2, 3, 4, 5, 6]), pollen = pick(rng, [1, 2, 3, 4, 8]);
  const n = pick(rng, [2, 3, 4, 5, 6]);
  const d = pick(rng, DEV);
  const defs: [string, string][] = [["传粉", "花粉从花药落到柱头上"], ["受精", "精子与卵细胞结合形成受精卵"]];
  const df = pick(rng, defs);
  return [
    numQ(rng, "seeds", [ov, pollen], `一朵花的子房中有 ${ov} 个胚珠，有 ${pollen} 粒花粉落到柱头上并各自萌发花粉管（已传粉）。这朵花最多结出几粒种子？`, Math.min(ov, pollen), "粒", 0, "每个胚珠需要一个花粉管到达，才能受精发育成种子。"),
    numQ(rng, "need", [n], `一个子房里有 ${n} 个胚珠，要使它们全部发育成种子，至少需要几粒花粉萌发？`, n, "粒", 0, "一个胚珠受精需要一个花粉管。"),
    makeQ(rng, "develops", [DEV.indexOf(d)], `花经过传粉和受精后，${d[0]}发育成：`, d[1], DEV.map((x) => x[1]).filter((x) => x !== d[1]), "子房 → 果实；胚珠 → 种子；受精卵 → 胚；子房壁 → 果皮；珠被 → 种皮。"),
    makeQ(rng, "def", [defs.indexOf(df)], `下面哪一项是“${df[0]}”的意思？`, df[1], shuffle(rng, defs.map((x) => x[1]).filter((x) => x !== df[1]).concat(["种子萌发形成幼苗", "花瓣凋落", "果实成熟"])), "传粉在先，受精在后。"),
    makeQ(rng, "order", [], "下列顺序正确的是：", "开花 → 传粉 → 受精 → 果实和种子形成", ["开花 → 受精 → 传粉 → 果实和种子形成", "传粉 → 开花 → 受精 → 果实和种子形成", "受精 → 开花 → 传粉 → 果实和种子形成"], "先传粉，再受精。"),
  ];
}
