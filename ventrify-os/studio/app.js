// ============================================================
// Ventrify OS — Studio (founder portal) · Shell + state bootstrap
//
// The Studio is the founder-facing surface. It reads engagement +
// organisation state from the SAME localStorage origin the Workspace
// writes to (os.ventrify.io), so the org brand and engagement list
// are shared without a backend.
//
// Engagement context is selected via `?id=<engagement-slug-or-id>`.
// If no ?id and only one engagement exists, fall back to it. If
// none, render an empty state pointing the founder back to the
// Workspace (or to the login page).
//
// Storage keys (shared with Workspace):
//   workspace.organisation  — brand kit (name, primaryColor, logo)
//   workspace.programs      — engagement records
// ============================================================

(function() {
  if (typeof window === 'undefined') return;

  // ----- Helpers ----------------------------------------------------------
  const HUB_LABELS = {
    research:   'Research Hub',
    vision:     'Vision Hub',
    strategy:   'Strategy Hub',
    financials: 'Financials Hub',
    marketing:  'Marketing Hub',
    video:      'Video Hub',
    blog:       'Blog Hub'
  };
  // Per the workflow decisions: hubs split into three groups in the Studio
  const HUB_GROUPS = {
    foundations:  ['brief', 'lexicon', 'brand'],            // Foundations group
    'data-room':  ['research','vision','strategy','financials'], // Data Room group
    deliverables: ['marketing','video','blog','app']        // Deliverables group
  };
  const FOUNDATIONS_LABELS = {
    brief:   'Brief snapshot',
    lexicon: 'Lexicon',
    brand:   'Brand kit'
  };
  const DELIVERABLE_LABELS = {
    marketing: 'Marketing site',
    video:     'Promo video',
    blog:      'Blog content',
    app:       'MVP app'
  };

  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) {}
  }
  function initialsOf(s) {
    const parts = (s || '').trim().split(/\s+/);
    const a = (parts[0] || '?')[0] || '?';
    const b = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
    return (a + b).toUpperCase().slice(0, 2);
  }
  function phaseLabel(p) {
    return ({0:'Phase 0 · Intake',1:'Phase 1 · Discover',2:'Phase 2 · Define',
             2.5:'Phase 2.5 · Financials',3:'Phase 3 · Design',
             4:'Phase 4 · Develop',4.5:'Phase 4B · Beta',5:'Phase 5 · Deliver'})[p] || `Phase ${p}`;
  }

  // ----- Build window.STUDIO ---------------------------------------------
  const org = readJSON('workspace.organisation', null);
  const programs = readJSON('workspace.programs', []);

  // Engagement selection: ?id wins, otherwise pick first engagement, otherwise null
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id');
  let engagement = null;
  if (requestedId) {
    engagement = programs.find(p => p.id === requestedId || p.slug === requestedId) || null;
  } else if (programs.length === 1) {
    engagement = programs[0];
  }

  window.STUDIO = {
    org, programs, engagement,
    labels: { hub: HUB_LABELS, foundations: FOUNDATIONS_LABELS, deliverables: DELIVERABLE_LABELS, phase: phaseLabel },
    groups: HUB_GROUPS,
    helpers: { initialsOf, readJSON, writeJSON, phaseLabel }
  };

  // ----- Apply org branding -----------------------------------------------
  if (org && org.primaryColor) {
    const styleEl = document.createElement('style');
    styleEl.id = 'studio-brand-vars';
    // Derive RGB triplet so we can use rgba(var(--brand-primary-rgb), opacity) elsewhere
    const hex = org.primaryColor.replace('#','');
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    styleEl.textContent = `:root {
      --brand-primary: ${org.primaryColor};
      --brand-primary-rgb: ${r}, ${g}, ${b};
      --primary: ${org.primaryColor};
    }`;
    document.head.appendChild(styleEl);
  }

  // ----- Topbar + Tab nav -------------------------------------------------
  const path = window.location.pathname.split('/').pop() || 'dashboard.html';
  const activeTab = ({
    'dashboard.html': 'foundations',  // dashboard defaults to Foundations group
    'brief.html':     'foundations',
    'hub.html':       null,           // active tab set by ?group=
    'investability.html': 'investability'
  })[path] || null;

  function renderTopbar() {
    if (!org) {
      return `
        <div class="topbar">
          <a href="/studio/" class="topbar-brand">
            <span class="topbar-brand-mark">V</span>
            <span class="topbar-brand-name">Ventrify Studio</span>
          </a>
          <div class="topbar-spacer"></div>
          <div class="topbar-utility">
            <a href="/" class="topbar-utility-link">OS site</a>
          </div>
        </div>
      `;
    }
    const orgInitials = initialsOf(org.name);
    const orgLogo = org.logoDataUrl;
    const brandHTML = orgLogo
      ? `<img src="${orgLogo}" alt="${org.name}">`
      : `<span>${orgInitials}</span>`;

    const ventureHTML = engagement
      ? `
        <span class="topbar-divider"></span>
        <div class="topbar-venture">
          <span class="topbar-venture-name">${engagement.name}</span>
          <span class="topbar-venture-meta">${phaseLabel(engagement.phase)} · ${engagement.founderName || 'Founder'}</span>
        </div>`
      : `<span class="topbar-divider"></span>
         <div class="topbar-venture">
           <span class="topbar-venture-name">No engagement selected</span>
           <span class="topbar-venture-meta">Choose one from the login screen</span>
         </div>`;

    const founder = engagement
      ? { name: engagement.founderName, color: engagement.founderAvatarColor || org.primaryColor, initials: engagement.founderAvatar || initialsOf(engagement.founderName) }
      : null;

    return `
      <div class="topbar">
        <a href="/studio/" class="topbar-brand">
          <span class="topbar-brand-mark" style="background:${org.primaryColor || '#0036FF'};">${brandHTML}</span>
          <span class="topbar-brand-name">${org.name}</span>
        </a>
        ${ventureHTML}
        <div class="topbar-spacer"></div>
        <div class="topbar-utility">
          <a href="/studio/" class="topbar-utility-link">Switch engagement</a>
          <a href="/" class="topbar-utility-link">Powered by Ventrify OS</a>
          ${founder ? `<div class="topbar-avatar" style="background:${founder.color};" title="${founder.name}">${founder.initials}</div>` : ''}
        </div>
      </div>
    `;
  }

  function renderTabnav() {
    if (!engagement) return '';
    // Hide tab nav on the brief flow (first-run)
    if (path === 'brief.html') return '';

    const tabs = [
      { key: 'foundations',   label: 'Foundations',   href: `/studio/dashboard.html?id=${engagement.id}&group=foundations`,   badge: 3 },
      { key: 'data-room',     label: 'Data Room',     href: `/studio/dashboard.html?id=${engagement.id}&group=data-room`,     badge: 4 },
      { key: 'deliverables',  label: 'Deliverables',  href: `/studio/dashboard.html?id=${engagement.id}&group=deliverables`,  badge: 4 },
      { key: 'investability', label: 'Investability', href: `/studio/investability.html?id=${engagement.id}`,                  badge: null }
    ];
    // Group selection from URL (Foundations is the default)
    const urlGroup = params.get('group');
    const groupActive = urlGroup || (activeTab === 'foundations' ? 'foundations' : null);

    return `
      <div class="tabnav">
        ${tabs.map(t => {
          const isActive = activeTab === 'investability'
            ? t.key === 'investability'
            : t.key === (groupActive || 'foundations');
          return `
            <a href="${t.href}" class="tabnav-link ${isActive ? 'active' : ''}">
              <span>${t.label}</span>
              ${t.badge ? `<span class="badge">${t.badge}</span>` : ''}
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderDevToggle() {
    return `
      <div class="dev-toggle" role="region" aria-label="Studio dev tools">
        <span class="dev-toggle-label">Studio</span>
        <button class="dev-toggle-reset" onclick="window.__studioReset()" title="Clear studio session (keeps workspace data)">Reset session</button>
      </div>
    `;
  }
  window.__studioReset = function() {
    if (!window.confirm('Clear all locally-saved Studio responses (brief content, card responses) but keep the engagement and organisation? Reloads after.')) return;
    // For now there's nothing studio-specific in localStorage. Once brief/responses ship, wipe them here.
    window.location.href = '/studio/';
  };

  // Public renderer — page scripts call this with their main content HTML
  window.renderShell = function(mainContentHTML, opts) {
    opts = opts || {};
    const skipTabnav = opts.skipTabnav === true;
    document.body.innerHTML = `
      <div class="app-shell">
        ${renderTopbar()}
        ${skipTabnav ? '' : renderTabnav()}
        <main class="main">
          ${mainContentHTML}
        </main>
      </div>
      ${renderDevToggle()}
    `;
  };
})();
