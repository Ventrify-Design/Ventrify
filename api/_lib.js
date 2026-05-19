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

// ── Provocation cards (data-room L1 layer) ─────────────────────────────────
// Reads `[hub-dir]/_provocations/*.md` from the engagement repo, parses
// frontmatter, returns sorted card list. Per the protected data-room rules
// at .claude/memory/reference_data_room_rules.md in every engagement repo.
//
// Hub gets 0 cards = hasn't been re-curated under the data-room model yet
// (legacy section-list view falls back to existing behaviour).

async function ghListDir(repo, branch, path) {
  const data = await ghFetch(repo, branch, path);
  if (!data) return [];
  if (!Array.isArray(data)) return [];
  return data;
}

// Minimal YAML frontmatter parser — handles the curator's schema only:
// scalars, arrays of objects with file + anchor.
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: text };
  const fmRaw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\s*\n/, '');
  const fm = {};
  let currentArrayKey = null;
  let currentArrayItem = null;
  for (const line of fmRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      currentArrayKey = null;
      currentArrayItem = null;
      const colon = trimmed.indexOf(':');
      if (colon === -1) continue;
      const key = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (value === '') {
        fm[key] = [];
        currentArrayKey = key;
      } else {
        fm[key] = value.replace(/^["']|["']$/g, '');
      }
    } else if (currentArrayKey) {
      // arrays of objects — '- file: x' starts an item, '  anchor: y' adds to it
      if (trimmed.startsWith('- ')) {
        currentArrayItem = {};
        fm[currentArrayKey].push(currentArrayItem);
        const inner = trimmed.slice(2).trim();
        const colon = inner.indexOf(':');
        if (colon !== -1) {
          const key = inner.slice(0, colon).trim();
          const value = inner.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          currentArrayItem[key] = value;
        }
      } else if (currentArrayItem) {
        const colon = trimmed.indexOf(':');
        if (colon !== -1) {
          const key = trimmed.slice(0, colon).trim();
          const value = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          currentArrayItem[key] = value;
        }
      }
    }
  }
  return { frontmatter: fm, body };
}

async function readProvocations(repo, branch, hubDir) {
  const dirPath = `${hubDir}/_provocations`;
  const entries = await ghListDir(repo, branch, dirPath);
  if (!entries.length) return [];
  const cardFiles = entries.filter(e =>
    e.type === 'file' &&
    e.name.startsWith('prov-') &&
    e.name.endsWith('.md')
  );
  const cards = [];
  for (const f of cardFiles) {
    try {
      const content = await ghReadFile(repo, branch, `${dirPath}/${f.name}`);
      if (!content) continue;
      const { frontmatter, body } = parseFrontmatter(content);
      cards.push({
        id: frontmatter.id || f.name.replace('.md', ''),
        type: frontmatter.type || 'open-question',
        priority: parseInt(frontmatter.priority || '99', 10),
        status: frontmatter.status || 'open',
        evidenceLinks: frontmatter.evidence_links || [],
        body,
      });
    } catch (e) {
      console.error('[provocations] parse failed for', f.name, ':', e.message);
    }
  }
  return cards.sort((a, b) => a.priority - b.priority);
}

// L3 status comes from the Hub's `_provocations/_index.md` frontmatter.
// Possible values:
//   'pending'         — default. Cards may exist; L3 not yet built/refreshed
//                        against the resolved card directions
//   'pending-retrofit' — Hub was signed off before this rule was established
//                        (e.g. Research Hub on MoneyGym pre-2026-05-06).
//                        L3 will be retrofitted; treat as visible-on-portal
//                        for the operator to ship
//   'building'        — deep-research agents are mid-flight
//   'built'           — L3 is current as of the latest resolved cards.
//                        "View source documents" expander shows on the
//                        founder's portal view; sign-off button is unlocked
//                        (when combined with all-cards-commented).
//   'parallel-review' — Surprise-proposal mode: L3 was authored BEFORE cards
//                        (with operator approval per engagement STATUS.md).
//                        Both cards and L3 visible simultaneously, founder
//                        walks both in one visit. Sign-off still requires
//                        all-cards-commented (the cards-first gate stays
//                        in place — only the L3 hiding is bypassed).
//   'superseded'      — cards were refined; L3 needs another pass
//
// Per .claude/memory/feedback_l3_review_before_signoff.md (PROTECTED) in
// every engagement repo.
async function readHubL3Status(repo, branch, hubDir) {
  try {
    const indexPath = `${hubDir}/_provocations/_index.md`;
    const content = await ghReadFile(repo, branch, indexPath);
    if (!content) return 'pending';
    const { frontmatter } = parseFrontmatter(content);
    return frontmatter['l3-status'] || 'pending';
  } catch (e) {
    return 'pending';
  }
}

// ── Email payload builder (browser sends, not server) ──────────────────────
// Web3forms blocks all server-side submissions on the free plan. So instead
// of POSTing from the Vercel function, we build the payload here and the
// browser (portal-app.html) sends it directly to web3forms — the same
// pattern the contact form uses.
//
// Returns: { web3formsKey, subject, message, fromName, replyto? }
function buildEmailPayload({ subject, body, replyTo }) {
  const payload = {
    web3formsKey: WEB3FORMS_KEY,
    subject,
    message: body,
    fromName: 'Ventrify Portal',
  };
  if (replyTo) payload.replyto = replyTo;
  return payload;
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
  // ── Marketing Launch (Workstream B execution layer) ──────────────────
  // Replaces the legacy Marketing Launch Pack PDF. Surfaces the 20 launch
  // posts ready for Buffer scheduling, paired (in v2) with branded graphic
  // previews fetched via raw.githubusercontent.com.
  // alwaysVisible: bypasses the data-room mode filter — operational
  // deliverable, not legacy uncurated content.
  {
    slug: 'marketing-launch', name: 'Marketing Launch', dir: 'marketing',
    alwaysVisible: true,
    sections: [
      { slug: 'launch-posts', file: 'post-copy/launch-posts.md', name: '20 Launch Social Posts' },
    ],
    gate: null,
  },
  // ── Video (Workstream C production brief) ────────────────────────────
  // Replaces the legacy Video Production Brief PDF. The video pipeline at
  // tools/video/generate.js consumes this hub's source markdown.
  {
    slug: 'video', name: 'Video', dir: 'video',
    alwaysVisible: true,
    sections: [
      { slug: 'script', file: 'script.md', name: '60-second Promo Script' },
      { slug: 'audio-brief', file: 'audio-brief.md', name: 'Audio + Voiceover Brief' },
    ],
    gate: null,
  },
  // ── Blog (Workstream D editorial review) ─────────────────────────────
  // Replaces the legacy Blog Content Pack PDF. Operator review surface for
  // blog drafts before Sanity CMS publish. Public blog renders through the
  // marketing site at /blog (Sanity source).
  {
    slug: 'blog', name: 'Blog Drafts', dir: 'marketing/blog-posts',
    alwaysVisible: true,
    sections: [
      { slug: 'theory-vs-execution', file: 'theory-vs-execution-personal-finance.md', name: 'Theory vs Execution in Personal Finance' },
      { slug: 'subscription-audit', file: 'subscription-audit-saved-97-interest.md', name: 'How a Subscription Audit Saved $97 in Interest' },
      { slug: 'category-creation', file: 'behavioural-finance-category-creation.md', name: 'Behavioural Finance — Category Creation' },
      { slug: 'four-pain-points', file: 'four-pain-points-one-system-failure.md', name: 'Four Pain Points, One System Failure' },
      { slug: 'workout-fuel', file: 'workout-fuel-explained-personal-finance.md', name: 'Workout Fuel — Explained' },
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
  // ── Marketing Site (Workstream A deliverable surface) ────────────────
  // Per .claude/memory/feedback_deliverable_surfaces_hub.md (PROTECTED in
  // every engagement repo). Link-out hub — no markdown sections. Renders
  // a preview-link card pointing at the live deployment. URL stored in
  // PORTAL_CLIENTS[slug].marketingSiteUrl. Empty-frame placeholder shown
  // until the URL is registered.
  {
    slug: 'marketing-site', name: 'Marketing Site',
    alwaysVisible: true,
    surfaceType: 'preview-link',
    urlField: 'marketingSiteUrl',
    description: 'The public marketing site that lives at the production URL. Share with anyone — no auth required.',
    placeholderText: 'URL not yet registered. Deploy the site to Vercel, then register the URL via npm run publish-portal.',
    sections: [],
    gate: null,
  },
  // ── Design System Site (Workstream E deliverable surface) ────────────
  // Per .claude/memory/feedback_deliverable_surfaces_hub.md (PROTECTED).
  // Same pattern as marketing-site. URL stored in
  // PORTAL_CLIENTS[slug].dsSiteUrl. The DS site is the complete design
  // documentation: tokens, components, patterns, the Wireframes page,
  // personas, user stories, user flows.
  {
    slug: 'design-system', name: 'Design System',
    alwaysVisible: true,
    surfaceType: 'preview-link',
    urlField: 'dsSiteUrl',
    description: 'The complete design system documentation — tokens, components, patterns, wireframes, personas, user flows.',
    placeholderText: 'URL not yet registered. Deploy the site to Vercel, then register the URL via npm run publish-portal.',
    quickLinks: [
      { label: 'Personas', path: '/product/personas' },
      { label: 'Wireframes', path: '/product/wireframes' },
      { label: 'User Flows', path: '/product/user-flows' },
      { label: 'Components', path: '/components/button' },
    ],
    sections: [],
    gate: null,
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
  ghListDir,
  parseFrontmatter,
  readProvocations,
  readHubL3Status,
  buildEmailPayload,
  HUBS,
  hubsForScope,
  OPERATOR_EMAIL,
  TOKEN_TTL_SECONDS,
};
