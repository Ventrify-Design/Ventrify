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
import { readFileSync } from 'node:fs';
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

/* arrayUnion is RESOLVED, not stored. A fake that keeps the sentinel verbatim would let
   'the sweeper is an operator of the founder org' pass while the array never changed. */
const merge = (prev, next) => {
  const out = { ...(prev || {}) };
  for (const [key, v] of Object.entries(next)) {
    out[key] = (v && v.__union)
      ? [...new Set([...(Array.isArray(out[key]) ? out[key] : []), ...v.__union])]
      : v;
  }
  return out;
};
function docApi(col, id) {
  return {
    id, __col: col,
    set: async (v, o) => DOCS.set(k(col, id), merge(o && o.merge ? DOCS.get(k(col, id)) : null, v)),
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
      if (!['in', '==', 'array-contains'].includes(op))
        throw new Error('operator ' + op + ' is not served by an automatic single-field index');
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
        const hit = !filters.length
          || (op === 'in' ? v.includes(d[f])
          : op === 'array-contains' ? Array.isArray(d[f]) && d[f].includes(v)
          : d[f] === v);
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
                          DOCS.set(key, merge(o && o.merge ? DOCS.get(key) : null, v)); },
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
  firestore: Object.assign(() => db, {
    FieldValue: { serverTimestamp: () => new Date(), arrayUnion: (...a) => ({ __union: a }) },
  }),
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
let FAIL_AT = null, REPLY_AT = null;
const handlerStub = name => async (req, res) => {
  CALLS.push({ name, body: req.body });
  const tag = name === 'memo' ? (req.body.nugget ? 'nugget:' + req.body.nugget : req.body.action) : name;
  if (REPLY_AT && REPLY_AT.tag === tag) { res.status(REPLY_AT.status).json(REPLY_AT.body); return; }
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
  DOCS = new Map(); FILES = new Set(); COPIES = []; CALLS = []; WHERES = 0; FAIL_AT = null; REPLY_AT = null;
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
  eq(DOCS.get('intakes/I1').orgId, 'tca-widget', 'intake orgId (the partner)');
  eq(DOCS.get('engagements/ps-I1').partnerOrgId, 'tca-widget', 'engagement partnerOrgId');
});

await t('an operator missing from the org fails closed too', async () => {
  seed(); process.env.INTAKE_RUN_OPERATOR = 'nobody@ventrify.io';
  const r = await call();
  eq(r.payload.failed, 'operator_not_in_org', 'reason');
});

console.log('\n2. IT CANNOT ASK FIRESTORE FOR AN INDEX IT HAS NOT GOT');

await t('every query is single-field — two of them, both index-free', async () => {
  seed();
  await call();
  /* The fake THROWS on a chained where() or any orderBy, so reaching this line at all
     proves no query needed a composite index. The count is pinned so that a THIRD
     query has to be a decision someone makes here, not one that creeps in:
       1. intakes      where state in [submitted, running]
       2. organisations where operatorEmails array-contains <founder>   */
  if (WHERES !== 2) throw new Error('expected 2 single-field queries, saw ' + WHERES);
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

console.log('\n5. THE FOUNDER LANDS ON SOMETHING, NOT AN EMPTY PORTFOLIO');

await t('the engagement lives in the FOUNDER’s org, which is what their workspace lists', async () => {
  seed();
  await drain();
  const e = DOCS.get('engagements/ps-I1');
  if (e.orgId === 'tca-widget')
    throw new Error('it went to the partner org — the founder would see a blank portfolio');
  eq(e.orgId, 'northwind-health', 'orgId (data.js lists by this)');
  eq(e.partnerOrgId, 'tca-widget', 'partnerOrgId (the referring partner)');
  eq(e.founderEmail, 'alex@northwind.health', 'founderEmail');
  eq(e.tier, 'prescreen', 'tier');
});

/* THE FIELD NAMES BELONG TO THE PRODUCT, AND THIS GATE ASKS THE PRODUCT.
   The previous version asserted `type === 'assessment'` — a name invented in
   intake-run.js. The assertion passed, the gate was green, and the workspace ignored the
   field completely: it reads `engagementType`. The engagement was filed as a BUILD, the
   row linked to program.html, and the founder got a blank page.

   So this does not restate a field name. It reads the adapter's own test and asserts the
   document satisfies THAT. Rename it in the adapter and this gate fails, which is the
   point — a gate that only checks our side of a contract is checking nothing. */
await t('the engagement passes the workspace adapter\u2019s OWN test for an assessment', async () => {
  seed();
  await drain();
  const e = DOCS.get('engagements/ps-I1');
  const adapter = readFileSync(new URL('../shared/m3/workspace-adapter.js', import.meta.url), 'utf8');
  const m = adapter.match(/const isAssess = p\.(\w+) === 'assessment'/);
  if (!m) throw new Error('could not find the adapter\u2019s assessment test \u2014 has it been renamed?');
  eq(e[m[1]], 'assessment', `engagement.${m[1]} \u2014 the field the workspace actually reads`);
  if ('type' in e) throw new Error('`type` is an invented field; it misled once and must not come back');
});

await t('and carries what the portfolio row renders, so it is not \u201cPhase undefined / Stuck\u201d', async () => {
  seed();
  await drain();
  const e = DOCS.get('engagements/ps-I1');
  eq(e.health, 'on-track', 'health');
  eq(e.phase, 0, 'phase');
  eq(e.organisationSlug, 'northwind-health', 'organisationSlug');
  if (!e.lastActivityDetail) throw new Error('no lastActivityDetail \u2014 the row has nothing to say');
});

await t('a founder with no workspace gets one, with ONE pre-screen and no free assessment', async () => {
  seed();
  await drain();
  const o = DOCS.get('organisations/northwind-health');
  if (!o) throw new Error('no workspace was created');
  eq(o.plan.limits.prescreens, 1, 'prescreens');
  eq(o.plan.limits.assessments, 0, 'assessments — the $199 product must not be given away');
  if (!o.operatorEmails.includes('alex@northwind.health')) throw new Error('founder is not an operator of it');
  if (!o.operatorEmails.includes('svc@ventrify.io')) throw new Error('the sweeper cannot run memo.js phases there');
});

await t('a founder who ALREADY owns a solo workspace keeps it — no second one is minted', async () => {
  seed();
  DOCS.set('organisations/ants-prescreen', { name: 'ANTs pre-screen',
    ownerEmail: 'alex@northwind.health', operatorEmails: ['alex@northwind.health'],
    plan: { preset: 'trial' } });
  await drain();
  eq(DOCS.get('engagements/ps-I1').orgId, 'ants-prescreen', 'orgId');
  if (DOCS.get('organisations/northwind-health')) throw new Error('it created a duplicate workspace');
  eq(DOCS.get('organisations/ants-prescreen').plan.preset, 'trial', 'their existing plan was overwritten');
});

/* THE ONE THAT MATTERS MOST. Checked against live data, one real address operated EIGHT
   orgs — `default` (the live TCA workspace, four operators) among them. An array-contains
   with .limit(1) is a coin flip, and one of those faces drops an unvetted submission into
   a customer's workspace. Being listed as an operator is NOT consent to receive one. */
await t('an org the founder merely OPERATES is never reused — not even one they own with others', async () => {
  seed();
  DOCS.set('organisations/default', { name: 'TCA Venture Group',
    ownerEmail: 'alex@northwind.health',
    operatorEmails: ['alex@northwind.health', 'someone.real@tcavg.net', 'svc@ventrify.io'],
    plan: { preset: 'full' } });
  DOCS.set('organisations/a-clients-room', { name: "A client",
    ownerEmail: 'someoneelse@x.com', operatorEmails: ['alex@northwind.health'] });
  await drain();
  const landed = DOCS.get('engagements/ps-I1').orgId;
  if (landed === 'default') throw new Error('it landed in the LIVE TCA workspace');
  if (landed === 'a-clients-room') throw new Error("it landed in someone else's workspace");
  eq(landed, 'northwind-health', 'it made them a fresh one instead');
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

/* The cursor is written AFTER a step returns. A tick killed in that gap leaves the phase
   done and the cursor still on it, so the retry re-runs a phase that already succeeded.
   Before this, claimVenture's `already_prescreened/self` failed the whole intake and the
   founder was never emailed about a pre-screen that had worked. */
await t('a phase that ALREADY ran advances instead of failing the whole intake', async () => {
  seed();
  REPLY_AT = { tag: 'ps2-brief', status: 409,
               body: { error: 'already_prescreened', reason: 'self', engagementId: 'ps-I1' } };
  const r = await drain();
  eq(DOCS.get('intakes/I1').state, 'done', 'state');
  eq(r.payload.more, false, 'more');
  if (!CALLS.some(c => c.name === 'email')) throw new Error('the founder was never emailed');
});

await t('but a DIFFERENT already_prescreened reason still stops it \u2014 that is the real duplicate rule', async () => {
  seed();
  REPLY_AT = { tag: 'ps2-brief', status: 409,
               body: { error: 'already_prescreened', reason: 'fingerprint', engagementId: 'other-eng' } };
  await drain();
  eq(DOCS.get('intakes/I1').state, 'failed', 'state');
});

await t('it never set({merge}) onto an org it does not own', async () => {
  seed();
  /* Both candidate ids taken by orgs that are somebody else's. Merging would rewrite
     their name, plan and ownerEmail and add this founder as an operator. */
  DOCS.set('organisations/northwind-health', { name: 'Someone else', ownerEmail: 'x@y.com', operatorEmails: ['x@y.com'] });
  DOCS.set('organisations/northwind-health-i1', { name: 'Also not ours', ownerEmail: 'z@y.com', operatorEmails: ['z@y.com'] });
  const r = await call();
  eq(DOCS.get('organisations/northwind-health').name, 'Someone else', 'their org was rewritten');
  eq(DOCS.get('organisations/northwind-health').ownerEmail, 'x@y.com', 'their ownership was taken');
  eq(r.payload.failed, 'org_id_taken', 'it parks the intake');
  eq(DOCS.get('intakes/I1').state, 'failed', 'state \u2014 an unresolvable fault must not retry forever');
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
