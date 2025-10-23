# 🔐 Configuration Production - Certificat QCA & Clés Sécurisées

## Vue d'ensemble

Pour déployer SignEase en production avec signatures numériques **100% conformes eIDAS/PAdES**, vous devez:

1. ✅ Obtenir un certificat émis par une AC Qualifiée (QCA)
2. ✅ Configurer les variables d'environnement sécurisées
3. ✅ Mettre en place la gestion des secrets
4. ✅ Configurer les logs d'audit

## Étape 1: Obtenir un Certificat QCA

### Fournisseurs QCA Recommandés (France/Europe)

| Fournisseur | Services | Coût/an | Lien |
|-----------|----------|---------|------|
| **Certinomis** | QES + TSA | ~200-500€ | www.certinomis.fr |
| **SafeNet (Thales)** | QES + HSM | ~1000€+ | www.thalesgroup.com |
| **GlobalSign** | QES + TSA | ~300-800€ | www.globalsign.com |
| **AC Camerfirm** | QES simplifié | ~100-300€ | www.camerfirm.fr |

### Processus d'Obtention

1. **Commander le certificat** auprès de la QCA
2. **Fournir les informations:**
   ```
   Domaine: signease.fo-metaux.fr
   Organisation: FO Metaux
   Pays: FR
   Email: contact@fo-metaux.fr
   Clé: RSA-2048 ou supérieur
   Usage: Document Signing (Document électronique)
   Validité: 1-3 ans
   ```

3. **Recevoir le certificat** en format PEM
   ```
   -----BEGIN CERTIFICATE-----
   MIIDXTCCAkWgAwIBAgIJAMv...
   -----END CERTIFICATE-----
   ```

4. **Exporter la clé privée** (PKCSfile, convertir en PEM)
   ```bash
   openssl pkcs12 -in certificate.p12 -out private-key.pem -nodes -nocerts
   ```

5. **Exporter la clé publique** depuis le certificat
   ```bash
   openssl x509 -in certificate.pem -pubkey -noout > public-key.pem
   ```

## Étape 2: Configurer les Variables d'Environnement

### ⚠️ JAMAIS en clair dans le code!

Utilisez un gestionnaire de secrets:

#### Option A: AWS Secrets Manager (RECOMMANDÉ)

```bash
# Créer le secret
aws secretsmanager create-secret \
  --name signease/production/certificates \
  --secret-string '{
    "SIGNING_CERTIFICATE": "-----BEGIN CERTIFICATE-----\n...",
    "SIGNING_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...",
    "SIGNING_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\n...",
    "SIGNATURE_KEY": "a1b2c3d4e5f6..."
  }'

# Ajouter en .env.production (fichier local sécurisé)
SIGNING_CERTIFICATE=$(aws secretsmanager get-secret-value --secret-id signease/production/certificates --query SecretString --output text | jq -r '.SIGNING_CERTIFICATE')
SIGNING_PRIVATE_KEY=$(aws secretsmanager get-secret-value --secret-id signease/production/certificates --query SecretString --output text | jq -r '.SIGNING_PRIVATE_KEY')
```

#### Option B: Azure Key Vault

```bash
# Créer les secrets
az keyvault secret set \
  --vault-name SignEaseKeyVault \
  --name SigningCertificate \
  --file certificate.pem

az keyvault secret set \
  --vault-name SignEaseKeyVault \
  --name SigningPrivateKey \
  --file private-key.pem
```

#### Option C: HashiCorp Vault (Sur-site)

```bash
vault kv put secret/signease/production \
  SIGNING_CERTIFICATE=@certificate.pem \
  SIGNING_PRIVATE_KEY=@private-key.pem \
  SIGNATURE_KEY="your-256-bit-hex-key"
```

#### Option D: Firebase Secrets (Simple)

```bash
firebase functions:config:set \
  signing.certificate="-----BEGIN CERTIFICATE-----..." \
  signing.private_key="-----BEGIN RSA PRIVATE KEY-----..." \
  signing.signature_key="a1b2c3d4e5f6..."
```

### Variables d'Environnement Requises

```bash
# Mode production
NODE_ENV=production

# Certificat QCA (format PEM)
SIGNING_CERTIFICATE="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"

# Clé privée (format PEM, CONFIDENTIELLE)
SIGNING_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Clé publique (format PEM)
SIGNING_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Informations du certificat
SIGNING_CERTIFICATE_ISSUER="Certinomis"
SIGNING_CERT_VALID_FROM="2025-01-01T00:00:00Z"
SIGNING_CERT_VALID_UNTIL="2026-01-01T00:00:00Z"

# Clé de signature HMAC-256 (générer avec: openssl rand -hex 32)
SIGNATURE_KEY="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"

# TSA (Time Stamping Authority) optionnel
TSA_URL="http://timestamp.certinomis.fr/tsa"
TSA_USERNAME="your-tsa-username"
TSA_PASSWORD="your-tsa-password"
```

## Étape 3: Générer une Clé SIGNATURE_KEY Sécurisée

```bash
# Générer 32 bytes hexadécimaux (256 bits) pour HMAC-SHA-256
openssl rand -hex 32

# Résultat: a1b2c3d4e5f6...

# ⚠️ Sauvegarder dans votre gestionnaire de secrets!
```

## Étape 4: Configuration Vérification

### Script de vérification de production

```bash
#!/bin/bash

echo "🔐 Vérification configuration production..."

# Vérifier les variables
[ -z "$SIGNING_CERTIFICATE" ] && echo "❌ SIGNING_CERTIFICATE manquant" && exit 1
[ -z "$SIGNING_PRIVATE_KEY" ] && echo "❌ SIGNING_PRIVATE_KEY manquant" && exit 1
[ -z "$SIGNING_PUBLIC_KEY" ] && echo "❌ SIGNING_PUBLIC_KEY manquant" && exit 1
[ -z "$SIGNATURE_KEY" ] && echo "❌ SIGNATURE_KEY manquant" && exit 1

# Vérifier les formats PEM
echo "$SIGNING_CERTIFICATE" | grep -q "BEGIN CERTIFICATE" || { echo "❌ Certificat invalide"; exit 1; }
echo "$SIGNING_PRIVATE_KEY" | grep -q "BEGIN RSA PRIVATE KEY" || { echo "❌ Clé privée invalide"; exit 1; }

# Vérifier la longueur SIGNATURE_KEY (256 bits = 64 caractères hex)
if [ ${#SIGNATURE_KEY} -ne 64 ]; then
  echo "❌ SIGNATURE_KEY doit faire 64 caractères (256 bits)"
  exit 1
fi

echo "✅ Configuration production vérifiée!"
```

## Étape 5: Bonnes Pratiques de Sécurité

### ✅ À FAIRE

- ✅ Stocker les clés dans un **gestionnaire de secrets**
- ✅ Utiliser **chiffrement au repos** (AES-256)
- ✅ Activer **audit logging complet**
- ✅ **Rotater les clés** annuellement
- ✅ Utiliser **HSM** (Hardware Security Module) si possible
- ✅ Appliquer **principe du moindre privilège** (accès limité)
- ✅ **Monitorer les accès** aux certificats
- ✅ Maintenir **certificat backup** offline

### ❌ À NE PAS FAIRE

- ❌ Commiter les certificats en clair en Git
- ❌ Stocker les clés dans des fichiers .env du repo
- ❌ Transmettre les clés en HTTP (toujours HTTPS)
- ❌ Utiliser des certificats auto-signés en production
- ❌ Réutiliser la même SIGNATURE_KEY pour plusieurs services
- ❌ Oublier de logger l'accès aux certificats
- ❌ Ignorer les expirations de certificat

## Étape 6: Déploiement Production

### Sur Firebase Hosting

```bash
# 1. Configurer les variables
firebase functions:config:set \
  signing.certificate="$SIGNING_CERTIFICATE" \
  signing.private_key="$SIGNING_PRIVATE_KEY" \
  signing.public_key="$SIGNING_PUBLIC_KEY"

# 2. Accéder dans le code
const cert = functions.config().signing.certificate;

# 3. Déployer
firebase deploy --only functions
```

### Sur Node.js/Express

```bash
# 1. Charger depuis variables d'environnement
require('dotenv').config({ path: '.env.production' });

# 2. Vérifier à l'initialisation
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SIGNING_CERTIFICATE) {
    throw new Error('SIGNING_CERTIFICATE non configuré');
  }
}

# 3. Démarrer l'application
npm start
```

### Sur Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Les variables d'environnement sont injectées à la création du container
# docker run -e SIGNING_CERTIFICATE="..." myapp

CMD ["node", "server.js"]
```

```bash
# Lancer avec secret Docker
docker secret create signing_certificate certificate.pem
docker secret create signing_key private-key.pem

docker service create \
  --secret signing_certificate \
  --secret signing_key \
  -e SIGNING_CERTIFICATE=/run/secrets/signing_certificate \
  -e SIGNING_PRIVATE_KEY=/run/secrets/signing_key \
  myapp
```

## Monitoring & Audit

### Vérifier l'usage des certificats

```bash
# Voir les accès aux clés
grep "SIGNING_" /var/log/app.log | tail -100

# Alerter si certificat expire dans 30 jours
# À mettre en cron job
certmonitor --alert-days 30
```

### Logs à implémenter

```typescript
// À ajouter dans firebaseApi.ts
console.log(`🔐 Signature appliquée par: ${signerEmail}`);
console.log(`🔐 Certificat utilisé: ${config.issuer}`);
console.log(`🔐 Validité: ${config.validFrom} - ${config.validUntil}`);
console.log(`🔐 Hash timestamp: ${timestamp.hash}`);
```

## Support & Ressources

- 📖 Documentation eIDAS: https://ec.europa.eu/digital-building-blocks/
- 📖 Standard PAdES: https://www.etsi.org/
- 🔗 Certinomis: https://www.certinomis.fr/
- 🔗 AWS Secrets Manager: https://docs.aws.amazon.com/secretsmanager/
- 🔗 Azure Key Vault: https://azure.microsoft.com/en-us/services/key-vault/

---

**Version:** 1.0
**Date:** 2025-10-23
**Status:** Production-Ready
