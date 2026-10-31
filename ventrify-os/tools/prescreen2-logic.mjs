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
const sources = [{ url: 'https://example.com/a', title: 'A', text: 'Cleo raised £28m in a Series B led by Sofina in 2022.' }];
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
ok(why('Chime') === 'span not in source', 'a fabricated public claim is dropped: ' + why('Chime'));
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

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
