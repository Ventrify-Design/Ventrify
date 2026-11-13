/* ══ VERDICTSCORE EMBED ════════════════════════════════════════════════════
   The whole of what a partner pastes into their site. Every attribute is
   optional except data-partner.

     <script src="https://verdict.ventrify.io/widget/embed.js"
             data-partner="TCA Venture Group" data-short="TCA"
             data-logo="https://tcaventuregroup.com/logo.svg"
             data-theme="light" data-accent="#A08A5B"
             data-font="Zilla Slab" data-radius="2" defer></script>

   TWO BOUNDARIES, FOR TWO DIFFERENT REASONS.
   The launcher lives in a shadow root, so the partner's stylesheet cannot
   reach it — on a WordPress theme a bare `button{}` rule is close to certain.
   The panel lives in an iframe, so OUR css cannot reach THEIRS, and so the
   founder's deck and email never touch the partner's page at all. That second
   one is not tidiness; it is the reason we can promise the deck is read by
   VerdictScore and not by the site it was uploaded from.

   THE LAUNCHER IS THE PART THAT HAS TO BLEND. It is on their page from the
   first second, before anyone has chosen to interact, so it takes their
   theme, their colour, their type and their corner radius. A dark pill on a
   light corporate site is the eyesore; this is the fix.

   NOTHING LOADS UNTIL THE FOUNDER OPENS IT. The iframe is built on first open,
   so a partner page carries one small script and a button, not a product. */
(function () {
  'use strict';
  var S = document.currentScript;
  if (!S || window.__verdictscore) return;
  window.__verdictscore = true;

  var D = S.dataset;
  var ORIGIN = new URL(S.src, location.href).origin;
  var BASE   = new URL('.', new URL(S.src, location.href)).href;

  var CFG = {
    partner: D.partner || 'our partners',
    short:   D.short   || D.partner || 'them',
    logo:    D.logo    || '',
    theme:   D.theme === 'light' ? 'light' : 'dark',
    accent:  D.accent  || '#7C5CFC',
    font:    D.font    || '',
    fontBody:D.fontBody|| '',
    radius:  D.radius  == null || D.radius === '' ? 16 : Math.max(0, Math.min(24, parseInt(D.radius, 10) || 0)),
    label:   D.label   || 'Is your deck ready?',
    sub:     D.sub     || 'Free pre-screen · 2 min',
    side:    D.side === 'left' ? 'left' : 'right'
  };

  /* the ink on a partner's accent is measured, never assumed — same function
     as the panel uses, because the two must not disagree about contrast */
  function lum(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h.slice(0, 6), 16); if (isNaN(n)) return 0;
    function f(x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
    return 0.2126*f((n>>16&255)/255) + 0.7152*f((n>>8&255)/255) + 0.0722*f((n&255)/255);
  }
  function ratio(a, b) { return (Math.max(a,b)+0.05) / (Math.min(a,b)+0.05); }
  var AL = lum(CFG.accent);
  var ACC_INK = ratio(AL, 1) >= ratio(AL, lum('#14171F')) ? '#FFFFFF' : '#14171F';

  var LIGHT = CFG.theme === 'light';
  var SKIN = LIGHT
    ? { bg:'#FFFFFF', fg:'#14171F', sub:'rgba(20,23,31,.58)',
        ring:'rgba(16,19,26,.12)', shadow:'0 10px 30px -8px rgba(16,24,40,.22)',
        shadowHi:'0 18px 44px -10px rgba(16,24,40,.3)' }
    : { bg:'#16141C', fg:'#FFFFFF', sub:'rgba(255,255,255,.6)',
        ring:'rgba(255,255,255,.12)', shadow:'0 10px 32px -8px rgba(0,0,0,.55)',
        shadowHi:'0 16px 40px -8px rgba(0,0,0,.62)' };

  var qs = 'partner=' + encodeURIComponent(CFG.partner) + '&short=' + encodeURIComponent(CFG.short) +
           '&theme=' + CFG.theme + '&accent=' + encodeURIComponent(CFG.accent) +
           '&radius=' + CFG.radius;
  ['logo','font','fontBody','site','price','bar','readyIn','demo','api','stage'].forEach(function (k) {
    if (D[k]) qs += '&' + k + '=' + encodeURIComponent(D[k]);
  });
  /* A stand-in host page is simulated by default so it can be shown with no
     backend at all. ?live=1 on the HOST url turns the real calls on, which is
     how you test a real submission without editing the embed tag. */
  try {
    if (new URLSearchParams(location.search).get('live') === '1') qs = qs.replace(/&demo=1\b/, '&demo=0');
  } catch (x) {}

  /* ── host + shadow root ─────────────────────────────────────────────── */
  var host = document.createElement('div');
  host.id = 'verdictscore-widget';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483000;' + CFG.side + ':0;bottom:0';
  var R = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  /* fonts must load in the OUTER document — a shadow root does not inherit
     an @font-face that was never fetched by the page that owns it */
  [CFG.font, CFG.fontBody].forEach(function (fam) {
    if (!fam) return;
    var fl = document.createElement('link');
    fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(fam).replace(/%20/g, '+') + ':wght@400;600;700&display=swap';
    document.head.appendChild(fl);
  });
  var FAM = (CFG.font ? '"' + CFG.font + '",' : '') +
            '"Inter Tight",Inter,system-ui,-apple-system,"Segoe UI",sans-serif';
  /* a pill only where the partner's own corners are round; otherwise their
     exact radius, square included. TCA asked for 2px and used to get 10. */
  var LR = CFG.radius >= 14 ? '999px' : CFG.radius + 'px';

  var css = document.createElement('style');
  css.textContent = [
    ':host,*{box-sizing:border-box}',
    '.l{position:fixed;' + CFG.side + ':24px;bottom:24px;display:flex;align-items:center;gap:14px;',
      'min-height:76px;padding:13px 26px 13px 15px;border:0;border-radius:' + LR + ';cursor:pointer;',
      'font:600 18px/1.3 ' + FAM + ';text-align:left;',
      'color:' + SKIN.fg + ';background:' + SKIN.bg + ';',
      'box-shadow:' + SKIN.shadow + ',0 0 0 1px ' + SKIN.ring + ',inset 0 -4px 0 ' + CFG.accent + ';',
      'transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s ease}',
    '.l:hover{transform:translateY(-3px);box-shadow:' + SKIN.shadowHi + ',0 0 0 1px ' + SKIN.ring + ',inset 0 -4px 0 ' + CFG.accent + '}',
    '.l:active{transform:translateY(-1px)}',
    '.l:focus-visible{outline:3px solid ' + CFG.accent + ';outline-offset:3px}',
    '.l[hidden]{display:none}',
    /* the mark carries the PARTNER's colour — on their page, nothing of ours
       is visible until a founder chooses to open the panel */
    '.l .m{width:44px;height:44px;flex:0 0 auto;border-radius:' + Math.max(8, Math.round(CFG.radius * .62)) + 'px;',
      'display:grid;place-items:center;overflow:hidden;',
      'font:700 17px/1 ' + FAM + ';color:' + ACC_INK + ';background:' + CFG.accent + '}',
    '.l .m.has{width:auto;height:40px;max-width:138px;background:transparent;border-radius:0}',
    '.l .m.has img{height:100%;width:auto;max-width:138px;object-fit:contain;display:block}',
    '.l .tx{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '.l .tx b{font-weight:600;white-space:nowrap;letter-spacing:-.012em}',
    '.l .tx i{font-style:normal;font-size:15px;font-weight:400;color:' + SKIN.sub + ';white-space:nowrap}',
    '.w{position:fixed;' + CFG.side + ':20px;bottom:20px;width:400px;height:min(640px,calc(100vh - 40px));',
      'border-radius:' + (CFG.radius + 2) + 'px;overflow:hidden;background:' + SKIN.bg + ';opacity:0;pointer-events:none;',
      'transform:translateY(14px) scale(.985);transform-origin:bottom ' + CFG.side + ';',
      'box-shadow:' + SKIN.shadowHi + ',0 0 0 1px ' + SKIN.ring + ';',
      'transition:opacity .24s ease,transform .3s cubic-bezier(.34,1.56,.64,1)}',
    '.w.open{opacity:1;pointer-events:auto;transform:none}',
    '.w iframe{width:100%;height:100%;border:0;display:block;background:' + SKIN.bg + '}',
    /* phone: the panel is the page. A 400px card on a 390px screen is a joke,
       and a founder filling a form inside a 56px-tall viewport will not finish. */
    '@media(max-width:640px){',
      '.w{inset:0;width:100%;height:100%;height:100dvh;border-radius:0;transform:translateY(16px);transform-origin:bottom center}',
      '.l{' + CFG.side + ':14px;bottom:14px;max-width:calc(100vw - 28px);',
        'min-height:66px;padding:11px 20px 11px 13px;gap:11px;font-size:16.5px}',
      '.l .tx i{font-size:14px}',
      '.l .m{width:38px;height:38px;font-size:15px}',
      '.l .m.has,.l .m.has img{height:34px;max-width:116px}',
    '}',
    '@media(prefers-reduced-motion:reduce){.l,.w{transition:none}}'
  ].join('');
  R.appendChild(css);

  var launcher = document.createElement('button');
  launcher.className = 'l';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open the free pre-screen');
  launcher.innerHTML = '<span class="m"></span><span class="tx"><b></b><i></i></span>';
  var mark = launcher.querySelector('.m');
  if (CFG.logo) { var im = document.createElement('img'); im.src = CFG.logo; im.alt = ''; mark.appendChild(im);
                  mark.className = 'm has'; }
  else { mark.textContent = (CFG.short || 'V').slice(0, 3).toUpperCase(); }
  launcher.querySelector('b').textContent = CFG.label;
  launcher.querySelector('i').textContent = CFG.sub;
  R.appendChild(launcher);

  var panel = document.createElement('div');
  panel.className = 'w';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Pre-screen');
  R.appendChild(panel);

  /* ── open / close ───────────────────────────────────────────────────── */
  var frame = null, opener = null;

  function open() {
    if (!frame) {                                   /* built once, on demand */
      frame = document.createElement('iframe');
      frame.title = 'Pre-screen';
      frame.src = BASE + 'widget.html?' + qs;
      panel.appendChild(frame);
    }
    opener = document.activeElement;
    panel.classList.add('open');
    launcher.hidden = true;
    if (matchMedia('(max-width:640px)').matches) document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { frame.focus(); }, 60);
  }

  function close() {
    panel.classList.remove('open');
    launcher.hidden = false;
    document.documentElement.style.overflow = '';
    if (opener && opener.focus) opener.focus(); else launcher.focus();
  }

  launcher.addEventListener('click', open);
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });

  /* ── the only channel between the two documents ─────────────────────── */
  addEventListener('message', function (e) {
    if (e.origin !== ORIGIN) return;                        /* nothing else is heard */
    var m = e.data; if (!m || m.source !== 'verdictscore') return;
    if (m.type === 'close')    close();
    if (m.type === 'navigate') window.open(m.href, '_blank', 'noopener');
    if (m.type === 'step' && window.dataLayer) window.dataLayer.push({ event: 'verdictscore_step', step: m.step });
  });

  (document.body || document.documentElement).appendChild(host);
})();
