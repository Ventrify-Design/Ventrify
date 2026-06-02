/**
 * GET /api/portal-pdf-binary?hub=sow
 *
 * Streams the single PDF binary backing a `pdf-binary` surface hub
 * (Foundations: SOW, Welcome Pack). Mirrors portal-deck-binary's auth +
 * streaming pattern but simpler — no version, no .pptx companion, just
 * the one PDF the operator generates and pushes.
 *
 * The actual file path is resolved per-request via listSinglePdf so
 * client-slug-prefixed names like `moneygym-sow.pdf` work without
 * hard-coding the slug into the URL.
 */

'use strict';

const {
  loadClients,
  requireAuth,
  ghReadBinaryFile,
  listSinglePdf,
  HUBS,
} = require('./_lib');

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
  const download = url.searchParams.get('download') === '1';

  if (!hubSlug) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_hub' }));
    return;
  }

  const hub = HUBS.find((h) => h.slug === hubSlug);
  if (!hub || hub.surfaceType !== 'pdf-binary' || !hub.pdfDir || !hub.pdfBaseName) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'hub_not_found_or_not_pdf_binary' }));
    return;
  }

  // Investor scope: SOW + Welcome Pack are operator/client-only. Investors
  // get the Financials Hub + Investor Pitch Deck (covered by other endpoints).
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

  let pdf;
  try {
    pdf = await listSinglePdf(client.repo, branch, hub.pdfDir, hub.pdfBaseName);
  } catch (e) {
    console.error('[portal-pdf-binary] listSinglePdf failed:', e.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'list_failed' }));
    return;
  }
  if (!pdf) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'pdf_not_found' }));
    return;
  }

  try {
    const binary = await ghReadBinaryFile(client.repo, branch, pdf.path);
    if (!binary) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'binary_read_failed', path: pdf.path }));
      return;
    }
    const buffer = binary.buffer;
    const disposition = download
      ? `attachment; filename="${pdf.name}"`
      : `inline; filename="${pdf.name}"`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(buffer);
  } catch (e) {
    console.error('[portal-pdf-binary]', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'stream_failed' }));
  }
};
