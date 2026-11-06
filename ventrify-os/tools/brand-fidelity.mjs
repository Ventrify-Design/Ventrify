#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// BRAND FIDELITY — the two places that hold a FROZEN COPY of the palette.
//
// Everything in the product reads brand.css at runtime, so re-skinning the identity is one file.
// Two artefacts cannot:
//
//   workspace/prescreen-view.js   the /m/<token> page. CSP is `default-src 'none'`, so no stylesheet
//                                 can be loaded — the colours have to be literals in the document.
//   api/send-email.js             email. No custom properties, no external CSS, and no compositing
//                                 of a translucent text step against a backdrop the client chose.
//
// So both carry hex. Hex that was correct the day it was written and goes quietly wrong the first
// time anyone touches the violet ramp — the document still renders, it just stops being the product's
// colour, and nobody opens a shared pre-screen next to the workspace to notice. This gate re-resolves
// brand.css and fails on the difference.
//
// It resolves var() and color-mix() itself rather than driving a browser, because a gate that needs
// Chrome gets skipped. The arithmetic is checked against Chrome's own serialisation in the canary.
//
// IT READS THE VENDORED COPY, ventrify-os/assets/brand/brand.css — the file that is actually inside
// the deploy bundle and therefore the one the live product paints from. There is a second, canonical
// copy at the repo root for the marketing sites, and as of 2026-11-06 THE TWO DISAGREE: the root one
// sets --brand-ground to a flat #141218 where the vendored one mixes --v-violet-900 to #100B22.
// tools/brand-sync.mjs has been failing on that drift. Resolving against the root copy would mean
// checking these documents against a colour the product does not use — so if someone runs
// `brand-sync --sync` and the ground moves, this gate fails and names the hex to change. That is the
// correct outcome, not a false alarm.
//
//  RULE 1 — THE FROZEN COPIES MATCH THE LIVE TOKENS, within 1/255 per channel for a mix.
//  RULE 2 — THE FLATTENED TEXT STEPS MATCH, composited at the stated alpha over the stated backdrop.
//  RULE 3 — NOTHING FROM THE OLD IDENTITY SURVIVES in either file (#0036FF and its neighbours).
//
// Run: node tools/brand-fidelity.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');
const BRAND = 'verdictscore';

// ── a very small CSS custom-property resolver ────────────────────────────────────────────────────
// Declarations from :root, then from [data-brand="verdictscore"], which wins. Enough for the handful
// of tokens below and deliberately no more: this is not a CSS engine.
function declarations(css) {
  const strip = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map();
  const take = (block) => {
    for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) map.set(m[1], m[2].trim());
  };
  const root = strip.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (root) take(root[1]);
  const themed = strip.match(new RegExp(`\\[data-brand="${BRAND}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (themed) take(themed[1]);
  return map;
}

const hex = ([r, g, b]) => '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
const parseHex = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };

function resolve(value, decls, depth = 0) {
  if (depth > 12) throw new Error('var() cycle');
  let v = String(value).trim();
  // var(--x) / var(--x, fallback)
  const varM = v.match(/^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/);
  if (varM) {
    const got = decls.get(varM[1]);
    if (got != null) return resolve(got, decls, depth + 1);
    if (varM[2] != null) return resolve(varM[2], decls, depth + 1);
    throw new Error(`undeclared ${varM[1]}`);
  }
  // color-mix(in srgb, A P%, B)  — sRGB is gamma space, so this is a straight per-channel blend,
  // which is exactly what Chrome does and why it serialises the result as color(srgb …).
  const mixM = v.match(/^color-mix\(\s*in\s+srgb\s*,\s*([\s\S]+?)\s+([\d.]+)%\s*,\s*([\s\S]+?)\s*\)$/);
  if (mixM) {
    const a = parseHex(resolve(mixM[1], decls, depth + 1));
    const p = parseFloat(mixM[2]) / 100;
    const b = parseHex(resolve(mixM[3], decls, depth + 1));
    return hex(a.map((c, i) => c * p + b[i] * (1 - p)));
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + v.slice(1).split('').map(c => c + c).join('')).toUpperCase();
  throw new Error(`cannot resolve "${v.slice(0, 40)}"`);
}

// alpha white over an opaque backdrop — what a client that cannot composite has to be given instead
const flatten = (alpha, bgHex) => hex(parseHex(bgHex).map(c => alpha * 255 + (1 - alpha) * c));

const near = (a, b) => parseHex(a).every((c, i) => Math.abs(c - parseHex(b)[i]) <= 1);

// ── WHAT EACH FROZEN KEY IS A COPY OF ────────────────────────────────────────────────────────────
// `token` → resolve it. `flat` → [alpha, backdropKey] → composite it over another entry here.
const EXPECT = {
  canvas:   { token: '--brand-ground' },
  card:     { token: '--brand-tint' },
  deep:     { token: '--v-violet-900' },
  accent:   { token: '--brand-accent-2' },
  fill:     { token: '--brand-accent' },
  onAccent: { token: '--text-on-accent' },
  ink1:     { token: '--text-1' },
  ok:       { token: '--ok' },
  ink2:     { flat: [0.78, 'card'] },
  ink3:     { flat: [0.58, 'card'] },
  rule:     { flat: [0.10, 'card'] },
  edge:     { flat: [0.16, 'canvas'] },
  unlit:    { flat: [0.16, 'card'] },
  ruleDeep: { flat: [0.16, 'deep'] },
};

function expected(css) {
  const decls = declarations(css);
  const out = {};
  for (const [k, spec] of Object.entries(EXPECT)) if (spec.token) out[k] = resolve(`var(${spec.token})`, decls);
  for (const [k, spec] of Object.entries(EXPECT)) if (spec.flat) out[k] = flatten(spec.flat[0], out[spec.flat[1]]);
  return out;
}

// ── what the two files actually froze ────────────────────────────────────────────────────────────
// Read as source text, not imported: send-email.js is CommonJS with a firebase-admin require at the
// top, and the point is to check the literals as written.
function frozen(src, constName) {
  const i = src.indexOf(`const ${constName} = {`);
  if (i < 0) return null;
  const block = src.slice(i, src.indexOf('\n};', i));
  const out = {};
  for (const m of block.matchAll(/^\s*(\w+)\s*:\s*'(#[0-9A-Fa-f]{6})'/gm)) out[m[1]] = m[2].toUpperCase();
  return out;
}

// SCAN THE CODE, NOT THE PROSE. The first run of this gate failed on three hits that were all in the
// comments EXPLAINING what the old palette was and why it went — the fourth time a gate in this repo
// has flagged its own documentation. Whole-line comments only: a `//` strip that ignored position
// would cut every https:// URL in the file in half.
const codeOnly = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

const LEGACY = [
  ['#0036FF', 'the parent Ventrify blue'],
  ['#f4f5f7', 'the old light canvas'],
  ['#101322', 'the old near-navy close'],
  ['Powered by Ventrify OS', 'the old footer'],
];

function audit(css, mailSrc, pageSrc) {
  const bad = [];
  const want = expected(css);
  for (const [label, src, name] of [['api/send-email.js', mailSrc, 'MAIL'], ['workspace/prescreen-view.js', pageSrc, 'VS']]) {
    const got = frozen(src, name);
    if (!got) { bad.push(`${label} — the ${name} palette table is gone`); continue; }
    for (const [k, v] of Object.entries(want)) {
      if (got[k] == null) continue;                      // a file need not freeze every role
      if (!near(got[k], v)) bad.push(`RULE ${EXPECT[k].flat ? 2 : 1} — ${label} ${name}.${k} is ${got[k]}, brand.css resolves ${v}`);
    }
    const code = codeOnly(src);
    for (const [needle, what] of LEGACY) {
      if (code.includes(needle)) bad.push(`RULE 3 — ${label} still carries ${what} ("${needle}")`);
    }
  }
  return bad;
}

const css     = fs.readFileSync(path.join(ROOT, 'assets/brand/brand.css'), 'utf8');
const mailSrc = fs.readFileSync(path.join(ROOT, 'api/send-email.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'workspace/prescreen-view.js'), 'utf8');

if (CANARY) {
  // Chrome's own answers, read off `color(srgb …)` in a real render on 2026-11-06. The resolver has
  // to reproduce these or the whole gate is comparing one guess against another.
  const decls = declarations(css);
  const chrome = [['--brand-ground', '#100B22'], ['--brand-tint', '#1B1B37'], ['--brand-accent', '#7C5CFC']];
  const checks = chrome.map(([t, want]) => [`resolver agrees with Chrome on ${t}`, near(resolve(`var(${t})`, decls), want)]);
  checks.push(['flatten agrees with Chrome (.78 white on the card)', near(flatten(0.78, '#1B1B37'), '#CDCDD3')]);
  checks.push(['a drifted frozen hex is caught',
    audit(css, mailSrc.replace("canvas:  '#100B22'", "canvas:  '#0E0A1E'"), pageSrc).length > 0]);
  checks.push(['a drifted RAMP is caught',
    audit(css.replace('--v-violet-600: #7C5CFC;', '--v-violet-600: #6A4AE0;'), mailSrc, pageSrc).length > 0]);
  checks.push(['the old blue coming back is caught',
    audit(css, mailSrc.replace('${MAIL.fill}', '#0036FF'), pageSrc).length > 0]);
  checks.push(['healthy tree clean', audit(css, mailSrc, pageSrc).length === 0]);
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(46)} ${ok ? 'caught' : 'MISSED'}`));
  audit(css, mailSrc, pageSrc).forEach(x => console.log(`      unexpected: ${x}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

const problems = audit(css, mailSrc, pageSrc);
problems.forEach(x => console.log(`  ✗ ${x}`));
console.log(problems.length
  ? `\n  FAIL — ${problems.length} problem(s): a frozen copy of the palette has drifted from brand.css`
  : `  PASS — every frozen colour in the email chrome and the shared document still resolves from\n         brand.css [data-brand="${BRAND}"], and no trace of the old identity remains`);
process.exit(problems.length ? 1 : 0);
