// Sem cache. Existe só para o app poder ser instalado e aparecer na folha de compartilhar do Android.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
