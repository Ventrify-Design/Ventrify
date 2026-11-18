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

if (CANARY) {
  console.log(fail ? '\ncanary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
console.log(fail ? `\n${fail} FAILED` : '\n✓ the paywall answers the same way on both sides, in both states');
process.exit(fail ? 1 : 0);
