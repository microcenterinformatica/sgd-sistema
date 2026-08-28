// Service worker minimo, so para satisfazer o criterio de instalabilidade
// dos navegadores (Chrome/Edge/Android) -- nao faz cache nem intercepta
// nenhuma requisicao, entao nao ha risco de conteudo desatualizado ficar
// "preso" apos um deploy novo.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // sem event.respondWith(): o navegador trata a requisicao normalmente
});
