const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/roles');
const { logEvent } = require('../utils/log');

const router = express.Router();

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

router.get('/status', requireAuth, requireRole('admin'), (req, res) => {
  const fileCount = db.prepare('SELECT COUNT(*) as c FROM assets').get().c;
  const dbSize = fs.existsSync(config.dbFile) ? fs.statSync(config.dbFile).size : 0;
  const storageUsed = dirSize(config.uploadDir);

  // Reel disk-plads på den partition uploads-mappen ligger på (ikke kun
  // størrelsen af selve uploads-mappen) - så vi kan advare FØR disken er fuld.
  let disk = null;
  try {
    const stats = fs.statfsSync(config.uploadDir);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    disk = {
      total_bytes: totalBytes,
      free_bytes: freeBytes,
      used_bytes: usedBytes,
      used_percent: totalBytes ? Math.round((usedBytes / totalBytes) * 100) : 0,
    };
  } catch (err) {
    // fs.statfsSync findes ikke på alle platforme/Node-versioner - fald tilbage til null
    disk = null;
  }

  res.json({
    database: { file: config.dbFile, size_bytes: dbSize, ok: true },
    storage_used_bytes: storageUsed,
    file_count: fileCount,
    user_count: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    disk,
  });
});

router.post('/backup', requireAuth, requireRole('admin'), (req, res) => {
  const backupDir = path.join(config.dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `hjorthene-${stamp}.db`);
  fs.copyFileSync(config.dbFile, target);
  logEvent('backup', `${req.session.user.name} tog en database-backup`, req.session.user.id);
  res.json({ success: true, file: target });
});

module.exports = router;
