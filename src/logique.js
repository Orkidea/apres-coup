// Après-coup — la logique, sans aucun accès à la page (testée dans test/).
// Dans l'app, ce fichier est recopié tel quel, sans les mots-clés « export ».

// ---------- Dates locales (chaînes AAAA-MM-JJ) ----------
export const pad = n => String(n).padStart(2, '0');
export const jourDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ecart = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
};
export const decaler = (j, n) => { const [y, m, d] = j.split('-').map(Number); return jourDe(new Date(y, m - 1, d + n)); };

// ---------- Paramètres ----------
// Rotation des disciplines, jour après jour. Un croisement tous les cinq jours.
export const MOTIF = {
  alterne: ['psychanalyse', 'philosophie', 'psychanalyse', 'philosophie', 'croisement'],
  philosophie: ['philosophie', 'philosophie', 'philosophie', 'philosophie', 'croisement'],
  psychanalyse: ['psychanalyse', 'psychanalyse', 'psychanalyse', 'psychanalyse', 'croisement'],
};
// Rappel espacé : après une erreur, la question revient le lendemain ; une bonne
// réponse la fait passer à la boîte suivante (7 jours, puis 30). Après la boîte 2,
// une bonne réponse la retire du rappel.
export const INTERVALLES = [1, 7, 30];

// ---------- État ----------
export function etatVide(auj) {
  return {
    version: 2, debut: auj, lues: {}, relues: {}, quiz: {}, notes: {}, revisions: {}, servies: [], jour: null, tour: 0,
    reglages: { rythme: 'alterne', acces: 'jour', theme: 'auto', voix: '', vitesse: 1, exclues: [] },
    reglagesLe: 0, dernierExport: null,
  };
}

const objet = v => v && typeof v === 'object' && !Array.isArray(v);

/** Complète un état lu (localStorage, import, synchronisation) et migre l'ancien format. */
export function normaliser(brut, auj, fiches = []) {
  const src = objet(brut) ? brut : {};
  const e = Object.assign(etatVide(auj), src);
  e.reglages = Object.assign(etatVide(auj).reglages, objet(src.reglages) ? src.reglages : {});
  if (!Array.isArray(e.reglages.exclues)) e.reglages.exclues = [];
  for (const k of ['lues', 'relues', 'quiz', 'notes', 'revisions']) if (!objet(e[k])) e[k] = {};
  if (!Array.isArray(e.servies)) e.servies = [];
  if (!objet(e.jour) || typeof e.jour.date !== 'string') e.jour = null;
  if (!Number.isFinite(e.tour)) e.tour = 0;
  if (src.version !== 2) {
    // Version 1 : pas de file des séances servies, pas de rappel espacé.
    for (const id of Object.keys(e.lues)) if (!e.servies.includes(id)) e.servies.push(id);
    const parId = Object.fromEntries(fiches.map(f => [f.id, f]));
    for (const [id, reps] of Object.entries(e.quiz)) {
      const f = parId[id]; if (!f || !Array.isArray(reps)) continue;
      reps.forEach((r, qi) => {
        if (r == null || !f.quiz[qi]) return;
        const cle = cleQ(id, qi);
        if (e.revisions[cle]) return;
        e.revisions[cle] = r === f.quiz[qi].bonne
          ? { boite: 1, echeance: decaler(auj, INTERVALLES[1]), ratees: 0, vue: auj }
          : { boite: 0, echeance: auj, ratees: 1, vue: auj };
      });
    }
    e.tour = Object.keys(e.lues).length;
    e.jour = null;
    e.version = 2;
  }
  return e;
}

/** Fusionne deux états (synchronisation, import) sans rien perdre. */
export function fusionner(a, b, auj) {
  const r = etatVide(auj);
  r.debut = [a.debut, b.debut].filter(Boolean).sort()[0] || auj;
  r.lues = { ...(b.lues || {}) };
  for (const [id, j] of Object.entries(a.lues || {})) if (!r.lues[id] || j < r.lues[id]) r.lues[id] = j;
  r.relues = { ...(b.relues || {}) };
  for (const [id, j] of Object.entries(a.relues || {})) if (!r.relues[id] || j > r.relues[id]) r.relues[id] = j;
  r.quiz = { ...(b.quiz || {}) };
  for (const [id, rep] of Object.entries(a.quiz || {})) {
    const autre = r.quiz[id] || [];
    r.quiz[id] = (rep || []).map((v, i) => v ?? autre[i] ?? null);
    for (let i = (rep || []).length; i < autre.length; i++) r.quiz[id][i] = autre[i];
  }
  r.notes = { ...(b.notes || {}) };
  for (const [id, n] of Object.entries(a.notes || {})) if (!r.notes[id] || (n.le || 0) > (r.notes[id].le || 0)) r.notes[id] = n;
  r.revisions = { ...(b.revisions || {}) };
  for (const [c, v] of Object.entries(a.revisions || {})) if (!r.revisions[c] || (v.vue || '') >= (r.revisions[c].vue || '')) r.revisions[c] = v;
  r.servies = [...new Set([...(b.servies || []), ...(a.servies || [])])];
  const ja = a.jour, jb = b.jour;
  r.jour = ja && (!jb || ja.date >= jb.date) ? ja : (jb || null);
  r.tour = Math.max(a.tour || 0, b.tour || 0);
  r.dernierExport = [a.dernierExport, b.dernierExport].filter(Boolean).sort().pop() || null;
  const plusRecent = (a.reglagesLe || 0) >= (b.reglagesLe || 0) ? a : b;
  r.reglages = Object.assign(etatVide(auj).reglages, plusRecent.reglages || {});
  r.reglagesLe = plusRecent.reglagesLe || 0;
  return r;
}

// ---------- Sélection et ordre des séances ----------
/** Les fiches retenues par les réglages (rythme et branches). Les croisements sont de tous les rythmes. */
export function selection(fiches, reglages) {
  const ex = new Set(reglages.exclues || []), r = reglages.rythme || 'alterne';
  const garde = f => r === 'alterne' || f.discipline === r || f.discipline === 'croisement';
  const s = fiches.filter(f => garde(f) && !ex.has(f.branche));
  return s.some(f => f.discipline !== 'croisement') ? s : fiches.filter(garde);
}
const parDiscipline = sel => ({
  psychanalyse: sel.filter(f => f.discipline === 'psychanalyse'),
  philosophie: sel.filter(f => f.discipline === 'philosophie'),
  croisement: sel.filter(f => f.discipline === 'croisement'),
});
const motifDe = reglages => MOTIF[reglages.rythme] || MOTIF.alterne;

/** L'ordre de lecture prévu pour une première lecture, qui sert aussi à numéroter les séances. */
export function suiteOrdonnee(fiches, reglages) {
  const sel = selection(fiches, reglages), L = parDiscipline(sel), motif = motifDe(reglages);
  const pos = { psychanalyse: 0, philosophie: 0, croisement: 0 }, out = [];
  for (let i = 0; out.length < sel.length && i < sel.length * motif.length + motif.length; i++) {
    const d = motif[i % motif.length];
    if (pos[d] < L[d].length) out.push(L[d][pos[d]++]);
  }
  return out;
}

/**
 * La prochaine séance à servir : dans la discipline du tour, la première fiche non lue.
 * Une fiche servie mais pas lue revient donc à son prochain tour : aucune n'est sautée.
 * Si tout est lu, le cycle recommence par la fiche lue il y a le plus longtemps.
 */
export function prochaine(fiches, etat) {
  const sel = selection(fiches, etat.reglages), L = parDiscipline(sel), motif = motifDe(etat.reglages);
  for (let k = 0; k < motif.length; k++) {
    const d = motif[(etat.tour + k) % motif.length];
    const f = L[d].find(f => !etat.lues[f.id]);
    if (f) return { id: f.id, relecture: false };
  }
  const ordre = suiteOrdonnee(fiches, etat.reglages);
  if (!ordre.length) return null;
  const rang = id => ordre.findIndex(f => f.id === id);
  const derniere = id => [etat.lues[id] || '', (etat.relues || {})[id] || ''].sort().pop();
  const plusAncienne = [...ordre].sort((a, b) => derniere(a.id).localeCompare(derniere(b.id)) || rang(a.id) - rang(b.id))[0];
  return { id: plusAncienne.id, relecture: true };
}

/**
 * La séance du jour. Une fois choisie, elle ne change plus de la journée, même si
 * les réglages changent. Renvoie { id, relecture, nouvelle } ; si nouvelle est vrai,
 * l'appelant applique servir().
 */
export function seanceDuJour(fiches, etat, auj) {
  const existe = id => fiches.some(f => f.id === id);
  if (etat.jour && etat.jour.date === auj && existe(etat.jour.id)) return { ...etat.jour, nouvelle: false };
  const p = prochaine(fiches, etat);
  return p && { date: auj, ...p, nouvelle: true };
}
export function servir(etat, choix) {
  etat.jour = { date: choix.date, id: choix.id, relecture: !!choix.relecture };
  etat.tour = (etat.tour || 0) + 1;
  if (!etat.servies.includes(choix.id)) etat.servies.push(choix.id);
}
/** La séance de demain, si celle d'aujourd'hui est lue. */
export function seanceDeDemain(fiches, etat, auj) {
  const copie = { ...etat, lues: { ...etat.lues }, relues: { ...(etat.relues || {}) }, tour: etat.tour };
  if (etat.jour && etat.jour.date === auj) { if (copie.lues[etat.jour.id]) copie.relues[etat.jour.id] = auj; else copie.lues[etat.jour.id] = auj; }
  return prochaine(fiches, copie);
}
/** Les fiches accessibles dans la bibliothèque. */
export function ouvertes(fiches, etat) {
  if (etat.reglages.acces === 'tout') return new Set(fiches.map(f => f.id));
  const ids = new Set([...etat.servies, ...Object.keys(etat.lues)]);
  if (etat.jour) ids.add(etat.jour.id);
  return ids;
}
/** Vrai si toute la sélection a été lue au moins une fois. */
export function cycleAcheve(fiches, etat) {
  const sel = selection(fiches, etat.reglages);
  return sel.length > 0 && sel.every(f => etat.lues[f.id]);
}

// ---------- Rappel espacé ----------
export const cleQ = (id, qi) => `${id}#${qi}`;
export function enregistrerReponse(etat, id, qi, juste, auj) {
  const c = cleQ(id, qi), r = { boite: 0, ratees: 0, ...(etat.revisions[c] || {}) };
  if (juste) {
    r.boite = Math.min(r.boite + 1, INTERVALLES.length);
    r.echeance = r.boite >= INTERVALLES.length ? null : decaler(auj, INTERVALLES[r.boite]);
  } else {
    r.boite = 0; r.ratees += 1; r.echeance = decaler(auj, INTERVALLES[0]);
  }
  r.vue = auj;
  etat.revisions[c] = r;
  return r;
}
/** Les questions à revoir aujourd'hui : d'abord les plus souvent ratées, puis les plus anciennes. */
export function aRevoir(fiches, etat, auj, max = Infinity) {
  const parId = Object.fromEntries(fiches.map(f => [f.id, f]));
  return Object.entries(etat.revisions)
    .map(([c, r]) => { const i = c.lastIndexOf('#'); return { id: c.slice(0, i), qi: Number(c.slice(i + 1)), ...r }; })
    .filter(r => r.echeance && r.echeance <= auj && parId[r.id] && parId[r.id].quiz[r.qi])
    .sort((a, b) => b.ratees - a.ratees || a.echeance.localeCompare(b.echeance) || a.id.localeCompare(b.id) || a.qi - b.qi)
    .slice(0, max);
}

// ---------- Texte ----------
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const enLigne = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[\^(\d+)\]/g, '<sup class="appel"><a href="#source-$1" aria-label="source $1">$1</a></sup>');

/** Sépare l'en-tête « **Exemple (…).** » ou « **Illustration (…).** » d'un encadré. */
export function enteteIllustration(t) {
  const m = t.match(/^\*\*(?:Exemple|Illustration)\b([^*]*)\*\*\s*/);
  if (!m) return null;
  let note = m[1].trim().replace(/^[,:;]\s*/, '').replace(/\.$/, '').trim();
  if (/^\(.*\)$/.test(note)) note = note.slice(1, -1).trim();
  note = note.replace(/^une illustration\b[,;]?\s*/i, '').replace(/\.$/, '').trim();
  return { note, reste: t.slice(m[0].length) };
}

export function markdown(txt) {
  return txt.split(/\n{2,}/).map(bloc => {
    if (bloc.startsWith('## ')) return `<h2>${enLigne(bloc.slice(3))}</h2>`;
    const lignes = bloc.split('\n');
    if (lignes.every(l => l.startsWith('>'))) {
      const paras = lignes.map(l => l.replace(/^> ?/, '')).join('\n').split(/\n(?=\S)/).filter(t => t.trim());
      const h = paras.length ? enteteIllustration(paras[0]) : null;
      if (h) paras[0] = h.reste;
      const tete = h ? `<p class="ill-tete"><span class="ill-label">Illustration</span>${h.note ? `<span class="ill-note">${enLigne(h.note)}</span>` : ''}</p>` : '';
      return `<aside class="exemple">${tete}${paras.filter(t => t.trim()).map(t => `<p>${enLigne(t)}</p>`).join('')}</aside>`;
    }
    if (lignes.every(l => l.startsWith('- '))) return `<ul>${lignes.map(l => `<li>${enLigne(l.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${enLigne(lignes.join(' '))}</p>`;
  }).join('');
}
/** Texte à lire à voix haute : sans balisage ni appels de note. */
export const texteBrut = s => s.replace(/\[\^\d+\]/g, '').replace(/^## /gm, '').replace(/\*\*?/g, '').replace(/^- /gm, '').replace(/^> ?/gm, '');

export function hache(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function melange(n, graine) {
  const ordre = [...Array(n).keys()]; let x = graine || 1;
  for (let i = n - 1; i > 0; i--) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; const j = x % (i + 1); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
  return ordre;
}
export const NOMBRES = ['Aucune question', 'Une question', 'Deux questions', 'Trois questions', 'Quatre questions', 'Cinq questions', 'Six questions'];
export const titreQuiz = n => NOMBRES[n] || `${n} questions`;

/** Toutes les notes, en Markdown, pour les garder hors de l'app. */
export function notesEnMarkdown(fiches, etat, maintenant = new Date()) {
  const parId = Object.fromEntries(fiches.map(f => [f.id, f]));
  const notes = Object.entries(etat.notes).filter(([id, n]) => parId[id] && n && n.texte && n.texte.trim())
    .sort((a, b) => (a[1].le || 0) - (b[1].le || 0));
  const date = maintenant.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  let md = `# Après-coup — mes notes\n\nExport du ${date}. ${notes.length} note${notes.length > 1 ? 's' : ''}.\n`;
  for (const [id, n] of notes) {
    const f = parId[id];
    md += `\n## ${f.titre} — ${f.figure}\n\n*${f.reference}*`;
    if (etat.lues[id]) md += ` · séance lue le ${etat.lues[id]}`;
    md += `\n\n${n.texte.trim()}\n`;
  }
  return md;
}
