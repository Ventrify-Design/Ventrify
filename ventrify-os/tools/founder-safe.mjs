#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER SAFE — what may leave the building in the advance email.
//
// A pre-screen produces six findings. The line is NOT how flattering each one is — it is whether the
// finding is written FOR the founder or ABOUT them:
//
//   MAY GO    thesis       "What has to be true for this to work"  — played back so they can correct it
//             bull         the strongest version of their case     — our argument for them, theirs to use
//             competitive  who else we found doing this            — research they can check and answer
//             tension      "Where your documents disagree"         — already in the second person
//
//   MUST NOT  band + reason   an investment decision about them. Sending it costs the operator their
//                             position and teaches the founder how to game the next read.
//             bear            defined in the product as "how it will be argued in the room the founder
//                             isn't in" — mailing it to the founder inverts its own definition
//             team            "fit, and what's conspicuously absent" — a judgement about the people
//                             reading it, and the one finding they can do nothing about
//
// bull and competitive moved across on 2026-11-06, so the email shows what the product found rather
// than only what it wants. THE GATE GOT STRICTER, NOT LOOSER: with four of six keys travelling, a
// single mistyped key is now the likely slip rather than a loop, so each forbidden key is canaried on
// its own, and all four permitted ones are asserted PRESENT — a "tidy-up" that silently drops the
// case-for would otherwise pass a gate that only looks for leaks.
//
// A grep over the source would prove only that two words are missing today. This RUNS the real
// endpoint in preview mode against a snapshot whose forbidden fields are filled with tracer strings,
// and asserts not one of them comes back. Preview sends nothing and costs nothing, so the gate can be
// run as often as you like — and if anyone ever loops over ps.nuggets instead of naming the keys,
// every tracer lands in the output at once.
//
// Run: node tools/founder-safe.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');

const TRACER = {
  band: 'TRACER_BAND_MEDIUM',
  reason: 'TRACER_REASON_why_we_rated_them',
  bear: 'TRACER_BEAR_argued_in_the_room_they_are_not_in',
  team: 'TRACER_TEAM_what_is_conspicuously_absent',
};
const ALLOWED = {
  thesis: 'ALLOWED_THESIS_what_must_be_true',
  bull: 'ALLOWED_BULL_the_cost_delta_carries_it',
  competitive: 'ALLOWED_COMPETITIVE_two_incumbents_bundle_the_panel',
  tension: 'ALLOWED_TENSION_deck_says_40_model_says_12',
};

const snapshot = {
  v: 2, state: 'done',
  band: TRACER.band, reason: TRACER.reason,
  nextTests: ['ALLOWED_TEST_verify_the_pilot_revenue'],
  nuggets: {
    thesis:      { points: [{ point: ALLOWED.thesis }] },
    bull:        { points: [{ point: ALLOWED.bull }] },
    competitive: { points: [{ point: ALLOWED.competitive }] },
    tension:     { points: [{ point: ALLOWED.tension, docName: 'Financial model v4.xlsx' }] },
    bear:        { points: [{ point: TRACER.bear }] },
    team:        { points: [{ point: TRACER.team }] },
  },
};

// ── a sandbox that is enough of Vercel + firebase-admin to run one branch ──
function loadHandler(src) {
  const sent = [];
  const docData = {
    orgId: 'org-1', name: 'Verdana Bio', founderEmail: 'jane@verdana.bio',
    prescreen2: snapshot, dataRoom: { folderUrl: 'https://drive.google.com/drive/folders/X' },
  };
  const engDoc = {
    get: async () => ({ exists: true, data: () => docData }),
    set: async () => ({}),
    collection: () => ({ get: async () => ({ docs: [], size: 0 }) }),
  };
  const db = {
    collection: (name) => ({
      doc: () => (name === 'organisations'
        ? { get: async () => ({ exists: true, data: () => ({ name: 'Mercer Ventures', operatorEmails: ['alex@mercer.vc'] }) }) }
        : engDoc),
    }),
    doc: () => engDoc,
  };
  const admin = {
    apps: [{}],
    auth: () => ({ verifyIdToken: async () => ({ email: 'alex@mercer.vc' }) }),
    firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'ts', delete: () => 'del' } }),
    credential: { cert: () => ({}) },
    initializeApp: () => {},
  };
  const stubRequire = (id) => {
    if (id === 'firebase-admin') return admin;
    if (id === './_roomcheck.js') {
      return { checkRoom: () => ({
        classes: [{ key: 'metrics', label: 'Traction metrics', want: 'Monthly revenue over time', found: false },
                  { key: 'captable', label: 'Cap table', want: '', found: true }],
        strengtheners: [{ label: 'Customer references', why: 'Two named users would settle the demand question' }],
      }) };
    }
    return Module.createRequire(path.join(ROOT, 'api/send-email.js'))(id);
  };
  const sandbox = {
    require: stubRequire, module: { exports: {} }, exports: {},
    process: { env: { RESEND_API_KEY: 'x', INVITE_FROM_EMAIL: 'Ventrify <hello@ventrify.io>' } },
    console, Date, JSON, Math, Set, Array, Object, String, Number, Boolean,
    fetch: async (...a) => { sent.push(a); return { ok: true, text: async () => '' }; },
    URL, TextEncoder, Buffer,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'send-email.js' });
  return { handler: sandbox.module.exports, sent };
}

async function callPreview(src) {
  const { handler, sent } = loadHandler(src);
  let payload = null, status = 0;
  const res = {
    setHeader() {}, end() {},
    status(c) { status = c; return this; },
    json(o) { payload = o; return this; },
  };
  await handler({
    method: 'POST', headers: {},
    body: { type: 'prescreen-advance', preview: true, idToken: 'tok', engagementId: 'prg-verdana', email: 'jane@verdana.bio' },
  }, res);
  return { status, payload, sentCount: sent.length };
}

// The SEND path, with Resend stubbed. Preview and send are one code path up to the last line, but
// "up to the last line" is exactly where a divergence would hide — and it is the HTML, not the preview
// JSON, that reaches the founder. Audit both.
async function callSend(src) {
  const { handler, sent } = loadHandler(src);
  let payload = null, status = 0;
  const res = { setHeader() {}, end() {}, status(c) { status = c; return this; }, json(o) { payload = o; return this; } };
  await handler({
    method: 'POST', headers: {},
    body: { type: 'prescreen-advance', idToken: 'tok', engagementId: 'prg-verdana', email: 'jane@verdana.bio', note: 'Great to meet you.' },
  }, res);
  const call = sent[0];
  const body = call ? JSON.parse(call[1].body) : null;
  return { status, payload, html: (body && body.html) || '', subject: (body && body.subject) || '' };
}

function auditSend({ status, html, subject }) {
  const problems = [];
  if (status !== 200) { problems.push(`send returned ${status}`); return problems; }
  if (!html) { problems.push('no html reached Resend'); return problems; }
  for (const [k, tracer] of Object.entries(TRACER)) {
    if (html.includes(tracer)) problems.push(`"${k}" is in the EMAIL BODY — it is operator-only`);
  }
  for (const [k, v] of Object.entries(ALLOWED)) {
    if (!html.includes(v)) problems.push(`the email body omits "${k}" — it is one of the four the founder is meant to see`);
  }
  if (!/going through to a full assessment/i.test(subject)) problems.push(`subject does not say what this is: "${subject}"`);
  return problems;
}

function audit({ status, payload, sentCount }) {
  const problems = [];
  if (status !== 200) { problems.push(`preview returned ${status}: ${JSON.stringify(payload).slice(0, 160)}`); return problems; }
  if (sentCount > 0) problems.push('preview called out to Resend — a preview must send nothing');
  const blob = JSON.stringify(payload);
  for (const [k, tracer] of Object.entries(TRACER)) {
    if (blob.includes(tracer)) problems.push(`"${k}" reached the founder payload — it is operator-only`);
  }
  for (const [k, v] of Object.entries(ALLOWED)) {
    if (!blob.includes(v)) problems.push(`"${k}" is missing from the preview — the operator must see everything the founder will`);
  }
  return problems;
}

const src = fs.readFileSync(path.join(ROOT, 'api/send-email.js'), 'utf8');

if (CANARY) {
  // A gate that cannot fail is decoration. Leak each way a real refactor would leak.
  // NB the mutation must defeat the .slice(0, 4) as well. The first version did not, and once the
  // permitted keys grew to four the four survivors of the slice were all permitted ones — so the
  // canary "passed" against a source that was leaking everything. A loop with no cap is the honest
  // shape of the mistake anyway.
  const loopAll = src.replace(
    "const thesis = pointsOf('thesis').slice(0, 4)",
    "const thesis = Object.values(ps.nuggets || {}).flatMap(n => n.points || []).slice(0, 99)");
  const leakBand = src.replace('thesis, bull, competitive, tensions, nextTests, missing, extras,\n          folderUrl: !!folderUrl,',
                               'thesis, bull, competitive, tensions, nextTests, missing, extras, band: ps.band, reason: ps.reason,\n          folderUrl: !!folderUrl,');
  const results = [];
  results.push(['looping every nugget instead of naming four', (await callPreview(loopAll).then(audit)).length > 0]);
  results.push(['band + reason added to the payload', (await callPreview(leakBand).then(audit)).length > 0]);
  // One canary per forbidden key: with four of six now permitted, the realistic mistake is adding a
  // fifth by hand rather than reintroducing a loop.
  for (const k of ['bear', 'team']) {
    const leakOne = src.replace(
      "const bull = pointsOf('bull')",
      `const bull = pointsOf('${k}').slice(0, 3).map(pt => ({ point: clean(pt.point) })).filter(t => t.point).concat(pointsOf('bull')`.replace(/$/, ')') + ';\n      const __unused = pointsOf(\'bull\')');
    results.push([`"${k}" added to the allowlist by hand`, (await callPreview(leakOne).then(audit)).length > 0]);
  }
  // And one that DROPS a permitted finding, which a leak-only gate would wave through.
  const dropBull = src.replace("thesis, bull, competitive, tensions, nextTests, missing, extras, folderUrl,",
                               "thesis, bull: [], competitive, tensions, nextTests, missing, extras, folderUrl,");
  results.push(['the case-for quietly dropped from the email', (await callSend(dropBull).then(auditSend)).length > 0]);
  const healthy = [...await callPreview(src).then(audit), ...await callSend(src).then(auditSend)];
  results.push(['healthy source clean (preview AND send)', healthy.length === 0]);
  results.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(44)} ${ok ? 'caught' : 'MISSED'}`));
  healthy.forEach(h => console.log(`      unexpected: ${h}`));
  process.exit(results.every(([, ok]) => ok) ? 0 : 1);
}

const problems = [
  ...audit(await callPreview(src)).map(x => 'preview · ' + x),
  ...auditSend(await callSend(src)).map(x => 'email   · ' + x),
];
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s) with what the founder would receive`
  : '  PASS — in the preview AND in the email that goes out: the bet, the case for, the field and\n         the tension all go; the band, its reason, the bear case and the team read do not');
process.exit(problems.length ? 1 : 0);
