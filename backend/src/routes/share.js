const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');

const router = express.Router();

// Bevidst UDEN requireAuth - det er hele pointen med et delelink. Beskyttelsen
// ligger i at token'en er lang og tilfældig (uigættelig), ikke i login.
router.get('/:token', (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(req.params.token);
  if (!link) return res.status(404).send('Dette link findes ikke, eller er blevet fjernet.');

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).send('Dette link er udløbet.');
  }

  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(link.asset_id);
  if (!asset) return res.status(404).send('Filen findes ikke længere.');

  const filePath = path.join(config.uploadDir, asset.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Filen findes ikke længere på serveren.');

  res.setHeader('Content-Type', asset.mime);
  res.setHeader('Content-Disposition', `inline; filename="${asset.original_name.replace(/[":]/g, '')}"`);
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
