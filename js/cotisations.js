import { state, params, saveData, uid, openModal, closeModal } from './app.js';
import { db } from './firebase.js';
import {
  collection, doc, setDoc,
  onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Sélects réunion ───────────────────────────────────────────────────────────

export function updateCotisationSelects() {
  ["cotis-reunion-select", "cotis-modal-reunion"].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const val = el.value;
    el.innerHTML = '<option value="">-- Choisir une réunion --</option>';
    [...state.reunions].sort((a, b) => b.date.localeCompare(a.date)).forEach(r => {
      const o = document.createElement("option");
      o.value = r.id; o.textContent = r.titre + " (" + r.date + ")"; el.appendChild(o);
    });
    if (val) el.value = val;
  });
}

// ── Grille de saisie ──────────────────────────────────────────────────────────

window.openCotisationReunion = function () {
  updateCotisationSelects();
  openModal("modal-cotisation");
  chargerLigneCotisation();
};

window.chargerLigneCotisation = function () {
  const rId = document.getElementById("cotis-modal-reunion").value;
  const el = document.getElementById("cotis-modal-lignes"); if (!el) return;
  if (!rId) { el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>Sélectionnez une réunion</div>'; return; }
  if (!state.adherents.length) { el.innerHTML = '<div class="empty">Aucun adhérent enregistré</div>'; return; }
  const lignes = state.adherents.filter(a => a.statut === "Actif").map(a => {
    const existing = state.cotisations.find(x => x.reunionId === rId && x.adherentId === a.id);
    const cotis = existing?.argent?.cotisation ?? params.cotisation;
    const ration = existing?.argent?.ration ?? params.ration;
    const penalite = existing?.argent?.penalite ?? 0;
    const nature = params.articles.map(art => {
      const found = existing?.nature?.find(n => n.articleId === art.id);
      return { articleId: art.id, nom: art.nom, unite: art.unite, qteDefaut: art.qteDefaut, fait: found ? found.fait : false, qte: found ? found.qte : art.qteDefaut };
    });
    const statut = existing?.statut || "En attente";
    return { a, existing, cotis, ration, penalite, nature, statut, id: existing?.id || null };
  });
  el.innerHTML = `
    <div style="overflow-x:auto">
    <table style="font-size:.8rem">
      <thead><tr>
        <th>Adhérent</th>
        <th>Cotisation (F)</th>
        <th>Ration (F)</th>
        <th>Pénalité (F)</th>
        ${params.articles.map(a => `<th>${a.nom} (${a.unite})</th>`).join("")}
        <th>Statut</th>
      </tr></thead>
      <tbody>
        ${lignes.map((l) => `<tr data-adherent-id="${l.a.id}" data-existing-id="${l.id || ""}">
          <td><strong>${l.a.prenom} ${l.a.nom}</strong></td>
          <td><input type="number" class="cl-cotis" value="${l.cotis}" style="width:80px;padding:4px 6px;font-size:.78rem;border:1px solid var(--border);border-radius:4px"></td>
          <td><input type="number" class="cl-ration" value="${l.ration}" style="width:70px;padding:4px 6px;font-size:.78rem;border:1px solid var(--border);border-radius:4px"></td>
          <td><input type="number" class="cl-penalite" value="${l.penalite}" style="width:70px;padding:4px 6px;font-size:.78rem;border:1px solid var(--border);border-radius:4px"></td>
          ${l.nature.map(n => `<td style="text-align:center">
            <input type="checkbox" class="cl-nature-check" data-art="${n.articleId}" ${n.fait ? "checked" : ""} style="margin-right:4px">
            <input type="number" class="cl-nature-qte" data-art="${n.articleId}" value="${n.qte}" style="width:44px;padding:3px 5px;font-size:.76rem;border:1px solid var(--border);border-radius:4px">
          </td>`).join("")}
          <td>
            <select class="cl-statut" style="font-size:.76rem;padding:3px 5px;border:1px solid var(--border);border-radius:4px">
              <option ${l.statut === "En attente" ? "selected" : ""}>En attente</option>
              <option ${l.statut === "Payé" ? "selected" : ""}>Payé</option>
              <option ${l.statut === "Partiel" ? "selected" : ""}>Partiel</option>
              <option ${l.statut === "Absent" ? "selected" : ""}>Absent</option>
            </select>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>
    </div>`;
};

// ── Sauvegarde cotisations → Firestore "cotisations" ─────────────────────────

window.sauvegarderCotisations = async function () {
  const rId = document.getElementById("cotis-modal-reunion").value;
  if (!rId) return alert("Choisissez une réunion.");
  const rows = document.querySelectorAll("#cotis-modal-lignes tbody tr");
  const objs = [];
  rows.forEach(row => {
    const aId = row.dataset.adherentId;
    const existingId = row.dataset.existingId;
    const a = state.adherents.find(x => x.id === aId); if (!a) return;
    const cotis = parseFloat(row.querySelector(".cl-cotis").value) || 0;
    const ration = parseFloat(row.querySelector(".cl-ration").value) || 0;
    const penalite = parseFloat(row.querySelector(".cl-penalite").value) || 0;
    const statut = row.querySelector(".cl-statut").value;
    const nature = params.articles.map(art => {
      const check = row.querySelector(".cl-nature-check[data-art='" + art.id + "']");
      const qteEl = row.querySelector(".cl-nature-qte[data-art='" + art.id + "']");
      return { articleId: art.id, nom: art.nom, unite: art.unite, fait: check ? check.checked : false, qte: qteEl ? parseFloat(qteEl.value) || 0 : art.qteDefaut };
    });
    const total = cotis + ration + penalite;
    let docId = existingId || state.cotisations.find(x => x.reunionId === rId && x.adherentId === aId)?.id || uid();
    objs.push({ id: docId, reunionId: rId, adherentId: aId, adherentNom: a.prenom + " " + a.nom, argent: { cotisation: cotis, ration, penalite, total }, nature, statut, date: new Date().toISOString().split("T")[0] });
  });
  try {
    const batch = writeBatch(db);
    objs.forEach(obj => batch.set(doc(db, 'cotisations', obj.id), obj));
    await batch.commit();
  } catch (e) {
    console.error('sauvegarderCotisations', e);
    return alert("Erreur lors de l'enregistrement.");
  }
  closeModal("modal-cotisation");
  alert("✅ Cotisations enregistrées !");
};

// ── Rendu tableau cotisations ─────────────────────────────────────────────────

export function renderCotisationsReunion() {
  const rId = document.getElementById("cotis-reunion-select")?.value;
  updateCotisationSelects();
  const el = document.getElementById("table-cotisations"); if (!el) return;
  const resume = document.getElementById("cotis-resume");
  if (!rId) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>Sélectionnez une réunion pour voir les cotisations</div>';
    if (resume) resume.style.display = "none";
    return;
  }
  const lignes = state.cotisations.filter(x => x.reunionId === rId);
  if (resume) resume.style.display = "block";
  const totalArgent = lignes.filter(x => x.statut === "Payé" || x.statut === "Partiel").reduce((s, x) => s + (x.argent?.total || 0), 0);
  const totalHuile = lignes.reduce((s, x) => { const n = x.nature?.find(n => n.nom === "Huile"); return s + (n && n.fait ? n.qte : 0); }, 0);
  const totalSavon = lignes.reduce((s, x) => { const n = x.nature?.find(n => n.nom === "Savon"); return s + (n && n.fait ? n.qte : 0); }, 0);
  const nonPayes = lignes.filter(x => x.statut === "En attente" || x.statut === "Absent").length;
  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl("cotis-total-argent", totalArgent.toLocaleString() + " F");
  setEl("cotis-total-huile", totalHuile + " btl");
  setEl("cotis-total-savon", totalSavon + " pcs");
  setEl("cotis-non-payes", nonPayes);
  if (!lignes.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>Aucune cotisation saisie pour cette réunion<br><button class="btn btn-primary" style="margin-top:12px" onclick="openCotisationReunion()">+ Saisir maintenant</button></div>';
    return;
  }
  const statusBadge = { "Payé": "badge-success", "Partiel": "badge-warning", "En attente": "badge-info", "Absent": "badge-danger" };
  el.innerHTML = `
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th>#</th><th>Adhérent</th><th>Cotisation</th><th>Ration</th><th>Pénalité</th>
        ${params.articles.map(a => `<th>${a.nom}</th>`).join("")}
        <th>Total</th><th>Statut</th>
      </tr></thead>
      <tbody>
        ${lignes.map((l, i) => `<tr>
          <td>${i + 1}</td>
          <td><strong>${l.adherentNom}</strong></td>
          <td>${(l.argent?.cotisation || 0).toLocaleString()} F</td>
          <td>${(l.argent?.ration || 0).toLocaleString()} F</td>
          <td class="${(l.argent?.penalite || 0) > 0 ? "amount-neg" : ""}">${(l.argent?.penalite || 0).toLocaleString()} F</td>
          ${params.articles.map(art => { const n = l.nature?.find(n => n.nom === art.nom); return `<td style="text-align:center">${n && n.fait ? '<span style="color:var(--success)">✅ ' + n.qte + '</span>' : '<span style="color:var(--danger)">❌</span>'}</td>`; }).join("")}
          <td style="font-weight:700">${(l.argent?.total || 0).toLocaleString()} F</td>
          <td><span class="badge ${statusBadge[l.statut] || "badge-gray"}">${l.statut}</span></td>
        </tr>`).join("")}
        <tr style="background:#f8fafc;font-weight:700">
          <td colspan="2">TOTAL</td>
          <td>${lignes.reduce((s, l) => s + (l.argent?.cotisation || 0), 0).toLocaleString()} F</td>
          <td>${lignes.reduce((s, l) => s + (l.argent?.ration || 0), 0).toLocaleString()} F</td>
          <td>${lignes.reduce((s, l) => s + (l.argent?.penalite || 0), 0).toLocaleString()} F</td>
          ${params.articles.map(art => { const tot = lignes.reduce((s, l) => { const n = l.nature?.find(n => n.nom === art.nom); return s + (n && n.fait ? n.qte : 0); }, 0); return `<td style="text-align:center;font-weight:700">${tot} ${art.unite}</td>`; }).join("")}
          <td>${lignes.reduce((s, l) => s + (l.argent?.total || 0), 0).toLocaleString()} F</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    </div>`;
}

// ── Impression feuille de présence ────────────────────────────────────────────

window.imprimerFeuillePresence = function () {
  const rId = document.getElementById("cotis-reunion-select")?.value;
  const r = rId ? state.reunions.find(x => x.id === rId) : null;
  const titre = r ? r.titre : "Réunion";
  const dateR = r ? new Date(r.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "—";
  const adherents = state.adherents.filter(a => a.statut === "Actif");
  const colsNature = params.articles.map(a => `<th style="min-width:80px">${a.nom}<br><small>${a.qteDefaut} ${a.unite}</small></th>`).join("");
  const rows = adherents.map((a, i) => {
    const l = state.cotisations.find(x => x.reunionId === rId && x.adherentId === a.id);
    const statusBadge = l ? ({ Payé: "✅", Partiel: "⚠️", "En attente": "⏳", Absent: "❌" }[l.statut] || "") : "";
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td><strong>${a.prenom} ${a.nom}</strong></td>
      <td style="text-align:center">${l ? (l.argent?.cotisation || 0).toLocaleString() + " F" : params.cotisation.toLocaleString() + " F"}</td>
      <td style="text-align:center">${l ? (l.argent?.ration || 0).toLocaleString() + " F" : params.ration.toLocaleString() + " F"}</td>
      ${params.articles.map(art => { const n = l?.nature?.find(n => n.nom === art.nom); return `<td style="text-align:center">${l ? (n && n.fait ? "✅ " + n.qte : "❌") : "□"}</td>`; }).join("")}
      <td style="text-align:center">${statusBadge} ${l ? l.statut : ""}</td>
      <td style="min-width:80px"></td>
    </tr>`;
  }).join("");
  document.getElementById("feuille-presence-content").innerHTML = `
    <div style="font-family:Arial,sans-serif;max-width:100%;padding:10px">
      <div style="text-align:center;border-bottom:3px double #1a3c6e;padding-bottom:14px;margin-bottom:16px">
        <div style="font-size:1.3rem;font-weight:800;color:#1a3c6e;text-transform:uppercase;letter-spacing:1px">${params.nom || "ASSOCIATION"}</div>
        <div style="font-size:.85rem;color:#64748b;margin-top:4px">${params.lieu || ""}</div>
        <div style="background:#1a3c6e;color:white;padding:8px 20px;border-radius:6px;display:inline-block;margin-top:10px;font-weight:700;font-size:.95rem">
          FEUILLE DE PRÉSENCE &amp; COTISATION
        </div>
        <div style="margin-top:10px;font-size:.88rem"><strong>${titre}</strong> — ${dateR}</div>
        <div style="font-size:.8rem;color:#64748b;margin-top:4px">Heure : ${r?.heure || params.heure || "09:00"} &nbsp;|&nbsp; Lieu : ${r?.lieu || params.lieu || "—"} &nbsp;|&nbsp; Membres présents : ___/___</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.8rem">
        <thead>
          <tr style="background:#1a3c6e;color:white">
            <th style="padding:7px;border:1px solid #ccc">#</th>
            <th style="padding:7px;border:1px solid #ccc;min-width:140px">Nom & Prénom</th>
            <th style="padding:7px;border:1px solid #ccc">Cotisation</th>
            <th style="padding:7px;border:1px solid #ccc">Ration</th>
            ${colsNature}
            <th style="padding:7px;border:1px solid #ccc">Statut</th>
            <th style="padding:7px;border:1px solid #ccc">Signature</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700">
            <td colspan="2" style="padding:7px;border:1px solid #ccc">TOTAL</td>
            <td style="padding:7px;border:1px solid #ccc;text-align:center">${state.cotisations.filter(x => x.reunionId === rId).reduce((s, l) => s + (l.argent?.cotisation || 0), 0).toLocaleString()} F</td>
            <td style="padding:7px;border:1px solid #ccc;text-align:center">${state.cotisations.filter(x => x.reunionId === rId).reduce((s, l) => s + (l.argent?.ration || 0), 0).toLocaleString()} F</td>
            ${params.articles.map(art => { const tot = state.cotisations.filter(x => x.reunionId === rId).reduce((s, l) => { const n = l.nature?.find(n => n.nom === art.nom); return s + (n && n.fait ? n.qte : 0); }, 0); return `<td style="padding:7px;border:1px solid #ccc;text-align:center;font-weight:700">${tot} ${art.unite}</td>`; }).join("")}
            <td colspan="2" style="padding:7px;border:1px solid #ccc"></td>
          </tr>
        </tfoot>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px;padding-top:16px;border-top:2px solid #e2e8f0">
        <div style="text-align:center"><div style="border-bottom:1.5px solid #333;margin:36px 0 6px"></div><div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b">Le Trésorier / ${params.responsable || "Responsable"}</div></div>
        <div style="text-align:center"><div style="border-bottom:1.5px solid #333;margin:36px 0 6px"></div><div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b">Le Président / Secrétaire</div></div>
      </div>
      <div style="text-align:center;margin-top:14px;font-size:.7rem;color:#94a3b8;font-style:italic">Document généré par GestRéunion — ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>`;
  openModal("modal-presence");
};

// ── Sync temps réel : Firestore "cotisations" → state.cotisations ─────────────

onSnapshot(
  collection(db, 'cotisations'),
  snapshot => {
    state.cotisations = snapshot.docs.map(d => d.data());
    saveData();
    renderCotisationsReunion();
  },
  err => console.error('onSnapshot cotisations', err)
);

window.updateCotisationSelects = updateCotisationSelects;
window.renderCotisationsReunion = renderCotisationsReunion;
