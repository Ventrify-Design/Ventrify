# Ventrify Workspace — Design Audit

A consolidated review of the operator-facing Workspace and Studio surfaces against the Linear/Stripe B2B-console bar. Covers nine screens plus two cross-cutting tracks (reuse, copy).

## Executive Summary

**Overall maturity: 5.0 / 10** (mean of nine screen ratings: 6, 5, 5, 6, 5, 6, 4, 5, 4 — reuse and copy tracks scored 4 and 5 separately and reinforce the same gaps).

The Workspace has the right templates almost everywhere — ListScreen for the portfolio/queue/team, StepScreen for the wizard, SettingsScreen for settings. The bones are sound; only Admin and first-run Setup are mis-templated as hand-rolled RawScreens. What holds the product below a shippable bar is **execution debt, not architecture**.

**The single biggest theme: the product reads as a prototype, not a premium console.** This shows up four ways, all repeating across every screen:
1. **Developer leaks on the operator surface** — a floating DEMO MODE / DEMO DATA / RESET pill that overlaps real fields, a raw shell-command block dumped after launch, `DEMO_MODE ready` and `tdk-investability-scorer` rendered as user-facing labels, `localStorage` in a confirm dialog.
2. **No design-system discipline** — three token vocabularies for one language, the investability scorecard built three separate times, `.hub-card` forked across two files, 114 inline-style attributes in `program.html` alone, semantic colours hardcoded as literals that can never flip with org branding.
3. **Incomplete state coverage** — almost every data-dependent screen ships only populated + empty; loading and error states are missing, and several screens collapse a fetch error into the empty state (telling an operator they have "no work" or "zero orgs" when the load actually failed).
4. **Accessibility floor not met** — no global `:focus-visible` ring anywhere, custom div-based controls (swatches, cards, dropzones) that keyboards and screen readers cannot operate, and `--text-subtle` (#9AA0AE, ~2.5:1) carrying load-bearing metadata below the WCAG AA 4.5:1 threshold.

### Top 5 Priorities

| # | Priority | Why it's first |
|---|----------|----------------|
| 1 | **Remove every dev/demo artefact from the operator build** (DEMO MODE pill, DEMO DATA/RESET, shell-command block, `DEMO_MODE ready`, agent-name attribution, `localStorage` copy) behind a `__DEV__` flag | Highest credibility tax; these are visible on first load and overlap required fields. Cheap to fix, disproportionate impact. |
| 2 | **Ship one global `:focus-visible` ring and convert div-controls to real inputs** | WCAG 2.4.7 / 2.1.1 / 4.1.2 launch blockers — the wizard, setup, and settings are literally unusable by keyboard. One rule + the visually-hidden-native-input pattern fixes most of it. |
| 3 | **Complete the four-state contract (loading + error) on every data screen** | A triage queue / admin list that renders "empty" on a failed fetch is a dangerous misrepresentation, not just a polish gap. |
| 4 | **Establish a shared token + primitive layer** (`shared/tokens.css`) and extract the investability view, hub-card, avatar/shell, and `esc()` | Stops the three-vocabulary drift, kills ~42 band-colour literals and the 3× scorecard, and makes every later contrast/colour fix a one-line edit. |
| 5 | **Fix the `--text-subtle` contrast failure globally + introduce metric hierarchy** | Promote load-bearing meta to `--text-muted` (#656565, ~5.7:1); give dashboards one accent KPI and triage-ordered cards so the screens read as consoles, not uniform card fields. |

## Per-Screen Verdicts

| Screen | Current template | Rating | Verdict | Top issue |
|--------|------------------|:------:|---------|-----------|
| Portfolio Dashboard (`dashboard.html`) | ListScreen (correct) | 6 | Needs work | DEMO MODE debug toggle leaking onto operator surface |
| Program detail (`program.html`) | RawScreen → should be **DetailScreen** | 5 | Rebuild layout | No keyboard focus indicator anywhere; flat 11-section equal-weight scroll |
| New Engagement wizard (`new-engagement.html`) | StepScreen (correct) | 5 | Needs work | Selection cards are divs — not keyboard/SR operable (launch blocker) |
| Action queue (`queue.html`) | ListScreen (correct) | 6 | Needs work | No loading/error state — a failed fetch reads as "Queue clear" |
| Settings (`settings.html`) | SettingsScreen (correct) | 5 | Needs work | Dev DEMO DATA/RESET widget ships over production settings; dead-end integration rows |
| Team (`team.html`) | ListScreen (correct) | 6 | Needs work | Hard-capped 3-up grid breaks at 4+ seats; "Invite operator" is a no-op |
| Admin (`admin.html`) | RawScreen → should be **ListScreen** | 4 | Rebuild | Fetch error swallowed into empty state; native alert/confirm/prompt for destructive flows |
| First-run Setup (`setup.html`) | StepScreen (hand-rolled outside system) | 5 | Rebuild | Entire design system re-implemented inline (~290 lines) instead of consuming `styles.css` |
| Reuse (cross-cutting) | — | 4 | — | Three token vocabularies; investability scorecard built 3×; `.hub-card` forked |
| Copy (cross-cutting) | — | 5 | — | Raw shell-command block dumped on operator; no single noun for a unit of work |

Verdict key: **Ship** = AA-clean and on-bar; **Needs work** = right template, fix execution; **Rebuild** = re-template or re-found against the system.

## Consistency & Reuse — Convergence Plan

The two surfaces (Workspace + Studio) and their shared modules currently express one design language in three token vocabularies, with several flagship components implemented multiple times. The fix is a single source-of-truth layer, propagated in dependency order.

### What to extract

| Artefact | Today | Target | Kills |
|----------|-------|--------|-------|
| `shared/tokens.css` | `--primary` (workspace) vs `--brand-primary` (studio) vs site tokens `--brand`/`--accent` in shared modules — rendered only via hardcoded comma-fallbacks | One canonical semantic set (`--primary`, `--primary-rgb`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--text-subtle`, `--border`, `--accent`, `--success`/`--warning`/`--danger` + `-deep` + `-rgb`, `--radius-*`, `--font-*`), `@import`ed by both shells | 12 site-purple (`#6E3AFA` / `110,58,250`) literals inside OS surfaces; the workspace never defining `--primary-rgb` |
| `shared/investability-view.js` | VSS 7×5 scorecard built 3× with diverging classes (`.inv-dim-*` vs `.inv-op-*` vs inline pill) | `renderVSSScorecard(snapshot, {variant})` + `bandColor(band)` helper | The verbatim band ternary in 3 files; ~42 raw band literals (`#00897b` ×10, `#C77700` ×11, `#C0392B` ×21) |
| `shared/hub-card.js` (or shared `.hub-card` block) | `.hub-card` defined in both `workspace/styles.css` (radius 20, min-h 140) and `studio/dashboard.html` (radius 16, min-h 200) | One component; Studio's icon/stats become `data-variant="studio"` | A same-name, same-job, two-file fork guaranteed to drift |
| `shared/shell.js` | Topbar/sidebar/tabnav + avatar hand-typed in JS strings; avatar lockup re-typed 6× with inline sizing | `renderTopbar(ctx)`, `renderAvatar({name,colour,size})` | Per-page `#0036FF` fallback literals; `settings.html` hand-patching topbar DOM |
| `shared/util.js` → `esc()` | `esc`/`escBrief` redeclared in 6 files | One import | 6 copy-paste definitions |
| `shared/brand-kit.js` + shared swatch/dropzone CSS | Color-picker + logo-dropzone duplicated inline in `setup.html` AND mirrored in `styles.css` (author flagged this in a comment) | `renderBrandKitFields(org)` | The acknowledged mirror; setup vs settings drift |
| `.select-card` primitive | Three selectable-card variants (`.tier-radio`, `.brand-card`, inline `new-engagement` cards) | One `.select-card` + `.selected` (::after check) | The inline `rgba(0,54,255,0.05)` third fork |
| Eyebrow / `.btn-danger` / `.callout` / `.pill-accent` primitives | Eyebrow defined ~6× across two stylesheets; danger button inline-hacked in program/settings/admin; assessment panels 100% inline | Add the missing primitives once | `program.html` inline-style count 114 → under ~25 |

### Propagation order

1. **`shared/tokens.css` first** — nothing else is correct until the vocabulary is unified. Align the conflicting `--danger` (workspace `#E0394A` vs studio/literals `#C0392B` — pick ONE). Both shells `@import` it; runtime still injects `--primary` + `--primary-rgb` per org, but the workspace must now also set `--primary-rgb`.
2. **`shared/util.js`** (`esc`) — zero-dependency, unblocks the rendering modules.
3. **Primitive CSS** (`.card`, `.btn` + `.btn-danger`, `.pill` + variants, eyebrow, `.section*`, `.stat-block`, `.avatar`, `.select-card`, `.callout`) into the shared layer; reconcile radius scale (20 vs 14) and button hover (translateY vs opacity) to one decision.
4. **`shared/investability-view.js`** + `bandColor()` — replace all three scorecard builds and the band literals; fold in `renderStrengthenSuggestions(items)` (currently duplicated across both surfaces).
5. **`shared/hub-card.js`**, **`shared/shell.js`/avatar**, **`shared/brand-kit.js`** — these depend on tokens + primitives being settled.
6. **Strip inline styles** — `program.html` (114 → ~25), then `studio/investability.html` (29), down to data-only attributes.

## Interaction & States

Cross-cutting gaps, ranked by how often they recur:

- **Focus (universal, high):** No global `:focus-visible` rule exists. Every `:focus` in the codebase is `outline:none` on inputs. `.btn`, `.hub-card`, `.team-card`, `.action-card`, selection cards, swatches, and back-links render zero keyboard focus state. **Fix once:** `:where(a,button,[role=button],.hub-card,input,select):focus-visible { outline:2px solid var(--primary); outline-offset:2px; border-radius:inherit; }`.
- **Loading (high):** `dashboard`, `program`, `queue`, `admin`, and `setup` await async data but code only empty + populated. Render skeletons matching the known layout (greyed stat blocks, ghost cards, ghost rows) — skeletons not spinners, because the layout is known.
- **Error (high):** `queue.html` and `admin.html` collapse a fetch failure into the empty state — the most dangerous failure mode for a triage queue / super-admin org list. Add a distinct ErrorState (icon + "Could not load…" + Retry) gated so empty only renders on a *confirmed* zero-result read.
- **Hover (medium):** `.team-card`, `.action-card`, settings rows, and integration pills are the screens' primary objects but have no hover affordance — they read as static admin surfaces. Add the existing card-hover lift / row-tint.
- **Dead controls (medium):** Dashboard filter pills, dashboard search, "Invite operator", "View full timeline →" (`href="#"`), and inert "View hub →" spans all look interactive but do nothing. Wire them or render them visibly disabled — a console must never ship a control that lies about being clickable.
- **Native dialogs (medium):** `alert()` / `confirm()` / `prompt()` used for create errors, logo-remove, clear-all-data, delete-org type-to-confirm. Replace with a branded ConfirmDialog; the destructive type-the-name flow is the highest-stakes interaction and is currently a raw `window.prompt`.
- **Disabled state (low):** The wizard's Continue button uses `opacity:0.5` (washed lilac) with no explanation of which field is missing. Use a real DisabledButton token + `aria-disabled` + a one-line FormHint.
- **Full-page reloads (low):** Logo upload and admin mutations call `window.location.reload()`, contradicting "Changes apply live" and losing scroll. Re-render only the affected card in place.

## Copy & Voice

The product needs one noun, no developer leaks, and outcome-first subtitles. Key rewrites:

| Where | Before | After |
|-------|--------|-------|
| `new-engagement.html` launch | Full `cp -R … / git init / gh repo create / claude code .` shell recipe + "copy and run this on the operator's machine" | Delete the block. End at "…Phase 0 kicks off automatically." Gate any manual path behind a collapsed "Advanced: self-host" disclosure. |
| Whole product | "Portfolio" / "program" / "engagement" / "venture" / "assessment" used interchangeably | Pick **engagement** as the unit of delivery; "venture" only for the founder's company; never "program". "Open program →" → "Open engagement →", "All programs" → "All engagements". |
| `program.html:662` | `DEMO_MODE ready` (raw constant as a status pill) | `Demo build ready` |
| `program.html:453` | `Computed by tdk-investability-scorer · N/35 rated` | `Auto-scored · N of 35 signals rated` |
| `program.html:419` | `VSS v2 (TDK 7×5) — the founder sees this…` | `The investor-readiness score the founder sees in their Studio. Updates at every gate.` |
| `queue.html:114` | `Ranked by workflow-orchestrator · sample queue (demo data)` | `Prioritised automatically · sample data` |
| `dashboard.html:44` | "Stand up your first one in under sixty seconds" + four fake `MM:SS` stopwatch tags | "Create your first one in a few clicks — we scaffold the rest." Replace tags with "Brief · Hubs · Agents · Live". |
| `program.html:656/658` | "No one-liner yet." / "Industry TBD" | "Awaiting the founder's brief — pitch lands here once they submit." / "Industry · awaiting brief" (mirror dashboard's warmer "Awaiting brief"). |
| `dashboard.html:97` | "Read the tour →" (a Learn-More in disguise) | "See how it works →" (parallel action-promise CTAs). |
| `settings.html:168` | "Wiring goes live in the next milestone." | "Connect these to provision engagement repos and Studio access automatically." |
| `new-engagement.html:367` | "…tools/brief-sync.js fills in brief.md and engagement.json…" | "The brief flows straight into the engagement — research agents pick it up automatically." |
| `app.js:301` | confirm "Clear all workspace localStorage and reload?" | "Clear all Workspace data on this device and start fresh" |
| Role nouns | "Program manager" / "Program Lead" / "Assessor" / "operator" | Standardise on **operator** ("lead operator" for owner); keep "Assessor" only inside the assessment flow. |

**Preserve as voice reference (do not change):** "Nothing for you to do.", "Last run errored: … Safe to retry.", "nothing reaches the founder until you send it.", "This can't be undone." Short, declarative, concrete, reassuring about consequences — rewrite the jargon subtitles toward this register.

## Accessibility (WCAG AA)

| Failure | Where | WCAG | Fix |
|---------|-------|------|-----|
| `--text-subtle` #9AA0AE on white ≈ 2.4–2.6:1 carries load-bearing meta (card meta rows, queue `.action-meta`, timeline timestamps, hub status, step labels, placeholders) | dashboard, queue, program, wizard, setup | 1.4.3 | Promote to `--text-muted` (#656565, ~5.7:1); reserve `--text-subtle` for ≥18px or decorative glyphs only — fix once at the token. |
| No visible keyboard focus on any interactive element | every screen | 2.4.7 | Global `:focus-visible` ring (see Interaction). |
| Selection cards / hub checkboxes / brand cards / swatches / logo dropzone are `<div>`s with click handlers — no role, tabindex, `aria-checked`, or key handler | wizard, setup, settings | 2.1.1, 4.1.2 | Visually-hidden native `<input radio/checkbox>` + `<label>` card pattern, or `role=radiogroup/radio` + `role=checkbox` with roving focus + Enter/Space. |
| Form labels not associated (`<label>` with no `for=`, not wrapping input) | wizard, admin | 1.3.1, 3.3.2 | Add `for=`/`id` or wrap the input; add `aria-label` to placeholder-only inputs (e.g. search "Search programs or founders", admin add-operator email). |
| Selection state conveyed by colour/border only | wizard tiers, settings swatches, team roles | 1.4.1 | Add a non-colour affordance (check glyph, `aria-checked`). |
| Decorative glyph icons (✓ ⚠ 🔍 emoji) announced by SR | queue, dashboard search | 1.1.1 | `aria-hidden="true"`; rely on adjacent text for the name. |
| Delete-org `--danger` #E0394A on white at 0.8rem ≈ 4.33:1 | admin | 1.4.3 | Darken to ≥4.5:1 (~#C42233), or bolder weight / danger-tinted fill. |
| No error identification in text (errors via `alert()` / silent `return`) | setup, admin, wizard | 3.3.1 | Inline `--danger` helper text + `aria-invalid` + `aria-describedby` + focus to first invalid field. |

## Responsive

- **Team grid (high):** `repeat(3, 1fr)` with no wrap, despite "Cohort tier — unlimited operator seats." A 4th seat produces a 3+1 orphan row. Switch to a dense list-row roster, or `repeat(auto-fill, minmax(280px, 1fr))`.
- **Admin create grid (low):** inline `grid-template-columns:1fr 1fr` can't be reached by the stylesheet's ≤960px collapse rules, so name/slug stay cramped on narrow widths. Move to a real `.admin-create-grid` class that collapses at ≤640px.
- **Dashboard mobile stat strip (low):** four KPI cards stay 2-col at 390px and push the first program card far below the fold — the opposite of the mobile triage job. Collapse to a compact horizontal-scroll row or 2×2 with reduced padding; hide the "Portfolio completeness" subcaption behind the number; get at least one program card into the first viewport.
- General: every inline-grid that bypasses the breakpoint system should move to a named class so it inherits the console's responsive rules.

## Prioritised Fix List

| # | Severity | Area | Issue | Fix | Effort |
|---|----------|------|-------|-----|:------:|
| 1 | High | All screens | DEMO MODE / DEMO DATA / RESET dev widgets render on operator surfaces, overlapping required fields | Gate behind `__DEV__`; never paint in a live build | S |
| 2 | High | Copy / wizard | Raw shell-command block dumped on operator after launch | Delete block; end at "…Phase 0 kicks off automatically" or hide behind "Advanced" disclosure | S |
| 3 | High | All screens | No global keyboard focus indicator (WCAG 2.4.7) | One `:focus-visible` token applied to btns, links, cards | S |
| 4 | High | Wizard / setup / settings | Div-based selection cards, swatches, dropzones not keyboard/SR operable (WCAG 2.1.1/4.1.2) | Visually-hidden native input + label pattern, or radiogroup/checkbox roles | M |
| 5 | High | Queue / admin | Loading absent; fetch error collapses into empty state | Add skeleton loading + distinct ErrorState + Retry; gate empty on confirmed-zero | M |
| 6 | High | Reuse | Three token vocabularies; shared modules render against undefined site tokens | Create `shared/tokens.css`; both shells `@import`; align `--danger` | M |
| 7 | High | Reuse | Investability VSS scorecard built 3× with ~42 band-colour literals | Extract `shared/investability-view.js` + `bandColor()` | M |
| 8 | High | All screens | `--text-subtle` (#9AA0AE, ~2.5:1) on load-bearing meta fails AA | Promote to `--text-muted` at the token level | S |
| 9 | High | Program copy | `DEMO_MODE ready`, `tdk-investability-scorer`, L1/L2/L3, TDK 7×5 leak into operator copy | Rewrite to outcome-first, demote agent names to "auto-generated" | S |
| 10 | High | Dashboard | Four identical stat cards + flat program grid — no metric/triage hierarchy | One accent KPI; sort by health severity; status rail on at-risk cards | M |
| 11 | High | Team | 3-up grid breaks at 4+ seats; "Invite operator" is a no-op | Dense list-row roster (or auto-fill); wire invite flow or gate behind DEMO_MODE | M |
| 12 | High | Admin / settings | Native `alert`/`confirm`/`prompt` for destructive flows | Branded ConfirmDialog; type-the-name pattern for delete-org | M |
| 13 | High | Setup | Entire design system re-implemented inline (~290 lines) | Bind to `styles.css` (wiz-field/label/input, btn, s-label) | M |
| 14 | High | Setup | Required form has no error state — invalid submit fails silently | Per-field inline error + `aria-invalid` + focus + live validity gating | M |
| 15 | High | Admin | RawScreen of inline HTML; should be ListScreen of OrgCard components | Extract `.org-card`/`.operator-row`/`.admin-create-panel` classes | M |
| 16 | Medium | Program | Flat 11-section equal-weight scroll; should be a DetailScreen | 2-col layout with sticky action rail + "work zone" elevation | L |
| 17 | Medium | Queue / team | Two co-equal actions per row competing | Make card the click target; one primary per row | M |
| 18 | Medium | Reuse | `.hub-card` forked across two files; will drift | Extract shared `shared/hub-card.js` | M |
| 19 | Medium | Reuse / program | 114 inline-style attributes re-implementing existing patterns | Add missing primitives (`.btn-danger`, `.callout`, eyebrow); strip to data-only | L |
| 20 | Medium | Settings / team | Dead-end integration rows; mismatched empty states | IntegrationRow with Connect action; one EmptyState pattern | M |
| 21 | Medium | Dashboard / queue | Filter pills & search are static dead controls | Wire client-side filtering or render visibly disabled | M |
| 22 | Medium | Copy | No single noun for a unit of work (program/engagement/venture) | Standardise on "engagement"; global replace | S |
| 23 | Medium | Wizard / setup | Disabled CTA via opacity hack; no missing-field hint | DisabledButton token + `aria-disabled` + FormHint | S |
| 24 | Low | Team / dashboard | Program assignments rendered as dot-joined prose | Program chips reusing the portfolio chip component | S |
| 25 | Low | Wizard / setup | 47-agent pill wall; tier price inconsistency | Group pills by domain with counts; one tier-card config | S |
| 26 | Low | All | Spacing rhythm flat/monotonous — no grouping cadence | Proximity grouping (tight intra-group, wider inter-group) | M |
| 27 | Low | Setup / dashboard | Placeholder copy ("TCA", "Industry TBD", "sixty seconds") reads as bug/overclaim | Neutral empty-state copy; drop timer theatre | S |
| 28 | Low | Reuse | `esc()` redefined in 6 files; brand-kit duplicated | `shared/util.js`; `shared/brand-kit.js` | S |
