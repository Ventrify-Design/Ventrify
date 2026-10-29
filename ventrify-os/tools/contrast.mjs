/* ═══════════════════════════════════════════════════════════════════════════
   CONTRAST — every text run on every branded page, against WCAG AA.

   WHY IT SAMPLES PIXELS AND NOT CSS.
   Reading `color` and `background-color` off computed style gives the wrong
   answer wherever the background is not a flat fill — and after the brand
   layer landed, the mastheads are PHOTOGRAPHS, panels are glass, and several
   surfaces are gradients. CSS says "transparent" and the eye says "white
   text on a snowfield". So the page is rendered twice: once normally, once
   with every glyph made transparent. The second render is the true
   background behind each run, sampled under the text's own box.

   THRESHOLDS are WCAG AA: 4.5:1 for body text, 3:1 for large text, where
   large is >=24px, or >=18.66px when bold. Applying 4.5 to everything would
   bury the real failures under display type that is allowed to be softer.

   THEMES. DARK IS THE ONLY SUPPORTED THEME, so dark is what this gate asserts.
   The theme axis exists anyway, because the audit having no axis at all is how
   a second theme went unmeasured for the life of the project: the first light
   run (added 2026-10-29) found 185 failing runs over 20 elements, down to
   1.00:1 — invisible text — on all six pages.

   That debt is NOT twenty bugs and NOT a regression from any page's markup. It
   is one file. shared/m3/brand-map.css repaints the chrome surfaces
   (.m3-drawer, .m3-utilrail, .masthead) from the BRAND tokens --surface-base /
   --surface-ground, and contains the word "light" zero times — so when
   :root.light flips the M3 ink to #1D1B20, the chrome beneath it stays dark.
   Dark ink on dark chrome. assets/brand/brand.css does carry light handling;
   the OS bridge never consumes it. Fix that one file and --light goes green.

   `--light` is kept so the day light mode IS supported, measuring it is one
   flag and not a rediscovery. It is not in the default run because a gate that
   is red by design teaches everyone to ignore a red gate.

     node tools/contrast.mjs            dark — the supported theme (default)
     node tools/contrast.mjs --light    the unsupported theme's standing debt
     node tools/contrast.mjs --both     both at once
     node tools/contrast.mjs portfolio  one page
   ═══════════════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';

const BASE = process.env.OS_BASE || 'http://localhost:3200';
const ONLY = process.argv.filter(a => !a.startsWith('--'))[2];
/* --no-brand serves the brand layer as empty, so the same audit can be run
   against the pre-migration page. A failure that is present both ways is
   inherited; one that appears only with the brand on is ours. */
const NO_BRAND = process.argv.includes('--no-brand');
/* Dark is the supported theme and the default assertion; see the header. */
const THEMES = process.argv.includes('--both') ? ['dark', 'light']
             : process.argv.includes('--light') ? ['light'] : ['dark'];
const PAGES = [
  /* The sign-in screen is branded now (it was the last page still wearing the
     pre-brand identity) and it sits over a PHOTOGRAPH, which is exactly the
     case this gate samples pixels for. It was not in the list while it was
     unbranded; it has to be in it now. */
  ['login',     '/workspace/index.html'],
  ['setup',     '/workspace/setup.html'],
  ['portfolio', '/workspace/dashboard-m3.html'],
  ['queue',     '/workspace/queue-m3.html'],
  ['team',      '/workspace/team-m3.html'],
  ['settings',  '/workspace/settings-m3.html'],
  ['admin',     '/workspace/admin-m3.html'],
  ['assess',    '/workspace/assess-next.html'],
].filter(p => !ONLY || p[0] === ONLY);
const WIDTHS = [[1440, 'desk'], [390, 'mob']];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'], protocolTimeout: 180000 });

async function demo(w, theme = 'dark') {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: 1000, deviceScaleFactor: 1 });
  await p.evaluateOnNewDocument(t => { try { localStorage.setItem('ventrify-theme', t); } catch {} }, theme);
  await p.setRequestInterception(true);
  p.on('request', async req => {
    if (req.url().endsWith('/firebase/config.js')) {
      try {
        const src = await (await fetch(req.url())).text();
        return req.respond({ status: 200, contentType: 'application/javascript',
          body: src.replace(/export const FIREBASE_ENABLED\s*=\s*true/, 'export const FIREBASE_ENABLED = false') });
      } catch {}
    }
    if (NO_BRAND && (req.url().endsWith('/assets/brand/brand.css') ||
                     req.url().endsWith('/shared/m3/brand-map.css')))
      return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.continue();
  });
  return p;
}

const EVAL = `(() => {
  const out = [];
  const seen = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = (n.textContent || '').trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    seen.add(el);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    out.push({
      text: t.slice(0, 46),
      color: cs.color,
      size, weight,
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
    });
  }
  return out;
})()`;

const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/* TWO SERIALISATIONS, TWO SCALES. getComputedStyle returns `rgb(200, 186,
   255)` for a plain colour but `color(srgb 0.785 0.731 1)` for anything that
   came through color-mix() — 0-1 floats, not 0-255. Parsing both the same
   way read a light violet as very nearly black and invented a 1.37:1
   failure on a chip that actually measures 8.67:1. A gate that lies costs
   more than no gate, because the work it sends you on is real. */
const parse = s => {
  const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  if (n.length < 3) return n;
  return /^color\(/.test(s.trim()) ? n.map(v => Math.round(v * 255)) : n;
};

let fails = 0, checked = 0;
const worstBy = new Map();

for (const [name, path] of PAGES) {
  for (const theme of THEMES) {
  for (const [w, tag] of WIDTHS) {
    const p = await demo(w, theme);
    try {
      await p.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2400));
      const runs = await p.evaluate(EVAL);
      // second render: glyphs transparent → the true background
      await p.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; }' });
      await new Promise(r => setTimeout(r, 300));
      const shot = await p.screenshot({ encoding: 'base64' });
      const bgs = await p.evaluate(async ([s, pts]) => {
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
        const cv = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        return pts.map(q => {
          if (q.x < 0 || q.y < 0 || q.x >= img.width || q.y >= img.height) return null;
          const d = cx.getImageData(q.x, q.y, 1, 1).data;
          return [d[0], d[1], d[2]];
        });
      }, [shot, runs.map(r => ({ x: r.x, y: r.y }))]);

      runs.forEach((r, i) => {
        const bg = bgs[i]; if (!bg) return;
        const fg = parse(r.color); if (fg.length < 3) return;
        checked++;
        const cr = ratio(fg, bg);
        const need = r.large ? 3 : 4.5;
        if (cr < need) {
          fails++;
          const key = `${theme}|${r.sel}|${r.large}`;
          const prev = worstBy.get(key);
          if (!prev || cr < prev.cr) worstBy.set(key, { ...r, cr, need, page: `${name}/${theme}/${tag}`, bg });
        }
      });
    } catch (e) { console.log(`  ${name}/${theme}/${tag} failed: ${String(e).slice(0, 70)}`); }
    await p.close();
  }
  }
}
await browser.close();

const rows = [...worstBy.values()].sort((a, b) => a.cr - b.cr);
console.log(`  ${checked} text runs measured across ${PAGES.length} page(s) × ${THEMES.length} theme(s) × ${WIDTHS.length} widths\n`);
if (!rows.length) { console.log('  ✓ every run clears AA'); process.exit(0); }
console.log('  ratio  need  where                 selector                        text');
for (const r of rows) {
  console.log(`  ${r.cr.toFixed(2).padStart(5)}  ${String(r.need).padStart(4)}  ${r.page.padEnd(20)} ${r.sel.slice(0, 30).padEnd(31)} ${JSON.stringify(r.text)}`);
}
console.log(`\n  ${rows.length} distinct element(s) under AA · ${fails} run(s) total`);
process.exit(1);
