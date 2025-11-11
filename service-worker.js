// الإصدار الخامس (V5) - لضمان التحديث بعد المحاولات السابقة
const CACHE_NAME = 'ai-calc-pwa-v5'; 

// قائمة الملفات الأساسية للتخزين المؤقت، باستخدام المسار المطلق لـ GitHub Pages
const APP_SHELL = [
  // المسار الأساسي للمستودع
  '/PWA-Calculator/', 
  // جميع المسارات يجب أن تبدأ بـ /اسم_المستودع/
  '/PWA-Calculator/index.html',
  '/PWA-Calculator/style.css',
  '/PWA-Calculator/script.js',
  '/PWA-Calculator/icons/icon-192x192.png',
  '/PWA-Calculator/icons/icon-512x512.png'
];

// حدث التثبيت: يتم تخزين جميع الملفات في القائمة
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(APP_SHELL).catch(error => {
          console.error('فشل في تخزين الأصول مؤقتاً:', error);
        });
      })
  );
  self.skipWaiting();
});

// حدث الجلب (Fetch): محاولة الرد من الذاكرة المؤقتة أولاً
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
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
