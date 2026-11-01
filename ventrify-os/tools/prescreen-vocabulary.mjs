#!/usr/bin/env node
// ============================================================
// prescreen-vocabulary — the gate that stops a readiness verdict decaying back into a document score.
//
// This is the cheapest gate in the suite and the one most likely to earn its keep, because the failure it
// catches is a SLOW one. The argument for v2 was that the pre-screen must judge the venture's case, not
// the completeness of its data room (spec §3) — and the way that argument dies is not a decision anybody
// makes. It is one sentence at a time: "we couldn't find your cap table", "financials not provided",
// "incomplete market data". Six months on, the dial is a completeness score with a nicer face, and
// nobody can point at the commit where it happened.
//
// So the vocabulary is enforced rather than remembered. Document-centric language belongs in the
// COVERAGE panel, which exists precisely to say what we can and cannot see (§3.4), and nowhere else.
//
// Everything here is free: it reads files and nothing else.
// ============================================================
import { readFile } from 'node:fs/promises';

const BASE = new URL('../', import.meta.url);
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

// The words that turn a verdict into an audit. Each one is a real sentence pattern from v1's output.
const FORBIDDEN = [
  /\bmissing\b/i, /\bnot provided\b/i, /\bno evidence of\b/i, /\bincomplete\b/i,
  /\bnot supplied\b/i, /\bfailed to (provide|supply|include)\b/i, /\babsent from\b/i,
  /\bdidn['’]t (provide|supply|upload|give us)\b/i, /\bwe (can|could)n['’]t find your\b/i,
];
// Language that penalises a thin upload rather than disclosing it (§3.2).
const PENALISING = [/\bonly (gave|supplied|uploaded|provided)\b/i, /\binsufficient\b/i, /\btoo few document/i];

// SCAN THE COPY, NOT THE PROSE ABOUT THE COPY. The first version of this gate failed on its own
// documentation: the comment in ds.js quotes the forbidden words in order to forbid them, and so does
// the one instruction in bandPrompt. A gate that cannot tell rendered text from a comment explaining
// the rule will be switched off within a week, which is worse than not having it.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ')
  .replace(/([^:'"\`])\/\/.*$/gm, '$1');

const slice = (src, from, to) => {
  const i = src.indexOf(from);
  if (i < 0) return '';
  const j = to ? src.indexOf(to, i) : -1;
  return src.slice(i, j < 0 ? src.length : j);
};

const scan = (name, text, patterns, why) => {
  const hits = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      // Report with context, because the word alone does not tell you which sentence to fix.
      const at = text.indexOf(m[0]);
      hits.push(`"${m[0]}" in …${text.slice(Math.max(0, at - 48), at + 48).replace(/\s+/g, ' ').trim()}…`);
    }
  }
  ok(!hits.length, `${name}: ${why}${hits.length ? '\n        ' + hits.join('\n        ') : ''}`);
};

console.log('\n1. THE INSIGHT COMPONENTS (shared/m3/ds.js, the v2 block)');
const ds = await readFile(new URL('shared/m3/ds.js', BASE), 'utf8');
const v2 = slice(ds, 'PRE-SCREEN v2 — the flavour, not the audit');
ok(v2.length > 2000, 'the v2 component block is present and findable');
// nuggetCard's one legitimate near-miss is "conspicuously absent", which is a finding ABOUT A TEAM, not
// about a document. The patterns are written to allow it: `absent from` is forbidden, `absent` is not.
const v2copy = stripComments(v2);
scan('ds.js v2 block', v2copy, FORBIDDEN, 'no document-centric language in the verdict, brief or findings');
scan('ds.js v2 block', v2copy, PENALISING, 'and nothing that penalises a thin upload');

console.log('\n2. THE PROMPTS (api/_prescreen2.js) — the model must not be ASKED for that language');
const eng = await readFile(new URL('api/_prescreen2.js', BASE), 'utf8');
const bandPrompt = slice(eng, 'function bandPrompt', 'function bandRequest');
// bandPrompt names the forbidden words exactly once, in the line that forbids them. That line is
// asserted separately and then removed, so everything else in the prompt is held to the rule.
const FORBIDS = 'Do not mention missing, absent or incomplete documents.';
ok(bandPrompt.includes(FORBIDS), 'the prompt forbids document-centric reasons in terms');
scan('bandPrompt', stripComments(bandPrompt).replace(FORBIDS, ''), FORBIDDEN,
     'and says nothing of the kind itself');
const basis = stripComments(slice(eng, 'function basisLine', 'module.exports'));
scan('basisLine', basis, FORBIDDEN.concat(PENALISING), 'the basis line discloses, never apologises');

console.log('\n3. THE BAND COPY ITSELF — none of the three sentences may mention a document');
const copy = stripComments(slice(eng, 'const BAND_COPY', 'function expectedBandFor'));
scan('BAND_COPY', copy, FORBIDDEN.concat(PENALISING), 'clean');
ok(!/\bdocument|\bdata ?room|\bupload|\bfile\b/i.test(copy),
   'and none of them mentions documents at all, in any wording');

console.log('\n4. NO RANGE VOCABULARY SURVIVES IN THE v2 SURFACE');
// The range is retired (§2). A stray "floor"/"ceiling"/"range is N points wide" would be v1 bleeding
// through into a page that no longer computes one.
const RANGE_WORDS = [/\bfloor\b/i, /\bceiling\b/i, /points wide\b/i, /\bscore range\b/i, /out of 100\b/i,
                     /\blow end\b/i, /\bhigh end\b/i];
scan('ds.js v2 block', v2copy, RANGE_WORDS, 'the retired range vocabulary is gone');
scan('api/_prescreen2.js', stripComments(eng), RANGE_WORDS,
     'and the engine does not compute or name one (comments excluded — they explain the history)');

console.log('\n4b. THE COPY THAT SELLS THE PRE-SCREEN — the screen a free-tier customer sees FIRST');
/* ⚠ WHY THIS SECTION EXISTS. Sections 1–4 scan ds.js's v2 component block and the engine's prompts.
   The free tier's onboarding steps live in neither, and for a fortnight after the range was retired
   step 3 still read "A score range — the low end is what your documents prove today; the high end is
   what they become if the gaps close." The first screen a free-tier customer sees was still selling
   the instrument the entire pivot removed, and the gate written to stop exactly that was looking at
   two other files. A gate is only as wide as the paths it reads. */
const cards = await readFile(new URL('shared/m3/workspace-cards.js', BASE), 'utf8');
const steps = stripComments(slice(cards, 'const prescreenSteps', '];'));
ok(steps.length > 200, 'the free tier\u2019s onboarding steps are present and findable');
scan('prescreenSteps', steps, RANGE_WORDS, 'the retired range is not still being sold on the first screen');
scan('prescreenSteps', steps, FORBIDDEN.concat(PENALISING), 'and the steps do not penalise a thin upload');

console.log('\n5. COVERAGE KEEPS ITS OWN VOICE (§3.4) — this is where that language IS allowed');
const cov = slice(ds, 'export function dataRoomHero', 'export function roomScanBanner');
ok(cov.length > 400, 'dataRoomHero is still present — coverage was demoted, not deleted');
ok(/not seen|unlocks|coverage/i.test(cov), 'and still says what it cannot see, which is its whole job');

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
