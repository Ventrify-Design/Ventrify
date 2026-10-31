# Ventrify OS — Pre-screen v2: the flavour, not the audit

> **Status: BUILT 2026-10-31, NOT YET RUN AGAINST THE REAL API.** Settled with the operator in
> discussion, then built. Normative.
>
> What exists: `api/_corpus.js` (the room read, now shared with v1), `api/_prescreen2.js` (the engine, all
> four phases, every guardrail in §8.1–8.6), the five `ps2-*` actions in `api/memo.js`,
> `workspace/prescreen2.js` (orchestration + the correction path), seven components in `shared/m3/ds.js`
> (`verdictDial`, `verdictHero`, `briefPlayback`, `briefEditor`, `nuggetCard`, `verdictFindings`,
> `verdictNext`, `verdictSources`, composed by `verdictPage`), their chrome, and both call sites
> (`assess-next.html`'s Verdict tab, `workspace-m3.js`'s run).
>
> Gates: `prescreen2-logic` (21 sections, 141 checks, free), `prescreen-vocabulary` (free), `prescreen-composition`
> (free self-test; `--live` reads real snapshots). Sixteen gates pass including shell conformance and
> motion. **Every cost and latency figure in §7 is still predicted** — no v2 run has met the API.
>
> Not built: the three `--spend` gates of §9 (`prescreen-deckonly`, `prescreen-direction`,
> `prescreen-bands`), which cannot be written against data that does not exist yet, and §11.2
> (what a band writes into the living investability score).
>
> This supersedes **§1, §2, §5 (shape of a run), §7 and §8.7's range language** in
> `prescreen-spec.md`. Where this document and v1 disagree, **this one is right**. v1 remains the
> reference for everything it still owns: the user flow (§8.1–8.4, §8.6), entitlements, the hosting
> decision (§6), the Opus 5.5 API facts (§6), and the measured platform limits (§10).
>
> Written for whoever builds this — including a future session of mine — and for the operator to
> check the build against. Every "DECIDED" below was agreed; every "UNVERIFIED" needs measuring
> before it is trusted.

---

## 1. Why v1 missed

v1 built an instrument that **scores documents**. Its 21 probes ask, over and over, *"does the supplied
evidence meet this criterion?"* Every call is inward-looking. The corpus is the only source of information
in the entire pipeline.

So the only sentence the architecture can ever produce is: **"here is what your documents do and don't
contain."** That is an audit. It was never the point.

The point — stated at the outset and lost in the build — was a **flavour of the full assessment**: the
moment a customer reads something and thinks *"I hadn't thought of that."* The full assessment produces
that with the case argued both ways, the market read, the competitive landscape, the team played back, and
the thesis named. None of those are reachable from a compliance check on a data room.

### The epistemic core of the redesign

We have only ever seen the documents. We have never met the team, used the product or spoken to a customer.
So we cannot out-know the customer about their own venture, and any design that tries will produce
restatement, which reads as filler.

There are exactly **three places** a non-obvious insight can come from:

| Source | What it is | Needs |
|---|---|---|
| **What they didn't know** | The outside world — competitors, comparable raises, public market numbers | External research |
| **What they didn't notice** | Tension *between* their own documents | Two or more documents |
| **What they didn't want to think about** | The bear case, argued the way an investor will argue it | Nothing extra |

v1 built none of the three. **Two of the three work from a pitch deck alone** (§4), which is why external
research — not deeper reading — is the unlock.

---

## 2. The band: "is this worth assessing?" — DECIDED

The score range is **retired**. It was precision theatre: two numbers off a one-minute read, implying a
resolution we do not have, and inviting arithmetic instead of a decision.

Replaced by a **three-band dial**:

- **High** — strong case, worth the full assessment now
- **Medium** — real signal here, with specific things that need resolving
- **Low** — the case doesn't hold up yet on what we can see

Plus one state that is **not a band** (§3.3): *not enough here to read*.

### It is a readiness verdict, not a quality verdict

| | Quality band | Readiness band |
|---|---|---|
| Judges | the venture | the case assembled for it |
| "Low" means | "your business is weak" | "there isn't enough that holds up yet — here's what" |
| Entitled to say it? | **No.** We only read documents. | **Yes.** Readiness is a property of the evidence, and the evidence is all we saw. |
| Full assessment can contradict it? | Yes — publicly wrong | No. "Thin case, strong venture" is a consistent pair. |

The third row is the one that decides it. A quality verdict from a one-minute document read is
**overclaiming**. A readiness verdict is exactly scoped to what we looked at.

### It protects the paid product instead of competing with it

- **Free answers:** *is this worth assessing?*
- **Paid answers:** *what's the verdict?*

Different questions. A cheap quality verdict is a worse version of the thing we charge for, and some
customers will decide it is good enough. A readiness verdict routes to the paid product.

It serves both audiences unchanged: a founder asking *"is my case ready to show investors?"*, and a fund or
accelerator asking *"is there enough here to justify commissioning the full assessment?"*

### Do not use the word "readiness" in the product

It drags a paperwork connotation with it, and whoever writes copy in six months will follow the word rather
than the intent. **In the UI the band answers the operator's own question — "is this worth assessing?" —
and none of the three band sentences above mentions a document.** `readiness` may appear as an internal
field name; it may not appear on screen.

### Why three bands are easier to validate than a range

v1's containment gate needed the published composite to fall inside a predicted interval, and failed at
60% (v1 §10). The last **measured** correlation between pre-screen and full assessment is **−0.23**
(`os_prescreen_scoring_calibration`) and nothing since has changed that number.

A band needs only **ordinal** agreement — did it put the right venture in the right bucket — which is a far
lower bar than numerical containment, and testable against the 13 already-assessed engagements. This is a
real reduction in what the pending containment replay has to prove, and it may make that replay cheaper.

---

## 3. The anti-regression rules — DECIDED

The operator's stated fear is that "readiness" quietly decays back into document-scoring with a dial on it.
It can. These three rules are the defence, and §9 turns them into gates.

### 3.1 The band is never a function of document count

**Documents are information, not credit.**

| | v1 (wrong) | v2 (right) |
|---|---|---|
| Model | documents are credit | documents are information |
| More documents | → more evidenced signals → higher score | → a sharper, more confident read |
| Direction | monotonically up | **either way** |

This resolves the apparent contradiction with the bug fixed on 2026-10-30, when a 48-document room moved
the score by zero. Within v1's design that was a genuine fault: more evidence *should* have scored higher,
and document selection stopped it. Under v2, adding a data room can move the band **down** — revealing
financials that contradict the deck, churn the deck omitted, or a cap table that is a problem.

> **The test: if adding documents can only ever help the band, we are scoring documents again.**

### 3.2 Disclose the basis, never penalise it

A deck-only run is **not marked down for being deck-only**. The output states what it read from:

> *Medium — read from your pitch deck and four public sources.*

Never *"Low, because you didn't give us enough."* The moment thin inputs cost band, we are grading
paperwork.

### 3.3 "We couldn't tell" is not Low

A two-slide teaser with no substance is not a verdict on a venture — it is an unreadable submission. It
gets its own state, **off the dial entirely**, with a list of what would make it readable. Collapsing this
into the bottom band is precisely how a readiness band becomes a completeness score.

### 3.4 Coverage survives, demoted

v1 §8.7 — *"the data room is coverage, never a grade"* — **holds unchanged and is now load-bearing**. The
room read stays: named classes present and absent, what each unlocks, no arithmetic against the band. It
moves out of the headline and into its own panel. `api/_roomcheck.js` is free and instant; it is the first
thing on screen and it buys the rest of the run.

---

## 4. Deck-only is a first-class run — DECIDED

A customer who uploads only a pitch deck must still get the full set of nuggets. This is not a degraded
mode, and it falls out of §1's table:

| Nugget | Deck only |
|---|---|
| Thesis — what this venture is really betting on | ✅ |
| Bull case | ✅ |
| Bear case | ✅ |
| Competitive read | ✅ — it is entirely external |
| Team read | ✅ — names and backgrounds are in the deck |
| Cross-document tension | ❌ needs ≥2 documents |
| Confidence | lower, and **stated** (§3.2) |

A deck tells us sector, claim, market, model and team — everything the external research needs to go and
find the thing they didn't know. **The data room does not make the competitive read better.** It makes
internal contradictions findable and the read more confident.

---

## 5. What lands on screen

In this order. Each item is **optional** (§8.5) and each is a separate reveal (§6.5).

1. **Coverage** — instant, free, from `_roomcheck`. Named classes, no grade.
2. **"Here's what we understood your venture to be"** — the distillate, played back. One sentence of
   thesis, plus sector/stage/model/ask. This is both the first wow and the §8.2 guardrail.
3. **The thesis** — the bet, in our words, sharper than they wrote it. Proves comprehension before it
   offers judgement.
4. **The band** + one sentence of reason + the basis it was read from.
5. **Argued both ways** — 3 bull, 3 bear. Every point must be **falsifiable** (§8.4).
6. **The competitive read** — one or two names *not in their deck*. Highest-wow item available to us,
   because it is pure outside information.
7. **The team read** — does this team match this problem, and what is conspicuously missing.
8. **What the full assessment would test next** — 3 specific things, derived from the actual gaps. Never
   a template. This is the conversion surface and it must be earned by the preceding seven items.

### The nugget test

> **Could the founder have written this themselves? If yes, cut it.**

---

## 6. Architecture: distil once, reason many times

v1 drags a 40,000-token corpus through 21 calls. Each call pays for reading, and returns a number.

v2 reads the corpus **once**, into a small structured brief, and then does all its thinking on the brief.
Every analytical call becomes cheap because its context is ~6K rather than 40K — and that is where the
budget for external research comes from.

### 6.1 Phase 1 — Distil (1 call, `claude-sonnet-5-5`)

One pass over the corpus producing a structured `VentureBrief` (~2K tokens out):

- one-sentence thesis; sector and sub-sector; stage; geography; business model
- the claimed market and its number
- traction figures as claimed
- team names and backgrounds
- the ask
- **`claims[]`** — each `{ statement, docId, quoted_span }`

This is the **only** call that ever pays for the corpus. It is an extraction job, not a reasoning job, so
it runs on Sonnet 5.5 at `effort: "low"`.

Corpus construction, truncation and the rubric-led document ordering built on 2026-10-30 all carry over
unchanged — they are still what stops the investor memo being crowded out by a director's resignation.

### 6.2 Phase 2 — Look outward (`web_search_20260209`, parallel)

Driven by the brief, **not** by the corpus. Hard cap: **5 searches per run** (§8.6).

Queries derive from sector + claimed market + any named competitors:

- who else is operating in this space
- what has been funded in it recently, and at what
- whether any public source agrees with the deck's market number

`web_search_20260209` is the current tool version for Opus 5.5 and Sonnet 5.5. **Nothing in this codebase
uses server-side web search today** — this is new surface, and §8.1's citation check is what makes it
safe to ship.

### 6.3 Phase 3 — Reason (6 parallel calls, `claude-opus-5-5`, brief + research only)

Never the corpus. ~6K of context each.

| Call | Output | Effort |
|---|---|---|
| Thesis | the bet, in our words | `low` |
| Bull | 3 falsifiable points | `medium` |
| Bear | 3 falsifiable points | `medium` |
| Competitive | adjacent players, the wedge, defensibility | `medium` |
| Team | match to problem, conspicuous gaps | `low` |
| Tension | contradictions between claims — **skipped when <2 documents** | `medium` |

Effort is now a per-call decision rather than a global setting. Opus 5.5 cannot disable thinking; effort is
the only control (v1 §6), and **output tokens are the dominant cost** (§7).

### 6.4 Phase 4 — Band and conversion (2 calls)

The band, its one-sentence reason, and the three things the full assessment would test. Plus the single
genre-quality judge pass over all nuggets at once (§8.4).

### 6.5 Orchestration and reveal

v1 §6's decision stands: **the browser orchestrates**, because Hobby caps one invocation at 60 seconds.
Phases become separate invocations that land progressively.

**DECIDED: build the progressive reveal.** It is a superset — if everything lands in eight seconds the
items arrive near-together and it reads as a single reveal anyway. Under ~12 seconds nobody notices; over
that, "watching an analyst think" is materially better than a spinner followed by a wall. The staged run
choreography built last week (`DS.prescreenStage`, landing marks, `revealLive`) becomes the delivery
mechanism for insight rather than a progress indicator.

Hosting is unchanged: **new actions on `api/memo.js`**. `api/` sits at exactly 12 deployed functions, the
Hobby cap, and a new file fails the whole deploy (`os_vercel_function_cap`).

---

## 7. Cost and latency

All prices verified against the current model reference 2026-10-31: **Opus 5.5 `claude-opus-5-5` $4/$20 per
MTok, cache reads $0.20/MTok. Sonnet 5.5 `claude-sonnet-5-5` $2/$10 per MTok, cache reads $0.20/MTok. Web
search $10 per 1,000 searches.** Fast mode remains unavailable to this organisation (v1 §10), so
everything below is standard speed.

### Correction to the discussion estimate

I told the operator the cost was ~95% redundant re-reading and that v2 would therefore be substantially
cheaper. **Both halves of that were wrong**, and the real picture changes a build decision, so:

| v1 run, measured basis | |
|---|---|
| Cache write (40K × $4 × 1.25) | $0.20 |
| 21 cache reads (840K × $0.20) | $0.17 |
| Output incl. thinking (21 × ~3K × $20) | **$1.26** |
| **Total** | **~$1.63** — matches the ~$1.60 observed |

**Output tokens are ~77% of the bill, not the reading.** Caching already made the re-reading cheap. The
saving in v2 comes from making *fewer calls think*, not from reading less — and Sonnet 5.5 is 2× cheaper
than Opus on input, not 5×.

| v2 run, estimated | |
|---|---|
| Phase 1 distil (Sonnet, 40K in, ~6K out) | $0.14 |
| Phase 2 research (5 searches + ~20K results + reasoning) | $0.21 |
| Phase 3 reason (6 × ~6K in, ~4K out each) | $0.62 |
| Phase 4 band + judge | $0.12 |
| **Total** | **~$1.10** — UNVERIFIED |

So: **roughly comparable, perhaps a third less, with a dramatically better output.** Not the step-change in
cost I implied. The honest claim is that v2 buys external research and six analytical passes for about what
v1 spent on 21 compliance checks.

### The throughput win is the real prize

v1 §10 measured a hard ceiling: ~880,000 input tokens per run against a **500,000 input tokens/minute**
account limit, making a single large run take ~1.8 minutes and **two concurrent runs impossible** — flagged
there as unsolved and fatal for self-serve.

v2's input is ~**100,000 tokens** per run (40K distil + ~20K research + ~40K across the reasoning calls).
That is an **~8.8× reduction**, and it incidentally fixes the concurrency ceiling. Two simultaneous
pre-screens now demand ~200K/min against a 500K limit.

### Latency

| Phase | Time |
|---|---|
| Coverage (`_roomcheck`) | instant |
| Phase 1 distil | 15–25s |
| Phase 2 research (parallel) | 5–15s |
| Phase 3 reason (6-wide parallel) | 10–20s |
| Phase 4 | ~8s |
| **Total** | **~45–60s** — UNVERIFIED |

Tight against 60s per invocation, which is exactly why §6.5's multi-invocation progressive reveal is the
architecture and not a nicety.

---

## 8. Guardrails

One principle governs all of them:

> **Don't ask a model not to make things up. Make it structurally unable to express a claim without a
> source.** A prompt saying "don't fabricate" is a request. A schema that cannot represent an unsourced
> claim is a constraint. Build the second.

Layers 8.1–8.6 run **inside every run** and protect every customer. §9's gates run in **CI** and catch
regressions. These are different jobs and are routinely conflated; building only the second ships
fabrications to everyone between sweeps.

### 8.1 Citation: one hard guarantee, two honest tiers — AMENDED 2026-10-31 BY MEASUREMENT

The original design said: check that the cited URL appears in the search results, and substring-check the
span against the fetched content. **The first half got stronger and the second half turned out to be
impossible.**

#### The hard guarantee: cite by index, never by URL

An external claim cites its source by **integer index into an enum built from the sources the API itself
returned**. The model never writes a URL, so it cannot invent one — this is structural, not checked.

> **Measured on the first live run:** the model returned indices 7, 8 and 0 against a nine-source list.
> All three were real sources the search had actually fetched.

#### What measurement broke

`web_search` result blocks carry **`encrypted_content`**, not text:

```
keys on a result: type, title, url, encrypted_content, page_age
```

The model can read the page. **Our code cannot.** Three routes were tested and all closed:

| Attempt | Result |
|---|---|
| Harvest text from `web_search_20260209` result blocks | encrypted |
| Server-generated citations on the text blocks | no `citations` field |
| The pre-dynamic-filtering `web_search_20250305` | also encrypted |

So the first smoke test **dropped two findings that were true, useful and correctly cited** — *"Updraft is
the best-funded direct rival"* and *"Sprive raised $7.3M"*. Precisely the outside-in nuggets this feature
exists to produce. A guardrail that discards those makes the product look **weak rather than broken**,
which is the worse of the two failures because nobody goes looking for a bug.

#### The fix: read the page ourselves, and be honest when we cannot

`fetchSourceText()` fetches each harvested URL server-side, in parallel, 4.5s timeout, best-effort. Then:

| Tier | When | How it renders |
|---|---|---|
| **verified** | we fetched the page and the span matched it, **or** the claim is internal and matched the document | the source, plainly |
| **attributed** | the claim cites a real harvested source we could not read | **"according to <source>"**, with its link |

**A publisher blocking a server-side fetch is not evidence about whether a claim is true**, so an
unreadable page downgrades a claim rather than binning it. And verification is **not weakened, only
scoped**: where we do hold the text, a wrong span is still dropped.

The tier is decided by whether we actually fetched the page, never by a string-length heuristic — holding
60 characters of a 5,000-character page and "verifying" against it would drop true claims for reasons
that are an artefact of how little we hold.

This is the same move **§8.8** already makes for customer-edited fields: exempt from the check, visibly
marked. The architecture already had a word for *true but not verified by us*.

> **The principle that survives: nothing is ever presented as verified when it is not.**

Internal claims have **no attributed tier** — we always hold the document, so a span that is not in it
means the claim is wrong. *(Measured: 4 of 4 of the distil pass's own spans matched on the first run.)*

### 8.2 Guard the distillate — it is the single point of failure

If the brief gets sector, stage or business model wrong, all six downstream calls reason confidently about
the wrong company and produce something **internally consistent and completely false**. Nothing would look
broken.

Three defences, in order of value:

1. **Show it to the customer first** (§5 item 2). The customer is a perfect validator — they know in two
   seconds if it is wrong. The guardrail and the wow are the same component.
2. **Let them correct it** — DECIDED 2026-10-31, in v2.0. A wrong distillate becomes one edit instead of
   a silent poisoning. The mechanism, its entitlement rule and its consequences are **§8.8**.
3. **Cross-field consistency**, deterministic: does the one-sentence thesis mention the sector the sector
   field claims?

Plus: the brief's own `claims[]` are substring-checked exactly as 8.1 describes.

### 8.3 No model's self-report is ever a measurement

Precedent: `_instrument.json` exists because an agent's own self-score was once shipped as a measurement
(`os_self_rating_vs_measured_score`). Same trap, same rule. Confidence, band and quality signals must come
from deterministic checks or from the golden set, never from the generating call's own assessment of itself.

### 8.4 The generic-nugget problem

No deterministic check catches *"needs to prove product-market fit"* — it is not false, just worthless. Two
defences:

1. **Structural, free, at the schema level:** a bull or bear point must contain a number or a named entity.
   Kills "strong team" and "needs to prove PMF" mechanically.
2. **One judge call over all nuggets at once**, asking only: *which of these would be true of any startup
   in this sector?* One small call on ~2K of context, not six.

### 8.5 Never create a required creative slot

This is where fabrication pressure actually originates. If the competitive section *must* hold three
competitors and research found none, the model will produce three.

**Every slot is optional.** *"We couldn't find comparable players in public sources"* is a valid, shipped
output. Obscure sectors are a real case, not an edge case.

### 8.6 Cost and time ceilings

- **5 web searches per run**, hard cap.
- Corpus cap unchanged (40K tokens), with the rubric-led ordering from 2026-10-30.
- Per-run cost estimated from `response.usage` and **logged on the engagement** — §7's v2 table is
  unverified until this exists.
- A timeout mid-stream ships a **clearly-marked partial**, not an error pill.

### 8.7 On the orchestration agent — deliberately demoted

The operator asked about an orchestration or critic agent that checks the work. Straight answer: **it is
the most reassuring of these guardrails and roughly the least effective.** A critic has no independent
access to truth — it is the same model grading its own homework from the same evidence, and it will
confidently approve a fabricated competitor because nothing in its context contradicts it.

Defensible ordering: **structural impossibility → deterministic verification → golden-set calibration →
one judge, for genre quality only.** The critic earns a place last and smallest. §8.4's single judge pass
*is* that place.

### 8.8 The correction path — DECIDED 2026-10-31

The operator chose the correctable distillate over read-only playback. It is the better product, and it
makes §8.2 a real guardrail rather than an invitation to notice a problem and be unable to fix it. It also
brings four consequences that must be designed, not discovered.

#### A correction never consumes a second pre-screen

**Non-negotiable.** The correction fixes *our* misreading, not the customer's mistake. Charging them a
venture claim for it would make nobody bother correcting anything, which destroys the guardrail the feature
exists to provide.

But unlimited corrections are unlimited re-rolls, and this is the third time that hole has appeared — the
self-re-run and abandoned-run holes were both closed on 2026-10-30. So corrections are **bounded at 2 per
venture**, counted on the engagement, and a correction **does not release**
`prescreenVentureKey` / `prescreenClaimedAt` (`api/memo.js` ~line 216). Two is enough to fix a real
misreading and not enough to shop for a band.

#### What re-runs, and what it costs

The distil pass does **not** re-run — we are replacing its output with theirs. Everything downstream does,
because all of it reads the brief:

| Phase | On correction |
|---|---|
| 1 — Distil | **skipped** (superseded by the customer's version) |
| 2 — Research | re-runs: queries derive from sector, market and named competitors |
| 3 — Reason | re-runs: all six calls read the brief |
| 4 — Band | re-runs |

So a correction costs ~**$0.95** of the ~$1.10 run — most of it. Two allowed corrections make a worst-case
venture ~$3.00.

**Field-level invalidation is permitted but conservative.** A map may declare that a field affects only
some phases — correcting the *ask* need not re-run the competitive search. The rule: **default to
re-running everything, and exempt only fields that provably affect nothing else.** A wrong map ships a
stale nugget beside a corrected brief, which is worse than paying to re-run.

#### Edited fields are customer-asserted, and must be marked as such

This is the non-obvious consequence. §8.1 verifies every claim by substring against the source document. **A
customer-edited field has no document to check against**, so either the citation gate fails on legitimate
edits, or it gets relaxed and the whole protection is lost.

Neither. Edited fields carry `source: 'customer'`, are **exempt from the substring check**, and are
**visibly attributed on screen** as supplied by the founder rather than read from the documents.
`prescreen-citations.mjs` (§9) must know the difference — an unmarked unverifiable claim is a gate failure.

This matters beyond the pre-screen page: a frozen memo link is shareable and an investor may read it
(`os_shareable_memo_signoff`). **Any export or shared artefact carries the same attribution.** A founder's
unverified assertion must never appear in something with our name on it as though we had checked it.

#### Corrected runs cannot calibrate, and the band supersedes visibly

- **Excluded from the golden set.** A run whose brief was edited is no longer a measurement of our reading,
  so `prescreen-bands.mjs` and `prescreen-direction.mjs` (§9) must filter on `briefEdited`. Including them
  would calibrate the instrument against the customer's own description of themselves.
- **The previous band stays visible as superseded**, never silently overwritten. A correction may move the
  band **either way** — same principle as §3.1 — and a dial that quietly changes its own mind is a dial
  nobody trusts. "We misread you; here is the corrected read" is a better moment than a number that was
  never wrong.

---

## 9. Gates

In the spirit of the twelve existing gates. The first four exist to make §3 hold long after this
conversation is forgotten.

| Gate | Asserts | Cost |
|---|---|---|
| **`prescreen-deckonly.mjs`** | The same venture run deck-only ships a complete nugget set — thesis, bull, bear, competitive, team. If it degrades into "upload more documents", **fail**. | model calls (`--spend`) |
| **`prescreen-direction.mjs`** | Across the golden set, adding a data room moves bands in **both** directions at least sometimes. Monotonically upward = we are scoring documents. **Fail.** | model calls (`--spend`) |
| **`prescreen-vocabulary.mjs`** | No document-centric language — "missing", "not provided", "no evidence of", "incomplete" — in the **insight** sections. Permitted in the coverage panel and nowhere else. | **free** |
| **`prescreen-composition.mjs`** | A minimum proportion of shipped nuggets carry an external `source_url`. A run shipping only observations about the customer's own files has become an audit again — and the fix is better research, never padding. | **free** |
| **`prescreen-citations.mjs`** | Every claim object in a stored result passes §8.1's substring and URL checks. Catches a pipeline that stopped enforcing them. | **free** |
| **`prescreen-bands.mjs`** | Ordinal agreement with the 13 assessed engagements above a floor; **and** no single band holds >60% of the golden set. The distribution half is the permanent version of the bug caught on 2026-10-30, when 16 of 28 signals landed on exactly 3. | model calls (`--spend`) |
| **`prescreen-determinism.mjs`** | Same documents, two runs, same band. | model calls (`--spend`) |
| `prescreen-logic.mjs` | Extended: the 21 existing offline sections, minus the range-construction ones, plus §3 and §8's invariants. | **free** |

**Gate 4 (`composition`) is the structural one.** It makes "look outward" a requirement of a valid run
rather than a good intention — it is the single check that most directly prevents the v1 relapse.

The `--spend` convention is already established: `tools/grounding.mjs` requires it, and deletes
`ANTHROPIC_API_KEY` without it (`feedback_model_gates_cost_real_money`). Every new spending gate follows
that pattern. **None runs in a routine sweep.**

---

## 10. What this changes in the existing build

| Piece | Fate |
|---|---|
| `api/_prescreen.js` — 21 probes, 0/0.5/1 scale, floor/ceiling range, Bayesian ceiling | **Retired.** The scale work of 2026-10-31 (`SIGNAL_SCALE`, `assumedForUnseen`) was correct for v1 and dies with it. |
| `api/_prescreen.js` — corpus build, rubric-led ordering, dedupe, truncation, deck recovery | **Carried over unchanged.** Still what stops the memo being crowded out. |
| `api/_roomcheck.js` + the coverage read | **Carried over, demoted** to its own panel (§3.4). |
| `api/memo.js` — `prescreen-warm` / `-category` / `-finalise` | **Reshaped** to the four phases. The self-re-run guard and 30-minute claim lease survive as-is. |
| `shared/m3/ds.js` — `prescreenStage`, `revealLive`, landing marks, dropzones | **Carried over.** Becomes the insight delivery surface (§6.5). |
| `DS.rangeFindings`, `rangeStale`, `rangeNext`, the Range tab | **Replaced** by the band + nuggets. The legacy 0–5 detection in `rangeFindings` can go with it. |
| v1 §8.3 — range as snapshot zero | **Reopened.** A band is not a composite, so what the pre-screen writes into `investabilitySnapshots` needs re-deciding. Was already NOT BUILT. |
| `tools/prescreen-containment.mjs` | **Superseded** by `prescreen-bands.mjs`. Interval containment is not the test any more; ordinal agreement is. |
| `tools/prescreen-calibration.mjs`, `prescreen-inspect.mjs` | **Keep.** Both free, both still useful for reading a result. |
| v1 §8.1–8.2, §8.4, §8.6 — one screen, tabs by state, entitlements, one scored pre-screen per venture | **Untouched.** |

### Existing snapshots

Pre-screens stored on the 0–5 scale and on the 0/0.5/1 scale are **both** incomparable with a band. They
need either a display guard in the spirit of `isV3Scale` (`os_rerun_adoption_and_v3_guard`) or deletion.
Decide before the first v2 run writes alongside them.

---

## 11. Still open

1. ~~**Distillate correction**~~ — **DECIDED 2026-10-31: correctable, in v2.0.** See §8.8 for the
   mechanism, the 2-per-venture bound, the re-run scope and the customer-asserted provenance rule.
2. **Snapshot zero** — what a band writes into the living investability score, given it is not a number
   (`os_living_investability_score`).
3. **The band↔verdict mapping — DECIDED 2026-10-31.** Do not invent thresholds. The runner already has
   four named guidance bands at **80 / 60 / 40** (`GUIDANCE_BANDS` in `shared/vss-rubric.js`, `BOOK_BANDS`
   in `ds.js`), stamped on the snapshot and never recomputed because READY carries gates the composite
   cannot see. The pre-screen's three bands collapse the top two:

   | Pre-screen band | The full assessment would land | Composite |
   |---|---|---|
   | **High** | READY or PROMISING | ≥ 60 |
   | **Medium** | HIGH_RISK | 40–59 |
   | **Low** | POTENTIAL_DECLINE | < 40 |

   Collapsing READY and PROMISING is deliberate: to the question *"is this worth assessing?"* both answer
   **yes**, and the pre-screen is not entitled to split them (§2).

   **Calibration step zero is free and needs no API call:** list the composites of all 13 assessed
   engagements and check they spread across three bands. The five in v1 §10 (53, 46, 47, 62, 76) land
   Medium / Medium / Medium / High / High — three of five in one band, exactly on
   `prescreen-bands.mjs`'s 60% distribution limit. If the full 13 cluster, **move the cuts before paying
   for a replay**, not after.

   *Open sub-item:* MoneyGym's composite is recorded as **76** in v1 §10, from the containment replay; the
   operator recalls **80**. Both map to High, so the mapping above is unaffected, but the gate's expected
   values need the real number. Confirm from the engagement doc before `prescreen-bands.mjs` asserts
   anything.
4. **The pending containment replay** — ~$8–10, unauthorised. §2 changes what it must prove, so **do not
   run v1's version.** −0.23 stands as the last measured correlation until a band replay runs.
5. **Old snapshots — DECIDED 2026-10-31: delete.** The two existing pre-screens are on retired scales
   (one 0–5, one 0/0.5/1) and neither is comparable with a band, so no display guard is worth building.
   Deleting also clears each venture's pre-screen claim, so both can be re-run on v2. The findings worth
   keeping are already recorded in `os_prescreen_scoring_calibration`.
6. **Research query provenance** — whether the 5 search queries are themselves shown to the customer.
   Arguably the most trust-building thing on the page, at zero cost.
7. **Vercel plan** — `api/` at the 12-function cap. v2 adds actions, not files, so it fits. **Stripe's
   webhook will not.** Unchanged from v1 §9.
8. **"Pre-Screen Tests" org is still on the `assess` preset** — the free-tier path has never been exercised
   in the real product.
