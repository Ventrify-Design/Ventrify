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
export function pageShell({ active = 'portfolio', masthead = '', body = '', aux = false, rail = false, railOverflow = [], auxMode = 'push', badges, nav, brand, account } = {}) {
  const hasRail = Array.isArray(rail) ? rail.length > 0 : !!rail;
  const tools = [{ id: 'a', icon: 'build', label: 'Tool' }, { id: 'b', icon: 'insights', label: 'Tool' }, { id: 'c', icon: 'notifications', label: 'Tool' }];
  return `<div class="m3-app app-scroll${hasRail ? ' has-utilrail' : ''}" data-aux-mode="${auxMode}">
    ${drawer(active, { badges, nav, brand, account })}
    <main class="m3-main shell-main">
      ${masthead}
      <div class="shell-body">${body}</div>
    </main>
    ${aux ? auxPanel(aux === true ? {} : aux) : ''}
    ${hasRail ? utilRail(Array.isArray(rail) ? rail : tools, { overflow: railOverflow }) : ''}
  </div>`;
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

// ---- investability: mini (bento) + full scorecard ----
export function investabilityMini(score, onFull = '') {
  return `<div class="m3-card stack">
    <div class="card-hd" style="margin-bottom:4px">${overline('Investability')}${overline('7 × 5 · VSS')}</div>
    ${radar(score, { max: 340 })}
    <div style="display:flex;justify-content:center;gap:16px;font-size:12px;margin-top:-4px;">
      <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:12px;height:3px;background:var(--md-sys-color-primary);border-radius:2px;"></span>Now <b style="color:var(--md-sys-color-on-surface)">${score.composite}</b></span>
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--md-sys-color-on-surface-variant)"><span style="width:12px;border-top:2px dashed var(--success);"></span>Potential <b style="color:var(--success)">~${score.potential}</b></span>
    </div>
    <div>${score.categories.map(c => `<div class="vss"><span class="nm">${esc(c.label)}</span><div class="m3-prog"><span style="width:calc(${c.frac} * 100%)"></span></div><span class="num">${c.num}</span></div>`).join('')}</div>
    ${onFull ? `<button class="m3-btn text trail" onclick="${onFull}"><span class="material-symbols-rounded">arrow_forward</span>Full scorecard &amp; fixes</button>` : ''}
  </div>`;
}
export function investabilityScorecard(score) {
  const contribRows = score.contributions.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td style="text-align:right;${r[4] ? 'color:var(--md-sys-color-error)' : ''}">${r[3]}</td></tr>`).join('');
  const fixes = score.fixes.map(f => `<div class="f"><span class="dot" style="background:var(--md-sys-color-${f.kind === 'err' ? 'error' : ''}${f.kind === 'warn' ? '' : ''});${f.kind === 'warn' ? 'background:var(--warning);' : ''}"></span><b>${esc(f.cat)}</b> — ${esc(f.detail)}<span class="fl">${f.lift}</span></div>`).join('');
  const heat = score.heatmap.map(g => `<div class="heat-card"><div class="h"><span class="cat">${esc(g.cat)}</span><span class="lift">${g.lift}</span></div><div class="slug">${esc(g.slug)}</div><div class="note">&ldquo;${esc(g.note)}&rdquo;</div></div>`).join('');
  const uplift = score.potential - score.composite;
  return `<div class="sections">
    <section class="m3-card"><div class="card-hd">${overline('How the score is calculated')}${overline('Weighted 0–100')}</div>
      <div class="cols" style="align-items:center;gap:32px;">
        <div style="text-align:center;">
          <div class="score" style="font-size:72px;line-height:1;">${score.composite}<small style="font-size:26px;">/100</small></div>
          <div style="margin-top:10px;">${statusPill({ kind: 'warn', label: score.band, icon: 'trending_flat' })}</div>
          <div class="body-m variant" style="margin-top:12px;">Now <b style="color:var(--md-sys-color-on-surface)">${score.composite}</b> &rarr; Potential <b style="color:var(--success)">~${score.potential}</b> <span style="color:var(--success)">(+${uplift})</span></div>
        </div>
        <table class="tbl"><thead><tr><th>Category</th><th>Weight</th><th>Rated</th><th style="text-align:right">Contribution</th></tr></thead>
          <tbody>${contribRows}</tbody>
          <tfoot><tr><td style="font-weight:500">Investability score</td><td></td><td></td><td style="text-align:right;font-weight:500;color:var(--warning)">${score.composite} / 100</td></tr></tfoot></table>
      </div>
      <p class="body-s variant" style="margin-top:14px;">Contribution = (rated &divide; max) &times; weight. Bands: <b style="color:var(--success)">Strong</b> &ge;0.80 &middot; <b style="color:var(--warning)">Mixed</b> 0.50–0.79 &middot; <b style="color:var(--md-sys-color-error)">Gap</b> &lt;0.50. Unassessable signals are excluded, not scored zero.</p>
    </section>
    <section class="m3-card"><div class="card-hd">${overline('Category profile — now vs. potential')}</div>
      <div class="cols" style="gap:36px;align-items:center;">
        ${radar(score, { max: 360 })}
        <div>
          <div style="display:flex;gap:18px;font-size:13px;margin-bottom:12px;">
            <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:14px;height:3px;background:var(--md-sys-color-primary);border-radius:2px;"></span>Now <b>${score.composite}</b></span>
            <span style="display:inline-flex;align-items:center;gap:6px;color:var(--md-sys-color-on-surface-variant)"><span style="width:14px;border-top:2px dashed var(--success);"></span>Potential <b style="color:var(--success)">~${score.potential}</b></span>
          </div>
          <p class="body-l" style="margin:0 0 4px">Closing the priority gaps below would lift the score from <b>${score.composite}</b> to <b style="color:var(--success)">~${score.potential}</b> (+${uplift}). Strongest on <b>Product</b> and <b>Financial defensibility</b>; thinnest on <b>Execution</b> and <b>Technical moat</b> — a concentrated profile.</p>
          <div class="fixes-l">${fixes}</div>
          <div class="body-m" style="margin-top:8px;"><span style="color:var(--success)">1 strong</span> &middot; <span style="color:var(--warning)">4 mixed</span> &middot; <span style="color:var(--md-sys-color-error)">2 gaps</span></div>
        </div>
      </div>
    </section>
    <section class="m3-card"><div class="card-hd">${overline('Fixes to reach your potential · top 6')}${overline('Ranked by lift × weight')}</div>
      <div class="heat-grid">${heat}</div>
    </section>
  </div>`;
}

// ---- case both ways ----
export function caseBothWays(a) {
  const col = (label, cls, items, mi) => `<div class="m3-card"><div class="card-hd"><span class="overline" style="color:var(--${cls})">The case to ${label}</span></div>
    <div class="pts ${label === 'invest' ? 'good' : 'bad'}">${items.map(t => `<div class="row"><span class="material-symbols-rounded mi">${mi}</span> ${esc(t)}</div>`).join('')}</div></div>`;
  return `<section class="cols">${col('invest', 'success', a.bull, 'check_circle')}${col('pass', 'md-sys-color-error', a.bear, 'cancel')}</section>`;
}

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

// metricRow — the ONE shared row for the Investability tab. Both the composition table AND the
// strength profile compose this; only the bar payload + value strings differ per caller. Unifies
// the drill affordance (chevron + hover + role=button + keyboard focus on every clickable row).
// opts: { key, label, sub, dot:'strong'|'mixed'|'gap'|null, bar:{now:0..1, pot:0..1, tick},
//         value, valueMuted, sub2:{text, tone:'up'|'flat'}, onDrill, foot }
export function metricRow(opts = {}) {
  const { key, label, sub, dot, bar = {}, value, valueMuted = '', sub2, onDrill = '', foot = false, cls = '' } = opts;
  const clickable = onDrill && !foot;
  const act = clickable
    ? ` role="button" tabindex="0" onclick="${onDrill}('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onDrill}('${key}')}"`
    : '';
  const now = Math.max(0, Math.min(100, (bar.now || 0) * 100)).toFixed(1);
  const pot = Math.max(0, Math.min(100, (bar.pot || 0) * 100)).toFixed(1);
  const hasPot = bar.pot > (bar.now || 0) + 0.001;
  return `<div class="mrow${clickable ? ' drill' : ''}${foot ? ' foot' : ''}${cls ? ' ' + cls : ''}"${act}>
    <div class="mrow-lab"><div class="mrow-nm">${dot ? `<span class="mrow-dot ${dot}"></span>` : ''}${esc(label)}</div>${sub ? `<div class="mrow-sub">${esc(sub)}</div>` : ''}</div>
    <div class="mrow-bar">${hasPot ? `<div class="pot" style="width:${pot}%"></div>` : ''}${foot ? '' : `<div class="now" style="width:${now}%"></div>`}${hasPot && bar.tick ? `<div class="tick" style="left:${pot}%"></div>` : ''}</div>
    <div class="mrow-val"><span class="v">${esc(value)}${valueMuted ? `<span class="out">${esc(valueMuted)}</span>` : ''}</span>${sub2 ? `<span class="s ${sub2.tone === 'up' ? 'up' : 'flat'}">${esc(sub2.text)}</span>` : ''}</div>
    ${clickable ? '<span class="material-symbols-rounded mrow-chev">chevron_right</span>' : '<span class="mrow-chev"></span>'}
  </div>`;
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
  return `<section class="sec" style="padding-top:8px">
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
    <section class="sec" style="padding-top:8px"><div class="dil">${groups}</div></section>`;

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

// comparableRounds — legacy card (retired from assess.html; comps now render via compScan inside dealValuation).
export function comparableRounds(rounds) {
  return `<section class="m3-card"><div class="card-hd">${overline('Comparable rounds')}${overline(rounds.length + ' benchmarked')}</div><div class="m3-list">${rounds.map(r => `<div class="m3-li"${r.me ? ' style="background:var(--md-sys-color-primary-container)"' : ''}><div class="m3-li-start"><div class="li-lead" ${r.me ? 'style="background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)"' : ''}>${esc(r.i)}</div></div><div class="m3-li-body"><div class="m3-li-headline">${esc(r.name)}${r.tag ? ` <span class="body-s">— ${esc(r.tag)}</span>` : ''}</div><div class="m3-li-support">${esc(r.meta)}</div></div><div class="m3-li-end"><div><b>${esc(r.amount)}</b><div class="body-s variant">${esc(r.val)}</div></div></div></div>`).join('')}</div></section>`;
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

// teamDiligence — legacy card (retired from assess.html; the roster now renders via founderRoster).
export function teamDiligence(team, onOpen = '') {
  return `<section class="m3-card"><div class="card-hd">${overline('Team & founder diligence')}${statusPill({ kind: 'warn', label: 'Key gaps' })}</div>
    <p class="body-m variant" style="margin:-8px 0 10px">${esc(team.summary)}</p>
    <div class="m3-list">${team.members.map(m => `<div class="m3-li"><div class="m3-li-start"><div class="li-lead" style="${memberBg(m.signal)}">${esc(m.i)}</div></div><div class="m3-li-body"><div class="m3-li-headline">${esc(m.name)}</div><div class="m3-li-support">${esc(m.bg)}</div></div><div class="m3-li-end">${statusPill(SIGCHIP[m.signal])}</div></div>`).join('')}</div>
    <hr class="m3-divider">
    <div class="overline" style="color:var(--warning);margin-bottom:10px;">Team gaps</div>
    <div class="pts bad" style="gap:10px;">${team.gaps.map(g => `<div class="row"><span class="material-symbols-rounded mi" style="color:var(--warning)">error</span> ${esc(g)}</div>`).join('')}</div>
    <div class="see-research"><button class="m3-btn text trail" ${onOpen ? `onclick="${onOpen}('team')"` : ''}><span class="material-symbols-rounded">arrow_forward</span>Read the full founder diligence</button></div></section>`;
}

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

export function diligenceChecklist(items) {
  return `<section class="m3-card"><div class="card-hd">${overline('Diligence checklist')}${overline('3 blockers · before you wire')}</div><div class="m3-list">${items.map(d => `<div class="m3-li"><div class="m3-li-start"><span class="status ${d.kind}">${esc(d.tag)}</span></div><div class="m3-li-body"><div class="m3-li-headline">${esc(d.title)}</div><div class="m3-li-support">${esc(d.note)}</div></div></div>`).join('')}</div></section>`;
}
export function keyFindings(findings) {
  return `<section class="m3-card"><div class="card-hd">${overline('Key findings')}${overline('From the research')}</div><div class="m3-list">${findings.map(f => `<div class="m3-li"><div class="m3-li-start"><span class="material-symbols-rounded" style="color:var(--${f.color === 'error' ? 'md-sys-color-error' : f.color})">${f.icon}</span></div><div class="m3-li-body"><div class="m3-li-headline">${esc(f.title)}</div><div class="m3-li-support">${esc(f.note)}</div></div></div>`).join('')}</div></section>`;
}

// ---- research + data room ----
const RTONE = { p: 'rgba(208,188,255,0.14)', s: 'rgba(111,219,180,0.14)', w: 'rgba(247,192,103,0.14)' };
const RCOL = { p: 'var(--md-sys-color-primary)', s: 'var(--success)', w: 'var(--warning)' };
export function researchList(items, onOpen = '') {
  return `<section class="m3-card"><div class="card-hd">${overline('Deep research')}${overline('Agent-generated · openable')}</div>
    <p class="body-m variant" style="margin:-8px 0 8px">The long-form research behind the verdict — every workstream, fully sourced and traceable back to the evidence.</p>
    <div class="m3-list">${items.map((r, i) => `<div class="m3-li button" ${onOpen ? `onclick="${onOpen}('research',${i})"` : ''}><div class="m3-li-start"><span class="rlead" style="background:${RTONE[r.tone]}"><span class="material-symbols-rounded" style="color:${RCOL[r.tone]}">${r.icon}</span></span></div><div class="m3-li-body"><div class="m3-li-headline">${esc(r.title)}</div><div class="m3-li-support">${esc(r.note)}</div></div><div class="m3-li-end rmeta"><span class="status ${r.tagKind || 'info'}">${esc(r.tag)}</span><span class="material-symbols-rounded variant">chevron_right</span></div></div>`).join('')}</div></section>`;
}
export function dataRoom(docs) {
  return `<section class="m3-card"><div class="card-hd">${overline('Data room')}${overline('Source documents · 18')}</div><div class="m3-list">${docs.map(d => `<div class="m3-li button"><div class="m3-li-start"><span class="material-symbols-rounded" style="color:var(--md-sys-color-${d.action === 'tag' ? 'primary' : 'on-surface-variant'})">${d.icon}</span></div><div class="m3-li-body"><div class="m3-li-headline">${esc(d.title)}</div><div class="m3-li-support">${esc(d.note)}</div></div><div class="m3-li-end">${d.action === 'tag' ? `<span class="status info">${esc(d.tag)}</span>` : `<span class="material-symbols-rounded variant">download</span>`}</div></div>`).join('')}</div></section>`;
}

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
  // assemble present sections, then join with rules — an absent section (empty index, no evidence
  // category) never leaves a dangling header or doubled hairline. Mirrors marketMemo's filter/join.
  const secs = [
    researchHero(a, s),
    researchIndex(a.research, 'openPeek'),
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
  return sources.map((s, i) => `<div class="src"><span class="n">${i + 1}</span><div><a href="${esc(s.href || '#')}">${esc(s.title)}</a><div class="dom">${esc(s.dom || '')}</div></div></div>`).join('');
}
export function tocRail(sections = [], active = 0) {
  return `<nav class="toc">${sections.map((s, i) => `<a class="${i === active ? 'on' : ''}" href="#${esc(s.id)}">${esc(s.label)}</a>`).join('')}</nav>`;
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
export function engagementTable(rows) {
  const cell = r => {
    // in-flight / gated rows show a run-state pill (never shadows a done row, which falls through to rec/progress)
    const rs = r.runState && r.runState.status;
    if (rs && rs !== 'done' && RUN_PILL[rs]) return `<td>${statusPill(RUN_PILL[rs])}${(rs === 'running' || rs === 'partial') ? ' <span class="et-score" style="color:var(--md-sys-color-on-surface-variant)">0</span><span class="variant">/100 · forming</span>' : ''}</td>`;
    return r.rec
      ? `<td>${recPill(r.rec.kind || 'invest', r.rec.label, r.rec.icon, ' style="height:28px;padding:0 12px;font-size:12px"')} <span class="et-score">${r.rec.score}</span><span class="variant">/100</span></td>`
      : `<td><div class="et-prog"><div class="m3-prog"><span style="width:calc(${r.progress} * 100%)${r.danger ? ';background:var(--md-sys-color-error)' : ''}"></span></div><span class="pct">${Math.round(r.progress * 100)}%</span></div></td>`;
  };
  const go = r => { const h = r.href || 'assess.html'; return ` tabindex="0" role="link" onclick="__drill(this,'${h}')" onkeydown="if(event.key==='Enter'){__drill(this,'${h}')}"`; };
  return `<div class="m3-card table-wrap"><table class="eng-table"><thead><tr><th>Venture</th><th>Stage</th><th>Status</th><th>Progress / signal</th><th>Last activity</th></tr></thead><tbody>${rows.map(r => `<tr${go(r)}>
    <td><div class="et-v"><span class="et-av" style="background:${AVAC[r.avatar]}">${esc(r.i)}</span><div><div class="et-name">${esc(r.name)}</div><div class="et-sub">${esc(r.sub)}</div></div></div></td>
    <td class="et-stage">${esc(r.stage)}</td><td>${statusPill(r.status)}</td>${cell(r)}<td class="et-when">${r.when || '1h ago'}</td></tr>`).join('')}</tbody></table></div>`;
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

// deckDropzone — MOLECULE. The pitch-deck upload (the hard gate — mirrors dispatch-run.js "an assessment cannot run
// without a pitch deck"). Shows an attached file via the shared srcRow so it reads identically to the Sources panel.
export function deckDropzone(file, opts = {}) {
  if (file) return `<div class="deckdrop attached">${srcRow({ icon: 'slideshow', title: file.title, note: file.note || 'Pitch deck · ready to run', status: 'read' })}
    <button class="m3-btn text" onclick="${opts.onClear || ''}"><span class="material-symbols-rounded">close</span>Replace</button></div>`;
  return `<button class="deckdrop" onclick="${opts.onPick || ''}">
    <span class="material-symbols-rounded dd-ic">upload_file</span>
    <span class="dd-nm">Drop the pitch deck here</span>
    <span class="dd-sub">PDF · the assessment runs from it. Optional: financial model, founder letter.</span>
  </button>`;
}

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
        <div class="wiz-two">${formField({ label: 'Website', optional: true, type: 'url', placeholder: 'https://…' })}${formField({ label: 'Stage', optional: true, placeholder: 'Select stage', options: ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'], value: state.stage || '' })}</div>
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

// runBanner — MOLECULE. The queued/running/needs-attention/limit-paused/error/done banner shown after "Create & run"
// (and above the forming scoreLockup on the assess page). Ports program.html's run-banner state machine.
const RUN_BANNER = {
  queued: { kind: 'info', icon: 'schedule', title: 'Queued', text: 'Dispatching the cloud runner — the assessment starts in a moment.' },
  running: { kind: 'info', icon: 'autorenew', title: 'Assessing…', text: 'Seven workstreams are rebuilding the claims from source. This takes a few minutes.', prog: true },
  partial: { kind: 'info', icon: 'autorenew', title: 'Assessing…', text: 'Research in progress — the score is forming.', prog: true },
  'needs-attention': { kind: 'warn', icon: 'warning', title: 'Needs attention', text: 'The run finished and saved, but the verdict needs a second look. Republish when ready.' },
  'limit-paused': { kind: 'warn', icon: 'pause_circle', title: 'Paused · usage limit', text: 'Resume when your window resets — it picks up where it left off.' },
  error: { kind: 'err', icon: 'error', title: 'Run failed', text: 'Something went wrong. Re-run the assessment — nothing is lost.' },
  done: { kind: 'ok', icon: 'task_alt', title: 'Verdict ready', text: 'The assessment is complete.' },
};
export function runBanner(runState = {}) {
  const s = RUN_BANNER[runState.status] || RUN_BANNER.queued;
  return `<div class="run-banner ${s.kind}">
    <span class="rb-ic"><span class="material-symbols-rounded">${s.icon}</span></span>
    <div class="rb-bd"><div class="rb-t">${esc(s.title)}</div><div class="rb-x">${esc(runState.label || s.text)}</div>${s.prog ? '<div class="m3-prog indeterminate" style="margin-top:8px"><span></span></div>' : ''}</div>
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

  // masthead: scroll-linked minify — drives --mh-p (0→1) continuously as content scrolls under it
  document.querySelectorAll('.masthead').forEach(mh => {
    let sc = mh.parentElement;
    while (sc && sc !== document.body && sc !== document.documentElement) { const oy = getComputedStyle(sc).overflowY; if (oy === 'auto' || oy === 'scroll') break; sc = sc.parentElement; }
    const target = (sc && sc !== document.body && sc !== document.documentElement) ? sc : window;
    const top = () => target === window ? window.scrollY : target.scrollTop;
    const DIST = 96; let raf = 0;
    const apply = () => { raf = 0; const p = Math.min(1, Math.max(0, top() / DIST)); mh.style.setProperty('--mh-p', p.toFixed(3)); mh.classList.toggle('minified', p > 0.5); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    target.addEventListener('scroll', onScroll, { passive: true });
    apply();
  });

  // ---- auxiliary panel API ----
  window.openAux = (opts = {}) => {
    const app = document.querySelector('.m3-app'); if (!app) return;
    window.closeNav && window.closeNav();
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
    if (!app.classList.contains('nav-open')) document.body.classList.remove('overlay-lock');
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); lastFocused = null; }
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeOverlay(); });

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
