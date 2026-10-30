#!/usr/bin/env node
// ============================================================
// prescreen-logic — the pre-screen's arithmetic, proven without spending anything.
//
// Everything here runs offline. The model call is the expensive, slow, non-deterministic part; the
// RANGE CONSTRUCTION is none of those things, and it is where the product actually lives. A wrong median,
// a prefix that varies by category, or a band published across a boundary would each be invisible in a
// live run and expensive in a different way — the second one quietly costs ~5x per run.
//
// This is NOT the containment gate (tools/prescreen-containment.mjs), which replays real engagements
// through the real model and is the thing that decides whether the range can be trusted. This proves the
// maths; that proves the claim.
// ============================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../api/_prescreen.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

(async () => {
const { VSS_RUBRIC } = await import(new URL('../shared/vss-rubric.js', import.meta.url));

console.log('\n1. CORPUS — order must be deterministic (the cache matches byte for byte)');
const docs = [
  { name: 'Zebra metrics.xlsx', text: 'z'.repeat(400), docType: 'dataroom' },
  { name: 'Deck.pdf', text: 'd'.repeat(400), docType: 'pitch' },
  { name: 'Alpha cap table.xlsx', text: 'a'.repeat(400), docType: 'dataroom' },
];
const c1 = P.buildCorpus(docs);
const c2 = P.buildCorpus([docs[2], docs[0], docs[1]]);          // same docs, different query order
ok(c1.text === c2.text, 'same documents in a different order produce an identical corpus');
ok(c1.text.indexOf('Deck.pdf') < c1.text.indexOf('Alpha'), 'the pitch deck is always first');
ok(c1.text.indexOf('Alpha') < c1.text.indexOf('Zebra'), 'the rest are alphabetical');

console.log('\n2. CORPUS — the 40K-token cap holds and reports what it dropped');
const big = Array.from({ length: 40 }, (_, i) => ({ name: `doc-${String(i).padStart(2,'0')}.pdf`, text: 'x'.repeat(20000), docType: 'dataroom' }));
const cb = P.buildCorpus(big);
ok(cb.tokens <= P.CORPUS_MAX_TOKENS, `corpus capped at ${cb.tokens} ≤ ${P.CORPUS_MAX_TOKENS} tokens`);
ok(cb.dropped.length > 0 && cb.included < cb.total, `${cb.included} of ${cb.total} included, ${cb.dropped.length} named as dropped`);

console.log('\n3. PREFIX STABILITY — the cached block must not vary by category (trap 2)');
const sys = VSS_RUBRIC.map(cat => JSON.stringify(P.requestBody(cat, c1.text).system));
ok(new Set(sys).size === 1, 'all 7 categories send a byte-identical cached system block');
const msgs = VSS_RUBRIC.map(cat => P.requestBody(cat, c1.text).messages[0].content);
ok(new Set(msgs).size === 7, 'the varying part is in messages, after the breakpoint');
ok(JSON.parse(sys[0])[0].cache_control.type === 'ephemeral', 'the breakpoint is set on the system block');

console.log('\n4. DRAWS — median on score, MAJORITY on evidenced, splits flagged');
const cat = VSS_RUBRIC[0], s = cat.subs;
const mk = (sc, ev) => s.map((slug, i) => ({ slug, evidenced: ev[i], score: sc[i], note: 'n' + sc[i] }));
const con = P.consolidate(cat, [
  mk([4,2,3,1,0], [true,true,true,false,false]),
  mk([2,2,3,5,0], [true,true,false,false,false]),
  mk([5,2,3,1,0], [true,true,true,true,false]),
]);
ok(con[0].score === 4, `median of [4,2,5] = 4 (got ${con[0].score})`);
ok(con[1].score === 2 && !con[1].split, 'unanimous 2 is not flagged as a split');
ok(con[0].split === true, 'the 4/2/5 signal IS flagged as decided by one vote');
ok(con[2].evidenced === true, 'evidenced 2-of-3 → true');
ok(con[3].evidenced === false, 'evidenced 1-of-3 → false (conservative direction)');
ok(con[3].score === 0, 'an unevidenced signal carries no score into the floor');

console.log('\n5. THE RANGE — a deck-only read must reproduce the spec\'s ~±15 points');
// deck evidences market/product/evidence fully and team partly — spec §2
const deckOnly = VSS_RUBRIC.map(c => {
  const full = ['market','product','evidence'].includes(c.key);
  const part = c.key === 'team';
  return { ...c, signals: c.subs.map((slug, i) => ({
    slug, evidenced: full || (part && i < 3), score: (full || (part && i < 3)) ? 3 : 0 })) };
});
const r = P.composeRange(deckOnly);
console.log(`     floor ${r.floor} · ceiling ${r.ceiling} · width ${r.width} · ${r.evidencedWeight}% of weight evidenced`);
ok(r.width >= 24 && r.width <= 36, `deck-only spread is ${r.width} points — spec says roughly ±15 (24–36)`);

console.log('\n6. THE RANGE — a complete room must collapse the width to zero');
const complete = VSS_RUBRIC.map(c => ({ ...c, signals: c.subs.map(slug => ({ slug, evidenced: true, score: 3 })) }));
const rc = P.composeRange(complete);
ok(rc.width === 0, `every signal evidenced → width ${rc.width} (the range IS the deficit)`);
ok(rc.floor === 60 && rc.ceiling === 60, `all-par scores 60/100 (got ${rc.floor})`);

console.log('\n7. THE RANGE — nothing evidenced is the widest possible, and par-capped');
const none = VSS_RUBRIC.map(c => ({ ...c, signals: c.subs.map(slug => ({ slug, evidenced: false, score: 0 })) }));
const rn = P.composeRange(none);
ok(rn.floor === 0 && rn.ceiling === 60, `0–60: the ceiling is par, never 100 (got ${rn.floor}–${rn.ceiling})`);

console.log('\n8. BANDS — a straddling range must NOT publish one (§3.1)');
ok(P.rangeBand(48, 71).band === null, '48–71 straddles → no band published');
ok(JSON.stringify(P.rangeBand(48, 71).spans) === '["HIGH_RISK","PROMISING"]', '48–71 spans High risk → Promising');
ok(P.rangeBand(62, 71).band === 'PROMISING', '62–71 sits inside one band → published');
ok(P.rangeBand(30, 35).band === 'POTENTIAL_DECLINE', '30–35 sits inside one band → published');
ok(P.rangeBand(39, 41).band === null, '39–41 straddles the 40 line → suppressed');

console.log('\n9. SCHEMA — slugs and scores are constrained by the schema, not by hope');
const sch = P.schemaFor(cat);
const it = sch.properties.signals.items;
ok(JSON.stringify(it.properties.slug.enum) === JSON.stringify(cat.subs), 'slug is an enum of this category\'s subs');
ok(JSON.stringify(it.properties.score.enum) === '[0,1,2,3,4,5]', 'score is an enum 0–5 (numeric ranges are unsupported)');
ok(it.additionalProperties === false, 'additionalProperties:false, as structured outputs require');

console.log('\n10. REQUEST — the model contract');
const b = P.requestBody(cat, c1.text);
ok(!('speed' in b), 'no speed parameter by default — standard, because this org has no fast allocation');
ok(P.requestBody(cat, c1.text, { speed: 'fast' }).speed === 'fast', 'speed:"fast" is a top-level parameter when asked for');
ok(b.model === 'claude-opus-5-5', 'model is claude-opus-5-5');
ok(b.output_config.effort === 'low', 'effort set explicitly to low (the default is medium)');
ok(!('thinking' in b), 'no thinking parameter — disabling it is a 400 on this model at every effort');
ok(!('tool_choice' in b), 'no forced tool_choice — a 400 on this model; structured outputs instead');
ok(b.output_config.format.type === 'json_schema', 'output_config.format, not the deprecated output_format');
const warm = P.requestBody(null, c1.text, { warm: true });
ok(warm.max_tokens === 0, 'the warm-up generates nothing (max_tokens: 0)');
ok(JSON.stringify(warm.system) === JSON.stringify(b.system), 'the warm-up writes exactly the prefix the probes read');

console.log('\n11. ENTITLEMENT — unlimited ventures, each scored once');
const PLAN = await import(new URL('../workspace/plan.js', import.meta.url));
// The quota was removed 2026-10-30 (spec §8.6). A per-ACCOUNT cap rationed the hook; the
// per-VENTURE rule is what bounds the spend. If any preset grows a number again, the free
// account silently starts hitting a wall on its 4th company and nobody finds out for weeks.
for (const [name, def] of Object.entries(PLAN.PLAN_PRESETS)) {
  ok(def.limits.prescreens === null, `preset "${name}" has unlimited pre-screens`);
}
// The behaviour that matters, not just the table: a free account on its 10th venture.
const freePlan = PLAN.resolvePlan({ plan: { preset: 'self-serve' } });
const nine = Array.from({ length: 9 }, () => ({ engagementType: 'assessment', tier: 'prescreen' }));
ok(PLAN.canCreate(freePlan, nine, 'assessment', 'prescreen').allowed, 'a free account may pre-screen a 10th venture');
ok(!PLAN.canCreate(freePlan, [], 'assessment', 'full').allowed, 'a free account still may NOT create a full assessment');
ok(!PLAN.canCreate(freePlan, [], 'build').allowed, 'a free account still may not build');
// planSummary suppresses unlimited pre-screens only when something else prints.
ok(/pre-screen/.test(PLAN.planSummary(freePlan).detail), `free badge says what it allows: "${PLAN.planSummary(freePlan).detail}"`);
ok(!/pre-screen/.test(PLAN.planSummary(PLAN.resolvePlan({ plan: { preset: 'full' } })).detail), 'a full licence does not repeat unlimited pre-screens');

console.log('\n12. ENFORCEMENT — the per-venture rule carries the weight alone now');
const memo = await (await import('node:fs/promises')).readFile(new URL('../api/memo.js', import.meta.url), 'utf8');
ok(/reason: 'self'/.test(memo), 'prescreen-warm refuses a re-run of an already-scored engagement');
ok(/prescreenClaimedAt/.test(memo), 'warm takes a claim, so an abandoned run still holds the venture');
ok(/CLAIM_LEASE_MS/.test(memo), 'the claim is a lease, not permanent — our 502 must not burn their free look');

console.log(fails ? `\n${fails} FAILED\n` : '\nall checks passed\n');
process.exit(fails ? 1 : 0);
})();
