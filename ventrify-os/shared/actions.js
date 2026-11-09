// ============================================================
// Ventrify OS — Action model (SHARED · single source of truth)
//
// Pure ESM, DOM-free, handler-free — the id is the only join key. The M3 showcase
// (_redesign/m3/ds.js) AND the real Firebase workspace render from THIS file, so on a
// re-skin every placement / role / state rule follows the aesthetic automatically —
// the rules were never in the visuals. Mirrors the shared/vss-rubric.js pattern.
//
// TWO HALVES: this module carries the PRESENTATION half (where an action renders + its
// emphasis). The PERMISSION half is server-authoritative — TRANSITIONS below is the ONLY
// structure the API + Firestore rules must mirror, using the SAME ids. Presentation ≠
// permission: hiding a button is cosmetic; the server must re-enforce every role/state gate.
//
// Capabilities are passed IN (caps) — this module never imports the workspace plan.js.
// ============================================================

// Roles, ranked + extensible. "Submit = hand to the next rank up", so the chain
// generalises beyond two levels. The committee tier is wired only when an org enables it.
export const ROLES = {
  operator:        { rank: 1, label: 'Operator' },
  master_operator: { rank: 2, label: 'Master operator' },
  committee:       { rank: 3, label: 'Committee', capability: 'approvalChain' },
};

// Assessment lifecycle — each state reuses an EXISTING statusPill kind (no new atom).
export const LIFECYCLE = {
  draft:             { label: 'Draft',              pill: { kind: 'info', label: 'Draft', icon: 'edit_note' } },
  submitted:         { label: 'Awaiting approval',  pill: { kind: 'warn', label: 'Awaiting approval', icon: 'hourglass_top' } },
  changes_requested: { label: 'Changes requested',  pill: { kind: 'warn', label: 'Changes requested', icon: 'reply' } },
  approved:          { label: 'Approved',           pill: { kind: 'ok',   label: 'Approved', icon: 'verified' } },
  finalised:         { label: 'Finalised · locked', pill: { kind: 'ok',   label: 'Finalised', icon: 'lock' } },
  rejected:          { label: 'Passed',             pill: { kind: 'err',  label: 'Passed', icon: 'block' } },
};

// The AUTHORIZATION core — the ONLY thing the server (API + Firestore rules) must mirror.
// Two-step decision: Approve is the verdict; Finalise & lock freezes the memo (/m/<token>).
export const TRANSITIONS = {
  submit:          { from: ['draft', 'changes_requested'], to: 'submitted',         roles: ['operator', 'master_operator'], guard: 'verdictComplete' },
  approve:         { from: ['submitted'],                   to: 'approved',          roles: ['master_operator'] },
  request_changes: { from: ['submitted'],                   to: 'changes_requested', roles: ['master_operator'], requiresNote: true },
  reject:          { from: ['submitted'],                   to: 'rejected',          roles: ['master_operator'], requiresNote: true },
  recall:          { from: ['submitted'],                   to: 'draft',             roles: ['operator'] },
  finalise:        { from: ['approved'],                    to: 'finalised',         roles: ['master_operator'] },
  reopen:          { from: ['approved', 'rejected', 'finalised'], to: 'draft',        roles: ['master_operator'] },
};

// id → PRESENTATION. tier routes it to a shell surface: primary→masthead, aux→utility rail,
// overflow→rail kebab, contextual→inline (contextual actions are authored in the page, not here).
export const ACTIONS = {
  // primary — masthead (lifecycle state transitions)
  new_engagement:  { label: 'New engagement',   icon: 'add',      tier: 'primary', variant: 'filled',   capability: 'create' },
  submit:          { label: 'Submit for approval', icon: 'send',  tier: 'primary', variant: 'filled',   transition: 'submit' },
  resubmit:        { label: 'Revise & resubmit', icon: 'send',    tier: 'primary', variant: 'filled',   transition: 'submit' },
  approve:         { label: 'Approve',          icon: 'check',    tier: 'primary', variant: 'filled',   transition: 'approve' },
  reject:          { label: 'Reject',           icon: 'block',    tier: 'primary', variant: 'outlined', transition: 'reject' },
  request_changes: { label: 'Request changes',  icon: 'reply',    tier: 'primary', variant: 'text',     transition: 'request_changes' },
  finalise:        { label: 'Finalise & lock',  icon: 'lock',     tier: 'primary', variant: 'filled',   transition: 'finalise' },
  reopen:          { label: 'Reopen',           icon: 'lock_open',tier: 'primary', variant: 'outlined', transition: 'reopen' },
  // auxiliary — utility rail (open the aux panel). meta:true = pinned to the rail's foot.
  //
  // ── REMOVED 2026-11-09: discuss, activity, research_peek, view_settings, help ──────────────────────
  // All five were declared here and bound NOWHERE. ds.js falls back to railPanel() for an unbound tool,
  // whose entire body is "The <X> tool opens here as a side panel" plus four grey skeleton lines — so
  // each one read as a feature mid-load rather than a feature that does not exist. Five of the ten tools
  // on the assessment rail were that panel.
  //
  // research_peek was the worst of them: a stub of the research room, which SHIPS and works, as its own
  // tab with a drill page per document. A placeholder competing with a finished feature.
  //
  // They were invisible to the only gate that looked: share-upsell.mjs joins the rail against the
  // handler map for ids carrying a `capability`, and not one of these five carried one. tools/
  // rail-bound.mjs now exempts nothing — it CLICKS every tool on every page and fails on a placeholder.
  //
  // Re-adding any of them means authoring real content (window.RAIL_PANELS[panel]) or a real handler
  // (window.RAIL_ACTIONS[tool]) in the same change. The gate will refuse the button on its own.
  sources:       { label: 'Sources',       icon: 'source',       tier: 'aux', panel: 'sources' },
  assist:        { label: 'Assist',        icon: 'auto_awesome', tier: 'aux', panel: 'assist', capability: 'assist' },
  export:        { label: 'Export',        icon: 'download',     tier: 'aux', panel: 'export', capability: 'export' },
  deal_memo:     { label: 'Deal memo',     icon: 'download',     tier: 'aux', panel: 'deal_memo', capability: 'export' },
  // PROMOTED TO THE MASTHEAD 2026-11-09, on the operator's call. It used to be a rail tool on the
  // reasoning that a full assessment's masthead belongs to the lifecycle (submit / confirm / decline)
  // while the pre-screen's document is finished the instant the run ends. True, but it left ONE product
  // answering the same question two ways: the same act of sharing was a primary button on a pre-screen
  // and a buried icon on the thing that costs ninety minutes.
  //
  // It renders as `text`, not `filled`, and only once a verdict exists — so the lifecycle pair keeps the
  // masthead's single filled button (the conformance gate allows exactly one) and share never offers to
  // publish a memo that has not been written yet.
  share:         { label: 'Share',         icon: 'ios_share',    tier: 'primary', variant: 'text', panel: 'share', capability: 'share' },
  // The pre-screen's share. A SEPARATE action rather than a mode of `share`, because the two publish
  // different documents and are gated by different capabilities — entitlements makes them mutually
  // exclusive, so exactly one of them is offered whatever the tier.
  //
  // IT IS A MASTHEAD ACTION, AND THE MEMO'S SHARE IS NOT. The surfaces differ because the pages do.
  // On a FULL assessment the masthead belongs to the lifecycle — submit, approve, finalise — and the
  // memo's share waits in the rail for a verdict that does not exist yet. On a PRE-SCREEN there is no
  // lifecycle and the document is already finished the moment the run ends, so sharing it is one of
  // the two things an operator does next. The other is `advance_founder`.
  share_prescreen: { label: 'Share',       icon: 'ios_share',    tier: 'primary', variant: 'outlined', panel: 'share_prescreen', capability: 'sharePrescreen' },
  // Tell the founder they are through, and ask for what would make the full read worth two hours.
  // AUXILIARY, not primary: it leaves the building, it is addressed to someone who is not in the room,
  // and it is the rarer of the two exits. A rail tool is the right weight for it — the masthead is for
  // what the operator does with the venture, not what they send about it.
  advance_founder: { label: 'Email the founder', icon: 'outgoing_mail', tier: 'aux', panel: 'advance', capability: 'advanceFounder' },
  // overflow — rail kebab (rare / restricted / destructive)
  recall:   { label: 'Recall submission', icon: 'undo',    tier: 'overflow', transition: 'recall' },
  reassign: { label: 'Reassign operator', icon: 'group',   tier: 'overflow' },
  archive:  { label: 'Archive',           icon: 'archive', tier: 'overflow', confirm: true },
  delete:   { label: 'Delete',            icon: 'delete',  tier: 'overflow', destructive: true, confirm: true },
};

// Per-page placement. primaryByState[state][role] → the workflow primary (a single id, or an
// array = a DECISION PAIR resolved in one masthead slot). '*'-style pages use a static `primary`.
export const ACTION_MODEL = {
  // portfolio/queue rails are now EMPTY, and pageShell renders no rail for an empty array. The live
  // pages (dashboard-m3, queue-m3) never rendered one anyway — only the _redesign/m3 specimens resolve
  // these entries, so they now match the product instead of showing three placeholders it does not have.
  portfolio: { primary: 'new_engagement', rail: [], overflow: [] },
  queue:     { primary: null,             rail: [], overflow: [] },
  assess: {
    primaryByState: {
      draft:             { operator: 'submit',   master_operator: 'submit' },
      changes_requested: { operator: 'resubmit', master_operator: 'resubmit' },
      submitted:         { operator: null,       master_operator: ['approve', 'reject', 'request_changes'] },
      approved:          { operator: null,       master_operator: 'finalise' },
      finalised:         { operator: null,       master_operator: null },
      rejected:          { operator: 'reopen',   master_operator: 'reopen' },
    },
    rail:     ['sources', 'assist', 'deal_memo', 'advance_founder'],
    overflow: ['recall', 'reassign', 'archive', 'delete'],
  },
  research:  { primary: null, rail: ['assist', 'export'], overflow: [] },
};

const expand = id => ({ id, ...(ACTIONS[id] || { label: id, icon: 'help_outline' }) });

// can() — does the (role, state) permit this transition? Keeps placement honest against
// the authorization core so the UI can NEVER offer an action the server would reject.
export function can(actionId, { role, state } = {}) {
  const t = (ACTIONS[actionId] || {}).transition;
  if (!t) return true;                       // non-transition actions (aux/export/share) aren't state-gated
  const tr = TRANSITIONS[t];
  return !!(tr && tr.roles.includes(role) && (state == null || tr.from.includes(state)));
}

// resolveActions — the pure resolver BOTH codebases call.
//   { page, role='operator', state, caps } → { primary, decision, rail, overflow, state, pill }
export function resolveActions({ page, role = 'operator', state, caps = {} } = {}) {
  const m = ACTION_MODEL[page] || { rail: [], overflow: [] };
  let primary = null, decision = [];
  if (m.primaryByState) {
    const p = state ? (m.primaryByState[state] || {})[role] : null;
    if (Array.isArray(p)) { decision = p.map(expand); primary = decision[0] || null; }
    else if (p) primary = expand(p);
  } else if (m.primary) {
    primary = expand(m.primary);
  }
  // capability + authorization gate.
  // APPLIED TO THE RAIL TOO. It used to gate only the masthead, so a capability was
  // honoured in one surface and ignored in the other — which is exactly how the paid-only
  // actions (assist / deal_memo / share / export) would have leaked onto a pre-screened
  // engagement. shared/entitlements.js supplies those keys via capsFor().
  const gate = a => a && (!a.capability || caps[a.capability] !== false) && can(a.id, { role, state });
  if (!gate(primary)) primary = null;
  decision = decision.filter(gate);
  const lc = state ? LIFECYCLE[state] : null;
  return {
    primary,
    decision,                                // [] unless a decision-pair (Approve/Reject/…)
    rail: (m.rail || []).map(expand).filter(gate),
    overflow: (m.overflow || []).map(expand).filter(gate),
    state: state || null,
    pill: lc ? lc.pill : null,
  };
}

// convenience: the assess masthead primary as a pure function of (state, role)
export function primaryAction(state, role = 'operator') {
  const r = resolveActions({ page: 'assess', role, state });
  return r.decision.length ? r.decision : (r.primary ? [r.primary] : []);
}
