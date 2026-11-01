#!/usr/bin/env node
// ============================================================
// plan-parity — the licence model exists in THREE places and they must agree.
//
//   workspace/plan.js          PLAN_PRESETS          (client, renders the UI)
//   api/admin.js               SERVER_PLAN_PRESETS   (normalises before Firestore)
//   api/create-engagement.js   SERVER_PLAN_PRESETS   (the hard quota gate)
//
// Three hand-maintained copies WILL drift, and the failure is silent and expensive:
// a preset that grants more server-side than the UI shows is a licence hole, and one
// that grants less is a customer who paid and is blocked. Each file's own header says
// "keep these in sync" — a comment is not a mechanism. This is the mechanism.
//
// Also asserts no UI hardcodes the preset list: the picker must derive from
// PLAN_PRESETS, or a new preset ships invisible.
// ============================================================
import { readFile } from 'node:fs/promises';
import { PLAN_PRESETS } from '../workspace/plan.js';

const LIMITS = ['assessments', 'builds', 'prescreens'];
const norm = v => (v == null ? 'unlimited' : String(v));
let fails = 0;
const fail = m => { console.log('  ✗ ' + m); fails++; };

// Parse a SERVER_PLAN_PRESETS block without executing the module (they're CJS + need env).
async function serverPresets(file) {
  const src = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  const block = src.match(/const SERVER_PLAN_PRESETS = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error('no SERVER_PLAN_PRESETS in ' + file);
  const out = {};
  for (const line of block[1].split('\n')) {
    const key = (line.match(/'([a-z-]+)'\s*:/) || [])[1];
    if (!key) continue;
    const caps = (line.match(/capabilities:\s*\{([^}]*)\}/) || [])[1] || '';
    const lims = (line.match(/limits:\s*\{([^}]*)\}/) || [])[1] || '';
    const lim = {};
    for (const k of LIMITS) {
      const m = lims.match(new RegExp(k + ':\\s*(null|\\d+)'));
      lim[k] = !m ? null : (m[1] === 'null' ? null : Number(m[1]));
    }
    out[key] = { assess: /assess:\s*true/.test(caps), build: /build:\s*true/.test(caps), limits: lim };
  }
  return out;
}

const FILES = ['api/admin.js', 'api/create-engagement.js'];
console.log('plan-parity — licence presets across ' + (FILES.length + 1) + ' files\n');

for (const file of FILES) {
  console.log(file);
  const server = await serverPresets(file);
  for (const [key, client] of Object.entries(PLAN_PRESETS)) {
    if (key === 'custom') continue;              // custom is normalised field-by-field, not a table row
    const sv = server[key];
    if (!sv) { fail(`${key}: missing server-side — the UI offers a preset the server cannot honour`); continue; }
    if (client.capabilities.assess !== sv.assess) fail(`${key}.assess: client ${client.capabilities.assess} vs server ${sv.assess}`);
    if (client.capabilities.build !== sv.build) fail(`${key}.build: client ${client.capabilities.build} vs server ${sv.build}`);
    for (const k of LIMITS) {
      if (norm(client.limits[k]) !== norm(sv.limits[k])) fail(`${key}.${k}: client ${norm(client.limits[k])} vs server ${norm(sv.limits[k])}`);
    }
  }
  for (const key of Object.keys(server)) {
    if (!PLAN_PRESETS[key]) fail(`${key}: exists server-side but not in PLAN_PRESETS — unreachable, or a hole`);
  }
  console.log('');
}

// Every preset must carry every limit key, or resolvePlan silently hands back undefined.
console.log('workspace/plan.js — limit completeness');
for (const [key, p] of Object.entries(PLAN_PRESETS)) {
  const missing = LIMITS.filter(k => !(k in p.limits));
  if (missing.length) fail(`${key}: missing limit key(s) ${missing.join(', ')}`);
}
console.log('');

// The picker must enumerate PLAN_PRESETS, never a literal list.
console.log('workspace/admin-m3.html — preset list is derived, not hardcoded');
const admin = await readFile(new URL('../workspace/admin-m3.html', import.meta.url), 'utf8');
const hard = admin.match(/\[\s*'(?:full|assess|one-off|self-serve|custom)'(?:\s*,\s*'[a-z-]+')+\s*\]/);
if (hard) fail(`hardcoded preset list ${hard[0]} — a new preset would ship invisible`);
if (!/Object\.keys\(PLAN\.PLAN_PRESETS\)/.test(admin)) fail('picker does not enumerate PLAN.PLAN_PRESETS');
for (const k of LIMITS) {
  const id = k === 'assessments' ? 'lim-assess' : k === 'builds' ? 'lim-build' : 'lim-prescreen';
  if (!admin.includes(`${id}\``) && !admin.includes(`'${id}'`)) fail(`custom editor has no field for ${k} (expected id ${id})`);
}

console.log('');

/* ──────────────────────────────────────────────────────────────────────────
   EVERY PRESET THAT GRANTS PRE-SCREENS CAN ACTUALLY CREATE ONE.

   Parity above proves the three copies of the licence model AGREE. It cannot
   prove the model is USED correctly, and that is where this failed in the
   field: `prescreens` is unlimited on all five presets and
   api/create-engagement.js honours it, but three create surfaces asked
   `defaultTier(plan)` — which reports what the LICENCE PREFERS — and then
   checked the allowance for that tier. Any org whose full-assessment allowance
   was zero or spent was shown "Plan limit reached" and no way forward, for a
   thing it was entitled to do free and without limit. The licence was right,
   the server was right, and the customer was still blocked.

   So: for every preset, at every usage level, if the plan grants a pre-screen
   then createableTier() must offer one. --self proves it can fail.
   ────────────────────────────────────────────────────────────────────────── */
/* VERDICTSCORE DOES NOT BUILD VENTURES.
   This product pre-screens and assesses; building becomes VentureStack, a separate product on the
   same architecture. A preset that grants `build` puts the other product's onboarding on this
   product's first screen — which is exactly what a full licensee saw: "Brief intake", "Hub seeding",
   "Agent wiring", "The Studio goes live". Nobody caught it because the only org that renders that
   screen is one with zero engagements, and the orgs we look at all have some.
   When VentureStack arrives it flips these booleans back; until then, false is the invariant. */
console.log('no VerdictScore preset grants the build capability');
for (const [key, def] of Object.entries(PLAN_PRESETS)) {
  if (def.capabilities && def.capabilities.build) fail(`preset '${key}' still grants build — that is VentureStack`);
  if (def.limits && def.limits.builds !== 0) fail(`preset '${key}' has a non-zero build allowance (${def.limits.builds})`);
}

console.log('every preset that grants pre-screens can create one');
const { resolvePlan, createableTier, canCreate, limitFor } = await import('../workspace/plan.js');
const SELF = process.argv.includes('--self');
const usedFull = n => Array.from({ length: n }, (_, i) => ({ engagementType: 'assessment', tier: 'full', id: 'f' + i }));

for (const key of Object.keys(PLAN_PRESETS)) {
  for (const spent of [0, 1, 5]) {
    const plan = resolvePlan({ plan: { preset: key, ...PLAN_PRESETS[key] } });
    const programs = usedFull(spent);
    // SELF breaks the derivation the way the bug did: prefer-tier only, no fallback.
    const got = SELF
      ? (canCreate(plan, programs, 'assessment', 'full').allowed ? 'full' : null)
      : createableTier(plan, programs);
    const entitled = canCreate(plan, programs, 'assessment', 'prescreen').allowed;
    if (entitled && !got) {
      fail(`${key} after ${spent} full assessment(s): grants pre-screens (limit ${
        limitFor(plan, 'assessment', 'prescreen') ?? 'unlimited'}) but createableTier() offers nothing`);
    }
  }
}
if (SELF) {
  console.log(fails ? '\n  ok  CANARY: the old prefer-tier-only logic is caught — the gate can fail'
                    : '\n  ✗   CANARY: the old logic PASSED — this gate is decoration');
  process.exit(fails ? 0 : 1);
}

console.log('');
console.log(fails ? `FAIL — ${fails} parity problem(s)` : 'PASS — the licence model agrees across client, admin API and create API, and no preset is blocked from the pre-screen it grants');
process.exit(fails ? 1 : 0);
