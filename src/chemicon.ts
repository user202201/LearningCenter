import { h } from "./ui";
import { chemIcon } from "./chemfig";
/** the cartoon flask of the science home card (the drawing is in chemfig.ts, which is loaded with the chemistry page only: this small module holds just the icon) */
export const chemIconEl = (): HTMLElement => { const s = h("span", { class: "sci-ico" }); s.innerHTML = chemIcon(); return s; };
