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
      headline: firstSentence(t.summary) || 'The team.', headlineEm: '',
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
  const dataRoom = [
    p.pitchDoc && { icon: 'slideshow', title: p.pitchDoc.name, note: 'Founder upload · pitch deck', action: 'download', kind: 'upload', status: 'read' },
    { icon: 'description', title: 'Deal memo', note: 'Full write-up · exported PDF', tag: 'L1', action: 'tag', kind: 'generated' },
    { icon: 'folder_zip', title: 'Data room export', note: `All sources + research · .zip`, action: 'download', kind: 'dataroom' }
  ].filter(Boolean);

  // lifecycle playback (from runState + signoff)
  const rs = p.runState || {};
  const done = s => ({ state: 'done', label: s });
  const lifecycle = [
    { label: 'Intake', state: 'done', meta: `${p.name} · assessment` },
    { label: 'Documents received', state: 'done', meta: `${p.founderDocCount || 0} files · ${(a.provenance || {}).sources || 0} sources` },
    { label: 'Assessment run', state: a.recommendation ? 'done' : (rs.status === 'running' ? 'current' : 'pending'), meta: 'Assess · v3 rubric' },
    { label: 'Verdict ready', state: a.recommendation ? 'done' : 'pending', meta: a.recommendation ? `${a.recommendation} · ${S.composite} / 100` : '' },
    { label: 'Operator sign-off', state: p.assessmentSignoff ? 'done' : (a.recommendation ? 'current' : 'pending'), meta: p.assessmentSignoff ? p.assessmentSignoff.by : '' },
    { label: 'Decision', state: 'pending', meta: '' }
  ];

  const A = {
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
    valuation, market, benchmark, rounds, team, diligence, research, dataRoom,
    exit: a.exit ? { ...a.exit, acquirers: Array.isArray(a.exit.acquirers) ? a.exit.acquirers.join(', ') : a.exit.acquirers } : null,   // array → prose (ds.js renders a string)
    run_confidence: conf
  };
  A.heroes = deriveHeroes(A, S);
  return { A, S };
}
