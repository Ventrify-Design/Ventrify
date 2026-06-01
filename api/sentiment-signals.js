/**
 * GET /api/sentiment-signals
 *
 * Computes the "Diligence Readiness" sub-meter — a deterministic 0-100 score
 * measuring how complete the engagement is against the Ventrify CLAUDE.md
 * workflow. This is the SECOND, smaller meter that sits next to the headline
 * Venture Sentiment Score on the Investability tab. It explicitly measures
 * ENGAGEMENT COMPLETENESS (process), NOT venture quality (judgment).
 *
 * AUTHORITY MODEL
 *   • The headline VSS is operator-authored (the studio lead stands behind
 *     the number against a published rubric).
 *   • The Diligence Readiness chip is deterministic + live (reads the
 *     engagement repo at request time, computes signals, returns 0-100).
 *   • Goodhart firebreak: Diligence Readiness contributes ZERO weight to
 *     VSS. Operators can game it by closing gates faster — which is a
 *     desirable behaviour, not corruption.
 *
 * SIGNALS
 *   1. gatesClosedPct       — % of phase gates with a sign-off in _signoff.json
 *   2. provocationsResolvedPct — % of Provocation Cards resolved weighted by priority
 *   3. financialsCompletePct — % of the 11 canonical financial files present
 *   4. feedbackAddressedPct — % of portal-feedback.json items in 'addressed' state
 *   5. paymentsCurrentPct   — % of milestone payments captured in payments.md
 *
 * COMPOSITE
 *   Simple arithmetic mean across the 5 signals. Each signal is 0-100.
 *   No geometric mean (the signals are commensurable — they all measure
 *   "thing done / thing planned"). No hard cap (this isn't a quality
 *   judgment — it's a completeness audit).
 *
 * SCOPE
 *   Operator + client scope ONLY. Investor scope strips this from the
 *   response (per the design rule — investors see only the headline VSS).
 *
 * FAILURE MODES
 *   Each signal fails-safe: if a file is missing, the signal returns
 *   `{ score: 0, breakdown: '...not yet captured' }`. The portal renders
 *   '— not started' rather than a misleading 0%.
 */

'use strict';

const {
  requireAuth,
  loadClients,
  ghReadFile,
  ghListDir,
  parseFrontmatter,
  HUBS,
} = require('./_lib');

// The 11 canonical financial files per Phase 2.5 in CLAUDE.md. All must
// exist for financialsCompletePct to read 100.
const CANONICAL_FINANCIAL_FILES = [
  'build-costs.md',
  'operating-costs.md',
  'revenue-model.md',
  'unit-economics-detailed.md',
  'cash-flow-forecast.md',
  'marketing-budget.md',
  'hiring-plan.md',
  'sensitivity-analysis.md',
  'funding-ask.md',
  '_financial-summary.md',
  'scope-change-recommendations.md',
];

// ── Signal: gatesClosedPct ─────────────────────────────────────────────────
async function computeGatesClosed(repo, branch) {
  // Sign-offs live in portal-feedback.json (per the existing portal-list.js
  // pattern). Gates are derived from HUBS that have a `gate` field set.
  let signOffs = {};
  try {
    const raw = await ghReadFile(repo, branch, 'portal-feedback.json');
    if (raw) {
      const parsed = JSON.parse(raw);
      signOffs = parsed.signOffs || {};
    }
  } catch (_e) {
    /* file may not exist yet — treat as zero gates signed */
  }
  const gatedHubs = HUBS.filter((h) => h.gate);
  if (gatedHubs.length === 0) return { score: 0, signed: 0, total: 0, breakdown: 'No gates configured' };
  const signed = gatedHubs.filter((h) => signOffs[h.slug] && signOffs[h.slug].approvedAt).length;
  const score = Math.round((signed / gatedHubs.length) * 100);
  return {
    score,
    signed,
    total: gatedHubs.length,
    breakdown: `${signed}/${gatedHubs.length} gates signed off`,
    openGates: gatedHubs.filter((h) => !signOffs[h.slug]).map((h) => ({ slug: h.slug, gate: h.gate })),
  };
}

// ── Signal: provocationsResolvedPct ───────────────────────────────────────
// Reads each card-driven hub's _provocations/*.md frontmatter. Cards are
// resolved when their frontmatter `status: resolved` or when portal-feedback
// captures a founder comment / acknowledge. Priority weights: high=3, med=2, low=1.
async function computeProvocationsResolved(repo, branch) {
  let comments = [];
  try {
    const raw = await ghReadFile(repo, branch, 'portal-feedback.json');
    if (raw) {
      const parsed = JSON.parse(raw);
      comments = parsed.provocationComments || [];
    }
  } catch (_e) { /* missing feedback file → no comments */ }

  let weightedTotal = 0;
  let weightedResolved = 0;
  let totalCards = 0;
  let resolvedCards = 0;
  const PRIORITY = { high: 3, medium: 2, low: 1 };

  const cardDrivenHubs = HUBS.filter((h) => h.dir && !h.external && !h.surfaceType);
  for (const hub of cardDrivenHubs) {
    let entries;
    try {
      entries = await ghListDir(repo, branch, `${hub.dir}/_provocations`);
    } catch (_e) {
      continue; // hub has no _provocations dir yet
    }
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry.name.endsWith('.md') || entry.name.startsWith('_')) continue;
      let raw;
      try {
        raw = await ghReadFile(repo, branch, `${hub.dir}/_provocations/${entry.name}`);
      } catch (_e) { continue; }
      if (!raw) continue;
      const fm = parseFrontmatter(raw);
      if (!fm || !fm.id) continue;
      totalCards++;
      const priority = PRIORITY[fm.priority] || 1;
      weightedTotal += priority;
      // A card is "resolved" if it has any founder comment OR acknowledgement
      // in portal-feedback.json, OR if its frontmatter explicitly marks
      // status: resolved.
      const hasInteraction = comments.some(
        (c) => c.hub === hub.slug && c.cardId === fm.id,
      );
      if (hasInteraction || fm.status === 'resolved') {
        resolvedCards++;
        weightedResolved += priority;
      }
    }
  }

  if (totalCards === 0) {
    return { score: 0, total: 0, resolved: 0, breakdown: 'No Provocation Cards generated yet' };
  }
  const score = Math.round((weightedResolved / weightedTotal) * 100);
  return {
    score,
    total: totalCards,
    resolved: resolvedCards,
    breakdown: `${resolvedCards}/${totalCards} cards resolved (priority-weighted)`,
  };
}

// ── Signal: financialsCompletePct ─────────────────────────────────────────
async function computeFinancialsComplete(repo, branch) {
  const present = [];
  const missing = [];
  for (const file of CANONICAL_FINANCIAL_FILES) {
    try {
      const data = await ghReadFile(repo, branch, `financials/${file}`);
      if (data && data.length > 50) present.push(file);
      else missing.push(file);
    } catch (_e) {
      missing.push(file);
    }
  }
  const score = Math.round((present.length / CANONICAL_FINANCIAL_FILES.length) * 100);
  return {
    score,
    present: present.length,
    total: CANONICAL_FINANCIAL_FILES.length,
    breakdown: `${present.length}/${CANONICAL_FINANCIAL_FILES.length} canonical financial files present`,
    missingFiles: missing,
  };
}

// ── Signal: feedbackAddressedPct ──────────────────────────────────────────
async function computeFeedbackAddressed(repo, branch) {
  let feedback = [];
  try {
    const raw = await ghReadFile(repo, branch, 'portal-feedback.json');
    if (raw) {
      const parsed = JSON.parse(raw);
      feedback = parsed.feedback || [];
    }
  } catch (_e) { /* no feedback yet */ }

  if (feedback.length === 0) {
    // No feedback at all — neutral starting score, not zero. Zero would
    // unfairly penalise fresh engagements.
    return { score: 100, total: 0, addressed: 0, breakdown: 'No feedback submitted yet' };
  }
  const addressed = feedback.filter((f) => f.status === 'addressed' || f.status === 'wont-fix').length;
  const score = Math.round((addressed / feedback.length) * 100);
  return {
    score,
    total: feedback.length,
    addressed,
    open: feedback.length - addressed,
    breakdown: `${addressed}/${feedback.length} feedback items resolved`,
  };
}

// ── Signal: paymentsCurrentPct ────────────────────────────────────────────
async function computePaymentsCurrent(repo, branch) {
  let raw;
  try {
    raw = await ghReadFile(repo, branch, 'payments.md');
  } catch (_e) {
    return { score: 0, breakdown: 'payments.md not yet created' };
  }
  if (!raw) {
    return { score: 0, breakdown: 'payments.md not yet created' };
  }
  // Count milestone-paid markers. The payments.md template uses
  // `[ ] Paid` and `[x] Paid` checkboxes per milestone. A rough but
  // workable heuristic: count both, take the ratio.
  const totalMatches = (raw.match(/\[[\sx]\]\s*Paid/gi) || []).length;
  const paidMatches = (raw.match(/\[x\]\s*Paid/gi) || []).length;
  if (totalMatches === 0) {
    return { score: 0, breakdown: 'No milestone payment markers in payments.md yet' };
  }
  const score = Math.round((paidMatches / totalMatches) * 100);
  return {
    score,
    paid: paidMatches,
    total: totalMatches,
    breakdown: `${paidMatches}/${totalMatches} milestones marked paid`,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  // Investor scope NEVER sees Diligence Readiness. This is the design rule —
  // Diligence Readiness is engagement-completeness, an internal studio meter.
  if (auth.scope === 'investor') {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden_scope' }));
    return;
  }

  const clients = loadClients();
  const client = clients[auth.slug];
  if (!client) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'client_not_found' }));
    return;
  }

  const repo = client.repo;
  const branch = client.branch || 'main';

  if (!repo) {
    // Client config without repo → no signals available. Return a stub.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      readiness: 0,
      state: 'no-repo-configured',
      breakdown: { gatesClosedPct: 0, provocationsResolvedPct: 0, financialsCompletePct: 0, feedbackAddressedPct: 0, paymentsCurrentPct: 0 },
    }));
    return;
  }

  // Compute all 5 signals in parallel. Each handles its own failure modes.
  const [gates, provocations, financials, feedback, payments] = await Promise.all([
    computeGatesClosed(repo, branch).catch((e) => {
      console.error('[sentiment-signals] gates failed:', e.message);
      return { score: 0, breakdown: 'Signal computation failed' };
    }),
    computeProvocationsResolved(repo, branch).catch((e) => {
      console.error('[sentiment-signals] provocations failed:', e.message);
      return { score: 0, breakdown: 'Signal computation failed' };
    }),
    computeFinancialsComplete(repo, branch).catch((e) => {
      console.error('[sentiment-signals] financials failed:', e.message);
      return { score: 0, breakdown: 'Signal computation failed' };
    }),
    computeFeedbackAddressed(repo, branch).catch((e) => {
      console.error('[sentiment-signals] feedback failed:', e.message);
      return { score: 100, breakdown: 'Signal computation failed; treating as neutral' };
    }),
    computePaymentsCurrent(repo, branch).catch((e) => {
      console.error('[sentiment-signals] payments failed:', e.message);
      return { score: 0, breakdown: 'Signal computation failed' };
    }),
  ]);

  // Arithmetic mean of the 5 signals.
  const readiness = Math.round(
    (gates.score + provocations.score + financials.score + feedback.score + payments.score) / 5,
  );

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.end(JSON.stringify({
    ok: true,
    readiness,
    breakdown: {
      gatesClosed: gates,
      provocationsResolved: provocations,
      financialsComplete: financials,
      feedbackAddressed: feedback,
      paymentsCurrent: payments,
    },
  }));
};
