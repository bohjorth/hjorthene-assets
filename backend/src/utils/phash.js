const sharp = require('sharp');

/**
 * Beregner et "difference hash" (dHash) - en kompakt 64-bit signatur for et
 * billedes visuelle indhold. To billeder der ligner hinanden (samme foto i
 * anden opløsning, let beskåret, komprimeret igen osv.) får hashes med lille
 * indbyrdes Hamming-afstand, selvom deres SHA256 (som kun fanger 100% identisk
 * indhold) er helt forskellige.
 *
 * Metode: skalér til 9x8 gråtone-pixels, sammenlign hver pixel med sin
 * nabo til højre (lysere/mørkere = 1/0-bit). Ingen ekstra npm-afhængighed -
 * bruger sharp, som allerede er en del af projektet.
 */
async function computePHash(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!data || data.length < 72 || info.channels !== 1) return null;

    let bits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        bits += left < right ? '1' : '0';
      }
    }

    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.substr(i, 4), 2).toString(16);
    }
    return hex; // 16 hex-tegn = 64 bit
  } catch (err) {
    return null;
  }
}

/** Antal forskellige bits mellem to hex-hashes - lavere tal = mere ens. */
function hammingDistanceHex(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < hexA.length; i++) {
    let diff = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (diff) {
      dist += diff & 1;
      diff >>= 1;
    }
  }
  return dist;
}

module.exports = { computePHash, hammingDistanceHex };
