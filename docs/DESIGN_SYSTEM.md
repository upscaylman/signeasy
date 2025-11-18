# Design System - Atomic Design

## 📋 Vue d'ensemble

Ce projet utilise la méthodologie **Atomic Design** pour organiser les composants React réutilisables. Le système de design est basé sur Material Design 3 et utilise des CSS Modules pour le styling.

## 🏗️ Structure

```
src/
├── components/
│   ├── atoms/          # Composants de base (Button, Input, Icon, Logo)
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.module.css
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Icon/
│   │   ├── Logo/
│   │   └── index.ts
│   ├── molecules/      # Combinaisons d'atomes (SearchBar, Card)
│   │   ├── SearchBar/
│   │   ├── Card/
│   │   └── index.ts
│   ├── organisms/      # Structures complexes (Header, Navigation, Footer)
│   │   ├── Header/
│   │   ├── Navigation/
│   │   ├── Footer/
│   │   └── index.ts
│   ├── templates/      # Layouts réutilisables (MainLayout)
│   │   ├── MainLayout/
│   │   └── index.ts
│   └── index.ts
├── styles/
│   ├── tokens.css      # Design tokens (variables CSS)
│   └── global.css      # Styles globaux
└── pages/              # Pages de l'application
```

## 🎨 Design Tokens

Les tokens sont définis dans `src/styles/tokens.css` :

### Couleurs
- `--color-primary` : #b71c1c
- `--color-secondary` : #775651
- `--color-error` : #ba1a1a
- `--color-background` : #fffbff
- `--color-surface` : #fffbff
- Et plus...

### Espacements
- `--spacing-xs` : 4px
- `--spacing-sm` : 8px
- `--spacing-md` : 16px
- `--spacing-lg` : 24px
- `--spacing-xl` : 32px

### Typographie
- `--font-family` : "Manrope", sans-serif
- `--font-size-sm` : 12px
- `--font-size-md` : 14px
- `--font-size-base` : 16px
- `--font-weight-normal` : 400
- `--font-weight-bold` : 700

## 📦 Composants

### Atoms (Composants de base)

#### Button
```tsx
import { Button } from '../components/atoms';

<Button variant="primary" size="md" onClick={handleClick}>
  Cliquer
</Button>
```

**Props :**
- `variant`: 'primary' | 'secondary' | 'outline' | 'text' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `disabled`: boolean

#### Input
```tsx
import { Input } from '../components/atoms';

<Input
  label="Email"
  placeholder="votre@email.com"
  error="Email invalide"
  helperText="Entrez votre adresse email"
/>
```

#### Icon
```tsx
import { Icon } from '../components/atoms';

<Icon name="Search" size="md" />
```

### Molecules (Combinaisons d'atomes)

#### SearchBar
```tsx
import { SearchBar } from '../components/molecules';

<SearchBar
  onSearch={(value) => console.log(value)}
  placeholder="Rechercher..."
/>
```

#### Card
```tsx
import { Card } from '../components/molecules';

<Card
  title="Titre"
  description="Description"
  onClick={handleClick}
>
  <Button>Action</Button>
</Card>
```

### Organisms (Structures complexes)

#### Header
```tsx
import { Header } from '../components/organisms';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { to: '/inbox', label: 'Inbox', icon: 'Inbox' },
];

<Header navItems={navItems} onSearch={handleSearch} />
```

#### Navigation
```tsx
import { Navigation } from '../components/organisms';

<Navigation items={navItems} />
```

#### Footer
```tsx
import { Footer } from '../components/organisms';

const links = [
  { name: 'À propos', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

<Footer links={links} copyright="© 2025 FO Métaux" />
```

### Templates (Layouts)

#### MainLayout
```tsx
import { MainLayout } from '../components/templates';

<MainLayout navItems={navItems} onSearch={handleSearch}>
  <h1>Contenu de la page</h1>
</MainLayout>
```

## 🚀 Migration progressive

Pour migrer progressivement vers le nouveau système de design :

1. **Importer les styles globaux** dans votre `index.tsx` :
```tsx
import './styles/global.css';
```

2. **Remplacer les composants un par un** :
   - Commencer par les atomes (Button, Input)
   - Puis les molécules (SearchBar, Card)
   - Enfin les organismes (Header, Footer)

3. **Utiliser les tokens CSS** dans vos styles personnalisés :
```css
.my-component {
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
```

## 📝 Bonnes pratiques

1. **Toujours utiliser les tokens CSS** : Ne pas utiliser de valeurs en dur
2. **Composition over configuration** : Favoriser la composition de composants
3. **Props validation** : Tous les composants utilisent PropTypes
4. **CSS Modules** : Chaque composant a son propre fichier CSS module
5. **Accessibilité** : Touch targets de 44px minimum, focus visible, etc.

## 📦 Installation

Si vous utilisez PropTypes (recommandé pour la validation à l'exécution), installez-le :

```bash
npm install prop-types
npm install --save-dev @types/prop-types
```

## 🔧 Développement

### Ajouter un nouvel atome

1. Créer le dossier dans `src/components/atoms/`
2. Créer `ComponentName.tsx`, `ComponentName.module.css` et `index.ts`
3. Exporter dans `src/components/atoms/index.ts`

### Ajouter une nouvelle molécule

1. Créer le dossier dans `src/components/molecules/`
2. Importer et composer les atomes nécessaires
3. Créer les fichiers nécessaires
4. Exporter dans `src/components/molecules/index.ts`

## 📚 Ressources

- [Atomic Design Methodology](https://atomicdesign.bradfrost.com/)
- [Material Design 3](https://m3.material.io/)
- [CSS Modules](https://github.com/css-modules/css-modules)

