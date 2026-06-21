import { state, params, saveData, uid, bdg, clearF, closeModal, updateDashboard } from './app.js';
import { updateCotisationSelects } from './cotisations.js';
import { db } from './firebase.js';
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Rendu ─────────────────────────────────────────────────────────────────────

export function renderReunions() {
  const el = document.getElementById('list-reunions'); if (!el) return;
  if (!state.reunions.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">Réunion</div>Aucune réunion</div>'; return; }
  el.innerHTML = state.reunions.map(r => `<div class="meeting-item"><div><strong>${r.titre}</strong><div style="font-size:.76rem;color:var(--muted);margin-top:2px">${r.date || '—'} ${r.heure || '—'} ${r.lieu || '—'}</div>${r.odj ? `<div style="font-size:.76rem;color:var(--muted);margin-top:1px">${r.odj.substring(0, 80)}${r.odj.length > 80 ? '…' : ''}</div>` : ''}</div><div style="display:flex;gap:7px;align-items:center">${bdg(r.statut)}<button class="btn btn-sm btn-danger" onclick="delReunion('${r.id}')">Supprimer</button></div></div>`).join('');
}

export function populateReunionSelect() {
  const el = document.getElementById('re-reunion'); if (!el) return;
  el.innerHTML = '';
  state.reunions.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.titre + ' (' + r.date + ')'; el.appendChild(o); });
}

// ── CRUD réunions → Firestore "reunions" ──────────────────────────────────────

window.saveReunion = async function () {
  const titre = document.getElementById('r-titre').value.trim(); if (!titre) return alert("Titre requis.");
  const data = {
    id: uid(), titre,
    date: document.getElementById('r-date').value,
    heure: document.getElementById('r-heure').value,
    lieu: document.getElementById('r-lieu').value,
    statut: document.getElementById('r-statut').value,
    odj: document.getElementById('r-odj').value
  };
  try {
    await setDoc(doc(db, 'reunions', data.id), data);
  } catch (e) {
    console.error('saveReunion', e);
    return alert("Erreur lors de la sauvegarde.");
  }
  closeModal('modal-reunion');
  clearF(['r-titre', 'r-date', 'r-heure', 'r-lieu', 'r-odj']);
};

window.delReunion = async function (id) {
  if (!confirm("Supprimer cette réunion ?")) return;
  try {
    await deleteDoc(doc(db, 'reunions', id));
  } catch (e) {
    console.error('delReunion', e);
    alert("Erreur lors de la suppression.");
  }
};

window.genererReunionsAuto = async function () {
  const freq = params.frequence, nb = params.nbReunions || 12, heure = params.heure || "09:00";
  const freqLabels = { mensuelle: "mensuelle", hebdomadaire: "hebdomadaire", journaliere: "journalière" };
  if (!confirm("Générer " + nb + " réunions " + (freqLabels[freq] || freq) + " à partir d'aujourd'hui ?")) return;
  const aujourd_hui = new Date();
  const nouvelles = [];
  for (let i = 0; i < nb; i++) {
    let dateR;
    if (freq === "mensuelle") {
      dateR = new Date(aujourd_hui.getFullYear(), aujourd_hui.getMonth() + i, aujourd_hui.getDate());
    } else if (freq === "hebdomadaire") {
      dateR = new Date(aujourd_hui.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    } else {
      dateR = new Date(aujourd_hui.getTime() + i * 24 * 60 * 60 * 1000);
    }
    const dateStr = dateR.toISOString().split("T")[0];
    if (state.reunions.some(r => r.date === dateStr)) continue;
    const mois = dateR.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const semaine = freq === "hebdomadaire" ? " S" + (i + 1) : "";
    nouvelles.push({
      id: uid(),
      titre: "Réunion " + (freq === "journaliere" ? "du " + dateR.toLocaleDateString("fr-FR") : freq === "hebdomadaire" ? "hebdo" + semaine : "de " + mois),
      date: dateStr, heure, lieu: params.lieu || "", statut: "Planifiée",
      odj: "Cotisations — Rations — " + params.articles.map(a => a.nom).join(" — ")
    });
  }
  if (!nouvelles.length) { alert("Toutes les réunions existent déjà."); return; }
  try {
    const batch = writeBatch(db);
    nouvelles.forEach(r => batch.set(doc(db, 'reunions', r.id), r));
    await batch.commit();
  } catch (e) {
    console.error('genererReunionsAuto', e);
    return alert("Erreur lors de la génération.");
  }
  alert("" + nouvelles.length + " réunion(s) générée(s) !");
};

// ── Sync temps réel : Firestore "reunions" → state.reunions ──────────────────

onSnapshot(
  collection(db, 'reunions'),
  snapshot => {
    state.reunions = snapshot.docs.map(d => d.data());
    saveData();
    renderReunions();
    updateCotisationSelects();
    updateDashboard();
  },
  err => console.error('onSnapshot reunions', err)
);

window.renderReunions = renderReunions;
