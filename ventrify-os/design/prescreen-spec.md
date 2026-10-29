# Ventrify OS — Pre-screen Spec

> A free, ~1-minute first assessment that returns a score RANGE (never a single number), a flavour of the
> findings, and a quality + completeness read on the data room. Its job is to earn the paid full assessment.
> This is normative on the scoring construction, the cost/latency budget and the containment gate. The user
> flow around it (§8) is deliberately unresolved — the operator is specifying that separately.
>
> Status: QUEUED. Starts after the M3 / VerdictScore design migration is live and signed off.

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

## 8. User flow — OPEN, operator to specify

Not designed yet. The operator is walking this through separately. Captured so far:

- A customer assessing a new venture does a **free pre-screen first**, then hits a **paywall** for the full
  assessment. The pre-screen result is the paywall's argument.
- The **initial assessment wizard panel needs redesigning and bringing into the screen** — detail to come.
- Existing hard rule still stands (`os_create_in_aux_panel`): new assessment = details + deck + data room in
  the ONE aux panel, CTA "Run assessment", never a hand-off to a second page, never the legacy build wizard.
  The pre-screen has to fit inside that rule, not around it.

### Design the perceived wait, not the real one

With progressive reveal the room check is on screen in **under a second** and the first category lands
around 20s. Nobody experiences this as a 50-second wait — they watch a page fill up. Lead with the room
check: it is free, instant, genuinely useful, and it buys the entire rest of the run.

---

## 9. Open questions

1. **Corpus cap policy.** 40K tokens is ~60 pages. A 200-page upload would blow the latency budget on
   extraction alone. Cap it and say so on screen ("the pre-screen reads your deck and the first N
   documents") rather than let one upload decide whether we keep the promise.
2. **Where the result lives.** A `prescreen`-status snapshot on the engagement, or something lighter that
   does not touch the engagement until they pay?
3. **Anonymous or signed-in?** A pre-screen for prospects implies no login, and today only
   `notify-run-complete.js` and `sweep-stuck-runs.js` are unauthenticated. Needs an abuse story — it costs
   us $1.60 a go.
4. **Re-run policy.** Can a founder pre-screen the same venture repeatedly as they add documents? That is a
   great narrowing-range demo and an obvious cost leak.
