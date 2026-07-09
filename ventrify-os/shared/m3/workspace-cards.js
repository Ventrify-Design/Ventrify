// ============================================================
// Ventrify OS — WORKSPACE M3 card organisms (workspace-only).
// Rich portfolio + queue cards that carry full parity with the classic
// dashboard/queue. Render from the normalized rows produced by
// workspace-adapter.js. Token-only (--md-sys-color-*) + the classes in
// workspace-chrome.css. Kept OUT of ds.js so the design-system catalog
// doesn't churn and these stay workspace-scoped. Pure string builders.
// ============================================================

import { statusPill, _esc as esc } from './ds.js';   // ONE real HTML escaper — founder-controlled names/theses/queue text hit innerHTML sinks

const metaRow = arr => `<div class="pc-meta">${(arr || []).map(m => `<span>${esc(m)}</span>`).join('<span class="sep"></span>')}</div>`;
const REASON_ICON = { stuck: 'warning', attention: 'priority_high', 'on-track': 'trending_up' };
const SCORE_COLOR = { ok: 'var(--success, #00A368)', warn: 'var(--warning, #C77700)', err: 'var(--md-sys-color-error)' };

// ---- portfolio: a build-style engagement card ----
function engagementCard(r) {
  // hover tooltips carry the parity the compact card can't show inline: all top-3 health reasons + the raw composite/max
  const reasonsTitle = (r.health.reasons || []).slice(0, 3).map(x => '• ' + x.text).join('\n');
  const health = statusPill({ kind: r.health.kind, label: r.health.label, title: reasonsTitle || undefined });
  const inv = r.inv ? statusPill({ kind: r.inv.kind, label: `${r.inv.pct}% inv`, title: `Investability ${r.inv.composite}/${r.inv.max}` }) : '';
  const reason = (r.health.reasons && r.health.reasons[0] && r.health.level !== 'on-track')
    ? `<div class="pc-reason ${r.health.level}"><span class="material-symbols-rounded">${REASON_ICON[r.health.level] || 'info'}</span><span>${esc(r.health.reasons[0].text)}</span></div>` : '';
  const body = r.awaiting
    ? `<div class="pc-awaiting"><b>Awaiting brief from ${esc(r.awaiting.founderName)}.</b> Studio invite sent. No cards drafted until the brief is signed.</div>`
    : (r.stats ? `<div class="pc-stats">${r.stats.map(s => `<div class="pc-stat"><div class="v">${esc(s.v)}</div><div class="l">${esc(s.l)}</div></div>`).join('')}</div>` : '');
  const run = r.runState ? `<div class="pc-run">${statusPill(r.runState)}</div>` : '';
  return `<a class="m3-card pc" href="${esc(r.href)}">
    <div class="pc-head">
      <div class="pc-identity">
        <div class="pc-avatar" style="background:${esc(r.avatar.color) || 'var(--md-sys-color-primary)'}">${esc(r.avatar.initials)}</div>
        <div><div class="pc-name">${esc(r.name)}</div><div class="pc-founder">${esc(r.sub)}</div></div>
      </div>
      <div class="pc-badges">${health}${inv}</div>
    </div>
    <div>
      <div class="pc-phase">${esc(r.phaseLabel)}</div>
      ${r.gateStatus ? `<div class="pc-gate">${esc(r.gateStatus)}</div>` : ''}
      <div class="m3-prog"><span style="width:${Number(r.progress) || 0}%"></span></div>
    </div>
    ${metaRow(r.meta)}
    ${reason}
    ${run}
    ${body}
  </a>`;
}

// ---- portfolio: an investor-assessment card (verdict-led) ----
function assessmentCard(r) {
  // colour the score number by band (parity with the classic card); the .band sub-span keeps its neutral colour
  const scoreCol = r.score && r.score.kind ? SCORE_COLOR[r.score.kind] : '';
  const score = r.score
    ? `<span class="pc-score"${scoreCol ? ` style="color:${scoreCol}"` : ''}>${esc(r.score.pct)}%<span class="band"> · ${esc(r.score.conviction ? r.score.conviction + ' conviction' : r.score.band)}</span></span>` : '';
  const run = r.runState ? `<div class="pc-run">${statusPill(r.runState)}</div>` : '';
  return `<a class="m3-card pc" href="${esc(r.href)}">
    <div class="pc-head">
      <div class="pc-identity">
        <div class="pc-avatar" style="background:${esc(r.avatar.color) || 'var(--md-sys-color-tertiary, #00B8A0)'}">${esc(r.avatar.initials)}</div>
        <div><div class="pc-name">${esc(r.name)}</div><div class="pc-founder">${esc(r.sub)}</div></div>
      </div>
      ${statusPill({ kind: 'info', label: 'Assessment' })}
    </div>
    <div class="pc-verdict"><span class="pc-rec ${esc(r.rec.kind)}">${esc(r.rec.label)}</span>${score}</div>
    ${r.thesis ? `<div class="pc-thesis">${esc(r.thesis)}</div>` : ''}
    ${run}
    ${metaRow(r.meta)}
  </a>`;
}

export function portfolioCard(r) {
  return r.kind === 'assessment' ? assessmentCard(r) : engagementCard(r);
}

// grid of rows; `emptyFilterLabel` shown when the filtered list is empty
export function portfolioGrid(rows, emptyFilterLabel = 'No matching engagements. Adjust the filters.') {
  if (!rows || !rows.length) {
    return `<div class="m3-card" style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--md-sys-color-on-surface-variant)">${esc(emptyFilterLabel)}</div>`;
  }
  return `<div class="ws-grid">${rows.map(portfolioCard).join('')}</div>`;
}

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
