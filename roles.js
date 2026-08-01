const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  category TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  uploader_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_tags (
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_assets (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, asset_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
`);

// Default settings
const defaultSettings = {
  upload_path: config.uploadDir,
  allowed_file_types: '*',
  max_upload_size_mb: String(config.maxUploadSizeMb),
  branding_name: 'Hjorthene Assets',
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(defaultSettings)) insertSetting.run(k, v);

module.exports = db;
