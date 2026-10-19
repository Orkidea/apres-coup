// Tests du format des fiches et du corpus réel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireTexte, controler, lireCorpus, BRANCHES } from '../src/fiches.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const corps = 'Un texte[^1] assez long. '.repeat(200) + '\n\n> **Illustration (pas un cas de X).** Un cas.';
const MODELE = `titre: T
figure: F
branche: freud
fiabilite: secondaire
reference: R
accroche: A
punch: P
idee: I
repere: Un repère.
liens:
---
${corps}
---
? Question ?
- un
* deux
- trois
- quatre
= Explication.
? Question 2 ?
* un
- deux
- trois
- quatre
= Explication.
? Question 3 ?
- un
- deux
- trois
* quatre
= Explication.
---
- Source un | https://exemple.org/1
- Source deux | https://exemple.org/2
`;

test('une fiche conforme passe le contrôle', () => {
  const f = lireTexte(MODELE, 't', 'psychanalyse');
  assert.equal(f.quiz.length, 3);
  assert.equal(f.quiz[0].bonne, 1);
  assert.equal(f.sources[1].url, 'https://exemple.org/2');
  const { erreurs, alertes } = controler([f]);
  assert.deepEqual(erreurs, []);
  assert.deepEqual(alertes, []);
});

test('le contrôle repère les défauts', () => {
  const f = lireTexte(MODELE.replace('branche: freud', 'branche: inconnue').replace('[^1]', '[^9]').replace('- Source deux | https://exemple.org/2\n', ''), 't', 'psychanalyse');
  const { erreurs } = controler([f]);
  assert.ok(erreurs.some(e => e.includes('branche inconnue')));
  assert.ok(erreurs.some(e => e.includes('[^9]')));
  assert.ok(erreurs.some(e => e.includes('moins de deux sources')));
});

test('le contrôle signale la première personne', () => {
  const f = lireTexte(MODELE.replace('Un cas.', 'Un cas que je n\'ai pas vérifié.'), 't', 'psychanalyse');
  assert.ok(controler([f]).alertes.some(a => a.includes('première personne')));
});

test('une fiche mal formée est refusée', () => {
  assert.throws(() => lireTexte('titre: T\n---\ncorps', 't', 'philosophie'), /4 blocs/);
});

test('le corpus réel passe le contrôle sans erreur', () => {
  const { fiches, echecs } = lireCorpus(RACINE);
  assert.deepEqual(echecs, []);
  assert.deepEqual(controler(fiches).erreurs, []);
});

test('chaque branche proposée a au moins deux fiches', () => {
  const { fiches } = lireCorpus(RACINE);
  for (const [d, liste] of Object.entries(BRANCHES)) for (const [c] of liste) {
    const n = fiches.filter(f => f.discipline === d && f.branche === c).length;
    assert.ok(n === 0 || n >= 2, `${d}/${c} : ${n} fiche(s)`);
  }
});

test('les sources ne se répètent pas dans une même fiche', () => {
  const { fiches } = lireCorpus(RACINE);
  for (const f of fiches) {
    const urls = f.sources.map(s => s.url);
    assert.equal(new Set(urls).size, urls.length, f.id);
  }
});
