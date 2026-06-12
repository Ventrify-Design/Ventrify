# Ventrify Design System v1

> One source of truth for the Ventrify OS ecosystem: Operator **Workspace**, founder **Studio**, and (by extension) the OS marketing site. Authored from the Workspace audit, the existing `workspace/styles.css`, and the `ui-designer` page-template model.

This document is normative. Where it disagrees with a current implementation, the implementation is wrong and migrates to this. The single biggest defect class the audit surfaced is **token divergence** — three vocabularies (`--primary` vs `--brand-primary` vs site `--brand`), two danger reds (`#E0394A` vs `#C0392B`), and band-colour literals re-typed 42 times. v1 collapses all of that into the tokens below.

A note on the primary hue. The OS product uses **blue `#0036FF`** as `--primary`, with **teal `#00B8A0`** as accent — a deliberate identity distinct from the agency site's purple `#6E3AFA`. v1 keeps blue and unifies every OS surface (Workspace + Studio) on it. The divergence the audit found was the *vocabulary* (`--primary` vs `--brand-primary` vs `--brand`), not the hue. Runtime per-org theming still overrides `--primary` / `--primary-rgb` at the `:root` for white-label.

---

## Principles

1. **The template decision is the screen decision.** Every page names one of five templates (ListScreen / DetailScreen / StepScreen / SettingsScreen / RawScreen) before a line of markup. RawScreen is last-resort.
2. **Every layer binds to a token.** No hardcoded hex in markup or page-local CSS. If a value is missing, add a token — never inline it. Target: `program.html` from 114 inline `style=` blocks to under 25.
3. **Four states are first-class.** Every data-dependent region designs loading (skeleton), empty, error (with retry), and populated. "Empty" must never be how a failed load reads.
4. **One accent earns colour.** One brand-coloured element per context, tied to the thing that needs action. Structural metadata (industry, phase) renders neutral; semantic colour is reserved for true status. Cap on-screen hues at 3 excluding neutrals.
5. **Transform + opacity only.** Animate `transform` and `opacity`, never `all`. One easing curve, one fast timing.
6. **Accessibility is not optional.** Every interactive element has a visible `:focus-visible` ring. Body text clears WCAG AA 4.5:1 — which retires `--text-subtle` from all load-bearing copy.

---

## Foundations

The complete token set. This is the head of `shared/ds.css` (see Rollout). Both Workspace and Studio import it; neither redeclares any of it.

```css
/* ============================================================
   VENTRIFY DESIGN SYSTEM v1 — FOUNDATIONS
   shared/ds.css :root — single source of truth
   ============================================================ */
:root {
  /* --- Brand ------------------------------------------------ */
  --primary: #0036FF;            /* OS blue — primary action, active state */
  --primary-light: #4D74FF;      /* gradients, hover accents */
  --primary-deep: #002BD6;       /* pressed / text-on-light where blue must clear AA */
  --primary-rgb: 0,54,255;       /* for rgba() tints — ALWAYS define alongside --primary */

  --accent: #00B8A0;             /* teal — highlights, success-adjacent, on-track */
  --accent-rgb: 0,184,160;

  /* --- Neutrals -------------------------------------------- */
  --bg: #FAFAFB;                 /* page background */
  --surface: #FFFFFF;            /* card / panel base */
  --surface-alt: #F5F5F7;        /* recessed fields, hover row tint, neutral pills */
  --surface-muted: #F0F2F7;      /* secondary fills */

  --text: #141414;              /* primary text — ~14:1 on surface */
  --text-muted: #595E6B;         /* secondary text — ~6.4:1 on surface, PASSES AA */
  --text-subtle: #6B7280;        /* tertiary — ~4.9:1, AA-safe; decorative/≥18px only */
  /* NOTE: legacy --text-subtle was #9AA0AE (~2.5:1, FAILS). Darkened in v1. */

  --border: rgba(0,0,0,0.06);    /* hairline dividers */
  --border-strong: rgba(0,0,0,0.10); /* input borders, card edges */

  /* --- Semantic ------------------------------------------- */
  --success: #00A368;            --success-rgb: 0,163,104;   /* darkened from #00B872 for AA on white */
  --warning: #C77700;            --warning-rgb: 199,119,0;   /* canonical warning-deep */
  --danger:  #C42233;            --danger-rgb: 196,34,51;    /* ONE danger — clears 4.5:1 at 0.8rem */
  /* Retires the #E0394A / #C0392B split. Both legacy values map here. */

  /* Investability bands (formerly 42 raw literals) */
  --band-strong: var(--success); /* green / approved  */
  --band-mid:    var(--warning); /* yellow / feedback */
  --band-weak:   var(--danger);  /* red / pass        */

  /* --- Typography ----------------------------------------- */
  --font-heading: 'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body:    'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  /* Type scale — modular, bound by role. font-size / line-height / weight / tracking */
  --t-display: 600 2.4rem/1.1 var(--font-heading);    /* hero scores, success titles  */
  --t-h1:      600 2rem/1.15 var(--font-heading);     /* page title                   */
  --t-h2:      600 1.5rem/1.2 var(--font-heading);    /* step title, section hero     */
  --t-h3:      600 1.2rem/1.25 var(--font-heading);   /* section title, card title    */
  --t-h4:      600 1rem/1.35 var(--font-heading);     /* sub-card title               */
  --t-body:    400 0.95rem/1.6 var(--font-body);      /* default body                 */
  --t-body-sm: 400 0.86rem/1.55 var(--font-body);     /* dense body, card detail      */
  --t-caption: 500 0.78rem/1.5 var(--font-body);      /* meta, labels                 */
  --t-eyebrow: 500 0.72rem/1.4 var(--font-mono);      /* eyebrows, pills (uppercase)  */
  --tracking-tight: -0.02em;     /* large headings   */
  --tracking-eyebrow: 0.08em;    /* uppercase mono   */

  /* --- Spacing — 8px grid ---------------------------------- */
  --space-0: 0;
  --space-1: 4px;    /* 0.5 step — icon gaps               */
  --space-2: 8px;    /* base unit                          */
  --space-3: 12px;   /* intra-field gap                    */
  --space-4: 16px;   /* card internal gap                  */
  --space-5: 24px;   /* card padding, grid gap             */
  --space-6: 32px;   /* section internal                   */
  --space-7: 40px;   /* between grouped sections           */
  --space-8: 48px;   /* between unrelated section groups   */
  --space-9: 64px;   /* page-level top/bottom              */

  /* --- Radii ----------------------------------------------- */
  --radius-sm: 8px;    --radius-md: 12px;   --radius-lg: 16px;
  --radius-card: 16px; /* RECONCILED: workspace was 20, studio 14 → one value */
  --radius-pill: 980px;

  /* --- Elevation ------------------------------------------- */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 32px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
  --shadow-pop: 0 16px 56px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04); /* modals, login */
  --shadow-brand: 0 6px 20px rgba(var(--primary-rgb),0.18); /* primary buttons, selected cards */

  /* --- Motion ---------------------------------------------- */
  --ease: cubic-bezier(0.34, 1.56, 0.64, 1);  /* spring — selection, entry            */
  --ease-out: cubic-bezier(0.6, 0.6, 0, 1);   /* standard — hover, fades, bars        */
  --dur-fast: 0.15s;   /* press, micro-feedback */
  --dur-base: 0.25s;   /* hover, colour, fade   */
  --dur-slow: 0.6s;    /* progress bars, count-up */

  /* --- Inverse surface (dark panels — consolidates 4 near-blacks) --- */
  --inverse-surface: #0F0F12;
  --inverse-gradient: linear-gradient(135deg, #0F0F12, #1A1A1F);
  --inverse-text: rgba(255,255,255,0.92);
  --inverse-text-muted: rgba(255,255,255,0.55);

  /* --- Layout ---------------------------------------------- */
  --sidebar-w: 248px;
  --topbar-h: 64px;
  --content-max: 1320px;
}
```

### Accessibility deltas baked into the tokens

| Token | Legacy | v1 | Reason |
|---|---|---|---|
| `--text-subtle` | `#9AA0AE` (~2.5:1) | `#6B7280` (~4.9:1) | Was used on `.action-meta`, `.timeline-time`, placeholders — all failed AA |
| `--text-muted` | `#656565` (~5.7:1) | `#595E6B` (~6.4:1) | Promote load-bearing meta here |
| `--danger` | `#E0394A` / `#C0392B` (4.33:1) | `#C42233` (≥4.5:1) | Two values reconciled; passes at 0.8rem |
| `--success` | `#00B872` (~2.3:1 text) | `#00A368` | AA for small success text |
| `--warning` | `#E6A91A` (~1.9:1 text) | `#C77700` | AA for small warning text |

---

## Components

Inventory of 14 components. Each gives **anatomy**, **variants**, **states**, and the **markup contract** (the single class API a build engineer uses). All live in `shared/ds.css`.

### 1. Button — `.btn`

- **Anatomy:** inline-flex, optional leading icon, label, optional trailing chevron. Pill radius.
- **Variants:** `.btn-primary` (filled purple) · `.btn-outline` (surface + border) · `.btn-ghost` (transparent) · `.btn-danger` (NEW — danger-tinted ghost, the single destructive token) · sizes `.btn-sm` `.btn-lg`.
- **States:** default · `:hover` (translateY(-1px) + shadow) · `:active` (translateY(0)) · `:focus-visible` (global ring) · `[disabled]` / `[aria-disabled]` (uses `--surface-alt` bg + `--text-subtle`, **never** opacity).
- **Rule:** one `.btn-primary` per context. Secondary pairs as ghost/outline — never two fills stacked.

```css
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px;
  font:var(--t-caption); font-family:var(--font-heading); font-weight:500;
  padding:0.6rem 1.15rem; border-radius:var(--radius-pill); border:1px solid transparent;
  cursor:pointer; white-space:nowrap;
  transition: background var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out),
              transform var(--dur-fast) var(--ease-out),
              border-color var(--dur-base) var(--ease-out); }
.btn-primary { background:var(--primary); color:#fff; box-shadow:var(--shadow-brand); }
.btn-primary:hover { transform:translateY(-1px);
  box-shadow:0 8px 24px rgba(var(--primary-rgb),0.24); }
.btn-primary:active { transform:translateY(0); }
.btn-outline { background:var(--surface); color:var(--text); border-color:var(--border-strong); }
.btn-outline:hover { background:var(--surface-alt); }
.btn-ghost { background:transparent; color:var(--text-muted); }
.btn-ghost:hover { background:var(--surface-alt); color:var(--text); }
.btn-danger { background:transparent; color:var(--danger);
  border-color:rgba(var(--danger-rgb),0.3); }
.btn-danger:hover { background:rgba(var(--danger-rgb),0.08);
  border-color:rgba(var(--danger-rgb),0.5); }
.btn-sm { font-size:0.8rem; padding:0.45rem 0.95rem; }
.btn-lg { font-size:0.95rem; padding:0.85rem 1.5rem; border-radius:var(--radius-md); }
.btn[disabled], .btn[aria-disabled="true"] {
  background:var(--surface-alt); color:var(--text-subtle);
  border-color:var(--border); box-shadow:none; cursor:not-allowed; }
```

### 2. Card — `.card`

- **Anatomy:** surface bg, hairline border, `--radius-card`, `--space-5` padding.
- **Variants:** `.card` (white) · `.card-flat` (surface-alt, no border) · `.card-interactive` (adds hover lift + cursor + focus ring — for clickable cards). A clickable card MUST be `<a>`/`role=button`, not a bare `<div>`.
- **States:** static · `.card-interactive:hover` (border tint + `--shadow-md` + translateY(-1px)) · `:focus-visible`.

```css
.card { background:var(--surface); border:1px solid var(--border);
  border-radius:var(--radius-card); padding:var(--space-5); }
.card-flat { background:var(--surface-alt); border:none;
  border-radius:var(--radius-card); padding:var(--space-5); }
.card-interactive { cursor:pointer;
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out),
              border-color var(--dur-base) var(--ease-out); }
.card-interactive:hover { transform:translateY(-1px);
  border-color:rgba(var(--primary-rgb),0.2); box-shadow:var(--shadow-md); }
```

### 3. SectionHead — `.section-head` (eyebrow → title → sub)

- **Anatomy:** consolidates the ~6 forked eyebrows (`page-eyebrow`, `wizard-eyebrow`, `s-label`, `empty-hero-eyebrow`). One `.eyebrow` primitive (mono, uppercase, accent-bar `::before`), one `.section-title` (h3), one `.section-sub` (muted, 1 line). Optional right-slot for actions/count.
- **Variants:** `.section-head` (in-page) · `.page-header` (page-level, larger title via `--t-h1`).
- **Eyebrow colour:** `--accent` (teal) for section eyebrows; `--primary` for the page eyebrow.

```css
.eyebrow { display:inline-flex; align-items:center; gap:10px;
  font:var(--t-eyebrow); letter-spacing:var(--tracking-eyebrow);
  text-transform:uppercase; color:var(--accent); }
.eyebrow::before { content:''; width:18px; height:2px;
  background:currentColor; border-radius:1px; opacity:0.6; }
.eyebrow.is-primary { color:var(--primary); }
.section-head { display:flex; justify-content:space-between; align-items:flex-end;
  gap:var(--space-4); margin-bottom:var(--space-5); }
.section-title { font:var(--t-h3); color:var(--text); letter-spacing:var(--tracking-tight); }
.section-sub { font:var(--t-caption); color:var(--text-muted);
  margin-top:var(--space-1); max-width:640px; }
```

### 4. Banner — `.banner` (work-zone / run / notice)

- **Anatomy:** elevated surface with a left status rail, tinted bg, eyebrow + message + action slot. The "act on it" zone (run agents, gate ready).
- **Variants:** `.banner-brand` (primary tint — work zone) · `.banner-warning` · `.banner-danger` (errors: "Safe to retry") · `.banner-success`.
- **States:** static · `.is-running` (animated mono caption, no spinner-only states).

```css
.banner { display:flex; gap:var(--space-4); align-items:flex-start;
  padding:var(--space-4) var(--space-5); border-radius:var(--radius-lg);
  border:1px solid var(--border); border-left:3px solid var(--primary);
  background:rgba(var(--primary-rgb),0.04); }
.banner-warning { border-left-color:var(--warning); background:rgba(var(--warning-rgb),0.06); }
.banner-danger  { border-left-color:var(--danger);  background:rgba(var(--danger-rgb),0.05); }
.banner-success { border-left-color:var(--success); background:rgba(var(--success-rgb),0.06); }
```

### 5. Pill / Tag — `.pill`

- **Anatomy:** mono uppercase micro-label, optional leading `.dot`. Pill radius.
- **Variants:** `.pill` (neutral) · `.pill-primary` · `.pill-accent` (NEW) · `.pill-success` · `.pill-warning` · `.pill-danger`. Health aliases (`.health-on-track/-attention/-stuck`) map onto these. **NEW** `.tag` variant = sentence-case Inter for *program chips* and *counts* (mono is reserved for machine tokens: timestamps, IDs).
- **States:** static; `.pill-selectable` adds hover + `:focus-visible` when used as a filter.

```css
.pill { display:inline-flex; align-items:center; gap:7px; font:var(--t-eyebrow);
  letter-spacing:var(--tracking-eyebrow); text-transform:uppercase;
  padding:5px 11px; border-radius:var(--radius-pill);
  background:var(--surface-alt); color:var(--text-muted);
  border:1px solid rgba(0,0,0,0.04); white-space:nowrap; }
.pill-primary { background:rgba(var(--primary-rgb),0.08); color:var(--primary);
  border-color:rgba(var(--primary-rgb),0.12); }
.pill-accent  { background:rgba(var(--accent-rgb),0.08);  color:var(--accent);
  border-color:rgba(var(--accent-rgb),0.15); }
.pill-success { background:rgba(var(--success-rgb),0.08); color:var(--success);
  border-color:rgba(var(--success-rgb),0.15); }
.pill-warning { background:rgba(var(--warning-rgb),0.10); color:var(--warning);
  border-color:rgba(var(--warning-rgb),0.18); }
.pill-danger  { background:rgba(var(--danger-rgb),0.08);  color:var(--danger);
  border-color:rgba(var(--danger-rgb),0.15); }
.tag { font:var(--t-caption); text-transform:none; letter-spacing:0;
  font-family:var(--font-body); padding:4px 10px; }
.pill .dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
```

### 6. StatBlock — `.stat-block`

- **Anatomy:** large display number + small label. Optional `.stat-gauge` (inline `.progress` bar/ring for 0–100% health metrics) or `.stat-trend`.
- **Variants:** `.stat-block` (passive count — NEUTRAL, no accent bar) · `.stat-block.is-actionable` (one per strip; warning rail when value > 0) · `.stat-block.is-gauge` (renders the progress bar under the number).
- **Rule:** one accent-coloured stat per strip, tied to the actionable metric. Drop the blanket blue/purple bar from passive counts.

```css
.stat-block { display:flex; flex-direction:column; gap:4px; }
.stat-block .stat-val { font:var(--t-display); font-size:2.2rem; color:var(--text);
  letter-spacing:var(--tracking-tight); line-height:1; }
.stat-block .stat-lbl { font:var(--t-caption); color:var(--text-muted); }
.stat-block.is-actionable { position:relative; padding-left:var(--space-3); }
.stat-block.is-actionable::before { content:''; position:absolute; left:0; top:2px; bottom:2px;
  width:3px; border-radius:2px; background:var(--warning); }
```

### 7. Panel — `.panel` / `.panel-inverse`

- **Anatomy:** content grouping container; `.panel` = light surface, `.panel-inverse` = the dark editorial surface (consolidates `#0F0F12` / `#0C1035` / `rgba(20,20,20)`).
- **Variants:** `.panel` · `.panel-inverse` (dark — investability hero, command blocks).
- **States:** static.

```css
.panel-inverse { background:var(--inverse-gradient); color:var(--inverse-text);
  border-radius:var(--radius-lg); padding:var(--space-5); }
.panel-inverse .eyebrow { color:var(--inverse-text-muted); }
```

### 8. EmptyState — `.empty-state`

- **Anatomy:** centered, `--surface-alt` card, illustration/icon slot, title (h3), one muted body line, single CTA. ONE pattern for the whole ecosystem (the audit found 2–3 divergent ones per screen).
- **Variants:** `.empty-state` (default) · `.empty-state-hero` (split layout, dashboard first-run only).
- **Rule:** only shown after a **confirmed-empty** read — never as the default pre-load state, never as the error fallback.

```css
.empty-state { text-align:center; background:var(--surface-alt);
  border-radius:var(--radius-card); padding:var(--space-8) var(--space-5);
  display:flex; flex-direction:column; align-items:center; gap:var(--space-3); }
.empty-state-title { font:var(--t-h3); color:var(--text); }
.empty-state-body { font:var(--t-body-sm); color:var(--text-muted); max-width:42ch; }
```

### 9. Loading skeleton — `.skeleton`

- **Anatomy:** shimmer rectangles matching the target layout (never a spinner where the layout is known). Composable shapes: `.skeleton-line`, `.skeleton-block`, `.skeleton-card`.
- **States:** animates via `opacity` shimmer only (transform-safe). Disabled under `prefers-reduced-motion`.

```css
.skeleton { position:relative; overflow:hidden;
  background:var(--surface-alt); border-radius:var(--radius-sm); }
.skeleton::after { content:''; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  transform:translateX(-100%); animation:ds-shimmer 1.4s infinite; }
@keyframes ds-shimmer { 100% { transform:translateX(100%); } }
.skeleton-line { height:12px; margin-bottom:var(--space-2); }
.skeleton-card { height:160px; border-radius:var(--radius-card); }
@media (prefers-reduced-motion: reduce) { .skeleton::after { animation:none; } }
```

### 10. ErrorState — `.error-state`

- **Anatomy:** dedicated block, visually distinct from empty: icon + title in `--text` + message in `--text-muted` + Retry `.btn-outline`. Replaces every `alert()` / silent `catch → []`.
- **States:** static; Retry re-runs the failed fetch.

```css
.error-state { text-align:center; border:1px solid rgba(var(--danger-rgb),0.2);
  background:rgba(var(--danger-rgb),0.03); border-radius:var(--radius-card);
  padding:var(--space-7) var(--space-5); display:flex; flex-direction:column;
  align-items:center; gap:var(--space-3); }
```

### 11. Modal / Dialog — `.modal`

- **Anatomy:** scrim + centered `.modal-card` (`--shadow-pop`), title, body, footer actions. Replaces native `alert`/`confirm`/`prompt`.
- **Variants:** `.modal` (default) · `.modal-danger` (type-the-name-to-confirm destructive pattern; confirm is `.btn-danger`, disabled until name matches).
- **States:** enter (opacity + translateY via `--ease`), exit. Focus trapped; Esc closes; restores focus on close.

```css
.modal-scrim { position:fixed; inset:0; background:rgba(15,15,18,0.45);
  display:flex; align-items:center; justify-content:center; z-index:1000;
  opacity:0; transition:opacity var(--dur-base) var(--ease-out); }
.modal-scrim.open { opacity:1; }
.modal-card { background:var(--surface); border-radius:var(--radius-lg);
  box-shadow:var(--shadow-pop); padding:var(--space-6); max-width:480px; width:100%;
  transform:translateY(8px); transition:transform var(--dur-base) var(--ease); }
.modal-scrim.open .modal-card { transform:translateY(0); }
```

### 12. Table / List row — `.list-row`

- **Anatomy:** full-width row (avatar/icon + primary text + meta on left, status/action on right), 56–64px tall, hairline divider, hover row-tint. The roster/dense-list primitive (replaces the hard-capped 3-up card grids).
- **Variants:** `.list-row` (static) · `.list-row-interactive` (links to a DetailScreen; hover + `:focus-visible`).
- **States:** default · hover (`--surface-alt`) · `:focus-visible`.

```css
.list-row { display:grid; grid-template-columns:auto 1fr auto; gap:var(--space-4);
  align-items:center; min-height:56px; padding:var(--space-3) var(--space-4);
  border-bottom:1px solid var(--border); }
.list-row-interactive { cursor:pointer; border-radius:var(--radius-md);
  transition:background var(--dur-base) var(--ease-out); }
.list-row-interactive:hover { background:var(--surface-alt); }
```

### 13. Tabs — `.tabs` (Studio tabnav + in-page segmented)

- **Anatomy:** horizontal row of `.tab` triggers; active gets brand underline/fill. ARIA `role=tablist`/`tab`/`tabpanel`.
- **Variants:** `.tabs-underline` (Studio chrome) · `.tabs-segmented` (pill group, in-page filters).
- **States:** default · hover · `.tab.active` · `:focus-visible` · `[aria-selected]`.

```css
.tab { font:var(--t-caption); color:var(--text-muted); padding:var(--space-2) var(--space-3);
  border-bottom:2px solid transparent; cursor:pointer;
  transition:color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out); }
.tab:hover { color:var(--text); }
.tab.active { color:var(--primary); border-bottom-color:var(--primary); }
```

### 14. Avatar — `.avatar`

- **Anatomy:** circle, initials or image, org/operator colour bg. Sizes by token, never inline width/height.
- **Variants:** `.avatar-sm` (22px) · `.avatar` (30px) · `.avatar-lg` (40px). A shared `renderAvatar({name, colour, size})` is the only place initials/colour are computed (kills 6 hand-typed copies).
- **States:** static; `.avatar-link` adds ring on `:focus-visible`.

```css
.avatar { width:30px; height:30px; border-radius:50%; display:inline-flex;
  align-items:center; justify-content:center; color:#fff; font:600 0.72rem/1 var(--font-body);
  flex-shrink:0; }
.avatar-sm { width:22px; height:22px; font-size:0.62rem; }
.avatar-lg { width:40px; height:40px; font-size:0.88rem; }
```

### Global focus ring (applies to every component)

```css
:where(a, button, [role="button"], [role="radio"], [role="checkbox"],
       .card-interactive, .list-row-interactive, input, select, textarea):focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: inherit;
}
```

This single rule closes the WCAG 2.4.7 failures the audit found on every Workspace screen (Program, New Engagement, Team, etc.).

---

## Page templates

Five templates. Every page names exactly one. RawScreen is justified-only.

| Template | Use when | Anatomy |
|---|---|---|
| **ListScreen** | index / roster / queue / library | optional stat-strip → filter/search bar → list-rows or `auto-fill` card grid. Four states mandatory. |
| **DetailScreen** | per-item detail | hero identity header (1 primary action) → 2-col (>900px): sticky action/score rail + main working column → grouped collapsible sections. |
| **StepScreen** | multi-step wizard / first-run | progress indicator → one step panel → footer action row (one primary, one exit). Success = inline, not RawScreen. |
| **SettingsScreen** | settings / config | (optional) section-nav → single-column equal-weight cards → inline save toast. A ListScreen variant. |
| **RawScreen** | cinematic one-off only | hand-assembled. Must justify; if >2 pages need it, extract a template. |

### Workspace page → template map

| Page | Template | Notes (from audit) |
|---|---|---|
| `dashboard.html` (Portfolio) | **ListScreen** | Correct. Add differentiated lead card / severity triage ordering, one actionable stat, gauge on completeness, wire filter pills, skeleton + error states. |
| `program.html` (Program) | **DetailScreen** | Currently RawScreen (flat 10-section scroll). Re-template: hero header (1 primary) + sticky action/score rail + work-zone Banner + collapsible "Engagement details" group. |
| `queue.html` (Action queue) | **ListScreen** | Correct (grouped by urgency). Add loading + error states; make the row the click target with one action; encode meta as chips not a mono log line. |
| `new-engagement.html` (wizard) | **StepScreen** | Correct. Fix: native radio/checkbox semantics on selection cards, label `for`/`id`, focus ring, DisabledButton token + form hint, inline ErrorState on launch (no `alert()`). |
| `setup.html` (first-run) | **StepScreen** | Currently re-implements the system inline. Bind to `shared/ds.css`; keep only the brand-kit editor local. |
| `settings.html` | **SettingsScreen** | Single-column equal-weight cards; integration rows get a Connect action or "Coming soon"; branded confirm Dialog; gate dev toggle. |
| `team.html` | **ListScreen** | Switch fixed 3-up grid → dense `.list-row` roster (scales to "unlimited seats"); cards link to operator DetailScreen; wire Invite CTA or gate it. |
| `admin.html` | **ListScreen** + create panel | Currently RawScreen string-concat. `.org-card` rows + `.operator-row` + branded Dialogs; loading + error states (never swallow fetch error into empty). |
| `index.html` (login) | **StepScreen** (single) | Already close; bind to shared tokens. |

Studio pages (dashboard, investability) map the same way: dashboard = **ListScreen**, investability = **DetailScreen** (hero score on a `.panel-inverse`). The VSS 7×5 scorecard becomes one shared `renderVSSScorecard(snapshot, {variant})` — extinguishing the 3-way class divergence and 42 band-colour literals.

---

## Interaction rules (ecosystem-wide)

- **Hover:** lift via `transform:translateY(-1px)` + shadow step. Colour shifts on `--dur-base`. Never `transition: all`.
- **Press:** `transform:translateY(0)` on `:active`, `--dur-fast`.
- **Focus:** the global `:focus-visible` ring (2px `--primary`, 2px offset) on every interactive element. No `outline:none` without a replacement ring.
- **Loading:** skeleton matching the known layout, never a spinner for a known shape. Distinguish loading from confirmed-empty — gate the empty state behind "load succeeded AND zero items".
- **Empty:** the single `.empty-state` pattern; one CTA; warm copy ("Awaiting brief", "Nothing for you to do") not curt negatives or `TBD`.
- **Error:** dedicated `.error-state` / `.banner-danger` with a Retry that re-runs the fetch. Never `alert()`, never `catch → []` rendered as empty, never raw error codes shown to the operator (log them, show plain language).
- **Toasts:** light surface card + icon (success = teal/green check), `--shadow-md`. Distinct from any dev chrome. Enters via opacity + `translateY`.
- **Destructive:** branded Modal. Catastrophic actions (delete org, clear workspace) use the type-the-name `.modal-danger` pattern; the confirm is `.btn-danger`, disabled until the name matches.
- **Transitions:** `transform` and `opacity` only. `--ease` (spring) for selection/entry, `--ease-out` for hover/fades/bars. Timings: `--dur-fast` press, `--dur-base` hover, `--dur-slow` bars/count-up. All decorative motion disables under `prefers-reduced-motion`.
- **Dev/demo chrome:** the `.dev-toggle`, "DEMO_MODE ready", "sample queue (demo data)" must be gated behind `__DEV__` / `mode !== 'live'` and never overlap content. In production builds they do not render.

---

## Rollout

**1. Extract `shared/ds.css`.** Move the Foundations `:root` and all 14 component blocks here. This file is the only place tokens and primitives are defined.

**2. Both shells import it first.**
```html
<!-- workspace/*.html AND studio/*.html, before the shell stylesheet -->
<link rel="stylesheet" href="../shared/ds.css">
<link rel="stylesheet" href="./styles.css">  <!-- shell-only rules now -->
```
`workspace/styles.css` and `studio/styles.css` keep **only** shell-specific layout (sidebar vs tabnav, topbar lockup). Every `.card` / `.btn` / `.pill` / `.eyebrow` / `.section-*` / `.stat-*` / `.avatar` / `.progress` definition is deleted from both and inherited from `shared/ds.css`. Reconcile the forks: `--radius-card` → 16, button hover → translateY (not opacity), one `.pill` spec.

**3. Extract shared JS modules** (the audit's reuse findings): `shared/util.js` (`esc()` — kills 6 copies), `shared/shell.js` (`renderTopbar`, `renderAvatar`), `shared/investability-view.js` (`renderVSSScorecard(snapshot,{variant})`, `bandColor()`, `renderStrengthenSuggestions()`), `shared/hub-card.js`, `shared/brand-kit.js` (shared by `setup.html` + `settings.html`). Set `--primary-rgb` in the Workspace runtime theming (it currently only sets `--primary`).

**4. Per-org theming stays runtime.** `app.js` / `studio/app.js` inject `--primary` + `--primary-rgb` (and optionally `--accent`) at `:root` for white-label. Because every component reads the token, an org colour flows everywhere with zero per-page edits. Compute a contrast guard: if white-on-brand drops below 4.5:1, flip CTA text to `--text`.

**5. Extend to the OS marketing site.** The marketing site imports the same `shared/ds.css` for tokens (OS blue + teal, type scale, radii, motion) but layers its own neumorphic elevation tokens (`--shadow-brand` glow, prominent floating surfaces per `CLAUDE.md`) on top. The token layer is shared; the marketing site's hero/neumorphic treatments are additive, never a fork of the primitives. Keep the agency and OS sites uncrosslinked per existing memory.

**6. Enforcement.** Lint for hardcoded hex in markup and page-local CSS (allow only inside `shared/ds.css`). Target metrics: `program.html` inline `style=` 114 → <25; band-colour literals 42 → 0; `esc()` definitions 6 → 1; token vocabularies 3 → 1.

---

*End of Ventrify Design System v1.*
