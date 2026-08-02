const fs = require('fs');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');

/**
 * Udtrækker indlejret tekst direkte fra en PDF. Virker for "rigtige" PDF'er
 * (eksporteret fra Word, Office, browsere osv.) - langt hurtigere og mere
 * præcist end OCR, og de fleste PDF'er i praksis er af denne type.
 * Scannede/billedbaserede PDF'er giver typisk tom/meget kort tekst tilbage;
 * dem OCR'er vi ikke (endnu) - kun rene billedfiler.
 */
async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

// Genbruger én Tesseract-worker for hele processens levetid i stedet for at
// starte/stoppe den for hvert billede - opstart er relativt dyrt.
// dan+eng dækker både dansk og engelsk tekst i samme dokument.
let ocrWorkerPromise = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('dan+eng').catch((err) => {
      ocrWorkerPromise = null; // tillad nyt forsøg ved næste billede
      throw err;
    });
  }
  return ocrWorkerPromise;
}

/** OCR'er tekst ud af et billede (jpg/png/webp osv.). */
async function extractImageText(filePath) {
  const worker = await getOcrWorker();
  const {
    data: { text },
  } = await worker.recognize(filePath);
  return text || '';
}

module.exports = { extractPdfText, extractImageText };
