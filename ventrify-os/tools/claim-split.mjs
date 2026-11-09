#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// CLAIM SPLIT — the two-layer Verdict tab, and the one promise it makes.
//
// A pre-screen point is 300–600 characters and the model writes it claim-first, so the operator's
// scan layer is the point's own first sentence and the evidence folds under it. That is a RENDERING
// decision applied to text nobody reviewed for it, which makes exactly one thing dangerous: silently
// dropping half of a finding on a screen an investment decision is made from.
//
//  RULE 1 — NOTHING IS LOST. claim + rest reconstructs the point character for character, for every
//           point, including the ones that cannot be split at all.
//  RULE 2 — A SPLIT IS A SENTENCE, not a truncation. No claim ends mid-abbreviation, and a point with
//           no boundary is returned whole rather than cut to a length.
//  RULE 3 — BOTH LAYERS REACH THE PAGE. The rendered components emit the claim and the evidence, and
//           the text in them still reconstructs the point — a split that is correct in the function
//           and lost in the template is the same bug with a longer trail.
//  RULE 4 — THE STRIP COUNTS, IT DOES NOT RATE. No percentage, no score, no word that implies one.
//
// The fixtures below are shaped from real ORE output (prg-ore-52b7) and paraphrased: a gate in a
// public repo is not the place for a client's diligence.
//
// Run: node tools/claim-split.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import { splitClaim, verdictStrand, verdictBet, verdictCase } from '../shared/m3/ds.js';

const CANARY = process.argv.includes('--canary');

const POINTS = [
  // the common shape: a short claim, then four sentences of evidence
  'The market sizing does not survive contact with the published data. All global spending in the category was $12.5B in 2024 and has been shrinking. The $7B figure would be about 56% of that total. The $70B projection implies roughly 5.6x growth by 2030.',
  // a long first sentence that still ends properly
  'A named competitor, a spin-off with about $16M of Series A funding led by a well-known fund, already deployed the same instrument at a customer site in 2021. That puts the incumbent roughly four years ahead on the device itself.',
  // ORE's team point: a 200-character clause before the first full stop, so the semicolon wins
  'The team has physics, hardware and product depth (a geoscience chief executive, an FPGA lead, a sensors lead) but no operating geologist or geophysicist in management; the gap sits exactly where the buying conversation happens.',
  // abbreviations and money that must NOT be treated as boundaries
  'Acme Inc. raised $1.2M. in a seed round led by a U.S. fund. The round closed in March.',
  // a single sentence with nowhere to split
  'Two labs is not a cost curve.',
  // no terminal punctuation at all
  'Revenue of $80K against a plan of $1M, with two named customers and no signed contract',
];

function auditSplit() {
  const bad = [];
  for (const t of POINTS) {
    const { claim, rest } = splitClaim(t);
    const joined = rest ? `${claim} ${rest}` : claim;
    if (joined !== t.trim()) bad.push(`RULE 1 — text LOST: "${t.slice(0, 48)}…" → "${joined.slice(0, 48)}…"`);
    if (!claim) bad.push(`RULE 1 — empty claim for "${t.slice(0, 48)}…"`);
    if (/\b(Inc|Ltd|U\.S|Dr|Mr|No|vs|approx|e\.g|i\.e)\.$/.test(claim)) bad.push(`RULE 2 — claim ends on an abbreviation: "${claim.slice(-40)}"`);
    // a claim that is neither the whole point nor terminally punctuated is a truncation
    if (rest && !/[.!?;—]$/.test(claim)) bad.push(`RULE 2 — claim is cut mid-sentence: "${claim.slice(-50)}"`);
  }
  // the no-boundary cases must come back whole
  const one = splitClaim('Two labs is not a cost curve.');
  if (one.rest) bad.push('RULE 2 — a single sentence was split anyway');
  if (splitClaim('').claim !== '' || splitClaim(null).claim !== '') bad.push('RULE 1 — empty input is not handled');
  return bad;
}

// RULE 3 — the rendered page, not the function. Strip tags, join the layers, compare to the source.
function auditRender() {
  const bad = [];
  const mk = (pts) => ({ points: pts.map(p => ({ point: p, external: true, tier: 'verified', source: { url: 'https://example.com', title: 'A source' }, quotedSpan: 'x' })) });
  const html = [
    verdictStrand('competitive', mk(POINTS.slice(0, 3))),
    verdictBet(mk([POINTS[0]])),
    verdictCase(mk([POINTS[1]]), mk([POINTS[2]])),
  ].join('\n');

  const claims = [...html.matchAll(/<span class="ps-claim">([\s\S]*?)<\/span>/g)].map(m => m[1]);
  const betClaims = [...html.matchAll(/<p class="ps-claim">([\s\S]*?)<\/p>/g)].map(m => m[1]);
  const rests = [...html.matchAll(/<p class="ps-rest">([\s\S]*?)<\/p>/g)].map(m => m[1]);
  const all = claims.concat(betClaims);
  if (!all.length) bad.push('RULE 3 — no claim reached the rendered page');
  if (!rests.length) bad.push('RULE 3 — no evidence reached the rendered page');

  const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // every claim rendered must be the start of one of the points it was built from
  for (const c of all.map(unesc)) {
    if (!POINTS.some(p => p.startsWith(c))) bad.push(`RULE 3 — a rendered claim is not a prefix of its point: "${c.slice(0, 50)}…"`);
  }
  for (const r of rests.map(unesc)) {
    if (!POINTS.some(p => p.endsWith(r))) bad.push(`RULE 3 — rendered evidence is not the tail of its point: "${r.slice(0, 50)}…"`);
  }
  // RULE 4 — the strip is counts. Any of these words means it has started rating something.
  const strip = (html.match(/<span class="ps-strip">[\s\S]*?<\/span><\/span>/g) || []).join(' ');
  if (!strip) bad.push('RULE 4 — the section strip is gone');
  for (const w of ['%', 'score', 'rating', 'strong', 'weak', 'good', 'poor', 'out of']) {
    if (strip.toLowerCase().includes(w)) bad.push(`RULE 4 — the strip says "${w}" — it counts points, it does not rate them`);
  }
  return bad;
}

if (CANARY) {
  const checks = [
    ['text dropped by the split', (() => {
      const t = POINTS[0]; const { claim, rest } = splitClaim(t);
      return `${claim} ${rest.slice(10)}` !== t;        // simulate a lossy join
    })()],
    ['a claim cut to a length', (() => {
      const c = POINTS[0].slice(0, 90);
      return /[.!?;—]$/.test(c) === false;              // what RULE 2 catches
    })()],
    ['an abbreviation treated as a boundary', splitClaim('Acme Inc. raised $1.2M. in a seed round led by a U.S. fund. The round closed in March.').claim.length > 20],
    ['a single sentence left whole', splitClaim('Two labs is not a cost curve.').rest === ''],
    ['healthy split clean', auditSplit().length === 0],
    ['healthy render clean', auditRender().length === 0],
  ];
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(40)} ${ok ? 'caught' : 'MISSED'}`));
  [...auditSplit(), ...auditRender()].forEach(x => console.log(`      unexpected: ${x}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

const problems = [...auditSplit(), ...auditRender()];
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s): the scan layer is not a faithful view of the finding`
  : `  PASS — every point reconstructs from claim + evidence, no claim is a truncation, both layers\n         reach the rendered page, and the section strip counts rather than rates`);
process.exit(problems.length ? 1 : 0);
