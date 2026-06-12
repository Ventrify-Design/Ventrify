# Ventrify Workspace — Shell Spec

> The reusable application shell (topbar + sidebar + content frame) for the Ventrify OS Operator Workspace. This is normative. Where `workspace/styles.css` disagrees, the implementation is wrong and migrates to this. Tokens reference the Ventrify Design System v1 (`design/ventrify-design-system.md`). Implementation-ready: a build engineer should produce a pixel-correct, seam-free shell from the CSS below without asking a design question.

---

## 1. Diagnosis (what is broken, and why)

The operator's complaint — "the side nav has a break at the top, a gap between the top nav and the side nav, and because the side nav is on a white background it looks broken" — is two compounding defects:

### Defect A — the dead white band (the gap)

`workspace/styles.css` sets `--topbar-h: 160px` (line 44). The shell is a CSS grid:

```css
.app-shell {
  grid-template-rows: var(--topbar-h) 1fr;   /* reserves a 160px topbar row */
  grid-template-areas: "topbar topbar" "sidebar main";
}
```

The grid therefore reserves a **160px** row for the topbar. But the topbar's actual content (lockup mark 38px + 6px padding, utility links) renders only **~64–72px** tall. The `.topbar` element stretches to fill its 160px grid cell, so its bottom border lands at 160px — and the sidebar (which starts at the second grid row, i.e. y=160px) begins **~90px lower than the visible topbar content**. That ~90px strip is empty white topbar above an empty white sidebar start: a seamless dead band with no edge, no content, no reason to exist. To the eye it reads as "the sidebar is detached and floating ~90px too low." The DS already specifies the fix: `--topbar-h: 64px`.

### Defect B — three whites with no chrome logic (the "broken" look)

- Topbar: `background: var(--surface)` = `#FFFFFF`
- Sidebar: `background: var(--surface)` = `#FFFFFF`
- Content: `background: var(--bg)` = `#FAFAFB`

The topbar and sidebar are pure white; the content is a barely-different off-white. There is no figure/ground relationship that tells the eye "topbar + sidebar are ONE chrome frame, content is the page inside it." The white sidebar rail just bleeds into the white topbar with only a hairline `border-right`, so it reads as a floating white panel rather than the left arm of a connected chrome L. Premium shells (Linear, Notion, Stripe, Vercel) resolve this by giving the chrome a single, distinct, consistent surface tone that is **visibly one piece** and visibly **behind** (or framing) the content — not three near-identical whites fighting each other.

### Diagnosis summary

| Symptom | Cause | Fix |
|---|---|---|
| ~90px gap below topbar before sidebar starts | `--topbar-h: 160px`, content is ~64px | `--topbar-h: 64px` (DS value) |
| Sidebar looks detached / floating | chrome and content are both ~white; no shared chrome surface | chrome (topbar+sidebar) share `--surface` white; content sits on `--bg` gray and is **inset** with a hairline + soft shadow so the chrome frames it |
| Topbar↔sidebar seam mismatch | topbar bottom-border and sidebar right-border meet at an unresolved corner | a single shared `--chrome-border` runs continuously; sidebar top butts flush to topbar bottom (no padding-top, no gap) forming the connected L |

---

## 2. The design decision (the chrome model + rationale)

**Decision: White connected chrome / inset gray content.**

The topbar and the sidebar are **one continuous white chrome frame** (the connected L-shape used by Linear and Notion). They share one surface (`--surface` `#FFFFFF`), one continuous hairline border (`--chrome-border`), and one elevation plane. The content area sits on the page background (`--bg` `#FAFAFB`) and is visually **recessed inside** the chrome: the chrome's right border (sidebar) and bottom border (topbar) cast a soft inward shadow onto the content, so the content reads as a page *held by* the chrome, not a panel *floating beside* it.

### Why this model (not the alternatives)

- **Why not "sidebar = off-white rail"?** A tinted rail (`--surface-alt`) is a valid pattern (GitHub, older Slack), but it makes the *content* the brightest surface and the chrome recede — good for content-heavy editors, wrong for an operator *console* where the nav is a persistent command surface. We want chrome that feels solid and present, so chrome = brightest (white), content = the calmer gray. This also matches the existing topbar (already white) so the topbar and sidebar unify with **zero** colour change to the topbar — the cheapest path to "one frame."
- **Why content on gray, not white?** If content were also white, there'd be no figure/ground at all (today's bug). Putting content on `--bg` gray + an inset shadow gives the chrome a job: it *frames* the page. The 1.5%-luminance gap between `#FFFFFF` chrome and `#FAFAFB` content is intentionally subtle — enough to separate planes, not enough to look like two themes.
- **Why this is premium, not generic.** The seam is resolved (continuous border + flush corner), the chrome has a single coherent surface, and the content is intentionally inset. That is exactly the "would this ship in Stripe's dashboard" bar: quiet, structural, no decoration doing the work that geometry should.

### New shell-scoped tokens (add to the shell stylesheet, not `ds.css`)

These are shell-composition tokens — they reference DS foundation tokens, they do not invent new colour:

```css
:root {
  /* Shell layout (DS foundation values — corrected) */
  --topbar-h: 64px;              /* WAS 160px — the dead-band bug */
  --sidebar-w: 248px;            /* DS --sidebar-w */
  --content-max: 1320px;         /* DS --content-max */

  /* Shell chrome composition */
  --chrome-surface: var(--surface);              /* #FFFFFF — topbar + sidebar share this */
  --chrome-border:  var(--border-strong);        /* rgba(0,0,0,0.10) — the ONE continuous chrome edge */
  --chrome-elevation: 0 1px 0 rgba(0,0,0,0.02);  /* topbar hairline lift, no heavy drop shadow */

  /* Content inset — the soft recess the chrome casts onto the page */
  --content-inset-shadow:
    inset 1px 0 0 rgba(0,0,0,0.04),              /* meets the sidebar's right edge */
    inset 0 1px 0 rgba(0,0,0,0.03),              /* meets the topbar's bottom edge */
    inset 6px 6px 14px -10px rgba(0,0,0,0.10);   /* soft inward falloff at the top-left corner */
}
```

---

## 3. App shell layout — `.app-shell`

The grid reserves an exact 64px topbar row and a 248px sidebar column. The topbar spans both columns (it is the full-width arm of the L); the sidebar occupies the left column from row 2 down. Because `--topbar-h` is now the *true* content height, the sidebar's top edge sits flush against the topbar's bottom border — no gap.

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  grid-template-rows: var(--topbar-h) 1fr;
  grid-template-areas:
    "topbar topbar"
    "sidebar main";
  min-height: 100vh;
  background: var(--chrome-surface);   /* chrome plane is the shell's base; content paints gray on top */
}
```

Rationale: setting the shell background to the chrome white means any sub-pixel rounding between the topbar row and the sidebar row reveals white-on-white, never a gray seam. The content area paints its own `--bg` on top.

---

## 4. Topbar — `.topbar`

64px tall, full width, sticky. Shares the chrome surface and the single continuous border. No heavy drop shadow — a 1px hairline lift only, so it reads as the same plane as the sidebar, not a separate floating bar.

```css
.topbar {
  grid-area: topbar;
  height: var(--topbar-h);              /* exactly 64px — kills the dead band */
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-5);            /* 24px inline */
  background: var(--chrome-surface);
  border-bottom: 1px solid var(--chrome-border);
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: var(--chrome-elevation);
}
```

### 4a. The lockup (Ventrify OS + org) — left cluster

Left-anchored. Order: Ventrify OS mark + wordmark → vertical divider → org avatar + org name. Reads "Ventrify OS · {Org}". The Ventrify mark sits on near-black so it never competes with the org's brand colour.

```css
.topbar-lockup { display: inline-flex; align-items: center; gap: var(--space-3); }

.topbar-lockup-item {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: 6px 8px; border-radius: var(--radius-sm);
  color: inherit; text-decoration: none;
  transition: background var(--dur-base) var(--ease-out);
}
a.topbar-lockup-item:hover { background: var(--surface-alt); }

.topbar-lockup-mark {
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
  font: 700 0.9rem/1 var(--font-heading); color: #fff;
}
.topbar-lockup-mark img { width: 100%; height: 100%; object-fit: contain; }
.topbar-lockup-mark-ventrify { background: var(--text); color: #fff; }  /* near-black, neutral */

.topbar-lockup-name {
  font: var(--t-h4); color: var(--text); letter-spacing: var(--tracking-tight);
  white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis;
}
.topbar-lockup-name .lockup-name-weak { font-weight: 500; color: var(--text-muted); }

.topbar-lockup-divider {
  width: 1px; height: 24px; background: var(--chrome-border); margin: 0 var(--space-1);
}
```

Token bindings:

| Layer | Token | Colour | Notes |
|---|---|---|---|
| Ventrify mark | 30×30, `--radius-sm` | `#fff` on `--text` | neutral near-black, never brand |
| Org avatar | `.avatar` (30px) DS component | `#fff` on org colour | the only branded mark in the chrome |
| Lockup name | `--t-h4` | `--text` | org name strong, "OS" weak via `.lockup-name-weak` |
| Divider | 1px × 24px | `--chrome-border` | same edge token as the chrome border |

### 4b. The utility cluster — right cluster

Pushed right by a flex spacer. Ghost-style text links (Docs, Help, Sign out) + a hairline divider + the operator avatar. Links use `--text-muted` at rest, `--text` on hover with a `--surface-alt` tint — the same hover language as the lockup and the sidebar, so the whole chrome shares one interaction grammar.

```css
.topbar-spacer { flex: 1; }

.topbar-utility { display: inline-flex; align-items: center; gap: var(--space-1); }

.topbar-utility-link {
  font: var(--t-caption); color: var(--text-muted);
  padding: 8px 12px; border-radius: var(--radius-sm); min-height: 36px;
  display: inline-flex; align-items: center;
  transition: background var(--dur-base) var(--ease-out),
              color var(--dur-base) var(--ease-out);
}
.topbar-utility-link:hover { background: var(--surface-alt); color: var(--text); }

.topbar-divider { width: 1px; height: 22px; background: var(--chrome-border); margin: 0 var(--space-2); }

.topbar-avatar {  /* operator — uses DS .avatar sizing; ring ties it to the chrome surface */
  width: 32px; height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font: 600 0.78rem/1 var(--font-body); flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--chrome-surface), 0 0 0 3px var(--chrome-border);
}
```

---

## 5. Sidebar — `.sidebar`

Same surface as the topbar (`--chrome-surface`), same border token on its right edge — the two borders meet at the top-left corner of the content area to form the continuous chrome L. **No `padding-top`, no `margin-top` on the first element, no `gap` at the top** — the first section label butts flush to the topbar's bottom border. The sidebar scrolls independently if nav overflows, but the chrome surface is fixed full-height.

```css
.sidebar {
  grid-area: sidebar;
  background: var(--chrome-surface);
  border-right: 1px solid var(--chrome-border);
  padding: var(--space-3) var(--space-3) var(--space-5);  /* top 12px — small, deliberate, NOT a gap */
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
  position: sticky; top: var(--topbar-h);                 /* pins below the topbar; never re-creates the band */
  height: calc(100vh - var(--topbar-h));
}
```

Rationale for `top: var(--topbar-h)` + matching height: the sidebar is sticky *below* the topbar, so the topbar's 64px and the sidebar's start are bound to the same token — they can never drift apart again. If `--topbar-h` ever changes, both move together.

### 5a. Section labels — `.sidebar-section`

Mono micro-caps, tertiary colour. The first one gets a slightly larger top inset to separate it from the topbar seam without re-introducing a gap.

```css
.sidebar-section {
  font: var(--t-eyebrow); letter-spacing: var(--tracking-eyebrow);
  text-transform: uppercase; color: var(--text-subtle);
  padding: var(--space-2) var(--space-3) var(--space-1);
  margin-top: var(--space-4);
}
.sidebar-section:first-of-type { margin-top: var(--space-2); }
```

### 5b. Nav item anatomy — `.sidebar-link` (default / hover / active)

Icon (20px) + label + optional count badge pushed right. Full-width rounded hit area. The active indicator is the brand-tinted fill PLUS a 3px brand bar flush to the sidebar's inner edge — the Linear/Notion active-rail signature.

```css
.sidebar-link {
  display: flex; align-items: center; gap: var(--space-3);
  padding: 9px var(--space-3); min-height: 40px;        /* 40px row — comfortable, dense-console scale */
  font: var(--t-body-sm); font-weight: 500; color: var(--text-muted);
  border-radius: var(--radius-md);
  position: relative;
  transition: background var(--dur-base) var(--ease-out),
              color var(--dur-base) var(--ease-out);
}

/* hover — neutral tint + text darkens; same language as topbar links */
.sidebar-link:hover { background: var(--surface-alt); color: var(--text); }

/* active — brand-tinted fill + brand text + brand rail */
.sidebar-link.active { background: rgba(var(--primary-rgb), 0.08); color: var(--primary); font-weight: 600; }
.sidebar-link.active::before {
  content: ''; position: absolute; left: calc(-1 * var(--space-3)); top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 18px; background: var(--primary); border-radius: 0 2px 2px 0;
}

.sidebar-link-icon {
  width: 20px; height: 20px; flex-shrink: 0; opacity: 0.75;
  display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem;
}
.sidebar-link.active .sidebar-link-icon { opacity: 1; }

/* count badge */
.sidebar-link .badge {
  margin-left: auto; font: var(--t-eyebrow); font-weight: 600;
  padding: 2px 8px; min-width: 22px; text-align: center; border-radius: var(--radius-pill);
  background: rgba(var(--primary-rgb), 0.10); color: var(--primary);
}
.sidebar-link.active .badge { background: var(--primary); color: #fff; }
```

| State | Background | Text | Indicator |
|---|---|---|---|
| Default | transparent | `--text-muted` | icon opacity 0.75 |
| Hover | `--surface-alt` | `--text` | — |
| Active | `rgba(--primary-rgb,0.08)` | `--primary` (600) | 3px `--primary` rail at inner edge + icon opacity 1 |
| Focus-visible | inherits DS global ring (2px `--primary`, 2px offset) | | |

---

## 6. Content area — `.main`

Sits on `--bg` gray, inset inside the chrome. The inset shadow makes the chrome's right and bottom edges read as a recess holding the page. Content is centred to `--content-max` with generous, consistent padding.

```css
.main {
  grid-area: main;
  background: var(--bg);
  box-shadow: var(--content-inset-shadow);   /* the chrome frames the page */
  padding: var(--space-7) var(--space-8) var(--space-9);  /* 40 / 48 / 64 */
  overflow-y: auto;
}
.main-inner { max-width: var(--content-max); margin: 0 auto; }
```

Rationale: the `--content-inset-shadow` is the single most important "premium" cue — it is what converts three flat planes into a framed console. It is subtle (max 10% black, falling off over 14px at the corner) so it never looks like a hard drop shadow; it just gives the chrome edges depth.

---

## 7. Mobile — shell collapse (≤ 900px chrome simplification, ≤ 640px overlay)

Two breakpoints. On tablet (≤900px) the sidebar becomes a slide-in drawer behind a hamburger; the topbar stays. On phone (≤640px) the same drawer + a full-screen scrim, the org name in the lockup hides to fit, body-scroll-locks while open.

### 7a. Topbar gains a hamburger (left of the lockup)

```css
.topbar-menu-btn { display: none; }     /* hidden on desktop */

@media (max-width: 900px) {
  .topbar-menu-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; margin-left: calc(-1 * var(--space-1));
    border: none; background: transparent; color: var(--text);
    border-radius: var(--radius-sm); cursor: pointer;
    transition: background var(--dur-base) var(--ease-out);
  }
  .topbar-menu-btn:hover { background: var(--surface-alt); }
}
```

### 7b. Sidebar becomes an off-canvas drawer

The grid drops to a single column; the sidebar leaves the grid flow and becomes a fixed drawer that slides in from the left. It keeps the **same chrome surface and border** so the open drawer still reads as the same chrome — just translated on-screen.

```css
@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-areas: "topbar" "main";
  }

  .sidebar {
    position: fixed; top: var(--topbar-h); left: 0; z-index: 60;
    width: min(84vw, var(--sidebar-w));
    height: calc(100vh - var(--topbar-h));
    transform: translateX(-100%);                /* hidden off-canvas */
    transition: transform var(--dur-base) var(--ease-out);
    box-shadow: var(--shadow-lg);                /* lifts above content when open */
  }
  body.nav-open .sidebar { transform: translateX(0); }

  /* scrim */
  .nav-scrim {
    position: fixed; inset: var(--topbar-h) 0 0 0; z-index: 55;
    background: rgba(15,15,18,0.40);
    opacity: 0; pointer-events: none;
    transition: opacity var(--dur-base) var(--ease-out);
  }
  body.nav-open .nav-scrim { opacity: 1; pointer-events: auto; }

  /* body-scroll-lock while the drawer is open */
  body.nav-open { overflow: hidden; }

  .main { box-shadow: none; padding: var(--space-6) var(--space-5) var(--space-8); }  /* no inset frame when full-width */
}
```

### 7c. Phone refinements (≤ 640px)

```css
@media (max-width: 640px) {
  .topbar { padding: 0 var(--space-4); gap: var(--space-2); }
  .topbar-lockup-name { display: none; }         /* keep the org avatar, drop the name to fit */
  .topbar-lockup-divider { display: none; }
  .topbar-utility-link { padding: 8px 10px; }    /* still ≥44px tall via min-height on parent row */
  .main { padding: var(--space-5) var(--space-4) var(--space-7); }
}
```

### 7d. Behaviour contract (JS, minimal)

- Hamburger toggles `document.body.classList.toggle('nav-open')`.
- The `.nav-scrim` element lives once in the shell markup (right after `.sidebar`); clicking it removes `nav-open`.
- `Esc` removes `nav-open`. Tapping any `.sidebar-link` removes `nav-open` (so navigation closes the drawer).
- On resize above 900px, force-remove `nav-open` (so a drawer left open on rotate doesn't strand the body in `overflow:hidden`).
- The hamburger button carries `aria-expanded` (toggled with the class) and `aria-controls="<sidebar id>"`; the sidebar gets `aria-hidden` mirrored to the open state for screen readers.

---

## 8. Acceptance checklist (the seam is fixed when…)

- [ ] `--topbar-h` is `64px`; the topbar content height equals the reserved grid row (no dead band).
- [ ] Topbar and sidebar share `--chrome-surface` and a single continuous `--chrome-border`; their corner meets flush — the chrome reads as one L.
- [ ] The sidebar has **no** top gap: the first section label / nav row begins within `--space-2` of the topbar's bottom border, with no empty white strip.
- [ ] Content sits on `--bg` (not white) and shows the `--content-inset-shadow` — the chrome visibly frames the page.
- [ ] Sidebar is `position: sticky; top: var(--topbar-h)` so topbar height and sidebar start are bound to one token and can never drift.
- [ ] Active nav item shows the brand fill + the 3px inner-edge rail; hover uses the same `--surface-alt` tint as the topbar links.
- [ ] ≤900px: hamburger appears, sidebar slides in as a drawer over a scrim, body-scroll-locks; ≤640px the org name hides but the avatar stays.
- [ ] No horizontal overflow at 390px, 768px, 1440px.

---

*End of Workspace Shell Spec.*
