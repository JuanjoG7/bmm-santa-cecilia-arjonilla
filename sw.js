const CACHE_NAME = 'bmm-santa-cecilia-v1.13.1-kpi-clean-build-20261012';
const APP_SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/assets/escudo-santa-cecilia.jpg', '/assets/bmm-header-banner.webp', '/assets/icon-192.png', '/assets/icon-512.png',
  '/assets/icon-maskable-512.png', '/assets/favicon-32.png', '/assets/apple-touch-icon.png',
  '/assets/css/app-base.css', '/assets/css/phase3-accessibility.css', '/assets/css/phase1-visual-system.css',
  '/assets/js/app-bootstrap.js', '/assets/js/app-workflows.js',
  '/assets/js/theme-palette.js', '/assets/js/marches-order-bulk.js',
  '/assets/css/interface-quality.css', '/assets/js/interface-quality.js'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => { try { const response = await fetch(url, {cache:'reload'}); if (response.ok) await cache.put(url, response); } catch (_) {} }));
    await self.skipWaiting();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE_NAME && key.startsWith('bmm-santa-cecilia')) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); await cache.put('/index.html', response.clone()); }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match('/index.html')) || new Response('Aplicación no disponible sin conexión. Abre BMM Santa Cecilia cuando vuelvas a tener conexión.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/sw.js') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try { const response = await fetch(request); if (response.ok) cache.put(request, response.clone()); return response; }
      catch (_) { const cached = await cache.match(request); if (cached) return cached; throw _; }
    })());
  }
});
