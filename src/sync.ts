/**
 * Merging two versions of one data file (no screens, no storage): used when changes made WITHOUT network (kept on this device) meet a newer version of
 * the same file in the data repository (another device changed it meanwhile). Nothing the other device added is dropped, nothing made offline is dropped;
 * only a DELETE made on one side can be undone by the other side's copy. The shapes are the ones of this app (weeks of characters / words / topics / cards /
 * idioms, the list of children, the game boxes, the math results with the errors book); anything else: the local version wins.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;
const uniq = <T,>(l: T[]): T[] => [...new Set(l)];
const later = (a?: string, b?: string): string | undefined => (a && b ? (a >= b ? a : b) : a ?? b);

export function mergeDocs(local: Doc, remote: Doc): Doc {
  if (remote === null || remote === undefined) return local;
  if (local === null || local === undefined) return remote;
  if (typeof local !== "object" || typeof remote !== "object" || Array.isArray(local) || Array.isArray(remote)) return local;

  // weeks of characters / words / topics / cards (kids/<id>.json, english/, math/, science/) and of idioms (idioms.json)
  if (Array.isArray(local.weeks) && Array.isArray(remote.weeks)) {
    const by = new Map<string, Doc>();
    for (const w of remote.weeks) by.set(w.start, w);
    for (const w of local.weeks) {
      const r = by.get(w.start);
      if (!r) { by.set(w.start, w); continue; }
      const merged = { ...r, ...w };
      if (w.chars || r.chars) merged.chars = uniq([...(r.chars ?? []), ...(w.chars ?? [])]);
      if (w.items || r.items) merged.items = uniq([...(r.items ?? []), ...(w.items ?? [])]);
      by.set(w.start, merged);
    }
    const out: Doc = { ...remote, ...local, weeks: [...by.values()].sort((x, y) => (x.start < y.start ? -1 : 1)) };
    if (local.stories || remote.stories) out.stories = { ...remote.stories, ...local.stories };
    if (local.pool || remote.pool) out.pool = uniq([...(remote.pool ?? []), ...(local.pool ?? [])]);
    return out;
  }
  // the list of children (kids.json)
  if (Array.isArray(local.kids) && Array.isArray(remote.kids)) {
    const ids = new Set(local.kids.map((k: Doc) => k.id));
    return { ...remote, ...local, kids: [...local.kids, ...remote.kids.filter((k: Doc) => !ids.has(k.id))], startWeek: local.startWeek && remote.startWeek ? (local.startWeek < remote.startWeek ? local.startWeek : remote.startWeek) : local.startWeek ?? remote.startWeek };
  }
  // the game boxes of the characters / words (a card per item)
  if (local.cards && remote.cards && typeof local.cards === "object") {
    const cards: Doc = { ...remote.cards };
    for (const [k, c] of Object.entries<Doc>(local.cards)) cards[k] = !cards[k] || (later(c.last, cards[k].last) === c.last) ? c : cards[k];
    return { ...remote, ...local, cards, plays: Math.max(local.plays ?? 0, remote.plays ?? 0), last: !remote.last || (local.last && local.last.date >= remote.last.date) ? local.last : remote.last };
  }
  // math / science results: counts per topic and the errors book
  if (local.topics && remote.topics && typeof local.topics === "object") {
    const topics: Doc = { ...remote.topics };
    for (const [k, s] of Object.entries<Doc>(local.topics)) topics[k] = !topics[k] || s.right + s.wrong >= topics[k].right + topics[k].wrong ? s : topics[k];
    const seen = new Set<string>();
    const mistakes = [...(local.mistakes ?? []), ...(remote.mistakes ?? [])].filter((m: Doc) => (seen.has(m.q) ? false : (seen.add(m.q), true))).slice(0, 50);
    return { ...remote, ...local, topics, mistakes, plays: Math.max(local.plays ?? 0, remote.plays ?? 0), last: !remote.last || (local.last && local.last.date >= remote.last.date) ? local.last : remote.last };
  }
  return local;
}
