# 📘 Wiki SignEase - Documentation Complète du Repository

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture Technique](#architecture-technique)
3. [Structure du Projet](#structure-du-projet)
4. [Fonctionnalités Principales](#fonctionnalités-principales)
5. [Configuration et Installation](#configuration-et-installation)
6. [Flux de Données](#flux-de-données)
7. [Sécurité](#sécurité)
8. [Technologies Utilisées](#technologies-utilisées)
9. [Développement](#développement)
10. [Production et Déploiement](#production-et-déploiement)
11. [Documentation Supplémentaire](#documentation-supplémentaire)

---

## 🎯 Vue d'ensemble

**SignEase** est une plateforme de signature électronique gratuite et conforme aux normes européennes **eIDAS/PAdES**, développée spécifiquement pour **FO Métaux**.

### Caractéristiques Principales

- ✅ Signature électronique conforme **eIDAS niveau avancé**
- ✅ Horodatage qualifié via serveur de certification
- ✅ Audit trail complet pour traçabilité juridique
- ✅ Multi-destinataires avec ordre de signature
- ✅ Interface intuitive et moderne (Material Design 3)
- ✅ Gestion complète des documents (upload, préparation, envoi, signature)
- ✅ Système de notifications par email
- ✅ Mode lecture/écriture avec grille magnétique
- ✅ Conformité juridique totale avec présomption de validité équivalente à signature manuscrite

### Public Cible

- **Utilisateurs internes FO Métaux** (whitelist prédéfinie)
- **Destinataires externes** (répondant à des documents pour signature)
- **Administrateurs** (gestion des utilisateurs autorisés)

---

## 🏗️ Architecture Technique

### Stack Technologique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework Frontend | React | 19.2.0 |
| Langage | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.1.11 |
| Routing | React Router DOM | 7.9.4 |
| Styling | Tailwind CSS | 4.1.14 |
| Backend | Firebase (Firestore + Storage) | 12.4.0 |
| Email | EmailJS | 3.2.0 |
| PDF | pdfjs-dist | 4.4.168 |
| PDF Manipulation | pdf-lib | 1.17.1 |
| Icons | lucide-react | 0.545.0 |
| Signature | react-signature-canvas | 1.0.6 |
| Cryptographic | jose, node-forge | latest |

### Architecture Application

```
┌─────────────────────────────────────────────────┐
│                  COMPOSANTS                     │
│  Header, Footer, UserContext, Toast, Modals     │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│                   PAGES                         │
│  DashboardPage, PrepareDocumentPage,           │
│  SignDocumentPage, InboxPage, VerifyPage        │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│                SERVICES                         │
│           firebaseApi.ts                       │
│  (CRUD Firestore, Storage, Security Checks)    │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│               BACKEND                           │
│  Firebase Firestore (metadata)                  │
│  Firebase Storage (PDFs)                        │
│  EmailJS (notifications)                        │
└─────────────────────────────────────────────────┘
```

### Flux Principal

1. **Upload du document** → Conversion Word→PDF → Stockage Firebase Storage
2. **Préparation de l'enveloppe** → Ajout destinataires + champs → Firestore metadata
3. **Envoi** → EmailJS génère token unique → Envoi email au destinataire
4. **Signature** → Destinataire accède via token → Signature interactive → PAdES attaché
5. **Audit** → Trail complet pour conformité juridique

---

## 📁 Structure du Projet

```
signease-fo-metaux/
│
├── 📄 App.tsx                    # Point d'entrée + routing
├── 📄 index.tsx                  # Entry point React
├── 📄 index.html                 # Template HTML
├── 📄 index.css                   # Styles globaux Tailwind
├── 📄 types.ts                    # Types TypeScript (Document, Envelope, Field...)
│
├── 📂 components/                # Composants réutilisables
│   ├── Header.tsx                # Navigation + badges notifications
│   ├── Footer.tsx                # Footer avec liens
│   ├── UserContext.tsx           # Contexte authentication
│   ├── Button.tsx                # Bouton avec variants Material Design
│   ├── DocumentCard.tsx         # Carte document avec status badges
│   ├── EmailLoginModal.tsx       # Modal login email
│   ├── NotificationDropdown.tsx # Dropdown notifications non lues
│   ├── SignaturePad.tsx          # Modal signature (dessiner/taper/importer)
│   ├── Toast.tsx                 # Système de notifications toast
│   ├── Tooltip.tsx               # Tooltip personnalisé
│   ├── CookieBanner.tsx          # Bandeau cookies RGPD
│   ├── AdminPanel.tsx            # Panneau admin gestion whitelist
│   └── MobileMenu.tsx            # Menu mobile responsive
│
├── 📂 pages/                     # Pages principales
│   ├── DashboardPage.tsx         # Dashboard documents (signés/envoyés)
│   ├── PrepareDocumentPage.tsx   # Upload PDF + création enveloppe
│   ├── SignDocumentPage.tsx      # Page signature interactive
│   ├── InboxPage.tsx             # Boîte réception emails reçus
│   └── VerifyPage.tsx            # Vérification audit trail
│
├── 📂 services/                   # Services métier
│   ├── firebaseApi.ts            # API Firebase (CRUD Firestore/Storage)
│   └── mockApi.ts                # API mock (développement)
│
├── 📂 config/                     # Configuration
│   └── firebase.ts               # Config Firebase + initialisation
│
├── 📂 utils/                      # Utilitaires
│   ├── firebaseCheck.ts          # Vérification auto config Firebase
│   └── wordToPdf.ts              # Conversion Word → PDF via mammoth
│
├── 📂 public/                     # Assets statiques
│   └── logo-fo-metaux.svg        # Logo FO Métaux
│
├── 📂 scripts/                    # Scripts utilitaires
│   ├── generate-certificate.cjs   # Génération certificats PAdES
│   └── test-crypto-signature.cjs # Tests signatures crypto
│
├── 📂 certs/                      # Certificats (dev local)
│
├── 📂 dist/                       # Build production
│
├── 📂 docs/                       # Documentation
│   ├── WIKI.md                   # ← Ce fichier
│   ├── FIREBASE.md               # Config Firebase détaillée
│   ├── CONFIGURATION-CORS.md     # Config CORS Storage
│   ├── CONFIGURATION-PRODUCTION.md # Config prod
│   ├── DEPLOIEMENT.md            # Déploiement Netlify
│   ├── ETAPES-PRODUCTION.md      # Guide production
│   ├── BUGS ET AMÉLIORATIONS.md  # Bugs connus + TODO
│   ├── SIGNATURES-EIDAS.md      # Spécifications eIDAS
│   ├── LIBRAIRIES-SIGNATURE.md  # Librairies signatures
│   ├── AUDIT-SECURITE-SIGNATURES.md # Audit sécurité
│   ├── DEPLOIEMENT-BACKEND-SIGNATURE.md # Backend signatures
│   ├── IMPLEMENTATION-COMPLETE.md # Implémentation complète
│   └── INTEGRATION-VERIFY-EMAILJS.md # Intégration EmailJS
│
├── package.json                   # Dépendances NPM
├── tsconfig.json                  # Config TypeScript
├── vite.config.ts                 # Config Vite
├── netlify.toml                   # Config déploiement Netlify
└── README.md                      # Readme principal
```

---

## 🎯 Fonctionnalités Principales

### 1. 📊 Dashboard (DashboardPage)

**Rôle**: Vue d'ensemble des documents

**Fonctionnalités**:
- Affichage des documents groupés par statut (Brouillon, Envoyé, Signé, Rejeté)
- Gestion multi-sélection pour suppression batch
- Upload drag & drop de nouveaux PDF
- Filtres par statut
- Badges de statut pulsing avec expiration warning
- Rendu adaptatif mobile/desktop

**Affiche**:
- **Destinataire seul**: Documents reçus à signer + docs signés/rejetés
- **Expéditeur seul**: Documents envoyés en lecture seule + statuts (signé/rejeté)
- **Expéditeur + Destinataire**: Combinaison des 2 contextes avec tri amélioré

### 2. 📝 Préparation Document (PrepareDocumentPage)

**Rôle**: Créer une enveloppe de signature

**Workflow**:
1. Upload PDF (conversion Word → PDF automatique via mammoth)
2. Ajouter destinataires (email + nom)
3. Placer champs interactifs sur PDF:
   - **Signature**: Zone signature dessin/tapé/importer
   - **Paraphe**: Initiales
   - **Date**: Date automatique
   - **Texte**: Champ texte libre
   - **Case à cocher**: Checkbox
4. Redimensionnement/déplacement champs avec grille magnétique
5. Génération tokens uniques par destinataire
6. Création enveloppe Firestore (metadata) + upload PDF Storage

**Sécurité**: Vérification whitelist email avant création

### 3. ✍️ Signature (SignDocumentPage)

**Rôle**: Signature interactive du document

**Accès**: Via token unique `/sign/:token`

**Fonctionnalités**:
- Auto-login silencieux destinataire (session temp, sans localStorage)
- Chargement PDF depuis Firebase Storage
- Affichage champs interactifs avec positions absolues
- Mode édition (déplacement/redimensionnement avec grille)
- Modal signature (3 onglets):
  - **Dessiner**: Canvas avec react-signature-canvas
  - **Taper**: Nom prédéfini avec police cursif
  - **Importer**: Upload image signature
- Capture signature en PNG dataUrl
- Soumission signature → Firestore + audit trail CREATE
- Mode lecture seule si déjà signé par ce destinataire

**Résultat**: Signature stockée dans `Field.value` (dataUrl PNG) + audit trail + PAdES Level-B/T attaché

### 4. 📧 Boîte Réception (InboxPage)

**Rôle**: Emails reçus pour signature

**Affichage**:
- Emails des documents reçus (via EmailJS)
- Statut: Non signé, Signé, Rejeté
- Lien direct vers signature
- Badge emails non lus

**Différenciation**:
- **Destinataire**: Docs à signer (action requise)
- **Expéditeur**: Docs envoyés (lecture seule, statut)
- **Both**: Tri amélioré ACTION REQUISE vs LECTURE SEULE

### 5. ✅ Vérification (VerifyPage)

**Rôle**: Auditer les signatures (conformité juridique)

**Affiche**:
- Audit trail complet (CREATE/SEND/SIGN/REJECT/COMPLETE/TIMESTAMP)
- Horodatage qualifié serveur
- Hash final document
- TSA (Timestamp Authority)
- Conformité eIDAS/PAdES level

**Utilisé pour**: Preuve juridique signature valide

### 6. 🔐 Administration (AdminPanel)

**Rôle**: Gestion whitelist utilisateurs

**Fonctions**:
- Ajouter/retirer emails whitelist dynamique
- Gestion liste prédéfinie FO Métaux
- Logs utilisateurs autorisés

**Accès**: Réservé admin `bouvier.jul@gmail.com`

---

## ⚙️ Configuration et Installation

### Prérequis

```bash
Node.js >= 18
npm >= 9
```

### Installation

```bash
# Clone repository
git clone [url-repo]
cd signease-fo-metaux

# Installer dépendances
npm install
```

### Configuration Environnement

Créer `.env.local` à la racine:

```env
# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# EmailJS
VITE_EMAILJS_SERVICE_ID=service_tcdw2fd  # Gmail
VITE_EMAILJS_PUBLIC_KEY=g2n34kxUJPlU6tsI0
VITE_EMAILJS_TEMPLATE_ID_SIGNATURE=template_6m6pxue
VITE_EMAILJS_TEMPLATE_ID_CONFIRMATION=template_6t8rxgv
```

### Configuration Firebase

📖 **Voir** `docs/FIREBASE.md` pour détails complets

**Collections Firestore**:
- `documents`: Métadonnées documents
- `envelopes`: Enveloppes (document + destinataires + champs)
- `tokens`: Tokens uniques par destinataire
- `emails`: Emails envoyés
- `auditTrails`: Audit trail signatures
- `authorizedUsers`: Whitelist dynamique

**Storage**: Bucket pour PDFs

**⚠️ CORS**: Configurer Firebase Storage CORS (voir `docs/CONFIGURATION-CORS.md`)

### Développement

```bash
npm run dev
```

Application: **http://localhost:3000**

**Hot reload**: Activé, modifications instantanées

### Production

```bash
npm run build
npm run preview
```

Build dans `dist/`, déploiement Netlify automatique

📖 **Voir** `docs/DEPLOIEMENT.md` pour déploiement

---

## 🔄 Flux de Données

### 1. Création Enveloppe

```typescript
// PrepareDocumentPage
upload PDF → Firebase Storage (bucket PDFs)
↓
Ajouter destinataires → Recipient[]
↓
Placer champs → Field[] (type, x, y, width, height, recipientId)
↓
createEnvelope() → Firestore envelopes collection
↓
Générer tokens → Firestore tokens collection (1 par destinataire)
↓
Envoyer emails → EmailJS (lien /sign/:token)
```

### 2. Signature Document

```typescript
// SignDocumentPage
Token URL → getEnvelopeByToken() → Firestore
↓
PDF ID → getPdfData() → Firebase Storage download
↓
Rendu PDF + champs interactifs
↓
Utilisateur signe → handleSaveSignature() → Field.value = dataUrl
↓
submitSignature() → Firestore update envelope.fields + audit trail CREATE
↓
Email confirmation → EmailJS (statut changement)
```

### 3. Audit Trail

```typescript
AuditEvent {
  timestamp: string,
  action: string,
  user: string,
  type: 'CREATE' | 'SEND' | 'SIGN' | 'REJECT' | 'COMPLETE' | 'TIMESTAMP',
  reason?: string,
  recipients?: string[],
  tsa?: string,           // Timestamp Authority
  finalHash?: string      // Hash final document
}
```

Chaque action critique crée un event Firestore `auditTrails` pour conformité juridique.

### 4. Conformité eIDAS/PAdES

```typescript
// firebaseApi.ts
createPAdESSignatureMetadata() → Ajoute métadonnées conformité PAdES Level-B/T
↓
generateQualifiedTimestamp() → Horodatage qualifié serveur TSA
↓
Signature + TSA + Hash final → Audit trail TIMESTAMP
↓
Document signé + PAdES attaché → Conformité juridique totale
```

**Résultat**: Présomption de validité équivalente signature manuscrite

---

## 🔒 Sécurité

### 1. Autorisation Email

**Whitelist Prédéfinie FO Métaux**:
```typescript
PREDEFINED_AUTHORIZED_EMAILS = [
  "marie-helenegl@fo-metaux.fr",
  "corinnel@fo-metaux.fr",
  "contact@fo-metaux.fr",
  "vrodriguez@fo-metaux.fr",
  "aguillermin@fo-metaux.fr",
  "bouvier.jul@gmail.com" // Admin
];
```

**Whitelist Dynamique**: Admin peut ajouter emails via `authorizedUsers` Firestore

**Destinataires**: Automatiquement autorisés s'ils reçoivent un email à signer

**Vérification**: `checkEmailAccess(email)` dans `firebaseApi.ts`

### 2. Tokens Uniques

Chaque destinataire reçoit un token unique:
- Généré aléatoirement à la création enveloppe
- Stocké Firestore `tokens` collection
- URL: `/sign/:token` (accès sans authentification)
- Session temporaire (pas de localStorage)

### 3. Audit Trail

Traçabilité complète:
- Qui a signé (email)
- Quand (timestamp)
- Action (CREATE/SEND/SIGN/REJECT/COMPLETE)
- Raison rejet (si applicable)
- Hash final document
- Conformité eIDAS/PAdES

### 4. CORS Firebase Storage

⚠️ **OBLIGATOIRE** configurer CORS Storage (voir `docs/CONFIGURATION-CORS.md`)

**Sans CORS**: Upload/Download PDFs bloqués

### 5. Expiration Documents

Documents expirés après **365 jours** (cleanup automatique Firestore)

---

## 🛠️ Technologies Utilisées

### Frontend

| Technologie | Usage |
|-------------|-------|
| **React 19** | Framework UI |
| **TypeScript** | Typage statique |
| **Vite** | Build tool ultra-rapide |
| **Tailwind CSS 4** | Styling utility-first |
| **Material Design 3** | Design system (couleurs, elevation, states) |
| **Lucide React** | Icons |
| **React Router DOM** | Routing client-side |
| **React Signature Canvas** | Capture signature canvas |
| **React RND** | Drag & resize champs PDF |

### Backend

| Technologie | Usage |
|-------------|-------|
| **Firebase Firestore** | Base données métadonnées |
| **Firebase Storage** | Stockage PDFs |
| **EmailJS** | Envoi emails (2 services fallback) |
| **jose** | JWT signatures |
| **node-forge** | Cryptographic signatures |
| **@signpdf/signpdf** | PAdES signatures PDF |

### PDF

| Technologie | Usage |
|-------------|-------|
| **pdfjs-dist 4.4** | Rendu PDF canvas |
| **pdf-lib 1.17** | Manipulation PDF |
| **mammoth** | Conversion Word → PDF |
| **html2canvas** | Screenshot canvas |
| **jsPDF** | Génération PDF côté client |

### PAdES/eIDAS

- **@signpdf/signer-p12**: Signatures PAdES avec certificat
- **@signpdf/placeholder-plain**: Placeholders PAdES
- **node-forge**: Cryptographie (PKI, RSA, AES)
- **Horodatage qualifié**: TSA (Timestamp Authority)

---

## 💻 Développement

### Scripts NPM

```bash
npm run dev      # Développement (localhost:3000)
npm run build    # Build production
npm run preview  # Prévisualisation build
```

### Structure de Code

**Composants**: Pures fonctions React + TypeScript
**Services**: `firebaseApi.ts` centralise toutes les opérations Firebase
**Contextes**: `UserContext` pour auth globale
**Routing**: HashRouter (compatible Netlify)

### Mode Strict React

⚠️ **StrictMode DÉSACTIVÉ** (conflit PDF.js rendering)

```typescript
// index.tsx
ReactDOM.createRoot(document.getElementById('root')!); // Pas de StrictMode
```

### Debug

**Console logs**: Actifs en dev, logs Firebase + EmailJS
**Vérification config**: Auto-check Firebase config au démarrage
**Toast notifications**: Erreurs affichées utilisateur

### Responsive

**Mobile-first**: Breakpoints Tailwind
- Mobile: `< 768px` (zoom 50% PDF)
- Tablette: `768px - 1024px` (zoom 75%)
- Desktop: `> 1024px` (zoom 100%)

---

## 🚀 Production et Déploiement

### Netlify

**Config**: `netlify.toml`
- Build: `npm run build`
- Publish: `dist/`
- SPA fallback: `#/*` → `index.html`

**Variables d'environnement**: Configurées dashboard Netlify

### Configuration Production

📖 **Voir** `docs/ETAPES-PRODUCTION.md` pour checklist complète

**Étapes**:
1. Config Firebase (Firestore + Storage + CORS)
2. Variables d'environnement Netlify
3. EmailJS templates
4. Build & deploy
5. Tests end-to-end

### Monitoring

- Firebase Console → Usage Storage/Firestore
- EmailJS Dashboard → Emails envoyés
- Netlify Analytics → Performance

---

## 📚 Documentation Supplémentaire

| Fichier | Description |
|---------|-------------|
| **`docs/FIREBASE.md`** | Configuration Firebase détaillée (Firestore + Storage) |
| **`docs/CONFIGURATION-CORS.md`** | ⚠️ Config CORS Storage (obligatoire) |
| **`docs/CONFIGURATION-PRODUCTION.md`** | Config prod (variables, secrets) |
| **`docs/DEPLOIEMENT.md`** | Guide déploiement Netlify |
| **`docs/ETAPES-PRODUCTION.md`** | ⭐ Checklist production |
| **`docs/BUGS ET AMÉLIORATIONS.md`** | Bugs connus + TODO |
| **`docs/SIGNATURES-EIDAS.md`** | Spécifications eIDAS/PAdES |
| **`docs/LIBRAIRIES-SIGNATURE.md`** | Librairies signatures crypto |
| **`docs/AUDIT-SECURITE-SIGNATURES.md`** | Audit sécurité |
| **`docs/DEPLOIEMENT-BACKEND-SIGNATURE.md`** | Backend signatures PAdES |
| **`docs/IMPLEMENTATION-COMPLETE.md`** | Implémentation complète |
| **`docs/INTEGRATION-VERIFY-EMAILJS.md`** | Intégration EmailJS |

---

## 🎨 Design System

### Material Design 3

**Couleurs** (CSS variables):
- `--md-sys-color-primary`: Couleur primaire
- `--md-sys-color-secondary`: Couleur secondaire
- `--md-sys-color-tertiary`: Couleur tertiaire
- `--md-sys-color-error`: Erreurs
- `--md-sys-color-surface`: Surfaces
- `--md-sys-color-onSurface`: Texte sur surface

**Elévation**: `elevation-0` à `elevation-3`

**États**: `hover:`, `focus:`, `active:`, `pressed:`

### Composants Custom

- **Button**: Variants (filled/outlined/text/glass/gradient) + icons + sizes
- **DocumentCard**: Status badges pulsing + expiration warning
- **Toast**: Notifications système auto-dismiss
- **Tooltip**: Hover tooltips
- **NotificationDropdown**: Badge emails non lus

### Animations

- `animate-fade-in`: Apparition progressive
- `animate-fade-in-scale`: Apparition avec scale
- `animate-slide-down`: Slide down
- `animate-expand`: Expansion modale
- `animate-success-pop`: Pop succès
- `animate-pulse`: Pulsation badges

---

## 📦 Collections Firestore

### documents

```typescript
{
  id: string,
  name: string,
  status: 'Brouillon' | 'Envoyé' | 'Signé' | 'Rejeté',
  createdAt: timestamp,
  updatedAt: timestamp,
  totalPages: number,
  expiresAt: timestamp,
  creatorEmail: string,
  rejectionReason?: string,
  archived?: boolean
}
```

### envelopes

```typescript
{
  id: string,
  document: Document,
  recipients: Recipient[],
  fields: Field[]
}
```

### tokens

```typescript
{
  id: string,           // Token unique
  envelopeId: string,
  recipientEmail: string,
  createdAt: timestamp,
  used: boolean
}
```

### emails

```typescript
{
  id: string,
  to: string,
  from: string,
  subject: string,
  body: string,
  sentAt: timestamp,
  read: boolean,
  signatureLink: string,
  documentName: string
}
```

### auditTrails

```typescript
{
  id: string,
  documentId: string,
  timestamp: timestamp,
  action: string,
  user: string,
  type: 'CREATE' | 'SEND' | 'SIGN' | 'REJECT' | 'COMPLETE' | 'TIMESTAMP',
  reason?: string,
  recipients?: string[],
  tsa?: string,          // Timestamp Authority
  finalHash?: string     // Hash final document
}
```

### authorizedUsers

```typescript
{
  id: string,
  email: string,
  addedAt: timestamp,
  addedBy: string       // Email admin qui a ajouté
}
```

---

## 🐛 Bugs Connus

📖 **Voir détails** dans `docs/BUGS ET AMÉLIORATIONS.md`

### MAJEUR ⚠️

1. **Audit bibliothèque PDF**: Bibliothèque signatures PDF à auditer automatiquement

### MINEUR 🔴

1. **Bug destinataire existant**: Slot1 bug ajout destinataire
2. **Bug destinataire après déconnexion** : Liste des destinataires vide

### UX 🟡

1. **Signature redimensionnable**: Manquante
2. **Header dynamique mobile**: Adaptation scroll Expressive Effect

---

## 🎯 TODO Prochaines Fonctionnalités

1. **Rappel automatique**: Email rappel 3 jours après envoi
2. **Signature redimensionnable**: Redim champs signature
3. **Analytics**: Dashboard analytics pour admin
4. **Connexion** : Se connecter via Firebase

---

## 📞 Support

**Email**: bouvier.jul@gmail.com ; contact.@fo-metaux.fr (Admin) (Admin)
**Organisation**: FO Métaux

---

**SignEase v1.0.0** - Dernière mise à jour: 2025

