/* ============================================
   VENTRIFY VERDICT — CURRENCY LOCALISATION
   Detects visitor country (ipapi.co), converts the
   GBP base prices in [data-price-gbp], swaps the symbol,
   and injects a flag switcher into .foot-currency.
   Mirrors the ventrify.io scripts/currency.js pattern.
   ============================================ */

(function () {
  // code, symbol, rate FROM GBP (1 GBP = rate units), flag
  var CURRENCIES = {
    GBP: { symbol: '£', rate: 1, flag: '🇬🇧' },
    USD: { symbol: '$', rate: 1.25, flag: '🇺🇸' },
    EUR: { symbol: '€', rate: 1.17, flag: '🇪🇺' },
    AED: { symbol: 'AED ', rate: 4.6, flag: '🇦🇪' }
  };

  // Country → currency (anything unmapped falls back to GBP)
  var COUNTRY_CURRENCY = {
    GB: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP',
    US: 'USD', PR: 'USD', GU: 'USD',
    AE: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', OM: 'AED', BH: 'AED',
    AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR',
    DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR',
    LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR', SI: 'EUR', ES: 'EUR'
  };

  var STORAGE_KEY = 'verdict_currency';

  function roundPrice(amount) {
    if (amount >= 100000) return Math.round(amount / 5000) * 5000;
    if (amount >= 10000) return Math.round(amount / 1000) * 1000;
    if (amount >= 1000) return Math.round(amount / 500) * 500;
    return Math.round(amount / 100) * 100;
  }

  function formatNumber(n) { return n.toLocaleString('en'); }

  function convert(gbpAmount, code) {
    var c = CURRENCIES[code] || CURRENCIES.GBP;
    if (code === 'GBP') return { symbol: c.symbol, amount: formatNumber(gbpAmount) };
    return { symbol: c.symbol, amount: formatNumber(roundPrice(gbpAmount * c.rate)) };
  }

  function applyCurrency(code) {
    document.querySelectorAll('[data-price-gbp]').forEach(function (el) {
      var gbp = parseInt(el.getAttribute('data-price-gbp'), 10);
      if (isNaN(gbp)) return;
      var suffix = el.getAttribute('data-price-suffix') || '';
      var r = convert(gbp, code);
      el.innerHTML =
        '<span class="pcur">' + r.symbol + '</span>' + r.amount +
        (suffix ? '<span class="per">' + suffix + '</span>' : '');
    });
    document.querySelectorAll('.currency-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-currency') === code);
    });
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
  }

  function detectCurrency(cb) {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CURRENCIES[stored]) { cb(stored); return; }
    } catch (e) {}
    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(COUNTRY_CURRENCY[d && d.country_code] || 'GBP'); })
      .catch(function () { cb('GBP'); });
  }

  function injectSelector(active) {
    var host = document.querySelector('.foot-currency');
    if (!host || document.getElementById('currency-selector')) return;
    var sel = document.createElement('div');
    sel.id = 'currency-selector';
    sel.className = 'currency-selector';
    sel.innerHTML = Object.keys(CURRENCIES).map(function (code) {
      return '<button class="currency-btn' + (code === active ? ' active' : '') +
        '" data-currency="' + code + '" title="' + code + '" aria-label="Prices in ' + code + '">' +
        CURRENCIES[code].flag + '</button>';
    }).join('');
    host.appendChild(sel);
    sel.addEventListener('click', function (e) {
      var btn = e.target.closest('.currency-btn');
      if (btn) applyCurrency(btn.getAttribute('data-currency'));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    detectCurrency(function (code) {
      applyCurrency(code);
      injectSelector(code);
    });
  });
})();
