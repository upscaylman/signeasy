import mammoth from 'mammoth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Convertit un fichier Word (.doc, .docx) en PDF
 * @param file - Le fichier Word à convertir
 * @returns Promise<File> - Le fichier PDF converti
 */
export async function convertWordToPdf(file: File): Promise<File> {
    try {
        // Lire le fichier Word avec mammoth
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;

        // Si le HTML est vide, erreur
        if (!html || html.trim().length === 0) {
            throw new Error('Le document Word est vide ou ne peut pas être lu.');
        }

        // Créer un conteneur temporaire pour le HTML
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '794px'; // A4 width at 96 DPI (210mm)
        container.style.padding = '60px'; // ~15mm margins
        container.style.backgroundColor = 'white';
        container.style.fontFamily = 'Arial, Helvetica, sans-serif';
        container.style.fontSize = '14px';
        container.style.lineHeight = '1.6';
        container.style.color = '#000000';
        container.innerHTML = `
            <style>
                h1 { font-size: 24px; font-weight: bold; margin: 20px 0 10px; }
                h2 { font-size: 20px; font-weight: bold; margin: 16px 0 8px; }
                h3 { font-size: 16px; font-weight: bold; margin: 14px 0 7px; }
                p { margin: 8px 0; }
                strong { font-weight: bold; }
                em { font-style: italic; }
                ul, ol { margin: 10px 0; padding-left: 30px; }
                li { margin: 5px 0; }
                table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                td, th { border: 1px solid #ddd; padding: 8px; }
            </style>
            ${html}
        `;
        document.body.appendChild(container);

        // Attendre un peu pour que le rendu soit complet
        await new Promise(resolve => setTimeout(resolve, 100));

        // Convertir le HTML en canvas avec html2canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 794,
            width: 794
        });

        // Nettoyer le DOM
        document.body.removeChild(container);

        // Créer le PDF avec jsPDF
        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Ajouter la première page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        // Ajouter les pages suivantes si nécessaire
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;
        }

        // Convertir le PDF en Blob puis en File
        const pdfBlob = pdf.output('blob');
        const pdfFile = new File(
            [pdfBlob],
            file.name.replace(/\.(docx?|DOCX?)$/, '.pdf'),
            { type: 'application/pdf' }
        );

        return pdfFile;
    } catch (error) {
        console.error('Erreur lors de la conversion Word → PDF:', error);
        throw new Error('Impossible de convertir le fichier Word en PDF.');
    }
}

/**
 * Vérifie si un fichier est un document Word
 * @param file - Le fichier à vérifier
 * @returns boolean
 */
export function isWordFile(file: File): boolean {
    return (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword' ||
        file.name.toLowerCase().endsWith('.docx') ||
        file.name.toLowerCase().endsWith('.doc')
    );
}

