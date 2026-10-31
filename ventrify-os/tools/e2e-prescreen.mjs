#!/usr/bin/env node
// ============================================================
// e2e-prescreen — run the WHOLE pre-screen, end to end, for $0.
//
// WHAT THIS IS FOR. contract.mjs proves a door opens. This proves the route behind it works: the ACTIONS
// whitelist, the authz block, the corpus build, every phase handler, span verification, the genericness
// filter, the two citation tiers, band composition, the snapshot write, the entitlement rule and the
// correction path. All of it, against real Firestore, in about ten seconds.
//
// NO STUB CODE SHIPS. The model is never called, and api/_prescreen2.js contains no test flag to be left
// on by accident. Node caches modules, so this harness requires the engine first and replaces its
// exported `callClaude`; api/memo.js does `E.callClaude(...)` on the cached object and gets the
// replacement. The production file is untouched and has no idea this exists.
//
// It invokes the handler in-process with req/res shims rather than over HTTP, which keeps the real
// dispatcher, the real whitelist and the real Firestore writes — everything except the transport.
//
// SIDE EFFECTS, BOUNDED. It creates one engagement named `__e2e-harness-<time>` and deletes it in a
// finally block. It touches nothing else, and its synthetic corpus produces a synthetic deck
// fingerprint, so it can never collide with a real venture's one free pre-screen.
//
//   node tools/e2e-prescreen.mjs
// ============================================================
import { createRequire } from 'node:module';
import { initAdmin, idTokenFor } from './contract-auth.mjs';
const require = createRequire(import.meta.url);

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };
const section = (s) => console.log('\n' + s);

// ── THE CORPUS THE HARNESS SCORES ───────────────────────────────────────────────────────────────────
// Real sentences, because the spans in the canned responses below are checked against them for real.
const DECK = `Northwind turns warehouse returns into resale inventory using computer vision.
We are a UK logistics venture at seed stage, sold B2B to retailers on a per-item fee.
The UK returns market is worth £7.2 billion a year. We are raising £1.4m.
Founded by Asha Mirza, who spent nine years at Ocado, and Daniel Fry, formerly of Hermes.
Traction: 6 retailer pilots, 41,000 items processed, 73% resale rate.`;

// ── THE CANNED MODEL ────────────────────────────────────────────────────────────────────────────────
// Shaped exactly like a real response — content blocks, stop_reason, usage — so readJson(), usageOf()
// and harvestSources() are the real ones doing real work.
const msg = (payload, extra = {}) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  usage: { input_tokens: 1000, output_tokens: 500, ...(extra.usage || {}) },
  ...extra.top,
});

const BRIEF = {
  oneLine: 'Northwind turns warehouse returns into resale inventory using computer vision.',
  sector: 'logistics', subSector: 'reverse logistics', stage: 'seed', geography: 'UK',
  businessModel: 'B2B per-item fee to retailers', marketClaim: 'UK returns market worth £7.2 billion a year',
  traction: ['6 retailer pilots', '41,000 items processed', '73% resale rate'],
  team: [{ name: 'Asha Mirza', background: 'nine years at Ocado' }, { name: 'Daniel Fry', background: 'formerly of Hermes' }],
  ask: '£1.4m',
  claims: [
    { statement: 'Processes returns into resale stock', docName: 'deck.pdf', quotedSpan: 'turns warehouse returns into resale inventory using computer vision' },
    { statement: 'Claims a 73% resale rate', docName: 'deck.pdf', quotedSpan: '41,000 items processed, 73% resale rate' },
  ],
  readable: true,
};

// web_search blocks as the API really returns them: url and title readable, body ENCRYPTED. This is the
// shape that broke the original design, so the harness reproduces it rather than an idealised one.
const SEARCH = {
  stop_reason: 'end_turn',
  usage: { input_tokens: 20000, output_tokens: 600, server_tool_use: { web_search_requests: 1 } },
  content: [
    { type: 'web_search_tool_result', content: [
      { type: 'web_search_result', title: 'Reverse logistics roundup', url: 'https://example.invalid/reverse-logistics', encrypted_content: 'OPAQUE' },
      { type: 'web_search_result', title: 'Returns startup raises', url: 'https://example.invalid/returns-raise', encrypted_content: 'OPAQUE' },
    ] },
    { type: 'text', text: 'Two adjacent players found.' },
  ],
};

// Points designed so each guardrail has something to bite on. Every drop below is INTENDED.
//
// NOTE, learned here: the genericness filter is STRICT. A point with no digit and no proper noun is
// binned, so "Six pilots is not six contracts" goes and "6 pilots is not 6 contracts" stays. That is the
// documented trade-off — §8.4 prefers a thin page to a generic one — and it only works because the real
// prompt instructs the model to include a number or a named entity in every point. These fixtures obey
// the same instruction, because a fixture that does not is testing the filter rather than the pipeline.
const NUGGETS = {
  thesis: { points: [{ point: 'The bet is that computer vision can grade returned stock accurately enough to resell at 73% rates', external: false, docName: 'deck.pdf', quotedSpan: '41,000 items processed, 73% resale rate' }] },
  bull:   { points: [
    { point: 'Asha Mirza spent nine years at Ocado, which is the exact operational problem', external: false, docName: 'deck.pdf', quotedSpan: 'Asha Mirza, who spent nine years at Ocado' },
    { point: 'A £7.2 billion UK returns market is large enough to matter', external: false, docName: 'deck.pdf', quotedSpan: 'UK returns market is worth £7.2 billion a year' },
    { point: 'This is a strong team with real momentum', external: false, docName: 'deck.pdf', quotedSpan: 'Asha Mirza, who spent nine years at Ocado' },   // GENERIC — must be dropped
  ] },
  bear:   { points: [
    { point: '6 pilots is not 6 contracts, and the deck does not say which converted', external: false, docName: 'deck.pdf', quotedSpan: 'Traction: 6 retailer pilots, 41,000 items processed' },
    { point: 'Churn across those pilots is 60% per month', external: false, docName: 'deck.pdf', quotedSpan: 'churn across the pilot cohort reached sixty percent' },   // SPAN NOT IN DECK — must be dropped
  ] },
  competitive: { points: [
    { point: 'Reverso raised £12m for the same retailer wedge', external: true, sourceIndex: 1, quotedSpan: 'nothing like this is on the page', docName: '' },   // unreadable page -> ATTRIBUTED
    { point: 'Loop Returns is adjacent and better funded', external: true, sourceIndex: 7, quotedSpan: 'x'.repeat(40), docName: '' },                            // BAD INDEX — must be dropped
  ] },
  team:   { points: [{ point: 'Neither founder has sold enterprise software — Ocado and Hermes are both operations roles', external: false, docName: 'deck.pdf', quotedSpan: 'Daniel Fry, formerly of Hermes' }] },
  tension: { points: [] },
};

function cannedFor(body) {
  const txt = JSON.stringify(body.messages || []) + JSON.stringify(body.system || '');
  if (body.tools) return SEARCH;                                             // phase 2
  if (/Write the brief/.test(txt)) return msg(BRIEF);                        // phase 1
  if (/would be true of ALMOST ANY venture/.test(txt)) return msg({ generic: [] });   // the judge
  if (/Decide whether this venture is worth/.test(txt)) {                    // phase 4
    return msg({ band: 'MEDIUM', reason: 'Six pilots and a credible operator, with conversion unproven.',
                 nextTests: ['Whether any of the six pilots converted to a paid contract'] });
  }
  for (const [key, payload] of Object.entries(NUGGETS)) {                    // phase 3
    const spec = ENGINE.NUGGETS.find(n => n.key === key);
    if (spec && txt.includes(spec.ask.slice(0, 40))) return msg(payload);
  }
  return msg({ points: [] });
}

// ── SHIMS ───────────────────────────────────────────────────────────────────────────────────────────
const call = async (handler, body) => {
  let status = 0, payload = null;
  const res = {
    setHeader() { return res; },
    status(s) { status = s; return res; },
    json(d) { payload = d; return res; },
    send(d) { payload = d; return res; },
  };
  await handler({ method: 'POST', body, query: {}, headers: {} }, res);
  return { status, body: payload || {} };
};

// The handlers refuse with `model_not_configured` without a key, and that check is production behaviour
// worth keeping — so satisfy it with one that is OBVIOUSLY not a key. callClaude is replaced below and
// never reaches the network; if a future change ever let a real call through, this would fail with a 401
// rather than quietly spend.
process.env.ANTHROPIC_API_KEY = 'harness-not-a-real-key';

// REQUIRE THE ENGINE FIRST, then patch it. memo.js requires the same cached object at call time.
const ENGINE = require('../api/_prescreen2.js');
const realCall = ENGINE.callClaude;
let modelCalls = 0;
ENGINE.callClaude = async (body) => { modelCalls++; return cannedFor(body); };
// Spans are checked against pages we never fetch, so make the fetcher a no-op: every external claim
// then lands in the ATTRIBUTED tier, which is the honest outcome and the one this harness asserts.
ENGINE.fetchSourceText = async (srcs) => srcs;

const admin = await initAdmin();
const db = admin.firestore();
const memo = require('../api/memo.js');

const operator = process.env.CONTRACT_OPERATOR || 'antonywhenman@icloud.com';
const { idToken } = await idTokenFor(operator);
const engagementId = '__e2e-harness-' + Date.now();
const engRef = db.collection('engagements').doc(engagementId);

// SWEEP FIRST, because `finally` is not a guarantee. A SIGPIPE — `node tools/e2e-prescreen.mjs | head`
// is enough — kills the process without running it, and the engagement left behind carries a venture
// claim with this harness's own synthetic fingerprint. Every subsequent run then fails at phase 1 with
// `already_prescreened`, which looks exactly like a product bug and is not one.
//
// A gate that fails because of its own debris is worse than no gate, so it cleans up on the way IN as
// well as on the way out. Only ever its own: the `__e2e` prefix is unmistakable.
async function sweepHarnessDebris() {
  const all = await db.collection('engagements').get();
  const mine = all.docs.filter(d => d.id.startsWith('__e2e'));
  for (const d of mine) {
    for (const c of ['founderDocs', 'prescreen2', 'prescreenCategories']) {
      for (const sub of (await d.ref.collection(c).get()).docs) await sub.ref.delete();
    }
    await d.ref.delete();
  }
  return mine.length;
}
const swept = await sweepHarnessDebris();
if (swept) console.log(`\n  swept ${swept} leftover harness engagement(s) from an interrupted run`);

try {
  // Find the org this operator actually belongs to — the harness never grants itself access, because a
  // test that invents its own permissions stops testing authorisation.
  //
  // COLLECTION AND FIELD NAMES COME FROM firestore.rules, which is the authority: `organisations` with
  // `operatorEmails`. The first version of this guessed `orgs`/`operators` and found nothing — the same
  // class of mistake as the whitelist, and the same fix: read the source of truth, do not assume it.
  const orgs = await db.collection('organisations').get();
  let orgId = null;
  for (const o of orgs.docs) {
    const ops = (o.data().operatorEmails || []).map(x => String(x).toLowerCase());
    if (ops.includes(operator.toLowerCase())) { orgId = o.id; break; }
  }
  if (!orgId) { console.log('\nNo org lists ' + operator + ' as an operator. Set CONTRACT_OPERATOR.'); process.exit(1); }

  await engRef.set({ name: '__e2e harness', orgId, tier: 'prescreen', createdAt: new Date() });
  await engRef.collection('founderDocs').doc('deck').set({ name: 'deck.pdf', docType: 'pitch', text: DECK });
  await engRef.set({ pitchDoc: { name: 'deck.pdf' } }, { merge: true });

  section(`E2E — engagement ${engagementId} in org ${orgId}, $0`);

  section('1. PHASE 1 — DISTIL');
  const p1 = await call(memo, { idToken, engagementId, action: 'ps2-brief' });
  ok(p1.status === 200, `ps2-brief -> ${p1.status} ${p1.body.error || ''}`);
  ok(p1.body.brief && p1.body.brief.sector === 'logistics', 'the brief came back and carries the sector');
  ok(!p1.body.done, 'a readable deck does not short-circuit the run');

  section('2. PHASE 2 — RESEARCH (encrypted results, as the real API returns them)');
  const p2 = await call(memo, { idToken, engagementId, action: 'ps2-research' });
  ok(p2.status === 200, `ps2-research -> ${p2.status} ${p2.body.error || ''}`);
  ok(p2.found === 2 || p2.body.found === 2, `two sources harvested from the result blocks (${p2.body.found})`);
  ok(p2.body.readable === 0, 'none is readable — encrypted_content yields no text, which is the real behaviour');

  section('3. PHASE 3 — SIX FINDINGS, AND EVERY GUARDRAIL BITING');
  const got = {};
  for (const spec of ENGINE.NUGGETS) {
    const r = await call(memo, { idToken, engagementId, action: 'ps2-nugget', nugget: spec.key });
    got[spec.key] = r.body;
    ok(r.status === 200, `${spec.key.padEnd(12)} -> ${r.status} kept=${(r.body.points || []).length} dropped=${r.body.droppedCount ?? 0}`);
  }
  ok((got.bull.points || []).length === 2, 'bull: the generic point was dropped, the two specific ones kept');
  ok((got.bear.points || []).length === 1, 'bear: the point whose span is not in the deck was dropped');
  const comp = got.competitive.points || [];
  ok(comp.length === 1, 'competitive: the out-of-range source index was dropped');
  ok(comp[0] && comp[0].tier === 'attributed', 'and the surviving one is ATTRIBUTED — we never read that page');
  ok(got.tension.skipped === 'needs_two_documents', 'tension skipped on a one-document room, not attempted');
  ok((got.thesis.points || []).length === 1 && got.thesis.points[0].tier === 'verified',
     'thesis: an internal claim whose span IS in the deck is verified');

  section('4. PHASE 4 — THE BAND AND THE SNAPSHOT');
  const p4 = await call(memo, { idToken, engagementId, action: 'ps2-band' });
  ok(p4.status === 200, `ps2-band -> ${p4.status} ${p4.body.error || ''}`);
  const snap = p4.body.snapshot || {};
  ok(ENGINE.BANDS.includes(snap.band), `a band was decided (${snap.band})`);
  ok(/your pitch deck/.test(snap.basis || '') && !/only|insufficient/i.test(snap.basis || ''),
     `the basis discloses what it read without apologising for it (“${snap.basis}”)`);
  ok(!/missing|not provided|incomplete/i.test(snap.reason || ''), 'the reason is not document-centric');
  // No page was fetched, so every external claim is ATTRIBUTED and none is verified. That is the
  // honest outcome for encrypted search results, and asserting it keeps the two tiers distinguishable.
  // thesis 1 + bull 2 (one generic dropped) + bear 1 (one bad span dropped) + team 1 = 5 internal,
  // and competitive's single survivor = 1 external. Derived from the fixtures rather than eyeballed,
  // because the first version of this line simply miscounted.
  const expectInternal = ['thesis', 'bull', 'bear', 'team'].reduce((n, k) => n + ((got[k].points || []).length), 0);
  ok(snap.tiers && snap.tiers.external === 1 && snap.tiers.attributed === 1 && snap.tiers.verified === 0
     && snap.tiers.internal === expectInternal,
     `tiers recorded: ${JSON.stringify(snap.tiers)} (expected ${expectInternal} internal)`);
  ok(typeof snap.costUsd === 'number', `the run logged what it cost ($${snap.costUsd})`);
  const stored = (await engRef.get()).data();
  ok(stored.prescreen2 && stored.prescreen2.v === 2, 'the snapshot is on the engagement, written server-side');
  ok(!!stored.prescreenRanAt, 'and the run is marked finished');

  section('5. THE ENTITLEMENT RULE STILL BITES');
  const again = await call(memo, { idToken, engagementId, action: 'ps2-brief' });
  ok(again.status === 409 && again.body.error === 'already_prescreened' && again.body.reason === 'self',
     `a second run on the same engagement is refused (${again.status} ${again.body.error}/${again.body.reason})`);

  section('6. THE CORRECTION PATH (§8.8)');
  const ed = await call(memo, { idToken, engagementId, action: 'ps2-brief-edit', fields: { sector: 'reverse logistics' } });
  ok(ed.status === 200, `ps2-brief-edit -> ${ed.status} ${ed.body.error || ''}`);
  ok((ed.body.asserted || []).includes('sector'), 'the edited field is marked customer-asserted');
  ok(ed.body.editsLeft === 1, `bounded: ${ed.body.editsLeft} correction left`);
  const after = await engRef.collection('prescreen2').get();
  ok(!after.docs.some(d => d.id.startsWith('n-')), 'every downstream finding was cleared, so none sits beside a corrected brief');
  ok(!!(await engRef.get()).data().prescreen2Superseded, 'and the previous band is kept as superseded');
  const noChange = await call(memo, { idToken, engagementId, action: 'ps2-brief-edit', fields: { sector: 'reverse logistics' } });
  ok(noChange.status === 400 && noChange.body.error === 'no_change', 'an edit that changes nothing is refused');
  await call(memo, { idToken, engagementId, action: 'ps2-brief-edit', fields: { sector: 'logistics tech' } });
  const third = await call(memo, { idToken, engagementId, action: 'ps2-brief-edit', fields: { sector: 'something else' } });
  ok(third.status === 409 && third.body.error === 'edit_limit', `the third correction is refused (${third.body.error})`);

  section('7. §3.3 — AN UNREADABLE SUBMISSION IS ITS OWN STATE');
  const u = db.collection('engagements').doc(engagementId + '-u');
  await u.set({ name: '__e2e unreadable', orgId, tier: 'prescreen', createdAt: new Date() });
  await u.collection('founderDocs').doc('t').set({ name: 'teaser.pdf', docType: 'pitch', text: 'Northwind. Returns, resold. Contact us.' });
  await u.set({ pitchDoc: { name: 'teaser.pdf' } }, { merge: true });
  const prevBrief = BRIEF.readable;
  BRIEF.readable = false;
  const ur = await call(memo, { idToken, engagementId: engagementId + '-u', action: 'ps2-brief' });
  BRIEF.readable = prevBrief;
  ok(ur.status === 200 && ur.body.done === true, 'the run ends in phase 1');
  ok(ur.body.snapshot && ur.body.snapshot.state === 'unreadable' && ur.body.snapshot.band === null,
     'with its own state and NO band — a teaser is not a verdict on a venture');
  await u.collection('founderDocs').doc('t').delete();
  await u.delete();

  section('8. NO MODEL WAS CALLED');
  ok(modelCalls > 0, `${modelCalls} model call(s) intercepted — the pipeline really did run`);
  ok(ENGINE.callClaude !== realCall, 'and every one hit the harness, not api.anthropic.com');

} finally {
  // Bounded side effects: whatever happened above, the harness takes its own engagements away again.
  // The same sweep as on the way in, so an `-u` engagement or a mid-run throw cannot leave anything.
  const n = await sweepHarnessDebris();
  console.log(`\n  cleaned up ${n} harness engagement(s)`);
}

console.log(fails ? `\n${fails} check(s) failed` : '\nthe whole pre-screen ran end to end, and every guardrail bit. $0.');
process.exit(fails ? 1 : 0);
