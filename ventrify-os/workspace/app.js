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
function buildWorkspace({ org, operators, programs, actions, currentOperatorId, demoMode, mode, isSuperAdmin }) {
  function getProgram(id) { return programs.find(p => p.id === id) || null; }
  function getOperator(id) { return operators.find(o => o.id === id) || null; }
  function currentOperator() { return getOperator(currentOperatorId); }
  function programsForOperator(opId) { return programs.filter(p => p.assignedOperator === opId); }

  window.WORKSPACE = {
    org, operators, programs, actions, currentOperatorId, demoMode, mode, isSuperAdmin: !!isSuperAdmin,
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
  const email = (user.email || '').toLowerCase();

  // Multi-tenant: resolve the operator's org (the org whose operatorEmails lists
  // their email). Each operator works only in their own org.
  const myOrg = await data.findOperatorOrg(email);
  const superAdmin = await data.isSuperAdmin(email);
  if (!myOrg) {
    // Signed in but not an operator of any org. (Super-admins with no org of
    // their own get the platform console — added in the next stage.)
    renderNoAccess(user);
    return new Promise(() => {});
  }
  data.setOrgContext(myOrg.id);
  const org = myOrg;

  // A signed-in but non-operator (got a magic link, but not on the operator
  // allowlist) is denied engagements by the security rules. Catch that and show
  // a clean "no access" screen instead of crashing to a blank page.
  let programs;
  try {
    programs = await data.listEngagements();
  } catch (e) {
    if (e && (e.code === 'permission-denied' || /permission|insufficient/i.test(String((e && e.message) || e)))) {
      renderNoAccess(user);
      return new Promise(() => {}); // halt — the no-access screen is shown
    }
    throw e;
  }

  // The team = every email in org.operatorEmails; the signed-in user is flagged.
  const brand = (org && org.primaryColor) || '#0036FF';
  const mkOp = (em) => {
    const e = String(em).toLowerCase();
    const me = e === email;
    const display = (me && user.displayName) ? user.displayName : e.split('@')[0].replace(/[._-]+/g, ' ');
    const name = display.replace(/\b\w/g, c => c.toUpperCase());
    return { id: me ? user.uid : e, name, email: e, role: 'Operator', avatar: initialsOf(name), avatarColor: brand, isCurrentUser: me };
  };
  let operators = (org.operatorEmails || []).map(mkOp);
  if (!operators.some(o => o.isCurrentUser)) operators.unshift(mkOp(email));

  applyBranding(org);
  return buildWorkspace({
    org, operators, programs, actions: [],
    currentOperatorId: user.uid, demoMode: 'off', mode: 'live', isSuperAdmin: superAdmin
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
  'team.html': 'team', 'settings.html': 'settings', 'admin.html': 'admin', '': 'dashboard'
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
      <button class="topbar-menu-btn" aria-label="Toggle navigation" aria-expanded="false" aria-controls="app-sidebar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
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
    <aside class="sidebar" id="app-sidebar">
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
      ${(W.isSuperAdmin || (W.org && W.helpers.currentOperator() && String(W.org.ownerEmail || '').toLowerCase() === String((W.helpers.currentOperator() || {}).email || '').toLowerCase())) ? `
        <a href="admin.html" class="sidebar-link ${active === 'admin' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x2699;</span><span>${W.isSuperAdmin ? 'Platform admin' : 'Operators'}</span>
        </a>` : ''}
    </aside>`;
}

function renderDevToggle() {
  const W = window.WORKSPACE;
  // Production (live): no floating dev chrome — identity + sign-out live in the topbar.
  if (W.mode === 'live') return '';
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

function renderNoAccess(user) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#eef1ff;">
      <div style="max-width:440px;width:100%;text-align:center;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:2.5rem 2rem;box-shadow:0 10px 40px rgba(0,54,255,0.06);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:#0036FF;margin-bottom:0.85rem;">Ventrify OS &middot; Workspace</div>
        <h1 style="font-size:1.45rem;letter-spacing:-0.02em;margin:0 0 0.75rem;color:#141414;">No Workspace access yet</h1>
        <p style="font-size:0.95rem;line-height:1.65;color:#656565;margin:0 0 1.6rem;">You're signed in as <strong style="color:#141414;">${(user && user.email) || 'this account'}</strong>, but it isn't set up as an operator on this Workspace. Ask your Ventrify admin to add you, then sign in again.</p>
        <a href="#" onclick="event.preventDefault(); window.__signOut && window.__signOut();" style="display:inline-block;background:#0036FF;color:#fff;text-decoration:none;font-weight:600;font-size:0.92rem;padding:0.72rem 1.5rem;border-radius:10px;">Sign out</a>
      </div>
    </div>`;
}

window.renderShell = function(mainContentHTML) {
  document.body.innerHTML = renderTopbar() + `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        <div class="main-inner">${mainContentHTML}</div>
      </main>
    </div>
    <div class="nav-scrim" aria-hidden="true"></div>
    ${renderDevToggle()}`;
};

// Mobile nav drawer — delegated listeners survive renderShell()'s innerHTML reset.
(function setupMobileNav() {
  if (window.__navWired) return; window.__navWired = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.topbar-menu-btn');
    if (btn) { const open = document.body.classList.toggle('nav-open'); btn.setAttribute('aria-expanded', String(open)); return; }
    if (e.target.closest('.nav-scrim') || e.target.closest('.sidebar-link')) document.body.classList.remove('nav-open');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) document.body.classList.remove('nav-open'); });
})();

// ----- Tiny shared display helpers ----------------------------------------
window.hubStatusClass = function(status) { return status || 'pending'; };
window.fmtDate = function(s) { return s; };
window.healthClass = function(h) {
  return ({ 'on-track': 'health-on-track', 'attention': 'health-attention', 'stuck': 'health-stuck' })[h] || 'pill';
};
window.healthLabel = function(h) {
  return ({ 'on-track': 'On track', 'attention': 'Needs attention', 'stuck': 'Stuck' })[h] || h;
};
