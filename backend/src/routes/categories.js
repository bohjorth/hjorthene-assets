const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/roles');
const { ALL_CATEGORIES } = require('../utils/categorize');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const counts = db
    .prepare('SELECT category, COUNT(*) as count FROM assets GROUP BY category')
    .all();
  const countMap = Object.fromEntries(counts.map((c) => [c.category, c.count]));
  const categories = ALL_CATEGORIES.map((name) => ({ name, count: countMap[name] || 0 }));
  res.json({ categories });
});

module.exports = router;
