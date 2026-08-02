const path = require('path');
const config = require('../config');

// Modellen caches lokalt i backend/data/models/ ved første brug (kræver
// internetadgang den ene gang, ligesom Tesseract-sprogpakker og Chromium).
let transformersEnvConfigured = false;
function configureEnv() {
  if (transformersEnvConfigured) return;
  const { env } = require('@huggingface/transformers');
  env.cacheDir = path.join(config.dataDir, 'models');
  transformersEnvConfigured = true;
}

// Kontrolleret liste af mulige tags i stedet for fritekst-AI-beskrivelser -
// mere forudsigeligt, og giver os fuld kontrol over hvad der ender som tags
// på jeres assets. Engelsk bruges til selve CLIP-matchingen (modellen er
// primært trænet på engelsk og matcher bedst sådan), men det der gemmes og
// vises som tag er den danske oversættelse.
const CANDIDATES = [
  { en: 'a screenshot', da: 'skærmbillede' },
  { en: 'a logo', da: 'logo' },
  { en: 'a document with text', da: 'dokument' },
  { en: 'an invoice or receipt', da: 'kvittering' },
  { en: 'a menu', da: 'menukort' },
  { en: 'a certificate or diploma', da: 'certifikat' },
  { en: 'a chart or graph', da: 'diagram' },
  { en: 'a table with data', da: 'tabel' },
  { en: 'a photo of food', da: 'mad' },
  { en: 'a group of people', da: 'personer' },
  { en: 'a portrait of a person', da: 'portræt' },
  { en: 'a building or architecture', da: 'bygning' },
  { en: 'an outdoor landscape', da: 'udendørs' },
  { en: 'an indoor room', da: 'indendørs' },
  { en: 'a product photo', da: 'produktfoto' },
  { en: 'a map', da: 'kort' },
  { en: 'a presentation slide', da: 'præsentation' },
  { en: 'a business card', da: 'visitkort' },
  { en: 'an ID card or passport', da: 'id-dokument' },
  { en: 'a car or vehicle', da: 'køretøj' },
  { en: 'a computer or laptop', da: 'computer' },
  { en: 'a whiteboard with writing', da: 'tavle' },
  { en: 'a diagram or flowchart', da: 'flowdiagram' },
  { en: 'a sign or banner', da: 'skilt' },
  { en: 'an animal', da: 'dyr' },
  { en: 'nature or plants', da: 'natur' },
  { en: 'a construction site', da: 'byggeplads' },
  { en: 'an event or party', da: 'arrangement' },
  { en: 'a meeting or conference', da: 'møde' },
];

// Genbruger én model-instans for processens levetid (samme mønster som
// Chromium- og Tesseract-singletonerne) - indlæsning er relativt dyrt.
let classifierPromise = null;
function getClassifier() {
  if (!classifierPromise) {
    configureEnv();
    const { pipeline } = require('@huggingface/transformers');
    classifierPromise = pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32').catch((err) => {
      classifierPromise = null; // tillad nyt forsøg ved næste billede
      throw err;
    });
  }
  return classifierPromise;
}

/**
 * Foreslår op til `maxTags` danske tags for et billede, baseret på hvor godt
 * det matcher en fast liste af begreber. Returnerer tom liste ved enhver fejl
 * (manglende model, download-fejl, korrupt billede osv.) - AI-tagging er en
 * "nice to have" og må aldrig få selve uploadet til at fejle.
 */
async function suggestTags(imagePath, { maxTags = 3, minScore = 0.12 } = {}) {
  try {
    const classifier = await getClassifier();
    const labels = CANDIDATES.map((c) => c.en);
    const results = await classifier(imagePath, labels);

    const tags = [];
    for (const r of results) {
      if (tags.length >= maxTags || r.score < minScore) break;
      const match = CANDIDATES.find((c) => c.en === r.label);
      if (match) tags.push(match.da);
    }
    return tags;
  } catch (err) {
    console.error('AI-tagging fejlede, springer over:', err.message);
    return [];
  }
}

module.exports = { suggestTags };
