// Script de vérification de la configuration Firebase
import { isFirebaseConfigured, firebaseConfig } from '../config/firebase';

export const checkFirebaseSetup = (): {
  configured: boolean;
  message: string;
  details: string[];
} => {
  const details: string[] = [];

  // Vérifier chaque variable d'environnement
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missingVars = requiredVars.filter(varName => {
    const value = import.meta.env[varName];
    return !value || value === 'undefined' || value === 'VOTRE_' || value.startsWith('VOTRE_');
  });

  if (missingVars.length > 0) {
    details.push(`❌ Variables manquantes ou non configurées :`);
    missingVars.forEach(varName => {
      details.push(`   - ${varName}`);
    });
    details.push('');
    details.push('📝 Pour configurer Firebase :');
    details.push('1. Créez un fichier .env.local à la racine du projet');
    details.push('2. Copiez le contenu de .env.template');
    details.push('3. Remplacez les valeurs VOTRE_XXX par vos vraies clés Firebase');
    details.push('');
    details.push('📚 Voir FIREBASE-QUICK-START.md pour le guide complet');

    return {
      configured: false,
      message: 'Firebase non configuré',
      details
    };
  }

  details.push('✅ Toutes les variables Firebase sont configurées');
  details.push('');
  details.push('Configuration actuelle :');
  details.push(`   Project ID: ${firebaseConfig.projectId}`);
  details.push(`   Auth Domain: ${firebaseConfig.authDomain}`);
  details.push(`   Storage Bucket: ${firebaseConfig.storageBucket}`);

  return {
    configured: true,
    message: 'Firebase correctement configuré',
    details
  };
};

// Test automatique au chargement (en dev seulement)
if (import.meta.env.DEV) {
  const result = checkFirebaseSetup();
  console.group('🔥 FIREBASE CONFIGURATION CHECK');
  console.log(result.message);
  result.details.forEach(line => console.log(line));
  console.groupEnd();
}

