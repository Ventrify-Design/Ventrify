/**
 * Shared helpers for the Portal API.
 *
 * Auth model — HMAC-signed cookie tokens, no database.
 *
 * Tokens carry: { slug, scope: 'client'|'investor', issuedAt }
 * Validity: 24h (re-login if expired)
 *
 * Env vars required (set on Vercel):
 *   PORTAL_SECRET            — random 32+ char string for HMAC signing
 *   PORTAL_CLIENTS           — JSON keyed by slug. See README in this folder.
 *   GITHUB_TOKEN             — optional; if set, feedback commits to engagement repo
 *   WEB3FORMS_KEY            — already present (re-uses contact form key) for email delivery
 *   OPERATOR_EMAIL           — antony@ventrify.io
 */

const crypto = require('crypto');

const SECRET = process.env.PORTAL_SECRET || 'ventrify-portal-dev-secret-change-me';
const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h
const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'antony@ventrify.io';
const WEB3FORMS_KEY = process.env.WEB3FORMS_KEY || '0c7e6dc6-a0b0-4dcf-9317-8899e8884f8e';

// ── Client config (loaded from env at runtime) ──────────────────────────────
function loadClients() {
  const raw = process.env.PORTAL_CLIENTS;
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (e) {
    console.error('[portal] PORTAL_CLIENTS env var is not valid JSON:', e.message);
    return {};
  }
}

// ── Token sign / verify (HMAC-SHA256) ───────────────────────────────────────
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  // timing-safe comparison
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.slug || !payload.scope || !payload.issuedAt) return null;
    if (Date.now() / 1000 - payload.issuedAt > TOKEN_TTL_SECONDS) return null;
    return payload;
  } catch (e) { return null; }
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(res, name, value, opts) {
  const o = opts || {};
  const parts = [`${name}=${value}`];
  if (o.maxAge) parts.push(`Max-Age=${o.maxAge}`);
  parts.push('Path=/');
  parts.push('SameSite=Lax');
  parts.push('Secure');
  parts.push('HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// ── Auth gate (use at the top of every protected handler) ──────────────────
function requireAuth(req, res, opts) {
  const o = opts || {};
  const minScope = o.minScope || 'investor'; // 'investor' = any logged-in; 'client' = client-scope only
  const token = getCookie(req, 'portal_token');
  const payload = verifyToken(token);
  if (!payload) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
    return null;
  }
  // 'client' scope endpoints reject investors
  if (minScope === 'client' && payload.scope !== 'client') {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden_scope' }));
    return null;
  }
  return payload;
}

// ── JSON body parser (Vercel functions get raw req) ────────────────────────
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

// ── GitHub API helpers ─────────────────────────────────────────────────────
// Public-repo reads need no token; private-repo reads need GITHUB_TOKEN.
// Writes (commits) always need GITHUB_TOKEN with repo:contents write scope.

async function ghFetch(repo, branch, path) {
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}${ref}`;
  const headers = { 'User-Agent': 'Ventrify-Portal', 'Accept': 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub fetch ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ghReadFile(repo, branch, path) {
  const data = await ghFetch(repo, branch, path);
  if (!data) return null;
  if (data.encoding !== 'base64') throw new Error('expected base64-encoded file');
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function ghCommitFile(repo, branch, path, content, message) {
  if (!process.env.GITHUB_TOKEN) {
    return { skipped: true, reason: 'GITHUB_TOKEN not set' };
  }
  // Get current SHA if the file exists (required for updates)
  const existing = await ghFetch(repo, branch, path);
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: branch || 'main',
    committer: { name: 'Ventrify Portal', email: 'portal@ventrify.io' },
  };
  if (existing && existing.sha) body.sha = existing.sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'User-Agent': 'Ventrify-Portal',
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub commit ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Email delivery via web3forms (already in use on contact page) ──────────
async function sendEmail({ subject, body, replyTo }) {
  const formData = new URLSearchParams();
  formData.append('access_key', WEB3FORMS_KEY);
  formData.append('subject', subject);
  formData.append('from_name', 'Ventrify Portal');
  formData.append('to', OPERATOR_EMAIL);
  formData.append('message', body);
  if (replyTo) formData.append('replyto', replyTo);
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    body: formData,
  });
  return res.ok;
}

// ── Hub catalogue (single source of truth for what each hub renders) ───────
// Mirrors the engagement repo's portal structure. When a new hub is added
// (e.g. wireframes after Phase 4), add it here.
const HUBS = [
  {
    slug: 'research', name: 'Research', dir: 'research',
    sections: [
      { slug: 'market-analysis', file: 'market-analysis.md', name: 'Market Analysis' },
      { slug: 'competitor-analysis', file: 'competitor-analysis.md', name: 'Competitor Analysis' },
      { slug: 'user-insights', file: 'user-insights.md', name: 'User Insights' },
      { slug: 'swot', file: 'swot.md', name: 'SWOT Analysis' },
      { slug: 'opportunities', file: 'opportunities.md', name: 'Opportunities' },
      { slug: 'unit-economics', file: 'unit-economics.md', name: 'Unit Economics' },
      { slug: 'partnerships', file: 'partnerships.md', name: 'Partnerships & Distribution' },
    ],
    gate: 'Gate 1',
  },
  {
    slug: 'vision', name: 'Vision', dir: 'define',
    sections: [
      { slug: 'product-vision', file: 'product-vision.md', name: 'Product Vision' },
      { slug: 'personas', file: 'personas.md', name: 'User Personas' },
      { slug: 'mvp-features', file: 'mvp-features.md', name: 'MVP Features (MoSCoW)' },
      { slug: 'user-journeys', file: 'user-journeys.md', name: 'User Journeys' },
      { slug: 'information-architecture', file: '../design/information-architecture.md', name: 'Information Architecture' },
      { slug: 'tech-stack', file: 'tech-stack.md', name: 'Tech Stack' },
      { slug: 'roadmap', file: 'roadmap.md', name: 'Roadmap' },
    ],
    gate: 'Gate 2',
  },
  {
    slug: 'strategy', name: 'Strategy', dir: 'marketing',
    sections: [
      { slug: 'tone-of-voice', file: 'tone-of-voice.md', name: 'Tone of Voice' },
      { slug: 'social-strategy', file: 'social-strategy.md', name: 'Social Strategy' },
      { slug: 'content-calendar', file: 'content-calendar.md', name: '30-Day Content Calendar' },
    ],
    gate: null,
  },
  {
    slug: 'financials', name: 'Financials', dir: 'financials',
    sections: [
      { slug: 'financial-summary', file: '_financial-summary.md', name: 'Financial Summary' },
      { slug: 'funding-ask', file: 'funding-ask.md', name: 'The Funding Ask' },
      { slug: 'cash-flow-forecast', file: 'cash-flow-forecast.md', name: '24-Month Cash Flow' },
      { slug: 'revenue-model', file: 'revenue-model.md', name: 'Revenue Model' },
      { slug: 'unit-economics-detailed', file: 'unit-economics-detailed.md', name: 'Unit Economics' },
      { slug: 'operating-costs', file: 'operating-costs.md', name: 'Operating Costs' },
      { slug: 'build-costs', file: 'build-costs.md', name: 'Build Costs' },
      { slug: 'marketing-budget', file: 'marketing-budget.md', name: 'Marketing Budget' },
      { slug: 'hiring-plan', file: 'hiring-plan.md', name: 'Hiring Plan' },
      { slug: 'sensitivity-analysis', file: 'sensitivity-analysis.md', name: 'Sensitivity Analysis' },
      { slug: 'scope-change-recommendations', file: 'scope-change-recommendations.md', name: 'Scope Change Recommendations' },
    ],
    gate: 'Gate 2.5',
  },
];

// Investor scope: financials only (sensitive scope-loop hidden from investors)
function hubsForScope(scope) {
  if (scope === 'investor') {
    return [{
      ...HUBS.find(h => h.slug === 'financials'),
      sections: HUBS.find(h => h.slug === 'financials').sections.filter(s => s.slug !== 'scope-change-recommendations'),
    }];
  }
  return HUBS;
}

module.exports = {
  loadClients,
  signToken,
  verifyToken,
  getCookie,
  setCookie,
  requireAuth,
  readJsonBody,
  ghFetch,
  ghReadFile,
  ghCommitFile,
  sendEmail,
  HUBS,
  hubsForScope,
  OPERATOR_EMAIL,
  TOKEN_TTL_SECONDS,
};
