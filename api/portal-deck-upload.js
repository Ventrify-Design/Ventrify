/**
 * POST /api/portal-deck-upload
 * Body: { hub: 'investor-deck', filename, base64 }
 *
 * Accepts a base64-encoded .pptx, commits it to the engagement repo as the
 * NEXT version (auto-derived from existing files in decks/). Returns the
 * new version number.
 *
 * Investor scope is blocked from upload — only the client (full-scope) can
 * push an edited deck. Operators publishing the deck use the CLI generator.
 *
 * Implementation note: GitHub's contents API has a ~100MB per-file limit and
 * Vercel has a per-request body cap (~4.5MB on hobby). Decks built from this
 * template are ~3MB so we're well inside both. If a deck exceeds ~4MB we
 * fail fast with a clear error rather than silently truncating.
 */

const {
  loadClients,
  requireAuth,
  readJsonBody,
  ghCommitFile,
  ghReadBinaryFile,
  listDeckVersions,
  HUBS,
} = require('./_lib');

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB — comfortably inside Vercel hobby
const PPTX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // 'PK\3\4' (zip)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;
  if (auth.scope === 'investor') {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'investor_cannot_upload' }));
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

  const { hub: hubSlug, filename, base64 } = body;
  if (!hubSlug || !base64) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_fields' }));
    return;
  }

  const hub = HUBS.find(h => h.slug === hubSlug);
  if (!hub || hub.surfaceType !== 'deck-deliverable') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'hub_not_found_or_not_deck' }));
    return;
  }

  // Decode + sanity-check the binary
  let buffer;
  try {
    buffer = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64');
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_base64' }));
    return;
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    res.statusCode = 413;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'file_too_large', max_bytes: MAX_UPLOAD_BYTES }));
    return;
  }
  // .pptx is a zip file — verify the PK\3\4 magic to reject non-zips
  if (!buffer.slice(0, 4).equals(PPTX_MAGIC)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'not_a_pptx_file' }));
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
  if (!process.env.GITHUB_TOKEN) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'github_token_not_configured' }));
    return;
  }

  // Determine next version by scanning existing files
  const branch = client.branch || 'main';
  const { latest } = await listDeckVersions(client.repo, branch, hub.deckDir, hub.deckBaseName);
  const nextVersion = latest ? latest.version + 1 : 1;
  const newFilename = `${auth.slug}-${hub.deckBaseName}-v${nextVersion}.pptx`;
  const path = `${hub.deckDir}/${newFilename}`;

  // Commit. ghCommitFile expects utf8 in its current shape; we need a binary
  // path. Do the base64 encoding inline using the contents API directly so
  // we don't double-encode.
  try {
    const url = `https://api.github.com/repos/${client.repo}/contents/${encodeURIComponent(path)}`;
    const commitBody = {
      message: `portal upload · investor deck v${nextVersion}${filename ? ` (uploaded as ${filename})` : ''}`,
      content: buffer.toString('base64'),
      branch,
      committer: { name: 'Ventrify Portal', email: 'portal@ventrify.io' },
    };
    const ghRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'User-Agent': 'Ventrify-Portal',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitBody),
    });
    if (!ghRes.ok) {
      const detail = await ghRes.text();
      console.error('[portal-deck-upload] github commit failed:', ghRes.status, detail);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'github_commit_failed', status: ghRes.status }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      version: nextVersion,
      filename: newFilename,
      path,
      size: buffer.length,
      _note: 'Uploaded .pptx committed. PDF preview for this version requires running the local generator (or a future server-side LibreOffice conversion).',
    }));
  } catch (e) {
    console.error('[portal-deck-upload]', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'upload_failed', detail: e.message }));
  }
};
