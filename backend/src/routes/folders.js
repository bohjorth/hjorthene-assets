const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/roles');
const { logEvent } = require('../utils/log');

const router = express.Router();

// Full tree
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM folders ORDER BY name COLLATE NOCASE').all();
  res.json({ folders: rows });
});

router.post('/', requireAuth, requireRole('editor'), (req, res) => {
  const { name, parent_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Navn er påkrævet' });
  const info = db.prepare('INSERT INTO folders (name, parent_id) VALUES (?, ?)').run(name.trim(), parent_id || null);
  logEvent('folder_create', `${req.session.user.name} oprettede mappen "${name}"`, req.session.user.id);
  res.json({ folder: db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/:id', requireAuth, requireRole('editor'), (req, res) => {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Mappe ikke fundet' });
  const { name, parent_id } = req.body;
  db.prepare('UPDATE folders SET name = COALESCE(?, name), parent_id = ? WHERE id = ?').run(
    name || null,
    parent_id === undefined ? folder.parent_id : parent_id,
    folder.id
  );
  res.json({ folder: db.prepare('SELECT * FROM folders WHERE id = ?').get(folder.id) });
});

router.delete('/:id', requireAuth, requireRole('editor'), (req, res) => {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Mappe ikke fundet' });
  db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
  logEvent('folder_delete', `${req.session.user.name} slettede mappen "${folder.name}"`, req.session.user.id);
  res.json({ success: true });
});

module.exports = router;
