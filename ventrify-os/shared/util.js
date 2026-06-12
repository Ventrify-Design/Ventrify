// ============================================================
// Ventrify OS — shared tiny utilities (one definition, used everywhere).
// Replaces the esc/escBrief helper that was redeclared in ~6 files.
// ============================================================

// HTML-escape text content.
export const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// HTML-escape for an attribute value (also escapes quotes).
export const escAttr = s => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
