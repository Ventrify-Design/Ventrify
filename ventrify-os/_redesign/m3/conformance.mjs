// Shell-conformance gate — every workspace Page must pass ALL checks before it is "done".
import puppeteer from '/Users/antonywhenman/Desktop/Ventrify/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
// Two groups: the DS workshop (_redesign/m3, imports ./ds.js) and the LIVE workspace M3 pages
// (workspace/, import ../shared/m3/ds.js — served from project root, need a FIREBASE_ENABLED=false
// demo build or app.js redirects to login). Both mount the SAME shell so both take the same gate.
const GROUPS = [
  { base: 'http://localhost:3200/_redesign/m3', pages: ['portfolio.html', 'portfolio.html?state=empty', 'queue.html', 'research-detail.html', 'drill.html', 'assess.html', 'assess.html?state=gaps', 'assess-setup.html', 'assess-running.html', 'assess-running.html?state=silent'] },
  { base: 'http://localhost:3200/workspace', pages: ['dashboard-m3.html', 'queue-m3.html'] },
];
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});

async function check(base, file) {
  const src = await (await fetch(`${base}/${file}`)).text();
  // ---- static source checks ----
  const importsDs = /from\s+['"](\.\/|\.\.\/shared\/m3\/)ds\.js['"]/.test(src);
  const noPrivateToggle = !/function\s+__toggleRail/.test(src) && !/__setTheme/.test(src);
  const noInlineChrome = !/<style>[\s\S]*\.(masthead|m3-appbar|m3-main)\b[\s\S]*<\/style>/.test(src);

  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });

  // ---- desktop: shell mounted + minify ----
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1600));
  const dom = await page.evaluate(() => ({
    shell: !!document.querySelector('.m3-app.app-scroll'),
    drawer: !!document.querySelector('#m3-drawer.m3-drawer'),
    masthead: !!document.querySelector('.masthead'),
    initRan: typeof window.toggleNav === 'function' && typeof window.openAux === 'function',
    scrollMain: !!document.querySelector('.shell-main'),
    // action taxonomy: the masthead carries AT MOST one primary (filled) control — the rest is a
    // decision-pair (outlined/text) or lives in the utility rail. Guards the primary-vs-auxiliary rule.
    onePrimary: document.querySelectorAll('.mh-actions .m3-btn.filled').length <= 1,
    // no horizontal overflow (catches the off-canvas aux / rail extending the scroll width)
    noHOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    // NO TRUNCATED HEADLINE, EVER. The hero headline is 44px display type in a 4-line clamp. Two ways it
    // was being cut: (a) prose longer than the 12-word budget overflowed the clamp and lost words, and
    // (b) line-height 1.08 made the box exactly N x line-height, so `overflow:hidden` shaved the last
    // line's DESCENDERS (measured: 97px of content in a 95px box) — on EVERY headline. fitHeadline()
    // enforces (a) at the render boundary and a padding-bottom fixes (b); this keeps them both fixed.
    noClippedHeadline: [...document.querySelectorAll('.statement-lockup-headline')]
      .filter(el => el.offsetParent && el.clientHeight > 0)
      .every(el => el.scrollHeight <= el.clientHeight + 1),
    // dividers are STRAIGHT: a one-sided border on a rounded box traces the corner and curls at the
    // ends. Draw the hairline as an absolutely-positioned pseudo-element instead (see the divider atom).
    straightDividers: (() => {
      const px = v => parseFloat(v) || 0;
      for (const el of document.querySelectorAll('*')) {
        const c = getComputedStyle(el);
        const r = Math.max(px(c.borderTopLeftRadius), px(c.borderTopRightRadius), px(c.borderBottomLeftRadius), px(c.borderBottomRightRadius));
        if (r <= 0) continue;
        const t = px(c.borderTopWidth), b = px(c.borderBottomWidth), l = px(c.borderLeftWidth), rt = px(c.borderRightWidth);
        if ((t > 0 || b > 0) && l === 0 && rt === 0 && !(t > 0 && b > 0)) return false;   // radius + one-sided border
      }
      return true;
    })(),
    // headline must be the SAME size + weight at rest and minified (hero headline === compact title)
    headlineConsistent: (() => {
      const h = document.querySelector('.mh-hero .headline-m'), c = document.querySelector('.mh-compact');
      if (!h || !c) return true;
      const a = getComputedStyle(h), b = getComputedStyle(c);
      return a.fontSize === b.fontSize && a.fontWeight === b.fontWeight;
    })(),
  }));
  const minify = await page.evaluate(async () => {
    const s = document.querySelector('.shell-main'); if (!s) return false;
    s.scrollTop = 240; await new Promise(r => setTimeout(r, 400));
    const mh = document.querySelector('.masthead');
    return mh ? parseFloat(mh.style.getPropertyValue('--mh-p') || '0') > 0.3 : false;
  });

  // ---- mobile 390: hamburger visible + opens nav ----
  await page.setViewport({ width: 390, height: 780 });
  await new Promise(r => setTimeout(r, 500));
  const mobile = await page.evaluate(async () => {
    const b = document.querySelector('.mh-nav');
    const visible = !!(b && b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== 'none');
    if (b) b.click();
    await new Promise(r => setTimeout(r, 400));
    const opened = !!document.querySelector('.m3-app.nav-open');
    return { hamburgerVisible: visible, hamburgerOpensNav: opened };
  });
  await page.close();

  return {
    file,
    checks: {
      'imports ds.js': importsDs,
      'no private toggle JS': noPrivateToggle,
      'no inline chrome override': noInlineChrome,
      'shell mounted (.app-scroll)': dom.shell,
      'drawer present': dom.drawer,
      'masthead present': dom.masthead,
      'initShell ran': dom.initRan,
      'scroll container (.shell-main)': dom.scrollMain,
      'masthead minifies on scroll': minify,
      '≤1 primary (filled) in masthead': dom.onePrimary,
      'no horizontal overflow': dom.noHOverflow,
      'no truncated hero headline': dom.noClippedHeadline,
      'dividers straight (no radius + 1-sided border)': dom.straightDividers,
      'headline consistent (rest = minified)': dom.headlineConsistent,
      'hamburger visible @390': mobile.hamburgerVisible,
      'hamburger opens nav @390': mobile.hamburgerOpensNav,
      'no JS errors': errs.length === 0,
    },
    errs,
  };
}

const results = [];
for (const g of GROUPS) for (const p of g.pages) results.push(await check(g.base, p));
await browser.close();

// ---- report ----
console.log('\n════════ SHELL CONFORMANCE GATE ════════\n');
for (const r of results) {
  const fails = Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${fails.length === 0 ? '✅ PASS' : '❌ FAIL'}  ${r.file}`);
  if (fails.length) fails.forEach(f => console.log(`        ✗ ${f}`));
  if (r.errs.length) console.log('        JS: ' + r.errs.slice(0, 2).join(' | '));
}
const allPass = results.every(r => Object.values(r.checks).every(Boolean));
console.log(`\n${allPass ? '✅ ALL PAGES CONFORM' : '❌ NOT ALL PAGES CONFORM'}\n`);
process.exit(allPass ? 0 : 1);
