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

const { loadClients, requireAuth, ghFetch, ghReadFile, hubsForScope, readProvocations, readHubL3Status, listDeckVersions, listSinglePdf, listFigmaFile } = require('./_lib');

// ── Venture Scope catalogue (Ventrify OS deliverable matrix) ──────────────
// Replaces the deprecated per-engagement tier matrix (Launchpad/Venture/
// Venture Pro). Under Ventrify OS, every venture earns the same ~70+
// deliverables across the same 5 phases + 3 gates. The licence tier
// (Starter / Cohort / Enterprise) sits on the BUYER (accelerator / studio
// / corporate innovation lab), not the venture — and never renders on
// the founder's portal.
//
// Updated 2026-06-02 when MoneyGym (Maya/Jonathan Corner) was repositioned
// as "a venture running on Ventrify OS". Source: os.ventrify.io.
//
// Each phase has: title, byline (operator-facing), weekRange (timeline
// strip), gate (formal gate review at end of phase, or null), groups
// (collapsible deliverable buckets within the phase).
const VENTURE_SCOPE = [
  {
    key: 'phase-0',
    title: 'Phase 0',
    name: 'Foundation',
    weekRange: 'Week 0',
    gate: null,
    summary: 'Intake. Capture the venture, lock the brand, set the table.',
    groups: [
      {
        label: 'Intake',
        items: [
          'Venture brief (structured intake)',
          'Brand kit (palette, typography, voice)',
          'Brand photography library (37 sourced photos)',
          'Welcome Pack (Powered by Ventrify OS)',
          'Founder Portal access',
        ],
      },
    ],
  },
  {
    key: 'phase-1',
    title: 'Phase 1',
    name: 'Discover',
    weekRange: 'Weeks 1–2',
    gate: 'Gate 1 — Research direction signed off',
    summary: 'Deeply understand market, competitors, opportunity. Gate 1.',
    groups: [
      {
        label: 'Research deliverables (7)',
        items: [
          'Market analysis (TAM/SAM/SOM + Why Now)',
          'Competitor analysis (feature matrix + ASO sentiment)',
          'User insights (App Store + community sentiment)',
          'SWOT analysis',
          'Opportunities (top 3 validated)',
          'Unit economics (CAC, LTV, projections)',
          'Partnerships & distribution map',
        ],
      },
      {
        label: 'Portal hubs',
        items: [
          'Research Hub (live 3-layer data room)',
          'Provocation Cards (founder-facing strategic forks)',
        ],
      },
    ],
  },
  {
    key: 'phase-2',
    title: 'Phase 2',
    name: 'Define',
    weekRange: 'Weeks 2–4',
    gate: 'Gate 2 — Product vision + MVP scope signed off',
    summary: 'Shape product structure. Lock scope. Gate 2.',
    groups: [
      {
        label: 'Define deliverables (10)',
        items: [
          'User personas (2–3 with depth)',
          'Product vision',
          'MVP features (MoSCoW)',
          'Tech stack',
          'User journeys (top 3 mapped)',
          'Information architecture (45–65 screens)',
          'Roadmap (v1, v1.1, v2)',
          'Tone of voice',
          'Social strategy',
          '30-day content calendar',
        ],
      },
      {
        label: 'Portal hubs',
        items: [
          'Vision Hub (live 3-layer data room)',
          'Strategy Hub (live 3-layer data room)',
        ],
      },
    ],
  },
  {
    key: 'phase-2-5',
    title: 'Phase 2.5',
    name: 'Financial Plan',
    weekRange: 'Week 4',
    gate: 'Gate 2.5 — Financial plan + funding ask signed off',
    summary: 'Defensible financial plan + investor-ready ask. Gate 2.5.',
    groups: [
      {
        label: 'Financial files (11)',
        items: [
          'Build costs',
          'Operating costs (24-month)',
          'Revenue model',
          'Unit economics (detailed, per-channel)',
          'Cash flow forecast (24-month)',
          'Marketing budget',
          'Hiring plan',
          'Sensitivity analysis',
          'Funding ask + valuation comparables',
          'Financial summary (single page)',
          'Scope-change recommendations',
        ],
      },
      {
        label: 'Portal hubs',
        items: [
          'Financials Hub (live 3-layer data room)',
          'Investor-share portal view (separate access code)',
        ],
      },
    ],
  },
  {
    key: 'phase-3',
    title: 'Phase 3',
    name: 'Design',
    weekRange: 'Weeks 3–8',
    gate: null,
    summary: 'Design system + screen designs from locked scope.',
    groups: [
      {
        label: 'Design deliverables',
        items: [
          'User stories',
          'Wireframe notes',
          'Component specifications',
          'Figma variables (5 collections — colour, type, spacing, radius, sizing)',
          'Figma components (24 components, 8 lockups)',
          'Figma screen compositor plugin',
          'Wireframes page on DS site',
        ],
      },
    ],
  },
  {
    key: 'phase-4',
    title: 'Phase 4',
    name: 'Develop',
    weekRange: 'Weeks 6–14',
    gate: null,
    summary: 'Build the MVP + every supporting surface. Multi-round design audits.',
    groups: [
      {
        label: 'Product',
        items: [
          'MVP App (iOS + Android via Expo + React Native)',
          'DEMO_MODE built in (showcase without backend)',
          'Authentication (email + light/dark mode + push)',
          'Account deletion + ATT + in-app legal links',
          '70+ shipped screens',
        ],
      },
      {
        label: 'Marketing surface',
        items: [
          'Marketing website (Next.js, 9 pages)',
          'Live device-mockup screenshots across 7 surface zones',
          '20 launch social posts (graphics + copy)',
          '5 SEO blog posts',
          'Social Launch Preview (in-feed mockup)',
          'Sanity CMS configured',
        ],
      },
      {
        label: 'Design system surface',
        items: [
          'Design System site (24 components, 8 lockups, full token reference)',
          'Wireframes page (live screenshots from MVP)',
          'Personas / User Stories / User Flows pages',
          '3 Figma plugins (variables, components, screen compositor)',
        ],
      },
      {
        label: 'Decks + briefs',
        items: [
          'Investor Pitch Deck (PDF)',
          'Marketing Launch Pack (PDF)',
          'Video Production Brief (PDF)',
          'Blog Content Pack (PDF)',
          '60-second promotional video (automated pipeline)',
        ],
      },
    ],
  },
  {
    key: 'phase-4-5',
    title: 'Phase 4-Design',
    name: 'Design Refinement',
    weekRange: 'Weeks 8–13',
    gate: null,
    summary: 'Multi-round design audits. Featured-app polish.',
    groups: [
      {
        label: 'Audit rounds',
        items: [
          'Round 1 — Rule compliance audit (ux-designer agent)',
          'Round 2 — Navigation UX + WCAG accessibility',
          'Round 3 — Featured-app polish (brand fidelity)',
          'Visual consistency propagation (one-command refresh)',
        ],
      },
    ],
  },
  {
    key: 'phase-4b',
    title: 'Phase 4B',
    name: 'Beta',
    weekRange: 'Weeks 12–14',
    gate: null,
    summary: 'Distribute the build. Collect feedback. Fix critical issues.',
    groups: [
      {
        label: 'Beta',
        items: [
          'TestFlight build (iOS)',
          'Google Play Internal Testing build (Android)',
          'Beta-test brief (tester recruitment)',
          'Feedback triage + bug fixes',
        ],
      },
    ],
  },
  {
    key: 'phase-5',
    title: 'Phase 5',
    name: 'Deliver',
    weekRange: 'Weeks 10–16',
    gate: null,
    summary: 'App Store launch. Handoff. Launch Day Playbook.',
    groups: [
      {
        label: 'Launch',
        items: [
          'Apple App Store submission + review',
          'Google Play Store submission + review',
          'Production deployments (marketing site, DS site, portal)',
          '3 GitHub repos handed off',
          'Firebase / Sanity / Vercel / Figma ownership transferred',
          'Launch Day Playbook',
        ],
      },
    ],
  },
];

// Aggregate count — surfaced in the hub hero.
const VENTURE_SCOPE_TOTAL = VENTURE_SCOPE.reduce(
  (sum, p) => sum + p.groups.reduce((s, g) => s + g.items.length, 0),
  0,
);

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
  if (open.some(f => f.rating === 'question')) return 'question';
  if (open.some(f => f.rating === 'looks-good')) return 'approved';
  // No open items left — the most recent 'looks-good' is treated as approved
  if (items.some(f => f.rating === 'looks-good')) return 'approved';
  return 'addressed';
}

// Hub-level status (Phase 2): for deliverables that take feedback at the
// hub level (link-out previews — Marketing Site, DS, App Preview, Social
// Preview), section is null. Same status ladder as deriveSectionStatus.
function deriveHubLevelStatus(feedback, hubSlug) {
  const items = (feedback || []).filter(f => f.hub === hubSlug && (f.section == null || f.section === ''));
  if (items.length === 0) return 'pending';
  const open = items.filter(f => f.status === 'open');
  if (open.some(f => f.rating === 'needs-rework')) return 'needs-rework';
  if (open.some(f => f.rating === 'has-feedback')) return 'has-feedback';
  if (open.some(f => f.rating === 'question')) return 'question';
  if (open.some(f => f.rating === 'looks-good')) return 'approved';
  if (items.some(f => f.rating === 'looks-good')) return 'approved';
  return 'addressed';
}

// Count of open hub-level feedback items (used by the landing card badge so
// the visitor sees "3 open" without drilling into the deliverable).
function countOpenHubLevel(feedback, hubSlug) {
  return (feedback || []).filter(
    f => f.hub === hubSlug && (f.section == null || f.section === '') && f.status === 'open'
  ).length;
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

    // Defensive: surface-only hubs (preview-link / appetize-embed /
    // deck-deliverable / pdf-binary / tier-scope) have no markdown sections.
    // A missing sections array used to throw and tank the whole response;
    // default to [] so one mis-declared hub can't break the portal payload.
    const sections = await Promise.all((hub.sections || []).map(async (s) => {
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

    // L3 status — read from `_provocations/_index.md` frontmatter. Drives:
    //   (1) "View source documents" expander visibility on the founder view
    //   (2) sign-off button activation (must be 'built', 'pending-retrofit',
    //       or 'parallel-review')
    // Per .claude/memory/feedback_l3_review_before_signoff.md (PROTECTED) in
    // the engagement repo. The 'parallel-review' state is the surprise-
    // proposal mode where L3 was authored before cards (operator-approved
    // deviation) — both layers visible simultaneously to the founder.
    const l3Status = cardDriven ? await readHubL3Status(repo, branch, hub.dir) : null;
    const l3Visible = cardDriven
      ? (l3Status === 'built' || l3Status === 'pending-retrofit' || l3Status === 'parallel-review')
      : true; // legacy hubs: existing visibility rules apply

    // ── Last activity timestamp ──────────────────────────────────────────
    // Max of all feedback + provocation comment timestamps for this hub.
    // Drives the "● Updated since your last visit" badge on the dashboard.
    // Founder's per-hub last-visit timestamp lives in localStorage on the
    // client; the comparison happens in portal-app.html.
    const hubFeedbackTimes = (feedbackLog.feedback || [])
      .filter(f => f.hub === hub.slug)
      .map(f => f.submittedAt).filter(Boolean);
    const hubProvocationTimes = (provocationComments || [])
      .filter(c => c.hub === hub.slug)
      .map(c => c.submittedAt).filter(Boolean);
    const allTimes = [...hubFeedbackTimes, ...hubProvocationTimes]
      .map(t => new Date(t).getTime())
      .filter(t => !isNaN(t));
    const lastActivityAt = allTimes.length ? new Date(Math.max(...allTimes)).toISOString() : null;

    // ── Preview-link surface (Marketing Site / Design System hubs) ────────
    // Per .claude/memory/feedback_deliverable_surfaces_hub.md (PROTECTED in
    // every engagement repo). These hubs render as link-out cards pointing
    // at the live deployment URL. The URL lives on the client config (set
    // in PORTAL_CLIENTS env var per engagement). Empty-frame placeholder
    // shown when the URL isn't registered yet.
    let previewUrl = null;
    if (hub.surfaceType === 'preview-link' && hub.urlField) {
      previewUrl = client[hub.urlField] || null;
    }

    // ── Appetize-embed surface (App Preview hub) ──────────────────────────
    // The hub config carries `publicKeyField` — the property name on the
    // client config that holds the Appetize publicKey (typically
    // 'appetizePublicKey'). We expose the key directly to the frontend so
    // portal-app.html can construct the iframe src as
    // `https://appetize.io/embed/{key}`. Returns null when not configured
    // so the portal renders the placeholderText empty state.
    let appetizePublicKey = null;
    if (hub.surfaceType === 'appetize-embed' && hub.publicKeyField) {
      appetizePublicKey = client[hub.publicKeyField] || null;
    }

    // ── Deck-deliverable surface (Investor Pitch Deck hub) ─────────────────
    // Scans the engagement repo's deckDir/ for versioned .pptx + .pdf pairs.
    // Returns { versions: [...], latest: {...} } so the portal can render
    // version history and embed the latest .pdf as a preview iframe.
    //
    // Fails open: if the directory doesn't exist or contains no matching
    // files, versions = [] and the portal shows the placeholderText.
    let deckVersions = null;
    let deckLatest = null;
    if (hub.surfaceType === 'deck-deliverable' && hub.deckDir && hub.deckBaseName) {
      try {
        const result = await listDeckVersions(repo, branch, hub.deckDir, hub.deckBaseName);
        deckVersions = result.versions;
        deckLatest = result.latest;
      } catch (e) {
        console.error(`[portal-list] deck listing failed for ${hub.slug}:`, e.message);
        deckVersions = [];
        deckLatest = null;
      }
    }

    // ── PDF-binary surface (Foundations: SOW, Welcome Pack) ────────────────
    // Unversioned single-PDF deliverable. Server-side scans the configured
    // dir for `<anything>-<pdfBaseName>.pdf` and returns the single match
    // so the portal can render a preview iframe + download button.
    let pdfBinary = null;
    if (hub.surfaceType === 'pdf-binary' && hub.pdfDir && hub.pdfBaseName) {
      try {
        pdfBinary = await listSinglePdf(repo, branch, hub.pdfDir, hub.pdfBaseName);
      } catch (e) {
        console.error(`[portal-list] pdf-binary listing failed for ${hub.slug}:`, e.message);
        pdfBinary = null;
      }
    }

    // ── Figma deliverable surface (Deliverables: Figma) ────────────────────
    // Combines a URL (drives the embed iframe + Open in Figma) with an
    // optional binary file (drives the download button). Either or both
    // can be present — the renderer adapts.
    let figmaUrl = null;
    let figmaFile = null;
    if (hub.surfaceType === 'figma-deliverable') {
      if (hub.urlField) {
        figmaUrl = client[hub.urlField] || null;
      }
      if (hub.figmaFileDir && hub.figmaFileBaseName) {
        try {
          figmaFile = await listFigmaFile(repo, branch, hub.figmaFileDir, hub.figmaFileBaseName);
        } catch (e) {
          console.error(`[portal-list] figma file scan failed for ${hub.slug}:`, e.message);
        }
      }
    }

    // ── Venture-scope surface (Foundations: Venture Scope) ─────────────────
    // Returns the canonical Ventrify OS deliverable scope as a phase-by-
    // phase structured payload. Same payload for every venture — there is
    // no per-venture tier under Ventrify OS. The licence tier (Starter /
    // Cohort / Enterprise) sits on the buyer, not the venture, and never
    // leaks to the founder portal.
    let ventureScope = null;
    if (hub.surfaceType === 'venture-scope') {
      ventureScope = {
        phases: VENTURE_SCOPE,
        totalDeliverables: VENTURE_SCOPE_TOTAL,
        programmeName: 'Ventrify OS',
      };
    }

    // Hub-level feedback (Phase 2 — 2026-05-27): for link-out deliverables
    // and any future hub-level comments. Status drives the landing badge;
    // openCount drives the "3 open" pill on the deliverable card.
    const hubLevelFeedbackStatus = deriveHubLevelStatus(feedbackLog.feedback, hub.slug);
    const hubLevelFeedbackOpen = countOpenHubLevel(feedbackLog.feedback, hub.slug);

    return {
      slug: hub.slug,
      name: hub.name,
      gate: hub.gate,
      // Three-zone IA (added 2026-05-27): 'data-room' (strategic, gate-bearing),
      // 'deliverable' (operational artefacts), 'status' (synthesised project
      // state — reserved for the Project Status surface). Falls back to
      // 'deliverable' if missing so hubs without the field still render.
      category: hub.category || 'deliverable',
      hubLevelFeedbackStatus,
      hubLevelFeedbackOpen,
      cardDriven,
      alwaysVisible: !!hub.alwaysVisible,
      surfaceType: hub.surfaceType || 'data-room',
      previewUrl,
      appetizePublicKey,
      deckVersions,
      deckLatest,
      pdfBinary,
      figmaUrl,
      figmaFile,
      ventureScope,
      description: hub.description || null,
      placeholderText: hub.placeholderText || null,
      quickLinks: hub.quickLinks || null,
      provocations,
      cardsCommented,
      cardsTotal,
      l3Status,
      l3Visible,
      sections,
      signedOff: !!(feedbackLog.signOffs && feedbackLog.signOffs[hub.slug]),
      signOff: feedbackLog.signOffs ? feedbackLog.signOffs[hub.slug] || null : null,
      lastActivityAt,
    };
  }));

  // ── Data-room mode filter ───────────────────────────────────────────────
  // If ANY hub on this engagement has Provocation Cards, the engagement is
  // in data-room mode — only card-driven hubs are exposed to the founder.
  // Hubs whose L3 docs exist but haven't been re-curated yet stay hidden
  // until the curator agent produces their cards. This prevents the "JC
  // sees stale Vision/Strategy/Financials on first contact" failure mode.
  //
  // alwaysVisible escape hatch: operational deliverable hubs (Marketing
  // Launch, Video, Blog) are explicit execution artefacts, not legacy
  // uncurated content. They bypass the data-room filter regardless of
  // whether they have Provocation Cards or sign-off state.
  //
  // Legacy clients (no _provocations/ folders anywhere) keep all hubs
  // visible — the section-list view renders unchanged.
  const dataRoomMode = hubData.some(h => h.cardDriven);
  const visibleHubs = dataRoomMode
    ? hubData.filter(h => h.cardDriven || h.signedOff || h.alwaysVisible)
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
