// ============================================================
// Ventrify OS — Studio (founder portal) · Shell + state bootstrap (async)
//
// Data source precedence:
//   • FIREBASE_ENABLED → Firestore. Engagement chosen by ?id (any viewer)
//     or, for a signed-in founder, matched by their email.
//   • FIREBASE off     → localStorage (the old shared-origin behaviour).
//
// Async, so loaded as type="module" and exposes `window.STUDIO_READY`.
// Every Studio page does `await window.STUDIO_READY` before reading STUDIO.
// ============================================================

import { FIREBASE_ENABLED } from '../firebase/config.js';

const FB_AUTH_URL = 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

// ----- Labels + helpers ---------------------------------------------------
const HUB_LABELS = {
  research: 'Research Hub', vision: 'Vision Hub', strategy: 'Strategy Hub',
  financials: 'Financials Hub', marketing: 'Marketing Hub', video: 'Video Hub', blog: 'Blog Hub'
};
const HUB_GROUPS = {
  foundations:  ['brief', 'lexicon', 'brand'],
  'data-room':  ['research', 'vision', 'strategy', 'financials'],
  deliverables: ['marketing', 'video', 'blog', 'app']
};
const FOUNDATIONS_LABELS = { brief: 'Brief snapshot', lexicon: 'Lexicon', brand: 'Brand kit' };
const DELIVERABLE_LABELS = { marketing: 'Marketing site', video: 'Promo video', blog: 'Blog content', app: 'MVP app' };

function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function initialsOf(s) {
  const parts = (s || '').trim().split(/\s+/);
  const a = (parts[0] || '?')[0] || '?';
  const b = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
  return (a + b).toUpperCase().slice(0, 2);
}
function phaseLabel(p) {
  return ({ 0: 'Phase 0 · Intake', 1: 'Phase 1 · Discover', 2: 'Phase 2 · Define',
    2.5: 'Phase 2.5 · Financials', 3: 'Phase 3 · Design', 4: 'Phase 4 · Develop',
    4.5: 'Phase 4B · Beta', 5: 'Phase 5 · Deliver' })[p] || `Phase ${p}`;
}

const path = window.location.pathname.split('/').pop() || 'dashboard.html';
const params = new URLSearchParams(window.location.search);

// ----- Org branding -------------------------------------------------------
function applyBranding(org) {
  if (!org || !org.primaryColor) return;
  if (document.getElementById('studio-brand-vars')) return;
  const hex = org.primaryColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const styleEl = document.createElement('style');
  styleEl.id = 'studio-brand-vars';
  styleEl.textContent = `:root { --brand-primary: ${org.primaryColor}; --brand-primary-rgb: ${r}, ${g}, ${b}; --primary: ${org.primaryColor}; }`;
  document.head.appendChild(styleEl);
}

// ----- Assemble window.STUDIO ---------------------------------------------
function buildStudio({ org, programs, engagement, user, mode }) {
  applyBranding(org);
  window.STUDIO = {
    org, programs, engagement, user: user || null, mode,
    labels: { hub: HUB_LABELS, foundations: FOUNDATIONS_LABELS, deliverables: DELIVERABLE_LABELS, phase: phaseLabel },
    groups: HUB_GROUPS,
    helpers: { initialsOf, readJSON, writeJSON, phaseLabel }
  };
  return window.STUDIO;
}

// ----- LIVE (Firestore) path ----------------------------------------------
async function awaitCurrentUser() {
  const { auth } = await import('../firebase/firebase.js');
  const { onAuthStateChanged } = await import(FB_AUTH_URL);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
}

async function loadLive() {
  const data = await import('../firebase/data.js');
  const user = await awaitCurrentUser();
  const org = await data.getOrganisation();

  const requestedId = params.get('id');
  // A signed-in founder's own engagements (matched by invite email).
  let programs = [];
  if (user && user.email) {
    try { programs = await data.listEngagementsForFounder(user.email); } catch (e) { programs = []; }
  }

  let engagement = null;
  if (requestedId) {
    engagement = await data.getEngagement(requestedId); // ?id works for any viewer (e.g. operator preview)
  } else if (programs.length === 1) {
    engagement = programs[0];
  }

  return buildStudio({ org, programs, engagement, user, mode: 'live' });
}

// ----- LOCAL (localStorage) path — pre-Firebase behaviour -----------------
function loadLocal() {
  const org = readJSON('workspace.organisation', null);
  const programs = readJSON('workspace.programs', []);
  const requestedId = params.get('id');
  let engagement = null;
  if (requestedId) {
    engagement = programs.find(p => p.id === requestedId || p.slug === requestedId) || null;
  } else if (programs.length === 1) {
    engagement = programs[0];
  }
  return buildStudio({ org, programs, engagement, user: null, mode: 'local' });
}

async function bootstrap() {
  if (FIREBASE_ENABLED) return loadLive();
  return loadLocal();
}

window.STUDIO_READY = bootstrap();

// ============================================================
//  Shell rendering — reads window.STUDIO at call time (after READY)
// ============================================================
const activeTab = ({
  'dashboard.html': 'foundations', 'brief.html': 'foundations',
  'hub.html': null, 'investability.html': 'investability'
})[path] || null;

function renderTopbar() {
  const S = window.STUDIO;
  const org = S.org, engagement = S.engagement;
  if (!org) {
    return `
      <div class="topbar">
        <a href="/studio/" class="topbar-brand">
          <span class="topbar-brand-mark">V</span>
          <span class="topbar-brand-name">Ventrify Studio</span>
        </a>
        <div class="topbar-spacer"></div>
        <div class="topbar-utility"><a href="/" class="topbar-utility-link">OS site</a></div>
      </div>`;
  }
  const orgInitials = initialsOf(org.name);
  const orgLogo = org.logoDataUrl || org.logoUrl;
  const brandHTML = orgLogo ? `<img src="${orgLogo}" alt="${org.name}">` : `<span>${orgInitials}</span>`;

  const ventureHTML = engagement
    ? `<span class="topbar-divider"></span>
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
    </div>`;
}

function renderTabnav() {
  const S = window.STUDIO;
  const engagement = S.engagement;
  if (!engagement) return '';
  if (path === 'brief.html') return '';

  const tabs = [
    { key: 'foundations',   label: 'Foundations',   href: `/studio/dashboard.html?id=${engagement.id}&group=foundations`,  badge: 3 },
    { key: 'data-room',     label: 'Data Room',     href: `/studio/dashboard.html?id=${engagement.id}&group=data-room`,    badge: 4 },
    { key: 'deliverables',  label: 'Deliverables',  href: `/studio/dashboard.html?id=${engagement.id}&group=deliverables`, badge: 4 },
    { key: 'investability', label: 'Investability', href: `/studio/investability.html?id=${engagement.id}`,                 badge: null }
  ];
  const urlGroup = params.get('group');
  const groupActive = urlGroup || (activeTab === 'foundations' ? 'foundations' : null);

  return `
    <div class="tabnav">
      ${tabs.map(t => {
        const isActive = activeTab === 'investability' ? t.key === 'investability' : t.key === (groupActive || 'foundations');
        return `<a href="${t.href}" class="tabnav-link ${isActive ? 'active' : ''}"><span>${t.label}</span>${t.badge ? `<span class="badge">${t.badge}</span>` : ''}</a>`;
      }).join('')}
    </div>`;
}

function renderDevToggle() {
  const S = window.STUDIO;
  const who = S.user && S.user.email ? S.user.email : (S.mode === 'live' ? 'not signed in' : 'local');
  return `
    <div class="dev-toggle" role="region" aria-label="Studio session">
      <span class="dev-toggle-label">${S.mode === 'live' ? 'Live · ' + who : 'Studio'}</span>
      <button class="dev-toggle-reset" onclick="window.__studioReset()" title="Sign out / reset this session">${S.mode === 'live' ? 'Sign out' : 'Reset session'}</button>
    </div>`;
}

window.__studioReset = async function() {
  if (FIREBASE_ENABLED) {
    if (!window.confirm('Sign out of the Studio?')) return;
    try { const { signOutUser } = await import('../firebase/auth.js'); await signOutUser(); } catch (e) {}
    window.location.href = '/studio/';
    return;
  }
  if (!window.confirm('Clear locally-saved Studio responses but keep the engagement? Reloads after.')) return;
  window.location.href = '/studio/';
};

window.renderShell = function(mainContentHTML, opts) {
  opts = opts || {};
  const skipTabnav = opts.skipTabnav === true;
  document.body.innerHTML = `
    <div class="app-shell">
      ${renderTopbar()}
      ${skipTabnav ? '' : renderTabnav()}
      <main class="main">${mainContentHTML}</main>
    </div>
    ${renderDevToggle()}`;
};
