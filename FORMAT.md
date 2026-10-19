# Après-coup — format d'une fiche

Une fiche = un fichier `content/<dossier>/<slug>.md`. Dossiers : `philosophie`, `psychanalyse`,
`croisements` (discipline `croisement`). Le fichier a quatre blocs séparés par une ligne `---` seule.

```
titre: La réminiscence
figure: Platon
branche: fondamentaux
fiabilite: primaire
fiabilite_note: (facultatif) Ce qui a été lu, et comment : texte original, traduction, commentaire.
reference: Ménon, 80d–86c (vers 385 av. J.-C.)
accroche: Une phrase qui donne envie d'ouvrir la fiche (sert aussi de notification).
punch: Phrase choc de la carte partageable (100 caractères max).
idee: L'idée en 2 ou 3 phrases (300 caractères max).
citation: Texte exact, court.
citation_source: Auteur, œuvre, repère précis — traduction française si la citation est en langue étrangère
citation_url: https://… (obligatoire avec une citation : où la vérifier)
repere: (remplace la citation quand aucune citation brève et sûre n'est vérifiable)
liens: slug-d-une-autre-fiche, autre-slug
---
Corps de la fiche en Markdown : paragraphes, *italique*, **gras**, ## intertitres, listes « - ».
Appels de note : [^1] renvoie à la source n° 1 du dernier bloc.

> **Illustration (pas un exemple de l'auteur).** Au moins un encadré par fiche.
---
? Question
- mauvaise réponse
* bonne réponse
- mauvaise réponse
- mauvaise réponse
= Explication qui traite aussi les mauvaises réponses.

? Question suivante…
---
- Source 1 (ce qu'on y a vérifié) | https://lien-consultable
- Source 2 | https://…
```

## En-tête

- `branche:` est obligatoire ; les codes sont dans `BRANCHES`, en tête de `src/fiches.js`.
  - philosophie : `fondamentaux`, `epistemologie`, `politique`, `histoire`, `droit`, `langage`, `morale`, `nietzsche`
  - psychanalyse : `freud`, `objet`, `lacan`, `france`, `moi`
  - croisement : `dialogues`
- `fiabilite:` est obligatoire et s'affiche sous forme de pastille :
  - `primaire` : le texte original a été consulté ;
  - `mixte` : texte original et commentaires ;
  - `secondaire` : la fiche repose sur des commentaires (encyclopédies, articles).
- `fiabilite_note:` dit précisément ce qui a été lu, et ce qui a été écarté faute de vérification.
- `citation` ou `repere`, jamais une citation non vérifiée. Une citation trouvée seulement en anglais
  reste en anglais, avec sa traduction dans `citation_source`.

## Corps

- 750 à 1800 mots (les appels de note ne comptent pas).
- Au moins un encadré `> **Illustration (…).**` ; la parenthèse dit d'où vient l'exemple
  (« pas un exemple de X », « un parallèle avec la clinique »…).
- Pas de première personne ni de « selon Wikipédia » dans le texte : la provenance va dans les notes.
- Chaque `[^n]` doit renvoyer à une source existante.

## Quiz

- Au moins trois questions de quatre choix, dont au moins une question d'application
  (une situation concrète à interpréter).
- La bonne réponse ne dépasse pas 1,4 fois le plus long distracteur (l'ordre des choix est mélangé à l'affichage).

## Sources

- `- texte | url`, au moins deux, chacune avec un lien http(s) consultable.

## Règle

Rien n'entre dans une fiche sans avoir été vérifié dans une source consultable en ligne.
Les exemples inventés sont des illustrations et sont signalés comme tels.

`npm run check` vérifie toutes les fiches ; une erreur bloque la construction, une alerte doit être corrigée.
