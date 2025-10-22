// Service Firebase API - Remplace localStorageApi.ts
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  getDocs,
  orderBy,
  where,
  Timestamp
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
  getBlob
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import type { Document, Envelope, Recipient, Field, MockEmail, AuditEvent } from '../types';
import { DocumentStatus, FieldType } from '../types';

// ===== DOCUMENTS =====

export const getDocuments = async (): Promise<Document[]> => {
  try {
    const q = query(
      collection(db, 'documents'),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Document));
  } catch (error) {
    console.error('Erreur getDocuments:', error);
    return [];
  }
};

export const getEnvelopeByToken = async (token: string): Promise<(Envelope & { currentSignerId: string; isExpired?: boolean }) | null> => {
  try {
    // Récupérer le token
    const tokenDoc = await getDoc(doc(db, 'tokens', token));
    if (!tokenDoc.exists()) {
      console.error('Token non trouvé:', token);
      return null;
    }

    const tokenData = tokenDoc.data();
    const { envelopeId, recipientId } = tokenData;

    // Récupérer l'enveloppe
    const envelopeDoc = await getDoc(doc(db, 'envelopes', envelopeId));
    if (!envelopeDoc.exists()) {
      console.error('Enveloppe non trouvée:', envelopeId);
      return null;
    }

    const envelopeData = envelopeDoc.data() as Envelope;
    
    // 🔒 VÉRIFICATION D'EXPIRATION : Vérifier si le document a expiré
    const now = new Date();
    const expiresAt = new Date(envelopeData.document.expiresAt);
    const isExpired = expiresAt < now;
    
    if (isExpired) {
      console.warn('⚠️ Document expiré:', envelopeData.document.name, 'Expiration:', expiresAt.toLocaleString('fr-FR'));
    }
    
    return { ...envelopeData, currentSignerId: recipientId, isExpired };
  } catch (error) {
    console.error('Erreur getEnvelopeByToken:', error);
    return null;
  }
};

export const getPdfData = async (documentId: string): Promise<string | null> => {
  try {
    // 1. Essayer d'abord dans Storage (nouveaux documents)
    try {
      const pdfRef = ref(storage, `pdfs/${documentId}.pdf`);
      const blob = await getBlob(pdfRef);
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (storageError: any) {
      // Si non trouvé dans Storage, chercher dans Firestore (anciens documents)
      if (storageError.code === 'storage/object-not-found') {
        console.log('   PDF non trouvé dans Storage, recherche dans Firestore...');
        const pdfDoc = await getDoc(doc(db, 'pdfs', documentId));
        
        if (pdfDoc.exists()) {
          const data = pdfDoc.data();
          return data.base64Data || null;
        }
      }
      throw storageError;
    }
  } catch (error) {
    console.error('❌ Erreur getPdfData:', error);
    return null;
  }
};

export const createEnvelope = async (
  fileData: { name: string, base64: string, totalPages: number },
  recipients: (Omit<Recipient, 'id'> & { id: number })[],
  fields: (Omit<Field, 'id' | 'recipientId'> & { tempRecipientId: number })[],
  creatorEmail: string = 'creator@signeasyfo.com' // Email de l'expéditeur
): Promise<{ envelope: Envelope, tokens: { recipientId: string, token: string }[] }> => {
  try {
    const newDocId = `doc${Date.now()}`;
    const newEnvelopeId = `env${Date.now()}`;

    console.log('🔥 Création via Firebase...');
    console.log('   Document ID:', newDocId);
    console.log('   PDF taille:', (fileData.base64.length / 1024).toFixed(2), 'KB');

    // Calculer la date d'expiration (7 jours à partir de maintenant)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);

    // 1. Créer le document
    const newDoc: Document = {
      id: newDocId,
      name: fileData.name,
      status: DocumentStatus.SENT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalPages: fileData.totalPages,
      expiresAt: expirationDate.toISOString(),
      creatorEmail: creatorEmail, // Email de l'expéditeur pour notifications
    };

    console.log('   📅 Date d\'expiration:', expirationDate.toLocaleString('fr-FR'));
    console.log('   📧 Expéditeur:', creatorEmail);

    await setDoc(doc(db, 'documents', newDocId), newDoc);
    console.log('   ✅ Document créé dans Firestore');

    // 2. Uploader le PDF dans Firebase Storage (sans limitation de taille)
    const pdfRef = ref(storage, `pdfs/${newDocId}.pdf`);
    await uploadString(pdfRef, fileData.base64, 'data_url');
    console.log('   ✅ PDF uploadé dans Storage');

    // 3. Créer les destinataires
    const recipientIdMap = new Map<number, string>();
    const newRecipients: Recipient[] = recipients.map((r, i) => {
      const newId = `rec-${newDocId}-${i + 1}`;
      recipientIdMap.set(r.id, newId);
      const { id, ...rest } = r;
      return { ...rest, id: newId };
    });

    // 4. Créer les champs
    const newFields: Field[] = fields.map((f, i) => {
      const finalRecipientId = recipientIdMap.get(f.tempRecipientId) || 'unknown';
      const { tempRecipientId, ...rest } = f;
      return { ...rest, id: `f-${newDocId}-${i + 1}`, recipientId: finalRecipientId };
    });

    // 5. Créer l'enveloppe
    const newEnvelope: Envelope = {
      id: newEnvelopeId,
      document: newDoc,
      recipients: newRecipients,
      fields: newFields
    };

    await setDoc(doc(db, 'envelopes', newEnvelopeId), newEnvelope);
    console.log('   ✅ Enveloppe créée dans Firestore');

    // 6. Créer les tokens
    const newTokens = await Promise.all(
      newRecipients.map(async (r, index) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const token = `token-${newDocId}-${timestamp}-${random}-${index}`;

        await setDoc(doc(db, 'tokens', token), {
          envelopeId: newEnvelopeId,
          recipientId: r.id
        });

        return { recipientId: r.id, token };
      })
    );
    console.log('   ✅ Tokens créés dans Firestore');

    // 7. Créer des emails simulés pour chaque destinataire
    await Promise.all(
      newTokens.map(async ({ recipientId, token }) => {
        const recipient = newRecipients.find(r => r.id === recipientId);
        if (!recipient) return;

        const emailId = `email-${token}`;
        const mockEmail: MockEmail = {
          id: emailId,
          from: "noreply@signeasyfo.com",
          to: recipient.email,
          subject: `Signature requise : ${fileData.name}`,
          body: `Bonjour ${recipient.name},\n\nVous avez un document à signer : "${fileData.name}".\n\nCliquez sur le bouton ci-dessous pour le signer.`,
          signatureLink: `${window.location.origin}/#/sign/${token}`,
          documentName: fileData.name,
          sentAt: new Date().toISOString(),
          read: false
        };

        await setDoc(doc(db, 'emails', emailId), mockEmail);
      })
    );
    console.log('   ✅ Emails créés dans Firestore');

    // 8. Créer l'audit trail
    const auditEvents: AuditEvent[] = [
      {
        timestamp: newDoc.createdAt,
        action: "Document Créé",
        user: "creator@example.com",
        ip: "127.0.0.1",
        type: 'CREATE'
      },
      {
        timestamp: newDoc.updatedAt,
        action: "Enveloppe Envoyée",
        recipients: newRecipients.map(r => r.email),
        type: 'SEND'
      }
    ];

    await setDoc(doc(db, 'auditTrails', newDocId), { events: auditEvents });
    console.log('   ✅ Audit trail créé');

    console.log('✅ Création Firebase terminée !');

    return { envelope: newEnvelope, tokens: newTokens };
  } catch (error) {
    console.error('❌ Erreur createEnvelope Firebase:', error);
    throw error;
  }
};

// 📧 FONCTION UTILITAIRE : Envoyer via les 2 services EmailJS (Gmail + Outlook)
const sendEmailViaDualServices = async (
  templateId: string,
  templateParams: any,
  recipientEmail: string
): Promise<{ success: boolean; results: any[] }> => {
  // @ts-ignore - emailjs est chargé depuis un script tag dans index.html
  if (typeof emailjs === 'undefined') {
    console.error("EmailJS SDK n'est pas chargé.");
    return { success: false, results: [] };
  }

  const SERVICES = [
    { id: 'service_tcdw2fd', name: 'Gmail' },
    { id: 'service_ltiackr', name: 'Outlook' }
  ];
  const PUBLIC_KEY = 'g2n34kxUJPlU6tsI0';

  const results = await Promise.allSettled(
    SERVICES.map(async (service) => {
      try {
        // @ts-ignore
        await emailjs.send(service.id, templateId, templateParams, PUBLIC_KEY);
        console.log(`✅ Email envoyé via ${service.name} à:`, recipientEmail);
        return { service: service.name, success: true };
      } catch (error) {
        console.warn(`⚠️ Échec via ${service.name} à ${recipientEmail}:`, error);
        return { service: service.name, success: false, error };
      }
    })
  );

  // Au moins un service a réussi ?
  const hasSuccess = results.some(r => r.status === 'fulfilled' && r.value.success);
  
  if (hasSuccess) {
    const successfulServices = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => r.status === 'fulfilled' ? r.value.service : '');
    console.log(`📧 Email envoyé avec succès via: ${successfulServices.join(', ')}`);
  } else {
    console.error(`❌ Échec d'envoi via TOUS les services à: ${recipientEmail}`);
  }

  return { 
    success: hasSuccess, 
    results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false }) 
  };
};

// 📧 NOTIFICATION : Envoyer un email de confirmation après signature
export const sendSignatureConfirmationEmail = async (
  documentId: string,
  documentName: string,
  signerName: string,
  signerEmail: string,
  creatorEmail: string,
  viewToken: string
): Promise<{ success: boolean; error?: any }> => {
  const TEMPLATE_ID = 'template_6t8rxgv'; // ✅ Template pour notification de signature

  const templateParams = {
    recipient_email: creatorEmail,
    document_name: documentName,
    document_id: documentId,
    signer_name: signerName,
    signer_email: signerEmail,
    signature_date: new Date().toLocaleString('fr-FR'),
    view_link: `${window.location.origin}${window.location.pathname}#/sign/${viewToken}`,
  };

  const result = await sendEmailViaDualServices(TEMPLATE_ID, templateParams, creatorEmail);
  return { success: result.success };
};

export const submitSignature = async (
  token: string,
  signedFields: Field[]
): Promise<{ success: boolean }> => {
  try {
    // Récupérer le token
    const tokenDoc = await getDoc(doc(db, 'tokens', token));
    if (!tokenDoc.exists()) return { success: false };

    const tokenData = tokenDoc.data();
    const { envelopeId, recipientId } = tokenData;

    // Récupérer l'enveloppe
    const envelopeDoc = await getDoc(doc(db, 'envelopes', envelopeId));
    if (!envelopeDoc.exists()) return { success: false };

    const envelope = envelopeDoc.data() as Envelope;
    const signer = envelope.recipients.find(r => r.id === recipientId);

    if (!signer) return { success: false };

    // Mettre à jour les champs
    const updatedFields = envelope.fields.map(field => {
      const signedField = signedFields.find(sf => sf.id === field.id);
      return signedField ? { ...field, value: signedField.value } : field;
    });

    // Vérifier si tous les champs de signature sont signés
    const allSigned = envelope.recipients.every(recipient =>
      updatedFields
        .filter(f => f.recipientId === recipient.id && f.type === FieldType.SIGNATURE)
        .every(f => f.value != null)
    );

    // Mettre à jour l'enveloppe
    await updateDoc(doc(db, 'envelopes', envelopeId), {
      fields: updatedFields
    });

    // Mettre à jour le document
    const docUpdate: any = {
      updatedAt: new Date().toISOString()
    };

    if (allSigned) {
      docUpdate.status = DocumentStatus.SIGNED;
    }

    await updateDoc(doc(db, 'documents', envelope.document.id), docUpdate);

    // Ajouter à l'audit trail
    const auditDoc = await getDoc(doc(db, 'auditTrails', envelope.document.id));
    const existingEvents = auditDoc.exists() ? auditDoc.data().events : [];

    const newEvents = [
      ...existingEvents,
      {
        timestamp: new Date().toISOString(),
        action: 'Document Signé',
        user: signer.email,
        ip: '127.0.0.1',
        type: 'SIGN'
      }
    ];

    if (allSigned) {
      newEvents.push(
        {
          timestamp: new Date().toISOString(),
          action: "Horodatage Qualifié Appliqué",
          tsa: "Firebase TSA",
          type: 'TIMESTAMP'
        },
        {
          timestamp: new Date().toISOString(),
          action: "Document Terminé",
          finalHash: "hash-placeholder",
          type: 'COMPLETE'
        }
      );
    }

    await setDoc(doc(db, 'auditTrails', envelope.document.id), { events: newEvents });

    // 📧 NOTIFICATION : Si le document est complètement signé, envoyer un email à l'expéditeur
    if (allSigned) {
      console.log('📧 Document complètement signé - Envoi de notification à l\'expéditeur...');
      
      // Créer un token de lecture seule pour l'expéditeur
      const viewToken = `view-${envelope.document.id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Stocker le token avec le premier destinataire (pour affichage en lecture seule)
      await setDoc(doc(db, 'tokens', viewToken), {
        envelopeId: envelopeId,
        recipientId: envelope.recipients[0].id, // Premier destinataire par défaut
        isViewOnly: true // Flag pour indiquer que c'est un token de lecture seule
      });
      
      // Envoyer l'email de confirmation
      const confirmationResult = await sendSignatureConfirmationEmail(
        envelope.document.id,
        envelope.document.name,
        signer.name,
        signer.email,
        envelope.document.creatorEmail,
        viewToken
      );
      
      if (!confirmationResult.success) {
        console.warn('⚠️ Email de confirmation non envoyé, mais la signature est enregistrée');
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur submitSignature:', error);
    return { success: false };
  }
};

export const rejectSignature = async (
  token: string,
  reason: string
): Promise<{ success: boolean }> => {
  try {
    const tokenDoc = await getDoc(doc(db, 'tokens', token));
    if (!tokenDoc.exists()) return { success: false };

    const tokenData = tokenDoc.data();
    const { envelopeId, recipientId } = tokenData;

    const envelopeDoc = await getDoc(doc(db, 'envelopes', envelopeId));
    if (!envelopeDoc.exists()) return { success: false };

    const envelope = envelopeDoc.data() as Envelope;
    const signer = envelope.recipients.find(r => r.id === recipientId);

    if (!signer) return { success: false };

    // Mettre à jour le document
    await updateDoc(doc(db, 'documents', envelope.document.id), {
      status: DocumentStatus.REJECTED,
      rejectionReason: reason,
      updatedAt: new Date().toISOString()
    });

    // Audit trail
    const auditDoc = await getDoc(doc(db, 'auditTrails', envelope.document.id));
    const existingEvents = auditDoc.exists() ? auditDoc.data().events : [];

    await setDoc(doc(db, 'auditTrails', envelope.document.id), {
      events: [
        ...existingEvents,
        {
          timestamp: new Date().toISOString(),
          action: 'Document Rejeté',
          user: signer.email,
          ip: '127.0.0.1',
          reason,
          type: 'REJECT'
        }
      ]
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur rejectSignature:', error);
    return { success: false };
  }
};

export const deleteDocuments = async (documentIds: string[]): Promise<{ success: boolean }> => {
  try {
    // Supprimer les documents, enveloppes, tokens, PDFs, etc.
    for (const docId of documentIds) {
      // Supprimer le document
      await deleteDoc(doc(db, 'documents', docId));

      // Supprimer le PDF depuis Storage
      try {
        const pdfRef = ref(storage, `pdfs/${docId}.pdf`);
        await deleteObject(pdfRef);
      } catch (e) {
        console.warn('PDF déjà supprimé ou inexistant:', docId);
      }

      // Trouver et supprimer l'enveloppe
      const envelopesQuery = query(
        collection(db, 'envelopes'),
        where('document.id', '==', docId)
      );
      const envelopesDocs = await getDocs(envelopesQuery);
      for (const envDoc of envelopesDocs.docs) {
        await deleteDoc(envDoc.ref);
      }

      // Trouver et supprimer les tokens
      const tokensQuery = query(
        collection(db, 'tokens'),
        where('envelopeId', '==', `env${docId.substring(3)}`)
      );
      const tokensDocs = await getDocs(tokensQuery);
      for (const tokenDoc of tokensDocs.docs) {
        await deleteDoc(tokenDoc.ref);
      }

      // Supprimer l'audit trail
      await deleteDoc(doc(db, 'auditTrails', docId));
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur deleteDocuments:', error);
    return { success: false };
  }
};

// Note: Les fonctions getEmails, markEmailAsRead, etc. restent en localStorage
// car ce sont des données locales à chaque utilisateur
export const getEmails = async (): Promise<MockEmail[]> => {
  try {
    const emailsQuery = query(
      collection(db, 'emails'),
      orderBy('sentAt', 'desc')
    );
    const snapshot = await getDocs(emailsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockEmail));
  } catch (error) {
    console.error('❌ Erreur getEmails Firebase:', error);
    return [];
  }
};

export const markEmailAsRead = async (emailId: string): Promise<{ success: boolean }> => {
  try {
    const emailRef = doc(db, 'emails', emailId);
    await updateDoc(emailRef, { read: true });
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur markEmailAsRead Firebase:', error);
    return { success: false };
  }
};

export const getUnreadEmailCount = async (): Promise<number> => {
  try {
    const emailsQuery = query(
      collection(db, 'emails'),
      where('read', '==', false)
    );
    const snapshot = await getDocs(emailsQuery);
    return snapshot.size;
  } catch (error) {
    console.error('❌ Erreur getUnreadEmailCount Firebase:', error);
    return 0;
  }
};

export const deleteEmails = async (emailIds: string[]): Promise<{ success: boolean }> => {
  try {
    console.log('🗑️ Suppression des emails:', emailIds);
    await Promise.all(
      emailIds.map(id => deleteDoc(doc(db, 'emails', id)))
    );
    console.log('✅ Emails supprimés avec succès');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur deleteEmails Firebase:', error);
    return { success: false };
  }
};

export const getAuditTrail = async (documentId: string): Promise<string> => {
  try {
    const auditDoc = await getDoc(doc(db, 'auditTrails', documentId));
    const docDoc = await getDoc(doc(db, 'documents', documentId));

    if (!docDoc.exists()) {
      return JSON.stringify({ error: "Document non trouvé." });
    }

    const docData = docDoc.data();
    const auditData = {
      documentId,
      documentName: docData.name,
      events: auditDoc.exists() ? auditDoc.data().events : []
    };

    return JSON.stringify(auditData, null, 2);
  } catch (error) {
    console.error('Erreur getAuditTrail:', error);
    return JSON.stringify({ error: "Erreur lors de la récupération de l'audit trail." });
  }
};

export const getTokenForDocumentSigner = async (
  documentId: string,
  recipientIndex: number = 0
): Promise<string | null> => {
  try {
    const envelopeId = `env${documentId.substring(3)}`;
    const envelopeDoc = await getDoc(doc(db, 'envelopes', envelopeId));

    if (!envelopeDoc.exists()) return null;

    const envelope = envelopeDoc.data() as Envelope;
    const recipient = envelope.recipients[recipientIndex];

    if (!recipient) return null;

    // Trouver le token
    const tokensQuery = query(
      collection(db, 'tokens'),
      where('envelopeId', '==', envelopeId),
      where('recipientId', '==', recipient.id)
    );

    const tokensDocs = await getDocs(tokensQuery);

    if (tokensDocs.empty) return null;

    return tokensDocs.docs[0].id;
  } catch (error) {
    console.error('Erreur getTokenForDocumentSigner:', error);
    return null;
  }
};

// 🗑️ NETTOYAGE AUTOMATIQUE : Supprimer les documents expirés (> 7 jours)
export const cleanupExpiredDocuments = async (): Promise<{ 
  success: boolean; 
  deletedCount: number;
  deletedDocuments: string[];
}> => {
  try {
    console.log('🧹 Vérification des documents expirés...');
    
    const now = new Date();
    const docsQuery = query(collection(db, 'documents'));
    const snapshot = await getDocs(docsQuery);
    
    const expiredDocIds: string[] = [];
    const expiredDocNames: string[] = [];
    
    snapshot.docs.forEach(docSnapshot => {
      const docData = docSnapshot.data() as Document;
      const expiresAt = new Date(docData.expiresAt);
      
      // Si la date d'expiration est dépassée
      if (expiresAt < now) {
        expiredDocIds.push(docData.id);
        expiredDocNames.push(docData.name);
      }
    });
    
    if (expiredDocIds.length === 0) {
      console.log('✅ Aucun document expiré à supprimer');
      return { success: true, deletedCount: 0, deletedDocuments: [] };
    }
    
    console.log(`🗑️ ${expiredDocIds.length} document(s) expiré(s) trouvé(s) :`, expiredDocNames);
    
    // Supprimer les documents expirés en utilisant deleteDocuments existante
    await deleteDocuments(expiredDocIds);
    
    console.log(`✅ ${expiredDocIds.length} document(s) expiré(s) supprimé(s) avec succès`);
    
    return { 
      success: true, 
      deletedCount: expiredDocIds.length,
      deletedDocuments: expiredDocNames
    };
  } catch (error) {
    console.error('❌ Erreur cleanupExpiredDocuments:', error);
    return { success: false, deletedCount: 0, deletedDocuments: [] };
  }
};

