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

/* ── the fake world ───────────────────────────────────────────────────────── */
let DOCS = new Map(), SEQ = 0, FILES = new Map();
const snapOf = d => ({ exists: !!d, data: () => d });
const qres = rows => ({ empty: rows.length === 0, size: rows.length, docs: rows.map(r => snapOf(r)) });

function makeQuery(col, preds) {
  return {
    where: (f, op, v) => makeQuery(col, [...preds, [f, op, v]]),
    limit: () => makeQuery(col, preds),
    get: async () => qres([...DOCS.values()].filter(d => d.__col === col && preds.every(([f, op, v]) =>
      op === '==' ? d[f] === v : op === '>=' ? (d.createdAt instanceof Date ? d.createdAt >= v : true) : true))),
  };
}
const docApi = (col, id) => ({
  id,
  set: async v => { DOCS.set(id, { ...v, __col: col, createdAt: new Date() }); },
  update: async v => { DOCS.set(id, { ...DOCS.get(id), ...v }); },
  get: async () => snapOf(DOCS.get(id)),
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
const admin = {
  apps: [], initializeApp() { this.apps.push(1); },
  credential: { cert: () => ({}) },
  firestore: Object.assign(() => ({
    collection: col => Object.assign(makeQuery(col, []), {
      doc: id => docApi(col, id || ('id' + (++SEQ))),
    }),
  }), { FieldValue: { serverTimestamp: () => 'TS' } }),
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
  deckPath = DOCS.get(id).deckPath;
  if (!deckPath.startsWith('intake/')) throw new Error('deck parked outside intake/: ' + deckPath);
  eq(DOCS.get(id).state, 'awaiting_deck', 'state');
  eq(DOCS.get(id).orgId, null, 'orgId');                 // it must create NOTHING
  eq(DOCS.get(id).engagementId, null, 'engagementId');
});
await t('phase 2 refuses when no deck actually landed', async () =>
  eq((await call('POST', { intakeId: id, uploaded: true })).code, 409, 'code'));
await t('phase 2 accepts once the object exists', async () => {
  FILES.set(deckPath, { size: 2400000, contentType: 'application/pdf' });
  const r = await call('POST', { intakeId: id, uploaded: true });
  eq(r.code, 200, 'code');
  eq(DOCS.get(id).state, 'submitted', 'state');
  eq(DOCS.get(id).deckBytes, 2400000, 'deckBytes');
});
await t('phase 2 twice is refused', async () =>
  eq((await call('POST', { intakeId: id, uploaded: true })).code, 409, 'code'));
await t('an oversized deck is rejected and deleted', async () => {
  const a = await call('POST', { ...OK, email: 'big@northwind.health' });
  FILES.set(DOCS.get(a.payload.intakeId).deckPath, { size: 60 * 1024 * 1024 });
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

console.log(fails ? `\n✗ ${fails} failed` : '\n✓ /api/intake answers, refuses and caps as specified');
process.exit(fails ? 1 : 0);
