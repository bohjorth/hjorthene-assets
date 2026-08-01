const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const { type, limit = 100 } = req.query;
  let sql = `SELECT l.*, u.name as user_name FROM logs l LEFT JOIN users u ON u.id = l.user_id`;
  const params = [];
  if (type) {
    sql += ' WHERE l.type = ?';
    params.push(type);
  }
  sql += ' ORDER BY l.created_at DESC LIMIT ?';
  params.push(parseInt(limit, 10));
  const rows = db.prepare(sql).all(...params);
  res.json({ logs: rows });
});

module.exports = router;
