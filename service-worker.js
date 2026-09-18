// Service worker: تخزين موارد الموقع الثابتة مؤقتاً مع تحديث آمن ودعم محدود للعمل دون إنترنت.
const CACHE_PREFIX = 'wadmadani-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/img/favicon.ico',
  '/img/apple-touch-icon.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/logo-icon.png',
  '/img/hero-banner.webp'
];

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

// لا نعترض طلبات Firebase أو أي API/نطاق خارجي، ولا نخزن إلا موارد الموقع الثابتة.
function isCacheableRequest(request) {
  if (request.method !== 'GET' || !isSameOrigin(request)) return false;
  return ['document', 'script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
}

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  // لا نفشل عملية تثبيت العامل بالكامل إذا كان ملف اختياري غير موجود.
  await Promise.all(CORE_ASSETS.map(asset => cache.add(asset).catch(() => undefined)));
}

self.addEventListener('install', event => {
  event.waitUntil(cacheCoreAssets().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy))
            .catch(() => undefined)
        );
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await caches.match('/index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    })
  );
});
