# Configuration Firebase

## ⚙️ Variables d'Environnement

Créez un fichier `.env.local` à la racine avec :

```env
VITE_FIREBASE_API_KEY=AIzaSyB6l7PjzQUTz4ERwoyca5C_mPj_jOKWG70
VITE_FIREBASE_AUTH_DOMAIN=signeasyfo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=signeasyfo
VITE_FIREBASE_STORAGE_BUCKET=signeasyfo.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=884877138273
VITE_FIREBASE_APP_ID=1:884877138273:web:1dd64d62b197163b50cd20

VITE_EMAILJS_SERVICE_ID=service_tcdw2fd
VITE_EMAILJS_TEMPLATE_ID=template_6m6pxue
VITE_EMAILJS_PUBLIC_KEY=g2n34kxUJPlU6tsI0
```

## 🔒 Règles Firebase

### Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: true;
      allow write: if request.auth != null;
    }
  }
}
```

### Storage

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: true;
      allow write: if request.auth != null;
    }
  }
}
```

## 🚀 Déploiement

1. Build : `npm run build`
2. Ajouter les variables sur Netlify
3. Déployer le dossier `dist`

