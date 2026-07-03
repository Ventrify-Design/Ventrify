/**
 * POST /api/sweep-stuck-runs — the stuck-run watchdog.
 *
 * The engagement runner lives out-of-repo (GitHub Actions -> headless Claude) and
 * only writes progress while it is alive. If it crashes, is reclaimed, or never
 * starts, runState stays 'queued' / 'running' / 'partial' forever — the operator is
 * stuck on a spinner they can't escape, and the recoverable error banner never fires
 * because nothing writes status='error'. This sweep flips genuinely-dead runs to
 * 'error' so the Workspace's republish / re-run banner takes over. Durable
 * server-side complement to the client-side stall guard in program.html.
 *
 * SAFETY — never kill a healthy run:
 * Staleness is measured from the LAST write to the engagement doc (updatedAt), NOT
 * from when the run started. A run that is actively writing progress is therefore
 * never touched, no matter how long it legitimately takes. We only flip a run that
 * has gone SILENT past the window below. (The runner must bump the engagement's
 * updatedAt on each progress write — dispatch-run.js already does at queue time.)
 *   - queued          silent > 8 min   → never picked up by the runner
 *   - running/partial  silent > 30 min  → runner died mid-run (no progress in 30 min)
 *
 * Trigger: a GitHub Actions schedule POSTs here every ~15 min. Auth is OPTIONAL —
 * the endpoint is open by default (safe: the sweep only cleans up runs that are
 * already dead, and exposes nothing). Set CRON_SECRET in the Vercel env at any time
 * to lock it; the workflow already sends the bearer, so it keeps working.
 * Env: FIREBASE_SERVICE_ACCOUNT (already set), CRON_SECRET (optional).
 */
const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const STALE_QUEUED_MS = 8 * 60 * 1000;    // queued and silent → never picked up
const STALE_ACTIVE_MS = 30 * 60 * 1000;   // running/partial and silent → runner died
const ACTIVE = ['queued', 'running', 'partial'];

// Accept both an ISO string (requestedAt/startedAt) and a Firestore Timestamp
// (updatedAt / serverTimestamp) — returns epoch ms, or NaN if unparseable.
function toMs(t) {
  if (t == null) return NaN;
  if (typeof t.toMillis === 'function') return t.toMillis();
  const p = Date.parse(t);
  return Number.isFinite(p) ? p : NaN;
}

module.exports = async (req, res) => {
  // Optional lock: if CRON_SECRET is set, require it; otherwise the endpoint is open.
  // Safe to leave open — the sweep can only flip runs that are ALREADY dead (silent
  // past the window); it can't touch a healthy run, read/expose data, or delete
  // anything. To lock it later, just set CRON_SECRET in the Vercel env (no code change).
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers.authorization || '') !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    ensureAdmin();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;
    const now = Date.now();

    const snap = await db.collection('engagements').where('runState.status', 'in', ACTIVE).get();

    let checked = 0, flipped = 0;
    for (const doc of snap.docs) {
      checked++;
      const d = doc.data();
      const rs = d.runState || {};
      const status = rs.status;

      // Last activity = most recent of (doc updatedAt, run startedAt, run requestedAt).
      // Using updatedAt errs SAFE: any recent write keeps the run alive.
      const lastMs = [toMs(d.updatedAt), toMs(rs.startedAt), toMs(rs.requestedAt)]
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0];
      if (!Number.isFinite(lastMs)) continue;   // nothing to age against — leave it

      const idle = now - lastMs;
      const threshold = status === 'queued' ? STALE_QUEUED_MS : STALE_ACTIVE_MS;
      if (!(idle > threshold)) continue;        // still active (or fresh) — leave it

      // Dot-path update preserves the rest of runState (step/totalSteps/requestedAt).
      await doc.ref.update({
        'runState.status': 'error',
        'runState.error': status === 'queued'
          ? 'The run was never picked up by the engagement runner. Please re-run.'
          : 'The run stopped responding. Any saved results can be republished; otherwise re-run.',
        'runState.finishedAt': new Date().toISOString(),
        'runState.stalledBy': 'watchdog',
        updatedAt: FieldValue.serverTimestamp(),
      });
      flipped++;
    }

    res.status(200).json({ ok: true, checked, flipped });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
