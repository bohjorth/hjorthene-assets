const exifr = require('exifr');

function pad(n) {
  return String(n).padStart(2, '0');
}

// Formaterer som "YYYY-MM-DD HH:MM:SS" - samme format som resten af databasens
// datoer (SQLite datetime('now')), så frontendens formatDate() kan læse den
// uden specialtilfælde.
function toDbDateString(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * exifr returnerer nogle gange DateTimeOriginal som et rigtigt Date-objekt,
 * andre gange (afhængig af hvilke felter der bedes om via `pick`) som den
 * rå EXIF-datostreng i formatet "YYYY:MM:DD HH:MM:SS" (bemærk kolon i
 * datodelen - IKKE gyldig ISO-syntaks). Denne funktion håndterer begge.
 */
function parseExifDate(value) {
  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  }
  return date && !isNaN(date.getTime()) ? date : null;
}

/**
 * Udtrækker et lille, nyttigt udvalg af EXIF-data frem for hele det rå
 * EXIF-blob (som kan indeholde meget vi ikke har brug for at gemme/vise).
 * Returnerer null hvis billedet ikke har EXIF-data, eller ved parse-fejl
 * (fx billeder uden EXIF, eller PNG'er der sjældent har det).
 */
async function extractExif(filePath) {
  try {
    const data = await exifr.parse(filePath, {
      gps: true,
      pick: ['Make', 'Model', 'DateTimeOriginal', 'latitude', 'longitude', 'Orientation'],
    });
    if (!data) return null;

    const result = {};
    if (data.Make) result.camera_make = String(data.Make).trim();
    if (data.Model) result.camera_model = String(data.Model).trim();
    if (data.DateTimeOriginal) {
      const date = parseExifDate(data.DateTimeOriginal);
      if (date) result.date_taken = toDbDateString(date);
    }
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      result.gps = { lat: data.latitude, lon: data.longitude };
    }

    return Object.keys(result).length ? result : null;
  } catch (err) {
    return null;
  }
}

module.exports = { extractExif };
