require('dotenv').config();
const path = require('path');

function req(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
  }
  return v;
}

module.exports = {
  port: parseInt(req('PORT', '4000'), 10),
  baseUrl: req('BASE_URL', 'http://localhost:4000'),
  sessionSecret: req('SESSION_SECRET', 'dev-secret-change-me'),
  devNoAuth: req('DEV_NO_AUTH', 'false') === 'true',

  uploadDir: path.resolve(req('UPLOAD_DIR', './uploads')),
  dataDir: path.resolve(req('DATA_DIR', './data')),
  maxUploadSizeMb: parseInt(req('MAX_UPLOAD_SIZE_MB', '500'), 10),
  allowedFileTypes: req('ALLOWED_FILE_TYPES', '*'),

  dbFile: path.resolve(req('DB_FILE', './data/hjorthene.db')),

  authentik: {
    issuerUrl: req('AUTHENTIK_ISSUER_URL', ''),
    clientId: req('AUTHENTIK_CLIENT_ID', ''),
    clientSecret: req('AUTHENTIK_CLIENT_SECRET', ''),
    redirectUri: req('AUTHENTIK_REDIRECT_URI', 'http://localhost:4000/auth/callback'),
    logoutRedirect: req('AUTHENTIK_LOGOUT_REDIRECT', 'http://localhost:4000/'),
    roleGroupAdmin: req('ROLE_GROUP_ADMIN', 'Admins'),
    roleGroupEditor: req('ROLE_GROUP_EDITOR', 'Editors'),
  },
};
