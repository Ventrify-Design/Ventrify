import { adaptEngagement } from '../shared/m3/adapter.js';
import * as DS from '../shared/m3/ds.js';
// ── THE MASTHEAD HAS TO BE TRUE ───────────────────────────────────────────────────────────────────────
//
// Found 2026-11-09 while checking two assessments before a demo. Both said "Assessed just now" and both
// had been run three weeks earlier. `lastActivity` is a STORED STRING, written once at creation, and
// every engagement in the database holds the same value — "just now", 20 of 20. It could never have been
// right for anything except an assessment produced in the last minute.
//
// Alongside it: the venture mark beside the name came from `founderAvatar`, so "Holoclara" wore the
// founder's initial ("A") and "ORE (Outer Rim Exploration)" wore "FN" — seeded from the placeholder
// "Founder Name" that engagement was created with.
//
// And the Stability block: 0 of 28 stored snapshots carry a draw spread, so its empty state was its only
// state — a heading with "not recorded" under it on every assessment ever produced.
//
// None of these is a rendering fault you can see by reading the template. Each needs the real shape of
// the data, which is why this gate feeds the adapter the shapes that actually exist.

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };
const base = { name: 'Testco', stage: 'Seed', assessment: { recommendation: 'Diligence further' } };
const line = (p) => adaptEngagement({ ...base, ...p, investabilitySnapshot: null }).A.stageLine;
const mark = (p) => adaptEngagement({ ...base, ...p, investabilitySnapshot: null }).A.initials;

console.log('\n── the date is a measurement, not a stored word ──');
const THREE_WEEKS = new Date(Date.now() - 21 * 86400000).toISOString();
ok(!/just now/i.test(line({ lastActivity: 'just now', assessment: { recommendation: 'x', updatedAt: THREE_WEEKS } })),
   'a three-week-old assessment does NOT claim "just now"');
ok(/Assessed \d{1,2} \w{3} \d{4}/.test(line({ lastActivity: 'just now', assessment: { recommendation: 'x', updatedAt: THREE_WEEKS } })),
   `it prints the real date  [${line({ lastActivity: 'just now', assessment: { recommendation: 'x', updatedAt: THREE_WEEKS } })}]`);
ok(/today/.test(line({ lastActivity: 'just now', assessment: { recommendation: 'x', updatedAt: new Date().toISOString() } })),
   'an assessment published today says "today"');
// the three sources, in order of what the sentence claims
ok(/Assessed \d/.test(line({ runState: { finishedAt: THREE_WEEKS } })), 'falls back to when the RUN finished');
ok(/Assessed \d/.test(line({ updatedAt: THREE_WEEKS })),               'then to when the document changed');
ok(!/Assessed/.test(line({ lastActivity: 'just now' })),              'with NO timestamp it prints nothing rather than the placeholder');
ok(/Assessed ages ago/.test(line({ lastActivity: 'ages ago' })),       'a non-placeholder stored label is still honoured');

console.log('\n── the mark is the venture, and never punctuation ──');
for (const [n, want] of [['Holoclara', 'HO'], ['ORE (Outer Rim Exploration)', 'OR'], ['MoneyGym', 'MO']])
  ok(mark({ name: n }) === want, `${JSON.stringify(n)} → ${mark({ name: n })} (want ${want})`);
ok(mark({ name: 'ORE (Outer Rim Exploration)', founderName: 'Founder Name', founderAvatar: 'FN' }) === 'OR',
   'a placeholder founder never reaches the masthead');
ok(mark({ name: 'Holoclara', founderName: 'Antony', founderAvatar: 'A' }) === 'HO',
   'nor does a REAL founder — the mark belongs to the venture');
for (const n of ['Café Noir & Co.', '0x Labs', 'A', '', '(((', 'KreditMate 3'])
  ok(/^[\p{L}\p{N}]{1,2}$|^—$/u.test(mark({ name: n })), `${JSON.stringify(n)} → ${JSON.stringify(mark({ name: n }))} is 1–2 alphanumerics`);

console.log('\n── a block that can never fill does not render ──');
// The strip lives in verdictMemo's score dial (the Verdict tab), NOT investabilityHero — that one
// carries the radar. The first version of this check rendered the wrong component and could not have
// failed for the right reason.
const FULL = { ...base, assessment: {
  recommendation: 'Diligence further', thesis: 'A thesis.', biggestRisk: null, conviction: 'Medium',
  theAsk: '2m on a SAFE.', mustBeTrue: ['One thing must hold, and here is why it matters.'],
  bear: ['The bear case, stated plainly. And the evidence behind it.'],
  bull: ['The bull case, stated plainly. And the evidence behind it.'],
  diligence: [{ item: 'Confirm the pipeline.', priority: 'High' }],
  exit: { acquirers: ['Acme'], path: 'Trade sale.', returns: '3-5x' },
  market: { note: 'Growing.', tam: { label: 'TAM', value: '1bn' }, sam: { label: 'SAM', value: '200m' }, som: { label: 'SOM', value: '20m' } },
  team: { summary: 'Two founders.', gaps: [], members: [] },
  benchmark: { note: 'Mid-pack.', dimensions: ['Distribution'], competitors: [] },
  valuation: { note: 'Fair.', verdict: 'Fair.', comps: [] }, rounds: [],
  provenance: { marketReports: 3, competitors: 4, sources: 8, foundersResearched: true, rounds: 5 } } };
const snapNoDraws = { composite: 70, band: 'PROMISING', maxPossible: 100, pct: 70, ratedCount: 35,
  categories: [{ key: 'market', label: 'Market', weight: 0.2, sum: 3.5, max: 5, rated: 5, pending: 0, band: 'yellow', subs: [] }] };
const memo = (snap) => { const { A, S } = adaptEngagement({ ...FULL, investabilitySnapshot: snap }); return DS.verdictMemo(A, S); };

const dead = memo(snapNoDraws);
ok(!/not recorded/i.test(dead), 'no "draw spread not recorded" heading when there are no draws');
ok(!/>\s*Stability\s*</.test(dead), 'and no orphan "Stability" label either');
ok(/\b70\b/.test(dead), 'the score itself still renders');

const alive = memo({ ...snapNoDraws, draws: [68, 70, 73] });
ok(/Three blind draws/.test(alive), 'CANARY: with real draws the strip comes back of its own accord');
ok(/68/.test(alive) && /73/.test(alive), 'CANARY: and it shows the actual spread (68 · 70 · 73)');

console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all checks passed\n');
process.exit(fails ? 1 : 0);
