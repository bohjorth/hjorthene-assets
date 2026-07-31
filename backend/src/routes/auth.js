const express = require('express');
const { getClient, newState, newNonce, mapRole } = require('../auth/oidc');
const config = require('../config');
const db = require('../db');
const { logEvent } = require('../utils/log');

const router = express.Router();

router.get('/login', async (req, res, next) => {
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
  req.session.destroy(() => {
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
