// ============================================================
// Ventrify OS — WORKSPACE M3 page glue (workspace-only).
// Read AFTER window.WORKSPACE_READY. Builds the DATA the M3 drawer needs
// (nav + live badges + admin gating, org lockup, operator account) straight
// from window.WORKSPACE, and mounts the org-switcher — all reusing the
// EXISTING global behaviour in app.js (window.__switchOrg / __signOut).
// NO app.js edits, no pipeline touch. Pure read + present.
// ============================================================

import { _esc as esc, formField, STAGES, docDropzone, linearProgress } from '../shared/m3/ds.js';   // ONE real HTML escaper + the single-source form-field / dropzone molecules + the shared stage list
function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'V';
}

// ---- New assessment (M3) — the WHOLE setup happens IN THE AUX PANEL: details + pitch deck + data room,
// then ONE primary action: "Run assessment". It creates → ingests the deck (MANDATORY — dispatch-run refuses
// to start without one) → ingests the data room (optional) → dispatches the run → lands on the assessment,
// already running. No second page to do the work in, and no legacy build wizard.
// Exposed as window.openNewAssessment. ----
const HUB_IDS = ['research', 'vision', 'strategy', 'financials', 'marketing', 'video', 'blog'];

// Files staged in the panel — held in memory and uploaded only once the engagement exists (ingest
// needs an engagementId). Reset every time the panel opens.
const NA = { deck: null, docs: [], busy: false, deckStatus: '', docStatus: {} };
const DOC_ACCEPT = '.pdf,.docx,.xlsx,.xls,.xlsm,.txt,.md,.csv,.zip';

function naInput() {
  let i = document.getElementById('na-file');
  if (!i) { i = document.createElement('input'); i.type = 'file'; i.id = 'na-file'; i.hidden = true; document.body.appendChild(i); }
  return i;
}
// Both zones are the ONE docDropzone component. status:'' on purpose — a staged file has NOT been
// read or stored yet (it uploads when you hit Run), so it must not wear the Sources panel's Read/Stored pill.
const naDeckOpts = {
  single: true, status: '', clearLabel: 'Replace', fileIcon: 'slideshow',
  icon: 'upload_file', prompt: 'Drop the pitch deck here',
  sub: 'PDF · the assessment runs from it. Optional: financial model, founder letter.',
  note: 'Pitch deck · uploads when you run',
  onPick: "window.__naPick('deck')", onClear: 'window.__naClearDeck()',
};
const naDocsOpts = {
  status: '', icon: 'folder_open', prompt: 'Add data-room documents',
  sub: 'Financials, cap table, contracts, metrics — PDF, DOCX, XLSX, CSV, TXT, MD or ZIP. The agents read these alongside the deck.',
  note: 'Data room · uploads when you run', addLabel: 'Add more documents',
  onPick: "window.__naPick('docs')", onClear: 'window.__naClearDoc',
};
const naPaintDeck = () => {
  const el = document.getElementById('na-deck');
  if (el) el.innerHTML = docDropzone(NA.deck ? [{ title: NA.deck.name, status: NA.deckStatus || '', busy: !!NA.busy }] : [], { ...naDeckOpts, locked: !!NA.busy });
  naSyncCta();
};
const naPaintDocs = () => {
  const el = document.getElementById('na-docs');
  if (el) el.innerHTML = docDropzone(NA.docs.map((f, i) => ({ title: f.name, status: (NA.docStatus || {})[i] || '', busy: !!NA.busy })), { ...naDocsOpts, locked: !!NA.busy });
};
// ONE chokepoint for the CTA's enabled state. The deck is MANDATORY (dispatch-run refuses to start without
// one), so the button stays disabled until a deck is staged — and a disabled .m3-btn has pointer-events:none,
// so the REASON lives in a sibling hint, never on the button.
function naSyncCta() {
  const b = document.querySelector('.na-actions .m3-btn.filled');
  const gate = document.getElementById('na-gate');
  const ready = !!NA.deck && !NA.busy;
  if (b) b.disabled = !ready;
  if (gate) gate.hidden = !!NA.deck;   // once a deck is attached the hint has nothing left to say
}
// The progress surface. Text is the real ingest phase — never a fabricated percentage.
function naProg(text) {
  const wrap = document.getElementById('na-prog'), x = document.getElementById('na-prog-x');
  if (!wrap) return;
  if (text == null) { wrap.hidden = true; return; }
  wrap.hidden = false;
  if (x) x.textContent = text;
}
function naBusy(b) {
  NA.busy = b;
  const form = document.querySelector('.na-form');
  if (form) form.classList.toggle('busy', !!b);
  naSyncCta();
}
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
  NA.deck = null; NA.docs = []; NA.busy = false; NA.deckStatus = ''; NA.docStatus = {};   // fresh panel → nothing staged
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
      <div class="na-prog" id="na-prog" hidden>
        ${linearProgress({ indeterminate: true })}
        <span class="na-prog-x" id="na-prog-x">Starting…</span>
      </div>
      <div class="na-actions">
        <span class="na-gate" id="na-gate">Attach a pitch deck to run the assessment.</span>
        <button class="m3-btn filled" disabled onclick="window.__wsCreateAssessment()"><span class="material-symbols-rounded">play_arrow</span>Run assessment</button>
      </div>
    </div>`
  });
  setTimeout(() => { const i = document.getElementById('na-name'); if (i) { i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); window.__wsCreateAssessment(); } }); } naSyncCta(); }, 60);
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
  if (!NA.deck) { window.__toast('Attach the pitch deck — the assessment runs from it.', true); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'venture';
  const programId = 'prg-' + slug + '-' + Math.random().toString(36).slice(2, 6);
  const newProgram = {
    id: programId, slug, engagementType: 'assessment',
    website: website || null, stage: stage || null, name,
    founderName: '', founderEmail: '', founderAvatar: name.slice(0, 2).toUpperCase() || 'VV',
    founderAvatarColor: org.primaryColor || '#0036FF',
    industry: null, venturePitch: null, briefSubmitted: false, phase: 0,
    gateStatus: 'Ready to run',
    startDate: new Date().toISOString().slice(0, 10), daysActive: 0,
    lastActivity: 'just now', lastActivityDetail: 'Assessment created — deck attached',
    assignedOperator: operator, organisationSlug: org.slug || null, health: 'on-track',
    cards: { drafted: 0, awaitingFounder: 0, resolved: 0, awaitingL3Rebuild: 0 },
    hubs: HUB_IDS.reduce((a, h) => { a[h] = { status: 'disabled' }; return a; }, {}),
    mvpDemoModeReady: false, brand: null, createdAt: new Date().toISOString()
  };
  const land = () => { NA.deck = null; NA.docs = []; NA.deckStatus = ''; NA.docStatus = {}; window.closeOverlay && window.closeOverlay(); location.href = 'assess-next.html?id=' + encodeURIComponent(programId); };

  naBusy(true);
  try {
    // DEMO / local — there is no Firestore doc to ingest into or dispatch against. Create only.
    if (W.mode !== 'live') {
      newProgram.pitchDoc = { title: NA.deck.name, note: 'Pitch deck' };
      try { const stored = JSON.parse(localStorage.getItem('workspace.programs') || '[]'); stored.unshift(newProgram); localStorage.setItem('workspace.programs', JSON.stringify(stored)); } catch (e) {}
      window.__toast('Assessment created.');
      land();
      return;
    }

    // 1 — CREATE. create-engagement commits the doc before it answers, so no read-back is needed.
    naProg('Creating the assessment…');
    const { auth } = await import('../firebase/firebase.js');
    const idToken = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/create-engagement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, orgId: org.id, engagement: newProgram }) });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) { throw new Error(out.reason === 'limit' ? 'Your plan has no allowance left for another assessment.' : out.reason === 'capability' ? 'Your plan doesn’t include assessments.' : (out.error || ('HTTP ' + resp.status))); }

    const EA = await import('./engagement-actions.js');

    // 2 — THE PITCH DECK. This is the hard gate: dispatch-run REFUSES to start without an ingested deck.
    // ingestDocs NEVER throws on a per-file failure — it resolves with {ingested:0, skipped:[…]}. If we
    // trusted that resolve and dispatched anyway, the run would bounce off its own guard and leave a
    // brand-new, dead engagement. So reconcile the result and DO NOT dispatch unless the deck truly landed.
    NA.deckStatus = 'Uploading…'; naPaintDeck();
    naProg('Reading the pitch deck…');
    const deckRes = await EA.ingestDocs({ engagementId: programId, files: [NA.deck], docType: 'pitch', onProgress: m => naProg(m) });
    if (!deckRes || deckRes.ingested !== 1 || (deckRes.skipped || []).length) {
      const why = ((deckRes && deckRes.skipped && deckRes.skipped[0]) || {}).reason || 'the deck could not be read';
      window.__toast('Assessment created, but the pitch deck didn’t upload: ' + why + ' — add it from the assessment.', true);
      land();                                   // recoverable: the page opens on "Upload deck", never a dead end
      return;                                   // ⚠️ DO NOT DISPATCH — the run would be rejected
    }
    NA.deckStatus = 'Read'; naPaintDeck();

    // 3 — THE DATA ROOM (optional). Fully awaited BEFORE dispatch so the runner never reads a half-filled
    // room. A skipped data-room file is a warning, never a blocker — only the deck is required.
    const roomSkipped = [];
    for (let i = 0; i < NA.docs.length; i++) {
      NA.docStatus = { ...(NA.docStatus || {}), [i]: 'Uploading…' }; naPaintDocs();
      naProg(`Data room · document ${i + 1} of ${NA.docs.length}`);
      const r = await EA.ingestDocs({ engagementId: programId, files: [NA.docs[i]], docType: 'dataroom', onProgress: m => naProg(m) });
      const bad = (r && r.skipped || []).length;
      roomSkipped.push(...((r && r.skipped) || []));
      NA.docStatus = { ...(NA.docStatus || {}), [i]: bad ? 'Failed' : 'Stored' }; naPaintDocs();
    }
    if (roomSkipped.length) window.__toast(`Couldn’t ingest ${roomSkipped.length}: ${roomSkipped.map(s => s.name).join(', ')} — add them from the assessment.`, true);

    // 4 — DISPATCH. Verbatim; it surfaces its own failure and returns false.
    naProg('Starting the assessment…');
    const ok = await EA.dispatchRun({ engagementId: programId, phase: 'assess' });
    if (ok) window.__toast('Assessment queued — this runs in the cloud.');

    // 5 — LAND on the assessment, which paints the run banner (dispatch-run stamps runState.status='queued'
    // before it answers, so it is already active on first load). If the run was refused, the page simply
    // shows its idle "Run assessment" CTA — created, deck attached, nothing lost.
    land();
  } catch (e) {
    naBusy(false);
    naProg(null);
    NA.deckStatus = ''; naPaintDeck();
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
