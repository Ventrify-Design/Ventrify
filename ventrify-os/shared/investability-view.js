// ============================================================
// Ventrify OS — Investability (VSS 7×5) scorecard, shared renderer.
//
// Design ported from the original client-portal (MoneyGym) Investability tab —
// the presentation the operator prefers: a hero score card, a 7-category
// breakdown whose rows expand to the 5 sub-criteria (chip + question + note +
// evidence ref), a 7-axis radar, and a Deficiency Heatmap ("fix this next").
//
// Consumes the published snapshot shape (tools/cloud/publish.js):
//   { composite, maxPossible, pct, band, bandLabel, ratedCount, pendingCount,
//     categories: [{ key, label, sum, max, rated, pending, band,
//                    subs: [{ slug, score, note }] }] }
// Notes may carry an inline evidence ref as "<note> · ref: <ref>" — split out
// and shown as an evidence pill (the snapshot schema has no separate ref field).
// ============================================================

import { esc as _esc } from './util.js';

// band ('green'|'yellow'|'red') OR composite band ('approved'|'feedback'|'rework'|'pass')
// → a DS band token. One colour map for every surface.
export function bandColor(band) {
  const b = String(band || '').toLowerCase();
  if (b === 'green' || b === 'approved' || b === 'strong') return 'var(--band-strong, #00A368)';
  if (b === 'red' || b === 'pass' || b === 'weak' || b === 'rework') return 'var(--band-weak, #C42233)';
  return 'var(--band-mid, #C77700)'; // yellow / feedback / mid
}
// Soft tint of the band colour, for chip/pill backgrounds.
export function bandTint(band) {
  const b = String(band || '').toLowerCase();
  if (b === 'green' || b === 'approved' || b === 'strong') return 'rgba(0,163,104,0.12)';
  if (b === 'red' || b === 'pass' || b === 'weak' || b === 'rework') return 'rgba(196,34,51,0.10)';
  return 'rgba(199,119,0,0.13)';
}

// Canonical rubric metadata (mirrors reference_venture_sentiment_score.md) so a
// snapshot that carries only slug+score+note still renders the human question.
const CAT_ORDER = ['market', 'team', 'product', 'moat', 'financial', 'execution', 'evidence'];
const CAT_SHORT = { market: 'Market', team: 'Team', product: 'Product', moat: 'Moat', financial: 'Financial', execution: 'Execution', evidence: 'Evidence' };
const CAT_DESC = {
  market: 'Is the market large, growing, and timed right — with credible demand signals?',
  team: 'Can this team attract talent, close deals, and out-execute under capital constraints?',
  product: 'Is the value prop crisp, the problem real, and the MVP disciplined?',
  moat: 'What stops a fast-follower from winning the market in 18 months?',
  financial: 'Do the numbers survive a partner spreadsheet, and is the ask milestone-anchored?',
  execution: 'What has the team actually shipped, and at what cadence?',
  evidence: 'Does every material claim survive an LP fact-check?',
};
const SUB_Q = {
  market_size: 'Is TAM >$1B with realistic penetration potential?',
  market_growth: 'Is the market growing strongly (CAGR >20% = 1pt, 10–20% = 0.5pt)?',
  why_now: 'Is there a credible Why Now — a named regulatory, technological, or cultural inflection?',
  demand_validation: 'Is customer demand validated via pilots, contracts, or willingness-to-pay signals?',
  gross_margin: 'Does the market enable attractive long-term gross margins?',
  ceo_vision: 'Does the CEO communicate a compelling vision and inspire confidence?',
  talent_attraction: 'Can the team attract, inspire, and retain high-caliber talent?',
  founder_market_fit: 'Do founders show strong founder–market fit?',
  execution_record: 'Do founders show a strong execution record + bias to delivering quickly?',
  ethics_trust: 'Do founders demonstrate ethics, transparency, and trustworthiness?',
  value_prop_clarity: 'Can a partner repeat the value prop in one sentence after one read?',
  improvement_10x: 'Is the product a 10x improvement on the existing workaround?',
  moscow_discipline: 'Is the MVP scoped tight (8–15 Must Haves) and justified against research?',
  persona_depth: 'Are 2–3 personas defined with substantive goals, frustrations, and fit?',
  problem_validation: 'Is the problem statement validated with qualitative + quantitative anchors?',
  differentiation: 'Is the differentiation ahead of the current state of the art?',
  ip_defensibility: 'Is the moat defensible through IP, know-how, proprietary data, or trade secrets?',
  switching_costs: 'Are there meaningful switching costs or barriers against displacement?',
  scalability: 'Can the product be scaled or manufactured cost-effectively at commercial demand?',
  ecosystem_moats: 'Can the company leverage ecosystem relationships or regulatory positioning?',
  files_complete: 'Are all canonical financial files present and internally consistent?',
  ltv_cac_ratio: 'Is the LTV/CAC ratio >3:1 with payback <12 months (or sector benchmarks)?',
  sensitivity_coverage: 'Is sensitivity analysis covered across ≥5 variables with best/base/worst cases?',
  milestone_anchored_ask: 'Is the funding ask sized to specific milestones that unlock the next round?',
  risk_honesty: 'Are risks named and mitigated (not buried), with downside scenarios documented?',
  live_surfaces: 'Are there ≥4 live preview surfaces (marketing, DS, app, social, engine)?',
  ia_coverage: 'Is shipped-screen count ≥70% of the design/ia.json IA target?',
  gate_velocity: 'Is gate-closure velocity in line with the Ventrify benchmark?',
  payment_cadence: 'Are milestone payments captured and current with engagement progress?',
  traction_signals: 'Are there beta tester feedback, waitlist numbers, or early traction signals?',
  citation_density: 'Is the sourced-stat density ≥80% (% material claims with inline citations)?',
  source_count: 'Are there ≥15 distinct credible sources across the research?',
  hallucination_check: 'Has the source-verifier passed with zero hallucinations and no impossible numbers?',
  methodology_disclosure: 'Are assumptions named and methodology ranges specified (not buried)?',
  cross_file_consistency: 'Do the numbers cross-check arithmetically across research, financial, and ask?',
};
const BAND_WORD = { approved: 'Strong', feedback: 'Promising', rework: 'Material gaps', unrated: 'Not yet rated' };

function ratioBand(r) { return r >= 0.8 ? 'green' : r >= 0.5 ? 'yellow' : 'red'; }
// Notes may end with " · ref: <ref>" (folded in at publish time) — split it back out.
function splitRef(note) {
  const s = String(note || '');
  const i = s.indexOf(' · ref: ');
  if (i < 0) return { note: s || null, ref: null };
  return { note: s.slice(0, i) || null, ref: s.slice(i + 8) || null };
}

// ── The scorecard ──────────────────────────────────────────────────────────
// opts: headline (false → suppress hero, e.g. the assess page has its own
// scoreboard) · variant ('operator'|'studio') · metaText · esc.
export function renderVSSScorecard(snap, opts = {}) {
  if (!snap) return '';
  const esc = opts.esc || _esc;
  const cc = bandColor(snap.band);
  const max = snap.maxPossible || 35;
  const cats = (snap.categories || []).map(c => ({ ...c, max: c.max || 5 }));
  const ratedCount = snap.ratedCount != null ? snap.ratedCount
    : cats.reduce((n, c) => n + (c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length), 0);
  const pendingCount = snap.pendingCount != null ? snap.pendingCount : Math.max(0, 35 - ratedCount);

  // ── Hero — the score itself is the headline (no percentage here) ───────
  const band = String(snap.band || 'unrated').toLowerCase();
  const bandWord = BAND_WORD[band] || (snap.bandLabel || snap.band || '');
  const ratedLine = `${esc(ratedCount)} of 35 signals rated${pendingCount ? ` &middot; ${esc(pendingCount)} not assessable here` : ''}`;
  const hero = opts.headline === false ? '' : `<div class="vss-hero">
      <div class="vss-hero-number" style="color:${cc};">${esc(snap.composite)}<span class="vss-hero-suffix"> / ${esc(max)}</span></div>
      <div class="vss-hero-body">
        <span class="vss-band-pill" style="color:${cc};background:${bandTint(snap.band)};">${esc(bandWord)}</span>
        <div class="vss-band-label">${esc(snap.bandLabel || '')}</div>
        <div class="vss-hero-meta">${ratedLine}</div>
        <div class="vss-attribution">VSS v2 &middot; TDK Ventures &middot; GoingVC &middot; VCII Balanced Scorecard</div>
      </div>
      <div class="vss-sparkline"><svg viewBox="0 0 120 36"><circle cx="112" cy="18" r="3.5" fill="${cc}"/></svg></div>
    </div>`;

  // ── Category breakdown (expandable rows → sub-criteria) ────────────────
  const ordered = CAT_ORDER.map(k => cats.find(c => c.key === k)).filter(Boolean)
    .concat(cats.filter(c => !CAT_ORDER.includes(c.key)));
  const catRow = (c) => {
    const subs = c.subs || [];
    const rated = c.rated != null ? c.rated : subs.filter(s => s.score != null).length;
    const ratio = rated > 0 ? c.sum / rated : 0;
    const cb = rated > 0 ? ratioBand(ratio) : 'unrated';
    const fill = bandColor(cb);
    const pendN = c.pending != null ? c.pending : subs.filter(s => s.score == null).length;
    const num = rated > 0
      ? `<div class="vss-cat-num">${esc(c.sum)}<span class="vss-denom"> / ${esc(rated)}</span></div>`
      : `<div class="vss-cat-num vss-muted">n/a</div>`;
    const subRows = subs.map(s => {
      const { note, ref } = splitRef(s.note);
      const na = s.score == null;
      const chipAttr = s.score === 1 ? 'green' : s.score === 0.5 ? 'yellow' : s.score === 0 ? 'red' : 'na';
      const chipTxt = s.score === 1 ? '1' : s.score === 0.5 ? '½' : s.score === 0 ? '0' : '–';
      const chipCol = na ? '' : `color:${bandColor(chipAttr)};background:${bandTint(chipAttr)};`;
      const ev = ref ? `<span class="vss-ev" title="${esc(ref)}">${esc(ref)}</span>` : '';
      return `<div class="vss-sub${na ? ' vss-sub-na' : ''}">
          <span class="vss-chip" style="${chipCol}">${chipTxt}</span>
          <div class="vss-sub-body"><span class="vss-sub-q">${esc(SUB_Q[s.slug] || s.slug)}</span>${note ? `<span class="vss-sub-note">${esc(note)}</span>` : ''}</div>
          <div class="vss-sub-meta">${ev}</div>
        </div>`;
    }).join('');
    return `<div class="vss-cat-row">
        <div class="vss-cat-head">
          <div class="vss-cat-label">${esc(c.label)}</div>
          <div class="vss-cat-bar"><div class="vss-cat-bar-fill" style="width:${Math.round(ratio * 100)}%;background:${fill};"></div></div>
          ${num}
          <div class="vss-chev">&#9662;</div>
          <div class="vss-cat-desc">${esc(CAT_DESC[c.key] || '')}${pendN ? ` <em>&middot; ${esc(pendN)} not assessable</em>` : ''}</div>
        </div>
        <div class="vss-cat-body">${subRows}</div>
      </div>`;
  };
  const dims = ordered.length ? `<div class="vss-dimensions">
      <div class="vss-dim-header">
        <div class="vss-dim-title">Category breakdown &mdash; 7 &times; 5 scorecard</div>
        <div class="vss-dim-toggles">
          <button type="button" class="vss-toggle" data-vss="expand">Expand all &#9662;</button>
          <button type="button" class="vss-toggle" data-vss="radar">View radar &#9662;</button>
        </div>
      </div>
      ${ordered.map(catRow).join('')}
      <div class="vss-radar-wrap">${renderRadar(ordered, esc)}</div>
    </div>` : '';

  // ── Deficiency Heatmap (top-5 lowest-scored sub-criteria) ─────────────
  const defs = [];
  ordered.forEach(c => (c.subs || []).forEach(s => {
    if (s.score === 0 || s.score === 0.5) {
      const { note, ref } = splitRef(s.note);
      defs.push({ catLabel: c.label, slug: s.slug, score: s.score, lift: 1 - s.score, q: SUB_Q[s.slug] || s.slug, note, ref });
    }
  }));
  defs.sort((a, b) => b.lift - a.lift || a.score - b.score);
  const top = defs.slice(0, 5);
  const heatmap = `<div class="vss-heatmap">
      <div class="vss-heat-header"><div class="vss-heat-title">Deficiency heatmap${top.length ? ` &middot; top ${top.length}` : ''}</div><div class="vss-heat-meta">Ranked by lift potential</div></div>
      ${top.length ? `<div class="vss-heat-grid">${top.map(d => `
        <div class="vss-def" style="border-left-color:${bandColor(d.score === 0.5 ? 'yellow' : 'red')};">
          <div class="vss-def-head"><span class="vss-def-cat">${esc(d.catLabel)}</span><span class="vss-def-slug">${esc(d.slug)}</span><span class="vss-def-lift" style="color:${bandColor(d.score === 0.5 ? 'yellow' : 'red')};background:${bandTint(d.score === 0.5 ? 'yellow' : 'red')};">+${d.lift === 0.5 ? '0.5' : '1.0'}</span></div>
          <div class="vss-def-q">${esc(d.q)}</div>
          ${d.note ? `<div class="vss-def-note">&ldquo;${esc(d.note)}&rdquo;</div>` : ''}
          ${d.ref ? `<span class="vss-ev" title="${esc(d.ref)}">${esc(d.ref)}</span>` : ''}
        </div>`).join('')}</div>`
      : `<div class="vss-heat-empty">No deficiencies &mdash; every rated sub-criterion is at 1.</div>`}
    </div>`;

  const meta = opts.metaText ? `<div class="vss-meta">${esc(opts.metaText)}</div>` : '';
  return `${hero}${dims}${heatmap}${meta}`;
}

// ── 7-axis radar (collapsed by default) ─────────────────────────────────────
function renderRadar(ordered, esc) {
  const cats = CAT_ORDER.map(k => ordered.find(c => c.key === k)).filter(Boolean);
  if (cats.length < 3) return '';
  const SIZE = 320, CX = SIZE / 2, CY = SIZE / 2, R = 116, LR = 146, N = cats.length;
  const step = (2 * Math.PI) / N, ang = i => -Math.PI / 2 + i * step;
  const ratioOf = c => { const rated = c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length; return rated > 0 ? c.sum / rated : 0; };
  const grid = [0.25, 0.5, 0.75, 1].map(lv => `<polygon class="vss-radar-grid" points="${cats.map((_, i) => `${CX + Math.cos(ang(i)) * R * lv},${CY + Math.sin(ang(i)) * R * lv}`).join(' ')}"/>`).join('');
  const axes = cats.map((_, i) => `<line class="vss-radar-grid" x1="${CX}" y1="${CY}" x2="${CX + Math.cos(ang(i)) * R}" y2="${CY + Math.sin(ang(i)) * R}"/>`).join('');
  const poly = cats.map((c, i) => `${CX + Math.cos(ang(i)) * R * ratioOf(c)},${CY + Math.sin(ang(i)) * R * ratioOf(c)}`).join(' ');
  const labels = cats.map((c, i) => {
    const a = ang(i), x = CX + Math.cos(a) * LR, y = CY + Math.sin(a) * LR;
    let anc = 'middle'; if (Math.cos(a) > 0.3) anc = 'start'; else if (Math.cos(a) < -0.3) anc = 'end';
    const dy = Math.sin(a) > 0.3 ? 11 : Math.sin(a) < -0.3 ? -5 : 3;
    return `<text class="vss-radar-lbl" x="${x}" y="${y + dy}" text-anchor="${anc}">${esc(CAT_SHORT[c.key] || c.key)}</text>`;
  }).join('');
  return `<svg class="vss-radar" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Investability radar">
      ${grid}${axes}
      <polygon class="vss-radar-fill" points="${poly}"/><polygon class="vss-radar-stroke" points="${poly}"/>
      ${labels}
    </svg>`;
}

// The "how to strengthen this venture" list (unchanged; used by both surfaces).
export function renderStrengthenSuggestions(items, opts = {}) {
  const esc = opts.esc || _esc;
  const sg = items || [];
  if (!sg.length) return '';
  return `<div class="vss-sugg">
      <div class="vss-sugg-title">How to strengthen this venture</div>
      <div class="vss-sugg-list">
        ${sg.map(it => `<div class="vss-sugg-item"><span class="vss-sugg-arrow">&rarr;</span><div>${it.category ? `<strong>${esc(it.category)}:</strong> ` : ''}${esc(it.suggestion || it.text || '')}</div></div>`).join('')}
      </div>
    </div>`;
}

export function ensureInvestabilityStyles() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('vss-styles')) {
    const s = document.createElement('style'); s.id = 'vss-styles';
    s.textContent = `
    :root { --vss-surf: var(--surface-2, #fff); --vss-bd: var(--border, rgba(0,0,0,0.07)); --vss-mut: var(--muted, #6B7594); --vss-txt: var(--text, #1A1A2E); --vss-mono: var(--font-mono, ui-monospace, 'SF Mono', monospace); --vss-disp: var(--font-heading, 'Space Grotesk', sans-serif); }
    /* Hero */
    .vss-hero { display:grid; grid-template-columns:minmax(170px,auto) 1fr auto; gap:1.8rem; align-items:center; padding:1.6rem 1.8rem; background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; margin-bottom:1.25rem; }
    .vss-hero-number { font-family:var(--vss-disp); font-size:clamp(3.6rem, 7vw, 6rem); font-weight:700; line-height:0.95; letter-spacing:-0.035em; white-space:nowrap; }
    .vss-hero-suffix { font-size:0.32em; color:var(--vss-mut); font-weight:500; letter-spacing:-0.02em; }
    .vss-hero-body { display:flex; flex-direction:column; gap:0.45rem; min-width:0; }
    .vss-band-pill { align-self:flex-start; font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; padding:0.28rem 0.7rem; border-radius:999px; }
    .vss-band-label { font-size:0.92rem; color:var(--vss-txt); line-height:1.4; }
    .vss-hero-meta { font-family:var(--vss-mono); font-size:0.72rem; color:var(--vss-mut); letter-spacing:0.02em; }
    .vss-attribution { font-family:var(--vss-mono); font-size:0.68rem; color:var(--vss-mut); opacity:0.85; }
    .vss-sparkline svg { width:120px; height:36px; }
    @media (max-width:640px){ .vss-hero{ grid-template-columns:1fr; text-align:center; } .vss-band-pill{ align-self:center; } .vss-sparkline{ display:none; } }
    /* Dimensions panel */
    .vss-dimensions { background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; padding:1.3rem 1.5rem; margin-bottom:1.25rem; }
    .vss-dim-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:0.4rem; }
    .vss-dim-title { font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:var(--vss-mut); }
    .vss-dim-toggles { display:flex; gap:0.5rem; }
    .vss-toggle { font-family:var(--vss-mono); font-size:0.66rem; padding:0.35rem 0.7rem; border-radius:999px; background:transparent; color:var(--vss-mut); border:1px solid var(--vss-bd); cursor:pointer; letter-spacing:0.03em; }
    .vss-toggle:hover { color:var(--primary,#6E3AFA); border-color:var(--primary,#6E3AFA); }
    .vss-toggle.active { background:var(--primary,#6E3AFA); color:#fff; border-color:var(--primary,#6E3AFA); }
    .vss-cat-row { border-bottom:1px solid var(--vss-bd); padding:0.85rem 0; }
    .vss-cat-row:last-of-type { border-bottom:none; }
    .vss-cat-head { display:grid; grid-template-columns:190px 1fr 64px 16px; gap:1rem; align-items:center; cursor:pointer; user-select:none; }
    .vss-cat-label { font-size:0.92rem; font-weight:600; color:var(--vss-txt); letter-spacing:-0.01em; }
    .vss-cat-bar { height:8px; background:rgba(0,0,0,0.06); border-radius:999px; overflow:hidden; }
    .vss-cat-bar-fill { height:100%; border-radius:999px; transition:width .6s cubic-bezier(0.4,0,0.2,1); }
    .vss-cat-num { font-family:var(--vss-disp); font-size:1.25rem; font-weight:600; text-align:right; letter-spacing:-0.02em; color:var(--vss-txt); }
    .vss-cat-num.vss-muted { font-family:var(--vss-mono); font-size:0.78rem; color:var(--vss-mut); }
    .vss-denom { color:var(--vss-mut); font-size:0.85rem; font-weight:500; }
    .vss-chev { font-size:0.7rem; color:var(--vss-mut); text-align:center; transition:transform .2s ease; }
    .vss-cat-row.vss-open .vss-chev { transform:rotate(180deg); }
    .vss-cat-desc { grid-column:1 / -1; font-size:0.78rem; color:var(--vss-mut); margin-top:0.4rem; line-height:1.5; }
    .vss-cat-desc em { color:var(--band-mid,#C77700); font-style:normal; }
    .vss-cat-body { display:none; margin-top:0.8rem; padding:0.2rem 0 0.2rem 0.8rem; border-left:2px solid var(--vss-bd); }
    .vss-cat-row.vss-open .vss-cat-body { display:block; }
    @media (max-width:640px){ .vss-cat-head{ grid-template-columns:1fr 56px 16px; } .vss-cat-label{ grid-column:1 / -1; margin-bottom:0.25rem; } }
    .vss-sub { display:grid; grid-template-columns:24px 1fr auto; gap:0.7rem; padding:0.6rem 0; align-items:start; border-bottom:1px dashed var(--vss-bd); }
    .vss-sub:last-child { border-bottom:none; }
    .vss-sub-na { opacity:0.55; }
    .vss-chip { width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; background:rgba(0,0,0,0.06); color:var(--vss-mut); }
    .vss-sub-body { font-size:0.84rem; color:var(--vss-txt); line-height:1.45; }
    .vss-sub-q { font-weight:500; }
    .vss-sub-note { display:block; margin-top:0.25rem; font-size:0.8rem; color:var(--vss-mut); font-style:italic; }
    .vss-ev { display:inline-block; padding:0.18rem 0.5rem; border-radius:999px; background:rgba(0,0,0,0.05); color:var(--vss-mut); font-family:var(--vss-mono); font-size:0.64rem; letter-spacing:0.02em; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    /* Radar */
    .vss-radar-wrap { display:none; padding:1.2rem 0 0.3rem; justify-content:center; }
    .vss-radar-wrap.vss-open { display:flex; }
    .vss-radar { width:300px; max-width:100%; }
    .vss-radar-grid { stroke:rgba(0,0,0,0.09); stroke-width:1; fill:none; }
    .vss-radar-fill { fill:var(--primary,#6E3AFA); fill-opacity:0.14; }
    .vss-radar-stroke { stroke:var(--primary,#6E3AFA); stroke-width:2; fill:none; }
    .vss-radar-lbl { font-family:var(--vss-mono); font-size:0.6rem; fill:var(--vss-mut); }
    /* Heatmap */
    .vss-heatmap { background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; padding:1.3rem 1.5rem; }
    .vss-heat-header { display:flex; justify-content:space-between; align-items:baseline; gap:1rem; flex-wrap:wrap; margin-bottom:0.9rem; }
    .vss-heat-title { font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:var(--vss-mut); }
    .vss-heat-meta { font-family:var(--vss-mono); font-size:0.66rem; color:var(--vss-mut); }
    .vss-heat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:0.8rem; }
    .vss-def { padding:0.8rem 0.95rem; border-radius:10px; background:rgba(0,0,0,0.02); border-left:3px solid var(--band-weak,#C42233); display:flex; flex-direction:column; gap:0.45rem; }
    .vss-def-head { display:flex; align-items:center; gap:0.5rem; font-family:var(--vss-mono); font-size:0.62rem; color:var(--vss-mut); letter-spacing:0.03em; text-transform:uppercase; }
    .vss-def-cat { font-weight:700; color:var(--vss-txt); }
    .vss-def-slug { overflow:hidden; text-overflow:ellipsis; }
    .vss-def-lift { margin-left:auto; padding:0.1rem 0.45rem; border-radius:999px; font-weight:700; }
    .vss-def-q { font-size:0.82rem; color:var(--vss-txt); line-height:1.4; }
    .vss-def-note { font-size:0.78rem; color:var(--vss-mut); font-style:italic; line-height:1.45; }
    .vss-heat-empty { padding:1.6rem 0; text-align:center; color:var(--vss-mut); font-size:0.88rem; }
    .vss-meta { font-family:var(--vss-mono); color:var(--vss-mut); font-size:0.66rem; letter-spacing:0.06em; text-transform:uppercase; margin-top:0.95rem; }
    /* Strengthen suggestions (unchanged contract) */
    .vss-sugg { margin-top:1.25rem; }
    .vss-sugg-title { font-family:var(--vss-mono); font-size:0.62rem; letter-spacing:0.07em; text-transform:uppercase; font-weight:700; color:var(--accent,#00B8A0); margin-bottom:0.6rem; }
    .vss-sugg-list { display:flex; flex-direction:column; gap:0.55rem; }
    .vss-sugg-item { display:flex; gap:0.55rem; align-items:flex-start; font-size:0.88rem; line-height:1.5; }
    .vss-sugg-arrow { color:var(--accent,#00B8A0); font-weight:700; flex:none; }
    `;
    document.head.appendChild(s);
  }
  // One-time delegated interactions (survive re-renders).
  if (!window.__vssWired) {
    window.__vssWired = true;
    document.addEventListener('click', (e) => {
      const head = e.target.closest('.vss-cat-head');
      if (head) { head.closest('.vss-cat-row').classList.toggle('vss-open'); return; }
      const tog = e.target.closest('.vss-toggle');
      if (!tog) return;
      const panel = tog.closest('.vss-dimensions');
      if (tog.dataset.vss === 'expand') {
        const rows = panel.querySelectorAll('.vss-cat-row');
        const any = Array.from(rows).some(r => r.classList.contains('vss-open'));
        rows.forEach(r => r.classList.toggle('vss-open', !any));
        tog.classList.toggle('active', !any);
        tog.innerHTML = any ? 'Expand all &#9662;' : 'Collapse all &#9652;';
      } else if (tog.dataset.vss === 'radar') {
        const wrap = panel.querySelector('.vss-radar-wrap');
        if (wrap) { const open = wrap.classList.toggle('vss-open'); tog.classList.toggle('active', open); tog.innerHTML = open ? 'Hide radar &#9652;' : 'View radar &#9662;'; }
      }
    });
  }
}
