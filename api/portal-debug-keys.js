/**
 * TEMPORARY debug endpoint — diagnoses PORTAL_CLIENTS env var
 * being read by the production function runtime.
 *
 * Returns: { ok, keys, rawLength, parseError? }
 *
 * Returns ONLY the slug keys + length of raw env var — never the
 * codes or client metadata. Safe to leave briefly but DELETE after
 * diagnosis confirms the env var contains the expected slugs.
 */

module.exports = async function handler(req, res) {
  const raw = process.env.PORTAL_CLIENTS;
  const rawLength = raw ? raw.length : 0;
  let keys = [];
  let parseError = null;

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      keys = Object.keys(parsed);
    } catch (e) {
      parseError = e.message;
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    keys,
    rawLength,
    rawDefined: !!raw,
    parseError,
    timestamp: new Date().toISOString(),
  }));
};
