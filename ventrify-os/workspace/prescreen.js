// ============================================================
// Ventrify OS — pre-screen orchestration (browser side).
//
// WHY THE BROWSER DRIVES THIS. Vercel Hobby caps one invocation at 60s and the whole run is longer, so it
// cannot be a single call. The constraint produces the better UX anyway: the page warms the cache once,
// then fans out one invocation per category, and each one paints the moment it lands. Nobody experiences
// this as a 50-second wait — they watch a page fill up.
//
// IT ORCHESTRATES TIMING AND NOTHING ELSE. Every score is produced AND stored server-side
// (api/memo.js prescreen-category), and the range is composed server-side from what was stored
// (prescreen-finalise). No number crosses this file. The score is the thing being sold; a client that
// carried it between calls could edit it.
//
// LEAD WITH THE ROOM CHECK. It is regex over already-ingested text: free, instant, and genuinely useful.
// It is on screen in under a second and it buys the entire rest of the run.
// ============================================================

import { auth } from '../firebase/firebase.js';

// How many CATEGORY invocations run at once. Each one is 3 model calls, each re-sending the whole
// corpus, so the real unit is TOKENS PER MINUTE, not requests.
//
// MEASURED, not guessed any more. The containment replay hit the account's ceiling immediately:
//   "This request would exceed your rate limit of 500,000 input tokens per minute"
// At a 40,000-token corpus one category costs ~120,000 input tokens, so the account affords about four
// categories a minute — and FANOUT 4 sat exactly on that line, which is where throttling starts, not
// where it is safe. Two leaves headroom for the cache write and for a second assessment running at the
// same time, which a real workspace will have.
//
// THIS IS THE BINDING CONSTRAINT ON THE LATENCY PROMISE, not the model's speed. Raising the account's
// tokens-per-minute limit, not tuning this number, is what buys the run back under two minutes.
const FANOUT = 2;

const CATEGORIES = ['market', 'team', 'product', 'moat', 'financial', 'execution', 'evidence'];

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

// Run the categories `FANOUT` at a time, calling back as each one lands rather than when all are done —
// the whole point is that the page fills in while the run is still going.
async function fanOut(engagementId, onCategory) {
  const queue = CATEGORIES.slice();
  const done = [];
  const worker = async () => {
    for (;;) {
      const key = queue.shift();
      if (!key) return;
      let out;
      try {
        out = await post({ engagementId, action: 'prescreen-category', category: key });
      } catch (e) {
        // A 429 means fast mode's own rate limit, not a failure. Wait the server's retry-after and try
        // ONCE more. We never fall back to standard speed: switching speed invalidates the prompt cache,
        // so a silent downgrade would make every remaining probe pay full uncached price.
        if (e.status === 429) {
          const wait = Math.min(20000, ((e.body && e.body.retryAfter) || 5) * 1000);
          await new Promise(r => setTimeout(r, wait));
          out = await post({ engagementId, action: 'prescreen-category', category: key });
        } else { throw e; }
      }
      done.push(out);
      onCategory && onCategory(out, done.length, CATEGORIES.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(FANOUT, CATEGORIES.length) }, worker));
  return done;
}

/**
 * The whole run.
 *
 * @param {object} o
 *   engagementId
 *   onPhase(text)              a real phase, never a fabricated percentage
 *   onRoom(check)              the free room check, within about a second
 *   onCategory(result, n, of)  fires as each category lands
 *   onDone(prescreen)          the composed range, as the SERVER computed it
 * @returns the server's snapshot
 */
export async function runPrescreen({ engagementId, onPhase, onRoom, onCategory, onDone } = {}) {
  const phase = onPhase || (() => {});

  // 1 — THE ROOM CHECK. $0, instant, and the thing that makes the wait feel like progress.
  phase('Reading your data room…');
  try {
    const EA = await import('./engagement-actions.js');
    const check = await EA.roomCheck({ engagementId });
    onRoom && onRoom(check);
  } catch (e) { /* non-fatal: the room check is a courtesy, not a dependency of the score */ }

  // 2 — WARM THE CACHE, and wait for it. Fanning out cold means every probe starts before any has
  // finished writing the cache, so all of them miss and the run costs ~5x its budget (spec §6, trap 3).
  phase('Reading the deck…');
  const warm = await post({ engagementId, action: 'prescreen-warm' });
  if (warm.corpus && warm.corpus.dropped && warm.corpus.dropped.length) {
    phase(`Reading ${warm.corpus.included} of ${warm.corpus.total} documents — the pre-screen reads your deck and the first ${warm.corpus.included}.`);
  }

  // 3 — THE SEVEN CATEGORIES.
  phase('Scoring against the rubric…');
  await fanOut(engagementId, onCategory);

  // 4 — COMPOSE, server-side, from what the server stored.
  phase('Working out your range…');
  const out = await post({ engagementId, action: 'prescreen-finalise' });
  onDone && onDone(out.prescreen);
  return out.prescreen;
}

export { CATEGORIES, FANOUT };
