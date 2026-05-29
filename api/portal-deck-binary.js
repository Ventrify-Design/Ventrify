/**
 * GET /api/portal-deck-binary?hub=investor-deck&version=3&format=pdf
 *
 * Fetches a binary deck file (.pptx or .pdf) from the engagement repo and
 * streams it back with the right Content-Type so the browser can either
 * (a) preview it inline (.pdf in an iframe) or (b) trigger a download (.pptx
 * via window.location = api URL).
 *
 * Investor scope: investor-deck is investor-readable by default since the
 * pitch is what the round is built around — this matches the existing
 * Financials Hub investor-share pattern.
 */

const { loadClients, requireAuth, ghReadBinaryFile, HUBS } = require('./_lib');

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
  const versionStr = url.searchParams.get('version');
  const format = (url.searchParams.get('format') || 'pdf').toLowerCase();

  if (!hubSlug || !versionStr) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_hub_or_version' }));
    return;
  }
  if (!['pdf', 'pptx'].includes(format)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_format' }));
    return;
  }
  const version = parseInt(versionStr, 10);
  if (!Number.isFinite(version) || version < 1) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_version' }));
    return;
  }

  const hub = HUBS.find(h => h.slug === hubSlug);
  if (!hub || hub.surfaceType !== 'deck-deliverable') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'hub_not_found_or_not_deck' }));
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

  // File pattern: <slug>-<deckBaseName>-v<N>.<format>
  const filename = `${auth.slug}-${hub.deckBaseName}-v${version}.${format}`;
  const path = `${hub.deckDir}/${filename}`;

  try {
    const binary = await ghReadBinaryFile(client.repo, client.branch || 'main', path);
    if (!binary) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'file_not_found', path }));
      return;
    }

    const buffer = Buffer.from(binary.base64, 'base64');
    const contentType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    // For .pptx (download), suggest a filename. For .pdf, render inline.
    const disposition = format === 'pptx'
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(buffer);
  } catch (e) {
    console.error('[portal-deck-binary]', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'github_fetch_failed', detail: e.message }));
  }
};
