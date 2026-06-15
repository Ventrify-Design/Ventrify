// ============================================================
// Ventrify OS — Operator Workspace · Sample data
// Drives the prototype's portfolio dashboard, action queue,
// program detail, team, and settings views.
// ============================================================

const SAMPLE_ORG = {
  name: 'Mercer Ventures',
  tier: 'Cohort',
  programsLimit: 'Unlimited',
  operatorSeatsLimit: 'Unlimited',
  renewalDate: '2027-03-14',
  successContact: { name: 'Naya Patel', email: 'naya@ventrify.io' }
};

const SAMPLE_OPERATORS = [
  { id: 'op-01', name: 'Alex Doré', email: 'alex@mercer.vc', role: 'Program Lead', avatar: 'AD', avatarColor: '#0036FF', programsAssigned: ['prg-01','prg-04','prg-06'] },
  { id: 'op-02', name: 'Priya Singh', email: 'priya@mercer.vc', role: 'Operator', avatar: 'PS', avatarColor: '#7A3FFF', programsAssigned: ['prg-02','prg-05'] },
  { id: 'op-03', name: 'Tom Reeves', email: 'tom@mercer.vc', role: 'Operator', avatar: 'TR', avatarColor: '#00B8A0', programsAssigned: ['prg-03'] }
];

const CURRENT_OPERATOR_ID = 'op-01';

// Phase mapping: 0=Phase 0 (Intake), 1=Discover, 2=Define, 2.5=Financials, 3=Design, 4=Develop, 4.5=Beta, 5=Deliver
const PHASE_LABELS = {
  0: 'Phase 0 · Intake',
  1: 'Phase 1 · Discover',
  2: 'Phase 2 · Define',
  2.5: 'Phase 2.5 · Financials',
  3: 'Phase 3 · Design',
  4: 'Phase 4 · Develop',
  4.5: 'Phase 4B · Beta',
  5: 'Phase 5 · Deliver'
};

const HUB_LABELS = {
  research: 'Research Hub',
  vision: 'Vision Hub',
  strategy: 'Strategy Hub',
  financials: 'Financials Hub',
  marketing: 'Marketing Hub',
  video: 'Video Hub',
  blog: 'Blog Hub'
};

const SAMPLE_PROGRAMS = [
  {
    id: 'prg-01',
    name: 'Northwind',
    founderName: 'Marcus Chen',
    founderAvatar: 'MC',
    founderAvatarColor: '#FF7A3F',
    industry: 'Climate / Energy',
    venturePitch: 'AI-driven energy consumption insights for SMBs',
    phase: 4,
    gateStatus: 'Gate 2.5 signed off · SOW signed',
    startDate: '2026-03-04',
    daysActive: 71,
    lastActivity: '2 hours ago',
    lastActivityDetail: 'ux-designer · audit Round 2 complete',
    assignedOperator: 'op-01',
    health: 'on-track',
    cards: { drafted: 24, awaitingFounder: 0, resolved: 24, awaitingL3Rebuild: 0 },
    hubs: {
      research: { status: 'signed', cards: 6 },
      vision: { status: 'signed', cards: 7 },
      strategy: { status: 'signed', cards: 5 },
      financials: { status: 'signed', cards: 6 },
      marketing: { status: 'in-progress' },
      video: { status: 'pending' },
      blog: { status: 'in-progress' }
    },
    investabilitySnapshot: {
      composite: 25, maxPossible: 35, pct: 71, band: 'feedback', bandLabel: 'Promising — clear levers to pull', ratedCount: 35,
      categories: [
        { label: 'Market', sum: 4, max: 5, band: 'green' },
        { label: 'Team', sum: 3.5, max: 5, band: 'yellow' },
        { label: 'Product', sum: 4, max: 5, band: 'green' },
        { label: 'Technical', sum: 3, max: 5, band: 'yellow' },
        { label: 'Financial', sum: 3.5, max: 5, band: 'yellow' },
        { label: 'Execution', sum: 3, max: 5, band: 'yellow' },
        { label: 'Evidence', sum: 4, max: 5, band: 'green' }
      ]
    },
    investabilitySuggestions: { items: [
      { category: 'Team', suggestion: 'Add a named commercial/GTM lead — investors flag founder-market fit on the sales side.' },
      { category: 'Financial', suggestion: 'Tighten the unit-economics model: show CAC payback under 12 months at the current ACV.' },
      { category: 'Execution', suggestion: 'Convert two pilots into paid contracts before the next raise to evidence pull.' }
    ] },
    mvpDemoModeReady: true
  },
  {
    id: 'prg-02',
    name: 'Stellaria',
    founderName: 'Sophie Laurent',
    founderAvatar: 'SL',
    founderAvatarColor: '#7A3FFF',
    industry: 'Healthtech',
    venturePitch: 'Sleep-pattern coaching app for shift workers',
    phase: 2,
    gateStatus: 'Gate 2 in review · 5 cards awaiting founder',
    startDate: '2026-04-22',
    daysActive: 22,
    lastActivity: '8 hours ago',
    lastActivityDetail: 'research-curator · drafted 7 Vision Hub cards',
    assignedOperator: 'op-02',
    health: 'on-track',
    cards: { drafted: 13, awaitingFounder: 5, resolved: 8, awaitingL3Rebuild: 0 },
    hubs: {
      research: { status: 'signed', cards: 6 },
      vision: { status: 'awaiting-founder', cards: 7 },
      strategy: { status: 'pending' },
      financials: { status: 'pending' },
      marketing: { status: 'pending' },
      video: { status: 'pending' },
      blog: { status: 'pending' }
    },
    mvpDemoModeReady: false
  },
  {
    id: 'prg-03',
    name: 'Halo Sound',
    founderName: 'Jamie Patel',
    founderAvatar: 'JP',
    founderAvatarColor: '#00B8A0',
    industry: 'Consumer audio',
    venturePitch: 'Crowdsourced sleep soundscapes with creator royalties',
    phase: 1,
    gateStatus: 'Gate 1 stuck · founder unresponsive 9 days',
    startDate: '2026-05-01',
    daysActive: 13,
    lastActivity: '9 days ago',
    lastActivityDetail: 'Founder last opened Research Hub',
    assignedOperator: 'op-03',
    health: 'stuck',
    cards: { drafted: 6, awaitingFounder: 6, resolved: 0, awaitingL3Rebuild: 0 },
    hubs: {
      research: { status: 'awaiting-founder', cards: 6 },
      vision: { status: 'pending' },
      strategy: { status: 'pending' },
      financials: { status: 'pending' },
      marketing: { status: 'pending' },
      video: { status: 'pending' },
      blog: { status: 'pending' }
    },
    mvpDemoModeReady: false
  },
  {
    id: 'prg-04',
    name: 'Quill',
    founderName: 'Eleni Vasquez',
    founderAvatar: 'EV',
    founderAvatarColor: '#FF3F7A',
    industry: 'B2B SaaS',
    venturePitch: 'Contracts intake + structured negotiation for legal ops',
    phase: 2.5,
    gateStatus: 'Gate 2.5 ready · all cards resolved, L3 rebuilt',
    startDate: '2026-03-18',
    daysActive: 57,
    lastActivity: '1 hour ago',
    lastActivityDetail: 'financial-modeler · Financials Hub regenerated',
    assignedOperator: 'op-01',
    health: 'attention',
    cards: { drafted: 18, awaitingFounder: 0, resolved: 18, awaitingL3Rebuild: 0 },
    hubs: {
      research: { status: 'signed', cards: 6 },
      vision: { status: 'signed', cards: 6 },
      strategy: { status: 'signed', cards: 4 },
      financials: { status: 'ready-to-sign', cards: 7 },
      marketing: { status: 'pending' },
      video: { status: 'pending' },
      blog: { status: 'pending' }
    },
    mvpDemoModeReady: false
  },
  {
    id: 'prg-05',
    name: 'Riverdraft',
    founderName: 'Kasper Holm',
    founderAvatar: 'KH',
    founderAvatarColor: '#0036FF',
    industry: 'Edtech',
    venturePitch: 'Adaptive writing practice for university applicants',
    phase: 4.5,
    gateStatus: 'In beta · 7 testers active · 3 critical issues open',
    startDate: '2026-02-09',
    daysActive: 94,
    lastActivity: '4 hours ago',
    lastActivityDetail: 'ux-designer · Round 3 polish in progress',
    assignedOperator: 'op-02',
    health: 'attention',
    cards: { drafted: 26, awaitingFounder: 0, resolved: 26, awaitingL3Rebuild: 0 },
    hubs: {
      research: { status: 'signed', cards: 7 },
      vision: { status: 'signed', cards: 6 },
      strategy: { status: 'signed', cards: 5 },
      financials: { status: 'signed', cards: 6 },
      marketing: { status: 'in-progress' },
      video: { status: 'in-progress' },
      blog: { status: 'signed' }
    },
    mvpDemoModeReady: true
  },
  {
    id: 'prg-06',
    name: 'Caldera',
    founderName: 'Inez Okonkwo',
    founderAvatar: 'IO',
    founderAvatarColor: '#9B6FFF',
    industry: 'Fintech',
    venturePitch: 'Group savings circles for diaspora communities',
    phase: 0,
    gateStatus: 'Phase 0 · brief intake in progress',
    startDate: '2026-05-12',
    daysActive: 2,
    lastActivity: '20 min ago',
    lastActivityDetail: 'Brief intake form opened by founder',
    assignedOperator: 'op-01',
    health: 'on-track',
    cards: { drafted: 0, awaitingFounder: 0, resolved: 0, awaitingL3Rebuild: 0 },
    hubs: {
      research: { status: 'pending' },
      vision: { status: 'pending' },
      strategy: { status: 'pending' },
      financials: { status: 'pending' },
      marketing: { status: 'pending' },
      video: { status: 'pending' },
      blog: { status: 'pending' }
    },
    mvpDemoModeReady: false
  },
  {
    id: 'prg-07',
    name: 'Verdana Bio',
    engagementType: 'assessment',
    founderName: 'Verdana Bio (external)',
    founderAvatar: 'VB',
    founderAvatarColor: '#00B8A0',
    industry: 'Climate biotech',
    venturePitch: 'Engineered soil microbes that cut synthetic-fertiliser use by 40%',
    website: 'https://verdana.bio',
    stage: 'Seed',
    phase: 0,
    gateStatus: 'Assessment complete',
    daysActive: 3,
    lastActivity: '1 hour ago',
    lastActivityDetail: 'Assessment run complete · deep research published',
    assignedOperator: 'op-01',
    health: 'on-track',
    cards: { drafted: 5, awaitingFounder: 0, resolved: 5, awaitingL3Rebuild: 0 },
    founderDocCount: 9,
    pitchDoc: { name: 'Verdana-Bio-Seed-Deck.pdf' },
    assessment: {
      recommendation: 'Diligence further',
      conviction: 'Medium',
      thesis: 'A biological input that meaningfully cuts fertiliser cost and emissions, riding the regenerative-ag tailwind — if field efficacy holds outside the greenhouse.',
      biggestRisk: 'Greenhouse results rarely survive contact with real fields — variable soils, weather and application could collapse the 40% claim to single digits.',
      theAsk: '$3M on $12M pre (Seed)',
      mustBeTrue: ['Field trials replicate the 40% reduction across 3+ soil types', 'A repeatable distribution channel into row-crop farmers exists', 'Unit economics survive real agricultural CAC'],
      bull: ['Real cost + emissions saving on a non-discretionary input', 'Regulatory + buyer tailwind (regenerative ag, carbon)', 'Defensible strain IP'],
      bear: ['Greenhouse-to-field efficacy gap', 'Long, seasonal sales cycles', 'Commodity price sensitivity'],
      valuation: {
        verdict: 'Fair, leaning cheap if the field data holds',
        note: 'At $12M pre with greenhouse-only data, the round prices below the biological-inputs comps at equivalent stage — Pivot Bio raised its Series A at a materially higher mark on similar early evidence. The discount reflects the unproven field efficacy and the absent distribution channel; if the multi-site trials replicate the 40% reduction, $12M pre is a cheap entry into a validated input category.',
        comps: [
          { name: 'Pivot Bio', stage: 'Series A (2017)', detail: '$70M Series A on nitrogen-fixing microbes with early field data. The category reference — sets the efficacy and distribution bar Verdana is benchmarked against. Reached $600M+ raised and millions of paid acres; the outcome Verdana is underwriting toward.' },
          { name: 'Sound Agriculture', stage: 'Series C', detail: '$45M Series C; nutrient-efficiency biologicals with commercial traction. Validates the retail-partner distribution model Verdana lacks — the gap the round must close before Series A.' },
          { name: 'Andes', stage: 'Series B', detail: '$30M Series B (Leaps by Bayer) on seed-coating microbes. A closer modality comp; its strategic-backer round signals that ag-input majors will fund biologicals that clear field-efficacy diligence.' }
        ]
      },
      exit: { acquirers: ['Corteva', 'Bayer', 'Nutrien'], path: 'Strategic acquisition by an ag-input major once field efficacy + a channel are proven.', returns: 'Credible strategic multiple if the science holds; binary on field data.' },
      diligence: [{ item: 'Commission independent multi-site field trials', priority: 'high' }, { item: 'Quantify the advantage vs Pivot Bio with data', priority: 'high' }, { item: 'Secure a distribution LOI with an ag-input retailer', priority: 'medium' }],
      provenance: { competitors: 5, rounds: 6, marketReports: 4, foundersResearched: true, sources: 19 },
      benchmark: {
        dimensions: ['Stage', 'Funding', 'Mechanism', 'Field data', 'Distribution'],
        note: 'Verdana is earlier and cheaper than the category leaders, but unproven in the field.',
        competitors: [
          { name: 'Verdana Bio', isTarget: true, cells: { Stage: 'Seed', Funding: '$0.4M', Mechanism: 'Engineered soil microbes', 'Field data': 'Greenhouse only', Distribution: 'None yet' } },
          { name: 'Pivot Bio', cells: { Stage: 'Series D', Funding: '$600M+', Mechanism: 'N-fixing microbes', 'Field data': 'Millions of acres', Distribution: 'Direct + retail' } },
          { name: 'Sound Agriculture', cells: { Stage: 'Series D', Funding: '$400M+', Mechanism: 'Nutrient efficiency', 'Field data': 'Commercial', Distribution: 'Retail partners' } },
          { name: 'Corteva Biologicals', cells: { Stage: 'Incumbent', Funding: 'n/a', Mechanism: 'Broad portfolio', 'Field data': 'Extensive', Distribution: 'Global channel' } }
        ]
      },
      market: {
        tam: { value: '$190B', label: 'Global fertiliser' },
        sam: { value: '$30B', label: 'Biological inputs' },
        som: { value: '$1.2B', label: 'Microbial N-reduction (5yr)' },
        note: 'Top-down from the fertiliser market; the credible near-term SOM is the regenerative/row-crop subset that will trial biologicals.'
      },
      rounds: [
        { company: 'Pivot Bio', stage: 'Series D', amount: '$430M', valuation: '~$2B', investors: 'DCVC, Temasek, G2VP' },
        { company: 'Sound Agriculture', stage: 'Series D', amount: '$75M', valuation: 'n/d', investors: 'BMO, Chan Zuckerberg' },
        { company: 'Andes', stage: 'Series B', amount: '$30M', valuation: 'n/d', investors: 'Leaps by Bayer' },
        { company: 'Kula Bio', stage: 'Series A', amount: '$50M', valuation: 'n/d', investors: 'Lowercarbon Capital' }
      ],
      team: {
        summary: 'Strong scientific founder; commercial and ag-distribution experience is the gap.',
        members: [
          { name: 'Dr Lena Park', role: 'CEO / Founder', signal: 'positive', background: 'PhD soil microbiology (UC Davis), 12 patents; 2 years at a Series-C ag-biotech before founding.' },
          { name: 'Raj Mehta', role: 'CTO', signal: 'neutral', background: 'Synthetic-biology lead; first commercial role — strong science, unproven at scale.' }
        ],
        gaps: ['No commercial / ag-distribution lead', 'No regulatory or field-trial veteran on the team']
      }
    },
    investabilitySnapshot: {
      composite: 18, maxPossible: 27, pct: 67, band: 'feedback', bandLabel: 'Promising — named gaps to close before partner meeting',
      ratedCount: 27, pendingCount: 8,
      categories: [
        { key: 'market', label: 'Market Opportunity', sum: 4, max: 5, rated: 5, pending: 0, band: 'green', subs: [
          { slug: 'market_size', score: 1, note: '$190B fertiliser; ~$1.2B near-term microbial-N SOM — well above $1B. · ref: research/market-analysis' },
          { slug: 'market_growth', score: 1, note: 'Biological inputs ~20% CAGR — the fastest-growing input segment.' },
          { slug: 'why_now', score: 1, note: 'Input-cost inflation + regenerative-ag buyer programs + carbon credits.' },
          { slug: 'demand_validation', score: 0.5, note: 'Buyer pull is real, but no paying farmers or field LOIs yet.' },
          { slug: 'gross_margin', score: 0.5, note: 'Input-style margins plausible; unproven at field scale.' } ] },
        { key: 'team', label: 'Team & Founder-Market Fit', sum: 3, max: 5, rated: 5, pending: 0, band: 'yellow', subs: [
          { slug: 'ceo_vision', score: 0.5, note: 'Credible scientific vision; commercial-ag leadership unproven.' },
          { slug: 'talent_attraction', score: 0.5, note: 'Strong science bench; no senior commercial / distribution hire.' },
          { slug: 'founder_market_fit', score: 0.5, note: 'Deep microbiology fit; thin on row-crop go-to-market.' },
          { slug: 'execution_record', score: 0.5, note: 'Lab / greenhouse delivery shown; no field or commercial record.' },
          { slug: 'ethics_trust', score: 1, note: 'Deck is candid about the field-efficacy risk.' } ] },
        { key: 'product', label: 'Product & Solution Clarity', sum: 2, max: 5, rated: 3, pending: 2, band: 'yellow', subs: [
          { slug: 'value_prop_clarity', score: 1, note: '"Cut synthetic fertiliser 40%" — crisp and repeatable.' },
          { slug: 'improvement_10x', score: 0.5, note: '40% reduction is material, not 10x; field-unproven.' },
          { slug: 'moscow_discipline', score: null, note: 'Not assessable in a deck-only assessment (build-engagement artifact).' },
          { slug: 'persona_depth', score: null, note: 'Not assessable in a deck-only assessment (build-engagement artifact).' },
          { slug: 'problem_validation', score: 0.5, note: 'Fertiliser cost + emissions are real; validated only in greenhouse.' } ] },
        { key: 'moat', label: 'Technical / Competitive Moat', sum: 2, max: 5, rated: 5, pending: 0, band: 'red', subs: [
          { slug: 'differentiation', score: 0.5, note: 'Engineered strains, but mechanism close to Pivot Bio.' },
          { slug: 'ip_defensibility', score: 0.5, note: 'Strain IP claimed; freedom-to-operate unverified.' },
          { slug: 'switching_costs', score: 0, note: 'No lock-in — pre-commercial.' },
          { slug: 'scalability', score: 0.5, note: 'Fermentation should scale; cost curve unproven.' },
          { slug: 'ecosystem_moats', score: 0.5, note: 'Possible ag-input partnerships; none signed.' } ] },
        { key: 'financial', label: 'Financial Defensibility', sum: 2.5, max: 5, rated: 3, pending: 2, band: 'green', subs: [
          { slug: 'files_complete', score: null, note: 'Not assessable in a deck-only assessment (the 11 build financial files).' },
          { slug: 'ltv_cac_ratio', score: null, note: 'Not yet assessable pre-revenue.' },
          { slug: 'sensitivity_coverage', score: 0.5, note: 'Bull / bear sketched; no multi-variable model.' },
          { slug: 'milestone_anchored_ask', score: 1, note: '$3M ask tied to multi-site field trials — the value event. · ref: assessment/deal-memo' },
          { slug: 'risk_honesty', score: 1, note: 'Greenhouse-to-field risk named up front, not buried.' } ] },
        { key: 'execution', label: 'Execution & Traction', sum: 0.5, max: 5, rated: 1, pending: 4, band: 'yellow', subs: [
          { slug: 'live_surfaces', score: null, note: 'Not assessable in a deck-only assessment (build-engagement artifact).' },
          { slug: 'ia_coverage', score: null, note: 'Not assessable in a deck-only assessment (build-engagement artifact).' },
          { slug: 'gate_velocity', score: null, note: 'Not assessable in a deck-only assessment (build-engagement artifact).' },
          { slug: 'payment_cadence', score: null, note: 'Not assessable in a deck-only assessment (build-engagement artifact).' },
          { slug: 'traction_signals', score: 0.5, note: 'Greenhouse results; no field data, revenue or LOIs.' } ] },
        { key: 'evidence', label: 'Evidence Integrity', sum: 4, max: 5, rated: 5, pending: 0, band: 'green', subs: [
          { slug: 'citation_density', score: 1, note: 'Material claims carry inline citations.' },
          { slug: 'source_count', score: 1, note: '19 distinct credible sources across the research.' },
          { slug: 'hallucination_check', score: 0.5, note: 'Sources clean; greenhouse efficacy unverifiable externally.' },
          { slug: 'methodology_disclosure', score: 0.5, note: 'Market sizing has method; field extrapolation under-specified.' },
          { slug: 'cross_file_consistency', score: 1, note: 'Figures reconcile across research and the ask.' } ] }
      ]
    },
    provCards: [
      { id: 'vb-f1', hub: 'research', level: 'L2', number: 1, type: 'kill-risk', title: 'Greenhouse results rarely survive contact with real fields', body: 'The 40% reduction is greenhouse-only. Across 3+ field sites, variable soils, weather and application routinely collapse gains like this to single digits. This is the load-bearing assumption — independent multi-site trials must replicate it before any wire.' },
      { id: 'vb-f2', hub: 'research', level: 'L2', number: 2, type: 'gap', title: 'No distribution channel into row-crop farmers', body: 'Verdana has no signed retailer or co-op channel. The comparable winners leaned on retail partners (Sound Agriculture) — the round must evidence a route to the farmer, not just a product.' },
      { id: 'vb-f3', hub: 'research', level: 'L2', number: 3, type: 'moat', title: 'Strain IP is the only moat — and it is unverified', body: 'Differentiation vs Pivot Bio rests on proprietary strains. Without granted composition-of-matter claims and a freedom-to-operate opinion, a well-funded incumbent can fast-follow within a few seasons.' },
      { id: 'vb-f4', hub: 'research', level: 'L2', number: 4, type: 'upside', title: 'At $12M pre, the entry is cheap — if the field data holds', body: 'Pivot Bio raised its Series A at a materially higher mark on similar early evidence. If the multi-site trials replicate the 40% reduction, $12M pre is a cheap entry into a validated input category. The bet is binary on field efficacy.' }
    ],
    investabilitySuggestions: { items: [
      { category: 'Evidence', suggestion: 'Run independent multi-site field trials — greenhouse data alone will not clear diligence.' },
      { category: 'Execution', suggestion: 'Sign a distribution LOI with an ag-input retailer to evidence the channel.' }
    ] },
    hubDocs: [
      { hub: 'research', name: 'market-analysis', title: 'Market analysis', order: 0, level: 'L3', body: `## Market analysis

Global fertiliser is a ~$190B market; nitrogen alone is ~$70B and is both a major farm cost and ~2% of global emissions. Biological inputs are the fastest-growing segment (~20% CAGR), pulled by input-cost inflation and regenerative-ag buyer programs.

**Strong:** the saving attaches to a non-discretionary input, so adoption is a cost decision, not a values decision. **Weak:** biologicals carry a credibility problem after a decade of underperforming products — the bar for field evidence is high.

## Sources & References
- IFA fertiliser market outlook 2025
- AgFunder AgriFoodTech investment report 2025
- FAO nitrogen-use efficiency briefs` },
      { hub: 'research', name: 'competitor-analysis', title: 'Competitor landscape', order: 1, level: 'L3', body: `## Competitor landscape

The lane includes Pivot Bio (nitrogen-fixing microbes, well funded), Sound Agriculture, and incumbents (Bayer/Ginkgo, Corteva biologicals). Pivot is the reference comp — it validates the category and sets the efficacy + distribution bar.

Defensibility rests on strain IP and field-trial data moats, not on being first. Verdana must **quantify** its advantage versus Pivot, not assert a different mechanism.

## Sources & References
- Pivot Bio funding + product disclosures
- Corteva / Bayer biologicals announcements
- USDA biological-inputs trial data` },
      { hub: 'research', name: 'unit-economics', title: 'Unit economics', order: 2, level: 'L3', body: `## Unit economics

At a ~$12/acre price against a claimed ~$30/acre fertiliser saving, the value share is attractive and gross margin on a biological is high (>70% at scale). The risk is **CAC**: agricultural sales cycles are long and seasonal, and the channel (retailer vs direct) is unproven — the model assumes a channel that does not yet exist.

## Sources & References
- Founder financial model
- Comparable biological-input pricing benchmarks` },
      { hub: 'assessment', name: 'deal-memo', title: 'Deal memo', order: -1, level: 'L3', body: `## Deal memo — Verdana Bio

**Recommendation: Diligence further.** A genuine cost-and-emissions saving on a huge input market, with a credible category comp (Pivot Bio). The thesis gates on one thing: field efficacy. Greenhouse-to-field is where biologicals die.

**Three things that must be true:** (1) the 40% reduction replicates across multiple soils and seasons in independent trials; (2) a repeatable distribution channel exists; (3) unit economics survive real CAC.

**Anti-thesis:** if field efficacy halves and the sales cycle runs two seasons, this is a capital-intensive science project, not a venture-scale return.` }
    ],
    mvpDemoModeReady: false
  }
];

// Derived: action queue items — what the current operator needs to do this week
const SAMPLE_ACTIONS = [
  {
    id: 'act-01',
    type: 'gate-ready',
    urgency: 'high',
    programId: 'prg-04',
    title: 'Gate 2.5 ready to close on Quill',
    detail: 'All 7 Financials Hub cards resolved · L3 rebuilt · founder has signed off. Confirm scope and unlock Phase 3.',
    age: '1 hour ago',
    cta: 'Review &amp; close gate'
  },
  {
    id: 'act-02',
    type: 'cards-to-review',
    urgency: 'high',
    programId: 'prg-02',
    title: '7 Vision Hub cards awaiting your review on Stellaria',
    detail: 'research-curator drafted 7 cards from L3. Review before publishing to the founder.',
    age: '8 hours ago',
    cta: 'Review cards'
  },
  {
    id: 'act-03',
    type: 'stuck-program',
    urgency: 'high',
    programId: 'prg-03',
    title: 'Halo Sound founder unresponsive for 9 days',
    detail: '6 cards in Research Hub awaiting founder. Last activity: opened hub 9 days ago. Recommend a nudge.',
    age: '9 days ago',
    cta: 'Send nudge'
  },
  {
    id: 'act-04',
    type: 'cards-to-review',
    urgency: 'medium',
    programId: 'prg-05',
    title: '4 Marketing cards awaiting your review on Riverdraft',
    detail: 'copy-reviewer flagged 2 cards for tone alignment. Review and publish.',
    age: 'Yesterday',
    cta: 'Review cards'
  },
  {
    id: 'act-05',
    type: 'qa-flag',
    urgency: 'medium',
    programId: 'prg-05',
    title: 'ux-designer flagged 3 critical issues on Riverdraft beta',
    detail: 'Round 2 audit · 2 contrast failures, 1 nav UX issue. Must close before Phase 5 unlocks.',
    age: '4 hours ago',
    cta: 'Open audit report'
  },
  {
    id: 'act-06',
    type: 'l3-rebuild',
    urgency: 'low',
    programId: 'prg-04',
    title: 'L3 rebuild complete on Quill Financials Hub',
    detail: 'financial-modeler regenerated underlying research against resolved cards. Founder can review.',
    age: '2 hours ago',
    cta: 'View changes'
  },
  {
    id: 'act-07',
    type: 'intake',
    urgency: 'low',
    programId: 'prg-06',
    title: 'New program kicked off · Caldera (Inez Okonkwo)',
    detail: 'Brief intake form opened by founder. Phase 0 in progress · welcome pack queued.',
    age: '20 min ago',
    cta: 'Open program'
  }
];

// Helper functions
function getProgram(id) { return SAMPLE_PROGRAMS.find(p => p.id === id); }
function getOperator(id) { return SAMPLE_OPERATORS.find(o => o.id === id); }
function currentOperator() { return getOperator(CURRENT_OPERATOR_ID); }
function programsForOperator(opId) {
  return SAMPLE_PROGRAMS.filter(p => p.assignedOperator === opId);
}

function phaseLabel(phase) { return PHASE_LABELS[phase] || `Phase ${phase}`; }
function phaseProgressPct(phase) {
  // map phase 0..5 to 0..100
  return Math.min(100, Math.round((phase / 5) * 100));
}
function hubStatusLabel(status) {
  return {
    'pending': 'Pending',
    'in-progress': 'In progress',
    'awaiting-founder': 'Awaiting founder',
    'ready-to-sign': 'Ready to sign',
    'signed': 'Signed off'
  }[status] || status;
}

if (typeof window !== 'undefined') {
  window.WORKSPACE_SAMPLE = {
    org: SAMPLE_ORG,
    operators: SAMPLE_OPERATORS,
    programs: SAMPLE_PROGRAMS,
    actions: SAMPLE_ACTIONS,
    currentOperatorId: CURRENT_OPERATOR_ID,
    helpers: { getProgram, getOperator, currentOperator, programsForOperator, phaseLabel, phaseProgressPct, hubStatusLabel },
    labels: { phase: PHASE_LABELS, hub: HUB_LABELS }
  };
}
