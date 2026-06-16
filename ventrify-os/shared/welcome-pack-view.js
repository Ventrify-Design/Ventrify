// ============================================================
// Ventrify OS — Welcome Pack, shared renderer (Workspace + Studio).
//
// The Phase-0 "proof of understanding" the operator org sends the founder
// right after the brief — live, not a PDF. Same component on both surfaces:
//   • Workspace (operator): review the draft, then send.
//   • Studio (founder): the sent pack.
//
// Rendered in the OPERATOR ORG's brand (multi-tenant) — pass org.primaryColor.
//
// Single source of truth — the welcome-pack data contract:
//   {
//     status: 'draft' | 'sent',
//     org: { name, primaryColor, logoUrl? },
//     venture: { name, oneLiner },
//     intro: '…',                                  // warm operator-org intro
//     heard: [ '…' ],                              // Page A — what we heard
//     voice: { title, points: [ '…' ], footer },   // Page B — voice we'll keep
//     observations: [ { text, source } ],          // Page C — 3 we already see
//     hypotheses: [ '…' ],                         // Page C — 3 we'll test
//     next: [ '…' ],                               // what happens next
//   }
// ============================================================

import { esc as _esc } from './util.js';

// opts: surface ('operator' | 'founder'), esc, onSend (operator only → renders a Send affordance via data-attr)
export function renderWelcomePack(pack, opts = {}) {
  if (!pack) return '';
  const esc = opts.esc || _esc;
  const brand = (pack.org && pack.org.primaryColor) || '#0036FF';
  const orgName = (pack.org && pack.org.name) || 'Your operator';
  const v = pack.venture || {};
  const isOperator = opts.surface === 'operator';
  const sent = pack.status === 'sent';

  const eyebrow = (t) => `<div class="wp-eyebrow">${esc(t)}</div>`;
  const panel = (cls, inner) => `<div class="wp-panel ${cls || ''}">${inner}</div>`;

  // ── Hero — org-branded ────────────────────────────────────────────────
  const statusPill = isOperator
    ? `<span class="wp-status ${sent ? 'is-sent' : 'is-draft'}">${sent ? '&#10003; Sent to founder' : 'Draft &middot; your review'}</span>`
    : '';
  const hero = `<div class="wp-hero">
      <div class="wp-hero-bar">
        <span class="wp-org">${(pack.org && pack.org.logoUrl) ? `<img src="${esc(pack.org.logoUrl)}" alt="${esc(orgName)}" class="wp-org-logo">` : ''}${esc(orgName)}</span>
        ${statusPill}
      </div>
      <div class="wp-hero-kicker">Welcome pack</div>
      <h2 class="wp-hero-title">Welcome to ${esc(orgName)}.</h2>
      ${v.name ? `<div class="wp-hero-venture">${esc(v.name)}${v.oneLiner ? ` &mdash; <span>${esc(v.oneLiner)}</span>` : ''}</div>` : ''}
      ${pack.intro ? `<p class="wp-intro">${esc(pack.intro)}</p>` : ''}
    </div>`;

  // ── Page A — What we heard ────────────────────────────────────────────
  const heard = (pack.heard && pack.heard.length) ? panel('', `
      ${eyebrow('What we heard from you')}
      <ul class="wp-list">${pack.heard.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
      <div class="wp-foot">This is what we&rsquo;ll build toward &mdash; tell us if any of it is off. We&rsquo;d rather adjust now than build the wrong product.</div>`) : '';

  // ── Page B — Voice we'll preserve ─────────────────────────────────────
  const voice = (pack.voice && pack.voice.points && pack.voice.points.length) ? panel('', `
      ${eyebrow(pack.voice.title || 'Your voice &mdash; we&rsquo;ll preserve it')}
      <ul class="wp-list wp-list-check">${pack.voice.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      ${pack.voice.footer ? `<div class="wp-foot">${esc(pack.voice.footer)}</div>` : ''}`) : '';

  // ── Page C — 3 we see · 3 we'll test ──────────────────────────────────
  const seeTest = ((pack.observations && pack.observations.length) || (pack.hypotheses && pack.hypotheses.length)) ? panel('wp-panel-2col', `
      ${eyebrow('Three things we already see &middot; three we&rsquo;ll test')}
      <div class="wp-cols">
        <div class="wp-col">
          <div class="wp-col-h">We already see</div>
          ${(pack.observations || []).map(o => `<div class="wp-obs"><span class="wp-dot"></span><div>${esc(o.text)}${o.source ? `<span class="wp-src">${esc(o.source)}</span>` : ''}</div></div>`).join('')}
        </div>
        <div class="wp-col">
          <div class="wp-col-h">We&rsquo;ll test in Phase 1</div>
          ${(pack.hypotheses || []).map((h, i) => `<div class="wp-hyp"><span class="wp-num">${i + 1}</span><div>${esc(h)}</div></div>`).join('')}
        </div>
      </div>
      <div class="wp-foot">Phase 1 will source-back, deepen, and stress-test each of these.</div>`) : '';

  // ── What's next ───────────────────────────────────────────────────────
  const next = (pack.next && pack.next.length) ? panel('wp-panel-next', `
      ${eyebrow('What happens next')}
      <ol class="wp-next">${pack.next.map(n => `<li>${esc(n)}</li>`).join('')}</ol>`) : '';

  // ── Operator send affordance ──────────────────────────────────────────
  const sendBar = (isOperator && !sent && opts.onSend !== false) ? `<div class="wp-sendbar">
      <span class="wp-sendbar-note">Review the pack, then send it to ${esc((v.founderName) || 'the founder')}. Nothing reaches them until you send.</span>
      <button class="wp-send-btn" data-wp-send="${esc(pack.engagementId || '')}">Send welcome pack &rarr;</button>
    </div>` : '';

  return `<div class="wp-root" style="--wp-brand:${esc(brand)};">${hero}${heard}${voice}${seeTest}${next}${sendBar}</div>`;
}

export function ensureWelcomePackStyles() {
  if (typeof document === 'undefined' || document.getElementById('wp-styles')) return;
  const s = document.createElement('style'); s.id = 'wp-styles';
  s.textContent = `
    .wp-root { --wp-surf:var(--surface-2,#fff); --wp-bd:var(--border,rgba(0,0,0,0.07)); --wp-txt:var(--text,#1A1A2E); --wp-mut:var(--muted,#6B7594); --wp-disp:var(--font-heading,'Space Grotesk',sans-serif); --wp-mono:var(--font-mono,ui-monospace,monospace); display:flex; flex-direction:column; gap:1.1rem; }
    .wp-panel { background:var(--wp-surf); border:1px solid var(--wp-bd); border-radius:16px; padding:1.5rem 1.7rem; }
    .wp-eyebrow { font-family:var(--wp-mono); font-size:0.68rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--wp-brand); margin-bottom:0.9rem; }
    /* Hero */
    .wp-hero { background:var(--wp-surf); border:1px solid var(--wp-bd); border-top:3px solid var(--wp-brand); border-radius:16px; padding:1.7rem 1.8rem; }
    .wp-hero-bar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.1rem; }
    .wp-org { display:inline-flex; align-items:center; gap:0.5rem; font-family:var(--wp-disp); font-weight:600; font-size:0.95rem; color:var(--wp-txt); }
    .wp-org-logo { height:22px; width:auto; display:block; }
    .wp-status { font-family:var(--wp-mono); font-size:0.64rem; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; padding:0.28rem 0.65rem; border-radius:999px; }
    .wp-status.is-draft { color:var(--band-mid,#C77700); background:rgba(199,119,0,0.12); }
    .wp-status.is-sent { color:var(--band-strong,#00A368); background:rgba(0,163,104,0.12); }
    .wp-hero-kicker { font-family:var(--wp-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:var(--wp-brand); margin-bottom:0.4rem; }
    .wp-hero-title { font-family:var(--wp-disp); font-size:clamp(1.7rem,3.5vw,2.3rem); font-weight:700; letter-spacing:-0.02em; line-height:1.05; color:var(--wp-txt); margin:0 0 0.6rem; }
    .wp-hero-venture { font-size:0.98rem; font-weight:600; color:var(--wp-txt); margin-bottom:0.85rem; }
    .wp-hero-venture span { font-weight:400; color:var(--wp-mut); }
    .wp-intro { font-size:0.96rem; line-height:1.65; color:var(--wp-mut); max-width:64ch; margin:0; }
    /* Lists */
    .wp-list { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:0.7rem; }
    .wp-list li { position:relative; padding-left:1.4rem; font-size:0.92rem; line-height:1.55; color:var(--wp-txt); }
    .wp-list li::before { content:''; position:absolute; left:0; top:0.55em; width:7px; height:7px; border-radius:50%; background:var(--wp-brand); }
    .wp-list-check li::before { content:'\\2713'; top:0; left:0; width:auto; height:auto; background:none; color:var(--wp-brand); font-size:0.85rem; font-weight:700; }
    .wp-foot { margin-top:1rem; font-size:0.82rem; line-height:1.55; color:var(--wp-mut); font-style:italic; border-top:1px solid var(--wp-bd); padding-top:0.85rem; }
    /* Page C — two columns */
    .wp-cols { display:grid; grid-template-columns:1fr 1fr; gap:1.6rem; }
    @media (max-width:720px){ .wp-cols { grid-template-columns:1fr; gap:1.2rem; } }
    .wp-col-h { font-size:0.8rem; font-weight:600; color:var(--wp-txt); margin-bottom:0.8rem; }
    .wp-obs, .wp-hyp { display:flex; gap:0.6rem; align-items:flex-start; padding:0.55rem 0; font-size:0.88rem; line-height:1.5; color:var(--wp-txt); border-bottom:1px dashed var(--wp-bd); }
    .wp-obs:last-child, .wp-hyp:last-child { border-bottom:none; }
    .wp-dot { flex:none; width:8px; height:8px; border-radius:50%; background:var(--band-strong,#00A368); margin-top:0.45em; }
    .wp-src { display:block; margin-top:0.2rem; font-family:var(--wp-mono); font-size:0.66rem; color:var(--wp-mut); }
    .wp-num { flex:none; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-family:var(--wp-mono); font-size:0.66rem; font-weight:700; color:var(--wp-brand); background:color-mix(in srgb, var(--wp-brand) 12%, transparent); }
    /* What's next */
    .wp-panel-next { background:color-mix(in srgb, var(--wp-brand) 4%, var(--wp-surf)); }
    .wp-next { margin:0; padding-left:1.2rem; display:flex; flex-direction:column; gap:0.6rem; }
    .wp-next li { font-size:0.9rem; line-height:1.55; color:var(--wp-txt); padding-left:0.3rem; }
    .wp-next li::marker { color:var(--wp-brand); font-family:var(--wp-mono); font-weight:700; }
    /* Operator send bar */
    .wp-sendbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; background:var(--wp-surf); border:1px solid var(--wp-bd); border-radius:16px; padding:1.1rem 1.4rem; }
    .wp-sendbar-note { font-size:0.86rem; color:var(--wp-mut); }
    .wp-send-btn { font-family:inherit; font-size:0.88rem; font-weight:600; color:#fff; background:var(--wp-brand); border:none; border-radius:999px; padding:0.7rem 1.3rem; cursor:pointer; }
    .wp-send-btn:hover { filter:brightness(1.08); }
  `;
  document.head.appendChild(s);
  // One-time delegated send handler — the host page defines window.__sendWelcomePack(engagementId).
  if (typeof window !== 'undefined' && !window.__wpWired) {
    window.__wpWired = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.wp-send-btn');
      if (btn && typeof window.__sendWelcomePack === 'function') window.__sendWelcomePack(btn.getAttribute('data-wp-send'));
    });
  }
}
