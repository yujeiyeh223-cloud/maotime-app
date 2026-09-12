// 卯時設計 套量服管理系統 - Service Worker
// 版本號每次更新 HTML 時一起改，確保快取強制更新
const CACHE_VERSION = 'v42';
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

// 網路優先：每次都嘗試從網路取最新版，失敗才用快取。
//
// **只處理本站資源，跨來源（GAS API）一律不攔**（2026-09-12 修）。
// 原本這裡攔下頁面發出的每一個 GET，包含打到 script.google.com 的 API，然後
// response.clone() 一份丟進快取——而那個 cache.put 沒有掛在 event.waitUntil 上。
// SW 隨時可能被 iOS 回收，clone 出來的那一半沒被讀完，tee 的緩衝就卡住，
// 頁面這一半的 fetch 於是永遠不會 settle（或直接以網路錯誤收場）。
// 症狀：GAS 執行紀錄全部「已完成」，手機卻跳「外借登記失敗，請再試一次」、
// 產生憑證卡在「正在載入憑證資料…」——伺服器做完了，回應沒回到前端。
//
// 另一半問題是快取汙染：API 的網址是固定的（getInventory、getBorrowRecord），
// 被 put 進快取之後，網路一不順就從快取回一份**舊資料**，看起來像成功，
// 其實是過期的庫存。API 的回應永遠不該進快取。
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // 跨來源請求（GAS API、CDN）直接放行給瀏覽器自己處理，SW 不碰。
  let sameOrigin = false;
  try{ sameOrigin = new URL(e.request.url).origin === self.location.origin; }catch(err){ return; }
  if(!sameOrigin) return;
  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone();
      // 掛上 waitUntil，SW 才不會在 clone 還沒被讀完就被回收。
      const job = caches.open(CACHE_NAME)
        .then(cache => cache.put(e.request, clone))
        .catch(() => {});   // 配額不足等等，不要變成未處理的 rejection
      try{ e.waitUntil(job); }catch(err){}
      return response;
    }).catch(() => caches.match(e.request))
  );
});
