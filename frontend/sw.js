const APP_CACHE = "pmq-app-v6";
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./vect-own/index.html",
  "./vect-own/dashboard.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => key === APP_CACHE ? Promise.resolve() : caches.delete(key)));
    await self.clients.claim();
  })());
});

// Handle Web Share Target POST and redirect to app with query param.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const sharedUrl = formData.get("url") || formData.get("text") || "";
      const target = new URL("./", self.location.origin);
      if (sharedUrl) target.searchParams.set("shared_url", String(sharedUrl));

      return Response.redirect(target.toString(), 303);
    })());
    return;
  }

  const isDocumentRequest =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html") ||
    url.pathname.endsWith(".html");

  if (isDocumentRequest) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        return fresh;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match("./index.html");
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch {
      return caches.match("./index.html");
    }
  })());
});
