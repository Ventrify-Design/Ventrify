# Editorial Assessment — build spec (data-binding checklist)

The mockup [assess-editorial.html](assess-editorial.html) is now **layout-hardened** (Bucket A, done + visually verified). What remains is turning it from a hardcoded-MoneyGym static file into a `data.js`-driven DS component. Everything below is a place the current markup is a **literal string / count baked to MoneyGym** that will silently lie for any other engagement — driven from data at render, plus the empty/pending/cleared states whose CSS vocabulary is **already in the mockup** (just needs the class toggled + counts computed).

## Verdict hero
- **Verdict headline** — free text. Copy contract: short punchy clause ≤ ~12 words (guardrail: `-webkit-line-clamp:4` already in CSS). Longer copy → thesis lead.
- **Score / band / now→potential bar** — `num`, `band` label + `.band` colour by score-band, `.relate .pot`/`.now` widths, `Now N` / `Potential M +Δ`. Hide the `.up` delta when potential==now.
- **Conviction pips** (`.conv i.on` count), **the ask** — from data.

## Strength profile (`.profile`)
Render each `.prow` **purely from `(now, potential)` on the 0–5 scale** — no per-row literals:
- `.bar .now` width = `now*20%`; `.pot` width = `potential*20%`; emit `.pot`+`.tick` **only when `potential>now`** (`tick left:calc(potential*20%)`).
- `.val .to` = `potential>now ? '→ '+potential.toFixed(1)` (class `to`) : `'at ceiling'` (class `to flat`).
- `.sdot` class = `now>=4?'strong':now>=2.5?'mixed':'gap'`; append `· gap` to `.wt` **only** when `gap`.
- **`.profile-foot`** — compute `N strong · N mixed · N gaps` from the rows; build the narrative clause from the 1–2 rows with the largest `(potential−now)` + summed headroom; drop the `· N gaps` term and the clause when 0 gaps. (Currently the literal `1 strong · 4 mixed · 2 gaps` + `moat and execution … +21`.)

## The case, both ways (`.case-grid`)
- `.meta` `5 for · 5 against` → `${for.length} for · ${against.length} against`.
- When a side has 0 points, emit the **empty row** (vocab present): `<div class="cpt cpt-empty"><span class="mk"></span><p>No material points raised on this side.</p></div>`. (Layout void already fixed via `align-items:start`.)

## Must-be-true + kill-risk (`.mbt-grid`)
- Render `.must` rows from `conditions[]`; `.idx` = loop index `1..n` (no literal 1/2/3).
- Sub-label `For the thesis to hold, all three must be true` → count-agnostic `…every condition below must be true` (or spell the real count).
- No kill-risk → omit the `.kill` aside; the `:not(:has(.kill))` reflow already collapses the dead column.

## Diligence checklist (`.dil`) — biggest data-drift risk
Everything below is currently hardcoded to MoneyGym's **3/3/3** split:
- `.prog` — `<b>${cleared}</b> / ${items.length} cleared` + sub = join of **non-zero** tiers only (`${key} key · ${standard} standard`; drop blockers term when 0).
- `.segs` — generate **one `<i class="err|warn|info">` per item** (not 9 hand-written); mark the first `cleared` of them `.done`. (`.segs{flex-wrap:wrap}` guard added.)
- `.gate` — render **only when `blockers>0`**; `.l1` = `${blockers} blocker${s}`, `.l2` = the actual blocker titles. When `blockers===0`, use `.gate.clear` (vocab present: success lock-open posture) or the empty state.
- **Skip any `.dil-group` with 0 items** (kills dangling headers); when total 0, render `.dil-empty` (vocab present).
- `.ditem .no` — number per render (no gaps); cleared items get `.ditem.done` (checked box + strikethrough — vocab present).

## Sign-off + provenance
- `.signoff` — status-driven. Signed = current green look; unsigned = **`.signoff.pending`** (vocab present: neutral surface, `pending` icon, `.l1`=`Awaiting operator sign-off`, quote hidden). Do NOT render green when nobody signed.
- `.prov` — interpolate `{confidence} · {dataRoom} · {docCount} documents · {sourceCount} sources cited · {signalsRated} of {signalsTotal} signals rated`; optional additive `· {agentCount} agents`. (`.prov` wrap + first-line icon already fixed.)

## New CSS vocabulary added to the mockup (wire these, don't re-invent)
`.cpt-empty` · `.mbt-grid:not(:has(.kill))` reflow · `.segs i.done` · `.gate.clear` · `.dil-empty` · `.ditem.done` (+ `.box::after` tick) · `.signoff.pending` · mobile `.sec-head` wrap @640 · profile `.sdot` first-line pin.

## Not-yet-done (the build proper)
Port these sections to `ds.js` render fns driven by `data.js`, mount inside `pageShell` + `masthead` (the standalone `.ctx` header → the real masthead), and **pass `conformance.mjs`**. Update `design-system.html` in the same pass (per keep-DS-in-sync rule).
