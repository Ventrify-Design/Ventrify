#!/usr/bin/env node
// ============================================================
// nav-paths — every in-app navigation must be ROOT-ABSOLUTE.
//
// THIS GATE EXISTS BECAUSE A RELATIVE ONE TOOK SIGN-IN DOWN IN PRODUCTION.
//
// vercel.json sets cleanUrls + trailingSlash:false, so /workspace/ is 308-redirected to /workspace —
// no trailing slash. A browser resolves a relative URL against the current path's DIRECTORY, and the
// directory of /workspace is /. So after sign-in:
//
//     location.href = 'dashboard-m3.html'   →   https://os.ventrify.io/dashboard-m3   →  404
//
// The page existed the whole time, at /workspace/dashboard-m3. Nothing was broken except the shape of
// one string, and it was invisible from the repo: the file is there, the link "looks" right, and it
// works from any URL that happens to end in a slash.
//
// Root-absolute paths do not depend on whether the current URL has a trailing slash. Static, instant,
// no browser needed.
// ============================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DIRS = ['workspace', 'studio', 'shared'];
const NAV = /(?:window\.)?location\.(?:href\s*=|replace\()\s*'([^']+)'/g;

let fails = 0;
console.log('nav-paths — in-app navigations must not be relative\n');
for (const dir of DIRS) {
  let files;
  try { files = readdirSync(join(ROOT, dir)).filter(f => /\.(js|html)$/.test(f)); } catch { continue; }
  for (const f of files) {
    const src = readFileSync(join(ROOT, dir, f), 'utf8');
    for (const m of src.matchAll(NAV)) {
      const target = m[1];
      // absolute paths, full URLs and in-page anchors are all fine
      if (/^(\/|https?:|#|mailto:)/.test(target)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      console.log(`  ✗ ${dir}/${f}:${line}  location → '${target}'`);
      console.log(`      relative. From a clean URL with no trailing slash this resolves against the site root.`);
      fails++;
    }
  }
}
console.log('');
console.log(fails ? `FAIL — ${fails} relative navigation(s); use '/${'' }${'workspace'}/…' instead` : 'PASS — every in-app navigation is root-absolute');
process.exit(fails ? 1 : 0);
