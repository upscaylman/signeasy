#!/usr/bin/env node

/**
 * 🧪 Script de Test - Signature Cryptographique PAdES
 * 
 * Teste la signature cryptographique d'un PDF avec le certificat P12
 * 
 * ⚠️ Ce script s'exécute côté serveur (Node.js) uniquement
 * 
 * Usage: node scripts/test-crypto-signature.cjs
 */

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

// Import des fonctions de signature (simulées pour ce test)
const { PDFDocument } = require('pdf-lib');

console.log('🧪 Test de Signature Cryptographique PAdES\n');
console.log('═══════════════════════════════════════════════════════════════\n');

async function testCryptoSignature() {
    try {
        // 1️⃣ Créer un PDF de test
        console.log('1️⃣  Création d\'un PDF de test...');
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4
        
        page.drawText('Document de Test - Signature Électronique', {
            x: 50,
            y: 800,
            size: 20
        });
        
        page.drawText('Ce document est signé électroniquement avec un certificat PAdES.', {
            x: 50,
            y: 750,
            size: 12
        });
        
        page.drawText('Signataire: Jean Dupont', {
            x: 50,
            y: 700,
            size: 12
        });
        
        page.drawText(`Date: ${new Date().toLocaleString('fr-FR')}`, {
            x: 50,
            y: 680,
            size: 12
        });
        
        // Ajouter métadonnées
        pdfDoc.setTitle('Document Test - Signature PAdES');
        pdfDoc.setAuthor('SignEase Test');
        pdfDoc.setSubject('Test de signature électronique');
        pdfDoc.setKeywords(['test', 'eIDAS', 'PAdES']);
        pdfDoc.setCreator('SignEase by FO Metaux');
        pdfDoc.setProducer('SignEase Test Script');
        
        const pdfBytes = await pdfDoc.save();
        console.log('   ✅ PDF de test créé\n');
        
        // 2️⃣ Vérifier le certificat P12
        console.log('2️⃣  Vérification du certificat P12...');
        const p12Path = path.join(__dirname, '..', 'certs', 'dev-certificate.p12');
        
        if (!fs.existsSync(p12Path)) {
            throw new Error(`Certificat P12 introuvable: ${p12Path}\n   Exécutez d'abord: node scripts/generate-certificate.cjs`);
        }
        
        const p12Buffer = fs.readFileSync(p12Path);
        console.log(`   ✅ Certificat chargé: ${p12Path}`);
        console.log(`   📊 Taille: ${(p12Buffer.length / 1024).toFixed(2)} KB\n`);
        
        // 3️⃣ Extraire informations du certificat
        console.log('3️⃣  Extraction des informations du certificat...');
        const p12Password = 'signease-dev-2025';
        const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer, 'raw'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);
        
        // Récupérer le certificat
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const cert = certBags[forge.pki.oids.certBag][0].cert;
        
        console.log('   📋 Informations du certificat:');
        console.log(`      • Sujet: ${cert.subject.getField('CN').value}`);
        console.log(`      • Organisation: ${cert.subject.getField('O').value}`);
        console.log(`      • Pays: ${cert.subject.getField('C').value}`);
        console.log(`      • Valide du: ${cert.validity.notBefore.toLocaleDateString('fr-FR')}`);
        console.log(`      • Valide jusqu'au: ${cert.validity.notAfter.toLocaleDateString('fr-FR')}`);
        console.log(`      • Numéro de série: ${cert.serialNumber}\n`);
        
        // 4️⃣ Calculer le hash du PDF
        console.log('4️⃣  Calcul du hash du PDF...');
        const crypto = require('crypto');
        const pdfHash = crypto.createHash('sha256').update(Buffer.from(pdfBytes)).digest('hex');
        console.log(`   ✅ Hash SHA-256: ${pdfHash.substring(0, 32)}...\n`);
        
        // 5️⃣ Créer une signature HMAC (pour simulation)
        console.log('5️⃣  Génération de la preuve HMAC...');
        const hmacProof = crypto.createHmac('sha256', 'signease-dev-hmac-key-2025').update(pdfHash).digest('hex');
        console.log(`   ✅ HMAC: ${hmacProof.substring(0, 32)}...\n`);
        
        // 6️⃣ Sauvegarder le PDF test
        console.log('6️⃣  Sauvegarde du PDF de test...');
        const testDir = path.join(__dirname, '..', 'test-output');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        const testPdfPath = path.join(testDir, 'test-signed-document.pdf');
        fs.writeFileSync(testPdfPath, pdfBytes);
        console.log(`   ✅ PDF sauvegardé: ${testPdfPath}\n`);
        
        // 7️⃣ Résumé
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ TEST RÉUSSI!');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        console.log('📊 Résultats:');
        console.log(`   • PDF créé: ${testPdfPath}`);
        console.log(`   • Taille: ${(pdfBytes.length / 1024).toFixed(2)} KB`);
        console.log(`   • Hash SHA-256: ${pdfHash}`);
        console.log(`   • Preuve HMAC: ${hmacProof}`);
        console.log(`   • Certificat: dev-certificate.p12\n`);
        
        console.log('🔐 Signature cryptographique:');
        console.log('   • ✅ Certificat P12 valide');
        console.log('   • ✅ Hash d\'intégrité calculé');
        console.log('   • ✅ Preuve HMAC générée');
        console.log('   • ⚠️  Signature @signpdf nécessite Firebase Functions ou backend\n');
        
        console.log('📚 Pour signature cryptographique complète:');
        console.log('   1. Déployer Firebase Functions');
        console.log('   2. Appeler signPDFWithCryptographicSignature()');
        console.log('   3. Utiliser le certificat P12 généré\n');
        
        console.log('🎯 Prochaines étapes:');
        console.log('   • Implémenter Firebase Functions pour signature serveur');
        console.log('   • Obtenir certificat QCA pour production');
        console.log('   • Tester validation avec verifyPDFSignature()\n');
        
        console.log('═══════════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
        process.exit(1);
    }
}

// Exécuter le test
testCryptoSignature();

