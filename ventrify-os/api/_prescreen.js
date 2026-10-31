/**
 * _prescreen — the free ~1-minute read that returns a score RANGE, before anyone pays for a full run.
 *
 * ⚠️ SUPERSEDED 2026-10-31 by _prescreen2.js. The range and this whole 21-probe document-scoring
 * construction are retired in favour of a three-band "is this worth assessing?" verdict built from a
 * distilled brief plus external research — design/prescreen-v2-spec.md. This file stays live only until
 * v2 ships, and keeps running for snapshots already written on its scale. Do not extend it.
 * The corpus machinery it used to own now lives in _corpus.js, shared with v2.
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

const {
  estTokens, CORPUS_MAX_TOKENS, PER_DOC_MAX, MIN_USEFUL,
  evidenceTag, evidenceValue, dedupeKey, orderForBudget, buildCorpus,
} = require('./_corpus.js');

const DRAWS = 3;          // §7 — three blind draws, median published. Not optional; see belowry.
// MIRROR of shared/vss-rubric.js SIGNAL_SCALE. This file is CommonJS and the rubric is an ES module, so
// it cannot be imported here — the same situation as ROOM_CLASSES in ds.js, and handled the same way:
// the copy is made safe by a gate rather than forbidden by a comment. tools/prescreen-logic.mjs fails
// the build if these stop matching the rubric.
//
// It was 0–5 with PAR 3, against a runner that has always scored 0 / 0.5 / 1. That is why a pre-screen
// said 45–57 about a venture the full assessment scored 78.
const SIGNAL_RAW = [0, 1, 2];        // what the model is asked for — schemas take integers, not halves
const RAW_DIVISOR = 2;               // raw / 2 → 0, 0.5, 1
const SIGNAL_VALUES = [0, 0.5, 1];
const PAR = 0.5;          // "partly" — what an unevidenced signal is assumed to reach at the ceiling
const MAX_PER_SIGNAL = 1;
// Three draws can produce an even count if one fails, and the mean of 1 and 2 is 1.5 — which is not a
// point on the scale. Snap, so a published score is always a value the rubric actually defines.
const snapToScale = v => SIGNAL_VALUES.reduce((best, x) => Math.abs(x - v) < Math.abs(best - v) ? x : best, SIGNAL_VALUES[0]);

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
2. SCORE — does the evidence MEET the criterion? Send 2 for yes, 1 for partly, 0 for no. This is the same judgement the full assessment makes, and it is not a grade on a curve: a criterion plainly met scores 2 even for an early venture, and one plainly not met scores 0 even for a strong one. Do not reserve the top of the scale. When "evidenced" is false the score is ignored entirely, so do not guess to fill it; send 0.

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
// scale is an enum (which IS supported) rather than minimum/maximum — the schema enforces it instead of
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
            score: { type: 'integer', enum: SIGNAL_RAW },
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
    // Raw 0/1/2 from the model, median-of-three, then normalised onto the rubric's 0/0.5/1.
    const scores = seen.map(x => Math.max(0, Math.min(SIGNAL_RAW[SIGNAL_RAW.length - 1], Number(x.score) || 0)));
    const score = snapToScale(medianOf(scores) / RAW_DIVISOR);
    // A note from a draw that AGREES with the published median — quoting a draw we overruled would show
    // the founder a reason that is not the reason for their number.
    const agreeing = seen.find(x => snapToScale(Math.max(0, Math.min(SIGNAL_RAW[SIGNAL_RAW.length - 1], Number(x.score) || 0)) / RAW_DIVISOR) === score && !!x.evidenced === evidenced);
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
// WHAT THE CEILING ASSUMES ABOUT WHAT IT CANNOT SEE.
//
// It used to assume PAR for every unevidenced signal, flat. That makes the ceiling independent of the
// venture, which is the opposite of what a ceiling should be: measured on MoneyGym the range predicted
// 64-74 against a true 76 — missing UPWARD, which is the worst direction, because it under-rates
// exactly the ventures a fund most wants to find.
//
// The best available predictor of the documents a founder has NOT shown us is the documents they have.
// So the assumption is their own evidenced mean — SHRUNK TOWARD PAR, because a venture that evidenced
// three signals has not earned a confident extrapolation from them. K is the strength of that prior in
// signals: at K=10, a room evidencing 28 signals is mostly trusted, one evidencing 3 is barely moved
// from par, and a room evidencing nothing lands exactly on par, which is the old behaviour and the
// right behaviour when there is nothing to go on.
//
// It cuts BOTH ways on purpose. A venture whose visible evidence is weak gets a ceiling below par,
// because its unseen documents are probably weak too. That is not pessimism, it is the discrimination
// the flat assumption destroyed: a constant ceiling cannot separate a good venture from a bad one.
const CEILING_PRIOR_K = 10;
function assumedForUnseen(cats) {
  const seen = [];
  for (const c of cats) for (const s of (c.signals || [])) if (s.evidenced) seen.push(Number(s.score) || 0);
  const n = seen.length;
  if (!n) return PAR;
  const mean = seen.reduce((a, b) => a + b, 0) / n;
  const shrunk = (n * mean + CEILING_PRIOR_K * PAR) / (n + CEILING_PRIOR_K);
  return Math.max(0, Math.min(MAX_PER_SIGNAL, shrunk));
}

function composeRange(cats) {
  let floor = 0, ceiling = 0, evidencedWeight = 0;
  const assumed = assumedForUnseen(cats);
  const categories = cats.map(c => {
    const max = c.subs.length * MAX_PER_SIGNAL;
    const sigs = c.signals || [];
    const fSum = sigs.reduce((a, s) => a + (s.evidenced ? s.score : 0), 0);
    const cSum = sigs.reduce((a, s) => a + (s.evidenced ? s.score : assumed), 0);
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
  // `assumed` is published so the screen can say what the high end rests on, rather than asserting a
  // number whose basis the reader cannot see.
  return { floor: f, ceiling: ce, width: ce - f, evidencedWeight: Math.round(evidencedWeight * 100),
           assumed: Math.round(assumed * 100) / 100, categories };
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
  MODEL, FAST_BETA, DEFAULT_SPEED, DRAWS, PAR, MAX_PER_SIGNAL, CEILING_PRIOR_K, assumedForUnseen, SIGNAL_RAW, SIGNAL_VALUES, CORPUS_MAX_TOKENS, isFastUnavailable,
  estTokens, buildCorpus, evidenceTag, orderForBudget, systemBlock, categoryPrompt, schemaFor, requestBody,
  warmCache, probeCategory, medianOf, consolidate, composeRange, bandOf, rangeBand, BAND_ORDER,
};
