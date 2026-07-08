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
    { key: 'team', icon: 'group', label: 'Team', section: 'Manage', href: 'team.html', badge: operators.length ? String(operators.length) : '' },
    { key: 'settings', icon: 'settings', label: 'Settings', section: 'Manage', href: 'settings.html' },
  ];
  // case-insensitive owner match (mirrors app.js shellNavConfig — emails are case-insensitive)
  const isOwner = op && org.ownerEmail && String(op.email || '').toLowerCase() === String(org.ownerEmail || '').toLowerCase();
  if (W.isSuperAdmin || isOwner) {
    nav.push({ key: 'admin', icon: 'shield_person', label: W.isSuperAdmin ? 'Platform admin' : 'Operators', section: 'Manage', href: 'admin.html' });
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
