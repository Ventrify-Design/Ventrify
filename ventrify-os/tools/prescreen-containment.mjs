#!/usr/bin/env node
// ============================================================
// prescreen-containment — THE NON-NEGOTIABLE GATE (design/prescreen-spec.md §7).
//
// Run the pre-screen against every engagement already scored in the system, and assert the PUBLISHED
// COMPOSITE falls inside the predicted range. If containment is below ~90%, widen the floor until it is.
//
// WHY THIS IS THE ONE PART THAT DOES NOT BEND. If a founder pre-screens at 55-70 and the paid assessment
// returns 44, the refund is the cheap part of that mistake. A range that does not contain the number it is
// selling is not a lead magnet, it is a liability — and the failure is invisible until a customer finds it.
//
// IT SPENDS REAL MONEY. A full replay is ~$1.60 per engagement, so --live is required and the estimated
// cost is printed and confirmed before anything is sent. Without --live this is a dry run: it proves the
// harness can find the engagements, rebuild each corpus and compute, and tells you what live would cost.
// A dry run deliberately does NOT substitute published scores for model output — that would contain by
// construction and report a pass that means nothing.
//
// Needs FIREBASE_SERVICE_ACCOUNT and (for --live) ANTHROPIC_API_KEY.
// ============================================================
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);

// Load ventrify-os/.env.local if it is there, so the gate runs with a plain `node tools/...` rather than
// needing the caller to remember `set -a; . ./.env.local`. Hand-rolled because this repo has no dotenv
// and a gate should not add a dependency. Real environment variables always win — a CI secret must never
// be silently overridden by a file someone left on disk.
// `vercel env pull` writes a pretty-printed service-account JSON into a double-quoted value, and it
// collapses EVERY newline to a literal \n — both the formatting ones between JSON tokens and the ones
// already escaped inside private_key. Escaping alone can no longer tell them apart, so a blanket
// unescape turns the key's newlines into real control characters inside a string literal and the parse
// dies at "Bad control character" ~170 characters in. (It also dies the other way, unescaping nothing:
// a literal \n BETWEEN tokens is not valid JSON either.)
//
// Tracking whether we are inside a JSON string resolves it exactly: outside a string a \n is only
// formatting and becomes a space; inside one it must stay exactly as written. Values that are not JSON
// take the ordinary single-pass route, because an API key has no business being treated as a document.
function unquote(src) {
  const looksJson = src.trimStart().startsWith('{');
  let out = '', inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (looksJson && ch === '"') { inStr = !inStr; out += ch; continue; }
    if (ch === '\\' && i + 1 < src.length) {
      const c = src[++i];
      if (looksJson && inStr) { out += '\\' + c; continue; }           // keep the escape verbatim
      out += c === 'n' ? (looksJson ? ' ' : '\n')
           : c === 'r' ? (looksJson ? ' ' : '\r')
           : c === 't' ? (looksJson ? ' ' : '\t')
           : c === '"' ? '"' : c === '\\' ? '\\' : '\\' + c;
      continue;
    }
    out += ch;
  }
  return out;
}

(() => {
  const f = new URL('../.env.local', import.meta.url);
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith("'") && v.endsWith("'")) {
      v = v.slice(1, -1);                 // single quotes are literal — nothing to unescape
    } else if (v.startsWith('"') && v.endsWith('"')) {
      v = unquote(v.slice(1, -1));
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  console.log('loaded ventrify-os/.env.local\n');
})();

const admin = require('firebase-admin');
const PS = require('../api/_prescreen.js');
const { VSS_RUBRIC } = await import(new URL('../shared/vss-rubric.js', import.meta.url));

const LIVE = process.argv.includes('--live');
// Fast mode is a research preview with its own allocation. An org without one is refused with
// "rate limit of 0 fast mode input tokens per minute" — a capability answer, not back-pressure, so
// waiting never helps. Speed is therefore decided ONCE, before the first byte is cached, and held for
// the whole run; switching it mid-run would invalidate the prompt cache and reprice every remaining
// probe. --standard skips the probe when you already know the answer.
let SPEED = process.argv.includes('--standard') ? 'standard' : 'fast';
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 0;
const CONTAINMENT_FLOOR = 0.90;

// Opus 5.5 is $4/$20 per MTok standard, doubled to $8/$40 under fast mode. One engagement is
// 1 cache write + 21 cache reads + ~21K output. Cache reads are assumed at 2x the standard $0.20
// under fast mode — UNVERIFIED, and the first real run should correct this.
const estCost = (tokens, speed = SPEED) => {
  const inRate = speed === 'fast' ? 8 : 4, outRate = speed === 'fast' ? 40 : 20;
  const readRate = speed === 'fast' ? 0.4 : 0.2;
  return (tokens / 1e6 * inRate * 1.25) + (21 * tokens / 1e6 * readRate) + (21 * 1000 / 1e6 * outRate);
};

// A service-account JSON saved as a FILE is also accepted, and is the forgiving route: pasting a long
// JSON blob into a shell variable means getting the quoting exactly right, and getting it wrong fails
// later and confusingly. A file has no quoting at all.
const SA_FILE = new URL('../service-account.json', import.meta.url);
if (!process.env.FIREBASE_SERVICE_ACCOUNT && existsSync(SA_FILE)) {
  process.env.FIREBASE_SERVICE_ACCOUNT = readFileSync(SA_FILE, 'utf8');
  console.log('using ventrify-os/service-account.json\n');
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('No Firebase credentials found. Either:');
  console.log('  • run  cd ventrify-os && vercel env pull --environment=production .env.local');
  console.log('  • or save the service-account JSON as  ventrify-os/service-account.json');
  console.log('Both are gitignored.');
  process.exit(2);
}
// A quoted JSON blob that did not survive the shell is the most likely failure here, so say which one.
try { JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
catch { console.log('The Firebase credential is not valid JSON. If you pasted it into .env.local it needs to be on ONE line in single quotes — saving it as ventrify-os/service-account.json avoids that entirely.'); process.exit(2); }
// Valid JSON that is not a service account threw a raw firebase-admin stack trace, which tells a reader
// nothing and looks like the tool is broken. Name the missing fields instead.
{
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const need = ['project_id', 'private_key', 'client_email'].filter(k => !sa[k]);
  if (need.length) {
    console.log(`That JSON is not a Firebase service account — it has no ${need.join(', ')}.`);
    console.log('You want the value of FIREBASE_SERVICE_ACCOUNT from the OS Vercel project, whole.');
    process.exit(2);
  }
}
if (LIVE && (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '[SENSITIVE]')) {
  console.log(process.env.ANTHROPIC_API_KEY === '[SENSITIVE]'
    ? 'ANTHROPIC_API_KEY is the literal placeholder "[SENSITIVE]".\n'
      + 'Vercel refuses to export variables marked Sensitive, so `vercel env pull` wrote that instead of the key.\n'
      + 'Open ventrify-os/.env.local and replace [SENSITIVE] with a real key from console.anthropic.com.'
    : '--live needs ANTHROPIC_API_KEY in ventrify-os/.env.local.');
  process.exit(2);
}
// The last credential failure a reader can hit — a well-shaped key that Firebase rejects — also threw a
// raw stack trace. Every failure in this file now ends in a sentence, not a trace.
try {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
} catch (e) {
  console.log('Firebase rejected that service account: ' + String(e.message || e).split('\n')[0]);
  console.log('Re-copy FIREBASE_SERVICE_ACCOUNT from the OS Vercel project — a truncated private_key is the usual cause.');
  process.exit(2);
}
const db = admin.firestore();

console.log(`prescreen-containment — ${LIVE ? 'LIVE (this spends money)' : 'DRY RUN (no model calls)'}\n`);

// ---- find every engagement that has a published v3 score to check against ----
const engs = await db.collection('engagements').get();
const subjects = [];
for (const doc of engs.docs) {
  const snaps = await doc.ref.collection('investabilitySnapshots').orderBy('at', 'desc').limit(1).get();
  if (snaps.empty) continue;
  const snap = snaps.docs[0].data();
  // Pre-v3 snapshots are on a /35 scale and cannot be compared with a 0-100 range. Skipping them is
  // correct; silently comparing them would manufacture failures that say nothing about the pre-screen.
  //
  // A PUBLISHED SNAPSHOT CARRIES NO `status`. Only buildFormingSnapshot() sets one ('forming'); the
  // runner stamps none, which is why snapshotSummary() in shared/vss-rubric.js reads
  // `status: snap.status || 'scored'`. Testing for status === 'scored' therefore matched nothing, and
  // this gate reported "no subjects" against thirteen perfectly good scored engagements — a filter that
  // silently excludes everything looks exactly like an empty database.
  if ((snap.status || 'scored') !== 'scored' || (snap.maxPossible || 0) !== 100) continue;
  if (typeof snap.composite !== 'number') continue;
  const fd = await doc.ref.collection('founderDocs').get();
  const corpus = PS.buildCorpus(fd.docs.map(d => { const x = d.data(); return { name: x.name, text: x.text || '', docType: x.docType }; }));
  if (!corpus.included) continue;
  subjects.push({ id: doc.id, name: doc.data().name || doc.id, published: snap.composite, corpus });
}

const list = LIMIT ? subjects.slice(0, LIMIT) : subjects;
if (!list.length) {
  console.log('No scored v3 engagements with an ingested corpus were found — nothing to check against.');
  console.log('That is not a pass. The gate has no subjects.');
  process.exit(2);
}

const totalTokens = list.reduce((a, s) => a + s.corpus.tokens, 0);
console.log(`${list.length} scored engagement(s) with a corpus:`);
for (const s of list) console.log(`  ${s.name.padEnd(28)} published ${String(s.published).padStart(3)} · ${s.corpus.included}/${s.corpus.total} docs · ${s.corpus.tokens} tok`);
const priceAt = sp => list.reduce((a, s) => a + estCost(s.corpus.tokens, sp), 0).toFixed(2);
console.log(`\nestimated live cost: $${priceAt('fast')} at fast speed, $${priceAt('standard')} at standard (${totalTokens} corpus tokens, ${list.length * 22} calls)`);

if (!LIVE) {
  console.log('\nDRY RUN — the harness resolved every subject and rebuilt every corpus. No range was predicted,');
  console.log('because predicting one needs the model. Re-run with --live (and a budget) to measure containment.');
  process.exit(0);
}

// ---- live replay ----
const apiKey = process.env.ANTHROPIC_API_KEY;
let contained = 0, checked = 0, lastError = null;
const rows = [];
for (const s of list) {
  process.stdout.write(`\n${s.name} … `);
  try {
    let warm;
    try {
      warm = await PS.warmCache(s.corpus.text, apiKey, SPEED);
    } catch (e) {
      // Decided here, before any cache exists, so the fallback costs nothing and breaks nothing.
      if (!e.fastUnavailable) throw e;
      console.log('\n  fast mode is not enabled on this organisation (allocation of 0).');
      console.log('  Falling back to STANDARD speed for the whole run — same model, same scores,');
      console.log('  roughly half the price and roughly twice the wall-clock.\n  ');
      SPEED = 'standard';
      warm = await PS.warmCache(s.corpus.text, apiKey, SPEED);
    }
    // Sequential, not Promise.all over all seven. Seven categories x 3 draws x a 40,000-token corpus is
    // ~840,000 input tokens arriving at once, against an account ceiling of 500,000 per minute — which
    // is why eight of thirteen engagements failed outright on the first full replay. The gate is not
    // latency-sensitive; it only has to finish.
    const probes = [];
    for (const c of VSS_RUBRIC) probes.push(await PS.probeCategory(c, s.corpus.text, apiKey, SPEED));
    const cats = VSS_RUBRIC.map((c, i) => ({ ...c, signals: PS.consolidate(c, probes[i].draws) }));
    const r = PS.composeRange(cats);
    const inside = s.published >= r.floor && s.published <= r.ceiling;
    checked++; if (inside) contained++;
    const reads = probes.reduce((a, p) => a + p.usage.cacheRead, 0);
    rows.push({ ...s, ...r, inside, cacheWrote: warm.wrote, cacheRead: reads, speed: probes[0].usage.speed });
    console.log(`${r.floor}–${r.ceiling} vs ${s.published}  ${inside ? '✓ contained' : '✗ OUTSIDE'}  (cache read ${reads} tok, speed ${probes[0].usage.speed || '?'})`);
  } catch (e) {
    lastError = `${e.message}${e.detail ? ' — ' + e.detail.slice(0, 200) : ''}`;
    if (e.status === 429) lastError += '  (rate limit — the gate is now sequential, but the account ceiling still binds)';
    console.log(`FAILED: ${lastError}`);
  }
}

console.log('\n──────────────────────────────────────────────');
for (const r of rows) {
  console.log(`  ${r.inside ? '✓' : '✗'} ${r.name.padEnd(26)} ${String(r.floor).padStart(3)}–${String(r.ceiling).padEnd(3)} (width ${String(r.width).padStart(2)}) · published ${r.published}` + (r.inside ? '' : `  ← ${r.published < r.floor ? 'BELOW the floor' : 'ABOVE the ceiling'}`));
}
// NOTHING MEASURED IS NOT A FAILED MEASUREMENT. With every run erroring, this printed
// "containment: 0/0 = 0% … widen the floor", which blames the range for what was actually an auth
// error. A gate that reports a verdict it did not earn is worse than one that reports nothing.
if (!checked) {
  console.log('\nNo run completed, so containment was never measured. Nothing above is a verdict on the range.');
  const auth = rows.length === 0;
  // Echo the real upstream reason rather than guessing at the cause — the last version blamed the API
  // key for a fast-mode allocation of zero, which sent the reader to fix something that was correct.
  if (lastError) console.log('Last upstream error: ' + lastError);
  process.exit(2);
}
const rate = checked ? contained / checked : 0;
console.log(`\ncontainment: ${contained}/${checked} = ${(rate * 100).toFixed(0)}%  (floor ${CONTAINMENT_FLOOR * 100}%)`);

// A miss BELOW the floor is the dangerous direction: we promised more than the paid run delivered.
const below = rows.filter(r => !r.inside && r.published < r.floor);
if (below.length) console.log(`\n${below.length} prediction(s) were ABOVE the real score. That is the direction that causes refunds — widen the floor.`);

// Cache health, reported rather than assumed — if reads are 0 on a corpus big enough to cache, a
// silent invalidator is loose and the run cost several times its budget.
//
// BUT A SHORT PROMPT SIMPLY CANNOT BE CACHED. The minimum cacheable prefix is model-dependent and up
// to ~4096 tokens, and below it the API caches nothing and says nothing. 0X Labs has a one-document
// corpus of 1,256 tokens and tripped this warning on its first run — a warning that fires on every
// thin data room is decoration, and decoration is what gets ignored when it finally matters.
const MIN_CACHEABLE = 4096;
const tooShort = rows.filter(r => r.corpus.tokens < MIN_CACHEABLE);
const zeroCache = rows.filter(r => r.cacheRead === 0 && r.corpus.tokens >= MIN_CACHEABLE);
if (tooShort.length) console.log(`\n${tooShort.length} corpus/corpora under ${MIN_CACHEABLE} tokens — too short to cache at all, so those probes paid full price unavoidably.`);
if (zeroCache.length) console.log(`\n${zeroCache.length} engagement(s) recorded ZERO cache reads on a corpus large enough to cache — a silent invalidator is loose and every probe paid full price:\n  ${zeroCache.map(r => r.name).join(', ')}`);
const cached = rows.filter(r => r.cacheRead > 0);
if (cached.length) console.log(`\ncache working on ${cached.length}/${rows.length}: ${Math.round(cached.reduce((a, r) => a + r.cacheRead, 0) / cached.length).toLocaleString()} tokens read per engagement on average.`);

console.log('');
console.log(rate >= CONTAINMENT_FLOOR ? 'PASS — the published score falls inside the predicted range often enough to sell.' : 'FAIL — widen the floor until containment reaches 90%.');
process.exit(rate >= CONTAINMENT_FLOOR ? 0 : 1);
