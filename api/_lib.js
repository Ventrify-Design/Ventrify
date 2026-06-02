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

// ── Binary file fetch (decks, screenshots, etc.) ──────────────────────────
// Returns { buffer, sha, size, downloadUrl } for any file in the engagement
// repo. Used by the Investor Pitch Deck hub to fetch .pptx + .pdf bytes for
// in-portal preview and download.
//
// CRITICAL: GitHub's /contents API has a 1MB cap on inline base64 content.
// Files larger than 1MB return { encoding: "none", content: "" } and require
// fetching from the raw download_url instead. Decks routinely exceed 1MB
// (typical .pptx ~3MB, .pdf ~5-10MB) — this fallback is essential.
//
// Private repos require Bearer auth on raw.githubusercontent.com too, so we
// retry with GITHUB_TOKEN if the unauthenticated raw fetch 404s/403s.
async function ghReadBinaryFile(repo, branch, path) {
  const data = await ghFetch(repo, branch, path);
  if (!data) return null;

  // Inline path — file ≤ 1MB
  if (data.encoding === 'base64' && data.content) {
    return {
      buffer: Buffer.from(data.content.replace(/\n/g, ''), 'base64'),
      sha: data.sha,
      size: data.size,
      downloadUrl: data.download_url || null,
    };
  }

  // Large-file path — fetch from download_url with auth
  if (!data.download_url) return null;
  const headers = { 'User-Agent': 'Ventrify-Portal' };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const rawRes = await fetch(data.download_url, { headers });
  if (!rawRes.ok) {
    throw new Error(`raw fetch ${rawRes.status} for ${path}`);
  }
  const arrayBuf = await rawRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    sha: data.sha,
    size: data.size,
    downloadUrl: data.download_url,
  };
}

// ── Deck version listing (Investor Pitch Deck hub) ────────────────────────
// Walks the engagement repo's decks/ directory and returns versioned deck
// files (.pptx + .pdf pairs OR PDF-only releases). Used by portal-list to
// surface version history and the latest version's preview/download links.
//
// Filename pattern: <anyPrefix>-<baseName>-v<N>.{pptx,pdf}
//   (e.g. moneygym-investor-deck-v3.pptx + moneygym-investor-deck-v3.pdf)
//
// A version is registered if EITHER a .pptx or a .pdf exists for it. This
// matters when an operator ships a PDF-only release (rendered straight from
// a non-pptx source — e.g. Figma export, designer Keynote). Such versions
// preview fine and download as PDF; the renderer hides the "Download .pptx"
// action when no .pptx companion is present.
async function listDeckVersions(repo, branch, deckDir, deckBaseName) {
  const entries = await ghListDir(repo, branch, deckDir);
  if (!entries || entries.length === 0) return { versions: [], latest: null };

  const pptxRegex = new RegExp(`^(.+?)-${deckBaseName}-v(\\d+)\\.pptx$`, 'i');
  const pdfRegex = new RegExp(`^(.+?)-${deckBaseName}-v(\\d+)\\.pdf$`, 'i');

  const fileAsset = (entry) => ({
    name: entry.name,
    path: `${deckDir}/${entry.name}`,
    size: entry.size,
    downloadUrl: entry.download_url || null,
  });

  const pptxByVersion = {};
  const pdfByVersion = {};
  for (const entry of entries) {
    if (entry.type !== 'file') continue;
    const pptxMatch = pptxRegex.exec(entry.name);
    if (pptxMatch) {
      pptxByVersion[parseInt(pptxMatch[2], 10)] = fileAsset(entry);
      continue;
    }
    const pdfMatch = pdfRegex.exec(entry.name);
    if (pdfMatch) {
      pdfByVersion[parseInt(pdfMatch[2], 10)] = fileAsset(entry);
    }
  }

  const allVersionNums = new Set([
    ...Object.keys(pptxByVersion).map(Number),
    ...Object.keys(pdfByVersion).map(Number),
  ]);
  const versions = Array.from(allVersionNums)
    .map((v) => ({
      version: v,
      pptx: pptxByVersion[v] || null,
      pdf: pdfByVersion[v] || null,
    }))
    .sort((a, b) => b.version - a.version);

  return {
    versions,
    latest: versions.length > 0 ? versions[0] : null,
  };
}

// ── pdf-binary surface helper ────────────────────────────────────────────
// Used by the Foundations hubs (SOW, Welcome Pack). The engagement repo
// names these as `<client-slug>-<baseName>.pdf` (e.g. `moneygym-sow.pdf`,
// `moneygym-welcome-pack.pdf`). Returns the latest single PDF if multiple
// candidates exist, otherwise the only one. Unversioned and read-only.
async function listSinglePdf(repo, branch, dir, baseName) {
  let entries;
  try {
    entries = await ghListDir(repo, branch, dir);
  } catch (_e) {
    return null;
  }
  if (!entries || entries.length === 0) return null;
  const re = new RegExp(`-?${baseName}\\.pdf$`, 'i');
  const matches = entries
    .filter((e) => e.type === 'file' && re.test(e.name))
    .map((e) => ({
      name: e.name,
      path: `${dir}/${e.name}`,
      size: e.size,
      downloadUrl: e.download_url || null,
    }));
  if (matches.length === 0) return null;
  // If multiple match, prefer the lexically-last (newest by convention).
  matches.sort((a, b) => a.name.localeCompare(b.name));
  return matches[matches.length - 1];
}

// ── Brief snapshot parser (Foundations: Brief) ────────────────────────────
// Parses brief.md (the canonical Ventrify intake form) into a structured
// payload the portal renders as a snapshot view: hero + overview cards +
// goals + features + inspiration + platform + team + notes. Resilient to
// the founder skipping fields — anything missing falls out as null and
// the renderer hides the empty slot.
function parseBriefSnapshot(text) {
  if (!text || typeof text !== 'string') return null;

  const result = {
    title: null,
    meta: { date: null, lead: null, programme: null, engagementType: null },
    overview: {
      projectName: null,
      oneLiner: null,
      problem: null,
      targetUser: null,
      vision: null,
    },
    goals: { motivations: [], primaryGoal: null, successCriteria: null },
    features: [],
    inspiration: { competitors: [], designStyle: null },
    platform: { selected: [], preferred: null },
    team: { clientRole: null, stakeholders: null, technicalCapability: null },
    notes: null,
  };

  // H1 → title (first line beginning with single #)
  const h1 = text.match(/^#\s+(.+?)$/m);
  if (h1) result.title = h1[1].trim();

  // Top-level metadata: **Key:** value lines BEFORE the first ## heading
  const firstH2 = text.search(/^##\s/m);
  const head = firstH2 > -1 ? text.slice(0, firstH2) : text;
  const grabMeta = (label) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, 'i');
    const m = head.match(re);
    return m ? m[1].trim() : null;
  };
  result.meta.date = grabMeta('Date');
  result.meta.lead = grabMeta('Ventrify Lead');
  result.meta.programme = grabMeta('Programme') || grabMeta('Tier'); // back-compat
  result.meta.engagementType = grabMeta('Engagement Type');

  // Split by H2 sections — emoji prefixes are tolerated. Section key is the
  // trailing word group of the heading (`## 🧾 Project Overview` → 'Project Overview').
  const sectionMatches = [...text.matchAll(/^##\s+(?:\S+\s+)?(.+?)$/gm)];
  const sectionBodies = sectionMatches.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < sectionMatches.length ? sectionMatches[i + 1].index : text.length;
    return { title: m[1].trim(), body: text.slice(start, end).trim() };
  });

  // Field-bullet extractor: `- **Label:** value` (value may continue across
  // wrapped lines until the next `- **` or `## ` boundary). Strips trailing
  // `---` separators that bleed in from the section terminator.
  const extractField = (body, label) => {
    const re = new RegExp(`-\\s+\\*\\*${label}:?\\*\\*\\s*([\\s\\S]*?)(?=\\n-\\s+\\*\\*|\\n##\\s|\\n---\\s|$)`, 'i');
    const m = body.match(re);
    if (!m) return null;
    return m[1].trim()
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n*---\s*$/g, '')
      .trim() || null;
  };

  for (const s of sectionBodies) {
    const t = s.title;
    if (/Project Overview/i.test(t)) {
      result.overview.projectName = extractField(s.body, 'Project Name');
      result.overview.oneLiner = extractField(s.body, 'One-liner Description')
        || extractField(s.body, 'One-liner');
      result.overview.problem = extractField(s.body, 'Problem being solved')
        || extractField(s.body, 'Problem');
      result.overview.targetUser = extractField(s.body, 'Target user / customer')
        || extractField(s.body, 'Target user');
      result.overview.vision = extractField(s.body, '1-year product vision')
        || extractField(s.body, 'Product vision');
    } else if (/Project Goals/i.test(t)) {
      // Motivation checkboxes. `gm` so `$` means end-of-line per match.
      const motMatches = [...s.body.matchAll(/^-\s+\[([ x])\]\s+(.+?)$/gim)];
      result.goals.motivations = motMatches.map((m) => ({
        label: m[2].trim().replace(/_+$/, '').trim(),
        checked: m[1].toLowerCase() === 'x',
      })).filter((m) => m.label && !/other/i.test(m.label));
      result.goals.primaryGoal = extractField(s.body, 'Primary goal for MVP')
        || extractField(s.body, 'Primary goal');
      result.goals.successCriteria = extractField(s.body, 'Success looks like');
    } else if (/Key Features/i.test(t)) {
      // Features: each top-level `- ...` bullet IS a feature. Title format
      // is the brief's intake convention: "Feature N — Short Title BodyText".
      // Split heuristic: after the em-dash, accept up to ~7 Title-Case words
      // before the first sentence-cap word, then everything else is body.
      const featureLines = [...s.body.matchAll(/^-\s+(.+?)(?=\n-\s|\n##\s|\n---\s|$)/gms)];
      result.features = featureLines.map((m, i) => {
        const raw = m[1].trim();
        const headed = raw.match(/^(Feature\s+\d+)\s*[—-]\s*(.*)$/is);
        if (headed) {
          const num = headed[1].trim();
          const rest = headed[2].trim();
          // Title boundary: where the brief's "Feature N — Title Body..." pattern
          // transitions into the body. Heuristic: stop at the first sentence-
          // starter word (This/The/It/Each/Build/etc.) preceded by whitespace.
          // Falls back to char-count + word-boundary if no marker is found.
          let split = -1;
          // Conservative determiner/pronoun list — words that virtually
          // never appear within a brief feature title but always start a
          // new clause. Greedy word lists (e.g. "Build", "Core") backfire
          // because they appear in actual titles ("and Build Objective").
          const SENT_STARTERS = /\s+(This|These|The|It)\s+\w/;
          const sentMatch = rest.match(SENT_STARTERS);
          if (sentMatch && sentMatch.index > 8 && sentMatch.index < 110) {
            split = sentMatch.index;
          } else {
            const period = rest.search(/\.\s+[A-Z]/);
            if (period > 0 && period < 80) split = period + 1;
            else {
              split = Math.min(60, rest.length);
              const ws = rest.lastIndexOf(' ', split);
              if (ws > 10) split = ws;
            }
          }
          const title = `${num} — ${rest.slice(0, split).trim()}`;
          const body = rest.slice(split).trim();
          return { id: `f${i + 1}`, title, body };
        }
        // Plain bullet — title is first sentence, body the rest
        const period = raw.search(/\.\s+[A-Z]/);
        if (period > 10 && period < 200) {
          return { id: `f${i + 1}`, title: raw.slice(0, period + 1).trim(), body: raw.slice(period + 2).trim() };
        }
        return { id: `f${i + 1}`, title: raw.slice(0, 80).trim() + (raw.length > 80 ? '…' : ''), body: raw };
      });
    } else if (/Inspiration/i.test(t)) {
      // Competitors: nested `  - Name — URL` or `  - [Name](URL)` under a parent label
      const compRe = /-\s+(?:\[([^\]]+)\]\(([^)]+)\)|([^—\n[]+?)\s+[—-]\s+(https?:\/\/[^\s]+))/g;
      const comps = [...s.body.matchAll(compRe)];
      result.inspiration.competitors = comps.map((c) => ({
        name: (c[1] || c[3] || '').trim(),
        url: (c[2] || c[4] || '').trim(),
      })).filter((c) => c.name);
      result.inspiration.designStyle = extractField(s.body, 'Design style');
    } else if (/Platform/i.test(t)) {
      const platMatches = [...s.body.matchAll(/^-\s+\[([ x])\]\s+(.+?)$/gim)];
      result.platform.selected = platMatches.map((m) => ({
        label: m[2].trim().replace(/_+$/, '').trim(),
        checked: m[1].toLowerCase() === 'x',
      })).filter((m) => m.label && !/other/i.test(m.label) && !/no preference/i.test(m.label));
      result.platform.preferred = extractField(s.body, 'Preferred tools/platforms')
        || extractField(s.body, 'Preferred tools');
    } else if (/Team/i.test(t)) {
      result.team.clientRole = extractField(s.body, 'Client name & role')
        || extractField(s.body, 'Client name');
      result.team.stakeholders = extractField(s.body, 'Other stakeholders');
      result.team.technicalCapability = extractField(s.body, 'Technical capability on client team')
        || extractField(s.body, 'Technical capability');
    } else if (/Additional Notes/i.test(t) || /Notes/i.test(t)) {
      // Strip the standard intake-footer block (no /m so `$` is end-of-string).
      result.notes = s.body
        .replace(/^>\s+This brief is generated by[\s\S]*$/, '')
        .replace(/^>\s+Claude reads this file[\s\S]*$/, '')
        .replace(/\n*---\s*$/g, '')
        .trim() || null;
    }
  }

  return result;
}

// ── Figma deliverable helper ─────────────────────────────────────────────
// Looks for a single source file at `<dir>/<baseName>.<ext>` where ext is
// any of the conventional Figma-export formats. Returns the first match
// (or null if absent). Lets operators ship the design source as either:
//   - <baseName>.fig                 (Figma desktop save-local)
//   - <baseName>.zip                 (Figma + extracted exports bundle)
//   - <baseName>.sketch              (Sketch fallback)
//   - <baseName>.xd                  (Adobe XD fallback)
// Used by the Figma deliverable hub (surfaceType: 'figma-deliverable').
async function listFigmaFile(repo, branch, dir, baseName) {
  let entries;
  try {
    entries = await ghListDir(repo, branch, dir);
  } catch (_e) {
    return null;
  }
  if (!entries || entries.length === 0) return null;
  const exts = ['fig', 'zip', 'sketch', 'xd'];
  const lower = baseName.toLowerCase();
  for (const ext of exts) {
    const match = entries.find(
      (e) => e.type === 'file' && e.name.toLowerCase() === `${lower}.${ext}`,
    );
    if (match) {
      return {
        name: match.name,
        path: `${dir}/${match.name}`,
        size: match.size,
        downloadUrl: match.download_url || null,
        ext,
      };
    }
  }
  return null;
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
  // ─────────────────────────────────────────────────────────────────────
  // Foundations (added 2026-06-02 by operator request).
  // The five engagement-defining artefacts that frame the whole project:
  // what we agreed to build, on what terms, at what tier, on what schedule.
  // Sit ABOVE the Data Room because they're the most-frequently-revisited
  // documents over an engagement's life — the brief gets re-read every
  // gate review; the SOW gets re-read every scope-change conversation.
  // ─────────────────────────────────────────────────────────────────────

  // 1. Brief — the founder-authored intake form. The single most-cited
  // document in every engagement. Renders as a structured "snapshot" that
  // parses brief.md and presents the captured fields as hero + cards rather
  // than dumping raw markdown.
  {
    slug: 'brief', name: 'Brief',
    category: 'foundations',
    alwaysVisible: true,
    surfaceType: 'brief-snapshot',
    briefPath: 'brief.md',
    description: 'Playback of the venture brief — what we captured at intake. Project goals, target user, positioning, key features, inspiration, platform, team.',
    placeholderText: 'brief.md not yet generated. Run npm run intake in the engagement repo to capture the brief, then push — the playback appears here.',
    sections: [],
    gate: null,
  },
  // 2. Welcome Pack — the Ventrify OS onboarding document.
  // Reframed 2026-06-02 from per-engagement agency fee + milestones to
  // "Powered by Ventrify OS" framing. PDF generator (in the engagement
  // repo) will be rewritten in a follow-up — this hub renders whatever
  // is currently in gate-reviews/, so the moment the new PDF is pushed
  // the portal picks it up.
  {
    slug: 'welcome-pack', name: 'Welcome Pack',
    category: 'foundations',
    alwaysVisible: true,
    surfaceType: 'pdf-binary',
    pdfDir: 'gate-reviews',
    pdfBaseName: 'welcome-pack',
    description: 'How your venture works — what we heard, the three things we see in your market, the three hypotheses we will test, and the 70+ deliverables this venture earns from Ventrify OS.',
    placeholderText: 'Welcome Pack not yet generated. Run npm run pdf:welcome in the engagement repo, then push — the PDF appears here.',
    sections: [],
    gate: null,
  },
  // 3. Venture Scope (replaces the old per-engagement Tier Scope).
  // Renders the canonical Ventrify OS deliverable list as a phase-by-phase
  // checklist (~70+ items across Phase 1-5). Same for every venture —
  // there is no per-venture tier under Ventrify OS.
  // Implementation is in portal-list.js (surfaceType: 'venture-scope').
  {
    slug: 'venture-scope', name: 'Venture Scope',
    category: 'foundations',
    alwaysVisible: true,
    surfaceType: 'venture-scope',
    description: 'The 70+ deliverables every venture earns from Ventrify OS — phase by phase, gate by gate, from intake to launch.',
    sections: [],
    gate: null,
  },
  // 4. Engagement Timeline — v1 renders STATUS.md as a markdown hub.
  // STATUS.md is the operator-maintained phase/gate/workstream tracker —
  // same source the timeline strip across the top of the Overview reads
  // from. (Note: STATUS.md still contains a payment-milestone block from
  // the old agency model — to be removed in the Phase 2 cleanup.)
  {
    slug: 'engagement-timeline', name: 'Engagement Timeline', dir: '.',
    category: 'foundations',
    alwaysVisible: true,
    description: 'Phase-by-phase venture timeline — every phase, gate, and workstream with sign-off dates. Updated live as your venture progresses through Ventrify OS.',
    sections: [
      { slug: 'status', file: 'STATUS.md', name: 'Status & Timeline' },
    ],
    gate: null,
  },

  {
    slug: 'research', name: 'Research', dir: 'research',
    category: 'data-room',
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
    category: 'data-room',
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
  // ── Strategy (Workstream B planning + execution layer) ──────────────
  // Owns BOTH the strategy artefacts (tone/social/calendar) AND the
  // launch-posts execution layer. The Marketing Launch hub was retired
  // 2026-06-02 — Strategy is the single home for the marketing track.
  {
    slug: 'strategy', name: 'Strategy', dir: 'marketing',
    category: 'data-room',
    sections: [
      { slug: 'tone-of-voice', file: 'tone-of-voice.md', name: 'Tone of Voice' },
      { slug: 'social-strategy', file: 'social-strategy.md', name: 'Social Strategy' },
      { slug: 'content-calendar', file: 'content-calendar.md', name: '30-Day Content Calendar' },
      { slug: 'launch-posts', file: 'post-copy/launch-posts.md', name: '20 Launch Social Posts' },
    ],
    gate: null,
  },
  {
    slug: 'financials', name: 'Financials', dir: 'financials',
    category: 'data-room',
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
  // ─────────────────────────────────────────────────────────────────────
  // Deliverables (rendered in array order — this order IS the UI order).
  // Locked 2026-06-02 by operator preference:
  //   1. Design System
  //   2. Marketing Website
  //   3. App Preview
  //   4. Intelligence Engine
  //   5. Social Launch Preview
  //   6. Blog Drafts
  //   7. Video
  //   8. Investor Pitch Deck
  // ─────────────────────────────────────────────────────────────────────

  // 1. Design System Site (Workstream E deliverable surface)
  // Per .claude/memory/feedback_deliverable_surfaces_hub.md (PROTECTED).
  // The DS site is the complete design documentation: tokens, components,
  // patterns, the Wireframes page, personas, user stories, user flows.
  {
    slug: 'design-system', name: 'Design System',
    category: 'deliverable',
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
  // 2. Marketing Website (Workstream A deliverable surface)
  // Per .claude/memory/feedback_deliverable_surfaces_hub.md (PROTECTED).
  // Link-out hub — no markdown sections. Renders a preview-link card
  // pointing at the live deployment. URL stored in
  // PORTAL_CLIENTS[slug].marketingSiteUrl. Slug stays as 'marketing-site'
  // for backwards-compat with existing PORTAL_CLIENTS entries.
  {
    slug: 'marketing-site', name: 'Marketing Website',
    category: 'deliverable',
    alwaysVisible: true,
    surfaceType: 'preview-link',
    urlField: 'marketingSiteUrl',
    description: 'The public marketing site that lives at the production URL. Share with anyone — no auth required.',
    placeholderText: 'URL not yet registered. Deploy the site to Vercel, then register the URL via npm run publish-portal.',
    sections: [],
    gate: null,
  },
  // 3. App Preview (Phase 4 deliverable surface)
  // The real iOS app build, streamed in-portal via Appetize.io's embeddable
  // simulator. Investors interact with the actual signed .app — true touch
  // emulation, pixel-identical to iOS — without leaving the portal.
  //
  // surfaceType: 'appetize-embed' tells portal-list.js + portal-app.html to
  // render an iframe pointing at https://appetize.io/embed/{publicKey}.
  // publicKey lives on the client config:
  // PORTAL_CLIENTS[slug].appetizePublicKey.
  //
  // FREE TIER: Appetize displays a "Powered by Appetize" overlay + caps
  // total monthly simulator-minutes to ~100. Starter removes most of the
  // branding and increases the minute cap. Hub structure is identical for
  // both tiers — only the visible overlay differs.
  //
  // FALLBACK: when appetizePublicKey is not configured for a client, the
  // hub renders a placeholder with upload-and-register instructions.
  {
    slug: 'app-preview', name: 'App Preview',
    category: 'deliverable',
    alwaysVisible: true,
    surfaceType: 'appetize-embed',
    publicKeyField: 'appetizePublicKey',
    description: 'The MoneyGym iOS app, running live in your browser via an embedded simulator. Pick a persona, walk through My Finances → My Workout → My Performance, open Coach\'s Corner — every interaction is the real signed app build, not a mock.',
    placeholderText: 'Appetize publicKey not yet registered. Upload the iOS .app build to appetize.io, copy the publicKey, and register it via npm run publish-portal.',
    sections: [],
    gate: null,
  },
  // 4. Intelligence Engine (MoneyGym backend coaching engine)
  // Per .claude/memory/feedback_deliverable_surfaces_hub.md (PROTECTED in
  // every engagement repo) — same preview-link pattern as the marketing,
  // DS, app-preview and social-preview hubs.
  //
  // Single-file HTML deliverable (Jonathan's self-contained coaching engine
  // — persona simulation, intent classifier, session catalogue, traits +
  // pentagon scoring, closed-loop ledger). Runs entirely in the visitor's
  // browser; the visitor pastes a Claude API key at runtime and chats with
  // the engine. The same engine, paired with a local Node bridge
  // (/intelligence-engine/bridge.js in the engagement repo), powers
  // Coach's Corner inside the MoneyGym RN app — proving the
  // front-end ↔ backend round-trip.
  //
  // URL stored in PORTAL_CLIENTS[slug].intelligenceEngineUrl. Deployed as
  // a standalone Vercel project (ventrify-engine-moneygym) under the
  // ventrify-designs-projects scope per the standard recipe in
  // feedback_vercel_site_deploys.md (PROTECTED).
  {
    slug: 'intelligence-engine', name: 'Intelligence Engine',
    category: 'deliverable',
    alwaysVisible: true,
    surfaceType: 'preview-link',
    urlField: 'intelligenceEngineUrl',
    description: 'The backend coaching engine that powers Coach’s Corner in the MoneyGym app. Persona simulation, intent classification, a 25-template session catalogue, traits + pentagon scoring, closed-loop ledger — all running live in your browser. Paste a Claude API key in the engine’s top-right field to start chatting; the same engine (paired with a local bridge) is what drives Coach’s Corner inside the RN app.',
    placeholderText: 'URL not yet registered. Deploy the engine HTML to Vercel as ventrify-engine-<slug>, then register the URL via npm run publish-portal.',
    sections: [],
    gate: null,
  },
  // 5. Social Launch Preview (Workstream B deliverable surface)
  // Static page that mocks every launch social post on its actual platform
  // UI (LinkedIn / X / Instagram). Lets the founder see exactly how each
  // post will read in-feed before any scheduling decisions are made.
  // URL stored in PORTAL_CLIENTS[slug].socialPreviewUrl.
  {
    slug: 'social-preview', name: 'Social Launch Preview',
    category: 'deliverable',
    alwaysVisible: true,
    surfaceType: 'preview-link',
    urlField: 'socialPreviewUrl',
    description: 'Every launch social post mocked on its actual platform UI — Robert on LinkedIn, Devon on X, Maya on Instagram. See exactly how each post will read in-feed before scheduling. 20 posts across 3 platforms, 5 content pillars.',
    placeholderText: 'URL not yet registered. Build social-preview/ → deploy to Vercel → register the URL via npm run publish-portal.',
    quickLinks: [
      { label: 'LinkedIn', path: '/#linkedin' },
      { label: 'X / Twitter', path: '/#twitter' },
      { label: 'Instagram', path: '/#instagram' },
    ],
    sections: [],
    gate: null,
  },
  // 6. Blog (Workstream D editorial review)
  // Replaces the legacy Blog Content Pack PDF. Operator review surface for
  // blog drafts before Sanity CMS publish. Public blog renders through the
  // marketing site at /blog (Sanity source).
  {
    slug: 'blog', name: 'Blog Drafts', dir: 'marketing/blog-posts',
    category: 'deliverable',
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
  // 7. Video (Workstream C production brief)
  // Replaces the legacy Video Production Brief PDF. The video pipeline at
  // tools/video/generate.js consumes this hub's source markdown.
  {
    slug: 'video', name: 'Video', dir: 'video',
    category: 'deliverable',
    alwaysVisible: true,
    sections: [
      { slug: 'script', file: 'script.md', name: '60-second Promo Script' },
      { slug: 'audio-brief', file: 'audio-brief.md', name: 'Audio + Voiceover Brief' },
    ],
    gate: null,
  },
  // 8. Figma (visual design source-of-truth)
  // Two surfaces in one hub:
  //   (a) URL-based: PORTAL_CLIENTS[slug].figmaUrl drives the embedded
  //       Figma preview iframe + "Open in Figma" CTA.
  //   (b) Optional file binary: any single file at design/figma-source.*
  //       (e.g. .fig, .zip with .fig + exports) renders as a download
  //       button. Operators upload via git commit; the portal picks it
  //       up automatically on the next render.
  //
  // Figma embed requires the file's Share setting to be "Anyone with the
  // link can view" or higher. Private files render the Figma auth prompt
  // inside the iframe instead of the preview — the placeholder messaging
  // calls this out.
  {
    slug: 'figma', name: 'Figma',
    category: 'deliverable',
    alwaysVisible: true,
    surfaceType: 'figma-deliverable',
    urlField: 'figmaUrl',
    figmaFileDir: 'design',
    figmaFileBaseName: 'figma-source',
    description: 'The Figma source for the entire visual design system — colours, typography, components, screens. Preview live in-portal, open in Figma to inspect specs, or download the source file.',
    placeholderText: 'Figma file not yet registered. Set PORTAL_CLIENTS.<slug>.figmaUrl to the file URL (Share settings: "Anyone with the link can view"), then redeploy.',
    sections: [],
    gate: null,
  },
  // 9. Investor Pitch Deck (binary deliverable surface)
  // The Investor Pitch Deck is the only deck that ships as a file (rather
  // than a portal hub or a DS-site page) because investors expect a
  // shareable artifact they can download, annotate, send to partners.
  //
  // Build pipeline (engagement repo):
  //   .pptx generated from a Google Slides template via
  //   tools/pdf/investor-deck-from-template.py — text + colour + font swap
  //   with brand tokens. LibreOffice headless converts the .pptx to .pdf
  //   for in-portal preview. Both files commit to /decks/ in the
  //   engagement repo and are versioned (-v1.pptx, -v2.pptx, ...).
  //
  // Portal renders:
  //   - PDF preview (iframe of the latest version)
  //   - Download .pptx button (editable copy for the client)
  //   - Upload-new-version widget — operator or client can drop an edited
  //     .pptx; the binary commits as -v(N+1).pptx without overwriting.
  //   - Version history table — every prior version with timestamp +
  //     download link
  //
  // surfaceType: 'deck-deliverable' tells portal-list.js to populate a
  // .versions[] array by scanning decks/ in the engagement repo.
  {
    slug: 'investor-deck', name: 'Investor Pitch Deck',
    category: 'deliverable',
    alwaysVisible: true,
    surfaceType: 'deck-deliverable',
    deckDir: 'decks',
    deckBaseName: 'investor-deck',
    description: 'The investor pitch deck — generated from your locked vision + financial plan, restyled with the brand palette. Preview in-browser, download the editable .pptx, upload a new version after edits.',
    placeholderText: 'No deck generated yet. Run npm run pdf:investor in the engagement repo, then push — the latest version appears here.',
    sections: [],
    gate: null,
  },
];

// Investor scope: financials only (sensitive scope-loop hidden from investors)
// ── Phase 4 — Claude learning loop ────────────────────────────────────────
// Turns the portal-feedback.json audit log into a Claude-readable memory
// digest at `.claude/memory/feedback_pending.md` in the engagement repo.
// Committed automatically by portal-feedback.js after each new submission
// so the next time the operator opens Claude, the file is already in place
// and Claude opens with: "You have N open items from the portal — want me
// to walk them?"
//
// Format prioritises GROUPING and ACTIONABILITY over exhaustive metadata —
// Claude needs to know what to do, not every detail. Detail lives in the
// JSON; this is the "what's open + why + how to act on it" surface.
function generateFeedbackPendingMarkdown(feedbackLog, clientName) {
  const items = (feedbackLog && feedbackLog.feedback) || [];
  const open = items.filter((f) => f.status === 'open');
  const addressed = items.filter((f) => f.status === 'addressed' || f.status === 'wont-fix');
  const lastUpdated = feedbackLog && feedbackLog.lastUpdated ? feedbackLog.lastUpdated : null;

  const lines = [];
  lines.push('---');
  lines.push('name: feedback-pending');
  lines.push(`description: Open feedback items from the ${clientName || 'project'} client portal — auto-generated by the portal API after every submission. Read at session start; ask the user "want me to address these?" before any other work.`);
  lines.push('metadata:');
  lines.push('  type: feedback');
  lines.push(`  auto_generated: true`);
  if (lastUpdated) lines.push(`  last_updated: ${lastUpdated}`);
  lines.push('---');
  lines.push('');
  lines.push('# Portal Feedback — Pending');
  lines.push('');
  lines.push(`**Open items:** ${open.length}  ·  **Resolved (total):** ${addressed.length}`);
  if (lastUpdated) {
    lines.push(`**Last activity:** ${new Date(lastUpdated).toISOString().replace('T', ' ').replace('Z', ' UTC')}`);
  }
  lines.push('');

  if (open.length === 0) {
    lines.push('No open feedback right now. The client has not surfaced anything that needs attention.');
    lines.push('');
    if (addressed.length > 0) {
      lines.push(`(${addressed.length} item${addressed.length === 1 ? '' : 's'} previously addressed — see \`portal-feedback.json\` for the full audit trail.)`);
    }
    return lines.join('\n');
  }

  lines.push('## How to act on this file');
  lines.push('');
  lines.push('When the user says **"address open feedback"**, walk every item below in order:');
  lines.push('1. Read the comment + open the source file mentioned (if hub-section feedback) or the deliverable (if hub-level).');
  lines.push('2. Make the change. Keep the scope tight — fix exactly what was flagged, no extras.');
  lines.push('3. Mark the item addressed: edit `portal-feedback.json` → find the entry by `id` → set `status: "addressed"`, `addressedAt: "<ISO>"`, `addressedNote: "one-line summary of what changed"`.');
  lines.push('4. After all items addressed (or partway through if you hit a blocker), run `npm run feedback:sync` to regenerate this file so it reflects the new state.');
  lines.push('5. Commit + push so the next session and the portal see the resolution.');
  lines.push('');
  lines.push('If 2+ open items share a theme (e.g., "client doesn\'t like card-heavy designs"), write a proposal to `.claude/proposed-claude-md-updates/YYYY-MM-DD-<slug>.md` flagging it as a candidate systemic rule for CLAUDE.md.');
  lines.push('');

  // Group open items by hub for readability.
  const byHub = {};
  open.forEach((f) => {
    const key = f.hubName || f.hub || '(unknown)';
    if (!byHub[key]) byHub[key] = [];
    byHub[key].push(f);
  });

  for (const hubName of Object.keys(byHub).sort()) {
    lines.push(`## ${hubName}  ·  ${byHub[hubName].length} open`);
    lines.push('');
    byHub[hubName].forEach((f) => {
      const ratingEmoji = {
        'looks-good': '👍',
        'has-feedback': '⚠️',
        'needs-rework': '🚫',
        'question': '💭',
      }[f.rating] || '•';
      const target = f.sectionName ? `${f.sectionName}` : 'Hub-level';
      const when = f.submittedAt ? new Date(f.submittedAt).toISOString().slice(0, 10) : '';
      const who = f.submittedBy
        ? `${f.submittedBy}${f.submittedEmail ? ` <${f.submittedEmail}>` : ''}`
        : '(anonymous)';
      lines.push(`### ${ratingEmoji} ${target} — ${f.ratingLabel || f.rating}`);
      lines.push('');
      lines.push(`- **Submitted:** ${when} by ${who} (${f.scope || 'client'})`);
      lines.push(`- **Feedback ID:** \`${f.id}\``);
      if (f.screenshotDataUrl) {
        lines.push(`- **Screenshot attached** — see \`portal-feedback.json\` entry for the inline base64 image.`);
      }
      lines.push('');
      lines.push('**Comment:**');
      lines.push('');
      const comment = f.comment ? f.comment.trim() : '(no comment text — visitor rated but didn\'t leave a note)';
      // Indent comment as a blockquote so it visually separates from the metadata.
      comment.split('\n').forEach((line) => lines.push(`> ${line || ''}`.trimEnd()));
      lines.push('');
    });
  }

  if (addressed.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(`**Previously addressed:** ${addressed.length} item${addressed.length === 1 ? '' : 's'}. Full audit trail in \`portal-feedback.json\`.`);
    lines.push('');
  }

  return lines.join('\n');
}

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
  ghReadBinaryFile,
  ghCommitFile,
  ghListDir,
  listDeckVersions,
  listSinglePdf,
  listFigmaFile,
  parseBriefSnapshot,
  parseFrontmatter,
  readProvocations,
  readHubL3Status,
  buildEmailPayload,
  HUBS,
  hubsForScope,
  generateFeedbackPendingMarkdown,
  OPERATOR_EMAIL,
  TOKEN_TTL_SECONDS,
};
