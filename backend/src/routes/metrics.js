const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');

const router = express.Router();

/**
 * Prometheus text exposition format - ingen prom-client-afhængighed
 * nødvendig, formatet er simpelt nok til at skrive i hånden. Ikke
 * beskyttet af requireAuth, da Prometheus-scraping ikke nemt kan lave
 * en OAuth-login - begræns i stedet adgangen via nginx (kun internt netværk)
 * hvis I vil have ekstra beskyttelse, se README.
 */
router.get('/', (req, res) => {
  const assetCount = db.prepare('SELECT COUNT(*) as c FROM assets WHERE deleted_at IS NULL').get().c;
  const trashCount = db.prepare('SELECT COUNT(*) as c FROM assets WHERE deleted_at IS NOT NULL').get().c;
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const activeShareLinks = db
    .prepare("SELECT COUNT(*) as c FROM share_links WHERE expires_at IS NULL OR expires_at > datetime('now')")
    .get().c;
  const storageBytes = db.prepare('SELECT COALESCE(SUM(size),0) as s FROM assets WHERE deleted_at IS NULL').get().s;
  const processingCount = db.prepare('SELECT COUNT(*) as c FROM assets WHERE processing = 1').get().c;
  const missingThumbnails = db
    .prepare("SELECT COUNT(*) as c FROM assets WHERE has_thumbnail = 0 AND deleted_at IS NULL AND (mime LIKE 'image/%' OR mime LIKE 'video/%')")
    .get().c;
  const versionCount = db.prepare('SELECT COUNT(*) as c FROM asset_versions').get().c;
  const loginFailures1h = db
    .prepare("SELECT COUNT(*) as c FROM logs WHERE type IN ('login_failed','login_rate_limited') AND created_at > datetime('now', '-1 hour')")
    .get().c;

  // Tidsstempel for seneste vellykkede backup - baseret på nyeste fil i
  // backups-mappen (både manuel "Tag backup nu" og den automatiske
  // systemd-timer lander her). 0 hvis ingen backup er taget endnu, hvilket
  // giver en tydelig alarm i Grafana ("evighed siden sidste backup").
  let lastBackupTimestamp = 0;
  try {
    const backupDir = path.join(config.dataDir, 'backups');
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
    for (const f of files) {
      const mtime = fs.statSync(path.join(backupDir, f)).mtimeMs / 1000;
      if (mtime > lastBackupTimestamp) lastBackupTimestamp = mtime;
    }
  } catch (err) {
    // backups-mappen findes ikke endnu - ingen backup taget
  }

  let diskTotal = 0;
  let diskFree = 0;
  try {
    const stats = fs.statfsSync(config.uploadDir);
    diskTotal = stats.blocks * stats.bsize;
    diskFree = stats.bfree * stats.bsize;
  } catch (err) {
    // ikke understøttet på alle platforme - springes over
  }

  const categoryRows = db
    .prepare('SELECT category, COUNT(*) as c FROM assets WHERE deleted_at IS NULL GROUP BY category')
    .all();

  const lines = [
    '# HELP hjorthene_assets_total Antal aktive assets (ikke i papirkurv)',
    '# TYPE hjorthene_assets_total gauge',
    `hjorthene_assets_total ${assetCount}`,
    '',
    '# HELP hjorthene_trash_assets_total Antal assets i papirkurven',
    '# TYPE hjorthene_trash_assets_total gauge',
    `hjorthene_trash_assets_total ${trashCount}`,
    '',
    '# HELP hjorthene_users_total Antal registrerede brugere',
    '# TYPE hjorthene_users_total gauge',
    `hjorthene_users_total ${userCount}`,
    '',
    '# HELP hjorthene_share_links_active Antal aktive offentlige delelinks',
    '# TYPE hjorthene_share_links_active gauge',
    `hjorthene_share_links_active ${activeShareLinks}`,
    '',
    '# HELP hjorthene_storage_bytes Samlet lagerforbrug for assets i bytes',
    '# TYPE hjorthene_storage_bytes gauge',
    `hjorthene_storage_bytes ${storageBytes}`,
    '',
    '# HELP hjorthene_disk_total_bytes Total diskplads på uploads-partitionen',
    '# TYPE hjorthene_disk_total_bytes gauge',
    `hjorthene_disk_total_bytes ${diskTotal}`,
    '',
    '# HELP hjorthene_disk_free_bytes Ledig diskplads på uploads-partitionen',
    '# TYPE hjorthene_disk_free_bytes gauge',
    `hjorthene_disk_free_bytes ${diskFree}`,
    '',
    '# HELP hjorthene_assets_by_category Antal assets pr. kategori',
    '# TYPE hjorthene_assets_by_category gauge',
    ...categoryRows.map((r) => `hjorthene_assets_by_category{category="${r.category}"} ${r.c}`),
    '',
    '# HELP hjorthene_processing_assets Antal assets der lige nu koeres igennem OCR/AI-tagging i baggrunden',
    '# TYPE hjorthene_processing_assets gauge',
    `hjorthene_processing_assets ${processingCount}`,
    '',
    '# HELP hjorthene_missing_thumbnails Antal billeder/videoer der mangler en thumbnail',
    '# TYPE hjorthene_missing_thumbnails gauge',
    `hjorthene_missing_thumbnails ${missingThumbnails}`,
    '',
    '# HELP hjorthene_asset_versions_total Samlet antal gemte tidligere versioner (paa tvaers af alle assets)',
    '# TYPE hjorthene_asset_versions_total gauge',
    `hjorthene_asset_versions_total ${versionCount}`,
    '',
    '# HELP hjorthene_login_failures_1h Mislykkede login-forsoeg (lokalt login) seneste time',
    '# TYPE hjorthene_login_failures_1h gauge',
    `hjorthene_login_failures_1h ${loginFailures1h}`,
    '',
    '# HELP hjorthene_backup_last_success_timestamp_seconds Unix-tid for seneste succesfulde backup (0 = aldrig)',
    '# TYPE hjorthene_backup_last_success_timestamp_seconds gauge',
    `hjorthene_backup_last_success_timestamp_seconds ${Math.floor(lastBackupTimestamp)}`,
    '',
    '# HELP hjorthene_process_uptime_seconds Hvor laenge Node-processen har koert',
    '# TYPE hjorthene_process_uptime_seconds gauge',
    `hjorthene_process_uptime_seconds ${Math.floor(process.uptime())}`,
    '',
    '# HELP hjorthene_process_memory_bytes Node-processens hukommelsesforbrug (RSS)',
    '# TYPE hjorthene_process_memory_bytes gauge',
    `hjorthene_process_memory_bytes ${process.memoryUsage().rss}`,
    '',
  ];

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n'));
});

module.exports = router;
