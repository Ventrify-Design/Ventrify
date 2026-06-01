/**
 * GET /api/sentiment-score
 *
 * Returns the headline Venture Sentiment Score + per-dimension breakdown +
 * Diligence Readiness sub-meter + recommendation list for the Investability
 * tab on the portal.
 *
 * INPUTS (read in parallel from the engagement GitHub repo)
 *   1. /sentiment/score.md         — operator-authored YAML frontmatter
 *   2. /api/sentiment-signals      — Diligence Readiness signals (inline call)
 *   3. /sentiment/recommendations.md — Coach output (optional)
 *
 * AUTHORITY MODEL
 *   • The score is OPERATOR-AUTHORED. No LLM call happens here. The composite
 *     math (computeComposite) is deterministic and lives in tools/sentiment.
 *   • Recommendations are an OPTIONAL Coach output produced LOCALLY by the
 *     operator via `npm run sentiment:coach`. If recommendations.md is
 *     absent, the panel renders an empty state.
 *
 * SCOPE GATING
 *   • Operator / client scope → full payload (score + breakdown + diligence
 *     readiness + recommendations + rationale).
 *   • Investor scope → 403 for v1. Per the project decision: investors do
 *     not see the Sentiment Score yet — we'll roll out to investor scope
 *     in a later release with operator-controlled granularity.
 *
 * FAILURE MODES
 *   • score.md missing → returns { state: 'not-yet-rated' } with HTTP 200
 *     so the portal can render the "Sentiment Score pending — first rating
 *     at end of Phase 1" empty state.
 *   • Invalid score.md → returns { state: 'invalid', errors: [...] } so
 *     the operator can see exactly which field is malformed.
 */

'use strict';

const path = require('path');
const {
  requireAuth,
  loadClients,
  ghReadFile,
} = require('./_lib');
const { computeComposite, humanDimensionName } = require('../tools/sentiment/compute');
const { validate } = require('../tools/sentiment/validate');

// ── score.md YAML parser ────────────────────────────────────────────────────
// Dedicated parser for the well-known score.md shape — flat top-level
// scalars + the `dimensions` 2-level nested object + the `weights` 1-level
// nested object. ~50 lines, no dependencies. Tolerates `null`, integers,
// floats, ISO datetimes, and double-quoted strings. Rejects anything more
// exotic by throwing — the validator surfaces the error to the operator.

function parseScoreFrontmatter(text) {
  if (!text || !text.startsWith('---')) {
    throw new Error('score.md is missing YAML frontmatter (must start with ---)');
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    throw new Error('score.md frontmatter is not terminated with a closing ---');
  }
  const fmRaw = text.slice(3, end).trim();

  const out = {};
  let currentKey = null;        // top-level key with nested children, e.g. 'dimensions' or 'weights'
  let currentDim = null;         // dimension name when inside `dimensions:`

  for (const rawLine of fmRaw.split('\n')) {
    const line = rawLine.replace(/\s+#.*$/, ''); // strip end-of-line comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0) {
      // Top-level key
      const colon = trimmed.indexOf(':');
      if (colon === -1) continue;
      const key = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (value === '') {
        out[key] = {};
        currentKey = key;
        currentDim = null;
      } else {
        out[key] = parseScalar(value);
        currentKey = null;
        currentDim = null;
      }
    } else if (indent === 2 && currentKey) {
      // Second level — for `dimensions:`, this is a dimension name; for
      // `weights:`, this is `name: value`.
      const colon = trimmed.indexOf(':');
      if (colon === -1) continue;
      const key = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (value === '') {
        out[currentKey][key] = {};
        currentDim = key;
      } else {
        out[currentKey][key] = parseScalar(value);
        currentDim = null;
      }
    } else if (indent === 4 && currentKey && currentDim) {
      // Third level — fields inside a dimension entry: score, rationale.
      const colon = trimmed.indexOf(':');
      if (colon === -1) continue;
      const key = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      out[currentKey][currentDim][key] = parseScalar(value);
    }
  }
  return out;
}

function parseScalar(value) {
  if (value === '' || value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Integer (no decimal point)
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  // Float
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  // Double-quoted string
  const dq = value.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (dq) return dq[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  // Single-quoted string
  const sq = value.match(/^'((?:[^'\\]|\\.)*)'$/);
  if (sq) return sq[1].replace(/\\'/g, "'");
  // Unquoted string
  return value;
}

// ── Handler ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  // INVESTOR SCOPE GATE — per the v1 decision, investors do not see the
  // Sentiment Score at all. Rolling out to investor scope is a follow-up.
  if (auth.scope === 'investor') {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden_scope' }));
    return;
  }

  const clients = loadClients();
  const client = clients[auth.slug];
  if (!client) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'client_not_found' }));
    return;
  }

  const repo = client.repo;
  const branch = client.branch || 'main';

  // ── Fetch score.md, recommendations.md, and Diligence Readiness signals
  //   in parallel ──────────────────────────────────────────────────────────
  const [scoreRaw, recsRaw, signals] = await Promise.all([
    ghReadFile(repo, branch, 'sentiment/score.md').catch(() => null),
    ghReadFile(repo, branch, 'sentiment/recommendations.md').catch(() => null),
    fetchSignals(req, auth.slug).catch((e) => {
      console.error('[sentiment-score] signals fetch failed:', e.message);
      return null;
    }),
  ]);

  // ── No score.md yet → empty state ──────────────────────────────────────
  if (!scoreRaw) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.end(JSON.stringify({
      ok: true,
      state: 'not-yet-rated',
      message: 'Sentiment Score pending — first rating at end of Phase 1',
      diligenceReadiness: signals?.readiness ?? null,
      diligenceBreakdown: signals?.breakdown ?? null,
    }));
    return;
  }

  // ── Parse + validate score.md ──────────────────────────────────────────
  let parsed;
  try {
    parsed = parseScoreFrontmatter(scoreRaw);
  } catch (e) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      state: 'invalid',
      error: 'score.md frontmatter could not be parsed',
      detail: e.message,
    }));
    return;
  }

  const validation = validate(parsed);
  if (!validation.valid) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      state: 'invalid',
      error: 'score.md fails schema validation',
      errors: validation.errors,
      warnings: validation.warnings,
    }));
    return;
  }

  // ── Compute composite ──────────────────────────────────────────────────
  const composite = computeComposite(parsed);

  // ── Decorate dimensions with human-readable names + rationales ─────────
  const dimensions = Object.entries(parsed.dimensions).map(([key, value]) => ({
    key,
    name: humanDimensionName(key),
    score: value.score,
    rationale: value.rationale,
    weight: parsed.weights[key],
    pending: value.score === null || value.score === undefined,
    contribution: composite.contributions[key] || null,
    rationaleRequired: composite.rationaleRequired.includes(key),
  }));

  // ── Sort dimensions: rated descending by score, then pending at the end ─
  dimensions.sort((a, b) => {
    if (a.pending && !b.pending) return 1;
    if (!a.pending && b.pending) return -1;
    return (b.score ?? -1) - (a.score ?? -1);
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.end(JSON.stringify({
    ok: true,
    state: 'rated',
    score: {
      composite: composite.composite,
      band: composite.band,
      bandLabel: composite.bandLabel,
      hardCapTriggered: composite.hardCapTriggered,
      hardCapReason: composite.hardCapReason,
      profile: parsed.profile,
      ratedBy: parsed.ratedBy,
      ratedAt: parsed.ratedAt,
      pendingCount: composite.pendingCount,
      ratedCount: composite.ratedCount,
      rationaleRequired: composite.rationaleRequired,
    },
    dimensions,
    diligenceReadiness: signals?.readiness ?? null,
    diligenceBreakdown: signals?.breakdown ?? null,
    recommendations: recsRaw || null,
  }));
};

// ── Inline call to the sentiment-signals endpoint ──────────────────────────
// Avoids HTTP round-trip by requiring the handler directly and faking a
// req/res pair to capture the JSON output. Lower latency than fetch().
async function fetchSignals(originalReq, _slug) {
  return new Promise((resolve) => {
    let captured = '';
    const fakeRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(body) {
        captured = body;
        try {
          const json = JSON.parse(captured);
          if (json.ok) resolve(json);
          else resolve(null);
        } catch (_e) {
          resolve(null);
        }
      },
    };
    const signalsHandler = require('./sentiment-signals');
    signalsHandler({ ...originalReq, method: 'GET' }, fakeRes).catch(() => resolve(null));
  });
}
