#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   PRESCREEN CALIBRATION (v2) — READ ONLY, FREE. Does the band agree with the
   assessment, and do the cuts discriminate at all?

     node tools/prescreen-calibration.mjs

   WHAT THIS REPLACED. The previous version compared a pre-screen's per-signal
   0–5 scores against the full run's 0/0.5/1 scores, normalised to a percentage
   of each category's maximum. v2 has no per-signal scores — it publishes a
   BAND — so that tool still ran, still printed numbers, and the numbers no
   longer meant anything. A tool that keeps answering after its question has
   been retired is worse than one that errors.

   THE TWO QUESTIONS NOW, AND THEY ARE DIFFERENT:

   1 · AGREEMENT. Where a venture has both a v2 band and a full assessment, do
       they agree? Ordinal agreement is the bar (spec §11.3): the band maps to a
       composite range, and High/Medium/Low must land in the right one. This is
       a far lower bar than numerical containment and it is the right one — a
       pre-screen that reads documents for a minute is not entitled to a number.

   2 · SPREAD (calibration step zero). Across EVERY assessed engagement, do the
       composites spread over the three cuts, or do they pile into one? If they
       pile up, the cuts are wrong and must move BEFORE anyone pays for a
       replay. prescreen-bands.mjs will later assert >60% in one band is a
       failure; this prints the distribution that assertion will read.

   It also reports each run's COMPOSITION using the canonical rule imported from
   prescreen-composition.mjs — not a second copy of the arithmetic.
   ════════════════════════════════════════════════════════════════════════════ */
import { initAdmin } from './contract-auth.mjs';
import { composition } from './prescreen-composition.mjs';

/* The cuts, from the runner's own guidance bands (shared/vss-rubric.js). NOT invented here:
   the pre-screen's three bands collapse the runner's top two, because to "is this worth
   assessing?" both READY and PROMISING answer yes. */
const CUTS = [
  { band: 'HIGH',   min: 60, max: Infinity, says: 'READY or PROMISING' },
  { band: 'MEDIUM', min: 40, max: 59.999,   says: 'HIGH_RISK' },
  { band: 'LOW',    min: -Infinity, max: 39.999, says: 'POTENTIAL_DECLINE' },
];
const bandFor = (c) => (CUTS.find(x => c >= x.min && c <= x.max) || {}).band || null;

const admin = await initAdmin();
const db = admin.firestore();
const all = await db.collection('engagements').get();

/* Group by venture: a pre-screen and a full assessment are usually separate engagements, and the
   second run of the same venture is named "X 2". Same normalisation the old tool used. */
const byVenture = new Map();
const composites = [];
for (const d of all.docs) {
  const x = d.data();
  const base = String(x.name || '').replace(/\s*\d+$|\s*S\d+$/i, '').trim();
  if (!base) continue;
  const key = base.toLowerCase();
  if (!byVenture.has(key)) byVenture.set(key, { name: base, pre: null, full: null });
  const slot = byVenture.get(key);

  const v2 = x.prescreen2;
  if (v2 && v2.v === 2 && v2.band && (!slot.pre || (v2.ranAt || '') > (slot.pre.ranAt || ''))) {
    slot.pre = { id: d.id, band: v2.band, state: v2.state, cost: v2.costUsd, snap: v2, ranAt: v2.ranAt || '' };
  }
  const snaps = await d.ref.collection('investabilitySnapshots').get();
  if (snaps.size) {
    const latest = snaps.docs.sort((a, b) => String(b.id).localeCompare(String(a.id)))[0].data();
    if (Number.isFinite(latest.composite)) {
      composites.push({ name: base, id: d.id, composite: latest.composite });
      if (!slot.full || latest.composite > slot.full.composite) slot.full = { id: d.id, composite: latest.composite };
    }
  }
}

console.log('\n══ 1 · AGREEMENT — ventures holding both a v2 band and a full assessment ══\n');
let pairs = 0, agree = 0;
for (const { name, pre, full } of byVenture.values()) {
  if (!pre || !full) continue;
  pairs++;
  const should = bandFor(full.composite);
  const ok = should === pre.band;
  if (ok) agree++;
  const dist = CUTS.findIndex(c => c.band === pre.band) - CUTS.findIndex(c => c.band === should);
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  console.log(`      pre-screen said   ${pre.band}`);
  console.log(`      assessment scored ${full.composite}/100 → ${should}`);
  // CUTS runs HIGH → MEDIUM → LOW, so a LARGER index is a LOWER band. The first version of this line
  // read the index as if it were the band and printed "HIGHER" for a pre-screen that said LOW
  // against an assessment that said HIGH — the wrong direction, in the one tool whose whole job is
  // to say which way the instrument is off.
  if (!ok) console.log(`      ⚠ ${Math.abs(dist)} band(s) apart — the pre-screen read it ${dist > 0 ? 'LOWER' : 'HIGHER'} than the assessment`);
}
console.log(pairs
  ? `\n  ${agree}/${pairs} agree. n=${pairs} is far too small to calibrate on — it is a smoke signal, not a measurement.`
  : '\n  No venture yet holds both. Nothing to calibrate against.');

console.log('\n══ 2 · SPREAD — the assessed population against the 80/60/40 cuts ══\n');
/* ONE VENTURE, ONE VOTE — AND THE RAW COUNT BESIDE IT.
   The first version counted SNAPSHOTS, and MoneyGym alone holds six of the thirteen. Six re-scores of
   one venture clustered in the seventies made the population look far more top-heavy than it is, and
   the tool would have reported a distribution failure that was really a sampling artefact. Per
   venture is the honest denominator — prescreen-bands.mjs asserts on a GOLDEN SET, which is a set of
   ventures. The per-snapshot line stays visible underneath so the skew is never hidden either. */
const spread = (rows, label) => {
  const buckets = new Map(CUTS.map(c => [c.band, []]));
  for (const r of rows) buckets.get(bandFor(r.composite)).push(r);
  console.log(`  ${label} (n=${rows.length})`);
  for (const c of CUTS) {
    const list = buckets.get(c.band);
    const share = rows.length ? Math.round((list.length / rows.length) * 100) : 0;
    console.log(`    ${c.band.padEnd(7)} ${String(list.length).padStart(2)}/${rows.length}  ${String(share).padStart(3)}%  ${
      list.map(x => `${x.name} ${x.composite}`).join(', ') || '—'}`);
  }
  return rows.length ? Math.max(...[...buckets.values()].map(b => b.length)) / rows.length : 0;
};
if (!composites.length) {
  console.log('  No investability snapshots found.');
} else {
  // one row per venture: its HIGHEST composite, which is the one a pre-screen would be judged against
  const perVenture = [...composites.reduce((m, c) => {
    const k = c.name.toLowerCase();
    if (!m.has(k) || c.composite > m.get(k).composite) m.set(k, c);
    return m;
  }, new Map()).values()];
  const worst = spread(perVenture, 'per venture — the denominator the band gate will use');
  console.log('');
  spread(composites, 'per snapshot — shown so the re-score skew stays visible');
  console.log(`\n  Heaviest band holds ${Math.round(worst * 100)}% of ventures (prescreen-bands.mjs will fail above 60%).`);
  console.log(worst > 0.6
    ? '  ⚠ The cuts do not discriminate on this population. Move them before paying for a replay.'
    : '  The cuts discriminate on this population.');
}

console.log('\n══ 3 · COMPOSITION — how much of each run came from OUTSIDE the documents ══\n');
let any = false;
for (const { name, pre } of byVenture.values()) {
  if (!pre) continue;
  any = true;
  const c = composition(pre.snap);
  const pct = c.total ? Math.round(c.share * 100) : 0;
  console.log(`  ${c.pass ? '✓' : '✗'} ${name.padEnd(14)} ${String(c.external).padStart(2)}/${String(c.total).padStart(2)} findings external  (${String(pct).padStart(3)}%, floor 25%)   $${pre.cost}`);
}
if (!any) console.log('  No v2 snapshot stored yet.');
console.log('');
process.exit(0);
