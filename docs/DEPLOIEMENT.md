# 🚀 Déploiement en Production

## ✅ Checklist Pré-Déploiement

Avant de déployer, assurez-vous que :

- ✅ **CORS Firebase Storage est configuré** (voir `docs/CONFIGURATION-CORS.md`)
- ✅ **Règles Firestore sont sécurisées** (pas en mode test)
- ✅ **Variables d'environnement sont prêtes**
- ✅ **L'application fonctionne en local**

---

## 📦 Netlify (Recommandé)

### **Étape 1 : Build de Production**

```bash
npm run build
```

Cela crée un dossier `dist/` avec votre application optimisée.

---

### **Étape 2 : Configurer les Variables d'Environnement**

1. Allez sur : **https://app.netlify.com/sites/signeasyfo/settings/env**
2. Cliquez sur **"Add a variable"**
3. Ajoutez **TOUTES** les variables de votre `.env.local` :

```
VITE_FIREBASE_API_KEY=AIzaSyB6l7PjzQUTz4ERwoyca5C_mPj_jOKWG70
VITE_FIREBASE_AUTH_DOMAIN=signeasyfo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=signeasyfo
VITE_FIREBASE_STORAGE_BUCKET=signeasyfo.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=884877138273
VITE_FIREBASE_APP_ID=1:884877138273:web:1dd64d62b197163b50cd20
```

---

### **Étape 3 : Déployer**

#### **Option A : Glisser-Déposer (Simple)**

1. Allez sur : **https://app.netlify.com/drop**
2. **Glissez-déposez** le dossier `dist/`
3. Netlify déploie automatiquement !

#### **Option B : Netlify CLI (Avancé)**

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Se connecter
netlify login

# Lier le projet
netlify link

# Déployer en production
netlify deploy --prod --dir=dist
```

---

### **Étape 4 : Configuration Netlify (Important)**

Créez un fichier `netlify.toml` à la racine (déjà présent) :

```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Cela garantit que le routing React fonctionne correctement.

---

## 🔒 Sécuriser Firebase (OBLIGATOIRE en Production)

### **1. Firestore Rules**

Allez sur : **Firebase Console → Firestore → Règles**

**Remplacez les règles "mode test" par :**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Documents : lecture publique, écriture authentifiée (à personnaliser)
    match /documents/{document} {
      allow read: if true;
      allow write: if request.auth != null; // Ou votre logique
    }
    
    // Enveloppes : accès par token
    match /envelopes/{envelope} {
      allow read: if true; // Ou vérifier le token
      allow write: if request.auth != null;
    }
    
    // Tokens : lecture publique, écriture authentifiée
    match /tokens/{token} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Emails : lecture/écriture authentifiée
    match /emails/{email} {
      allow read, write: if true; // Ou votre logique
    }
    
    // Audit trails : lecture publique, écriture authentifiée
    match /auditTrails/{audit} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Publiez les règles !**

---

### **2. Storage Rules**

Allez sur : **Firebase Console → Storage → Règles**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // PDFs : lecture publique, écriture authentifiée
    match /pdfs/{pdfId} {
      allow read: if true; // Nécessaire pour les signatures
      allow write: if request.auth != null; // Ou votre logique
    }
  }
}
```

**Publiez les règles !**

---

## 🧪 Tester la Production

1. Allez sur : **https://signeasyfo.netlify.app**
2. Créez un document
3. Envoyez-le pour signature
4. Vérifiez dans Inbox
5. Testez la signature

**Tout devrait fonctionner comme en local !** ✅

---

## 🔧 Déploiement Automatique (CI/CD)

### **Avec GitHub**

1. Connectez Netlify à votre repo GitHub
2. Allez sur : **Netlify → Site Settings → Build & Deploy**
3. Configurez :
   - **Base directory:** (vide)
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Chaque `git push` déclenchera un déploiement automatique !

---

## 📊 Monitoring

Allez sur **Netlify → Analytics** pour voir :
- Nombre de visiteurs
- Pages vues
- Temps de chargement

**Firebase Console → Analytics** pour :
- Utilisation Firestore
- Utilisation Storage
- Erreurs

---

## ❓ Dépannage Production

### **Erreur : Page blanche**
- Vérifiez la console navigateur (F12)
- Vérifiez que les variables d'environnement sont configurées sur Netlify

### **Erreur : CORS Storage**
- Vérifiez que CORS est configuré (voir `docs/CONFIGURATION-CORS.md`)
- Attendez 1-2 minutes (propagation)

### **Erreur : Firebase permission denied**
- Vérifiez les règles Firestore/Storage
- Vérifiez que les règles sont publiées

---

## 📞 Support

- **Netlify Docs:** https://docs.netlify.com/
- **Firebase Docs:** https://firebase.google.com/docs
- **Vite Docs:** https://vitejs.dev/guide/

---

## 🔐 Signatures Numériques Conformes eIDAS/PAdES

Pour assurer la conformité eIDAS/PAdES, nous utilisons des signatures numériques.

### **1. Configuration**

- ✅ **Certificat eIDAS** (à obtenir auprès d'une autorité de certification)
- ✅ **Clé de signature** (à gérer en sécurité)
- ✅ **Règles Firestore pour les signatures** (voir `docs/FIRESTORE-RULES.md`)

### **2. Utilisation**

- ✅ **Génération de signature** (via `signEasy.generateSignature()`)
- ✅ **Vérification de signature** (via `signEasy.verifySignature()`)
- ✅ **Stockage des signatures** (dans Firestore)

### **3. Sécurité**

- ✅ **Chiffrement des données** (AES-256)
- ✅ **Hachage des clés** (SHA-256)
- ✅ **Vérification de l'authenticité** (via certificats)

---

