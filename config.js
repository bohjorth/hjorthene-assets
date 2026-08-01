const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/roles');

const router = express.Router();

function withAssets(collectionId) {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  if (!collection) return null;
  const assets = db
    .prepare(
      `SELECT a.* FROM assets a JOIN collection_assets ca ON ca.asset_id = a.id WHERE ca.collection_id = ?`
    )
    .all(collectionId);
  return { ...collection, assets };
}

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM collections ORDER BY created_at DESC').all();
  const withCounts = rows.map((c) => ({
    ...c,
    asset_count: db.prepare('SELECT COUNT(*) as c FROM collection_assets WHERE collection_id = ?').get(c.id).c,
  }));
  res.json({ collections: withCounts });
});

router.get('/:id', requireAuth, (req, res) => {
  const collection = withAssets(req.params.id);
  if (!collection) return res.status(404).json({ error: 'Collection ikke fundet' });
  res.json({ collection });
});

router.post('/', requireAuth, requireRole('editor'), (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Navn er påkrævet' });
  const info = db
    .prepare('INSERT INTO collections (name, description, owner_id) VALUES (?, ?, ?)')
    .run(name.trim(), description || null, req.session.user.id);
  res.json({ collection: withAssets(info.lastInsertRowid) });
});

router.put('/:id', requireAuth, requireRole('editor'), (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE collections SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(
    name || null,
    description || null,
    req.params.id
  );
  res.json({ collection: withAssets(req.params.id) });
});

router.delete('/:id', requireAuth, requireRole('editor'), (req, res) => {
  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/assets', requireAuth, requireRole('editor'), (req, res) => {
  const { asset_id } = req.body;
  db.prepare('INSERT OR IGNORE INTO collection_assets (collection_id, asset_id) VALUES (?, ?)').run(
    req.params.id,
    asset_id
  );
  res.json({ collection: withAssets(req.params.id) });
});

router.delete('/:id/assets/:assetId', requireAuth, requireRole('editor'), (req, res) => {
  db.prepare('DELETE FROM collection_assets WHERE collection_id = ? AND asset_id = ?').run(
    req.params.id,
    req.params.assetId
  );
  res.json({ collection: withAssets(req.params.id) });
});

module.exports = router;
