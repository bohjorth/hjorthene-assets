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

/**
 * Mapper Authentik-gruppemedlemskaber til en app-rolle. Returnerer NULL hvis
 * brugeren ikke er medlem af nogen af de konfigurerede grupper - det er op
 * til kalderen (auth-routen) at afvise login i det tilfælde, i stedet for at
 * give en "gratis" Viewer-adgang til alle der bare kan logge ind på Authentik.
 * ROLE_GROUP_EDITOR kan efterlades tom i .env hvis I ikke bruger den rolle
 * endnu - så er det bare aldrig et match.
 */
function mapRole(groups) {
  const list = (groups || []).map((g) => String(g).toLowerCase());
  const adminGroup = config.authentik.roleGroupAdmin?.trim().toLowerCase();
  const editorGroup = config.authentik.roleGroupEditor?.trim().toLowerCase();
  const viewerGroup = config.authentik.roleGroupViewer?.trim().toLowerCase();

  if (adminGroup && list.includes(adminGroup)) return 'admin';
  if (editorGroup && list.includes(editorGroup)) return 'editor';
  if (viewerGroup && list.includes(viewerGroup)) return 'viewer';
  return null;
}

module.exports = { getClient, newState, newNonce, mapRole };
