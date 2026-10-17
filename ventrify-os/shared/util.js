// ============================================================
// Ventrify OS — shared tiny utilities (one definition, used everywhere).
// Replaces the esc/escBrief helper that was redeclared in ~6 files.
// ============================================================

// HTML-escape text content.
export const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// HTML-escape for an attribute value (also escapes quotes).
export const escAttr = s => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// How long ago an ISO timestamp was, in the short form the Workspace uses in list rows and action items
// ("4 mins", "2 hours", "3 days"). Returns null for anything unparseable so callers can fall back to their
// own wording rather than printing "NaN days".
export function ago(iso) {
  const t = Date.parse(iso || '');
  if (isNaN(t)) return null;
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
