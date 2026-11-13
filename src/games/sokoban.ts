import type { GameCtx } from "./ctx";
export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="14" width="92" height="92" rx="20" fill="#ddd"/></svg>`;
export default function mount(root: HTMLElement, _ctx: GameCtx): () => void { root.textContent = "..."; return () => {}; }
