/**
 * POST /api/portal-feedback
 * Body: { hub, section, rating, comment, name?, email? }
 *   - rating: 'looks-good' | 'has-feedback' | 'needs-rework'
 *
 * Two side effects:
 *   1. Sends email to OPERATOR_EMAIL via web3forms (always)
 *   2. If GITHUB_TOKEN is set, appends to portal-feedback.json in the
 *      engagement repo (preserves a versioned audit trail)
 */

const { loadClients, requireAuth, readJsonBody, ghReadFile, ghCommitFile, sendEmail, HUBS } = require('./_lib');

const VALID_RATINGS = ['looks-good', 'has-feedback', 'needs-rework'];

const RATING_LABELS = {
  'looks-good': '👍 Looks good',
  'has-feedback': '⚠️ Has feedback',
  'needs-rework': '🚫 Needs rework',
};

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

  const { hub: hubSlug, section: sectionSlug, rating, comment, name, email } = body;

  if (!hubSlug || !sectionSlug || !rating) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_fields' }));
    return;
  }
  if (!VALID_RATINGS.includes(rating)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_rating' }));
    return;
  }

  const hub = HUBS.find(h => h.slug === hubSlug);
  const section = hub && hub.sections.find(s => s.slug === sectionSlug);
  if (!hub || !section) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'unknown_hub_or_section' }));
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
  const id = `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const feedback = {
    id,
    submittedAt,
    submittedBy: name || null,
    submittedEmail: email || null,
    scope: auth.scope,
    hub: hubSlug,
    hubName: hub.name,
    section: sectionSlug,
    sectionName: section.name,
    rating,
    ratingLabel: RATING_LABELS[rating],
    comment: comment || '',
    status: 'open',
    addressedAt: null,
    addressedNote: null,
  };

  // ── 1. Email the operator (best-effort — failure shouldn't break the flow) ──
  let emailResult = { ok: false, status: 0, response: 'not-attempted' };
  try {
    const subject = `[Portal Feedback] ${client.name || auth.slug} · ${hub.name} → ${section.name}`;
    const lines = [
      `Project: ${client.name || auth.slug}`,
      `Hub: ${hub.name}  ·  Section: ${section.name}`,
      `Rating: ${RATING_LABELS[rating]}`,
      `Submitted by: ${name || '(anonymous)'}${email ? ' <' + email + '>' : ''}`,
      `Scope: ${auth.scope}`,
      `Submitted: ${submittedAt}`,
      '',
      'Comment:',
      comment || '(no comment)',
      '',
      `View source: https://github.com/${client.repo}/blob/${client.branch || 'main'}/${section.file.startsWith('../') ? section.file.replace('../', '') : hub.dir + '/' + section.file}`,
      `Feedback ID: ${id}`,
    ];
    emailResult = await sendEmail({
      subject,
      body: lines.join('\n'),
      replyTo: email || undefined,
    });
  } catch (e) {
    console.error('[portal-feedback] email threw:', e.message);
    emailResult = { ok: false, status: 0, response: { error: e.message } };
  }

  // ── 2. Commit to engagement repo (only if GITHUB_TOKEN available) ──────────
  let committed = false;
  let commitError = null;
  if (process.env.GITHUB_TOKEN) {
    try {
      const filePath = 'portal-feedback.json';
      const existing = await ghReadFile(client.repo, client.branch || 'main', filePath);
      const log = existing ? JSON.parse(existing) : { version: 1, feedback: [], signOffs: {} };
      if (!Array.isArray(log.feedback)) log.feedback = [];
      log.feedback.push(feedback);
      log.lastUpdated = submittedAt;
      const message = `portal feedback · ${hub.name} → ${section.name} · ${RATING_LABELS[rating]}`;
      await ghCommitFile(client.repo, client.branch || 'main', filePath, JSON.stringify(log, null, 2) + '\n', message);
      committed = true;
    } catch (e) {
      commitError = e.message;
      console.error('[portal-feedback] commit failed:', e.message);
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    id,
    emailSent: emailResult.ok,
    emailStatus: emailResult.status,
    emailResponse: emailResult.response, // surface for debugging in browser DevTools
    committed,
    commitError,
  }));
};
