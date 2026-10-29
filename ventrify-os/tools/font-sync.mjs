#!/usr/bin/env node
/**
 * font-sync — every font family a page's TOKENS name must be a family that page FETCHES.
 *
 * WHY THIS GATE EXISTS. The M3 pages were built from the Material template, which fetches
 * Roboto. brand-map.css later repointed --md-ref-typeface-* at the brand's faces (Inter /
 * Inter Tight) and nobody changed the <link>. The result: eight live pages asked for a font
 * they never downloaded, fell through to the machine's system UI font, and looked CORRECT to
 * anyone with Inter installed locally — which included every machine this was designed on.
 *
 * It is the worst class of bug this codebase keeps producing: it renders rather than errors.
 * No console warning, no failed request, no visual break on the developer's screen. A customer
 * on Windows just silently reads a different typeface, ~16% narrower, with the light weights
 * synthesised. Only a machine WITHOUT the font can see it, so the one check that works is a
 * static one.
 *
 * WHAT IT CHECKS, per HTML page that loads the brand layer:
 *   1. every family named by --font-text / --font-display (minus generic + system fallbacks)
 *      appears in a Google Fonts <link> on that page;
 *   2. every weight the shared CSS declares is covered by the fetched weight ranges;
 *   3. nothing is fetched that the tokens do NOT name (a wasted download — how Roboto hid here).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/* Families that are NOT webfonts: generic CSS keywords and OS-supplied faces. Naming one of
   these in a stack is correct — it is the fallback — so they are never expected in a <link>. */
const SYSTEM = new Set(['ui-sans-serif', 'system-ui', '-apple-system', 'segoe ui', 'sans-serif',
  'serif', 'ui-monospace', 'sf mono', 'sfmono-regular', 'menlo', 'consolas', 'monospace',
  'blinkmacsystemfont', 'helvetica neue', 'arial', 'roboto mono']);

const families = stack => stack.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
  .filter(f => f && !SYSTEM.has(f.toLowerCase()));

// --- what the tokens NAME -------------------------------------------------------------
const brand = read(join(ROOT, 'assets/brand/brand.css'));
const tokenFamilies = new Set();
for (const tok of ['--font-display', '--font-text']) {
  const m = brand.match(new RegExp(tok + ':\\s*([^;]+);'));
  if (m) families(m[1]).forEach(f => tokenFamilies.add(f));
}
if (!tokenFamilies.size) { console.error('font-sync: could not read --font-* from brand.css'); process.exit(1); }
const textFamily = (() => { const m = brand.match(/--font-text:\s*([^;]+);/); return m ? families(m[1])[0] : null; })();
if (!textFamily) { console.error('font-sync: could not resolve the text face from --font-text'); process.exit(1); }

// --- what the shared CSS DEMANDS in weights -------------------------------------------
const cssDir = join(ROOT, 'shared/m3');
const weights = new Set();
for (const f of readdirSync(cssDir).filter(n => n.endsWith('.css') || n.endsWith('.js'))) {
  for (const m of read(join(cssDir, f)).matchAll(/font-weight:\s*(\d{3})/g)) weights.add(+m[1]);
  for (const m of read(join(cssDir, f)).matchAll(/font:\s*(\d{3})\s/g)) weights.add(+m[1]);
}

// --- per page -------------------------------------------------------------------------
const fails = [];
let checked = 0;
for (const name of readdirSync(join(ROOT, 'workspace')).filter(n => n.endsWith('.html'))) {
  const html = read(join(ROOT, 'workspace', name));
  if (!/m3\/brand-map\.css/.test(html)) continue;      // only pages on the brand layer
  checked++;
  const links = [...html.matchAll(/fonts\.googleapis\.com\/css2\?([^"']+)/g)].map(m => m[1]);
  const fetched = new Map();                            // family -> Set(weights)
  for (const q of links) {
    for (const fam of q.matchAll(/family=([^&:]+)(?::wght@([^&]+))?/g)) {
      const f = decodeURIComponent(fam[1]).replace(/\+/g, ' ');
      const ws = new Set();
      if (fam[2]) for (const part of fam[2].split(';')) {
        const r = part.match(/^(\d+)\.\.(\d+)$/);
        if (r) { for (let w = +r[1]; w <= +r[2]; w += 100) ws.add(w); }
        else if (/^\d+$/.test(part)) ws.add(+part);
      }
      fetched.set(f, ws);
    }
  }
  for (const f of tokenFamilies) {
    if (!fetched.has(f)) { fails.push(`${name}: tokens name "${f}" but the page never fetches it`); continue; }
    const have = fetched.get(f);
    if (!have.size) continue;                            // no wght@ = the whole family
    /* Weight coverage is only asserted for the TEXT face. Attributing a weight to the
       DISPLAY face is not statically decidable here: the md-typescale classes take their
       weight from theme.css and their family from brand-map.css, so no single file says
       "this weight renders in Inter Tight". Guessing would make the gate lie, and a gate
       that lies is worse than no gate — so it asserts what it can prove. The display face
       only has to be fetched with at least one weight; the check that actually catches the
       bug this gate exists for is the fetched-at-all test above. */
    if (f !== textFamily) continue;
    const missing = [...weights].filter(w => !have.has(w)).sort((a, b) => a - b);
    if (missing.length) fails.push(`${name}: "${f}" (the text face) fetched without weight(s) ${missing.join(', ')} that the CSS declares`);
  }
  for (const f of fetched.keys()) {
    if (f.startsWith('Material Symbols')) continue;      // the icon font, named in CSS not tokens
    if (!tokenFamilies.has(f)) fails.push(`${name}: fetches "${f}" which no --font-* token names (wasted download)`);
  }
}

console.log(`font-sync        tokens name: ${[...tokenFamilies].join(', ')}  (text face: ${textFamily})`);
console.log(`                 weights declared in shared CSS: ${[...weights].sort((a,b)=>a-b).join(', ')}`);
console.log(`                 pages on the brand layer: ${checked}`);
if (fails.length) { console.error('\nFAIL'); fails.forEach(f => console.error('  ' + f)); process.exit(1); }
console.log('                 every page fetches every family its tokens name');
