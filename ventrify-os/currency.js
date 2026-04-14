(function() {
  const RATES = {
    GBP: { symbol: '\u00A3', rate: 1 },
    USD: { symbol: '$', rate: 1.27 },
    AED: { symbol: 'AED ', rate: 4.67 },
    CAD: { symbol: 'CA$', rate: 1.74 },
    SGD: { symbol: 'S$', rate: 1.71 }
  };
  const COUNTRY_MAP = {
    GB: 'GBP', US: 'USD', AE: 'AED', CA: 'CAD', SG: 'SGD',
    BH: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', OM: 'AED'
  };
  const STORAGE_KEY = 'ventrifos_currency';

  function convert(gbp, code) {
    var r = RATES[code] || RATES.GBP;
    var converted = Math.round(gbp * r.rate / 5) * 5; // round to nearest 5
    return r.symbol + converted.toLocaleString('en');
  }

  function apply(code) {
    document.querySelectorAll('[data-price-gbp]').forEach(function(el) {
      var gbp = parseInt(el.getAttribute('data-price-gbp'), 10);
      el.textContent = convert(gbp, code);
    });
    try { localStorage.setItem(STORAGE_KEY, code); } catch(e) {}
  }

  function detect(cb) {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && RATES[stored]) { cb(stored); return; }
    } catch(e) {}
    fetch('https://ipapi.co/json/')
      .then(function(r) { return r.json(); })
      .then(function(d) { cb(COUNTRY_MAP[d.country_code] || 'GBP'); })
      .catch(function() { cb('GBP'); });
  }

  document.addEventListener('DOMContentLoaded', function() { detect(apply); });
})();
