/**
 * POST /api/send-login-link — send a BRANDED self sign-in link via Resend.
 *
 * Same mechanism as /api/send-invite, but for someone signing THEMSELVES in
 * (operator → Workspace, founder → Studio). Routing login through Resend + the
 * Admin SDK (generateSignInWithEmailLink mints, doesn't send) sidesteps
 * Firebase's built-in email-send DAILY QUOTA — the `auth/quota-exceeded` that
 * heavy testing keeps hitting. No Firebase email send = no quota.
 *
 * Body: { email, continueUrl, surface? }   surface: "Workspace" | "Studio"
 * Env (os.ventrify.io Vercel project):
 *   FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY, INVITE_FROM_EMAIL
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loginHtml({ surface, link }) {
  const s = esc(surface || 'Workspace');
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">Ventrify <span style="color:#9aa0ab;font-weight:500;">OS &middot; ${s}</span></div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">Sign in to your ${s}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">Click below to sign in to your Ventrify OS ${s}. No password needed.</p>
        <a href="${link}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Open your ${s} &rarr;</a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">This link signs you in and expires soon for security. If you didn't request it, you can safely ignore this email.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;margin-top:12px;border-top:1px solid rgba(0,0,0,0.06);">
        <p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) { res.status(400).json({ error: 'email_required' }); return; }
    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }

    const surface = (body.surface === 'Studio') ? 'Studio' : 'Workspace';
    const continueUrl = body.continueUrl || ('https://os.ventrify.io/' + (surface === 'Studio' ? 'studio' : 'workspace') + '/');

    ensureAdmin();
    const link = await admin.auth().generateSignInWithEmailLink(email, { url: continueUrl, handleCodeInApp: true });

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
        to: [email],
        subject: `Your Ventrify ${surface} sign-in link`,
        html: loginHtml({ surface, link })
      })
    });
    if (!resp.ok) { const detail = await resp.text(); res.status(502).json({ error: 'send_failed', detail }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
