// ============================================================
// Ventrify OS — WORKSPACE M3 page glue (workspace-only).
// Read AFTER window.WORKSPACE_READY. Builds the DATA the M3 drawer needs
// (nav + live badges + admin gating, org lockup, operator account) straight
// from window.WORKSPACE, and mounts the org-switcher — all reusing the
// EXISTING global behaviour in app.js (window.__switchOrg / __signOut).
// NO app.js edits, no pipeline touch. Pure read + present.
// ============================================================

import { _esc as esc } from '../shared/m3/ds.js';   // ONE real HTML escaper (org names into the switcher panel)
function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'V';
}

// ---- New assessment (M3 create) — opens an aux form, creates via /api/create-engagement (VERBATIM
// from new-engagement.html), then lands on the interactive assess-next detail to upload + run.
// Build engagements (founder + hubs) keep the full classic wizard. Exposed as window.openNewAssessment. ----
const HUB_IDS = ['research', 'vision', 'strategy', 'financials', 'marketing', 'video', 'blog'];
export function openNewAssessment() {
  const W = window.WORKSPACE || {};
  const operators = W.operators || [];
  const Plan = window.VentrifyPlan, plan = W.plan;
  if (Plan && !Plan.canCreate(plan, W.programs || [], 'assessment').allowed) {
    window.openAux({ mode: 'overlay', title: 'Plan limit reached', subtitle: 'New assessment', body: `<div style="padding:4px 2px"><div class="body-m" style="color:var(--md-sys-color-on-surface-variant)">You’ve used your assessment allowance for this plan.</div><div style="margin-top:14px"><button class="m3-btn filled" onclick="window.__requestUpgrade&&window.__requestUpgrade()">Request an upgrade</button></div></div>` });
    return;
  }
  const canBuild = Plan ? Plan.allowedTypes(plan).includes('build') : false;
  const opts = operators.length ? operators.map(o => `<option value="${esc(o.id)}">${esc(o.name)} · ${esc(o.role)}</option>`).join('') : '<option value="">No operators</option>';
  window.openAux({
    mode: 'overlay', title: 'New assessment', subtitle: 'Assess a venture from its deck',
    body: `<div style="display:flex;flex-direction:column;gap:16px;padding:4px 2px">
      <div><div class="overline" style="margin-bottom:6px">Venture name</div><input id="na-name" class="field-in" placeholder="e.g. Verdana Bio" autocomplete="off" style="width:100%;box-sizing:border-box"></div>
      <div><div class="overline" style="margin-bottom:6px">Assessor</div><select id="na-op" class="field-sel" style="width:100%;box-sizing:border-box">${opts}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div class="overline" style="margin-bottom:6px">Website · optional</div><input id="na-site" class="field-in" placeholder="acme.com" style="width:100%;box-sizing:border-box"></div>
        <div><div class="overline" style="margin-bottom:6px">Stage · optional</div><input id="na-stage" class="field-in" placeholder="Seed" style="width:100%;box-sizing:border-box"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="m3-btn filled" onclick="window.__wsCreateAssessment()"><span class="material-symbols-rounded">add</span>Create assessment</button></div>
      ${canBuild ? `<div class="body-s" style="color:var(--md-sys-color-on-surface-variant);margin-top:2px;border-top:1px solid var(--md-sys-color-outline-variant);padding-top:12px">Need a full build engagement (founder + hubs)? <a href="new-engagement.html" style="color:var(--md-sys-color-primary)">Use the full wizard →</a></div>` : ''}
    </div>`
  });
  setTimeout(() => { const i = document.getElementById('na-name'); if (i) { i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); window.__wsCreateAssessment(); } }); } }, 60);
}
window.openNewAssessment = openNewAssessment;
window.__wsCreateAssessment = async () => {
  const W = window.WORKSPACE || {}, org = W.org || {};
  const name = ((document.getElementById('na-name') || {}).value || '').trim();
  if (!name) { window.__toast('Enter a venture name.', true); return; }
  const operator = (document.getElementById('na-op') || {}).value || '';
  const website = ((document.getElementById('na-site') || {}).value || '').trim();
  const stage = ((document.getElementById('na-stage') || {}).value || '').trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'venture';
  const programId = 'prg-' + slug + '-' + Math.random().toString(36).slice(2, 6);
  const newProgram = {
    id: programId, slug, engagementType: 'assessment',
    website: website || null, stage: stage || null, name,
    founderName: '', founderEmail: '', founderAvatar: name.slice(0, 2).toUpperCase() || 'VV',
    founderAvatarColor: org.primaryColor || '#0036FF',
    industry: null, venturePitch: null, briefSubmitted: false, phase: 0,
    gateStatus: 'Awaiting deck upload',
    startDate: new Date().toISOString().slice(0, 10), daysActive: 0,
    lastActivity: 'just now', lastActivityDetail: 'Assessment created — awaiting deck',
    assignedOperator: operator, organisationSlug: org.slug || null, health: 'on-track',
    cards: { drafted: 0, awaitingFounder: 0, resolved: 0, awaitingL3Rebuild: 0 },
    hubs: HUB_IDS.reduce((a, h) => { a[h] = { status: 'disabled' }; return a; }, {}),
    mvpDemoModeReady: false, brand: null, createdAt: new Date().toISOString()
  };
  try {
    if (W.mode === 'live') {
      const { auth } = await import('../firebase/firebase.js');
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/create-engagement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, engagement: newProgram }) });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) { throw new Error(out.reason === 'limit' ? 'Your plan has no allowance left for another assessment.' : out.reason === 'capability' ? 'Your plan doesn’t include assessments.' : (out.error || ('HTTP ' + resp.status))); }
    } else {
      try { const stored = JSON.parse(localStorage.getItem('workspace.programs') || '[]'); stored.unshift(newProgram); localStorage.setItem('workspace.programs', JSON.stringify(stored)); } catch (e) {}
    }
    window.closeOverlay && window.closeOverlay();
    location.href = 'assess-next.html?id=' + encodeURIComponent(programId);
  } catch (e) { window.__toast('Could not create the assessment: ' + ((e && e.message) || e), true); }
};

// nav DATA (mirrors app.js shellNavConfig): Operate + Manage, live badges, conditional admin.
// `active` = 'portfolio' | 'queue' | ... . Portfolio/Queue point at the -m3 siblings (this stage);
// the rest point at the classic pages (not yet migrated).
export function wsNavConfig() {
  const W = window.WORKSPACE || {};
  const A = window.WORKSPACE_AGENTS;
  const programs = W.programs || [];
  const operators = W.operators || [];
  const org = W.org || {};
  const op = (W.helpers && W.helpers.currentOperator && W.helpers.currentOperator()) || null;
  // wsNavConfig runs at mount (before pageShell) — mirror app.js's queueBadgeCount try/catch so a
  // throw on a real engagement shape degrades to the actions count instead of blanking the page.
  let queueCount;
  try { queueCount = (A && A.computeActionQueue) ? A.computeActionQueue(programs, W.currentOperatorId).length : (W.actions || []).length; }
  catch (e) { queueCount = (W.actions || []).length; }
  const nav = [
    { key: 'portfolio', icon: 'dashboard', label: 'Portfolio', section: 'Operate', href: 'dashboard-m3.html', badge: programs.length ? String(programs.length) : '' },
    { key: 'queue', icon: 'checklist', label: 'Action queue', section: 'Operate', href: 'queue-m3.html', badge: queueCount ? String(queueCount) : '' },
    { key: 'team', icon: 'group', label: 'Team', section: 'Manage', href: 'team-m3.html', badge: operators.length ? String(operators.length) : '' },
    { key: 'settings', icon: 'settings', label: 'Settings', section: 'Manage', href: 'settings-m3.html' },
  ];
  // case-insensitive owner match (mirrors app.js shellNavConfig — emails are case-insensitive)
  const isOwner = op && org.ownerEmail && String(op.email || '').toLowerCase() === String(org.ownerEmail || '').toLowerCase();
  if (W.isSuperAdmin || isOwner) {
    nav.push({ key: 'admin', icon: 'shield_person', label: W.isSuperAdmin ? 'Platform admin' : 'Operators', section: 'Manage', href: 'admin-m3.html' });
  }
  return nav;
}

// org lockup + switcher DATA
export function wsBrandConfig() {
  const W = window.WORKSPACE || {};
  const org = W.org || {};
  return {
    name: org.name || 'Ventrify',
    sub: 'Operator workspace',
    logo: org.logoDataUrl || org.logoUrl || '',
    initials: initials(org.name),
    color: org.primaryColor || '',
    orgs: W.orgs || (org.id ? [org] : []),
    activeOrgId: org.id || '',
  };
}

// operator identity + sign-out DATA
export function wsAccountConfig() {
  const W = window.WORKSPACE || {};
  const op = (W.helpers && W.helpers.currentOperator && W.helpers.currentOperator()) || null;
  return {
    initials: (op && (op.avatar || initials(op.name))) || '—',
    name: (op && op.name) || 'Operator',
    role: 'Operator',
    color: (op && op.avatarColor) || '',
  };
}

// Build + wire the org-switch panel (M3-native; the live panel CSS is in workspace/styles.css,
// which isn't loaded here — this uses the .ws-orgswitch-* classes in workspace-chrome.css).
// Reuses the existing window.__switchOrg for the actual switch. Call once after DS.initShell().
// Switch org but stay in the M3 experience. Reuses the SAME 'workspace.activeOrg' localStorage
// contract app.js/bootstrap read, but lands on dashboard-m3.html instead of the classic dashboard —
// so a multi-org operator switching from an M3 page isn't silently dumped into the classic UI.
// (app.js's shared window.__switchOrg is left untouched — the classic pages depend on it.)
window.__switchOrgM3 = function(orgId) {
  try { localStorage.setItem('workspace.activeOrg', orgId); } catch (e) {}
  window.location.href = 'dashboard-m3.html';
};

export function mountOrgSwitcherM3() {
  const W = window.WORKSPACE || {};
  const orgs = W.orgs || [];
  if (orgs.length <= 1) return;   // nothing to switch between
  const activeId = W.org && W.org.id;

  let panel = document.getElementById('ws-orgswitch-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ws-orgswitch-panel';
    panel.className = 'ws-orgswitch-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'menu');
    document.body.appendChild(panel);
  }
  panel.innerHTML = `<div class="ws-orgswitch-lab">Switch organisation</div>` + orgs.map(o => `
    <button class="ws-orgswitch-item${o.id === activeId ? ' active' : ''}" role="menuitem" onclick="window.__switchOrgM3&&window.__switchOrgM3('${esc(o.id)}')">
      <span class="ws-orgswitch-mark" style="background:${esc(o.primaryColor) || 'var(--md-sys-color-primary)'}">${esc(initials(o.name))}</span>
      <span>${esc(o.name)}</span>${o.id === activeId ? '<span class="material-symbols-rounded">check</span>' : ''}
    </button>`).join('');

  const close = () => { panel.hidden = true; document.removeEventListener('click', onOutside); document.removeEventListener('keydown', onKey); };
  const onOutside = e => { if (!panel.contains(e.target) && !(e.target.closest && e.target.closest('.drawer-brand.switch'))) close(); };
  const onKey = e => { if (e.key === 'Escape') close(); };

  window.__wsOrgSwitch = function(trigger) {
    if (!panel.hidden) { close(); return; }
    const mobile = window.matchMedia('(max-width: 840px)').matches;
    if (mobile && trigger) {
      trigger.insertAdjacentElement('afterend', panel);   // inline accordion inside the drawer
      panel.style.left = panel.style.top = '';
    } else {
      document.body.appendChild(panel);
      const r = trigger.getBoundingClientRect();
      panel.style.left = Math.round(r.left) + 'px';
      panel.style.top = Math.round(r.bottom + 6) + 'px';
    }
    panel.hidden = false;
    setTimeout(() => { document.addEventListener('click', onOutside); document.addEventListener('keydown', onKey); }, 0);
  };
}
