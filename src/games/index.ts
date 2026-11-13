/** the list of games: the order of the cards; every game is its own module loaded when it is first needed */
import type { GameModule } from "./ctx";
export interface GameInfo { id: string; name: string; sub: string; load: () => Promise<GameModule> }
export const GAMES: GameInfo[] = [
  { id: "snake", name: "贪吃蛇", sub: "控制蛇吃苹果，速度逐渐加快", load: () => import("./snake") },
  { id: "tetris", name: "俄罗斯方块", sub: "排满一行即可消除", load: () => import("./tetris") },
  { id: "bubble", name: "泡泡龙", sub: "三个及以上同色泡泡相连即可消除", load: () => import("./bubble") },
  { id: "match3", name: "糖果消消乐", sub: "交换相邻糖果，三个连成一线即可消除", load: () => import("./match3") },
  { id: "klotski", name: "华容道", sub: "十余关，将曹操移到出口", load: () => import("./klotski") },
  { id: "gomoku", name: "五子棋", sub: "先连成五子者获胜", load: () => import("./gomoku") },
  { id: "chess", name: "国际象棋", sub: "国际象棋，含吃子与将军动画", load: () => import("./chess") },
  { id: "xiangqi", name: "中国象棋", sub: "中国象棋，含吃子与将军动画", load: () => import("./xiangqi") },
  { id: "spider", name: "蜘蛛纸牌", sub: "按顺序收齐全部牌，可选一、二或四种花色", load: () => import("./spider") },
  { id: "freecell", name: "空当接龙", sub: "四个空当，几乎每局都有解", load: () => import("./freecell") },
  { id: "g2048", name: "2048", sub: "滑动合并方块，合成 2048", load: () => import("./g2048") },
  { id: "memory", name: "记忆翻牌", sub: "找出相同的动物", load: () => import("./memory") },
  { id: "minesweeper", name: "扫雷", sub: "长按可插旗，避开地雷", load: () => import("./minesweeper") },
  { id: "sokoban", name: "推箱子", sub: "将箱子推到目标位置", load: () => import("./sokoban") },
  { id: "watersort", name: "水排序", sub: "将同色液体倒入同一瓶", load: () => import("./watersort") },
  { id: "game24", name: "算24点", sub: "用四张牌算出 24", load: () => import("./game24") },
  { id: "hanzipuzzle", name: "汉字笔画", sub: "按笔顺拼出汉字", load: () => import("./hanzipuzzle") },
  { id: "spotdiff", name: "找不同", sub: "比较两幅图，找出不同之处", load: () => import("./spotdiff") },
];
