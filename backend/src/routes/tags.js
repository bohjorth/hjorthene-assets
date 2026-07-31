const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, COUNT(at.asset_id) as asset_count FROM tags t
       LEFT JOIN asset_tags at ON at.tag_id = t.id
       GROUP BY t.id ORDER BY t.name COLLATE NOCASE`
    )
    .all();
  res.json({ tags: rows });
});

router.post('/', requireAuth, requireRole('editor'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Navn er påkrævet' });
  const info = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name.trim());
  const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name.trim());
  res.json({ tag });
});

router.put('/:id', requireAuth, requireRole('editor'), (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ tag: db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireAuth, requireRole('editor'), (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
