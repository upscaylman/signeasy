# 🔐 Déploiement Backend - Signature Cryptographique

Guide complet pour déployer la signature cryptographique côté serveur avec Firebase Functions

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Architecture](#architecture)
4. [Installation Firebase Functions](#installation-firebase-functions)
5. [Configuration](#configuration)
6. [Déploiement](#déploiement)
7. [Certificats Production](#certificats-production)
8. [Tests](#tests)
9. [Sécurité](#sécurité)

---

## 🎯 Vue d'ensemble

### Flux Complet

```
┌─────────────┐     1. Upload      ┌──────────────┐
│   Frontend  │ ──────────────────>│   Firebase   │
│   (React)   │                    │   Storage    │
└─────────────┘                    └──────────────┘
       │                                   │
       │ 2. Trigger                        │
       ▼                                   ▼
┌─────────────┐     3. Sign        ┌──────────────┐
│   Firebase  │<───────────────────│  Certificat  │
│  Functions  │                    │     P12      │
└─────────────┘                    └──────────────┘
       │
       │ 4. Save
       ▼
┌─────────────┐
│  Firestore  │
│ + Storage   │
└─────────────┘
```

### Pourquoi Backend ?

❌ **Frontend (Navigateur)** :
- Pas d'accès au système de fichiers
- Pas d'accès aux certificats P12
- Sécurité compromise (clé privée exposée)

✅ **Backend (Firebase Functions)** :
- Accès sécurisé aux certificats
- Clé privée protégée
- Conformité eIDAS garantie

---

## ✅ Prérequis

### Environnement

```bash
# Node.js
node --version  # >= 18.x

# Firebase CLI
npm install -g firebase-tools
firebase --version  # >= 13.x

# Connexion Firebase
firebase login
```

### Projet Firebase

- Plan **Blaze** (Pay as you go) obligatoire pour Functions
- Quota gratuit : 2 millions d'invocations/mois
- Quota gratuit : 400 000 Go-secondes/mois

---

## 🏗️ Architecture

### Structure du Projet

```
signease/
├── functions/                    # 🆕 Firebase Functions
│   ├── src/
│   │   ├── index.ts             # Point d'entrée
│   │   ├── signPdf.ts           # Fonction signature
│   │   └── utils/
│   │       ├── certificate.ts   # Gestion certificats
│   │       └── validation.ts    # Validation PDF
│   ├── certs/                   # 🔐 Certificats (git ignore)
│   │   └── production.p12
│   ├── package.json
│   └── tsconfig.json
├── src/                         # Frontend React
├── certs/                       # Certificats développement
└── scripts/                     # Scripts utilitaires
```

---

## 🚀 Installation Firebase Functions

### 1. Initialiser Firebase Functions

```bash
# À la racine du projet
firebase init functions

# Sélectionner:
# - Language: TypeScript
# - ESLint: Oui
# - Install dependencies: Oui
```

### 2. Installer Dépendances

```bash
cd functions

npm install --save \
  @signpdf/signpdf@^3.2.0 \
  @signpdf/signer-p12@^3.2.0 \
  @signpdf/placeholder-plain@^3.2.0 \
  node-forge@^1.3.1 \
  pdf-lib@^1.17.1

npm install --save-dev \
  @types/node-forge@^1.3.11
```

### 3. Créer la Fonction de Signature

**`functions/src/signPdf.ts`** :

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { signpdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import * as fs from 'fs';
import * as path from 'path';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

export const signDocument = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    try {
      // 🔒 Vérifier l'authentification
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'L\'utilisateur doit être authentifié'
        );
      }

      const { documentId, signatureMetadata } = data;

      // 1️⃣ Récupérer le PDF depuis Storage
      const bucket = admin.storage().bucket();
      const pdfPath = `pdfs/${documentId}.pdf`;
      const [pdfBuffer] = await bucket.file(pdfPath).download();

      // 2️⃣ Charger le certificat P12
      const p12Path = path.join(__dirname, '../certs/production.p12');
      const p12Buffer = fs.readFileSync(p12Path);
      const p12Password = process.env.P12_PASSWORD || '';

      if (!p12Password) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Mot de passe P12 non configuré'
        );
      }

      // 3️⃣ Créer le signer
      const signer = new P12Signer(p12Buffer, {
        passphrase: p12Password,
      });

      // 4️⃣ Ajouter placeholder
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: signatureMetadata.reason || 'Signature électronique',
        contactInfo: signatureMetadata.contact || context.auth.token.email,
        name: signatureMetadata.signer || context.auth.token.name,
        location: signatureMetadata.location || 'France',
      });

      // 5️⃣ Signer le PDF
      const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer);

      // 6️⃣ Sauvegarder le PDF signé
      const signedPath = `pdfs/${documentId}-signed.pdf`;
      await bucket.file(signedPath).save(signedPdf, {
        contentType: 'application/pdf',
        metadata: {
          metadata: {
            signed: 'true',
            signedAt: new Date().toISOString(),
            signer: signatureMetadata.signer,
          },
        },
      });

      // 7️⃣ Mettre à jour Firestore
      await admin.firestore().collection('documents').doc(documentId).update({
        status: 'Signé',
        signedAt: admin.firestore.FieldValue.serverTimestamp(),
        signedPath,
        cryptographicSignature: true,
      });

      // 8️⃣ Ajouter audit trail
      await admin.firestore().collection('auditTrails').doc(documentId).update({
        events: admin.firestore.FieldValue.arrayUnion({
          type: 'CRYPTOGRAPHIC_SIGN',
          timestamp: new Date().toISOString(),
          user: context.auth.token.email,
          signatureMetadata,
          conformance: 'PAdES-B',
        }),
      });

      return {
        success: true,
        documentId,
        signedPath,
        message: 'Document signé cryptographiquement avec succès',
      };

    } catch (error) {
      console.error('Erreur signature:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Échec de la signature: ${error.message}`
      );
    }
  });
```

### 4. Point d'entrée

**`functions/src/index.ts`** :

```typescript
export { signDocument } from './signPdf';
```

---

## ⚙️ Configuration

### 1. Variables d'Environnement

```bash
# Configurer le mot de passe P12
firebase functions:config:set \
  p12.password="votre-mot-de-passe-production"

# Vérifier
firebase functions:config:get
```

### 2. Copier Certificat Production

```bash
# Copier le certificat dans functions/certs/
cp /path/to/production.p12 functions/certs/

# ⚠️ IMPORTANT: Ajouter à .gitignore
echo "functions/certs/*.p12" >> .gitignore
```

### 3. Configuration Firebase

**`firebase.json`** :

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs18",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

---

## 🚢 Déploiement

### Développement

```bash
# Démarrer émulateurs locaux
firebase emulators:start

# Tester la fonction
# URL: http://localhost:5001/{project-id}/europe-west1/signDocument
```

### Production

```bash
# Déployer uniquement les functions
firebase deploy --only functions

# Déployer fonction spécifique
firebase deploy --only functions:signDocument

# Vérifier les logs
firebase functions:log
```

### Frontend - Appel de la Fonction

**`services/firebaseApi.ts`** :

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

export const signDocumentCryptographically = async (
  documentId: string,
  signatureMetadata: any
): Promise<void> => {
  try {
    const functions = getFunctions();
    const signDocument = httpsCallable(functions, 'signDocument');
    
    const result = await signDocument({
      documentId,
      signatureMetadata,
    });
    
    console.log('✅ Document signé:', result.data);
    
  } catch (error) {
    console.error('❌ Erreur signature:', error);
    throw error;
  }
};
```

---

## 🎖️ Certificats Production

### Fournisseurs Qualifiés (QCA)

#### 1. **Certinomis** (France)
- Site: https://www.certinomis.fr/
- Prix: ~100-300€/an
- Type: Certificat de signature électronique qualifiée
- Délai: 2-5 jours ouvrés
- Support: Excellent (français)

#### 2. **ChamberSign** (France)
- Site: https://www.chambersign.fr/
- Prix: ~150-400€/an
- Type: Certificat qualifié RGS **
- Délai: 3-7 jours ouvrés
- Avantage: Validation juridique forte

#### 3. **GlobalSign** (International)
- Site: https://www.globalsign.com/
- Prix: ~200-500€/an
- Type: Certificat AATL (Adobe Approved Trust List)
- Délai: 1-3 jours ouvrés
- Avantage: Reconnaissance mondiale

### Procédure d'Obtention

1. **Choix du fournisseur** selon besoins
2. **Validation identité** :
   - Pièce d'identité
   - Justificatif de domicile
   - KBIS (entreprise)
   - Signature manuscrite
3. **Génération CSR** (Certificate Signing Request)
4. **Émission certificat** par le QCA
5. **Installation** dans Firebase Functions

### Génération CSR

```bash
# Générer clé privée + CSR
openssl req -new -newkey rsa:4096 -nodes \
  -keyout private.key \
  -out certificate.csr \
  -subj "/C=FR/ST=Ile-de-France/L=Paris/O=FO Metaux/OU=IT/CN=SignEase/emailAddress=contact@fometaux.fr"

# Envoyer certificate.csr au fournisseur
# Conserver private.key en sécurité (jamais commit!)
```

---

## 🧪 Tests

### Test Local avec Émulateurs

```bash
# Terminal 1: Démarrer émulateurs
firebase emulators:start

# Terminal 2: Test fonction
curl -X POST http://localhost:5001/{project-id}/europe-west1/signDocument \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "documentId": "test-doc-123",
      "signatureMetadata": {
        "signer": "Jean Dupont",
        "reason": "Test signature",
        "location": "Paris"
      }
    }
  }'
```

### Test Production

```javascript
// Dans la console navigateur ou script Node
const functions = require('firebase/functions');
const signDocument = functions.httpsCallable(functions.getFunctions(), 'signDocument');

signDocument({
  documentId: 'real-doc-456',
  signatureMetadata: {
    signer: 'Marie Martin',
    reason: 'Signature contrat',
    location: 'Lyon'
  }
}).then(result => console.log(result.data));
```

---

## 🔒 Sécurité

### Bonnes Pratiques

✅ **À FAIRE** :
- Stocker P12 dans `functions/certs/` (gitignore)
- Utiliser Firebase Functions Config pour mots de passe
- Valider authentification utilisateur
- Logger toutes les signatures (audit trail)
- Limiter région Functions (europe-west1)
- Monitorer quotas et logs

❌ **NE JAMAIS** :
- Commit certificat P12 ou clé privée
- Hardcoder mot de passe dans le code
- Exposer endpoint public (utiliser `onCall`)
- Utiliser certificat développement en production
- Partager fichier `.env` avec secrets

### Règles de Sécurité

**`storage.rules`** :

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pdfs/{documentId} {
      // Lecture: utilisateur authentifié et autorisé
      allow read: if request.auth != null 
        && (request.auth.uid == resource.metadata.creatorId
            || request.auth.token.email in resource.metadata.authorizedEmails);
      
      // Écriture: uniquement Functions
      allow write: if false;
    }
    
    match /pdfs/{documentId}-signed.pdf {
      // Lecture: même règle
      allow read: if request.auth != null;
      
      // Écriture: Functions uniquement
      allow write: if false;
    }
  }
}
```

### Monitoring

```bash
# Logs en temps réel
firebase functions:log --only signDocument

# Alertes sur erreurs
# Firebase Console > Functions > Metrics > Alerts
```

---

## 📊 Coûts Estimés

### Firebase Functions (Plan Blaze)

| Ressource | Quota Gratuit | Coût Après Quota |
|-----------|---------------|------------------|
| Invocations | 2M/mois | 0,40$/M |
| Go-secondes | 400K/mois | 0,0000025$/Go-s |
| Réseau sortant | 5 GB/mois | 0,12$/GB |

**Exemple** :
- 1000 signatures/mois
- 2 secondes/signature
- 512 MB RAM
- **Coût estimé : GRATUIT** (dans quota)

### Certificat QCA

- Développement : **GRATUIT** (auto-signé)
- Production : **~200€/an** (Certinomis)
- Haute sécurité : **~500€/an** (GlobalSign AATL)

---

## 🎯 Checklist Déploiement

- [ ] Node.js 18+ installé
- [ ] Firebase CLI installé et connecté
- [ ] Projet Firebase plan Blaze activé
- [ ] Functions initialisées (`firebase init functions`)
- [ ] Dépendances installées (`@signpdf/*`)
- [ ] Certificat P12 copié dans `functions/certs/`
- [ ] Mot de passe P12 configuré (`functions:config:set`)
- [ ] `.gitignore` mis à jour (certificats)
- [ ] Fonction testée localement (émulateurs)
- [ ] Déployé en production (`firebase deploy`)
- [ ] Règles de sécurité configurées
- [ ] Monitoring et alertes activés
- [ ] Frontend mis à jour (appel fonction)
- [ ] Tests end-to-end réussis

---

## 📚 Ressources

### Documentation

- Firebase Functions: https://firebase.google.com/docs/functions
- @signpdf: https://github.com/vbuch/node-signpdf
- PAdES: https://en.wikipedia.org/wiki/PAdES
- eIDAS: https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/eIDAS

### Support

- Firebase Support: https://firebase.google.com/support
- Stack Overflow: `firebase-functions` + `pdf-signature`
- Discord SignEase: (à créer)

### Prochaines Étapes

1. Implémenter Firebase Functions
2. Obtenir certificat QCA production
3. Déployer et tester
4. Former l'équipe
5. Documentation utilisateur

---

**Dernière mise à jour** : 24 Octobre 2025  
**Auteur** : SignEase Team - FO Metaux  
**Version** : 1.0.0

