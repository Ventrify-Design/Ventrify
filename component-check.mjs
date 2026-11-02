import puppeteer from 'puppeteer';
const PAGES = [
  '/sites/ventrify/', '/sites/ventrify/moneygym/',
  '/sites/verdict-score/',
  '/sites/venture-stack/', '/sites/venture-stack/moneygym/',
];
const browser = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']});
let fail = 0;
const ok = (c,m) => { console.log(`  ${c?'✓':'✗'} ${m}`); if(!c) fail++; };

const skeletons = {};
const navHrefs = {};
const allLinks = [];

for (const path of PAGES) {
  const p = await browser.newPage();
  await p.setViewport({width:1440,height:900});
  await p.goto('http://localhost:3000'+path, {waitUntil:'networkidle0'});

  const r = await p.evaluate(() => {
    // Anti-drift check: the component's CLASS VOCABULARY must be the same
    // everywhere. Item counts legitimately differ (the parent has four nav
    // links and no product suffix; the products have five and a .pr), so
    // counting elements tests the wrong thing. What must never vary is which
    // classes the component emits — that is what breaks when someone
    // hand-rolls a nav on one page instead of using the component.
    // getAttribute('class'), NOT .className: on an SVG element className is an
    // SVGAnimatedString, so String() on it yields "[object SVGAnimatedString]"
    // and the vocabulary picks up two junk tokens per SVG node. It also meant
    // a real class on an SVG node was invisible to this check, which is the
    // half that actually mattered.
    const vocab = el => el ? [...new Set([...el.querySelectorAll('*')]
      .flatMap(n => (n.getAttribute('class') || '').trim().split(/\s+/))
      .filter(Boolean))].sort().join(',') : null;
    const head = document.querySelector('v-nav .site-head');
    const menu = document.querySelector('v-nav .mobile-menu');
    const foot = document.querySelector('v-footer .site-foot');
    return {
      hasHead: !!head, hasMenu: !!menu, hasFoot: !!foot,
      brand: !!document.querySelector('v-nav .brand'),
      burger: !!document.querySelector('v-nav .burger'),
      isMinimal: !!document.querySelector('v-nav .site-head.is-minimal'),
      footCols: document.querySelectorAll('v-footer .foot-grid > div').length,
      disclaimer: !!document.querySelector('v-footer .disclaimer'),
      navSkeleton: vocab(head), footSkeleton: vocab(foot),
      navHrefs: [...document.querySelectorAll('v-nav .navlinks a')].map(a => a.getAttribute('href')),
      links: [...document.querySelectorAll('v-nav a, v-footer a')]
        .map(a => a.getAttribute('href')).filter(h => h && !/^(https?:|mailto:|tel:|#)/.test(h)),
    };
  });

  // A sub-page uses the MINIMAL bar: brand + CTA, no links, so no overlay and
  // no burger to open one. Full pages must have all of it.
  const minimal = r.isMinimal;
  ok(r.hasHead && r.hasFoot && r.brand && (minimal ? (!r.hasMenu && !r.burger) : (r.hasMenu && r.burger)),
     `${path.padEnd(32)} ${minimal ? 'minimal bar: brand + CTA, no links' : 'nav + overlay + footer rendered from components'}`);
  if (minimal) ok(r.navHrefs.length === 0, `${path.padEnd(32)} minimal bar offers no links that could mislead`);
  ok(r.footCols === 4 && r.disclaimer, `${path.padEnd(32)} footer: 4 columns + disclaimer`);

  skeletons[path] = { nav: r.navSkeleton, foot: r.footSkeleton, minimal: r.isMinimal };
  navHrefs[path] = r.navHrefs;
  r.links.forEach(h => allLinks.push({ path, h }));
  await p.close();
}

// Structure must be identical everywhere — only the labels differ per site.
// `pr` (product suffix) and `light` (secondary action) are documented optional
// configuration — the parent brand has neither. Everything else must match.
// `arw` is the trailing arrow glyph. The approved copy puts one on Ventrify's
// "Try it free ↗" and not on the product sites' "Try it free" — a decoration
// inconsistency inherited from the copy files, not a component problem. Worth
// standardising one way or the other when the visual signature lands.
// `is-lockup` is deliberately NOT in here. All three identities ship a mark +
// wordmark now, so the class is on all five pages and the check should fail if
// one ever loses it — which is exactly the drift this gate exists to catch.
// (`pr` stays: no site emits the product chip any more, since the lockups
// carry the product name in the art, but it is still supported config for a
// text brand.)
const OPTIONAL = new Set(['pr', 'light', 'arw']);
const core = v => v.split(',').filter(c => !OPTIONAL.has(c)).join(',');
// Compare like with like: the full bar and the minimal bar are two deliberate
// variants, so each must be internally consistent rather than identical to the
// other.
const navSkels  = new Set(Object.values(skeletons).filter(s => !s.minimal).map(s => core(s.nav)));
const navMin    = new Set(Object.values(skeletons).filter(s =>  s.minimal).map(s => core(s.nav)));
const footSkels = new Set(Object.values(skeletons).map(s => core(s.foot)));
ok(navSkels.size === 1,  `full nav vocabulary identical across every homepage`);
ok(navMin.size <= 1,     `minimal nav vocabulary identical across every sub-page`);
ok(footSkels.size === 1, `footer class vocabulary identical across all ${PAGES.length} pages`);
if (navSkels.size > 1)  [...navSkels].forEach(v => console.log('       nav:  ' + v));
if (footSkels.size > 1) [...footSkels].forEach(v => console.log('       foot: ' + v));

// Relative links must actually resolve — base="../" on subpages is easy to get wrong.
let broken = 0;
for (const { path, h } of allLinks) {
  const url = new URL(h, 'http://localhost:3000' + path).toString();
  const res = await fetch(url, { method: 'GET' }).catch(() => null);
  if (!res || !res.ok) { console.log(`       BROKEN  ${path} → ${h}  (${res ? res.status : 'no response'})`); broken++; }
}
ok(broken === 0, `all ${allLinks.length} relative component links resolve`);


/* RULE 3 — COMPONENTS EVERYWHERE.
   Structural markup must come from a component, never be hand-rolled in a page.
   If a class below appears literally in a page's source, someone has rebuilt a
   component by hand and it will drift from the other instances. */
import { readFileSync } from 'fs';
const OWNED = {
  'card':          'v-card',
  'price-card':    'v-price',
  'ph':            'v-ph',
  'section-head':  'v-section-head',
  'steps':         'v-steps',
  'banner':        'v-banner',
  'faq':           'v-faq',
  'figure-md':     'v-stat',
  'site-head':     'v-nav',
  'mobile-menu':   'v-nav',
  'site-foot':     'v-footer',
  'depth':         'v-depth',
};
let handRolled = 0;
for (const f of PAGES.map(p => '.' + p + 'index.html')) {
  const src = readFileSync(f.replace('./', ''), 'utf8');
  for (const [cls, owner] of Object.entries(OWNED)) {
    const re = new RegExp('class="[^"]*\\b' + cls + '\\b');
    if (re.test(src)) { console.log(`  ✗ ${f} hand-rolls .${cls} — belongs to <${owner}>`); handRolled++; }
  }
}
ok(handRolled === 0, `no page hand-rolls a component's markup (${Object.keys(OWNED).length} structures owned by components)`);


/* Every defined component must have an explicit display rule — an un-styled
   custom element is inline and silently drops its own box model. */
const css  = readFileSync('sites/shared/base.css', 'utf8');
const defined = [...readFileSync('sites/shared/components.js','utf8')
  .matchAll(/customElements\.define\('([a-z-]+)'/g)].map(m => m[1]);
// Every component needs an explicit display. Most are block; <v-nav> must be
// `contents` so it forms no box and the sticky header can stick to the page
// rather than to a 76px wrapper.
const displayRules = (css.match(/^v-[\s\S]*?\{\s*display:\s*(?:block|contents);\s*\}/gm) || []).join(' ');
const missingDisplay = defined.filter(t => !displayRules.includes(t));
missingDisplay.forEach(t => console.log(`  ✗ <${t}> has no display rule — it will render inline`));
ok(missingDisplay.length === 0, `all ${defined.length} components have an explicit display rule`);


/* A primary nav must not mix in-page anchors with page links: the odd one out
   behaves differently from its neighbours and reads as a mistake. Either all
   items scroll, or all items navigate. */
for (const [path, set] of Object.entries(navHrefs)) {
  const kinds = new Set(set.map(h => /^(\.\.\/)?#/.test(h) ? 'anchor' : 'page'));
  ok(kinds.size <= 1, `${path.padEnd(32)} nav is all-${[...kinds][0] || 'empty'} (no mixed anchor/page links)`);
}

/* And the case study must still be reachable from its parent homepage, now
   that it is no longer in the nav. */
for (const [home, sub] of [['/sites/ventrify/','moneygym/'], ['/sites/venture-stack/','moneygym/']]) {
  const src = readFileSync('.' + home + 'index.html', 'utf8');
  ok(src.includes('href="' + sub + '"'), `${home.padEnd(32)} links to its case study from the page body`);
}


/* The header must stay put. It was declared sticky and silently did nothing,
   twice over: body's overflow-x made a scroll container, and <v-nav> gave it a
   76px-tall parent to stick inside. Assert the behaviour, not the declaration. */
for (const path of PAGES) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle0' });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await p.evaluate(() => window.scrollTo(0, 2500));
  await new Promise(r => setTimeout(r, 350));
  const top = await p.evaluate(() => Math.round(document.querySelector('.site-head').getBoundingClientRect().top));
  ok(top === 0, `${path.padEnd(32)} header stays stuck at the top on scroll`);
  await p.close();
}

/* <v-product> RENDERS THE PRODUCT'S ICONS AS GLYPHS, NOT AS THEIR NAMES.
   Material Symbols are ligatures: the markup says <span>trending_flat</span> and the font turns it
   into an arrow. Style RULES do not cross a shadow boundary, so the icon stylesheet is linked
   inside each root — but a shadow root's @font-face is ignored for font matching, so the family
   never resolved and the valuation chip shipped reading "trending_flat Rich — reprice".
   Nothing threw. The only way to see it is to measure: a glyph is ~24px wide, a word is not. */
for (const path of PAGES) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2200));         // the widget imports the product layer
  const icons = await p.evaluate(async () => {
    await document.fonts.ready;
    const out = [];
    document.querySelectorAll('v-product').forEach(el => {
      if (!el.shadowRoot) return;
      el.shadowRoot.querySelectorAll('.material-symbols-rounded').forEach(i => {
        out.push({ name: i.textContent.trim(), w: Math.round(i.getBoundingClientRect().width) });
      });
    });
    return out;
  });
  await p.close();
  if (!icons.length) continue;                          // no product widget on this page
  const wide = icons.filter(i => i.w > 40);             // a rendered glyph is ~24px; a word is 80+
  ok(!wide.length, `${path.padEnd(32)} product icons render as glyphs (${icons.length} checked)` +
     (wide.length ? ` — ${wide.map(i => `${i.name} ${i.w}px`).join(', ')}` : ''));
}

/* A WIDGET'S BOX IS ITS CONTENT, NOT A WORKSPACE PAGE'S PADDING.
   <v-product> wraps the render in `brief vp-box`, and the product's .brief is a scrolling
   document's reading column — a 63px side gutter and 120px of bottom padding. Inside a 552px
   marketing column that made the valuation widget's box 493px tall around 339px of content, so a
   grid centring the two columns centred the BOX and left the chart sitting 69px above the text
   beside it. It looked like a layout bug and was a padding bug; only measuring tells them apart. */
for (const path of PAGES) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2200));
  const boxes = await p.evaluate(() => [...document.querySelectorAll('v-product')].map(el => {
    const inner = el.shadowRoot && el.shadowRoot.querySelector('.vp-box > *');
    return { w: el.getAttribute('widget'),
             host: Math.round(el.getBoundingClientRect().height),
             content: inner ? Math.round(inner.getBoundingClientRect().height) : null };
  }));
  await p.close();
  if (!boxes.length) continue;
  const padded = boxes.filter(b => b.content == null || Math.abs(b.host - b.content) > 2);
  ok(!padded.length, `${path.padEnd(32)} product widgets are content-height (${boxes.length} checked)` +
     (padded.length ? ` — ${padded.map(b => `${b.w} box ${b.host} vs content ${b.content}`).join(', ')}` : ''));
}

/* THE SCROLL-DRIVEN CHART, AND ITS FALLBACK.
   The valuation widget re-keys the product's own six-stage entrance from time to scroll, off the
   --prog every section publishes. Two things have to hold, and the second matters more:
     · it actually responds — empty at the top of the crossing, complete by the middle;
     · --prog defaults to 1, so a page where motion.js never ran shows a COMPLETE chart rather
       than an empty one. An empty valuation graphic is worse than a static one.  */
{
  const draw = async (block) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    if (block) await p.setRequestInterception(true);
    if (block) p.on('request', r => (/motion\.js/.test(r.url()) ? r.abort() : r.continue()));
    await p.goto('http://localhost:3000/sites/verdict-score/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2200));
    const at = async (frac) => {
      if (frac != null) {
        await p.evaluate(f => { const s = document.getElementById('challenge');
          scrollTo(0, s.offsetTop - innerHeight + (s.offsetHeight + innerHeight) * f); }, frac);
        await new Promise(r => setTimeout(r, 320));
      }
      return p.evaluate(() => {
        const el = document.querySelector('v-product[widget="valuation"]');
        const b = el && el.shadowRoot && el.shadowRoot.querySelector('.v1-band');
        if (!b) return null;
        const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
        return Math.round(m.m11 * 100) / 100;           // the x scale
      });
    };
    /* AND IT HAS TO BE FINISHED WHERE THE READER STOPS. How far --prog has got when the chart is
       centred depends on the section's height against the window, so the last stage — the "+$25M
       over" caption, which is the conclusion of the sequence — was still invisible at rest on
       desktop while being complete on mobile. Assert the resting frame, not just the extremes. */
    const rest = () => p.evaluate(() => {
      const el = document.querySelector('v-product[widget="valuation"]');
      const r = el.getBoundingClientRect();
      scrollBy(0, r.top + r.height / 2 - innerHeight / 2);
      return new Promise(res => setTimeout(() => {
        const sr = el.shadowRoot;
        const cap = sr.querySelector('.v1-gap .cap');
        res(cap ? Math.round(parseFloat(getComputedStyle(cap).opacity) * 100) / 100 : null);
      }, 400));
    });
    const out = block ? { still: await at(null) } : { start: await at(0), mid: await at(.55), rest: await rest() };
    await p.close();
    return out;
  };
  const live = await draw(false);
  ok(live.start === 0 && live.mid === 1,
     `/sites/verdict-score/${' '.repeat(12)} the valuation chart draws with scroll (${live.start} → ${live.mid})`);
  ok(live.rest === 1,
     `/sites/verdict-score/${' '.repeat(12)} …and is finished where the reader stops (cap ${live.rest})`);
  const dead = await draw(true);
  ok(dead.still === 1,
     `/sites/verdict-score/${' '.repeat(12)} …and is COMPLETE with motion.js blocked (${dead.still})`);
}

await browser.close();
console.log(fail ? `\n  ${fail} failed` : '\n  all component checks passed');
process.exit(fail?1:0);
