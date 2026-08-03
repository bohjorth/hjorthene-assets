const sharp = require('sharp');
const { execFile } = require('child_process');

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

/**
 * Genererer en thumbnail af et videoklip ved at trække ét frame ud via
 * ffmpeg (1 sekund inde i klippet, for at undgå helt sorte "fade in"-frames)
 * og derefter skalere det ligesom et almindeligt billede.
 *
 * Kræver at ffmpeg er installeret på serveren (apt install ffmpeg). Fejler
 * stille (kastes videre til kalderen, som allerede fanger fejl) hvis ffmpeg
 * mangler eller videoen ikke kan læses - thumbnailen springes bare over.
 */
function generateVideoThumbnail(inputPath, outputPath, size = 400) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', '1',
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', `scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=decrease`,
      '-q:v', '4',
      outputPath,
    ];
    execFile('ffmpeg', args, { timeout: 20000 }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { generateThumbnail, generateVideoThumbnail };
