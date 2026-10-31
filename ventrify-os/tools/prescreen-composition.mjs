#!/usr/bin/env node
// ============================================================
// prescreen-composition — the structural gate against the v1 relapse.
//
// Spec §9, gate 4. It asserts ONE thing: a minimum share of the findings a run ships must rest on a
// source OUTSIDE the customer's own documents.
//
// This is the gate that most directly prevents the failure v2 exists to fix. A pre-screen can regress
// into an audit without a single forbidden word, simply by shipping six cards of observations about the
// customer's own files. Every point would be verified, every sentence would pass the vocabulary gate,
// and the output would be an audit again — because the customer already knows everything in it.
//
// WHEN IT FAILS, THE FIX IS BETTER RESEARCH, NEVER PADDING. Lowering the floor to make it pass is the
// same decision as abandoning the feature's premise.
//
// Usage:
//   node tools/prescreen-composition.mjs                       # free self-test of the rule
//   node tools/prescreen-composition.mjs <snapshot.json>       # check one real run
//   node tools/prescreen-composition.mjs --live                # every v2 snapshot in Firestore
//
// --live needs credentials and reads only; it never calls a model and so costs nothing.
// ============================================================
import { readFile } from 'node:fs/promises';

// At least this share of shipped points must be external. Two of six nugget kinds are inherently
// internal (team, tension) and `thesis` is a synthesis, so a healthy run lands well above this — the
// floor is set where "the research phase produced nothing usable" becomes true, not where it becomes
// uncomfortable.
const MIN_EXTERNAL_SHARE = 0.25;
// A run that ships almost nothing cannot be judged on proportions; one external point out of two is not
// evidence of health. Below this the gate reports thin instead of passing on a technicality.
const MIN_POINTS = 4;

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

/** The whole rule, as a pure function so it can be proven without a run. */
export function composition(snapshot = {}) {
  const points = [];
  for (const [kind, slot] of Object.entries(snapshot.nuggets || {})) {
    for (const p of (slot.points || [])) points.push({ ...p, kind });
  }
  const external = points.filter(p => p.external && p.source && /^https?:\/\//i.test(String(p.source.url || '')));
  const share = points.length ? external.length / points.length : 0;
  return {
    total: points.length, external: external.length, share,
    thin: points.length < MIN_POINTS,
    // An unreadable run ships nothing by design (§3.3) and is not a composition failure.
    exempt: snapshot.state === 'unreadable',
    pass: snapshot.state === 'unreadable' || (points.length >= MIN_POINTS && share >= MIN_EXTERNAL_SHARE),
    sources: (snapshot.sources || []).length,
  };
}

const report = (label, snapshot) => {
  const c = composition(snapshot);
  if (c.exempt) { console.log(`  --  ${label}: unreadable submission, exempt by §3.3`); return; }
  const pct = Math.round(c.share * 100);
  if (c.thin) {
    ok(false, `${label}: only ${c.total} point(s) shipped — too thin to judge, and too thin to sell`);
    return;
  }
  ok(c.pass, `${label}: ${c.external}/${c.total} findings external (${pct}%, floor ${MIN_EXTERNAL_SHARE * 100}%)`
     + (c.pass ? '' : ` — ${c.sources} public source(s) were harvested; the fix is better research, not padding`));
};

const arg = process.argv[2];

if (!arg) {
  // ── FREE SELF-TEST ────────────────────────────────────────────────────────────────────────────────
  // Proves the rule itself, so the gate is known-good before a real snapshot ever reaches it.
  console.log('\nSELF-TEST — the rule, on synthetic snapshots (no credentials, no spend)');
  const ext = (n) => Array.from({ length: n }, (_, i) => ({ point: 'p' + i, external: true, source: { url: 'https://e.com/' + i } }));
  const int = (n) => Array.from({ length: n }, (_, i) => ({ point: 'q' + i, external: false, docName: 'deck.pdf' }));

  const audit = { nuggets: { team: { points: int(6) }, bear: { points: int(4) } } };
  ok(!composition(audit).pass, 'a run of nothing but observations about the customer\'s own files FAILS — that is an audit');

  const healthy = { nuggets: { competitive: { points: ext(3) }, bull: { points: ext(1).concat(int(2)) }, team: { points: int(3) } } };
  const h = composition(healthy);
  ok(h.pass, `a run with real outside-in findings passes (${h.external}/${h.total}, ${Math.round(h.share * 100)}%)`);

  ok(!composition({ nuggets: { bull: { points: ext(1).concat(int(1)) } } }).pass,
     'two points, one external, does not pass on a technicality');
  ok(composition({ state: 'unreadable', nuggets: {} }).exempt,
     'an unreadable submission is exempt, not a failure');
  ok(!composition({ nuggets: { competitive: { points: [{ point: 'x', external: true, source: { url: 'notaurl' } }].concat(int(5)) } } }).pass,
     'a malformed source URL does not count as external');
  ok(composition({}).total === 0, 'an empty snapshot reports nothing rather than throwing');

  console.log(fails ? `\n${fails} check(s) failed` : '\nself-test passed — the rule is sound; run it against a real snapshot to measure a run');
  process.exit(fails ? 1 : 0);
}

if (arg === '--live') {
  console.log('\nLIVE — every v2 snapshot in Firestore (read-only, no model calls)');
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    const sa = JSON.parse(await readFile(new URL('../service-account.json', import.meta.url), 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const snap = await admin.firestore().collection('engagements').get();
  let seen = 0;
  for (const d of snap.docs) {
    const s = d.data().prescreen2;
    if (!s || s.v !== 2) continue;
    seen++;
    report(d.data().name || d.id, s);
  }
  if (!seen) console.log('  --  no v2 snapshots yet. Nothing to measure; this is not a failure.');
  console.log(fails ? `\n${fails} run(s) failed composition` : '\nall runs passed');
  process.exit(fails ? 1 : 0);
}

console.log('\nFILE — ' + arg);
report(arg.split('/').pop(), JSON.parse(await readFile(arg, 'utf8')));
console.log(fails ? `\n${fails} check(s) failed` : '\npassed');
process.exit(fails ? 1 : 0);
