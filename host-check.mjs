/* WHICH SITE DOES EACH HOSTNAME ACTUALLY SERVE?
 *
 * The gate that was missing on 2026-11-03. vercel.json mapped verdict.ventrify.io to the VerdictScore
 * page and every offline check passed, because every offline check read the config. Vercel resolves the
 * filesystem BEFORE `rewrites`, the repo root has a real index.html, and so the live domain served the
 * old agency site. Nothing that reads a file could have known. Only asking the hostname can.
 *
 *   node host-check.mjs            — assert every host serves its own site
 *   node host-check.mjs --canary   — demand a wrong title, and prove the gate fails
 */

const CANARY = process.argv.includes('--canary');

const HOSTS = [
  { host: 'verdict.ventrify.io', expect: 'VerdictScore',                    site: 'the VerdictScore marketing site' },
  { host: 'ventrify.io',         expect: 'Turn Ideas into Launched Products', site: 'the parent site (unchanged)' },
  { host: 'os.ventrify.io',      expect: null,                              site: 'the platform — must stay reachable' },
];

let fail = 0;
const ok = (n, c, got) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${got ? ' — ' + got : ''}`); if (!c) fail++; };

console.log('\n── middleware destinations (offline)');
{
  const src = await import('node:fs').then(m => m.readFileSync('middleware.js', 'utf8'));
  const dests = [...src.matchAll(/'(\/sites\/[^']+)'/g)].map(m => m[1]);
  ok('every destination is declared', dests.length >= 2, dests.join(', '));
  /* cleanUrls turns an index.html destination into a 308, and an internal rewrite aimed at a
     redirect resolves to NOT_FOUND. This shipped once. */
  const bad = dests.filter(d => d.endsWith('.html') || d.endsWith('/'));
  ok('none ends in .html or a slash — cleanUrls would 308 it', !bad.length, bad.join(', ') || 'all bare');
}

for (const { host, expect, site } of HOSTS) {
  console.log(`\n── ${host}  (${site})`);
  let res, body = '';
  try {
    res = await fetch(`https://${host}/?cb=${Date.now()}`, { headers: { 'cache-control': 'no-cache' }, redirect: 'follow' });
    body = await res.text();
  } catch (e) { ok('answers at all', false, e.message); continue; }

  ok('answers 200', res.status === 200, 'status ' + res.status);

  const title = (body.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
  if (expect === null) { console.log(`  ----  title: ${title}`); continue; }

  const want = CANARY ? expect + ' ZZZ-NOT-A-REAL-TITLE' : expect;
  ok(`serves ${site}`, title.includes(want), title || '(no title)');
}

console.log(fail ? `\n${fail} FAILED` : '\nevery host serves its own site');
if (CANARY) {
  console.log(fail ? 'canary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
process.exit(fail ? 1 : 0);
