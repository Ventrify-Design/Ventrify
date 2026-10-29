/* ═══════════════════════════════════════════════════════════════════════════
   PREVIEW ONLY — a scaffolding control, not part of the product.

   The leading underscore and the `_preview-` prefix mark it: this file is
   loaded by the *-brand.html preview pages and by nothing else. The real
   workspace never ships it, because in the real workspace an operator belongs
   to one product and switching identity mid-session is meaningless.

   It exists so the same screen can be judged in both identities side by side
   while the UI is being refined. Everything it does is flip one attribute —
   `data-brand` on <html> — which is the whole contract the brand layer runs
   on (see shared/m3/brand-map.css). If a refinement only looks right in one
   identity, this is what catches it.

   Deliberately NOT in registry.js: that catalogues product components, and
   putting a dev affordance in there would make it look like one.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var KEY = 'ventrify-preview-brand';
  var BRANDS = [
    { key: 'verdictscore', label: 'VerdictScore' },
    { key: 'venturestack', label: 'VentureStack' },
  ];

  /* The page declares its own identity in the markup; that is the default, so
     a preview opened fresh looks like the product it is meant to be. */
  var FROM_URL = false;
  var initial = document.documentElement.getAttribute('data-brand') || BRANDS[0].key;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved && BRANDS.some(function (b) { return b.key === saved; })) initial = saved;
  } catch (e) { /* private window — fall back to the markup */ }
  /* ?brand=<key> WINS over the remembered choice, and does not overwrite it. localStorage is one
     value for the whole origin, so opening VerdictScore and VentureStack side by side meant the
     second tab silently re-skinned the first. A URL param makes each preview a real link you can
     send, bookmark, or open four of at once. */
  try {
    var want = new URLSearchParams(location.search).get('brand');
    if (want && BRANDS.some(function (b) { return b.key === want; })) { initial = want; FROM_URL = true; }
  } catch (e) { /* no URLSearchParams — ignore */ }

  /* ── WHERE IT SITS ──────────────────────────────────────────────────────
     It used to be pinned top-right (top:14px; right:88px), floating over the
     masthead. That corner is now spoken for: the masthead's tab row carries a
     persistent score mark on its right, and a dev control must never be what
     obscures the product.

     So when the page has a shell, the switcher DOCKS into the left drawer, at
     the foot, where the other session-level controls live. The concept and
     specimen pages have no shell, so those keep a floating pill — moved to the
     bottom LEFT, which is the one corner nothing in the product occupies. */
  var css = document.createElement('style');
  css.textContent = [
    /* docked — the normal case, inside the drawer */
    '.m3-drawer .pv-switch{display:flex;flex-direction:column;align-items:stretch;gap:7px;',
      'margin:14px 10px 10px;padding:10px;border-radius:14px;font:500 12px/1 var(--font-text,system-ui);',
      'background:var(--md-sys-color-surface-container-high,rgba(255,255,255,.05));',
      'border:1px solid var(--line-2,rgba(255,255,255,.1))}',
    '.m3-drawer .pv-switch-set{display:grid;grid-template-columns:1fr 1fr;gap:4px}',
    '.m3-drawer .pv-switch button{padding:8px 6px;text-align:center}',
    /* collapsed rail: the drawer is a strip of icons, so the switcher gets out of the way */
    '.m3-app.rail .pv-switch{display:none}',

    /* floating — only where there is no drawer to dock into */
    '.pv-switch.pv-float{position:fixed;left:14px;bottom:14px;right:auto;top:auto;z-index:900;',
      'display:flex;align-items:center;gap:10px;',
      'padding:5px 5px 5px 12px;border-radius:999px;font:500 12px/1 var(--font-text,system-ui);',
      'background:color-mix(in srgb, var(--surface-floating,#1a2432) 82%, transparent);',
      'border:1px solid var(--line-2,rgba(255,255,255,.16));',
      'backdrop-filter:blur(14px) saturate(180%);-webkit-backdrop-filter:blur(14px) saturate(180%);',
      'box-shadow:0 10px 30px rgba(0,0,0,.45)}',
    '.pv-switch.pv-float .pv-switch-set{display:flex;gap:3px}',

    /* shared */
    '.pv-switch-tag{color:var(--text-4,rgba(255,255,255,.4));letter-spacing:.09em;text-transform:uppercase;font-size:10px}',
    '.pv-switch button{appearance:none;border:0;cursor:pointer;border-radius:999px;padding:7px 12px;',
      'font:inherit;color:var(--text-2,rgba(255,255,255,.78));background:transparent;',
      'transition:color .18s ease,background-color .18s ease}',
    '.pv-switch button:hover{color:var(--text-1,#fff)}',
    '.pv-switch button[aria-pressed="true"]{background:var(--brand-accent-2,#60A5FA);color:var(--text-on-accent,#0A0F14)}',
    '.pv-switch button:focus-visible{outline:2px solid var(--brand-accent-2,#60A5FA);outline-offset:2px}',
    /* the floating fallback must never be what pushes a phone into horizontal scroll */
    '@media (max-width:900px){.pv-switch.pv-float{max-width:calc(100vw - 28px)}}',
    '@media (prefers-reduced-motion:reduce){.pv-switch button{transition:none}}',
  ].join('');
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.className = 'pv-switch';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Preview: switch product identity');
  bar.innerHTML = '<span class="pv-switch-tag">Preview</span><span class="pv-switch-set"></span>';
  var set = bar.querySelector('.pv-switch-set');

  function apply(key) {
    document.documentElement.setAttribute('data-brand', key);
    set.querySelectorAll('button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.brand === key));
    });
    if (!FROM_URL) { try { localStorage.setItem(KEY, key); } catch (e) { /* ignore */ } }
    FROM_URL = false;   // a later CLICK is a real choice and should be remembered
  }

  BRANDS.forEach(function (b) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.brand = b.key;
    btn.textContent = b.label;
    btn.addEventListener('click', function () { apply(b.key); });
    set.appendChild(btn);
  });

  /* The shell renders asynchronously on some pages, so a drawer that is not there on
     DOMContentLoaded may exist a frame later. Try, then retry briefly, then settle for
     floating — never block, and never end up with no switcher at all. */
  function dock() {
    var drawer = document.querySelector('.m3-drawer');
    if (!drawer) return false;
    var foot = drawer.querySelector('.drawer-foot');
    bar.classList.remove('pv-float');
    foot ? drawer.insertBefore(bar, foot) : drawer.appendChild(bar);
    return true;
  }
  function mount() {
    bar.classList.add('pv-float');
    document.body.appendChild(bar);
    apply(initial);
    if (dock()) return;
    var tries = 0;
    var t = setInterval(function () { if (dock() || ++tries > 20) clearInterval(t); }, 100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
