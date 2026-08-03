const crypto = require('crypto');

/** Hasher et password til "salt:hash"-format, klar til at gemme i databasen. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Sammenligner et password mod et gemt "salt:hash"-værdi, tidskonstant. */
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const testHash = crypto.scryptSync(password, salt, 64);
    if (hashBuffer.length !== testHash.length) return false;
    return crypto.timingSafeEqual(hashBuffer, testHash);
  } catch (err) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
