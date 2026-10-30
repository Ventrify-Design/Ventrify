// ============================================================
// Ventrify OS — WORKSPACE M3 card organisms (workspace-only).
// Rich portfolio + queue cards that carry full parity with the classic
// dashboard/queue. Render from the normalized rows produced by
// workspace-adapter.js. Token-only (--md-sys-color-*) + the classes in
// workspace-chrome.css. Kept OUT of ds.js so the design-system catalog
// doesn't churn and these stay workspace-scoped. Pure string builders.
// ============================================================

import { statusPill, inkOn, sectionHero, statementLockup, coverageLockup, _esc as esc } from './ds.js';   // ONE real HTML escaper — founder-controlled names/theses/queue text hit innerHTML sinks

// NOTE: the portfolio cards and the queue board were removed — the live portfolio renders through
// DS.engagementTable and the queue through DS.queueBoard (single source). This file now keeps only the
// two surfaces with no DS equivalent yet: the plan-gate banner and the first-run empty state.

// ---- plan-gate banner (limit reached) ----
export function planGateBanner(label = 'New engagement') {
  return `<div class="m3-card ws-plangate">
    <span class="material-symbols-rounded">lock</span>
    <div style="flex:1"><b>Plan limit reached.</b> <span style="color:var(--md-sys-color-on-surface-variant)">You've used your ${esc(label).toLowerCase().replace(/^new /, '')} allowance for this plan.</span></div>
    <button class="ws-plangate-cta" onclick="window.__requestUpgrade&&window.__requestUpgrade()">Request an upgrade →</button>
  </div>`;
}

// ============================================================
// OPERATORS HERO — the editorial top of the Team screen.
//
// It replaces a single statCard reading "3 / Active operators", which the DS
// itself argues against in figureStrip's own comment: "A boxed tile says
// 'this is a thing'; a count of engagements is not a thing, it is a
// measurement of the list below it." A count of operators above a list of
// operators is that exact mistake — and it sat alone in a 1020px row to say
// a number the reader could get by looking down.
//
// What a team page is actually for is COVER: is every venture carried, and is
// the load fair. Neither was anywhere on the page. Both are derivable from
// data already loaded, so they are derived here — the same way the Portfolio
// hero derives its sentence — and nothing is asserted that the data does not
// support. Same organism as the Portfolio and the assessment tabs.
// ============================================================

// teamMetrics — the ONE place the team numbers are computed.
export function teamMetrics(operators = [], programs = [], org = {}) {
  const owner = String((org && org.ownerEmail) || '').toLowerCase();
  const ids = new Set(operators.map(o => o.id));
  const load = new Map(operators.map(o => [o.id, 0]));
  let unassigned = 0;
  for (const p of programs) {
    const a = p.assignedOperator;
    if (a && ids.has(a)) load.set(a, load.get(a) + 1); else unassigned++;
  }
  const ranked = [...operators]
    .map(o => ({ op: o, n: load.get(o.id) || 0 }))
    .sort((a, b) => b.n - a.n || String(a.op.name || '').localeCompare(String(b.op.name || '')));
  const total = programs.length;
  return {
    operators: operators.length, total, unassigned, covered: total - unassigned,
    ranked, busiest: ranked[0] || null, lightest: ranked[ranked.length - 1] || null,
    ownerName: (operators.find(o => String(o.email || '').toLowerCase() === owner) || {}).name || null,
    // "uneven" is a claim, so it has a definition: the heaviest carries at least
    // twice the lightest AND at least two more. One-vs-two is a rounding
    // difference on a small book, not an imbalance worth an operator's attention.
    get uneven() {
      const hi = this.busiest ? this.busiest.n : 0, lo = this.lightest ? this.lightest.n : 0;
      return this.operators > 1 && hi >= lo * 2 && hi - lo >= 2;
    },
  };
}

const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = n => WORD[n] ?? String(n);
const cap = w => String(w).charAt(0).toUpperCase() + String(w).slice(1);
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;

function teamHeadline(m) {
  if (!m.operators) return { headline: 'No operators yet — invite someone to share the book.', em: null };
  if (m.operators === 1) {
    if (!m.total) return { headline: 'One operator, and nothing on the book yet.', em: null };
    return { headline: `You are the only operator, carrying all ${word(m.total)}.`, em: 'the only operator' };
  }
  const subject = `${cap(word(m.operators))} operators`;
  if (m.unassigned > 0) {
    const em = m.unassigned === 1 ? 'one venture has nobody' : `${word(m.unassigned)} ventures have nobody`;
    return { headline: `${subject}, but ${em} on it.`, em };
  }
  if (!m.total) return { headline: `${subject}, with nothing on the book yet.`, em: null };
  if (m.uneven) return { headline: `${subject} on ${word(m.total)} ventures — the load is uneven.`, em: 'the load is uneven' };
  return { headline: `${subject}, evenly carrying ${word(m.total)} ventures.`, em: 'evenly carrying' };
}

function teamFacts(m) {
  const f = [{ k: 'Operators', v: `${m.operators}${m.ownerName ? ` <small>${esc(m.ownerName)} owns the workspace</small>` : ''}` }];
  f.push(m.unassigned > 0
    ? { k: 'Cover', v: `${m.covered} of ${m.total} <small>${plural(m.unassigned, 'venture')} unassigned</small>` }
    : { k: 'Cover', v: `${m.covered} of ${m.total} <small>every venture carried</small>` });
  if (m.busiest && m.busiest.n > 0)
    f.push({ k: 'Heaviest load', v: `${esc(m.busiest.op.name || '—')} <small>${plural(m.busiest.n, 'venture')}</small>` });
  return f;
}

function teamThesis(m) {
  if (!m.operators) return 'Nobody can be assigned a venture until there is someone to assign it to.';
  if (m.unassigned > 0)
    return `Cover has a hole — ${plural(m.unassigned, 'venture')} on the book ${m.unassigned === 1 ? 'has' : 'have'} no operator against ${m.unassigned === 1 ? 'it' : 'them'}, so nobody is answerable when ${m.unassigned === 1 ? 'it slips' : 'they slip'}.`;
  if (m.operators === 1 && m.total > 0)
    return `Everything on the book runs through one person. A second operator is the difference between cover and a single point of failure.`;
  if (!m.total) return 'Nothing is assigned yet — the first engagement will land against whoever creates it.';
  if (m.uneven)
    return `Every venture is carried, but not evenly: ${esc(m.busiest.op.name)} holds ${m.busiest.n} of ${m.total} while ${esc(m.lightest.op.name)} holds ${m.lightest.n}.`;
  return `The book is carried evenly — no operator is holding more than ${plural(m.busiest ? m.busiest.n : 0, 'venture')}.`;
}

// operatorsHero — ORGANISM. statementLockup (LEFT) beside the cover lockup (RIGHT), closed by a derived coda.
export function operatorsHero(operators = [], programs = [], org = {}) {
  const m = teamMetrics(operators, programs, org);
  const right = m.total === 0 ? '' : coverageLockup({
    label: 'Cover of the book',
    numeral: `${m.covered}<small>/${m.total} carried</small>`,
    confidence: m.unassigned > 0 ? `${plural(m.unassigned, 'venture')} unassigned` : 'Every venture carried',
    bandSuffix: '',
    tone: m.unassigned > 0 ? 'mid' : 'good',
    confidenceIcon: m.unassigned > 0 ? 'error' : 'groups',
    facts: m.ranked.filter(r => r.n > 0).slice(0, 3).map(r => ({ v: String(r.n), k: String(r.op.name || '').split(' ')[0] })),
  });
  const { headline, em } = teamHeadline(m);
  return sectionHero({
    left: statementLockup({ eyebrow: 'Your team', eyebrowIcon: 'groups', headline, headlineEm: em, facts: teamFacts(m) }),
    right, thesisLabel: 'The read.', thesis: teamThesis(m),
  });
}

// ============================================================
// BRAND PREVIEW + the WORKSPACE (settings) HERO.
//
// Settings had five cards in an inline `auto-fit minmax(300px,1fr)` grid with
// no align-items, so the three in the top row were all stretched to the
// tallest — 525px each — to hold 226, 82 and 131 characters. The Organisation
// card was 171,675px² of surface for 82 characters, most of it em-dashes.
//
// The fix is not a smaller card. It is that a settings page has a SUBJECT —
// the workspace itself — and never showed it. The hero's right slot is a live
// preview of the brand being edited: the mark as the team actually sees it,
// at the two sizes it actually renders. Editing the colour below repaints it.
// ============================================================

const initialsOf = s => {
  const parts = String(s || '').trim().split(/\s+/);
  return (((parts[0] || '?')[0] || '?') + (parts.length > 1 ? (parts[parts.length - 1][0] || '') : '')).toUpperCase().slice(0, 2);
};

// brandPreview — MOLECULE. The org mark at drawer size and at avatar size, the
// name, and the colour in hex. `inkOn` picks the ink because the fill is a
// colour the customer chose, not one from the palette (see ds.js:inkOn).
export function brandPreview(org = {}) {
  const colour = org.primaryColor || '';
  const ink = colour ? inkOn(colour) : 'var(--md-sys-color-on-primary)';
  const bg = colour ? esc(colour) : 'var(--md-sys-color-primary)';
  const face = size => org.logoUrl
    ? `<img src="${esc(org.logoUrl)}" alt="">`
    : `<span style="font-size:${size}px">${esc(initialsOf(org.name))}</span>`;
  return `<div class="brand-prev">
    <span class="eyebrow accent">How your team sees you</span>
    <div class="bp-row">
      <span class="bp-mark lg" style="background:${bg};color:${ink}">${face(19)}</span>
      <span class="bp-mark sm" style="background:${bg};color:${ink}">${face(12)}</span>
      <div class="bp-id"><div class="bp-nm">${esc(org.name || 'Your organisation')}</div><div class="bp-sub">Operator workspace</div></div>
    </div>
    <div class="bp-meta">
      <span class="unit"><b>${esc((colour || '—').toUpperCase())}</b> primary</span>
      <span class="unit"><b>${org.logoUrl ? 'Logo' : 'Initials'}</b> mark</span>
    </div>
  </div>`;
}

function settingsHeadline(org, plan, Plan, programs) {
  const name = org.name || 'Your workspace';
  const limited = ['assessment', 'build'].filter(t => Plan.orgCan(plan, t) && Plan.limitFor(plan, t) != null);
  for (const t of limited) {
    const left = Plan.limitFor(plan, t) - Plan.usageFor(programs, t);
    const noun = t === 'assessment' ? 'assessment' : 'build';
    if (left <= 0) return { headline: `This licence has no ${noun}s left on it.`, em: `no ${noun}s left` };
    if (left === 1) return { headline: `One ${noun} left on this licence.`, em: `One ${noun} left` };
  }
  if (!org.logoUrl) return { headline: `${name} is running on initials, not a logo.`, em: 'running on initials' };
  return { headline: `${name} runs on a ${String(Plan.planLabel(plan)).toLowerCase()}.`, em: String(Plan.planLabel(plan)).toLowerCase() };
}

// workspaceHero — ORGANISM. The editorial top of Settings.
export function workspaceHero({ org = {}, plan, Plan, programs = [], operators = [] } = {}) {
  const { headline, em } = settingsHeadline(org, plan, Plan, programs);
  const facts = [{ k: 'Licence', v: `${esc(Plan.planLabel(plan))}` }, { k: 'Operators', v: String(operators.length) }];
  if (org.createdAt) facts.push({ k: 'Since', v: new Date(org.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) });
  return sectionHero({
    left: statementLockup({ eyebrow: 'Your workspace', eyebrowIcon: 'tune', headline, headlineEm: em, facts }),
    right: brandPreview(org),
    thesisLabel: 'Where it shows.',
    thesis: 'Your name, colour and logo render across the Workspace and every Studio in your org. Changes apply live and save instantly.',
  });
}

// brandSwatches — MOLECULE. The primary-colour picker. The custom value used a
// RAW `<input type="color">` sitting next to a styled field — a blue OS chrome
// square in the middle of the design system. The input is still the control
// (it is the only accessible native colour picker) but it is now the swatch:
// transparent and stretched over a tile that paints the current value.
export function brandSwatches(swatches = [], current = '') {
  const cur = String(current || '').toUpperCase();
  const tiles = swatches.map(c => `<button type="button" class="bsw${c.toUpperCase() === cur ? ' on' : ''}" data-color="${esc(c)}" style="background:${esc(c)}" aria-label="Use ${esc(c)}"></button>`).join('');
  return `<div class="bsw-row">
    ${tiles}
    <span class="bsw-custom${cur ? '' : ' empty'}"${cur ? ` style="background:${esc(cur)}"` : ''}>
      <input type="color" id="b-pick" value="${esc(cur || '#000000')}" aria-label="Pick a custom colour">
      <span class="material-symbols-rounded"${cur ? ` style="color:${inkOn(cur)}"` : ''}>colorize</span>
    </span>
    <input type="text" id="b-hex" value="${esc(cur)}" maxlength="7" class="field-in bsw-hex" placeholder="#000000" aria-label="Primary colour hex">
  </div>`;
}

// ============================================================
// ORGS HERO — the editorial top of the Admin screen.
//
// Admin rendered a single card 1020×162 holding 85 characters, above 692px of
// empty page, and the card's own first line was "· owner alex@mercer.vc" — a
// separator with nothing in front of it, because the org id it was separating
// from is blank outside Firestore.
//
// The screen has two readers with different questions. A SUPER ADMIN is asking
// how many client orgs exist, who runs them, and what each is licensed for. An
// OWNER is asking a much narrower one — who can sign in to my workspace — which
// is why the owner view leads on ACCESS and not on people: the Team screen
// already covers people, and the two were reading as the same page twice.
// ============================================================

// orgsHero — ORGANISM. Super-admin and owner are different sentences, not the
// same sentence with a word swapped.
export function orgsHero({ orgs = [], isSuper = false, org = {}, operators = [], Plan } = {}) {
  if (!isSuper) {
    const n = operators.length;
    const ownerName = (operators.find(o => String(o.email || '').toLowerCase() === String(org.ownerEmail || '').toLowerCase()) || {}).name;
    const headline = n === 1
      ? 'You are the only person who can sign in here.'
      : `${cap(word(n))} people can sign in to this workspace.`;
    return sectionHero({
      left: statementLockup({
        eyebrow: 'Access', eyebrowIcon: 'shield_person',
        headline, headlineEm: n === 1 ? 'the only person' : 'can sign in',
        facts: [
          { k: 'Operators', v: String(n) },
          { k: 'Owner', v: ownerName ? `${esc(ownerName)} <small>cannot be removed</small>` : '<small>not set</small>' },
          { k: 'Licence', v: esc(Plan.planLabel(Plan.resolvePlan(org))) },
        ],
      }),
      right: '',
      thesisLabel: 'What this screen does.',
      thesis: 'Adding an email grants Workspace access immediately and sends a one-click sign-in link. Removing one revokes it on the next request. Who carries which venture is set on the Team screen.',
    });
  }
  const totalOps = new Set(orgs.flatMap(o => (o.operatorEmails || []).map(e => String(e).toLowerCase()))).size;
  const byPlan = new Map();
  for (const o of orgs) {
    const l = Plan.planLabel(Plan.resolvePlan(o));
    byPlan.set(l, (byPlan.get(l) || 0) + 1);
  }
  const noOwner = orgs.filter(o => !o.ownerEmail).length;
  const headline = orgs.length === 0
    ? 'No client organisations yet — create the first one.'
    : noOwner > 0
      ? `${cap(word(orgs.length))} organisations, and ${word(noOwner)} with no owner.`
      : `${cap(word(orgs.length))} organisations, ${plural(totalOps, 'operator')} between them.`;
  return sectionHero({
    left: statementLockup({
      eyebrow: 'Platform admin', eyebrowIcon: 'shield_person',
      headline,
      headlineEm: noOwner > 0 ? `${word(noOwner)} with no owner` : null,
      facts: [
        { k: 'Organisations', v: String(orgs.length) },
        { k: 'Operators', v: String(totalOps) },
        { k: 'Licences in use', v: String(byPlan.size) },
      ],
    }),
    right: orgs.length ? coverageLockup({
      label: 'The platform',
      numeral: `${orgs.length}<small>/${orgs.length} live</small>`,
      confidence: noOwner > 0 ? `${plural(noOwner, 'org')} without an owner` : 'Every org has an owner',
      bandSuffix: '', tone: noOwner > 0 ? 'mid' : 'good',
      confidenceIcon: noOwner > 0 ? 'error' : 'verified_user',
      facts: [...byPlan].slice(0, 3).map(([l, n]) => ({ v: String(n), k: l.replace(/ licence$/i, '') })),
    }) : '',
    thesisLabel: 'The read.',
    thesis: orgs.length
      ? `Each org below is a separate tenant: its own operators, its own engagements, its own licence. Changing a plan takes effect on the next request the org makes.`
      : 'Creating an org provisions its workspace and emails the owner a sign-in link.',
  });
}

// ---- person / operator card ----
// personCard — the single source for the team roster card: avatar + name (+ optional badge) + sub, an
// optional meta pill row, a trailing action, and an optional aside. badge/pill/action/aside are trusted
// HTML (statusPill/button markup); name/sub/avatar are escaped here.
export function personCard({ avatar, avatarColor, name, sub, badge = '', pill = '', action = '', aside = '' } = {}) {
  /* EDITORIAL ROW, not a card — same move as queueItem. The roster is a list of
     people; a hairline between them says that, and a filled tub per person does not.
     Only Team renders personCard, so the change is contained to that screen. */
  return `<div class="pc">
    <div class="pc-head">
      <div class="pc-identity"><div class="pc-avatar" style="background:${esc(avatarColor) || 'var(--md-sys-color-primary)'}${avatarColor ? `;color:${inkOn(avatarColor)}` : ''}">${esc(avatar)}</div>
        <div><div class="pc-name">${esc(name)}${badge ? ' ' + badge : ''}</div><div class="pc-founder">${esc(sub)}</div></div></div>
      ${action}
    </div>
    ${pill ? `<div class="pc-meta">${pill}</div>` : ''}
    ${aside}
  </div>`;
}

// ---- empty state (both classic variants + 3 explorer cards) ----
// `prescreen` is the FREE tier's first screen. Without it a free account was shown the paid
// assessment's four steps — "agents pressure-test the claims", "decision-grade verdict" — none of
// which it is buying. Describing the wrong product on the very first screen is worse than saying
// nothing, and it is the screen most likely to decide whether they ever pay.
export function workspaceEmpty({ assessOnly = false, orgName = 'your Workspace', canCreate = true, prescreen = false } = {}) {
  const eyebrow = prescreen ? 'First pre-screen' : assessOnly ? 'First assessment' : 'First engagement';
  const title = prescreen ? 'Pre-screen your<br>first venture.' : assessOnly ? 'Run your first<br>assessment.' : 'Create your first<br>engagement.';
  const sub = prescreen
    ? 'Upload a pitch deck and whatever data room you have. In about three minutes you get a score range, a read on what your documents do and don’t cover, and a flavour of the findings — free.'
    : assessOnly
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
  /* Numbered editorial rows, not stacked tubs — the same .must idiom the Verdict tab
     uses for its numbered list. These four are a SEQUENCE (deck → research → score →
     verdict), and a sequence reads as numbered steps down a rule, not as four boxes. */
  // The free tier's four steps describe what the pre-screen ACTUALLY does, and say plainly where it
  // stops. A range is not a verdict, and the screen should not imply it is.
  const prescreenSteps = [
    ['Deck', 'Deck & data room', 'Upload the pitch deck plus whatever supporting documents you have. Nothing is required beyond the deck.'],
    ['Room', 'Data-room read', 'Instant, free, and as often as you like: which of the six evidence types the score looks for we can and cannot find.'],
    ['Range', 'A score range', 'Not a single number. The low end is what your documents prove today; the high end is what they become if the gaps close.'],
    ['Full', 'Unlock the full assessment', 'Deep research, diligence, a single measured score and a decision-grade verdict — when you are ready.'],
  ];
  const steps = (prescreen ? prescreenSteps : assessOnly ? assessSteps : buildSteps)
    .map(([tag, t, p], i) => `<div class="ws-step"><div class="ws-step-n">${i + 1}</div><div class="ws-step-b"><div class="ws-step-tag">${tag}</div><div class="ws-step-title">${t}</div><p>${p}</p></div></div>`).join('');
  const cta = canCreate
    ? `<button class="m3-btn filled" style="margin-top:20px" onclick="window.openNewAssessment&&window.openNewAssessment()"><span class="material-symbols-rounded">${prescreen ? 'bolt' : 'add'}</span>${prescreen ? 'Run your first pre-screen' : assessOnly ? 'Start your first assessment' : 'Start your first engagement'}</button>`
    : `<div style="margin-top:20px">${planGateBanner(assessOnly ? 'New assessment' : 'New engagement')}</div>`;
  const explorers = [
    ['tune', 'Refine your brand', 'Edit your organisation name, primary colour, or logo before your first engagement goes live.', '/workspace/settings-m3.html', 'Open settings →', ''],
    ['dashboard', 'How the Workspace works', 'Three surfaces, three audiences. The marketing tour explains how operators, founders, and investors connect.', '/the-workspace.html', 'Read the tour →', ' target="_blank"'],
    ['groups', 'Meet the 47 agents', 'The fleet behind every engagement — substrate keystones, Build-First 8, and the full domain breakdown.', '/agents.html', 'Explore the fleet →', ' target="_blank"'],
  ].map(([ic, t, p, href, cta2, attr]) => `<a class="ws-explorer" href="${href}"${attr}>
      <div class="ws-explorer-head"><span class="ws-explorer-icon"><span class="material-symbols-rounded">${ic}</span></span><span class="ws-explorer-title">${t}</span></div>
      <p>${p}</p><span class="ws-explorer-cta">${cta2}</span>
    </a>`).join('');
  /* EDITORIAL, not a card-in-a-card-in-a-card. This screen is the first thing a new
     customer ever sees, and it was three nested layers of filled tub: an outer
     .m3-card hero, four .m3-card-styled step boxes inside it, and three .m3-card
     explorers below. Every other surface in the product had already moved to
     hairlines and type; this one was missed because the demo org has engagements,
     so the empty state never rendered in review. */
  return `<div class="ws-empty-hero">
      <div class="ws-empty-lead">
        <div class="overline" style="color:var(--md-sys-color-primary)">${eyebrow}</div>
        <h2 class="ws-empty-title">${title}</h2>
        <p class="ws-empty-sub">${sub}</p>
        ${cta}
      </div>
      <div class="ws-empty-steps">${steps}</div>
    </div>
    <hr class="rule">
    <div class="ws-explorers">${explorers}</div>`;
}

// NOTE: the queue board (queueBoardWS/queueItemWS/Q_SECTIONS) was removed — the live queue now renders
// through DS.queueBoard (queueItem extended to carry cta/href/href2 + typeLabel·programName·age meta).
