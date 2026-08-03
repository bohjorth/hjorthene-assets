const express = require('express');
const { getClient, newState, newNonce, mapRole } = require('../auth/oidc');
const config = require('../config');
const db = require('../db');
const { logEvent } = require('../utils/log');
const { verifyPassword } = require('../utils/password');
const { checkRateLimit, resetRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/login', async (req, res, next) => {
  if (config.devNoAuth) return res.redirect('/');
  try {
    const client = await getClient();
    const state = newState();
    const nonce = newNonce();
    req.session.oidcState = state;
    req.session.oidcNonce = nonce;
    const url = client.authorizationUrl({
      scope: 'openid profile email groups',
      state,
      nonce,
    });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

function accessDeniedPage(name) {
  return `<!doctype html>
<html lang="da"><head><meta charset="UTF-8"><title>Adgang nægtet - Hjorthene Assets</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fbedcf;
    display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #5c3a16; }
  .card { background: #fffcf4; border: 1px solid #e8d3a0; border-radius: 16px; padding: 40px 36px;
    max-width: 380px; text-align: center; box-shadow: 0 8px 24px rgba(92,58,22,0.14); }
  h1 { font-size: 18px; margin: 0 0 12px; }
  p { font-size: 13.5px; color: #93714a; line-height: 1.5; margin: 0 0 20px; }
  a { display: inline-block; background: #e8a33d; color: #3a2103; text-decoration: none; font-weight: 600;
    padding: 10px 20px; border-radius: 6px; font-size: 13px; }
</style></head>
<body>
  <div class="card">
    <h1>🦌 Adgang nægtet</h1>
    <p>${name ? `Hej ${name} - d` : 'D'}u er logget ind via Authentik, men er ikke medlem af en gruppe med adgang til Hjorthene Assets.
    Kontakt jeres administrator hvis du mener dette er en fejl.</p>
    <a href="/">Prøv igen</a>
  </div>
</body></html>`;
}

// Lokal login til test-brugere oprettet af en admin (se /api/admin/local-users).
// Helt uafhængig af Authentik - tænkt til test/nødadgang, ikke almindelig brug.
router.post('/local-login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email og password påkrævet' });

  const rateLimitKey = req.ip;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    logEvent('login_rate_limited', `For mange login-forsøg fra ${req.ip}`, null);
    return res.status(429).json({ error: `For mange forsøg. Prøv igen om ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minut(ter).` });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_local = 1').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    logEvent('login_failed', `Mislykket lokalt login-forsøg for ${email}`, null);
    return res.status(401).json({ error: 'Forkert email eller password' });
  }

  resetRateLimit(rateLimitKey);
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  logEvent('login', `${user.name} logged in (lokal test-bruger)`, user.id);
  res.json({ user: req.session.user });
});

router.get('/callback', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(config.authentik.redirectUri, params, {
      state: req.session.oidcState,
      nonce: req.session.oidcNonce,
    });
    const claims = tokenSet.claims();
    const role = mapRole(claims.groups);

    if (!role) {
      logEvent('access_denied', `${claims.name || claims.email || claims.sub} forsøgte at logge ind uden gyldigt gruppemedlemskab`, null);
      return res.status(403).send(accessDeniedPage(claims.name));
    }

    const existing = db.prepare('SELECT * FROM users WHERE sub = ?').get(claims.sub);
    let user;
    if (existing) {
      db.prepare(
        'UPDATE users SET email = ?, name = ?, role = ?, last_login_at = datetime(\'now\') WHERE id = ?'
      ).run(claims.email || existing.email, claims.name || existing.name, role, existing.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    } else {
      const info = db
        .prepare('INSERT INTO users (sub, email, name, role, last_login_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
        .run(claims.sub, claims.email || null, claims.name || claims.email || 'Unknown', role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }

    req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    logEvent('login', `${user.name} logged in`, user.id);
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  const user = req.session.user;
  if (user) logEvent('logout', `${user.name} logged out`, user.id);
  const wasLocalUser = user
    ? db.prepare('SELECT is_local FROM users WHERE id = ?').get(user.id)?.is_local === 1
    : false;
  req.session.destroy(() => {
    if (config.devNoAuth || wasLocalUser) return res.json({ logoutUrl: '/' });
    const issuer = config.authentik.issuerUrl.replace(/\/$/, '');
    const logoutUrl = `${issuer}/end-session/?redirect_uri=${encodeURIComponent(
      config.authentik.logoutRedirect
    )}`;
    res.json({ logoutUrl });
  });
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;
