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

/* THE SIGN IN BUTTON. It leaves the marketing site for the product, so nothing on the page can tell
   you it still works — only asking the product can. A trailing slash here is a 308 under cleanUrls. */
console.log('\n── the Sign in destination');
{
  const src = await import('node:fs').then(m => m.readFileSync('sites/shared/components.js', 'utf8'));
  const href = (src.match(/label: 'Sign in',\s*href: '(https?:\/\/[^']+)'/) || [, ''])[1];
  ok('VerdictScore Sign in points at the product', !!href, href || "still '#'");
  if (href) {
    ok('no trailing slash — cleanUrls would 308 it', !href.endsWith('/'), href);
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    try {
      const r = await fetch(href, { headers: { 'user-agent': UA }, redirect: 'manual' });
      ok('answers 200 with no redirect', r.status === 200, 'status ' + r.status);
      if (r.status === 200) {
        const t = ((await r.text()).match(/<title>([^<]*)</) || [, ''])[1];
        ok('and it is the sign-in page', /sign in/i.test(t), t);
      }
    } catch (e) { ok('reachable', false, e.message); }
  }
}

/* THE PARTNER EMBED PATH. One line of HTML on someone else's website is the whole integration, and
   once it is pasted into a WordPress theme it is not ours to change. It therefore cannot be an
   internal-looking /sites/verdict-widget/embed.js that moves when the repo is tidied. The public
   path is /widget/*, which exists only as a rewrite in vercel.json — nothing on disk — so no file
   read can tell you it resolves. The iframe src is relative to the script, so the whole directory
   has to answer at the public prefix, not just the loader. */
console.log('\n── the partner embed path (what a partner pastes)');
{
  const BASE = 'https://verdict.ventrify.io';
  const want = CANARY ? '/widget/embed-zzz-not-a-real-file.js' : '/widget/embed.js';

  /* The documented path and the live one are the same claim; a partner reads the docblock. */
  const src = await import('node:fs').then(m => m.readFileSync('sites/verdict-widget/embed.js', 'utf8'));
  const documented = (src.match(/src="https:\/\/verdict\.ventrify\.io(\/[^"]+embed\.js)"/) || [, ''])[1];
  ok('embed.js documents the public path', documented === '/widget/embed.js', documented || '(none found)');

  const probes = [
    { path: want,             type: /javascript/,  must: /verdictscore-widget/,  what: 'the loader' },
    { path: '/widget/widget', type: /html/,        must: /id="lockup"/,          what: 'the panel the iframe loads' },
    { path: '/widget/demo',   type: /html/,        must: /data-partner/,         what: 'the stand-in host page' },
  ];
  for (const { path, type, must, what } of probes) {
    try {
      const r = await fetch(BASE + path + '?cb=' + Date.now(), { redirect: 'follow' });
      const body = r.ok ? await r.text() : '';
      ok(`${path} answers 200 — ${what}`, r.status === 200, 'status ' + r.status);
      if (r.status !== 200) continue;
      ok(`${path} is served as the right type`, type.test(r.headers.get('content-type') || ''),
         r.headers.get('content-type') || '(none)');
      ok(`${path} is the real file`, must.test(body), must.test(body) ? '' : 'content does not match ' + must);
    } catch (e) { ok(path + ' reachable', false, e.message); }
  }
}

console.log(fail ? `\n${fail} FAILED` : '\nevery host serves its own site');
if (CANARY) {
  console.log(fail ? 'canary OK — the gate can fail' : '\n!! CANARY DID NOT FAIL — this gate is decoration');
  process.exit(fail ? 0 : 1);
}
process.exit(fail ? 1 : 0);
