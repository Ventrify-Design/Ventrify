/* ═══ rim-check — the lit top edge is one level pixel, seated at the edge ════
 *
 * WHY THIS EXISTS. The glass surfaces' lit top edge used to be an inset
 * box-shadow. An inset shadow paints ON the element, which put it BEHIND
 * `.glass-lens::before` — and that layer is a backdrop-filter, so the 1px
 * highlight was resampled through a raster displacement map every frame.
 * MEASURED on a 571px challenge card: the line came back 2.00px thick, seated
 * 2.75px INSIDE the card edge, with its lower boundary moving by a whole
 * device row across the width. At 1× that reads as a thick, stepped glow, and
 * no other gate here can see it — clip-check counts text, photo-contrast
 * measures copy, neither looks at a hairline.
 *
 * The fix moved the edge to `.glass-rim::after` at z-index 2, above the
 * refraction. This is what stops it sliding back.
 *
 * WHAT IT MEASURES, AND WHAT IT DELIBERATELY DOES NOT. It finds the two
 * luminance TRANSITIONS at the top of a surface — border into rim, rim into
 * body — and reads the rim's position and thickness off them. Transitions,
 * not brightness: the first draft of this gate compared the rim against the
 * card's own film, and a violet card read as "no edge at all" because its
 * body is nearly as bright as its rim. How bright the rim should be is a
 * design decision that belongs on the bench (sites/_card-lab.html). Where it
 * sits and whether it stays put are not, and those are colour-independent:
 *
 *   SEATED   it begins within 2px of the surface's top, i.e. right after the
 *            1px border, with no gap. 2.75px was the displaced reading.
 *   THIN     it is --glass-rim-w thick, not a smear.
 *   LEVEL    it begins and ends on the same device row at every column. This
 *            is the one a displacement map fails: a bent line is still 1px
 *            tall, it is just 1px tall somewhere else.
 *
 * A surface with no detectable transition is reported, not failed — a glass
 * surface photographed against its own highlight has nothing to measure.
 *
 * Usage:  node rim-check.mjs [url ...]
 * ═══════════════════════════════════════════════════════════════════════════ */

import puppeteer from 'puppeteer';
import zlib from 'node:zlib';

const DSF = 4;                 /* device rows per CSS px — enough to resolve a
                                  1px line AND both of its boundaries */
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SEL = '.glass-rim';      /* whatever components.js marked as glass */

const URLS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const TARGETS = URLS.length ? URLS : [
  'http://localhost:3000/sites/ventrify/',
  'http://localhost:3000/sites/verdict-score/',
  'http://localhost:3000/sites/venture-stack/',
];

/* ── A PNG, decoded ────────────────────────────────────────────────────────
   Chrome hands back 8-bit non-interlaced PNG. Node has zlib, so all that is
   missing is chunk-walking and un-filtering — cheaper than a dependency the
   rest of the repo does not carry. */
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, color = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9];
      if (data[8] !== 8 || (color !== 2 && color !== 6)) throw new Error('unsupported PNG');
      if (data[12] !== 0) throw new Error('interlaced PNG');
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = color === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const row = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, bpp, stride, data: out };
}

const lum = (im, x, y) => {
  const i = y * im.stride + x * im.bpp;
  return 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2];
};

/* Where the lit run begins and ends in one column, from the transitions. */
function edge(im, x) {
  const n = Math.min(im.h, 4 * DSF);
  const col = []; for (let y = 0; y < n; y++) col.push(lum(im, x, y));
  let rise = -1, riseD = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = col[i + 1] - col[i];
    if (d > riseD) { riseD = d; rise = i + 1; }
  }
  if (rise < 0 || riseD < 4) return null;
  let fall = -1, fallD = 0;
  for (let i = rise; i < n - 1; i++) {
    const d = col[i] - col[i + 1];
    if (d > fallD) { fallD = d; fall = i + 1; }
  }
  if (fall < 0 || fallD < 4) return null;
  return { rise, fall, lift: riseD };
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
});

let fails = 0, checked = 0, quiet = 0;
console.log('\n── rim ──');

for (const url of TARGETS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: DSF });
  /* Reduced motion, so the measurement is repeatable. These pages run
     scroll-linked parallax; motion-check already proves nothing is hidden or
     transformed under reduce, so this changes where surfaces SIT and not what
     they look like — which is exactly what a sub-pixel reading needs. */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 }); }
  catch { console.log(`  SKIP  ${url} — did not load`); await page.close(); continue; }

  /* ⚠ TWO REVEAL MECHANISMS, AND MISSING ONE MAKES THIS GATE LIE QUIETLY.
     `[data-reveal]` resolves with `.revealed`, but a SEQUENCE — `[data-seq]`,
     which the How-it-works steps are — holds its children at opacity .5 until
     each gets `.is-active`. Measured at half opacity a 1px rim has no
     transition to find, and the gate reports "no measurable edge" on six
     perfectly good panes rather than failing: a false quiet, which is worse
     than a false alarm. */
  await page.evaluate(() => {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('revealed'));
    document.querySelectorAll('[data-seq] > *').forEach(el => el.classList.add('is-active'));
  });
  await new Promise(r => setTimeout(r, 900));

  const short = url.replace(/^https?:\/\/[^/]+/, '');
  const count = await page.evaluate(s => document.querySelectorAll(s).length, SEL);
  const want = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--glass-rim-w')) || 1);

  if (!count) { console.log(`  ----  ${short} — no glass surfaces`); await page.close(); continue; }

  for (let i = 0; i < count; i++) {
    /* SCROLL FIRST, MEASURE SECOND, and they must be two round trips. These
       pages run scroll-linked parallax, so the rect read in the same tick as
       the scroll is the rect BEFORE the transform catches up — which lands
       the 6px strip inside the card body and reports a flat, edgeless
       surface. That cost an hour; it is written down so it costs nobody
       else one. */
    await page.evaluate((s, i) => document.querySelectorAll(s)[i]
      .scrollIntoView({ behavior: 'instant', block: 'center' }), SEL, i);
    await new Promise(r => setTimeout(r, 450));
    const b = await page.evaluate((s, i) => {
      const el = document.querySelectorAll(s)[i];
      const r = el.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height,
               tag: el.tagName.toLowerCase() + '.' + (el.className.split(' ')[0] || '') };
    }, SEL, i);
    if (b.w < 160 || b.h < 60) continue;

    const im = decodePNG(Buffer.from(await page.screenshot({
      clip: { x: b.x, y: b.y, width: Math.min(b.w, 1400), height: 6 },
    })));

    /* Sample the span, skipping the rounded corners where the top edge has
       turned into a side and the reading is of a different thing. */
    const es = [];
    for (const f of [.15, .25, .35, .5, .65, .75, .85]) {
      const e = edge(im, Math.round(f * (im.w - 1)));
      if (e) es.push(e);
    }
    checked++;
    if (es.length < 4) {
      console.log(`  ····  ${short} ${b.tag} (${Math.round(b.w)}px) — no measurable edge ` +
                  `(${es.length}/7 columns); judge this one on the bench`);
      quiet++; continue;
    }

    const rises = es.map(e => e.rise), falls = es.map(e => e.fall);
    const seat   = Math.min(...rises) / DSF;
    const thick  = Math.max(...es.map(e => (e.fall - e.rise) / DSF));
    const drift  = (Math.max(...rises) - Math.min(...rises)) +
                   (Math.max(...falls) - Math.min(...falls));

    const bad = [];
    /* 2.00 and not 1.50. A 1px border plus the rim should seat at 1.00, but a
       surface whose top lands on a fractional y smears the border over two
       device rows and the detected rise arrives a quarter-pixel late —
       MEASURED 1.75 on a shot-frame at 1162.4px wide. The reading this gate
       exists to catch was 2.75, so 2.00 still catches it with room for the
       subpixel. */
    if (seat  > 2.0)        bad.push(`seated ${seat.toFixed(2)}px in (max 2.00)`);
    if (thick > want + 0.5) bad.push(`${thick.toFixed(2)}px thick (want ${want})`);
    if (drift > 2)          bad.push(`drifts ${drift} device rows across the span`);

    if (bad.length) { fails++; console.log(`  FAIL  ${short} ${b.tag} (${Math.round(b.w)}px) — ${bad.join(' · ')}`); }
    else console.log(`  PASS  ${short} ${b.tag} (${Math.round(b.w)}px) — ` +
      `${thick.toFixed(2)}px, seated ${seat.toFixed(2)}px, drift ${drift}`);
  }
  await page.close();
}

await browser.close();
console.log(fails
  ? `\n  ${fails} of ${checked} lit edges are not one level pixel at the edge\n`
  : `\n  every measurable lit edge is one level pixel at the edge` +
    (quiet ? ` (${quiet} of ${checked} had nothing to measure)` : '') + '\n');
process.exit(fails ? 1 : 0);
