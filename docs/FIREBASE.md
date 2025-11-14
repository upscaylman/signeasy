# Configuration Firebase

## ⚙️ Variables d'Environnement

Créez un fichier `.env.local` à la racine avec :

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...le cas

VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
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
