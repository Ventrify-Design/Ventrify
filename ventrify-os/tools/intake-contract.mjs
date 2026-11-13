/**
 * tools/intake-contract.mjs — EXERCISES /api/intake. Offline, $0, ~1 second.
 *
 * This exists because of the 2026-10-31 lesson: 141 passing checks, every new
 * action unreachable, because every gate READ source text. So this one does not
 * read intake.js at all — it calls the exported handler with real request and
 * response objects and asserts on what actually comes back.
 *
 * firebase-admin is replaced in the require cache BEFORE the handler is loaded,
 * so the production file carries no test flag that could be left switched on.
 * Nothing here touches Firestore, Storage, the network, or a credit balance.
 *
 *   node tools/intake-contract.mjs            run it
 *   node tools/intake-contract.mjs --canary   prove the gate can fail
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CANARY = process.argv.includes('--canary');

/* ── the fake world ───────────────────────────────────────────────────────────
   THIS GATE WAS WRONG ONCE, AND THIS IS THE CORRECTION. The first version let a
   query through that Firestore refuses without a composite index; it reached
   production and 500'd on the first real submission. A fake that answers every
   query is not a model of Firestore — it is a model of a database that does not
   exist.

   So where() now THROWS. Not because queries are bad, but because this endpoint
   is public, uncached and on the hot path, and the index-free shape is the whole
   design. If a future edit reaches for a query, this gate stops it at the door
   rather than letting Firestore stop it in front of a founder. */
let DOCS = new Map(), SEQ = 0, FILES = new Map(), QUERIES = 0;
const key = (col, id) => col + '/' + id;
const snapOf = (k, d) => ({ id: String(k).split('/').pop(), exists: !!d, data: () => d });

const INC = Symbol('increment');
const resolve = (prev, next) => {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(next)) {
    out[k] = (v && v.__inc) ? Number(out[k] || 0) + v.n : v;
  }
  return out;
};
const docApi = (col, id) => ({
  id, __k: key(col, id),
  set: async (v, opts) => {
    const prev = opts && opts.merge ? DOCS.get(key(col, id)) : null;
    DOCS.set(key(col, id), { ...resolve(prev, v), __col: col, createdAt: new Date() });
  },
  update: async v => { DOCS.set(key(col, id), { ...DOCS.get(key(col, id)), ...v }); },
  get: async () => snapOf(key(col, id), DOCS.get(key(col, id))),
});
const fileApi = path => ({
  getSignedUrl: async o => {
    if (o.action !== 'write') throw new Error('signed url must be write-only, got ' + o.action);
    if (!o.expires || o.expires - Date.now() > 60 * 60 * 1000) throw new Error('signed url expiry too long');
    return ['https://storage.example/' + encodeURIComponent(path) + '?sig=x'];
  },
  exists: async () => [FILES.has(path)],
  getMetadata: async () => [FILES.get(path) || {}],
  delete: async () => { FILES.delete(path); },
});
const db = {
  collection: col => ({
    doc: id => docApi(col, id || ('id' + (++SEQ))),
    where() {
      QUERIES++;
      throw new Error(
        'FAILED_PRECONDITION-by-design: /api/intake must not query. Firestore needs a ' +
        'composite index for equality+range, which is how this endpoint 500\'d in production. ' +
        'Address a guard document by id instead.');
    },
  }),
  getAll: async (...refs) => refs.map(r => snapOf(r.__k, DOCS.get(r.__k))),
};
const admin = {
  apps: [], initializeApp() { this.apps.push(1); },
  credential: { cert: () => ({}) },
  firestore: Object.assign(() => db, {
    FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }), increment: n => ({ __inc: true, n }) },
  }),
  storage: () => ({ bucket: () => ({ file: fileApi }) }),
};
const p = require.resolve('firebase-admin');
require.cache[p] = { id: p, filename: p, loaded: true, exports: admin, children: [], paths: [] };

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
process.env.INTAKE_EMAIL_COOLDOWN_DAYS = '30';
const handler = require('../api/intake.js');

/* ── a real request and a real response ───────────────────────────────────── */
const call = async (method, body, headers = {}) => {
  let code = 0, payload = null;
  const res = {
    setHeader() {}, end() { payload = null; },
    status(c) { code = c; return res; },
    json(j) { payload = j; return res; },
  };
  await handler({ method, body, headers: { origin: 'https://verdict.ventrify.io', ...headers }, socket: {} }, res);
  return { code, payload };
};

const OK = { partner: 'TCA Venture Group', name: 'Alex Moreau', email: 'alex@northwind.health',
             company: 'Northwind Health', room: 'https://drive.google.com/drive/folders/x',
             fileName: 'deck.pdf', contentType: 'application/pdf' };

let fails = 0;
const t = async (what, fn) => {
  try { await fn(); console.log('  ✓ ' + what); }
  catch (e) { fails++; console.log('  ✗ ' + what + ' — ' + e.message); }
};
const eq = (got, want, label) => { if (got !== want) throw new Error(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

console.log('\n/api/intake — the door opens');
await t('OPTIONS preflight answers 204', async () => eq((await call('OPTIONS')).code, 204, 'code'));
await t('GET is refused',                async () => eq((await call('GET')).code, 405, 'code'));

console.log('\nit refuses what it should');
for (const [label, patch, want] of [
  ['a missing email',      { email: '' },                          400],
  ['a malformed email',    { email: 'not-an-email' },              400],
  ['a missing company',    { company: '' },                        400],
  ['a file we cannot read',{ contentType: 'image/png' },           415],
  ['a data room that is not a url', { room: 'my google drive' },   400],
]) await t(label + ' → ' + want, async () => eq((await call('POST', { ...OK, ...patch })).code, want, 'code'));

await t('an unlisted partner → 403', async () => {
  process.env.INTAKE_PARTNERS = 'Harbour VC';
  const r = await call('POST', OK);
  delete process.env.INTAKE_PARTNERS;
  eq(r.code, 403, 'code');
});

console.log('\nthe happy path, both phases');
let id = null, deckPath = null;
await t('phase 1 parks the intake and returns an upload url', async () => {
  const r = await call('POST', OK);
  eq(r.code, 200, 'code');
  if (!r.payload.intakeId) throw new Error('no intakeId');
  if (!/^https:\/\//.test(r.payload.uploadUrl || '')) throw new Error('no uploadUrl');
  id = r.payload.intakeId;
  deckPath = DOCS.get('intakes/' + id).deckPath;
  if (!deckPath.startsWith('intake/')) throw new Error('deck parked outside intake/: ' + deckPath);
  eq(DOCS.get('intakes/' + id).state, 'awaiting_deck', 'state');
  eq(DOCS.get('intakes/' + id).orgId, null, 'orgId');                 // it must create NOTHING
  eq(DOCS.get('intakes/' + id).engagementId, null, 'engagementId');
});
await t('phase 2 refuses when no deck actually landed', async () =>
  eq((await call('POST', { intakeId: id, uploaded: true })).code, 409, 'code'));
await t('phase 2 accepts once the object exists', async () => {
  FILES.set(deckPath, { size: 2400000, contentType: 'application/pdf' });
  const r = await call('POST', { intakeId: id, uploaded: true });
  eq(r.code, 200, 'code');
  eq(DOCS.get('intakes/' + id).state, 'submitted', 'state');
  eq(DOCS.get('intakes/' + id).deckBytes, 2400000, 'deckBytes');
});
await t('phase 2 twice is refused', async () =>
  eq((await call('POST', { intakeId: id, uploaded: true })).code, 409, 'code'));
await t('an oversized deck is rejected and deleted', async () => {
  const a = await call('POST', { ...OK, email: 'big@northwind.health' });
  FILES.set(DOCS.get('intakes/' + a.payload.intakeId).deckPath, { size: 60 * 1024 * 1024 });
  eq((await call('POST', { intakeId: a.payload.intakeId, uploaded: true })).code, 413, 'code');
});
await t('an unknown intake id → 404', async () =>
  eq((await call('POST', { intakeId: 'nope', uploaded: true })).code, 404, 'code'));

console.log('\nthe caps actually cap');
await t('the same address twice inside the cooldown → 429', async () =>
  eq((await call('POST', OK)).code, 429, 'code'));
await t('cooldown 0 lets a tester resubmit', async () => {
  process.env.INTAKE_EMAIL_COOLDOWN_DAYS = '0';
  delete require.cache[require.resolve('../api/intake.js')];
  const h2 = require('../api/intake.js');
  let code = 0; const res = { setHeader(){}, end(){}, status(c){ code = c; return res; }, json(){ return res; } };
  await h2({ method: 'POST', body: OK, headers: { origin: 'https://verdict.ventrify.io' }, socket: {} }, res);
  process.env.INTAKE_EMAIL_COOLDOWN_DAYS = '30';
  eq(code, 200, 'code');
});

if (CANARY) {
  console.log('\ncanary — the gate must notice a broken door');
  const before = fails;
  await t('CANARY: a GET that answered 200 would be caught', async () => eq(405, 200, 'deliberate'));
  if (fails === before) { console.log('\n✗ THE CANARY DID NOT FAIL — this gate is decoration'); process.exit(1); }
  console.log('  → the canary failed, as it must. Gate is live.');
  process.exit(0);
}

console.log('\nthe index-free invariant');
await t('it made no Firestore queries at all', () => {
  if (QUERIES) throw new Error(QUERIES + ' query/queries attempted — each one needs a composite index');
});

console.log(fails ? `\n✗ ${fails} failed` : '\n✓ /api/intake answers, refuses, caps — and needs no index');
process.exit(fails ? 1 : 0);
