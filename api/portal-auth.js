/**
 * POST /api/portal-auth
 * Body: { code: string }
 *
 * Validates the access code against PORTAL_CLIENTS env var, sets an HMAC-signed
 * cookie, returns the client metadata + redirect target.
 *
 * Two scopes:
 *   - 'client'   — full hub access (the project owner)
 *   - 'investor' — Financials Hub only (for due-diligence sharing)
 */

const { loadClients, signToken, setCookie, readJsonBody, TOKEN_TTL_SECONDS } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
    return;
  }

  const code = (body.code || '').trim();
  if (!code) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_code' }));
    return;
  }

  const clients = loadClients();
  let match = null;
  for (const slug of Object.keys(clients)) {
    const c = clients[slug];
    if (c.clientCode && c.clientCode === code) {
      match = { slug, scope: 'client', name: c.name || slug };
      break;
    }
    if (c.investorCode && c.investorCode === code) {
      match = { slug, scope: 'investor', name: c.name || slug };
      break;
    }
  }

  if (!match) {
    // Generic error — don't reveal which slugs exist
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_code' }));
    return;
  }

  const token = signToken({
    slug: match.slug,
    scope: match.scope,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  setCookie(res, 'portal_token', token, { maxAge: TOKEN_TTL_SECONDS });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    slug: match.slug,
    scope: match.scope,
    name: match.name,
    redirectTo: '/portal-app',
  }));
};
