// Après-coup — lecture à voix haute (synthèse vocale de l'appareil).
const synth = window.speechSynthesis;
let enLecture = false;
function voixFr() { try { return (synth.getVoices() || []).filter(v => /^fr/i.test(v.lang)); } catch (e) { return []; } }
function arreterVoix() { if (synth) { try { synth.cancel(); } catch (e) {} } enLecture = false; }
function brancherVoix(f) {
  const zone = document.getElementById('ecoute');
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { zone.hidden = true; return; }
  const dessiner = () => {
    const parle = enLecture && (synth.speaking || synth.pending), pause = synth.paused;
    zone.innerHTML = !parle ? `<button class="bouton secondaire" id="v-lire">Écouter la séance</button>`
      : `<button class="bouton secondaire" id="v-pause">${pause ? 'Reprendre' : 'Pause'}</button><button class="bouton discret" id="v-stop">Arrêter</button>`;
    const l = document.getElementById('v-lire'), p = document.getElementById('v-pause'), s = document.getElementById('v-stop');
    if (l) l.onclick = () => {
      arreterVoix(); enLecture = true;
      const morceaux = [f.titre + '.', f.accroche, f.citation ? 'Citation de ' + f.figure + '. ' + f.citation + '.' : 'Repère. ' + f.repere, ...texteBrut(f.texte).split(/\n{2,}/)];
      const voix = voixFr(), choisie = voix.find(v => v.name === etat.reglages.voix) || voix[0];
      morceaux.forEach((m, i) => {
        const u = new SpeechSynthesisUtterance(m); u.lang = 'fr-FR'; if (choisie) u.voice = choisie; u.rate = etat.reglages.vitesse || 1;
        if (i === morceaux.length - 1) u.onend = () => { enLecture = false; dessiner(); };
        synth.speak(u);
      });
      dessiner();
    };
    if (p) p.onclick = () => { synth.paused ? synth.resume() : synth.pause(); setTimeout(dessiner, 60); };
    if (s) s.onclick = () => { arreterVoix(); dessiner(); };
  };
  dessiner();
}
