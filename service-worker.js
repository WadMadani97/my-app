/* دليلك بود مدني - Service Worker for GitHub Pages */
// v2: تم استثناء ملفات data/*.json من التخزين المؤقت لأنها تُحدَّث دورياً
// عبر GitHub Actions (تصدير Firestore)، ولازم تُقرأ دايماً من الشبكة مباشرة.
const CACHE_NAME = 'dalil-wad-madani-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './img/favicon.ico',
  './img/apple-touch-icon.png',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/logo-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      // يحذف أي كاش قديم (بما فيه أي نسخ سابقة من data/*.json كانت مخزّنة بالغلط بإصدار سابق)
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Do not cache Firebase, Google Fonts, or other cross-origin requests.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)).catch(() => {});
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // ملفات البيانات الديناميكية (المُصدَّرة من Firestore): دايماً من الشبكة مباشرة، بدون تخزين مؤقت إطلاقاً.
  // لو الشبكة فشلت (بدون إنترنت)، نرجع لآخر نسخة كانت اتخزنت (احتياطي فقط، مو المسار الطبيعي).
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for local static assets. New versions are picked up after SW update.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
