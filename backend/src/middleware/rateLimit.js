// Simpel in-memory rate-limiter - ingen ny afhængighed, og tilstrækkelig til
// en enkelt-proces Node-app som denne. Nulstilles ved genstart, hvilket er en
// acceptabel afvejning for en intern virksomheds-app.
const attempts = new Map(); // key -> { count, firstAttemptAt }

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutter

/**
 * Tjekker og registrerer et login-forsøg for en given nøgle (typisk IP-adresse).
 * Returnerer { allowed: true } eller { allowed: false, retryAfterSeconds }.
 */
function checkRateLimit(key) {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  record.count++;
  if (record.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

/** Nulstiller tælleren for en nøgle - kaldes ved vellykket login. */
function resetRateLimit(key) {
  attempts.delete(key);
}

module.exports = { checkRateLimit, resetRateLimit };
