#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FOLD BEHAVIOUR — every fold on the pre-screen, CLICKED.
//
// The Verdict tab now folds at three scales: the section by its head, the three brief blocks by
// their labels, and each finding by its claim. All three are `<details>`, which is why there is no
// handler to unit-test — and exactly why nothing was testing them. A fold is the only control on
// this page, and the static gates cannot tell a working one from a `<summary>` that renders and
// does nothing.
//
// IT EXISTS BECAUSE OF THE CHEVRONS. `.bpb-bk > span` was written to style the count; it also
// matched the caret beside it, so every block chevron rendered wearing the count's tinted pill and
// 7px of padding. Nothing failed — css-parity passed, contrast passed, the markup was right — and
// the operator saw three broken-looking buttons. A bare child selector in a row with more than one
// kind of child is a bug waiting for the second child to arrive, and only a rule that reads the
// caret's own computed style catches it.
//
//  RULE 1 — EVERY FOLD TOGGLES. Click opens, click again closes, and the body is really laid out
//           (offsetHeight > 0) rather than merely present in the DOM.
//  RULE 2 — KEYBOARD WORKS. Enter on a focused summary toggles it, which is the thing `<details>`
//           was chosen for and therefore the thing worth proving.
//  RULE 3 — NO CARET WEARS A PILL. Transparent background, no padding, and a sane box.
//  RULE 4 — THE BRIEF'S BLOCKS ARRIVE CLOSED, with their counts readable while shut.
//  RULE 5 — NOTHING SCROLLS SIDEWAYS AT 390px, open or shut, including the ps2Stress specimen — an
//           80-character unbroken token, a 20-person team, a filename with no spaces, a source title
//           too long for its column. Every string on this tab was copied by a model out of a
//           customer's document, so none of that is hypothetical; the stored corpus simply has not
//           produced it yet. MEASURED: before `overflow-wrap: anywhere` and `min-width: 0` on the
//           hero's grid children, that content put a 749px scrollbar on a 390px phone.
//
// PRECONDITION: a server on :3200 serving ventrify-os.
// Run: node tools/fold-behaviour.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer from '../../node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const BASE = process.env.OS_BASE || 'http://localhost:3200';
const CANARY = process.argv.includes('--canary');
const SPECIMENS = ['ps2Brief', 'ps2Point', 'ps2Bet', 'ps2Case', 'ps2Strand', 'ps2Stress'];
const settle = (ms = 70) => new Promise(r => setTimeout(r, ms));

async function audit(browser, id, injectCss = '') {
  const bad = [];
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1200, height: 1000 });
  await pg.goto(`${BASE}/_redesign/m3/specimen.html?id=${id}`, { waitUntil: 'networkidle0' });
  await settle(350);
  if (injectCss) await pg.addStyleTag({ content: injectCss });

  const folds = await pg.$$eval('details > summary', els => els.length);
  if (!folds) bad.push(`${id}: no folds on the page at all`);

  // RULE 1 — open each one, then shut it.
  //
  // ⚠ A REAL MOUSE, NOT el.click(). The first version drove this with `evaluate(el => el.click())`,
  // which dispatches an untrusted event straight at the node: it sails through `pointer-events:
  // none`, through a transparent overlay sitting on top, and through a control scrolled out of
  // reach. The canary for "a summary nobody can click" passed against a page where nobody could
  // click anything. pg.mouse.click goes to COORDINATES, so it fails the way a person would.
  //
  // The element is re-found by index before every click, because opening a fold re-lays the page
  // out and both a stale handle and a stale coordinate then hit the wrong thing.
  const SEL = 'details > summary';
  const stateOf = (n) => pg.evaluate((s, i) => {
    const el = document.querySelectorAll(s)[i], d = el.parentElement;
    const body = [...d.children].find(c => c !== el);
    return { open: d.open, laidOut: !!(body && body.offsetHeight > 0) };
  }, SEL, n);
  // ⚠ SCROLL, SETTLE, *THEN* MEASURE. Doing the scrollIntoView and the getBoundingClientRect in one
  // evaluate and the click outside it straddles the scroll: the coordinates are read before the
  // container has finished moving, and the mouse lands on whatever is at the old position. Measured
  // on the real page — a click computed that way hit the <section> behind the control and the fold
  // never opened, while the gate reported a pass. Three steps, each settled.
  const clickReally = async (n) => {
    await pg.evaluate((s, i) => document.querySelectorAll(s)[i].scrollIntoView({ block: 'center' }), SEL, n);
    await settle(120);
    const box = await pg.evaluate((s, i) => {
      const el = document.querySelectorAll(s)[i];
      const r = el.getBoundingClientRect();
      const x = r.left + Math.min(r.width / 2, 60), y = r.top + r.height / 2;
      // Prove the point belongs to this control BEFORE spending a click on it.
      const hit = document.elementFromPoint(x, y);
      return { x, y, w: r.width, h: r.height, ours: !!(hit && (hit === el || el.contains(hit))) };
    }, SEL, n);
    if (box.w < 1 || box.h < 1) return `has no clickable box (${Math.round(box.w)}x${Math.round(box.h)})`;
    if (!box.ours) return 'is not the element at its own coordinates — something is covering it';
    await pg.mouse.click(box.x, box.y);
    return '';
  };

  for (let i = 0; i < folds; i++) {
    const before = (await stateOf(i)).open;
    const noBox = await clickReally(i);
    if (noBox) { bad.push(`${id}: fold ${i} ${noBox}`); continue; }
    await settle();
    const opened = await stateOf(i);
    if (opened.open === before) bad.push(`${id}: fold ${i} did not toggle when clicked where it is drawn`);
    if (opened.open && !opened.laidOut) bad.push(`${id}: fold ${i} reports open but its body has no height`);
    await clickReally(i);
    await settle();
    if ((await stateOf(i)).open !== before) bad.push(`${id}: fold ${i} did not return to its starting state`);
  }

  // RULE 2 — the keyboard path, which is the whole reason this is <details> and not a button.
  if (folds) {
    const start = await pg.evaluate(() => document.querySelector('details > summary').parentElement.open);
    await pg.evaluate(() => document.querySelector('details > summary').focus());
    await pg.keyboard.press('Enter');
    await settle();
    const after = await pg.evaluate(() => document.querySelector('details > summary').parentElement.open);
    if (after === start) bad.push(`${id}: Enter on a focused summary does nothing`);
  }

  // RULE 3 — the carets themselves
  const carets = await pg.evaluate(() => [...document.querySelectorAll('.ps-car')].map(c => {
    const s = getComputedStyle(c), r = c.getBoundingClientRect();
    return { bg: s.backgroundColor, pl: s.paddingLeft, pt: s.paddingTop, w: Math.round(r.width), h: Math.round(r.height) };
  }));
  carets.forEach((c, i) => {
    const painted = c.bg && c.bg !== 'rgba(0, 0, 0, 0)' && c.bg !== 'transparent';
    if (painted) bad.push(`${id}: caret ${i} has a background (${c.bg}) — it is wearing another element's pill`);
    if (parseFloat(c.pl) > 0 || parseFloat(c.pt) > 0) bad.push(`${id}: caret ${i} has padding (${c.pl} / ${c.pt})`);
    if (c.w > 30 || c.h > 30) bad.push(`${id}: caret ${i} is ${c.w}x${c.h} — too big for a chevron`);
  });

  // RULE 4 — the brief's three blocks
  if (id === 'ps2Brief') {
    const blocks = await pg.evaluate(() => [...document.querySelectorAll('.bpb-b')].map(b => {
      const n = b.querySelector('.bpb-bn');
      return { open: b.open, count: n ? n.textContent.trim() : '', countW: n ? Math.round(n.getBoundingClientRect().width) : 0 };
    }));
    if (blocks.length !== 3) bad.push(`ps2Brief: ${blocks.length} blocks, expected 3`);
    blocks.forEach((b, i) => {
      if (b.open) bad.push(`ps2Brief: block ${i} arrives OPEN — the three are reference, they start shut`);
      if (!/\d/.test(b.count)) bad.push(`ps2Brief: block ${i} shows no count while closed`);
      if (b.countW < 14) bad.push(`ps2Brief: block ${i}'s count is ${b.countW}px wide — unreadable`);
    });
  }
  // RULE 5 — the phone, with everything open and everything shut
  for (const state of ['shut', 'open']) {
    await pg.setViewport({ width: 390, height: 900 });
    await pg.evaluate((o) => document.querySelectorAll('details').forEach(d => { d.open = o; }), state === 'open');
    await settle(200);
    const o = await pg.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    if (o.s > o.c + 1) bad.push(`RULE 5 — ${id}: scrolls sideways at 390px with the folds ${state} (${o.s} vs ${o.c})`);
  }

  await pg.close();
  return bad;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
try {
  if (CANARY) {
    // The exact bug, reproduced: a bare child selector that also catches the caret.
    const PILL = '.bpb-bk > span { padding: 1px 7px; border-radius: 999px; background: rgb(40,36,70); }';
    const DEAD = 'details > summary { pointer-events: none; }';
    const OPEN = '.bpb-b { } details.bpb-b > summary { display: flex; }';
    const checks = [
      ['the chevron wearing the count\'s pill',
        (await audit(browser, 'ps2Brief', PILL)).some(x => /background|padding/.test(x))],
      // `pointer-events: none` is caught at the hit test rather than at the toggle, because the gate
      // now refuses to spend a click on coordinates that do not belong to the control. Match both
      // wordings, so a future change to WHERE it is caught does not quietly disarm the canary.
      ['a summary that cannot be clicked',
        (await audit(browser, 'ps2Brief', DEAD)).some(x => /toggle|starting state|covering it/.test(x))],
      ['content that cannot wrap opening a scrollbar',
        (await audit(browser, 'ps2Stress', '.ps-sec, .ps-sec *, .section-hero, .section-hero * { overflow-wrap: normal; }'))
          .some(x => /scrolls sideways/.test(x))],
      ['a caret blown up to a button',
        (await audit(browser, 'ps2Brief', '.ps-car { width: 40px; height: 40px; }')).some(x => /too big/.test(x))],
      ['healthy brief clean', (await audit(browser, 'ps2Brief', OPEN)).length === 0],
      ['healthy findings clean', (await audit(browser, 'ps2Strand')).length === 0],
    ];
    checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(38)} ${ok ? 'caught' : 'MISSED'}`));
    process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
  }
  const problems = [];
  for (const id of SPECIMENS) problems.push(...await audit(browser, id));
  problems.forEach(x => console.log(`  ✗ ${x}`));
  console.log(problems.length
    ? `\n  FAIL — ${problems.length} problem(s): a fold on the pre-screen does not work`
    : `  PASS — every fold across ${SPECIMENS.length} specimens opens, lays out, closes and answers the\n         keyboard; no caret is wearing another element's background; the brief's three blocks\n         arrive closed with their counts readable; and nothing scrolls sideways at 390px,\n         including against deliberately hostile content`);
  process.exit(problems.length ? 1 : 0);
} finally { await browser.close(); }
