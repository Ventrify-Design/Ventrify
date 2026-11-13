/**
 * tools/intake-run-contract.mjs — EXERCISES /api/intake-run. Offline, $0, ~1 second.
 *
 * The sweeper turns a widget submission into a real pre-screen. It runs unattended,
 * on a schedule, against a live customer org — which is the worst possible place to
 * find out that a partner name resolved somewhere it should not have.
 *
 * So this gate does not read intake-run.js. It replaces firebase-admin and the three
 * handlers it calls in the require cache, then drives the real handler and asserts on
 * what actually happened: which org it chose, what it refused, where it put the deck,
 * and whether a second tick can lap the first.
 *
 *   node tools/intake-run-contract.mjs            run it
 *   node tools/intake-run-contract.mjs --canary   prove the gate can fail
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CANARY = process.argv.includes('--canary');

/* ── the fake world ──────────────────────────────────────────────────────────
   Queries ARE allowed here, unlike the /api/intake gate — but only the shape
   Firestore serves from an automatic single-field index. A `where` paired with an
   `orderBy` on another field, or a second `where`, needs a composite index and is
   exactly how /api/intake 500'd in front of a founder. The fake refuses both. */
let DOCS = new Map(), FILES = new Set(), COPIES = [], CALLS = [], WHERES = 0;
const k = (c, i) => c + '/' + i;
const snapOf = (c, i, d) => ({ id: i, ref: docApi(c, i), exists: !!d, data: () => d });

function docApi(col, id) {
  return {
    id, __col: col,
    set: async (v, o) => DOCS.set(k(col, id), { ...(o && o.merge ? DOCS.get(k(col, id)) : null), ...v }),
    get: async () => snapOf(col, id, DOCS.get(k(col, id))),
  };
}
function queryApi(col, filters) {
  return {
    where(f, op, v) {
      WHERES++;
      if (filters.length) throw new Error('COMPOSITE INDEX: a second where() on ' + col +
        ' pairs two fields. Firestore refuses that without a purpose-built index — ' +
        'the failure mode that took /api/intake down. Filter in JS instead.');
      if (op !== 'in' && op !== '==') throw new Error('range operator ' + op + ' needs a composite index');
      return queryApi(col, filters.concat([[f, op, v]]));
    },
    orderBy(f) {
      throw new Error('COMPOSITE INDEX: orderBy(' + f + ') beside a where() needs a composite index. Sort in JS.');
    },
    limit() { return this; },
    get: async () => {
      const [f, op, v] = filters[0] || [];
      const out = [];
      for (const [key, d] of DOCS) {
        if (!key.startsWith(col + '/')) continue;
        const id = key.slice(col.length + 1);
        const hit = !filters.length || (op === 'in' ? v.includes(d[f]) : d[f] === v);
        if (hit) out.push(snapOf(col, id, d));
      }
      return { docs: out, empty: !out.length };
    },
  };
}
const db = {
  collection: col => ({ doc: id => docApi(col, id), ...queryApi(col, []) }),
  runTransaction: async fn => fn({
    get: async ref => ref.get(),
    set: (ref, v, o) => { const key = k(ref.__col, ref.id);
                          DOCS.set(key, { ...(o && o.merge ? DOCS.get(key) : null), ...v }); },
  }),
};
const fileApi = path => ({
  name: path,
  exists: async () => [FILES.has(path)],
  copy: async dest => { COPIES.push([path, dest.name]); FILES.add(dest.name); },
});
const admin = {
  apps: [], initializeApp() { this.apps.push(1); },
  credential: { cert: () => ({}) },
  firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => new Date() } }),
  storage: () => ({ bucket: () => ({ file: fileApi }) }),
};
const stub = (mod, exports) => {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
};
stub('firebase-admin', admin);
stub('../api/_auth.js', { idTokenFor: async e => ({ idToken: 'tok:' + e, uid: 'u', email: e }) });

/* The three handlers, recorded rather than run. FAIL_AT makes one of them refuse, so
   the "a broken phase stops the pipeline" rule is exercised and not assumed. */
let FAIL_AT = null;
const handlerStub = name => async (req, res) => {
  CALLS.push({ name, body: req.body });
  const tag = name === 'memo' ? (req.body.nugget ? 'nugget:' + req.body.nugget : req.body.action) : name;
  if (FAIL_AT === tag) { res.status(500).json({ error: 'boom' }); return; }
  res.status(200).json({ ok: true });
};
stub('../api/memo.js', handlerStub('memo'));
stub('../api/ingest-docs.js', handlerStub('ingest'));
stub('../api/send-email.js', handlerStub('email'));

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
const E = require('../api/_prescreen2.js');
const handler = require('../api/intake-run.js');

const call = async (headers = {}) => {
  let code = 0, payload = null;
  const res = { setHeader() {}, end() {}, status(c) { code = c; return res; }, json(j) { payload = j; return res; } };
  await handler({ method: 'POST', body: {}, headers, socket: {} }, res);
  return { code, payload };
};

/** One submitted intake, exactly as /api/intake writes it. */
function seed(over = {}) {
  DOCS = new Map(); FILES = new Set(); COPIES = []; CALLS = []; WHERES = 0; FAIL_AT = null;
  DOCS.set('intakes/I1', {
    state: 'submitted', partner: 'TCA Venture Group', email: 'alex@northwind.health',
    name: 'Alex Moreau', company: 'Northwind Health', shareWithPartner: true,
    deckPath: 'intake/I1/deck.pdf', deckFileName: 'deck.pdf',
    createdAt: new Date(), leaseUntil: 0, ...over,
  });
  DOCS.set('organisations/tca-widget', { name: 'TCA (widget)', operatorEmails: ['svc@ventrify.io'] });
  DOCS.set('organisations/default', { name: 'TCA Venture Group', operatorEmails: ['svc@ventrify.io'] });
  FILES.add('intake/I1/deck.pdf');
  process.env.INTAKE_PARTNER_ORGS = 'TCA Venture Group=tca-widget';
  process.env.INTAKE_RUN_OPERATOR = 'svc@ventrify.io';
  delete process.env.CRON_SECRET;
}
/** Drive it to completion the way the workflow's poll loop does. */
async function drain(max = 20) {
  let r, n = 0;
  do { r = await call(); n++; } while (r.payload && r.payload.more && n < max);
  return r;
}

let fails = 0;
const t = async (what, fn) => {
  try { await fn(); console.log('  ✓ ' + what); }
  catch (e) { fails++; console.log('  ✗ ' + what + ' — ' + e.message); }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

console.log('\n1. THE PARTNER NAME NEVER PICKS THE ORG');

await t('an unmapped partner FAILS CLOSED — it does not fall back to `default`', async () => {
  seed({ partner: 'Someone Else' });
  const r = await call();
  eq(r.payload.failed, 'partner_unmapped', 'reason');
  eq(DOCS.get('intakes/I1').state, 'failed', 'state');
  if (DOCS.get('intakes/I1').orgId) throw new Error('it resolved an org anyway');
  if ([...DOCS.keys()].some(x => x.startsWith('engagements/'))) throw new Error('it created an engagement');
});

await t('`default` — which IS the live TCA workspace — is never reachable by name', async () => {
  seed({ partner: 'default' });
  const r = await call();
  eq(r.payload.failed, 'partner_unmapped', 'reason');
});

await t('a mapped partner resolves to the mapped org, not the one sharing its name', async () => {
  seed();
  await drain();
  eq(DOCS.get('intakes/I1').orgId, 'tca-widget', 'orgId');
  eq(DOCS.get('engagements/ps-I1').orgId, 'tca-widget', 'engagement orgId');
});

await t('an operator missing from the org fails closed too', async () => {
  seed(); process.env.INTAKE_RUN_OPERATOR = 'nobody@ventrify.io';
  const r = await call();
  eq(r.payload.failed, 'operator_not_in_org', 'reason');
});

console.log('\n2. IT CANNOT ASK FIRESTORE FOR AN INDEX IT HAS NOT GOT');

await t('exactly one where(), single-field, no orderBy', async () => {
  seed();
  await call();
  if (WHERES !== 1) throw new Error('where() called ' + WHERES + ' times');
});

console.log('\n3. TWO TICKS CANNOT RUN ONE FOUNDER TWICE');

await t('a live lease hides the intake from the next tick', async () => {
  seed({ leaseUntil: Date.now() + 60000 });
  const r = await call();
  eq(r.payload.idle, true, 'should find nothing claimable');
});

await t('an EXPIRED lease is picked back up — a crashed tick does not strand the founder', async () => {
  seed({ state: 'running', leaseUntil: Date.now() - 1000, step: 'ps2-band' });
  const r = await call();
  if (r.payload.idle) throw new Error('it ignored a stranded intake');
});

await t('it resumes from the cursor instead of restarting the pipeline', async () => {
  seed({ state: 'running', step: 'ps2-band', leaseUntil: 0 });
  await drain();
  if (CALLS.some(c => c.body && c.body.action === 'ps2-brief')) throw new Error('it re-ran phase 1');
});

console.log('\n4. THE DECK GOES WHERE ingest-docs WILL ACCEPT IT');

await t('the intake deck is COPIED into founder-docs/<engagementId>/, not passed by its intake path', async () => {
  seed();
  await drain();
  eq(COPIES.length, 1, 'copies');
  eq(COPIES[0][1], 'founder-docs/ps-I1/deck.pdf', 'destination');
  const ing = CALLS.find(c => c.name === 'ingest');
  if (!ing) throw new Error('ingest-docs was never called');
  if (!ing.body.storagePath.startsWith('founder-docs/ps-I1/'))
    throw new Error('ingest got ' + ing.body.storagePath + ' — ingest-docs.js:186 would 403 that');
  eq(ing.body.docType, 'pitch', 'docType');
});

await t('a missing deck fails closed rather than pre-screening an empty venture', async () => {
  seed(); FILES.clear();
  await drain();
  eq(DOCS.get('intakes/I1').state, 'failed', 'state');
  eq(DOCS.get('intakes/I1').failedReason, 'deck_missing', 'reason');
});

console.log('\n5. BOTH SIDES CAN READ THE RESULT (firestore.rules:51)');

await t('the engagement carries the partner orgId AND the founder email', async () => {
  seed();
  await drain();
  const e = DOCS.get('engagements/ps-I1');
  eq(e.orgId, 'tca-widget', 'orgId — what isOperatorOf() reads');
  eq(e.founderEmail, 'alex@northwind.health', 'founderEmail — what the founder rule reads');
  eq(e.tier, 'prescreen', 'tier');
  eq(e.source, 'widget', 'source');
});

console.log('\n6. THE WHOLE PIPELINE RUNS, AND NOTHING IS SKIPPED');

await t('every nugget in _prescreen2.NUGGETS is actually run', async () => {
  seed();
  await drain();
  const ran = CALLS.filter(c => c.body && c.body.action === 'ps2-nugget').map(c => c.body.nugget);
  for (const n of E.NUGGETS) if (!ran.includes(n.key)) throw new Error('never ran nugget ' + n.key);
  eq(ran.length, E.NUGGETS.length, 'nugget count');
});

await t('brief → research → nuggets → band → email, in that order, then done', async () => {
  seed();
  const r = await drain();
  const acts = CALLS.filter(c => c.name === 'memo').map(c => c.body.action);
  eq(acts[0], 'ps2-brief', 'first phase');
  eq(acts[1], 'ps2-research', 'second phase');
  eq(acts[acts.length - 1], 'ps2-band', 'last phase');
  if (!CALLS.some(c => c.name === 'email')) throw new Error('the founder was never told');
  eq(DOCS.get('intakes/I1').state, 'done', 'final state');
  eq(r.payload.more, false, 'more');
});

await t('the founder is emailed a link that lands on THEIR engagement', async () => {
  seed();
  await drain();
  const m = CALLS.find(c => c.name === 'email');
  if (!m.body.continueUrl.includes('id=ps-I1')) throw new Error('continueUrl: ' + m.body.continueUrl);
  eq(m.body.email, 'alex@northwind.health', 'recipient');
});

await t('a phase that fails stops the pipeline and says which one', async () => {
  seed(); FAIL_AT = 'nugget:bear';
  await drain();
  const d = DOCS.get('intakes/I1');
  eq(d.state, 'failed', 'state');
  if (!/nugget:bear/.test(d.failedDetail || '')) throw new Error('detail: ' + d.failedDetail);
  if (CALLS.some(c => c.name === 'email')) throw new Error('it emailed the founder about a run that broke');
});

console.log('\n7. THE DOOR IS LOCKED WHEN A SECRET IS SET');

await t('CRON_SECRET, when set, is required', async () => {
  seed(); process.env.CRON_SECRET = 's3cret';
  eq((await call()).code, 401, 'without the bearer');
  eq((await call({ authorization: 'Bearer s3cret' })).code, 200, 'with it');
  delete process.env.CRON_SECRET;
});

/* ── the canary ───────────────────────────────────────────────────────────────
   A gate that cannot fail is decoration. The check that matters most is §1: an
   unmapped partner must never reach an org. So rig the mapping so that it DOES —
   point the unknown partner straight at `default`, the live TCA workspace — and
   assert §1 notices. If it still reports a pass, the check is not reading anything. */
if (CANARY) {
  console.log('\nCANARY — rig an unmapped partner to reach `default`, and §1 must object');
  seed({ partner: 'Someone Else' });
  process.env.INTAKE_PARTNER_ORGS = 'Someone Else=default';   // the bug, injected
  const r = await call();
  const stillRefused = r.payload.failed === 'partner_unmapped';
  const reached = DOCS.get('intakes/I1').orgId === 'default';
  if (stillRefused || !reached) {
    console.log('  \u2717 CANARY DID NOT FIRE — the handler refused even a mapped partner, so \u00a71 proves nothing');
    fails++;
  } else {
    console.log('  \u2713 canary fired: with the mapping rigged, the intake reached `default` and state is "'
      + DOCS.get('intakes/I1').state + '" — which is exactly what \u00a71 asserts can never happen unmapped');
  }
}

console.log(fails
  ? `\n${fails} check(s) failed`
  : '\n✓ /api/intake-run resolves, refuses, leases and runs — and needs no index\n');
process.exit(fails ? 1 : 0);
