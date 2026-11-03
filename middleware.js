/* HOST ROUTING — and why this is not in vercel.json.
 *
 * vercel.json carries `rewrites` that map a hostname to its site:
 *   verdict.ventrify.io/  ->  /sites/verdict-score/index.html
 *
 * THEY NEVER FIRE. Vercel resolves the filesystem BEFORE it applies `rewrites`, and this repo has a
 * real index.html at its root — the old multi-page agency site that ventrify.io still serves. `/`
 * therefore matches a file, the request is answered from disk, and no host rule is ever consulted.
 * Proved on 2026-11-03: verdict.ventrify.io was attached to this project and served
 * "Ventrify — Turn Ideas into Launched Products" rather than VerdictScore.
 *
 * Deleting the root index.html would free `/`, but about.html, pricing.html, work-*.html and the rest
 * of that site link to it by name. Middleware runs BEFORE the filesystem, so it is the one place a
 * hostname can win against a file that already exists.
 *
 * ventrify.io is deliberately ABSENT from the table below. It falls through untouched and keeps
 * serving the root index.html exactly as it does today. Adding it here is how that site gets
 * repointed at sites/ventrify/ — a separate launch, not a side effect of this one.
 *
 * No imports. @vercel/edge's rewrite() helper would mean a new dependency in a package.json shared
 * with every other project built from this repo; the response headers below are the same mechanism
 * that helper wraps. Both headers are confirmed honoured in production: the first deploy rewrote
 * verdict.ventrify.io (to a bad path) and let ventrify.io through to its 87KB page untouched.
 */

export const config = { matcher: '/' };

/* EXTENSIONLESS, AND NOT BY STYLE. vercel.json sets cleanUrls, so /sites/verdict-score/index.html is
 * a 308 to /sites/verdict-score — and an internal rewrite aimed at a redirect resolves to nothing at
 * all. The first deploy of this file returned NOT_FOUND for exactly that reason. Measured 2026-11-03:
 *   /sites/verdict-score/index.html -> 308      /sites/verdict-score/ -> 308      /sites/verdict-score -> 200
 * Only the bare path is a document. Do not "tidy" these back to index.html. */
const SITES = {
  'verdict.ventrify.io': '/sites/verdict-score',
  'venture.ventrify.io': '/sites/venture-stack',
};

export default function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const dest = SITES[host];

  /* Every other host — ventrify.io, the *.vercel.app previews — carries on to the filesystem. */
  if (!dest) return new Response(null, { headers: { 'x-middleware-next': '1' } });

  return new Response(null, {
    headers: { 'x-middleware-rewrite': new URL(dest, request.url).toString() },
  });
}
