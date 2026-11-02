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
  /* ⚠ A COMPOSED STILL — the product does not lay the Data room tab out this way.
     Measured at 1440x900: the hero's right column holds the Room coverage lockup and is 157px tall
     against a 542px left column, and "What the score looks for" — the list the lockup is a map of —
     starts at y878, twenty-two pixels below the fold. So a screenshot of this tab shows the figure
     and none of the thing it summarises, with a 377px void beside it.
     For the website only, the head and first rows of that list are lifted into the void so one
     frame carries both. Nothing is invented: it is the real section, rendered by the real component,
     moved. If the void bothers us in the PRODUCT as well, that is a layout decision to take there —
     not something to settle by cropping a marketing shot. */
  'vs-dataroom':      { page: DEMO,  plan: { tab: 'Data', liftRoomList: 3 } },
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
    if (plan.liftRoomList) {
      const right = document.querySelector('.tab-panel.active .section-hero .right');
      const list = document.querySelector('.tab-panel.active .sec.rc');
      if (!right || !list) return 'no hero right column / room list';
      const lifted = list.cloneNode(true);
      // keep the section head and the first N rows; the rest is what the fade says continues
      const rows = [...lifted.querySelectorAll('.rcl')];
      rows.slice(plan.liftRoomList).forEach(r => r.remove());
      // the section's own tail — the request-documents action, its "or run it as it stands" aside and
      // the provenance footnote — belongs to the whole list, not to three rows of it
      lifted.querySelectorAll('.rc-extra, .rc-act, .profile-foot, .dz, .m3-btn').forEach(e => e.remove());
      lifted.classList.add('__lifted');
      const wrap = document.createElement('div');
      wrap.className = '__lift-wrap';
      wrap.appendChild(lifted);
      right.appendChild(wrap);
      const st = document.createElement('style');
      // the fade is the honest part: it says the list continues past the frame
      st.textContent = `.__lift-wrap{position:relative;margin-top:26px;-webkit-mask-image:linear-gradient(to bottom,#000 0,#000 72%,transparent 100%);mask-image:linear-gradient(to bottom,#000 0,#000 72%,transparent 100%)}
        .__lifted{padding-top:0!important;border-top:1px solid var(--md-sys-color-outline-variant);padding-top:18px!important}
        .__lifted .sec-head .meta,.__lifted .sec-head .eyebrow{display:none}`;
      document.head.appendChild(st);
      await sleep(400);
      return `lifted ${Math.min(plan.liftRoomList, rows.length)} of ${rows.length} rows into the hero`;
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
