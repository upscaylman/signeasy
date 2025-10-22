# SignEase - Plateforme de Signature Électronique

## 🚀 Démarrage Rapide

### Installation

```bash
npm install
```

### Développement

```bash
npm run dev
```

Application accessible sur : **http://localhost:3000**

### Production

```bash
npm run build
npm run preview
```

---

## 📚 Documentation

Toute la documentation se trouve dans le dossier **`docs/`** :

### **🔥 Configuration**
- **`docs/FIREBASE.md`** - Configuration complète Firebase (Firestore + Storage)
- **`docs/CONFIGURATION-CORS.md`** - Configuration CORS pour Firebase Storage ⚠️ **OBLIGATOIRE**

### **🚀 Production**
- **`docs/ETAPES-PRODUCTION.md`** - ⭐ **GUIDE COMPLET** - Liste des étapes pour passer en production
- **`docs/DEPLOIEMENT.md`** - Guide détaillé de déploiement sur Netlify

### **📖 Ordre de Lecture Recommandé**
1. `docs/ETAPES-PRODUCTION.md` - Vue d'ensemble
2. `docs/CONFIGURATION-CORS.md` - Configuration CORS (obligatoire)
3. `docs/DEPLOIEMENT.md` - Déploiement sur Netlify

---

## ⚙️ Configuration

Créez un fichier `.env.local` à la racine avec :

```env
# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# EmailJS
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```

---

## 🛠️ Technologies

- React + TypeScript
- Firebase (Firestore + Storage)
- Vite
- Tailwind CSS
- PDF.js + pdf-lib
- EmailJS

---

**📖 Pour plus d'informations, consultez le dossier `docs/`**

