/**
 * tools/billing-contract.mjs — EXERCISES /api/billing. Offline, $0, no Stripe account needed, ~1s.
 *
 * This is the file that takes money, so it is the one place where being wrong is expensive in both
 * directions: a customer charged for something their licence already covers, or a venture unlocked
 * by a payment that never happened. Neither shows up in a grep.
 *
 * The real handler is driven with firebase-admin and fetch replaced, so every assertion is about
 * what the code DID: which Stripe calls it made, in what order, what it wrote to the engagement,
 * and — just as important — what it refused to do before calling Stripe at all.
 *
 *   node tools/billing-contract.mjs            run it
 *   node tools/billing-contract.mjs --canary   remove a guard and prove the gate notices
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';

const CANARY = process.argv.includes('--canary');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(ROOT, 'api/billing.js'));

// ── the fake world ────────────────────────────────────────────────────────────────────────────────
let DOCS = new Map(), CALLS = [], PRICE = { unit_amount: 19900, currency: 'usd' }, SESSION = null;
let CALLER = 'alex@northwind.health';

const snapOf = d => ({ exists: !!d, data: () => d });
const merge = (prev, next) => {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(next)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && prev && prev[k] && typeof prev[k] === 'object')
      ? { ...prev[k], ...v } : v;
  }
  return out;
};
function docApi(col, id) {
  const key = col + '/' + id;
  return {
    id,
    get: async () => snapOf(DOCS.get(key)),
    set: async (v, o) => DOCS.set(key, o && o.merge ? merge(DOCS.get(key), v) : v),
  };
}
const queryApi = (col) => ({
  where: () => queryApi(col),
  get: async () => ({ docs: [...DOCS].filter(([k]) => k.startsWith(col + '/')).map(([k, d]) => snapOf(d)) }),
});
const db = {
  collection: col => ({ doc: id => docApi(col, id), ...queryApi(col) }),
  doc: p => docApi(p.split('/')[0], p.split('/').slice(1).join('/')),
};
const admin = {
  apps: [], initializeApp() { this.apps.push(1); }, credential: { cert: () => ({}) },
  firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => new Date() } }),
  auth: () => ({ verifyIdToken: async t => { if (t === 'bad') throw new Error('nope'); return { email: CALLER }; } }),
};
const stub = (mod, exports) => {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
};
stub('firebase-admin', admin);

/* Stripe, recorded rather than called. The ORDER of these is an assertion in itself: a session
   minted before the price was checked is a session that can charge the wrong number. */
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  CALLS.push({ url: u, method: opts.method || 'GET', body: opts.body || null });
  const ok = (j) => ({ ok: true, json: async () => j });
  if (/\/v1\/prices\//.test(u)) return ok(PRICE);
  if (/\/v1\/checkout\/sessions\/cs_/.test(u)) return SESSION
    ? ok(SESSION)
    : { ok: false, json: async () => ({ error: { message: 'No such session' } }) };
  if (/\/v1\/checkout\/sessions$/.test(u)) return ok({ id: 'cs_test_NEW', url: 'https://checkout.stripe.com/c/pay/cs_test_NEW' });
  return { ok: false, json: async () => ({ error: { message: 'unexpected call ' + u } }) };
};

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PRICE_ID = 'price_fake';

/* The handler is EVALUATED rather than required, so the canary can remove a guard from the source
   and the gate can prove it noticed. Same trick as tools/mail-brand.mjs. */
function loadHandler(src) {
  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', 'process', 'fetch', 'console', 'URLSearchParams', 'Number', 'Math', 'String', 'Date', 'JSON', 'Object', src);
  fn(m, m.exports, require, process, globalThis.fetch, console, URLSearchParams, Number, Math, String, Date, JSON, Object);
  return m.exports;
}
const SRC = readFileSync(path.join(ROOT, 'api/billing.js'), 'utf8');
const handler = loadHandler(CANARY
  // the guard that stops one payment unlocking every engagement its buyer can see
  ? SRC.replace('if (named !== engagementId)', 'if (false)')
  : SRC);

const post = async (body) => {
  let code = 0, payload = null;
  const res = { setHeader() {}, end() {}, status(c) { code = c; return res; }, json(j) { payload = j; return res; } };
  await handler({ method: 'POST', headers: {}, body }, res);
  return { code, payload };
};

function seed({ org = {}, eng = {} } = {}) {
  DOCS = new Map(); CALLS = []; SESSION = null; CALLER = 'alex@northwind.health';
  PRICE = { unit_amount: 19900, currency: 'usd' };
  DOCS.set('app/config', { superAdminEmails: ['boss@ventrify.io'] });
  DOCS.set('organisations/northwind-health', {
    operatorEmails: ['alex@northwind.health'],
    plan: { preset: 'widget-founder', capabilities: { assess: true, build: false },
            limits: { assessments: 0, builds: 0, prescreens: 1 } },
    ...org,
  });
  DOCS.set('engagements/ps-1', {
    engagementType: 'assessment', tier: 'prescreen', orgId: 'northwind-health',
    name: 'Northwind Health', founderEmail: 'alex@northwind.health',
    prescreen2: { v: 2, state: 'done', band: 'MEDIUM' }, ...eng,
  });
}
const CO = (over = {}) => ({ action: 'checkout', idToken: 'tok', engagementId: 'ps-1', ...over });
const CF = (over = {}) => ({ action: 'confirm', idToken: 'tok', engagementId: 'ps-1', sessionId: 'cs_test_NEW', ...over });
const paidSession = (over = {}) => ({ id: 'cs_test_NEW', payment_status: 'paid', amount_total: 19900,
  currency: 'usd', payment_intent: 'pi_1', livemode: false,
  metadata: { engagementId: 'ps-1' }, customer_details: { email: 'alex@northwind.health' }, ...over });

let fail = 0;
const eq = (got, want, label) => { if (got !== want) throw new Error(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };
const sessions = () => CALLS.filter(c => /\/v1\/checkout\/sessions$/.test(c.url) && c.method === 'POST');
async function t(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; }
}

console.log('\n1. CHECKOUT — what it refuses BEFORE Stripe is called');

await t('an org whose licence already covers it is never sold one', async () => {
  seed({ org: { plan: { preset: 'assess', capabilities: { assess: true }, limits: { assessments: null, builds: 0, prescreens: null } } } });
  const r = await post(CO());
  eq(r.code, 409, 'status'); eq(r.payload.error, 'no_payment_needed', 'error');
  eq(sessions().length, 0, 'sessions created');
});
await t('a venture already paid for cannot be charged twice', async () => {
  seed({ eng: { payment: { status: 'paid', sessionId: 'cs_old' } } });
  const r = await post(CO());
  eq(r.code, 409, 'status'); eq(r.payload.error, 'already_paid', 'error');
  eq(sessions().length, 0, 'sessions created');
});
await t('a venture that is already full is not an upgrade', async () => {
  seed({ eng: { tier: 'full' } });
  eq((await post(CO())).payload.error, 'already_full', 'error');
  eq(sessions().length, 0, 'sessions created');
});
await t('someone outside the org gets nothing, and Stripe is never touched', async () => {
  seed(); CALLER = 'stranger@elsewhere.com';
  eq((await post(CO())).code, 403, 'status');
  eq(CALLS.length, 0, 'stripe calls');
});
await t('a price that disagrees with the page refuses the sale', async () => {
  seed(); PRICE = { unit_amount: 29900, currency: 'usd' };
  const r = await post(CO());
  eq(r.code, 409, 'status'); eq(r.payload.error, 'price_mismatch', 'error');
  eq(sessions().length, 0, 'sessions created');
});
await t('…and so does the wrong currency', async () => {
  seed(); PRICE = { unit_amount: 19900, currency: 'gbp' };
  eq((await post(CO())).payload.error, 'price_mismatch', 'error');
  eq(sessions().length, 0, 'sessions created');
});

console.log('\n2. CHECKOUT — the session it mints');

await t('it checks the price BEFORE minting a session', async () => {
  seed(); await post(CO());
  const priceAt = CALLS.findIndex(c => /\/v1\/prices\//.test(c.url));
  const sessAt = CALLS.findIndex(c => /\/v1\/checkout\/sessions$/.test(c.url) && c.method === 'POST');
  if (priceAt === -1 || sessAt === -1) throw new Error('expected both calls, got ' + CALLS.map(c => c.url).join(', '));
  if (priceAt > sessAt) throw new Error('the session was minted before the price was checked');
});
await t('the session names its venture, so it cannot unlock another', async () => {
  seed(); await post(CO());
  const b = sessions()[0].body;
  if (!b.includes('metadata%5BengagementId%5D=ps-1')) throw new Error('no engagement in metadata: ' + b);
  if (!b.includes('client_reference_id=ps-1')) throw new Error('no client_reference_id: ' + b);
});
await t('it comes back to the engagement, carrying the session id', async () => {
  seed(); await post(CO());
  const b = decodeURIComponent(sessions()[0].body);
  if (!/success_url=.*assess-next\?id=ps-1&paid=\{CHECKOUT_SESSION_ID\}/.test(b)) throw new Error('success_url: ' + b);
  if (!/cancel_url=.*paid=cancelled/.test(b)) throw new Error('cancel_url: ' + b);
});
await t('it returns a url and marks the engagement pending, in test mode', async () => {
  seed(); const r = await post(CO());
  eq(r.code, 200, 'status');
  if (!/^https:\/\/checkout\.stripe\.com\//.test(r.payload.url)) throw new Error('url: ' + r.payload.url);
  eq(r.payload.testMode, true, 'testMode');
  eq(DOCS.get('engagements/ps-1').payment.status, 'pending', 'written status');
  eq(DOCS.get('engagements/ps-1').tier, 'prescreen', 'tier must NOT move on checkout');
});

console.log('\n3. CONFIRM — what actually unlocks a venture');

await t('a session belonging to another venture is refused', async () => {
  seed(); SESSION = paidSession({ metadata: { engagementId: 'ps-SOMEONE-ELSE' }, client_reference_id: 'ps-SOMEONE-ELSE' });
  const r = await post(CF());
  eq(r.code, 409, 'status'); eq(r.payload.error, 'session_mismatch', 'error');
  if (DOCS.get('engagements/ps-1').payment) throw new Error('it wrote a payment anyway');
});
await t('an unpaid session is refused and writes nothing', async () => {
  seed(); SESSION = paidSession({ payment_status: 'unpaid' });
  const r = await post(CF());
  eq(r.code, 402, 'status'); eq(r.payload.error, 'not_paid', 'error');
  if (DOCS.get('engagements/ps-1').payment) throw new Error('it wrote a payment anyway');
});
await t('a paid session is recorded with its amount and currency', async () => {
  seed(); SESSION = paidSession();
  const r = await post(CF());
  eq(r.code, 200, 'status'); eq(r.payload.paid, true, 'paid');
  const pay = DOCS.get('engagements/ps-1').payment;
  eq(pay.status, 'paid', 'status'); eq(pay.amountTotal, 19900, 'amount'); eq(pay.currency, 'usd', 'currency');
  eq(pay.testMode, true, 'testMode'); eq(pay.sessionId, 'cs_test_NEW', 'sessionId');
});
await t('confirming does NOT itself flip the tier — that stays one endpoint', async () => {
  seed(); SESSION = paidSession(); await post(CF());
  eq(DOCS.get('engagements/ps-1').tier, 'prescreen', 'tier after confirm');
});
await t('confirming twice is idempotent and does not re-ask Stripe', async () => {
  seed(); SESSION = paidSession(); await post(CF());
  const before = CALLS.length;
  const r = await post(CF());
  eq(r.payload.already, true, 'already'); eq(CALLS.length, before, 'extra stripe calls');
});
await t('a made-up session id never reaches Stripe', async () => {
  seed();
  eq((await post(CF({ sessionId: 'hello' }))).code, 400, 'status');
  eq(CALLS.length, 0, 'stripe calls');
});

console.log('\n4. THE DOOR');
await t('no token, bad token, unknown action, wrong method', async () => {
  seed();
  eq((await post(CO({ idToken: undefined }))).code, 401, 'no token');
  seed(); eq((await post(CO({ idToken: 'bad' }))).code, 401, 'bad token');
  seed(); eq((await post({ action: 'free_money', idToken: 'tok', engagementId: 'ps-1' })).payload.error, 'bad_action', 'bad action');
  seed();
  let code = 0; const res = { setHeader() {}, end() {}, status(c) { code = c; return res; }, json() { return res; } };
  await handler({ method: 'GET', headers: {}, body: {} }, res);
  eq(code, 405, 'GET');
});

await t('an unknown action is refused BEFORE the token — the property contract.mjs needs', async () => {
  /* An endpoint that authenticates first answers 401 to a real action and an invented one alike,
     so nothing outside can prove the door for `checkout` opens. That is the exact blindness the
     whole contract gate exists to remove, and it is one line away at all times. */
  seed();
  const bad = await post({ action: 'free_money', engagementId: 'ps-1' });       // no token at all
  eq(bad.code, 400, 'invented action, no token');
  eq(bad.payload.error, 'bad_action', 'error');
  const real = await post({ action: 'checkout', engagementId: 'ps-1' });        // real action, no token
  eq(real.code, 401, 'real action, no token');
  if (bad.code === real.code) throw new Error('a real action and an invented one are indistinguishable');
});

if (CANARY) {
  console.log(fail ? '\ncanary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
console.log(fail ? `\n${fail} FAILED` : '\n✓ nobody is charged for what they own, and nothing unlocks without Stripe saying so');
process.exit(fail ? 1 : 0);
