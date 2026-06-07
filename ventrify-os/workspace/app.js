// ============================================================
// Ventrify OS — Operator Workspace · Shell + state bootstrap
//
// Responsibilities:
//   1. Build `window.WORKSPACE` from localStorage (real state) + optionally
//      merge in `window.WORKSPACE_SAMPLE` when demo mode is on.
//   2. Render the topbar + sidebar consistently across every page via
//      `window.renderShell(mainHTML)`.
//   3. Expose tiny helper getters used by all pages (health pill, etc.).
//   4. Surface a floating dev toggle so we can flip demo data on/off.
//
// Storage keys (all under `workspace.*`):
//   workspace.demoMode        'on' | 'off'   (default: 'on' until the
//                                            first-run setup ships)
//   workspace.organisation    { name, primaryColor, logoDataUrl, ... }
//   workspace.operators       Operator[]
//   workspace.currentOperator operatorId
//   workspace.programs        Engagement[]
//   workspace.actions         ActionQueueItem[]
// ============================================================

(function() {
  if (typeof window === 'undefined') return;

  // ----- Helpers always available, even with no data ----------------------
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
  function phaseLabel(p) { return PHASE_LABELS[p] || `Phase ${p}`; }
  function phaseProgressPct(p) { return Math.min(100, Math.round((p / 5) * 100)); }
  function hubStatusLabel(s) {
    return ({
      'pending': 'Pending',
      'in-progress': 'In progress',
      'awaiting-founder': 'Awaiting founder',
      'ready-to-sign': 'Ready to sign',
      'signed': 'Signed off'
    })[s] || s;
  }

  // ----- localStorage IO --------------------------------------------------
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* quota / SSR — ignore */ }
  }

  // Demo mode default: 'on' until the first-run setup screen lands in step 2.
  // After that we'll switch the default to 'off'.
  function getDemoMode() {
    return localStorage.getItem('workspace.demoMode') || 'on';
  }
  function setDemoMode(mode) {
    localStorage.setItem('workspace.demoMode', mode);
  }

  // ----- Build window.WORKSPACE ------------------------------------------
  const sample = window.WORKSPACE_SAMPLE || null;
  const demoOn = getDemoMode() === 'on' && sample;

  // Real (persisted) state
  const storedOrg       = readJSON('workspace.organisation', null);
  const storedOperators = readJSON('workspace.operators', []);
  const storedPrograms  = readJSON('workspace.programs', []);
  const storedActions   = readJSON('workspace.actions', []);
  const storedCurrentOp = localStorage.getItem('workspace.currentOperator') || null;

  // Compose
  const org        = storedOrg        || (demoOn ? sample.org        : null);
  const operators  = demoOn ? [...storedOperators, ...sample.operators] : storedOperators;
  const programs   = demoOn ? [...storedPrograms,  ...sample.programs]  : storedPrograms;
  const actions    = demoOn ? [...storedActions,   ...sample.actions]   : storedActions;
  const currentOperatorId = storedCurrentOp || (demoOn ? sample.currentOperatorId : null);

  // Helpers bound to the composed collections
  function getProgram(id)  { return programs.find(p => p.id === id) || null; }
  function getOperator(id) { return operators.find(o => o.id === id) || null; }
  function currentOperator() { return getOperator(currentOperatorId); }
  function programsForOperator(opId) { return programs.filter(p => p.assignedOperator === opId); }

  window.WORKSPACE = {
    org, operators, programs, actions, currentOperatorId,
    demoMode: demoOn ? 'on' : 'off',
    helpers: {
      getProgram, getOperator, currentOperator, programsForOperator,
      phaseLabel, phaseProgressPct, hubStatusLabel
    },
    labels: { phase: PHASE_LABELS, hub: HUB_LABELS },
    storage: { readJSON, writeJSON, setDemoMode }
  };

  // ----- First-run redirect ----------------------------------------------
  // If demo is off AND no org is set up yet, send the operator to setup
  // (but skip the redirect when we're already on setup.html itself).
  const _path = window.location.pathname.split('/').pop() || 'dashboard.html';
  if (!org && !demoOn && _path !== 'setup.html') {
    window.location.replace('setup.html');
    return; // halt — the rest of the bootstrap is irrelevant for this load
  }

  // ----- Apply org branding (CSS var override + favicon-style accents) ---
  if (org && org.primaryColor) {
    const styleEl = document.createElement('style');
    styleEl.id = 'org-brand-vars';
    styleEl.textContent = `
      :root {
        --brand-primary: ${org.primaryColor};
        --primary: ${org.primaryColor};
      }
    `;
    document.head.appendChild(styleEl);
  }

  // ----- Topbar + Sidebar -------------------------------------------------
  const path = _path;
  const activeMap = {
    'dashboard.html': 'dashboard',
    'queue.html':     'queue',
    'program.html':   'programs',
    'team.html':      'team',
    'settings.html':  'settings',
    '':               'dashboard'
  };
  const active = activeMap[path] || 'dashboard';

  function initialsOf(s) {
    const parts = (s || '').trim().split(/\s+/);
    const a = (parts[0] || '?')[0] || '?';
    const b = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
    return (a + b).toUpperCase().slice(0, 2);
  }

  function renderTopbar() {
    const orgName = org ? org.name : 'Unconfigured workspace';
    const orgTier = org && org.tier ? org.tier : '—';
    const orgLogo = org && org.logoDataUrl ? org.logoDataUrl : null;
    const orgInitials = org ? initialsOf(org.name) : '?';
    const opAvatar = currentOperator();
    const avatarBg = opAvatar ? opAvatar.avatarColor : '#999';
    const avatarTxt = opAvatar ? opAvatar.avatar : '?';

    const brandHTML = org
      ? `
        <a href="dashboard.html" class="topbar-logo topbar-logo-branded">
          <span class="topbar-logo-mark" style="background:${org.primaryColor || '#0036FF'};">
            ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}">` : `<span class="topbar-logo-mark-text">${orgInitials}</span>`}
          </span>
          <span class="topbar-logo-name">${orgName}</span>
          <span class="tag">Workspace</span>
        </a>`
      : `
        <a href="dashboard.html" class="topbar-logo">
          VENTRIFY <span class="os">OS</span>
          <span class="tag">Workspace</span>
        </a>`;

    return `
      <div class="topbar">
        ${brandHTML}
        <div class="topbar-org">
          <span class="topbar-org-name">${org ? `Tier ${orgTier}` : orgName}</span>
          <span class="topbar-org-tier">${org ? 'Powered by Ventrify OS' : '—'}</span>
        </div>
        <div class="topbar-spacer"></div>
        <div class="topbar-utility">
          <a href="../index.html" class="topbar-utility-link">OS site</a>
          <a href="../pricing.html" class="topbar-utility-link">Pricing</a>
          <a href="#" class="topbar-utility-link">Docs</a>
          <a href="#" class="topbar-utility-link">Help</a>
          <div class="topbar-divider"></div>
          <div class="avatar topbar-avatar" style="background:${avatarBg};">${avatarTxt}</div>
        </div>
      </div>
    `;
  }

  function renderSidebar() {
    return `
      <aside class="sidebar">
        <div class="sidebar-section">Operate</div>
        <a href="dashboard.html" class="sidebar-link ${active === 'dashboard' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25A4;</span>
          <span>Portfolio</span>
          <span class="badge">${programs.length}</span>
        </a>
        <a href="queue.html" class="sidebar-link ${active === 'queue' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25C6;</span>
          <span>Action queue</span>
          <span class="badge">${actions.length}</span>
        </a>

        <div class="sidebar-section">Manage</div>
        <a href="team.html" class="sidebar-link ${active === 'team' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25CB;</span>
          <span>Team</span>
          <span class="badge">${operators.length}</span>
        </a>
        <a href="settings.html" class="sidebar-link ${active === 'settings' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25C7;</span>
          <span>Settings</span>
        </a>
      </aside>
    `;
  }

  function renderDevToggle() {
    const isOn = window.WORKSPACE.demoMode === 'on';
    const sampleAvailable = !!sample;
    const disabled = !sampleAvailable ? 'disabled' : '';
    return `
      <div class="dev-toggle" role="region" aria-label="Prototype dev tools">
        <div class="dev-toggle-label">Demo data</div>
        <button class="dev-toggle-switch ${isOn ? 'on' : 'off'}" ${disabled}
                onclick="window.__toggleDemoMode()" aria-pressed="${isOn}">
          <span class="dev-toggle-knob"></span>
          <span class="dev-toggle-state">${isOn ? 'ON' : 'OFF'}</span>
        </button>
        <button class="dev-toggle-reset" onclick="window.__resetWorkspace()"
                title="Clear all workspace localStorage and reload">Reset</button>
      </div>
    `;
  }

  window.__toggleDemoMode = function() {
    const next = window.WORKSPACE.demoMode === 'on' ? 'off' : 'on';
    setDemoMode(next);
    window.location.reload();
  };
  window.__resetWorkspace = function() {
    if (!window.confirm('Clear all workspace data (org, programs, operators, actions) and reload?')) return;
    ['workspace.organisation', 'workspace.operators', 'workspace.programs',
     'workspace.actions', 'workspace.currentOperator', 'workspace.demoMode'
    ].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  // Public renderer
  window.renderShell = function(mainContentHTML) {
    document.body.innerHTML = renderTopbar() + `
      <div class="app-shell">
        ${renderSidebar()}
        <main class="main">
          <div class="main-inner">
            ${mainContentHTML}
          </div>
        </main>
      </div>
      ${renderDevToggle()}
    `;
  };

  // ----- Tiny shared display helpers --------------------------------------
  window.hubStatusClass = function(status) { return status || 'pending'; };
  window.fmtDate = function(s) { return s; };
  window.healthClass = function(h) {
    return ({ 'on-track':'health-on-track', 'attention':'health-attention', 'stuck':'health-stuck' })[h] || 'pill';
  };
  window.healthLabel = function(h) {
    return ({ 'on-track':'On track', 'attention':'Needs attention', 'stuck':'Stuck' })[h] || h;
  };
})();
