#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER SAFE — what may leave the building in the advance email.
//
// A pre-screen produces six findings. Two of them are written for the founder and four are written
// about them:
//
//   MAY GO    thesis   "What has to be true for this to work"      — played back so they can correct it
//             tension  "Where your documents disagree, both sides" — already in the second person
//
//   MUST NOT  band + reason   an investment decision about them. Sending it costs the operator their
//                             position and teaches the founder how to game the next read.
//             bull            how we would argue FOR backing them
//             bear            defined in the product as "how it will be argued in the room the founder
//                             isn't in" — mailing it to the founder inverts its own definition
//             competitive     who else we found doing this
//             team            "fit, and what's conspicuously absent"
//
// A grep over the source would prove only that four words are missing today. This RUNS the real
// endpoint in preview mode against a snapshot whose forbidden fields are filled with tracer strings,
// and asserts not one of them comes back. Preview sends nothing and costs nothing, so the gate can be
// run as often as you like — and if anyone ever loops over ps.nuggets instead of naming the two keys,
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
  bull: 'TRACER_BULL_the_case_for_backing',
  bear: 'TRACER_BEAR_argued_in_the_room_they_are_not_in',
  competitive: 'TRACER_COMPETITIVE_rivals_we_found',
  team: 'TRACER_TEAM_what_is_conspicuously_absent',
};
const ALLOWED = {
  thesis: 'ALLOWED_THESIS_what_must_be_true',
  tension: 'ALLOWED_TENSION_deck_says_40_model_says_12',
};

const snapshot = {
  v: 2, state: 'done',
  band: TRACER.band, reason: TRACER.reason,
  nextTests: ['ALLOWED_TEST_verify_the_pilot_revenue'],
  nuggets: {
    thesis:      { points: [{ point: ALLOWED.thesis }] },
    tension:     { points: [{ point: ALLOWED.tension, docName: 'Financial model v4.xlsx' }] },
    bull:        { points: [{ point: TRACER.bull }] },
    bear:        { points: [{ point: TRACER.bear }] },
    competitive: { points: [{ point: TRACER.competitive }] },
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
  if (!html.includes(ALLOWED.thesis)) problems.push('the email body omits the bet');
  if (!html.includes(ALLOWED.tension)) problems.push('the email body omits the tension');
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
  if (!blob.includes(ALLOWED.thesis)) problems.push('the bet (thesis) is missing — the founder cannot correct what they are not shown');
  if (!blob.includes(ALLOWED.tension)) problems.push('the tension is missing — it is the most useful thing in the message');
  return problems;
}

const src = fs.readFileSync(path.join(ROOT, 'api/send-email.js'), 'utf8');

if (CANARY) {
  // A gate that cannot fail is decoration. Leak each way a real refactor would leak.
  const loopAll = src.replace(
    "const thesis = pointsOf('thesis')",
    "const __all = Object.values(ps.nuggets || {}).flatMap(n => n.points || []);\n      const thesis = __all.concat(pointsOf('thesis'))");
  const leakBand = src.replace('thesis, tensions, nextTests, missing, extras,\n          folderUrl: !!folderUrl,',
                               'thesis, tensions, nextTests, missing, extras, band: ps.band, reason: ps.reason,\n          folderUrl: !!folderUrl,');
  const results = [];
  results.push(['looping every nugget instead of naming two', (await callPreview(loopAll).then(audit)).length > 0]);
  results.push(['band + reason added to the payload', (await callPreview(leakBand).then(audit)).length > 0]);
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
  : '  PASS — in the preview AND in the email that goes out: the bet and the tension go,\n         the band, reason, bull, bear, field and team do not');
process.exit(problems.length ? 1 : 0);
