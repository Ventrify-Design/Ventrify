import puppeteer from '/Users/antonywhenman/Desktop/Ventrify/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
// ── EVERY TOOL IN THE UTILITY RAIL MUST DO SOMETHING ──────────────────────────────────────────────────
//
// ds.js wires each rail button to window.RAIL_ACTIONS[tool] (a handler) or window.RAIL_PANELS[panel]
// (authored content). A tool bound to NEITHER does not fail — it silently opens ds.railPanel(), a panel
// whose entire body is "The <X> tool opens here as a side panel" plus four grey skeleton lines. To an
// operator that is indistinguishable from a half-built feature, and it is what prompted "there is some
// functionality that isn't working in the product".
//
// share-upsell.mjs already joins the rail against the handler map, but only for ids carrying a
// `capability`. Every id WITHOUT one — activity, discuss, research_peek, view_settings, help — was exempt
// from the only check that could have caught this. This gate exempts nothing.
//
// It CLICKS each tool in a real browser and reads the panel that opens, because the binding is resolved
// at runtime from two window globals: no amount of source reading proves what a click does.
//
// Run against the server on :3200.

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };

const js = (body) => ({ status: 200, contentType: 'text/javascript',
  headers: { 'Access-Control-Allow-Origin': '*' }, body });

// Minimal live data layer: enough for the shell to boot signed-in, so the rail actually renders.
const DATA_STUB = js(`
  const ENG = {
    id: 'prg-gate', orgId: 'gateorg', name: 'Gate Venture', company: 'Gate Venture', ventureName: 'Gate Venture',
    engagementType: 'assessment', founderEmail: 'f@example.com',
    pitchDoc: { name: 'deck.pdf', uploadedAt: '2026-11-09T09:00:00.000Z', bytes: 1024 }, stage: 'seed',
    runState: { phase: 'assess', status: 'done', step: 8, totalSteps: 12, progress: 100,
                startedAt: '2026-11-09T10:00:00.000Z', finishedAt: '2026-11-09T11:05:00.000Z' },
    investability: { composite: 76, band: 'PROMISING' },
    assessment: { recommendation: 'Diligence further', thesis: 'A thesis.', biggestRisk: 'A risk.',
      conviction: 'Medium', theAsk: '2m on a SAFE.', updatedAt: '2026-11-09T11:05:00.000Z',
      mustBeTrue: ['One thing must hold.'], bear: ['The bear case.'], bull: ['The bull case.'],
      diligence: [{ item: 'Confirm the pipeline.', priority: 'High' }],
      exit: { acquirers: ['Acme'], path: 'Trade sale.', returns: '3-5x' },
      market: { note: 'Growing.', tam: { label: 'TAM', value: '1.0bn' }, sam: { label: 'SAM', value: '200m' }, som: { label: 'SOM', value: '20m' } },
      team: { summary: 'Two founders.', gaps: ['No CTO'], members: [{ name: 'A Founder', role: 'CEO', background: 'Operator.', signal: 'Strong' }] },
      benchmark: { note: 'Mid-pack.', dimensions: ['Distribution'], competitors: [{ name: 'Rival', isTarget: false, note: {}, cells: { Distribution: 'Direct' } }] },
      valuation: { note: 'Pre-money 10m.', verdict: 'Fair.', comps: [{ name: 'Comp', stage: 'Seed', detail: '10m post.' }] },
      rounds: [{ company: 'Comp', stage: 'Seed', amount: '2m', valuation: '10m', investors: 'Angels' }],
      provenance: { marketReports: 3, competitors: 4, sources: 8, foundersResearched: true, rounds: 5 } }
  };
  export function setOrgContext() {}
  export async function listOperatorOrgs() { return [{ id: 'gateorg', name: 'Gate Org', operatorEmails: ['op@example.com'] }]; }
  export async function isSuperAdmin() { return false; }
  export async function listEngagements() { return [ENG]; }
  export async function getEngagement() { return ENG; }
  export async function listInvestabilitySnapshots() { return [{ id: 's1', composite: 76, band: 'PROMISING',
    maxPossible: 100, pct: 76, ratedCount: 35, computedAt: '2026-11-09T11:04:00.000Z', at: '2026-11-09T11:04:00.000Z',
    categories: [{ key: 'market', label: 'Market Opportunity', weight: 0.2, sum: 3.5, max: 5, rated: 5, pending: 0, band: 'yellow', subs: [] }] }]; }
  export async function listCardsForEngagement() { return []; }
  export async function listHubDocs() { return []; }
  export async function listOperatorEvidence() { return []; }
  export async function listActions() { return []; }
  export function watchEngagement() { return () => {}; }
  export function watchEngagements() { return () => {}; }
  export async function getOrg() { return { id: 'gateorg', name: 'Gate Org' }; }
  export async function listOrgs() { return []; }
`);

const PAGES = [
  ['portfolio',  'dashboard-m3.html'],
  ['queue',      'queue-m3.html'],
  ['assessment', 'assess-next.html?id=prg-gate'],
];

const PLACEHOLDER = /tool opens here as a side panel/i;
const report = [];
const norail = [];

for (const [name, url] of PAGES) {
  const p = await b.newPage();
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = r.url();
    if (u.includes('/firebase/data.js'))     return r.respond(DATA_STUB);
    if (u.includes('/firebase/firebase.js')) return r.respond(js('export const auth = { currentUser: { email: "op@example.com", uid: "u1", getIdToken: async () => "t" } };'));
    if (u.includes('/firebase/config.js'))   return r.respond(js('export const FIREBASE_ENABLED = true;\nexport const firebaseConfig = {};'));
    if (u.includes('firebase-auth.js'))      return r.respond(js('export function onAuthStateChanged(a, cb) { setTimeout(() => cb({ email: "op@example.com", uid: "u1", displayName: "Op" }), 0); return () => {}; }\nexport function getAuth() { return {}; }'));
    r.continue();
  });
  await p.setViewport({ width: 1440, height: 950 });
  await p.goto(`http://localhost:3200/workspace/${url}`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2800));

  // The masthead, while we are here: share was promoted off the rail onto it (RULE 5), and the
  // conformance gate allows exactly one filled button — so both facts are read from the rendered page.
  const mast = await p.evaluate(() => [...document.querySelectorAll('.m3-masthead .m3-btn, .masthead .m3-btn')]
    .map(b => ({ label: (b.innerText || '').replace(/\s+/g, ' ').trim(), filled: b.classList.contains('filled') })));
  if (mast.length) {
    console.log(`   masthead: ${mast.map(m => `${m.label}${m.filled ? ' [filled]' : ''}`).join('  ·  ')}`);
    if (name === 'assessment') {
      ok(mast.some(m => /share/i.test(m.label)), 'Share renders on the assessment masthead, not the rail');
      ok(mast.filter(m => m.filled).length <= 1, `at most one filled masthead button (${mast.filter(m => m.filled).length})`);
    }
  }

  const tools = await p.evaluate(() => [...document.querySelectorAll('.urail-item')]
    .map(el => ({ tool: el.dataset.tool || '', label: el.getAttribute('aria-label') || '' })));

  console.log(`\n── ${name}  (${tools.length} rail tools)`);
  // No rail rendered is not a failure — dashboard-m3 and queue-m3 call pageShell WITHOUT one, so the
  // rails ACTION_MODEL declares for `portfolio` and `queue` are dead config. That is asserted separately
  // below, against the model, rather than guessed at from an empty DOM.
  if (!tools.length) { console.log('   (this page renders no utility rail)'); norail.push(name); await p.close(); continue; }

  // A tool bound via RAIL_ACTIONS runs a HANDLER and deliberately opens no panel (deal_memo downloads,
  // share opens its own flow). Reading .aux-body after such a click returns the PREVIOUS panel's text,
  // which made the first version of this gate report both as placeholders. Ask the page what is bound.
  const bound = await p.evaluate(() => ({
    actions: Object.keys(window.RAIL_ACTIONS || {}),
    panels:  Object.keys(window.RAIL_PANELS || {}),
  }));
  console.log(`   bound: RAIL_ACTIONS[${bound.actions.join(' ') || '—'}]  RAIL_PANELS[${bound.panels.join(' ') || '—'}]`);

  for (const t of tools) {
    const click = (sel) => p.evaluate((s) => { const el = document.querySelector(`.urail-item[data-tool="${s}"]`); if (el) el.click(); }, sel);
    if (bound.actions.includes(t.tool)) {
      report.push({ page: name, tool: t.tool, label: t.label, placeholder: false, how: 'handler' });
      console.log(`   real (handler) ${t.label.padEnd(18)}→ RAIL_ACTIONS.${t.tool}`);
      continue;
    }
    // Clear the panel first, so a stale body can never be mistaken for this tool's content.
    await p.evaluate(() => { const el = document.querySelector('.m3-aux .aux-body'); if (el) el.innerHTML = '<!--cleared-->'; window.closeAux && window.closeAux(); });
    await new Promise(r => setTimeout(r, 160));
    await click(t.tool);
    await new Promise(r => setTimeout(r, 450));
    const body = await p.evaluate(() => {
      const el = document.querySelector('.m3-aux .aux-body');
      return { text: el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '', opened: !!el };
    });
    const ph = PLACEHOLDER.test(body.text) || body.text === '';
    report.push({ page: name, tool: t.tool, label: t.label, placeholder: ph, how: ph ? 'placeholder' : 'panel' });
    console.log(`   ${ph ? 'PLACEHOLDER   ' : 'real (panel)  '} ${t.label.padEnd(18)}${ph ? '' : '→ ' + body.text.slice(0, 50)}`);
    await click(t.tool);
    await new Promise(r => setTimeout(r, 140));
  }
  await p.close();
}

// ── dead rail config: a rail declared in the model for a page that renders none ──
const { ACTION_MODEL } = await import('../shared/actions.js');
const PAGE_KEY = { portfolio: 'portfolio', queue: 'queue', assessment: 'assess' };
const dead = norail.map(n => PAGE_KEY[n]).filter(k => ((ACTION_MODEL[k] || {}).rail || []).length);

console.log('\n── verdict ──');
ok(dead.length === 0, dead.length
  ? `ACTION_MODEL declares a rail for ${dead.join(', ')}, but those pages render none — dead config: ${dead.map(k => `${k}:[${ACTION_MODEL[k].rail.join(' ')}]`).join('  ')}`
  : 'no page declares a rail it does not render');
const bad = report.filter(r => r.placeholder);
ok(bad.length === 0, bad.length
  ? `${bad.length} rail tool(s) open a PLACEHOLDER: ${bad.map(r => `${r.page}/${r.tool}`).join(', ')}`
  : 'every rail tool on every page is bound to a handler or authored content');
ok(report.length > 0, `${report.length} rail tools exercised in total`);

await b.close();
console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all checks passed\n');
process.exit(fails ? 1 : 0);
