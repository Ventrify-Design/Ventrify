/**
 * api/billing.js — the till.
 *
 * Two actions, both POST, both authenticated the same way every other engagement action is:
 *
 *   checkout — mint a Stripe Checkout Session to upgrade ONE pre-screened engagement
 *   confirm  — ask Stripe whether a returning session was really paid, and record it
 *
 * WHY THE RETURN TRIP ASKS STRIPE RATHER THAN BELIEVING THE BROWSER. The customer comes back to
 * /workspace/assess-next?id=…&paid=cs_test_… and that URL is a string anybody can type. So the
 * session id is not evidence of anything; it is a question. The answer comes from Stripe over an
 * authenticated connection, and the only thing that unlocks a venture is `payment_status: 'paid'`
 * on a session whose own metadata names that venture.
 *
 * WHY THERE IS NO STRIPE SDK HERE. Resend, GitHub and Firebase's token endpoint are all called with
 * fetch in this codebase; Stripe's REST API is form-encoded and the two calls needed are a POST and
 * a GET. A dependency in a serverless bundle has to earn its place and this one does not.
 *
 * THE PRICE IS CHECKED AGAINST THE PAGE BEFORE A SESSION IS MINTED. Stripe holds the amount, and so
 * does shared/entitlements.js, which is what the customer actually read. Two numbers that can
 * disagree is how a site advertises $199 and charges $299 — so they are compared every time, and a
 * disagreement refuses the sale rather than silently winning it.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, FIREBASE_SERVICE_ACCOUNT.
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const ACTIONS = new Set(['checkout', 'confirm']);
const WORKSPACE_URL = process.env.WORKSPACE_URL || 'https://os.ventrify.io';

// ── Stripe, over fetch ────────────────────────────────────────────────────────────────────────────
const fail = (code, error, detail) => Object.assign(new Error(error), { code, error, detail });

async function stripe(pathname, { method = 'GET', body } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw fail(503, 'stripe_not_configured', 'STRIPE_SECRET_KEY is not set on this deployment.');
  const r = await fetch('https://api.stripe.com/v1' + pathname, {
    method,
    headers: {
      Authorization: 'Bearer ' + key,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(502, 'stripe_failed', (j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}

/* Stripe's form encoding for nested fields: line_items[0][price]=… — URLSearchParams does the rest. */
const form = (pairs) => new URLSearchParams(pairs).toString();

/* A test key can only ever see test data, so this is a label rather than a guard — but a test
   payment must never be mistaken on screen for a real one. */
const isTestKey = () => String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');

// ── the shared gate, identical to api/memo.js prescreen-unlock ────────────────────────────────────
async function allowanceFor(db, orgSnap, orgId) {
  // Same computation, same failure direction: without it, assume nothing is included.
  try {
    const { resolvePlan, remainingFor } = await import('../workspace/plan.js');
    const plan = resolvePlan(orgSnap.exists ? orgSnap.data() : null);
    const mine = await db.collection('engagements').where('orgId', '==', orgId).get();
    return { remainingFull: remainingFor(plan, mine.docs.map(d => d.data()), 'assessment', 'full'),
             preset: plan.preset };
  } catch (e) {
    console.warn('[billing] allowance unavailable:', (e && e.message) || e);
    return { remainingFull: 0, preset: null };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, idToken } = body;
    const engagementId = String(body.engagementId || '').trim();

    /* THE ACTION IS CHECKED BEFORE THE TOKEN, and that order is load-bearing rather than careless.
       api/memo.js does the same, and tools/contract.mjs depends on it: an endpoint that authenticates
       first answers 401 to a real action and to an invented one alike, so nothing can prove the door
       for `checkout` actually opens — which is the exact failure that gate was written for, when five
       whitelisted-out actions shipped and the operator met `bad_action` first. The names are in the
       client bundle already, so there is nothing here to leak. */
    if (!ACTIONS.has(String(action || ''))) {
      res.status(400).json({ error: 'bad_action', detail: String(action || '') });
      return;
    }
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }

    ensureAdmin();
    let decoded;
    try { decoded = await admin.auth().verifyIdToken(idToken); }
    catch (e) { res.status(401).json({ error: 'invalid_token' }); return; }
    const caller = (decoded.email || '').toLowerCase();

    const db = admin.firestore();
    const engRef = db.collection('engagements').doc(engagementId);
    const engSnap = await engRef.get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const eng = engSnap.data();
    const orgId = eng.orgId || 'default';

    const [orgSnap, cfgSnap] = await Promise.all([
      db.collection('organisations').doc(orgId).get(),
      db.doc('app/config').get(),
    ]);
    const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
    const supers = ((cfgSnap.exists && cfgSnap.data().superAdminEmails) || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller) && !supers.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    const paid = (eng.payment && eng.payment.status === 'paid');

    // ── CHECKOUT ──────────────────────────────────────────────────────────────────────────────────
    if (action === 'checkout') {
      if (eng.tier === 'full' && !paid) { res.status(409).json({ error: 'already_full', detail: 'This venture is already a full assessment.' }); return; }
      if (paid) { res.status(409).json({ error: 'already_paid', detail: 'This venture has already been paid for.', payment: eng.payment }); return; }

      /* NOBODY IS SOLD SOMETHING THEY ALREADY OWN. An org with allowance left is entitled to this
         run under its licence, and a checkout offered to them is a double charge waiting to be
         refunded. The browser routes on the same rule; this is the half that cannot be bypassed. */
      const { remainingFull } = await allowanceFor(db, orgSnap, orgId);
      if (remainingFull === Infinity || remainingFull > 0) {
        res.status(409).json({ error: 'no_payment_needed', detail: 'This organisation’s licence already covers a full assessment.' });
        return;
      }

      const priceId = process.env.STRIPE_PRICE_ID;
      if (!priceId) { res.status(503).json({ error: 'price_not_configured' }); return; }

      /* THE NUMBER ON THE SCREEN AND THE NUMBER IN THE TILL, compared before a session exists. */
      const { PRICE_PER_RUN_USD } = await import('../shared/entitlements.js');
      const price = await stripe('/prices/' + encodeURIComponent(priceId));
      const expected = Math.round(Number(PRICE_PER_RUN_USD) * 100);
      if (price.unit_amount !== expected || String(price.currency).toLowerCase() !== 'usd') {
        console.error('[billing] price mismatch', { stripe: price.unit_amount, currency: price.currency, page: expected });
        res.status(409).json({ error: 'price_mismatch',
          detail: 'The price in Stripe does not match the price on the page. Nothing has been charged.' });
        return;
      }

      const back = WORKSPACE_URL + '/workspace/assess-next?id=' + encodeURIComponent(engagementId);
      const session = await stripe('/checkout/sessions', {
        method: 'POST',
        body: form({
          mode: 'payment',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          // THE SESSION NAMES ITS VENTURE. confirm refuses any session whose metadata says otherwise,
          // which is what stops one payment unlocking a different engagement.
          'metadata[engagementId]': engagementId,
          'metadata[orgId]': orgId,
          'metadata[boughtBy]': caller,
          client_reference_id: engagementId,
          ...(eng.founderEmail ? { customer_email: String(eng.founderEmail) } : {}),
          success_url: back + '&paid={CHECKOUT_SESSION_ID}',
          cancel_url: back + '&paid=cancelled',
        }),
      });

      await engRef.set({ payment: {
        status: 'pending', sessionId: session.id, startedAt: new Date().toISOString(),
        startedBy: caller, testMode: isTestKey(),
      } }, { merge: true });

      res.status(200).json({ ok: true, url: session.url, sessionId: session.id, testMode: isTestKey() });
      return;
    }

    // ── CONFIRM ───────────────────────────────────────────────────────────────────────────────────
    if (action === 'confirm') {
      const sessionId = String(body.sessionId || '').trim();
      if (!sessionId || !/^cs_/.test(sessionId)) { res.status(400).json({ error: 'session_required' }); return; }
      if (paid) { res.status(200).json({ ok: true, paid: true, already: true, payment: eng.payment }); return; }

      const session = await stripe('/checkout/sessions/' + encodeURIComponent(sessionId));

      /* THE SESSION MUST NAME THIS VENTURE. Without this, one $199 payment could be replayed against
         every engagement its buyer can see. */
      const named = (session.metadata && session.metadata.engagementId) || session.client_reference_id;
      if (named !== engagementId) { res.status(409).json({ error: 'session_mismatch', detail: 'That payment belongs to a different assessment.' }); return; }
      if (session.payment_status !== 'paid') {
        res.status(402).json({ error: 'not_paid', status: session.payment_status || 'unknown' });
        return;
      }

      const payment = {
        status: 'paid',
        sessionId: session.id,
        paymentIntent: session.payment_intent || null,
        amountTotal: session.amount_total,
        currency: session.currency,
        paidAt: new Date().toISOString(),
        testMode: session.livemode === false,
        email: (session.customer_details && session.customer_details.email) || eng.founderEmail || null,
      };
      await engRef.set({ payment }, { merge: true });
      res.status(200).json({ ok: true, paid: true, payment });
      return;
    }

    /* Unreachable: the whitelist above already refused anything that is not one of these. It stays
       as the answer of last resort if an action is ever added to ACTIONS and not to the body. */
    res.status(500).json({ error: 'action_not_implemented', detail: String(action || '') });
  } catch (e) {
    const code = e && e.code && Number.isInteger(e.code) ? e.code : 500;
    res.status(code).json({ error: (e && e.error) || 'server_error', detail: String((e && e.detail) || (e && e.message) || e) });
  }
};
