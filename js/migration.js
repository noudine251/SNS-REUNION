import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const COLLECTIONS = [
  { stateKey: 'adherents',     col: 'membres'       },
  { stateKey: 'reunions',      col: 'reunions'      },
  { stateKey: 'cotisations',   col: 'cotisations'   },
  { stateKey: 'sanctions',     col: 'sanctions'     },
  { stateKey: 'banque',        col: 'banque'        },
  { stateKey: 'caution',       col: 'caution'       },
  { stateKey: 'aide',          col: 'aide'          },
  { stateKey: 'retard',        col: 'retard'        },
  { stateKey: 'beneficiaires', col: 'beneficiaires' },
];

const FLAG_REF = doc(db, 'meta', 'migration_done');

export async function migrerVersFirestore() {
  try {
    const flagSnap = await getDoc(FLAG_REF);
    if (flagSnap.exists() && flagSnap.data().done) return;

    const raw = localStorage.getItem('gestreunion');
    if (!raw) return;

    const data = JSON.parse(raw);
    let total = 0;

    for (const { stateKey, col } of COLLECTIONS) {
      const arr = data[stateKey];
      if (!Array.isArray(arr) || !arr.length) continue;

      for (let i = 0; i < arr.length; i += 499) {
        const chunk = arr.slice(i, i + 499);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          if (item?.id) batch.set(doc(db, col, item.id), item, { merge: true });
        });
        await batch.commit();
        total += chunk.length;
      }
    }

    await setDoc(FLAG_REF, { done: true, date: new Date().toISOString(), total });
    alert(`Migration terminée — ${total} document(s) envoyé(s) vers Firestore.`);
  } catch (e) {
    console.error('migrerVersFirestore', e);
  }
}
