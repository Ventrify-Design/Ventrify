#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MAIL BRAND — the six templates, RENDERED.
//
// THIS GATE EXISTS BECAUSE OF welcomeHtml. Its footer was a half-finished paste of the docs-request
// footer and still referenced `operatorEmail`, an identifier that function never took. A bare
// undefined identifier is a ReferenceError, so EVERY welcome email threw before Resend was reached
// and the branch 500'd — the confirmation that a new workspace exists, including every self-serve
// signup. Nothing caught it: six near-identical copies of one template, and every gate in this repo
// reading source text. Rendering the function is the only check that could have found it, and it
// takes four milliseconds.
//
//  RULE 1 — THEY RENDER. Every template, with full arguments and with empty ones, which is how the
//           real branches call them when a pre-screen found nothing in a category.
//  RULE 2 — ONE IDENTITY. Each carries the lockup and signs off as VerdictScore. Six copies of a
//           header is how the last one drifted.
//  RULE 3 — OUTLOOK PAINTS IT. The Word engine ignores `background` on body and div, so every
//           coloured cell needs a bgcolor ATTRIBUTE as well as the inline style. Without it a dark
//           email arrives as dark text on white.
//  RULE 4 — NO UPSELL IN AN INTERNAL EMAIL. The close belongs in the two that reach people outside
//           the firm. A product pitch at the foot of a sign-in link is spam, and it is one paste away.
//  RULE 5 — THE LOGO IS REACHABLE. An absolute https URL at an origin that serves it, and a PNG:
//           no mail client renders inline SVG, and Gmail and Outlook strip a data: URI.
//
// Run: node tools/mail-brand.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');
// Resolve this file's requires as if we were api/send-email.js — './_roomcheck.js' is relative to it.
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'api/send-email.js'));

const FULL = {
  surface: 'Workspace', link: 'https://os.ventrify.io/workspace',
  orgName: 'Mercer Ventures', ventureName: 'Verdana Bio',
  planLabel: 'Free trial', prescreens: 2,
  operatorName: 'Alex Doré', operatorEmail: 'alex@mercer.vc', senderEmail: 'alex@mercer.vc',
  thesis: [{ point: 'That a cheaper assay replaces the panel.' }],
  bull: [{ point: 'The cost delta carries it.' }],
  competitive: [{ point: 'Two incumbents bundle the panel.' }],
  tensions: [{ point: 'The deck says 40%; the model says 12%.', docName: 'Model v4.xlsx' }],
  nextTests: ['Whether the cost holds outside two labs.'],
  missing: [{ label: 'Cap table', want: 'Current ownership' }],
  extras: [{ label: 'References', why: 'Two named users' }],
  highlights: ['Two labs is not a cost curve.'],
  folderUrl: 'https://drive.google.com/drive/folders/X', note: 'As discussed.',
  band: 'Medium', bandLine: 'Real signal, with things to resolve.',
  oneLine: 'A £38 assay.', url: 'https://os.ventrify.io/m/abc', productUrl: 'https://verdict.ventrify.io',
};
// The same call with every list empty and every optional string absent — a real pre-screen that found
// nothing in a category, a founder with no Drive folder, an operator who added no note.
const EMPTY = {
  ...FULL, operatorName: '', note: '', folderUrl: '', oneLine: '', band: '', bandLine: '',
  thesis: [], bull: [], competitive: [], tensions: [], nextTests: [], missing: [], extras: [], highlights: [],
};

const OUTWARD = new Set(['advanceHtml', 'prescreenShareHtml']);   // they leave the firm
const INTERNAL = ['loginHtml', 'inviteHtml', 'welcomeHtml', 'docsRequestHtml'];

function load(src) {
  // Evaluated rather than required, so a canary can mutate the source. firebase-admin is the only
  // import that runs at module load and it is harmless here.
  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', 'process', 'fetch', 'console', 'Date', 'URL', src);
  fn(m, m.exports, require, { env: {} }, async () => ({ ok: true, text: async () => '' }), console, Date, URL);
  return m.exports.__templates;
}

function audit(src) {
  const bad = [];
  let T;
  try { T = load(src); } catch (e) { return [`the module does not load: ${e.message}`]; }
  if (!T) return ['__templates is not exported — this gate cannot render anything'];

  for (const [name, fn] of Object.entries(T)) {
    if (typeof fn !== 'function') continue;
    for (const [shape, args] of [['full', FULL], ['empty', EMPTY]]) {
      let html;
      try { html = fn(args); }
      catch (e) { bad.push(`RULE 1 — ${name} THROWS with ${shape} arguments: ${e.constructor.name}: ${e.message}`); continue; }
      if (shape !== 'full') continue;

      if (!/<img src="https:\/\/[^"]+\.png"[^>]*alt="VerdictScore"/.test(html))
        bad.push(`RULE 2 — ${name} has no VerdictScore lockup (an https PNG with alt text)`);
      if (!html.includes('Generated by VerdictScore'))
        bad.push(`RULE 2 — ${name} does not sign off as VerdictScore`);
      if (/<svg/i.test(html)) bad.push(`RULE 5 — ${name} contains inline SVG, which no mail client renders`);
      if (/src="data:/i.test(html)) bad.push(`RULE 5 — ${name} uses a data: URI, which Gmail and Outlook strip`);

      for (const tag of html.match(/<td[^>]*>/g) || []) {
        if (/style="[^"]*background:#/.test(tag) && !/bgcolor=/.test(tag))
          bad.push(`RULE 3 — ${name} has a coloured <td> with no bgcolor attribute: ${tag.slice(0, 64)}…`);
      }

      const sells = /See what a full assessment looks like/.test(html);
      if (OUTWARD.has(name) && !sells) bad.push(`RULE 4 — ${name} leaves the firm and no longer makes the case for the product`);
      if (!OUTWARD.has(name) && sells) bad.push(`RULE 4 — ${name} is an internal email and should not carry the upsell`);
    }
  }
  for (const n of [...OUTWARD, ...INTERNAL]) if (typeof T[n] !== 'function') bad.push(`${n} is not exported`);
  return bad;
}

const src = fs.readFileSync(path.join(ROOT, 'api/send-email.js'), 'utf8');

if (CANARY) {
  const checks = [
    ['the welcome ReferenceError, exactly as it was',
      audit(src.replace("function welcomeHtml({ orgName, planLabel, prescreens, link }) {",
                        "function welcomeHtml({ orgName, planLabel, prescreens, link }) {\n  const _ = operatorEmail;")).length > 0],
    ['a template loses the lockup',
      audit(src.replace('const LOGO = `<img', 'const LOGO = `<span')).length > 0],
    ['a coloured cell loses its bgcolor',
      audit(src.replace('<tr><td bgcolor="${MAIL.card}" style="background:${MAIL.card};padding:24px 32px 28px;">',
                        '<tr><td style="background:${MAIL.card};padding:24px 32px 28px;">')).length > 0],
    ['the upsell is pasted into a sign-in email',
      audit(src.replace("return mailShell({ width: 480, eyebrow: `Sign in · ${s}`, body: `",
                        "return mailShell({ width: 480, eyebrow: `Sign in · ${s}`, close: mailClose({ productUrl: 'https://x', heading: 'h', lead: 'l' }), body: `")).length > 0],
    ['the outward close is trimmed as clutter',
      audit(src.replace("heading: 'This is the quick read. There is a much longer one.',\n      lead:", "heading: '',\n      lead:")
               .replace("${mailBtn(productUrl, 'See what a full assessment looks like', 'quiet')}", '')).length > 0],
    ['healthy source clean', audit(src).length === 0],
  ];
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(42)} ${ok ? 'caught' : 'MISSED'}`));
  audit(src).forEach(x => console.log(`      unexpected: ${x}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

const problems = audit(src);
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s) in what would arrive in an inbox`
  : '  PASS — all six templates render with full and with empty arguments, each carries the lockup and\n         signs off as VerdictScore, every coloured cell survives Outlook, and only the two that\n         leave the firm make the case for the product');
process.exit(problems.length ? 1 : 0);
