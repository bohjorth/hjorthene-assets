const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Minimal express-session Store backed by better-sqlite3.
 * Erstatter connect-sqlite3, som afhænger af den ældre 'sqlite3'-pakke
 * og dens native bindings (som ofte mangler prebuilt binaries til nye
 * Node-versioner og derved crasher med "this.db.exec is not a function").
 */
class SqliteSessionStore extends session.Store {
  constructor({ dir, file = 'sessions.db', ttlSeconds = 60 * 60 * 24 * 7 }) {
    super();
    fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(path.join(dir, file));
    this.db.pragma('journal_mode = WAL');
    this.ttlSeconds = ttlSeconds;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        expires INTEGER NOT NULL,
        data TEXT NOT NULL
      );
    `);

    this._prune();
    this._pruneTimer = setInterval(() => this._prune(), 15 * 60 * 1000);
    this._pruneTimer.unref();
  }

  _prune() {
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  }

  get(sid, cb) {
    try {
      const row = this.db.prepare('SELECT data, expires FROM sessions WHERE sid = ?').get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) {
        this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sessionData, cb) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge ? sessionData.cookie.maxAge : this.ttlSeconds * 1000;
      const expires = Date.now() + maxAge;
      this.db
        .prepare(
          `INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data`
        )
        .run(sid, expires, JSON.stringify(sessionData));
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  touch(sid, sessionData, cb) {
    this.set(sid, sessionData, cb);
  }
}

module.exports = SqliteSessionStore;
