// ============================================================
// Ventrify OS — WORKSPACE M3 page glue (workspace-only).
// Read AFTER window.WORKSPACE_READY. Builds the DATA the M3 drawer needs
// (nav + live badges + admin gating, org lockup, operator account) straight
// from window.WORKSPACE, and mounts the org-switcher — all reusing the
// EXISTING global behaviour in app.js (window.__switchOrg / __signOut).
// NO app.js edits, no pipeline touch. Pure read + present.
// ============================================================

import { _esc as esc, formField, STAGES, docDropzone } from '../shared/m3/ds.js';   // ONE real HTML escaper + the single-source form-field / dropzone molecules + the shared stage list
function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'V';
}

// ---- New assessment (M3 create) — the WHOLE create happens IN THE AUX PANEL: details + pitch deck +
// data room, then create → ingest the staged files → back to the portfolio. It NEVER navigates to a
// second page (the assessment detail is somewhere you CHOOSE to open, not somewhere create dumps you),
// and it never offers the legacy build wizard. Exposed as window.openNewAssessment. ----
const HUB_IDS = ['research', 'vision', 'strategy', 'financials', 'marketing', 'video', 'blog'];

// Files staged in the panel — held in memory and uploaded only once the engagement exists (ingest
// needs an engagementId). Reset every time the panel opens.
const NA = { deck: null, docs: [] };
const DOC_ACCEPT = '.pdf,.docx,.xlsx,.xls,.xlsm,.txt,.md,.csv,.zip';

function naInput() {
  let i = document.getElementById('na-file');
  if (!i) { i = document.createElement('input'); i.type = 'file'; i.id = 'na-file'; i.hidden = true; document.body.appendChild(i); }
  return i;
}
// Both zones are the ONE docDropzone component. status:'' on purpose — a staged file has NOT been
// read or stored yet (it uploads on Create), so it must not wear the Sources panel's Read/Stored pill.
const naDeckOpts = {
  single: true, status: '', clearLabel: 'Replace', fileIcon: 'slideshow',
  icon: 'upload_file', prompt: 'Drop the pitch deck here',
  sub: 'PDF · the assessment runs from it. Optional: financial model, founder letter.',
  note: 'Pitch deck · uploads when you create',
  onPick: "window.__naPick('deck')", onClear: 'window.__naClearDeck()',
};
const naDocsOpts = {
  status: '', icon: 'folder_open', prompt: 'Add data-room documents',
  sub: 'Financials, cap table, contracts, metrics — PDF, DOCX, XLSX, CSV, TXT, MD or ZIP. The agents read these alongside the deck.',
  note: 'Data room · uploads when you create', addLabel: 'Add more documents',
  onPick: "window.__naPick('docs')", onClear: 'window.__naClearDoc',
};
const naPaintDeck = () => {
  const el = document.getElementById('na-deck');
  if (el) el.innerHTML = docDropzone(NA.deck ? [{ title: NA.deck.name }] : [], naDeckOpts);
};
const naPaintDocs = () => {
  const el = document.getElementById('na-docs');
  if (el) el.innerHTML = docDropzone(NA.docs.map(f => ({ title: f.name })), naDocsOpts);
};
window.__naPick = (kind) => {
  const i = naInput();
  i.accept = kind === 'deck' ? '.pdf,.docx' : DOC_ACCEPT;
  i.multiple = kind !== 'deck';
  i.onchange = () => {
    const files = [...(i.files || [])];
    i.value = '';
    if (!files.length) return;
    if (kind === 'deck') { NA.deck = files[0]; naPaintDeck(); }
    else { NA.docs = NA.docs.concat(files); naPaintDocs(); }
  };
  i.click();
};
window.__naClearDeck = () => { NA.deck = null; naPaintDeck(); };
window.__naClearDoc = (i) => { NA.docs.splice(i, 1); naPaintDocs(); };

export function openNewAssessment() {
  const W = window.WORKSPACE || {};
  const operators = W.operators || [];
  const Plan = window.VentrifyPlan, plan = W.plan;
  if (Plan && !Plan.canCreate(plan, W.programs || [], 'assessment').allowed) {
    window.openAux({ mode: 'overlay', title: 'Plan limit reached', subtitle: 'New assessment', body: `<div style="padding:4px 2px"><div class="body-m" style="color:var(--md-sys-color-on-surface-variant)">You’ve used your assessment allowance for this plan.</div><div style="margin-top:14px"><button class="m3-btn filled" onclick="window.__requestUpgrade&&window.__requestUpgrade()">Request an upgrade</button></div></div>` });
    return;
  }
  NA.deck = null; NA.docs = [];   // fresh panel → nothing staged
  const opList = operators.length ? operators.map(o => ({ v: o.id, l: `${o.name} · ${o.role}` })) : [{ v: '', l: 'No operators' }];
  window.openAux({
    mode: 'overlay', title: 'New assessment', subtitle: 'Assess a venture from its deck',
    body: `<div class="na-form">
      ${formField({ label: 'Venture name', id: 'na-name', placeholder: 'e.g. Verdana Bio', attr: ' autocomplete="off"' })}
      ${formField({ label: 'Assessor', id: 'na-op', options: opList })}
      <div class="na-two">
        ${formField({ label: 'Website', id: 'na-site', optional: true, type: 'url', placeholder: 'acme.com' })}
        ${formField({ label: 'Stage', id: 'na-stage', placeholder: 'Select stage', options: STAGES })}
      </div>
      <div class="na-sec">
        <span class="na-lab">Pitch deck <span class="na-hint">the assessment runs from it</span></span>
        <div id="na-deck">${docDropzone([], naDeckOpts)}</div>
      </div>
      <div class="na-sec">
        <span class="na-lab">Data room <span class="field-opt">optional</span></span>
        <div id="na-docs">${docDropzone([], naDocsOpts)}</div>
      </div>
      <div class="na-actions"><button class="m3-btn filled" onclick="window.__wsCreateAssessment()"><span class="material-symbols-rounded">add</span>Create assessment</button></div>
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
  if (!stage) { window.__toast('Select the venture stage.', true); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'venture';
  const programId = 'prg-' + slug + '-' + Math.random().toString(36).slice(2, 6);
  const hasDeck = !!NA.deck;
  const newProgram = {
    id: programId, slug, engagementType: 'assessment',
    website: website || null, stage: stage || null, name,
    founderName: '', founderEmail: '', founderAvatar: name.slice(0, 2).toUpperCase() || 'VV',
    founderAvatarColor: org.primaryColor || '#0036FF',
    industry: null, venturePitch: null, briefSubmitted: false, phase: 0,
    gateStatus: hasDeck ? 'Ready to run' : 'Awaiting deck upload',
    startDate: new Date().toISOString().slice(0, 10), daysActive: 0,
    lastActivity: 'just now', lastActivityDetail: hasDeck ? 'Assessment created — deck attached' : 'Assessment created — awaiting deck',
    assignedOperator: operator, organisationSlug: org.slug || null, health: 'on-track',
    cards: { drafted: 0, awaitingFounder: 0, resolved: 0, awaitingL3Rebuild: 0 },
    hubs: HUB_IDS.reduce((a, h) => { a[h] = { status: 'disabled' }; return a; }, {}),
    mvpDemoModeReady: false, brand: null, createdAt: new Date().toISOString()
  };
  const btn = document.querySelector('.na-actions .m3-btn.filled');
  const busy = b => { if (btn) { btn.disabled = b; btn.style.opacity = b ? '0.6' : ''; } };
  busy(true);
  try {
    if (W.mode === 'live') {
      const { auth } = await import('../firebase/firebase.js');
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/create-engagement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, orgId: org.id, engagement: newProgram }) });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) { throw new Error(out.reason === 'limit' ? 'Your plan has no allowance left for another assessment.' : out.reason === 'capability' ? 'Your plan doesn’t include assessments.' : (out.error || ('HTTP ' + resp.status))); }
      // The engagement now exists → push the staged files at it (same verbatim pipeline the assessment
      // page uses). A failed upload must NOT strand the operator on a half-made engagement, so it's
      // reported but never re-throws into the create path.
      if (NA.deck || NA.docs.length) {
        try {
          const EA = await import('./engagement-actions.js');
          window.__toast('Uploading documents…');
          if (NA.deck) await EA.ingestDocs({ engagementId: programId, files: [NA.deck], docType: 'pitch', onProgress: m => window.__toast(m) });
          if (NA.docs.length) await EA.ingestDocs({ engagementId: programId, files: NA.docs, docType: 'dataroom', onProgress: m => window.__toast(m) });
        } catch (e) {
          window.__toast('Assessment created, but a document didn’t upload: ' + ((e && e.message) || e) + ' — add it from the assessment.', true);
        }
      }
    } else {
      if (NA.deck) newProgram.pitchDoc = { title: NA.deck.name, note: 'Pitch deck' };
      try { const stored = JSON.parse(localStorage.getItem('workspace.programs') || '[]'); stored.unshift(newProgram); localStorage.setItem('workspace.programs', JSON.stringify(stored)); } catch (e) {}
    }
    NA.deck = null; NA.docs = [];
    window.__toast(hasDeck ? 'Assessment created — ready to run.' : 'Assessment created.');
    window.closeOverlay && window.closeOverlay();
    // Stay where you are. The portfolio re-reads and the new assessment appears in the list.
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    busy(false);
    window.__toast('Could not create the assessment: ' + ((e && e.message) || e), true);
  }
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
