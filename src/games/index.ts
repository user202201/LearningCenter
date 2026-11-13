/** the list of games: the order of the cards; every game is its own module loaded when it is first needed */
import type { GameModule } from "./ctx";
export interface GameInfo { id: string; name: string; sub: string; load: () => Promise<GameModule> }
export const GAMES: GameInfo[] = [
  { id: "snake", name: "贪吃蛇", sub: "吃苹果，越长越快", load: () => import("./snake") },
  { id: "tetris", name: "俄罗斯方块", sub: "排满一行就消掉", load: () => import("./tetris") },
  { id: "bubble", name: "泡泡龙", sub: "三个同色一起爆", load: () => import("./bubble") },
  { id: "match3", name: "糖果消消乐", sub: "交换糖果，三个连线", load: () => import("./match3") },
  { id: "klotski", name: "华容道", sub: "十几关，帮曹操逃出去", load: () => import("./klotski") },
  { id: "gomoku", name: "五子棋", sub: "五个连成一线就赢", load: () => import("./gomoku") },
  { id: "chess", name: "国际象棋", sub: "可爱棋子，吃子将军有动画", load: () => import("./chess") },
  { id: "xiangqi", name: "中国象棋", sub: "楚河汉界，将军有动画", load: () => import("./xiangqi") },
  { id: "spider", name: "蜘蛛纸牌", sub: "把牌按顺序收完，可选一、二、四种花色", load: () => import("./spider") },
  { id: "freecell", name: "空当接龙", sub: "四个空当，几乎每局都能赢", load: () => import("./freecell") },
  { id: "g2048", name: "2048", sub: "滑动合并，凑出 2048", load: () => import("./g2048") },
  { id: "memory", name: "记忆翻牌", sub: "找出一样的小动物", load: () => import("./memory") },
  { id: "minesweeper", name: "扫雷", sub: "长按插旗，别踩到雷", load: () => import("./minesweeper") },
  { id: "sokoban", name: "推箱子", sub: "把箱子推到目标点", load: () => import("./sokoban") },
  { id: "watersort", name: "水排序", sub: "把颜色倒成同色", load: () => import("./watersort") },
  { id: "game24", name: "算24点", sub: "四张牌凑出 24", load: () => import("./game24") },
  { id: "hanzipuzzle", name: "汉字笔画", sub: "按笔顺把汉字拼出来", load: () => import("./hanzipuzzle") },
  { id: "spotdiff", name: "找不同", sub: "两幅画，找出不一样的地方", load: () => import("./spotdiff") },
];
