import { readFile } from 'node:fs/promises';
import admin from 'firebase-admin';
import * as DS from '../shared/m3/ds.js';
// ── THE FULL ASSESSMENT'S CASE AND CONDITIONS FOLD, AGAINST EVERY ASSESSMENT WE HAVE EVER PUBLISHED ──
//
// caseEditorial (bull/bear) and conditionsKill (mustBeTrue) now render claim-first folds, the same way
// the pre-screen's findings do. The risk is not that the markup is wrong — it is that the FEATURE IS
// INERT or DESTRUCTIVE on real prose: a claim that is a truncation, a point that loses text, or a list
// where nothing folds because no sentence break lands past the 40-character minimum.
//
// So this runs the real components over the real corpus and checks the three things that matter:
// nothing is lost, the split is a sentence rather than a cut, and enough points actually fold to be
// worth the mechanism. Rendering one invented string proves none of it — the first smoke test of this
// change "passed" with zero folds because the string's first sentence was thirteen characters long.

const env = await readFile('./.env.local', 'utf8');
const raw = (env.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m) || [])[1].trim().replace(/^"|"$/g, '');
let q = false, o = '';
for (let i = 0; i < raw.length; i++) { const c = raw[i];
  if (c === '"' && raw[i-1] !== '\\') { q = !q; o += c; continue; }
  if (c === '\\' && raw[i+1] === 'n') { o += q ? '\\n' : '\n'; i++; continue; } o += c; }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(o)) });
const db = admin.firestore();

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };
const strip = h => String(h).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

const docs = (await db.collection('engagements').get()).docs
  .map(d => d.data()).filter(x => x && x.assessment && x.assessment.recommendation);

let points = 0, folded = 0, truncated = [], lost = [], threw = [];
const classSizes = new Set();

for (const p of docs) {
  const A = p.assessment;
  const bull = Array.isArray(A.bull) ? A.bull : [];
  const bear = Array.isArray(A.bear) ? A.bear : [];
  const must = Array.isArray(A.mustBeTrue) ? A.mustBeTrue : [];

  let html = '';
  try {
    html = DS.caseEditorial({ bull, bear })
         + DS.conditionsKill({ mustBeTrue: must, biggestRisk: A.biggestRisk || null });
  } catch (e) { threw.push(`${p.name || p.company}: ${e.message}`); continue; }

  // The caret is a Material ligature, so its literal text ("expand_more") sits in the DOM BETWEEN the
  // claim and the rest. Strip the caret spans before reading the prose, or the point is never
  // contiguous and a correct fold reports as lost text — which is exactly what the first run of this
  // gate claimed, 137 times.
  const prose = strip(html.replace(/<span class="ps-car[^"]*"[^>]*>[^<]*<\/span>/g, ''));

  for (const t of [...bull, ...bear, ...must]) {
    points++;
    const { claim, rest } = DS.splitClaim(t);
    // RULE 1, as claim-split.mjs states it: claim + rest reconstructs the point exactly.
    const joined = rest ? `${claim} ${rest}` : claim;
    if (joined !== String(t).trim()) lost.push(`${(p.name || p.company || '?')}: text LOST on "${String(t).slice(0, 48)}…"`);
    // and BOTH halves have to reach the rendered page, not just the function.
    if (!prose.includes(strip(claim))) lost.push(`${(p.name || p.company || '?')}: claim missing from the render`);
    if (rest && !prose.includes(strip(rest))) lost.push(`${(p.name || p.company || '?')}: evidence half missing from the render`);
    if (rest) {
      folded++;
      // RULE 2, verbatim from claim-split.mjs: ; and — are documented boundaries, not truncations,
      // and an abbreviation is the case that actually reads as a cut. Inventing a stricter rule here
      // would have the two halves of one product disagreeing about what a sentence is.
      if (/\b(Inc|Ltd|U\.S|Dr|Mr|No|vs|approx|e\.g|i\.e)\.$/.test(claim)) truncated.push(`abbreviation: ${claim.slice(-40)}`);
      if (!/[.!?;—]$/.test(claim)) truncated.push(`cut mid-sentence: ${claim.slice(-50)}`);
    }
  }
  // Typography must not depend on whether the model wrote a second sentence: every point body carries
  // .ps-claim whether it folded or not. Count the shapes that appear.
  for (const m of html.matchAll(/<(p|span) class="ps-claim"/g)) classSizes.add(m[1]);
}

console.log(`\n  ${docs.length} published assessments · ${points} points rendered\n`);
ok(!threw.length, `nothing threw on any stored shape${threw.length ? ' — ' + threw[0] : ''}`);
ok(!lost.length, `every point's full text survives the fold${lost.length ? ` — ${lost.length} lost, e.g. ${lost[0]}` : ''}`);
ok(!truncated.length, `no claim is a mid-sentence truncation${truncated.length ? ` — e.g. "…${truncated[0]}"` : ''}`);
const pct = points ? Math.round(100 * folded / points) : 0;
ok(folded > 0 && pct >= 40, `the fold is not inert: ${folded}/${points} points fold (${pct}%)`);
ok(classSizes.size > 0 && classSizes.size <= 2, `one typographic rule for folded and unfolded alike (${[...classSizes].join(' + ')})`);

// ── degenerate shapes: the components must survive an assessment with nothing in these fields ──
for (const [label, a] of [
  ['no bull',        { bull: [], bear: ['A point that is long enough to carry a sentence break. And here is the rest of it.'] }],
  ['no bear',        { bull: ['A point that is long enough to carry a sentence break. And here is the rest of it.'], bear: [] }],
  ['nothing at all', { bull: [], bear: [] }],
]) {
  try { const h = DS.caseEditorial(a); ok(h.length > 0 && /cpt/.test(h), `caseEditorial survives "${label}"`); }
  catch (e) { ok(false, `caseEditorial THREW on "${label}": ${e.message}`); }
}
for (const [label, a] of [
  ['no conditions', { mustBeTrue: [], biggestRisk: null }],
  ['no kill-risk',  { mustBeTrue: ['One condition, stated plainly. And then the reasoning behind it.'], biggestRisk: null }],
]) {
  try { const h = DS.conditionsKill(a); ok(h.length > 0, `conditionsKill survives "${label}"`); }
  catch (e) { ok(false, `conditionsKill THREW on "${label}": ${e.message}`); }
}

// ── CANARY: a point whose text is dropped must be caught ──
const sabotage = DS.caseEditorial({ bull: ['Alpha beta gamma delta epsilon zeta. Eta theta iota kappa.'], bear: [] });
ok(strip(sabotage).includes('Eta theta iota kappa.'),
   'canary: the check reads the fold\'s HIDDEN half, not just the summary');

console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all checks passed\n');
process.exit(fails ? 1 : 0);
