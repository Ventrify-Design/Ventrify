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

// ── HOW MUCH OF THIS SCORE RESTED ON A COIN-FLIP ──────────────────────────────────────────────────────
//
// Each signal is scored by three blind draws and the MEDIAN is published. When the draws agree, the number
// is solid. When they split 2–1, the published value is a single vote away from its opposite — and it looks
// exactly as confident on the page as a unanimous one. KreditMate scored 47 and then 39 on the same deck
// because four such votes fell the other way the second time.
//
// WHY NOT JUST COUNT THE SPLITS. ORE split on six signals too and moved ONE point between runs, because its
// splits landed in light categories and did not cluster. KreditMate's landed in Team (weight .25) and
// Product (.15), moved together and moved down. So what matters is not how many signals wobbled but HOW
// MUCH OF THE WEIGHTED COMPOSITE is resting on them.
//
// The threshold is set from observed behaviour, not taste. Measured across every scored venture:
//     KreditMate 3   1 doc    20.0%   ← moved 8 points between runs
//     KreditMate 4   1 doc    15.0%   ← moved 8 points between runs
//     0X Labs        2 docs   15.0%
//     ORE           37 docs    9.0%   ← moved 1 point
//     Holoclara      3 docs    9.0%
//     MoneyGym      56 docs    8.0%   ← moved 1 point
//     MoneyGym S1   58 docs    0.0%
// 12% separates every venture we have measured as unstable from every one measured as stable. It is a
// threshold drawn through seven data points, so it should move if the data does — but it must never become
// a caveat printed on everything, because a warning that always fires is read as decoration and ignored.
export const WOBBLE_THRESHOLD = 0.12;

const CAT_WEIGHT = Object.fromEntries(VSS_RUBRIC.map(c => [c.key, c.weight]));

/**
 * @param {object} snap a published investability snapshot (needs snap.consensus.splits)
 * @returns {{measurable:boolean, exposure:number, oneVote:string[], byCategory:object, flagged:boolean}}
 *   measurable=false when the snapshot predates consensus being recorded — ABSENT IS NOT STABLE, and the
 *   caller must not read a missing record as a clean bill of health.
 */
export function scoreWobble(snap) {
  const c = snap && snap.consensus;
  if (!c || !Array.isArray(c.splits)) return { measurable: false, exposure: 0, oneVote: [], byCategory: {}, flagged: false };

  const oneVote = [];
  const byCategory = {};
  for (const entry of c.splits) {
    const text = String(entry || '');
    const id = text.split(' ')[0];
    const m = text.match(/\[([^\]]+)\]/);
    if (!id || !m) continue;
    const votes = m[1].split(',').map(t => t.trim()).filter(Boolean);
    const tally = {};
    votes.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
    // Decided by ONE vote: the winning value had exactly one more than everything else put together,
    // i.e. a single draw changing its mind would change the published score.
    if (Math.max(...Object.values(tally)) !== votes.length - 1) continue;
    oneVote.push(id);
    const cat = id.split('.')[0];
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  const perCat = VSS_RUBRIC.length ? (VSS_RUBRIC[0].subs || []).length || 5 : 5;
  const exposure = Object.entries(byCategory)
    .reduce((a, [k, n]) => a + (CAT_WEIGHT[k] || 0) * (n / perCat), 0);

  return { measurable: true, exposure, oneVote, byCategory, flagged: exposure >= WOBBLE_THRESHOLD };
}

/**
 * One short paragraph for the verdict, or '' when the score is solid enough that saying anything is noise.
 *
 * NAMES THE CAUSE AND THE REMEDY, because "treat this as indicative" on its own leaves the reader with a
 * worse number and nothing to do about it. The cause is stated from the engagement's ACTUAL document count
 * rather than asserted — every venture that has flagged so far had one or two documents, and every one
 * with three or more has stayed quiet, but the sentence should be true of the venture in front of you and
 * not of the average.
 *
 * @param {object} snap   the published snapshot
 * @param {number} docN   documents in the room (0/undefined = unknown, and the cause is then left unstated)
 */
export function wobbleNote(snap, docN) {
  const w = scoreWobble(snap);
  if (!w.flagged) return '';
  const n = w.oneVote.length;
  const cats = Object.entries(w.byCategory).sort((a, b) => b[1] - a[1])
    .map(([k]) => (VSS_RUBRIC.find(c => c.key === k) || {}).label || k);
  const docs = Number(docN) || 0;
  const cause = docs
    ? `There ${docs === 1 ? 'is 1 document' : `are ${docs} documents`} in the data room, and these signals need evidence `
      + `${docs === 1 ? 'a deck does not carry' : 'the room does not carry'} — so each read reaches a different conclusion.`
    : 'These signals need evidence the data room does not carry, so each read reaches a different conclusion.';
  return `${n} of ${TOTAL_SIGNALS} signals were decided by a single vote among the three independent reads, `
    + `concentrated in ${cats.slice(0, 2).join(' and ')} — ${Math.round(w.exposure * 100)}% of the weighted score. `
    + `${cause} Adding the missing documents would settle them and is the only thing that will: `
    + `re-running on the same evidence can move this number by several points without making it more right.`;
}


// The four guidance bands, mirroring tools/sentiment/compute.js in the runner. The runner DECIDES the
// band — including the gates on READY — and stamps it on the snapshot; this is only how the OS names it.
export const GUIDANCE_BANDS = {
  READY:             { label: 'Investment ready',                            tone: 'good' },
  PROMISING:         { label: 'Promising, with amendments or gaps to close',  tone: 'mid'  },
  HIGH_RISK:         { label: 'High risk',                                    tone: 'bad'  },
  POTENTIAL_DECLINE: { label: 'Potential decline',                            tone: 'bad'  },
};

/** A band code → its label, old vocabulary included. Unknown codes stay unknown rather than reading well. */
export function bandLabelOf(code) {
  if (GUIDANCE_BANDS[code]) return GUIDANCE_BANDS[code].label;
  return ({ approved: 'Strong — investor-ready', feedback: 'Promising — named gaps to close', rework: 'Material gaps', forming: 'Forming', unrated: 'Forming' })[code] || 'Forming';
}
