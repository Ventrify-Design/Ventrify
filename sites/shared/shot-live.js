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
 * An unknown act is skipped with a warning rather than throwing: a shot is decoration, and a broken
 * beat must not take the page down with it.
 */

/* ── the choreographies ──────────────────────────────────────────────────── */
export const SCRIPTS = {
  /* THE HERO. The whole product in one pass: the verdict, the score, the evidence under it, and —
     the part no still can reach — a research document opening three clicks deep and closing again.
     Measured at ~39s a cycle. Four of the seven tabs hold still: motion on all of them reads as a
     screensaver, and the eye stops believing any of it is real. */
  'assessment-tour': [
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
    { act: 'tab', name: 'Data' }, { act: 'hold', ms: 1800 },
  ],
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
  const beats = SCRIPTS[script];
  if (!frame || !src || !beats) return null;

  const iframe = document.createElement('iframe');
  iframe.className = 'shot-live';
  iframe.src = src;
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

  iframe.addEventListener('load', async () => {
    const d = iframe.contentDocument, w = iframe.contentWindow;
    if (!d) return;
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
          const nm = (found.querySelector('.mrow-nm') || found).textContent.trim().slice(0, 40);
          say(`↓ scrolling to “${nm}”`);
          await reach(found, ms || DEFAULTS.reach, beat.pad || DEFAULTS.pad);
          await wait(500);
          return;
        }
        case 'tap': {
          const el = beat.sel ? pick(beat.sel, beat.prefer) : found;
          if (!el) return say(`!! nothing to tap${beat.sel ? ' for ' + beat.sel : ''}`);
          const nm = beat.label || (el.querySelector('.mrow-nm') || el).textContent.trim().slice(0, 40);
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
        case 'hold': return wait(ms || DEFAULTS.hold);
        default: return say(`!! unknown beat "${beat.act}"`);
      }
    };

    for (;;) {
      for (const beat of beats) {
        await breathe();
        try { await run(beat); } catch (e) { say(`!! ${beat.act} failed: ${e.message}`); }
      }
    }
  }, { once: true });

  return iframe;
}
