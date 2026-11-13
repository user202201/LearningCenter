import type { GameCtx } from "./ctx";
export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="14" width="92" height="92" rx="22" fill="#ffa94d"/><text x="60" y="76" font-size="40" font-weight="900" text-anchor="middle" fill="#fff">KL</text></svg>`;
export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  root.append(ctx.h("p", { class: "muted center" }, "华容道：马上就好。"));
  return () => {};
}
