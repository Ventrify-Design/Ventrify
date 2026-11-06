/**
 * POST /api/send-email — branded transactional emails via Resend.
 *
 * Consolidates the former /api/send-login-link + /api/send-invite into one function
 * (dispatched by `type`) to stay within the Vercel plan's serverless-function budget.
 *   types: login | invite | docs-request | welcome | contact (public, CORS, the only unauthenticated one)
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

// A workspace now exists and nobody has been told. create-org has never sent anything — an operator
// made an org for a customer and the customer learned about it by being telephoned — and self-signup
// would have inherited exactly that silence. Deliberately NOT a magic link: this is confirmation, not
// authentication, and a sign-in link sitting in an inbox is a credential with a long tail.
function welcomeHtml({ orgName, planLabel, prescreens, link }) {
  const org = esc(orgName);
  const allowance = prescreens == null
    ? 'Unlimited pre-screens'
    : `${prescreens} free pre-screen${prescreens === 1 ? '' : 's'}`;
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">Verdict<span style="color:#9aa0ab;font-weight:500;">Score</span></div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;">${org} is ready</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">Your workspace is set up. Upload a deck and any supporting documents, and the pre-screen returns a verdict on whether the venture is worth a full assessment — with its reasoning and its sources attached.</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444;background:#f4f5f7;border-radius:10px;padding:12px 14px;"><strong>${esc(planLabel)}</strong> &middot; ${allowance}</p>
        <a href="${link}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Open your workspace &rarr;</a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">Sign in with the same email address and we'll send you a one-time link. If you didn't create this workspace, reply and tell us.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;border-top:1px solid rgba(0,0,0,0.06);">
        ${operatorEmail ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">Sent by ${esc(operatorEmail)} &mdash; replying to this email reaches them directly.</p>` : ''}
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


// -- ADVANCE TO A FULL ASSESSMENT ------------------------------------------------------------------
// The founder's half of the pre-screen. An operator who likes what they read tells the founder they
// are through, and asks for the specific things that would make the full assessment worth running.
//
// ASKS, NEVER VERDICTS. Of the six pre-screen findings, exactly TWO may leave the building:
//
//   thesis   "What has to be true for this to work"      - played back so they can CORRECT it
//   tension  "Where your documents disagree, both sides" - already written in the second person
//
// The other four stay inside. `bear` is defined in the product as "how it will be argued in the room
// the founder isn't in" - mailing it to the founder inverts its own definition. `bull`, `competitive`
// and `team` are judgements about them, and the BAND is an investment decision about them: sending it
// costs the operator their position and teaches the founder how to game the next read.
//
// Nothing here is composed by the operator beyond a short note. The content is assembled server-side
// from the stored snapshot and a live room check, which is what makes it safe to send from a verified
// domain - see the note on docs-request. Gate: tools/founder-safe.mjs.
function advanceHtml({ orgName, ventureName, operatorName, operatorEmail, thesis, tensions, nextTests, missing, extras, folderUrl, note }) {
  const org = esc(orgName), venture = esc(ventureName);
  const bullet = (t, sub) => `<tr><td style="padding:9px 0;border-bottom:1px solid rgba(0,0,0,0.06);"><div style="font-size:14px;font-weight:600;color:#141414;">${esc(t)}</div>${sub ? `<div style="font-size:13px;line-height:1.5;color:#6b7280;margin-top:2px;">${esc(sub)}</div>` : ''}</td></tr>`;
  const plain = (t) => `<tr><td style="padding:7px 0;"><div style="font-size:14px;line-height:1.55;color:#333;">&bull;&nbsp;&nbsp;${esc(t)}</div></td></tr>`;
  const block = (title, rows) => rows
    ? `<h2 style="margin:26px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8f98;font-weight:600;">${esc(title)}</h2>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;">${rows}</table>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">${org}</div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 12px;font-size:23px;letter-spacing:-0.02em;line-height:1.25;">${venture} is going through to a full assessment</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#444;">${operatorName ? esc(operatorName) + ' at ' + org : org} has read ${venture} and wants to take it further. The full assessment is a much deeper read, and it is worth running once a few things are in place.</p>
        ${note ? `<p style="margin:0 0 18px;padding:12px 14px;background:#f4f5f7;border-radius:10px;font-size:14px;line-height:1.6;color:#333;">${esc(note)}</p>` : ''}

        ${block('What we understood you to be claiming', thesis.map(t => plain(t.point)).join(''))}
        ${thesis.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">If we have any of that wrong, tell us &mdash; it is the part the whole assessment is built on.</p>` : ''}

        ${block('Where your documents disagree', tensions.map(t => bullet(t.point, t.docName ? 'Seen in ' + t.docName : '')).join(''))}
        ${tensions.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">These are not accusations &mdash; two documents written months apart often differ for good reasons. Resolving them before the full read saves a lot of back and forth.</p>` : ''}

        ${block('What we could not find in the data room', missing.map(m => bullet(m.label, m.want)).join('') + extras.map(e => bullet(e.label, e.why)).join(''))}

        ${block('What the full assessment will test', nextTests.map(t => plain(t)).join(''))}

        <div style="margin:28px 0 0;">
        ${folderUrl
          ? `<a href="${esc(folderUrl)}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Add them to the data room &rarr;</a>
             <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">Drop everything straight into the shared folder, including an updated deck if you have one. We pick it up from there &mdash; nothing else to do.</p>`
          : `<p style="margin:0;font-size:14px;line-height:1.6;color:#444;">Reply to this email with an updated deck and anything from the list above, and we will take it from there.</p>`}
        </div>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">If something on the list is already in the room inside another document, just say so &mdash; a document we could not see is not a mark against you.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 26px;border-top:1px solid rgba(0,0,0,0.06);">
        <p style="margin:0;font-size:12px;color:#aab0b8;">Powered by Ventrify OS</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}


// -- SHARE A PRE-SCREEN WITH A COLLEAGUE -----------------------------------------------------------
// Internal mail: a colleague inside the firm, not the founder. The band and all six findings are fair
// game here - the restraint in advanceHtml exists because that one leaves the building.
//
// It is a POINTER, not a copy. Three highlights and a link, because the shared page is the artefact
// and a second rendering of it in an email client is a second thing to keep in step. The close is the
// same argument the page makes: name what a full assessment does that this did not, and let the gap
// do the selling. Gate: tools/share-upsell.mjs.
function prescreenShareHtml({ orgName, ventureName, senderEmail, band, oneLine, highlights, url, note, productUrl }) {
  const org = esc(orgName), venture = esc(ventureName);
  const li = (t) => `<tr><td style="padding:8px 0;"><div style="font-size:14px;line-height:1.55;color:#333;">&bull;&nbsp;&nbsp;${esc(t)}</div></td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <div style="font-weight:700;letter-spacing:-0.01em;font-size:15px;color:#0036FF;">${org}</div>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;">
        <h1 style="margin:0 0 6px;font-size:23px;letter-spacing:-0.02em;line-height:1.25;">${venture}</h1>
        ${oneLine ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#555;">${esc(oneLine)}</p>` : ''}
        ${band ? `<p style="margin:0 0 16px;"><span style="display:inline-block;background:#101322;color:#fff;font-size:13px;font-weight:600;padding:5px 13px;border-radius:999px;">${esc(band)}</span>
          <span style="font-size:13px;color:#8a8f98;margin-left:8px;">a three-minute read, not an assessment</span></p>` : ''}
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">${esc(senderEmail)} shared a pre-screen with you.</p>
        ${note ? `<p style="margin:0 0 18px;padding:12px 14px;background:#f4f5f7;border-radius:10px;font-size:14px;line-height:1.6;color:#333;">${esc(note)}</p>` : ''}
        ${highlights.length ? `<h2 style="margin:22px 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8f98;font-weight:600;">A few things it found</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${highlights.map(li).join('')}</table>` : ''}
        <a href="${esc(url)}" style="display:inline-block;background:#0036FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Read the full pre-screen &rarr;</a>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#8a8f98;">No login needed. The link is read-only and can be revoked by whoever sent it.</p>
      </td></tr>
      <tr><td style="padding:24px 32px 26px;background:#101322;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#ffffff;">This is the quick read. There is a much longer one.</p>
        <p style="margin:0 0 14px;font-size:13.5px;line-height:1.65;color:#aeb2c4;">A full assessment scores a venture 0&ndash;100 across seven categories and thirty-five signals, researches every document with sources, argues the case from the whole room, and ends in a deal memo you can take to an investment committee.</p>
        <a href="${esc(productUrl)}" style="display:inline-block;background:#ffffff;color:#101322;text-decoration:none;font-weight:600;font-size:13.5px;padding:10px 20px;border-radius:9px;">See what a full assessment looks like</a>
        <p style="margin:14px 0 0;font-size:12px;color:#767c92;">Generated by VerdictScore</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

const { checkRoom } = require('./_roomcheck.js');

// The ONLY cross-origin caller is the marketing site's contact form: the page is served from
// verdict.ventrify.io and this function lives on os.ventrify.io. An allowlist, not a wildcard —
// every other type here is authenticated and has no business being reachable from a stranger's page.
const CORS_ORIGINS = new Set([
  'https://verdict.ventrify.io', 'https://venture.ventrify.io', 'https://ventrify.io',
  'http://localhost:3000',
]);
function cors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (!origin || !CORS_ORIGINS.has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async (req, res) => {
  cors(req, res);
  // Preflight. Without this the browser never sends the POST and the form fails silently.
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    // A recipient is required to SEND. A preview sends nothing, and the operator should be able to read
    // what would go out before deciding who gets it — an engagement with no founder email on file would
    // otherwise have to be filled in blind.
    const isPreviewOnly = body.type === 'prescreen-advance' && !!body.preview;
    if (!email && !isPreviewOnly) { res.status(400).json({ error: 'email_required' }); return; }

    // ── CONTACT (public, unauthenticated) ───────────────────────────────────────────────────────────
    // The pricing CTAs were four `mailto:` links, which on mobile and in webmail frequently do nothing
    // at all — the click looks like a dead button and the lead is gone with no trace. This is the only
    // unauthenticated branch in this file, so it is also the only one that has to assume the caller is
    // hostile: nothing it submits is trusted, nothing it says is echoed anywhere privileged, and it
    // writes one short record rather than anything that can grow.
    if (body.type === 'contact') {
      if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }
      // A field no human sees and no human fills. Bots fill everything. Answer 200 so the bot believes
      // it worked and does not come back by another route.
      if (String(body._hp || '').trim()) { res.status(200).json({ ok: true }); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'bad_email' }); return; }

      const TIERS = new Set(['Founder', 'Angel', 'Investor', 'Enterprise', 'General']);
      const tier = TIERS.has(String(body.tier || '')) ? String(body.tier) : 'General';
      const cap = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
      const name = cap(body.name, 120), company = cap(body.company, 120), message = cap(body.message, 2000);
      if (!name) { res.status(400).json({ error: 'name_required' }); return; }

      ensureAdmin();
      const db = admin.firestore();

      // Cheap, honest throttle: the same address cannot file more than three in an hour. Not a defence
      // against a determined flood — it is a defence against a retry loop and an idle nuisance.
      //
      // ONE DOCUMENT READ, NOT A QUERY, and that is the whole point. The first version asked
      // `where('email','==',x).where('createdAt','>',t)`, which is a composite query, and Firestore
      // answers a composite query it has no index for with FAILED_PRECONDITION — a 500 on every
      // genuine submission. It shipped, because every case the gate tested (honeypot, bad address,
      // missing name) returns BEFORE this line. Keying the document by the address needs no index and
      // cannot develop this failure again.
      const key = email.replace(/[^a-z0-9]+/g, '_').slice(0, 120);
      const tRef = db.doc('contactThrottle/' + key);
      const now = Date.now();
      const hits = (((await tRef.get()).data() || {}).hits || []).filter(t => now - t < 60 * 60 * 1000);
      if (hits.length >= 3) { res.status(429).json({ error: 'too_many_requests' }); return; }
      await tRef.set({ hits: [...hits, now], email }, { merge: false });

      const ref = await db.collection('contactRequests').add({
        email, name, company, message, tier,
        source: (req.headers && req.headers.origin) || 'unknown',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        handled: false,
      });

      const row = (k, v) => v ? `<tr><td style="padding:4px 14px 4px 0;color:#8a8f98;font-size:13px;">${esc(k)}</td><td style="padding:4px 0;font-size:14px;">${esc(v)}</td></tr>` : '';
      const html = `<!doctype html><html><body style="font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#141414;">
        <h2 style="margin:0 0 14px;font-size:18px;">${esc(tier)} plan enquiry</h2>
        <table role="presentation" cellpadding="0" cellspacing="0">
          ${row('Name', name)}${row('Email', email)}${row('Company', company)}${row('Tier', tier)}
        </table>
        ${message ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</p>` : ''}
        <p style="margin:20px 0 0;font-size:12px;color:#aab0b8;">contactRequests/${esc(ref.id)} · reply to this email to answer them directly.</p>
      </body></html>`;

      const to = process.env.CONTACT_TO_EMAIL || 'hello@ventrify.io';
      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
          to: [to], reply_to: email, subject: `${tier} plan enquiry — ${name}`, html,
        })
      });
      // The record is already written, so a mail outage loses the notification, never the lead.
      if (!sendResp.ok) { res.status(200).json({ ok: true, emailed: false, id: ref.id }); return; }
      res.status(200).json({ ok: true, emailed: true, id: ref.id });
      return;
    }

    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: 'email_not_configured' }); return; }

    // ── WELCOME (authenticated) ────────────────────────────────────────────────────────────────────
    // Content comes from the org record, never the body: a caller picks nobody's name, plan or
    // allowance. An operator may only welcome THEMSELVES to an org they belong to; a super-admin may
    // welcome the owner of any org, which is what closes create-org's long-standing silence.
    if (body.type === 'welcome') {
      if (!body.idToken) { res.status(400).json({ error: 'bad_request' }); return; }
      ensureAdmin();
      let decoded;
      try { decoded = await admin.auth().verifyIdToken(body.idToken); }
      catch (e) { res.status(401).json({ error: 'invalid_token' }); return; }
      const caller = (decoded.email || '').toLowerCase();
      const db = admin.firestore();

      const cfg = (await db.doc('app/config').get()).data() || {};
      const isSuper = (cfg.superAdminEmails || []).map(e => String(e).toLowerCase()).includes(caller);

      const orgId = String(body.orgId || '').trim();
      let orgSnap;
      if (orgId) {
        orgSnap = await db.collection('organisations').doc(orgId).get();
      } else {
        const mine = await db.collection('organisations').where('operatorEmails', 'array-contains', caller).limit(1).get();
        orgSnap = mine.empty ? null : mine.docs[0];
      }
      if (!orgSnap || !orgSnap.exists) { res.status(404).json({ error: 'org_not_found' }); return; }
      const org = orgSnap.data();
      const ops = (org.operatorEmails || []).map(e => String(e).toLowerCase());
      // Not a super-admin? Then the only address you may write to is your own, in your own org.
      if (!isSuper && (!ops.includes(caller) || email !== caller)) { res.status(403).json({ error: 'forbidden' }); return; }
      if (isSuper && !ops.includes(email)) { res.status(403).json({ error: 'not_an_operator_of_that_org' }); return; }

      const plan = org.plan || {};
      const PLAN_LABELS = { trial: 'Free trial', 'self-serve': 'Free account', 'one-off': 'One-off assessment',
                            assess: 'Assessment licence', full: 'Full platform licence', custom: 'Custom plan' };
      const html = welcomeHtml({
        orgName: org.name || 'Your workspace',
        planLabel: PLAN_LABELS[plan.preset] || 'Workspace',
        prescreens: plan.limits ? plan.limits.prescreens : null,
        link: (process.env.WORKSPACE_URL || 'https://os.ventrify.io') + '/workspace',
      });
      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
          to: [email], subject: `${org.name || 'Your workspace'} is ready — VerdictScore`, html
        })
      });
      if (!sendResp.ok) { const detail = await sendResp.text(); res.status(502).json({ error: 'send_failed', detail: detail.slice(0, 300) }); return; }
      res.status(200).json({ ok: true });
      return;
    }

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

    // -- ADVANCE TO A FULL ASSESSMENT (operator -> founder) -----------------------------------------
    // Same shape as docs-request: authenticated, org-scoped, content assembled HERE from stored state.
    // Unlike docs-request this does NOT refuse when the room is complete - "you are through, send us
    // your latest deck" is worth sending on its own, and a complete room is the best case for it.
    if (body.type === 'prescreen-advance') {
      const engagementId = String(body.engagementId || '').trim();
      if (!body.idToken || !engagementId) { res.status(400).json({ error: 'bad_request' }); return; }
      ensureAdmin();
      let decoded;
      try { decoded = await admin.auth().verifyIdToken(body.idToken); }
      catch (e) { res.status(401).json({ error: 'invalid_token' }); return; }
      const caller = (decoded.email || '').toLowerCase();
      const db = admin.firestore();
      const engSnap = await db.collection('engagements').doc(engagementId).get();
      if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
      const eng = engSnap.data();
      const orgSnap = await db.collection('organisations').doc(eng.orgId || 'default').get();
      const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
      if (!ops.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

      // There has to be something to advance FROM. A v1 snapshot has no nuggets and no nextTests, so it
      // would send a near-empty letter under a confident heading.
      const ps = eng.prescreen2 || {};
      if (ps.v !== 2 || ps.state !== 'done') {
        res.status(409).json({ error: 'not_prescreened', detail: 'This venture has no finished pre-screen to advance from.' });
        return;
      }

      const docsSnap = await db.collection('engagements').doc(engagementId).collection('founderDocs').get();
      const check = checkRoom(docsSnap.docs.map(d => ({ name: d.data().name, text: d.data().text || '' })));
      const missing = check.classes.filter(c => !c.found).map(c => ({ label: c.label, want: c.want }));
      const extras = check.strengtheners.map(e => ({ label: e.label, why: e.why }));

      // THE ALLOWLIST IS THE WHOLE SAFETY PROPERTY. Two keys, named literally, never a loop over
      // ps.nuggets - a future seventh finding must be let out deliberately, not inherited by accident.
      const pointsOf = (k) => ((((ps.nuggets || {})[k]) || {}).points || []);
      const clean = (v) => String(v == null ? '' : v).slice(0, 400);
      const thesis = pointsOf('thesis').slice(0, 4).map(pt => ({ point: clean(pt.point) })).filter(t => t.point);
      const tensions = pointsOf('tension').slice(0, 4)
        .map(pt => ({ point: clean(pt.point), docName: clean(pt.docName).slice(0, 80) }))
        .filter(t => t.point);
      const nextTests = (Array.isArray(ps.nextTests) ? ps.nextTests : []).slice(0, 3).map(clean).filter(Boolean);

      const ventureName = eng.ventureName || eng.name || 'the venture';
      const orgName = (orgSnap.exists && orgSnap.data().name) || 'Ventrify';
      const folderUrl = (eng.dataRoom && eng.dataRoom.folderUrl) || '';

      // PREVIEW RETURNS THE REAL THING AND SENDS NOTHING. The operator is forwarding findings about the
      // founder's own documents to that founder, so they have to see exactly what goes - and a preview
      // the CLIENT assembles would be a second implementation that drifts from this one the first time
      // either changes. Same inputs, same allowlist, same room check, one code path.
      if (body.preview) {
        res.status(200).json({
          ok: true, preview: true,
          to: email, venture: ventureName,
          thesis, tensions, nextTests, missing, extras,
          folderUrl: !!folderUrl,
          asks: missing.length + extras.length + tensions.length,
          lastSentAt: (eng.advance && eng.advance.sentAt) || null,
          lastSentTo: (eng.advance && eng.advance.to) || null,
        });
        return;
      }

      // decoded.name is set when the identity provider has one; magic-link sign-ins usually do not,
      // so the opening falls back to the firm. An email address reads as a machine wrote it.
      const html = advanceHtml({
        orgName, ventureName, operatorName: String(decoded.name || '').slice(0, 80), operatorEmail: caller,
        thesis, tensions, nextTests, missing, extras, folderUrl,
        note: String(body.note || '').slice(0, 600),
      });
      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
          to: [email], reply_to: caller,
          subject: `${ventureName} — going through to a full assessment`,
          html
        })
      });
      if (!sendResp.ok) { const detail = await sendResp.text(); res.status(502).json({ error: 'send_failed', detail: detail.slice(0, 300) }); return; }

      // THE STAGE, not just a receipt. The queue derives "awaiting founder" from sentAt plus the absence
      // of dataRoom.pending, so nothing has to be cleared by hand when the founder answers - the watcher
      // already sets pending, and that item outranks this one.
      const asks = missing.length + extras.length + tensions.length;
      const prev = eng.advance || {};
      await db.collection('engagements').doc(engagementId).set({
        advance: {
          sentAt: new Date().toISOString(), to: email, by: caller,
          asks, missing: missing.length, tensions: tensions.length, tests: nextTests.length,
          count: (prev.count || 0) + 1,
        }
      }, { merge: true });
      res.status(200).json({ ok: true, asks, tensions: tensions.length, missing: missing.length, tests: nextTests.length });
      return;
    }

    // -- SHARE A PRE-SCREEN WITH A COLLEAGUE (operator -> inside the firm) --------------------------
    // Internal, so the band and every finding may travel. The message is still built HERE: the client
    // chooses a recipient and may add a note, and that is all it can do.
    if (body.type === 'prescreen-share') {
      const engagementId = String(body.engagementId || '').trim();
      if (!body.idToken || !engagementId) { res.status(400).json({ error: 'bad_request' }); return; }
      ensureAdmin();
      let decoded;
      try { decoded = await admin.auth().verifyIdToken(body.idToken); }
      catch (e) { res.status(401).json({ error: 'invalid_token' }); return; }
      const caller = (decoded.email || '').toLowerCase();
      const db = admin.firestore();
      const engSnap = await db.collection('engagements').doc(engagementId).get();
      if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
      const eng = engSnap.data();
      const orgSnap = await db.collection('organisations').doc(eng.orgId || 'default').get();
      const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
      if (!ops.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

      const ps = eng.prescreen2 || {};
      if (ps.v !== 2 || ps.state !== 'done') { res.status(409).json({ error: 'not_prescreened' }); return; }
      // THE LINK IS READ FROM THE ENGAGEMENT, never from the request. A client that could post its own
      // url would turn this into an open relay that mails arbitrary links from a verified domain.
      const token = eng.shareLink && eng.shareLink.token;
      if (!token) { res.status(409).json({ error: 'no_share_link' }); return; }
      const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'os.ventrify.io');

      // Three highlights, one from each of the findings a colleague decides on fastest. The page is
      // the artefact; this is a trailer for it.
      const firstOf = (k) => {
        const pt = (((ps.nuggets || {})[k] || {}).points || [])[0];
        return pt && pt.point ? String(pt.point).slice(0, 300) : null;
      };
      const highlights = ['thesis', 'bear', 'tension'].map(firstOf).filter(Boolean);

      const ventureName = eng.ventureName || eng.name || 'A venture';
      const orgName = (orgSnap.exists && orgSnap.data().name) || 'Ventrify';
      const BANDS = { high: 'Worth assessing', medium: 'Worth a closer look', low: 'Not yet' };
      const html = prescreenShareHtml({
        orgName, ventureName, senderEmail: caller,
        band: BANDS[String(ps.band || '').toLowerCase()] || '',
        oneLine: String((ps.brief && (ps.brief.oneLine || ps.brief.one_line)) || '').slice(0, 300),
        highlights, url: origin + '/m/' + token,
        note: String(body.note || '').slice(0, 600),
        productUrl: process.env.PRODUCT_URL || 'https://verdict.ventrify.io',
      });
      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.INVITE_FROM_EMAIL || 'Ventrify <hello@ventrify.io>',
          to: [email], reply_to: caller,
          subject: `${ventureName} — pre-screen`,
          html
        })
      });
      if (!sendResp.ok) { const detail = await sendResp.text(); res.status(502).json({ error: 'send_failed', detail: detail.slice(0, 300) }); return; }
      await db.collection('engagements').doc(engagementId).set({
        shareLink: { ...(eng.shareLink || {}), lastEmailedAt: new Date().toISOString(), lastEmailedTo: email, lastEmailedBy: caller }
      }, { merge: true });
      res.status(200).json({ ok: true, highlights: highlights.length });
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
