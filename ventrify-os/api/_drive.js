/**
 * _drive — read a founder's Google Drive data room, server-side.
 *
 * WHY A SERVICE ACCOUNT, AND NOT OAUTH. Reading a user's Drive needs the `drive.readonly` scope, which Google
 * classes as RESTRICTED: production use means app verification and, for restricted scopes, a third-party
 * security assessment. A service account sidesteps all of it — the founder shares the folder with its address
 * the way they'd share with a person, and access is exactly what they granted and nothing else. The account
 * deliberately holds NO project roles: shared folders are the entirety of its reach.
 *
 * WHY SERVER-SIDE. The credential never reaches a browser. The client asks for a manifest, then asks for one
 * file at a time; each request stays small enough for a serverless function, and nothing privileged is shipped
 * to the page.
 *
 * The leading underscore keeps this OFF Vercel's function count — the OS project sits at its 12-function cap
 * (see api/memo.js and api/send-email.js, which dispatch on an action/type field for the same reason).
 */
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';

// Mirrors the client's SUPPORTED list in workspace/engagement-actions.js — the extraction pipeline downstream
// reads exactly these. Anything else in the room is left alone rather than ingested as an unreadable blob.
const SUPPORTED = /\.(pdf|docx?|xlsx?|xlsm|txt|md|csv)$/i;

// NOT DOCUMENTS, AND A REAL DATA ROOM IS FULL OF THEM. `~$…` are the owner stubs Word leaves while a file is
// open (0 bytes, no content); `._…` are macOS resource forks; `.DS_Store` is Finder's folder state. The test
// room had seven lock stubs and four .DS_Store files among 49 entries. Ingesting them inflates the document
// count the operator sees and pollutes what the agents are told the founder supplied.
const JUNK = /^(~\$|\._)|^\.DS_Store$|^Thumbs\.db$|^Icon\r?$/i;

// Native Google formats cannot be downloaded — they must be EXPORTED. Left unhandled, a room full of Google
// Docs ingests as a row of empty files, which is the classic silent failure of this integration.
const EXPORT_AS = {
  'application/vnd.google-apps.document': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', ext: 'pdf' },
};
const FOLDER_MIME = 'application/vnd.google-apps.folder';

let cached = { token: null, expires: 0 };

// Tolerant of how the key actually gets pasted into a dashboard. A service-account JSON is long and arrives
// by copy-paste, so it turns up wrapped in quotes, or with the variable NAME still attached
// (`DRIVE_SERVICE_ACCOUNT={...}`) when someone pastes a whole .env line into the value box. Both are obvious
// in intent and cost a deploy cycle each to discover, so they are accepted rather than rejected.
function credentials() {
  let raw = String(process.env.DRIVE_SERVICE_ACCOUNT || '').trim();
  if (!raw) throw new Error('drive_not_configured');
  raw = raw.replace(/^DRIVE_SERVICE_ACCOUNT\s*=\s*/, '').trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) raw = raw.slice(1, -1).trim();
  let c;
  try { c = JSON.parse(raw); }
  catch (e) {
    // Describe the SHAPE of what is stored, never its content: a Secret cannot be read back from the
    // dashboard, so without this the only way to diagnose a bad paste is to delete and retry blind.
    const shape = `${raw.length} chars, starts "${raw.slice(0, 6).replace(/[^\x20-\x7e]/g, '·')}", ` +
      `${/^\{/.test(raw) ? 'opens with {' : 'does NOT open with {'}, ` +
      `${raw.includes('service_account') ? 'contains service_account' : 'no service_account'}, ` +
      `${raw.includes('BEGIN PRIVATE KEY') ? 'contains a private key' : 'NO private key'}`;
    throw new Error('drive_credential_malformed: the value is not JSON — it should be the whole service-account file, starting with {. Stored value is ' + shape);
  }
  if (!c.client_email || !c.private_key) throw new Error('drive_credential_malformed: JSON parsed but has no client_email / private_key');
  return c;
}

// A signed JWT exchanged for an access token — the documented service-account flow, done with Node's own
// crypto rather than a dependency. ventrify-os ships no lockfile, so every added package is a version we do
// not control at deploy time; this is ~20 lines and removes that risk entirely.
async function accessToken() {
  if (cached.token && Date.now() < cached.expires - 60_000) return cached.token;
  const c = credentials();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: c.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(c.private_key).toString('base64url');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('drive_auth_failed: ' + (d.error_description || d.error || r.status));
  cached = { token: d.access_token, expires: Date.now() + (d.expires_in || 3600) * 1000 };
  return cached.token;
}

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + (await accessToken()) } });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const msg = (d.error && d.error.message) || ('HTTP ' + r.status);
    // Drive answers 404 for "exists but not shared with you" as well as "does not exist", so say both.
    if (r.status === 404) throw new Error('drive_not_shared: the folder was not found, or is not shared with the data-room reader');
    throw new Error('drive_error: ' + msg);
  }
  return r.json();
}

/** Accepts a folder URL or a bare id. Returns the id, or null if the link is not a Drive folder link. */
function parseFolderId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{15,}$/.test(s)) return s;                       // already an id
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/)                    // .../drive/folders/<id>
    || s.match(/[?&]id=([A-Za-z0-9_-]+)/)                             // ...open?id=<id>
    || s.match(/\/drive\/u\/\d+\/folders\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** The folder itself — used to show the operator WHICH room they just linked before anything is ingested. */
async function folderMeta(folderId) {
  const d = await api(`/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true`);
  if (d.mimeType !== FOLDER_MIME) throw new Error('drive_not_a_folder: that link points at a file, not a folder');
  return { id: d.id, name: d.name };
}

/**
 * Walk the room. Real data rooms are foldered — the test room nests two deep — so a flat listing silently
 * misses most of the evidence. Depth and count are bounded so a pathological share cannot hang the request.
 */
async function listFolder(folderId, { maxDepth = 8, maxFiles = 500 } = {}) {
  const files = [], skipped = [];
  let folders = 0, truncated = false;

  const walk = async (id, prefix, depth) => {
    if (depth > maxDepth || truncated) return;
    let pageToken = null;
    do {
      const q = encodeURIComponent(`'${id}' in parents and trashed=false`);
      const d = await api(`/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? '&pageToken=' + pageToken : ''}`);
      for (const f of d.files || []) {
        if (f.mimeType === FOLDER_MIME) { folders++; await walk(f.id, prefix + f.name + '/', depth + 1); continue; }
        if (files.length >= maxFiles) { truncated = true; return; }
        if (JUNK.test(f.name)) { skipped.push({ name: prefix + f.name, reason: 'not a document (editor or OS stub)' }); continue; }
        const exp = EXPORT_AS[f.mimeType];
        const name = exp ? `${f.name}.${exp.ext}` : f.name;           // a Google Doc has no extension of its own
        if (!exp && !SUPPORTED.test(name)) { skipped.push({ name: prefix + f.name, reason: 'unsupported file type' }); continue; }
        files.push({
          driveId: f.id, name, path: prefix + name,
          mimeType: f.mimeType, exportMime: exp ? exp.mime : null,
          size: Number(f.size || 0), modifiedTime: f.modifiedTime || null,
        });
      }
      pageToken = d.nextPageToken;
    } while (pageToken && !truncated);
  };

  await walk(folderId, '', 0);

  // THE SAME DOCUMENT TWICE IS STILL ONE DOCUMENT. The test room holds Unit_Economics_v21 (FINAL).pdf at the
  // root AND inside Financials/. Ingesting both would pay to extract it twice and would tell the agents the
  // founder supplied more evidence than he did. Keyed on name + byte size, keeping the shallowest copy.
  const seen = new Map();
  const unique = [];
  for (const f of files.sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    const key = f.name.toLowerCase() + '|' + f.size;
    if (seen.has(key)) { skipped.push({ name: f.path, reason: 'duplicate of ' + seen.get(key) }); continue; }
    seen.set(key, f.path); unique.push(f);
  }

  return { files: unique, skipped, folders, truncated };
}

/** The bytes of one file — exported first when it is a native Google format. */
async function fetchFile(file) {
  const token = await accessToken();
  const url = file.exportMime
    ? `${API}/files/${file.driveId}/export?mimeType=${encodeURIComponent(file.exportMime)}`
    : `${API}/files/${file.driveId}?alt=media&supportsAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('drive_download_failed: ' + file.name + ' (HTTP ' + r.status + ')');
  return Buffer.from(await r.arrayBuffer());
}

module.exports = { parseFolderId, folderMeta, listFolder, fetchFile, SUPPORTED, JUNK, EXPORT_AS };
