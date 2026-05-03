/**
 * POST /api/portal-provocation
 * Body: { hub, cardId, kind: 'comment'|'acknowledge', comment?, name?, email? }
 *
 * Founder input on a Provocation Card (L1 layer of the data-room model —
 * see `.claude/memory/reference_data_room_rules.md` in the engagement repo
 * for the protected ruleset).
 *
 * Two side effects mirror the existing portal-feedback flow:
 *   1. Builds an email payload — BROWSER sends it (web3forms blocks
 *      server-side submissions on the free plan)
 *   2. If GITHUB_TOKEN is set, appends to portal-feedback.json under
 *      `provocationComments[]` (separate from the legacy `feedback[]`
 *      array so the audit trails don't tangle)
 */

const { loadClients, requireAuth, readJsonBody, ghReadFile, ghCommitFile, buildEmailPayload, HUBS } = require('./_lib');

const VALID_KINDS = ['comment', 'acknowledge'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  let body;
  try { body = await readJsonBody(req); }
  catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
    return;
  }

  const { hub: hubSlug, cardId, kind, comment, name, email } = body;

  if (!hubSlug || !cardId || !kind) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_fields' }));
    return;
  }
  if (!VALID_KINDS.includes(kind)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_kind' }));
    return;
  }
  if (kind === 'comment' && !comment) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'comment_required' }));
    return;
  }

  const hub = HUBS.find(h => h.slug === hubSlug);
  if (!hub) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'unknown_hub' }));
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

  const submittedAt = new Date().toISOString();
  const entryId = `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const entry = {
    id: entryId,
    submittedAt,
    submittedBy: name || null,
    submittedEmail: email || null,
    scope: auth.scope,
    hub: hubSlug,
    hubName: hub.name,
    cardId,
    kind,
    comment: kind === 'comment' ? comment : null,
  };

  // ── Email — browser sends this to web3forms ─────────────────────────────
  const kindLabel = kind === 'comment' ? '💬 Comment' : '✓ Acknowledged';
  const subject = `[Portal Provocation] ${client.name || auth.slug} · ${hub.name} → ${cardId}`;
  const lines = [
    `Project: ${client.name || auth.slug}`,
    `Hub: ${hub.name}  ·  Card: ${cardId}`,
    `Type: ${kindLabel}`,
    `Submitted by: ${name || '(anonymous)'}${email ? ' <' + email + '>' : ''}`,
    `Scope: ${auth.scope}`,
    `Submitted: ${submittedAt}`,
    '',
  ];
  if (kind === 'comment') {
    lines.push('Comment:', comment, '');
  }
  lines.push(
    `View card: https://github.com/${client.repo}/blob/${client.branch || 'main'}/${hub.dir}/_provocations/${cardId}.md`,
    `Entry ID: ${entryId}`,
  );
  const emailPayload = buildEmailPayload({
    subject,
    body: lines.join('\n'),
    replyTo: email || undefined,
  });

  // ── Commit to engagement repo (only if GITHUB_TOKEN available) ──────────
  let committed = false;
  let commitError = null;
  if (process.env.GITHUB_TOKEN) {
    try {
      const filePath = 'portal-feedback.json';
      const existing = await ghReadFile(client.repo, client.branch || 'main', filePath);
      const log = existing
        ? JSON.parse(existing)
        : { version: 1, feedback: [], signOffs: {}, provocationComments: [] };
      if (!Array.isArray(log.provocationComments)) log.provocationComments = [];
      log.provocationComments.push(entry);
      log.lastUpdated = submittedAt;
      const message = `portal provocation · ${hub.name} → ${cardId} · ${kindLabel}`;
      await ghCommitFile(client.repo, client.branch || 'main', filePath, JSON.stringify(log, null, 2) + '\n', message);
      committed = true;
    } catch (e) {
      commitError = e.message;
      console.error('[portal-provocation] commit failed:', e.message);
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    id: entryId,
    committed,
    commitError,
    email: emailPayload, // browser POSTs this directly to web3forms
  }));
};
