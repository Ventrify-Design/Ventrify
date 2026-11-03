#!/usr/bin/env node
// ============================================================
// cta-check — does every call to action on the marketing site actually go somewhere?
//
// The pricing CTAs were four `mailto:` links. A mailto is a dead button for anyone on a phone with
// no mail client configured or anyone using webmail: the click does nothing visible, and the lead
// leaves with no trace that they ever tried. Nothing on the page could tell you that, and no gate
// that reads the page would either — which is why this one asks the endpoints.
//
// It also checks the one thing that fails SILENTLY: the tier names in the page must match the
// server's allowlist in send-email.js, or an enquiry about the $35,000 plan is filed as "General".
//
//   node cta-check.mjs
//   node cta-check.mjs --canary
// ============================================================
import { readFileSync } from 'node:fs';

const CANARY = process.argv.includes('--canary');
const PAGE = 'sites/verdict-score/index.html';
const API = 'https://os.ventrify.io/api/send-email';
const ORIGIN = 'https://verdict.ventrify.io';
let fails = 0;
const ok = (c, m, got) => { console.log((c ? '  ok  ' : '  ✗   ') + m + (got !== undefined ? ' — ' + got : '')); if (!c) fails++; };

const page = readFileSync(PAGE, 'utf8');
const server = readFileSync('ventrify-os/api/send-email.js', 'utf8');

console.log('\n── the page');
const mailtos = (page.match(/mailto:/g) || []).length;
ok(CANARY ? mailtos > 0 : mailtos === 0, 'no mailto: left in the page', String(mailtos));

const tiers = [...page.matchAll(/(?:data-)?contact="([^"]+)"/g)].map(m => m[1]);
ok(tiers.length >= 3, 'the paid tiers open the contact dialog', tiers.join(', '));

// The silent failure: a tier the server does not recognise is filed as "General".
const allow = (server.match(/const TIERS = new Set\(\[([^\]]+)\]/) || [, ''])[1];
const known = new Set([...allow.matchAll(/'([^']+)'/g)].map(m => m[1]));
const unknown = [...new Set(tiers)].filter(t => !known.has(CANARY ? t + 'ZZZ' : t));
ok(!unknown.length, 'every tier the page sends is one the server knows', unknown.join(', ') || [...known].join('/'));

console.log('\n── the signup CTAs resolve');
const signups = [...new Set([...page.matchAll(/href="(https:\/\/os\.ventrify\.io\/workspace[^"]*)"/g)].map(m => m[1]))];
ok(signups.length > 0, 'the free-trial CTAs point at signup', signups.join(', '));
for (const u of signups) {
  const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36' }, redirect: 'manual' });
  ok(r.status === 200, `  ${u} answers 200 with no redirect`, 'status ' + r.status);
}

console.log('\n── the contact endpoint');
const pre = await fetch(API, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
ok(pre.status === 204, 'preflight is answered', 'status ' + pre.status);
ok(pre.headers.get('access-control-allow-origin') === ORIGIN, 'and allows the marketing origin', pre.headers.get('access-control-allow-origin'));

const evil = await fetch(API, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
ok(!evil.headers.get('access-control-allow-origin'), 'but not an origin that is not ours', evil.headers.get('access-control-allow-origin') || 'none');

const post = (b) => fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: ORIGIN }, body: JSON.stringify(b) })
  .then(async r => ({ s: r.status, b: await r.json().catch(() => ({})) }));

// Every case below is refused or discarded BEFORE Resend, so the gate never sends mail.
const hp = await post({ type: 'contact', name: 'Bot', email: 'bot@spam.example', tier: 'Founder', _hp: 'I am a bot' });
ok(hp.s === 200 && !hp.b.id, 'the honeypot is discarded silently — 200, nothing recorded', `${hp.s} ${JSON.stringify(hp.b)}`);

const bad = await post({ type: 'contact', name: 'Someone', email: 'not-an-email', tier: 'Founder' });
ok(bad.s === 400 && bad.b.error === 'bad_email', 'a malformed address is refused', `${bad.s} ${bad.b.error}`);

const noName = await post({ type: 'contact', email: 'someone@example.com', tier: 'Founder' });
ok(noName.s === 400 && noName.b.error === 'name_required', 'a missing name is refused', `${noName.s} ${noName.b.error}`);

console.log(fails ? `\n${fails} FAILED` : '\nevery CTA goes somewhere, and the form refuses what it should');
if (CANARY) { console.log(fails ? 'canary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL'); process.exit(fails ? 0 : 1); }
process.exit(fails ? 1 : 0);
