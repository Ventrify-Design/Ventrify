// ============================================================
// prescreen-view — THE SHAREABLE PRE-SCREEN.
//
// A self-contained HTML document, frozen at /m/<token>, for an operator to send a colleague.
//
// WHY THIS IS NOT dealMemoHTML WITH A FLAG. The deal memo is the paid artefact: a measured score, a
// recommendation, cited diligence. The pre-screen is a five-minute read that deliberately refuses to
// produce any of those. Rendering them from one function with a `prescreen: true` branch would make
// the free document a subset of the paid one — and a subset is exactly what it must not look like,
// because a reader who cannot tell them apart has no reason to want the other. They are two
// documents. They are allowed to be two functions. The memo is also the thing customers pay for, and
// it does not change shape because the free one did.
//
// WHAT IT MUST NEVER DO
//   · imply a score. There is no number here, because the pre-screen does not produce one.
//   · read as an audit of the data room. Coverage is DISCLOSURE, never a grade — the one place
//     document-centric language belongs (spec 3.4), and tools/prescreen-vocabulary.mjs scans this
//     file to keep it from leaking into the findings.
//
// THE CLOSE IS THE POINT. The reader is usually someone who has never seen VerdictScore. What sells
// the full assessment is not a slogan, it is the visible distance between what they just read and
// what they did not get — so the close names that difference rather than advertising.
//
// ── IT IS A VERDICTSCORE DOCUMENT, PAINTED IN VERDICTSCORE ───────────────────────────────────────
// This page used to be white paper with a #0036FF rule — the parent Ventrify blue, from before the
// product had its own identity. Every value below is now a resolved brand token, MEASURED in a
// browser against brand.css with [data-brand="verdictscore"] rather than copied by eye, because this
// file cannot LOAD brand.css: the /m/ CSP is `default-src 'none'; style-src 'unsafe-inline';
// img-src data: https:; font-src data:`, so one inline <style>, no external stylesheet, no web font.
// Hex here is therefore a FROZEN COPY of the palette, and the only kind of copy there is — so
// tools/brand-fidelity.mjs re-resolves brand.css and fails if the two ever drift apart.
//
// Inline SVG is not a fetched resource, so the real lockup renders under that CSP. It is imported,
// never re-drawn: its fills ARE the brand custom properties, which is why setting three of them on
// the <svg> element is enough to paint it correctly on a page with no brand layer at all.
//
// THE CONTRAST, MEASURED on the composited backdrops, not on the raw tokens:
//     white on card 16.69:1 · text-2 10.54:1 · text-3 6.37:1 · accent text 7.97:1
//     ink on the accent fill 8.90:1          (text-4 measures 3.74:1 and is therefore NOT used)
// ============================================================

import { brandLockup } from '../shared/m3/brand-lockup.js';
import { PS2_BANDS, bandOf } from '../shared/prescreen-bands.js';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── THE PALETTE, resolved from brand.css ───────────────────────────────────────────────────────────
// Each line names the token it is a copy of. The three composited values are what the browser
// actually paints for a translucent text step over this card — an email client and a `style-src`-only
// document cannot composite one against an unknown backdrop, so they are flattened here.
export const VS = {
  canvas:  '#100B22',   // --brand-ground       (color-mix(#140E2B 78%, black))
  card:    '#1B1B37',   // --brand-tint         (color-mix(#7C5CFC 15%, #0A0F14))
  deep:    '#140E2B',   // --v-violet-900       — the masthead and the close
  edge:    '#363245',   // --line-2 over canvas — the card's one border
  rule:    '#32324B',   // --line-1 over card   — section dividers
  ink1:    '#FFFFFF',   // --text-1
  ink2:    '#CDCDD3',   // --text-2 (.78 white) over the card
  ink3:    '#9F9FAB',   // --text-3 (.58 white) over the card
  accent:  '#B9A7FF',   // --brand-accent-2     — accent TEXT and the filled button, both AA
  fill:    '#7C5CFC',   // --brand-accent       — the saturated step: tints and the brand rule
  onFill:  '#140E2B',   // --text-on-accent
  unlit:   '#404057',   // --line-2 over card   — an unlit column of the verdict signal
  ok:      '#84CC16',   // --ok   (lime, 128 from every brand colour — see brand.css §6)
  okFilm:  '#223007',   // --ok-film flattened over the card
  font:    "Inter,'Inter Tight',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
};

// The six findings, in reading order, with the headings the product already uses for them.
const SECTIONS = [
  { key: 'thesis',      eyebrow: 'The bet',          title: 'What has to be true for this to work' },
  { key: 'bull',        eyebrow: 'The case for',     title: 'How an investor who wants to back it would argue' },
  { key: 'bear',        eyebrow: 'The case against', title: 'How it will be argued in the room the founder isn’t in' },
  { key: 'competitive', eyebrow: 'The field',        title: 'Who else is already doing this' },
  { key: 'team',        eyebrow: 'The team',         title: 'The team against the problem' },
  { key: 'tension',     eyebrow: 'The tension',      title: 'Where the documents disagree' },
];

/* verdictSignal — the band as three ascending columns, lit up to the verdict.
   A static copy of the product's own hero graphic (ds.js verdictSignal), down to the geometry, minus
   the entrance animation, which lives in ds.css's chart layer and cannot come with it.

   ONE COLOUR, AND IT IS A RULE. The lit columns are the identity accent, never a red/amber/green
   ramp. Colour in this product carries semantics — a pass, a failure, the case for and against — and
   a verdict graphic is not one of those. Painting Low amber would restate the very thing the spec
   forbids: that this is a quality score rather than a judgement about whether the case is worth
   reading. The band is carried by HOW MANY columns are lit and by the word beside them.
   This page did paint it as a traffic light for a week. */
function verdictSignal(band) {
  const b = bandOf(band);
  const lit = b ? b.i : -1;          // no band → nothing lit. Off the scale, not the bottom of it.
  const W = 34, GAP = 16, H = 96, STEP = [40, 64, 88];
  const cols = STEP.map((h, i) =>
    `<rect x="${i * (W + GAP)}" y="${H - h}" width="${W}" height="${h}" rx="7" fill="${i <= lit ? VS.accent : VS.unlit}"/>`
  ).join('');
  return `<svg viewBox="0 0 ${W * 3 + GAP * 2} ${H}" width="47" height="34" aria-hidden="true"
    style="display:block;flex:none">${cols}</svg>`;
}

/**
 * prescreenShareHTML(p, org, opts)
 *   p    — the engagement, carrying p.prescreen2 (the v2 snapshot)
 *   org  — { name }
 *   opts — { roomCheck, operatorEmail, productUrl }
 *
 * The org's own primaryColor is deliberately NOT used here, and this is the one document where that
 * is right. Per-org branding exists so a firm's deliverable looks like the firm's: the DEAL MEMO it
 * takes to an investment committee. This page is the opposite errand — it goes to someone who has
 * never seen VerdictScore, and its job is to make them want the product. An arbitrary org colour also
 * cannot be contrast-checked against a violet ground, and this page has no stylesheet to fix it in.
 * The firm is named, in text, at the top.
 */
export function prescreenShareHTML(p, org, opts = {}) {
  const ps = (p && p.prescreen2) || {};
  const orgName = (org && org.name) || 'Ventrify';
  const venture = p.ventureName || p.name || 'This venture';
  const band = bandOf(ps.band);
  const when = ps.at ? new Date(ps.at) : new Date();
  const date = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const productUrl = opts.productUrl || 'https://verdict.ventrify.io';

  const brief = ps.brief || {};
  const oneLine = brief.oneLine || brief.one_line || '';

  const points = (key) => (((ps.nuggets || {})[key] || {}).points || []).filter(x => x && x.point);

  const findings = SECTIONS.map(sec => {
    const pts = points(sec.key);
    if (!pts.length) return '';
    return `<section class="s">
      <div class="eyebrow">${esc(sec.eyebrow)}</div>
      <h2>${esc(sec.title)}</h2>
      <ul>${pts.map(pt => `<li>${esc(pt.point)}${
        pt.docName ? `<span class="src">Seen in ${esc(pt.docName)}</span>` : ''}</li>`).join('')}</ul>
    </section>`;
  }).join('');

  // COVERAGE — disclosure, never a grade. "3 of 6" counts what we were given; the caption says so,
  // and the same sentence appears in the product so the two cannot drift into different claims.
  const rc = opts.roomCheck || null;
  const classes = (rc && rc.classes) || [];
  const found = classes.filter(c => c.found).length;
  const coverage = classes.length ? `<section class="s cov">
      <div class="eyebrow">Coverage</div>
      <h2>What the read could see</h2>
      <div class="cov-n"><b>${found}</b> of ${classes.length} document types present${
        ps.docCount != null ? ` · ${esc(String(ps.docCount))} document${ps.docCount === 1 ? '' : 's'} read` : ''}</div>
      <ul class="chips">${classes.map(c =>
        `<li class="${c.found ? 'on' : 'off'}">${esc(c.label)}</li>`).join('')}</ul>
      <p class="note">A type shown as not present is not a mark against the venture — it is evidence this
        read was not given. Coverage is never a grade.</p>
    </section>` : '';

  const tests = (ps.nextTests || []).filter(Boolean);
  const nextTests = tests.length ? `<section class="s">
      <div class="eyebrow">If it goes further</div>
      <h2>What a full assessment would test</h2>
      <ul>${tests.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<title>${esc(venture)} — Pre-screen</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:${VS.canvas};color:${VS.ink1};font-size:14.5px;line-height:1.65;
       font-family:${VS.font};-webkit-font-smoothing:antialiased;}
  /* full-bleed on a phone, where 32px of canvas is 8% of the reading width; a document on a desk
     above it. The rule lives INSIDE the card — spanning the viewport it read as browser chrome. */
  .page{max-width:720px;margin:0 auto;background:${VS.card};overflow:hidden;}
  .rule{height:3px;background:${VS.fill};}
  @media (min-width:752px){ body{padding:28px 16px;} .page{border:1px solid ${VS.edge};border-radius:18px;} }
  .head{padding:24px 34px 22px;background:${VS.deep};}
  .mast{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
        padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid ${VS.rule};}
  .lockup{height:22px;width:auto;display:block;color:${VS.ink1};}
  .doc{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${VS.ink3};}
  .org{font-weight:600;font-size:14px;color:${VS.accent};letter-spacing:-.01em;}
  h1{font-size:27px;letter-spacing:-.025em;margin:10px 0 6px;line-height:1.18;}
  .pitch{color:${VS.ink2};font-size:15.5px;margin:0;}
  .verdict{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:22px 0 0;}
  .vband{display:flex;align-items:center;gap:11px;}
  .vband b{font-size:17px;letter-spacing:-.01em;color:${VS.ink1};display:block;line-height:1.25;}
  .vband span{font-size:13px;color:${VS.ink3};display:block;}
  .pill-x{font-size:12.5px;color:${VS.ink3};border:1px solid ${VS.rule};border-radius:999px;
          padding:5px 12px;}
  .reason{margin:18px 0 0;font-size:15.5px;line-height:1.6;color:${VS.ink2};}
  .s{padding:24px 34px;border-bottom:1px solid ${VS.rule};}
  .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${VS.accent};font-weight:600;}
  h2{font-size:16.5px;letter-spacing:-.015em;margin:7px 0 13px;color:${VS.ink1};}
  ul{margin:0;padding:0 0 0 18px;}
  li{margin:0 0 10px;color:${VS.ink2};}
  li::marker{color:${VS.unlit};}
  .src{display:block;font-size:12.5px;color:${VS.ink3};margin-top:3px;}
  .cov-n{font-size:15px;margin:0 0 12px;color:${VS.ink2};}
  .cov-n b{font-size:19px;color:${VS.ink1};}
  .chips{list-style:none;padding:0;margin:0 0 12px;display:flex;flex-wrap:wrap;gap:6px;}
  .chips li{margin:0;font-size:12.5px;padding:4px 11px;border-radius:999px;}
  .chips .on{background:${VS.okFilm};color:${VS.ok};}
  .chips .off{background:${VS.canvas};color:${VS.ink3};}
  .note{font-size:12.5px;color:${VS.ink3};margin:0;}
  .basis{padding:18px 34px;font-size:12.5px;color:${VS.ink3};border-bottom:1px solid ${VS.rule};}
  .close{padding:28px 34px 30px;background:${VS.deep};}
  .close h3{margin:0 0 9px;font-size:19px;letter-spacing:-.015em;color:${VS.ink1};}
  .close p{margin:0 0 14px;font-size:14.5px;line-height:1.68;color:${VS.ink2};}
  .close a{display:inline-block;background:${VS.accent};color:${VS.onFill};text-decoration:none;
           font-weight:600;font-size:14.5px;padding:12px 24px;border-radius:10px;}
  .close .fine{margin:16px 0 0;font-size:12.5px;color:${VS.ink3};}
  @media (max-width:560px){ .head,.s,.basis,.close{padding-left:20px;padding-right:20px;} h1{font-size:23px;} }
</style></head><body>
<div class="page">
  <div class="rule"></div>
  <div class="head">
    <div class="mast">
      ${brandLockup({ brand: 'verdictscore', cls: 'lockup', label: 'VerdictScore' })
        .replace('<svg ', `<svg style="--brand-accent:${VS.fill};--brand-accent-2:${VS.accent}" `)}
      <div class="doc">Pre-screen · ${esc(date)}</div>
    </div>
    <div class="org">${esc(orgName)}</div>
    <h1>${esc(venture)}</h1>
    ${oneLine ? `<p class="pitch">${esc(oneLine)}</p>` : ''}
    <div class="verdict">
      <div class="vband">${verdictSignal(ps.band)}
        <span><b>${esc(band ? band.label : 'Not enough to read yet')}</b>
        <span>${esc(band ? band.line : 'The submission could not be read far enough to call it.')}</span></span>
      </div>
      <span class="pill-x">A five-minute read, not an assessment</span>
    </div>
    ${ps.reason ? `<p class="reason">${esc(ps.reason)}</p>` : ''}
  </div>
  ${findings}
  ${coverage}
  ${nextTests}
  ${ps.basis ? `<div class="basis">${esc(ps.basis)}</div>` : ''}
  <div class="close">
    <h3>This is the quick read. There is a much longer one.</h3>
    <p>A pre-screen answers one question — is this worth your time — from the deck and whatever is in
       the room, in about five minutes. It does not produce a score, it does not research each
       document, and nothing in it has been diligenced.</p>
    <p>A full assessment scores the venture 0&ndash;100 across seven categories and thirty-five signals,
       researches every document with sources, argues the case from the whole room, and ends in a deal
       memo you can take to an investment committee.</p>
    <a href="${esc(productUrl)}">See what a full assessment looks like</a>
    <p class="fine">Shared by ${esc(opts.operatorEmail || orgName)} · generated by VerdictScore.
       This link is read-only and can be revoked by whoever sent it.</p>
  </div>
</div>
</body></html>`;
}
