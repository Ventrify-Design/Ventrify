# Ventrify OS — Pre-screen Spec

> A free, ~1-minute first assessment that returns a score RANGE (never a single number), a flavour of the
> findings, and a quality + completeness read on the data room. Its job is to earn the paid full assessment.
> This is normative throughout: the scoring construction, the cost/latency budget, the containment gate,
> and — as of 2026-10-30 — the user flow in §8. What remains open is listed in §9.
>
> Status: BUILT AND FIRST-MEASURED (2026-10-30). §7's containment gate has run against real engagements
> and FAILED at 60% — see §10, which supersedes the cost, latency and model figures in §5.

---

## 1. Why this exists

A full assessment is a two-hour agentic run the customer pays for. Nothing today lets them feel what they
are buying. The pre-screen is the trial: fast enough to sit through, cheap enough to give away, and honest
enough that the number it produces still holds when they pay.

Three outcomes it must produce:

1. A **score range**, with a stated reason for its width.
2. A **flavour of the findings** — a handful of real, cited observations, not a teaser.
3. A **data-room quality and completeness read** — what we can and cannot see.

---

## 2. The range is the product, not a hedge

**Do not run the full rubric shallowly and widen the answer.** A thin pass scoring 41 is mostly measuring
what it did not read, and it lands as a verdict. That is the failure mode to design away from.

Instead, split the rubric by what the supplied evidence can actually support:

- **Floor** — every unevidenced signal scored at the bottom of its band. What is provable right now.
- **Ceiling** — every unevidenced signal scored at par. What it becomes if the data room holds up.

A deck alone reliably evidences `market` (.20), `product` (.15), `evidence` (.05) and part of `team` (.25)
— about half the weighted composite. `financial`, `execution` and most of `moat` need the room. So a
deck-only pre-screen produces a spread of roughly ±15 points, and:

> **The width of the range IS the completeness deficit, rendered as a number.**

*"Your range is 48–71 because we can only see four of seven categories. The full assessment closes it."*

That is true rather than clever, and it is the entire commercial mechanism. A founder with a complete room
gets a tight range and feels good. A founder with a thin room gets a wide one, and the remedy is to give us
more — never "you scored badly".

### It feeds the living score

`shared/vss-rubric.js` already seeds a `forming` 0/100 scaffold at brief-time via `buildFormingSnapshot()`.
The pre-screen writes the **first real increment** of that scaffold. It is not a throwaway marketing toy.
Pre-v3 display guarding already has a precedent in `isV3Scale` — reuse that pattern for a range-shaped
snapshot rather than inventing a parallel one.

---

## 3. Three rules so it never reads as negative

1. **Suppress the band when the range straddles a boundary.** Bands are 80/60/40 and par already reads as
   High risk. If floor and ceiling fall either side of a line, say "spans Promising to Strong" — upside, not
   failure. Publish a band only when the whole range sits inside one.
2. **Keep the checklist out of the number.** `api/_roomcheck.js` states in its own header that it must never
   be shown as a score. Separate surfaces, no arithmetic between them.
3. **Frame it as evidence readiness, not venture quality.** Nobody can fail on evidence they have not been
   asked for yet.

---

## 4. What already exists (most of it)

| Piece | Where | State |
|---|---|---|
| Data-room completeness | `api/_roomcheck.js` | **Done.** 6 artefact classes mirrored from `financial.files_complete`, + 4 strengtheners. Regex, no AI, $0, instant. Voice already correct ("we cannot see it", never "you are missing it"). |
| Text extraction | `api/ingest-docs.js` | **Done.** PDF / DOCX / XLSX → text, no AI. |
| Synchronous Claude calls | `api/_chat.js` | **Done.** `ANTHROPIC_API_KEY` already live in Vercel. |
| Public token-keyed result page | `api/memo.js` + `/m/:token` rewrite | **Done.** Reusable as the shareable pre-screen result. |
| The rubric | `shared/vss-rubric.js` | **Done.** 7×5, weights, forming scaffold. |

The pre-screen does **not** need the GitHub Actions runner. It runs inside a request.

---

## 5. Model, cost and latency — DECIDED

**Model: `claude-opus-5-5` with Fast mode ON.** Agreed with the operator. The budget headroom converts
almost directly into wall-clock, and latency is what the two-minute promise is made of.

### Fast mode, exactly

- Beta endpoint: `client.beta.messages.create` (**not** `client.messages.create`)
- `betas: ["fast-mode-2026-02-01"]`
- `speed: "fast"` as a **top-level request parameter** — not a header, not inside `extra_body`
- Pricing: **$8 / $40 per MTok** (2× standard). Claude API only. Separate rate limit from standard Opus.
- `response.usage.speed` reports which speed actually served the request — log it.

### Shape of a run

21 probes: **7 categories × 3 independent draws**, median per signal. The three draws are not optional —
see §7.

The corpus (deck + room docs as plain text) is capped at **~40,000 tokens** — roughly 60 pages. Every probe
must re-send it, because the API is stateless, so the corpus is cached once and pointed at 20 times.

| | Fast mode, cached |
|---|---|
| Cache write (1 × 40K @ $8/MTok × 1.25) | ~$0.40 |
| 20 cache reads | ~$0.32 |
| Output (21 × ~1K @ $40/MTok) | ~$0.84 |
| **Total per run** | **~$1.60** |

Against a $3–5 budget, that is a third of the ceiling. Without caching the same run is ~$7.50 and **over**
budget — the caching is not an optimisation here, it is what makes fast mode affordable.

*(Cache-read pricing under fast mode is assumed at 2× standard and is unverified — measure it on the first
real run and correct this table.)*

### Latency

| Stage | Time |
|---|---|
| Text extraction (only if uploading now) | 10–20s |
| Room check | instant |
| Cache warm-up | ~5s |
| 21 probes, in parallel | 12–18s |
| Final verdict paragraph | ~8s |
| **Total** | **~35–50s** |

Reading is cheap in time as well as money — a cached prefix is not re-processed. **Output tokens set the
clock.** Hence fast mode, and hence `output_config: { effort: "low" }` (Opus 5.5 defaults to `medium`;
matching evidence against a rubric we already wrote down is not hard reasoning).

---

## 6. Architecture, and the five traps

**Host it in `api/memo.js` as a new action.** `api/` holds 15 files, 3 are `_`-prefixed helpers that Vercel
skips, so **12 deployed functions — exactly the Hobby cap**. A new `api/pre-screen.js` fails the whole
deploy. `memo.js` already has an action dispatcher, already imports `_chat.js`, already runs at
`maxDuration: 60`, and already serves a public token-keyed GET.

**The browser orchestrates.** Hobby caps one invocation at 60s, so two minutes cannot be a single call. The
page runs the room check instantly, fires the warm-up, then fans out 7 invocations that land one at a time.
The constraint produces the better UX: results arriving live beat a spinner.

### Traps

1. **Serial draws blow the 60s cap.** 3 draws in parallel is ~15s and fine; written as a loop it is ~45s+
   and the function gets killed. This is the mistake the obvious implementation makes.
2. **Prefix order decides the bill.** The cache matches on the *opening* stretch, byte for byte. Corpus
   first, category question last. Put "Category: Market Opportunity" at the top and all 21 probes are
   unique prefixes at full price.
3. **Never fan out cold.** 21 simultaneous calls all start before any has finished writing the cache, so all
   21 miss. One `max_tokens: 0` warm-up call, awaited, then fan out.
4. **A fast→standard fallback destroys the cache.** Switching speed invalidates the prompt cache. If a 429
   forces a downgrade mid-run, the remaining probes pay full uncached price. Decide up front: retry on
   `retry-after`, or abandon the run — do not silently downgrade.
5. **Rate limits.** 21 concurrent Opus calls may exceed account concurrency. Check the real limit before
   designing for 21-wide; if tight, go 7-wide in waves. (Fast mode's separate limit helps here.)

### Two Opus 5.5 API facts that change the code

- **Thinking cannot be disabled** — `{type: "disabled"}` is a 400 at every effort. Control depth with
  `output_config: { effort: "low" }` only.
- **Forced tool use is gone** — `tool_choice: {type: "any"|"tool"}` returns 400. To get structured scores
  back, use **structured outputs** (`output_config.format`), not a forced tool call.

---

## 7. The containment gate — non-negotiable

If a founder pre-screens at 55–70 and the paid assessment returns 44, the refund is the cheap part of that
mistake.

Build **`tools/prescreen-containment.mjs`** alongside the feature, in the spirit of the existing gates:

> Run the pre-screen against every engagement already scored in the system, and assert the published
> composite falls inside the predicted range.

If containment is below ~90%, widen the floor until it is. This gate is the difference between a lead magnet
and a liability, and it is the one part of this spec that does not bend.

### Why three draws, specifically

`shared/vss-rubric.js` documents it at line ~70: **KreditMate scored 47, then 39, on the same deck**,
because four 2–1 splits fell the other way. The runner already takes three blind draws and publishes the
median. A single-draw pre-screen would be unstable, and an unstable *range* is the exact failure containment
is protecting against. The budget headroom exists; spend it on repetition, not depth.

---

## 8. User flow — DECIDED 2026-10-30

Settled with the operator. Normative. The only thing still marked open is 8.5's allowance question.

### 8.1 Create and pre-screen are the SAME screen

The aux panel is retired for this flow. `os_create_in_aux_panel` said "setup never hands off to a second
page" — the **intent survives and the mechanism dies**. A full screen holding the whole thing is more
faithful to that intent than the panel was. What is still forbidden: scattering setup across surfaces, and
linking the legacy build wizard.

Two columns on desktop, stacked on mobile:

```
┌─ The venture ──────────────┐  ┌─ What we can see ──────────┐
│ name · founder · stage     │  │  (fills live as you attach) │
│ website · assessor         │  │   coverage · named gaps     │
├─ The evidence ─────────────┤  │   predicted range width     │
│ pitch deck      [required] │  │                             │
│ data room / Drive link     │  │                             │
└────────────────────────────┘  └─────────────────────────────┘
```

The right column earns its keep **before anything has run** — `_roomcheck` is regex, $0, instant. On Run,
this screen *becomes* the assessment page in place: masthead and tabs swap, categories land live. No
hand-off, no spinner, no second page. `paint()` in `assess-next.html` already swaps masthead + body in
place; reuse it rather than inventing a transition.

### 8.2 Tabs by state — nothing is ever padlocked

| State | Tabs | Masthead primary |
|---|---|---|
| **Pre-screened** | Range · Data room | **Unlock full assessment** |
| **Assessed** | Verdict · Investability · Market · Team · Diligence · Research · **Data room** | Confirm / Decline (as today) |

Six tabs with four padlocks was rejected: **a locked tab is a dead end, and four padlocks is a negative read
of US.** It makes the free tier feel like a crippled version rather than a real thing, which is the same
failure §3 guards against in the number. Two complete tabs instead, nothing broken.

The upsell is **not a bolted-on widget**. It is the masthead primary action, where `shared/actions.js`
already says the primary action lives, and the *argument* closes the Range tab in the customer's own
numbers: *"48–71. The full assessment closes this to a single number across six chapters."*

**Data room is a permanent tab in BOTH states.** This contradicts the comment at `assess-next.html:435`,
which rejected a 7th tab for Diligence as "a permanent chapter about US, empty on the good deals". The data
room survives that argument on all three counts: it is about **them**, it is **never empty**, and it is the
only surface they **act on**. Everything else in the product is us talking at them.

### 8.3 The range becomes snapshot zero

`DS.scoreProvenance(invSnapshots)` already renders score history on the Investability tab. The pre-screen
range drops in as the first entry — **`Pre-screen 48–71 → measured 63`**. Reuses a shipped component, tells
the continuity story, and quietly proves the pre-screen was honest. It is also the customer-visible half of
the containment gate in §7.

### 8.4 Entitlements — one derivation, one flag

Not scattered `if (paid)` checks. ONE module returning
`entitlements(engagement, plan) → { canRunFull, canAssist, canFileEvidence, canExport, canShare }`,
consumed by the `shared/actions.js` rail filter, the tab builder, and the server. Same single-source shape
as the action model.

Two independent axes:

- **Org plan** (`workspace/plan.js`) — the licence. Exists, server-enforced, unchanged.
- **Engagement tier** (`'prescreen' | 'full'`) — per venture. New field on the engagement doc.

Paid-only, per the operator: **the AI assistant** (`assist` rail action), **filing evidence / answering
diligence asks** (the whole gap flow), **deal-memo export**, **the shareable `/m/<token>` link and operator
sign-off**, and the full run itself.

**One flag: `BILLING_ENFORCED = false`.** Today "Unlock full assessment" simply runs the full assessment —
the operator wants to keep running full assessments while Stripe is unwired. When Stripe lands the flag
flips and the same button routes to checkout. One constant, one place, same shape as `FIREBASE_ENABLED`.

### 8.5 Two audiences, two emphases — the licensed triage read

A licensee with a full licence must be able to pre-screen **by choice**: a 60-second triage read to decide
whether a deal is worth two hours of runtime. Same engine, different job — for the free tier the pre-screen
is the *trial* and it is forced; for a licensee it is *triage* and it is chosen.

**No toggle.** The consequence asymmetry is too large for a switch (seconds vs hours, $1.60 vs real
compute), and a toggle is easy to miss. Instead: the **same two buttons, with the emphasis swapped by
entitlement** — one component, one placement, and the hierarchy teaches each audience the right thing.

| Audience | Filled (primary) | Tonal (secondary) |
|---|---|---|
| Free tier | Run free pre-screen | Unlock full assessment |
| Licensed | Run full assessment | Run pre-screen first |

Still legal under the conformance gate's "≤ 1 primary" — tonal is secondary, not primary.

A licensee who pre-screens and then promotes **upgrades the same engagement** (tier `prescreen` → `full`);
it never creates a second record. That makes the deal-pipeline dashboard a **pipeline of ranges**: run
twenty pre-screens, sort by ceiling, promote three.

> **OPEN:** does a licensee's pre-screen consume `limits.assessments`? Recommendation: **no** — burning a
> full-assessment credit on triage discourages exactly the behaviour that saves us compute. Give it its own
> `limits.prescreens`, generous or null.

### 8.6 One free scored pre-screen per venture, per account

- **Room re-scan: free and unlimited.** $0, instant, and it is the engagement loop — add documents, watch
  coverage fill and the range narrow.
- **Scored pre-screen: once.** Re-scoring requires the upgrade. This resolves §9.4's "obvious cost leak":
  the addictive loop is the free one, the expensive one is earned.

**Deck-reuse guardrail.** Fingerprint on the **normalised extracted text**, not the file bytes —
`ingest-docs.js` already produces the text, so re-exporting, re-compressing or editing metadata does not
dodge it. Store a shingle set (hashed overlapping word-windows) so "same deck, v3.1" still matches. Also
fingerprint **venture identity** (normalised name + website domain + founder), which in practice is the
stronger signal, because the rule we actually want is *one free pre-screen per venture*, not per file.

Honest limits, so nobody expects more than it gives:

- A rewritten deck under a fresh account defeats any fingerprint. This is a **speed bump against casual
  re-rolling, not a wall**. The real abuse cap is sign-in + per-account rate limiting + $1.60 not being
  worth a new email address to most people.
- **False positives cost more than false negatives.** Blocking a genuine new venture is a terrible first
  experience. Threshold conservatively, and make the block **soft**: *"This venture has already been
  pre-screened — open the result, or unlock the full assessment."* A route back, not a dead end.
- **Scope the block to the account.** A cross-account match must never be surfaced: two firms legitimately
  pre-screening the same deck is normal, and "someone else already ran this" leaks. Keep global matches as
  a silent abuse signal only.

### 8.7 The data room is coverage, never a grade

`api/_roomcheck.js` states in its own header that no number comes out of it, and §3.2 forbids arithmetic
between the room read and the score. Both hold, and nothing the operator asked for is lost:

| What was asked for | How it is rendered |
|---|---|
| "How good is my data room" | **Named coverage** — which of the 6 evidence classes are present, which are not, and what each unlocks. *"Cap table — not seen. Unlocks: ownership dilution, founder commitment."* |
| "How it affects my score" | **The range width**, which already is exactly that, expressed in the only currency that matters. |
| "Watch it improve" | The gap list shortens and the range narrows. A better progress bar than a progress bar — every tick is a named thing they did. |

A percentage would be worse on four counts: people do arithmetic on two adjacent numbers; a grade punishes
them for evidence nobody asked them for yet (undoing the module's careful "we cannot see it" voice); it is
gameable by six well-named empty files; and coverage is **not linear in score weight** (a cap table is a
small file and a large weight), so the two numbers would visibly disagree.

### Design the perceived wait, not the real one

With progressive reveal the room check is on screen in **under a second** and the first category lands
around 20s. Nobody experiences this as a 50-second wait — they watch a page fill up. Lead with the room
check: free, instant, genuinely useful, and it buys the entire rest of the run.

---

## 9. Still open

1. **Corpus cap policy.** 40K tokens is ~60 pages. A 200-page upload blows the latency budget on extraction
   alone. Cap it and say so on screen ("the pre-screen reads your deck and the first N documents") rather
   than let one upload decide whether we keep the promise.
2. **Licensee pre-screen allowance** — see the OPEN note in §8.5.
3. **Free sign-up journey.** Decided that the pre-screen is **signed-in, not anonymous** (the re-scan loop
   needs persistence anyway, and it caps abuse on a $1.60 run). The free-account sign-up flow itself is
   deferred until the VerdictScore marketing site is finished.
4. **Vercel plan.** `api/` is at exactly 12 deployed functions — the Hobby cap. The pre-screen folds into
   `memo.js` and fits. **Stripe's webhook will not.** The operator intends to upgrade the project before
   Stripe is wired; remind them at that point. See `os_vercel_function_cap`.

### Built, and what is still missing

| Piece | Where | State |
|---|---|---|
| Range construction, median of 3 draws, band suppression | `api/_prescreen.js` | Built. 28 offline checks in `tools/prescreen-logic.mjs`. |
| Fast-mode probe, cache warm-up, structured outputs | `api/_prescreen.js` | Built. **Never run against the real API.** |
| Server-side scoring + storage + compose | `api/memo.js` (`prescreen-warm` / `-category` / `-finalise`) | Built. No score crosses the client. |
| One free pre-screen per venture | `prescreen-warm` + `shared/entitlements.js` | Built. Soft refusal, org-scoped. |
| Browser orchestration + live reveal | `workspace/prescreen.js`, `DS.prescreenRunning` | Built. Fan-out 4, **unmeasured**. |
| Create screen runs it | `window.__wsRunPrescreen` | Built. |
| Range / Data room tabs, unlock | `assess-next.html`, `api/memo.js` (`prescreen-unlock`) | Built. |
| **§8.3 — the range as snapshot zero** | `scoreProvenance` | **NOT BUILT.** The range is stored on the engagement but is not yet written into `investabilitySnapshots`, so a full run will not show "Pre-screen 48–71 → measured 63". |
| **§7 — containment** | `tools/prescreen-containment.mjs` | Written, **never run.** Needs credentials and a budget. |

### Resolved since the first draft

- Where the result lives → **a real engagement doc**, tier `prescreen`. The lightweight alternative breaks
  both the data-room loop and the provenance story (§8.3).
- Anonymous or signed-in → **signed-in**.
- Re-run policy → **§8.6**.


---

## 10. What the first containment replay actually measured — 2026-10-30

§5 was written before anything met the API. Three of its assumptions were wrong, and the gate found all
three on its first real run. **Where this section and §5 disagree, this one is right.**

### Fast mode is not available

```
rate limit of 0 fast mode input tokens per minute (model: claude-opus-5-5)
```

It is a research preview with its own allocation and this organisation has none. Waiting does not help —
it is a capability answer, not back-pressure.

**DECIDED with the operator: run at STANDARD speed.** Half the price ($4/$20 rather than $8/$40) and
roughly twice the wall-clock. The promise becomes "under three minutes", not "about a minute". Speed is
chosen once per run, before anything is cached, and never switched mid-run — switching invalidates the
prompt cache and reprices every remaining probe.

### The account's token rate limit, not the model, sets the floor on latency

```
rate limit of 500,000 input tokens per minute
```

One pre-screen on a full corpus is ~880,000 input tokens (one 40K cache write + 21 probes × 40K), so
**~1.8 minutes is a hard throughput floor** on the largest rooms regardless of fan-out. FANOUT is 2, not
4: one category is ~120,000 tokens, so four sat exactly on the ceiling, which is where throttling starts
rather than where it is safe.

Two consequences, neither solved by tuning:

- **Concurrency.** Two simultaneous pre-screens demand 1.76M tokens/minute. The second throttles. A
  self-serve product needs the account limit raised, or a server-side queue.
- **A structural alternative, unmeasured:** the corpus is re-sent 21 times because the spec scores one
  category per call. All seven categories in one call is 3 calls rather than 21 — a 7× throughput
  reduction. The three draws must stay (they are what makes the median stable). The cost is focus, and
  that is measurable rather than arguable.

Small rooms are unaffected: a deck plus five documents is ~220,000 tokens total and finishes inside a
minute. **The customers most likely to hit this are the best-prepared ones.**

### Containment failed at 60%, because of WHICH DOCUMENTS WE READ

```
✓ 0X Labs       33–60 vs 53     ✗ KreditMate   42–54 vs 62
✓ Holoclara     42–60 vs 46     ✗ MoneyGym 2   41–56 vs 76
✓ KreditMate 3  43–55 vs 47
```

Both misses read LOW — commercially the safe direction, but wrong, and **§7's remedy of widening the
floor would not have touched either.** The ceiling was the problem.

`buildCorpus` sorted deck-first then **alphabetically**. On MoneyGym's 53-document room that spent the
whole 40,000-token budget on board minutes, incorporation papers and third-party benchmark PDFs —
including a single 47,000-token industry report — and dropped the financial model, the unit economics and
the market sizing. The paid run read all 53 and published 76; we predicted 41–56 having never opened the
financials.

Fixed: selection is rubric-led (using `_roomcheck`'s own filename patterns, so it cannot drift into a
second opinion about what matters), oversized documents are truncated rather than skipped (MoneyGym's
financial model is ~50,000 tokens on its own and could never fit), and coverage goes breadth-first —
one document per class, then the venture's others, then second copies.

**Still open:** ordering within the unclassified set is alphabetical, so market analysis can crowd out
team CVs. Whether that matters is a question for the next replay, not another round of guessing.
