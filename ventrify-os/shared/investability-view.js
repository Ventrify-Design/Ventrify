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
  if (b === 'forming' || b === 'unrated' || b === 'na') return 'var(--text-subtle, #888888)'; // neutral — nothing scored yet
  return 'var(--band-mid, #C77700)'; // yellow / feedback / mid
}
// Soft tint of the band colour, for chip/pill backgrounds.
export function bandTint(band) {
  const b = String(band || '').toLowerCase();
  if (b === 'green' || b === 'approved' || b === 'strong') return 'rgba(0,163,104,0.12)';
  if (b === 'red' || b === 'pass' || b === 'weak' || b === 'rework') return 'rgba(196,34,51,0.10)';
  if (b === 'forming' || b === 'unrated' || b === 'na') return 'rgba(0,0,0,0.05)';
  return 'rgba(199,119,0,0.13)';
}

// Canonical rubric metadata (mirrors reference_venture_sentiment_score.md) so a
// snapshot that carries only slug+score+note still renders the human question.
const CAT_ORDER = ['market', 'team', 'product', 'moat', 'financial', 'execution', 'evidence'];
const CAT_SHORT = { market: 'Market', team: 'Team', product: 'Product', moat: 'Moat', financial: 'Financial', execution: 'Exec', evidence: 'Evidence' };
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
const BAND_WORD = { approved: 'Strong', feedback: 'Promising', rework: 'Material gaps', forming: 'Forming', unrated: 'Not yet rated' };
const SB_BAND = { green: 'Strong', yellow: 'Mixed', red: 'Gap', unrated: 'n/a' };
// Fallback category weights (mirror of vss-rubric.js) for any snapshot that predates
// VSS v3 and doesn't carry per-category weight. v3 snapshots carry c.weight directly.
const CAT_WEIGHTS = { market: 0.20, team: 0.25, product: 0.15, moat: 0.15, financial: 0.10, execution: 0.10, evidence: 0.05 };
// Prose-friendly short names for the auto-generated profile reading (CAT_SHORT uses
// "Exec" which reads oddly in a sentence).
const CAT_PROSE = { market: 'Market', team: 'Team', product: 'Product', moat: 'Moat', financial: 'Financial', execution: 'Execution', evidence: 'Evidence' };

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
  const ratedLine = (snap.status === 'forming' || band === 'forming')
    ? `${esc(ratedCount)} of 35 signals rated &middot; grows as the venture builds`
    : `${esc(ratedCount)} of 35 signals rated${pendingCount ? ` &middot; ${esc(pendingCount)} not assessable here` : ''}`;
  const hero = opts.headline === false ? '' : `<div class="vss-hero" style="border-left:4px solid ${cc};">
      <div class="vss-hero-number">${esc(snap.composite)}<span class="vss-hero-suffix"> / ${esc(max)}</span></div>
      <div class="vss-hero-body">
        <span class="vss-band-pill" style="color:${cc};background:${bandTint(snap.band)};">${esc(bandWord)}</span>
        <div class="vss-band-label">${esc(snap.bandLabel || '')}</div>
        <div class="vss-hero-meta">${ratedLine}</div>
        <div class="vss-attribution">VSS v3 &middot; weighted &middot; TDK Ventures &middot; GoingVC &middot; VCII / Payne</div>
      </div>
    </div>`;

  // ── Compute each category ONCE: fraction, weight, band, contribution. Shared by
  //    the calc table AND the profile reading — one source of truth. ─────────────
  const ordered = CAT_ORDER.map(k => cats.find(c => c.key === k)).filter(Boolean)
    .concat(cats.filter(c => !CAT_ORDER.includes(c.key)));
  const wOf = c => (c.weight != null ? c.weight : (CAT_WEIGHTS[c.key] || 0));
  let den = 0;
  ordered.forEach(c => { const rated = c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length; if (rated > 0) den += wOf(c); });
  const computed = ordered.map(c => {
    const rated = c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length;
    const frac = rated > 0 ? c.sum / rated : null;
    const w = wOf(c);
    return { c, rated, frac, w, cb: frac != null ? ratioBand(frac) : 'unrated', contrib: (frac != null && den > 0) ? (100 * frac * w / den) : 0 };
  });
  const showBreakdown = ordered.length && snap.status !== 'forming' && band !== 'forming';

  // ── Priority gaps we surface — ranked by lift, then by category weight (so the
  //    "top" are the genuinely impactful fixes). Shared by BOTH the potential overlay
  //    (what closing them reaches) and the deficiency heatmap below — one source. ──
  const defs = [];
  ordered.forEach(c => (c.subs || []).forEach(s => {
    if (s.score === 0 || s.score === 0.5) {
      const { note, ref } = splitRef(s.note);
      defs.push({ catKey: c.key, catLabel: c.label, slug: s.slug, score: s.score, lift: 1 - s.score, weight: c.weight != null ? c.weight : (CAT_WEIGHTS[c.key] || 0), q: SUB_Q[s.slug] || s.slug, note, ref });
    }
  }));
  defs.sort((a, b) => b.lift - a.lift || b.weight - a.weight || a.score - b.score);
  const top = defs.slice(0, 5);
  const flaggedSlugs = new Set(top.map(d => d.slug));

  // ── The accordion row — the per-category DETAIL surface (expands to the 5
  //    sub-criteria). Weight + contribution live in the calc table above, so this
  //    stays clean: label + fraction bar + score + the drill-down. ─────────────
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

  // ── Score breakdown panel — the calc TABLE (Category · Weight · Rated · Contribution,
  //    contributions sum to the headline) + the explainer + legend. ─────────────
  let scoreboard = '', profile = '';
  if (showBreakdown) {
    const composite = Number(snap.composite) || 0;
    const maxContrib = Math.max(0.001, ...computed.map(r => r.contrib));
    const trows = computed.map(({ c, rated, frac, w, cb, contrib }) => {
      const barW = Math.round((contrib / maxContrib) * 100);
      const bar = frac != null ? `<span class="vss-sb-bar" style="width:${barW}%;background:${bandTint(cb)};border-left:2px solid ${bandColor(cb)};"></span>` : '';
      return `<tr>
          <td class="vss-sb-cat">${esc(c.label)}</td>
          <td class="vss-sb-num">${Math.round(w * 100)}%</td>
          <td class="vss-sb-num">${frac != null ? `${esc(c.sum)}/${esc(rated)}` : '&ndash;'}</td>
          <td class="vss-sb-contribcell">${bar}<span class="vss-sb-contrib" style="color:${bandColor(cb)};">${frac != null ? `+${contrib.toFixed(1)}` : '&ndash;'}</span></td>
        </tr>`;
    }).join('');
    scoreboard = `<div class="vss-scoreboard">
      <div class="vss-sb-main">
        <div class="vss-sb-title">How the score is calculated</div>
        <p class="vss-sb-explainer">Each of the 7 categories is scored as a fraction of its rated criteria (0&ndash;1), <strong>weighted by importance</strong> &mdash; Team and Market carry the most &mdash; then summed to a 0&ndash;100 score. The contributions below add up to the headline <strong style="color:${cc};">${esc(composite)}</strong>.</p>
        <table class="vss-sb-table">
          <thead><tr><th>Category</th><th>Weight</th><th>Rated</th><th>Contribution</th></tr></thead>
          <tbody>${trows}</tbody>
          <tfoot><tr><td>Investability score</td><td></td><td></td><td class="vss-sb-num vss-sb-total" style="color:${cc};">${esc(composite)} / ${esc(max)}</td></tr></tfoot>
        </table>
        <div class="vss-sb-legend">Contribution = (rated &divide; max) &times; weight. Bands: <b style="color:${bandColor('green')};">Strong</b> &ge;0.80 &middot; <b style="color:${bandColor('yellow')};">Mixed</b> 0.50&ndash;0.79 &middot; <b style="color:${bandColor('red')};">Gap</b> &lt;0.50. Unassessable signals are excluded, not scored zero.</div>
      </div>
    </div>`;

    // ── Category profile — the radar with its CURRENT shape plus a dashed "potential"
    //    overlay (the achievable shape if the flagged, addressable gaps close), a
    //    plain-English reading, and the resulting "now → potential" uplift. All derived
    //    in the view from the snapshot — NO pipeline dependency. ────────────────────
    const ratedC = computed.filter(r => r.frac != null);
    const byFrac = [...ratedC].sort((a, b) => b.frac - a.frac);
    const nm = r => esc(CAT_PROSE[r.c.key] || r.c.label);
    const greens = ratedC.filter(r => r.cb === 'green').length;
    const yellows = ratedC.filter(r => r.cb === 'yellow').length;
    const reds = ratedC.filter(r => r.cb === 'red').length;
    const spread = byFrac.length ? (byFrac[0].frac - byFrac[byFrac.length - 1].frac) : 0;
    const shape = spread <= 0.25 ? 'an even, balanced profile' : spread >= 0.45 ? 'a concentrated profile &mdash; strengths and gaps are pronounced' : 'a moderately uneven profile';
    const shapeRead = byFrac.length >= 4
      ? `Strongest on <strong>${nm(byFrac[0])}</strong> and <strong>${nm(byFrac[1])}</strong>; thinnest on <strong>${nm(byFrac[byFrac.length - 1])}</strong> and <strong>${nm(byFrac[byFrac.length - 2])}</strong> &mdash; ${shape}.`
      : '';
    // Potential = close ONLY the priority gaps we surface (the `top` flagged items) to
    // their resolved value; every other score is held. A bounded, honest "fix what we
    // flagged" ceiling — it CANNOT reach 100, because unflagged scores never move.
    const potMap = {}; let pnum = 0, pden = 0;
    computed.forEach(r => {
      let psum = 0, prated = 0;
      for (const s of (r.c.subs || [])) { if (s.score == null) continue; prated++; psum += flaggedSlugs.has(s.slug) ? 1 : s.score; }
      if (prated > 0) { const pf = psum / prated; potMap[r.c.key] = pf; pnum += pf * r.w; pden += r.w; }
    });
    const potential = pden > 0 ? Math.round(100 * pnum / pden) : composite;
    const uplift = Math.max(0, potential - composite);
    const human = s => String(s).replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    const upliftRead = uplift > 0
      ? `Closing the <strong>${esc(top.length)}</strong> priority gaps below would lift the score from <strong>${esc(composite)}</strong> to <strong style="color:${bandColor('green')};">~${esc(potential)}</strong> (+${esc(uplift)}). `
      : '';
    // Play back the actual fixes that move the dashed line, tied to the radar.
    const fixesList = (uplift > 0 && top.length)
      ? `<div class="vss-fixes">
          <div class="vss-fixes-t">The fixes &mdash; close these to move the dashed line</div>
          <ul class="vss-fixes-l">${top.map(d => `<li><span class="vss-fix-dot" style="background:${bandColor(d.score === 0.5 ? 'yellow' : 'red')};"></span><strong>${esc(CAT_PROSE[d.catKey] || d.catLabel)}</strong> &mdash; ${esc(human(d.slug))}<span class="vss-fix-lift">+${d.lift === 0.5 ? '0.5' : '1.0'}</span></li>`).join('')}</ul>
        </div>`
      : '';
    profile = `<div class="vss-profile">
      <div class="vss-profile-radar">${renderRadar(ordered, esc, potMap)}
        <div class="vss-radar-legend"><span class="vss-leg now">Now ${esc(composite)}</span><span class="vss-leg pot">Potential ~${esc(potential)}</span></div>
      </div>
      <div class="vss-profile-body">
        <div class="vss-sb-title">Category profile &mdash; now vs. potential</div>
        <p class="vss-profile-read">${upliftRead}${shapeRead}</p>
        ${fixesList}
        <div class="vss-profile-split"><span style="color:${bandColor('green')};">${greens} strong</span> &middot; <span style="color:${bandColor('yellow')};">${yellows} mixed</span> &middot; <span style="color:${bandColor('red')};">${reds} ${reds === 1 ? 'gap' : 'gaps'}</span></div>
        <p class="vss-profile-how"><strong>Solid</strong> = where it scores now; <strong>dashed</strong> = where it could reach by closing the gaps listed above. Only the gaps we flag move &mdash; it's &ldquo;fix what we flagged&rdquo;, not &ldquo;fix everything&rdquo;.</p>
      </div>
    </div>`;
  }

  const dims = ordered.length ? `<div class="vss-dimensions">
      <div class="vss-dim-header">
        <div class="vss-dim-title">Category breakdown &mdash; 7 &times; 5 scorecard</div>
        <div class="vss-dim-toggles">
          <button type="button" class="vss-toggle" data-vss="expand">Expand all &#9662;</button>
        </div>
      </div>
      ${ordered.map(catRow).join('')}
    </div>` : '';

  // ── Deficiency Heatmap — the SAME `top` priority gaps the potential overlay closes
  //    (computed once, above). This is the detailed "fix this next" with evidence. ──
  const heatmap = `<div class="vss-heatmap">
      <div class="vss-heat-header"><div class="vss-heat-title">Fixes to reach your potential${top.length ? ` &middot; top ${top.length}` : ''}</div><div class="vss-heat-meta">Ranked by lift &times; weight</div></div>
      ${top.length ? `<div class="vss-heat-grid">${top.map(d => `
        <div class="vss-def" style="border-left-color:${bandColor(d.score === 0.5 ? 'yellow' : 'red')};">
          <div class="vss-def-head"><span class="vss-def-cat">${esc(d.catLabel)}</span><span class="vss-def-slug">${esc(String(d.slug).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}</span><span class="vss-def-lift" style="color:${bandColor(d.score === 0.5 ? 'yellow' : 'red')};background:${bandTint(d.score === 0.5 ? 'yellow' : 'red')};">+${d.lift === 0.5 ? '0.5' : '1.0'}</span></div>
          <div class="vss-def-q">${esc(d.q)}</div>
          ${d.note ? `<div class="vss-def-note">&ldquo;${esc(d.note)}&rdquo;</div>` : ''}
          ${d.ref ? `<span class="vss-ev" title="${esc(d.ref)}">${esc(d.ref)}</span>` : ''}
        </div>`).join('')}</div>`
      : `<div class="vss-heat-empty">No deficiencies &mdash; every rated sub-criterion is at 1.</div>`}
    </div>`;

  const meta = opts.metaText ? `<div class="vss-meta">${esc(opts.metaText)}</div>` : '';
  return `${hero}${scoreboard}${dims}${profile}${heatmap}${meta}`;
}

// ── 7-axis radar — current shape, with an optional dashed "potential" overlay.
//    `potential` is an optional { catKey: fraction } map (the achievable shape if the
//    flagged, addressable gaps close). Purely presentational — no pipeline dependency.
function renderRadar(ordered, esc, potential) {
  const cats = CAT_ORDER.map(k => ordered.find(c => c.key === k)).filter(Boolean);
  if (cats.length < 3) return '';
  const SIZE = 320, CX = SIZE / 2, CY = SIZE / 2, R = 116, LR = 146, N = cats.length;
  const step = (2 * Math.PI) / N, ang = i => -Math.PI / 2 + i * step;
  const ratioOf = c => { const rated = c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length; return rated > 0 ? c.sum / rated : 0; };
  const grid = [0.25, 0.5, 0.75, 1].map(lv => `<polygon class="vss-radar-grid" points="${cats.map((_, i) => `${CX + Math.cos(ang(i)) * R * lv},${CY + Math.sin(ang(i)) * R * lv}`).join(' ')}"/>`).join('');
  const axes = cats.map((_, i) => `<line class="vss-radar-grid" x1="${CX}" y1="${CY}" x2="${CX + Math.cos(ang(i)) * R}" y2="${CY + Math.sin(ang(i)) * R}"/>`).join('');
  // Potential overlay (dashed, drawn first so the solid "now" shape sits on top).
  let potPoly = '';
  if (potential) {
    const pPts = cats.map((c, i) => { const pv = potential[c.key] != null ? potential[c.key] : ratioOf(c); return `${CX + Math.cos(ang(i)) * R * pv},${CY + Math.sin(ang(i)) * R * pv}`; }).join(' ');
    potPoly = `<polygon class="vss-radar-potential" points="${pPts}"/>`;
  }
  const poly = cats.map((c, i) => `${CX + Math.cos(ang(i)) * R * ratioOf(c)},${CY + Math.sin(ang(i)) * R * ratioOf(c)}`).join(' ');
  const dots = cats.map((c, i) => { const r = ratioOf(c); return `<circle class="vss-radar-dot" cx="${CX + Math.cos(ang(i)) * R * r}" cy="${CY + Math.sin(ang(i)) * R * r}" r="2.6"/>`; }).join('');
  const labels = cats.map((c, i) => {
    const a = ang(i), x = CX + Math.cos(a) * LR, y = CY + Math.sin(a) * LR;
    let anc = 'middle'; if (Math.cos(a) > 0.3) anc = 'start'; else if (Math.cos(a) < -0.3) anc = 'end';
    const dy = Math.sin(a) > 0.3 ? 11 : Math.sin(a) < -0.3 ? -5 : 3;
    return `<text class="vss-radar-lbl" x="${x}" y="${y + dy}" text-anchor="${anc}">${esc(CAT_SHORT[c.key] || c.key)}</text>`;
  }).join('');
  // viewBox padded horizontally so the left/right axis labels (Market, Exec, Moat) never clip.
  const PAD = 52;
  return `<svg class="vss-radar" viewBox="${-PAD} 0 ${SIZE + 2 * PAD} ${SIZE}" role="img" aria-label="Investability radar">
      ${grid}${axes}
      ${potPoly}
      <polygon class="vss-radar-fill" points="${poly}"/><polygon class="vss-radar-stroke" points="${poly}"/>
      ${dots}${labels}
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
    .vss-hero { display:grid; grid-template-columns:minmax(150px,auto) 1fr; gap:1.8rem; align-items:center; padding:1.6rem 1.8rem; background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; margin-bottom:1.25rem; }
    .vss-hero-number { font-family:var(--vss-disp); font-size:clamp(3.6rem, 7vw, 6rem); font-weight:700; line-height:0.95; letter-spacing:-0.035em; white-space:nowrap; color:var(--vss-txt); }
    .vss-hero-suffix { font-size:0.32em; color:var(--vss-mut); font-weight:500; letter-spacing:-0.02em; }
    .vss-hero-body { display:flex; flex-direction:column; gap:0.45rem; min-width:0; }
    .vss-band-pill { align-self:flex-start; font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; padding:0.28rem 0.7rem; border-radius:999px; }
    .vss-band-label { font-size:0.92rem; color:var(--vss-txt); line-height:1.4; }
    .vss-hero-meta { font-family:var(--vss-mono); font-size:0.72rem; color:var(--vss-mut); letter-spacing:0.02em; }
    .vss-attribution { font-family:var(--vss-mono); font-size:0.68rem; color:var(--vss-mut); opacity:0.85; }
    .vss-sparkline svg { width:120px; height:36px; }
    @media (max-width:640px){ .vss-hero{ grid-template-columns:1fr; text-align:center; } .vss-band-pill{ align-self:center; } .vss-sparkline{ display:none; } }
    /* Score breakdown (scoreboard) — table of how the headline is built + the radar, always visible */
    .vss-scoreboard { display:block; background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; padding:1.4rem 1.6rem; margin-bottom:1.25rem; }
    .vss-sb-title { font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:var(--vss-mut); margin-bottom:0.5rem; }
    .vss-sb-explainer { font-size:0.86rem; color:var(--vss-txt); line-height:1.55; margin:0 0 1rem; }
    .vss-sb-table { width:100%; border-collapse:collapse; font-size:0.83rem; }
    .vss-sb-table th { font-family:var(--vss-mono); font-size:0.59rem; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:var(--vss-mut); text-align:right; padding:0.35rem 0.55rem; border-bottom:1px solid var(--vss-bd); white-space:nowrap; }
    .vss-sb-table th:first-child { text-align:left; }
    .vss-sb-table td { padding:0.5rem 0.55rem; border-bottom:1px solid var(--vss-bd); color:var(--vss-txt); text-align:right; }
    .vss-sb-table td:first-child { text-align:left; font-weight:550; }
    .vss-sb-num { font-family:var(--vss-mono); font-variant-numeric:tabular-nums; }
    .vss-sb-contribcell { position:relative; text-align:right; min-width:78px; }
    .vss-sb-bar { position:absolute; left:0; top:50%; transform:translateY(-50%); height:62%; border-radius:4px; z-index:0; }
    .vss-sb-contrib { position:relative; z-index:1; font-family:var(--vss-mono); font-weight:700; font-variant-numeric:tabular-nums; }
    .vss-sb-legend { margin-top:0.8rem; font-size:0.72rem; color:var(--vss-mut); line-height:1.55; }
    .vss-sb-legend b { font-weight:700; }
    /* Weighted score bar — segments sum to the headline; grey track = unearned to 100 */
    .vss-scorebar { display:flex; width:100%; height:32px; border-radius:9px; overflow:hidden; background:rgba(0,0,0,0.05); margin:0.5rem 0 0.7rem; }
    .vss-seg { display:flex; align-items:center; justify-content:center; min-width:0; transition:width .6s cubic-bezier(0.4,0,0.2,1); }
    .vss-seg-lbl { font-family:var(--vss-mono); font-size:0.58rem; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 5px; letter-spacing:0.02em; }
    .vss-seg-empty { background:transparent; }
    .vss-scorebar-cap { font-size:0.8rem; color:var(--vss-txt); line-height:1.5; }
    .vss-scorebar-track { color:var(--vss-mut); }
    /* Category profile card — radar (left, large) + reading + the fixes (right) */
    .vss-profile { display:grid; grid-template-columns:minmax(380px,440px) 1fr; gap:2rem; align-items:center; background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; padding:1.6rem 1.8rem; margin-bottom:1.25rem; }
    .vss-profile-radar { display:flex; flex-direction:column; align-items:center; gap:0.3rem; }
    .vss-profile-radar .vss-radar { width:100%; max-width:440px; }
    .vss-profile-body { min-width:0; }
    .vss-profile-read { font-size:0.95rem; color:var(--vss-txt); line-height:1.6; margin:0.45rem 0 0.85rem; }
    .vss-profile-split { font-family:var(--vss-mono); font-size:0.72rem; font-weight:700; letter-spacing:0.04em; margin:0.9rem 0; }
    .vss-profile-how { font-size:0.8rem; color:var(--vss-mut); line-height:1.55; margin:0; }
    /* The fixes — playback of the gaps that move the dashed potential line */
    .vss-fixes { margin:0.2rem 0 0.2rem; }
    .vss-fixes-t { font-family:var(--vss-mono); font-size:0.62rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--vss-mut); margin-bottom:0.5rem; }
    .vss-fixes-l { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0.45rem; }
    .vss-fixes-l li { display:flex; align-items:center; gap:0.55rem; font-size:0.86rem; color:var(--vss-txt); line-height:1.35; }
    .vss-fix-dot { width:8px; height:8px; border-radius:50%; flex:none; }
    .vss-fix-lift { margin-left:auto; font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; color:var(--vss-mut); padding-left:0.6rem; }
    @media (max-width:760px){ .vss-profile{ grid-template-columns:1fr; gap:1rem; padding:1.3rem 1.4rem; } .vss-profile-radar .vss-radar{ max-width:360px; } }
    .vss-sb-table tfoot td { border-bottom:none; border-top:2px solid var(--vss-bd); padding-top:0.7rem; }
    .vss-sb-table tfoot td:first-child { font-family:var(--vss-disp); font-weight:700; letter-spacing:-0.01em; }
    .vss-sb-total { font-family:var(--vss-disp); font-weight:700; font-size:1rem; }
    .vss-sb-radar { display:flex; flex-direction:column; align-items:center; gap:0.4rem; padding-top:0.3rem; }
    .vss-sb-radar .vss-radar { width:280px; max-width:100%; }
    .vss-sb-radar-cap { font-family:var(--vss-mono); font-size:0.59rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--vss-mut); }
    @media (max-width:760px){ .vss-scoreboard{ grid-template-columns:1fr; } .vss-sb-table{ font-size:0.8rem; } }
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
    .vss-cat-weight { font-family:var(--vss-mono); font-size:0.58rem; font-weight:700; color:var(--vss-mut); background:rgba(0,0,0,0.05); padding:0.1rem 0.4rem; border-radius:999px; margin-left:0.45rem; vertical-align:middle; white-space:nowrap; }
    .vss-cat-contrib { font-family:var(--vss-disp); font-size:1.2rem; font-weight:700; text-align:right; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }
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
    .vss-radar-grid { stroke:rgba(0,0,0,0.12); stroke-width:1; fill:none; }
    .vss-radar-fill { fill:var(--primary,#6E3AFA); fill-opacity:0.08; }
    .vss-radar-stroke { stroke:var(--primary,#6E3AFA); stroke-width:1.5; fill:none; }
    .vss-radar-dot { fill:var(--primary,#6E3AFA); }
    .vss-radar-potential { fill:var(--band-strong,#00A368); fill-opacity:0.06; stroke:var(--band-strong,#00A368); stroke-width:1.5; stroke-dasharray:4 3; }
    .vss-radar-lbl { font-family:var(--vss-mono); font-size:0.62rem; fill:var(--vss-txt); }
    .vss-radar-legend { display:flex; gap:1.1rem; justify-content:center; margin-top:0.3rem; font-family:var(--vss-mono); font-size:0.62rem; color:var(--vss-mut); }
    .vss-leg { display:inline-flex; align-items:center; gap:0.4rem; }
    .vss-leg::before { content:''; width:16px; border-top:2px solid var(--primary,#6E3AFA); }
    .vss-leg.pot::before { border-top:2px dashed var(--band-strong,#00A368); }
    /* Heatmap */
    .vss-heatmap { background:var(--vss-surf); border:1px solid var(--vss-bd); border-radius:16px; padding:1.3rem 1.5rem; }
    .vss-heat-header { display:flex; justify-content:space-between; align-items:baseline; gap:1rem; flex-wrap:wrap; margin-bottom:0.9rem; }
    .vss-heat-title { font-family:var(--vss-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:var(--vss-mut); }
    .vss-heat-meta { font-family:var(--vss-mono); font-size:0.66rem; color:var(--vss-mut); }
    .vss-heat-grid { display:flex; flex-direction:column; gap:0.7rem; }
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
