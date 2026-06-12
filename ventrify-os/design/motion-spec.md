# Ventrify Workspace — Motion Spec v1

> The motion layer for the Operator Workspace. Premium B2B console (peers: Linear, Stripe, Vercel, Notion). Motion here is **purposeful and restrained** — it guides attention and gives feedback, never decorative excess. A console is a tool people live in eight hours a day; motion that delights once becomes friction the hundredth time. Every value below earns its place by reducing perceived latency, confirming a state change, or directing the eye to the one thing that changed.
>
> This spec is normative and extends the DS §Motion tokens. It introduces **zero new easings** and **zero new durations** — it composes the five existing motion tokens into named patterns. Drop-in CSS; one tiny JS helper for count-up.

---

## 0. Token reference (from `shared/ds.css` — do not redeclare)

```css
/* Already in the DS :root — repeated here for reading only */
--ease:     cubic-bezier(0.34, 1.56, 0.64, 1);  /* SPRING — selection, entry, lift     */
--ease-out: cubic-bezier(0.6, 0.6, 0, 1);        /* STANDARD — hover, fades, bars, exit  */
--dur-fast: 0.15s;   /* press, micro-feedback        */
--dur-base: 0.25s;   /* hover, colour, fade, entry   */
--dur-slow: 0.6s;    /* progress bars, count-up      */
```

**Spring vs standard — the one rule.** Use `--ease` (spring overshoot) only where something *arrives* or is *selected* — entrances, the active-nav indicator, the card lift settling, modal rise. Use `--ease-out` for everything that *recedes, fades, or fills* — hover colour, bar fills, exits, underline slides. The spring's overshoot reads as "this snapped into place"; on a fill or a fade it reads as a glitch. Never put spring on a colour transition.

**Animated properties — the hard rule.** `transform` and `opacity` ONLY. Never `all`. Never `width/height/top/left/margin` (layout thrash + jank). Progress bars animate `transform: scaleX()`, not `width`. The active-nav bar animates `transform: scaleY()`, not `height`.

---

## 1. Global motion guard (paste once, near top of shell CSS)

Everything decorative is opt-in behind `no-preference`. Under `reduce`, motion collapses to instant state changes — but **feedback never disappears** (focus rings, colour changes, final values all remain; only the *travel* is removed).

```css
/* Default: assume reduced until proven otherwise — entrances start hidden
   ONLY when motion is allowed, so reduced-motion users never see a blank flash. */
@media (prefers-reduced-motion: no-preference) {
  /* entrance patterns get their start-state here (see §3) */
  [data-anim] { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  /* Kill all travel. Keep colour/opacity end-states. */
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  [data-anim] { opacity: 1 !important; transform: none !important; }
  .is-running .banner-pulse { animation: none !important; }
}
```

> Note the inversion: entrance start-states (`opacity:0`) live **inside** `no-preference`. If JS or CSS fails or the user prefers reduced motion, content is visible by default. We never gate content visibility on an animation completing.

---

## 2. Shell — sidebar nav, active indicator, topbar entrance

### 2a. Sidebar nav item — hover

Trigger: pointer hover on a `.nav-item`. Animate: `background` colour + label `color` (both cheap, non-layout) on `--dur-base / --ease-out`. The icon nudges 1px via `transform` to signal interactivity without moving the row.

```css
.nav-item {
  position: relative;
  display: flex; align-items: center; gap: var(--space-3);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  transition:
    background var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out);
}
.nav-item:hover { background: var(--surface-alt); color: var(--text); }
.nav-item .nav-icon {
  transition: transform var(--dur-base) var(--ease-out);
}
.nav-item:hover .nav-icon { transform: translateX(1px); }
```

### 2b. Sidebar nav — active left-indicator bar (signature shell moment)

Trigger: `.nav-item.active` (route match). The indicator is a single 3px rail pinned to the item's left edge. On activation it **grows from the centre outward** via `scaleY(0) → scaleY(1)` with the spring — so it overshoots a hair and settles, reading as "you are *here*." Because every nav item owns its own `::before`, switching routes reads as the old bar collapsing and the new one springing in (no shared-element tracking needed — keeps it dependency-free).

```css
.nav-item::before {
  content: '';
  position: absolute; left: 0; top: 8px; bottom: 8px;
  width: 3px; border-radius: 2px;
  background: var(--primary);
  transform: scaleY(0);
  transform-origin: center;
  opacity: 0;
  transition:
    transform var(--dur-base) var(--ease),     /* SPRING grow      */
    opacity var(--dur-fast) var(--ease-out);
}
.nav-item.active::before { transform: scaleY(1); opacity: 1; }
.nav-item.active { color: var(--primary); background: rgba(var(--primary-rgb), 0.06); }

@media (prefers-reduced-motion: reduce) {
  .nav-item::before { transition: none; }
  .nav-item.active::before { transform: scaleY(1); opacity: 1; }
}
```

### 2c. Topbar / shell entrance on load

Trigger: first paint. The topbar and sidebar are chrome — they must feel *instantly present*, not "animated in." So they get the most restrained possible entrance: a 6px settle + fade on `--dur-base`, no stagger, fired once. The content area (§3) carries the choreography; the frame just steadies.

```css
@media (prefers-reduced-motion: no-preference) {
  .app-topbar { animation: shell-settle var(--dur-base) var(--ease-out) both; }
  .app-sidebar { animation: shell-settle var(--dur-base) var(--ease-out) both; }
}
@keyframes shell-settle {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 3. Content entry — staggered fade-in-up (the workhorse)

Trigger: mount of the main content column. Cards/sections fade up 8px on `--dur-base` with the spring, staggered **60ms** per item. **Capped at 6 items** — beyond that the stagger reads as a slow loading screen on a console, so item 7+ all land together with item 6. This is the single most-used pattern; it gives the page a sense of being *composed* without ever feeling like it's making the operator wait.

Mark up animatable children with `data-anim` and an index custom prop:

```html
<main class="content">
  <section data-anim style="--i:0"> … </section>
  <div class="stat-strip">
    <div class="stat-block" data-anim style="--i:1"> … </div>
    <div class="stat-block" data-anim style="--i:2"> … </div>
  </div>
  <div class="card" data-anim style="--i:3"> … </div>
  <!-- cap delay at --i:5 in CSS; index 6+ render with no extra delay -->
</main>
```

```css
@media (prefers-reduced-motion: no-preference) {
  [data-anim] {
    /* start-state set globally in §1; here we define the arrival */
    animation: entry-fade-up var(--dur-base) var(--ease) both;
    /* clamp the stagger: max(--i,5) capped → never exceeds 300ms total */
    animation-delay: calc(min(var(--i, 0), 5) * 60ms);
  }
}
@keyframes entry-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Why `both` + the §1 start-state:** `both` holds the `from` frame during the delay so a card at `--i:5` stays hidden (not flashing) until its turn, then animates to visible. Under `reduce`, §1 forces `opacity:1; transform:none` so everything is simply present.

> **JS trigger for late-loaded content.** Content fetched after first paint (e.g. async program list) won't auto-run the keyframe. Add `data-anim` to each new node and toggle a class, OR re-trigger by setting `--i` and forcing reflow. The simplest robust approach is an `IntersectionObserver` that adds `.in` to off-screen sections — but for above-the-fold console content the CSS-only mount animation above is sufficient and preferred (no observer cost).

---

## 4. Cards — hover lift

Trigger: hover on `.card-interactive`. Lift 2px + shadow step + border tint. Already specced in DS §Component 2; the motion refinement is **spring on the lift, standard on the shadow** so the card *settles* into the raised state rather than sliding. Press (clicking a card) dips it back to 0. Restrained: 2px, not 6px — a console card is a surface, not a button.

```css
.card-interactive {
  transition:
    transform var(--dur-base) var(--ease),         /* SPRING settle */
    box-shadow var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);
}
.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: rgba(var(--primary-rgb), 0.2);
}
.card-interactive:active { transform: translateY(0); transition-duration: var(--dur-fast); }
```

---

## 5. Buttons — press feedback

Trigger: `:active` (pointer/keyboard activate). Quick 1px dip via `transform` on `--dur-fast`. The hover lift (DS §1) raises it; the press returns it to baseline — the classic raise→press loop that makes a button feel physical. `--dur-fast` because press feedback that lags feels broken. No scale (scale on text buttons blurs the label sub-pixel); translateY only.

```css
.btn {
  transition:
    background var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(var(--primary-rgb),0.24); }
.btn:active { transform: translateY(0); }
/* Icon-only / FAB-style buttons MAY scale — text buttons never */
.btn-icon:active { transform: scale(0.94); }
```

---

## 6. Run / assessment banner — live "running" pulse

Trigger: a run is in flight → `.banner.is-running`. This is the one place a *looping* animation is allowed, because it communicates ongoing live state (agents working). It must be **calm, not anxious** — a slow breathing pulse on a status dot + a subtle opacity drift on the caption, NOT a fast spinner. Two-second cycle, `--ease-out`, infinite. No transform on the banner itself (it holds layout); the pulse lives on a small dot and the caption.

```css
.banner.is-running .run-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary);
  /* glow ring that breathes outward */
  box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.35);
}
@media (prefers-reduced-motion: no-preference) {
  .banner.is-running .run-dot { animation: run-pulse 2s var(--ease-out) infinite; }
  .banner.is-running .run-caption { animation: run-breathe 2s var(--ease-out) infinite; }
}
@keyframes run-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(var(--primary-rgb), 0.35); transform: scale(1); }
  70%  { box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0);    transform: scale(1); }
  100% { box-shadow: 0 0 0 0   rgba(var(--primary-rgb), 0);    transform: scale(1); }
}
@keyframes run-breathe { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  /* keep the signal as a static solid dot + full-opacity caption */
  .banner.is-running .run-dot { box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.25); }
  .banner.is-running .run-caption { opacity: 1; }
}
```

> The `box-shadow` ring here is the one tasteful exception to "transform + opacity only" — it animates a shadow's spread/alpha, not layout, so it's GPU-cheap and jank-free. The dot's own `transform` stays at `scale(1)`; only the ring expands.

---

## 7. Stat numbers — count-up on first paint (needs JS helper)

Trigger: stat block enters the viewport on first paint. The number tweens from 0 → target on `--dur-slow` (0.6s) with an ease-out curve, so it decelerates into the final value. This is reserved for the **headline stats** (active programs, completeness %, cards awaiting) — not every number on the page. It reads as "the console is tallying your portfolio." Pair with the §3 fade-up: the card fades up, then the number counts.

CSS does the visual; JS does the tween. The helper respects reduced-motion (jumps straight to the value) and only runs once.

```html
<span class="stat-val" data-countup data-to="72" data-suffix="%">72%</span>
<!-- innerText must already be the final value (no-JS / reduced-motion safe) -->
```

```js
/* shared/countup.js — ~30 lines, no deps. Call initCountUp() after stats render. */
function initCountUp(root = document) {
  const els = root.querySelectorAll('[data-countup]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  els.forEach((el) => {
    if (el.dataset.counted) return;          // run once
    const to = parseFloat(el.dataset.to);
    if (Number.isNaN(to)) return;
    const suffix = el.dataset.suffix || '';
    const decimals = (el.dataset.decimals && +el.dataset.decimals) || 0;
    el.dataset.counted = '1';

    if (reduce) { el.textContent = to.toFixed(decimals) + suffix; return; }

    const DURATION = 600;                     // matches --dur-slow (0.6s)
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);   // mirrors --ease-out feel
    let start = null;

    const step = (ts) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / DURATION, 1);
      const val = to * easeOut(p);
      el.textContent = val.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = to.toFixed(decimals) + suffix;   // exact landing
    };
    requestAnimationFrame(step);
  });
}

/* Run only when stats are actually visible, so off-screen numbers don't
   "count" before the operator sees them. */
function observeCountUp(root = document) {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { initCountUp(e.target); obs.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  root.querySelectorAll('[data-countup]').forEach((el) => io.observe(el));
}
// init: observeCountUp();  // after the stat strip is in the DOM
```

> **Restraint note:** count-up is per-context, max ~4 numbers. Do not count-up table cells, list counts, or per-card metrics — that turns a tool into a slot machine.

---

## 8. Tabs — active underline slide

Trigger: `.tab` selection (DS §Component 13, `.tabs-underline`). The DS spec transitions `border-bottom-color`, which *cross-fades* the underline — fine, but a console feels more precise when the underline **slides** from old to new tab. Achieve the slide with a single shared underline element positioned via `transform: translateX()` + `scaleX()` (one moving element, no per-tab borders), animated on `--dur-base / --ease-out`. Sliding a transform is layout-free; animating each tab's `border-color` is the cross-fade fallback.

```css
.tabs-underline { position: relative; }
.tabs-underline .tab-indicator {
  position: absolute; bottom: 0; left: 0; height: 2px;
  background: var(--primary);
  transform-origin: left center;
  /* JS sets --x (translate px) and --w (scaleX as width ratio or px) */
  transform: translateX(var(--x, 0)) scaleX(var(--w, 0));
  transition: transform var(--dur-base) var(--ease-out);
  will-change: transform;
}
.tab { transition: color var(--dur-base) var(--ease-out); }
.tab.active { color: var(--primary); }
```

```js
/* Position the shared indicator under the active tab. Call on click + on resize. */
function moveTabIndicator(tablist) {
  const active = tablist.querySelector('.tab.active');
  const ind = tablist.querySelector('.tab-indicator');
  if (!active || !ind) return;
  const x = active.offsetLeft;
  ind.style.setProperty('--x', x + 'px');
  ind.style.setProperty('--w', active.offsetWidth + 'px');
  // NB: scaleX with px requires width:1px base — see note below
}
```

> **Implementation choice.** Two valid encodings: (a) give `.tab-indicator { width:1px }` and use `scaleX(<pixel width>)`; or (b) animate `width` directly — but width is a layout property and violates the hard rule, so prefer (a). Simplest robust form: set `.tab-indicator { width: var(--w); transform: translateX(var(--x)); }` and accept that `width` is set instantly (no transition on it) while `transform` carries the visible slide. **Reduced-motion:** drop the transition; the indicator jumps. (Fallback for non-JS: the DS per-tab `border-bottom-color` cross-fade in §Component 13 still works.)

---

## 9. Modal + toast — enter / exit

### 9a. Modal (DS §Component 11, refined)

Trigger: open → `.modal-scrim.open`. Scrim fades on `--ease-out`; card **rises** 8px + fades with the **spring** so it settles authoritatively. Exit reverses on `--ease-out` (faster, no overshoot — exits should never bounce). Focus-trap, Esc, focus-restore are behavioural (DS), not motion.

```css
.modal-scrim {
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.modal-scrim.open { opacity: 1; }

.modal-card {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease);      /* SPRING in */
}
.modal-scrim.open .modal-card { opacity: 1; transform: translateY(0) scale(1); }

/* Exit: add .closing before unmount, then remove node after --dur-base */
.modal-scrim.closing { opacity: 0; }
.modal-scrim.closing .modal-card {
  opacity: 0; transform: translateY(4px) scale(0.99);
  transition-timing-function: var(--ease-out);   /* no bounce on exit */
}

@media (prefers-reduced-motion: reduce) {
  .modal-card { transform: none; transition: opacity 0.001ms; }
  .modal-scrim.open .modal-card { transform: none; }
}
```

### 9b. Toast

Trigger: system feedback (save, handoff sent). Slides up + fades in from the bottom-right on the spring; auto-dismisses after ~4s by fading + sliding 4px down on `--ease-out`. Stacks vertically; new toasts push via the same entry (each owns its transform, no FLIP needed).

```css
.toast {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease);       /* SPRING up   */
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast.hide {
  opacity: 0; transform: translateY(4px);
  transition-timing-function: var(--ease-out);   /* gentle exit */
}
@media (prefers-reduced-motion: reduce) {
  .toast { transform: none; }
  .toast.show { transform: none; }
}
```

```js
function showToast(node) {
  requestAnimationFrame(() => node.classList.add('show'));   // next-frame so transition fires
  setTimeout(() => {
    node.classList.remove('show'); node.classList.add('hide');
    node.addEventListener('transitionend', () => node.remove(), { once: true });
  }, 4000);
}
```

---

## 10. Progress bars — fill on reveal

Trigger: a `.progress` enters view (completeness %, compliance bar, hub progress). Fill animates via `transform: scaleX()` from 0 → target on `--dur-slow / --ease-out` — decelerating into the final width. **Never animate `width`** (layout). The bar's track is full-width; the fill is `scaleX(0)` and grows. Set the target as a custom prop. Pair the fill with the §7 count-up where a % label sits beside it — they should finish together (both 0.6s).

```css
.progress { position: relative; height: 6px; border-radius: var(--radius-pill);
  background: var(--surface-alt); overflow: hidden; }
.progress .progress-fill {
  position: absolute; inset: 0;
  border-radius: inherit;
  background: var(--primary);
  transform-origin: left center;
  transform: scaleX(0);
}
@media (prefers-reduced-motion: no-preference) {
  .progress.in .progress-fill {
    transform: scaleX(var(--value, 0));            /* e.g. style="--value:.72" */
    transition: transform var(--dur-slow) var(--ease-out);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress .progress-fill { transform: scaleX(var(--value, 0)); }   /* instant final */
}
```

```js
/* Add .in when the bar scrolls into view so the fill animates from 0 on reveal. */
function observeProgress(root = document) {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  root.querySelectorAll('.progress').forEach((el) => io.observe(el));
}
```

> `scaleX` distorts nothing here (a flat bar), so it's the correct, layout-free fill. For a value that *updates* later (not first reveal), just change `--value`; the `transition` carries it smoothly.

---

## 11. The restraint list — what must NOT animate

A B2B console earns trust by being *calm*. These are forbidden, by name:

- **No looping animation anywhere except the §6 run-pulse.** No breathing logos, no shimmering gradients, no perpetual motion in chrome. The shimmer on `.skeleton` is the only other loop and it stops the instant data lands.
- **No entrance animation on navigation between routes.** The shell entrance (§2c) fires ONCE on first load. Clicking from Portfolio → Program must feel instant; re-running fade-ups on every route change makes the app feel slow and laggy. (Late-loaded *data* may fade in; the *page frame* may not.)
- **No animated number on every metric.** Count-up is for ~4 headline stats per context, period. Table cells, list counts, per-card numbers render instantly.
- **No hover motion on non-interactive surfaces.** Static cards, panels, stat blocks, list rows that don't link — no lift, no tint. Motion implies "you can act on this"; faking it erodes the signal.
- **No `transition: all`.** Ever. It animates properties you didn't intend (including layout) and tanks performance.
- **No layout-property animation** — `width`, `height`, `top`, `left`, `margin`, `padding`, `gap`. Bars use `scaleX`, indicators use `translateX`, reveals use `translateY`. Transform + opacity only.
- **No bounce on exits.** Spring (`--ease`) is for arrivals. Exits, fades, fills, and colour use `--ease-out`. A modal that bounces *out* feels broken.
- **No stagger beyond 6 items / 300ms total.** A console is dense; a 12-card stagger reads as a slow loader.
- **No motion on focus rings, error states, or validation.** Accessibility and error feedback must be *instant and unmissable* — never gated behind an animation the user has to wait out.
- **No scale on text buttons** (sub-pixel blur on the label). Icon-only buttons may scale (§5).
- **No parallax, no scroll-jacking, no scroll-linked hero collapse** in the Workspace. This is a tool, not a landing page.

---

## 12. Reduced-motion summary (single source)

Under `prefers-reduced-motion: reduce`, via the §1 guard plus per-pattern overrides:

| Pattern | Reduced-motion behaviour |
|---|---|
| Shell entrance | No fade/settle — present instantly |
| Content fade-up + stagger | All items visible immediately, no translate, no delay |
| Card / button hover & press | Colour + shadow still change (state feedback kept); no transform travel |
| Active nav bar | Appears instantly at full height, no spring grow |
| Run pulse | Static solid dot + full-opacity caption — signal kept, loop removed |
| Count-up | Jumps straight to final value |
| Tab underline | Jumps to active tab, no slide |
| Modal / toast | Fade only (~instant), no rise/slide, no spring |
| Progress fill | Snaps to final `scaleX` value, no grow |
| Skeleton shimmer | Animation off (DS already handles) |

The principle: **remove the travel, keep the truth.** Every final state, colour, value, and focus ring is identical with motion on or off. Motion is the *how*, never the *what*.

---

*End of Ventrify Workspace Motion Spec v1.*
