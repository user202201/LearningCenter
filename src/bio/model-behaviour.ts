/** 动物的行为 (pure): innate, learned and social behaviour, and a learning curve (errors fall with the number of trials, faster in animals with a more developed brain). */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const CLASSES = ["先天性行为", "学习行为", "社会行为"];
/** [behaviour, class index] */
export const ITEMS: [string, number][] = [["蜘蛛结网", 0], ["母鸡孵卵", 0], ["蜜蜂采蜜", 0], ["黑猩猩用树枝钓白蚁", 1], ["小狗算算术", 1], ["鹦鹉学舌", 1], ["蚂蚁分工合作", 2], ["狒狒的首领与等级", 2], ["蜜蜂跳舞传递信息", 2], ["大山雀偷喝牛奶", 1]];
export const ANIMALS: [string, number][] = [["蚯蚓", 0.01], ["小鼠", 0.05], ["黑猩猩", 0.2]];
/** error rate (%) after n trials */
export const errors = (n: number, k: number) => 5 + 95 * Math.exp(-k * n);
/** trials until the error rate is below `limit` % */
export const trialsTo = (k: number, limit: number) => Math.ceil(Math.log(95 / (limit - 5)) / k);
export function quiz(rng: () => number): Q[] {
  const it = pick(rng, ITEMS), a = pick(rng, [0, 1, 2]), n = pick(rng, [10, 20, 40, 80]), lim = pick(rng, [20, 30, 50]);
  const it2 = pick(rng, ITEMS.filter((x) => x !== it));
  return [
    makeQ(rng, "class", [ITEMS.indexOf(it)], `“${it[0]}”属于：`, CLASSES[it[1]], CLASSES.concat(["繁殖行为"]).filter((x) => x !== CLASSES[it[1]]), "先天性行为生来就有，学习行为是后天通过生活经验和学习获得的，社会行为的群体内有明确分工或等级。"),
    makeQ(rng, "class2", [ITEMS.indexOf(it2)], `“${it2[0]}”属于：`, CLASSES[it2[1]], CLASSES.concat(["繁殖行为"]).filter((x) => x !== CLASSES[it2[1]]), "判断行为是否由遗传物质决定。"),
    numQ(rng, "err", [a, n], `按模型，错误率 = 5 + 95 × e^(−k n)（%）。${ANIMALS[a][0]}的 k = ${ANIMALS[a][1]}，练习 ${n} 次后错误率约是多少？`, errors(n, ANIMALS[a][1]), "%", 0, "学习能力强的动物，错误率下降得更快。"),
    numQ(rng, "trials", [a, lim], `${ANIMALS[a][0]}的 k = ${ANIMALS[a][1]}，错误率降到 ${lim} % 以下至少需要练习几次？`, trialsTo(ANIMALS[a][1], lim), "次", 0, "解 5 + 95 e^(−k n) < 限值，向上取整。"),
    makeQ(rng, "brain", [], "动物越高等，学习能力越强，原因是：", "神经系统和大脑越发达，学习行为越复杂", ["体形越大", "寿命越长", "皮肤越厚", "运动越快"], "学习行为需要大脑皮层的参与。"),
  ];
}
