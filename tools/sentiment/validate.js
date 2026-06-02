// =============================================================================
// validate.js — Venture Sentiment Scorecard (v2) validator (zero-dep Node)
// =============================================================================
// Validates `/sentiment/score.md` YAML frontmatter against the TDK-style
// 7-category × 5-sub-criteria scorecard. Each sub-criterion must be one of
// {0, 0.5, 1, null}. Notes are mandatory when score < 1 (IC-memo discipline).
//
// Returns { valid: boolean, errors: string[], warnings: string[] }.
// =============================================================================

'use strict';

// ── The 7 categories × 5 sub-criteria ──────────────────────────────────────
// Canonical sub-criterion slugs per category. Add a slug here AND in the
// reference rubric memory doc when extending — the two must stay in sync.
const CATEGORIES = {
  market: ['market_size', 'market_growth', 'why_now', 'demand_validation', 'gross_margin'],
  team: ['ceo_vision', 'talent_attraction', 'founder_market_fit', 'execution_record', 'ethics_trust'],
  product: ['value_prop_clarity', 'improvement_10x', 'moscow_discipline', 'persona_depth', 'problem_validation'],
  moat: ['differentiation', 'ip_defensibility', 'switching_costs', 'scalability', 'ecosystem_moats'],
  financial: ['files_complete', 'ltv_cac_ratio', 'sensitivity_coverage', 'milestone_anchored_ask', 'risk_honesty'],
  execution: ['live_surfaces', 'ia_coverage', 'gate_velocity', 'payment_cadence', 'traction_signals'],
  evidence: ['citation_density', 'source_count', 'hallucination_check', 'methodology_disclosure', 'cross_file_consistency'],
};

const VALID_PROFILES = ['preSeed', 'seed', 'seriesA'];
const VALID_SCORES = [0, 0.5, 1];

function validate(score) {
  const errors = [];
  const warnings = [];

  if (!score || typeof score !== 'object') {
    return { valid: false, errors: ['score.md frontmatter is empty or not an object'], warnings: [] };
  }

  // Top-level
  if (score.version !== 2) {
    errors.push(`version: must be 2 for the v2 7×5 scorecard (got ${JSON.stringify(score.version)})`);
  }
  if (!VALID_PROFILES.includes(score.profile)) {
    errors.push(`profile: must be one of ${VALID_PROFILES.join(', ')} (got "${score.profile}")`);
  }
  if (typeof score.ratedBy !== 'string' || score.ratedBy.trim().length < 2) {
    errors.push('ratedBy: must be a non-empty string identifying the operator');
  }
  if (typeof score.ratedAt !== 'string') {
    errors.push('ratedAt: must be an ISO 8601 datetime string');
  } else {
    const d = new Date(score.ratedAt);
    if (Number.isNaN(d.getTime())) {
      errors.push(`ratedAt: "${score.ratedAt}" is not a parseable date`);
    } else if (d.getTime() > Date.now() + 86_400_000) {
      errors.push(`ratedAt: "${score.ratedAt}" is in the future`);
    }
  }

  // Categories
  if (!score.categories || typeof score.categories !== 'object') {
    errors.push('categories: must be an object with all 7 categories');
    return { valid: errors.length === 0, errors, warnings };
  }

  const expectedCats = Object.keys(CATEGORIES);
  const presentCats = Object.keys(score.categories);
  const missingCats = expectedCats.filter((c) => !presentCats.includes(c));
  const extraCats = presentCats.filter((c) => !expectedCats.includes(c));
  if (missingCats.length) {
    errors.push(`categories: missing keys — ${missingCats.join(', ')}`);
  }
  if (extraCats.length) {
    errors.push(`categories: unknown keys — ${extraCats.join(', ')}`);
  }

  for (const cat of expectedCats) {
    const catData = score.categories[cat];
    if (!catData || typeof catData !== 'object') continue;
    const expectedSubs = CATEGORIES[cat];
    const presentSubs = Object.keys(catData);
    const missingSubs = expectedSubs.filter((s) => !presentSubs.includes(s));
    const extraSubs = presentSubs.filter((s) => !expectedSubs.includes(s));
    if (missingSubs.length) {
      errors.push(`categories.${cat}: missing sub-criteria — ${missingSubs.join(', ')}`);
    }
    if (extraSubs.length) {
      errors.push(`categories.${cat}: unknown sub-criteria — ${extraSubs.join(', ')}`);
    }
    for (const sub of expectedSubs) {
      const subData = catData[sub];
      if (!subData || typeof subData !== 'object') {
        if (presentSubs.includes(sub)) {
          errors.push(`categories.${cat}.${sub}: must be an object with a score`);
        }
        continue;
      }
      const { score: s, note, ref } = subData;
      // Score must be 0, 0.5, 1, or null
      if (s !== null && s !== undefined && !VALID_SCORES.includes(s)) {
        errors.push(`categories.${cat}.${sub}.score: must be one of 0, 0.5, 1, or null (got ${JSON.stringify(s)})`);
      }
      const isRated = s === 0 || s === 0.5 || s === 1;
      const hasNote = typeof note === 'string' && note.trim().length > 0;
      // Notes mandatory when score < 1
      if (isRated && s < 1 && !hasNote) {
        errors.push(`categories.${cat}.${sub}.note: REQUIRED when score < 1 (current score: ${s})`);
      }
      // Warn if rated but no ref
      if (isRated && (typeof ref !== 'string' || ref.trim().length === 0)) {
        warnings.push(`categories.${cat}.${sub}.ref: evidence citation missing — flagged in diligence heatmap`);
      }
      // Ref shape check
      if (typeof ref === 'string' && ref.trim().length > 0 && !/^[a-zA-Z0-9_\-./]+(:\d+)?$/.test(ref)) {
        errors.push(`categories.${cat}.${sub}.ref: "${ref}" — expected "path/to/file.md" or "path/to/file.md:line"`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { validate, CATEGORIES, VALID_PROFILES, VALID_SCORES };
