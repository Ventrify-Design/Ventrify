/**
 * POST /api/sign-off — operator endorsement on an assessment (Track A · Piece 3).
 *
 * Body: { idToken, engagementId, action: 'sign' | 'revoke', note? }
 *
 * Why server-side: the sign-off is an INTEGRITY claim ("a named operator stood
 * behind this call") that rides into the forwarded memo. If it were a plain client
 * write, the engagements 'allow update' rule (founder OR operator) would let the
 * assessed founder forge a senior-partner endorsement via the SDK. So the signer's
 * identity is stamped from the VERIFIED token here — never from client input — and
 * only an operator (or super-admin) of the engagement's org may sign. The matching
 * Firestore rule forbids clients from writing assessmentSignoff directly, so this
 * endpoint is the only path.
 *
 * Authz mirrors /api/dispatch-run + /api/share-memo (operator of the org, or super-admin).
 * Env: FIREBASE_SERVICE_ACCOUNT (already set).
 */
const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const action = String(body.action || 'sign');
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }
    if (action !== 'sign' && action !== 'revoke') { res.status(400).json({ error: 'bad_action' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const callerEmail = (decoded.email || '').toLowerCase();
    if (!callerEmail) { res.status(401).json({ error: 'no_token' }); return; }

    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const engRef = db.collection('engagements').doc(engagementId);
    const engSnap = await engRef.get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const engData = engSnap.data();
    const orgId = engData.orgId || 'default';

    // Authz — operator of this engagement's org, or super-admin. Founders are
    // deliberately excluded: an assessed party cannot endorse their own assessment.
    const [orgSnap, cfgSnap] = await Promise.all([
      db.collection('organisations').doc(orgId).get(),
      db.doc('app/config').get()
    ]);
    const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
    const supers = ((cfgSnap.exists && cfgSnap.data().superAdminEmails) || []).map(e => String(e).toLowerCase());
    if (!ops.includes(callerEmail) && !supers.includes(callerEmail)) { res.status(403).json({ error: 'forbidden' }); return; }

    if (action === 'revoke') {
      // Write null (not delete) so the field stays present — keeps client live-mirrors simple.
      await engRef.update({ assessmentSignoff: null, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }

    // sign — identity from the verified token; note is the operator's own free text.
    const note = body.note != null ? String(body.note).slice(0, 2000).trim() : '';
    const score = engData.investability || engData.investabilityScore || null;
    const pct = score && score.pct != null ? score.pct : null;
    const signoff = {
      by: (decoded.name && String(decoded.name).trim()) || callerEmail,
      byEmail: callerEmail,
      at: new Date().toISOString(),
      note: note || null,
    };
    if (pct != null) signoff.pct = pct;

    await engRef.update({ assessmentSignoff: signoff, updatedAt: FieldValue.serverTimestamp() });
    res.status(200).json({ ok: true, signoff });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
