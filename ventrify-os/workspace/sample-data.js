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
    assessment: {
      recommendation: 'Diligence further',
      conviction: 'Medium',
      thesis: 'A biological input that meaningfully cuts fertiliser cost and emissions, riding the regenerative-ag tailwind — if field efficacy holds outside the greenhouse.',
      biggestRisk: 'Greenhouse results rarely survive contact with real fields — variable soils, weather and application could collapse the 40% claim to single digits.',
      theAsk: '$3M on $12M pre (Seed)',
      mustBeTrue: ['Field trials replicate the 40% reduction across 3+ soil types', 'A repeatable distribution channel into row-crop farmers exists', 'Unit economics survive real agricultural CAC'],
      bull: ['Real cost + emissions saving on a non-discretionary input', 'Regulatory + buyer tailwind (regenerative ag, carbon)', 'Defensible strain IP'],
      bear: ['Greenhouse-to-field efficacy gap', 'Long, seasonal sales cycles', 'Commodity price sensitivity'],
      valuation: { verdict: 'Fair', note: '$12M pre for pre-field-data biologicals is in range — fair if efficacy holds, rich if it does not.', comps: [{ name: 'Pivot Bio', stage: 'Category reference', detail: 'sets the efficacy + distribution bar' }] },
      exit: { acquirers: ['Corteva', 'Bayer', 'Nutrien'], path: 'Strategic acquisition by an ag-input major once field efficacy + a channel are proven.', returns: 'Credible strategic multiple if the science holds; binary on field data.' },
      diligence: [{ item: 'Commission independent multi-site field trials', priority: 'high' }, { item: 'Quantify the advantage vs Pivot Bio with data', priority: 'high' }, { item: 'Secure a distribution LOI with an ag-input retailer', priority: 'medium' }]
    },
    investabilitySnapshot: {
      composite: 23, maxPossible: 35, pct: 66, band: 'feedback', bandLabel: 'Promising — gaps to close', ratedCount: 35,
      categories: [
        { label: 'Market', sum: 4.5, max: 5, band: 'green' },
        { label: 'Team', sum: 3, max: 5, band: 'yellow' },
        { label: 'Product', sum: 3.5, max: 5, band: 'yellow' },
        { label: 'Technical', sum: 3.5, max: 5, band: 'yellow' },
        { label: 'Financial', sum: 3, max: 5, band: 'yellow' },
        { label: 'Execution', sum: 2.5, max: 5, band: 'yellow' },
        { label: 'Evidence', sum: 3, max: 5, band: 'yellow' }
      ]
    },
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
