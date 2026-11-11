/* Service worker de Portal Certificaciones.
 * - Pantallas: primero la red; sin señal, la última versión guardada (la app abre igual en terreno).
 * - Archivos de la app (/assets, íconos): desde la caché; sus nombres cambian en cada versión.
 * - Nunca guarda datos: la API, el inicio de sesión y los archivos firmados van siempre a la red.
 * - Cada build escribe su versión aquí (vite.config.ts): el archivo cambia, el navegador instala el nuevo
 *   y se borra la caché de la versión anterior.
 */
const VERSION = '__VERSION__'
const CACHE = `portal-certificaciones-${VERSION}`
const BASICOS = ['/', '/manifest.webmanifest', '/logo_lh.png', '/icons/icon-192.png', '/icons/icon-512.png']
const MAXIMO = 80

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()))
})

// La app pide activar la versión nueva cuando la persona aprieta "Actualizar"
self.addEventListener('message', (e) => {
  if (e.data === 'activar') self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function recortar(cache) {
  const claves = await cache.keys()
  await Promise.all(claves.slice(0, Math.max(0, claves.length - MAXIMO)).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // Sin la caché del navegador: así cada apertura trae la página de la última versión publicada
    e.respondWith(
      fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((r) => {
          const copia = r.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
          return r
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(request).then((guardada) => guardada || fetch(request).then((r) => {
        if (r.ok) {
          const copia = r.clone()
          caches.open(CACHE).then((c) => c.put(request, copia).then(() => recortar(c)))
        }
        return r
      })),
    )
  }
})
