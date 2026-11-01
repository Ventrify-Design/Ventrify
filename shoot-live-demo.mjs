/* shoot-live-demo.mjs — stills FROM THE LIVE DEMO, so the posters and the running shot are the
 * same venture, the same brand and the same build. A poster captured from a different page is a
 * promise the live frame then breaks a second later.
 *
 *   node shoot-live-demo.mjs                 every shot in SHOTS
 *   node shoot-live-demo.mjs vs-verdict-score
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const URL = process.env.DEMO_URL || 'http://localhost:3000/ventrify-os/_redesign/m3/live-demo.html';
const OUT = 'assets/product/shots';

/* name → what to show. `tab` is matched on the tab's first word; `scroll` is a fraction of the
 * surface's range; `drill` opens a research document first and shoots THAT page. */
const SHOTS = {
  'vs-verdict-score': { tab: 'Verdict' },
  'vs-portfolio':     { tab: 'Verdict', scroll: .62 },
  'vs-investability': { tab: 'Investability' },
  'vs-research':      { tab: 'Research' },
  'vs-research-doc':  { tab: 'Research', drill: ['market sizing'], drillScroll: .18 },
  'vs-dataroom':      { tab: 'Data' },
};

const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
});
for (const [name, plan] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await p.goto(URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 900));
  const note = await p.evaluate(async plan => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const main = document.querySelector('.shell-main');
    if (plan.tab) {
      const re = new RegExp('^' + plan.tab, 'i');
      const t = [...document.querySelectorAll('.m3-tab')].find(x => re.test(x.textContent.trim()));
      if (!t) return 'no tab ' + plan.tab;
      t.click(); await sleep(700);
    }
    if (plan.drill) {
      const rows = [...document.querySelectorAll('.tab-panel.active .mrow.research.drill')];
      let row = null;
      for (const want of plan.drill) { row = rows.find(r => new RegExp(want, 'i').test(r.textContent)); if (row) break; }
      if (!row) return 'no research row';
      row.click(); await sleep(1100);
      const sc = document.querySelector('.m3-drill .drill-scroll');
      if (sc && plan.drillScroll) { sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * plan.drillScroll; await sleep(500); }
      return 'drill: ' + row.textContent.trim().slice(0, 30);
    }
    if (plan.scroll && main) { main.scrollTop = (main.scrollHeight - main.clientHeight) * plan.scroll; await sleep(600); }
    return 'ok';
  }, plan);
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png  (${note})`);
  await p.close();
}
await b.close();
