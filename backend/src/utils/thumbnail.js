const sharp = require('sharp');

/**
 * Genererer en JPEG-thumbnail (max size x size, bevarer proportioner) af et
 * billede. Bruger .rotate() uden argumenter, som auto-orienterer efter EXIF
 * Orientation-tag - ellers ville billeder taget "på siden" med en telefon
 * vise forkert i grid-visningen.
 */
async function generateThumbnail(inputPath, outputPath, size = 400) {
  await sharp(inputPath)
    .rotate()
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outputPath);
}

module.exports = { generateThumbnail };
