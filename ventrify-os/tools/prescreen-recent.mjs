// READ-ONLY. What has actually been written in the last few hours, across every engagement?
// `updatedAt` on the engagement is not touched by a document upload, so the engagement list alone
// cannot tell you whether a run has just started. The subcollection timestamps can.
import { readFile } from 'node:fs/promises';
import admin from 'firebase-admin';
const env = await readFile('/Users/antonywhenman/Desktop/Ventrify/ventrify-os/.env.local', 'utf8');
const raw = (env.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m) || [])[1].trim();
const body = raw.replace(/^"|"$/g, '');
let inStr = false, out = '';
for (let i = 0; i < body.length; i++) {
  const c = body[i];
  if (c === '"' && body[i - 1] !== '\\') { inStr = !inStr; out += c; continue; }
  if (c === '\\' && body[i + 1] === 'n') { out += inStr ? '\\n' : '\n'; i++; continue; }
  out += c;
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(out)) });
const db = admin.firestore();
const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v ? Date.parse(v) || 0 : 0);
const HOURS = Number(process.argv[2] || 6);
const since = Date.now() - HOURS * 3600e3;
const events = [];
for (const d of (await db.collection('engagements').get()).docs) {
  const name = d.data().name || d.id;
  for (const col of ['founderDocs', 'prescreen2', 'prescreenCategories']) {
    for (const s of (await d.ref.collection(col).get()).docs) {
      const t = Math.max(ms(s.data().at), ms(s.data().ingestedAt), ms(s.data().createdAt), ms(s.data().editedAt));
      if (t > since) events.push({ t, name, col, id: s.id });
    }
  }
  for (const f of ['prescreenRanAt', 'prescreenClaimedAt', 'updatedAt']) {
    const t = ms(d.data()[f]);
    if (t > since) events.push({ t, name, col: 'engagement', id: f });
  }
}
events.sort((a, b) => a.t - b.t);
console.log(`\n${events.length} write(s) in the last ${HOURS}h · now ${new Date().toISOString().slice(11, 19)}Z\n`);
for (const e of events.slice(-40)) {
  console.log(`  ${new Date(e.t).toISOString().slice(11, 19)}  ${e.name.padEnd(22)} ${e.col.padEnd(20)} ${e.id}`);
}
if (!events.length) console.log('  nothing — no run has written anything, which is what a bad_action failure looks like.');
