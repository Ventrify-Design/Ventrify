/**
 * POST /api/admin — super-admin / org-owner management (Admin SDK, tamper-proof).
 *
 * The caller's Firebase ID token is verified server-side, so clients can't
 * self-escalate. Operators/orgs are NEVER writable from the client directly
 * (rules: org write = false) — only through here.
 *
 * Actions (body.action):
 *   list-orgs                         → super-admin: all orgs
 *   create-org {name, slug?, ownerEmail, primaryColor?} → super-admin: new org
 *   add-operator {orgId, email}       → super-admin OR that org's owner
 *   remove-operator {orgId, email}    → super-admin OR that org's owner
 *
 * Body always includes { idToken } (from auth.currentUser.getIdToken()).
 * Env: FIREBASE_SERVICE_ACCOUNT (already set on the Vercel project).
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, idToken } = body;
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const cfg = (await db.doc('app/config').get()).data() || {};
    const isSuper = (cfg.superAdminEmails || []).map(e => String(e).toLowerCase()).includes(caller);

    if (action === 'list-orgs') {
      if (!isSuper) { res.status(403).json({ error: 'forbidden' }); return; }
      const snap = await db.collection('organisations').get();
      res.status(200).json({ orgs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      return;
    }

    if (action === 'create-org') {
      if (!isSuper) { res.status(403).json({ error: 'forbidden' }); return; }
      const name = String(body.name || '').trim();
      const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
      if (!name || !ownerEmail) { res.status(400).json({ error: 'name_and_owner_required' }); return; }
      const id = slugify(body.slug || name) || ('org-' + Math.random().toString(36).slice(2, 8));
      if ((await db.doc('organisations/' + id).get()).exists) { res.status(409).json({ error: 'slug_taken', slug: id }); return; }
      await db.doc('organisations/' + id).set({
        name, slug: id, ownerEmail, operatorEmails: [ownerEmail],
        primaryColor: body.primaryColor || '#0036FF',
        createdAt: FieldValue.serverTimestamp()
      });
      res.status(200).json({ ok: true, id });
      return;
    }

    if (action === 'add-operator' || action === 'remove-operator') {
      const orgId = String(body.orgId || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!orgId || !email) { res.status(400).json({ error: 'org_and_email_required' }); return; }
      const orgSnap = await db.doc('organisations/' + orgId).get();
      if (!orgSnap.exists) { res.status(404).json({ error: 'org_not_found' }); return; }
      const org = orgSnap.data();
      const isOwner = String(org.ownerEmail || '').toLowerCase() === caller;
      if (!isSuper && !isOwner) { res.status(403).json({ error: 'forbidden' }); return; }
      if (action === 'remove-operator' && email === String(org.ownerEmail || '').toLowerCase()) {
        res.status(400).json({ error: 'cannot_remove_owner' }); return;
      }
      await db.doc('organisations/' + orgId).update({
        operatorEmails: action === 'add-operator' ? FieldValue.arrayUnion(email) : FieldValue.arrayRemove(email)
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
