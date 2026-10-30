/* ═══════════════════════════════════════════════════════════════════════════
   VISUAL BASELINE — a before/after record, deliberately NOT a pass/fail gate.

   A pixel-diff gate is the wrong instrument for a re-skin: every page is
   MEANT to change, so it would fail on everything and teach everyone to
   ignore it. What is actually needed is the ability to see what changed and
   say whether it was intended. So this captures, and `--compare` builds a
   side-by-side sheet against the saved capture.

   The number gate (tools/number-fidelity.mjs) is the one that blocks. This
   one informs. Keeping them separate is the point: data must not move, looks
   must.

     node tools/visual-baseline.mjs --save      capture to _baselines/visual/
     node tools/visual-baseline.mjs --compare   sheet vs the saved capture
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, '../_baselines/visual');
const BASE = process.env.OS_BASE || 'http://localhost:3200';
const MODE = process.argv.includes('--save') ? 'save'
           : process.argv.includes('--compare') ? 'compare' : '';
if (!MODE) { console.error('  use --save or --compare'); process.exit(1); }

const PAGES = [
  ['login',     '/workspace/index.html'],
  ['setup',     '/workspace/setup.html'],
  ['portfolio', '/workspace/dashboard-m3.html'],
  ['queue',     '/workspace/queue-m3.html'],
  ['team',      '/workspace/team-m3.html'],
  ['settings',  '/workspace/settings-m3.html'],
  ['admin',     '/workspace/admin-m3.html'],
  ['assess',    '/workspace/assess-next.html'],
];
const WIDTHS = [[1440, 'desk'], [390, 'mob']];

async function demoPage(browser, w) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: 1000, deviceScaleFactor: 1 });
  await p.setRequestInterception(true);
  p.on('request', async req => {
    if (req.url().endsWith('/firebase/config.js')) {
      try {
        const src = await (await fetch(req.url())).text();
        return req.respond({ status: 200, contentType: 'application/javascript',
          body: src.replace(/export const FIREBASE_ENABLED\s*=\s*true/, 'export const FIREBASE_ENABLED = false') });
      } catch { /* fall through */ }
    }
    req.continue();
  });
  return p;
}

// ⚠ A fullPage screenshot RESIZES THE VIEWPORT, which restarts CSS animations — and the reveal
// animation (ds.css `ch-growx`) runs with `animation-fill-mode: both` behind a staggered delay, so
// before it starts the element holds its `from` state of scaleX(0). The capture therefore caught every
// bar, span and meter at ZERO WIDTH: baselines of a state no user has ever seen, and a gate that could
// not have noticed a real regression in any of them.
//
// Proven rather than assumed: the same bar sampled at the same point read rgb(185,167,255) in a
// viewport capture and rgb(59,63,67) — the empty track — in a fullPage one.
//
// Forcing duration/delay to ~0 lands `both` on the END state immediately, which is what the page
// settles to anyway. Disabling animations outright would work here too, but would silently change
// anything whose resting style differs from its keyframe end.
async function settleAnimations(p) {
  await p.addStyleTag({ content: `*, *::before, *::after {
    animation-duration: 1ms !important; animation-delay: 0s !important;
    transition-duration: 1ms !important; transition-delay: 0s !important;
  }` });
  await new Promise(r => setTimeout(r, 120));
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'], protocolTimeout: 180000 });

const target = MODE === 'save' ? DIR : resolve(DIR, '../visual-current');
mkdirSync(target, { recursive: true });
for (const [name, path] of PAGES) {
  for (const [w, tag] of WIDTHS) {
    const p = await demoPage(browser, w);
    try {
      await p.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2200));
      await settleAnimations(p);
      await p.screenshot({ path: `${target}/${name}-${tag}.png`, fullPage: true });
    } catch { /* recorded as missing */ }
    await p.close();
  }
  console.log(`  captured ${name}`);
}

if (MODE === 'compare') {
  const b64 = f => existsSync(f) ? readFileSync(f).toString('base64') : '';
  const rows = PAGES.map(([n]) => {
    const before = b64(`${DIR}/${n}-desk.png`), after = b64(`${target}/${n}-desk.png`);
    if (!before || !after) return '';
    return `<div style="padding:10px 0 4px">${n}</div><div style="display:flex;gap:10px">
      <div style="flex:1"><div style="padding:2px 0;color:#667">before</div>
        <img src="data:image/png;base64,${before}" style="width:100%;border:1px solid #2a2a33"></div>
      <div style="flex:1"><div style="padding:2px 0;color:#667">after</div>
        <img src="data:image/png;base64,${after}" style="width:100%;border:1px solid #2a2a33"></div>
    </div>`;
  }).join('');
  const p = await browser.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  await p.setContent(`<body style="margin:0;background:#0d0d11;font:12px ui-monospace,monospace;color:#9aa;padding:16px">${rows}</body>`);
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: resolve(DIR, '../visual-compare.png'), fullPage: true });
  console.log(`\n  sheet → ${resolve(DIR, '../visual-compare.png')}`);
}
await browser.close();
console.log(MODE === 'save' ? `\n  baseline → ${DIR}` : '');
