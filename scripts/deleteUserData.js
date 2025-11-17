// Script pour supprimer toutes les données d'un utilisateur depuis la console du navigateur
// Usage: Copiez-collez ce code dans la console du navigateur (F12) sur la page de l'application

import { deleteAllUserData } from '../services/firebaseApi';

// Exécuter la suppression
const emailToDelete = 'jeangrenouille999@gmail.com';

console.log(`🗑️ Début de la suppression de toutes les données pour: ${emailToDelete}`);

deleteAllUserData(emailToDelete)
  .then((result) => {
    if (result.success) {
      console.log('✅ Suppression terminée avec succès!');
      console.log('📊 Résumé:', result.deletedCounts);
      alert(`Suppression terminée!\n\nRésumé:\n- Documents: ${result.deletedCounts.documents}\n- Enveloppes: ${result.deletedCounts.envelopes}\n- Tokens: ${result.deletedCounts.tokens}\n- Emails: ${result.deletedCounts.emails}\n- Audit Trails: ${result.deletedCounts.auditTrails}\n- PDFs: ${result.deletedCounts.pdfs}\n- Authorized Users: ${result.deletedCounts.authorizedUsers}`);
    } else {
      console.error('❌ Erreur lors de la suppression');
      alert('Erreur lors de la suppression. Vérifiez la console pour plus de détails.');
    }
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    alert('Erreur lors de la suppression. Vérifiez la console pour plus de détails.');
  });

