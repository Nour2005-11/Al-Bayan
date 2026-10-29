/* منصة البيان — Service Worker للتشغيل دون اتصال */
const CACHE_NAME = 'bayan-pwa-v20';
const APP_SHELL = [
  './',
  './index.html',
  './morning.html',
  './evening.html',
  './sleep.html',
  './short-adhkar.html',
  './prayer-adhkar.html',
  './quran.html',
  './duas.html',
  './about.html',
  './manifest.webmanifest',
  './manus-routes.json',
  './css/style.css',
  './js/main.js',
  './js/home-enhancements.js',
  './js/storage.js',
  './js/dhikr-session.js',
  './js/morning.js',
  './js/evening.js',
  './js/sleep.js',
  './js/duas.js',
  './js/short-adhkar.js',
  './js/prayer-adhkar.js',
  './js/quran.js',
  './js/pwa-install.js',
  './data/daily-reflections.js',
  './data/duas.js',
  './data/morning-adhkar.js',
  './data/evening-adhkar.js',
  './data/sleep-adhkar.js',
  './data/short-adhkar.js',
  './data/prayer-adhkar.js',
  './data/quran-uthmani.txt',
  './data/quran-metadata.xml',
  './data/quran-uthmani.sha256',
  './data/sources-and-licenses.md',
  './assets/images/moadh.jpg',
  './assets/images/momen.jpg',
  './assets/fonts/amiri-italic-400.ttf',
  './assets/fonts/amiri-regular-400.ttf',
  './assets/fonts/amiri-bold-700.ttf',
  './assets/fonts/cairo-regular-400.ttf',
  './assets/fonts/cairo-medium-500.ttf',
  './assets/fonts/cairo-semibold-600.ttf',
  './assets/fonts/cairo-bold-700.ttf',
  './assets/fonts/cairo-extrabold-800.ttf',
  './assets/icons/icon-192-v2.png',
  './assets/icons/icon-512-v2.png',
  './assets/icons/icon-maskable-512-v2.png'
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (url) => {
    const request = new Request(url, { cache: 'reload' });
    const response = await fetch(request);

    if (!response.ok) {
      throw new Error(`تعذر تخزين ملف التطبيق: ${url}`);
    }

    if (response.redirected) {
      const headers = new Headers(response.headers);
      headers.delete('content-encoding');
      headers.delete('content-length');
      const body = await response.blob();
      await cache.put(request, new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
      }));
      return;
    }

    await cache.put(request, response);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      // روابط المصحف قد تحتوي على ?surah و ?ayah؛ ملف الصفحة المخزّن نفسه صالح لها.
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((response) => {
            if (!response || !response.ok) return caches.match('./index.html');

            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
