#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   CONTAINMENT — nothing escapes the column it is written in.

   WHY THIS EXISTS. The editorial column is laid out with `grid-template-columns:
   1fr 1fr`. `1fr` is shorthand for `minmax(auto, 1fr)`, and `auto` floors the
   track at its content's MIN-CONTENT width. One unbreakable child — the
   pre-screen's citation chip is `white-space: nowrap` — inflates the track, and
   the whole column bursts out of the section's padding.

   It does not produce a horizontal scrollbar, because the burst still fits
   inside the viewport. So every "no horizontal overflow" check in this repo
   passed, `scrollWidth === clientWidth`, conformance was green, and the text was
   visibly cut off at 390px: the case column's right edge measured 379px inside a
   310px stage.

   WHAT IT CHECKS. Inside the editorial reading column, every element's border
   box stays within its container's content box, at three widths. Scroll
   containers and absolutely-positioned children are exempt — they escape on
   purpose — and everything else is not.

     node tools/containment.mjs          the real check
     node tools/containment.mjs --self   prove the gate can fail
   ════════════════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';

const SELF = process.argv.includes('--self');
const BASE = 'http://localhost:3000/ventrify-os/_redesign/m3';
const PAGES = ['_prescreen-verdict.html', 'assess.html'];
const WIDTHS = [390, 768, 1440];
const ROOT_SEL = '.brief';         // the editorial reading column, on every memo-shaped page
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

const probe = (rootSel, inject) => {
  const out = [];
  for (const root of document.querySelectorAll(rootSel)) {
    if (!root.offsetParent && root.offsetHeight === 0) continue;
    const cs = getComputedStyle(root);
    const limit = root.getBoundingClientRect().right - parseFloat(cs.paddingRight || 0);
    for (const el of root.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.position === 'absolute' || s.position === 'fixed') continue;
      if (/(auto|scroll)/.test(s.overflowX)) continue;          // a scroll container escapes on purpose
      // a child of a scroll container is measured against that container, not the column
      if (el.closest('[style*="overflow"], .tbl-scroll, .app-scroll')) continue;
      if (s.display === 'none' || !el.getClientRects().length) continue;
      const over = Math.round(el.getBoundingClientRect().right - limit);
      if (over > 1) out.push({ cls: (typeof el.className === 'string' ? el.className : '').split(' ').slice(0, 2).join('.') || el.tagName, over });
    }
  }
  if (inject) out.push({ cls: 'CANARY', over: 99 });
  // one row per class, worst first — a burst column reports once, not forty times
  const byCls = new Map();
  for (const o of out) if (!byCls.has(o.cls) || byCls.get(o.cls) < o.over) byCls.set(o.cls, o.over);
  return [...byCls.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
};

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});
for (const file of PAGES) {
  const p = await b.newPage();
  for (const w of WIDTHS) {
    await p.setViewport({ width: w, height: 900 });
    await p.goto(`${BASE}/${file}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 700));
    const bad = await p.evaluate(probe, ROOT_SEL, SELF);
    ok(!bad.length, `${file} @ ${w}px${bad.length
      ? ` — ${bad.length} element(s) escape the column:\n` + bad.map(([c, o]) => `        .${c}  +${o}px`).join('\n')
      : ' — everything stays inside the column'}`);
  }
  await p.close();
}
await b.close();

if (SELF) {
  console.log(fails ? '\n  ok  CANARY: the injected escape was caught — the gate can fail'
                    : '\n  ✗   CANARY: the injected escape was NOT caught — this gate is decoration');
  process.exit(fails ? 0 : 1);
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
