/**
 * GET /api/sentiment-score
 *
 * Returns the headline Venture Sentiment Score (v2: TDK-style 7 categories ×
 * 5 sub-criteria, total /35) + per-category breakdown + Engagement
 * Completeness sub-meter + Coach recommendations for the Investability tab
 * on the portal.
 *
 * INPUTS (read in parallel from the engagement GitHub repo)
 *   1. /sentiment/score.md           — operator-authored YAML frontmatter (v2)
 *   2. /api/sentiment-signals        — Engagement Completeness signals (inline call)
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
 *   • Operator / client scope → full payload.
 *   • Investor scope → 403 for v1. Investor rollout is a follow-up.
 *
 * FAILURE MODES
 *   • score.md missing → returns { state: 'not-yet-rated' } with HTTP 200.
 *   • Invalid score.md → returns { state: 'invalid', errors: [...] }.
 */

'use strict';

const {
  requireAuth,
  loadClients,
  ghReadFile,
} = require('./_lib');
const { computeComposite } = require('../tools/sentiment/compute');
const { validate } = require('../tools/sentiment/validate');

// ── score.md YAML parser (v2) ──────────────────────────────────────────────
// v2 shape:
//   ---
//   version: 2
//   profile: seed
//   ratedBy: "Antony Whenman"
//   ratedAt: 2026-06-01T10:00:00Z
//   categories:
//     market:
//       market_size:
//         score: 1
//         note: "TAM well above $1B with credible penetration."
//         ref: research/market-analysis.md:18
//       ...
//   ---
//
// Indent levels (2-space): 0 = top key, 2 = category name, 4 = sub-criterion
// slug, 6 = field (score/note/ref). Tolerates `null`, integers, floats,
// 0.5, ISO datetimes, double-quoted strings. Inline scalars on a category
// or sub-criterion line are an error (each must open a nested block).

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
  let topKey = null;     // current top-level open block (`categories`)
  let catKey = null;     // current category name
  let subKey = null;     // current sub-criterion slug

  for (const rawLine of fmRaw.split('\n')) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();

    if (indent === 0) {
      if (value === '') {
        out[key] = {};
        topKey = key;
        catKey = null;
        subKey = null;
      } else {
        out[key] = parseScalar(value);
        topKey = null;
        catKey = null;
        subKey = null;
      }
    } else if (indent === 2 && topKey === 'categories') {
      // Category name
      if (value !== '') {
        throw new Error(`category "${key}" must open a nested block, not inline value`);
      }
      out.categories[key] = {};
      catKey = key;
      subKey = null;
    } else if (indent === 4 && topKey === 'categories' && catKey) {
      // Sub-criterion slug
      if (value !== '') {
        throw new Error(`sub-criterion "${catKey}.${key}" must open a nested block`);
      }
      out.categories[catKey][key] = {};
      subKey = key;
    } else if (indent === 6 && topKey === 'categories' && catKey && subKey) {
      // Field on a sub-criterion (score / note / ref)
      out.categories[catKey][subKey][key] = parseScalar(value);
    }
    // Unrecognised indent levels are silently ignored — the validator
    // will catch missing fields downstream.
  }
  return out;
}

function parseScalar(value) {
  if (value === '' || value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  const dq = value.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (dq) return dq[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const sq = value.match(/^'((?:[^'\\]|\\.)*)'$/);
  if (sq) return sq[1].replace(/\\'/g, "'");
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

  // Investors do not see the Sentiment Score in v1. Per-investor rollout TBD.
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
      engagementCompleteness: signals?.completeness ?? null,
      engagementBreakdown: signals?.breakdown ?? null,
    }));
    return;
  }

  // ── Parse + validate ──────────────────────────────────────────────────
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
  const result = computeComposite(parsed);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.end(JSON.stringify({
    ok: true,
    state: 'rated',
    score: {
      composite: result.composite,
      maxComposite: result.maxComposite,
      band: result.band,
      bandLabel: result.bandLabel,
      profile: parsed.profile,
      ratedBy: parsed.ratedBy,
      ratedAt: parsed.ratedAt,
      rated: result.rated,
      pending: result.pending,
    },
    categories: result.categories,
    deficiencies: result.deficiencies,
    warnings: validation.warnings,
    engagementCompleteness: signals?.completeness ?? null,
    engagementBreakdown: signals?.breakdown ?? null,
    recommendations: recsRaw || null,
  }));
};

// Exposed for the operator-side CLI tools (validate / rate / coach) so they
// share one parser with the API layer.
module.exports.parseScoreFrontmatter = parseScoreFrontmatter;

// Inline call to the sentiment-signals endpoint (avoids HTTP round-trip).
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
