// ============================================================
// Ventrify OS — pre-screen v2 orchestration (browser side).
//
// Spec: design/prescreen-v2-spec.md §6.5. Four phases, driven from here because Vercel Hobby caps one
// invocation at 60s and the whole run is longer. The constraint produces the better UX anyway: every
// phase paints the moment it lands, so nobody experiences this as a wait — they watch an analyst think.
//
// IT ORCHESTRATES TIMING AND NOTHING ELSE. The brief, the sources, every verified point and the band are
// all produced AND stored server-side (api/memo.js, the ps2-* actions). Nothing that decides an outcome
// crosses this file, because a client that carried it between calls could edit it.
//
// WHY THE FAN-OUT IS WIDE NOW. v1 could only run two categories at once: each probe re-sent the whole
// 40,000-token corpus, so one category cost ~120,000 input tokens against an account ceiling of 500,000
// per minute, and FANOUT 4 sat exactly on the line where throttling starts. v2's reasoning calls never
// see the corpus — each is ~6,000 tokens — so all six run together inside the same ceiling with room to
// spare, and two customers can pre-screen at once. That is the distil-once design paying for itself in
// wall-clock rather than only in money.
//
// LEAD WITH THE ROOM CHECK, then the brief. The room check is regex over already-ingested text: free,
// instant, and on screen in under a second. The brief is the first thing that proves we understood the
// business — and §8.2's guardrail, because the customer is the only validator who knows in two seconds
// whether we read them right.
// ============================================================

import { auth } from '../firebase/firebase.js';

// Every reasoning call is small, so this is bounded by nothing we have measured. Six is all of them.
const FANOUT = 6;

// Mirrors api/_prescreen2.js NUGGETS. The engine owns which nuggets exist and which need a second
// document; this list exists only so the page can draw its placeholders before any of them land.
// tools/prescreen2-logic.mjs §18 fails the build if the two stop matching.
const NUGGET_KEYS = ['thesis', 'bull', 'bear', 'competitive', 'team', 'tension'];

async function post(body) {
  const idToken = await auth.currentUser.getIdToken();
  const r = await fetch('/api/memo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, ...body }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || ('HTTP ' + r.status)); e.status = r.status; e.body = d; throw e; }
  return d;
}

// One retry, on a real rate limit only. A 402 is the account's own spend cap and no amount of waiting
// clears it, so it is thrown straight through for the page to name properly — the first live pre-screen
// failures were exactly this, and reading them as "the pre-screen failed" cost an afternoon.
async function postRetrying(body) {
  try { return await post(body); }
  catch (e) {
    if (e.status !== 429) throw e;
    const wait = Math.min(20000, ((e.body && e.body.retryAfter) || 5) * 1000);
    await new Promise(r => setTimeout(r, wait));
    return post(body);
  }
}

// Run the nuggets FANOUT at a time, calling back as each one lands rather than when all are done. The
// whole point is that the page fills in while the run is still going.
//
// ONE NUGGET FAILING DOES NOT FAIL THE RUN. Every slot is optional by design (§8.5), so a dead call
// leaves that card empty and the band is decided from what did land. A page that refuses to render
// because the team read 502'd would be strictly worse than a page without a team read.
async function fanOutNuggets(engagementId, onNugget) {
  const queue = NUGGET_KEYS.slice();
  const landed = [];
  const worker = async () => {
    for (;;) {
      const key = queue.shift();
      if (!key) return;
      let out;
      try { out = await postRetrying({ engagementId, action: 'ps2-nugget', nugget: key }); }
      catch (e) {
        if (e.status === 402) throw e;              // the account's spend cap stops the whole run
        out = { ok: false, nugget: key, failed: e.body && e.body.error || String(e.message || e), points: [] };
      }
      landed.push(out);
      onNugget && onNugget(out, landed.length, NUGGET_KEYS.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(FANOUT, NUGGET_KEYS.length) }, worker));
  return landed;
}

/**
 * The whole run.
 *
 * @param {object} o
 *   engagementId
 *   onPhase(text)                  a real phase, never a fabricated percentage
 *   onRoom(check)                  the free room check, within about a second
 *   onBrief(brief, corpus)         "here is what we understood your venture to be" — §5 item 2
 *   onSources(sources)             what the research pass actually fetched
 *   onNugget(result, n, of)        fires as each finding lands
 *   onDone(snapshot)               the band, as the SERVER decided it
 *   onUnreadable(snapshot)         §3.3 — its own state, off the dial
 * @returns the server's snapshot
 */
export async function runPrescreen2({ engagementId, onPhase, onRoom, onBrief, onSources, onNugget, onDone, onUnreadable } = {}) {
  const phase = onPhase || (() => {});

  // 1 — THE ROOM CHECK. $0, instant, and the thing that makes the wait feel like progress. It is
  // coverage, never a grade (§3.4), and it is deliberately no longer the headline.
  phase('Reading your data room…');
  try {
    const EA = await import('./engagement-actions.js');
    const check = await EA.roomCheck({ engagementId });
    onRoom && onRoom(check);
  } catch (e) { /* non-fatal: the room check is a courtesy, not a dependency of the read */ }

  // 2 — DISTIL. The only call that pays for the corpus, and the single point of failure in the whole
  // design: everything downstream reasons from this and nothing else.
  phase('Reading your documents…');
  const bd = await postRetrying({ engagementId, action: 'ps2-brief' });
  onBrief && onBrief(bd.brief, bd.corpus || null);

  // §3.3 — not enough here to read is NOT the bottom band. The run ends, having cost one cheap call.
  if (bd.done) { onUnreadable && onUnreadable(bd.snapshot); return bd.snapshot; }

  // 3 — LOOK OUTWARD. The only phase that can produce something the founder does not already know,
  // and the reason a deck-only run is still a full run (§4).
  phase('Looking for what the documents don’t say…');
  let sources = [];
  try {
    const rd = await postRetrying({ engagementId, action: 'ps2-research' });
    sources = rd.sources || [];
    onSources && onSources(sources);
  } catch (e) {
    if (e.status === 402) throw e;
    // No research is a thinner read, not a failed one. The competitive card will be honestly empty
    // rather than filled from nothing (§8.5).
    onSources && onSources([]);
  }

  // 4 — REASON. Six calls on the brief, never the corpus.
  phase('Arguing it both ways…');
  await fanOutNuggets(engagementId, onNugget);

  // 5 — THE BAND, decided server-side from the VERIFIED findings only.
  phase('Deciding whether it’s worth assessing…');
  const out = await postRetrying({ engagementId, action: 'ps2-band' });
  onDone && onDone(out.snapshot);
  return out.snapshot;
}

/**
 * §8.8 — the correction path.
 *
 * The customer fixes our misreading of their venture. This never consumes their one scored pre-screen
 * (the server enforces that, not this file), is bounded at two per venture, and invalidates everything
 * downstream — so it re-runs research, the six findings and the band on the corrected brief.
 *
 * @param {object} o  engagementId, fields {oneLine, sector, …}, plus the same callbacks as a run
 * @returns the re-decided snapshot
 */
export async function correctBrief({ engagementId, fields, onPhase, onBrief, onSources, onNugget, onDone } = {}) {
  const phase = onPhase || (() => {});
  phase('Taking your correction…');
  const ed = await post({ engagementId, action: 'ps2-brief-edit', fields });
  onBrief && onBrief(ed.brief, null, { asserted: ed.asserted, editsLeft: ed.editsLeft });

  phase('Looking again, with your version…');
  try {
    const rd = await postRetrying({ engagementId, action: 'ps2-research' });
    onSources && onSources(rd.sources || []);
  } catch (e) { if (e.status === 402) throw e; onSources && onSources([]); }

  phase('Re-arguing it both ways…');
  await fanOutNuggets(engagementId, onNugget);

  phase('Deciding again…');
  const out = await postRetrying({ engagementId, action: 'ps2-band' });
  onDone && onDone(out.snapshot);
  return out.snapshot;
}

export { NUGGET_KEYS, FANOUT };
