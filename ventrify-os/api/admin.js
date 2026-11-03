/**
 * POST /api/admin — super-admin / org-owner management (Admin SDK, tamper-proof).
 *
 * The caller's Firebase ID token is verified server-side, so clients can't
 * self-escalate. Operators/orgs are NEVER writable from the client directly
 * (rules: org write = false) — only through here.
 *
 * Actions (body.action):
 *   list-orgs                         → super-admin: all orgs
 *   create-org {name, slug?, ownerEmail, primaryColor?, plan?} → super-admin: new org
 *   create-own-org {name, primaryColor?}  → ANY verified caller with no org: their own trial workspace
 *   set-plan {orgId, plan}            → super-admin: change an org's licence
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

// Org licence presets — MUST mirror workspace/plan.js PLAN_PRESETS. The server
// is the source of truth: clients can suggest a plan, but it's normalised here
// before it touches Firestore so a tampered request can't grant extra scope.
const SERVER_PLAN_PRESETS = {
  // Public signup creates THIS and only this — see workspace/plan.js. A finite pre-screen
  // allowance is the money guard: each run costs real API credit and nothing throttles a user.
  'trial':      { capabilities: { assess: true, build: false }, limits: { assessments: 0,    builds: 0,    prescreens: 2 } },
  'self-serve': { capabilities: { assess: true, build: false }, limits: { assessments: 0,    builds: 0,    prescreens: null } },
  'one-off':    { capabilities: { assess: true, build: false }, limits: { assessments: 1,    builds: 0,    prescreens: null } },
  'assess':     { capabilities: { assess: true, build: false }, limits: { assessments: null, builds: 0,    prescreens: null } },
  // VERDICTSCORE DOES NOT BUILD VENTURES. 'full' means everything THIS product does — unlimited
  // pre-screens and unlimited full assessments. Building is VentureStack, a separate product.
  'full':       { capabilities: { assess: true, build: false }, limits: { assessments: null, builds: 0,    prescreens: null } },
};
function normLimit(v) {
  if (v == null || v === '' || v === 'unlimited') return null;
  const n = Math.floor(Number(v));
  return (isNaN(n) || n < 0) ? null : n;
}
function normalisePlan(input) {
  const preset = (input && input.preset) || 'full';
  if (preset !== 'custom' && SERVER_PLAN_PRESETS[preset]) {
    const def = SERVER_PLAN_PRESETS[preset];
    return { preset, capabilities: { ...def.capabilities }, limits: { ...def.limits } };
  }
  const c = (input && input.capabilities) || {};
  const l = (input && input.limits) || {};
  return {
    preset: 'custom',
    capabilities: { assess: !!c.assess, build: !!c.build },
    // A plan stored before prescreens existed has no such key → null → unlimited triage,
    // which is right: every org that predates this feature is a paying licensee.
    limits: { assessments: normLimit(l.assessments), builds: normLimit(l.builds), prescreens: normLimit(l.prescreens) },
  };
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
        plan: normalisePlan(body.plan),
        createdAt: FieldValue.serverTimestamp()
      });
      res.status(200).json({ ok: true, id });
      return;
    }

    // ── PUBLIC SIGNUP ─────────────────────────────────────────────────────────────────────────────
    // The one action here that is NOT super-admin. It is still not unauthenticated: the caller has
    // already proved this email by following a magic link, and verifyIdToken above is what proves it
    // to us. That is the whole security model — there is no open endpoint that mints organisations.
    //
    // THREE THINGS ARE NEVER READ FROM THE REQUEST, because a client can say anything:
    //   • the owner's email  — taken from the verified token, not the body
    //   • the plan           — hard-coded 'trial'; body.plan is ignored entirely
    //   • super-admin status — irrelevant here; a super-admin signing up gets a trial like anyone
    // Upgrading an org remains set-plan, which is super-admin only.
    if (action === 'create-own-org') {
      // email_verified is true for email-link sign-in, which is the only way into this product.
      // A provider that could federate an unverified address must not be able to claim a workspace.
      if (!decoded.email_verified) { res.status(403).json({ error: 'email_not_verified' }); return; }

      const name = String(body.name || '').trim();
      if (!name) { res.status(400).json({ error: 'name_required' }); return; }
      if (name.length > 80) { res.status(400).json({ error: 'name_too_long' }); return; }

      // ONE WORKSPACE PER EMAIL. Without this, a signed-in account can mint organisations in a loop
      // and each one carries its own free pre-screen allowance — the allowance would cap nothing.
      const mine = await db.collection('organisations').where('operatorEmails', 'array-contains', caller).limit(1).get();
      if (!mine.empty) { res.status(409).json({ error: 'already_has_org', id: mine.docs[0].id }); return; }

      // Slug collisions are other people's workspaces, so never reuse and never guess twice.
      const base = slugify(name) || 'workspace';
      let id = base;
      for (let i = 2; (await db.doc('organisations/' + id).get()).exists; i++) {
        if (i > 50) { res.status(409).json({ error: 'slug_exhausted' }); return; }
        id = base + '-' + i;
      }

      await db.doc('organisations/' + id).set({
        name, slug: id, ownerEmail: caller, operatorEmails: [caller],
        primaryColor: typeof body.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)
          ? body.primaryColor : '#0036FF',
        plan: normalisePlan({ preset: 'trial' }),
        source: 'self-signup',
        createdAt: FieldValue.serverTimestamp()
      });
      res.status(200).json({ ok: true, id });
      return;
    }

    if (action === 'set-plan') {
      // Changing a licence is a platform/billing decision — super-admin only.
      if (!isSuper) { res.status(403).json({ error: 'forbidden' }); return; }
      const orgId = String(body.orgId || '').trim();
      if (!orgId) { res.status(400).json({ error: 'org_required' }); return; }
      const orgRef = db.doc('organisations/' + orgId);
      if (!(await orgRef.get()).exists) { res.status(404).json({ error: 'org_not_found' }); return; }
      await orgRef.update({ plan: normalisePlan(body.plan) });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'delete-org') {
      if (!isSuper) { res.status(403).json({ error: 'forbidden' }); return; }
      const orgId = String(body.orgId || '').trim();
      if (!orgId) { res.status(400).json({ error: 'org_required' }); return; }
      if (orgId === 'default') { res.status(400).json({ error: 'cannot_delete_default' }); return; }
      const orgRef = db.doc('organisations/' + orgId);
      if (!(await orgRef.get()).exists) { res.status(404).json({ error: 'org_not_found' }); return; }

      // Cascade: every engagement in this org → its cards + investability
      // snapshots → the engagement doc, then the org itself.
      const engs = await db.collection('engagements').where('orgId', '==', orgId).get();
      let engCount = 0, cardCount = 0;
      for (const engDoc of engs.docs) {
        const cards = await db.collection('cards').where('engagementId', '==', engDoc.id).get();
        for (const c of cards.docs) { await c.ref.delete(); cardCount++; }
        const snaps = await engDoc.ref.collection('investabilitySnapshots').get();
        for (const s of snaps.docs) { await s.ref.delete(); }
        await engDoc.ref.delete();
        engCount++;
      }
      await orgRef.delete();
      res.status(200).json({ ok: true, deleted: { engagements: engCount, cards: cardCount } });
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
