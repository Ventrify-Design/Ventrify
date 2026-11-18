/**
 * tools/unlock-paywall.mjs — WHO GETS A FULL ASSESSMENT WITHOUT PAYING? Offline, $0, ~1 second.
 *
 * Until now the answer was "anybody who can press the button". api/memo.js flipped `tier` to 'full'
 * for any operator of the org, and a widget founder is an operator of their own org — so a stranger
 * who came in through a partner's website could help themselves to the $199 product. That was
 * deliberate while BILLING_ENFORCED was false and the button said so out loud. It stops being
 * deliberate the moment money is involved.
 *
 * THE FLAG IS A CONSTANT, so testing the far side of it means importing a modified copy of the
 * module rather than hoping. Both states are exercised here: the one running in production today,
 * and the one that ships the day Stripe lands. The matrix is the point — four ways through and one
 * way out, and the expensive mistake is any of them answering wrongly in the generous direction.
 *
 *   node tools/unlock-paywall.mjs            run it
 *   node tools/unlock-paywall.mjs --canary   prove the gate can fail
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CANARY = process.argv.includes('--canary');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/* The live module, and the same module with billing switched on. The second is a temp copy, so
   nothing here can leave the flag flipped in the repo by accident. */
const SRC = readFileSync(path.join(ROOT, 'shared/entitlements.js'), 'utf8');
const OFF = await import(pathToFileURL(path.join(ROOT, 'shared/entitlements.js')).href);
const tmp = mkdtempSync(path.join(tmpdir(), 'paywall-'));
const onPath = path.join(tmp, 'entitlements-on.mjs');
writeFileSync(onPath, SRC.replace('export const BILLING_ENFORCED = false;',
                                  'export const BILLING_ENFORCED = true;'));
const ON = await import(pathToFileURL(onPath).href);

/* AND THE MODULE THAT PRODUCES THE NUMBER. unlockGrant only decides; workspace/plan.js is what turns
   an org document into `remainingFull`, with its own copy of normLimit. Tidy that to `Number(v) ||
   null` and a limit of 0 becomes "unlimited" — every widget founder is handed the $199 product and
   every assertion above still passes, because they were all fed numbers by hand. */
const PLAN_SRC = readFileSync(path.join(ROOT, 'workspace/plan.js'), 'utf8');
/* A copy in /tmp loses its neighbours: plan.js imports ../shared/entitlements.js, which from a temp
   directory resolves to nothing. The specifiers are rewritten to absolute file URLs so the copy is
   the same module with the same dependencies, living somewhere else. */
const absolutise = (src, fromDir) => src.replace(
  /from\s+'(\.\.?\/[^']+)'/g,
  (_, rel) => "from '" + pathToFileURL(path.resolve(fromDir, rel)).href + "'");
const planPath = path.join(tmp, 'plan-' + (CANARY ? 'tidied' : 'real') + '.mjs');
writeFileSync(planPath, absolutise(CANARY
  ? PLAN_SRC.replace('return (isNaN(n) || n < 0) ? null : n;', 'return (isNaN(n) || n <= 0) ? null : n;')
  : PLAN_SRC, path.join(ROOT, 'workspace')));
const PLAN = await import(pathToFileURL(planPath).href);
if (OFF.BILLING_ENFORCED !== false) throw new Error('the repo ships with billing ENFORCED — is that intended?');
if (ON.BILLING_ENFORCED !== true) throw new Error('the temp copy did not flip; the constant was renamed');

let fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ✓ ' + name); } catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; } };
const eq = (got, want, label) => { if (got !== want) throw new Error(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };

const PAID = { payment: { status: 'paid' } };
const UNPAID = { name: 'Northwind Health' };

console.log('\n1. TODAY — billing off, nothing changes for anyone');
t('an allowance-less founder still gets the free unlock', () => {
  eq(OFF.unlockGrant({ engagement: UNPAID, remainingFull: 0 }).allowed, true, 'allowed');
  eq(OFF.unlockGrant({ engagement: UNPAID, remainingFull: 0 }).reason, 'billing_off', 'reason');
});
t('and the button still routes to the run, never to a checkout', () => {
  eq(OFF.unlockRoute({ engagement: UNPAID, remainingFull: 0 }), 'run', 'route');
});

console.log('\n2. THE DAY STRIPE LANDS — billing on');
const G = (o) => (CANARY ? OFF : ON).unlockGrant(o);          // the canary asks the wrong module
const R = (o) => (CANARY ? OFF : ON).unlockRoute(o);

t('a widget founder with no allowance is refused', () => {
  const g = G({ engagement: UNPAID, remainingFull: 0 });
  eq(g.allowed, false, 'allowed');
  eq(g.reason, 'payment_required', 'reason');
});
t('…and their button goes to the checkout', () => {
  eq(R({ engagement: UNPAID, remainingFull: 0 }), 'checkout', 'route');
});
t('a paid engagement is let through', () => {
  eq(G({ engagement: PAID, remainingFull: 0 }).reason, 'paid', 'reason');
});
t('an unlimited licence is NEVER sent to a checkout', () => {
  eq(G({ engagement: UNPAID, remainingFull: Infinity }).reason, 'licence', 'reason');
  eq(R({ engagement: UNPAID, remainingFull: Infinity }), 'run', 'route');
});
t('a one-off licence with its assessment unspent is let through', () => {
  eq(G({ engagement: UNPAID, remainingFull: 1 }).reason, 'licence', 'reason');
});
t('…and the same licence, spent, is refused', () => {
  eq(G({ engagement: UNPAID, remainingFull: 0 }).allowed, false, 'allowed');
});
t('a super-admin can still comp a venture, and it is recorded as that', () => {
  eq(G({ engagement: UNPAID, remainingFull: 0, isSuper: true }).reason, 'super_admin', 'reason');
});

console.log('\n3. THE FORGOTTEN ARGUMENT FAILS TOWARDS THE TILL');
t('no remainingFull at all means refuse, not give away', () => {
  eq(G({ engagement: UNPAID }).allowed, false, 'allowed');
  eq(G({}).allowed, false, 'allowed with nothing at all');
});
t('an unpaid payment record is not a payment', () => {
  eq(G({ engagement: { payment: { status: 'unpaid' } } }).allowed, false, 'allowed');
  eq(G({ engagement: { payment: { status: 'open' } } }).allowed, false, 'open session');
});

console.log('\n4. THE ENDPOINT ASKS THE SHARED QUESTION, AND HONOURS IT');
t('api/memo.js calls unlockGrant and returns 402 when it says no', () => {
  const src = readFileSync(path.join(ROOT, 'api/memo.js'), 'utf8');
  const branch = src.slice(src.indexOf("if (action === 'prescreen-unlock')"));
  const body = branch.slice(0, branch.indexOf('\n    // ---- pre-screen'));
  if (!/unlockGrant\(/.test(body)) throw new Error('the endpoint does not ask unlockGrant');
  if (!/402/.test(body)) throw new Error('the endpoint has no payment_required answer');
  /* The order is load-bearing: a tier written before the grant is checked is a paywall that
     announces itself after the goods have gone. */
  if (body.indexOf('unlockGrant(') > body.indexOf("tier: 'full'"))
    throw new Error('it writes the tier BEFORE asking whether it may');
  if (!/remainingFull = 0/.test(body)) throw new Error('the allowance does not default to zero — it must fail closed');
});

console.log('\n5. THE NUMBER THE DECISION IS FED — real org documents, through plan.js');
const ORGS = {
  'widget founder':  { plan: { preset: 'widget-founder', capabilities: { assess: true, build: false },
                               limits: { assessments: 0, builds: 0, prescreens: 1 } } },
  'assess licence':  { plan: { preset: 'assess', capabilities: { assess: true, build: false },
                               limits: { assessments: null, builds: 0, prescreens: null } } },
  'one-off licence': { plan: { preset: 'one-off', capabilities: { assess: true, build: false },
                               limits: { assessments: 1, builds: 0, prescreens: null } } },
  'no plan at all':  {},
};
const remainingOf = (org, programs = []) =>
  PLAN.remainingFor(PLAN.resolvePlan(org), programs, 'assessment', 'full');

t('a limit of 0 means 0, not unlimited', () => {
  eq(remainingOf(ORGS['widget founder']), 0, 'widget founder remaining');
});
t('…so the founder is refused once billing is on, end to end', () => {
  eq(G({ engagement: UNPAID, remainingFull: remainingOf(ORGS['widget founder']) }).allowed, false, 'allowed');
});
t('a licensee is unlimited, and is never sent to a checkout', () => {
  eq(remainingOf(ORGS['assess licence']), Infinity, 'assess remaining');
  eq(R({ engagement: UNPAID, remainingFull: remainingOf(ORGS['assess licence']) }), 'run', 'route');
});
t('an org with no plan at all is a pre-existing licensee, not a stranger', () => {
  eq(remainingOf(ORGS['no plan at all']), Infinity, 'no-plan remaining');
});
t('a one-off licence is spent by the assessment it already ran', () => {
  eq(remainingOf(ORGS['one-off licence']), 1, 'unspent');
  const spent = [{ engagementType: 'assessment', tier: 'full' }];
  eq(remainingOf(ORGS['one-off licence'], spent), 0, 'after one full run');
  eq(G({ engagement: UNPAID, remainingFull: remainingOf(ORGS['one-off licence'], spent) }).allowed, false, 'refused');
});
t('a pre-screen never spends the full-assessment allowance', () => {
  const screened = [{ engagementType: 'assessment', tier: 'prescreen' }];
  eq(remainingOf(ORGS['one-off licence'], screened), 1, 'still unspent');
});

if (CANARY) {
  console.log(fail ? '\ncanary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
console.log(fail ? `\n${fail} FAILED` : '\n✓ the paywall answers the same way on both sides, in both states');
process.exit(fail ? 1 : 0);
