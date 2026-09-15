// Service worker: يخزن الصفحة الأساسية مؤقتاً ليعمل الموقع (بشكل محدود) بدون إنترنت
// ملاحظة مهمة: غيّر رقم الإصدار (v2, v3, ...) في كل مرة تحدّث فيها index.html
// حتى يجبر الأجهزة على حذف الكاش القديم بدل خلط نسخة قديمة بأخرى جديدة
const CACHE_NAME = 'wadmadani-cache-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // فقط طلبات GET من نفس الموقع يتم التعامل معها بالتخزين المؤقت
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // عند نجاح الاتصال، نحدّث النسخة المخزنة بأحدث نسخة من الصفحة
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // عند انقطاع الشبكة، نحاول تقديم النسخة المخزنة مسبقاً
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // كحل أخير لصفحات التنقل: أعد الصفحة الرئيسية المخزنة إن وجدت
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
