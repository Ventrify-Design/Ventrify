// ============================================================
// Ventrify OS — Operator Workspace · Org licence / capability model
//
// An organisation's `plan` decides TWO things:
//   • capabilities — WHAT it can do   ({ assess, build })
//   • limits       — HOW MUCH of it   ({ assessments, builds }; null = unlimited)
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

export const PLAN_PRESETS = {
  'one-off': {
    label: 'One-off assessment',
    blurb: 'A single venture assessment — upload one deck + supporting docs, get one verdict.',
    capabilities: { assess: true, build: false },
    limits: { assessments: 1, builds: 0 },
  },
  'assess': {
    label: 'Assessment licence',
    blurb: 'Assess as many ventures as you like. No MVP builds.',
    capabilities: { assess: true, build: false },
    limits: { assessments: null, builds: 0 },
  },
  'full': {
    label: 'Full platform licence',
    blurb: 'Build MVPs and assess ventures — unlimited.',
    capabilities: { assess: true, build: true },
    limits: { assessments: null, builds: null },
  },
  'custom': {
    label: 'Custom',
    blurb: 'Hand-pick capabilities and per-type limits.',
    capabilities: { assess: true, build: true },
    limits: { assessments: null, builds: null },
  },
};

const FULL = { preset: 'full', capabilities: { assess: true, build: true }, limits: { assessments: null, builds: null } };

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
    ? { assessments: normLimit(p.limits.assessments), builds: normLimit(p.limits.builds) }
    : { ...def.limits };
  return { preset, capabilities: caps, limits };
}

// --- Capability + limit queries ------------------------------------------
// `type` throughout is the engagement type: 'assessment' | 'build'.
function capKey(type) { return type === 'assessment' ? 'assess' : 'build'; }
function limitKey(type) { return type === 'assessment' ? 'assessments' : 'builds'; }

export function orgCan(plan, type) {
  return !!(plan && plan.capabilities && plan.capabilities[capKey(type)]);
}

export function limitFor(plan, type) {
  return plan && plan.limits ? plan.limits[limitKey(type)] : null; // null = unlimited
}

export function usageFor(programs, type) {
  return (programs || []).filter(p => {
    const et = p.engagementType || 'build';
    return type === 'assessment' ? et === 'assessment' : et !== 'assessment';
  }).length;
}

export function remainingFor(plan, programs, type) {
  const lim = limitFor(plan, type);
  if (lim == null) return Infinity;
  return Math.max(0, lim - usageFor(programs, type));
}

// Can this org create one more engagement of `type` right now?
// → { allowed, reason: 'capability' | 'limit' | undefined, remaining }
export function canCreate(plan, programs, type) {
  if (!orgCan(plan, type)) return { allowed: false, reason: 'capability', remaining: 0 };
  const remaining = remainingFor(plan, programs, type);
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
export function planSummary(plan) {
  const lbl = planLabel(plan);
  const fmt = (type) => {
    if (!orgCan(plan, type)) return null;
    const lim = limitFor(plan, type);
    const noun = type === 'assessment' ? 'assessment' : 'build';
    return lim == null ? `unlimited ${noun}s` : `${lim} ${noun}${lim === 1 ? '' : 's'}`;
  };
  const parts = ['build', 'assessment'].map(fmt).filter(Boolean);
  return { label: lbl, detail: parts.join(' · ') };
}
