# 🎨 Hiérarchie et Styles des Boutons - Design System

## 📊 Nombre de Styles de Boutons

**5 variants** de boutons sont disponibles dans le design system :

1. **Primary** (Principal)
2. **Secondary** (Secondaire)
3. **Outline** (Contour)
4. **Text** (Texte)
5. **Danger** (Danger)

**3 tailles** disponibles :
- **sm** (small) - 40px min-height
- **md** (medium) - 44px min-height (par défaut)
- **lg** (large) - 48px min-height

---

## 🎯 Hiérarchie des Boutons dans l'Application

### 1️⃣ **Primary** (Bouton Principal) - Priorité la plus élevée
**Usage :** Actions principales et importantes

**Caractéristiques :**
- Fond : `var(--color-primary)` (#b71c1c - rouge)
- Texte : Blanc
- Utilisé pour : Actions principales, soumissions, confirmations

**Exemples d'utilisation :**
- ✅ **DashboardPage** : "Tout sélectionner" / "Tout désélectionner"
- ✅ **SignDocumentPage** : "Terminer la signature" (action principale)
- ✅ **VerifyPage** : "Vérifier" (action principale)
- ✅ **InboxPage** : "Examiner & Signer" / "Consulter" (action principale)
- ✅ **QuickSignPage** : "Télécharger" (action principale)
- ✅ **PrepareDocumentPage** : "Envoyer" dans SummaryModal (action principale)

**Hiérarchie visuelle :** ⭐⭐⭐⭐⭐ (5/5)

---

### 2️⃣ **Secondary** (Bouton Secondaire) - Priorité moyenne-haute
**Usage :** Actions secondaires importantes mais moins prioritaires que primary

**Caractéristiques :**
- Fond : `var(--color-secondary)` (#775651 - brun)
- Texte : Blanc
- Utilisé pour : Actions secondaires, annulations dans certains contextes

**Exemples d'utilisation :**
- ✅ **DashboardPage** : "Annuler" (sortie du mode sélection)

**Hiérarchie visuelle :** ⭐⭐⭐⭐ (4/5)

---

### 3️⃣ **Outline** (Bouton Contour) - Priorité moyenne
**Usage :** Actions secondaires avec bordure visible

**Caractéristiques :**
- Fond : Transparent
- Bordure : 2px solid `var(--color-primary)`
- Texte : `var(--color-primary)`
- Hover : Fond `var(--color-primary-container)`
- Utilisé pour : Actions secondaires qui nécessitent de la visibilité

**Exemples d'utilisation :**
- ✅ **DashboardPage** : "Archiver" (action secondaire)
- ✅ **QuickSignPage** : "Ajouter signature" (action secondaire)

**Hiérarchie visuelle :** ⭐⭐⭐ (3/5)

---

### 4️⃣ **Text** (Bouton Texte) - Priorité faible
**Usage :** Actions tertiaires, navigation, actions discrètes

**Caractéristiques :**
- Fond : Transparent
- Texte : `var(--color-primary)`
- Padding réduit : `var(--spacing-sm)`
- Hover : Fond `var(--color-primary-container)`
- Utilisé pour : Navigation, annulations, actions discrètes

**Exemples d'utilisation :**
- ✅ **SignDocumentPage** : "Fermer" (mode lecture seule)
- ✅ **PrepareDocumentPage** : "Retour" (navigation)
- ✅ **PrepareDocumentPage** : "Annuler" dans SummaryModal
- ✅ **QuickSignPage** : "Retour" (navigation)

**Hiérarchie visuelle :** ⭐⭐ (2/5)

---

### 5️⃣ **Danger** (Bouton Danger) - Priorité spéciale
**Usage :** Actions destructives, suppressions, actions irréversibles

**Caractéristiques :**
- Fond : `var(--color-error)` (#ba1a1a - rouge d'erreur)
- Texte : Blanc
- Utilisé pour : Suppressions, actions destructives

**Exemples d'utilisation :**
- ✅ **DashboardPage** : "Supprimer" (visible uniquement pour admins)
- ✅ **DeleteUserDataPage** : "Supprimer toutes les données" (action destructive)

**Hiérarchie visuelle :** ⭐⭐⭐⭐⭐ (5/5) - Mais avec connotation négative/destructrice

---

## 📐 Tailles et Usage

### **sm** (Small) - 40px min-height
**Usage :** Boutons compacts, headers, barres d'outils
- Tous les boutons dans les headers de pages
- Boutons d'action dans les barres d'outils
- Boutons dans les modals compacts

### **md** (Medium) - 44px min-height (par défaut)
**Usage :** Boutons standards dans les formulaires et pages
- Boutons principaux dans les formulaires
- Actions principales dans les pages

### **lg** (Large) - 48px min-height
**Usage :** Boutons d'appel à l'action importants
- Actuellement peu utilisé (pourrait être utilisé pour les CTAs majeurs)

---

## 🎨 Règles d'Utilisation par Contexte

### **Headers de Pages**
- **Text** (sm) : Navigation "Retour"
- **Primary** (sm) : Actions principales dans le header
- **Outline** (sm) : Actions secondaires dans le header

### **Formulaires**
- **Primary** (md) : Soumission principale
- **Text** (md) : Annulation
- **Outline** (md) : Actions secondaires

### **Modals**
- **Primary** (md) : Confirmation principale
- **Text** (md) : Annulation

### **Listes et Tableaux**
- **Primary** (sm) : Actions principales
- **Outline** (sm) : Actions secondaires
- **Danger** (sm) : Suppression

### **Actions Destructives**
- **Danger** (md) : Toujours pour les suppressions et actions irréversibles

---

## 🔄 État des Boutons

Tous les boutons supportent :
- **Normal** : État par défaut
- **Hover** : État au survol (avec transitions)
- **Disabled** : Opacité 0.5, curseur not-allowed
- **Focus-visible** : Outline 2px pour accessibilité

---

## 📋 Résumé de la Hiérarchie

```
Priorité Visuelle (du plus visible au moins visible) :

1. Primary / Danger (5/5) ⭐⭐⭐⭐⭐
   → Actions principales et destructives
   
2. Secondary (4/5) ⭐⭐⭐⭐
   → Actions secondaires importantes
   
3. Outline (3/5) ⭐⭐⭐
   → Actions secondaires avec visibilité
   
4. Text (2/5) ⭐⭐
   → Navigation et actions discrètes
```

---

## 🎯 Recommandations d'Usage

### ✅ À FAIRE
- Utiliser **Primary** pour l'action principale d'une page/formulaire
- Utiliser **Danger** uniquement pour les actions destructives
- Utiliser **Text** pour la navigation et les annulations
- Utiliser **Outline** pour les actions secondaires qui nécessitent de la visibilité
- Utiliser **Secondary** pour les actions secondaires importantes

### ❌ À ÉVITER
- Ne pas utiliser **Danger** pour des actions non-destructives
- Ne pas utiliser **Primary** pour des actions secondaires
- Ne pas mélanger plusieurs boutons **Primary** dans le même contexte (un seul par section)
- Ne pas utiliser **Text** pour des actions critiques

---

## 📊 Statistiques d'Utilisation Actuelle

- **Primary** : ~15 usages (le plus utilisé)
- **Text** : ~8 usages (navigation)
- **Outline** : ~3 usages (actions secondaires)
- **Secondary** : ~1 usage (annulation)
- **Danger** : ~2 usages (suppressions)

---

## 🔧 Personnalisation

Les styles sont définis dans `src/components/atoms/Button/Button.module.css` et utilisent les design tokens de `src/styles/tokens.css`.

Pour modifier les couleurs, espacements ou autres propriétés, modifier les tokens CSS plutôt que les styles directement.

