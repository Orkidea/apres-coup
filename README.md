# Après-coup

App personnelle : une séance par jour de philosophie, de psychanalyse, ou d'un croisement des deux.
Servie sur https://orkidea.github.io/apres-coup/ (installable comme une app, fonctionne hors ligne).

## Arborescence

- `content/philosophie/`, `content/psychanalyse/`, `content/croisements/` : les fiches (format dans `FORMAT.md`)
- `src/fiches.js` : disciplines, branches, niveaux de fiabilité, ordre de parution, lecture et contrôle des fiches
- `src/logique.js` : logique pure (dates, état, séance du jour, rappel espacé, rendu du texte), testée
- `src/app.js`, `src/voix.js`, `src/carte.js` : l'interface, la lecture à voix haute, la carte partageable
- `src/page.html`, `src/style.css` : le gabarit et les styles
- `pwa/` : service worker, manifeste, icônes, polices auto-hébergées
- `build.js` : contrôle les fiches, assemble `src/` en une page unique, écrit le site
- `test/` : tests de la logique et du contenu réel

## Commandes

```bash
npm test            # tests (logique + toutes les fiches)
npm run check       # contrôle des fiches seulement
npm run build       # contrôle + construit le site
```

`npm run build` écrit :

- à la racine, la version installable : `index.html`, `sw.js`, `version.json`, `manifest.webmanifest`, icônes, `polices/` ;
- `app.html`, l'aperçu Claude (polices Google, non versionné).

`version.json` porte une empreinte du contenu ; sa date ne change que si l'empreinte change.

## Publication

À chaque push sur `main`, l'action GitHub `construire` lance les tests puis la construction,
et committe le site s'il a changé. GitHub Pages sert la racine du dépôt.

## Ajouter une fiche

1. Créer le fichier `.md` dans le bon dossier, au format de `FORMAT.md`, avec une `branche:` existante.
2. L'ajouter à la liste `ORDRE` de `src/fiches.js` (sinon elle paraît après les autres, par ordre alphabétique).
3. `npm test` puis `npm run build` : zéro erreur, zéro alerte.

Une branche affichée doit compter au moins deux fiches : un test le vérifie.

## Données de l'utilisateur

Tout reste dans le navigateur (`localStorage`, clé `apres-coup.etat.v1`). Réglages → « Tes données »
permet d'exporter et de réimporter un fichier JSON, et d'exporter ses notes en Markdown.
