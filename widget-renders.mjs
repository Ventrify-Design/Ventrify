/* DOES THE PANEL ACTUALLY RENDER?
 *
 * The companion to parse-check.mjs, and the second half of the 2026-11-17 lesson. A broken
 * widget.js leaves widget.html looking exactly like a working one to anything that reads it: the
 * document is served, 200, right content type, and the string you changed is in it. What a founder
 * saw was a black rectangle with a footer, because #head and #body are filled by script and nothing
 * ran. Only a browser knows the difference.
 *
 * It asks the live panel, because that is what a partner's visitor gets. Pass a URL to ask another:
 *
 *   node widget-renders.mjs                                  the live panel
 *   node widget-renders.mjs http://localhost:3000/sites/verdict-widget/widget.html
 *   node widget-renders.mjs --canary                         block the script, prove the gate fails
 */
import puppeteer from 'puppeteer';

const CANARY = process.argv.includes('--canary');
const arg = process.argv.slice(2).find(a => a.startsWith('http'));
const BASE = arg || 'https://verdict.ventrify.io/widget/widget';
/* The same query the embed builds, so this is the document a real visitor loads and not a bare one. */
const URL_ = BASE + '?partner=TCA%20Venture%20Group&short=TCA&theme=light&accent=%23A68B5B&radius=2&demo=1';

let fail = 0;
const ok = (n, c, got) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${got ? ' — ' + got : ''}`); if (!c) fail++; };

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 640 });

/* Three different things get called "an error in the console", and only two of them are the
   panel's fault. A failed resource arrives as a console line with no URL in it — so the URL is
   taken from the response instead, and the browser's own unprompted /favicon.ico probe is dropped
   rather than reported. A gate that cries wolf about a favicon is a gate that gets ignored. */
const errors = [];
const missing = [];
page.on('pageerror', e => errors.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400 && !/\/favicon\.ico$/.test(r.url())) missing.push(r.status() + ' ' + r.url()); });
page.on('requestfailed', r => { if (!/favicon/.test(r.url())) missing.push('dead ' + r.url()); });

if (CANARY) {
  /* Exactly what a file that does not parse does: the script is requested and nothing runs. */
  await page.setRequestInterception(true);
  page.on('request', r => (/widget\.js/.test(r.url()) ? r.abort() : r.continue()));
}

console.log(`\n── ${URL_.split('?')[0]}`);
await page.goto(URL_, { waitUntil: 'domcontentloaded' });

/* WAIT FOR THE THING, DO NOT SAMPLE THE CLOCK. The lockup arrives from a dynamic import that is
   rewritten cross-origin to os.ventrify.io in production, and a fixed 800ms sampled it as empty on
   a cold edge — reporting a broken panel that was merely slower than the stopwatch. A flaky gate
   gets ignored, which costs more than the bug it was guarding. This still fails if the lockup never
   arrives: the catch branch writes a fallback, so empty after five seconds means neither ran. */
await page.waitForFunction(
  () => {
    const el = document.getElementById('lockup');
    const body = document.getElementById('body');
    return el && el.innerHTML.length > 0 && body && body.innerHTML.length > 200;
  },
  { timeout: 5000 },
).catch(() => {});

const seen = await page.evaluate(() => ({
  head: (document.getElementById('head') || {}).innerHTML || '',
  body: (document.getElementById('body') || {}).innerHTML || '',
  lockup: (document.getElementById('lockup') || {}).innerHTML || '',
  text: document.body.innerText || '',
}));

ok('the header is filled by script', seen.head.length > 40, seen.head.length + ' chars');
ok('the first screen is filled by script', seen.body.length > 200, seen.body.length + ' chars');
ok('the VerdictScore lockup rendered', seen.lockup.length > 0, seen.lockup.length + ' chars');
ok('the panel offers the thing it exists for', /deck|pre-screen/i.test(seen.text),
   seen.text.replace(/\s+/g, ' ').slice(0, 72));
ok('no uncaught errors in the console', errors.length === 0, errors.slice(0, 2).join(' | '));
ok('every resource the panel asks for exists', missing.length === 0, missing.slice(0, 2).join(' | '));

await browser.close();

console.log(fail ? `\n  ${fail} FAILED — the panel is not what a founder would see` : '\n  the panel renders');
if (CANARY) {
  console.log(fail ? '  canary OK — the gate can fail' : '  !! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
process.exit(fail ? 1 : 0);
