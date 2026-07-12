/**
 * POST /api/dispatch-run — fire a cloud engagement run on GitHub Actions.
 *
 * The Workspace "Run research agents" click calls this. We verify the caller is
 * an operator of the engagement's org (or super-admin), stamp runState=queued so
 * the UI updates immediately, then dispatch the runner workflow with the
 * engagement_id. The Action runs the real cloud:run pipeline on the Claude
 * subscription and reports progress back to runState — no operator machine
 * needed.
 *
 * Body: { idToken, engagementId, phase? }
 * Env (os.ventrify.io Vercel project):
 *   FIREBASE_SERVICE_ACCOUNT  — service-account JSON (already set)
 *   GITHUB_DISPATCH_TOKEN     — fine-grained PAT w/ actions:write on the runner repo
 *   GITHUB_RUNNER_REPO        — "owner/repo" of the runner repo
 *   GITHUB_RUNNER_WORKFLOW    — workflow file name (default run-phase.yml)
 *   GITHUB_RUNNER_REF         — branch to run (default main)
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const phase = String(body.phase || 'research');
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }

    const repo = process.env.GITHUB_RUNNER_REPO;
    const workflow = process.env.GITHUB_RUNNER_WORKFLOW || 'run-phase.yml';
    const ref = process.env.GITHUB_RUNNER_REF || 'main';
    const ghToken = process.env.GITHUB_DISPATCH_TOKEN;
    if (!repo || !ghToken) { res.status(503).json({ error: 'dispatch_not_configured' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const engSnap = await db.collection('engagements').doc(engagementId).get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const orgId = engSnap.data().orgId || 'default';

    // Authz — operator of this engagement's org, or super-admin. (Isolation: a
    // caller can only trigger runs for engagements in their own org.)
    const [orgSnap, cfgSnap] = await Promise.all([
      db.collection('organisations').doc(orgId).get(),
      db.doc('app/config').get()
    ]);
    const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
    const supers = ((cfgSnap.exists && cfgSnap.data().superAdminEmails) || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller) && !supers.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    const engData = engSnap.data();

    // ── STOP A RUN — action:'cancel'. Folded in here rather than a new api/ file: Vercel is at the
    //    12-FUNCTION CAP and a 13th breaks the whole deploy (api/memo.js multiplexes the same way).
    //    ⚠ Branch on `action`, NEVER on `phase` — `phase` is piped straight into the workflow inputs below,
    //    so `phase:'cancel'` would DISPATCH a garbage run instead of stopping one.
    //    It sits AFTER the authz block on purpose, so a cancel inherits the same org-isolation guarantee.
    if (String(body.action || '') === 'cancel') {
      const rs = engData.runState || {};
      const runId = rs.githubRunId;
      // A TRUE stop, or none. Writing runState and abandoning the job would be WORSE than no stop: the
      // orphaned Action still finishes, still publishes the verdict, still emails "your assessment is
      // ready", and still holds the concurrency group so the re-run sits pending behind it.
      if (!runId) {
        res.status(409).json({ error: 'not_stoppable', detail: 'This run hasn’t reported its job id yet — give it a moment, then try again.' });
        return;
      }
      const kill = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      // 202 = cancelling. 409 = already finished / not cancellable — a race between the operator's click and
      // the runner's final write, which is EXPECTED, so treat it as success rather than shouting at them.
      if (kill.status !== 202 && kill.status !== 409) {
        const detail = await kill.text();
        res.status(502).json({ error: 'cancel_failed', status: kill.status, detail: detail.slice(0, 300) });
        return;
      }
      // The job is dead, so nothing will ever write a terminal state for it — a cancelled run is NOT a
      // failed run, so the workflow's `if: failure()` mark-failed step never fires either. We must clear the
      // spinner ourselves. Dot-paths (like the stuck-run watchdog) preserve step/totalSteps for the audit.
      // 'idle' — NOT 'error': there is nothing to republish (a cancelled job dies before it publishes
      // anything), so offering Republish would dead-end the operator. 'idle' needs zero new UI: the page
      // falls straight back to "Ready to run".
      await db.collection('engagements').doc(engagementId).update({
        'runState.status': 'idle',
        'runState.label': `Stopped by ${caller}`,
        'runState.cancelledAt': new Date().toISOString(),
        'runState.cancelledBy': caller,
        'runState.finishedAt': new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).json({ ok: true, cancelled: runId, alreadyFinished: kill.status === 409 });
      return;
    }

    // Gate: an assessment cannot run without a pitch deck — it underpins the ask
    // and the whole thesis. (The data room is supplementary evidence.)
    if (engData.engagementType === 'assessment' && phase === 'assess' && !engData.pitchDoc) {
      res.status(400).json({ error: 'pitch_required', detail: 'Add the pitch deck before running the assessment.' });
      return;
    }

    // Stamp runState=queued so the Workspace banner moves immediately.
    await db.collection('engagements').doc(engagementId).update({
      runState: {
        status: 'queued', phase, step: 0, totalSteps: 0, progress: 0,
        label: 'Queued — dispatching the cloud runner…',
        requestedBy: caller, requestedAt: new Date().toISOString()
      },
      updatedAt: FieldValue.serverTimestamp()
    });

    // Fire the GitHub Action.
    const gh = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref, inputs: { engagement_id: engagementId, phase } })
    });

    if (gh.status !== 204) {
      const detail = await gh.text();
      // Roll back the queued state so the UI doesn't hang.
      await db.collection('engagements').doc(engagementId).update({
        'runState.status': 'error',
        'runState.error': 'Could not dispatch the cloud runner (' + gh.status + ').',
        'runState.finishedAt': new Date().toISOString()
      });
      res.status(502).json({ error: 'dispatch_failed', status: gh.status, detail });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
