/**
 * Ventrify OS — In-page section tabs  (SHARED · single source of truth)
 *
 * Tier-2 navigation: a horizontal tab bar that lives INSIDE a page and breaks
 * one left-nav section's content into digestible pieces (one focused view per
 * tab). The left side-nav (shared/shell.js) is tier-1 (the section); this is
 * tier-2 (the pieces within it).
 *
 * Data-driven, like the shell: a page declares its tabs as data and the active
 * tab comes from the URL — so every section and every engagement renders the
 * identical bar. CSS lives in shared/shell.css (.subnav).
 *
 * Usage:
 *   const tabs = [{ key:'welcome', label:'Welcome pack' }, { key:'brief', label:'Brief', badge:2 }];
 *   renderSubnav(tabs, activeKey, { hrefFor: k => `?group=foundations&tab=${k}` });
 *
 * resolveTab(tabs, requestedKey) returns a valid key (the requested one if it
 * exists, else the first tab) — call it to normalise ?tab= before rendering.
 */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Pick a valid tab key: the requested one if it's in `tabs`, otherwise the first. */
export function resolveTab(tabs, requestedKey) {
  const keys = (tabs || []).map(t => t.key);
  return keys.includes(requestedKey) ? requestedKey : (keys[0] || null);
}

/** Render the horizontal tab bar. `opts.hrefFor(key)` builds each tab's href. */
export function renderSubnav(tabs, activeKey, opts = {}) {
  const hrefFor = opts.hrefFor || (() => '#');
  const items = (tabs || []).filter(Boolean).map(t => {
    const active = t.key === activeKey;
    const badge = (t.badge != null && t.badge !== '' && Number(t.badge) !== 0)
      ? `<span class="subnav-badge">${esc(t.badge)}</span>` : '';
    return `<a href="${esc(hrefFor(t.key))}" class="subnav-tab ${active ? 'active' : ''}" role="tab" aria-selected="${active}">${esc(t.label)}${badge}</a>`;
  }).join('');
  return `<nav class="subnav" role="tablist" aria-label="${esc(opts.label || 'Section')}">${items}</nav>`;
}
