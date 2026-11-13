/** The biology lab's kit: the physics lab's `mountSim` (sliders, readouts, tasks, quiz) with the biology lab's own store (`learn.bio.v1`) and test handle (`window.__bio`). */
import { mountSim, loadSaved as loadPhys, type SimDef, type PhysCtx } from "../phys/kit";
export * from "../phys/kit";
export const BIO_KEY = "learn.bio.v1";
export const loadSaved = () => loadPhys(BIO_KEY);
export const mountBio = (def: SimDef, root: HTMLElement, ctx: PhysCtx) => mountSim({ ...def, storeKey: BIO_KEY, handle: "__bio" }, root, ctx);
export const yesNo = (v: boolean) => (v ? "是" : "否");
