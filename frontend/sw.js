const APP_CACHE = "pmq-app-v1";
const APP_FILES = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
