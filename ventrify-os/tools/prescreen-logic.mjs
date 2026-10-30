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
// Was "the rest are alphabetical". The alphabet is not a ranking, and ordering by it is what let
// `Cost_of_Delay_Briefing` be read while `MoneyGym_Seed_Investor_Memo` was not (§17). The invariant
// that mattered was DETERMINISM, which the line above tests directly; the order itself is now evidence
// value, so traction metrics outrank a cap table.
ok(c1.text.indexOf('Zebra') < c1.text.indexOf('Alpha'), 'the rest rank by evidence value, not by name');

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

console.log('\n13. PLAN-INDEPENDENCE — a pre-screened assessment behaves the SAME on every licence');
// The operator's hard requirement, as a test rather than a promise: "ANY pre-screened assessment should
// always work the same way — I don't want to find out that when I switch the type of plan on another
// organisation, it behaves differently." The org PLAN decides how much you may create; the engagement
// TIER decides what a created thing can do. If a plan ever leaks into the second, this fails.
const EN = await import(new URL('../shared/entitlements.js', import.meta.url));
const presets = Object.keys(PLAN.PLAN_PRESETS);
const shape = pl => JSON.stringify(EN.entitlements({ tier: 'prescreen' }, PLAN.resolvePlan({ plan: { preset: pl } })));
const base = shape(presets[0]);
for (const pl of presets) ok(shape(pl) === base, `prescreen tier on "${pl}" grants exactly what it grants on "${presets[0]}"`);
ok(shape('self-serve') === shape(null), 'an org with NO plan at all is no different either');
// And the reverse: a FULL-tier engagement must differ from a pre-screened one, or the gate proves nothing.
ok(shape('full') !== JSON.stringify(EN.entitlements({ tier: 'full' }, PLAN.resolvePlan({ plan: { preset: 'full' } }))),
   'a full-tier engagement IS different — the comparison above is meaningful');

console.log('\n14. ONE INGEST PATH — the data room reads the same way everywhere');
// The Drive read used to be inlined per page, which is how one copy ended up silent for 46 documents
// while the other reported progress. Both screens now call addToRoom, and nothing calls the old one.
const fsp = await import('node:fs/promises');
const ea = await fsp.readFile(new URL('../workspace/engagement-actions.js', import.meta.url), 'utf8');
const wm = await fsp.readFile(new URL('../workspace/workspace-m3.js', import.meta.url), 'utf8');
const an = await fsp.readFile(new URL('../workspace/assess-next.html', import.meta.url), 'utf8');
ok(/export async function addToRoom/.test(ea), 'addToRoom is the single ingest routine');
ok(!/function readDriveFolder/.test(ea), 'the superseded readDriveFolder is gone, not left beside it');
ok(/EA\.addToRoom\(/.test(wm), 'the create screen uses it');
ok(/EA\.addToRoom\(/.test(an), 'the data-room tab uses it');
ok(/onRoom/.test(ea) && /roomEvery/.test(ea), 'it re-checks the room DURING the ingest, so ticks land as evidence does');
for (const [name, src] of [['create screen', wm], ['data-room tab', an]])
  ok(/roomScanBanner/.test(src), `${name} shows the scan banner`);

console.log('\n15. REVEAL — work that starts below the fold scrolls the user to it');
// The button that starts a scan sits BELOW the surface that reports it on every one of these screens.
// Pressed from the bottom of the tab, the progress bar is a screen away and the product looks dead.
// Each entry point reveals, through ONE helper — four copies of scrollIntoView is how one of them ends
// up offsetting by the wrong masthead, or calling window.scrollTo on a page where window does not scroll.
const ds = await fsp.readFile(new URL('../shared/m3/ds.js', import.meta.url), 'utf8');
ok(/export function revealLive/.test(ds), 'revealLive is the single reveal helper');
ok(/export function scrollParent/.test(ds), 'scrollParent names what actually scrolls');
ok(!/let sc = mh\.parentElement/.test(ds), 'wireMinify shares it rather than keeping its own copy');
ok(/already watching it/.test(ds), 'it no-ops when the target is already in view');
ok(/prefers-reduced-motion/.test(ds), 'it honours reduced motion');
// .app-scroll pages scroll .shell-main, not the document — a window.scrollTo there moves nothing.
ok(!/window\.scrollTo\(/.test(wm), 'no window.scrollTo survives in the workspace (a no-op under .app-scroll)');
const revealsIn = src => (src.match(/revealLive\(/g) || []).length;
ok(revealsIn(an) >= 2, `the data-room tab reveals from every scan entry point (${revealsIn(an)} call sites)`);
ok(revealsIn(wm) >= 2, `the create screen reveals for both the room read and the run stage (${revealsIn(wm)} call sites)`);

console.log('\n16. STICKY SURFACES clear the masthead they sit under');
// The create screen's live panel is sticky at the top of a page whose masthead is ALSO sticky and
// between 115px and 209px tall depending on scroll. It was parked at top:24px — behind it. The drill
// rail has tracked the live height since it was built; nothing else did. One tracker now, two users.
const wcss = await fsp.readFile(new URL('../shared/m3/workspace-chrome.css', import.meta.url), 'utf8');
const tcss = await fsp.readFile(new URL('../shared/m3/theme.css', import.meta.url), 'utf8');
ok(/function trackMastheadHeight/.test(ds), 'one tracker publishes a masthead height');
ok(/trackMastheadHeight\(surf, '--drill-mh-h'\)/.test(ds), 'the drill rail uses it');
ok(/trackMastheadHeight\(mainSurf, '--mh-h'\)/.test(ds), 'the main shell publishes --mh-h too');
ok(/\.na-side \{[^}]*top: calc\(var\(--mh-h/.test(wcss), 'the live panel parks below the masthead, not behind it');
ok(/\.na-side \{[^}]*max-height: calc\(100dvh - var\(--mh-h/.test(wcss), 'and scrolls within itself rather than being clipped');
ok(/--drill-mh-h, 120px/.test(tcss), 'the drill rail still has its own value, so the two cannot fight');

console.log('\n17. SELECTION — the budget is spent on what SCORES, not on what the checklist names');
// MoneyGym's room: the old ordering read a director's resignation and a truncated spreadsheet and
// never reached the market analysis, then reported "No market growth rates appear".
const mkDoc = (name, tok = 2000) => ({ name, text: 'x'.repeat(tok * 4), docType: undefined });
const room = [
  { name: 'Deck.pdf', text: 'd'.repeat(8000), docType: 'pitch' },
  mkDoc('Copy of Board_Resolution_Fixing_Number_of_Directors.docx'),
  mkDoc('NG Founder_Stock_Purchase_IP_Repurchase_Agreement.pdf'),
  mkDoc('MoneyGym_Seed_Investor_Memo_updated.pdf'),
  mkDoc('MoneyGym_Seed_Investor_Memo_updated.docx'),
  mkDoc('MoneyGym-Market-Sizing-TAM-SAM-SOM.docx'),
  mkDoc('Team_Bios_and_Org_Chart.docx'),
];
const built = P.buildCorpus(room);
const at = n => built.text.indexOf(n);
ok(at('Team_Bios_and_Org_Chart.docx') > -1, 'team evidence is read');
ok(at('MoneyGym-Market-Sizing-TAM-SAM-SOM.docx') > -1, 'market sizing is read');
ok(at('MoneyGym_Seed_Investor_Memo_updated.pdf') > -1 || at('MoneyGym_Seed_Investor_Memo_updated.docx') > -1, 'the investor memo is read');
ok(!(at('MoneyGym_Seed_Investor_Memo_updated.pdf') > -1 && at('MoneyGym_Seed_Investor_Memo_updated.docx') > -1),
   'the SAME memo is not read twice as .pdf and .docx');
ok(at('MoneyGym_Seed_Investor_Memo_updated.docx') < at('Copy of Board_Resolution_Fixing_Number_of_Directors.docx')
   || at('MoneyGym_Seed_Investor_Memo_updated.pdf') < at('Copy of Board_Resolution_Fixing_Number_of_Directors.docx'),
   'a cross-cutting investor memo outranks governance paperwork');
ok(at('Team_Bios_and_Org_Chart.docx') < at('Copy of Board_Resolution_Fixing_Number_of_Directors.docx'),
   'team bios outrank a board resolution');
// Three differently-named stock agreements are three people, not one document: never merged.
const three = P.buildCorpus([{ name: 'Deck.pdf', text: 'd'.repeat(8000), docType: 'pitch' },
  mkDoc('NG Founder_Stock_Purchase.pdf', 300), mkDoc('2nd NG Founder_Stock_Purchase.pdf', 300), mkDoc('JC Founder_Stock_Purchase.pdf', 300)]);
ok(three.included === 4, `three different founders' agreements all survive dedupe (included ${three.included})`);
ok(P.PER_DOC_MAX ? P.PER_DOC_MAX <= P.CORPUS_MAX_TOKENS * 0.21 : true, 'no single document may take more than a fifth of the budget');

console.log('\n18. STALENESS — the range says when the room has moved on without it');
ok(/export function rangeStale/.test(ds), 'rangeStale exists');
ok(/roomDocs/.test(memo), 'finalise records how big the room WAS');
ok(/rangeStale\(/.test(an), 'the Range tab renders it');

console.log(fails ? `\n${fails} FAILED\n` : '\nall checks passed\n');
process.exit(fails ? 1 : 0);
})();
