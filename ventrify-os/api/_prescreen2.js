/**
 * _prescreen2 — the free ~1-minute read that answers ONE question: is this venture worth assessing?
 *
 * Spec: design/prescreen-v2-spec.md. This file owns §6 (the four phases), §8.1-8.5 (the guardrails that
 * run inside every run) and the band construction. The browser owns orchestration, because Vercel Hobby
 * caps one invocation at 60s — a constraint that produces the better UX anyway (§6.5).
 *
 * WHY THIS REPLACES _prescreen.js. v1 asked "does the supplied evidence meet this criterion?" 21 times.
 * Every call was inward-looking, so the only sentence it could ever produce was "here is what your
 * documents do and don't contain" — an audit, not a flavour of the paid assessment. Insight can only come
 * from three places, and v1 reached none of them:
 *
 *     WHAT THEY DIDN'T KNOW      the outside world            -> phase 2, external research
 *     WHAT THEY DIDN'T NOTICE    tension between documents    -> phase 3, `tension`
 *     WHAT THEY DIDN'T WANT TO   the bear case, argued        -> phase 3, `bear`
 *
 * DISTIL ONCE, REASON MANY TIMES. The corpus is read exactly once, into a ~2K structured brief. Every
 * analytical call then runs on the brief, not the corpus — which is what makes six reasoning passes and
 * five web searches affordable, and which drops a run's input tokens from ~880,000 to ~100,000. That is
 * what fixes the concurrency ceiling v1 hit at 500,000 input tokens/minute (v1 spec §10).
 *
 * FABRICATION IS MADE IMPOSSIBLE, NOT FORBIDDEN (§8). A prompt saying "do not make things up" is a
 * request; a schema that cannot represent an unsourced claim is a constraint. Two mechanisms:
 *
 *   · External claims cite a source by INTEGER INDEX into the sources we harvested from the API's own
 *     web_search result blocks, as a schema enum. The model cannot invent a URL because it never writes
 *     one. This is stronger than the spec's "check the URL appears in the results" and replaces it.
 *   · Every claim carries a quoted span, substring-verified in code against that source's harvested text
 *     (or, for internal claims, against the document). Unverifiable spans are DROPPED, never rendered.
 *
 * A dropped claim makes the output shorter. It never makes it wrong.
 *
 * NOTHING HERE IS A REQUIRED CREATIVE SLOT (§8.5). Every nugget may come back empty, and "we could not
 * find comparable players in public sources" is a valid, shipped answer. A mandatory slot with no
 * evidence behind it is where fabrication comes from.
 *
 * The leading underscore keeps this OFF Vercel's function count — the project sits at exactly its
 * 12-function cap, so a new api/*.js file would fail the whole deploy. Same as _roomcheck / _chat / _corpus.
 */

const { buildCorpus, estTokens, CORPUS_MAX_TOKENS } = require('./_corpus.js');

const API = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// Extraction is not reasoning. Reading a deck and writing down what the venture IS costs 2x less on
// Sonnet 5.5 ($2/$10 per MTok vs $4/$20) and is the one call that pays for the whole corpus.
const MODEL_DISTIL = 'claude-sonnet-5-5';
// Judgement runs on Opus 5.5, but only ever over the ~2K brief — never the corpus.
const MODEL_REASON = 'claude-opus-5-5';

// §8.6 — a hard ceiling, not a suggestion. Searches cost $10 per 1,000 and, more importantly, each one
// adds seconds to a run with a 60s invocation cap above it.
const MAX_SEARCHES = 5;
const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search' };

// Thinking cannot be disabled on Opus 5.5 or Sonnet 5.5 — {type:'disabled'} is a 400, and on Sonnet 5.5
// the documented way off is {type:'between_tools'} at effort <= high. We do not want it off: these are
// judgement calls. Depth is controlled by effort alone, and thinking counts as OUTPUT, which is ~77% of a
// run's bill. So max_tokens is sized per phase rather than set generously everywhere.
const MAX_TOK = { distil: 3000, research: 8000, nugget: 4000, band: 3000, judge: 1500 };

// A quoted span shorter than this cannot be verified meaningfully — "growth" appears in every document.
const MIN_SPAN = 24;
// Spans are matched after whitespace and case normalisation, because an extraction pass re-flows text.
const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// ── THE BANDS ────────────────────────────────────────────────────────────────────────────────────────
//
// Three bands, answering "is this worth assessing?" — NOT a quality verdict on the venture. We have only
// ever read documents: we never met the team, used the product or spoke to a customer, so quality is a
// claim we are not entitled to make and readiness is exactly the claim we are (§2).
//
// `expectedBandFor` is the INVERSE map, used only by the calibration gate: given a full assessment's
// published composite, which band should the pre-screen have said? It reuses the runner's own 80/60/40
// thresholds (shared/vss-rubric.js GUIDANCE_BANDS) and collapses the top two, because to the question
// "is this worth assessing?" both READY and PROMISING answer yes and the pre-screen may not split them.
const BANDS = ['LOW', 'MEDIUM', 'HIGH'];
const BAND_COPY = {
  HIGH:   'Strong case — worth the full assessment now',
  MEDIUM: 'Real signal here, with specific things that need resolving',
  LOW:    "The case doesn't hold up yet on what we can see",
};
function expectedBandFor(composite) {
  const n = Number(composite);
  if (!Number.isFinite(n)) return null;
  if (n >= 60) return 'HIGH';      // READY or PROMISING
  if (n >= 40) return 'MEDIUM';    // HIGH_RISK
  return 'LOW';                    // POTENTIAL_DECLINE
}

// ── PHASE 1 — DISTIL ─────────────────────────────────────────────────────────────────────────────────
//
// The single point of failure in the whole design (§8.2). If this gets sector or business model wrong,
// all six downstream calls reason confidently about the wrong company and produce something internally
// consistent and completely false — and nothing would look broken. Two defences: the brief is shown to
// the customer as the first thing on screen, where they validate it in two seconds; and its own claims
// are substring-checked like any other.
//
// Scalar fields exist so the reasoning calls have something compact to think with. `claims` is the part
// that must be TRUE, so it is the part that is verified.
const STAGES = ['pre-seed', 'seed', 'series-a', 'series-b-plus', 'unknown'];

function briefSchema() {
  return {
    type: 'object', additionalProperties: false,
    required: ['oneLine', 'sector', 'subSector', 'stage', 'geography', 'businessModel',
               'marketClaim', 'traction', 'team', 'ask', 'claims', 'readable'],
    properties: {
      oneLine:       { type: 'string' },
      sector:        { type: 'string' },
      subSector:     { type: 'string' },
      stage:         { type: 'string', enum: STAGES },
      geography:     { type: 'string' },
      businessModel: { type: 'string' },
      marketClaim:   { type: 'string' },
      traction:      { type: 'array', items: { type: 'string' } },
      team: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['name', 'background'],
                 properties: { name: { type: 'string' }, background: { type: 'string' } } },
      },
      ask: { type: 'string' },
      claims: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['statement', 'docName', 'quotedSpan'],
                 properties: { statement: { type: 'string' }, docName: { type: 'string' }, quotedSpan: { type: 'string' } } },
      },
      // §3.3 — "we couldn't tell" is NOT the bottom band. A two-slide teaser is an unreadable
      // submission, not a verdict on a venture, and the model is asked outright rather than having it
      // inferred from a thin score.
      readable: { type: 'boolean' },
    },
  };
}

const DISTIL_PROMPT = `You are reading a venture's own documents to write down what the venture IS. You are not scoring it, ranking it or judging it — a later pass does that, and it will reason only from what you write here.

Write the brief from the documents and NOTHING else. You have no web access at this stage and must not use outside knowledge about this company.

- oneLine: what the venture does, in one sentence, in plain language.
- marketClaim: the market the documents claim, including its number if they state one. Empty string if they do not.
- traction: the figures the documents claim, as short strings. Empty array if none.
- claims: the load-bearing factual statements, each with the document name and a VERBATIM span of at least 30 characters copied exactly from that document. Copy the span character for character — it is checked against the source and dropped if it does not match.
- readable: false ONLY if the documents contain too little to say what the venture does at all. Thin evidence is not unreadable; a two-slide teaser with no substance is.

Where the documents do not say something, leave it empty. Do not fill a gap with a plausible guess.`;

function distilRequest(corpusText) {
  return {
    model: MODEL_DISTIL,
    max_tokens: MAX_TOK.distil,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: briefSchema() } },
    system: [{
      type: 'text',
      text: `${DISTIL_PROMPT}\n\n===== THE VENTURE'S DOCUMENTS =====\n${corpusText}`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: 'Write the brief.' }],
  };
}

// ── PHASE 2 — LOOK OUTWARD ───────────────────────────────────────────────────────────────────────────
//
// The only phase that can produce something the founder does not already know, which is why it exists
// and why a deck-only run is still a full run (§4): this needs the brief, not the data room.
//
// Plain text out, deliberately. The value of this call is not its prose — it is the web_search_tool_result
// blocks in its response, which `harvestSources` turns into the allow-list that every later citation is
// an index into. Ground truth comes from the API, never from the model's account of what it read.
function researchPrompt(brief) {
  return `A venture describes itself as follows. Research it from public sources.

  Sector: ${brief.sector}${brief.subSector ? ' / ' + brief.subSector : ''}
  What it does: ${brief.oneLine}
  Business model: ${brief.businessModel}
  Geography: ${brief.geography}
  Stage: ${brief.stage}
  Market it claims: ${brief.marketClaim || '(not stated)'}

Find, in at most ${MAX_SEARCHES} searches:

1. Who else operates in this space — named companies, especially ones a founder might not list as competitors.
2. What has been funded in this space recently, and at what size.
3. Whether any public source agrees or disagrees with the market claim above.

Report what you found with the figures and company names. If you cannot find something, say so plainly — a gap is a finding and inventing a competitor would be worse than returning less.`;
}

function researchRequest(brief) {
  return {
    model: MODEL_REASON,
    max_tokens: MAX_TOK.research,
    output_config: { effort: 'low' },
    tools: [WEB_SEARCH_TOOL],
    messages: [{ role: 'user', content: researchPrompt(brief) }],
  };
}

/**
 * Pull the sources the API actually fetched out of a research response.
 *
 * This is the hinge of the whole guardrail. Nothing the model SAYS about its sources is trusted; only the
 * `web_search_tool_result` blocks the server produced. Those become a numbered allow-list, and §8.1's
 * citation enum is built from its indices — so a reasoning call cannot cite a page that was never
 * fetched, because the schema gives it no way to name one.
 *
 * Shapes vary by tool version and by whether dynamic filtering trimmed a result, so every field is read
 * defensively and a block we cannot understand is skipped rather than guessed at.
 */
function harvestSources(message) {
  const out = [], seen = new Set();
  const push = (r) => {
    if (!r || typeof r !== 'object') return;
    const url = String(r.url || '').trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    out.push({
      url,
      title: String(r.title || r.page_title || url).slice(0, 200),
      // Whatever text came back — this is what a quoted span is checked against. A source with no text
      // can still be listed, but no claim can ever be verified against it, which is the correct
      // conservative outcome rather than a reason to trust the claim.
      text: String(r.encrypted_content ? '' : (r.content || r.text || r.snippet || '')),
    });
  };
  for (const block of (message && message.content) || []) {
    if (!block || block.type !== 'web_search_tool_result') continue;
    const c = block.content;
    if (Array.isArray(c)) c.forEach(push);
    else push(c);
  }
  return out;
}

const researchNarrative = (message) =>
  ((message && message.content) || []).filter(b => b && b.type === 'text').map(b => b.text).join('\n').trim();

// ── PHASE 3 — REASON ─────────────────────────────────────────────────────────────────────────────────
//
// Six calls, in parallel, each over the ~2K brief plus the harvested sources. NEVER the corpus.
//
// `effort` is a per-call decision rather than one global setting: naming a thesis is restatement work,
// arguing a bear case is not. Thinking counts as output and output is most of the bill, so the cheap
// calls are kept cheap deliberately.
const NUGGETS = [
  { key: 'thesis',      effort: 'low',    items: 1, external: false,
    ask: 'Name what this venture is really betting on — the one thing that must be true for it to work. One short paragraph, in your own words, sharper than the documents put it. Do not restate the pitch.' },
  { key: 'bull',        effort: 'medium', items: 3, external: true,
    ask: 'Argue the case FOR this venture, as an investor who wants to back it would. Three points.' },
  { key: 'bear',        effort: 'medium', items: 3, external: true,
    ask: 'Argue the case AGAINST this venture, the way an investor will argue it in the room the founder is not in. Three points. Be specific and unsentimental.' },
  { key: 'competitive', effort: 'medium', items: 3, external: true,
    ask: 'Who else is operating in or adjacent to this space, what is this venture\'s wedge, and is it defensible? Prefer named players the documents did NOT mention — that is the most valuable thing you can say here.' },
  { key: 'team',        effort: 'low',    items: 3, external: false,
    ask: 'Does this team match this problem, and what is conspicuously missing from it? Name the gap rather than implying it.' },
  // Needs two or more documents by definition — one document cannot contradict itself across documents.
  // Skipped rather than attempted on a deck-only run (§4), because a required slot with nothing behind
  // it is exactly where fabrication comes from.
  { key: 'tension',     effort: 'medium', items: 3, external: false, minDocs: 2,
    ask: 'Where do this venture\'s own documents disagree with each other? Quote both sides. Report nothing if they are consistent — a clean set of documents is a real finding.' },
];

/**
 * A point is `{ point, sourceIndex | null, quotedSpan, docName }`.
 *
 * sourceIndex is an ENUM over the harvested sources, which is what makes an invented URL impossible —
 * the model never writes a URL at all. When there are no sources the property is omitted from the schema
 * entirely, so the model cannot cite one that does not exist.
 */
function nuggetSchema(spec, sourceCount) {
  const point = {
    type: 'object', additionalProperties: false,
    required: ['point', 'quotedSpan', 'docName', 'external'],
    properties: {
      point:      { type: 'string' },
      external:   { type: 'boolean' },
      quotedSpan: { type: 'string' },
      docName:    { type: 'string' },
    },
  };
  if (sourceCount > 0) {
    point.properties.sourceIndex = { type: 'integer', enum: Array.from({ length: sourceCount }, (_, i) => i) };
    point.required = point.required.concat('sourceIndex');
  }
  return {
    type: 'object', additionalProperties: false, required: ['points'],
    properties: { points: { type: 'array', items: point } },
  };
}

function nuggetPrompt(spec, brief, sources, narrative) {
  const src = sources.length
    ? sources.map((s, i) => `[${i}] ${s.title} — ${s.url}\n${String(s.text || '').slice(0, 1200)}`).join('\n\n')
    : '(no public sources were found for this venture)';
  return `${spec.ask}

Return at most ${spec.items} ${spec.items === 1 ? 'item' : 'items'}. RETURN FEWER, OR NONE, RATHER THAN PADDING. An empty answer is a valid and useful one; a generic point that would be true of any venture in this sector is worse than silence.

Every point must contain a number or a named entity. "Strong team" and "needs to prove product-market fit" are not points — they are true of everyone.

For each point:
- external: true if it rests on a public source below, false if it rests on the venture's own documents.
- If external, set sourceIndex to the source it rests on and quotedSpan to a VERBATIM span of at least 30 characters copied from that source's text.
- If not external, set docName to the venture's document and quotedSpan to a verbatim span from the brief's claims.
- A span is checked character for character against its source and the point is DROPPED if it does not match. Copy, never paraphrase.

===== THE VENTURE =====
${JSON.stringify(brief, null, 1)}

===== PUBLIC SOURCES =====
${src}

===== WHAT THE RESEARCH PASS REPORTED =====
${String(narrative || '').slice(0, 4000)}`;
}

function nuggetRequest(spec, brief, sources, narrative) {
  return {
    model: MODEL_REASON,
    max_tokens: MAX_TOK.nugget,
    output_config: { effort: spec.effort, format: { type: 'json_schema', schema: nuggetSchema(spec, sources.length) } },
    messages: [{ role: 'user', content: nuggetPrompt(spec, brief, sources, narrative) }],
  };
}

// ── §8.1 + §8.4 — VERIFICATION, IN CODE, WITH NO MODEL INVOLVED ──────────────────────────────────────

// §8.4 defence 1, free and structural: a point with no figure and no proper noun is generic. This catches
// "needs to prove PMF" and "strong team" at zero cost, before the one judge call ever runs.
//
// A CAPITAL THAT MERELY OPENS A SENTENCE IS GRAMMAR, NOT A NAME. The first version of this tested for a
// capital anywhere, so "Needs to prove product-market fit" passed on the word "Needs" — the check was
// reading English punctuation as evidence. Only a figure, an acronym, or a capital PAST the first word
// counts.
//
// This errs toward dropping, and that is deliberate. "Monzo operates here" has no figure and no second
// capital, so it goes — while a competitive point worth reading almost always carries one ("Monzo raised
// £500m", "Cleo, the UK lender"). §8.5 makes an empty slot valid and the prompt says an empty answer is
// better than a padded one, so a thin page is the cheap failure and a generic nugget is the expensive
// one. The judge pass (§8.4 defence 2) is the backstop for everything this cannot see.
const ACRONYM = /\b[A-Z]{2,}\b/;
const hasSubstance = (s) => {
  const t = String(s || '');
  if (/\d/.test(t)) return true;                                   // any figure
  if (ACRONYM.test(t)) return true;                                // FCA, SaaS, NHS — wherever it sits
  const mid = t.replace(/(^|[.!?]\s+)[A-Z][a-z]*/g, '$1');          // drop sentence-opening capitals
  return /\b[A-Z][a-zA-Z]{2,}/.test(mid);
};

/**
 * Keep only what we can prove. Returns { kept, dropped:[{point,why}] }.
 *
 * A point survives if it has substance AND its span verifies against the source it names. Everything
 * else is dropped with a reason, so a run can report how much it threw away — a pipeline that starts
 * dropping everything is a visible failure rather than a quietly thinner page.
 */
function verifyPoints(points, sources, docText) {
  const kept = [], dropped = [];
  for (const p of (points || [])) {
    const text = String(p.point || '').trim();
    if (!text) continue;
    if (!hasSubstance(text)) { dropped.push({ point: text, why: 'generic' }); continue; }

    const span = norm(p.quotedSpan);
    if (span.length < MIN_SPAN) { dropped.push({ point: text, why: 'span too short to verify' }); continue; }

    if (p.external) {
      const s = sources[Number(p.sourceIndex)];
      if (!s) { dropped.push({ point: text, why: 'no such source' }); continue; }
      if (!norm(s.text).includes(span)) { dropped.push({ point: text, why: 'span not in source' }); continue; }
      kept.push({ point: text, external: true, source: { url: s.url, title: s.title }, quotedSpan: String(p.quotedSpan).slice(0, 300) });
      continue;
    }

    // Internal claims are checked against the corpus we actually read. A customer-EDITED brief field has
    // no document behind it and is handled by §8.8, not here — this function never sees one.
    if (!norm(docText).includes(span)) { dropped.push({ point: text, why: 'span not in documents' }); continue; }
    kept.push({ point: text, external: false, docName: String(p.docName || '').slice(0, 160), quotedSpan: String(p.quotedSpan).slice(0, 300) });
  }
  return { kept, dropped };
}

// ── PHASE 4 — THE BAND ───────────────────────────────────────────────────────────────────────────────
//
// The band is a judgement, stated against the three definitions and made from the VERIFIED nuggets only
// — never from the dropped ones. It is validated empirically by tools/prescreen-bands.mjs against the
// engagements the full assessment has already scored; no model's self-report is ever a measurement (§8.3),
// so there is deliberately no confidence field for the model to fill in about itself.
function bandSchema() {
  return {
    type: 'object', additionalProperties: false, required: ['band', 'reason', 'nextTests'],
    properties: {
      band:   { type: 'string', enum: BANDS },
      reason: { type: 'string' },
      nextTests: { type: 'array', items: { type: 'string' } },
    },
  };
}

function bandPrompt(brief, verified, basis) {
  return `Decide whether this venture is worth commissioning a full assessment on, from the verified findings below.

You are NOT judging whether the business is good. You are judging whether the CASE for it is strong enough to be worth the work — we have only read documents, never met the team or used the product.

  HIGH    ${BAND_COPY.HIGH}
  MEDIUM  ${BAND_COPY.MEDIUM}
  LOW     ${BAND_COPY.LOW}

Rules:
- Judge the case, not the paperwork. How MANY documents were supplied is not evidence of anything. A venture that supplied one deck and whose case holds up is HIGH.
- reason: one sentence. Do not mention missing, absent or incomplete documents.
- nextTests: up to three specific things the full assessment would test, drawn from these findings. Never generic.

===== THE VENTURE =====
${JSON.stringify(brief, null, 1)}

===== VERIFIED FINDINGS =====
${JSON.stringify(verified, null, 1)}

===== WHAT THIS WAS READ FROM =====
${basis}`;
}

function bandRequest(brief, verified, basis) {
  return {
    model: MODEL_REASON,
    max_tokens: MAX_TOK.band,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: bandSchema() } },
    messages: [{ role: 'user', content: bandPrompt(brief, verified, basis) }],
  };
}

// §8.4 defence 2 — ONE judge pass over every nugget at once, asking only the question no deterministic
// check can answer: would this be true of any venture in this sector? This is the critic agent's entire
// legitimate scope (§8.7). It cannot see sources, cannot change a band and cannot add anything.
function judgeRequest(points, sector) {
  return {
    model: MODEL_REASON,
    max_tokens: MAX_TOK.judge,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: {
        type: 'object', additionalProperties: false, required: ['generic'],
        properties: { generic: { type: 'array', items: { type: 'integer', enum: Array.from({ length: points.length }, (_, i) => i) } } },
      } },
    },
    messages: [{ role: 'user', content:
`Which of these findings about a ${sector} venture would be true of ALMOST ANY venture in that sector? Return their indices and nothing else. Judge only genericness — not whether they are correct, fair or well written.

${points.map((p, i) => `[${i}] ${p.point}`).join('\n')}` }],
  };
}

// ── THE CALL ─────────────────────────────────────────────────────────────────────────────────────────

async function callClaude(body, apiKey) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`anthropic_${resp.status}`);
    err.status = resp.status;
    err.retryAfter = Number(resp.headers.get('retry-after')) || null;
    err.detail = detail.slice(0, 400);
    // A spend cap reads as a 400, not a 429, and no amount of retrying clears it. Told apart so the
    // caller can say "the account's limit stopped this" instead of "the pre-screen failed".
    err.overLimit = /usage limit|credit balance|spending limit/i.test(detail);
    throw err;
  }
  return resp.json();
}

// `stop_reason` is checked before the body is read. A refusal or a max_tokens cut is not a short answer,
// it is a truncated one, and parsing it would publish half a finding as a whole one.
function readJson(message) {
  if (!message) throw new Error('empty_response');
  if (message.stop_reason === 'refusal') throw new Error('refusal');
  if (message.stop_reason === 'max_tokens') throw new Error('max_tokens');
  const text = (message.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

const usageOf = (m) => {
  const u = (m && m.usage) || {};
  return {
    in: u.input_tokens || 0, out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0,
    searches: (u.server_tool_use && u.server_tool_use.web_search_requests) || 0,
  };
};

// Prices per MTok, verified 2026-10-31. Logged per run (§8.6) so the spec's estimate stops being an
// estimate — and so a cost regression is visible rather than discovered on a statement.
const PRICE = {
  'claude-opus-5-5':   { in: 4, out: 20, cacheRead: 0.20, cacheWrite: 5 },
  'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.20, cacheWrite: 2.5 },
};
const SEARCH_COST = 10 / 1000;
function costOf(entries = []) {
  let usd = 0;
  for (const { model, usage } of entries) {
    const p = PRICE[model]; if (!p || !usage) continue;
    usd += (usage.in * p.in + usage.out * p.out + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite) / 1e6
         + (usage.searches || 0) * SEARCH_COST;
  }
  return Math.round(usd * 10000) / 10000;
}

// A deck-only run says so, and is never marked down for it (§3.2). This sentence is the whole of
// "disclose the basis, never penalise it", so it is built here rather than written in the UI.
function basisLine(docCount, sourceCount) {
  const docs = docCount === 1 ? 'your pitch deck' : `${docCount} of your documents`;
  if (!sourceCount) return `Read from ${docs}.`;
  return `Read from ${docs} and ${sourceCount} public source${sourceCount === 1 ? '' : 's'}.`;
}

module.exports = {
  MODEL_DISTIL, MODEL_REASON, MAX_SEARCHES, MAX_TOK, WEB_SEARCH_TOOL, MIN_SPAN,
  BANDS, BAND_COPY, expectedBandFor, STAGES, NUGGETS,
  briefSchema, distilRequest,
  researchRequest, researchPrompt, harvestSources, researchNarrative,
  nuggetSchema, nuggetPrompt, nuggetRequest,
  hasSubstance, verifyPoints, norm,
  bandSchema, bandRequest, bandPrompt, judgeRequest,
  callClaude, readJson, usageOf, costOf, PRICE, basisLine,
  buildCorpus, estTokens, CORPUS_MAX_TOKENS,
};
