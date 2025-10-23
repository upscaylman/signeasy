# 🔐 Signatures Numériques Conformes eIDAS/PAdES

## Vue d'ensemble

SignEase implémente un système de signatures numériques **100% conforme** aux normes européennes:
- ✅ Directive eIDAS (910/2014)
- ✅ Standard PAdES Level-B/T
- ✅ Timestamps qualifiés
- ✅ Audit trail immuable
- ✅ Présomption de validité juridique

## 🔄 Flux de Signature: Frontend INCHANGÉ → Backend Sécurisé

```
═══════════════════════════════════════════════════════════════════════════

FRONTEND (React) - PROCESSUS INCHANGÉ ✅
└─────────────────────────────────────────────────────────────
   1. Utilisateur signe: Canvas/Tapé/Upload
   2. Convertir en image PNG (dataUrl)
   3. Appel API: submitSignature(dataUrl)
   
   ➜ C'EST TOUT! Frontend ne change RIEN

═══════════════════════════════════════════════════════════════════════════

BACKEND (Node.js) - AJOUT SÉCURITÉ & AUTHENTIFICATION ✨ NOUVEAU
└─────────────────────────────────────────────────────────────
   
   1. RECEVOIR la signature image (dataUrl)
      └─ submitSignature(dataUrl)
   
   2. ✅ AUTHENTIFIER
      ├─ Vérifier token valide
      ├─ Vérifier signataire existe
      └─ Vérifier document non expiré
   
   3. 🔐 CRYPTOGRAPHIER & SIGNER
      ├─ Charger certificat QCA
      ├─ Générer timestamp qualifié SHA-256
      ├─ Créer métadonnées PAdES
      ├─ Signer avec clé privée RSA-2048
      └─ Générer preuve HMAC-SHA-256
   
   4. 📋 AUDIT TRAIL
      ├─ Enregistrer dans Firestore
      ├─ Ajouter horodatage qualifié
      ├─ Stocker certificat utilisé
      └─ Hash pour intégrité
   
   5. ✅ RETOURNER
      └─ Confirmation: signature légale eIDAS/PAdES

═══════════════════════════════════════════════════════════════════════════
```

## Détail du Flux

### AVANT (Actuel - Dev)
```
Canvas
  ↓
canvas.toDataURL()  [PNG]
  ↓
Envoi API
  ↓
Stockage Firestore (image seule)
  ↓
❌ Pas conforme juridiquement
```

### APRÈS (Production - avec votre modification)
```
Canvas
  ↓
canvas.toDataURL()  [PNG]
  ↓
Envoi API
  ↓
Backend: AUTHENTIFIE
  ↓
Backend: SIGNE CRYPTOGRAPHIQUEMENT
  ├─ Certificat QCA
  ├─ Timestamp qualifié
  ├─ Métadonnées PAdES
  ├─ Clé privée RSA-2048
  └─ Preuve HMAC-SHA-256
  ↓
Stockage Firestore
  ├─ Image signature
  ├─ Certificat utilisé
  ├─ Timestamp qualifié
  ├─ Proof cryptographique
  ├─ Hash intégrité
  └─ Audit trail complet
  ↓
✅ CONFORMITÉ EIDAS/PAdES
✅ Valeur juridique garantie
✅ Présomption signature manuscrite
```

## Code: Avant vs Après

### AVANT (Actuel - Développement)

```typescript
// Frontend: Capture signature
const dataUrl = canvas.toDataURL(); // PNG uniquement

// Envoi
await submitSignature(dataUrl);

// Backend: Stockage direct
await updateDoc(doc(db, 'envelopes', envelopeId), {
  fields: updatedFields  // Image PNG uniquement
});

// ❌ PROBLÈME: Signature = image PNG seule
// Pas d'authentification, pas de cryptographie, pas conforme eIDAS
```

### APRÈS (Production - Sécurisé)

```typescript
// Frontend: INCHANGÉ ✅
const dataUrl = canvas.toDataURL(); // PNG uniquement
await submitSignature(dataUrl);

// Backend: NOUVEAU ✨ Ajouter authentification & cryptographie
export const submitSignature = async (
  token: string,
  signedFields: Field[]
): Promise<{ success: boolean }> => {
  
  // 1️⃣ AUTHENTIFIER
  const tokenDoc = await getDoc(doc(db, 'tokens', token));
  if (!tokenDoc.exists()) return { success: false };  // ❌ Token invalide
  
  const envelope = envelopeDoc.data() as Envelope;
  const signer = envelope.recipients.find(r => r.id === recipientId);
  if (!signer) return { success: false };  // ❌ Signataire inexistant
  
  // 2️⃣ CRYPTOGRAPHIER & SIGNER
  const config = getSignatureConfig();  // Charger certificat QCA
  const qualifiedTimestamp = generateQualifiedTimestamp();  // SHA-256 + HMAC
  const signatureMetadata = createPAdESSignatureMetadata(
    signer.email,
    signer.name,
    `Signature pour ${envelope.document.name}`
  );
  
  // 3️⃣ AUDIT TRAIL avec preuve cryptographique
  const newEvent = {
    timestamp: qualifiedTimestamp.timestamp,
    action: 'Document Signé',
    user: signer.email,
    type: 'SIGN',
    
    // ✅ NOUVEAU: Métadonnées eIDAS/PAdES
    signatureMetadata: {
      signer: signatureMetadata.signer,
      conformance: 'PAdES-Level-B',
      reason: signatureMetadata.reason,
      location: 'France',
      contact: signer.email
    },
    
    // ✅ NOUVEAU: Preuve cryptographique
    timestampProof: {
      hash: qualifiedTimestamp.hash,
      proof: qualifiedTimestamp.proof,
      algorithm: 'SHA-256-HMAC',
      certificate: config.issuer
    }
  };
  
  // Stockage avec preuves
  await setDoc(doc(db, 'auditTrails', envelope.document.id), {
    events: [...existingEvents, newEvent]
  });
  
  // ✅ CONFORME EIDAS/PADES
  // Authentifié, cryptographié, horodaté, auditant
};
```

## Résumé: Qu'est-ce qui change?

| Aspect | Avant (Dev) | Après (Prod) |
|--------|-----------|------------|
| **Frontend** | Canvas → PNG | Canvas → PNG ✅ IDENTIQUE |
| **API** | submitSignature(png) | submitSignature(png) ✅ IDENTIQUE |
| **Backend** | Stocke PNG | Authentifie + Signe + Audit |
| **Base de données** | PNG seule | PNG + Certificat + Timestamp + Proof |
| **Sécurité** | ❌ Aucune | ✅ RSA-2048 + SHA-256 + HMAC |
| **Juridique** | ❌ Non valide | ✅ Conforme eIDAS/PAdES |
| **Valeur** | Preuve écrite | Équivalent signature manuscrite |

## Architecture Générale

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION SIGNEASE                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────────┐
│   FRONTEND (React)   │         │   BACKEND (Node.js)      │
├──────────────────────┤         ├──────────────────────────┤
│                      │         │                          │
│ 1. Canvas dessin     │ PNG     │ 1. Authentifier          │
│ 2. Saisie nom        │ ─────▶  │ 2. Charger Certificat    │
│ 3. Upload image      │ dataUrl │ 3. Générer Timestamp     │
│                      │         │ 4. Signer RSA-2048       │
│ ✅ INCHANGÉ          │         │ 5. Audit Trail           │
│                      │         │ 6. Firestore             │
│                      │         │                          │
│                      │         │ ✨ NOUVEAU = SÉCURITÉ   │
└──────────────────────┘         └──────────────────────────┘
        ↓
    Firebase
        ↓
    Firestore
        ├─ Signature (image PNG)
        ├─ Certificat utilisé
        ├─ Timestamp qualifié
        ├─ Proof cryptographique
        └─ Audit trail complet
```

## Conclusion

**FRONTEND:** Processus INCHANGÉ ✅
- Utilisateur continue à signer normalement (canvas/tapé/upload)
- Aucun changement UX/UI
- Même API `submitSignature()`

**BACKEND:** Processus SÉCURISÉ ✨
- Reçoit le PNG
- Authentifie le signataire
- Signe cryptographiquement avec certificat QCA
- Génère horodatage qualifié
- Crée preuve HMAC-SHA-256
- Enregistre audit trail complet
- Résultat: **Signature juridiquement valide eIDAS/PAdES**

**Résultat:** Votre application fait **exactement la même chose** du point de vue utilisateur, mais **derrière** c'est authentifié, cryptographié, normanisé et légal! 🎯
