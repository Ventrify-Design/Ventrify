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
import { ASSESSMENT, SCORE, ENGAGEMENTS, STATS, QUEUE, withGaps } from './data.js';
// the evidence-gap specimens render the ?state=gaps assessment — real contract-shaped gaps + a
// filed ledger, pushed through the real adapter (see data.js withGaps).
const AG = withGaps(ASSESSMENT, SCORE);

const A = ASSESSMENT;
// A realistic pre-screen result for the range components: a deck plus a thin room, which is the case the
// feature exists for. Weights are the rubric's own, so the arithmetic on screen is the real arithmetic.
const SAMPLE_RANGE = (() => {
  const CATS = [
    { key: 'market',    label: 'Market Opportunity',          weight: 0.20, of: 5, evidenced: 5 },
    { key: 'team',      label: 'Team & Founder-Market Fit',   weight: 0.25, of: 5, evidenced: 3 },
    { key: 'product',   label: 'Product & Solution Clarity',  weight: 0.15, of: 5, evidenced: 5 },
    { key: 'moat',      label: 'Technical / Competitive Moat', weight: 0.15, of: 5, evidenced: 2 },
    { key: 'financial', label: 'Financial Defensibility',     weight: 0.10, of: 5, evidenced: 1 },
    { key: 'execution', label: 'Execution & Traction',        weight: 0.10, of: 5, evidenced: 1 },
    { key: 'evidence',  label: 'Evidence Integrity',          weight: 0.05, of: 5, evidenced: 5 },
  ];
  const SCORE = 3.4;   // mean rated score on the evidenced signals
  const categories = CATS.map(c => {
    const f = (c.evidenced * SCORE) / (c.of * 5);
    const ce = (c.evidenced * SCORE + (c.of - c.evidenced) * 3) / (c.of * 5);
    return { ...c, floorPct: Math.round(f * 100), ceilingPct: Math.round(ce * 100) };
  });
  const floor = Math.round(categories.reduce((a, c) => a + c.weight * c.floorPct, 0));
  const ceiling = Math.round(categories.reduce((a, c) => a + c.weight * c.ceilingPct, 0));
  const evidencedWeight = Math.round(categories.reduce((a, c) => a + c.weight * (c.evidenced / c.of), 0) * 100);
  return { floor, ceiling, width: ceiling - floor, evidencedWeight, categories };
})();

const noAdapt = null;

// ── Slottable molecules — what can fill a sectionHero slot. Add a molecule here → it becomes
//    selectable in the Section-hero configurator (and any other slot-based organism). ──
const SLOT_MOLECULES = {
  statement: () => DS.statementLockup(),
  score: () => DS.scoreLockup({ now: 72, potential: 88 }),
  progress: () => DS.progressLockup({ label: 'Pre-wire clearance', done: 0, total: 9, status: 'Do not wire', tone: 'bad', segments: [{ kind: 'err' }, { kind: 'err' }, { kind: 'err' }, { kind: 'warn' }, { kind: 'warn' }, { kind: 'warn' }, { kind: 'info' }, { kind: 'info' }, { kind: 'info' }], capRight: '3 blockers · 3 key · 3 standard' }),
  radar: () => DS.radarLockup({ score: SCORE.composite, now: SCORE.composite, potential: SCORE.potential, categories: SCORE.categories }),
  valuation: () => DS.valuationLockup({ multiple: '3.75', multipleSuffix: '× seed median', band: 'Rich — reprice', tone: 'bad', asked: 60, defensibleLo: 15, defensibleHi: 35, scaleMax: 70 }),
  coverage: () => DS.coverageLockup(),
  figures: () => DS.keyFigures([{ v: '$1.4B', l: 'TAM' }, { v: '28%', l: 'CAGR' }, { v: '6:1', l: 'LTV / CAC' }]),
  empty: () => '',
};
const SLOT_OPTS = [
  { v: 'statement', l: 'Statement lockup' }, { v: 'score', l: 'Score lockup' }, { v: 'progress', l: 'Progress lockup' },
  { v: 'radar', l: 'Radar lockup' }, { v: 'valuation', l: 'Valuation lockup' }, { v: 'coverage', l: 'Coverage lockup' },
  { v: 'figures', l: 'Key figures' }, { v: 'empty', l: '— empty —' }
];
const byV = v => SLOT_OPTS.find(o => o.v === v);
// right slot lists the metric molecules first (statement is the usual left half)
const SLOT_OPTS_R = ['score', 'progress', 'radar', 'valuation', 'coverage', 'statement', 'figures', 'empty'].map(byV);

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
  iconBtn: {
    level: 'atom', group: 'Atoms', title: 'Icon button', sig: '.m3-icon-btn',
    blurb: 'The icon-only affordance (.m3-btn is a fixed-height pill and cannot do this). A 40px circular transparent button — 44px on coarse pointers for the touch target. `.danger` tints it error-red for destructive row actions; it is deliberately QUIET (revealed on row hover/focus) because a destructive control on a row that NAVIGATES is easy to hit by accident. Used for delete on the portfolio row.',
    maxw: 320, pad: true,
    html: () => `<div style="display:flex;gap:12px;align-items:center"><button class="m3-icon-btn" aria-label="More"><span class="material-symbols-rounded">more_vert</span></button><button class="m3-icon-btn danger" aria-label="Delete"><span class="material-symbols-rounded">delete</span></button><button class="m3-icon-btn danger" disabled aria-label="Delete"><span class="material-symbols-rounded">delete</span></button></div>`,
    props: [{ name: '.danger', type: 'class → error tone' }, { name: '[disabled]', type: 'opacity .38 + inert' }],
    variants: [{ label: 'default' }, { label: 'danger' }, { label: 'disabled' }], usedIn: ['engagementTable (delete)'], adaptive: noAdapt
  },
  linearProgress: {
    level: 'atom', group: 'Atoms', title: 'Linear progress', sig: 'linearProgress(opts)',
    blurb: 'THE progress bar. `value` 0–100 → determinate; null/`indeterminate` → the sliding indeterminate bar. The .m3-prog CSS existed for a while with no render fn, so the markup got hand-inlined in several places — this is the single source. Rule: render a determinate bar ONLY when you have a real number. An indeterminate bar is honest about not knowing; a fabricated percentage is not.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:420px;display:flex;flex-direction:column;gap:16px">${DS.linearProgress({ value: 36 })}${DS.linearProgress({ value: 84 })}${DS.linearProgress({ indeterminate: true })}${DS.linearProgress({ value: 62, danger: true })}</div>`,
    props: [{ name: 'value', type: '0–100 | null' }, { name: 'indeterminate', type: 'bool' }, { name: 'danger', type: 'bool → error fill' }],
    variants: [{ label: 'determinate' }, { label: 'indeterminate', note: 'when the real number does not exist yet' }, { label: 'danger' }],
    usedIn: ['runBanner', 'engagementTable', 'New-assessment panel'], adaptive: noAdapt
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
    blurb: 'A single headline number + label (+ optional sub), boxed. Still right for a LONE figure (the team page uses one). A GROUP of counts now goes through figureStrip instead — four boxed tiles above a de-carded table read as a different product from the assessment they link into.',
    maxw: 260, pad: true,
    html: () => DS.statCard(STATS[3]),
    props: [{ name: 'n', type: 'string' }, { name: 'l', type: 'string' }, { name: 'sub', type: 'string?' }],
    variants: [{ label: 'With sub', note: 'e.g. "119 / 168 outputs"' }], usedIn: ['Portfolio'],
    adaptive: { status: 'proposed', layout: { mobile: 'Row of 4 → 2×2, then single column below 400px.', tablet: '2×2 grid.', desktop: 'Row of 4.' }, content: { mobile: 'Drop the sub-caption; number + label only.', tablet: 'Keep sub.', desktop: 'Keep sub.' } }
  },
  figureStrip: {
    level: 'molecule', group: 'Molecules', domain: 'Portfolio', title: 'Figure strip', sig: 'figureStrip(stats)',
    blurb: 'The same counts statCard renders, de-carded: figures sit ON the page between two hairlines, divided by one more. A boxed tile says "this is a thing"; a count of engagements is not a thing, it is a measurement of the list beneath it — so the portfolio landing reads like the assessment figure strips rather than like a different product. A zero dims rather than disappears, because "0 awaiting a deck" is an answer and dropping the cell would make the strip jump width between loads. Collapses 4 to 2 columns below 900px.',
    maxw: 760, pad: true,
    html: () => DS.figureStrip(STATS),
    props: [{ name: 'stats', type: '[{n, l}]' }],
    variants: [{ label: 'zero', note: 'dimmed, never dropped' }], usedIn: ['Portfolio landing'], adaptive: noAdapt
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
    level: 'organism', group: 'Organisms', domain: 'Portfolio', title: 'Engagement table', sig: 'engagementTable(rows, opts)',
    blurb: 'The portfolio list. Sits ON the page — no container card, the same treatment every other table in the product now gets. opts.groups renders it banded instead of flat: ONE table with a caption row per group, not a table per group, so the columns cannot drift apart between bands; the visible column header goes sr-only but stays in the accessibility tree. DS.triageGroups(rows) derives those groups from the row data — Needs you / In flight / Settled, first match wins — so the page answers what needs me before what exists, and a venture changes group the moment its state does. A filtered or searched view drops the grouping, since the filter is already the answer to which ones. opts.onDelete (a global handler NAME) opts IN a trailing destructive column.',
    maxw: null, pad: true,
    html: () => DS.engagementTable(ENGAGEMENTS),
    props: [{ name: 'row.name / sub', type: 'string' }, { name: 'row.stage', type: 'string' }, { name: 'row.status', type: '{kind,label,icon}' }, { name: 'row.progress', type: '0–1', note: 'or row.rec' }, { name: 'row.when', type: 'string' }],
    variants: [{ label: 'In-flight vs Assessed', note: 'progress bar vs recommendation pill + score' }, { label: 'Danger', note: 'red track for stuck' }], usedIn: ['Portfolio'],
    adaptive: { status: 'proposed', layout: { mobile: 'Table → stacked cards: venture + status on top, stage/progress/activity as labelled rows.', tablet: 'Drop Stage + Last activity into a second line.', desktop: 'Full 5-column table.' }, content: { mobile: 'Venture, status, primary signal only; stage + timestamp move into the Assessment.', tablet: 'Add stage back.', desktop: 'All columns.' } }
  },
  queueItem: {
    level: 'organism', group: 'Organisms', domain: 'Action queue', title: 'Queue item', sig: 'queueItem(item)',
    blurb: 'A single actionable ROW — urgency-coloured icon tile, what/why, and primary + secondary action. Editorial: a hairline between rows, no card background (the queue is a list, not a stack of tubs).',
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
    blurb: 'The Section hero atop the Investability tab — recycled statementLockup (left, copy from a.heroes.investability) + radarLockup (right, the score as the shape of its categories, derived from SCORE.categories) + thesis. Same frame as the verdict hero, molecule swapped.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.investabilityHero(SCORE, A)}</div>`,
    props: [{ name: 'score', type: 'SCORE' }, { name: 'a', type: 'ASSESSMENT (a.heroes.investability copy)' }],
    variants: [{ label: 'Composes', note: 'sectionHero( statementLockup · radarLockup )' }], usedIn: ['Assessment'],
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
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Team hero', sig: 'teamHero(a, score)',
    blurb: 'The Section hero atop the Team tab — recycled statementLockup (left) + benchLockup (right: the cast split into who runs the company, who advises it, and the seats nobody is in) + thesis. Takes the score as a second argument so the numeral can be the team category\'s OWN score, and DROPS a hero fact that merely restates that same N / 5 — the runner writes one more often than not, and the lockup now owns the figure.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.teamHero(A, SCORE)}</div>`,
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.team + team.members + team.gaps)' }, { name: 'score', type: 'SCORE → the team category (num, weightPct, subs)' }],
    variants: [{ label: 'Composes', note: 'sectionHero( statementLockup · benchLockup )' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Statement over bench.', tablet: 'Two-column.', desktop: 'Full.' }, content: { mobile: 'Pills wrap; tiers keep their order.', tablet: 'Full.', desktop: 'Full.' } }
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
    blurb: 'The headline-score lockup — TWO graphics locked together, each doing a job the other cannot. The DIAL is a 270° sweep placing the score on 0–100, with the headroom ghosted behind it. The STABILITY STRIP zooms into the three blind draws and shows how far apart they landed — which a 0–100 rail cannot, because three draws inside three points are one invisible dot at that scale. Replaces the old number/bar/pill. Pass `draws` to get the strip; without them it says so rather than inventing a spread, which is what every real run renders today (the runner publishes the median and keeps nothing else).',
    maxw: 420, pad: true,
    html: () => DS.scoreLockup({ now: 55, potential: 76, band: 'Promising', tone: 'mid', draws: [49, 61, 55], }),
    props: [{ name: 'label', type: 'string · eyebrow' }, { name: 'score / now', type: 'number · the published composite' }, { name: 'max', type: 'number · default 100' }, { name: 'potential', type: 'number · ghosts the headroom arc; omit and none is drawn' }, { name: 'band', type: 'string · the band label' }, { name: 'tone', type: "'good'|'mid'|'bad' · colours dial, chip and strip" }, { name: 'draws', type: 'number[] · the blind draws; omit → "not recorded"' }],
    variants: [
      { label: 'Tone', note: 'good (green) · mid (amber) · bad (red) — dial, chip and strip all follow' },
      { label: 'Solid vs indicative', note: 'a spread of ≤5 pts reads "solid"; wider reads "indicative"' },
      { label: 'No draws', note: 'omit `draws` — the strip states it plainly instead of faking a spread' },
      { label: 'No headroom', note: 'omit `potential` — no ghost arc' },
      { label: 'Composition', note: 'pass `categories` — adds "what makes the N": real sub-signal pips per category, each row\'s CONTRIBUTION (weight × score) so the column sums to the headline, and a total that states the rounding (54.5 → 55). The x/5 figures deliberately are NOT used: they sum to 80.0 at 80 and 52.9 at 55, so they look correct on one assessment and contradict the next.' },
    ],
    usedIn: ['sectionHero', 'verdictMemo', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Dial shrinks to 136px, strip stays full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
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
  radarLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Radar lockup', sig: 'radarLockup(opts)',
    blurb: 'Sibling to scoreLockup that re-expresses the score as the SHAPE of its categories. Reads in the family\'s order — eyebrow, the numeral, the now/potential radar that explains it, then a split (strong/mixed/gap) + headroom caption. Fronts the Investability hero. Axes and labels DERIVE from `categories`: no axis count, key list or label map is assumed, so a five-category rubric draws five. Supersedes profileLockup. Zero is the innermost grid ring rather than the centre point, so a venture with nothing rated still draws a shape instead of collapsing to a dot.',
    maxw: null, pad: true,
    /* Four states, because a molecule that only works on the live fixture is not a
       molecule. These are the cases the product actually hands it. */
    html: () => {
      const mk = f => SCORE.categories.map(f);
      const cell = (t, o) => `<div style="min-width:0"><div style="font:500 11px/1 var(--font-mono,monospace);letter-spacing:.08em;color:var(--md-sys-color-outline);margin-bottom:10px">${t}</div>${DS.radarLockup(o)}</div>`;
      return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px 40px">
        ${cell('LIVE · 7 CATEGORIES', { score: SCORE.composite, now: SCORE.composite, potential: SCORE.potential, categories: SCORE.categories })}
        ${cell('FORMING · NOTHING RATED', { score: 0, now: 0, potential: 0, categories: mk(c => ({ ...c, frac: 0, pot: 0, subs: (c.subs || []).map(x => ({ ...x, score: null })) })) })}
        ${cell('A FIVE-CATEGORY RUBRIC', { score: 52, now: 52, potential: 70, categories: SCORE.categories.slice(0, 5) })}
        ${cell('AT CEILING · NO HEADROOM', { score: SCORE.composite, now: SCORE.composite, potential: SCORE.composite, categories: mk(c => ({ ...c, pot: c.frac })) })}
      </div>`;
    },
    props: [{ name: 'label', type: 'string' }, { name: 'score / max', type: 'number' }, { name: 'now / potential', type: 'number' }, { name: 'categories', type: 'SCORE.categories → derives axes, split, caption' }, { name: 'rated / total', type: 'number (override the derived signal count)' }, { name: 'hole', type: 'number — radius of the zero ring (default 16); raise it to clear a numeral placed in the middle' }, { name: 'weightDots', type: 'bool — vertex radius ∝ category weight' }],
    variants: [
      { label: 'Derived', note: 'pass categories → axes, labels, split and caption all computed' },
      { label: 'Forming', note: 'no signal rated → labels read "–", caption reads "0 of N rated", never "7 gaps"' },
      { label: 'At ceiling', note: 'no headroom anywhere → the dashed potential ring is omitted, not drawn over the solid' },
      { label: 'Any rubric', note: 'five categories draw a pentagon; nothing assumes 7×5' }
    ], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; the chart scales with the column and the numeral clamps.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Caption wraps to two rows.', tablet: 'Full.', desktop: 'Full.' } }
  },
  clearanceLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Clearance lockup', sig: 'clearanceLockup(opts)',
    blurb: 'Sibling to scoreLockup expressing a GATE: how many checks still block a wire, the gate chip, then one cell per check. Fronts the Diligence tab. Replaces a borrowed progressLockup whose numeral read “0 of 9 cleared” — which says all nine gate the wire, and diligenceEditorial\'s own gateOpen has never believed that. The numeral now counts BLOCKERS, which is what the rule is actually about. Composes unitGrid. ⚠ Nothing in the OS writes `done` yet (the adapter hardcodes false), so the cleared states below are built and correct but not yet reachable in the product.',
    maxw: null, pad: true,
    /* The shapes a real run produces. Counts are never 3/3/3 by rule — the runner writes free
       text and the adapter maps it, so a clean deal can be 0/2/4 and a messy one 7/0/1. */
    html: () => {
      const D = ASSESSMENT.diligence;
      const cell = (t, o) => `<div style="min-width:0"><div style="font:500 11px/1 var(--font-mono,monospace);letter-spacing:.08em;color:var(--md-sys-color-outline);margin-bottom:10px">${t}</div>${DS.clearanceLockup(o)}</div>`;
      const only = k => D.filter(d => d.kind === k);
      return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px 40px">
        ${cell('LIVE · 3 BLOCK / 3 KEY / 3 STANDARD', { items: D })}
        ${cell('BLOCKERS CLEARED · gate opens', { items: D.map(d => d.kind === 'err' ? { ...d, done: true } : d) })}
        ${cell('NO BLOCKERS AT ALL', { items: D.filter(d => d.kind !== 'err') })}
        ${cell('ONE BLOCKER, NOTHING ELSE', { items: only('err').slice(0, 1) })}
        ${cell('A CLEAN ASSESSMENT · nothing open', { items: [] })}
        ${cell('30 CHECKS · cells cap and carry the rest', { items: Array.from({ length: 30 }, (_, i) => D[i % D.length]) })}
        ${cell('AN UNKNOWN SEVERITY · drawn, not dropped', { items: [...D.slice(0, 2), { kind: 'critical', title: 'A severity the adapter has never emitted' }] })}
        ${cell('EVERYTHING CLEARED', { items: D.map(d => ({ ...d, done: true })) })}
      </div>`;
    },
    props: [
      { name: 'label', type: 'string — the eyebrow' },
      { name: 'items', type: '[{kind, title, done}] — a.diligence, straight from the adapter' },
      { name: 'maxCells', type: 'number (default 24) — past it the last cell carries the remainder' },
    ],
    variants: [
      { label: 'Gate = blockers', note: 'only a gating severity counts toward the numeral and the chip; key/standard never lock a wire' },
      { label: 'Derived legend', note: 'built from the severities PRESENT — a standard-only assessment shows one entry, not three with two zeroes' },
      { label: 'Unknown severity', note: 'an unrecognised kind falls through to the neutral cell rather than vanishing from the chart' },
      { label: 'Self-omitting', note: 'no items → “Nothing to clear”, no grid, no legend, and an honest sentence' },
    ], usedIn: ['diligenceEditorial', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Cells wrap within the column.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Legend wraps to two rows.', tablet: 'Full.', desktop: 'Full.' } }
  },
  unitGrid: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Unit grid', sig: 'unitGrid(opts)',
    blurb: 'One cell per discrete thing, tinted by kind, with a state glyph — the unit is the item, so nothing is averaged: nine checks draw nine cells and three draw three. Sorted by severity order, capped with a “+N” remainder cell. Generic over [{kind, done, title}]. A grid of cells is a CHART, so it carries one role="img" and a derived summary label and the cells are hidden — reading nine cell names aloud would just duplicate the checklist below it; `title` still gives a sighted user the item on hover.',
    maxw: 420, pad: true,
    html: () => {
      const D = ASSESSMENT.diligence;
      const row = (t, o) => `<div style="margin-bottom:22px"><div style="font:500 11px/1 var(--font-mono,monospace);letter-spacing:.08em;color:var(--md-sys-color-outline);margin-bottom:10px">${t}</div>${DS.unitGrid(o)}</div>`;
      return row('NINE · MIXED SEVERITY', { items: D, label: 'nine checks' })
        + row('PART CLEARED', { items: D.map((d, i) => i % 3 === 0 ? { ...d, done: true } : d), label: 'three cleared' })
        + row('FORTY · CAPPED AT 24', { items: Array.from({ length: 40 }, (_, i) => D[i % D.length]), label: 'forty checks' })
        + row('ONE', { items: D.slice(0, 1), label: 'one check' });
    },
    props: [
      { name: 'items', type: '[{kind, done, title}] — kind keys the SEVERITY map in ds.js' },
      { name: 'max', type: 'number (default 24) — the last cell becomes “+N”' },
      { name: 'label', type: 'string — the role="img" summary a screen reader gets instead of the cells' },
    ],
    variants: [
      { label: 'Severity-ordered', note: 'DOM order is severity order, so the blockers land first — and the entrance animation follows the DOM' },
      { label: 'Open vs cleared', note: 'different glyph AND different fill, so the state survives without colour' },
      { label: 'Overflow', note: 'past `max` the final cell carries the remainder and the summary label still states the true total' },
      { label: 'Tooltips', note: 'hovering a cell gives the severity + the check\'s title as the heading and its full note as the body — the whole reason a cell can be one glyph. Replaces a native `title`, which waits a second, cannot wrap and never showed the note' },
    ], usedIn: ['clearanceLockup', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Wraps; 40px cells hold at every width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  benchLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Bench lockup', sig: 'benchLockup(opts)',
    blurb: 'Sibling to scoreLockup expressing a TEAM as a bench: the category score, then the cast arranged into who runs the company, who advises it, and the seats nobody is in. Fronts the Team tab. Replaces a borrowed progressLockup whose numeral was a count of the people we could look up — diligence hygiene, not a judgement — and whose single row of pips averaged away the one pattern that changes a decision: a verified board above an unverified executive team. Tiering is a regex on the member\'s role, so nothing is venture-specific; a member with no matching role counts as executive. Composes signalTier.',
    maxw: null, pad: true,
    /* The states a real run produces. The MoneyGym fixture is the luxury case; a live
       assessment routinely arrives with no board, no gaps, or nothing scored at all. */
    html: () => {
      const T = A.team, cat = SCORE.categories.find(c => c.key === 'team') || {};
      const cell = (t, o) => `<div style="min-width:0"><div style="font:500 11px/1 var(--font-mono,monospace);letter-spacing:.08em;color:var(--md-sys-color-outline);margin-bottom:10px">${t}</div>${DS.benchLockup(o)}</div>`;
      const base = { label: 'Team signal', members: T.members, gaps: T.gaps, score: cat.num, weightPct: cat.weightPct };
      return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px 40px">
        ${cell('LIVE · EXEC + BOARD + GAPS', base)}
        ${cell('NO BOARD, NO GAPS', { ...base, members: T.members.filter(m => !DS.isBoardRole(DS.memberParts(m).role)), gaps: [] })}
        ${cell('FORMING · NOTHING SCORED', { ...base, score: null, weightPct: null })}
        ${cell('TWO-PERSON TEAM', { ...base, members: T.members.slice(0, 2), gaps: T.gaps.slice(0, 1) })}
        ${cell('NOBODY NAMED YET', { ...base, members: [], gaps: [] })}
        ${cell('TEN GAPS · SEATS CAP AT 7', { ...base, gaps: [...T.gaps, ...T.gaps] })}
      </div>`;
    },
    props: [
      { name: 'label', type: 'string — the eyebrow' },
      { name: 'members', type: '[{i, person, role, signal}] — role drives the tiering' },
      { name: 'gaps', type: 'string[] — one empty seat each, drawn UNLABELLED' },
      { name: 'score / max', type: 'the team category score; null → "Forming"' },
      { name: 'weightPct', type: 'number — drives the "N% of the score" caption' },
      { name: 'execLabel / boardLabel / seatLabel', type: 'string — tier headings' },
      { name: 'maxSeats', type: 'number (default 7) — cap on drawn seats' },
    ],
    variants: [
      { label: 'Tiered', note: 'role matches /ned|advisor|chair|board|observer|investor|mentor/ → board; everything else builds the thing' },
      { label: 'Self-omitting', note: 'no board → no board tier; no gaps → no seat tier; no members → one honest line' },
      { label: 'Forming', note: 'nothing scored → "Forming", and the weight caption is suppressed rather than printing 0%' },
      { label: 'Unlabelled seats', note: '`gaps` is free prose and not every entry is a role — the count is drawn, a parsed role name is not' },
      { label: 'Seat tooltips', note: 'hovering a seat shows the gap VERBATIM — which role is missing and why. The em-dash split into heading + body is presentational; both halves show either way, so a gap without a dash loses nothing' },
    ], usedIn: ['teamHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; pills wrap within each tier.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Tier metas wrap under the label.', tablet: 'Full.', desktop: 'Full.' } }
  },
  signalTier: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Signal tier', sig: 'signalTier(opts)',
    blurb: 'One labelled band of signal-tinted people-pills: an eyebrow, a derived tally on the right, and the pills. Generic over any [{i, label, signal, icon}] set — `signal` picks the tint and an item with an `icon` and no label renders as an empty-seat outline. An empty tier renders NOTHING, so a self-omitting caller never leaves a dangling heading. Extracted out of benchLockup so a second tiering (by function, by tenure, by workstream) reuses it instead of re-growing it.',
    maxw: 520, pad: true,
    html: () => {
      const T = A.team;
      const pill = m => ({ i: m.i, label: (DS.memberParts(m).role.split('/')[0] || '').trim(), signal: m.signal });
      return `<div style="display:grid;gap:18px">
        ${DS.signalTier({ label: 'Running the company', meta: '0 of 3 verified · 2 flagged', items: T.members.filter(m => !DS.isBoardRole(DS.memberParts(m).role)).map(pill) })}
        ${DS.signalTier({ label: 'Board & advisory', meta: '2 of 3 verified', items: T.members.filter(m => DS.isBoardRole(DS.memberParts(m).role)).map(pill) })}
        ${DS.signalTier({ label: 'Seats nobody is in', meta: '5 to hire', items: T.gaps.map(() => ({ icon: 'person_add' })) })}
        ${DS.signalTier({ label: 'Meta as a verdict (opt-in)', meta: 'escalate', metaTone: 'bad', items: T.members.slice(0, 2).map(pill) })}
      </div>`;
    },
    props: [
      { name: 'label', type: 'string — rendered as the house .eyebrow atom, not a second label treatment' },
      { name: 'items', type: '[{i, label, signal, icon, kind, alt, tip}] — `kind` forces a class (the outline on a labelled overflow pill); `alt` is the screen-reader name of an icon-only pill; `tip` is {title, body, kind} for the shared hover tooltip' },
      { name: 'meta', type: 'string — the right-hand tally' },
      { name: 'metaTone', type: "'' | 'bad' — a TALLY stays neutral; only opt in when the meta really is a verdict" },
    ],
    variants: [
      { label: 'positive / neutral / flag', note: 'the roster\'s container pairs — colour IS the verdict, one source for both views' },
      { label: 'seat', note: 'icon + no label → a dashed outline: nothing is in it, so nothing is filled in' },
      { label: 'Empty', note: 'no items → renders nothing at all' },
    ], usedIn: ['benchLockup', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Pills wrap.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  valuationLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Valuation lockup', sig: 'valuationLockup(opts)',
    blurb: 'Sibling to scoreLockup expressing a CORRECTIVE premium — the ask, the defensible band and the overshoot between them, on a MEASURED AXIS. The axis is the point: the original version was an 8px track with a coloured band and an unlabelled tick, so you could see the ask was high but not against what, and the one number that mattered had to be read out of the caption. Ticks are DERIVED on a 1/2/2.5/5 ladder from the range, because a $60M seed and a $900M growth round land on this same component. Only the part above the ceiling is amber — the ask itself is not a warning, the overshoot is. Fronts the Market tab. Takes explicit numeric opts in $M, never parses prose.',
    maxw: null, pad: true,
    /* The states the live adapter actually produces. It regex-matches the band out of the
       valuation note and emits null when the note is not phrased "$A–$B pre", and it emits
       no `multiple` at all on a real run — so the shippable cases are the middle two, and
       the MoneyGym fixture on the left is the luxury one. */
    html: () => {
      const V = A.valuation || {};
      const base = { label: 'Valuation verdict', band: V.verdict, tone: 'mid', multipleSuffix: V.multipleSuffix };
      const cell = (t, o) => `<div style="min-width:0"><div style="font:500 11px/1 var(--font-mono,monospace);letter-spacing:.08em;color:var(--md-sys-color-outline);margin-bottom:10px">${t}</div>${DS.valuationLockup(o)}</div>`;
      return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px 40px">
        ${cell('OVER THE BAND · full fixture', { ...base, multiple: V.multiple, asked: V.asked, defensibleLo: V.defensibleLo, defensibleHi: V.defensibleHi, scaleMax: V.scaleMax })}
        ${cell('NO MULTIPLE · the common real case', { ...base, asked: V.asked, defensibleLo: V.defensibleLo, defensibleHi: V.defensibleHi, scaleMax: V.scaleMax })}
        ${cell('NO BAND · note not parseable', { ...base, asked: V.asked })}
        ${cell('INSIDE THE BAND · nothing to reprice', { ...base, band: 'Fairly priced', tone: 'good', asked: 25, defensibleLo: 15, defensibleHi: 35, scaleMax: 40 })}
        ${cell('NO ASK AT ALL · nothing priced yet', { ...base, band: '', asked: 0 })}
        ${cell('A $900M GROWTH ROUND · the ladder rescales', { ...base, band: 'Rich — reprice', asked: 900, defensibleLo: 400, defensibleHi: 620 })}
      </div>`;
    },
    props: [{ name: 'label', type: 'string' }, { name: 'multiple / multipleSuffix', type: 'number — omit and the ask carries the numeral' }, { name: 'band / tone / bandIcon', type: 'verdict chip' }, { name: 'asked / defensibleLo / defensibleHi / scaleMax', type: 'number ($M)' }, { name: 'askedLabel / bandLabel', type: 'string — the two figures stated above the bar' }],
    variants: [
      { label: 'Over the band', note: 'the overshoot is hatched and dimensioned on the chart, in the warning colour — not described underneath it' },
      { label: 'Inside the band', note: 'no overshoot drawn, and the read says so rather than printing a 0' },
      { label: 'No band', note: 'band null → the bar keeps the ask and states that no band is set, never "$0–0M"' },
      { label: 'Derived ticks', note: 'a tick label centres on its tick, except within 4% of either end — decided per tick, because the last tick is not the end of the scale' },
      { label: 'No multiple', note: 'the runner emits none on a real run → the ask becomes the numeral' }
    ], usedIn: ['sectionHero', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width; the bar and axis hold at 330px.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Ticks thin out naturally — the ladder keys off the range, not the width.', tablet: 'Full.', desktop: 'Full.' } }
  },
  coverageLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Coverage lockup', sig: 'coverageLockup(opts)',
    blurb: 'Sibling to scoreLockup for an evidence base — a big completeness numeral + a confidence tone chip + a demoted, dot-separated provenance figure-row (no bar; one dominant numeral, not a row of equals). Fronts the Research tab. Rendered here with defaults.',
    maxw: 340, pad: true,
    html: () => DS.coverageLockup(),
    props: [{ name: 'label / ratedLabel', type: 'string' }, { name: 'rated / total', type: 'number' }, { name: 'numeral', type: 'string · overrides the rated/total figure whole' }, { name: 'confidence / tone / confidenceIcon', type: 'confidence chip' }, { name: 'bandSuffix', type: "string · default ' confidence'; '' when the band states its own whole phrase" }, { name: 'facts', type: '[{v, k}] provenance units' }],
    variants: [{ label: 'Complete', note: 'rated == total → good tone' }, { label: 'No provenance', note: 'empty facts → strip omitted' }, { label: 'Non-assessment', note: "numeral + bandSuffix:'' re-point it at any x-of-n measure — the Team screen uses it for cover of the book" }], usedIn: ['sectionHero', 'Assessment', 'Team', 'Admin'],
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
    blurb: 'The reusable "top of a section" — TWO molecule SLOTS (left + right) + an optional thesis. Defaults to statementLockup (left) + scoreLockup (right) for the verdict; pass explicit `left`/`right` HTML to swap in any molecule per section. One empty slot → a single-molecule hero: one column capped to a readable measure, no divider, no 300px floor (that floor exists to reserve room for the TALL slot, and there is none). The thesis sits inside the left column in BOTH cases, so the gap below the facts is the same either way.',
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
    blurb: 'The ONE shared row for the Investability tab — label · bar · value(+sub-line) · drill chevron. The leading severity DOT was retired: it restated what the bar, the value and the section footer\'s strong/mixed/gap split already said, six of seven rows drew the same colour, and its ramp did not even order (gap, the worst band, rendered as a pale brand tint while mixed rendered grey). Dropping it also put these labels on the same left edge as every other row on the tab. Both the strength profile AND the contributions table compose it; only the bar payload + value strings differ, so the two lists read as one component with identical hover, chevron and keyboard focus.',
    maxw: 640, pad: true,
    html: () => `<div class="brief" style="padding:0"><div class="profile">
      ${DS.metricRow({ key: 'moat', label: 'Technical / competitive moat', sub: '15% weight · gap', bar: { now: 0.3, pot: 0.9, tick: true }, value: '1.5', sub2: { text: '→ 4.5', tone: 'up' }, onDrill: 'void' })}
      ${DS.metricRow({ key: 'team', label: 'Team & founder-market fit', sub: '25% weight · rated 3.0/5', bar: { now: 0.6, pot: 0.6 }, value: '+15.0', sub2: { text: 'at ceiling', tone: 'flat' }, onDrill: 'void' })}
      ${DS.metricRow({ label: 'Investability score', value: '55', valueMuted: ' / 100', foot: true })}
    </div>
    <div class="profile" style="margin-top:26px">
      ${DS.row({ variant: 'spec', title: 'Plan', trail: { kind: 'value', value: 'Full platform licence' } })}
      ${DS.row({ variant: 'spec', title: 'Custom domain', trail: { kind: 'value', value: '', valueMuted: 'Enterprise only' } })}
    </div></div>`,
    props: [{ name: 'label / sub', type: 'string' }, { name: 'dot', type: "'strong'|'mixed'|'gap'|null" }, { name: 'bar', type: '{now:0..1, pot:0..1, tick}' }, { name: 'value / valueMuted', type: 'string' }, { name: 'sub2', type: '{text, tone:up|flat}' }, { name: 'onDrill / foot', type: 'handler | bool' }],
    variants: [{ label: 'Strength face', note: 'severity dot + 0–5 bar + tick' }, { label: 'Contribution face', note: 'no dot + share-of-100 bar' }, { label: 'Spec face', note: "DS.row({variant:'spec'}) — label + a value that SIZES TO ITSELF. The metric face's value column is a fixed 104px because it holds scores; a slug, a plan name or a date just wraps in it. Nowrap above 640px, wraps below. Used by Settings." }, { label: 'Drill', note: 'chevron + role=button + Enter/Space' }, { label: 'Foot', note: 'total row — no bar / no chevron' }], usedIn: ['Assessment', 'Settings'],
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
    blurb: 'The full-width per-category contributions table (metricRow rows: weight · rated · a share-of-100 bar · +contribution · upside-available · chevron). Rows drill into the aux panel. The radar that used to sit on top of this as a centred band now fronts the hero as radarLockup — one chart, one place — so the table gets the whole row it was already sharing.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.investabilityComposition(SCORE)}</div>`,
    props: [{ name: 'score.categories', type: '[{key,label,weightPct,frac,pot,num}]' }, { name: 'row', type: 'metricRow molecule' }, { name: 'onDrill', type: 'handler name (optional)' }],
    variants: [{ label: 'Radar', note: 'centered hero band; now solid · potential dashed' }, { label: 'Drill', note: 'rows → categoryDetail() in the aux panel' }], usedIn: ['Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Radar ~320px; rows drop the bar.', tablet: 'As desktop.', desktop: 'Radar hero band, full-width table (single column at every width).' }, content: { mobile: 'Full detail via drill.', tablet: 'Full.', desktop: 'Full.' } }
  },
  categoryDetail: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Category detail (aux)', sig: 'categoryDetail(score, key)',
    blurb: 'The standardised per-category drill-down behind the Investability aux panel: verdict standfirst · figure strip · THE FIVE SIGNALS (the spine — all 5 VSS sub-signals: chip + canonical SUB_Q question + note + the lift that signal is worth) · contribution & standing. It used to carry a sixth block, "What would lift it", which re-printed the same questions with the same notes in a different order — for a category with headroom the panel said everything twice and ran 1306px deep. The lift now rides on the signal that earned it and that block\'s closing sentence became this one\'s footnote. Returns {size:\'wide\', title, subtitle, body} for openAux() — it declares its own panel width, because a rubric question needs a reading measure.',
    maxw: 680, pad: true,
    html: () => DS.categoryDetail(SCORE, 'moat').body,
    props: [{ name: 'score.categories[].subs', type: '[{slug,score∈{0,.5,1,null},note}]' }, { name: 'SUB_Q', type: 'shared/investability-view.js (canonical labels)' }, { name: 'key', type: "category key e.g. 'moat'" }],
    variants: [{ label: 'Has headroom', note: 'section 4 ranks the flagged signals by lift' }, { label: 'At ceiling', note: 'section 4 → “no diligence headroom”' }, { label: 'Forming', note: 'all 5 rows render as a scaffold; no fabricated numbers' }], usedIn: ['Assessment (aux)'],
    adaptive: { status: 'built', layout: { mobile: 'Figures 2×2; signal rows stack.', tablet: 'Figures 1×4.', desktop: 'Figures 1×4.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  caseEditorial: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Case, both ways (editorial)', sig: 'caseEditorial(a)',
    blurb: 'Bull and bear as two columns on the BACKGROUND — no card, no shadow. A card says “separate object”, and the two sides of an argument are one argument; boxing each half made the Verdict tab read as a dashboard rather than a memo. The structure the card implied now comes from a hairline between the columns, a 2px rule under each heading in the side\'s colour (the bar that used to run down the card edge), and the tick/cross markers. Counts derive from the arrays; a side with no points shows a muted empty row, not a hollow shell. Stacked below 900px the divider turns with the columns.',
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
  openEvidence: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Open evidence gaps', sig: 'openEvidence(a)',
    blurb: 'What the assessment LOOKED FOR AND COULD NOT FIND — and therefore docked the venture for. OUR miss, not the venture\u2019s, so it leads the Diligence tab in its own words. SELF-OMITTING: a venture we found everything on renders nothing. Shows the ceiling (cappedAt) and what the scorer actually gave \u2014 NEVER a projected point gain (that would rebuild the dial in the presentation layer).',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.openEvidence(AG)}</div>`,
    props: [{ name: 'a.gaps', type: '[{id, subject, checkKind, outcome, sought, searched[], signals[], cappedAt, observedScore, closesWith[], status}]' }],
    variants: [{ label: 'Open', note: 'rows open the filing panel' }, { label: 'Empty', note: 'no gaps \u2192 renders nothing at all' }], usedIn: ['Assessment \u00b7 Diligence'],
    adaptive: { status: 'built', layout: { mobile: 'Rows stack; the chip drops its hover label.', tablet: 'As desktop.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  gapChip: {
    level: 'atom', group: 'Atoms', domain: 'Assessment', title: 'Gap chip (file evidence)', sig: 'gapChip(gapId, label)',
    blurb: 'The ONE \u201cthis was not found \u2014 you can point us at it\u201d affordance, used wherever a gap is READ (founder roster \u00b7 signal rows \u00b7 diligence list). Its verb is \u201cFile evidence\u201d, never \u201cFix\u201d or \u201cOverride\u201d: the operator supplies a POINTER TO EVIDENCE, not a claim about evidence.',
    maxw: 460, pad: true,
    html: () => DS.gapChip('team-lancaster-cto', 'Not found'),
    props: [{ name: 'gapId', type: 'string \u00b7 sanitised by the adapter' }, { name: 'label', type: 'Not found | Unverified | Partial' }],
    variants: [{ label: 'Hover', note: 'reveals the \u201cFile evidence\u201d verb' }], usedIn: ['Assessment \u00b7 Team / Investability / Diligence'],
    adaptive: { status: 'built', layout: { mobile: 'Label hidden \u2014 the row itself opens the panel.', tablet: 'As desktop.', desktop: 'Full.' }, content: { mobile: 'Icon + state.', tablet: 'Full.', desktop: 'Full.' } }
  },
  gapHonesty: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Gap honesty note', sig: 'gapHonesty()',
    blurb: 'THE HONEST MOMENT, and its own component precisely so it cannot be edited out of one surface and left in another. It says the two things the operator must know before he files: he is asserting nothing, and THE SCORE CAN GO DOWN. He cannot know which way it moves before he commits, and he does not get to choose.',
    maxw: 520, pad: true,
    html: () => DS.gapHonesty(),
    props: [], variants: [], usedIn: ['Assessment \u00b7 gap filing panel'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  gapReceipt: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Gap receipt', sig: 'gapReceipt(filing)',
    blurb: 'What the SYSTEM did with the pointer \u2014 filed / captured / fetch-failed. The FAILURE state is first-class, not an error: LinkedIn 999s a datacenter fetcher, and half the registers that matter are JS-only. It names the way out (\u201csave the page as a PDF and upload it\u201d) and the panel keeps the form beneath it, or the operator hits a dead end.',
    maxw: 520, pad: true,
    html: () => [DS.gapReceipt({ status: 'captured', bytes: 41208, finalUrl: 'https://find-and-update.company-information.service.gov.uk/x', contentSha: 'ab12cd34ef56', filedBy: 'antony@ventrify.io', rescoredIn: 's1' }), DS.gapReceipt({ status: 'fetch-failed', httpStatus: 999, fetchError: 'the site returned a login wall, not a profile', url: 'https://www.linkedin.com/in/x/', filedBy: 'antony@ventrify.io' })].join('<div style="height:12px"></div>'),
    props: [{ name: 'filing', type: '{status, bytes, contentSha, httpStatus, fetchError, url, finalUrl, filedBy, rescoredIn}' }],
    variants: [{ label: 'Captured', note: 'bytes held \u00b7 sha \u00b7 not yet scored' }, { label: 'Fetch-failed', note: 'blocked \u2014 upload instead' }], usedIn: ['Assessment \u00b7 gap filing panel'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  scoreMovement: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'The re-score \u2014 what moved', sig: 'scoreMovement(filings)',
    blurb: 'After a re-score: WHICH SIGNALS MOVED AND WHICH WAY. Renders a FALL exactly as plainly as a rise \u2014 a fall is the mechanism WORKING (the source did not support the claim), and softening it would turn the feature back into a dial. A re-score that moved nothing is also a result and is stated as one. Deltas are READ from the ledger (publish.js), never re-derived here.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.scoreMovement(AG.filings)}</div>`
      + `<div class="brief" style="padding:8px 28px 20px">${DS.scoreMovement(AG.filings.map(f => ({ ...f, instrumentChanged: true })))}</div>`,
    props: [{ name: 'filings', type: '[{rescoredIn, signalDelta:[{slug,from,to}], compositeDelta, batchRecords, instrumentChanged}]  \u2014 compositeDelta MAY BE NEGATIVE' }],
    variants: [{ label: 'Up' }, { label: 'Down', note: 'the source contradicted the claim \u2014 rendered just as plainly' }, { label: 'Held', note: 'read, and changed nothing' }, { label: 'Model upgraded', note: 'instrumentChanged \u2014 the move is reported but NOT credited to the evidence' }], usedIn: ['Assessment \u00b7 Investability'],
    adaptive: { status: 'built', layout: { mobile: 'Rows stack.', tablet: 'As desktop.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  roomCheck: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Data room \u2014 what is missing', sig: 'roomCheck({docCount, classes, strengtheners})',
    blurb: 'The pre-run playback of a LINKED data room. Reports the SAME six founder artefact classes the scorer counts for financial.files_complete \u2014 not a parallel checklist, which would eventually disagree with the score. Says \u201cwe could not see it\u201d rather than \u201cyou are missing it\u201d, because a class can be satisfied inside another document and chasing a document the founder already sent is worse than silence.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.roomCheck({ docCount: 46, classes: [
      { key: 'financial_model', label: 'Financial model', found: true, seenIn: 'MoneyGym - Customer and Finance Base Case v0.11.xlsx', want: '' },
      { key: 'unit_economics', label: 'Unit economics', found: true, seenIn: 'MoneyGym_Unit_Economics_v21 (FINAL).docx', want: '' },
      { key: 'cost_basis', label: 'Cost basis', found: true, seenIn: 'MoneyGym_LLM_Cost_Assumptions.docx', want: '' },
      { key: 'ownership', label: 'Ownership / cap table', found: false, want: 'A cap table, equity split, share register, SAFE or option schedule' },
      { key: 'corporate_legal', label: 'Corporate / legal', found: true, seenIn: 'Copy of DebtFit Inc Cert of Incorporation.pdf', want: '' },
      { key: 'observed_metrics', label: 'Observed metrics or primary research', found: false, want: 'At least one number this venture measured \u2014 a pilot, waitlist, funnel or primary interviews' },
    ], strengtheners: [
      { key: 'loi', label: 'A signed LOI, pilot or customer contract', why: 'Demand validation scores highest when a counterparty outside the company has paid or committed in writing' },
    ] })}</div>`,
    props: [{ name: 'check', type: '{docCount, classes:[{key,label,found,seenIn,want}], strengtheners:[{label,why}]}' }],
    variants: [{ label: 'Gaps found', note: 'the normal case \u2014 chase, or run anyway' }, { label: 'All six present', note: 'header flips; no chase prompt' }], usedIn: ['New assessment \u00b7 data room'],
    adaptive: { status: 'built', layout: { mobile: 'Rows stack; the trailing state wraps under the label.', tablet: 'As desktop.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  scoreProvenance: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Score provenance \u2014 how many times, on what', sig: 'scoreProvenance(snapshots)',
    blurb: 'A re-run CANNOT BE INVISIBLE. Every score this deck was given is on the record, and runs are told apart on TWO halves: the EVIDENCE (founder\u2019s room + operator records) and the INSTRUMENT (rubric + scoring model). Only runs matching on both are re-rolls, and only a re-roll\u2019s spread is flagged as the tool\u2019s fault \u2014 a model upgrade or filed evidence is named for what it is.',
    maxw: 640, pad: true,
    html: () => {
      const P = { sha: 'a1b2c3d4e5f60718', docs: 58 }, R = '9f8e7d6c5b4a3921', M = { model: 'claude-opus-5', effort: 'max', cli: '2.1.278' };
      const s = (composite, extra = {}) => ({ composite, provenanceHash: P, augmentHash: null, rubricHash: R, scorer: M, ...extra });
      const sets = [
        [s(67), s(73), s(78)],                                                        // re-roll, spread \u2192 warn
        [s(73), s(73), s(73)],                                                        // re-roll, stable
        [s(75), s(76, { augmentHash: { sha: '130766ae2e3d9495', records: 1 } })],     // operator filed evidence
        [s(73, { scorer: undefined }), s(71)],                                        // scoring model upgraded
        [s(67, { scorer: undefined }), s(73, { scorer: undefined }), s(78, { scorer: undefined }), s(71)],  // upgrade AFTER a re-roll spread — the earlier disagreement survives
        [s(64, { provenanceHash: { sha: '0000aaaa1111bbbb', docs: 41 } }), s(73)],    // the deck / data room changed
        [{ composite: 24.5 }, { composite: 68 }],                                     // legacy: before fingerprinting
      ];
      return sets.map(x => DS.scoreProvenance(x)).join('<div style="height:10px"></div>');
    },
    props: [{ name: 'snapshots', type: '[{composite, provenanceHash:{sha}, augmentHash:{sha}|null, rubricHash, scorer:{model,effort,cli}}]  \u2014 oldest first' }],
    variants: [{ label: 'Re-roll (warn)', note: 'same evidence + same instrument, different number' }, { label: 'Re-roll (stable)' }, { label: 'Operator evidence', note: 'same room, new augmentHash' }, { label: 'Model upgraded', note: 'same evidence, new scorer.model' }, { label: 'Upgraded after a spread', note: 'an upgrade does not erase the earlier runs’ disagreement — stays warn' }, { label: 'Evidence changed' }, { label: 'Legacy', note: 'predates fingerprinting' }], usedIn: ['Assessment \u00b7 Investability'],
    adaptive: { status: 'built', layout: { mobile: 'Full width, wraps.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
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
    blurb: 'An editorial standfirst, THEN the matrix, THEN the structural-edge callout — all on the background. The matrix used to sit in the “one card that earns its container”; it does not, because the table\'s own header rule and row hairlines already do everything the card did, and a filled panel mid-memo reads as a widget pasted into an argument. De-carded it needs FLUSH EDGES to belong: the end cells drop their padding so the first column aligns with the prose above. The “us” row keeps its highlight as a tint plus an accent edge rather than a solid fill, which on the background had become louder than the verdict.',
    maxw: null, pad: false,
    html: () => `<div class="brief" style="padding:8px 28px 20px">${DS.benchmarkTable(A.benchmark, 'openPeek')}</div>`,
    props: [{ name: 'b.leadDrop / lead / edge', type: 'string' }, { name: 'b.cols', type: 'string[]' }, { name: 'b.rows', type: '[{cells,me}]' }], variants: [{ label: 'me row', note: 'the assessed venture — tint + accent left edge, not a solid fill' }, { label: 'Overflow', note: 'the matrix scrolls horizontally inside .tbl-scroll below ~900px; the page never does' }], usedIn: ['Market', 'Assessment'],
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
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Team memo (editorial)', sig: 'teamMemo(a, score)',
    blurb: 'The whole Team tab as one editorial .brief: hero → founder roster → the gap → the exit. Zero cards (no tabular data to protect); the thesis prints once. What assess.html mounts. Passes the score through to teamHero so the bench can head the tab with the team\'s own category score.',
    maxw: null, pad: false,
    html: () => DS.teamMemo(A, SCORE),
    props: [{ name: 'a', type: 'ASSESSMENT (heroes.team, team, exit)' }, { name: 'score', type: 'SCORE → forwarded to teamHero' }],
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
  lifecycleStrip: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Lifecycle strip', sig: 'lifecycleStrip(steps)',
    blurb: 'A compact vertical timeline of the assessment lifecycle — intake → documents received → run → verdict → sign-off → decision. The connector fills green through the done steps; states: done / current / pending. The "playback" in the Sources panel.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:8px 28px 20px;max-width:420px">${DS.lifecycleStrip(A.lifecycle)}</div>`,
    props: [{ name: 'steps', type: '[{label, at, meta, state}]' }, { name: 'state', type: "'done'|'current'|'pending'" }], variants: [{ label: 'state', note: 'done (green) / current (accent) / pending (muted)' }], usedIn: ['sourcesPanel', 'Assessment'],
    adaptive: { status: 'built', layout: { mobile: 'Full width.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  chatPanel: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Assistant panel', sig: 'chatPanel(c)',
    blurb: 'The Assist rail-panel content: a conversation with the assessment assistant about ONE venture. The assistant reads the distilled layer only — verdict, scorecard and deep research, plus a filename-only manifest — never the founder\'s documents, and it has no web access. Citations are a visible part of the component rather than a detail: every answer carries numbered references keyed to source chips, and a cited id that does not exist in the assessment renders as a loud unverified marker instead of being quietly dropped, because a stripped bad citation leaves the sentence looking sourced. Rendering only — the page owns sending, subscribing and scroll. Returns {title, subtitle, body, footer} for openAux().',
    maxw: 440, pad: true,
    html: () => { const pnl = DS.chatPanel({ ventureName: 'Verdana Bio', messages: [
      { role: 'user', text: 'What is the single biggest risk here?' },
      { role: 'assistant', cited: ['verdict', 'vss:financial'], text: 'The **8% loss rate**. It is the one output the whole model rests on, and nothing in the room evidences it [[verdict]]. Financial Discipline scores 2 of 5 largely because of it [[vss:financial]].' },
      { role: 'user', text: 'What is their CAC in Germany?' },
      { role: 'assistant', cited: ['manifest'], text: 'Not covered. The research pass did not surface a German CAC [[manifest]]. If the figure exists it would be in Q3_Financial_Model.xlsx, which I cannot read.' },
      { role: 'assistant', cited: ['verdict'], invalid: ['research:revenue-deep-dive'], text: 'Revenue grew 300% last quarter [[unverified: research:revenue-deep-dive]], which supports the thesis [[verdict]].' },
      { role: 'user', text: 'What is the minimum cash position?' },
      { role: 'assistant', cited: ['research:unit-economics'], unsupportedFigures: [{ value: '3,363,774' }], text: 'Minimum cash is $3,363,774⟨not in sources⟩ at month 13 [[research:unit-economics]]. The drop from month 12 is about $1.19M⟨derived⟩, which is my subtraction rather than a figure the research reports.' },
      { role: 'user', text: 'Here is the FDA letter confirming the trial: https://example.com/fda-letter.pdf' },
      { role: 'assistant', cited: ['gaps'], text: 'That speaks directly to the open clinical-corroboration gap [[gaps]]. Filing it means the next run fetches the letter, reads it and re-scores — the score can move either way.',
        proposals: [{ tool: 'propose_file_evidence', title: 'File this evidence against a gap', detail: 'Gap 2ec6a2e5: open on this assessment', lines: ['https://example.com/fda-letter.pdf', 'FDA letter corroborating the trial'], cta: 'File evidence' }] },
      { role: 'assistant', cited: ['freshness'], text: 'Three documents have arrived since the assessment ran [[freshness]].',
        proposals: [{ tool: 'propose_rescan_room', title: 'Re-read the data room', detail: 'Reads only what has changed since last time. Seconds, no model cost.', lines: [], cta: 'Re-read now', committed: 'Read 3 new · 1 updated.' },
                    { tool: 'propose_rerun', title: 'Re-run the whole assessment', detail: 'Over an hour of compute, and it will publish a new score.', lines: ['Three new financial documents the current score did not see'], warn: true, cta: 'Re-run assessment' }] },
    ] }); return `<div class="brief" style="padding:8px 28px 20px;max-width:440px"><div class="title-l" style="margin-bottom:2px">${pnl.title}</div><div class="overline" style="margin-bottom:18px">${pnl.subtitle}</div>${pnl.body}<div style="margin-top:16px">${pnl.footer}</div></div>`; },
    props: [{ name: 'c.ventureName', type: 'string' }, { name: 'c.messages', type: '[{role,text,cited,invalid,stub,dropped}]' }, { name: 'c.pending', type: 'boolean — shows the thinking indicator' }],
    variants: [{ label: 'role', note: 'user (bubble, right) / assistant (flowed, with references)' }, { label: 'invalid', note: 'a cited source that is not in the assessment — red inline marker + warning' }, { label: 'figures', note: 'a number absent from the corpus is marked "not in sources"; one the assistant calculated and disclosed is marked "derived"' }, { label: 'stub', note: 'no API key configured — says so rather than faking an answer' }],
    usedIn: ['Assessment', 'utilRail'],
    adaptive: { status: 'built', layout: { mobile: 'Full-width sheet; composer pinned to the foot.', tablet: 'Side sheet.', desktop: 'Side sheet.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
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
  docDropzone: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Document dropzone', sig: 'docDropzone(files, opts)',
    blurb: 'THE file dropzone — one component, two presets. Empty = a dashed target; attached = the shared srcRow(s) so a file reads identically here and in the Sources panel. `single:true` is the pitch deck (one file + Replace); the default is multi (a stack + "Add more" + per-file Remove) for the data room. Both live in the New-assessment AUX PANEL, which is where an assessment is created start-to-finish — never a second page. Pass `status:\'\'` for staged files: they have NOT been read or stored yet, so they must not wear the Sources panel\'s Read/Stored chip.',
    maxw: 560, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:560px">${DS.docDropzone([], { icon: 'folder_open', prompt: 'Add data-room documents', sub: 'Financials, cap table, contracts, metrics — PDF, DOCX, XLSX, CSV, TXT, MD or ZIP.' })}<div style="height:16px"></div>${DS.docDropzone([{ title: 'cap-table.xlsx' }, { title: 'metrics-2025.csv' }], { status: '', note: 'Data room · uploads when you create', addLabel: 'Add more documents' })}</div>`,
    props: [{ name: 'files', type: '[{title,note,icon}]' }, { name: 'opts', type: '{icon,prompt,sub,fileIcon,note,status,clearLabel,addLabel,single,onPick,onClear}' }],
    variants: [{ label: 'Empty', note: 'dashed target' }, { label: 'single', note: 'pitch deck — one file + Replace' }, { label: 'multi', note: 'data room — stack + Add more' }],
    usedIn: ['New-assessment panel (deck + data room)', 'deckDropzone'], adaptive: noAdapt
  },
  deckDropzone: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Deck dropzone', sig: 'deckDropzone(file, opts)',
    blurb: 'The pitch-deck upload — the hard gate (an assessment can\'t run without a deck, per dispatch-run.js). Now the single-file PRESET of docDropzone (output byte-identical); reach for docDropzone directly for anything new.',
    maxw: 560, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:560px">${DS.deckDropzone()}<div style="height:16px"></div>${DS.deckDropzone({ title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Pitch deck · ready to run' })}</div>`,
    props: [{ name: 'file', type: '{title,note} or null' }, { name: 'opts', type: '{onPick,onClear}' }], variants: [{ label: 'Empty', note: 'dashed dropzone' }, { label: 'Attached', note: 'srcRow + Replace' }], usedIn: ['assessmentWizard'], adaptive: noAdapt
  },
  assessmentWizard: {
    level: 'organism', group: 'Organisms', domain: 'Workspace', title: 'Assessment wizard', sig: 'assessmentWizard(state)',
    blurb: 'SUPERSEDED — use createScreen. The 3-step aux-panel setup body (Name → Upload deck → Confirm & run). Setup is a full page now: the panel was ~390px at every viewport, so the data-room read could only ever be a footnote under the Drive field, and the read is the point. Kept only because portfolio.html / portfolio-brand.html still demo the overlay affordance. Do not build on it.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:20px 28px"><div style="max-width:640px;margin:0 auto">${DS.assessmentWizard({ step: 1, name: 'MoneyGym', deck: { title: 'MoneyGym — Seed pitch deck v0.1a.pdf', note: 'Pitch deck · ready to run' } })}</div></div>`,
    props: [{ name: 'state', type: '{step, name, deck, mode, on…}' }], variants: [{ label: 'route', note: 'first-time, guided primer' }, { label: 'overlay', note: 'returning, mini primer' }], usedIn: ['assess-setup.html'],
    adaptive: { status: 'built', layout: { mobile: 'Single column; two-up fields stack.', tablet: 'Full.', desktop: 'Full.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  runBanner: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Run banner', sig: 'runBanner(runState, opts)',
    blurb: 'The queued / running / needs-attention / limit-paused / error / done banner shown after "Run assessment" (and above the forming score on the assess page). PROGRESS IS HONEST: the runner writes step/totalSteps/progress to runState only once it is actually running — at "queued" totalSteps is 0 — so the bar is determinate ONLY with real numbers and indeterminate otherwise. Never fabricate a percentage. Also renders the step counter + elapsed time, rs.error, a republish-aware title (rs.phase), and — when the run has STALLED (queued >3min / running >20min) — a warning plus the only mid-run control that exists: Re-run. There is no Cancel anywhere in the pipeline, so none is offered.',
    maxw: 560, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:560px">${DS.runBanner({ status: 'queued', requestedAt: new Date().toISOString() })}${DS.runBanner({ status: 'running', totalSteps: 11, step: 4, progress: 36, label: 'Section 4 · Market and timing…', startedAt: new Date(Date.now() - 6 * 60000).toISOString() })}${DS.runBanner({ status: 'queued', requestedAt: new Date(Date.now() - 5 * 60000).toISOString() })}${DS.runBanner({ status: 'needs-attention' })}${DS.runBanner({ status: 'done' })}</div>`,
    props: [{ name: 'runState', type: '{status, label}' }], variants: [{ label: 'status', note: 'queued/running/partial/needs-attention/limit-paused/error/done' }], usedIn: ['assess-setup.html', 'assess.html'], adaptive: noAdapt
  },
  portfolioEmptyPage: {
    level: 'page', group: 'Pages', domain: 'Workspace', title: 'Portfolio · first run', sig: 'portfolio.html?state=empty', src: 'portfolio.html?state=empty',
    blurb: 'The first-run empty-state Portfolio — the same shell as the populated page, body swapped for the launchpad, the utility rail suppressed, the drawer queue badge forced to 0. One page proves empty → 1 → many via ?state=.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'template', type: 'pageShell (no rail)' }, { name: 'fills slot with', type: 'portfolioEmpty launchpad' }, { name: 'states', type: '?state=empty | one | many' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  missingDocs: {
    level: 'molecule', group: 'Molecules', domain: 'Workspace', title: 'Missing documents', sig: 'missingDocs(a)',
    blurb: 'Documents the operator HANDED OVER that never made it in. This exists because a dropped document used to live and die in a transient TOAST — so you could run an assessment believing the agents had read your cap table when it never arrived, and the verdict would be reached without it. A dropped document is a DATA-INTEGRITY fact, not a notification: it is persisted on the engagement (EA.ingestDocs records it) and shown until dealt with — beside the very evidence list it is missing from, on every state of the assessment page, and MOST loudly once a verdict exists (because that verdict was reached without it). Re-adding the document clears it automatically; Dismiss is there for a file that genuinely does not belong.',
    maxw: 620, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:620px">${DS.missingDocs({ inputs: { skipped: [{ name: 'Cap table — post-SAFE.xlsx', reason: 'No readable text, and no original was stored. Re-upload the file so the original can be kept for a direct read.' }, { name: 'Board minutes 2025.pptx', reason: 'Unsupported file type.' }] } })}</div>`,
    props: [{ name: 'a.inputs.skipped', type: '[{name, reason, at}]' }],
    variants: [{ label: 'none', note: 'renders NOTHING when there is nothing to report' }, { label: 'one' }, { label: 'many' }],
    usedIn: ['inputManifest', 'assess-next (every state)'], adaptive: noAdapt
  },
  assessRunningPage: {
    level: 'page', group: 'Pages', domain: 'Workspace', title: 'Assessment · assessing', sig: 'assess-running.html', src: 'assess-running.html',
    blurb: 'THE ASSESSING STATE — "the memo, before the ink lands." A run in flight is not a loading state: it is the assessment ITSELF, mid-formation. So this is the SAME editorial surface as the finished verdict (sectionHero → reading column → .sec/.rule rhythm), with the answer\'s placeholders sitting exactly where the answer will land — "Forming" in the score\'s own slot, the eleven workstreams as a numbered table of contents in the memo\'s .must voice, the evidence named, the 7×5 composition sitting empty, and the engagement arc as a DATED record. When the verdict arrives nothing MOVES; the placeholders resolve. No tabs (there is nothing yet to switch between). THE HONESTY RULE: the step NAMES are ours (a fixed plan the runner always follows); only the POSITION comes from rs.step. Determinate bar ONLY once the runner reports a step — never a fabricated %, never a fake ETA, never a fake finding. ?state= proves every honest state, not just the flattering one: running · silent (the agent has not reported — the MOST LIKELY first state) · queued · quiet · paused · error · republish.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'body', type: 'assessingMemo(a, s, rs)' }, { name: 'masthead', type: 'no tabs · Stop (outlined) when canStopRun(rs)' }, { name: 'states', type: '?state=running|silent|queued|quiet|paused|error|republish' }], variants: [], usedIn: [], adaptive: noAdapt
  },
  rangeLockup: {
    level: 'molecule', group: 'Molecules', domain: 'Assessment', title: 'Range lockup', sig: 'rangeLockup({floor, ceiling})',
    blurb: 'The pre-screen score, which the product deliberately refuses to collapse to one number. Sibling of scoreLockup — same eyebrow, numeral and band chip — so a range and a score read as two states of one thing. NO DIAL: a dial would have to pick an end (a lie) or sweep a region (unreadable), where a lit span on a 0–100 track makes the WIDTH the most visible fact, which is the part the founder can change. When the range straddles a band boundary it publishes NO band and states both outcomes instead (spec §3.1) — a chip is a stamp, and the point is that we are declining to stamp this one.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:24px 28px;max-width:420px">${DS.rangeLockup({ floor: 48, ceiling: 71 })}<hr class="rule" style="margin:30px 0">${DS.rangeLockup({ floor: 62, ceiling: 71 })}<hr class="rule" style="margin:30px 0">${DS.rangeLockup({ floor: 67, ceiling: 67 })}</div>`,
    props: [{ name: 'floor', type: 'number — unevidenced signals at the bottom of the scale' }, { name: 'ceiling', type: 'number — unevidenced signals at par' }, { name: 'label', type: 'string' }],
    variants: [{ label: 'Straddling', note: '48–71 — no band, both outcomes stated' }, { label: 'Inside one band', note: '62–71 — the band is published' }, { label: 'Settled', note: '67–67 — a complete room has no width left' }],
    usedIn: ['rangeHero'], adaptive: noAdapt
  },
  rangeCoverage: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Range coverage', sig: 'rangeCoverage(categories)',
    blurb: 'WHY the range is as wide as it is, per category — the data room\'s story told in score points, which is the only currency the reader cares about. A category we could not evidence is shown as UNREAD with the points it is holding, never as a low score: "we cannot see it" and "it is weak" are different claims and must not share a row.',
    maxw: 720, pad: true,
    html: () => `<div class="brief" style="padding:22px 28px;max-width:720px">${DS.rangeCoverage(SAMPLE_RANGE.categories)}</div>`,
    props: [{ name: 'categories', type: '[{key,label,weight,floorPct,ceilingPct,evidenced,of}]' }],
    variants: [{ label: 'Partial', note: 'unread categories hold points' }, { label: 'Complete', note: 'every row settled' }], usedIn: ['rangeHero'], adaptive: noAdapt
  },
  rangeHero: {
    level: 'organism', group: 'Organisms', domain: 'Assessment', title: 'Range hero', sig: 'rangeHero(range, {docCount})',
    blurb: 'The Range tab\'s opening statement, built on the SAME sectionHero as the Verdict and Investability tabs so a pre-screened assessment and a scored one are visibly the same product. The headline names the width as a consequence of what we could not see — never as a property of the venture.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:20px 28px">${DS.rangeHero(SAMPLE_RANGE, { docCount: 4 })}</div>`,
    props: [{ name: 'range', type: '{floor,ceiling,evidencedWeight,categories}' }, { name: 'opts.docCount', type: 'number' }],
    variants: [{ label: 'Wide', note: 'deck only' }, { label: 'Settled', note: 'complete room, width 0' }], usedIn: ['assess-prescreen.html'], adaptive: noAdapt
  },
  createScreen: {
    level: 'template', group: 'Templates', domain: 'Workspace', title: 'Create screen', sig: 'createScreen({operators, cta})',
    blurb: 'Setting up an assessment as a FULL PAGE. Left: what you type and attach. Right: what we can see, filling in live — roomPreview() before anything is uploaded, replaced in place by roomCheck() the moment a room is read. Two actions, not one: shared/entitlements.ctaPair() swaps which is filled by audience (free tier leads with the pre-screen, a licensee with the full run). Every element id matches the retired aux panel, so the live create/ingest/dispatch chain drives it untouched.',
    maxw: null, pad: true,
    html: () => `<div class="brief" style="padding:20px 28px">${DS.createScreen({ operators: [{ v: 'op-1', l: 'Alex Doré · Program Lead' }], cta: { primary: { id: 'run_full', label: 'Run full assessment', icon: 'play_arrow' }, secondary: { id: 'run_prescreen', label: 'Run pre-screen first', icon: 'bolt' } } })}</div>`,
    props: [{ name: 'operators', type: '[{v,l}]' }, { name: 'cta', type: '{primary,secondary} from ctaPair(plan)' }, { name: 'stages', type: 'STAGES' }],
    variants: [{ label: 'Licensed', note: 'full run filled, pre-screen tonal' }, { label: 'Free tier', note: 'pre-screen filled, unlock tonal' }],
    usedIn: ['assess-setup.html', 'create-m3.html'],
    adaptive: { status: 'built', layout: { mobile: 'Single column; the live panel moves below the form, separated by a rule.', tablet: 'Single column below 1100px — two columns starve each other.', desktop: 'Two columns, live panel sticky.' }, content: { mobile: 'Full.', tablet: 'Full.', desktop: 'Full.' } }
  },
  roomPreview: {
    level: 'organism', group: 'Organisms', domain: 'Workspace', title: 'Data-room preview', sig: 'roomPreview({docCount, deck})',
    blurb: 'The data-room panel BEFORE a room has been read. Deliberately NOT roomCheck with everything absent — that would print "6 of 6 could not be found", which is true and useless, because nobody has been asked for anything yet. It states what the score LOOKS FOR, which is useful on its own: it tells someone what to go and gather. Its six classes are gated against api/_roomcheck.js by tools/room-parity.mjs so the copy can never drift from the scorer.',
    maxw: 420, pad: true,
    html: () => `<div class="brief" style="padding:20px 24px;max-width:420px">${DS.roomPreview({})}</div>`,
    props: [{ name: 'docCount', type: 'number' }, { name: 'deck', type: 'boolean' }],
    variants: [{ label: 'Idle', note: 'nothing attached' }, { label: 'Staged', note: 'counts what is waiting to upload' }], usedIn: ['createScreen'], adaptive: noAdapt
  },
  assessSetupPage: {
    level: 'page', group: 'Pages', domain: 'Workspace', title: 'New assessment', sig: 'assess-setup.html', src: 'assess-setup.html',
    blurb: 'The new-assessment flow as it ships — a full screen, not a side sheet. Details + pitch deck + data room on the left, the live data-room read on the right. ?plan=self-serve previews the free tier, where the two CTAs swap emphasis.',
    maxw: null, pad: false, html: null,
    props: [{ name: 'surface', type: 'full page (create-m3.html)' }, { name: 'body', type: 'createScreen' }, { name: 'cta', type: 'ctaPair(plan)' }], variants: [], usedIn: [], adaptive: noAdapt
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
