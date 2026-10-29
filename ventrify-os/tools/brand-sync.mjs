/* ═══════════════════════════════════════════════════════════════════════════
   BRAND SYNC — keeps the vendored brand layer honest.

   assets/brand/brand.css is a COPY. The canonical file is the repo's
   ../assets/brand.css, which the websites consume directly. A copy exists
   because os.ventrify.io deploys with Root Directory = ventrify-os, so
   anything above that folder is not in the bundle — the canonical file is
   simply not reachable in production. MEASURED before vendoring:
   /assets/brand.css → 404 from the OS root.

   A copy that nobody checks is drift waiting to happen, so this file is the
   check. Two things it enforces:

     1. DRIFT — the vendored brand.css must be byte-identical to canonical.
        Re-skin the identity once, in one place, and this says whether the
        product got it.

     2. ESCAPE — every url() in the OS brand layer AND every <link href> on
        every page must resolve to a file
        INSIDE ventrify-os. This is the rule that was being broken silently:
        ../../../assets/… resolves fine when the tree is served from the
        parent folder, which is how the *-brand.html previews were always
        opened, and 404s the moment it ships. Serving locally from the wrong
        root is enough to hide it, so it needed a test rather than an eye.

     node tools/brand-sync.mjs           check (CI / pre-deploy)
     node tools/brand-sync.mjs --sync    refresh the copy from canonical
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');                       // ventrify-os — the deploy root
const CANONICAL = resolve(ROOT, '../assets/brand.css');
const VENDORED  = resolve(ROOT, 'assets/brand/brand.css');
const SYNC = process.argv.includes('--sync');

/* Files that carry the brand layer's url()s. */
const CSS = ['shared/m3/brand-map.css', 'assets/brand/brand.css'];

const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
let bad = 0;
const fail = m => { console.log(`  ✗ ${m}`); bad++; };

/* ── 1. drift ─────────────────────────────────────────────────────────── */
if (!existsSync(CANONICAL)) {
  fail(`canonical brand.css missing at ${CANONICAL}`);
} else if (SYNC) {
  writeFileSync(VENDORED, readFileSync(CANONICAL));
  console.log(`  synced  ${relative(ROOT, VENDORED)}  ←  ${relative(ROOT, CANONICAL)}  (${sha(VENDORED)})`);
} else if (!existsSync(VENDORED)) {
  fail('vendored brand.css missing — run with --sync');
} else {
  const a = sha(CANONICAL), b = sha(VENDORED);
  if (a !== b) fail(`brand.css has DRIFTED — canonical ${a}, vendored ${b}. Run --sync.`);
  else console.log(`  ✓ brand.css matches canonical (${a})`);
}

/* ── 2. escape ────────────────────────────────────────────────────────── */
let urls = 0;
const assetRefs = [];   /* every in-root url() target, repo-relative — feeds the tracked check */
for (const rel of CSS) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) { fail(`${rel} not found`); continue; }
  const src = readFileSync(file, 'utf8');
  const live = src
    // strip comments, so a parked rule is not read as a live reference
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // strip QUOTED data: URIs whole. brand.css's grain is an inline SVG that
    // itself contains filter='url(%23n)' — a fragment id, percent-encoded.
    // Scanned naively that reads as a request for a file called "%23n", which
    // is what this gate reported on its first run. The data URI is quoted and
    // percent-encoded, so it can be lifted out in one piece.
    .replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/g, 'url(data:stripped)');
  for (const m of live.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const ref = m[1].trim();
    // inline, remote, or a fragment id — '%23' is '#' encoded, which is how a
    // filter reference looks if one ever survives the strip above.
    if (/^(data:|https?:|#|%23)/.test(ref)) continue;
    urls++;
    const target = resolve(dirname(file), ref);
    if (!target.startsWith(ROOT + '/')) {
      fail(`${rel} → ${ref}\n       escapes the deploy root (resolves to ${target}) — it will 404 in production`);
    } else if (!existsSync(target)) {
      fail(`${rel} → ${ref}\n       inside the root but the file is not there (${relative(ROOT, target)})`);
    } else if (!/\.css$/.test(target)) {
      assetRefs.push(relative(ROOT, target));
    }
  }
}

/* ── 2b. escape, in HTML ───────────────────────────────────────────────────
   The check above reads CSS url()s only, and that is exactly how the SAME bug
   survived it: every brand-preview page linked the brand layer as
   `../../../assets/brand.css` — a <link href>, which no url() scan can see.
   Twenty pages carried it. They resolved while the tree was served from the
   parent folder and 404'd from the deploy root, and the symptom was not an
   error: an unresolved var() makes `fill` fall back to BLACK, so the lockup
   simply lost its wordmark into a dark drawer. Same class of failure as the
   url() escape, so it belongs in the same gate. */
const HTML = readdirSync(resolve(ROOT, '_redesign/m3')).filter(f => f.endsWith('.html')).map(f => '_redesign/m3/' + f)
  .concat(readdirSync(resolve(ROOT, 'workspace')).filter(f => f.endsWith('.html')).map(f => 'workspace/' + f));
let links = 0;
for (const rel of HTML) {
  const file = resolve(ROOT, rel);
  const src = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of src.matchAll(/<link[^>]+href=["']([^"']+)["']/g)) {
    const ref = m[1].trim();
    if (/^(https?:|\/\/|data:|#)/.test(ref)) continue;
    links++;
    /* A ROOT-ABSOLUTE href is relative to the DEPLOY ROOT, not to the file —
       `/shared/ds.css` on os.ventrify.io is ventrify-os/shared/ds.css, and it
       is correct. Resolving it against dirname() sent it to the filesystem
       root and reported the login page as broken on this check's first run.
       Three instruments have now lied in this migration; each time the fix
       was the instrument, and each time the work it would have sent me on was
       real. */
    const target = ref.startsWith('/') ? resolve(ROOT, '.' + ref) : resolve(dirname(file), ref);
    if (!target.startsWith(ROOT + '/'))
      fail(`${rel} → ${ref}\n       <link> escapes the deploy root (resolves to ${target}) — it will 404 in production`);
    else if (!existsSync(target))
      fail(`${rel} → ${ref}\n       <link> inside the root but the file is not there (${relative(ROOT, target)})`);
  }
}
if (!bad) console.log(`  ✓ all ${urls} url() + ${links} <link> reference(s) resolve inside the deploy root`);

/* ── 3. tracked ───────────────────────────────────────────────────────────
   Vercel builds from git, not from this disk. A file that exists locally,
   passes every check above and is NOT COMMITTED is absent from the deploy —
   and nothing local can tell, because locally it is right there.

   This is not hypothetical. shared/m3/brand-map.css, the entire brand layer,
   had never been committed. It passed every gate, rendered correctly in the
   previews, and would have 404'd on all six pages the moment it shipped.
   Same failure shape as the path escape above: correct here, missing there.

   It reads the INDEX (git ls-files), so it clears as soon as a file is
   staged, not when it is pushed. That is the right line to draw: "nobody
   ever added this" is the mistake worth catching automatically, while "added
   but not yet pushed" is just work in progress. */
const tracked = new Set(
  execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));
/* A HAND-WRITTEN list is itself a thing that can drift: it kept
   verdictscore-icon.png on the required list for a release after the PNG was
   deleted (the lockup is inline SVG now), so the gate failed over a file
   nothing references. The brand-layer SOURCES stay listed by hand because
   they are few and load-bearing; the ASSETS are derived from the url()s the
   escape check already resolved above, so the two can never disagree. */
const NEEDED = [
  'shared/m3/brand-map.css',
  'assets/brand/brand.css',
  ...assetRefs,
];
const untracked = NEEDED.filter(f => !tracked.has(f));
if (untracked.length) {
  untracked.forEach(f => fail(`${f} is NOT tracked by git — it cannot reach the deploy`));
} else {
  console.log(`  ✓ all ${NEEDED.length} brand-layer file(s) are tracked by git`);
}

console.log(bad ? `\n  ${bad} problem(s)` : '\n  brand layer is deployable');
process.exit(bad ? 1 : 0);
