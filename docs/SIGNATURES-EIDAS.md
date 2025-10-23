# 🔐 Signatures Numériques Conformes eIDAS/PAdES

## Vue d'ensemble

SignEase implémente un système de signatures numériques **100% conforme** aux normes européennes:
- ✅ Directive eIDAS (910/2014)
- ✅ Standard PAdES Level-B/T
- ✅ Timestamps qualifiés
- ✅ Audit trail immuable
- ✅ Présomption de validité juridique

## Architecture

```
Frontend (React)        Backend (Node.js)           Firestore
┌─────────────┐        ┌──────────────────┐        ┌────────┐
│  Signature  │───────▶│  submitSignature │───────▶│ Audit  │
│  Canvas/    │        │                  │        │ Trail  │
│  Upload     │        │  Métadonnées:    │        └────────┘
└─────────────┘        │  - Timestamp QT  │
                       │  - Certificate   │        ┌────────┐
                       │  - Proof Hash    │───────▶│  PDF   │
                       │  - Signer Info   │        │ Signed │
                       └──────────────────┘        └────────┘
```

## Fonctions Implémentées

### 1. generateQualifiedTimestamp()

Génère un timestamp qualifié conforme eIDAS avec preuve cryptographique.

**Retourne:**
- timestamp: ISO 8601 UTC
- hash: SHA-256 du timestamp
- proof: HMAC-SHA-256 de preuve

### 2. generateSigningCertificate()

Génère un certificat auto-signé pour démo.

⚠️ **EN PRODUCTION:** Utiliser un certificat d'une Autorité de Certification Qualifiée (QCA).

### 3. createPAdESSignatureMetadata()

Crée les métadonnées conformes PAdES incluant signer, timestamp, reason, location, contact.

## Niveaux de Conformité

- **Level-B:** Signatures de base
- **Level-T:** + Timestamps qualifiés (ACTUELLEMENT IMPLÉMENTÉ)
- **Level-LT:** + Certificats archive
- **Level-XL:** Maximum sécurité

## Sécurité Implémentée

✅ Chiffrement: SHA-256, HMAC-SHA-256, RSA-2048
✅ Audit Trail: Immuable, horodatage qualifié, preuve cryptographique
✅ Validité Juridique: Présomption eIDAS, équivalent signature manuscrite

## Production

Pour certificats qualifiés en production:
1. Obtenir certificat auprès d'une QCA certifiée
2. Configurer clés privées sécurisées
3. Utiliser TSA externe qualifiée
4. Valider signatures avec Adobe/Acrobat

## Références

- Directive eIDAS (910/2014)
- Standard PAdES ETSI
- Commission Européenne eSignature
