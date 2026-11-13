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
];
