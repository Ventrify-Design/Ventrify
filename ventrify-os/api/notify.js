/**
 * POST /api/notify — "you've got something to action" email + magic link.
 *
 * Fired when one side hands work to the other:
 *   direction:'founder'  — operator released cards → email the FOUNDER, link to Studio
 *   direction:'operator' — founder responded        → email the OPERATOR(s), link to Workspace
 *
 * Each email carries a branded note + a one-click magic sign-in link (Admin SDK +
 * Resend) straight to the right surface. Caller is verified, and a short debounce
 * (per engagement+direction) stops a burst of sends from spamming inboxes.
 *
 * Body: { idToken, engagementId, direction }
 * Env: FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY, INVITE_FROM_EMAIL (all already set)
 */

const admin = require('firebase-admin');

const DEBOUNCE_MS = 5 * 60 * 1000;

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function notifyHtml({ surface, headline, sub, link }) {
  const s = esc(surface);
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">Ventrify <span style="color:#9aa0ab;font-weight:500;">OS &middot; ${s}</span></div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">${esc(headline)}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">${esc(sub)}</p>
        <a href="${link}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Open your ${s} &rarr;</a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">This link signs you straight in &mdash; no password needed.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;margin-top:12px;border-top:1px solid rgba(0,0,0,0.06);">
        <p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

async function sendOne({ email, surface, continueUrl, subject, headline, sub }) {
  const link = await admin.auth().generateSignInWithEmailLink(email, { url: continueUrl, handleCodeInApp: true });
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
      to: [email], subject, html: notifyHtml({ surface, headline, sub, link })
    })
  });
  return resp.ok;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const direction = String(body.direction || '');
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId || !['founder', 'operator'].includes(direction)) { res.status(400).json({ error: 'bad_request' }); return; }
    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();

    const engSnap = await db.collection('engagements').doc(engagementId).get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const eng = engSnap.data();
    const ventureName = eng.name || 'your venture';
    const founderEmail = String(eng.founderEmail || '').toLowerCase();
    const founderName = eng.founderName || 'The founder';
    const orgId = eng.orgId || 'default';

    const orgSnap = await db.collection('organisations').doc(orgId).get();
    const org = orgSnap.exists ? orgSnap.data() : {};
    const operatorEmails = (org.operatorEmails || (org.ownerEmail ? [org.ownerEmail] : [])).map(e => String(e).toLowerCase());

    // Authz: you can only notify the OTHER side of an action you're entitled to do.
    if (direction === 'founder' && !operatorEmails.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }
    if (direction === 'operator' && caller !== founderEmail) { res.status(403).json({ error: 'forbidden' }); return; }

    // Debounce — skip if we already pinged this direction recently.
    const last = (eng.lastNotify && eng.lastNotify[direction]) ? Date.parse(eng.lastNotify[direction]) : 0;
    if (last && (Date.now() - last) < DEBOUNCE_MS) { res.status(200).json({ ok: true, skipped: 'debounced' }); return; }

    let recipients, surface, continueUrl, subject, headline, sub;
    if (direction === 'founder') {
      recipients = founderEmail ? [founderEmail] : [];
      surface = 'Studio';
      continueUrl = 'https://os.ventrify.io/studio/';
      subject = `New cards to review for ${ventureName}`;
      headline = "You've got new provocation cards to review";
      sub = `Your Ventrify team has shared new cards for ${ventureName}. Take a look and share your direction — your input shapes the research and strategy.`;
    } else {
      recipients = operatorEmails;
      surface = 'Workspace';
      continueUrl = 'https://os.ventrify.io/workspace/';
      subject = `${founderName} responded on ${ventureName}`;
      headline = `${founderName} has responded`;
      sub = `${founderName} left input on a provocation card for ${ventureName}. Open your Workspace to see it and keep the loop moving.`;
    }
    if (!recipients.length) { res.status(200).json({ ok: true, skipped: 'no_recipient' }); return; }

    const results = await Promise.all(recipients.map(email =>
      sendOne({ email, surface, continueUrl, subject, headline, sub }).catch(() => false)));
    const sent = results.filter(Boolean).length;

    await db.collection('engagements').doc(engagementId).set(
      { lastNotify: { [direction]: new Date().toISOString() } }, { merge: true });

    res.status(200).json({ ok: true, sent });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
