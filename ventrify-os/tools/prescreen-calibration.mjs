#!/usr/bin/env node
// ============================================================
// prescreen-calibration — READ ONLY, FREE. Is the pre-screen reading less, or marking harder?
//
//   node tools/prescreen-calibration.mjs            → every venture that has BOTH
//   node tools/prescreen-calibration.mjs moneygym   → one venture
//
// A pre-screen and a full assessment score the SAME 35 signals from the same rubric, so where a venture
// has both we can put them side by side without spending anything. The two answers it separates:
//
//   · the pre-screen could not EVIDENCE what the full run could  → an evidence problem; more corpus helps
//   · both evidenced it and the pre-screen marked it LOWER       → a calibration problem; no amount of
//                                                                  document selection will ever fix it
//
// ⚠ THE TWO INSTRUMENTS DO NOT SHARE A SCALE. The full run scores each signal 0 / 0.5 / 1 (max 5 per
// category). The pre-screen scores 0–5 (max 25). Both then weight to a 0–100 composite, so both look
// internally consistent and neither reveals the mismatch on its own. Everything below is normalised to
// a PERCENTAGE OF EACH CATEGORY'S MAXIMUM, which is the only basis on which they are comparable.
// ============================================================
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const HERE = new URL('./', import.meta.url).pathname;
const BASE = HERE.replace(/tools\/$/, '');

// same .env.local reader as the containment gate
const src = readFileSync(BASE + 'tools/prescreen-containment.mjs', 'utf8');
const a = src.indexOf('function unquote('), b = src.indexOf('\n}\n', a) + 3;
const unquote = eval('(' + src.slice(a, b).replace('function unquote(', 'function (') + ')');
if (existsSync(BASE + '.env.local')) {
  for (const line of readFileSync(BASE + '.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/); if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    else if (v.startsWith('"') && v.endsWith('"')) v = unquote(v.slice(1, -1));
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.log('No Firebase credentials — see tools/prescreen-containment.mjs.'); process.exit(2); }

const admin = require(BASE + 'node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const PS = require(BASE + 'api/_prescreen.js');
const want = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ').toLowerCase();
const all = await db.collection('engagements').get();

// Group by venture name: the pre-screen and the full assessment are usually separate engagements.
const byVenture = new Map();
for (const d of all.docs) {
  const x = d.data();
  const base = String(x.name || '').replace(/\s*\d+$|\s*S\d+$/i, '').trim().toLowerCase();
  if (!base || (want && !base.includes(want))) continue;
  if (!byVenture.has(base)) byVenture.set(base, { pre: null, full: null });
  const slot = byVenture.get(base);
  if (x.prescreen && !slot.pre) slot.pre = { id: d.id, snap: x.prescreen };
  if (!x.prescreen) {
    const s = await d.ref.collection('investabilitySnapshots').get();
    if (s.size) {
      const latest = s.docs.sort((a, b) => String(b.id).localeCompare(String(a.id)))[0].data();
      if (!slot.full || (latest.composite || 0) > (slot.full.snap.composite || 0)) slot.full = { id: d.id, snap: latest };
    }
  }
}

const pct = (sum, max) => max ? Math.round((sum / max) * 100) : null;
let rows = 0;
for (const [name, { pre, full }] of byVenture) {
  if (!pre || !full) continue;
  rows++;
  const f = full.snap, p = pre.snap;
  console.log(`\n═══ ${name.toUpperCase()}  ·  full assessment ${f.composite}/100  vs  pre-screen ${p.floor}–${p.ceiling}\n`);
  console.log('  category     full%   pre-floor%   evidenced   gap(full − pre)');
  const fByKey = Object.fromEntries((f.categories || []).map(c => [c.key, c]));
  let gapSum = 0, n = 0;
  for (const pc of (p.categories || [])) {
    const fc = fByKey[pc.key]; if (!fc) continue;
    const fp = pct(fc.sum, fc.max);
    const pp = pc.floorPct;
    const gap = fp - pp; gapSum += gap; n++;
    console.log(`  ${pc.key.padEnd(11)} ${String(fp).padStart(4)}%  ${String(pp).padStart(9)}%   ${String(pc.evidenced + '/' + pc.of).padStart(8)}   ${(gap >= 0 ? '+' : '') + gap}`);
  }
  console.log(`\n  mean gap across categories: ${(gapSum / n).toFixed(1)} points`);

  // Signal level: where BOTH instruments evidenced the signal, what did each award?
  const fSig = {}; for (const c of (f.categories || [])) for (const sg of (c.subs || [])) fSig[sg.slug] = sg.score;
  let both = 0, preLower = 0, sumF = 0, sumP = 0;
  for (const c of (p.categories || [])) for (const sg of (c.signals || [])) {
    if (!sg.evidenced || fSig[sg.slug] == null) continue;
    both++;
    const fFrac = fSig[sg.slug];                 // already 0–1
    const pFrac = sg.score / 5;                  // 0–5 → 0–1
    sumF += fFrac; sumP += pFrac;
    if (pFrac < fFrac) preLower++;
  }
  if (both) {
    console.log(`\n  Of the ${both} signals BOTH instruments evidenced:`);
    console.log(`    full run awards   ${(sumF / both * 100).toFixed(0)}% of the available marks`);
    console.log(`    pre-screen awards ${(sumP / both * 100).toFixed(0)}%`);
    console.log(`    pre-screen scored LOWER on ${preLower} of ${both} (${Math.round(preLower / both * 100)}%)`);
    console.log(`\n    → ${sumP < sumF * 0.8 ? 'CALIBRATION: it is reading the same things and marking them harder.' : 'scales broadly agree; the gap is evidence, not marking.'}`);
  }
}
if (!rows) console.log('No venture has BOTH a pre-screen and a full assessment to compare.');
process.exit(0);
