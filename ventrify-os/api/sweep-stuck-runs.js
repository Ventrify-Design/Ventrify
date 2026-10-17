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

const drive = require('./_drive.js');

// ── WATCHING A LINKED DATA ROOM ───────────────────────────────────────────────────────────────────────
// The founder is emailed a list of missing documents and drops them into the Drive folder. Nothing told the
// Workspace that happened, so the operator had to think to go and look. This pass notices.
//
// It rides the watchdog's existing 15-minute ping rather than adding a function (the project is at its
// 12-function cap) or a second schedule. The per-room cooldown below means Drive is polled about hourly
// however often the endpoint is hit — which also stops an open endpoint being a way to burn Drive quota.
const ROOM_COOLDOWN_MS = 55 * 60 * 1000;     // ~hourly per room, regardless of ping frequency
const ROOM_DORMANT_MS = 30 * 24 * 60 * 60 * 1000;  // stop watching a room nobody has touched in a month
const ROOM_MAX_PER_PING = 3;                 // a Drive walk is seconds, and the watchdog must still answer
// Hard wall-clock stop, well inside the 60s this function declares in vercel.json. Measured: walking a
// 46-document nested room costs ~5s, so three rooms plus pass 1 lands around 20s. Anything that does not
// fit is deferred to the next ping rather than risking a timeout mid-write.
const ROOM_BUDGET_MS = 40000;

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

    // ── PASS 2: have any linked data rooms gained documents? ──────────────────────────────────────
    let roomsChecked = 0, roomsChanged = 0, roomsSkipped = 0, roomsDeferred = 0;
    if (process.env.DRIVE_SERVICE_ACCOUNT) {
      const deadline = Date.now() + ROOM_BUDGET_MS;
      // Engagements are few and the field is nested; a scan is cheaper and simpler than an index here.
      const all = await db.collection('engagements').get();

      const due = [];
      for (const doc of all.docs) {
        const d = doc.data();
        const room = d.dataRoom || {};
        if (!room.folderId) continue;
        if (ACTIVE.includes((d.runState || {}).status)) { roomsSkipped++; continue; }   // never nag mid-run
        // Dormancy counts only HUMAN activity — linking the room, chasing the founder, any write to the
        // engagement. NOT lastCheckedAt: that is this sweep's own write, so counting it would keep every
        // room looking freshly touched and this cutoff would never fire.
        const touched = [toMs(room.linkedAt), toMs(room.lastRequestAt), toMs(d.updatedAt)]
          .filter(Number.isFinite).sort((a, b) => b - a)[0];
        if (Number.isFinite(touched) && now - touched > ROOM_DORMANT_MS) { roomsSkipped++; continue; }
        const lastCheck = toMs(room.lastCheckedAt);
        if (Number.isFinite(lastCheck) && now - lastCheck < ROOM_COOLDOWN_MS) { roomsSkipped++; continue; }
        due.push({ ref: doc.ref, room, since: Number.isFinite(lastCheck) ? lastCheck : 0 });
      }
      // Least-recently-checked first, so no room can starve behind the same few every ping.
      due.sort((a, b) => a.since - b.since);

      for (const item of due) {
        // Whatever does not fit this ping is first in line on the next one, 15 minutes away. Deferring is
        // always safe: the next check re-derives the same answer from the folder.
        if (roomsChecked >= ROOM_MAX_PER_PING || Date.now() > deadline) { roomsDeferred++; continue; }
        roomsChecked++;
        try {
          const { files } = await drive.listFolder(item.room.folderId);
          const have = new Map();
          (await item.ref.collection('founderDocs').get()).docs.forEach(x => {
            const v = x.data(); have.set(v.name, v.driveModified || null);
          });
          const added = files.filter(f => !have.has(f.name));
          const changed = files.filter(f => have.has(f.name) && have.get(f.name) && f.modifiedTime && have.get(f.name) !== f.modifiedTime);

          const patch = {
            'dataRoom.lastCheckedAt': new Date().toISOString(),
            'dataRoom.lastError': FieldValue.delete(),   // a room that reads again is no longer broken
          };
          if (added.length || changed.length) {
            // Keep the ORIGINAL detectedAt while the set is unchanged, so the operator sees how long the
            // documents have been sitting there rather than a timestamp that resets itself every hour.
            const prev = item.room.pending;
            const same = prev && prev.added === added.length && prev.changed === changed.length;
            patch['dataRoom.pending'] = {
              added: added.length, changed: changed.length,
              names: [...added, ...changed].slice(0, 8).map(f => f.name),
              detectedAt: (same && prev.detectedAt) || new Date().toISOString(),
            };
            roomsChanged++;
          } else {
            // DERIVED STATE, NOT AN EVENT. The flag means "the room holds documents we have not read" — so
            // once they are read it has to go, or the queue keeps chasing evidence that is already scored.
            // Clearing it here makes the flag self-heal even if whatever ingested them forgot to.
            patch['dataRoom.pending'] = FieldValue.delete();
          }
          await item.ref.update(patch);
        } catch (e) {
          // A folder that was un-shared or deleted must not break the sweep for everyone else. Record it so
          // the operator can see WHY their room stopped updating, rather than it just going quiet.
          await item.ref.update({
            'dataRoom.lastCheckedAt': new Date().toISOString(),
            'dataRoom.lastError': String((e && e.message) || e).slice(0, 200),
          }).catch(() => {});
        }
      }
    }

    res.status(200).json({ ok: true, checked, flipped, roomsChecked, roomsChanged, roomsSkipped, roomsDeferred });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
