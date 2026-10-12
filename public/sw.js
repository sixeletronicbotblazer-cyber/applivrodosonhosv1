/* Livro dos Sonhos — service worker mínimo.
 * Estratégia: network-first com fallback offline; nunca cacheia API.
 * Registrado apenas em produção (o preview de desenvolvimento não é afetado).
 */
const CACHE = 'lds-static-v1'
const OFFLINE_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match('/')))
  )
})
