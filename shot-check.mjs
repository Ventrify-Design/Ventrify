/* shot-check.mjs — the live product shot does what it looks like it does.
 *
 * Exists because of bugs the eye caught and no offline check could:
 *   1. the pointer tapped a research row that had already scrolled off the top of the frame, so it
 *      was drawn at the top of the shot over nothing. querySelector answers in DOM order, which
 *      says nothing about what is on screen.
 *   2. openDrill() moves focus to the companion page's title — right for the product, a stray
 *      highlighted box in a shot nobody is keyboard-navigating.
 *   3. the "read the document" beat scrolled `.drill-page .shell-main`, a selector that matches
 *      nothing, and silently fell through to the page BEHIND the drill. Nothing failed; the beat
 *      just moved a surface no one could see.
 * None of the three is visible in source. So this runs it.
 *
 *   node shot-check.mjs                 the live VerdictScore page
 *   node shot-check.mjs --probe         the workbench at sites/_live-shot-probe.html
 *   node shot-check.mjs --canary        prove the assertions can fail
 */
import puppeteer from 'puppeteer';

const HOST = process.env.SHOT_HOST || 'http://localhost:3000';
const PROBE = process.argv.includes('--probe');
const URL = process.env.SHOT_URL || HOST + (PROBE ? '/sites/_live-shot-probe.html' : '/sites/verdict-score/');
const CANARY = process.argv.includes('--canary');

const fails = [];
const ok = (name, pass, detail = '') => {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) fails.push(name);
};
const inside = (pt, b) => pt.x >= b.x0 && pt.x <= b.x1 && pt.y >= b.y0 && pt.y <= b.y1;

/* CANARY. Containment is the whole gate; prove it rejects a point outside the box. The first
   version of this file would have passed a pointer drawn anywhere on the page. */
if (CANARY) {
  const box = { x0: 100, x1: 400, y0: 200, y1: 300 };
  const good = inside({ x: 250, y: 250 }, box), bad = inside({ x: 250, y: 60 }, box);
  console.log(`canary: inside ${good} (want true) · above ${bad} (want false)`);
  process.exit(good && !bad ? 0 : 1);
}

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
});
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 1150 });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => {
  if (m.type() !== 'error') return;
  const where = (m.location() && m.location().url) || '';
  if (/favicon\.ico/.test(where)) return;             // the static server's, not the shot's
  errs.push(m.text() + (where ? ` <${where}>` : ''));
});
console.log(`driving ${URL}`);
await p.goto(URL, { waitUntil: 'networkidle2' });

/* Collect every beat the shot announces. The page under test may have no log on it — the event is
   the contract, not the markup. */
await p.evaluate(() => {
  window.__beats = [];
  addEventListener('shot-beat', e => window.__beats.push(String(e.detail)), true);
});
const beats = () => p.evaluate(() => window.__beats.join('\n'));
const until = async (re, ms = 120000) => {
  const t0 = Date.now();
  for (;;) {
    const t = await beats();
    if (re.test(t)) return t;
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${re}\nbeats so far:\n${t || '(none)'}`);
    await new Promise(r => setTimeout(r, 80));
  }
};
const frame = () => p.evaluate(() => {
  const f = document.querySelector('.shot.is-live iframe.shot-live');
  return !!(f && f.contentDocument);
});

ok('the live frame mounts', await (async () => {
  for (let n = 0; n < 150; n++) { if (await frame()) return true; await new Promise(r => setTimeout(r, 200)); }
  return false;
})());
if (fails.length) { await b.close(); process.exit(1); }

console.log('driving a full cycle…');
await until(/scrolling to/);

// 1 + 2 — the pointer, recorded by the shot at the instant it was placed. Reading the row's box
// after the tap measures a page that has already reflowed, which is not the question asked.
let aim = null;
for (let n = 0; n < 400 && !(aim && /sizing|benchmark|claims/i.test(aim.what)); n++) {
  aim = await p.evaluate(() => {
    const f = document.querySelector('.shot.is-live iframe.shot-live');
    return (f && f.contentWindow && f.contentWindow.__shot) || null;
  });
  if (!(aim && /sizing|benchmark|claims/i.test(aim.what))) await new Promise(r => setTimeout(r, 50));
}
ok('the pointer lands on the research row', !!aim && inside(aim, aim.box),
   aim ? `${aim.x},${aim.y} in ${aim.box.x0}-${aim.box.x1} x ${aim.box.y0}-${aim.box.y1}` : 'no record');
ok('the row is fully in the frame when tapped', !!aim && aim.inFrame);

const named = (await until(/↳ /)).match(/↳ (.+)/);
ok('it opens the named document', !!named && /market sizing/i.test(named[1]), named ? named[1] : '—');

// 3 + 4 — the drill: its own scroller moves, and its title wears no ring.
await new Promise(r => setTimeout(r, 2800));
const drill = await p.evaluate(() => {
  const d = document.querySelector('.shot.is-live iframe.shot-live').contentDocument;
  const sc = d.querySelector('.m3-drill .drill-scroll');
  const h = d.querySelector('.m3-drill .mh-hero .headline-m');
  return { open: !!d.querySelector('.drill-open'), scroller: !!sc,
    moved: sc ? Math.round(sc.scrollTop) : 0, room: sc ? sc.scrollHeight - sc.clientHeight : 0,
    outline: h ? getComputedStyle(h).outlineStyle : 'no headline' };
});
ok('the drill is open', drill.open);
ok('the drill scrolls its OWN surface', drill.scroller && drill.moved > 100, `${drill.moved}px of ${drill.room}`);
ok('no focus ring on the drill title', drill.outline === 'none', `outline-style: ${drill.outline}`);

// 5 — the poster gives way, so the visitor is looking at the live frame and not a still over it.
// The workbench has no poster: it is the frame on its own, by design.
const poster = await p.evaluate(() => {
  const i = document.querySelector('.shot.is-live .shot-frame > img');
  return i ? getComputedStyle(i).opacity : null;
});
if (PROBE) console.log('  ----  the poster (the workbench has none)');
else ok('the poster has faded out', poster === '0', `opacity ${poster}`);

// 6 — it closes, and the index goes home rather than staying mid-page for the next tab.
await until(/close/);
// the close beat announces itself at the TAP; the drill's own post-tap settle, the hold and the
// glide home all come after it — 3.6s of script, so wait past it rather than at it.
await new Promise(r => setTimeout(r, 4400));
const after = await p.evaluate(() => {
  const d = document.querySelector('.shot.is-live iframe.shot-live').contentDocument;
  return { open: !!d.querySelector('.drill-open'), top: Math.round(d.querySelector('.shell-main').scrollTop) };
});
ok('the drill closes', !after.open);
ok('the index returns to the top', after.top === 0, `${after.top}px`);
ok('no page errors', errs.length === 0, errs.join(' | '));

console.log('\nbeats:\n' + (await beats()).split('\n').map(l => '   ' + l).join('\n'));
await b.close();
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
