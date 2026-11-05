import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';
const width = parseInt(process.argv[4]) || 1440;

const dir = './temporary screenshots';
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

// Auto-increment
const existing = readdirSync(dir).filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
const nums = existing.map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] || '0'));
const next = (nums.length ? Math.max(...nums) : 0) + 1;
const filename = label ? `screenshot-${next}-${label}.png` : `screenshot-${next}.png`;
const filepath = join(dir, filename);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ width, height: 900 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 500));

// Scroll through the entire page to trigger IntersectionObservers
await page.evaluate(async () => {
  const distance = 400;
  const delay = 80;
  const scrollHeight = document.body.scrollHeight;
  let current = 0;
  while (current < scrollHeight) {
    window.scrollBy(0, distance);
    current += distance;
    await new Promise(r => setTimeout(r, delay));
  }
  // Scroll back to top
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 300));
});

await new Promise(r => setTimeout(r, 500));

// Force-reveal any data-reveal elements so screenshots don't miss them
await page.evaluate(() => {
  document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('revealed'));
});
await new Promise(r => setTimeout(r, 200));

/* ⚠ SCROLL THROUGH AGAIN, AFTER REVEALING, AND THE REASON IS backdrop-filter.
   fullPage composites the scroll area, and Chrome will not re-rasterise a
   backdrop-filtered layer that has never been laid out in a real viewport —
   it hands the section back as flat background. The page used to have one or
   two such layers and got away with it; it now has seven glass panes, and a
   full-page shot came back with #case-study and #who simply MISSING. They
   render perfectly in a real viewport, which is the dangerous part: the tool
   was quietly lying about the page.

   The first scroll pass above runs BEFORE the reveal, so the panes it paints
   are the hidden ones. This second pass walks the page in viewport-sized
   steps with everything revealed, which forces each pane to rasterise at the
   size it will be captured at. Resizing the viewport to the document height
   also works and is worse: it stretches every vh-based layout, and the hero
   alone then fills 7000px.

   If a page ever still comes back with a blank section, capture it in pieces
   with screenshot-chunks.mjs rather than trusting this. */
const vh = page.viewport().height;
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < docH; y += Math.round(vh * 0.8)) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await new Promise(r => setTimeout(r, 120));
}
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise(r => setTimeout(r, 500));

await page.screenshot({ path: filepath, fullPage: true });
await browser.close();

console.log(`Saved: ${filepath}`);
