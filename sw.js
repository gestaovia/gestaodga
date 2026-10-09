/* GestaoVia · service worker
   Torna o sistema instalável (PWA). A página sempre vem da rede quando há internet (versão mais nova);
   sem internet, abre a última cópia salva. Dados do Supabase nunca são guardados aqui. */
const CACHE = 'gestaovia-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.ico', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // Supabase, mapas e CDNs: direto na rede
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put('./index.html', c)); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
