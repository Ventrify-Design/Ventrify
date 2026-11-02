/* shoot-live-demo.mjs — the POSTERS, shot from the pages the live shots run.
 *
 * A live <v-shot> keeps its still as the poster: what a visitor sees before the frame is ready, if
 * the embed fails, under reduced motion, and on a phone. A poster captured from a different page,
 * a different venture or an older build is a promise the live frame breaks a second later — so
 * every still on the site comes from here, from the same two demo pages the shots embed.
 *
 *   node shoot-live-demo.mjs                  all of them
 *   node shoot-live-demo.mjs vs-assistant     one
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const HOST = process.env.SHOT_HOST || 'http://localhost:3000';
const DEMO  = '/ventrify-os/_redesign/m3/live-demo.html';
const FLOW  = '/ventrify-os/_redesign/m3/live-demo-flow.html';
const OUT = 'assets/product/shots';

/* Each poster is the frame of its choreography worth freezing — usually the moment the shot is
 * building towards, not its opening. The hero is the exception: it is the first thing on the page,
 * so its poster is what the live frame starts on, and the handover is invisible. */
const SHOTS = {
  'vs-verdict-score': { page: DEMO,  plan: { tab: 'Verdict' } },
  /* The poster for the whole-flow shot. The run is the frame that says "how it works" on its own:
     eleven named workstreams, the one in flight, and a clock that admits it takes two hours. */
  'vs-run':           { page: FLOW,  plan: { run: 4 } },
  'vs-assistant':     { page: DEMO,  plan: { tab: 'Verdict', assist: true } },
  'vs-dataroom':      { page: DEMO,  plan: { tab: 'Data' } },
  'vs-research-doc':  { page: DEMO,  plan: { tab: 'Research', drill: ['market sizing'], drillScroll: .18 } },
};

const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
});
let bad = 0;
for (const [name, { page, plan }] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await p.goto(HOST + page, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 900));

  const note = await p.evaluate(async plan => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const main = document.querySelector('.shell-main');
    if (plan.tab) {
      const t = [...document.querySelectorAll('.m3-tab')].find(x => new RegExp('^' + plan.tab, 'i').test(x.textContent.trim()));
      if (!t) return 'no tab ' + plan.tab;
      t.click(); await sleep(700);
    }
    if (plan.scan != null) {
      // Freeze the read PART WAY THROUGH: a finished scan is a list, a running one is the argument.
      const f = document.getElementById('na-drive');
      if (f) { f.value = 'https://drive.google.com/drive/folders/1kQ9xTideline-dataroom'; f.dispatchEvent(new Event('input', { bubbles: true })); }
      const n = document.getElementById('na-name');
      if (n) { n.value = 'Tideline'; n.dispatchEvent(new Event('input', { bubbles: true })); }
      window.__demo.attachDeck();
      const run = window.__demo.scanRoom();
      await sleep(5600 * plan.scan);
      const shown = document.querySelector('.rsb');
      run.then(() => {});                 // let it finish in the background; we shoot mid-read
      return shown ? 'mid-read' : 'the banner was gone';
    }
    if (plan.run != null) {
      window.__demo.run();                 // not awaited: we want it mid-run, at a named step
      for (let n = 0; n < 200; n++) {
        const live = document.querySelector('.run-step.live .idx');
        if (live && Number(live.textContent) >= plan.run) break;
        await sleep(100);
      }
      const live = document.querySelector('.run-step.live .bd p');
      return live ? 'step: ' + live.textContent.trim().slice(0, 34) : 'no live step';
    }
    if (plan.assist) {
      const btn = document.querySelector('[data-panel="assist"]');
      if (!btn) return 'no assist tool in the rail';
      btn.click(); await sleep(800);
      const box = document.getElementById('chat-input');
      if (box) { box.value = 'What is the single biggest risk to this score?'; box.dispatchEvent(new Event('input', { bubbles: true })); }
      await window.__demo.ask();
      await sleep(400);
      return 'assistant answered';
    }
    if (plan.drill) {
      const rows = [...document.querySelectorAll('.tab-panel.active .mrow.research.drill')];
      let row = null;
      for (const want of plan.drill) { row = rows.find(r => new RegExp(want, 'i').test(r.textContent)); if (row) break; }
      if (!row) return 'no research row';
      row.click(); await sleep(1100);
      const sc = document.querySelector('.m3-drill .drill-scroll');
      if (sc && plan.drillScroll) { sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * plan.drillScroll; await sleep(500); }
      return 'drill: ' + row.textContent.trim().slice(0, 28);
    }
    if (plan.scroll && main) { main.scrollTop = (main.scrollHeight - main.clientHeight) * plan.scroll; await sleep(600); }
    return 'ok';
  }, plan);

  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const fail = errs.length || /^no |was gone/.test(note);
  if (fail) bad++;
  console.log(`  ${fail ? 'FAIL' : ' ok '}  ${name}.png  (${note})${errs.length ? ' · ' + errs.join(' | ') : ''}`);
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
