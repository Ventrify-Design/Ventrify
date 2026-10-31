#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   CLASS COVERAGE — every class a component emits is a class some stylesheet
   defines.

   WHY THIS EXISTS. The v2 pre-screen shipped its sections under `.s-label`,
   `.s-h` and `.s-sub`: an eyebrow with an icon over it, an <h2>, a muted
   one-liner. That is the MARKETING SITE's section idiom (repo-root CLAUDE.md),
   and it was carried into the product by hand. `.s-h` and `.s-sub` have no rule
   in ANY stylesheet this product serves, so the headings fell back to the
   user-agent <h2> and the subtitles to a bare <p> — no font token, no size
   token, no colour token, on the one page a paying customer sees first.

   Nothing caught it. There was no error, no 404, no console warning: unstyled
   markup renders, it just renders wrong. The operator spotted it by eye weeks
   later and said the typography "looks a little off", which is exactly what an
   unstyled heading looks like.

   The failure is general and it is the expensive kind — silent, cosmetic,
   invisible to every other gate in this suite. css-parity.mjs proves a rule the
   author WROTE survives the parser; this proves a class the author USED was
   ever written. They are opposite directions and both are needed.

   WHAT IT CHECKS. Every static class token in a `class="…"` attribute emitted
   by the DS render functions, against the union of class selectors in every
   stylesheet the OS serves. A token in neither is markup nothing styles.

   WHAT IT DELIBERATELY DOES NOT CHECK. Tokens that only exist inside a `${…}`
   interpolation are reported as NOTES, not failures: resolving them needs the
   data, and a gate that guesses produces false alarms, which is how a gate gets
   switched off. The bug this exists for was fully static, as most are.

     node tools/class-coverage.mjs          the real check
     node tools/class-coverage.mjs --self   prove the gate can fail
   ════════════════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SELF = process.argv.includes('--self');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  ✗   ') + m); if (!c) fails++; };

/* ── every stylesheet the OS serves ────────────────────────────────────────
   Walked rather than listed: a sheet added next month is enrolled by existing,
   not by somebody remembering this file. */
const SKIP_DIR = /node_modules|\.git|temporary screenshots|_archive/;
const sheets = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP_DIR.test(p)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (e.endsWith('.css')) sheets.push(p);
  }
})(ROOT);
// brand.css lives outside the OS folder — it is the token layer every page loads first.
for (const extra of ['../assets/brand/brand.css']) {
  try { statSync(join(ROOT, extra)); sheets.push(join(ROOT, extra)); } catch { /* not present */ }
}

/* ── the class selectors those sheets define ───────────────────────────────
   Only PRELUDES are read. A declaration value can hold a dot (`.5rem`,
   `url(a.b)`, a font name) and counting those as definitions would make this
   gate pass on anything. Brace depth is tracked, comments and strings are
   skipped — the same tokenising css-parity.mjs does, for the same reason. */
const preludesOf = (css) => {
  const out = [];
  let buf = '', depth = 0, i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < css.length && css[i] !== q) { if (css[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '{') { if (depth === 0) { out.push(buf); buf = ''; } depth++; i++; continue; }
    if (c === '}') { depth = Math.max(0, depth - 1); if (depth === 0) buf = ''; i++; continue; }
    // An at-rule body (@media, @supports) nests: its inner preludes matter too.
    if (depth > 0) {
      // inside a block — only collect if the block is an at-rule wrapper, which we detect by
      // re-running the scan on its contents below. Cheaper: collect everything and let the
      // class regex do the filtering, since a declaration can never contain `.foo {`.
      buf += c; i++;
      if (c === ';') buf = '';
      continue;
    }
    if (c === ';') { buf = ''; i++; continue; }   // @import / @charset
    buf += c; i++;
  }
  return out;
};
const defined = new Set();
for (const f of sheets) {
  const css = readFileSync(f, 'utf8');
  // Preludes at depth 0 plus, for nested at-rules, every `… {` head inside them. One regex over the
  // comment- and string-stripped source, anchored on `{`, gets both without a second parser.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '""');
  for (const m of bare.matchAll(/([^{};]+)\{/g)) {
    for (const c of m[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(c[1]);
  }
  void preludesOf;   // the hand parser stays as the reference for what "prelude" means here
}
ok(defined.size > 400, `${sheets.length} stylesheets define ${defined.size} classes`);

/* ── the classes the components emit ───────────────────────────────────────── */
const SOURCES = ['shared/m3/ds.js', 'shared/m3/adapter.js', 'shared/m3/workspace-adapter.js',
                 'shared/m3/workspace-cards.js', 'shared/m3/brand-lockup.js', 'shared/shell.js',
                 'workspace/prescreen2.js']
  .filter(p => { try { statSync(join(ROOT, p)); return true; } catch { return false; } });

const STATE = /^(is-|has-|js-|on$|active$|open$|selected$|done$|live$|pending$)/;  // runtime hooks, styled by a parent

/* ── THE BASELINE, AND WHY IT IS A LIST AND NOT A PATTERN ──────────────────
   These twelve were already in the DS the day this gate was written. Each one
   is markup a component emits that no stylesheet styles, and each needs a look
   at the rendered surface to know whether it is a vestigial modifier (harmless,
   delete it) or a layout wrapper doing nothing (visibly wrong right now).
   `.pb-hero`, `.pb-dist`, `.wiz-step` and `.ws-empty-lead` are plain wrapper
   divs, which is the shape of the second kind.

   They are named one by one, on purpose. A regex or a blanket skip would let
   the next one in silently, which is the entire failure this gate exists to
   stop. THE RULE IS THAT THIS LIST ONLY EVER SHRINKS: resolve an entry, delete
   the line. Nothing may be added to it — a new orphan is a failure. */
const BASELINE = new Set([
  'urail-more',      // modifier on .urail-item; the real hook is data-tool="__more"
  'pb-hero',         // wrapper div, portfolio band
  'pb-dist',         // wrapper div, portfolio band
  'gc-l',            // the label span inside a gap chip
  'metric',          // modifier on .mrow
  'lc-bd',           // body box in the lifecycle strip
  'bot',             // modifier on .chat-msg — check the bot/user messages really do differ
  'sv-body',         // body box in the saved-view row
  'wiz-step',        // wrapper div, the build wizard
  'na-run',          // modifier on a .m3-btn in the next-action rail
  'forming-lockup',  // modifier on .score-lockup for the forming state
  'ws-empty-lead',   // wrapper div, workspace empty state
]);
const used = new Map();     // token → Set(file)
const soft = new Map();     // token seen only inside a ${…}
const note = (map, tok, f) => { if (!map.has(tok)) map.set(tok, new Set()); map.get(tok).add(f); };

for (const rel of SOURCES) {
  let src = readFileSync(join(ROOT, rel), 'utf8');
  if (SELF && rel === 'shared/m3/ds.js') src += '\nconst canary = `<div class="ps-canary-no-such-rule">x</div>`;\n';
  for (const m of src.matchAll(/class="([^"]*)"/g)) {
    /* SLOT BY SLOT, WITH THE INTERPOLATIONS INTACT. Splitting on whitespace after deleting every
       `${…}` turns `tone-${tone}` into a class called `tone-` and `gc-${k}` into `gc-` — three of the
       first run's seventeen "orphans" were fragments like that, i.e. the gate's own bug. A `${…}` can
       itself contain spaces (`${t ? ' ' + t : ''}`), so it is masked before the split and restored
       after, and a slot is judged by what is static at its edges:
         `eyebrow${…}`  → `eyebrow` is a whole class, the interpolation adds a modifier
         `tone-${…}`    → ends in a separator: a PREFIX, never a class on its own
         `${…}-bar`     → likewise a suffix
       Prefixes and suffixes are reported as notes. Only whole static tokens are asserted. */
    const MASK = '\u0001';
    const slots = m[1].replace(/\$\{[^}]*\}/g, (s) => s.replace(/\s/g, MASK)).split(/\s+/);
    for (const slot of slots) {
      const s = slot.split(MASK).join(' ');
      if (!s) continue;
      if (s.includes('${')) {
        for (const lit of s.matchAll(/'([a-zA-Z][\w-]*)'|"([a-zA-Z][\w-]*)"/g)) note(soft, lit[1] || lit[2], rel);
        const head = s.slice(0, s.indexOf('${'));
        if (/^-?[_a-zA-Z][\w-]*$/.test(head) && !/[-_]$/.test(head)) note(used, head, rel);
        else if (head) note(soft, head.replace(/[-_]$/, ''), rel);
        const tail = s.slice(s.lastIndexOf('}') + 1);
        if (tail) note(soft, tail.replace(/^[-_]/, ''), rel);
        continue;
      }
      if (/^-?[_a-zA-Z][\w-]*$/.test(s)) note(used, s, rel);
    }
  }
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([\w-]+)'/g)) note(soft, m[1], rel);
}
ok(used.size > 150, `${SOURCES.length} component files emit ${used.size} static classes`);

/* ── the check ─────────────────────────────────────────────────────────────── */
const orphans = [...used.entries()]
  .filter(([t]) => !defined.has(t) && !STATE.test(t) && !BASELINE.has(t));
// A baseline entry that has since been styled must leave the list, or the list stops meaning anything.
const stale = [...BASELINE].filter(t => defined.has(t));
ok(!stale.length, stale.length
  ? `${stale.length} baseline entr(y/ies) now HAVE a rule — delete them from BASELINE: ${stale.join(', ')}`
  : `${BASELINE.size} known-unstyled classes carried as an explicit baseline (it may only shrink)`);
ok(!orphans.length, orphans.length
  ? `${orphans.length} class(es) emitted by a component that NO stylesheet defines:\n` +
    orphans.map(([t, fs]) => `        .${t}  —  ${[...fs].map(f => relative('.', f)).join(', ')}`).join('\n')
  : 'every static class a component emits has a rule somewhere');

const softOrphans = [...soft.entries()].filter(([t]) => !defined.has(t) && !STATE.test(t));
if (softOrphans.length) {
  console.log(`\n  note  ${softOrphans.length} class(es) seen only inside a \${…} and defined nowhere — ` +
              `check by eye, not asserted:\n` +
              softOrphans.map(([t]) => `          .${t}`).join('\n'));
}

if (SELF) {
  const caught = orphans.some(([t]) => t === 'ps-canary-no-such-rule');
  console.log(caught ? '\n  ok  CANARY: the injected class was caught — the gate can fail'
                     : '\n  ✗   CANARY: the injected class was NOT caught — this gate is decoration');
  process.exit(caught ? 0 : 1);
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
