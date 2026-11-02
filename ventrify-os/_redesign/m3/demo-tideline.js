/* demo-tideline.js — ONE fictional venture, four real screens, for the marketing site.
 *
 * The site embeds the product rather than photographing it, which means the product has to be
 * reachable from outside with a venture that is safe to publish. That is all this is: the real
 * ds.js screens, the real shell, the real components, pointed at a renamed assessment.
 *
 * WHY A MODULE AND NOT THREE PAGES. live-demo.html, live-demo-setup.html and live-demo-flow.html
 * are the same four views in different orders. Written out per page they drift — a chat answer
 * fixed on one, a data-room class added on another — and the site then shows two versions of the
 * same product. The pages are mounts; everything they show lives here.
 *
 * WHAT IS REAL AND WHAT IS STAGED. Every surface is the product's own render layer. What is staged
 * is the SERVER: a Drive read that would hit the room-check API, an assessment that would take two
 * hours on a cloud runner, an assistant answer that would cost a model call. A marketing page must
 * not make any of those, so they are scripted — and nothing here claims otherwise.
 */
import * as DS from './ds.js';
import {
  ASSESSMENT as BASE, SCORE as S,
  ASSESSMENT_RUNNING as RUN_BASE, SCORE_FORMING, ENGAGEMENTS, RUN_STATES,
} from './data.js';
import { resolveActions } from '../../shared/actions.js';
import { ctaPair } from '../../shared/entitlements.js';

/* ── the venture ───────────────────────────────────────────────────────────
   The sample assessment is written about MoneyGym, a real customer, so the venture is renamed in
   one pass over the serialised object rather than forked into a second 976-line fixture.

   ⚠ HONEST LIMIT: this renames, it does not rewrite. The story underneath is still the same
   behavioural-finance subscription business with the same figures and the same prose — Cleo,
   ilumoni and §1033 are all still in there. It reads as a plausible venture called Tideline; it is
   not an independently invented one. Before this is pointed at by sales or press the memo copy
   wants writing from scratch. */
const rename = (o, from, to) => JSON.parse(JSON.stringify(o).split(from).join(to));
export const A = { ...rename(BASE, 'MoneyGym', 'Tideline'), name: 'Tideline', initials: 'TL' };
export const SC = rename(S, 'MoneyGym', 'Tideline');
export const ROOM = DS.researchRoom(A.reading && A.reading.length ? A.reading : A.research);
const BOOK = rename(ENGAGEMENTS, 'MoneyGym', 'Tideline');
const RUNNING = { ...rename(RUN_BASE, 'MoneyGym', 'Tideline'), name: 'Tideline', initials: 'TL' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);

/* ── the data room ─────────────────────────────────────────────────────────
   Four of the six document types the score counts are in Tideline's room and two are not, which is
   the state the whole data-room argument rests on: a type shown as missing is a question we were
   not given the evidence to answer, not a mark against the venture. */
const CLASSES = [
  { key: 'financial_model',  label: 'Financial model',                      want: 'A projection over three or more periods with at least one revenue line and one cost line', seenIn: 'Tideline model v4.xlsx' },
  { key: 'unit_economics',   label: 'Unit economics',                       want: 'At least two of: price or ARPU, CAC, churn or retention, LTV or payback', seenIn: 'Unit economics + sensitivity.xlsx' },
  { key: 'cost_basis',       label: 'Cost basis',                           want: 'At least one cost line with where it comes from — a named vendor, a quoted rate, or a stated assumption', seenIn: 'Opex build 2026.xlsx' },
  { key: 'ownership',        label: 'Ownership / cap table',                want: 'Any statement of who owns what — a cap table, equity split, share register, SAFE or option schedule', seenIn: 'Cap table — post-seed.xlsx' },
  { key: 'corporate_legal',  label: 'Corporate / legal',                    want: 'Any one of: incorporation document, company number, articles, board minutes, shareholder or IP agreement' },
  { key: 'observed_metrics', label: 'Observed metrics or primary research', want: 'At least one MEASURED number — not a forecast: pilot, waitlist, funnel, cohort, LOI, or primary interviews' },
];
/* The files the reader walks past: enough of them to read as a folder rather than a list of six
   props, with the four that answer a class marked by position. */
const FILES = [
  'Tideline — Seed deck v3.pdf',
  'Tideline model v4.xlsx',                      // financial_model
  'Executive summary.docx',
  'Unit economics + sensitivity.xlsx',           // unit_economics
  'Pricing tiers — Nov.pdf',
  'Opex build 2026.xlsx',                        // cost_basis
  'Hiring plan — eng.xlsx',
  'Cap table — post-seed.xlsx',             // ownership
  'Founder letter.pdf',
  'Market notes — behavioural finance.md',
  'Competitor teardown.pdf',
  'Brand guidelines.pdf',
];
const ANSWERS = { 1: 'financial_model', 3: 'unit_economics', 5: 'cost_basis', 7: 'ownership' };
const DOC_TOTAL = 46;                             // the folder is bigger than the list we walk

/* The finished room, as the assessment's Data room tab shows it. */
const ROOM_TAB = {
  docCount: DOC_TOTAL, deck: true, canRescan: true,
  check: { docCount: DOC_TOTAL, classes: CLASSES.map(c => ({ ...c, found: !!c.seenIn })) },
};

/* ── the assistant ─────────────────────────────────────────────────────────
   The answer is written down; the real one costs a model call. It is held to the same rule the real
   assistant is — every id in `cited` exists in this assessment's research — because chatMsg renders
   an id that is not in the corpus as a loud "unverified", and that is the component working rather
   than something to ship by accident. */
const CHAT = {
  q: 'What is the single biggest risk to this score?',
  a: {
    role: 'bot',
    text: '**The moat is the gap, and it is not built.** Two of the five Moat criteria score zero — '
      + 'IP defensibility and switching costs — because the four-engine stack is "defined, not built" '
      + 'in the founder’s own document [[research:claims-pressure-test]]. Moat carries 1.5 of 5, and '
      + 'closing it is a funded build rather than anything diligence can resolve ⟨derived⟩.\n\n'
      + 'The second is the category. The deck presents it as unclaimed; the benchmark puts an incumbent '
      + 'in it at roughly 7M users and $280M+ ARR, net-profitable [[research:competitive-benchmark]].\n\n'
      + 'Both sit inside the +21 headroom to a 76 — so the 55 is not a verdict on the venture, it is '
      + 'a measure of what has been built so far.',
    cited: ['research:claims-pressure-test', 'research:competitive-benchmark'],
    proposals: [{
      title: 'Add a diligence question',
      detail: 'Ask the founder for a named ML / data lead and a build plan for the four engines.',
      lines: ['Action queue · Tideline', 'Owner: Alex Doré · Blocker'],
      cta: 'Add to the action queue',
    }],
  },
};

/* ── mounting ──────────────────────────────────────────────────────────────
   Each view replaces the page. pageShell() writes over #app, so a fresh one goes in first — the
   alternative is swapping the masthead and body in place, which means re-running the tab, minify
   and rail wiring by hand and keeping that in step with initShell() forever.

   COST, stated: initShell() binds two document-level keydown handlers and a popstate handler, so
   those accumulate one set per view. Four views is four sets, and the flow reloads the frame at the
   end of a cycle rather than letting that grow without limit. */
function frame() {
  document.body.innerHTML = '<div id="app"></div>';
}

export function mountPortfolio() {
  frame();
  const acts = resolveActions({ page: 'portfolio' });
  const rows = BOOK;
  const inFlight = r => r.runState && ['queued', 'running', 'partial'].includes(r.runState.status);
  const FILTERS = ['All', 'On track', 'Needs attention', 'Stuck', 'Assessment'];

  document.getElementById('app').outerHTML = DS.pageShell({
    active: 'portfolio', aux: {}, rail: acts.rail, railOverflow: acts.overflow,
    masthead: DS.masthead({
      breadcrumb: false, eyebrow: 'Portfolio',
      headline: 'All engagements', headlineMeta: `· ${rows.length} active`,
      subheading: 'Every venture on your workspace — open one for the full assessment and timeline.',
      // The product's own primary action. It normally opens the aux wizard; here it goes to the
      // full-screen create, which is where the product is headed.
      actions: [{ ...acts.primary, label: 'New assessment', onclick: 'window.openNewAssessment&&window.openNewAssessment()' }],
    }),
    body: `${DS.portfolioBand(rows)}${DS.filterBar(FILTERS, 'Search ventures or founders')}
           <div id="eng-host">${DS.engagementTable(rows, { groups: DS.triageGroups(rows) })}</div>`,
  });
  DS.initShell();
  inert();
}

export function mountCreate() {
  frame();
  const acts = resolveActions({ page: 'portfolio' });
  document.getElementById('app').outerHTML = DS.pageShell({
    active: 'portfolio', aux: {}, rail: acts.rail, railOverflow: acts.overflow,
    masthead: DS.masthead({
      breadcrumb: { label: 'Portfolio', href: '#' }, crumbTail: 'New assessment',
      eyebrow: 'New assessment', headline: 'Assess a venture for Apex Capital',
      // Without `compact` the masthead keeps the full headline when it minifies on scroll, and a
      // 34-character line truncates to "Assess a venture for Apex Capit".
      compact: 'New assessment',
      subheading: 'Attach the deck and the data room. We read the room first, so you know what we can see before the run starts.',
    }),
    body: `<div class="brief">${DS.createScreen({
      operators: [{ v: 'op-1', l: 'Alex Doré · Program Lead' }, { v: 'op-2', l: 'Ruth Adeyemi · Master operator' }],
      cta: ctaPair({ preset: 'full' }),
    })}</div>`,
  });
  DS.initShell();
  inert();
  deck = false;
  CLASSES.forEach(c => { c.found = false; });
  syncRun();
}

export function mountRunning(rs) {
  frame();
  const acts = resolveActions({ page: 'assess' });
  document.getElementById('app').outerHTML = DS.pageShell({
    active: 'portfolio', aux: {}, auxMode: 'push', rail: acts.rail, railOverflow: acts.overflow,
    masthead: DS.masthead({
      breadcrumb: { label: 'Portfolio', href: '#' }, crumbTail: RUNNING.name,
      avatar: RUNNING.initials, headline: RUNNING.name, subheading: RUNNING.stageLine,
      compact: RUNNING.name,
      status: { kind: 'n', label: 'Assessing…', icon: 'autorenew' },
      tabs: false,                      // no verdict yet, so nothing to switch between
      actions: [],
    }),
    body: `<div class="tab-panel active"><div class="brief" id="ea-status">${DS.assessingMemo(RUNNING, SCORE_FORMING, rs)}</div></div>`,
  });
  DS.initShell();
  inert();
}

export function mountAssess() {
  frame();
  const acts = resolveActions({ page: 'assess' });
  document.getElementById('app').outerHTML = DS.pageShell({
    active: 'portfolio', aux: {}, auxMode: 'push', drill: true,
    rail: acts.rail, railOverflow: acts.overflow,
    masthead: DS.masthead({
      breadcrumb: { label: 'Portfolio', href: '#' },
      crumbTail: A.name, avatar: A.initials, headline: A.name,
      status: A.status, subheading: A.stageLine, compact: A.name,
      actions: acts.decision.length ? acts.decision : (acts.primary ? [acts.primary] : []),
      tabs: ['Verdict', 'Investability', 'Market', 'Team',
        { label: 'Diligence', badge: (A.gaps || []).filter(g => DS.gapNeedsAction(g)).length || null },
        'Research', 'Data room'],
      activeTab: 0,
    }),
    body: `
      <div class="tab-panel active">${DS.verdictMemo(A, SC)}</div>
      <div class="tab-panel"><div class="brief">${DS.investabilityHero(SC, A)}${DS.scoreMovement(A.filings)}<hr class="rule">${DS.investabilityComposition(SC, 'openInvest')}<hr class="rule">${DS.strengthProfile(SC, 'openInvest')}</div></div>
      <div class="tab-panel">${DS.marketMemo(A)}</div>
      <div class="tab-panel">${DS.teamMemo(A, SC)}</div>
      <div class="tab-panel">${DS.diligenceEditorial(A)}</div>
      <div class="tab-panel">${DS.researchMemo(A, SC)}</div>
      <div class="tab-panel"><div class="brief">${DS.dataRoomTab(ROOM_TAB)}</div></div>`,
  });
  DS.initShell();
  DS.initTabs({ names: ['verdict', 'investability', 'market', 'team', 'diligence', 'research', 'dataroom'] });
  inert();
  chat = [];
}

/* ── wiring that every view shares ─────────────────────────────────────────── */

let deck = false, chat = [];

/* The run buttons ship disabled and the workspace's own validator enables them. There is no
   validator on a marketing page, so this is the same rule written out: a name and a deck. */
function syncRun() {
  const named = !!($('#na-name') || {}).value;
  const ready = named && deck;
  document.querySelectorAll('.na-run').forEach(b => { b.disabled = !ready; });
  // #na-gate is the "Attach a pitch deck to begin." line beside the buttons: rendered statically by
  // createScreen and cleared by the validator, so without this the shot ends on two live buttons
  // beside a sentence saying they cannot be pressed.
  const gate = $('#na-gate');
  if (gate) gate.textContent = ready ? '' : 'Attach a pitch deck to begin.';
}

const deckZone = (file) => DS.docDropzone(file ? [{ icon: 'slideshow', title: file, note: 'Pitch deck · 18 slides · ready to run' }] : [], {
  single: true, status: file ? 'read' : '', clearLabel: 'Replace', fileIcon: 'slideshow',
  icon: 'upload_file', prompt: 'Drop the pitch deck here', sub: 'PDF · the assessment runs from it.',
  note: 'Pitch deck · uploads when you run',
  onPick: "window.__naPick('deck')", onClear: 'window.__naClearDeck()', onDrop: '__naDropDeck',
});

function paintRoom(scan, justFound) {
  const host = $('#na-room'); if (!host) return;
  const seen = CLASSES.filter(c => c.found).length;
  host.innerHTML = (scan ? DS.roomScanBanner({ ...scan, found: seen, of: CLASSES.length }) : '')
    + DS.roomCheck({ docCount: scan ? scan.done : DOC_TOTAL, classes: CLASSES }, { justFound: justFound || [] });
}

function repaintChat(pending) {
  const body = $('.m3-aux .aux-body'); if (!body) return;
  body.innerHTML = DS.chatPanel({ ventureName: A.name, messages: chat, pending }).body;
  const log = $('#chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

/* Everything that would WRITE is inert. This is a window onto the product, not the product.
   Re-applied on every mount, because a view swap replaces the handlers the markup points at. */
function inert() {
  window.openGap = () => {}; window.__eaRun = () => {}; window.__toast = () => {};
  window.__naPick = () => {}; window.__naClearDoc = () => {}; window.__naDropDocs = () => {};
  window.__naClearDeck = () => {}; window.__naDropDeck = () => {};
  window.__wsUnlock = () => {};

  window.openInvest = (key) => window.openAux({ mode: 'push', ...DS.categoryDetail(SC, key, A.gapBySlug || {}) });
  window.RAIL_PANELS = {
    sources: () => DS.sourcesPanel(A),
    assist: () => { chat = []; return DS.chatPanel({ ventureName: A.name, messages: chat }); },
  };

  /* THE RESEARCH DRILL. Every research document opens as its own companion page — the thing that
     makes the Research tab worth showing at all, because the index alone is a list of titles. */
  window.__room = ROOM;
  window.DRILL_PAGES = {};
  ROOM.all.forEach(d => { window.DRILL_PAGES[d.slug] = () => DS.researchDrillOpts(d, ROOM); });
  window.openResearchDrill = (slug) => {
    const o = window.DRILL_PAGES[slug];
    if (o) window.openDrill({ key: slug, source: document.activeElement, ...o() });
  };
  const findDoc = re => ROOM.all.find(d => re.test(d.slug) || re.test(d.title.toLowerCase()));
  window.openPeek = (kind, i) => {
    if (kind === 'research') { const d = ROOM.all[i]; return d && window.openResearchDrill(d.slug); }
    const d = kind === 'benchmark' ? findDoc(/benchmark|competitor|competitive/) : findDoc(/team|diligence/);
    if (d) return window.openResearchDrill(d.slug);
  };

  // the product's own buttons, routed to the staged versions
  window.__naReadRoom = () => demo.scanRoom();
  window.__naCheckRoom = () => demo.scanRoom();
  window.openNewAssessment = () => demo.goCreate();
  window.__wsCreateAssessment = () => demo.run();
  window.__wsRunPrescreen = () => {};
}

/* One delegated listener for the whole document, bound ONCE — a view swap must not add another. */
let bound = false;
function bind() {
  if (bound) return; bound = true;
  document.addEventListener('input', e => { if (e.target && e.target.id === 'na-name') syncRun(); });
  document.addEventListener('click', (e) => {
    if (!e.target.closest) return;
    // A citation that cannot be opened is a footnote. The real panel routes a chip to its source.
    const chip = e.target.closest('.chat-chip');
    if (chip) return window.openResearchDrill((chip.dataset.src || '').replace(/^research:/, ''));
    if (e.target.closest('#chat-send')) demo.ask();
  });
}

/* ── the staged server ─────────────────────────────────────────────────────── */
export const demo = {
  goCreate() { mountCreate(); },
  goPortfolio() { mountPortfolio(); },

  attachDeck() {
    const host = $('#na-deck'); if (!host) return;
    host.innerHTML = deckZone('Tideline — Seed deck v3.pdf');
    deck = true; syncRun();
  },

  /* Drive → folder → files → coverage. Paced to be read: the real read of 46 documents takes most
     of a minute, so a shot that finishes in two seconds is the lie. */
  async scanRoom() {
    CLASSES.forEach(c => { c.found = false; });
    paintRoom({ done: 0, total: DOC_TOTAL, current: '' });
    await sleep(700);
    for (let i = 0; i < FILES.length; i++) {
      const key = ANSWERS[i];
      if (key) CLASSES.find(c => c.key === key).found = true;
      paintRoom({ done: Math.round((i + 1) * DOC_TOTAL / FILES.length), total: DOC_TOTAL, current: FILES[i] },
                key ? [key] : []);
      await sleep(key ? 620 : 300);
    }
    paintRoom(null, []);
  },

  reset() {
    CLASSES.forEach(c => { c.found = false; });
    const host = $('#na-room'); if (host) host.innerHTML = DS.roomPreview({});
    const f = $('#na-drive'); if (f) f.value = '';
    const n = $('#na-name'); if (n) n.value = '';
    const dz = $('#na-deck'); if (dz) dz.innerHTML = deckZone(null);
    deck = false; syncRun();
  },

  /* THE RUN, COMPRESSED. A real assess run is eleven workstreams on a cloud runner and takes about
     two hours; nobody is watching a marketing page for two hours. So the eleven steps are the real
     ones — ASSESS_PLAN, transcribed from the orchestration prompt — played at about a second each,
     and the elapsed clock climbs at the REAL rate rather than the animation's. That is the honest
     way round: the shot is short, and what it says about the product is true. */
  async run() {
    const RUN_MINUTES = [0, 8, 23, 37, 52, 68, 81, 96, 108, 117, 124, 131];
    const started = () => new Date(Date.now() - RUN_MINUTES[step] * 60000).toISOString();
    let step = 0;
    const state = () => ({
      ...RUN_STATES.running, status: 'running', totalSteps: 11, step,
      progress: Math.round((step / 11) * 100), startedAt: started(),
      label: step ? DS.ASSESS_PLAN[step - 1].title + '…' : null,
    });
    mountRunning({ ...state(), step: 0, label: null });   // queued: the runner has not reported yet
    await sleep(1600);
    for (step = 1; step <= 11; step++) {
      const host = $('#ea-status');
      if (host) host.innerHTML = DS.assessingMemo(RUNNING, SCORE_FORMING, state());
      await sleep(step === 1 ? 1500 : 950);
    }
    await sleep(1200);
    mountAssess();
  },

  /* The typed question is already in the box when this runs — the shot put it there, keystroke by
     keystroke, through the product's own input events. */
  async ask() {
    const box = $('#chat-input');
    const text = (box && box.value.trim()) || CHAT.q;
    chat = chat.concat([{ role: 'user', text }]);
    // The form lives in the aux FOOTER, which repaintChat does not touch, so the question would
    // otherwise sit in the box underneath its own answer.
    if (box) box.value = '';
    repaintChat(true);                      // the three dots: the product's own pending state
    await sleep(1800);

    /* THE ANSWER ARRIVES, IT DOES NOT APPEAR. Same reveal the live workspace uses — DS.chatReveal
       gives the frames and never cuts inside a [[citation]], a **bold run** or a ⟨derived⟩ marker.
       The sources and the proposal land at the END, after the prose, which is both what a streaming
       interface does and the right order to read it in: the claim, then what backs it. */
    const asked = chat;                                  // everything up to and including the question
    const bare = { ...CHAT.a, revealing: true };   // keeps `cited`, so no frame can read as unverified
    for (const frame of DS.chatReveal(CHAT.a.text)) {
      chat = asked.concat([{ ...bare, text: frame }]);
      repaintChat(false);
      await sleep(26);
    }
    chat = asked.concat([CHAT.a]);                       // the sources and the proposal, last
    repaintChat(false);
    await sleep(400);
  },
  resetChat() { chat = []; repaintChat(false); },

  /* The flow ends by reloading the frame rather than un-winding four views by hand. The shot engine
     restarts its beats on every load, so a reload IS the loop. */
  restart() { location.reload(); },
};

export function boot(view) {
  bind();
  window.__demo = demo;
  ({ portfolio: mountPortfolio, create: mountCreate, assess: mountAssess }[view] || mountAssess)();
}
