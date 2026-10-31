# CLAUDE.md — Ventrify OS

Rules for the product at `os.ventrify.io` and `verdict.ventrify.io`. The repo-root `CLAUDE.md` covers the
marketing sites; where the two disagree about the OS, this file wins.

## Verification: run it, don't read it

**This exists because of a specific, repeated failure.** On 2026-10-31 five new pre-screen actions shipped
with 141 passing offline checks. Every one was unreachable — `memo.js` guards its dispatcher with an
`ACTIONS` whitelist and none had been added. The first thing the operator saw was `bad_action`. Every gate
covering that work read source text.

**Reading proves you wrote what you meant to write. Only running proves it works.** Grep-based gates are
cheap, so they accumulate fast and feel like coverage. They cannot catch a reachability break, a CSS
specificity loss, a scroll container that makes `window.scrollTo` a no-op, an API whose response shape
differs from the one assumed, or any wiring that was never exercised. Every one of those has shipped here.

### The claim ladder — say which rung you are on

| Rung | Earned by | What you may say |
|---|---|---|
| **built** | the code exists and parses | "built — not yet checked" |
| **statically checked** | the offline gates pass | "built and statically checked, **not yet exercised**" |
| **exercised** | the path ran: a request, a render, a real call | "exercised — <what ran>" |
| **verified** | it ran against real data and produced the right answer | "verified: <the evidence>" |

**Never say "ready to test", "this works", or "good to run" below the `exercised` rung.** If the path has
not been executed, say so in the same breath as the claim. The operator can decide to test an unexercised
build; what they cannot do is un-waste an afternoon spent on one they thought was exercised.

### Before telling the operator a build is ready

1. `node tools/contract.mjs` — every action the client can post actually answers. Free. **This is the gate
   that was missing**; it would have caught the 2026-10-31 bug in two seconds.
2. The offline gates for whatever was touched (`prescreen2-logic`, `plan-parity`, `room-parity`,
   `prescreen-vocabulary`, …).
3. `node _redesign/m3/conformance.mjs` for any page change, and `motion-gate.mjs` for any animated one.
4. If it calls a model: **prove the request shapes free first** with
   `POST /v1/messages/count_tokens`, which validates `output_config` schemas and the `tools` array,
   returns 200 even at a zero credit balance, and costs nothing. Then one minimal real call before any
   full run. See [[web_search_encrypted_content]].

### Every bug that reaches the operator ships with the gate that would have caught it

Not the fix alone — the fix **and** the check. This is how the existing suite came to exist, and it is why
it is worth adding to: the gate list is a record of every mistake made here. A fix without a gate is a
promise to be more careful, which is worth nothing.

### A gate that cannot fail is decoration

Give a new gate a canary: feed it something that must fail and assert it does. The first version of
`contract.mjs` reported twenty failures against healthy code, and the second reported a pass on an action
that cannot exist. Both were found by making the gate prove itself — not by trusting it.

## Spending

- **The full assessment runs on the Claude subscription** (GitHub Actions). **The pre-screen and the chat
  call the API and spend credits.** Never conflate them when discussing cost.
- `tools/grounding.mjs` and `prescreen-containment.mjs --live` cost real money. **Ask first, every time.**
  Never run them in a routine sweep.
- Quote a measured number or say the figure is predicted. Do not present an estimate as a measurement.

## Deploying

Production tracks `main`. Pushing the feature branch alone only creates a Preview, so a deploy is
`git push origin m3-workspace-migration:main`. Builds take ~60–130s. **Verify the deploy landed by
fetching the changed asset**, not by assuming the push was enough.

`api/` sits at exactly Vercel's 12-function Hobby cap. **A new `api/*.js` file fails the whole deploy** —
fold new work into an existing function and dispatch on an action, and add that action to the dispatcher's
whitelist. Underscore-prefixed files (`_prescreen2.js`, `_corpus.js`) are not counted.
