/**
 * POST /api/ingest-docs — extract text from ONE uploaded founder document and
 * store it on the engagement as source material (NO AI, just parsing).
 *
 * The founder attaches their prior thinking (notes, a deck, a one-pager). We pull
 * the text out (pdf-parse / mammoth / plain) and stash it under
 * engagements/{id}/founderDocs/{docId}. The cloud research run later reads these
 * to steer the provocation cards and backfill blank brief fields.
 *
 * One file per call (keeps each request under the serverless body limit — the
 * client loops over the founder's files). Body:
 *   { idToken, engagementId, file: { name, dataBase64 } }
 * Env: FIREBASE_SERVICE_ACCOUNT (already set).
 */

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

async function extractText(name, buf) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') {
    const pdfParse = require('pdf-parse');
    const r = await pdfParse(buf);
    return r.text || '';
  }
  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const r = await mammoth.extractRawText({ buffer: buf });
    return (r && r.value) || '';
  }
  // txt / md / csv / anything else → treat as utf-8 text
  return buf.toString('utf8');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const file = body.file || {};
    const name = String(file.name || '').trim();
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId || !name || !file.dataBase64) { res.status(400).json({ error: 'bad_request' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();

    const engSnap = await db.collection('engagements').doc(engagementId).get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const eng = engSnap.data();
    const orgId = eng.orgId || 'default';

    // Authz: the founder of this engagement, or an operator of its org.
    const isFounder = caller && caller === String(eng.founderEmail || '').toLowerCase();
    let isOperator = false;
    if (!isFounder) {
      const orgSnap = await db.collection('organisations').doc(orgId).get();
      const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
      isOperator = ops.includes(caller);
    }
    if (!isFounder && !isOperator) { res.status(403).json({ error: 'forbidden' }); return; }

    const buf = Buffer.from(String(file.dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
    let text = '';
    try { text = await extractText(name, buf); }
    catch (e) { res.status(422).json({ error: 'could_not_read', detail: String(e.message || e) }); return; }
    text = (text || '').replace(/\n{3,}/g, '\n\n').trim();    // tidy big blank gaps, keep words
    if (!text) { res.status(422).json({ error: 'no_text', detail: 'No readable text found in the document.' }); return; }
    // Keep it sane for Firestore (1MB doc cap) — store up to ~200k chars.
    const truncated = text.length > 200000;
    if (truncated) text = text.slice(0, 200000);

    const docRef = db.collection('engagements').doc(engagementId).collection('founderDocs').doc();
    await docRef.set({
      name, chars: text.length, truncated, text,
      uploadedBy: caller, uploadedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Lightweight count on the engagement so both surfaces can show "N attached".
    await db.collection('engagements').doc(engagementId).set(
      { founderDocCount: admin.firestore.FieldValue.increment(1) }, { merge: true });

    res.status(200).json({ ok: true, id: docRef.id, name, chars: text.length, truncated });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
