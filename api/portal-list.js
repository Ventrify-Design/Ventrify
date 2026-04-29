/**
 * GET /api/portal-list
 *
 * Returns the hub + section catalogue + sign-off + feedback status for the
 * authenticated client. The portal-app.html consumes this to render the
 * landing page.
 *
 * For investor scope, only the Financials hub is returned (sensitive sections
 * like scope-change-recommendations.md are filtered out).
 */

const { loadClients, requireAuth, ghFetch, hubsForScope } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  const clients = loadClients();
  const client = clients[auth.slug];
  if (!client) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'client_not_found' }));
    return;
  }

  const hubs = hubsForScope(auth.scope);
  const repo = client.repo;
  const branch = client.branch || 'main';

  // For each hub/section, just check existence (lightweight) — content fetch
  // happens on-demand when a section is opened. We don't pre-fetch wordcounts
  // (saves dozens of GitHub API calls per page-load).
  const hubData = await Promise.all(hubs.map(async (hub) => {
    const sections = await Promise.all(hub.sections.map(async (s) => {
      const path = s.file.startsWith('../')
        ? s.file.replace('../', '')              // e.g. ../design/IA.md → design/IA.md
        : `${hub.dir}/${s.file}`;
      const exists = await ghFetch(repo, branch, path).then(r => !!r).catch(() => false);
      return {
        slug: s.slug,
        name: s.name,
        path,
        exists,
      };
    }));
    return {
      slug: hub.slug,
      name: hub.name,
      gate: hub.gate,
      sections,
    };
  }));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=60'); // 60s cache
  res.end(JSON.stringify({
    ok: true,
    client: {
      slug: auth.slug,
      name: client.name,
      scope: auth.scope,
      tier: client.tier || null,
      oneLiner: client.oneLiner || null,
    },
    hubs: hubData,
  }));
};
