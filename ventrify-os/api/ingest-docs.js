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

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv' };
const mimeFor = ext => MIME[ext] || 'application/octet-stream';

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
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const parts = [];
    (wb.SheetNames || []).forEach(sheetName => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      if (csv && csv.trim()) parts.push(`# Sheet: ${sheetName}\n${csv.trim()}`);
    });
    return parts.join('\n\n');
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
    const docType = body.docType === 'pitch' ? 'pitch' : 'dataroom';
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId || !name || (!file.dataBase64 && file.text == null)) { res.status(400).json({ error: 'bad_request' }); return; }

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

    // Create the doc ref up front so the raw file can be keyed by its id.
    const docRef = db.collection('engagements').doc(engagementId).collection('founderDocs').doc();
    const ext = (name.split('.').pop() || '').toLowerCase();

    // Raw bytes are present for every file uploaded as base64 (all <=4MB files). We
    // ALWAYS keep the original in Storage when we have it, so a document is never lost —
    // even a scanned/signed PDF we can't text-extract stays readable (the assessment
    // agent reads the original directly) and recoverable.
    let buf = null;
    if (file.dataBase64 != null) {
      buf = Buffer.from(String(file.dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
    }

    // Extract text (best-effort). An empty result or a parser throw is NO LONGER fatal —
    // we record the doc anyway and fall back to the stored original for a direct read.
    let text = '', extraction = 'ok', extractionDetail = '';
    if (file.text != null) {
      text = String(file.text);    // pre-extracted client-side (e.g. a large PDF parsed in the browser)
    } else if (buf) {
      try { text = await extractText(name, buf); }
      catch (e) { extraction = 'error'; extractionDetail = String((e && e.message) || e).slice(0, 300); }
    }
    text = (text || '').replace(/\n{3,}/g, '\n\n').trim();    // tidy big blank gaps, keep words
    if (extraction === 'ok' && !text) { extraction = 'empty'; extractionDetail = 'No machine-readable text — likely a scanned/image PDF; the agent reads the original file directly.'; }

    // Keep stored text sane for Firestore (1MB doc cap) — up to ~200k chars.
    const truncated = text.length > 200000;
    if (truncated) text = text.slice(0, 200000);

    // Persist the original bytes INTO FIRESTORE as base64 chunks — no Firebase Storage /
    // Blaze required. Only for docs we couldn't text-extract (scanned/signed PDFs), so the
    // runner can write the original out and the agent reads it directly. Born-digital text
    // docs need no raw copy. Capped by the request body limit (~4.5MB base64 ≈ ~3.3MB raw).
    const RAW_CHUNK = 700000;            // chars/chunk — well under Firestore's 1MiB doc cap
    let rawChunks = 0, rawB64 = null;
    if (extraction !== 'ok' && buf) {
      rawB64 = buf.toString('base64');
      rawChunks = Math.ceil(rawB64.length / RAW_CHUNK);
    }

    // The ONLY unusable case: no readable text AND no storable original.
    if (extraction !== 'ok' && !text && !rawChunks) {
      res.status(422).json({ error: 'no_text', detail: 'No readable text, and no file bytes were sent (a >4MB file parsed in-browser). Re-upload a copy under ~3MB so the original can be stored for a direct read.' });
      return;
    }

    await docRef.set({
      name, docType, chars: text.length, truncated, text,
      extraction, extractionDetail,
      rawEncoding: rawChunks ? 'base64' : null, rawExt: rawChunks ? (ext || 'bin') : null,
      rawMime: rawChunks ? mimeFor(ext) : null, rawChunks,
      uploadedBy: caller, uploadedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Raw bytes → a rawChunks subcollection (each doc well under the 1MiB cap). Kept OUT of
    // the parent doc so listing founderDocs stays light.
    if (rawChunks) {
      let batch = db.batch(), ops = 0;
      for (let i = 0; i < rawChunks; i++) {
        batch.set(docRef.collection('rawChunks').doc(String(i).padStart(4, '0')), { i, data: rawB64.slice(i * RAW_CHUNK, (i + 1) * RAW_CHUNK) });
        if (++ops === 400) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
      if (ops) await batch.commit();
    }

    // Count + (for the pitch) mark the engagement so the page can gate the run on it.
    const engUpdate = { founderDocCount: admin.firestore.FieldValue.increment(1) };
    if (docType === 'pitch') engUpdate.pitchDoc = { name, at: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection('engagements').doc(engagementId).set(engUpdate, { merge: true });

    res.status(200).json({ ok: true, id: docRef.id, name, docType, chars: text.length, truncated, extraction, needsDeepRead: extraction !== 'ok', storedOriginal: !!rawChunks });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
