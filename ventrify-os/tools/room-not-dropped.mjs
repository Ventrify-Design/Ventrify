#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ROOM NOT DROPPED — a linked data room must reach the run.
//
// THE BUG THIS EXISTS FOR. The create screen let an operator paste a Google Drive folder link and
// also offered a "Read data room" button. The pasted link was consumed by exactly ONE function —
// that button's handler. Neither run path referenced it. So pasting a link and pressing Run ran the
// whole assessment on the pitch deck alone, read nothing from the folder, and said nothing about it:
// no warning, no toast, and no trace on the engagement that a data room had ever been named.
//
// Nothing could have caught it. The markup was right, the handler was right, the run was right; the
// defect was a value that simply had no second reader. That is what this gate looks for.
//
//  RULE 1 — EVERY RUN PATH READS THE ROOM BEFORE IT COMMITS. In each run entry point, the evidence
//           read must appear, carry a folder URL, and come BEFORE the terminal call (dispatchRun for
//           the assessment, runPrescreen2 for the pre-screen). Order matters on its own: the runner
//           must never start against a half-filled room.
//
//  RULE 2 — THE SKIPPABLE STEP STAYS GONE. No "Read data room" control may return to the create
//           screen. The moment it does, the run becomes optional again and so does the room.
//
//  RULE 3 — THE LINK IS RECORDED AT CREATE. The read runs in the browser, so a closed tab must still
//           leave the folder on the engagement, or an interrupted run loses the room with no way back.
//
// Run: node tools/room-not-dropped.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');

const RUNNER = 'workspace/workspace-m3.js';
const SCREEN = 'shared/m3/ds.js';

// Each run entry point, and the call that commits it to a run.
const PATHS = [
  { fn: 'window.__wsCreateAssessment', commit: 'dispatchRun', label: 'full assessment' },
  { fn: 'window.__wsRunPrescreen', commit: 'runPrescreen2(', label: 'pre-screen' },
];

// Body of an entry point: from its assignment to the next top-level `window.__` assignment.
function bodyOf(src, fn) {
  const i = src.indexOf(fn + ' = async');
  if (i < 0) return null;
  const after = src.slice(i + fn.length);
  const next = after.search(/\nwindow\.__[A-Za-z]+ = /);
  return next < 0 ? after : after.slice(0, next);
}

// Comments explaining a removed control name that control. The previous gate written here flagged its
// own prose on the first run; strip HTML and JS comments before looking for anything by name.
const decomment = (src) => src
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');

function evaluate({ runner: rawRunner, screen: rawScreen }) {
  const fail = [];
  const runner = decomment(rawRunner);
  const screen = decomment(rawScreen);

  for (const { fn, commit, label } of PATHS) {
    const body = bodyOf(runner, fn);
    if (body == null) { fail.push(`${label}: ${fn} not found — the gate cannot see the path it guards`); continue; }

    const read = body.indexOf('naReadEvidence');
    const commitAt = body.indexOf(commit);
    if (read < 0) {
      fail.push(`${label}: never reads the evidence — a linked folder would be dropped silently`);
      continue;
    }
    // The call must actually carry a folder, not just the staged files.
    const callText = body.slice(read, read + 400);
    if (!/folderUrl\s*:/.test(callText)) {
      fail.push(`${label}: reads the evidence but passes no folderUrl — the Drive link is still dropped`);
    }
    if (commitAt >= 0 && commitAt < read) {
      fail.push(`${label}: commits to the run (${commit}) BEFORE reading the room — the runner would read a half-filled room`);
    }
    if (commitAt < 0) {
      fail.push(`${label}: no ${commit} found — cannot prove the read happens first`);
    }
  }

  // RULE 2 — the skippable step must not come back.
  if (/Read data room/i.test(screen)) {
    fail.push('createScreen: a "Read data room" control is back on the setup screen — the room is skippable again');
  }
  if (/__naReadRoom|__naCheckRoom/.test(runner)) {
    fail.push('workspace-m3: __naReadRoom/__naCheckRoom is live again outside a comment');
  }

  // RULE 3 — the link is persisted when the engagement is created.
  const ensure = runner.slice(runner.indexOf('async function naEnsureEngagement'),
                              runner.indexOf('async function naEnsureEngagement') + 3000);
  if (!/dataRoom:\s*\{[^}]*folderUrl/.test(ensure)) {
    fail.push('naEnsureEngagement: the folder link is not written onto the engagement — a closed tab loses the room');
  }

  return fail;
}

const runner = fs.readFileSync(path.join(ROOT, RUNNER), 'utf8');
const screen = fs.readFileSync(path.join(ROOT, SCREEN), 'utf8');

if (CANARY) {
  // A gate that cannot fail is decoration. Reproduce the three faults that shipped.
  const dropped = runner.replace(/naReadEvidence\(\{\s*\n\s*EA, programId, folderUrl: f\.driveUrl,/,
                                 'naReadEvidence({\n      EA, programId,');
  const a = evaluate({ runner: dropped, screen });
  const b = evaluate({ runner, screen: screen + '\n<button>Read data room</button>' });
  const c = evaluate({ runner: runner.replace(/dataRoom: \{ provider: 'google-drive', folderUrl/, "dataRoom: { provider: 'google-drive', xx"), screen });
  const healthy = evaluate({ runner, screen });
  const got = [
    ['folderUrl removed from a run path', a.some(f => /passes no folderUrl/.test(f))],
    ['"Read data room" control restored', b.some(f => /skippable again/.test(f))],
    ['link no longer persisted at create', c.some(f => /closed tab loses the room/.test(f))],
    ['healthy source stays clean', healthy.length === 0],
  ];
  got.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(38)} ${ok ? 'caught' : 'MISSED'}`));
  if (healthy.length) healthy.forEach(f => console.log(`      unexpected: ${f}`));
  process.exit(got.every(([, ok]) => ok) ? 0 : 1);
}

const fails = evaluate({ runner, screen });
fails.forEach(f => console.log(`  ✗ ${f}`));
console.log(fails.length
  ? `\n  FAIL — ${fails.length} way(s) a linked data room can be lost`
  : '  PASS — every run path reads the room, with the folder, before it commits; the step cannot be skipped and the link survives a closed tab');
process.exit(fails.length ? 1 : 0);
