const express = require('express');
const session = require('express-session');
const SqliteSessionStore = require('./sessionStore');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./db'); // ensures schema is initialized

fs.mkdirSync(config.dataDir, { recursive: true });

const app = express();
app.set('trust proxy', 1); // vi kører bag nginx

app.use(cors({ origin: config.baseUrl, credentials: true }));
app.use(express.json());

// /api og /auth er dynamiske, per-bruger endpoints og må ALDRIG caches (hverken
// af browseren eller af en CDN som Cloudflare foran) - ellers kan én besøgendes
// session/OAuth-state lækkes til en anden. Sat eksplicit som ekstra sikkerhed,
// uanset hvordan Cloudflare selv er konfigureret.
app.use(['/api', '/auth'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use(
  session({
    store: new SqliteSessionStore({ dir: config.dataDir }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.baseUrl.startsWith('https'),
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dage
    },
  })
);

if (config.devNoAuth) {
  console.warn('⚠️  DEV_NO_AUTH er slået til - alle besøgende logges automatisk ind som test-admin. Brug KUN til test.');
  app.use((req, res, next) => {
    if (!req.session.user) {
      let user = db.prepare('SELECT * FROM users WHERE sub = ?').get('dev-local');
      if (!user) {
        const info = db
          .prepare('INSERT INTO users (sub, email, name, role, last_login_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
          .run('dev-local', 'dev@localhost', 'Dev Admin', 'admin');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      }
      req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    }
    next();
  });
}

app.use('/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/import/selfhosted', require('./routes/importSelfhosted'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fejlhåndtering
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message && err.message.includes('File too large')) {
    return res.status(413).json({ error: 'Filen er for stor' });
  }
  res.status(500).json({ error: err.message || 'Intern fejl' });
});

app.listen(config.port, () => {
  console.log(`Hjorthene Assets backend kører på port ${config.port}`);
});
