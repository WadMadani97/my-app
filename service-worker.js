// Service worker بسيط - يمكن تطويره لاحقاً لدعم العمل بدون إنترنت
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  // حالياً يمرر الطلبات مباشرة للشبكة بدون تخزين مؤقت
  event.respondWith(fetch(event.request));
});
