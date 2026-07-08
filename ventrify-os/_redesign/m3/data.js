// ============================================================
// Ventrify OS — Design System · sample data
// Mirrors the live workspace data shapes (assessment verdict + VSS score +
// engagements + queue). The showcase and the experimental pages both render
// from this, so a data-shape change is felt everywhere at once.
// ============================================================

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
    { icon: 'query_stats', tone: 'p', title: 'Market sizing', note: 'Bottom-up TAM rebuild — the $110B claim is a 44–73× category error · 8 sources', tag: 'L3' },
    { icon: 'table_chart', tone: 'p', title: 'Competitive benchmark', note: '10 competitors mapped; Cleo occupies the category at ~7M users, $280M+ ARR · 14 sources', tag: 'L3' },
    { icon: 'badge', tone: 's', title: 'Team & founder diligence', note: 'Companies House verification; 2 of 3 co-founders unverifiable against ilumoni filings', tag: 'L3' },
    { icon: 'science', tone: 'w', title: 'Claims validation', note: 'Deck claims pressure-tested — CAC compression, 35% trial-to-paid, §1033 tailwind · 12 findings', tag: '3 fail', tagKind: 'warn' },
    { icon: 'payments', tone: 'p', title: 'Investment analysis & returns', note: 'Three valuation methods converge on $15–35M pre; exit math vs the deck’s $2.3B claim', tag: 'L2' },
    { icon: 'calculate', tone: 'p', title: 'Unit economics', note: 'LTV/CAC, gross margin with app-store fees, the model’s internal contradictions · 6 sources', tag: 'L2' },
    { icon: 'groups', tone: 'p', title: 'Demand & traction', note: 'Verified $95–144 WTP band; MoneyGym-specific US demand is zero', tag: 'L2' }
  ],
  dataRoom: [
    { icon: 'description', title: 'Deal memo', note: 'Full write-up · exported PDF', tag: 'L1', action: 'tag', kind: 'generated' },
    { icon: 'slideshow', title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Founder upload · TAM/SAM/SOM on slide 4', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'table_view', title: 'MoneyGym unit economics + sensitivity.xlsx', note: 'Founder upload · the +$4.25M vs −$1.94M contradiction', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'article', title: 'Founder letter + ilumoni retrospective', note: 'Founder upload · the £148→£13 CAC claim', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'folder_zip', title: 'Data room export', note: 'All 18 sources + research · .zip', action: 'download', kind: 'dataroom' }
  ]
};

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
