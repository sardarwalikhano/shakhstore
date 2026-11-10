const CACHE_NAME = "shakh-store-static-v2";
const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("shakh-store-") && key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Cache only public shell assets. Never cache authenticated pages, dashboards,
// API responses, or user-specific notification content.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") ||
      url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/notifications")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
        }
        return response;
      }).catch(async () => (await caches.match("/")) || caches.match("/offline.html"))
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.slice(0, 120)
    : "SHAKH STORE";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 300) : "ئاگادارکردنەوەیەکی نوێت هەیە.";
  const target = typeof payload.url === "string" ? payload.url : "/notifications";
  const safeUrl = target.startsWith("/") && !target.startsWith("//") ? target : "/notifications";

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "shakh-notification",
    data: { url: safeUrl },
    dir: "rtl",
    lang: "ckb",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && typeof event.notification.data.url === "string"
    ? event.notification.data.url
    : "/notifications";
  const destination = new URL(target, self.location.origin);
  if (destination.origin !== self.location.origin) destination.href = new URL("/notifications", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(destination.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination.href);
  })());
});
