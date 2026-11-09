import puppeteer from '/Users/antonywhenman/Desktop/Ventrify/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
// ── THE GATE FOR: "no score has been produced for me" (2026-11-09) ────────────────────────────────────
//
// assess-next.html loads the score, the provenance cards, the data-room docs and the evidence ledger in
// FOUR Firestore reads that shared ONE try/catch and ran in SEQUENCE. A throw on the first left the other
// three unattempted and every result at its empty default, so a DENIED read rendered as a complete-looking
// assessment with the score silently missing. The operator reported a failed run; the run had published 76.
//
// This gate drives the REAL page in a REAL browser with the live data layer stubbed, makes one read throw,
// and asserts the page says so. Reading the source could not have caught this: the bug was control flow.
//
// Run against the demo server on :3200.

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };

// Cross-origin ES-module stubs (the gstatic auth SDK) need CORS or the dynamic import rejects.
const js = (body) => ({ status: 200, contentType: 'text/javascript',
  headers: { 'Access-Control-Allow-Origin': '*' }, body });

// A deliberately minimal live data layer. `failing` names the read that throws.
const dataStub = (failing, code) => js(`
  export const __calls = [];
  const note = (n) => { __calls.push(n); globalThis.__dataCalls = __calls; };
  const boom = (n) => { const e = new Error('Missing or insufficient permissions.'); e.code = ${JSON.stringify(code)}; e.name = 'FirebaseError'; throw e; };
  const ENG = {
    id: 'prg-gate', orgId: 'gateorg', name: 'Gate Venture', company: 'Gate Venture',
    engagementType: 'assessment', founderEmail: 'f@example.com',
    pitchDoc: { name: 'deck.pdf', uploadedAt: '2026-11-09T09:00:00.000Z', bytes: 1024 },
    runState: { phase: 'assess', status: 'done', step: 8, totalSteps: 12, progress: 100,
                startedAt: '2026-11-09T10:00:00.000Z', finishedAt: '2026-11-09T11:05:00.000Z' },
    investability: { composite: 76, band: 'PROMISING' },
    // The SEVENTEEN keys a real assess run publishes, with the SHAPES TAKEN FROM A REAL PUBLISHED
    // ASSESSMENT (types read off Firestore, content invented). A thin fixture makes the page crash for
    // reasons that have nothing to do with what this gate measures.
    assessment: {
      recommendation: 'Diligence further', thesis: 'A thesis.', biggestRisk: 'A risk.',
      conviction: 'Medium', theAsk: '2m on a SAFE.', updatedAt: '2026-11-09T11:05:00.000Z',
      mustBeTrue: ['One thing must hold.'], bear: ['The bear case.'], bull: ['The bull case.'],
      diligence: [{ item: 'Confirm the pipeline.', priority: 'High' }],
      exit: { acquirers: ['Acme', 'Globex'], path: 'Trade sale.', returns: '3-5x' },
      market: { note: 'Growing.', tam: { label: 'TAM', value: '1.0bn' },
                sam: { label: 'SAM', value: '200m' }, som: { label: 'SOM', value: '20m' } },
      team: { summary: 'Two founders.', gaps: ['No CTO'],
              members: [{ name: 'A Founder', role: 'CEO', background: 'Operator.', signal: 'Strong' }] },
      benchmark: { note: 'Mid-pack.', dimensions: ['Distribution'],
                   competitors: [{ name: 'Rival', isTarget: false, note: {}, cells: { Distribution: 'Direct' } }] },
      valuation: { note: 'Pre-money 10m.', verdict: 'Fair.',
                   comps: [{ name: 'Comp', stage: 'Seed', detail: '10m post.' }] },
      rounds: [{ company: 'Comp', stage: 'Seed', amount: '2m', valuation: '10m', investors: 'Angels' }],
      provenance: { marketReports: 3, competitors: 4, sources: 8, foundersResearched: true, rounds: 5 }
    }
  };
  export function setOrgContext() {}
  export async function listOperatorOrgs() { return [{ id: 'gateorg', name: 'Gate Org', operatorEmails: ['op@example.com'] }]; }
  export async function isSuperAdmin() { return false; }
  export async function listEngagements() { return [ENG]; }
  export async function getEngagement() { return ENG; }
  export async function listInvestabilitySnapshots() { note('snapshots'); if (${JSON.stringify(failing)} === 'snapshots') boom();
    return [{ id: 's1', composite: 76, band: 'PROMISING', maxPossible: 100, pct: 76, ratedCount: 35,
              computedAt: '2026-11-09T11:04:00.000Z', at: '2026-11-09T11:04:00.000Z',
              categories: [{ key: 'market', label: 'Market Opportunity', weight: 0.2, sum: 3.5, max: 5, rated: 5, pending: 0, band: 'yellow', subs: [] }] }]; }
  export async function listCardsForEngagement() { note('cards'); if (${JSON.stringify(failing)} === 'cards') boom(); return []; }
  export async function listHubDocs() { note('hubDocs'); if (${JSON.stringify(failing)} === 'hubDocs') boom(); return []; }
  export async function listOperatorEvidence() { note('evidence'); if (${JSON.stringify(failing)} === 'evidence') boom(); return []; }
  export function watchEngagement() { return () => {}; }
  export function watchEngagements() { return () => {}; }
  export async function getOrg() { return { id: 'gateorg', name: 'Gate Org' }; }
  export async function listOrgs() { return []; }
`);

async function run(failing, code) {
  const p = await b.newPage();
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = r.url();
    if (u.includes('/firebase/data.js'))    return r.respond(dataStub(failing, code));
    if (u.includes('/firebase/firebase.js')) return r.respond(js('export const auth = { currentUser: { email: "op@example.com", uid: "u1", getIdToken: async () => "t" } };'));
    if (u.includes('/firebase/config.js'))   return r.respond(js('export const FIREBASE_ENABLED = true;\nexport const firebaseConfig = {};'));
    // NOTE: the callback must fire ASYNCHRONOUSLY. app.js does `const unsub = onAuthStateChanged(auth,
    // u => { unsub(); ... })`, so a synchronous callback hits `unsub` in its TDZ. Real Firebase always
    // defers, so this is a faithful stub rather than a workaround.
    if (u.includes('firebase-auth.js'))      return r.respond(js('export function onAuthStateChanged(a, cb) { setTimeout(() => cb({ email: "op@example.com", uid: "u1", displayName: "Op" }), 0); return () => {}; }\nexport function getAuth() { return {}; }'));
    r.continue();
  });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
  await p.setViewport({ width: 1280, height: 1000 });
  await p.goto('http://localhost:3200/workspace/assess-next.html?id=prg-gate', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  const out = await p.evaluate(() => {
    const fail = document.getElementById('ea-load-fail');
    const txt = document.body.innerText || '';
    return {
      live: !!(window.WORKSPACE && window.WORKSPACE.mode === 'live'),
      banner: !!(fail && fail.querySelector('.run-banner')),
      bannerText: fail ? (fail.innerText || '').replace(/\s+/g, ' ').trim() : '',
      calls: (window.__dataCalls || []).slice(),
      scoreShown: /\b76\b/.test(txt),
    };
  });
  await p.close();
  return { ...out, errs };
}

console.log('\n── 1. the first read is DENIED (the reported bug) ──');
let r = await run('snapshots', 'permission-denied');
ok(r.live, 'page booted in LIVE mode (the stubbed path is the real one)');
ok(r.banner, 'a failure banner is rendered — the page does NOT stay silent');
ok(/could not/i.test(r.bannerText), `banner explains the failure  ["${r.bannerText.slice(0, 80)}…"]`);
ok(/permission-denied/.test(r.bannerText), 'banner names the error code, so it is diagnosable without a console');
ok(r.calls.includes('cards') && r.calls.includes('hubDocs') && r.calls.includes('evidence'),
   `the other three reads STILL RAN  [${r.calls.join(', ')}]`);
ok(!r.errs.length, `no uncaught page errors  ${r.errs.slice(0, 1).join(' | ')}`);

console.log('\n── 2. a LATER read fails: score must still render ──');
r = await run('hubDocs', 'permission-denied');
ok(r.banner, 'failure still reported');
ok(r.scoreShown, 'the score (76) still renders — one bad read does not erase a good one');

console.log('\n── 3. CANARY: nothing fails → no banner ──');
r = await run('none', 'permission-denied');
ok(!r.banner, 'no banner on a healthy load (the gate can tell the difference)');
ok(r.scoreShown, 'score renders on a healthy load');
ok(r.calls.length === 4, `all four reads ran  [${r.calls.join(', ')}]`);

await b.close();
console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all checks passed\n');
process.exit(fails ? 1 : 0);
