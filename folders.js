const db = require('../db');

function logEvent(type, message, userId = null) {
  db.prepare('INSERT INTO logs (type, message, user_id) VALUES (?, ?, ?)').run(type, message, userId);
}

module.exports = { logEvent };
