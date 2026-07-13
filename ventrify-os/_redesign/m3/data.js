import { adaptGaps, linkGapsToMembers } from '../../shared/m3/adapter.js';
// ============================================================
// Ventrify OS — Design System · sample data
// Mirrors the live workspace data shapes (assessment verdict + VSS score +
// engagements + queue). The showcase and the experimental pages both render
// from this, so a data-shape change is felt everywhere at once.
// ============================================================

// ---- Deep-research bodies (real MoneyGym content, as the runner's agents emit it: GFM markdown).
// These exercise every block the old mdToHtml() silently dropped — pipe tables, `---` rules, fenced
// code, nested + task lists, and `~` used as "approximately". If the reading room renders these
// faithfully it will render anything the agents produce. ----
const RB = {};

RB.marketSizing = `MoneyGym's category is genuinely large and investable — but the deck's headline TAM is a category error, and correcting it changes the investment story.

## The deck's claim, and how it was derived

The pitch (v0.1a, slide 4) claims **TAM $110B · SAM $13B · SOM $315–331M** — 4M subscribers at $99 ARPU by Year 5. The $110B is bootstrapped from 2022 Forbes/CNBC estimates of consumer spending on fintech: payments, lending, investing and insurance distribution. None of those revenue pools is addressable by a $99/year coaching subscription.

It is broadly consistent with Statista/BCG totals for *all* US fintech revenue. That is the error — counting an entire industry as the addressable pool for one product.

| Level | Deck | Rebuilt bottom-up | Overstatement |
| --- | --- | --- | --- |
| TAM | $110B | $1.5–2.5B | 44–73× |
| SAM | $13B | $1.0–2.0B | ~7–13× |
| SOM (Year 5) | $315–331M | $100–200M | ~1.7–3× |

---

## TAM — rebuilt bottom-up

The true TAM is the maximum annual subscription revenue if every US adult who would plausibly pay for behavioural-change financial coaching subscribed at $99/year — excluding payments, brokerage, lending spread and banking fee income.

- **Baseline.** US Census (Jul 2024): ~267M adults aged 18+.
- **Financially stressed and open to paid help.** FINRA's 2024 National Financial Capability Study puts 57% in negative financial stress — a theoretical problem pool of 120–140M.
  - Of those, the share that has *ever* paid for financial guidance is far smaller.
  - Adjacent behavioural-change categories are the only honest comparator.
- **Paid-conversion precedent.** Noom and Duolingo convert 6–10% of the interested pool to paid.

Applying that band to the stressed pool at $99 ARPU lands TAM at **$1.5–2.5B**. Still large enough to back a venture-scale outcome. Nowhere near $110B.

## SOM and the distribution check

The deck's 4M-subscriber SOM ($331M) implies capturing **17–33% of the corrected SAM** — category dominance, not the "conservative ~2.5% penetration" it claims.

The reachability check is where it breaks. Four million paying subscribers, at the deck's *own* 15% trial rate and 20% trial-to-paid, requires **70–130M US installs** — 3–6% of all US finance-app installs, sustained for five straight years, on an unproven 0.4–0.6 viral coefficient.

> A $331M Year-5 SOM is 17–33% of the corrected SAM — an aggressive dominance assumption dressed up as a floor.

## Red flags

1. **Category-error TAM.** The $110B counts all US fintech revenue; the first-principles pool for a $99 coaching subscription is 44–73× smaller.
2. **"Conservative" SOM isn't.** See the distribution check above.
3. **No bottom-up model in the data room.** The TAM/SAM/SOM slide cites two press articles and no build-up.

## What the numbers actually support

At corrected scale MoneyGym is still a backable market: a $1.5–2.5B TAM comfortably supports a venture-scale outcome, and the behavioural-subscription model is proven next door. The question is not "is the market big enough" — it is whether MoneyGym can win a credible slice against an entrenched, profitable Cleo. That is where the moat and distribution diligence take over.

## Sources & references

1. MoneyGym pitch deck v0.1a, slide 4 — Ventrify data room
2. [Statista — US fintech revenue by vertical, 2024](https://www.statista.com/markets/414/topic/1032/fintech/)
3. [US Census Bureau — Population estimates, Jul 2024](https://www.census.gov/quickfacts/fact/table/US/PST045224)
4. [FINRA Foundation — National Financial Capability Study 2024](https://finrafoundation.org/knowledge-we-gain-share/nfcs)
5. Noom / Duolingo — reported free-to-paid conversion benchmarks (investor filings)
6. [RevenueCat — State of Subscription Apps 2024](https://www.revenuecat.com/state-of-subscription-apps/)
7. MoneyGym conversion funnel + financial model (05-*) — Ventrify data room
8. [Carta — State of Private Markets, Q3 2025](https://carta.com/data/state-of-private-markets-q3-2025/)`;

RB.competitiveBenchmark = `The deck presents an unclaimed category. It is not unclaimed — Cleo owns it, at ~7M users and $280M+ ARR, and is never mentioned once in the pitch.

## The field

Ten competitors were scored head-to-head on the five metrics that decide this category. Scores are 1–5; **bold** marks the category leader on that axis.

| Company | Users | ARR | Coaching depth | Regulatory exposure | Score |
| --- | ---: | ---: | ---: | --- | ---: |
| Cleo | ~7.0M | $280M+ | 4 | High — FTC $17M settlement | **4.4** |
| Dave | ~10.0M | $260M | 2 | High — DOJ/FTC action | 3.1 |
| Brigit | ~4.0M | $110M | 2 | High — FTC $18M settlement | 2.8 |
| Empower | ~3.5M | $95M | 3 | Medium | 2.7 |
| Albert | ~2.0M | $90M | 3 | Medium | 2.6 |
| Copilot | ~0.3M | $18M | 3 | Low | 2.4 |
| Monarch | ~0.2M | $15M | 4 | Low | 2.4 |
| Origin | ~0.1M | $9M | 4 | Low | 2.2 |
| Tally *(shut down 2024)* | — | — | 2 | High | — |
| **MoneyGym** | 0 | $0 | **5** | **Low — non-lending** | 1.9 |

---

## Where MoneyGym actually wins

Two axes, and only two — but they are the two that compound.

- **Coaching depth (5/5).** Every incumbent bolts coaching onto a lending or cash-advance product. Coaching is the wedge, not the business.
- **Regulatory temperature (low).** This is the finding the deck under-sells.
  - Cleo — FTC, $17M, deceptive cash-advance marketing.
  - Dave — DOJ and FTC action over tipping and express fees.
  - Brigit — FTC, $18M, subscription and advance practices.
  - Tally — shut down entirely in 2024.
  - MoneyGym takes no lending spread, charges no advance fee, and holds no balances. It has nothing for those regulators to reach.

The enforcement wave has hit *every* profitable player in this category, and it has hit them on the lending mechanic — not the coaching one.

## The distribution problem

Category economics are set by CAC, and CAC in consumer finance is set by whoever is willing to buy the install. Cleo, Dave and Empower are all buying. A rough model of the position MoneyGym enters at:

\`\`\`
blended_cac   = paid_cac × (1 − viral_share) + 0 × viral_share
payback_months = blended_cac / (arpu_monthly × gross_margin)

# MoneyGym, deck assumptions
paid_cac       = $13.00      # claimed, post-ilumoni
viral_share    = 0.45        # implied by k = 0.4–0.6
arpu_monthly   = $8.25       # $99 / 12
gross_margin   = 0.72        # after app-store fees
→ payback = 1.2 months       # not credible for a cold-start consumer app
\`\`\`

The \`$13.00\` figure is carried over from ilumoni, a *dissolved* predecessor with a different product, a UK audience and a loans-marketplace acquisition motive. It cannot be assumed forward. At a realistic $45–70 blended CAC, payback moves to **7–12 months** — survivable, but it changes the raise.

## Diligence still open

- [x] Score the field on the five decision metrics
- [x] Verify Cleo's user, ARR and profitability claims against filings
- [x] Confirm the enforcement actions against Cleo, Dave, Brigit and Tally
- [ ] Obtain MoneyGym's actual paid-channel test data (none in the data room)
- [ ] Pressure-test the 0.4–0.6 viral coefficient against a real cohort

## Sources & references

1. [Cleo — company profile and reported metrics](https://web.meetcleo.com/)
2. [FTC v. Cleo AI — $17M settlement, 2025](https://www.ftc.gov/news-events/news/press-releases)
3. [FTC v. Brigit — $18M settlement](https://www.ftc.gov/news-events/news/press-releases)
4. [Dave Inc — SEC filings](https://www.sec.gov/edgar/search/)
5. [RevenueCat — State of Subscription Apps 2024](https://www.revenuecat.com/state-of-subscription-apps/)
6. MoneyGym financial model + sensitivity workbook — Ventrify data room
7. Founder letter and ilumoni retrospective — Ventrify data room`;

RB.teamDiligence = `Two of the three co-founders named in the deck cannot be verified against any Companies House filing for the predecessor company they are credited with building.

## What was checked

Every founder claim in the deck and the founder letter was matched against UK Companies House filings for **Monely Ltd** (trading as ilumoni), the predecessor MoneyGym's traction is drawn from.

| Claim | Source | Verdict |
| --- | --- | --- |
| Three co-founders built ilumoni | Deck, slide 11 | **Unverified** — only 1 of 3 appears on any filing |
| £1.63M raised | Founder letter | Verified — SH01 filings, 2021–2023 |
| "Acquired talent from Monzo, Revolut" | Deck, slide 11 | Partially verified — 1 of 2 confirmed on LinkedIn |
| CEO previously exited a fintech | Deck, slide 11 | **Refuted** — the company entered members' voluntary liquidation |

---

## The predecessor

ilumoni / Monely Ltd entered **members' voluntary liquidation in 2023** and was dissolved in **August 2024**. It raised ~£1.63M, never passed 10,000 users, and operated a loans-marketplace model that MoneyGym has since dropped entirely.

An MVL is a solvent wind-down, not an insolvency — the founders returned capital rather than losing it, which is materially better than the alternative. But it is not an exit, and the deck presents it as one.

## What this means for the raise

- The CEO has genuinely operated a regulated UK fintech, raised institutional money, and wound it down cleanly. That is real, relevant experience.
- The *team* as presented does not exist yet. Two of three named co-founders have no filing record on the company that supplies all of MoneyGym's traction narrative.
- No US operating experience anywhere on the team, for a product whose entire market thesis is US consumer.

> Recommendation: request the cap table and the employment contracts before term-sheet. If the two unverified co-founders are prospective rather than committed, the round is a solo-founder round and should be priced as one.

## Sources & references

1. [Companies House — Monely Ltd filing history](https://find-and-update.company-information.service.gov.uk/)
2. Founder letter and ilumoni retrospective — Ventrify data room
3. MoneyGym pitch deck v0.1a, slide 11 — Ventrify data room
4. LinkedIn profile verification, accessed at assessment date`;

RB.claimsPressureTest = `Twelve load-bearing claims were pressure-tested against primary sources; three fail outright and four require correction before the deck is shown to another investor.

## Method

Every quantitative or competitive claim in the deck, the founder letter and the model was extracted, traced to its source, and independently verified. A claim **fails** when the primary source contradicts it, not when it is merely optimistic.

| # | Claim | Verdict | Evidence |
| ---: | --- | --- | --- |
| 1 | TAM is $110B | **Fail** | Counts all US fintech revenue; bottom-up rebuild → $1.5–2.5B |
| 2 | "First AI money coach" | **Fail** | Cleo has used the exact phrase since 2019 |
| 3 | CAC compressed £148 → £13 | **Fail** | ilumoni-era, different product, dissolved entity |
| 4 | §1033 open banking is a tailwind | Correct | Rule is legally enjoined as of mid-2026 |
| 5 | 35% trial-to-paid | Correct | Model uses 20% elsewhere; both figures appear |
| 6 | Raising $20M | Correct | Deck says $20M, model says $22M |
| 7 | Category is unclaimed | Correct | Cleo: ~7M users, $280M+ ARR, net-profitable |
| 8 | Non-lending = regulatory-cold | **Verified** | Enforcement has tracked the lending mechanic |
| 9 | $99 ARPU is defensible | **Verified** | WTP research supports a $95–144 band |
| 10 | Gross margin 72% | **Verified** | Consistent with app-store fee structure |
| 11 | Viral coefficient 0.4–0.6 | Unproven | No cohort data in the data room |
| 12 | Year-5 exit at $2.3B | Unproven | Implies 9× the corrected SOM |

---

## The three that matter

### 1. The category is not unclaimed

Cleo is at approximately **7M users, ~1.1M paying US subscribers, $280M+ ARR** and is net-profitable. It markets itself as the "first AI money coach". It does not appear anywhere in the deck. This is the single most consequential omission in the data room.

### 2. Traction belongs to a dissolved company

The £148 → £13 CAC compression — the deck's strongest proof point — was achieved by **ilumoni**, a loans-marketplace product, in the UK, by a company that was dissolved in August 2024. The acquisition motive, the geography and the product are all different. The number cannot be carried forward.

### 3. The §1033 tailwind is legally enjoined

The open-banking rule the deck leans on is enjoined as of mid-2026. The macro debt-stress tailwind stands on its own without it — but the deck must not present §1033 as live.

## What survives

The regulatory-cold positioning is real and structurally valuable. The willingness-to-pay band is verified. The gross margin holds. Corrected, this is still an investable thesis — it is just a different one from the thesis on the slides.

## Sources & references

1. MoneyGym pitch deck v0.1a — Ventrify data room
2. [Cleo — reported metrics and positioning](https://web.meetcleo.com/)
3. [Companies House — Monely Ltd filing history](https://find-and-update.company-information.service.gov.uk/)
4. [CFPB §1033 Personal Financial Data Rights rule — status](https://www.consumerfinance.gov/rules-policy/final-rules/)
5. MoneyGym unit economics + sensitivity workbook — Ventrify data room
6. Founder letter and ilumoni retrospective — Ventrify data room`;

RB.investmentAnalysis = `Three independent valuation methods converge on a $15–35M pre-money band, against an ask that implies materially more.

## The methods

| Method | Input | Output (pre-money) |
| --- | --- | --- |
| Comparable rounds | Seed fintech, pre-revenue, UK/US | $18–30M |
| Scorecard | VSS 67/100, solo-founder adjusted | $15–28M |
| Risk-factor summation | 12 factors, 3 material negatives | $20–35M |

**Converged band: $15–35M pre.** The deck's implied ask sits above the top of that range on a pre-revenue, single-verified-founder basis.

---

## The bull case

If the regulatory-cold positioning holds and coaching depth converts, MoneyGym is the only clean operator in a category where every profitable incumbent is carrying enforcement risk. Cleo's $280M ARR proves the willingness to pay; the FTC settlement proves the mechanic that produced it is fragile.

- A $1.5–2.5B corrected TAM supports a $200–400M outcome at 10–20% share.
- At a $25M entry, that is a **8–16×** gross return before dilution.

## The bear case

- Cleo is profitable, entrenched, and can add non-lending coaching in a quarter.
- The CAC number that underwrites the whole model belongs to a dissolved company.
- Two of three co-founders are unverified. This may be a solo-founder round.
- Distribution has no proven channel and no cohort data.

## Path to a return

The company does not need the deck's $2.3B exit to return a seed fund. It needs to reach $15–20M ARR on honest CAC and sell to an incumbent that needs a regulatory-clean coaching layer. That is a $200–400M outcome and it is reachable from the corrected numbers.

> The recommendation is not "pass". It is **reprice, and re-underwrite the team**.

## Sources & references

1. [Carta — State of Private Markets, Q3 2025](https://carta.com/data/state-of-private-markets-q3-2025/)
2. [PitchBook — seed-stage fintech valuations, 2025](https://pitchbook.com/news/reports)
3. MoneyGym financial model + sensitivity workbook — Ventrify data room
4. Ventrify VSS rubric v3 — internal
5. Comparable round set (n=14) — Ventrify data room`;

RB.unitEconomics = `The model contains a $6.19M contradiction: the same Year-5 scenario shows +$4.25M of EBITDA on one sheet and −$1.94M on another.

## The contradiction

Both figures are produced by the same workbook, from the same subscriber count, and differ only in whether app-store fees are applied before or after the coaching-cost allocation.

\`\`\`
Sheet "Summary"     Sheet "Sensitivity"
─────────────────   ───────────────────
revenue    $39.6M   revenue    $39.6M
cogs      −$11.1M   cogs      −$11.1M
app store       —   app store  −$6.19M   ← applied here only
opex      −$24.2M   opex      −$24.2M
─────────────────   ───────────────────
ebitda     +$4.25M  ebitda     −$1.94M
\`\`\`

The \`app store\` line is the whole delta. Apple and Google take 15–30% of consumer subscription revenue, and MoneyGym is an app-first product with no web-checkout path described anywhere in the data room. The Sensitivity sheet is the correct one.

---

## Corrected unit economics

| Metric | Deck | Corrected | Note |
| --- | ---: | ---: | --- |
| ARPU (annual) | $99 | $99 | Verified against WTP band |
| Gross margin | 72% | **58–64%** | After 15–30% store fee |
| Blended CAC | $13 | **$45–70** | ilumoni figure not carryable |
| Payback | 1.2 mo | **7–12 mo** | Survivable, not exceptional |
| LTV/CAC (3-yr) | 15.2× | **2.4–3.6×** | Above the 3× bar at the optimistic end |

At corrected inputs the business still clears the standard venture bar — LTV/CAC above 3× at the good end of the band — but it clears it *narrowly*, and it clears it only if the viral coefficient is real.

## What would change the answer

1. A web-checkout path, recovering 15–30 points of gross margin.
2. Any real paid-channel cohort data. There is none in the data room.
3. Evidence the 0.4–0.6 viral coefficient survives contact with a US audience.

## Sources & references

1. MoneyGym unit economics + sensitivity workbook — Ventrify data room
2. [RevenueCat — State of Subscription Apps 2024](https://www.revenuecat.com/state-of-subscription-apps/)
3. [Apple App Store — commission structure](https://developer.apple.com/app-store/small-business-program/)
4. MoneyGym conversion funnel model (05-*) — Ventrify data room`;

RB.dealMemo = `MoneyGym is a reprice, not a pass: the thesis survives correction, but neither the numbers nor the team survive as presented.

**Prepared for:** Investment Committee
**Recommendation:** Invest — conditional on reprice and team verification
**Conviction:** Medium

---

## The call

Back it at **$15–35M pre**, conditional on (a) a corrected deck, (b) written verification of the two unnamed co-founders, and (c) one real paid-channel cohort. Walk if any of the three fails.

| Condition | Owner | Before |
| --- | --- | --- |
| Corrected TAM/SAM/SOM slide | Founder | Term sheet |
| Companies House verification of co-founders | Us | Term sheet |
| One paid-channel cohort (n≥500) | Founder | Close |

## Three things that must be true

1. **The regulatory-cold position is durable.** Every profitable incumbent carries enforcement risk on the lending mechanic. MoneyGym takes no spread, charges no advance fee, holds no balances.
2. **Coaching depth converts.** Cleo proves willingness to pay; nobody has proven that coaching *alone* retains.
3. **The founder can hire the team he doesn't have.** Today this is a solo-founder round wearing a three-founder slide.

## The anti-thesis

> Cleo is profitable, entrenched, and could ship non-lending coaching in a quarter. If it does, MoneyGym's only structural edge evaporates and we are left backing a cold-start consumer app with no distribution and a CAC number borrowed from a dissolved company.

We are not paid to ignore that. We are paid to price it.

## Sources & references

1. MoneyGym pitch deck v0.1a — Ventrify data room
2. Claims pressure test, Market sizing, Team diligence — this assessment
3. [Companies House — Monely Ltd filing history](https://find-and-update.company-information.service.gov.uk/)
4. [Carta — State of Private Markets, Q3 2025](https://carta.com/data/state-of-private-markets-q3-2025/)`;

RB.demandTraction = `Willingness to pay is real and verified at $95–144 a year — but MoneyGym-specific US demand is currently zero, and there is no cohort in the data room to argue otherwise.

## Willingness to pay

Independent research across three adjacent categories supports the $99 price point comfortably.

- **Financial coaching (human).** $150–400/yr for periodic sessions.
- **Behavioural subscription apps.** Noom at ~$209/yr, Duolingo Super at ~$84/yr.
- **Budgeting tools.** YNAB at $109/yr, Monarch at $99/yr, Copilot at $95/yr.

The verified band is **$95–144**. MoneyGym's $99 sits at the bottom of it, which is the right place for a cold-start product.

## Traction, honestly stated

| Signal | Status |
| --- | --- |
| US users | 0 |
| Paying subscribers | 0 |
| Waitlist | Not disclosed |
| Paid-channel tests | None in data room |
| Predecessor (ilumoni, UK) | <10k users, dissolved Aug 2024 |

---

There is no US demand signal. That is not disqualifying at pre-seed — but the deck presents the ilumoni figures as if they were MoneyGym's, and they are not: different product, different country, different acquisition motive, dissolved entity.

> What exists is a verified price point and a proven adjacent category. What does not exist is a single MoneyGym customer.

## Sources & references

1. [YNAB pricing](https://www.ynab.com/pricing)
2. [Monarch Money pricing](https://www.monarchmoney.com/pricing)
3. [Noom — reported subscription pricing](https://www.noom.com/)
4. Founder letter and ilumoni retrospective — Ventrify data room
5. MoneyGym conversion funnel model (05-*) — Ventrify data room`;

// ---- The assessment (real MoneyGym content) ----
export const ASSESSMENT = {
  id: 'prg-moneygym',
  name: 'MoneyGym',
  initials: 'MG',
  stageLine: 'Seed · Raising $20M on $60M pre · Behavioural-finance subscription · Assessed just now',
  status: { kind: 'ok', label: 'Verdict ready', icon: 'check_circle' },
  // the assessment lifecycle — the "playback" in the Sources rail panel (state: done | current | pending)
  run: { agent: 'Assess · v3 rubric', at: '4 Jul 2026', duration: '18 min' },
  lifecycle: [
    { label: 'Intake', at: '2 Jul', state: 'done', meta: 'Engagement created · Apex Capital' },
    { label: 'Documents received', at: '3 Jul', state: 'done', meta: '5 files uploaded · 18 sources ingested' },
    { label: 'Assessment run', at: '4 Jul', state: 'done', meta: 'Assess · v3 rubric · 18 min' },
    { label: 'Verdict ready', at: '4 Jul', state: 'done', meta: 'Diligence further · 55 / 100' },
    { label: 'Operator sign-off', at: '4 Jul', state: 'current', meta: 'Alex Rivera' },
    { label: 'Decision', state: 'pending', meta: 'Reprice → then wire or pass' }
  ],

  recommendation: 'Diligence further',   // → consider (amber)
  verdictLine: 'Diligence further — the pain is real, the price is not.',  // editorial verdict headline (copy contract: ≤ ~12 words)
  verdictEm: 'further',                   // emphasis word (rendered amber) within verdictLine
  conviction: 'Medium',                   // High/Medium/Low → 4/3/2 pips
  theAsk: '$20M on $60M pre (Seed)',
  askMeta: 'first of a ~$35M plan',
  askAmount: '$20M',                      // editorial hero: the amount, large
  askRest: 'on $60M pre · first of a ~$35M plan',  // …the rest, muted
  thesis: 'A real, government-verified macro pain and a proven behavioural-change subscription playbook (“Noom for money”) attached to a pre-product, zero-US-traction company asking a Series-A price ($60M pre) for a seed-stage asset — in a category a profitable Cleo already occupies at scale.',
  biggestRisk: { label: 'Distribution', headline: 'The math only closes if organic does the impossible.', text: '~4M Year-5 subscribers requires 70–130M US installs (3–6% of all US finance-app installs for five straight years) and CAC compressing to $30 in 25 months on an unproven 0.4–0.6 viral coefficient the deck itself calls “a hypothesis” — if organic underperforms, payback exceeds customer lifetime and $20M never reaches the milestone.' },
  // ── per-tab Section-hero copy (the editorial "what" of each tab). The metric molecule on the right is
  //    DERIVED from structured data (SCORE / valuation / team / confidence) by the ds.js tab-hero composer;
  //    only the prose lives here, mirroring verdictLine/thesis. ──
  heroes: {
    investability: {
      eyebrow: 'The score, decomposed', eyebrowIcon: 'insights',
      headline: "Strong where it's built, empty where it isn't.", headlineEm: "empty where it isn't",
      facts: [
        { k: 'Carries the score', v: 'Product <small>4.0 / 5</small>' },
        { k: 'Drags it down', v: 'Execution <small>0.5 / 5</small> · Moat <small>1.5 / 5</small>' }
      ],
      thesis: "The 55 is real but lopsided — carried by product and financial discipline, held down by a moat that isn't built and traction that doesn't exist. Almost all of the +21 headroom to a 76 sits in exactly those two gaps, and closing them takes building, not diligence."
    },
    market: {
      eyebrow: 'The market', eyebrowIcon: 'query_stats',
      headline: 'Big enough to back — just not the $110B the deck claims.', headlineEm: '$110B',
      facts: [
        { k: 'Honest TAM', v: '$1.5–2.5B <small>investable</small>' },
        { k: 'Deck claimed', v: '$110B <small>44–73× over</small>' }
      ],
      thesis: "A genuinely large, investable market — roughly $1.5–2.5B once the deck's 44–73× TAM inflation is stripped out — attached to a $60M pre that prices a pre-product, zero-US-revenue seed like a Series A. Three independent methods converge on $15–35M, workable at ~$25–30M with a milestone tranche."
    },
    team: {
      eyebrow: 'The team', eyebrowIcon: 'groups',
      headline: 'A credible founder — without the team to build the moat.', headlineEm: 'without the team',
      facts: [
        { k: 'Founder–market fit', v: '3.0 <small>/ 5 · heaviest signal</small>' },
        { k: 'Critical gap', v: 'No ML / data lead' }
      ],
      thesis: 'A credible, verified UK fintech founder (Corner) leading two co-founders (Lancaster, Goudge) with no external record connecting them to the ilumoni proof point; genuinely strong NEDs — but no ML/data leader anywhere, so the team that must build the moat does not yet exist.'
    },
    research: {
      eyebrow: 'The evidence', eyebrowIcon: 'manage_search',
      headline: 'Nothing taken on trust — every claim rebuilt from source.', headlineEm: 'rebuilt from source',
      facts: [
        { k: 'Claims tested', v: '12 <small>· 3 failed the check</small>' },
        { k: 'Depth', v: 'L3 <small>· primary-source rebuild</small>' }
      ],
      thesis: "Seven workstreams rebuilt every load-bearing claim from primary sources — Companies House filings, Carta seed benchmarks, a ten-competitor teardown — and three of the deck's twelve headline claims did not survive the check. The verdict is only as strong as this evidence, and the evidence is complete: 35 of 35 signals rated across 18 documents and 32 cited sources."
    }
  },
  mustBeTrue: [
    'The UK ilumoni signals transfer to a US subscription model — without the loans-marketplace revenue loop that likely drove the celebrated £148→£13 CAC compression.',
    'Trial-to-paid holds near the model’s 35% — the deck’s own 20% sits at the level the founder’s sensitivity analysis says breaks the model.',
    'The four-engine ML moat actually gets built and out-performs a live, net-profitable Cleo — led by an ML head not yet hired.'
  ],
  confidence: { level: 'High', documents: 18, sources: 32, line: 'Full data room · 18 documents · 32 sources cited · 35 of 35 signals rated' },
  signoff: { by: 'Alex Rivera', at: '4 Jul 2026', note: 'Endorse further diligence — reprice toward $25–30M pre with a milestone tranche; do not wire at $60M.' },

  bull: [
    'Real, government-verified macro pain: $17.9T US household debt, $1.21T card balances, 57%+ living paycheck-to-paycheck — and a genuine consumer voice the deck captures well.',
    'The behavioural-change subscription playbook is proven in adjacent verticals (Noom, Duolingo); even at honest sizing (~$1.5–2.5B TAM) the market is large enough to build a meaningful company.',
    'Clean, non-lending coaching positioning sits in regulatory cold territory — a structural edge over Cleo’s $17M FTC settlement, Tally’s collapse, and Brigit/Dave enforcement.',
    'Experienced, verified FS founder (Jonathan Corner) plus strong NEDs (Siobhan MacDermott, ex-Vice Chair BofA; Gideon Hyde, Market Gravity→Deloitte), and a data room that discloses several key risks openly.',
    'If the deterministic four-engine ML edge is actually built, it is a credible answer to Cleo’s LLM-only approach — and the behavioural-data moat would compound with every user.'
  ],
  bear: [
    'The “unclaimed category” is already owned at scale by a net-profitable Cleo (~7M users, ~1.1M paying US subs, $280M+ ARR) the deck never mentions.',
    'The moat is explicitly unbuilt — “a Series-A-funded build” in the founder’s own words — and no ML/data leader is on the team; that is the first hire the round is meant to fund.',
    'The entire traction story is a dissolved predecessor: ilumoni / Monely Ltd (liquidation 2023, dissolved Aug 2024, ~£1.63M raised, never past 10k users); two of three co-founders are unverifiable in its filings.',
    'The financial model contradicts itself — cash trough +$4.25M vs −$1.94M, break-even M24/M32/M35, trial-to-paid 20% (deck) vs 35% (model) — and leans on a CFPB §1033 tailwind that is legally enjoined.',
    '$60M pre is Rich — ~3.75× the median seed pre and above the median Series A pre — anchored on EXIT comps (Truebill $1.275B, Noom $3.7B), not any comparable entry-stage round.'
  ],

  valuation: {
    verdict: 'Rich — reprice',
    // structured figures for the Market-tab hero (valuationLockup) — never parsed from prose
    multiple: 3.75, multipleSuffix: '× seed median', asked: 60, defensibleLo: 15, defensibleHi: 35, scaleMax: 70,
    // the reprice-section lead (a NET-NEW bear point — the hero lockup already owns the figures, so the body advances a new argument)
    bodyDrop: 'Priced', bodyLead: 'against exit outcomes, not entry rounds — Truebill raised ~$1.9M at a sub-$10M seed pre before its $1.275B exit; the deck quotes the exit and prices like it. Three independent methods converge on a defensible $15–35M.',
    note: '$20M on a $60M pre is ~3.75× the Carta Q3 2025 median seed pre ($16M) and above the median Series A pre ($49.3M) — Series-A pricing on a pre-product, zero-US-revenue seed whose moat is admittedly unbuilt. Three independent methods (comparable-transaction, scorecard, VC) converge on a defensible $15–35M pre. Workable at ~$25–30M pre with a milestone tranche tied to live US cohort data and a named ML lead.',
    comps: [
      { name: 'Truebill', stage: 'Seed, 2016 (pre-product)', detail: '~$1.9M raised, est. sub-$10M pre — later $1.275B exit; the deck cites the exit, not the entry' },
      { name: 'Copilot Money', stage: 'Series A, Mar 2024', detail: '$6M with a live product + ~100k+ paying subs — more validated than MoneyGym at seed' },
      { name: 'Cleo', stage: 'Series C, 2022', detail: '$80M at ~$500M post, ~7M users; the closest analogue, priced on real traction' },
      { name: 'Monarch Money', stage: 'Series B, May 2025', detail: '$75M at $850M post — one full cycle ahead of MoneyGym' },
      { name: 'Carta benchmark', stage: 'Seed median, Q3 2025', detail: 'median pre $16M / post $24M — MoneyGym’s $60M pre is 3.75× the median' }
    ]
  },
  market: {
    tam: { value: '$1.5–2.5B', v: 1 }, sam: { value: '$1.0–2.0B', v: 0.7 }, som: { value: '$100–200M', v: 0.12 },
    note: 'Genuinely large and investable at corrected scale — but the deck overstates TAM 44–73× by counting all US fintech revenue ($110B). The deck’s $331M SOM implies 17–33% of corrected SAM — category dominance, not the “conservative” entry it claims.',
    // sizing-section copy: the lead carries ONLY the corrected-scale framing (the hero already ran the 44–73×); the fact carries ONLY the SOM-dominance stat
    sizingDrop: 'Genuinely', sizingLead: 'large and investable at corrected scale — the honest bottom-up rebuild lands at $1.5–2.5B, still north of $1B.',
    sizingFact: 'The deck’s $331M SOM implies 17–33% of corrected SAM — category dominance, not the “conservative” entry it claims.'
  },
  rounds: [
    { i: 'MM', name: 'Monarch Money · Series B', meta: 'May 2025 · Forerunner, FPV', amount: '$75M', val: '$850M post' },
    { i: 'ST', name: 'Stash · Series H', meta: 'May 2025 · Goodwater', amount: '$146M', val: '$1.4B+' },
    { i: 'CL', name: 'Cleo · Series C', meta: '2022 · Sofina', amount: '$80M', val: '$500M post' },
    { i: 'CP', name: 'Copilot Money · Series A', meta: 'Mar 2024 · Adjacent · live product', amount: '$6M', val: '~$20–35M post' },
    { i: 'BR', name: 'Brigit · Acquisition', meta: 'Dec 2024 · Upbound Group', amount: 'up to $460M', val: 'exit' },
    { i: 'GL', name: 'Greenlight · Series D', meta: '2021 · a16z', amount: '$260M', val: '$2.3B' },
    { i: 'TB', name: 'Truebill · Seed', meta: '2016 · YC + angels · pre-product', amount: '~$1.9M', val: 'sub-$10M pre', me: true, tag: 'the deck’s real comp' }
  ],
  benchmark: {
    note: 'MoneyGym is the only entrant with no product, no users and no revenue — while Cleo already ships conversational AI money coaching at ~7M users and $280M+ ARR. MoneyGym’s one structural edge is its clean, non-lending posture vs Cleo’s $17M FTC cash-advance settlement.',
    // standfirst lead (lifted out of the card) + the one structural-edge callout beneath the matrix
    leadDrop: 'MoneyGym', lead: 'is the only entrant with no product, no users and no revenue — while Cleo already ships conversational AI money coaching at ~7M users and $280M+ ARR.',
    edge: 'The one structural edge: a clean, non-lending posture — sidestepping the enforcement that has hit Cleo ($17M FTC), Dave and Brigit.',
    cols: ['Company', 'Stage / funding', 'Users / paying', 'Product built?', 'AI coaching', 'Revenue / ARR'],
    rows: [
      { me: true, cells: ['MoneyGym ◂ this', 'Seed; raising $20M @ $60M pre', '0 US / 0 paying', 'No — 4-engine stack defined, not built', 'Roadmap only (PSYCE/COE/PERSE/CLLE)', '$0 US (UK predecessor dissolved 2024)'] },
      { cells: ['Cleo', 'Series C; ~$175M (~$500M val)', '~7M / ~1.1M paying', 'Yes — live since 2019', 'Active — LLM money coach, nudges', '$280M+ ARR; net-profitable'] },
      { cells: ['Acorns', 'Late-stage; ~$588M ($1.9B val)', '~4.5M paying / 14M+ all-time', 'Yes — fully live', 'Minimal — round-up auto-pilot', '~$400M+ ARR'] },
      { cells: ['Monarch Money', 'Series B; ~$95M ($850M val)', '~250–500k paying', 'Yes — fully live', 'None — premium tracker + AI categorisation', 'Undisclosed; strong post-Mint'] },
      { cells: ['Rocket Money', 'Acquired (Truebill, $1.275B, 2021)', '~4.1M premium / 10M+ total', 'Yes — fully live', 'Minimal — bill/subscription optimiser', '~$338M annualised run-rate'] }
    ]
  },
  exit: {
    acquirers: 'consumer-fintech consolidators (Rocket / Intuit / Block, per the Truebill→Rocket precedent); a bank or card issuer adding a coaching layer (Capital One, Chase); or a scaled neobank / PFM platform (SoFi, Acorns, even Cleo).',
    path: 'Series A (~$15M, 18–24 months out) unlocked by live US cohort proof — conversion, churn, LTV/CAC, viral coefficient — then scale a subscription base an acquirer values on a revenue multiple. Liquidity is acquisition, not IPO.',
    returns: 'grounded, not the deck’s $2.3B fantasy. The realistic comp is Truebill’s $1.275B exit at ~$100M ARR (~12.75×) after six years. Entered at $60M pre and diluted through Series A+, even a strong outcome returns a modest multiple — the case for repricing. At ~$25–30M pre, the same exit is a credible venture return.'
  },
  team: {
    summary: 'A credible, verified UK fintech founder (Corner) leading two co-founders (Lancaster, Goudge) with no external record connecting them to the ilumoni proof point; genuinely strong NEDs — but no ML/data leader anywhere, so the team that must build the moat does not yet exist.',
    members: [
      { i: 'JC', name: 'Jonathan Corner — CEO / Founder', bg: 'Verified UK digital-banking veteran (first direct, HSBC, Egg, Aldermore); confirmed director of Monely Ltd / ilumoni. ~3-yr gap between ilumoni’s 2022 wind-down and MoneyGym’s Feb 2025 incorporation is unexplained.', signal: 'neutral' },
      { i: 'KL', name: 'Kevin Lancaster — CTO / Co-Founder (24.6%)', bg: 'Not externally verifiable — no Monely filing, no ilumoni press, no confirmable ML leadership history. Holds the 2nd-largest stake; his ML credentials underpin a moat nobody on the team is verified to build.', signal: 'flag' },
      { i: 'NG', name: 'Neil Goudge — COO / Co-Founder (18.5%)', bg: 'Not externally verifiable in connection with ilumoni; absent from Monely filings and launch coverage. One unconfirmed LinkedIn match in commercial insurance.', signal: 'flag' },
      { i: 'JP', name: 'Jim Pickell — Advisory Board Chairman', bg: 'Verified entrepreneur (OpenEnglish, President/COO HomeExchange, SVP Sony) — but no verifiable fintech track record; the deck’s “Fintech executive leader” descriptor is unsupported.', signal: 'neutral' },
      { i: 'SM', name: 'Siobhan MacDermott — NED', bg: 'Fully verified — Vice Chair, Global Corporate & Investment Banking, Bank of America; prior EY. Expertise is cyber/geopolitics/institutional resilience, not US consumer-PLG.', signal: 'positive' },
      { i: 'GH', name: 'Gideon Hyde — NED', bg: 'Fully verified — co-founded Market Gravity (~100 staff, Deloitte acquisition 2017), then StudioSpace; FS product pedigree (Retiready/Aegon, HSBC Connected Money).', signal: 'positive' }
    ],
    gaps: [
      'No ML / AI lead on the cap table or board — the entire moat (PSYCE/COE/PERSE/CLLE) is unbuilt and “VP/Head of Intelligence” is the first seed hire.',
      'No US consumer-PLG / subscription-growth operator with a verified zero-to-scale track record.',
      'Lancaster + Goudge (43% of pre-money equity) are unverifiable in any ilumoni or prior-fintech record.',
      'No US regulatory counsel for open-banking / CCPA-ADMT exposure as financial-account integrations are added.',
      'No Head of Data / data infrastructure to deliver the synthetic-data and CLLE feedback loop.'
    ],
    // the decisive absence — promoted to the editorial kill-aside on the Team tab (worded so it never echoes the Verdict tab's kill-risk)
    gapKill: { tag: 'The decisive hire', label: 'Head of Intelligence', headline: 'The moat has no builder.', text: 'No ML / AI lead sits on the cap table or board — the four-engine moat (PSYCE/COE/PERSE/CLLE) is unbuilt, and “VP/Head of Intelligence” is only the first seed hire.' },
    // additive aux-peek content (NOT the thesis, which the hero already prints)
    peek: 'Lancaster + Goudge hold 43% of pre-money equity between them, yet neither is externally verifiable against any ilumoni or Monely filing — the ML credentials that underpin the moat sit with the two least-verified founders.'
  },
  diligence: [
    { kind: 'err', tag: 'Blocker', title: 'Reprice the round', note: '$60M pre is Series-A pricing on a seed-stage asset; comps and three valuation methods cap defensible value at $20–35M pre. No wire at $60M pre.' },
    { kind: 'err', tag: 'Blocker', title: 'Reconcile the financial model', note: 'One version shows +$4.25M cash trough, another −$1.94M; break-even is stated as M24, M32 and M35; trial-to-paid is 20% (deck) vs 35% (model). Establish that $20M actually funds to the milestones.' },
    { kind: 'err', tag: 'Blocker', title: 'Verify the ilumoni track record + co-founder roles', note: 'The whole traction case rests on Monely Ltd (dissolved 2024); confirm Lancaster’s and Goudge’s formal roles (absent from Companies House) and obtain raw, population-weighted PoC metrics.' },
    { kind: 'warn', tag: 'Key', title: 'Get a credible Cleo-differentiation answer', note: 'Cleo (~7M users, $280M+ ARR, net-profitable) already occupies the “AI money coach” category the deck omits; without a defensible distinction the core thesis is exposed.' },
    { kind: 'warn', tag: 'Key', title: 'Secure a named ML / data lead', note: 'The four-engine moat is unbuilt and no current team member is verified to build it; the build is the differentiation.' },
    { kind: 'warn', tag: 'Key', title: 'Pressure-test CAC compression + distribution', note: 'Independent validation that a 0.4–0.6 viral coefficient and 70% organic mix are achievable in the US within 25 months; the deck calls it “a hypothesis, not a guarantee.”' },
    { kind: 'info', tag: 'Standard', title: 'Confirm gross-margin treatment of app-store fees', note: 'If 15–30% platform fees are not in COGS, the 79% gross margin and 6:1 LTV/CAC are overstated.' },
    { kind: 'info', tag: 'Standard', title: 'Correct the §1033 framing', note: 'The open-banking rule is legally enjoined as of mid-2026; the macro-debt tailwind stands without it, but the deck must not present it as live.' },
    { kind: 'info', tag: 'Standard', title: 'Confirm the definitive raise amount', note: 'Both “$20M” and “$22M” appear in the data room; runway at $20M may be shorter than presented.' }
  ],
  findings: [
    { icon: 'warning', color: 'error', title: 'The category isn’t unclaimed — Cleo owns it', note: '~7M users, ~1.1M paying US subs, $280M+ ARR, net-profitable, “first AI money coach” — never mentioned in the deck.' },
    { icon: 'warning', color: 'error', title: 'Traction is a dissolved predecessor', note: 'ilumoni / Monely Ltd — members’ voluntary liquidation 2023, dissolved Aug 2024, ~£1.63M raised, never past 10k users, loans-marketplace model since dropped.' },
    { icon: 'help', color: 'warning', title: 'TAM overstated 44–73×', note: 'The deck’s $110B counts all US fintech revenue; an honest bottom-up rebuild lands at ~$1.5–2.5B — still investable, materially overstated.' },
    { icon: 'check_circle', color: 'success', title: 'The regulatory-cold positioning is real', note: 'Clean, non-lending coaching avoids the enforcement that has hit Cleo (FTC $17M), Tally, Brigit and Dave — a genuine structural edge.' }
  ],
  research: [
    { icon: 'query_stats', tone: 'p', title: 'Market sizing', note: 'Bottom-up TAM rebuild — the $110B claim is a 44–73× category error · 8 sources', tag: 'L3', body: RB.marketSizing, agent: 'market-analyst', generated: 'Generated 2 days ago' },
    { icon: 'table_chart', tone: 'p', title: 'Competitive benchmark', note: '10 competitors mapped; Cleo occupies the category at ~7M users, $280M+ ARR · 14 sources', tag: 'L3', body: RB.competitiveBenchmark, agent: 'competitor-analyst', generated: 'Generated 2 days ago' },
    { icon: 'badge', tone: 's', title: 'Team & founder diligence', note: 'Companies House verification; 2 of 3 co-founders unverifiable against ilumoni filings', tag: 'L3', body: RB.teamDiligence, agent: 'diligence-agent', generated: 'Generated 2 days ago' },
    { icon: 'science', tone: 'w', title: 'Claims validation', note: 'Deck claims pressure-tested — CAC compression, 35% trial-to-paid, §1033 tailwind · 12 findings', tag: '3 fail', tagKind: 'warn', body: RB.claimsPressureTest, agent: 'claims-validator', generated: 'Generated 2 days ago' },
    { icon: 'payments', tone: 'p', title: 'Investment analysis & returns', note: 'Three valuation methods converge on $15–35M pre; exit math vs the deck’s $2.3B claim', tag: 'L2', body: RB.investmentAnalysis, agent: 'investment-analyst', generated: 'Generated 1 day ago' },
    { icon: 'calculate', tone: 'p', title: 'Unit economics', note: 'LTV/CAC, gross margin with app-store fees, the model’s internal contradictions · 6 sources', tag: 'L2', body: RB.unitEconomics, agent: 'financial-modeler', generated: 'Generated 1 day ago' },
    { icon: 'groups', tone: 'p', title: 'Demand & traction', note: 'Verified $95–144 WTP band; MoneyGym-specific US demand is zero', tag: 'L2', body: RB.demandTraction, agent: 'demand-analyst', generated: 'Generated 1 day ago' }
  ],
  dataRoom: [
    { icon: 'description', title: 'Deal memo', note: 'Full write-up · exported PDF', tag: 'L1', action: 'tag', kind: 'generated' },
    { icon: 'slideshow', title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Founder upload · TAM/SAM/SOM on slide 4', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'table_view', title: 'MoneyGym unit economics + sensitivity.xlsx', note: 'Founder upload · the +$4.25M vs −$1.94M contradiction', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'article', title: 'Founder letter + ilumoni retrospective', note: 'Founder upload · the £148→£13 CAC claim', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'folder_zip', title: 'Data room export', note: 'All 18 sources + research · .zip', action: 'download', kind: 'dataroom' }
  ]
};

// ---- reading[] — EXACTLY what shared/m3/adapter.js now emits: every hubDoc that has a body, unfiltered.
// It is a SUPERSET of research[]: it also carries the deal memo, which research[] excludes so the hero's
// "N workstreams" count stays honest, but which the reader must still be able to open in full (the classic
// hub-view.js always rendered it). Grouping, canonical titles, glyphs and key findings are derived from the
// body + title by DS.researchClassify — never hard-coded here. ----
const READING = [
  ['research', 'market-sizing', 'Market sizing', 'L3', RB.marketSizing],
  ['research', 'competitive-benchmark', 'Competitive benchmark', 'L3', RB.competitiveBenchmark],
  ['research', 'team-diligence', 'Team & founder diligence', 'L3', RB.teamDiligence],
  ['research', 'claims-validation', 'Claims validation', 'L3', RB.claimsPressureTest],
  ['research', 'investment-analysis', 'Investment analysis & returns', 'L2', RB.investmentAnalysis],
  ['research', 'unit-economics', 'Unit economics', 'L2', RB.unitEconomics],
  ['research', 'demand-and-traction', 'Demand & traction', 'L2', RB.demandTraction],
  ['assessment', 'deal-memo', 'MoneyGym — Investment Committee Memo', 'L1', RB.dealMemo],
];
ASSESSMENT.reading = READING.map(([hub, name, title, level, body], i) => ({
  hub, name, title, level, tag: level,
  tagKind: /L3/i.test(level) ? 'info' : 'warn',
  order: i, body,
}));

// ---- Investability (VSS) score — weighted 0–100 ----
export const SCORE = {
  composite: 55, potential: 76, band: 'Promising',
  categories: [
    // subs = the 5 VSS sub-signals (fixed rubric order, mirrors vss-rubric.js). score ∈ {0, 0.5, 1};
    // the 5 scores sum to `num` (the category's 0–5). Labels come from shared SUB_Q (not stored here).
    { key: 'market',    label: 'Market opportunity',          short: 'market',     weightPct: 20, rated: '3',   frac: 0.6, pot: 0.9, num: '3', subs: [
      { slug: 'market_size',       score: 0.5, note: 'TAM is real but the deck overstates it 44–73× ($110B = all US fintech); an honest bottom-up rebuild lands ~$1.5–2.5B — still >$1B.' },
      { slug: 'market_growth',     score: 0.5, note: 'Behavioural-finance subscription is a growing space, but there is no MoneyGym-specific growth evidence yet.' },
      { slug: 'why_now',           score: 1,   note: 'Credible why-now: $17.9T US household debt, 57% living paycheck-to-paycheck, and the post-Mint PFM gap.' },
      { slug: 'demand_validation', score: 0.5, note: 'Demand validated in the UK predecessor, not the US; a $95–144 WTP band is cited but US traction is zero.' },
      { slug: 'gross_margin',      score: 0.5, note: '79% gross margin claimed, but overstated if 15–30% app-store fees are not in COGS.' } ] },
    { key: 'team',      label: 'Team & founder-market fit',    short: 'the team',   weightPct: 25, rated: '3',   frac: 0.6, pot: 0.6, num: '3', subs: [
      { slug: 'ceo_vision',        score: 1,   note: 'Corner communicates a clear vision; a verified UK digital-banking veteran (first direct, HSBC, Egg, Aldermore).' },
      { slug: 'talent_attraction', score: 0.5, note: 'Strong NEDs (MacDermott ex-Vice Chair BofA, Hyde ex-Market Gravity) — but no ML/data lead, the hire the moat depends on.' },
      { slug: 'founder_market_fit',score: 1,   note: 'Genuine founder–market fit; ran ilumoni in the adjacent UK consumer-debt space.' },
      { slug: 'execution_record',  score: 0.5, note: 'ilumoni dissolved 2024, never past 10k users; the ~3-year gap to MoneyGym’s Feb-2025 incorporation is unexplained.' },
      { slug: 'ethics_trust',      score: 0,   note: '2 of 3 co-founders (Lancaster, Goudge) are unverifiable against the ilumoni filings — a disclosure gap to close.' } ] },
    { key: 'product',   label: 'Product & solution clarity',   short: 'product',    weightPct: 15, rated: '4',   frac: 0.8, pot: 0.8, num: '4', subs: [
      { slug: 'value_prop_clarity',score: 1,   note: '“Noom for money” — a partner can repeat the value prop in one sentence after one read.' },
      { slug: 'improvement_10x',   score: 0.5, note: 'Behavioural-change coaching beats passive PFM, but Cleo already ships conversational AI money coaching at scale.' },
      { slug: 'moscow_discipline', score: 1,   note: 'MVP scoped tight to the four-engine stack; a disciplined Must-Have set.' },
      { slug: 'persona_depth',     score: 1,   note: 'Personas grounded in a substantive paycheck-to-paycheck consumer voice.' },
      { slug: 'problem_validation',score: 0.5, note: 'Problem validated by macro data; MoneyGym-specific qualitative + quantitative anchors are UK-only.' } ] },
    { key: 'moat',      label: 'Technical / competitive moat', short: 'the moat',   weightPct: 15, rated: '1.5', frac: 0.3, pot: 0.9, num: '1.5', low: true, subs: [
      { slug: 'differentiation',   score: 1,   note: 'The deterministic four-engine ML approach is differentiated in concept vs Cleo’s LLM-only — if it is actually built.' },
      { slug: 'ip_defensibility',  score: 0,   note: 'No IP exists yet — the four engines are “defined, not built” (founder’s own doc); the moat is a Series-A-funded build.' },
      { slug: 'switching_costs',   score: 0,   note: 'The behavioural-data lock-in is the thesis, but with zero users and no product there are none yet.' },
      { slug: 'scalability',       score: 0.5, note: 'Software scales, but the 0.4–0.6 viral coefficient and CAC compression underpinning it are unproven.' },
      { slug: 'ecosystem_moats',   score: 0,   note: 'No network effects, PLG flywheel, partnerships or ecosystem positioning exist yet.' } ] },
    { key: 'financial', label: 'Financial defensibility',      short: 'financials', weightPct: 10, rated: '3.5', frac: 0.7, pot: 0.7, num: '3.5', subs: [
      { slug: 'files_complete',    score: 0.5, note: 'Files present but internally inconsistent — +$4.25M vs −$1.94M cash trough; break-even stated as M24, M32 and M35.' },
      { slug: 'ltv_cac_ratio',     score: 0.5, note: '6:1 LTV/CAC claimed, but overstated if app-store fees are excluded and CAC compression is unproven.' },
      { slug: 'sensitivity_coverage',score: 1, note: 'Sensitivity analysis present; the founder’s own model flags where 20% trial-to-paid breaks the plan.' },
      { slug: 'milestone_anchored_ask',score: 0.5, note: 'The ask is not cleanly milestone-anchored — both “$20M” and “$22M” appear in the data room.' },
      { slug: 'risk_honesty',      score: 1,   note: 'The data room discloses several key risks openly — a genuine positive.' } ] },
    { key: 'execution', label: 'Execution & traction',         short: 'execution',  weightPct: 10, rated: '0.5', frac: 0.1, pot: 0.7, num: '0.5', low: true, subs: [
      { slug: 'live_surfaces',     score: 0,   note: 'No live product — an investor demo with a simulated backend; the four engines are unbuilt.' },
      { slug: 'ia_coverage',       score: 0.5, note: 'Some design/IA is defined, but well short of a shipped-screen target.' },
      { slug: 'gate_velocity',     score: 0,   note: 'No shipped US progress to evidence momentum — incorporated Feb 2025, still pre-product.' },
      { slug: 'payment_cadence',   score: 0,   note: 'No US revenue and no paying users — $0 ARR.' },
      { slug: 'traction_signals',  score: 0,   note: 'No beta testers, waitlist or early US traction signals.' } ] },
    { key: 'evidence',  label: 'Evidence integrity',           short: 'evidence',   weightPct: 5,  rated: '3',   frac: 0.6, pot: 0.6, num: '3', subs: [
      { slug: 'citation_density',  score: 0.5, note: 'Material claims are partly sourced; the deck’s TAM and CAC claims lack inline citations.' },
      { slug: 'source_count',      score: 1,   note: '18 documents and 32 sources cited across the research — above the ≥15 bar.' },
      { slug: 'hallucination_check',score: 1,  note: 'The source-verifier passed — no impossible numbers surfaced.' },
      { slug: 'methodology_disclosure',score: 0.5, note: 'Some methodology named; the TAM rebuild and CAC assumptions could be more explicit.' },
      { slug: 'cross_file_consistency',score: 0, note: 'Numbers don’t cross-check — the +$4.25M vs −$1.94M trough and 20% vs 35% trial-to-paid contradictions.' } ] }
  ],
  // contribution = frac × weight × 100
  contributions: [
    ['Market Opportunity', '20%', '3 / 5', '+12.0', false],
    ['Team & Founder-Market Fit', '25%', '3 / 5', '+15.0', false],
    ['Product & Solution Clarity', '15%', '4 / 5', '+12.0', false],
    ['Technical / Competitive Moat', '15%', '1.5 / 5', '+4.5', true],
    ['Financial Defensibility', '10%', '3.5 / 5', '+7.0', false],
    ['Execution & Traction', '10%', '0.5 / 5', '+1.0', true],
    ['Evidence Integrity', '5%', '3 / 5', '+3.0', false]
  ],
  fixes: [
    { key: 'moat',      cat: 'Technical moat', detail: 'IP defensibility, switching costs, ecosystem', lift: '+3.0', kind: 'err' },
    { key: 'execution', cat: 'Execution', detail: 'live surfaces, gate velocity, payment cadence', lift: '+3.0', kind: 'err' },
    { key: 'market',    cat: 'Market', detail: 'market size, why-now framing', lift: '+1.0', kind: 'warn' }
  ],
  split: '1 strong · 4 mixed · 2 gaps',
  // per-category sub-signal breakdown (key ties each to SCORE.categories[].key for the aux drill-down)
  heatmap: [
    { key: 'moat', cat: 'Technical / Competitive Moat', slug: 'IP defensibility', lift: '+1.0', note: 'No IP exists yet — the four engines are ’defined, not built’ (founder’s own doc); the moat is a Series-A-funded build.' },
    { key: 'moat', cat: 'Technical / Competitive Moat', slug: 'Switching costs', lift: '+1.0', note: 'The behavioural-data lock-in is the thesis, but with zero users and no product there are none yet.' },
    { key: 'moat', cat: 'Technical / Competitive Moat', slug: 'Ecosystem moats', lift: '+1.0', note: 'No network effects, PLG flywheel, partnerships or ecosystem exist yet — the 0.4–0.6 viral coefficient is a hypothesis.' },
    { key: 'execution', cat: 'Execution & Traction', slug: 'Live surfaces', lift: '+1.0', note: 'No live product — an investor demo with a simulated backend; the four engines are unbuilt.' },
    { key: 'execution', cat: 'Execution & Traction', slug: 'Gate velocity', lift: '+1.0', note: 'No shipped US progress to evidence momentum — incorporated Feb 2025, still pre-product.' },
    { key: 'execution', cat: 'Execution & Traction', slug: 'Payment cadence', lift: '+1.0', note: 'No US revenue and no paying users — $0 ARR; the only historical revenue was ilumoni’s loans marketplace.' }
  ]
};

// ---- Portfolio engagements (table rows) ----
export const ENGAGEMENTS = [
  // in-flight assessments — demonstrate the run-state signal (queued / running / idle-bridge)
  { i: 'LM', avatar: 'p', name: 'Lumen Health', sub: 'Digital therapeutics · Seed', stage: 'Seed · Assessment', status: { kind: 'ok', label: 'Assessment', icon: 'fact_check' }, runState: { status: 'running', requestedAt: '2026-07-07T14:20:00Z' }, when: '3m ago' },
  { i: 'AX', avatar: 't', name: 'Arcstate', sub: 'Dev-tools · Pre-seed', stage: 'Seed · Assessment', status: { kind: 'ok', label: 'Assessment', icon: 'fact_check' }, runState: { status: 'queued', requestedAt: '2026-07-07T14:31:00Z' }, when: 'just now' },
  { i: 'NV', avatar: 's', name: 'Nova Freight', sub: 'Logistics · Seed', stage: 'Seed · Assessment', status: { kind: 'n', label: 'Draft', icon: 'edit_note' }, runState: { status: 'idle' }, when: '12m ago' },
  { i: 'MC', avatar: 't', name: 'Northwind', sub: 'Marcus Chen · Climate / Energy', stage: 'Phase 4 · Develop', status: { kind: 'ok', label: 'On track', icon: 'check_circle' }, progress: 0.88, when: '2h ago' },
  { i: 'SL', avatar: 'p', name: 'Stellaria', sub: 'Sophie Laurent · Healthtech', stage: 'Phase 2 · Define', status: { kind: 'ok', label: 'On track', icon: 'check_circle' }, progress: 0.42, when: '8h ago' },
  { i: 'JP', avatar: 's', name: 'Halo Sound', sub: 'Jamie Patel · Consumer audio', stage: 'Phase 1 · Discover', status: { kind: 'err', label: 'Stuck', icon: 'error' }, progress: 0.2, danger: true, when: '9d ago' },
  { i: 'EV', avatar: 't', name: 'Quill', sub: 'Eleni Vasquez · B2B SaaS', stage: 'Phase 2.5 · Financials', status: { kind: 'warn', label: 'Needs attention', icon: 'warning' }, progress: 0.55, when: '1h ago' },
  { i: 'VB', avatar: 's', name: 'Verdana Bio', sub: 'Climate biotech · Seed', stage: 'Seed · Assessment', status: { kind: 'ok', label: 'Assessment', icon: 'fact_check' }, rec: { kind: 'consider', label: 'Diligence further', icon: 'balance', score: '67' }, when: '1h ago' },
  { i: 'MG', avatar: 'p', name: 'MoneyGym', sub: 'Behavioural finance · Seed', stage: 'Seed · Assessment', status: { kind: 'ok', label: 'Assessment', icon: 'fact_check' }, rec: { kind: 'consider', label: 'Diligence further', icon: 'balance', score: '55' }, when: '1h ago' },
  { i: 'CH', avatar: 'p', name: 'Cadence Health', sub: 'Digital health · Seed', stage: 'Seed · Assessment', status: { kind: 'ok', label: 'Assessment', icon: 'fact_check' }, rec: { kind: 'invest', label: 'Invest', icon: 'trending_up', score: '82' }, when: '1h ago' },
  { i: 'IO', avatar: 't', name: 'Caldera', sub: 'Inez Okonkwo · Fintech', stage: 'Phase 0 · Intake', status: { kind: 'ok', label: 'On track', icon: 'check_circle' }, progress: 0.05, when: '20m ago' }
];

export const STATS = [
  { n: '8', l: 'Active engagements' },
  { n: '5', l: 'In flight · Phase 1–4' },
  { n: '11', l: 'Cards awaiting founder' },
  { n: '71<small>%</small>', l: 'Portfolio completeness', sub: '119 / 168 expected outputs' }
];

// ---- Action queue ----
export const QUEUE = [
  { urgency: 'high', icon: 'verified', title: 'Gate 2.5 ready to close on Quill', desc: 'All 7 Financials Hub cards resolved · L3 rebuilt · founder has signed off. Confirm scope and unlock Phase 3.', meta: 'Gate ready · Quill · 1 hour ago', action: 'Review & close gate' },
  { urgency: 'high', icon: 'edit_note', title: '7 Vision Hub cards awaiting your review on Stellaria', desc: 'research-curator drafted 7 cards from L3. Review before publishing to the founder.', meta: 'Cards to review · Stellaria · 8 hours ago', action: 'Review cards' },
  { urgency: 'high', icon: 'warning', title: 'Halo Sound founder unresponsive for 9 days', desc: '6 cards in Research Hub awaiting founder. Last activity: opened hub 9 days ago. Recommend a nudge.', meta: 'Stuck · Halo Sound · 9 days ago', action: 'Send nudge' },
  { urgency: 'med', icon: 'edit_note', title: '4 Marketing cards awaiting your review on Riverdraft', desc: 'copy-reviewer flagged 2 cards for tone alignment. Review and publish.', meta: 'Cards to review · Riverdraft · Yesterday', action: 'Review cards' },
  { urgency: 'low', icon: 'autorenew', title: 'L3 rebuild complete on Quill Financials Hub', desc: 'financial-modeler regenerated underlying research against resolved cards. Founder can review.', meta: 'L3 rebuild · Quill · 2 hours ago', action: 'View changes' },
  { urgency: 'med', icon: 'search', title: 'ux-designer flagged 3 critical issues on Riverdraft beta', desc: 'Round 2 audit · 2 contrast failures, 1 nav UX issue. Must close before Phase 5 unlocks.', meta: 'QA flag · Riverdraft · 4 hours ago', action: 'Open audit report' },
  { urgency: 'low', icon: 'rocket_launch', title: 'New program kicked off · Caldera (Inez Okonkwo)', desc: 'Brief intake form opened by founder. Phase 0 in progress · welcome pack queued.', meta: 'New intake · Caldera · 20 min ago', action: 'Open program' }
];

// ============================================================
// THE ASSESSING SCREEN — a run IN FLIGHT. Additive: never mutate ASSESSMENT/SCORE (those are a FINISHED
// verdict). Every honest state gets a fixture, not just the flattering one — an operator is most likely to
// first land on `silent` (the agent has not reported a step yet), so that state must look COMPOSED.
// ============================================================
const MIN = 60000;
const ago = m => new Date(Date.now() - m * MIN).toISOString();

export const ASSESSMENT_RUNNING = {
  id: 'prg-moneygym-score-1',
  name: 'MoneyGym Score 1',
  initials: 'MO',
  stageLine: 'Pre-seed · Behavioural personal finance',
  // what the agents are reading — the deck plus NAMED data-room docs (the Studio brief carries names; a
  // workspace upload carries only a count, which is why the manifest reconciles the difference out loud).
  inputs: {
    deck: { name: 'MoneyGym — Pre-seed deck v3.pdf' },
    total: 65,
    docs: [
      { name: 'MoneyGym — Financial model 2026-28.xlsx', chars: 48210 },
      { name: 'Cap table — post-SAFE.xlsx', chars: 9140 },
      { name: 'Founder agreement (signed).pdf', needsDeepRead: true },
      { name: 'Cohort retention — Jan–Jun.csv', chars: 21870 },
      { name: 'UK predecessor — traction memo.docx', chars: 33640 },
      { name: 'Customer interviews (12).md', chars: 51200 },
    ],
  },
  lifecycle: [
    { label: 'Intake', at: '2 Jul', state: 'done', meta: 'MoneyGym Score 1 · assessment' },
    { label: 'Documents received', at: '4 Jul', state: 'done', meta: '65 documents · deck + data room' },
    { label: 'Assessment run', at: 'started 14:22', state: 'current', meta: 'Assess · v3 rubric · eleven workstreams' },
    { label: 'Verdict ready', state: 'pending', meta: 'A score /100, the case both ways, the diligence list' },
    { label: 'Operator sign-off', state: 'pending', meta: 'You endorse it before it can be shared' },
    { label: 'Decision', state: 'pending', meta: 'Confirm or decline the deal' },
  ],
};

// the seeded 0/35 scaffold — every category present, nothing rated. The composition table sits there EMPTY,
// which is the whole point: the answer's furniture, waiting for the answer.
export const SCORE_FORMING = {
  composite: 0, potential: 0, band: 'Forming',
  categories: SCORE.categories.map(c => ({
    ...c, rated: '0', frac: 0, pot: 0, num: '0',
    subs: (c.subs || []).map(s => ({ ...s, score: null, note: '' })),
  })),
};

// ?state= — the seven states that must ALL be signed off, not just the pretty one.
export const RUN_STATES = {
  // never picked up yet: NO step/totalSteps/progress — a queued fixture carrying them would fabricate a %.
  queued:    { status: 'queued', requestedAt: ago(1), label: 'Queued — dispatching the cloud runner…' },
  // the healthy mid-run — THE HERO SHOT.
  running:   { status: 'running', totalSteps: 11, step: 4, progress: 36, startedAt: ago(22),
               label: 'Benchmarking against the four closest comparables…', githubRunId: 29177092529 },
  // the agent never wrote _run-progress.json. Nothing enforces that it does → the MOST LIKELY first state.
  silent:    { status: 'running', totalSteps: 8, step: 0, progress: 0, startedAt: ago(9), githubRunId: 29177092529 },
  // a long, legitimate silence — a single max-effort step can run for tens of minutes. Must stay CALM.
  quiet:     { status: 'running', totalSteps: 11, step: 6, progress: 55, startedAt: ago(38),
               label: 'Writing the investment analysis…', githubRunId: 29177092529 },
  paused:    { status: 'limit-paused', totalSteps: 11, step: 7, progress: 64, startedAt: ago(51),
               label: 'Paused — usage limit. Resumes when the window resets.', githubRunId: 29177092529 },
  error:     { status: 'error', totalSteps: 11, step: 5, startedAt: ago(74), stalledBy: 'watchdog',
               error: 'The run stopped reporting. Nothing was published — re-run it; nothing is lost.' },
  // republish REUSES runState with a 3-step plan — the likeliest regression, so it gets a state.
  republish: { status: 'running', phase: 'republish', totalSteps: 3, step: 2, progress: 60, startedAt: ago(1),
               label: 'Re-applying the score, verdict & research…', githubRunId: 29177092529 },
};

// ============================================================
// EVIDENCE GAPS — the DS demo state (assess.html?state=gaps).
//
// These are in the RUNNER'S OWN SHAPE (tools/cloud/publish.js publishGaps → engagement.assessmentGaps),
// and they are pushed through the REAL adapter (adaptGaps) rather than hand-written in the adapted shape —
// so this fixture cannot silently drift away from the contract the runner actually publishes.
//
// They are the real MoneyGym misses: Lancaster and Goudge are, in the assessment's own words, "not
// externally verifiable". The venture was docked for that. It may well be that we simply looked in the
// wrong places — which is the entire point of the feature.
//
// ⚠ NOTE WHAT IS NOT HERE: any projected score gain. `cappedAt` is a CEILING, not a promise. See ds.js.
// ============================================================
export const GAPS_RAW = [
  {
    id: 'team-lancaster-cto',
    subject: 'Kevin Lancaster — CTO / Co-Founder',
    checkKind: 'own-materials',
    outcome: 'NOT-FOUND',
    sought: 'any public record of his ML leadership history, or of his role at ilumoni',
    source: { doc: 'assessment/team-diligence.md', row: 'Lancaster, K.' },
    searched: [
      { source: 'Companies House — officer search', url: 'https://find-and-update.company-information.service.gov.uk', result: 'no officer of that name at Monely Ltd' },
      { source: 'ilumoni launch coverage (2021–22), 6 outlets', url: null, result: 'no mention' },
      { source: 'Google / Bing — "Kevin Lancaster" + ilumoni / ML', url: null, result: '0 corroborating results' },
      { source: 'LinkedIn', url: 'https://www.linkedin.com/', result: 'blocked — HTTP 999 to an automated fetcher' },
    ],
    impact: { signals: ['team.founder_market_fit', 'team.execution_record'], cappedAt: 0.5, observedScore: 0 },
    closesWith: ['profile-page', 'employment-record', 'registry-record'],
    status: 'open',
  },
  {
    id: 'team-goudge-coo',
    subject: 'Neil Goudge — COO / Co-Founder',
    checkKind: 'press-corroboration',
    outcome: 'UNVERIFIED',
    sought: 'independent corroboration of his connection to ilumoni',
    source: { doc: 'assessment/team-diligence.md', row: 'Goudge, N.' },
    searched: [
      { source: 'Companies House — Monely Ltd filings', url: 'https://find-and-update.company-information.service.gov.uk', result: 'absent from all filings' },
      { source: 'Press archive — 3 independent outlets required', url: null, result: '0 of 3 found' },
      { source: 'LinkedIn — name match', url: null, result: '1 unconfirmed match, commercial insurance' },
    ],
    impact: { signals: ['team.founder_market_fit'], cappedAt: 0.5, observedScore: 0.5 },
    closesWith: ['profile-page', 'press-article', 'employment-record'],
    status: 'open',
  },
  {
    id: 'exec-fca-permission',
    subject: 'FCA authorisation for open-banking data access',
    checkKind: 'regulator-register',
    outcome: 'NOT-FOUND',
    sought: 'an AISP permission on the FCA register, under MoneyGym or a principal',
    source: { doc: 'assessment/claims-validation.md', row: 'Claim 14 — "FCA-regulated data access"' },
    searched: [
      { source: 'FCA Financial Services Register — firm search', url: 'https://register.fca.org.uk', result: 'no firm found' },
      { source: 'FCA register — appointed-representative search', url: 'https://register.fca.org.uk', result: 'no match' },
    ],
    impact: { signals: ['execution.live_surfaces'], cappedAt: 0.5, observedScore: 0 },
    closesWith: ['regulator-record', 'filing', 'dataroom-doc'],
    status: 'open',
  },
];

// The operator's filed records — the append-only evidence ledger (engagements/{id}/operatorEvidence).
// THREE STATES, all of which the UI must render honestly:
//   · 'captured' + settled  → the runner fetched it, the scorer read it, and publish.js stamped what it did
//                             to the score. Here it moved ONE signal UP and the composite +2.
//   · 'fetch-failed'        → LinkedIn 999s a datacenter fetcher. This is EXPECTED, not an error, and the
//                             receipt must name the way out: save the page as a PDF and upload it.
// A record whose evidence went AGAINST the venture would look exactly the same, with a negative
// compositeDelta — and the UI renders a fall as plainly as a rise. That is the mechanism working.
export const EVIDENCE_RAW = [
  {
    id: 'ev-001', gapId: 'team-goudge-coo', status: 'captured',
    url: 'https://find-and-update.company-information.service.gov.uk/company/09876543/officers',
    finalUrl: 'https://find-and-update.company-information.service.gov.uk/company/09876543/officers',
    httpStatus: 200, contentType: 'text/html; charset=utf-8', bytes: 41208,
    contentSha: 'ab12cd34ef56789012345678901234567890abcdef1234567890abcdef123456',
    capturedFile: 'research/external-record-ab12cd34.md',
    note: 'He is on the register under the trading name, not the brand.',
    filedBy: 'antony@ventrify.io', filedAt: '2026-07-13T14:02:00Z',
    rescoredIn: 'snap-0009', rescoredAt: '2026-07-13T14:31:00Z', batchRecords: 1,
    signalDelta: [{ slug: 'team.founder_market_fit', from: 0.5, to: 1 }],
    compositeDelta: 2,
  },
  {
    id: 'ev-002', gapId: 'team-lancaster-cto', status: 'fetch-failed',
    url: 'https://www.linkedin.com/in/kevin-lancaster-ml/',
    httpStatus: 999, fetchError: 'the site returned a login wall, not a profile',
    note: 'His LinkedIn shows 8 years of ML leadership.',
    filedBy: 'antony@ventrify.io', filedAt: '2026-07-13T14:20:00Z',
  },
];

// Build the ?state=gaps ASSESSMENT through the REAL adapter — the demo exercises the shipping code path.
export function withGaps(A, S) {
  const p = { assessmentGaps: { schema: 1, unresolved: GAPS_RAW, count: GAPS_RAW.length }, operatorEvidence: EVIDENCE_RAW };
  const { gaps, gapById, gapBySlug } = adaptGaps(p, S);
  return {
    ...A,
    gaps, gapById, gapBySlug, filings: EVIDENCE_RAW,
    team: { ...A.team, members: linkGapsToMembers(A.team.members, gaps) },
  };
}
