const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/roles');
const { logEvent } = require('../utils/log');
const CATALOG = require('../data/selfhostedIcons');

const router = express.Router();
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/selfhst/icons/svg';

function findOrCreateFolder(name, parentId) {
  const existing = parentId
    ? db.prepare('SELECT * FROM folders WHERE name = ? AND parent_id = ?').get(name, parentId)
    : db.prepare('SELECT * FROM folders WHERE name = ? AND parent_id IS NULL').get(name);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO folders (name, parent_id) VALUES (?, ?)').run(name, parentId || null);
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid);
}

function getOrCreateTag(name) {
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
}

// Oversigt over hvad importet indeholder, uden at hente noget endnu
router.get('/catalog', requireAuth, (req, res) => {
  const categories = {};
  for (const item of CATALOG) {
    (categories[item.category] = categories[item.category] || []).push(item.label);
  }
  res.json({ total: CATALOG.length, categories, source: 'https://selfh.st/icons', license: 'CC BY 4.0' });
});

// Kører selve importen (Editor+). Henter hvert ikon fra jsDelivr CDN og
// opretter det som et asset i mappen "App-ikoner/<kategori>".
router.post('/', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const rootFolder = findOrCreateFolder('App-ikoner', null);
    const selfhostedTag = getOrCreateTag('selfhosted');

    const imported = [];
    const skipped = [];
    const failed = [];

    for (const item of CATALOG) {
      let buffer = null;
      let matchedRef = null;

      for (const ref of item.refs) {
        try {
          const response = await fetch(`${CDN_BASE}/${ref}.svg`);
          if (response.ok) {
            buffer = Buffer.from(await response.arrayBuffer());
            matchedRef = ref;
            break;
          }
        } catch (err) {
          // prøv næste reference-navn
        }
      }

      if (!buffer) {
        failed.push(item.label);
        continue;
      }

      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const alreadyExists = db.prepare('SELECT id FROM assets WHERE sha256 = ?').get(sha256);
      if (alreadyExists) {
        skipped.push(item.label);
        continue;
      }

      const catFolder = findOrCreateFolder(item.category, rootFolder.id);
      const filename = `${crypto.randomBytes(8).toString('hex')}.svg`;
      fs.writeFileSync(path.join(config.uploadDir, filename), buffer);

      const info = db
        .prepare(
          `INSERT INTO assets (filename, original_name, size, mime, category, sha256, folder_id, uploader_id)
           VALUES (?, ?, ?, 'image/svg+xml', 'Billeder', ?, ?, ?)`
        )
        .run(filename, item.filename, buffer.length, sha256, catFolder.id, req.session.user.id);

      const catTag = getOrCreateTag(item.category);
      db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)').run(info.lastInsertRowid, selfhostedTag.id);
      db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)').run(info.lastInsertRowid, catTag.id);

      imported.push({ label: item.label, ref: matchedRef });
    }

    logEvent(
      'import',
      `${req.session.user.name} importerede ${imported.length} ikoner fra selfhosted-kataloget (${skipped.length} sprunget over, ${failed.length} ikke fundet)`,
      req.session.user.id
    );

    res.json({
      importedCount: imported.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      imported: imported.map((i) => i.label),
      skipped,
      failed,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
