/* ─────────────────────────────────────────────────────────────────────────────
   VENTRIFY — MOTION ENGINE v2

   One rAF loop, one IntersectionObserver, one resize handler for the whole page.

   What changed from v1, and why:
   • SMOOTHING. v1 mapped scroll position straight to translation, so every
     layer stopped dead the instant the wheel stopped. Each layer now eases
     toward its target, which is the difference between "things are moving"
     and "the page has depth".
   • MEDIA PARALLAX. The strongest depth cue available is an image moving
     slower than the frame that crops it. Every placeholder now does this.
   • LINE REVEAL. Headlines resolve line by line instead of as one block.
   • SECTION PROGRESS. Every section publishes its own 0→1 scroll progress as
     a CSS variable, so anything can be driven by it without more JS.
   • SEQUENCES. Numbered steps light up as the reader reaches them.
   • VELOCITY. Fast scrolling adds a little extra lead to the layers, which is
     what makes the drift feel like momentum rather than a lookup table.

   Rules kept: only transform and opacity are animated, the loop never reads
   layout, and `prefers-reduced-motion` disables all of it with everything
   visible in its final state.
   ───────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── TUNING ───────────────────────────────────────────────────────────────
     Every number the motion system uses, in one place. These were scattered
     through the loop as literals, which meant "make the parallax calmer" was
     an archaeology exercise. Change them here and all three sites follow. */
  var CFG = {
    /* A NEGATIVE bottom margin shrinks the observer box, so '-12%' waited
       until an element was already 108px inside the viewport before starting
       a 550ms animation — the reader met it half-faded. Positive margin fires
       it just before it scrolls into view, so it arrives resolved. */
    revealMargin:  '0px 0px 10% 0px',
    revealRatio:   0.01,
    staggerStep:   80,                  // ms between siblings
    staggerTotal:  240,                 // ms a WHOLE group may take, see stagger()
    lineStep:      85,                  // ms between split-headline lines

    /* Travel measured over a layer's full viewport transit. At 220/-150 the
       photography moved 25–41px and the inner media 19–37px — under 2px per
       100px scrolled, which is below the threshold of being noticed at all.
       The decorative discs were meanwhile buying 270px of travel at 10%
       opacity, so the depth budget was being spent where nobody could see it. */
    parallaxRange: 340,                 // px of travel at speed 1.0
    driftRange:   -400,
    mediaRange:   -380,                 // inner-media counter-move
    ease:          0.13,                // lerp factor — lower is smoother/laggier
    easeHero:      0.16,
    easeDrift:     0.12,
    easeMedia:     0.14,
    velocityEase:  0.2,
    leadMax:       90,                  // px of momentum overshoot
    leadFactor:    0.9,
    cullAt:        1.3,                 // skip layers this far outside the viewport
    settleFrames:  20,                  // frames of stillness before the loop stops
    heroFade:      1.15,                // how fast the hero dissolves

    seqTrigger:    0.62,                // viewport fraction where a step activates
    tiltDeg:       7,
    countMs:       1100,
    resizeDebounce: 160
  };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  function showEverything() {
    document.querySelectorAll('[data-reveal], [data-split]').forEach(function (el) {
      el.classList.add('is-in');
    });
    document.querySelectorAll('[data-seq] > *').forEach(function (el) { el.classList.add('is-active'); });
  }

  /* ── Split headlines into lines ──────────────────────────────────────────
     Words are wrapped first, then grouped by their rendered offsetTop, which
     is the only reliable way to know where the browser actually broke the
     line. Re-run on resize because the break points move. */

  function splitLines(el) {
    if (!el.__words) {
      el.__words = el.textContent.trim().split(/\s+/);
      el.setAttribute('aria-label', el.textContent.trim());
    }
    el.innerHTML = el.__words.map(function (w) {
      return '<span class="w" aria-hidden="true">' + w + '</span>';
    }).join(' ');

    var words = [].slice.call(el.querySelectorAll('.w'));
    var lines = [], currentTop = null, bucket = null;
    words.forEach(function (w) {
      var top = Math.round(w.offsetTop);
      if (currentTop === null || Math.abs(top - currentTop) > 4) {
        bucket = []; lines.push(bucket); currentTop = top;
      }
      bucket.push(w);
    });

    el.innerHTML = '';
    lines.forEach(function (line, i) {
      var outer = document.createElement('span');
      outer.className = 'ln';
      outer.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span');
      inner.className = 'ln-i';
      inner.style.setProperty('--d', (i * CFG.lineStep) + 'ms');
      inner.textContent = line.map(function (w) { return w.textContent; }).join(' ');
      outer.appendChild(inner);
      el.appendChild(outer);
    });
  }

  function initSplit() {
    var heads = document.querySelectorAll('[data-split]');
    if (!heads.length) return;
    if (reduced.matches) { heads.forEach(function (h) { h.classList.add('is-in'); }); return; }
    heads.forEach(function (h) {
      // splitLines rebuilds the heading from textContent, which would silently
      // destroy any inline markup inside it — a <span class="hl"> would come
      // back as plain text with the emphasis gone. Refuse rather than damage.
      if (h.querySelector('*') && !h.querySelector('.ln')) {
        h.classList.add('is-in');
        return;
      }
      splitLines(h);
    });
    return heads;
  }

  /* ── Reveal ─────────────────────────────────────────────────────────────── */

  /* A fixed per-sibling step is fine for three cards and wrong for seven: an
     `.of-7` step list reached 480ms of delay on its last item, so the reader
     had scrolled past before it began. Cap the TOTAL the group may take and
     let the step shrink to fit. */
  function stagger(group, step) {
    var kids = group.querySelectorAll(':scope > [data-reveal], :scope > [data-split]');
    var n = kids.length;
    var s = n > 1 ? Math.min(step, CFG.staggerTotal / (n - 1)) : 0;
    kids.forEach(function (kid, i) {
      kid.style.setProperty('--d', Math.round(i * s) + 'ms');
    });
  }

  function initReveal() {
    if (reduced.matches || !('IntersectionObserver' in window)) { showEverything(); return; }

    // Explicit groups first.
    document.querySelectorAll('[data-stagger]').forEach(function (group) {
      stagger(group, parseInt(group.getAttribute('data-stagger'), 10) || CFG.staggerStep);
    });

    // Then AUTOMATIC staggering. Any parent holding two or more revealing
    // children gets its children offset in sequence. This used to be 36 inline
    // `--d` values hand-written across five files — every one a number nobody
    // could retune centrally, and every new section a chance to forget. The
    // rule is now derived from the markup instead of restated in it.
    var seen = new Set();
    document.querySelectorAll('[data-reveal]').forEach(function (node) {
      var parent = node.parentElement;
      if (!parent || seen.has(parent) || parent.hasAttribute('data-stagger')) return;
      seen.add(parent);
      if (parent.querySelectorAll(':scope > [data-reveal], :scope > [data-split]').length > 1) {
        stagger(parent, CFG.staggerStep);
      }
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: CFG.revealMargin, threshold: CFG.revealRatio });

    document.querySelectorAll('[data-reveal], [data-split]').forEach(function (el) {
      // Anything ALREADY scrolled past is shown at once, with no animation.
      // An IntersectionObserver never fires for content above the viewport, so
      // landing on a deep link (/page/#pricing) would otherwise leave every
      // section above the anchor permanently blank.
      if (el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); return; }
      io.observe(el);
    });
  }

  /* ── Scroll-driven layers ───────────────────────────────────────────────── */

  var layers = [];      // parallax, hero, drift, media
  var sections = [];    // publish --prog
  var seqs = [];        // stepped sequences
  var running = false, lastY = -1, velocity = 0, settleFrames = 0;

  function measure() {
    var y = window.pageYOffset;
    layers = []; sections = []; seqs = [];

    function push(el, kind, speedAttr, dflt) {
      var r = el.getBoundingClientRect();
      layers.push({
        el: el, kind: kind,
        speed: parseFloat(el.getAttribute(speedAttr)) || dflt,
        rotate: parseFloat(el.getAttribute('data-rotate')) || 0,
        top: r.top + y, height: r.height || 1,
        /* The section this layer lives in — the hero fade paces itself
           against the thing being scrolled past, not against itself. */
        section: el.closest('section'),
        cur: 0, curR: 0
      });
    }

    document.querySelectorAll('[data-parallax]').forEach(function (el) { push(el, 'parallax', 'data-parallax', 0.15); });
    document.querySelectorAll('[data-hero-fade]').forEach(function (el) { push(el, 'hero', 'data-hero-fade', 0.22); });
    document.querySelectorAll('[data-drift]').forEach(function (el) { push(el, 'drift', 'data-drift', 0.08); });
    // Every placeholder gets inner-media parallax unless it opts out.
    document.querySelectorAll('.ph:not([data-no-media])').forEach(function (el) { push(el, 'media', 'data-media', 0.1); });

    document.querySelectorAll('section').forEach(function (el) {
      var r = el.getBoundingClientRect();
      sections.push({ el: el, top: r.top + y, height: r.height || 1 });
    });

    document.querySelectorAll('[data-seq]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      seqs.push({ el: el, items: [].slice.call(el.children), top: r.top + y, height: r.height || 1, last: -1 });
    });
  }

  function frame() {
    var y  = window.pageYOffset;
    var vh = window.innerHeight;

    if (lastY < 0) lastY = y;
    var delta = y - lastY;
    velocity = lerp(velocity, delta, CFG.velocityEase);
    lastY = y;

    // Section progress: 0 as the section's top reaches the bottom of the
    // viewport, 1 as its bottom leaves the top.
    for (var s = 0; s < sections.length; s++) {
      var S = sections[s];
      var prog = clamp((y + vh - S.top) / (S.height + vh), 0, 1);
      S.el.style.setProperty('--prog', prog.toFixed(4));
    }

    // Stepped sequences
    for (var q = 0; q < seqs.length; q++) {
      var Q = seqs[q];
      var p = clamp((y + vh * CFG.seqTrigger - Q.top) / Q.height, 0, 1);
      var idx = Math.min(Q.items.length - 1, Math.floor(p * Q.items.length));
      if (idx !== Q.last && p > 0) {
        for (var k = 0; k < Q.items.length; k++) Q.items[k].classList.toggle('is-active', k <= idx);
        Q.last = idx;
      }
    }

    var moving = Math.abs(velocity) > 0.05;
    var unsettled = false;
    var lead = clamp(velocity * CFG.leadFactor, -CFG.leadMax, CFG.leadMax);   // momentum overshoot

    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];

      if (L.kind === 'hero') {
        /* Divide by the HERO SECTION, not by the copy block inside it.
           L.height is the .split (416–477px), so a 900px-tall hero reached
           opacity 0 after 375px of scroll with 333px of headline, lede and
           both buttons still on screen — invisible but still focusable.
           The section is the thing being left, so it sets the pace. */
        var hRef = (L.section && L.section.offsetHeight) || vh;
        var hp = clamp((y / hRef) * CFG.heroFade, 0, 1);
        var hTarget = y * L.speed;
        L.cur = lerp(L.cur, hTarget, CFG.easeHero);
        /* Clamp the drift too: unclamped it reached translateY(1525px) at the
           foot of VentureStack, holding a promoted layer that is recomputed
           every frame for the whole page. */
        if (L.cur > hRef) L.cur = hRef;
        L.el.style.setProperty('--py', L.cur.toFixed(2) + 'px');
        L.el.style.setProperty('--po', (1 - hp).toFixed(3));
        L.el.style.visibility = hp >= 1 ? 'hidden' : '';   // also drops it from the tab order
        if (Math.abs(L.cur - hTarget) > 0.3) unsettled = true;
        continue;
      }

      var centre = L.top + L.height / 2;
      var travel = (y + vh / 2 - centre) / (vh + L.height);
      if (travel < -CFG.cullAt || travel > CFG.cullAt) continue;

      var target;
      if (L.kind === 'drift') {
        target = travel * L.speed * CFG.driftRange + lead * 0.6;
        L.cur = lerp(L.cur, target, CFG.easeDrift);
        L.el.style.setProperty('--px', L.cur.toFixed(2) + 'px');
      } else if (L.kind === 'media') {
        // The frame is clipped; the surface inside it moves the other way and
        // slower, so the crop reveals different parts of it as you pass.
        target = travel * L.speed * CFG.mediaRange;
        L.cur = lerp(L.cur, target, CFG.easeMedia);
        L.el.style.setProperty('--my', L.cur.toFixed(2) + 'px');
      } else {
        target = travel * L.speed * CFG.parallaxRange + lead;
        L.cur = lerp(L.cur, target, CFG.ease);
        L.el.style.setProperty('--py', L.cur.toFixed(2) + 'px');
        if (L.rotate) {
          L.curR = lerp(L.curR, travel * L.rotate, CFG.easeDrift);
          L.el.style.setProperty('--pr', L.curR.toFixed(3) + 'deg');
        }
      }
      if (Math.abs(L.cur - target) > 0.3) unsettled = true;
    }

    // Keep the loop alive while anything is still easing, then stop entirely.
    if (moving || unsettled) { settleFrames = 0; }
    else { settleFrames++; }

    if (settleFrames < CFG.settleFrames) { requestAnimationFrame(frame); }
    else { running = false; }
  }

  function kick() {
    if (running || reduced.matches) return;
    running = true; settleFrames = 0;
    requestAnimationFrame(frame);
  }

  /* ── Pointer tilt ────────────────────────────────────────────────────────
     Desktop only, and deliberately tiny. Enough that a card feels like a
     physical surface under the cursor; not enough to notice as an effect. */

  function initTilt() {
    if (reduced.matches || !finePointer.matches) return;
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--tx', (px * CFG.tiltDeg).toFixed(2) + 'deg');
        el.style.setProperty('--ty', (-py * CFG.tiltDeg).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--tx', '0deg');
        el.style.setProperty('--ty', '0deg');
      });
    });
  }

  /* ── Header, menu, spy, count-up ─────────────────────────────────────────── */

  function initHeader() {
    var head = document.querySelector('.site-head');
    if (!head || !('IntersectionObserver' in window)) return;
    var mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    mark.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none;';
    document.body.prepend(mark);
    new IntersectionObserver(function (e) {
      head.classList.toggle('is-stuck', !e[0].isIntersecting);
    }, { threshold: 0 }).observe(mark);
  }

  function initMenu() {
    var burger = document.querySelector('.burger');
    var menu   = document.querySelector('.mobile-menu');
    if (!burger || !menu) return;
    function setOpen(open) {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () {
      setOpen(!document.body.classList.contains('menu-open'));
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setOpen(false);
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) {
      if (m.matches) setOpen(false);
    });
  }

  function initScrollSpy() {
    var links = [].slice.call(document.querySelectorAll('.navlinks a[href*="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var h = a.getAttribute('href'), i = h.indexOf('#');
      if (i < 0) return;
      var sec = document.getElementById(h.slice(i + 1));
      if (sec) map[sec.id] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        if (map[en.target.id]) map[en.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { spy.observe(document.getElementById(id)); });
  }

  function initCountUp() {
    var els = document.querySelectorAll('[data-countup]');
    if (!els.length) return;
    if (reduced.matches || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute('data-countup'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, target = parseFloat(el.getAttribute('data-countup')) || 0, t0 = null;
        (function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min(1, (ts - t0) / CFG.countMs);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        })(performance.now());
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { el.textContent = '0'; io.observe(el); });
  }

  /* ── Boot ────────────────────────────────────────────────────────────────
     Components render themselves via customElements, which happens before
     DOMContentLoaded for upgrade-on-parse, but measurement must come after so
     the nav and footer are already in the layout. */

  function boot() {
    document.documentElement.classList.remove('no-js');

    if (reduced.matches) { showEverything(); }

    initHeader();
    initMenu();
    initSplit();
    initReveal();
    initScrollSpy();
    initCountUp();
    initTilt();

    if (!reduced.matches) {
      measure();
      lastY = window.pageYOffset;
      kick();
      window.addEventListener('scroll', kick, { passive: true });
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (reduced.matches) return;
        document.querySelectorAll('[data-split]').forEach(function (h) {
          var wasIn = h.classList.contains('is-in');
          splitLines(h);
          if (wasIn) h.classList.add('is-in');
        });
        measure(); kick();
      }, CFG.resizeDebounce);
    }, { passive: true });

    window.addEventListener('load', function () { if (!reduced.matches) { measure(); kick(); } });

    /* RE-MEASURE WHEN THE DOCUMENT CHANGES HEIGHT, not only when the window does.
       measure() caches every section's page offset once at boot. The product shots are
       `loading="lazy"` and carry no width/height, so the browser reserves nothing for them and the
       page grows by thousands of pixels as they arrive — after boot, and after `load`, because a
       lazy image below the fold does not block it. Every cached offset is then wrong, and --prog
       reported 0.94 for a section that had not reached the viewport.

       That broke more than the score arc: --prog drives the depth bloom, and the same stale
       offsets feed the parallax layers. Watching the height catches it whatever the cause — lazy
       images, a late font, an expanded FAQ — rather than fixing the one cause we happened to find.
       Debounced on the same timer as resize, and skipped under reduced motion where none of this
       layer runs. */
    if (window.ResizeObserver) {
      var lastH = 0, ht;
      new ResizeObserver(function () {
        var h = document.documentElement.scrollHeight;
        if (h === lastH || reduced.matches) return;
        lastH = h;
        clearTimeout(ht);
        ht = setTimeout(function () { measure(); kick(); }, CFG.resizeDebounce);
      }).observe(document.documentElement);
    }

    reduced.addEventListener('change', function (m) {
      if (m.matches) { showEverything(); } else { measure(); kick(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
