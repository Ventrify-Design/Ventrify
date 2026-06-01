// =============================================================================
// validate.js — Venture Sentiment Score schema validator (zero-dep Node)
// =============================================================================
// Validates `/sentiment/score.md` YAML frontmatter against the JSON schema in
// tools/sentiment/score-schema.json + the rubric-specific business rules that
// JSON Schema can't express:
//
//   • all 6 dimensions must be present (keys exist, even if score is null)
//   • each non-null score is an integer in [0, 100]
//   • a rationale is REQUIRED when a non-null score is < 50 (IC-memo discipline)
//   • weights sum to 1.0 ± 0.01
//   • profile is one of preSeed | seed | seriesA
//   • ratedBy is a non-empty string; ratedAt is parseable ISO 8601
//
// Returns { valid: boolean, errors: string[], warnings: string[] }.
// Warnings (non-fatal) are emitted for things like missing rationale on
// scores in 50–69, weights deviating from the stage default by >0.05, etc.
//
// Used by:
//   • api/sentiment-rate.js (server-side validation before committing score.md)
//   • tools/sentiment CLI (operator-side pre-commit check)
//   • optional pre-commit hook in engagement repos
// =============================================================================

'use strict';

const DIMENSIONS = [
  'marketStrength',
  'problemSolution',
  'financialDefensibility',
  'strategicResolution',
  'executionTangibility',
  'evidenceIntegrity',
];

const VALID_PROFILES = ['preSeed', 'seed', 'seriesA'];

// Profile-default weights — used only for the "weights drift from default by
// >0.05" warning. The composite calculator (compute.js) uses the actual
// weights from score.md, not these defaults — the operator can override at
// will. These exist so we can flag silently-divergent score files.
const PROFILE_DEFAULTS = {
  preSeed: {
    marketStrength: 0.20,
    problemSolution: 0.15,
    financialDefensibility: 0.20,
    strategicResolution: 0.20,
    executionTangibility: 0.15,
    evidenceIntegrity: 0.10,
  },
  seed: {
    marketStrength: 0.20,
    problemSolution: 0.15,
    financialDefensibility: 0.20,
    strategicResolution: 0.20,
    executionTangibility: 0.15,
    evidenceIntegrity: 0.10,
  },
  seriesA: {
    marketStrength: 0.15,
    problemSolution: 0.10,
    financialDefensibility: 0.25,
    strategicResolution: 0.15,
    executionTangibility: 0.25,
    evidenceIntegrity: 0.10,
  },
};

/**
 * Validate a parsed score object (the YAML frontmatter, not the raw markdown).
 * @param {object} score - The parsed score.md frontmatter.
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validate(score) {
  const errors = [];
  const warnings = [];

  if (!score || typeof score !== 'object') {
    return { valid: false, errors: ['score.md frontmatter is empty or not an object'], warnings: [] };
  }

  // ── Top-level required fields ─────────────────────────────────────────────
  if (typeof score.version !== 'number' || !Number.isInteger(score.version) || score.version < 1) {
    errors.push('version: must be a positive integer (current schema: 1)');
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
      // Tolerate up to 24h clock skew but flag obviously-future dates.
      errors.push(`ratedAt: "${score.ratedAt}" is in the future`);
    }
  }
  if (!VALID_PROFILES.includes(score.profile)) {
    errors.push(`profile: must be one of ${VALID_PROFILES.join(', ')} (got "${score.profile}")`);
  }

  // ── Dimensions ────────────────────────────────────────────────────────────
  if (!score.dimensions || typeof score.dimensions !== 'object') {
    errors.push('dimensions: must be an object containing all 6 dimensions');
  } else {
    const present = Object.keys(score.dimensions);
    const missing = DIMENSIONS.filter((d) => !present.includes(d));
    const extra = present.filter((d) => !DIMENSIONS.includes(d));
    if (missing.length) {
      errors.push(`dimensions: missing keys — ${missing.join(', ')}`);
    }
    if (extra.length) {
      errors.push(`dimensions: unknown keys — ${extra.join(', ')}`);
    }
    for (const dim of DIMENSIONS) {
      const v = score.dimensions[dim];
      if (!v || typeof v !== 'object') {
        if (present.includes(dim)) {
          errors.push(`dimensions.${dim}: must be an object with a score field`);
        }
        continue; // missing already counted above
      }
      // score — null is allowed (pending), otherwise integer 0-100
      if (v.score === null || v.score === undefined) {
        // pending — no validation needed but warn if rationale provided
        if (v.rationale) {
          warnings.push(`dimensions.${dim}: rationale provided without a score — will not surface in the portal`);
        }
      } else if (typeof v.score !== 'number' || !Number.isInteger(v.score) || v.score < 0 || v.score > 100) {
        errors.push(`dimensions.${dim}.score: must be an integer 0-100 or null (got ${JSON.stringify(v.score)})`);
      } else {
        // Rationale rules (IC-memo discipline)
        const hasRationale = typeof v.rationale === 'string' && v.rationale.trim().length > 0;
        if (v.score < 50 && !hasRationale) {
          errors.push(`dimensions.${dim}.rationale: REQUIRED when score < 50 (current score: ${v.score})`);
        } else if (v.score < 70 && !hasRationale) {
          warnings.push(`dimensions.${dim}.rationale: strongly recommended when score < 70 (current score: ${v.score})`);
        }
      }
    }
  }

  // ── Weights ───────────────────────────────────────────────────────────────
  if (!score.weights || typeof score.weights !== 'object') {
    errors.push('weights: must be an object containing all 6 dimension weights');
  } else {
    let sum = 0;
    for (const dim of DIMENSIONS) {
      const w = score.weights[dim];
      if (typeof w !== 'number' || w < 0 || w > 1) {
        errors.push(`weights.${dim}: must be a number in [0, 1] (got ${JSON.stringify(w)})`);
      } else {
        sum += w;
      }
    }
    // Sum must be within 0.01 of 1.0 (floating-point tolerance + small rounding).
    if (Math.abs(sum - 1) > 0.01) {
      errors.push(`weights: must sum to 1.0 ± 0.01 (current sum: ${sum.toFixed(4)})`);
    }
    // Drift warning — compare to profile defaults
    if (VALID_PROFILES.includes(score.profile)) {
      const defaults = PROFILE_DEFAULTS[score.profile];
      for (const dim of DIMENSIONS) {
        const w = score.weights[dim];
        const def = defaults[dim];
        if (typeof w === 'number' && Math.abs(w - def) > 0.05) {
          warnings.push(
            `weights.${dim}: deviates from ${score.profile} default by ${(w - def).toFixed(2)} — ` +
            `intentional override or stale config?`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { validate, DIMENSIONS, VALID_PROFILES, PROFILE_DEFAULTS };
