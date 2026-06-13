import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBhuylTWtSJxLjHDzFTc0SwfnpkYQa86j8",
  authDomain: "gestionreunion-e00e7.firebaseapp.com",
  projectId: "gestionreunion-e00e7",
  storageBucket: "gestionreunion-e00e7.firebasestorage.app",
  messagingSenderId: "535520593690",
  appId: "1:535520593690:web:e17ed2f8e3616bcc434ea3",
  measurementId: "G-HSLLEJ9JW7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
