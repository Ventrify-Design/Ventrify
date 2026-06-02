/**
 * GET /api/portal-figma-binary?hub=figma
 *
 * Streams the Figma source file (.fig, .zip, .sketch, or .xd) committed
 * under design/ in the engagement repo for any `figma-deliverable` hub.
 *
 * Mirrors portal-pdf-binary's auth + streaming pattern. The exact path is
 * resolved per-request via listFigmaFile so operators can ship any of the
 * supported formats without having to update the hub config.
 */

'use strict';

const {
  loadClients,
  requireAuth,
  ghReadBinaryFile,
  listFigmaFile,
  HUBS,
} = require('./_lib');

// Per-extension content-type — drives the browser's open/save behaviour.
const CONTENT_TYPES = {
  fig: 'application/octet-stream',
  zip: 'application/zip',
  sketch: 'application/octet-stream',
  xd: 'application/octet-stream',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  const url = new URL(req.url, `https://${req.headers.host}`);
  const hubSlug = url.searchParams.get('hub');

  if (!hubSlug) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_hub' }));
    return;
  }

  const hub = HUBS.find((h) => h.slug === hubSlug);
  if (!hub || hub.surfaceType !== 'figma-deliverable' || !hub.figmaFileDir || !hub.figmaFileBaseName) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'hub_not_found_or_not_figma' }));
    return;
  }

  // Investors don't typically need the editable Figma source. Block scope
  // unless we explicitly relax this later. The embedded preview is still
  // visible to them via the URL field.
  if (auth.scope === 'investor') {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden_scope' }));
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

  const branch = client.branch || 'main';

  let file;
  try {
    file = await listFigmaFile(client.repo, branch, hub.figmaFileDir, hub.figmaFileBaseName);
  } catch (e) {
    console.error('[portal-figma-binary] listFigmaFile failed:', e.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'list_failed' }));
    return;
  }
  if (!file) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'figma_file_not_found' }));
    return;
  }

  try {
    const binary = await ghReadBinaryFile(client.repo, branch, file.path);
    if (!binary) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'binary_read_failed', path: file.path }));
      return;
    }
    const buffer = binary.buffer;
    res.statusCode = 200;
    res.setHeader('Content-Type', CONTENT_TYPES[file.ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(buffer);
  } catch (e) {
    console.error('[portal-figma-binary]', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'stream_failed' }));
  }
};
