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
