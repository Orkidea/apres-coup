// Après-coup — l'interface. Les fonctions de logique.js, voix.js et carte.js sont
// disponibles ici : build.js assemble les fichiers en un seul script.
// FICHES, BRANCHES, FIABILITE et VERSION sont injectés par build.js.

const PAR_ID = Object.fromEntries(FICHES.map(f => [f.id, f]));
const NOM_DISC = { philosophie: 'Philosophie', psychanalyse: 'Psychanalyse', croisement: 'Croisements' };
const ENCRE = { philosophie: 'philo', psychanalyse: 'psy', croisement: 'croise' };
const DISC_PRESENTES = Object.keys(NOM_DISC).filter(d => FICHES.some(f => f.discipline === d));
const CLE = 'apres-coup.etat.v1';
const CLE_VUE = 'apres-coup.vue.v1';
const OUVERTE_LE = Date.now();
const APERCU = !!(window.claude && window.claude.use); // version Claude (artifact)

const aujourdhui = () => jourDe(new Date());
const inkVars = d => `--ink: var(--${ENCRE[d]}); --voile: var(--${ENCRE[d]}-voile);`;
const dateLongue = j => { const [y, m, d] = j.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
const dateHeure = ms => new Date(ms).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const pluriel = (n, mot, pl = mot + 's') => `${n} ${n > 1 ? pl : mot}`;

// ---------- État ----------
function chargerBrut() { try { const s = localStorage.getItem(CLE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
let etat = normaliser(chargerBrut(), aujourdhui(), FICHES);

let docDistant = null, minuterieSync = null, syncTexte = '';
function enregistrer() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
  if (!docDistant) return;
  clearTimeout(minuterieSync);
  minuterieSync = setTimeout(async () => {
    try { await docDistant.set(JSON.parse(JSON.stringify(etat))); syncTexte = 'Synchronisé entre tes sessions Claude.'; }
    catch (e) { syncTexte = 'Synchronisation momentanément indisponible.'; }
  }, 1200);
}
async function brancherSync() {
  try {
    if (!APERCU) return;
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    docDistant = db.doc('data/users/' + uid + '/progression');
    const snap = await docDistant.get();
    if (snap.exists) etat = normaliser(fusionner(etat, normaliser(snap.data(), aujourdhui(), FICHES), aujourdhui()), aujourdhui(), FICHES);
    syncTexte = 'Synchronisé entre tes sessions Claude.';
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
    await docDistant.set(JSON.parse(JSON.stringify(etat)));
    appliquerTheme(); rendre();
  } catch (e) { docDistant = null; }
}

// Demande au navigateur de ne pas effacer les données de l'app quand l'espace manque.
let stockageProtege = null;
async function protegerStockage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    stockageProtege = (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch (e) {}
}

// ---------- Séances ----------
function seanceCourante() {
  const c = seanceDuJour(FICHES, etat, aujourdhui());
  if (c && c.nouvelle) { servir(etat, c); enregistrer(); }
  return c;
}
function numeroDe(id) { const i = suiteOrdonnee(FICHES, etat.reglages).findIndex(f => f.id === id); return i < 0 ? null : i + 1; }
function marquerLue(id) {
  const auj = aujourdhui();
  if (!etat.lues[id]) etat.lues[id] = auj;
  else if (etat.lues[id] !== auj) etat.relues[id] = auj;
  if (!etat.servies.includes(id)) etat.servies.push(id);
  enregistrer();
}
const lueAujourdhui = id => etat.lues[id] === aujourdhui() || etat.relues[id] === aujourdhui();

// ---------- Navigation ----------
let onglet = 'jour', lecture = null, filtre = 'tout', requete = '', confirmerRaz = false, messageDonnees = '';
try {
  const v = JSON.parse(localStorage.getItem(CLE_VUE) || 'null');
  if (v) { if (['jour', 'biblio', 'carnet', 'reglages'].includes(v.onglet)) onglet = v.onglet; if (v.lecture && PAR_ID[v.lecture]) lecture = v.lecture; }
} catch (e) {}
let derniereY = 0; try { derniereY = Number((JSON.parse(localStorage.getItem(CLE_VUE) || '{}')).y) || 0; } catch (e) {}
function sauverVue() { try { localStorage.setItem(CLE_VUE, JSON.stringify({ onglet, lecture, y: lecture ? Math.round(window.scrollY) : 0 })); } catch (e) {} }
let minuterieY = null;
window.addEventListener('scroll', () => { clearTimeout(minuterieY); minuterieY = setTimeout(sauverVue, 250); }, { passive: true });
const $vue = document.getElementById('vue');
document.getElementById('onglets').addEventListener('click', e => {
  const b = e.target.closest('[data-onglet]'); if (!b) return;
  arreterVoix(); lecture = null; onglet = b.dataset.onglet; messageDonnees = ''; rendre(); window.scrollTo(0, 0);
});
function ouvrir(id) { arreterVoix(); lecture = id; rendre(); window.scrollTo(0, 0); }

let observateurFin = null, minuterieCompte = null;
function rendre() {
  sauverVue();
  clearInterval(minuterieCompte);
  document.getElementById('date-du-jour').textContent = dateLongue(aujourdhui());
  for (const b of document.querySelectorAll('.onglet')) b.setAttribute('aria-current', b.dataset.onglet === onglet && !lecture ? 'page' : 'false');
  if (!FICHES.length) { $vue.innerHTML = '<section class="vue"><p class="vide" style="padding-top:24px">Aucune fiche : lance <code>node build.js</code>.</p></section>'; return; }
  if (lecture) return rendreLecture(PAR_ID[lecture]);
  window.onscroll = null; if (observateurFin) { observateurFin.disconnect(); observateurFin = null; }
  ({ jour: rendreJour, biblio: rendreBiblio, carnet: rendreCarnet, reglages: rendreReglages })[onglet]();
}

// ---------- Questions (séance, rappel) ----------
function marquerChoix(zone, bonne, choisi) {
  for (const b of zone.querySelectorAll('button')) {
    const i = Number(b.dataset.i); b.disabled = true;
    if (i === bonne) b.classList.add('juste'); else if (i === choisi) b.classList.add('faux'); else b.classList.add('estompe');
  }
}
function htmlRappel(r, n) {
  const f = PAR_ID[r.id], q = f.quiz[r.qi], ordre = melange(q.choix.length, hache(f.id + r.qi));
  const etiquette = r.ratees ? `ratée ${r.ratees === 1 ? 'une fois' : r.ratees + ' fois'}` : 'à consolider';
  return `<section class="rappel" style="${inkVars(f.discipline)}" data-cle="${esc(cleQ(r.id, r.qi))}">
    <span class="etiquette">${esc(f.titre)} · ${etiquette}</span>
    <h2>${esc(q.question)}</h2>
    <div class="choix">${ordre.map(i => `<button data-i="${i}">${esc(q.choix[i])}</button>`).join('')}</div>
    <p class="explication" hidden></p>
  </section>`;
}
function brancherRappels() {
  for (const zone of $vue.querySelectorAll('.rappel[data-cle]')) {
    const c = zone.dataset.cle, i = c.lastIndexOf('#'), id = c.slice(0, i), qi = Number(c.slice(i + 1));
    const q = PAR_ID[id].quiz[qi], choix = zone.querySelector('.choix');
    choix.onclick = e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const ch = Number(b.dataset.i), juste = ch === q.bonne;
      marquerChoix(choix, q.bonne, ch);
      const r = enregistrerReponse(etat, id, qi, juste, aujourdhui()); enregistrer();
      const suite = juste ? (r.echeance ? `Elle reviendra le ${dateLongue(r.echeance)}.` : 'Elle sort du rappel.') : 'Elle reviendra demain.';
      const ex = zone.querySelector('.explication'); ex.hidden = false;
      ex.innerHTML = `<strong>${juste ? 'Retenu.' : 'Pas tout à fait.'}</strong> ${esc(q.explication)} <em>${suite}</em> <button class="bouton discret" data-ouvrir="${id}">Revoir la séance →</button>`;
      ex.querySelector('[data-ouvrir]').onclick = () => ouvrir(id);
    };
  }
}

// ---------- Aujourd'hui ----------
function rendreJour() {
  const auj = aujourdhui(), c = seanceCourante();
  if (!c) { $vue.innerHTML = '<section class="vue"><p class="vide">Aucune séance dans ta sélection : vérifie tes branches dans les réglages.</p></section>'; return; }
  const f = PAR_ID[c.id], lu = c.relecture ? lueAujourdhui(f.id) : !!etat.lues[f.id];
  const total = suiteOrdonnee(FICHES, etat.reglages).length;
  const demain = lu ? seanceDeDemain(FICHES, etat, auj) : null;
  const dus = aRevoir(FICHES, etat, auj, 3), tousDus = aRevoir(FICHES, etat, auj).length;
  const prolonger = f.liens.map(id => PAR_ID[id]).filter(l => l && !etat.lues[l.id])[0];
  const debutant = !Object.keys(etat.lues).length;
  $vue.innerHTML = `
  <section class="vue">
    ${c.relecture ? `<p class="fin-cycle" style="${inkVars(f.discipline)}">Tu as lu les ${total} séances de ta sélection. Le cycle reprend : chaque jour revient la séance lue il y a le plus longtemps. Les nouvelles fiches passeront devant dès leur parution.</p>` : ''}
    <article class="une" style="${inkVars(f.discipline)}">
      <div class="rang" style="justify-content:space-between">
        <span class="disc ${f.discipline}">${NOM_DISC[f.discipline]}</span>
        <span class="seance-num">${c.relecture ? 'Relecture' : `Séance n° ${numeroDe(f.id) ?? '—'} / ${total}`}</span>
      </div>
      <h1>${esc(f.titre)}</h1>
      <div class="figure">${esc(f.figure)}</div>
      <p class="accroche">${esc(f.accroche)}</p>
      <div class="rang" style="margin-top:8px">
        <button class="bouton" id="lire">${lu ? 'Relire la séance' : c.relecture ? 'Relire la séance' : 'Commencer la séance'} →</button>
      </div>
      ${lu ? `<div class="verrou">
        <span class="etiquette">Séance suivante dans</span>
        <span class="compte" id="compte">--:--:--</span>
        ${demain ? `<p>Demain : <span class="disc ${PAR_ID[demain.id].discipline}">${NOM_DISC[PAR_ID[demain.id].discipline]}</span></p>` : ''}
      </div>` : ''}
    </article>
    ${dus.length ? `<div style="display:grid;gap:14px">
      <div class="section-titre"><span class="etiquette">À revoir aujourd'hui</span><span class="etiquette">${tousDus > dus.length ? `${dus.length} sur ${tousDus}` : pluriel(dus.length, 'question')}</span></div>
      ${dus.map(htmlRappel).join('')}
    </div>` : ''}
    ${prolonger ? `<div style="display:grid;gap:10px"><span class="etiquette">Pour prolonger</span>
      <button class="suggestion" data-id="${prolonger.id}" style="${inkVars(prolonger.discipline)}">
        <span class="disc ${prolonger.discipline}">${NOM_DISC[prolonger.discipline]} · ${esc(prolonger.figure)}</span>
        <span class="t">${esc(prolonger.titre)}</span>
        <span class="explication">${esc(prolonger.accroche)}</span>
      </button></div>` : ''}
    ${debutant ? `<p class="explication">Une séance par jour, en alternance entre philosophie et psychanalyse, avec un croisement des deux tous les cinq jours. Une séance non lue n'est pas perdue : elle revient à son prochain tour. Les questions ratées reviennent ici le lendemain, puis à une semaine, puis à un mois.</p>` : ''}
  </section>`;
  document.getElementById('lire').onclick = () => ouvrir(f.id);
  const sug = $vue.querySelector('.suggestion'); if (sug) sug.onclick = () => ouvrir(sug.dataset.id);
  brancherRappels();
  if (lu) {
    const maj = () => {
      const el = document.getElementById('compte'); if (!el) return clearInterval(minuterieCompte);
      const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const t = Math.max(0, Math.floor((m - n) / 1000));
      el.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`; if (t === 0) rendre();
    };
    maj(); minuterieCompte = setInterval(maj, 1000);
  }
}

// ---------- Bibliothèque ----------
function rendreBiblio() {
  const ouv = ouvertes(FICHES, etat), s = suiteOrdonnee(FICHES, etat.reglages);
  const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(requete.trim());
  if (filtre !== 'tout' && !DISC_PRESENTES.includes(filtre)) filtre = 'tout';
  const visibles = s.filter(f => ouv.has(f.id)).filter(f => filtre === 'tout' || f.discipline === filtre)
    .filter(f => !q || norm(`${f.titre} ${f.figure} ${f.reference} ${f.texte}`).includes(q));
  const restantes = s.filter(f => !ouv.has(f.id)).length;
  const rangDans = f => filtre === 'tout' ? numeroDe(f.id) : s.filter(g => g.discipline === filtre).findIndex(g => g.id === f.id) + 1;
  $vue.innerHTML = `
  <section class="vue">
    <div class="outils">
      <div class="filtres" role="group" aria-label="Discipline">
        ${['tout', ...DISC_PRESENTES].map(d => `<button class="filtre" data-f="${d}" aria-pressed="${filtre === d}">${d === 'tout' ? 'Tout' : NOM_DISC[d]}</button>`).join('')}
      </div>
      <input class="recherche" id="recherche" type="search" placeholder="Chercher une notion, un auteur, une œuvre" value="${esc(requete)}" aria-label="Chercher">
    </div>
    <ul class="liste">${visibles.map(f => `<li><button class="item" data-id="${f.id}">
      <span class="n">${pad(rangDans(f))}</span>
      <span class="t">${esc(f.titre)}</span>
      <span class="etat ${etat.lues[f.id] ? 'lu ' + f.discipline : ''}" title="${etat.lues[f.id] ? 'Lue' : 'Non lue'}"></span>
      <span class="s">${esc(f.figure)} · ${NOM_DISC[f.discipline]}</span>
    </button></li>`).join('') || '<li><p class="vide" style="padding:16px 0">Aucune séance ne correspond.</p></li>'}</ul>
    ${restantes ? `<p class="a-venir">${pluriel(restantes, 'séance')} à paraître, une par jour. Les réglages permettent d'ouvrir tout le corpus.</p>` : ''}
  </section>`;
  $vue.querySelector('.filtres').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { filtre = b.dataset.f; rendreBiblio(); } };
  $vue.querySelector('.liste').onclick = e => { const b = e.target.closest('[data-id]'); if (b) ouvrir(b.dataset.id); };
  const r = document.getElementById('recherche');
  r.oninput = () => { requete = r.value; const pos = r.selectionStart; rendreBiblio(); const n = document.getElementById('recherche'); n.focus(); n.setSelectionRange(pos, pos); };
}

// ---------- Lecture ----------
function rendreLecture(f) {
  const rep = etat.quiz[f.id] || [];
  const note = (etat.notes[f.id] || {}).texte || '';
  const encadreRepere = `<aside class="repere"><span class="etiquette">Repère</span><p>${enLigne(f.repere || '')}</p></aside>`;
  $vue.innerHTML = `
  <div class="barre-lecture" style="${inkVars(f.discipline)}">
    <button class="retour" id="retour">← Retour</button>
    <span class="titre-court">${esc(f.titre)}</span>
    <span class="progression" id="progression"></span>
  </div>
  <article class="fiche" style="${inkVars(f.discipline)}">
    <header>
      <div class="rang" style="justify-content:space-between">
        <span class="disc ${f.discipline}">${NOM_DISC[f.discipline]} · ${esc(f.figure)}</span>
        <span class="seance-num">Séance n° ${numeroDe(f.id) ?? '—'}</span>
      </div>
      <h1>${esc(f.titre)}</h1>
      <div class="ref">${esc(f.reference)}</div>
      ${f.fiabilite && FIABILITE[f.fiabilite] ? `<a class="badge ${f.fiabilite}" href="#sources">${FIABILITE[f.fiabilite]}</a>` : ''}
      <p class="lead">${esc(f.accroche)}</p>
      <div class="ecoute" id="ecoute"></div>
    </header>
    ${f.citation ? `<figure class="citation"><blockquote>${esc(f.citation)}</blockquote><figcaption>${f.citation_url ? `<a href="${esc(f.citation_url)}" target="_blank" rel="noopener">${esc(f.citation_source)} ↗</a>` : esc(f.citation_source)}</figcaption></figure>` : encadreRepere}
    <div class="corps">${markdown(f.texte)}</div>
    ${f.citation && f.repere ? encadreRepere : ''}
    <section class="bloc">
      <h2>${titreQuiz(f.quiz.length)}</h2>
      <p class="explication" style="margin-top:-6px">Facultatives. Une question ratée revient dans « À revoir » le lendemain.</p>
      ${f.quiz.map((q, qi) => {
        const ordre = melange(q.choix.length, hache(f.id + qi));
        return `<div class="question" data-qi="${qi}"><p class="q">${qi + 1}. ${esc(q.question)}</p>
          <div class="choix">${ordre.map(i => `<button data-i="${i}">${esc(q.choix[i])}</button>`).join('')}</div>
          <p class="explication" hidden></p></div>`;
      }).join('')}
    </section>
    <section class="bloc notes">
      <h2>Tes notes</h2>
      <textarea id="note-${f.id}" placeholder="Ce que la séance t'a fait penser, un lien avec un cas, un texte à relire…">${esc(note)}</textarea>
      <small id="note-etat">${note ? 'Enregistré.' : 'Enregistré automatiquement.'}</small>
    </section>
    ${f.liens.length ? `<section class="bloc"><h2>Résonances</h2><div class="resonances">${f.liens.map(id => {
      const l = PAR_ID[id]; if (!l) return '';
      return `<button class="resonance" data-id="${id}" style="${inkVars(l.discipline)}">
        <span class="disc ${l.discipline}">${NOM_DISC[l.discipline]}</span>
        <span class="t">${esc(l.titre)}</span>
        <span class="etiquette">${esc(l.figure)}${etat.lues[id] ? ' · lue' : ''}</span></button>`;
    }).join('')}</div></section>` : ''}
    <section class="bloc" id="sources"><h2>Sources</h2>
      ${f.fiabilite_note ? `<p class="a-propos">${enLigne(f.fiabilite_note)}</p>` : ''}
      <ol class="sources">${f.sources.map((s, i) => `<li id="source-${i + 1}">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${enLigne(s.texte)} ↗</a>` : enLigne(s.texte)}</li>`).join('')}</ol>
    </section>
    <div class="fin" id="fin">
      <span class="etiquette" id="fin-etat">${etat.lues[f.id] ? 'Séance lue le ' + dateLongue(etat.lues[f.id]) : 'Fin de la séance'}</span>
      <div class="rang">
        <button class="bouton" id="carte">Faire une carte à partager</button>
        <button class="bouton secondaire" id="retour-bas">Retour</button>
      </div>
    </div>
  </article>`;

  document.getElementById('retour').onclick = document.getElementById('retour-bas').onclick = () => { arreterVoix(); lecture = null; rendre(); window.scrollTo(0, 0); };
  document.getElementById('carte').onclick = () => montrerCarte(f);
  for (const b of $vue.querySelectorAll('.resonance[data-id]')) b.onclick = () => ouvrir(b.dataset.id);
  // Liens internes (appels de note, badge) : défilement sans changer l'adresse.
  for (const a of $vue.querySelectorAll('a[href^="#"]')) a.onclick = e => {
    const cible = document.getElementById(a.getAttribute('href').slice(1)); if (!cible) return;
    e.preventDefault(); cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (cible.tagName === 'LI') { cible.style.color = 'var(--encre)'; setTimeout(() => { cible.style.color = ''; }, 1600); }
  };

  // Quiz : la première réponse compte, et alimente le rappel espacé.
  for (const zone of $vue.querySelectorAll('.question')) {
    const qi = Number(zone.dataset.qi), q = f.quiz[qi], choix = zone.querySelector('.choix'), ex = zone.querySelector('.explication');
    const montrer = choisi => { marquerChoix(choix, q.bonne, choisi); ex.hidden = false; ex.innerHTML = `<strong>${choisi === q.bonne ? 'Juste.' : 'Pas tout à fait.'}</strong> ${esc(q.explication)}`; };
    if (rep[qi] != null) montrer(rep[qi]);
    choix.onclick = e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const i = Number(b.dataset.i); montrer(i);
      const r = etat.quiz[f.id] || []; r[qi] = i; etat.quiz[f.id] = r;
      enregistrerReponse(etat, f.id, qi, i === q.bonne, aujourdhui());
      enregistrer();
    };
  }
  // Notes
  const ta = document.getElementById('note-' + f.id), ne = document.getElementById('note-etat'); let tn = null;
  ta.oninput = () => { ne.textContent = '…'; clearTimeout(tn); tn = setTimeout(() => {
    const t = ta.value.trim(); if (t) etat.notes[f.id] = { texte: ta.value, le: Date.now() }; else delete etat.notes[f.id];
    enregistrer(); ne.textContent = 'Enregistré.'; }, 600); };
  // Écoute
  brancherVoix(f);
  // Progression de lecture ; la séance est lue quand on atteint sa fin.
  const barre = document.getElementById('progression');
  const surDefil = () => { if (!barre.isConnected) return; const h = document.documentElement.scrollHeight - innerHeight; barre.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 100) + '%'; };
  window.onscroll = surDefil; surDefil();
  if (observateurFin) observateurFin.disconnect();
  observateurFin = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting) || lueAujourdhui(f.id)) return;
    marquerLue(f.id);
    const el = document.getElementById('fin-etat'); if (el) el.textContent = 'Séance lue le ' + dateLongue(etat.lues[f.id]);
  });
  observateurFin.observe(document.getElementById('fin'));
}

// ---------- Carnet ----------
function rendreCarnet() {
  const auj = aujourdhui(), sel = selection(FICHES, etat.reglages);
  const lues = sel.filter(f => etat.lues[f.id]).length;
  const parJour = {};
  for (const [id, j] of [...Object.entries(etat.lues), ...Object.entries(etat.relues)]) if (PAR_ID[id]) parJour[j] = PAR_ID[id].discipline;
  const lundi = decaler(auj, -((new Date().getDay() + 6) % 7) - 7);
  const cases = [...Array(14).keys()].map(i => decaler(lundi, i));
  const notes = Object.entries(etat.notes).filter(([id, v]) => PAR_ID[id] && v.texte.trim()).sort((a, b) => b[1].le - a[1].le);
  const dus = aRevoir(FICHES, etat, auj);
  const detail = DISC_PRESENTES.map(d => { const t = sel.filter(f => f.discipline === d); return t.length ? `${NOM_DISC[d]} ${t.filter(f => etat.lues[f.id]).length}/${t.length}` : ''; }).filter(Boolean).join(' · ');
  $vue.innerHTML = `
  <section class="vue">
    <div class="bilan">
      <p>${lues ? `${pluriel(lues, 'séance lue', 'séances lues')} sur ${sel.length}.` : `Aucune séance lue pour l'instant, sur ${sel.length}.`}</p>
      <span class="mineurs">${detail}</span>
    </div>
    <div style="display:grid;gap:4px">
      <div class="section-titre"><span class="etiquette">Tes notes</span>${notes.length ? `<button class="bouton discret" id="exp-notes">Exporter en Markdown</button>` : ''}</div>
      ${notes.length ? `<ul class="liste">${notes.map(([id, v]) => `<li><button class="note-item" data-id="${id}">
        <span class="t">${esc(PAR_ID[id].titre)}</span><span class="extrait">${esc(v.texte)}</span></button></li>`).join('')}</ul>`
        : '<p class="vide">Les notes que tu prends en fin de séance se retrouvent ici.</p>'}
      <span class="message" id="msg-notes"></span>
    </div>
    <div style="display:grid;gap:14px">
      <div class="section-titre"><span class="etiquette">À revoir aujourd'hui</span><span class="etiquette">${pluriel(dus.length, 'question')}</span></div>
      ${dus.length ? dus.map(htmlRappel).join('') : '<p class="vide">Rien à revoir aujourd\'hui. Une question ratée revient le lendemain, puis à une semaine, puis à un mois.</p>'}
    </div>
    <div style="display:grid;gap:10px">
      <span class="etiquette">Les deux dernières semaines</span>
      <div class="jours-sem">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span>${j}</span>`).join('')}</div>
      <div class="releve">${cases.map(j => `<span class="${parJour[j] || ''} ${j === auj ? 'aujourdhui' : ''}" title="${dateLongue(j)}${parJour[j] ? ' · ' + NOM_DISC[parJour[j]] : ''}"></span>`).join('')}</div>
    </div>
  </section>`;
  const l = $vue.querySelector('.liste'); if (l) l.onclick = e => { const b = e.target.closest('[data-id]'); if (b) ouvrir(b.dataset.id); };
  const en = document.getElementById('exp-notes'); if (en) en.onclick = () => exporterNotes(document.getElementById('msg-notes'));
  brancherRappels();
}

// ---------- Données : export, import ----------
async function telecharger(nom, texte, type) {
  const blob = new Blob([texte], { type });
  if (APERCU) {
    try { const dl = await claude.use('downloads'); if (dl) { await dl.save({ filename: nom, data: blob }); return true; } } catch (e) { if (e && e.code === 'declined') return false; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
const horodatage = () => { const d = new Date(); return `${jourDe(d)}-${pad(d.getHours())}${pad(d.getMinutes())}`; };
async function exporterNotes(msg) {
  const ok = await telecharger(`apres-coup-notes-${horodatage()}.md`, notesEnMarkdown(FICHES, etat), 'text/markdown');
  if (msg) msg.textContent = ok ? 'Notes exportées.' : '';
}
async function exporterTout() {
  const ok = await telecharger(`apres-coup-sauvegarde-${horodatage()}.json`, JSON.stringify({ app: 'apres-coup', exporte: new Date().toISOString(), etat }, null, 1), 'application/json');
  if (ok) { etat.dernierExport = new Date().toISOString(); enregistrer(); messageDonnees = 'Sauvegarde exportée.'; rendreReglages(); }
}
function importer(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const brut = JSON.parse(lecteur.result), recu = brut && brut.etat ? brut.etat : brut;
      if (!recu || typeof recu !== 'object' || !recu.lues) throw new Error('format');
      const avant = Object.keys(etat.lues).length, notesAvant = Object.keys(etat.notes).length;
      etat = normaliser(fusionner(etat, normaliser(recu, aujourdhui(), FICHES), aujourdhui()), aujourdhui(), FICHES);
      enregistrer(); appliquerTheme();
      messageDonnees = `Sauvegarde fusionnée : ${Object.keys(etat.lues).length - avant} séance(s) lue(s) et ${Object.keys(etat.notes).length - notesAvant} note(s) en plus.`;
    } catch (e) { messageDonnees = 'Ce fichier n\'est pas une sauvegarde d\'Après-coup.'; }
    rendreReglages();
  };
  lecteur.readAsText(fichier);
}

// ---------- Réglages ----------
function appliquerTheme() {
  const t = etat.reglages.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
function rendreReglages() {
  const r = etat.reglages, voix = voixFr(), ex = new Set(r.exclues || []);
  const seg = (cle, opts) => `<div class="segments" data-cle="${cle}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(r[cle]) === String(v)}">${l}</button>`).join('')}</div>`;
  const nb = d => FICHES.filter(f => f.discipline === d).length;
  const exportTexte = etat.dernierExport ? `Dernière sauvegarde exportée le ${dateHeure(Date.parse(etat.dernierExport))}.` : 'Aucune sauvegarde exportée pour l\'instant.';
  $vue.innerHTML = `
  <section class="vue" style="gap:0">
    <div class="reglage" style="border-top:3px solid var(--encre)">
      <h2>Rythme</h2><p>Quelles séances composent ta suite. Les croisements reviennent tous les cinq jours, quel que soit le rythme.</p>
      ${seg('rythme', [['alterne', 'Les deux, en alternance'], ['philosophie', 'Philosophie seule'], ['psychanalyse', 'Psychanalyse seule']])}
    </div>
    <div class="reglage">
      <h2>Branches</h2><p>Les sujets retenus. La séance du jour ne change pas si tu modifies ce choix en cours de journée.</p>
      ${Object.keys(BRANCHES).filter(d => DISC_PRESENTES.includes(d)).map(d => `<span class="etiquette" style="margin-top:8px">${NOM_DISC[d]}</span>
        <div class="cases">${BRANCHES[d].map(([c, l]) => { const n = FICHES.filter(f => f.branche === c).length;
          return `<label class="case ${n ? '' : 'vide'}"><input type="checkbox" data-b="${c}" ${!ex.has(c) && n ? 'checked' : ''} ${n ? '' : 'disabled'}><span>${esc(l)}</span><span class="nb">${n || 'à venir'}</span></label>`; }).join('')}</div>`).join('')}
      <span class="message" id="msg-branches"></span>
    </div>
    <div class="reglage">
      <h2>Accès</h2><p>Une séance par jour, comme un rendez-vous ; ou tout le corpus ouvert pour réviser.</p>
      ${seg('acces', [['jour', 'Une séance par jour'], ['tout', 'Tout le corpus']])}
    </div>
    <div class="reglage">
      <h2>Lecture à voix haute</h2>
      ${voix.length ? `<p>Voix proposées par ton appareil.</p>
        <select class="champ" id="voix" aria-label="Voix">${voix.map(v => `<option value="${esc(v.name)}" ${v.name === r.voix ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : '<p>Aucune voix française détectée sur cet appareil pour l\'instant.</p>'}
      ${seg('vitesse', [['0.9', 'Posée'], ['1', 'Normale'], ['1.15', 'Vive']])}
    </div>
    <div class="reglage">
      <h2>Apparence</h2>
      ${seg('theme', [['auto', 'Comme l\'appareil'], ['light', 'Clair'], ['dark', 'Sombre']])}
    </div>
    <div class="reglage">
      <h2>Tes données</h2>
      ${APERCU ? `<p class="avertissement">Ceci est l'aperçu dans Claude. Ta progression de référence est celle de l'app installée sur ton téléphone ; les deux ne se synchronisent pas. Pour passer de l'une à l'autre, exporte une sauvegarde ici et importe-la là-bas.</p>` : ''}
      <p>Tes séances, réponses et notes ne sont enregistrées que sur cet appareil. Exporte une sauvegarde de temps en temps : elle se réimporte ici ou sur un autre téléphone, et se fusionne avec ce qui s'y trouve.</p>
      <div class="boutons">
        <button class="bouton secondaire" id="exp-tout">Exporter une sauvegarde</button>
        <button class="bouton secondaire" id="imp-tout">Importer une sauvegarde</button>
        <button class="bouton secondaire" id="exp-notes2">Exporter mes notes</button>
        <input type="file" id="fichier" accept="application/json,.json" hidden>
      </div>
      <span class="message">${esc(messageDonnees || exportTexte)}</span>
      ${!APERCU && stockageProtege !== null ? `<span class="message">${stockageProtege ? 'Stockage protégé : le navigateur ne l\'effacera pas pour faire de la place.' : 'Stockage non protégé : le navigateur peut l\'effacer s\'il manque de place. Exporte une sauvegarde.'}</span>` : ''}
      ${APERCU && syncTexte ? `<span class="message">${esc(syncTexte)}</span>` : ''}
    </div>
    <div class="reglage">
      <h2>Contenu</h2>
      <p>${pluriel(FICHES.length, 'séance')} : ${DISC_PRESENTES.map(d => `${nb(d)} ${d === 'croisement' ? (nb(d) > 1 ? 'croisements' : 'croisement') : 'en ' + NOM_DISC[d].toLowerCase()}`).join(', ')}.</p>
      <p>Version du contenu publiée le ${VERSION.date ? dateHeure(VERSION.date) : 'date inconnue'}.</p>
      <p>Page ouverte le ${new Date(OUVERTE_LE).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' })}.</p>
    </div>
    <div class="reglage">
      <h2>Progression</h2>
      <p>Commencée le ${dateLongue(etat.debut)}.</p>
      <div class="confirmation">${confirmerRaz
        ? `<span>Effacer séances lues, réponses, révisions et notes ?</span><button class="bouton" id="raz-oui">Tout effacer</button><button class="bouton discret" id="raz-non">Annuler</button>`
        : `<button class="bouton secondaire" id="raz">Repartir de zéro</button>`}</div>
    </div>
  </section>`;
  for (const cb of $vue.querySelectorAll('[data-b]')) cb.onchange = () => {
    const ex2 = new Set(r.exclues || []);
    cb.checked ? ex2.delete(cb.dataset.b) : ex2.add(cb.dataset.b);
    if (FICHES.every(f => ex2.has(f.branche))) { cb.checked = true; document.getElementById('msg-branches').textContent = 'Garde au moins une branche.'; return; }
    r.exclues = [...ex2]; etat.reglagesLe = Date.now(); enregistrer();
    document.getElementById('msg-branches').textContent = `${pluriel(selection(FICHES, r).length, 'séance')} dans ta sélection.`;
  };
  for (const g of $vue.querySelectorAll('.segments')) g.onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const cle = g.dataset.cle; r[cle] = cle === 'vitesse' ? Number(b.dataset.v) : b.dataset.v;
    etat.reglagesLe = Date.now(); enregistrer(); appliquerTheme(); rendreReglages();
  };
  const v = document.getElementById('voix'); if (v) v.onchange = () => { r.voix = v.value; etat.reglagesLe = Date.now(); enregistrer(); };
  document.getElementById('exp-tout').onclick = exporterTout;
  document.getElementById('exp-notes2').onclick = () => exporterNotes(null).then(() => { messageDonnees = 'Notes exportées.'; rendreReglages(); });
  const fichier = document.getElementById('fichier');
  document.getElementById('imp-tout').onclick = () => fichier.click();
  fichier.onchange = () => { if (fichier.files[0]) importer(fichier.files[0]); };
  const raz = document.getElementById('raz'); if (raz) raz.onclick = () => { confirmerRaz = true; rendreReglages(); };
  const non = document.getElementById('raz-non'); if (non) non.onclick = () => { confirmerRaz = false; rendreReglages(); };
  const oui = document.getElementById('raz-oui'); if (oui) oui.onclick = () => {
    const reg = etat.reglages; etat = etatVide(aujourdhui()); etat.reglages = reg; etat.reglagesLe = Date.now(); confirmerRaz = false; enregistrer(); rendreReglages();
  };
}

// ---------- Démarrage ----------
appliquerTheme();
enregistrer();
rendre();
if (lecture && derniereY) setTimeout(() => window.scrollTo(0, derniereY), 60);
if (synth) try { synth.onvoiceschanged = () => { if (onglet === 'reglages' && !lecture) rendreReglages(); }; } catch (e) {}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !lecture) rendre(); });
protegerStockage().then(() => { if (onglet === 'reglages' && !lecture) rendreReglages(); });
brancherSync();
