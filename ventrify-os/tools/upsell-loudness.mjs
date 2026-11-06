#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// UPSELL LOUDNESS — the tier-choice closing band must be loud in exactly the
// licence states where the full assessment COSTS MONEY, and quiet in the states
// where the licence already includes it.
//
// It shipped inverted. `tc-up` took `is-quiet` when the tier it sells was NOT the
// recommended column — which is precisely when it is an upsell. The result:
//
//     licensed / assess   full = "Included in your licence"  →  LOUD   (nothing to sell)
//     self-serve / one-off / trial   full = "$199 per run"   →  QUIET  (the sale)
//
// No static check could see this: the markup, the copy and the CSS were all correct,
// and the one boolean that was wrong reads perfectly well in isolation. It needs the
// page rendered in each licence state, which is what this does.
//
// PRECONDITION: a server on :3200 serving ventrify-os, and FIREBASE_ENABLED=false in
// firebase/config.js — `?plan=` is a demo-mode override. The gate says so if the table
// does not render rather than passing on an empty page.
//
// Run: node tools/upsell-loudness.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANARY = process.argv.includes('--canary');
const BASE = process.env.OS_BASE || 'http://localhost:3200';
const PAGE = BASE + '/workspace/create-m3.html';

// Every licence preset the create screen can be opened under. '' is the org's own plan.
const PLANS = ['', '?plan=self-serve', '?plan=one-off', '?plan=assess', '?plan=trial'];

// THE INVARIANT, as a pure function so it can be canaried without a browser.
// A row is { plan, costs, quiet, hasGradient, missing }.
export function evaluate(rows) {
  const fail = [];
  for (const r of rows) {
    if (r.missing) { fail.push(`${r.plan || '(default)'}: the choice table did not render`); continue; }
    if (r.noBand) continue;                       // no upsell offered at all — nothing to judge
    const paying = /\$\d/.test(r.costs);          // the cost line names a price
    if (paying && r.quiet) {
      fail.push(`${r.plan || '(default)'}: full costs ${r.costs} and the band is QUIET — the sale is muted`);
    }
    if (!paying && !r.quiet) {
      fail.push(`${r.plan || '(default)'}: full is "${r.costs}" and the band is LOUD — selling what they own`);
    }
    if (paying && !r.hasGradient) {
      fail.push(`${r.plan || '(default)'}: loud band has no gradient — check the surface token resolves`);
    }
  }
  return fail;
}

if (CANARY) {
  // A gate that cannot fail is decoration. Feed it the exact inversion that shipped.
  const inverted = [
    { plan: '?plan=self-serve', costs: '$199 per run', quiet: true, hasGradient: false },
    { plan: '(default)', costs: 'Included in your licence', quiet: false, hasGradient: true },
  ];
  const healthy = [
    { plan: '?plan=self-serve', costs: '$199 per run', quiet: false, hasGradient: true },
    { plan: '(default)', costs: 'Included in your licence', quiet: true, hasGradient: false },
  ];
  const a = evaluate(inverted), b = evaluate(healthy);
  console.log(`  canary inverted → ${a.length} failure(s): ${a.length >= 2 ? 'caught' : 'MISSED'}`);
  console.log(`  canary healthy  → ${b.length} failure(s): ${b.length === 0 ? 'clean' : 'FALSE POSITIVE'}`);
  a.forEach(f => console.log(`      ${f}`));
  process.exit(a.length >= 2 && b.length === 0 ? 0 : 1);
}

const { default: puppeteer } = await import(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js')
).catch(() => import('puppeteer'));

const br = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});

const rows = [];
for (const plan of PLANS) {
  const pg = await br.newPage();
  await pg.setViewport({ width: 1440, height: 1000 });
  try {
    await pg.goto(PAGE + plan, { waitUntil: 'networkidle0', timeout: 30000 });
  } catch {
    rows.push({ plan, missing: true }); await pg.close(); continue;
  }
  await new Promise(r => setTimeout(r, 2000));
  rows.push(await pg.evaluate(p => {
    if (!document.querySelector('.tc-tab')) return { plan: p, missing: true };
    const up = document.querySelector('.tc-up');
    const full = [...document.querySelectorAll('.tc-h')]
      .find(h => /full/i.test((h.querySelector('.tc-name') || {}).textContent || ''));
    const cost = full && full.querySelector('.tc-cost strong');
    if (!up) return { plan: p, noBand: true, costs: cost ? cost.textContent.trim() : '' };
    return {
      plan: p,
      costs: cost ? cost.textContent.trim() : '',
      quiet: up.classList.contains('is-quiet'),
      hasGradient: getComputedStyle(up).backgroundImage !== 'none',
    };
  }, plan));
  await pg.close();
}
await br.close();

for (const r of rows) {
  const tag = (r.plan || '(default)').padEnd(18);
  if (r.missing) { console.log(`  ? ${tag}table did not render`); continue; }
  if (r.noBand) { console.log(`  · ${tag}no upsell band offered`); continue; }
  console.log(`  ${tag}full = ${r.costs.padEnd(26)} band = ${r.quiet ? 'quiet' : 'LOUD '}` +
              `  gradient = ${r.hasGradient ? 'yes' : 'no'}`);
}

const fails = evaluate(rows);
fails.forEach(f => console.log(`  ✗ ${f}`));
console.log(fails.length
  ? `\n  FAIL — ${fails.length} state(s) where the band's volume contradicts the price`
  : `\n  PASS — the band is loud in every paying state and quiet in every included one`);
process.exit(fails.length ? 1 : 0);
