# Design System - SignEase by FO Metaux

Système de composants React réutilisables selon la méthodologie Atomic Design.

## Structure

```
src/
├── components/
│   ├── atoms/          # Composants de base (Button, Input, Icon, Logo)
│   ├── molecules/      # Combinaisons d'atomes (SearchBar, Card)
│   ├── organisms/      # Structures complexes (Header, Navigation, Footer)
│   └── templates/      # Layouts réutilisables (MainLayout)
├── styles/
│   ├── tokens.css      # Design tokens (couleurs, espacements, etc.)
│   └── global.css      # Styles globaux
└── pages/              # Pages de l'application
```

## Utilisation

### Importer les composants

```tsx
import { Button, Input, Icon } from '../components/atoms';
import { SearchBar, Card } from '../components/molecules';
import { Header, Navigation, Footer } from '../components/organisms';
import { MainLayout } from '../components/templates';
```

### Exemple d'utilisation

```tsx
import MainLayout from '../components/templates/MainLayout';
import Card from '../components/molecules/Card';
import Button from '../components/atoms/Button';

const MyPage = () => {
  return (
    <MainLayout navItems={[...]}>
      <Card title="Titre" description="Description">
        <Button variant="primary">Action</Button>
      </Card>
    </MainLayout>
  );
};
```

## Design Tokens

Tous les tokens sont définis dans `src/styles/tokens.css` et utilisent des variables CSS :

- **Couleurs** : `var(--color-primary)`, `var(--color-secondary)`, etc.
- **Espacements** : `var(--spacing-xs)`, `var(--spacing-sm)`, etc.
- **Typographie** : `var(--font-size-md)`, `var(--font-weight-bold)`, etc.
- **Rayons** : `var(--radius-md)`, `var(--radius-lg)`, etc.
- **Ombres** : `var(--shadow-sm)`, `var(--shadow-md)`, etc.

## Composants disponibles

### Atoms
- **Button** : Bouton avec variants (primary, secondary, outline, text, danger)
- **Input** : Champ de saisie avec label, erreur et texte d'aide
- **Icon** : Icône Lucide React avec tailles (sm, md, lg)
- **Logo** : Logo SignEase

### Molecules
- **SearchBar** : Barre de recherche combinant Input + Button
- **Card** : Carte avec titre, description et contenu personnalisable

### Organisms
- **Header** : En-tête avec logo, navigation et barre de recherche
- **Navigation** : Navigation avec liens et icônes
- **Footer** : Pied de page avec liens et copyright

### Templates
- **MainLayout** : Layout principal avec Header, contenu et Footer

## Bonnes pratiques

1. **Utiliser les tokens CSS** : Toujours utiliser les variables CSS plutôt que des valeurs en dur
2. **Composition** : Favoriser la composition de composants plutôt que de créer de nouveaux composants monolithiques
3. **Props validation** : Tous les composants utilisent PropTypes pour la validation
4. **CSS Modules** : Chaque composant a son propre fichier CSS module pour éviter les conflits
5. **Accessibilité** : Tous les composants respectent les standards d'accessibilité (touch targets de 44px minimum, focus visible, etc.)

