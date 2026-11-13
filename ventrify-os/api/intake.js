/**
 * POST /api/intake — the PUBLIC door for the partner-site pre-screen widget.
 *
 * This is the only endpoint in the product a complete stranger can reach with no
 * token at all, so it is written on the assumption that every caller is hostile.
 *
 * WHY IT HAS TO EXIST AT ALL. A founder on a partner's site has no account, and
 * create-own-org deliberately refuses to mint a workspace for an unverified
 * address ("there is no open endpoint that mints organisations"). So nothing
 * downstream can be called yet. This endpoint parks the submission, hands back a
 * signed upload URL for the deck, and nothing more. The workspace is created
 * later, by the founder, after they have proved the address by following the
 * magic link — which is sent by /api/send-email type:'login', NOT from here.
 *
 * TWO PHASES, because a 40MB deck cannot be POSTed to a serverless function
 * (~4.5MB body cap):
 *   1. { partner, name, email, company, room?, share }  → { intakeId, uploadUrl }
 *   2. { intakeId, uploaded:true }                      → { ok:true }
 * The browser PUTs the file straight to Storage in between. The signed URL is
 * minted by the Admin SDK, is good for one path for fifteen minutes, and needs
 * no change to storage.rules — a rule that allowed unauthenticated writes would
 * be an open bucket, which is a different and much worse problem.
 *
 * WHAT IT DOES NOT DO: it does not run anything, does not spend anything, does
 * not create an org, does not touch an engagement. A parked intake is inert.
 *
 * Env: FIREBASE_SERVICE_ACCOUNT, FIREBASE_STORAGE_BUCKET (optional — defaults to
 * the service account's project bucket), INTAKE_PARTNERS (optional allowlist).
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  const cert = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(cert),
    // The bucket is <project>.firebasestorage.app — see firebase/config.js, which is
    // what the client actually uses. The older <project>.appspot.com form would mint
    // signed URLs for a bucket nothing in this product reads.
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (cert.project_id + '.firebasestorage.app')
  });
}

/* The widget's iframe is served from OUR origin, never the partner's, so this
   allowlist never has to grow when a partner signs. That is a property of the
   iframe architecture, not an accident: the partner's domain is irrelevant here
   because no request is ever made from it. */
const CORS_ORIGINS = new Set([
  'https://verdict.ventrify.io', 'https://os.ventrify.io', 'https://venture.ventrify.io',
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

/* ── LIMITS ───────────────────────────────────────────────────────────────────
   The flow runs the pre-screen on submit with no email confirmation, which is a
   deliberate product choice and an uncapped spend unless something caps it. A
   pre-screen was MEASURED at $1.14 mean (2026-10-31, two runs). These are the
   caps; they are the only thing between a public form and a bill. */
const LIMITS = {
  /* 30 days in production. Set INTAKE_EMAIL_COOLDOWN_DAYS=0 while testing, or
     the second submission from your own address returns 429 and looks like a bug. */
  perEmailDays:   Number(process.env.INTAKE_EMAIL_COOLDOWN_DAYS ?? 30),
  perIpPerDay:    5,      // a shared office NATs; 5 is generous for humans, useless for a loop
  perPartnerMonth: Number(process.env.INTAKE_PARTNER_CAP || 100),
  /* THE AUTHORITY on deck size. The widget's caption and its pick-time check
     read their number from ?maxMb — set that to match this, or the founder is
     told one limit and refused by another. */
  maxDeckBytes:   Math.max(1, Number(process.env.INTAKE_MAX_DECK_MB || 40)) * 1024 * 1024,
};
const DECK_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream',           // Keynote arrives as this from some browsers
]);

const esc = s => String(s == null ? '' : s).trim();
const clean = (s, max) => esc(s).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;
/* Free-mail is not rejected — plenty of real founders use it — but it is recorded,
   because it is the single strongest signal in an abuse review. */
const FREE_MAIL = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','proton.me']);

const ipOf = req => String(
  (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || ''
).trim();

/* ── THE CAPS ARE DOCUMENT IDS, NOT QUERIES ───────────────────────────────────
   The first version asked Firestore three questions of the form "this field
   equals X and createdAt is after Y". Firestore refuses that shape without a
   purpose-built composite index and answers FAILED_PRECONDITION, which arrived
   as a 500 on the first real submission. The offline gate passed it because a
   fake Firestore has no index rules — so the gate was wrong about the world,
   not just the code.

   Creating three indexes would fix the symptom and leave the shape. These are
   counters addressed BY ID instead: a document id never needs an index, costs
   one read, and cannot grow a new failure mode when a fourth cap is added. */
const crypto = require('crypto');
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const dayKey   = d => new Date(d).toISOString().slice(0, 10);   // YYYY-MM-DD
const monthKey = d => new Date(d).toISOString().slice(0, 7);    // YYYY-MM
const guardIds = (email, ip, partner, now) => ({
  email:   'e_' + crypto.createHash('sha1').update(email).digest('hex'),
  ip:      'ip_' + slug(ip || 'none') + '_' + dayKey(now),
  partner: 'p_' + slug(partner) + '_' + monthKey(now),
});

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  try {
    ensureAdmin();
    const db = admin.firestore();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    /* ── PHASE 2 — the deck landed ──────────────────────────────────────────── */
    if (body.uploaded) {
      const id = clean(body.intakeId, 64);
      if (!id) { res.status(400).json({ error: 'intake_id_required' }); return; }
      const ref = db.collection('intakes').doc(id);
      const snap = await ref.get();
      if (!snap.exists) { res.status(404).json({ error: 'unknown_intake' }); return; }
      if (snap.data().state !== 'awaiting_deck') { res.status(409).json({ error: 'already_submitted' }); return; }

      /* TRUST THE BUCKET, NOT THE CALLER. The client says it uploaded; the only
         thing that proves it is the object's own metadata. A client that lies
         here would otherwise park an intake with no deck behind it. */
      const file = admin.storage().bucket().file(snap.data().deckPath);
      const [exists] = await file.exists();
      if (!exists) { res.status(409).json({ error: 'deck_not_found' }); return; }
      const [meta] = await file.getMetadata();
      const size = Number(meta.size || 0);
      if (!size || size > LIMITS.maxDeckBytes) {
        await file.delete().catch(() => {});
        res.status(413).json({ error: 'deck_too_large' }); return;
      }

      await ref.update({
        state: 'submitted',
        deckBytes: size,
        deckContentType: meta.contentType || null,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(200).json({ ok: true, intakeId: id });
      return;
    }

    /* ── PHASE 1 — park the submission, hand back a place to put the deck ───── */
    const email   = clean(body.email, 160).toLowerCase();
    const name    = clean(body.name, 120);
    const company = clean(body.company, 120);
    const partner = clean(body.partner, 80) || 'direct';
    const room    = clean(body.room, 600);
    const share   = body.share !== false;
    const fileName = clean(body.fileName, 180) || 'deck.pdf';
    const contentType = clean(body.contentType, 120) || 'application/pdf';

    if (!EMAIL_RE.test(email)) { res.status(400).json({ error: 'email_invalid' }); return; }
    if (name.length < 2)       { res.status(400).json({ error: 'name_required' }); return; }
    if (company.length < 2)    { res.status(400).json({ error: 'company_required' }); return; }
    if (!DECK_TYPES.has(contentType)) { res.status(415).json({ error: 'deck_type_unsupported' }); return; }
    /* The size the client DECLARES, refused here so a 200MB upload is never
       started. It is not trusted — phase 2 measures the object itself — but a
       truthful client should never be made to send bytes that will be binned. */
    const declared = Number(body.size || 0);
    if (declared > LIMITS.maxDeckBytes) {
      res.status(413).json({ error: 'deck_too_large', maxMb: Math.round(LIMITS.maxDeckBytes / 1048576) }); return;
    }
    if (room && !/^https?:\/\//i.test(room)) { res.status(400).json({ error: 'room_not_a_url' }); return; }

    /* A partner allowlist, when one is configured. Without it any site could
       embed the script and spend the budget under someone else's name. */
    const allowed = (process.env.INTAKE_PARTNERS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(partner)) { res.status(403).json({ error: 'partner_unknown' }); return; }

    const ip = ipOf(req);
    const col = db.collection('intakes');
    const now = Date.now();
    const G = guardIds(email, ip, partner, now);
    const guards = db.collection('intake_guards');

    /* Three reads, by id, in one round trip. No query, so no index, ever. */
    const [gEmail, gIp, gPartner] = await db.getAll(
      guards.doc(G.email), guards.doc(G.ip), guards.doc(G.partner)
    );

    if (LIMITS.perEmailDays > 0 && gEmail.exists) {
      const last = gEmail.data().lastAt;
      const ms = last && typeof last.toMillis === 'function' ? last.toMillis() : Number(last || 0);
      if (now - ms < LIMITS.perEmailDays * 864e5) {
        res.status(429).json({ error: 'already_submitted_recently' }); return;
      }
    }
    if (ip && gIp.exists && Number(gIp.data().n || 0) >= LIMITS.perIpPerDay) {
      res.status(429).json({ error: 'rate_limited' }); return;
    }
    if (gPartner.exists && Number(gPartner.data().n || 0) >= LIMITS.perPartnerMonth) {
      res.status(429).json({ error: 'partner_cap_reached' }); return;
    }

    const ref = col.doc();
    const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120);
    const deckPath = `intake/${ref.id}/${safe}`;

    /* Fifteen minutes, one path, one method, one content type. A URL that leaked
       buys nothing but the right to overwrite a deck nobody has read yet. */
    const [uploadUrl] = await admin.storage().bucket().file(deckPath).getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType,
    });

    await ref.set({
      state: 'awaiting_deck',
      partner, email, name, company, room: room || null,
      shareWithPartner: share,
      freeMail: FREE_MAIL.has(email.split('@')[1] || ''),
      deckPath, deckFileName: safe,
      ip: ip || null,
      day: dayKey(now), period: monthKey(now),
      userAgent: clean(req.headers['user-agent'], 300) || null,
      claimedBy: null, orgId: null, engagementId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    /* Counted only once the intake exists, so a rejected submission never burns
       anyone's allowance. increment() is atomic, which two submissions landing in
       the same second rely on. */
    const inc = admin.firestore.FieldValue.increment(1);
    await Promise.all([
      guards.doc(G.email).set({ lastAt: admin.firestore.FieldValue.serverTimestamp() }),
      ip ? guards.doc(G.ip).set({ n: inc }, { merge: true }) : null,
      guards.doc(G.partner).set({ n: inc }, { merge: true }),
    ].filter(Boolean));

    res.status(200).json({ ok: true, intakeId: ref.id, uploadUrl, contentType });
  } catch (e) {
    /* Never echo an internal message to an unauthenticated caller. */
    console.error('[intake]', e && e.stack || e);
    res.status(500).json({ error: 'intake_failed' });
  }
};
