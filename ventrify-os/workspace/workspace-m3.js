// ============================================================
// Ventrify OS — WORKSPACE M3 page glue (workspace-only).
// Read AFTER window.WORKSPACE_READY. Builds the DATA the M3 drawer needs
// (nav + live badges + admin gating, org lockup, operator account) straight
// from window.WORKSPACE, and mounts the org-switcher — all reusing the
// EXISTING global behaviour in app.js (window.__switchOrg / __signOut).
// NO app.js edits, no pipeline touch. Pure read + present.
// ============================================================

import { _esc as esc, formField, STAGES, docDropzone, linearProgress, roomCheck } from '../shared/m3/ds.js';   // ONE real HTML escaper + the single-source form-field / dropzone molecules + the shared stage list
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
const NA = { deck: null, docs: [], busy: false, deckStatus: '', docStatus: {},
  // A LINKED data room. `createdId` is set once the engagement exists — reading the room has to create
  // it first, so Run must then skip creation rather than making a second engagement.
  driveUrl: '', driveFiles: null, roomRead: false, createdId: null, created: null };
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
      ${formField({ label: 'Founder', id: 'na-founder', placeholder: 'e.g. Jane Okafor', hint: 'Who the assessment is about — the agents diligence them by name', attr: ' autocomplete="off"' })}
      ${formField({ label: 'Founder email', id: 'na-founder-email', optional: true, type: 'email', placeholder: 'jane@acme.com', hint: 'Only needed to ask them for missing data-room documents' })}
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
        <div class="na-drive">
          <div class="na-drive-row">
            ${formField({ label: 'Or link a Google Drive folder', id: 'na-drive', optional: true, type: 'url', placeholder: 'https://drive.google.com/drive/folders/…', hint: 'Shared with anyone who has the link, or with dataroom-reader@ventrify-os.iam.gserviceaccount.com' })}
            <div class="na-drive-btns">
              <button class="m3-btn tonal na-drive-go" type="button" onclick="window.__naReadRoom()">Read data room</button>
              <button class="m3-btn text na-drive-again" type="button" onclick="window.__naCheckRoom()" hidden>Check for new files</button>
            </div>
          </div>
          <div id="na-room"></div>
        </div>
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

// Gather + validate the form once. Returns null (having toasted) when something required is missing.
function naForm() {
  const W = window.WORKSPACE || {}, org = W.org || {};
  const name = ((document.getElementById('na-name') || {}).value || '').trim();
  if (!name) { window.__toast('Enter a venture name.', true); return null; }
  const founder = ((document.getElementById('na-founder') || {}).value || '').trim();
  const stage = ((document.getElementById('na-stage') || {}).value || '').trim();
  if (!stage) { window.__toast('Select the venture stage.', true); return null; }
  if (!founder) { window.__toast('Name the founder — the assessment diligences them by name.', true); return null; }
  if (!NA.deck) { window.__toast('Attach the pitch deck — the assessment runs from it.', true); return null; }
  return {
    org, name, founder, stage,
    operator: (document.getElementById('na-op') || {}).value || '',
    website: ((document.getElementById('na-site') || {}).value || '').trim(),
    driveUrl: ((document.getElementById('na-drive') || {}).value || '').trim(),
    founderEmail: ((document.getElementById('na-founder-email') || {}).value || '').trim().toLowerCase(),
  };
}

// CREATE ONCE. Reading a linked data room needs an engagement to ingest into, so it creates one — and Run
// must then reuse it. Without this, pressing Read and then Run would leave two engagements for one venture.
async function naEnsureEngagement(f) {
  if (NA.createdId) return NA.createdId;
  const W = window.WORKSPACE || {}, org = f.org;
  const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'venture';
  const programId = 'prg-' + slug + '-' + Math.random().toString(36).slice(2, 6);
  const newProgram = {
    id: programId, slug, engagementType: 'assessment',
    website: f.website || null, stage: f.stage || null, name: f.name,
    founderName: f.founder, founderEmail: f.founderEmail || '',
    founderAvatar: (f.founder || f.name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'VV',
    founderAvatarColor: org.primaryColor || '#0036FF',
    industry: null, venturePitch: null, briefSubmitted: false, phase: 0,
    gateStatus: 'Ready to run',
    startDate: new Date().toISOString().slice(0, 10), daysActive: 0,
    lastActivity: 'just now', lastActivityDetail: 'Assessment created — deck attached',
    assignedOperator: f.operator, organisationSlug: org.slug || null, health: 'on-track',
    cards: { drafted: 0, awaitingFounder: 0, resolved: 0, awaitingL3Rebuild: 0 },
    hubs: HUB_IDS.reduce((a, h) => { a[h] = { status: 'disabled' }; return a; }, {}),
    mvpDemoModeReady: false, brand: null, createdAt: new Date().toISOString()
  };
  NA.created = newProgram;
  if (W.mode !== 'live') { NA.createdId = programId; return programId; }
  naProg('Creating the assessment…');
  const { auth } = await import('../firebase/firebase.js');
  const idToken = await auth.currentUser.getIdToken();
  const resp = await fetch('/api/create-engagement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, orgId: org.id, engagement: newProgram }) });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(out.reason === 'limit' ? 'Your plan has no allowance left for another assessment.' : out.reason === 'capability' ? 'Your plan doesn’t include assessments.' : (out.error || ('HTTP ' + resp.status)));
  NA.createdId = programId;
  return programId;
}

// Ingest the deck. The hard gate: dispatch-run REFUSES to start without one, so a failure here must never
// be allowed to reach dispatch. Returns the reason it failed, or null on success.
async function naIngestDeck(EA, programId) {
  if (NA.deckStatus === 'Read') return null;
  NA.deckStatus = 'Uploading…'; naPaintDeck();
  naProg('Reading the pitch deck…');
  const r = await EA.ingestDocs({ engagementId: programId, files: [NA.deck], docType: 'pitch', onProgress: m => naProg(m) });
  if (!r || r.ingested !== 1 || (r.skipped || []).length) return ((r && r.skipped && r.skipped[0]) || {}).reason || 'the deck could not be read';
  NA.deckStatus = 'Read'; naPaintDeck();
  return null;
}

// READ A LINKED GOOGLE DRIVE DATA ROOM, then play back what the score will look for and could not find.
// Deliberately BEFORE the run: a missing cap table is worth knowing in three minutes, not in two hours.
window.__naReadRoom = async () => {
  const f = naForm(); if (!f) return;
  if (!f.driveUrl) { window.__toast('Paste the Google Drive folder link first.', true); return; }
  const W = window.WORKSPACE || {};
  if (W.mode !== 'live') { window.__toast('Linking a data room needs the live workspace.', true); return; }
  naBusy(true);
  try {
    const programId = await naEnsureEngagement(f);
    const { auth } = await import('../firebase/firebase.js');
    const idToken = await auth.currentUser.getIdToken();
    const EA = await import('./engagement-actions.js');

    const deckFail = await naIngestDeck(EA, programId);
    if (deckFail) { window.__toast('The pitch deck didn’t upload: ' + deckFail, true); naBusy(false); naProg(null); return; }

    naProg('Opening the Drive folder…');
    const lr = await fetch('/api/ingest-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, engagementId: programId, action: 'drive-list', folderUrl: f.driveUrl }) });
    const list = await lr.json().catch(() => ({}));
    if (!lr.ok) {
      // Drive answers the same way for "no such folder" and "not shared with us", so the message covers both.
      const msg = list.error === 'drive_not_shared'
        ? 'Could not open that folder. Check the link, and that it is shared — either “anyone with the link can view”, or with dataroom-reader@ventrify-os.iam.gserviceaccount.com as Viewer.'
        : list.error === 'bad_folder_link' ? 'That does not look like a Google Drive folder link.'
        : list.error === 'drive_not_configured' ? 'The Drive reader is not configured on this environment yet.'
        : (list.detail || list.error || 'Could not read the folder.');
      window.__toast(msg, true); naBusy(false); naProg(null); return;
    }
    NA.driveFiles = list.files || [];
    const skipped = (list.skipped || []).length;
    if (!NA.driveFiles.length) { window.__toast('That folder has no readable documents in it.', true); naBusy(false); naProg(null); return; }

    // Ingest one at a time: each request stays inside the serverless budget, and the operator sees honest
    // progress rather than a spinner for three minutes.
    let failed = 0;
    for (let i = 0; i < NA.driveFiles.length; i++) {
      const d = NA.driveFiles[i];
      naProg(`Reading the data room · ${i + 1} of ${NA.driveFiles.length} · ${d.name.slice(0, 44)}`);
      const r = await fetch('/api/ingest-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, engagementId: programId, docType: 'dataroom', file: { name: d.name, driveId: d.driveId, exportMime: d.exportMime, driveModified: d.modifiedTime } }) });
      if (!r.ok) failed++;
    }

    naProg('Checking what the score will look for…');
    const cr = await fetch('/api/ingest-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, engagementId: programId, action: 'room-check' }) });
    const check = await cr.json().catch(() => ({}));
    const slot = document.getElementById('na-room');
    if (slot && cr.ok) slot.innerHTML = roomCheck(check);
    NA.roomRead = true;
    const again = document.querySelector('.na-drive-again'); if (again) again.hidden = false;
    naBusy(false); naProg(null);
    naSyncCta();
    const read = NA.driveFiles.length - failed;
    window.__toast(`Read ${read} document${read === 1 ? '' : 's'} from ${list.folderName}` + (skipped ? ` · ${skipped} skipped` : '') + (failed ? ` · ${failed} failed` : ''));
  } catch (e) {
    naBusy(false); naProg(null);
    window.__toast('Could not read the data room: ' + ((e && e.message) || e), true);
  }
};

// RE-SCAN. The founder was emailed a list and has dropped files into the folder; nothing tells the Workspace
// that happened. This re-lists the room, re-reads ONLY what is new or changed — a re-scan of a 46-document
// room that gained one file costs one listing and one ingest, not three minutes — and repaints the playback.
window.__naCheckRoom = async () => {
  const id = NA.createdId;
  if (!id) { window.__toast('Read the data room first.', true); return; }
  const btn = document.querySelector('.na-drive-again');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  const EA = await import('./engagement-actions.js');
  const r = await EA.rescanDataRoom({ engagementId: id, onProgress: naProg, onBusy: naBusy });
  if (r) {
    const slot = document.getElementById('na-room');
    if (slot && r.check) slot.innerHTML = roomCheck(r.check);
    window.__toast(EA.rescanSummary(r));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Check for new files'; }
};

// CHASE THE GAPS. Sends the founder the list the playback just showed — what the score looks for and could
// not find in the room, with a link straight back to the folder they should drop it into.
//
// The email's CONTENT is built server-side from the engagement record and a fresh room check; the client
// chooses the recipient and may add a note, and nothing else. An operator cannot compose arbitrary mail
// through this, which matters for anything that leaves the building from a verified domain.
window.__naRequestDocs = async () => {
  const id = NA.createdId;
  if (!id) { window.__toast('Read the data room first.', true); return; }
  const to = ((document.getElementById('na-founder-email') || {}).value || '').trim().toLowerCase();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    window.__toast('Add the founder’s email so we know where to send the request.', true);
    const el = document.getElementById('na-founder-email'); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return;
  }
  const btn = document.querySelector('.rc-act .m3-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const { auth } = await import('../firebase/firebase.js');
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'docs-request', idToken, engagementId: id, email: to }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error === 'nothing_missing' ? 'There is nothing missing to ask for.' : (d.detail || d.error || ('HTTP ' + r.status)));
    const slot = document.querySelector('.rc-act');
    if (slot) slot.innerHTML = `<span class="rc-act-sent"><span class="material-symbols-rounded">mark_email_read</span>Request sent to ${esc(to)} · ${d.requested} item${d.requested === 1 ? '' : 's'}</span>`;
    window.__toast('Request sent to ' + to + '.');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Request these from the founder'; }
    window.__toast('Could not send the request: ' + ((e && e.message) || e), true);
  }
};

window.__wsCreateAssessment = async () => {
  const f = naForm(); if (!f) return;
  const W = window.WORKSPACE || {};
  const land = () => { NA.deck = null; NA.docs = []; NA.deckStatus = ''; NA.docStatus = {}; NA.driveFiles = null; NA.roomRead = false; const id = NA.createdId; NA.createdId = null; window.closeOverlay && window.closeOverlay(); location.href = 'assess-next.html?id=' + encodeURIComponent(id); };

  naBusy(true);
  try {
    // DEMO / local — there is no Firestore doc to ingest into or dispatch against. Create only.
    if (W.mode !== 'live') {
      await naEnsureEngagement(f);
      const p = NA.created; p.pitchDoc = { title: NA.deck.name, note: 'Pitch deck' };
      try { const stored = JSON.parse(localStorage.getItem('workspace.programs') || '[]'); stored.unshift(p); localStorage.setItem('workspace.programs', JSON.stringify(stored)); } catch (e) {}
      window.__toast('Assessment created.');
      land();
      return;
    }

    // 1 — CREATE, unless reading a linked data room already did. One venture, one engagement.
    const programId = await naEnsureEngagement(f);

    const EA = await import('./engagement-actions.js');

    // 2 — THE PITCH DECK. The hard gate: dispatch-run REFUSES to start without an ingested deck, so a
    // failure here must never reach dispatch (it would leave a brand-new, dead engagement). No-ops when
    // the Read step already ingested it.
    const deckFail = await naIngestDeck(EA, programId);
    if (deckFail) {
      window.__toast('Assessment created, but the pitch deck didn’t upload: ' + deckFail + ' — add it from the assessment.', true);
      land();                                   // recoverable: the page opens on "Upload deck", never a dead end
      return;                                   // ⚠️ DO NOT DISPATCH — the run would be rejected
    }

    // 3 — THE DATA ROOM (optional). Fully awaited BEFORE dispatch so the runner never reads a half-filled
    // room. A skipped data-room file is a warning, never a blocker — only the deck is required.
    const roomSkipped = [];
    if (NA.roomRead) naProg(`Linked data room already read · ${(NA.driveFiles || []).length} documents`);
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
    /* glass-3 is the brand's ready-made MENU material (brand.css § MATERIALS: "modals,
       menus, popovers"). It carries film + blur + edge + bevel + cast as one recipe.
       This panel previously hand-assembled a surface out of raw M3 role tokens, which
       is the exact thing that class exists to stop — it resolved to a flat neutral
       container that read as stock Material next to a chrome made of glass. */
    panel.className = 'ws-orgswitch-panel glass-3';
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
