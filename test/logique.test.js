// Tests de la logique de l'app : suite des séances, rappel espacé, fusion, texte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ecart, decaler, etatVide, normaliser, fusionner, selection, suiteOrdonnee, prochaine,
  seanceDuJour, servir, seanceDeDemain, ouvertes, cycleAcheve, enregistrerReponse, aRevoir,
  markdown, enteteIllustration, texteBrut, notesEnMarkdown, titreQuiz,
} from '../src/logique.js';

const q = (bonne = 0) => ({ question: 'Q ?', choix: ['a', 'b', 'c', 'd'], bonne, explication: 'E.' });
const fiche = (id, discipline, branche = 'b') => ({ id, discipline, branche, titre: id, figure: 'F', reference: 'R', liens: [], quiz: [q(), q(1), q(2)] });
const CORPUS = [
  fiche('psy1', 'psychanalyse', 'freud'), fiche('psy2', 'psychanalyse', 'lacan'), fiche('psy3', 'psychanalyse', 'freud'),
  fiche('phi1', 'philosophie', 'fondamentaux'), fiche('phi2', 'philosophie', 'politique'),
  fiche('cro1', 'croisement', 'dialogues'),
];
const J = '2026-10-19';
// Simule n jours : chaque jour la séance est servie, et lue si lire(jour) est vrai.
function vivre(etat, n, lire = () => true, debut = J) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const auj = decaler(debut, i), c = seanceDuJour(CORPUS, etat, auj);
    if (c.nouvelle) servir(etat, c);
    ids.push(c.id);
    if (lire(i)) { if (etat.lues[c.id]) etat.relues[c.id] = auj; else etat.lues[c.id] = auj; }
  }
  return ids;
}

test('dates locales', () => {
  assert.equal(ecart('2026-10-19', '2026-10-26'), 7);
  assert.equal(decaler('2026-12-31', 1), '2027-01-01');
  assert.equal(decaler('2026-03-01', -1), '2026-02-28');
});

test('alternance psychanalyse / philosophie, croisement le cinquième jour', () => {
  const e = etatVide(J);
  const ids = vivre(e, 6);
  assert.deepEqual(ids, ['psy1', 'phi1', 'psy2', 'phi2', 'cro1', 'psy3']);
});

test('une séance non lue n\'est pas sautée : elle revient à son tour', () => {
  const e = etatVide(J);
  const ids = vivre(e, 3, i => i !== 0); // le premier jour, rien n'est lu
  assert.deepEqual(ids, ['psy1', 'phi1', 'psy1']);
});

test('la séance du jour ne change pas si les réglages changent dans la journée', () => {
  const e = etatVide(J);
  const c = seanceDuJour(CORPUS, e, J); servir(e, c);
  e.reglages.rythme = 'philosophie';
  const c2 = seanceDuJour(CORPUS, e, J);
  assert.equal(c2.id, c.id); assert.equal(c2.nouvelle, false);
  // Le lendemain, le nouveau rythme s'applique.
  e.lues[c.id] = J;
  const c3 = seanceDuJour(CORPUS, e, decaler(J, 1));
  assert.notEqual(PAR(c3.id).discipline, 'psychanalyse');
});
const PAR = id => CORPUS.find(f => f.id === id);

test('les branches exclues sortent de la sélection, sans jamais la vider', () => {
  const r = { ...etatVide(J).reglages, exclues: ['freud'] };
  assert.deepEqual(selection(CORPUS, r).map(f => f.id), ['psy2', 'phi1', 'phi2', 'cro1']);
  const tout = { ...r, exclues: ['freud', 'lacan', 'fondamentaux', 'politique', 'dialogues'] };
  assert.ok(selection(CORPUS, tout).length > 0);
});

test('l\'ordre prévu alterne et numérote toute la sélection', () => {
  const s = suiteOrdonnee(CORPUS, etatVide(J).reglages).map(f => f.id);
  assert.deepEqual(s, ['psy1', 'phi1', 'psy2', 'phi2', 'cro1', 'psy3']);
  const philo = suiteOrdonnee(CORPUS, { ...etatVide(J).reglages, rythme: 'philosophie' }).map(f => f.id);
  assert.deepEqual(philo, ['phi1', 'phi2', 'cro1']);
});

test('quand tout est lu, le cycle reprend par la séance lue il y a le plus longtemps', () => {
  const e = etatVide(J);
  vivre(e, 6);
  assert.ok(cycleAcheve(CORPUS, e));
  const c = seanceDuJour(CORPUS, e, decaler(J, 6));
  assert.equal(c.relecture, true);
  assert.equal(c.id, 'psy1');
  servir(e, c); e.relues.psy1 = decaler(J, 6);
  assert.equal(seanceDuJour(CORPUS, e, decaler(J, 7)).id, 'phi1');
});

test('une fiche nouvelle passe devant les relectures', () => {
  const e = etatVide(J);
  vivre(e, 6);
  const corpus = [...CORPUS, fiche('psy4', 'psychanalyse', 'freud')];
  e.tour = 0; // tour de la psychanalyse
  assert.deepEqual(prochaine(corpus, e), { id: 'psy4', relecture: false });
});

test('demain : la discipline suivante', () => {
  const e = etatVide(J);
  const c = seanceDuJour(CORPUS, e, J); servir(e, c);
  assert.equal(seanceDeDemain(CORPUS, e, J).id, 'phi1');
});

test('bibliothèque : servies et lues ; tout le corpus si demandé', () => {
  const e = etatVide(J);
  vivre(e, 2);
  assert.deepEqual([...ouvertes(CORPUS, e)].sort(), ['phi1', 'psy1']);
  e.reglages.acces = 'tout';
  assert.equal(ouvertes(CORPUS, e).size, CORPUS.length);
});

test('rappel espacé : erreur → lendemain ; puis 7 et 30 jours ; puis retirée', () => {
  const e = etatVide(J);
  let r = enregistrerReponse(e, 'psy1', 0, false, J);
  assert.equal(r.echeance, decaler(J, 1)); assert.equal(r.ratees, 1);
  assert.deepEqual(aRevoir(CORPUS, e, J), []);
  assert.equal(aRevoir(CORPUS, e, decaler(J, 1)).length, 1);
  r = enregistrerReponse(e, 'psy1', 0, true, decaler(J, 1));
  assert.equal(r.echeance, decaler(J, 8));
  r = enregistrerReponse(e, 'psy1', 0, true, decaler(J, 8));
  assert.equal(r.echeance, decaler(J, 38));
  r = enregistrerReponse(e, 'psy1', 0, true, decaler(J, 38));
  assert.equal(r.echeance, null);
  assert.deepEqual(aRevoir(CORPUS, e, decaler(J, 400)), []);
});

test('rappel espacé : une bonne première réponse revient à une semaine ; les plus ratées d\'abord', () => {
  const e = etatVide(J);
  assert.equal(enregistrerReponse(e, 'phi1', 0, true, J).echeance, decaler(J, 7));
  enregistrerReponse(e, 'psy1', 0, false, J);
  enregistrerReponse(e, 'psy2', 1, false, J);
  enregistrerReponse(e, 'psy2', 1, false, J);
  const dus = aRevoir(CORPUS, e, decaler(J, 7));
  assert.deepEqual(dus.map(d => d.id + d.qi), ['psy21', 'psy10', 'phi10']);
  assert.equal(aRevoir(CORPUS, e, decaler(J, 7), 1).length, 1);
});

test('migration de l\'ancien format : lues servies, réponses converties en révisions', () => {
  const ancien = { debut: '2026-10-01', lues: { psy1: '2026-10-01' }, quiz: { psy1: [1, 1, null] }, notes: {}, reglages: { rythme: 'alterne' } };
  const e = normaliser(ancien, J, CORPUS);
  assert.equal(e.version, 2);
  assert.deepEqual(e.servies, ['psy1']);
  assert.equal(e.revisions['psy1#0'].echeance, J);            // ratée : à revoir tout de suite
  assert.equal(e.revisions['psy1#1'].echeance, decaler(J, 7)); // juste : dans une semaine
  assert.equal(e.revisions['psy1#2'], undefined);
  assert.deepEqual(e.reglages.exclues, []);
});

test('normaliser résiste à un état abîmé', () => {
  const e = normaliser({ lues: 'x', notes: null, servies: 3, version: 2 }, J, CORPUS);
  assert.deepEqual(e.lues, {}); assert.deepEqual(e.notes, {}); assert.deepEqual(e.servies, []);
  assert.equal(normaliser(null, J).debut, J);
});

test('fusionner ne perd rien', () => {
  const a = etatVide(J), b = etatVide(J);
  a.lues = { psy1: '2026-10-02' }; b.lues = { psy1: '2026-10-01', phi1: '2026-10-03' };
  a.notes = { psy1: { texte: 'récente', le: 2 } }; b.notes = { psy1: { texte: 'ancienne', le: 1 }, phi1: { texte: 'b', le: 1 } };
  a.revisions = { 'psy1#0': { boite: 1, echeance: '2026-10-20', ratees: 1, vue: '2026-10-13' } };
  b.revisions = { 'psy1#0': { boite: 0, echeance: '2026-10-14', ratees: 1, vue: '2026-10-12' } };
  a.servies = ['psy1']; b.servies = ['phi1'];
  const r = fusionner(a, b, J);
  assert.deepEqual(r.lues, { psy1: '2026-10-01', phi1: '2026-10-03' });
  assert.equal(r.notes.psy1.texte, 'récente'); assert.equal(r.notes.phi1.texte, 'b');
  assert.equal(r.revisions['psy1#0'].vue, '2026-10-13');
  assert.deepEqual(r.servies.sort(), ['phi1', 'psy1']);
});

test('illustration : l\'en-tête « Exemple (…) » devient une étiquette et une note', () => {
  assert.deepEqual(enteteIllustration('**Exemple (une illustration, pas un cas de Green).** Texte'), { note: 'pas un cas de Green', reste: 'Texte' });
  assert.deepEqual(enteteIllustration('**Exemple, version contemporaine.** Texte'), { note: 'version contemporaine', reste: 'Texte' });
  assert.deepEqual(enteteIllustration('**Exemple.** Texte'), { note: '', reste: 'Texte' });
  assert.deepEqual(enteteIllustration('**Illustration (pas un cas de Bion).** T'), { note: 'pas un cas de Bion', reste: 'T' });
  assert.equal(enteteIllustration('Pas d\'en-tête'), null);
  const html = markdown('> **Exemple (une illustration).** Un cas.\n> Suite.');
  assert.match(html, /<span class="ill-label">Illustration<\/span>/);
  assert.doesNotMatch(html, /ill-note/);
});

test('appels de note [^n] et texte à voix haute', () => {
  const html = markdown('Une thèse[^2] et un fragment 7 [60].');
  assert.match(html, /<sup class="appel"><a href="#source-2"/);
  assert.match(html, /7 \[60\]/);
  assert.equal(texteBrut('Une **thèse**[^2].'), 'Une thèse.');
  assert.equal(markdown('<b>x</b>'), '<p>&lt;b&gt;x&lt;/b&gt;</p>');
});

test('export des notes en Markdown', () => {
  const e = etatVide(J);
  e.notes = { psy1: { texte: 'Ma note', le: 1 }, inconnue: { texte: 'x', le: 2 } };
  e.lues = { psy1: J };
  const md = notesEnMarkdown(CORPUS, e, new Date(2026, 9, 19));
  assert.match(md, /^# Après-coup — mes notes/);
  assert.match(md, /## psy1 — F/);
  assert.match(md, /Ma note/);
  assert.doesNotMatch(md, /inconnue/);
});

test('titre du quiz selon le nombre de questions', () => {
  assert.equal(titreQuiz(3), 'Trois questions');
  assert.equal(titreQuiz(4), 'Quatre questions');
  assert.equal(titreQuiz(9), '9 questions');
});
