CREATE TABLE IF NOT EXISTS assets
(
    id TEXT PRIMARY KEY,

    filename TEXT NOT NULL,

    original_name TEXT NOT NULL,

    extension TEXT,

    mime_type TEXT,

    size INTEGER,

    hash TEXT,

    created DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);