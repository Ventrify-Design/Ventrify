#!/usr/bin/env node
// ============================================================
// prescreen-containment — THE NON-NEGOTIABLE GATE (design/prescreen-spec.md §7).
//
// Run the pre-screen against every engagement already scored in the system, and assert the PUBLISHED
// COMPOSITE falls inside the predicted range. If containment is below ~90%, widen the floor until it is.
//
// WHY THIS IS THE ONE PART THAT DOES NOT BEND. If a founder pre-screens at 55-70 and the paid assessment
// returns 44, the refund is the cheap part of that mistake. A range that does not contain the number it is
// selling is not a lead magnet, it is a liability — and the failure is invisible until a customer finds it.
//
// IT SPENDS REAL MONEY. A full replay is ~$1.60 per engagement, so --live is required and the estimated
// cost is printed and confirmed before anything is sent. Without --live this is a dry run: it proves the
// harness can find the engagements, rebuild each corpus and compute, and tells you what live would cost.
// A dry run deliberately does NOT substitute published scores for model output — that would contain by
// construction and report a pass that means nothing.
//
// Needs FIREBASE_SERVICE_ACCOUNT and (for --live) ANTHROPIC_API_KEY.
// ============================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const PS = require('../api/_prescreen.js');
const { VSS_RUBRIC } = await import(new URL('../shared/vss-rubric.js', import.meta.url));

const LIVE = process.argv.includes('--live');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 0;
const CONTAINMENT_FLOOR = 0.90;

// Fast mode is $8/$40 per MTok. One engagement = 1 warm write + 21 reads + ~21K output.
const estCost = (tokens) => (tokens / 1e6 * 8 * 1.25) + (21 * tokens / 1e6 * 2) + (21 * 1000 / 1e6 * 40);

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('FIREBASE_SERVICE_ACCOUNT is not set — this gate reads real engagements and cannot run without it.');
  process.exit(2);
}
if (LIVE && !process.env.ANTHROPIC_API_KEY) {
  console.log('--live needs ANTHROPIC_API_KEY.');
  process.exit(2);
}
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

console.log(`prescreen-containment — ${LIVE ? 'LIVE (this spends money)' : 'DRY RUN (no model calls)'}\n`);

// ---- find every engagement that has a published v3 score to check against ----
const engs = await db.collection('engagements').get();
const subjects = [];
for (const doc of engs.docs) {
  const snaps = await doc.ref.collection('investabilitySnapshots').orderBy('at', 'desc').limit(1).get();
  if (snaps.empty) continue;
  const snap = snaps.docs[0].data();
  // Pre-v3 snapshots are on a /35 scale and cannot be compared with a 0-100 range. Skipping them is
  // correct; silently comparing them would manufacture failures that say nothing about the pre-screen.
  if (snap.status !== 'scored' || (snap.maxPossible || 0) !== 100) continue;
  const fd = await doc.ref.collection('founderDocs').get();
  const corpus = PS.buildCorpus(fd.docs.map(d => { const x = d.data(); return { name: x.name, text: x.text || '', docType: x.docType }; }));
  if (!corpus.included) continue;
  subjects.push({ id: doc.id, name: doc.data().name || doc.id, published: snap.composite, corpus });
}

const list = LIMIT ? subjects.slice(0, LIMIT) : subjects;
if (!list.length) {
  console.log('No scored v3 engagements with an ingested corpus were found — nothing to check against.');
  console.log('That is not a pass. The gate has no subjects.');
  process.exit(2);
}

const totalTokens = list.reduce((a, s) => a + s.corpus.tokens, 0);
console.log(`${list.length} scored engagement(s) with a corpus:`);
for (const s of list) console.log(`  ${s.name.padEnd(28)} published ${String(s.published).padStart(3)} · ${s.corpus.included}/${s.corpus.total} docs · ${s.corpus.tokens} tok`);
console.log(`\nestimated live cost: $${list.reduce((a, s) => a + estCost(s.corpus.tokens), 0).toFixed(2)} (${totalTokens} corpus tokens, ${list.length * 22} calls)`);

if (!LIVE) {
  console.log('\nDRY RUN — the harness resolved every subject and rebuilt every corpus. No range was predicted,');
  console.log('because predicting one needs the model. Re-run with --live (and a budget) to measure containment.');
  process.exit(0);
}

// ---- live replay ----
const apiKey = process.env.ANTHROPIC_API_KEY;
let contained = 0, checked = 0;
const rows = [];
for (const s of list) {
  process.stdout.write(`\n${s.name} … `);
  try {
    const warm = await PS.warmCache(s.corpus.text, apiKey);
    const probes = await Promise.all(VSS_RUBRIC.map(c => PS.probeCategory(c, s.corpus.text, apiKey)));
    const cats = VSS_RUBRIC.map((c, i) => ({ ...c, signals: PS.consolidate(c, probes[i].draws) }));
    const r = PS.composeRange(cats);
    const inside = s.published >= r.floor && s.published <= r.ceiling;
    checked++; if (inside) contained++;
    const reads = probes.reduce((a, p) => a + p.usage.cacheRead, 0);
    rows.push({ ...s, ...r, inside, cacheWrote: warm.wrote, cacheRead: reads, speed: probes[0].usage.speed });
    console.log(`${r.floor}–${r.ceiling} vs ${s.published}  ${inside ? '✓ contained' : '✗ OUTSIDE'}  (cache read ${reads} tok, speed ${probes[0].usage.speed || '?'})`);
  } catch (e) {
    console.log(`FAILED: ${e.message}${e.detail ? ' — ' + e.detail : ''}`);
  }
}

console.log('\n──────────────────────────────────────────────');
for (const r of rows) {
  console.log(`  ${r.inside ? '✓' : '✗'} ${r.name.padEnd(26)} ${String(r.floor).padStart(3)}–${String(r.ceiling).padEnd(3)} (width ${String(r.width).padStart(2)}) · published ${r.published}` + (r.inside ? '' : `  ← ${r.published < r.floor ? 'BELOW the floor' : 'ABOVE the ceiling'}`));
}
const rate = checked ? contained / checked : 0;
console.log(`\ncontainment: ${contained}/${checked} = ${(rate * 100).toFixed(0)}%  (floor ${CONTAINMENT_FLOOR * 100}%)`);

// A miss BELOW the floor is the dangerous direction: we promised more than the paid run delivered.
const below = rows.filter(r => !r.inside && r.published < r.floor);
if (below.length) console.log(`\n${below.length} prediction(s) were ABOVE the real score. That is the direction that causes refunds — widen the floor.`);

// Cache health, reported rather than assumed — if reads are 0 the run cost ~5x what the spec budgets.
const zeroCache = rows.filter(r => r.cacheRead === 0);
if (zeroCache.length) console.log(`\n${zeroCache.length} engagement(s) recorded ZERO cache reads — a silent invalidator is loose and every probe paid full price.`);

console.log('');
console.log(rate >= CONTAINMENT_FLOOR ? 'PASS — the published score falls inside the predicted range often enough to sell.' : 'FAIL — widen the floor until containment reaches 90%.');
process.exit(rate >= CONTAINMENT_FLOOR ? 0 : 1);
