import { readFile } from 'node:fs/promises';
import admin from 'firebase-admin';
import { parseSignalNote, signalNote } from '../shared/m3/ds.js';
// ── A SCORER'S NOTE IS EVIDENCE FOR A NUMBER IN AN INVESTMENT DECISION ────────────────────────────────
//
// parseSignalNote breaks a note into a lead, labelled blocks and the score rationale so the drill can
// render it as something an operator can scan. The danger is not that it parses badly — a bad parse is
// visible. It is that it parses LOSSILY: a clause silently absent from the panel is indistinguishable
// from a clause the scorer never wrote, and nobody would ever know which.
//
// So the invariant is NOTHING IS LOST, asserted over the whole real corpus rather than a fixture: every
// word of every stored note must survive into the parsed parts. 953 notes on 28 snapshots, median 1,308
// characters, longest 8,665 — including assessments that can never be re-run.
//
// Run: node tools/signal-note.mjs

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
const words = t => String(t).toLowerCase().match(/[a-z0-9][a-z0-9.$%/'-]*/g) || [];

const notes = [];
const snaps = [];
for (const d of (await db.collection('engagements').get()).docs)
  for (const s of (await d.ref.collection('investabilitySnapshots').get()).docs) {
    const x = s.data();
    const at = x.computedAt && x.computedAt.toDate ? x.computedAt.toDate().getTime() : Date.parse(x.computedAt || x.at || 0) || 0;
    const mine = [];
    for (const c of (x.categories || []))
      for (const sub of (c.subs || [])) if (sub.note) {
        const n = { eng: d.id, slug: sub.slug, note: String(sub.note) };
        notes.push(n); mine.push(n);
      }
    if (mine.length) snaps.push({ eng: d.id, at, notes: mine });
  }

const lost = [], structured = [], plain = [];
for (const n of notes) {
  const r = parseSignalNote(n.note);
  // EVERY field the parser produces, or the check reports its own blind spot as lost text — which is
  // exactly what adding `verdict` did: 34 notes "lost" words that were sitting in a field this line
  // did not read.
  const back = [r.lead, ...r.blocks.map(b => `${b.n ? `(${b.n}) ` : ''}${b.label} ${b.verdict || ''} ${b.body}`), r.conclusion].join(' ');
  const want = words(n.note), got = words(back);
  // multiset comparison: every word of the original, as many times as it appeared
  const bag = new Map();
  for (const w of got) bag.set(w, (bag.get(w) || 0) + 1);
  const missing = [];
  for (const w of want) { const c = bag.get(w) || 0; if (!c) missing.push(w); else bag.set(w, c - 1); }
  if (missing.length) lost.push({ ...n, missing: missing.slice(0, 6) });
  (r.plain || !r.blocks.length ? plain : structured).push(n);
}

console.log(`\n  ${notes.length} stored sub-signal notes\n`);
ok(lost.length === 0, lost.length
  ? `${lost.length} note(s) LOSE text — e.g. ${lost[0].slug}: ${lost[0].missing.join(' ')}`
  : 'every word of every note survives the parse');
const pct = Math.round(100 * structured.length / notes.length);
ok(pct >= 50, `${structured.length} of ${notes.length} notes (${pct}%) gain real structure; ${plain.length} render as before`);

// A FLOOR, NOT A HEURISTIC. The first version of this assertion looked for two ALLCAPS words before an
// em-dash and demanded they become blocks. It was wrong, and the parser was right: in "a third party
// holds the core IP — and no primary record asserting NOT-X —" the dashes are PUNCTUATION and IP / NOT-X
// are ordinary words in a sentence. It reported 33 failures, every one of them the gate's own mistake.
//
// There is no non-tautological way to assert "found the structure that is there" — any precise rule is
// just the parser restated. So this records what parsing ACHIEVES on the real corpus, as a floor. A
// change that breaks the parser drops the number and fails; a change that improves it has to move the
// floor up deliberately.
const STRUCTURED_FLOOR = 490;   // MEASURED 2026-11-09: 498 of 953. Set just below, so noise does not fail it.
ok(structured.length >= STRUCTURED_FLOOR,
   `${structured.length} notes structured — floor is ${STRUCTURED_FLOOR}`);

// ── AND THE NEWEST RUN ON ITS OWN ───────────────────────────────────────────────────────────────────
// Both checks above are over the WHOLE corpus, which only ever grows — so a run that wrote entirely
// unstructured notes would be DILUTED into passing: 498 of 953 becomes 498 of 988, the rate slips from
// 52% to 50.4%, and nothing fails for months. The markers this parser reads are an emergent habit of
// the scorer, not a contract the prompt enforces, so drift is a real possibility and a slow alarm is
// the same as none.
//
// The newest snapshot is ~35 notes, which is a noisy sample, so this is deliberately lenient: it is
// looking for a COLLAPSE (a model or prompt that stopped marking sections at all), not a wobble.
const newest = snaps.sort((a, b) => b.at - a.at)[0];
if (newest) {
  const ns = newest.notes.filter(n => { const r = parseSignalNote(n.note); return !r.plain && r.blocks.length; }).length;
  const npct = Math.round(100 * ns / newest.notes.length);
  const when = newest.at ? new Date(newest.at).toISOString().slice(0, 10) : 'undated';
  ok(npct >= 25, `newest run (${newest.eng}, ${when}): ${ns} of ${newest.notes.length} notes structured (${npct}%) — a collapse below 25% means the scorer stopped marking sections`);
}

// ── THE HEAD IS THE ONLY LINE MOST OPERATORS WILL READ ──────────────────────────────────────────────
// It is the answer, lifted out of a 1,300-character note, and it must not stop mid-phrase. splitClaim
// may cut at a semicolon — fine in a finding, wrong in "…Jeremiah Anderson (CEO;" where it leaves a
// bracket hanging. snHead keeps taking sentences until the brackets close.
let heads = 0, unclosed = 0, empty = 0;
for (const n of notes) {
  const h = (signalNote(n.note).match(/class="sn-head">([^<]*)</) || [])[1] || '';
  heads++;
  if (!h.trim()) empty++;
  let d = 0; for (const ch of h) { if (ch === '(') d++; else if (ch === ')') d--; }
  if (d > 0) unclosed++;
}
ok(empty === 0, `every one of the ${heads} notes renders a head${empty ? ` — ${empty} empty` : ''}`);
ok(unclosed <= 5, `${unclosed} head(s) end on an unclosed bracket (was 1 in 5 before snHead; allow 5)`);

// ── the shapes that must not break ──
const cases = [
  ['empty',           '',                                                       r => r.plain && !r.lead],
  ['null',            null,                                                     r => r.plain],
  ['one sentence',    'No evidence for this was found.',                        r => r.plain && r.lead === 'No evidence for this was found.'],
  ['conclusion only', 'Both components present => 1.0.',                        r => !!r.conclusion && !r.blocks.length],
  ['labels only',     'ALPHA — first thing. BETA — second thing.',               r => r.blocks.length === 2],
  ['lowercase trap',  'The ceo said the market is big and that is that.',        r => r.plain],
  ['acronym trap',    'The CEO and the CFO met. They agreed.',                   r => r.plain],
];
for (const [label, input, test] of cases) {
  let r = null, threw = null;
  try { r = parseSignalNote(input); } catch (e) { threw = e.message; }
  ok(!threw && test(r), `${label}${threw ? ` THREW: ${threw}` : ''}`);
}

// ── CANARY: a parser that drops a clause must be caught ──
const sabotage = (note) => { const r = parseSignalNote(note); if (r.blocks[0]) r.blocks[0].body = ''; return r; };
const victim = notes.find(n => parseSignalNote(n.note).blocks.length >= 2);
if (victim) {
  const r = sabotage(victim.note);
  const back = [r.lead, ...r.blocks.map(b => `${b.label} ${b.body}`), r.conclusion].join(' ');
  const bag = new Map(); for (const w of words(back)) bag.set(w, (bag.get(w) || 0) + 1);
  let missing = 0;
  for (const w of words(victim.note)) { const c = bag.get(w) || 0; if (!c) missing++; else bag.set(w, c - 1); }
  ok(missing > 0, `canary: a parser that empties a block is detected (${missing} words missing)`);
} else ok(false, 'canary: no multi-block note in the corpus to sabotage');

console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all checks passed\n');
process.exit(fails ? 1 : 0);
