// ============================================================
// Ventrify OS — Design System · render functions
// Every component + widget is a pure function: data in, HTML string out.
// The showcase AND the workspace pages call these, so a change here rolls
// through everywhere. Styling lives in theme.css (tokens) + ds.css (components).
// ============================================================

// Canonical VSS sub-signal questions — reused from the shared workspace renderer so
// the assess drill-down and the live scorecard never diverge (keep-DS-in-sync).
import { brandLockup, hasLockup } from './brand-lockup.js';
import { SUB_Q } from '../investability-view.js';
import { GUIDANCE_BANDS } from '../vss-rubric.js';

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

// ---- RADAR — the category profile, derived from score.categories --------------------
/* WHAT CHANGED AND WHY. The old chart hardcoded a seven-key axis list and a label map,
   so a rubric of any other shape drew phantom axes at zero and a renamed category lost
   its label. And it reserved a FIXED label gutter whether the labels needed it or not,
   which spent 48% of the SVG box on empty margin — the reason it only ever drew a 202px
   web inside a 948px band.

   Now: axes are the categories it is handed, in the order handed, and the viewBox is
   computed from the labels it actually draws. Same slot, a 229px web with a rating on
   every axis — and the legend retired, because each label carries its own number.

   Geometry is in CENTRED coordinates (origin 0,0); the viewBox moves, not the shapes. */
const RAD_R = 118;          // the web's outer radius — every other length scales to it
/* RAD_CHW is MEASURED, not assumed: 7.27px per glyph for the 10.5px mono axis label at
   .09em tracking, in both the loaded Roboto Mono and the ui-monospace fallback the
   unbranded pages get. Rounded UP, because an estimate that runs short pushes the label
   past the computed frame. RAD_PAD is the breathing room between the longest label and
   the edge of the column — at 3 the type sat exactly on the boundary. */
const RAD_CHW = 7.3;
const RAD_PAD = 6;
const RAD_LINE = 13;        // the label's line box

/* signalCount — rated / total across the whole rubric, and whether NOTHING is rated yet.
   One derivation, because two surfaces ask the same question: the research hero's
   evidence base and the radar's caption. A brand-new assessment has seven categories at
   zero, which is NOT "7 gaps" — it is nothing scored, and saying "gaps" accuses the
   venture of our own not having run yet. */
export function signalCount(score) {
  const cats = (score && score.categories) || [];
  const total = cats.reduce((n, c) => n + (c.subs ? c.subs.length : 0), 0);
  const rated = cats.reduce((n, c) => n + (c.subs ? c.subs.filter(x => x.score != null).length : 0), 0);
  return { rated, total, forming: total > 0 && rated === 0 };
}

function radarAxes(score) {
  const cats = (score && score.categories) || [];
  const n = cats.length || 1;
  return cats.map((c, i) => ({
    key: c.key,
    label: String(c.short || c.label || c.key || '').replace(/^the\s+/i, '').toUpperCase(),
    frac: c.frac || 0,
    pot: (c.pot != null ? c.pot : c.frac) || 0,
    w: c.weightPct || 0,
    num: parseFloat(c.num != null ? c.num : (c.frac || 0) * 5) || 0,
    a: -Math.PI / 2 + i * (2 * Math.PI / n),
  }));
}

export function radar(score, opts = {}) {
  /* `hole` — the inner radius that 0 maps to, drawn as the innermost grid ring so the
     baseline is declared rather than quietly shifted. It exists because at hole 0 a
     venture with nothing rated collapses to a single point and the chart says nothing;
     16 of 118 keeps that case legible while costing 13% of the radial range. Callers
     putting a numeral in the middle pass a hole big enough to clear the type. */
  const { hole = 48, labels = true, weightDots = false } = opts;
  const ax = radarAxes(score);
  if (!ax.length) return '';
  const { forming } = signalCount(score);
  const R = RAD_R, R0 = Math.max(0, hole);
  const rOf = v => R0 + Math.max(0, Math.min(1, v)) * (R - R0);
  const px = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const pt = (a, r) => px(a, r).map(n => n.toFixed(1)).join(',');
  const poly = key => ax.map(x => pt(x.a, rOf(x[key]))).join(' ');
  const GRID = 'var(--md-sys-color-surface-container-highest)', ACC = 'var(--md-sys-color-primary)';

  /* Zero is simply the INNERMOST GRID RING. rOf() is linear from R0, so adding 0 to the
     ring steps gives five evenly spaced rings and the floor needs no special marker —
     it was a dashed circle before, which read as a stray dot in the middle of the web
     rather than as the baseline it is. */
  const web = [0, 0.25, 0.5, 0.75, 1].map(g =>
    `<polygon points="${ax.map(x => pt(x.a, rOf(g))).join(' ')}" fill="none" stroke="${GRID}" stroke-width="1"/>`).join('');
  const spokes = ax.map(x => { const [x1, y1] = px(x.a, R0), [x2, y2] = px(x.a, R);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`; }).join('');
  // headroom: omitted entirely at the ceiling — a dashed line tracing the solid one says nothing
  const anyHeadroom = ax.some(x => x.pot > x.frac + 0.001);
  const pot = anyHeadroom ? `<polygon points="${poly('pot')}" fill="none" stroke="${ACC}" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="4 4"/>` : '';
  const now = `<polygon points="${poly('frac')}" fill="${ACC}" fill-opacity=".26" stroke="${ACC}" stroke-width="2" stroke-linejoin="round"/>`;
  const maxW = Math.max(...ax.map(x => x.w)) || 1;
  const dots = ax.map(x => { const [cx, cy] = px(x.a, rOf(x.frac));
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${weightDots ? (2.6 + 4.4 * (x.w / maxW)).toFixed(1) : '3.6'}" fill="${ACC}"/>`; }).join('');

  /* Labels are NAME over VALUE. Side by side, the horizontal gutter is the name plus the
     number; stacked, it is the longer of the two — which is most of the size this chart
     gained. An unrated signal prints "–", never a 0.0 it was never given. */
  let minX = -R - 4, minY = -R - 4, maxX = R + 4, maxY = R + 4;
  const labHtml = !labels ? '' : ax.map(x => {
    const [lx, ly] = px(x.a, R + 14);
    const anc = Math.cos(x.a) > 0.3 ? 'start' : Math.cos(x.a) < -0.3 ? 'end' : 'middle';
    const y = ly + (Math.sin(x.a) > 0.3 ? 12 : Math.sin(x.a) < -0.3 ? -8 : 0);
    const val = forming ? '–' : x.num.toFixed(1);
    const w = Math.max(x.label.length, val.length) * RAD_CHW;
    const x0 = anc === 'start' ? lx : anc === 'end' ? lx - w : lx - w / 2;
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x0 + w);
    minY = Math.min(minY, y - 10); maxY = Math.max(maxY, y + RAD_LINE + 4);
    return `<text class="rad-l" x="${lx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anc}">${esc(x.label)}<tspan class="rad-v" x="${lx.toFixed(1)}" dy="${RAD_LINE}">${val}</tspan></text>`;
  }).join('');
  const P = RAD_PAD, vb = `${(minX - P).toFixed(0)} ${(minY - P).toFixed(0)} ${(maxX - minX + P * 2).toFixed(0)} ${(maxY - minY + P * 2).toFixed(0)}`;
  /* The entrance animation inflates the data out of the chart centre along each spoke,
     so it has to scale about that centre — and because every coordinate above is
     CENTRED, the centre IS user (0,0) and the pivot is simply `transform-origin: 0 0`
     (set in ds.css). An earlier version computed the centre's offset from the viewBox
     corner and passed it here; measured, that pivoted 240px away and the shape slid in
     diagonally instead of growing. Nothing to compute — see the note in ds.css.

     The dots live INSIDE .rad-data so they ride the same transform and stay welded to
     the vertices; a sibling group with its own scale left them floating off the shape
     for the first 400ms. Their own animation is opacity only, which cannot displace. */
  return `<svg class="rad-svg" viewBox="${vb}" aria-hidden="true"><g class="rad-grid">${web}${spokes}</g><g class="rad-data">${pot}${now}<g class="rad-dots">${dots}</g></g><g class="rad-labels">${labHtml}</g></svg>`;
}

/* radarLockup — MOLECULE. Sibling to scoreLockup / coverageLockup: the category profile
   as a chart rather than a strip. Reads in the order the whole family reads in — eyebrow,
   the number, the graphic that explains it, the caption. Fronts the Investability tab.

   It REPLACES profileLockup, which said the same three things (the numeral, the
   strong/mixed/gap split, now→potential) in a form that could not be read per category —
   and the radar it replaces was sitting 1000px further down in a 948px band that was two
   thirds empty. One chart, one place, at the top where the eye lands.

   Generic: pass any `categories`. Seven is not assumed anywhere. */
export function radarLockup(opts = {}) {
  const {
    label = 'Category profile', score = 0, max = 100, now, potential,
    categories = [], rated, total, hole = 16, weightDots = false,
  } = opts;
  const s = { categories, composite: score, potential };
  const cnt = (rated != null && total != null) ? { rated, total, forming: total > 0 && rated === 0 } : signalCount(s);
  const val = now != null ? now : score;
  const pot = potential != null ? potential : val;
  const delta = pot - val;

  const c = { strong: 0, mixed: 0, gap: 0 };
  categories.forEach(x => { c[sevOf(x.frac || 0)]++; });
  const split = cnt.forming
    // nothing scored is not seven gaps — see signalCount()
    ? `<span class="rl-forming">${cnt.total ? `0 of ${cnt.total} signals rated` : 'Not yet scored'}</span>`
    : [c.strong && `<span><b>${c.strong}</b> strong</span>`,
       c.mixed && `<span><b>${c.mixed}</b> mixed</span>`,
       c.gap && `<span><b>${c.gap}</b> gap${c.gap > 1 ? 's' : ''}</span>`].filter(Boolean).join('');
  const partial = !cnt.forming && cnt.total > 0 && cnt.rated < cnt.total
    ? `<em class="rl-part">${cnt.rated} of ${cnt.total} rated</em>` : '';
  // No headroom → "At ceiling", the same words the contributions table uses on a row
  // that cannot move. "Potential 55" beside a 55 restates the score and says nothing.
  const right = cnt.forming
    ? '<span class="rl-wait">Scored when the run completes</span>'
    : `${partial}<span>${delta > 0
        ? `Potential <b>${esc(String(pot))}</b> <span class="up">+${delta}</span>`
        : 'At ceiling'}</span>`;

  /* The numeral sits ABOVE the chart, not in it — the order every other lockup in this
     family reads in: eyebrow → the number → the graphic that explains it → the caption.
     Two things follow from having it out of the middle. The hole no longer has to clear
     54px of type, so it drops from 48 to 16 and the web gets 104px of radial range
     instead of 70 — more room to tell a 3.0 from a 4.0. And the number is read at the
     lockup's own size rather than at whatever the hole allowed. */
  /* Everything that can be READ stacks at the top — eyebrow, the numeral, then the split
     and the headroom — and the chart closes the lockup. The caption is a second line of
     the headline, not a footnote to the graphic: "80 · 6 strong, 1 mixed · potential 85"
     is the whole story in one block, and the web then shows you where it sits. */
  return `<div class="radar-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num${cnt.forming ? ' is-forming' : ''}">${esc(String(val))}<small>/${esc(String(max))}</small></div>
    <div class="rl-cap"><span class="rl-split">${split}</span><span class="rl-right">${right}</span></div>
    <div class="rl-chart">${radar(s, { hole, weightDots })}</div>
  </div>`;
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
// `active` says which SECTION is lit — an assessment is a CHILD of Portfolio, so it lights the Portfolio
// item. That is NOT the same as "you are already on that page". Suppressing the link whenever the item was
// `active` therefore killed the nav on every child page (assessment, drill, research detail): the item was
// highlighted AND dead, leaving the breadcrumb as the only way back. Go inert ONLY when the item's href is
// the page you are actually on.
const samePage = (href) => {
  if (!href || typeof location === 'undefined') return false;
  const norm = h => String(h || '').split(/[?#]/)[0].replace(/\.html$/, '');
  return norm(href) === norm(location.pathname.split('/').pop());   // clean-URL safe (/workspace/dashboard-m3)
};
/* brandMark — the product identity in the drawer head.

   The wordmarks below are the FALLBACK, for an identity with no lockup artwork
   (VentureStack, whose product is not built and whose assets are deliberately
   not vendored — same position brand-map.css takes on its --brand-logo). All of
   them are RENDERED and CSS shows the one matching [data-brand]: that looks
   redundant and is deliberate, because the preview switcher flips the attribute
   at runtime with no re-render, so a single server-chosen string would freeze on
   whichever brand loaded first. The hidden ones are display:none, which
   assistive tech skips, so nothing is read twice.

   Where real artwork EXISTS it wins, and it is inline SVG rather than the
   background-image PNG this replaced — see brand-lockup.js for why that
   distinction is not cosmetic (a background-image cannot read a token, so the
   mark carried a frozen palette). */
const PRODUCTS = [
  { key: 'ventrify',     lead: 'Ventrify', tail: '',      sub: 'OS' },
  { key: 'verdictscore', lead: 'Verdict',  tail: 'Score', sub: '' },
  { key: 'venturestack', lead: 'Venture',  tail: 'Stack', sub: '' },
];
export function brandMark() {
  const parts = PRODUCTS.map(p => hasLockup(p.key)
    ? brandLockup({ brand: p.key, cls: `bl-for`, label: `${p.lead}${p.tail}` }).replace('<svg ', `<svg data-for="${p.key}" `)
    : `<span class="wm-for" data-for="${p.key}">${esc(p.lead)}${
        p.tail ? `<em>${esc(p.tail)}</em>` : ''}${p.sub ? ` <small>${esc(p.sub)}</small>` : ''}</span>`);
  const arts  = parts.filter(x => x.startsWith('<svg')).join('');
  const words = parts.filter(x => !x.startsWith('<svg')).join('');
  return `${arts}${words ? `<span class="wm">${words}</span>` : ''}`;
}

/* ── inkOn(bg) — pick legible ink for a background we do not control ──────
   Org and operator avatars are filled with a colour the CUSTOMER chooses,
   in setup.html's brand picker. The ink over it was hardcoded `#fff` in two
   places, so a pale brand colour simply erased the initials. MEASURED on
   the live sample data: 2.09:1 for the org mark, 2.51:1 for an operator
   avatar — both well under AA, and no token can fix it because the
   background is user data, not part of the palette.

   THE THRESHOLD IS SOLVED, NOT PICKED, and so is the ink. The crossover is
   where white and the dark ink give the same ratio; below it white wins,
   above it the dark one does. Where the dark ink sits decides whether a
   DEAD BAND exists — a range of backgrounds that NO ink can carry at 4.5:1,
   because the best either can manage at the crossover is the ceiling for
   that colour. Solved for three candidates:

       ink        crossover at bg L    best achievable there
       #10131A         0.1936                4.31:1   dead band
       #0A0A0C         0.1861                4.45:1   dead band
       #000000         0.1791                4.58:1   none

   So the ink is pure black, and not for taste: it is the only value that
   leaves no colour a customer could pick unable to carry its own initials.
   --brand-ink would have looked more correct and quietly failed a band of
   mid-tone brand colours. */
export function inkOn(bg) {
  const m = String(bg || '').trim();
  let r, g, b;
  const hex = m.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  } else {
    const n = (m.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (n.length < 3) return '#fff';          // unparseable (a var(), a gradient) — leave as-is
    [r, g, b] = /^color\(/.test(m) ? n.map(v => v * 255) : n;
  }
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.1791 ? '#000' : '#fff';
}

export function drawer(active = 'portfolio', opts = {}) {
  const badges = opts.badges || {};
  const items = Array.isArray(opts.nav) && opts.nav.length ? opts.nav : NAV;
  let out = '', sec = '';
  items.forEach(n => {
    if (n.section !== sec) { sec = n.section; out += `<div class="drawer-section overline">${sec}</div>`; }
    const isActive = n.key === active;          // which SECTION is lit
    const isHere = samePage(n.href);            // you are literally ON this page
    const badge = badges[n.key] != null ? badges[n.key] : n.badge;
    const go = n.href && !isHere ? ` onclick="location.assign('${n.href}')"` : '';
    out += `<div class="nav-item ${isActive ? 'active' : ''}${isHere ? ' here' : ''}" tabindex="0" role="link"${go}><span class="material-symbols-rounded">${n.icon}</span><span class="nav-label">${n.label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ''}</div>`;
  });
  const b = opts.brand;
  const canSwitch = b && Array.isArray(b.orgs) && b.orgs.length > 1;
  const brandHtml = b
    ? `<div class="drawer-brand${canSwitch ? ' switch' : ''}"${canSwitch ? ' role="button" tabindex="0" onclick="window.__wsOrgSwitch&&window.__wsOrgSwitch(this)"' : ''}>
      <span class="logo"${b.color ? ` style="background:${esc(b.color)}"` : ''}>${b.logo ? `<img src="${esc(b.logo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : `<span style="font-size:13px;font-weight:700;color:${inkOn(b.color)}">${esc(b.initials || 'V')}</span>`}</span>
      <span class="wm"><span class="wm-name">${esc(b.name || 'Ventrify')}</span><small>${esc(b.sub || 'Workspace')}</small></span>${canSwitch ? '<span class="material-symbols-rounded drawer-brand-caret">unfold_more</span>' : ''}
    </div>`
    : `<div class="drawer-brand">${brandMark()}</div>`;
  const ac = opts.account;
  const footHtml = ac
    ? `<div class="drawer-foot account"><span class="av"${ac.color ? ` style="background:${esc(ac.color)}"` : ''}>${esc(ac.initials || '—')}</span><span class="nm">${esc(ac.name || '')}<small>${esc(ac.role || '')}</small></span><button class="drawer-foot-signout" title="Sign out" aria-label="Sign out" onclick="window.__signOut&&window.__signOut()"><span class="material-symbols-rounded">logout</span></button></div>`
    : `<div class="drawer-foot"><span class="av">AC</span><span class="nm">Apex Capital<small>Partner workspace</small></span></div>`;
  /* THE PRODUCT MARK, and why it is at the HEAD, above the tenant.
     It used to sit at the foot, below the account chip, on the reasoning that the
     drawer head belongs to the TENANT and a white-label product should not take
     their position. That reasoning predated the org switcher. Once the tenant row
     became a CONTROL — a button that opens a list of organisations — the foot
     placement stopped working for two reasons: the mark read as a footnote to the
     account chip rather than as the product, and it was dimmed to half opacity to
     keep it quiet, which is not a thing you do to your own logo.

     The order now reads as a sentence: this is VerdictScore (fixed) · you are in
     THIS organisation (switchable) · here is what you can do (nav) · here is who
     you are (account). Product above tenant is the correct hierarchy when the
     tenant row is a control, because the mark is the one thing on the rail that
     never changes. Still omitted when the head is already the product's own mark,
     so it can never print twice. */
  const productHtml = b ? `<div class="drawer-product">${brandMark()}</div>` : '';
  return `<nav class="m3-drawer" id="m3-drawer">
    <button class="nav-toggle" onclick="__navButton&&__navButton()" aria-label="Collapse navigation"><span class="material-symbols-rounded">menu</span></button>
    ${productHtml}
    ${brandHtml}
    ${out}
    ${footHtml}
  </nav>`;
}
// themeToggle REMOVED — the workspace is dark-only (see theme.css). It offered a
// Light button that produced a page measuring 1.00:1 in places, which is worse
// than offering nothing.
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
  // tabs: (string | {label, badge})[] — a tab may carry a small count (the Diligence tab does, when the run
  // recorded gaps it could not close). Backwards-compatible: a plain string is unchanged.
  const tabs = hasTabs ? `<div class="m3-tabs" role="tablist">${opts.tabs.map((t, i) => {
    const o = (t && typeof t === 'object') ? t : { label: t };
    const on = i === (opts.activeTab || 0);
    return `<button class="m3-tab${on ? ' active' : ''}" role="tab" aria-selected="${on}">${esc(o.label)}${o.badge ? `<span class="tab-badge">${esc(o.badge)}</span>` : ''}</button>`;
  }).join('')}</div>` : '';
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

// figureStrip — MOLECULE. The same counts as statCard, de-carded: figures sit ON the page between two
// rules, divided by hairlines, the way every figure strip in the assessment reads. A boxed tile says
// "this is a thing"; a count of engagements is not a thing, it is a measurement of the list below it.
// A zero is dimmed rather than hidden — "0 awaiting a deck" is an answer, and dropping the cell would
// make the strip's width jump between loads.
export const figureStrip = (stats = []) => `<div class="figstrip">${stats.map(s =>
  `<div class="fs-f"><div class="fs-v${String(s.n) === '0' ? ' dim' : ''}">${esc(s.n)}</div><div class="fs-l">${esc(s.l)}</div></div>`).join('')}</div>`;

// GUIDANCE_BANDS, as the runner stamps them (shared/vss-rubric.js). The runner DECIDES the band —
// including gates the composite score alone cannot see — so the UI names it and never recomputes it.
// `min` exists only as a fallback for snapshots written before the band field, and is never preferred.
const BOOK_BANDS = [
  { k: 'READY',             label: 'Investment ready',  tone: 'good', min: 80 },
  { k: 'PROMISING',         label: 'Promising',         tone: 'mid',  min: 60 },
  { k: 'HIGH_RISK',         label: 'High risk',         tone: 'warn', min: 40 },
  { k: 'POTENTIAL_DECLINE', label: 'Potential decline', tone: 'bad',  min: 0  },
];
const bookBandOf = r => (r.band && BOOK_BANDS.find(b => b.k === r.band))
  || BOOK_BANDS.find(b => Number(r.rec && r.rec.score) >= b.min) || BOOK_BANDS[BOOK_BANDS.length - 1];

// portfolioBand — ORGANISM. What opens the portfolio: the headline count at display size, the two or
// three figures an operator acts on, and the book's score distribution across the runner's four
// guidance bands. Replaces four equal-weight boxed counts, which gave the same emphasis to "how many
// exist" and "how many need me" and said nothing about whether the book is any good.
// Scales by STACKING, not by shrinking: one cell per venture inside its band, so 24 ventures draw 24
// cells and the columns simply grow. Nothing is averaged, and an empty band still shows its zero.
export function portfolioBand(rows = []) {
  const inFlight = r => r.runState && ['queued', 'running', 'partial'].includes(r.runState.status);
  const needs = r => (r.status && (r.status.kind === 'err' || r.status.kind === 'warn'))
                  || (r.runState && r.runState.status === 'idle') || r.danger;
  const scored = rows.filter(r => r.rec);
  const nNeed = rows.filter(needs).length;
  // Every engagement is represented, not just the scored ones: a distribution that showed 3 cells
  // for 11 engagements left the operator to wonder where the other 8 went. The unscored get their
  // own final column — they have no band yet, and putting them in one would be inventing a verdict.
  // The four bands are the SCALE, so they always render — an empty "Potential decline" is a reading,
  // and dropping it would silently rescale the chart between loads. "Still forming" is not a band but
  // a state, so it only appears while something is actually unscored.
  const forming = rows.filter(r => !r.rec);
  const cols = [...BOOK_BANDS.map(b => ({ ...b, rows: scored.filter(r => bookBandOf(r).k === b.k) })),
                ...(forming.length ? [{ k: 'FORMING', label: 'Still forming', tone: 'form', rows: forming }] : [])];
  const fig = (n, l, warn) => `<div class="pb-s"><b${warn && n ? ' class="warn"' : ''}>${n}</b><em>${esc(l)}</em></div>`;
  return `<section class="pb">
    <div class="pb-hero">
      <div class="pb-n">${rows.length}<small>Active engagements</small></div>
      <div class="pb-subs">${fig(nNeed, 'need you', true)}${fig(rows.filter(inFlight).length, 'in flight')}${fig(scored.length, 'scored')}</div>
    </div>
    <div class="pb-dist">
      <div class="pb-dh"><span class="l">How the book scores</span><span class="m">all ${rows.length} engagements</span></div>
      <div class="pb-cols" style="--pb-n:${cols.length}" role="img" aria-label="Score distribution across ${rows.length} engagements: ${cols.map(c => `${c.rows.length} ${c.label}`).join(', ')}.">
        ${cols.map(c => `<div class="pb-col">
          <div class="pb-cells t-${c.tone}" aria-hidden="true">${c.rows.map(r => `<i title="${esc(r.name)}${r.rec ? ` · ${esc(r.rec.score)}` : ' · not yet scored'}"></i>`).join('')}</div>
          <div class="pb-cap"><b>${c.rows.length}</b><em>${esc(c.label)}</em></div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

// triageGroups — the portfolio's reading order. A flat list answers "what exists"; an operator opening
// this page is asking "what needs me". Derived from the row data, never a hand-kept list, so a venture
// moves group the moment its state changes. Exported because the live workspace dashboard renders the
// same rows through the same table and must group them the same way.
// Order matters: a row falls into the FIRST group it qualifies for, so a stuck row that is also
// mid-assessment reads as blocked rather than as busy.
export function triageGroups(rows = []) {
  const inFlight = r => r.runState && ['queued', 'running', 'partial'].includes(r.runState.status);
  const needs = r => (r.status && (r.status.kind === 'err' || r.status.kind === 'warn'))
                  || (r.runState && r.runState.status === 'idle') || r.danger;
  const busy  = r => inFlight(r) || (r.status && r.status.label === 'Assessment');
  const taken = new Set();
  const take = pred => rows.filter(r => !taken.has(r) && pred(r)).map(r => (taken.add(r), r));
  return [
    { key: 'needs',   title: 'Needs you',  why: 'blocked, flagged, or waiting on a document', rows: take(needs) },
    { key: 'flight',  title: 'In flight',  why: 'assessment running or queued',               rows: take(busy) },
    { key: 'settled', title: 'Settled',    why: 'on track — nothing to decide today',         rows: take(() => true) },
  ].filter(g => g.rows.length);
}

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
// Tone keys off the LABEL the adapter produced. 'Investment ready' is the only one that reads as good;
// 'High risk' and 'Potential decline' must read as bad, which they would NOT have done while every
// unmapped code fell through to 'Promising'.
/* Band label → tone. MUST agree with the BANDS table above, which is the scoring
   source of truth: READY good · PROMISING mid · HIGH_RISK warn · POTENTIAL_DECLINE bad.
   It did not — 'High risk' mapped to 'bad', collapsing the bottom two bands onto one
   colour and leaving the 'warn' step with nothing pointing at it. Four bands, four
   tones; see the tone ramp in theme.css for why mid is brand and not amber. */
const BAND_TONE = {
  'Investment ready': 'good', 'Promising': 'mid', 'High risk': 'warn', 'Potential decline': 'bad',
  Strong: 'good', Weak: 'warn', Uninvestable: 'bad', Forming: 'mid',
};

// scoreLockup — MOLECULE. The headline-score lockup: eyebrow label · big number/max · a tone-coloured band
// chip · an optional now→potential bar. Generic + defaults; drops into any surface that needs a headline score.
/* The DIAL. A 270° sweep for the score with the headroom ghosted behind it —
   one shape for "where it is" and "where it could get to", where the old bar
   needed two rows and a caption to say the same thing. */
function scoreDial(score, potential, max, tone) {
  const R = 86, C = 2 * Math.PI * R, SWEEP = 0.75;
  const len = v => Math.max(0, Math.min(1, v / max)) * SWEEP * C;
  const da = v => `${len(v).toFixed(2)} ${C.toFixed(2)}`;
  /* --arc is the drawn length of each arc, published so the entrance animation can
     sweep it on from stroke-dashoffset:var(--arc) to 0. The length is already computed
     here for the dasharray; the alternative is JS measuring getTotalLength() at runtime
     on an element the renderer already knows the geometry of. */
  /* ⚠ a zero-length arc is OMITTED, not drawn. stroke-linecap:round turns a 0-length dash into a
     DOT, so a forming assessment — nothing rated, score 0 — was painting a stray pip on the rim
     of an otherwise empty dial, on the Verdict lockup as well as the masthead mark. Nothing is
     not a very small something. */
  return `<svg class="sl-dial-svg" viewBox="0 0 200 200" aria-hidden="true">
    <g transform="rotate(135 100 100)" fill="none" stroke-linecap="round">
      <circle cx="100" cy="100" r="${R}" class="sl-track" stroke-width="13" stroke-dasharray="${da(max)}"/>
      ${potential > score && len(potential) > 0.5 ? `<circle cx="100" cy="100" r="${R}" class="sl-pot" stroke-width="13" stroke-dasharray="${da(potential)}" style="--arc:${len(potential).toFixed(2)}"/>` : ''}
      ${len(score) > 0.5 ? `<circle cx="100" cy="100" r="${R}" class="sl-now" stroke-width="13" stroke-dasharray="${da(score)}" style="--arc:${len(score).toFixed(2)}"/>` : ''}
    </g></svg>`;
}

/* The STABILITY STRIP. Every signal is drawn three times blind and the median
   published; this is the only place that fact is visible. It is a WINDOW on
   the draws, never a second 0–100 rail: three draws inside three points are
   one invisible dot at full scale, and the whole picture zoomed in. The dial
   already carries the 0–100 placement, so the strip does not repeat it.

   With no draws on the snapshot it says so rather than inventing a spread —
   which is what today's runs render, because the runner publishes the median
   and keeps nothing else. */
function stabilityStrip(draws, score) {
  if (!Array.isArray(draws) || draws.length < 2) {
    return `<div class="sl-strip is-empty"><div class="sl-strip-lab"><span>Stability</span></div>
      <p class="sl-none">Draw spread not recorded for this run.</p></div>`;
  }
  const lo = Math.min(...draws), hi = Math.max(...draws), d = hi - lo;
  const win = Math.max(10, d * 1.9);            // never closes below 10pts, so tight reads as tight
  const c = (lo + hi) / 2, a = c - win / 2, b = c + win / 2;
  const pc = v => (((v - a) / (b - a)) * 100).toFixed(1);
  return `<div class="sl-strip">
    <div class="sl-strip-lab"><span>Three blind draws</span>
      <em>${d <= 5 ? `within ${d} pts · solid` : `spread ${d} pts · indicative`}</em></div>
    <div class="sl-rail">
      <span class="sl-span" style="left:${pc(lo)}%;width:${(pc(hi) - pc(lo)).toFixed(1)}%"></span>
      ${draws.filter(v => v !== score).map(v => `<span class="sl-tick" style="left:${pc(v)}%"></span>`).join('')}
      <span class="sl-med" style="left:${pc(score)}%"></span>
    </div>
    <div class="sl-sc"><span>${Math.round(a)}</span>
      <span>${draws.slice().sort((x, y) => x - y).join(' · ')}</span><span>${Math.round(b)}</span></div>
  </div>`;
}

export function scoreLockup(opts = {}) {
  const { label = 'Investability score', score = 72, max = 100, band = 'Strong', tone = 'good',
          bandIcon, now, potential, draws = null } = opts;
  const icon = bandIcon || SCORELK_ICON[tone] || 'trending_flat';
  const val = now != null ? now : score;
  const pot = potential != null ? potential : val;
  const delta = pot - val;
  return `<div class="score-lockup tone-${tone}">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="sl-top">
      <div class="sl-dial">${scoreDial(val, pot, max, tone)}
        <div class="sl-mid"><div class="lockup-num">${esc(String(val))}<small>/${esc(String(max))}</small></div></div>
      </div>
      <div class="sl-aside">
        ${band ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${icon}</span> ${esc(band)}</span>` : ''}
        ${delta > 0 ? `<div class="sl-head">Potential <b>${esc(String(pot))}</b> · headroom <b class="up">+${delta}</b></div>` : ''}
      </div>
    </div>
    ${stabilityStrip(draws, val)}
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

/* profileLockup — RETIRED. It re-expressed the score as a split of tone chips plus a
   weighted severity strip, and fronted the Investability tab. radarLockup() now says the
   same three things (the numeral, the strong/mixed/gap split, now→potential) AND says
   them per category, so keeping both would have left two molecules for one job — the
   exact drift the DS audit exists to catch. The weight each category carries, which the
   strip encoded and the equal-angle web does not, is stated on every row of the
   contributions table below the hero. See radarLockup() at the top of this file. */

/* valuationLockup — MOLECULE. Sibling to scoreLockup expressing a CORRECTIVE premium:
   the ask, the defensible band, and the overshoot between them — on a MEASURED AXIS.

   WHAT THE AXIS IS FOR. The first version of this was an 8px track with a coloured band
   and an unlabelled tick: you could see that the ask was high but not against what, so
   the one number that matters — how far over — had to be read out of the caption. The
   ticks below the bar put a money scale under the whole thing, and the overshoot is
   dimensioned ON the chart rather than described underneath it.

   TICKS ARE DERIVED, never a fixed set: a 1 / 2 / 2.5 / 5 ladder chosen from the range,
   because a $60M seed and a $900M growth round land on this same component.

   DEGRADES, because most assessments are not MoneyGym. adapter.js regex-matches the band
   out of the valuation note and emits null when the note does not phrase it as "$A–$B
   pre", and it emits no `multiple` at all on a real run. So: no multiple → the numeral
   falls back to the ask itself; no band → the bar keeps the ask and says plainly that no
   band has been set, rather than drawing an empty range.

   Money values are in $M, as the adapter's parseMoney() produces them. */
const vMoney = v => v == null ? '—'
  : v >= 1000 ? `$${+(v / 1000).toFixed(2)}B`
  : `$${+Number(v).toFixed(Number(v) % 1 ? 1 : 0)}M`;

/* a 1 / 2 / 2.5 / 5 tick ladder for the range — so the axis reads in round money at any
   scale, instead of five arbitrary fifths of whatever the maximum happens to be. */
function vTicks(max, target = 4) {
  const raw = max / target, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(4));
  return out;
}

export function valuationLockup(opts = {}) {
  const {
    label = 'Valuation verdict', multiple = null, multipleSuffix = '× median',
    band = 'Fairly priced', tone = 'good', bandIcon,
    asked = 0, defensibleLo = null, defensibleHi = null, scaleMax,
    askedLabel = 'Asked', bandLabel = 'Defensible',
  } = opts;
  const icon = bandIcon || VAL_ICON[tone] || 'check_circle';
  const lo = Number(defensibleLo) || 0, hi = Number(defensibleHi) || 0;
  const ask = Number(asked) || 0;
  const hasBand = lo > 0 || hi > 0;        // a real band was parsed — never render "$0–0M"
  const hasAsk = ask > 0;
  const max = scaleMax || (Math.max(ask, hi) * 1.15) || 1;
  const pc = v => Math.max(0, Math.min(100, (v / max) * 100));
  const over = hasBand && hasAsk && ask > hi ? ask - hi : 0;

  /* A tick label is centred on its tick — EXCEPT within a few percent of either end, where
     centring would hang it off the chart. Decided per tick from its actual position rather
     than with :first-of-type / :last-of-type, because the last TICK is not the end of the
     SCALE: the ladder stops at the last round number below max, so on this fixture the final
     tick sits at 86%, and right-aligning it there would just put it in the wrong place. */
  const axis = `<div class="vz-axis">${vTicks(max).map(v => {
    const x = pc(v);
    const tr = x < 4 ? 'none' : x > 96 ? 'translateX(-100%)' : 'translateX(-50%)';
    return `<i style="left:${x}%"></i><span style="left:${x}%;transform:${tr}">${esc(vMoney(v))}</span>`;
  }).join('')}</div>`;

  const chart = (hasAsk || hasBand) ? `
    <div class="vz-lab"><span>${esc(bandLabel)} <b>${hasBand ? `${esc(vMoney(lo))}–${esc(vMoney(hi))}` : '—'}</b></span>
      <span>${esc(askedLabel)} <b>${esc(vMoney(ask))}</b></span></div>
    <div class="v1-track">
      ${hasBand ? `<span class="v1-band" style="left:${pc(lo)}%;width:${(pc(hi) - pc(lo)).toFixed(1)}%"></span>` : ''}
      ${over > 0 ? `<span class="v1-over" style="left:${pc(hi)}%;width:${(pc(ask) - pc(hi)).toFixed(1)}%"></span>` : ''}
      ${hasAsk ? `<span class="v1-ask${over > 0 ? '' : ' ok'}" style="left:calc(${pc(ask)}% - 1.5px)"></span>` : ''}
    </div>
    ${over > 0 ? `<div class="v1-gap">
      <span class="bar" style="left:${pc(hi)}%;width:${(pc(ask) - pc(hi)).toFixed(1)}%"></span>
      <span class="cap" style="left:${((pc(hi) + pc(ask)) / 2).toFixed(1)}%">+${esc(vMoney(over))} over</span>
    </div>` : ''}
    ${axis}` : '';

  // the read, derived — never written, so it cannot drift from the numbers beside it
  const read = !hasAsk ? `<p class="vl-none">No pre-money figure on this round yet.</p>`
    : !hasBand ? `<p class="vl-read">Asked <b>${esc(vMoney(ask))}</b> pre. No defensible band has been established for this round.</p>`
    : over > 0 ? `<p class="vl-read">Asked <b>${esc(vMoney(ask))}</b> pre — <span class="over">${esc(vMoney(over))} above</span> a defensible <b>${esc(vMoney(lo))}–${esc(vMoney(hi))}</b>, or <span class="over">${(ask / hi).toFixed(1)}×</span> the ceiling.</p>`
    : `<p class="vl-read">Asked <b>${esc(vMoney(ask))}</b> pre, inside a defensible <b>${esc(vMoney(lo))}–${esc(vMoney(hi))}</b>.</p>`;

  // no multiple on a real run → the ask carries the numeral rather than leaving it blank
  const numHtml = multiple != null
    ? `<div class="lockup-num">${esc(String(multiple))}<small>${esc(multipleSuffix)}</small></div>`
    : hasAsk ? `<div class="lockup-num">${esc(vMoney(ask).replace(/^\$/, ''))}<small>pre</small></div>` : '';

  return `<div class="valuation-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    ${numHtml}
    ${band ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${icon}</span> ${esc(band)}</span>` : ''}
    ${chart}${read}
  </div>`;
}

// coverageLockup — MOLECULE. Sibling to scoreLockup for an evidence base: a big completeness numeral + a
// confidence tone chip + a demoted provenance figure-row (no bar; a 35-segment bar would be absurd). One
// dominant numeral, not a row of equals. Fronts the Research tab.
export function coverageLockup(opts = {}) {
  const {
    label = 'Evidence base', rated = 35, total = 35, ratedLabel = 'signals rated', numeral,
    confidence = 'High', tone = 'good', confidenceIcon,
    /* The band read "<confidence> confidence" with the noun welded on, which is
       right for the assessment and wrong everywhere else — Team wants "Fully
       covered", not "Fully covered confidence". Defaulted, so every existing
       caller is byte-identical; passed as '' by the callers that state their
       own whole phrase. Generalising the one component beats forking it. */
    bandSuffix = ' confidence',
    facts = [{ v: '18', k: 'documents' }, { v: '32', k: 'sources cited' }, { v: '7', k: 'workstreams' }]
  } = opts;
  const icon = confidenceIcon || COV_ICON[tone] || 'verified';
  // `numeral` overrides the big rated/total figure — e.g. a forming snapshot that has no rated signals yet
  const numHtml = numeral != null ? numeral : `${esc(String(rated))}<small>/${esc(String(total))} ${esc(ratedLabel)}</small>`;
  return `<div class="coverage-lockup">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num">${numHtml}</div>
    ${confidence ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${icon}</span> ${esc(confidence)}${esc(bandSuffix)}</span>` : ''}
    ${facts.length ? `<div class="lockup-prov">${facts.map(f => `<span class="unit"><b>${esc(f.v)}</b> ${esc(f.k)}</span>`).join('')}</div>` : ''}
  </div>`;
}

// bookLockup — MOLECULE. A whole PORTFOLIO read as a verdict: a positive-anchored on-plan numeral + a derived
// verdict band + the health mix as split chips + a weighted strip (one pip per venture up to pipMax, then a
// weighted 3-tone strip so 40 ventures never render 40 hairlines) + a now→potential cap where +delta is exactly
// the ventures needing the operator. It is the last owner of .profile-split / .profile-strip (profileLockup,
// which introduced them, is retired) — so those two rules stay in the stylesheet. Everything derives from
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
// fitHeadline — THE GUARANTEE that a hero headline can never truncate.
//
// .statement-lockup-headline is clamp(30-44px) with `-webkit-line-clamp: 4`, and its own CSS comment states
// the contract: "a short punchy clause (≤ ~12 words) — anything longer belongs in the thesis lead". Every
// hero honoured that with a short AUTHORED line ("A $2B market — the question is the entry") except TEAM,
// which piped the first sentence of the model's team-diligence write-up straight into a 44px slot. Arbitrary
// model prose at 44px overflows four lines and gets silently clipped mid-word.
//
// A word budget in a copy brief is a REQUEST. This is the ENFORCEMENT: overlong copy is rejected here, at
// the render boundary, so no upstream change — or no upstream agent having a bad day — can put a truncated
// headline in front of an operator. It never cuts mid-clause and never emits a dangling ellipsis: it falls
// back to the caller's short authored line instead, because a clean short sentence beats a severed long one.
const HEADLINE_MAX_WORDS = 12;   // the copy contract, enforced
export function fitHeadline(text, fallback = '', maxWords = HEADLINE_MAX_WORDS) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return fallback;
  // strip markdown the model leaks into prose (**bold**, `code`) — it renders as literal junk at 44px
  const clean = t.replace(/[*_`]/g, '').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= maxWords) return clean;
  // Too long. Prefer the caller's authored fallback over a mutilated sentence — but if there is none, cut at
  // the last sentence/clause boundary INSIDE the budget so what we show is still a complete thought.
  if (fallback) return fallback;
  const head = words.slice(0, maxWords).join(' ');
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf(' — '), head.lastIndexOf('; '));
  return (cut > 20 ? head.slice(0, cut + 1) : head).replace(/[,;:—-]\s*$/, '') + (cut > 20 ? '' : '.');
}

export function statementLockup(opts = {}) {
  const {
    // tone — 'brand' | 'good' | 'mid' | 'bad'. The emphasised word in the
    // headline and the conviction pips take their colour from it.
    //
    // The default is 'brand', NOT 'mid'. A hero that carries no verdict has
    // nothing to caution about, and defaulting to amber painted every such
    // headline in the warning colour: the Research hero's "rebuilt from
    // source" — a strength — read as a problem, purely because nobody passed
    // a tone. Only Verdict, Investability and Diligence derive one; Market,
    // Team and Research do not, and should not have to in order to avoid
    // looking alarmed.
    tone = 'brand',
    eyebrow = 'The verdict', eyebrowIcon = 'balance',
    headline = 'A balanced call — proceed to diligence, not to a cheque.',
    headlineEm = 'proceed to diligence',
    facts = [{ k: 'Conviction', v: `Medium ${convPips('Medium')}` }, { k: 'The ask', v: '$8M <small>on $32M pre · Seed</small>' }]
  } = opts;
  // enforced at the render boundary: no caller can put a truncating headline on screen (see fitHeadline)
  const safe = fitHeadline(headline, opts.headlineFallback || '');
  const hl = headlineEm && safe.includes(headlineEm) ? esc(safe).replace(esc(headlineEm), `<em>${esc(headlineEm)}</em>`) : esc(safe);
  const factsHtml = facts.map(f => `<div class="fact"><div class="k">${esc(f.k)}</div><div class="v">${f.v}</div></div>`).join('');
  return `<div class="statement-lockup tone-${esc(tone)}">
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
  /* The thesis sits INSIDE the left column, under the statement.
     The right slot is the tall one — the score lockup is a dial, a chip and
     a stability strip — while the statement above is three lines and a pair
     of facts, so the left column was running half empty and the thesis was
     stranded in full width underneath. In the column it fills that space and
     reads at a sensible measure instead of spanning the whole page.
     `single` heroes used to drop it BELOW the section instead, on the grounds
     that there was no column to sit in. There is: in single mode .left is the
     only column, and it is now capped to a readable measure rather than being
     let run the width of the page. Keeping the thesis outside only bought it
     the section's bottom padding plus .lead's own margin — 82px of gap on the
     owner view of Admin, against 20px in the two-column case. One path now. */
  const thesisHtml = thesis
    ? `<p class="lead"><span class="drop">${esc(thesisLabel)}</span> ${esc(thesis)}</p>` : '';
  return `<section class="sec section-hero${single ? ' single' : ''}">
      <div class="left">${leftHtml}${thesisHtml}</div>
      <div class="divide"></div>
      <div class="right">${rightHtml}</div>
    </section>`;
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
//   lead:    { kind:'none'|'chip'|'numeral'|'glyph'|'tile'|'avatar', ... } — the leading cell (per-variant DOM)
//   title, sub, sub2, cap · bar:{now,pot,tick} (metric/funnel MID) · clause (full-bleed) ·
//   trail:   { kind:'chevron'|'value'|'chip'|'word', value, valueMuted, delta:{text,tone}, ... }
//   density: 'reading'|'compact' (defaulted per variant) · onDrill, key, foot, cls
// ============================================================
const ROW_COMPACT = new Set(['roster', 'figure', 'doc', 'numbered', 'marker', 'check', 'citation', 'spec']);
// leading atoms — pure fns → the leading element. Two tone axes stay separate (verdict vs workstream-type).
// leadDot RETIRED: its only caller was the strength profile, where the dot restated what the bar,
// the number and the footer's strong/mixed/gap split already said — and its ramp didn't even order
// (gap, the worst band, drew as a PALE BRAND tint while mixed drew grey). No row leads with a dot now.
function leadTile(icon, wtype) { return `<span class="rlead" style="background:${RTONE[wtype] || RTONE.p}"><span class="material-symbols-rounded" style="color:${RCOL[wtype] || RCOL.p}">${esc(icon || 'article')}</span></span>`; }
// trailing atoms
// `mark` is an optional STATE GLYPH in the trailing cell — { icon, tone }. It exists because the metric
// row has no lead dot (leadDot is retired) and so had NO visual channel for found/not-found: roomCheck was
// passing `lead:{sev}` that nothing rendered, leaving "Present" and "Not seen" as text of identical weight.
// A reader scanning a list of six cannot see a state change in a word. They can see a tick appear.
function trailValue(value, valueMuted, delta, mark) {
  const glyph = mark && mark.icon
    ? `<span class="material-symbols-rounded mrow-mk${mark.tone ? ' ' + esc(mark.tone) : ''}">${esc(mark.icon)}</span>`
    : '';
  return `<div class="mrow-val">${glyph}<span class="v">${esc(value)}${valueMuted ? `<span class="out">${esc(valueMuted)}</span>` : ''}</span>${delta ? `<span class="s ${delta.tone === 'up' ? 'up' : 'flat'}">${esc(delta.text)}</span>` : ''}</div>`;
}
const rowChev = clickable => clickable ? '<span class="material-symbols-rounded mrow-chev">chevron_right</span>' : '<span class="mrow-chev"></span>';

export function row(opts = {}) {
  const { variant = 'metric', lead = {}, title = '', sub = '', bar, trail = {}, onDrill = '', key = '', foot = false, cls = '', unsettled = 0 } = opts;
  // The title is ESCAPED and stays escaped, so a marker cannot ride along inside it. UNSETTLED means the
  // three blind draws split on signals here and a single vote decided them — see scoreWobble.
  const unsettledMark = unsettled
    ? `<span class="cd-unsettled material-symbols-rounded" title="${esc(String(unsettled))} signal${unsettled === 1 ? '' : 's'} here ${unsettled === 1 ? 'was' : 'were'} decided by a single vote among the three independent reads. More evidence would settle ${unsettled === 1 ? 'it' : 'them'}.">balance</span>`
    : '';
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
  if (trail.kind === 'value' || (variant === 'metric' || variant === 'funnel')) tr = trailValue(trail.value, trail.valueMuted, trail.delta, trail.mark);

  // BODY assembly is per-variant: metric/funnel nest the dot inside .mrow-nm within .mrow-lab.
  if (variant === 'metric' || variant === 'funnel') {
    return `<div class="${cl}"${act}>
    <div class="mrow-lab"><div class="mrow-nm">${esc(title)}${unsettledMark}</div>${sub ? `<div class="mrow-sub">${esc(sub)}</div>` : ''}</div>
    ${mid}${tr}${rowChev(clickable)}
  </div>`;
  }
  // spec: label + a value that SIZES TO ITSELF. The variant was named in the
  // contract above and in ROW_COMPACT from the start, but never given a branch,
  // so anything wanting a plain label/value row had to borrow `metric` — whose
  // value column is a fixed 104px because it holds scores like "64/100".
  // Settings borrowed it and got "mercer-ventures", "Full platform licence" and
  // "Enterprise only" each broken over two lines in a 104px gutter.
  if (variant === 'spec') {
    return `<div class="${cl}"${act}>
    <div class="mrow-lab"><div class="mrow-nm">${esc(title)}</div>${sub ? `<div class="mrow-sub">${esc(sub)}</div>` : ''}</div>
    ${trailValue(trail.value, trail.valueMuted, trail.delta)}${rowChev(clickable)}
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
// opts: { key, label, sub, bar:{now:0..1, pot:0..1, tick},
//         value, valueMuted, sub2:{text, tone:'up'|'flat'}, onDrill, foot }
export function metricRow(opts = {}) {
  const { key, label, sub, bar = {}, value, valueMuted = '', sub2, onDrill = '', foot = false, cls = '', unsettled = 0 } = opts;
  return row({
    variant: (cls && /funnel/.test(cls)) ? 'funnel' : 'metric',
    key, title: label, unsettled, sub, lead: { kind: 'none' }, bar,
    trail: { kind: 'value', value, valueMuted, delta: sub2 },
    onDrill, foot, cls: cls.replace(/\bfunnel\b/, '').trim(),
  });
}

// strength profile — the radar alternative. Ranked now-vs-potential bars (via metricRow), per category.
// onDrill (optional): a handler name → each row opens the per-category aux breakdown.
export function strengthProfile(s, onDrill = '') {
  const cats = [...s.categories].sort((a, b) => b.frac - a.frac);
  const count = { strong: 0, mixed: 0, gap: 0 };
  const rows = cats.map((c, i) => {
    const k = sevOf(c.frac); count[k]++;
    const headroom = c.pot > c.frac + 0.001;
    return metricRow({
      key: c.key, label: c.label,
      sub: `${c.weightPct}% weight${k === 'gap' ? ' · gap' : ''}`,
      bar: { now: c.frac, pot: c.pot, tick: headroom },
      value: parseFloat(c.num).toFixed(1),
      sub2: headroom ? { text: `→ ${(c.pot * 5).toFixed(1)}`, tone: 'up' } : { text: 'at ceiling', tone: 'flat' },
      unsettled: c.unsettled || 0,
      cls: i % 2 === 0 ? 'zebra' : '',
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

// score composition — the per-category contributions table. Contribution = frac × weightPct
// (each category's share of the 100 points); the bar shows points earned, the ghost the
// headroom to potential. onDrill (optional): each row opens the per-category aux breakdown.
//
// The radar USED to sit on top of this table as a centred band. It drew a 202px web in a
// 948px row — two thirds of that row was empty — and it was the second thing on the page to
// say what the hero had already said. It now fronts the hero as radarLockup(), and this is
// the full-width table it was crowding. One chart, one place.
export function investabilityComposition(s, onDrill = '', head = {}) {
  const delta = s.potential - s.composite;
  const maxW = Math.max(...s.categories.map(c => c.weightPct));   // bar scale = the heaviest category's ceiling
  const rows = s.categories
    .map(c => ({ ...c, contrib: c.frac * c.weightPct, potContrib: c.pot * c.weightPct, headroom: c.pot > c.frac + 0.001 }))
    .sort((a, b) => b.contrib - a.contrib)
    .map((c, i) => metricRow({
      key: c.key, label: c.label, cls: i % 2 === 0 ? 'zebra' : '',
      sub: `${c.weightPct}% weight · rated ${parseFloat(c.num).toFixed(1)}/5`,
      bar: { now: c.contrib / maxW, pot: c.potContrib / maxW, tick: false },
      value: `+${c.contrib.toFixed(1)}`,
      sub2: c.headroom ? { text: `+${(c.potContrib - c.contrib).toFixed(1)} avail.`, tone: 'up' } : { text: 'at ceiling', tone: 'flat' },
      unsettled: c.unsettled || 0,
      onDrill
    })).join('');
  const foot = metricRow({ label: 'Investability score', value: `${s.composite}`, valueMuted: ' / 100', foot: true });
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">${esc(head.eyebrow || 'Composition')}</span><span class="t">${esc(head.title || `How the ${s.composite} composes`)}</span><span class="meta">${esc(head.meta || '7 × 5 · weighted 0–100')}</span></div>
    <div class="compose">
      <div class="contrib">
        <div class="contrib-cap">Each category's share of the <b>100</b> points — the bar is points earned, the ghost the headroom left.${delta > 0 ? ` <b>+${delta}</b> of headroom is still available.` : ''} ${onDrill ? 'Click a row to break it down.' : ''}</div>
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
// gapBySlug (optional): a map of DOTTED rubric slug → gap. Where a signal was scored down because the
// research MISSED something, the empty trailing evidence slot becomes the file-evidence trigger instead of
// staying blank. A signal with a real citation keeps its citation — a gap never displaces evidence.
// opts.lift — show each signal's available lift (+1.0 / +0.5) on the row itself. OPT-IN, because
// the Research evidenceIntegrity surface shows the same five rows with no notion of headroom.
export function signalRows(subs = [], gapBySlug = {}, catKey = '', opts = {}) {
  return subs.map(x => {
    const { note, ref } = cdSplitRef(x.note);
    const cls = x.score == null ? 'na' : x.score === 1 ? 'g' : x.score === 0.5 ? 'y' : 'r';
    const g = gapBySlug[`${catKey}.${x.slug}`] || gapBySlug[x.slug];
    const trail = ref ? `<span class="cd-ev" title="${esc(ref)}">${esc(ref)}</span>` : (g ? gapChip(g) : '');
    // The lift rides on the signal that earned it. Brand-coloured, not amber: headroom is an
    // opportunity, and amber/red are reserved for warnings and risks.
    const lift = (opts.lift && x.score != null && x.score < 1)
      ? `<span class="cd-liftv" title="Closing this signal is worth +${(1 - x.score).toFixed(1)} of 5 to the category.">+${(1 - x.score).toFixed(1)}</span>` : '';
    // UNSETTLED: the three blind draws split 2-1 here, so this value is one vote from its opposite. Marked
    // on the signal itself because the verdict's warning says a fifth of the score is unsettled without
    // saying WHICH fifth — and the operator's next question is always which.
    const un = x.unsettled ? `<span class="cd-unsettled material-symbols-rounded" title="The three independent reads split on this signal — it was decided by a single vote. More evidence would settle it.">balance</span>` : '';
    return `<div class="cd-sig ${cls}${x.unsettled ? ' unsettled' : ''}">${cdChip(x.score)}<div class="bd"><div class="q">${esc(SUB_Q[x.slug] || x.slug)}${un}</div><div class="nt${note ? '' : ' muted'}">${note ? esc(note) : 'Not yet scored — assessed when the research run completes.'}</div></div>${trail}${lift}</div>`;
  }).join('');
}
const cdOrd = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
export function categoryDetail(s, key, gapBySlug = {}) {
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
  // ── 3+4 · ONE spine. "The five signals" and "What would lift it" used to be the same list
  // printed twice — same questions, same notes, re-sorted by lift — which doubled the panel's
  // length and said nothing new the second time. The lift now rides on the signal that earned
  // it, and the sentence that closed the old block becomes this one's footnote. One fact, once.
  const open = subs.filter(x => x.score != null && x.score < 1).length;
  const lifted = headroom ? `<span class="sub">+${compLift} available</span>` : '';
  const signals = `<div class="cd-block"><div class="cd-h"><span class="lab">The five signals</span><span class="sub">${spread}</span>${lifted}</div>
    ${signalRows(subs, gapBySlug, key, { lift: headroom })}
    <p class="cd-foot">${forming
      ? `Rate the 5 signals to reveal what would lift the score — up to <b>+${c.weightPct}</b> available.`
      : !headroom
        ? `At its ceiling — contributing its full <b>+${contrib}</b>; no diligence headroom.`
        : `Closing the ${NUMWORD[open] || open} marked ${open === 1 ? 'signal' : 'signals'} carries the category from <b>${now.toFixed(1)}</b> to <b>${pot.toFixed(1)}</b> — <b>+${compLift}</b> on the score.`}</p></div>`;

  // ── 5 · contribution & standing ──
  const rankW = [...s.categories].sort((a, b) => b.weightPct - a.weightPct).findIndex(x => x.key === key) + 1;
  const rankC = [...s.categories].sort((a, b) => b.frac * b.weightPct - a.frac * a.weightPct).findIndex(x => x.key === key) + 1;
  const standing = `<div class="cd-standing"><div class="cd-h"><span class="lab">Contribution &amp; standing</span></div>
      <div class="cd-srow"><span>Weight → contributes</span><b>${c.weightPct}% → +${forming ? '0.0' : contrib} of 100${headroom ? `, +${compLift} avail.` : ''}</b></div>
      <div class="cd-srow"><span>Among the 7 categories</span><b>${cdOrd(rankW)}-heaviest${forming ? '' : ` · ${cdOrd(rankC)} by contribution`}</b></div>
      <div class="cd-srow"><span>Provenance</span><b>${rated} of 5 rated · L2 · Investability rubric</b></div>
    </div>`;

  // The same warning the verdict carries, repeated HERE and scoped to this category — an operator who
  // drilled in to understand a number should not have to go back to the verdict to learn it is unsettled.
  // Placed above the signals, since the rows beneath it carry the individual markers it is explaining.
  const un = c.unsettled
    ? `<div class="cd-wobble"><span class="material-symbols-rounded">balance</span><div><strong>${c.unsettled} of these 5 signals ${c.unsettled === 1 ? 'was' : 'were'} decided by a single vote.</strong> The three independent reads disagreed and a majority of one settled ${c.unsettled === 1 ? 'it' : 'them'} — marked below. The evidence does not support a firm call, so this category could score differently on a re-run. Adding documents that speak to ${c.unsettled === 1 ? 'that signal' : 'those signals'} is what would fix it.</div></div>`
    : '';
  // size travels WITH the content: a rubric question needs a reading measure, so this panel asks
  // for the wide variant itself rather than every call site remembering to request it.
  return { size: 'wide', title: c.label, subtitle: `${CD_SB_WORD[cb]} · ${c.weightPct}% weight · L2 · Investability`, body: `${standfirst}${figures}${un}${signals}${standing}` };
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

/* ── the clearance family: a unit grid, and the lockup that fronts the Diligence tab ─────────── */

// SEVERITY is the ONE place a check's kind becomes a colour, a glyph and a word. The adapter emits
// err/warn/info today; `order` drives sorting and the legend, and an unknown kind falls through to
// the neutral row rather than disappearing — a runner that starts emitting a fourth severity gets
// drawn, uncoloured, instead of silently vanishing from the chart.
// `plural` is spelled out rather than derived: "3 blockers" is right and "3 keys" / "3 standards"
// are not — these labels are adjectives, not nouns, so an -s rule would be wrong twice out of three.
const SEVERITY = {
  err:  { order: 0, label: 'Blocker',  plural: 'blockers', glyph: 'lock',          gates: true },
  warn: { order: 1, label: 'Key',      plural: 'key',      glyph: 'priority_high', gates: false },
  info: { order: 2, label: 'Standard', plural: 'standard', glyph: 'remove',        gates: false },
};
const sevOfKind = k => SEVERITY[k]
  || { order: 9, label: String(k || 'Other'), plural: String(k || 'other').toLowerCase(), glyph: 'remove', gates: false };

// unitGrid — MOLECULE. One cell per discrete thing, tinted by kind, with a state glyph. The unit is
// the item, so nothing is averaged: nine checks draw nine cells, and three draw three. Generic over
// [{kind, done, title}]; past `max` the final cell carries the remainder so a 40-item list stays a
// chart rather than becoming a wall.
//
// a11y: a grid of 9 cells is a CHART, and reading nine cell labels aloud would duplicate the
// checklist that sits directly below it. So the grid carries one role="img" + a summary label, and
// the cells are hidden. `title` still gives a sighted user the item on hover.
export function unitGrid(opts = {}) {
  const { items = [], max = 24, label = '' } = opts;
  if (!items.length) return '';
  const sorted = [...items].sort((a, b) => sevOfKind(a.kind).order - sevOfKind(b.kind).order);
  const over = Math.max(0, sorted.length - max);
  const shown = sorted.slice(0, over ? max - 1 : max);
  const cell = it => {
    const s = sevOfKind(it.kind);
    // ⚠ this used to be a native `title`, which waits a second, cannot wrap and shows the note not
    // at all. The shared tip carries the severity + the check's own title as the heading and its
    // full note as the body — the whole reason a cell is only a glyph is that the detail lives here.
    const tip = {
      title: `${s.label}${it.done ? ' · cleared' : ''} — ${it.title || 'Check'}`,
      body: it.note || 'No further detail recorded for this check.',
      kind: it.done ? '' : (SEVERITY[it.kind] ? it.kind : ''),
    };
    return `<i class="${esc(SEVERITY[it.kind] ? it.kind : 'info')}${it.done ? ' done' : ''}"${tipAttrs(tip)} aria-hidden="true">${
      icon(it.done ? 'check' : s.glyph)}</i>`;
  };
  return `<div class="ugrid" role="img" aria-label="${esc(label || `${items.length} items`)}">
    ${shown.map(cell).join('')}
    ${over ? `<i class="more" aria-hidden="true">+${over}</i>` : ''}
  </div>`;
}

// clearanceLockup — MOLECULE. Fronts the Diligence tab: how many checks still BLOCK a wire, the gate
// chip, the unit grid of every check, and a derived legend.
//
// ⚠ THE NUMERAL IS BLOCKERS, NOT CHECKS. It used to read "0 / 9 cleared", which says all nine must
// clear before money moves — and diligenceEditorial's own `gateOpen` has never believed that: the
// gate is a function of BLOCKERS alone. The hero was contradicting the rule it sits on top of.
// (Worth knowing while reading this: nothing in the OS currently writes `done` — the adapter
// hardcodes false — so the cleared state below is built and correct but cannot yet be reached.)
export function clearanceLockup(opts = {}) {
  const { label = 'Pre-wire clearance', labelTone = 'accent', items = [], maxCells = 24 } = opts;
  const gating = items.filter(d => sevOfKind(d.kind).gates);
  const openGating = gating.filter(d => !d.done).length;
  const gateOpen = !items.length || !gating.length || openGating === 0;
  const total = items.length, done = items.filter(d => d.done).length;

  const numeral = !total
    ? `<div class="lockup-num">0<small>to clear</small></div>`
    : gating.length
      ? `<div class="lockup-num">${openGating}<small>/${gating.length} blocking</small></div>`
      : `<div class="lockup-num">${total - done}<small>to work</small></div>`;
  const band = `<span class="lockup-band ${gateOpen ? 'good' : 'bad'}">${icon(gateOpen ? 'lock_open' : 'lock')} ${
    !total ? 'Nothing to clear' : gateOpen ? 'Cleared to wire' : 'Do not wire'}</span>`;

  // the legend derives from what is PRESENT — a clean assessment with only standard checks shows
  // one entry, not three with two zeroes in them.
  const present = [...new Set(items.map(d => d.kind))].sort((a, b) => sevOfKind(a).order - sevOfKind(b).order);
  const legend = present.map(k => {
    const g = items.filter(d => d.kind === k), nd = g.filter(d => d.done).length;
    return `<span class="ug-k ${esc(SEVERITY[k] ? k : 'info')}"><s aria-hidden="true"></s>${
      esc(sevOfKind(k).label.toUpperCase())} ${nd ? `${nd}/${g.length}` : g.length}</span>`;
  }).join('');

  const summary = !total ? 'No open diligence'
    : `${total} check${total === 1 ? '' : 's'}: ${present.map(k => {
        const n = items.filter(d => d.kind === k).length, s = sevOfKind(k);
        return `${n} ${n === 1 ? s.label.toLowerCase() : s.plural}`;
      }).join(', ')}${done ? ` — ${done} cleared` : ' — none cleared'}`;

  // ⚠ the remaining work is the OPEN non-gating checks, not every non-gating check. Counting the
  // total made "everything cleared" still report "6 non-gating checks still to work".
  const openRest = items.filter(d => !sevOfKind(d.kind).gates && !d.done).length;
  const pl = (n, one, many) => n === 1 ? one : many;
  const checks = n => `${n} check${n === 1 ? '' : 's'}`;
  const read = !total
    ? `<p class="ug-read"><b>No open diligence.</b> Nothing stands between this and a wire.</p>`
    : !gating.length
      ? (openRest
        ? `<p class="ug-read">No blockers — the gate is <b class="ok">open</b>. <b>${checks(openRest)}</b> to work through in diligence.</p>`
        : `<p class="ug-read">No blockers, and <b class="ok">every check is cleared</b>.</p>`)
      : openGating === 0
        ? (openRest
          ? `<p class="ug-read">All <b>${gating.length}</b> ${pl(gating.length, 'blocker', 'blockers')} cleared — the gate is <b class="ok">open</b>, with <b>${openRest}</b> non-gating ${pl(openRest, 'check', 'checks')} still to work.</p>`
          : `<p class="ug-read"><b class="ok">Every check cleared</b> — the gate is open and nothing is outstanding.</p>`)
        : `<p class="ug-read"><b class="bad">${openGating} of ${gating.length} ${pl(gating.length, 'blocker', 'blockers')}</b> ${pl(openGating, 'still stands', 'still stand')} between this and a wire${openRest ? `. <b>${openRest}</b> further ${pl(openRest, 'check does', 'checks do')} not gate it` : ''}.</p>`;

  return `<div class="clearance-lockup">
    <span class="eyebrow ${labelTone}">${esc(label)}</span>
    ${numeral}${band}
    ${unitGrid({ items, max: maxCells, label: summary })}
    ${legend ? `<div class="ug-leg">${legend}</div>` : ''}
    ${read}
  </div>`;
}

// pre-wire diligence — the whole Diligence tab: a Section hero (diligence statement + the pre-wire
// CLEARANCE unit grid) atop the severity-grouped checklist. Mirrors verdictMemo's structure —
// the hero carries the gate (status chip + the grid), the checklist carries the detail. All derived.
export function diligenceEditorial(a) {
  const items = a.diligence || [];
  const of = k => items.filter(d => d.kind === k);
  const nBlock = of('err').length;
  const total = items.length;
  const rowCls = k => k === 'err' ? ' err' : k === 'warn' ? ' warn' : '';
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
      tone: gateOpen ? 'good' : 'mid',
      headline, headlineEm,
      // ⚠ a "Gate: Locked" fact used to sit here, one inch from a "Do not wire" chip that says the
      // same thing — the clearance lockup owns the gate now. What is left is only additive: the
      // numeral counts BLOCKERS, so the total is worth stating, and only when it differs.
      facts: [total > nBlock ? { k: 'To clear in all', v: `${total} check${total !== 1 ? 's' : ''}` } : null].filter(Boolean)
    }),
    right: clearanceLockup({ label: 'Pre-wire clearance', items }),
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

  return `<div class="brief">${hero}${openEvidence(a)}${checklist}</div>`;
}

// ============================================================
// THE EVIDENCE GAP — what we LOOKED FOR and COULD NOT FIND.
//
// A gap is a check the assessment RAN and could not CLOSE: it searched, it failed to find, and THE VENTURE
// WAS DOCKED FOR OUR MISS. That is a defect in OUR research, not in the venture — so it does not belong in
// the venture's story (Verdict/Market/Team). It belongs where "what must still be checked before money moves"
// already lives: DILIGENCE. The difference, said out loud in the section's own words, is that WE are the ones
// who failed.
//
// ⚠ THE NUMBER THAT IS NOT HERE, AND MUST NEVER BE: a projected score GAIN.
//
// The runner publishes `impact.cappedAt` (a CEILING — "while this gap is open this signal cannot exceed ½")
// and `impact.observedScore` (what the scorer ACTUALLY gave it). It deliberately publishes NO delta, and
// publish.js says why: the moment this panel renders "close this gap: +3 investability", we have rebuilt the
// dial IN THE PRESENTATION LAYER even though the pipeline is clean — because the operator would then file
// only the artefacts he predicts move the number UP. He must remain unable to predict which way the evidence
// falls, and DOWN must stay visibly live. So we render the miss and the ceiling. Never a projected gain.
// (An earlier UI sketch specified "−N pts docked" on every row. It is not built, on purpose.)
// ============================================================
const GAP_KIND = {
  registry: { icon: 'domain', label: 'Company register' },
  gazette: { icon: 'gavel', label: 'Insolvency & disqualification notices' },
  'regulator-register': { icon: 'verified_user', label: 'Regulator register' },
  'product-existence': { icon: 'apps', label: 'Product existence' },
  'press-corroboration': { icon: 'newspaper', label: 'Press corroboration' },
  'own-materials': { icon: 'badge', label: 'The founder’s own materials' },
  'claim-substantiation': { icon: 'fact_check', label: 'Claim substantiation' },
  'contract-corroboration': { icon: 'handshake', label: 'Contract corroboration' },
  'metric-substantiation': { icon: 'query_stats', label: 'Metric substantiation' },
};
const gapKind = k => GAP_KIND[k] || { icon: 'search_off', label: 'Verification check' };
// closesWith — the CLOSED artefact set the runner may name (assessment-contract.js GAP_CLOSES_WITH). Rendered
// as "any one of these would close it", in the memo's own voice.
const GAP_CLOSES = {
  'profile-page': 'A profile page — LinkedIn, a university or company bio',
  'registry-record': 'A company-register record — Companies House, or the local equivalent',
  'regulator-record': 'The entry on the regulator’s own register',
  'press-article': 'An independent press or industry article',
  'study-or-report': 'The study or report the figure actually comes from',
  contract: 'The contract itself',
  'customer-reference': 'A named customer reference',
  'employment-record': 'An employment record — a contract, an offer letter, a payslip',
  filing: 'A filing — accounts, a statutory return, a patent',
  'dataroom-doc': 'A data-room document we missed or misread',
};
const GAP_OUTCOME = { 'NOT-FOUND': 'Not found', UNVERIFIED: 'Unverified', PARTIAL: 'Partial' };
const gapWord = o => GAP_OUTCOME[o] || 'Not found';

// gapState — THE ONE derivation of "where is this gap up to". Everything that renders gap state reads it.
//
// It exists because the state was being derived AD HOC in six places, and five of them only ever looked at
// `g.outcome` — the ORIGINAL research result, which never changes. So a gap the operator had already filed
// evidence against still displayed "Not found", on the row, on the chip, in the tab count. That is not a
// cosmetic bug: the operator does the work, and the product tells him nothing happened. It is the one lie this
// feature cannot afford, because the whole promise is "point us at it and we will look again".
//
// The lifecycle, in the order it actually happens:
//   open         nothing filed                            → the original outcome ("Not found" / "Unverified")
//   unreachable  filed, but the site blocked our fetcher  → still needs him: re-file, or upload the page
//   filed        filed, not yet fetched
//   captured     fetched and read, re-score not yet in
//   resolved     re-scored, and the gap's own signal ROSE
//   contradicted re-scored, and it FELL — the source did not support the claim. The mechanism WORKING.
//   unchanged    re-scored, read, and the signal held. Honest: we looked, it changed nothing.
//
// `needsAction` is what the counts and the tab badge key off — a filed gap is no longer asking anything of him.
export function gapState(g) {
  const f = g && g.filing;
  if (!f) return { key: 'open', label: gapWord(g && g.outcome), kind: 'warn', icon: 'search_off', needsAction: true };

  if (f.status === 'fetch-failed')
    return { key: 'unreachable', label: 'Could not retrieve', kind: 'err', icon: 'link_off', needsAction: true };

  if (!f.rescoredIn)
    return f.status === 'captured'
      ? { key: 'captured', label: 'Re-scoring', kind: 'info', icon: 'hourglass_top', needsAction: false }
      : { key: 'filed', label: 'Evidence filed', kind: 'info', icon: 'schedule', needsAction: false };

  // SETTLED. Two questions, and BOTH matter — reading only the first is what made the pill lie.
  //
  //   1. did THIS gap's own signal move?  → the precise answer, and the one the gap is about.
  //   2. did the SCORE move?              → the answer the operator can SEE.
  //
  // These come apart, because a re-score is COLD: it re-derives all 35 signals from the whole evidence base.
  // So a filed record can leave the gap's own signal exactly where it was and still move the composite through
  // other signals — the score goes 75 → 76 while the gap's signal holds. Reporting only (1) meant the pill
  // said "No change" to an operator watching the number change in front of him. Both get reported now.
  //
  // ATTRIBUTION, HONESTLY. publish.js stamps the SNAPSHOT-level composite move onto every record in the batch
  // and records how many were in it — because which of three records moved a signal is not knowable from the
  // outside. So the number is only shown when this record rode the re-score ALONE. With several, the move is
  // real but unattributable, and we say "Re-scored" rather than invent a share of it.
  // The same holds when the INSTRUMENT changed under the re-score (publish.js `instrumentChanged` — a new
  // scoring model or rubric since the previous snapshot): the delta is the evidence AND the upgrade, inseparably.
  const mine = new Set(g.signals || []);
  const moved = (f.signalDelta || []).filter(d => d && mine.has(d.slug));
  const net = moved.reduce((n, d) => n + ((Number(d.to) || 0) - (Number(d.from) || 0)), 0);

  const d = Math.round((Number(f.compositeDelta) || 0) * 10) / 10;
  const solo = (Number(f.batchRecords) || 1) === 1 && !f.instrumentChanged;
  const pts = `${d > 0 ? '+' : '−'}${Math.abs(d)}`;              // en-dash for a fall, never a hyphen
  const withPts = (w) => (solo && d ? `${w} · ${pts}` : w);

  if (net > 0) return { key: 'resolved', label: withPts('Resolved'), kind: 'ok', icon: 'check_circle', needsAction: false };
  if (net < 0) return { key: 'contradicted', label: withPts('Scored down'), kind: 'warn', icon: 'trending_down', needsAction: false };

  // The gap's own signal held — but the score may still have moved, and he can see that it did.
  if (d > 0) return { key: 'moved-up', label: solo ? `Score ${pts}` : 'Re-scored', kind: 'ok', icon: 'trending_up', needsAction: false };
  if (d < 0) return { key: 'moved-down', label: solo ? `Score ${pts}` : 'Re-scored', kind: 'warn', icon: 'trending_down', needsAction: false };

  return { key: 'unchanged', label: 'No change', kind: 'info', icon: 'remove', needsAction: false };
}

// Does this gap still ask something of the operator? Open, or filed-but-unreachable. Counts and the tab badge
// key off THIS, never off the raw list length — a gap he has already answered must stop nagging him.
export const gapNeedsAction = g => gapState(g).needsAction;
// the 35 rubric slugs arrive DOTTED from the runner (`team.founder_market_fit`); SUB_Q is keyed on the BARE
// slug. One resolver, so no caller has to know that.
export const subQuestion = slug => SUB_Q[String(slug || '').split('.').pop()] || String(slug || '');
const SCORE_WORD = { 0: '0', 0.5: '½', 1: '1' };
const scoreWord = n => (n == null ? '—' : (SCORE_WORD[n] != null ? SCORE_WORD[n] : String(n)));

// gapChip — ATOM. The ONE "this was not found — you can point us at it" affordance, wherever a gap is READ.
// Its verb is "File evidence", never "Fix" / "Override" / "Correct": the operator supplies a POINTER TO
// EVIDENCE, not a claim about evidence.
// Takes the GAP, not a bare label — so it can never fall out of step with gapState(). The hover verb changes
// with the state too: "File evidence" is wrong once he already has.
export const gapChip = (g) => {
  const id = typeof g === 'string' ? g : (g && g.id);
  const st = typeof g === 'string' ? { key: 'open', label: 'Not found', icon: 'search_off' } : gapState(g);
  const verb = st.needsAction ? 'File evidence' : 'Open';
  return `<button class="gap-chip gc-${esc(st.key)}" onclick="window.openGap&&window.openGap('${esc(id)}')" aria-label="${esc(st.label)} — ${esc(verb.toLowerCase())}">
    <span class="material-symbols-rounded">${esc(st.icon)}</span><span class="gc-l">${esc(st.label)}</span><span class="gap-file">${esc(verb)}</span></button>`;
};

// gapRow — the Diligence list row. A row() 'research' variant, so the row family stays unified (no new
// row species). The cap line carries WHAT IT COST — as a CEILING, never as a projected gain.
export const gapRow = g => {
  const k = gapKind(g.checkKind);
  const st = gapState(g);
  const cap = [
    g.signalQuestion ? g.categoryLabel : '',
    // "capped at ½ while open" is only TRUE while it IS open. Once he has filed, the cap is no longer the
    // story — what the evidence did to the signal is.
    (st.needsAction && g.cappedAt != null) ? `capped at ${scoreWord(g.cappedAt)} of 1 while open` : '',
    g.observedScore != null ? `scored ${scoreWord(g.observedScore)}` : '',
    `${g.searched.length} search${g.searched.length === 1 ? '' : 'es'}`,
    (!st.needsAction && g.filing && g.filing.filedBy) ? `filed by ${g.filing.filedBy}` : '',
  ].filter(Boolean).join(' · ');
  return row({
    variant: 'research', key: g.id, onDrill: 'window.openGap',
    lead: { icon: k.icon, wtype: 'w' },
    title: g.subject,
    sub: g.sought || (g.signalQuestion || ''),
    cap,
    trail: { chip: { kind: st.kind, label: st.label, icon: st.icon } },
  });
};

// openEvidence — ORGANISM. The lead section of the Diligence tab. SELF-OMITTING: a venture we found
// everything on renders nothing at all (same contract as teamGaps / marketSizing), so this can never
// read as a permanent seventh chapter about us.
export function openEvidence(a = {}) {
  const gaps = (a.gaps || []).filter(Boolean);
  if (!gaps.length) return '';
  const open  = gaps.filter(gapNeedsAction).length;   // still asking something of him
  const filed = gaps.filter(g => g.filing).length;
  const searches = gaps.reduce((n, g) => n + g.searched.length, 0);
  // "open" = still asking something of him. A gap he has already filed against is NOT open, and counting it as
  // such was the same lie as the stale pill: it nags him for work he has already done.
  const meta = [
    open ? `${open} open` : 'all answered',
    `${searches} searches run`,
    filed && `${filed} filed`,
  ].filter(Boolean).join(' · ');
  return `<hr class="rule"><section class="sec">
    <div class="sec-head">
      <span class="eyebrow warn">Unverified</span>
      <span class="t">What we looked for and could not find</span>
      <span class="meta">${esc(meta)}</span>
    </div>
    <p class="lead"><span class="drop">Our miss.</span> Each of these was <b>searched for and not found</b>, and the signal
      was scored down for the absence. That is a defect in our research, not necessarily in the venture. If you can point
      us at the evidence, the assessment fetches it, reads it cold, and scores the signal again — <b>up or down</b>.</p>
    <div class="profile">${gaps.map(gapRow).join('')}</div>
  </section>`;
}

// gapHonesty — MOLECULE. The honest moment, and it is its own component precisely so it CANNOT be edited out
// of one surface and left in another. It says the two things the operator must know before he files:
// he is not asserting anything, and THE SCORE CAN GO DOWN.
export function gapHonesty() {
  return `<div class="gap-honest">
    <div class="gh-t"><span class="material-symbols-rounded">balance</span>This is not a correction — it is a re-check.</div>
    <p>You are not telling us the answer. You are telling us <b>where to look</b>. The assessment fetches what you filed,
       reads it cold, and scores this signal again from what the source actually says.</p>
    <p class="gh-warn"><b>The score can go down.</b> If the source contradicts the claim, this signal falls and the score
       falls with it. If it supports the claim, it rises. You cannot know which before you file, and you do not get to choose.</p>
    <p class="gh-fine">Only the <b>document</b> reaches the assessment. Your note, the file’s name and the link text do not —
       they are recorded on the ledger, under your name.</p>
  </div>`;
}

// gapReceipt — what the SYSTEM did with the pointer. Three states, and the failure state is the important
// one: LinkedIn 999s a datacenter fetcher, so "we could not retrieve that — upload it instead" is a
// first-class outcome, not an error. (The runner writes status/httpStatus/fetchError; we only report them.)
export function gapReceipt(f = {}) {
  const when = [f.filedBy, f.filedAt].filter(Boolean).join(' · ');
  if (f.status === 'fetch-failed') {
    return `<div class="gap-receipt bad">
      <div class="gr-t"><span class="material-symbols-rounded">link_off</span>We could not retrieve that page</div>
      <p>${f.httpStatus ? `The site answered <b>HTTP ${esc(f.httpStatus)}</b>` : 'The fetch failed'}${f.fetchError ? ` — ${esc(f.fetchError)}` : ''}.
         Many registers and profile sites block an automated fetcher, and <b>we can only score bytes we actually hold</b>.</p>
      <p class="gr-fix"><b>Save the page as a PDF and upload it</b> — the assessment reads that instead, and it needs no network at all.</p>
      ${when ? `<div class="gr-by">Filed by ${esc(when)}</div>` : ''}
    </div>`;
  }
  if (f.status === 'captured') {
    const size = f.bytes ? `${Math.max(1, Math.round(f.bytes / 1024))} KB` : '';
    const from = f.finalUrl ? hostOf(f.finalUrl) : (f.url ? hostOf(f.url) : 'your upload');
    return `<div class="gap-receipt ok">
      <div class="gr-t"><span class="material-symbols-rounded">task_alt</span>Retrieved and held as evidence</div>
      <p>${size ? `<b>${esc(size)}</b> ` : ''}captured from <b>${esc(from)}</b>${f.contentSha ? ` · <code>sha256 ${esc(String(f.contentSha).slice(0, 12))}…</code>` : ''}.
         The assessment reads this document as part of its evidence base.</p>
      ${f.rescoredIn ? '' : '<p class="gr-fix">It has <b>not been scored yet</b> — run the re-score to put it in front of the assessment.</p>'}
      ${when ? `<div class="gr-by">Filed by ${esc(when)}</div>` : ''}
    </div>`;
  }
  return `<div class="gap-receipt">
    <div class="gr-t"><span class="material-symbols-rounded">schedule</span>Filed — waiting on the re-score</div>
    <p>We hold your pointer${f.url ? ` to <b>${esc(hostOf(f.url))}</b>` : ''}. The assessment retrieves the record at the start of the
       next run, reads it cold, and scores the signal again.</p>
    ${when ? `<div class="gr-by">Filed by ${esc(when)}</div>` : ''}
  </div>`;
}
const hostOf = u => { try { return new URL(String(u)).host; } catch (e) { return String(u || '').slice(0, 40); } };

// gapPanel — the AUX PANEL body for filing evidence against ONE gap. Returns {title,subtitle,body,footer}
// for window.openAux({mode:'push'}) — the same contract as categoryDetail/sourcesPanel.
//
// It has to PROVE WE GENUINELY TRIED, or nobody trusts it — otherwise the feature reads as "the AI was lazy,
// fix it for it". So "Where we looked" is not decoration: it is the run's own searched[], verbatim, and the
// runner DROPS any gap that has none.
export function gapPanel(g, filing = null) {
  if (!g) return { title: 'Gap', subtitle: '', body: '', footer: '' };
  const k = gapKind(g.checkKind);

  // ── 1 · what we were checking, and what the miss cost (a CEILING — never a projected gain) ──
  const cost = g.signals.map(s => `<div class="cd-srow"><span>${esc(subQuestion(s))}</span><b>${g.observedScore != null ? `scored ${scoreWord(g.observedScore)} of 1` : 'not yet scored'}</b></div>`).join('');
  const ceiling = g.cappedAt != null
    ? `<p class="gs-cap">While this stays open the signal <b>cannot go above ${scoreWord(g.cappedAt)} of 1</b> — that is a ceiling on what the evidence can earn, not a promise of what closing it would pay.</p>`
    : '';
  const gst = gapState(g);
  const stand = `<div class="cd-stand"><span class="cd-band ${gst.needsAction ? 'red' : (gst.key === 'resolved' ? 'green' : 'amber')}">${esc(gst.label)}</span>
    <p>We ran a <b>${esc(k.label.toLowerCase())}</b> check on <b>${esc(g.subject)}</b>${g.sought ? ` — looking for ${esc(g.sought)}` : ''}, and could not find it.
       The signal below was scored on that absence.</p>${ceiling}</div>
    <div class="cd-standing">${cost}</div>`;

  // ── 2 · WHERE WE LOOKED — the run's own attempts, verbatim. THE TRUST BLOCK. ──
  const looked = `<section class="gap-sec"><div class="cd-h"><span class="lab">Where we looked</span><span class="sub">${g.searched.length} search${g.searched.length === 1 ? '' : 'es'}, all recorded</span></div>
    ${g.searched.map(s => `<div class="gap-try">
      <span class="src-ic"><span class="material-symbols-rounded">travel_explore</span></span>
      <div class="src-bd"><div class="src-nm">${esc(s.source)}</div>${s.url ? `<div class="src-note">${esc(s.url)}</div>` : ''}</div>
      ${s.result ? `<span class="gt-res">${esc(s.result)}</span>` : ''}
    </div>`).join('')}</section>`;

  // ── 3 · WHAT WOULD CLOSE IT — the run's own closure set, in the memo's .must voice ──
  const closes = (g.closesWith || []).map(c => GAP_CLOSES[c]).filter(Boolean);
  const close = closes.length ? `<section class="gap-sec"><div class="cd-h"><span class="lab">What would close it</span><span class="sub">Any one of these</span></div>
    ${closes.map((w, i) => `<div class="must"><span class="idx">${i + 1}</span><p>${esc(w)}</p></div>`).join('')}</section>` : '';

  // ── 4 · the control: a POINTER (url) or the ARTEFACT (upload). BOTH, ALWAYS — the upload is not a
  //        fallback for the fastidious, it is the ONLY path that works when a site blocks our fetcher.
  //
  // ⚠ A FETCH-FAILED RECORD STILL GETS THE FORM. This was a dead end on the first cut: the receipt tells the
  // operator "the site blocked us — save the page as a PDF and upload it", and then, because a filing
  // existed, the form vanished and there was nowhere to upload it. The one state where the control matters
  // most was the one state that hid it. A failed fetch is not a filing; it is an invitation to re-file.
  const failed = !!filing && filing.status === 'fetch-failed';
  const settled = !!filing && !failed;
  const control = settled ? `<section class="gap-sec">${gapReceipt(filing)}</section>` : `<section class="gap-sec">
    ${failed ? `${gapReceipt(filing)}<div class="gap-refile">Try again — upload the page, or point us somewhere we can reach.</div>` : ''}
    <div class="cd-h"><span class="lab">File the evidence</span><span class="sub">Point us at it</span></div>
    <label class="field">
      <span class="field-lab">Links to the source</span>
      <div id="gap-urls">${gapUrlRow()}</div>
      <button type="button" class="gap-add-url" onclick="window.__gapAddUrl&&window.__gapAddUrl()"><span class="material-symbols-rounded">add</span>Add another link</button>
      <span class="field-hint">Pages we can fetch. We read what is there — not what you say about it. Each link is fetched and scored on its own.</span>
    </label>
    <div class="gap-or"><span>or</span></div>
    ${docDropzone(((typeof window !== 'undefined' && window.__gapFiles) || []), {
      icon: 'upload_file', prompt: 'Upload the document',
      sub: 'PDF, screenshot, filing, contract, dataset. The assessment reads the file itself. Use this when a site blocks our fetcher.',
      single: true, status: 'stored', clearLabel: 'Remove',
      onPick: 'window.__gapPick()', onClear: 'window.__gapClearFile()',
    })}
    ${formField({ label: 'Your note', optional: true, id: 'gap-note', multiline: true, rows: 3,
                  placeholder: 'For your team — why you filed this.',
                  hint: 'Recorded on the ledger and the memo, under your name. The assessment never reads it.' })}
    ${gapHonesty()}
  </section>`;

  const sub = [k.label, gapState(g).label.toLowerCase(), g.categoryLabel].filter(Boolean).join(' · ');
  return {
    title: g.subject,
    subtitle: sub,
    body: `${stand}${looked}${close}${control}`,
    footer: settled
      ? `<button class="m3-btn text" onclick="window.closeAux&&window.closeAux()">Close</button>
         ${filing.rescoredIn ? '' : `<button class="m3-btn filled" style="flex:1" onclick="window.__gapRescore()"><span class="material-symbols-rounded">travel_explore</span>Re-score on the evidence</button>`}`
      : `<button class="m3-btn text" onclick="window.closeAux&&window.closeAux()">Cancel</button>
         <button class="m3-btn filled" style="flex:1" id="gap-file-btn" disabled onclick="window.__gapFile('${esc(g.id)}')"><span class="material-symbols-rounded">upload_file</span>File evidence</button>`,
  };
}

// gapArmCTA — the filing CTA is DEAD until there is an actual POINTER. A note alone files nothing: prose is
// not evidence and the button must never imply it is. It lives in the DS (not in the page) because it was
// duplicated across the live page and the demo, and the demo's copy had already silently drifted to a no-op.
export function gapArmCTA(hasFile = false) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('gap-file-btn');
  if (!btn) return;
  btn.disabled = !(gapUrls().length || hasFile);
}

// Every pointer the operator has typed. ONE source of truth for the whole form — the CTA arms from it and the
// filing reads from it, so the button can never be enabled by a link the filing then fails to send.
export function gapUrls() {
  if (typeof document === 'undefined') return [];
  const box = document.getElementById('gap-urls');
  if (!box) return [];
  return [...box.querySelectorAll('input')].map(i => String(i.value || '').trim()).filter(Boolean);
}

// The add/remove DOM work lives HERE, not in the page — for exactly the reason gapArmCTA does. These handlers
// are needed by the live page AND the demo, and the last thing duplicated across both silently drifted to a
// no-op in one of them. The pages own the WIRING (window.__gapAddUrl = …); the DS owns the BEHAVIOUR.
export function gapAddUrl() {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('gap-urls');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', gapUrlRow());
  const inputs = box.querySelectorAll('input');
  const last = inputs[inputs.length - 1];
  if (last) last.focus();
}

export function gapRemoveUrl(btn) {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('gap-urls');
  const row = btn && btn.closest && btn.closest('[data-url-row]');
  // never remove the last row — the operator would be left with no way to type a link at all
  if (row && box && box.querySelectorAll('[data-url-row]').length > 1) row.remove();
}

// roomCheck — ORGANISM. What the LINKED DATA ROOM appears to be missing, BEFORE a two-hour run is spent.
//
// It reports the SAME six founder artefact classes the scorer counts for `financial.files_complete` — not a
// parallel checklist, because a second list would eventually disagree with the score and the score is the
// product. The operator sees it seconds after pasting the link, which is the whole point: a gap is worth far
// more before the run than after it.
//
// IT SAYS "WE COULD NOT SEE IT", NEVER "YOU ARE MISSING IT". A class can legitimately be satisfied inside
// another document, so a keyword read can produce a false absence — and sending an operator to chase a cap
// table the founder already supplied is worse than staying quiet. The wording carries that uncertainty, and
// the panel offers to run anyway in the same breath.
export function roomCheck(check = {}, opts = {}) {
  const classes = check.classes || [], extras = check.strengtheners || [];
  // Keys that flipped to found on THIS paint. The room read lands all at once after the deck is parsed, so
  // without a transient highlight the change from "Not seen" to "Present" happens off-screen in a list the
  // reader is not looking at yet — which is exactly what the first real user reported.
  const fresh = new Set(opts.justFound || []);
  const unseen = classes.filter(c => !c.found);
  const head = unseen.length
    ? `${unseen.length} of ${classes.length} document types could not be found in the room`
    : `All ${classes.length} document types the score looks for are present`;

  // COMPACT density: this renders inside the ~390px setup panel, not the full-width assessment page, and the
  // reading ramp wraps the trailing state onto two lines there.
  const lines = classes.map(c => row({
    variant: 'metric', key: c.key, density: 'compact',
    // `lead` is NOT passed: the metric row has no lead dot (leadDot is retired), so the sev it used to carry
    // rendered nothing at all and found/not-found were two words of identical weight. The state lives in the
    // trailing mark now, which is the one column the eye is already scanning down.
    cls: ['rcl', c.found ? 'is-found' : 'is-gap', fresh.has(c.key) ? 'just-found' : ''].filter(Boolean).join(' '),
    title: c.label,
    sub: c.found ? `Seen in ${c.seenIn || 'the room'}` : c.want,
    trail: { kind: 'value', value: c.found ? 'Present' : 'Not seen',
             mark: { icon: c.found ? 'check_circle' : 'radio_button_unchecked', tone: c.found ? 'good' : 'idle' } },
  })).join('');

  const strengthen = extras.length ? `<div class="rc-extra">
      <div class="rc-extra-h"><span class="material-symbols-rounded">auto_awesome</span>Would strengthen the assessment</div>
      ${extras.map(e => `<div class="rc-extra-i"><b>${esc(e.label)}</b><span>${esc(e.why)}</span></div>`).join('')}
    </div>` : '';

  return `<section class="sec rc">
    <div class="sec-head"><span class="eyebrow accent">Data room</span><span class="t">${esc(head)}</span><span class="meta">${check.docCount || 0} documents read</span></div>
    <div class="profile">${lines}</div>
    ${strengthen}
    ${(unseen.length || extras.length) ? `<div class="rc-act">
      <button class="m3-btn tonal" type="button" onclick="window.__naRequestDocs&&window.__naRequestDocs()"><span class="material-symbols-rounded">outgoing_mail</span>Request these from the founder</button>
      <span class="rc-act-x">or run the assessment on the room as it stands</span>
    </div>` : ''}
    <div class="profile-foot"><span>Read from the linked folder by filename and content. A document can satisfy more than one of these, and something we could not see may still be in there — the assessment reads everything either way.</span></div>
  </section>`;
}

// ROOM_CLASSES — the six founder artefact classes the score counts, for the IDLE state of the data-room
// panel, before anything has been uploaded and there is nothing to check yet.
//
// These labels are a SECOND copy of api/_roomcheck.js's CLASSES, which that file's header warns against:
// "a checklist invented here would eventually disagree with the score, and the score is the thing being
// sold." The objection is to DRIFT, not to a copy — and the browser cannot require a CommonJS api/ module.
// So the copy is made safe by a gate instead of forbidden by a comment: tools/room-parity.mjs fails if the
// keys, labels or wants here stop matching the server's. Change one, change both, or the build stops.
export const ROOM_CLASSES = [
  { key: 'financial_model',  label: 'Financial model',                      want: 'A projection over three or more periods with at least one revenue line and one cost line' },
  { key: 'unit_economics',   label: 'Unit economics',                       want: 'At least two of: price or ARPU, CAC, churn or retention, LTV or payback' },
  { key: 'cost_basis',       label: 'Cost basis',                           want: 'At least one cost line with where it comes from — a named vendor, a quoted rate, or a stated assumption' },
  { key: 'ownership',        label: 'Ownership / cap table',                want: 'Any statement of who owns what — a cap table, equity split, share register, SAFE or option schedule' },
  { key: 'corporate_legal',  label: 'Corporate / legal',                    want: 'Any one of: incorporation document, company number, articles, board minutes, shareholder or IP agreement' },
  { key: 'observed_metrics', label: 'Observed metrics or primary research', want: 'At least one MEASURED number — not a forecast: pilot, waitlist, funnel, cohort, LOI, or primary interviews' },
];

// roomPreview — ORGANISM. The data-room panel BEFORE a room has been read.
//
// WHY IT IS NOT roomCheck WITH EVERYTHING ABSENT. Running the real component over an empty room would print
// "6 of 6 document types could not be found", which is both true and useless: nobody has been asked for
// anything yet. The spec's rule is that we never grade a founder on evidence we have not requested, and an
// empty state is exactly where that rule is easiest to break. So this says what the score LOOKS FOR, in a
// neutral voice, and it is genuinely useful on its own — it tells someone what to go and gather.
//
// It is also the reason the right-hand column of the create screen is never blank. The panel earns its place
// before a single byte is uploaded, which is the whole argument for putting the data room at the centre.
export function roomPreview(opts = {}) {
  const { docCount = 0, deck = false } = opts;
  const staged = docCount || deck;
  // No `lead` — leadDot is retired, and no trailing word either: six identical "Looks for" chips would be
  // noise. The empty trail cell keeps the column, so nothing shifts when the real check replaces this.
  // Deliberately the same row shape, mark and columns as roomCheck's. When the read lands, the list does
  // not redraw into a different component — each line's hollow circle becomes a tick in place, which is the
  // only way a state change is legible to someone who was looking somewhere else a second ago.
  const lines = ROOM_CLASSES.map(c => row({
    variant: 'metric', key: c.key, density: 'compact', cls: 'rcl is-idle',
    title: c.label, sub: c.want,
    trail: { kind: 'value', value: staged ? 'Not read yet' : '',
             mark: { icon: 'radio_button_unchecked', tone: 'idle' } },
  })).join('');
  const head = staged
    ? `${docCount} document${docCount === 1 ? '' : 's'} staged${deck ? ' · pitch deck attached' : ''}`
    : 'Nothing attached yet';
  return `<section class="sec rc rp">
    <div class="sec-head"><span class="eyebrow accent">Data room</span><span class="t">What the score looks for</span><span class="meta">${esc(head)}</span></div>
    <div class="profile">${lines}</div>
    <div class="profile-foot"><span>${staged
      ? 'Link or upload the room and we read it in seconds — you will see which of these we can and cannot find before you spend a run.'
      : 'Attach a pitch deck to begin. Link or upload a data room and we read it in seconds, then tell you which of these we can and cannot find — before you spend a run.'}</span></div>
  </section>`;
}

// scoreMovement — ORGANISM. After a re-score: WHICH SIGNALS MOVED, AND WHICH WAY.
//
// It renders a FALL exactly as plainly as a rise — a fall is the mechanism WORKING (the source did not support
// the claim), and hiding it would turn the feature back into a dial. A re-score that moved nothing is also a
// result, and is stated as one.
//
// The deltas are NOT recomputed here: publish.js already settled them onto the evidence ledger
// (signalDelta / compositeDelta, which may be negative). We report the ledger; we do not re-derive it.
// HONEST LIMIT, carried through from publish.js: with several records in one re-score we do NOT claim
// per-record attribution — the scorer reads the whole evidence base and forms ONE judgement.
export function scoreMovement(filings = []) {
  const settled = (filings || []).filter(f => f && f.rescoredIn && Array.isArray(f.signalDelta));
  if (!settled.length) return '';
  const latest = settled.reduce((a, b) => ((b.rescoredAt || '') > (a.rescoredAt || '') ? b : a), settled[0]);
  const batch = settled.filter(f => f.rescoredIn === latest.rescoredIn);
  const d = Number(latest.compositeDelta || 0);
  const moved = latest.signalDelta || [];
  // A re-score taken with a DIFFERENT instrument (new scoring model or rubric) than the score before it cannot
  // credit its move to the evidence — the upgrade moved it too. Report the move; do not attribute it.
  const upgraded = !!latest.instrumentChanged;
  const pts = n => `${n} point${n === 1 ? '' : 's'}`;
  // WHICH half of the instrument changed — the ledger records it (publish.js instrumentChange). A rubric edit
  // is not a model upgrade, and calling every change "a new model" would be a confident guess about our own tool.
  const ic = latest.instrumentChange || {};
  const what = ic.model && ic.rubric ? 'an upgraded scoring model and revised scoring criteria'
    : ic.rubric && !ic.model ? 'revised scoring criteria'
    : ic.model ? 'an upgraded scoring model'
    : 'a changed scoring model or criteria';

  const verdict = upgraded
    ? (d ? `The score moved <b>${d > 0 ? 'up' : 'down'}</b> by ${pts(Math.abs(d))} on this re-score — but it was also the first scored with ${what}, so the move cannot be credited to your evidence alone.`
         : `The score <b>held</b> on this re-score, which was also the first taken with ${what}.`)
    : d > 0
    ? `The evidence you filed <b>raised</b> the score by ${pts(d)}.`
    : d < 0
      ? `The evidence you filed <b>lowered</b> the score by ${pts(Math.abs(d))}. The source did not support the claim — that is the mechanism working, not failing.`
      : `The score <b>held</b>. The evidence was read and it changed nothing.`;
  const drop = d > 0 ? 'Up.' : d < 0 ? 'Down.' : 'Held.';

  const rows = moved.length
    ? moved.map(m => row({
        variant: 'metric', key: m.slug,
        lead: { sev: (m.to > m.from) ? 'strong' : (m.to < m.from) ? 'gap' : 'mixed' },
        title: subQuestion(m.slug),
        sub: String(m.slug).split('.')[0],
        trail: { kind: 'value', value: `${scoreWord(m.from)} → ${scoreWord(m.to)}`,
                 delta: { text: m.to > m.from ? 'raised' : m.to < m.from ? 'lowered' : 'held', tone: m.to > m.from ? 'up' : 'flat' } },
      })).join('')
    : `<div class="mrow metric foot"><div class="mrow-lab"><div class="mrow-nm">No signal moved</div>
        <div class="mrow-sub">The record was read and did not address what the signal tests.</div></div><span class="mrow-chev"></span></div>`;

  const meta = `${batch.length} record${batch.length === 1 ? '' : 's'} · ${moved.length} signal${moved.length === 1 ? '' : 's'} moved`;
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The re-score</span><span class="t">What your evidence moved</span><span class="meta">${esc(meta)}</span></div>
    <p class="lead"><span class="drop">${drop}</span> ${verdict}</p>
    <div class="profile">${rows}</div>
    <div class="profile-foot"><span>Scored cold against the filed document${batch.length > 1 ? 's' : ''}. Your note was not read by the assessment.${batch.length > 1 ? ' With several records in one re-score, we do not claim which one moved which signal.' : ''}${upgraded ? ` The signal moves shown include the effect of ${what}.` : ''}</span></div>
  </section>`;
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


/* scoreBreakdown — SECTION. What the headline score is actually made of.
   A full-width section BELOW the verdict hero, not a panel inside it: the
   hero's right column is ~408px, which starved the category labels (104px
   against the 170 they need) and pushed the verdict headline to four lines.
   Full width it has room, and the two-column hero every tab shares is left
   exactly as it is.

   Three things make it worth showing:

   · It RECONCILES. The per-category x/5 figures do not — at 80 they happen
     to sum to exactly 80.0 and look right, at 55 they sum to 52.9 against a
     headline of 55. What reconciles is each category's CONTRIBUTION,
     weightPct × frac, because that is how the composite is computed. The
     `/20` then answers what the pips cannot: a 4/5 in Team is worth more
     than a 4/5 in Evidence because Team carries 25 points and Evidence 5.

   · It is HONEST about rounding. The headline is that sum rounded, so
     MoneyGym's parts total 54.5 against a displayed 55. The total says so
     rather than fudging the parts until they fit.

   · The pips are the REAL sub-signals, not a bar redrawn as dots — five
     signals, five pips, each 0 / 0.5 / 1 exactly as scored. A category with
     a different number of signals renders that number, so this does not
     assume the 7×5 rubric and works for any assessment.

   Related: investabilityComposition() on the Investability tab shows the
   same decomposition in depth — radar, headroom per category, drill-through.
   This is the glanceable version that sits with the verdict; that is the one
   you open to work in. */
export function scoreBreakdown(s, head = {}) {
  const cats = (s && s.categories) || [];
  if (!cats.length) return '';
  const n1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const rows = cats.map(c => {
    const contrib = (c.weightPct || 0) * (c.frac || 0);
    const subs = Array.isArray(c.subs) && c.subs.length
      ? c.subs.map(x => x.score)
      : Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, (c.frac || 0) * 5 - i)));
    /* Every pip is the accent. A category scoring 3.0/5 is not a warning —
       it is a lower score, and the two empty pips already say so. Colouring
       the weak rows amber put a caution colour on an ordinary number and
       made one row shout among six that were only slightly higher. */
    const pips = subs.map(v =>
      `<i>${v > 0 ? `<span class="p-on" style="width:${(Math.min(1, v) * 100).toFixed(0)}%"></span>` : ''}</i>`
    ).join('');
    return `<div class="bd-r">
      <span class="bd-lb">${esc(c.label || c.key || '')}</span>
      <span class="bd-pips">${pips}</span>
      <span class="bd-w">${esc(String(c.weightPct ?? ''))}% weight</span>
      <span class="bd-v">${n1(contrib)}<u> / ${esc(String(c.weightPct ?? ''))}</u></span>
    </div>`;
  }).join('');
  const total = cats.reduce((t, c) => t + (c.weightPct || 0) * (c.frac || 0), 0);
  const t1 = Math.round(total * 10) / 10;
  const rounded = Math.round(t1);
  return `<section class="sec score-breakdown">
    <div class="sec-head">
      <span class="eyebrow accent">${esc(head.eyebrow || 'Composition')}</span>
      <span class="t">${esc(head.title || `What makes the ${s.composite}`)}</span>
      <span class="meta">${esc(head.meta || 'points of 100')}</span>
    </div>
    <div class="bd-t">${rows}</div>
    <div class="bd-sum">
      <span class="bd-k">Total${rounded !== t1 ? ` <em>— rounds to ${rounded}</em>` : ''}</span>
      <span></span><span></span>
      <span class="bd-tv">${n1(t1)}<u> / 100</u></span>
    </div>
  </section>`;
}

// the whole Verdict-tab memo, composed (sectionHero → case → conditions → sign-off).
// The hero is the reusable sectionHero organism, fed the MoneyGym verdict + score.
export function verdictMemo(a, s) {
  return `<div class="brief">
    ${s.wobbleNote ? `<div class="verdict-wobble"><span class="material-symbols-rounded">balance</span><div><strong>Treat this number as indicative.</strong> ${esc(s.wobbleNote)}</div></div>` : ''}
    ${sectionHero({
      eyebrow: 'The verdict', eyebrowIcon: 'balance',
      tone: BAND_TONE[s.band] || 'mid',
      headline: a.verdictLine || a.recommendation, headlineEm: a.verdictEm,
      facts: [
        { k: 'Conviction', v: `${esc(a.conviction)} ${convPips(a.conviction)}` },
        { k: 'The ask', v: `${esc(a.askAmount)} <small>${esc(a.askRest)}</small>` }
      ],
      score: { label: 'Investability score', score: s.composite, max: 100, band: s.band, tone: BAND_TONE[s.band] || 'mid', now: s.composite, potential: s.potential, draws: s.draws || null },
      thesis: a.thesis
    })}
    <hr class="rule">
    ${scoreBreakdown(s)}
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

// Investability tab hero — statement + radarLockup (the score as the SHAPE of its seven categories).
export function investabilityHero(s, a = {}) {
  const h = (a.heroes && a.heroes.investability) || {};
  return sectionHero({
    // Same band, same tone as the Verdict tab. Without this the two heroes of
    // one assessment disagreed: the verdict read green and the score that
    // produced it read amber, one tab apart.
    tone: BAND_TONE[s.band] || 'mid',
    eyebrow: h.eyebrow, eyebrowIcon: h.eyebrowIcon, headline: h.headline, headlineEm: h.headlineEm, facts: h.facts,
    // The radar lives HERE now, not in a band 1000px down the page. See radarLockup().
    right: radarLockup({ label: 'Category profile', score: s.composite, max: 100, now: s.composite, potential: s.potential, categories: s.categories }),
    thesis: h.thesis
  });
}

// ============================================================
// THE PRE-SCREEN RANGE — a score the product deliberately refuses to collapse to one number.
//
// Everything here exists to keep one promise from design/prescreen-spec.md §3: this must never read as a
// verdict. A pre-screen reads a deck and whatever room exists; publishing "41" from that would be mostly a
// measurement of what we did not read, delivered with the authority of what we did.
//
// So the two ends are rendered as what they are — what is provable now, and what this becomes if the data
// room holds up — and the DISTANCE between them is labelled as the thing the founder can actually change.
// ============================================================

// Short band names, derived rather than retyped, so they stay the keys BAND_TONE already uses.
const bandShort = code => (GUIDANCE_BANDS[code] || {}).short || 'Forming';
const bandTone = code => BAND_TONE[bandShort(code)] || 'mid';

// rangeLockup — MOLECULE. Sibling of scoreLockup: same eyebrow, same big-number type, same band chip, so a
// range and a score read as two states of one thing rather than two different products.
//
// NO DIAL. A dial is a single value with a position on an arc; drawing a range on one would either pick an
// end (a lie) or sweep a region (unreadable at this size). A track with the range lit is the honest shape,
// and it is also the shape that makes the WIDTH the most visible fact on the page — which it should be.
export function rangeLockup(opts = {}) {
  const { label = 'Evidence readiness', floor = 0, ceiling = 0, max = 100 } = opts;
  const lo = Math.max(0, Math.min(max, floor)), hi = Math.max(lo, Math.min(max, ceiling));
  const band = rangeBandOf(lo, hi);
  const tone = band.band ? bandTone(band.band) : bandTone(band.spans[1]);
  const left = (lo / max) * 100, width = ((hi - lo) / max) * 100;
  // A zero-width range is not a range. "67–67" reads as a rendering fault, not as "the room answered
  // everything" — so a settled read prints the single number and rangeHero says why the spread is gone.
  const num = lo === hi
    ? `${esc(String(lo))}<small>/${esc(String(max))}</small>`
    : `${esc(String(lo))}<span class="rl-dash">–</span>${esc(String(hi))}<small>/${esc(String(max))}</small>`;
  return `<div class="score-lockup range-lockup tone-${tone}">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num rl-num">${num}</div>
    <div class="rl-track" role="img" aria-label="Range ${lo} to ${hi} out of ${max}">
      <div class="rl-span tone-${tone}" style="left:${left.toFixed(1)}%;width:${Math.max(1.5, width).toFixed(1)}%"></div>
      ${[40, 60, 80].map(t => `<span class="rl-tick" style="left:${t}%"></span>`).join('')}
    </div>
    <div class="rl-band">${band.band
      // The whole range sits inside one band, so naming it is the true statement.
      ? `<span class="lockup-band ${tone}"><span class="material-symbols-rounded">${SCORELK_ICON[tone] || 'trending_flat'}</span> ${esc(bandShort(band.band))}</span>`
      // §3.1 — it straddles a boundary, so we do NOT publish a band. Both outcomes are stated, upside
      // first because the upside is the part they can act on, and the floor immediately after so the
      // ordering is emphasis and not concealment.
      : `<span class="rl-span-txt"><b>${esc(bandShort(band.spans[1]))}</b> if the room holds up · <b>${esc(bandShort(band.spans[0]))}</b> if the gaps stay open</span>`
    }</div>
  </div>`;
}

// The band arithmetic, mirroring api/_prescreen.js rangeBand(). Thresholds are the runner's 80/60/40.
function bandCodeOf(score) {
  if (score >= 80) return 'READY';
  if (score >= 60) return 'PROMISING';
  if (score >= 40) return 'HIGH_RISK';
  return 'POTENTIAL_DECLINE';
}
export function rangeBandOf(floor, ceiling) {
  const lo = bandCodeOf(floor), hi = bandCodeOf(ceiling);
  return lo === hi ? { band: lo, spans: null } : { band: null, spans: [lo, hi] };
}

// rangeCoverage — ORGANISM. WHY the range is as wide as it is, per category.
//
// This is the data room's story told in score points, which is the only currency the reader cares about.
// A category we could not evidence is NOT scored low here — it is shown as unread, with the points it is
// holding. "We cannot see it" and "it is weak" are different claims and must never share a row.
export function rangeCoverage(categories = []) {
  const rows = categories.map(c => {
    const unread = c.of - c.evidenced;
    const held = Math.round(c.weight * ((c.ceilingPct - c.floorPct) / 100) * 100);
    return row({
      variant: 'metric', key: c.key, density: 'compact',
      title: c.label,
      sub: unread
        ? `${unread} of ${c.of} signals need evidence we could not find`
        : `All ${c.of} signals evidenced`,
      bar: { now: c.floorPct / 100, pot: c.ceilingPct / 100, tick: true },
      trail: { kind: 'value', value: unread ? `±${held}` : 'settled', valueMuted: unread ? ' pts' : '' },
    });
  }).join('');
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">Where the width comes from</span><span class="t">What we could and could not read</span>
      <span class="meta">the lighter bar is what each category becomes if the room holds up</span></div>
    <div class="profile">${rows}</div>
    <div class="profile-foot"><span>A category shown as unread is not a category scored badly — it is one we were not given the evidence to score. Closing it moves the floor, not the ceiling.</span></div>
  </section>`;
}

// rangeHero — the Range tab's opening statement. Built on the SAME sectionHero as the Verdict and
// Investability tabs, so a pre-screened assessment and a scored one are visibly the same product.
export function rangeHero(range = {}, opts = {}) {
  const { floor = 0, ceiling = 0, evidencedWeight = 0, categories = [] } = range;
  const seen = categories.filter(c => c.evidenced === c.of).length;
  const width = ceiling - floor;
  return sectionHero({
    eyebrow: 'Pre-screen', eyebrowIcon: 'bolt',
    headline: width === 0
      ? 'Your data room answered everything the score asks for.'
      : `This range is ${width} points wide because of what we cannot see yet.`,
    facts: [
      { k: 'Categories fully evidenced', v: `${seen} of ${categories.length}` },
      { k: 'Of the weighted score', v: `${evidencedWeight}% evidenced` },
      ...(opts.docCount != null ? [{ k: 'Documents read', v: String(opts.docCount) }] : []),
    ],
    right: rangeLockup({ floor, ceiling }),
    thesisLabel: 'What this is.',
    // The high end used to be described as "what you would expect" of the unseen documents, which was a
    // flat par assumption and made every venture top out near the same number. It now rests on the
    // venture's OWN evidenced quality, so the sentence has to say that — a reader cannot judge a
    // ceiling whose basis is hidden.
    thesis: width === 0
      ? 'Every signal the rubric asks for had evidence behind it, so there is no spread left to close. A full assessment replaces this with a single measured number and the reasoning behind it.'
      : 'The low end is what your evidence proves today. The high end assumes the documents we could not find are about as strong as the ones we could — your own evidence sets that expectation, so a thin room cannot borrow a high ceiling. The full assessment closes the gap to one number.',
  });
}

// rangeStale — SAY SO WHEN THE ROOM HAS MOVED ON WITHOUT THE SCORE.
//
// The range is composed once, at the end of a run, and never recomposed — one scored pre-screen per
// venture is the rule the free tier is built on. That is deliberate. What was NOT deliberate is that
// nothing on screen admitted it: the first real customer scored a deck, uploaded 48 documents, watched
// the coverage ticks climb, came back to this tab and found the same number. The product looked broken
// when it was in fact working exactly as designed and failing to say so.
//
// Compares what the room held when the score was taken against what it holds now. `roomDocs` is only on
// snapshots taken after 2026-10-30; `docCount` (what was read) is the fallback, which understates the
// old room and so can only ever under-report staleness — never invent it.
export function rangeStale(snapshot = {}, liveDocs = 0) {
  const then = snapshot.roomDocs != null ? snapshot.roomDocs : snapshot.docCount;
  if (then == null || !(liveDocs > then)) return '';
  const added = liveDocs - then;
  return `<section class="sec rstale">
    <div class="rstale-in">
      <span class="material-symbols-rounded">history</span>
      <div class="rstale-b">
        <div class="rstale-h">This range was scored on ${then} document${then === 1 ? '' : 's'}. Your room now holds ${liveDocs}.</div>
        <p class="rstale-p">The ${added} you added since ${added === 1 ? 'has' : 'have'} updated what we can <b>see</b> — the coverage below reflects them — but the score itself is composed once and not recomputed. Re-scoring on the new evidence is the full assessment.</p>
        <button class="m3-btn tonal" type="button" onclick="window.__eaUnlock&&window.__eaUnlock()"><span class="material-symbols-rounded">bolt</span>Score it on everything</button>
      </div>
    </div>
  </section>`;
}

// rangeFindings — THE 35 THINGS THE RUN ACTUALLY FOUND.
//
// The pre-screen writes a specific, sourced observation for every one of the 35 signals, and stores all
// of them on the snapshot (composeRange puts `signals` on each category). The Range tab was rendering a
// number, seven coverage bars and nothing else — about a tenth of what the run produced and the customer
// paid for. The operator's words: "I don't think I would be enticed to upgrade based on just seeing this."
// They were right, and the fix costs nothing: it is a read of data already on the page.
//
// TWO SECTIONS, because the signals answer two different questions:
//   · what we could NOT see — ranked by what it is worth, because that is an action list. Each note
//     already names the document that would close it; the model writes that unprompted.
//   · what the evidence DOES prove — the substance behind the floor, so the number reads as earned
//     rather than asserted.
//
// POINTS AT STAKE is real arithmetic, not a motivator: an unevidenced signal scores 0 at the floor and
// PAR (3 of 5) at the ceiling, so it holds weight × 3/25 × 100 points of the 100-point scale. A Team
// signal is worth 3.0; an Evidence Integrity signal 0.6. That ordering is the honest answer to "what
// should I go and find first".
export function rangeFindings(categories = [], opts = {}) {
  const cats = (categories || []).filter(c => (c.signals || []).length);
  if (!cats.length) return '';
  // LEGACY SNAPSHOTS ARE ON THE OLD 0–5 SCALE. Pre-screens taken before the scale was unified with the
  // rubric (2026-10-31) stored scores up to 5; rendering those as "½ of 1" would be wrong in a way the
  // reader could not detect. Any score above 1 proves the old instrument, and nothing else can.
  const legacy = cats.some(c => (c.signals || []).some(sg => Number(sg.score) > 1));
  const MAX = legacy ? 5 : 1, PAR = legacy ? 3 : 0.5;
  // Price each gap against what the CEILING actually assumes for it, not against a constant: the
  // snapshot publishes `assumed`, and on a strong room that is well above par — so closing a gap is
  // worth more there than the old flat figure claimed.
  const assumed = (!legacy && typeof opts.assumed === 'number') ? opts.assumed : PAR;
  const ptsOf = c => (c.weight * assumed / ((c.signals.length || 5) * MAX)) * 100;
  const showScore = v => legacy ? String(v) : scoreWord(v);

  // ---- what is missing, hardest-hitting first ----
  const gaps = [];
  for (const c of cats) for (const sg of c.signals) if (!sg.evidenced) gaps.push({ c, sg, pts: ptsOf(c) });
  gaps.sort((a, b) => b.pts - a.pts);
  const gapRows = gaps.map(({ c, sg, pts }) => row({
    variant: 'metric', key: sg.slug, density: 'compact', cls: 'rcl is-gap',
    title: subQuestion(sg.slug),
    sub: sg.note || `${c.label} — no evidence for this was found.`,
    trail: { kind: 'value', value: `+${pts.toFixed(1)}`, valueMuted: ' pts',
             mark: { icon: 'radio_button_unchecked', tone: 'idle' } },
  })).join('');

  // ---- what the evidence proves, grouped by category so it reads as a report ----
  const provenBlocks = cats.map(c => {
    const seen = (c.signals || []).filter(sg => sg.evidenced);
    if (!seen.length) return '';
    const rows = seen.map(sg => row({
      variant: 'metric', key: sg.slug, density: 'compact', cls: 'rcl is-found',
      title: subQuestion(sg.slug),
      sub: sg.note || '',
      // `split` means the three blind draws disagreed and one vote decided it — the same honesty marker
      // the full run uses. Shown, not smoothed over.
      unsettled: sg.split ? 1 : 0,
      trail: { kind: 'value', value: showScore(sg.score), valueMuted: ` of ${MAX}`,
               mark: { icon: 'check_circle', tone: 'good' } },
    })).join('');
    return `<div class="rf-cat"><div class="rf-cat-h">${esc(c.label)}<span>${seen.length} of ${c.signals.length} evidenced</span></div>
      <div class="profile">${rows}</div></div>`;
  }).join('');

  const totalGaps = gaps.length;
  const totalPts = gaps.reduce((a, g) => a + g.pts, 0);

  return `${gaps.length ? `<hr class="rule"><section class="sec">
    <div class="sec-head"><span class="eyebrow accent">What we could not see</span><span class="t">${totalGaps} question${totalGaps === 1 ? '' : 's'} your evidence does not answer</span>
      <span class="meta">worth ${totalPts.toFixed(0)} points · highest first</span></div>
    <div class="profile">${gapRows}</div>
    <div class="profile-foot"><span>Each line names what would answer it. These are not marks against the venture — they are questions we were not given the evidence to score, so the floor has to assume the worst of each one. The points column is what that assumption costs you.</span></div>
  </section>` : ''}
  ${provenBlocks ? `<hr class="rule"><section class="sec">
    <div class="sec-head"><span class="eyebrow accent">What your evidence proves</span><span class="t">Read from the documents you supplied</span>
      <span class="meta">${cats.reduce((a, c) => a + c.signals.filter(s => s.evidenced).length, 0)} of 35 signals</span></div>
    ${provenBlocks}
    <div class="profile-foot"><span>Three independent reads per signal; the middle one is published. A balance icon marks a signal where the three disagreed and one vote decided it — more evidence would settle it.</span></div>
  </section>` : ''}`;
}

// rangeNext — the two ways OUT of the Range tab.
//
// The tab explained at length why the range is as wide as it is and then offered nothing to do about it:
// the first real customer read the width, went looking for somewhere to add the missing documents, and
// found no field and no button on either tab. A screen that says "we could not see X" has to say where to
// put X. The free route is named first and named plainly, because it is the one we want them taking.
export function rangeNext() {
  return `<hr class="rule"><section class="sec rng-next">
    <div class="sec-head"><span class="eyebrow accent">What narrows this</span><span class="t">Two ways to close the gap</span>
      <span class="meta">one is free</span></div>
    <div class="rng-next-grid">
      <div class="rng-next-c">
        <span class="material-symbols-rounded rng-ic">folder_open</span>
        <div class="rng-next-h">Give it more to read</div>
        <p class="rng-next-p">Add documents or link your Drive folder, then re-scan. Free, instant and as often as you like — it updates what we can see and shrinks what the range is guessing at.</p>
        <a class="m3-btn tonal" href="#dataroom"><span class="material-symbols-rounded">upload_file</span>Open the data room</a>
      </div>
      <div class="rng-next-c">
        <span class="material-symbols-rounded rng-ic">lock_open</span>
        <div class="rng-next-h">Replace it with one number</div>
        <p class="rng-next-p">The full assessment reads everything properly, researches the market and the team, and returns a single measured score with the reasoning and a deal memo behind it.</p>
        <button class="m3-btn filled" type="button" onclick="window.__eaUnlock&&window.__eaUnlock()"><span class="material-symbols-rounded">bolt</span>Unlock the full assessment</button>
      </div>
    </div>
  </section>`;
}

// emptyState — ATOM. "Nothing here yet", editorially.
//
// Every empty state in this product used to be a centred filled card, and the operator's instruction was
// to remove those everywhere. A tub around an absence is the worst case for one: it draws a container
// around the thing there is least to say about, and on a first run it is the first surface a customer
// sees. Centred text on the page background, no border, no fill.
export function emptyState(opts = {}) {
  const { title = 'Nothing here yet', text = '', ctaHtml = '' } = opts;
  return `<div class="empty-state"><div class="title-l">${esc(title)}</div>${text ? `<div class="body-m variant">${esc(text)}</div>` : ''}${ctaHtml}</div>`;
}

// prescreenStage — THE RUN SCREEN. Full width, three columns, nothing above the fold but the run.
//
// WHY IT REPLACES THE FORM RATHER THAN SITTING BESIDE IT. The first real user ran a pre-screen and spent the
// whole wait scrolling: the form held the left column and the live read was a 380px rail on the right, so
// "what is being scanned", "what was found" and "which categories have landed" were never on screen at once.
// The moment Run is pressed the form is also DEAD — every field is locked and nothing in it can be changed —
// so it is spending the entire viewport on controls that no longer do anything.
//
// So it goes. The three things a waiting person actually asks get a column each, side by side:
//   what are you reading · what did you find in my room · how far through the score are you
// Nothing to scroll to, and each column answers in place as the run moves.
//
// NEVER A FABRICATED PERCENTAGE — same rule as before. `phase` is the real stage; the step rail marks a
// stage done only when it is done. The only bar on screen is indeterminate.
export function prescreenStage(opts = {}) {
  const {
    name = '', phase = 'Starting…', step = 0,
    deck = null, docs = [], room = null, justFound = [],
    categories = [], landed = [], total = 7,
  } = opts;

  const STEPS = ['Reading your documents', 'Checking the data room', 'Scoring the seven categories'];
  const steps = STEPS.map((t, i) => `<li class="ps-step${i < step ? ' done' : i === step ? ' now' : ''}">
    <span class="material-symbols-rounded">${i < step ? 'check_circle' : i === step ? 'progress_activity' : 'radio_button_unchecked'}</span>${esc(t)}</li>`).join('');

  // COLUMN 1 — the evidence, with each file's real ingest state. A file that failed says so here and is not
  // quietly dropped: the score is computed from what was read, so what was read has to be visible.
  const fileRow = (f) => row({
    variant: 'metric', key: f.key || f.name, density: 'compact',
    cls: ['rcl', f.state === 'done' ? 'is-found' : f.state === 'fail' ? 'is-fail' : 'is-idle'].filter(Boolean).join(' '),
    title: f.name, sub: f.kind || '',
    trail: { kind: 'value', value: f.status || '',
             mark: { icon: f.state === 'done' ? 'check_circle' : f.state === 'fail' ? 'error' : 'radio_button_unchecked',
                     tone: f.state === 'done' ? 'good' : f.state === 'fail' ? 'bad' : 'idle' } },
  });
  const evidence = [
    ...(deck ? [fileRow({ ...deck, kind: 'Pitch deck' })] : []),
    ...docs.map(d => fileRow({ ...d, kind: 'Data room' })),
  ].join('');

  // COLUMN 2 — the room. Idle rows until the check lands, then the SAME rows with ticks (see roomPreview).
  const roomBody = room
    ? `<div class="profile">${(room.classes || []).map(c => row({
        variant: 'metric', key: c.key, density: 'compact',
        cls: ['rcl', c.found ? 'is-found' : 'is-gap', justFound.includes(c.key) ? 'just-found' : ''].filter(Boolean).join(' '),
        title: c.label, sub: c.found ? `Seen in ${c.seenIn || 'the room'}` : c.want,
        trail: { kind: 'value', value: c.found ? 'Present' : 'Not seen',
                 mark: { icon: c.found ? 'check_circle' : 'radio_button_unchecked', tone: c.found ? 'good' : 'idle' } },
      })).join('')}</div>`
    : `<div class="profile">${ROOM_CLASSES.map(c => row({
        variant: 'metric', key: c.key, density: 'compact', cls: 'rcl is-idle',
        title: c.label, sub: c.want,
        trail: { kind: 'value', value: 'Checking…', mark: { icon: 'radio_button_unchecked', tone: 'idle' } },
      })).join('')}</div>`;
  const foundN = room ? (room.classes || []).filter(c => c.found).length : 0;
  const roomMeta = room ? `${foundN} of ${(room.classes || []).length} found` : 'reading…';

  // COLUMN 3 — the score. Every category is listed from the start, so the column does not grow and shove
  // the page around as results arrive; each one fills in place.
  const byKey = Object.fromEntries(landed.map(c => [c.category, c]));
  const cats = (categories.length ? categories : landed.map(c => ({ key: c.category, label: c.label })));
  const catBody = cats.map(c => {
    const hit = byKey[c.key];
    const seen = hit ? (hit.signals || []).filter(x => x.evidenced).length : 0;
    const of = hit ? (hit.signals || []).length : 5;
    return row({
      variant: 'metric', key: c.key, density: 'compact',
      cls: ['rcl', hit ? 'is-found just-found' : 'is-idle'].filter(Boolean).join(' '),
      title: c.label,
      // Short on purpose: the trailing cell already states the outcome, and in a 330px column a
      // nine-word sub pushes the title onto a third line to say the same thing twice.
      sub: hit ? `${seen} of ${of} evidenced` : 'Waiting its turn',
      trail: { kind: 'value', value: hit ? (seen === of ? 'complete' : `${of - seen} unread`) : '',
               mark: { icon: hit ? 'check_circle' : 'radio_button_unchecked', tone: hit ? 'good' : 'idle' } },
    });
  }).join('');

  const col = (eyebrow, title, meta, body, foot) => `<section class="ps-col">
    <div class="sec-head"><span class="eyebrow accent">${esc(eyebrow)}</span><span class="t">${esc(title)}</span><span class="meta">${esc(meta)}</span></div>
    ${body}
    ${foot ? `<div class="profile-foot"><span>${foot}</span></div>` : ''}
  </section>`;

  return `<div class="ps-stage">
    <header class="ps-head">
      <span class="eyebrow accent"><span class="material-symbols-rounded">bolt</span>Pre-screening${name ? ' · ' + esc(name) : ''}</span>
      <h2 class="ps-h">${esc(phase)}</h2>
      ${linearProgress({ indeterminate: true })}
      <ol class="ps-steps">${steps}</ol>
    </header>
    <div class="ps-grid">
      ${col('What we are reading', 'Your evidence', `${(deck ? 1 : 0) + docs.length} file${(deck ? 1 : 0) + docs.length === 1 ? '' : 's'}`,
            evidence ? `<div class="profile">${evidence}</div>` : `<div class="profile-foot"><span>Nothing attached.</span></div>`,
            'Each file is read before the score starts. Anything that fails to parse is named here rather than dropped quietly.')}
      ${col('Your data room', 'What the score looks for', roomMeta, roomBody,
            'Free and unlimited to re-run. A type shown as not seen is not a mark against the venture — it is evidence we were not given.')}
      ${col('The score', 'Seven categories', `${landed.length} of ${total} landed`, `<div class="profile">${catBody}</div>`,
            'Three independent reads per signal, and the middle one is published — a single read of the same evidence can move a score by several points without making it more right.')}
    </div>
  </div>`;
}

// roomLockup — the Data Room tab's right-hand figure.
//
// IT IS A MAP OF THE LIST BELOW IT, not a new abstraction. One segment per document class, lit when the
// class is present, in the same order the rows appear underneath — so the figure and the list are the
// same fact at two zoom levels and a reader can check one against the other. A dial or a percentage
// would have been a prettier graphic and a worse one: there is no continuous quantity here, there are
// six yes/no answers, and inventing a 50% out of them implies a precision the check does not have.
//
// NEVER A GRADE. "3 of 6" is a count of what we were given, and the caption says so. The whole tab
// rests on the distinction between a venture scoring badly and a room we could not read.
export function roomLockup(opts = {}) {
  const { classes = null, docCount = 0, label = 'Room coverage' } = opts;
  const list = classes || ROOM_CLASSES.map(c => ({ ...c, found: false }));
  const found = classes ? list.filter(c => c.found).length : null;
  const of = list.length;
  const tone = found == null ? 'idle' : found === of ? 'good' : found === 0 ? 'gap' : 'mid';
  const segs = list.map(c => `<i class="${classes && c.found ? 'on' : 'off'}" title="${esc(c.label)}${classes ? (c.found ? ' · present' : ' · not seen') : ''}"></i>`).join('');
  return `<div class="score-lockup room-lockup tone-${tone}">
    <span class="eyebrow accent">${esc(label)}</span>
    <div class="lockup-num rml-num">${found == null ? '—' : esc(String(found))}<small>/${esc(String(of))}</small></div>
    <div class="rml-track" role="img" aria-label="${found == null ? 'Room not read yet' : `${found} of ${of} document types present`}">${segs}</div>
    <div class="rml-cap">${found == null
      ? 'Not read yet · scanning is free and takes a second'
      : found === of
        ? `Every type the score counts is present · ${docCount} document${docCount === 1 ? '' : 's'} read`
        : `<b>${of - found}</b> of ${of} still missing · ${docCount} document${docCount === 1 ? '' : 's'} read`}</div>
  </div>`;
}

// dataRoomHero — the tab's opening statement, on the SAME sectionHero as Verdict, Investability and
// Range. The tab opened straight into a list of six rows: the one surface the customer acts on was the
// only one in the assessment with nothing at the top telling them where they stood.
//
// The headline states the room's condition as a CONSEQUENCE and never as a verdict on the venture —
// same rule the rows follow. "Not seen" is a fact about us, not about them.
export function dataRoomHero(check = null, opts = {}) {
  const { isPrescreen = false, stagedCount = 0 } = opts;
  const classes = check ? (check.classes || []) : null;
  const of = classes ? classes.length : ROOM_CLASSES.length;
  const found = classes ? classes.filter(c => c.found).length : null;
  const missing = found == null ? null : of - found;
  const docCount = check ? (check.docCount || 0) : stagedCount;

  // SHORT ON PURPOSE. fitHeadline caps a headline at HEADLINE_MAX_WORDS and will cut a longer one at a
  // clause boundary — the first draft of this ran to thirteen words and shipped as "…are not in." The
  // count-of-total belongs in the facts row underneath, which already says "2 of 5"; repeating it in the
  // headline bought nothing and cost the end of the sentence.
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const word = n => WORDS[n] || String(n);
  const headline = found == null
    ? 'We have not read your data room yet.'
    : missing === 0
      ? 'Your room answers everything the score looks for.'
      : `${word(missing)} document type${missing === 1 ? '' : 's'} the score counts ${missing === 1 ? 'is' : 'are'} missing.`;

  const thesis = found == null
    ? 'Scanning reads what is already uploaded and tells you which of the document types the score counts it can find. It is free, it takes about a second, and it never moves your score on its own.'
    : missing === 0
      ? (isPrescreen
        ? 'There is nothing left to add for coverage. What is still holding the range open is the depth of the reading, not the evidence — and that is what the full assessment buys.'
        : 'Nothing the rubric asks for is absent. Anything further you file is strengthening a specific answer rather than closing a hole.')
      : 'A type shown as missing is not a mark against the venture — it is a question we were not given the evidence to answer, so the score has to assume the worst of it. Supply it and the floor moves up to meet what you can already prove.';

  return sectionHero({
    eyebrow: 'Data room', eyebrowIcon: 'folder_open',
    headline,
    facts: [
      // NOT "0 of 6" when unread. Zero is a measurement; this is the absence of one, and printing the
      // former told a customer who had just uploaded 46 documents that none of them counted.
      { k: 'Document types present', v: found == null ? `— of ${of}` : `${found} of ${of}` },
      { k: docCount ? 'Documents in the room' : 'Documents read', v: String(docCount) },
      ...(missing ? [{ k: 'Still missing', v: String(missing) }] : []),
    ],
    right: roomLockup({ classes, docCount }),
    thesisLabel: found == null ? 'What this does.' : missing === 0 ? 'Where that leaves you.' : 'What missing means.',
    thesis,
  });
}

// scrollParent — the element that ACTUALLY scrolls, or window.
//
// Not a detail on these pages: a page mounted with `.app-scroll` is height-bound so .shell-main scrolls
// INTERNALLY (that is what lets the masthead minify). On those pages window.scrollTo is a silent no-op —
// it moves a document that is not the thing scrolling. wireMinify already had to work this out; this is
// that logic named and shared, rather than a second copy that drifts.
export function scrollParent(el) {
  let n = el && el.parentElement;
  while (n && n !== document.body && n !== document.documentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === 'auto' || oy === 'scroll') return n;
    n = n.parentElement;
  }
  return window;
}

// revealLive — bring a live-progress region into view when work starts.
//
// WHY. Every scan on this product can be started from a button that is BELOW the surface that reports it:
// the data room's "Read this folder" sits under the room list, and the banner it drives renders at the
// top. The first real user pressed it, saw nothing move, and only found the progress bar by scrolling
// back up. Work starting somewhere the user is not looking reads as nothing happening.
//
// TWO RULES, because an over-eager scroll is its own bug:
//   · it does NOTHING when the target is already comfortably in view — yanking the page away from
//     someone who is already watching the right thing is worse than not scrolling at all;
//   · it offsets by the STICKY masthead's live height, or it would park the banner underneath it.
// Honours prefers-reduced-motion by jumping instead of animating.
export function revealLive(target, opts = {}) {
  if (typeof document === 'undefined') return false;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return false;
  const sc = scrollParent(el);
  const win = sc === window;
  const viewport = () => win
    ? { top: 0, bottom: window.innerHeight }
    : (r => ({ top: r.top, bottom: r.bottom }))(sc.getBoundingClientRect());
  // The masthead MINIFIES as you scroll, so its height is only true for the scroll position you measured
  // it at. Measuring the short one and scrolling up to where it is tall parks the target underneath it —
  // which is what the first version did. So: aim, let it settle, re-measure, nudge. Bounded at three
  // passes; it converges in two because the second measurement is taken where the page ends up.
  const edge = () => {
    const mh = document.querySelector('.masthead');
    return viewport().top + (opts.pad == null ? 16 : opts.pad) + (mh ? mh.getBoundingClientRect().height : 0);
  };
  // "Already visible" is about the TOP of the region, not the whole of it. A progress banner sits above a
  // list that is taller than the viewport, so requiring the element to fit entirely meant the test could
  // never pass and every call scrolled again.
  const settled = () => {
    const r = el.getBoundingClientRect(), v = viewport();
    return r.top >= edge() - 2 && r.top <= v.bottom - 120;
  };
  if (settled()) return false;   // already watching it — leave them alone
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pass = 0;
  const step = () => {
    const delta = el.getBoundingClientRect().top - edge();
    if (Math.abs(delta) < 2 || pass >= 3) return;
    pass++;
    const by = { top: delta, behavior: reduce ? 'auto' : 'smooth' };
    if (win) window.scrollBy(by); else sc.scrollBy(by);
    setTimeout(step, reduce ? 0 : 320);
  };
  step();
  return true;
}

// roomScanBanner — WHAT A SCAN LOOKS LIKE WHILE IT IS HAPPENING.
//
// The Drive read reported itself in one line of 12.5px grey text beside a button, and a 46-document scan
// ran for most of a minute behind it. The first real user nearly missed that anything was happening at
// all. This is the same information given the weight the wait actually has.
//
// DETERMINATE IS HONEST HERE, unlike the pre-screen run: the folder is listed before the first file is
// read, so `total` is a real count and not an estimate. `found` counts up as the free room check re-runs
// between files, which is the part that says the scan is DOING something rather than merely running.
export function roomScanBanner(opts = {}) {
  const { done = 0, total = 0, current = '', found = null, of = null, label = 'Reading your data room' } = opts;
  const pct = total ? Math.round((done / total) * 100) : null;
  return `<section class="sec rsb" aria-live="polite">
    <div class="rsb-top">
      <span class="material-symbols-rounded rsb-ic">plagiarism</span>
      <div class="rsb-txt">
        <div class="rsb-h">${esc(label)}${total ? ` · ${done} of ${total}` : ''}</div>
        <div class="rsb-sub">${current ? esc(String(current).slice(0, 72)) : 'Opening the folder…'}</div>
      </div>
      ${found != null && of != null ? `<div class="rsb-found"><b>${found}</b><span>of ${of} found</span></div>` : ''}
    </div>
    ${linearProgress(total ? { value: pct } : { indeterminate: true })}
  </section>`;
}

// dataRoomTab — the one surface in the product the customer ACTS ON.
//
// Everything else here is us talking at them: a verdict, a score, research we did. This is the thing they
// can go and change, and it is why the data room is a permanent tab in BOTH states rather than a footnote
// on the assessment. (This contradicts the comment at assess-next.html rejecting a 7th tab for Diligence —
// deliberately. That argument was that a permanent chapter about US is empty on the good deals. The data
// room is about THEM, is never empty, and is the only tab with a verb on it.)
//
// THE CHECK IS FREE AND UNLIMITED. It is regex over already-ingested text: no model, no cost, instant. That
// is the whole engagement loop — add documents, re-scan, watch coverage fill and the range narrow — and it
// is deliberately NOT the thing that costs money. Re-SCORING is.
//
// opts: { check } — a real api/_roomcheck result once one has been run; until then roomPreview() says what
// the score looks for, which is useful on its own and never reads as a grade.
export function dataRoomTab(opts = {}) {
  const { check = null, docCount = 0, deck = false, busy = false, canRescan = false,
          isPrescreen = false, driveUrl = '', staged = [], justFound = [], scan = null } = opts;
  // While a scan is running the banner sits ABOVE the list and the list keeps ticking beneath it — the
  // two together are the feedback. Putting the progress at the bottom beside a button is what made a
  // 46-document read look like nothing was happening.
  // The hero opens the tab the way Verdict, Investability and Range open theirs — this was the only
  // surface in the assessment that began cold with a list of rows. It renders in BOTH tab sets, so a
  // pre-screened venture and a fully assessed one get the same opening.
  const body = dataRoomHero(check, { isPrescreen, stagedCount: docCount })
    + '<hr class="rule">'
    + (scan ? roomScanBanner(scan) : '')
    + (check ? roomCheck(check, { justFound }) : roomPreview({ docCount, deck }));

  // THE TAB HAD NO VERB ON IT. Its own header calls this "the one surface the customer ACTS ON", and it
  // shipped with a single button that re-reads what was already there. A customer who has just been told
  // which six document types are missing has nowhere on this screen to supply one — they would have to
  // start a new assessment. So the two ways in are here: drop files, or link the folder.
  const add = `<section class="sec dr-add">
    <div class="sec-head"><span class="eyebrow accent">Add to the room</span><span class="t">Give the score more to read</span>
      <span class="meta">free — re-reading never costs anything</span></div>
    <div class="dr-add-grid">
      <div class="dr-add-col">
        <span class="na-lab">Upload documents</span>
        ${docDropzone(staged, {
          status: '', icon: 'folder_open', prompt: 'Drop documents here',
          sub: 'Financials, cap table, contracts, metrics — PDF, DOCX, XLSX, CSV, TXT, MD or ZIP.',
          note: 'Data room', addLabel: 'Add more documents',
          onPick: 'window.__drPick&&window.__drPick()', onClear: 'window.__drClear', onDrop: '__drDrop', locked: busy,
        })}
      </div>
      <div class="dr-add-col">
        <span class="na-lab">Or link a Google Drive folder</span>
        ${formField({ id: 'dr-drive', type: 'url', value: driveUrl,
          placeholder: 'https://drive.google.com/drive/folders/…',
          hint: 'Shared with anyone who has the link, or with dataroom-reader@ventrify-os.iam.gserviceaccount.com' })}
        <div class="dr-add-btns">
          <button class="m3-btn tonal" type="button" ${busy ? 'disabled' : ''} onclick="window.__drLinkDrive&&window.__drLinkDrive()">
            <span class="material-symbols-rounded">cloud_download</span>${driveUrl ? 'Re-read this folder' : 'Read this folder'}
          </button>
          ${canRescan ? `<button class="m3-btn text" type="button" ${busy ? 'disabled' : ''} onclick="window.__drRescanDrive&&window.__drRescanDrive()"><span class="material-symbols-rounded">cloud_sync</span>Pull new files</button>` : ''}
        </div>
      </div>
    </div>
  </section>`;

  // WHAT ADDING EVIDENCE ACTUALLY DOES, STATED HONESTLY. Re-reading the room is free and changes the
  // coverage picture; it does NOT re-score, because one scored pre-screen per venture is the rule the
  // product is built on. Saying "add documents and re-run" without that distinction would promise a free
  // re-roll and then refuse it at the one moment the customer is most invested.
  const outcome = isPrescreen
    ? `<div class="dr-act">
        <button class="m3-btn filled" type="button" onclick="window.__drUnlock&&window.__drUnlock()"><span class="material-symbols-rounded">lock_open</span>Unlock the full assessment</button>
        <span class="dr-act-x"><b>Re-reading the room is free and unlimited</b> — it updates what we can see and narrows what the range is guessing at. Re-<i>scoring</i> on the new evidence is the full assessment, which reads everything here properly and returns one measured number.</span>
      </div>`
    : `<div class="dr-act">
        <span class="dr-act-x">Free, and as often as you like — scanning the room costs nothing and never changes your score on its own. File evidence against a specific gap from the Diligence tab to move the score.</span>
      </div>`;

  // ORDER IS THE ARGUMENT: here is what we found → here is how to change it → here is what that buys.
  // Re-scan sat ABOVE the add block, which asked the reader to re-read the room before they had been
  // given anywhere to put anything new in it.
  return `<div class="brief">
    <div id="dr-slot">${body}</div>
    <hr class="rule">
    ${add}
    <div class="dr-act dr-act-scan">
      <button class="m3-btn ${check ? 'tonal' : 'filled'}" type="button" ${busy ? 'disabled' : ''} onclick="window.__drCheck&&window.__drCheck()">
        <span class="material-symbols-rounded">${check ? 'refresh' : 'plagiarism'}</span>${check ? 'Re-scan the room' : 'Check my data room'}
      </button>
    </div>
    ${outcome}
  </div>`;
}

// scoreProvenance — HOW MANY TIMES WAS THIS SCORED, AND ON WHAT?
//
// We publish the NEWEST snapshot. Re-running is cheap and unguarded. So an operator who dislikes 67 could run
// it again and keep 73, and every earlier number simply vanished from the screen — the whole history was
// fetched and thrown away one line before it was rendered. That is a dial with no fingerprints, and it is the
// owner's own experiment turned into an exploit: he ran one deck three times and got 66 / 70 / 77.
//
// The cure is not to forbid re-running — a re-run is legitimate and often necessary (the evidence changed, the
// rubric improved, the last run died). The cure is that a re-run CANNOT BE INVISIBLE. Every run is on the
// record, and each one now carries a fingerprint of the evidence that produced it (publish.js provenanceHash),
// so the two cases are told apart and named:
//
//   · SAME evidence, a different number  → that is OUR instrument moving, not the venture. Say so, and show
//     every number it produced. An operator may still re-run; he simply cannot do it quietly, and a reader can
//     see exactly what was shopped.
//   · DIFFERENT evidence                 → a legitimate re-score. The deck or data room changed; of course the
//     number did.
//
// Legacy snapshots predate the fingerprint. We then know the run count but NOT whether the evidence changed —
// so we say only what we know, and never guess.
//
// "THE SAME" HAS TWO HALVES, and reading only one is how this component lied. It keyed on provenanceHash alone
// — the founder's room — so a RESCORE after the operator filed evidence (same room, new augmentHash) was told
// "no new evidence was supplied … this is the tool", which is the precise opposite of what happened. And a
// scoring-model upgrade on an unchanged deck would have been branded instrument noise too.
//   EVIDENCE   = the founder's room (provenanceHash) + the operator's records (augmentHash)
//   INSTRUMENT = the rubric (rubricHash) + the model that applied it (scorer.model; unstamped = unrecorded)
// Only runs matching on BOTH are re-rolls, and only a re-roll's spread is the tool's fault.
const evidenceOf = s => (s && s.provenanceHash && s.provenanceHash.sha)
  ? `${s.provenanceHash.sha}+${(s.augmentHash && s.augmentHash.sha) || '-'}` : null;
const instrumentOf = s => `${(s && s.rubricHash) || '?'}|${(s && s.scorer && s.scorer.model) || 'unrecorded'}`;

export function scoreProvenance(snaps = []) {
  const list = (snaps || []).filter(Boolean);
  if (list.length < 2) return '';                       // one run — nothing to disclose

  const roomOf = s => (s && s.provenanceHash && s.provenanceHash.sha) || null;
  const latest = list[list.length - 1];
  const key = evidenceOf(latest);

  // runs on the SAME evidence as the one on screen — and, of those, the ones taken with the SAME instrument
  const sameEvidence = key ? list.filter(s => evidenceOf(s) === key) : [];
  const rerolls = sameEvidence.filter(s => instrumentOf(s) === instrumentOf(latest));
  const scores = rerolls.map(s => s.composite).filter(n => typeof n === 'number');
  const spread = scores.length > 1 ? Math.round((Math.max(...scores) - Math.min(...scores)) * 10) / 10 : 0;

  const upgraded = sameEvidence.filter(s => instrumentOf(s) !== instrumentOf(latest));
  const modelMoved = upgraded.some(s => ((s.scorer && s.scorer.model) || 'unrecorded') !== ((latest.scorer && latest.scorer.model) || 'unrecorded'));
  const operatorFiled = key && list.some(s => evidenceOf(s) && evidenceOf(s) !== key && roomOf(s) === roomOf(latest));
  const roomChanged = key && list.some(s => roomOf(s) && roomOf(s) !== roomOf(latest));

  let tone = 'muted', line;
  if (rerolls.length > 1 && spread > 0) {
    // The uncomfortable one — and the whole reason this component exists.
    tone = 'warn';
    line = `Scored ${rerolls.length} times on <b>the same deck and data room</b>: ${scores.join(' · ')}.
            The ${spread}-point difference is this tool, not the venture — no new evidence was supplied between these runs.`;
  } else if (rerolls.length > 1) {
    line = `Scored ${rerolls.length} times on the same deck and data room, and returned <b>${scores[0]}</b> every time.`;
  } else if (upgraded.length) {
    // An instrument change must not ERASE what came before it. Showing a single "before" would hide the case
    // this component exists for: three runs on the same deck that disagreed (67 · 73 · 78) are still our
    // instrument moving, and an upgrade since does not settle that — so their spread keeps the warn tone.
    const prevInstrument = instrumentOf(upgraded[upgraded.length - 1]);
    const before = upgraded.filter(s => instrumentOf(s) === prevInstrument).map(s => s.composite).filter(n => typeof n === 'number');
    const beforeSpread = before.length > 1 ? Math.round((Math.max(...before) - Math.min(...before)) * 10) / 10 : 0;
    if (beforeSpread > 0) tone = 'warn';
    line = `Re-scored on the same evidence with ${modelMoved ? 'an upgraded scoring model' : 'revised scoring criteria'}:
            <b>${latest.composite}</b> now, against ${before.join(' · ')} before. The change reflects the instrument, not new evidence.
            ${beforeSpread > 0 ? `The earlier ${before.length} runs disagreed by ${beforeSpread} points among themselves — on the same deck, with no new evidence between them.` : ''}`;
  } else if (operatorFiled) {
    line = `Re-scored after evidence was filed by an operator. Earlier runs did not have it.`;
  } else if (roomChanged) {
    line = `Re-scored after the evidence changed. Earlier runs judged a different deck or data room.`;
  } else {
    line = `Scored ${list.length} times. Earlier runs predate evidence fingerprinting, so whether they judged
            the same material is not recorded.`;
  }

  return `<div class="score-prov ${tone}">
    <span class="material-symbols-rounded">${tone === 'warn' ? 'balance' : 'history'}</span>
    <span>${line}</span>
  </div>`;
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

// Team tab hero — statement + benchLockup (the cast, split by who has to build the thing).
// Takes the score as a second argument, like researchMemo/investabilityHero already do, so the
// numeral can be the team's OWN category score rather than a count of who we could look up.
// Degrades to a scoreless bench when no snapshot is passed.
export function teamHero(a = {}, s = {}) {
  const h = (a.heroes && a.heroes.team) || {}, t = a.team || {};
  const cat = ((s && s.categories) || []).find(c => c.key === 'team') || {};
  const rated = (cat.subs || []).some(x => x.score != null);
  const score = rated && cat.num != null ? cat.num : null;
  // ⚠ The lockup now prints the team's category score as its numeral, and the runner's hero facts
  // very often restate it ("Founder–market fit · 3.0 / 5 · heaviest signal") — the same figure
  // twice in one hero, two feet apart. Drop a fact that LEADS with that exact N / 5 and nothing
  // else; a fact that merely mentions the number in a sentence is left alone, because it is then
  // making an argument rather than repeating a readout.
  const facts = score == null ? h.facts : (h.facts || []).filter(f => {
    const v = String(f && f.v || '').replace(/<[^>]*>/g, ' ');
    return !new RegExp(`^\\s*${Number(score)}(\\.0)?\\s*/\\s*${Number(cat.max) || 5}\\b`).test(v);
  });
  return sectionHero({
    eyebrow: h.eyebrow, eyebrowIcon: h.eyebrowIcon, headline: h.headline, headlineEm: h.headlineEm, facts,
    right: benchLockup({
      label: 'Team signal', members: t.members || [], gaps: t.gaps || [],
      score, weightPct: cat.weightPct || null,
    }),
    thesis: h.thesis
  });
}

// Research tab hero — statement + coverageLockup (evidence completeness + provenance).
export function researchHero(a = {}, s = {}) {
  const h = (a.heroes && a.heroes.research) || {}, cf = a.confidence || {};
  const { rated, total } = signalCount(s);   // ONE derivation, shared with the radar caption
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
  const bars = tiers.map(([k, d, sub], i) => metricRow({ label: k, sub, bar: { now: d.v }, value: d.value, cls: `funnel${i % 2 === 0 ? ' zebra' : ''}` })).join('');
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

// The field — an editorial standfirst, then the dense 5×6 matrix, then the structural-edge callout.
// ⚠ The matrix used to sit in an .m3-card, on the argument that a cross-read table "earns its
// container". It does not: a filled, shadowed panel in the middle of a memo reads as a widget
// pasted into an argument, and the table's own header rule and row hairlines already do every
// job the card was doing. It now sits on the background, flush with the prose above it.
export function benchmarkTable(b, onOpen = '') {
  if (!b || !(b.rows || []).length) return '';   // live verdicts can ship without a benchmark (mirrors the classic guard)
  const standfirst = `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The field</span><span class="t">Everyone else already shipped</span></div>
    <p class="lead"><span class="drop">${esc(b.leadDrop || 'MoneyGym')}</span> ${esc(b.lead || b.note)}</p>
  </section>`;
  const matrix = `<section class="sec matrix-sec">
    <div class="tbl-scroll"><table class="tbl tbl-bare"><thead><tr>${b.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr ${r.me ? 'class="me"' : ''}>${r.cells.map((c, i) => `<td>${i === 0 && r.me ? '<b>' + esc(c) + '</b>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
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

// memberParts — a member's PERSON and ROLE as two strings. The runner emits them separately, the
// adapter used to glue them into one `name` ("Jonathan Corner — CEO / Founder"), and THREE call
// sites then each split that back apart with their own regex. The adapter now carries them
// structured as well, so this prefers the real fields and falls back to the split only for a
// fixture (or a stored snapshot) written before they existed.
export function memberParts(m = {}) {
  const joined = String(m.name || '');
  const [first, ...rest] = joined.split('—');
  return { person: m.person || first.trim() || joined, role: m.role || rest.join('—').trim() };
}

// Who has to BUILD the thing, vs who advises them. On a surprising number of assessments the split
// IS the finding — a board that checks out sitting above an executive team that does not — and an
// undifferentiated headcount averages that away. Matched on the ROLE, which every member carries,
// so it stays venture-agnostic; anything unmatched counts as executive, because the default
// assumption for an unlabelled person on a cap table is that they work there.
const BOARD_RE = /\b(ned|non[- ]?exec\w*|advis\w*|chair\w*|board|observer|investor|mentor)\b/i;
export const isBoardRole = role => BOARD_RE.test(String(role || ''));

// signalTier — MOLECULE. One labelled band of signal-tinted people-pills: a tier label, a derived
// count on the right, and the pills. Generic over any [{i, label, signal, icon}] set — `signal`
// picks the tint (positive/neutral/flag) and an item with an `icon` and no label renders as an
// empty-seat pill. A tier with nothing in it renders NOTHING, so a board-less team leaves no
// dangling header.
//
// `meta` takes EITHER a plain string or [{text, tone}] parts, so a caller can colour the clause
// that is a warning ("2 flagged") while the clause that is only a tally ("0 of 3 verified") stays
// in the reading hue. One string would force the whole line to be one or the other.
export function signalTier(opts = {}) {
  const { label = '', items = [], meta = '', metaTone = '' } = opts;
  if (!items.length) return '';
  const pills = items.map(it => {
    // `kind` wins when a caller needs the outline treatment on a pill that DOES carry a label
    // (the "+3 more seats" overflow); otherwise icon-only means seat, and a signal means a person.
    const cls = it.kind || (it.icon && !it.label ? 'seat' : (SIGCOL[it.signal] ? it.signal : 'neutral'));
    // ⚠ an icon is a LIGATURE — its text content is the token, so without a real label beside it a
    // screen reader announces "person_add". icon() hides the glyph; `alt` is what gets read instead.
    const body = it.icon && !it.label
      ? `${icon(it.icon)}${srOnly(it.alt || 'Empty seat')}`
      : `${it.i ? `<s aria-hidden="true">${esc(it.i)}</s>` : ''}${esc(it.label || '')}`;
    return `<b class="${esc(cls)}"${tipAttrs(it.tip)}>${body}</b>`;
  }).join('');
  const parts = Array.isArray(meta) ? meta : (meta ? [{ text: meta, tone: metaTone }] : []);
  const metaHtml = parts.length
    ? `<em>${parts.map(p => `<span class="${p.tone === 'bad' ? 'bad' : ''}">${esc(p.text)}</span>`).join('<i>·</i>')}</em>`
    : '';
  // the tier label is the house .eyebrow atom, not a second uppercase-label treatment
  return `<div class="sigtier">
    <div class="sigtier-h"><span class="eyebrow">${esc(label)}</span>${metaHtml}</div>
    <div class="sigtier-row">${pills}</div>
  </div>`;
}

// benchLockup — MOLECULE. The Team hero's chart: the cast arranged as a BENCH — who runs the
// company, who advises it, and the seats nobody is in — under the team's own category score.
//
// It replaced progressLockup, which this hero had been borrowing from the diligence clearance
// metric. That molecule printed one numeral ("2") that was a count of the people we could look up,
// which is diligence hygiene rather than a judgement on the team, and it sat beside a hero fact
// reading 3.0 / 5; two different numbers, two different meanings, one inch apart. Worse, flattening
// everyone into a single row of pips averages away the only pattern on this tab that changes a
// decision — a verified BOARD above an unverified EXECUTIVE team.
//
// Seats are drawn UNLABELLED on purpose: `gaps` is free prose ("No ML / AI lead on the cap table or
// board — …") and not every entry is even a role, so the count is honest where a parsed role name
// would sometimes be fiction. The gaps are named in full in teamGaps() further down the tab.
export function benchLockup(opts = {}) {
  const {
    label = 'Team signal', labelTone = 'accent',
    members = [], gaps = [], score = null, max = 5, weightPct = null,
    execLabel = 'Running the company', boardLabel = 'Board & advisory', seatLabel = 'Seats nobody is in',
    maxSeats = 7,
  } = opts;
  const exec = members.filter(m => !isBoardRole(memberParts(m).role));
  const board = members.filter(m => isBoardRole(memberParts(m).role));
  // the pill's label is the role, trimmed to its first clause ("CTO / Co-Founder" → "CTO"), because
  // a hero pill has room for a title and not a job description; a member with no role shows the name.
  const pill = m => {
    const { person, role } = memberParts(m);
    return { i: m.i, label: (role.split('/')[0] || '').trim() || person, signal: m.signal };
  };
  const tier = (lab, ms) => {
    const v = ms.filter(m => m.signal === 'positive').length, f = ms.filter(m => m.signal === 'flag').length;
    // Clause by clause, because they are not the same kind of statement. "N of M verified" is a
    // tally and reads in the body hue — EXCEPT when none of a multi-person tier checks out, which
    // is the finding this chart exists to surface. "N flagged" is always a warning.
    return signalTier({
      label: lab, items: ms.map(pill),
      meta: [
        { text: `${v} of ${ms.length} verified`, tone: v === 0 && ms.length > 1 ? 'bad' : '' },
        f ? { text: `${f} flagged`, tone: 'bad' } : null,
      ].filter(Boolean),
    });
  };
  // a team missing twenty roles would otherwise draw twenty seats and swamp the tiers above it;
  // past the cap the last seat carries the remainder, so the row stays short and still adds up.
  const over = Math.max(0, gaps.length - maxSeats);
  // A seat is drawn unlabelled because `gaps` is free prose and a parsed role name would sometimes
  // be fiction — but the prose itself always says which role is missing, so hovering a seat shows
  // it verbatim. The em-dash split is PRESENTATIONAL only: both halves are shown either way, so
  // nothing is hidden and nothing is invented when a gap happens not to have one.
  const seatTip = g => {
    const s = String(g), cut = s.search(/\s[—–]\s/);
    return cut > 0 && cut < 80
      ? { title: s.slice(0, cut).trim(), body: s.slice(cut + 3).trim(), kind: 'err' }
      : { body: s, kind: 'err' };
  };
  const seats = gaps.length ? signalTier({
    label: seatLabel,
    // an unfilled seat is an absence the venture is being marked down for, not a tally
    meta: [{ text: `${gaps.length} to hire`, tone: 'bad' }],
    items: gaps.slice(0, over ? maxSeats - 1 : maxSeats)
      .map((g, i) => ({ icon: 'person_add', alt: `Unfilled seat ${i + 1} of ${gaps.length}: ${g}`, tip: seatTip(g) }))
      .concat(over ? [{
        label: `+${over}`, kind: 'seat', alt: `${over} further unfilled seats`,
        tip: { title: `${over} more seats to fill`, body: gaps.slice(maxSeats - 1).join(' · '), kind: 'err' },
      }] : []),
  }) : '';
  const body = `${tier(execLabel, exec)}${tier(boardLabel, board)}${seats}`;
  const numeral = score == null
    ? `<div class="lockup-num"><span class="lockup-forming">Forming</span></div>`
    : `<div class="lockup-num">${esc(String(score))}<small>/${esc(String(max))}</small></div>`;
  // the caption carries the one thing the tiers cannot: how much of the whole score this tab moves.
  const cap = score == null
    ? `<div class="bl-cap"><span class="bl-wait">Scored when the run completes</span></div>`
    : weightPct
      ? `<div class="bl-cap"><span><b>${esc(String(weightPct))}%</b> of the score</span><span class="bl-part">the heaviest category</span></div>`
      : '';
  return `<div class="bench-lockup">
    <span class="eyebrow ${labelTone}">${esc(label)}</span>
    ${numeral}${cap}
    ${body ? `<div class="bl-bench">${body}</div>` : `<div class="bl-cap"><span class="bl-wait">No team named on this assessment yet.</span></div>`}
  </div>`;
}

// founderRoster — ORGANISM. The founder cast as signal-tinted editorial rows on the background — the detail
// behind teamHero's bench. The scannable signal column survives as a tinted monogram + a trailing
// signal word, not a card border. Reuses memberBg + the hairline-row grid.
export function founderRoster(team, onOpen = '') {
  const members = team.members || [];
  const nV = members.filter(m => m.signal === 'positive').length, nF = members.filter(m => m.signal === 'flag').length;
  const rows = members.map(m => {
    const { person: nm, role } = memberParts(m);
    return `<div class="frow">
      <div class="mono" style="${memberBg(m.signal)}">${esc(m.i)}</div>
      <div class="frow-bd"><div class="frow-nm">${esc(nm)}</div>${role ? `<div class="frow-role">${esc(role)}</div>` : ''}<div class="frow-bg">${esc(m.bg)}</div></div>
      <div class="frow-sig ${esc(m.signal)}">${m.gapId ? gapChip(m.gapId, 'Not found') : esc(SIG_WORD[m.signal] || 'To verify')}</div>
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
export function teamMemo(a, s) {
  // filter/join like marketMemo/researchMemo — a self-omitting section (no gaps / no exit) never leaves a dangling rule
  const secs = [teamHero(a, s), founderRoster(a.team, 'openPeek'), teamGaps(a.team), exitLedger(a.exit)].filter(Boolean);
  return `<div class="brief">${secs.join('\n    <hr class="rule">\n    ')}</div>`;
}


// ---- research + data room ----
/* RCOL is the icon colour, RTONE the tile behind it — the same colour at 14%.
   RTONE used to be three frozen rgba() literals carrying M3's stock lavender
   (#D0BCFF), a mint green and an amber, so the tiles kept the default palette
   while the icons on top of them followed the brand. Derived from RCOL now, so
   the pair can never drift again. */
const RCOL = { p: 'var(--md-sys-color-primary)', s: 'var(--success)', w: 'var(--warning)' };
const RTONE = Object.fromEntries(Object.entries(RCOL).map(([k, v]) => [k, `color-mix(in srgb, ${v} 14%, transparent)`]));

// researchRow — MOLECULE. One editorial evidence-index row, a bar-less sibling of metricRow drilling to the
// aux peek: a tinted workstream marker + title + one-line finding · a depth/status chip · a drill chevron.
export function researchRow(r, i, onOpen = '') {
  const act = onOpen ? ` role="button" tabindex="0" onclick="${onOpen}('research',${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onOpen}('research',${i})}"` : '';
  return `<div class="mrow research${i % 2 === 0 ? ' zebra' : ''}${onOpen ? ' drill' : ''}"${act}>
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
    <div class="ev-signals">${signalRows(subs, a.gapBySlug || {}, 'evidence')}</div>
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
export function lifecycleStrip(steps = [], opts = {}) {
  const ic = s => s === 'done' ? 'check' : s === 'current' ? 'radio_button_checked' : 'radio_button_unchecked';
  // scale:'editorial' lifts the strip out of rail density and into the reading column. The rail caller passes
  // nothing and renders byte-identically — this is the smallest possible shared change.
  const cls = opts.scale === 'editorial' ? 'lifecycle lifecycle-lg' : 'lifecycle';
  return `<ol class="${cls}">${steps.map(s => `<li class="lifecycle-step ${s.state || 'pending'}">
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
// chatPanel — ORGANISM. The Assist rail panel: a conversation with the assistant about THIS venture.
//
// WHY CITATIONS ARE A VISIBLE PART OF THE COMPONENT, not a detail. The assistant reads only the assessment's
// own outputs, and the operator has to be able to tell at a glance which sentences came from the governed
// work and which are the model talking. So every answer shows the sources it used as chips, and anything it
// cited that does NOT exist in the corpus is rendered as a loud warning rather than quietly dropped — a
// stripped bad citation leaves the sentence standing and looking sourced, which is the failure we care about.
//
// Rendering only. The page owns sending, subscribing and scroll — see workspace/assess-next.html.
function chatMsg(m, idx) {
  if (m.role === 'user') {
    return `<div class="chat-msg user"><div class="chat-bubble">${esc(m.text)}</div></div>`;
  }
  // NUMBERED REFERENCES, not inline ids. The first cut printed the raw source id in superscript, which both
  // shoved the line spacing apart and repeated "research:claims-validation" mid-sentence. Numbers keyed to
  // the chips underneath say the same thing and get out of the way of the prose.
  const cited = m.cited || [];
  const num = new Map(cited.map((id, i) => [id, i + 1]));
  const body = esc(m.text)
    .replace(/\[\[unverified: ([^\]]+)\]\]/g, (f, id) => `<span class="chat-bad" title="This source does not exist in the assessment">unverified: ${esc(id)}</span>`)
    // DEFENCE IN DEPTH. The route validates before storing, so a bad id should never reach here — but if one
    // ever did, rendering it as an ordinary reference would make an unsupported claim look sourced, which is
    // the single failure this panel exists to prevent. Anything not in the validated list is shown as bad.
    .replace(/\[\[([^\]]+)\]\]/g, (f, raw) => {
      const id = raw.trim();
      return num.has(id)
        ? `<sup class="chat-ref" data-src="${esc(id)}" title="${esc(id)}">${num.get(id)}</sup>`
        : `<span class="chat-bad" title="This source does not exist in the assessment">unverified: ${esc(id)}</span>`;
    })
    // Figure markers, inserted by checkFigures after the model answered. Two tones on purpose: a number the
    // model worked out and said so is honest and gets a quiet note; a number that simply is not in the
    // sources is the dangerous case — a mis-keyed digit beside a correct citation reads MORE sourced than
    // an uncited claim, not less.
    .replace(/⟨not in sources⟩/g, '<span class="chat-bad" title="This figure does not appear anywhere in the assessment">not in sources</span>')
    .replace(/⟨derived⟩/g, '<span class="chat-derived" title="The assistant calculated this; it is not quoted from a source">derived</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  const chips = cited.length
    ? `<div class="chat-srcs">${cited.map((id, i) => `<button class="chat-chip" data-src="${esc(id)}"><b>${i + 1}</b>${esc(id)}</button>`).join('')}</div>` : '';
  const figs = (m.unsupportedFigures || []).length
    ? `<div class="chat-warn"><span class="material-symbols-rounded">report</span>${m.unsupportedFigures.length} figure${m.unsupportedFigures.length === 1 ? '' : 's'} in this answer ${m.unsupportedFigures.length === 1 ? 'does' : 'do'} not appear in the assessment. Check ${m.unsupportedFigures.length === 1 ? 'it' : 'them'} against the source before using ${m.unsupportedFigures.length === 1 ? 'it' : 'them'}.</div>` : '';
  const bad = (m.invalid || []).length
    ? `<div class="chat-warn"><span class="material-symbols-rounded">report</span>Cited ${m.invalid.length} source${m.invalid.length === 1 ? '' : 's'} that ${m.invalid.length === 1 ? 'does' : 'do'} not exist in this assessment. Treat ${m.invalid.length === 1 ? 'that claim' : 'those claims'} as unsupported.</div>` : '';
  const omitted = (m.dropped || []).length
    ? `<div class="chat-note">${m.dropped.length} research document${m.dropped.length === 1 ? '' : 's'} too large to load for this answer.</div>` : '';
  const stub = m.stub ? `<div class="chat-note">Stub mode &mdash; no model was called.</div>` : '';
  // PROPOSALS, NOT ACTIONS. Every card shows exactly what will be written and does nothing until pressed.
  // The commit runs through the operator's own credentials, so the assistant can never reach further than
  // the person reading it could by clicking the same thing themselves.
  const props = (m.proposals || []).map((pr, j) => {
    const done = pr.committed ? `<div class="chat-prop-done"><span class="material-symbols-rounded">check</span>${esc(pr.committed)}</div>` : '';
    const lines = (pr.lines || []).length ? `<div class="chat-prop-l">${pr.lines.map((l) => esc(l)).join('<br>')}</div>` : '';
    const btn = pr.committed ? '' :
      `<button class="m3-btn ${pr.warn ? 'outlined' : 'filled'} chat-prop-go" data-msg="${idx}" data-prop="${j}">${esc(pr.cta)}</button>`;
    return `<div class="chat-prop${pr.warn ? ' warn' : ''}">
      <div class="chat-prop-t"><span class="material-symbols-rounded">${pr.warn ? 'warning' : 'bolt'}</span>${esc(pr.title)}</div>
      <div class="chat-prop-d">${esc(pr.detail)}</div>${lines}${done}${btn}</div>`;
  }).join('');
  return `<div class="chat-msg bot">${stub}<div class="chat-body">${body}</div>${bad}${figs}${chips}${omitted}${props}</div>`;
}

export function chatPanel(c = {}) {
  const msgs = c.messages || [];
  const empty = `<div class="chat-empty">
    <span class="material-symbols-rounded">auto_awesome</span>
    <div class="title-s">Ask about ${esc(c.ventureName || 'this venture')}</div>
    <div class="body-s variant">I can only see this assessment &mdash; its verdict, its scorecard and its deep research.
    I have not read the founder&rsquo;s own documents, and I have no web access. If something is not in the
    assessment I will say so rather than guess.</div>
  </div>`;
  const body = `<div class="chat-log" id="chat-log">${msgs.length ? msgs.map(chatMsg).join('') : empty}
    ${c.pending ? `<div class="chat-msg bot"><div class="chat-thinking"><span></span><span></span><span></span></div></div>` : ''}</div>`;
  const footer = `<form class="chat-form" id="chat-form" onsubmit="return false;">
      <textarea id="chat-input" class="chat-input" rows="1" placeholder="Ask about this assessment&hellip;"
        aria-label="Ask about this assessment"${c.pending ? ' disabled' : ''}></textarea>
      <button class="m3-btn filled chat-send" id="chat-send" type="button" aria-label="Send"${c.pending ? ' disabled' : ''}>
        <span class="material-symbols-rounded">arrow_upward</span></button>
    </form>`;
  return {
    title: 'Assistant',
    subtitle: `${esc(c.ventureName || 'Assessment')} \u00b7 reads this assessment only`,
    body, footer,
  };
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
  const row = (d, i) => {
    const meta = [d.readTime, d.sources ? `${d.sources} source${d.sources === 1 ? '' : 's'}` : '', d.sections ? `${d.sections} sections` : ''].filter(Boolean).join(' · ');
    return `<div class="mrow research drill${i % 2 === 0 ? ' zebra' : ''}" role="button" tabindex="0"
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

/* drillRail — the drill's ONE navigation surface: every sibling document, and the active
   one opened in place to show its own sections.

   Two levels in one list, because that is how the content is organised — a workstream
   contains sections. Splitting them into a sibling list plus an "On this page" card meant
   printing the lower half twice, once above the fold, under a meta line that already said
   how many sections there were.

   The sections slot is filled in a SECOND phase (fillResearchDrill), because the headings
   only exist once the markdown has been parsed, and that parse is async. */
export function drillRail(opts = {}) {
  const { label = '', items = [], activeKey = '', onPick = '' } = opts;
  if (!items.length) return '';
  const row = it => {
    const on = it.key === activeKey;
    const go = onPick && !on ? ` onclick="${onPick}('${esc(it.key)}')"` : '';
    return `<button type="button" class="dr-i${on ? ' on' : ''}"${go}${on ? ' aria-current="true"' : ''}>${
      esc(it.label)}${it.tag ? `<span class="dr-tag">${esc(it.tag)}</span>` : ''}</button>${
      on ? '<div class="dr-secs" data-rail-secs></div>' : ''}`;
  };
  return `<nav class="drill-rail" aria-label="${esc(label || 'Contents')}">${
    label ? `<div class="drill-rail-lab">${esc(label)}</div>` : ''}${items.map(row).join('')}</nav>`;
}

/* the section list for the active document, rendered into the rail's slot */
export function drillRailSections(sections = []) {
  if (sections.length < 2) return '';      // a one-section document has nothing to navigate
  return sections.map(s =>
    `<button type="button" class="dr-s" data-sec="${esc(s.id)}">${esc(s.label)}</button>`).join('');
}

/* scroll-spy — now drives the SECTIONS INSIDE THE RAIL rather than the retired inline card.
   Click-to-scroll is delegated here too, so the rail owns its own behaviour. */
export function wireDrillSpy() {
  const root = document.querySelector('.m3-drill .drill-scroll');
  const rail = document.querySelector('.m3-drill .drill-rail');
  if (!root || !rail) return;
  const links = [...rail.querySelectorAll('.dr-s')];
  if (!links.length) return;
  if (root.__spy) root.__spy.disconnect();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.toggle('on', a.dataset.sec === e.target.id));
    });
  }, { root, rootMargin: '-96px 0px -70% 0px' });
  document.querySelectorAll('.m3-drill .art-body h2[id]').forEach(h => io.observe(h));
  root.__spy = io;
  if (!rail.__wired) {
    rail.__wired = true;
    rail.addEventListener('click', e => {
      const s = e.target.closest('.dr-s'); if (!s) return;
      const h = document.getElementById(s.dataset.sec);
      if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
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

  // the section list now lands in the RAIL, beneath the active document
  const h2 = sections.filter(s => s.level === 2);
  const slot = document.querySelector('.m3-drill [data-rail-secs]');
  if (slot) slot.innerHTML = drillRailSections(h2);

  const pager = document.querySelector('.m3-drill [data-pager]');
  if (pager) pager.innerHTML = drillPager(doc, room);
  wireDrillSpy();
}

// researchDrillBody — the SYNCHRONOUS scaffold openDrill needs, which schedules its own async fill.
// This hook is common to all three open paths (row click, ?drill= cold link, popstate) because every one
// of them resolves through DRILL_PAGES[key]() → render().
export function researchDrillBody(doc, room) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fillResearchDrill(doc, room));
  // the rail is rendered SYNCHRONOUSLY with the sibling list — only the section slot waits
  // for the markdown parse, so the reader never sees navigation pop in late.
  const rail = drillRail({
    label: `Evidence · ${(room.all || []).length} workstreams`,
    items: (room.all || []).map(d => ({ key: d.slug, label: d.title, tag: d.tag })),
    activeKey: doc.slug,
    onPick: 'window.openResearchDrill',
  });
  return `<div class="drill-body-inner">${rail}<div class="drill-main">${articleMeta(doc)}
    <div class="art-body art-prose" data-fill="${esc(doc.slug)}">${researchSkeleton()}</div>
    <div data-pager></div></div></div>`;
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
  // A capped search still has flex:1, so it competes with the spacer and lands narrower than its cap.
  // Giving it a flex-basis as well as a max pins it at the width asked for and lets the spacer take
  // the rest — which is what puts the chips left and the search right.
  const searchEl = (s = {}) => `<label class="m3-search"${s.max ? ` style="max-width:${s.max};flex:0 1 ${s.max}"` : ''}><span class="material-symbols-rounded">search</span><input type="search"${s.id ? ` id="${esc(s.id)}"` : ' class="search"'} placeholder="${esc(s.placeholder || placeholder)}"></label>`;
  if (Array.isArray(config)) {
    // The search is flex:1, so without a spacer and a cap it eats the whole row. The config form
    // below already solved this; the legacy array form had not, which is the only reason the two
    // rendered differently. Same spacer, same cap — the chips stay left, the search stays right.
    return `<div class="filters">${config.map((c, i) => `<button class="m3-chip${i === 0 ? ' selected' : ''}">${esc(c)}</button>`).join('')}<div class="ws-filter-spacer"></div>${searchEl({ placeholder, max: '320px' })}</div>`;
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
  const tr = r => `<tr${go(r)}>
    <td><div class="et-v"><span class="et-av" style="background:${AVAC[r.avatar]}">${esc(r.i)}</span><div><div class="et-name">${esc(r.name)}</div><div class="et-sub">${esc(r.sub)}</div></div></div></td>
    <td class="et-stage">${esc(r.stage)}</td><td>${statusPill(r.status)}</td>${cell(r)}<td class="et-when">${r.when || '1h ago'}</td>${del(r)}</tr>`;
  const cols = 5 + (opts.onDelete ? 1 : 0);
  const head = `<thead><tr><th>Venture</th><th>Stage</th><th>Status</th><th>Progress / signal</th><th>Last activity</th>${opts.onDelete ? '<th class="et-act"><span class="sr-only">Actions</span></th>' : ''}</tr></thead>`;
  // opts.groups: [{title, why, rows}] — one table, banded. NOT one table per group: a group heading is a
  // caption over the same columns, and separate tables would let the columns drift apart between bands.
  const body = opts.groups
    ? opts.groups.map(g => `<tbody class="et-grp"><tr class="et-gh"><th scope="rowgroup" colspan="${cols}">
          <span class="g">${esc(g.title)}</span><span class="c">${g.rows.length}</span>${g.why ? `<span class="why">${esc(g.why)}</span>` : ''}
        </th></tr>${g.rows.map(tr).join('')}</tbody>`).join('')
    : `<tbody>${rows.map(tr).join('')}</tbody>`;
  // No .m3-card: the table sits ON the page, like every other table in the product. The wrapper stays
  // for the horizontal scroll a narrow viewport still needs.
  // Grouped mode hides the column header row visually — each group caption is doing that work for the
  // eye — but keeps it in the accessibility tree, or the columns are announced as unlabelled data.
  return `<div class="table-wrap"><table class="eng-table${opts.groups ? ' is-grouped' : ''}">${opts.groups ? head.replace('<thead>', '<thead class="sr-only">') : head}${body}</table></div>`;
}

// ============ PORTFOLIO EMPTY STATE (first-run launchpad) + ASSESSMENT WIZARD ============

// primerStrip — ORGANISM. An evergreen "how it works" explainer — numbered horizontal cells (reuses queueItem's
// .q-ic tinted tile). NOT lifecycleStrip (its done/current/pending states imply a live run — wrong for an explainer).
const PRIMER_STEPS = [
  { icon: 'upload_file', title: 'Deck in', note: 'Upload the pitch deck and any financials. That’s all the assessment needs to start.' },
  { icon: 'manage_search', title: 'Research', note: 'Eleven workstreams rebuild every load-bearing claim from primary sources — filings, benchmarks, a ten-competitor teardown.' },
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
    single = false, onPick = '', onClear = '', onDrop = '',
  } = opts;
  const list = (files || []).filter(Boolean);
  // REAL DRAG AND DROP. This component has said "Drop the pitch deck here" since it was written and has
  // never accepted a drop — it was a <button>, click only. An affordance the UI names and does not honour
  // is worse than no affordance: the user tries it, nothing happens, and they distrust the next one.
  //
  // `onDrop` is a bare GLOBAL FUNCTION NAME (not an expression like onPick) because the delegated listener
  // in initDropzones() resolves and calls it with the FileList — there is nothing sensible to inline.
  // Dropping is accepted on the empty zone AND on an already-attached zone, because "add more" by drag is
  // the same gesture and refusing it there would be the same broken promise one step later.
  const drop = onDrop && !opts.locked ? ` data-drop="${esc(onDrop)}"` : '';
  if (!list.length) return `<button class="deckdrop" type="button"${drop} onclick="${onPick}">
    <span class="material-symbols-rounded dd-ic">${esc(icon)}</span>
    <span class="dd-nm">${esc(prompt)}</span>
    <span class="dd-sub">${esc(sub)}</span>
    ${drop ? '<span class="dd-drop"><span class="material-symbols-rounded">download</span>Drop to attach</span>' : ''}
  </button>`;
  // a file may carry its OWN status/tag (e.g. 'Uploading…' / 'Failed' while the panel ingests) — falls back
  // to the zone-level status, so existing callers are unchanged.
  const row = (f, i) => `<div class="deckdrop attached${f.busy ? ' busy' : ''}">${srcRow({ icon: f.icon || fileIcon, title: f.title, note: f.note || note, status: f.status !== undefined ? f.status : status, tag: f.tag })}
    ${opts.locked ? '' : `<button class="m3-btn text" onclick="${onClear}${single ? '' : `(${i})`}"><span class="material-symbols-rounded">close</span>${esc(clearLabel)}</button>`}</div>`;
  // Only a zone that actually accepts drops grows a wrapper and a hint — a caller that passes no `onDrop`
  // gets byte-identical output to before, which is what deckDropzone's contract promises.
  const hint = t => drop ? `<span class="dd-drop"><span class="material-symbols-rounded">download</span>Drop to ${t}</span>` : '';
  if (single) return drop ? `<div class="dd-one"${drop}>${row(list[0], 0)}${hint('replace')}</div>` : row(list[0], 0);
  return `<div class="dd-stack"${drop}>${list.map(row).join('')}${opts.locked ? '' : `<button class="m3-btn text dd-add" type="button" onclick="${onPick}"><span class="material-symbols-rounded">add</span>${esc(addLabel)}</button>`}${hint('add')}</div>`;
}

// initDropzones — ONE delegated listener set for every [data-drop] on the page, ever.
//
// Delegated and not per-element on purpose: these zones are re-rendered from strings on every state change
// (naPaintDeck / naPaintDocs run on each attach, clear and status tick), so handlers bound to an element
// would be thrown away seconds after being attached and the second drop would silently do nothing.
//
// It also swallows file drags that MISS a zone. Without that, dropping a deck slightly off-target makes the
// browser navigate away from the page to render the PDF — losing a half-filled form.
let dropsBound = false;
export function initDropzones() {
  if (dropsBound || typeof document === 'undefined') return;
  dropsBound = true;
  const hasFiles = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
  const zoneOf = e => (e.target && e.target.closest) ? e.target.closest('[data-drop]') : null;
  let active = null;
  const lit = z => { if (z === active) return; if (active) active.classList.remove('is-drop'); active = z; if (z) z.classList.add('is-drop'); };

  document.addEventListener('dragover', e => {
    if (!hasFiles(e)) return;           // a text or element drag is none of our business
    e.preventDefault();                 // inside the document, never let the browser open the file
    const z = zoneOf(e);
    lit(z);
    if (e.dataTransfer) e.dataTransfer.dropEffect = z ? 'copy' : 'none';
  });
  // Leaving the window entirely reports no relatedTarget. Moving BETWEEN zones is already handled by
  // dragover, which fires continuously and re-evaluates the target.
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) lit(null); });
  document.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const z = zoneOf(e);
    lit(null);
    if (!z) return;
    const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
    const fn = typeof window !== 'undefined' && window[z.getAttribute('data-drop')];
    if (files.length && typeof fn === 'function') fn(files);
  });
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
// `multiline: true` renders a TEXTAREA rather than an input — for anything a person writes a SENTENCE into.
// A single-line <input> silently swallows Return and cannot be grown, so a note field built on one tells the
// operator "one line is all you get" without ever saying so. Resizable vertically; `rows` sets the start height.
export function formField(opts = {}) {
  const { label, value = '', placeholder = '', options, hint, optional, attr = '', id, type = 'text',
          multiline = false, rows = 3 } = opts;
  const idAttr = id ? ` id="${esc(id)}"` : '';
  const control = options
    ? `<div class="field-ctl"><select class="field-in field-sel"${idAttr}${attr}>${[
        ...(placeholder ? [{ v: '', l: placeholder }] : []),
        ...options.map(o => (typeof o === 'string' ? { v: o, l: o } : o))
      ].map(o => `<option value="${esc(o.v)}"${o.v === value ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select><span class="material-symbols-rounded field-chev">expand_more</span></div>`
    : multiline
      ? `<textarea class="field-in field-ta" rows="${Number(rows) || 3}"${idAttr}${attr} placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input class="field-in" type="${esc(type)}"${idAttr}${attr} value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  return `<label class="field">${label ? `<span class="field-lab">${esc(label)}${optional ? ' <span class="field-opt">optional</span>' : ''}</span>` : ''}${control}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`;
}

// gapUrlRow — ONE pointer. An operator closing a gap often has more than one: the register entry AND the
// filing that corroborates it, two officers, a page plus its PDF. Forcing one link per filing would make him
// file the same gap repeatedly, and each filing triggers a 25-minute re-score — so the product would be
// punishing him for having better evidence. Each row becomes its OWN operatorEvidence record: fetched
// independently, its own content-hash, its own provenance. The runner needs no change; it already iterates
// every record filed against the engagement.
export function gapUrlRow(value = '') {
  return `<div class="gap-url-row" data-url-row>
    <input class="field-in" type="url" value="${esc(value)}" placeholder="https://…" oninput="window.__gapDirty&&window.__gapDirty()">
    <button type="button" class="gap-url-rm" title="Remove this link" onclick="window.__gapRemoveUrl&&window.__gapRemoveUrl(this)"><span class="material-symbols-rounded">close</span></button>
  </div>`;
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

// ============================================================
// createScreen — TEMPLATE. Setting up an assessment, as a FULL PAGE rather than a side panel.
//
// WHY IT LEFT THE AUX PANEL. The standing rule was that setup happens end-to-end in the one panel and never
// hands off to a second page. The INTENT of that rule — one surface, no scattering — is kept exactly; only
// the mechanism changed, because the panel is ~390px at every viewport and the data-room read has become the
// centre of the product rather than a footnote to it. A 390px column cannot hold a form AND a live reading
// of what we can see, so the panel was deciding the product's shape.
//
// TWO COLUMNS, AND THE RIGHT ONE IS THE POINT. Left is what you type and attach. Right is what we can see,
// filling in live. It starts as roomPreview() — never blank, useful before a single byte is uploaded — and
// is replaced in place by the real roomCheck() the moment a room is read. That is why #na-room wraps the
// whole right column rather than sitting under the Drive field as it did in the panel.
//
// EVERY ELEMENT ID IS UNCHANGED from the panel (na-name … na-room, .na-actions, .na-form). The create /
// ingest / dispatch chain in workspace-m3.js is a working pipeline and is NOT re-implemented here — it is
// keyed on these ids, so it drives this layout untouched. Extend that chain additively; never fork it.
//
// opts: { operators:[{v,l}], cta:{primary,secondary}, stages }
// ============================================================
export function createScreen(opts = {}) {
  const { operators = [], cta = {}, stages = STAGES } = opts;
  const opList = operators.length ? operators : [{ v: '', l: 'No operators' }];
  // The handler is chosen by the action's id, so the two-button emphasis swap in
  // shared/entitlements.ctaPair() decides placement and this decides behaviour — neither knows the other's job.
  const handler = id => id === 'run_full' ? 'window.__wsCreateAssessment&&window.__wsCreateAssessment()'
    : id === 'run_prescreen' ? 'window.__wsRunPrescreen&&window.__wsRunPrescreen()'
    : 'window.__wsUnlock&&window.__wsUnlock()';
  // The duration rides WITH the button, not in a footnote beside the pair — a reader choosing between
  // two buttons reads the buttons.
  const btn = (a, variant) => a ? `<span class="na-run-wrap"><button class="m3-btn ${variant} na-run" type="button" disabled onclick="${handler(a.id)}"><span class="material-symbols-rounded">${esc(a.icon || 'play_arrow')}</span>${esc(a.label)}</button>${a.cost ? `<span class="na-run-cost">${esc(a.cost)}</span>` : ''}</span>` : '';

  return `<div class="na-screen na-form">
    <div class="na-main">
      <section class="na-block">
        <div class="na-block-h"><span class="eyebrow accent">The venture</span><span class="t">Who we are assessing</span></div>
        ${formField({ label: 'Venture name', id: 'na-name', placeholder: 'e.g. Verdana Bio', attr: ' autocomplete="off"' })}
        <div class="na-two">
          ${formField({ label: 'Founder', id: 'na-founder', placeholder: 'e.g. Jane Okafor', hint: 'Who the assessment is about — the agents diligence them by name', attr: ' autocomplete="off"' })}
          ${formField({ label: 'Founder email', id: 'na-founder-email', optional: true, type: 'email', placeholder: 'jane@acme.com', hint: 'Only needed to ask them for missing data-room documents' })}
        </div>
        <div class="na-two">
          ${formField({ label: 'Website', id: 'na-site', optional: true, type: 'url', placeholder: 'acme.com' })}
          ${formField({ label: 'Stage', id: 'na-stage', placeholder: 'Select stage', options: stages })}
        </div>
        ${formField({ label: 'Assessor', id: 'na-op', options: opList })}
      </section>

      <section class="na-block">
        <div class="na-block-h"><span class="eyebrow accent">The evidence</span><span class="t">What we read</span></div>
        <div class="na-sec">
          <span class="na-lab">Pitch deck <span class="na-hint">required</span></span>
          <div id="na-deck">${docDropzone([], { single: true, status: '', clearLabel: 'Replace', fileIcon: 'slideshow', icon: 'upload_file', prompt: 'Drop the pitch deck here', sub: 'PDF · the assessment runs from it.', note: 'Pitch deck · uploads when you run', onPick: "window.__naPick('deck')", onClear: 'window.__naClearDeck()', onDrop: '__naDropDeck' })}</div>
        </div>
        <div class="na-sec">
          <span class="na-lab">Data room <span class="field-opt">optional</span></span>
          <div id="na-docs">${docDropzone([], { status: '', icon: 'folder_open', prompt: 'Add data-room documents', sub: 'Financials, cap table, contracts, metrics — PDF, DOCX, XLSX, CSV, TXT, MD or ZIP.', note: 'Data room · uploads when you run', addLabel: 'Add more documents', onPick: "window.__naPick('docs')", onClear: 'window.__naClearDoc', onDrop: '__naDropDocs' })}</div>
          <div class="na-drive">
            <div class="na-drive-row">
              ${formField({ label: 'Or link a Google Drive folder', id: 'na-drive', optional: true, type: 'url', placeholder: 'https://drive.google.com/drive/folders/…', hint: 'Shared with anyone who has the link, or with dataroom-reader@ventrify-os.iam.gserviceaccount.com' })}
              <div class="na-drive-btns">
                <button class="m3-btn tonal na-drive-go" type="button" onclick="window.__naReadRoom()">Read data room</button>
                <button class="m3-btn text na-drive-again" type="button" onclick="window.__naCheckRoom()" hidden>Check for new files</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="na-prog" id="na-prog" hidden>
        ${linearProgress({ indeterminate: true })}
        <span class="na-prog-x" id="na-prog-x">Starting…</span>
      </div>

      <div class="na-actions">
        <span class="na-gate" id="na-gate">Attach a pitch deck to begin.</span>
        <div class="na-cta">${btn(cta.secondary, 'tonal')}${btn(cta.primary, 'filled')}</div>
      </div>
    </div>

    <aside class="na-side">
      <div class="na-side-in" id="na-room">${roomPreview({})}</div>
    </aside>
  </div>`;
}

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
// The GitHub job's own timeout (run-phase.yml `timeout-minutes: 180`). Past this the job HAS been killed —
// that is not an estimate, it is the contract. If nothing then updated Firestore, the run is an orphan and
// would otherwise sit on screen saying "running" forever. That is the one case a stall signal must catch.
// ONE CONTRACT with the runner's `timeout-minutes` (ventrify-engagement-runner .github/workflows/run-phase.yml).
// Raised 180 → 300 on 2026-09-22 with it: Opus 5's cold scoring draws take ~45-90 min each (≈20 on Opus 4.8),
// so a real run outgrew the old budget and GitHub killed it mid-scoring. If these two numbers ever disagree,
// the Workspace either cries "over-budget" at a healthy run or waits on one GitHub has already killed.
export const RUN_BUDGET_MIN = 300;

// SILENCE — how long since the runner last said anything. This is the honest health instrument.
//
// It replaces a total-age heuristic ("older than 45 minutes ⇒ probably stalled") that was simply the wrong
// measurement: a run that has been going 100 minutes is not stalled, it is BUSY. Real assess runs take ~2
// hours, so that rule fired on every healthy run and taught the operator to ignore the warning — which is
// worse than having no warning at all.
//
// The runner now beats every 2 minutes for its whole life (runstate.js startHeartbeat), so silence is
// finally meaningful: a live runner is never quiet for long, and a dead one is quiet forever.
export function runSilence(rs) {
  const t = rs && rs.beatAt;
  if (!t) return null;                       // legacy run, pre-heartbeat — silence is UNKNOWABLE, not zero
  const ms = Date.now() - new Date(t).getTime();
  return ms >= 0 ? ms : null;
}

// WHY a run is dead, or null if it is alive. The banner needs the reason, because the honest sentence is
// different in each case — and "this is taking longer than usual" is the one thing it is never allowed to
// say now, since a 2-hour run IS usual.
export function runStallReason(rs) {
  const s = (rs && rs.status) || '';
  if (s === 'queued') {
    const a = runAge(rs);
    return (a != null && a > 8 * 60000) ? 'never-picked-up' : null;
  }
  if (s !== 'running' && s !== 'partial') return null;

  // 1. HARD CEILING. Past the job budget the process cannot still be alive — GitHub killed it. This is not
  //    an estimate; it is the workflow's own timeout. Holds for runs that predate the heartbeat too.
  const age = runAge(rs);
  if (age != null && age > (RUN_BUDGET_MIN + 10) * 60000) return 'over-budget';

  // 2. NO HEARTBEAT. A live runner beats every 2 minutes. Fifteen minutes of nothing means the process is
  //    gone, whatever phase it last claimed to be in.
  //    NB the reason is 'runner-gone', NOT 'silent' — assess-running.html?state=silent already means the
  //    opposite thing (a run that has started and not yet reported, which is HEALTHY). One word, two
  //    meanings, one design system is how someone ships a bug in six months.
  const quiet = runSilence(rs);
  if (quiet == null) return null;    // no heartbeat to read → we do NOT know → say nothing. Never cry wolf
  return quiet > 15 * 60000 ? 'runner-gone' : null;   //                on a run we cannot actually measure.
}

export function runStalled(rs) { return runStallReason(rs) != null; }

const STALL_COPY = {
  'never-picked-up': 'No runner picked this up. Nothing has started, so nothing is lost — run it again.',
  'over-budget': `The run passed its ${RUN_BUDGET_MIN}-minute limit and was stopped. Anything it finished was saved; re-run to complete it.`,
  'runner-gone': 'The runner has stopped responding. Anything it finished was saved; re-run to complete it.',
};

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
  running: { kind: 'info', icon: 'autorenew', title: 'Assessing…', text: 'Eleven workstreams are researching, scoring and drafting the verdict from source. This takes a while — you can close the tab.', prog: true },
  partial: { kind: 'info', icon: 'autorenew', title: 'Assessing…', text: 'Research in progress — the score is forming.', prog: true },
  'needs-attention': { kind: 'warn', icon: 'warning', title: 'Needs attention', text: 'The run finished and saved, but the verdict needs a second look. Republish when ready.' },
  'limit-paused': { kind: 'warn', icon: 'pause_circle', title: 'Paused · usage limit', text: 'Resume when your window resets — it picks up where it left off.' },
  error: { kind: 'err', icon: 'error', title: 'Run failed', text: 'Something went wrong. Re-run the assessment — nothing is lost.' },
  done: { kind: 'ok', icon: 'task_alt', title: 'Verdict ready', text: 'The assessment is complete.' },
};
export function runBanner(rs = {}, opts = {}) {
  const s = RUN_BANNER[rs.status] || RUN_BANNER.queued;
  const isRepub = rs.phase === 'republish';              // republish reuses runState (3 steps) — don't dress it as a fresh assessment
  const isRescore = rs.phase === 'rescore';              // a re-score reuses it too (5 steps, no assess agent)
  const total = rs.totalSteps || 0, step = rs.step || 0;
  // ONE progress source, in order of truth. null → indeterminate.
  const pct = (typeof rs.progress === 'number' && total > 0) ? rs.progress
    : (total > 0 && step > 0) ? Math.round(step / total * 100)
    : null;
  const stallReason = runStallReason(rs);
  const stalled = stallReason != null;
  const elapsed = fmtElapsed(runAge(rs));
  const meta = [total > 0 && step > 0 ? `Step ${step} / ${total}` : '', elapsed].filter(Boolean).join(' · ');
  const title = s.prog ? (isRepub ? 'Republishing…' : isRescore ? 'Re-scoring…' : s.title) : s.title;
  const text = rs.label || (isRepub ? 'Recovering your saved results…'
    : isRescore ? 'Reading the records you filed, then scoring all 35 signals again from the evidence. The score may rise, fall, or hold.'
      : s.text);
  return `<div class="run-banner ${stalled ? 'warn' : s.kind}">
    <span class="rb-ic"><span class="material-symbols-rounded">${stalled ? 'warning' : s.icon}</span></span>
    <div class="rb-bd">
      <div class="rb-t">${esc(title)}${meta ? `<span class="rb-meta">${esc(meta)}</span>` : ''}</div>
      <div class="rb-x">${esc(text)}</div>
      ${s.prog ? linearProgress({ value: pct, style: 'margin-top:10px' }) : ''}
      ${rs.error ? `<div class="rb-warn">${esc(rs.error)}</div>` : ''}
      ${stalled ? `<div class="rb-warn">${esc(STALL_COPY[stallReason] || STALL_COPY.silent)}</div>
      <div class="rb-act"><button class="m3-btn text" onclick="${opts.onRerun || 'window.rerunAssessment&&window.rerunAssessment()'}"><span class="material-symbols-rounded">restart_alt</span>Re-run assessment</button></div>` : ''}
    </div>
  </div>`;
}

// ============================================================
// THE ASSESSING SCREEN — "the memo, before the ink lands".
// A run in flight is not a loading state: it is the assessment ITSELF, caught mid-formation. So this screen
// is the SAME editorial surface the finished verdict lives on (sectionHero → reading column → .sec/.rule
// rhythm), with the answer's placeholders sitting exactly where the answer will land. Nothing here is a
// status widget, and when the verdict arrives nothing MOVES — the placeholders simply resolve.
//
// THE HONESTY RULE, which the whole design rests on: the step NAMES are OURS (a fixed plan the runner always
// follows); only the POSITION comes from rs.step. We never invent a percentage, an ETA, or a finding.
// ============================================================

// ASSESS_PLAN — the ELEVEN workstreams the runner actually executes, transcribed from the real orchestration
// prompt (tools/cloud/prompts/assess-phase.md § "Orchestrate (write progress 1..11 … as you go)"). It is
// IDENTICAL for every assess run — which is precisely why rendering the plan up-front is a statement of fact
// rather than a guess, and why the operator can read the whole thing before it happens.
export const ASSESS_PLAN = [
  { n: 1, title: 'Produce the supporting deep research', out: 'research/ · market, competitors, demand & traction' },
  { n: 2, title: 'Pressure-test the founder’s claims', out: 'assessment/claims-validation.md' },
  { n: 3, title: 'Find the comparable rounds', out: 'assessment/comparables.md' },
  { n: 4, title: 'Benchmark the competition', out: 'assessment/competitive-benchmark.md' },
  { n: 5, title: 'Size the market — TAM / SAM / SOM', out: 'assessment/market-sizing.md' },
  { n: 6, title: 'Diligence the founders', out: 'assessment/team-diligence.md' },
  { n: 7, title: 'Write the investment analysis', out: 'assessment/investment-analysis.md' },
  { n: 8, title: 'Curate the evidence cards', out: '5–7 L1 cards, each traced to a source' },
  { n: 9, title: 'Draft the deal memo', out: 'assessment/deal-memo.md' },
  { n: 10, title: 'Score investability across 35 signals', out: 'sentiment/_score.json' },
  { n: 11, title: 'Say what would strengthen it', out: 'sentiment/_suggestions.json' },
];
// republish REUSES runState with its own 3-step shape — without this branch a seconds-long republish would
// render as a fresh eleven-step assessment.
export const REPUBLISH_PLAN = [
  { n: 1, title: 'Recovering your saved results', out: 'from the last completed run' },
  { n: 2, title: 'Re-applying the score, verdict & research', out: 'no AI cost' },
  { n: 3, title: 'Live again', out: '' },
];
// RESCORE_PLAN — the FIVE steps run-phase.js runRescore() actually executes, transcribed from it verbatim
// (step/totalSteps:5). NO ASSESS AGENT RUNS: the research prose is restored from the run's own evidence
// archive, the operator's records are fetched, and the 35 signals are scored again COLD. That is why it is
// ~25 minutes and not ~2 hours — and why the plan must not be dressed up as an eleven-step assessment.
export const RESCORE_PLAN = [
  { n: 1, title: 'Rebuild the founder’s room', out: 'the same deck and data room, byte-for-byte' },
  { n: 2, title: 'Restore the evidence this score was derived from', out: 'research/ + assessment/ from the run’s archive' },
  { n: 3, title: 'Retrieve the records you filed', out: 'fetched in the runner — the scorer cannot browse' },
  { n: 4, title: 'Score all 35 signals again — cold', out: '3 independent reads · median · quorum of 2' },
  { n: 5, title: 'Compute investability & publish', out: 'a new snapshot, on the record beside the old one' },
];
const runPlan = rs => (rs && rs.phase === 'republish') ? REPUBLISH_PLAN
  : (rs && rs.phase === 'rescore') ? RESCORE_PLAN : ASSESS_PLAN;
// clamp: rs.totalSteps is incoherent across a run (0 at queue → 8 at start → 11 once the agent reports), and
// the runner forces step back to its constant at the end — so an unclamped counter visibly runs BACKWARDS.
// The plan is the only trustworthy length.
const runStep = rs => { const p = runPlan(rs); return Math.min(Math.max(Number(rs && rs.step) || 0, 0), p.length); };

// canStopRun — the guard between the operator and a LYING Stop button. A run can only TRULY be stopped if we
// can name its GitHub Actions run (rs.githubRunId, written by the runner) or it hasn't been picked up yet.
// Until the runner reports its id this returns false and the control simply does not render: no dead button.
export function canStopRun(rs = {}) { return !!rs.githubRunId || rs.status === 'queued'; }

// formingLockup — MOLECULE. The score's EMPTY CHAIR: the word "Forming" sitting in the exact slot where
// `72/100` will land. There is no score mid-run (the runner computes it ONCE, at the end), so we show a calm
// word, never a growing number. Same lockup primitives as scoreLockup — it is a sibling, not a new family.
const RUN_CHIP = (rs, step, total) => {
  const s = rs.status;
  if (s === 'queued') return { icon: 'schedule', tone: 'mid', label: 'Queued' };
  if (s === 'limit-paused') return { icon: 'pause_circle', tone: 'mid', label: 'Paused · usage limit' };
  if (s === 'needs-attention') return { icon: 'warning', tone: 'bad', label: 'Needs attention' };
  if (s === 'error') return { icon: 'error', tone: 'bad', label: 'Run stopped reporting' };
  return step > 0
    ? { icon: 'autorenew', tone: 'mid', label: `Step ${step} of ${total}` }
    : { icon: 'autorenew', tone: 'mid', label: 'Working' };
};
export function formingLockup(rs = {}, ctx = {}) {
  const { signals = 35, docs = 0 } = ctx;
  const plan = runPlan(rs), total = plan.length, step = runStep(rs);
  // the bar: the runner's OWN progress, but ONLY once it has actually reported a step. `progress: 0` with
  // `step: 0` means "nothing reported yet", NOT "0% done" — rendering that as a determinate empty bar reads
  // as STUCK when the run is in fact working. No report → indeterminate. Never faked, never falsely still.
  const pct = (step > 0 && typeof rs.progress === 'number' && (rs.totalSteps || 0) > 0) ? rs.progress : null;
  const chip = RUN_CHIP(rs, step, total);
  const elapsed = fmtElapsed(runAge(rs));
  return `<div class="score-lockup forming-lockup">
    <span class="eyebrow accent">Investability score</span>
    <div class="lockup-num"><span class="lockup-forming">Forming</span></div>
    <span class="lockup-band ${chip.tone}"><span class="material-symbols-rounded">${chip.icon}</span>${esc(chip.label)}</span>
    ${linearProgress({ value: pct, style: 'margin-top:20px' })}
    <div class="lockup-cap"><span>${step > 0 ? `Step ${step} of ${total}` : 'Not yet reported'}</span><span>${esc(elapsed || 'just started')}</span></div>
    <div class="lockup-prov"><b>${total}</b> steps · <b>${signals}</b> signals to rate · <b>${docs}</b> document${docs === 1 ? '' : 's'} in evidence</div>
  </div>`;
}

// runSequence — ORGANISM. The run plan as a NUMBERED EDITORIAL LIST, in the memo's own `.must` voice (the
// idiom conditionsKill already uses for "what must be true"). The eleven workstreams are not events on a
// timeline — they are CHAPTERS of a memo being written, a table of contents filling in. Reusing `.must` means
// this costs a new CSS family of exactly ZERO, and the operator reads the plan in the assessment's own type.
export function runSequence(rs = {}) {
  const plan = runPlan(rs), step = runStep(rs);
  const silent = step === 0;                          // the agent has not reported yet — light NOTHING
  const rows = plan.map(p => {
    const state = silent ? 'pending' : p.n < step ? 'done' : p.n === step ? 'live' : 'pending';
    const live = state === 'live';
    return `<div class="must run-step ${state}">
      <span class="idx">${p.n}</span>
      <div class="bd">
        <p>${esc(p.title)}</p>
        ${live && rs.label ? `<div class="rs-say">${esc(rs.label)}</div>` : (p.out ? `<div class="rs-out">${esc(p.out)}</div>` : '')}
        ${live ? linearProgress({ indeterminate: true, style: 'margin-top:10px;max-width:220px' }) : ''}
      </div>
    </div>`;
  }).join('');
  // provenance, out loud: rs.step is the highest step the AGENT has CLAIMED — never verified completion.
  const meta = silent
    ? 'The runner has not reported a step yet — this is the plan it will follow'
    : 'Self-reported by the run · verified at publish';
  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">The sequence</span><span class="t">How the verdict gets written</span><span class="meta">${esc(meta)}</span></div>
    ${rows}
  </section>`;
}

// missingDocs — MOLECULE. Documents the operator HANDED OVER that never made it in. A dropped document used
// to live and die in a transient toast — so you could run an assessment believing the agents had read your
// cap table when it never arrived. That is a data-integrity fact, not a notification: it is persisted on the
// engagement (EA.ingestDocs) and shown until it is dealt with. Re-adding the document clears it automatically.
export function missingDocs(a = {}) {
  const miss = (((a.inputs || {}).skipped) || []).filter(x => x && x.name);
  if (!miss.length) return '';
  const n = miss.length;
  return `<div class="rs-missing">
    <div class="rs-missing-h"><span class="material-symbols-rounded">error</span>${n} document${n === 1 ? '' : 's'} didn’t make it in — the agents have <b>not</b> read ${n === 1 ? 'it' : 'them'}</div>
    ${miss.map(x => `<div class="rs-missing-row">
      <div class="rs-missing-bd"><div class="nm">${esc(x.name)}</div><div class="why">${esc(x.reason || 'Could not be read')}</div></div>
      <button class="m3-btn text" onclick="window.__eaDismissSkipped&&window.__eaDismissSkipped(this.dataset.n)" data-n="${esc(x.name)}">Dismiss</button>
    </div>`).join('')}
    <div class="rs-missing-f">Re-upload ${n === 1 ? 'it' : 'them'} via <b>Add data-room documents</b> — re-adding a document clears this automatically.</div>
  </div>`;
}

// inputManifest — ORGANISM. What the agents are actually reading, BY NAME. The most honest thing we can show
// during a run is the evidence the operator just handed over — and it is the one surface that makes the
// intervention loop real (see the wrong deck went in → Stop → replace it → Run). Capped at 8 named docs:
// a 65-row manifest is a filing cabinet, not a memo.
export function inputManifest(a = {}) {
  const inp = a.inputs || {};
  const docs = inp.docs || [];
  const total = inp.total || docs.length || 0;
  const shown = docs.slice(0, 8);
  const rows = [
    inp.deck ? srcRow({ icon: 'slideshow', title: inp.deck.name, note: 'Founder upload · the assessment runs from it', status: 'read' }) : '',
    ...shown.map(d => srcRow({
      icon: 'description', title: d.name,
      note: d.needsDeepRead ? 'Scanned — read directly by the agent' : (d.chars ? `${Number(d.chars).toLocaleString()} characters extracted` : 'Data room'),
      status: 'read',
    })),
  ].filter(Boolean).join('');
  // the workspace ingest path records a COUNT but no names (only the Studio brief carries names) — so say so,
  // rather than quietly under-reporting the evidence.
  const unnamed = Math.max(0, total - shown.length);
  const more = unnamed ? `<div class="rs-more">+${unnamed} more document${unnamed === 1 ? '' : 's'} ingested — uploaded in the workspace, so their names aren’t on the brief. The agents still read them.</div>` : '';

  const missing = missingDocs(a);

  return `<section class="sec">
    <div class="sec-head"><span class="eyebrow accent">Inputs</span><span class="t">What the agents are reading</span><span class="meta">${total} document${total === 1 ? '' : 's'} in evidence</span></div>
    <div class="src-docs">${rows}</div>${more}${missing}
  </section>`;
}

// assessingMemo — ORGANISM. The whole screen. The structural twin of verdictMemo: hero → the sequence → the
// inputs → the score forming (when a scaffold exists) → the dated arc → one true sentence. Consumed by BOTH
// the live assessment page and the DS example page, so there is exactly ONE definition of what an in-flight
// assessment looks like.
export function assessingMemo(a = {}, s = null, rs = {}) {
  const docs = (a.inputs && a.inputs.total) || 0;
  // A RE-SCORE is a different event and the screen must say so: it is not writing a fresh verdict, it is
  // reading the records the OPERATOR filed against our own misses and scoring the 35 signals again. The
  // thesis line is the honest one — it names the DOWN direction, before the operator sees the result.
  const rescore = rs && rs.phase === 'rescore';
  const filed = (a.filings || []).filter(f => f && f.status !== 'withdrawn').length;
  const hero = sectionHero({
    left: statementLockup({
      eyebrow: rescore ? 'Re-scoring on new evidence' : 'Under assessment',
      eyebrowIcon: rescore ? 'travel_explore' : 'hourglass_top',
      headline: rescore ? `${a.name} is being scored again — on what you filed.` : `A verdict on ${a.name} is being written.`,
      headlineEm: rescore ? 'on what you filed' : 'being written',
      facts: [
        { k: 'Venture', v: esc(a.stageLine || '—') },
        rescore
          ? { k: 'Evidence filed', v: `${filed} record${filed === 1 ? '' : 's'}` }
          : { k: 'Evidence in', v: `${docs} document${docs === 1 ? '' : 's'}` },
        { k: 'Running', v: esc(fmtElapsed(runAge(rs)) || 'just started') },
      ],
    }),
    right: formingLockup(rs, { docs }),
    thesisLabel: 'Coming back.',
    thesis: rescore
      ? 'Every one of the 35 signals, scored again from the evidence — including the records you filed. The score may rise, fall, or hold, and signals you did not file against can move too. The current score stays on the record either way.'
      : 'An investability score out of 100 across 35 signals, the case argued both ways, the pre-wire diligence checklist, and the research that underwrites every claim.',
  });
  // ⚠ gate on REAL categories, not on `s` being truthy — a brand-new assessment has NO investability
  // snapshot, so mapScore returns an object with an EMPTY categories array, and the composition then
  // divides by Math.max(...[]) === -Infinity and paints NaN all over the table. Omit the section entirely
  // rather than render a broken one.
  const hasScaffold = !!(s && Array.isArray(s.categories) && s.categories.length);
  const forming = hasScaffold
    ? `<hr class="rule">${investabilityComposition(s, 'openInvest', { title: 'The score, forming', eyebrow: 'Investability', meta: '0 of 35 signals rated — the run rates them at the end' })}`
    : '';
  const arc = (a.lifecycle && a.lifecycle.length)
    ? `<hr class="rule"><section class="sec">
      <div class="sec-head"><span class="eyebrow accent">The engagement</span><span class="t">Where this sits</span><span class="meta">Intake → decision</span></div>
      ${lifecycleStrip(a.lifecycle, { scale: 'editorial' })}
    </section>` : '';
  return `${hero}<hr class="rule">${runSequence(rs)}<hr class="rule">${inputManifest(a)}${forming}${arc}
    <p class="lead rs-coda">You can close this tab. The run continues in the cloud, and we’ll email you the moment the verdict lands.</p>`;
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
  /* EDITORIAL ROW, not a card. Each action used to be an `m3-card filled` — a filled
     tub with its own background — which stacked three heavy slabs down a page whose
     whole language is hairlines and type. The card bought nothing: these items are a
     LIST, and a list is held together by a rule between its rows, not by giving every
     row a container. The urgency tint survives on the icon tile, which is where it was
     doing the work anyway. */
  return `<div class="qitem ${item.urgency}"><div class="q-ic"><span class="material-symbols-rounded">${esc(item.icon)}</span></div>
    <div class="q-body"><div class="title-m">${esc(item.title)}</div><div class="body-m variant">${esc(body)}</div><div class="q-meta">${meta}</div></div>
    <div class="q-act">${primary}${secondary}</div></div>`;
}
export function queueGroupHead(urgency, items) { const m = UMETA[urgency]; const ct = items ? items.length : m.ct; return `<div class="group-head"><span class="title-l">${m.title}</span><span class="variant">· ${ct}</span></div><div class="group-sub">${m.sub}</div>`; }
// queueBoard — the whole Action-queue body: urgency groups (counts derived from the data). opts.emptyCta =
// {label, icon, onclick} adds a call-to-action to the all-clear card; opts.emptyTitle/emptyText override its copy.
export function queueBoard(items = [], opts = {}) {
  const cta = opts.emptyCta ? `<div style="margin-top:20px"><button class="m3-btn filled" onclick="${opts.emptyCta.onclick || ''}">${opts.emptyCta.icon ? `<span class="material-symbols-rounded">${esc(opts.emptyCta.icon)}</span>` : ''}${esc(opts.emptyCta.label)}</button></div>` : '';
  /* Editorial, like every other empty state. This was a filled tub with inline
     centring — found by tools/surface-audit.mjs, which drives the queue into its
     EMPTY branch; nothing had ever rendered it, because the demo fixture always
     has actions. */
  const allClear = emptyState({ title: opts.emptyTitle || "You're all caught up", text: opts.emptyText || 'Nothing needs you right now.', ctaHtml: cta });
  const groups = ['high', 'med', 'low'].map(u => {
    const g = items.filter(i => i.urgency === u);
    if (!g.length) return '';
    return queueGroupHead(u, g) + g.map(queueItem).join('');
  }).filter(Boolean);
  return groups.length ? groups.join('') : allClear;
}

/* trackDrillMasthead — publish the drill masthead's LIVE height as --drill-mh-h.
   The sticky rail parks directly beneath it, and the masthead's height is not a constant:
   it animates from ~209px to ~115px as --mh-p runs 0→1. Reading it once would leave the
   rail either overlapped at rest or floating low when minified, and hardcoding the
   minified height would break the first time the masthead gains or loses a row.
   ResizeObserver fires through the whole transition, so the rail tracks it continuously. */
function trackDrillMasthead(surf) { trackMastheadHeight(surf, '--drill-mh-h'); }

/* trackMastheadHeight — the same measurement, for ANY surface with a sticky masthead.
   The drill solved this for its own rail and nothing else got it: the create screen's live data-room
   panel is `position: sticky; top: 24px` under a masthead up to 209px tall, so the panel the operator
   is meant to WATCH while attaching documents sat 272px underneath it. Measured, not guessed.
   `var` lets a caller publish under a different name; the drill keeps its own so the two rails cannot
   fight over one value when a drill is open. */
function trackMastheadHeight(surf, varName = '--mh-h') {
  const mh = surf.querySelector(':scope > .masthead') || surf.querySelector('.masthead');
  if (!mh || typeof ResizeObserver === 'undefined') return;
  const key = '__mhRO' + varName;
  if (surf[key]) surf[key].disconnect();
  const set = () => surf.style.setProperty(varName, `${Math.round(mh.getBoundingClientRect().height)}px`);
  set();
  const ro = new ResizeObserver(set);
  ro.observe(mh);
  surf[key] = ro;
}

// wireMinify — bind ONE masthead to its nearest scroll ancestor. Idempotent (safe to call again on a
// masthead created after initShell, e.g. the drill's). Drives --mh-p 0→1 as content scrolls under it.
function wireMinify(mh) {
  if (!mh || mh.__mhWired) return;
  mh.__mhWired = true;
  // Same question revealLive asks — "what actually scrolls here" — so it has one answer, in scrollParent.
  const target = scrollParent(mh);
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

  // masthead: scroll-linked minify — drives --mh-p (0→1) continuously as content scrolls under it.
  // Idempotent + reusable: the drill's masthead is created after initShell, so openDrill() calls it too.
  document.querySelectorAll('.masthead').forEach(wireMinify);
  // Publish the MAIN masthead's live height as --mh-h on .shell-main, so any sticky surface beneath it
  // can park clear of it instead of sliding underneath. The drill rail has had this since it was built;
  // the create screen's live data-room panel never did, and sat 272px behind the masthead.
  const mainSurf = document.querySelector('.shell-main');
  if (mainSurf) trackMastheadHeight(mainSurf, '--mh-h');

  // ---- auxiliary panel API ----
  // the two "no room to push an aux" breakpoints, mirroring theme.css
  const mqAuxPush = window.matchMedia('(max-width: 900px)');        // default 440px panel
  const mqAuxPushWide = window.matchMedia('(max-width: 1679px)');   // wide 720px panel
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
    app.classList.remove('aux-push', 'aux-modal', 'aux-wide');
    // size: 'wide' → the 720px reading panel (see .m3-app.aux-wide in theme.css). Any panel may
    // ask for it; only content with a reading measure should.
    if (opts.size === 'wide') app.classList.add('aux-wide');
    app.classList.add('aux-open', opts.mode === 'overlay' ? 'aux-modal' : 'aux-push');
    // the category drill carries its own bars — same moment, same motion
    playCharts(app.querySelector(".aux-body")); normaliseIcons(app.querySelector(".aux-body"));
    // A panel that FLOATS is modal however it got there — narrow viewport, an explicit overlay,
    // or a wide panel with no room to push. This mirrors the two "no room to push" media queries
    // in theme.css rather than reading the layout back, because a custom property's computed value
    // is an UNEVALUATED token string: --aux-w reads as "min(720px, calc(100vw - 72px))", so it
    // cannot be measured with parseFloat. Same idiom as mqSplit for the drill.
    const aux = app.querySelector('.m3-aux');
    const noRoomToPush = (opts.size === 'wide' ? mqAuxPushWide : mqAuxPush).matches;
    const floating = opts.mode === 'overlay' || mqCompact.matches || noRoomToPush;
    // ONE class for "this panel is floating, not pushing". theme.css used to say that three
    // separate ways (the 900px fallback, the wide 1680px fallback, and .aux-modal) and each had
    // to re-state the scrim on its own; now they only decide the WIDTH and this decides the
    // BEHAVIOUR — scrim up, chrome beneath it, dialog semantics.
    app.classList.toggle('aux-floating', floating);
    if (floating) {
      lastFocused = lastFocused || document.activeElement;
      document.body.classList.add('overlay-lock');
      if (aux) { aux.setAttribute('role', 'dialog'); aux.setAttribute('aria-modal', 'true'); const c = aux.querySelector('.aux-close'); if (c) c.focus(); }
    } else if (aux) {
      aux.removeAttribute('role'); aux.removeAttribute('aria-modal');
    }
  };
  window.closeAux = () => {
    const app = document.querySelector('.m3-app'); if (!app) return;
    app.classList.remove('aux-open', 'aux-push', 'aux-modal', 'aux-wide', 'aux-floating');
    const a = app.querySelector('.m3-aux'); if (a) { a.removeAttribute('role'); a.removeAttribute('aria-modal'); }
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
    /* ⚠ THE PRIMARY IS NOW COVERED AT EVERY WIDTH. It used to stay visible beside the
       drill above 1080px — a "live compact master index" — and the split kept it live so
       Tab could flow between the two pages. That index is gone: the drill is full-bleed
       and the sibling list moved into its rail. An element nobody can see must not be in
       the tab order or the a11y tree, so the covered branch now applies unconditionally
       and the width check only decides how loudly we say it is modal. */
    primary.classList.add('is-compact');
    primary.setAttribute('inert', ''); primary.setAttribute('aria-hidden', 'true');
    document.body.classList.add('overlay-lock');
    surf.setAttribute('role', 'dialog'); surf.setAttribute('aria-modal', 'true');
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
    trackDrillMasthead(surf);

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

  // The aux width fallbacks live in CSS so they track a resize on their own, but .aux-floating is
  // set once at open time — so an open panel that crosses its breakpoint has to be re-synced, or
  // it keeps a scrim it no longer needs (or loses one it does). Mirrors the two media queries in
  // theme.css: 900px for the default panel, 1680px for the wide one.
  [mqAuxPush, mqAuxPushWide].forEach(mq => mq.addEventListener('change', () => {
    const app = app0(); if (!app || !app.classList.contains('aux-open')) return;
    const aux = app.querySelector('.m3-aux');
    const floats = app.classList.contains('aux-modal') || mqCompact.matches
      || (app.classList.contains('aux-wide') ? mqAuxPushWide.matches : mqAuxPush.matches);
    app.classList.toggle('aux-floating', floats);
    if (aux) {
      if (floats) { aux.setAttribute('role', 'dialog'); aux.setAttribute('aria-modal', 'true'); document.body.classList.add('overlay-lock'); }
      else { aux.removeAttribute('role'); aux.removeAttribute('aria-modal');
             if (!app.classList.contains('nav-open') && !app.classList.contains('drill-open')) document.body.classList.remove('overlay-lock'); }
    }
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

  /* Draw the graphs in on first paint. On a tabbed page this resolves to the panel
     that is already active and initTabs re-fires it a moment later — harmless, the
     class just restarts. On Portfolio / Setup / Running, which have no tabs, this is
     the only thing that runs it. */
  initTips();
  requestAnimationFrame(() => {
    playCharts(); normaliseIcons();
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   ICON ACCESSIBILITY — one pass, because the problem is 87 call sites deep.

   A Material Symbols icon is a LIGATURE: the element's text content is the
   literal token, and the font draws a glyph over it. A screen reader does not
   see the glyph — it reads the token. Measured on the Team tab before this
   existed, the bench announced itself as:

       "SEATS NOBODY IS IN · 5 to hire · person_add · person_add · person_add…"

   and across one page 86 of 87 icons were read aloud that way.

   Fixing it at every call site means editing 87 template literals and hoping
   the 88th remembers. So new code uses icon() below — correct at source — and
   this pass normalises everything already rendered, including anything a future
   component forgets. It is idempotent and runs after each render.

   The rule it applies is the standard one, and the two branches are not
   interchangeable:
     · an icon that is the ONLY content of a control is that control's NAME →
       it needs a label, and hiding it would leave the button silent;
     · every other icon sits beside text that already says the same thing →
       aria-hidden, or the label is announced twice.
   ════════════════════════════════════════════════════════════════════════════ */
const ICON_WORDS = s => String(s).trim().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
export function normaliseIcons(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.material-symbols-rounded:not([data-a11y])').forEach(el => {
    el.setAttribute('data-a11y', '1');                       // idempotent: never processed twice
    const host = el.parentElement;
    const alone = host && !host.innerText.replace(el.textContent, '').trim();
    // does anything in the first few ancestors already name this control?
    let named = false;
    for (let n = host, i = 0; n && i < 3; n = n.parentElement, i++) {
      if (n.getAttribute('aria-label') || n.getAttribute('title') || n.querySelector('.sr-only')) { named = true; break; }
    }
    const control = host && (host.matches('button, a, [role="button"], [role="tab"], [tabindex]'));
    if (alone && control && !named) {
      // the glyph IS the button's name. Humanising the ligature is imperfect, but an
      // imperfect name beats an unlabelled control, and a real label here always wins.
      host.setAttribute('aria-label', ICON_WORDS(el.textContent));
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.setAttribute('aria-hidden', 'true');
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   TOOLTIPS — one implementation, every chart mark that has something to say.

   A chart mark is necessarily terse: a seat in the bench is a 40px outline, a
   cell in the clearance grid is one glyph. Both stand for something with a
   name and a paragraph behind it, and until now that paragraph was only
   reachable by scrolling to the list below. Hovering the mark should just
   tell you.

   WHY NOT THE NATIVE `title`. It waits about a second, cannot be styled or
   wrapped, shows nothing on touch, and renders one unbroken line — a 200-char
   diligence note becomes a stripe across the screen. The grid shipped with
   `title` as a stopgap; this replaces it.

   HOW IT WORKS. One floating element on <body>, positioned fixed, driven by
   DELEGATED listeners — so a mark rendered later (a tab panel, the aux drill,
   a re-render after a run) is covered with no re-wiring and no leaked handlers.

   a11y. The tip is aria-hidden and purely a pointer affordance. The marks are
   deliberately NOT in the tab order and the chart keeps its role="img" summary,
   because the authoritative copy of this content — every gap, every check, with
   its full note — is the list that sits directly beneath the hero. Adding nine
   to thirty duplicate tab stops above it would make keyboard navigation worse,
   not better, so the keyboard path is the list, and this is the shortcut.
   ════════════════════════════════════════════════════════════════════════════ */
let _tipEl = null, _tipFor = null;
function _tip() {
  if (_tipEl && document.body.contains(_tipEl)) return _tipEl;
  _tipEl = document.createElement('div');
  _tipEl.className = 'm3-tip';
  _tipEl.setAttribute('aria-hidden', 'true');   // decorative: the same text is in the list below
  document.body.appendChild(_tipEl);
  return _tipEl;
}
function _hideTip() { if (_tipEl) _tipEl.classList.remove('on'); _tipFor = null; }
function _showTip(host) {
  const body = host.getAttribute('data-tip');
  if (!body) return;
  const el = _tip(), title = host.getAttribute('data-tip-title'), kind = host.getAttribute('data-tip-kind');
  el.className = 'm3-tip' + (kind ? ' ' + kind : '');
  el.innerHTML = `${title ? `<b>${esc(title)}</b>` : ''}<span>${esc(body)}</span>`;
  el.classList.add('on');
  _tipFor = host;
  // measured AFTER the content is in, because the height depends on how the text wrapped
  const h = host.getBoundingClientRect(), t = el.getBoundingClientRect();
  const GAP = 10, EDGE = 8;
  let top = h.top - t.height - GAP;
  el.classList.toggle('below', top < EDGE);
  if (top < EDGE) top = h.bottom + GAP;                              // flip under the mark
  let left = h.left + h.width / 2 - t.width / 2;
  left = Math.max(EDGE, Math.min(left, window.innerWidth - t.width - EDGE));   // clamp to viewport
  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
  // the arrow tracks the mark even once the body has been clamped away from it
  el.style.setProperty('--tip-x', `${Math.round(h.left + h.width / 2 - left)}px`);
}
export function initTips() {
  if (window.__tipsOn) return;            // idempotent: initShell may run twice on a re-mount
  window.__tipsOn = true;
  const host = e => e.target && e.target.closest && e.target.closest('[data-tip]');
  document.addEventListener('mouseover', e => { const h = host(e); if (h && h !== _tipFor) _showTip(h); });
  document.addEventListener('mouseout', e => { const h = host(e); if (h && h === _tipFor && !h.contains(e.relatedTarget)) _hideTip(); });
  document.addEventListener('focusin', e => { const h = host(e); if (h) _showTip(h); else _hideTip(); });
  // touch: tap the mark to show, tap anywhere else to dismiss
  document.addEventListener('click', e => { const h = host(e); if (h) { h === _tipFor ? _hideTip() : _showTip(h); } else _hideTip(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _hideTip(); });
  // a fixed tip would drift away from its mark on scroll, so it goes rather than follows
  window.addEventListener('scroll', _hideTip, true);
  // ⚠ resize REPOSITIONS, it does not dismiss. Hiding here looked harmless and was not: a resize
  // fires for things the pointer knows nothing about — a mobile URL bar collapsing, a devtools
  // dock, a window snap — and the tip would vanish while the cursor had never left the mark.
  // (It also made the tooltip impossible to screenshot, which is how this surfaced.)
  window.addEventListener('resize', () => {
    if (_tipFor && document.body.contains(_tipFor)) _showTip(_tipFor); else _hideTip();
  });
}

/* tipAttrs — the ONE way a component marks something as having a tooltip, so the attribute
   names live in a single place rather than being spelled out at each call site. */
export function tipAttrs(tip) {
  if (!tip || !tip.body) return '';
  return ` data-tip="${esc(tip.body)}"${tip.title ? ` data-tip-title="${esc(tip.title)}"` : ''}${tip.kind ? ` data-tip-kind="${esc(tip.kind)}"` : ''}`;
}

/* icon — the ONE way new components emit a Material Symbol. Always aria-hidden, because a
   decorative glyph beside text is the overwhelmingly common case; anything that needs a name
   pairs it with srOnly() rather than letting the ligature leak through as the name. */
export const icon = (name, cls = '') =>
  `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${esc(name)}</span>`;
/* srOnly — visible to assistive tech, not to the eye. `.sr-only` lives in theme.css. */
export const srOnly = text => `<span class="sr-only">${esc(text)}</span>`;

// ---- tab switching for masthead .m3-tabs ↔ .tab-panel (call once after render) ----
// opts.names: slug per tab (e.g. ['verdict','investability',...]) enables #hash deep-linking
// so a back-link like assess.html#research lands on the right tab.
/* playCharts — run the chart entrance animation on a region that has just become
   visible. See the CHART ENTRANCE MOTION block in ds.css for the choreography.

   WHY A FUNCTION AND NOT JUST CSS. Tab panels are display:none when inactive, and
   a CSS animation on a hidden element has already finished by the time anyone sees
   it; re-showing the panel does not reliably replay it. So the class comes off, the
   layout is flushed, and the class goes back on — the standard restart, and the only
   reason this needs script at all.

   It also numbers the staggered groups. --i is the item's index within its own
   parent, so a 7-row table and a 40-row one both stagger correctly and neither has
   to know its length at render time. Capped in the CSS, not here.

   Safe to call on anything: with no marks inside, it sets a class and returns. */
const CH_STAGGER = ['.mrow', '.bd-r', '.segrow i', '.conv i', '.profile-strip .seg', '.vz-axis i', '.vz-axis span', '.sigtier', '.sigtier-row b', '.lockup-prov .unit', '.ugrid i', '.ug-leg .ug-k'];
export function playCharts(root) {
  const host = (root && root.nodeType === 1)
    ? root
    : (document.querySelector('.tab-panel.active') || document.querySelector('.shell-body') || document.body);
  if (!host) return;
  CH_STAGGER.forEach(sel => {
    const byParent = new Map();
    host.querySelectorAll(sel).forEach(el => {
      const arr = byParent.get(el.parentElement) || [];
      arr.push(el); byParent.set(el.parentElement, arr);
    });
    byParent.forEach(arr => arr.forEach((el, i) => el.style.setProperty('--i', i)));
  });
  // the bar lives inside .mrow-bar but the stagger index is on the row — hand it down
  host.querySelectorAll('.mrow').forEach(r => {
    const i = r.style.getPropertyValue('--i');
    r.querySelectorAll('.mrow-bar > *').forEach(b => b.style.setProperty('--i', i));
  });
  // the bench staggers on TWO axes: which tier, then which pill inside it. The pills already
  // carry their own --i from the pass above; this hands each tier's index down as --tier so a
  // pill's delay is (its tier) + (its place in that tier), and the three bands arrive in order.
  host.querySelectorAll('.sigtier').forEach(t => {
    const i = t.style.getPropertyValue('--i');
    const h = t.querySelector('.sigtier-h');
    if (h) h.style.setProperty('--i', i);
    t.querySelectorAll('.sigtier-row b').forEach(b => b.style.setProperty('--tier', i));
  });
  host.classList.remove('charts-in');
  void host.offsetWidth;                 // flush, so the animations restart rather than resume
  host.classList.add('charts-in');
}

export function initTabs(opts = {}) {
  const tablist = document.querySelector('.m3-tabs');
  const tabEls = tablist ? [...tablist.querySelectorAll('.m3-tab')] : [];
  const panels = [...document.querySelectorAll('.tab-panel')];
  if (!tabEls.length || !panels.length) return;
  const names = opts.names || [];
  const select = i => {
    tabEls.forEach((t, n) => { t.classList.toggle('active', n === i); t.setAttribute('aria-selected', n === i); });
    panels.forEach((p, n) => p.classList.toggle('active', n === i));
    playCharts(panels[i]); normaliseIcons(panels[i]);   // graphs draw in, and any icon this panel rendered gets named
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

// ═════════════════════════════════════════════════════════════════════════════════════════════════════
// PRE-SCREEN v2 — the flavour, not the audit.
//
// Spec: design/prescreen-v2-spec.md. These components replace rangeHero / rangeLockup / rangeFindings /
// rangeCoverage, which rendered a score built by reading documents and reported, in effect, how complete
// a data room was. v2 renders a VERDICT on whether the venture is worth assessing, plus the findings
// that earned it — and every finding on screen has already been verified in code against the source it
// cites (§8.1), so nothing here needs to hedge.
//
// THE VOCABULARY IS LOAD-BEARING. tools/prescreen-vocabulary.mjs fails the build if "missing", "not
// provided", "no evidence of" or "incomplete" appear in these components. That language belongs in the
// coverage panel and nowhere else (§3.4), and it is how a readiness verdict quietly decays back into a
// completeness score six months after everyone has forgotten the argument.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════

// The three bands, and what each one is allowed to say. NOT a quality verdict: we have only read
// documents, never met the team or used the product (§2). None of these three sentences mentions a
// document, and none of them may.
const PS2_BANDS = {
  HIGH:   { label: 'High',   tone: 'good', deg: 142, line: 'Worth assessing now.' },
  MEDIUM: { label: 'Medium', tone: 'mid',  deg: 0,   line: 'Real signal, with things to resolve.' },
  LOW:    { label: 'Low',    tone: 'warn', deg: -142, line: 'The case needs work before it is worth the full read.' },
};

/**
 * verdictDial — ATOM. The band as a dial, because a number invites arithmetic and a band invites a
 * decision.
 *
 * v1 published a range: two numbers off a one-minute read, implying a resolution we do not have. Three
 * bands are honest about the resolution AND easier to validate — ordinal agreement with the full
 * assessment is a far lower bar than numerical containment, and that is what the calibration gate
 * measures.
 */
export function verdictDial(band, opts = {}) {
  const b = PS2_BANDS[band];
  if (!b) {
    // §3.3 — "we couldn't tell" is NOT the bottom band. It is off the dial entirely, because an
    // unreadable submission is not a verdict on a venture.
    return `<div class="vd vd-none"><div class="vd-face"><span class="material-symbols-rounded">help</span></div>
      <div class="vd-lab">Not enough to read yet</div></div>`;
  }
  const ticks = Object.entries(PS2_BANDS).map(([k, v]) =>
    `<span class="vd-tick${k === band ? ' on' : ''}" style="--d:${v.deg}deg"></span>`).join('');
  return `<div class="vd" data-tone="${b.tone}">
    <div class="vd-face">
      ${ticks}
      <span class="vd-needle" style="--d:${b.deg}deg"></span>
      <span class="vd-hub"></span>
    </div>
    <div class="vd-lab">${esc(b.label)}</div>
    <div class="vd-sub">${esc(b.line)}</div>
    ${opts.basis ? `<div class="vd-basis">${esc(opts.basis)}</div>` : ''}
  </div>`;
}

/**
 * verdictHero — ORGANISM. What opens a pre-screened assessment.
 *
 * The headline is the REASON, not the band — the band is already on the dial beside it, and a headline
 * that repeats it wastes the one line a reader is guaranteed to take in. The basis line is separate and
 * deliberately plain: it discloses what we read from and never apologises for it (§3.2).
 */
export function verdictHero(snapshot = {}, opts = {}) {
  const { band = null, reason = '', basis = '', brief = {}, sources = [] } = snapshot;
  const unreadable = snapshot.state === 'unreadable' || !band;
  return sectionHero({
    eyebrow: 'Pre-screen', eyebrowIcon: 'bolt',
    headline: unreadable
      ? 'There isn’t enough here for us to say anything useful yet.'
      : fitHeadline(reason || PS2_BANDS[band].line),
    facts: [
      { k: 'Read from', v: `${snapshot.docCount || 0} document${snapshot.docCount === 1 ? '' : 's'}` },
      { k: 'Public sources', v: sources.length ? String(sources.length) : '—' },
      ...(snapshot.briefEdited ? [{ k: 'Your corrections', v: 'applied' }] : []),
    ],
    right: verdictDial(band, { basis }),
    thesisLabel: 'What this is.',
    thesis: unreadable
      ? 'A pre-screen reads what a venture says about itself and then goes looking for what it does not say. There is too little here to do either yet — add the deck and we will take another look, and it will not count against your free pre-screen.'
      : (brief.oneLine
          ? `${esc(brief.oneLine)} This verdict is about whether that case is worth a full assessment’s time — not about whether the business is good. We have read documents, not met the team.`
          : 'This verdict is about whether the case is worth a full assessment’s time — not about whether the business is good. We have read documents, not met the team.'),
  });
}

/**
 * briefPlayback — ORGANISM. "Here is what we understood your venture to be."
 *
 * THE GUARDRAIL AND THE WOW ARE THE SAME COMPONENT (§8.2). Everything downstream reasons from this brief
 * and nothing else, so if it is wrong — wrong sector, wrong model — every finding below will be
 * confidently about the wrong company and will look perfect. The customer is the only validator who
 * knows in two seconds, so it goes first, and they can fix it.
 *
 * A corrected field is CUSTOMER-ASSERTED and marked as such, here and on every export (§8.8). It has no
 * document behind it to verify against, and an unmarked unverifiable claim in something carrying our
 * name is the thing this product cannot afford.
 */
export function briefPlayback(brief = {}, opts = {}) {
  const asserted = new Set(opts.asserted || []);
  const FIELDS = [
    ['oneLine', 'What it does'], ['sector', 'Sector'], ['businessModel', 'Business model'],
    ['stage', 'Stage'], ['geography', 'Where'], ['marketClaim', 'Market it claims'], ['ask', 'The ask'],
  ];
  const rows = FIELDS.filter(([k]) => String(brief[k] || '').trim()).map(([k, label]) => `
    <div class="bpb-r${asserted.has(k) ? ' said' : ''}" data-field="${k}">
      <div class="bpb-k">${esc(label)}</div>
      <div class="bpb-v">${esc(brief[k])}${asserted.has(k)
        ? '<span class="bpb-mark" title="You told us this. We have not checked it against a document.">your correction</span>' : ''}</div>
    </div>`).join('');
  const canEdit = opts.editable && (opts.editsLeft == null || opts.editsLeft > 0);
  return `<section class="sec bpb">
    <div class="s-label"><span class="material-symbols-rounded">summarize</span>What we understood</div>
    <h2 class="s-h">Here’s what we read your venture to be</h2>
    <p class="s-sub">Everything below this is reasoned from this summary. If it’s wrong, correct it — the read is only as good as this.</p>
    <div class="bpb-grid">${rows}</div>
    ${(brief.team || []).length ? `<div class="bpb-team">${(brief.team || []).slice(0, 6).map(t =>
      `<span class="bpb-p"><b>${esc(t.name)}</b>${t.background ? ' — ' + esc(t.background) : ''}</span>`).join('')}</div>` : ''}
    ${canEdit ? `<div class="bpb-act">
      <button class="m3-btn tonal" type="button" onclick="window.__ps2Correct&&window.__ps2Correct()">
        <span class="material-symbols-rounded">edit</span>That’s not quite right
      </button>
      <span class="bpb-note">Correcting this re-runs the read on your version. It doesn’t use up your free pre-screen${
        opts.editsLeft != null ? `, and you have ${opts.editsLeft} correction${opts.editsLeft === 1 ? '' : 's'} left` : ''}.</span>
    </div>` : ''}
  </section>`;
}

// What each findings card is called on screen, and the one line under its heading. The `tension` card is
// absent on a deck-only run by design — one document cannot contradict itself across documents (§4).
const PS2_NUGGETS = {
  thesis:      { icon: 'target',     title: 'The bet',            sub: 'What has to be true for this to work.' },
  bull:        { icon: 'trending_up',title: 'The case for',        sub: 'How an investor who wants to back it would argue.' },
  bear:        { icon: 'trending_down', title: 'The case against', sub: 'How it will be argued in the room the founder isn’t in.' },
  competitive: { icon: 'travel_explore', title: 'Who else is doing this', sub: 'From public sources, not from the deck.' },
  team:        { icon: 'groups',     title: 'The team against the problem', sub: 'Fit, and what’s conspicuously absent.' },
  tension:     { icon: 'compare_arrows', title: 'Where the documents disagree', sub: 'Both sides, quoted.' },
};

/**
 * nuggetCard — MOLECULE. One finding set, with its provenance attached.
 *
 * EVERY POINT HERE HAS ALREADY BEEN VERIFIED (§8.1) — an external point's span was matched character for
 * character against the page it cites, and an internal one against the document. So the citation is a
 * link the reader can follow rather than a claim they have to take on trust, and an empty card is a
 * truthful outcome rather than a rendering failure (§8.5).
 */
export function nuggetCard(kind, data = {}) {
  const meta = PS2_NUGGETS[kind];
  if (!meta) return '';
  const points = data.points || [];
  const body = points.length
    ? `<ul class="ng-l">${points.map(p => `<li class="ng-i${p.external ? ' ext' : ''}">
        <span class="ng-t">${esc(p.point)}</span>
        ${p.external && p.source
          ? `<a class="ng-src" href="${esc(p.source.url)}" target="_blank" rel="noopener noreferrer"
               title="${esc(p.quotedSpan || '')}"><span class="material-symbols-rounded">open_in_new</span>${esc(p.source.title || 'source')}</a>`
          : (p.docName ? `<span class="ng-src doc" title="${esc(p.quotedSpan || '')}">
               <span class="material-symbols-rounded">description</span>${esc(p.docName)}</span>` : '')}
      </li>`).join('')}</ul>`
    : `<p class="ng-empty">${esc(
        data.skipped === 'needs_two_documents'
          ? 'This one compares your documents against each other, so it needs more than the deck.'
          : kind === 'competitive'
            ? 'We couldn’t find comparable players in public sources for this one.'
            : 'Nothing here we could stand behind.')}</p>`;
  return `<article class="ng" data-kind="${kind}"${points.length ? '' : ' data-empty="1"'}>
    <div class="ng-h"><span class="material-symbols-rounded">${meta.icon}</span>
      <div><div class="ng-ti">${esc(meta.title)}</div><div class="ng-sub">${esc(meta.sub)}</div></div></div>
    ${body}
  </article>`;
}

/**
 * verdictFindings — ORGANISM. All six cards, in reveal order.
 *
 * `pending` draws a card as still-thinking rather than as empty, which is what makes the progressive
 * reveal read as an analyst working rather than as a page with holes in it (§6.5).
 */
export function verdictFindings(nuggets = {}, opts = {}) {
  const order = ['thesis', 'bull', 'bear', 'competitive', 'team', 'tension'];
  const pending = new Set(opts.pending || []);
  const cards = order.map(k => {
    if (pending.has(k)) {
      const meta = PS2_NUGGETS[k];
      return `<article class="ng is-wait" data-kind="${k}">
        <div class="ng-h"><span class="material-symbols-rounded">${meta.icon}</span>
          <div><div class="ng-ti">${esc(meta.title)}</div><div class="ng-sub">${esc(meta.sub)}</div></div></div>
        <div class="ng-wait"><span></span><span></span><span></span></div></article>`;
    }
    return nuggets[k] ? nuggetCard(k, nuggets[k]) : '';
  }).filter(Boolean).join('');
  return `<section class="sec vf">
    <div class="s-label"><span class="material-symbols-rounded">lightbulb</span>What we found</div>
    <h2 class="s-h">Argued both ways</h2>
    <p class="s-sub">Every point below cites the page or document it rests on. Anything we couldn’t stand behind isn’t here.</p>
    <div class="vf-grid">${cards}</div>
  </section>`;
}

/**
 * verdictNext — ORGANISM. The conversion surface, and the only one.
 *
 * It must be EARNED by the six cards above it, and its three items are drawn from what this run actually
 * found — never a template. A generic "upgrade to find out more" after six specific findings reads as a
 * bait-and-switch, which is the one thing that would undo the trust the rest of the page just built.
 */
export function verdictNext(snapshot = {}) {
  const tests = (snapshot.nextTests || []).filter(t => String(t || '').trim()).slice(0, 3);
  if (!tests.length) return '';
  return `<section class="sec vn">
    <div class="s-label"><span class="material-symbols-rounded">science</span>What the full assessment would test</div>
    <h2 class="s-h">Three things we’d go after next</h2>
    <p class="s-sub">Drawn from this read, not from a list.</p>
    <ol class="vn-l">${tests.map((t, i) => `<li><span class="vn-n">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>
    <button class="m3-btn filled" type="button" onclick="window.__eaUnlock&&window.__eaUnlock()">
      <span class="material-symbols-rounded">bolt</span>Run the full assessment
    </button>
  </section>`;
}

/**
 * verdictSources — ORGANISM. What we went and read.
 *
 * Arguably the most trust-building thing on the page at zero cost: it proves the outside-in findings came
 * from somewhere a reader can check. These are the pages the API itself fetched, not pages a model said
 * it read (§8.1).
 */
export function verdictSources(sources = []) {
  if (!sources.length) return '';
  return `<section class="sec vs">
    <div class="s-label"><span class="material-symbols-rounded">link</span>What we read</div>
    <h2 class="s-h">Outside the deck</h2>
    <p class="s-sub">The public pages behind the findings above.</p>
    <ul class="vs-l">${sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">
      <span class="material-symbols-rounded">open_in_new</span>${esc(s.title || s.url)}</a></li>`).join('')}</ul>
  </section>`;
}

/**
 * briefEditor — MOLECULE. The correction state of briefPlayback (§8.8).
 *
 * A component rather than DOM surgery on the rendered playback, so the two states live in one file and
 * cannot drift apart. The fields here are exactly the ones the server will accept: `claims` is absent
 * deliberately — it is the substring-verified layer, and letting it be edited would put unverifiable
 * text into the one place the pipeline treats as proven.
 *
 * The warning is not decoration. Re-reading costs most of a run, and the customer should know that
 * before they press it rather than discover it as a wait.
 */
export function briefEditor(brief = {}, opts = {}) {
  const FIELDS = [
    ['oneLine', 'What it does', 'textarea'], ['sector', 'Sector', 'text'],
    ['businessModel', 'Business model', 'text'], ['stage', 'Stage', 'select'],
    ['geography', 'Where', 'text'], ['marketClaim', 'Market it claims', 'text'], ['ask', 'The ask', 'text'],
  ];
  const STAGE_OPTS = ['pre-seed', 'seed', 'series-a', 'series-b-plus', 'unknown'];
  const field = ([k, label, kind]) => {
    const v = esc(brief[k] || '');
    const input = kind === 'textarea'
      ? `<textarea class="bpe-i" id="bpe-${k}" rows="2">${v}</textarea>`
      : kind === 'select'
        ? `<select class="bpe-i" id="bpe-${k}">${STAGE_OPTS.map(o =>
            `<option value="${o}"${o === brief[k] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
        : `<input class="bpe-i" id="bpe-${k}" type="text" value="${v}">`;
    return `<label class="bpe-r${kind === 'textarea' ? ' wide' : ''}"><span class="bpe-k">${esc(label)}</span>${input}</label>`;
  };
  return `<section class="sec bpb bpe">
    <div class="s-label"><span class="material-symbols-rounded">edit</span>Your correction</div>
    <h2 class="s-h">Put us right</h2>
    <p class="s-sub">Change what we got wrong. Everything below re-reads on your version — it takes about a minute and doesn’t use up your free pre-screen.</p>
    <div class="bpe-grid">${FIELDS.map(field).join('')}</div>
    <div class="bpb-act">
      <button class="m3-btn filled" type="button" onclick="window.__ps2SaveBrief&&window.__ps2SaveBrief()">
        <span class="material-symbols-rounded">refresh</span>Read it again on my version
      </button>
      <button class="m3-btn text" type="button" onclick="window.__ps2CancelBrief&&window.__ps2CancelBrief()">Cancel</button>
      <span class="bpb-note">What you change here is marked as yours — we won’t present it as something we checked.${
        opts.editsLeft != null ? ` ${opts.editsLeft} correction${opts.editsLeft === 1 ? '' : 's'} left.` : ''}</span>
    </div>
  </section>`;
}

/**
 * verdictPage — ORGANISM. The whole pre-screen result, in reveal order (§5).
 *
 * ONE composition, used by the Verdict tab and by the live run, so the page a customer watches fill up
 * and the page they come back to are the same page. Forking them is how the two drift.
 */
export function verdictPage(snapshot = {}, opts = {}) {
  const editing = !!opts.editing;
  const brief = snapshot.brief || {};
  return `<div class="brief">
    ${verdictHero(snapshot, opts)}
    ${editing
      ? briefEditor(brief, { editsLeft: opts.editsLeft })
      : briefPlayback(brief, { asserted: snapshot.asserted || [], editable: opts.editable, editsLeft: opts.editsLeft })}
    ${snapshot.state === 'unreadable' ? '' : `<hr class="rule">
      ${verdictFindings(snapshot.nuggets || {}, { pending: opts.pending || [] })}
      ${verdictSources(snapshot.sources || [])}
      ${verdictNext(snapshot)}`}
  </div>`;
}

export { PS2_BANDS, PS2_NUGGETS };
