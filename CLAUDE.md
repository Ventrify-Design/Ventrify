# CLAUDE.md — Frontend Website Rules

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `python3 -m http.server 3000` (serves the project root at `http://localhost:3000`)
- Run in the background. If port 3000 is already in use, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed locally via `node_modules/puppeteer`. Chrome is at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing
- **Screenshot at both desktop (1440px) and mobile (390px) widths** — check both before marking any page as done.

## Output Defaults
- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive — write mobile styles first, then layer on desktop with media queries

## Brand System
These are the established brand tokens — use them everywhere, do not invent new values.

**CSS Custom Properties:**
```
--brand: #6E3AFA        (primary purple)
--brand-light: #9B6FFF  (lighter purple — gradients, accents)
--accent: #00B8A0       (teal — labels, highlights, success — darkened for light bg contrast)
--bg: #E8ECF1           (page background — warm light gray, neumorphism base)
--surface: #F0F4F8      (card/section background — slightly lighter than bg)
--surface-2: #FFFFFF    (highest elevation — pure white)
--text: #1A1A2E         (primary text — near-black)
--muted: #6B7594        (secondary text — medium gray-blue)
--border: rgba(0,0,0,0.06)  (subtle borders where needed)
```

**Typography:**
- Headings: `'Space Grotesk', sans-serif` — tight tracking (`-0.02em`), weights 500–700
- Body: `'Inter', sans-serif` — weights 300–600, line-height 1.6–1.75
- Load via Google Fonts CDN. Use `font-display: swap` to prevent layout shift.

**Theme:** Light mode. All designs assume light background.

**Neumorphic shadows (light mode):**
```css
/* Raised */
box-shadow: 6px 6px 14px rgba(0,0,0,0.07), -6px -6px 14px rgba(255,255,255,0.8);
/* Inset */
box-shadow: inset 3px 3px 7px rgba(0,0,0,0.07), inset -3px -3px 7px rgba(255,255,255,0.8);
/* Prominent */
box-shadow: 10px 10px 24px rgba(0,0,0,0.1), -10px -10px 24px rgba(255,255,255,0.9), 0 0 40px rgba(110,58,250,0.06);
```

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- The primary logo is `ventrify.svg` in the project root. Always use it for nav and footer.

## Mobile Rules
Mobile is not an afterthought — every page must work perfectly at 390px width.

**Breakpoints (3-tier system):**
- `≤640px` — Mobile: single column, hamburger nav, stacked cards
- `641–900px` — Tablet: 2-column grids, condensed spacing
- `>900px` — Desktop: full layout

**Touch targets:**
- Minimum 44×44px for all buttons, links, and interactive elements
- Minimum 8px gap between adjacent tap targets

**Font sizes on mobile:**
- Body text: minimum `16px` (prevents iOS auto-zoom on input focus)
- Headings: use `clamp()` for fluid scaling — e.g. `clamp(1.8rem, 5vw, 3.5rem)`
- Never let any text go below `14px` on mobile

**Content stacking:**
- Grids collapse: 3-col → 2-col → 1-col as viewport shrinks
- Side-by-side layouts stack vertically on mobile
- Horizontal stat rows wrap or stack below 640px
- Tier cards stack to full-width on mobile

**Navigation:**
- Desktop: horizontal nav links + CTA button
- Mobile (≤640px): hamburger menu with full-screen overlay
- Mobile menu must prevent body scroll when open

**Spacing on mobile:**
- Section padding: reduce from `5rem 3rem` to `3rem 1.25rem`
- Card padding: reduce from `2.5rem` to `1.5rem`
- Grid gaps: reduce proportionally (e.g. `3rem` → `1.5rem`)

**Testing:**
- Always check pages at 390px, 768px, and 1440px widths before considering done
- Check that no horizontal overflow/scroll exists at any width
- Ensure all text is readable without zooming

## Content Rules
The site should be scannable, not read like an essay. Every section should communicate its point in under 5 seconds of scanning.

**Paragraph length:**
- Maximum 2–3 sentences per paragraph
- If a paragraph exceeds 3 lines on desktop, break it up
- Walls of text lose visitors — if it looks dense, it is dense

**Lists over prose:**
- Any time you have 3+ items, features, or deliverables → use a bulleted/icon list or cards, not a paragraph
- Use checkmark lists for feature/deliverable enumeration
- Use numbered steps for sequential processes

**Visual anchors:**
- Every text-heavy section needs a visual counterweight: icon, stat number, illustration, card grid, or timeline
- Never have two consecutive sections that are both pure text — alternate with visual elements
- Use accent-coloured eyebrow labels (`s-label`) above every section heading

**Heading hierarchy:**
- Every section: eyebrow label (small, uppercase, teal) → H2 heading (large, Orbitron) → 1-line subtitle (muted) → content
- Keep H2 headings to 6 words or fewer where possible
- Subtitles: 1 sentence max, in `var(--muted)` colour

**Stat/number callouts:**
- When you have quantifiable data (weeks, deliverables, percentages), display it as large Orbitron numbers — not buried in prose
- Format: large number + short label beneath

**Cards:**
- Use cards (surface background + border + border-radius) to break up content into digestible chunks
- Card titles: Orbitron, bold, 1 line
- Card body: Inter, muted colour, 2–3 lines max

## Neumorphic Visual System (Dark Mode)
All surfaces use soft shadow pairs to create a "pushed out from the background" or "pressed in" effect. No flat borders — depth comes from shadows.

**Raised surface (cards, buttons, nav):**
```css
background: var(--surface);
border: none;
border-radius: 16px;
box-shadow:
  6px 6px 14px rgba(0, 0, 0, 0.45),
  -6px -6px 14px rgba(255, 255, 255, 0.03);
```

**Inset/recessed surface (inputs, search fields, recessed containers):**
```css
background: var(--bg);
border: none;
border-radius: 12px;
box-shadow:
  inset 3px 3px 7px rgba(0, 0, 0, 0.45),
  inset -3px -3px 7px rgba(255, 255, 255, 0.03);
```

**Prominent/floating surface (CTAs, hero cards, modals):**
```css
background: var(--surface-2);
border-radius: 20px;
box-shadow:
  10px 10px 24px rgba(0, 0, 0, 0.5),
  -10px -10px 24px rgba(255, 255, 255, 0.025),
  0 0 40px rgba(110, 58, 250, 0.08);
```

**Button states:**
```css
/* Default — raised */
.btn {
  box-shadow: 4px 4px 10px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.025);
}
/* Hover — slightly more raised */
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 6px 6px 16px rgba(0,0,0,0.45), -6px -6px 16px rgba(255,255,255,0.03);
}
/* Active/pressed — inset */
.btn:active {
  transform: translateY(0);
  box-shadow: inset 2px 2px 6px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(255,255,255,0.02);
}
```

**Rules:**
- Remove all `border: 1px solid var(--border)` from cards and surfaces — use shadows for depth
- Keep subtle borders only on dividers (between list items, table rows, nav bottom)
- Border-radius: 16px for cards, 12px for inputs/small elements, 20-24px for large containers (CTA banners)
- All interactive elements must have visible neumorphic state changes (raised → pressed)
- Brand-coloured glow (`rgba(110,58,250,0.08)`) can be added as a third shadow layer on prominent elements
- Accent glow (`rgba(0,229,200,0.06)`) on success/highlighted elements

## Section Sizing Rules
Every section must feel intentional and proportionate. No section should look like an afterthought.

**Minimum section presence:**
- Every content section must have at least `min-height: 400px` (desktop) to feel substantial
- Hero sections: `min-height: 90vh`
- Feature/deliverable grids: cards should be large enough to breathe — minimum `padding: 2rem` with `min-height: 160px`
- Stat callouts should use `font-size: clamp(2.4rem, 5vw, 3.5rem)` to feel impactful

**Visual weight balance:**
- If a section has a heading + subtitle + grid of cards, the cards should take up at least 60% of the section's visual weight
- Grids with 10+ items should use a 5-column or 4-column layout (desktop), never squeeze into 3
- Single-item sections (one stat, one quote) should be centred with generous whitespace, not crammed

**Feature/deliverable showcase sections:**
- When listing deliverables or features, use icon + title + description cards in a generous grid
- Each card should have an icon or visual marker — never just text
- Cards should have enough internal space that the content doesn't feel cramped

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Use the brand system above.
- **Shadows:** Use the neumorphic shadow system above. Never use flat `shadow-md` or single-layer shadows.
- **Typography:** Orbitron for headings, Inter for body. No exceptions. Tight tracking on large headings, generous line-height on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth (already in `body::after`).
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use `cubic-bezier(0.34,1.56,0.64,1)` for spring-style easing.
- **Interactive states:** Every clickable element needs visible neumorphic state changes (raised → hover → pressed). No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Three neumorphic levels: recessed (inset shadow) → raised (standard shadow) → floating (prominent shadow + brand glow).

## Accessibility & Performance
- Add `loading="lazy"` to all images below the fold
- Use semantic HTML: `<main>`, `<section>`, `<article>`, `<nav>`, `<footer>`
- All images must have descriptive `alt` text
- Ensure colour contrast meets WCAG AA (4.5:1 for body text, 3:1 for large text)
- `var(--text)` on `var(--bg)` passes — `var(--muted)` on `var(--bg)` passes at larger sizes but check small text
- Every page needs: `<title>`, `<meta name="description">`, and OG meta tags

## Hard Rules
- Do not add sections, features, or content not in the reference (when a reference is provided)
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary colour
- Do not write paragraphs longer than 3 sentences
- Do not create text-only sections without visual anchors
- Do not ship a page without checking it at mobile width (390px)
