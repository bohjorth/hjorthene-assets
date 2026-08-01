const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

router.put('/', requireAuth, requireRole('admin'), (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(req.body || {})) {
    upsert.run(key, String(value));
  }
  const rows = db.prepare('SELECT * FROM settings').all();
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

module.exports = router;
