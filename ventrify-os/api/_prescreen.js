/**
 * _prescreen — the free ~1-minute read that returns a score RANGE, before anyone pays for a full run.
 *
 * Spec: design/prescreen-spec.md. This file owns §2 (how the range is constructed), §5 (the model call)
 * and §6 (the traps). The browser owns the orchestration, because Vercel Hobby caps one invocation at 60s
 * and the whole run is longer than that — a constraint that produces the better UX anyway, since results
 * arrive live instead of behind a spinner.
 *
 * THE RANGE IS THE PRODUCT, NOT A HEDGE. We do NOT run the full rubric shallowly and widen the answer: a
 * thin pass scoring 41 is mostly measuring what it did not read, and it lands as a verdict. Instead every
 * signal is asked one extra question — can the supplied evidence support a rating at all? — and the two
 * ends are built from the answer:
 *
 *     FLOOR    evidenced signals at their score, unevidenced at the bottom of the scale (0)
 *     CEILING  evidenced signals at their score, unevidenced at par (3 of 5)
 *
 * so the WIDTH of the range is the completeness deficit, rendered as a number. A founder with a full room
 * gets a tight range and feels good; a thin room gets a wide one, and the remedy is to give us more —
 * never "you scored badly". That is both the honest construction and the entire commercial mechanism.
 *
 * NO THIRD COPY OF THE RUBRIC. shared/vss-rubric.js is ESM and this is CommonJS, but a CJS module can
 * `await import()` an ESM one, so the weights and sub-criteria are read from the single source rather than
 * mirrored into a third place that would drift (the runner's copy is already the documented second).
 *
 * The leading underscore keeps this OFF Vercel's function count — the OS project sits at exactly its
 * 12-function cap, so a new api/*.js file would fail the whole deploy. Same reason as _roomcheck / _chat.
 */

const MODEL = 'claude-opus-5-5';
const API = 'https://api.anthropic.com/v1/messages';

// Fast mode doubles output speed at double the price ($8/$40 per MTok vs $4/$20). It is a research
// preview with its own allocation, and THIS ORGANISATION HAS NONE — a request for it is refused with
// "rate limit of 0 fast mode input tokens per minute", which is a capability answer, not back-pressure.
//
// DEFAULT IS STANDARD, decided with the operator on 2026-10-30: half the price, roughly twice the
// wall-clock, identical scores. The promise is "under three minutes", not "about a minute". Pass
// speed:'fast' explicitly if an allocation is ever granted.
const DEFAULT_SPEED = 'standard';
const FAST_BETA = 'fast-mode-2026-02-01';

// ~4 chars/token is close enough for English prose; this exists to cap the corpus, not to bill anyone.
const estTokens = (s) => Math.round(String(s || '').length / 4);

// §9.1 — 40K tokens is roughly 60 pages. A 200-page upload would blow the latency budget on extraction
// alone, so the cap is stated on screen rather than letting one upload decide whether we keep the promise.
const CORPUS_MAX_TOKENS = 40000;
// No single document may take more than this share of the budget. One oversized spreadsheet would
// otherwise consume everything left and starve every document behind it.
//
// 0.35 → 0.20, MEASURED. On MoneyGym's 39-document room the 50,000-token finance base case took its
// full 35% — 14,000 tokens — as a truncated head, and two more documents took 19,000 between them, so
// three files held 33,000 of the 40,000 budget and the investor memo, market analysis, market sizing
// and all four competitor benchmarks were never read. A spreadsheet's first 14,000 tokens are column
// headers and early rows; this is a TRIAGE read scoring seven categories, and breadth across them beats
// depth in one. 20% still admits a meaningful head of any document while guaranteeing at least five.
const PER_DOC_MAX = Math.round(CORPUS_MAX_TOKENS * 0.20);
// Below this there is no point including a fragment — it costs budget and evidences nothing.
const MIN_USEFUL = 400;

const DRAWS = 3;          // §7 — three blind draws, median published. Not optional; see belowry.
const PAR = 3;            // "at par" on the rubric's 0–5 scale
const MAX_PER_SIGNAL = 5;

// ── CORPUS ───────────────────────────────────────────────────────────────────────────────────────────
//
// DETERMINISTIC ORDER IS LOAD-BEARING. The prompt cache matches on the opening stretch BYTE FOR BYTE, and
// every probe re-sends the corpus because the API is stateless. If Firestore returned these documents in a
// different order on the second call, every probe would be a fresh prefix at full price — ~$7.50 a run
// instead of ~$1.60, which is over budget. Sort explicitly; never trust query order.
// WHAT THE BUDGET IS SPENT ON MATTERS MORE THAN HOW BIG IT IS.
//
// This used to sort deck-first then ALPHABETICALLY, which is a coin flip dressed up as an order. On
// MoneyGym's 53-document room it spent the whole 40K budget on board minutes, incorporation papers and
// third-party benchmark PDFs, and dropped the financial model, the unit economics and the market
// sizing — the documents the rubric scores hardest on. The pre-screen predicted 41-56; the paid run,
// which read everything, published 76. Containment did not fail because the floor was too high. It
// failed because we read the wrong seventeen documents.
//
// Priority uses _roomcheck's OWN filename patterns, so "the documents that matter" means exactly what
// the scorer means by it and cannot drift into a second opinion. Ordering stays fully deterministic —
// the prompt cache matches byte for byte, so a nondeterministic corpus would silently cost 5x.
// Administrative paperwork a room must hold and a scorer learns nothing from. MoneyGym's room spent
// 2,470 tokens of a 40,000 budget reading an EIN confirmation letter as though it were evidence.
const GOVERNANCE = /(board.?resolution|bylaw|incorporat|articles|written.?consent|minutes|certificate|par.?value|stock.?purchase|share.?issuance|director|resignation|\bein\b|confirmation.?letter|tax|registration|filing.?receipt|\bnda\b|invoice|insurance|engagement.?letter)/i;
const EVIDENCE_VALUE = [
  // A deck that was uploaded into the data room rather than tagged ${docType:'pitch'} is still the
  // single most evidence-dense document a venture has. MoneyGym 2's room holds exactly that: its
  // 'FINAL VC Seed Round Pitch Deck' came in untagged and ranked as 'other', sixth.
  [9, 'memo',      /(pitch.?deck|investor.?deck|seed.?round.*deck|investor.?memo|seed.?memo|executive.?summary|one.?.?pager|business.?plan|thesis)/i],
  [8, 'team',      /(team|founder|cv|r[eé]sum|bio|advisor|org.?chart|hiring|people)/i],
  [7, 'market',    /(market|tam|sam|som|sizing|segment|opportunity|user.?insight|customer|demand|competitiv)/i],
  [6, 'product',   /(product|roadmap|feature|overview|spec|demo|architect|technolog|\bip\b|patent|moat|defensib|differentiat)/i],
  [5, 'execution', /(traction|metric|kpi|cohort|retention|growth|pilot|po[cv]|launch|milestone|engagement)/i],
  [4, 'financial', /(financ|unit.?econ|revenue|pricing|forecast|burn|runway|cost|margin|valuation|cap.?table|p.?and.?l|balance.?sheet)/i],
];
function evidenceTag(name) {
  const n = String(name || '');
  if (GOVERNANCE.test(n)) return { v: 1, k: 'governance' };
  for (const [v, k, re] of EVIDENCE_VALUE) if (re.test(n)) return { v, k };
  return { v: 3, k: 'other' };   // unrecognised — above governance, below anything we can name
}
const evidenceValue = name => evidenceTag(name).v;

// THE SAME DOCUMENT TWICE IS NOT TWICE THE EVIDENCE.
//
// Rooms exported from Drive routinely hold both renderings of a file. MoneyGym's holds
// `MoneyGym_Seed_Investor_Memo_updated.pdf` AND `.docx` — ~4,800 tokens, 12% of the budget, for one
// document, read twice and scored as if corroborated.
//
// Only the EXTENSION and the copy markers are stripped. "NG Founder_Stock_Purchase…",
// "2nd NG Founder_Stock_Purchase…" and "JC Founder_Stock_Purchase…" are three different people's
// agreements and must stay three documents; over-normalising here would silently delete evidence,
// which is far worse than reading something twice.
function dedupeKey(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')          // extension
    .replace(/^copy of\s+/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')            // " (1)"
    .replace(/[\s_\-]+/g, ' ')
    .trim().toLowerCase();
}


// SPREAD THE BUDGET ACROSS THE RUBRIC, HIGHEST-VALUE CATEGORY FIRST.
//
// This used to round-robin the SIX DATA-ROOM CLASSES, on the reasoning that "the range's width IS the
// count of classes we could not evidence". That reasoning was wrong, and it is the deepest cause of the
// pre-screen failing to discriminate between ventures:
//
//   · The width is the count of unevidenced RUBRIC SIGNALS (35, across 7 weighted categories), not of
//     room classes (6, leaning financial and legal).
//   · The room check never reads this corpus. api/ingest-docs.js `room-check` runs over EVERY ingested
//     document independently, so ordering the scoring corpus by room classes bought coverage that was
//     already free, and paid for it in evidence the score actually needed.
//
// Measured on MoneyGym's 39-document room: the class round-robin spent its first slots on a director's
// resignation and two share-purchase agreements, and the budget ran out before the investor memo, the
// market analysis, the market sizing or any of the four competitor benchmarks. The scorer then reported
// "No market growth rates appear" with the market sizing document sitting unread.
//
// So: group by the rubric category a document can speak to, order those groups by weight, and take one
// from each before a second from any. Governance is in the list and always last — it is necessary
// paperwork that evidences almost nothing the rubric scores.
function orderForBudget(clean) {
  const deck = clean.filter(d => d.docType === 'pitch');
  // Drop duplicate renderings before anything is ranked, keeping the LONGEST text of each — the PDF and
  // the DOCX of one memo rarely extract identically and the fuller extraction is the better evidence.
  const best = new Map();
  for (const d of clean.filter(x => x.docType !== 'pitch')) {
    const k = dedupeKey(d.name);
    const prev = best.get(k);
    if (!prev || String(d.text || '').length > String(prev.text || '').length) best.set(k, d);
  }

  const groups = new Map();
  for (const d of best.values()) {
    const { v, k } = evidenceTag(d.name);
    if (!groups.has(k)) groups.set(k, { v, docs: [] });
    groups.get(k).docs.push(d);
  }
  // Stable throughout: the corpus must be byte-identical across all 22 calls or the prompt cache misses
  // and the run costs ~5x. Equal value falls back to the name; never to query order.
  const keys = [...groups.keys()].sort((a, b) => (groups.get(b).v - groups.get(a).v) || a.localeCompare(b));
  for (const k of keys) groups.get(k).docs.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const out = [...deck];
  for (let n = 0; ; n++) {
    const round = keys.map(k => groups.get(k).docs[n]).filter(Boolean);
    if (!round.length) break;
    out.push(...round);
  }
  return out;
}

function buildCorpus(docs = []) {
  const clean = (docs || [])
    .map(d => ({ name: String(d.name || 'document'), text: String(d.text || ''), docType: String(d.docType || 'dataroom') }))
    .filter(d => d.text.trim())
    .sort((a, b) => a.name.localeCompare(b.name));   // stable base order; orderForBudget decides the real one
  const ordered = orderForBudget(clean);

  const parts = [];
  let used = 0, included = 0, dropped = [], truncated = [];
  for (const d of ordered) {
    const head = `\n\n===== ${d.name} (${d.docType}) =====\n`;
    const room = Math.min(CORPUS_MAX_TOKENS - used, PER_DOC_MAX) - estTokens(head);
    if (room < MIN_USEFUL) { dropped.push(d.name); continue; }
    const cost = estTokens(head + d.text);
    if (used + cost <= CORPUS_MAX_TOKENS && estTokens(d.text) <= PER_DOC_MAX) {
      parts.push(head + d.text);
      used += cost; included++;
      continue;
    }
    // TOO BIG TO FIT IS NOT A REASON TO READ NONE OF IT. MoneyGym's financial model — the single
    // document the rubric leans on hardest — is ~50,000 tokens on its own, larger than the whole
    // budget, so it was skipped entirely and `financial` scored as unevidenced on a venture that had
    // supplied it. A head is partial evidence; nothing is no evidence, and the difference is the
    // range's whole ceiling.
    //
    // PER_DOC_MAX also stops one spreadsheet eating the budget: without it the base case would take
    // everything left and the unit economics, cap table and market sizing behind it would all drop.
    parts.push(head + d.text.slice(0, room * 4) + '\n[… truncated — this document is longer than the pre-screen reads]');
    used += room + estTokens(head); included++; truncated.push(d.name);
  }
  return { text: parts.join(''), tokens: used, included, dropped, truncated, total: clean.length };
}

// ── THE PROMPT ───────────────────────────────────────────────────────────────────────────────────────
//
// PREFIX ORDER DECIDES THE BILL (§6, trap 2). Everything constant across the seven probes goes in `system`
// behind one cache breakpoint; only the category and its sub-criteria vary, and those live in `messages`,
// after it. Put "Category: Market Opportunity" at the top instead and all 21 probes are unique prefixes at
// full price. Render order is tools → system → messages, so this is the only correct arrangement.
const INSTRUCTIONS = `You are scoring a venture against a fixed rubric, from the evidence supplied below and NOTHING else.

You have no web access and must not use outside knowledge about this company, its founders or its market. If the evidence does not contain something, that is a finding, not a gap for you to fill.

For every sub-criterion you are given, answer two separate questions:

1. EVIDENCED — does the supplied evidence actually let you rate this? Set "evidenced": true only when a specific passage supports a rating. An inference from what a competent company would probably do is NOT evidence. A claim the venture makes about itself IS evidence of the claim, but weak evidence of the fact. When in doubt, answer false — a false "evidenced" silently narrows a range that should have been wide, which is the one failure this design cannot tolerate.
2. SCORE — 0 to 5, where 3 is par for a venture at this stage. Score only what the evidence supports. When "evidenced" is false the score is ignored entirely, so do not guess to fill it; send 0.

Also give a one-sentence "note" of at most 25 words. When evidenced, quote or name the specific thing you saw. When not evidenced, name the document that would settle it. The note is shown to the founder, so it must be specific and plain — never "insufficient information".`;

function systemBlock(corpusText) {
  return [{
    type: 'text',
    text: `${INSTRUCTIONS}\n\n===== EVIDENCE =====\n${corpusText}`,
    cache_control: { type: 'ephemeral' },
  }];
}

// The per-category question — the ONLY part that varies, so it must come after the breakpoint.
function categoryPrompt(cat) {
  return `Category: ${cat.label}\n\nScore each of these ${cat.subs.length} sub-criteria:\n`
    + cat.subs.map(s => `- ${s}`).join('\n')
    + `\n\nReturn one entry per sub-criterion, using exactly these slugs.`;
}

// Structured outputs, not a forced tool call: Opus 5.5 returns a 400 for tool_choice "any"/"tool", and the
// forced call only ever existed to get JSON back. Numeric ranges are not supported in these schemas, so the
// 0–5 bound is an enum (which IS supported) rather than minimum/maximum — the schema enforces it instead of
// the code hoping. Slugs are an enum too, so a probe cannot invent a sub-criterion.
function schemaFor(cat) {
  return {
    type: 'object', additionalProperties: false, required: ['signals'],
    properties: {
      signals: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['slug', 'evidenced', 'score', 'note'],
          properties: {
            slug: { type: 'string', enum: cat.subs },
            evidenced: { type: 'boolean' },
            score: { type: 'integer', enum: [0, 1, 2, 3, 4, 5] },
            note: { type: 'string' },
          },
        },
      },
    },
  };
}

// ── THE CALL ─────────────────────────────────────────────────────────────────────────────────────────

// `speed` is chosen ONCE, before the run starts, and never changes during it. Switching speed
// invalidates the prompt cache, so a mid-run downgrade would make every remaining probe pay full
// uncached price (§6, trap 4). Choosing standard UP FRONT is a different thing entirely and is safe:
// nothing is cached yet. Fast mode is a research preview with its own allocation, and an org without
// one is refused with "rate limit of 0 fast mode input tokens per minute" — not an error to work
// around, just a capability to detect once.
function requestBody(cat, corpusText, { warm = false, speed = DEFAULT_SPEED } = {}) {
  return {
    model: MODEL,
    // Pre-warm writes the cache without generating anything (§6, trap 3).
    max_tokens: warm ? 0 : 1500,
    ...(speed === 'fast' ? { speed: 'fast' } : {}),
    // Thinking CANNOT be disabled on Opus 5.5 — {type:'disabled'} and budget_tokens are both a 400 at every
    // effort level. Depth is controlled only by effort, whose default here is 'medium'; matching evidence
    // against a rubric we already wrote down is not hard reasoning, so it is set explicitly to 'low'.
    output_config: warm
      ? { effort: 'low' }
      : { effort: 'low', format: { type: 'json_schema', schema: schemaFor(cat) } },
    system: systemBlock(corpusText),
    messages: [{ role: 'user', content: warm ? 'Ready.' : categoryPrompt(cat) }],
  };
}

// A fast-mode allocation of zero reads as a 429, but it is a capability answer, not back-pressure:
// retrying or waiting will never help. Told apart here so callers can fall back once rather than
// honour a retry-after that means nothing.
const isFastUnavailable = (status, detail) =>
  status === 429 && /fast mode/i.test(String(detail || ''));

async function callClaude(body, apiKey) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // The fast-mode beta header is only meaningful alongside speed:'fast'. Sending it otherwise is
      // harmless but misleading to anyone reading the request.
      ...(body.speed === 'fast' ? { 'anthropic-beta': FAST_BETA } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`anthropic_${resp.status}`);
    err.status = resp.status;
    err.retryAfter = Number(resp.headers.get('retry-after')) || null;
    err.detail = detail.slice(0, 400);
    err.fastUnavailable = isFastUnavailable(resp.status, detail);
    throw err;
  }
  return resp.json();
}

/**
 * Warm the cache, once, BEFORE any fan-out. 21 simultaneous calls all start before any has finished
 * writing the cache, so all 21 would miss and the run would cost ~5× its budget (§6, trap 3).
 * Returns the usage so the caller can assert the write actually happened.
 */
async function warmCache(corpusText, apiKey, speed = DEFAULT_SPEED) {
  const out = await callClaude(requestBody(null, corpusText, { warm: true, speed }), apiKey);
  const u = out.usage || {};
  return { wrote: u.cache_creation_input_tokens || 0, read: u.cache_read_input_tokens || 0, speed: u.speed || null };
}

/**
 * One category = one serverless invocation = THREE DRAWS IN PARALLEL.
 *
 * Parallel is not a micro-optimisation (§6, trap 1): three draws written as a loop is ~45s+ and the
 * function is killed at 60s. This is the mistake the obvious implementation makes.
 *
 * NO SILENT DOWNGRADE (§6, trap 4). Switching speed invalidates the prompt cache, so a fast→standard
 * fallback mid-run makes every remaining probe pay full uncached price. On a 429 we surface it with its
 * retry-after and let the caller decide; we never quietly change speed underneath the run.
 */
async function probeCategory(cat, corpusText, apiKey, speed = DEFAULT_SPEED) {
  const body = requestBody(cat, corpusText, { speed });
  const settled = await Promise.allSettled(
    Array.from({ length: DRAWS }, () => callClaude(body, apiKey))
  );
  const draws = [], errors = [];
  let cacheRead = 0, cacheWrite = 0, outTokens = 0, servedSpeed = null;   // what the API SAYS it served, vs the `speed` we asked for
  for (const r of settled) {
    if (r.status === 'rejected') { errors.push({ status: r.reason.status, detail: r.reason.detail, retryAfter: r.reason.retryAfter }); continue; }
    const m = r.value, u = m.usage || {};
    cacheRead += u.cache_read_input_tokens || 0;
    cacheWrite += u.cache_creation_input_tokens || 0;
    outTokens += u.output_tokens || 0;
    servedSpeed = u.speed || servedSpeed;
    // A refusal or a max_tokens cut is NOT a draw. Counting it would publish a median over partial data.
    if (m.stop_reason === 'refusal' || m.stop_reason === 'max_tokens') {
      errors.push({ status: 200, detail: 'stop_reason=' + m.stop_reason });
      continue;
    }
    const text = (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    try { draws.push(JSON.parse(text).signals || []); }
    catch (e) { errors.push({ status: 200, detail: 'unparseable json' }); }
  }
  return { key: cat.key, draws, errors, usage: { cacheRead, cacheWrite, outTokens, speed: servedSpeed, asked: speed } };
}

// ── MEDIAN ACROSS THE DRAWS ──────────────────────────────────────────────────────────────────────────
//
// WHY THREE DRAWS AND NOT ONE. shared/vss-rubric.js records that KreditMate scored 47, then 39, on the same
// deck, because four 2–1 splits fell the other way. The runner already takes three blind draws and
// publishes the median. A single-draw pre-screen would be unstable, and an unstable RANGE is the exact
// failure the containment gate exists to prevent. The budget headroom is spent on repetition, not depth.
//
// `evidenced` takes the MAJORITY, not the median — it is a boolean, and two draws saying "we cannot see
// this" outvoting one that could is the conservative direction, which is the one we want.
function medianOf(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function consolidate(cat, draws) {
  return cat.subs.map(slug => {
    const seen = draws.map(d => (d || []).find(x => x && x.slug === slug)).filter(Boolean);
    if (!seen.length) return { slug, evidenced: false, score: 0, note: '', draws: 0, split: false };
    const yes = seen.filter(x => x.evidenced).length;
    const evidenced = yes * 2 > seen.length;
    const scores = seen.map(x => Math.max(0, Math.min(MAX_PER_SIGNAL, Number(x.score) || 0)));
    const score = medianOf(scores);
    // A note from a draw that AGREES with the published median — quoting a draw we overruled would show
    // the founder a reason that is not the reason for their number.
    const agreeing = seen.find(x => Math.max(0, Math.min(MAX_PER_SIGNAL, Number(x.score) || 0)) === score && !!x.evidenced === evidenced);
    return {
      slug, evidenced, score: evidenced ? score : 0,
      note: String((agreeing || seen[0]).note || '').slice(0, 220),
      draws: seen.length,
      // Decided by a single vote — the same instability signal the runner records as `consensus.splits`.
      split: new Set(scores).size > 1 && scores.filter(v => v === score).length <= seen.length / 2,
    };
  });
}

// ── THE RANGE ────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array} cats  [{ key, label, weight, subs, signals:[{slug,evidenced,score}] }]
 * @returns { floor, ceiling, width, evidencedWeight, categories }
 *
 * Composite is the weighted mean of per-category fractions × 100, matching the runner's v3 scale exactly —
 * a pre-screen on a different scale could not be compared with the paid score it is selling.
 */
function composeRange(cats) {
  let floor = 0, ceiling = 0, evidencedWeight = 0;
  const categories = cats.map(c => {
    const max = c.subs.length * MAX_PER_SIGNAL;
    const sigs = c.signals || [];
    const fSum = sigs.reduce((a, s) => a + (s.evidenced ? s.score : 0), 0);
    const cSum = sigs.reduce((a, s) => a + (s.evidenced ? s.score : PAR), 0);
    const seen = sigs.filter(s => s.evidenced).length;
    floor += c.weight * (fSum / max);
    ceiling += c.weight * (cSum / max);
    evidencedWeight += c.weight * (sigs.length ? seen / sigs.length : 0);
    return {
      key: c.key, label: c.label, weight: c.weight,
      floorPct: Math.round((fSum / max) * 100), ceilingPct: Math.round((cSum / max) * 100),
      evidenced: seen, of: sigs.length, signals: sigs,
    };
  });
  const f = Math.round(floor * 100), ce = Math.round(ceiling * 100);
  return { floor: f, ceiling: ce, width: ce - f, evidencedWeight: Math.round(evidencedWeight * 100), categories };
}

// The guidance bands, 80/60/40, mirroring the runner. The runner DECIDES the band on a real run — this only
// names where a RANGE sits, which is a different and weaker claim.
function bandOf(score) {
  if (score >= 80) return 'READY';
  if (score >= 60) return 'PROMISING';
  if (score >= 40) return 'HIGH_RISK';
  return 'POTENTIAL_DECLINE';
}

const BAND_ORDER = ['POTENTIAL_DECLINE', 'HIGH_RISK', 'PROMISING', 'READY'];

/**
 * §3.1 — SUPPRESS THE BAND WHEN THE RANGE STRADDLES A BOUNDARY.
 *
 * Par already reads as High risk, so publishing the floor's band on a range that reaches into Promising
 * would report a thin data room as a bad venture. When the two ends fall either side of a line we say the
 * range SPANS them — upside, not failure — and publish a single band only when the whole range sits inside
 * one. This is not spin: a single band on a straddling range is the less true of the two statements.
 */
function rangeBand(floor, ceiling) {
  const lo = bandOf(floor), hi = bandOf(ceiling);
  if (lo === hi) return { band: lo, spans: null };
  return { band: null, spans: [lo, hi] };
}

module.exports = {
  MODEL, FAST_BETA, DEFAULT_SPEED, DRAWS, PAR, MAX_PER_SIGNAL, CORPUS_MAX_TOKENS, isFastUnavailable,
  estTokens, buildCorpus, evidenceTag, orderForBudget, systemBlock, categoryPrompt, schemaFor, requestBody,
  warmCache, probeCategory, medianOf, consolidate, composeRange, bandOf, rangeBand, BAND_ORDER,
};
