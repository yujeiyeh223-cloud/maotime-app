// 卯時設計 套量服管理系統 - Service Worker
// 版本號每次更新 HTML 時一起改，確保快取強制更新
const CACHE_VERSION = 'v28';
const CACHE_NAME = 'maotime-' + CACHE_VERSION;

// 安裝：快取主要檔案
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['/maotime-app/', '/maotime-app/index.html']);
    })
  );
});

// 啟動：刪除舊版快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 收到主頁面的 skipWaiting 訊息，立即接管
self.addEventListener('message', e => {
  if(e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

// 網路優先：每次都嘗試從網路取最新版，失敗才用快取
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
