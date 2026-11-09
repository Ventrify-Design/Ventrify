#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// RUN TIMING — how long a pre-screen takes, stated once.
//
// The number is in ELEVEN files: three run buttons, the create screen, the running screen, the
// confirm dialog that stops someone starting a two-hour run by accident, three marketing cards in
// workspace-cards, the licence blurb, the shared document and the email that points at it. Nothing
// computes it — every one is hand-typed prose, which is why they were not all the same number before
// this gate existed.
//
// WHAT WENT WRONG, TWICE. The promise started at "about a minute", became "under three minutes" when
// the engine moved to standard speed, and became five on 2026-11-06 when the data-room read joined
// the run. Both times most call sites were updated and some were not: `plan.js` and the comment over
// runPrescreen in workspace-m3.js still said "~1-minute" nine months later — a third of the real
// figure, in the file that decides what a licence allows.
//
//  RULE 1 — ONE NUMBER. Any minute-duration stated in the same breath as the pre-screen must be the
//           one below. Engine internals that happen to mention minutes (token rate limits, the
//           runner heartbeat, FANOUT latency analysis) are not promises and are exempt by keyword.
//  RULE 2 — THE SURFACES THAT MUST SAY IT, DO. A missing promise is as bad as a wrong one: the
//           licensee who started a two-hour agentic run by mistake did so because neither button
//           said what it cost in time. These call sites are load-bearing and are checked by name.
//
// Run: node tools/run-timing.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');

// ── THE SOURCE OF TRUTH ──
const MINUTES = 5;
const WORD = 'five';

// Files that state the promise. Scanned in full, comments included: the comments ARE where the drift
// hid last time, and a stale comment is how the next person types the wrong number into new copy.
const SCAN = [
  'shared/entitlements.js', 'shared/m3/workspace-cards.js', 'shared/m3/ds.js',
  'shared/m3/workspace-chrome.css', 'workspace/workspace-m3.js', 'workspace/plan.js',
  'workspace/create-m3.html', 'workspace/prescreen-view.js', 'workspace/assess-next.html', 'api/send-email.js',
  'api/_prescreen.js', 'api/_prescreen2.js', '_redesign/m3/registry.js',
];

// Durations that are measurements or mechanics, not the promise. A line matching any of these is
// about how the machine behaves, not about what a licensee is told to expect.
const EXEMPT = /per minute|tokens|rate limit|heartbeat|beats every|RUN_BUDGET|timeout|poll|TTL|expire|cron|sweep/i;
// A duration inside straight quotes is a CITATION — "the promise was \"about a minute\"" is history,
// and rewriting history to match the present is how a decision log stops being worth keeping.
const QUOTED = (line, match) => {
  const i = line.indexOf(match);
  return i > 0 && (line.slice(0, i).split('"').length - 1) % 2 === 1;
};
// The CORRECTION re-read is a different operation from the pre-screen and has its own (unverified)
// duration. It mentions the pre-screen only to say it does not consume one.
const OTHER_OP = /re-?reads?|re-?runs?|correction|your version|doesn.t use up/i;

// "a minute" IS a duration claim and the first version of this gate did not think so, which is how
// the assess page's empty state went on promising "about a minute" through two revisions of the
// promise. It was found by looking at a screenshot. The article is in the alternation now.
const NUMBER = /\b(?:(?:~|about|under|in|roughly|approx\.?|approximately)\s*)?(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]minutes?\b/gi;
const PRESCREEN = /pre-?screen|triage read|quick read/i;
// THE FULL ASSESSMENT'S OWN DURATION. auditTiming's 4-line context window was safe on the explicit
// grounds that "the full tier's own duration is in hours, so widening the window cannot pull it in" —
// an assumption this change BROKE the moment hours became 90 minutes. Two of the three call sites put
// both products' durations within four lines of each other (ctaPair) or on the SAME line (the confirm
// dialog, which offers the pre-screen as the alternative). So the full figure is named once, here, and
// skipped by the pre-screen audit; auditFullAssessment owns it instead.
const FULL_DURATION = /\b(?:about\s+)?90\s*min(?:ute)?s?\b/i;

const WANT = new Set([String(MINUTES), WORD]);

function auditTiming(files) {
  const bad = [];
  for (const [rel, src] of files) {
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (EXEMPT.test(line) || OTHER_OP.test(line)) return;
      // THE WINDOW IS FOUR LINES BACK, not one. The first version looked at the previous line only and
      // missed TIER_COMPARISON.prescreen.time — a duration sitting three lines under the key that says
      // which tier it describes, which is the most-read cost line on the create screen. Four lines
      // covers an object literal and a wrapped comment; the full tier's own duration is in hours, so
      // widening the window cannot pull it in.
      const context = lines.slice(Math.max(0, i - 4), i + 2).join('\n');
      if (!PRESCREEN.test(context)) return;
      for (const m of line.matchAll(NUMBER)) {
        const n = String(m[1]).toLowerCase();
        if (FULL_DURATION.test(m[0])) continue;      // the full assessment's figure, not a pre-screen promise
        if (!WANT.has(n) && !QUOTED(line, m[0])) {
          bad.push(`RULE 1 — ${rel}:${i + 1} promises "${m[0].trim()}" for a pre-screen, not ${WORD} minutes`);
        }
      }
    });
  }
  return bad;
}

// RULE 2 — the five call sites a licensee actually reads a duration from, by exact string.
const REQUIRED = [
  ['shared/entitlements.js',        `cost: 'about ${MINUTES} minutes \u00b7 free'`, 'the run-button cost line (ctaPair)'],
  ['shared/entitlements.js',        `time: 'about ${MINUTES} minutes'`, 'the tier comparison'],
  ['shared/entitlements.js',        `~${MINUTES}-minute read`,       'the licence blurb'],
  ['workspace/create-m3.html',      `about ${WORD} minutes`,         'the create screen subheading'],
  ['workspace/workspace-m3.js',     `About ${WORD} minutes`,         'the running screen'],
  ['workspace/workspace-m3.js',     `about ${WORD} minutes and is free`, 'the two-hour confirm dialog'],
  ['workspace/prescreen-view.js',   `A ${WORD}-minute read, not an assessment`, 'the shared document'],
  ['api/send-email.js',             `a ${WORD}-minute read, not an assessment`, 'the share email'],
];

function auditSurfaces(map) {
  const bad = [];
  for (const [rel, needle, what] of REQUIRED) {
    if (!(map.get(rel) || '').includes(needle)) {
      bad.push(`RULE 2 — ${what} (${rel}) no longer says "${needle}"`);
    }
  }
  return bad;
}

const read = () => new Map(SCAN.map(rel => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')]));

if (CANARY) {
  const base = read();
  const mutate = (rel, from, to) => { const m = new Map(base); m.set(rel, (m.get(rel) || '').replace(from, to)); return m; };
  const checks = [
    ['an old number comes back in copy',
      auditTiming(mutate('shared/m3/workspace-cards.js', 'about five minutes', 'about three minutes')).length > 0],
    ['a comment drifts to ~1-minute',
      auditTiming(mutate('workspace/plan.js', '~5-minute triage', '~1-minute triage')).length > 0],
    ['a digit form drifts',
      auditTiming(mutate('shared/entitlements.js', `time: 'about ${MINUTES} minutes'`, "time: 'about 2 minutes'")).length > 0],
    ['the run button loses its cost line',
      auditSurfaces(mutate('shared/entitlements.js', `cost: 'about ${MINUTES} minutes \u00b7 free'`, "cost: 'free'")).length > 0],
    ['the shared document loses the label',
      auditSurfaces(mutate('workspace/prescreen-view.js', `A ${WORD}-minute read, not an assessment`, 'Pre-screen')).length > 0],
    ['the article form "about a minute"',
      auditTiming(new Map([['x', 'run the free pre-screen to see where it stands in about a minute.']])).length > 0],
    ['a rate-limit line is NOT flagged',
      auditTiming(new Map([['x', '// the pre-screen affords four categories a minute at 500k tokens per minute']])).length === 0],
    ['a QUOTED historical promise is NOT flagged',
      auditTiming(new Map([['x', ' * the pre-screen promise was "about a minute" at v2\'s first run']])).length === 0],
    ['the correction re-read is NOT flagged',
      auditTiming(new Map([['x', 'it re-reads in about a minute and doesn\'t use up your free pre-screen']])).length === 0],
    ['healthy tree clean', auditTiming(base).length === 0 && auditSurfaces(base).length === 0],
  ];
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(38)} ${ok ? 'caught' : 'MISSED'}`));
  [...auditTiming(base), ...auditSurfaces(base)].forEach(x => console.log(`      unexpected: ${x}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

// ── THE FULL ASSESSMENT'S DURATION, the same bug one product over ───────────────────────────────────
// This gate was written for the pre-screen's "five minutes" because that number drifted across eleven
// files twice. The FULL assessment's claim had drifted further and for longer: every surface said "about
// 2 hours" while no run had matched that since the October effort change.
//
//   runState.startedAt -> finishedAt, measured 2026-11-09:
//     all time                        n=13  median 85 min  (31-140)
//     since 2026-10-19, effort high   n=7   median 66 min  (38-128)   <- the current instrument
//
// 6 of 7 finished inside 90 minutes, so "90 minutes" is a conservative promise, not a target. It is a
// measurement of ONE instrument (model + effort + CLI, all pinned in claude-config.js): if any of those
// moves, re-measure rather than adjust by feel.
//
// Checked the same way as the pre-screen: no surface may still claim hours, and the surfaces that state
// a duration must state THIS one.
const FULL_WORD = '90 minutes';
const FULL_SCAN = ['shared/entitlements.js', 'shared/m3/ds.js', 'workspace/workspace-m3.js', 'workspace/assess-next.html'];
const HOURS = /\babout (?:2|two) hours\b|\btwo[- ]hour\b|\b2[- ]hour\b/i;

function auditFullAssessment(map) {
  const bad = [];
  for (const f of FULL_SCAN) {
    const src = map.get(f);   // read() returns a Map, not an object
    if (src == null) { bad.push(`${f} — not readable, so its duration claim is unchecked`); continue; }
    src.split('\n').forEach((line, i) => {
      // Comments here are the DECISION LOG for this very change and quote the old number on purpose.
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      const m = code.match(HOURS);
      if (m && !EXEMPT.test(code)) bad.push(`${f}:${i + 1} still promises "${m[0]}" — the measured median is 66 min`);
    });
  }
  // and at least one surface has to actually STATE the new number, or the gate would pass on a product
  // that simply stopped saying how long it takes.
  const states = FULL_SCAN.filter(f => (map.get(f) || '').includes(FULL_WORD));
  if (!states.length) bad.push(`no surface states "${FULL_WORD}" — the full assessment no longer tells anyone how long it takes`);
  return bad;
}

const files = read();
const problems = [...auditTiming(files), ...auditSurfaces(files), ...auditFullAssessment(files)];
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s): the product does not agree with itself about how long a run takes`
  : `  PASS — every pre-screen duration in ${SCAN.length} files reads ${WORD} minutes, all ${REQUIRED.length} surfaces still state it,\n         and no surface still promises the full assessment in hours (measured median: 66 min)`);
process.exit(problems.length ? 1 : 0);
