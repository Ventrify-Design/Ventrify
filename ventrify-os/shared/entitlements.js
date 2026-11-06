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
    blurb: 'A free ~5-minute read that returns a verdict band, the case argued both ways, who else is doing this, and what your own documents disagree about.',
  },
  full: {
    key: 'full', label: 'Full assessment',
    blurb: 'The complete agentic run — a single measured score, seven chapters, diligence and deep research.',
  },
};

// ---- What each tier actually hands back ---------------------------------
// ONE VOCABULARY, TWO COLUMNS. The first version of this was two separate lists of
// what each tier gives, and it read as a DRAW: seven bullets against eight, every
// one of them a tick, no way to see that one of these is twenty minutes of reading
// and the other is a morning's work. A comparison only compares if both sides answer
// the SAME questions. So every capability is named once and each tier says what it
// does about it — and the asymmetry stops being an opinion and becomes countable.
//
// It lives here rather than in the renderer because every line is a CLAIM ABOUT WHAT
// THE PRODUCT DOES, and a claim that drifts from the booleans in entitlements() below
// is worse than no comparison at all. ds.tierChoice() renders this; it owns no copy.
//
// Traceable: the pre-screen column to design/prescreen-v2-spec.md §5 (what lands on
// screen) and §4 (deck-only), the full column to the assess page's tabs,
// shared/vss-rubric.js, and the paid-only booleans below. Add a line, point at the
// thing that produces it.
//
// A cell is `true` (plain tick), `false` (not in this tier), or a STRING — a tick with
// a qualifier, for the places where both tiers do a thing but not to the same depth.
// Strings are what stop this becoming a feature checklist that flatters both sides.
export const TIER_GROUPS = [
  {
    group: 'The verdict',
    rows: [
      { label: 'Is this worth assessing?',
        prescreen: 'A band — High, Medium or Low, with the reason', full: true },
      { label: 'A measured investability score',
        prescreen: false, full: 'Weighted 0–100 across 7 categories and 35 signals' },
      { label: 'The bet, played back in our words',
        prescreen: true, full: true },
    ],
  },
  {
    group: 'The argument',
    rows: [
      { label: 'The case argued both ways',
        prescreen: 'Three for, three against', full: 'A full chapter, argued from the whole room' },
      { label: 'Competitive read',
        prescreen: 'Names that are not in the deck', full: 'Named comparables, benchmarked' },
      { label: 'Team read',
        // ⚠ "the gaps in it", not "what is missing". prescreen-vocabulary.mjs forbids
        // "missing" anywhere in this block (§3.2 — disclose a thin basis, never penalise
        // it). The sense here is a TEAM gap, not an absent document, but a gate that had
        // to tell those apart would be a gate nobody trusts. Reword, don't weaken.
        prescreen: 'Fit for the problem, and the gaps in it', full: 'A full chapter — roster, record, gaps' },
      { label: 'Market sizing and valuation read',
        prescreen: false, full: true },
      { label: 'Contradictions between your own documents',
        prescreen: 'Needs two or more documents', full: true },
    ],
  },
  {
    group: 'The evidence',
    rows: [
      { label: 'Data-room coverage — what is present and absent',
        prescreen: true, full: true },
      { label: 'Deep research, document by document, with sources',
        prescreen: false, full: true },
      { label: 'Diligence gaps raised as asks you can answer',
        prescreen: false, full: 'With links and uploads' },
    ],
  },
  {
    group: 'What you can do with it',
    rows: [
      { label: 'Ask the memo questions, every claim cited',
        prescreen: false, full: true },
      { label: 'Deal-memo PDF for an investment committee',
        prescreen: false, full: true },
      { label: 'Shareable frozen memo link, with your sign-off',
        prescreen: false, full: true },
      { label: 'Re-score when new evidence lands',
        prescreen: false, full: true },
    ],
  },
];

// ---- What a run costs, in money or in allowance -------------------------
// ⚠ THE PRICE IS DISPLAYED, NOT CHARGED. BILLING_ENFORCED is false and unlockRoute()
// returns 'run', so nothing collects this today — a customer who presses the button
// gets the run. The number lives here, alone, so that when Stripe lands there is one
// place to change it and no template has invented a second one in the meantime.
export const PRICE_PER_RUN_USD = 199;

// tierCost — what the comparison's "Costs" line says, derived from the LICENCE rather
// than written per screen. `allowance` is the already-computed plan fact, passed IN,
// because this module imports nothing and must not learn how to read a plan:
//   { canAssess, limit, remaining }   limit null = unlimited; remaining Infinity = same
//
// The cases, and why each is worded the way it is:
//   no capability   → the licence does not include this at all
//   unlimited       → "Included in your licence" / "Free" — never a price
//   allowance left  → "3 runs left". What a licensee most wants to know is how many
//                     they still hold, not the sticker price of something already paid for.
//   none left       → the price, because buying is now the only route. A plan that never
//                     granted any (self-serve, assessments: 0) lands here too, and must
//                     NOT read "0 of 0 used" — it never had one to use, and telling a free
//                     account it has "used" its allowance is the same deficiency-framing
//                     planSummary already refuses.
export function tierCost(tier, allowance = {}) {
  const { canAssess = true, limit = null, remaining = Infinity } = allowance;
  if (!canAssess) return { main: 'Not on this licence', sub: '' };
  if (limit == null) return tier === 'full'
    ? { main: 'Included in your licence', sub: 'Unlimited on this plan' }
    : { main: 'Free', sub: 'Unlimited on this plan' };
  if (remaining > 0) return {
    main: remaining + (remaining === 1 ? ' run left' : ' runs left'),
    sub: 'of ' + limit + ' on your plan',
  };
  return tier === 'full'
    ? { main: '$' + PRICE_PER_RUN_USD + ' per run', sub: limit > 0 ? 'Your plan allowance is used' : '' }
    : { main: 'No pre-screens left', sub: 'of ' + limit + ' on your plan' };
}

// Per-tier framing. `cost` here is the FALLBACK used when no plan is in hand — the DS
// specimen, a preview. A live screen passes tierCost() instead. `time` is never derived:
// it is a property of the run, not of the licence.
export const TIER_COMPARISON = {
  prescreen: {
    question: 'Is this worth assessing?',
    pitch: 'A fast read of the case, so you know whether to spend the real run on it.',
    time: 'about 5 minutes', cost: 'Free',
    basis: 'Reads your pitch deck, the data room if you attach one, and public sources.',
  },
  full: {
    question: 'What is the verdict?',
    pitch: 'The complete agentic run — everything the pre-screen reads, argued from the whole room.',
    time: 'about 2 hours', cost: '$' + PRICE_PER_RUN_USD + ' per run',
    basis: 'Reads every document in the room, then researches the outside world against it.',
    // The line the pre-screen column is measured against. Counted, not asserted — see tierTally().
    upsell: 'Everything above, on every document you have, with the working shown.',
  },
};

// What each tier answers, counted off TIER_GROUPS so the headline number can never
// disagree with the table under it. A qualifier string counts as a yes; `false` does not.
export function tierTally(tier) {
  const rows = TIER_GROUPS.flatMap(g => g.rows);
  return { yes: rows.filter(r => r[tier]).length, total: rows.length };
}

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

    // THE PRE-SCREEN'S OWN SHARE LINK, and deliberately not `share` above. They are two different
    // documents: `share` publishes the DEAL MEMO, which a pre-screened venture does not have, so
    // flipping that flag would have offered a link to nothing. This publishes the pre-screen itself —
    // the band, the six findings, the coverage — labelled as the five-minute read it is.
    //
    // Free on purpose, and it is the one free feature that is also the best marketing the product has:
    // a pre-screen forwarded to a colleague is read by someone who has never seen VerdictScore, and
    // what it advertises is the full assessment it is visibly NOT. Keeping the paid artefact distinct
    // is what makes that work — see workspace/prescreen-view.js.
    //
    // Mutually exclusive with `share` by construction, so exactly one of them is ever offered. They
    // render on different surfaces — see the note on share_prescreen in shared/actions.js.
    sharePrescreen: !full,

    // The founder's half of the same moment: tell them they are through and ask for the documents
    // that would make the full read worth two hours. Gated with the pre-screen rather than with
    // `full`, because by the time an engagement IS full there is nothing left to advance it to.
    advanceFounder: !full,

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
  return { create: true, assist: e.assist, export: e.export, share: e.share,
           sharePrescreen: e.sharePrescreen, advanceFounder: e.advanceFounder };
}

// ---- The two-button emphasis swap ---------------------------------------
// ONE derivation for the create screen's CTA pair. Not a toggle: the consequence
// asymmetry is too large for a switch (seconds vs two hours, ~$1.60 vs a real run)
// and a toggle is the easiest control to miss. Same two buttons for both audiences,
// emphasis swapped — the hierarchy teaches each one the right default.
//
// `secondary` is tonal, never filled, so the page keeps exactly ONE primary and
// stays inside the conformance gate.
// EVERY BUTTON SAYS WHAT IT COSTS IN TIME. The first real user of this screen was a licensee who had
// just created a workspace called "Pre-Screen Tests", pressed the filled button, and started a
// two-hour agentic run — because the emphasis swap is correct for a licensee and nothing on either
// button said that one takes five minutes and the other takes two hours. That is the single most
// decision-relevant fact about the choice, and it was the one thing missing from it.
// `tier` defaults to the licence's preference, but a caller that has resolved what the org can
// actually create TODAY (plan.js createableTier) passes that instead — an org whose full allowance is
// spent must not be shown "Run full assessment" as its primary.
export function ctaPair(plan, tier = defaultTier(plan)) {
  const runPrescreen = { id: 'run_prescreen', label: 'Run free pre-screen', icon: 'bolt', cost: 'about 5 minutes · free' };
  const runFull      = { id: 'run_full',      label: 'Run full assessment', icon: 'play_arrow', cost: 'about 2 hours' };
  return tier === 'prescreen'
    ? { primary: runPrescreen, secondary: { id: 'unlock_full', label: 'Unlock full assessment', icon: 'lock_open', cost: 'about 2 hours' } }
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
