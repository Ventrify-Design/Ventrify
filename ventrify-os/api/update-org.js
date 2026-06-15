/**
 * POST /api/update-org — update an organisation's brand kit (operator-only).
 *
 * Org docs are server-only in the security rules (`allow write: if false`), so
 * every change goes through this admin-SDK endpoint. Any operator of the org may
 * edit it (verified: the caller's email is in organisations/{orgId}.operatorEmails).
 * Only brand fields are writable here — never operatorEmails, slug, tier or billing.
 *
 * Body: { idToken, orgId, patch: { name?, primaryColor?, logoUrl? } }
 *   logoUrl: a small data: URL (≤ ~400KB) or null to clear.
 * Env: FIREBASE_SERVICE_ACCOUNT.
 */
const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const MAX_LOGO = 420 * 1024;   // chars of the data URL — keeps the (public) org doc well under 1MB

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const orgId = String(body.orgId || '').trim();
    const patch = body.patch || {};
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!orgId) { res.status(400).json({ error: 'org_required' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();

    const ref = db.collection('organisations').doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).json({ error: 'org_not_found' }); return; }
    const ops = (snap.data().operatorEmails || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    // Sanitise — only these fields are writable, and each is validated.
    const update = {};
    if (typeof patch.name === 'string' && patch.name.trim()) update.name = patch.name.trim().slice(0, 80);
    if (typeof patch.primaryColor === 'string') {
      const c = patch.primaryColor.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(c)) { res.status(400).json({ error: 'bad_color' }); return; }
      update.primaryColor = c.toUpperCase();
    }
    if ('logoUrl' in patch) {
      if (patch.logoUrl == null || patch.logoUrl === '') { update.logoUrl = admin.firestore.FieldValue.delete(); }
      else if (typeof patch.logoUrl === 'string' && /^data:image\/(png|jpeg|svg\+xml)/.test(patch.logoUrl)) {
        if (patch.logoUrl.length > MAX_LOGO) { res.status(413).json({ error: 'logo_too_large' }); return; }
        update.logoUrl = patch.logoUrl;
      } else { res.status(400).json({ error: 'bad_logo' }); return; }
    }
    if (!Object.keys(update).length) { res.status(400).json({ error: 'nothing_to_update' }); return; }
    update.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await ref.set(update, { merge: true });
    const after = (await ref.get()).data();
    res.status(200).json({ ok: true, org: { id: orgId, name: after.name, primaryColor: after.primaryColor, logoUrl: after.logoUrl || null } });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
