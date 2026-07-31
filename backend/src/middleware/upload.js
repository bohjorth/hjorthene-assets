const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const config = require('../config');

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
  limits: { fileSize: config.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (config.allowedFileTypes === '*' || !config.allowedFileTypes) return cb(null, true);
    const allowed = config.allowedFileTypes.split(',').map((s) => s.trim().toLowerCase());
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Filtype .${ext} er ikke tilladt`));
  },
});

module.exports = upload;
