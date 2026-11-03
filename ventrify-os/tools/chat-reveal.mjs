/* ============================================================
   GATE — the assistant answer REVEALS, and the composer survives it
   ------------------------------------------------------------
   Exercises the real chatSend() loop in workspace/assess-next.html.

   WHY THIS EXISTS. The reveal shipped "built and statically checked". The first
   attempt to exercise it locally passed seven of eight checks while never
   reaching the loop at all: in demo mode auth.currentUser is null, getIdToken()
   throws, and the outer catch appends an ERROR as the assistant's turn. Two
   messages in the log looked like a question and an answer. A gate that reads
   "2 messages" and calls it an exchange is the decoration this file replaces.

   NOTHING IS MUTATED AND NOTHING IS SPENT. config.js, firebase.js and /api/memo
   are all served from here by request interception, so the page's own code runs
   unmodified against a canned answer. The model is never called. The working
   tree is never touched — an earlier version flipped FIREBASE_ENABLED on disk,
   which is one crash away from committing demo mode to production.

   Run:  node tools/chat-reveal.mjs            (needs a server on :3200)
         node tools/chat-reveal.mjs --canary   (proves the gate can fail)
   ============================================================ */
import puppeteer from '../../node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const BASE   = process.env.OS_BASE || 'http://localhost:3200';
const CANARY = process.argv.includes('--canary');

/* Markers on purpose: [[id]] citations, a **bold run** and a ⟨derived⟩ marker are
   the three things chatReveal must never cut in half, because chatMsg parses all
   three and half a marker renders as literal punctuation. */
const ANSWER = "The biggest risk is **concentration**: a single channel drives [[c1]] of signups, "
  + "and the ⟨derived⟩ payback of 14 months assumes that channel holds. If acquisition cost rises "
  + "the model inverts, and [[c2]] shows no second channel at scale yet. Treat the forecast as "
  + "contingent on diversifying before the next raise.";

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setRequestInterception(true);
page.on('request', req => {
  const u = req.url();
  // Demo mode, served not written — the working tree stays clean.
  if (u.includes('/firebase/config.js')) return req.respond({ status: 200, contentType: 'application/javascript',
    body: 'export const firebaseConfig = {};\nexport const FIREBASE_ENABLED = false;\n' });
  if (u.includes('/firebase/firebase.js')) return req.respond({ status: 200, contentType: 'application/javascript',
    body: 'export const auth = { currentUser: { getIdToken: async () => "stub-token" } };\nexport default {};\n' });
  // The whole answer in one response — which is exactly why it has to be revealed.
  if (u.includes('/api/memo')) return req.respond({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ text: CANARY ? 'x' : ANSWER, cited: ['c1','c2'], invalid: [], proposals: [] }) });
  req.continue();
});

const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE + '/workspace/assess-next.html', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));

const railed = await page.evaluate(() => { const b = document.querySelector('[data-panel="assist"]'); if (!b) return false; b.click(); return true; });
ok(railed, 'the assistant opens from the rail');
await new Promise(r => setTimeout(r, 900));
ok(await page.$('#chat-input') !== null, 'the composer rendered');

/* Sample at 12ms: the reveal steps every 26ms, so a slower sampler reports a
   progressive reveal as one jump and passes a regression straight through. */
await page.type('#chat-input', 'What is the single biggest risk to this score?');
const sampling = page.evaluate(() => new Promise(res => {
  const lens = new Set(); let composerLost = 0, warned = 0, n = 0;
  const t = setInterval(() => {
    const log = document.querySelector('.chat-log');
    if (log) lens.add(log.textContent.trim().length);
    if (!document.querySelector('#chat-input')) composerLost++;
    if (document.querySelector('.chat-bad, .cite-bad, [data-unverified]')) warned++;
    if (++n >= 300) { clearInterval(t); res({ lens: [...lens].sort((a,b)=>a-b), composerLost, warned, n }); }
  }, 12);
}));
await page.evaluate(() => document.querySelector('#chat-send').click());
const s = await sampling;

ok(s.lens.length >= 8, `the answer reveals progressively — ${s.lens.length} distinct lengths: ${s.lens.slice(0,5).join(' → ')}…`);
// THE BUG logOnly EXISTS TO PREVENT: ~90 repaints rebuilding the composer would
// wipe a question being typed while the first answer was still arriving.
ok(s.composerLost === 0, `the composer is never rebuilt mid-reveal — lost in ${s.composerLost} of ${s.n} samples`);
// Dropping `cited` to hide the chips made every [[id]] render as the loud warning.
ok(s.warned === 0, `no frame ever reads as unverified — ${s.warned} of ${s.n} samples warned`);

await new Promise(r => setTimeout(r, 1500));
const after = await page.evaluate(() => {
  const i = document.querySelector('#chat-input'), log = document.querySelector('.chat-log');
  return { has: !!i, disabled: i ? !!i.disabled : true, msgs: document.querySelectorAll('.chat-msg').length,
           chips: document.querySelectorAll('.chat-chip').length, text: log ? log.textContent : '' };
});
ok(after.has && !after.disabled, 'the composer is live again once the answer is whole');
ok(after.msgs >= 2, `the exchange is in the log — ${after.msgs} messages`);
ok(after.chips >= 1, `the sources land at the end — ${after.chips} chips`);
ok(!/\[\[|\*\*|⟨/.test(after.text), 'no half-parsed marker survived into the final render');
ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

await browser.close();
if (CANARY) {
  const caught = fail > 0;
  console.log(`\n${caught ? 'CANARY OK' : 'CANARY FAILED'} — a one-character answer ${caught ? 'was caught' : 'PASSED, so this gate proves nothing'}`);
  process.exit(caught ? 0 : 1);
}
console.log(`\n${fail ? 'FAILED' : 'all checks passed'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
