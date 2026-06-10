// ============================================================
// Ventrify OS — Operator Workspace · Shell + state bootstrap (async)
//
// Data source precedence:
//   • FIREBASE_ENABLED + signed in  → LIVE (Firestore via firebase/data.js)
//   • FIREBASE_ENABLED + signed out → redirect to the operator login
//   • FIREBASE off                  → demo/localStorage (the old behaviour)
//
// Because live data is async, this module is loaded as type="module" and
// exposes `window.WORKSPACE_READY` (a promise). Every page does
// `await window.WORKSPACE_READY` before reading `window.WORKSPACE`.
// ============================================================

import { FIREBASE_ENABLED } from '../firebase/config.js';

const FB_AUTH_URL = 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

// ----- Static label maps + helpers (available immediately) ----------------
const PHASE_LABELS = {
  0: 'Phase 0 · Intake', 1: 'Phase 1 · Discover', 2: 'Phase 2 · Define',
  2.5: 'Phase 2.5 · Financials', 3: 'Phase 3 · Design', 4: 'Phase 4 · Develop',
  4.5: 'Phase 4B · Beta', 5: 'Phase 5 · Deliver'
};
const HUB_LABELS = {
  research: 'Research Hub', vision: 'Vision Hub', strategy: 'Strategy Hub',
  financials: 'Financials Hub', marketing: 'Marketing Hub', video: 'Video Hub', blog: 'Blog Hub'
};
function phaseLabel(p) { return PHASE_LABELS[p] || `Phase ${p}`; }
function phaseProgressPct(p) { return Math.min(100, Math.round((p / 5) * 100)); }
function hubStatusLabel(s) {
  return ({ 'pending': 'Pending', 'in-progress': 'In progress', 'awaiting-founder': 'Awaiting founder',
    'ready-to-sign': 'Ready to sign', 'signed': 'Signed off' })[s] || s;
}
function initialsOf(s) {
  const parts = (s || '').trim().split(/\s+/);
  const a = (parts[0] || '?')[0] || '?';
  const b = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
  return (a + b).toUpperCase().slice(0, 2);
}

// ----- localStorage IO (still used for demo mode + small prefs) -----------
function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function getDemoMode() { return localStorage.getItem('workspace.demoMode') || 'on'; }
function setDemoMode(mode) { localStorage.setItem('workspace.demoMode', mode); }

const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';

// ----- Org branding (CSS var override) ------------------------------------
function applyBranding(org) {
  if (!org || !org.primaryColor) return;
  if (document.getElementById('org-brand-vars')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'org-brand-vars';
  styleEl.textContent = `:root { --brand-primary: ${org.primaryColor}; --primary: ${org.primaryColor}; }`;
  document.head.appendChild(styleEl);
}

// ----- Assemble window.WORKSPACE ------------------------------------------
function buildWorkspace({ org, operators, programs, actions, currentOperatorId, demoMode, mode }) {
  function getProgram(id) { return programs.find(p => p.id === id) || null; }
  function getOperator(id) { return operators.find(o => o.id === id) || null; }
  function currentOperator() { return getOperator(currentOperatorId); }
  function programsForOperator(opId) { return programs.filter(p => p.assignedOperator === opId); }

  window.WORKSPACE = {
    org, operators, programs, actions, currentOperatorId, demoMode, mode,
    helpers: { getProgram, getOperator, currentOperator, programsForOperator, phaseLabel, phaseProgressPct, hubStatusLabel },
    labels: { phase: PHASE_LABELS, hub: HUB_LABELS },
    storage: { readJSON, writeJSON, setDemoMode }
  };
  return window.WORKSPACE;
}

// ----- LIVE (Firestore) path ----------------------------------------------
async function awaitCurrentUser() {
  const { auth } = await import('../firebase/firebase.js');
  const { onAuthStateChanged } = await import(FB_AUTH_URL);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

async function loadLive(user) {
  const data = await import('../firebase/data.js');

  // Org: load, or seed once (migrating the localStorage org if present).
  let org = await data.getOrganisation();
  if (!org) {
    const stored = readJSON('workspace.organisation', null);
    const seed = stored || { name: 'My Workspace', slug: 'default', primaryColor: '#0036FF' };
    await data.saveOrganisation(seed);
    org = await data.getOrganisation();
  }

  const programs = await data.listEngagements();

  // Operator identity = the signed-in user (single-operator for now).
  const operator = {
    id: user.uid,
    name: user.displayName || (user.email || 'Operator').split('@')[0],
    email: user.email || '',
    role: 'Program Lead',
    avatar: initialsOf(user.displayName || user.email || 'OP'),
    avatarColor: (org && org.primaryColor) || '#0036FF'
  };

  applyBranding(org);
  return buildWorkspace({
    org, operators: [operator], programs, actions: [],
    currentOperatorId: user.uid, demoMode: 'off', mode: 'live'
  });
}

// ----- DEMO / localStorage path (unchanged behaviour) ---------------------
function loadDemoOrLocal() {
  const sample = window.WORKSPACE_SAMPLE || null;
  const demoOn = getDemoMode() === 'on' && !!sample;

  const storedOrg       = readJSON('workspace.organisation', null);
  const storedOperators = readJSON('workspace.operators', []);
  const storedPrograms  = readJSON('workspace.programs', []);
  const storedActions   = readJSON('workspace.actions', []);
  const storedCurrentOp = localStorage.getItem('workspace.currentOperator') || null;

  const org        = storedOrg || (demoOn ? sample.org : null);
  const operators  = demoOn ? [...storedOperators, ...sample.operators] : storedOperators;
  const programs   = demoOn ? [...storedPrograms,  ...sample.programs]  : storedPrograms;
  const actions    = demoOn ? [...storedActions,   ...sample.actions]   : storedActions;
  const currentOperatorId = storedCurrentOp || (demoOn ? sample.currentOperatorId : null);

  // First-run redirect to setup when there's genuinely nothing yet.
  if (!org && !demoOn && currentPath !== 'setup.html') {
    window.location.replace('setup.html');
    return new Promise(() => {}); // halt — navigating away
  }

  applyBranding(org);
  return buildWorkspace({
    org, operators, programs, actions, currentOperatorId,
    demoMode: demoOn ? 'on' : 'off', mode: demoOn ? 'demo' : 'local'
  });
}

// ----- Bootstrap ----------------------------------------------------------
async function bootstrap() {
  if (FIREBASE_ENABLED) {
    const user = await awaitCurrentUser();
    if (!user) {
      // Real auth required — bounce to the operator login.
      if (currentPath !== '' && currentPath !== 'index.html') window.location.replace('/workspace/');
      return new Promise(() => {}); // halt — navigating away
    }
    return loadLive(user);
  }
  return loadDemoOrLocal();
}

window.WORKSPACE_READY = bootstrap();

// ============================================================
//  Shell rendering — reads window.WORKSPACE at call time (after READY)
// ============================================================
const activeMap = {
  'dashboard.html': 'dashboard', 'queue.html': 'queue', 'program.html': 'programs',
  'team.html': 'team', 'settings.html': 'settings', '': 'dashboard'
};
const active = activeMap[currentPath] || 'dashboard';

function renderTopbar() {
  const W = window.WORKSPACE;
  const org = W.org;
  const orgName = org ? org.name : 'Unconfigured workspace';
  const orgLogo = org && org.logoDataUrl ? org.logoDataUrl : (org && org.logoUrl) || null;
  const orgInitials = org ? initialsOf(org.name) : '?';
  const orgColor = (org && org.primaryColor) || '#0036FF';
  const opAvatar = W.helpers.currentOperator();
  const avatarBg = opAvatar ? opAvatar.avatarColor : '#999';
  const avatarTxt = opAvatar ? opAvatar.avatar : '?';

  const partnerHTML = org
    ? `<a href="dashboard.html" class="topbar-lockup-item topbar-lockup-partner" title="${orgName}">
        <span class="topbar-lockup-mark" style="background:${orgColor};">
          ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}">` : `<span class="topbar-lockup-mark-text">${orgInitials}</span>`}
        </span>
        <span class="topbar-lockup-name">${orgName}</span>
      </a>`
    : `<span class="topbar-lockup-item topbar-lockup-partner topbar-lockup-empty">
        <span class="topbar-lockup-mark topbar-lockup-mark-empty">?</span>
        <span class="topbar-lockup-name">Unconfigured</span>
      </span>`;

  return `
    <div class="topbar">
      <div class="topbar-lockup">
        <a href="dashboard.html" class="topbar-lockup-item topbar-lockup-os" title="Ventrify OS">
          <span class="topbar-lockup-mark topbar-lockup-mark-ventrify">V</span>
          <span class="topbar-lockup-name"><span class="lockup-name-strong">VENTRIFY</span> <span class="lockup-name-weak">OS</span></span>
        </a>
        <span class="topbar-lockup-divider" aria-hidden="true"></span>
        ${partnerHTML}
      </div>
      <div class="topbar-spacer"></div>
      <div class="topbar-utility">
        <a href="#" class="topbar-utility-link">Docs</a>
        <a href="#" class="topbar-utility-link">Help</a>
        <a href="#" class="topbar-utility-link" onclick="event.preventDefault(); window.__signOut();">Sign out</a>
        <div class="avatar topbar-avatar" style="background:${avatarBg};" title="${opAvatar ? opAvatar.name : 'No operator'}">${avatarTxt}</div>
      </div>
    </div>`;
}

window.__signOut = async function() {
  if (!window.confirm('Sign out of the Workspace? Your organisation and engagements stay saved — only this session ends.')) return;
  if (FIREBASE_ENABLED) {
    try { const { signOutUser } = await import('../firebase/auth.js'); await signOutUser(); } catch (e) {}
  }
  localStorage.removeItem('workspace.currentOperator');
  window.location.href = '/workspace/';
};

function queueBadgeCount() {
  const W = window.WORKSPACE;
  const A = window.WORKSPACE_AGENTS;
  if (W.mode === 'demo' || !A) return (W.actions || []).length;
  try { return A.computeActionQueue(W.programs, W.currentOperatorId).length; }
  catch (e) { return (W.actions || []).length; }
}

function renderSidebar() {
  const W = window.WORKSPACE;
  return `
    <aside class="sidebar">
      <div class="sidebar-section">Operate</div>
      <a href="dashboard.html" class="sidebar-link ${active === 'dashboard' ? 'active' : ''}">
        <span class="sidebar-link-icon">&#x25A4;</span><span>Portfolio</span>
        <span class="badge">${W.programs.length}</span>
      </a>
      <a href="queue.html" class="sidebar-link ${active === 'queue' ? 'active' : ''}">
        <span class="sidebar-link-icon">&#x25C6;</span><span>Action queue</span>
        <span class="badge">${queueBadgeCount()}</span>
      </a>
      <div class="sidebar-section">Manage</div>
      <a href="team.html" class="sidebar-link ${active === 'team' ? 'active' : ''}">
        <span class="sidebar-link-icon">&#x25CB;</span><span>Team</span>
        <span class="badge">${W.operators.length}</span>
      </a>
      <a href="settings.html" class="sidebar-link ${active === 'settings' ? 'active' : ''}">
        <span class="sidebar-link-icon">&#x25C7;</span><span>Settings</span>
      </a>
    </aside>`;
}

function renderDevToggle() {
  const W = window.WORKSPACE;
  if (W.mode === 'live') {
    // Live: no demo data; offer a quick session reset instead.
    const who = (W.helpers.currentOperator() || {}).email || 'signed in';
    return `
      <div class="dev-toggle" role="region" aria-label="Session">
        <span class="dev-toggle-label">Live · ${who}</span>
        <button class="dev-toggle-reset" onclick="window.__signOut()" title="Sign out of this session">Sign out</button>
      </div>`;
  }
  const isOn = W.demoMode === 'on';
  const sampleAvailable = !!window.WORKSPACE_SAMPLE;
  return `
    <div class="dev-toggle" role="region" aria-label="Prototype dev tools">
      <div class="dev-toggle-label">Demo data</div>
      <button class="dev-toggle-switch ${isOn ? 'on' : 'off'}" ${sampleAvailable ? '' : 'disabled'}
              onclick="window.__toggleDemoMode()" aria-pressed="${isOn}">
        <span class="dev-toggle-knob"></span>
        <span class="dev-toggle-state">${isOn ? 'ON' : 'OFF'}</span>
      </button>
      <button class="dev-toggle-reset" onclick="window.__resetWorkspace()" title="Clear all workspace localStorage and reload">Reset</button>
    </div>`;
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

window.renderShell = function(mainContentHTML) {
  document.body.innerHTML = renderTopbar() + `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        <div class="main-inner">${mainContentHTML}</div>
      </main>
    </div>
    ${renderDevToggle()}`;
};

// ----- Tiny shared display helpers ----------------------------------------
window.hubStatusClass = function(status) { return status || 'pending'; };
window.fmtDate = function(s) { return s; };
window.healthClass = function(h) {
  return ({ 'on-track': 'health-on-track', 'attention': 'health-attention', 'stuck': 'health-stuck' })[h] || 'pill';
};
window.healthLabel = function(h) {
  return ({ 'on-track': 'On track', 'attention': 'Needs attention', 'stuck': 'Stuck' })[h] || h;
};
