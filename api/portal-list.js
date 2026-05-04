/**
 * GET /api/portal-list
 *
 * Returns the hub + section catalogue + per-section feedback status + gate
 * sign-offs + content metadata for the authenticated client. portal-app.html
 * consumes this to render the landing page with status badges, the hero
 * metric strip, and the project overview card.
 *
 * For investor scope, only the Financials hub is returned (sensitive sections
 * like scope-change-recommendations.md are filtered out).
 */

const { loadClients, requireAuth, ghFetch, ghReadFile, hubsForScope, readProvocations } = require('./_lib');

// Per-card status derivation for the data-room L1 layer. A card is:
//   'commented'    — founder has left a free-text comment
//   'acknowledged' — founder has clicked the acknowledge button (no input)
//   'open'         — no founder input yet
function deriveCardStatus(provocationComments, hubSlug, cardId) {
  const items = (provocationComments || []).filter(c => c.hub === hubSlug && c.cardId === cardId);
  if (items.length === 0) return 'open';
  if (items.some(c => c.kind === 'comment')) return 'commented';
  return 'acknowledged';
}

// Reduce the per-section status to a single label the UI can render as a badge.
// `feedback` is the array from portal-feedback.json. Returns one of:
//   'approved'        — at least one open or addressed 'looks-good' rating
//   'needs-rework'    — at least one open 'needs-rework' rating
//   'has-feedback'    — at least one open 'has-feedback' rating
//   'addressed'       — only addressed/wont-fix items, no open
//   'pending'         — no feedback at all
function deriveSectionStatus(feedback, hubSlug, sectionSlug) {
  const items = (feedback || []).filter(f => f.hub === hubSlug && f.section === sectionSlug);
  if (items.length === 0) return 'pending';
  const open = items.filter(f => f.status === 'open');
  if (open.some(f => f.rating === 'needs-rework')) return 'needs-rework';
  if (open.some(f => f.rating === 'has-feedback')) return 'has-feedback';
  if (open.some(f => f.rating === 'looks-good')) return 'approved';
  // No open items left — the most recent 'looks-good' is treated as approved
  if (items.some(f => f.rating === 'looks-good')) return 'approved';
  return 'addressed';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  const clients = loadClients();
  const client = clients[auth.slug];
  if (!client) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'client_not_found' }));
    return;
  }

  const hubs = hubsForScope(auth.scope);
  const repo = client.repo;
  const branch = client.branch || 'main';

  // Pull portal-feedback.json once (small file). Used for per-section status
  // badges and per-hub gate sign-off state.
  let feedbackLog = { feedback: [], signOffs: {} };
  try {
    const raw = await ghReadFile(repo, branch, 'portal-feedback.json');
    if (raw) feedbackLog = JSON.parse(raw);
  } catch (e) { /* fine — file may not exist yet */ }

  const provocationComments = feedbackLog.provocationComments || [];

  const hubData = await Promise.all(hubs.map(async (hub) => {
    // L1 — Provocation Cards from `[hub.dir]/_provocations/*.md`
    let provocations = [];
    try {
      const cards = await readProvocations(repo, branch, hub.dir);
      provocations = cards.map(c => ({
        ...c,
        status: deriveCardStatus(provocationComments, hub.slug, c.id),
      }));
    } catch (e) {
      console.error(`[portal-list] readProvocations(${hub.dir}) failed:`, e.message);
    }

    const sections = await Promise.all(hub.sections.map(async (s) => {
      const path = s.file.startsWith('../')
        ? s.file.replace('../', '')
        : `${hub.dir}/${s.file}`;
      // Existence check via GitHub API. We could include size to estimate
      // wordcount, but the API returns size in bytes — close enough for the
      // hero metric strip on the hub landing.
      let exists = false;
      let sizeBytes = 0;
      try {
        const meta = await ghFetch(repo, branch, path);
        if (meta) {
          exists = true;
          sizeBytes = meta.size || 0;
        }
      } catch (e) { /* exists stays false */ }

      return {
        slug: s.slug,
        name: s.name,
        path,
        exists,
        sizeBytes,
        // Approximation: ~6 chars/word in English markdown
        wordCount: sizeBytes ? Math.round(sizeBytes / 6) : 0,
        feedbackStatus: deriveSectionStatus(feedbackLog.feedback, hub.slug, s.slug),
      };
    }));
    // Hub is "card-driven" when it has any L1 cards. Otherwise the legacy
    // section-list view renders (for hubs not yet re-curated under the
    // data-room model).
    const cardDriven = provocations.length > 0;
    const cardsCommented = provocations.filter(c => c.status === 'commented' || c.status === 'acknowledged').length;
    const cardsTotal = provocations.length;

    return {
      slug: hub.slug,
      name: hub.name,
      gate: hub.gate,
      cardDriven,
      provocations,
      cardsCommented,
      cardsTotal,
      sections,
      signedOff: !!(feedbackLog.signOffs && feedbackLog.signOffs[hub.slug]),
      signOff: feedbackLog.signOffs ? feedbackLog.signOffs[hub.slug] || null : null,
    };
  }));

  // ── Data-room mode filter ───────────────────────────────────────────────
  // If ANY hub on this engagement has Provocation Cards, the engagement is
  // in data-room mode — only card-driven hubs are exposed to the founder.
  // Hubs whose L3 docs exist but haven't been re-curated yet stay hidden
  // until the curator agent produces their cards. This prevents the "JC
  // sees stale Vision/Strategy/Financials on first contact" failure mode.
  //
  // Legacy clients (no _provocations/ folders anywhere) keep all hubs
  // visible — the section-list view renders unchanged.
  const dataRoomMode = hubData.some(h => h.cardDriven);
  const visibleHubs = dataRoomMode
    ? hubData.filter(h => h.cardDriven || h.signedOff)
    : hubData;

  // Hub-list-level aggregates for the hero metric strip — count visible only
  const totals = visibleHubs.reduce((acc, hub) => {
    for (const s of hub.sections) {
      if (s.exists) {
        acc.sections += 1;
        acc.words += s.wordCount;
      }
    }
    return acc;
  }, { sections: 0, words: 0 });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.end(JSON.stringify({
    ok: true,
    client: {
      slug: auth.slug,
      name: client.name,
      scope: auth.scope,
      tier: client.tier || null,
      oneLiner: client.oneLiner || null,
    },
    hubs: visibleHubs,
    dataRoomMode,
    totals,
    feedbackCounts: {
      open: (feedbackLog.feedback || []).filter(f => f.status === 'open').length,
      addressed: (feedbackLog.feedback || []).filter(f => f.status === 'addressed').length,
      wontFix: (feedbackLog.feedback || []).filter(f => f.status === 'wont-fix').length,
    },
  }));
};
