// Drill-pattern gate — exercises the shell mechanism, not just its static markup.
import puppeteer from '/Users/antonywhenman/Desktop/Ventrify/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
const URL = 'http://localhost:3200/_redesign/m3/drill.html';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await browser.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const state = () => p.evaluate(() => {
  const app = document.querySelector('.m3-app');
  const surf = document.querySelector('.m3-drill');
  const main = document.querySelector('.shell-main');
  const de = document.documentElement;
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; };
  return {
    drillOpen: app.classList.contains('drill-open'),
    rail: app.classList.contains('rail'),
    compact: main.classList.contains('is-compact'),
    role: surf && surf.getAttribute('role'),
    ariaModal: surf && surf.getAttribute('aria-modal'),
    ariaHidden: surf && surf.getAttribute('aria-hidden'),
    primaryInert: main.hasAttribute('inert'),
    hOverflow: de.scrollWidth > de.clientWidth + 1,
    shellMainIsPrimary: document.querySelector('.shell-main') === main,
    mastheadFirstIsPrimary: document.querySelector('.masthead') === main.querySelector('.masthead'),
    filled: document.querySelectorAll('.mh-actions .m3-btn.filled').length,
    focusInDrill: !!(document.activeElement && document.activeElement.closest('.m3-drill')),
    mainScroll: main.scrollTop,
    drillScroll: (document.querySelector('.drill-scroll') || {}).scrollTop,
    primaryBox: box(main), drillBox: box(surf),
    crumb: surf ? (surf.querySelector('.mh-orient') || {}).textContent : '',
    title: surf ? ((surf.querySelector('.mh-hero .headline-m') || {}).textContent || '') : '',
    tableStacked: getComputedStyle(document.querySelector('.eng-table tr')).display === 'block',
  };
});

// ─────────── 1440: closed baseline ───────────
await p.setViewport({ width: 1440, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await wait(700);
let s = await state();
ok('closed: no drill-open', !s.drillOpen);
ok('closed: .shell-main is the primary', s.shellMainIsPrimary);
ok('closed: first .masthead is the primary\'s', s.mastheadFirstIsPrimary);
ok('closed: ≤1 filled action', s.filled <= 1, `filled=${s.filled}`);
ok('closed: no horizontal overflow', !s.hOverflow);
await p.evaluate(() => { document.querySelector('.shell-main').scrollTop = 240; });
await wait(400);
const minified = await p.evaluate(() => +getComputedStyle(document.querySelector('.masthead')).getPropertyValue('--mh-p') > 0.3);
ok('closed: masthead minifies on scroll', minified);
await p.evaluate(() => { document.querySelector('.shell-main').scrollTop = 200; });

// ─────────── 1440: open (split) ───────────
// dispatch the click programmatically: the primary is parked at scrollTop=200 (to prove scroll is
// preserved across open/close), which puts row ws-1 under the sticky masthead. A real hit-tested
// click is exercised below on ws-4 / ws-5.
await p.evaluate(() => document.querySelector('[data-drill="ws-1"]').click());
await wait(600);
s = await state();
ok('open: .drill-open + .rail', s.drillOpen && s.rail);
ok('open: primary is .is-compact', s.compact);
ok('open: drill aria-hidden=false', s.ariaHidden === 'false');
ok('open: focus moved into the drill', s.focusInDrill);
ok('open: no horizontal overflow', !s.hOverflow);
ok('open: .shell-main still resolves to primary', s.shellMainIsPrimary);
ok('open: ≤1 filled across BOTH mastheads', s.filled <= 1, `filled=${s.filled}`);
ok('open: drill scrolled to top', s.drillScroll === 0);
ok('open: primary kept its scroll (200)', s.mainScroll === 200, `mainScroll=${s.mainScroll}`);
ok('open: wide table de-tabularised', s.tableStacked);
ok('split: role=region, NOT modal', s.role === 'region' && !s.ariaModal);
ok('split: primary NOT inert (stays live)', !s.primaryInert);
const gap = s.drillBox.l - s.primaryBox.r;
ok('split: drill sits beside primary, no overlap', gap >= -1 && gap <= 2, `gap=${gap}px primary=${s.primaryBox.w} drill=${s.drillBox.w}`);
ok('split: primary narrowed to ~360', Math.abs(s.primaryBox.w - 360) <= 2, `primary=${s.primaryBox.w}`);
ok('split: drill is a real page (>600px)', s.drillBox.w > 600, `drill=${s.drillBox.w}`);

// ─────────── lateral swap (the 7-sibling browse) ───────────
await p.click('[data-drill="ws-4"]');
await wait(500);
s = await state();
ok('lateral: primary still interactive → swapped page', /Workstream four/.test(s.title), `title=${s.title}`);
ok('lateral: still open, geometry unchanged', s.drillOpen && Math.abs(s.primaryBox.w - 360) <= 2);
const histLen1 = await p.evaluate(() => history.length);
await p.click('[data-drill="ws-5"]');
await wait(400);
const histLen2 = await p.evaluate(() => history.length);
ok('lateral: swap REPLACES history (one Back closes)', histLen2 === histLen1, `${histLen1}→${histLen2}`);

// ─────────── deeper ───────────
await p.click('[data-deeper]');
await wait(500);
s = await state();
ok('deeper: swapped to tertiary page', /Tertiary page/.test(s.title));
ok('deeper: no third column (geometry constant)', Math.abs(s.primaryBox.w - 360) <= 2);
await p.goBack(); await wait(600);
s = await state();
ok('deeper: Back steps up ONE level (still open)', s.drillOpen && /Workstream five/.test(s.title), `title=${s.title}`);

// ─────────── Esc closes ───────────
await p.keyboard.press('Escape');
await wait(700);
s = await state();
ok('Esc: closes the drill', !s.drillOpen);
ok('Esc: primary un-narrowed', !s.compact);
ok('Esc: nav restored (was expanded)', !s.rail);
ok('Esc: primary scroll preserved (200)', s.mainScroll === 200, `mainScroll=${s.mainScroll}`);
const focusBack = await p.evaluate(() => !!(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.drill));
ok('Esc: focus restored to the trigger row', focusBack);

// ─────────── the ✕ : dismissal, not navigation ───────────
// It must exit EVERY level at once (browser Back keeps the step-up-one semantics, tested above).
await p.goto(URL, { waitUntil: 'networkidle0' }); await wait(600);
await p.evaluate(() => document.querySelector('[data-drill="ws-2"]').click()); await wait(500);
ok('close btn: exists in the drill masthead', await p.evaluate(() => !!document.querySelector('.m3-drill .drill-close')));
ok('close btn: NOT inside .mh-actions', await p.evaluate(() => !document.querySelector('.m3-drill .mh-actions .drill-close')));
{
  const bar = await p.evaluate(() => {
    const b = document.querySelector('.m3-drill .mh-bar').getBoundingClientRect();
    const a = document.querySelector('.m3-drill .mh-actions').getBoundingClientRect();
    const x = document.querySelector('.m3-drill .drill-close').getBoundingClientRect();
    return { barR: b.right, barT: b.top, actR: a.right, xR: x.right, xT: x.top, xL: x.left, sameRow: Math.abs(x.top - a.top) < 24 };
  });
  ok('close btn: flush to the bar\'s right edge', Math.abs(bar.barR - bar.xR) <= 6, `barR=${Math.round(bar.barR)} xR=${Math.round(bar.xR)}`);
  ok('close btn: actions sit beside it, not stranded mid-bar', bar.actR < bar.xL + 1 && bar.actR > bar.xL - 40, `actR=${Math.round(bar.actR)} xL=${Math.round(bar.xL)}`);
  ok('close btn: on the same row as the actions', bar.sameRow);
}
ok('close btn: no back arrow in the drill', await p.evaluate(() => { const a = document.querySelector('.m3-drill .orient-back'); return !a || a.offsetParent === null; }));
ok('close btn: breadcrumb crumbs are not links', await p.evaluate(() => !document.querySelector('.m3-drill .mh-orient a')));
await p.evaluate(() => document.querySelector('[data-deeper]').click()); await wait(600);
s = await state();
ok('close btn: at depth 2 before dismiss', s.drillOpen && /Tertiary/.test(s.title), `title=${s.title}`);
await p.evaluate(() => document.querySelector('.m3-drill .drill-close').click());
await wait(950);
s = await state();
ok('close btn: dismisses ALL levels from depth 2', !s.drillOpen);
ok('close btn: stayed on the same page', p.url().startsWith(URL));
ok('close btn: ?drill= cleared from the URL', !/drill=/.test(p.url()), p.url().slice(-46));
ok('close btn: primary un-narrowed + nav restored', !s.compact && !s.rail);

// Esc must honour the same contract as the ✕
await p.evaluate(() => document.querySelector('[data-drill="ws-5"]').click()); await wait(450);
await p.evaluate(() => document.querySelector('[data-deeper]').click()); await wait(600);
await p.keyboard.press('Escape'); await wait(950);
ok('Esc from depth 2 dismisses entirely (same as ✕)', !(await state()).drillOpen);
await p.goto(URL, { waitUntil: 'networkidle0' }); await wait(600);
await p.evaluate(() => { document.querySelector('.shell-main').scrollTop = 200; });

// ─────────── close motion: nav + primary restore IN SYNC, drill width never jumps on screen ───────────
await p.evaluate(() => document.querySelector('[data-drill="ws-1"]').click());
await wait(800);
const motion = await p.evaluate(() => new Promise(res => {
  const nav = document.querySelector('.m3-drawer'), main = document.querySelector('.shell-main'), drill = document.querySelector('.m3-drill');
  const out = [], t0 = performance.now();
  const tick = () => {
    const t = performance.now() - t0;
    out.push({ t, nav: nav.getBoundingClientRect().width, main: main.getBoundingClientRect().width, dW: drill.getBoundingClientRect().width });
    if (t < 330) requestAnimationFrame(tick); else res(out);
  };
  window.closeDrill({ fromPop: true });
  requestAnimationFrame(tick);
}));
{
  const f = motion[0], l = motion[motion.length - 1];
  const mid = motion.find(s => s.t >= 150) || motion[Math.floor(motion.length / 2)];
  const navPct = (mid.nav - f.nav) / (l.nav - f.nav), mainPct = (mid.main - f.main) / (l.main - f.main);
  ok('close: nav and primary animate in sync', Math.abs(navPct - mainPct) < 0.08, `nav ${(navPct * 100).toFixed(0)}% vs primary ${(mainPct * 100).toFixed(0)}% at t≈${Math.round(mid.t)}ms`);
  const widths = new Set(motion.map(s => Math.round(s.dW)));
  ok('close: drill width frozen while visible', widths.size === 1, `widths=${[...widths].join(',')}`);
  ok('close: nav actually moved', Math.abs(l.nav - f.nav) > 100, `${Math.round(f.nav)}→${Math.round(l.nav)}`);
}
await wait(500);
// the probe used the internal fromPop teardown (it skips history.back()), so the history stack still
// holds a drill entry. Reload for a clean stack before exercising real browser Back.
await p.goto(URL, { waitUntil: 'networkidle0' }); await wait(600);

// ─────────── browser Back closes ───────────
await p.click('[data-drill="ws-2"]'); await wait(500);
await p.goBack(); await wait(700);
s = await state();
ok('browser Back: closes the drill', !s.drillOpen);
ok('browser Back: stayed on the same page', p.url().startsWith(URL));

// ─────────── keyboard opens ───────────
await p.evaluate(() => document.querySelector('[data-drill="ws-3"]').focus());
await p.keyboard.press('Enter');
await wait(500);
s = await state();
ok('keyboard: Enter opens the drill', s.drillOpen);

// ─────────── resize 1440 → 1000 (split → full-bleed modal) ───────────
await p.setViewport({ width: 1000, height: 900 });
await wait(700);
s = await state();
ok('≤1080: role=dialog + aria-modal', s.role === 'dialog' && s.ariaModal === 'true');
ok('≤1080: covered primary is inert', s.primaryInert);
ok('≤1080: drill is full-bleed', s.drillBox.w >= 995, `drill=${s.drillBox.w}`);
ok('≤1080: no horizontal overflow', !s.hOverflow);
// the CLOSED aux is parked off-canvas with a sliver inside the app box; it must never paint over the drill
const slivers = await p.evaluate(() => {
  const pt = el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(Math.min(innerWidth - 2, r.right - 4), r.top + 8); };
  const aux = document.querySelector('.m3-aux');
  const top = pt(document.querySelector('.m3-drill'));
  return { auxOnTop: !!(top && aux && aux.contains(top)), auxZ: getComputedStyle(aux).zIndex, drillZ: getComputedStyle(document.querySelector('.m3-drill')).zIndex };
});
ok('≤1080: closed aux does NOT paint over the drill', !slivers.auxOnTop, `auxZ=${slivers.auxZ} drillZ=${slivers.drillZ}`);

// ─────────── resize back 1000 → 1440 (modal → split) ───────────
await p.setViewport({ width: 1440, height: 900 });
await wait(700);
s = await state();
ok('resize back: region semantics restored', s.role === 'region' && !s.ariaModal);
ok('resize back: primary no longer inert', !s.primaryInert);
ok('resize back: .rail still asserted', s.rail);

// ─────────── aux over drill (no layout crush) ───────────
await p.evaluate(() => window.openAux({ mode: 'push', title: 'Peek', body: '<p>x</p>' }));
await wait(500);
const auxState = await p.evaluate(() => {
  const app = document.querySelector('.m3-app');
  return { push: app.classList.contains('aux-push'), modal: app.classList.contains('aux-modal'), hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
});
ok('aux from drill: forced to overlay, not push', auxState.modal && !auxState.push);
ok('aux from drill: no horizontal overflow', !auxState.hOverflow);
await p.keyboard.press('Escape'); await wait(400);
s = await state();
ok('Esc precedence: aux closes first, drill stays', s.drillOpen);

// ─────────── deep link ?drill=ws-6 ───────────
await p.goto(URL + '?drill=ws-6', { waitUntil: 'networkidle0' });
await wait(900);
s = await state();
ok('deep-link: opens on cold load', s.drillOpen && /Workstream six/.test(s.title), `title=${s.title}`);
await p.goBack(); await wait(700);
s = await state();
ok('deep-link: Back closes drill, stays on page', !s.drillOpen && p.url().startsWith(URL));

// ─────────── @390 open: the full-bleed drill must have a visible way out ───────────
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.setViewport({ width: 390, height: 844 });
await wait(600);
await p.evaluate(() => document.querySelector('[data-drill="ws-1"]').click());
await wait(800);
const exit = await p.evaluate(() => {
  const d = document.querySelector('.m3-drill');
  const x = d.querySelector('.drill-close');
  const vis = el => !!(el && el.offsetParent !== null && el.getBoundingClientRect().width > 0);
  const r = x ? x.getBoundingClientRect() : null;
  return {
    closeVisible: vis(x), size: r ? Math.round(Math.min(r.width, r.height)) : 0,
    rightAligned: r ? (innerWidth - r.right) < 40 : false,
    burgerHidden: !vis(d.querySelector('.mh-nav')),
    backArrowHidden: !vis(d.querySelector('.orient-back')),
    crumb: vis(d.querySelector('.mh-orient')),
  };
});
ok('@390 open: close button is visible', exit.closeVisible);
ok('@390 open: close target ≥40px', exit.size >= 40, `${exit.size}px`);
ok('@390 open: close sits top-right', exit.rightAligned);
ok('@390 open: no hamburger inside the drill', exit.burgerHidden);
ok('@390 open: no back arrow (breadcrumb is orientation only)', exit.backArrowHidden);
ok('@390 open: breadcrumb still visible', exit.crumb);
await p.evaluate(() => document.querySelector('.m3-drill .drill-close').click());
await wait(800);
ok('@390 open: close button closes the drill', !(await state()).drillOpen);

// ─────────── @390 closed: hamburger untouched ───────────
await p.goto(URL, { waitUntil: 'networkidle0' });
await wait(600);
const mob = await p.evaluate(() => {
  const h = document.querySelector('.mh-nav');
  const vis = !!(h && h.offsetParent !== null);
  if (h) h.click();
  return { vis, opened: document.querySelector('.m3-app').classList.contains('nav-open'), hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
});
ok('@390: hamburger visible', mob.vis);
ok('@390: hamburger opens nav', mob.opened);
ok('@390: no horizontal overflow', !mob.hOverflow);

// ─────────── report ───────────
console.log('\n════════ DRILL PATTERN GATE ════════\n');
let fails = 0;
for (const r of results) { if (!r.pass) fails++; console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? '  — ' + r.detail : ''}`); }
console.log(`\n${fails === 0 ? '✅ ALL DRILL CHECKS PASS' : `❌ ${fails} CHECK(S) FAILED`}  (${results.length - fails}/${results.length})`);
if (errs.length) console.log('\nJS errors:', [...new Set(errs)]);
await browser.close();
process.exit(fails ? 1 : 0);
