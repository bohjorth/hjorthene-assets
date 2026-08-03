const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/roles');
const { hashPassword } = require('../utils/password');
const { logEvent } = require('../utils/log');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const users = db
    .prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE is_local = 1 ORDER BY created_at DESC')
    .all();
  res.json({ users });
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Navn, email og password er påkrævet' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password skal være mindst 8 tegn' });
  }
  if (!['viewer', 'editor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ugyldig rolle' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Der findes allerede en bruger med den email' });

  const passwordHash = hashPassword(password);
  const sub = `local:${email}`;
  const info = db
    .prepare(
      `INSERT INTO users (sub, email, name, role, password_hash, is_local) VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(sub, email, name, role, passwordHash);

  logEvent('local_user_created', `${req.session.user.name} oprettede lokal test-bruger ${email} (${role})`, req.session.user.id);
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user });
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND is_local = 1').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Lokal bruger ikke fundet' });

  const { role, password } = req.body;
  if (role && !['viewer', 'editor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ugyldig rolle' });
  }
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id);
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password skal være mindst 8 tegn' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), target.id);
  }

  logEvent('local_user_updated', `${req.session.user.name} opdaterede lokal test-bruger ${target.email}`, req.session.user.id);
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(target.id);
  res.json({ user });
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND is_local = 1').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Lokal bruger ikke fundet' });

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  logEvent('local_user_deleted', `${req.session.user.name} slettede lokal test-bruger ${target.email}`, req.session.user.id);
  res.json({ success: true });
});

module.exports = router;
