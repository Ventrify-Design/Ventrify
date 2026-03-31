/* ============================================
   VENTRIFY CURRENCY LOCALISATION
   Detects visitor location, converts AED prices.
   ============================================ */

(function() {
  // Currency config: code, symbol, rate from AED, locale
  const CURRENCIES = {
    AED: { symbol: 'AED', rate: 1, locale: 'en-AE', prefix: true },
    USD: { symbol: '$', rate: 0.272, locale: 'en-US', prefix: true },
    GBP: { symbol: '£', rate: 0.217, locale: 'en-GB', prefix: true },
    SGD: { symbol: 'S$', rate: 0.365, locale: 'en-SG', prefix: true }
  };

  // Country → currency mapping
  const COUNTRY_CURRENCY = {
    AE: 'AED', BH: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', OM: 'AED',
    US: 'USD', PR: 'USD', GU: 'USD',
    GB: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP',
    SG: 'SGD'
  };

  const STORAGE_KEY = 'ventrify_currency';

  // Round to nearest clean number
  function roundPrice(amount) {
    if (amount >= 100000) return Math.round(amount / 5000) * 5000;
    if (amount >= 10000) return Math.round(amount / 1000) * 1000;
    if (amount >= 1000) return Math.round(amount / 500) * 500;
    return Math.round(amount / 100) * 100;
  }

  // Format a number with commas
  function formatNumber(n) {
    return n.toLocaleString('en');
  }

  // Convert and format an AED amount
  function convertPrice(aedAmount, currencyCode) {
    const c = CURRENCIES[currencyCode] || CURRENCIES.AED;
    if (currencyCode === 'AED') return { display: 'AED', amount: formatNumber(aedAmount) };
    const converted = roundPrice(aedAmount * c.rate);
    return { display: c.symbol, amount: formatNumber(converted) };
  }

  // Apply currency to all data-price elements
  function applyCurrency(currencyCode) {
    document.querySelectorAll('[data-price-aed]').forEach(function(el) {
      const aed = parseInt(el.getAttribute('data-price-aed'), 10);
      const suffix = el.getAttribute('data-price-suffix') || '';
      const result = convertPrice(aed, currencyCode);

      // Check if it's a "compact" display (like the compare row)
      if (el.hasAttribute('data-price-compact')) {
        var converted;
        if (currencyCode === 'AED') {
          converted = 'AED ' + (aed >= 1000 ? Math.round(aed / 1000) + 'K' : formatNumber(aed));
        } else {
          var c = CURRENCIES[currencyCode];
          var amt = roundPrice(aed * c.rate);
          converted = c.symbol + (amt >= 1000 ? Math.round(amt / 1000) + 'K' : formatNumber(amt));
        }
        el.textContent = el.getAttribute('data-price-compact-prefix') + converted;
        return;
      }

      // Standard price display: currency span + amount + optional suffix
      el.innerHTML =
        '<span class="' + (el.getAttribute('data-currency-class') || 'p-currency') + '">' + result.display + '</span>' +
        result.amount +
        (suffix ? '<span style="font-size:0.55em;color:var(--muted);">' + suffix + '</span>' : '');
    });

    // Update the selector UI
    document.querySelectorAll('.currency-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-currency') === currencyCode);
    });

    // Store preference
    try { localStorage.setItem(STORAGE_KEY, currencyCode); } catch(e) {}
  }

  // Detect currency from IP
  function detectCurrency(callback) {
    // Check stored preference first
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CURRENCIES[stored]) { callback(stored); return; }
    } catch(e) {}

    // Geo-detect
    fetch('https://ipapi.co/json/')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var code = COUNTRY_CURRENCY[data.country_code] || 'AED';
        callback(code);
      })
      .catch(function() { callback('AED'); });
  }

  // Inject currency selector into nav
  function injectSelector(activeCurrency) {
    var nav = document.querySelector('.nav-buttons');
    if (!nav || document.getElementById('currency-selector')) return;

    var selector = document.createElement('div');
    selector.id = 'currency-selector';
    selector.className = 'currency-selector';
    selector.innerHTML = Object.keys(CURRENCIES).map(function(code) {
      var c = CURRENCIES[code];
      var label = code === 'AED' ? '🇦🇪' : code === 'USD' ? '🇺🇸' : code === 'GBP' ? '🇬🇧' : '🇸🇬';
      return '<button class="currency-btn' + (code === activeCurrency ? ' active' : '') + '" data-currency="' + code + '" title="' + code + '">' + label + '</button>';
    }).join('');

    nav.insertBefore(selector, nav.firstChild);

    selector.addEventListener('click', function(e) {
      var btn = e.target.closest('.currency-btn');
      if (!btn) return;
      applyCurrency(btn.getAttribute('data-currency'));
    });
  }

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    detectCurrency(function(code) {
      applyCurrency(code);
      injectSelector(code);
    });
  });
})();
