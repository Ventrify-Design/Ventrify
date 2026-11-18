/* DOES EVERY SCRIPT IN THIS REPO STILL PARSE?
 *
 * The gate that was missing on 2026-11-17. A comment added to sites/verdict-widget/widget.js said
 * "the Vercel *" + "/5 cron" — and a star-slash inside a block comment ENDS THE COMMENT. The rest of
 * the sentence became code, the file stopped parsing, and every panel the widget opened on every
 * partner page was blank. It was deployed and "verified" by fetching the file and grepping it for
 * the string that had been changed: the string was there, the file was rubbish.
 *
 * Nothing that reads source text can catch this. Only a parser can. This codebase is unusually
 * comment-heavy by design, which is exactly why it needs one.
 *
 * Two parser modes, because .js here is sometimes CommonJS (api/) and sometimes a browser module
 * (shared/, _redesign/). A file is tried as CJS and, if it fails only because it used import or
 * export, tried again as ESM. A file that fails both is broken in every mode there is.
 *
 *   node parse-check.mjs            parse every tracked .js and .mjs
 *   node parse-check.mjs --canary   plant the 2026-11-17 bug and prove it is caught
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANARY = process.argv.includes('--canary');
const TMP = mkdtempSync(path.join(tmpdir(), 'parse-'));

/* ANCHORED TO THE REPO ROOT, not to wherever this was run from. `git ls-files` is relative to the
   working directory, so running it from ventrify-os/ scanned 116 files and reported a clean PASS —
   a gate that quietly covers a third less than it claims, which is the fault it was written to catch. */
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const files = execFileSync('git', ['ls-files', '*.js', '*.mjs'], { encoding: 'utf8', cwd: ROOT })
  .split('\n').map(s => s.trim()).filter(Boolean).filter(f => !f.includes('node_modules'))
  .map(f => path.join(ROOT, f));

/* The error a CommonJS parse gives a perfectly good ES module. It is the one failure that means
   "try the other mode", and it must not be confused with a real syntax error. */
const ESM_ONLY = /Cannot use import statement outside a module|Unexpected token 'export'|await is only valid/;

function parses(src, file) {
  const asCjs = path.join(TMP, 'c.js'), asEsm = path.join(TMP, 'e.mjs');
  const run = (p) => {
    try { execFileSync(process.execPath, ['--check', p], { stdio: ['ignore', 'ignore', 'pipe'] }); return null; }
    catch (e) { return String(e.stderr || e.message); }
  };
  if (file.endsWith('.mjs')) { writeFileSync(asEsm, src); return run(asEsm); }
  writeFileSync(asCjs, src);
  const cjs = run(asCjs);
  if (!cjs) return null;
  if (!ESM_ONLY.test(cjs)) return cjs;
  writeFileSync(asEsm, src);
  return run(asEsm);
}

let bad = 0;
for (const f of files) {
  let src = readFileSync(f, 'utf8');
  /* The canary plants the exact bug, in a real file, in the place it actually happened: a comment
     that mentions a cron expression. A gate that cannot fail is decoration. */
  if (CANARY && f.endsWith('sites/verdict-widget/widget.js')) src = src.replace('/* MEASURED', '/* MEASURED, on the */5 cron,');
  const err = parses(src, f);
  if (err) {
    bad++;
    const line = (err.match(/^.*?:(\d+)\n/) || [, '?'])[1];
    const why = (err.match(/^(SyntaxError:.*)$/m) || [, err.split('\n')[0]])[1];
    console.log(`  ✗ ${path.relative(ROOT, f)}:${line}  ${why}`);
  }
}

console.log(bad ? `\n  ${bad} of ${files.length} files do not parse` : `  PASS — all ${files.length} tracked scripts parse`);
if (CANARY) {
  console.log(bad ? '  canary OK — the gate can fail' : '  !! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(bad ? 0 : 1);
}
process.exit(bad ? 1 : 0);
