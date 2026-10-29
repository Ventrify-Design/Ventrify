/* ════════════════════════════════════════════════════════════════════════════
   MOTION GATE — the chart entrance layer, checked against its own two rules.

   RULE 1 · NOTHING IS HIDDEN IN BASE CSS. Every start state lives inside a
            @keyframes `from`, so a chart renders complete when the animation
            never runs. The gate proves it by rendering each tab TWICE — once
            with motion, once under prefers-reduced-motion: reduce — and
            comparing the painted geometry of every mark. They must match.

   RULE 2 · EVERY MARK THE LAYER CLAIMS IS A MARK THAT EXISTS. A tab whose
            markup was rewritten must not quietly fall out of the layer.

   ⚠ WHY THE SELECTORS ARE PARSED AND NOT LISTED. The predecessor of this file
   kept a hand-written array of mark selectors, and twice it went stale the day
   the markup under it changed — reporting 3 marks on a tab that had 16, passing
   both times. A gate that can go quiet is worse than no gate. So the selector
   set is READ OUT OF ds.css: whatever the .charts-in layer animates is what gets
   checked, and adding a chart to the layer enrols it here automatically.

   Run: node ventrify-os/_redesign/m3/motion-gate.mjs
   ════════════════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000/ventrify-os/_redesign/m3/';
const PAGE = 'assess.html';
const TABS = ['Verdict', 'Investability', 'Market', 'Team', 'Diligence', 'Research'];

/* ── the layer's own selector list, read from the stylesheet ─────────────── */
const css = readFileSync(join(HERE, '../../shared/m3/ds.css'), 'utf8');
const layer = css.slice(css.indexOf('CHART ENTRANCE MOTION'));
const SELECTORS = [...new Set(
  [...layer.matchAll(/^\s*(\.charts-in [^,{]+?)\s*[,{]/gm)]
    .map(m => m[1].replace(/^\.charts-in\s+/, '').trim())
    .filter(s => s && !s.startsWith('@'))
)];
if (SELECTORS.length < 10) {
  console.error(`✗ parsed only ${SELECTORS.length} selectors out of the motion layer — the parser is broken, not the product`);
  process.exit(1);
}

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
});

/* Every mark's identity + painted box, as the page actually renders it. */
const probe = sels => {
  const out = [];
  const panel = document.querySelector('.tab-panel.active');
  if (!panel) return out;
  sels.forEach(sel => {
    let els = [];
    try { els = [...panel.querySelectorAll(sel)]; } catch (e) { return; }
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // An animation with fill:both leaves the IDENTITY matrix behind where no animation ran
      // leaves `none`. Same pixels, different string — normalise, or every settled mark reads
      // as a diff and the gate fails on its own bookkeeping rather than on the product.
      const t = /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\))$/.test(cs.transform) ? '-' : cs.transform;
      out.push([sel, i, Math.round(r.width), Math.round(r.height),
                Math.round(r.x), Math.round(r.y), (+cs.opacity).toFixed(2), t].join('|'));
    });
  });
  return out;
};

async function run(reduced) {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1100 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + PAGE, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  const perTab = {};
  for (const name of TABS) {
    await p.evaluate(n => {
      const t = [...document.querySelectorAll('.m3-tab')].find(x => x.textContent.trim().startsWith(n));
      if (t) t.click();
    }, name);
    // long enough for the whole choreography (the layer's budget is ~1020ms) to settle
    await new Promise(r => setTimeout(r, 1500));
    perTab[name] = {
      marks: await p.evaluate(probe, SELECTORS),
      running: await p.evaluate(() => document.getAnimations()
        .filter(a => a.effect && a.effect.target && a.effect.target.closest
                  && a.effect.target.closest('.tab-panel.active')).length),
    };
  }
  await p.close();
  return { perTab, errs };
}

const motion = await run(false);
const still = await run(true);
await b.close();

let bad = 0;
console.log(`motion layer: ${SELECTORS.length} selectors parsed from ds.css\n`);
for (const name of TABS) {
  const m = motion.perTab[name], s = still.perTab[name];
  const same = m.marks.length === s.marks.length && m.marks.every((x, i) => x === s.marks[i]);
  // a tab with no animated mark at all is the stale-selector failure mode this gate exists for
  const empty = m.marks.length === 0;
  const ok = same && !empty;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${name.padEnd(14)} ${String(m.marks.length).padStart(3)} marks` +
    `${empty ? '  ← NO ANIMATED MARK ON THIS TAB' : ''}` +
    `${same ? '' : `  ← renders DIFFERENTLY with motion off (${s.marks.length} marks)`}`);
  if (!same && !empty) {
    const diff = m.marks.find((x, i) => x !== s.marks[i]);
    console.log(`       motion: ${diff}\n       still : ${s.marks[m.marks.indexOf(diff)]}`);
  }
}
const jsErrs = [...motion.errs, ...still.errs].filter(e => !/favicon/i.test(e));
if (jsErrs.length) { bad++; console.log('\n❌ JS errors:', jsErrs); }
console.log(bad ? `\n❌ MOTION GATE FAILED (${bad})` : '\n✅ MOTION GATE PASSED — every tab animates, and every tab renders identically with motion off');
process.exit(bad ? 1 : 0);
