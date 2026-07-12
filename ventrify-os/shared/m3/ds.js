// ============================================================
// Ventrify OS — Design System · render functions
// Every component + widget is a pure function: data in, HTML string out.
// The showcase AND the workspace pages call these, so a change here rolls
// through everywhere. Styling lives in theme.css (tokens) + ds.css (components).
// ============================================================

// Canonical VSS sub-signal questions — reused from the shared workspace renderer so
// the assess drill-down and the live scorecard never diverge (keep-DS-in-sync).
import { SUB_Q } from '../investability-view.js';

// Full HTML escaper — text AND attribute-safe (quotes escaped so a value can't break out of
// style="…"/src="…"/title="…"). No onclick handler in this file interpolates esc(), so quote
// escaping is safe DS-wide. Exported as _esc so the workspace M3 modules share ONE real escaper.
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export { esc as _esc };
const AVAC = { t: 'var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)', p: 'var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)', s: 'var(--success-container);color:var(--on-success-container)' };

// ---- small components ----
export const statusPill = s => `<span class="status ${s.kind}"${s.title ? ` title="${esc(s.title)}"` : ''}>${s.icon ? `<span class="material-symbols-rounded">${s.icon}</span> ` : ''}${esc(s.label)}</span>`;
export const recPill = (kind, label, icon, extra = '') => `<span class="rec ${kind}"${extra}><span class="material-symbols-rounded">${icon}</span> ${esc(label)}</span>`;
export const overline = t => `<span class="overline">${esc(t)}</span>`;
const convSeg = conv => { const on = conv === 'High' ? 4 : conv === 'Medium' ? 3 : 2; return `<span class="seg">${[1,2,3,4,5].map(n => `<i class="${n <= on ? 'on' : ''}"></i>`).join('')}</span>`; };

// ---- 7-axis radar (now solid, potential dashed) — computed from data ----
const AXES = ['team', 'market', 'product', 'moat', 'financial', 'execution', 'evidence'];
const AXLABEL = { team: 'TEAM', market: 'MARKET', product: 'PRODUCT', moat: 'MOAT', financial: 'FINANCIAL', execution: 'EXEC', evidence: 'EVIDENCE' };
function poly(byKey, R) {
  return AXES.map((k, i) => { const a = -Math.PI / 2 + i * (2 * Math.PI / 7); const v = byKey[k] != null ? byKey[k] : 0; return `${(150 + Math.cos(a) * R * v).toFixed(1)},${(150 + Math.sin(a) * R * v).toFixed(1)}`; }).join(' ');
}
export function radar(score, { max = 360 } = {}) {
  const nowF = {}, potF = {}; score.categories.forEach(c => { nowF[c.key] = c.frac; potF[c.key] = c.pot != null ? c.pot : c.frac; });
  const R = 115, gridR = [1, 0.5];
  const grids = gridR.map(g => `<polygon points="${poly(Object.fromEntries(AXES.map(k => [k, g])), R)}" fill="none" stroke="var(--md-sys-color-surface-container-highest)"/>`).join('');
  const axes = AXES.map((k, i) => { const a = -Math.PI / 2 + i * (2 * Math.PI / 7); return `<line x1="150" y1="150" x2="${(150 + Math.cos(a) * R).toFixed(1)}" y2="${(150 + Math.sin(a) * R).toFixed(1)}" stroke="var(--md-sys-color-surface-container-highest)"/>`; }).join('');
  const nowPts = poly(nowF, R), potPts = poly(potF, R);
  const dots = AXES.map((k, i) => { const a = -Math.PI / 2 + i * (2 * Math.PI / 7); const v = nowF[k]; return `<circle cx="${(150 + Math.cos(a) * R * v).toFixed(1)}" cy="${(150 + Math.sin(a) * R * v).toFixed(1)}" r="3.4" fill="var(--md-sys-color-primary)"/>`; }).join('');
  const labels = AXES.map((k, i) => { const a = -Math.PI / 2 + i * (2 * Math.PI / 7), LR = 138; let x = 150 + Math.cos(a) * LR, y = 150 + Math.sin(a) * LR; let anc = 'middle'; if (Math.cos(a) > 0.3) anc = 'start'; else if (Math.cos(a) < -0.3) anc = 'end'; const dy = Math.sin(a) > 0.3 ? 10 : Math.sin(a) < -0.3 ? -4 : 4; return `<text x="${x.toFixed(0)}" y="${(y + dy).toFixed(0)}" text-anchor="${anc}">${AXLABEL[k]}</text>`; }).join('');
  return `<svg viewBox="-42 -20 388 346" style="width:100%;max-width:${max}px;margin:0 auto;display:block;">
    ${grids}<g>${axes}</g>
    <polygon points="${potPts}" fill="none" stroke="var(--success)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <polygon points="${nowPts}" fill="var(--md-sys-color-primary)" fill-opacity="0.28" stroke="var(--md-sys-color-primary)" stroke-width="2"/>
    ${dots}
    <g fill="var(--md-sys-color-on-surface-variant)" font-family="Roboto" font-size="11" font-weight="500" letter-spacing="0.5">${labels}</g>
  </svg>`;
}

// ---- shell: drawer / masthead / tabs / theme toggle ----
const NAV = [
  { key: 'portfolio', icon: 'dashboard', label: 'Portfolio', section: 'Operate', href: 'portfolio.html' },
  { key: 'queue', icon: 'checklist', label: 'Action queue', section: 'Operate', badge: '7', href: 'queue.html' },
  { key: 'pipeline', icon: 'monitoring', label: 'Pipeline', section: 'Operate' },
  { key: 'team', icon: 'group', label: 'Team', section: 'Manage' },
  { key: 'settings', icon: 'settings', label: 'Settings', section: 'Manage' }
];
// active = the current page's nav key; opts.badges = { key: count } overrides the static badge.
// opts.nav = an alternate NAV array (same shape) — lets a host (e.g. the live workspace, whose
// routes differ from the workshop's) supply its own destinations. Defaults to the workshop NAV.
// opts.brand = { name, sub, logo, initials, color, orgs[], activeOrgId } — replaces the hardcoded
//   "Ventrify OS" lockup with a real org lockup (+ an org-switch trigger when orgs.length>1,
//   wired to window.__wsOrgSwitch). opts.account = { initials, name, role, color } — replaces the
//   hardcoded foot with the real operator identity + a sign-out control (window.__signOut).
// BOTH default to today's exact hardcoded output when absent, so the workshop + placeholder docs
// are byte-identical.
export function drawer(active = 'portfolio', opts = {}) {
  const badges = opts.badges || {};
  const items = Array.isArray(opts.nav) && opts.nav.length ? opts.nav : NAV;
  let out = '', sec = '';
  items.forEach(n => {
    if (n.section !== sec) { sec = n.section; out += `<div class="drawer-section overline">${sec}</div>`; }
    const isActive = n.key === active;
    const badge = badges[n.key] != null ? badges[n.key] : n.badge;
    const go = n.href && !isActive ? ` onclick="location.assign('${n.href}')"` : '';
    out += `<div class="nav-item ${isActive ? 'active' : ''}" tabindex="0" role="link"${go}><span class="material-symbols-rounded">${n.icon}</span><span class="nav-label">${n.label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ''}</div>`;
  });
  const b = opts.brand;
  const canSwitch = b && Array.isArray(b.orgs) && b.orgs.length > 1;
  const brandHtml = b
    ? `<div class="drawer-brand${canSwitch ? ' switch' : ''}"${canSwitch ? ' role="button" tabindex="0" onclick="window.__wsOrgSwitch&&window.__wsOrgSwitch(this)"' : ''}>
      <span class="logo"${b.color ? ` style="background:${esc(b.color)}"` : ''}>${b.logo ? `<img src="${esc(b.logo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : `<span style="font-size:13px;font-weight:700;color:#fff">${esc(b.initials || 'V')}</span>`}</span>
      <span class="wm"><span class="wm-name">${esc(b.name || 'Ventrify')}</span><small>${esc(b.sub || 'Workspace')}</small></span>${canSwitch ? '<span class="material-symbols-rounded drawer-brand-caret">unfold_more</span>' : ''}
    </div>`
    : `<div class="drawer-brand"><span class="logo"><span class="material-symbols-rounded" style="font-size:20px">bolt</span></span><span class="wm">Ventrify <small>OS</small></span></div>`;
  const ac = opts.account;
  const footHtml = ac
    ? `<div class="drawer-foot account"><span class="av"${ac.color ? ` style="background:${esc(ac.color)}"` : ''}>${esc(ac.initials || '—')}</span><span class="nm">${esc(ac.name || '')}<small>${esc(ac.role || '')}</small></span><button class="drawer-foot-signout" title="Sign out" aria-label="Sign out" onclick="window.__signOut&&window.__signOut()"><span class="material-symbols-rounded">logout</span></button></div>`
    : `<div class="drawer-foot"><span class="av">AC</span><span class="nm">Apex Capital<small>Partner workspace</small></span></div>`;
  return `<nav class="m3-drawer" id="m3-drawer">
    <button class="nav-toggle" onclick="__navButton&&__navButton()" aria-label="Collapse navigation"><span class="material-symbols-rounded">menu</span></button>
    ${brandHtml}
    ${out}
    ${footHtml}
  </nav>`;
}
export const themeToggle = () => `<div class="theme-toggle"><button data-set="light"><span class="material-symbols-rounded">light_mode</span> Light</button><button data-set="dark" class="on"><span class="material-symbols-rounded">dark_mode</span> Dark</button></div>`;
// The ONE real masthead. Emits the same new structure as mastheadPlaceholder() (mh-bar/mh-hero/
// mh-medrow/mh-compact so --mh-p can collapse it) but with real, per-page content slots.
// opts: { breadcrumb:{label,href}|false, crumbTail, eyebrow, headline, headlineMeta, compact,
//         subheading, avatar, status:{kind,label,icon}, actions:[{variant,icon,label,onclick}],
//         tabs:[labels]|false, activeTab }
// Rule: breadcrumb present → LARGE bar (whole hero collapses, compact title fades into the bar);
//       breadcrumb absent → MEDIUM bar (hero beside actions, only the subheading collapses).
// The eyebrow renders ONLY on medium bars — on breadcrumb pages the crumb is the orienting label.
const MH_NAV = '<button class="mh-nav" aria-label="Open navigation menu" aria-expanded="false" aria-controls="m3-drawer" onclick="toggleNav&&toggleNav()"><span class="material-symbols-rounded">menu</span></button>';
function mhActions(actions = []) {
  if (!actions.length) return '';
  const CLS = { filled: 'm3-btn filled', outlined: 'm3-btn outlined', text: 'm3-btn text' };
  return `<div class="mh-actions">${actions.map(a => `<button class="${CLS[a.variant] || 'm3-btn outlined'}"${a.onclick ? ` onclick="${a.onclick}"` : ''}>${a.icon ? `<span class="material-symbols-rounded">${a.icon}</span>` : ''}${esc(a.label)}</button>`).join('')}</div>`;
}
// ---- orienting label: ONE level-aware component for the L1 eyebrow ↔ L2/L3 breadcrumb ----
// trail is ordered root→current [{label, href?}]. The LAST node is the current page (accent,
// no link); ancestors are muted links; a real back-arrow (to the immediate parent) shows only
// at depth. L1 passes a single node → degenerate eyebrow. masthead() + the catalog both use this.
export function orientLabel(trail = []) {
  if (!trail.length) return '';
  const last = trail.length - 1;
  const hasAncestor = last >= 1;
  const parent = hasAncestor ? trail[last - 1] : null;
  const back = hasAncestor
    ? `<a class="orient-back" href="${esc(parent.href)}" aria-label="Back to ${esc(parent.label)}"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span></a>`
    : '';
  const parts = trail.map((s, i) => {
    const cur = i === last;
    const cls = 'orient-seg overline ' + (cur ? 'current' : 'link');
    return (s.href && !cur)
      ? `<a class="${cls}" href="${esc(s.href)}">${esc(s.label)}</a>`
      : `<span class="${cls}"${cur ? ' aria-current="page"' : ''}>${esc(s.label)}</span>`;
  }).join('<span class="orient-sep" aria-hidden="true">/</span>');
  return `<nav class="mh-orient" data-depth="${trail.length}" aria-label="${hasAncestor ? 'Breadcrumb' : 'Section'}">${back}${parts}</nav>`;
}
export const breadcrumb = orientLabel;

function mhHero(opts) {
  const av = opts.avatar ? `<span class="mh-av">${esc(opts.avatar)}</span>` : '';
  const meta = opts.headlineMeta ? ` <span class="variant">${esc(opts.headlineMeta)}</span>` : '';
  const status = opts.status ? ' ' + statusPill(opts.status) : '';
  const sub = opts.subheading ? `<div class="body-m variant mh-sub">${esc(opts.subheading)}</div>` : '';
  return `<div class="mh-hero"><div class="mh-headline-row">${av}<span class="headline-m">${esc(opts.headline)}</span>${meta}${status}</div>${sub}</div>`;
}
// ONE structure at every level → the orient label + headline hold the same position on drill/back.
// Row 1 (persistent bar): hamburger · orient (single-accent eyebrow at root / breadcrumb at depth) · compact-on-scroll · actions.
// Row 2 (hero, collapses on scroll): avatar (reserved slot) · headline · status · subheading.  Row 3: optional tabs.
export function masthead(opts = {}) {
  const hasCrumb = !!(opts.breadcrumb && opts.breadcrumb !== false);
  const hasTabs = Array.isArray(opts.tabs) && opts.tabs.length > 0;
  const actions = mhActions(opts.actions);
  const tabs = hasTabs ? `<div class="m3-tabs" role="tablist">${opts.tabs.map((t, i) => `<button class="m3-tab${i === (opts.activeTab || 0) ? ' active' : ''}" role="tab" aria-selected="${i === (opts.activeTab || 0)}">${esc(t)}</button>`).join('')}</div>` : '';
  const trail = hasCrumb ? [opts.breadcrumb].concat(opts.crumbTail ? [{ label: opts.crumbTail }] : []) : (opts.eyebrow ? [{ label: opts.eyebrow }] : []);
  const orient = orientLabel(trail);
  const cls = `masthead${hasTabs ? '' : ' mh-notabs'}${opts.avatar ? ' has-av' : ''}`;
  return `<div class="${cls}">
    <div class="m3-appbar mh-bar"><div class="mh-lead">${MH_NAV}${orient}<span class="mh-compact headline-m">${esc(opts.compact || opts.headline)}</span></div>${actions}</div>
    ${mhHero(opts)}${tabs}</div>`;
}

// ---- placeholder shell chrome (DESIGN-SYSTEM ONLY — generic labels, never product content) ----
// The real drawer()/masthead() carry live labels for the Pages. These render
// the SAME structure with placeholder labels, for documenting the shell.
export function drawerPlaceholder() {
  const item = on => `<div class="nav-item${on ? ' active' : ''}" tabindex="0" role="link"><span class="material-symbols-rounded">square</span><span class="nav-label">Navigation item</span></div>`;
  return `<nav class="m3-drawer" id="m3-drawer">
    <button class="nav-toggle" onclick="__navButton&&__navButton()" aria-label="Collapse navigation"><span class="material-symbols-rounded">menu</span></button>
    <div class="drawer-brand"><span class="logo"><span class="material-symbols-rounded" style="font-size:20px">widgets</span></span><span class="wm">Product <small>name</small></span></div>
    <div class="drawer-section overline">Section</div>
    ${item(true)}${item()}${item()}
    <div class="drawer-section overline">Section</div>
    ${item()}${item()}
    <div class="drawer-foot"><span class="av">A</span><span class="nm">Account name<small>Role</small></span></div>
  </nav>`;
}
// opts: { breadcrumb=true, tabs=true, tag }
// The headline+subheading always live together in .mh-hero (identical headline-m token
// and 6px spacing), so switching the breadcrumb never changes their typography or gap.
// With a breadcrumb → LARGE app bar: [breadcrumb + actions] over the hero; on scroll the
//   whole hero collapses and a compact title fades into the bar.
// Without a breadcrumb → MEDIUM app bar: the hero sits beside the actions (no dead top row);
//   on scroll only the subheading collapses, the headline holds.
// DESIGN-SYSTEM docs placeholder — just masthead() with generic labels, so Pages (real) and
// docs (placeholder) render from ONE structure source and can never drift.
export function mastheadPlaceholder(opts = {}) {
  const crumb = opts.breadcrumb === false ? false : { label: 'Section', href: '#' };
  return masthead({
    breadcrumb: crumb,
    crumbTail: crumb ? 'Page' : undefined,   // a real 2-level breadcrumb, so the docs show the back-arrow + scroll/mobile behaviour
    eyebrow: 'Section',
    headline: 'Headline here',
    compact: 'Headline here',
    subheading: 'Subheading here',
    actions: [{ variant: 'outlined', label: 'Button' }, { variant: 'filled', label: 'Button' }],
    tabs: opts.tabs === false ? false : ['Tab', 'Tab', 'Tab', 'Tab']
  });
}

// ---- UI shell scaffold (TEMPLATE): drawer + masthead + empty, labelled content slot ----
// Content-agnostic. Drawer (left) and masthead (top) are persistent shell
// regions; a Page fills the masthead's inner content and the content slot.
// cfg composes the shell from component instances: { nav:'drawer'|'rail', aux:'push'|'overlay'|'', rail:'on'|'' }
export function shellScaffold(cfg = {}) {
  const skCard = () => `<div class="sk-card"><div class="sk line" style="width:42%;height:26px"></div><div class="sk line" style="width:72%"></div></div>`;
  const tallCard = () => `<div class="sk-card tall"><div class="sk line" style="width:30%"></div><div class="sk line" style="width:100%"></div><div class="sk line" style="width:100%"></div><div class="sk line" style="width:92%"></div><div class="sk line" style="width:96%"></div></div>`;
  const railed = cfg.nav === 'rail';
  const aux = (cfg.aux === 'push' || cfg.aux === 'overlay') ? cfg.aux : null;
  const auxMode = aux === 'overlay' ? 'overlay' : 'push';   // the mode the trigger cards reopen in
  const hasRail = cfg.rail === 'on' || cfg.rail === 'true' || cfg.rail === true;
  const cls = ['m3-app', railed && 'rail', hasRail && 'has-utilrail', aux && 'aux-open', aux === 'push' && 'aux-push', aux === 'overlay' && 'aux-modal'].filter(Boolean).join(' ');
  const tools = [{ key: 'a', icon: 'build', label: 'Tool' }, { key: 'b', icon: 'insights', label: 'Tool' }, { key: 'c', icon: 'notifications', label: 'Tool' }, { key: 'd', icon: 'bookmark', label: 'Tool' }];
  const mhOpts = { breadcrumb: cfg.crumb !== 'off', tabs: cfg.tabs !== 'off' };
  // .m3-main is the scroll container so the sticky masthead minifies as content scrolls under it
  return `<div class="${cls}" data-aux-mode="${auxMode}" style="min-height:0;height:100%">
    ${drawerPlaceholder()}
    <main class="m3-main shell-main">
      ${mastheadPlaceholder(mhOpts)}
      <div class="shell-body">
        <div class="sk-row">${skCard()}${skCard()}${skCard()}${skCard()}</div>
        ${auxTriggerCards()}
        ${tallCard()}${tallCard()}
      </div>
    </main>
    ${auxPanel(aux ? auxDemoContent() : {})}
    ${hasRail ? utilRail(tools) : ''}
  </div>`;
}

// ---- pageShell: the real-content template every Page mounts through ----
// Mirrors shellScaffold's regions but takes real content. The `app-scroll` class height-bounds
// .m3-app so .shell-main actually scrolls and the sticky masthead can minify. Call initShell()
// after injecting this into the DOM.
export function pageShell({ active = 'portfolio', masthead = '', body = '', aux = false, drill = false, rail = false, railOverflow = [], auxMode = 'push', badges, nav, brand, account } = {}) {
  const hasRail = Array.isArray(rail) ? rail.length > 0 : !!rail;
  const tools = [{ id: 'a', icon: 'build', label: 'Tool' }, { id: 'b', icon: 'insights', label: 'Tool' }, { id: 'c', icon: 'notifications', label: 'Tool' }];
  return `<div class="m3-app app-scroll${hasRail ? ' has-utilrail' : ''}" data-aux-mode="${auxMode}">
    ${drawer(active, { badges, nav, brand, account })}
    <main class="m3-main shell-main">
      ${masthead}
      <div class="shell-body">${body}</div>
    </main>
    ${drill ? drillSurface() : ''}
    ${aux ? auxPanel(aux === true ? {} : aux) : ''}
    ${hasRail ? utilRail(Array.isArray(rail) ? rail : tools, { overflow: railOverflow }) : ''}
  </div>`;
}

// ---- Drill surface (the "companion page") ----
// Injected immediately AFTER <main> so DOM order matches visual order (WCAG 1.3.2 / 2.4.3) and so
// document.querySelector('.shell-main') still resolves the primary page first. Empty and off-canvas
// at rest: no masthead, no filled button, nothing for the conformance probes to trip over.
// Content is written by window.openDrill(); see initShell().
export function drillSurface() {
  return `<section class="m3-drill" role="region" aria-hidden="true" tabindex="-1"></section>`;
}

// drillClose — ATOM. The drill's dismiss control: a large target in the top-right of its masthead.
// Deliberately NOT a .m3-btn (so it can never be mistaken for the page's primary action, and the
// conformance "≤1 filled in .mh-actions" rule is untouched) and deliberately NOT inside .mh-actions.
// Dismissal is separate from orientation: the breadcrumb tells you where you are, this gets you out.
export function drillClose() {
  return `<button type="button" class="drill-close" aria-label="Close" title="Close (Esc)" onclick="window.closeDrill&&window.closeDrill()"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>`;
}

// ---- Auxiliary panel (right side sheet) — drill-down / tooling ----
// Right-anchored panel with two modes: push (shell grid reflows, content narrows)
// and overlay (modal, over a scrim). Content injected by openAux(); dismissed via
// the ✕, the scrim, or Esc. The panel + scrim live inside .m3-app.
export function auxPanel(opts = {}) {
  return `<aside class="m3-aux" aria-label="Auxiliary panel">
    <div class="aux-head">
      <div class="aux-head-txt"><div class="overline aux-sub">${esc(opts.subtitle || '')}</div><div class="title-l aux-title">${esc(opts.title || 'Details')}</div></div>
      <button class="aux-close" onclick="closeAux&&closeAux()" aria-label="Close panel"><span class="material-symbols-rounded">close</span></button>
    </div>
    <div class="aux-body">${opts.body || ''}</div>
    <div class="aux-foot">${opts.footer || ''}</div>
  </aside>
  <div class="m3-scrim" onclick="closeOverlay&&closeOverlay()"></div>`;
}
// skeleton drill-down content for the panel body (design-system placeholder)
export function auxDrillPlaceholder() {
  const line = w => `<div class="sk line" style="width:${w}"></div>`;
  const fig = () => `<div class="k"><div class="sk line" style="width:56%;height:22px"></div><div class="sk line" style="width:82%;margin-top:9px"></div></div>`;
  return `<span class="status info" style="align-self:flex-start">L3 · Deep research</span>
    ${line('100%')}${line('97%')}${line('90%')}
    <div class="keyfig">${fig()}${fig()}${fig()}</div>
    ${line('100%')}${line('99%')}${line('93%')}${line('100%')}${line('86%')}${line('96%')}
    <div class="overline" style="margin-top:6px">Sources</div>
    ${[0, 0, 0].map(() => `<div style="display:flex;gap:10px;align-items:center"><div class="sk" style="width:22px;height:22px;border-radius:6px;flex:none"></div>${line('72%')}</div>`).join('')}`;
}

// shared drill-down content for the panel (title/subtitle/body/footer)
export function auxDemoContent() {
  return { title: 'Headline here', subtitle: 'Deep research · placeholder', body: auxDrillPlaceholder(), footer: `<button class="m3-btn outlined">Export</button><button class="m3-btn filled" style="flex:1"><span class="material-symbols-rounded">open_in_full</span>Open full page</button>` };
}
// clickable trigger cards for the content region — these open the aux panel (so it can be reopened)
export function auxTriggerCards() {
  return `<div class="body-m variant">Click a card to drill down — the panel opens on the right and the shell reacts.</div>
    ${['query_stats', 'table_chart', 'badge', 'science'].map(ic => `<div class="m3-card aux-card" data-aux-card="1"><span class="rlead" style="background:rgba(208,188,255,0.14);flex:none"><span class="material-symbols-rounded" style="color:var(--md-sys-color-primary)">${ic}</span></span><div style="flex:1;min-width:0"><div class="title-m">Headline here</div><div class="body-m variant">Subheading here — opens drilled-down detail in the panel.</div></div><span class="material-symbols-rounded variant" style="flex:none">chevron_right</span></div>`).join('')}`;
}

// ---- Utility rail (right icon rail) — the tooling trigger for the aux panel ----
// tools = resolved auxiliary action objects {id, icon, label, panel, meta}. meta tools pin to the
// foot; opts.overflow (rare/destructive) collapses into a kebab. Each tool opens the aux panel.
export function utilRail(tools = [], opts = {}) {
  const item = t => `<button class="urail-item${t.meta ? ' urail-meta' : ''}" data-tool="${t.id || t.key}" data-panel="${t.panel || ''}" title="${esc(t.label)}" aria-label="${esc(t.label)}"><span class="material-symbols-rounded">${t.icon}</span></button>`;
  const main = tools.filter(t => !t.meta).map(item).join('');
  const meta = tools.filter(t => t.meta).map(item).join('');
  const more = (opts.overflow && opts.overflow.length)
    ? `<button class="urail-item urail-more" data-tool="__more" data-panel="more" title="More" aria-label="More actions"><span class="material-symbols-rounded">more_vert</span></button>` : '';
  return `<nav class="m3-utilrail" aria-label="Tools"${opts.auto ? ' data-auto="1"' : ''}>${main}<div class="urail-spacer"></div>${meta}${more}</nav>`;
}
// generic side-panel content for a rail tool (real per-tool content is authored later)
export function railPanel(id, label) {
  const line = w => `<div class="sk line" style="width:${w}"></div>`;
  return `<p class="body-m variant" style="margin-top:0">The <b>${esc(label)}</b> tool opens here as a side panel.</p>${line('100%')}${line('92%')}${line('97%')}${line('68%')}`;
}

// ---- stat card ----
export const statCard = s => `<div class="m3-card stat"><div class="n">${s.n}</div><div class="l">${esc(s.l)}</div>${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}</div>`;

// ---- verdict card (recommendation) ----
export function verdictCard(a, score) {
  return `<div class="m3-card">
    <div class="card-hd">${overline('Recommendation')}${overline('VSS · V3')}</div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        ${recPill('consider', a.recommendation, 'balance')}
        <div style="display:flex;align-items:center;gap:12px;margin-top:18px;"><span class="body-m variant">Conviction <b style="color:var(--md-sys-color-on-surface)">${esc(a.conviction)}</b></span>${convSeg(a.conviction)}</div>
        <div class="body-m variant" style="margin-top:12px;">Founder ask <b style="color:var(--md-sys-color-on-surface)">$20M</b> on <b style="color:var(--md-sys-color-on-surface)">$60M</b> pre · ${esc(a.askMeta)}</div>
      </div>
      <div style="text-align:right;"><div class="score">${score.composite}<small>/100</small></div><div style="margin-top:6px">${statusPill({ kind: 'warn', label: score.band, icon: 'trending_flat' })}</div></div>
    </div>
    <p class="body-l" style="margin-top:20px;"><b>Thesis.</b> ${esc(a.thesis)}</p>
    <div class="callout err" style="margin-top:18px;"><span class="material-symbols-rounded">error</span><div><b>Biggest kill-risk · ${esc(a.biggestRisk.label)}.</b> ${esc(a.biggestRisk.text)}</div></div>
    <hr class="m3-divider">
    <div class="overline" style="color:var(--success);margin-bottom:12px;">For the thesis to hold, these must be true</div>
    <div class="stack" style="gap:8px;">${a.mustBeTrue.map((m, i) => `<div class="must"><span class="n">${i + 1}</span> ${esc(m)}</div>`).join('')}</div>
    <hr class="m3-divider">
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;">${statusPill({ kind: 'ok', label: 'Confidence · ' + a.confidence.level, icon: 'verified' })}<span class="body-s variant">${esc(a.confidence.line)}</span></div>
    ${signoff(a.signoff)}
  </div>`;
}
export const signoff = s => `<div class="callout ok" style="margin-top:16px;align-items:center;justify-content:space-between;">
    <div style="display:flex;gap:12px;align-items:flex-start;"><span class="material-symbols-rounded">task_alt</span><div class="body-m"><b>Reviewed &amp; signed off</b> by <b style="color:var(--md-sys-color-on-surface)">${esc(s.by)}</b> <span class="variant">· ${esc(s.at)}</span><div class="variant" style="font-style:italic;margin-top:2px;">&ldquo;${esc(s.note)}&rdquo;</div></div></div>
    <button class="m3-btn text">Update</button>
  </div>`;



// ============================================================
// EDITORIAL ASSESSMENT — the memo-style verdict layout (assess.html).
// Every marker (severity dot, headroom tick, "→ X.X" vs "at ceiling",
// group counts, the wire gate, empty/pending states) is DERIVED from
// the data — nothing is hardcoded to one company. Styles: assess-editorial.css.
// ============================================================
const CONV_PIPS = { High: 4, Medium: 3, Low: 2 };
const NUMWORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const sevOf = frac => frac >= 0.8 ? 'strong' : frac >= 0.5 ? 'mixed' : 'gap';   // frac = score/5 → 0.8=4.0, 0.5=2.5

// convPips — the conviction segment pips (High=4 / Medium=3 / Low=2 of 5). Shared by the hero + callers.
const convPips = conv => { const on = CONV_PIPS[conv] ?? 3; return `<span class="conv">${Array.from({ length: 5 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`; };
const SCORELK_ICON = { good: 'trending_up', mid: 'trending_flat', bad: 'trending_down' };
const BAND_TONE = { Strong: 'good', Promising: 'mid', Weak: 'bad', Uninvestable: 'bad' };

// scoreLockup — MOLECULE. The headline-score lockup: eyebrow label · big number/max · a tone-coloured band
// chip · an optional now→potential bar. Generic + defaults; drops into any surface that needs a headline score.
export function scoreLockup(opts = {}) {
  const { label = 'Investability score', score = 72, max = 100, band = 'Strong', tone = 'good', bandIcon, now, potential } = opts;
  const icon = bandIcon || SCORELK_ICON[tone] || 'trending_flat';
  const hasBar = now != null && potential != null;
  const delta = hasBar ? potential - now : 0;
  return `<div class="score-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num">${esc(String(score))}<small>/${esc(String(max))}</small></div>
    ${band ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${icon}</span> ${esc(band)}</span>` : ''}
    ${hasBar ? `<div class="score-lockup-bar"><div class="track"><span class="pot" style="width:${Math.round(potential / max * 100)}%"></span><span class="now" style="width:${Math.round(now / max * 100)}%"></span></div><div class="cap"><span>Now <b>${esc(String(now))}</b></span><span>Potential <b>${esc(String(potential))}</b>${delta > 0 ? ` <span class="up">+${delta}</span>` : ''}</span></div></div>` : ''}
  </div>`;
}

// progressLockup — MOLECULE. The headline-CLEARANCE lockup: sibling to scoreLockup, sharing its big/small
// numeral + tone-chip treatment, but for a "X of N cleared" progress metric (e.g. diligence). eyebrow label ·
// big done/total · a tone status chip · a segmented severity bar (each pip coloured by kind, filled when done).
// Generic + defaults; pass `segments:[{kind,done}]` for the severity pips, else it renders a plain done/total bar.
export function progressLockup(opts = {}) {
  const {
    label = 'Cleared', labelTone = 'accent',
    done = 0, total = 9, unit = 'cleared',
    status = 'Do not wire', statusIcon = 'lock', tone = 'bad',
    segments = [], capLeft, capRight,
  } = opts;
  const segRow = segments.length
    ? segments.map(sg => `<i class="${sg.kind || 'info'}${sg.done ? ' done' : ''}"></i>`).join('')
    : Array.from({ length: Math.max(0, total) }, (_, i) => `<i class="info${i < done ? ' done' : ''}"></i>`).join('');
  const cl = capLeft != null ? capLeft : `<b>${esc(String(done))}</b> of ${esc(String(total))} ${esc(unit)}`;
  const cr = capRight != null ? capRight : '';
  return `<div class="progress-lockup">
    <span class="eyebrow ${labelTone}">${esc(label)}</span>
    <div class="lockup-num">${esc(String(done))}<small>/${esc(String(total))} ${esc(unit)}</small></div>
    ${status ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${statusIcon}</span> ${esc(status)}</span>` : ''}
    <div class="progress-lockup-bar">
      <div class="segrow">${segRow}</div>
      ${(cl || cr) ? `<div class="cap"><span>${cl}</span><span>${cr}</span></div>` : ''}
    </div>
  </div>`;
}

// tone → icon maps for the metric-lockup family
const SEV_TONE = { strong: 'good', mixed: 'mid', gap: 'bad' };   // sevOf() result → band/segment tone
const VAL_ICON = { good: 'check_circle', mid: 'trending_flat', bad: 'warning' };
const COV_ICON = { good: 'verified', mid: 'shield', bad: 'gpp_maybe' };

// profileLockup — MOLECULE. Sibling to scoreLockup: the same big numeral, re-expressed as the SHAPE of the
// score — a split of tone chips (strong/mixed/gap) + a weighted severity strip (one segment per category,
// width ∝ weight, tone by severity) + a now→potential caption. Fronts the Investability tab. Pass
// `categories` (SCORE.categories) to derive the split + strip live, or hand-drive with `split`/`segments`.
export function profileLockup(opts = {}) {
  const { label = 'Category profile', score = 64, max = 100, now = 64, potential = 82, categories, split, segments } = opts;
  let sp = split, sg = segments;
  if (categories && categories.length) {
    const c = { strong: 0, mixed: 0, gap: 0 };
    categories.forEach(x => { c[sevOf(x.frac)]++; });
    sp = sp || [
      { tone: 'good', count: c.strong, label: c.strong === 1 ? 'strong' : 'strong' },
      { tone: 'mid', count: c.mixed, label: 'mixed' },
      { tone: 'bad', count: c.gap, label: c.gap === 1 ? 'gap' : 'gaps' }
    ];
    sg = sg || [...categories].sort((a, b) => b.frac - a.frac).map(x => ({ tone: SEV_TONE[sevOf(x.frac)], w: x.weightPct || 1 }));
  }
  sp = sp || [{ tone: 'good', count: 2, label: 'strong' }, { tone: 'mid', count: 4, label: 'mixed' }, { tone: 'bad', count: 1, label: 'gap' }];
  sg = sg || [{ tone: 'good', w: 20 }, { tone: 'mid', w: 25 }, { tone: 'mid', w: 15 }, { tone: 'mid', w: 15 }, { tone: 'bad', w: 10 }, { tone: 'mid', w: 10 }, { tone: 'bad', w: 5 }];
  const delta = potential - now;
  return `<div class="profile-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num">${esc(String(score))}<small>/${esc(String(max))}</small></div>
    <div class="profile-split">${sp.filter(x => x.count).map(x => `<span class="lockup-band ${x.tone}"><b>${esc(String(x.count))}</b> ${esc(x.label)}</span>`).join('')}</div>
    <div class="profile-strip">${sg.map(x => `<span class="seg ${x.tone}" style="flex:${x.w || 1} 1 0"></span>`).join('')}</div>
    <div class="lockup-cap"><span>Now <b>${esc(String(now))}</b></span><span>Potential <b>${esc(String(potential))}</b>${delta > 0 ? ` <span class="up">+${delta}</span>` : ''}</span></div>
  </div>`;
}

// valuationLockup — MOLECULE. Sibling to scoreLockup expressing a CORRECTIVE premium: a big multiple + a
// tone verdict chip + a reprice bar (defensible band + overshoot + a marker at the ask). The inverse of
// scoreLockup's grow-up bar — reprice DOWN into a band. Fronts the Market tab. Explicit numeric opts only.
export function valuationLockup(opts = {}) {
  const {
    label = 'Valuation verdict', multiple = null, multipleSuffix = '× median',
    band = 'Fairly priced', tone = 'good', bandIcon,
    asked = 0, defensibleLo = null, defensibleHi = null, scaleMax,
    captionLo = 'Defensible', captionHi = 'Asked', askedNote = 'pre'
  } = opts;
  const icon = bandIcon || VAL_ICON[tone] || 'check_circle';
  const lo = Number(defensibleLo) || 0, hi = Number(defensibleHi) || 0;
  const hasBand = lo > 0 || hi > 0;   // a real reprice band was parsed — otherwise omit (don't render "$0–0M")
  const max = scaleMax || (Math.max(asked, hi) * 1.15) || 1;
  const pc = v => Math.max(0, Math.min(100, v / max * 100));
  const bandL = pc(lo), bandW = pc(hi) - pc(lo);
  const overW = Math.max(0, pc(asked) - pc(hi));
  return `<div class="valuation-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    ${multiple != null ? `<div class="lockup-num">${esc(String(multiple))}<small>${esc(multipleSuffix)}</small></div>` : ''}
    ${band ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${icon}</span> ${esc(band)}</span>` : ''}
    ${hasBand ? `<div class="valuation-bar">
      <div class="track">
        <span class="band" style="left:${bandL}%;width:${bandW}%"></span>
        ${overW > 0 ? `<span class="over" style="left:${pc(hi)}%;width:${overW}%"></span>` : ''}
        <span class="tick" style="left:${pc(asked)}%"></span>
      </div>
      <div class="lockup-cap"><span>${esc(captionLo)} <b>$${esc(String(lo))}–${esc(String(hi))}M</b></span><span class="over-lab">${esc(captionHi)} <b>$${esc(String(asked))}M</b>${askedNote ? ` ${esc(askedNote)}` : ''}</span></div>
    </div>` : ''}
  </div>`;
}

// coverageLockup — MOLECULE. Sibling to scoreLockup for an evidence base: a big completeness numeral + a
// confidence tone chip + a demoted provenance figure-row (no bar; a 35-segment bar would be absurd). One
// dominant numeral, not a row of equals. Fronts the Research tab.
export function coverageLockup(opts = {}) {
  const {
    label = 'Evidence base', rated = 35, total = 35, ratedLabel = 'signals rated', numeral,
    confidence = 'High', tone = 'good', confidenceIcon,
    facts = [{ v: '18', k: 'documents' }, { v: '32', k: 'sources cited' }, { v: '7', k: 'workstreams' }]
  } = opts;
  const icon = confidenceIcon || COV_ICON[tone] || 'verified';
  // `numeral` overrides the big rated/total figure — e.g. a forming snapshot that has no rated signals yet
  const numHtml = numeral != null ? numeral : `${esc(String(rated))}<small>/${esc(String(total))} ${esc(ratedLabel)}</small>`;
  return `<div class="coverage-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num">${numHtml}</div>
    ${confidence ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${icon}</span> ${esc(confidence)} confidence</span>` : ''}
    ${facts.length ? `<div class="lockup-prov">${facts.map(f => `<span class="unit"><b>${esc(f.v)}</b> ${esc(f.k)}</span>`).join('')}</div>` : ''}
  </div>`;
}

// bookLockup — MOLECULE. profileLockup's sibling for a whole PORTFOLIO read as a verdict: a positive-anchored
// on-plan numeral + a derived verdict band + the health mix as split chips + a weighted strip (one pip per
// venture up to pipMax, then a weighted 3-tone strip so 40 ventures never render 40 hairlines) + profileLockup's
// now→potential cap where +delta is exactly the ventures needing the operator. Everything derives from
// health{onTrack,attention,stuck}; every override is optional. Fronts the Portfolio screen.
export function bookLockup(opts = {}) {
  const {
    label = 'Health of the book', onPlan, total, health,
    verdict, verdictTone, verdictIcon = 'monitoring',
    split, segments, now, potential, capNow = 'Running clean', capPot = 'At plan',
    pipMax = 12, figures = [],
  } = opts;
  const h = health || {}, onT = h.onTrack || 0, att = h.attention || 0, stk = h.stuck || 0;
  const tot = total != null ? total : (onT + att + stk);
  const plan = onPlan != null ? onPlan : onT;
  let vb = verdict, vt = verdictTone;
  if (vb == null) {
    if (tot === 0) { vb = 'Nothing on the book yet'; vt = 'mid'; }
    else if (stk > 0) { vb = stk === 1 ? 'Holding — one stuck' : `Holding — ${stk} stuck`; vt = 'mid'; }   // headline stays mid; the strip carries the red
    else if (att > 0) { vb = 'Needs attention'; vt = 'mid'; }
    else { vb = 'On plan'; vt = 'good'; }
  }
  const sp = split || [{ tone: 'good', count: onT, label: 'on track' }, { tone: 'mid', count: att, label: 'attention' }, { tone: 'bad', count: stk, label: 'stuck' }];
  let sg = segments;
  if (!sg) sg = (tot > 0 && tot <= pipMax)
    ? [...Array(onT).fill('good'), ...Array(att).fill('mid'), ...Array(stk).fill('bad')].map(t => ({ tone: t, w: 1 }))   // one pip per venture (good→mid→bad)
    : [{ tone: 'good', w: onT }, { tone: 'mid', w: att }, { tone: 'bad', w: stk }].filter(x => x.w);                     // weighted 3-tone, scales to 40
  const nw = now != null ? now : plan, pt = potential != null ? potential : tot, delta = pt - nw;
  return `<div class="book-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num">${esc(String(plan))}<small>/${esc(String(tot))} on plan</small></div>
    ${vb ? `<span class="lockup-band ${vt}"><span class="material-symbols-rounded">${verdictIcon}</span> ${esc(vb)}</span>` : ''}
    <div class="profile-split">${sp.filter(x => x.count).map(x => `<span class="lockup-band ${x.tone}"><b>${esc(String(x.count))}</b> ${esc(x.label)}</span>`).join('')}</div>
    <div class="profile-strip">${sg.map(x => `<span class="seg ${x.tone}" style="flex:${x.w || 1} 1 0"></span>`).join('')}</div>
    <div class="lockup-cap"><span>${esc(capNow)} <b>${esc(String(nw))}</b></span><span>${esc(capPot)} <b>${esc(String(pt))}</b>${delta > 0 ? ` <span class="up">+${delta}</span>` : ''}</span></div>
    ${figures.length ? `<div class="lockup-prov">${figures.map(f => `<span class="unit"><b>${esc(String(f.v))}</b> ${esc(f.k)}</span>`).join('')}</div>` : ''}
  </div>`;
}

// statementLockup — MOLECULE. An eyebrow-marked headline with supporting facts — the "what" half of a
// sectionHero (the verdict on the assess page). Extractable + previewable on its own, symmetric with
// scoreLockup. Generic + defaults; eyebrow icon and facts are optional.
export function statementLockup(opts = {}) {
  const {
    eyebrow = 'The verdict', eyebrowIcon = 'balance',
    headline = 'A balanced call — proceed to diligence, not to a cheque.',
    headlineEm = 'proceed to diligence',
    facts = [{ k: 'Conviction', v: `Medium ${convPips('Medium')}` }, { k: 'The ask', v: '$8M <small>on $32M pre · Seed</small>' }]
  } = opts;
  const hl = headlineEm ? esc(headline).replace(esc(headlineEm), `<em>${esc(headlineEm)}</em>`) : esc(headline);
  const factsHtml = facts.map(f => `<div class="fact"><div class="k">${esc(f.k)}</div><div class="v">${f.v}</div></div>`).join('');
  return `<div class="statement-lockup">
    ${eyebrow ? `<span class="statement-lockup-eyebrow">${eyebrowIcon ? `<span class="material-symbols-rounded">${eyebrowIcon}</span> ` : ''}${esc(eyebrow)}</span>` : ''}
    <h1 class="statement-lockup-headline">${hl}</h1>
    ${facts.length ? `<div class="statement-lockup-facts">${factsHtml}</div>` : ''}
  </div>`;
}

// sectionHero — ORGANISM. The reusable "top of a section": a molecule on the LEFT, a molecule on the RIGHT,
// and an optional thesis paragraph beneath. The two molecules are SLOTS — swap them per section. Defaults
// to statementLockup (left) + scoreLockup (right) for the assessment verdict; pass explicit `left`/`right`
// HTML to drop in any other molecule (see the "Compose & test" configurator on widget.html?w=sectionHero).
export function sectionHero(opts = {}) {
  const {
    left, right,   // explicit slot HTML; when omitted, built from the convenience opts below
    score = { score: 64, band: 'Promising', tone: 'mid', now: 64, potential: 82 },
    thesis = 'A real, sizeable market and a capable team, held back by unproven unit economics and a still-forming moat — the shape of the risk is clear enough to price.',
    thesisLabel = 'Thesis.',
    ...statement
  } = opts;
  const leftHtml = left != null ? left : statementLockup(statement);
  const rightHtml = right != null ? right : scoreLockup(score);
  const single = !String(leftHtml).trim() || !String(rightHtml).trim();   // one slot empty → single-column, no divider
  return `<section class="sec section-hero${single ? ' single' : ''}">
      <div class="left">${leftHtml}</div>
      <div class="divide"></div>
      <div class="right">${rightHtml}</div>
    </section>${thesis ? `<p class="lead"><span class="drop">${esc(thesisLabel)}</span> ${esc(thesis)}</p>` : ''}`;
}

// ---- portfolio hero (the editorial section-hero for the Portfolio screen — same organism as the assess tabs) ----
// portfolioMetrics — the ONE place the portfolio numbers are computed (single-source; replaces the old inline stats).
function portfolioMetrics(programs = []) {
  const nm = p => p.name || 'a venture';
  const total = programs.length;
  const onTrack = programs.filter(p => p.health === 'on-track').length;
  const attention = programs.filter(p => p.health === 'attention').length;
  const stuck = programs.filter(p => p.health === 'stuck').length;
  const builds = programs.filter(p => p.engagementType !== 'assessment').length;
  const assessments = total - builds;
  const verdicts = programs.filter(p => p.assessment && p.assessment.recommendation);
  const worst = programs.find(p => p.health === 'stuck') || programs.find(p => p.health === 'attention') || null;
  const ready = verdicts[0] || null;
  return {
    total, onTrack, attention, stuck, builds, assessments,
    needsYou: attention + stuck, verdictsReady: verdicts.length,
    worstName: worst ? nm(worst) : null,
    readyName: ready ? nm(ready) : null, readyRec: ready ? ready.assessment.recommendation : null,
  };
}
// bookHeadline — the editorial headline as a pure fn of the metrics; `em` is always a verbatim substring of
// `headline` (statementLockup emphasises it). Reads across empty / 1 / 7 / 40-venture books; the em always
// points at the single highest-severity fact so even a rough book leads with "N running clean", not a crisis.
function bookHeadline(m) {
  const { total, onTrack, stuck, attention, verdictsReady, worstName } = m;
  const word = n => NUMWORD[n] ?? String(n);
  const cap = w => String(w).charAt(0).toUpperCase() + String(w).slice(1);
  if (total === 0) return { headline: 'Nothing on the book yet — add your first engagement to begin.', em: null };
  if (total === 1) {
    if (stuck) return { headline: 'The one venture on the book is stuck cold.', em: 'stuck cold' };
    if (attention) return { headline: 'The one venture on the book needs a nudge.', em: 'needs a nudge' };
    if (verdictsReady) return { headline: 'One venture on the book — its verdict is ready to read.', em: 'ready to read' };
    return { headline: 'One venture on the book, building to plan.', em: null };
  }
  const subject = `${cap(word(total))} ventures on the book`;
  const clean = onTrack === total ? 'all running clean' : onTrack > 0 ? `${word(onTrack)} running clean` : 'none running clean yet';
  let em = null, headline;
  if (stuck > 0) { em = worstName ? `${worstName} is stuck` : (stuck === 1 ? 'one is stuck' : `${stuck} are stuck`); headline = `${subject} — ${clean}, and ${em}.`; }
  else if (attention > 0) { em = attention === 1 ? 'one needs a nudge' : `${attention} need a nudge`; headline = `${subject} — ${clean}, and ${em}.`; }
  else if (verdictsReady) { em = verdictsReady === 1 ? 'one verdict to read' : `${verdictsReady} verdicts to read`; headline = `${subject} — ${clean}, and ${em}.`; }
  else { headline = `${subject}, ${clean}.`; }
  return { headline, em };
}
// bookFacts — the LEFT statement's fact chips; every number named to a real venture so the hero is auditable.
// `v` is rendered raw by statementLockup, so venture names/recommendations (user data) are esc()'d here.
function bookFacts(m) {
  const f = [{ k: 'The book', v: `${m.total} active <small>${m.builds} build · ${m.assessments} assess</small>` }];
  f.push(m.needsYou > 0
    ? { k: 'Needs you', v: `${m.needsYou} of ${m.total} <small>${[m.stuck ? `${m.stuck} stuck` : null, m.attention ? `${m.attention} attention` : null].filter(Boolean).join(' · ')}</small>` }
    : { k: 'Health', v: `${m.onTrack} of ${m.total} <small>on track</small>` });
  if (m.verdictsReady > 0) f.push({ k: 'Verdict ready', v: `${esc(m.readyName)}${m.readyRec ? ` <small>${esc(m.readyRec)}</small>` : ''}` });
  return f;
}
// bookThesis — the derived .lead/.drop coda. Returned RAW (sectionHero esc()'s the thesis).
function bookThesis(m) {
  if (m.stuck > 0) return `A small, deliberate book — most of it running to plan, with one clear call this week: unblock ${m.worstName}${m.verdictsReady ? ` and rule on ${m.readyName}` : ''}.`;
  if (m.attention > 0) return `The book is on plan bar ${m.needsYou === 1 ? 'a single venture' : `${m.needsYou} ventures`} that want a nudge — steady ${m.worstName || 'them'} and it's a clean sheet.`;
  return `The whole book is running to plan — ${m.total} venture${m.total === 1 ? '' : 's'}, nothing outstanding.`;
}
// portfolioHero — ORGANISM. The Portfolio screen's editorial section-hero: a statementLockup that reads the book
// in one auditable sentence (LEFT) beside bookLockup (RIGHT), closed by a derived thesis coda. Same organism the
// assessment tabs use, re-pointed from a single verdict to the whole book.
export function portfolioHero(programs = [], ctx = {}) {
  const m = portfolioMetrics(programs);
  const eyebrow = ctx.orgName ? ctx.orgName : 'Your book';
  if (m.total === 0) {
    return sectionHero({
      left: statementLockup({ eyebrow, eyebrowIcon: 'account_balance', headline: 'Nothing on the book yet — add your first engagement to begin.', headlineEm: null, facts: [] }),
      right: '', thesis: '',
    });
  }
  const { headline, em } = bookHeadline(m);
  return sectionHero({
    left: statementLockup({ eyebrow, eyebrowIcon: 'account_balance', headline, headlineEm: em, facts: bookFacts(m) }),
    right: bookLockup({ total: m.total, onPlan: m.onTrack, health: { onTrack: m.onTrack, attention: m.attention, stuck: m.stuck } }),
    thesisLabel: 'The read.', thesis: bookThesis(m),
  });
}

// ============================================================
// row() — THE one canonical list-row (see the row-unification plan). LEADING · BODY · [MID bar] ·
// TRAILING (+ optional full-bleed CLAUSE). Every editorial/list row is a variant of this: a modifier
// class picks the grid + which slots render + the density tier. The bespoke row fns (metricRow,
// researchRow, signalRows, founderRoster, …) become thin wrappers that translate their args to row()
// — so a change to row spacing/type/affordance happens in ONE place.
//   variant: 'metric'|'funnel'|'research'|'signal'|'lever'|'roster'|'figure'|'doc'|'numbered'|'marker'|'check'|'citation'|'spec'
//   lead:    { kind:'none'|'dot'|'chip'|'numeral'|'glyph'|'tile'|'avatar', ... } — the leading cell (per-variant DOM)
//   title, sub, sub2, cap · bar:{now,pot,tick} (metric/funnel MID) · clause (full-bleed) ·
//   trail:   { kind:'chevron'|'value'|'chip'|'word', value, valueMuted, delta:{text,tone}, ... }
//   density: 'reading'|'compact' (defaulted per variant) · onDrill, key, foot, cls
// ============================================================
const ROW_COMPACT = new Set(['roster', 'figure', 'doc', 'numbered', 'marker', 'check', 'citation', 'spec']);
// leading atoms — pure fns → the leading element. Two tone axes stay separate (verdict vs workstream-type).
function leadDot(sev) { return sev ? `<span class="mrow-dot ${sev}"></span>` : ''; }
function leadTile(icon, wtype) { return `<span class="rlead" style="background:${RTONE[wtype] || RTONE.p}"><span class="material-symbols-rounded" style="color:${RCOL[wtype] || RCOL.p}">${esc(icon || 'article')}</span></span>`; }
// trailing atoms
function trailValue(value, valueMuted, delta) {
  return `<div class="mrow-val"><span class="v">${esc(value)}${valueMuted ? `<span class="out">${esc(valueMuted)}</span>` : ''}</span>${delta ? `<span class="s ${delta.tone === 'up' ? 'up' : 'flat'}">${esc(delta.text)}</span>` : ''}</div>`;
}
const rowChev = clickable => clickable ? '<span class="material-symbols-rounded mrow-chev">chevron_right</span>' : '<span class="mrow-chev"></span>';

export function row(opts = {}) {
  const { variant = 'metric', lead = {}, title = '', sub = '', bar, trail = {}, onDrill = '', key = '', foot = false, cls = '' } = opts;
  const clickable = onDrill && !foot;
  const density = opts.density || (ROW_COMPACT.has(variant) ? 'compact' : 'reading');
  const act = clickable
    ? ` role="button" tabindex="0" onclick="${onDrill}('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onDrill}('${key}')}"`
    : '';
  const cl = ['mrow', variant, density === 'compact' && 'compact', clickable && 'drill', foot && 'foot', cls].filter(Boolean).join(' ');

  // MID bar column (metric/funnel only)
  let mid = '';
  if (bar) {
    const now = Math.max(0, Math.min(100, (bar.now || 0) * 100)).toFixed(1);
    const pot = Math.max(0, Math.min(100, (bar.pot || 0) * 100)).toFixed(1);
    const hasPot = bar.pot > (bar.now || 0) + 0.001;
    mid = `<div class="mrow-bar">${hasPot ? `<div class="pot" style="width:${pot}%"></div>` : ''}${foot ? '' : `<div class="now" style="width:${now}%"></div>`}${hasPot && bar.tick ? `<div class="tick" style="left:${pot}%"></div>` : ''}</div>`;
  }

  // trailing cell
  let tr = '';
  if (trail.kind === 'value' || (variant === 'metric' || variant === 'funnel')) tr = trailValue(trail.value, trail.valueMuted, trail.delta);

  // BODY assembly is per-variant: metric/funnel nest the dot inside .mrow-nm within .mrow-lab.
  if (variant === 'metric' || variant === 'funnel') {
    return `<div class="${cl}"${act}>
    <div class="mrow-lab"><div class="mrow-nm">${leadDot(lead.sev)}${esc(title)}</div>${sub ? `<div class="mrow-sub">${esc(sub)}</div>` : ''}</div>
    ${mid}${tr}${rowChev(clickable)}
  </div>`;
  }
  // research: a leading tile beside a text stack, trailing chip + chevron
  if (variant === 'research') {
    return `<div class="${cl}"${act}>
    <div class="mrow-lab">${leadTile(lead.icon, lead.wtype)}<div class="mrow-txt"><div class="mrow-nm">${esc(title)}</div>${sub ? `<div class="mrow-sub">${esc(sub)}</div>` : ''}${opts.cap ? `<div class="mrow-meta">${esc(opts.cap)}</div>` : ''}</div></div>
    <div class="mrow-val">${trail.chip ? statusPill(trail.chip) : ''}</div>${rowChev(clickable)}
  </div>`;
  }
  return `<div class="${cl}"${act}><div class="mrow-lab"><div class="mrow-nm">${esc(title)}</div>${sub ? `<div class="mrow-sub">${esc(sub)}</div>` : ''}</div>${rowChev(clickable)}</div>`;
}

// metricRow — thin wrapper over row() (public signature byte-identical, so strengthProfile /
// investabilityComposition and the radar arithmetic are untouched). sub2 = the trailing delta.
// opts: { key, label, sub, dot:'strong'|'mixed'|'gap'|null, bar:{now:0..1, pot:0..1, tick},
//         value, valueMuted, sub2:{text, tone:'up'|'flat'}, onDrill, foot }
export function metricRow(opts = {}) {
  const { key, label, sub, dot, bar = {}, value, valueMuted = '', sub2, onDrill = '', foot = false, cls = '' } = opts;
  return row({
    variant: (cls && /funnel/.test(cls)) ? 'funnel' : 'metric',
    key, title: label, sub, lead: { kind: 'dot', sev: dot || null }, bar,
    trail: { kind: 'value', value, valueMuted, delta: sub2 },
    onDrill, foot, cls: cls.replace(/\bfunnel\b/, '').trim(),
  });
}

// strength profile — the radar alternative. Ranked now-vs-potential bars (via metricRow), per category.
// onDrill (optional): a handler name → each row opens the per-category aux breakdown.
export function strengthProfile(s, onDrill = '') {
  const cats = [...s.categories].sort((a, b) => b.frac - a.frac);
  const count = { strong: 0, mixed: 0, gap: 0 };
  const rows = cats.map(c => {
    const k = sevOf(c.frac); count[k]++;
    const headroom = c.pot > c.frac + 0.001;
    return metricRow({
      key: c.key, label: c.label, dot: k,
      sub: `${c.weightPct}% weight${k === 'gap' ? ' · gap' : ''}`,
      bar: { now: c.frac, pot: c.pot, tick: headroom },
      value: parseFloat(c.num).toFixed(1),
      sub2: headroom ? { text: `→ ${(c.pot * 5).toFixed(1)}`, tone: 'up' } : { text: 'at ceiling', tone: 'flat' },
      onDrill
    });
  }).join('');
  const delta = s.potential - s.composite;
  const movers = cats.filter(c => c.pot > c.frac).sort((a, b) => (b.pot - b.frac) * b.weightPct - (a.pot - a.frac) * a.weightPct);
  const nm = c => `<b style="color:var(--md-sys-color-on-surface)">${esc(c.short || c.label)}</b>`;
  const clause = movers.length >= 2 ? `— a concentrated profile: closing ${nm(movers[0])} and ${nm(movers[1])} carries most of the +${delta} headroom.`
    : movers.length === 1 ? `— closing ${nm(movers[0])} carries the +${delta} headroom.`
    : `— every category is at its ceiling; the score won't move on diligence alone.`;
  const split = [count.strong && `<b class="s">${count.strong} strong</b>`, count.mixed && `<b class="m">${count.mixed} mixed</b>`, count.gap && `<b class="g">${count.gap} gap${count.gap > 1 ? 's' : ''}</b>`].filter(Boolean).join(' · ');
  return `<section class="sec" style="padding-top:8px">
    <div class="sec-head">
      <span class="eyebrow accent">Strength profile</span>
      <span class="t">Where it's strong, where it's thin</span>
      <span class="legend meta"><span class="key"><span class="sw-now"></span> Now</span><span class="key"><span class="sw-pot"></span> Potential</span></span>
    </div>
    <div class="profile">${rows}</div>
    <div class="profile-foot"><span class="split">${split}</span><span>${clause}</span></div>
  </section>`;
}

// score composition — the now-vs-potential RADAR (the centrepiece) + a per-category
// contributions breakdown. Contribution = frac × weightPct (each category's share of the
// 100 points); the bar shows points earned, the ghost the headroom to potential.
// onDrill (optional): each row opens the per-category aux breakdown.
export function investabilityComposition(s, onDrill = '') {
  const delta = s.potential - s.composite;
  const maxW = Math.max(...s.categories.map(c => c.weightPct));   // bar scale = the heaviest category's ceiling
  const rows = s.categories
    .map(c => ({ ...c, contrib: c.frac * c.weightPct, potContrib: c.pot * c.weightPct, headroom: c.pot > c.frac + 0.001 }))
    .sort((a, b) => b.contrib - a.contrib)
    .map(c => metricRow({
      key: c.key, label: c.label, dot: null,
      sub: `${c.weightPct}% weight · rated ${parseFloat(c.num).toFixed(1)}/5`,
      bar: { now: c.contrib / maxW, pot: c.potContrib / maxW, tick: false },
      value: `+${c.contrib.toFixed(1)}`,
      sub2: c.headroom ? { text: `+${(c.potContrib - c.contrib).toFixed(1)} avail.`, tone: 'up' } : { text: 'at ceiling', tone: 'flat' },
      onDrill
    })).join('');
  const foot = metricRow({ label: 'Investability score', value: `${s.composite}`, valueMuted: ' / 100', foot: true });
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">Composition</span><span class="t">How the ${s.composite} composes</span><span class="meta">7 × 5 · weighted 0–100</span></div>
    <div class="compose">
      <div class="radar-wrap">${radar(s, { max: 340 })}
        <div class="radar-legend"><span class="key"><span class="sw-now"></span> Now <b>${s.composite}</b></span><span class="key"><span class="sw-pot dash"></span> Potential <b>${s.potential}</b> <span class="up">+${delta}</span></span></div>
      </div>
      <div class="contrib">
        <div class="contrib-cap">Each category's share of the <b>100</b> points — the bar is points earned, the ghost the headroom left. ${onDrill ? 'Click a row to break it down.' : ''}</div>
        ${rows}${foot}
      </div>
    </div>
  </section>`;
}

// per-category deep breakdown for the AUX panel — the standardised 5-section scorecard
// every engagement renders identically (see the design-panel spec). Returns {title,subtitle,body}
// for window.openAux(). Backbone = the 5 VSS sub-signals (cat.subs) + the shared SUB_Q labels.
const CD_SB_WORD = { green: 'Strong', yellow: 'Mixed', red: 'Gap', unrated: 'Forming' };
const CD_VERDICT = { green: 'a load-bearing strength', yellow: 'real but uneven', red: 'a live gap', unrated: 'not yet assessed' };
const cdBand = r => r >= 0.8 ? 'green' : r >= 0.5 ? 'yellow' : 'red';
const cdSplitRef = note => { const t = String(note || ''); const i = t.indexOf(' · ref: '); return i < 0 ? { note: t || '', ref: '' } : { note: t.slice(0, i), ref: t.slice(i + 8) }; };
const cdChip = sc => sc === 1 ? '<span class="cd-chip g">1</span>' : sc === 0.5 ? '<span class="cd-chip y">½</span>' : sc === 0 ? '<span class="cd-chip r">0</span>' : '<span class="cd-chip n">–</span>';
// signalRows — the 5 VSS sub-signals as chip · canonical question · note rows. SHARED by categoryDetail's
// aux drill and the Research evidenceIntegrity surface, so the two never drift. Unrated → the forming '–' chip.
export function signalRows(subs = []) {
  return subs.map(x => {
    const { note, ref } = cdSplitRef(x.note);
    const cls = x.score == null ? 'na' : x.score === 1 ? 'g' : x.score === 0.5 ? 'y' : 'r';
    return `<div class="cd-sig ${cls}">${cdChip(x.score)}<div class="bd"><div class="q">${esc(SUB_Q[x.slug] || x.slug)}</div><div class="nt${note ? '' : ' muted'}">${note ? esc(note) : 'Not yet scored — assessed when the research run completes.'}</div></div>${ref ? `<span class="cd-ev" title="${esc(ref)}">${esc(ref)}</span>` : ''}</div>`;
  }).join('');
}
const cdOrd = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
export function categoryDetail(s, key) {
  const c = s.categories.find(x => x.key === key);
  if (!c) return { title: 'Category', subtitle: '', body: '' };
  const subs = c.subs || [];
  const rated = subs.filter(x => x.score != null).length, pending = subs.length - rated;
  const forming = rated === 0;
  const now = c.frac * 5, pot = c.pot * 5, headroom = c.pot > c.frac + 0.001;
  const contrib = (c.frac * c.weightPct).toFixed(1), compLift = ((c.pot - c.frac) * c.weightPct).toFixed(1);
  const cb = forming ? 'unrated' : cdBand(c.frac);

  // ── 1 · verdict standfirst ──
  const sentence = forming
    ? `${esc(c.label)} is <b>not yet assessed</b> — it will carry up to ${c.weightPct}% of the score once its 5 signals are rated.`
    : `${esc(c.label)} is <b>${CD_VERDICT[cb]}</b> — ${now.toFixed(1)}/5 across its 5 signals, carrying <b>+${contrib}</b> of the 100-point score${headroom ? `, with <b>+${compLift}</b> still reachable.` : ' and already at its ceiling.'}`;
  const bar = (!forming && headroom) ? `<div class="cd-track"><span class="pot" style="width:${Math.round(c.pot * 100)}%"></span><span class="now" style="width:${Math.round(c.frac * 100)}%"></span></div>` : '';
  const standfirst = `<div class="cd-stand"><span class="cd-band ${cb}">${CD_SB_WORD[cb]}</span><p>${sentence}</p>${bar}</div>`;

  // ── 2 · figure strip ──
  const figures = `<div class="cd-figures">
      <div class="cd-fig"><div class="v">${forming ? '—' : now.toFixed(1)}<i>/5</i></div><div class="l">${rated} of 5 rated</div></div>
      <div class="cd-fig"><div class="v">${headroom ? pot.toFixed(1) : '—'}<i>${headroom ? '/5' : ''}</i></div><div class="l">${headroom ? 'Potential' : forming ? 'Potential' : 'At ceiling'}</div></div>
      <div class="cd-fig"><div class="v">${c.weightPct}<i>%</i></div><div class="l">Weight</div></div>
      <div class="cd-fig"><div class="v">+${forming ? '0.0' : contrib}</div><div class="l">Contributes</div></div>
    </div>`;

  // ── 3 · the five signals (the spine) ──
  const cnt = { green: 0, yellow: 0, red: 0 };
  subs.forEach(x => { if (x.score != null) cnt[x.score === 1 ? 'green' : x.score === 0.5 ? 'yellow' : 'red']++; });
  const spread = `${cnt.green} strong · ${cnt.yellow} mixed · ${cnt.red} gap${pending ? ` · ${pending} pending` : ''}`;
  const signals = `<div class="cd-block"><div class="cd-h"><span class="lab">The five signals</span><span class="sub">${spread}</span></div>${signalRows(subs)}</div>`;

  // ── 4 · what would lift it ──
  let lifts;
  if (forming) {
    lifts = `<div class="cd-block"><div class="cd-h"><span class="lab">What would lift it</span></div><p class="cd-note">Rate the 5 signals to reveal what would lift the score — up to +${c.weightPct} available.</p></div>`;
  } else if (!headroom) {
    lifts = `<div class="cd-block"><div class="cd-h"><span class="lab">What would lift it</span></div><p class="cd-note">At its ceiling — contributing its full <b>+${contrib}</b>; no diligence headroom.</p></div>`;
  } else {
    const ranked = subs.filter(x => x.score === 0 || x.score === 0.5).map(x => ({ ...x, lift: 1 - x.score })).sort((a, b) => b.lift - a.lift);
    lifts = `<div class="cd-block"><div class="cd-h"><span class="lab">What would lift it</span><span class="sub warn">+${compLift} to the score</span></div>
      ${ranked.map(x => { const { note } = cdSplitRef(x.note); return `<div class="cd-lever">${cdChip(x.score)}<div class="bd"><div class="q">${esc(SUB_Q[x.slug] || x.slug)}</div>${note ? `<div class="nt">${esc(note)}</div>` : ''}</div><span class="cd-liftv">+${x.lift === 0.5 ? '0.5' : '1.0'}</span></div>`; }).join('')}
      <p class="cd-foot">Closing these lifts the category from <b>${now.toFixed(1)}</b> → <b>${pot.toFixed(1)}</b>.</p></div>`;
  }

  // ── 5 · contribution & standing ──
  const rankW = [...s.categories].sort((a, b) => b.weightPct - a.weightPct).findIndex(x => x.key === key) + 1;
  const rankC = [...s.categories].sort((a, b) => b.frac * b.weightPct - a.frac * a.weightPct).findIndex(x => x.key === key) + 1;
  const standing = `<div class="cd-standing"><div class="cd-h"><span class="lab">Contribution &amp; standing</span></div>
      <div class="cd-srow"><span>Weight → contributes</span><b>${c.weightPct}% → +${forming ? '0.0' : contrib} of 100${headroom ? `, +${compLift} avail.` : ''}</b></div>
      <div class="cd-srow"><span>Among the 7 categories</span><b>${cdOrd(rankW)}-heaviest${forming ? '' : ` · ${cdOrd(rankC)} by contribution`}</b></div>
      <div class="cd-srow"><span>Provenance</span><b>${rated} of 5 rated · L2 · Investability rubric</b></div>
    </div>`;

  return { title: c.label, subtitle: `${CD_SB_WORD[cb]} · ${c.weightPct}% weight · L2 · Investability`, body: `${standfirst}${figures}${signals}${lifts}${standing}` };
}

// the case, argued both ways — two grouped lists (the one place cards earn elevation)
export function caseEditorial(a) {
  const side = (cls, ttl, tag, icon, mk, items) => `<div class="case-card ${cls}">
    <div class="ch"><span class="material-symbols-rounded">${icon}</span><span class="ttl">${ttl}</span><span class="ct">${tag}</span></div>
    ${items.length ? items.map(t => `<div class="cpt"><span class="mk"><span class="material-symbols-rounded">${mk}</span></span><p>${esc(t)}</p></div>`).join('')
      : `<div class="cpt cpt-empty"><span class="mk"></span><p>No material points raised on this side.</p></div>`}
  </div>`;
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow">The case</span><span class="t">Argued both ways</span><span class="meta">${a.bull.length} for · ${a.bear.length} against</span></div>
    <div class="case-grid">
      ${side('forc', 'The case for', 'BULL', 'trending_up', 'check_circle', a.bull)}
      ${side('against', 'The case against', 'BEAR', 'trending_down', 'cancel', a.bear)}
    </div>
  </section>`;
}

// what must be true + the biggest kill-risk
export function conditionsKill(a) {
  const n = a.mustBeTrue.length;
  const sub = n ? `For the thesis to hold, all ${NUMWORD[n] || n} must be true` : 'Conditions for the thesis to hold';
  const conds = a.mustBeTrue.map((m, i) => `<div class="must"><span class="idx">${i + 1}</span><p>${esc(m)}</p></div>`).join('');
  const r = a.biggestRisk;
  const kill = r ? `<aside class="kill">
      <div class="kh"><span class="material-symbols-rounded">gpp_maybe</span><span class="tg">Biggest kill-risk<b>${esc(r.label)}</b></span></div>
      ${r.headline ? `<div class="kt">${esc(r.headline)}</div>` : ''}
      <p>${esc(r.text)}</p></aside>` : '';
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow good">The conditions</span><span class="t">What must be true — and what kills it</span></div>
    <div class="mbt-grid">
      <div><span class="eyebrow good" style="display:block;margin-bottom:12px">${sub}</span>${conds}</div>
      ${kill}
    </div>
  </section>`;
}

// pre-wire diligence — the whole Diligence tab: a Section hero (diligence statement + the pre-wire
// CLEARANCE progress lockup) atop the severity-grouped checklist. Mirrors verdictMemo's structure —
// the hero carries the gate (status chip + segmented bar), the checklist carries the detail. All derived.
export function diligenceEditorial(a) {
  const items = a.diligence || [];
  const of = k => items.filter(d => d.kind === k);
  const nBlock = of('err').length, nKey = of('warn').length, nStd = of('info').length;
  const cleared = items.filter(d => d.done).length, total = items.length;
  const rowCls = k => k === 'err' ? ' err' : k === 'warn' ? ' warn' : '';
  const sub = [nBlock && `${nBlock} blocker${nBlock > 1 ? 's' : ''}`, nKey && `${nKey} key`, nStd && `${nStd} standard`].filter(Boolean).join(' · ');
  const blockersDone = nBlock > 0 && of('err').every(d => d.done);
  const cap = w => String(w).charAt(0).toUpperCase() + String(w).slice(1);
  const blk = `${cap(NUMWORD[nBlock] || nBlock)} blocker${nBlock !== 1 ? 's' : ''}`;

  // ── Section hero — derived from the blocker state ──
  const headline = total === 0 ? 'No open diligence — a clean assessment.'
    : blockersDone ? 'Blockers cleared — cleared to proceed to a wire.'
      : nBlock > 0 ? `${blk} stand between this and a wire.`
        : `No blockers — ${total} check${total !== 1 ? 's' : ''} before the call.`;
  const headlineEm = total === 0 ? '' : blockersDone ? 'cleared to proceed' : nBlock > 0 ? blk : '';
  // the wire gate is a BLOCKER gate: with no blockers (only key/standard checks to work in diligence) it is
  // open — otherwise the "No blockers" hero would contradict a "Do not wire" chip.
  const gateOpen = total === 0 || nBlock === 0 || blockersDone;
  const hero = sectionHero({
    left: statementLockup({
      eyebrow: 'Pre-wire diligence', eyebrowIcon: 'fact_check',
      headline, headlineEm,
      facts: [
        { k: 'Gate', v: gateOpen ? 'Open' : 'Locked' },
        { k: 'To clear', v: `${total} check${total !== 1 ? 's' : ''}` }
      ]
    }),
    right: progressLockup({
      label: 'Pre-wire clearance', done: cleared, total,
      status: total === 0 ? 'Nothing to clear' : nBlock === 0 ? 'No blockers — proceed' : blockersDone ? 'Cleared to proceed' : 'Do not wire',
      statusIcon: gateOpen ? 'lock_open' : 'lock',
      tone: gateOpen ? 'good' : 'bad',
      segments: items.map(d => ({ kind: d.kind, done: !!d.done })),
      capLeft: `<b>${cleared}</b> of ${total} cleared`,
      capRight: sub
    }),
    thesis: ''
  });

  // ── the checklist below the hero: severity-grouped items (the hero carries the gate) ──
  const GROUPS = [['err', 'Blockers', '— resolve before any wire'], ['warn', 'Key', '— resolve in diligence'], ['info', 'Standard', '— confirm on the call']];
  let no = 0;
  const groups = GROUPS.map(([k, lab, note]) => {
    const gi = of(k); if (!gi.length) return '';
    return `<div class="dil-group"><div class="gh"><span class="lab ${k}">${lab}</span><span class="note">${note}</span></div>${gi.map(d => { no++; return `<div class="ditem${rowCls(k)}${d.done ? ' done' : ''}"><span class="no">${no}</span><span class="box"></span><div class="bd"><div class="tt">${esc(d.title)}</div><div class="ds">${esc(d.note)}</div></div></div>`; }).join('')}</div>`;
  }).join('');
  const checklist = total === 0 ? '' : `<hr class="rule">
    <section class="sec"><div class="dil">${groups}</div></section>`;

  return `<div class="brief">${hero}${checklist}</div>`;
}

// operator sign-off + provenance — status-driven (signed vs awaiting)
// provLine — ATOM. The confidence provenance line. Shared by the Verdict sign-off and the Research memo
// coda so both render byte-identical provenance from one source.
export const provLine = c => c ? `<div class="prov"><span class="material-symbols-rounded">verified</span> ${esc(c.level)} confidence · ${esc(c.line)}</div>` : '';

export function verdictSignoff(a) {
  const s = a.signoff;
  const card = s ? `<div class="signoff">
      <span class="ic"><span class="material-symbols-rounded">task_alt</span></span>
      <div class="sb"><div class="l1">Reviewed &amp; signed off by <b>${esc(s.by)}</b> · ${esc(s.at)}</div><div class="l2">“${esc(s.note)}”</div></div>
    </div>`
    : `<div class="signoff pending">
      <span class="ic"><span class="material-symbols-rounded">pending</span></span>
      <div class="sb"><div class="l1">Awaiting operator sign-off</div><div class="l2"></div></div>
    </div>`;
  return `<section class="sec" style="padding-bottom:0">${card}${provLine(a.confidence)}</section>`;
}

// the whole Verdict-tab memo, composed (sectionHero → case → conditions → sign-off).
// The hero is the reusable sectionHero organism, fed the MoneyGym verdict + score.
export function verdictMemo(a, s) {
  return `<div class="brief">
    ${sectionHero({
      eyebrow: 'The verdict', eyebrowIcon: 'balance',
      headline: a.verdictLine || a.recommendation, headlineEm: a.verdictEm,
      facts: [
        { k: 'Conviction', v: `${esc(a.conviction)} ${convPips(a.conviction)}` },
        { k: 'The ask', v: `${esc(a.askAmount)} <small>${esc(a.askRest)}</small>` }
      ],
      score: { label: 'Investability score', score: s.composite, max: 100, band: s.band, tone: BAND_TONE[s.band] || 'mid', now: s.composite, potential: s.potential },
      thesis: a.thesis
    })}
    <hr class="rule">
    ${caseEditorial(a)}
    <hr class="rule">
    ${conditionsKill(a)}
    <hr class="rule">
    ${verdictSignoff(a)}
  </div>`;
}

// ── Section heroes for the OTHER assessment tabs. Each COMPOSES sectionHero (recycled statementLockup on
//    the left, editorial copy from a.heroes[tab]) + a per-tab metric molecule on the right, DERIVED from
//    structured data. Same frame as verdictMemo/diligenceEditorial, molecules swapped per what the tab says. ──

// Investability tab hero — statement + profileLockup (the 55 re-expressed as its severity shape).
export function investabilityHero(s, a = {}) {
  const h = (a.heroes && a.heroes.investability) || {};
  return sectionHero({
    eyebrow: h.eyebrow, eyebrowIcon: h.eyebrowIcon, headline: h.headline, headlineEm: h.headlineEm, facts: h.facts,
    right: profileLockup({ label: 'Category profile', score: s.composite, max: 100, now: s.composite, potential: s.potential, categories: s.categories }),
    thesis: h.thesis
  });
}

// Market tab hero — statement + valuationLockup (the reprice band). Figures from ASSESSMENT.valuation.
export function marketHero(a = {}) {
  const h = (a.heroes && a.heroes.market) || {}, v = a.valuation || {};
  return sectionHero({
    eyebrow: h.eyebrow, eyebrowIcon: h.eyebrowIcon, headline: h.headline, headlineEm: h.headlineEm, facts: h.facts,
    right: valuationLockup({
      label: 'Valuation verdict', multiple: v.multiple, multipleSuffix: v.multipleSuffix,
      band: v.verdict, tone: v.tone || 'mid', asked: v.asked, defensibleLo: v.defensibleLo, defensibleHi: v.defensibleHi, scaleMax: v.scaleMax
    }),
    thesis: h.thesis
  });
}

// Team tab hero — statement + progressLockup recycled as a signal spread (verified/neutral/flagged).
export function teamHero(a = {}) {
  const h = (a.heroes && a.heroes.team) || {}, members = (a.team && a.team.members) || [];
  const verified = members.filter(m => m.signal === 'positive').length;
  const neutral = members.filter(m => m.signal === 'neutral').length;
  const flagged = members.filter(m => m.signal === 'flag').length;
  const rank = { positive: 0, neutral: 1, flag: 2 }, segTone = { positive: 'good', neutral: 'warn', flag: 'err' };
  const segments = [...members].sort((x, y) => rank[x.signal] - rank[y.signal]).map(m => ({ kind: segTone[m.signal] || 'info', done: true }));
  return sectionHero({
    eyebrow: h.eyebrow, eyebrowIcon: h.eyebrowIcon, headline: h.headline, headlineEm: h.headlineEm, facts: h.facts,
    right: progressLockup({
      label: 'Team signal', unit: 'verified', done: verified, total: members.length,
      status: `${flagged} flagged · ${neutral} to verify`, statusIcon: 'flag', tone: 'mid',
      segments, capLeft: `Verified ${verified} · Neutral ${neutral} · Flagged ${flagged}`, capRight: ''
    }),
    thesis: h.thesis
  });
}

// Research tab hero — statement + coverageLockup (evidence completeness + provenance).
export function researchHero(a = {}, s = {}) {
  const h = (a.heroes && a.heroes.research) || {}, cats = s.categories || [], cf = a.confidence || {};
  const total = cats.reduce((n, c) => n + (c.subs ? c.subs.length : 0), 0);
  const rated = cats.reduce((n, c) => n + (c.subs ? c.subs.filter(x => x.score != null).length : 0), 0);
  const wsCount = (a.research || []).length;
  const tone = total === 0 ? 'mid' : /high/i.test(cf.level) ? 'good' : /med/i.test(cf.level) ? 'mid' : 'bad';
  // a forming/absent snapshot has no rated signals — show "Forming", not a giant "0/0"
  const formingNumeral = total === 0 ? `<span class="lockup-forming">Forming</span>` : undefined;
  return sectionHero({
    eyebrow: h.eyebrow, eyebrowIcon: h.eyebrowIcon, headline: h.headline, headlineEm: h.headlineEm, facts: h.facts,
    right: coverageLockup({
      label: 'Evidence base', rated, total, ratedLabel: 'signals rated', numeral: formingNumeral, confidence: cf.level, tone,
      facts: [
        { v: cf.documents ? String(cf.documents) : '', k: 'documents' },
        { v: cf.sources ? String(cf.sources) : '', k: 'sources cited' },
        { v: wsCount ? String(wsCount) : '', k: 'workstreams' }   // never print "0 workstreams"
      ].filter(f => f.v)
    }),
    thesis: h.thesis
  });
}

// ---- market widgets (editorial — the Market tab is one .brief flow: sizing → reprice → the field) ----

// The market, at honest scale — the TAM/SAM/SOM funnel as three metricRow bars + the SOM-dominance punchline.
// De-duped against the hero: the lead carries ONLY the corrected-scale framing (the hero ran the 44–73×).
export function marketSizing(m) {
  if (!m) return '';   // live verdicts can ship without a sized market
  // only render tiers that actually carry a value (a live market may be tam-only) — mirrors the classic omit-absent behaviour
  const tiers = [['TAM', m.tam, 'Total addressable'], ['SAM', m.sam, 'Serviceable addressable'], ['SOM', m.som, 'Obtainable addressable']]
    .filter(([, d]) => d && d.value != null && d.value !== '');
  if (!tiers.length) return '';
  const bars = tiers.map(([k, d, sub]) => metricRow({ label: k, sub, bar: { now: d.v }, value: d.value, cls: 'funnel' })).join('');
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The market, at honest scale</span><span class="t">Sized bottom-up, not top-down</span><span class="meta">corrected</span></div>
    <p class="lead"><span class="drop">${esc(m.sizingDrop || 'Genuinely')}</span> ${esc(m.sizingLead || m.note)}</p>
    <div class="profile" style="margin-top:22px">${bars}</div>
    ${m.sizingFact ? `<div class="fact" style="margin-top:24px"><div class="k">The catch</div><div class="v">${esc(m.sizingFact)}</div></div>` : ''}
  </section>`;
}


// compScan — MOLECULE. An annotated-comparable ROW stack breathing on the background (no card): each row a
// lead (name + stage) · an optional amount/val figure pair · a "what it tells us" clause; the primary comp
// gets an accent left-rule + a tag. Generic — feed normalised rows [{name,stage,amount,val,detail,anchor,tag}].
export function compScan(rows = []) {
  return `<div class="compscan">${rows.map(r => `<div class="compscan-row${r.anchor ? ' anchor' : ''}">
    <div><div class="compscan-nm">${esc(r.name)}${r.tag ? `<span class="tag">${esc(r.tag)}</span>` : ''}</div>${r.stage ? `<div class="compscan-meta">${esc(r.stage)}</div>` : ''}</div>
    ${(r.amount || r.val) ? `<div class="compscan-fig"><b>${esc(r.amount || '')}</b>${r.val ? `<span>${esc(r.val)}</span>` : ''}</div>` : ''}
    ${r.detail ? `<p class="compscan-clause">${esc(r.detail)}</p>` : ''}
  </div>`).join('')}</div>`;
}

// The reprice — the tab's editorial centre of gravity. A net-new bear lead (the hero owns the figures) +
// the merged compScan comps (valuation.comps enriched with rounds' amount/val, stage-ranked, anchors flagged).
export function dealValuation(v, rounds = []) {
  const rank = s => /seed median/i.test(s) ? 0.5 : /seed/i.test(s) ? 0 : /series a/i.test(s) ? 1 : /series b/i.test(s) ? 2 : /series c/i.test(s) ? 3 : /acqui/i.test(s) ? 4 : 5;
  const roundFor = nm => rounds.find(r => r.name.toLowerCase().startsWith(nm.toLowerCase().split(/[ ,]/)[0]));
  const rows = (v.comps || []).map(c => {
    const r = roundFor(c.name);
    return {
      name: c.name, stage: c.stage, amount: r ? r.amount : '', val: r ? r.val : '', detail: c.detail,
      anchor: /truebill|carta/i.test(c.name),
      tag: /truebill/i.test(c.name) ? 'the deck’s real comp' : /carta/i.test(c.name) ? '3.75× median' : ''
    };
  }).sort((a, b) => rank(a.stage) - rank(b.stage));
  const vtone = v.tone || 'mid';
  const eb = vtone === 'good' ? 'good' : vtone === 'bad' ? 'bad' : 'accent';
  const vicon = vtone === 'bad' ? 'warning' : 'check_circle';
  return `<section class="sec">
    <div class="sec-head" style="align-items:center"><span class="eyebrow ${eb}">The reprice</span>${v.verdict ? `<span class="lockup-band ${vtone}" style="margin-top:0"><span class="material-symbols-rounded">${vicon}</span> ${esc(v.verdict)}</span>` : ''}<span class="meta">3 methods → one band</span></div>
    <p class="lead"><span class="drop">${esc(v.bodyDrop || 'Priced')}</span> ${esc(v.bodyLead || v.note)}</p>
    ${compScan(rows)}
  </section>`;
}

// The field — an editorial standfirst lifted OFF the card, then the dense 5×6 matrix in the ONE card that
// earns its container (column cross-read), then the structural-edge callout. The single earned card on the tab.
export function benchmarkTable(b, onOpen = '') {
  if (!b || !(b.rows || []).length) return '';   // live verdicts can ship without a benchmark (mirrors the classic guard)
  const standfirst = `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The field</span><span class="t">Everyone else already shipped</span></div>
    <p class="lead"><span class="drop">${esc(b.leadDrop || 'MoneyGym')}</span> ${esc(b.lead || b.note)}</p>
  </section>`;
  const matrix = `<section class="m3-card" style="overflow-x:auto;margin-top:6px">
    <table class="tbl"><thead><tr>${b.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr ${r.me ? 'class="me"' : ''}>${r.cells.map((c, i) => `<td>${i === 0 && r.me ? '<b>' + esc(c) + '</b>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="see-research"><button class="m3-btn text trail" ${onOpen ? `onclick="${onOpen}('benchmark')"` : ''}><span class="material-symbols-rounded">arrow_forward</span>Read the full competitive teardown</button></div></section>`;
  const edge = b.edge ? `<div class="fact" style="margin-top:24px"><div class="k">The edge</div><div class="v">${esc(b.edge)}</div></div>` : '';
  return `${standfirst}${matrix}${edge}`;
}

// marketMemo — the whole Market tab as one editorial .brief: hero → sizing → reprice → the field.
// Sections are conditional: a live verdict can arrive without a sized market, a valuation, or a
// benchmark, so we only emit (and divide) the sections that have data — no dangling rules, no crash.
export function marketMemo(a) {
  const secs = [marketHero(a)];
  if (a.market) secs.push(marketSizing(a.market));
  if (a.valuation) secs.push(dealValuation(a.valuation, a.rounds));
  if (a.benchmark) secs.push(benchmarkTable(a.benchmark, 'openPeek'));
  return `<div class="brief">${secs.filter(Boolean).join('<hr class="rule">')}</div>`;
}

// ---- founders + diligence ----
// signal → tinted monogram (colour IS the verdict) · chip · editorial signal-word. Shared by the roster + legacy card.
const memberBg = sig => sig === 'positive' ? 'background:var(--success-container);color:var(--on-success-container)' : sig === 'flag' ? 'background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)' : 'background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface-variant)';
const SIGCOL = { positive: 's', flag: 'err', neutral: 'n' };
const SIGCHIP = { positive: { kind: 'ok', label: 'Verified' }, flag: { kind: 'err', label: 'Flag' }, neutral: { kind: 'info', label: 'Neutral' } };
const SIG_WORD = { positive: 'Verified', flag: 'Flag', neutral: 'To verify' };


// founderRoster — ORGANISM. The founder cast as signal-tinted editorial rows on the background — the detail
// behind teamHero's signal spread. The scannable signal column survives as a tinted monogram + a trailing
// signal word, not a card border. Reuses memberBg + the hairline-row grid.
export function founderRoster(team, onOpen = '') {
  const members = team.members || [];
  const nV = members.filter(m => m.signal === 'positive').length, nF = members.filter(m => m.signal === 'flag').length;
  const rows = members.map(m => {
    const [nm, ...rest] = String(m.name).split('—');
    const role = rest.join('—').trim();
    return `<div class="frow">
      <div class="mono" style="${memberBg(m.signal)}">${esc(m.i)}</div>
      <div class="frow-bd"><div class="frow-nm">${esc(nm.trim())}</div>${role ? `<div class="frow-role">${esc(role)}</div>` : ''}<div class="frow-bg">${esc(m.bg)}</div></div>
      <div class="frow-sig ${esc(m.signal)}">${esc(SIG_WORD[m.signal] || 'To verify')}</div>
    </div>`;
  }).join('');
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">Founder diligence</span><span class="t">Who's actually on the cap table</span><span class="meta">${members.length} named · ${nV} verified · ${nF} flagged</span></div>
    ${rows}
    ${onOpen ? `<div class="see-research"><button class="m3-btn text trail" onclick="${onOpen}('team')"><span class="material-symbols-rounded">arrow_forward</span>Read the full founder diligence</button></div>` : ''}
  </section>`;
}

// teamGaps — MOLECULE. The team's structural ABSENCES as the editorial counter-argument — a mirror of
// conditionsKill: numbered .must "missing seats" beside a .kill "decisive hire" aside (worded so it never
// echoes the Verdict tab's kill-risk). The kill config (team.gapKill) defaults off gaps[0].
export function teamGaps(team) {
  const gaps = team.gaps || [];
  if (!gaps.length) return '';
  const k = team.gapKill;
  const conds = (k ? gaps.slice(1) : gaps).map((g, i) => `<div class="must"><span class="idx">${i + 1}</span><p>${esc(g)}</p></div>`).join('');
  const kill = k ? `<aside class="kill">
      <div class="kh"><span class="material-symbols-rounded">person_search</span><span class="tg">${esc(k.tag)}<b>${esc(k.label)}</b></span></div>
      ${k.headline ? `<div class="kt">${esc(k.headline)}</div>` : ''}
      <p>${esc(k.text)}</p></aside>` : '';
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow warn">The gap</span><span class="t">What the team is missing</span></div>
    <div class="mbt-grid"><div>${conds}</div>${kill}</div>
  </section>`;
}

// exitLedger — MOLECULE. The three exit paragraphs flattened onto the background: the returns paragraph (the
// repricing thesis) promoted to a drop-cap lead; acquirers + path demoted to labelled editorial prose blocks.
export function exitLedger(e = {}) {
  const notes = [['Likely acquirers', e.acquirers], ['Path to liquidity', e.path]].filter(([, v]) => v);
  const lead = e.returns || (notes.length ? notes.shift()[1] : '');
  if (!lead) return '';
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The exit</span><span class="t">Where the liquidity comes from</span><span class="meta">Acquisition, not IPO</span></div>
    <p class="lead"><span class="drop">${e.returns ? 'Returns.' : 'Exit.'}</span> ${esc(lead)}</p>
    ${notes.map(([k, v]) => `<div class="exit-note"><div class="k">${esc(k)}</div><p>${esc(v)}</p></div>`).join('')}
  </section>`;
}

// exitReturns — legacy card (retired from assess.html; exit now renders via exitLedger).
export const exitReturns = e => `<section class="m3-card"><div class="card-hd">${overline('Exit & returns')}</div>
  <p class="body-l"><b>Likely acquirers:</b> ${esc(e.acquirers)}</p>
  <p class="body-l"><b>Path:</b> ${esc(e.path)}</p>
  <p class="body-l"><b>Returns:</b> ${esc(e.returns)}</p></section>`;

// teamMemo — the whole Team tab as one editorial .brief: hero → roster → gaps → exit.
export function teamMemo(a) {
  // filter/join like marketMemo/researchMemo — a self-omitting section (no gaps / no exit) never leaves a dangling rule
  const secs = [teamHero(a), founderRoster(a.team, 'openPeek'), teamGaps(a.team), exitLedger(a.exit)].filter(Boolean);
  return `<div class="brief">${secs.join('\n    <hr class="rule">\n    ')}</div>`;
}


// ---- research + data room ----
const RTONE = { p: 'rgba(208,188,255,0.14)', s: 'rgba(111,219,180,0.14)', w: 'rgba(247,192,103,0.14)' };
const RCOL = { p: 'var(--md-sys-color-primary)', s: 'var(--success)', w: 'var(--warning)' };

// researchRow — MOLECULE. One editorial evidence-index row, a bar-less sibling of metricRow drilling to the
// aux peek: a tinted workstream marker + title + one-line finding · a depth/status chip · a drill chevron.
export function researchRow(r, i, onOpen = '') {
  const act = onOpen ? ` role="button" tabindex="0" onclick="${onOpen}('research',${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onOpen}('research',${i})}"` : '';
  return `<div class="mrow research${onOpen ? ' drill' : ''}"${act}>
    <div class="mrow-lab"><span class="rlead" style="background:${RTONE[r.tone] || RTONE.p}"><span class="material-symbols-rounded" style="color:${RCOL[r.tone] || RCOL.p}">${esc(r.icon || 'article')}</span></span><div class="mrow-txt"><div class="mrow-nm">${esc(r.title)}</div>${r.note ? `<div class="mrow-sub">${esc(r.note)}</div>` : ''}</div></div>
    <div class="mrow-val">${r.tag ? `<span class="status ${r.tagKind || 'info'}">${esc(r.tag)}</span>` : ''}</div>
    ${onOpen ? '<span class="material-symbols-rounded mrow-chev">chevron_right</span>' : '<span class="mrow-chev"></span>'}
  </div>`;
}

// researchIndex — ORGANISM. The editorial evidence index (replaces the researchList card): discrete
// hairline-separated researchRow rows on the background so the "which workstream, how deep, what failed" scan survives.
export function researchIndex(items = [], onOpen = '') {
  if (!items || !items.length) return '';   // self-omit when no workstreams yet (mirrors evidenceIntegrity) — no dangling header
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The workstreams</span><span class="t">Every claim, rebuilt from source</span><span class="meta">${items.length} workstream${items.length === 1 ? '' : 's'}</span></div>
    <div class="profile">${items.map((r, i) => researchRow(r, i, onOpen)).join('')}</div>
  </section>`;
}

// researchMemo — the whole Research tab as one editorial .brief: hero → the workstream index → the data-room
// card (the tab's ONE earned card) → the provenance coda (shared provLine, closing the hero's coverage loop).
// evidenceIntegrity — ORGANISM. The Research tab's second proof of trust: not "did the founder's claims
// survive" but "is our OWN read sound". The Evidence VSS category's 5 fixed checks (citation density, source
// count, hallucination check, methodology, cross-file consistency) — the same signalRows the Investability
// aux-drill uses, promoted onto the reading surface with a method-soundness framing. Scales: the evidence
// category ships on every SCORE; unrated subs self-render as forming chips. Self-omits if absent.
export function evidenceIntegrity(a, s) {
  const c = (s.categories || []).find(x => x.key === 'evidence');
  if (!c || !c.subs || !c.subs.length) return '';
  const subs = c.subs;
  const nPass = subs.filter(x => x.score === 1).length;
  const nMixed = subs.filter(x => x.score === 0.5).length;
  const nFail = subs.filter(x => x.score === 0).length;
  const conf = a.confidence && a.confidence.level ? `${a.confidence.level} confidence` : '';
  const meta = [`${nPass} pass`, nMixed && `${nMixed} mixed`, nFail && `${nFail} fail`, conf].filter(Boolean).join(' · ');
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">Evidence integrity</span><span class="t">How sound is the assessment itself</span><span class="meta">${meta}</span></div>
    <p class="lead" style="margin-top:0"><span class="drop">The method.</span> Confidence rests on five checks — <b>${nPass}</b> clear the bar${nFail ? `, <b>${nFail}</b> do not` : ' and none fail'}.</p>
    <div class="ev-signals">${signalRows(subs)}</div>
  </section>`;
}

// confidenceReconciliation — MOLECULE. The Research tab's closing honesty note: "High confidence" measures
// COVERAGE (we rated everything), not RESOLUTION (this much is still open). Coverage figures + a resolved/
// partial/open tri-count over the 35 sub-signals, then the shared provenance line. Fully derived, no literals.
export function confidenceReconciliation(a, s) {
  const subs = (s.categories || []).flatMap(c => c.subs || []);
  const total = subs.length, rated = subs.filter(x => x.score != null).length;
  const resolved = subs.filter(x => x.score === 1).length;
  const partial = subs.filter(x => x.score === 0.5).length;
  const open = subs.filter(x => x.score === 0).length;
  const cf = a.confidence || {};
  const cov = [cf.documents && `${cf.documents} documents`, cf.sources && `${cf.sources} sources`, `${rated}/${total} rated`].filter(Boolean).join(', ');
  return `<section class="sec" style="padding-top:6px">
    <p class="lead"><span class="drop">Confidence, honestly.</span> ${esc(cf.level || 'High')} confidence means the evidence base is <b>complete</b> — ${cov} — not that every question is <b>closed</b>.</p>
    <div class="profile-foot" style="margin-top:16px"><span class="split"><b class="s">${resolved}</b> resolved · <b class="m">${partial}</b> partial · <b class="g">${open}</b> open</span></div>
    ${provLine(cf)}
  </section>`;
}

// researchMemo — the whole Research tab: hero → workstream index → evidence integrity → confidence coda.
// The data-room card moved to the Sources rail panel; a light pointer keeps the path to the files.
export function researchMemo(a, s) {
  // The index reads from `a.reading` — EVERY document with a body, including ones the count-bearing
  // `a.research` set deliberately excludes (the deal memo). Nothing is hidden from the reader.
  // Falls back to `a.research` for any caller that hasn't been given a reading set.
  const room = researchRoom(a.reading && a.reading.length ? a.reading : (a.research || []));
  // assemble present sections, then join with rules — an absent section (empty index, no evidence
  // category) never leaves a dangling header or doubled hairline. Mirrors marketMemo's filter/join.
  const secs = [
    researchHero(a, s),
    researchReadingIndex(room),
    evidenceIntegrity(a, s),
    confidenceReconciliation(a, s),
  ].filter(Boolean);
  return `<div class="brief">
    ${secs.join('\n    <hr class="rule">\n    ')}
    <div class="see-research" style="padding-top:2px"><button class="m3-btn text" onclick="window.openSources&&window.openSources()"><span class="material-symbols-rounded">source</span>Source documents &amp; re-run — in Sources</button></div>
  </div>`;
}

// mdInline / mdToHtml — a SMALL markdown→HTML renderer for the deep-research drill (openPeek). Not a full
// CommonMark impl — just what the runner emits: headings, **bold**/*italic*/`code`, [links], - / 1. lists,
// > quotes, and paragraphs. Everything is escaped first, so it is safe on founder/agent-authored bodies.
function mdInline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export function mdToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = []; let list = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p class="body-m">${mdInline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag} class="md-list">${list.items.map(i => `<li>${mdInline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of lines) {
    const t = raw.trim(); let m;
    if (!t) { flushPara(); flushList(); continue; }
    if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); out.push(`<div class="md-h md-h${Math.min(3, m[1].length)}">${mdInline(m[2])}</div>`); continue; }
    if (/^>\s?/.test(t)) { flushPara(); flushList(); out.push(`<blockquote class="md-q">${mdInline(t.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if ((m = t.match(/^[-*+]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if (/^\|/.test(t) || /^[-:|\s]{3,}$/.test(t)) { continue; }   // skip pipe tables / separators (rare)
    flushList(); para.push(t);
  }
  flushPara(); flushList();
  return out.join('\n');
}
// researchPeek — ORGANISM. The deep-research drill panel for openAux(): the full workstream doc rendered
// from its markdown body (falls back to the one-line finding on a forming run that has no body yet).
export function researchPeek(r = {}) {
  const body = r && r.body ? mdToHtml(r.body) : `<p class="body-m">${esc((r && r.note) || 'This workstream has not been generated yet.')}</p>`;
  return { title: (r && r.title) || 'Deep research', subtitle: `${esc((r && r.tag) || 'L3')} · Deep research`, body: `<div class="md-doc">${body}</div>` };
}

// ---- Sources rail panel — the engagement's inputs + lifecycle + re-run (opened from the utility rail) ----

// lifecycleStrip — MOLECULE. A compact vertical timeline of the assessment lifecycle. Each step
// {label, at, meta, state:'done'|'current'|'pending'}; the connector fills green through the done steps.
export function lifecycleStrip(steps = []) {
  const ic = s => s === 'done' ? 'check' : s === 'current' ? 'radio_button_checked' : 'radio_button_unchecked';
  return `<ol class="lifecycle">${steps.map(s => `<li class="lifecycle-step ${s.state || 'pending'}">
    <span class="lc-dot"><span class="material-symbols-rounded">${ic(s.state)}</span></span>
    <div class="lc-bd"><div class="lc-lab">${esc(s.label)}${s.at ? `<span class="lc-at">${esc(s.at)}</span>` : ''}</div>${s.meta ? `<div class="lc-meta">${esc(s.meta)}</div>` : ''}</div>
  </li>`).join('')}</ol>`;
}

// sourcesPanel — ORGANISM. The Sources rail panel content: the lifecycle playback + the loaded documents
// grouped by kind (founder uploads / data room / generated) + re-run controls. Returns {title,subtitle,
// body,footer} for openAux(). Additive to the Research data-room card (this is the inputs + control surface).
const SRC_GROUPS = [['upload', 'Founder uploads'], ['dataroom', 'Data room'], ['generated', 'Generated']];
// srcRow — ATOM. One document row (tinted icon · name · note · Read/Stored/tag chip). SHARED by sourcesPanel and
// the wizard's deckDropzone so an uploaded deck renders byte-identically in the wizard and the Sources rail panel.
export function srcRow(d = {}) {
  return `<div class="src-row">
      <span class="src-ic"><span class="material-symbols-rounded">${d.icon || 'description'}</span></span>
      <div class="src-bd"><div class="src-nm">${esc(d.title)}</div>${d.note ? `<div class="src-note">${esc(d.note)}</div>` : ''}</div>
      ${d.status ? `<span class="src-status ${esc(d.status)}">${d.status === 'read' ? 'Read' : 'Stored'}</span>` : (d.tag ? `<span class="status info">${esc(d.tag)}</span>` : '')}
    </div>`;
}
export function sourcesPanel(a = {}) {
  const docs = a.dataRoom || [], run = a.run || {};
  const groups = SRC_GROUPS.map(([k, lab]) => {
    const g = docs.filter(d => (d.kind || 'dataroom') === k);
    if (!g.length) return '';
    return `<div class="src-group"><div class="src-gh">${esc(lab)}<span class="src-ct">${g.length}</span></div>${g.map(srcRow).join('')}</div>`;
  }).join('');
  const body = `${a.lifecycle && a.lifecycle.length ? `<div class="src-sec-lab">Lifecycle</div>${lifecycleStrip(a.lifecycle)}` : ''}
    <div class="src-sec-lab" style="margin-top:24px">Source material${docs.length ? ` <span class="src-ct">${docs.length}</span>` : ''}</div>
    <div class="src-docs">${groups}</div>`;
  const footer = `<button class="m3-btn outlined" onclick="window.addDocuments&&window.addDocuments()"><span class="material-symbols-rounded">upload_file</span>Add documents</button><button class="m3-btn filled" style="flex:1" onclick="window.rerunAssessment&&window.rerunAssessment()"><span class="material-symbols-rounded">restart_alt</span>Re-run assessment</button>`;
  return { title: 'Sources', subtitle: run.at ? `${docs.length} documents · last run ${esc(run.at)}` : `${docs.length} documents`, body, footer };
}

// ---- research article molecules (used by the research drill-down page) ----
export function keyFigures(figs = []) {
  return `<div class="keyfig">${figs.map(f => `<div class="k"><div class="v">${esc(f.v)}</div><div class="l">${esc(f.l)}</div></div>`).join('')}</div>`;
}
export function sourceList(sources = []) {
  // an external citation opens in a new tab; an internal/absent href stays put
  return sources.map((s, i) => {
    const ext = /^https?:/i.test(s.href || '');
    return `<div class="src"><span class="n">${i + 1}</span><div><a href="${esc(s.href || '#')}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(s.title)}</a><div class="dom">${esc(s.dom || '')}</div></div></div>`;
  }).join('');
}
export function tocRail(sections = [], active = 0) {
  return `<nav class="toc">${sections.map((s, i) => `<a class="${i === active ? 'on' : ''}" href="#${esc(s.id)}">${esc(s.label)}</a>`).join('')}</nav>`;
}

// ============================================================
// DEEP RESEARCH — the reading room
//
// The aux peek renders research through mdToHtml(), a hand-rolled subset parser that silently DROPS
// every pipe table, every `---` rule, all fenced code and every semantic heading. The agents emit all
// four. This block is the full-page replacement: a real GFM render plus the classic reading affordances
// (canonical titles, group taxonomy, key finding, read time, source/section counts, provenance, TOC).
//
// The taxonomy + metrics are PORTED, deliberately, from the classic shared/hub-view.js — a LOCKED file
// that is never imported. Titles are SENTENCE-CASED here to match M3; the classic used Title Case.
// ============================================================

export const RESEARCH_GROUPS = [
  { key: 'verdict', label: 'The verdict' },
  { key: 'market', label: 'The market' },
  { key: 'competition', label: 'The competition' },
  { key: 'team', label: 'The team' },
  { key: 'money', label: 'The money' },
  { key: 'further', label: 'Further reading' },
];
const RG_INDEX = Object.fromEntries(RESEARCH_GROUPS.map((g, i) => [g.key, i]));
const RG_LABEL = Object.fromEntries(RESEARCH_GROUPS.map(g => [g.key, g.label]));
// classic line-glyph name → the Material Symbol that carries the same meaning
const RG_GLYPH = { shield: 'shield', stamp: 'approval', scale: 'balance', expand: 'query_stats', trend: 'trending_up', globe: 'public', bars: 'bar_chart', target: 'ads_click', people: 'badge', calc: 'calculate', coins: 'payments', doc: 'description' };
const RG_TONE = { verdict: 'p', market: 'p', competition: 'w', team: 's', money: 'p', further: 'n' };

const RESEARCH_CANON = [
  { test: t => /claim/.test(t) && /(pressure|validat)/.test(t), title: 'Claims pressure test', group: 'verdict', glyph: 'shield', desc: 'Every founder claim independently verified, flagged, or refuted.' },
  { test: t => /deal memo|investment committee/.test(t), title: 'Deal memo', group: 'verdict', glyph: 'stamp', desc: 'The investment recommendation, terms, and the headline call.' },
  { test: t => /investment analysis/.test(t), title: 'Investment analysis', group: 'verdict', glyph: 'scale', desc: 'The full thesis — upside, downside, and the path to a return.' },
  { test: t => /market sizing/.test(t), title: 'Market sizing', group: 'market', glyph: 'expand', desc: 'TAM / SAM / SOM, built bottom-up and sanity-checked.' },
  { test: t => /demand|traction/.test(t), title: 'Demand & traction', group: 'market', glyph: 'trend', desc: 'Evidence of real pull — pipeline, customers, signals.' },
  { test: t => /market/.test(t), title: 'Market analysis', group: 'market', glyph: 'globe', desc: 'The opportunity, the dynamics, and where this venture sits.' },
  { test: t => /benchmark/.test(t), title: 'Competitive benchmark', group: 'competition', glyph: 'bars', desc: 'Head-to-head scoring against the field on the metrics that matter.' },
  { test: t => /competitor|competitive/.test(t), title: 'Competitor analysis', group: 'competition', glyph: 'target', desc: 'Who else is in the race, and how they’re positioned.' },
  { test: t => /team|diligence/.test(t), title: 'Team diligence', group: 'team', glyph: 'people', desc: 'Track record, gaps, and references on the founding team.' },
  { test: t => /unit economics/.test(t), title: 'Unit economics', group: 'money', glyph: 'calc', desc: 'Cost-to-serve, margins, and the model’s underlying math.' },
  { test: t => /comparable|funding round/.test(t), title: 'Comparable funding rounds', group: 'money', glyph: 'coins', desc: 'What similar companies raised, at what valuations, and when.' },
];

export const researchSlug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'doc';

// keyFinding — the first real sentence of the body: skips headings, rules, tables, front-matter
// key/value lines and the agent's own preamble. Ported verbatim in behaviour from the classic.
function keyFinding(body) {
  const paras = String(body || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').trim());
  for (let p of paras) {
    if (!p || /^[-=*#>|_]/.test(p)) continue;
    if (/^\*{0,2}(prepared|deal|stage|sector|geography|recommendation|analyst|date|research date|company|ask|prepared for|to|from|re)\b/i.test(p)) continue;
    if (/^[A-Z][\w .&()\/-]{0,40}:\s/.test(p) && p.length < 130) continue;
    if (/^(i |i'|i now|let me|both files|here is|here'|this (document|analysis|file|report)|note:)/i.test(p)) continue;
    p = p.replace(/\*\*/g, '').replace(/^_+|_+$/g, '').replace(/\s+/g, ' ').trim();
    if (p.length < 28) continue;
    const sentence = (p.match(/^.*?[.!?](\s|$)/) || [p])[0].trim();
    return sentence.length > 170 ? sentence.slice(0, 167).replace(/\s+\S*$/, '') + '…' : sentence;
  }
  return '';
}

const wordCount = b => (String(b || '').trim().match(/\S+/g) || []).length;
const sectionCount = b => (String(b || '').match(/^#{2,3}\s+/gm) || []).length;
const readTime = w => w >= 600 ? `${Math.ceil(w / 220)} min read` : `${w} words`;

// The "## Sources" section, sliced out at the next heading. (JS has no \Z, so we cut on a split
// rather than a lookahead — a Sources section is almost always the LAST one in an agent's doc.)
function sourceBlock(body) {
  const m = String(body || '').match(/^#{2,3}[ \t]+sources?\b[^\n]*\n([\s\S]*)/im);
  return m ? m[1].split(/^#{1,3}[ \t]/m)[0] : '';
}
// The classic counted bare URLs, which reads 0 on a plain-text source list. Take whichever
// of {bare URLs, bullets under a "## Sources" heading} is larger.
function sourceCount(b) {
  const urls = (String(b || '').match(/\bhttps?:\/\//g) || []).length;
  const bullets = (sourceBlock(b).match(/^\s*(?:[-*+]|\d+[.)])\s+\S/gm) || []).length;
  return Math.max(urls, bullets);
}

// researchSources — parse the doc's own "## Sources" section into sourceList() rows.
export function researchSources(body) {
  const block = sourceBlock(body);
  if (!block) return [];
  return (block.match(/^\s*(?:[-*+]|\d+[.)])\s+.+$/gm) || []).map(raw => {
    const line = raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
    const link = line.match(/\[([^\]]+)\]\((https?:[^)\s]+)\)/);
    const bare = line.match(/(https?:\/\/[^\s)]+)/);
    const href = link ? link[2] : (bare ? bare[1] : '');
    let title = (link ? line.replace(link[0], link[1]) : line.replace(/\s*[—–]?\s*https?:\/\/\S+/, ''))
      .replace(/\*\*/g, '').replace(/[—–]\s*$/, '').trim();
    let dom = '';
    if (href) { try { dom = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { dom = ''; } }
    else {
      // "Title — Provenance". Split on a SPACED em/en dash only: a bare hyphen lives inside words
      // ("free-to-paid") and inside filenames ("05-*"), and splitting there mangles both halves.
      const parts = title.split(/\s+[—–]\s+/);
      if (parts.length > 1) { dom = parts.pop().trim(); title = parts.join(' — ').trim(); }
    }
    return { title: title || line, dom, href };
  }).filter(s => s.title);
}

// researchClassify — one raw research doc → the canonical reading-room entry. Never drops an
// unknown doc: it falls back to the doc's own title + hub, so a new agent workstream still renders.
export function researchClassify(doc = {}) {
  const raw = String(doc.title || doc.name || '');
  const t = raw.toLowerCase();
  const hit = RESEARCH_CANON.find(c => c.test(t));
  let title, group, glyph, desc;
  if (hit) { ({ title, group, glyph, desc } = hit); }
  else {
    const clean = raw.replace(/\s+[—–]\s+.*$/, '').replace(/\b(inc|llc|ltd|corp)\b\.?/gi, '').trim() || raw;
    title = /[a-z]/.test(clean) ? clean : clean.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase());
    group = RG_INDEX[doc.hub] != null ? doc.hub : 'further';
    glyph = 'doc'; desc = '';
  }
  const body = String(doc.body || doc.markdown || '');
  const words = wordCount(body);
  return {
    slug: doc.slug || researchSlug(title),
    name: doc.name || '',
    title, group, groupLabel: RG_LABEL[group], desc, body,
    icon: RG_GLYPH[glyph] || 'description',
    tone: doc.tone || RG_TONE[group] || 'n',
    tag: doc.tag || 'L3', tagKind: doc.tagKind || 'info',
    finding: keyFinding(body) || doc.note || desc,
    words, readTime: readTime(words),
    sources: sourceCount(body), sections: sectionCount(body),
    agent: doc.agent || '', generated: doc.generated || '',
  };
}

// researchRoom — classify + order a whole research[] array, then bucket it into its groups.
export function researchRoom(docs = []) {
  const all = docs.map(researchClassify)
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (RG_INDEX[a.d.group] - RG_INDEX[b.d.group]) || (a.i - b.i))
    .map(x => x.d);
  // Two docs can classify to the SAME canonical title (market-analysis.md + opportunities.md → "Market
  // analysis"), so their slugs collide — and a collided slug means one document is unreachable by key,
  // deep-link and pager. Dedupe. (Mirrors the classic hub-view.js.)
  const taken = new Set();
  all.forEach(d => { let s = d.slug, n = 2; while (taken.has(s)) s = `${d.slug}-${n++}`; taken.add(s); d.slug = s; });
  const groups = RESEARCH_GROUPS
    .map(g => ({ ...g, docs: all.filter(d => d.group === g.key) }))
    .filter(g => g.docs.length);
  const totals = all.reduce((a, d) => ({ docs: a.docs + 1, words: a.words + d.words, sources: a.sources + d.sources }), { docs: 0, words: 0, sources: 0 });
  return { all, groups, totals };
}

// ---- reading-room molecules ----

const kfmt = n => n >= 1000 ? (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);

// provenanceStrip — ATOM. What the run actually produced, above the workstream index.
export function provenanceStrip({ docs = 0, words = 0, sources = 0 } = {}) {
  const cell = (v, l) => `<div class="prov-c"><div class="prov-v">${esc(v)}</div><div class="prov-l">${esc(l)}</div></div>`;
  return `<div class="prov-strip">${cell(docs, docs === 1 ? 'workstream' : 'workstreams')}${cell(kfmt(words), 'words')}${cell(sources, 'sources')}</div>`;
}

// researchRoomIndex — ORGANISM. The sticky left rail: every workstream, grouped, with its key finding.
// ---- the reading index: the Research tab's grouped list of every document ----
// Rows carry an INLINE onclick, deliberately, not [data-drill]: [data-drill] is bound once inside
// initShell(), but assess-next.html's paint() swaps .shell-body.innerHTML on every refresh/tick, which
// would leave rebuilt rows dead. A window global survives every re-render.
export function researchReadingIndex(room) {
  if (!room || !room.all.length) return '';
  const open = slug => `window.openResearchDrill&&window.openResearchDrill('${esc(slug)}')`;
  const row = d => {
    const meta = [d.readTime, d.sources ? `${d.sources} source${d.sources === 1 ? '' : 's'}` : '', d.sections ? `${d.sections} sections` : ''].filter(Boolean).join(' · ');
    return `<div class="mrow research drill" role="button" tabindex="0"
        onclick="${open(d.slug)}"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open(d.slug)}}">
      <div class="mrow-lab">
        <span class="rlead" style="background:${RTONE[d.tone] || RTONE.p}"><span class="material-symbols-rounded" style="color:${RCOL[d.tone] || RCOL.p}">${esc(d.icon)}</span></span>
        <div class="mrow-txt">
          <div class="mrow-nm">${esc(d.title)}</div>
          ${d.finding ? `<div class="mrow-sub">${esc(d.finding)}</div>` : ''}
          ${meta ? `<div class="mrow-meta">${esc(meta)}</div>` : ''}
        </div>
      </div>
      <div class="mrow-val">${d.tag ? `<span class="status ${d.tagKind || 'info'}">${esc(d.tag)}</span>` : ''}</div>
      <span class="material-symbols-rounded mrow-chev">chevron_right</span>
    </div>`;
  };
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The workstreams</span><span class="t">Every claim, rebuilt from source</span><span class="meta">${room.totals.docs} document${room.totals.docs === 1 ? '' : 's'}</span></div>
    ${provenanceStrip(room.totals)}
    ${room.groups.map(g => `<div class="ri-group"><div class="ri-gh">${esc(g.label)}</div><div class="profile">${g.docs.map(row).join('')}</div></div>`).join('')}
  </section>`;
}

// ---- ONE research document as a drill page ----
// neighbours follow the READING order (group-sorted), never the raw array index
export function researchNeighbours(room, doc) {
  const i = room.all.findIndex(d => d.slug === doc.slug);
  return { prev: room.all[i - 1], next: room.all[i + 1] };
}

export function researchSkeleton() { return `<div class="art-skeleton">${'<i></i>'.repeat(9)}</div>`; }

// drillPager — prev/next as LATERAL swaps (replaceState → browsing N docs leaves ONE back entry).
export function drillPager(doc, room) {
  const nb = researchNeighbours(room, doc);
  const side = (d, dir) => d
    ? `<button type="button" class="pager-side ${dir}" onclick="window.openResearchDrill&&window.openResearchDrill('${esc(d.slug)}')">
        <span class="material-symbols-rounded">${dir === 'prev' ? 'arrow_back' : 'arrow_forward'}</span>
        <span class="pager-bd"><span class="pager-l">${dir === 'prev' ? 'Previous' : 'Next'}</span><span class="pager-t">${esc(d.title)}</span></span>
      </button>` : '<span></span>';
  return `<div class="doc-pager">${side(nb.prev, 'prev')}${side(nb.next, 'next')}</div>`;
}

// scroll-spy for the drill's inline TOC (the drill has no reading rail — it is one column)
export function wireDrillSpy() {
  const root = document.querySelector('.m3-drill .drill-scroll');
  const links = [...document.querySelectorAll('.m3-drill .drill-toc .toc a')];
  if (!root || !links.length) return;
  if (root.__spy) root.__spy.disconnect();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = '#' + e.target.id;
      links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
    });
  }, { root, rootMargin: '-96px 0px -70% 0px' });
  document.querySelectorAll('.m3-drill .art-body h2[id]').forEach(h => io.observe(h));
  root.__spy = io;
}

// fillResearchDrill — PHASE 2. openDrill() calls render() synchronously and assigns innerHTML, so the real
// GFM parse (async: marked is lazy-imported) cannot happen there. We paint a skeleton, then patch it in
// place on the next frame. Guarded by data-fill="<slug>" + a re-query after the await, so a fast lateral
// swap can never have a stale document's HTML land in the new page.
export async function fillResearchDrill(doc, room) {
  const sel = `.m3-drill .art-body[data-fill="${doc.slug}"]`;
  if (!document.querySelector(sel)) return;
  const { html, sections } = await renderArticle(doc.body);
  const art = document.querySelector(sel);
  if (!art) return;                       // a faster swap already replaced the surface
  art.innerHTML = html;
  art.removeAttribute('data-fill');

  const h2 = sections.filter(s => s.level === 2);
  const toc = document.querySelector('.m3-drill [data-toc]');
  if (toc && h2.length >= 2) toc.innerHTML = `<div class="drill-toc-inner"><div class="drill-toc-lab">On this page</div>${tocRail(h2)}</div>`;

  const pager = document.querySelector('.m3-drill [data-pager]');
  if (pager) pager.innerHTML = drillPager(doc, room);
  wireDrillSpy();
}

// researchDrillBody — the SYNCHRONOUS scaffold openDrill needs, which schedules its own async fill.
// This hook is common to all three open paths (row click, ?drill= cold link, popstate) because every one
// of them resolves through DRILL_PAGES[key]() → render().
export function researchDrillBody(doc, room) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fillResearchDrill(doc, room));
  return `${articleMeta(doc)}
    <div class="drill-toc" data-toc></div>
    <div class="art-body art-prose" data-fill="${esc(doc.slug)}">${researchSkeleton()}</div>
    <div data-pager></div>`;
}

// researchDrillOpts — the full openDrill() opts for ONE document. No filled action (the ≤1-primary rule).
export function researchDrillOpts(doc, room) {
  const isLevel = /^L\d$/i.test(doc.tag || '');
  return {
    key: doc.slug,
    title: doc.title,                 // canonical, from researchClassify
    subtitle: doc.groupLabel,         // short — the read bar lives in the body, where it can't be clipped
    status: { kind: doc.tagKind || 'info', label: isLevel ? `${doc.tag} · Deep research` : doc.tag, icon: isLevel ? '' : 'warning' },
    parentLabel: 'Research',
    actions: [],
    render: () => researchDrillBody(doc, room),
  };
}

// feedsCard — MOLECULE. How this workstream lands in the verdict, at the foot of the article.
export function feedsCard({ text = '', href = '', label = 'Back to verdict' } = {}) {
  if (!text) return '';
  return `<aside class="feeds-card">
    <span class="material-symbols-rounded">conversion_path</span>
    <div>
      <div class="feeds-ttl">Feeds into the verdict</div>
      <div class="feeds-txt">${text}</div>
      ${href ? `<button class="m3-btn text trail" onclick="location.href='${esc(href)}'"><span class="material-symbols-rounded">arrow_forward</span>${esc(label)}</button>` : ''}
    </div>
  </aside>`;
}

// articleMeta — ATOM. The read bar under the article title. Falsy fields are dropped, never rendered as "—".
export function articleMeta({ readTime = '', sources = 0, sections = 0, agent = '', generated = '' } = {}) {
  const bits = [
    generated ? esc(generated) : '',
    readTime ? esc(readTime) : '',
    sources ? `${sources} source${sources === 1 ? '' : 's'}` : '',
    sections ? `${sections} section${sections === 1 ? '' : 's'}` : '',
    agent ? `by <b>${esc(agent)}</b> agent` : '',
  ].filter(Boolean);
  return `<div class="art-meta"><span class="material-symbols-rounded" style="font-size:18px">schedule</span>${bits.join('<span>·</span>')}</div>`;
}

// docPager — MOLECULE. Prev/next through the ordered workstreams, so the room reads like a document.
export function docPager({ prev, next } = {}) {
  const side = (d, dir) => d ? `<a class="pager-side ${dir}" href="#research/${esc(d.slug)}">
      <span class="material-symbols-rounded">${dir === 'prev' ? 'arrow_back' : 'arrow_forward'}</span>
      <span class="pager-bd"><span class="pager-l">${dir === 'prev' ? 'Previous' : 'Next'}</span><span class="pager-t">${esc(d.title)}</span></span>
    </a>` : '<span></span>';
  return `<div class="doc-pager">${side(prev, 'prev')}${side(next, 'next')}</div>`;
}

// ---- renderArticle — REAL GFM ----
// mdToHtml() cannot be patched into correctness: its regression is architectural (no block grammar,
// so no tables, rules, fenced code or nested lists). The classic solved this by lazy-loading marked;
// so do we. Output is scrubbed against an allowlist before it is ever inserted.

// marked's GFM strikethrough reads a lone `~7M users` as an open strike and crosses out the rest of the
// paragraph. Escape single tildes ("approximately"), preserve intentional `~~strikethrough~~`.
// URLs are isolated alongside code spans/fences: a `~` inside a source URL (a real thing — S3 keys, some
// academic hosts) must NOT be escaped to `\~`, which would corrupt the href.
function escapeApproxTildes(md) {
  return String(md).split(/(```[\s\S]*?```|`[^`]*`|https?:\/\/[^\s)]+)/g).map((seg, i) =>
    i % 2 === 1 ? seg   // code span / fence / URL — leave tildes untouched
      : seg.replace(/~+/g, run => run.length === 1 ? '\\~' : run)
  ).join('');
}

let _marked = null;
async function loadMarked() {
  if (_marked === null) {
    try {
      const m = await import('https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js');
      _marked = m.marked || m.default || false;
    } catch (e) { _marked = false; }
  }
  return _marked;
}

const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM']);
const BAD_URL = /^\s*(javascript|vbscript)\s*:/i;
function scrub(root) {
  root.querySelectorAll('*').forEach(el => {
    if (DROP_TAGS.has(el.tagName)) { el.remove(); return; }
    [...el.attributes].forEach(a => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(a.name);
      else if ((n === 'href' || n === 'src' || n === 'xlink:href') && BAD_URL.test(a.value)) el.removeAttribute(a.name);
      else if (n === 'src' && /^\s*data:/i.test(a.value) && !/^\s*data:image\//i.test(a.value)) el.removeAttribute(a.name);
    });
  });
}

// renderArticle(md) → { html, sections } — sections drive tocRail() and the scroll-spy.
export async function renderArticle(md) {
  const src = String(md || '').trim();
  if (!src) return { html: '<p class="body-m variant">This workstream has not been generated yet.</p>', sections: [] };
  const marked = await loadMarked();
  if (!marked) {
    // Never blank the page: show the raw markdown, escaped and wrapped, and let the reader read it.
    return { html: `<pre class="art-raw">${esc(src)}</pre>`, sections: [] };
  }
  let raw;
  try { raw = marked.parse ? marked.parse(escapeApproxTildes(src)) : marked(escapeApproxTildes(src)); }
  catch (e) { return { html: `<pre class="art-raw">${esc(src)}</pre>`, sections: [] }; }

  const root = document.createElement('div');
  root.innerHTML = raw;
  scrub(root);

  // headings → stable, deduped ids; h2/h3 become the TOC (an h1 is the doc's own title, not a section)
  // loop until unique: a counter alone collides when the document itself contains a literal "…-2" heading,
  // which would point two TOC entries at the same anchor
  const sections = [], used = new Set();
  root.querySelectorAll('h1, h2, h3').forEach(h => {
    const base = researchSlug(h.textContent);
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id); h.id = id;
    if (h.tagName !== 'H1') sections.push({ id, label: h.textContent.trim(), level: +h.tagName[1] });
  });
  // tables + code blocks scroll inside their own box — the page body never scrolls sideways
  root.querySelectorAll('table').forEach(t => {
    t.classList.add('dtbl');
    const wrap = document.createElement('div'); wrap.className = 'tbl-wrap';
    t.parentNode.insertBefore(wrap, t); wrap.appendChild(t);
  });
  root.querySelectorAll('img').forEach(i => { i.setAttribute('loading', 'lazy'); if (!i.alt) i.alt = ''; });
  root.querySelectorAll('a[href]').forEach(a => {
    if (/^https?:/i.test(a.getAttribute('href'))) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  });
  root.querySelectorAll('ul, ol').forEach(l => {
    if (l.querySelector(':scope > li > input[type=checkbox]')) l.classList.add('task-list');
  });
  root.querySelectorAll('input[type=checkbox]').forEach(c => { c.disabled = true; });
  return { html: root.innerHTML, sections };
}

// ---- portfolio / queue toolbar (filter chips + optional sub-row + sort + search) ----
// Two forms, both single-sourced here:
//  • legacy:  filterBar(['All','On track',…], placeholder)  → a simple chip row + search (reference pages)
//  • config:  filterBar({ groups:[{dim,label?,chips:[{k,l}],active}], sort?:{id,options:[{v,l}],value}, search?:{id,placeholder} })
//     groups[0] is the primary chip row; groups[1..] render as labelled sub-rows. Each chip carries
//     data-<dim>="<k>" and .selected on the active key, so a page's delegated handlers stay unchanged.
export function filterBar(config = [], placeholder = 'Search') {
  const searchEl = (s = {}) => `<label class="m3-search"${s.max ? ` style="max-width:${s.max}"` : ''}><span class="material-symbols-rounded">search</span><input type="search"${s.id ? ` id="${esc(s.id)}"` : ' class="search"'} placeholder="${esc(s.placeholder || placeholder)}"></label>`;
  if (Array.isArray(config)) {
    return `<div class="filters">${config.map((c, i) => `<button class="m3-chip${i === 0 ? ' selected' : ''}">${esc(c)}</button>`).join('')}${searchEl({ placeholder })}</div>`;
  }
  const { groups = [], sort, search } = config;
  const chipRow = g => (g.chips || []).map(c => `<button class="m3-chip${c.k === g.active ? ' selected' : ''}" data-${esc(g.dim)}="${esc(c.k)}">${esc(c.l)}</button>`).join('');
  const sortSel = sort ? `<select${sort.id ? ` id="${esc(sort.id)}"` : ''} class="ws-sort" aria-label="Sort">${(sort.options || []).map(o => `<option value="${esc(o.v)}"${o.v === sort.value ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>` : '';
  const bar = `<div class="ws-filterbar">${groups[0] ? chipRow(groups[0]) : ''}<div class="ws-filter-spacer"></div>${sortSel}${search ? searchEl({ ...search, max: search.max || '280px' }) : ''}</div>`;
  const subs = groups.slice(1).map(g => `<div class="ws-filter-sub">${g.label ? `<span class="ws-filter-sublabel">${esc(g.label)}</span>` : ''}${chipRow(g)}</div>`).join('');
  return bar + subs;
}

// ---- portfolio table ----
// run-state signal pills for an in-flight assessment (mirrors program.html's machine: queued/running/partial =
// in-flight; needs-attention = finished-but-flagged (Republish); limit-paused = resumable; error = re-runnable).
const RUN_PILL = {
  queued: { kind: 'info', label: 'Queued', icon: 'schedule' },
  running: { kind: 'info', label: 'Assessing…', icon: 'autorenew' },
  partial: { kind: 'info', label: 'Assessing…', icon: 'autorenew' },
  'needs-attention': { kind: 'warn', label: 'Needs attention', icon: 'warning' },
  'limit-paused': { kind: 'warn', label: 'Paused · usage limit', icon: 'pause_circle' },
  error: { kind: 'err', label: 'Run failed · re-run', icon: 'error' },
  idle: { kind: 'n', label: 'Awaiting deck', icon: 'upload_file' },
};
// engagementTable(rows, opts) — opts.onDelete (a global handler NAME) opts IN a trailing action column with a
// quiet, hover/focus-revealed destructive icon button. OPT-IN on purpose: this table also renders on the DS
// sample/spec pages, which must never grow live delete buttons. Omitted → renders exactly as before.
export function engagementTable(rows, opts = {}) {
  const cell = r => {
    // in-flight / gated rows show a run-state pill (never shadows a done row, which falls through to rec/progress)
    const rs = r.runState && r.runState.status;
    if (rs && rs !== 'done' && RUN_PILL[rs]) return `<td>${statusPill(RUN_PILL[rs])}${(rs === 'running' || rs === 'partial') ? ' <span class="et-score" style="color:var(--md-sys-color-on-surface-variant)">0</span><span class="variant">/100 · forming</span>' : ''}</td>`;
    return r.rec
      ? `<td>${recPill(r.rec.kind || 'invest', r.rec.label, r.rec.icon, ' style="height:28px;padding:0 12px;font-size:12px"')} <span class="et-score">${r.rec.score}</span><span class="variant">/100</span></td>`
      : `<td><div class="et-prog">${linearProgress({ value: Math.round((r.progress || 0) * 100), danger: r.danger })}<span class="pct">${Math.round((r.progress || 0) * 100)}%</span></div></td>`;
  };
  // The whole <tr> navigates, so the delete button MUST stop click AND keydown from bubbling — otherwise
  // "delete" drills into the engagement instead of asking.
  const del = r => (opts.onDelete && r.id)
    ? `<td class="et-act"><button class="m3-icon-btn danger" data-id="${esc(r.id)}" aria-label="Delete ${esc(r.name)}" title="Delete" onclick="event.stopPropagation();${opts.onDelete}(this.dataset.id)" onkeydown="event.stopPropagation()"><span class="material-symbols-rounded">delete</span></button></td>`
    : '';
  const go = r => { const h = r.href || 'assess.html'; return ` tabindex="0" role="link" onclick="__drill(this,'${h}')" onkeydown="if(event.key==='Enter'){__drill(this,'${h}')}"`; };
  return `<div class="m3-card table-wrap"><table class="eng-table"><thead><tr><th>Venture</th><th>Stage</th><th>Status</th><th>Progress / signal</th><th>Last activity</th>${opts.onDelete ? '<th class="et-act"><span class="sr-only">Actions</span></th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr${go(r)}>
    <td><div class="et-v"><span class="et-av" style="background:${AVAC[r.avatar]}">${esc(r.i)}</span><div><div class="et-name">${esc(r.name)}</div><div class="et-sub">${esc(r.sub)}</div></div></div></td>
    <td class="et-stage">${esc(r.stage)}</td><td>${statusPill(r.status)}</td>${cell(r)}<td class="et-when">${r.when || '1h ago'}</td>${del(r)}</tr>`).join('')}</tbody></table></div>`;
}

// ============ PORTFOLIO EMPTY STATE (first-run launchpad) + ASSESSMENT WIZARD ============

// primerStrip — ORGANISM. An evergreen "how it works" explainer — numbered horizontal cells (reuses queueItem's
// .q-ic tinted tile). NOT lifecycleStrip (its done/current/pending states imply a live run — wrong for an explainer).
const PRIMER_STEPS = [
  { icon: 'upload_file', title: 'Deck in', note: 'Upload the pitch deck and any financials. That’s all the assessment needs to start.' },
  { icon: 'manage_search', title: 'Research', note: 'Seven workstreams rebuild every load-bearing claim from primary sources — filings, benchmarks, a ten-competitor teardown.' },
  { icon: 'fact_check', title: 'Challenge', note: 'The deck’s headline claims get pressure-tested. What doesn’t survive is flagged, not taken on trust.' },
  { icon: 'insights', title: 'Score', note: 'A weighted 0–100 investability score across seven categories, with the headroom to a stronger number.' },
  { icon: 'balance', title: 'Verdict', note: 'A memo-style call — Invest, Diligence further, or Pass — ready for sign-off and a shareable link.' },
];
export function primerStrip(steps = PRIMER_STEPS, heading = 'How it works — from deck to verdict in five moves') {
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The method</span><span class="t">${esc(heading)}</span></div>
    <ol class="primer">${steps.map((s, i) => `<li class="primer-cell">
      <span class="q-ic"><span class="material-symbols-rounded">${s.icon}</span></span>
      <div class="primer-no">${i + 1}</div>
      <div class="primer-nm">${esc(s.title)}</div>
      <div class="primer-note">${esc(s.note)}</div>
    </li>`).join('')}</ol>
  </section>`;
}

// portfolioEmpty — ORGANISM (page body). The zero-assessment launchpad: orientation hero → 5-move primer → a
// trust band whose credibility figures live INSIDE a real sample-verdict card (never a standalone live-looking
// lockup on a zero-state screen). Reuses sectionHero/statementLockup/coverageLockup/recPill. Composes inline.
export function portfolioEmpty(opts = {}) {
  const onStart = opts.onStart || 'window.openNewAssessment&&window.openNewAssessment()';
  const sampleHref = opts.sampleHref || 'assess.html';
  const cta = `<div class="launch-cta">
      <button class="m3-btn filled" onclick="${onStart}"><span class="material-symbols-rounded">rocket_launch</span>Set up your first assessment</button>
      <div class="launch-sub">You’ll name the venture, drop in the deck, and it starts researching — no build, no founder invite.</div>
      <button class="m3-btn text" onclick="location.href='${sampleHref}'"><span class="material-symbols-rounded">visibility</span>See a sample verdict</button>
    </div>`;
  const hero = sectionHero({
    eyebrow: 'Get started', eyebrowIcon: 'rocket_launch',
    headline: 'Turn a pitch deck into an investment verdict.', headlineEm: 'investment verdict',
    facts: [{ k: 'Setup', v: '~20 minutes' }, { k: 'You need', v: 'A pitch deck <small>PDF</small>' }],
    right: cta,
    thesis: 'Ventrify reads the deck the way your sharpest analyst would — rebuilding every load-bearing claim from primary sources, pressure-testing the story, and returning a scored verdict you can sign off or share. Nothing is taken on trust.'
  });
  // trust band — the coverage figures are captioned as belonging to a COMPLETED assessment, not the operator's own
  const trust = `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">Built to be trusted</span><span class="t">It shows its work</span></div>
    <p class="lead"><span class="drop">Every score</span> is decomposed and every claim is cited — you see exactly how the number was built and what would move it.</p>
    <div class="sample-verdict" role="link" tabindex="0" onclick="location.href='${sampleHref}'" onkeydown="if(event.key==='Enter')location.href='${sampleHref}'">
      <div class="sv-head"><span class="eyebrow accent">A completed assessment</span> ${recPill('consider', 'Diligence further', 'balance', ' style="height:26px;padding:0 11px;font-size:11.5px"')}</div>
      <div class="sv-body"><div class="sv-nm">MoneyGym · Seed</div><div class="sv-cov">35 / 35 signals rated · High confidence · 18 documents · 32 sources cited</div></div>
      <div class="sv-score"><span class="et-score">55</span><span class="variant">/100</span><span class="material-symbols-rounded sv-chev">chevron_right</span></div>
    </div>
  </section>`;
  return `<div class="brief" style="max-width:1120px">
    ${hero}
    <hr class="rule">
    ${primerStrip()}
    <hr class="rule">
    ${trust}
  </div>`;
}

// wizardSteps — MOLECULE. A horizontal numbered form-progress stepper (done ✓ / active / pending) — the horizontal
// sibling of lifecycleStrip (which stays the vertical content timeline). Ported from new-engagement's .wizard-progress.
export function wizardSteps(labels = ['Name', 'Deck', 'Confirm'], active = 0) {
  return `<ol class="wsteps">${labels.map((l, i) => {
    const st = i < active ? 'done' : i === active ? 'active' : 'pending';
    return `${i ? `<li class="wstep-conn ${i <= active ? 'done' : ''}"></li>` : ''}<li class="wstep ${st}">
      <span class="wstep-dot">${i < active ? '<span class="material-symbols-rounded">check</span>' : i + 1}</span>
      <span class="wstep-lab">${esc(l)}</span></li>`;
  }).join('')}</ol>`;
}

// docDropzone — MOLECULE. THE file dropzone: an empty dashed target, or the attached file(s) rendered
// through the shared srcRow so they read identically to the Sources panel. Single-file (the pitch deck)
// and multi-file (the data room) are the two presets of this ONE component — never fork it.
// opts: { icon, prompt, sub, fileIcon, note, status, clearLabel, addLabel, single, onPick, onClear }
//   onPick/onClear are handler NAMES. single → `onClear()`; multi → `onClear(i)` per attached file.
export function docDropzone(files = [], opts = {}) {
  const {
    icon = 'upload_file', prompt = 'Drop files here', sub = '', fileIcon = 'description',
    note = '', status = 'stored', clearLabel = 'Remove', addLabel = 'Add more',
    single = false, onPick = '', onClear = '',
  } = opts;
  const list = (files || []).filter(Boolean);
  if (!list.length) return `<button class="deckdrop" onclick="${onPick}">
    <span class="material-symbols-rounded dd-ic">${esc(icon)}</span>
    <span class="dd-nm">${esc(prompt)}</span>
    <span class="dd-sub">${esc(sub)}</span>
  </button>`;
  // a file may carry its OWN status/tag (e.g. 'Uploading…' / 'Failed' while the panel ingests) — falls back
  // to the zone-level status, so existing callers are unchanged.
  const row = (f, i) => `<div class="deckdrop attached${f.busy ? ' busy' : ''}">${srcRow({ icon: f.icon || fileIcon, title: f.title, note: f.note || note, status: f.status !== undefined ? f.status : status, tag: f.tag })}
    ${opts.locked ? '' : `<button class="m3-btn text" onclick="${onClear}${single ? '' : `(${i})`}"><span class="material-symbols-rounded">close</span>${esc(clearLabel)}</button>`}</div>`;
  if (single) return row(list[0], 0);
  return `<div class="dd-stack">${list.map(row).join('')}${opts.locked ? '' : `<button class="m3-btn text dd-add" onclick="${onPick}"><span class="material-symbols-rounded">add</span>${esc(addLabel)}</button>`}</div>`;
}

// deckDropzone — the single-file PITCH-DECK preset of docDropzone (the hard gate — mirrors dispatch-run.js
// "an assessment cannot run without a pitch deck"). Output is byte-identical to the pre-unification component.
export function deckDropzone(file, opts = {}) {
  return docDropzone(file ? [{ icon: 'slideshow', title: file.title, note: file.note || 'Pitch deck · ready to run' }] : [], {
    single: true, status: 'read', clearLabel: 'Replace',
    icon: 'upload_file', prompt: 'Drop the pitch deck here',
    sub: 'PDF · the assessment runs from it. Optional: financial model, founder letter.',
    onPick: opts.onPick || '', onClear: opts.onClear || '',
  });
}

// STAGES — the single source of truth for a venture's funding stage. Used by the assessment create panel
// (mandatory dropdown), the DS assessment wizard, and the classic build wizard — so the options never drift.
export const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];

// formField — MOLECULE. The reusable workspace form field — a label + an outlined control (input by default,
// or a native <select> dropdown when `options` is passed). Plain HTML (NOT md-outlined-text-field, which mis-sizes
// in a narrow side-sheet) → reliable at any width, themeable, and the single field pattern for forms across the
// product. opts: { label, value, placeholder, options:[str|{v,l}], hint, optional, attr, id, type }.
export function formField(opts = {}) {
  const { label, value = '', placeholder = '', options, hint, optional, attr = '', id, type = 'text' } = opts;
  const idAttr = id ? ` id="${esc(id)}"` : '';
  const control = options
    ? `<div class="field-ctl"><select class="field-in field-sel"${idAttr}${attr}>${[
        ...(placeholder ? [{ v: '', l: placeholder }] : []),
        ...options.map(o => (typeof o === 'string' ? { v: o, l: o } : o))
      ].map(o => `<option value="${esc(o.v)}"${o.v === value ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select><span class="material-symbols-rounded field-chev">expand_more</span></div>`
    : `<input class="field-in" type="${esc(type)}"${idAttr}${attr} value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  return `<label class="field">${label ? `<span class="field-lab">${esc(label)}${optional ? ' <span class="field-opt">optional</span>' : ''}</span>` : ''}${control}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`;
}

// assessmentWizard — ORGANISM. The 3-step assessment setup body (Name → Upload deck (gate) → Confirm & run) as a pure
// function of wizard state. Deck folded IN so "Create & run" already dispatches. Entered via the aux panel overlay.
export function assessmentWizard(state = {}) {
  const step = state.step || 0;
  const primer = `<div class="wiz-primer"><span class="eyebrow accent">You’ll get back</span><div class="wiz-outs">${['A venture score /100', 'The key findings', 'How to strengthen it'].map(o => `<span class="fact"><span class="v">${o}</span></span>`).join('')}</div></div>`;
  const nm = state.name || '';
  const s0 = `<div class="wiz-step">
      <div class="sec-head"><span class="eyebrow accent">Step 1 · Assessment basics</span><span class="t">Name the venture</span></div>
      <div class="wiz-fields">
        ${formField({ label: 'Venture name', value: nm, placeholder: 'e.g. MoneyGym', attr: ' data-field="name"' })}
        <div class="wiz-two">${formField({ label: 'Website', optional: true, type: 'url', placeholder: 'https://…' })}${formField({ label: 'Stage', optional: true, placeholder: 'Select stage', options: STAGES, value: state.stage || '' })}</div>
        ${formField({ label: 'Assigned assessor', options: ['Alex Rivera', 'Jordan Lee', 'Sam Okafor'], value: 'Alex Rivera' })}
      </div>
    </div>`;
  const s1 = `<div class="wiz-step">
      <div class="sec-head"><span class="eyebrow accent">Step 2 · The deck</span><span class="t">Upload the pitch deck</span><span class="meta">required</span></div>
      <p class="lead" style="margin-top:0">${deckDropzone(state.deck, { onPick: state.onPick, onClear: state.onClear })}</p>
    </div>`;
  const s2 = `<div class="wiz-step">
      <div class="sec-head"><span class="eyebrow accent">Step 3 · Confirm</span><span class="t">Create & run the assessment</span></div>
      <div class="wiz-review">${[['Venture', nm || '—'], ['Deck', state.deck ? state.deck.title : 'Not attached'], ['Assessor', 'Alex Rivera'], ['Runs', 'Immediately on create']].map(([k, v]) => `<div class="fact"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    </div>`;
  const bodies = [s0, s1, s2];
  const canNext = step === 0 ? !!nm : step === 1 ? !!state.deck : true;
  const nextLabel = step === 2 ? 'Create & run assessment' : 'Continue';
  const nextIcon = step === 2 ? 'rocket_launch' : 'arrow_forward';
  const onNext = step === 2 ? (state.onLaunch || '') : (state.onNext || '');
  const back = step > 0 ? `<button class="m3-btn text" onclick="${state.onBack || ''}"><span class="material-symbols-rounded">arrow_back</span>Back</button>` : '<span></span>';
  return `<div class="assess-wizard">
    ${wizardSteps(['Name', 'Deck', 'Confirm'], step)}
    ${primer}
    ${bodies[step] || bodies[0]}
    <div class="wiz-actions">${back}<button class="m3-btn filled" ${canNext ? '' : 'disabled'} onclick="${onNext}"><span class="material-symbols-rounded">${nextIcon}</span>${nextLabel}</button></div>
  </div>`;
}

// initAssessmentWizard — wires the "new assessment" flow into the AUX PANEL OVERLAY (the operator's preferred
// surface — entered as a side-sheet over the current context, never a full page). Call once after initShell();
// then window.openNewAssessment() opens the overlay and window.__wiz drives the 3-step state machine (re-rendering
// into the aux body). Used by portfolio.html (empty + populated) and assess-setup.html. opts.onLaunch overrides
// the staged demo (the real flow POSTs /api/create-engagement then /api/dispatch-run).
export function initAssessmentWizard(opts = {}) {
  const state = { step: 0, name: '', deck: null,
    onNext: 'window.__wiz.next()', onBack: 'window.__wiz.back()', onPick: 'window.__wiz.pick()', onClear: 'window.__wiz.clear()', onLaunch: 'window.__wiz.launch()' };
  const bindName = () => {
    if (state.step !== 0) return;
    const f = document.querySelector('.m3-aux [data-field="name"]');
    if (!f) return;
    f.addEventListener('input', () => {
      state.name = f.value;
      const btn = document.querySelector('.m3-aux .wiz-actions .m3-btn.filled');
      if (btn) btn.disabled = !f.value;
    });
  };
  const paint = () => {
    const ab = document.querySelector('.m3-aux .aux-body');
    if (ab) ab.innerHTML = assessmentWizard(state);
    bindName();
  };
  window.__wiz = {
    next() { if (state.step === 0 && !state.name) return; if (state.step === 1 && !state.deck) return; state.step = Math.min(2, state.step + 1); paint(); },
    back() { state.step = Math.max(0, state.step - 1); paint(); },
    pick() { state.deck = { title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Pitch deck · 14 slides · ready to run' }; paint(); },
    clear() { state.deck = null; paint(); },
    launch() { if (opts.onLaunch) opts.onLaunch(); else location.href = 'portfolio.html?state=one'; }
  };
  window.openNewAssessment = () => {
    state.step = 0; state.name = ''; state.deck = null;
    window.openAux && window.openAux({ mode: 'overlay', title: 'New assessment', subtitle: 'Set up a venture assessment', body: assessmentWizard(state) });
    requestAnimationFrame(bindName);
  };
}

// ---- run timing helpers — ported VERBATIM from the classic program.html run-banner. Pure, no deps.
// The runner only pushes to Firestore when `step` CHANGES (~11 writes across a multi-minute run), so a
// client clock is the ONLY thing that keeps "elapsed" honest and can spot a run that never got picked up.
export function runAge(rs) {
  const t = rs && (rs.startedAt || rs.requestedAt);
  if (!t) return null;
  const ms = Date.now() - new Date(t).getTime();
  return ms >= 0 ? ms : null;
}
export function fmtElapsed(ms) {
  if (ms == null) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just started';
  if (m < 60) return m + 'm elapsed';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm elapsed';
}
export function runStalled(rs) {
  const ms = runAge(rs); if (ms == null) return false;
  const s = (rs && rs.status) || '';
  if (s === 'queued') return ms > 3 * 60000;                      // never picked up by the runner
  if (s === 'running' || s === 'partial') return ms > 20 * 60000; // hung far past the window
  return false;
}

// linearProgress — ATOM. THE progress bar (.m3-prog). `value` 0–100 → determinate; null/indeterminate → the
// sliding indeterminate bar. Single source: never hand-inline this markup again.
export function linearProgress(opts = {}) {
  const { value = null, indeterminate = false, danger = false, style = '' } = opts;
  const st = style ? ` style="${style}"` : '';
  if (indeterminate || typeof value !== 'number') return `<div class="m3-prog indeterminate"${st}><span></span></div>`;
  const v = Math.max(0, Math.min(100, value));
  return `<div class="m3-prog"${st}><span style="width:${v}%${danger ? ';background:var(--md-sys-color-error)' : ''}"></span></div>`;
}

// runBanner — MOLECULE. The queued/running/needs-attention/limit-paused/error/done banner shown after "Run
// assessment" (and above the forming scoreLockup on the assess page). Ports program.html's run-banner state machine.
// PROGRESS IS HONEST: the runner writes step/totalSteps/progress to runState, but ONLY once it is actually running
// — at 'queued' totalSteps is 0. So we render a determinate bar ONLY when we have real numbers, and an
// indeterminate one otherwise. Never fabricate a percentage (the classic page's 6%/14% stubs are not ported).
const RUN_BANNER = {
  queued: { kind: 'info', icon: 'schedule', title: 'Queued', text: 'Dispatching the cloud runner — the assessment starts in a moment.', prog: true },
  running: { kind: 'info', icon: 'autorenew', title: 'Assessing…', text: 'Seven workstreams are rebuilding the claims from source. This takes a few minutes.', prog: true },
  partial: { kind: 'info', icon: 'autorenew', title: 'Assessing…', text: 'Research in progress — the score is forming.', prog: true },
  'needs-attention': { kind: 'warn', icon: 'warning', title: 'Needs attention', text: 'The run finished and saved, but the verdict needs a second look. Republish when ready.' },
  'limit-paused': { kind: 'warn', icon: 'pause_circle', title: 'Paused · usage limit', text: 'Resume when your window resets — it picks up where it left off.' },
  error: { kind: 'err', icon: 'error', title: 'Run failed', text: 'Something went wrong. Re-run the assessment — nothing is lost.' },
  done: { kind: 'ok', icon: 'task_alt', title: 'Verdict ready', text: 'The assessment is complete.' },
};
export function runBanner(rs = {}, opts = {}) {
  const s = RUN_BANNER[rs.status] || RUN_BANNER.queued;
  const isRepub = rs.phase === 'republish';              // republish reuses runState (3 steps) — don't dress it as a fresh assessment
  const total = rs.totalSteps || 0, step = rs.step || 0;
  // ONE progress source, in order of truth. null → indeterminate.
  const pct = (typeof rs.progress === 'number' && total > 0) ? rs.progress
    : (total > 0 && step > 0) ? Math.round(step / total * 100)
    : null;
  const stalled = runStalled(rs);
  const elapsed = fmtElapsed(runAge(rs));
  const meta = [total > 0 && step > 0 ? `Step ${step} / ${total}` : '', elapsed].filter(Boolean).join(' · ');
  const title = isRepub && s.prog ? 'Republishing…' : s.title;
  const text = rs.label || (isRepub ? 'Recovering your saved results…' : s.text);
  return `<div class="run-banner ${stalled ? 'warn' : s.kind}">
    <span class="rb-ic"><span class="material-symbols-rounded">${stalled ? 'warning' : s.icon}</span></span>
    <div class="rb-bd">
      <div class="rb-t">${esc(title)}${meta ? `<span class="rb-meta">${esc(meta)}</span>` : ''}</div>
      <div class="rb-x">${esc(text)}</div>
      ${s.prog ? linearProgress({ value: pct, style: 'margin-top:10px' }) : ''}
      ${rs.error ? `<div class="rb-warn">${esc(rs.error)}</div>` : ''}
      ${stalled ? `<div class="rb-warn">This is taking longer than usual — the run may have stalled. You can re-run it; nothing is lost.</div>
      <div class="rb-act"><button class="m3-btn text" onclick="${opts.onRerun || 'window.rerunAssessment&&window.rerunAssessment()'}"><span class="material-symbols-rounded">restart_alt</span>Re-run assessment</button></div>` : ''}
    </div>
  </div>`;
}

// noteCard — MOLECULE. A compact inline card: leading icon + text + optional trailing action(s). The single
// source for the workspace's status/prompt notes ("deck ready — run it", "needs attention"). `center:true`
// renders a centered empty-state message (icon/actions omitted) — the shared "no matching results" surface.
// `text`/`actions` are trusted HTML (developer strings), so they are not escaped here.
export function noteCard(opts = {}) {
  const { icon, iconColor, text = '', actions = '', center = false } = opts;
  if (center) return `<div class="m3-card note-card center">${text}</div>`;
  return `<div class="m3-card note-card">${icon ? `<span class="note-ic material-symbols-rounded"${iconColor ? ` style="color:${iconColor}"` : ''}>${esc(icon)}</span>` : ''}<div class="note-bd body-m">${text}</div>${actions ? `<div class="note-act">${actions}</div>` : ''}</div>`;
}

// ---- queue ----
const UMETA = { high: { title: 'High urgency', ct: '3', sub: 'Blocking a gate or a founder. Address first.' }, med: { title: 'Medium urgency', ct: '2', sub: 'Should be cleared this week.' }, low: { title: 'Low urgency', ct: '2', sub: 'Awareness items. No immediate action required.' } };
// queueItem — accepts BOTH the reference shape {icon,title,desc,meta,action,action2} and the live workspace
// shape {icon,title,detail,typeLabel,programName,age,cta,href,href2}. A primary/secondary render as links when
// an href is given (live navigation), else buttons (reference placeholders). Meta is an explicit string or
// composed from typeLabel · programName · age.
export function queueItem(item) {
  const label = item.cta || item.action || 'Open';
  const kind = item.urgency === 'high' ? 'filled' : 'outlined';
  const primary = item.href ? `<a class="m3-btn ${kind}" href="${esc(item.href)}">${esc(label)}</a>` : `<button class="m3-btn ${kind}">${esc(label)}</button>`;
  const secLabel = item.action2 || 'Open engagement';
  const secondary = item.href2 ? `<a class="m3-btn text" href="${esc(item.href2)}">${esc(secLabel)}</a>` : `<button class="m3-btn text">${esc(secLabel)}</button>`;
  const body = item.desc || item.detail || '';
  const meta = item.meta != null ? esc(item.meta) : [item.typeLabel, item.programName, item.age].filter(Boolean).map(esc).join(' · ');
  return `<div class="m3-card filled qitem ${item.urgency}"><div class="q-ic"><span class="material-symbols-rounded">${esc(item.icon)}</span></div>
    <div class="q-body"><div class="title-m">${esc(item.title)}</div><div class="body-m variant">${esc(body)}</div><div class="q-meta">${meta}</div></div>
    <div class="q-act">${primary}${secondary}</div></div>`;
}
export function queueGroupHead(urgency, items) { const m = UMETA[urgency]; const ct = items ? items.length : m.ct; return `<div class="group-head"><span class="title-l">${m.title}</span><span class="variant">· ${ct}</span></div><div class="group-sub">${m.sub}</div>`; }
// queueBoard — the whole Action-queue body: urgency groups (counts derived from the data). opts.emptyCta =
// {label, icon, onclick} adds a call-to-action to the all-clear card; opts.emptyTitle/emptyText override its copy.
export function queueBoard(items = [], opts = {}) {
  const cta = opts.emptyCta ? `<div style="margin-top:20px"><button class="m3-btn filled" onclick="${opts.emptyCta.onclick || ''}">${opts.emptyCta.icon ? `<span class="material-symbols-rounded">${esc(opts.emptyCta.icon)}</span>` : ''}${esc(opts.emptyCta.label)}</button></div>` : '';
  const allClear = `<div class="m3-card" style="text-align:center;padding:40px 24px"><div class="title-l">${esc(opts.emptyTitle || "You're all caught up")}</div><div class="body-m variant" style="margin-top:6px;max-width:480px;margin-left:auto;margin-right:auto">${esc(opts.emptyText || 'Nothing needs you right now.')}</div>${cta}</div>`;
  const groups = ['high', 'med', 'low'].map(u => {
    const g = items.filter(i => i.urgency === u);
    if (!g.length) return '';
    return queueGroupHead(u, g) + g.map(queueItem).join('');
  }).filter(Boolean);
  return groups.length ? groups.join('') : allClear;
}

// wireMinify — bind ONE masthead to its nearest scroll ancestor. Idempotent (safe to call again on a
// masthead created after initShell, e.g. the drill's). Drives --mh-p 0→1 as content scrolls under it.
function wireMinify(mh) {
  if (!mh || mh.__mhWired) return;
  mh.__mhWired = true;
  let sc = mh.parentElement;
  while (sc && sc !== document.body && sc !== document.documentElement) { const oy = getComputedStyle(sc).overflowY; if (oy === 'auto' || oy === 'scroll') break; sc = sc.parentElement; }
  const target = (sc && sc !== document.body && sc !== document.documentElement) ? sc : window;
  const top = () => target === window ? window.scrollY : target.scrollTop;
  const DIST = 96; let raf = 0;
  const apply = () => { raf = 0; const p = Math.min(1, Math.max(0, top() / DIST)); mh.style.setProperty('--mh-p', p.toFixed(3)); mh.classList.toggle('minified', p > 0.5); };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
  target.addEventListener('scroll', onScroll, { passive: true });
  apply();
}

// ---- drill state (module scope — one drill surface exists, ever) ----
let drillReturn = null;    // the element that opened it, for focus restore
let drillWasRail = false;  // was the nav already collapsed before we drilled?
let drillTrail = [];       // breadcrumb/history trail of keys
let drillCloseTimer = 0;
let liveRegion = null;
function announce(msg) {
  if (!liveRegion) return;
  requestAnimationFrame(() => { liveRegion.textContent = msg; });
}

// ---- theme toggle wiring (call once per page after render) ----
export function initShell() {
  window.__toggleRail = () => document.querySelector('.m3-app') && document.querySelector('.m3-app').classList.toggle('rail');

  // ---- level transitions (cross-document View Transitions) ----
  // __drill just navigates; the travel direction (traverse = came back) drives the content slide.
  window.__drill = (row, href) => location.assign(href);
  try {
    const act = window.navigation && navigation.activation;
    document.documentElement.dataset.navDir = (act && act.navigationType === 'traverse') ? 'back' : 'deeper';
  } catch (e) {}

  // ---- mobile overlay state: nav drawer + aux panel are mutually exclusive (one scrim, one lock) ----
  const app0 = () => document.querySelector('.m3-app');
  const mqCompact = window.matchMedia('(max-width: 840px)');
  let lastFocused = null;
  window.openNav = () => {
    const app = app0(); if (!app || !mqCompact.matches) return;
    window.closeAux && window.closeAux();
    app.classList.remove('rail');
    lastFocused = document.activeElement;
    app.classList.add('nav-open'); document.body.classList.add('overlay-lock');
    const drawer = app.querySelector('.m3-drawer'); if (drawer) { drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); }
    app.querySelectorAll('.mh-nav').forEach(b => b.setAttribute('aria-expanded', 'true'));
    const first = app.querySelector('.m3-drawer .nav-item'); if (first) first.focus();
  };
  window.closeNav = () => {
    const app = app0(); if (!app) return;
    app.classList.remove('nav-open');
    if (!app.classList.contains('aux-open')) document.body.classList.remove('overlay-lock');
    app.querySelectorAll('.mh-nav').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); lastFocused = null; }
  };
  window.toggleNav = () => { const app = app0(); (app && app.classList.contains('nav-open')) ? window.closeNav() : window.openNav(); };
  window.__navButton = () => mqCompact.matches ? window.toggleNav() : window.__toggleRail();
  window.closeOverlay = () => { const app = app0(); (app && app.classList.contains('nav-open')) ? window.closeNav() : (window.closeAux && window.closeAux()); };
  const set = t => { document.documentElement.classList.toggle('light', t === 'light'); try { localStorage.setItem('ventrify-theme', t); } catch (e) {} document.querySelectorAll('.theme-toggle button').forEach(b => b.classList.toggle('on', b.dataset.set === t)); try { window.dispatchEvent(new CustomEvent('ventrify-theme', { detail: t })); } catch (e) {} };
  document.querySelectorAll('.theme-toggle button').forEach(b => b.addEventListener('click', () => set(b.dataset.set)));
  set(document.documentElement.classList.contains('light') ? 'light' : 'dark');

  // masthead: scroll-linked minify — drives --mh-p (0→1) continuously as content scrolls under it.
  // Idempotent + reusable: the drill's masthead is created after initShell, so openDrill() calls it too.
  document.querySelectorAll('.masthead').forEach(wireMinify);

  // ---- auxiliary panel API ----
  window.openAux = (opts = {}) => {
    const app = document.querySelector('.m3-app'); if (!app) return;
    window.closeNav && window.closeNav();
    // With a drill open there is no room to push a third column — a peek must float over it.
    if (app.classList.contains('drill-open')) opts = { ...opts, mode: 'overlay' };
    const set = (s, v, html) => { const el = app.querySelector(s); if (el) { if (html) el.innerHTML = v; else el.textContent = v; } };
    set('.aux-title', opts.title || 'Details');
    set('.aux-sub', opts.subtitle || '');
    set('.aux-body', opts.body || '', true);
    set('.aux-foot', opts.footer || '', true);
    app.classList.remove('aux-push', 'aux-modal');
    app.classList.add('aux-open', opts.mode === 'overlay' ? 'aux-modal' : 'aux-push');
    if (mqCompact.matches) {
      lastFocused = lastFocused || document.activeElement;
      document.body.classList.add('overlay-lock');
      const aux = app.querySelector('.m3-aux'); if (aux) { aux.setAttribute('role', 'dialog'); aux.setAttribute('aria-modal', 'true'); const c = aux.querySelector('.aux-close'); if (c) c.focus(); }
    }
  };
  window.closeAux = () => {
    const app = document.querySelector('.m3-app'); if (!app) return;
    app.classList.remove('aux-open', 'aux-push', 'aux-modal');
    app.querySelectorAll('.urail-item.on').forEach(b => b.classList.remove('on'));
    if (!app.classList.contains('nav-open') && !app.classList.contains('drill-open')) document.body.classList.remove('overlay-lock');
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); lastFocused = null; }
  };

  // ============================================================
  // DRILL — the companion page. window.openDrill() / window.closeDrill()
  //
  // opts = { key, title, subtitle, status, parentLabel, actions[], body|render(), source, deeper }
  // A page declares its drillable content in window.DRILL_PAGES = { key: opts | () => opts }, and
  // marks triggers with [data-drill="key"]. Everything else is handled here.
  // ============================================================
  const mqSplit = window.matchMedia('(max-width: 1080px)');   // ≤1080 → the drill covers instead of splits

  // one persistent live region, created once (announcements fire under reduced motion too)
  liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);

  // Split (>1080): both pages live, NOT modal — Tab flows between them, that's the feature.
  // Full-bleed (≤1080): the drill covers the primary, so it becomes a real modal dialog.
  const syncDrillModal = () => {
    const app = app0(); if (!app || !app.classList.contains('drill-open')) return;
    const surf = app.querySelector('.m3-drill'); const primary = app.querySelector('.shell-main');
    if (!surf || !primary) return;
    primary.classList.add('is-compact');
    if (mqSplit.matches) {
      surf.setAttribute('role', 'dialog'); surf.setAttribute('aria-modal', 'true');
      primary.setAttribute('inert', ''); primary.setAttribute('aria-hidden', 'true');
      document.body.classList.add('overlay-lock');
    } else {
      surf.setAttribute('role', 'region'); surf.removeAttribute('aria-modal');
      primary.removeAttribute('inert'); primary.removeAttribute('aria-hidden');
      if (!app.classList.contains('nav-open') && !app.classList.contains('aux-open')) document.body.classList.remove('overlay-lock');
    }
  };

  window.openDrill = (opts = {}) => {
    const app = app0(); if (!app) return null;
    clearTimeout(drillCloseTimer);
    const first = !app.classList.contains('drill-open');
    if (first) {
      window.closeAux && window.closeAux();          // a page supersedes a detail sheet
      drillReturn = opts.source || document.activeElement;
      drillWasRail = app.classList.contains('rail'); // remember the nav state we came in with
      drillTrail = [];
    }
    let surf = app.querySelector('.m3-drill');
    if (!surf) {                                     // lazily inject, in DOM order, right after <main>
      const m = app.querySelector('.shell-main'); if (!m) return null;
      const t = document.createElement('div'); t.innerHTML = drillSurface();
      surf = t.firstElementChild; m.insertAdjacentElement('afterend', surf);
    }
    surf.style.width = '';   // drop any px width frozen by an in-flight close (re-open before teardown)

    const html = typeof opts.render === 'function' ? opts.render() : (opts.body || '');
    // a REAL masthead with its own scroll-linked minify. The breadcrumb carries no href: inside a drill
    // it is ORIENTATION ("you are here, at this depth"), not navigation — dismissal is the ✕.
    const mh = masthead({
      breadcrumb: { label: opts.parentLabel || 'Back' },
      crumbTail: opts.title, headline: opts.title, compact: opts.title,
      subheading: opts.subtitle || '', status: opts.status, actions: opts.actions || [],
    });
    surf.innerHTML = `<div class="drill-scroll">${mh}<div class="drill-body">${html}</div></div>`;
    surf.setAttribute('aria-label', opts.title || 'Detail');
    surf.setAttribute('aria-hidden', 'false');
    surf.querySelector('.drill-scroll').scrollTop = 0;
    // orientLabel() renders a back-arrow whenever the trail has depth. A drill doesn't navigate back
    // via its crumb, so drop the node entirely — hiding it would leave a dead <a> in the a11y tree.
    const backArrow = surf.querySelector('.orient-back');
    if (backArrow) backArrow.remove();
    // the dismiss control lives in the masthead bar, outside .mh-actions
    const bar = surf.querySelector('.mh-bar');
    if (bar) bar.insertAdjacentHTML('beforeend', drillClose());
    wireMinify(surf.querySelector('.masthead'));

    app.classList.add('rail', 'drill-open');         // nav → rail + open the gutter, one frame
    syncDrillModal();

    // history: push on first-open and on deeper; replace on a lateral sibling swap, so browsing
    // seven cards leaves ONE back entry, not seven.
    const trail = opts.__trail ? opts.__trail
      : first ? [opts.key]
      : opts.deeper ? drillTrail.concat(opts.key)
      : drillTrail.slice(0, -1).concat(opts.key);
    drillTrail = trail;
    if (!opts.__trail) {
      const url = new URL(location.href); url.searchParams.set('drill', trail.join('/'));
      if (opts.restore) {
        // cold deep-link: synthesise an un-drilled entry BEHIND us, so browser Back closes the
        // drill onto the page instead of navigating away from the app entirely.
        const clean = new URL(location.href); clean.searchParams.delete('drill');
        history.replaceState({ v: 'drill', trail: [] }, '', clean);
        history.pushState({ v: 'drill', trail }, '', url);
      } else if (first || opts.deeper) history.pushState({ v: 'drill', trail }, '', url);
      else history.replaceState({ v: 'drill', trail }, '', url);
    }

    const h = surf.querySelector('.mh-hero .headline-m') || surf;
    if (h) { if (h !== surf) h.tabIndex = -1; h.focus({ preventScroll: true }); }
    announce((first ? 'Opened detail: ' : 'Now viewing: ') + (opts.title || '') + '. Press Escape to go back.');
    return surf;
  };

  // Every close path — back arrow, breadcrumb, Esc, browser Back — funnels through history.back()
  // so they can never disagree about state.
  window.closeDrill = ({ fromPop = false } = {}) => {
    const app = app0(); if (!app || !app.classList.contains('drill-open')) return;
    // DISMISS means dismiss: from a tertiary page the ✕ (and Esc) exit the drill entirely rather than
    // stepping up one level. Unwind every entry this drill pushed, so the popstate reconciler lands on
    // the un-drilled page. Browser Back keeps its own semantics — it steps up exactly one level.
    if (!fromPop) { history.go(-Math.max(1, drillTrail.length)); return; }
    const surf = app.querySelector('.m3-drill');
    const primary = app.querySelector('.shell-main');

    // The drill's width is calc(100% - var(--nav-w) - ...). Restoring the nav in the same frame would
    // therefore snap it 180px narrower mid-slide. Freeze the width in px for the duration of the
    // teardown so the nav, the primary's width and the primary's content can all animate TOGETHER —
    // one gesture back, not a page transition followed by a nav transition.
    if (surf) surf.style.width = surf.getBoundingClientRect().width + 'px';

    app.classList.remove('drill-open');
    if (!drillWasRail) app.classList.remove('rail');
    if (primary) primary.classList.remove('is-compact');

    if (surf) surf.setAttribute('aria-hidden', 'true');
    // un-inert BEFORE restoring focus, or focus lands on <body>
    if (primary) { primary.removeAttribute('inert'); primary.removeAttribute('aria-hidden'); }
    if (!app.classList.contains('nav-open') && !app.classList.contains('aux-open')) document.body.classList.remove('overlay-lock');
    drillTrail = [];
    // preventScroll: restoring focus to the trigger row must NOT scroll it into view — that would
    // defeat the primary's scroll preservation (the row often sits under the sticky masthead).
    if (drillReturn && drillReturn.focus) drillReturn.focus({ preventScroll: true });
    drillReturn = null;
    announce('Closed.');

    drillCloseTimer = setTimeout(() => {
      if (app.classList.contains('drill-open')) return;
      if (surf) { surf.style.width = ''; surf.innerHTML = ''; }
    }, 380);
  };

  // Esc closes the TOPMOST surface: nav → aux → drill (aux is forced over the drill, so it goes first)
  window.closeOverlay = () => {
    const app = app0();
    if (app && app.classList.contains('nav-open')) return window.closeNav();
    if (app && app.classList.contains('aux-open')) return window.closeAux();
    if (app && app.classList.contains('drill-open')) return window.closeDrill();
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeOverlay(); });

  // focus trap — only while the drill is a modal cover (≤1080). Above that, escaping to the primary
  // is the intended behaviour, so no trap.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const app = app0(); if (!app || !app.classList.contains('drill-open') || !mqSplit.matches) return;
    const surf = app.querySelector('.m3-drill'); if (!surf) return;
    const f = [...surf.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
    if (!f.length) { e.preventDefault(); surf.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // [data-drill="key"] — the generic trigger (mirrors [data-aux-card])
  const drillOpts = key => { const s = window.DRILL_PAGES && window.DRILL_PAGES[key]; return typeof s === 'function' ? s() : s; };
  document.querySelectorAll('[data-drill]').forEach(el => {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'link');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    const go = () => { const o = drillOpts(el.dataset.drill); if (o) window.openDrill({ key: el.dataset.drill, source: el, ...o }); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  // browser Back / Forward reconciles the drill
  window.addEventListener('popstate', e => {
    const app = app0(); if (!app) return;
    const want = (e.state && e.state.v === 'drill' && Array.isArray(e.state.trail)) ? e.state.trail : [];
    if (!want.length) { if (app.classList.contains('drill-open')) window.closeDrill({ fromPop: true }); return; }
    const leaf = want[want.length - 1]; const o = drillOpts(leaf);
    if (o) window.openDrill({ key: leaf, __trail: want, ...o });
  });

  // keep the drill coherent across the 1080 and 840 boundaries while it is open
  [mqSplit, mqCompact].forEach(mq => mq.addEventListener('change', () => {
    const app = app0(); if (!app || !app.classList.contains('drill-open')) return;
    if (!mqCompact.matches) app.classList.add('rail');   // re-assert the rail above the mobile breakpoint
    syncDrillModal();
  }));

  // cold deep-link: ?drill=<key>. Deferred a frame so a page can assign DRILL_PAGES after initShell().
  requestAnimationFrame(() => {
    const k = new URLSearchParams(location.search).get('drill');
    if (!k) return;
    const leaf = k.split('/').pop(); const o = drillOpts(leaf);
    if (o) window.openDrill({ key: leaf, restore: true, ...o });
  });

  // ---- aux trigger cards: any [data-aux-card] (re)opens the panel in its shell's mode ----
  document.querySelectorAll('[data-aux-card]').forEach(c => {
    const app = c.closest('.m3-app');
    const mode = (app && app.dataset.auxMode) || 'push';
    c.addEventListener('click', () => window.openAux({ mode, ...auxDemoContent() }));
  });

  // ---- utility rail: each tool toggles the aux panel (push) ----
  document.querySelectorAll('.m3-utilrail').forEach(rail => {
    const tools = [...rail.querySelectorAll('.urail-item')];
    tools.forEach(btn => btn.addEventListener('click', () => {
      const tool = btn.dataset.tool || '';
      // a page can bind a rail tool to a DIRECT handler via window.RAIL_ACTIONS[tool] — it owns the
      // interaction (fires an action or opens its own aux panel), e.g. a download or a share flow.
      const action = window.RAIL_ACTIONS && window.RAIL_ACTIONS[tool];
      if (typeof action === 'function') { tools.forEach(b => b.classList.remove('on')); action(); return; }
      const wasOn = btn.classList.contains('on');
      tools.forEach(b => b.classList.remove('on'));
      if (wasOn) { window.closeAux(); return; }
      btn.classList.add('on');
      const label = btn.getAttribute('aria-label') || 'Tool';
      const panel = btn.dataset.panel || '';
      // a page can author real content for a rail tool via window.RAIL_PANELS[panel] → {title,subtitle,body,footer};
      // otherwise the generic placeholder renders.
      const custom = window.RAIL_PANELS && window.RAIL_PANELS[panel];
      if (custom) { const c = (typeof custom === 'function' ? custom() : custom) || {}; window.openAux({ mode: 'push', title: c.title || label, subtitle: c.subtitle || 'Utility', body: c.body || '', footer: c.footer || '' }); return; }
      window.openAux({ mode: 'push', title: label, subtitle: 'Utility', body: railPanel(panel, label) });
    }));
    if (rail.dataset.auto && tools[0] && window.matchMedia('(min-width: 841px)').matches) requestAnimationFrame(() => tools[0].click());
  });

  // ---- mobile nav wiring: close on select, keyboard-activate, reconcile on resize ----
  document.querySelectorAll('.m3-drawer .nav-item').forEach(it => {
    it.addEventListener('click', () => { if (mqCompact.matches) window.closeNav(); });
    it.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.click(); } });
  });
  const onMq = () => { const app = app0(); if (!app) return; if (mqCompact.matches) app.classList.remove('rail'); else { window.closeNav(); document.body.classList.remove('overlay-lock'); } };
  mqCompact.addEventListener ? mqCompact.addEventListener('change', onMq) : mqCompact.addListener(onMq);
}

// ---- tab switching for masthead .m3-tabs ↔ .tab-panel (call once after render) ----
// opts.names: slug per tab (e.g. ['verdict','investability',...]) enables #hash deep-linking
// so a back-link like assess.html#research lands on the right tab.
export function initTabs(opts = {}) {
  const tablist = document.querySelector('.m3-tabs');
  const tabEls = tablist ? [...tablist.querySelectorAll('.m3-tab')] : [];
  const panels = [...document.querySelectorAll('.tab-panel')];
  if (!tabEls.length || !panels.length) return;
  const names = opts.names || [];
  const select = i => {
    tabEls.forEach((t, n) => { t.classList.toggle('active', n === i); t.setAttribute('aria-selected', n === i); });
    panels.forEach((p, n) => p.classList.toggle('active', n === i));
  };
  const active = () => tabEls.findIndex(t => t.classList.contains('active'));
  const wanted = () => {
    let s = Math.max(0, active());
    const h = (location.hash || '').replace('#', '');
    if (h && names.length) { const idx = names.indexOf(h); if (idx >= 0) s = idx; }
    return s;
  };
  tabEls.forEach((t, i) => t.addEventListener('click', () => select(i)));
  select(wanted());
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); const idx = names.indexOf(h); if (idx >= 0) select(idx); });
}
