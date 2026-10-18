// Après-coup — lit les fiches, les contrôle, et assemble app.html.
// Usage : node build.js            (contrôle + construction)
//         node build.js --check    (contrôle seulement)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DISCIPLINES = ['philosophie', 'psychanalyse'];

// Ordre de parution : alternance philosophie / psychanalyse, les résonances voisines.
// Une fiche absente de cette liste paraît à la suite, dans l'ordre alphabétique.
const ORDRE = `
freud-moi-pas-maitre descartes-malin-genie freud-reve nietzsche-perspectivisme
lacan-stade-du-miroir hegel-maitre-esclave lacan-desir-de-l-autre spinoza-desir
freud-apres-coup platon-reminiscence freud-transfert pascal-divertissement
freud-fort-da schopenhauer-pendule freud-deuil-melancolie epicure-mort
freud-inquietante-etrangete kierkegaard-angoisse klein-positions aristote-akrasia
winnicott-mere-suffisamment-bonne husserl-epoche bion-reverie kant-lumieres
ferenczi-confusion wittgenstein-taire green-mere-morte nietzsche-ressentiment
lacan-ne-pas-ceder ricoeur-soupcon`.trim().split(/\s+/);

function lireFiche(chemin, discipline) {
  const brut = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  const blocs = brut.split(/\n---\n/);
  if (blocs.length !== 4) throw new Error(`4 blocs attendus séparés par ---, trouvé ${blocs.length}`);
  const [tete, corps, quizBrut, sourcesBrut] = blocs;
  const f = { id: basename(chemin, '.md'), discipline };
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
      if (ligne.startsWith('* ')) q.bonne = q.choix.length;
      q.choix.push(ligne.slice(2).trim());
    } else if (ligne.startsWith('= ')) q.explication = ligne.slice(2).trim();
    else if (ligne.trim()) throw new Error(`ligne de quiz illisible : ${ligne}`);
  }
  f.sources = sourcesBrut.split('\n').filter(l => l.startsWith('- ')).map(l => {
    const [texte, url] = l.slice(2).split(' | ').map(x => x && x.trim());
    return { texte, url: url || '' };
  });
  return f;
}

const mots = s => s.replace(/[*_#>]/g, '').split(/\s+/).filter(Boolean).length;

function controler(fiches) {
  const erreurs = [], alertes = [];
  const ids = new Set(fiches.map(f => f.id));
  const positions = [0, 0, 0, 0];
  for (const f of fiches) {
    const E = m => erreurs.push(`${f.id} : ${m}`), A = m => alertes.push(`${f.id} : ${m}`);
    for (const champ of ['titre', 'figure', 'reference', 'accroche', 'punch', 'idee']) if (!f[champ]) E(`champ manquant « ${champ} »`);
    const aVerifier = f.statut === 'a_verifier';
    if (aVerifier) A('fiche ancienne, pas encore revérifiée en ligne');
    if (!f.citation && !f.repere) E('ni citation ni repère');
    if (f.citation && !f.citation_source) E('citation sans source');
    if (!aVerifier && f.citation && !/^https?:\/\//.test(f.citation_url || '')) E('citation sans lien (citation_url)');
    if (!aVerifier && !/^> /m.test(f.texte)) E('aucun encadré d\'exemple (lignes « > »)');
    if (f.punch && f.punch.length > 100) E(`punch trop long (${f.punch.length} > 100)`);
    if (f.idee && f.idee.length > 300) E(`idée trop longue (${f.idee.length} > 300)`);
    if (f.accroche && f.accroche.length > 220) A(`accroche longue (${f.accroche.length})`);
    const n = mots(f.texte);
    if (!aVerifier && (n < 750 || n > 1800)) A(`corps de ${n} mots (attendu 750–1800)`);
    if (f.quiz.length < 3) E(`${f.quiz.length} question(s), 3 attendues`);
    f.quiz.forEach((q, i) => {
      if (q.choix.length !== 4) E(`question ${i + 1} : ${q.choix.length} choix au lieu de 4`);
      if (q.bonne < 0) E(`question ${i + 1} : pas de bonne réponse (*)`);
      if (!q.explication) E(`question ${i + 1} : explication manquante`);
      if (q.bonne >= 0) {
        positions[q.bonne]++;
        const bonne = q.choix[q.bonne].length;
        const max = Math.max(...q.choix.filter((_, j) => j !== q.bonne).map(c => c.length));
        if (bonne > 1.4 * max) A(`question ${i + 1} : bonne réponse trop longue (${bonne} car. contre ${max})`);
      }
    });
    for (const l of f.liens) if (!ids.has(l)) E(`lien vers une fiche inexistante « ${l} »`);
    if (!aVerifier && f.sources.length < 2) E('moins de deux sources');
    if (!aVerifier) for (const so of f.sources) if (!/^https?:\/\//.test(so.url)) E(`source sans lien : ${so.texte}`);
  }
  return { erreurs, alertes, positions };
}

const fiches = [];
const echecs = [];
for (const d of DISCIPLINES) {
  const dossier = join(ICI, 'content', d);
  for (const nom of readdirSync(dossier).filter(n => n.endsWith('.md')).sort()) {
    try { fiches.push(lireFiche(join(dossier, nom), d)); }
    catch (e) { echecs.push(`${d}/${nom} : ${e.message}`); }
  }
}
const rang = id => { const i = ORDRE.indexOf(id); return i < 0 ? 1e6 : i; };
fiches.sort((a, b) => rang(a.id) - rang(b.id) || a.id.localeCompare(b.id));

const { erreurs, alertes, positions } = controler(fiches);
erreurs.unshift(...echecs);
const parD = d => fiches.filter(f => f.discipline === d).length;
console.log(`${fiches.length} fiches — philosophie ${parD('philosophie')}, psychanalyse ${parD('psychanalyse')}`);
console.log(`Position des bonnes réponses : ${positions.map((n, i) => `${'ABCD'[i]} ${n}`).join(' · ')}`);
for (const a of alertes) console.log('  alerte  ' + a);
for (const e of erreurs) console.log('  ERREUR  ' + e);
if (erreurs.length) { console.log(`\n${erreurs.length} erreur(s) : construction annulée.`); process.exit(1); }

if (!process.argv.includes('--check')) {
  const gabarit = readFileSync(join(ICI, 'app.src.html'), 'utf8');
  // Typographie française : espaces insécables autour de « » et devant ; : ! ?
  const typo = t => t.replace(/« /g, '«\u00a0').replace(/ ([»;:!?])/g, '\u00a0$1');
  const fiches2 = JSON.parse(JSON.stringify(fiches), (k, v) => typeof v === 'string' && k !== 'id' ? typo(v) : v);
  const donnees = JSON.stringify(fiches2).replace(/</g, '\\u003c');
  if (!gabarit.includes('/*__FICHES__*/[]')) throw new Error('marqueur /*__FICHES__*/[] absent du gabarit');
  const page = gabarit.replace('/*__FICHES__*/[]', donnees).replace('/*__BUILD__*/0', String(Date.now()));
  writeFileSync(join(ICI, 'app.html'), page);
  console.log('\napp.html écrit (version Claude).');

  // Version installable (PWA) : document complet + manifeste + service worker + icônes → dist/
  const dist = ICI;
  mkdirSync(dist, { recursive: true });
  const tete = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ECEEE9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121618" media="(prefers-color-scheme: dark)">
<meta name="robots" content="noindex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>`;
  const pied = `<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script></body></html>`;
  writeFileSync(join(dist, 'index.html'), tete + page + pied);
  const version = createHash('sha256').update(page).digest('hex').slice(0, 12);
  writeFileSync(join(dist, 'sw.js'), readFileSync(join(ICI, 'pwa', 'sw.js'), 'utf8').replace('__VERSION__', version));
  for (const f of ['manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'icone-maskable-512.png', 'apple-touch-icon.png']) copyFileSync(join(ICI, 'pwa', f), join(dist, f));
  writeFileSync(join(dist, '.nojekyll'), '');
  console.log(`site écrit à la racine (version installable, cache ${version}).`);
}
