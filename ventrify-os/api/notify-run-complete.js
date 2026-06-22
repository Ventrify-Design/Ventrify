/**
 * POST /api/notify-run-complete — the cloud runner calls this after an
 * engagement RUN finishes, to email the operator that the result is ready.
 *
 * Secret-gated: the runner has no Firebase user token, so it presents a shared
 * secret (RUNNER_NOTIFY_SECRET, mirrored as a GitHub Actions secret on the
 * runner repo). As defence-in-depth the endpoint also re-reads the engagement
 * and only emails when runState.status === 'done', so a stray call can't
 * fabricate a "ready" notification for an unfinished run. Debounced per
 * engagement so a re-run burst can't spam inboxes.
 *
 * Body: { engagementId, phase?, secret }
 * Env: FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY, INVITE_FROM_EMAIL,
 *      RUNNER_NOTIFY_SECRET (set the SAME value here and on the runner).
 */

const admin = require('firebase-admin');

const DEBOUNCE_MS = 5 * 60 * 1000;

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function notifyHtml({ headline, sub, link }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;"><div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">Ventrify <span style="color:#9aa0ab;font-weight:500;">OS &middot; Workspace</span></div></td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">${esc(headline)}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">${esc(sub)}</p>
        <a href="${link}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Open your Workspace &rarr;</a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">This link signs you straight in &mdash; no password needed.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;margin-top:12px;border-top:1px solid rgba(0,0,0,0.06);"><p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function sendOne(email, subject, headline, sub) {
  const link = await admin.auth().generateSignInWithEmailLink(email, { url: 'https://os.ventrify.io/workspace/', handleCodeInApp: true });
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>', to: [email], subject, html: notifyHtml({ headline, sub, link }) })
  });
  return resp.ok;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const engagementId = String(body.engagementId || '').trim();
    const phase = String(body.phase || '');
    const secret = String(body.secret || '');

    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }
    if (!process.env.RUNNER_NOTIFY_SECRET) { res.status(503).json({ error: 'secret_not_configured' }); return; }
    if (secret !== process.env.RUNNER_NOTIFY_SECRET) { res.status(403).json({ error: 'forbidden' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }

    ensureAdmin();
    const db = admin.firestore();
    const engSnap = await db.collection('engagements').doc(engagementId).get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const eng = engSnap.data();
    const rs = eng.runState || {};

    // Only the genuinely-complete state earns an email. Errors / needs-attention
    // surface in the in-app action queue instead.
    if (rs.status !== 'done') { res.status(200).json({ ok: true, skipped: 'not_done' }); return; }

    const last = (eng.lastNotify && eng.lastNotify['run-complete']) ? Date.parse(eng.lastNotify['run-complete']) : 0;
    if (last && (Date.now() - last) < DEBOUNCE_MS) { res.status(200).json({ ok: true, skipped: 'debounced' }); return; }

    const orgId = eng.orgId || 'default';
    const orgSnap = await db.collection('organisations').doc(orgId).get();
    const org = orgSnap.exists ? orgSnap.data() : {};
    const operatorEmails = (org.operatorEmails || (org.ownerEmail ? [org.ownerEmail] : [])).map(e => String(e).toLowerCase());
    // Prefer the operator who triggered the run; fall back to all operators.
    const requestedBy = String(rs.requestedBy || '').toLowerCase();
    const recipients = (requestedBy && operatorEmails.includes(requestedBy)) ? [requestedBy] : operatorEmails;
    if (!recipients.length) { res.status(200).json({ ok: true, skipped: 'no_recipient' }); return; }

    const ventureName = eng.name || 'your venture';
    const isAssess = phase === 'assess' || eng.engagementType === 'assessment';
    const rec = (eng.assessment && eng.assessment.recommendation) || '';
    const pct = (eng.investability && eng.investability.pct != null) ? eng.investability.pct : null;
    const subject = isAssess ? `Your assessment for ${ventureName} is ready` : `Your ${ventureName} run is ready`;
    const headline = isAssess ? `${ventureName}: the assessment is ready` : `${ventureName}: your run finished`;
    const sub = isAssess
      ? `The assessment for ${ventureName} is complete${rec ? ` — verdict: ${rec}` : ''}${pct != null ? ` · ${pct}% investability` : ''}. Open your Workspace to review the findings and download the deal memo.`
      : `Your latest run for ${ventureName} has finished. Open your Workspace to review what landed.`;

    const results = await Promise.all(recipients.map(email => sendOne(email, subject, headline, sub).catch(() => false)));
    const sent = results.filter(Boolean).length;

    await db.collection('engagements').doc(engagementId).set({ lastNotify: { 'run-complete': new Date().toISOString() } }, { merge: true });
    res.status(200).json({ ok: true, sent });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
