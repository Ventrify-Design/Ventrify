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

// Fast mode: ~2.5× the output tokens per second at 2× the price ($8/$40 per MTok). Output tokens set the
// clock on this run, so the budget headroom converts almost directly into wall-clock, and wall-clock is
// what the "about a minute" promise is made of. Claude API only — not Bedrock/Vertex/Foundry.
const FAST_BETA = 'fast-mode-2026-02-01';

// ~4 chars/token is close enough for English prose; this exists to cap the corpus, not to bill anyone.
const estTokens = (s) => Math.round(String(s || '').length / 4);

// §9.1 — 40K tokens is roughly 60 pages. A 200-page upload would blow the latency budget on extraction
// alone, so the cap is stated on screen rather than letting one upload decide whether we keep the promise.
const CORPUS_MAX_TOKENS = 40000;

const DRAWS = 3;          // §7 — three blind draws, median published. Not optional; see belowry.
const PAR = 3;            // "at par" on the rubric's 0–5 scale
const MAX_PER_SIGNAL = 5;

// ── CORPUS ───────────────────────────────────────────────────────────────────────────────────────────
//
// DETERMINISTIC ORDER IS LOAD-BEARING. The prompt cache matches on the opening stretch BYTE FOR BYTE, and
// every probe re-sends the corpus because the API is stateless. If Firestore returned these documents in a
// different order on the second call, every probe would be a fresh prefix at full price — ~$7.50 a run
// instead of ~$1.60, which is over budget. Sort explicitly; never trust query order.
function buildCorpus(docs = []) {
  const clean = (docs || [])
    .map(d => ({ name: String(d.name || 'document'), text: String(d.text || ''), docType: String(d.docType || 'dataroom') }))
    .filter(d => d.text.trim())
    .sort((a, b) => {
      // the deck first — it is the one document the whole assessment is required to have
      const ap = a.docType === 'pitch' ? 0 : 1, bp = b.docType === 'pitch' ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name);
    });

  const parts = [];
  let used = 0, included = 0, dropped = [];
  for (const d of clean) {
    const head = `\n\n===== ${d.name} (${d.docType}) =====\n`;
    const cost = estTokens(head + d.text);
    if (used + cost > CORPUS_MAX_TOKENS) { dropped.push(d.name); continue; }
    parts.push(head + d.text);
    used += cost; included++;
  }
  return { text: parts.join(''), tokens: used, included, dropped, total: clean.length };
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

function requestBody(cat, corpusText, { warm = false } = {}) {
  return {
    model: MODEL,
    // Pre-warm writes the cache without generating anything (§6, trap 3).
    max_tokens: warm ? 0 : 1500,
    speed: 'fast',
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

async function callClaude(body, apiKey) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': FAST_BETA,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`anthropic_${resp.status}`);
    err.status = resp.status;
    err.retryAfter = Number(resp.headers.get('retry-after')) || null;
    err.detail = detail.slice(0, 400);
    throw err;
  }
  return resp.json();
}

/**
 * Warm the cache, once, BEFORE any fan-out. 21 simultaneous calls all start before any has finished
 * writing the cache, so all 21 would miss and the run would cost ~5× its budget (§6, trap 3).
 * Returns the usage so the caller can assert the write actually happened.
 */
async function warmCache(corpusText, apiKey) {
  const out = await callClaude(requestBody(null, corpusText, { warm: true }), apiKey);
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
async function probeCategory(cat, corpusText, apiKey) {
  const body = requestBody(cat, corpusText);
  const settled = await Promise.allSettled(
    Array.from({ length: DRAWS }, () => callClaude(body, apiKey))
  );
  const draws = [], errors = [];
  let cacheRead = 0, cacheWrite = 0, outTokens = 0, speed = null;
  for (const r of settled) {
    if (r.status === 'rejected') { errors.push({ status: r.reason.status, detail: r.reason.detail, retryAfter: r.reason.retryAfter }); continue; }
    const m = r.value, u = m.usage || {};
    cacheRead += u.cache_read_input_tokens || 0;
    cacheWrite += u.cache_creation_input_tokens || 0;
    outTokens += u.output_tokens || 0;
    speed = u.speed || speed;
    // A refusal or a max_tokens cut is NOT a draw. Counting it would publish a median over partial data.
    if (m.stop_reason === 'refusal' || m.stop_reason === 'max_tokens') {
      errors.push({ status: 200, detail: 'stop_reason=' + m.stop_reason });
      continue;
    }
    const text = (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    try { draws.push(JSON.parse(text).signals || []); }
    catch (e) { errors.push({ status: 200, detail: 'unparseable json' }); }
  }
  return { key: cat.key, draws, errors, usage: { cacheRead, cacheWrite, outTokens, speed } };
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
  MODEL, FAST_BETA, DRAWS, PAR, MAX_PER_SIGNAL, CORPUS_MAX_TOKENS,
  estTokens, buildCorpus, systemBlock, categoryPrompt, schemaFor, requestBody,
  warmCache, probeCategory, medianOf, consolidate, composeRange, bandOf, rangeBand, BAND_ORDER,
};
