/* ============================================
   VENTRIFY SHARED JAVASCRIPT
   Nav injection, footer injection, hamburger, scroll reveal.
   Loaded on every page via defer.
   ============================================ */

// ── Detect active page ──
const currentPage = location.pathname.split('/').pop() || 'index.html';
function isActive(page) {
  if (page === 'about.html') return currentPage === 'about.html';
  if (page === 'work.html') return currentPage.startsWith('work');
  if (page === 'pricing.html') return currentPage === 'pricing.html';
  if (page === 'insights.html') return currentPage.startsWith('insight');
  if (page === 'contact.html') return currentPage === 'contact.html';
  return false;
}

// ── Inject Nav ──
const navEl = document.getElementById('site-nav');
if (navEl) {
  const links = [
    { href: 'about.html', label: 'About' },
    { href: 'work.html', label: 'Work' },
    { href: 'pricing.html', label: 'Pricing' },
    { href: 'insights.html', label: 'Insights' },
    { href: 'contact.html', label: 'Contact' }
  ];

  const navLinksHTML = links.map(l =>
    `<a href="${l.href}"${isActive(l.href) ? ' class="active"' : ''}>${l.label}</a>`
  ).join('\n    ');

  const mobileLinksHTML = links.map(l =>
    `<a href="${l.href}" class="m-nav-link">${l.label}</a>`
  ).join('\n  ');

  navEl.innerHTML = `
  <a href="index.html" class="logo"><img src="ventrify.svg" alt="Ventrify" style="height:22px;width:auto;display:block;"></a>
  <div class="nav-links">
    ${navLinksHTML}
  </div>
  <div class="nav-buttons">
    <a href="portal.html" class="btn btn-outline nav-cta" style="gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Client Login</a>
    <a href="contact.html" class="btn btn-primary nav-cta">Start Your Venture</a>
  </div>
  <button class="hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false">
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
  </button>`;

  // Inject mobile menu
  let mobileMenu = document.getElementById('mobileMenu');
  if (!mobileMenu) {
    mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.id = 'mobileMenu';
    mobileMenu.setAttribute('role', 'dialog');
    mobileMenu.setAttribute('aria-label', 'Navigation menu');
    navEl.insertAdjacentElement('afterend', mobileMenu);
  }
  mobileMenu.innerHTML = `
  ${mobileLinksHTML}
  <div class="m-cta" style="display:flex;flex-direction:column;gap:0.75rem;">
    <a href="portal.html" class="btn btn-outline btn-lg" style="gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Client Login</a>
    <a href="contact.html" class="btn btn-primary btn-lg">Start Your Venture</a>
  </div>`;

  // Hamburger toggle
  const hamburger = document.getElementById('hamburger');
  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

// ── Inject Footer ──
const footerEl = document.getElementById('site-footer');
if (footerEl) {
  footerEl.innerHTML = `
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="logo"><img src="ventrify.svg" alt="Ventrify" style="height:22px;width:auto;display:block;"></div>
      <p>AI-powered venture building for pre-seed founders. From idea to launched product — strategy, design, development, brand, and marketing under one roof.</p>
      <div class="location-chip">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Dubai &middot; London &middot; New York &middot; Singapore
      </div>
    </div>
    <div class="footer-col"><h4>Company</h4><a href="about.html">About</a><a href="work.html">Work</a><a href="pricing.html">Pricing</a><a href="insights.html">Insights</a><a href="contact.html">Contact</a></div>
    <div class="footer-col"><h4>Services</h4><a href="about.html">Strategy</a><a href="about.html">Design</a><a href="about.html">Development</a><a href="about.html">Brand &amp; Marketing</a></div>
    <div class="footer-col"><h4>Connect</h4><a href="#">LinkedIn</a><a href="#">Instagram</a><a href="#">Twitter / X</a><a href="contact.html">hello@ventrify.io</a></div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 Ventrify. All rights reserved.</p>
    <p>Built with AI. Launched with intention.</p>
  </div>`;
}

// ── Scroll reveal observer ──
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('revealed');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

document.querySelectorAll('[data-reveal]').forEach(el => revealObs.observe(el));
