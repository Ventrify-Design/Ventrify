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
import { renderAppShell, wireAppShell } from '../shared/shell.js';
import * as Plan from './plan.js';

// Org licence / capability model — available to every page once the module
// loads (pages read it after `await window.WORKSPACE_READY`).
window.VentrifyPlan = Plan;

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
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const ORG_SWITCH_CHEVRON = `<svg class="org-switch-caret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

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
function buildWorkspace({ org, orgs, operators, programs, actions, currentOperatorId, demoMode, mode, isSuperAdmin }) {
  function getProgram(id) { return programs.find(p => p.id === id) || null; }
  function getOperator(id) { return operators.find(o => o.id === id) || null; }
  function currentOperator() { return getOperator(currentOperatorId); }
  function programsForOperator(opId) { return programs.filter(p => p.assignedOperator === opId); }

  window.WORKSPACE = {
    org, orgs: orgs || (org ? [org] : []), operators, programs, actions, currentOperatorId, demoMode, mode, isSuperAdmin: !!isSuperAdmin,
    plan: Plan.resolvePlan(org),
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

  // Multi-tenant: an operator may belong to several orgs. Resolve them all (for
  // the workspace switcher) and pick the active one — the last one they chose
  // (workspace.activeOrg), else the first alphabetically.
  const myOrgs = await data.listOperatorOrgs(email);
  const superAdmin = await data.isSuperAdmin(email);
  if (!myOrgs.length) {
    // Signed in but not an operator of any org. (Super-admins with no org of
    // their own get the platform console — added in the next stage.)
    renderNoAccess(user);
    return new Promise(() => {});
  }
  const storedActive = localStorage.getItem('workspace.activeOrg');
  const org = myOrgs.find(o => o.id === storedActive) || myOrgs[0];
  data.setOrgContext(org.id);

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
    org, orgs: myOrgs, operators, programs, actions: [],
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

  let org          = storedOrg || (demoOn ? sample.org : null);
  // Demo-only: ?plan=one-off|assess|full|custom lets us preview licence gating
  // without editing any data. Harmless in demo mode; never runs live.
  const demoPlan = new URLSearchParams(window.location.search).get('plan');
  if (org && demoPlan) org = { ...org, plan: { preset: demoPlan } };
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

// Topbar config for the shared shell — Ventrify OS · Org partnership lockup,
// utility links + the operator avatar. (Markup lives in shared/shell.js.)
function shellTopbarConfig() {
  const W = window.WORKSPACE;
  const org = W.org;
  const orgName = org ? org.name : 'Unconfigured workspace';
  const orgLogo = org && org.logoDataUrl ? org.logoDataUrl : (org && org.logoUrl) || null;
  const orgInitials = org ? initialsOf(org.name) : '?';
  const orgColor = (org && org.primaryColor) || '#0036FF';
  const opAvatar = W.helpers.currentOperator();

  const osItem = {
    href: 'dashboard.html', title: 'Ventrify OS', itemCls: 'topbar-lockup-os',
    mark: { html: 'V', cls: 'topbar-lockup-mark-ventrify' },
    name: { html: '<span class="lockup-name-strong">VENTRIFY</span> <span class="lockup-name-weak">OS</span>' },
  };
  // When the operator belongs to >1 org, the partner lockup becomes a workspace
  // switcher: drop the href (so it's a non-navigating <span> the delegated
  // listener handles) and add a caret. One org → the original dashboard link.
  const multiOrg = ((W.orgs || []).length) > 1;
  const orgMark = { bg: orgColor, html: orgLogo ? `<img src="${orgLogo}" alt="${escHtml(orgName)}">` : `<span class="topbar-lockup-mark-text">${orgInitials}</span>` };
  const partnerItem = org
    ? (multiOrg
        ? { title: 'Switch workspace', itemCls: 'topbar-lockup-partner topbar-lockup-switch',
            mark: orgMark, name: { html: escHtml(orgName) + ORG_SWITCH_CHEVRON } }
        : { href: 'dashboard.html', title: orgName, itemCls: 'topbar-lockup-partner',
            mark: orgMark, name: { text: orgName } })
    : { itemCls: 'topbar-lockup-partner topbar-lockup-empty',
        mark: { html: '?', cls: 'topbar-lockup-mark-empty' },
        name: { text: 'Unconfigured' } };

  return {
    lockup: [osItem, partnerItem],
    utility: [
      { label: 'Docs', href: '#' },
      { label: 'Help', href: '#' },
      { label: 'Sign out', href: '#', onclick: 'event.preventDefault(); window.__signOut();' },
    ],
    avatar: { initials: opAvatar ? opAvatar.avatar : '?', bg: opAvatar ? opAvatar.avatarColor : '#999', title: opAvatar ? opAvatar.name : 'No operator' },
  };
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

// Left side-nav config for the shared shell — Operate + Manage sections.
function shellNavConfig() {
  const W = window.WORKSPACE;
  const showAdmin = W.isSuperAdmin || (W.org && W.helpers.currentOperator() && String(W.org.ownerEmail || '').toLowerCase() === String((W.helpers.currentOperator() || {}).email || '').toLowerCase());
  const manage = [
    { href: 'team.html', icon: '&#x25CB;', label: 'Team', badge: W.operators.length, active: active === 'team' },
    { href: 'settings.html', icon: '&#x25C7;', label: 'Settings', active: active === 'settings' },
  ];
  if (showAdmin) manage.push({ href: 'admin.html', icon: '&#x2699;', label: W.isSuperAdmin ? 'Platform admin' : 'Operators', active: active === 'admin' });
  return [
    { section: 'Operate', links: [
      { href: 'dashboard.html', icon: '&#x25A4;', label: 'Portfolio', badge: W.programs.length, active: active === 'dashboard' },
      { href: 'queue.html', icon: '&#x25C6;', label: 'Action queue', badge: queueBadgeCount(), active: active === 'queue' },
    ]},
    { section: 'Manage', links: manage },
  ];
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
  document.body.innerHTML = renderAppShell({
    ...shellTopbarConfig(),
    nav: shellNavConfig(),
    main: mainContentHTML,
    after: renderDevToggle(),
  });
  mountOrgSwitcher();
};

// ----- Workspace switcher (multi-org operators) ---------------------------
// Rebuilt after every renderShell (which resets body.innerHTML). Renders only
// when the operator belongs to >1 org. Workspace-only — the shared shell/Studio
// are untouched.
window.__switchOrg = function(orgId) {
  try { localStorage.setItem('workspace.activeOrg', orgId); } catch (e) {}
  // Land on the new org's portfolio (the current page may reference an
  // engagement that doesn't exist in the org being switched to).
  window.location.href = 'dashboard.html';
};
function mountOrgSwitcher() {
  const W = window.WORKSPACE;
  const existing = document.getElementById('org-switch-panel');
  if (existing) existing.remove();
  const orgs = (W && W.orgs) || [];
  if (orgs.length <= 1) return;
  const activeId = W.org && W.org.id;
  const items = orgs.map(o => {
    const isActive = o.id === activeId;
    const color = o.primaryColor || '#0036FF';
    const logo = o.logoDataUrl || o.logoUrl || null;
    const mark = logo ? `<img src="${escHtml(logo)}" alt="">` : escHtml(initialsOf(o.name));
    return `<button type="button" class="org-switch-item${isActive ? ' active' : ''}" role="menuitem" onclick="window.__switchOrg('${escHtml(o.id)}')"${isActive ? ' aria-current="true"' : ''}>
        <span class="org-switch-mark" style="background:${escHtml(color)};">${mark}</span>
        <span class="org-switch-name">${escHtml(o.name)}</span>
        ${isActive ? '<span class="org-switch-check" aria-hidden="true">&#10003;</span>' : ''}
      </button>`;
  }).join('');
  const panel = document.createElement('div');
  panel.id = 'org-switch-panel';
  panel.className = 'org-switch-panel';
  panel.setAttribute('hidden', '');
  panel.setAttribute('role', 'menu');
  panel.innerHTML = `<div class="org-switch-head">Switch workspace</div>${items}`;
  document.body.appendChild(panel);
}
function wireOrgSwitcher() {
  if (window.__orgSwitchWired) return;
  window.__orgSwitchWired = true;
  const close = () => {
    const panel = document.getElementById('org-switch-panel');
    if (panel) panel.setAttribute('hidden', '');
    document.querySelectorAll('.topbar-lockup-switch.open').forEach(t => t.classList.remove('open'));
  };
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.topbar-lockup-switch');
    const panel = document.getElementById('org-switch-panel');
    if (trigger && panel) {
      e.preventDefault();
      if (panel.hasAttribute('hidden')) {
        const r = trigger.getBoundingClientRect();
        panel.style.top = (r.bottom + 8) + 'px';
        panel.style.left = r.left + 'px';
        panel.removeAttribute('hidden');
        trigger.classList.add('open');
      } else { close(); }
      return;
    }
    if (panel && !panel.hasAttribute('hidden') && !e.target.closest('#org-switch-panel')) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// Mobile nav drawer — delegated listeners survive renderShell()'s innerHTML reset.
wireAppShell();
wireOrgSwitcher();

// ----- Tiny shared display helpers ----------------------------------------
window.hubStatusClass = function(status) { return status || 'pending'; };
window.fmtDate = function(s) { return s; };
window.healthClass = function(h) {
  return ({ 'on-track': 'health-on-track', 'attention': 'health-attention', 'stuck': 'health-stuck' })[h] || 'pill';
};
window.healthLabel = function(h) {
  return ({ 'on-track': 'On track', 'attention': 'Needs attention', 'stuck': 'Stuck' })[h] || h;
};
