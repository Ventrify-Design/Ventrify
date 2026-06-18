// ============================================================
// Ventrify OS — Deep Research / Data Room renderer (shared by both surfaces).
//
// Renders engagements/{id}/hubDocs as an investor's table of contents: every doc
// is classified AT RENDER TIME to a canonical title + investor group (so titles are
// consistent across every assessment regardless of how the agent named the file),
// shown as a metadata-rich card with a key finding, and opened into a focused
// full-screen reading view. See tools/cloud/ASSESSMENT-CONTRACT.md → Deep Research.
//
// The index parses NO markdown; only the reading view lazy-loads `marked`.
// ============================================================

import { esc } from './util.js';

// ── Investor groups (fixed order — the questions a partner reads a deal by) ──
const GROUPS = [
  { key: 'verdict',     label: 'The verdict' },
  { key: 'market',      label: 'The market' },
  { key: 'competition', label: 'The competition' },
  { key: 'team',        label: 'The team' },
  { key: 'money',       label: 'The money' }
];
const GROUP_INDEX = Object.fromEntries(GROUPS.map((g, i) => [g.key, i]));
const HUB_LABELS = { vision: 'Vision', strategy: 'Strategy', financials: 'Financials', marketing: 'Marketing', research: 'Research', assessment: 'Assessment' };

// ── Glyphs (20×20, currentColor line icons) ──────────────────────────────────
const G = inner => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const GLYPH = {
  shield: G('<path d="M10 2.5l5.5 1.8V9c0 3.6-2.7 5.9-5.5 6.9C7.2 14.9 4.5 12.6 4.5 9V4.3z"/><path d="M7.6 9.3l1.6 1.6 2.9-3.2"/>'),
  stamp:  G('<path d="M6 2.5h5l3.5 3.5V17a.5.5 0 01-.5.5H6A.5.5 0 015.5 17V3A.5.5 0 016 2.5z"/><path d="M11 2.5V6h3.5"/><path d="M7.6 11.4l1.5 1.5 3-3.2"/>'),
  scale:  G('<path d="M10 3.2v12.6"/><path d="M5 6h10"/><path d="M5 6l-2.2 4.4a2.2 2.2 0 004.4 0z"/><path d="M15 6l-2.2 4.4a2.2 2.2 0 004.4 0z"/><path d="M6.6 16.2h6.8"/>'),
  globe:  G('<circle cx="10" cy="10" r="7"/><path d="M3 10h14"/><path d="M10 3c2 2.3 2 11.7 0 14M10 3c-2 2.3-2 11.7 0 14"/>'),
  expand: G('<path d="M4 8V4h4"/><path d="M16 8V4h-4"/><path d="M4 12v4h4"/><path d="M16 12v4h-4"/>'),
  trend:  G('<path d="M3 14l4-4 3 3 6.5-7"/><path d="M13.5 6h3.5v3.5"/>'),
  bars:   G('<path d="M3 16.5h14"/><path d="M5.5 16.5V10"/><path d="M10 16.5V5"/><path d="M14.5 16.5v-4"/>'),
  target: G('<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3.4"/><circle cx="10" cy="10" r="0.4"/>'),
  people: G('<circle cx="7.6" cy="7.6" r="2.5"/><path d="M3.4 16c0-2.3 1.9-4 4.2-4s4.2 1.7 4.2 4"/><path d="M13 6.3a2.4 2.4 0 010 4.5"/><path d="M14.2 12.2c1.5.5 2.5 1.9 2.5 3.8"/>'),
  calc:   G('<rect x="5" y="2.8" width="10" height="14.4" rx="1.6"/><path d="M7.4 6.4h5.2"/><path d="M7.6 10h.01M10 10h.01M12.4 10h.01M7.6 13h.01M10 13h.01M12.4 13h.01"/>'),
  coins:  G('<ellipse cx="8.2" cy="6.4" rx="4.4" ry="2"/><path d="M3.8 6.4v3.8c0 1.1 2 2 4.4 2"/><path d="M7.4 12.1c.6 1 2.4 1.7 4.6 1.7 2.4 0 4.4-.9 4.4-2v-3.7"/><path d="M7.6 8.2c.5.9 2.4 1.6 4.6 1.6 2.2 0 4-.7 4.4-1.6"/>'),
  doc:    G('<path d="M6 2.5h5l3.5 3.5V17a.5.5 0 01-.5.5H6A.5.5 0 015.5 17V3A.5.5 0 016 2.5z"/><path d="M11 2.5V6h3.5"/><path d="M7.6 10h4.8M7.6 13h3"/>')
};

// ── Canonical taxonomy — first keyword hit wins (order matters) ──────────────
const CANON = [
  { test: t => /claim/.test(t) && /(pressure|validat)/.test(t), title: 'Claims Pressure Test', group: 'verdict', glyph: 'shield', desc: 'Every founder claim independently verified, flagged, or refuted.' },
  { test: t => /deal memo|investment committee/.test(t),        title: 'Deal Memo',            group: 'verdict', glyph: 'stamp',  desc: 'The investment recommendation, terms, and the headline call.' },
  { test: t => /investment analysis/.test(t),                   title: 'Investment Analysis',  group: 'verdict', glyph: 'scale',  desc: 'The full thesis — upside, downside, and the path to a return.' },
  { test: t => /market sizing/.test(t),                         title: 'Market Sizing',        group: 'market',  glyph: 'expand', desc: 'TAM / SAM / SOM, built bottom-up and sanity-checked.' },
  { test: t => /demand|traction/.test(t),                       title: 'Demand & Traction',    group: 'market',  glyph: 'trend',  desc: 'Evidence of real pull — pipeline, customers, signals.' },
  { test: t => /market/.test(t),                                title: 'Market Analysis',      group: 'market',  glyph: 'globe',  desc: 'The opportunity, the dynamics, and where this venture sits.' },
  { test: t => /benchmark/.test(t),                             title: 'Competitive Benchmark', group: 'competition', glyph: 'bars', desc: 'Head-to-head scoring against the field on the metrics that matter.' },
  { test: t => /competitor|competitive/.test(t),                title: 'Competitor Analysis',  group: 'competition', glyph: 'target', desc: 'Who else is in the race, and how they’re positioned.' },
  { test: t => /team|diligence/.test(t),                        title: 'Team Diligence',       group: 'team',    glyph: 'people', desc: 'Track record, gaps, and references on the founding team.' },
  { test: t => /unit economics/.test(t),                        title: 'Unit Economics',       group: 'money',   glyph: 'calc',   desc: 'Cost-to-serve, margins, and the model’s underlying math.' },
  { test: t => /comparable|funding round/.test(t),              title: 'Comparable Funding Rounds', group: 'money', glyph: 'coins', desc: 'What similar companies raised, at what valuations, and when.' }
];

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Classify a raw hubDoc → canonical entry (never drops or mis-renders an unknown doc).
function classify(doc) {
  const raw = String(doc.title || doc.name || '');
  const t = raw.toLowerCase();
  const hit = CANON.find(c => c.test(t));
  if (hit) return { title: hit.title, group: hit.group, glyph: hit.glyph, desc: hit.desc };
  // Fallback: strip the venture suffix, title-case, group by the doc's own hub.
  const clean = raw.replace(/\s+[—–]\s+.*$/, '').replace(/\b(inc|llc|ltd|corp)\b\.?/gi, '').trim() || raw;
  const title = /[a-z]/.test(clean) ? clean : clean.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase());
  return { title, group: doc.hub || 'further', glyph: 'doc', desc: '' };
}

// Pull a clean one-sentence "key finding" from the body (skip headers, md, agent meta).
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
const sourceCount = b => (String(b || '').match(/\bhttps?:\/\//g) || []).length;
const sectionCount = b => (String(b || '').match(/^#{2,3}\s+/gm) || []).length;
const readTime = w => w >= 600 ? `${Math.ceil(w / 220)} min read` : `${w} words`;
const kfmt = n => n >= 1000 ? (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);

let _index = [];   // the classified, ordered docs for the live page (used by the reader)

export function renderDataRoom(hubDocs, opts) {
  opts = opts || {};
  if (!hubDocs || !hubDocs.length) return '';

  // Classify + enrich every doc, then order: the five investor groups first, any
  // hub-based groups next, "further" last; within a group, keep CANON order.
  const docs = hubDocs.map((d, i) => {
    const c = classify(d);
    const body = d.body || d.markdown || '';
    return { ...c, raw: d, body, slug: slugify(c.title) || ('doc-' + i),
      words: wordCount(body), sources: sourceCount(body), sections: sectionCount(body), finding: keyFinding(body) };
  });
  const slugs = new Set();
  docs.forEach(d => { let s = d.slug, n = 2; while (slugs.has(s)) s = d.slug + '-' + n++; d.slug = s; slugs.add(s); });

  const groupRank = g => (g in GROUP_INDEX) ? GROUP_INDEX[g] : (g === 'further' ? 99 : 50);
  const usedGroups = [];
  docs.forEach(d => { if (!usedGroups.includes(d.group)) usedGroups.push(d.group); });
  usedGroups.sort((a, b) => groupRank(a) - groupRank(b));
  _index = usedGroups.flatMap(g => docs.filter(d => d.group === g));

  // Provenance summary
  const totW = docs.reduce((a, d) => a + d.words, 0);
  const totS = docs.reduce((a, d) => a + d.sources, 0);
  const stat = (n, l) => `<div class="dr-stat"><div class="dr-stat-n">${n}</div><div class="dr-stat-l">${l}</div></div>`;
  const provenance = `<div class="dr-provenance">
    ${stat(docs.length, 'documents')}<span class="dr-prov-dot">·</span>
    ${stat(kfmt(totW), 'words of analysis')}
    ${totS ? `<span class="dr-prov-dot">·</span>${stat(totS, 'sources cited')}` : ''}
    <span class="pill-accent dr-prov-pill">Web-researched</span>
  </div>`;

  const groupLabel = g => GROUPS.find(x => x.key === g)?.label || HUB_LABELS[g] || (g === 'further' ? 'Further analysis' : g);
  const groupsHTML = usedGroups.map(g => {
    const cards = docs.filter(d => d.group === g).map(d => {
      const meta = [readTime(d.words),
        d.sources ? `<span class="pill-accent dr-src">${d.sources} sources</span>` : '',
        d.sections ? `${d.sections} sections` : ''].filter(Boolean);
      return `<button class="dr-card card-interactive" data-slug="${d.slug}" aria-label="Read ${esc(d.title)}">
        <span class="dr-card-glyph">${GLYPH[d.glyph] || GLYPH.doc}</span>
        <span class="dr-card-title">${esc(d.title)}</span>
        ${d.desc ? `<span class="dr-card-desc">${esc(d.desc)}</span>` : ''}
        ${d.finding ? `<span class="dr-card-finding">${esc(d.finding)}</span>` : ''}
        <span class="dr-card-meta">${meta.map((m, k) => (k ? '<span class="cardf-dot">·</span>' : '') + `<span>${m}</span>`).join('')}<span class="dr-card-read">Read &rarr;</span></span>
      </button>`;
    }).join('');
    return `<div class="dr-group"><div class="dr-group-label">${esc(groupLabel(g))}</div><div class="dr-grid">${cards}</div></div>`;
  }).join('');

  return `<div class="section dr-shell" id="dr-shell">
    <div class="dr-eyebrow">${esc(opts.eyebrow || 'Deep research')}</div>
    <div class="section-title">${esc(opts.title || 'The data room')}</div>
    <div class="section-sub">${esc(opts.sub || 'Every claim, independently researched and pressure-tested — drill into any document.')}</div>
    ${provenance}
    ${groupsHTML}
  </div>`;
}

// ── Reading view ─────────────────────────────────────────────────────────────
// Research/analysis prose uses `~` as "approximately" (~43.5%, ~$450k, ~7.6 months).
// marked's GFM strikethrough reads a single `~text~` as crossed-out and strikes the whole
// span between two such tildes — so the analyst's "approximately" markers silently struck
// out big chunks of text. Escape lone tildes to literal `~` (outside code spans), while
// preserving any intentional `~~strikethrough~~`. Verified against marked@12.
function escapeApproxTildes(md) {
  return String(md).split(/(```[\s\S]*?```|`[^`]*`)/g).map((seg, i) =>
    i % 2 === 1 ? seg // code span/fence — leave tildes untouched
      // A lone ~ = "approximately" → escape to literal; a ~~ run = intentional strikethrough → keep.
      : seg.replace(/~+/g, run => run.length === 1 ? '\\~' : run)
  ).join('');
}

let _marked = null;
async function toHtml(mdStr) {
  if (_marked === null) {
    try { const m = await import('https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js'); _marked = m.marked || m.default || false; }
    catch (e) { _marked = false; }
  }
  const md = escapeApproxTildes(mdStr);
  if (_marked) { try { return (_marked.parse ? _marked.parse(md) : _marked(md)); } catch (e) { /* fall through */ } }
  return '<pre style="white-space:pre-wrap;">' + esc(mdStr) + '</pre>';
}

let _reader = null, _hashLock = false;
function ensureReader() {
  if (_reader) return _reader;
  _reader = document.createElement('div');
  _reader.className = 'dr-reader'; _reader.hidden = true;
  document.body.appendChild(_reader);
  return _reader;
}

async function openDoc(slug) {
  const idx = _index.findIndex(d => d.slug === slug);
  if (idx < 0) return;
  const d = _index[idx], prev = _index[idx - 1], next = _index[idx + 1];
  const r = ensureReader();
  const metaBits = [readTime(d.words), d.sources ? `${d.sources} sources` : '', d.sections ? `${d.sections} sections` : ''].filter(Boolean).join(' · ');
  r.innerHTML = `
    <div class="dr-read-bar">
      <button class="dr-read-back" data-close>&larr; Back to data room</button>
      <div class="dr-read-bar-title">${esc(d.title)}</div>
      <div class="dr-read-bar-meta">${esc(metaBits)}</div>
    </div>
    <div class="dr-read-wrap">
      <article class="dr-read-body"><div class="skeleton" style="height:1.2rem;width:60%;margin:.6rem 0;"></div><div class="skeleton" style="height:.9rem;width:100%;margin:.5rem 0;"></div><div class="skeleton" style="height:.9rem;width:92%;margin:.5rem 0;"></div></article>
      <aside class="dr-read-toc"><div class="dr-toc-label">On this page</div><nav class="dr-toc-nav"></nav></aside>
    </div>
    <div class="dr-read-pager">
      ${prev ? `<button class="dr-pager-btn" data-go="${prev.slug}">&larr; ${esc(prev.title)}</button>` : '<span></span>'}
      ${next ? `<button class="dr-pager-btn dr-pager-next" data-go="${next.slug}">${esc(next.title)} &rarr;</button>` : '<span></span>'}
    </div>`;
  r.hidden = false;
  document.body.classList.add('dr-reading');
  r.scrollTop = 0;
  if (!_hashLock) { _hashLock = true; location.hash = 'research/' + slug; _hashLock = false; }

  // Lazy-render the body, then build the contents list from its headings.
  const bodyEl = r.querySelector('.dr-read-body');
  bodyEl.innerHTML = await toHtml(d.body);
  const heads = [...bodyEl.querySelectorAll('h1, h2, h3')];
  const toc = r.querySelector('.dr-toc-nav');
  const items = heads.filter(h => h.tagName !== 'H1').map((h, i) => {
    const id = 'h-' + i; h.id = id;
    return `<a href="#${id}" class="dr-toc-item dr-toc-${h.tagName.toLowerCase()}" data-h="${id}">${esc(h.textContent)}</a>`;
  });
  if (items.length >= 2) toc.innerHTML = items.join(''); else r.querySelector('.dr-read-toc').style.display = 'none';
}

function closeReader() {
  if (!_reader || _reader.hidden) return;
  _reader.hidden = true;
  document.body.classList.remove('dr-reading');
  if (!_hashLock && /^#research\//.test(location.hash)) { _hashLock = true; history.replaceState(null, '', location.pathname + location.search); _hashLock = false; }
}

// Wire the index + reading view. Call after inserting the HTML.
export function hydrateDataRoom(root) {
  (root || document).querySelectorAll('.dr-card').forEach(card => {
    card.addEventListener('click', () => openDoc(card.getAttribute('data-slug')));
  });
  const r = ensureReader();
  r.addEventListener('click', e => {
    const close = e.target.closest('[data-close]'); if (close) { closeReader(); return; }
    const go = e.target.closest('[data-go]'); if (go) { openDoc(go.getAttribute('data-go')); return; }
    const toc = e.target.closest('.dr-toc-item');
    if (toc) { e.preventDefault(); const el = r.querySelector('#' + toc.getAttribute('data-h')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  if (!hydrateDataRoom._hash) {
    hydrateDataRoom._hash = true;
    window.addEventListener('hashchange', () => {
      if (_hashLock) return;
      const m = location.hash.match(/^#research\/(.+)$/);
      if (m) openDoc(decodeURIComponent(m[1])); else closeReader();
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeReader(); });
  }
  const m = location.hash.match(/^#research\/(.+)$/);
  if (m && _index.some(d => d.slug === decodeURIComponent(m[1]))) openDoc(decodeURIComponent(m[1]));
}

export function ensureHubStyles() {
  if (typeof document === 'undefined' || document.getElementById('dr-styles')) return;
  const s = document.createElement('style'); s.id = 'dr-styles';
  s.textContent = `
    .dr-eyebrow { font-weight:700; font-size:0.66rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent,#00B8A0); margin-bottom:0.4rem; }
    .dr-provenance { display:flex; align-items:center; gap:1.1rem; flex-wrap:wrap; background:var(--surface,#F0F4F8); border-radius:14px; padding:1rem 1.4rem; margin:1.1rem 0 1.6rem; box-shadow:inset 2px 2px 5px rgba(0,0,0,0.04), inset -2px -2px 5px rgba(255,255,255,0.7); }
    .dr-stat-n { font-family:'Space Grotesk',sans-serif; font-size:1.4rem; font-weight:600; color:var(--text,#1A1A2E); line-height:1; }
    .dr-stat-l { font-size:0.72rem; color:var(--muted,#6B7594); margin-top:0.25rem; }
    .dr-prov-dot { color:rgba(0,0,0,0.18); }
    .dr-prov-pill { margin-left:auto; }
    .dr-group { margin-bottom:1.9rem; }
    .dr-group-label { font-weight:700; font-size:0.68rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent,#00B8A0); margin-bottom:0.75rem; }
    .dr-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:0.9rem; }
    .dr-card { display:flex; flex-direction:column; align-items:flex-start; gap:0.35rem; text-align:left; width:100%; cursor:pointer;
      background:var(--surface-2,#fff); border:1px solid var(--border,rgba(0,0,0,0.06)); border-radius:16px; padding:1.15rem 1.2rem; font:inherit; color:inherit; }
    .dr-card-glyph { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; color:var(--accent,#00B8A0);
      background:rgba(0,184,160,0.1); margin-bottom:0.4rem; }
    .dr-card-glyph svg { width:19px; height:19px; }
    .dr-card-title { font-weight:600; font-size:1rem; color:var(--text,#1A1A2E); letter-spacing:-0.01em; }
    .dr-card-desc { font-size:0.82rem; color:var(--muted,#6B7594); line-height:1.4; }
    .dr-card-finding { font-size:0.84rem; color:var(--text,#1A1A2E); line-height:1.45; margin-top:0.25rem;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .dr-card-meta { display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.7rem; padding-top:0.65rem; border-top:1px solid rgba(0,0,0,0.06);
      width:100%; font-size:0.72rem; color:var(--muted,#6B7594); font-family:'JetBrains Mono','SFMono-Regular',monospace; }
    .dr-card-meta .cardf-dot { opacity:0.4; }
    .dr-src { font-family:inherit; }
    .dr-card-read { margin-left:auto; color:var(--primary,#0036FF); font-weight:600; font-family:'Inter',sans-serif; }
    @media (max-width:640px){ .dr-grid { grid-template-columns:1fr; } .dr-provenance { gap:0.6rem 1rem; } .dr-prov-pill { margin-left:0; } }

    /* Reading view */
    body.dr-reading { overflow:hidden; }
    .dr-reader { position:fixed; inset:0; z-index:2000; background:var(--bg,#E8ECF1); overflow-y:auto; display:flex; flex-direction:column; }
    .dr-reader[hidden] { display:none; }
    .dr-read-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:1rem; padding:0.85rem 1.4rem;
      background:rgba(240,244,248,0.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--border,rgba(0,0,0,0.07)); }
    .dr-read-back { cursor:pointer; border:none; background:none; font:inherit; font-weight:600; font-size:0.9rem; color:var(--primary,#0036FF); flex:none; }
    .dr-read-bar-title { font-weight:600; color:var(--text,#1A1A2E); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dr-read-bar-meta { margin-left:auto; font-size:0.74rem; color:var(--muted,#6B7594); font-family:'JetBrains Mono',monospace; white-space:nowrap; flex:none; }
    .dr-read-wrap { display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:2.5rem; max-width:1040px; width:100%; margin:0 auto; padding:2rem 1.6rem 1rem; }
    .dr-read-body { max-width:68ch; font-size:0.95rem; line-height:1.7; color:var(--text,#1A1A2E); }
    .dr-read-body h1 { font-family:'Space Grotesk',sans-serif; font-size:1.6rem; line-height:1.25; margin:0 0 1rem; }
    .dr-read-body h2 { font-family:'Space Grotesk',sans-serif; font-size:1.2rem; margin:1.8rem 0 0.6rem; padding-top:0.4rem; }
    .dr-read-body h3 { font-size:1.02rem; font-weight:600; margin:1.3rem 0 0.4rem; }
    .dr-read-body p { margin:0.7rem 0; } .dr-read-body ul,.dr-read-body ol { margin:0.7rem 0; padding-left:1.3rem; } .dr-read-body li { margin:0.3rem 0; }
    .dr-read-body table { border-collapse:collapse; width:100%; margin:1rem 0; font-size:0.84rem; display:block; overflow-x:auto; }
    .dr-read-body th,.dr-read-body td { border:1px solid rgba(0,0,0,0.1); padding:0.45rem 0.65rem; text-align:left; }
    .dr-read-body th { background:rgba(0,0,0,0.03); }
    .dr-read-body code { font-family:'JetBrains Mono',monospace; font-size:0.85em; background:rgba(0,0,0,0.05); padding:0.05em 0.35em; border-radius:4px; }
    .dr-read-body a { color:var(--primary,#0036FF); }
    .dr-read-body hr { border:none; border-top:1px solid var(--border,rgba(0,0,0,0.08)); margin:1.6rem 0; }
    .dr-read-toc { position:sticky; top:5rem; align-self:start; max-height:calc(100vh - 7rem); overflow-y:auto; }
    .dr-toc-label { font-weight:700; font-size:0.62rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent,#00B8A0); margin-bottom:0.6rem; }
    .dr-toc-nav { display:flex; flex-direction:column; gap:0.1rem; border-left:2px solid var(--border,rgba(0,0,0,0.08)); }
    .dr-toc-item { font-size:0.8rem; color:var(--muted,#6B7594); text-decoration:none; padding:0.28rem 0 0.28rem 0.8rem; margin-left:-2px; border-left:2px solid transparent; line-height:1.35; }
    .dr-toc-item:hover { color:var(--primary,#0036FF); border-left-color:var(--primary,#0036FF); }
    .dr-toc-h3 { padding-left:1.5rem; font-size:0.76rem; }
    .dr-read-pager { display:flex; justify-content:space-between; gap:1rem; max-width:1040px; width:100%; margin:0 auto; padding:1rem 1.6rem 3rem; }
    .dr-pager-btn { cursor:pointer; border:1px solid var(--border,rgba(0,0,0,0.08)); background:var(--surface-2,#fff); border-radius:10px;
      padding:0.6rem 1rem; font:inherit; font-size:0.85rem; font-weight:600; color:var(--text,#1A1A2E); max-width:46%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .dr-pager-next { margin-left:auto; }
    @media (max-width:900px){ .dr-read-wrap { grid-template-columns:1fr; gap:1rem; } .dr-read-toc { display:none; } }
  `;
  document.head.appendChild(s);
}
