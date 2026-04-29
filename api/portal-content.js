/**
 * GET /api/portal-content?hub=research&section=market-analysis
 *
 * Fetches the markdown file from the engagement repo via GitHub API, returns
 * { ok, markdown, name, hub, section }. Renders client-side (browser does
 * markdown→HTML via a tiny renderer in portal-app.html).
 *
 * Investor scope: blocks any hub other than financials, blocks the
 * scope-change-recommendations section (operator-only).
 */

const { loadClients, requireAuth, ghReadFile, HUBS } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  // Vercel parses query into req.query; fall back if not
  const url = new URL(req.url, `https://${req.headers.host}`);
  const hubSlug = url.searchParams.get('hub');
  const sectionSlug = url.searchParams.get('section');

  if (!hubSlug || !sectionSlug) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_hub_or_section' }));
    return;
  }

  // Investor-scope guard: only financials, and not scope-change-recommendations
  if (auth.scope === 'investor') {
    if (hubSlug !== 'financials' || sectionSlug === 'scope-change-recommendations') {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'forbidden_scope' }));
      return;
    }
  }

  const hub = HUBS.find(h => h.slug === hubSlug);
  if (!hub) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'hub_not_found' }));
    return;
  }
  const section = hub.sections.find(s => s.slug === sectionSlug);
  if (!section) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'section_not_found' }));
    return;
  }

  const clients = loadClients();
  const client = clients[auth.slug];
  if (!client || !client.repo) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'client_repo_not_configured' }));
    return;
  }

  const path = section.file.startsWith('../')
    ? section.file.replace('../', '')
    : `${hub.dir}/${section.file}`;

  try {
    const markdown = await ghReadFile(client.repo, client.branch || 'main', path);
    if (markdown === null) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'file_not_found_in_repo', path }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.end(JSON.stringify({
      ok: true,
      hub: { slug: hub.slug, name: hub.name },
      section: { slug: section.slug, name: section.name },
      path,
      markdown,
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'github_fetch_failed', detail: e.message }));
  }
};
