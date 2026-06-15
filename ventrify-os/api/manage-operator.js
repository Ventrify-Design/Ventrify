/**
 * POST /api/manage-operator — add or remove an operator on an org (operator-only).
 *
 * Operators are the list organisations/{orgId}.operatorEmails — the multi-tenant
 * boundary (findOperatorOrg resolves an operator's org from it). Any operator of
 * the org may manage the team (verified against operatorEmails). On add we also
 * email a branded one-click Workspace sign-in link (Firebase magic link + Resend),
 * so the new operator can log straight in. Email is best-effort — access is granted
 * the moment the email lands in operatorEmails regardless.
 *
 * Body: { idToken, orgId, action: 'add' | 'remove', email }
 * Env: FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY?, INVITE_FROM_EMAIL?
 */
const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function operatorInviteHtml({ orgName, link }) {
  const org = esc(orgName);
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;"><div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">${org} <span style="color:#9aa0ab;font-weight:500;">Workspace</span></div></td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">You've been added as an operator</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">You now have operator access to the <strong>${org}</strong> Workspace on Ventrify OS — the same view your teammates use to run venture engagements. Click below to sign in. No password needed.</p>
        <a href="${link}" style="display:inline-block;background:#0036FF;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Open the Workspace &rarr;</a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">This link signs you in and expires soon for security. If you weren't expecting this, you can safely ignore it.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;border-top:1px solid rgba(0,0,0,0.06);"><p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const orgId = String(body.orgId || '').trim();
    const action = String(body.action || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!orgId) { res.status(400).json({ error: 'org_required' }); return; }
    if (action !== 'add' && action !== 'remove') { res.status(400).json({ error: 'bad_action' }); return; }
    if (!isEmail(email)) { res.status(400).json({ error: 'bad_email' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const ref = db.collection('organisations').doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).json({ error: 'org_not_found' }); return; }
    const org = snap.data();
    const ops = (org.operatorEmails || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    let emailSent = false;
    if (action === 'add') {
      if (ops.includes(email)) { res.status(409).json({ error: 'already_operator' }); return; }
      await ref.update({ operatorEmails: FieldValue.arrayUnion(email), updatedAt: FieldValue.serverTimestamp() });
      // Best-effort branded magic-link invite into the Workspace.
      if (process.env.RESEND_API_KEY) {
        try {
          const link = await admin.auth().generateSignInWithEmailLink(email, { url: 'https://os.ventrify.io/workspace/', handleCodeInApp: true });
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
              to: [email], subject: `You've been added to the ${org.name || 'Ventrify'} Workspace`,
              html: operatorInviteHtml({ orgName: org.name || 'Ventrify', link })
            })
          });
          emailSent = r.ok;
        } catch (e) { /* access still granted; email is best-effort */ }
      }
    } else {
      if (!ops.includes(email)) { res.status(404).json({ error: 'not_an_operator' }); return; }
      if (ops.length <= 1) { res.status(409).json({ error: 'last_operator' }); return; }   // never orphan the org
      await ref.update({ operatorEmails: FieldValue.arrayRemove(email), updatedAt: FieldValue.serverTimestamp() });
    }

    const after = (await ref.get()).data();
    res.status(200).json({ ok: true, emailSent, operatorEmails: after.operatorEmails || [] });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
