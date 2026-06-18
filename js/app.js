import { renderAdherents, renderUsers } from './membres.js';
import { renderReunions, populateReunionSelect } from './reunions.js';
import { updateCotisationSelects, renderCotisationsReunion } from './cotisations.js';
import { renderSanctions } from './sanctions.js';
import { renderBanque } from './banque.js';
import { migrerVersFirestore } from './migration.js';
import { db } from './firebase.js';
import { doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── STATE ──
export const state = {
  reunions: [], adherents: [], sanctions: [], banque: [], caution: [], aide: [], retard: [], beneficiaires: [],
  cotisations: [],
  users: [
    { id: 'u1', login: 'Snstech', pass: '1234', nom: 'Administrateur', role: 'admin', adherentId: '', statut: 'Actif' },
    { id: 'u2', login: 'Sinfo', pass: '1234', nom: 'SEVERIN Sinfo', role: 'membre', adherentId: 'a1', statut: 'Actif' }
  ]
};

export const params = {
  nom: "Mon Association", responsable: "", lieu: "", desc: "",
  frequence: "mensuelle", jour: "6", heure: "09:00", nbReunions: 12,
  cotisation: 100000, ration: 6000, amende: 2000,
  articles: [
    { id: "art1", nom: "Huile", unite: "bouteille(s)", qteDefaut: 2 },
    { id: "art2", nom: "Savon", unite: "morceau(x)", qteDefaut: 2 }
  ]
};

let currentUser = null;
let dragSrc = null;

// ── PERSISTENCE ──
export function saveData() {
  try {
    localStorage.setItem('gestreunion', JSON.stringify(state));
    localStorage.setItem('gestreunion_params', JSON.stringify(params));
  } catch (e) {}
}

function loadData() {
  try {
    const d = localStorage.getItem('gestreunion');
    if (d) {
      const p = JSON.parse(d);
      Object.keys(p).forEach(k => { if (state[k] !== undefined) state[k] = p[k]; });
      const u1 = state.users.find(u => u.id === 'u1');
      if (u1 && u1.login !== 'Snstech') { u1.login = 'Snstech'; u1.pass = '1234'; }
    }
    const dp = localStorage.getItem('gestreunion_params');
    if (dp) { const pp = JSON.parse(dp); Object.keys(pp).forEach(k => { params[k] = pp[k]; }); }
  } catch (e) {}
  avancerFile();
  appliquerParams();
}

window.resetAdminPass = function () {
  const u1 = state.users.find(u => u.id === 'u1');
  if (u1) { u1.pass = '1234'; saveData(); alert("Mot de passe admin réinitialisé : 1234"); }
};

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── HELPERS ──
export function getA(id) { return state.adherents.find(x => x.id === id); }
export function aNom(a) { return a ? a.prenom + ' ' + a.nom : ''; }

export function bdg(lbl) {
  const m = { Actif: 'badge-success', Planifiée: 'badge-info', Terminée: 'badge-gray', 'En cours': 'badge-warning', Annulée: 'badge-danger', Suspendu: 'badge-danger', Inactif: 'badge-gray', Appliquée: 'badge-danger', 'En attente': 'badge-warning', Levée: 'badge-success', Accordée: 'badge-success', Refusée: 'badge-danger', Active: 'badge-success', Remboursée: 'badge-gray', Saisie: 'badge-danger', Oui: 'badge-success', Non: 'badge-warning', Attribué: 'badge-success', 'Clôturé': 'badge-gray', Avertissement: 'badge-warning', Amende: 'badge-danger', Suspension: 'badge-purple', Exclusion: 'badge-danger', Entrée: 'badge-success', Sortie: 'badge-danger', admin: 'badge-warning', bureau: 'badge-info', membre: 'badge-success' };
  return `<span class="badge ${m[lbl] || 'badge-gray'}">${lbl}</span>`;
}

export function getRankBadge(n) {
  if (n === 1) return '<span class="rank-1">1</span>';
  if (n === 2) return '<span class="rank-2">2</span>';
  if (n === 3) return '<span class="rank-3">3</span>';
  return `<span class="rank-n">${n}</span>`;
}

export function clearF(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }

export function openModal(id) { populateSelects(); document.getElementById(id).classList.add('open'); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }

export function populateSelects() {
  ['s-adherent', 'c-adherent', 'ai-adherent', 're-adherent', 'be-adherent', 'u-adherent'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const val = el.value;
    el.innerHTML = id === 'u-adherent' ? '<option value="">-- Aucun --</option>' : '';
    state.adherents.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.prenom + ' ' + a.nom; el.appendChild(o); });
    if (val) el.value = val;
  });
  const ba = document.getElementById('b-adherent');
  if (ba) { const val = ba.value; ba.innerHTML = '<option value="">-- Aucun --</option>'; state.adherents.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.prenom + ' ' + a.nom; ba.appendChild(o); }); if (val) ba.value = val; }
}

// ── AUTH ──
window.doLogin = function () {
  const login = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const u = state.users.find(u => u.login === login && u.pass === pass && u.statut === 'Actif');
  if (!u) { document.getElementById('login-err').style.display = 'block'; return; }
  document.getElementById('login-err').style.display = 'none';
  currentUser = u;
  if (u.role === 'membre') showMemberView(); else showAppView();
};

window.doLogout = function () {
  currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('member-view').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
};

function showAppView() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('sb-username').textContent = currentUser.login;
  document.getElementById('sb-fullname').textContent = currentUser.nom;
  const rb = document.getElementById('sb-role-badge');
  rb.className = 'role-badge role-' + currentUser.role;
  rb.textContent = currentUser.role === 'admin' ? 'Administrateur' : currentUser.role === 'bureau' ? 'Bureau' : 'Adhérent';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = currentUser.role === 'admin' ? 'flex' : 'none');
  renderAll(); updateDashboard();
}

function showMemberView() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('member-view').style.display = 'block';
  document.getElementById('member-welcome').textContent = 'Bienvenue, ' + currentUser.nom;
  renderMemberView();
}

window.renderMemberView = function () {
  const solde = state.banque.reduce((s, t) => t.type === 'Entrée' ? s + t.montant : s - t.montant, 0);
  const queue = [...state.beneficiaires].filter(b => b.statut === 'En attente').sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const current = state.beneficiaires.find(b => b.statut === 'Attribué');
  const next = queue[0];
  document.getElementById('member-cards-grid').innerHTML = `
    <div class="member-card"><div class="member-card-icon">🏦</div><div class="member-card-label">Fonds disponibles</div><div class="member-card-value">${solde.toLocaleString()} F</div><div class="member-card-sub">Banque scolaire</div></div>
    <div class="member-card ${current ? 'highlight' : ''}"><div class="member-card-icon">🎁</div><div class="member-card-label">Bénéficiaire du jour</div><div class="member-card-value">${current ? current.adherentNom : '— Aucun —'}</div><div class="member-card-sub">${current ? current.type + ' — ' + (current.valeur ? Number(current.valeur).toLocaleString() + ' F' : '') : 'Pas de bénéficiaire actif'}</div></div>
    <div class="member-card"><div class="member-card-icon">⏳</div><div class="member-card-label">Prochain en attente</div><div class="member-card-value">${next ? next.adherentNom : '— Aucun —'}</div><div class="member-card-sub">${next ? 'Rang #' + (next.ordre || 1) + ' — ' + next.type : 'File vide'}</div></div>
    <div class="member-card"><div class="member-card-icon">👥</div><div class="member-card-label">Total adhérents</div><div class="member-card-value">${state.adherents.length}</div><div class="member-card-sub">Membres actifs</div></div>`;
  const ql = document.getElementById('member-queue-list');
  if (!queue.length) { ql.innerHTML = '<div style="color:rgba(255,255,255,.6);font-size:.85rem;padding:8px">Aucun bénéficiaire en attente.</div>'; return; }
  ql.innerHTML = queue.map((b, i) => `<div class="bene-item"><span class="bene-item-rank">${getRankBadge(i + 1)}</span><div class="bene-item-info"><strong>${b.adherentNom}</strong><br><span style="font-size:.76rem;color:var(--muted)">${b.type}${b.valeur ? ' — ' + Number(b.valeur).toLocaleString() + ' F' : ''}</span></div><span class="badge badge-info">${b.statut}</span></div>`).join('');
};

// ── NAVIGATION ──
window.showPage = function (name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => { if (n.getAttribute('onclick')?.includes("'" + name + "'")) n.classList.add('active'); });
  const nc = document.getElementById('navCollapse');
  if (nc && nc.classList.contains('show')) { const bsc = bootstrap.Collapse.getInstance(nc); if (bsc) bsc.hide(); }
  populateSelects();
  if (name === 'retard') populateReunionSelect();
};


window.openModal = openModal;
window.closeModal = closeModal;

document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

// ── SAVE FUNCTIONS ──

window.saveCaution = async function () {
  const aId = document.getElementById('c-adherent').value; if (!aId) return alert("Adhérent requis.");
  const data = { id: uid(), adherentId: aId, adherentNom: aNom(getA(aId)), date: document.getElementById('c-date').value, montant: document.getElementById('c-montant').value, motif: document.getElementById('c-motif').value, statut: document.getElementById('c-statut').value, echeance: document.getElementById('c-echeance').value };
  try { await setDoc(doc(db, 'caution', data.id), data); } catch (e) { console.error('saveCaution', e); return alert("Erreur lors de la sauvegarde."); }
  closeModal('modal-caution'); clearF(['c-date', 'c-montant', 'c-motif', 'c-echeance']);
};

window.saveAide = async function () {
  const aId = document.getElementById('ai-adherent').value; if (!aId) return alert("Adhérent requis.");
  const data = { id: uid(), adherentId: aId, adherentNom: aNom(getA(aId)), date: document.getElementById('ai-date').value, montant: document.getElementById('ai-montant').value, type: document.getElementById('ai-type').value, desc: document.getElementById('ai-desc').value, statut: document.getElementById('ai-statut').value };
  try { await setDoc(doc(db, 'aide', data.id), data); } catch (e) { console.error('saveAide', e); return alert("Erreur lors de la sauvegarde."); }
  closeModal('modal-aide'); clearF(['ai-date', 'ai-montant', 'ai-desc']);
};

window.saveRetard = async function () {
  const aId = document.getElementById('re-adherent').value; if (!aId) return alert("Adhérent requis.");
  const rId = document.getElementById('re-reunion').value, r = state.reunions.find(x => x.id === rId);
  const data = { id: uid(), adherentId: aId, adherentNom: aNom(getA(aId)), reunionId: rId, reunionTitre: r ? r.titre : '', heure: document.getElementById('re-heure').value, duree: document.getElementById('re-duree').value, amende: document.getElementById('re-amende').value, justifie: document.getElementById('re-justifie').value };
  try { await setDoc(doc(db, 'retard', data.id), data); } catch (e) { console.error('saveRetard', e); return alert("Erreur lors de la sauvegarde."); }
  closeModal('modal-retard'); clearF(['re-heure', 're-duree', 're-amende']);
};

window.saveBeneficiaire = async function () {
  const aId = document.getElementById('be-adherent').value; if (!aId) return alert("Adhérent requis.");
  const editId = document.getElementById('be-edit-id').value;
  if (editId) {
    const b = state.beneficiaires.find(x => x.id === editId); if (!b) return;
    if (b.locked && currentUser?.role !== 'admin') { alert("🔒 Fiche clôturée — modification réservée à l'administrateur."); return; }
    b.adherentId = aId; b.adherentNom = aNom(getA(aId));
    b.date = document.getElementById('be-date').value;
    b.type = document.getElementById('be-type').value;
    b.valeur = document.getElementById('be-valeur').value;
    b.desc = document.getElementById('be-desc').value;
    b.statut = document.getElementById('be-statut').value;
    try { await setDoc(doc(db, 'beneficiaires', b.id), b); } catch (e) { console.error('editBeneficiaire', e); return alert("Erreur lors de la sauvegarde."); }
    document.getElementById('be-edit-id').value = '';
    document.getElementById('modal-beneficiaire').querySelector('.modal-title').textContent = '🎁 Bénéficiaire';
    closeModal('modal-beneficiaire'); clearF(['be-date', 'be-valeur', 'be-desc']);
    return;
  }
  const maxOrdre = state.beneficiaires.length ? Math.max(...state.beneficiaires.map(b => b.ordre || 0)) : 0;
  const newId = uid();
  const newB = { id: newId, adherentId: aId, adherentNom: aNom(getA(aId)), date: document.getElementById('be-date').value, type: document.getElementById('be-type').value, valeur: document.getElementById('be-valeur').value, desc: document.getElementById('be-desc').value, statut: document.getElementById('be-statut').value, ordre: maxOrdre + 1, locked: false, createdAt: new Date().toISOString() };
  try { await setDoc(doc(db, 'beneficiaires', newB.id), newB); } catch (e) { console.error('saveBeneficiaire', e); return alert("Erreur lors de la sauvegarde."); }
  state.beneficiaires.push(newB);
  closeModal('modal-beneficiaire'); clearF(['be-date', 'be-valeur', 'be-desc']); renderBeneficiaires(); updateDashboard(); saveData();
  setTimeout(() => voirFiche(newId), 200);
};

window.editBene = function (id) {
  const b = state.beneficiaires.find(x => x.id === id); if (!b) return;
  if (b.locked && currentUser?.role !== 'admin') { alert("🔒 Fiche clôturée — modification réservée à l'administrateur."); return; }
  document.getElementById('be-edit-id').value = id;
  document.getElementById('be-adherent').value = b.adherentId || '';
  document.getElementById('be-date').value = b.date || '';
  document.getElementById('be-type').value = b.type || 'Allocation';
  document.getElementById('be-valeur').value = b.valeur || '';
  document.getElementById('be-desc').value = b.desc || '';
  document.getElementById('be-statut').value = b.statut || 'En attente';
  document.getElementById('modal-beneficiaire').querySelector('.modal-title').textContent = '✏️ Modifier Bénéficiaire';
  openModal('modal-beneficiaire');
};

// ── FILE BÉNÉFICIAIRES ──
function avancerFile() {
  const sorted = [...state.beneficiaires].filter(b => !b.locked).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const actuel = state.beneficiaires.find(b => b.statut === 'Attribué' && !b.locked);
  if (!actuel) {
    const prochain = sorted.find(b => b.statut === 'En attente');
    if (prochain) prochain.statut = 'Attribué';
  }
}

window.cloturerFiche = async function (id) {
  const b = state.beneficiaires.find(x => x.id === id); if (!b) return;
  if (!confirm("⚠️ Clôturer cette fiche ? Action irréversible.")) return;
  b.statut = 'Clôturé'; b.locked = true;
  b.lockedAt = new Date().toISOString(); b.lockedBy = currentUser.nom;
  const sorted = [...state.beneficiaires].filter(x => !x.locked).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const prochain = sorted.find(x => x.statut === 'En attente');
  if (prochain) prochain.statut = 'Attribué';
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'beneficiaires', b.id), b);
    if (prochain) batch.set(doc(db, 'beneficiaires', prochain.id), prochain);
    await batch.commit();
  } catch (e) { console.error('cloturerFiche', e); }
  if (prochain) {
    setTimeout(() => alert("✅ Clôturé.\n\n🎁 Prochain bénéficiaire : " + prochain.adherentNom + " (rang #" + prochain.ordre + ")"), 100);
  } else {
    setTimeout(() => alert("✅ Fiche clôturée.\n\nAucun autre bénéficiaire en attente dans la file."), 100);
  }
  renderBeneficiaires(); window.renderMemberView(); updateDashboard(); saveData();
};

window.marquerAttribue = async function (id) {
  const b = state.beneficiaires.find(x => x.id === id); if (!b || b.locked) return;
  const actuel = state.beneficiaires.find(x => x.statut === 'Attribué' && x.id !== id && !x.locked);
  if (actuel) actuel.statut = 'En attente';
  b.statut = 'Attribué';
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'beneficiaires', b.id), b);
    if (actuel) batch.set(doc(db, 'beneficiaires', actuel.id), actuel);
    await batch.commit();
  } catch (e) { console.error('marquerAttribue', e); }
  renderBeneficiaires(); window.renderMemberView(); updateDashboard(); saveData();
};

window.delBene = async function (id) {
  const b = state.beneficiaires.find(x => x.id === id);
  if (b && b.locked && currentUser?.role !== 'admin') { alert("🔒 Fiche clôturée — suppression impossible."); return; }
  if (!confirm("Supprimer ?")) return;
  try { await deleteDoc(doc(db, 'beneficiaires', id)); } catch (e) { console.error('delBene', e); return alert("Erreur lors de la suppression."); }
  const i = state.beneficiaires.findIndex(x => x.id === id); if (i > -1) state.beneficiaires.splice(i, 1);
  reorderBene();
  if (state.beneficiaires.length) {
    try { const batch = writeBatch(db); state.beneficiaires.forEach(x => batch.set(doc(db, 'beneficiaires', x.id), x)); await batch.commit(); } catch (e) { console.error('delBene reorder', e); }
  }
  renderBeneficiaires(); updateDashboard(); saveData();
};

export function delItem(arr, id, cb) {
  const i = arr.findIndex(x => x.id === id); if (i > -1) arr.splice(i, 1); cb(); updateDashboard(); saveData();
}

export function reorderBene() { state.beneficiaires.forEach((b, i) => { b.ordre = i + 1; }); }

// ── DRAG & DROP ──
function initDragDrop() {
  document.querySelectorAll('#bene-tbody tr[draggable]').forEach(row => {
    row.addEventListener('dragstart', e => { dragSrc = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); document.querySelectorAll('#bene-tbody tr').forEach(r => r.classList.remove('drag-over')); });
    row.addEventListener('dragover', e => { e.preventDefault(); if (dragSrc && dragSrc !== row) { document.querySelectorAll('#bene-tbody tr').forEach(r => r.classList.remove('drag-over')); row.classList.add('drag-over'); } });
    row.addEventListener('drop', async e => {
      e.preventDefault(); if (!dragSrc || dragSrc === row) return;
      const si = state.beneficiaires.findIndex(b => b.id === dragSrc.dataset.id), ti = state.beneficiaires.findIndex(b => b.id === row.dataset.id);
      const src = state.beneficiaires[si];
      if (src?.locked) { alert('🔒 Impossible de déplacer une fiche clôturée.'); return; }
      state.beneficiaires.splice(si, 1); state.beneficiaires.splice(ti, 0, src);
      reorderBene();
      try { const batch = writeBatch(db); state.beneficiaires.forEach(x => batch.set(doc(db, 'beneficiaires', x.id), x)); await batch.commit(); } catch (e) { console.error('dragdrop reorder', e); }
      renderBeneficiaires(); saveData();
    });
  });
}

// ── RENDERS ──

function renderCaution() {
  const el = document.getElementById('table-caution'); if (!el) return;
  if (!state.caution.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔒</div>Aucune caution</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>#</th><th>Adhérent</th><th>Date</th><th>Montant</th><th>Objet</th><th>Échéance</th><th>Statut</th><th></th></tr></thead><tbody>${state.caution.map((c, i) => `<tr><td>${i + 1}</td><td>${c.adherentNom}</td><td>${c.date || '—'}</td><td>${c.montant ? Number(c.montant).toLocaleString() + ' F' : '—'}</td><td>${c.motif || '—'}</td><td>${c.echeance || '—'}</td><td>${bdg(c.statut)}</td><td><button class="btn btn-sm btn-danger" onclick="delCaution('${c.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}

function renderAide() {
  const el = document.getElementById('table-aide'); if (!el) return;
  if (!state.aide.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🤝</div>Aucune aide</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>#</th><th>Adhérent</th><th>Date</th><th>Type</th><th>Montant</th><th>Description</th><th>Statut</th><th></th></tr></thead><tbody>${state.aide.map((a, i) => `<tr><td>${i + 1}</td><td>${a.adherentNom}</td><td>${a.date || '—'}</td><td>${a.type}</td><td>${a.montant ? Number(a.montant).toLocaleString() + ' F' : '—'}</td><td>${a.desc || '—'}</td><td>${bdg(a.statut)}</td><td><button class="btn btn-sm btn-danger" onclick="delAide('${a.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}

function renderRetard() {
  const el = document.getElementById('table-retard'); if (!el) return;
  if (!state.retard.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">⏱️</div>Aucun retard</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>#</th><th>Adhérent</th><th>Réunion</th><th>Arrivée</th><th>Durée(min)</th><th>Amende</th><th>Justifié</th><th></th></tr></thead><tbody>${state.retard.map((r, i) => `<tr><td>${i + 1}</td><td>${r.adherentNom}</td><td>${r.reunionTitre || '—'}</td><td>${r.heure || '—'}</td><td>${r.duree || '—'}</td><td>${r.amende ? Number(r.amende).toLocaleString() + ' F' : '—'}</td><td>${bdg(r.justifie)}</td><td><button class="btn btn-sm btn-danger" onclick="delRetard('${r.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}

function renderBeneficiaires() {
  const el = document.getElementById('table-beneficiaires'); if (!el) return;
  const hasLocked = state.beneficiaires.some(b => b.locked);
  const lb = document.getElementById('locked-banner'); if (lb) lb.style.display = hasLocked ? 'flex' : 'none';
  if (!state.beneficiaires.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🎁</div>Aucun bénéficiaire</div>'; return; }
  const sorted = [...state.beneficiaires].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  el.innerHTML = `<table><thead><tr><th>↕</th><th>Rang</th><th>Adhérent</th><th>Date</th><th>Type</th><th>Valeur</th><th>Statut</th><th>Sécurité</th><th>Actions</th></tr></thead><tbody id="bene-tbody">${sorted.map((b, i) => {
    const locked = b.locked;
    return `<tr draggable="${!locked}" data-id="${b.id}" style="${locked ? 'background:#fef9f9' : ''}">
      <td>${locked ? '🔒' : '<span class="drag-handle">⠿</span>'}</td>
      <td>${getRankBadge(b.ordre || i + 1)}</td>
      <td><strong>${b.adherentNom}</strong></td>
      <td>${b.date || '—'}</td><td>${b.type}</td>
      <td style="font-weight:700;color:var(--secondary)">${b.valeur ? Number(b.valeur).toLocaleString() + ' F' : '—'}</td>
      <td>${bdg(b.statut)}</td>
      <td>${locked ? `<span class="badge badge-locked">🔒 Clôturée<br><small style="font-weight:400">${b.lockedBy || ''}</small></span>` : '<span class="badge badge-gray">Ouverte</span>'}</td>
      <td style="display:flex;gap:3px;flex-wrap:wrap">
        <button class="btn btn-sm btn-success" onclick="voirFiche('${b.id}')">📄</button>
        ${!locked ? `<button class="btn btn-sm btn-outline" onclick="editBene('${b.id}')" title="Modifier">✏️</button>
        ${b.statut === 'En attente' ? `<button class="btn btn-sm btn-primary" onclick="marquerAttribue('${b.id}')" title="Définir comme bénéficiaire actif">▶ Activer</button>` : ''}
        <button class="btn btn-sm btn-warning" onclick="cloturerFiche('${b.id}')" title="Clôturer et passer au suivant">🔒 Clôturer</button>
        <button class="btn btn-sm btn-danger" onclick="delBene('${b.id}')">🗑️</button>` : (currentUser?.role === 'admin' ? `<button class="btn btn-sm btn-outline" onclick="editBene('${b.id}')" title="Modifier">✏️</button><button class="btn btn-sm btn-danger" onclick="delBene('${b.id}')" title="Supprimer">🗑️</button>` : '')}
      </td></tr>`;
  }).join('')}</tbody></table>`;
  initDragDrop();
}

export function updateDashboard() {
  document.getElementById('stat-adherents').textContent = state.adherents.length;
  document.getElementById('stat-sanctions').textContent = state.sanctions.length;
  const solde = state.banque.reduce((s, t) => t.type === 'Entrée' ? s + t.montant : s - t.montant, 0);
  document.getElementById('stat-solde').textContent = solde.toLocaleString() + ' F';
  document.getElementById('stat-beneficiaires').textContent = state.beneficiaires.length;
  const dash = document.getElementById('dash-reunions'); if (!dash) return;
  if (!state.reunions.length) { dash.innerHTML = '<div class="empty"><div class="empty-icon">📅</div>Aucune réunion</div>'; return; }
  dash.innerHTML = [...state.reunions].reverse().slice(0, 3).map(r => `<div class="meeting-item" style="cursor:default"><div><strong>${r.titre}</strong><div style="font-size:.76rem;color:var(--muted);margin-top:2px">📅 ${r.date || '—'} 📍 ${r.lieu || '—'}</div></div>${bdg(r.statut)}</div>`).join('');
}

// ── FICHE ──
function nombreEnLettres(n) {
  if (!n || isNaN(n)) return 'zéro franc';
  const u = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const d = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  function deux(n) { if (n < 20) return u[n]; const di = Math.floor(n / 10), un = n % 10; if (di === 7 || di === 9) return d[di] + '-' + u[10 + un]; return d[di] + (un === 1 && di < 8 ? '-et-' : un ? '-' : '') + u[un]; }
  function trois(n) { if (n < 100) return deux(n); const c = Math.floor(n / 100), r = n % 100; return (c > 1 ? u[c] + '-' : '') + 'cent' + (r ? '-' + deux(r) : ''); }
  n = Math.round(n); let res = '';
  if (n >= 1000000) { res += trois(Math.floor(n / 1000000)) + ' million' + (Math.floor(n / 1000000) > 1 ? 's ' : ' '); n %= 1000000; }
  if (n >= 1000) { const m = Math.floor(n / 1000); res += (m === 1 ? 'mille ' : trois(m) + ' mille '); n %= 1000; }
  if (n > 0) res += trois(n);
  return res.trim() + ' francs';
}

window.voirFiche = function (id) {
  const b = state.beneficiaires.find(x => x.id === id); if (!b) return;
  const a = state.adherents.find(x => x.id === b.adherentId) || {};
  const orgNom = document.getElementById('org-nom')?.value || 'ORGANISATION';
  const orgResp = document.getElementById('org-responsable')?.value || '_______________';
  const orgLieu = document.getElementById('org-lieu')?.value || '_______________';
  const now = new Date(), dateEm = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), heureEm = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const ref = 'FB-' + String(b.ordre || '0').padStart(4, '0') + '-' + now.getFullYear();
  const autres = state.beneficiaires.filter(x => x.adherentId === b.adherentId);
  const sanctions_l = state.sanctions.filter(s => s.adherentId === b.adherentId);
  const aides_l = state.aide.filter(x => x.adherentId === b.adherentId);
  const lockedInfo = b.locked ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:.78rem;color:#dc2626">🔒 <strong>Fiche clôturée — Document officiel non modifiable</strong></div>` : '';
  document.getElementById('fiche-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">
      <div><div class="fiche-org">${orgNom}</div><div class="fiche-subtitle">Gestion des Réunions & Prestations</div></div>
      <div style="text-align:right"><div class="fiche-qr"></div><div style="font-size:.66rem;color:var(--muted);margin-top:2px">${ref}</div></div>
    </div>
    <div class="fiche-title-box">FICHE DE BÉNÉFICIAIRE</div>
    ${lockedInfo}
    <div style="text-align:center;margin-bottom:14px"><span class="badge ${b.statut === 'Attribué' ? 'badge-success' : b.statut === 'Clôturé' ? 'badge-gray' : 'badge-warning'}">${b.statut}</span> <span style="font-size:.75rem;color:var(--muted)">Émise le ${dateEm} à ${heureEm}</span></div>
    <div class="fiche-section"><div class="fiche-section-title">👤 Informations du Bénéficiaire</div>
      <div class="fiche-row"><span class="fiche-label">Nom & Prénom :</span><span class="fiche-value"><strong>${a.prenom || ''} ${a.nom || b.adherentNom}</strong></span></div>
      <div class="fiche-row"><span class="fiche-label">Téléphone :</span><span class="fiche-value">${a.tel || '—'}</span></div>
      <div class="fiche-row"><span class="fiche-label">Email :</span><span class="fiche-value">${a.email || '—'}</span></div>
      <div class="fiche-row"><span class="fiche-label">Profession :</span><span class="fiche-value">${a.profession || '—'}</span></div>
      <div class="fiche-row"><span class="fiche-label">Date d'adhésion :</span><span class="fiche-value">${a.date || '—'}</span></div>
    </div>
    <div class="fiche-section"><div class="fiche-section-title">🎁 Détail de la Prestation</div>
      <div class="fiche-row"><span class="fiche-label">Référence :</span><span class="fiche-value"><strong>${ref}</strong></span></div>
      <div class="fiche-row"><span class="fiche-label">Date :</span><span class="fiche-value">${b.date || '—'}</span></div>
      <div class="fiche-row"><span class="fiche-label">Type :</span><span class="fiche-value"><strong>${b.type}</strong></span></div>
      <div class="fiche-row"><span class="fiche-label">Description :</span><span class="fiche-value">${b.desc || '—'}</span></div>
      <div class="fiche-row"><span class="fiche-label">Rang dans la file :</span><span class="fiche-value">#${b.ordre || '—'}</span></div>
    </div>
    <div class="fiche-montant-box"><div class="fiche-montant-label">Valeur de la prestation</div>
      <div class="fiche-montant-value">${b.valeur ? Number(b.valeur).toLocaleString() + ' F CFA' : 'Non monétaire'}</div>
      ${b.valeur ? `<div class="fiche-montant-lettres">(${nombreEnLettres(Number(b.valeur))})</div>` : ''}
    </div>
    <div class="fiche-section"><div class="fiche-section-title">📋 Traçabilité</div>
      <div class="tracabilite-log">
        <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:6px">Prestations (${autres.length})</div>
        ${autres.length ? autres.map(x => `<div class="tracabilite-item"><div class="tracabilite-dot" style="background:${x.id === b.id ? 'var(--accent)' : 'var(--secondary)'}"></div><div class="tracabilite-time">${x.date || '—'}</div><div style="flex:1"><strong>${x.type}</strong>${x.valeur ? ' — ' + Number(x.valeur).toLocaleString() + ' F' : ''}${x.desc ? ' — ' + x.desc : ''} <span class="badge ${x.id === b.id ? 'badge-warning' : 'badge-info'}" style="font-size:.68rem">${x.id === b.id ? '← Actuelle' : 'passée'}</span>${x.locked ? ' 🔒' : ''}</div></div>`).join('') : '<div style="color:var(--muted);font-size:.78rem;padding:5px">Aucune autre prestation</div>'}
      </div>
      ${sanctions_l.length ? `<div class="tracabilite-log" style="margin-top:7px"><div style="font-size:.75rem;font-weight:700;color:#991b1b;margin-bottom:6px">⚠️ Sanctions (${sanctions_l.length})</div>${sanctions_l.map(s => `<div class="tracabilite-item"><div class="tracabilite-dot" style="background:var(--danger)"></div><div class="tracabilite-time">${s.date || '—'}</div><div style="flex:1">${s.type}${s.montant ? ' — ' + Number(s.montant).toLocaleString() + ' F' : ''} — ${s.motif || '—'} [${s.statut}]</div></div>`).join('')}</div>` : ''}
      ${aides_l.length ? `<div class="tracabilite-log" style="margin-top:7px"><div style="font-size:.75rem;font-weight:700;color:#065f46;margin-bottom:6px">🤝 Aides (${aides_l.length})</div>${aides_l.map(x => `<div class="tracabilite-item"><div class="tracabilite-dot" style="background:var(--success)"></div><div class="tracabilite-time">${x.date || '—'}</div><div style="flex:1">${x.type}${x.montant ? ' — ' + Number(x.montant).toLocaleString() + ' F' : ''}${x.desc ? ' — ' + x.desc : ''} [${x.statut}]</div></div>`).join('')}</div>` : ''}
    </div>
    <div class="fiche-signatures">
      <div class="fiche-sig-box"><div class="fiche-sig-line"></div><div class="fiche-sig-label">Le Bénéficiaire</div><div style="font-size:.78rem;margin-top:2px">${a.prenom || ''} ${a.nom || b.adherentNom}</div></div>
      <div class="fiche-sig-box"><div class="fiche-sig-line"></div><div class="fiche-sig-label">Le Responsable</div><div style="font-size:.78rem;margin-top:2px">${orgResp}</div></div>
    </div>
    <div class="fiche-footer">Émise par ${orgNom} — ${orgLieu} — le ${dateEm} à ${heureEm} | Réf: ${ref}</div>`;
  openModal('modal-fiche');
};

// ── FILE AUTO ──
window.genererFileAuto = async function () {
  if (!state.adherents.length) return alert("Aucun adhérent enregistré.");
  const dejaBene = new Set(state.beneficiaires.map(b => b.adherentId));
  const sansB = state.adherents.filter(a => !dejaBene.has(a.id) && a.statut === "Actif");
  if (!sansB.length) { alert("Tous les adhérents actifs sont déjà en file d'attente.\nPour une nouvelle rotation, ajoutez-les manuellement."); return; }
  if (!confirm("Ajouter " + sansB.length + " adhérent(s) sans bénéfice en file d'attente ?")) return;
  const today = new Date().toISOString().split("T")[0];
  const maxOrdre = state.beneficiaires.length ? Math.max(...state.beneficiaires.map(b => b.ordre || 0)) : 0;
  const nouveaux = sansB.map((a, i) => ({ id: uid(), adherentId: a.id, adherentNom: a.prenom + " " + a.nom, date: today, type: "Allocation", valeur: "", desc: "Ajout automatique - pas encore bénéficié", statut: "En attente", ordre: maxOrdre + i + 1, locked: false, createdAt: new Date().toISOString() }));
  try {
    const batch = writeBatch(db);
    nouveaux.forEach(b => batch.set(doc(db, 'beneficiaires', b.id), b));
    await batch.commit();
  } catch (e) { console.error('genererFileAuto', e); return alert("Erreur lors de la génération."); }
  state.beneficiaires.push(...nouveaux);
  reorderBene(); renderBeneficiaires(); updateDashboard(); saveData();
  alert("✅ " + sansB.length + " adhérent(s) ajouté(s) à la file.");
};

// ── PARAMÈTRES ──
function appliquerParams() {
  const fields = { 'p-nom': params.nom, 'p-responsable': params.responsable, 'p-lieu': params.lieu, 'p-desc': params.desc, 'p-frequence': params.frequence, 'p-jour': params.jour, 'p-heure': params.heure, 'p-nb-reunions': params.nbReunions, 'p-cotisation': params.cotisation, 'p-ration': params.ration, 'p-amende': params.amende };
  Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; });
  ['org-nom', 'org-responsable', 'org-lieu'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = [params.nom, params.responsable, params.lieu][i] || '';
  });
  renderArticles();
}

window.sauvegarderParametres = function () {
  params.nom = document.getElementById('p-nom').value;
  params.responsable = document.getElementById('p-responsable').value;
  params.lieu = document.getElementById('p-lieu').value;
  params.desc = document.getElementById('p-desc').value;
  params.frequence = document.getElementById('p-frequence').value;
  params.jour = document.getElementById('p-jour').value;
  params.heure = document.getElementById('p-heure').value;
  params.nbReunions = parseInt(document.getElementById('p-nb-reunions').value) || 12;
  params.cotisation = parseFloat(document.getElementById('p-cotisation').value) || 100000;
  params.ration = parseFloat(document.getElementById('p-ration').value) || 6000;
  params.amende = parseFloat(document.getElementById('p-amende').value) || 2000;
  saveData();
  alert("✅ Paramètres enregistrés !");
};

window.ajouterArticle = function () {
  const nom = prompt("Nom de l'article (ex: Farine) :"); if (!nom) return;
  const unite = prompt("Unité (ex: kg, paquet, bouteille) :") || "unité(s)";
  const qte = parseInt(prompt("Quantité par défaut :")) || 1;
  params.articles.push({ id: "art" + Date.now(), nom, unite, qteDefaut: qte });
  renderArticles(); saveData();
};

function renderArticles() {
  const el = document.getElementById('articles-list'); if (!el) return;
  if (!params.articles.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.82rem">Aucun article configuré</div>'; return; }
  el.innerHTML = params.articles.map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f8fafc;border-radius:8px;margin-bottom:6px">
      <span style="flex:1;font-size:.85rem"><strong>${a.nom}</strong> — ${a.qteDefaut} ${a.unite}</span>
      <button class="btn btn-sm btn-danger" onclick="supprimerArticle('${a.id}')">🗑️</button>
    </div>`).join('');
}

window.supprimerArticle = function (id) {
  params.articles = params.articles.filter(a => a.id !== id);
  renderArticles(); saveData();
};


// ── RENDER ALL ──
function renderAll() {
  renderReunions(); renderAdherents(); renderSanctions(); renderBanque(); renderCaution(); renderAide(); renderRetard(); renderBeneficiaires(); renderUsers(); updateCotisationSelects(); renderArticles();
}

// ── EXPOSE GLOBALS ──
window.state = state;
window.delItem = delItem;
window.renderCaution = renderCaution;
window.renderAide = renderAide;
window.renderRetard = renderRetard;
window.renderBeneficiaires = renderBeneficiaires;
window.renderAll = renderAll;
window.updateDashboard = updateDashboard;

// ── SUPPRESSION FIRESTORE : caution / aide / retard ──
window.delCaution = async function (id) {
  if (!confirm("Supprimer cette caution ?")) return;
  try { await deleteDoc(doc(db, 'caution', id)); } catch (e) { console.error('delCaution', e); alert("Erreur lors de la suppression."); }
};
window.delAide = async function (id) {
  if (!confirm("Supprimer cette aide ?")) return;
  try { await deleteDoc(doc(db, 'aide', id)); } catch (e) { console.error('delAide', e); alert("Erreur lors de la suppression."); }
};
window.delRetard = async function (id) {
  if (!confirm("Supprimer ce retard ?")) return;
  try { await deleteDoc(doc(db, 'retard', id)); } catch (e) { console.error('delRetard', e); alert("Erreur lors de la suppression."); }
};

// ── SYNC FIRESTORE : caution / aide / retard / bénéficiaires ──
onSnapshot(collection(db, 'caution'), snapshot => {
  state.caution = snapshot.docs.map(d => d.data());
  saveData(); renderCaution();
}, err => console.error('onSnapshot caution', err));

onSnapshot(collection(db, 'aide'), snapshot => {
  state.aide = snapshot.docs.map(d => d.data());
  saveData(); renderAide();
}, err => console.error('onSnapshot aide', err));

onSnapshot(collection(db, 'retard'), snapshot => {
  state.retard = snapshot.docs.map(d => d.data());
  saveData(); renderRetard();
}, err => console.error('onSnapshot retard', err));

onSnapshot(collection(db, 'beneficiaires'), snapshot => {
  state.beneficiaires = snapshot.docs.map(d => d.data()).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  saveData();
  renderBeneficiaires(); window.renderMemberView && window.renderMemberView(); updateDashboard();
}, err => console.error('onSnapshot beneficiaires', err));

// ── INDICATEUR FIREBASE ──
function initIndicateurFirebase() {
  const el = document.createElement('div');
  el.id = 'fb-indicator';
  el.style.cssText = 'position:fixed;bottom:16px;right:16px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.95);border-radius:20px;padding:5px 12px;box-shadow:0 2px 10px rgba(0,0,0,.18);font-size:.72rem;font-weight:600;z-index:9999;color:#374151;backdrop-filter:blur(4px);transition:opacity .3s';
  el.innerHTML = '<span id="fb-dot" style="width:8px;height:8px;border-radius:50%;transition:background .4s,box-shadow .4s"></span><span id="fb-label">Connexion…</span>';
  document.body.appendChild(el);

  function setStatus(enligne) {
    const dot = document.getElementById('fb-dot');
    const lbl = document.getElementById('fb-label');
    if (!dot || !lbl) return;
    if (enligne) {
      dot.style.background = '#22c55e';
      dot.style.boxShadow = '0 0 0 3px rgba(34,197,94,.25)';
      lbl.textContent = 'Firebase';
    } else {
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 0 3px rgba(239,68,68,.25)';
      lbl.textContent = 'Hors ligne';
    }
  }

  setStatus(navigator.onLine);
  window.addEventListener('online',  () => setStatus(true));
  window.addEventListener('offline', () => setStatus(false));

  onSnapshot(
    doc(db, 'meta', 'migration_done'),
    { includeMetadataChanges: true },
    snap => setStatus(!snap.metadata.fromCache),
    ()   => setStatus(false)
  );
}

// ── INIT ──
loadData();
initIndicateurFirebase();
migrerVersFirestore();
document.querySelectorAll('input[type=date]').forEach(el => el.value = new Date().toISOString().split('T')[0]);
document.getElementById('login-screen').style.display = 'flex';
