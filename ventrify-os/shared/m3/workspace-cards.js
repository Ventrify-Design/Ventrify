// ============================================================
// Ventrify OS — WORKSPACE M3 card organisms (workspace-only).
// Rich portfolio + queue cards that carry full parity with the classic
// dashboard/queue. Render from the normalized rows produced by
// workspace-adapter.js. Token-only (--md-sys-color-*) + the classes in
// workspace-chrome.css. Kept OUT of ds.js so the design-system catalog
// doesn't churn and these stay workspace-scoped. Pure string builders.
// ============================================================

import { statusPill, _esc as esc } from './ds.js';   // ONE real HTML escaper — founder-controlled names/theses/queue text hit innerHTML sinks

// NOTE: the portfolio cards and the queue board were removed — the live portfolio renders through
// DS.engagementTable and the queue through DS.queueBoard (single source). This file now keeps only the
// two surfaces with no DS equivalent yet: the plan-gate banner and the first-run empty state.

// ---- plan-gate banner (limit reached) ----
export function planGateBanner(label = 'New engagement') {
  return `<div class="m3-card ws-plangate">
    <span class="material-symbols-rounded">lock</span>
    <div style="flex:1"><b>Plan limit reached.</b> <span style="color:var(--md-sys-color-on-surface-variant)">You've used your ${esc(label).toLowerCase().replace(/^new /, '')} allowance for this plan.</span></div>
    <button class="ws-plangate-cta" onclick="window.__requestUpgrade&&window.__requestUpgrade()">Request an upgrade →</button>
  </div>`;
}

// ---- person / operator card ----
// personCard — the single source for the team roster card: avatar + name (+ optional badge) + sub, an
// optional meta pill row, a trailing action, and an optional aside. badge/pill/action/aside are trusted
// HTML (statusPill/button markup); name/sub/avatar are escaped here.
export function personCard({ avatar, avatarColor, name, sub, badge = '', pill = '', action = '', aside = '' } = {}) {
  return `<div class="m3-card pc">
    <div class="pc-head">
      <div class="pc-identity"><div class="pc-avatar" style="background:${esc(avatarColor) || 'var(--md-sys-color-primary)'}">${esc(avatar)}</div>
        <div><div class="pc-name">${esc(name)}${badge ? ' ' + badge : ''}</div><div class="pc-founder">${esc(sub)}</div></div></div>
      ${action}
    </div>
    ${pill ? `<div class="pc-meta">${pill}</div>` : ''}
    ${aside}
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

// NOTE: the queue board (queueBoardWS/queueItemWS/Q_SECTIONS) was removed — the live queue now renders
// through DS.queueBoard (queueItem extended to carry cta/href/href2 + typeLabel·programName·age meta).
