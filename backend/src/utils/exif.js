const exifr = require('exifr');

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
      result.date_taken = data.DateTimeOriginal.toISOString
        ? data.DateTimeOriginal.toISOString()
        : String(data.DateTimeOriginal);
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
