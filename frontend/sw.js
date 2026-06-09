const CACHE_NAME = 'evergreen-cache-v1';
const ASSETS = [
  '/catalogo_publico.html',
  '/css/style.css',
  '/js/api.js',
  '/js/components/catalogo.js',
  '/js/components/carrito.js',
  '/img/logo.jpg',
  '/img/apple-touch-icon.png',
  '/img/logo_app.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Intentar cachear recursos, ignorando si falla alguno individual en desarrollo offline
      return Promise.allSettled(
        ASSETS.map(asset => cache.add(asset).catch(err => console.log('Asset not cached:', asset, err)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Solo interceptar peticiones locales del mismo dominio y que sean peticiones GET básicas
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Retornar la copia cacheada y refrescar la caché en segundo plano de manera asíncrona
        fetch(event.request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
