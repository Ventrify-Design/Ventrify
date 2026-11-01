#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   PRESCREEN CITATIONS — READ ONLY, FREE. Every claim a stored run published
   still passes §8.1's checks.

     node tools/prescreen-citations.mjs          every stored v2 snapshot
     node tools/prescreen-citations.mjs --self   prove the gate can fail

   WHY A GATE ON STORED DATA, WHEN THE ENGINE ALREADY ENFORCES THIS.
   §8.1's span match and URL check run inside the engine, before a point is
   kept. They are the reason a citation on this page is a link to follow rather
   than a claim to take on trust. But a guard that runs once, at write time,
   proves nothing about what is on the page a year later: a schema change, a
   loosened filter, a hand-edited document or a restored backup all put claims
   in front of a customer that no live check ever saw. This reads what is
   actually stored and re-applies the rules to it.

   It also reconciles the snapshot's own `tiers` counters against the points
   they claim to count. That summary is what the UI and the cost report read,
   and a counter that has drifted from its data is a number the product repeats
   with confidence and cannot support.

   WHAT IT CANNOT CHECK, AND SAYS SO. We do not store the fetched page text, so
   this cannot re-verify a span against the live web — only that a point
   claiming the `verified` tier carries the span it was verified with. Spans are
   re-matched against the SOURCE LIST we harvested, which is the check that
   catches an invented URL.
   ════════════════════════════════════════════════════════════════════════════ */
import { initAdmin } from './contract-auth.mjs';

const SELF = process.argv.includes('--self');
let fails = 0;
const bad = [];
const note = (venture, kind, detail) => { bad.push(`${venture} · ${kind}: ${detail}`); fails++; };

const TIERS = new Set(['verified', 'attributed']);
const httpUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } };

/* The rules, as a pure function, so --self can feed it a bad snapshot. */
export function auditSnapshot(venture, s) {
  const out = [];
  const say = (kind, detail) => out.push({ kind, detail });
  const sources = s.sources || [];
  const known = new Set(sources.map(x => String(x.url)));
  const counted = { external: 0, internal: 0, verified: 0, attributed: 0 };

  for (const [kind, n] of Object.entries(s.nuggets || {})) {
    for (const [i, p] of (n.points || []).entries()) {
      const at = `${kind}[${i}]`;
      if (!String(p.point || '').trim()) { say('empty claim', at); continue; }

      if (p.external) {
        counted.external++;
        if (!p.source || !httpUrl(p.source.url)) { say('external point without a usable source URL', `${at} — ${JSON.stringify(p.source || null)}`); continue; }
        // AN INVENTED URL IS THE FAILURE THIS CATCHES. Every external citation must point at a page
        // the run actually harvested; a URL the model produced that is in no source list is exactly
        // the hallucination the enum-citation design exists to make impossible.
        if (known.size && !known.has(String(p.source.url))) say('cites a URL that is not in the run\'s own source list', `${at} — ${p.source.url}`);
        if (!TIERS.has(p.tier)) say('external point with no honest tier', `${at} — tier=${JSON.stringify(p.tier)}`);
        if (p.tier === 'verified') {
          counted.verified++;
          if (!String(p.quotedSpan || '').trim()) say('claims the verified tier but carries no quoted span', at);
        } else if (p.tier === 'attributed') {
          counted.attributed++;
        }
      } else {
        counted.internal++;
        if (!String(p.docName || '').trim()) say('internal point with no document behind it', at);
        if (p.tier && p.tier !== 'verified') say('internal point carrying an external tier', `${at} — tier=${p.tier}`);
        if (p.source) say('internal point also carrying an external source', at);
      }
    }
  }

  // the stored summary must agree with the points it summarises
  const t = s.tiers || {};
  for (const k of ['external', 'internal', 'verified', 'attributed']) {
    if (t[k] != null && t[k] !== counted[k]) say('tiers counter disagrees with the points', `${k}: stored ${t[k]}, actual ${counted[k]}`);
  }
  return { out, counted, sources: sources.length };
}

if (SELF) {
  console.log('\nSELF-TEST — the rules, on a deliberately broken snapshot (no credentials, no spend)');
  const broken = {
    sources: [{ url: 'https://real.example/a', title: 'A' }],
    tiers: { external: 9, internal: 0, verified: 9, attributed: 0 },
    nuggets: {
      bull: { points: [
        { point: 'cites a page nobody harvested', external: true, tier: 'verified', source: { url: 'https://invented.example/x' }, quotedSpan: 'x' },
        { point: 'verified with no span',         external: true, tier: 'verified', source: { url: 'https://real.example/a' } },
        { point: 'no tier at all',                external: true, source: { url: 'https://real.example/a' }, quotedSpan: 'y' },
        { point: 'source url is not a url',       external: true, tier: 'verified', source: { url: 'notaurl' }, quotedSpan: 'z' },
        { point: 'internal with no document',     external: false },
      ] },
    },
  };
  const { out } = auditSnapshot('canary', broken);
  const kinds = out.map(o => o.kind);
  const want = ['cites a URL that is not in the run\'s own source list', 'claims the verified tier but carries no quoted span',
                'external point with no honest tier', 'external point without a usable source URL',
                'internal point with no document behind it', 'tiers counter disagrees with the points'];
  let miss = 0;
  for (const w of want) { const hit = kinds.includes(w); console.log((hit ? '  ok  ' : '  ✗   ') + 'caught: ' + w); if (!hit) miss++; }
  const clean = auditSnapshot('clean', { sources: [{ url: 'https://real.example/a' }], tiers: { external: 1, internal: 1, verified: 1, attributed: 0 },
    nuggets: { bull: { points: [
      { point: 'good external', external: true, tier: 'verified', source: { url: 'https://real.example/a' }, quotedSpan: 'good external' },
      { point: 'good internal', external: false, docName: 'deck.pdf', quotedSpan: 'good internal' }] } } }).out;
  console.log((clean.length === 0 ? '  ok  ' : '  ✗   ') + 'a healthy snapshot raises nothing' + (clean.length ? ' — ' + JSON.stringify(clean) : ''));
  if (clean.length) miss++;
  console.log(miss ? `\n${miss} rule(s) did not fire — this gate is decoration` : '\nCANARY PASSED: every rule fires, and a clean snapshot is silent');
  process.exit(miss ? 1 : 0);
}

const admin = await initAdmin();
const db = admin.firestore();
let seen = 0;
console.log('\nSTORED RUNS — re-applying §8.1 to what is actually on the page\n');
for (const d of (await db.collection('engagements').get()).docs) {
  const s = d.data().prescreen2;
  if (!s || s.v !== 2) continue;
  seen++;
  const venture = d.data().name || d.id;
  const { out, counted, sources } = auditSnapshot(venture, s);
  for (const o of out) note(venture, o.kind, o.detail);
  console.log(`  ${out.length ? '✗' : '✓'} ${venture.padEnd(14)} ${counted.external} external (${counted.verified} verified, ${counted.attributed} attributed) · ${counted.internal} internal · ${sources} sources harvested`);
  for (const o of out) console.log(`        ✗ ${o.kind}: ${o.detail}`);
}
if (!seen) console.log('  --  no v2 snapshots stored yet. Nothing to re-check; this is not a failure.');
console.log(fails ? `\n${fails} claim-level problem(s) found` : '\nevery stored claim still passes §8.1');
process.exit(fails ? 1 : 0);
