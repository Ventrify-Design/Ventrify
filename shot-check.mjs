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
 *   node shot-check.mjs --boot          every embedded page boots clean (~6s) — run this first
 *   node shot-check.mjs                 the live VerdictScore page
 *   node shot-check.mjs --probe         the workbench at sites/_live-shot-probe.html
 *   node shot-check.mjs <script>        one choreography on the workbench, start to finish
 *   node shot-check.mjs --canary        prove the assertions can fail
 */
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';

const HOST = process.env.SHOT_HOST || 'http://localhost:3000';
const PROBE = process.argv.includes('--probe');
const URL = process.env.SHOT_URL || HOST + (PROBE ? '/sites/_live-shot-probe.html' : '/sites/verdict-score/');
const CANARY = process.argv.includes('--canary');
const BOOT = process.argv.includes('--boot');
const SCRIPT = process.argv.slice(2).find(a => !a.startsWith('-'));

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

/* ── BOOT ──────────────────────────────────────────────────────────────────
   Does each embedded page actually RUN? A module with a syntax error is served 200 and renders an
   empty <div id="app">; curl cannot tell the difference and neither can reading the diff. That is
   exactly how a broken live-demo.html survived a check this session — one stray newline inside a
   string literal, and the whole page silently stopped executing.

   Six seconds, no choreography. Run it after every edit to a demo page. */
if (BOOT) {
  /* chatReveal is the one rule the progressive reveal depends on: never cut inside a [[citation]],
     a **bold run** or a ⟨derived⟩ marker, because chatMsg parses all three and half a marker renders
     as literal punctuation mid-sentence. Pure function, no browser, free — so it runs here. */
  const { chatReveal } = await import('./ventrify-os/shared/m3/ds.js');
  const SAMPLE = '**The moat is not built.** Two score zero [[research:claims-pressure-test]], and '
    + 'closing it is a funded build \u27e8derived\u27e9 \u2014 see also [[research:competitive-benchmark]].';
  const frames = chatReveal(SAMPLE);
  const n = (t, x) => t.split(x).length - 1;
  const split = frames.filter(f => n(f, '[[') !== n(f, ']]') || n(f, '\u27e8') !== n(f, '\u27e9') || n(f, '**') % 2);
  ok('chatReveal never cuts a marker in half', split.length === 0, split.length ? JSON.stringify(split[0].slice(-40)) : `${frames.length} frames`);
  ok('chatReveal ends on the whole answer', frames[frames.length - 1] === SAMPLE);

  /* Every `call` beat names a function the embedded page actually exposes. A missing one does not
     throw — the engine logs "the page exposes no __demo.x" into a log nobody is reading and the
     beat is skipped, so the shot quietly loses a step. Free, and it catches a rename. */
  const demoSrc = readFileSync('ventrify-os/_redesign/m3/demo-tideline.js', 'utf8');
  const defined = new Set([...demoSrc.matchAll(/^  (\w+)\s*\(/gm)].map(m => m[1]));
  const { SCRIPTS } = await import('./sites/shared/shot-live.js');
  const missing = [];
  for (const [name, def] of Object.entries(SCRIPTS))
    for (const b of def.beats)
      if (b.act === 'call' && !defined.has(b.fn)) missing.push(`${name} → __demo.${b.fn}`);
  ok('every call beat names a function the page defines', !missing.length, missing.join(', '));

  const pages = [...new Set(
    [...readFileSync('sites/shared/shot-live.js', 'utf8').matchAll(/page:\s*DEMO \+ '([^']+)'/g)]
      .map(m => '/ventrify-os/_redesign/m3/' + m[1]))];
  if (!pages.length) { console.log('FAIL  no demo pages found in SCRIPTS'); process.exit(1); }
  const sheets = [];
  for (const path of pages) {
    const pg = await b.newPage();
    const bad = [];
    pg.on('pageerror', e => bad.push(String(e).split('\n')[0]));
    pg.on('console', m => {
      if (m.type() !== 'error') return;
      const w = (m.location() && m.location().url) || '';
      if (!/favicon\.ico/.test(w)) bad.push(m.text());
    });
    await pg.goto(HOST + path, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 900));
    // The shell is the proof the module ran to the end: pageShell() replaces #app, so an #app that
    // is still there is a page that threw before it got anywhere.
    const built = await pg.evaluate(() => !!document.querySelector('.shell-main') && !document.getElementById('app'));
    ok(path.split('/').pop(), built && !bad.length, bad.length ? bad.join(' | ') : (built ? 'shell mounted' : 'the shell never mounted'));
    sheets.push([path, await pg.evaluate(() => [...document.styleSheets].map(s => (s.href || '').split('/').pop()).filter(Boolean).join(','))]);
    await pg.close();
  }
  /* The brand chain is the one thing these pages cannot share: HTML has no import, so each carries
     its own <link> list, and the order is load-bearing — brand.css first for the tokens, brand-map
     last so its remaps win. A page that drops one renders in Material's stock palette and nothing
     throws. So they are asserted identical instead. */
  const first = sheets[0];
  sheets.slice(1).forEach(([path, css]) =>
    ok(`${path.split('/').pop()} loads the same brand chain`, css === first[1],
       css === first[1] ? '' : `differs from ${first[0].split('/').pop()}`));
  await b.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nevery embedded page boots clean');
  process.exit(fails.length ? 1 : 0);
}

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
/* PER SHOT, not per page. Three live shots on one page all bubble `shot-beat` to the document, so
   one flat log makes "wait for Send" match whichever frame said it first. */
const collect = () => p.evaluate(() => {
  window.__beats = {};
  addEventListener('shot-beat', e => {
    const host = e.target.closest && e.target.closest('.shot[live]');
    const k = host ? host.getAttribute('live') : '?';
    (window.__beats[k] = window.__beats[k] || []).push(String(e.detail));
  }, true);
});
await collect();
const beats = (k) => p.evaluate(k => ((window.__beats || {})[k] || []).join('\n'), k);
let CUR = null;
const until = async (re, ms = 120000) => {
  const t0 = Date.now();
  for (;;) {
    const t = await beats(CUR);
    if (re.test(t)) return t;
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${re} on ${CUR}\nbeats so far:\n${t || '(none)'}`);
    await new Promise(r => setTimeout(r, 80));
  }
};
const sel = (script) => `.shot.is-live[live="${script}"] iframe.shot-live`;
const inner = (script, fn, arg) => p.evaluate((s, src, a) => {
  const f = document.querySelector(s);
  const d = f && f.contentDocument;
  if (!d) return null;
  return (new Function('d', 'w', 'a', src))(d, f.contentWindow, a);
}, sel(script), 'return (' + fn + ')(d, w, a);', arg === undefined ? null : arg);
const aim = async (script, re) => {
  for (let n = 0; n < 500; n++) {
    const a = await p.evaluate(s => { const f = document.querySelector(s); return (f && f.contentWindow && f.contentWindow.__shot) || null; }, sel(script));
    if (a && re.test(a.what)) return a;
    await new Promise(r => setTimeout(r, 50));
  }
  return null;
};

const mounted = async (script) => {
  // A live shot is lazy: it does not exist until the reader is within 400px of it. On the real page
  // that means scrolling to it, which is also the only honest way to test the thing a visitor gets.
  await p.evaluate(s => { const el = document.querySelector(`.shot[live="${s}"]`); if (el) el.scrollIntoView({ block: 'center' }); }, script);
  for (let n = 0; n < 200; n++) {
    if (await inner(script, '(d) => !!d.querySelector(".shell-main")')) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
};

/* The page each choreography is supposed to run on. The component used to pass a default src that
   overrode it, so every shot embedded the same page and played its script against a screen that
   had none of the things it names — and rendered a perfectly good, completely wrong screen. */
const PAGE_OF = Object.fromEntries(
  [...readFileSync('sites/shared/shot-live.js', 'utf8').matchAll(/'([\w-]+)':\s*\{\s*page:\s*DEMO \+ '([^']+)'/g)]
    .map(m => [m[1], m[2]]));

/* ── what each choreography has to be true about ──────────────────────────── */
const CHECKS = {
  /* The hero. Three bugs live here, so three of these are regressions, not opinions. */
  async 'assessment-tour'() {
    await until(/scrolling to/);
    const a = await aim('assessment-tour', /sizing|benchmark|claims/i);
    ok('the pointer lands on the research row', !!a && inside(a, a.box),
       a ? `${a.x},${a.y} in ${a.box.x0}-${a.box.x1} x ${a.box.y0}-${a.box.y1}` : 'no record');
    ok('the row is fully in the frame when tapped', !!a && a.inFrame);

    const named = (await until(/\u21b3 /)).match(/\u21b3 (.+)/);
    ok('it opens the named document', !!named && /market sizing/i.test(named[1]), named ? named[1] : '—');

    await new Promise(r => setTimeout(r, 2800));
    const drill = await inner('assessment-tour', `(d) => {
      const sc = d.querySelector('.m3-drill .drill-scroll');
      const h = d.querySelector('.m3-drill .mh-hero .headline-m');
      return { open: !!d.querySelector('.drill-open'), scroller: !!sc,
        moved: sc ? Math.round(sc.scrollTop) : 0, room: sc ? sc.scrollHeight - sc.clientHeight : 0,
        outline: h ? getComputedStyle(h).outlineStyle : 'no headline' };
    }`);
    ok('the drill is open', drill.open);
    ok('the drill scrolls its OWN surface', drill.scroller && drill.moved > 100, `${drill.moved}px of ${drill.room}`);
    ok('no focus ring on the drill title', drill.outline === 'none', `outline-style: ${drill.outline}`);

    await until(/close/);
    await new Promise(r => setTimeout(r, 4400));   // post-tap settle + hold + the glide home
    const after = await inner('assessment-tour', `(d) => ({ open: !!d.querySelector('.drill-open'),
      top: Math.round(d.querySelector('.shell-main').scrollTop) })`);
    ok('the drill closes', !after.open);
    ok('the index returns to the top', after.top === 0, `${after.top}px`);
  },

  /* The whole flow. Four screens, three handovers, and a run compressed from two hours into about
     fourteen seconds — so what is worth asserting is that each handover LANDED and that the product
     state came with it, not that a timer ran. */
  async 'full-run'() {
    const book = await inner('full-run', `(d) => ({
      rows: d.querySelectorAll('.eng-row, .pf-row, [class*="triage"] .mrow, .m3-table tbody tr').length,
      band: !!d.querySelector('.pf-band, [class*="band"]'),
      heading: (d.querySelector('.mh-hero .headline-m, .headline-m') || {}).textContent || '',
    })`);
    ok('it opens on the portfolio', /all engagements/i.test(book.heading), book.heading.trim().slice(0, 40));

    await until(/New assessment/);
    await new Promise(r => setTimeout(r, 1500));
    ok('"New assessment" opens the create screen', !!(await inner('full-run', `(d) => !!d.getElementById('na-drive')`)));

    await until(/Read data room/);
    const typed = await inner('full-run', `(d) => (d.getElementById('na-drive')||{}).value || ''`);
    ok('the Drive URL was typed into the real field', /drive\.google\.com\/drive\/folders\//.test(typed), typed.slice(0, 48));
    ok('the scan banner came up', !!(await inner('full-run', `(d) => !!d.querySelector('.rsb')`)));

    /* Wait on the BANNER, not on a beat line. beats() returns the whole accumulated log, so any
       regex that could have matched an earlier line matches immediately. */
    for (let n = 0; n < 250; n++) {
      if (!(await inner('full-run', `(d) => !!d.querySelector('.rsb')`))) break;
      await new Promise(r => setTimeout(r, 200));
    }
    const room = await inner('full-run', `(d) => ({
      found: d.querySelectorAll('.rcl.is-found').length,
      gaps: d.querySelectorAll('.rcl.is-gap').length,
      live: [...d.querySelectorAll('.na-run')].filter(b => !b.disabled).length,
      gate: (d.getElementById('na-gate') || {}).textContent || '',
    })`);
    ok('document types ticked over to present', room.found >= 4 && room.gaps >= 1, `${room.found} present · ${room.gaps} not seen`);
    ok('the run buttons came alive', room.live === 2, `${room.live} enabled`);
    ok('the "attach a deck" gate cleared', room.gate.trim() === '', JSON.stringify(room.gate));

    await until(/Run full assessment/);
    // the run: the real eleven workstreams, and a clock that tells the truth about the duration
    let run = null;
    for (let n = 0; n < 250; n++) {
      run = await inner('full-run', `(d) => {
        const steps = d.querySelectorAll('.run-step');
        const live = d.querySelector('.run-step.live .bd p');
        // "23m elapsed" is rendered in two places by two components; read the page, not a class.
        const m = d.body.textContent.match(/(\\d+)\\s*m elapsed/);
        return { steps: steps.length, live: live ? live.textContent.trim() : '', elapsed: m ? m[1] : null };
      }`);
      if (run && run.steps && run.elapsed) break;
      await new Promise(r => setTimeout(r, 150));
    }
    ok('the run shows the real eleven workstreams', run && run.steps === 11, run ? `${run.steps} steps · ${run.live}` : 'never started');
    ok('the elapsed clock climbs at the real rate', run && Number(run.elapsed) > 0, run && run.elapsed ? `${run.elapsed}m in` : 'no elapsed');

    // and it lands on the verdict
    let done = null;
    for (let n = 0; n < 300; n++) {
      done = await inner('full-run', `(d) => ({
        tabs: d.querySelectorAll('.m3-tab').length,
        active: (d.querySelector('.m3-tab.on, .m3-tab[aria-selected="true"]') || {}).textContent || '',
        score: (d.querySelector('.lockup-num, .score-num') || {}).textContent || '',
      })`);
      if (done && done.tabs) break;
      await new Promise(r => setTimeout(r, 200));
    }
    ok('it lands on the finished assessment', done && done.tabs === 7, done ? `${done.tabs} tabs` : 'never landed');
    ok('and lands on the Verdict tab', done && /verdict/i.test(done.active), done ? done.active : '—');

    // the reload IS the loop: the beats must start again, not stop
    await until(/restart/, 40000);
    for (let n = 0; n < 150; n++) {
      const after = (await beats(CUR)).split('restart').pop();
      if (/New assessment|Tideline/.test(after)) break;
      await new Promise(r => setTimeout(r, 200));
    }
    ok('the reload restarts the choreography', /New assessment|Tideline/.test((await beats(CUR)).split('restart').pop()));
  },

  /* The assistant. The citation rule is the one that matters: chatMsg renders an id that is not in
     the corpus as a loud "unverified", which is the component working — and the last thing a
     marketing page should ship by accident. */
  async 'ask-the-memo'() {
    /* The beat logs at the TAP, so the panel has not opened yet and the push has not reflowed. Wait
       for the width to settle before measuring anything about it — the first version of these checks
       sampled immediately and passed once, by luck, on a frame that had not moved. */
    await until(/Assistant/);
    let settled = null;
    for (let n = 0, last = -1; n < 120; n++) {
      const w = await inner('ask-the-memo', `(d) => { const m = d.querySelector('.shell-main');
        return { w: Math.round(m.getBoundingClientRect().width), open: !!d.getElementById('chat-input') }; }`);
      if (w && w.open && w.w === last) { settled = w; break; }
      last = w ? w.w : -1;
      await new Promise(r => setTimeout(r, 120));
    }
    ok('the assistant panel opens', !!settled, settled ? `primary settled at ${settled.w}px` : 'never settled');
    ok('it opens on the "I can only see this assessment" state',
       !!(await inner('ask-the-memo', `(d) => !!d.querySelector('.chat-empty')`)));

    /* THE HERO AT HALF WIDTH. Pushing the panel took the primary from 1108px to 676px while it kept
       rendering the wide two-column hero: columns 539/408 → 293/222, which puts a 103px score number
       and a 116px band chip inside a 178px lockup. openAux now applies the DS's narrow presentation
       the way openDrill already did, and the verdict's score — restated in full on its own tab —
       drops out rather than stacking above the memo. */
    const hero = await inner('ask-the-memo', `(d) => {
      const m = d.querySelector('.shell-main'), h = d.querySelector('.tab-panel.active .section-hero');
      const r = h && h.querySelector('.right');
      return { compact: m.classList.contains('is-compact'),
        cols: (getComputedStyle(h).gridTemplateColumns.match(/px/g) || []).length,
        left: Math.round(h.querySelector('.left').getBoundingClientRect().width),
        right: r ? getComputedStyle(r).display : 'absent' };
    }`);
    ok('the primary takes the narrow presentation', hero.compact);
    ok('the hero is one column, not two squeezed', hero.cols === 1, `${hero.cols} tracks · left ${hero.left}px`);
    ok('the statement is not squashed', hero.left > 500, `${hero.left}px`);
    ok('the restated score drops out', hero.right === 'none', hero.right);

    /* THE ANSWER ARRIVES, IT DOES NOT APPEAR. Sampled while it lands: the prose has to grow, and the
       sources and the proposal have to come last. */
    await until(/Send/);
    const grew = [];
    for (let n = 0; n < 60; n++) {
      const f = await inner('ask-the-memo', `(d) => {
        const b = d.querySelector('.chat-msg.bot .chat-body');
        return { chars: b ? b.textContent.length : 0, chips: d.querySelectorAll('.chat-chip').length,
                 bad: d.querySelectorAll('.chat-bad').length, warn: d.querySelectorAll('.chat-warn').length };
      }`);
      if (f) grew.push(f);
      if (f && f.chips) break;
      await new Promise(r => setTimeout(r, 200));
    }
    const lens = [...new Set(grew.map(f => f.chars).filter(Boolean))];
    ok('the answer reveals progressively', lens.length >= 4, `${lens.length} distinct lengths: ${lens.slice(0, 5).join(' → ')}…`);
    ok('the sources land last', grew.slice(0, -1).every(f => f.chips === 0), 'chips never appeared early');
    /* AT NO POINT, not just at the end. Dropping `cited` to hide the chips mid-reveal made every
       [[id]] in a partial frame render as the loud "unverified" warning — a false accusation, in
       red, for two seconds, on the one surface whose whole job is being trusted about citations.
       Sampling only the finished message would never have seen it. */
    const everBad = grew.filter(f => f.bad || f.warn).length;
    ok('no frame ever reads as unverified', everBad === 0, `${everBad} of ${grew.length} samples showed a warning`);

    await new Promise(r => setTimeout(r, 2200));
    const chat = await inner('ask-the-memo', `(d) => ({
      user: d.querySelectorAll('.chat-msg.user').length,
      bot: d.querySelectorAll('.chat-msg.bot').length,
      chips: d.querySelectorAll('.chat-chip').length,
      refs: d.querySelectorAll('.chat-ref').length,
      bad: d.querySelectorAll('.chat-bad').length,
      warn: d.querySelectorAll('.chat-warn').length,
      props: d.querySelectorAll('.chat-prop').length,
      box: (d.getElementById('chat-input') || {}).value || '',
    })`);
    ok('the question and the answer are both there', chat.user === 1 && chat.bot === 1, `${chat.user} asked · ${chat.bot} answered`);
    ok('the box clears when the question is sent', chat.box === '', JSON.stringify(chat.box.slice(0, 30)));
    ok('every claim carries a numbered reference', chat.refs >= 2 && chat.chips >= 2, `${chat.refs} refs · ${chat.chips} chips`);
    ok('NO unverified citation', chat.bad === 0 && chat.warn === 0, `${chat.bad} bad ids · ${chat.warn} warnings`);
    ok('it proposes rather than acts', chat.props === 1, `${chat.props} proposal cards`);

    await until(/the source it cited/);
    await new Promise(r => setTimeout(r, 2000));
    const opened = await inner('ask-the-memo', `(d) => { const h = d.querySelector('.m3-drill .mh-hero .headline-m'); return h ? h.textContent.trim() : ''; }`);
    ok('a citation opens the document it cites', /claims pressure test/i.test(opened), opened || 'nothing opened');
  },
};

const scripts = SCRIPT ? [SCRIPT] : Object.keys(CHECKS);
for (const name of scripts) {
  if (!CHECKS[name]) { ok(name, false, 'no checks defined for that script'); continue; }
  console.log(`\n── ${name}`);
  CUR = name;
  // On the workbench each choreography gets its own page load, so one long cycle never gates the
  // next. On the real page all three run where the visitor finds them.
  if (PROBE || SCRIPT) {
    await p.goto(`${HOST}/sites/_live-shot-probe.html?script=${name}`, { waitUntil: 'networkidle2' });
    await collect();
  }
  const up = fails.length;
  ok(`${name} mounts`, await mounted(name));
  const src = await p.evaluate(s => { const f = document.querySelector(`.shot[live="${s}"] iframe.shot-live`); return f ? f.getAttribute('src') : ''; }, name);
  ok(`${name} embeds its own page`, !!src && src.endsWith(PAGE_OF[name] || '\0'), src || 'no iframe');
  if (fails.length > up) continue;
  await CHECKS[name]();
}

// The poster handover, on the real page only: the still must give way to the frame.
if (!PROBE && !SCRIPT) {
  const poster = await p.evaluate(() => {
    const i = document.querySelector('.shot.is-live .shot-frame > img');
    return i ? getComputedStyle(i).opacity : null;
  });
  ok('the poster has faded out', poster === '0', `opacity ${poster}`);
}
ok('no page errors', errs.length === 0, errs.join(' | '));

await b.close();
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
