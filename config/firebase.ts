// Configuration Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuration Firebase depuis les variables d'environnement
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Vérifier que la configuration est complète
const isConfigComplete = Object.values(firebaseConfig).every(value => value && value !== 'undefined');

if (!isConfigComplete) {
  console.warn('⚠️ Configuration Firebase incomplète. Vérifiez votre fichier .env.local');
  console.warn('Variables manquantes:', Object.entries(firebaseConfig).filter(([_, v]) => !v || v === 'undefined').map(([k]) => k));
}

// Initialiser Firebase
export const app = initializeApp(firebaseConfig);

// Initialiser les services
export const db = getFirestore(app, 'fosigneasy'); // Utiliser la base de données nommée "fosigneasy"
export const storage = getStorage(app);

// Export de la configuration pour debug
export { firebaseConfig };
export const isFirebaseConfigured = isConfigComplete;

