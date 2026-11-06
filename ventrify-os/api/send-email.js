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

// ══ MAIL CHROME ═══════════════════════════════════════════════════════════════════════════════════
// Every template below is built from this one shell, and it is the ONLY place the identity lives.
//
// WHY IT EXISTS. Six templates each carried their own copy of a white card, a #0036FF rule and
// "Powered by Ventrify OS" — the parent brand, from before the product had an identity of its own.
// The whole workspace renders [data-brand="verdictscore"], so the mail it sends was the one surface
// still speaking the old dialect. Six copies also meant six places to fix, which is why the welcome
// email's footer was a half-finished paste of the docs-request footer and threw a ReferenceError on
// every send (see the note on welcomeHtml).
//
// IT IS DARK, BECAUSE THE PRODUCT IS. VerdictScore has no light mode: a white email with violet
// buttons would look like a different company than the one the operator just left. The risk with a
// dark email is the Outlook/Word engine, which ignores `background` on <body> and on <div> — so
// every coloured surface here is a TABLE CELL carrying both a bgcolor attribute and an inline style,
// and nothing relies on border-radius, flex or a background image.
//
// THE COLOURS ARE RESOLVED TOKENS, NOT GUESSES. An email cannot load brand.css and cannot composite
// a translucent text step against a backdrop, so the values are flattened copies — measured in a
// browser from brand.css with [data-brand="verdictscore"], and checked against it on every run by
// tools/brand-fidelity.mjs. Contrast on the card: white 16.69:1, ink2 10.54:1, ink3 6.37:1, accent
// text 7.97:1, and the dark ink on the accent fill 8.90:1. (--text-4 measures 3.74:1 and is unused.)
const MAIL = {
  canvas:  '#100B22',   // --brand-ground
  card:    '#1B1B37',   // --brand-tint
  deep:    '#140E2B',   // --v-violet-900 — masthead, close and footer
  edge:    '#363245',   // --line-2 over the canvas
  rule:    '#32324B',   // --line-1 over the card
  ink1:    '#FFFFFF',   // --text-1
  ink2:    '#CDCDD3',   // --text-2 flattened
  ink3:    '#9F9FAB',   // --text-3 flattened
  ruleDeep:'#3A354D',   // --line-2 over the deep blocks
  accent:  '#B9A7FF',   // --brand-accent-2 — accent text AND the filled button
  fill:    '#7C5CFC',   // --brand-accent — the saturated step, used as the brand rule
  onAccent:'#140E2B',   // --text-on-accent
  font:    "Inter,'Inter Tight',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
};

// The lockup, as a PNG. No mail client renders inline SVG and both Gmail and Outlook strip a data:
// URI, so this is the one raster copy of the mark — generated FROM the same path data as the inline
// one (tools/make-lockup-png.mjs), white-on-transparent at 3x. Images are often blocked by default,
// which is why the alt text is the product name and the firm is always named in text as well.
const ASSETS = process.env.ASSET_ORIGIN || 'https://os.ventrify.io';
const LOGO = `<img src="${ASSETS}/assets/brand/verdictscore-lockup-mail.png" width="121" height="24"
  alt="VerdictScore" style="display:block;border:0;outline:none;text-decoration:none;">`;

// Two weights, and the quiet one is the UPSELL. A filled white button in the close out-shouted the
// violet one above it, so the loudest thing in an email about a specific venture was an advert. The
// action the reader came for stays filled; the product pitch is outlined.
const mailBtn = (href, label, tone = 'accent') => tone === 'accent'
  ? `<a href="${esc(href)}" style="display:inline-block;background:${MAIL.accent};color:${MAIL.onAccent};
      text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">${label}</a>`
  : `<a href="${esc(href)}" style="display:inline-block;background:${MAIL.deep};color:${MAIL.accent};
      border:1px solid ${MAIL.ruleDeep};text-decoration:none;font-weight:600;font-size:14px;
      padding:11px 22px;border-radius:10px;">${label}</a>`;

// A labelled block of rows. `title` is the accent eyebrow the product uses above every section.
const mailBlock = (title, rows) => rows
  ? `<h2 style="margin:26px 0 9px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;
       color:${MAIL.accent};font-weight:600;">${esc(title)}</h2>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;">${rows}</table>`
  : '';

// A row with a heading and an optional sub-line, divided from the next.
const mailRow = (t, sub) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${MAIL.rule};">
  <div style="font-size:14.5px;font-weight:600;color:${MAIL.ink1};line-height:1.5;">${esc(t)}</div>${
  sub ? `<div style="font-size:13px;line-height:1.5;color:${MAIL.ink3};margin-top:3px;">${esc(sub)}</div>` : ''}</td></tr>`;

// A plain bullet, for points that carry no second line. TWO CELLS, not a &bull; and two spaces: an
// inline marker lets the second line of a wrapped point slide back under the dot, which at email
// widths is most of them.
const mailBullet = (t) => `<tr>
  <td width="16" style="width:16px;padding:7px 0 0;vertical-align:top;font-size:14.5px;line-height:1.6;color:${MAIL.accent};">&bull;</td>
  <td style="padding:7px 0;font-size:14.5px;line-height:1.6;color:${MAIL.ink2};">${esc(t)}</td></tr>`;

const mailNote = (t) => t ? `<p style="margin:0 0 18px;padding:13px 15px;background:${MAIL.deep};
  border-radius:10px;font-size:14.5px;line-height:1.6;color:${MAIL.ink2};">${esc(t)}</p>` : '';

const mailFine = (t) => `<p style="margin:0;font-size:12.5px;line-height:1.6;color:${MAIL.ink3};">${t}</p>`;

/* mailShell — the envelope. `eyebrow` sits opposite the lockup; `close` is the dark block at the
   foot, used by the two emails that have something to sell and omitted by the four that do not. */
function mailShell({ width = 560, eyebrow = '', body, close = '', foot = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
</head><body style="margin:0;padding:0;background:${MAIL.canvas};font-family:${MAIL.font};color:${MAIL.ink1};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${MAIL.canvas}"
         style="background:${MAIL.canvas};padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" bgcolor="${MAIL.card}"
           style="max-width:${width}px;background:${MAIL.card};border-radius:16px;border:1px solid ${MAIL.edge};overflow:hidden;">
      <tr><td bgcolor="${MAIL.fill}" style="background:${MAIL.fill};height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
      <tr><td bgcolor="${MAIL.deep}" style="background:${MAIL.deep};padding:20px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="left" style="vertical-align:middle;">${LOGO}</td>
          <td align="right" style="vertical-align:middle;font-size:11px;letter-spacing:.09em;
              text-transform:uppercase;color:${MAIL.ink3};">${esc(eyebrow)}</td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${MAIL.card}" style="background:${MAIL.card};padding:24px 32px 28px;">${body}</td></tr>
      ${close ? `<tr><td bgcolor="${MAIL.deep}" style="background:${MAIL.deep};padding:26px 32px 28px;">${close}</td></tr>` : ''}
      <tr><td bgcolor="${MAIL.deep}" style="background:${MAIL.deep};padding:${close ? '0 32px 26px' : '20px 32px 24px'};
              border-top:${close ? 'none' : '1px solid ' + MAIL.rule};">
        ${foot}<p style="margin:${foot ? '8px' : '0'} 0 0;font-size:12px;color:${MAIL.ink3};">Generated by VerdictScore</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

// The upsell close, shared by the two emails that reach people outside the firm. It is the same
// argument workspace/prescreen-view.js makes: do not advertise, name the difference between what
// they just read and what they did not get, and let the gap do the selling.
function mailClose({ productUrl, heading, lead }) {
  return `<p style="margin:0 0 8px;font-size:16px;font-weight:600;color:${MAIL.ink1};">${esc(heading)}</p>
    <p style="margin:0 0 15px;font-size:13.5px;line-height:1.7;color:${MAIL.ink2};">${esc(lead)}</p>
    ${mailBtn(productUrl, 'See what a full assessment looks like', 'quiet')}`;
}

function loginHtml({ surface, link }) {
  const s = esc(surface || 'Workspace');
  return mailShell({ width: 480, eyebrow: `Sign in · ${s}`, body: `
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;color:${MAIL.ink1};">Sign in to your ${s}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">Click below to sign in. No password needed.</p>
    ${mailBtn(link, `Open your ${s} &rarr;`)}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">This link signs you in and expires soon for security. If you didn't request it, you can safely ignore this email.</p>` });
}

function inviteHtml({ orgName, ventureName, link }) {
  const org = esc(orgName), venture = esc(ventureName);
  return mailShell({ width: 480, eyebrow: 'Studio invitation', body: `
    <div style="font-weight:600;font-size:14px;color:${MAIL.accent};letter-spacing:-0.01em;margin:0 0 10px;">${org}</div>
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;color:${MAIL.ink1};">You're invited to your Studio</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">${org} has set up a Studio for <strong style="color:${MAIL.ink1};">${venture}</strong> &mdash; your space to shape the research and direction of your venture. Click below to sign in. No password needed.</p>
    ${mailBtn(link, 'Open your Studio &rarr;')}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">This link signs you in and expires soon for security. If you weren't expecting this, you can safely ignore it.</p>` });
}

// A workspace now exists and nobody has been told. create-org has never sent anything — an operator
// made an org for a customer and the customer learned about it by being telephoned — and self-signup
// would have inherited exactly that silence. Deliberately NOT a magic link: this is confirmation, not
// authentication, and a sign-in link sitting in an inbox is a credential with a long tail.
//
// ⚠ IT THREW ON EVERY SEND. The footer was a paste of the docs-request footer and still referenced
// `operatorEmail`, which this function never took — a bare undefined identifier, so every call raised
// a ReferenceError before Resend was ever reached and the branch 500'd. Nothing caught it because
// nothing RENDERED these templates outside production: six near-identical copies, and the gates all
// read source text. tools/mail-brand.mjs now renders all six on every run, which is the only check
// that could have found this.
function welcomeHtml({ orgName, planLabel, prescreens, link }) {
  const org = esc(orgName);
  const allowance = prescreens == null
    ? 'Unlimited pre-screens'
    : `${prescreens} free pre-screen${prescreens === 1 ? '' : 's'}`;
  return mailShell({ width: 480, eyebrow: 'Your workspace', body: `
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;color:${MAIL.ink1};">${org} is ready</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">Your workspace is set up. Upload a deck and any supporting documents, and the pre-screen returns a verdict on whether the venture is worth a full assessment &mdash; with its reasoning and its sources attached.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MAIL.ink2};background:${MAIL.deep};border-radius:10px;padding:13px 15px;"><strong style="color:${MAIL.ink1};">${esc(planLabel)}</strong> &middot; ${esc(allowance)}</p>
    ${mailBtn(link, 'Open your workspace &rarr;')}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">Sign in with the same email address and we'll send you a one-time link. If you didn't create this workspace, reply and tell us.</p>` });
}

function docsRequestHtml({ orgName, ventureName, operatorName, missing, extras, folderUrl, note }) {
  const org = esc(orgName), venture = esc(ventureName);
  return mailShell({ width: 520, eyebrow: 'Document request', foot: operatorName
    ? `<p style="margin:0;font-size:12.5px;line-height:1.6;color:${MAIL.ink3};">Sent by ${esc(operatorName)} at ${org} &mdash; replying reaches them directly.</p>` : '', body: `
    <div style="font-weight:600;font-size:14px;color:${MAIL.accent};letter-spacing:-0.01em;margin:0 0 10px;">${org}</div>
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;line-height:1.25;color:${MAIL.ink1};">A few documents for the ${venture} assessment</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">${esc(operatorName)} is preparing the investability assessment for <strong style="color:${MAIL.ink1};">${venture}</strong>. These are the things the assessment looks for that we could not find in the data room:</p>
    ${mailNote(note)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${missing.map(m => mailRow(m.label, m.want)).join('')}
      ${extras.map(e => mailRow(e.label, e.why)).join('')}
    </table>
    ${folderUrl
      ? `${mailBtn(folderUrl, 'Add them to the data room &rarr;')}
         <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">Drop them straight into the shared folder &mdash; nothing else to do. We pick them up from there.</p>`
      : `<p style="margin:0;font-size:14.5px;line-height:1.6;color:${MAIL.ink2};">Reply to this email with the documents and we will add them.</p>`}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">If something on this list is already in the room inside another document, just say so &mdash; nothing is being marked against you.</p>` });
}


// -- ADVANCE TO A FULL ASSESSMENT ------------------------------------------------------------------
// The founder's half of the pre-screen. An operator who likes what they read tells the founder they
// are through, and asks for the specific things that would make the full assessment worth running.
//
// FOUR OF THE SIX FINDINGS MAY LEAVE THE BUILDING. The line is not "how flattering is it" — it is
// whether the finding is written FOR the founder or ABOUT them:
//
//   thesis       what we understood you to be claiming  - played back so they can CORRECT it
//   bull         the strongest version of their case    - our argument FOR them, which they may use
//   competitive  who else we found doing this           - research they can check and answer
//   tension      where their documents disagree         - already written in the second person
//
// The other two stay inside, and so does the band. `bear` is defined in the product as "how it will
// be argued in the room the founder isn't in" - mailing it to the founder inverts its own definition.
// `team` is a judgement about the people reading it. The BAND is an investment decision about them:
// sending it costs the operator their position and teaches the founder how to game the next read.
//
// bull and competitive were added on 2026-11-06 so the email shows what the product actually found
// rather than only what it wants. They are the two findings that are both substantive and answerable
// — which is the same test the other four fail.
//
// Nothing here is composed by the operator beyond a short note. The content is assembled server-side
// from the stored snapshot and a live room check, which is what makes it safe to send from a verified
// domain - see the note on docs-request. Gate: tools/founder-safe.mjs.
function advanceHtml({ orgName, ventureName, operatorName, operatorEmail, thesis, bull, competitive,
                       tensions, nextTests, missing, extras, folderUrl, note }) {
  const org = esc(orgName), venture = esc(ventureName);
  const found = thesis.length || bull.length || competitive.length || tensions.length;

  return mailShell({ width: 560, eyebrow: 'Pre-screen · cleared', foot: operatorEmail
    ? `<p style="margin:0;font-size:12.5px;line-height:1.6;color:${MAIL.ink3};">Sent by ${
        operatorName ? esc(operatorName) + ' (' + esc(operatorEmail) + ')' : esc(operatorEmail)
      } at ${org} &mdash; replying reaches them directly.</p>` : '',
    close: mailClose({
      productUrl: 'https://verdict.ventrify.io',
      heading: 'What you have just read is the short version.',
      lead: 'A pre-screen is a five-minute read of your deck and whatever is in the room. The full assessment scores the venture 0–100 across seven categories and thirty-five signals, researches every document against the outside world with sources, and ends in a deal memo. That is the read your documents are about to go through.',
    }),
    body: `
    <div style="font-weight:600;font-size:14px;color:${MAIL.accent};letter-spacing:-0.01em;margin:0 0 10px;">${org}</div>
    <h1 style="margin:0 0 12px;font-size:23px;letter-spacing:-0.02em;line-height:1.25;color:${MAIL.ink1};">${venture} is going through to a full assessment</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">${operatorName ? esc(operatorName) + ' at ' + org : org} has read ${venture} and wants to take it further. The full assessment is a much deeper read, and it is worth running once a few things are in place.</p>
    ${mailNote(note)}
    ${found ? `<p style="margin:0 0 4px;font-size:13.5px;line-height:1.6;color:${MAIL.ink3};">Everything below came out of the five-minute read of your own documents. Correct anything we have wrong &mdash; it is the part the whole assessment is built on.</p>` : ''}

    ${mailBlock('What we understood you to be claiming', thesis.map(t => mailBullet(t.point)).join(''))}

    ${mailBlock('The strongest version of your case', bull.map(t => mailBullet(t.point)).join(''))}
    ${bull.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">This is how we would argue for backing you. If the best case is stronger than this, that is worth knowing before the full read.</p>` : ''}

    ${mailBlock('Who else we found working on this', competitive.map(t => mailBullet(t.point)).join(''))}
    ${competitive.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">Found from public sources, not from your deck. If we have mischaracterised any of them, or missed the one that matters, tell us.</p>` : ''}

    ${mailBlock('Where your documents disagree', tensions.map(t => mailRow(t.point, t.docName ? 'Seen in ' + t.docName : '')).join(''))}
    ${tensions.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">These are not accusations &mdash; two documents written months apart often differ for good reasons. Resolving them before the full read saves a lot of back and forth.</p>` : ''}

    ${mailBlock('What we could not find in the data room', missing.map(m => mailRow(m.label, m.want)).join('') + extras.map(e => mailRow(e.label, e.why)).join(''))}

    ${mailBlock('What the full assessment will test', nextTests.map(t => mailBullet(t)).join(''))}

    <div style="margin:28px 0 0;">
    ${folderUrl
      ? `${mailBtn(folderUrl, 'Add them to the data room &rarr;')}
         <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">Drop everything straight into the shared folder, including an updated deck if you have one. We pick it up from there &mdash; nothing else to do.</p>`
      : `<p style="margin:0;font-size:14.5px;line-height:1.6;color:${MAIL.ink2};">Reply to this email with an updated deck and anything from the list above, and we will take it from there.</p>`}
    </div>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">If something on the list is already in the room inside another document, just say so &mdash; a document we could not see is not a mark against you.</p>` });
}


// -- SHARE A PRE-SCREEN WITH A COLLEAGUE -----------------------------------------------------------
// Internal mail: a colleague inside the firm, not the founder. The band and all six findings are fair
// game here - the restraint in advanceHtml exists because that one leaves the building.
//
// It is a POINTER, not a copy. Three highlights and a link, because the shared page is the artefact
// and a second rendering of it in an email client is a second thing to keep in step. The close is the
// same argument the page makes: name what a full assessment does that this did not, and let the gap
// do the selling. Gate: tools/share-upsell.mjs.
function prescreenShareHtml({ orgName, ventureName, senderEmail, band, bandLine, oneLine, highlights, url, note, productUrl }) {
  const org = esc(orgName), venture = esc(ventureName);
  return mailShell({ width: 560, eyebrow: 'Pre-screen',
    close: mailClose({
      productUrl,
      heading: 'This is the quick read. There is a much longer one.',
      lead: 'A full assessment scores a venture 0–100 across seven categories and thirty-five signals, researches every document with sources, argues the case from the whole room, and ends in a deal memo you can take to an investment committee.',
    }),
    body: `
    <div style="font-weight:600;font-size:14px;color:${MAIL.accent};letter-spacing:-0.01em;margin:0 0 10px;">${org}</div>
    <h1 style="margin:0 0 6px;font-size:23px;letter-spacing:-0.02em;line-height:1.25;color:${MAIL.ink1};">${venture}</h1>
    ${oneLine ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">${esc(oneLine)}</p>` : ''}
    ${band ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>
      <td style="padding:0 10px 0 0;"><span style="display:inline-block;background:${MAIL.accent};color:${MAIL.onAccent};
        font-size:13px;font-weight:700;padding:5px 13px;border-radius:999px;">${esc(band)}</span></td>
      <td style="font-size:13px;color:${MAIL.ink3};">${esc(bandLine || '')}</td></tr></table>` : ''}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MAIL.ink2};">${esc(senderEmail)} shared a pre-screen with you &mdash; a five-minute read, not an assessment.</p>
    ${mailNote(note)}
    ${highlights.length ? mailBlock('A few things it found', highlights.map(mailBullet).join('')) : ''}
    <div style="margin:24px 0 0;">${mailBtn(url, 'Read the full pre-screen &rarr;')}</div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${MAIL.ink3};">No login needed. The link is read-only and can be revoked by whoever sent it.</p>` });
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
      // FOUR KEYS, NAMED ONE AT A TIME, never a loop over ps.nuggets. The two that are missing —
      // `bear` and `team` — are the point of this list, and a loop is how they would arrive. The band
      // and its reason are not read here at all. tools/founder-safe.mjs runs the real endpoint with
      // tracer strings in every forbidden field and fails if one reaches the output.
      const thesis = pointsOf('thesis').slice(0, 4).map(pt => ({ point: clean(pt.point) })).filter(t => t.point);
      const bull = pointsOf('bull').slice(0, 3).map(pt => ({ point: clean(pt.point) })).filter(t => t.point);
      const competitive = pointsOf('competitive').slice(0, 3).map(pt => ({ point: clean(pt.point) })).filter(t => t.point);
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
          thesis, bull, competitive, tensions, nextTests, missing, extras,
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
        thesis, bull, competitive, tensions, nextTests, missing, extras, folderUrl,
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
      // THE BAND VOCABULARY IS NOT LOCAL. This branch carried its own third copy — "Worth assessing /
      // Worth a closer look / Not yet" — while the product said High / Medium / Low and the shared
      // document said something else again, so one snapshot read as three different verdicts
      // depending on which surface you were looking at. shared/prescreen-bands.js is the one source.
      // (A dynamic import, because this file is CommonJS and that module is ESM; api/memo.js reaches
      // into ../shared the same way and has done in production since the rubric moved there.)
      const { bandOf } = await import('../shared/prescreen-bands.js');
      const psBand = bandOf(ps.band);
      const html = prescreenShareHtml({
        orgName, ventureName, senderEmail: caller,
        band: psBand ? psBand.label : '', bandLine: psBand ? psBand.line : '',
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

// ── RENDERABLE BY A GATE ───────────────────────────────────────────────────────────────────────────
// Vercel calls the default export; a property hung off it changes nothing at runtime and costs
// nothing. It exists so tools/mail-brand.mjs can RENDER all six templates rather than grep them —
// which is the only kind of check that would have caught the welcome email throwing a ReferenceError
// on every send for as long as it did. See CLAUDE.md: "reading proves you wrote what you meant to
// write; only running proves it works."
module.exports.__templates = {
  loginHtml, inviteHtml, welcomeHtml, docsRequestHtml, advanceHtml, prescreenShareHtml, MAIL,
};
