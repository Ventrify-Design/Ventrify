// =============================================================================
// compute.js — Investability Scorecard math (v2 — TDK-style sum, pure)
// =============================================================================
// Replaces v1's weighted-geometric-mean + hard-cap with a straight sum across
// the 7 categories × 5 sub-criteria. Each sub-criterion is 0 / 0.5 / 1; each
// category sums to /5; the overall composite sums to /35. Matches TDK
// Ventures, GoingVC, and the VCII Balanced Scorecard convention.
//
// COLOR BANDS (per TDK convention, scaled to /35):
//   • Red    < 14    Material gaps · pre-readiness
//   • Yellow 14-27   Promising · named gaps to close before partner meeting
//   • Green  28-35   Strong · investor-ready
//
// Per-category banding (used for the category-row badges):
//   • Red    < 2
//   • Yellow 2.5-3.5
//   • Green  4+
// =============================================================================

'use strict';

const { CATEGORIES } = require('./validate');

// Human-readable category names + descriptions (the canonical questions live
// in reference_venture_sentiment_score.md). These drive the portal renderer
// — keep names short for the dimension-row layout.
const CATEGORY_META = {
  market: {
    name: 'Market Opportunity',
    description: 'Is the market large, growing, and timed right — with credible demand signals?',
  },
  team: {
    name: 'Team & Founder-Market Fit',
    description: 'Can this team attract talent, close deals, and out-execute under capital constraints?',
  },
  product: {
    name: 'Product & Solution Clarity',
    description: 'Is the value prop crisp, the problem real, and the MVP disciplined?',
  },
  moat: {
    name: 'Technical / Competitive Moat',
    description: 'What stops a fast-follower from winning the market in 18 months?',
  },
  financial: {
    name: 'Financial Defensibility',
    description: 'Do the numbers survive a partner spreadsheet, and is the ask milestone-anchored?',
  },
  execution: {
    name: 'Execution & Traction',
    description: 'What has the team actually shipped, and at what cadence?',
  },
  evidence: {
    name: 'Evidence Integrity',
    description: 'Does every material claim survive an LP fact-check?',
  },
};

// Sub-criterion canonical questions — used by the portal expander rows
// AND by the Coach when proposing deficiency fixes. Source of truth for the
// portal UI; the rubric memory doc has the full clause-by-clause guidance.
const SUB_CRITERIA_QUESTIONS = {
  market: {
    market_size: 'Is TAM >$1B with realistic penetration potential?',
    market_growth: 'Is the market growing strongly (CAGR >20% = 1pt, 10-20% = 0.5pt)?',
    why_now: 'Is there a credible Why Now — a named regulatory, technological, or cultural inflection?',
    demand_validation: 'Is customer demand validated via pilots, contracts, or willingness-to-pay signals?',
    gross_margin: 'Does the market enable attractive long-term gross margins (sector benchmark)?',
  },
  team: {
    ceo_vision: 'Does the CEO communicate a compelling vision and inspire confidence?',
    talent_attraction: 'Can the team attract, inspire, and retain high-caliber talent?',
    founder_market_fit: 'Do founders show strong founder–market fit (experience or insights uniquely positioning them)?',
    execution_record: 'Do founders show a strong execution record + bias to delivering results quickly?',
    ethics_trust: 'Do founders demonstrate ethics, transparency, and trustworthiness?',
  },
  product: {
    value_prop_clarity: 'Can a partner repeat the value prop in one sentence after one read?',
    improvement_10x: 'Is the product a 10x improvement on the existing workaround?',
    moscow_discipline: 'Is the MVP scoped tight (8–15 Must Haves) and justified against research?',
    persona_depth: 'Are 2–3 personas defined with substantive goals, frustrations, and fit?',
    problem_validation: 'Is the problem statement validated with qualitative + quantitative anchors?',
  },
  moat: {
    differentiation: 'Is the technical or strategic differentiation ahead of the current state of the art?',
    ip_defensibility: 'Is the moat defensible through IP, know-how, proprietary data, or trade secrets?',
    switching_costs: 'Are there meaningful switching costs or barriers that protect against displacement?',
    scalability: 'Can the product be scaled or manufactured cost-effectively at commercial demand?',
    ecosystem_moats: 'Can the company leverage ecosystem relationships or regulatory positioning?',
  },
  financial: {
    files_complete: 'Are all 11 canonical financial files present and internally consistent?',
    ltv_cac_ratio: 'Is the LTV/CAC ratio >3:1 with payback <12 months (or sector benchmarks)?',
    sensitivity_coverage: 'Is sensitivity analysis covered across ≥5 variables with best/base/worst cases?',
    milestone_anchored_ask: 'Is the funding ask sized to specific milestones that unlock the next round?',
    risk_honesty: 'Are risks named and mitigated (not buried), with downside scenarios documented?',
  },
  execution: {
    live_surfaces: 'Are there ≥4 live preview surfaces (marketing, DS, app, social, intelligence engine)?',
    ia_coverage: 'Is shipped-screen count ≥70% of the design/ia.json IA target?',
    gate_velocity: 'Is gate-closure velocity in line with Ventrify benchmark (mean Phase-to-Gate latency)?',
    payment_cadence: 'Are milestone payments captured and current with engagement progress?',
    traction_signals: 'Are there beta tester feedback, waitlist numbers, or early traction signals?',
  },
  evidence: {
    citation_density: 'Is the sourced-stat density ≥80% (% material claims with inline citations)?',
    source_count: 'Are there ≥15 distinct credible sources across the research markdown?',
    hallucination_check: 'Has the source-verifier agent passed with zero hallucinations and no impossible numbers?',
    methodology_disclosure: 'Are assumptions named and methodology ranges specified (not buried)?',
    cross_file_consistency: 'Do the numbers cross-check arithmetically across research, financial, and ask?',
  },
};

const TOTAL_SUB_CRITERIA = 35; // 7 categories × 5 sub-criteria

function computeComposite(score) {
  if (!score || !score.categories) {
    return emptyResult();
  }

  let totalRated = 0;
  let totalUnrated = 0;
  let totalScore = 0;
  const categoryResults = {};
  const allSubs = [];

  for (const cat of Object.keys(CATEGORIES)) {
    const catData = score.categories[cat] || {};
    const subs = CATEGORIES[cat];
    let catScore = 0;
    let catRated = 0;
    const subResults = {};
    for (const sub of subs) {
      const subData = catData[sub] || {};
      const s = subData.score;
      const isRated = s === 0 || s === 0.5 || s === 1;
      if (isRated) {
        catScore += s;
        catRated += 1;
        totalScore += s;
        totalRated += 1;
      } else {
        totalUnrated += 1;
      }
      const subResult = {
        score: isRated ? s : null,
        pending: !isRated,
        note: subData.note || null,
        ref: subData.ref || null,
        question: SUB_CRITERIA_QUESTIONS[cat]?.[sub] || sub,
        lift: isRated ? 1 - s : 1, // potential points gained if lifted to 1
      };
      subResults[sub] = subResult;
      allSubs.push({ cat, sub, ...subResult });
    }
    categoryResults[cat] = {
      name: CATEGORY_META[cat].name,
      description: CATEGORY_META[cat].description,
      score: round2(catScore),
      rated: catRated,
      pending: subs.length - catRated,
      band: catRated === 0 ? 'unrated' : catBand(catScore),
      subCriteria: subResults,
    };
  }

  // Composite total — sum across all rated sub-criteria
  const composite = round2(totalScore);
  const band = totalRated === 0 ? 'unrated' : overallBand(composite);

  // Deficiency heatmap — top deficiencies (lowest scored, highest lift potential)
  // sorted by (lift × 100) - (subIndex) so ties are broken consistently.
  const deficiencies = allSubs
    .filter((s) => !s.pending)
    .filter((s) => s.score < 1)
    .map((s) => ({
      category: s.cat,
      categoryName: CATEGORY_META[s.cat].name,
      sub: s.sub,
      question: s.question,
      score: s.score,
      lift: s.lift,
      note: s.note,
      ref: s.ref,
    }))
    .sort((a, b) => b.lift - a.lift || a.score - b.score)
    .slice(0, 5);

  return {
    composite,
    maxComposite: TOTAL_SUB_CRITERIA,
    band,
    bandLabel: overallBandLabel(band),
    rated: totalRated,
    pending: totalUnrated,
    categories: categoryResults,
    deficiencies,
  };
}

function emptyResult() {
  const emptyCats = {};
  for (const cat of Object.keys(CATEGORIES)) {
    emptyCats[cat] = {
      name: CATEGORY_META[cat].name,
      description: CATEGORY_META[cat].description,
      score: 0,
      rated: 0,
      pending: 5,
      band: 'unrated',
      subCriteria: {},
    };
  }
  return {
    composite: 0,
    maxComposite: TOTAL_SUB_CRITERIA,
    band: 'unrated',
    bandLabel: 'No rating yet',
    rated: 0,
    pending: TOTAL_SUB_CRITERIA,
    categories: emptyCats,
    deficiencies: [],
  };
}

// ── Bands ─────────────────────────────────────────────────────────────────
// Per-category bands: TDK convention scaled to /5.
//   • <2:    Red    (rework / pre-readiness)
//   • 2.5-3.5: Yellow (feedback / promising)
//   • 4+:    Green  (approved / strong)
function catBand(score) {
  if (score >= 4) return 'approved';
  if (score >= 2.5) return 'feedback';
  return 'rework';
}

// Overall composite bands — TDK convention scaled to /35.
// Calibrated so "all categories yellow" lands in yellow overall and "all
// categories green (4)" lands in green overall (4 × 7 = 28).
function overallBand(composite) {
  if (composite >= 28) return 'approved';
  if (composite >= 14) return 'feedback';
  return 'rework';
}

function overallBandLabel(band) {
  switch (band) {
    case 'approved': return 'Strong — investor-ready';
    case 'feedback': return 'Promising — named gaps to close before partner meeting';
    case 'rework':   return 'Material gaps — meaningful work before raising';
    case 'unrated':  return 'No rating yet';
    default:         return '';
  }
}

function round2(n) {
  return Math.round(n * 2) / 2; // round to nearest 0.5
}

module.exports = {
  computeComposite,
  CATEGORY_META,
  SUB_CRITERIA_QUESTIONS,
  TOTAL_SUB_CRITERIA,
  catBand,
  overallBand,
  overallBandLabel,
};
