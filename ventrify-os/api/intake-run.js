/**
 * POST /api/intake-run — turn a widget submission into a real pre-screen.
 *
 * The partner-site widget (sites/verdict-widget) parks a founder's deck through
 * /api/intake and stops there: a row in `intakes` with state 'submitted' and a PDF in
 * Storage. Nothing else happens until this endpoint picks it up. This is the half that
 * makes the widget a product rather than a form.
 *
 * ── WHY A BUDGET LOOP AND NOT ONE LONG INVOCATION ───────────────────────────────────
 * A pre-screen is NINE handler invocations, not four: ps2-brief, ps2-research, one
 * ps2-nugget per entry in _prescreen2.NUGGETS (six today), then ps2-band. tools/
 * run-timing.mjs puts the whole run at five minutes of wall clock — which is exactly
 * Vercel Pro's 300s ceiling, with no margin, on a ceiling this project has never
 * actually tested. Betting the feature on that is how you discover the limit in
 * production at 2am.
 *
 * So this advances as many steps as fit inside a budget comfortably under the 60s we
 * already know we have, writes a CURSOR, and returns `more: true`. The caller comes
 * straight back. Nothing is load-bearing on an unobserved limit: raise maxDuration
 * later and the same code simply does more per tick.
 *
 * This is the shape api/sweep-stuck-runs.js already uses for Drive rooms (ROOM_BUDGET_MS).
 *
 * ── WHY IT DOES NOT QUERY ───────────────────────────────────────────────────────────
 * /api/intake 500'd on its first real submission because three of its caps were
 * `field == X AND createdAt >= Y`, which Firestore refuses without a purpose-built
 * composite index. The lesson applies here: the ONLY query below is a single-field
 * `in`, which the automatic index serves. Everything else is addressed by document id.
 *
 * ── WHY THE PARTNER NAME CANNOT PICK THE ORG ────────────────────────────────────────
 * `organisations/default` IS "TCA Venture Group" — and it is also the codebase-wide
 * fallback for an engagement with no orgId. A widget on a partner's site posts the
 * partner name as free text. If that string chose the workspace, anyone who embedded
 * the script could write into a real customer's org. So the mapping is SERVER-SIDE,
 * from INTAKE_PARTNER_ORGS, and an unmapped partner FAILS CLOSED.
 *
 * Trigger: the existing sweep-stuck-runs GitHub Actions schedule, which now polls this
 * until `more` comes back false. Auth matches that endpoint: optional CRON_SECRET.
 *
 * Env: FIREBASE_SERVICE_ACCOUNT (set), INTAKE_PARTNER_ORGS (required — "Name=orgId",
 *      comma-separated), INTAKE_RUN_OPERATOR (required — a service account listed in
 *      the target org's operatorEmails), CRON_SECRET (optional).
 */

const admin = require('firebase-admin');

const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'ventrify-os.firebasestorage.app';

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    storageBucket: STORAGE_BUCKET,
  });
}

const { idTokenFor } = require('./_auth.js');
const E = require('./_prescreen2.js');

/* Wall-clock stop, inside the 300s this function declares in vercel.json. A step that
   does not START before the budget is spent is left for the next tick, so this number
   is a floor on waste, not a deadline anything races.

   300 IS THE FIRST REAL TEST OF THE PRO maxDuration CEILING. If Vercel refuses it the
   deploy fails loudly and immediately, and the fix is to put both numbers back to 60 /
   42000 — the cursor means that costs more ticks, never a broken run. Nothing here is
   load-bearing on the higher limit; it just lets one tick finish a whole pre-screen
   (~5 min, tools/run-timing.mjs) instead of eight. */
const BUDGET_MS = Math.max(10000, Number(process.env.INTAKE_RUN_BUDGET_MS || 200000));
/* The budget gates whether a step STARTS, so the function can still be killed by the
   300s ceiling if a step that began at 199s runs long. 100s of headroom covers the
   slowest phase observed (research, with web search). A kill is survivable — see the
   step-already-done handling below — but it costs a repeated model call, so the
   headroom is cheaper than the retry. */

/* Long enough that a tick which dies mid-step cannot be lapped by the next one, short
   enough that a crash does not strand the founder for an hour. */
const LEASE_MS = 90 * 1000;

/* THE PIPELINE, derived from the engine so adding a nugget cannot silently skip it.
   `_prescreen2.NUGGETS` is the same array memo.js dispatches on. */
const STEPS = [
  'engagement',          // create engagements/<id> in the mapped partner org
  'deck',                // copy the intake deck into founder-docs/ and ingest it
  'ps2-brief',
  'ps2-research',
  ...E.NUGGETS.map(n => 'nugget:' + n.key),
  'ps2-band',
  'email',               // tell the founder it is ready
];

/** Call one of our own handlers in-process, the way the browser calls it over HTTP. */
function callLocal(handler, body) {
  return new Promise((resolve, reject) => {
    let code = 200;
    const res = {
      status(c) { code = c; return this; },
      json(o) { resolve({ status: code, body: o || {} }); },
      send(o) { resolve({ status: code, body: o }); },
      end() { resolve({ status: code, body: {} }); },
      setHeader() { return this; },
    };
    Promise.resolve(handler({ method: 'POST', body, query: {}, headers: {} }, res)).catch(reject);
  });
}

/** "TCA Venture Group=tca-widget, Harbour VC=harbour" → { 'tca venture group': 'tca-widget' } */
function partnerMap() {
  const out = {};
  String(process.env.INTAKE_PARTNER_ORGS || '').split(',').forEach(pair => {
    const i = pair.indexOf('=');
    if (i < 1) return;
    const name = pair.slice(0, i).trim().toLowerCase();
    const org = pair.slice(i + 1).trim();
    if (name && org) out[name] = org;
  });
  return out;
}

const toMs = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : Number(t || 0);

const slug = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * THE WORKSPACE THE FOUNDER ACTUALLY LANDS IN.
 *
 * This exists because of a real failure: the first live submission put the engagement
 * in the PARTNER's org, emailed the founder a sign-in link, and dropped them on an
 * empty portfolio. The workspace lists by `orgId == yourOrg` (firebase/data.js:101),
 * so an engagement in someone else's org is invisible no matter who may read it.
 *
 * So the engagement's `orgId` is the FOUNDER's own org, and `partnerOrgId` carries the
 * partner. The partner still sees it — one widened line in firestore.rules and a second
 * equality query in data.js — but the founder's workspace is correct by default rather
 * than by special case.
 *
 * The service operator is added to the org because /api/memo gates on membership of the
 * ENGAGEMENT's org, which is now this one. Scoped per org and revocable, rather than
 * making the sweeper a platform-wide super-admin.
 */
async function founderOrgFor(db, FieldValue, intake, operator) {
  const email = String(intake.email || '').toLowerCase();

  /* Reuse a workspace that is ALREADY THEIRS AND ONLY THEIRS — typically the one they
     made via self-serve signup.

     THE RULE IS NOT "AN ORG THEY OPERATE", AND THAT DISTINCTION IS LOAD-BEARING. The
     first version took `.limit(1)` of an array-contains on operatorEmails. Checked
     against live data, one test address operated EIGHT orgs — and `organisations/default`,
     the live TCA Venture Group workspace with four real operators on it, was among them
     and was even owned by that address. Firestore does not promise an order, so that
     query was a coin flip that could have dropped an unvetted widget submission into a
     customer's workspace.

     So two conditions, both required: they OWN it, and nobody else operates it (the
     sweeper does not count — it puts itself there). A shared or customer workspace can
     never be selected, whoever happens to be listed on it. */
  const operated = await db.collection('organisations')
    .where('operatorEmails', 'array-contains', email).get();
  const solelyTheirs = operated.docs.find(d => {
    const x = d.data();
    if (String(x.ownerEmail || '').toLowerCase() !== email) return false;
    const others = (x.operatorEmails || [])
      .map(e => String(e).toLowerCase())
      .filter(e => e !== email && e !== operator.toLowerCase());
    return others.length === 0;
  });
  if (solelyTheirs) {
    await solelyTheirs.ref.set({ operatorEmails: FieldValue.arrayUnion(operator) }, { merge: true });
    return { orgId: solelyTheirs.id, created: false };
  }

  /* Otherwise make one. A readable id, with the intake id appended only if something
     already holds the plain slug — two founders at the same company must not collide
     into one workspace. */
  const base = slug(intake.company) || slug(email.split('@')[0]) || 'venture';
  let orgId = base;
  if ((await db.collection('organisations').doc(orgId).get()).exists) {
    /* The plain slug is taken by an org that is NOT solely theirs (the check above already
       rejected it), so fall back to a suffixed id. If THAT is somehow taken too, stop:
       set({merge:true}) onto a stranger's org would rewrite its name, plan and ownerEmail
       and add this founder as an operator of it. Failing is recoverable; that is not. */
    orgId = base + '-' + slug(intake.__id).slice(0, 6);
    if ((await db.collection('organisations').doc(orgId).get()).exists) {
      throw new Error('org_id_taken:' + orgId);
    }
  }

  await db.collection('organisations').doc(orgId).set({
    name: intake.company || intake.name || 'My workspace',
    slug: orgId,
    ownerEmail: email,
    operatorEmails: [email, operator],
    /* ONE FREE PRE-SCREEN, AND NOTHING ELSE. The `trial` preset would hand over a free
       full assessment, which is the $199 product the widget exists to sell. */
    plan: { preset: 'widget-founder', capabilities: { assess: true, build: false },
            limits: { assessments: 0, builds: 0, prescreens: 1 } },
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { orgId, created: true };
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers.authorization || '') !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' }); return;
  }
  /* Vercel Cron invokes with GET; the GitHub Actions poll loop and a human testing by
     hand both use POST. Both are the same job, so both are allowed. HEAD and the rest
     are not, which is what keeps a link preview or a crawler from starting a run. */
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' }); return;
  }

  const started = Date.now();
  try {
    ensureAdmin();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;
    const intakes = db.collection('intakes');

    /* ── PICK ONE ──────────────────────────────────────────────────────────────────
       Equality on ONE field. No orderBy (that would pair with the filter and demand a
       composite index), no range. Candidates are ordered in JS. */
    const snap = await intakes.where('state', 'in', ['submitted', 'running']).limit(10).get();
    const now = Date.now();
    const free = snap.docs
      .filter(d => toMs(d.data().leaseUntil) < now)
      .sort((a, b) => toMs(a.data().createdAt) - toMs(b.data().createdAt));

    if (!free.length) { res.status(200).json({ ok: true, idle: true, more: false }); return; }

    /* ── CLAIM IT ──────────────────────────────────────────────────────────────────
       A transaction, because two ticks WILL overlap: GitHub's scheduler is best-effort
       and the poll loop re-enters within seconds. Without this, one founder's deck gets
       two pre-screens and the second one trips `already_prescreened`. */
    const ref = free[0].ref;
    const claimed = await db.runTransaction(async tx => {
      const d = await tx.get(ref);
      if (!d.exists) return null;
      const x = d.data();
      if (!['submitted', 'running'].includes(x.state)) return null;
      if (toMs(x.leaseUntil) >= Date.now()) return null;
      tx.set(ref, { state: 'running', leaseUntil: Date.now() + LEASE_MS }, { merge: true });
      return x;
    });
    if (!claimed) { res.status(200).json({ ok: true, contended: true, more: true }); return; }

    const intakeId = ref.id;
    const fail = async (reason, detail) => {
      await ref.set({ state: 'failed', failedReason: reason, failedDetail: detail || null,
                      leaseUntil: 0, failedAt: FieldValue.serverTimestamp() }, { merge: true });
      res.status(200).json({ ok: false, id: intakeId, failed: reason, more: true });
    };

    /* ── RESOLVE THE ORG — fail closed ─────────────────────────────────────────── */
    const orgId = claimed.orgId || partnerMap()[String(claimed.partner || '').toLowerCase()];
    if (!orgId) return fail('partner_unmapped', String(claimed.partner || ''));

    const operator = process.env.INTAKE_RUN_OPERATOR;
    if (!operator) return fail('no_service_operator');

    /* The org must exist and must actually list the service operator. Checked here so
       the failure says which of the two is wrong, rather than surfacing as a 403 from
       memo.js nine lines later. */
    const orgSnap = await db.collection('organisations').doc(orgId).get();
    if (!orgSnap.exists) return fail('org_not_found', orgId);
    const ops = (orgSnap.data().operatorEmails || []).map(e => String(e).toLowerCase());
    if (!ops.includes(operator.toLowerCase())) return fail('operator_not_in_org', `${operator} / ${orgId}`);

    const engagementId = claimed.engagementId || ('ps-' + intakeId);
    const engRef = db.collection('engagements').doc(engagementId);
    const { idToken } = await idTokenFor(operator);

    const memo = require('./memo.js');
    const ingest = require('./ingest-docs.js');
    const sendEmail = require('./send-email.js');

    let step = String(claimed.step || STEPS[0]);
    /* Carried on the intake so a later tick, which does not re-run the engagement step,
       still knows which org the pre-screen is running in. */
    let founderOrgId = claimed.founderOrgId || null;
    const done = [];

    /* ── ADVANCE ───────────────────────────────────────────────────────────────── */
    while (STEPS.includes(step) && Date.now() - started < BUDGET_MS) {
      if (step === 'engagement') {
        /* Deterministic id from the intake, so a retry after a crash re-uses the same
           engagement instead of leaving a half-built one behind.

           orgId is the FOUNDER's own workspace and partnerOrgId is the partner's, so the
           founder's portfolio shows it without a special case and the partner reads it
           through the widened line in firestore.rules. See founderOrgFor above. */
        /* A thrown error leaves the intake `running`, which is RIGHT for a transient fault
           — the next tick retries it. It is wrong for a permanent one: org_id_taken cannot
           resolve itself, so an uncaught throw would re-fail on every tick, forever. Name
           the permanent case and park the intake instead. */
        let fo;
        try {
          fo = await founderOrgFor(db, FieldValue, { ...claimed, __id: intakeId }, operator);
        } catch (e) {
          if (String((e && e.message) || e).startsWith('org_id_taken')) {
            return fail('org_id_taken', String(e.message));
          }
          throw e;
        }
        founderOrgId = fo.orgId;
        await engRef.set({
          name: claimed.company || claimed.name || 'Untitled venture',
          orgId: founderOrgId, partnerOrgId: orgId,
          founderEmail: String(claimed.email || '').toLowerCase(),
          founderName: claimed.name || null,
          type: 'assessment', tier: 'prescreen',
          source: 'widget', partner: claimed.partner || null, intakeId,
          shareWithPartner: claimed.shareWithPartner !== false,
          dataRoomLink: claimed.room || null,
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });

      } else if (step === 'deck') {
        /* ingest-docs refuses any storagePath outside founder-docs/<engagementId>/ —
           a guard that exists so a caller cannot name an arbitrary object and have the
           server read it back. The deck is at intake/<intakeId>/..., so COPY it into
           the legal path rather than widening the guard. A server-side GCS copy moves
           no bytes through this function. */
        const src = admin.storage().bucket().file(claimed.deckPath);
        const name = claimed.deckFileName || 'deck.pdf';
        const dest = `founder-docs/${engagementId}/${name}`;
        const [exists] = await src.exists();
        if (!exists) return fail('deck_missing', claimed.deckPath);
        await src.copy(admin.storage().bucket().file(dest));

        const r = await callLocal(ingest, {
          idToken, engagementId, docType: 'pitch',
          file: { name }, storagePath: dest,
        });
        if (r.status !== 200) return fail('ingest_failed', `${r.status} ${r.body && r.body.error}`);

      } else if (step === 'email') {
        /* The founder's way back in. NOTE: this is still the generic sign-in template —
           a dedicated "your pre-screen is ready" email is the next piece of step 2. The
           link lands on the engagement, so the founder does arrive in the right place. */
        const r = await callLocal(sendEmail, {
          type: 'login', email: claimed.email, surface: 'Workspace',
          continueUrl: `https://os.ventrify.io/workspace/?id=${encodeURIComponent(engagementId)}`,
        });
        if (r.status !== 200) return fail('email_failed', `${r.status} ${r.body && r.body.error}`);

      } else {
        /* A pre-screen phase. `nugget:<key>` carries its key; the rest are bare actions. */
        const isNugget = step.startsWith('nugget:');
        const body = { idToken, engagementId, action: isNugget ? 'ps2-nugget' : step };
        if (isNugget) body.nugget = step.slice(7);
        const r = await callLocal(memo, body);

        /* A STEP THAT ALREADY RAN IS NOT A FAILURE.
           The cursor is written AFTER a step returns, so a tick killed in between leaves a
           phase done and the cursor still pointing at it. The retry then hits claimVenture,
           which refuses a second pre-screen of the same engagement with
           `already_prescreened / self` (memo.js:62) — and the whole intake failed, with the
           founder never emailed, over a pre-screen that had actually SUCCEEDED.

           `self` means THIS engagement already has one, which is precisely the state the
           retry wanted to reach. Advance. Any other reason is the real duplicate-venture
           rule catching a genuine duplicate, and must still stop the run. */
        const err = r.body && r.body.error;
        const alreadyDone = r.status === 409 && err === 'already_prescreened'
                            && r.body.reason === 'self';
        if (r.status !== 200 && !alreadyDone) {
          return fail('phase_failed', `${step}: ${r.status} ${err}`);
        }
      }

      done.push(step);
      step = STEPS[STEPS.indexOf(step) + 1] || 'complete';
      await ref.set({ step, engagementId, orgId, founderOrgId,
                      leaseUntil: Date.now() + LEASE_MS }, { merge: true });
    }

    const finished = !STEPS.includes(step);
    await ref.set({
      step,
      engagementId, orgId, founderOrgId,
      state: finished ? 'done' : 'running',
      leaseUntil: 0,
      ...(finished ? { completedAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });

    res.status(200).json({ ok: true, id: intakeId, engagementId, did: done, step, more: !finished });
  } catch (e) {
    console.error('[intake-run]', (e && e.stack) || e);
    res.status(500).json({ error: 'run_failed', detail: String((e && e.message) || e).slice(0, 200) });
  }
};
