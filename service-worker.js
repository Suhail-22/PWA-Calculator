// Inlined Service Worker
const CACHE_NAME = 'ai-calculator-cache-v9'; // قم بتحديث اسم الذاكرة المؤقتة
const urlsToCache = [
  '/',
  '/index.html',
  '/src/index.js',
  '/styles/index.css',
  // يمكنك إضافة ملفات أخرى هنا إذا أضفتها لاحقًا
  // مثل /manifest.json إذا لم تكن تستخدمه مشفرًا
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  event.waitUntil(self.skipWaiting());
});

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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // تحقق مما إذا كان الطلب ينتمي إلى نفس الأصل (GitHub Pages)
  if (event.request.url.startsWith(self.location.origin)) {
    // إذا كان كذلك، استخدم الذاكرة المؤقتة
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // إذا وُجد في الذاكرة المؤقتة، أعد إرساله
          if (response) {
            return response;
          }
          // إذا لم يُوجد، قم بجلبه من الشبكة
          return fetch(event.request).then(response => {
            // تحقق مما إذا كان الاستجابة صالحة
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // انسخ الاستجابة
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
        })
    );
  } else {
    // إذا كان الطلب لرابط خارجي (مثل cdn.tailwindcss.com)، قم بجلبه مباشرة
    event.respondWith(
      fetch(event.request)
    );
  }
});
