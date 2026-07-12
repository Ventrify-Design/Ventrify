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
  let ingested = 0; const skipped = [];   // never silently dropped
  const landed = [];                      // names that actually made it — these CLEAR any prior failure

  async function ingestOne(name, blob) {
    let payload;
    if (blob.size > 4 * 1024 * 1024) {
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
      if (/\.zip$/i.test(file.name)) {
        prog('Opening ' + file.name + '…');
        const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(e => !e.dir && SUPPORTED.test(e.name) && !/(^|\/)(__MACOSX\/|\.)/.test(e.name));
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
