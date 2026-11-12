/*
 * Service worker of the WEB version: keeps the whole app in the browser so that it opens and works without network (after the first visit).
 * Built by vite.config.ts: the build id and the list of every file of the build are filled in below. Only files of this site are handled: the GitHub
 * storage requests, which are to another host, are never touched. The update check (version.json) is not handled here: it always asks the network.
 * Not used in the packaged app (MOBILE=1: the files are inside the app).
 */
const CACHE = "learning-center-__BUILD__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (p) => { try { await c.add(new Request(new URL(p, self.registration.scope), { cache: "reload" })); } catch (_) { /* one missing file must not stop the rest */ } }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("learning-center-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin || u.pathname.endsWith("/version.json")) return;
  e.respondWith(r.mode === "navigate" ? networkFirst(r) : cacheFirst(r));
});

/** the page itself: the newest from the network, the kept copy when there is none */
async function networkFirst(r) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(r);
    if (res.ok) c.put(r, res.clone()).catch(() => {});
    return res;
  } catch (_) {
    return (await c.match(r, { ignoreSearch: true, ignoreVary: true })) || (await c.match(new URL("", self.registration.scope), { ignoreVary: true })) || Response.error();
  }
}
/** everything else (the files have a hash in their name, so a kept copy is never out of date) */
async function cacheFirst(r) {
  const c = await caches.open(CACHE);
  const hit = await c.match(r, { ignoreVary: true });   // (the page asks with an Origin header, the server says "Vary: Origin": the same file all the same)
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok) c.put(r, res.clone()).catch(() => {});
  return res;
}
