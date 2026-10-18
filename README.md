# Après-coup

App personnelle : une séance par jour de philosophie ou de psychanalyse.

- `content/philosophie/*.md`, `content/psychanalyse/*.md` : les fiches (format dans `FORMAT.md`)
- `app.src.html` : l'interface (gabarit)
- `build.js` : contrôle les fiches puis écrit `app.html`

```bash
node build.js --check   # contrôle seulement
node build.js           # contrôle + construit app.html
```

Ajouter une fiche : créer le fichier .md, l'ajouter à la liste ORDRE de build.js
(sinon elle paraît à la fin), relancer `node build.js`.
