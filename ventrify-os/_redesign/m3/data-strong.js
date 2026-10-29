/* ═══════════════════════════════════════════════════════════════════════════
   STRONG-STATE OVERLAY — a showcase fixture, NOT an assessment result.

   ⚠️  THE NUMBERS AND NOTES BELOW ARE FABRICATED.
   The real MoneyGym assessment scores 18.5/35 → a composite of 55, band
   PROMISING, recommendation "Diligence further". That is what `data.js`
   carries and what the live screens render.

   This overlay exists because the product's styling has to be judged in its
   GOOD state as well as its cautious one: at 55 the verdict renders amber
   throughout and the green/READY treatment — the band chip, the conviction
   pips, the bull-weighted case, the "Investment ready" guidance — is never
   exercised. Those are a large part of the interface and they were going
   unseen.

   It takes the real MoneyGym venture and asks "what would this look like if
   the gaps had been closed", which is also the honest version of the
   fiction: every raised signal corresponds to a specific gap the real
   assessment named, and the note says which one. Nothing here should ever
   be presented as MoneyGym's result.

   Composite is NOT hardcoded. It is Σ(weightPct × frac) over the seven
   categories, the same arithmetic the runner uses, and it computes to 80.0.
   Change a frac and the headline moves with it.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ASSESSMENT as BASE, SCORE as BASE_SCORE } from './data.js';

/* frac per category → the composite falls out of the weights in data.js.
   20·.8 + 25·.8 + 15·.9 + 15·.8 + 10·.8 + 10·.6 + 5·.9 = 80.0 */
const FRAC = {
  market: 0.8, team: 0.8, product: 0.9, moat: 0.8,
  financial: 0.8, execution: 0.6, evidence: 0.9,
};

/* The five sub-scores per category, in rubric order. Each set sums to
   frac × 5, because that is the invariant the Investability tab renders. */
const SUBS = {
  market: [
    [1,   'Bottom-up TAM rebuilt and defended at $2.1B — the deck’s $110B claim was withdrawn and restated in the data room.'],
    [1,   'Category growing 19% CAGR, and MoneyGym-specific: US waitlist compounding 14% month on month for nine months.'],
    [1,   'Credible why-now: $17.9T US household debt, 57% living paycheck-to-paycheck, and the post-Mint PFM gap.'],
    [0.5, 'US demand now evidenced — 4,100 paid trials at $12/mo — but still three quarters short of a durable cohort read.'],
    [0.5, '79% gross margin holds with app-store fees inside COGS; blended margin is 71% and not yet proven at scale.'],
  ],
  team: [
    [1,   'Corner communicates a clear vision; a verified UK digital-banking veteran (first direct, HSBC, Egg, Aldermore).'],
    [1,   'ML lead hired — ex-Monzo data science, owns the four-engine build. The hire the moat depended on is closed.'],
    [1,   'Genuine founder–market fit; ran ilumoni in the adjacent UK consumer-debt space.'],
    [0.5, 'ilumoni dissolved 2024; the pivot rationale is now documented, but there is still no completed venture outcome.'],
    [0.5, 'All three co-founders verified against Companies House; Goudge’s equity remains unvested and undocumented.'],
  ],
  product: [
    [1,   '“Noom for money” — a partner can repeat the value prop in one sentence after one read.'],
    [1,   'Deterministic engines beat Cleo’s LLM-only coaching on the two published head-to-heads — 31% better adherence at 90 days.'],
    [1,   'MVP scoped tight to the four-engine stack; a disciplined Must-Have set.'],
    [1,   'Personas grounded in a substantive paycheck-to-paycheck consumer voice.'],
    [0.5, 'Problem validated by macro data and 4,100 US trials; the qualitative depth is still UK-weighted.'],
  ],
  moat: [
    [1,   'The deterministic four-engine ML approach is differentiated in concept vs Cleo’s LLM-only — and is now built and live.'],
    [1,   'Two provisional patents filed on the adherence-scoring engine; the training corpus is proprietary and unlicensable.'],
    [1,   'Behavioural history creates real switching cost — 90-day retention is 68% against a category median near 41%.'],
    [0.5, 'Software scales, but the 0.4–0.6 viral coefficient underpinning the plan is measured at 0.38 so far.'],
    [0.5, 'Two distribution partnerships signed (one credit union, one employer benefits platform); neither is exclusive.'],
  ],
  financial: [
    [1,   'Model reconciles — the +$4.25M / −$1.94M cash-trough contradiction is resolved and break-even is stated once, at M29.'],
    [0.5, 'LTV/CAC 4.1:1 on measured US data with app-store fees in COGS — real, but below the 6:1 the deck claimed.'],
    [1,   'Sensitivity analysis present; the founder’s own model flags where 20% trial-to-paid breaks the plan.'],
    [0.5, 'The ask is milestone-anchored to the Series-A gate, but the tranche trigger is described rather than defined.'],
    [1,   'The data room discloses several key risks openly — a genuine positive.'],
  ],
  execution: [
    [1,   'Product is live in the US App Store; all four engines shipped, not simulated.'],
    [0.5, 'IA covers the core loop; the coaching and reporting surfaces are still partial.'],
    [0.5, 'Shipped three of four roadmap gates on schedule; the fourth slipped a quarter.'],
    [1,   'Paying users from month two — $47K MRR, collected, no pilots counted as revenue.'],
    [0,   'Revenue is nine months old. There is no multi-year retention or expansion curve yet, and there cannot be.'],
  ],
  evidence: [
    [1,   'Every load-bearing claim carries a source; 32 sources across 18 documents.'],
    [1,   'Source count clears the L3 threshold — primary filings, Carta benchmarks, a ten-competitor teardown.'],
    [1,   'No unsupported assertion survived the check; three deck claims were corrected against primary sources.'],
    [1,   'Method stated in full — three blind draws per signal, median taken, quorum of two.'],
    [0.5, 'One residual inconsistency between the model and the deck on month-24 headcount.'],
  ],
};

const n1 = (x) => (Math.round(x * 10) / 10).toString();

/** Rebuild the score object from FRAC + SUBS, preserving everything else. */
export function strongScore(S = BASE_SCORE) {
  const categories = S.categories.map((c) => {
    const frac = FRAC[c.key];
    const subs = SUBS[c.key];
    if (frac == null || !subs) return c;
    const num = frac * 5;
    const sum = subs.reduce((t, [v]) => t + v, 0);
    if (Math.abs(sum - num) > 1e-9) {
      throw new Error(`data-strong: ${c.key} subs sum to ${sum}, expected ${num}`);
    }
    return {
      ...c,
      frac,
      num:   n1(num),
      rated: n1(num),
      pot:   Math.max(frac, c.pot),
      low:   frac < 0.5 ? true : undefined,
      subs:  c.subs.map((s, i) => ({ ...s, score: subs[i][0], note: subs[i][1] })),
    };
  });

  const composite = categories.reduce((t, c) => t + c.weightPct * c.frac, 0);
  const potential = categories.reduce((t, c) => t + c.weightPct * Math.max(c.frac, c.pot), 0);

  return {
    ...S,
    categories,
    composite: Math.round(composite),
    potential: Math.round(potential),
    band: 'Investment ready',
    /* ⚠ ILLUSTRATIVE. The runner computes three blind draws per signal and
       publishes only the median, so no real snapshot carries this yet. Here
       so the stability strip can be reviewed; the live page has no `draws`
       and correctly renders "not recorded". */
    draws: [78, 81, 80],
  };
}

/* The same nine pre-wire checks, in the state a READY verdict implies.
   Leaving the originals alone produced a page that said "Proceed" at the top
   and "Three blockers stand between this and a wire · Do not wire" two tabs
   later — the gate is derived from these rows, so the verdict and the gate
   have to come from the same story. Blockers resolved; the open items are the
   ones a strong deal still legitimately carries. Order matches data.js. */
const DILIGENCE = [
  [true,  'Round repriced', 'Repriced to $28M pre with a $12M milestone tranche at the Series-A gate — inside the $20–35M the three valuation methods support.'],
  [true,  'Financial model reconciled', 'Single reconciled model in the data room: break-even at M29, one cash curve, trial-to-paid stated once at 31% and matching the cohort data.'],
  [true,  'ilumoni record + co-founder roles verified', 'All three co-founders confirmed against Companies House; raw population-weighted PoC metrics supplied and independently recomputed.'],
  [true,  'Cleo differentiation answered', 'Two published head-to-heads: 31% better 90-day adherence than Cleo on matched cohorts, from the deterministic engines rather than prompt quality.'],
  [true,  'ML / data lead secured', 'Hired — ex-Monzo data science, started March, owns the four-engine build. Two provisional patents filed since.'],
  [false, 'Pressure-test CAC compression + distribution', 'Measured viral coefficient is 0.38 against the 0.4–0.6 the plan assumes. Independent validation still outstanding, and the two partnerships are non-exclusive.'],
  [true,  'Gross-margin treatment confirmed', 'App-store fees are inside COGS; restated blended gross margin is 71%, and LTV/CAC restated to 4.1:1 on measured US data.'],
  [false, 'Correct the §1033 framing', 'Open-banking framing in the deck still overstates what §1033 compels. Cosmetic, but it is a claim and should be corrected before the memo circulates.'],
  [false, 'Confirm the definitive raise amount', 'Both "$20M" and "$22M" still appear in the data room. Confirm the number before papering.'],
];

/** The verdict copy that goes with a READY band. */
export function strongAssessment(A = BASE) {
  const diligence = (A.diligence || []).map((d, i) => {
    const row = DILIGENCE[i];
    if (!row) return d;
    const [done, title, note] = row;
    // `kind` stays as it is: it classifies the check (blocker / key / standard)
    // and drives the segment colour. `done` is the separate axis the row and
    // the clearance count both read, so a cleared blocker is still a blocker
    // — which is the honest reading, and what the gate logic expects.
    return { ...d, done, title, note };
  });
  return {
    ...A,
    diligence,
    recommendation: 'Proceed',
    verdictLine: 'Proceed — the moat is built and the price now fits.',
    verdictEm: 'Proceed',
    conviction: 'High',
    thesis: 'A real, government-verified macro pain met by a shipped four-engine product doing measurably better than the category leader on adherence — 68% ninety-day retention against a ~41% median — with $47K MRR nine months old, an ML lead hired, and a price that has come back to the evidence.',
    biggestRisk: {
      label: 'Durability',
      headline: 'Nine months of revenue cannot show a retention curve.',
      text: 'The thesis rests on behavioural lock-in compounding, and the 68% ninety-day number is strong — but it is one cohort, nine months old. No twelve-month retention, no expansion revenue and no churn seasonality exist yet, and the 0.38 measured viral coefficient is below the 0.4–0.6 the plan assumes. The risk is no longer whether it works; it is whether it keeps working at month 24.',
    },
    mustBeTrue: [
      'Ninety-day retention at 68% holds through month twelve — the lock-in thesis is a compounding claim and only one cohort has been observed.',
      'The viral coefficient recovers from a measured 0.38 toward the 0.4–0.6 the CAC-compression plan depends on.',
      'The two distribution partnerships convert; neither is exclusive, and both are renewable inside twelve months.',
    ],
    signoff: {
      ...A.signoff,
      note: 'Endorse — proceed at the stated terms; revisit on the month-twelve retention read before the Series-A tranche.',
    },
    heroes: {
      ...A.heroes,
      investability: {
        ...A.heroes.investability,
        headline: 'Strong across the board — and young, not thin.',
        headlineEm: 'young, not thin',
        facts: [
          { k: 'Carries the score', v: 'Product <small>4.5 / 5</small> · Evidence <small>4.5 / 5</small>' },
          { k: 'Holds it back',     v: 'Execution <small>3.0 / 5</small> — revenue is 9 months old' },
        ],
        thesis: 'The 80 is broad rather than carried by one category: six of seven sit at 4.0 or better, and the one that does not — execution at 3.0 — is held down by time rather than by absence. The remaining +8 headroom is almost entirely a retention curve that does not exist yet and cannot be bought.',
      },
    },
  };
}
