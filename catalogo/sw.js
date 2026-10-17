// Solo para que Chrome deje instalar el Catálogo como app. No guarda nada: el Catálogo necesita conexión.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
