// READ-ONLY. Where did the most recent pre-screen runs get to? No writes, no model calls, no cost.
import { readFile } from 'node:fs/promises';
import admin from 'firebase-admin';

const env = await readFile('/Users/antonywhenman/Desktop/Ventrify/ventrify-os/.env.local', 'utf8');
const raw = (env.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!raw) { console.error('no FIREBASE_SERVICE_ACCOUNT'); process.exit(1); }
// .env.local stores this as a dotenv DOUBLE-QUOTED value: the outer quotes are part of the file and
// every newline is written as a literal backslash-n. In Vercel the same variable holds raw JSON, which
// is why api/memo.js can JSON.parse it directly and this cannot.
//
// ONE TRANSFORM, NOT A LADDER OF GUESSES. A backslash-n OUTSIDE a JSON string is structural whitespace
// and must become a real newline; one INSIDE a string belongs to the private key and must stay an
// escape so JSON.parse turns it into a newline itself. Stripping them all parses fine and silently
// produces an unusable PEM — which is exactly what the first attempt at this did.
function parseServiceAccount(v) {
  const body = v.trim().replace(/^"|"$/g, '');
  let inString = false, out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' && body[i - 1] !== '\\') { inString = !inString; out += c; continue; }
    if (c === '\\' && body[i + 1] === 'n') {
      out += inString ? '\\n' : '\n';     // keep the escape inside a string; real newline outside
      i++; continue;
    }
    out += c;
  }
  const sa = JSON.parse(out);
  if (sa.private_key && !sa.private_key.includes('\n')) throw new Error('private key lost its newlines');
  return sa;
}
const sa = parseServiceAccount(raw);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v ? Date.parse(v) || 0 : 0);
const snap = await db.collection('engagements').get();
const rows = snap.docs
  .map(d => ({ id: d.id, x: d.data() }))
  .sort((a, b) => Math.max(ms(b.x.updatedAt), ms(b.x.createdAt), ms(b.x.prescreenClaimedAt))
                - Math.max(ms(a.x.updatedAt), ms(a.x.createdAt), ms(a.x.prescreenClaimedAt)));

console.log(`\n${snap.size} engagements. Five most recently touched:\n`);
for (const { id, x } of rows.slice(0, 5)) {
  const docs = await db.collection('engagements').doc(id).collection('founderDocs').get();
  const ps2 = await db.collection('engagements').doc(id).collection('prescreen2').get();
  const when = new Date(Math.max(ms(x.updatedAt), ms(x.createdAt), ms(x.prescreenClaimedAt)) || 0).toISOString().replace('T', ' ').slice(0, 16);
  console.log(`── ${x.name || '(unnamed)'}  [${id}]`);
  console.log(`   touched ${when} · tier=${x.tier || '—'} · gate=${x.gateStatus || '—'} · docs=${docs.size}`);
  console.log(`   deck: ${x.pitchDoc ? x.pitchDoc.name : 'none'}`);
  console.log(`   claim taken: ${x.prescreenClaimedAt ? new Date(ms(x.prescreenClaimedAt)).toISOString().slice(11, 16) : 'no'} · finished: ${x.prescreenRanAt ? 'yes' : 'no'}`);
  const v2 = x.prescreen2;
  console.log(`   prescreen2 snapshot: ${v2 ? `state=${v2.state} band=${v2.band} cost=$${v2.costUsd} tiers=${JSON.stringify(v2.tiers || {})}` : 'none'}`);
  console.log(`   v1 range: ${x.prescreen ? `${x.prescreen.floor}-${x.prescreen.ceiling}` : 'none'}`);
  if (ps2.size) {
    console.log(`   phase docs (${ps2.size}):`);
    for (const d of ps2.docs) {
      const y = d.data();
      const bits = [];
      if (d.id === 'brief') bits.push(`readable=${y.brief?.readable}`, `claims=${(y.brief?.claims || []).length}`, `edits=${y.edits || 0}`);
      if (d.id === 'research') bits.push(`sources=${(y.sources || []).length}`, `readable=${y.readable}`);
      if (d.id.startsWith('n-')) bits.push(`kept=${(y.points || []).length}`, `dropped=${(y.dropped || []).length}`, y.skipped || '');
      console.log(`     ${d.id.padEnd(16)} ${bits.filter(Boolean).join(' · ')}`);
    }
  } else if (v2 || x.prescreen) { console.log('   phase docs: none left (cleared or v1 run)'); }
  console.log('');
}
