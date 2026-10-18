// Après-coup — fonctionne hors connexion : l'app et ses polices sont mises en cache.
const VERSION = 'apres-coup-04a276816be3';
const BASE = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La page : réseau d'abord (pour recevoir les nouvelles fiches), cache si hors connexion.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copie = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copie)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Polices et fichiers statiques : cache d'abord.
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); return r; })));
  }
});
