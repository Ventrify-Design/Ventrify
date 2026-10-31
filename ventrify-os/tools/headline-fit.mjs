#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   HEADLINE FIT — the first line of the page is always a whole sentence.

   WHY THIS EXISTS. `fitHeadline` clips a model-written reason to a word budget
   so it fits the hero at 44px. When the clipped span held no full stop, dash or
   semicolon it fell through to a raw word-count cut and welded a full stop onto
   whatever word happened to be there. On a real pre-screen that published:

       "A real wedge into a market that is already paying for the."

   set at 44px, as the first thing a paying customer reads. No gate saw it: the
   markup was valid, the classes were styled, the page conformed, the contrast
   passed. It is only wrong as ENGLISH, and nothing here was reading the English.

   WHAT IT CHECKS. Every headline this function can emit is a sentence that
   ends: terminal punctuation, and a last word that can legally carry it. The
   corpus is generated — the same reason truncated at every budget from 4 words
   up — so it covers the cut landing on each word in turn rather than the three
   examples somebody thought of.

     node tools/headline-fit.mjs          the real check
     node tools/headline-fit.mjs --self   prove the gate can fail
   ════════════════════════════════════════════════════════════════════════════ */
import { fitHeadline } from '../shared/m3/ds.js';

const SELF = process.argv.includes('--self');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

/* Real sentences, in the register the model actually writes in: long, comma-heavy,
   and frequently with no full stop anywhere near the budget. */
const CORPUS = [
  'A real wedge into a market that is already paying for the problem today, held back by a team with no commercial hire yet and pricing that assumes a buyer nobody has signed.',
  'A capable team against a real problem but the unit economics are unproven and the moat is still forming which makes this a price question rather than a quality one for now.',
  'Strong traction. The unit economics are the open question and they are the whole investment case here for anyone writing a cheque this quarter at this valuation.',
  'Proceed to diligence — not to a cheque — because the shape of the risk is clear enough to price even though the moat is unproven and the team is thin on commercial.',
  'Real demand proved by two paying pilots, pricing that assumes a buyer nobody has yet signed, and a plan that has no commercial hire in it before month nine of the raise.',
  'The case needs work before it is worth the full read: the market is sized top-down from an analyst total and every revenue line in the model depends on that one number.',
  'Worth assessing now; the wedge is real, the buyer is identified and already paying for the workaround, and the only open question is whether the price survives contact.',
];

/* A word that cannot end a sentence. Deliberately a SEPARATE list from the one inside fitHeadline:
   a gate that imports the implementation's own list cannot catch a hole in it. */
const CANNOT_END = new Set(('the a an this these those its their his her our your my and or but so if when ' +
  'while then than because although though of to in on for with by from at as into onto over under about ' +
  'after before between through across without within upon per via against that which who whom whose it ' +
  'they we he she you there here one is are was were be been being has have had will would can could ' +
  'should may might must do does did not no very more most much many such').split(' '));

const judge = (label, out, src) => {
  const t = String(out).trim();
  if (!/[.!?]$/.test(t)) return `${label}: no terminal punctuation — "${t}"`;
  const last = t.replace(/[.!?]+$/, '').split(/\s+/).pop().toLowerCase().replace(/[^a-z'’-]/g, '');
  if (CANNOT_END.has(last)) return `${label}: ends on "${last}" — "${t}"`;
  if (/\s[,;:—-]\s*[.!?]$/.test(t)) return `${label}: punctuation collision — "${t}"`;
  void src;
  return null;
};

console.log('\n1. EVERY BUDGET, EVERY SENTENCE — the cut lands on each word in turn');
const bad = [];
let n = 0;
for (const src of CORPUS) {
  const total = src.split(' ').length;
  for (let budget = 4; budget <= total; budget++) {
    n++;
    const err = judge(`budget ${budget}`, fitHeadline(src, '', budget), src);
    if (err) bad.push(err);
  }
}
ok(!bad.length, bad.length
  ? `${bad.length} of ${n} truncations do not read as a sentence:\n` + bad.slice(0, 8).map(b => '        ' + b).join('\n')
  : `all ${n} truncations end as a sentence (terminal mark + a word that can carry it)`);

console.log('\n2. THE BUDGET IS RESPECTED, AND A SHORT HEADLINE IS LEFT ALONE');
ok(CORPUS.every(s => fitHeadline(s, '', 12).split(' ').length <= 12), 'never exceeds the word budget');
ok(fitHeadline('A short headline that fits fine.', '', 12) === 'A short headline that fits fine.',
   'a headline inside the budget is returned untouched');
ok(fitHeadline(CORPUS[0], 'An authored fallback.', 6) === 'An authored fallback.',
   'an authored fallback still beats any clipped sentence');
ok(fitHeadline('**Bold** and `code` leak from the model.', '', 20) === 'Bold and code leak from the model.',
   'markdown the model leaks is still stripped');

if (SELF) {
  // The canary is the exact string the bug shipped. If judge() passes this, the gate is decoration.
  const caught = judge('canary', 'A real wedge into a market that is already paying for the.') !== null;
  console.log(caught ? '\n  ok  CANARY: the shipped bad headline is rejected — the gate can fail'
                     : '\n  ✗   CANARY: the shipped bad headline PASSED — this gate is decoration');
  process.exit(caught ? 0 : 1);
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
