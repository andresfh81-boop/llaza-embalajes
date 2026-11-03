// Guarda una copia de la app para que se pueda instalar y funcione sin conexión.
const CACHE_NAME = 'embalajes-llaza-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './datos/catalogo.json',
  './static/estilo.css',
  './static/nucleo.js',
  './static/pdf.js',
  './static/xlsx.js',
  './static/app.js',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './static/favicon.ico',
  './static/icon-32.png',
  './static/icon-180.png',
  './static/icon-192.png',
  './static/icon-512.png'
];
// Lector de planos escaneados (unos 10 MB): se guarda aparte para que, si falla su descarga, la app se instale igual.
const OCR = [
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/lang/spa.traineddata.gz'
];
// Con wifi sin internet o mala señal la red no falla, se queda esperando: pasado este tiempo se usa la copia guardada.
const NET_TIMEOUT = 4000;
const recargar = (url) => new Request(url, { cache: 'reload' });

// cache: 'reload' para no guardar una copia vieja que tenga el navegador o GitHub Pages.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL.map(recargar))
        .then(() => cache.addAll(OCR.map(recargar)).catch(() => {}))
    ).then(() => self.skipWaiting())
  );
});

// Solo borra copias viejas de esta app: todas las apps de andresfh81-boop.github.io comparten las copias guardadas.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('embalajes-llaza-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// "Red primero": con internet siempre se pide la versión más reciente, así los
// cambios de la app y del catálogo llegan solos a quien la tenga instalada.
// Sin conexión, o si la red tarda demasiado, se sirve la última copia guardada. El CSS y el JS van con ?v=N:
// se guardan la primera vez que se piden y, sin conexión, vale cualquier versión guardada.
const copia = (request) =>
  caches.match(request).then((cached) => {
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    return caches.match(request, { ignoreSearch: true });
  });

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const red = fetch(event.request).then((response) => {
    if (response && response.status === 200 && response.type === 'basic') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
    }
    return response;
  });
  event.waitUntil(red.catch(() => {}));

  event.respondWith(new Promise((resolve) => {
    let hecho = false;
    const dar = (r) => { if (!hecho && r) { hecho = true; resolve(r); } };
    const timer = setTimeout(() => copia(event.request).then(dar), NET_TIMEOUT);
    red.then((r) => { clearTimeout(timer); dar(r); })
      .catch(() => { clearTimeout(timer); copia(event.request).then((c) => { dar(c); if (!hecho) resolve(Response.error()); }); });
  }));
});
