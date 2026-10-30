// ============================================================
// engagement-actions.js — operator write-actions for an assessment engagement.
// Every /api/* and firebase/data.js call is copied VERBATIM from program.html —
// the sacred run/dispatch/ingest/memo pipeline is REUSED, never reimplemented.
// DOM-free: each action takes callbacks (onBusy / onProgress) so the caller (the
// classic page OR the M3 assess-next detail) drives its own repaint. Uses the
// global window.__toast for user-facing errors (defined by app.js on every page).
// ============================================================
import { dealMemoHTML } from './memo-view.js';

async function idToken() {
  const { auth } = await import('../firebase/firebase.js');
  return auth.currentUser ? await auth.currentUser.getIdToken() : null;
}
function readFileB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read failed')); r.readAsDataURL(file); });
}

// ---- run a headless assessment (VERBATIM /api/dispatch-run core + local-daemon fallback) ----
export async function dispatchRun({ engagementId, phase = 'assess', onBusy } = {}) {
  const busy = onBusy || (() => {});
  busy(true);
  try {
    const data = await import('../firebase/data.js');
    const W = window.WORKSPACE || {};
    const me = (W.helpers && W.helpers.currentOperator && W.helpers.currentOperator()) || null;
    // Prefer the cloud dispatcher (GitHub Actions). Falls back to the local-daemon queue.
    try {
      const token = await idToken();
      if (token) {
        const resp = await fetch('/api/dispatch-run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token, engagementId, phase })
        });
        if (resp.ok) return true;                 // cloud Action fired
        // A real rejection (e.g. no pitch deck) — surface it, don't fall through to local queue.
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 503) {
          const d = await resp.json().catch(() => ({}));
          throw new Error(d.detail || d.error || ('Run rejected (' + resp.status + ')'));
        }
      }
    } catch (e) {
      if (e && /pitch|Run rejected|forbidden/i.test(String(e.message || ''))) throw e;
      /* otherwise fall through to local-daemon queue */
    }
    await data.requestRun(engagementId, phase, (me && me.email) || null);
    return true;
  } catch (e) {
    window.__toast('Could not start the run: ' + ((e && (e.code || e.message)) || e), true);
    busy(false);
    return false;
  }
}

// ---- re-apply a finished run's SAVED output, no AI cost (VERBATIM /api/dispatch-run phase:republish) ----
// ---- STOP a run in flight (VERBATIM /api/dispatch-run with action:'cancel') ----
// A TRUE stop: the endpoint cancels the actual GitHub Actions job and then clears runState. It is only
// offered when the run has reported its job id (DS.canStopRun) — a stop that merely hides the spinner would
// leave the orphaned run to finish, publish, and email "your assessment is ready".
export async function stopRun({ engagementId, onBusy } = {}) {
  const busy = onBusy || (() => {});
  busy(true);
  try {
    const token = await idToken();
    if (!token) throw new Error('Please sign in again.');
    const resp = await fetch('/api/dispatch-run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, engagementId, action: 'cancel' })
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || d.error || ('Stop rejected (' + resp.status + ')')); }
    return true;
  } catch (e) {
    window.__toast('Could not stop the run: ' + ((e && (e.code || e.message)) || e), true);
    busy(false);
    return false;
  }
}

export async function republish({ engagementId, onBusy } = {}) {
  const busy = onBusy || (() => {});
  busy(true);
  try {
    const token = await idToken();
    if (!token) throw new Error('Please sign in again.');
    const resp = await fetch('/api/dispatch-run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, engagementId, phase: 'republish' })
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || d.error || ('Republish rejected (' + resp.status + ')')); }
    return true;
  } catch (e) {
    window.__toast('Could not republish: ' + ((e && (e.code || e.message)) || e), true);
    busy(false);
    return false;
  }
}

// ---- ingest founder documents (VERBATIM: base64 <4MB via /api/ingest-docs, Storage >4MB, .zip walk) ----
// Returns { ingested, skipped:[{name,reason}] } — the caller reconciles + refreshes.
export async function ingestDocs({ engagementId, files, docType, onProgress } = {}) {
  files = Array.from(files || []);
  if (!files.length) return { ingested: 0, skipped: [] };
  const prog = onProgress || (() => {});
  const token = await idToken();
  const SUPPORTED = /\.(pdf|docx?|xlsx?|xlsm|txt|md|csv)$/i;
  // Office LOCK/TEMP stubs (~$Foo.docx) — 162-byte owner files Word leaves behind while a document is open.
  // They ride along inside a zipped data room, and they are NOT evidence: they inflate the document count,
  // they cannot be text-extracted, and the runner then reports them to the agents as "provided but
  // UNAVAILABLE — pending manual review, NOT missing", which quietly pollutes the evidence picture.
  // (Also catches macOS ._resource forks.)
  const JUNK = /(^|\/)(~\$|\._)/;
  // Vercel caps a serverless request body at ~4.5MB, and base64 INFLATES a file by 4/3 — so a 4MB PDF became
  // a ~5.3MB payload and died with HTTP 413. Anything above this goes via Storage instead, which has no such
  // limit. 3MB → ~4MB encoded, comfortably inside the cap even with the JSON envelope.
  const INLINE_MAX = 3 * 1024 * 1024;
  let ingested = 0; const skipped = [];   // never silently dropped
  const landed = [];                      // names that actually made it — these CLEAR any prior failure

  async function ingestOne(name, blob) {
    let payload;
    if (blob.size > INLINE_MAX) {
      // Large file → upload straight to Storage (bypasses the serverless body limit); the server extracts.
      prog('Uploading ' + name + '…');
      const ext = (name.split('.').pop() || 'bin').toLowerCase();
      const storagePath = `founder-docs/${engagementId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const [{ storage }, { ref, uploadBytes }] = await Promise.all([
        import('../firebase/firebase.js'),
        import('https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js'),
      ]);
      await uploadBytes(ref(storage, storagePath), blob, { contentType: blob.type || undefined });
      payload = { idToken: token, engagementId, docType, file: { name }, storagePath };
    } else {
      prog('Reading ' + name + '…');
      payload = { idToken: token, engagementId, docType, file: { name, dataBase64: await readFileB64(blob) } };
    }
    const resp = await fetch('/api/ingest-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(d.detail || d.error || ('HTTP ' + resp.status));
    ingested++; landed.push(name);
  }

  for (const file of files) {
    try {
      if (JUNK.test(file.name)) continue;                 // an Office lock stub is not a document
      if (/\.zip$/i.test(file.name)) {
        prog('Opening ' + file.name + '…');
        const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(e => !e.dir && SUPPORTED.test(e.name) && !/(^|\/)(__MACOSX\/|\.)/.test(e.name) && !JUNK.test(e.name));
        if (!entries.length) { skipped.push({ name: file.name, reason: 'No readable documents found inside.' }); continue; }
        for (const entry of entries) { try { await ingestOne(entry.name, await entry.async('blob')); } catch (e) { skipped.push({ name: entry.name, reason: (e && e.message) || String(e) }); } }
      } else {
        await ingestOne(file.name, file);
      }
    } catch (e) {
      skipped.push({ name: file.name, reason: (e && e.message) || String(e) });
    }
  }
  await recordIngestOutcome({ engagementId, skipped, landed });
  return { ingested, skipped };
}

// recordIngestOutcome — a skipped document is a DATA-INTEGRITY fact, not a transient notification. Persisted
// on the engagement so it survives the toast, the page, and the session, and can be surfaced next to the very
// evidence list it is missing from. Re-uploading a document CLEARS its old failure automatically.
// Client SDK: firestore.rules already lets an operator/founder update their engagement (only assessmentSignoff
// / shareLink / assessmentDecision are server-only), so this needs no endpoint — and api/ is at the 12-fn cap.
async function recordIngestOutcome({ engagementId, skipped, landed }) {
  try {
    const data = await import('../firebase/data.js');
    const eng = await data.getEngagement(engagementId);
    const prev = (eng && eng.ingestSkipped) || [];
    // a name that has now landed is no longer missing
    const kept = prev.filter(s => !landed.includes(s.name));
    const at = new Date().toISOString();
    const add = skipped.map(s => ({ name: String(s.name || '').slice(0, 200), reason: String(s.reason || 'Could not be read').slice(0, 300), at }));
    const byName = new Map();
    [...kept, ...add].forEach(s => byName.set(s.name, s));      // latest attempt wins
    const next = [...byName.values()].slice(-30);
    if (JSON.stringify(next) === JSON.stringify(prev)) return;  // nothing changed → no write
    await data.updateEngagement(engagementId, { ingestSkipped: next });
  } catch (e) {
    console.warn('could not record the ingest outcome', e);     // never break an upload over its own bookkeeping
  }
}

// clearSkippedDoc — the operator has dealt with it (re-added elsewhere, or it genuinely doesn't belong).
// ---- ASK THE FOUNDER FOR WHAT THE ROOM IS MISSING ---------------------------
// The server derives the list from a FRESH room check and sends it; nothing the caller passes decides what
// is asked for. Shared because the setup panel and the assistant's proposal card both need it, and two
// copies would eventually ask for two different things.
export async function requestDocs({ engagementId, email } = {}) {
  const token = await idToken();
  const resp = await fetch('/api/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'docs-request', idToken: token, engagementId, email }),
  });
  const d = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(d.error === 'nothing_missing'
      ? 'The room already has everything the score looks for.'
      : (d.detail || d.error || ('Could not send (' + resp.status + ')')));
  }
  return d;
}

// ---- RE-SCAN A LINKED GOOGLE DRIVE DATA ROOM -------------------------------
// The founder drops documents into the folder after the room was first read; nothing tells the Workspace
// that happened. This re-lists the folder, reads ONLY what is new or changed, and re-runs the room check.
// Shared because two places need it — the new-assessment panel (first link, then return visits) and the
// engagement page (where the action queue sends the operator when the watchdog spots new files). One
// implementation means the two can never drift into reading the room differently.
//
// Returns { added, changed, removed, unchanged, failed, check } — never throws for a Drive-side problem;
// it toasts and returns null, so a caller can repaint without wrapping every call.
// roomCheck — what the score looks for, and what it could not find. FREE: regex over already-ingested
// text, no model, no cost, instant. It is the engagement loop (add documents, re-scan, watch coverage
// fill), so it is deliberately unmetered — the expensive thing is re-SCORING, not re-reading.
export async function roomCheck({ engagementId } = {}) {
  const token = await idToken();
  const r = await fetch('/api/ingest-docs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'room-check' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || ('HTTP ' + r.status));
  return d;
}

// addToRoom — THE ONE WAY ANYTHING ENTERS A DATA ROOM. Uploaded files, a linked Drive folder, or both.
//
// WHY IT EXISTS. The Drive read ingested all 46 documents and only then ran the room check, so the ticks
// all appeared together at the very end and the only sign of life in between was one line of small grey
// text. For most of a minute the screen looked broken. The room check is FREE — regex over text that is
// already ingested, no model, no cost — so there is no reason to run it once at the end. Run it as the
// evidence arrives and the list ticks itself.
//
// IT IS SHARED ON PURPOSE. The create screen, the Data Room tab's uploader and the Data Room tab's Drive
// field all call this. A pre-screened assessment has to behave identically wherever it is driven from and
// whatever licence the org holds — three copies of "ingest then check" is exactly how one of them ends up
// silent again.
//
//   onProgress(text, {done, total, current})   real counts, never a fabricated percentage
//   onRoom(check, {done, total})               fires every `roomEvery` files AND once at the end
//   onFile({index, name, ok})                  per-file outcome, so a staged list can tell the truth
//                                              about which ones actually landed rather than all of them
//                                              claiming "Stored" the moment they were chosen
export async function addToRoom({ engagementId, files = [], folderUrl = '', onProgress, onRoom, onFile, roomEvery = null } = {}) {
  const prog = onProgress || (() => {});
  const token = await idToken();
  const post = (body) => fetch('/api/ingest-docs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, ...body }),
  });

  // Resolve the Drive folder into a list first, so `total` is REAL before the first file is read. A
  // progress bar that does not know its denominator is a spinner wearing a bar's clothes.
  let drive = [], folderName = '', skipped = 0;
  if (folderUrl) {
    prog('Opening the Drive folder…', { done: 0, total: 0 });
    const lr = await post({ action: 'drive-list', folderUrl });
    const list = await lr.json().catch(() => ({}));
    if (!lr.ok) {
      throw new Error(list.error === 'drive_not_shared'
        ? 'Could not open that folder. Check the link, and that it is shared — either “anyone with the link can view”, or with dataroom-reader@ventrify-os.iam.gserviceaccount.com as Viewer.'
        : list.error === 'bad_folder_link' ? 'That does not look like a Google Drive folder link.'
        : list.error === 'drive_not_configured' ? 'The Drive reader is not configured on this environment yet.'
        : (list.detail || list.error || 'Could not read the folder.'));
    }
    drive = list.files || [];
    folderName = list.folderName || '';
    skipped = (list.skipped || []).length;
    if (!drive.length && !files.length) throw new Error('That folder has no readable documents in it.');
  }

  const units = [
    ...files.map(f => ({ name: f.name, local: f })),
    ...drive.map(d => ({ name: d.name, drive: d })),
  ];
  const total = units.length;
  // The cadence is BOUNDED, not fixed. Every 4 files is right for a 46-document room (a dozen updates);
  // on a 300-document room it would be 75 extra round trips to tell someone the same thing. Roughly a
  // dozen updates whatever the size, and never less often than every 4 files.
  const every = roomEvery || Math.max(4, Math.ceil(total / 12));
  let failed = 0, lastCheck = null;

  const check = async (done) => {
    try {
      const r = await post({ action: 'room-check' });
      if (!r.ok) return;
      const c = await r.json().catch(() => null);
      if (c) { lastCheck = c; onRoom && onRoom(c, { done, total }); }
    } catch (e) { /* a failed free check must never abort an ingest that is working */ }
  };

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    prog(`Reading ${i + 1} of ${total} · ${String(u.name).slice(0, 44)}`, { done: i, total, current: u.name });
    let ok = true;
    try {
      if (u.local) {
        const r = await ingestDocs({ engagementId, files: [u.local], docType: 'dataroom' });
        ok = !((r && r.skipped || []).length);
      } else {
        const d = u.drive;
        const r = await post({ docType: 'dataroom', file: { name: d.name, driveId: d.driveId, exportMime: d.exportMime, driveModified: d.modifiedTime } });
        ok = r.ok;
      }
    } catch (e) { ok = false; }
    if (!ok) failed++;
    onFile && onFile({ index: i, name: u.name, ok, local: !!u.local });
    // Tick the list as the evidence lands, not once at the end. Batched because the check is a round
    // trip: every single file would spend more time checking than reading.
    if ((i + 1) % every === 0 && i + 1 < total) await check(i + 1);
  }

  prog('Checking what the score can see…', { done: total, total });
  await check(total);
  return { total, ingested: total - failed, failed, skipped, folderName, check: lastCheck };
}

// unlockFull — promote a pre-screened engagement to the paid tier. With BILLING_ENFORCED false this is
// the whole "purchase": the server flips the tier and the caller dispatches the run. When Stripe lands,
// a payment confirmation calls the same endpoint and nothing else about the flow changes.
export async function unlockFull({ engagementId } = {}) {
  const token = await idToken();
  const r = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'prescreen-unlock' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || ('HTTP ' + r.status));
  return d;
}

export async function rescanDataRoom({ engagementId, onProgress, onBusy } = {}) {
  const prog = onProgress || (() => {});
  const busy = onBusy || (() => {});
  busy(true);
  try {
    const token = await idToken();
    const post = (body) => fetch('/api/ingest-docs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, engagementId, ...body }),
    });

    prog('Checking the folder…');
    const dr = await post({ action: 'drive-diff' });
    const diff = await dr.json().catch(() => ({}));
    if (!dr.ok) {
      // Drive answers identically for "no such folder" and "not shared with us", so the message covers both.
      throw new Error(diff.error === 'drive_not_shared'
        ? 'Could not open the folder. Check it is still shared with the data-room reader.'
        : diff.error === 'no_room_linked' ? 'No Google Drive folder is linked to this assessment.'
        : (diff.detail || diff.error || ('HTTP ' + dr.status)));
    }

    const work = [...(diff.added || []), ...(diff.changed || [])];
    let failed = 0;
    for (let i = 0; i < work.length; i++) {
      const d = work[i];
      prog(`Reading new documents · ${i + 1} of ${work.length} · ${d.name.slice(0, 40)}`);
      const r = await post({ docType: 'dataroom', file: { name: d.name, driveId: d.driveId, exportMime: d.exportMime, driveModified: d.modifiedTime } });
      if (!r.ok) failed++;
    }

    // Only worth re-deriving when something actually landed.
    let check = null;
    if (work.length > failed) {
      prog('Re-checking what the score will look for…');
      const cr = await post({ action: 'room-check' });
      if (cr.ok) check = await cr.json().catch(() => null);
    }
    return { added: diff.added || [], changed: diff.changed || [], removed: diff.removed || [], unchanged: diff.unchanged || 0, failed, check };
  } catch (e) {
    window.__toast('Could not check the folder: ' + ((e && e.message) || e), true);
    return null;
  } finally {
    busy(false); prog(null);
  }
}

// What a re-scan actually did, in one line — so both callers report it identically.
export function rescanSummary(r) {
  if (!r) return '';
  const bits = [];
  if (r.added.length) bits.push(`${r.added.length} new`);
  if (r.changed.length) bits.push(`${r.changed.length} updated`);
  if (r.removed.length) bits.push(`${r.removed.length} no longer in the folder`);
  if (r.failed) bits.push(`${r.failed} could not be read`);
  if (!r.added.length && !r.changed.length) {
    return `Nothing new — ${r.unchanged} document${r.unchanged === 1 ? '' : 's'} unchanged` + (r.removed.length ? ` · ${r.removed.length} no longer in the folder` : '') + '.';
  }
  return 'Read ' + bits.join(' · ') + '.';
}

export async function clearSkippedDoc({ engagementId, name = null } = {}) {
  const data = await import('../firebase/data.js');
  const eng = await data.getEngagement(engagementId);
  const prev = (eng && eng.ingestSkipped) || [];
  const next = name ? prev.filter(s => s.name !== name) : [];
  await data.updateEngagement(engagementId, { ingestSkipped: next });
  return next;
}

// ---- operator sign-off (VERBATIM /api/memo action:sign|revoke-sign) — server stamps the verified identity ----
export async function signOff({ engagementId, note = null } = {}) {
  const token = await idToken();
  if (!token) throw new Error('Please sign in again.');
  const resp = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'sign', note })
  });
  const d = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(d.detail || d.error || ('Sign-off failed (' + resp.status + ')'));
  return d.signoff || null;
}
export async function revokeSignoff({ engagementId } = {}) {
  const token = await idToken();
  if (!token) throw new Error('Please sign in again.');
  const resp = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'revoke-sign' })
  });
  if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || d.error || ('Revoke failed (' + resp.status + ')')); }
}

// ---- operator decision — confirm / decline the assessed deal (VERBATIM /api/memo action:decide|revoke-decision) ----
export async function decide({ engagementId, decision, note = null } = {}) {
  const token = await idToken();
  if (!token) throw new Error('Please sign in again.');
  const resp = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'decide', decision, note })
  });
  const d = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(d.detail || d.error || ('Decision failed (' + resp.status + ')'));
  return d.decision || null;
}
export async function revokeDecision({ engagementId } = {}) {
  const token = await idToken();
  if (!token) throw new Error('Please sign in again.');
  const resp = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'revoke-decision' })
  });
  if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || d.error || ('Revoke failed (' + resp.status + ')')); }
}

// ---- shareable memo link (VERBATIM /api/memo action:share|revoke-share) ----
// The caller builds the memo html via memo-view.dealMemoHTML(p, snap, org, {shared:true}) and passes it.
export async function shareMemo({ engagementId, html, meta } = {}) {
  const token = await idToken();
  if (!token) throw new Error('Please sign in again.');
  const resp = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'share', html, meta })
  });
  const d = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(d.detail || d.error || ('Share failed (' + resp.status + ')'));
  return d;   // { token, url }
}
export async function revokeShare({ engagementId } = {}) {
  const token = await idToken();
  if (!token) throw new Error('Please sign in again.');
  const resp = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, engagementId, action: 'revoke-share' })
  });
  if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.error || ('Revoke failed (' + resp.status + ')')); }
}

// ---- FILE EVIDENCE against a gap the assessment could not close -------------------------------------
//
// The operator supplies a POINTER TO EVIDENCE, not a claim about evidence. He does not say "trust me, he is
// legit" — he says "you looked in the wrong place, here is the page". Nothing here asserts a conclusion, and
// nothing here can: the record carries a url or an artefact, and the SYSTEM decides what it means.
//
// NOTHING IS FETCHED HERE, and nothing is fetched by the scorer either (score-only.js pins --tools to
// Read/Glob/Grep/Write with a scrubbed env — it CANNOT browse). The fetch happens in the RUNNER, an entire
// phase before scoring, by a plain HTTP GET with no model in the path. This is a pure Firestore write.
// ONE RECORD PER POINTER. `urls` may hold several: an operator closing a gap often has the register entry AND
// the filing that corroborates it. Filing them as one record would mean one fetch, one content-hash and one
// provenance line for several distinct sources — so each becomes its own record instead. The runner needs no
// change: pull-operator-evidence already iterates every record filed against the engagement, fetches each
// independently, and hashes each on its own bytes.
//
// `url` (singular) is still accepted so no existing caller breaks.
export async function fileEvidence({ engagementId, gapId, url = null, urls = null, file = null, note = null } = {}) {
  const data = await import('../firebase/data.js');
  const W = window.WORKSPACE || {};
  const me = (W.helpers && W.helpers.currentOperator && W.helpers.currentOperator()) || {};
  const filedBy = me.email || me.name || null;

  const list = (Array.isArray(urls) ? urls : (url ? [url] : [])).map(u => String(u || '').trim()).filter(Boolean);

  // The upload rides on its OWN record too — it is a different KIND of evidence (operator-authored, no
  // third-party tamper-evidence) and the runner's refute-only clamp keys off that. Folding it into a URL
  // record would blur the one distinction the clamp depends on.
  let uploadRec = null;
  if (file) {
    const up = await data.uploadEvidenceFile(engagementId, file);
    uploadRec = { storagePath: up.storagePath, rawExt: up.rawExt, originalName: file.name || null };
  }

  const out = [];
  for (const u of list) {
    out.push(await data.fileOperatorEvidence(engagementId, {
      gapId, url: u, storagePath: null, rawExt: null, originalName: null, note, filedBy,
    }));
  }
  if (uploadRec) {
    out.push(await data.fileOperatorEvidence(engagementId, {
      gapId, url: null, ...uploadRec, note, filedBy,
    }));
  }
  return out;
}

// ---- RE-SCORE on the filed evidence (the SAME dispatch path — phase:'rescore', no new api/ file) ----
// run-phase.js routes on VENTRIFY_PHASE and returns BEFORE it needs a Claude CLI: no assess agent re-runs.
// It restores the research this score was derived from, fetches the operator's records, and scores all 35
// signals again COLD (3 independent draws, median, quorum of 2). ~25 minutes, not ~2 hours.
export async function rescore({ engagementId, onBusy } = {}) {
  const busy = onBusy || (() => {});
  busy(true);
  try {
    const token = await idToken();
    if (!token) throw new Error('Please sign in again.');
    const resp = await fetch('/api/dispatch-run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, engagementId, phase: 'rescore' })
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.detail || d.error || ('Re-score rejected (' + resp.status + ')')); }
    return true;
  } catch (e) {
    window.__toast('Could not re-score: ' + ((e && (e.code || e.message)) || e), true);
    busy(false);
    return false;
  }
}

// ---- delete engagement (VERBATIM data.deleteEngagementDeep) — caller does the confirm + redirect ----
export async function deleteEngagement({ engagementId } = {}) {
  const data = await import('../firebase/data.js');
  await data.deleteEngagementDeep(engagementId);
}

// ---- download the branded deal memo (opens a print window) ----
export function downloadMemo({ p, snap, org } = {}) {
  try {
    const html = dealMemoHTML(p, snap, org);
    const w = window.open('', '_blank');
    if (!w) { window.__toast('Please allow pop-ups for this site to download the deal memo.', true); return; }
    w.document.open(); w.document.write(html); w.document.close();
  } catch (e) { window.__toast('Could not build the deal memo: ' + ((e && e.message) || e), true); }
}
