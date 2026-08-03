const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/roles');
const { logEvent } = require('../utils/log');
const { normalizeSvg } = require('../utils/svg');
const { autoCropSvg } = require('../utils/svgCrop');
const { generateThumbnail } = require('../utils/thumbnail');
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
            buffer = normalizeSvg(Buffer.from(await response.arrayBuffer()));
            buffer = await autoCropSvg(buffer);
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
      const filePath = path.join(config.uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      let hasThumbnail = 0;
      try {
        await generateThumbnail(filePath, path.join(config.uploadDir, `${filename}.thumb.jpg`));
        hasThumbnail = 1;
      } catch (err) {
        console.error(`Thumbnail-generering fejlede for ${item.label}:`, err.message);
      }

      const info = db
        .prepare(
          `INSERT INTO assets (filename, original_name, size, mime, category, sha256, folder_id, uploader_id, has_thumbnail)
           VALUES (?, ?, ?, 'image/svg+xml', 'Billeder', ?, ?, ?, ?)`
        )
        .run(filename, item.filename, buffer.length, sha256, catFolder.id, req.session.user.id, hasThumbnail);

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

// Søger i HELE selfh.st/icons-biblioteket (7000+) via Iconifys offentlige API,
// som spejler samlingen under prefixet "selfhst". Kræver ingen API-nøgle.
router.get('/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ icons: [] });

  const url = `https://api.iconify.design/search?query=${encodeURIComponent(q)}&prefix=selfhst&limit=60`;
  try {
    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok) {
      console.error(`Iconify search fejlede (${response.status}):`, text.slice(0, 300));
      return res.status(502).json({ error: `Iconify API svarede med status ${response.status}` });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('Kunne ikke parse Iconify-svar som JSON:', text.slice(0, 300));
      return res.status(502).json({ error: 'Uventet svar fra Iconify API (ikke gyldig JSON)' });
    }

    const icons = (data.icons || []).map((full) => {
      const name = full.split(':')[1] || full;
      const label = name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return { name, label };
    });
    res.json({ icons });
  } catch (err) {
    console.error('Fejl ved kald til Iconify search API:', err.message);
    res.status(502).json({ error: `Kunne ikke kontakte Iconify API: ${err.message}` });
  }
});

// Importerer specifikt udvalgte ikoner (fra søgeresultatet). Lægges direkte i
// "App-ikoner" uden kategori-undermapper, da frit-søgte ikoner ikke matcher
// vores faste kategoriseringstaksonomi.
router.post('/icons', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const { icons } = req.body;
    if (!Array.isArray(icons) || !icons.length) {
      return res.status(400).json({ error: 'Ingen ikoner valgt' });
    }

    const rootFolder = findOrCreateFolder('App-ikoner', null);
    const selfhostedTag = getOrCreateTag('selfhosted');

    const imported = [];
    const skipped = [];
    const failed = [];

    for (const item of icons) {
      const name = String(item.name || '').trim();
      const label = item.label || name;
      if (!name) continue;

      let buffer = null;
      const urls = [
        `https://api.iconify.design/selfhst/${name}.svg`,
        `${CDN_BASE}/${name}.svg`,
      ];
      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            buffer = normalizeSvg(Buffer.from(await response.arrayBuffer()));
            buffer = await autoCropSvg(buffer);
            break;
          }
        } catch (err) {
          // prøv næste kilde
        }
      }

      if (!buffer) {
        failed.push(label);
        continue;
      }

      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const alreadyExists = db.prepare('SELECT id FROM assets WHERE sha256 = ?').get(sha256);
      if (alreadyExists) {
        skipped.push(label);
        continue;
      }

      const filename = `${crypto.randomBytes(8).toString('hex')}.svg`;
      const filePath = path.join(config.uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      let hasThumbnail = 0;
      try {
        await generateThumbnail(filePath, path.join(config.uploadDir, `${filename}.thumb.jpg`));
        hasThumbnail = 1;
      } catch (err) {
        console.error(`Thumbnail-generering fejlede for ${label}:`, err.message);
      }

      const info = db
        .prepare(
          `INSERT INTO assets (filename, original_name, size, mime, category, sha256, folder_id, uploader_id, has_thumbnail)
           VALUES (?, ?, ?, 'image/svg+xml', 'Billeder', ?, ?, ?, ?)`
        )
        .run(filename, `${name}.svg`, buffer.length, sha256, rootFolder.id, req.session.user.id, hasThumbnail);

      db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)').run(info.lastInsertRowid, selfhostedTag.id);
      imported.push(label);
    }

    logEvent(
      'import',
      `${req.session.user.name} importerede ${imported.length} ikoner via søgning (${skipped.length} sprunget over, ${failed.length} fejlede)`,
      req.session.user.id
    );

    res.json({
      importedCount: imported.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      imported,
      skipped,
      failed,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
