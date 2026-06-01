// =============================================================================
// compute.test.js — Tests for the VSS composite math (zero-dep)
// =============================================================================
// Run with: node tools/sentiment/compute.test.js
// =============================================================================

'use strict';

const { computeComposite, DIMENSIONS } = require('./compute');

// Tiny test harness — no Jest, no dependency.
let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, message: e.message });
    console.log(`  ✗ ${name}`);
    console.log(`      ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

// ── Score-builder helper ───────────────────────────────────────────────────
const SEED_WEIGHTS = {
  marketStrength: 0.20,
  problemSolution: 0.15,
  financialDefensibility: 0.20,
  strategicResolution: 0.20,
  executionTangibility: 0.15,
  evidenceIntegrity: 0.10,
};

function score(dims, opts = {}) {
  const dimensions = {};
  for (const key of DIMENSIONS) {
    const value = dims[key];
    if (value === undefined) {
      dimensions[key] = { score: 75, rationale: null }; // default mid-strong
    } else if (value === null) {
      dimensions[key] = { score: null, rationale: null };
    } else if (typeof value === 'number') {
      dimensions[key] = { score: value, rationale: opts.rationale?.[key] || null };
    } else {
      dimensions[key] = value;
    }
  }
  return {
    version: 1,
    profile: 'seed',
    ratedBy: 'Test Operator',
    ratedAt: '2026-06-01T15:00:00Z',
    dimensions,
    weights: opts.weights || SEED_WEIGHTS,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

console.log('\nVSS composite math — test suite\n');

test('balanced 75/75/75/75/75/75 → composite 75', () => {
  const r = computeComposite(score({}));
  assert(r.composite === 75, `expected 75, got ${r.composite}`);
  assert(r.band === 'feedback', `expected band feedback, got ${r.band}`);
  assert(!r.hardCapTriggered, 'hard cap should not trigger on uniform 75');
});

test('balanced 85 across all → Strong band', () => {
  const r = computeComposite(score({
    marketStrength: 85, problemSolution: 85, financialDefensibility: 85,
    strategicResolution: 85, executionTangibility: 85, evidenceIntegrity: 85,
  }));
  assert(r.composite === 85, `expected 85, got ${r.composite}`);
  assert(r.band === 'approved', `expected approved, got ${r.band}`);
});

test('imbalanced 90/30 punishes via geometric mean', () => {
  // Half high, half low — geometric mean drags well below 60.
  const r = computeComposite(score({
    marketStrength: 90, problemSolution: 90, financialDefensibility: 30,
    strategicResolution: 90, executionTangibility: 90, evidenceIntegrity: 90,
  }));
  // Hard cap triggers because financialDefensibility < 40 → composite capped at 60.
  assert(r.hardCapTriggered, 'hard cap should trigger on financial < 40');
  assert(r.composite === 60, `expected 60 (capped), got ${r.composite}`);
});

test('imbalanced 90/45 (above hard-cap threshold) shows real geometric drag', () => {
  // financialDefensibility=45 stays above the hard-cap threshold of 40, so
  // we get to see what the geometric mean actually does to one outlier.
  const r = computeComposite(score({
    marketStrength: 90, problemSolution: 90, financialDefensibility: 45,
    strategicResolution: 90, executionTangibility: 90, evidenceIntegrity: 90,
  }));
  assert(!r.hardCapTriggered, 'hard cap should not trigger at 45');
  // Geometric mean of (90,90,45,90,90,90) with seed weights ≈ 76.
  assert(r.composite >= 70 && r.composite <= 80, `expected ~76, got ${r.composite}`);
});

test('floor at 25 — single 0 does not nuke the composite', () => {
  // Without the floor, score: 0 → log(0) = -Infinity → composite NaN.
  const r = computeComposite(score({
    marketStrength: 80, problemSolution: 80, financialDefensibility: 80,
    strategicResolution: 80, executionTangibility: 80, evidenceIntegrity: 0,
  }));
  // evidenceIntegrity=0 triggers the hard cap (< 40), so composite caps at 60.
  assert(r.hardCapTriggered, 'evidenceIntegrity=0 should trigger hard cap');
  assert(r.composite === 60, `expected capped at 60, got ${r.composite}`);
});

test('hard cap — evidence < 40 caps composite at 60', () => {
  const r = computeComposite(score({
    marketStrength: 95, problemSolution: 95, financialDefensibility: 95,
    strategicResolution: 95, executionTangibility: 95, evidenceIntegrity: 35,
  }));
  assert(r.hardCapTriggered, 'hard cap should trigger');
  assert(r.composite === 60, `expected 60, got ${r.composite}`);
  assert(r.hardCapReason.includes('Evidence Integrity'), `expected hardCapReason mention, got "${r.hardCapReason}"`);
});

test('hard cap — financial < 40 caps composite at 60', () => {
  const r = computeComposite(score({
    marketStrength: 95, problemSolution: 95, financialDefensibility: 30,
    strategicResolution: 95, executionTangibility: 95, evidenceIntegrity: 95,
  }));
  assert(r.hardCapTriggered, 'hard cap should trigger on financial');
  assert(r.composite === 60, `expected 60, got ${r.composite}`);
});

test('hard cap — strategic < 40 caps composite at 60', () => {
  const r = computeComposite(score({
    marketStrength: 95, problemSolution: 95, financialDefensibility: 95,
    strategicResolution: 25, executionTangibility: 95, evidenceIntegrity: 95,
  }));
  assert(r.hardCapTriggered, 'hard cap should trigger on strategic');
  assert(r.composite === 60, `expected 60, got ${r.composite}`);
});

test('non-foundational < 40 does NOT trigger hard cap', () => {
  // marketStrength is NOT in the foundational dimensions list, so a low
  // score here should not trigger the hard cap — only drag the composite.
  const r = computeComposite(score({
    marketStrength: 25, problemSolution: 95, financialDefensibility: 95,
    strategicResolution: 95, executionTangibility: 95, evidenceIntegrity: 95,
  }));
  assert(!r.hardCapTriggered, 'non-foundational low score should not trigger cap');
  // Composite should still drop significantly due to geometric mean.
  assert(r.composite < 80, `composite should drop below 80, got ${r.composite}`);
});

test('pending dimensions (null scores) excluded from composite', () => {
  // Financial + Execution pending — composite should reflect only the 4
  // rated dimensions, renormalised across them.
  const r = computeComposite(score({
    marketStrength: 80, problemSolution: 80,
    financialDefensibility: null,
    strategicResolution: 80,
    executionTangibility: null,
    evidenceIntegrity: 80,
  }));
  assert(r.composite === 80, `pending dims should not drag composite; got ${r.composite}`);
  assert(r.pendingCount === 2, `expected pendingCount=2, got ${r.pendingCount}`);
  assert(r.ratedCount === 4, `expected ratedCount=4, got ${r.ratedCount}`);
});

test('all pending → composite null + unrated band', () => {
  const r = computeComposite(score({
    marketStrength: null, problemSolution: null, financialDefensibility: null,
    strategicResolution: null, executionTangibility: null, evidenceIntegrity: null,
  }));
  assert(r.composite === null, `expected null composite, got ${r.composite}`);
  assert(r.band === 'unrated', `expected unrated band, got ${r.band}`);
  assert(r.ratedCount === 0, `expected ratedCount=0, got ${r.ratedCount}`);
});

test('rationale-required flag fires when score < 50 + rationale missing', () => {
  const r = computeComposite(score({
    marketStrength: 80, problemSolution: 80, financialDefensibility: 80,
    strategicResolution: 80, executionTangibility: 45, evidenceIntegrity: 80,
  }));
  // executionTangibility is below 50 — rationale should be flagged.
  assert(r.rationaleRequired.includes('executionTangibility'),
    `expected executionTangibility in rationaleRequired, got ${r.rationaleRequired}`);
});

test('rationale-required NOT flagged when rationale is provided', () => {
  const s = score(
    { marketStrength: 80, problemSolution: 80, financialDefensibility: 80,
      strategicResolution: 80, executionTangibility: 45, evidenceIntegrity: 80 },
    { rationale: { executionTangibility: 'Only 60% of IA screens shipped; v1.1 closes the gap.' } },
  );
  const r = computeComposite(s);
  assert(!r.rationaleRequired.includes('executionTangibility'),
    `expected executionTangibility NOT flagged when rationale present, got ${r.rationaleRequired}`);
});

test('per-dimension contributions populated with lift values', () => {
  const r = computeComposite(score({
    marketStrength: 80, problemSolution: 80, financialDefensibility: 60,
    strategicResolution: 80, executionTangibility: 80, evidenceIntegrity: 80,
  }));
  assert(r.contributions.marketStrength.score === 80);
  assert(r.contributions.financialDefensibility.lift === 0.2 * (100 - 60), 'lift calc');
  assert(!r.contributions.financialDefensibility.pending);
});

test('pending contributions tagged with pending: true', () => {
  const r = computeComposite(score({
    marketStrength: 80, problemSolution: 80,
    financialDefensibility: null,
    strategicResolution: 80, executionTangibility: 80, evidenceIntegrity: 80,
  }));
  assert(r.contributions.financialDefensibility.pending === true);
  assert(r.contributions.financialDefensibility.score === null);
});

test('band thresholds — 49 across the board = Pre-readiness, no hard cap', () => {
  const r = computeComposite(score({
    marketStrength: 49, problemSolution: 49, financialDefensibility: 49,
    strategicResolution: 49, executionTangibility: 49, evidenceIntegrity: 49,
  }));
  assert(!r.hardCapTriggered, '49 is above the 40 hard-cap threshold, no cap should fire');
  assert(r.composite === 49, `expected composite 49, got ${r.composite}`);
  assert(r.band === 'rework', `expected rework band at sub-50, got ${r.band}`);
  assert(r.bandLabel.includes('Pre-readiness'), `expected Pre-readiness label, got "${r.bandLabel}"`);
});

test('band thresholds — 80 = Strong (lower bound)', () => {
  const r = computeComposite(score({
    marketStrength: 80, problemSolution: 80, financialDefensibility: 80,
    strategicResolution: 80, executionTangibility: 80, evidenceIntegrity: 80,
  }));
  assert(r.composite === 80);
  assert(r.band === 'approved', `expected Strong band at 80, got ${r.band}`);
});

test('band thresholds — 65 = Promising (lower bound)', () => {
  const r = computeComposite(score({
    marketStrength: 65, problemSolution: 65, financialDefensibility: 65,
    strategicResolution: 65, executionTangibility: 65, evidenceIntegrity: 65,
  }));
  assert(r.composite === 65);
  assert(r.band === 'feedback', `expected Promising band at 65, got ${r.band}`);
});

test('empty/null input → unrated state, no crash', () => {
  const r1 = computeComposite(null);
  assert(r1.composite === null && r1.band === 'unrated');
  const r2 = computeComposite({});
  assert(r2.composite === null && r2.band === 'unrated');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed · ${fail} failed\n`);
if (fail > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.message}`);
  process.exit(1);
} else {
  process.exit(0);
}
