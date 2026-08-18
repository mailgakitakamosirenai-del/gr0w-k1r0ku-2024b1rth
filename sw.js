/**
 * 育児きろく — サービスワーカー
 *
 * アプリの見た目（HTML・アイコン）を端末に保存しておき、
 * 電波がなくても起動できるようにします。
 *
 * 記録そのもののやり取り（Apps Script への通信）は、ここでは一切扱いません。
 * 常にネットワークへ素通しし、失敗したときはアプリ側が「未送信」として持ち続けます。
 *
 * ★ index.html を更新したら、下の VERSION の数字を1つ増やしてください。
 *   増やさないと、端末に残った古い画面が使われ続けます。
 */
const VERSION = 'v7';
const CACHE = 'ikuji-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(k){
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;

  // 送信系と外部への通信（Apps Script など）は素通し
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;

  // 画面の表示：まずネットワーク、だめならキャッシュ（更新を取り逃さないため）
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(function(res){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
          return res;
        })
        .catch(function(){
          return caches.match('./index.html').then(function(m){
            return m || new Response('オフラインです', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
          });
        })
    );
    return;
  }

  // アイコンなど：まずキャッシュ、無ければ取得して保存
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
