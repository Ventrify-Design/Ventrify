// ============================================================
// prescreen-view — THE SHAREABLE PRE-SCREEN.
//
// A self-contained HTML document, frozen at /m/<token>, for an operator to send a colleague.
//
// WHY THIS IS NOT dealMemoHTML WITH A FLAG. The deal memo is the paid artefact: a measured score, a
// recommendation, cited diligence. The pre-screen is a three-minute read that deliberately refuses to
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
// The /m/ CSP is `default-src 'none'; style-src 'unsafe-inline'; img-src data: https:` — so: one
// inline <style>, no script, no external stylesheet, no web font.
// ============================================================

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// The six findings, in reading order, with the headings the product already uses for them.
const SECTIONS = [
  { key: 'thesis',      eyebrow: 'The bet',          title: 'What has to be true for this to work' },
  { key: 'bull',        eyebrow: 'The case for',     title: 'How an investor who wants to back it would argue' },
  { key: 'bear',        eyebrow: 'The case against', title: 'How it will be argued in the room the founder isn’t in' },
  { key: 'competitive', eyebrow: 'The field',        title: 'Who else is already doing this' },
  { key: 'team',        eyebrow: 'The team',         title: 'The team against the problem' },
  { key: 'tension',     eyebrow: 'The tension',      title: 'Where the documents disagree' },
];

// The band is a readiness call, not a rating. Three steps, and the colour says which, but there is
// deliberately no bar, dial or percentage anywhere on this page.
const BAND_TONE = {
  high:   { bg: '#0b7a52', label: 'Worth assessing' },
  medium: { bg: '#8a6300', label: 'Worth a closer look' },
  low:    { bg: '#7a2630', label: 'Not yet' },
};
const bandOf = (b) => BAND_TONE[String(b || '').toLowerCase()] || { bg: '#4b5563', label: 'Read below' };

/**
 * prescreenShareHTML(p, org, opts)
 *   p    — the engagement, carrying p.prescreen2 (the v2 snapshot)
 *   org  — { name, primaryColor }
 *   opts — { roomCheck, operatorEmail, productUrl }
 */
export function prescreenShareHTML(p, org, opts = {}) {
  const ps = (p && p.prescreen2) || {};
  const brand = (org && org.primaryColor) || '#0036FF';
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
<title>${esc(venture)} — Pre-screen</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:#f3f4f6;color:#1a1a1a;font-size:14px;line-height:1.6;
       font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;}
  .page{max-width:720px;margin:0 auto;background:#fff;}
  .band{height:6px;background:${esc(brand)};}
  .head{padding:26px 34px 20px;border-bottom:1px solid #ececf0;}
  .org{font-weight:700;font-size:14px;color:${esc(brand)};letter-spacing:-0.01em;}
  .doc{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8a8f98;margin-top:3px;}
  h1{font-size:26px;letter-spacing:-0.02em;margin:16px 0 6px;line-height:1.2;}
  .pitch{color:#555;font-size:15px;margin:0;}
  .verdict{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0 0;}
  .pill{display:inline-block;background:${esc(band.bg)};color:#fff;font-weight:600;font-size:13px;
        padding:6px 14px;border-radius:999px;}
  .pill-x{font-size:13px;color:#6b7280;}
  .reason{margin:14px 0 0;font-size:15px;line-height:1.6;color:#333;}
  .s{padding:24px 34px;border-bottom:1px solid #f0f0f3;}
  .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8a8f98;font-weight:600;}
  h2{font-size:16px;letter-spacing:-0.01em;margin:6px 0 12px;}
  ul{margin:0;padding:0 0 0 18px;}
  li{margin:0 0 9px;}
  .src{display:block;font-size:12.5px;color:#8a8f98;margin-top:2px;}
  .cov-n{font-size:15px;margin:0 0 12px;}
  .cov-n b{font-size:19px;}
  .chips{list-style:none;padding:0;margin:0 0 12px;display:flex;flex-wrap:wrap;gap:6px;}
  .chips li{margin:0;font-size:12.5px;padding:4px 11px;border-radius:999px;}
  .chips .on{background:#e8f3ee;color:#0b7a52;}
  .chips .off{background:#f1f2f4;color:#8a8f98;}
  .note{font-size:12.5px;color:#8a8f98;margin:0;}
  .basis{padding:18px 34px;font-size:12.5px;color:#8a8f98;}
  .close{padding:28px 34px 30px;background:#101322;color:#e8e9ef;}
  .close h3{margin:0 0 8px;font-size:18px;letter-spacing:-0.01em;color:#fff;}
  .close p{margin:0 0 14px;font-size:14px;line-height:1.65;color:#aeb2c4;}
  .close a{display:inline-block;background:#fff;color:#101322;text-decoration:none;font-weight:600;
           font-size:14px;padding:11px 22px;border-radius:9px;}
  .close .fine{margin:14px 0 0;font-size:12px;color:#767c92;}
  @media (max-width:560px){ .head,.s,.basis,.close{padding-left:20px;padding-right:20px;} h1{font-size:22px;} }
</style></head><body>
<div class="page">
  <div class="band"></div>
  <div class="head">
    <div class="org">${esc(orgName)}</div>
    <div class="doc">Pre-screen · ${esc(date)}</div>
    <h1>${esc(venture)}</h1>
    ${oneLine ? `<p class="pitch">${esc(oneLine)}</p>` : ''}
    <div class="verdict">
      <span class="pill">${esc(band.label)}</span>
      <span class="pill-x">A three-minute read, not an assessment</span>
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
       the room, in about three minutes. It does not produce a score, it does not research each
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
