// ============================================================
// Ventrify OS — Data Room (L3 hub content) renderer, shared by both surfaces.
//
// Renders engagements/{id}/hubDocs (deep research, vision, strategy, financials)
// as collapsible documents, grouped by hub. Each doc's markdown body is rendered
// to HTML with `marked` (lazy-loaded from CDN) the first time it's expanded — so
// large L3 docs don't all parse up front.
// ============================================================

const HUB_LABELS = { assessment: 'Assessment', research: 'Research', vision: 'Vision', strategy: 'Strategy', financials: 'Financials', marketing: 'Marketing' };
const HUB_ORDER = ['assessment', 'research', 'vision', 'strategy', 'financials', 'marketing'];

import { esc } from './util.js';

let _marked = null;
async function toHtml(mdStr) {
  if (_marked === null) {
    try { const m = await import('https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js'); _marked = m.marked || m.default || false; }
    catch (e) { _marked = false; }
  }
  if (_marked) {
    try { return (_marked.parse ? _marked.parse(mdStr) : _marked(mdStr)); } catch (e) { /* fall through */ }
  }
  return '<pre style="white-space:pre-wrap;">' + esc(mdStr) + '</pre>';
}

export function renderDataRoom(hubDocs, opts) {
  opts = opts || {};
  if (!hubDocs || !hubDocs.length) return '';
  const byHub = {};
  hubDocs.forEach(d => { (byHub[d.hub] = byHub[d.hub] || []).push(d); });
  const hubs = HUB_ORDER.filter(h => byHub[h]).concat(Object.keys(byHub).filter(h => !HUB_ORDER.includes(h)));
  const groups = hubs.map(h => `
    <div class="dr-hub">
      <div class="dr-hub-title">${esc(HUB_LABELS[h] || h)}</div>
      ${byHub[h].map(d => `
        <details class="dr-doc">
          <summary class="dr-doc-summary">${esc(d.title || d.name)}</summary>
          <div class="dr-doc-body" data-md="${encodeURIComponent(d.body || '')}"><span class="dr-loading">Loading…</span></div>
        </details>`).join('')}
    </div>`).join('');
  return `<div class="section dr-shell">
    <div class="section-head"><div><div class="section-title">${esc(opts.title || 'Data room')}</div><div class="section-sub">${esc(opts.sub || 'Deep research, strategy and financials — the L3 detail behind the cards.')}</div></div></div>
    ${groups}
  </div>`;
}

// Attach lazy markdown rendering on first expand. Call after inserting the HTML.
export function hydrateDataRoom(root) {
  (root || document).querySelectorAll('.dr-doc').forEach(det => {
    det.addEventListener('toggle', async () => {
      if (!det.open) return;
      const body = det.querySelector('.dr-doc-body');
      if (!body || body.dataset.rendered) return;
      body.dataset.rendered = '1';
      body.innerHTML = await toHtml(decodeURIComponent(body.getAttribute('data-md') || ''));
    });
  });
}

export function ensureHubStyles() {
  if (typeof document === 'undefined' || document.getElementById('dr-styles')) return;
  const s = document.createElement('style'); s.id = 'dr-styles';
  s.textContent = `
    .dr-hub { margin-bottom:1.1rem; }
    .dr-hub-title { font-weight:700; font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent,#00B8A0); margin-bottom:0.5rem; }
    .dr-doc { background:var(--surface-2,#fff); border:1px solid rgba(0,0,0,0.07); border-radius:12px; margin-bottom:0.5rem; overflow:hidden; }
    .dr-doc-summary { cursor:pointer; padding:0.85rem 1.1rem; font-weight:600; font-size:0.95rem; list-style:none; }
    .dr-doc-summary::-webkit-details-marker { display:none; }
    .dr-doc-summary:before { content:'\\25B8'; color:var(--muted,#6B7594); margin-right:0.6rem; display:inline-block; transition:transform .15s; }
    .dr-doc[open] .dr-doc-summary:before { transform:rotate(90deg); }
    .dr-doc-body { padding:0 1.3rem 1.1rem; font-size:0.9rem; line-height:1.6; color:var(--text,#1A1A2E); overflow-x:auto; }
    .dr-doc-body h1,.dr-doc-body h2,.dr-doc-body h3 { line-height:1.3; margin:1.1rem 0 0.5rem; }
    .dr-doc-body h1 { font-size:1.2rem; } .dr-doc-body h2 { font-size:1.05rem; } .dr-doc-body h3 { font-size:0.95rem; }
    .dr-doc-body table { border-collapse:collapse; width:100%; margin:0.8rem 0; font-size:0.82rem; }
    .dr-doc-body th,.dr-doc-body td { border:1px solid rgba(0,0,0,0.1); padding:0.4rem 0.6rem; text-align:left; }
    .dr-doc-body code { font-family:'JetBrains Mono',monospace; font-size:0.85em; background:rgba(0,0,0,0.05); padding:0.05em 0.35em; border-radius:4px; }
    .dr-doc-body a { color:var(--primary,#0036FF); }
    .dr-loading { color:var(--muted,#6B7594); }
  `;
  document.head.appendChild(s);
}
