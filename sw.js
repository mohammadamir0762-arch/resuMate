self.__RESUMATE_PRECACHE__ = {"version":"f3114e18c61a","urls":["./","./assets/index-67INsVol.css","./assets/index-uwo3HH43.js","./assets/pdfWorker-BGmHyZuu.js","./icon.svg","./index.html","./manifest.webmanifest"]};

// Service worker for offline use. It is not bundled by Vite: at build time,
// vite.config.js puts this file in dist/sw.js and adds the list of files to cache
// as self.__RESUMATE_PRECACHE__ above this code.

const { version, urls } = self.__RESUMATE_PRECACHE__ ?? { version: 'dev', urls: [] };
const CACHE_NAME = `resumate-${version}`;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
// Some servers send "Vary: Origin", and module scripts are requested with an Origin
// header, so a strict lookup would miss files we cached ourselves.
const MATCH_OPTIONS = { ignoreVary: true };

// No skipWaiting(): a new version waits until old tabs close, so an open page
// never loses the files it was built with.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urls)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('resumate-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache first: every file has a content hash in its name, and a new build
// ships a new service worker that replaces the old cache.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match(INDEX_URL, MATCH_OPTIONS).then((cached) => cached ?? fetch(request)));
    return;
  }

  event.respondWith(
    caches.match(request, MATCH_OPTIONS).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
