// ============================================================
// Ventrify OS — WORKSPACE M3 card organisms (workspace-only).
// Rich portfolio + queue cards that carry full parity with the classic
// dashboard/queue. Render from the normalized rows produced by
// workspace-adapter.js. Token-only (--md-sys-color-*) + the classes in
// workspace-chrome.css. Kept OUT of ds.js so the design-system catalog
// doesn't churn and these stay workspace-scoped. Pure string builders.
// ============================================================

import { statusPill, _esc as esc } from './ds.js';   // ONE real HTML escaper — founder-controlled names/theses/queue text hit innerHTML sinks

// NOTE: the rich portfolio card path (engagementCard/assessmentCard/portfolioCard/portfolioGrid) was
// removed — the live portfolio now renders through DS.engagementTable (single source). This file keeps
// only the surfaces with no DS equivalent yet: the plan-gate banner, the empty state, and the queue board.

// ---- plan-gate banner (limit reached) ----
export function planGateBanner(label = 'New engagement') {
  return `<div class="m3-card ws-plangate">
    <span class="material-symbols-rounded">lock</span>
    <div style="flex:1"><b>Plan limit reached.</b> <span style="color:var(--md-sys-color-on-surface-variant)">You've used your ${esc(label).toLowerCase().replace(/^new /, '')} allowance for this plan.</span></div>
    <button class="ws-plangate-cta" onclick="window.__requestUpgrade&&window.__requestUpgrade()">Request an upgrade →</button>
  </div>`;
}

// ---- empty state (both classic variants + 3 explorer cards) ----
export function workspaceEmpty({ assessOnly = false, orgName = 'your Workspace', canCreate = true } = {}) {
  const eyebrow = assessOnly ? 'First assessment' : 'First engagement';
  const title = assessOnly ? 'Run your first<br>assessment.' : 'Create your first<br>engagement.';
  const sub = assessOnly
    ? 'Click “New assessment”, then upload a pitch deck and any supporting docs. Ventrify returns a venture score, the key findings, and how to strengthen it — all here, with no founder needed.'
    : 'Click “New engagement”. A five-step wizard captures the brief. The platform sets up the workspace, seeds the agents, opens Phase 0, and slots the venture into this portfolio.';
  const buildSteps = [
    ['Brief', 'Brief intake', 'Venture name, founder, industry, tier — an eight-section brief stored against the engagement.'],
    ['Hubs', 'Hub seeding', 'The three-layer data room is scaffolded and all seven hubs are primed.'],
    ['Agents', 'Agent wiring', 'The research agents are wired up and Phase 0 opens.'],
    ['Live', 'Portal & portfolio', 'The Studio goes live and the engagement appears in your portfolio.'],
  ];
  const assessSteps = [
    ['Deck', 'Deck & data room', 'Upload the pitch deck plus any supporting docs. Large files are extracted in-browser.'],
    ['Research', 'Evidence gathering', 'Agents pressure-test the claims, size the market, benchmark competitors, and check the founders.'],
    ['Score', 'Investability score', 'A weighted 0–100 venture score across seven categories, with the gaps called out.'],
    ['Verdict', 'Decision-grade verdict', 'Recommendation, thesis, key findings, and how to strengthen it — ready to act on.'],
  ];
  const steps = (assessOnly ? assessSteps : buildSteps)
    .map(([tag, t, p]) => `<div class="ws-step"><div class="ws-step-tag">${tag}</div><div class="ws-step-title">${t}</div><p>${p}</p></div>`).join('');
  const cta = canCreate
    ? `<button class="m3-btn filled" style="margin-top:20px" onclick="window.openNewAssessment&&window.openNewAssessment()"><span class="material-symbols-rounded">add</span>${assessOnly ? 'Start your first assessment' : 'Start your first engagement'}</button>`
    : `<div style="margin-top:20px">${planGateBanner(assessOnly ? 'New assessment' : 'New engagement')}</div>`;
  const explorers = [
    ['tune', 'Refine your brand', 'Edit your organisation name, primary colour, or logo before your first engagement goes live.', 'settings-m3.html', 'Open settings →', ''],
    ['dashboard', 'How the Workspace works', 'Three surfaces, three audiences. The marketing tour explains how operators, founders, and investors connect.', '../the-workspace.html', 'Read the tour →', ' target="_blank"'],
    ['groups', 'Meet the 47 agents', 'The fleet behind every engagement — substrate keystones, Build-First 8, and the full domain breakdown.', '../agents.html', 'Explore the fleet →', ' target="_blank"'],
  ].map(([ic, t, p, href, cta2, attr]) => `<a class="m3-card ws-explorer" href="${href}"${attr}>
      <div class="ws-explorer-head"><span class="ws-explorer-icon"><span class="material-symbols-rounded">${ic}</span></span><span class="ws-explorer-title">${t}</span></div>
      <p>${p}</p><span class="ws-explorer-cta">${cta2}</span>
    </a>`).join('');
  return `<div class="m3-card ws-empty-hero">
      <div>
        <div class="overline" style="color:var(--md-sys-color-primary)">${eyebrow}</div>
        <h2 class="ws-empty-title">${title}</h2>
        <p class="ws-empty-sub">${sub}</p>
        ${cta}
      </div>
      <div class="ws-empty-steps">${steps}</div>
    </div>
    <div class="ws-explorers">${explorers}</div>`;
}

// ---- queue ----
function queueItemWS(it) {
  return `<div class="m3-card ws-qitem ${it.urgency === 'high' ? 'high' : ''}">
    <span class="ws-qicon"><span class="material-symbols-rounded">${esc(it.icon)}</span></span>
    <div>
      <div class="ws-qtitle">${esc(it.title)}</div>
      <div class="ws-qdetail">${esc(it.detail)}</div>
      <div class="ws-qmeta"><span class="k">${esc(it.typeLabel)}</span>${it.programName ? `<span>·</span><span>${esc(it.programName)}</span>` : ''}<span>·</span><span>${esc(it.age)}</span></div>
    </div>
    <div class="ws-qitem-cta">
      <a class="m3-btn filled" href="${esc(it.href)}">${esc(it.cta)}</a>
      <a class="ws-qopen" href="${esc(it.href2)}">Open engagement →</a>
    </div>
  </div>`;
}

const Q_SECTIONS = [
  ['high', 'High urgency', 'Blocking a gate or a founder. Address first.'],
  ['med', 'Medium urgency', 'Should be cleared this week.'],
  ['low', 'Low urgency', 'Awareness items. No immediate action required.'],
];

export function queueBoardWS(grouped) {
  const total = (grouped.high.length + grouped.med.length + grouped.low.length);
  if (!total) {
    return `<div class="m3-card" style="text-align:center;padding:48px 24px">
      <div class="overline" style="color:var(--md-sys-color-primary);margin-bottom:8px">Queue clear</div>
      <div class="title-l" style="margin-bottom:6px">Nothing for you to do.</div>
      <p class="body-m" style="color:var(--md-sys-color-on-surface-variant);max-width:480px;margin:0 auto 20px">New work surfaces here when an agent completes a run, a founder responds, or a gate is ready to sign.</p>
      <button class="m3-btn filled" onclick="window.openNewAssessment&&window.openNewAssessment()"><span class="material-symbols-rounded">add</span>New assessment</button>
    </div>`;
  }
  return Q_SECTIONS.map(([key, label, sub]) => {
    const items = grouped[key];
    if (!items.length) return '';
    return `<div class="ws-qsection">
      <div class="ws-qsection-head">
        <div class="ws-qsection-title">${label} <span class="n">· ${items.length}</span></div>
        <div class="ws-qsection-sub">${sub}</div>
      </div>
      <div class="ws-qlist">${items.map(queueItemWS).join('')}</div>
    </div>`;
  }).join('');
}
