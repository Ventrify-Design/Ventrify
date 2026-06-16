/**
 * Ventrify OS — App Shell  (SHARED renderer · single source of truth)
 *
 * Renders the framed-console chrome BOTH surfaces share:
 *   sticky topbar (partnership lockup + utility links + avatar)
 *   + left sidebar (sectioned nav, active rail, badges)
 *   + inset main + mobile off-canvas drawer.
 *
 * Consumers build a small config and call renderAppShell(cfg):
 *   · Operator Workspace (workspace/app.js) — Ventrify OS · Org lockup, operator nav
 *   · Founder Studio     (studio/app.js)    — Org · Venture lockup, founder nav
 *
 * The CSS lives in shared/shell.css; behaviour (the drawer toggle) is wired
 * once via wireAppShell(). Neither surface hand-builds shell markup any more —
 * change the chrome here and both move together.
 *
 * ── Config shape ───────────────────────────────────────────────
 *   lockup:  [ item, item, ... ]   // joined by dividers (left→right)
 *     item = { href?, title?, itemCls?,
 *              mark: { html?|text?, bg?, cls? },
 *              name: { html } | string }
 *   utility: [ { label, href?, onclick?, cls? } ]
 *   avatar:  { initials, bg, title } | null
 *   nav:     [ { section?, links: [ { href, icon?, label, badge?, active?, title? } ] } ]
 *   main:    HTML string (page content)
 *   after:   HTML string appended after the shell (e.g. dev/session toggle)
 */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MENU_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

function lockupItemHTML(item) {
  if (!item) return '';
  const tag = item.href ? 'a' : 'span';
  const attrs = (item.href ? ` href="${esc(item.href)}"` : '') + (item.title ? ` title="${esc(item.title)}"` : '');
  const m = item.mark || {};
  const markStyle = m.bg ? ` style="background:${esc(m.bg)};"` : '';
  const markInner = m.html != null ? m.html : `<span class="topbar-lockup-mark-text">${esc(m.text || '')}</span>`;
  const name = item.name && item.name.html != null ? item.name.html
    : esc(item.name && item.name.text != null ? item.name.text : (item.name || ''));
  return `<${tag} class="topbar-lockup-item${item.itemCls ? ' ' + item.itemCls : ''}"${attrs}>
      <span class="topbar-lockup-mark${m.cls ? ' ' + m.cls : ''}"${markStyle}>${markInner}</span>
      <span class="topbar-lockup-name">${name}</span>
    </${tag}>`;
}

function topbarHTML(cfg) {
  const lockup = (cfg.lockup || []).filter(Boolean)
    .map(lockupItemHTML).join('<span class="topbar-lockup-divider" aria-hidden="true"></span>');
  const utility = (cfg.utility || []).filter(Boolean).map(u =>
    `<a class="topbar-utility-link${u.cls ? ' ' + u.cls : ''}" href="${esc(u.href || '#')}"${u.onclick ? ` onclick="${u.onclick}"` : ''}>${esc(u.label)}</a>`
  ).join('');
  const a = cfg.avatar;
  const avatar = a ? `<div class="avatar topbar-avatar" style="background:${esc(a.bg)};" title="${esc(a.title || '')}">${esc(a.initials || '')}</div>` : '';
  // Solo shells (loading/error/focused) have no nav, so no hamburger.
  const menuBtn = cfg.noMenu ? '' : `<button class="topbar-menu-btn" aria-label="Toggle navigation" aria-expanded="false" aria-controls="app-sidebar">${MENU_SVG}</button>`;
  return `
    <div class="topbar">
      ${menuBtn}
      <div class="topbar-lockup">${lockup}</div>
      <div class="topbar-spacer"></div>
      <div class="topbar-utility">${utility}${avatar}</div>
    </div>`;
}

function sidebarHTML(cfg) {
  const body = (cfg.nav || []).filter(Boolean).map(sec => {
    const header = sec.section ? `<div class="sidebar-section">${esc(sec.section)}</div>` : '';
    const links = (sec.links || []).filter(Boolean).map(l => {
      const icon = l.icon ? `<span class="sidebar-link-icon">${l.icon}</span>` : '';
      const badge = (l.badge != null && l.badge !== '') ? `<span class="badge">${esc(l.badge)}</span>` : '';
      return `<a href="${esc(l.href)}" class="sidebar-link ${l.active ? 'active' : ''}"${l.title ? ` title="${esc(l.title)}"` : ''}>${icon}<span>${esc(l.label)}</span>${badge}</a>`;
    }).join('');
    return header + links;
  }).join('');
  return `<aside class="sidebar" id="app-sidebar">${body}</aside>`;
}

/** Build the full shell HTML string from a config.
 *  No nav links → "solo" shell: topbar + full-width main, no sidebar/drawer
 *  (loading, error, and focused single-task screens). */
export function renderAppShell(cfg) {
  cfg = cfg || {};
  const hasNav = (cfg.nav || []).some(s => s && (s.links || []).length);
  if (!hasNav) {
    return topbarHTML({ ...cfg, noMenu: true }) + `
    <div class="app-shell app-shell--solo">
      <main class="main">
        <div class="main-inner">${cfg.main || ''}</div>
      </main>
    </div>
    ${cfg.after || ''}`;
  }
  return topbarHTML(cfg) + `
    <div class="app-shell">
      ${sidebarHTML(cfg)}
      <main class="main">
        <div class="main-inner">${cfg.main || ''}</div>
      </main>
    </div>
    <div class="nav-scrim" aria-hidden="true"></div>
    ${cfg.after || ''}`;
}

/** Render the shell into <body>. Equivalent to setting body.innerHTML. */
export function mountAppShell(cfg) {
  document.body.innerHTML = renderAppShell(cfg);
}

/** Wire the mobile drawer once. Delegated, so it survives body.innerHTML resets. */
export function wireAppShell() {
  if (window.__navWired) return;
  window.__navWired = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.topbar-menu-btn');
    if (btn) {
      const open = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', String(open));
      return;
    }
    if (e.target.closest('.nav-scrim') || e.target.closest('.sidebar-link')) {
      document.body.classList.remove('nav-open');
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) document.body.classList.remove('nav-open'); });
}
