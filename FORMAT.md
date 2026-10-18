# Après-coup — format d'une fiche

Une fiche = un fichier `content/<discipline>/<slug>.md`, disciplines : `philosophie`, `psychanalyse`.
Le fichier a quatre blocs séparés par une ligne `---` seule.

```
titre: La réminiscence
figure: Platon
reference: Ménon, 80d–86c (vers 385 av. J.-C.)
accroche: Une phrase qui donne envie d'ouvrir la fiche (sert aussi de notification).
punch: Phrase choc de la carte partageable (100 caractères max).
idee: L'idée en 2 ou 3 phrases (300 caractères max).
citation: Texte exact, court.
citation_source: Auteur, œuvre, repère précis — traduction
citation_url: https://… (obligatoire avec une citation : où la vérifier)
repere: (facultatif, remplace la citation quand aucune citation brève et sûre n'existe)
liens: slug-d-une-autre-fiche, autre-slug
---
Corps de la fiche en Markdown : paragraphes, *italique*, **gras**, ## intertitres,
et des encadrés d'exemple : lignes commençant par « > » (au moins un par fiche).
---
? Question
- mauvaise réponse
* bonne réponse
- mauvaise réponse
- mauvaise réponse
= Explication qui traite aussi les mauvaises réponses.

? Question suivante…
---
- Source 1 (bibliographie) | https://lien-consultable
- Source 2 | https://…
```

`node build.js` vérifie toutes les fiches (champs, longueurs, quiz, liens) puis
reconstruit `app.html`. Une fiche en erreur bloque la construction.

Règle : rien n'entre dans une fiche sans avoir été vérifié dans une source consultable en ligne.
Les exemples sont des illustrations ; les vignettes cliniques inventées sont signalées « fictif ».
Une fiche marquée `statut: a_verifier` est une ancienne fiche pas encore revérifiée.
