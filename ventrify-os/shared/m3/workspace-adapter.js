// ============================================================
// Ventrify OS — WORKSPACE portfolio/queue ADAPTER (READ-ONLY)
//
// Maps the LIVE workspace data (window.WORKSPACE.programs / actions) into the
// normalized row shapes the M3 workspace cards (workspace-cards.js) render.
// Pure functions — never writes, never touches the pipeline. Mirrors the exact
// health/rec/phase logic in workspace/dashboard.html + queue.html so the M3
// pages carry the same signal the classic pages do.
// ============================================================

// (No esc here — the adapter returns raw DATA; the M3 cards escape on render via ds.js _esc.)

// health level → M3 statusPill kind + label (mirrors window.healthClass/healthLabel)
const HEALTH = {
  'on-track': { kind: 'ok', label: 'On track', icon: 'check_circle' },
  'attention': { kind: 'warn', label: 'Needs attention', icon: 'error' },
  'stuck': { kind: 'err', label: 'Stuck', icon: 'warning' },
};
// investability band → kind + word (mirrors the dashboard invColor/bandWord)
const INV_BAND = {
  approved: { kind: 'ok', word: 'Strong' },
  feedback: { kind: 'warn', word: 'Promising' },
  rework: { kind: 'err', word: 'Early' },
  pass: { kind: 'err', word: 'Weak' },
  // a still-forming score (live seed band from vss-rubric) must read neutral, NOT red 'Early'
  forming: { kind: 'info', word: 'Forming' },
  unrated: { kind: 'info', word: 'Forming' },
};
// assessment recommendation → bucket (mirrors dashboard recBucket)
function recBucket(rec) {
  const r = String(rec || '').toLowerCase();
  if (!r) return null;
  if (r.startsWith('invest') || r.includes('back')) return 'invest';
  if (r.startsWith('pass') || r.includes('decline')) return 'pass';
  return 'consider';
}
// run-state status → statusPill (mirrors the assess run machine)
const RUN = {
  queued: { kind: 'info', label: 'Queued', icon: 'schedule' },
  running: { kind: 'info', label: 'Assessing… forming', icon: 'autorenew' },
  partial: { kind: 'info', label: 'Assessing… forming', icon: 'autorenew' },
  'needs-attention': { kind: 'warn', label: 'Needs attention', icon: 'warning' },
  'limit-paused': { kind: 'warn', label: 'Paused', icon: 'pause_circle' },
  error: { kind: 'err', label: 'Run error', icon: 'error' },
};

// ---- ONE program → a normalized card row ----
// ctx = { helpers, A (window.WORKSPACE_AGENTS|null), useLive (bool), currentOperatorId }
export function adaptProgram(p, ctx = {}) {
  const { helpers, A, useLive } = ctx;
  const isAssess = p.engagementType === 'assessment';
  // assessment engagements open the fully-interactive M3 detail; builds still open the classic detail
  const href = `${isAssess ? 'assess-next.html' : 'program.html'}?id=${encodeURIComponent(p.id)}`;
  const avatar = { initials: p.founderAvatar || (p.name || 'V').slice(0, 2).toUpperCase(), color: p.founderAvatarColor || '' };
  const runState = p.runState ? (RUN[p.runState.status] || null) : null;

  if (isAssess) {
    const a = p.assessment || {};
    const inv = p.investability || p.investabilityScore;   // live docs carry the summary under either key (forming → investabilityScore)
    const bucket = recBucket(a.recommendation);
    const recLabel = a.recommendation || (inv ? 'Assessment complete' : 'Assessing…');
    const invB = inv ? (INV_BAND[inv.band] || INV_BAND.rework) : null;
    const meta = [];
    const theAsk = a.theAsk || a.the_ask;   // runner _verdict.json may emit snake_case
    if (theAsk) meta.push('Ask ' + theAsk);
    meta.push('Assessed ' + (p.lastActivity || 'recently'));
    return {
      id: p.id, name: p.name, href, kind: 'assessment',
      avatar, sub: [p.industry || 'Venture', p.stage].filter(Boolean).join(' · '),
      rec: bucket ? { label: recLabel, kind: bucket } : { label: recLabel, kind: 'consider' },
      score: inv ? { pct: inv.pct, band: invB.word, kind: invB.kind, conviction: a.conviction || '' } : null,
      thesis: a.thesis || '',
      meta, runState,
    };
  }

  // build-style engagement
  const industry = p.industry || 'Awaiting brief';
  const cards = p.cards || { drafted: 0, awaitingFounder: 0, resolved: 0 };
  const briefSubmitted = p.briefSubmitted !== false;
  const computed = (useLive && A) ? A.computeEngagementHealth(p) : null;
  const level = computed ? computed.level : (p.health || 'on-track');
  const reasons = computed ? computed.reasons : null;
  const h = HEALTH[level] || HEALTH['on-track'];
  const inv = p.investability || p.investabilityScore;   // forming/build engagements carry the seed under investabilityScore
  const invB = inv ? (INV_BAND[inv.band] || INV_BAND.rework) : null;
  return {
    id: p.id, name: p.name, href, kind: 'engagement',
    avatar, sub: [p.founderName, industry].filter(Boolean).join(' · '),
    health: { level, label: h.label, kind: h.kind, icon: h.icon, reasons: reasons || [] },
    inv: inv ? { pct: inv.pct, kind: invB.kind, composite: inv.composite, max: inv.maxPossible || 35 } : null,
    phaseLabel: helpers ? helpers.phaseLabel(p.phase) : ('Phase ' + p.phase),
    gateStatus: p.gateStatus || '',
    progress: helpers ? helpers.phaseProgressPct(p.phase) : 0,
    meta: ['Started ' + (p.startDate || '—'), (p.daysActive || 0) + ' days active', 'Last activity: ' + (p.lastActivity || 'just now')],
    stats: briefSubmitted ? [
      { v: cards.resolved || 0, l: 'Cards resolved' },
      { v: cards.awaitingFounder || 0, l: 'Awaiting founder' },
      { v: cards.drafted || 0, l: 'Total drafted' },
    ] : null,
    awaiting: briefSubmitted ? null : { founderName: p.founderName || 'the founder' },
    runState,
  };
}

export function adaptPortfolio(programs = [], ctx = {}) {
  return programs.map(p => adaptProgram(p, ctx));
}

// ---- queue actions → normalized items ----
const Q_ICON = {
  'gate-ready': 'task_alt', 'cards-to-review': 'edit_note', 'stuck-program': 'warning',
  'qa-flag': 'search', 'l3-rebuild': 'autorenew', 'intake': 'auto_awesome',
  'assessment-ready': 'task_alt', 'assessment-running': 'autorenew', 'assessment-attention': 'warning',
  'assessment-deck': 'description', 'assessment-run': 'play_arrow',
};
const Q_LABEL = {
  'gate-ready': 'Gate ready', 'cards-to-review': 'Cards to review', 'stuck-program': 'Stuck',
  'qa-flag': 'QA flag', 'l3-rebuild': 'L3 rebuild', 'intake': 'New intake',
  'assessment-ready': 'Assessment ready', 'assessment-running': 'Assessing', 'assessment-attention': 'Needs attention',
  'assessment-deck': 'Awaiting deck', 'assessment-run': 'Ready to run',
};

export function adaptQueue(actions = [], ctx = {}) {
  const { helpers } = ctx;
  return actions.map(a => {
    const program = helpers && helpers.getProgram ? helpers.getProgram(a.programId) : null;
    return {
      urgency: a.urgency === 'medium' ? 'med' : a.urgency,   // component groups by high|med|low
      rawUrgency: a.urgency,
      icon: Q_ICON[a.type] || 'radio_button_unchecked',
      typeLabel: Q_LABEL[a.type] || a.type,
      title: a.title, detail: a.detail, age: a.age,
      programName: program ? program.name : '',
      cta: a.cta,
      href: `program.html?id=${encodeURIComponent(a.programId)}&focus=${encodeURIComponent(a.type)}`,
      href2: `program.html?id=${encodeURIComponent(a.programId)}`,
    };
  });
}

// grouped { high, med, low } for queueBoardWS
export function groupQueue(items = []) {
  const g = { high: [], med: [], low: [] };
  items.forEach(it => { (g[it.urgency] || g.low).push(it); });
  return g;
}
