// ============================================================
// Ventrify OS — WORKSPACE M3 page glue (workspace-only).
// Read AFTER window.WORKSPACE_READY. Builds the DATA the M3 drawer needs
// (nav + live badges + admin gating, org lockup, operator account) straight
// from window.WORKSPACE, and mounts the org-switcher — all reusing the
// EXISTING global behaviour in app.js (window.__switchOrg / __signOut).
// NO app.js edits, no pipeline touch. Pure read + present.
// ============================================================

import { _esc as esc, docDropzone, roomCheck, initDropzones } from '../shared/m3/ds.js';
// The seven category LABELS, so the score column can list every category from the start and fill each one
// in place. Listing only what has landed makes the column grow and shove the page down seven times.
import { VSS_RUBRIC } from '../shared/vss-rubric.js';
import * as DS_PRESCREEN from '../shared/m3/ds.js';   // the live-reveal component, named apart so the targeted imports above stay readable   // ONE real HTML escaper + the dropzone molecule (repainting staged files) + the data-room playback. The FORM markup now lives in DS.createScreen().
function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'V';
}

// ---- New assessment (M3) — the WHOLE setup happens on ONE SCREEN: details + pitch deck + data room, with
// the data-room read filling in live beside it, then ONE primary action. It creates → ingests the deck
// (MANDATORY — dispatch-run refuses to start without one) → ingests the data room (optional) → dispatches
// the run → lands on the assessment, already running. No legacy build wizard.
//
// THE SURFACE MOVED, THE CHAIN DID NOT. Setup used to render into the aux panel; it now renders as
// create-m3.html from the DS.createScreen() template. Every element id below is unchanged, which is the
// whole reason this pipeline did not have to be rewritten to move it. Do not fork it — extend additively.
// window.openNewAssessment now navigates there, so every call site repoints at once. ----
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
  onPick: "window.__naPick('deck')", onClear: 'window.__naClearDeck()', onDrop: '__naDropDeck',
};
const naDocsOpts = {
  status: '', icon: 'folder_open', prompt: 'Add data-room documents',
  sub: 'Financials, cap table, contracts, metrics — PDF, DOCX, XLSX, CSV, TXT, MD or ZIP. The agents read these alongside the deck.',
  note: 'Data room · uploads when you run', addLabel: 'Add more documents',
  onPick: "window.__naPick('docs')", onClear: 'window.__naClearDoc', onDrop: '__naDropDocs',
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
  // `.na-run` covers BOTH actions — the create screen offers two (pre-screen / full), and gating only the
  // filled one would leave the tonal sibling live with no deck attached.
  const btns = document.querySelectorAll('.na-actions .na-run');
  const gate = document.getElementById('na-gate');
  const ready = !!NA.deck && !NA.busy;
  btns.forEach(b => { b.disabled = !ready; });
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

// ---- DROPPED files ------------------------------------------------------------------------------
// The picker constrains types with `accept`; a drop has no such gate, so the same rule is applied here.
// A rejected file is NAMED rather than silently ignored — a file that vanishes on drop reads as a bug in
// the dropzone, and the person tries it again.
const extOf = f => '.' + String(f.name || '').split('.').pop().toLowerCase();
const DECK_ACCEPT = '.pdf,.docx';
function filterDropped(files, accept, label) {
  const ok = accept.split(',');
  const keep = files.filter(f => ok.includes(extOf(f)));
  const drop = files.filter(f => !ok.includes(extOf(f)));
  if (drop.length) window.__toast(`${drop.length === 1 ? `“${drop[0].name}” is not` : `${drop.length} files are not`} a file type ${label} can read (${accept.replace(/\./g, '').replace(/,/g, ', ')}).`, true);
  return keep;
}
window.__naDropDeck = (files) => {
  if (NA.busy) return;
  const keep = filterDropped(files, DECK_ACCEPT, 'the deck');
  if (!keep.length) return;
  if (keep.length > 1) window.__toast('The pitch deck is one file — using the first and ignoring the rest.');
  NA.deck = keep[0]; naPaintDeck();
};
window.__naDropDocs = (files) => {
  if (NA.busy) return;
  const keep = filterDropped(files, DOC_ACCEPT, 'the data room');
  if (!keep.length) return;
  NA.docs = NA.docs.concat(keep); naPaintDocs();
};

// Navigate to the create screen. The plan/tier gate lives THERE, not here: the check now depends on which
// tier is being created, and duplicating that decision at every call site is how the two drift apart.
export function openNewAssessment() {
  location.href = '/workspace/create-m3.html';
}

// Reset the staged state. The screen is a real page now, so a browser Back and a second visit must not
// inherit a half-filled NA from the last one.
export function resetNewAssessment() {
  NA.deck = null; NA.docs = []; NA.busy = false; NA.deckStatus = ''; NA.docStatus = {};
  NA.driveUrl = ''; NA.driveFiles = null; NA.roomRead = false; NA.createdId = null; NA.created = null;
}

window.openNewAssessment = openNewAssessment;

// Boot the create SCREEN. The panel did this inline on open; a page has to be told when its DOM exists.
// Resets first — a browser Back onto this page must not inherit the last visit's staged files.
export function initCreateScreen() {
  resetNewAssessment();
  initDropzones();
  const i = document.getElementById('na-name');
  if (i) {
    i.focus();
    // Enter submits the PRIMARY action, whichever audience's it is — never a hardcoded one.
    i.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const b = document.querySelector('.na-actions .m3-btn.filled.na-run');
      if (b && !b.disabled) b.click();
    });
  }
  naSyncCta();
}


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
async function naEnsureEngagement(f, tier = 'full') {
  if (NA.createdId) return NA.createdId;
  const W = window.WORKSPACE || {}, org = f.org;
  const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'venture';
  const programId = 'prg-' + slug + '-' + Math.random().toString(36).slice(2, 6);
  const newProgram = {
    id: programId, slug, engagementType: 'assessment',
    // Declared here, RE-RESOLVED server-side in create-engagement: a client that could set its own
    // tier could create a 'full' engagement without paying, which is the one thing the tier is for.
    tier,
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

    // ONE copy of the Drive read, in engagement-actions — the Data Room tab performs the identical act
    // and the error mapping below (Drive cannot distinguish "missing" from "not shared") must not fork.
    let dr;
    try {
      dr = await EA.readDriveFolder({ engagementId: programId, folderUrl: f.driveUrl, onProgress: m => naProg(m) });
    } catch (err) {
      window.__toast((err && err.message) || 'Could not read the folder.', true); naBusy(false); naProg(null); return;
    }
    NA.driveFiles = dr.files;
    const skipped = dr.skipped, failed = dr.failed, list = { folderName: dr.folderName };

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

// RUN A PRE-SCREEN. The free ~1-minute read that returns a RANGE rather than a score.
//
// Same create + ingest chain as the full run, then it stops short of dispatch and scores in-request
// instead. The reveal happens in the create screen's right-hand column — the panel that was already
// showing "what we can see" — so the page the customer is on fills up rather than handing off to a
// spinner somewhere else.
window.__wsRunPrescreen = async () => {
  const f = naForm(); if (!f) return;
  const W = window.WORKSPACE || {};
  if (W.mode !== 'live') { window.__toast('The pre-screen needs the live workspace.', true); return; }

  // THE FORM GOES. The instant Run is pressed every field is locked and nothing in it can be changed, so
  // it is a dead half-screen of controls sitting on top of the only thing the person now cares about.
  // It is replaced by the full-width run stage — three columns, no scrolling between them.
  const landed = [];
  // Captured BEFORE the swap: #na-name is gone the moment the stage mounts, so reading it at paint time
  // would blank the heading on the very first repaint.
  const stageName = f.name || '';
  let phaseText = 'Starting…', roomRead = null, justFound = [], step = 0;
  const catList = (VSS_RUBRIC || []).map(c => ({ key: c.key, label: c.label }));

  const host = () => {
    let h = document.getElementById('ps-host');
    if (h) return h;
    const screen = document.querySelector('.na-screen');
    if (!screen) return null;
    h = document.createElement('div');
    h.id = 'ps-host';
    screen.replaceWith(h);
    // The masthead still read "Attach the deck and the data room" with no form left to attach it to.
    // What replaces it is the one thing a waiting person needs to know and cannot guess: the run is
    // orchestrated FROM THIS TAB (Vercel caps one invocation at 60s, so the browser fans the categories
    // out), which means closing it stops the run. Nothing on screen said so.
    const sub = document.querySelector('.mh-sub');
    if (sub) sub.textContent = 'About three minutes. Keep this tab open — the run is driven from your browser, so closing it stops the run.';
    // The stage opens at its own head. Without this the page keeps whatever scroll offset the form had,
    // which on a long form means landing halfway down a screen that just changed underneath you.
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return h;
  };
  const fileRows = () => ({
    deck: NA.deck ? { name: NA.deck.name, status: NA.deckStatus || 'Waiting',
                      state: NA.deckStatus === 'Read' ? 'done' : NA.deckStatus === 'Failed' ? 'fail' : 'idle' } : null,
    docs: NA.docs.map((f, i) => {
      const st = (NA.docStatus || {})[i] || 'Waiting';
      return { name: f.name, status: st, key: 'doc' + i,
               state: st === 'Stored' ? 'done' : st === 'Failed' ? 'fail' : 'idle' };
    }),
  });
  const repaint = () => {
    const h = host(); if (!h) return;
    const f = fileRows();
    h.innerHTML = DS_PRESCREEN.prescreenStage({
      name: stageName,
      phase: phaseText, step,
      deck: f.deck, docs: f.docs,
      room: roomRead, justFound,
      categories: catList, landed, total: catList.length || 7,
    });
  };

  naBusy(true);
  try {
    const programId = await naEnsureEngagement(f, 'prescreen');
    const EA = await import('./engagement-actions.js');
    // Mount the stage BEFORE the first upload, so the person sees where their files went the moment
    // they commit — not after the slowest step in the run has already finished.
    phaseText = 'Reading your documents…';
    repaint();

    // The deck is the hard gate here too — a pre-screen with no evidence returns a 0-60 range that says
    // nothing about the venture, which is worse than refusing.
    const deckFail = await naIngestDeck(EA, programId);
    if (deckFail) { window.__toast('The pitch deck didn’t upload: ' + deckFail, true); naBusy(false); naProg(null); return; }

    for (let i = 0; i < NA.docs.length; i++) {
      NA.docStatus = { ...(NA.docStatus || {}), [i]: 'Uploading…' }; naPaintDocs();
      naProg(`Data room · document ${i + 1} of ${NA.docs.length}`);
      const r = await EA.ingestDocs({ engagementId: programId, files: [NA.docs[i]], docType: 'dataroom', onProgress: m => naProg(m) });
      NA.docStatus = { ...(NA.docStatus || {}), [i]: ((r && r.skipped || []).length ? 'Failed' : 'Stored') }; naPaintDocs();
    }

    const { runPrescreen } = await import('./prescreen.js');
    step = 1; phaseText = 'Checking your data room…'; repaint();
    await runPrescreen({
      engagementId: programId,
      onPhase: (t) => { phaseText = t; naProg(t); repaint(); },
      // EVERY class found on the first read is "just found" — a second ago the list was six hollow
      // circles. That is precisely the change the first user said they missed because it happened in a
      // column they were not looking at.
      onRoom: (check) => {
        const was = new Set(((roomRead && roomRead.classes) || []).filter(c => c.found).map(c => c.key));
        justFound = (check.classes || []).filter(c => c.found && !was.has(c.key)).map(c => c.key);
        roomRead = check; step = 2; repaint();
        // The highlight is a one-shot: clear it so the next repaint does not replay the animation on
        // every category that lands afterwards.
        setTimeout(() => { justFound = []; }, 900);
      },
      onCategory: (c) => { landed.push(c); repaint(); },
    });

    NA.createdId = null;
    resetNewAssessment();
    location.href = '/workspace/assess-next.html?id=' + encodeURIComponent(programId);
  } catch (e) {
    naBusy(false); naProg(null);
    // The one refusal that is not a failure: this venture has already had its free pre-screen.
    if (e && e.status === 409 && e.body && e.body.error === 'already_prescreened') {
      window.__toast(`“${e.body.name}” has already been pre-screened — opening it.`);
      location.href = '/workspace/assess-next.html?id=' + encodeURIComponent(e.body.engagementId);
      return;
    }
    window.__toast('Could not run the pre-screen: ' + ((e && e.message) || e), true);
  }
};

// UNLOCK. With BILLING_ENFORCED false this simply runs the full assessment: Stripe is not wired, and the
// operator must keep being able to run full assessments. When the flag flips, this routes to checkout and
// nothing else about the screen changes.
window.__wsUnlock = async () => {
  const { unlockRoute } = await import('../shared/entitlements.js');
  if (unlockRoute() === 'checkout') { window.__toast('Checkout is not wired up yet.', true); return; }
  return window.__wsCreateAssessment();
};

window.__wsCreateAssessment = async () => {
  const f = naForm(); if (!f) return;
  const W = window.WORKSPACE || {};
  // A TWO-HOUR RUN SHOULD NOT START ON ONE CLICK. The unlock path has always confirmed; this one did
  // not, and it is the filled button for every licensee — so the first real user pressed it meaning to
  // test the three-minute pre-screen and started the full agentic assessment instead. The pre-screen
  // is offered here by name, because at that moment it is probably what they wanted.
  if (W.mode === 'live') {
    const go = await window.__confirm({
      title: 'Run the full assessment?',
      message: 'This is the complete agentic run — deep research, diligence, a measured score and a deal memo. It takes about two hours in the cloud.\n\nIf you want a quick read instead, cancel and choose “Run pre-screen first” — that takes about three minutes and is free.',
      confirmLabel: 'Run full assessment',
    });
    if (!go) return;
  }
  // Setup is a full page now, so landing is a navigation, not an overlay close. closeOverlay stays guarded
  // for the DS demo, which still runs this chain inside a panel.
  const land = () => { const id = NA.createdId; resetNewAssessment(); window.closeOverlay && window.closeOverlay(); location.href = '/workspace/assess-next.html?id=' + encodeURIComponent(id); };

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
    { key: 'portfolio', icon: 'dashboard', label: 'Portfolio', section: 'Operate', href: '/workspace/dashboard-m3.html', badge: programs.length ? String(programs.length) : '' },
    { key: 'queue', icon: 'checklist', label: 'Action queue', section: 'Operate', href: '/workspace/queue-m3.html', badge: queueCount ? String(queueCount) : '' },
    { key: 'team', icon: 'group', label: 'Team', section: 'Manage', href: '/workspace/team-m3.html', badge: operators.length ? String(operators.length) : '' },
    { key: 'settings', icon: 'settings', label: 'Settings', section: 'Manage', href: '/workspace/settings-m3.html' },
  ];
  // case-insensitive owner match (mirrors app.js shellNavConfig — emails are case-insensitive)
  const isOwner = op && org.ownerEmail && String(op.email || '').toLowerCase() === String(org.ownerEmail || '').toLowerCase();
  if (W.isSuperAdmin || isOwner) {
    nav.push({ key: 'admin', icon: 'shield_person', label: W.isSuperAdmin ? 'Platform admin' : 'Operators', section: 'Manage', href: '/workspace/admin-m3.html' });
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
  window.location.href = '/workspace/dashboard-m3.html';
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
