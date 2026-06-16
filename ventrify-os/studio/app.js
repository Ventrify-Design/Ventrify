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
import { renderAppShell, wireAppShell } from '../shared/shell.js';

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
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  styleEl.textContent = `:root { --brand-primary: ${org.primaryColor}; --brand-primary-rgb: ${r}, ${g}, ${b}; --primary: ${org.primaryColor}; --primary-rgb: ${r}, ${g}, ${b}; }`;
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

  // The Studio shows the OPERATOR ORG that owns the founder's engagement — its
  // name + brand — not the default tenant. Resolve the org from the engagement's
  // orgId (engagement/program loaded first), then fetch that org.
  const orgId = (engagement && engagement.orgId) || (programs[0] && programs[0].orgId) || data.getOrgContext();
  data.setOrgContext(orgId);
  const org = await data.getOrganisation();

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

// Topbar config for the shared shell — Org · Venture lockup (mirrors the
// Workspace's Ventrify OS · Org lockup), utility links + the founder avatar.
function shellTopbarConfig() {
  const S = window.STUDIO;
  const org = S.org, engagement = S.engagement;

  // Pre-login (no org): a minimal Ventrify Studio lockup.
  if (!org) {
    return {
      lockup: [{ href: '/studio/', title: 'Ventrify Studio',
        mark: { html: 'V', cls: 'topbar-lockup-mark-ventrify' }, name: { text: 'Ventrify Studio' } }],
      utility: [{ label: 'OS site', href: '/' }],
      avatar: null,
    };
  }

  const orgLogo = org.logoDataUrl || org.logoUrl;
  const orgMark = orgLogo ? `<img src="${esc(orgLogo)}" alt="${esc(org.name)}">` : `<span class="topbar-lockup-mark-text">${esc(initialsOf(org.name))}</span>`;
  const orgItem = {
    href: '/studio/', title: org.name,
    mark: { bg: org.primaryColor || '#0036FF', html: orgMark },
    name: { text: org.name },
  };

  const ventureItem = engagement
    ? { title: `${engagement.name} · ${phaseLabel(engagement.phase)}`,
        mark: { bg: 'var(--text)', text: initialsOf(engagement.name) },
        name: { html: `${esc(engagement.name)} <span class="lockup-name-weak">Phase ${esc(engagement.phase)}</span>` } }
    : { itemCls: 'topbar-lockup-empty',
        mark: { html: '?', cls: 'topbar-lockup-mark-empty' },
        name: { text: 'No engagement selected' } };

  const founder = engagement
    ? { initials: engagement.founderAvatar || initialsOf(engagement.founderName), bg: engagement.founderAvatarColor || org.primaryColor, title: engagement.founderName }
    : null;

  return {
    lockup: [orgItem, ventureItem],
    utility: [
      { label: 'Switch engagement', href: '/studio/' },
      { label: 'Powered by Ventrify OS', href: '/' },
    ],
    avatar: founder,
  };
}

// Left side-nav config for the shared shell — the founder's venture journey
// (was the top tabnav). Same active logic; grouped Your venture / Outcome.
function shellNavConfig() {
  const S = window.STUDIO;
  const engagement = S.engagement;
  if (!engagement) return [];
  const id = engagement.id;
  const groupActive = params.get('group') || (activeTab === 'foundations' ? 'foundations' : null);
  const isActive = (key) => activeTab === 'investability' ? key === 'investability' : key === (groupActive || 'foundations');
  return [
    { section: 'Your venture', links: [
      { href: `/studio/dashboard.html?id=${id}&group=foundations`,  icon: '&#x25A4;', label: 'Foundations',  badge: 3, active: isActive('foundations') },
      { href: `/studio/dashboard.html?id=${id}&group=data-room`,    icon: '&#x25A6;', label: 'Data Room',    badge: 4, active: isActive('data-room') },
      { href: `/studio/dashboard.html?id=${id}&group=deliverables`, icon: '&#x25C9;', label: 'Deliverables', badge: 4, active: isActive('deliverables') },
    ]},
    { section: 'Outcome', links: [
      { href: `/studio/investability.html?id=${id}`, icon: '&#x25C8;', label: 'Investability', active: isActive('investability') },
    ]},
  ];
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
  const solo = opts.skipTabnav === true;   // loading / error / focused brief — topbar only
  document.body.innerHTML = renderAppShell({
    ...shellTopbarConfig(),
    nav: solo ? [] : shellNavConfig(),
    main: mainContentHTML,
    after: renderDevToggle(),
  });
};

// Mobile nav drawer — delegated listeners survive renderShell()'s innerHTML reset.
wireAppShell();
