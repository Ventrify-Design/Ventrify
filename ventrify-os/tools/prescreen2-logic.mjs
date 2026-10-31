#!/usr/bin/env node
// ============================================================
// prescreen2-logic — the v2 engine's guardrails, proven without spending anything.
//
// The model call is the expensive, slow, non-deterministic part. EVERYTHING THAT KEEPS THE OUTPUT HONEST
// is none of those things: the citation enum, the span verification, the genericness filter, the band
// mapping and the schema's compliance with the documented API limits are all pure functions, and all of
// them would fail invisibly in a live run.
//
// Spec: design/prescreen-v2-spec.md. §3 is the anti-regression contract (the band must never be a
// function of document count); §8 is the guardrail stack. This gate exists so both survive the next
// person to touch the file, including me.
//
// This is NOT the calibration gate (tools/prescreen-bands.mjs), which replays real engagements through
// the real model and decides whether the band can be trusted. This proves the mechanism; that proves
// the claim.
// ============================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../api/_prescreen2.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

console.log('\n1. THE BAND MAPS ONTO THE RUNNER\'S OWN 80/60/40 THRESHOLDS');
// §11.3 — do not invent thresholds. GUIDANCE_BANDS already exists; the top two collapse because to the
// question "is this worth assessing?" both READY and PROMISING answer yes.
ok(E.expectedBandFor(80) === 'HIGH',   'READY (>=80) is worth assessing');
ok(E.expectedBandFor(76) === 'HIGH',   "MoneyGym's 76 is HIGH — PROMISING is still a yes");
ok(E.expectedBandFor(62) === 'HIGH',   'KreditMate\'s 62 is HIGH');
ok(E.expectedBandFor(60) === 'HIGH',   'the PROMISING boundary itself is HIGH');
ok(E.expectedBandFor(59) === 'MEDIUM', 'one point below is MEDIUM');
ok(E.expectedBandFor(53) === 'MEDIUM' && E.expectedBandFor(46) === 'MEDIUM', 'HIGH_RISK is MEDIUM');
ok(E.expectedBandFor(40) === 'MEDIUM', 'the HIGH_RISK boundary is MEDIUM');
ok(E.expectedBandFor(39) === 'LOW',    'POTENTIAL_DECLINE is LOW');
ok(E.expectedBandFor('nonsense') === null, 'a non-number maps to nothing rather than to LOW');
ok(E.BANDS.length === 3, 'three bands, not four');

console.log('\n2. CITATION BY ENUM — an invented URL is impossible, not merely checked');
const s0 = E.nuggetSchema({ items: 3 }, 0);
const p0 = s0.properties.points.items;
ok(!('sourceIndex' in p0.properties), 'with no sources, the schema offers no way to cite one');
ok(!p0.required.includes('sourceIndex'), 'and does not require one');
const s3 = E.nuggetSchema({ items: 3 }, 3);
const p3 = s3.properties.points.items;
ok(JSON.stringify(p3.properties.sourceIndex.enum) === '[0,1,2]', 'with 3 sources the enum is exactly their indices');
ok(p3.properties.sourceIndex.type === 'integer', 'it is an index, never a URL the model writes');

console.log('\n3. SCHEMAS OBEY THE DOCUMENTED STRUCTURED-OUTPUT LIMITS');
// Numerical and string constraints are NOT supported and a schema carrying them is a 400 at run time —
// the most expensive possible moment to find out.
const BANNED = ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern'];
function audit(node, path, acc) {
  if (!node || typeof node !== 'object') return acc;
  for (const k of BANNED) if (k in node) acc.banned.push(`${path}.${k}`);
  if (node.type === 'object') {
    if (node.additionalProperties !== false) acc.open.push(path);
    for (const [k, v] of Object.entries(node.properties || {})) audit(v, `${path}.${k}`, acc);
  }
  if (node.type === 'array') audit(node.items, `${path}[]`, acc);
  return acc;
}
const schemas = {
  brief: E.briefSchema(), band: E.bandSchema(),
  nugget0: E.nuggetSchema({ items: 3 }, 0), nugget3: E.nuggetSchema({ items: 3 }, 3),
};
for (const [name, sch] of Object.entries(schemas)) {
  const a = audit(sch, name, { banned: [], open: [] });
  ok(!a.banned.length, `${name}: no unsupported constraints${a.banned.length ? ' — ' + a.banned.join(', ') : ''}`);
  ok(!a.open.length, `${name}: every object sets additionalProperties:false${a.open.length ? ' — ' + a.open.join(', ') : ''}`);
}
ok(!JSON.stringify(schemas).includes('$ref'), 'no $ref — recursion is unsupported and nothing here needs it');

console.log('\n4. NO REQUIRED CREATIVE SLOT (§8.5) — every nugget may come back empty');
for (const [name, sch] of Object.entries(schemas)) {
  const arrays = JSON.stringify(sch).match(/"type":"array"/g) || [];
  ok(!JSON.stringify(sch).includes('"minItems"'), `${name}: ${arrays.length} array(s), none with a floor`);
}
ok(/RETURN FEWER, OR NONE, RATHER THAN PADDING/.test(E.nuggetPrompt(E.NUGGETS[1], {}, [], '')),
   'the prompt says so in terms, not by implication');

console.log('\n5. SPAN VERIFICATION DROPS WHAT IT CANNOT PROVE (§8.1)');
// Each fixture isolates ONE failure mode, so a drop names the reason it was built to trigger. Every
// fixture clears the genericness filter first (§7) — otherwise a case meant to test span matching would
// never reach it, and the test would pass for the wrong reason.
// `fetched: true` is what a page we actually read looks like. Without it these are sources whose
// text we do not hold, and every claim on them would be attributed rather than checked (§20).
const sources = [{ url: 'https://example.com/a', title: 'A', fetched: true, text: 'Cleo raised £28m in a Series B led by Sofina in 2022.' }];
const corpus = 'MoneyGym turns debt repayment into a weekly habit. The model assumes 40% weekly retention across the first cohort.';
const span = 'Cleo raised £28m in a Series B';
const v = E.verifyPoints([
  { point: 'Cleo is an adjacent player that raised £28m', external: true,  sourceIndex: 0, quotedSpan: span, docName: '' },
  { point: 'Chime raised £500m in 2021',                  external: true,  sourceIndex: 0, quotedSpan: 'Chime raised £500m in 2021 from investors', docName: '' },
  { point: 'Monzo is a competitor worth £4bn',            external: true,  sourceIndex: 7, quotedSpan: span, docName: '' },
  { point: 'Retention is assumed at 40% weekly',          external: false, quotedSpan: 'The model assumes 40% weekly retention', docName: 'model.xlsx' },
  { point: 'Needs to prove product-market fit',           external: false, quotedSpan: 'The model assumes 40% weekly retention', docName: 'model.xlsx' },
  { point: 'Churn is 40% monthly per the model',          external: false, quotedSpan: 'nothing like this appears anywhere', docName: 'model.xlsx' },
  { point: 'Cleo is an adjacent UK player',               external: true,  sourceIndex: 0, quotedSpan: 'Cleo', docName: '' },
], sources, corpus);
const why = (p) => (v.dropped.find(d => d.point.startsWith(p)) || {}).why;
ok(v.kept.length === 2, `2 of 7 points survive (kept ${v.kept.length})`);
ok(why('Chime') === 'span not in source', 'a fabricated public claim is dropped WHERE WE HOLD THE PAGE: ' + why('Chime'));
ok(why('Monzo') === 'no such source', 'an out-of-range source index is dropped');
ok(why('Needs to prove') === 'generic', 'a point true of any venture is dropped before any judge runs');
ok(why('Churn') === 'span not in documents', 'a misquoted internal claim is dropped');
ok(why('Cleo is an adjacent UK') === 'span too short to verify', 'a span too short to mean anything is dropped');
const ext = v.kept.find(k => k.external), int = v.kept.find(k => !k.external);
ok(ext && ext.source.url === 'https://example.com/a', 'a surviving external point carries its real URL');
ok(int && int.docName === 'model.xlsx', 'and a surviving internal point carries its document');
ok(v.kept.every(k => k.quotedSpan), 'every survivor carries the span it was verified on');

console.log('\n6. SPANS SURVIVE RE-FLOWED TEXT BUT NOT PARAPHRASE');
const reflowed = E.verifyPoints(
  [{ point: 'Cleo raised £28m', external: true, sourceIndex: 0, quotedSpan: '  cleo   RAISED  £28m in a Series   B  ', docName: '' }],
  sources, corpus);
ok(reflowed.kept.length === 1, 'whitespace and case differences still verify — extraction re-flows text');
const para = E.verifyPoints(
  [{ point: 'Cleo raised 28 million', external: true, sourceIndex: 0, quotedSpan: 'Cleo secured £28m in its Series B', docName: '' }],
  sources, corpus);
ok(para.kept.length === 0, 'a paraphrase does not verify, however true it is');

console.log('\n7. THE GENERICNESS FILTER IS FREE AND STRUCTURAL (§8.4)');
ok(!E.hasSubstance('needs to prove product-market fit'), 'no number, no name → generic');
ok(!E.hasSubstance('the team is strong and committed'), '"strong team" is caught');
ok(E.hasSubstance('Monzo holds 9m UK customers'), 'a named entity is substance');
ok(E.hasSubstance('churn runs at 40% monthly'), 'a number is substance');

console.log('\n8. §3 — THE BAND IS NEVER A FUNCTION OF DOCUMENT COUNT');
const bp = E.bandPrompt({ sector: 'fintech' }, [], 'Read from your pitch deck.');
ok(/How MANY documents were supplied is not evidence of anything/.test(bp), 'the prompt says so outright');
ok(/supplied one deck and whose case holds up is HIGH/.test(bp), 'and gives the deck-only case explicitly');
ok(/Do not mention missing, absent or incomplete documents/.test(bp), 'and forbids document-centric reasons');
ok(/NOT judging whether the business is good/.test(bp), '§2 — it judges the case, not the venture');
ok(!/\b(range|floor|ceiling|composite|out of 100)\b/i.test(bp), 'no range vocabulary survives anywhere in it');

console.log('\n9. §3.2 — DISCLOSE THE BASIS, NEVER PENALISE IT');
const b1 = E.basisLine(1, 4), b9 = E.basisLine(9, 0);
ok(b1 === 'Read from your pitch deck and 4 public sources.', 'deck-only reads as a basis: "' + b1 + '"');
ok(b9 === 'Read from 9 of your documents.', 'and so does a room with no sources found');
ok(!/only|just|insufficient|missing|didn't|more document/i.test(b1 + b9), 'neither sentence penalises the upload');

console.log('\n10. §3.3 — "WE COULDN\'T TELL" IS ITS OWN STATE, NOT THE BOTTOM BAND');
ok('readable' in E.briefSchema().properties, 'the brief carries it');
ok(E.briefSchema().required.includes('readable'), 'and must answer it');
ok(/readable: false ONLY if/.test(require('../api/_prescreen2.js').distilRequest('x').system[0].text),
   'the prompt distinguishes thin evidence from unreadable');
ok(!E.BANDS.includes('UNREADABLE'), 'and it is deliberately NOT a band');

console.log('\n11. §4 — DECK-ONLY IS A FULL RUN');
const needsRoom = E.NUGGETS.filter(n => n.minDocs);
ok(needsRoom.length === 1 && needsRoom[0].key === 'tension',
   'exactly one nugget needs a second document, and it is `tension`');
ok(E.NUGGETS.filter(n => !n.minDocs).map(n => n.key).join(',') === 'thesis,bull,bear,competitive,team',
   'the other five run on a deck alone: thesis, bull, bear, competitive, team');
ok(E.NUGGETS.find(n => n.key === 'competitive') && !E.NUGGETS.find(n => n.key === 'competitive').minDocs,
   'the competitive read — the highest-wow item — needs no data room at all');

console.log('\n12. DISTIL ONCE, REASON MANY TIMES (§6)');
ok(E.MODEL_DISTIL === 'claude-sonnet-5-5', 'extraction runs on the cheaper model');
ok(E.MODEL_REASON === 'claude-opus-5-5', 'judgement runs on Opus 5.5');
ok(E.PRICE[E.MODEL_DISTIL].in < E.PRICE[E.MODEL_REASON].in, 'and that is in fact the cheaper one');
const dr = E.distilRequest('CORPUS TEXT HERE');
ok(dr.system[0].cache_control, 'the corpus sits behind a cache breakpoint');
ok(dr.output_config.effort === 'low', 'extraction is low effort — it is not reasoning work');
const np = E.nuggetPrompt(E.NUGGETS[2], { sector: 'fintech', oneLine: 'x' }, sources, 'narrative');
ok(!np.includes('CORPUS TEXT HERE'), 'a reasoning call never receives the corpus');
ok(np.includes('PUBLIC SOURCES'), 'it receives the brief and the harvested sources instead');

console.log('\n13. §8.6 — THE SEARCH CAP IS REAL AND STATED');
ok(E.MAX_SEARCHES === 5, 'five searches');
ok(E.researchPrompt({ sector: 'f', oneLine: 'o', businessModel: 'b', geography: 'g', stage: 'seed', marketClaim: '' })
    .includes('at most 5 searches'), 'and the prompt says so');
ok(E.researchRequest({}).tools[0].type === 'web_search_20260209', 'the current tool version, with dynamic filtering');
ok(!E.researchRequest({}).output_config.format, 'research returns prose — its VALUE is the result blocks, not its JSON');

console.log('\n14. SOURCES COME FROM THE API, NEVER FROM THE MODEL');
const harvested = E.harvestSources({ content: [
  { type: 'text', text: 'I found https://invented.example.com/fake which does not exist' },
  { type: 'web_search_tool_result', content: [
      { url: 'https://a.example/1', title: 'One', content: 'alpha' },
      { url: 'https://a.example/1', title: 'One again', content: 'alpha' },
      { url: 'not-a-url', title: 'Bad' },
      { url: 'https://b.example/2', page_title: 'Two', text: 'beta' },
  ] },
] });
ok(harvested.length === 2, 'two sources harvested from the result blocks');
ok(!JSON.stringify(harvested).includes('invented.example.com'), 'a URL the model merely TYPED is not a source');
ok(harvested.map(h => h.url).join(',') === 'https://a.example/1,https://b.example/2', 'deduped, and non-URLs rejected');
ok(harvested[1].title === 'Two', 'title falls back across the shape variants');

console.log('\n15. §8.3 — NO MODEL SELF-REPORT IS A MEASUREMENT');
ok(!JSON.stringify(E.bandSchema()).includes('confidence'), 'the band schema has no confidence field to fill in');
ok(!JSON.stringify(E.briefSchema()).includes('confidence'), 'nor does the brief');
const js = JSON.parse(JSON.stringify(E.judgeRequest([{ point: 'a' }, { point: 'b' }], 'fintech')));
ok(js.output_config.format.schema.properties.generic.items.enum.join(',') === '0,1',
   'the judge can only point at the findings it was given');
ok(Object.keys(js.output_config.format.schema.properties).join(',') === 'generic',
   'and can return nothing else — it cannot add, rescore or rewrite');

console.log('\n16. COST IS MEASURED, NOT ESTIMATED (§8.6)');
const usd = E.costOf([
  { model: E.MODEL_DISTIL, usage: { in: 40000, out: 6000, cacheRead: 0, cacheWrite: 0, searches: 0 } },
  { model: E.MODEL_REASON, usage: { in: 36000, out: 24000, cacheRead: 0, cacheWrite: 0, searches: 5 } },
]);
ok(usd > 0.6 && usd < 1.3, `a representative run costs $${usd} — inside the spec's ~$1.10 estimate`);
ok(E.costOf([{ model: 'made-up-model', usage: { in: 1e6, out: 1e6 } }]) === 0,
   'an unpriced model contributes 0 rather than a wrong number');
ok(E.costOf([]) === 0, 'and no calls cost nothing');

console.log('\n17. THE WIRING — api/memo.js, read as text (the parity-gate pattern)');
// These are the invariants a unit test cannot reach, because they are about WHICH CODE EXISTS. Every one
// of them was a real hole in v1 or a consequence worked out in §8.8, and every one would be invisible in
// a live run until it cost somebody something.
const memo = await (await import('node:fs/promises')).readFile(new URL('../api/memo.js', import.meta.url), 'utf8');

// One entitlement check, not two. Two copies of a rule is two rules, and the second is always the wrong one.
const claimDefs = (memo.match(/async function claimVenture/g) || []).length;
const fpCalls = (memo.match(/EN\.deckFingerprint\(/g) || []).length;
ok(claimDefs === 1, 'claimVenture() is defined exactly once');
ok(fpCalls === 1, `the venture fingerprint is computed in one place (${fpCalls})`);
ok((memo.match(/await claimVenture\(/g) || []).length === 2, 'and both v1 and v2 call it');

// §8.8 — a correction NEVER consumes a venture claim.
const editBlock = memo.slice(memo.indexOf("action === 'ps2-brief-edit'", memo.indexOf('PHASE 1')), memo.indexOf('── PHASE 2'));
ok(editBlock.length > 500, 'the correction block is present');
ok(!/claimVenture/.test(editBlock), 'a brief correction does not go near the venture claim');
ok(/MAX_EDITS = 2/.test(editBlock), 'and is bounded at two per venture');
ok(/edit_limit/.test(editBlock), 'with a named refusal rather than a silent no-op');

// §8.8 — edited fields are customer-asserted, and `claims` is never editable.
ok(/asserted/.test(editBlock), 'edited fields are recorded as customer-asserted');
const editable = (editBlock.match(/const EDITABLE = \[([^\]]*)\]/) || [, ''])[1];
ok(editable.length > 0 && !/claims/.test(editable), 'the verified claims layer is NOT editable: [' + editable.replace(/'/g, '').trim() + ']');
ok(/listDocuments|batch\.delete/.test(editBlock), 'a correction clears everything downstream rather than leaving stale nuggets');
ok(/prescreen2Superseded/.test(editBlock), 'and the previous band is kept as superseded, not overwritten');

// §3.3 — the unreadable path stops before anything expensive.
const briefBlock = memo.slice(memo.indexOf("action === 'ps2-brief'", memo.indexOf('── PHASE 1')), memo.indexOf("action === 'ps2-brief-edit'", memo.indexOf('── PHASE 1')));
ok(/readable === false/.test(briefBlock), 'an unreadable submission is detected in phase 1');
ok(/state: 'unreadable'/.test(briefBlock) && /band: null/.test(briefBlock), 'it gets its own state and NO band');
ok(/done: true/.test(briefBlock), 'and the run ends there — three phases are never started');

// §8.1 — nothing reaches the browser unverified.
const nugBlock = memo.slice(memo.indexOf("action === 'ps2-nugget'"), memo.indexOf('── PHASE 4'));
ok(/E\.verifyPoints\(/.test(nugBlock), 'every nugget is run through verifyPoints before it is stored');
ok(/points: kept/.test(nugBlock), 'only the verified points are persisted as points');
ok(/needs_two_documents/.test(nugBlock), '§4 — tension is skipped on a deck-only run, not attempted');

// §8.7 — the judge is the smallest possible component and cannot fail the run.
const bandBlock = memo.slice(memo.indexOf("action === 'ps2-band'"));
ok(/catch \(e\) \{[\s\S]{0,400}generic = \[\]/.test(bandBlock), 'a failed judge pass leaves nothing marked generic rather than failing the run');
ok(/costUsd: sumUsage/.test(bandBlock), '§8.6 — every run logs what it actually cost');
ok(/droppedUnverified/.test(bandBlock) && /droppedGeneric/.test(bandBlock), 'and what it threw away, split by reason');

// The corpus is never trusted from the client — it is what every claim is verified against.
ok(!/body\.corpus|body\.sources|body\.brief\b/.test(memo), 'no corpus, source list or brief is ever accepted from the browser');
ok(/E\.buildCorpus\(fdSnap/.test(memo), 'it is rebuilt from Firestore on every v2 action');

// Firestore denies by default, so a subcollection with no match block is unreachable from the browser.
// That is the protection, and it only holds while NOBODY ADDS ONE — hence the check. Every v2 phase
// returns its own payload, so the UI never needs to read these documents directly.
const rules = await (await import('node:fs/promises')).readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
ok(!/prescreen2/.test(rules), 'no rule exposes the prescreen2 subcollection — default-deny keeps it server-only');
ok(!/prescreenCategories/.test(rules), 'same as v1, which has always relied on this');

// A spend cap is not a failure of ours.
ok(/account_limit/.test(bandBlock) || /account_limit/.test(memo), 'an account spend limit is named, not reported as a model error');

console.log('\n18. THE ORCHESTRATOR MIRRORS THE ENGINE (the copy is made safe by a gate)');
// workspace/prescreen2.js holds its own list of nugget keys so the page can draw placeholders before
// anything lands. That is a second copy, and the house rule is that a copy is made safe by a gate rather
// than forbidden by a comment — the same arrangement as ROOM_CLASSES in ds.js and SIGNAL_SCALE in v1.
const orch = await (await import('node:fs/promises')).readFile(new URL('../workspace/prescreen2.js', import.meta.url), 'utf8');
const listed = (orch.match(/const NUGGET_KEYS = \[([^\]]*)\]/) || [, ''])[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
ok(listed.join(',') === E.NUGGETS.map(n => n.key).join(','),
   `the orchestrator's keys match the engine's, in order: ${listed.join(', ')}`);

// The browser must never carry anything that decides an outcome.
ok(!/verifyPoints|expectedBandFor|hasSubstance|BAND_COPY/.test(orch), 'no verification, banding or filtering happens in the browser');
ok(!/band\s*[:=]\s*['"]/.test(orch), 'and it never names a band itself');

// §3.3 and §8.5 — the two places a run must degrade instead of failing.
ok(/if \(bd\.done\)/.test(orch), 'an unreadable submission ends the run after one call');
ok(/onSources && onSources\(\[\]\)/.test(orch), 'a failed research pass leaves the competitive read honestly empty');
ok(/if \(e\.status === 402\) throw e/.test(orch), 'but the account spend cap stops everything, since nothing after it can succeed');
ok(/failed: e\.body/.test(orch), 'one dead nugget leaves its card empty rather than failing the page');

// §6.5 — the reveal is progressive because the fan-out calls back per item, not at the end.
ok(/onNugget && onNugget\(out, landed\.length/.test(orch), 'each finding paints as it lands');
ok(/const FANOUT = 6/.test(orch), 'all six reasoning calls run at once — they never carry the corpus');

console.log('\n19. THE PAGES ARE ACTUALLY WIRED TO IT');
// A feature nobody can reach is not built. These assert the two call sites, and the one thing about them
// that matters most: an old snapshot keeps the page it was scored on.
const fsp = await import('node:fs/promises');
const assess = await fsp.readFile(new URL('../workspace/assess-next.html', import.meta.url), 'utf8');
const wsjs = await fsp.readFile(new URL('../workspace/workspace-m3.js', import.meta.url), 'utf8');

ok(/DS\.verdictPage\(v2/.test(assess), 'the Verdict tab renders verdictPage from a v2 snapshot');
ok(/p\.prescreen2 && p\.prescreen2\.v === 2/.test(assess), 'and only when the snapshot really is v2');
// A range and a band are different instruments. Rendering an old range AS a band would invent a verdict
// nobody measured — the same reasoning as isV3Scale.
ok(/DS\.rangeHero\(r/.test(assess), 'a pre-v2 snapshot still renders on the range page it was scored on');
ok(assess.indexOf('DS.verdictPage(v2') < assess.indexOf('DS.rangeHero(r'), 'v2 is checked first');

// The correction path, end to end: the DS button names the handler and the page defines it.
const dsrc = await fsp.readFile(new URL('../shared/m3/ds.js', import.meta.url), 'utf8');
for (const fn of ['__ps2Correct', '__ps2SaveBrief', '__ps2CancelBrief']) {
  ok(dsrc.includes(fn) && new RegExp('window\\.' + fn + ' =').test(assess),
     `${fn}: the component calls it and the page defines it`);
}
ok(/correctBrief/.test(assess), 'saving a correction goes through the orchestrator, not a bare fetch');
ok(/nuggets: \{\}, sources: \[\]/.test(assess), 'and clears the old findings so none sits beside a corrected brief');
ok(/edit_limit/.test(assess) && /402/.test(assess), 'both refusals the customer can actually hit are named');

// The create screen runs v2, and the stage lists what v2 works through.
ok(/runPrescreen2/.test(wsjs), 'the create screen runs the v2 orchestrator');
ok(!/import\('\.\/prescreen\.js'\)/.test(wsjs), 'and no longer imports the v1 one');
ok(/PS2_NUGGETS/.test(wsjs), 'the run stage lists the six findings, not the seven retired categories');
ok(/onNugget:/.test(wsjs) && !/onCategory:/.test(wsjs), 'and listens for findings landing rather than categories');

console.log('\n20. TWO TIERS — MEASURED 2026-10-31, not designed');
// web_search returns `encrypted_content`, on both the current tool and the pre-dynamic-filtering
// `web_search_20250305`. The model can read a result page; our code cannot. The first smoke test
// therefore DROPPED two true, correctly-cited findings. These checks pin the fix: verify where we can
// read, attribute where we cannot, and never present the second as the first.
const unread = [{ url: 'https://a.example', title: 'A', text: '', fetchFail: 'http_403' }];
const readable = [{ url: 'https://b.example', title: 'B', fetched: true, text: 'Sprive raised 7.3 million dollars in a round led by Ascension. '.repeat(4) }];
const claim = (span) => [{ point: 'Sprive raised £7.3M', external: true, sourceIndex: 0, quotedSpan: span, docName: '' }];

const att = E.verifyPoints(claim('Sprive raised 7.3 million dollars'), unread, 'corpus');
ok(att.kept.length === 1 && att.kept[0].tier === 'attributed',
   'a claim on a page we could not read is KEPT and marked attributed');
ok(att.kept[0].unread === 'http_403', 'and records why we could not read it');
ok(att.kept[0].source.url === 'https://a.example', 'with its real URL intact');

const ver = E.verifyPoints(claim('Sprive raised 7.3 million dollars'), readable, 'corpus');
ok(ver.kept.length === 1 && ver.kept[0].tier === 'verified', 'a matching span on a page we DID read is verified');

// The guardrail must still bite wherever we hold the text, or the tier is just a label.
const wrong = E.verifyPoints(claim('Sprive raised ninety nine billion'), readable, 'corpus');
ok(wrong.kept.length === 0 && wrong.dropped[0].why === 'span not in source',
   'a WRONG span on a page we read is still dropped — verification is not weakened, only scoped');

// The hard guarantee is untouched: an index outside the harvested list cannot be cited.
const bogus = E.verifyPoints([{ point: 'Monzo raised £500m', external: true, sourceIndex: 9, quotedSpan: 'x'.repeat(40), docName: '' }], readable, 'corpus');
ok(bogus.kept.length === 0 && bogus.dropped[0].why === 'no such source', 'an invented source index is still impossible');

// Internal claims have no attributed tier — we always hold the document.
const internalOnly = E.verifyPoints([{ point: 'Retention is 38% at twelve weeks', external: false, quotedSpan: 'retention is 38% at twelve weeks', docName: 'deck.pdf' }],
                           [], 'The deck says retention is 38% at twelve weeks across pilots.');
ok(internalOnly.kept.length === 1 && internalOnly.kept[0].tier === 'verified', 'an internal claim is verified or nothing');

ok(typeof E.fetchSourceText === 'function', 'the page fetcher exists — it is what earns the stronger tier');
ok(E.htmlToText('<p>a&nbsp;b &amp; <script>x()</script>c</p>') === 'a b & c',
   'and its text extraction strips scripts and decodes entities a span would contain');
const tc = E.tierCounts({ a: { points: att.kept.concat(ver.kept, internalOnly.kept) } });
ok(tc.verified === 1 && tc.attributed === 1 && tc.internal === 1, `tierCounts reports the split: ${JSON.stringify(tc)}`);

console.log('\n21. THE TIERS ARE VISIBLY DIFFERENT ON SCREEN');
const dsrc2 = await (await import('node:fs/promises')).readFile(new URL('../shared/m3/ds.js', import.meta.url), 'utf8');
const v2blk = dsrc2.slice(dsrc2.indexOf('PRE-SCREEN v2 — the flavour'));
ok(/according to /.test(v2blk), 'an attributed citation says "according to"');
ok(/We have not read this page ourselves/.test(v2blk), 'and says so plainly on hover');
ok(/tier === 'attributed'/.test(v2blk), 'the component branches on the tier rather than guessing');

console.log('\n22. EVERY ACTION THE BROWSER CAN ASK FOR IS REACHABLE');
// api/memo.js guards its dispatcher with an ACTIONS whitelist. The v2 actions were written, gated and
// DEPLOYED without being added to it, so the first live run died with `bad_action` while reading the
// deck. §17 proved the handlers existed; nothing proved they could be called. A handler nobody can
// reach is not a feature, and this is the check that would have caught it.
const memoFile = await (await import('node:fs/promises')).readFile(new URL('../api/memo.js', import.meta.url), 'utf8');
const whitelisted = (memoFile.match(/const ACTIONS = \[([\s\S]*?)\]/) || [, ''])[1]
  .split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
const orchSrc = await (await import('node:fs/promises')).readFile(new URL('../workspace/prescreen2.js', import.meta.url), 'utf8');
// Everything the orchestrator posts, and everything with a handler block.
const posted = [...orchSrc.matchAll(/action: '([^']+)'/g)].map(m => m[1]);
const handled = [...memoFile.matchAll(/action === '(ps2-[^']+)'/g)].map(m => m[1]);
const unique = (a) => [...new Set(a)];

ok(unique(posted).length > 0, `the orchestrator posts ${unique(posted).length} action(s): ${unique(posted).join(', ')}`);
const unreachable = unique(posted).filter(a => !whitelisted.includes(a));
ok(!unreachable.length, `every posted action is whitelisted${unreachable.length ? ' — UNREACHABLE: ' + unreachable.join(', ') : ''}`);
const unlisted = unique(handled).filter(a => !whitelisted.includes(a));
ok(!unlisted.length, `every ps2 handler is whitelisted${unlisted.length ? ' — UNREACHABLE: ' + unlisted.join(', ') : ''}`);
// The correction path is posted from the page, not the orchestrator, so check it by name too.
ok(whitelisted.includes('ps2-brief-edit'), 'the correction action is whitelisted (posted from assess-next.html)');
const assessSrc = await (await import('node:fs/promises')).readFile(new URL('../workspace/assess-next.html', import.meta.url), 'utf8');
const pagePosted = unique([...assessSrc.matchAll(/action: '(ps2-[^']+)'/g)].map(m => m[1]));
const pageBad = pagePosted.filter(a => !whitelisted.includes(a));
ok(!pageBad.length, `every action the page posts is whitelisted${pageBad.length ? ' — UNREACHABLE: ' + pageBad.join(', ') : ''}`);

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
