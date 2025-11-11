// اسم الإصدار لذاكرة التخزين المؤقت - يجب تغييره عند كل تحديث للملفات لفرض التحديث
const CACHE_NAME = 'ai-calc-pwa-v2';

// الملفات الأساسية التي يجب تخزينها مؤقتاً للعمل دون إنترنت
const urlsToCache = [
  '/Ai-Calculator-full/',
  '/Ai-Calculator-full/index.html',
  '/Ai-Calculator-full/style.css',
  '/Ai-Calculator-full/script.js', // تأكد من أن هذا هو اسم ملف JavaScript الرئيسي لديك
  '/Ai-Calculator-full/icons/icon-192x192.png',
  '/Ai-Calculator-full/icons/icon-512x512.png'
];

// حدث التثبيت: يتم تخزين جميع الملفات في القائمة
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(error => {
          console.error('فشل في تخزين الأصول مؤقتاً:', error);
        });
      })
  );
  self.skipWaiting(); // لتفعيل الـ Service Worker فوراً
});

// حدث الجلب (Fetch): محاولة الرد من الذاكرة المؤقتة أولاً
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا كان الملف موجوداً في الذاكرة المؤقتة، قم بإرجاعه
        return response || fetch(event.request);
      })
  );
});

// حدث التفعيل: حذف أي إصدارات قديمة لذاكرة التخزين المؤقت
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
