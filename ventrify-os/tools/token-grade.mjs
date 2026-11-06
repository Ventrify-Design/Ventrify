#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TOKEN GRADE — static rules the OS stylesheets must obey, each one a rule whose
// breach is INVISIBLE in review: the CSS parses, the page renders, and the thing
// you wrote simply never happens. All three were live at once on 2026-11-06.
//
//  RULE 1 — NO UNDECLARED TOKEN WITHOUT A FALLBACK. A bare var(--x) whose --x is declared
//           nowhere makes the WHOLE declaration invalid at computed-value time, silently.
//           `.tc-up` asked for --surface-1, which is a SITES token; the upsell band therefore
//           painted no background at all, in either of its two variants, and looked merely
//           understated rather than broken. var(--x, fallback) is NOT this bug — the fallback
//           is the declared value, and the codebase uses that deliberately for the dozen
//           tokens the shell sets from script.
//
//  RULE 2 — NO FILL-GRADE TOKEN AS INK. brand-map.css states the rule above the token:
//           "The LIGHT step of the ramp is the text colour; the saturated one is a fill."
//           --brand-accent is the fill step (#7C5CFC on VerdictScore). Used as `color:`
//           it measured 4.39:1 behind a 10px label — an AA failure. The text step is
//           --md-sys-color-primary (#B9A7FF, 9.19:1), which is what the masthead
//           breadcrumb tail and the other 43 accent rules in ds.css already use.
//
//  RULE 3 — NO DESCENDANT COMBINATOR BEFORE ::view-transition-*. The view-transition
//           pseudo tree hangs off the originating element ITSELF, so
//           `:root[x] ::view-transition-old(y)` (with a space) matches nothing, while
//           `:root[x]::view-transition-old(y)` matches. transitions.css carried the
//           spaced form for the drill's back direction, so the reverse motion had
//           never once played on any workspace page — and nothing failed to say so.
//
// Run: node tools/token-grade.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');

const SHEETS = [
  'shared/m3/ds.css',
  'shared/m3/theme.css',
  'shared/m3/brand-map.css',
  'shared/m3/workspace-chrome.css',
  'shared/m3/assess-editorial.css',
  'shared/m3/transitions.css',
  'assets/brand/brand.css',
].filter(f => fs.existsSync(path.join(ROOT, f)));

// Tokens set from script at runtime (element.style.setProperty / inline style strings),
// so they are legitimately absent from every stylesheet. Collected, not hardcoded.
const JS_DIRS = ['shared', 'shared/m3', '_redesign/m3', 'workspace', 'studio'];
const runtimeSet = new Set();
for (const d of JS_DIRS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!/\.(js|html)$/.test(f)) continue;
    const src = fs.readFileSync(path.join(abs, f), 'utf8');
    for (const m of src.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)/g)) runtimeSet.add(m[1]);
    for (const m of src.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*\$\{/g)) runtimeSet.add(m[1]);
    for (const m of src.matchAll(/style\s*=\s*["'`][^"'`]*?(--[A-Za-z0-9_-]+)\s*:/g)) runtimeSet.add(m[1]);
  }
}

// FILL-GRADE: tokens whose job is a background, a border or a button face — never ink.
// The mapping that makes this true lives in brand-map.css's IDENTITY block.
// NOT in this list on purpose: --brand-ink and --brand-ground. They are grounds, and a
// ground IS the correct ink when the surface under it is light — `color: var(--brand-ink)`
// on a filled accent button or a light status band is right, and flagging it would train
// the next person to ignore this gate.
const FILL_GRADE = {
  '--brand-accent': '--md-sys-color-primary',
  '--md-sys-color-inverse-primary': '--md-sys-color-primary',
  '--brand-tint': '--md-sys-color-primary',
};

function scan(sheets, extraText) {
  const declared = new Set(runtimeSet);
  const files = {};
  for (const f of sheets) {
    const raw = f === '__canary__' ? extraText : fs.readFileSync(path.join(ROOT, f), 'utf8');
    // Blank comments FILE-WIDE, keeping newlines so line numbers survive. Doing this
    // per line misses multi-line comments, and this gate's own explanatory comments
    // quote the very patterns it looks for — it flagged itself on the first run.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    files[f] = src;
    // tokens are collected from the RAW text so a declaration is never missed
    for (const m of raw.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) declared.add(m[1]);
  }

  const undeclared = [];
  const inkMisuse = [];
  const vtSelector = [];
  for (const [f, src] of Object.entries(files)) {
    src.split('\n').forEach((line, i) => {
      const at = `${f}:${i + 1}`;
      const bare = line;

      // The capture after the name tells us whether a fallback follows: `,` yes, `)` no.
      for (const m of bare.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g)) {
        // `var(--font-${x})` style interpolation inside a template literal is not a token
        if (m[1].endsWith('-')) continue;
        if (m[2] === ',') continue;            // has a fallback — cannot invalidate anything
        if (!declared.has(m[1])) undeclared.push({ at, token: m[1], line: line.trim() });
      }

      // RULE 3 — only the selector half of the line, and only a REAL combinator:
      // leading indentation inside an @media block is not one.
      if (bare.includes('::view-transition-')) {
        const sel = bare.split('{')[0];
        for (const one of sel.split(',')) {
          if (/\S[ >+~]+::view-transition-/.test(one.trim())) {
            vtSelector.push({ at, line: one.trim().slice(0, 100) });
          }
        }
      }

      // `color:` only — background, border-color, fill and shadow are fill-grade jobs.
      const colour = bare.match(/(^|[;{\s])color\s*:\s*([^;}]+)/);
      if (!colour) return;
      for (const [fill, instead] of Object.entries(FILL_GRADE)) {
        if (colour[2].includes(`var(${fill})`)) {
          inkMisuse.push({ at, token: fill, instead, line: line.trim() });
        }
      }
    });
  }
  return { undeclared, inkMisuse, vtSelector };
}

if (CANARY) {
  // A gate that cannot fail is decoration. Feed it both faults and require both.
  const poison = `
    .canary-a { background: var(--definitely-not-a-real-token); }
    .canary-b { color: var(--brand-accent); }
    :root[data-nav-dir="back"] ::view-transition-old(shell-content) { animation-name: never-runs; }
  `;
  const r = scan([...SHEETS, '__canary__'], poison);
  const gotU = r.undeclared.some(u => u.token === '--definitely-not-a-real-token');
  const gotI = r.inkMisuse.some(m => m.token === '--brand-accent' && m.at.startsWith('__canary__'));
  const gotV = r.vtSelector.some(v => v.at.startsWith('__canary__'));
  console.log(`  canary undeclared-token : ${gotU ? 'caught' : 'MISSED'}`);
  console.log(`  canary ink-misuse       : ${gotI ? 'caught' : 'MISSED'}`);
  console.log(`  canary spaced-vt-selector: ${gotV ? 'caught' : 'MISSED'}`);
  process.exit(gotU && gotI && gotV ? 0 : 1);
}

const { undeclared, inkMisuse, vtSelector } = scan(SHEETS);

for (const u of undeclared) {
  console.log(`  ✗ ${u.at}  var(${u.token}) is declared nowhere — the whole declaration is dropped`);
  console.log(`      ${u.line.slice(0, 110)}`);
}
for (const m of inkMisuse) {
  console.log(`  ✗ ${m.at}  ${m.token} is a FILL step, used here as ink — use var(${m.instead})`);
  console.log(`      ${m.line.slice(0, 110)}`);
}

for (const v of vtSelector) {
  console.log(`  ✗ ${v.at}  a combinator before ::view-transition-* — this rule matches nothing`);
  console.log(`      ${v.line}`);
}

const bad = undeclared.length + inkMisuse.length + vtSelector.length;
console.log(bad
  ? `\n  FAIL — ${undeclared.length} undeclared, ${inkMisuse.length} fill-as-ink, ${vtSelector.length} dead vt selector(s)`
  : `  PASS — every var() resolves, no fill-grade token paints text, every ::view-transition rule can match (${SHEETS.length} sheets)`);
process.exit(bad ? 1 : 0);
