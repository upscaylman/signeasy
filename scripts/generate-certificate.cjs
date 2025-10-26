#!/usr/bin/env node

/**
 * 🔐 Script de Génération de Certificat P12 Auto-Signé
 * 
 * Génère un certificat X.509 auto-signé au format P12 pour le développement.
 * 
 * ⚠️ ATTENTION: Ce certificat est UNIQUEMENT pour le développement!
 * En production, utiliser un certificat émis par une Autorité de Certification Qualifiée (QCA)
 * 
 * Usage: node scripts/generate-certificate.js
 */

const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

console.log('🔐 Génération du certificat P12 auto-signé...\n');

// Configuration du certificat
const CERT_CONFIG = {
    commonName: 'SignEase Development Certificate',
    organizationName: 'FO Metaux',
    countryName: 'FR',
    validityYears: 1,
    keySize: 2048,
    password: 'signease-dev-2025', // Mot de passe du P12
};

try {
    // 1️⃣ Générer la paire de clés RSA
    console.log('1️⃣  Génération de la paire de clés RSA-2048...');
    const keys = forge.pki.rsa.generateKeyPair(CERT_CONFIG.keySize);
    console.log('   ✅ Clés générées\n');
    
    // 2️⃣ Créer le certificat
    console.log('2️⃣  Création du certificat X.509...');
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + Date.now().toString(16);
    
    // Dates de validité
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + CERT_CONFIG.validityYears);
    
    // Attributs du sujet
    const attrs = [
        { name: 'commonName', value: CERT_CONFIG.commonName },
        { name: 'organizationName', value: CERT_CONFIG.organizationName },
        { name: 'countryName', value: CERT_CONFIG.countryName },
        { shortName: 'OU', value: 'Development' },
        { shortName: 'ST', value: 'Ile-de-France' },
        { shortName: 'L', value: 'Paris' }
    ];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs); // Auto-signé
    
    // Extensions
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: false
        },
        {
            name: 'keyUsage',
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true
        },
        {
            name: 'extKeyUsage',
            serverAuth: false,
            clientAuth: false,
            codeSigning: false,
            emailProtection: true,
            timeStamping: false
        },
        {
            name: 'subjectKeyIdentifier'
        }
    ]);
    
    // 3️⃣ Signer le certificat
    console.log('3️⃣  Signature du certificat...');
    cert.sign(keys.privateKey, forge.md.sha256.create());
    console.log('   ✅ Certificat signé\n');
    
    // 4️⃣ Créer le fichier P12
    console.log('4️⃣  Création du fichier P12...');
    
    // Créer le bag PKCS#12
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
        keys.privateKey,
        [cert],
        CERT_CONFIG.password,
        {
            algorithm: '3des', // Triple DES
            friendlyName: CERT_CONFIG.commonName
        }
    );
    
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    
    // 5️⃣ Sauvegarder les fichiers
    console.log('5️⃣  Sauvegarde des fichiers...\n');
    
    const outputDir = path.join(__dirname, '..', 'certs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Sauvegarder P12
    const p12Path = path.join(outputDir, 'dev-certificate.p12');
    fs.writeFileSync(p12Path, p12Der, 'binary');
    console.log(`   ✅ Certificat P12: ${p12Path}`);
    
    // Sauvegarder PEM (pour inspection)
    const certPem = forge.pki.certificateToPem(cert);
    const certPemPath = path.join(outputDir, 'dev-certificate.pem');
    fs.writeFileSync(certPemPath, certPem);
    console.log(`   ✅ Certificat PEM: ${certPemPath}`);
    
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const keyPemPath = path.join(outputDir, 'dev-private-key.pem');
    fs.writeFileSync(keyPemPath, keyPem);
    console.log(`   ✅ Clé privée PEM: ${keyPemPath}`);
    
    // Créer fichier .env.local avec le mot de passe
    const envPath = path.join(__dirname, '..', '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Ajouter/mettre à jour les variables
    const newVars = `
# 🔐 Certificat de Signature (Développement uniquement)
VITE_P12_CERTIFICATE_PATH=certs/dev-certificate.p12
VITE_P12_PASSWORD=${CERT_CONFIG.password}
VITE_SIGNATURE_KEY=signease-dev-hmac-key-2025
`;
    
    if (!envContent.includes('VITE_P12_CERTIFICATE_PATH')) {
        fs.appendFileSync(envPath, newVars);
        console.log(`   ✅ Variables ajoutées à .env.local\n`);
    } else {
        console.log(`   ℹ️  Variables déjà présentes dans .env.local\n`);
    }
    
    // 6️⃣ Afficher les informations
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ CERTIFICAT GÉNÉRÉ AVEC SUCCÈS!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('📋 Informations du certificat:');
    console.log(`   • Sujet: ${CERT_CONFIG.commonName}`);
    console.log(`   • Organisation: ${CERT_CONFIG.organizationName}`);
    console.log(`   • Pays: ${CERT_CONFIG.countryName}`);
    console.log(`   • Valide du: ${cert.validity.notBefore.toLocaleDateString('fr-FR')}`);
    console.log(`   • Valide jusqu'au: ${cert.validity.notAfter.toLocaleDateString('fr-FR')}`);
    console.log(`   • Numéro de série: ${cert.serialNumber}`);
    console.log(`   • Algorithme: RSA-${CERT_CONFIG.keySize} + SHA-256\n`);
    
    console.log('🔒 Sécurité:');
    console.log(`   • Mot de passe P12: ${CERT_CONFIG.password}`);
    console.log(`   • ⚠️  CERTIFICAT DE DÉVELOPPEMENT UNIQUEMENT`);
    console.log(`   • 🚫 NE PAS UTILISER EN PRODUCTION\n`);
    
    console.log('📁 Fichiers générés:');
    console.log(`   • ${p12Path}`);
    console.log(`   • ${certPemPath}`);
    console.log(`   • ${keyPemPath}\n`);
    
    console.log('🚀 Prochaines étapes:');
    console.log('   1. Le certificat est prêt à être utilisé');
    console.log('   2. Les variables d\'environnement sont configurées');
    console.log('   3. Redémarrer l\'application pour utiliser le nouveau certificat\n');
    
    console.log('📚 Pour production:');
    console.log('   • Obtenir un certificat QCA auprès de:');
    console.log('     - Certinomis: https://www.certinomis.fr/');
    console.log('     - ChamberSign: https://www.chambersign.fr/');
    console.log('     - GlobalSign: https://www.globalsign.com/\n');
    
    console.log('═══════════════════════════════════════════════════════════════\n');
    
} catch (error) {
    console.error('❌ Erreur lors de la génération du certificat:', error);
    process.exit(1);
}

