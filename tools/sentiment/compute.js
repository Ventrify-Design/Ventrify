// =============================================================================
// compute.js — Venture Sentiment Score composite math (pure, deterministic)
// =============================================================================
// Pure function — no I/O, no global state, no time dependency. Given a
// validated score object (per tools/sentiment/score-schema.json), returns
// the composite VSS, the per-dimension contributions, the band, the hard-cap
// trigger if any, and the rationale-required flags.
//
// METHODOLOGY (per the workflow design proposal):
//   1. Each non-null score is FLOORED at 25. A single weak dimension must
//      drag the composite but cannot nuke it (a 0 would zero the geometric
//      mean entirely).
//   2. Composite = WEIGHTED GEOMETRIC MEAN across rated dimensions. Geometric
//      mean punishes imbalance — a 90/30 venture scores ~52, not ~65 — which
//      is closer to how partner meetings actually kill deals.
//   3. HARD CAP at 60 if any of Evidence Integrity / Financial Defensibility
//      / Strategic Resolution is < 40. These are the foundational dimensions
//      where a partner will kill the deal regardless of aggregate.
//   4. Per-dimension RATIONALE-REQUIRED flag when score < 50 (validator
//      enforces this on score.md commit; compute.js surfaces it on the
//      portal so the operator can see at-a-glance which rationales are
//      blocking sign-off).
//   5. Pending dimensions (score: null) are EXCLUDED from the composite —
//      weights are renormalised across the rated dimensions. The portal
//      surfaces a "pending: <count>" indicator so the score isn't read as
//      complete when half the dimensions are unrated.
//
// BANDS:
//   80-100 → "Strong"            (green: --status-approved)
//   65-79  → "Promising"          (amber: --status-feedback)
//   50-64  → "Material gaps"     (red:   --status-rework)
//   0-49   → "Pre-readiness"     (red:   --status-rework)
//   capped → "Material gaps — foundational dimension <40" (regardless of underlying number)
// =============================================================================

'use strict';

const FLOOR = 25;                                  // per-dimension floor
const HARD_CAP_THRESHOLD = 40;                     // foundational-dim trigger
const HARD_CAP_VALUE = 60;                         // composite cap when triggered
const RATIONALE_REQUIRED_THRESHOLD = 50;           // mandate operator rationale
const FOUNDATIONAL = ['evidenceIntegrity', 'financialDefensibility', 'strategicResolution'];
const DIMENSIONS = [
  'marketStrength',
  'problemSolution',
  'financialDefensibility',
  'strategicResolution',
  'executionTangibility',
  'evidenceIntegrity',
];

function computeComposite(score) {
  if (!score || !score.dimensions || !score.weights) {
    return {
      composite: null,
      band: 'unrated',
      bandLabel: 'No rating yet',
      hardCapTriggered: false,
      hardCapReason: null,
      pendingCount: DIMENSIONS.length,
      ratedCount: 0,
      contributions: {},
      rationaleRequired: [],
    };
  }

  // ── Separate rated vs pending dimensions ────────────────────────────────
  const rated = [];   // { key, rawScore, flooredScore, weight }
  const pending = [];

  for (const key of DIMENSIONS) {
    const dim = score.dimensions[key];
    const weight = score.weights[key];
    if (!dim || dim.score === null || dim.score === undefined) {
      pending.push(key);
    } else {
      const flooredScore = Math.max(FLOOR, dim.score);
      rated.push({ key, rawScore: dim.score, flooredScore, weight });
    }
  }

  if (rated.length === 0) {
    // Every dimension pending — render an unrated state, not zero.
    return {
      composite: null,
      band: 'unrated',
      bandLabel: 'Not yet rated',
      hardCapTriggered: false,
      hardCapReason: null,
      pendingCount: pending.length,
      ratedCount: 0,
      pendingDimensions: pending,
      contributions: {},
      rationaleRequired: [],
    };
  }

  // ── Renormalise weights across the rated dimensions ──────────────────────
  // Pending dimensions effectively don't exist for this rating; the rated
  // ones absorb the pending weight pro-rata. This is the standard fix for
  // partial-coverage indices.
  const weightSum = rated.reduce((s, r) => s + r.weight, 0);
  for (const r of rated) {
    r.normalisedWeight = r.weight / weightSum;
  }

  // ── Weighted geometric mean ─────────────────────────────────────────────
  //   composite = (s1^w1 * s2^w2 * ... * sN^wN)
  // Implemented in log-space for numerical stability and to support partial
  // coverage cleanly.
  let logSum = 0;
  for (const r of rated) {
    logSum += r.normalisedWeight * Math.log(r.flooredScore);
  }
  let composite = Math.exp(logSum);

  // ── Hard-cap trigger ────────────────────────────────────────────────────
  // If any foundational dimension is rated and < HARD_CAP_THRESHOLD, cap the
  // composite at HARD_CAP_VALUE. This is the Goodhart firebreak — the
  // headline number cannot launder a foundational weakness behind aggregation.
  let hardCapTriggered = false;
  let hardCapReason = null;
  const triggers = [];
  for (const r of rated) {
    if (FOUNDATIONAL.includes(r.key) && r.rawScore < HARD_CAP_THRESHOLD) {
      triggers.push({ key: r.key, score: r.rawScore });
    }
  }
  if (triggers.length > 0 && composite > HARD_CAP_VALUE) {
    hardCapTriggered = true;
    hardCapReason = triggers
      .map((t) => `${humanDimensionName(t.key)} ${t.score} (< ${HARD_CAP_THRESHOLD})`)
      .join(' · ');
    composite = HARD_CAP_VALUE;
  }

  // Round to integer for the headline display.
  composite = Math.round(composite);

  // ── Band assignment ─────────────────────────────────────────────────────
  let band, bandLabel;
  if (hardCapTriggered) {
    band = 'rework';
    bandLabel = 'Material gaps — foundational dimension below 40';
  } else if (composite >= 80) {
    band = 'approved';
    bandLabel = 'Strong — investor-ready';
  } else if (composite >= 65) {
    band = 'feedback';
    bandLabel = 'Promising — named gaps to close before partner meeting';
  } else if (composite >= 50) {
    band = 'rework';
    bandLabel = 'Material gaps — meaningful work before raising';
  } else {
    band = 'rework';
    bandLabel = 'Pre-readiness — focus on the work, not the raise';
  }

  // ── Per-dimension contributions (for the breakdown bars) ────────────────
  // Contribution = how many points of the composite this dimension is
  // responsible for. Approximated by the dimension's weighted log share.
  // Used by the portal to colour each bar's "next move" pill.
  const contributions = {};
  for (const r of rated) {
    contributions[r.key] = {
      score: r.rawScore,
      flooredScore: r.flooredScore,
      weight: r.weight,
      normalisedWeight: r.normalisedWeight,
      // "next move" hint — the bigger this number, the more this dim is
      // dragging the composite below its potential.
      lift: r.weight * (100 - r.rawScore),
    };
  }
  for (const key of pending) {
    contributions[key] = {
      score: null,
      pending: true,
      weight: score.weights[key],
    };
  }

  // ── Rationale-required flags ────────────────────────────────────────────
  const rationaleRequired = [];
  for (const r of rated) {
    if (r.rawScore < RATIONALE_REQUIRED_THRESHOLD) {
      const dim = score.dimensions[r.key];
      const hasRationale = dim.rationale && dim.rationale.trim().length > 0;
      if (!hasRationale) {
        rationaleRequired.push(r.key);
      }
    }
  }

  return {
    composite,
    band,
    bandLabel,
    hardCapTriggered,
    hardCapReason,
    pendingCount: pending.length,
    ratedCount: rated.length,
    pendingDimensions: pending,
    contributions,
    rationaleRequired,
  };
}

function humanDimensionName(key) {
  const map = {
    marketStrength: 'Market Strength',
    problemSolution: 'Problem & Solution',
    financialDefensibility: 'Financial Defensibility',
    strategicResolution: 'Strategic Resolution',
    executionTangibility: 'Execution & Tangibility',
    evidenceIntegrity: 'Evidence Integrity',
  };
  return map[key] || key;
}

module.exports = {
  computeComposite,
  humanDimensionName,
  // Exported constants so tests + other consumers can reference them.
  FLOOR,
  HARD_CAP_THRESHOLD,
  HARD_CAP_VALUE,
  RATIONALE_REQUIRED_THRESHOLD,
  FOUNDATIONAL,
  DIMENSIONS,
};
