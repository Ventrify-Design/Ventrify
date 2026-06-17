// ============================================================
// Ventrify OS — VSS 7×5 rubric (SHARED · single source of truth, web side)
//
// The canonical category→sub-criteria grouping + WEIGHTS, mirrored EXACTLY from
// the runner's tools/sentiment/compute.js RUBRIC (which encodes the PROTECTED
// reference_venture_sentiment_score.md). Kept here so the web can seed a
// "forming" scaffold the moment a brief lands — making the investability score
// a living artifact from day one — and so that seed has the identical shape a
// later run publishes (the run's real scores slot straight into these slots).
//
// v3: the composite is a WEIGHTED 0–100 score (weighted mean of per-category
// fractions), not a /35 sum. `maxPossible` is the score scale (100); the number
// of SIGNALS (sub-criteria) is a separate count (TOTAL_SIGNALS = 35).
//
// ⚠️ If the runner's RUBRIC or WEIGHTS change, mirror them here (and vice-versa).
// The two live in separate repos; this is the documented sync point.
// ============================================================

export const VSS_RUBRIC = [
  { key: 'market',    label: 'Market Opportunity',           weight: 0.20, subs: ['market_size', 'market_growth', 'why_now', 'demand_validation', 'gross_margin'] },
  { key: 'team',      label: 'Team & Founder-Market Fit',    weight: 0.25, subs: ['ceo_vision', 'talent_attraction', 'founder_market_fit', 'execution_record', 'ethics_trust'] },
  { key: 'product',   label: 'Product & Solution Clarity',   weight: 0.15, subs: ['value_prop_clarity', 'improvement_10x', 'moscow_discipline', 'persona_depth', 'problem_validation'] },
  { key: 'moat',      label: 'Technical / Competitive Moat',  weight: 0.15, subs: ['differentiation', 'ip_defensibility', 'switching_costs', 'scalability', 'ecosystem_moats'] },
  { key: 'financial', label: 'Financial Defensibility',      weight: 0.10, subs: ['files_complete', 'ltv_cac_ratio', 'sensitivity_coverage', 'milestone_anchored_ask', 'risk_honesty'] },
  { key: 'execution', label: 'Execution & Traction',         weight: 0.10, subs: ['live_surfaces', 'ia_coverage', 'gate_velocity', 'payment_cadence', 'traction_signals'] },
  { key: 'evidence',  label: 'Evidence Integrity',           weight: 0.05, subs: ['citation_density', 'source_count', 'hallucination_check', 'methodology_disclosure', 'cross_file_consistency'] },
];

export const MAX_POSSIBLE = 100;   // the composite is a weighted 0–100 score
export const TOTAL_SIGNALS = 35;   // 7 categories × 5 sub-criteria — the count, not the scale

// The "forming" snapshot — every one of the 35 signals present but unrated, so
// both surfaces render the full living scaffold ("0 / 100 · forming") the instant
// the brief lands. Matches the runner's published snapshot shape exactly. The
// caller stamps computedAt (serverTimestamp on the web).
export function buildFormingSnapshot() {
  return {
    status: 'forming',
    composite: 0,
    maxPossible: MAX_POSSIBLE,
    pct: 0,
    band: 'forming',
    bandLabel: 'Forming — grows as your venture builds',
    ratedCount: 0,
    pendingCount: TOTAL_SIGNALS,
    categories: VSS_RUBRIC.map(cat => ({
      key: cat.key, label: cat.label, weight: cat.weight, sum: 0, max: 5, rated: 0, pending: cat.subs.length,
      band: 'unrated',
      subs: cat.subs.map(slug => ({ slug, score: null, note: '' })),
    })),
  };
}

// The compact denormalised summary written onto the engagement doc, so the
// Workspace dashboard list + program header can show a score badge without
// fetching the snapshots subcollection per engagement. Runs update this too.
export function snapshotSummary(snap) {
  if (!snap) return null;
  return {
    composite: snap.composite || 0,
    maxPossible: snap.maxPossible || MAX_POSSIBLE,
    pct: snap.pct != null ? snap.pct : Math.round(((snap.composite || 0) / (snap.maxPossible || MAX_POSSIBLE)) * 100),
    ratedCount: snap.ratedCount || 0,
    pendingCount: snap.pendingCount != null ? snap.pendingCount : TOTAL_SIGNALS,
    band: snap.band || 'forming',
    status: snap.status || 'scored',
  };
}
