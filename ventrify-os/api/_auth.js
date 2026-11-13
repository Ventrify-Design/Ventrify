/**
 * api/_auth.js — mint a real Firebase ID token for a SERVICE account, so server-side
 * code can call our own operator-gated handlers the way the browser does.
 *
 * WHY THIS EXISTS. `api/memo.js` gates every pre-screen phase on `verifyIdToken` plus
 * membership of the engagement's org. That gate is the product's authorisation model
 * and it is correct. The intake sweeper needs to run those same phases unattended —
 * and the two honest ways to do that are to punch a service-secret bypass through the
 * gate, or to give the sweeper a real identity and send it through the front door.
 *
 * This is the front door. The sweeper signs in as a named operator account that an
 * org has explicitly listed in `operatorEmails`, so revoking the sweeper's access is
 * the same gesture as revoking any colleague's: remove it from the org. A bypass
 * would have been less code and one more way in that nothing audits.
 *
 * Underscore-prefixed: Vercel does not count it as a function.
 *
 * Env: FIREBASE_WEB_API_KEY (optional — the key is public by design and already
 *      shipped in firebase/config.js, so the fallback below is not a secret leak).
 */

const admin = require('firebase-admin');

/* Firebase web API keys are public identifiers, not credentials: this exact string is
   served to every browser that loads the workspace. It is pinned here so the sweeper
   does not depend on reading a client file that Vercel's bundler has no reason to
   trace into a serverless function. */
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyAMSEW2YwLKZDFe9PUx1bEv8OUU1FPENcA';

/**
 * An ID token for `email`, by way of a custom token.
 *
 * The account must ALREADY EXIST and must already be an operator of the org whose work
 * it is about to do. Nothing here grants itself permission — a caller that could mint
 * its own access would stop exercising authorisation and start bypassing it.
 */
async function idTokenFor(email) {
  const user = await admin.auth().getUserByEmail(email);
  const custom = await admin.auth().createCustomToken(user.uid);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.idToken) throw new Error('token exchange failed: ' + JSON.stringify(d).slice(0, 200));
  return { idToken: d.idToken, uid: user.uid, email: user.email };
}

module.exports = { idTokenFor, WEB_API_KEY };
