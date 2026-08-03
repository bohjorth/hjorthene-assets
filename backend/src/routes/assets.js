const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');
const archiver = require('archiver');
const db = require('../db');
const config = require('../config');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/roles');
const { categorize } = require('../utils/categorize');
const { logEvent } = require('../utils/log');
const { generateThumbnail, generateVideoThumbnail } = require('../utils/thumbnail');
const { generateSvgThumbnail } = require('../utils/svgThumbnail');
const { sanitizeSvgBuffer } = require('../utils/sanitizeSvg');
const { extractExif } = require('../utils/exif');
const { extractPdfText, extractImageText } = require('../utils/textExtract');
const { suggestTags } = require('../utils/aiTagging');
const { computePHash, hammingDistanceHex } = require('../utils/phash');

const PHASH_SIMILARITY_THRESHOLD = 8; // ud af 64 bits - lavere = strengere match

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
 * Udtrækker søgbar tekst (PDF direkte, eller billed-OCR). Returnerer en
 * promise (i modsætning til tidligere) så den kan indgå i Promise.allSettled
 * sammen med AI-tagging, hvilket lader os vide præcis hvornår ALT
 * baggrundsarbejde for et asset er færdigt (bruges til processing-flaget).
 */
async function extractTextTask(assetId, filePath, mimeType) {
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
}

function getOrCreateTagRow(name) {
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
}

/**
 * Foreslår og tilføjer tags automatisk via en selvhostet CLIP-model, HVIS
 * indstillingen ai_tagging_enabled er slået til. Returnerer en promise, se
 * extractTextTask ovenfor for hvorfor.
 */
async function aiTagTask(assetId, filePath) {
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
}

/**
 * Kører alt relevant baggrundsarbejde for et nyupload et asset (tekst-udtræk
 * og/eller AI-tagging), og sætter processing=1/0 omkring det, så frontenden
 * kan vise en "Analyserer…"-indikator mens det står på. Blokerer aldrig
 * selve upload-svaret - kaldes uden await fra upload-routen.
 */
function runBackgroundProcessing(assetId, filePath, mimeType) {
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const tasks = [];
  if (isImage || isPdf) tasks.push(extractTextTask(assetId, filePath, mimeType));
  if (isImage) tasks.push(aiTagTask(assetId, filePath));
  if (!tasks.length) return;

  db.prepare('UPDATE assets SET processing = 1 WHERE id = ?').run(assetId);
  Promise.allSettled(tasks).finally(() => {
    db.prepare('UPDATE assets SET processing = 0 WHERE id = ?').run(assetId);
  });
}

/** Finder eksisterende assets hvis phash ligner det angivne (nær-duplikater). */
function findSimilarAssets(phash, excludeAssetId) {
  if (!phash) return [];
  const candidates = db.prepare('SELECT id, original_name, phash FROM assets WHERE phash IS NOT NULL AND id != ?').all(excludeAssetId || -1);
  return candidates
    .map((c) => ({ id: c.id, name: c.original_name, distance: hammingDistanceHex(phash, c.phash) }))
    .filter((c) => c.distance <= PHASH_SIMILARITY_THRESHOLD)
    .sort((a, b) => a.distance - b.distance);
}

// --- Upload (Editor+) ---
router.post('/upload', requireAuth, requireRole('editor'), upload.array('files', 50), async (req, res, next) => {
  try {
    const folderId = req.body.folder_id ? parseInt(req.body.folder_id, 10) : null;
    const results = [];
    const duplicates = [];
    const rejected = [];

    const maxSizeSetting = db.prepare("SELECT value FROM settings WHERE key = 'max_upload_size_mb'").get();
    const maxSizeBytes = (maxSizeSetting?.value ? parseInt(maxSizeSetting.value, 10) : config.maxUploadSizeMb) * 1024 * 1024;

    for (const file of req.files) {
      const filePath = path.join(config.uploadDir, file.filename);

      if (file.size > maxSizeBytes) {
        fs.unlink(filePath, () => {});
        rejected.push({ name: file.originalname, reason: `Overskrider maks. uploadstørrelse (${Math.round(maxSizeBytes / 1024 / 1024)} MB)` });
        continue;
      }

      // SVG kan indeholde <script>/event-handlers - rens FØR vi beregner
      // sha256, så hash/dublet-tjek matcher det indhold der reelt serveres.
      const uploadMime = file.mimetype || mime.lookup(file.originalname) || 'application/octet-stream';
      if (uploadMime === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
        const cleaned = sanitizeSvgBuffer(fs.readFileSync(filePath));
        fs.writeFileSync(filePath, cleaned);
      }

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
      const isVideo = mimeType.startsWith('video/');

      let hasThumbnail = 0;
      if (mimeType === 'image/svg+xml') {
        try {
          const svgBuffer = fs.readFileSync(filePath);
          await generateSvgThumbnail(svgBuffer, path.join(config.uploadDir, `${file.filename}.thumb.jpg`));
          hasThumbnail = 1;
        } catch (err) {
          console.error(`SVG-thumbnail fejlede for ${file.originalname}:`, err.message);
        }
      } else if (isImage) {
        try {
          await generateThumbnail(filePath, path.join(config.uploadDir, `${file.filename}.thumb.jpg`));
          hasThumbnail = 1;
        } catch (err) {
          console.error(`Thumbnail-generering fejlede for ${file.originalname}:`, err.message);
        }
      } else if (isVideo) {
        try {
          await generateVideoThumbnail(filePath, path.join(config.uploadDir, `${file.filename}.thumb.jpg`));
          hasThumbnail = 1;
        } catch (err) {
          console.error(`Video-thumbnail fejlede for ${file.originalname} (mangler ffmpeg?):`, err.message);
        }
      }

      let exifJson = null;
      let phash = null;
      let similar = [];
      if (isImage) {
        const exifData = await extractExif(filePath);
        if (exifData) exifJson = JSON.stringify(exifData);
        phash = await computePHash(filePath);
        if (phash) similar = findSimilarAssets(phash, null);
      }

      const info = db
        .prepare(
          `INSERT INTO assets (filename, original_name, size, mime, category, sha256, folder_id, uploader_id, has_thumbnail, exif_json, phash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          exifJson,
          phash
        );

      const assetId = info.lastInsertRowid;
      const assetResult = assetWithTags(assetId);
      assetResult.similar = similar;
      results.push(assetResult);
      logEvent('upload', `${req.session.user.name} uploadede ${file.originalname}`, req.session.user.id);

      // Tekst-udtræk/AI-tagging kører i baggrunden - blokerer ikke svaret.
      runBackgroundProcessing(assetId, filePath, mimeType);
    }

    res.json({ assets: results, duplicates, rejected });
  } catch (err) {
    next(err);
  }
});

// --- List with search / filter / sort (Viewer+) ---
router.get('/', requireAuth, (req, res) => {
  const { q, folder_id, category, tag, type, sort = 'created_at', dir = 'desc', date_from, date_to, min_size, max_size } = req.query;

  let sql = `SELECT DISTINCT a.* FROM assets a`;
  const where = ['a.deleted_at IS NULL'];
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

// --- ZIP-download af flere assets ---
// Placeret FØR /:id-ruterne, ellers ville "zip" blive fortolket som et :id.
router.get('/zip', requireAuth, (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  if (!ids.length) return res.status(400).json({ error: 'Ingen assets valgt' });

  const placeholders = ids.map(() => '?').join(',');
  const assets = db.prepare(`SELECT * FROM assets WHERE id IN (${placeholders})`).all(...ids);
  if (!assets.length) return res.status(404).json({ error: 'Ingen assets fundet' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="hjorthene-assets-${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('ZIP-fejl:', err.message);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  const usedNames = new Set();
  for (const asset of assets) {
    const filePath = path.join(config.uploadDir, asset.filename);
    if (!fs.existsSync(filePath)) continue;

    // Undgå navnekollisioner inde i selve ZIP-filen (fx to filer der hedder "logo.png")
    let name = asset.original_name;
    let counter = 1;
    while (usedNames.has(name)) {
      const ext = path.extname(asset.original_name);
      const base = path.basename(asset.original_name, ext);
      name = `${base} (${counter})${ext}`;
      counter++;
    }
    usedNames.add(name);
    archive.file(filePath, { name });
  }

  archive.finalize();
  logEvent('download', `${req.session.user.name} downloadede ${assets.length} assets som ZIP`, req.session.user.id);
});

// --- Bulk: flyt flere assets til en mappe (Editor+) ---
router.post('/bulk/move', requireAuth, requireRole('editor'), (req, res) => {
  const { ids, folder_id } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Ingen assets valgt' });

  const move = db.prepare('UPDATE assets SET folder_id = ? WHERE id = ?');
  const tx = db.transaction((assetIds) => {
    for (const id of assetIds) move.run(folder_id || null, id);
  });
  tx(ids);

  logEvent('bulk_move', `${req.session.user.name} flyttede ${ids.length} assets`, req.session.user.id);
  res.json({ success: true, count: ids.length });
});

// --- Bulk: tilføj tag(s) til flere assets (Editor+) ---
router.post('/bulk/tag', requireAuth, requireRole('editor'), (req, res) => {
  const { ids, tags } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Ingen assets valgt' });
  if (!Array.isArray(tags) || !tags.length) return res.status(400).json({ error: 'Ingen tags angivet' });

  const link = db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)');
  const tx = db.transaction((assetIds, tagNames) => {
    const tagRows = tagNames.map((name) => getOrCreateTagRow(String(name).trim())).filter(Boolean);
    for (const assetId of assetIds) {
      for (const tagRow of tagRows) link.run(assetId, tagRow.id);
    }
  });
  tx(ids, tags);

  logEvent('bulk_tag', `${req.session.user.name} tilføjede tags (${tags.join(', ')}) til ${ids.length} assets`, req.session.user.id);
  res.json({ success: true, count: ids.length });
});

// --- Bulk: slet flere assets (Editor+) ---
router.post('/bulk/delete', requireAuth, requireRole('editor'), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Ingen assets valgt' });

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE assets SET deleted_at = datetime('now') WHERE id IN (${placeholders})`).run(...ids);

  logEvent('bulk_delete', `${req.session.user.name} flyttede ${ids.length} assets til papirkurven`, req.session.user.id);
  res.json({ success: true, count: ids.length });
});

// --- Bulk: gendan flere assets fra papirkurven (Editor+) ---
router.post('/bulk/restore', requireAuth, requireRole('editor'), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Ingen assets valgt' });

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE assets SET deleted_at = NULL WHERE id IN (${placeholders})`).run(...ids);

  logEvent('bulk_restore', `${req.session.user.name} gendannede ${ids.length} assets fra papirkurven`, req.session.user.id);
  res.json({ success: true, count: ids.length });
});

// --- Tøm hele papirkurven permanent (Admin only) ---
router.post('/trash/empty', requireAuth, requireRole('admin'), (req, res) => {
  const assets = db.prepare('SELECT * FROM assets WHERE deleted_at IS NOT NULL').all();

  for (const asset of assets) {
    fs.unlink(path.join(config.uploadDir, asset.filename), () => {});
    if (asset.has_thumbnail) {
      fs.unlink(path.join(config.uploadDir, `${asset.filename}.thumb.jpg`), () => {});
    }
  }
  db.prepare('DELETE FROM assets WHERE deleted_at IS NOT NULL').run();

  logEvent('empty_trash', `${req.session.user.name} tømte papirkurven (${assets.length} assets slettet permanent)`, req.session.user.id);
  res.json({ success: true, count: assets.length });
});

// --- Papirkurv: liste over soft-slettede assets ---
// Placeret FØR /:id-ruterne, ellers ville "trash" blive fortolket som et :id.
router.get('/trash', requireAuth, (req, res) => {
  const assets = db
    .prepare('SELECT * FROM assets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC')
    .all();
  res.json({ assets: assets.map((a) => assetWithTags(a.id)) });
});

// --- Detail ---
router.get('/:id', requireAuth, (req, res) => {
  const asset = assetWithTags(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  asset.similar = asset.phash ? findSimilarAssets(asset.phash, asset.id) : [];
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
  db.prepare("UPDATE assets SET deleted_at = datetime('now') WHERE id = ?").run(asset.id);
  logEvent('delete', `${req.session.user.name} flyttede ${asset.original_name} til papirkurven`, req.session.user.id);
  res.json({ success: true });
});

// --- Gendan et asset fra papirkurven (Editor+) ---
router.post('/:id/restore', requireAuth, requireRole('editor'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  db.prepare('UPDATE assets SET deleted_at = NULL WHERE id = ?').run(asset.id);
  logEvent('restore', `${req.session.user.name} gendannede ${asset.original_name} fra papirkurven`, req.session.user.id);
  res.json({ asset: assetWithTags(asset.id) });
});

// --- Slet permanent fra papirkurven (Admin only) ---
router.delete('/:id/permanent', requireAuth, requireRole('admin'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  const filePath = path.join(config.uploadDir, asset.filename);
  fs.unlink(filePath, () => {});
  if (asset.has_thumbnail) {
    fs.unlink(path.join(config.uploadDir, `${asset.filename}.thumb.jpg`), () => {});
  }
  db.prepare('DELETE FROM assets WHERE id = ?').run(asset.id);
  logEvent('permanent_delete', `${req.session.user.name} slettede ${asset.original_name} permanent`, req.session.user.id);
  res.json({ success: true });
});

// --- Versionshistorik ---
router.get('/:id/versions', requireAuth, (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
  const versions = db
    .prepare(
      `SELECT v.id, v.version_number, v.original_name, v.size, v.mime, v.created_at, u.name as uploader_name
       FROM asset_versions v LEFT JOIN users u ON u.id = v.uploader_id
       WHERE v.asset_id = ? ORDER BY v.version_number DESC`
    )
    .all(asset.id);
  res.json({ versions });
});

// --- Upload ny version af et eksisterende asset (Editor+) ---
// Den nuværende fil arkiveres som en version, og selve asset-rækken
// opdateres med den nye fil - id'et (og dermed URL'en) forbliver det samme.
router.post('/:id/versions', requireAuth, requireRole('editor'), upload.single('file'), async (req, res, next) => {
  try {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });
    if (!req.file) return res.status(400).json({ error: 'Ingen fil modtaget' });

    // Arkivér den nuværende fil som en version, FØR den overskrives
    const nextVersion = (db.prepare('SELECT MAX(version_number) as m FROM asset_versions WHERE asset_id = ?').get(asset.id).m || 0) + 1;
    db.prepare(
      `INSERT INTO asset_versions (asset_id, version_number, filename, original_name, size, mime, sha256, uploader_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(asset.id, nextVersion, asset.filename, asset.original_name, asset.size, asset.mime, asset.sha256, asset.uploader_id);
    // Den fysiske gamle fil beholdes på disk (bruges af versions-download-ruten) -
    // slettes IKKE her, kun ved sletning af hele asset'et.

    const newFilePath = path.join(config.uploadDir, req.file.filename);
    const uploadMime = req.file.mimetype || mime.lookup(req.file.originalname) || 'application/octet-stream';
    if (uploadMime === 'image/svg+xml' || req.file.originalname.toLowerCase().endsWith('.svg')) {
      const cleaned = sanitizeSvgBuffer(fs.readFileSync(newFilePath));
      fs.writeFileSync(newFilePath, cleaned);
    }
    const sha256 = await sha256File(newFilePath);
    const mimeType = req.file.mimetype || mime.lookup(req.file.originalname) || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');

    // Ryd op i den gamle thumbnail og lav en ny til den nye version
    if (asset.has_thumbnail) {
      fs.unlink(path.join(config.uploadDir, `${asset.filename}.thumb.jpg`), () => {});
    }
    let hasThumbnail = 0;
    if (mimeType === 'image/svg+xml') {
      try {
        const svgBuffer = fs.readFileSync(newFilePath);
        await generateSvgThumbnail(svgBuffer, path.join(config.uploadDir, `${req.file.filename}.thumb.jpg`));
        hasThumbnail = 1;
      } catch (err) { /* spring stille over */ }
    } else if (isImage) {
      try {
        await generateThumbnail(newFilePath, path.join(config.uploadDir, `${req.file.filename}.thumb.jpg`));
        hasThumbnail = 1;
      } catch (err) { /* spring stille over */ }
    } else if (isVideo) {
      try {
        await generateVideoThumbnail(newFilePath, path.join(config.uploadDir, `${req.file.filename}.thumb.jpg`));
        hasThumbnail = 1;
      } catch (err) { /* spring stille over */ }
    }

    let exifJson = null;
    let phash = null;
    if (isImage) {
      const exifData = await extractExif(newFilePath);
      if (exifData) exifJson = JSON.stringify(exifData);
      phash = await computePHash(newFilePath);
    }

    db.prepare(
      `UPDATE assets SET filename = ?, size = ?, mime = ?, sha256 = ?, has_thumbnail = ?, exif_json = ?,
       phash = ?, ocr_text = NULL, updated_at = datetime('now') WHERE id = ?`
    ).run(req.file.filename, req.file.size, mimeType, sha256, hasThumbnail, exifJson, phash, asset.id);

    logEvent('new_version', `${req.session.user.name} uploadede en ny version (v${nextVersion + 1}) af ${asset.original_name}`, req.session.user.id);
    runBackgroundProcessing(asset.id, newFilePath, mimeType);

    res.json({ asset: assetWithTags(asset.id) });
  } catch (err) {
    next(err);
  }
});

// --- Download en tidligere version ---
router.get('/:id/versions/:versionId/download', requireAuth, (req, res) => {
  const version = db.prepare('SELECT * FROM asset_versions WHERE id = ? AND asset_id = ?').get(req.params.versionId, req.params.id);
  if (!version) return res.status(404).json({ error: 'Version ikke fundet' });
  const filePath = path.join(config.uploadDir, version.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Filen findes ikke længere på disk' });
  res.download(filePath, version.original_name);
});

// --- Offentlige delelinks ---
router.get('/:id/share', requireAuth, (req, res) => {
  const links = db
    .prepare("SELECT * FROM share_links WHERE asset_id = ? AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY created_at DESC")
    .all(req.params.id);
  res.json({ links });
});

router.post('/:id/share', requireAuth, requireRole('editor'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset ikke fundet' });

  const { expires_in } = req.body; // '1d' | '7d' | '30d' | 'never'
  let expiresAt = null;
  const days = { '1d': 1, '7d': 7, '30d': 30 }[expires_in];
  if (days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    expiresAt = d.toISOString().slice(0, 19).replace('T', ' ');
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO share_links (asset_id, token, expires_at, created_by) VALUES (?, ?, ?, ?)').run(
    asset.id,
    token,
    expiresAt,
    req.session.user.id
  );

  logEvent('share_created', `${req.session.user.name} oprettede et delelink for ${asset.original_name}`, req.session.user.id);
  res.json({ token, expires_at: expiresAt, url: `${config.baseUrl}/api/share/${token}` });
});

router.delete('/:id/share/:linkId', requireAuth, requireRole('editor'), (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE id = ? AND asset_id = ?').get(req.params.linkId, req.params.id);
  if (!link) return res.status(404).json({ error: 'Link ikke fundet' });
  db.prepare('DELETE FROM share_links WHERE id = ?').run(link.id);
  logEvent('share_revoked', `${req.session.user.name} tilbagekaldte et delelink`, req.session.user.id);
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
