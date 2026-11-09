import { readFile } from 'node:fs/promises';
// ── THE OPERATOR IS NOT THE FOUNDER ───────────────────────────────────────────────────────────────────
//
// shared/m3/ds.js renders the OPERATOR's surfaces only — the Workspace pages and the _redesign specimens.
// Studio (the founder's side) does not import it, verified by grep. So a second-person possessive about
// the VENTURE is always wrong here: the operator is assessing a company that is not theirs, and "your
// documents" / "your score" puts them in the wrong seat on every line it appears.
//
// The pre-screen copy was swept on 2026-11-09 ("Here's what we read your venture to be" → "this
// venture") and the full assessment was swept in the same pass. NEITHER shipped with a check, so the
// rule lived only in a commit message — which is how it got reintroduced on the loading screen and in
// the data room in the first place. This is that check.
//
// ALLOWED, and why: "your team" where the operator files evidence FOR THEIR OWN TEAM, and "tells you" /
// "as often as you like", which address the operator about the operator. The rule is about the VENTURE's
// possessions, not the second person as such.

const SRC = 'shared/m3/ds.js';
const BANNED = /\byour (venture|ventures|documents|docs|company|score|deck|founders|assessment|data room|cap table|financials|traction|market)\b/gi;
const ALLOW = [
  /For your team — why you filed this\./,     // the operator's own team, on the evidence-filing form
];

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };

// Comments are documentation OF the rule and quote the strings it bans — five gates in this repo have
// flagged their own prose. Strip them before scanning, never after.
function stripComments(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const two = src.slice(i, i + 2);
    if (two === '//') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (two === '/*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    out += src[i]; i++;
  }
  return out;
}

const raw = await readFile(SRC, 'utf8');
const body = stripComments(raw);
const lineOf = (idx) => body.slice(0, idx).split('\n').length;

const hits = [];
let m;
BANNED.lastIndex = 0;
while ((m = BANNED.exec(body))) {
  const from = Math.max(0, m.index - 90), to = Math.min(body.length, m.index + 90);
  const ctx = body.slice(from, to).replace(/\s+/g, ' ');
  if (ALLOW.some(r => r.test(ctx))) continue;
  hits.push({ phrase: m[0], line: lineOf(m.index), ctx: ctx.trim().slice(0, 110) });
}

console.log(`\n  scanned ${SRC} — ${raw.split('\n').length} lines, comments stripped\n`);
for (const h of hits) console.log(`   line ${String(h.line).padEnd(6)} "${h.phrase}"   …${h.ctx}…`);
ok(hits.length === 0, hits.length
  ? `${hits.length} second-person possessive(s) about the venture on an operator surface`
  : 'no operator surface refers to the venture in the second person');

// ── CANARY: the gate must fail on a violation it is meant to catch ──
const poisoned = stripComments(raw) + `\nconst x = 'Reading your documents';\n`;
BANNED.lastIndex = 0;
const canary = (poisoned.match(BANNED) || []).length;
ok(canary > hits.length, `canary: an injected "your documents" is detected (${canary} > ${hits.length})`);

// ── and the allowlist must be narrow: it may not swallow a real violation ──
const broad = `<p>Here is your venture and your score.</p> For your team — why you filed this.`;
BANNED.lastIndex = 0;
const inAllowCtx = (broad.match(BANNED) || []).length;
ok(inAllowCtx >= 2, `canary: the allowlist does not blanket-exempt nearby text (${inAllowCtx} hits still seen)`);

console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all checks passed\n');
process.exit(fails ? 1 : 0);
