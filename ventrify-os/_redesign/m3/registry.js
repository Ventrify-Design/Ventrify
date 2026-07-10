// ============================================================
// Ventrify OS — Design System · CATALOG (atomic design)
// One source of truth, organised by atomic level:
//   Atoms → Molecules → Organisms → Templates → Pages
// specimen.html renders any entry standalone; widget.html builds a doc page
// from it; design-system.html indexes them by level. Add an entry → it gets a
// live device-testable specimen AND a page, no new files.
//
// Each entry:
//   level    'atom' | 'molecule' | 'organism' | 'template' | 'page'
//   group    level label (section in the index / side-nav)
//   domain   optional sub-grouping (e.g. 'Assessment', 'Shell')
//   title, sig, blurb
//   html()   rendered HTML string  (pages use `src` instead — a real file)
//   src      real file to load in the harness (pages only)
//   maxw     specimen max-width px (null = full bleed) · pad  pad the specimen?
//   props / variants / usedIn / adaptive   (see widget.html)
// ============================================================
import * as DS from './ds.js';
import { ASSESSMENT, SCORE, ENGAGEMENTS, STATS, QUEUE } from './data.js';

const A = ASSESSMENT;
const noAdapt = null;

// ── Slottable molecules — what can fill a sectionHero slot. Add a molecule here → it becomes
//    selectable in the Section-hero configurator (and any other slot-based organism). ──
const SLOT_MOLECULES = {
  statement: () => DS.statementLockup(),
  score: () => DS.scoreLockup({ now: 72, potential: 88 }),
  progress: () => DS.progressLockup({ label: 'Pre-wire clearance', done: 0, total: 9, status: 'Do not wire', tone: 'bad', segments: [{ kind: 'err' }, { kind: 'err' }, { kind: 'err' }, { kind: 'warn' }, { kind: 'warn' }, { kind: 'warn' }, { kind: 'info' }, { kind: 'info' }, { kind: 'info' }], capRight: '3 blockers · 3 key · 3 standard' }),
  profile: () => DS.profileLockup(),
  valuation: () => DS.valuationLockup({ multiple: '3.75', multipleSuffix: '× seed median', band: 'Rich — reprice', tone: 'bad', asked: 60, defensibleLo: 15, defensibleHi: 35, scaleMax: 70 }),
  coverage: () => DS.coverageLockup(),
  figures: () => DS.keyFigures([{ v: '$1.4B', l: 'TAM' }, { v: '28%', l: 'CAGR' }, { v: '6:1', l: 'LTV / CAC' }]),
  empty: () => '',
};
const SLOT_OPTS = [
  { v: 'statement', l: 'Statement lockup' }, { v: 'score', l: 'Score lockup' }, { v: 'progress', l: 'Progress lockup' },
  { v: 'profile', l: 'Profile lockup' }, { v: 'valuation', l: 'Valuation lockup' }, { v: 'coverage', l: 'Coverage lockup' },
  { v: 'figures', l: 'Key figures' }, { v: 'empty', l: '— empty —' }
];
const byV = v => SLOT_OPTS.find(o => o.v === v);
// right slot lists the metric molecules first (statement is the usual left half)
const SLOT_OPTS_R = ['score', 'progress', 'profile', 'valuation', 'coverage', 'statement', 'figures', 'empty'].map(byV);

export const CATALOG = {

  /* ═══════════════ ATOMS ═══════════════ */
  button: {
    level: 'atom', group: 'Atoms', title: 'Button', sig: '.m3-btn .filled / .tonal / .outlined / .text',
    blurb: 'The action atom. Filled for the one primary action; tonal/outlined/text step down in emphasis.',
    maxw: 600, pad: true,
    html: () => `<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center"><button class="m3-btn filled">Filled</button><button class="m3-btn tonal">Tonal</button><button class="m3-btn outlined">Outlined</button><button class="m3-btn text">Text</button><button class="m3-btn filled"><span class="material-symbols-rounded">add</span>With icon</button></div>`,
    props: [{ name: 'icon span', type: 'element', note: 'optional leading Material Symbol' }],
    variants: [{ label: 'States', note: 'enabled · hover · focus · pressed · disabled' }], usedIn: ['UI shell', 'Assessment', 'Portfolio'], adaptive: noAdapt
  },
  icon: {
    level: 'atom', group: 'Atoms', title: 'Icon', sig: 'span.material-symbols-rounded',
    blurb: 'Material Symbols (Rounded). One weight, variable fill — filled marks an active/selected state.',
    maxw: 480, pad: true,
    html: () => `<div style="display:flex;gap:22px;align-items:center;color:var(--md-sys-color-on-surface-variant)">${['dashboard', 'checklist', 'fact_check', 'query_stats', 'verified', 'warning'].map(i => `<span class="material-symbols-rounded" style="font-size:26px">${i}</span>`).join('')}<span class="material-symbols-rounded" style="font-size:26px;font-variation-settings:'FILL' 1;color:var(--md-sys-color-primary)">dashboard</span></div>`,
    props: [{ name: "'FILL' 0..1", type: 'axis', note: 'fill on active' }, { name: 'font-size', type: 'px', note: '18 / 20 / 24' }],
    variants: [{ label: 'Filled', note: 'active/selected destinations' }], usedIn: ['everywhere'], adaptive: noAdapt
  },
  chip: {
    level: 'atom', group: 'Atoms', title: 'Filter chip', sig: '.m3-chip',
    blurb: 'Toggleable filter atom — used above lists.',
    maxw: 520, pad: true,
    html: () => `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="m3-chip selected">All</button><button class="m3-chip">On track</button><button class="m3-chip">Needs attention</button><button class="m3-chip">Stuck</button></div>`,
    props: [{ name: 'text', type: 'string' }, { name: '.selected', type: 'class' }],
    variants: [{ label: 'Selected', note: 'secondary-container, no outline' }], usedIn: ['Portfolio'], adaptive: noAdapt
  },
  statusPill: {
    level: 'atom', group: 'Atoms', title: 'Status pill', sig: 'statusPill({kind,label,icon})',
    blurb: 'Compact state atom. Four kinds map to the product semantic roles.',
    maxw: 560, pad: true,
    html: () => `<div style="display:flex;gap:10px;flex-wrap:wrap">${[{ kind: 'ok', label: 'Verdict ready', icon: 'check_circle' }, { kind: 'warn', label: 'Promising', icon: 'trending_flat' }, { kind: 'err', label: 'Rich — reprice', icon: 'warning' }, { kind: 'info', label: 'L3' }].map(DS.statusPill).join('')}</div>`,
    props: [{ name: 'kind', type: "'ok'|'warn'|'err'|'info'" }, { name: 'label', type: 'string' }, { name: 'icon', type: 'string?' }],
    variants: [{ label: 'ok / warn / err / info', note: 'success · warning · error · primary' }], usedIn: ['Assessment', 'Portfolio', 'Action queue'], adaptive: noAdapt
  },
  recPill: {
    level: 'atom', group: 'Atoms', title: 'Recommendation pill', sig: 'recPill(kind, label, icon)',
    blurb: 'The high-emphasis verdict atom: invest / consider / pass, filled with the semantic colour.',
    maxw: 560, pad: true,
    html: () => `<div style="display:flex;gap:12px;flex-wrap:wrap">${DS.recPill('invest', 'Invest', 'trending_up')}${DS.recPill('consider', 'Diligence further', 'balance')}${DS.recPill('pass', 'Pass', 'block')}</div>`,
    props: [{ name: 'kind', type: "'invest'|'consider'|'pass'" }, { name: 'label', type: 'string' }, { name: 'icon', type: 'string' }],
    variants: [{ label: 'invest / consider / pass', note: 'the three outcomes' }], usedIn: ['Assessment', 'Portfolio'], adaptive: noAdapt
  },
  avatar: {
    level: 'atom', group: 'Atoms', title: 'Avatar', sig: '.li-lead / .et-av / .av',
    blurb: 'Initials avatar in a tonal container. Colour encodes sector/signal; sizes vary by context.',
    maxw: 480, pad: true,
    html: () => `<div style="display:flex;gap:16px;align-items:center">
      <span style="width:52px;height:52px;border-radius:16px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);display:grid;place-items:center;font-weight:500;font-size:18px">MG</span>
      <span class="et-av" style="background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)">SL</span>
      <span class="li-lead" style="background:var(--success-container);color:var(--on-success-container)">GH</span>
      <span class="li-lead" style="background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)">KL</span></div>`,
    props: [{ name: 'initials', type: 'string' }, { name: 'tone', type: 'container role', note: 'primary / tertiary / success / error' }],
    variants: [{ label: 'Signal tones', note: 'neutral · verified (green) · flag (red)' }], usedIn: ['UI shell', 'Assessment', 'Portfolio'], adaptive: noAdapt
  },
  progress: {
    level: 'atom', group: 'Atoms', title: 'Linear progress', sig: '.m3-prog',
    blurb: 'Progress / proportion atom — completeness bars, VSS category bars, market sizing.',
    maxw: 360, pad: true,
    html: () => `<div style="display:flex;flex-direction:column;gap:16px;max-width:300px"><div class="m3-prog"><span style="width:calc(0.62 * 100%)"></span></div><div class="m3-prog"><span style="width:calc(0.2 * 100%);background:var(--md-sys-color-error)"></span></div><div class="m3-prog indeterminate"><span></span></div></div>`,
    props: [{ name: 'span width', type: '0–100%' }, { name: '.indeterminate', type: 'class' }, { name: 'span background', type: 'token', note: 'error for danger' }],
    variants: [{ label: 'Danger', note: 'red track for stuck ventures' }], usedIn: ['Portfolio', 'Assessment'], adaptive: noAdapt
  },
  conviction: {
    level: 'atom', group: 'Atoms', title: 'Conviction meter', sig: '.seg',
    blurb: 'Five-segment strength atom — how much conviction sits behind the verdict.',
    maxw: 320, pad: true,
    html: () => `<div style="display:flex;flex-direction:column;gap:12px"><span class="seg"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></span><span class="seg"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span></div>`,
    props: [{ name: 'filled', type: '0–5', note: 'Low=2 · Medium=3 · High=4' }],
    variants: [{ label: 'Low / Medium / High', note: 'segments filled' }], usedIn: ['Assessment'], adaptive: noAdapt
  },
  textfield: {
    level: 'atom', group: 'Atoms', title: 'Text field', sig: '.m3-search / .field-in',
    blurb: 'The input atom — used for search and forms. Plain HTML (see the formField molecule for labelled form inputs).',
    maxw: 420, pad: true,
    html: () => `<label class="m3-search" style="max-width:340px"><span class="material-symbols-rounded">search</span><input type="search" class="search" placeholder="Search"></label>`,
    props: [{ name: 'placeholder / value', type: 'string' }, { name: 'leading icon', type: 'element' }],
    variants: [{ label: 'With leading icon', note: 'becomes a search field molecule' }], usedIn: ['Portfolio'], adaptive: noAdapt
  },
  switchAtom: {
    level: 'atom', group: 'Atoms', title: 'Switch', sig: '.m3-switch',
    blurb: 'Binary toggle atom.',
    maxw: 320, pad: true,
    html: () => `<div style="display:flex;gap:16px;align-items:center"><button class="m3-switch on" aria-pressed="true"></button><button class="m3-switch" aria-pressed="false"></button></div>`,
    props: [{ name: '.on', type: 'class' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  divider: {
    level: 'atom', group: 'Atoms', title: 'Divider', sig: '.m3-divider',
    blurb: 'The separator atom between sections of a card. RULE: a divider is always STRAIGHT, edge to edge. Never draw one as a `border-top`/`border-bottom` on a box that also carries a `border-radius` — the border traces the corner and the hairline curls up at both ends. When the host needs a radius (a hover background, a highlight pill), draw the divider as an absolutely-positioned 1px pseudo-element instead, so its geometry is independent of the corner shape. See `.mrow` (metricRow) and `.tbl td`.',
    maxw: 420, pad: true,
    html: () => `<div style="max-width:360px"><div class="body-m variant">Above</div><hr class="m3-divider"><div class="body-m variant">Below</div></div>`,
    props: [
      { name: 'geometry', type: 'straight', note: 'never follows a host radius' },
      { name: 'on a rounded host', type: '::before / ::after', note: 'position:absolute · height:1px · left:0 right:0' },
    ],
    variants: [], usedIn: ['Assessment', 'metricRow', 'researchRow', 'benchmarkTable'], adaptive: noAdapt
  },

  /* ═══════════════ MOLECULES ═══════════════ */
  navItem: {
    level: 'molecule', group: 'Molecules', domain: 'Shell', title: 'Nav item', sig: 'icon + label + badge',
    blurb: 'A single destination in the drawer — icon atom + label + optional count badge. Active state fills the pill and the icon.',
    maxw: 280, pad: true,
    html: () => `<div style="max-width:240px;display:flex;flex-direction:column;gap:2px"><div class="nav-item active"><span class="material-symbols-rounded">dashboard</span> Portfolio</div><div class="nav-item"><span class="material-symbols-rounded">checklist</span> Action queue <span class="nav-badge">6</span></div><div class="nav-item"><span class="material-symbols-rounded">monitoring</span> Pipeline</div></div>`,
    props: [{ name: 'icon / label', type: 'string' }, { name: 'badge', type: 'string?', note: 'trailing count' }, { name: 'active', type: 'boolean' }],
    variants: [{ label: 'Active / rest', note: 'secondary-container fill + filled icon' }], usedIn: ['UI shell'], adaptive: noAdapt
  },
  brand: {
    level: 'molecule', group: 'Molecules', domain: 'Shell', title: 'Brand lockup', sig: 'logo atom + wordmark',
    blurb: 'The product mark at the top of the drawer — logo tile + wordmark. Wordmark hides in rail mode.',
    maxw: 300, pad: true,
    html: () => `<div class="drawer-brand" style="padding:0"><span class="logo"><span class="material-symbols-rounded" style="font-size:20px">bolt</span></span><span class="wm">Ventrify <small>OS</small></span></div>`,
    props: [{ name: 'logo', type: 'icon atom' }, { name: 'wordmark', type: 'string' }], variants: [], usedIn: ['UI shell'], adaptive: noAdapt
  },
  themeToggle: {
    level: 'molecule', group: 'Molecules', domain: 'Shell', title: 'Theme toggle', sig: 'themeToggle()',
    blurb: 'Segmented Light / Dark control, persisted to localStorage and broadcast so every surface re-tints.',
    maxw: 260, pad: true,
    html: () => `<div style="max-width:220px">${DS.themeToggle()}</div>`,
    props: [{ name: 'data-set', type: "'light'|'dark'" }], variants: [{ label: 'Rail', note: 'stacks vertically when collapsed' }], usedIn: ['UI shell', 'Design system'], adaptive: noAdapt
  },
  accountChip: {
    level: 'molecule', group: 'Molecules', domain: 'Shell', title: 'Account chip', sig: '.drawer-foot',
    blurb: 'The signed-in workspace at the foot of the drawer — avatar atom + org name + role.',
    maxw: 300, pad: true,
    html: () => `<div class="drawer-foot" style="margin:0;padding:0"><span class="av">AC</span><span class="nm">Apex Capital<small>Partner workspace</small></span></div>`,
    props: [{ name: 'org / role', type: 'string' }, { name: 'avatar', type: 'atom' }], variants: [], usedIn: ['UI shell'], adaptive: noAdapt
  },
  searchField: {
    level: 'molecule', group: 'Molecules', title: 'Search field', sig: '.m3-search',
    blurb: 'Input atom + a leading search icon — the list search above tables.',
    maxw: 420, pad: true,
    html: () => `<label class="m3-search" style="max-width:360px"><span class="material-symbols-rounded">search</span><input type="search" class="search" placeholder="Search programs or founders"></label>`,
    props: [{ name: 'placeholder', type: 'string' }], variants: [], usedIn: ['Portfolio'], adaptive: noAdapt
  },
  breadcrumb: {
    level: 'molecule', group: 'Molecules', title: 'Orienting label (eyebrow ↔ breadcrumb)', sig: 'orientLabel(trail)',
    blurb: 'One level-aware wayfinding molecule the masthead consumes at every depth. The current (leaf) segment is the accent you-are-here; ancestors are muted links; a real back-arrow to the immediate parent appears only at depth. L1 is the degenerate single-segment case (today\'s "eyebrow").',
    maxw: 460, pad: true,
    html: () => `<div style="display:flex;flex-direction:column;gap:20px;align-items:flex-start">
      ${DS.orientLabel([{ label: 'Portfolio' }])}
      ${DS.orientLabel([{ label: 'Portfolio', href: '#' }, { label: 'MoneyGym' }])}
      ${DS.orientLabel([{ label: 'MoneyGym', href: '#' }, { label: 'Research' }])}
    </div>`,
    props: [{ name: 'trail', type: '[{label, href?}]', note: 'ordered root→current; last node = current page (accent, no link)' }], variants: [], usedIn: ['Portfolio', 'Assessment', 'Research drill-down'], adaptive: noAdapt
  },
  ventureHeader: {
    level: 'molecule', group: 'Molecules', title: 'Venture header', sig: 'avatar + name + status + stage',
    blurb: 'The subject identity in the masthead — avatar atom + name + status pill atom + stage line.',
    maxw: 640, pad: true,
    html: () => `<div class="venture-head" style="margin:0"><span class="av">MG</span><div style="flex:1"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="headline-m">MoneyGym</span><span class="status ok"><span class="material-symbols-rounded">check_circle</span> Verdict ready</span></div><div class="body-m variant">Seed · Raising $20M on $60M pre · Behavioural-finance subscription</div></div></div>`,
    props: [{ name: 'name / initials', type: 'string' }, { name: 'status', type: 'status pill' }, { name: 'stageLine', type: 'string' }], variants: [], usedIn: ['Assessment'], adaptive: noAdapt
  },
  stat: {
    level: 'molecule', group: 'Molecules', domain: 'Portfolio', title: 'Stat', sig: 'statCard(s)',
    blurb: 'A single headline number + label (+ optional sub). Four sit in a row above the portfolio table.',
    maxw: 260, pad: true,
    html: () => DS.statCard(STATS[3]),
    props: [{ name: 'n', type: 'string' }, { name: 'l', type: 'string' }, { name: 'sub', type: 'string?' }],
    variants: [{ label: 'With sub', note: 'e.g. "119 / 168 outputs"' }], usedIn: ['Portfolio'],
    adaptive: { status: 'proposed', layout: { mobile: 'Row of 4 → 2×2, then single column below 400px.', tablet: '2×2 grid.', desktop: 'Row of 4.' }, content: { mobile: 'Drop the sub-caption; number + label only.', tablet: 'Keep sub.', desktop: 'Keep sub.' } }
  },
  listRow: {
    level: 'molecule', group: 'Molecules', title: 'List row', sig: '.m3-li',
    blurb: 'The row molecule behind comparable rounds, team, diligence, research and the data room: lead + headline + supporting + trailing.',
    maxw: 480, pad: true,
    html: () => `<div class="m3-list" style="max-width:440px"><div class="m3-li"><div class="m3-li-start"><div class="li-lead">CH</div></div><div class="m3-li-body"><div class="m3-li-headline">List item headline</div><div class="m3-li-support">Supporting text on a second line</div></div><div class="m3-li-end"><span class="material-symbols-rounded variant">chevron_right</span></div></div></div>`,
    props: [{ name: '.m3-li-start / -body / -end', type: 'element' }], variants: [{ label: '.button', note: 'interactive row' }], usedIn: ['Assessment', 'Research drill-down'], adaptive: noAdapt
  },
  cardHeader: {
    level: 'molecule', group: 'Molecules', title: 'Card header', sig: '.card-hd + overline',
    blurb: 'The overline row that titles every organism card — a label on the left, meta on the right.',
    maxw: 560, pad: true,
    html: () => `<div class="m3-card"><div class="card-hd"><span class="overline">Recommendation</span><span class="overline">VSS · V3</span></div><div class="body-m variant">Card body follows the header.</div></div>`,
    props: [{ name: 'left / right', type: 'overline' }], variants: [{ label: 'With status', note: 'right side can carry a status pill' }], usedIn: ['Assessment'], adaptive: noAdapt
  },
  callout: {
    level: 'molecule', group: 'Molecules', title: 'Callout', sig: '.callout',
    blurb: 'A low-emphasis inline banner — colour-coded leading icon + text. Never out-shouts the verdict.',
    maxw: 640, pad: true,
    html: () => `<div style="display:flex;flex-direction:column;gap:12px"><div class="callout err"><span class="material-symbols-rounded">error</span><div><b>Biggest kill-risk · Distribution.</b> The reachability math never closes.</div></div><div class="callout ok"><span class="material-symbols-rounded">task_alt</span><div><b>Reviewed &amp; signed off</b> by Alex Rivera.</div></div></div>`,
    props: [{ name: 'kind', type: "'err'|'ok'|default" }], variants: [{ label: 'err / ok / neutral', note: 'leading colour' }], usedIn: ['Assessment', 'Research drill-down'], adaptive: noAdapt
  },
  keyFigure: {
    level: 'molecule', group: 'Molecules', title: 'Key figure', sig: '.keyfig',
    blurb: 'A big value + caption, three across — pulls the headline numbers out of long-form research.',
    maxw: 560, pad: true,
    html: () => `<div class="keyfig"><div class="k"><div class="v">$1.5–2.5B</div><div class="l">TAM · behavioural-coaching</div></div><div class="k"><div class="v">$1.0–2.0B</div><div class="l">SAM</div></div><div class="k"><div class="v">$100–200M</div><div class="l">SOM · Yr-5</div></div></div>`,
    props: [{ name: 'v / l', type: 'string' }], variants: [], usedIn: ['Research drill-down'], adaptive: noAdapt
  },

  /* ═══════════════ ORGANISMS ═══════════════ */
  navigationDrawer: {
    level: 'organism', group: 'Organisms', domain: 'Shell', title: 'Navigation drawer', sig: 'drawer(active)',
    blurb: 'The persistent left navigation — brand, grouped destinations, theme toggle and account — collapsible to an 88px rail. Shown with placeholder labels.',
    maxw: null, pad: false,
    html: () => `<div class="m3-app" style="min-height:0;height:100%">${DS.drawerPlaceholder()}<div class="m3-main" style="padding:20px"><div class="m3-appbar" style="margin:0"><div class="sk line" style="width:120px"></div></div></div></div>`,
    props: [{ name: 'active', type: 'string' }, { name: 'NAV', type: 'array', note: 'destinations in ds.js' }],
    variants: [{ label: 'Drawer / rail', note: '260px ↔ 88px via .m3-app.rail' }], usedIn: ['every page'],
    adaptive: { status: 'proposed', layout: { mobile: 'Detaches below 840px → hamburger-triggered scrim overlay (modal drawer).', tablet: 'Collapsed rail by default; expands on tap.', desktop: 'Expanded drawer.' }, content: { mobile: 'Operate destinations by default; Manage behind “more”.', tablet: 'All as rail icons.', desktop: 'All with labels.' } }
  },
  masthead: {
    level: 'organism', group: 'Organisms', domain: 'Shell', title: 'Masthead', sig: 'masthead(opts)',
    blurb: 'The tinted, persistent top region of the shell — breadcrumb + actions, headline + subheading, and (optionally) tabs. Sticky: it minifies as the content scrolls under it (the hero collapses, the headline shifts up into the bar, the tabs stay pinned). Breadcrumb and tabs are each optional — the scroll/minify behaviour is identical either way. Scroll to see it minify.',
    maxw: null, pad: false,
    html: (inst) => { const o = inst === 'nocrumb' ? { breadcrumb: false } : inst === 'notabs' ? { tabs: false } : {}; return `<div class="mh-scroll">${DS.mastheadPlaceholder(o)}<div class="mh-demo">${Array.from({ length: 9 }, () => `<div class="sk-card tall"><div class="sk line" style="width:32%"></div><div class="sk line" style="width:100%"></div><div class="sk line" style="width:88%"></div><div class="sk line" style="width:94%"></div><div class="sk line" style="width:70%"></div></div>`).join('')}</div></div>`; },
    instances: [
      { key: 'full', label: 'Breadcrumb + tabs', note: 'the default — back-breadcrumb and a tab bar' },
      { key: 'nocrumb', label: 'No breadcrumb', note: 'headline only; no back-path in the bar' },
      { key: 'notabs', label: 'No tabs', note: 'no tab navigation under the header' }
    ],
    props: [{ name: 'opts.breadcrumb', type: 'boolean', note: 'default true' }, { name: 'opts.tabs', type: 'boolean', note: 'default true' }],
    variants: [{ label: 'Breadcrumb', note: 'on / off' }, { label: 'Tabs', note: 'on / off' }], usedIn: ['Assessment', 'Research drill-down'],
    adaptive: { status: 'proposed', layout: { mobile: 'Actions collapse to icons; name wraps; tabs scroll.', tablet: 'Actions keep labels; tabs may scroll.', desktop: 'Full band.' }, content: { mobile: 'Stage line to one line; export/share into an overflow menu.', tablet: 'Full.', desktop: 'Full.' } }
  },
  auxPanel: {
    level: 'organism', group: 'Organisms', domain: 'Shell', title: 'Auxiliary panel', sig: 'auxPanel() · openAux(opts)',
    blurb: 'A right-anchored side sheet for drilling into content, actions or tools — instead of navigating to a new page. Two modes: push (the shell reflows, content narrows) and overlay (modal, over a scrim). Opened via openAux({title, body, mode}); dismissed via the ✕, the scrim, or Esc. Pick a mode, then click a card.',
    maxw: null, pad: false,
    html: (inst) => { const mode = inst === 'overlay' ? 'overlay' : 'push'; const openCls = mode === 'overlay' ? 'aux-open aux-modal' : 'aux-open aux-push'; return `<div class="m3-app ${openCls}" data-aux-mode="${mode}" style="min-height:0;height:100%">
      ${DS.drawerPlaceholder()}
      <main class="m3-main" style="padding:0;display:flex;flex-direction:column;min-height:0;overflow-y:auto;overflow-anchor:none;">
        ${DS.mastheadPlaceholder()}
        <div style="padding:24px clamp(22px,3.6vw,52px) 60px;display:flex;flex-direction:column;gap:16px;">
          ${DS.auxTriggerCards()}
        </div>
      </main>
      ${DS.auxPanel(DS.auxDemoContent())}
    </div>`; },
    instances: [
      { key: 'push', label: 'Push · inline', note: 'shell reflows — content narrows beside the panel' },
      { key: 'overlay', label: 'Overlay · modal', note: 'panel floats over a scrim; content dims' }
    ],
    props: [{ name: 'openAux({title, subtitle, body, footer, mode})', type: 'api', note: "mode: 'push' | 'overlay'" }, { name: 'closeAux()', type: 'api', note: 'or ✕ / scrim / Esc' }],
    variants: [{ label: 'Push', note: 'inline — shell grid reflows, content narrows' }, { label: 'Overlay', note: 'modal — over a scrim; content dims' }, { label: 'Responsive', note: 'push falls back to overlay below 900px' }],
    usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Full-width overlay (no room to push); slides over content.', tablet: 'Overlay, or a narrower push.', desktop: 'Push (content narrows) or overlay.' }, content: { mobile: 'Full drill-down; footer actions stack.', tablet: 'Full.', desktop: 'Full.' } }
  },
  utilRail: {
    level: 'organism', group: 'Organisms', domain: 'Shell', title: 'Utility rail', sig: 'utilRail(tools)',
    blurb: 'A persistent icon rail on the far right for tooling. Clicking a tool opens the auxiliary panel (push) with that tool; clicking the active tool closes it. The shell keeps the rail reserved and reflows for the panel. Placeholder tools shown.',
    maxw: null, pad: false,
    html: () => `<div class="m3-app has-utilrail" style="min-height:0;height:100%">
      ${DS.drawerPlaceholder()}
      <main class="m3-main" style="padding:0;display:flex;flex-direction:column;min-height:0;overflow-y:auto;overflow-anchor:none;">
        ${DS.mastheadPlaceholder()}
        <div style="padding:24px clamp(22px,3.6vw,52px) 60px;display:flex;flex-direction:column;gap:18px;">
          <div class="body-m variant">Click a tool on the right rail — its panel opens and the shell reacts.</div>
          <div class="sk-card tall"><div class="sk line" style="width:30%"></div><div class="sk line" style="width:100%"></div><div class="sk line" style="width:94%"></div><div class="sk line" style="width:98%"></div></div>
          <div class="sk-card tall"><div class="sk line" style="width:30%"></div><div class="sk line" style="width:100%"></div><div class="sk line" style="width:90%"></div></div>
        </div>
      </main>
      ${DS.auxPanel()}
      ${DS.utilRail([{ key: 'a', icon: 'build', label: 'Tool' }, { key: 'b', icon: 'insights', label: 'Tool' }, { key: 'c', icon: 'notifications', label: 'Tool' }, { key: 'd', icon: 'bookmark', label: 'Tool' }], { auto: true })}
    </div>`,
    props: [{ name: 'tools', type: '[{key,icon,label}]', note: 'icon buttons in the rail' }, { name: '→ openAux', type: 'api', note: 'a tool opens the panel (push)' }],
    variants: [{ label: 'Tool active', note: 'secondary-container fill + filled icon; panel open' }, { label: 'Toggle', note: 'clicking the active tool closes the panel' }],
    usedIn: ['every page (optional)'],
    adaptive: { status: 'proposed', layout: { mobile: 'Rail collapses into a masthead action / bottom bar; panel is full-width overlay.', tablet: 'Rail kept; panel overlays.', desktop: 'Rail + push panel.' }, content: { mobile: 'Top tools only; rest behind “more”.', tablet: 'All tools.', desktop: 'All tools.' } }
  },
  engagementTable: {
    level: 'organism', group: 'Organisms', domain: 'Portfolio', title: 'Engagement table', sig: 'engagementTable(rows)',
    blurb: 'The portfolio at a glance — one row per venture with stage, status, progress/signal and last activity. A row opens the Assessment.',
    maxw: null, pad: true,
    html: () => DS.engagementTable(ENGAGEMENTS),
    props: [{ name: 'row.name / sub', type: 'string' }, { name: 'row.stage', type: 'string' }, { name: 'row.status', type: '{kind,label,icon}' }, { name: 'row.progress', type: '0–1', note: 'or row.rec' }, { name: 'row.when', type: 'string' }],
    variants: [{ label: 'In-flight vs Assessed', note: 'progress bar vs recommendation pill + score' }, { label: 'Danger', note: 'red track for stuck' }], usedIn: ['Portfolio'],
    adaptive: { status: 'proposed', layout: { mobile: 'Table → stacked cards: venture + status on top, stage/progress/activity as labelled rows.', tablet: 'Drop Stage + Last activity into a second line.', desktop: 'Full 5-column table.' }, content: { mobile: 'Venture, status, primary signal only; stage + timestamp move into the Assessment.', tablet: 'Add stage back.', desktop: 'All columns.' } }
  },
  queueItem: {
    level: 'organism', group: 'Organisms', domain: 'Action queue', title: 'Queue item', sig: 'queueItem(item)',
    blurb: 'A single actionable card — urgency-coloured icon, what/why, and primary + secondary action.',
    maxw: 820, pad: true,
    html: () => QUEUE.slice(0, 3).map(DS.queueItem).join(''),
    props: [{ name: 'urgency', type: "'high'|'med'|'low'" }, { name: 'icon', type: 'string' }, { name: 'title / desc / meta', type: 'string' }, { name: 'action', type: 'string' }],
    variants: [{ label: 'high / med / low', note: 'filled vs outlined primary' }], usedIn: ['Action queue'],
    adaptive: { status: 'proposed', layout: { mobile: 'Actions wrap full-width below the body; icon shrinks.', tablet: 'Actions inline.', desktop: 'Actions inline right.' }, content: { mobile: 'Primary action only; secondary behind a kebab.', tablet: 'Both.', desktop: 'Both.' } }
  },
  /* ── editorial assessment set — the memo layout assess.html mounts (styles: assess-editorial.css) ── */
  verdictMemo: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Verdict memo (editorial)', sig: 'verdictMemo(a, score)',
    blurb: 'The whole Verdict tab, composed as one editorial brief: verdict hero → thesis → the case → conditions + kill-risk → sign-off. What assess.html mounts.',
    maxw: null, pad: false,
    html: () => DS.verdictMemo(A, SCORE),
    props: [{ name: 'a', type: 'ASSESSMENT' }, { name: 'score', type: 'SCORE' }],
    variants: [{ label: 'Composes', note: 'sectionHero · caseEditorial · conditionsKill · verdictSignoff' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Hero stacks (verdict over score); case + conditions single-column.', tablet: 'Hero two-column; case side by side.', desktop: 'Full memo.' }, content: { mobile: 'Everything kept; verdict clamps to 4 lines.', tablet: 'Full.', desktop: 'Full.' } }
  },
  investabilityHero: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Investability hero', sig: 'investabilityHero(score, a)',
    blurb: 'The Section hero atop the Investability tab — recycled statementLockup (left, copy from a.heroes.investability) + profileLockup (right, the 55 re-expressed as its severity shape, derived from SCORE.categories) + thesis. Same frame as the verdict hero, molecule swapped.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.investabilityHero(SCORE, A)}</div>`,
    props: [{ name: 'score', type: 'SCORE' }, { name: 'a', type: 'ASSESSMENT (a.heroes.investability copy)' }],
    variants: [{ label: 'Composes', note: 'sectionHero( statementLockup · profileLockup )' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Statement over profile.', tablet: 'Two-column.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  marketHero: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Market hero', sig: 'marketHero(a)',
    blurb: 'The Section hero atop the Market tab — recycled statementLockup (left, TAM correction) + valuationLockup (right, the reprice band, figures from ASSESSMENT.valuation) + thesis. Same frame, molecule swapped.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.marketHero(A)}</div>`,
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.market + valuation)' }],
    variants: [{ label: 'Composes', note: 'sectionHero( statementLockup · valuationLockup )' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Statement over valuation.', tablet: 'Two-column.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  teamHero: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Team hero', sig: 'teamHero(a)',
    blurb: 'The Section hero atop the Team tab — recycled statementLockup (left) + progressLockup recycled as a signal spread (right: verified/neutral/flagged, derived from team.members[].signal) + thesis. Shows the same molecule serving two tabs.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.teamHero(A)}</div>`,
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.team + team.members)' }],
    variants: [{ label: 'Composes', note: 'sectionHero( statementLockup · progressLockup )' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Statement over signal.', tablet: 'Two-column.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  researchHero: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Research hero', sig: 'researchHero(a, score)',
    blurb: 'The Section hero atop the Research tab — recycled statementLockup (left, claims tested/failed) + coverageLockup (right, evidence completeness + provenance, derived from SCORE + confidence) + thesis. Same frame, molecule swapped.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.researchHero(A, SCORE)}</div>`,
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.research + confidence)' }, { name: 'score', type: 'SCORE (signals rated)' }],
    variants: [{ label: 'Composes', note: 'sectionHero( statementLockup · coverageLockup )' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Statement over coverage.', tablet: 'Two-column.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  scoreLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Score lockup', sig: 'scoreLockup(opts)',
    blurb: 'The headline-score lockup — eyebrow label · a big number with /max · a tone-coloured band chip · an optional now→potential bar. Generic + defaults, so it drops into any surface that needs a headline score. Rendered here with its defaults.',
    maxw: 340, pad: true,
    html: () => DS.scoreLockup({ now: 72, potential: 88 }),
    props: [{ name: 'label', type: 'string' }, { name: 'score / max', type: 'number' }, { name: 'band', type: 'string' }, { name: 'tone', type: "'good'|'mid'|'bad'" }, { name: 'now / potential', type: 'number (optional bar)' }],
    variants: [{ label: 'Tone', note: 'good (green) · mid (amber) · bad (red) band' }, { label: 'No bar', note: 'omit now/potential' }], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; number scales with clamp().', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  progressLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Progress lockup', sig: 'progressLockup(opts)',
    blurb: 'The headline-clearance lockup — sibling to scoreLockup, sharing its big/small numeral + tone-chip treatment, but for a "X of N cleared" progress metric (e.g. pre-wire diligence). eyebrow label · big done/total · a tone status chip · a segmented severity bar (each pip coloured by kind, filled when cleared). Fronts the Diligence tab\'s Section hero. Rendered here with the MoneyGym pre-wire defaults.',
    maxw: 340, pad: true,
    html: () => DS.progressLockup({ label: 'Pre-wire clearance', done: 0, total: 9, status: 'Do not wire', tone: 'bad', segments: [{ kind: 'err' }, { kind: 'err' }, { kind: 'err' }, { kind: 'warn' }, { kind: 'warn' }, { kind: 'warn' }, { kind: 'info' }, { kind: 'info' }, { kind: 'info' }], capRight: '3 blockers · 3 key · 3 standard' }),
    props: [{ name: 'label / labelTone', type: 'string' }, { name: 'done / total', type: 'number' }, { name: 'status / statusIcon', type: 'string' }, { name: 'tone', type: "'good'|'mid'|'bad'" }, { name: 'segments', type: '[{kind:err|warn|info, done}] (optional pips)' }, { name: 'capLeft / capRight', type: 'string (HTML)' }],
    variants: [{ label: 'Severity pips', note: 'pass segments for coloured blocker/key/standard bar' }, { label: 'Plain', note: 'omit segments → even done/total bar' }, { label: 'Cleared', note: "tone 'good' + lock_open when all done" }], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; number scales with clamp().', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Pips wrap; caption stacks.', tablet: 'Full.', desktop: 'Full.' } }
  },
  profileLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Profile lockup', sig: 'profileLockup(opts)',
    blurb: 'Sibling to scoreLockup that re-expresses the score as its SHAPE — the big numeral + a split of tone chips (strong/mixed/gap) + a weighted severity strip (one segment per category, width ∝ weight, tone by severity) + a now→potential caption. Fronts the Investability tab so its hero isn\'t a duplicate of the Verdict score. Pass `categories` (SCORE.categories) to derive the split + strip live. Rendered here with defaults.',
    maxw: 340, pad: true,
    html: () => DS.profileLockup(),
    props: [{ name: 'label', type: 'string' }, { name: 'score / max', type: 'number' }, { name: 'now / potential', type: 'number' }, { name: 'categories', type: 'SCORE.categories → derives split + strip' }, { name: 'split / segments', type: 'override the derived shape' }],
    variants: [{ label: 'Derived', note: 'pass categories → split + weighted strip computed via sevOf()' }, { label: 'Hand-driven', note: 'pass split + segments explicitly' }], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; chips + strip wrap.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  valuationLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Valuation lockup', sig: 'valuationLockup(opts)',
    blurb: 'Sibling to scoreLockup expressing a CORRECTIVE premium — a big multiple + a tone verdict chip + a reprice bar (a success-tinted defensible band, an error-tinted overshoot, and a marker at the ask). The inverse of scoreLockup\'s grow-up bar — reprice DOWN into a band. Fronts the Market tab. Takes explicit numeric opts, never parses prose. Rendered here with the MoneyGym reprice.',
    maxw: 340, pad: true,
    html: () => DS.valuationLockup({ multiple: '3.75', multipleSuffix: '× seed median', band: 'Rich — reprice', tone: 'bad', asked: 60, defensibleLo: 15, defensibleHi: 35, scaleMax: 70 }),
    props: [{ name: 'label', type: 'string' }, { name: 'multiple / multipleSuffix', type: 'string' }, { name: 'band / tone / bandIcon', type: 'verdict chip' }, { name: 'asked / defensibleLo / defensibleHi / scaleMax', type: 'number ($M)' }, { name: 'captionLo / captionHi / askedNote', type: 'string' }],
    variants: [{ label: 'Rich', note: 'asked above the band → error overshoot + red marker' }, { label: 'Fair', note: 'marker sits inside the band, no overshoot' }], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; number scales with clamp().', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Caption stacks.', tablet: 'Full.', desktop: 'Full.' } }
  },
  coverageLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Coverage lockup', sig: 'coverageLockup(opts)',
    blurb: 'Sibling to scoreLockup for an evidence base — a big completeness numeral + a confidence tone chip + a demoted, dot-separated provenance figure-row (no bar; one dominant numeral, not a row of equals). Fronts the Research tab. Rendered here with defaults.',
    maxw: 340, pad: true,
    html: () => DS.coverageLockup(),
    props: [{ name: 'label / ratedLabel', type: 'string' }, { name: 'rated / total', type: 'number' }, { name: 'confidence / tone / confidenceIcon', type: 'confidence chip' }, { name: 'facts', type: '[{v, k}] provenance units' }],
    variants: [{ label: 'Complete', note: 'rated == total → good tone' }, { label: 'No provenance', note: 'empty facts → strip omitted' }], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; provenance wraps to stacked units.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  statementLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Statement lockup', sig: 'statementLockup(opts)',
    blurb: 'The "what" lockup — an eyebrow-marked headline (with an amber-emphasised phrase) + supporting facts. The left half of a sectionHero (the verdict on the assess page), symmetric with scoreLockup. Generic + defaults; eyebrow icon and facts are optional. Rendered here with its defaults.',
    maxw: 560, pad: true,
    html: () => DS.statementLockup(),
    props: [{ name: 'eyebrow / eyebrowIcon', type: 'string' }, { name: 'headline / headlineEm', type: 'string (Em = amber phrase)' }, { name: 'facts', type: '[{k, v}] (v is HTML)' }],
    variants: [{ label: 'With icon', note: 'eyebrowIcon renders a Material Symbol' }, { label: 'No facts', note: 'omit facts → headline only' }], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; headline clamps to 4 lines.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Facts wrap.', tablet: 'Full.', desktop: 'Full.' } }
  },
  sectionHero: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Section hero', sig: 'sectionHero(opts)',
    blurb: 'The reusable "top of a section" — TWO molecule SLOTS (left + right) + an optional thesis. Defaults to statementLockup (left) + scoreLockup (right) for the verdict; pass explicit `left`/`right` HTML to swap in any molecule per section. One empty slot → a single-molecule hero. Compose & test the slots below — it fronts any tab across the workspace.',
    maxw: null, pad: true,
    html: (inst, cfg = {}) => {
      const opts = { left: (SLOT_MOLECULES[cfg.left] || SLOT_MOLECULES.statement)(), right: (SLOT_MOLECULES[cfg.right] || SLOT_MOLECULES.score)() };
      if (cfg.thesis === 'off') opts.thesis = '';
      return `<div class="brief" style="padding:8px 28px 20px">${DS.sectionHero(opts)}</div>`;
    },
    configurator: [
      { key: 'left', label: 'Left slot', control: 'select', options: SLOT_OPTS },
      { key: 'right', label: 'Right slot', control: 'select', options: SLOT_OPTS_R },
      { key: 'thesis', label: 'Thesis', options: [{ v: '', l: 'On' }, { v: 'off', l: 'Off' }] }
    ],
    props: [{ name: 'left / right', type: 'slot HTML (any molecule) — optional' }, { name: 'eyebrow / headline / headlineEm / facts', type: '→ default left (statementLockup)' }, { name: 'score', type: '→ default right (scoreLockup)' }, { name: 'thesis / thesisLabel', type: 'string' }],
    variants: [{ label: 'Slots', note: 'left + right take any molecule — swap per section' }, { label: 'Single', note: 'one empty slot → single-column hero' }, { label: 'Thesis', note: 'optional paragraph below' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Stacks: headline+facts, then score, then thesis; divider hidden.', tablet: 'Two-column head + score.', desktop: 'Two-column, min-height 300.' }, content: { mobile: 'Headline clamps to 4 lines.', tablet: 'Full.', desktop: 'Full.' } }
  },
  metricRow: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Metric row', sig: 'metricRow(opts)',
    blurb: 'The ONE shared row for the Investability tab — label(+optional severity dot) · bar · value(+sub-line) · drill chevron. Both the strength profile AND the contributions table compose it; only the bar payload + value strings differ, so the two lists read as one component with identical hover, chevron and keyboard focus.',
    maxw: 640, pad: true,
    html: () => `<div class="brief" style="padding:0"><div class="profile">
      ${DS.metricRow({ key: 'moat', label: 'Technical / competitive moat', dot: 'gap', sub: '15% weight · gap', bar: { now: 0.3, pot: 0.9, tick: true }, value: '1.5', sub2: { text: '→ 4.5', tone: 'up' }, onDrill: 'void' })}
      ${DS.metricRow({ key: 'team', label: 'Team & founder-market fit', dot: null, sub: '25% weight · rated 3.0/5', bar: { now: 0.6, pot: 0.6 }, value: '+15.0', sub2: { text: 'at ceiling', tone: 'flat' }, onDrill: 'void' })}
      ${DS.metricRow({ label: 'Investability score', value: '55', valueMuted: ' / 100', foot: true })}
    </div></div>`,
    props: [{ name: 'label / sub', type: 'string' }, { name: 'dot', type: "'strong'|'mixed'|'gap'|null" }, { name: 'bar', type: '{now:0..1, pot:0..1, tick}' }, { name: 'value / valueMuted', type: 'string' }, { name: 'sub2', type: '{text, tone:up|flat}' }, { name: 'onDrill / foot', type: 'handler | bool' }],
    variants: [{ label: 'Strength face', note: 'severity dot + 0–5 bar + tick' }, { label: 'Contribution face', note: 'no dot + share-of-100 bar' }, { label: 'Drill', note: 'chevron + role=button + Enter/Space' }, { label: 'Foot', note: 'total row — no bar / no chevron' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Bar hides; label + value + chevron.', tablet: 'Full.', desktop: 'label · bar · value · chevron.' }, content: { mobile: 'Labels wrap; dot pins to line 1.', tablet: 'Full.', desktop: 'Full.' } }
  },
  strengthProfile: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Strength profile (editorial)', sig: 'strengthProfile(score, onDrill)',
    blurb: 'The radar alternative — categories as ranked now/potential bars, composed from the shared metricRow molecule. Severity dots, “→ X.X” vs “at ceiling”, the split counts and the headroom narrative all DERIVE from the scores.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.strengthProfile(SCORE)}</div>`,
    props: [{ name: 'score.categories', type: '[{label,short,weightPct,frac,pot,num}]' }, { name: 'row', type: 'metricRow molecule' }, { name: 'onDrill', type: 'handler name (optional)' }],
    variants: [{ label: 'Bands', note: 'strong ≥4.0 · mixed ≥2.5 · gap <2.5 (from frac)' }, { label: 'Headroom', note: 'tick + “→ X.X” only when pot > now' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'metricRow bar hides; label + value + chevron.', tablet: 'Full.', desktop: 'Full-width rows.' }, content: { mobile: 'Labels wrap; dot pins to line 1.', tablet: 'Full.', desktop: 'Full.' } }
  },
  investabilityComposition: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Score composition (editorial)', sig: 'investabilityComposition(score, onDrill)',
    blurb: 'Option B lock-up: the now-vs-potential radar as a centered hero band, with a full-width per-category contributions table beneath (metricRow rows: weight · rated · a share-of-100 bar · +contribution · upside-available · chevron). Rows drill into the aux panel; the whole tab reads as one vertical rhythm.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.investabilityComposition(SCORE)}</div>`,
    props: [{ name: 'score.categories', type: '[{key,label,weightPct,frac,pot,num}]' }, { name: 'row', type: 'metricRow molecule' }, { name: 'onDrill', type: 'handler name (optional)' }],
    variants: [{ label: 'Radar', note: 'centered hero band; now solid · potential dashed' }, { label: 'Drill', note: 'rows → categoryDetail() in the aux panel' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Radar ~320px; rows drop the bar.', tablet: 'As desktop.', desktop: 'Radar hero band, full-width table (single column at every width).' }, content: { mobile: 'Full detail via drill.', tablet: 'Full.', desktop: 'Full.' } }
  },
  categoryDetail: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Category detail (aux)', sig: 'categoryDetail(score, key)',
    blurb: 'The standardised 5-section per-category drill-down behind the Investability aux panel: verdict standfirst · figure strip · THE FIVE SIGNALS (the spine — all 5 VSS sub-signals: chip + canonical SUB_Q question + note) · what-would-lift (derived from flagged signals) · contribution & standing. Same shape on every engagement, degrades to a scaffold when unrated. Returns {title, subtitle, body} for openAux().',
    maxw: 440, pad: true,
    html: () => DS.categoryDetail(SCORE, 'moat').body,
    props: [{ name: 'score.categories[].subs', type: '[{slug,score∈{0,.5,1,null},note}]' }, { name: 'SUB_Q', type: 'shared/investability-view.js (canonical labels)' }, { name: 'key', type: "category key e.g. 'moat'" }],
    variants: [{ label: 'Has headroom', note: 'section 4 ranks the flagged signals by lift' }, { label: 'At ceiling', note: 'section 4 → “no diligence headroom”' }, { label: 'Forming', note: 'all 5 rows render as a scaffold; no fabricated numbers' }], usedIn: ['Assessment (aux)'],
    adaptive: { status: 'built', layout: { mobile: 'Figures 2×2; signal rows stack.', tablet: 'Figures 1×4.', desktop: 'Figures 1×4.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  caseEditorial: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Case, both ways (editorial)', sig: 'caseEditorial(a)',
    blurb: 'Bull and bear as two accent-railed cards. Counts derive from the arrays; a side with no points shows a muted empty row, not a hollow shell.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.caseEditorial(A)}</div>`,
    props: [{ name: 'a.bull', type: 'string[]' }, { name: 'a.bear', type: 'string[]' }],
    variants: [{ label: 'Uneven / empty', note: 'align-items:start; empty side → “No material points”' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Cards stack, natural height.', tablet: 'Side by side.', desktop: 'Side by side.' }, content: { mobile: 'All points kept.', tablet: 'Full.', desktop: 'Full.' } }
  },
  conditionsKill: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Conditions + kill-risk (editorial)', sig: 'conditionsKill(a)',
    blurb: 'What-must-be-true as a numbered list beside the biggest kill-risk pull-quote. Balanced (align-items:center); with no kill-risk it reflows to a single readable measure.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.conditionsKill(A)}</div>`,
    props: [{ name: 'a.mustBeTrue', type: 'string[]' }, { name: 'a.biggestRisk', type: '{label,headline,text}' }],
    variants: [{ label: 'Count-aware', note: 'sub-label reads “all three” from the array length' }, { label: 'No kill-risk', note: ':has() reflow to one column' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Conditions then kill-risk, full width.', tablet: 'Two-column.', desktop: 'Two-column, centred.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  diligenceEditorial: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Diligence checklist (editorial)', sig: 'diligenceEditorial(a)',
    blurb: 'The pre-wire gate — severity-grouped items with a segmented progress strip. Counts, the wire-gate copy, the segments, numbering and the cleared/empty states all DERIVE from a.diligence.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.diligenceEditorial(A)}</div>`,
    props: [{ name: 'a.diligence', type: '[{kind:err|warn|info, title, note, done?}]' }],
    variants: [{ label: 'Gate', note: 'red lock while blockers open; lock_open + clear when all done' }, { label: 'Empty', note: '0 items → clean-assessment state' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Gate + segments wrap; rows keep the 3-col grid.', tablet: 'As desktop.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  verdictSignoff: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Sign-off & provenance (editorial)', sig: 'verdictSignoff(a)',
    blurb: 'The operator endorsement + evidence provenance line. Status-driven: the green “signed” look only when a.signoff exists; otherwise a neutral “awaiting sign-off”.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.verdictSignoff(A)}</div>`,
    props: [{ name: 'a.signoff', type: '{by,at,note} | null' }, { name: 'a.confidence', type: '{level,line}' }],
    variants: [{ label: 'Signed vs pending', note: 'neutral surface + pending icon when unsigned' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Provenance wraps; icon pins to line 1.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  /* ── legacy card-style assessment organisms (still available; superseded on assess.html by the editorial set above) ── */
  verdictCard: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Verdict card', sig: 'verdictCard(a, score)',
    blurb: 'The recommendation headline — verdict, conviction, ask, thesis, kill-risk, must-be-trues, confidence, sign-off. The most important organism in the product.',
    maxw: 720, pad: true,
    html: () => DS.verdictCard(A, SCORE),
    props: [{ name: 'a.recommendation / conviction / thesis', type: 'string' }, { name: 'a.biggestRisk', type: '{label,text}' }, { name: 'a.mustBeTrue', type: 'string[]' }, { name: 'a.signoff', type: '{by,at,note}' }, { name: 'score', type: '{composite,band}' }],
    variants: [{ label: 'Signed off vs not', note: 'the sign-off callout renders only when present' }], usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Verdict-pill / score split stacks; score becomes a full-width band above the thesis.', tablet: 'Two-column header; body full width.', desktop: 'Two-column header.' }, content: { mobile: 'Thesis clamps to 3 lines (read more); must-be-trues stay; sign-off note collapses.', tablet: 'Full thesis + note.', desktop: 'Everything.' } }
  },
  investabilityMini: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Investability (mini)', sig: 'investabilityMini(score)',
    blurb: 'The bento summary of the score — now-vs-potential radar + per-category bars.',
    maxw: 440, pad: true,
    html: () => DS.investabilityMini(SCORE),
    props: [{ name: 'score.composite / potential', type: 'number' }, { name: 'score.categories', type: '[{label,frac,pot,num}]' }],
    variants: [{ label: 'With onFull', note: '“Full scorecard” link when a handler is passed' }], usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Radar scales down; bars full width beneath.', tablet: 'As desktop.', desktop: 'Radar + bars stacked.' }, content: { mobile: 'Radar + top 3 weakest; rest behind the full link.', tablet: 'All 7.', desktop: 'All 7.' } }
  },
  investabilityScorecard: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Investability scorecard', sig: 'investabilityScorecard(score)',
    blurb: 'The full weighted 0–100 breakdown: how the score is calculated, the now-vs-potential radar, and the ranked fixes heatmap.',
    maxw: null, pad: true,
    html: () => DS.investabilityScorecard(SCORE),
    props: [{ name: 'score.contributions', type: '[[cat,weight,rated,contrib,gap]]' }, { name: 'score.categories', type: '[{key,frac,pot}]' }, { name: 'score.fixes / heatmap', type: 'array' }, { name: 'score.potential', type: 'number' }],
    variants: [{ label: 'Bands', note: 'Strong ≥0.80 · Mixed 0.50–0.79 · Gap <0.50' }], usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Each section single-column; contributions table scrolls; radar above legend/fixes.', tablet: 'Radar + fixes side-by-side; table full width.', desktop: 'Two-column .cols per section.' }, content: { mobile: 'Table shows Category + Contribution (weight/rated on toggle); top 3 fixes.', tablet: 'Full table; top 6.', desktop: 'Full table; top 6.' } }
  },
  caseBothWays: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Case both ways', sig: 'caseBothWays(a)',
    blurb: 'The bull and bear cases side by side — invest vs pass, as two mirrored lists.',
    maxw: null, pad: true,
    html: () => DS.caseBothWays(A),
    props: [{ name: 'a.bull', type: 'string[]' }, { name: 'a.bear', type: 'string[]' }], variants: [], usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Columns stack; invest first.', tablet: 'Side by side.', desktop: 'Side by side.' }, content: { mobile: 'All points kept; each clamps to 3 lines.', tablet: 'Full.', desktop: 'Full.' } }
  },
  marketSizing: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Market sizing', sig: 'marketSizing(m)',
    blurb: 'Editorial (no card): a corrected-scale lead + the TAM/SAM/SOM funnel as three metricRow bars + the SOM-dominance callout. De-duped against the hero (the 44–73× lives there).',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.marketSizing(A.market)}</div>`,
    props: [{ name: 'm.tam / sam / som', type: '{v,value}' }, { name: 'm.sizingDrop / sizingLead / sizingFact', type: 'string' }], variants: [], usedIn: ['Market', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Funnel bars collapse to value rows.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  compScan: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Comp scan', sig: 'compScan(rows)',
    blurb: 'Annotated comparable ROWS breathing on the background (no card): name + stage · optional amount/val · a "what it tells us" clause; the primary comp gets an accent left-rule + a tag. The editorial replacement for the two old comps listings.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.compScan([{ name: 'Truebill', stage: 'Seed, 2016 (pre-product)', amount: '~$1.9M', val: 'sub-$10M pre', detail: 'The deck cites the $1.275B exit, not the sub-$10M entry.', anchor: true, tag: 'the deck’s real comp' }, { name: 'Copilot Money', stage: 'Series A, Mar 2024', amount: '$6M', val: '~$20–35M post', detail: 'A live product + ~100k paying subs — more validated than MoneyGym at seed.' }, { name: 'Carta benchmark', stage: 'Seed median, Q3 2025', detail: '$60M pre = 3.75× the $16M median.', anchor: true, tag: '3.75× median' }])}</div>`,
    props: [{ name: 'rows', type: '[{name,stage,amount,val,detail,anchor,tag}]' }], variants: [{ label: 'anchor', note: 'accent left-rule + tag' }, { label: 'no figures', note: 'degrades to name + clause' }], usedIn: ['Market', 'dealValuation'],
    adaptive: { status: 'built', layout: { mobile: 'Figures drop below the name.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  dealValuation: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'The reprice', sig: 'dealValuation(v, rounds)',
    blurb: 'Editorial (no card): the reprice verdict as an eyebrow + tone chip + a net-new bear lead (the hero owns the figures) + the merged compScan comps, stage-ranked with Truebill/Carta anchored.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.dealValuation(A.valuation, A.rounds)}</div>`,
    props: [{ name: 'v.verdict', type: 'string (tone chip)' }, { name: 'v.bodyDrop / bodyLead', type: 'string' }, { name: 'v.comps', type: '[{name,stage,detail}]' }, { name: 'rounds', type: 'ASSESSMENT.rounds (figures merged in)' }], variants: [], usedIn: ['Market', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'compScan rows stack.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  benchmarkTable: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Competitive benchmark', sig: 'benchmarkTable(b)',
    blurb: 'An editorial standfirst lifted onto the background, THEN the dense 5×6 matrix in the ONE card that earns elevation (column cross-read), THEN the structural-edge callout. The tab’s single earned card.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.benchmarkTable(A.benchmark, 'openPeek')}</div>`,
    props: [{ name: 'b.leadDrop / lead / edge', type: 'string' }, { name: 'b.cols', type: 'string[]' }, { name: 'b.rows', type: '[{cells,me}]' }], variants: [{ label: 'me row', note: 'the assessed venture, highlighted' }], usedIn: ['Market', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Standfirst breathes; matrix scrolls in its card.', tablet: 'Full.', desktop: 'Full matrix.' }, content: { mobile: 'Full (scroll).', tablet: 'Full.', desktop: 'Full.' } }
  },
  marketMemo: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Market memo (editorial)', sig: 'marketMemo(a)',
    blurb: 'The whole Market tab as one editorial .brief: hero → sizing → reprice → the field. One earned card (the benchmark matrix); everything else breathes. What assess.html mounts.',
    maxw: null, pad: false,
    html: () => DS.marketMemo(A),
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.market, market, valuation, rounds, benchmark)' }],
    variants: [{ label: 'Composes', note: 'marketHero · marketSizing · dealValuation · benchmarkTable' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Single column; matrix scrolls.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  teamDiligence: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Team diligence (legacy card)', sig: 'teamDiligence(team)',
    blurb: 'Legacy card — retired from assess.html; the roster now renders editorial via founderRoster. Founders + board with a verification signal each, plus the team gaps.',
    maxw: null, pad: true,
    html: () => DS.teamDiligence(A.team),
    props: [{ name: 'team.summary', type: 'string' }, { name: 'team.members', type: '[{name,bg,signal}]' }, { name: 'team.gaps', type: 'string[]' }], variants: [{ label: 'signal', note: 'positive / flag / neutral' }], usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Signal chip drops below the name.', tablet: 'Chip inline.', desktop: 'Chip inline trailing.' }, content: { mobile: 'Bio clamps to 2 lines.', tablet: '3 lines.', desktop: 'Full.' } }
  },
  founderRoster: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Founder roster', sig: 'founderRoster(team, onOpen)',
    blurb: 'The founder cast as signal-tinted editorial rows on the background (colour IS the verdict) — the detail behind teamHero. The scannable signal column survives as a tinted monogram + a trailing signal word, no card border.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.founderRoster(A.team, 'openPeek')}</div>`,
    props: [{ name: 'team.members', type: '[{i,name,bg,signal}]' }, { name: 'onOpen', type: 'handler → inline read-more' }], variants: [{ label: 'signal', note: 'positive (green) / neutral (amber) / flag (red)' }], usedIn: ['Team', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Monogram + name + signal word; blurb clamps to 2 lines.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  teamGaps: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Team gaps', sig: 'teamGaps(team)',
    blurb: 'The team\'s structural absences as the editorial counter-argument — a mirror of conditionsKill: numbered .must "missing seats" beside a .kill "decisive hire" aside (worded so it never echoes the Verdict tab\'s kill-risk).',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.teamGaps(A.team)}</div>`,
    props: [{ name: 'team.gaps', type: 'string[]' }, { name: 'team.gapKill', type: '{tag,label,headline,text}' }], variants: [{ label: 'kill', note: 'gapKill → tinted aside' }, { label: '≤1 gap', note: 'single-column, no aside' }], usedIn: ['Team', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Conditions over the aside.', tablet: 'Two-column.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  exitLedger: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Exit ledger', sig: 'exitLedger(e)',
    blurb: 'The three exit paragraphs flattened onto the background: the returns paragraph (the repricing thesis) promoted to a drop-cap lead; acquirers + path demoted to labelled editorial prose blocks.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.exitLedger(A.exit)}</div>`,
    props: [{ name: 'e.returns', type: 'string → the lead' }, { name: 'e.acquirers / path', type: 'string → labelled notes' }], variants: [{ label: 'no returns', note: 'first paragraph becomes the lead' }], usedIn: ['Team', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  teamMemo: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Team memo (editorial)', sig: 'teamMemo(a)',
    blurb: 'The whole Team tab as one editorial .brief: hero → founder roster → the gap → the exit. Zero cards (no tabular data to protect); the thesis prints once. What assess.html mounts.',
    maxw: null, pad: false,
    html: () => DS.teamMemo(A),
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.team, team, exit)' }],
    variants: [{ label: 'Composes', note: 'teamHero · founderRoster · teamGaps · exitLedger' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Single column.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  exitReturns: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Exit & returns (legacy card)', sig: 'exitReturns(e)',
    blurb: 'Legacy card — retired from assess.html; exit now renders editorial via exitLedger. Likely acquirers, the path to liquidity, and a grounded returns view.',
    maxw: 720, pad: true,
    html: () => DS.exitReturns(A.exit),
    props: [{ name: 'e.acquirers / path / returns', type: 'string' }], variants: [], usedIn: ['Assessment'], adaptive: noAdapt
  },
  diligenceChecklist: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Diligence checklist', sig: 'diligenceChecklist(items)',
    blurb: 'The pre-wire checklist — blockers, key items and standard confirmations, tagged by severity.',
    maxw: null, pad: true,
    html: () => DS.diligenceChecklist(A.diligence),
    props: [{ name: 'item.kind', type: "'err'|'warn'|'info'" }, { name: 'item.tag / title / note', type: 'string' }], variants: [{ label: 'Blocker / Key / Standard', note: 'severities' }], usedIn: ['Assessment'], adaptive: noAdapt
  },
  keyFindings: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Key findings', sig: 'keyFindings(findings)',
    blurb: 'The handful of findings that most move the verdict, each with a status icon.',
    maxw: null, pad: true,
    html: () => DS.keyFindings(A.findings),
    props: [{ name: 'finding.icon / color / title / note', type: 'string' }], variants: [], usedIn: ['Assessment'], adaptive: noAdapt
  },
  researchList: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Deep research list (legacy card)', sig: 'researchList(items)',
    blurb: 'Legacy card — retired from assess.html; the workstreams now render editorial via researchIndex/researchRow. Every research workstream behind the verdict, each openable into the drill-down.',
    maxw: null, pad: true,
    html: () => DS.researchList(A.research),
    props: [{ name: 'item.title / note', type: 'string' }, { name: 'item.tone', type: "'p'|'s'|'w'" }, { name: 'item.tag / tagKind', type: 'string' }], variants: [{ label: 'tone', note: 'primary / success / warning' }], usedIn: ['Assessment'],
    adaptive: { status: 'proposed', layout: { mobile: 'Trailing tag + chevron drop below the title.', tablet: 'Inline.', desktop: 'Inline.' }, content: { mobile: 'Note clamps to 2 lines.', tablet: 'Full.', desktop: 'Full.' } }
  },
  researchRow: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Research row', sig: 'researchRow(r, i, onOpen)',
    blurb: 'One editorial evidence-index row — a bar-less sibling of metricRow drilling to the aux peek: a tinted workstream marker + title + one-line finding · a depth/status chip · a drill chevron.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px"><div class="profile">${DS.researchRow(A.research[0], 0, 'openPeek')}${DS.researchRow(A.research[3] || A.research[1], 3, 'openPeek')}</div></div>`,
    props: [{ name: 'r', type: '{icon,tone,title,note,tag,tagKind}' }, { name: 'i', type: 'index' }, { name: 'onOpen', type: 'peek handler' }], variants: [{ label: 'tone', note: 'primary / success / warning marker' }, { label: 'inert', note: 'no onOpen → no chevron' }], usedIn: ['Research', 'researchIndex'],
    adaptive: { status: 'built', layout: { mobile: 'Marker + title + chip + chev.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  researchIndex: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Research index', sig: 'researchIndex(items, onOpen)',
    blurb: 'The editorial evidence index (replaces the researchList card): discrete hairline-separated researchRow rows on the background so the "which workstream, how deep, what failed" scan survives.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.researchIndex(A.research, 'openPeek')}</div>`,
    props: [{ name: 'items', type: 'ASSESSMENT.research' }, { name: 'onOpen', type: 'peek handler' }], variants: [], usedIn: ['Research', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Rows stack.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  researchMemo: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Research memo (editorial)', sig: 'researchMemo(a, s)',
    blurb: 'The whole Research tab as one editorial .brief: hero → the workstream index → evidence integrity → the confidence coda. Fully editorial, zero cards (the documents moved to the Sources rail panel). What assess.html mounts.',
    maxw: null, pad: false,
    html: () => DS.researchMemo(A, SCORE),
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.research, research, confidence)' }, { name: 's', type: 'SCORE' }],
    variants: [{ label: 'Composes', note: 'researchHero · researchIndex · evidenceIntegrity · confidenceReconciliation' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Single column.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  evidenceIntegrity: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Evidence integrity', sig: 'evidenceIntegrity(a, s)',
    blurb: 'The Research tab\'s "is our own read sound?" proof — the Evidence VSS category\'s 5 fixed checks (citation density, source count, hallucination check, methodology, cross-file consistency) promoted from the Investability aux-drill onto the reading surface via the shared signalRows helper. Scales on every assessment; unrated subs render as forming chips.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.evidenceIntegrity(A, SCORE)}</div>`,
    props: [{ name: 's.categories[key=evidence].subs', type: '[{slug,score,note}] (the 5 checks)' }, { name: 'a.confidence.level', type: 'string (meta)' }], variants: [{ label: 'forming', note: 'unrated subs → – chips + "not yet scored"' }], usedIn: ['Research', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Rows stack; note wraps.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  confidenceReconciliation: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Confidence reconciliation', sig: 'confidenceReconciliation(a, s)',
    blurb: 'The Research coda: "High confidence" measures COVERAGE (we rated everything), not RESOLUTION (this much is still open). Coverage figures + a resolved/partial/open tri-count over the 35 sub-signals + the shared provLine. Fully derived, no literals.',
    maxw: 720, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.confidenceReconciliation(A, SCORE)}</div>`,
    props: [{ name: 's.categories[].subs', type: 'resolved/partial/open counts' }, { name: 'a.confidence', type: '{level,documents,sources,line}' }], variants: [], usedIn: ['researchMemo', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  provLine: {
    level: 'atom', group: 'Atoms', domain: 'Assessment', title: 'Provenance line', sig: 'provLine(c)',
    blurb: 'The confidence provenance line — a verified-icon + "High confidence · 18 documents · 32 sources · 35/35 rated". One source shared by the Verdict sign-off and the Research memo coda.',
    maxw: 640, pad: true,
    html: () => DS.provLine(A.confidence),
    props: [{ name: 'c.level', type: 'string' }, { name: 'c.line', type: 'string' }], variants: [], usedIn: ['verdictSignoff', 'researchMemo'], adaptive: noAdapt
  },
  dataRoom: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Data room', sig: 'dataRoom(docs)',
    blurb: 'The source documents behind the assessment, downloadable, with the deal memo pinned. The Research tab\'s one earned card; cross-links to the Sources rail panel to manage + re-run.',
    maxw: null, pad: true,
    html: () => DS.dataRoom(A.dataRoom),
    props: [{ name: 'doc.icon / title / note', type: 'string' }, { name: 'doc.action', type: "'tag'|'download'" }], variants: [], usedIn: ['Assessment'], adaptive: noAdapt
  },
  lifecycleStrip: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Lifecycle strip', sig: 'lifecycleStrip(steps)',
    blurb: 'A compact vertical timeline of the assessment lifecycle — intake → documents received → run → verdict → sign-off → decision. The connector fills green through the done steps; states: done / current / pending. The "playback" in the Sources panel.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px;max-width:420px">${DS.lifecycleStrip(A.lifecycle)}</div>`,
    props: [{ name: 'steps', type: '[{label, at, meta, state}]' }, { name: 'state', type: "'done'|'current'|'pending'" }], variants: [{ label: 'state', note: 'done (green) / current (accent) / pending (muted)' }], usedIn: ['sourcesPanel', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  sourcesPanel: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Sources panel', sig: 'sourcesPanel(a)',
    blurb: 'The Sources rail-panel content: the lifecycle playback + the loaded documents grouped by kind (founder uploads / data room / generated, each with a read/stored status) + re-run controls. Opened from the utility rail (the \'sources\' tool) via the window.RAIL_PANELS hook; additive to the Research data-room card. Returns {title, subtitle, body, footer} for openAux().',
    maxw: 440, pad: true,
    html: () => { const pnl = DS.sourcesPanel(A); return `<div class="brief" style="padding:8px 28px 20px;max-width:440px"><div class="title-l" style="margin-bottom:2px">${pnl.title}</div><div class="overline" style="margin-bottom:18px">${pnl.subtitle}</div>${pnl.body}</div>`; },
    props: [{ name: 'a.lifecycle', type: '[{label,at,meta,state}]' }, { name: 'a.dataRoom', type: '[{icon,title,note,kind,status}]' }, { name: 'a.run', type: '{agent,at,duration}' }], variants: [{ label: 'kind', note: 'upload / dataroom / generated groups' }], usedIn: ['Assessment', 'utilRail'],
    adaptive: { status: 'built', layout: { mobile: 'Full-width sheet.', tablet: 'Side sheet.', desktop: 'Side sheet.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },

  /* ═══════════════ TEMPLATES ═══════════════ */
  uiShell: {
    level: 'template', group: 'Templates', title: 'UI shell', sig: 'shellScaffold(active)',
    blurb: 'The reusable frame every screen inherits — two persistent shell regions (navigation drawer on the left, masthead on top) around an empty content slot. Content-agnostic: a Page fills the masthead’s inner content and pours its organisms into the slot. Shown here with skeleton placeholders.',
    maxw: null, pad: false,
    html: (inst, cfg) => DS.shellScaffold(cfg || {}),
    configurator: [
      { key: 'nav', label: 'Navigation', options: [{ v: 'drawer', l: 'Drawer' }, { v: 'rail', l: 'Rail' }] },
      { key: 'crumb', label: 'Breadcrumb', options: [{ v: '', l: 'On' }, { v: 'off', l: 'Off' }] },
      { key: 'tabs', label: 'Masthead tabs', options: [{ v: '', l: 'On' }, { v: 'off', l: 'Off' }] },
      { key: 'aux', label: 'Auxiliary panel', options: [{ v: '', l: 'Closed' }, { v: 'push', l: 'Push' }, { v: 'overlay', l: 'Overlay' }] },
      { key: 'rail', label: 'Utility rail', options: [{ v: '', l: 'Off' }, { v: 'on', l: 'On' }] }
    ],
    props: [{ name: 'navigation drawer', type: 'organism', note: 'persistent · left' }, { name: 'masthead', type: 'organism', note: 'persistent · top' }, { name: 'auxiliary panel', type: 'organism', note: 'push / overlay' }, { name: 'utility rail', type: 'organism', note: 'optional · right' }, { name: 'content slot', type: 'region', note: 'a Page fills this' }],
    variants: [{ label: 'Drawer / rail / mobile', note: 'expanded ↔ 88px rail ↔ (planned) mobile overlay' }, { label: 'Masthead content', note: 'venture header + tabs (subject) vs page title (list)' }], usedIn: ['every page'],
    adaptive: { status: 'proposed', layout: { mobile: 'Drawer → hamburger overlay; single-column content; header actions collapse.', tablet: 'Rail + fluid content.', desktop: 'Drawer + content.' }, content: { mobile: 'Content region owns what shows — see each organism’s rules.', tablet: '—', desktop: '—' } }
  },

  drillPage: {
    level: 'template', group: 'Templates', domain: 'Shell', title: 'Drill-down (companion page)', sig: 'openDrill({key,title,render,actions})',
    src: 'drill.html', harnessStart: 'desktop',   // ← the split only exists above 1080px; `fit` would show the full-bleed cover
    blurb: 'A SECOND page opens beside the current one — the nav snaps to its rail, the page narrows into a live, still-interactive master index (.is-compact), and a full companion page slides into a reserved grid track. You never navigate away. Deliberately unlike the auxiliary panel: page surface, hairline seam, its own minifying masthead, role=region not dialog. Dismissal and orientation are separate jobs: a large ✕ top-right gets you out (of every level at once), while the breadcrumb only tells you where you are. Below 1080px it becomes a full-bleed modal cover. Depth is semantic — it swaps, it never stacks a third column.',
    maxw: null, pad: false, html: null,
    props: [
      { name: 'grid', type: '5 tracks', note: '[nav][primary][drill][aux][rail] · --drill-w is 0px at rest' },
      { name: 'primary', type: '.is-compact', note: 'live index · tables de-tabularise · ~360px' },
      { name: 'trigger', type: '[data-drill="key"]', note: 'resolved from window.DRILL_PAGES' },
      { name: 'dismiss', type: 'drillClose() ✕', note: 'Esc + ✕ exit all levels; browser Back steps up one' },
      { name: 'deep link', type: '?drill=<key>', note: 'browser Back closes, never navigates away' },
      { name: 'a11y', type: 'region → dialog', note: 'non-modal split; inert + focus-trap when it covers' },
    ],
    variants: [
      { label: 'Split (>1080px)', note: 'both pages live — click another row to swap in place' },
      { label: 'Full-bleed (≤1080px)', note: 'the drill covers; primary goes inert; the ✕ replaces the hamburger' },
      { label: 'Deeper', note: 'a link inside the drill swaps to a tertiary page; the breadcrumb grows, the geometry does not' },
    ],
    usedIn: ['deep research (planned)'],
    adaptive: { status: 'built', layout: { mobile: 'Full-bleed modal cover; back arrow in the drill masthead; primary inert.', tablet: 'Full-bleed cover (≤1080px).', desktop: 'Split — 80px rail + ~360px compact primary + the companion page.' }, content: { mobile: 'Drill bodies are authored single-column — there are no container queries inside a drill.', tablet: '—', desktop: '—' } }
  },

  /* ═══════════════ PAGES ═══════════════ */
  srcRow: {
    level: 'atom', group: 'Atoms', domain: 'Workspace', title: 'Source row', sig: 'srcRow(d)',
    blurb: 'One document row — a tinted icon · name · note · Read/Stored/tag chip. Shared by the Sources rail panel and the wizard\'s deckDropzone, so an uploaded deck reads byte-identically in both.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px;max-width:420px">${DS.srcRow({ icon: 'slideshow', title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Founder upload', status: 'read' })}</div>`,
    props: [{ name: 'd', type: '{icon,title,note,status,tag}' }], variants: [{ label: 'status', note: 'read (green) / stored / tag chip' }], usedIn: ['sourcesPanel', 'deckDropzone'], adaptive: noAdapt
  },
  primerStrip: {
    level: 'organism', group: 'Organisms', domain: 'Workspace', title: 'Primer strip', sig: 'primerStrip(steps)',
    blurb: 'The evergreen "how it works" explainer — five numbered horizontal cells (deck → research → challenge → score → verdict) reusing queueItem\'s tinted icon tile. Deliberately NOT lifecycleStrip (whose done/current/pending states imply a live run). Fronts the empty-state launchpad.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.primerStrip()}</div>`,
    props: [{ name: 'steps', type: '[{icon,title,note}]' }, { name: 'heading', type: 'string' }], variants: [],
    usedIn: ['portfolioEmpty'], adaptive: { status: 'built', layout: { mobile: '5 → 1 column.', tablet: '5 → 2.', desktop: '5 across.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  portfolioEmpty: {
    level: 'organism', group: 'Organisms', domain: 'Workspace', title: 'Portfolio empty state', sig: 'portfolioEmpty(opts)',
    blurb: 'The first-run launchpad a zero-assessment operator sees — orientation hero (sectionHero + a launch CTA) → the 5-move primer → a trust band whose coverage figures live INSIDE a real MoneyGym sample-verdict card (never a standalone live-looking lockup on a zero-state screen). A launchpad, not a "no data" card. Portfolio.html swaps this in when ENGAGEMENTS.length === 0.',
    maxw: null, pad: false,
    html: () => `<div style="padding:8px 20px">${DS.portfolioEmpty()}</div>`,
    props: [{ name: 'onStart', type: 'CTA handler (→ assess-setup.html)' }, { name: 'sampleHref', type: 'the sample verdict (→ assess.html)' }],
    variants: [{ label: 'Composes', note: 'sectionHero · primerStrip · trust band + sample verdict' }], usedIn: ['portfolio.html'],
    adaptive: { status: 'built', layout: { mobile: 'Hero stacks; primer 1-col.', tablet: 'Primer 2-col.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  formField: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Form field', sig: 'formField(opts)',
    blurb: 'The reusable workspace form field — a label (+ optional "optional" tag / hint) over an outlined control: a text input by default, or a native styled <select> dropdown when `options` is passed. Plain HTML (NOT md-outlined-text-field, which mis-sizes in a narrow side-sheet), so it is reliable at any width, themeable light+dark, and the single field pattern for forms across the product.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:420px"><div class="wiz-fields">${DS.formField({ label: 'Venture name', value: 'MoneyGym' })}${DS.formField({ label: 'Website', optional: true, type: 'url', placeholder: 'https://…' })}${DS.formField({ label: 'Stage', optional: true, placeholder: 'Select stage', options: ['Pre-seed', 'Seed', 'Series A', 'Series B'], value: 'Seed' })}</div></div>`,
    props: [{ name: 'label / optional / hint', type: 'string / bool' }, { name: 'value / placeholder', type: 'string' }, { name: 'options', type: '[str | {v,l}] → <select>' }, { name: 'type / attr / id', type: 'input attrs' }],
    variants: [{ label: 'Input', note: 'default text/url/email' }, { label: 'Select', note: 'options → dropdown + chevron' }, { label: 'Focus', note: 'primary border + soft ring' }], usedIn: ['assessmentWizard', 'Workspace forms'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  wizardSteps: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Wizard steps', sig: 'wizardSteps(labels, active)',
    blurb: 'A horizontal numbered form-progress stepper (done ✓ / active / pending) — the horizontal sibling of lifecycleStrip (which stays the vertical content timeline). Ported from the live wizard\'s progress dots.',
    maxw: 460, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px">${DS.wizardSteps(['Name', 'Deck', 'Confirm'], 1)}</div>`,
    props: [{ name: 'labels', type: 'string[]' }, { name: 'active', type: 'index' }], variants: [{ label: 'state', note: 'done / active / pending' }], usedIn: ['assessmentWizard'], adaptive: noAdapt
  },
  deckDropzone: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Deck dropzone', sig: 'deckDropzone(file, opts)',
    blurb: 'The pitch-deck upload — the hard gate (an assessment can\'t run without a deck, per dispatch-run.js). Empty = a dashed dropzone; attached = the shared srcRow + a Replace button, so the deck reads identically here and in the Sources panel.',
    maxw: 560, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:560px">${DS.deckDropzone()}<div style="height:16px"></div>${DS.deckDropzone({ title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Pitch deck · ready to run' })}</div>`,
    props: [{ name: 'file', type: '{title,note} or null' }, { name: 'opts', type: '{onPick,onClear}' }], variants: [{ label: 'Empty', note: 'dashed dropzone' }, { label: 'Attached', note: 'srcRow + Replace' }], usedIn: ['assessmentWizard'], adaptive: noAdapt
  },
  assessmentWizard: {
    level: 'organism', group: 'Organisms', domain: 'Workspace', title: 'Assessment wizard', sig: 'assessmentWizard(state)',
    blurb: 'The 3-step assessment setup body — Name → Upload deck (hard gate) → Confirm & run — as a pure function of wizard state. Deck folded IN so "Create & run" already dispatches (a fix over the live [1,4] flow that strands a deck-less engagement). Entered via the AUX PANEL OVERLAY (a side sheet over the current context, never a full page — wired by initAssessmentWizard → window.openNewAssessment); fills the panel width. Launch stages the demo (→ portfolio.html?state=one).',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:20px 28px"><div style="max-width:640px;margin:0 auto">${DS.assessmentWizard({ step: 1, name: 'MoneyGym', deck: { title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Pitch deck · ready to run' } })}</div></div>`,
    props: [{ name: 'state', type: '{step, name, deck, mode, on…}' }], variants: [{ label: 'route', note: 'first-time, guided primer' }, { label: 'overlay', note: 'returning, mini primer' }], usedIn: ['assess-setup.html'],
    adaptive: { status: 'built', layout: { mobile: 'Single column; two-up fields stack.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  runBanner: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Run banner', sig: 'runBanner(runState)',
    blurb: 'The queued / running / needs-attention / limit-paused / error / done banner shown after "Create & run" (and above the forming score on the assess page). Ports the live run-banner state machine.',
    maxw: 560, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:560px">${DS.runBanner({ status: 'running' })}${DS.runBanner({ status: 'needs-attention' })}${DS.runBanner({ status: 'done' })}</div>`,
    props: [{ name: 'runState', type: '{status, label}' }], variants: [{ label: 'status', note: 'queued/running/partial/needs-attention/limit-paused/error/done' }], usedIn: ['assess-setup.html', 'assess.html'], adaptive: noAdapt
  },
  portfolioEmptyPage: {
    level: 'page', group: 'Pages', domain: 'Workspace', title: 'Portfolio · first run', sig: 'portfolio.html?state=empty', src: 'portfolio.html?state=empty',
    blurb: 'The first-run empty-state Portfolio — the same shell as the populated page, body swapped for the launchpad, the utility rail suppressed, the drawer queue badge forced to 0. One page proves empty → 1 → many via ?state=.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'template', type: 'pageShell (no rail)' }, { name: 'fills slot with', type: 'portfolioEmpty launchpad' }, { name: 'states', type: '?state=empty | one | many' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  assessSetupPage: {
    level: 'page', group: 'Pages', domain: 'Workspace', title: 'New assessment (overlay)', sig: 'assess-setup.html', src: 'assess-setup.html',
    blurb: 'The new-assessment flow demonstrated in context — the populated portfolio with the assessment wizard opened in the AUXILIARY PANEL OVERLAY (a side sheet over the pipeline). Name → Upload deck (hard gate) → Confirm & run; launch stages the demo. The same overlay is reachable from every portfolio state via the masthead "New assessment" (and the empty-state CTA).',
    maxw: null, pad: false, html: null,
    props: [{ name: 'surface', type: 'aux panel overlay (openNewAssessment)' }, { name: 'body', type: 'assessmentWizard' }, { name: 'launch', type: 'staged → portfolio.html?state=one' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  portfolioPage: {
    level: 'page', group: 'Pages', title: 'Portfolio', sig: 'portfolio.html', src: 'portfolio.html',
    blurb: 'The survey Page — the UI shell filled with the stat row + engagement table. Real workspace content.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'template', type: 'UI shell' }, { name: 'fills slot with', type: 'stat ×4 + engagement table' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  assessmentPage: {
    level: 'page', group: 'Pages', title: 'Assessment · MoneyGym', sig: 'assess.html', src: 'assess.html',
    blurb: 'The deep single-subject Page — mounted via pageShell(): drawer + masthead (avatar identity + six tabs). The Verdict tab is an editorial memo (verdictMemo); Investability is the strengthProfile and Diligence the editorial checklist; Market/Team/Research stay card-style. Real MoneyGym data; research rows open an aux drill-down.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'template', type: 'pageShell + masthead(avatar,tabs)' }, { name: 'fills slot with', type: 'verdict · investability · market · team · diligence · research' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  queuePage: {
    level: 'page', group: 'Pages', title: 'Action queue', sig: 'queue.html', src: 'queue.html',
    blurb: 'The operator to-do Page — UI shell filled with urgency-grouped queue items.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'template', type: 'UI shell' }, { name: 'fills slot with', type: 'queue items grouped by urgency' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  researchPage: {
    level: 'page', group: 'Pages', title: 'Research drill-down', sig: 'research-detail.html', src: 'research-detail.html',
    blurb: 'The long-form reading Page — UI shell + slim masthead + article and sticky contents rail.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'template', type: 'UI shell + slim masthead' }, { name: 'fills slot with', type: 'article + TOC rail + citations' }], variants: [], usedIn: [], adaptive: noAdapt
  }

};

// atomic levels, in order — the spine of the index and the side-nav
export const GROUPS = ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'];

export const LEVELS = [
  { key: 'Atoms', desc: 'The smallest building blocks — buttons, icons, pills, inputs. Not useful alone, but everything is made of them.' },
  { key: 'Molecules', desc: 'A few atoms bonded into a unit that does one job — a nav item, a search field, a venture header.' },
  { key: 'Organisms', desc: 'Distinct sections of the interface composed of molecules and atoms — the drawer, the masthead, the cards and tables.' },
  { key: 'Templates', desc: 'The page-level scaffold — the UI shell: navigation + header + an empty content slot. Content-agnostic.' },
  { key: 'Pages', desc: 'A template filled with real content — the actual workspace screens.' }
];

export function byGroup(group) {
  return Object.entries(CATALOG).filter(([, e]) => e.group === group).map(([id, e]) => ({ id, ...e }));
}

// the harness/specimen source for an entry (pages point at a real file)
export function sourceFor(id) {
  const e = CATALOG[id];
  return e && e.src ? e.src : `specimen.html?id=${id}`;
}
