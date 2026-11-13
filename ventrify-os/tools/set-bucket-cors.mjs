/**
 * tools/set-bucket-cors.mjs — apply firebase/storage-cors.json to the bucket.
 *
 * The browser PUTs a founder's deck straight to Cloud Storage using a signed URL
 * minted by /api/intake, because a 40MB deck cannot go through a serverless
 * function body. A cross-origin PUT is blocked unless the BUCKET says the origin
 * is allowed — and that is a bucket-level setting, not something the rules file
 * or the SDK can express.
 *
 * gcloud is the documented way and it is a ~1GB install for one call. This does
 * the same thing with firebase-admin, which is already a dependency.
 *
 *   cd ventrify-os
 *   vercel env pull .env.local        # brings down FIREBASE_SERVICE_ACCOUNT
 *   node tools/set-bucket-cors.mjs    # --dry-run to only read the current config
 *
 * It READS THE CONFIG BACK and prints what the bucket actually holds. A write
 * that returned no error is not evidence the bucket changed.
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry-run');

/* A dotenv line holding JSON is escaped TWICE and the two layers disagree about
   \n: the outer file escapes it, the inner JSON needs it kept. Unescaping on the
   way out corrupts the private key and JSON.parse reports a control character at
   a position that tells you nothing. So this does not guess at one unescaping —
   it keeps the raw value and lets readServiceAccount() try the candidates and
   check which one yields a key that actually begins with a PEM header. */
function loadEnvLocal() {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('\n  FIREBASE_SERVICE_ACCOUNT is not set.\n' +
    '  Run this first, from the ventrify-os folder:\n\n    vercel env pull .env.local\n');
  process.exit(1);
}

/* The same value arrives in three shapes depending on where it came from: clean
   JSON from Vercel, JSON with the private key's newlines left literal (which a
   strict parse rejects as a control character), or base64. Accept all three —
   the alternative is a confusing failure on a value that is actually correct. */
/* ventrify-os/.env.local holds this value in a shape no strict reader accepts:
   the outer quotes are present, every newline is written as a literal backslash-n,
   and the inner JSON quotes are NOT escaped. The trap is that the pretty-printing
   newlines and the PRIVATE KEY's own newlines are the same two characters, so
   converting all of them puts raw control characters inside a string literal —
   which is the "Bad control character" a naive repair reports.
   Only the ones OUTSIDE a string may be converted, so this tracks string state. */
function unwrapLiteralNewlines(t) {
  let out = '', inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (c === '\\') { out += c + (t[i + 1] || ''); i++; continue; }  // keep the escape intact
      if (c === '"') inStr = false;
      out += c;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '\\' && t[i + 1] === 'n') { out += '\n'; i++; continue; }
    out += c;
  }
  return out;
}

function readServiceAccount(v) {
  const unquote = t => (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
    ? t.slice(1, -1) : t;
  const base = unquote(v.trim());
  const candidates = [
    v,
    base,
    unwrapLiteralNewlines(base),
    base.replace(/\\"/g, '"'),
    unwrapLiteralNewlines(base.replace(/\\"/g, '"')),
    (() => { try { return Buffer.from(base, 'base64').toString('utf8'); } catch (e) { return ''; } })(),
  ];
  for (const t of candidates) {
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      /* The only check that means anything: a key that is actually a key. */
      if (o && o.project_id && typeof o.private_key === 'string'
          && o.private_key.includes('-----BEGIN')) return o;
    } catch (e) {}
  }
  return null;
}

const cert = readServiceAccount(raw);
if (!cert) {
  console.error('\n  FIREBASE_SERVICE_ACCOUNT is set but could not be read as a service account.\n' +
    '  Pull a clean copy:  vercel env pull .env.local\n');
  process.exit(1);
}

const admin = require('firebase-admin');
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || (cert.project_id + '.firebasestorage.app');
admin.initializeApp({ credential: admin.credential.cert(cert), storageBucket: bucketName });

const bucket = admin.storage().bucket();
const wanted = JSON.parse(readFileSync(join(ROOT, 'firebase', 'storage-cors.json'), 'utf8'));

console.log('\n  bucket   ' + bucketName);

try {
  const [before] = await bucket.getMetadata();
  console.log('  before   ' + (before.cors ? JSON.stringify(before.cors) : '(no cors set)'));

  if (DRY) { console.log('\n  --dry-run: nothing written.\n'); process.exit(0); }

  await bucket.setCorsConfiguration(wanted);

  /* READ IT BACK. The call returning cleanly is not proof the bucket changed. */
  const [after] = await bucket.getMetadata();
  const got = after.cors || [];
  const origins = new Set(got.flatMap(r => r.origin || []));
  const missing = wanted.flatMap(r => r.origin).filter(o => !origins.has(o));

  console.log('  after    ' + JSON.stringify(got));
  if (missing.length) {
    console.error('\n  ✗ these origins did not land: ' + missing.join(', ') + '\n');
    process.exit(1);
  }
  console.log('\n  ✓ CORS applied. The widget can now upload a deck from:\n     ' +
    [...origins].join('\n     ') + '\n');
} catch (e) {
  const msg = String(e && e.message || e);
  console.error('\n  ✗ ' + msg);
  if (/permission|forbidden|403/i.test(msg)) {
    console.error(
      '\n  The service account cannot change bucket settings. Give it the role once,\n' +
      '  in Google Cloud Console → IAM → find ' + (cert.client_email || 'the service account') + '\n' +
      '  → Edit → Add role → "Storage Admin" → Save. Then run this again.\n');
  }
  process.exit(1);
}
