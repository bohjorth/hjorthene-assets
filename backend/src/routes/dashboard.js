const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const totalAssets = db.prepare('SELECT COUNT(*) as c FROM assets').get().c;
  const totalSize = db.prepare('SELECT COALESCE(SUM(size),0) as s FROM assets').get().s;
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM assets GROUP BY category').all();
  const recentUploads = db
    .prepare('SELECT id, original_name, size, mime, category, created_at FROM assets ORDER BY created_at DESC LIMIT 10')
    .all();

  res.json({
    total_assets: totalAssets,
    storage_used_bytes: totalSize,
    assets_by_category: byCategory,
    recent_uploads: recentUploads,
  });
});

module.exports = router;
