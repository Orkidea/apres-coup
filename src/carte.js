// Après-coup — carte partageable 1080 × 1920, dessinée dans un canvas.
async function montrerCarte(f) {
  const calque = document.getElementById('calque');
  calque.innerHTML = `<div class="voile-carte" id="voile"><div class="panneau-carte" role="dialog" aria-label="Carte à partager"><p>Composition de la carte…</p></div></div>`;
  const fermer = () => { calque.innerHTML = ''; };
  document.getElementById('voile').onclick = e => { if (e.target.id === 'voile') fermer(); };
  try { await Promise.all(['96px Gloock', '44px Newsreader', '30px "Spline Sans Mono"'].map(p => document.fonts.load(p))); } catch (e) {}
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const encre = { philosophie: '#1E5C57', psychanalyse: '#8C2F3E', croisement: '#5B3A57' }[f.discipline] || '#1B2024';
  x.fillStyle = '#ECEEE9'; x.fillRect(0, 0, W, H);
  // Deux disques en surimpression, rappel du sceau
  x.globalAlpha = .9; x.fillStyle = '#1E5C57'; x.beginPath(); x.arc(770, 470, 190, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'multiply'; x.fillStyle = '#8C2F3E'; x.beginPath(); x.arc(930, 470, 190, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  const M = 84, larg = W - 2 * M;
  const lignes = (txt, police, max) => { x.font = police; const mots = txt.split(' '), out = []; let l = ''; for (const m of mots) { const t = l ? l + ' ' + m : m; if (x.measureText(t).width > max && l) { out.push(l); l = m; } else l = t; } if (l) out.push(l); return out; };
  x.fillStyle = encre; x.font = '500 30px "Spline Sans Mono", monospace';
  x.fillText(NOM_DISC[f.discipline].toUpperCase(), M, 760);
  x.fillStyle = '#5A6468'; x.fillText(f.figure.toUpperCase(), M, 805);
  // Zone texte : de 880 jusqu'au cartouche de référence, qui monte selon sa hauteur
  x.font = '28px "Spline Sans Mono", monospace';
  const ref = lignes(f.reference, '28px "Spline Sans Mono", monospace', larg - 40);
  const hautRef = ref.length * 40 + 44, basTexte = 1680 - hautRef - 50;
  let tp = 88, ti = 42, pl, il, hauteur;
  for (;;) {
    pl = lignes(f.punch, `${tp}px Gloock, Georgia, serif`, larg);
    il = lignes(f.idee, `${ti}px Newsreader, Georgia, serif`, larg);
    hauteur = pl.length * tp * 1.08 + 110 + il.length * ti * 1.42;
    if (880 + hauteur <= basTexte || tp <= 56) break;
    tp -= 4; ti = Math.max(32, ti - 2);
  }
  let y = 880 + tp * .8;
  x.fillStyle = '#1B2024'; x.font = `${tp}px Gloock, Georgia, serif`;
  for (const l of pl) { x.fillText(l, M, y); y += tp * 1.08; }
  y += 10; x.fillStyle = encre; x.fillRect(M, y, 120, 6); y += 40 + ti;
  x.fillStyle = '#1B2024'; x.font = `${ti}px Newsreader, Georgia, serif`;
  for (const l of il) { x.fillText(l, M, y); y += ti * 1.42; }
  let yb = 1680 - hautRef + 52;
  x.fillStyle = encre; x.fillRect(M - 20, 1680 - hautRef, larg + 40, hautRef);
  x.fillStyle = '#F7F8F4'; x.font = '28px "Spline Sans Mono", monospace'; for (const l of ref) { x.fillText(l, M, yb); yb += 40; }
  x.fillStyle = '#1B2024'; x.fillRect(M, 1712, larg, 4);
  x.font = '44px Gloock, Georgia, serif'; x.fillText('Après-coup', M, 1782);
  x.font = '28px "Spline Sans Mono", monospace'; const n = 'Séance n° ' + (numeroDe(f.id) ?? ''); x.fillText(n, W - M - x.measureText(n).width, 1780);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const panneau = calque.querySelector('.panneau-carte');
  panneau.innerHTML = `<img src="${url}" alt="Carte : ${esc(f.punch)}"><div class="rang" style="justify-content:center">
    <button class="bouton" id="enregistrer" hidden>Enregistrer l'image</button><button class="bouton secondaire" id="fermer">Fermer</button></div>
    <p id="carte-msg">Sur téléphone, un appui long sur l'image permet aussi de l'enregistrer.</p>`;
  document.getElementById('fermer').onclick = () => { URL.revokeObjectURL(url); fermer(); };
  try {
    const dl = window.claude && claude.use ? await claude.use('downloads') : null;
    const b = document.getElementById('enregistrer');
    if (dl && b) { b.hidden = false; b.onclick = async () => {
      try { await dl.save({ filename: `apres-coup-${f.id}.png`, data: blob }); document.getElementById('carte-msg').textContent = 'Image enregistrée.'; }
      catch (e) { if (e && e.code !== 'declined') document.getElementById('carte-msg').textContent = 'L\'enregistrement n\'est pas disponible ici : utilise l\'appui long sur l\'image.'; }
    }; }
  } catch (e) {}
}
