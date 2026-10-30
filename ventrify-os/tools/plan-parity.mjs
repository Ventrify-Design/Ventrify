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
console.log(fails ? `FAIL — ${fails} parity problem(s)` : 'PASS — the licence model agrees across client, admin API and create API');
process.exit(fails ? 1 : 0);
