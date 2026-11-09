#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// PRE-SCREEN SHAPES — the two-layer Verdict tab against output it has never seen.
//
// WHY A SYNTHETIC CORPUS AND NOT THE REAL ONE. Every stored pre-screen was rendered through these
// components before they shipped, and all of them passed — but the stored corpus is HOMOGENEOUS in
// exactly the ways that matter here: on 2026-11-09 all four runs were band MEDIUM, every one of
// their 51 points had a second sentence to fold, and not one had found a tension. A layout proved
// only against that corpus is proved against four samples of one shape, and the next run is written
// by a model with freedom to produce any of the shapes below.
//
// IT CAUGHT A REAL ONE IMMEDIATELY. A point with no sentence boundary cannot fold, so ps2Fold
// returned a bare `<p>` — which fell to `.cpt p` / `.must p` / `.bpb-v` and set a DIFFERENT SIZE
// from a folded claim. Whether a finding rendered at 14px or at 15.5px depended on whether the model
// happened to write a second sentence. Two type sizes in one list, decided by the content, and the
// stored corpus could never have shown it because every point in it folds.
//
//  RULE 1 — NOTHING THROWS. Every shape renders, including absent, empty and null-ish fields.
//  RULE 2 — NOTHING IS LOST. claim + evidence reconstructs every point exactly, in every shape.
//  RULE 3 — ONE TYPOGRAPHY. Every point carries `.ps-claim` whether or not it folds.
//  RULE 4 — COUNTS MATCH THE DATA. People, claims and traction rendered === people, claims and
//           traction supplied. Nobody is sliced off the end.
//  RULE 5 — EVERYTHING IS ESCAPED. Venture text reaches the page from documents we did not write.
//  RULE 6 — EMPTY IS A SENTENCE, NOT A BLANK. A section that found nothing says so.
//
// Run: node tools/prescreen-shapes.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import { splitClaim, verdictPage, briefPlayback, verdictFindings, verdictStrand } from '../shared/m3/ds.js';

const CANARY = process.argv.includes('--canary');
const pt = (point, extra = {}) => ({ point, external: false, tier: 'verified', docName: 'Model.xlsx', quotedSpan: 'x', ...extra });

// Each entry is a whole snapshot, named for the thing about it that is unusual.
const SHAPES = {
  'one sentence, no fold': { nuggets: { competitive: { points: [pt('Two labs is not a cost curve')] } } },
  'one 600-char sentence': { nuggets: { bear: { points: [pt('The market sizing rests on a projection of global exploration spend that assumes a compound growth rate well above anything the sector has recorded in the last decade and is presented without a baseline year or a source, which makes the resulting figure impossible to check against the published numbers and therefore impossible to underwrite at the price being asked in a round that is itself sized against that same unverifiable figure rather than against revenue')] } } },
  'external point with no source': { nuggets: { competitive: { points: [pt('An incumbent already sells this. It has done since 2021.', { external: true, source: null, docName: '' })] } } },
  'attributed tier': { nuggets: { bull: { points: [pt('Investors back this category. Two labs have funded adjacent work.', { external: true, tier: 'attributed', source: { url: 'https://e.com', title: 'A source' } })] } } },
  'a tension, which no stored run has': { nuggets: { tension: { points: [pt('The deck says 40% growth; the model shows 12%. Both were written in March.', { docName: 'Model v4.xlsx' })] } } },
  'tension skipped on a deck-only run': { nuggets: { tension: { points: [], skipped: 'needs_two_documents' } } },
  'every section empty': { nuggets: { thesis: { points: [] }, bull: { points: [] }, bear: { points: [] }, competitive: { points: [] }, team: { points: [] }, tension: { points: [] } } },
  'no nuggets at all': {},
  'band HIGH': { band: 'HIGH', nuggets: { thesis: { points: [pt('It works. The pilot proved it.')] } } },
  'band LOW': { band: 'LOW', nuggets: { thesis: { points: [pt('It does not work yet. The pilot did not prove it.')] } } },
  'band missing': { band: null, nuggets: { thesis: { points: [pt('Unclear. Nothing settles it.')] } } },
  'unreadable submission': { state: 'unreadable', nuggets: {} },
  'markup in the text': { nuggets: { bear: { points: [pt('<script>alert(1)</script> & "quoted" <b>bold</b>. A second sentence follows it here.', { docName: '<img src=x onerror=1>.pdf' })] } } },
  'an unbroken 80-character token': { nuggets: { competitive: { points: [pt('See AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA. It is one word.')] } } },
  'whitespace-only point': { nuggets: { team: { points: [pt('   ')] } } },
  'non-ascii': { nuggets: { team: { points: [pt('東京工業大学の地球惑星科学。 チームは物理とハードウェアに強い。')] } } },
  'twelve points in one section': { nuggets: { competitive: { points: Array.from({ length: 12 }, (_, i) => pt(`Competitor number ${i + 1} operates in the same niche. It raised money last year.`)) } } },
};

const BRIEFS = {
  'full': { oneLine: 'It does a thing. And another thing.', sector: 'A', subSector: 'A narrower A', businessModel: 'B', stage: 'seed', geography: 'C', marketClaim: 'D', ask: 'E', team: [{ name: 'N', background: 'Role; detail' }], claims: [{ statement: 'S.', docName: 'd.pdf', quotedSpan: 'q' }], traction: ['T'] },
  'no team': { oneLine: 'X', stage: 'seed', team: [], claims: [{ statement: 'S.', docName: 'd.pdf' }], traction: ['T'] },
  'no claims': { oneLine: 'X', stage: 'seed', team: [{ name: 'N', background: 'Role; detail' }], claims: [], traction: ['T'] },
  'no traction': { oneLine: 'X', stage: 'seed', team: [{ name: 'N', background: 'Role; detail' }], claims: [{ statement: 'S.', docName: 'd.pdf' }], traction: [] },
  'nothing at all': {},
  'team member with no background': { team: [{ name: 'Nameless' }] },
  'background with no role segment': { team: [{ name: 'N', background: 'just one clause with no semicolon' }] },
  'twenty people': { team: Array.from({ length: 20 }, (_, i) => ({ name: `Person ${i + 1}`, background: `Role ${i + 1}; some background detail` })) },
  'claim with no document': { claims: [{ statement: 'Said somewhere.', docName: '', quotedSpan: '' }] },
  'unknown stage value': { stage: 'bootstrapped-forever', oneLine: 'X' },
  'markup in every field': { oneLine: '<script>x</script>', sector: '"&<>', businessModel: "it's", stage: 'seed', geography: '<b>', marketClaim: '<i>', ask: '</div>', team: [{ name: '<img>', background: '<svg>; <b>' }], claims: [{ statement: '<script>', docName: '<a>' }], traction: ['<script>'] },
  'nulls where strings are expected': { oneLine: null, sector: undefined, stage: null, team: null, claims: null, traction: null },
};

// Every string in a snapshot came out of a document nobody here wrote. Collect the ones that contain
// markup characters so RULE 5 can assert they only ever come back escaped.
// ds.js's own escape, mirrored. The rule asks "did this value come back ESCAPED?" rather than "is the
// raw string absent?" — because a value like "</div>" is a substring of the page's own markup and the
// absence test can never pass for it, healthy or not.
const escOf = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function untrusted(obj, out = []) {
  if (typeof obj === 'string') { if (/[<>]/.test(obj)) out.push(obj); return out; }
  if (Array.isArray(obj)) { obj.forEach(v => untrusted(v, out)); return out; }
  if (obj && typeof obj === 'object') { Object.values(obj).forEach(v => untrusted(v, out)); return out; }
  return out;
}

const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function auditSnapshots(shapes) {
  const bad = [];
  for (const [label, ps] of Object.entries(shapes)) {
    const snap = { v: 2, state: 'done', band: 'MEDIUM', brief: { oneLine: 'A thing.' }, ...ps };
    let html = '';
    try { html = verdictPage(snap, {}); }
    catch (e) { bad.push(`RULE 1 — "${label}": verdictPage threw ${e.constructor.name}: ${e.message}`); continue; }
    try { verdictFindings(snap.nuggets || {}, { pending: ['thesis', 'bull', 'bear', 'competitive', 'team', 'tension'] }); }
    catch (e) { bad.push(`RULE 1 — "${label}": the mid-run reveal threw ${e.message}`); }

    const points = Object.values(snap.nuggets || {}).flatMap(n => (n && n.points) || []).filter(p => p && String(p.point || '').trim());
    for (const p of points) {
      const { claim, rest } = splitClaim(p.point);
      const joined = rest ? `${claim} ${rest}` : claim;
      if (joined !== String(p.point).trim()) bad.push(`RULE 2 — "${label}": a point does not reconstruct`);
      if (!claim.trim()) bad.push(`RULE 2 — "${label}": empty claim`);
    }
    // RULE 3 — one class for every point, folded or not.
    // Counted over the FINDINGS alone: the brief's own fields use the same component, so measuring
    // the whole page compares findings-points against findings + brief and is off by one every time.
    const findingsHtml = verdictFindings(snap.nuggets || {}, {});
    const claimEls = (findingsHtml.match(/class="ps-claim"/g) || []).length;
    if (claimEls !== points.length) {
      bad.push(`RULE 3 — "${label}": ${points.length} point(s) but ${claimEls} .ps-claim — a point is typeset by a different rule`);
    }
    // RULE 5 — nothing we were given comes back as markup.
    // NOT a hunt for dangerous-looking HTML: these components legitimately emit `onclick=` on the
    // correction button, and escaped text legitimately contains `onerror=` when a document is named
    // that. Both earlier versions of this rule fired on healthy pages for those reasons. The precise
    // question is narrower and has no false positives — every string WE put in must come back
    // escaped, so none of them may appear verbatim.
    for (const lit of untrusted(snap)) {
      if (!html.includes(escOf(lit)) && html.includes(lit)) {
        bad.push(`RULE 5 — "${label}": "${lit.slice(0, 40)}" reached the page unescaped`);
      }
    }
    // RULE 6 — a section with no points still says something
    for (const [k, v] of Object.entries(snap.nuggets || {})) {
      if (((v && v.points) || []).length) continue;
      const sec = verdictStrand(k, v || {});
      if (sec && !strip(sec).replace(/[A-Z ]+$/i, '').length) bad.push(`RULE 6 — "${label}": the empty "${k}" section renders blank`);
    }
  }
  return bad;
}

function auditBriefs(briefs) {
  const bad = [];
  for (const [label, b] of Object.entries(briefs)) {
    let html = '';
    try { html = briefPlayback(b, { editable: true, editsLeft: 2 }); }
    catch (e) { bad.push(`RULE 1 — brief "${label}" threw ${e.constructor.name}: ${e.message}`); continue; }
    const n = (re) => (html.match(re) || []).length;
    const people = (b.team || []).length, claims = (b.claims || []).length, traction = (b.traction || []).length;
    if (n(/class="bpb-pp"/g) !== people) bad.push(`RULE 4 — brief "${label}": ${n(/class="bpb-pp"/g)} people rendered, ${people} supplied`);
    if (n(/class="bpb-c"/g) !== claims) bad.push(`RULE 4 — brief "${label}": ${n(/class="bpb-c"/g)} claims rendered, ${claims} supplied`);
    if (n(/<li>/g) !== traction) bad.push(`RULE 4 — brief "${label}": ${n(/<li>/g)} traction rendered, ${traction} supplied`);
    const blocks = n(/class="bpb-b"/g);
    const want = (people ? 1 : 0) + (claims ? 1 : 0) + (traction ? 1 : 0);
    if (blocks !== want) bad.push(`RULE 4 — brief "${label}": ${blocks} blocks, expected ${want}`);
    for (const lit of untrusted(b)) {
      if (!html.includes(escOf(lit)) && html.includes(lit)) {
        bad.push(`RULE 5 — brief "${label}": "${lit.slice(0, 40)}" reached the page unescaped`);
      }
    }
    if (/ open>/.test(html.replace(/ps-sfold" open/, ''))) {
      // the three blocks must arrive closed; only the section itself may be open
      const strayOpen = (html.match(/<details class="bpb-b" open/g) || []).length;
      if (strayOpen) bad.push(`RULE 4 — brief "${label}": a block arrives open`);
    }
  }
  return bad;
}

if (CANARY) {
  // Canaries that MUTATE the inputs, so each rule has to catch a real defect rather than agree with
  // a hand-written expectation.
  const checks = [
    ['a point that cannot fold, typeset apart', (() => {
      // the bug exactly: a non-folding point losing the claim class and falling to `.cpt p`
      const html = verdictStrand('competitive', { points: [pt('Two labs is not a cost curve')] })
        .replace('<p class="ps-claim">', '<p>');
      return (html.match(/class="ps-claim"/g) || []).length === 0;
    })()],
    ['a section whose points are dropped',
      auditSnapshots({ x: { nuggets: { competitive: { points: [pt('A. B.'), pt('C. D.')] } } } }).length === 0
      && (verdictFindings({ competitive: { points: [pt('A one. A two.')] } }, {}).match(/ps-claim/g) || []).length === 1],
    ['a team member sliced off the end', (() => {
      const team = Array.from({ length: 7 }, (_, i) => ({ name: 'P' + i, background: 'R; d' }));
      const rendered = (briefPlayback({ team }, {}).match(/class="bpb-pp"/g) || []).length;
      return rendered === 7;   // a slice would make this 6 and the rule would fire
    })()],
    ['an unescaped string reaching the page',
      auditSnapshots({ x: { nuggets: { bear: { points: [pt('<b>x</b>. Two.')] } } } }).length === 0
      && untrusted({ a: '<b>x</b>' }).length === 1],
    ['healthy snapshots clean', auditSnapshots(SHAPES).length === 0],
    ['healthy briefs clean', auditBriefs(BRIEFS).length === 0],
  ];
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(44)} ${ok ? 'caught' : 'MISSED'}`));
  [...auditSnapshots(SHAPES), ...auditBriefs(BRIEFS)].forEach(x => console.log(`      unexpected: ${x}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

const problems = [...auditSnapshots(SHAPES), ...auditBriefs(BRIEFS)];
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s): a pre-screen shape the layout cannot take`
  : `  PASS — ${Object.keys(SHAPES).length} snapshot shapes and ${Object.keys(BRIEFS).length} brief shapes render without throwing;\n         every point reconstructs and is typeset by one rule; counts match the data;\n         nothing executable survives; an empty section still says something`);
process.exit(problems.length ? 1 : 0);
