/* ============================================================
   GATE — everything the site asks for is actually in the repo
   ------------------------------------------------------------
   WHY THIS EXISTS. Vercel builds from GitHub, not from the laptop. A file that
   is on disk but never committed serves perfectly at localhost:3000 and 404s in
   production, and NOTHING local can tell you: the dev server reads the working
   tree, so the page looks finished right up until it is published.

   It nearly shipped exactly that. 73 asset files were on disk and 10 were in git.
   The three the page actually needed — assets/brand.css (every brand token),
   assets/lens-map.png and the hero photograph — were all untracked. The live site
   would have rendered with no brand colours and no hero, and the last check before
   that was a screenshot of localhost, which looked perfect.

   So this does not read the HTML. It drives the real page, lets it scroll so lazy
   images and the live shots fire, records every local URL the BROWSER asks for,
   and asks git about each one.

   Run:  node deploy-check.mjs            (needs a server on :3000)
         node deploy-check.mjs --canary   (proves the gate can fail)
   ============================================================ */
import puppeteer from 'puppeteer';
import { execFileSync } from 'child_process';

const HOST = process.env.SITE_HOST || 'http://localhost:3000';
const CANARY = process.argv.includes('--canary');

/* Only the sites that are actually deployed. ventrify/ and venture-stack/ are not
   committed yet, so adding them here before their domains exist would report a
   repo-wide failure for pages nobody serves. Add each one as it goes live. */
const PAGES = ['/sites/verdict-score/index.html'];
const WIDTHS = [[1440, 900], [390, 844]];   // desktop and mobile pull DIFFERENT image sizes

const tracked = f => {
  try { execFileSync('git', ['ls-files', '--error-unmatch', f], { stdio: 'ignore' }); return true; }
  catch { return false; }
};

let fails = 0;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});

for (const path of PAGES) {
  for (const [w, h] of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    const hits = new Set();
    page.on('request', r => {
      const u = r.url();
      if (u.startsWith(HOST + '/')) hits.add(u.slice(HOST.length).split('?')[0]);
    });
    await page.goto(HOST + path, { waitUntil: 'networkidle2', timeout: 60000 });
    // Scroll the lot: posters, photographs and the live shots are all lazy.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
      }
    });
    await new Promise(r => setTimeout(r, 6000));
    await page.close();

    const missing = [];
    for (const u of hits) {
      const f = u.replace(/^\//, '');
      // ventrify-os/ is deliberately excluded from this deploy and reached by proxy.
      if (f.startsWith('ventrify-os/') || !f) continue;
      if (!tracked(f)) missing.push(u);
    }
    const label = `${path} @ ${w}px — ${hits.size} files requested`;
    if (missing.length) { console.log(`  FAIL  ${label}\n        not in git: ${missing.join('\n                    ')}`); fails++; }
    else console.log(`  PASS  ${label}`);
  }
}

/* CANARY. Ask git about a file that cannot be tracked, and about one that is.
   The first version of this would have passed anything, because execFileSync
   throwing was being swallowed into `true`. */
if (CANARY) {
  const ghost = tracked('assets/__this-file-does-not-exist.png');
  const real  = tracked('sites/verdict-score/index.html');
  console.log(`\ncanary: untracked file reports ${ghost} (want false) · tracked file reports ${real} (want true)`);
  await browser.close();
  process.exit(!ghost && real ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILED — the live site would 404 on the files above`
                  : '\nevery file the site requests is in the repo');
process.exit(fails ? 1 : 0);
