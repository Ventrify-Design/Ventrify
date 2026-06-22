/**
 * POST /api/request-upgrade — an operator asks the Ventrify team to upgrade
 * their org's licence. Emails the platform super-admins via Resend (same setup
 * as send-invite), with the org, current plan, usage, and an optional note.
 *
 * The caller's Firebase ID token is verified server-side, and the org is
 * resolved from their operator membership — so the request is trustworthy and
 * can't be spoofed for another org.
 *
 * Env (os.ventrify.io Vercel project):
 *   FIREBASE_SERVICE_ACCOUNT — service-account JSON (string)
 *   RESEND_API_KEY           — Resend API key
 *   INVITE_FROM_EMAIL        — e.g. "Ventrify <hello@ventrify.io>"
 *   UPGRADE_TO_EMAIL         — optional fallback recipient (default hello@ventrify.io)
 *
 * Body: { idToken, note? }
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Licence presets — mirror workspace/plan.js (label/limits only needed here).
const SERVER_PLAN_PRESETS = {
  'one-off': { label: 'One-off assessment', capabilities: { assess: true, build: false }, limits: { assessments: 1, builds: 0 } },
  'assess':  { label: 'Assessment licence', capabilities: { assess: true, build: false }, limits: { assessments: null, builds: 0 } },
  'full':    { label: 'Full platform licence', capabilities: { assess: true, build: true }, limits: { assessments: null, builds: null } },
  'custom':  { label: 'Custom' },
};
function normLimit(v) { if (v == null || v === '' || v === 'unlimited') return null; const n = Math.floor(Number(v)); return (isNaN(n) || n < 0) ? null : n; }
function resolvePlan(org) {
  const p = org && org.plan;
  if (!p) return { preset: 'full', label: 'Full platform licence', capabilities: { assess: true, build: true }, limits: { assessments: null, builds: null } };
  const preset = p.preset || 'custom';
  if (preset !== 'custom' && SERVER_PLAN_PRESETS[preset]) {
    const d = SERVER_PLAN_PRESETS[preset];
    return { preset, label: d.label, capabilities: { ...d.capabilities }, limits: { ...d.limits } };
  }
  const c = p.capabilities || {}, l = p.limits || {};
  return { preset: 'custom', label: 'Custom', capabilities: { assess: !!c.assess, build: !!c.build }, limits: { assessments: normLimit(l.assessments), builds: normLimit(l.builds) } };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const note = String(body.note || '').slice(0, 1000);
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();

    const orgSnap = await db.collection('organisations').where('operatorEmails', 'array-contains', caller).limit(1).get();
    if (orgSnap.empty) { res.status(403).json({ error: 'not_an_operator' }); return; }
    const orgDoc = orgSnap.docs[0];
    const org = orgDoc.data();
    const orgId = orgDoc.id;
    const plan = resolvePlan(org);

    // Current usage (assessments / builds) for context in the email.
    const engs = await db.collection('engagements').where('orgId', '==', orgId).get();
    let assessUsed = 0, buildUsed = 0;
    engs.docs.forEach(d => { ((d.data().engagementType || 'build') === 'assessment') ? assessUsed++ : buildUsed++; });
    const lim = (v) => v == null ? 'unlimited' : v;
    const usageLine = [
      plan.capabilities.assess ? `Assessments: ${assessUsed} of ${lim(plan.limits.assessments)}` : null,
      plan.capabilities.build ? `MVP builds: ${buildUsed} of ${lim(plan.limits.builds)}` : null,
    ].filter(Boolean).join(' · ');

    // Recipients: platform super-admins, falling back to a configured inbox.
    const cfg = (await db.doc('app/config').get()).data() || {};
    const supers = (cfg.superAdminEmails || []).map(e => String(e).trim()).filter(Boolean);
    const to = supers.length ? supers : [process.env.UPGRADE_TO_EMAIL || 'hello@ventrify.io'];

    const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
          <tr><td style="padding:26px 32px 0;"><div style="font-weight:700;font-size:14px;color:#0036FF;">Ventrify OS <span style="color:#9aa0ab;font-weight:500;">· upgrade request</span></div></td></tr>
          <tr><td style="padding:16px 32px 24px;">
            <h1 style="margin:0 0 14px;font-size:20px;letter-spacing:-0.02em;">${esc(org.name || orgId)} wants to upgrade</h1>
            <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7;color:#333;">
              <tr><td style="color:#8a8f98;padding-right:14px;">Organisation</td><td><strong>${esc(org.name || '—')}</strong> <span style="color:#aab0b8;">(${esc(orgId)})</span></td></tr>
              <tr><td style="color:#8a8f98;padding-right:14px;">Requested by</td><td>${esc(caller)}</td></tr>
              <tr><td style="color:#8a8f98;padding-right:14px;">Current plan</td><td>${esc(plan.label)}</td></tr>
              <tr><td style="color:#8a8f98;padding-right:14px;vertical-align:top;">Usage</td><td>${esc(usageLine || '—')}</td></tr>
            </table>
            ${note ? `<div style="margin-top:16px;padding:12px 14px;background:#f4f5f7;border-radius:10px;font-size:14px;line-height:1.6;color:#333;"><strong>Note:</strong> ${esc(note)}</div>` : ''}
            <p style="margin:20px 0 0;font-size:13px;color:#8a8f98;">Reply to this email to reach ${esc(caller)} directly, or set their plan in Platform admin.</p>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
        to,
        reply_to: caller,
        subject: `Upgrade request — ${org.name || orgId}`,
        html,
      })
    });
    if (!resp.ok) { const detail = await resp.text(); res.status(502).json({ error: 'send_failed', detail }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
