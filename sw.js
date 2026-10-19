// Après-coup — fonctionne hors connexion : l'app et ses polices sont mises en cache.
const VERSION = 'apres-coup-4075bb045576';
const BASE = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png', './polices/gloock-latin-400-normal.woff2', './polices/gloock-latin-ext-400-normal.woff2', './polices/newsreader-latin-400-italic.woff2', './polices/newsreader-latin-400-normal.woff2', './polices/newsreader-latin-500-italic.woff2', './polices/newsreader-latin-500-normal.woff2', './polices/newsreader-latin-600-normal.woff2', './polices/newsreader-latin-ext-400-italic.woff2', './polices/newsreader-latin-ext-400-normal.woff2', './polices/newsreader-latin-ext-500-italic.woff2', './polices/newsreader-latin-ext-500-normal.woff2', './polices/newsreader-latin-ext-600-normal.woff2', './polices/spline-sans-mono-latin-400-normal.woff2', './polices/spline-sans-mono-latin-500-normal.woff2', './polices/spline-sans-mono-latin-ext-400-normal.woff2', './polices/spline-sans-mono-latin-ext-500-normal.woff2'];
// Au-delà de ce délai, une connexion trop lente cède la place à la version en cache.
const DELAI_RESEAU = 3000;

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
  // La page : le réseau d'abord, pour recevoir les nouvelles fiches, mais pas plus de
  // trois secondes ; sinon la version en cache, et la réponse du réseau, si elle finit
  // par arriver, met le cache à jour pour la prochaine ouverture.
  if (req.mode === 'navigate') {
    const reseau = fetch(req).then(r => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copie)); }
      return r;
    });
    e.waitUntil(reseau.catch(() => {}));
    e.respondWith(new Promise(resolve => {
      let fini = false;
      const enCache = () => caches.match('./index.html').then(r => r || reseau);
      const minuterie = setTimeout(() => { if (!fini) { fini = true; resolve(enCache()); } }, DELAI_RESEAU);
      reseau.then(r => { if (!fini) { fini = true; clearTimeout(minuterie); resolve(r); } })
        .catch(() => { if (!fini) { fini = true; clearTimeout(minuterie); resolve(enCache()); } });
    }));
    return;
  }
  // Fichiers de l'app (polices, icônes) : le cache d'abord.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
      return r;
    })));
  }
});
