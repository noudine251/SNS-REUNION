import { state, saveData, uid, aNom, getA, bdg, clearF, closeModal, updateDashboard } from './app.js';
import { db } from './firebase.js';
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let activeBanqueRubrique = 'scolaire';
const rubriquesLabels = { scolaire: "🏦 BANQUE SCOLAIRE", fond: "💰 FOND DE LA RÉUNION", caisse: "🏧 CAISSE D'ATTENTE" };

// ── Rendu ─────────────────────────────────────────────────────────────────────

export function renderBanque() {
  const soldes = { scolaire: 0, fond: 0, caisse: 0 };
  state.banque.forEach(t => { const r = t.rubrique || 'scolaire'; if (soldes[r] !== undefined) soldes[r] += (t.type === 'Entrée' ? t.montant : -t.montant); });
  const gbs = document.getElementById('global-bs'); if (gbs) gbs.textContent = soldes.scolaire.toLocaleString() + ' F';
  const gfr = document.getElementById('global-fr'); if (gfr) gfr.textContent = soldes.fond.toLocaleString() + ' F';
  const gca = document.getElementById('global-ca'); if (gca) gca.textContent = soldes.caisse.toLocaleString() + ' F';
  const lbl = document.getElementById('banque-rubrique-label'); if (lbl) lbl.textContent = rubriquesLabels[activeBanqueRubrique] || '';
  const filtered = state.banque.filter(t => (t.rubrique || 'scolaire') === activeBanqueRubrique);
  let ent = 0, sor = 0; filtered.forEach(t => t.type === 'Entrée' ? ent += t.montant : sor += t.montant);
  ['banque-entrees', 'banque-sorties', 'banque-solde'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = [ent, sor, ent - sor][i].toLocaleString() + ' F'; });
  const el = document.getElementById('table-banque'); if (!el) return;
  if (!filtered.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🏦</div>Aucune transaction dans cette rubrique</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Libellé</th><th>Catégorie</th><th>Adhérent</th><th>Montant</th><th></th></tr></thead><tbody>${filtered.map((t, i) => `<tr><td>${i + 1}</td><td>${t.date || '—'}</td><td>${bdg(t.type)}</td><td>${t.libelle || '—'}</td><td>${t.categorie}</td><td>${t.adherentNom || '—'}</td><td class="${t.type === 'Entrée' ? 'amount-pos' : 'amount-neg'}">${t.type === 'Entrée' ? '+' : '-'}${t.montant.toLocaleString()} F</td><td><button class="btn btn-sm btn-danger" onclick="delBanque('${t.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}

// ── CRUD banque → Firestore "banque" ──────────────────────────────────────────

window.saveBanque = async function () {
  const m = document.getElementById('b-montant').value; if (!m) return alert("Montant requis.");
  const aId = document.getElementById('b-adherent').value;
  const rubrique = document.getElementById('b-rubrique').value || 'scolaire';
  const data = {
    id: uid(), rubrique,
    date: document.getElementById('b-date').value,
    type: document.getElementById('b-type').value,
    montant: parseFloat(m),
    categorie: document.getElementById('b-categorie').value,
    libelle: document.getElementById('b-libelle').value,
    adherentNom: aNom(getA(aId))
  };
  try {
    await setDoc(doc(db, 'banque', data.id), data);
  } catch (e) {
    console.error('saveBanque', e);
    return alert("Erreur lors de la sauvegarde.");
  }
  activeBanqueRubrique = rubrique;
  closeModal('modal-banque');
  clearF(['b-date', 'b-montant', 'b-libelle']);
};

window.delBanque = async function (id) {
  if (!confirm("Supprimer cette transaction ?")) return;
  try {
    await deleteDoc(doc(db, 'banque', id));
  } catch (e) {
    console.error('delBanque', e);
    alert("Erreur lors de la suppression.");
  }
};

window.switchBanque = function (r) {
  activeBanqueRubrique = r;
  ['scolaire', 'fond', 'caisse'].forEach(k => {
    const btn = document.getElementById('tab-' + { scolaire: 'bs', fond: 'fr', caisse: 'ca' }[k]);
    if (btn) { btn.className = k === r ? 'btn btn-primary' : 'btn btn-outline'; }
  });
  renderBanque();
};

// ── Sync temps réel : Firestore "banque" → state.banque ───────────────────────

onSnapshot(
  collection(db, 'banque'),
  snapshot => {
    state.banque = snapshot.docs.map(d => d.data());
    saveData();
    renderBanque();
    updateDashboard();
  },
  err => console.error('onSnapshot banque', err)
);

window.renderBanque = renderBanque;
