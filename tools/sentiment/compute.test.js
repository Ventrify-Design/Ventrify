// =============================================================================
// compute.test.js — v2 scorecard math tests (zero-dep)
// =============================================================================
// Run via: node tools/sentiment/compute.test.js
// Exits non-zero on first failing assertion. No framework deps.
// =============================================================================

'use strict';

const {
  computeComposite,
  catBand,
  overallBand,
  TOTAL_SUB_CRITERIA,
} = require('./compute');
const { CATEGORIES } = require('./validate');

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

// ── Helper: build a balanced score where every sub-criterion = v ───────────
function balanced(v) {
  const categories = {};
  for (const cat of Object.keys(CATEGORIES)) {
    categories[cat] = {};
    for (const sub of CATEGORIES[cat]) {
      categories[cat][sub] = { score: v, note: v < 1 ? 'partial evidence' : null };
    }
  }
  return {
    version: 2,
    profile: 'seed',
    ratedBy: 'test',
    ratedAt: '2026-06-01T00:00:00Z',
    categories,
  };
}

// ============================================================================
console.log('Test 1 — Total possible is 35 (7 × 5)');
// ============================================================================
eq(TOTAL_SUB_CRITERIA, 35, 'TOTAL_SUB_CRITERIA = 35');

// ============================================================================
console.log('\nTest 2 — Empty score → composite 0, band unrated');
// ============================================================================
{
  const r = computeComposite({ version: 2, profile: 'seed', categories: {} });
  eq(r.composite, 0, 'composite is 0');
  eq(r.band, 'unrated', 'band is unrated');
  eq(r.rated, 0, 'rated count is 0');
  eq(r.pending, 35, 'pending count is 35');
  eq(r.deficiencies.length, 0, 'no deficiencies when empty');
}

// ============================================================================
console.log('\nTest 3 — All 1s → composite 35, band approved');
// ============================================================================
{
  const r = computeComposite(balanced(1));
  eq(r.composite, 35, 'composite = 35');
  eq(r.band, 'approved', 'band = approved');
  eq(r.bandLabel.includes('Strong'), true, 'label says Strong');
  eq(r.rated, 35, 'all 35 rated');
  eq(r.pending, 0, 'nothing pending');
  eq(r.deficiencies.length, 0, 'no deficiencies (everything is 1)');
  for (const cat of Object.keys(CATEGORIES)) {
    eq(r.categories[cat].score, 5, `${cat} score = 5`);
    eq(r.categories[cat].band, 'approved', `${cat} band = approved`);
  }
}

// ============================================================================
console.log('\nTest 4 — All 0.5s → composite 17.5, band feedback');
// ============================================================================
{
  const r = computeComposite(balanced(0.5));
  eq(r.composite, 17.5, 'composite = 17.5');
  eq(r.band, 'feedback', 'band = feedback (14-27)');
  eq(r.rated, 35, 'all 35 rated');
  eq(r.deficiencies.length, 5, '5 deficiencies in heatmap (top-5 cap)');
}

// ============================================================================
console.log('\nTest 5 — All 0s → composite 0, band rework');
// ============================================================================
{
  const r = computeComposite(balanced(0));
  eq(r.composite, 0, 'composite = 0');
  eq(r.band, 'rework', 'band = rework');
  eq(r.bandLabel.includes('Material gaps'), true, 'label says Material gaps');
  eq(r.deficiencies.length, 5, 'top-5 deficiencies surfaced even when all 0');
}

// ============================================================================
console.log('\nTest 6 — Color band boundaries');
// ============================================================================
eq(overallBand(0),    'rework',   '0 → rework');
eq(overallBand(13.5), 'rework',   '13.5 → rework');
eq(overallBand(14),   'feedback', '14 → feedback (boundary)');
eq(overallBand(27.5), 'feedback', '27.5 → feedback');
eq(overallBand(28),   'approved', '28 → approved (boundary)');
eq(overallBand(35),   'approved', '35 → approved');

console.log('  --- per-category bands');
eq(catBand(0),   'rework',   'cat 0 → rework');
eq(catBand(1.5), 'rework',   'cat 1.5 → rework');
eq(catBand(2),   'rework',   'cat 2 → rework (boundary above)');
eq(catBand(2.5), 'feedback', 'cat 2.5 → feedback');
eq(catBand(3.5), 'feedback', 'cat 3.5 → feedback');
eq(catBand(4),   'approved', 'cat 4 → approved (boundary)');
eq(catBand(5),   'approved', 'cat 5 → approved');

// ============================================================================
console.log('\nTest 7 — Partial coverage (some null scores excluded from sum)');
// ============================================================================
{
  const score = {
    version: 2,
    profile: 'preSeed',
    categories: {
      market: {
        market_size: { score: 1 },
        market_growth: { score: 1 },
        why_now: { score: 1 },
        demand_validation: { score: 1 },
        gross_margin: { score: 1 },
      },
      team: {
        ceo_vision: { score: 1 },
        talent_attraction: { score: 1 },
        founder_market_fit: { score: null },
        execution_record: { score: null },
        ethics_trust: { score: null },
      },
      product: {}, moat: {}, financial: {}, execution: {}, evidence: {},
    },
  };
  const r = computeComposite(score);
  eq(r.composite, 7, 'composite = 5 + 2 = 7');
  eq(r.rated, 7, '7 sub-criteria rated');
  eq(r.pending, 28, '28 pending');
  eq(r.categories.market.score, 5, 'market = 5');
  eq(r.categories.market.band, 'approved', 'market band = approved');
  eq(r.categories.team.score, 2, 'team = 2');
  eq(r.categories.team.band, 'rework', 'team partial-rated = rework (2 < 2.5)');
  eq(r.categories.team.pending, 3, 'team has 3 pending');
  eq(r.categories.product.band, 'unrated', 'product (no ratings) = unrated');
}

// ============================================================================
console.log('\nTest 8 — Deficiency heatmap ordering (lowest score + highest lift first)');
// ============================================================================
{
  const score = {
    version: 2,
    profile: 'seed',
    categories: {
      market: {
        market_size: { score: 0, note: 'no TAM yet', ref: 'research/market.md:12' },
        market_growth: { score: 0.5, note: 'one source only' },
        why_now: { score: 1 },
        demand_validation: { score: 1 },
        gross_margin: { score: 1 },
      },
      team: {
        ceo_vision: { score: 1 }, talent_attraction: { score: 1 },
        founder_market_fit: { score: 1 }, execution_record: { score: 1 },
        ethics_trust: { score: 1 },
      },
      product: {
        value_prop_clarity: { score: 1 }, improvement_10x: { score: 1 },
        moscow_discipline: { score: 1 }, persona_depth: { score: 1 },
        problem_validation: { score: 0, note: 'no qualitative validation', ref: 'research/users.md:4' },
      },
      moat: {
        differentiation: { score: 1 }, ip_defensibility: { score: 1 },
        switching_costs: { score: 1 }, scalability: { score: 1 },
        ecosystem_moats: { score: 1 },
      },
      financial: {
        files_complete: { score: 1 }, ltv_cac_ratio: { score: 1 },
        sensitivity_coverage: { score: 1 }, milestone_anchored_ask: { score: 1 },
        risk_honesty: { score: 1 },
      },
      execution: {
        live_surfaces: { score: 1 }, ia_coverage: { score: 1 },
        gate_velocity: { score: 1 }, payment_cadence: { score: 1 },
        traction_signals: { score: 1 },
      },
      evidence: {
        citation_density: { score: 1 }, source_count: { score: 1 },
        hallucination_check: { score: 1 }, methodology_disclosure: { score: 1 },
        cross_file_consistency: { score: 1 },
      },
    },
  };
  const r = computeComposite(score);
  // market 3.5 + team 5 + product 4 + moat 5 + financial 5 + execution 5 + evidence 5 = 32.5
  eq(r.composite, 32.5, 'composite = 32.5');
  eq(r.band, 'approved', 'band = approved (>= 28)');
  eq(r.deficiencies.length, 3, '3 deficiencies surfaced');
  eq(r.deficiencies[0].lift, 1, 'first deficiency has lift 1 (was 0)');
  eq(r.deficiencies[1].lift, 1, 'second deficiency has lift 1 (was 0)');
  eq(r.deficiencies[2].lift, 0.5, 'third deficiency has lift 0.5 (was 0.5)');
  eq(r.deficiencies[2].sub, 'market_growth', 'third deficiency is market_growth');
  assert(r.deficiencies.some((d) => d.ref === 'research/market.md:12'), 'evidence ref preserved through heatmap');
}

// ============================================================================
console.log('\nTest 9 — Deficiency heatmap capped at 5');
// ============================================================================
{
  const score = balanced(1);
  for (const sub of CATEGORIES.market) {
    score.categories.market[sub] = { score: 0, note: 'gap' };
  }
  score.categories.team.ceo_vision = { score: 0, note: 'gap' };
  score.categories.team.talent_attraction = { score: 0, note: 'gap' };
  const r = computeComposite(score);
  eq(r.deficiencies.length, 5, 'heatmap capped at 5 even when 7 zeros');
  for (const d of r.deficiencies) {
    eq(d.lift, 1, 'all top-5 have lift = 1 (zeros surface first)');
  }
}

// ============================================================================
console.log('\nTest 10 — Round to nearest 0.5');
// ============================================================================
{
  const score = {
    version: 2,
    profile: 'seed',
    categories: {
      market: {
        market_size: { score: 1 }, market_growth: { score: 1 },
        why_now: { score: 1 }, demand_validation: { score: 1 },
        gross_margin: { score: 0.5, note: 'sector unclear' },
      },
      team: {
        ceo_vision: { score: 1 }, talent_attraction: { score: 0.5, note: 'hire gap' },
        founder_market_fit: { score: 1 }, execution_record: { score: 0.5, note: 'limited' },
        ethics_trust: { score: 0.5, note: 'untested' },
      },
      product: {}, moat: {}, financial: {}, execution: {}, evidence: {},
    },
  };
  const r = computeComposite(score);
  eq(r.composite, 8, 'composite = 4.5 + 3.5 = 8');
  eq(r.categories.market.score, 4.5, 'market = 4.5');
  eq(r.categories.market.band, 'approved', 'market 4.5 → approved');
  eq(r.categories.team.score, 3.5, 'team = 3.5');
  eq(r.categories.team.band, 'feedback', 'team 3.5 → feedback');
}

// ============================================================================
console.log('\nTest 11 — Each category has exactly 5 sub-criteria slugs');
// ============================================================================
for (const cat of Object.keys(CATEGORIES)) {
  eq(CATEGORIES[cat].length, 5, `${cat} has 5 sub-criteria`);
}

// ============================================================================
console.log('\nTest 12 — Result is pure (same input → same output)');
// ============================================================================
{
  const s = balanced(0.5);
  const a = computeComposite(s);
  const b = computeComposite(s);
  eq(JSON.stringify(a), JSON.stringify(b), 'compute is deterministic');
}

// ============================================================================
console.log(`\n${passed} passed · ${failed} failed`);
// ============================================================================
if (failed > 0) {
  process.exit(1);
}
