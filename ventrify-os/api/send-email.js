/**
 * POST /api/send-email — branded transactional emails via Resend.
 *
 * Consolidates the former /api/send-login-link + /api/send-invite into one function
 * (dispatched by `type`) to stay within the Vercel plan's serverless-function budget.
 * The Admin SDK MINTS the Firebase email-link sign-in URL (generateSignInWithEmailLink
 * — mint, don't send); Resend SENDS it from the verified domain. This sidesteps
 * Firebase's built-in email-send DAILY QUOTA (auth/quota-exceeded) and gives full
 * branding + better deliverability.
 *
 * Body: { type, email, continueUrl?, surface?, ventureName?, orgName? }
 *   type='login'  — someone signing THEMSELVES in (operator → Workspace, founder → Studio)
 *   type='invite' — inviting a founder to their Studio
 *
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

function inviteHtml({ orgName, ventureName, link }) {
  const org = esc(orgName), venture = esc(ventureName);
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">${org} <span style="color:#9aa0ab;font-weight:500;">Studio</span></div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">You're invited to your Studio</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">${org} has set up a Studio for <strong>${venture}</strong> — your space to shape the research and direction of your venture. Click below to sign in. No password needed.</p>
        <a href="${link}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Open your Studio &rarr;</a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">This link signs you in and expires soon for security. If you weren't expecting this, you can safely ignore it.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;margin-top:12px;border-top:1px solid rgba(0,0,0,0.06);">
        <p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

function docsRequestHtml({ orgName, ventureName, operatorName, missing, extras, folderUrl, note }) {
  const org = esc(orgName), venture = esc(ventureName);
  const li = (t, sub) => `<tr><td style="padding:9px 0;border-bottom:1px solid rgba(0,0,0,0.06);"><div style="font-size:14px;font-weight:600;color:#141414;">${esc(t)}</div>${sub ? `<div style="font-size:13px;line-height:1.5;color:#6b7280;margin-top:2px;">${esc(sub)}</div>` : ''}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">${org}</div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">A few documents for the ${venture} assessment</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#444;">${esc(operatorName)} is preparing the investability assessment for <strong>${venture}</strong>. These are the things the assessment looks for that we could not find in the data room:</p>
        ${note ? `<p style="margin:0 0 18px;padding:12px 14px;background:#f4f5f7;border-radius:10px;font-size:14px;line-height:1.6;color:#333;">${esc(note)}</p>` : ''}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
          ${missing.map(m => li(m.label, m.want)).join('')}
          ${extras.map(e => li(e.label, e.why)).join('')}
        </table>
        ${folderUrl ? `<a href="${esc(folderUrl)}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Add them to the data room &rarr;</a>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">Drop them straight into the shared folder — nothing else to do. We pick them up from there.</p>` : `<p style="margin:0;font-size:14px;line-height:1.6;color:#444;">Reply to this email with the documents and we will add them.</p>`}
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">If something on this list is already in the room inside another document, just say so — nothing is being marked against you.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;border-top:1px solid rgba(0,0,0,0.06);">
        <p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

const { checkRoom } = require('./_roomcheck.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) { res.status(400).json({ error: 'email_required' }); return; }
    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }

    // ── REQUEST THE MISSING DOCUMENTS (authenticated) ───────────────────────────────────────────────
    // Unlike 'login' and 'invite' above, this type requires an ID token and proves the caller is an operator
    // of the engagement's org. It also DERIVES ITS OWN CONTENT from Firestore — the venture name, the gap
    // list and the folder link all come from the record, never from the request body. A caller can choose
    // the recipient and add a note (escaped); they cannot dictate what the email claims.
    if (body.type === 'docs-request') {
      const engagementId = String(body.engagementId || '').trim();
      if (!body.idToken || !engagementId) { res.status(400).json({ error: 'bad_request' }); return; }
      ensureAdmin();
      let decoded;
      try { decoded = await admin.auth().verifyIdToken(body.idToken); }
      catch (e) { res.status(401).json({ error: 'invalid_token' }); return; }   // say 401, not a 500 stack
      const caller = (decoded.email || '').toLowerCase();
      const db = admin.firestore();
      const engSnap = await db.collection('engagements').doc(engagementId).get();
      if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
      const eng = engSnap.data();
      const orgSnap = await db.collection('organisations').doc(eng.orgId || 'default').get();
      const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
      if (!ops.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

      const docsSnap = await db.collection('engagements').doc(engagementId).collection('founderDocs').get();
      const check = checkRoom(docsSnap.docs.map(d => ({ name: d.data().name, text: d.data().text || '' })));
      const missing = check.classes.filter(c => !c.found).map(c => ({ label: c.label, want: c.want }));
      const extras = check.strengtheners.map(e => ({ label: e.label, why: e.why }));
      if (!missing.length && !extras.length) { res.status(400).json({ error: 'nothing_missing', detail: 'The room already has everything the score looks for.' }); return; }

      const ventureName = eng.ventureName || eng.name || 'the venture';
      const orgName = (orgSnap.exists && orgSnap.data().name) || 'Ventrify';
      const folderUrl = (eng.dataRoom && eng.dataRoom.folderUrl) || '';
      const html = docsRequestHtml({ orgName, ventureName, operatorName: caller, missing, extras, folderUrl, note: String(body.note || '').slice(0, 600) });
      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
          to: [email], reply_to: caller,
          subject: `Documents needed for the ${ventureName} assessment`,
          html
        })
      });
      if (!sendResp.ok) { const detail = await sendResp.text(); res.status(502).json({ error: 'send_failed', detail: detail.slice(0, 300) }); return; }
      await db.collection('engagements').doc(engagementId).set({
        dataRoom: { ...(eng.dataRoom || {}), lastRequestAt: new Date().toISOString(), lastRequestTo: email, lastRequestBy: caller, lastRequestItems: missing.length + extras.length }
      }, { merge: true });
      res.status(200).json({ ok: true, requested: missing.length + extras.length });
      return;
    }

    // Default to 'invite' when unspecified so any legacy caller that omitted the field
    // still behaves as the old /api/send-invite did.
    const type = body.type === 'login' ? 'login' : 'invite';

    let continueUrl, subject, html;
    if (type === 'login') {
      const surface = (body.surface === 'Studio') ? 'Studio' : 'Workspace';
      continueUrl = body.continueUrl || ('https://os.ventrify.io/' + (surface === 'Studio' ? 'studio' : 'workspace') + '/');
      ensureAdmin();
      const link = await admin.auth().generateSignInWithEmailLink(email, { url: continueUrl, handleCodeInApp: true });
      subject = `Your Ventrify ${surface} sign-in link`;
      html = loginHtml({ surface, link });
    } else {
      const ventureName = body.ventureName || 'your venture';
      const orgName = body.orgName || 'Ventrify';
      continueUrl = body.continueUrl || 'https://os.ventrify.io/studio/';
      ensureAdmin();
      const link = await admin.auth().generateSignInWithEmailLink(email, { url: continueUrl, handleCodeInApp: true });
      subject = `You're invited to your ${orgName} Studio`;
      html = inviteHtml({ orgName, ventureName, link });
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
        to: [email],
        subject,
        html
      })
    });
    if (!resp.ok) { const detail = await resp.text(); res.status(502).json({ error: 'send_failed', detail }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
