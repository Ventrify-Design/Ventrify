#!/usr/bin/env node
/**
 * surface-audit — no live surface may render an UNEXPLAINED filled card tub.
 *
 * WHY. The product moved from Material's filled-card language to an editorial one
 * (hairlines + type, no containers). That migration was done screen by screen, by eye,
 * and it missed things — most visibly the FIRST-RUN screen, which is the first thing a
 * new customer ever sees and was still three nested layers of tub long after the queue,
 * the roster and the assessment had moved.
 *
 * It was missed for a reason worth encoding: the demo org HAS engagements, so the empty
 * state never rendered during review. Every check — mine and every screenshot — looked at
 * the populated page. A surface you cannot make appear is a surface nobody audits, so this
 * gate drives each page into its CONDITIONAL states too (§STATES below) and audits each.
 *
 * ALLOWED tubs are listed explicitly with a reason. A card is the right answer sometimes —
 * a centred sign-in panel floating on a photograph, a call-to-action banner. The rule is
 * not "no cards", it is "no card nobody decided on".
 */
import puppeteer from 'puppeteer';

const BASE = process.env.WS_BASE || 'http://localhost:3200/workspace';

/* Each entry: a page, plus an optional mutation that forces a conditional state.
   `empty` rewrites the demo fixture in flight so the first-run branch renders. */
const STATES = [
  { page: 'dashboard-m3.html',          label: 'Portfolio' },
  { page: 'dashboard-m3.html',          label: 'Portfolio — FIRST RUN', empty: true },
  { page: 'queue-m3.html',              label: 'Action queue' },
  { page: 'queue-m3.html',              label: 'Action queue — EMPTY',  empty: true },
  { page: 'team-m3.html',               label: 'Team' },
  { page: 'settings-m3.html',           label: 'Settings' },
  { page: 'admin-m3.html',              label: 'Admin' },
  { page: 'assess-next.html?id=prg-07', label: 'Assessment — scored' },
  { page: 'assess-next.html?id=prg-01', label: 'Assessment — forming' },
  { page: 'setup.html',                 label: 'Setup' },
];

/* class-signature -> why this one is deliberate. Anything not here fails the gate. */
const ALLOWED = {
  'note-card':               'call-to-action banner (upload a deck / run blocked) — an alert, not a content container',
  'signin-card.setup-card':  'the centred first-run panel floating on the masthead photograph',
  'setup-preview':           'brand preview swatch inside that panel — it is showing a surface, so it needs one',
  'signin-card':             'the sign-in panel, same reason',
};

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});

const fails = [];
const lines = [];
for (const st of STATES) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 1100 });
  await p.setRequestInterception(true);
  p.on('request', async req => {
    const u = req.url();
    if (u.includes('firebase/config.js')) {
      const t = await fetch(u).then(x => x.text());
      return req.respond({ status: 200, contentType: 'application/javascript',
        body: t.replace(/export const FIREBASE_ENABLED\s*=\s*true/, 'export const FIREBASE_ENABLED = false') });
    }
    if (st.empty && u.includes('sample-data.js')) {
      const t = await fetch(u).then(x => x.text());
      return req.respond({ status: 200, contentType: 'application/javascript',
        body: t + '\n;try{window.WORKSPACE_SAMPLE.programs=[];window.WORKSPACE_SAMPLE.actions=[];}catch(e){}' });
    }
    req.continue();
  });
  try {
    await p.goto(`${BASE}/${st.page}`, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 1300));
    const found = await p.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll('.m3-card')) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;   // not a tub
        const sig = [...el.classList].filter(c => c !== 'm3-card').slice(0, 2).join('.') || '(bare m3-card)';
        out[sig] = (out[sig] || 0) + 1;
      }
      return out;
    });
    const bad = Object.entries(found).filter(([sig]) => !(sig in ALLOWED));
    const ok  = Object.entries(found).filter(([sig]) =>  (sig in ALLOWED));
    lines.push(`  ${st.label.padEnd(26)} ${bad.length ? `${bad.reduce((a,[,n])=>a+n,0)} UNEXPLAINED` : '✓'}` +
               (ok.length ? `   (${ok.map(([s,n])=>`${n}× ${s} — allowed`).join('; ')})` : ''));
    for (const [sig, n] of bad) fails.push(`${st.label}: ${n}× .m3-card.${sig} — a filled tub with no entry in ALLOWED. Make it editorial, or add it to ALLOWED with the reason.`);
  } catch (e) {
    fails.push(`${st.label}: could not render — ${String(e).slice(0, 90)}`);
  }
  await p.close();
}
await browser.close();

console.log(`surface-audit    ${STATES.length} page states, including the conditional ones`);
lines.forEach(l => console.log(l));
if (fails.length) { console.error('\nFAIL'); fails.forEach(f => console.error('  ' + f)); process.exit(1); }
console.log('                 no unexplained card tubs on any live surface');
