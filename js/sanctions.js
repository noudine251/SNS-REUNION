import { state, saveData, uid, aNom, getA, bdg, clearF, closeModal, updateDashboard } from './app.js';
import { db } from './firebase.js';
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Rendu ─────────────────────────────────────────────────────────────────────

export function renderSanctions() {
  const el = document.getElementById('table-sanctions'); if (!el) return;
  if (!state.sanctions.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">Sanction</div>Aucune sanction</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>#</th><th>Adhérent</th><th>Date</th><th>Type</th><th>Montant</th><th>Motif</th><th>Statut</th><th></th></tr></thead><tbody>${state.sanctions.map((s, i) => `<tr><td>${i + 1}</td><td>${s.adherentNom}</td><td>${s.date || '—'}</td><td>${bdg(s.type)}</td><td>${s.montant ? Number(s.montant).toLocaleString() + ' F' : '—'}</td><td>${s.motif || '—'}</td><td>${bdg(s.statut)}</td><td><button class="btn btn-sm btn-danger" onclick="delSanction('${s.id}')">Supprimer</button></td></tr>`).join('')}</tbody></table>`;
}

// ── CRUD sanctions → Firestore "sanctions" ────────────────────────────────────

window.saveSanction = async function () {
  const aId = document.getElementById('s-adherent').value; if (!aId) return alert("Adhérent requis.");
  const data = {
    id: uid(), adherentId: aId, adherentNom: aNom(getA(aId)),
    date: document.getElementById('s-date').value,
    type: document.getElementById('s-type').value,
    montant: document.getElementById('s-montant').value,
    motif: document.getElementById('s-motif').value,
    statut: document.getElementById('s-statut').value
  };
  try {
    await setDoc(doc(db, 'sanctions', data.id), data);
  } catch (e) {
    console.error('saveSanction', e);
    return alert("Erreur lors de la sauvegarde.");
  }
  closeModal('modal-sanction');
  clearF(['s-date', 's-montant', 's-motif']);
};

window.delSanction = async function (id) {
  if (!confirm("Supprimer cette sanction ?")) return;
  try {
    await deleteDoc(doc(db, 'sanctions', id));
  } catch (e) {
    console.error('delSanction', e);
    alert("Erreur lors de la suppression.");
  }
};

// ── Sync temps réel : Firestore "sanctions" → state.sanctions ─────────────────

onSnapshot(
  collection(db, 'sanctions'),
  snapshot => {
    state.sanctions = snapshot.docs.map(d => d.data());
    saveData();
    renderSanctions();
    updateDashboard();
  },
  err => console.error('onSnapshot sanctions', err)
);

window.renderSanctions = renderSanctions;
