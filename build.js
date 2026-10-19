// Après-coup — contrôle les fiches et assemble l'app.
// Usage : node build.js            (contrôle + construction)
//         node build.js --check    (contrôle seulement)
//
// Sorties :
//   app.html            version d'un seul tenant, pour l'aperçu dans Claude (polices Google)
//   index.html, sw.js…  version installable (PWA) servie par GitHub Pages, polices embarquées
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireCorpus, controler, BRANCHES, FIABILITE, DISCIPLINES } from './src/fiches.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const lire = p => readFileSync(join(ICI, p), 'utf8');

const { fiches, echecs } = lireCorpus(ICI);
const { erreurs, alertes } = controler(fiches);
erreurs.unshift(...echecs);
console.log(`${fiches.length} fiches — ${DISCIPLINES.map(d => `${d} ${fiches.filter(f => f.discipline === d).length}`).join(', ')}`);
for (const a of alertes) console.log('  alerte  ' + a);
for (const e of erreurs) console.log('  ERREUR  ' + e);
if (erreurs.length) { console.log(`\n${erreurs.length} erreur(s) : construction annulée.`); process.exit(1); }
if (process.argv.includes('--check')) process.exit(0);

// ---------- Assemblage ----------
// Typographie française : espaces insécables autour de « » et devant ; : ! ?
const typo = t => t.replace(/« /g, '« ').replace(/ ([»;:!?])/g, ' $1');
const donnees = JSON.parse(JSON.stringify(fiches), (k, v) => typeof v === 'string' && !['id', 'url', 'citation_url', 'branche', 'discipline', 'fiabilite'].includes(k) ? typo(v) : v);
const json = v => JSON.stringify(v).replace(/</g, '\\u003c');
// Les modules ESM de src/ deviennent un seul script : on retire import et export.
const sansModule = s => s.replace(/^import .*$/gm, '').replace(/^export (?=(const|let|function|async function|class) )/gm, '');
const code = ['logique.js', 'voix.js', 'carte.js', 'app.js'].map(f => `// ===== ${f} =====\n` + sansModule(lire('src/' + f))).join('\n');
const gabarit = lire('src/page.html');
const assembler = (version, polices) => gabarit
  .replace('<!--POLICES-->', () => polices)
  .replace('/*STYLE*/', () => lire('src/style.css'))
  .replace('/*SCRIPT*/', () => `const FICHES = ${json(donnees)};\nconst BRANCHES = ${json(BRANCHES)};\nconst FIABILITE = ${json(FIABILITE)};\nconst VERSION = ${json(version)};\n${code}`);

// Version stable : la date ne change que si le contenu ou le code changent,
// ce qui évite de faire retélécharger l'app pour rien.
const empreinte = createHash('sha256').update(assembler({}, '')).digest('hex').slice(0, 12);
const fichierVersion = join(ICI, 'version.json');
let version = existsSync(fichierVersion) ? JSON.parse(readFileSync(fichierVersion, 'utf8')) : {};
if (version.empreinte !== empreinte) {
  version = { empreinte, date: Date.now() };
  writeFileSync(fichierVersion, JSON.stringify(version, null, 2) + '\n');
}

const policesGoogle = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gloock&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Spline+Sans+Mono:wght@400;500&display=swap">`;
writeFileSync(join(ICI, 'app.html'), assembler(version, policesGoogle));
console.log('\napp.html écrit (aperçu Claude).');

// ---------- Version installable ----------
const policesLocales = `<style>\n${lire('pwa/polices/polices.css')}</style>`;
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
writeFileSync(join(ICI, 'index.html'), tete + assembler(version, policesLocales) + pied);
mkdirSync(join(ICI, 'polices'), { recursive: true });
const polices = readdirSync(join(ICI, 'pwa/polices')).filter(n => n.endsWith('.woff2'));
for (const p of polices) copyFileSync(join(ICI, 'pwa/polices', p), join(ICI, 'polices', p));
writeFileSync(join(ICI, 'sw.js'), lire('pwa/sw.js')
  .replace('__VERSION__', empreinte)
  .replace("'__POLICES__'", polices.map(p => `'./polices/${p}'`).join(', ')));
for (const f of ['manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'icone-maskable-512.png', 'apple-touch-icon.png']) copyFileSync(join(ICI, 'pwa', f), join(ICI, f));
writeFileSync(join(ICI, '.nojekyll'), '');
console.log(`site écrit à la racine (version installable, cache ${empreinte}).`);
