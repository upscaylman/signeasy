# Guide de migration vers le Design System Atomic Design

## 🎯 Objectif

Migrer progressivement l'application existante vers le nouveau système de design Atomic Design tout en conservant le style actuel.

## 📋 Étapes de migration

### Étape 1 : Importer les styles globaux

Dans `index.tsx` ou `App.tsx`, ajouter :

```tsx
import './styles/global.css';
```

### Étape 2 : Remplacer les composants Button

**Avant :**
```tsx
import Button from './components/Button';
```

**Après :**
```tsx
import { Button } from './components/atoms';
```

### Étape 3 : Remplacer les composants Input

Créer des champs de formulaire avec le nouveau composant Input qui inclut label, erreur et helper text.

### Étape 4 : Utiliser MainLayout

**Avant :**
```tsx
<div>
  <Header />
  <main>{children}</main>
  <Footer />
</div>
```

**Après :**
```tsx
import { MainLayout } from './components/templates';

<MainLayout navItems={navItems} onSearch={handleSearch}>
  {children}
</MainLayout>
```

## 🔄 Migration par composant

### Button.tsx existant → Nouveau Button

Le nouveau Button utilise CSS Modules au lieu de Tailwind. Les variants sont similaires :
- `filled` → `primary`
- `outlined` → `outline`
- `text` → `text`
- `danger` → `danger`

### Header.tsx existant → Nouveau Header

Le nouveau Header est simplifié et utilise les composants du design system :
- Logo → Composant Logo atom
- Navigation → Composant Navigation organisme
- SearchBar → Composant SearchBar molécule

## ⚠️ Points d'attention

1. **CSS Modules vs Tailwind** : Le nouveau système utilise CSS Modules. Les classes Tailwind existantes continueront de fonctionner pendant la transition.

2. **Tokens CSS** : Utiliser les variables CSS définies dans `tokens.css` plutôt que les valeurs Material Design 3 directement.

3. **Props** : Les nouveaux composants ont des interfaces TypeScript strictes. Vérifier la compatibilité des props.

4. **Icônes** : Le composant Icon utilise Lucide React. Vérifier que les noms d'icônes correspondent.

## 📝 Checklist de migration

- [ ] Importer `global.css` dans l'application
- [ ] Remplacer les Button existants
- [ ] Remplacer les Input existants
- [ ] Migrer Header vers le nouveau composant
- [ ] Migrer Footer vers le nouveau composant
- [ ] Utiliser MainLayout dans les pages
- [ ] Tester visuellement que le rendu est identique
- [ ] Vérifier l'accessibilité
- [ ] Tester sur mobile

## 🐛 Résolution de problèmes

### Les styles ne s'appliquent pas

Vérifier que `global.css` est bien importé et que les tokens CSS sont chargés.

### Les icônes ne s'affichent pas

Vérifier que le nom de l'icône correspond exactement à un nom d'icône Lucide React (case-sensitive).

### Les couleurs sont différentes

Vérifier que les tokens CSS correspondent aux couleurs Material Design 3 utilisées dans `index.css`.

