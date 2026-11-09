#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SHARE UPSELL — the shared pre-screen has a job beyond being read.
//
// It is the only artefact this product sends to people who have never seen it. Making it free was a
// deliberate reversal of "share is paid-only" (entitlements, operator's list 2026-10-30), and the
// whole argument for reversing it was that the document sells the full assessment by being visibly
// NOT one. If the close is ever trimmed as clutter, the giveaway stays and the reason for it is gone —
// silently, because nothing would look broken.
//
//  RULE 1 — IT SAYS WHAT IT IS NOT. The page names itself a read rather than an assessment, in the
//           header, where a skim-reader will see it. (How many MINUTES is tools/run-timing.mjs's to
//           own — it is stated in a dozen files and this is only one of them.)
//  RULE 2 — THE CLOSE NAMES THE DIFFERENCE. Not a slogan: the specific things a full assessment does
//           that this did not, and a way to go and look.
//  RULE 3 — NO SCORE, ANYWHERE. The pre-screen does not produce one, and a reader who thinks it did
//           has been misled about the only thing that separates the two products.
//  RULE 4 — COVERAGE IS DISCLOSURE. The "not a grade" sentence travels with the counts.
//  RULE 5 — ONE SHARE PER TIER, AND IT IS A MASTHEAD ACTION ON BOTH. entitlements must offer share
//           XOR sharePrescreen, never both and never neither — and NEITHER belongs in the utility
//           rail. Until 2026-11-09 the full assessment's share WAS a rail tool, on the reasoning that
//           its masthead belongs to the lifecycle; the result was one product answering the same
//           question two ways, a primary button on a pre-screen and a buried icon on the ninety-minute
//           run. Promoted on the operator's call. The founder email is the rail tool on a pre-screen,
//           and a FULL engagement has nothing to advance to, so it is absent there.
//  RULE 6 — THE EMAIL CANNOT BE TOLD WHERE TO POINT. The link is read from the engagement's own
//           shareLink.token; a client-supplied url would make this an open relay that mails arbitrary
//           links from a verified domain.
//  RULE 7 — EVERY GATED RAIL TOOL IS WIRED. An id in the rail with no handler in RAIL_ACTIONS or
//           RAIL_PANELS does not fail — ds.js falls through to railPanel()'s placeholder, so the
//           operator gets a skeleton that looks like a half-built feature. Same shape as the
//           2026-10-31 bug where five actions shipped unreachable behind memo.js's whitelist, and
//           moving an action between surfaces is exactly when it happens.
//
// Run: node tools/share-upsell.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prescreenShareHTML } from '../workspace/prescreen-view.js';
import { entitlements, capsFor } from '../shared/entitlements.js';
import { resolveActions, ACTIONS } from '../shared/actions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');

const SNAP = {
  v: 2, state: 'done', band: 'medium',
  reason: 'The cost claim is the whole case and it rests on two labs.',
  nextTests: ['Whether the assay cost holds outside the two university labs.'],
  basis: 'Read from 14 documents and 9 external sources.',
  brief: { oneLine: 'A £38 assay aiming to replace a £400 lab panel.' },
  docCount: 14,
  nuggets: {
    thesis: { points: [{ point: 'That a cheaper assay can replace the panel without a regulatory change.' }] },
    bull: { points: [{ point: 'The cost delta is large enough to drive adoption on its own.' }] },
    bear: { points: [{ point: 'Two labs is not a cost curve.' }] },
    competitive: { points: [{ point: 'Two incumbents already sell a bundled panel.' }] },
    team: { points: [{ point: 'Strong assay chemistry, no commercial hire.' }] },
    tension: { points: [{ point: 'The deck says 40% growth; the model shows 12%.', docName: 'Model v4.xlsx' }] },
  },
};
const ROOM = { classes: [
  { key: 'financials', label: 'Financial model', found: true },
  { key: 'captable', label: 'Cap table', found: true },
  { key: 'metrics', label: 'Traction metrics', found: false },
  { key: 'contracts', label: 'Customer contracts', found: false },
] };
const P = { name: 'Verdana Bio', ventureName: 'Verdana Bio', prescreen2: SNAP };
const ORG = { name: 'Mercer Ventures', primaryColor: '#0036FF' };

function auditPage(html) {
  const bad = [];
  const text = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  if (!/\b\w+-minute read, not an assessment/i.test(text)) bad.push('RULE 1 — the page does not say it is a short read rather than an assessment');

  const closeOk = /full assessment/i.test(text)
    && /0.?100|seven categories|thirty-five signals/i.test(text)
    && /deal memo/i.test(text);
  if (!closeOk) bad.push('RULE 2 — the close no longer names what a full assessment adds (score, categories, memo)');
  if (!/href=/.test(html.slice(html.indexOf('class="close"')))) bad.push('RULE 2 — the close has no link to follow');

  if (/\bscore\s*(of|:)\s*\d/i.test(text) || /\b\d{1,3}\s*\/\s*100\b/.test(text)) bad.push('RULE 3 — the page shows something that reads as a score');

  if (!/never a grade/i.test(text)) bad.push('RULE 4 — the coverage section lost its "not a grade" sentence');

  // the findings themselves must be there, or the document is an advert with nothing in it
  if (!/40% growth/.test(text)) bad.push('the findings are missing from the rendered page');
  return bad;
}

function auditEntitlements() {
  const bad = [];
  for (const [label, eng] of [['pre-screen', { tier: 'prescreen' }], ['full', { tier: 'full' }]]) {
    const e = entitlements(eng, null);
    const n = (e.share ? 1 : 0) + (e.sharePrescreen ? 1 : 0);
    if (n !== 1) bad.push(`RULE 5 — a ${label} engagement entitles ${n} share actions, not exactly 1`);

    // And the capability has to reach a SURFACE. Entitlements agreeing while resolveActions shows
    // both buttons (or neither) is precisely the gap that let paid actions onto a pre-screen before
    // capsFor was applied to the rail at all.
    const rail = resolveActions({ page: 'assess', caps: capsFor(eng, null) }).rail.map(a => a.id);
    const shares = rail.filter(id => id === 'share' || id === 'share_prescreen');
    // NEITHER tier may put a share in the rail any more. This replaces the old assertion that the full
    // rail had to contain exactly "share" — reinstating the rail button now has to DELETE a check.
    if (shares.length)
      bad.push(`RULE 5 — the ${label} RAIL offers [${shares.join(', ')}]; share is a masthead action on both tiers`);
    if (label === 'full') {
      if (rail.includes('advance_founder'))
        bad.push('RULE 5 — a FULL engagement offers "advance_founder"; there is nothing left to advance it to');
    } else if (!rail.includes('advance_founder')) {
      bad.push('RULE 5 — the pre-screen rail has no "advance_founder" — the founder email has nowhere to live');
    }
  }
  // The surfaces themselves, from the registry both codebases render from.
  for (const id of ['share_prescreen', 'share'])
    if (!ACTIONS[id] || ACTIONS[id].tier !== 'primary')
      bad.push(`RULE 5 — ${id} is tier "${ACTIONS[id] && ACTIONS[id].tier}", not the masthead`);
  // The full memo's share must stay `text`: the masthead already has one filled button (Confirm) and
  // the conformance gate allows exactly one.
  if (ACTIONS.share.variant !== 'text')
    bad.push(`RULE 5 — share renders as "${ACTIONS.share.variant}"; it must be text so Confirm stays the only filled button`);
  if (!ACTIONS.advance_founder || ACTIONS.advance_founder.tier !== 'aux')
    bad.push('RULE 5 — advance_founder is not a utility-rail action');
  return bad;
}

// RULE 7 — the registry says an action exists; the PAGE has to answer when it is clicked.
// A cross-file join, which is the one thing a source scan is genuinely good for: ds.js looks the id
// up in window.RAIL_ACTIONS, falls back to window.RAIL_PANELS[panel], and then to a placeholder — so
// a missing handler is SILENT. Every rail id that carries a capability is a real feature behind a
// paywall and must be bound; the ungated tools (sources, discuss, activity, help…) may use the
// generic panel.
function auditWiring(pageSrc) {
  const bad = [];
  const keys = (name) => {
    const i = pageSrc.indexOf(`window.${name} = {`);
    if (i < 0) return null;
    const block = pageSrc.slice(i, pageSrc.indexOf('\n  };', i));
    return new Set([...block.matchAll(/^\s{4}(\w+)\s*:/gm)].map(m => m[1]));
  };
  const actions = keys('RAIL_ACTIONS'), panels = keys('RAIL_PANELS');
  if (!actions) return ['RULE 7 — window.RAIL_ACTIONS is not where this gate can find it in assess-next.html'];
  for (const tier of ['prescreen', 'full']) {
    for (const a of resolveActions({ page: 'assess', caps: capsFor({ tier }, null) }).rail) {
      if (!ACTIONS[a.id] || !ACTIONS[a.id].capability) continue;
      if (!actions.has(a.id) && !(panels && panels.has(ACTIONS[a.id].panel)))
        bad.push(`RULE 7 — the ${tier} rail offers "${a.id}" and nothing handles it; it opens a placeholder`);
    }
  }
  return bad;
}

function auditRelay(src) {
  const bad = [];
  const i = src.indexOf("body.type === 'prescreen-share'");
  if (i < 0) return ['RULE 6 — the prescreen-share branch is gone'];
  const branch = src.slice(i, src.indexOf('return;\n    }', i));
  if (!/eng\.shareLink && eng\.shareLink\.token/.test(branch)) bad.push('RULE 6 — the link is no longer read from the engagement');
  if (/url:\s*(String\()?body\./.test(branch)) bad.push('RULE 6 — the branch takes a url from the REQUEST — open relay');
  return bad;
}

const emailSrc = fs.readFileSync(path.join(ROOT, 'api/send-email.js'), 'utf8');
const pageSrc  = fs.readFileSync(path.join(ROOT, 'workspace/assess-next.html'), 'utf8');

if (CANARY) {
  const base = prescreenShareHTML(P, ORG, { roomCheck: ROOM, operatorEmail: 'alex@mercer.vc' });
  const checks = [
    ['close removed', auditPage(base.replace(/<div class="close">[\s\S]*?<\/div>\s*<\/div>/, '</div>')).length > 0],
    ['"not an assessment" removed', auditPage(base.replace('A five-minute read, not an assessment', 'Pre-screen')).length > 0],
    ['a score appears', auditPage(base.replace('<h1>Verdana Bio</h1>', '<h1>Verdana Bio 72/100</h1>')).length > 0],
    ['"never a grade" removed', auditPage(base.replace(/Coverage is never a grade\./, '')).length > 0],
    ['relay: url taken from the request', auditRelay(emailSrc.replace("url: origin + '/m/' + token,", 'url: String(body.url),')).length > 0],
    ['the founder email left unwired in the rail',
      auditWiring(pageSrc.replace('    advance_founder: () => window.__eaAdvance(),', '')).length > 0],
    ['healthy page clean', auditPage(base).length === 0],
    ['healthy entitlements clean', auditEntitlements().length === 0],
    ['healthy relay clean', auditRelay(emailSrc).length === 0],
    ['healthy wiring clean', auditWiring(pageSrc).length === 0],
  ];
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(42)} ${ok ? 'caught' : 'MISSED'}`));
  [...auditPage(base), ...auditEntitlements(), ...auditRelay(emailSrc), ...auditWiring(pageSrc)].forEach(x => console.log(`      unexpected: ${x}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

const html = prescreenShareHTML(P, ORG, { roomCheck: ROOM, operatorEmail: 'alex@mercer.vc' });
const problems = [...auditPage(html), ...auditEntitlements(), ...auditRelay(emailSrc), ...auditWiring(pageSrc)];
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s)`
  : `  PASS — the page says what it is not, the close names the difference, no score anywhere,\n         coverage keeps its caveat, one share per tier on the right surface, every gated rail\n         tool is wired, and the link cannot be supplied by a caller`);
process.exit(problems.length ? 1 : 0);
