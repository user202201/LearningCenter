/**
 * What a game of the games subject gets from the shell (`src/gameshub.ts`): the app's own helpers, sounds that obey the mute switch, a small per-game store on this
 * device, and a way back. A game is a module in `src/games/<id>.ts` with `export const ICON` (an SVG string, viewBox 0 0 120 120, a cartoon picture for the card)
 * and `export default function mount(root, ctx): () => void` that builds its screen inside `root` and returns a function that stops everything (timers, listeners).
 */
import { h, toast } from "../ui";
export { h, toast };

export type SfxKind = "tap" | "move" | "good" | "bad" | "win" | "lose" | "pop" | "drop" | "line" | "capture" | "check" | "place" | "eat" | "rotate" | "swap";
export interface GameCtx {
  id: string;
  h: typeof h;
  toast: typeof toast;
  /** a short cartoon sound (nothing when the sound is switched off); made in code */
  sfx(kind: SfxKind): void;
  /** this game's own little store on this device (best scores, the level reached ...): JSON values, never sent anywhere */
  store: { get<T>(key: string, def: T): T; set(key: string, value: unknown): void };
  /** back to the list of games */
  exit(): void;
}
export interface GameModule { ICON: string; default: (root: HTMLElement, ctx: GameCtx) => () => void }
