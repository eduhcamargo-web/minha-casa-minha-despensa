// =========================================================
// SERVICE WORKER (PWA) - MINHA CASA, MINHA DESPENSA
// =========================================================

const CACHE_NAME = 'minha-despensa-v1';

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Estratégia Network-First (prioriza sempre a versão mais atualizada da internet)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});