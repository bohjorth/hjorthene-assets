const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const config = require('../config');
const db = require('../db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  // Multers egen filstørrelsesgrænse er en statisk sikkerhedslofte fra .env
  // (infrastruktur-niveau, kan ikke sænkes via UI'en). Den DB-styrede grænse
  // fra Indstillinger håndhæves separat, EFTER upload, se assets.js - multer
  // kan ikke tjekke filstørrelse dynamisk midt i en streaming-upload.
  limits: { fileSize: config.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Læses live fra databasen ved hver upload, IKKE fra en statisk .env-værdi
    // - ellers virker "Tilladte filtyper" i Indstillinger reelt ikke.
    let allowedFileTypes = '*';
    try {
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'allowed_file_types'").get();
      if (setting?.value) allowedFileTypes = setting.value;
    } catch (err) {
      // DB utilgængelig af en eller anden grund - fald tilbage til at tillade alt
      // frem for at blokere alle uploads.
    }

    if (allowedFileTypes === '*' || !allowedFileTypes.trim()) return cb(null, true);
    const allowed = allowedFileTypes.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Filtype .${ext} er ikke tilladt (se Indstillinger)`));
  },
});

module.exports = upload;
