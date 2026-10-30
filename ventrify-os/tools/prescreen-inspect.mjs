#!/usr/bin/env node
// ============================================================
// prescreen-inspect — READ ONLY. What a pre-screen run actually did.
//
//   node tools/prescreen-inspect.mjs                 → the most recently pre-screened engagement
//   node tools/prescreen-inspect.mjs "Venture Name"  → that one
//
// Reads the engagement, the corpus the server WOULD build from it, and the per-category results the
// run stored. Nothing is written and no model is called, so this costs nothing and can be run as often
// as you like while diagnosing.
//
// It exists because the screen shows a range and nothing else. When a range looks wrong the question is
// always which documents were read and which signals the model could not evidence — and neither is
// visible from the UI.
// ============================================================
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const HERE = new URL('./', import.meta.url).pathname;
const BASE = HERE.replace(/tools\/$/, '');

// same .env.local reader as the containment gate
const src = readFileSync(BASE + 'tools/prescreen-containment.mjs', 'utf8');
const a = src.indexOf('function unquote('), b = src.indexOf('\n}\n', a) + 3;
const unquote = eval('(' + src.slice(a, b).replace('function unquote(', 'function (') + ')');
if (existsSync(BASE + '.env.local')) {
  for (const line of readFileSync(BASE + '.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/); if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    else if (v.startsWith('"') && v.endsWith('"')) v = unquote(v.slice(1, -1));
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.log('No Firebase credentials — see tools/prescreen-containment.mjs.'); process.exit(2); }

const admin = require(BASE + 'node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const PS = require(BASE + 'api/_prescreen.js');

const want = process.argv.slice(2).filter(x => !x.startsWith('--')).join(' ').trim();
const snap = await db.collection('engagements').get();
let docs = snap.docs.filter(d => d.data().prescreen || d.data().tier === 'prescreen');
if (want) docs = docs.filter(d => (d.data().name || '').toLowerCase().includes(want.toLowerCase()));
if (!docs.length) { console.log(want ? `No pre-screened engagement matching "${want}".` : 'No pre-screened engagements yet.'); process.exit(1); }
docs.sort((x, y) => (y.data().prescreenRanAt?.toMillis?.() || 0) - (x.data().prescreenRanAt?.toMillis?.() || 0));
const doc = docs[0], p = doc.data();

console.log(`\n${p.name || doc.id}   tier=${p.tier || 'full'}   ran=${p.prescreenRanAt?.toDate?.().toISOString() || '(not recorded)'}\n`);

const ps = p.prescreen;
if (!ps) console.log('No prescreen snapshot stored — the run did not reach prescreen-finalise.\n');
else {
  console.log(`RANGE  ${ps.floor}–${ps.ceiling}   width ${ps.width}   ${ps.band ? 'band ' + ps.band : 'spans ' + (ps.spans || []).join(' → ')}`);
  console.log(`       ${ps.evidencedWeight}% of the weighted score evidenced · ${ps.docCount} documents · ${ps.corpusTokens} tokens · ${ps.model} · ${ps.draws} draws\n`);
}

// what the corpus builder would select from this room, right now
const fd = await doc.ref.collection('founderDocs').get();
const all = fd.docs.map(d => { const x = d.data(); return { name: x.name, text: x.text || '', docType: x.docType }; }).filter(d => d.text.trim());
const c = PS.buildCorpus(all);
console.log(`CORPUS  ${c.included} of ${c.total} documents · ${c.tokens} tokens${(c.truncated || []).length ? ` · ${c.truncated.length} truncated` : ''}`);
for (const d of PS.orderForBudget(all.slice().sort((x, y) => x.name.localeCompare(y.name)))) {
  const st = (c.truncated || []).includes(d.name) ? 'TRUNC' : c.dropped.includes(d.name) ? '  ·  ' : '  ✓  ';
  console.log(`  ${st} ${String(PS.evidenceTag(d.name).k).padEnd(10)} ${String(Math.round(d.text.length / 4)).padStart(6)}t  ${d.name.slice(-56)}`);
}

// the per-category results the run stored server-side
const cats = await doc.ref.collection('prescreenCategories').get();
console.log(`\nCATEGORIES  ${cats.size} of 7 stored`);
for (const cd of cats.docs.sort((x, y) => x.id.localeCompare(y.id))) {
  const k = cd.data(), sigs = k.signals || [];
  const seen = sigs.filter(s => s.evidenced).length;
  const splits = sigs.filter(s => s.split).length;
  console.log(`\n  ${k.label}  (weight ${k.weight}, ${k.drawsUsed}/3 draws, ${seen}/${sigs.length} evidenced${splits ? `, ${splits} decided by one vote` : ''})`);
  for (const s of sigs) {
    console.log(`    ${s.evidenced ? s.score + '/5' : ' — '}  ${s.slug.padEnd(24)} ${String(s.note || '').slice(0, 72)}`);
  }
}
console.log('');
process.exit(0);
