/* shot-live.js — A V-SHOT THAT IS THE PRODUCT, NOT A PICTURE OF IT.
 *
 * A <v-shot live="…"> embeds the real workspace at a fixed 1440×900, scales it to the frame, and
 * walks a pointer through it: tapping tabs, scrolling to what is below the fold, opening a document
 * and closing it again. The product has no idea it is being demonstrated — the pointer, the taps and
 * the scrolling all live out here, which is why this can never drift from what the product does.
 *
 * WHY A SCRIPT AND NOT CODE PER SHOT. Every section of the site wants to show a different part of
 * the product: the data room being scanned, the assistant answering, the memo being read. Those are
 * the same six verbs in a different order. A beat list keeps the choreography as data, so a new shot
 * is an entry in SCRIPTS rather than another copy of this file.
 *
 * THE BEATS
 *   {act:'tab',   name:'Research'}                 tap a top tab, matched on its first word
 *   {act:'reach', sel, prefer:[…], pad}            scroll until a chosen element sits comfortably in view
 *   {act:'tap',   sel?, prefer?, label?}           put the pointer on it and tap — no sel taps what 'reach' found
 *   {act:'read',  to:0.6, target:'main'|'drill'}   scroll a surface to a fraction of its range
 *   {act:'home',  target:'main'|'drill'}           glide it back to the top
 *   {act:'hold',  ms}                              let the viewer look at it
 *   {act:'type',  sel, text, cps}                 type into a real field, a character at a time
 *   {act:'point', sel, label}                     move the pointer onto something without tapping it
 *   {act:'await', sel, gone, ms}                   wait for something to appear — or to go away
 *   {act:'call',  fn, args}                       run a demo-only animation the page exposes
 * An unknown act is skipped with a warning rather than throwing: a shot is decoration, and a broken
 * beat must not take the page down with it.
 *
 * WHY 'call' EXISTS AND WHAT IT IS NOT. A data-room scan and a streaming answer are real product
 * states driven by a real API. A marketing page has no API and must not pretend to call one, so the
 * embedded page exposes the staged version under window.__demo and the shot asks for it by name.
 * The surfaces are the product's own components either way — what is faked is the server, and only
 * the server. The engine never learns what a data room is.
 */

/* ── the choreographies ──────────────────────────────────────────────────── */
const DEMO = '/ventrify-os/_redesign/m3/';

/* A choreography names the page it runs on. The alternative — the page in the markup and the beats
   in here — lets a shot be pointed at a page its beats know nothing about, which fails as an empty
   frame and a log full of "no tab". `live-src` on the element still overrides, for a one-off. */
export const SCRIPTS = {
  /* THE HERO. The whole product in one pass: the verdict, the score, the evidence under it, and —
     the part no still can reach — a research document opening three clicks deep and closing again.
     Measured at ~39s a cycle. Four of the seven tabs hold still: motion on all of them reads as a
     screensaver, and the eye stops believing any of it is real. */
  'assessment-tour': { page: DEMO + 'live-demo.html', beats: [
    { act: 'tab', name: 'Verdict' }, { act: 'read', to: .62 }, { act: 'hold' }, { act: 'home' },
    { act: 'tab', name: 'Investability' }, { act: 'hold', ms: 1800 },
    { act: 'tab', name: 'Market' }, { act: 'read', to: .58 }, { act: 'hold' }, { act: 'home' },
    { act: 'tab', name: 'Team' }, { act: 'hold', ms: 1800 },
    { act: 'tab', name: 'Diligence' }, { act: 'hold', ms: 1800 },
    { act: 'tab', name: 'Research' },
      /* Named, not "the first row": the index is grouped, so DOM order is not reading order, and
         the first match is usually one the scroll has already pushed off the top. */
      { act: 'reach', sel: '.tab-panel.active .mrow.research.drill',
        prefer: ['market sizing', 'competitive benchmark', 'claims'], ms: 2400 },
      { act: 'tap' },
      { act: 'read', target: 'drill', to: .45, ms: 2600 },
      { act: 'hold' },
      { act: 'tap', sel: '.m3-drill .drill-close', label: 'close' },
      { act: 'hold' },
      { act: 'home' },
    /* The tour ends on the Data room — the one tab a customer ACTS on — and it does not scroll,
       deliberately. It does show the same composed view as the still under "For founders": the
       product leaves a 377px void beside the coverage figure and puts the list it summarises just
       below the fold, so the tab would otherwise end the tour on a number with nothing under it. */
    { act: 'tab', name: 'Data' },
    { act: 'call', fn: 'liftRoomList' },
    { act: 'hold', ms: 2600 },
  ] },

  /* HOW IT WORKS — "from data room to a judgement you can inspect". The whole sentence, in order:
     the book, a new assessment set up from scratch, the data room read before a penny is spent, the
     run, and the verdict it produces.

     THE RUN IS COMPRESSED AND THE CLOCK IS NOT. A real assess run is eleven workstreams on a cloud
     runner and takes about two hours. The eleven steps here are the real ones — ASSESS_PLAN,
     transcribed from the orchestration prompt — played at about a second each, with the elapsed
     counter climbing at the REAL rate. That is the honest way round: the shot is short, and what it
     says about the product is true.

     Nothing else is a mock-up. The typing fires real input events so the product's own validators
     run, every button is the product's own, and the panels that fill in are roomScanBanner,
     roomCheck, assessingMemo and verdictMemo out of ds.js. What is staged is the server. */
  'full-run': { page: DEMO + 'live-demo-flow.html', beats: [
    { act: 'hold', ms: 2400 },
    { act: 'read', to: .45, ms: 3000 },                  // the whole book, and how it scores
    { act: 'hold', ms: 1600 },
    { act: 'home', ms: 1200 },
    { act: 'tap', sel: '.mh-actions .m3-btn', label: 'New assessment' },
    { act: 'await', sel: '#na-drive' },
    { act: 'hold', ms: 1400 },
    { act: 'reach', sel: '#na-name', pad: 300, ms: 1400 },
    { act: 'type', sel: '#na-name', text: 'Tideline', cps: 9, label: 'Venture name' },
    { act: 'call', fn: 'attachDeck' },                   // the deck is a hard gate on the run
    { act: 'hold', ms: 1000 },
    { act: 'reach', sel: '#na-drive', pad: 300, ms: 2000 },
    { act: 'type', text: 'https://drive.google.com/drive/folders/1kQ9xTideline-dataroom', cps: 30, label: 'Drive folder' },
    { act: 'hold', ms: 700 },
    /* THE READ IS PART OF THE RUN, because that is what the product does now. This used to tap
       `.na-drive-go` — a class NOTHING has ever rendered — then wait for a banner that could not
       appear, scroll to the top, and fall through to a restart. On the live site it read as "the shot
       scrolls back up instead of running the assessment", which is exactly what it was doing.
       shot-check caught it in one line: `!! nothing to tap for .na-drive-go`. */
    { act: 'reach', sel: '.m3-btn.filled.na-run', pad: 420, ms: 1800 },
    { act: 'tap', sel: '.m3-btn.filled.na-run', label: 'Run full assessment' },
    { act: 'await', sel: '.rsb' },                       // the banner is up: the read has started
    /* Back to the top to WATCH it. The aside is sticky, but at 900px its content is taller than the
       frame, so down by the Drive field the banner sits tucked under the masthead — measured at y=5.
       The counter is the best thing in this part and it was off-screen for all of it. */
    { act: 'home', ms: 1100 },
    { act: 'await', sel: '.rsb', gone: true },           // the read has finished; the workstreams start
    { act: 'await', sel: '.run-step' },
    { act: 'hold', ms: 2200 },
    { act: 'read', to: .42, ms: 3200 },                  // the eleven workstreams, ticking over
    { act: 'await', sel: '.m3-tab', ms: 30000 },         // tabs appear: the verdict has landed
    { act: 'home', ms: 900 },
    { act: 'hold', ms: 3200 },
    { act: 'read', to: .45, ms: 3000 },
    { act: 'hold', ms: 2600 },
    { act: 'call', fn: 'restart' },                      // the reload is the loop
  ] },

  /* THE OUTPUT — "more than a summary, a documented assessment". The argument is not "here is a
     document", it is "here is one you can interrogate and whose every claim goes back to a source".
     So: read the memo, ask the assistant the question an investor would actually ask, and then
     follow one of its citations into the research behind it.

     The answer is written down — the real one costs an API call. Everything around it is the
     product: the panel, the numbered references, the ⟨derived⟩ marker that separates a number the
     assistant worked out from one it quoted, the proposal card that can only ever PROPOSE, and the
     chip that opens the document it cited. */
  'ask-the-memo': { page: DEMO + 'live-demo.html', beats: [
    { act: 'tab', name: 'Verdict' },
    { act: 'read', to: .32, ms: 2600 },
    { act: 'hold', ms: 1200 },
    { act: 'home' },
    { act: 'tap', sel: '[data-panel="assist"]', label: 'Assistant' },
    { act: 'await', sel: '#chat-input' },
    /* The empty state is worth two seconds on its own: "I can only see this assessment — I have not
       read the founder's own documents, and I have no web access." */
    { act: 'hold', ms: 2600 },
    { act: 'type', sel: '#chat-input', text: 'What is the single biggest risk to this score?', cps: 22, label: 'the question' },
    { act: 'hold', ms: 600 },
    { act: 'tap', sel: '#chat-send', label: 'Send' },
    { act: 'await', sel: '.chat-chip', ms: 9000 },
    { act: 'hold', ms: 4200 },
    { act: 'tap', sel: '.chat-chip', label: 'the source it cited' },
    { act: 'await', sel: '.m3-drill .drill-scroll' },
    { act: 'read', target: 'drill', to: .35, ms: 2400 },
    { act: 'hold', ms: 1600 },
    { act: 'tap', sel: '.m3-drill .drill-close', label: 'close' },
    { act: 'hold', ms: 1200 },
    { act: 'call', fn: 'resetChat' },
  ] },
};

/* ── the engine ──────────────────────────────────────────────────────────── */

const FRAME_W = 1440, FRAME_H = 900;
const DEFAULTS = { hold: 1100, read: 3000, reach: 2400, home: 1400, pad: 360 };

const wait = ms => new Promise(r => setTimeout(r, ms));

/* OUR OWN SCROLL, NOT behavior:'smooth'. The native smooth scroll runs for a duration the browser
   picks — around 500ms whatever the distance — so a 1,300px travel goes past far too fast to read,
   and there is no property to slow it down. Per frame, we own the duration. */
const glide = (el, to, ms) => new Promise(res => {
  const from = el.scrollTop, d = to - from, t0 = performance.now();
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOutQuad
  if (!d) return res();
  const step = now => {
    const t = Math.min(1, (now - t0) / ms);
    el.scrollTop = from + d * ease(t);
    t < 1 ? requestAnimationFrame(step) : res();
  };
  requestAnimationFrame(step);
});

const CURSOR = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">' +
  '<path d="M3 1.5 L3 17 L7.2 13.2 L10 19.5 L12.6 18.3 L9.9 12.2 L15.5 12.1 Z" ' +
  'fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="1" stroke-linejoin="round"/></svg>';

export function mountLiveShot(frame, { src, script, onLog } = {}) {
  const def = SCRIPTS[script];
  const beats = def && def.beats;
  const page = src || (def && def.page);
  if (!frame || !page || !beats) return null;

  const iframe = document.createElement('iframe');
  iframe.className = 'shot-live';
  iframe.src = page;
  iframe.title = 'A VerdictScore assessment, running';
  /* Decoration, and a keyboard user must never fall into it: there is nothing in there for them,
     and everything in there is fictional. The accessible description stays on the <v-shot>. */
  iframe.setAttribute('tabindex', '-1');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('loading', 'lazy');

  const cur = document.createElement('span');
  cur.className = 'shot-cur';
  cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = CURSOR;

  frame.appendChild(iframe);
  frame.appendChild(cur);

  let scale = 1;
  const fit = () => {
    scale = frame.clientWidth / FRAME_W;
    iframe.style.transform = `scale(${scale})`;
  };
  fit();
  new ResizeObserver(fit).observe(frame);

  /* PAUSE WHEN NOBODY IS LOOKING. A 39-second loop running in a background tab, or three sections
     further up the page, is somebody's battery for nothing. */
  let awake = true;
  new IntersectionObserver(es => { awake = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(frame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) awake = false; });
  const breathe = async () => { while (!awake || document.hidden) await wait(400); };

  /* Every beat announces itself on the host as a `shot-beat` event. The probe page prints them;
     shot-check.mjs reads them to know where in the cycle it is. A shot that only talks to a
     console cannot be checked, and an unchecked shot is how both of its first two bugs shipped. */
  const say = s => {
    frame.dispatchEvent(new CustomEvent('shot-beat', { detail: s, bubbles: true }));
    if (onLog) onLog(s);
  };

  /* RESTART ON EVERY LOAD, not just the first. A choreography that walks a whole flow ends by
     reloading the frame rather than unwinding four views by hand — so the reload IS the loop. The
     generation counter is what stops the previous run's beats carrying on against a dead document:
     an await in flight when the page goes resolves into a loop that checks `mine` and exits. */
  let gen = 0;
  iframe.addEventListener('load', async () => {
    const mine = ++gen;
    const d = iframe.contentDocument, w = iframe.contentWindow;
    if (!d) return;

    /* A 404 FIRES `load` TOO. The browser loaded a document — it just happens to be an error page —
       so `load` alone is not evidence the demo is there. `is-running` fades the poster out, and the
       marketing site and the product deploy as SEPARATE sites: if the proxy that serves
       /ventrify-os/ is ever removed or misrouted, the poster would dissolve to reveal a 404 in the
       hero. Wait for the shell the demo actually mounts; without it, keep the still and say so.
       The still is a true picture of the product, so holding it is a complete fallback, not a
       degraded one — the same reason --prog falls back to 1 rather than 0. */
    const mounted = await (async () => {
      for (let i = 0; i < 40; i++) {                       // ~4s: boot() mounts async
        if (mine !== gen) return false;
        if (d.querySelector('.shell-main')) return true;
        await wait(100);
      }
      return false;
    })();
    if (!mounted) return say('!! frame never mounted the demo — poster kept');
    if (mine !== gen) return;
    frame.classList.add('is-running');

    const main = () => d.querySelector('.shell-main');
    const drill = () => d.querySelector('.m3-drill .drill-scroll');
    const surface = t => (t === 'drill' ? drill() : main());

    /* Put the pointer on something INSIDE the frame. The frame is scaled, so a rect read in frame
       coordinates is multiplied by that scale to land in page space. A target that has scrolled out
       of view would place the pointer where the viewer can see nothing happen — the shot records
       what it aimed at so a check can catch exactly that, rather than it passing unnoticed. */
    const moveTo = (el, what) => {
      const r = el.getBoundingClientRect();
      const x = (r.left + r.width / 2) * scale, y = (r.top + r.height * 0.62) * scale;
      cur.classList.add('is-on');
      cur.style.transform = `translate(${x}px, ${y}px)`;
      w.__shot = {
        what: what || '', x: Math.round(x), y: Math.round(y),
        box: { x0: Math.round(r.left * scale), x1: Math.round(r.right * scale),
               y0: Math.round(r.top * scale), y1: Math.round(r.bottom * scale) },
        inFrame: r.top > 0 && r.bottom < w.innerHeight,
      };
    };
    const tapEl = async el => {
      cur.classList.add('is-tap'); await wait(170);
      el.click();
      cur.classList.remove('is-tap');
    };

    /* Ordered preference, not "the first match". The research index is grouped, so the first row in
       DOM order belongs to whichever group sorts first — not the document worth showing. */
    /* What to CALL a thing in the log. Material Symbols renders its icons as ligature TEXT, so a
       button's textContent is "boltRun pre-screen first" and a form field's is "". Neither is a
       name. Strip the icon spans, fall back to the field's own label, then to the selector. */
    const labelOf = (el, sel) => {
      const nm = el.querySelector('.mrow-nm');
      const src = nm || el.cloneNode(true);
      if (!nm) src.querySelectorAll && src.querySelectorAll('.material-symbols-rounded').forEach(i => i.remove());
      const t = (src.textContent || '').trim();
      return t ? t.slice(0, 44)
        : (el.getAttribute('aria-label') || el.getAttribute('placeholder') || sel || 'target');
    };

    const pick = (sel, prefer) => {
      const all = [...d.querySelectorAll(sel)];
      if (prefer) for (const p of prefer) {
        const re = p instanceof RegExp ? p : new RegExp(p, 'i');
        const hit = all.find(el => re.test(el.textContent));
        if (hit) return hit;
      }
      return all[0] || null;
    };

    /* SCROLL TO THE THING, not to a percentage. Scrolling blind and then taking a match is how a
       pointer comes to tap a row that has already left the viewport. Given a destination, where the
       pointer goes and what is on screen cannot disagree. */
    const reach = async (el, ms, pad) => {
      const sc = main(); if (!sc) return;
      const m = sc.getBoundingClientRect(), max = sc.scrollHeight - sc.clientHeight;
      const to = Math.max(0, Math.min(max, sc.scrollTop + (el.getBoundingClientRect().top - m.top) - pad));
      await glide(sc, to, ms);
    };

    let found = null;
    const run = async beat => {
      const ms = beat.ms;
      switch (beat.act) {
        case 'tab': {
          const re = new RegExp('^' + beat.name, 'i');
          const t = [...d.querySelectorAll('.m3-tab')].find(x => re.test(x.textContent.trim()));
          if (!t) return say(`!! no tab "${beat.name}"`);
          moveTo(t, beat.name); say(`→ ${beat.name}`);
          await wait(640); await tapEl(t); say(`↓ ${beat.name}`); await wait(900);
          return;
        }
        case 'reach': {
          found = pick(beat.sel, beat.prefer);
          if (!found) return say(`!! nothing matches ${beat.sel}`);
          say(`↓ scrolling to “${labelOf(found, beat.sel)}”`);
          await reach(found, ms || DEFAULTS.reach, beat.pad || DEFAULTS.pad);
          await wait(500);
          return;
        }
        case 'tap': {
          const el = beat.sel ? pick(beat.sel, beat.prefer) : found;
          if (!el) return say(`!! nothing to tap${beat.sel ? ' for ' + beat.sel : ''}`);
          const nm = beat.label || labelOf(el, beat.sel);
          moveTo(el, nm); await wait(800);
          await tapEl(el); say(`↳ ${nm}`);
          await wait(1100);
          return;
        }
        case 'read': {
          const sc = surface(beat.target);
          if (!sc) return say(`!! no ${beat.target || 'main'} surface`);
          const to = Math.round((sc.scrollHeight - sc.clientHeight) * (beat.to ?? .5));
          await glide(sc, to, ms || DEFAULTS.read);
          return;
        }
        case 'home': {
          const sc = surface(beat.target);
          if (sc) await glide(sc, 0, ms || DEFAULTS.home);
          return;
        }
        case 'type': {
          const el = beat.sel ? pick(beat.sel, beat.prefer) : found;
          if (!el) return say(`!! nothing to type into for ${beat.sel}`);
          moveTo(el, beat.label || 'field'); await wait(620);
          await tapEl(el);
          el.focus({ preventScroll: true });
          // A character at a time, with the events a real keystroke fires: the product's own
          // listeners enable the button, validate the URL and update the aside. Setting .value in
          // one go would skip all of it and the screen would sit there looking broken.
          const cps = beat.cps || 26, text = beat.text || '';
          el.value = '';
          for (const ch of text) {
            el.value += ch;
            el.dispatchEvent(new w.Event('input', { bubbles: true }));
            await wait(1000 / cps);
          }
          el.dispatchEvent(new w.Event('change', { bubbles: true }));
          say(`⌨ ${text.slice(0, 48)}`);
          await wait(500);
          return;
        }
        case 'point': {
          const el = beat.sel ? pick(beat.sel, beat.prefer) : found;
          if (!el) return say(`!! nothing to point at for ${beat.sel}`);
          moveTo(el, beat.label || 'target');
          return wait(ms || 700);
        }
        /* `gone` as well as `arrived`, because the thing worth waiting for is often the end of
           something: a scan banner that clears when the read finishes says "done" more reliably
           than a hold timed to how long the read happened to take the day it was written. */
        case 'await': {
          const t0 = Date.now(), limit = ms || 12000;
          while (Date.now() - t0 < limit) {
            const there = !!d.querySelector(beat.sel);
            if (beat.gone ? !there : there) return wait(300);
            await wait(80);
          }
          return say(`!! ${beat.sel} never ${beat.gone ? 'went away' : 'appeared'}`);
        }
        case 'call': {
          const demo = w.__demo || {};
          if (typeof demo[beat.fn] !== 'function') return say(`!! the page exposes no __demo.${beat.fn}`);
          say(`▸ ${beat.fn}`);
          await demo[beat.fn].apply(null, beat.args || []);
          return;
        }
        case 'hold': return wait(ms || DEFAULTS.hold);
        default: return say(`!! unknown beat "${beat.act}"`);
      }
    };

    for (;;) {
      for (const beat of beats) {
        if (mine !== gen) return;                 // the page reloaded; this run is over
        await breathe();
        try { await run(beat); } catch (e) { say(`!! ${beat.act} failed: ${e.message}`); }
      }
    }
  });

  return iframe;
}
