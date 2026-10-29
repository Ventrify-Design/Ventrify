/* ═══════════════════════════════════════════════════════════════════════════
   CSS PARITY — every rule the author wrote is a rule the browser kept.

   WHY THIS EXISTS.
   workspace-chrome.css opened with a header comment that documented the M3
   shims, and one of the things it documented was `.btn*`:

       (3) M3 shims for .modal-scrim/.modal-card/.btn*​/.settings-toast

   `.btn*` followed by `/` is `*​/`. It CLOSED THE COMMENT six lines early.
   Everything after it — four more lines of prose and a row of `=` — became a
   selector prelude, which ran on until it found the next `{` and swallowed
   the rule that owned it. The rule it ate was the FIRST one in the file:

       .ws-grid { display: grid; grid-template-columns: repeat(auto-fill, …) }

   Chrome dropped the whole thing as an invalid selector, in silence. No
   console warning, no 404, no failed build — the team roster simply stopped
   being a grid and nobody could see why, because the source was right there
   and looked correct.

   WHAT IT CHECKS.
   The file is tokenised the way a CSS parser tokenises it (comments, strings,
   url(), nested blocks), every top-level prelude is pulled out, and each one
   is handed to the browser to validate. A prelude the browser rejects is a
   rule that silently does not exist. That is general: comment bleed is only
   one way to get there — a stray brace, a bad pseudo-class or a half-finished
   edit all land in the same place, and all of them are invisible without this.

     node tools/css-parity.mjs          every stylesheet the OS ships
     node tools/css-parity.mjs --self   prove the gate can fail
   ═══════════════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SELF = process.argv.includes('--self');

/* Every .css the OS serves, minus vendored third-party and the brand file's
   own copy (checked by brand-sync for drift, and parsed here all the same). */
function cssFiles(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git' || n.startsWith('_baselines')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) cssFiles(p, out);
    else if (n.endsWith('.css')) out.push(p);
  }
  return out;
}

/* ---- tokenizer ----------------------------------------------------------
   Returns the top-level preludes, with the 1-based line each one starts on.
   Bodies of at-rules that CONTAIN rules (@media, @supports, @container,
   @layer, @scope) are recursed into; bodies that contain declarations
   (@font-face, @keyframes, @property, @page) are not. */
const RULE_BEARING = /^@(media|supports|container|layer|scope|document)\b/i;

function preludes(css, lineBase = 1) {
  const out = [];
  let i = 0, line = lineBase, n = css.length;
  /* The prelude is ACCUMULATED, not sliced. Slicing was the gate's first bug:
     `/* note *​/ @media (…)` sliced whole starts with a comment, so the
     at-rule test failed and every annotated @media in the codebase was
     reported as a broken selector. Fourteen of the eighteen "failures" in the
     first run were that. A gate that lies costs more than no gate — so the
     comment is dropped as it is scanned and never reaches the prelude. */
  let buf = '', bufLine = lineBase, started = false;
  const reset = () => { buf = ''; started = false; };
  while (i < n) {
    const c = css[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) if (css[k] === '\n') line++;
      i = stop; continue;
    }
    if (c === '"' || c === "'") {
      const open = i; i++;
      while (i < n && css[i] !== c) { if (css[i] === '\\') i++; if (css[i] === '\n') line++; i++; }
      i++; buf += css.slice(open, i); continue;
    }
    if (/^url\(/i.test(css.slice(i, i + 4))) {
      const end = css.indexOf(')', i); const stop = end === -1 ? n : end + 1;
      buf += css.slice(i, stop); i = stop; continue;
    }
    if (c === ';') { reset(); i++; continue; }
    if (c === '}') { reset(); i++; continue; }
    if (c === '{') {
      const prelude = buf.trim();
      let depth = 1, j = i + 1;
      const bodyStart = j, bodyLine = line;
      while (j < n && depth) {
        const d = css[j];
        if (d === '\n') line++;
        else if (d === '/' && css[j + 1] === '*') { const e = css.indexOf('*/', j + 2); const s2 = e === -1 ? n : e + 2; for (let k = j; k < s2; k++) if (css[k] === '\n') line++; j = s2; continue; }
        else if (d === '"' || d === "'") { j++; while (j < n && css[j] !== d) { if (css[j] === '\\') j++; if (css[j] === '\n') line++; j++; } }
        else if (d === '{') depth++;
        else if (d === '}') depth--;
        j++;
      }
      if (prelude.startsWith('@')) {
        if (RULE_BEARING.test(prelude)) out.push(...preludes(css.slice(bodyStart, j - 1), bodyLine));
      } else if (prelude) out.push({ prelude, line: bufLine });
      reset(); i = j; continue;
    }
    if (!started && !/\s/.test(c)) { started = true; bufLine = line; }
    if (started) buf += c;
    i++;
  }
  return out;
}

/* ---- suspicious comment terminators -------------------------------------
   The selector check above catches a dropped rule only when the bleed happens
   to produce INVALID css. It need not. `/* … .btn*​/ oops` leaves `oops
   .ws-grid` — a perfectly legal selector that matches nothing, so the rule is
   just as dead and the parser is just as quiet. The mechanism itself is what
   wants checking, and it has a tell: a real comment ends with `*​/` after
   whitespace or a run of `*`. One glued to a word character is a glob someone
   wrote inside prose — `.btn*`, `--md-sys-color-*`, `data-*` — followed by a
   slash they meant as a separator. ---------------------------------------- */
function bledComments(css) {
  const out = [];
  let i = 0, line = 1;
  while (i < css.length) {
    const c = css[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '"' || c === "'") { i++; while (i < css.length && css[i] !== c) { if (css[i] === '\\') i++; if (css[i] === '\n') line++; i++; } i++; continue; }
    if (c === '/' && css[i + 1] === '*') {
      const open = line, end = css.indexOf('*/', i + 2);
      if (end === -1) { i = css.length; continue; }
      for (let k = i; k < end + 2; k++) if (css[k] === '\n') line++;
      if (/[A-Za-z0-9_-]/.test(css[end - 1] || ''))
        out.push({ line, open, text: css.slice(Math.max(i, end - 40), end + 2).replace(/\s+/g, ' ') });
      i = end + 2; continue;
    }
    i++;
  }
  return out;
}

/* ---- run ---------------------------------------------------------------- */
const files = cssFiles(ROOT).sort();
const work = files.map(f => {
  let css = readFileSync(f, 'utf8');
  /* --self injects the exact historical defect into a copy of the real file,
     so the gate is proven able to fail rather than assumed able to. */
  if (SELF && f.endsWith('workspace-chrome.css'))
    css = css.replace('.modal-card, .btn* and', '.modal-card/.btn*/');
  return { f, css, list: preludes(css) };
});

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<!doctype html><title>t</title>');

let bad = 0, total = 0;
for (const { f, css, list } of work) {
  total += list.length;
  for (const b of bledComments(css)) {
    bad++;
    console.log(`\n  ✗ ${relative(ROOT, f)}`);
    console.log(`      line ${b.line}: this "*/" is glued to a word character, so it is a glob`);
    console.log(`      written inside prose — it CLOSES the comment opened on line ${b.open}, and`);
    console.log(`      everything after it runs on as css until the next "{".`);
    console.log(`      …${b.text}`);
  }
  const invalid = await page.evaluate(ls => ls.filter(x => {
    try { document.querySelector(x.prelude); return false; } catch { return true; }
  }), list);
  if (!invalid.length) continue;
  bad += invalid.length;
  console.log(`\n  ✗ ${relative(ROOT, f)}`);
  for (const v of invalid) {
    const one = v.prelude.replace(/\s+/g, ' ').trim();
    console.log(`      line ${v.line}: the browser cannot parse this selector, so the rule it`);
    console.log(`      opens is dropped whole — declarations and all.`);
    console.log(`      ${one.length > 150 ? one.slice(0, 147) + '…' : one}`);
    if (/\*\//.test(v.prelude) || /[.#][-\w]*\*$/.test(one.split(/\s/)[0] || ''))
      console.log(`      → looks like comment bleed: an earlier "*/" closed a comment early.`);
  }
}
await browser.close();

console.log(`\n  ${total} rules across ${files.length} stylesheets`);
if (bad) { console.log(`\n  ${bad} rule${bad === 1 ? '' : 's'} silently dropped\n`); process.exit(1); }
console.log('\n  every rule the source declares is a rule the browser keeps\n');
