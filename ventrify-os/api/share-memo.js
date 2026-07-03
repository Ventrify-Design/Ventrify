/**
 * POST /api/share-memo — create or revoke a shareable deal-memo link.
 *
 * Body: { idToken, engagementId, action: 'create' | 'revoke', html?, meta? }
 *   action='create'  freezes `html` (the fully-rendered memo) into sharedMemos/<token>
 *                    and returns a stable link the operator forwards to their IC. Any
 *                    previous link for this engagement is deleted (one live link per
 *                    engagement; re-share replaces).
 *   action='revoke'  deletes the current sharedMemos doc and clears the link.
 *
 * The recipient reads it via /api/m (served under a strict no-script CSP), so they
 * never log in and nothing in Firestore is opened to public reads.
 *
 * Authz — caller must be an operator of the engagement's org (or super-admin), the
 * same rule as /api/dispatch-run. Isolation: you can only share your own org's work.
 * Env: FIREBASE_SERVICE_ACCOUNT (already set).
 */
const admin = require('firebase-admin');
const crypto = require('crypto');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const MAX_HTML = 900 * 1024;   // stay safely under Firestore's 1MB doc ceiling

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const action = String(body.action || 'create');
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }
    if (action !== 'create' && action !== 'revoke') { res.status(400).json({ error: 'bad_action' }); return; }

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

    // Authz — operator of this engagement's org, or super-admin.
    const [orgSnap, cfgSnap] = await Promise.all([
      db.collection('organisations').doc(orgId).get(),
      db.doc('app/config').get()
    ]);
    const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
    const supers = ((cfgSnap.exists && cfgSnap.data().superAdminEmails) || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller) && !supers.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    const prevToken = (engData.shareLink && engData.shareLink.token) || null;
    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'os.ventrify.io');

    if (action === 'revoke') {
      if (prevToken) await db.collection('sharedMemos').doc(prevToken).delete().catch(() => {});
      await engRef.update({ shareLink: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }

    // create — STABLE link. Reuse the engagement's existing token if it has one, so a
    // re-publish (after a re-run / new sign-off) refreshes what the IC sees at the SAME
    // url; only mint a fresh token the first time. Revoke is the only thing that retires
    // a token — so a link already forwarded to a committee keeps working and updating.
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
    // merge on refresh preserves createdAt/createdBy; overwrite on first publish.
    await db.collection('sharedMemos').doc(token).set(docData, { merge: isRefresh });

    const link = { token, by: caller, at: new Date().toISOString() };
    if (meta.pct != null) link.pct = meta.pct;
    await engRef.update({ shareLink: link, updatedAt: FieldValue.serverTimestamp() });

    res.status(200).json({ ok: true, token, url: `${origin}/m/${token}`, refreshed: isRefresh });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
