import { db } from './firebase.js';
import {
  collection, getDocs, writeBatch, doc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

(async function () {
  // Capture du tag script avant toute opération async (querySelector null en module async)
  const scriptEl = [...document.querySelectorAll('script[type="module"]')]
    .find(s => s.src && s.src.includes('reset.js'));

  // ── Collections à vider ───────────────────────────────────────────────────
  const COLLECTIONS = [
    'membres', 'adherents', 'beneficiaires', 'reunions',
    'cotisations', 'sanctions', 'banque',
    'caution', 'aide', 'retard', 'users', 'meta'
  ];

  let total = 0;
  const errors = [];

  for (const colName of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) continue;

      // Firestore limite les batches à 500 opérations
      for (let i = 0; i < snap.docs.length; i += 499) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 499).forEach(d => batch.delete(doc(db, colName, d.id)));
        await batch.commit();
        total += snap.docs.slice(i, i + 499).length;
      }
    } catch (e) {
      errors.push(colName + ' : ' + e.message);
      console.error('reset ' + colName, e);
    }
  }

  // ── Vider localStorage ────────────────────────────────────────────────────
  localStorage.removeItem('gestreunion');
  localStorage.removeItem('gestreunion_params');

  // ── Suppression du tag script dans le DOM ─────────────────────────────────
  if (scriptEl) scriptEl.remove();

  // ── Rapport final ─────────────────────────────────────────────────────────
  if (errors.length) {
    console.error('Reset partiel — erreurs :', errors);
  } else {
    console.log('Reset terminé —', total, 'document(s) supprimé(s).');
  }
})();
