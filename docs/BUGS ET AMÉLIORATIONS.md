BUGS ET AMÉLIORATIONS

🔴 Critique - Sécurité
✅ P1 - Faille de sécurité majeure dans l'accès au dashboard
~~Actuellement, n'importe quel destinataire ayant reçu un document à signer peut accéder au dashboard de l'expéditeur.~~ ✅ RÉSOLU

Solutions implémentées:
- Modification de getDocuments() pour afficher UNIQUEMENT les documents créés par l'utilisateur
- Les destinataires voient leurs demandes de signature exclusivement via /inbox (emails)
- Le dashboard est désormais réservé aux créateurs de documents uniquement

Vérifier que l'email du destinataire est bien capturé dès le clic sur "Signer le document" dans l'email (template EmailJS)

Si impossible, restreindre l'accès uniquement au document à signer

Limiter l'accès au dashboard aux utilisateurs propriétaires de leurs propres documents

P2 - Vérification de la légitimité des documents
Implémenter un système de validation pour s'assurer que les documents sont authentiques et non altérés.

P3 - Audit de la bibliothèque de signature
Vérifier et potentiellement migrer vers une bibliothèque de signature PDF plus robuste (Nutrient SDK, react-esigning-library, Syncfusion PDF Viewer).

🟠 Majeur - Fonctionnalités critiques
✅ P2 - Boîte de réception défectueuse
~~La réception des messages ne fonctionne plus normalement. Identifier et corriger le problème de synchronisation.~~ ✅ RÉSOLU

Solutions implémentées:
- Suppression de l'orderBy() qui causait une erreur d'index composite manquant dans Firestore
- Tri des emails côté client par date décroissante
- Normalisation des emails en minuscules (toLowerCase()) pour cohérence BDD

P1 - Dysfonctionnement de l'envoi multi-destinataires
Les emails à plusieurs destinataires ne fonctionnent pas ou arrivent avec retard. Vérifier également si la signature est possible avec plusieurs destinataires.

P4 - Audit complet des données en BDD
Vérifier l'intégrité et la cohérence des données stockées.

~~P5 - Destinataire existant ne va pas dans le slot 1~~
~~Corriger le comportement lors de l'ajout d'un destinataire existant.~~

🟡 Moyen - Améliorations UX importantes
P1 - Taille et redimensionnement de la signature
La signature ne peut pas être redimensionnée homothétiquement et est trop petite par défaut. Augmenter la taille par défaut et permettre le redimensionnement proportionnel.

~~P2 - Affichage des initiales utilisateur dans le header~~
~~Afficher les initiales de l'utilisateur connecté avec une couleur aléatoire pour personnaliser l'interface.~~

~~P3 - Bouton de déconnexion~~
~~Ajouter un bouton de déconnexion à côté de l'icône utilisateur pour faciliter la sortie de l'application.~~

P4 - Navigation mobile/tablette
Deux options à choisir :

Menu flottant arrondi en bas avec les boutons de navigation

~~Menu burger avec les pages et bouton de déconnexion en bas~~

P5 - Header dynamique en mobile
Implémenter un effet de réduction du header au scroll : header large avec logo et texte en haut de page, puis réduction fluide au scroll pour n'afficher que le logo.

🟢 Mineur - Améliorations cosmétiques
✅ P1 - Badge de notification
~~Déplacer le badge de notification en dehors du bouton lorsqu'il n'est pas focus.~~ ✅ RÉSOLU - Restructuration HTML du badge pour le placer comme frère du NavLink au lieu d'enfant.

~~P2 - Bug du bouton "Ajouter" en mobile sur la séction "Gestion des Accès" pour l'admin bouvier.jul~~
~~Le bouton dépasse du container dans la section gestion d'accès du dashboard. Corriger le responsive.~~

P3 - Supprimer le champ sujet
Retirer le champ sujet de la popup d'envoi pour simplifier l'interface.

🔵 Feature - Nouvelles fonctionnalités
P1 - Système de rappel automatique
Implémenter l'envoi automatique d'un email de rappel tous les 3 jours pour les documents non signés.

Cette priorisation place la sécurité en premier, suivie des fonctionnalités critiques cassées, puis des améliorations UX et enfin des corrections mineures et nouvelles fonctionnalités.​

Récapitulatif des nouveaux bugs et améliorations
Voici la synthèse structurée des 5 nouveaux éléments identifiés :

🟠 Majeur - Fonctionnalités critiques
Affichage des cartes pour documents signés reçus
Sur le tableau de bord de l'utilisateur ayant reçu un document signé par mail, la carte doit apparaître et être triée correctement comme elle devrait l'être normalement.​

Système de notifications cassé
Le système de notification ne fonctionne plus et n'affiche plus les notifications aux utilisateurs.​

Synchronisation cartes/boîte de réception
Le système de cartes et le contenu de la boîte de réception doivent fonctionner simultanément avec le même type de système de tri pour maintenir la cohérence des données.​

🟡 Moyen - Améliorations UX importantes
Validation du processus de signature
Quand on reçoit le document à signer, le bouton "Terminer la signature" doit être désactivé par défaut jusqu'à ce que l'utilisateur suive complètement la procédure de signature. À ce moment, le bouton s'active et le processus peut être finalisé.​

🟢 Mineur - Améliorations cosmétiques
Adaptation hauteur écran du bouton déconnexion
Dans le menu, le bouton de déconnexion est mal adapté à la hauteur de l'écran et nécessite un ajustement de positionnement vertical.​

---

## 📋 Bugs Résolus

✅ **Boucle infinie de file chooser** (Bug critique de routing)
- Problème: Route `/` → `/dashboard` → `/` créait une redirection infinie causant des centaines de file chooser modaux
- Solution: Restructuration du routing avec AppContent gérant l'affichage du modal login AVANT les routes
- Date: Session actuelle

✅ **Faille de sécurité: Destinataire accède au dashboard complet** (Bug critique P1)
- Problème: Destinataires pouvaient voir tous les documents du créateur via /dashboard, pas seulement leurs demandes de signature
- Root cause: `getDocuments()` retournait documents créés + documents où utilisateur était destinataire
- Solution: Modifier `getDocuments()` pour retourner UNIQUEMENT documents créés par l'utilisateur (ligne 216 firebaseApi.ts)
- Impact: Les destinataires voient maintenant exclusivement leurs demandes via /inbox (emails), pas dans le dashboard
- Date: Session actuelle
- Fichier: services/firebaseApi.ts

✅ **Boîte de réception défectueuse - Emails ne s'affichent pas** (Bug majeur P2)
- Problème: Les emails reçus ne s'affichaient plus dans l'inbox
- Root cause: Requête Firestore avec WHERE + ORDER BY sans index composite => FirebaseError d'index manquant
- Solution: 1) Supprimer orderBy() de la requête 2) Trier côté client par date 3) Normaliser emails en minuscules
- Changements:
  - `getEmails()`: Retirer orderBy(), trier les emails côté client par sentAt décroissant
  - `createEnvelope()`: Normaliser toEmail en minuscules lors de création
  - `submitSignature()`: Normaliser creatorEmail en minuscules pour emails de confirmation
- Impact: Les emails s'affichent maintenant correctement dans l'inbox
- Date: Session actuelle
- Fichier: services/firebaseApi.ts

✅ **P5 - Destinataire existant ne va pas dans le slot 1** (Bug majeur P5)
- Problème: Lors de l'ajout d'un destinataire existant, le destinataire n'était pas correctement placé dans le slot 1.
- Root cause: La logique de placement des destinataires dans le slot 1 n'était pas correctement implémentée.
- Solution: Modifier la logique de placement des destinataires pour qu'un destinataire existant soit toujours placé dans le slot 1.
- Impact: Les destinataires existants sont maintenant correctement placés dans le slot 1.
- Date: Session actuelle
- Fichier: services/firebaseApi.ts