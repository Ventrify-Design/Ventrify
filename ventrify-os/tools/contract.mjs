#!/usr/bin/env node
// ============================================================
// contract — does every endpoint the browser can call actually ANSWER?
//
// THE GATE THAT WAS MISSING. On 2026-10-31 five new pre-screen actions were written, covered by 141
// offline checks, and deployed. Every one was unreachable: memo.js guards its dispatcher with an ACTIONS
// whitelist and none had been added to it. The first thing a real customer saw was `bad_action`.
//
// Every gate in tools/ that covered that work READ SOURCE TEXT. Reading proves you wrote what you meant
// to write. It cannot prove the code runs, is reachable, or is wired to anything. This gate sends real
// authenticated requests and reads the real replies.
//
// WHAT COUNTS AS A PASS. Not 200 — most of these actions legitimately refuse a bogus engagement id. A
// pass is "the dispatcher recognised this action and the handler ran far enough to make a judgement".
// `bad_action`, 404 and 500 are failures; `not_found`, `forbidden` and a validation refusal are proof of
// life. The distinction is the whole point: it separates "unreachable" from "reached and declined".
//
// Costs nothing. No model is called: every action is given input it will reject before it spends.
//
//   node tools/contract.mjs                      # production
//   node tools/contract.mjs http://localhost:3000
// ============================================================
import { readFile } from 'node:fs/promises';
import { idTokenFor } from './contract-auth.mjs';

const BASE = (process.argv[2] || 'https://os.ventrify.io').replace(/\/$/, '');
const ROOT = new URL('../', import.meta.url);
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

// THE ONLY THING THIS GATE MEASURES is whether a request reached a handler. Everything else is noise,
// and getting that line wrong is how a gate reports twenty failures against healthy code — which is
// what the first version of this file did, by treating a 404 `engagement_not_found` as death. It is the
// opposite: it means the dispatcher recognised the action, the handler ran, and it declined on the
// deliberately-bogus id we sent. That IS proof of life.
const DEAD = new Set(['bad_action', 'unknown_action', 'method_not_allowed', 'not_found']);
const isDead = (r) => DEAD.has(r.error) || r.status === 405 || r.status >= 500 || (r.status === 404 && !r.error);

// A client file names the endpoint it posts to, but not which action goes to which. So probe every
// endpoint a client actually calls and pass if ANY of them recognises the action — "is this reachable
// somewhere" is the question that matters, and it needs no brittle pairing.
const ENDPOINTS = ['/api/memo', '/api/ingest-docs', '/api/dispatch-run', '/api/send-email', '/api/admin',
                   '/api/create-engagement', '/api/update-org', '/api/manage-operator', '/api/notify'];

async function post(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { idToken: token, ...body } : body),
  });
  let d = {}; try { d = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, error: d.error || null, body: d };
}

// EVERY action the browser can post, AND THE ENDPOINT THAT OWNS IT, discovered from the client source
// rather than listed by hand — a hand-kept list is the same class of bug this gate exists to catch.
//
// Owner resolution: a file that talks to exactly one /api/ route owns all its actions there (prescreen2.js
// posts everything through one `post()` helper, so "nearest preceding fetch" would find nothing). A file
// with several routes pairs each action with the nearest fetch above it, which is how
// engagement-actions.js is written — one fetch then one action, per function.
async function discoverActions() {
  const files = ['workspace/prescreen2.js', 'workspace/prescreen.js', 'workspace/assess-next.html',
                 'workspace/engagement-actions.js', 'workspace/workspace-m3.js'];
  const found = new Map();
  for (const f of files) {
    let src; try { src = await readFile(new URL(f, ROOT), 'utf8'); } catch { continue; }
    const routes = [...new Set([...src.matchAll(/fetch\('(\/api\/[a-z-]+)'/g)].map(m => m[1]))];
    if (!routes.length) continue;
    for (const m of src.matchAll(/action:\s*'([a-z0-9-]+)'/gi)) {
      if (found.has(m[1])) continue;
      let owner = routes[0];
      if (routes.length > 1) {
        // nearest fetch above this action
        const before = src.slice(0, m.index);
        const all = [...before.matchAll(/fetch\('(\/api\/[a-z-]+)'/g)];
        if (all.length) owner = all[all.length - 1][1];
      }
      found.set(m[1], { file: f, endpoint: owner });
    }
  }
  return found;
}

console.log(`\nCONTRACT — ${BASE}\n`);

console.log('1. AUTHENTICATION IS ENFORCED, AND THE ENDPOINT IS ALIVE');
const unauth = await post('/api/memo', { action: 'ps2-brief', engagementId: 'contract-probe' });
ok(unauth.status === 401 && unauth.error === 'no_token', `an unauthenticated call is refused (${unauth.status} ${unauth.error})`);

let token = null;
try {
  const operator = process.env.CONTRACT_OPERATOR || 'antonywhenman@icloud.com';
  const t = await idTokenFor(operator);
  token = t.idToken;
  ok(true, `minted an ID token for ${t.email}`);
} catch (e) {
  ok(false, 'could not mint a token: ' + String(e.message || e).slice(0, 140));
  console.log('\n  Without a token this gate can only prove the endpoint rejects anonymous calls.');
  console.log('  Set CONTRACT_OPERATOR to an operator email that exists in the project.');
}

console.log('\n2. EVERY ACTION THE CLIENT CAN POST IS REACHABLE');
// A BASELINE DIFFERENTIAL, not a list of error codes I think mean "alive". Both dispatchers check the
// action BEFORE they look the engagement up — memo.js at line 161 against line 173, ingest-docs.js at
// line 83 against line 92 — so with a deliberately bogus id:
//
//     an action it does not know  -> its "I don't know this" answer (bad_action / bad_request)
//     an action it does know      -> it proceeds, and fails on the id (engagement_not_found)
//
// So measure each endpoint's answer to a NONSENSE action first, then an action is recognised exactly
// when its answer differs from that. No hand-kept set of codes to drift, it works for any endpoint that
// dispatches before validating, and it is what makes the canary below meaningful.
//
// This is precisely the shape of the 2026-10-31 bug: ps2-brief would have answered `bad_action` — the
// same as nonsense — at every endpoint, so it was reachable from nowhere.
const actions = await discoverActions();
console.log(`     discovered ${actions.size} action(s) across the client source\n`);
const BOGUS_ID = 'contract-probe-does-not-exist';
const sig = (r) => `${r.status}:${r.error || ''}`;

if (token) {
  const baseline = new Map();
  for (const ep of ENDPOINTS) {
    const r = await post(ep, { action: 'nonsense-' + Math.random().toString(36).slice(2), engagementId: BOGUS_ID }, token);
    baseline.set(ep, sig(r));
  }

  // An endpoint whose answer to NONSENSE is already an id-rejection validates the engagement before it
  // dispatches (api/dispatch-run.js does: line 50 against line 70). This probe cannot tell a recognised
  // action from an unrecognised one there, and it says so instead of guessing either way.
  const opaque = (ep) => /engagement_not_found/.test(baseline.get(ep) || '');

  const recognises = async (action, owner) => {
    const order = [owner, ...ENDPOINTS.filter(e => e !== owner)];
    for (const ep of order) {
      const r = await post(ep, { action, engagementId: BOGUS_ID }, token);
      if (sig(r) !== baseline.get(ep)) return { ep, r };
    }
    return null;
  };

  let unknown = 0;
  for (const [action, src] of [...actions].sort()) {
    const hit = await recognises(action, src.endpoint);
    if (hit) {
      ok(true, `${action.padEnd(20)} ${hit.ep.replace('/api/', '').padEnd(18)} ${hit.r.status} ${hit.r.error || 'ok'}`);
    } else if (opaque(src.endpoint)) {
      unknown++;
      console.log(`  --  ${action.padEnd(20)} ${src.endpoint.replace('/api/', '').padEnd(18)} cannot be told apart — this route checks the id first`);
    } else {
      ok(false, `${action.padEnd(20)} ${'NOWHERE'.padEnd(18)} ← UNREACHABLE, posted from ${src.file}`);
    }
  }
  if (unknown) console.log(`\n     ${unknown} action(s) unprovable here. They would need a real engagement, which this gate will not use: half of them spend money.`);

  console.log('\n2b. THE DETECTOR STILL DETECTS (canary)');
  // If an action that cannot exist is reported reachable, the criterion above has drifted and every
  // "ok" in section 2 is decoration. The first version of this gate failed exactly here.
  // Owner '/api/memo' deliberately: that is where the whitelist lives, and it is the exact path the
  // 2026-10-31 bug took. An invented action there must be indistinguishable from an unwhitelisted real
  // one — so if this canary passes, the gate WOULD have caught that bug, and section 2 means something.
  const canary = await recognises('definitely-not-a-real-action-' + Date.now(), '/api/memo');
  ok(!canary, 'an invented action at /api/memo is UNREACHABLE — so an unwhitelisted one would be too'
            + (canary ? ` (but ${canary.ep} answered ${sig(canary.r)})` : ''));
  ok(!opaque('/api/memo'), '/api/memo dispatches before it validates, which is what makes that provable');
} else {
  for (const a of actions.keys()) console.log(`  --  ${a} (not probed — no token)`);
}

console.log('\n3. THE OTHER DEPLOYED FUNCTIONS ANSWER');
// Liveness, not action-recognition: an endpoint that answers `unknown_action` to an empty body has
// plainly run. Only a 404 on the route itself, a 405 or a 5xx means nothing is there.
const notThere = (r) => r.status === 405 || r.status >= 500 || (r.status === 404 && !r.error);
for (const p of ['/api/ingest-docs', '/api/create-engagement', '/api/dispatch-run', '/api/admin']) {
  const r = await post(p, {}, token);
  ok(!notThere(r), `${p.padEnd(26)} ${r.status} ${r.error || ''}${notThere(r) ? '  ← DEAD' : ''}`);
}

console.log('\n4. THE CLIENT MODULES THE PAGES IMPORT ARE SERVED');
for (const p of ['/workspace/prescreen2.js', '/workspace/prescreen.js', '/shared/m3/ds.js',
                 '/shared/m3/workspace-chrome.css', '/shared/actions.js', '/shared/vss-rubric.js']) {
  const r = await fetch(BASE + p);
  ok(r.ok, `${p.padEnd(34)} ${r.status}`);
}

console.log(fails ? `\n${fails} FAILURE(S) — something the browser can ask for does not answer` : '\nall contracts hold');
process.exit(fails ? 1 : 0);
