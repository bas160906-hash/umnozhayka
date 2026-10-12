// Офлайн-режим: после первого открытия игра работает без интернета.
// При изменении файлов игры увеличьте номер версии, чтобы телефоны получили обновление.
const CACHE = 'umnozhayka-v7';
const CORE = [
  './',
  './index.html',
  './mastery.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('umnozhayka-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (url.origin !== self.location.origin && !isFont) return;

  // Страница: сначала сеть (чтобы приходили обновления), при плохой связи — сохранённая копия.
  if (req.mode === 'navigate') {
    e.respondWith(
      withTimeout(fetch(req), 3000)
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Иконки, шрифты и прочее: сначала кэш, иначе сеть с сохранением.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
