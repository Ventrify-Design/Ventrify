#!/usr/bin/env node
/**
 * check-dataless — refuse to commit a file whose CONTENT is not actually on this disk.
 *
 * WHY THIS EXISTS.
 *
 * ~/Desktop is iCloud-synced. macOS evicts file contents to the cloud and leaves a "dataless" placeholder
 * behind: `ls` still shows the original size, `stat` still shows the original size, and git — whose
 * is-it-modified check is mtime+size, not content — still reports the file as CLEAN. But every actual READ
 * returns nothing.
 *
 * That combination is a loaded gun. On 2026-07-13 nineteen files in this repo were in that state, including
 * SEVEN api/ endpoints, firebase/data.js, shared/m3/adapter.js and workspace/program.html. Any `git add -A`
 * would have staged nineteen EMPTY files while git cheerfully reported everything normal, and pushed seven
 * blank serverless functions to os.ventrify.io. It had already happened once, quietly, to a scoring fixture:
 * a run's ground-truth score was replaced with an empty file and committed, and it took a contradiction
 * between two tools to notice.
 *
 * You cannot defend against this by being careful, because the failure is INVISIBLE to the tools you would
 * be careful with. So it is checked mechanically, at the only moment that matters: before a commit lands.
 *
 * The test is deliberately not "is it dataless?" (an APFS flag that may change name) but the thing we
 * actually care about: THE FILE HAS A SIZE, AND READING IT GIVES US NOTHING. That is true of an evicted
 * placeholder, a truncated file, and a corrupt one alike.
 *
 *   node tools/check-dataless.mjs            # check staged files (pre-commit)
 *   node tools/check-dataless.mjs --all      # check the whole tree
 */
import { execSync } from 'child_process';
import fs from 'fs';

const all = process.argv.includes('--all');

const files = execSync(
  all ? 'git ls-files' : 'git diff --cached --name-only --diff-filter=ACM',
  { encoding: 'utf8' }
).split('\n').map(s => s.trim()).filter(Boolean);

const hollow = [];
for (const f of files) {
  let st;
  try { st = fs.statSync(f); } catch { continue; }   // deleted / not on disk — not our problem
  if (!st.isFile() || st.size === 0) continue;       // a genuinely empty file is a choice; a hollow one is not

  let bytes = 0;
  try { bytes = fs.readFileSync(f).length; } catch { bytes = 0; }   // an unreadable file is exactly the bug
  if (bytes === 0) hollow.push({ f, size: st.size });
}

if (!hollow.length) {
  if (all) console.log(`✅ ${files.length} tracked files — all have real content on disk.`);
  process.exit(0);
}

console.error('');
console.error('✋ BLOCKED — these files claim a size but read as EMPTY:');
console.error('');
for (const h of hollow) console.error(`     ${h.f}  (${h.size} bytes on paper, 0 in reality)`);
console.error('');
console.error('   They are almost certainly iCloud placeholders: the content lives in the cloud, not on this');
console.error('   disk. git reports them CLEAN because it compares mtime+size, never content — so committing');
console.error('   now would replace real code with empty files and push that to production.');
console.error('');
console.error('   Restore them (git holds the real bytes):');
console.error('');
console.error(`     rm ${hollow.map(h => h.f).join(' ')}`);
console.error(`     git checkout HEAD -- ${hollow.map(h => h.f).join(' ')}`);
console.error('');
console.error('   To stop it recurring: System Settings → Apple ID → iCloud → iCloud Drive → turn OFF');
console.error('   "Optimise Mac Storage" (it is what evicts the contents).');
console.error('');
process.exit(1);
