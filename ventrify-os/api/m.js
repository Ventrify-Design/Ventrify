/**
 * GET /m/:token  (rewritten to /api/m?t=:token) — serve a shared deal memo.
 *
 * Piece 3 of the assessment artifact: a stable, forwardable link an operator hands
 * to their investment committee. The recipient has NO Ventrify account, so this
 * endpoint reads the FROZEN memo snapshot (created by /api/share-memo) via the
 * Admin SDK and returns it. Nothing in Firestore is publicly readable — the
 * unguessable token IS the access, like a "anyone with the link" doc. Revocable
 * (delete the sharedMemos doc) and versioned (a frozen copy of the run that made it).
 *
 * SECURITY — the stored HTML is operator-authored (their own memo), served from our
 * own origin. To make hosting it safe we return it under a strict CSP that forbids
 * ALL script execution (script-src falls back to default-src 'none'), so no stored
 * markup can run JS, steal auth state, or load remote resources. The memo is pure
 * inline-styled HTML with no scripts, so it renders fully under this policy.
 *
 * Env: FIREBASE_SERVICE_ACCOUNT (already set). No auth token required to read.
 */
const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

// Locked-down policy for operator-authored, publicly-linkable HTML on our origin.
const CSP = [
  "default-src 'none'",        // scripts, connects, frames, everything → blocked by default
  "style-src 'unsafe-inline'", // the memo's inline <style> + style="" attributes
  "img-src data: https:",      // no external images today, but future-proof safely
  "font-src data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex,nofollow"><title>${title}</title>`
    + `<style>html,body{margin:0;height:100%;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;background:#f3f4f6;color:#1a1a1a;}`
    + `.wrap{max-width:520px;margin:0 auto;padding:14vh 24px;text-align:center;}`
    + `h1{font-size:20px;letter-spacing:-0.01em;margin:0 0 8px;}p{color:#6b7280;font-size:14px;line-height:1.6;margin:0;}`
    + `.mk{width:38px;height:38px;border-radius:9px;background:#0036FF;margin:0 auto 18px;}</style></head><body>${body}</body></html>`;
}

function notFound(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).send(shell('Link unavailable', `<div class="wrap"><div class="mk"></div>`
    + `<h1>This shared assessment isn’t available</h1>`
    + `<p>The link may have been revoked, replaced by a newer version, or entered incorrectly. Ask whoever shared it for an up-to-date link.</p></div>`));
}

module.exports = async (req, res) => {
  try {
    const token = String((req.query && req.query.t) || '').trim();
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) { notFound(res); return; }

    ensureAdmin();
    const snap = await admin.firestore().collection('sharedMemos').doc(token).get();
    if (!snap.exists) { notFound(res); return; }

    const html = String(snap.data().html || '');
    if (!html) { notFound(res); return; }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    // no-store so a revoke takes effect immediately (no CDN/browser cache holding it).
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(html);
  } catch (e) {
    notFound(res);
  }
};
