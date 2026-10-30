// ============================================================
// Ventrify OS — Operator Workspace · Org licence / capability model
//
// An organisation's `plan` decides TWO things:
//   • capabilities — WHAT it can do   ({ assess, build })
//   • limits       — HOW MUCH of it   ({ assessments, builds, prescreens }; null = unlimited)
//
// `assessments` counts FULL-TIER engagements only. A pre-screen is a ~1-minute triage
// read, not a two-hour run, so burning a full-assessment credit on one would discourage
// exactly the behaviour that saves us the compute. It gets its own allowance. Engagement
// TIER itself lives in shared/entitlements.js; this file owns the LICENCE.
//
// A "preset" is just a named bundle of capabilities + limits that an admin
// picks at org-creation time (and can override → 'custom'). The admin sets
// this in admin.html; it is stored on organisations/{id}.plan via /api/admin.
//
// BACKWARDS-COMPATIBLE: an org with NO plan is treated as Full platform,
// unlimited — so every org created before this feature behaves exactly as
// before. Gating only ever *restricts* an org that has an explicit plan.
//
// Loaded as an ES module by app.js, which exposes the API as
// `window.VentrifyPlan` and stamps the resolved plan onto `window.WORKSPACE.plan`.
//
// NOTE: api/admin.js (CommonJS) mirrors PRESETS + normalisePlan server-side —
// keep the two in sync if you change a preset's capabilities or limits.
// ============================================================

// `prescreens` is an ABUSE VALVE, not the product rule. The real rule — one free scored
// pre-screen per VENTURE — is enforced by venture identity + deck fingerprint in
// shared/entitlements.js. Paying subscribers get unlimited triage (that IS the feature);
// a free self-serve account and a single one-off purchase get a ceiling.
export const PLAN_PRESETS = {
  'self-serve': {
    label: 'Free account',
    blurb: 'Pre-screen a venture free and see the range. Full assessments are bought per venture.',
    capabilities: { assess: true, build: false },
    limits: { assessments: 0, builds: 0, prescreens: 3 },
  },
  'one-off': {
    label: 'One-off assessment',
    blurb: 'A single venture assessment — upload one deck + supporting docs, get one verdict.',
    capabilities: { assess: true, build: false },
    limits: { assessments: 1, builds: 0, prescreens: 5 },
  },
  'assess': {
    label: 'Assessment licence',
    blurb: 'Assess as many ventures as you like. No MVP builds.',
    capabilities: { assess: true, build: false },
    limits: { assessments: null, builds: 0, prescreens: null },
  },
  'full': {
    label: 'Full platform licence',
    blurb: 'Build MVPs and assess ventures — unlimited.',
    capabilities: { assess: true, build: true },
    limits: { assessments: null, builds: null, prescreens: null },
  },
  'custom': {
    label: 'Custom',
    blurb: 'Hand-pick capabilities and per-type limits.',
    capabilities: { assess: true, build: true },
    limits: { assessments: null, builds: null, prescreens: null },
  },
};

const FULL = { preset: 'full', capabilities: { assess: true, build: true }, limits: { assessments: null, builds: null, prescreens: null } };

// null/''/'unlimited'/negative → null (unlimited); otherwise a non-negative integer.
function normLimit(v) {
  if (v == null || v === '' || v === 'unlimited') return null;
  const n = Math.floor(Number(v));
  return (isNaN(n) || n < 0) ? null : n;
}

// Turn whatever is on org.plan (or nothing) into a fully-shaped, trustworthy plan.
export function resolvePlan(org) {
  const p = org && org.plan;
  if (!p) return { ...FULL, capabilities: { ...FULL.capabilities }, limits: { ...FULL.limits }, _default: true };

  const preset = p.preset || 'custom';
  const def = PLAN_PRESETS[preset] || PLAN_PRESETS.full;
  const caps = p.capabilities
    ? { assess: !!p.capabilities.assess, build: !!p.capabilities.build }
    : { ...def.capabilities };
  const limits = p.limits
    // An org stored before prescreens existed has no such key → normLimit(undefined) → null
    // → unlimited triage. Right default: every pre-existing org is a paying licensee.
    ? { assessments: normLimit(p.limits.assessments), builds: normLimit(p.limits.builds), prescreens: normLimit(p.limits.prescreens) }
    : { ...def.limits };
  return { preset, capabilities: caps, limits };
}

// --- Capability + limit queries ------------------------------------------
// `type` throughout is the engagement type: 'assessment' | 'build'.
function capKey(type) { return type === 'assessment' ? 'assess' : 'build'; }
// A pre-screen is still the ASSESS capability — it just draws on a different allowance.
function limitKey(type, tier) {
  if (type !== 'assessment') return 'builds';
  return tier === 'prescreen' ? 'prescreens' : 'assessments';
}

export function orgCan(plan, type) {
  return !!(plan && plan.capabilities && plan.capabilities[capKey(type)]);
}

// `tier` is 'full' | 'prescreen' and defaults to 'full' everywhere below, so every
// pre-existing 3-argument caller keeps its exact behaviour.
export function limitFor(plan, type, tier = 'full') {
  return plan && plan.limits ? plan.limits[limitKey(type, tier)] : null; // null = unlimited
}

// An engagement with no `tier` counts as full-tier — matching entitlements.tierOf(), so
// the two modules can never disagree about what an old record is.
export function usageFor(programs, type, tier = 'full') {
  return (programs || []).filter(p => {
    const et = p.engagementType || 'build';
    if (type !== 'assessment') return et !== 'assessment';
    return et === 'assessment' && ((p.tier === 'prescreen' ? 'prescreen' : 'full') === tier);
  }).length;
}

export function remainingFor(plan, programs, type, tier = 'full') {
  const lim = limitFor(plan, type, tier);
  if (lim == null) return Infinity;
  return Math.max(0, lim - usageFor(programs, type, tier));
}

// Can this org create one more engagement of `type` right now?
// → { allowed, reason: 'capability' | 'limit' | undefined, remaining }
export function canCreate(plan, programs, type, tier = 'full') {
  if (!orgCan(plan, type)) return { allowed: false, reason: 'capability', remaining: 0 };
  const remaining = remainingFor(plan, programs, type, tier);
  if (remaining <= 0) return { allowed: false, reason: 'limit', remaining: 0 };
  return { allowed: true, remaining };
}

// The engagement types this org may create at all (capability-wise),
// in display order: build first, then assessment.
export function allowedTypes(plan) {
  const out = [];
  if (orgCan(plan, 'build')) out.push('build');
  if (orgCan(plan, 'assessment')) out.push('assessment');
  return out;
}

export function planLabel(plan) {
  return (PLAN_PRESETS[plan && plan.preset] || {}).label || 'Custom';
}

// Short human summary of a plan's limits, e.g. "1 assessment", "Unlimited
// assessments", "Build + Assess · unlimited". Used for badges.
//
// A ZERO allowance is omitted, never printed. A free account's badge must read
// "3 pre-screens", not "0 assessments" — the second states a plan's shape as a
// deficiency, which is the same mistake §3 of the pre-screen spec guards against.
// Unlimited pre-screens are omitted too: for a licensee that is a non-event.
export function planSummary(plan) {
  const lbl = planLabel(plan);
  const fmt = (type, tier, noun) => {
    if (!orgCan(plan, type)) return null;
    const lim = limitFor(plan, type, tier);
    if (lim === 0) return null;
    if (lim == null) return tier === 'prescreen' ? null : `unlimited ${noun}s`;
    return `${lim} ${noun}${lim === 1 ? '' : 's'}`;
  };
  const parts = [
    fmt('build', 'full', 'build'),
    fmt('assessment', 'full', 'assessment'),
    fmt('assessment', 'prescreen', 'pre-screen'),
  ].filter(Boolean);
  return { label: lbl, detail: parts.join(' · ') };
}
