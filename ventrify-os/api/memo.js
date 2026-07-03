/**
 * /api/memo — the shareable deal memo + operator sign-off (Track A · Piece 3).
 *
 * One function (to fit the Vercel plan's serverless-function budget) with two modes:
 *
 *   GET  /m/:token  (rewritten to /api/memo?t=:token)   — PUBLIC, no auth.
 *        Serves the FROZEN memo snapshot (created by a POST share) under a strict CSP
 *        that forbids ALL scripts, so operator-authored HTML can't run JS on our origin.
 *        The unguessable token IS the access; nothing in Firestore is publicly readable.
 *
 *   POST /api/memo   { idToken, engagementId, action, ... }  — OPERATOR-gated.
 *        action='share'        freeze `html` at the engagement's STABLE token (reuse if
 *                              it has one → refresh in place; mint on first share).
 *        action='revoke-share' delete the snapshot + clear the link.
 *        action='sign'         stamp an operator endorsement (identity from the VERIFIED
 *                              token, never client input; founders excluded).
 *        action='revoke-sign'  clear the endorsement.
 *
 * A Firestore rule blocks clients from writing assessmentSignoff/shareLink directly, so
 * these Admin-SDK writes are the only path — a founder can't forge either.
 * Env: FIREBASE_SERVICE_ACCOUNT (already set).
 */
const admin = require('firebase-admin');
const crypto = require('crypto');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const MAX_HTML = 900 * 1024;   // stay safely under Firestore's 1MB doc ceiling

// ---- GET: serve a frozen memo (public, no-script CSP) ------------------------
const CSP = [
  "default-src 'none'",        // scripts, connects, frames, everything → blocked by default
  "style-src 'unsafe-inline'", // the memo's inline <style> + style="" attributes
  "img-src data: https:",
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

function serveNotFound(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).send(shell('Link unavailable', `<div class="wrap"><div class="mk"></div>`
    + `<h1>This shared assessment isn’t available</h1>`
    + `<p>The link may have been revoked, replaced by a newer version, or entered incorrectly. Ask whoever shared it for an up-to-date link.</p></div>`));
}

async function serveMemo(req, res) {
  try {
    const token = String((req.query && req.query.t) || '').trim();
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) { serveNotFound(res); return; }
    ensureAdmin();
    const snap = await admin.firestore().collection('sharedMemos').doc(token).get();
    if (!snap.exists) { serveNotFound(res); return; }
    const html = String(snap.data().html || '');
    if (!html) { serveNotFound(res); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'private, no-store');   // so a revoke takes effect immediately
    res.status(200).send(html);
  } catch (e) {
    serveNotFound(res);
  }
}

// ---- POST: operator-gated management ----------------------------------------
module.exports = async (req, res) => {
  if (req.method === 'GET') { await serveMemo(req, res); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const action = String(body.action || '');
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }
    const ACTIONS = ['share', 'revoke-share', 'sign', 'revoke-sign'];
    if (!ACTIONS.includes(action)) { res.status(400).json({ error: 'bad_action' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    if (!caller) { res.status(401).json({ error: 'no_token' }); return; }

    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const engRef = db.collection('engagements').doc(engagementId);
    const engSnap = await engRef.get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const engData = engSnap.data();
    const orgId = engData.orgId || 'default';

    // Authz — operator of this engagement's org, or super-admin. Founders excluded:
    // an assessed party cannot sign off on, or publish, their own assessment.
    const [orgSnap, cfgSnap] = await Promise.all([
      db.collection('organisations').doc(orgId).get(),
      db.doc('app/config').get()
    ]);
    const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
    const supers = ((cfgSnap.exists && cfgSnap.data().superAdminEmails) || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller) && !supers.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    // ---- sign-off ----
    if (action === 'revoke-sign') {
      await engRef.update({ assessmentSignoff: null, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }
    if (action === 'sign') {
      const note = body.note != null ? String(body.note).slice(0, 2000).trim() : '';
      const score = engData.investability || engData.investabilityScore || null;
      const pct = score && score.pct != null ? score.pct : null;
      const signoff = {
        by: (decoded.name && String(decoded.name).trim()) || caller,
        byEmail: caller,
        at: new Date().toISOString(),
        note: note || null,
      };
      if (pct != null) signoff.pct = pct;
      await engRef.update({ assessmentSignoff: signoff, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, signoff });
      return;
    }

    // ---- share link ----
    const prevToken = (engData.shareLink && engData.shareLink.token) || null;

    if (action === 'revoke-share') {
      if (prevToken) await db.collection('sharedMemos').doc(prevToken).delete().catch(() => {});
      await engRef.update({ shareLink: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }

    // action === 'share' — STABLE link. Reuse the engagement's existing token if it has
    // one (refresh in place → same url the IC already has); mint only on first share.
    const html = String(body.html || '');
    if (!html || html.length < 200) { res.status(400).json({ error: 'empty_memo' }); return; }
    if (html.length > MAX_HTML) { res.status(413).json({ error: 'memo_too_large' }); return; }
    const meta = body.meta || {};

    const isRefresh = !!prevToken;
    const token = prevToken || crypto.randomBytes(24).toString('base64url');   // 32 url-safe chars
    const docData = {
      html,
      engagementId,
      orgId,
      name: String(meta.name || engData.name || 'Venture').slice(0, 200),
      pct: (meta.pct != null ? meta.pct : null),
      updatedBy: caller,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (!isRefresh) { docData.createdBy = caller; docData.createdAt = FieldValue.serverTimestamp(); }
    await db.collection('sharedMemos').doc(token).set(docData, { merge: isRefresh });

    const link = { token, by: caller, at: new Date().toISOString() };
    if (meta.pct != null) link.pct = meta.pct;
    await engRef.update({ shareLink: link, updatedAt: FieldValue.serverTimestamp() });

    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'os.ventrify.io');
    res.status(200).json({ ok: true, token, url: `${origin}/m/${token}`, refreshed: isRefresh });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
