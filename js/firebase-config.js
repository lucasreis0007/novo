// Configuração e inicialização do Firebase.
// Todo o resto do app importa deste arquivo em vez de repetir a config.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCjIRrTGzmyvuRcz7Vsdoh_xL-c9yeHRcs",
    authDomain: "financas-e9cb0.firebaseapp.com",
    projectId: "financas-e9cb0",
    storageBucket: "financas-e9cb0.firebasestorage.app",
    messagingSenderId: "509373989364",
    appId: "1:509373989364:web:9900597ed5524f70da79a1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc
};
