/**
 * POST /api/create-engagement — operator creates an engagement, with the org's
 * LICENCE QUOTA enforced server-side (Admin SDK, tamper-proof).
 *
 * Client-side engagement creation is disabled in firestore.rules
 * (engagements: allow create = false), so this endpoint is the ONLY way to
 * create one. That's what makes the one-off / licence limits a HARD check
 * rather than just a UI gate — a hand-crafted Firestore write can't bypass it.
 *
 * Body: { idToken, engagement }  — `engagement` is the full record the wizard
 * builds (workspace/new-engagement.html → persistAndLaunch).
 * Env: FIREBASE_SERVICE_ACCOUNT (already set on the Vercel project).
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

// Licence presets — MUST mirror workspace/plan.js PLAN_PRESETS and the copy in
// api/admin.js. Keep the three in sync if a preset's capabilities/limits change.
const SERVER_PLAN_PRESETS = {
  'one-off': { capabilities: { assess: true, build: false }, limits: { assessments: 1, builds: 0 } },
  'assess':  { capabilities: { assess: true, build: false }, limits: { assessments: null, builds: 0 } },
  'full':    { capabilities: { assess: true, build: true },  limits: { assessments: null, builds: null } },
};
function normLimit(v) {
  if (v == null || v === '' || v === 'unlimited') return null;
  const n = Math.floor(Number(v));
  return (isNaN(n) || n < 0) ? null : n;
}
function resolvePlan(org) {
  const p = org && org.plan;
  if (!p) return { preset: 'full', capabilities: { assess: true, build: true }, limits: { assessments: null, builds: null } };
  const preset = p.preset || 'custom';
  if (preset !== 'custom' && SERVER_PLAN_PRESETS[preset]) {
    const d = SERVER_PLAN_PRESETS[preset];
    return { preset, capabilities: { ...d.capabilities }, limits: { ...d.limits } };
  }
  const c = p.capabilities || {}, l = p.limits || {};
  return { preset: 'custom', capabilities: { assess: !!c.assess, build: !!c.build }, limits: { assessments: normLimit(l.assessments), builds: normLimit(l.builds) } };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken, engagement } = body;
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagement || !engagement.id) { res.status(400).json({ error: 'engagement_required' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    // Resolve the caller's org (the org whose operatorEmails lists them) — first
    // match, mirroring the client's findOperatorOrg. Non-operators are rejected.
    const orgSnap = await db.collection('organisations').where('operatorEmails', 'array-contains', caller).limit(1).get();
    if (orgSnap.empty) { res.status(403).json({ error: 'not_an_operator' }); return; }
    const orgDoc = orgSnap.docs[0];
    const org = orgDoc.data();
    const orgId = orgDoc.id;

    const type = engagement.engagementType === 'assessment' ? 'assessment' : 'build';
    const plan = resolvePlan(org);

    // Capability gate — is this engagement type licensed at all?
    const capKey = type === 'assessment' ? 'assess' : 'build';
    if (!plan.capabilities[capKey]) { res.status(403).json({ error: 'capability_not_licensed', reason: 'capability', type }); return; }

    // Quota gate — count existing engagements of this type in the org. Build is
    // everything that isn't an assessment (matches the client's usageFor).
    const limKey = type === 'assessment' ? 'assessments' : 'builds';
    const limit = plan.limits[limKey];
    if (limit != null) {
      const all = await db.collection('engagements').where('orgId', '==', orgId).get();
      const used = all.docs.filter(d => {
        const et = d.data().engagementType || 'build';
        return type === 'assessment' ? et === 'assessment' : et !== 'assessment';
      }).length;
      if (used >= limit) { res.status(403).json({ error: 'plan_limit_reached', reason: 'limit', limit, used, type }); return; }
    }

    // Allowed → write via Admin SDK. Force the resolved orgId (never trust the
    // client's), normalise founderEmail, stamp server timestamps; drop any
    // client-supplied timestamps. Everything else is the wizard payload.
    const id = String(engagement.id);
    const docRef = db.doc('engagements/' + id);
    if ((await docRef.get()).exists) { res.status(409).json({ error: 'engagement_exists', id }); return; }
    const { createdAt, updatedAt, orgId: _ignoredOrgId, ...rest } = engagement;
    await docRef.set({
      ...rest,
      orgId,
      founderEmail: String(engagement.founderEmail || '').trim().toLowerCase(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(200).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
