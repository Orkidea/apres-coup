// Après-coup — lecture et contrôle des fiches. Utilisé par build.js et par les tests.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

export const DISCIPLINES = ['philosophie', 'psychanalyse', 'croisement'];

// Branches : le premier élément est le code écrit dans « branche: » de chaque fiche.
export const BRANCHES = {
  philosophie: [
    ['fondamentaux', 'Grands fondamentaux'],
    ['epistemologie', 'Épistémologie et philosophie des sciences'],
    ['politique', 'Philosophie politique'],
    ['histoire', 'Philosophie de l\'histoire'],
    ['droit', 'Philosophie du droit'],
    ['langage', 'Langage et philosophie analytique'],
    ['morale', 'Morale et existence'],
    ['nietzsche', 'Nietzsche'],
  ],
  psychanalyse: [
    ['freud', 'Freud et la métapsychologie'],
    ['objet', 'Relations d\'objet et développement'],
    ['lacan', 'Lacan et l\'école lacanienne'],
    ['france', 'Psychanalyse française contemporaine'],
    ['moi', 'Psychologie du moi et du self'],
  ],
  croisement: [
    ['dialogues', 'Dialogues entre philosophie et psychanalyse'],
  ],
};

export const FIABILITE = {
  primaire: 'Texte original consulté',
  mixte: 'Texte original et commentaires',
  secondaire: 'Lu à travers des commentaires',
};

// Ordre de parution historique (premières séances). Les fiches absentes de cette
// liste viennent ensuite, dans l'ordre alphabétique, au sein de leur discipline.
export const ORDRE = `
freud-moi-pas-maitre descartes-malin-genie freud-reve nietzsche-perspectivisme
lacan-stade-du-miroir hegel-maitre-esclave lacan-desir-de-l-autre spinoza-desir
freud-apres-coup platon-reminiscence freud-transfert pascal-divertissement
freud-fort-da schopenhauer-pendule freud-deuil-melancolie epicure-mort
freud-inquietante-etrangete kierkegaard-angoisse klein-positions aristote-akrasia
winnicott-mere-suffisamment-bonne husserl-epoche bion-reverie kant-lumieres
ferenczi-confusion wittgenstein-taire green-mere-morte nietzsche-ressentiment
lacan-ne-pas-ceder ricoeur-soupcon
anna-freud-defenses arendt-banalite-du-mal sartre-mauvaise-foi
laplanche-seduction-generalisee bergson-duree kohut-self nietzsche-mort-de-dieu
nietzsche-freud anzieu-moi-peau weil-attention dolto-image-du-corps
canguilhem-normal-pathologique hegel-kojeve-lacan beauvoir-deuxieme-sexe
merleau-ponty-corps-propre banquet-freud-lacan levinas-visage murdoch-attention
foucault-histoire-de-la-folie nietzsche-eternel-retour aulagnier-violence-interpretation`.trim().split(/\s+/);

/** Lit le texte d'une fiche (4 blocs séparés par une ligne « --- »). */
export function lireTexte(brut, id, discipline) {
  brut = brut.replace(/\r\n/g, '\n');
  const blocs = brut.split(/\n---\n/);
  if (blocs.length !== 4) throw new Error(`4 blocs attendus séparés par ---, trouvé ${blocs.length}`);
  const [tete, corps, quizBrut, sourcesBrut] = blocs;
  const f = { id, discipline };
  for (const ligne of tete.split('\n')) {
    if (!ligne.trim()) continue;
    const m = ligne.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) throw new Error(`ligne d'en-tête illisible : ${ligne}`);
    f[m[1]] = m[2].trim();
  }
  f.liens = (f.liens || '').split(',').map(s => s.trim()).filter(Boolean);
  f.texte = corps.trim();
  f.quiz = [];
  let q = null;
  for (const ligne of quizBrut.split('\n')) {
    if (ligne.startsWith('? ')) { q = { question: ligne.slice(2).trim(), choix: [], bonne: -1, explication: '' }; f.quiz.push(q); }
    else if (ligne.startsWith('- ') || ligne.startsWith('* ')) {
      if (!q) throw new Error(`choix sans question : ${ligne}`);
      if (ligne.startsWith('* ')) q.bonne = q.choix.length;
      q.choix.push(ligne.slice(2).trim());
    } else if (ligne.startsWith('= ')) { if (!q) throw new Error(`explication sans question : ${ligne}`); q.explication = ligne.slice(2).trim(); }
    else if (ligne.trim()) throw new Error(`ligne de quiz illisible : ${ligne}`);
  }
  f.sources = sourcesBrut.split('\n').filter(l => l.startsWith('- ')).map(l => {
    const [texte, url] = l.slice(2).split(' | ').map(x => x && x.trim());
    return { texte, url: url || '' };
  });
  return f;
}

export function lireFiche(chemin, discipline) {
  return lireTexte(readFileSync(chemin, 'utf8'), basename(chemin, '.md'), discipline);
}

export const mots = s => s.replace(/\[\^\d+\]/g, '').replace(/[*_#>]/g, '').split(/\s+/).filter(Boolean).length;

// Toutes les fiches doivent déclarer leur fiabilité.
const STRICT = true;

/** Contrôle la forme d'un ensemble de fiches. Renvoie { erreurs, alertes }. */
export function controler(fiches) {
  const erreurs = [], alertes = [];
  const ids = new Set(fiches.map(f => f.id));
  for (const f of fiches) {
    const E = m => erreurs.push(`${f.id} : ${m}`), A = m => alertes.push(`${f.id} : ${m}`);
    if (!(BRANCHES[f.discipline] || []).some(([c]) => c === f.branche)) E(`branche inconnue « ${f.branche || ''} »`);
    for (const champ of ['titre', 'figure', 'reference', 'accroche', 'punch', 'idee']) if (!f[champ]) E(`champ manquant « ${champ} »`);
    if (!FIABILITE[f.fiabilite]) (STRICT ? E : A)(`fiabilité absente ou inconnue « ${f.fiabilite || ''} » (primaire, mixte ou secondaire)`);
    if (!f.citation && !f.repere) E('ni citation ni repère');
    if (f.citation && !f.citation_source) E('citation sans source');
    if (f.citation && !/^https?:\/\//.test(f.citation_url || '')) E('citation sans lien (citation_url)');
    if (!/^> /m.test(f.texte)) E('aucun encadré d\'illustration (lignes « > »)');
    if (f.punch && f.punch.length > 100) E(`punch trop long (${f.punch.length} > 100)`);
    if (f.idee && f.idee.length > 300) E(`idée trop longue (${f.idee.length} > 300)`);
    if (f.accroche && f.accroche.length > 220) A(`accroche longue (${f.accroche.length})`);
    const n = mots(f.texte);
    if (n < 750 || n > 1800) A(`corps de ${n} mots (attendu 750–1800)`);
    // Voix : la fiche est une leçon, pas un journal de vérification.
    if (/(je n'ai pas pu|je n'ai pas eu|j'ai pu|j'ai consulté|je précise|je traduis|je m'appuie|je ne l'affirme|ma traduction|cette fiche ne|les limites de cette fiche|selon wikipédia|selon stanford|l'encyclopédie de stanford)/i.test(f.texte)) A('le corps parle à la première personne (« je ») : à reformuler');
    // Appels de note : [^n] doit renvoyer à la source n.
    for (const m of f.texte.matchAll(/\[\^(\d+)\]/g)) if (Number(m[1]) < 1 || Number(m[1]) > f.sources.length) E(`appel de note [^${m[1]}] sans source correspondante`);
    if (f.quiz.length < 3) E(`${f.quiz.length} question(s), 3 attendues`);
    f.quiz.forEach((q, i) => {
      if (q.choix.length !== 4) E(`question ${i + 1} : ${q.choix.length} choix au lieu de 4`);
      if (q.bonne < 0) E(`question ${i + 1} : pas de bonne réponse (*)`);
      if (!q.explication) E(`question ${i + 1} : explication manquante`);
      if (q.bonne >= 0) {
        const bonne = q.choix[q.bonne].length;
        const max = Math.max(...q.choix.filter((_, j) => j !== q.bonne).map(c => c.length));
        if (bonne > 1.4 * max) A(`question ${i + 1} : bonne réponse trop longue (${bonne} car. contre ${max})`);
      }
    });
    for (const l of f.liens) if (!ids.has(l)) E(`lien vers une fiche inexistante « ${l} »`);
    if (f.sources.length < 2) E('moins de deux sources');
    for (const so of f.sources) if (!/^https?:\/\//.test(so.url)) E(`source sans lien : ${so.texte}`);
  }
  return { erreurs, alertes };
}

/** Lit toutes les fiches du dossier content/, triées dans l'ordre de parution. */
export function lireCorpus(racine) {
  const fiches = [], echecs = [];
  const dossiers = { philosophie: 'philosophie', psychanalyse: 'psychanalyse', croisement: 'croisements' };
  for (const d of DISCIPLINES) {
    const dossier = join(racine, 'content', dossiers[d]);
    let noms = [];
    try { noms = readdirSync(dossier).filter(n => n.endsWith('.md')).sort(); } catch (e) { continue; }
    for (const nom of noms) {
      try { fiches.push(lireFiche(join(dossier, nom), d)); }
      catch (e) { echecs.push(`${dossiers[d]}/${nom} : ${e.message}`); }
    }
  }
  const rang = id => { const i = ORDRE.indexOf(id); return i < 0 ? 1e6 : i; };
  fiches.sort((a, b) => rang(a.id) - rang(b.id) || a.id.localeCompare(b.id));
  return { fiches, echecs };
}
