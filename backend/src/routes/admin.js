const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/roles');
const { logEvent } = require('../utils/log');
const { generateThumbnail, generateVideoThumbnail } = require('../utils/thumbnail');
const { generateSvgThumbnail } = require('../utils/svgThumbnail');

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

  const missingThumbnails = db
    .prepare("SELECT COUNT(*) as c FROM assets WHERE has_thumbnail = 0 AND (mime LIKE 'image/%' OR mime LIKE 'video/%')")
    .get().c;

  res.json({
    database: { file: config.dbFile, size_bytes: dbSize, ok: true },
    storage_used_bytes: storageUsed,
    file_count: fileCount,
    user_count: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    disk,
    missing_thumbnails: missingThumbnails,
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

// Genererer thumbnails for assets der mangler en (fx importeret før
// thumbnail-funktionen fandtes, eller hvor generering fejlede oprindeligt).
// Rører ikke ved assets der allerede har en thumbnail.
router.post('/generate-missing-thumbnails', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const assets = db
      .prepare("SELECT * FROM assets WHERE has_thumbnail = 0 AND (mime LIKE 'image/%' OR mime LIKE 'video/%')")
      .all();

    let succeeded = 0;
    let failed = 0;

    for (const asset of assets) {
      const filePath = path.join(config.uploadDir, asset.filename);
      const thumbPath = path.join(config.uploadDir, `${asset.filename}.thumb.jpg`);
      if (!fs.existsSync(filePath)) {
        failed++;
        continue;
      }
      try {
        if (asset.mime === 'image/svg+xml') {
          const svgBuffer = fs.readFileSync(filePath);
          await generateSvgThumbnail(svgBuffer, thumbPath);
        } else if (asset.mime.startsWith('video/')) {
          await generateVideoThumbnail(filePath, thumbPath);
        } else {
          await generateThumbnail(filePath, thumbPath);
        }
        db.prepare('UPDATE assets SET has_thumbnail = 1 WHERE id = ?').run(asset.id);
        succeeded++;
      } catch (err) {
        console.error(`Thumbnail-generering fejlede for asset #${asset.id} (${asset.original_name}):`, err.message);
        failed++;
      }
    }

    logEvent(
      'generate_thumbnails',
      `${req.session.user.name} genererede manglende thumbnails: ${succeeded} lykkedes, ${failed} fejlede`,
      req.session.user.id
    );
    res.json({ total: assets.length, succeeded, failed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
