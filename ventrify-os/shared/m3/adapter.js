// ============================================================
// Ventrify OS — M3 assessment ADAPTER (READ-ONLY)
//
// Maps the LIVE Firestore assessment data (the runner's `_verdict.json` on
// engagement.assessment + the investability snapshot + cards + hubDocs) into the
// shape the M3 editorial design-system components (`ds.js`) expect (ASSESSMENT + SCORE).
//
// This is PURELY a rendering adapter — it never writes and never touches the data
// pipeline (dispatch-run / the runner / firebase writes). Where the editorial UI wants
// a field the runner doesn't emit (an editorial verdict headline, per-tab hero copy,
// a structured valuation, diligence severity), we DERIVE it from what IS written, and
// degrade gracefully when a field is absent (forming / partial engagements).
//
// A later, ADDITIVE runner "editorial pass" could emit the derived fields verbatim;
// until then the derivations below carry them. Nothing here is a hard dependency.
// ============================================================

import { VSS_RUBRIC } from '../vss-rubric.js';   // the 7 category labels — one source, never a local copy
import { SUB_Q } from '../investability-view.js';

const esc = s => String(s == null ? '' : s);
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean);
const initials = s => words(s).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '—';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const firstSentence = s => { const t = String(s || '').trim(); const m = t.match(/^(.*?[.!?])(\s|$)/); return m ? m[1] : t; };
const parseMoney = s => { const m = String(s || '').match(/([\d.]+)\s*([bmk])?/i); if (!m) return 0; let n = parseFloat(m[1]); const u = (m[2] || '').toLowerCase(); if (u === 'b') n *= 1e3; else if (u === 'k') n /= 1e3; return n; };  // → millions

// strip inline markdown so a finding reads as clean prose (no **bold**, `code`, [text](url) leaking into the UI)
const stripMd = s => String(s || '')
  .replace(/`([^`]*)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();
// researchSummary — a bounded one-line finding from a raw markdown doc. firstSentence() DUMPS THE WHOLE
// BODY when the first post-heading line has no .!? (metadata / table / list — true of nearly every real
// runner doc), so research rows MUST use this: skip the non-prose scaffolding (front-matter, headings,
// blockquotes, tables, metadata labels), strip inline markdown, take the first sentence, hard-cap length.
const META_KEYS = /^(project|date|to|from|analyst|author|prepared by|prepared|subject|re|status|version|classification|client|company|venture|owner|title)$/;
const researchSummary = (raw, cap = 160) => {
  const lines = String(raw || '').replace(/\r/g, '').split('\n');
  let inYaml = false;
  for (let ln of lines) {
    let t = ln.trim();
    if (!t) continue;
    if (t === '---') { inYaml = !inYaml; continue; }        // YAML front-matter fence
    if (inYaml) continue;
    if (/^#{1,6}\s/.test(t)) continue;                      // heading
    if (/^>/.test(t)) continue;                             // blockquote
    if (/^\|/.test(t)) continue;                            // table row
    if (/^[-=_:|\s]{3,}$/.test(t)) continue;                // hr / table separator
    t = t.replace(/^([-*+]|\d+[.)])\s+/, '');               // unwrap a leading list bullet
    const meta = t.match(/^(?:\*\*|__)?\s*([A-Za-z][A-Za-z /]{1,24}):(?:\*\*|__)?\s+(.+)$/);
    if (meta) { if (META_KEYS.test(meta[1].toLowerCase().trim())) continue; t = meta[2]; }  // drop meta label, keep content-label value
    const clean = stripMd(t);
    if (clean.length < 12) continue;                        // too short to be a finding
    const m = clean.match(/^(.*?[.!?])(\s|$)/);
    const s = m ? m[1] : clean;
    return s.length > cap ? s.slice(0, cap - 1).trimEnd() + '…' : s;
  }
  return '';
};
// per-workstream marker — derive tone(p|s|w) + icon from the doc so the index reads as differentiated
// workstreams, not N identical purple 'article' rows. Feeds the DS RTONE/RCOL tonal system (ds.js).
const researchMarker = (d) => {
  const n = `${d.name || ''} ${d.hub || ''} ${d.title || ''}`.toLowerCase();
  if (/market|tam|sizing|demand/.test(n)) return { tone: 's', icon: 'query_stats' };
  if (/compet|benchmark|landscape|rival/.test(n)) return { tone: 'w', icon: 'swords' };
  if (/team|founder|people/.test(n)) return { tone: 'p', icon: 'groups' };
  if (/financ|unit[- ]?econ|revenue|model/.test(n)) return { tone: 's', icon: 'payments' };
  if (/risk|red[- ]?flag/.test(n)) return { tone: 'w', icon: 'warning' };
  if (/product|tech|moat|defensib/.test(n)) return { tone: 'p', icon: 'category' };
  return { tone: 'p', icon: 'article' };
};
const capLevel = lv => { const m = String(lv || '').match(/L[123]/i); return m ? m[0].toUpperCase() : 'L3'; };
// a deal-memo / verdict doc is an OUTPUT, not a research workstream — keep it out of the index (it lives in the data room)
const isMemoDoc = d => /deal[- ]?memo|verdict|recommendation/i.test(`${d.name || ''} ${d.title || ''}`);

// diligence priority (free text) → severity. The CANONICAL DIL_NORM table (copied verbatim from the classic
// program.html dilTier) — the old regex escalated 'high'→Blocker and demoted 'medium'→Key, wrongly showing
// "blockers / Do not wire" on assessments that have none. blocker/key/standard → err/warn/info.
const DIL_NORM = {
  critical: 'blocker', blocker: 'blocker', blocking: 'blocker', dealbreaker: 'blocker', must: 'blocker', musthave: 'blocker', p0: 'blocker', urgent: 'blocker', showstopper: 'blocker', gate: 'blocker',
  high: 'key', hi: 'key', important: 'key', major: 'key', p1: 'key', key: 'key', significant: 'key',
  medium: 'standard', med: 'standard', moderate: 'standard', normal: 'standard', p2: 'standard', low: 'standard', lo: 'standard', minor: 'standard', optional: 'standard', p3: 'standard', standard: 'standard', routine: 'standard',
};
const TIER_KIND = { blocker: 'err', key: 'warn', standard: 'info' };
function dilKind(priority = '') {
  const s = String(priority == null ? '' : priority).toLowerCase();
  const tier = DIL_NORM[s.replace(/[^a-z0-9]+/g, '')] || DIL_NORM[(s.split(/[^a-z0-9]+/).filter(Boolean)[0]) || ''] || 'standard';
  return TIER_KIND[tier];
}
const DIL_TAG = { err: 'Blocker', warn: 'Key', info: 'Standard' };

// confidence chip — reproduces the live assessmentConfidence() thresholds (rated fraction + data-room bonus)
function deriveConfidence(p, snap, a) {
  const rated = (snap && snap.ratedCount) || 0;
  const frac = rated / 35;
  const docs = p.founderDocCount || 0;
  const sources = (a.provenance && a.provenance.sources) || 0;
  let pts = 0;
  if (frac >= 0.8) pts += 2; else if (frac >= 0.55) pts += 1;
  if (docs >= 5 || p.pitchDoc) pts += 1;
  const level = pts >= 3 ? 'High' : pts >= 2 ? 'Medium' : 'Low';
  const line = [p.founderDocCount ? 'Full data room' : 'Deck-only', docs && `${docs} documents`, sources && `${sources} sources cited`, `${rated} of 35 signals rated`].filter(Boolean).join(' · ');
  return { level, documents: docs, sources, line };
}

// teamHeadline — a SHORT, authored team hero line built from structured facts, so it always fits the
// 12-word headline budget and can never contradict the signal bar rendered beside it.
function teamHeadline(t = {}) {
  const members = t.members || [];
  const n = members.length;
  const verified = members.filter(m => m.signal === 'positive').length;
  const flagged = members.filter(m => m.signal === 'flag').length;
  const gap = (t.gaps && t.gaps[0]) ? String(t.gaps[0]).replace(/[*_`]/g, '').trim() : '';
  // a copywritten line from the runner wins — it has read the diligence and can be sharper than a template
  if (t.headline) return { headline: t.headline, headlineEm: t.headlineEm || '', headlineFallback: 'The team.' };
  if (!n) return { headline: 'The team.', headlineEm: '', headlineFallback: 'The team.' };
  if (flagged) return { headline: `${verified} of ${n} verified — ${flagged} still unproven.`, headlineEm: `${flagged} still unproven`, headlineFallback: 'The team.' };
  if (verified === n) return { headline: `All ${n} verified — the team checks out.`, headlineEm: 'the team checks out', headlineFallback: 'The team.' };
  return { headline: `${verified} of ${n} verified — the rest to confirm.`, headlineEm: 'the rest to confirm', headlineFallback: 'The team.' };
}

// ── SCORE (investability snapshot → M3 SCORE) ──
const CAT_WEIGHTS = { market: 20, team: 25, product: 15, moat: 15, financial: 10, execution: 10, evidence: 5 };
function shortOf(key, label) {
  return ({ market: 'market', team: 'the team', product: 'product', moat: 'the moat', financial: 'financials', execution: 'execution', evidence: 'evidence' })[key] || String(label || key).toLowerCase();
}
function mapScore(snap) {
  if (!snap) return { composite: 0, potential: 0, band: 'Forming', categories: [] };
  const BAND = { approved: 'Strong', feedback: 'Promising', rework: 'Weak', pass: 'Uninvestable', forming: 'Forming', unrated: 'Forming' };
  const src = snap.categories || [];
  // composite: the snapshot is authoritative; normalise a legacy /27 or /35 to /100
  const composite = snap.pct != null ? snap.pct : Math.round(((snap.composite || 0) / (snap.maxPossible || 100)) * 100);
  const ratedCount = snap.ratedCount != null ? snap.ratedCount : src.reduce((n, c) => n + (c.subs ? c.subs.filter(s => s.score != null).length : 0), 0);
  // only a genuine v3 weighted 0–100 snapshot supports the potential overlay (mirrors the classic gate) —
  // a legacy /27 or /35 snapshot stays flat (potential = composite) rather than showing a bogus dashed line.
  const isV3Scale = Number(snap.maxPossible) === 100 && Number(snap.composite) > 0 && Number(snap.composite) <= 100 && ratedCount > 0;
  const wOf = c => (c.weight != null ? c.weight : (CAT_WEIGHTS[c.key] || 0));

  // ── POTENTIAL = close ONLY the top-5 priority gaps (ranked by lift × weight); unassessable subs never count.
  //    Ported verbatim from the classic investability-view.js so the radar overlay + uplift match what
  //    operators used to see. The runner does NOT emit headroom — it is DERIVED here (this was dropped before).
  const defs = [];
  src.forEach(c => (c.subs || []).forEach(s => { if (s.score === 0 || s.score === 0.5) defs.push({ slug: s.slug, score: s.score, lift: 1 - s.score, weight: wOf(c) }); }));
  defs.sort((a, b) => b.lift - a.lift || b.weight - a.weight || a.score - b.score);
  const flaggedSlugs = new Set(defs.slice(0, 5).map(d => d.slug));
  const potMap = {}; let pnum = 0, pden = 0;
  src.forEach(c => {
    let psum = 0, prated = 0;
    for (const s of (c.subs || [])) { if (s.score == null) continue; prated++; psum += flaggedSlugs.has(s.slug) ? 1 : s.score; }
    if (prated > 0) { const pf = psum / prated; potMap[c.key] = pf; const w = wOf(c); pnum += pf * w; pden += w; }
  });
  const potential = (isV3Scale && pden > 0) ? Math.round(100 * pnum / pden) : composite;

  const cats = src.map(c => {
    const rated = c.rated != null ? c.rated : (c.subs ? c.subs.filter(s => s.score != null).length : 0);
    const frac = rated ? (c.sum || 0) / rated : 0;                 // the live compute's per-category fraction (0–1)
    const weightPct = c.weight != null ? Math.round(c.weight * 100) : (CAT_WEIGHTS[c.key] || 10);
    return {
      key: c.key, label: c.label, short: shortOf(c.key, c.label), weightPct,
      rated: String(rated), frac,
      pot: (isV3Scale && potMap[c.key] != null) ? potMap[c.key] : frac,   // derived headroom (dashed radar overlay)
      num: (frac * 5).toFixed(1), low: frac < 0.4,
      subs: c.subs || []                                            // {slug, score, note} — M3 categoryDetail + SUB_Q consume directly
    };
  });
  return { composite, potential, band: BAND[snap.band] || 'Promising', categories: cats };
}

// ── per-tab hero copy (derived — the runner doesn't emit editorial hero copy) ──
function deriveHeroes(a, S) {
  const cats = [...(S.categories || [])].sort((x, y) => y.frac - x.frac);
  const strong = cats[0], weak = cats[cats.length - 1];
  const m = a.market || {}, t = a.team || {}, cf = a.confidence || {};
  return {
    investability: {
      eyebrow: 'The score, decomposed', eyebrowIcon: 'insights',
      headline: strong && weak ? `Carried by ${strong.short}, held by ${weak.short}.` : 'The score, decomposed.',
      headlineEm: weak ? weak.short : '',
      facts: [strong && { k: 'Carries it', v: `${cap(strong.short)} <small>${strong.num} / 5</small>` }, weak && { k: 'Holds it', v: `${cap(weak.short)} <small>${weak.num} / 5</small>` }].filter(Boolean),
      thesis: `${S.composite} out of 100 — carried by ${strong ? strong.short : 'its strengths'}, held down by ${weak ? weak.short : 'its gaps'}.`
    },
    market: {
      eyebrow: 'The market', eyebrowIcon: 'query_stats',
      headline: m.tam ? `A ${m.tam.value} market — the question is the entry.` : 'The market.', headlineEm: m.tam ? m.tam.value : '',
      facts: [m.tam && { k: 'TAM', v: `${m.tam.value} <small>${esc(m.tam.label)}</small>` }, m.som && { k: 'Obtainable', v: `${m.som.value} <small>${esc(m.som.label)}</small>` }].filter(Boolean),
      thesis: m.note || ''
    },
    team: {
      eyebrow: 'The team', eyebrowIcon: 'groups',
      // ⚠ this used to be `firstSentence(t.summary)` — the model's team-diligence write-up piped raw into a
      // 44px, 4-line-clamped slot, where it truncated mid-word. Every OTHER hero uses a short AUTHORED line
      // built from structured facts ("A $2B market — the question is the entry"). Team now does too, so it
      // fits by construction rather than by luck. The runner's copywritten hero line (heroes.team.headline,
      // written to a 12-word budget) is preferred when present; this is the deterministic floor.
      ...teamHeadline(t),
      facts: [{ k: 'Named', v: `${(t.members || []).length} <small>on the cap table</small>` }, (t.gaps && t.gaps[0]) && { k: 'Critical gap', v: esc(t.gaps[0]) }].filter(Boolean),
      thesis: t.summary || ''
    },
    research: {
      eyebrow: 'The evidence', eyebrowIcon: 'manage_search',
      headline: 'Nothing taken on trust — every claim rebuilt from source.', headlineEm: 'rebuilt from source',
      facts: [{ k: 'Sources', v: `${cf.sources || 0} <small>cited</small>` }, { k: 'Depth', v: 'L3 <small>· primary-source</small>' }],
      thesis: cf.line ? `The verdict rests on ${cf.line}.` : ''
    }
  };
}

// ── EVIDENCE GAPS + THE OPERATOR'S FILED RECORDS ────────────────────────────────────────────────────
//
// SOURCE OF TRUTH — engagement.assessmentGaps, written by the runner (tools/cloud/publish.js publishGaps).
// Shape, verbatim from the contract:
//   { schema, count, snapshotId, unresolved: [{ id, subject, checkKind, outcome, sought,
//       source:{doc,row}, searched:[{source,url,result}],
//       impact:{ signals:[DOTTED rubric slug], cappedAt, observedScore }, closesWith:[kind]|null, status }] }
//
// ⚠ There is NO delta field, and we do not synthesise one. publish.js refuses to publish a projected gain
// precisely so the UI cannot render "close this gap: +3" — which would let the operator file only the
// artefacts he predicts move the number UP, rebuilding the dial in the presentation layer. We carry the
// CEILING (cappedAt) and what the scorer ACTUALLY gave (observedScore). Nothing else about points.
//
// ⚠ NAMING: `team.gaps` already exists and means HIRING gaps ("no US growth lead") — an entirely different
// concept. These are RESEARCH gaps and they live on A.gaps. Nothing conflates them.
const CAT_LABEL = Object.fromEntries(VSS_RUBRIC.map(c => [c.key, c.label]));
// A gap id is interpolated into an onclick attribute (window.openGap('<id>')). Sanitising it HERE means the
// DS can never be handed a quote to break out of — a mechanism, not a hope. The runner already caps it at 40.
const safeId = s => String(s == null ? '' : s).replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 60);
const bare = slug => String(slug || '').split('.').pop();
const catOf = slug => String(slug || '').split('.')[0];

export function adaptGaps(p, S) {
  const raw = ((p.assessmentGaps || {}).unresolved) || [];
  if (!Array.isArray(raw) || !raw.length) return { gaps: [], gapById: {}, gapBySlug: {} };
  // what the scorer actually gave each signal — the fallback when publish.js could not stamp observedScore
  // (a gap recorded on a run whose snapshot we don't have to hand).
  const observed = {};
  (S.categories || []).forEach(c => (c.subs || []).forEach(s => { observed[`${c.key}.${s.slug}`] = s.score; }));
  const filings = p.operatorEvidence || [];

  const gaps = raw
    .filter(g => g && g.id && g.subject)
    .map(g => {
      const imp = g.impact || {};
      const signals = (imp.signals || []).filter(Boolean);
      const primary = signals[0] || '';
      const obs = imp.observedScore != null ? imp.observedScore
        : (primary && observed[primary] !== undefined ? observed[primary] : null);
      const id = safeId(g.id);
      // the operator's record for THIS gap — the most recent one wins (records are append-only, never edited)
      const mine = filings.filter(f => safeId(f.gapId) === id)
        .sort((a, b) => String(a.filedAt || '').localeCompare(String(b.filedAt || '')));
      return {
        id, subject: g.subject, checkKind: g.checkKind || '', outcome: g.outcome || 'NOT-FOUND',
        sought: g.sought || '', source: g.source || {},
        searched: (g.searched || []).filter(s => s && s.source),
        signals, cappedAt: imp.cappedAt != null ? imp.cappedAt : null, observedScore: obs,
        closesWith: g.closesWith || [],
        categoryLabel: CAT_LABEL[catOf(primary)] || '',
        signalQuestion: primary ? (SUB_Q[bare(primary)] || primary) : '',
        status: g.status || 'open',
        filing: mine.length ? mine[mine.length - 1] : null,
      };
    });

  const gapById = {};
  const gapBySlug = {};
  gaps.forEach(g => {
    gapById[g.id] = g;
    // A signal can be docked by more than one gap. First-wins keeps the chip deterministic; the Diligence
    // list is the complete record, and it is the one that claims completeness.
    g.signals.forEach(s => { if (!gapBySlug[s]) gapBySlug[s] = g; });
  });
  return { gaps, gapById, gapBySlug };
}

// A gap about a PERSON becomes the trigger on that person's roster row — the operator meets it while reading
// the team, which is where he already knows the answer. Matched on the member's name appearing in the gap's
// subject (the runner writes "Dr. R. Vale — CTO" / "Jane Doe"), and only for person-shaped checks: a registry
// gap about the COMPANY must not attach itself to whoever is listed first.
const PERSON_KINDS = new Set(['own-materials', 'press-corroboration', 'employment-record', 'gazette', 'registry']);
export function linkGapsToMembers(members, gaps) {
  const person = gaps.filter(g => PERSON_KINDS.has(g.checkKind) || /^team\./.test(g.signals[0] || ''));
  return members.map(m => {
    const nm = String(m.name || '').split('—')[0].trim().toLowerCase();
    const toks = nm.split(/\s+/).filter(t => t.length > 2);
    if (!toks.length) return m;
    const hit = person.find(g => {
      const sub = String(g.subject || '').toLowerCase();
      return toks.every(t => sub.includes(t));       // every name token present → it is about this person
    });
    return hit ? { ...m, gapId: hit.id } : m;
  });
}

// ── ASSESSMENT (engagement + _verdict.json → M3 ASSESSMENT) ──
export function adaptEngagement(p = {}) {
  const a = p.assessment || {};
  const S = mapScore(p.investabilitySnapshot);

  // the ask → amount + rest ("$3M on $12M pre (Seed)")
  const theAsk = a.theAsk || a.the_ask || '';
  const askM = theAsk.match(/^(\S+)\s+(.*)$/);
  const askAmount = askM ? askM[1] : theAsk;
  const askRest = askM ? askM[2] : '';
  const preMatch = theAsk.match(/on\s*\$?([\d.]+)\s*([bmk])?\s*pre/i);
  const asked = preMatch ? parseMoney(preMatch[1] + (preMatch[2] || '')) : 0;

  const biggestRiskStr = a.biggestRisk || a.biggest_risk || '';
  const conf = deriveConfidence(p, p.investabilitySnapshot, a);

  // valuation: keep the free-text verdict/note/comps; derive a structured band where the note reveals it
  const val = a.valuation || {};
  const bandMatch = String(val.note || '').match(/\$?([\d.]+)\s*[–-]\s*\$?([\d.]+)\s*([bmk])?\s*(?:pre|m)/i);
  // tone from the verdict prose so a positive/fair read does NOT render as a red "over-priced" alert
  const valStr = String(val.verdict || val.note || '').toLowerCase();
  const valTone = /over[- ]?priced|too rich|expensive|steep|aggressive|overvalued|inflated|frothy/.test(valStr) ? 'bad'
    : /cheap|fair|reasonable|attractive|underpriced|in ?line|leaning cheap|good (?:value|price)/.test(valStr) ? 'good' : 'mid';
  const valuation = {
    verdict: val.verdict || '', note: val.note || '', tone: valTone,
    multiple: val.multiple != null ? val.multiple : null, multipleSuffix: val.multipleSuffix,   // runner emits no multiple → suppress the fabricated "1.0 × median"
    comps: (val.comps || []).map(c => ({ name: c.name, stage: c.stage, detail: c.detail || c.valuation || '' })),
    // omit the reprice band (null, not 0) when no "$A–$B pre" range is parseable → ds.js hides "$0–0M"
    asked, defensibleLo: bandMatch ? parseMoney(bandMatch[1] + (bandMatch[3] || '')) : null, defensibleHi: bandMatch ? parseMoney(bandMatch[2] + (bandMatch[3] || '')) : null,
    scaleMax: asked ? asked * 1.15 : 0,
    bodyDrop: 'The read.', bodyLead: val.note || ''
  };

  // market: derive the funnel bar fractions from the $ values (clamped for visibility). Live markets can be
  // tam-only or carry number-free tier strings, so only attach tiers that have a value (marketSizing filters
  // nulls), and never force a full-width bar off an unparseable tam.
  const mkt = a.market || {};
  const tamN = parseMoney(mkt.tam && mkt.tam.value);
  const mv = v => { const n = parseMoney(v); return tamN && n ? Math.max(0.06, Math.min(1, n / tamN)) : (n && !tamN ? 1 : 0); };
  const tier = (t, full) => (t && t.value != null && t.value !== '') ? { value: t.value, v: full ? 1 : mv(t.value), label: t.label } : null;
  const market = (mkt.tam && mkt.tam.value != null && mkt.tam.value !== '') ? {
    tam: tier(mkt.tam, true), sam: tier(mkt.sam), som: tier(mkt.som),
    note: mkt.note || '', sizingDrop: 'Sized', sizingLead: mkt.note || ''
  } : null;

  // benchmark: dimensions[] + competitors[{cells{}}] → cols[] + rows[{me,cells[]}] (cells keyed VERBATIM to dimensions)
  const bm = a.benchmark || {};
  const dims = bm.dimensions || [];
  const benchmark = bm.competitors ? {
    note: bm.note || '', leadDrop: (bm.competitors.find(c => c.isTarget) || {}).name, lead: bm.note || '',
    cols: ['Company', ...dims],
    rows: bm.competitors.map(c => ({ me: !!c.isTarget, cells: [c.name, ...dims.map(d => (c.cells || {})[d] || '—')] }))
  } : null;

  // rounds
  const rounds = (a.rounds || []).map(r => ({ i: initials(r.company), name: `${r.company} · ${r.stage}`, meta: r.investors || '', amount: r.amount || '', val: r.valuation || '' }));

  // team
  const tm = a.team || {};
  const team = {
    summary: tm.summary || '',
    members: (tm.members || []).map(m => ({ i: initials(m.name), name: `${m.name} — ${m.role}`, bg: m.background || '', signal: m.signal === 'positive' ? 'positive' : m.signal === 'flag' ? 'flag' : 'neutral' })),
    gaps: tm.gaps || [],
    gapKill: (tm.gaps && tm.gaps[0]) ? { tag: 'The critical gap', label: '', headline: firstSentence(tm.gaps[0]), text: tm.gaps[0] } : null
  };

  // diligence: single `item` string + free-text priority → severity + title/note
  const diligence = (a.diligence || []).map(d => {
    const kind = dilKind(d.priority);
    const split = String(d.item || '').match(/^(.*?)(?:\s+[—–-]\s+|\s*:\s+)(.*)$/);   // em/en/hyphen (space-delimited) or colon — mirrors the classic dilParse separators
    return { kind, tag: DIL_TAG[kind], title: split ? split[1].trim() : d.item, note: split ? split[2].trim() : '', done: false };
  });

  // research index from hubDocs — clean bounded finding + differentiated marker per workstream; the
  // deal-memo (an output) is excluded so the count + semantics stay honest (it lives in the data room).
  const research = (p.hubDocs || [])
    .filter(d => (d.hub === 'research' || d.hub === 'assessment') && !isMemoDoc(d))
    .sort((x, y) => (x.order || 0) - (y.order || 0))
    .map(d => {
      const mk = researchMarker(d);
      const full = String(d.body || d.markdown || '');
      return { icon: mk.icon, tone: mk.tone, title: d.title || d.name, note: researchSummary(full), tag: capLevel(d.level), tagKind: /L3/i.test(d.level || 'L3') ? 'info' : 'warn', body: full, level: capLevel(d.level), name: d.name };
    });
  // ---- reading set: EVERY document that has a body. Nothing filtered, nothing hidden. ----
  // `research` above is the count-bearing evidence index: it excludes the deal memo (an output, not a
  // workstream) so the hero's "N workstreams" stays honest. But the READER must be able to open every
  // document the run produced — the classic hub-view.js never dropped one. Three ways a doc was being
  // silently lost, all fixed here:
  //   1. isMemoDoc is /deal[- ]?memo|verdict|recommendation/i over name+title — it hides ANY workstream an
  //      agent happens to title "Market verdict" or "Recommendation on unit economics". `reading` never applies it.
  //   2. the hub test was exact + case-sensitive, so a runner emitting 'Research' or ' research' vanished,
  //      as did every non-research hub (vision/strategy/financials/marketing) that a build engagement carries.
  //   3. the `hub` field itself was never carried through, so downstream grouping had nothing to group on.
  const normHub = h => String(h || '').trim().toLowerCase();
  const reading = (p.hubDocs || [])
    .filter(d => String(d.body || d.markdown || '').trim())      // a body is the only requirement
    .sort((x, y) => (x.order || 0) - (y.order || 0))
    .map(d => ({
      hub: normHub(d.hub), name: d.name, title: d.title || d.name,
      level: capLevel(d.level), tag: capLevel(d.level),
      tagKind: /L3/i.test(d.level || 'L3') ? 'info' : 'warn',
      order: d.order || 0,
      body: String(d.body || d.markdown || ''),                  // FULL, untruncated
    }));

  const dataRoom = [
    p.pitchDoc && { icon: 'slideshow', title: p.pitchDoc.name, note: 'Founder upload · pitch deck', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'description', title: 'Deal memo', note: 'Full write-up · exported PDF', tag: 'L1', action: 'tag', kind: 'generated' },
    { icon: 'folder_zip', title: 'Data room export', note: `All sources + research · .zip`, action: 'download', kind: 'dataroom' }
  ].filter(Boolean);

  // lifecycle playback (from runState + signoff)
  const rs = p.runState || {};
  const done = s => ({ state: 'done', label: s });

  // ---- the evidence the agents are reading (drives inputManifest on the assessing screen) ----
  // Names only exist when the docs came through the Studio brief; a workspace upload records a COUNT but no
  // names. We say so out loud in the manifest rather than quietly under-reporting the evidence.
  const briefDocs = ((p.brief && p.brief.founderDocs) || []).map(d => ({
    name: d.name, chars: d.chars, needsDeepRead: !!d.needsDeepRead,
  }));
  const inputs = {
    deck: p.pitchDoc ? { name: p.pitchDoc.name, at: p.pitchDoc.at } : null,
    docs: briefDocs,
    total: p.founderDocCount || briefDocs.length || 0,
    // documents the operator HANDED OVER but that never made it in. Persisted on the engagement, because a
    // dropped document is a data-integrity fact — you must not be able to run an assessment believing the
    // agents read your cap table when it never arrived.
    skipped: p.ingestSkipped || [],
  };

  // dates make the arc a RECORD instead of a to-do list. `.lc-at` has existed in the CSS from the start and
  // had never once rendered, because nothing ever set `at`.
  // ⚠ these come in TWO shapes: an ISO string (runState.startedAt / pitchDoc.at, written by the runner) OR a
  // Firestore Timestamp (createdAt / updatedAt, written with serverTimestamp). `new Date(Timestamp)` is an
  // Invalid Date — so a naive parse would silently blank every date on real data. Mirrors the watchdog's toMs.
  const asDate = v => {
    if (v == null) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.toMillis === 'function') return new Date(v.toMillis());
    if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    if (typeof v === 'object' && typeof v._seconds === 'number') return new Date(v._seconds * 1000);
    const t = new Date(v);
    return isNaN(t) ? null : t;
  };
  const D = v => { const t = asDate(v); return t ? t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; };
  const T = v => { const t = asDate(v); return t ? t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''; };
  const runAt = rs.startedAt || rs.requestedAt;
  const nDocs = inputs.total;
  // ⚠ the old meta read "N files · 0 sources" for the ENTIRE run — provenance.sources only exists once the
  // verdict publishes, so it advertised ZERO sources while eleven workstreams were busy citing them. Only
  // mention sources once there actually ARE some.
  const srcCount = (a.provenance || {}).sources || 0;
  const docsMeta = [
    nDocs ? `${nDocs} document${nDocs === 1 ? '' : 's'}` : 'No documents yet',
    inputs.deck ? 'deck + data room' : '',
    srcCount ? `${srcCount} sources cited` : '',
  ].filter(Boolean).join(' · ');

  const lifecycle = [
    { label: 'Intake', at: D(p.createdAt || p.startDate), state: 'done', meta: `${p.name} · assessment` },
    { label: 'Documents received', at: D((p.pitchDoc && p.pitchDoc.at) || p.createdAt), state: nDocs ? 'done' : 'pending', meta: docsMeta },
    // queued/partial are just as "in flight" as running — otherwise the strip says pending while the banner says Assessing
    { label: 'Assessment run', at: runAt ? (a.recommendation ? D(runAt) : `started ${T(runAt)}`) : '',
      state: a.recommendation ? 'done' : (['queued', 'running', 'partial'].includes(rs.status) ? 'current' : 'pending'),
      meta: 'Assess · v3 rubric · eleven workstreams' },
    { label: 'Verdict ready', at: a.recommendation ? D(rs.finishedAt) : '', state: a.recommendation ? 'done' : 'pending',
      meta: a.recommendation ? `${a.recommendation} · ${S.composite} / 100` : 'A score /100, the case both ways, the diligence list' },
    { label: 'Operator sign-off', at: p.assessmentSignoff ? D(p.assessmentSignoff.at) : '',
      state: p.assessmentSignoff ? 'done' : (a.recommendation ? 'current' : 'pending'),
      meta: p.assessmentSignoff ? p.assessmentSignoff.by : 'You endorse it before it can be shared' },
    { label: 'Decision', at: p.assessmentDecision ? D(p.assessmentDecision.at) : '',
      state: p.assessmentDecision ? 'done' : 'pending',
      meta: p.assessmentDecision ? `${p.assessmentDecision.decision} · ${p.assessmentDecision.by || ''}` : 'Confirm or decline the deal' }
  ];

  // ---- the research gaps + the operator's filed records ----
  // Gaps are what the assessment LOOKED FOR AND COULD NOT FIND — our misses, for which the venture was
  // docked. `filings` is the append-only evidence ledger (engagements/{id}/operatorEvidence): what the
  // operator pointed us at, what the FETCHER observed, and what the SCORER then did about it.
  const { gaps, gapById, gapBySlug } = adaptGaps(p, S);
  const filings = p.operatorEvidence || [];
  team.members = linkGapsToMembers(team.members, gaps);

  const A = {
    inputs,          // the evidence the agents are reading — drives inputManifest on the assessing screen
    gaps, gapById, gapBySlug, filings,
    id: p.id, name: p.name, initials: p.founderAvatar || initials(p.name),
    stageLine: [p.stage, p.venturePitch, p.lastActivity && `Assessed ${p.lastActivity}`].filter(Boolean).join(' · '),
    status: a.recommendation ? { kind: 'ok', label: 'Verdict ready', icon: 'check_circle' } : { kind: 'n', label: p.gateStatus || 'In progress', icon: 'pending' },
    run: { agent: 'Assess · v3 rubric', at: p.lastActivity || '', duration: '' },
    lifecycle,
    recommendation: a.recommendation || '',
    verdictLine: a.recommendation || 'Assessment', verdictEm: words(a.recommendation).pop() || '',
    conviction: a.conviction || 'Medium',
    theAsk, askAmount, askRest,
    thesis: a.thesis || '',
    biggestRisk: biggestRiskStr ? { label: '', headline: '', text: biggestRiskStr } : null,   // ds.js prints just "Biggest kill-risk" + the risk once (no duplicate label / sentence)
    mustBeTrue: a.mustBeTrue || a.must_be_true || [],
    confidence: conf,
    signoff: p.assessmentSignoff ? { by: p.assessmentSignoff.by, at: p.assessmentSignoff.at, note: p.assessmentSignoff.note } : null,
    bull: a.bull || [], bear: a.bear || [],
    valuation, market, benchmark, rounds, team, diligence, research, reading, dataRoom,
    exit: a.exit ? { ...a.exit, acquirers: Array.isArray(a.exit.acquirers) ? a.exit.acquirers.join(', ') : a.exit.acquirers } : null,   // array → prose (ds.js renders a string)
    run_confidence: conf
  };
  A.heroes = deriveHeroes(A, S);
  return { A, S };
}
