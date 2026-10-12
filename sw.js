// Guarda una copia de la app para que se pueda instalar y funcione sin conexión.
const CACHE_NAME = 'embalajes-llaza-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './datos/catalogo.json',
  './static/estilo.css',
  './static/nucleo.js',
  './static/pdf.js',
  './static/app.js',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './static/favicon.ico',
  './static/icon-32.png',
  './static/icon-180.png',
  './static/icon-192.png',
  './static/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// "Red primero": con internet siempre se pide la versión más reciente, así los
// cambios de la app y del catálogo llegan solos a quien la tenga instalada.
// Sin conexión se sirve la última copia guardada. El CSS y el JS van con ?v=N:
// se guardan la primera vez que se piden y, sin conexión, vale cualquier versión guardada.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return caches.match(event.request, { ignoreSearch: true });
        })
      )
  );
});
