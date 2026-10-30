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
// shared/ is NOT scanned for href:, only for location.*. shared/m3/ds.js carries the DS workshop's
// default nav, and those pages live at /_redesign/m3/ where relative IS correct — absolutising them
// would break the workshop to fix the app.
const DIRS = ['workspace', 'studio', 'shared'];
const NAV = /(?:window\.)?location\.(?:href\s*=|replace\()\s*'([^']+)'/g;
// The first fix missed this entirely: the outage was a location.href, so that is all the gate looked
// for — while every nav link and breadcrumb in the product had exactly the same relative shape and
// would have 404'd the moment anyone clicked one from a URL without a trailing slash. A gate written
// from one symptom catches one symptom.
const HREF = /href:\s*'([^']+\.html[^']*)'/g;
// AND the shape, not just the syntax. The outage's real cause was `const DASH = 'dashboard-m3.html'`
// — a variable, assigned a bare page name, used in a location.href three lines later. Two fixes and
// two gate rules walked past it because neither matched the pattern they were written from.
//
// So the rule is now about the VALUE: in the deployed app, a bare relative page name in a string is
// wrong wherever it appears, because every one of them is eventually resolved by a browser against a
// URL with no trailing slash. Quoted '…/x.html' and "./x.html" are fine; bare 'x.html' is not.
const BARE = /'([a-z0-9][A-Za-z0-9._-]*\.html(?:\?[^']*)?)'/g;

let fails = 0;
console.log('nav-paths — in-app navigations must not be relative\n');
for (const dir of DIRS) {
  let files;
  try { files = readdirSync(join(ROOT, dir)).filter(f => /\.(js|html)$/.test(f)); } catch { continue; }
  for (const f of files) {
    const src = readFileSync(join(ROOT, dir, f), 'utf8');
    const checks = [['location', NAV]];
    if (dir !== 'shared') { checks.push(['href', HREF]); checks.push(['bare page name', BARE]); }
    // A bare page name is only wrong when it is a DESTINATION. The same string is legitimately a
    // comparison or a lookup key — `currentPath !== 'setup.html'`, `{'queue.html': 'queue'}` — because
    // those read a page name rather than navigate to one, and absolutising them would break the
    // active-nav highlighting to fix a routing bug. Told apart by what surrounds the literal.
    const isRead = (src, i) => {
      const after = src.slice(i).match(/^'[^']*'\s*(.)/);
      if (after && after[1] === ':') return true;                      // a map key
      const before = src.slice(Math.max(0, i - 24), i);
      return /(!==|===|==|!=|\|\|)\s*$/.test(before) || /\.(includes|endsWith|startsWith)\($/.test(before);
    };
    for (const [kind, re_] of checks) {
      for (const m of src.matchAll(new RegExp(re_.source, 'g'))) {
        const target = m[1];
        // absolute paths, full URLs and in-page anchors are all fine
        if (/^(\/|https?:|#|mailto:)/.test(target)) continue;
        if (kind === 'bare page name' && isRead(src, m.index)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        console.log(`  ✗ ${dir}/${f}:${line}  ${kind} → '${target}'`);
        console.log(`      relative. From a clean URL with no trailing slash this resolves against the site root.`);
        fails++;
      }
    }
  }
}
console.log('');
console.log(fails ? `FAIL — ${fails} relative navigation(s); use '/${'' }${'workspace'}/…' instead` : 'PASS — every in-app navigation is root-absolute');
process.exit(fails ? 1 : 0);
