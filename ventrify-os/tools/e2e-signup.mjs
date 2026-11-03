#!/usr/bin/env node
// ============================================================
// e2e-signup — public signup, end to end, against real Firestore, for $0.
//
// create-own-org is the ONLY action in api/admin.js that is not super-admin. Everything protecting it
// is a property of the handler, not of the caller: it must take the owner's email from the verified
// token and never from the body, hard-code the trial plan and never read one from the body, and refuse
// a second workspace for an email that already has one. Each of those is one line, and each one failing
// open is a different kind of expensive — a granted 'full' licence, a stolen workspace, or an unbounded
// number of free pre-screen allowances at ~$1.60 a run.
//
// So the gate is hostile: every request below asks for more than it should get.
//
// No model is called and nothing on disk is written. It creates ONE synthetic Firebase user and the one
// org that user makes, both prefixed __signup-harness, and sweeps them on the way IN as well as OUT —
// `| head` is enough to kill the process before a finally block, and debris would make the next run
// fail at the duplicate check and look exactly like a product bug.
//
//   node tools/e2e-signup.mjs
//   node tools/e2e-signup.mjs --canary    # demand the wrong outcomes; the gate must fail
// ============================================================
import { createRequire } from 'node:module';
import { initAdmin, idTokenFor } from './contract-auth.mjs';

const require = createRequire(import.meta.url);
const CANARY = process.argv.includes('--canary');
const PREFIX = '__signup-harness';

let fails = 0;
const ok = (c, m, got) => { console.log((c ? '  ok  ' : '  ✗   ') + m + (got !== undefined ? ` — ${got}` : '')); if (!c) fails++; };
const eq = (a, b, m) => ok(CANARY ? a !== b : a === b, m, JSON.stringify(a));

const call = async (handler, body) => {
  let status = 0, payload = null;
  const res = { setHeader() { return res; }, status(s) { status = s; return res; },
                json(d) { payload = d; return res; }, send(d) { payload = d; return res; } };
  await handler({ method: 'POST', body, query: {}, headers: {} }, res);
  return { status, body: payload || {} };
};

// initAdmin FIRST: api/admin.js's ensureAdmin() is a no-op once the singleton exists, so the handler
// needs no FIREBASE_SERVICE_ACCOUNT in the environment and nothing here touches process.env.
const admin = await initAdmin();
const db = admin.firestore();
const handler = require('../api/admin.js');

// ownerEmail is the arm that actually matches. slugify() strips the leading underscores, so the org
// this harness makes is id `signup-harness-ventures`, NOT `__signup-harness…` — an id-only sweep would
// silently leave it behind and the next run would fail at the duplicate check looking like a real bug.
async function sweep() {
  const orgs = await db.collection('organisations').get();
  for (const d of orgs.docs) {
    const mine = String(d.data().ownerEmail || '').startsWith(PREFIX)
              || String(d.data().source || '') === 'self-signup' && String(d.data().ownerEmail || '').includes('ventrify-harness.invalid')
              || d.id.startsWith(PREFIX) || d.id.startsWith('signup-harness');
    if (mine) await d.ref.delete();
  }
  let page = await admin.auth().listUsers(1000);
  for (const u of page.users) if ((u.email || '').startsWith(PREFIX)) await admin.auth().deleteUser(u.uid);
}

await sweep();
const email = `${PREFIX}-${Date.now()}@ventrify-harness.invalid`;
let created = null;

try {
  const user = await admin.auth().createUser({ email, emailVerified: true });
  created = user.uid;
  const { idToken } = await idTokenFor(email);

  console.log('\n── a hostile signup gets a trial workspace and nothing more');
  // Asks for a full licence, someone else's name on the org, and a junk colour.
  const r = await call(handler, {
    action: 'create-own-org', idToken,
    name: `${PREFIX} Ventures`,
    plan: { preset: 'full', limits: { assessments: null, prescreens: null } },
    ownerEmail: 'attacker@evil.example',
    primaryColor: 'javascript:alert(1)',
  });
  eq(r.status, 200, 'the request is accepted');
  const id = r.body.id;
  ok(!!id, 'an org id comes back', id);

  const org = (await db.doc('organisations/' + id).get()).data() || {};
  eq(org.plan?.preset, 'trial', 'the plan is trial — body.plan was ignored');
  eq(org.plan?.limits?.prescreens, 2, 'two pre-screens, not unlimited');
  eq(org.plan?.limits?.assessments, 0, 'no assessments');
  eq(org.plan?.capabilities?.build, false, 'no build capability');
  eq(org.ownerEmail, email, 'the owner is the TOKEN email, not body.ownerEmail');
  eq((org.operatorEmails || [])[0], email, 'and they are the operator');
  eq(org.primaryColor, '#0036FF', 'the junk colour fell back to the default');
  eq(org.source, 'self-signup', 'the org records how it was made');

  console.log('\n── the guards');
  const dup = await call(handler, { action: 'create-own-org', idToken, name: 'Second Workspace' });
  eq(dup.status, 409, 'a second workspace for the same email is refused');
  eq(dup.body.error, 'already_has_org', 'and says why');

  // Name is validated BEFORE the duplicate check, so this is 400 and not 409 — the more useful of
  // the two answers, and the one a signup form can show against the field.
  const noName = await call(handler, { action: 'create-own-org', idToken, name: '  ' });
  eq(noName.status, 400, 'an empty name is refused');
  eq(noName.body.error, 'name_required', 'and names the field');

  const noTok = await call(handler, { action: 'create-own-org', name: 'No Token' });
  eq(noTok.status, 401, 'no token, no workspace');

  // An unverified address must not be able to claim one.
  const unverEmail = `${PREFIX}-unver-${Date.now()}@ventrify-harness.invalid`;
  await admin.auth().createUser({ email: unverEmail, emailVerified: false });
  const unver = await call(handler, { action: 'create-own-org', idToken: (await idTokenFor(unverEmail)).idToken, name: 'Unverified' });
  eq(unver.status, 403, 'an unverified email is refused');
  eq(unver.body.error, 'email_not_verified', 'and says why');

  console.log('\n── the welcome email refuses before it ever sends');
  // A key that is OBVIOUSLY not a key. send-email.js checks for one before dispatching, so without it
  // every assertion below would be a 503 and prove nothing. Every case here fails authorisation BEFORE
  // the Resend fetch, so nothing is sent and nothing is spent — if a future change let one through, it
  // would fail against this string rather than quietly mail a stranger.
  process.env.RESEND_API_KEY = 'harness-not-a-real-key';
  const mail = require('../api/send-email.js');

  const wrongTarget = await call(mail, { type: 'welcome', idToken, email: 'someone-else@evil.example', orgId: id });
  eq(wrongTarget.status, 403, 'an operator cannot welcome an address that is not their own');

  const noTokenMail = await call(mail, { type: 'welcome', email });
  eq(noTokenMail.status, 400, 'no token, no welcome');

  const badToken = await call(mail, { type: 'welcome', idToken: 'not-a-token', email });
  eq(badToken.status, 401, 'a forged token is a 401, not a 500');

  const otherOrg = await call(mail, { type: 'welcome', idToken, email, orgId: 'default' });
  eq(otherOrg.status, 403, 'and not for an org they do not belong to');

  console.log('\n── super-admin actions stay super-admin');
  const esc = await call(handler, { action: 'create-org', idToken, name: 'Escalation', ownerEmail: email });
  eq(esc.status, 403, 'create-own-org did not become a way into create-org');
  const plan = await call(handler, { action: 'set-plan', idToken, orgId: id, plan: { preset: 'full' } });
  eq(plan.status, 403, 'and a trial org cannot upgrade itself');
} finally {
  await sweep();
  if (created) console.log('\n(swept the harness user and its org)');
}

console.log(fails ? `\n${fails} FAILED` : '\nPASS — public signup grants a trial workspace and nothing it was not given');
if (CANARY) {
  console.log(fails ? 'canary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fails ? 0 : 1);
}
process.exit(fails ? 1 : 0);
