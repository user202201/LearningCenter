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

  // weeks of characters / words / topics / cards (kids/<id>.json, english/, french/, math/, science/) and of idioms (idioms.json)
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
  // the results of dictations (dictation/<kid>.json, english/ french/ <kid>.dictation.json): sessions by id, the newest first, at most 60
  if (Array.isArray(local.sessions) && Array.isArray(remote.sessions)) {
    const by = new Map<string, Doc>();
    for (const x of [...remote.sessions, ...local.sessions]) by.set(x.id, x);
    return { ...remote, ...local, sessions: [...by.values()].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0)).slice(0, 60) };
  }
  // the finger writing progress (write/<kid>.json): per character the best stars, the larger count, the later day
  if (local.written && remote.written && typeof local.written === "object" && typeof remote.written === "object") {
    const written: Doc = { ...remote.written };
    for (const [c, w] of Object.entries<Doc>(local.written)) {
      const r = written[c];
      written[c] = r ? { stars: Math.max(w.stars ?? 0, r.stars ?? 0), n: Math.max(w.n ?? 0, r.n ?? 0), last: later(w.last, r.last) } : w;
    }
    return { ...remote, ...local, written };
  }
  // the list of children (kids.json)
  if (Array.isArray(local.kids) && Array.isArray(remote.kids)) {
    const ids = new Set(local.kids.map((k: Doc) => k.id));
    return { ...remote, ...local, kids: [...local.kids, ...remote.kids.filter((k: Doc) => !ids.has(k.id))], startWeek: local.startWeek && remote.startWeek ? (local.startWeek < remote.startWeek ? local.startWeek : remote.startWeek) : local.startWeek ?? remote.startWeek };
  }
  // the game boxes of the characters / words / knowledge cards (a card per item) and, in math / science results, the counts per topic and the errors book
  if ((local.cards && remote.cards && typeof local.cards === "object") || (local.topics && remote.topics && typeof local.topics === "object")) {
    const out: Doc = { ...remote, ...local, plays: Math.max(local.plays ?? 0, remote.plays ?? 0), last: !remote.last || (local.last && local.last.date >= remote.last.date) ? local.last : remote.last };
    if (local.cards && remote.cards) {
      const cards: Doc = { ...remote.cards };
      for (const [k, c] of Object.entries<Doc>(local.cards)) cards[k] = !cards[k] || (later(c.last, cards[k].last) === c.last) ? c : cards[k];
      out.cards = cards;
    }
    if (local.topics && remote.topics) {
      const topics: Doc = { ...remote.topics };
      for (const [k, s] of Object.entries<Doc>(local.topics)) topics[k] = !topics[k] || s.right + s.wrong >= topics[k].right + topics[k].wrong ? s : topics[k];
      const seen = new Set<string>();
      out.topics = topics;
      out.mistakes = [...(local.mistakes ?? []), ...(remote.mistakes ?? [])].filter((m: Doc) => { const key = `${m.q}\u0000${m.fig ?? ""}`; return seen.has(key) ? false : (seen.add(key), true); }).slice(0, 50);
    }
    return out;
  }
  return local;
}
