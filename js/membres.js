import {
  state, saveData, uid, bdg, clearF,
  openModal, closeModal, populateSelects, updateDashboard
} from './app.js';
import { db } from './firebase.js';
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function getAdherentNom(id) {
  const a = state.adherents.find(x => x.id === id);
  return a ? a.prenom + ' ' + a.nom : '';
}

// ── Rendu ─────────────────────────────────────────────────────────────────────

export function renderAdherents() {
  const q = (document.getElementById('search-adherent')?.value || '').toLowerCase();
  const list = state.adherents.filter(a => (a.nom + ' ' + a.prenom).toLowerCase().includes(q));
  const el = document.getElementById('table-adherents'); if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div>Aucun adhérent</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>#</th><th>Nom & Prénom</th><th>Téléphone</th><th>Profession</th><th>Cotisation</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${list.map((a, i) => `<tr><td>${i + 1}</td><td><strong>${a.prenom} ${a.nom}</strong><br><small style="color:var(--muted)">${a.email || ''}</small></td><td>${a.tel || '—'}</td><td>${a.profession || '—'}</td><td>${a.cotisation ? Number(a.cotisation).toLocaleString() + ' F' : '—'}</td><td>${bdg(a.statut)}</td><td style="display:flex;gap:4px"><button class="btn btn-sm btn-outline" onclick="editAdherent('${a.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="delAdherent('${a.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}

// ── CRUD adhérents → Firestore "membres" ──────────────────────────────────────

window.saveAdherent = async function () {
  const nom = document.getElementById('a-nom').value.trim(), prenom = document.getElementById('a-prenom').value.trim();
  if (!nom || !prenom) return alert("Nom et prénom requis.");
  const editId = document.getElementById('a-id').value;
  const data = {
    id: editId || uid(), nom, prenom,
    tel: document.getElementById('a-tel').value,
    email: document.getElementById('a-email').value,
    profession: document.getElementById('a-profession').value,
    date: document.getElementById('a-date').value,
    statut: document.getElementById('a-statut').value,
    cotisation: document.getElementById('a-cotisation').value
  };
  try {
    await setDoc(doc(db, 'membres', data.id), data, { merge: true });
  } catch (e) {
    console.error('saveAdherent', e);
    return alert("Erreur lors de la sauvegarde.");
  }
  document.getElementById('a-id').value = '';
  document.getElementById('modal-adherent-title').textContent = '👤 Adhérent';
  closeModal('modal-adherent');
  clearF(['a-nom', 'a-prenom', 'a-tel', 'a-email', 'a-profession', 'a-date', 'a-cotisation']);
};

window.delAdherent = async function (id) {
  if (!confirm("Supprimer cet adhérent ?")) return;
  try {
    await deleteDoc(doc(db, 'membres', id));
  } catch (e) {
    console.error('delAdherent', e);
    alert("Erreur lors de la suppression.");
  }
};

window.editAdherent = function (id) {
  const a = state.adherents.find(x => x.id === id); if (!a) return;
  document.getElementById('a-id').value = a.id;
  document.getElementById('a-nom').value = a.nom;
  document.getElementById('a-prenom').value = a.prenom;
  document.getElementById('a-tel').value = a.tel || '';
  document.getElementById('a-email').value = a.email || '';
  document.getElementById('a-profession').value = a.profession || '';
  document.getElementById('a-date').value = a.date || '';
  document.getElementById('a-statut').value = a.statut || 'Actif';
  document.getElementById('a-cotisation').value = a.cotisation || '';
  document.getElementById('modal-adherent-title').textContent = '✏️ Modifier Adhérent';
  openModal('modal-adherent');
};

// ── Sync temps réel : Firestore "membres" → state.adherents ──────────────────

onSnapshot(
  collection(db, 'membres'),
  snapshot => {
    state.adherents = snapshot.docs.map(d => d.data());
    saveData();
    renderAdherents();
    updateDashboard();
  },
  err => console.error('onSnapshot membres', err)
);

// ── CRUD utilisateurs → Firestore "users" ────────────────────────────────────

export function renderUsers() {
  const el = document.getElementById('list-users'); if (!el) return;
  if (!state.users.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔑</div>Aucun utilisateur</div>'; return; }
  const colors = { admin: '#fef3c7', bureau: '#dbeafe', membre: '#d1fae5' }, icons = { admin: '👑', bureau: '🏢', membre: '👤' };
  el.innerHTML = state.users.map(u => `<div class="user-card">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="user-avatar" style="background:${colors[u.role] || '#f1f5f9'}">${icons[u.role] || '?'}</div>
      <div><div style="font-weight:700;font-size:.9rem">${u.nom}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:1px">Login : <code>${u.login}</code>${u.adherentId ? ' — ' + getAdherentNom(u.adherentId) : ''}</div></div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">${bdg(u.role)} ${bdg(u.statut)}
      <button class="btn btn-sm btn-outline" onclick="editUser('${u.id}')">✏️</button>
      ${u.id !== 'u1' ? `<button class="btn btn-sm btn-danger" onclick="delUser('${u.id}')">🗑️</button>` : ''}
    </div></div>`).join('');
}

window.saveUser = async function () {
  const login = document.getElementById('u-login').value.trim(), pass = document.getElementById('u-pass').value, nom = document.getElementById('u-nom').value.trim();
  if (!login || !nom) return alert("Login et nom requis.");
  const editId = document.getElementById('u-id').value;
  let userData;
  if (editId) {
    const u = state.users.find(x => x.id === editId);
    if (u) { u.login = login; if (pass) u.pass = pass; u.nom = nom; u.role = document.getElementById('u-role').value; u.adherentId = document.getElementById('u-adherent').value; u.statut = document.getElementById('u-statut').value; userData = u; }
  } else {
    if (state.users.find(u => u.login === login)) return alert("Ce login existe déjà.");
    if (!pass) return alert("Mot de passe requis.");
    userData = { id: uid(), login, pass, nom, role: document.getElementById('u-role').value, adherentId: document.getElementById('u-adherent').value, statut: document.getElementById('u-statut').value };
    state.users.push(userData);
  }
  if (userData) { try { await setDoc(doc(db, 'users', userData.id), userData); } catch (e) { console.error('saveUser', e); } }
  closeModal('modal-user'); clearF(['u-login', 'u-pass', 'u-nom', 'u-id']); renderUsers(); saveData();
};

window.editUser = function (id) {
  const u = state.users.find(x => x.id === id); if (!u) return;
  populateSelects();
  document.getElementById('u-id').value = u.id;
  document.getElementById('u-login').value = u.login;
  document.getElementById('u-pass').value = '';
  document.getElementById('u-nom').value = u.nom;
  document.getElementById('u-role').value = u.role;
  document.getElementById('u-adherent').value = u.adherentId || '';
  document.getElementById('u-statut').value = u.statut;
  openModal('modal-user');
};

window.delUser = async function (id) {
  if (id === 'u1') return alert("Impossible de supprimer l'administrateur.");
  if (!confirm("Supprimer ?")) return;
  try { await deleteDoc(doc(db, 'users', id)); } catch (e) { console.error('delUser', e); }
  const i = state.users.findIndex(x => x.id === id); if (i > -1) state.users.splice(i, 1); renderUsers(); saveData();
};

// ── Sync temps réel : Firestore "users" → state.users ────────────────────────

onSnapshot(
  collection(db, 'users'),
  snapshot => {
    if (!snapshot.empty) {
      state.users = snapshot.docs.map(d => d.data());
      saveData();
    } else {
      const defaults = [
        { id: 'u1', login: 'Snstech', pass: '1234', nom: 'Administrateur', role: 'admin', adherentId: '', statut: 'Actif' },
        { id: 'u2', login: 'Sinfo', pass: '1234', nom: 'SEVERIN Sinfo', role: 'membre', adherentId: '', statut: 'Actif' }
      ];
      state.users = defaults;
      const batch = writeBatch(db);
      defaults.forEach(u => batch.set(doc(db, 'users', u.id), u));
      batch.commit().catch(e => console.error('seed users', e));
      saveData();
    }
    renderUsers();
  },
  err => console.error('onSnapshot users', err)
);

window.renderAdherents = renderAdherents;
window.renderUsers = renderUsers;
