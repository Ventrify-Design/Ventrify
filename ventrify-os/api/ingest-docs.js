/**
 * POST /api/ingest-docs — register ONE uploaded founder document as source material
 * and extract its text (NO AI, just parsing).
 *
 * Two upload paths:
 *   • Small files (≤4MB): sent inline as base64 — { file: { name, dataBase64 } }.
 *   • Large files (>4MB): uploaded by the browser STRAIGHT to Storage (bypassing the
 *     serverless body limit), then registered here — { file: { name }, storagePath }.
 *     The server downloads the bytes from Storage to extract text.
 *
 * Extracted text → engagements/{id}/founderDocs/{docId}. The ORIGINAL is kept for a
 * direct read when we can't extract text (scanned/signed PDFs): large files stay in
 * Storage (storagePath); small files go into a rawChunks base64 subcollection. The
 * cloud run later reads these to steer the cards / score the venture.
 *
 * Env: FIREBASE_SERVICE_ACCOUNT (already set).
 */

const admin = require('firebase-admin');

const STORAGE_BUCKET = 'ventrify-os.firebasestorage.app';

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    storageBucket: STORAGE_BUCKET,
  });
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
    let storagePath = (typeof body.storagePath === 'string' && body.storagePath) ? body.storagePath : null;
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId || !name || (!file.dataBase64 && file.text == null && !storagePath)) { res.status(400).json({ error: 'bad_request' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const engSnap = await db.collection('engagements').doc(engagementId).get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const eng = engSnap.data();
    const orgId = eng.orgId || 'default';

    // Authz: the founder of this engagement, or an operator of its org. THIS is the real
    // gate — Storage's own write rule is intentionally permissive (auth + size), so the
    // server validates who may register a doc and that the path is this engagement's.
    const isFounder = caller && caller === String(eng.founderEmail || '').toLowerCase();
    let isOperator = false;
    if (!isFounder) {
      const orgSnap = await db.collection('organisations').doc(orgId).get();
      const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
      isOperator = ops.includes(caller);
    }
    if (!isFounder && !isOperator) { res.status(403).json({ error: 'forbidden' }); return; }

    // A client may only register a Storage object under THIS engagement's prefix.
    if (storagePath && !storagePath.startsWith(`founder-docs/${engagementId}/`)) { res.status(403).json({ error: 'bad_storage_path' }); return; }

    // Idempotent by name — re-uploading the same file REPLACES its record (and any stale
    // raw chunks / Storage original) instead of duplicating, so re-uploading a data room is safe.
    const fdCol = db.collection('engagements').doc(engagementId).collection('founderDocs');
    const existing = await fdCol.where('name', '==', name).limit(1).get();
    const isNewDoc = existing.empty;
    const docRef = isNewDoc ? fdCol.doc() : existing.docs[0].ref;
    if (!isNewDoc) {
      const prev = existing.docs[0].data();
      const oldChunks = await docRef.collection('rawChunks').get();
      if (!oldChunks.empty) { let b = db.batch(); oldChunks.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
      if (prev.storagePath && prev.storagePath !== storagePath) { try { await bucket.file(prev.storagePath).delete(); } catch (e) { /* orphan, harmless */ } }
    }
    const ext = (name.split('.').pop() || '').toLowerCase();

    // Resolve the original bytes. Large files already live in Storage (download to extract);
    // small files arrive inline as base64; text-only means the client pre-extracted.
    let buf = null;
    if (storagePath) {
      try { const [dl] = await bucket.file(storagePath).download(); buf = dl; }
      catch (e) { res.status(422).json({ error: 'storage_read_failed', detail: String((e && e.message) || e).slice(0, 200) }); return; }
    } else if (file.dataBase64 != null) {
      buf = Buffer.from(String(file.dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
    }

    // Extract text (best-effort). Empty/throw is NOT fatal — we keep the original for a direct read.
    let text = '', extraction = 'ok', extractionDetail = '';
    if (file.text != null) {
      text = String(file.text);    // pre-extracted client-side
    } else if (buf) {
      try { text = await extractText(name, buf); }
      catch (e) { extraction = 'error'; extractionDetail = String((e && e.message) || e).slice(0, 300); }
    }
    text = (text || '').replace(/\n{3,}/g, '\n\n').trim();
    if (extraction === 'ok' && !text) { extraction = 'empty'; extractionDetail = 'No machine-readable text — likely a scanned/image PDF; the agent reads the original file directly.'; }

    const truncated = text.length > 200000;     // Firestore 1MB doc cap
    if (truncated) text = text.slice(0, 200000);

    // Keep the original for direct read when text didn't extract:
    //  - large files already in Storage (storagePath);
    //  - small inline files → Firestore base64 chunks.
    const RAW_CHUNK = 700000;
    let rawChunks = 0, rawB64 = null;
    if (extraction !== 'ok' && !storagePath && buf) {
      rawB64 = buf.toString('base64');
      rawChunks = Math.ceil(rawB64.length / RAW_CHUNK);
    }

    // The ONLY unusable case: no readable text AND no stored original anywhere.
    if (extraction !== 'ok' && !text && !rawChunks && !storagePath) {
      res.status(422).json({ error: 'no_text', detail: 'No readable text, and no original was stored. Re-upload the file so the original can be kept for a direct read.' });
      return;
    }

    const hasOriginal = !!(rawChunks || storagePath);
    await docRef.set({
      name, docType, chars: text.length, truncated, text,
      extraction, extractionDetail,
      storagePath: storagePath || null,
      rawEncoding: rawChunks ? 'base64' : null, rawExt: hasOriginal ? (ext || 'bin') : null,
      rawMime: hasOriginal ? mimeFor(ext) : null, rawChunks,
      uploadedBy: caller, uploadedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (rawChunks) {
      let batch = db.batch(), ops = 0;
      for (let i = 0; i < rawChunks; i++) {
        batch.set(docRef.collection('rawChunks').doc(String(i).padStart(4, '0')), { i, data: rawB64.slice(i * RAW_CHUNK, (i + 1) * RAW_CHUNK) });
        if (++ops === 400) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
      if (ops) await batch.commit();
    }

    const engUpdate = {};
    if (isNewDoc) engUpdate.founderDocCount = admin.firestore.FieldValue.increment(1);
    if (docType === 'pitch') engUpdate.pitchDoc = { name, at: admin.firestore.FieldValue.serverTimestamp() };
    if (Object.keys(engUpdate).length) await db.collection('engagements').doc(engagementId).set(engUpdate, { merge: true });

    res.status(200).json({ ok: true, id: docRef.id, name, docType, chars: text.length, truncated, extraction, needsDeepRead: extraction !== 'ok', storedOriginal: hasOriginal });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
