// ============================================================
// Ventrify OS — Entitlements (SHARED · single source of truth)
//
// WHAT A CUSTOMER MAY DO, derived in ONE place. Pure ESM, DOM-free, and it imports
// nothing — the plan is passed IN as a plain object, exactly as shared/actions.js
// takes `caps` rather than importing workspace/plan.js. The rail filter, the tab
// builder and the server all read from here, so a capability can never be true on
// one surface and false on another.
//
// TWO INDEPENDENT AXES. Do not collapse them:
//   • ORG PLAN      (workspace/plan.js) — the LICENCE. What this organisation bought.
//   • ENGAGEMENT TIER ('prescreen' | 'full') — per venture. Which product this one IS.
// A licensed VC on an unlimited plan can still hold a prescreen-tier engagement (a
// triage read); a self-serve customer can hold a full-tier one the moment they pay.
//
// BACKWARDS COMPATIBLE. An engagement with no `tier` resolves to 'full', so every
// engagement created before this feature behaves exactly as it does today. Same
// reasoning as resolvePlan()'s "no plan = full platform".
//
// PRESENTATION ≠ PERMISSION. Hiding a button is cosmetic. api/ and the Firestore
// rules must re-enforce every gate here using the SAME keys.
// ============================================================

// ---- The billing flag ---------------------------------------------------
// Stripe is not wired yet (business banking pending). While this is false, the
// "Unlock full assessment" button simply RUNS the full assessment instead of
// routing to checkout, so full runs stay available to the operator.
//
// It relaxes the TIER gate ONLY — it does not relax org licence limits. An org
// that bought one assessment still gets one; the operator's own orgs carry no
// plan at all and are already unlimited, so they are unaffected either way.
//
// When Stripe lands: flip this to true. That is the whole migration.
export const BILLING_ENFORCED = false;

export const TIERS = {
  prescreen: {
    key: 'prescreen', label: 'Pre-screen',
    blurb: 'A free ~1-minute read that returns a score range, a flavour of the findings, and a data-room coverage report.',
  },
  full: {
    key: 'full', label: 'Full assessment',
    blurb: 'The complete agentic run — a single measured score, seven chapters, diligence and deep research.',
  },
};

// ---- Tier resolution ----------------------------------------------------

// An engagement's tier. Anything that isn't explicitly 'prescreen' is 'full' —
// legacy engagements have no field and must keep working untouched.
export function tierOf(engagement) {
  return (engagement && engagement.tier) === 'prescreen' ? 'prescreen' : 'full';
}

export const isPrescreen = engagement => tierOf(engagement) === 'prescreen';

// What a NEW engagement starts as. Self-serve customers must pre-screen first;
// anyone holding a licence goes straight to a full run unless they choose triage.
export function defaultTier(plan) {
  return plan && plan.preset === 'self-serve' ? 'prescreen' : 'full';
}

// ---- The derivation everything reads ------------------------------------
//   entitlements(engagement, plan) → { tier, …booleans }
//
// Note what is NOT relaxed by BILLING_ENFORCED: assist / fileEvidence / export /
// share are strictly tier-derived. That is deliberate — it keeps the paid-feature
// gating genuinely testable today. The operator reaches those features the same
// way a customer will: by promoting the engagement to 'full'.
export function entitlements(engagement, plan) {
  const tier = tierOf(engagement);
  const full = tier === 'full';
  return {
    tier,
    isPrescreen: !full,

    // the run itself
    runFull:   full || !BILLING_ENFORCED,   // the unlock button really runs it while Stripe is unwired
    runPrescreen: true,

    // paid-only features (operator's list, 2026-10-30)
    assist:       full,   // the AI assistant in the `assist` rail panel
    fileEvidence: full,   // answering diligence asks — links, uploads, the whole gap flow
    export:       full,   // deal-memo PDF
    share:        full,   // the /m/<token> frozen memo link + operator sign-off

    // the free engagement loop — always on, costs $0, and it is the whole hook
    rescanRoom: true,

    // one SCORED pre-screen per venture. Re-scoring is the upgrade.
    rescore: full,
  };
}

// caps object in the shape shared/actions.js already consumes, so the utility rail
// filters itself with no per-page conditionals.
export function capsFor(engagement, plan) {
  const e = entitlements(engagement, plan);
  return { create: true, assist: e.assist, export: e.export, share: e.share };
}

// ---- The two-button emphasis swap ---------------------------------------
// ONE derivation for the create screen's CTA pair. Not a toggle: the consequence
// asymmetry is too large for a switch (seconds vs two hours, ~$1.60 vs a real run)
// and a toggle is the easiest control to miss. Same two buttons for both audiences,
// emphasis swapped — the hierarchy teaches each one the right default.
//
// `secondary` is tonal, never filled, so the page keeps exactly ONE primary and
// stays inside the conformance gate.
export function ctaPair(plan) {
  const runPrescreen = { id: 'run_prescreen', label: 'Run free pre-screen', icon: 'bolt' };
  const runFull      = { id: 'run_full',      label: 'Run full assessment', icon: 'play_arrow' };
  return defaultTier(plan) === 'prescreen'
    ? { primary: runPrescreen, secondary: { id: 'unlock_full', label: 'Unlock full assessment', icon: 'lock_open' } }
    : { primary: runFull,      secondary: { ...runPrescreen, label: 'Run pre-screen first' } };
}

// Where the unlock button goes. One call site, one flag.
export const unlockRoute = () => (BILLING_ENFORCED ? 'checkout' : 'run');

// ---- Venture identity, for "one free pre-screen per venture" ------------
// The rule is per VENTURE, not per file — so identity is the primary key and the
// deck fingerprint is the backstop for someone renaming the same company.
//
// HONEST LIMIT: a rewritten deck under a fresh account defeats both. This is a
// speed bump against casual re-rolling, not a wall. The real cap is sign-in plus
// per-account rate limiting plus $1.60 not being worth a new email address.
export function ventureKey({ name, website, founder } = {}) {
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
  const domain = String(website || '').toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return [norm(name), norm(domain), norm(founder)].filter(Boolean).join('|');
}

// Shingle fingerprint of EXTRACTED TEXT, never file bytes — ingest-docs.js already
// produces the text, so re-exporting, re-compressing or editing metadata does not
// dodge it, and a one-slide edit still overlaps heavily.
export function deckFingerprint(text, { windowSize = 9, keep = 64 } = {}) {
  const words = String(text || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length < windowSize) return [];
  const seen = new Set();
  for (let i = 0; i + windowSize <= words.length; i++) {
    // FNV-1a over the window — cheap, dependency-free, and stable across runtimes.
    let h = 0x811c9dc5;
    const w = words.slice(i, i + windowSize).join(' ');
    for (let j = 0; j < w.length; j++) { h ^= w.charCodeAt(j); h = Math.imul(h, 0x01000193) >>> 0; }
    seen.add(h);
  }
  // Keep the numerically smallest N — a stable sample, so two near-identical decks
  // keep the same subset rather than drifting apart.
  return [...seen].sort((a, b) => a - b).slice(0, keep);
}

// Jaccard overlap of two fingerprints, 0..1.
export function fingerprintOverlap(a, b) {
  const A = new Set(a || []), B = new Set(b || []);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / (A.size + B.size - hit);
}

// Deliberately conservative. A false positive blocks a GENUINE new venture and
// poisons a first experience; a false negative costs us ~$1.60. Those are not
// comparable, so the threshold sits high and the caller must treat a match as a
// SOFT block — "open the existing result, or unlock the full assessment" — never
// a dead end, and never surfaced across accounts.
export const DECK_MATCH_THRESHOLD = 0.82;

export function matchesExistingVenture(candidate, priors = []) {
  for (const p of priors) {
    if (candidate.ventureKey && p.ventureKey && candidate.ventureKey === p.ventureKey) {
      return { match: true, reason: 'venture', prior: p };
    }
    if (fingerprintOverlap(candidate.fingerprint, p.fingerprint) >= DECK_MATCH_THRESHOLD) {
      return { match: true, reason: 'deck', prior: p };
    }
  }
  return { match: false };
}
