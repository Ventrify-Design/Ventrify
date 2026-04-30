/**
 * POST /api/portal-signoff
 * Body: { hub, name, email?, confirmation: true }
 *
 * Captures Gate sign-off (Gate 1, Gate 2, Gate 2.5). Same dual-side-effect pattern
 * as portal-feedback: emails operator + optionally commits to engagement repo.
 *
 * Investor scope cannot sign off (only the client owner can).
 */

const { loadClients, requireAuth, readJsonBody, ghReadFile, ghCommitFile, buildEmailPayload, HUBS } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  // Sign-off is client-scope only — investors cannot sign off
  const auth = requireAuth(req, res, { minScope: 'client' });
  if (!auth) return;

  let body;
  try { body = await readJsonBody(req); }
  catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
    return;
  }

  const { hub: hubSlug, name, email, confirmation } = body;
  if (!hubSlug || !name || !confirmation) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_fields' }));
    return;
  }

  const hub = HUBS.find(h => h.slug === hubSlug);
  if (!hub || !hub.gate) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'unknown_or_ungated_hub' }));
    return;
  }

  const clients = loadClients();
  const client = clients[auth.slug];
  if (!client) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'client_not_configured' }));
    return;
  }

  const approvedAt = new Date().toISOString();
  const signOff = {
    hub: hubSlug,
    hubName: hub.name,
    gate: hub.gate,
    approvedAt,
    approvedBy: name,
    approvedEmail: email || null,
  };

  // ── 1. Build the email payload — browser sends to web3forms client-side ──
  const subject = `[Portal Sign-off] ${client.name || auth.slug} · ${hub.gate} approved`;
  const lines = [
    `Project: ${client.name || auth.slug}`,
    `Gate: ${hub.gate} (${hub.name})`,
    `Approved by: ${name}${email ? ' <' + email + '>' : ''}`,
    `Approved at: ${approvedAt}`,
    '',
    'STATUS.md should now show this gate as Approved.',
    'If GITHUB_TOKEN is configured on Vercel, the engagement repo will reflect this sign-off in portal-feedback.json under signOffs.',
    '',
    `Engagement repo: https://github.com/${client.repo}`,
  ];
  const emailPayload = buildEmailPayload({
    subject,
    body: lines.join('\n'),
    replyTo: email || undefined,
  });

  // ── 2. Commit to engagement repo ────────────────────────────────────────
  let committed = false;
  let commitError = null;
  if (process.env.GITHUB_TOKEN) {
    try {
      const filePath = 'portal-feedback.json';
      const existing = await ghReadFile(client.repo, client.branch || 'main', filePath);
      const log = existing ? JSON.parse(existing) : { version: 1, feedback: [], signOffs: {} };
      if (!log.signOffs) log.signOffs = {};
      log.signOffs[hubSlug] = signOff;
      log.lastUpdated = approvedAt;
      const message = `portal sign-off · ${hub.gate} approved by ${name}`;
      await ghCommitFile(client.repo, client.branch || 'main', filePath, JSON.stringify(log, null, 2) + '\n', message);
      committed = true;
    } catch (e) {
      commitError = e.message;
      console.error('[portal-signoff] commit failed:', e.message);
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    gate: hub.gate,
    approvedAt,
    committed,
    commitError,
    email: emailPayload, // browser POSTs this directly to web3forms
  }));
};
