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
const { parseServiceAccount } = await import('./contract-auth.mjs');
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
/* THE PARSER ALREADY EXISTED. contract-auth.mjs exports parseServiceAccount and
   it solves exactly this: .env.local stores the value with the outer quotes on,
   every newline written as a literal backslash-n, and the inner JSON quotes left
   unescaped — and the pretty-printing newlines are indistinguishable from the
   PRIVATE KEY's own, so converting all of them yields a PEM that parses and
   cannot sign. It even asserts the key kept its newlines. I wrote a second copy
   of this before finding the first; one of them had to go, and it was mine. */
let cert;
try { cert = parseServiceAccount(raw); } catch (e) { cert = null; }
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
