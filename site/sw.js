// Prima l'app stava alla radice del sito con un service worker in /sw.js; ora l'app è in /app/.
// Questo file sostituisce il vecchio service worker: si disattiva, libera le vecchie cache
// e ricarica le pagine aperte, così chi aveva l'app installata arriva alla nuova versione.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.includes('/app/')).map((n) => caches.delete(n)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
