// Mint a real Firebase ID token for a test operator, so a harness can call the deployed API the way the
// browser does. Read-only against the project's own credentials; no user is created or changed.
//
// WHY THIS EXISTS. Every gate written for the v2 pre-screen read source text. None of them sent a
// request, so none of them could notice that five new actions were missing from memo.js's ACTIONS
// whitelist — the handlers existed, were internally consistent, and were unreachable. Reading proves you
// wrote what you meant; only a request proves it runs.
import { readFile } from 'node:fs/promises';
import admin from 'firebase-admin';

/** .env.local stores the service account as a dotenv double-quoted value; Vercel stores raw JSON. */
export function parseServiceAccount(v) {
  const body = String(v).trim().replace(/^"|"$/g, '');
  let inStr = false, out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' && body[i - 1] !== '\\') { inStr = !inStr; out += c; continue; }
    // Outside a JSON string a backslash-n is structural whitespace; inside one it belongs to the
    // private key and must stay an escape. Stripping both parses cleanly and yields an unusable PEM.
    if (c === '\\' && body[i + 1] === 'n') { out += inStr ? '\\n' : '\n'; i++; continue; }
    out += c;
  }
  const sa = JSON.parse(out);
  if (sa.private_key && !sa.private_key.includes('\n')) throw new Error('private key lost its newlines');
  return sa;
}

const ROOT = new URL('../', import.meta.url);

export async function initAdmin() {
  if (admin.apps.length) return admin;
  const env = await readFile(new URL('.env.local', ROOT), 'utf8');
  const raw = (env.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m) || [])[1];
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT missing from .env.local');
  admin.initializeApp({ credential: admin.credential.cert(parseServiceAccount(raw)) });
  return admin;
}

/** The web API key is public by design and lives in the client config, not in .env.local. */
async function webApiKey() {
  const cfg = await readFile(new URL('firebase/config.js', ROOT), 'utf8');
  const m = cfg.match(/apiKey:\s*['"]([^'"]+)/);
  if (!m) throw new Error('no apiKey in firebase/config.js');
  return m[1];
}

/**
 * An ID token for `email`, by way of a custom token. The account must already exist and be an operator
 * of the org under test — the harness does not grant itself permissions, because a test that invents its
 * own access stops testing authorisation.
 */
export async function idTokenFor(email) {
  const a = await initAdmin();
  const user = await a.auth().getUserByEmail(email);
  const custom = await a.auth().createCustomToken(user.uid);
  const key = await webApiKey();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!r.ok || !d.idToken) throw new Error('token exchange failed: ' + JSON.stringify(d).slice(0, 200));
  return { idToken: d.idToken, uid: user.uid, email: user.email };
}
