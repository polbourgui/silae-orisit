import PDFDocument from 'pdfkit';

/**
 * Generates a CDD d'usage PDF for a contrat.
 * @param {object} contrat
 * @param {object} extra
 * @param {object} site
 * @returns {Promise<Buffer>}
 */
export function generateContratPDF(contrat, extra, site) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('CONTRAT À DURÉE DÉTERMINÉE D\'USAGE', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Établissement : ${site.nom}`);
    doc.text(`SIRET : ${site.siret}`);
    doc.moveDown();

    doc.text('ENTRE LES SOUSSIGNÉS', { underline: true });
    doc.moveDown();

    doc.text(`L'employeur : ${site.nom}, représenté par le gérant,`);
    doc.moveDown();

    doc.text('ET');
    doc.moveDown();

    doc.text(`Le salarié : ${extra.prenom} ${extra.nom}`);
    doc.text(`Email : ${extra.email}`);
    doc.text(`Matricule Silae : ${extra.matricule_silae}`);
    doc.moveDown();

    doc.text('IL A ÉTÉ CONVENU CE QUI SUIT :', { underline: true });
    doc.moveDown();

    doc.text(`Article 1 - Objet du contrat`);
    doc.text(`Le présent contrat est conclu pour le motif : extra (secteur hôtellerie-restauration).`);
    doc.moveDown();

    doc.text(`Article 2 - Durée`);
    doc.text(`Date de début : ${contrat.date_debut}`);
    doc.text(`Date de fin : ${contrat.date_fin}`);
    doc.moveDown();

    doc.text(`Article 3 - Emploi`);
    doc.text(`Code emploi : ${contrat.code_emploi}`);
    doc.text(`Nombre d'heures : ${contrat.nb_heures}h`);
    doc.moveDown();

    doc.text(`Article 4 - Rémunération`);
    doc.text(`Taux horaire brut : selon taux en vigueur dans Silae.`);
    doc.moveDown();

    doc.text(`Fait le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(2);

    doc.text('Signature employeur :', { continued: true }).text('                   Signature salarié :', { align: 'right' });

    doc.end();
  });
}
