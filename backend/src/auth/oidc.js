const { Issuer, generators } = require('openid-client');
const config = require('../config');

let client = null;

/**
 * Lazily discovers the Authentik OIDC issuer and builds a client.
 * Discovery happens once and is cached; if Authentik is temporarily
 * unreachable at boot, we retry on first login attempt instead of
 * crashing the whole server.
 */
async function getClient() {
  if (client) return client;
  if (!config.authentik.issuerUrl) {
    throw new Error('AUTHENTIK_ISSUER_URL is not configured');
  }
  const issuer = await Issuer.discover(config.authentik.issuerUrl);
  client = new issuer.Client({
    client_id: config.authentik.clientId,
    client_secret: config.authentik.clientSecret,
    redirect_uris: [config.authentik.redirectUri],
    response_types: ['code'],
  });
  return client;
}

function newState() {
  return generators.state();
}

function newNonce() {
  return generators.nonce();
}

/** Maps Authentik groups claim to an app role. */
function mapRole(groups) {
  const list = (groups || []).map((g) => String(g).toLowerCase());
  const adminGroup = config.authentik.roleGroupAdmin.toLowerCase();
  const editorGroup = config.authentik.roleGroupEditor.toLowerCase();
  if (list.includes(adminGroup)) return 'admin';
  if (list.includes(editorGroup)) return 'editor';
  return 'viewer';
}

module.exports = { getClient, newState, newNonce, mapRole };
