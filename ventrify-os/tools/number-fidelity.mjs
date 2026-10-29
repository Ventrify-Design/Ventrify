/* ═══════════════════════════════════════════════════════════════════════════
   NUMBER FIDELITY — the gate that protects produced assessments.

   The brand migration is meant to change how the workspace LOOKS and nothing
   else. "Meant to" is not a guarantee, so this makes it one: it records every
   number the workspace renders, and fails if any of them move.

   WHY A SORTED MULTISET, NOT A SEQUENCE.
   The obvious design is "every number in document order". It breaks on the
   first intentional layout change — moving a stat card reorders the list and
   reports a diff that is not a diff. A sorted multiset is order-independent,
   so re-laying a page out is silent, while a changed, added or dropped value
   is caught. The migration reorders things on purpose and must never change
   a value, which is exactly the shape of this check.

   WHAT COUNTS AS A NUMBER: integers, decimals, percentages, money, scores of
   the form N/M, and dates. Pure layout artefacts (px in inline styles, rgb()
   channels) never reach it, because it reads RENDERED TEXT, not source.

   DEMO MODE WITHOUT TOUCHING THE TREE. FIREBASE_ENABLED is flipped by
   intercepting /firebase/config.js in flight. The documented alternative is
   to edit the flag and remember to revert it; a forgotten revert ships a
   workspace with its backend off. This cannot be forgotten.

   USAGE
     node tools/number-fidelity.mjs --save     write the baseline
     node tools/number-fidelity.mjs            check against it
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = resolve(HERE, '../_baselines/numbers.json');
const BASE = process.env.OS_BASE || 'http://localhost:3200';
const SAVE = process.argv.includes('--save');

/* Every page an operator can actually reach. The legacy pages reachable only
   from dead screens are deliberately absent — adding one here would bless it
   as live. */
const PAGES = [
  ['login',      '/workspace/index.html'],
  ['setup',      '/workspace/setup.html'],
  ['portfolio',  '/workspace/dashboard-m3.html'],
  ['queue',      '/workspace/queue-m3.html'],
  ['team',       '/workspace/team-m3.html'],
  ['settings',   '/workspace/settings-m3.html'],
  ['admin',      '/workspace/admin-m3.html'],
  ['assess',     '/workspace/assess-next.html'],
];

const NUMBER = /(?:£|\$|€)?\d[\d,]*(?:\.\d+)?\s*(?:%|\/\s*\d+)?/g;

async function demoPage(browser) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 1000 });
  await p.setRequestInterception(true);
  p.on('request', async req => {
    if (req.url().endsWith('/firebase/config.js')) {
      const src = await (await fetch(req.url())).text();
      return req.respond({ status: 200, contentType: 'application/javascript',
        body: src.replace(/export const FIREBASE_ENABLED\s*=\s*true/, 'export const FIREBASE_ENABLED = false') });
    }
    req.continue();
  });
  return p;
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'], protocolTimeout: 180000,
});

const snapshot = {};
for (const [name, path] of PAGES) {
  const p = await demoPage(browser);
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 100)));
  try {
    await p.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    const nums = await p.evaluate(rx => {
      const re = new RegExp(rx, 'g');
      // innerText, not textContent: it is what a reader SEES, so a value
      // hidden behind display:none is not counted as rendered.
      const text = (document.body.innerText || '').replace(/ /g, ' ');
      return (text.match(re) || []).map(s => s.replace(/\s+/g, ''));
    }, NUMBER.source);
    snapshot[name] = { count: nums.length, values: nums.sort(), errors: errs };
  } catch (e) {
    snapshot[name] = { count: -1, values: [], errors: [String(e).slice(0, 120)] };
  }
  await p.close();
}
await browser.close();

if (SAVE) {
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2));
  console.log(`  baseline written → ${BASELINE}\n`);
  for (const [k, v] of Object.entries(snapshot))
    console.log(`  ${k.padEnd(12)} ${String(v.count).padStart(4)} numbers` +
      (v.errors.length ? `   ⚠ ${v.errors.length} page error(s): ${v.errors[0]}` : ''));
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('  no baseline — run with --save first'); process.exit(1);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
let bad = 0;
for (const [name] of PAGES) {
  const b = base[name], n = snapshot[name];
  if (!b) { console.log(`  ${name.padEnd(12)} (new page — not in baseline)`); continue; }
  const bv = b.values.join('\u0001'), nv = n.values.join('\u0001');
  if (bv === nv) { console.log(`  ✓ ${name.padEnd(12)} ${n.count} numbers, all identical`); continue; }
  bad++;
  const gone = b.values.filter(x => { const i = n.values.indexOf(x); return i < 0; });
  const came = n.values.filter(x => { const i = b.values.indexOf(x); return i < 0; });
  console.log(`  ✗ ${name.padEnd(12)} ${b.count} → ${n.count}`);
  if (gone.length) console.log(`       disappeared: ${gone.slice(0, 12).join(' ')}${gone.length > 12 ? ` …+${gone.length - 12}` : ''}`);
  if (came.length) console.log(`       appeared:    ${came.slice(0, 12).join(' ')}${came.length > 12 ? ` …+${came.length - 12}` : ''}`);
}
console.log(bad ? `\n  ${bad} page(s) changed a rendered number` : '\n  every rendered number is unchanged');
process.exit(bad ? 1 : 0);
