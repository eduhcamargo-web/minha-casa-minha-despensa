// =========================================================
// SERVICE WORKER - MINHA CASA, MINHA DESPENSA (FASE 8)
// =========================================================
const CACHE_NAME = "despensa-familiar-v8";
const ARQUIVOS_BASE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./dados-fixos.js",
  "./icones.js",
  "./conversor-medidas.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_BASE)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave !== CACHE_NAME)
          .map((chaveAntiga) => caches.delete(chaveAntiga))
      )
    ).then(() => self.clients.claim())
  );
});

// Estratégia Network-First: busca sempre a versão mais nova e usa cache se estiver offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((respostaRede) => {
        const copia = respostaRede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respostaRede;
      })
      .catch(() => caches.match(event.request))
  );
});

// Abre ou traz o aplicativo para frente quando o usuário toca na notificação do celular
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ("focus" in janela) {
          return janela.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("./index.html");
      }
    })
  );
});