// ============================================================
// Ventrify OS — Investability (VSS 7×5) scorecard, shared by both surfaces.
//
// Replaces the scorecard that was built 3 separate times (Workspace program,
// Studio investability, Studio dashboard) with ~42 hardcoded band-colour
// literals. One renderer, one colour map, one stylesheet — so the score looks
// identical everywhere and a band-colour change is a one-line edit.
//
// Consumes the canonical published snapshot shape:
//   { composite, maxPossible, pct, band, bandLabel, ratedCount,
//     categories: [{ label, sum, max, band }] }
// ============================================================

const _esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// band ('green'|'yellow'|'red') OR composite band ('approved'|'feedback'|'pass')
// → a DS band token. Kills the duplicated bandColor/compColor + the 42 literals.
export function bandColor(band) {
  const b = String(band || '').toLowerCase();
  if (b === 'green' || b === 'approved' || b === 'strong') return 'var(--band-strong, #00A368)';
  if (b === 'red' || b === 'pass' || b === 'weak') return 'var(--band-weak, #C42233)';
  return 'var(--band-mid, #C77700)'; // yellow / feedback / mid
}

// Render the scorecard inner (headline + category bars + optional meta line).
// The caller supplies the surrounding card/section. opts:
//   variant: 'operator' (compact 2-col, default) | 'studio' (single column)
//   metaText: a small uppercase line under the grid (e.g. "Auto-scored · 35 of 35 rated")
//   esc: the host's escape fn (falls back to a built-in)
export function renderVSSScorecard(snap, opts = {}) {
  if (!snap) return '';
  const esc = opts.esc || _esc;
  const cc = bandColor(snap.band);
  const max = snap.maxPossible || 35;
  const cats = (snap.categories || []).map(c => {
    const cmax = c.max || 5;
    const pct = Math.max(0, Math.min(100, (c.sum / cmax) * 100));
    return `<div class="vss-cat">
        <div class="vss-cat-head"><span>${esc(c.label)}</span><span class="vss-cat-val">${c.sum}/${cmax}</span></div>
        <div class="vss-bar"><div class="vss-bar-fill" style="width:${pct}%;background:${bandColor(c.band)};"></div></div>
      </div>`;
  }).join('');
  const meta = opts.metaText ? `<div class="vss-meta">${esc(opts.metaText)}</div>` : '';
  return `<div class="vss-headline">
      <div><span class="vss-score" style="color:${cc};">${esc(snap.composite)}</span><span class="vss-score-of"> / ${esc(max)}</span></div>
      <div class="vss-band" style="color:${cc};">${esc(snap.pct)}% &middot; ${esc(snap.bandLabel || snap.band)}</div>
    </div>
    <div class="vss-grid vss-${opts.variant || 'operator'}">${cats}</div>
    ${meta}`;
}

// The "how to strengthen this venture" list (was duplicated across both surfaces).
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
  if (typeof document === 'undefined' || document.getElementById('vss-styles')) return;
  const s = document.createElement('style'); s.id = 'vss-styles';
  s.textContent = `
    .vss-headline { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; margin-bottom:1.2rem; flex-wrap:wrap; }
    .vss-score { font-family:var(--font-heading); font-weight:600; font-size:2.3rem; letter-spacing:-0.02em; line-height:1; }
    .vss-score-of { font-family:var(--font-mono); color:var(--text-subtle); font-size:0.9rem; }
    .vss-band { font-family:var(--font-mono); text-transform:uppercase; font-size:0.72rem; letter-spacing:0.06em; font-weight:600; }
    .vss-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:0.9rem 1.6rem; }
    .vss-grid.vss-studio { grid-template-columns:1fr; }
    .vss-cat-head { display:flex; justify-content:space-between; gap:0.5rem; font-size:0.82rem; color:var(--text); margin-bottom:0.32rem; }
    .vss-cat-val { font-family:var(--font-mono); color:var(--text-subtle); }
    .vss-bar { height:6px; background:rgba(0,0,0,0.06); border-radius:3px; overflow:hidden; }
    .vss-bar-fill { height:100%; border-radius:3px; transition:width var(--dur-slow,.6s) var(--ease-out, ease); }
    .vss-meta { font-family:var(--font-mono); color:var(--text-subtle); font-size:0.66rem; letter-spacing:0.06em; text-transform:uppercase; margin-top:0.95rem; }
    .vss-sugg { margin-top:1rem; border-top:1px solid var(--border, rgba(0,0,0,0.07)); padding-top:0.9rem; }
    .vss-sugg-title { font-family:var(--font-mono); font-size:0.62rem; letter-spacing:0.07em; text-transform:uppercase; font-weight:700; color:var(--accent,#00B8A0); margin-bottom:0.6rem; }
    .vss-sugg-list { display:flex; flex-direction:column; gap:0.55rem; }
    .vss-sugg-item { display:flex; gap:0.55rem; align-items:flex-start; font-size:0.88rem; line-height:1.5; }
    .vss-sugg-arrow { color:var(--accent,#00B8A0); font-weight:700; flex:none; }
    @media (max-width:640px) { .vss-grid { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(s);
}
