const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');
const db = require('../db');
const config = require('../config');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/roles');
const { categorize } = require('../utils/categorize');
const { logEvent } = require('../utils/log');
const { generateThumbnail } = require('../utils/thumbnail');
const { extractExif } = require('../utils/exif');
const { extractPdfText, extractImageText } = require('../utils/textExtract');
const { suggestTags } = require('../utils/aiTagging');

const router = express.Router();

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function assetWithTags(assetId) {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
  if (!asset) return null;
  const tags = db
    .prepare('SELECT t.id, t.name FROM tags t JOIN asset_tags at ON at.tag_id = t.id WHERE at.asset_id = ?')
    .all(assetId);
  let exif = null;
  if (asset.exif_json) {
    try {
      exif = JSON.parse(asset.exif_json);
    } catch (e) {
      exif = null;
    }
  }
  return { ...asset, tags, exif };
}

/**
 * Kører tekst-udtræk (PDF-tekst eller billed-OCR) i baggrunden EFTER svaret
 * er sendt til klienten, så store filer ikke gør uploadet langsomt. Opdaterer
 * asset-rækken med resultatet når den er klar. Fejler stille (logges kun) -
 * manglende tekst-udtræk må aldrig ødelægge selve uploadet.
 */
function extractTextInBackground(assetId, filePath, mimeType) {
  (async () => {
    try {
      let text = null;
      if (mimeType === 'application/pdf') {
        text = await extractPdfText(filePath);
      } else if (mimeType.startsWith('image/')) {
        text = await extractImageText(filePath);
      }
      if (text && text.trim()) {
        db.prepare('UPDATE assets SET ocr_text = ? WHERE id = ?').run(text.trim().slice(0, 20000), assetId);
      }
    } catch (err) {
      console.error(`Tekst-udtræk fejlede for asset #${assetId}:`, err.message);
    }
  })();
}

function getOrCreateTagRow(name) {
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
}

/**
 * Foreslår og tilføjer tags automatisk via en selvhostet CLIP-model, HVIS
 * indstillingen ai_tagging_enabled er slået til. Kører i baggrunden ligesom
 * tekst-udtræk - blokerer aldrig selve uploadet, og fejler stille.
 */
function aiTagInBackground(assetId, filePath) {
  (async () => {
    try {
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'ai_tagging_enabled'").get();
      if (!setting || setting.value !== 'true') return;

      const suggested = await suggestTags(filePath);
      if (!suggested.length) return;

      const aiMarkerTag = getOrCreateTagRow('ai-foreslået');
      db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)').run(assetId, aiMarkerTag.id);
      for (const label of suggested) {
        const tagRow = getOrCreateTagRow(label);
        db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)').run(assetId, tagRow.id);
      }
      logEvent('ai_tag', `AI foreslog tags for asset #${assetId}: ${suggested.join(', ')}`, null);
    } catch (err) {
      console.error(`AI-tagging fejlede for asset #${assetId}:`, err.message);
    }
  })();
}

// --- Upload (Editor+) ---
router.post('/upload', requireAuth, requireRole('editor'), upload.array('files', 50), async (req, res, next) => {
  try {
    const folderId = req.body.folder_id ? parseInt(req.body.folder_id, 10) : null;
    const results = [];
    const duplicates = [];

    for (const file of req.files) {
      const filePath = path.join(config.uploadDir, file.filename);
      const sha256 = await sha256File(filePath);

      // Dubletdetektion: samme indhold er allerede uploadet tidligere.
      const existing = db.prepare('SELECT id, original_name FROM assets WHERE sha256 = ?').get(sha256);
      if (existing) {
        fs.unlink(filePath, () => {}); // fjern den lige uploadede fysiske kopi igen
        duplicates.push({ name: file.originalname, existing_id: existing.id, existing_name: existing.original_name });
        continue;
      }

      const mimeType = file.mimetype || mime.lookup(file.originalname) || 'application/octet-stream';
      const category = categorize(mimeType, file.originalname);
      const isImage = mimeType.startsWith('image/');

      let hasThumbnail = 0;
      if (isImage) {
        try {
          await generateThumbnail(filePath, path.join(config.uploadDir, `${file.filename}.thumb.jpg`));
          hasThumbnail = 1;
        } catch (err) {
          console.error(`Thumbnail-generering fejlede for ${file.originalname}:`, err.message);
        }
      }

      let exifJson = null;
      if (isImage) {
        const exifData = await extractExif(filePath);
        if (exifData) exifJson = JSON.stringify(exifData);
      }

      const info = db
        .prepare(
          `INSERT INTO assets (filename, original_name, size, mime, category, sha256, folder_id, uploader_id, has_thumbnail, exif_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          file.filename,
          file.originalname,
          file.size,
          mimeType,
          category,
          sha256,
          folderId,
          req.session.user.id,
          hasThumbnail,
          exifJson
        );

      const assetId = info.lastInsertRowid;
      results.push(assetWithTags(assetId));
      logEvent('upload', `${req.session.user.name} uploadede ${file.originalname}`, req.session.user.id);

      // PDF-tekst/OCR kører i baggrunden - blokerer ikke svaret.
      extractTextInBackground(assetId, filePath, mimeType);
      if (isImage) aiTagInBackground(assetId, filePath);
    }

    res.json({ assets: results, duplicates });
  } catch (err) {
    next(err);
  }
});

// --- List with search / filter / sort (Viewer+) ---
router.get('/', requireAuth, (req, res) => {
  const { q, folder_id, category, tag, type, sort = 'created_at', dir = 'desc', date_from, date_to, min_size, max_size } = req.query;

  let sql = `SELECT DISTINCT a.* FROM assets a`;
  const where = [];
  const params = [];

  if (tag) {
    sql += ` JOIN asset_tags at ON at.asset_id = a.id JOIN tags t ON t.id = at.tag_id`;
    where.push('t.name = ?');
    params.push(tag);
  }
  if (q) {
    sql += ` LEFT JOIN asset_tags qat ON qat.asset_id = a.id LEFT JOIN tags qt ON qt.id = qat.tag_id`;
    where.push('(a.original_name LIKE ? OR qt.name LIKE ? OR a.category LIKE ? OR a.mime LIKE ? OR a.ocr_text LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (folder_id) {
    where.push('a.folder_id = ?');
    params.push(folder_id);
  }
  if (category) {
    where.push('a.category = ?');
    params.push(category);
  }
  if (type) {
    where.push('a.mime LIKE ?');
    params.push(`${type}%`);
  }
  if (date_from) {
    where.push('a.created_at >= ?');
    params.push(date_from);
  }
  if (date_to) {
    where.push('a.created_at <= ?');
    params.push(date_to);
  }
  if (min_size) {
    where.push('a.size >= ?');
    params.push(parseInt(min_size, 10));
  }
  if (max_size) {
    where.push('a.size <= ?');
    params.push(parseInt(max_size, 10));
  }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');

  const sortCol = ['name', 'created_at', 'size', 'category'].includes(sort)
    ? sort === 'name'
      ? 'a.original_name'
      : `a.${sort}`
    : 'a.created_at';
  const sortDir = dir === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortCol} ${sortDir}`;

  const rows = db.prepare(sql).all(...params);
  const withTags = rows.map((a) => assetWithTags(a.id));
  res.json({ assets: withTags });
});

// --- Detail ---
router.get('/:id', requireAuth, (req, res) => {
  const asset = assetWithTags(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  res.json({ asset });
});

// --- Update metadata (Editor+) ---
router.put('/:id', requireAuth, requireRole('editor'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });

  const { original_name, category, folder_id, tags } = req.body;
  db.prepare(
    `UPDATE assets SET original_name = COALESCE(?, original_name), category = COALESCE(?, category),
     folder_id = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(original_name || null, category || null, folder_id ?? asset.folder_id, asset.id);

  if (Array.isArray(tags)) {
    db.prepare('DELETE FROM asset_tags WHERE asset_id = ?').run(asset.id);
    const getOrCreateTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const link = db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)');
    for (const name of tags) {
      const trimmed = String(name).trim();
      if (!trimmed) continue;
      getOrCreateTag.run(trimmed);
      const tagRow = findTag.get(trimmed);
      link.run(asset.id, tagRow.id);
    }
  }
  logEvent('edit', `${req.session.user.name} redigerede asset #${asset.id}`, req.session.user.id);
  res.json({ asset: assetWithTags(asset.id) });
});

// --- Delete (Editor+) ---
router.delete('/:id', requireAuth, requireRole('editor'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  const filePath = path.join(config.uploadDir, asset.filename);
  fs.unlink(filePath, () => {});
  if (asset.has_thumbnail) {
    fs.unlink(path.join(config.uploadDir, `${asset.filename}.thumb.jpg`), () => {});
  }
  db.prepare('DELETE FROM assets WHERE id = ?').run(asset.id);
  logEvent('delete', `${req.session.user.name} slettede ${asset.original_name}`, req.session.user.id);
  res.json({ success: true });
});

// --- Download ---
router.get('/:id/download', requireAuth, (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  const filePath = path.join(config.uploadDir, asset.filename);
  res.download(filePath, asset.original_name);
});

// --- Thumbnail (mindre, hurtigere version til grid-visning) ---
router.get('/:id/thumbnail', requireAuth, (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });

  if (asset.has_thumbnail) {
    const thumbPath = path.join(config.uploadDir, `${asset.filename}.thumb.jpg`);
    if (fs.existsSync(thumbPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      return fs.createReadStream(thumbPath).pipe(res);
    }
  }

  // Fallback: ingen thumbnail (fx uploadet før denne funktion fandtes) - brug originalen.
  const filePath = path.join(config.uploadDir, asset.filename);
  res.setHeader('Content-Type', asset.mime);
  fs.createReadStream(filePath).pipe(res);
});

// --- Inline preview (images/pdf/video/audio) ---
router.get('/:id/preview', requireAuth, (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  const filePath = path.join(config.uploadDir, asset.filename);
  res.setHeader('Content-Type', asset.mime);
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
