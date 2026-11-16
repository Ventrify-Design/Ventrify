/**
 * tools/prescreen-ready-contract.mjs — EXERCISES the `prescreen-ready` branch of /api/send-email.
 * Offline, $0, nothing is sent, ~1 second.
 *
 * This is the one email a widget founder ever gets. They were a stranger on an angel group's
 * website six minutes earlier, and for as long as the sweeper existed they received the generic
 * "Sign in to your Workspace" — no verdict, no band, no mention of the group they trusted with a
 * deck. The fix is a branch that reads everything from the engagement, which is precisely the kind
 * of code that passes a grep and fails in an inbox: EVERY FIELD NAME BELOW WAS READ OFF A REAL
 * FINISHED ENGAGEMENT rather than invented, because inventing field names and then asserting my
 * own invention is the failure class this file exists to end.
 *
 * It replaces firebase-admin and global fetch in the require cache, drives the real handler, and
 * asserts on what would have reached Resend.
 *
 *   node tools/prescreen-ready-contract.mjs            run it
 *   node tools/prescreen-ready-contract.mjs --canary   prove the gate can fail
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CANARY = process.argv.includes('--canary');

let DOCS = new Map(), SENT = [], MINTED = [], CALLER = 'sweeper@ventrify.io';

const snapOf = d => ({ exists: !!d, data: () => d });
const db = {
  collection: col => ({ doc: id => ({
    get: async () => snapOf(DOCS.get(col + '/' + id)),
    set: async () => {},
  }) }),
};
const admin = {
  apps: [], initializeApp() { this.apps.push(1); }, credential: { cert: () => ({}) },
  firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => new Date() } }),
  auth: () => ({
    verifyIdToken: async t => { if (t === 'bad') throw new Error('invalid'); return { email: CALLER }; },
    /* The mint is recorded, not performed. WHO the link was issued to is the security property
       worth asserting: a sign-in link is a credential, so a link minted for the wrong address is
       an account-takeover primitive and not a cosmetic bug. */
    generateSignInWithEmailLink: async (email, opts) => {
      MINTED.push({ email, url: opts.url });
      return 'https://os.ventrify.io/__/auth/action?oobCode=XYZ&continueUrl=' + encodeURIComponent(opts.url);
    },
  }),
};
const stub = (mod, exports) => {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
};
stub('firebase-admin', admin);

globalThis.fetch = async (url, opts) => {
  SENT.push(JSON.parse(opts.body));
  return { ok: true, text: async () => '', json: async () => ({}) };
};

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
process.env.RESEND_API_KEY = 'test-key';
const handler = require('../api/send-email.js');
const { bandOf } = await import('../shared/prescreen-bands.js');

const post = async body => {
  let code = 0, payload = null;
  const res = { setHeader() {}, end() {}, status(c) { code = c; return res; }, json(j) { payload = j; return res; } };
  await handler({ method: 'POST', body, headers: {} }, res);
  return { code, payload };
};

/** A finished widget pre-screen, in the shape /api/intake-run.js actually writes. */
function seed(engOver = {}, orgOver = {}) {
  DOCS = new Map(); SENT = []; MINTED = []; CALLER = 'sweeper@ventrify.io';
  DOCS.set('organisations/northwind-health', {
    name: 'Northwind Health', ownerEmail: 'alex@northwind.health',
    operatorEmails: ['alex@northwind.health', 'sweeper@ventrify.io'], ...orgOver,
  });
  DOCS.set('engagements/ps-1', {
    engagementType: 'assessment', tier: 'prescreen', name: 'Northwind Health',
    orgId: 'northwind-health', partnerOrgId: 'tca-widget', partner: 'TCA Venture Group',
    founderEmail: 'alex@northwind.health', stage: 'Pre-seed', shareWithPartner: true,
    prescreen2: {
      v: 2, state: 'done', band: 'MEDIUM',
      basis: 'Read from 17 documents and 46 public sources.',
      brief: { oneLine: 'A muon detector that finds copper without drilling.' },
    },
    ...engOver,
  });
}
const ready = (over = {}) => ({ type: 'prescreen-ready', idToken: 'tok', engagementId: 'ps-1',
                                email: 'alex@northwind.health', ...over });

let fail = 0;
const eq = (got, want, label) => { if (got !== want) throw new Error(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };
const has = (hay, needle, label) => { if (!String(hay).includes(needle)) throw new Error(`${label}: missing ${JSON.stringify(needle)}`); };
const hasnt = (hay, needle, label) => { if (String(hay).includes(needle)) throw new Error(`${label}: should not contain ${JSON.stringify(needle)}`); };
async function t(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; }
}

console.log('\n1. WHAT ACTUALLY ARRIVES');

await t('it sends one email, to the founder on the engagement', async () => {
  seed(CANARY ? { prescreen2: { v: 2, state: 'running', band: 'MEDIUM' } } : {});
  const r = await post(ready());
  eq(r.code, 200, 'status');
  eq(SENT.length, 1, 'emails sent');
  eq(SENT[0].to[0], 'alex@northwind.health', 'recipient');
  has(SENT[0].subject, 'Northwind Health', 'subject names the company');
  has(SENT[0].subject, 'pre-screen is ready', 'subject says what it is');
});

await t('it says which partner it came through — the "why am I getting this" line', async () => {
  seed();
  await post(ready());
  has(SENT[0].html, 'Submitted via TCA Venture Group', 'attribution');
});

await t('the band is the product vocabulary, not a fourth copy of it', async () => {
  seed();
  await post(ready());
  const b = bandOf('MEDIUM');
  has(SENT[0].html, b.label, 'band label from shared/prescreen-bands.js');
  has(SENT[0].html, b.line, 'band line from shared/prescreen-bands.js');
});

await t('it proves the deck was read: the one-line and the basis', async () => {
  seed();
  await post(ready());
  has(SENT[0].html, 'muon detector that finds copper', 'one-line read');
  has(SENT[0].html, 'Read from 17 documents and 46 public sources.', 'basis');
});

await t('the way in is a link minted FOR THE FOUNDER, landing on their engagement', async () => {
  seed();
  await post(ready());
  eq(MINTED.length, 1, 'links minted');
  eq(MINTED[0].email, 'alex@northwind.health', 'minted for');
  has(MINTED[0].url, 'id=ps-1', 'lands on the engagement');
  has(MINTED[0].url, 'vse=', 'carries the address, or sign-in prompts for it');
  has(SENT[0].html, 'oobCode=XYZ', 'the email contains the minted link');
});

await t('the sharing promise is kept in the email too', async () => {
  seed();
  await post(ready());
  has(SENT[0].html, 'cannot see your deck', 'the deck promise');
  seed({ shareWithPartner: false });
  await post(ready());
  hasnt(SENT[0].html, 'can see this verdict', 'nothing shared, nothing claimed');
});

await t('a founder who came in direct is told nothing about a partner', async () => {
  seed({ partner: '' });
  await post(ready());
  hasnt(SENT[0].html, 'Submitted via', 'no partner to name');
});

console.log('\n2. WHAT IT REFUSES');

await t('a caller who is not an operator of the founder org gets nothing', async () => {
  seed();
  CALLER = 'stranger@elsewhere.com';
  const r = await post(ready());
  eq(r.code, 403, 'status');
  eq(SENT.length, 0, 'emails sent');
  eq(MINTED.length, 0, 'links minted');
});

await t('it never announces a verdict that has not finished', async () => {
  seed({ prescreen2: { v: 2, state: 'running', band: 'MEDIUM' } });
  const r = await post(ready());
  eq(r.code, 409, 'status');
  eq(r.payload.error, 'not_prescreened', 'error');
  eq(SENT.length, 0, 'emails sent');
});

await t('a pre-v2 snapshot is refused rather than rendered wrong', async () => {
  seed({ prescreen2: { v: 1, state: 'done', band: 'MEDIUM' } });
  eq((await post(ready())).code, 409, 'status');
});

await t('the caller cannot choose the recipient of a credential', async () => {
  seed();
  const r = await post(ready({ email: 'attacker@elsewhere.com' }));
  eq(r.code, 409, 'status');
  eq(r.payload.error, 'recipient_mismatch', 'error');
  eq(MINTED.length, 0, 'no link was minted for the wrong address');
  eq(SENT.length, 0, 'emails sent');
});

await t('a bad token, a missing engagement and a missing id all refuse', async () => {
  seed();
  eq((await post(ready({ idToken: 'bad' }))).code, 401, 'bad token');
  seed();
  eq((await post(ready({ engagementId: 'nope' }))).code, 404, 'missing engagement');
  seed();
  eq((await post(ready({ engagementId: '' }))).code, 400, 'missing id');
  eq(SENT.length, 0, 'emails sent');
});

if (CANARY) {
  console.log(fail ? '\ncanary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
console.log(fail ? `\n${fail} FAILED` : '\n✓ the founder is told what happened, by the only caller allowed to say it');
process.exit(fail ? 1 : 0);
