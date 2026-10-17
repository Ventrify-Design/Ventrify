/**
 * _chat — the knowledge an assessment chat is allowed to see, and nothing else.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE ROUTE. Assembling the corpus is pure, deterministic Firestore
 * reading: no model, no network, no auth. Keeping it apart means it can be tested on its own against real
 * engagements — which is the only way to be sure the chat is never handed something it should not have.
 *
 * THE DISTILLED LAYER, DELIBERATELY. The chat reads the assessment's OUTPUTS — verdict, scorecard, deep
 * research — plus a filename-only manifest of the founder's documents. It never reads their contents.
 *
 * That is not a size limit; everything would fit. It is a drift control. The research pass is the governed
 * reading of the founder's room: it decided what mattered, under the rubric, with provenance. If the chat
 * could also read the raw room it would be free to quote a figure out of a spreadsheet that the research
 * pass looked at and deliberately did not surface — a second, ungoverned reading of the same evidence,
 * presented in the same UI with the same apparent authority. The manifest keeps refusals USEFUL ("that
 * would be in Q3_Model.xlsx, which I can't read") without opening that door.
 *
 * NO WEB, EVER. Same doctrine as the cold scorer (see firebase/data.js on the evidence ledger: "the RUNNER
 * fetches it — it has web access — the cold scorer does not and never will"). The corpus is the whole world.
 *
 * SOURCE IDS ARE THE CONTRACT. Every block carries a stable id. The model must cite one for each claim, and
 * the route validates every returned id against this list — a citation that is not in here is a fabrication
 * and is caught mechanically rather than by reading the answer and hoping.
 *
 * The leading underscore keeps this OFF Vercel's function count (the OS project sits at its 12-function
 * cap — see api/_drive.js and api/_roomcheck.js for the same reason).
 */

// Rough token estimate. Deliberately crude: it exists to report size and catch a runaway corpus, not to
// bill anybody. ~4 chars/token is close enough for English prose and well-formed JSON.
const estTokens = (s) => Math.round(String(s || '').length / 4);

// Above this, something has gone wrong upstream (a research pass that dumped raw documents, say) and we
// want to know rather than silently post a huge prompt. The largest real corpus measured is ~123k.
const CORPUS_WARN_TOKENS = 180000;

const str = (v) => (v == null ? '' : String(v));
const lines = (a) => (Array.isArray(a) ? a : []).filter(Boolean).map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n');

// Render a nested object readably rather than as one long JSON line. The assessment's team/market/exit/
// valuation blocks are objects of prose, and the model reads indented key: value far better than JSON.
function block(o, depth = 0) {
  if (o == null) return '';
  if (typeof o !== 'object') return str(o);
  if (Array.isArray(o)) {
    return o.map((x) => (typeof x === 'object' ? `-\n${block(x, depth + 1)}` : `- ${str(x)}`)).join('\n');
  }
  const pad = '  '.repeat(depth);
  return Object.entries(o)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => (typeof v === 'object' ? `${pad}${k}:\n${block(v, depth + 1)}` : `${pad}${k}: ${str(v)}`))
    .join('\n');
}

// The commit that began stamping instrument identity at scoring time (tools/cloud/instrument.js, 2026-09-22).
// MISSING `scorer` MEANS TWO DIFFERENT THINGS and conflating them libels half the back catalogue: before this
// date it means the field did not exist yet, so a perfectly good measured score simply has no record of the
// instrument. AFTER it, a published snapshot with no scorer really was not produced by a cold scoring pass —
// KreditMate's 62 is the known case, a Republish of the agent's own self-rating after nine scoring attempts
// failed. Only the second deserves the word "unmeasured".
const INSTRUMENT_FROM = '2026-09-22';

/**
 * How much the scorecard can be leaned on. The chat must be able to say "this number was not measured" —
 * but only when that is actually true. Stating the facts, not interpreting them.
 */
function integrityOf(snap) {
  if (!snap) return { hasScore: false, note: 'No scorecard has been published for this venture yet.' };
  const measured = !!snap.scorer;
  const predatesStamping = !measured && String(snap.computedAt || '').slice(0, 10) < INSTRUMENT_FROM;
  const parts = [];
  parts.push(measured
    ? `Scored by ${snap.scorer.model || 'an unrecorded model'}${snap.scorer.effort ? ` at ${snap.scorer.effort} effort` : ''}.`
    : predatesStamping
      ? 'This snapshot predates instrument recording, so which model scored it was never captured. It was most likely a normal scoring pass, but the provenance cannot be confirmed — say so if the number is leaned on hard.'
      : 'NOT A MEASURED SCORE: this snapshot was published after instrument recording began and still carries no scorer identity, so it did not come from a cold scoring pass. Treat the number as indicative only and say so whenever it is discussed.');
  if (snap.consensus) {
    const c = snap.consensus;
    parts.push(`Consensus across ${c.draws || c.n || 'multiple'} blind draws${c.quorum ? `, quorum ${c.quorum}` : ''}.`);
  } else if (measured) {
    parts.push('No consensus record on this snapshot (it predates consensus being carried through).');
  }
  if (snap.phase) parts.push(`Published by the "${snap.phase}" phase.`);
  parts.push(`${snap.ratedCount || 0} of ${(snap.ratedCount || 0) + (snap.pendingCount || 0)} signals rated; ${snap.pendingCount || 0} still forming.`);
  if (snap.augmentHash) parts.push('Operator-filed evidence was included in this score.');
  return { hasScore: true, measured, note: parts.join(' ') };
}

/**
 * Build the corpus for one engagement.
 *
 * @param {FirebaseFirestore.Firestore} db  an initialised Admin SDK handle (the ROUTE owns ensureAdmin)
 * @param {string} engagementId
 * @returns {Promise<{ok:boolean, reason?:string, corpus?:object}>}
 */
async function buildCorpus(db, engagementId) {
  const ref = db.collection('engagements').doc(engagementId);
  const engSnap = await ref.get();
  if (!engSnap.exists) return { ok: false, reason: 'engagement_not_found' };
  const e = engSnap.data();

  const [hubSnap, docSnap, vssSnap] = await Promise.all([
    ref.collection('hubDocs').get(),
    ref.collection('founderDocs').get(),
    ref.collection('investabilitySnapshots').get(),
  ]);

  // Snapshots are ordered by computedAt (see firebase/data.js listInvestabilitySnapshots). Sorting here
  // rather than in the query keeps this working on documents written before the field was consistent.
  const snaps = vssSnap.docs.map((d) => d.data())
    .sort((a, b) => String(a.computedAt || '').localeCompare(String(b.computedAt || '')));
  const vss = snaps[snaps.length - 1] || null;

  const blocks = [];
  const add = (id, title, kind, text, rank = 0) => {
    const t = str(text).trim();
    if (t) blocks.push({ id, title, kind, text: t, rank });
  };

  // ── identity ────────────────────────────────────────────────────────────────────────────────────
  add('venture', 'The venture', 'identity', block({
    name: e.ventureName || e.name,
    founder: e.founderName,
    stage: e.stage,
    sector: e.industry,
    website: e.website,
    pitch: e.venturePitch,
  }));

  // ── the verdict ─────────────────────────────────────────────────────────────────────────────────
  const a = e.assessment || {};
  if (a.recommendation) {
    add('verdict', 'Verdict and thesis', 'verdict', [
      `Recommendation: ${str(a.recommendation)}`,
      a.conviction ? `Conviction: ${str(a.conviction)}` : '',
      a.theAsk ? `The ask: ${str(a.theAsk)}` : '',
      a.thesis ? `\nThesis:\n${str(a.thesis)}` : '',
      a.biggestRisk ? `\nBiggest risk:\n${str(a.biggestRisk)}` : '',
      a.mustBeTrue && a.mustBeTrue.length ? `\nWhat must be true:\n${lines(a.mustBeTrue)}` : '',
      a.bull && a.bull.length ? `\nBull case:\n${lines(a.bull)}` : '',
      a.bear && a.bear.length ? `\nBear case:\n${lines(a.bear)}` : '',
    ].filter(Boolean).join('\n'));

    if (a.diligence && a.diligence.length) {
      add('diligence', 'Open diligence items', 'verdict',
        a.diligence.map((d) => `- [${str(d.priority || 'medium')}] ${str(d.item)}`).join('\n'));
    }
    // The analytical sub-blocks are objects of prose — each gets its own id so a claim about the market
    // can cite the market analysis rather than the whole verdict.
    for (const k of ['market', 'team', 'benchmark', 'valuation', 'exit']) {
      if (a[k] && typeof a[k] === 'object') add(`analysis:${k}`, `${k[0].toUpperCase()}${k.slice(1)} analysis`, 'verdict', block(a[k]));
    }
    if (a.rounds && a.rounds.length) {
      add('comparables', 'Comparable rounds', 'verdict',
        a.rounds.map((r) => `- ${str(r.company)} · ${str(r.stage)} · ${str(r.amount)} · ${str(r.valuation)}${r.investors ? ` · ${str(r.investors)}` : ''}`).join('\n'));
    }
  }

  // ── the scorecard ───────────────────────────────────────────────────────────────────────────────
  const integrity = integrityOf(vss);
  if (vss) {
    add('vss', 'Venture Sentiment Score', 'score', [
      `Composite: ${vss.composite} of ${vss.maxPossible} (${vss.pct}%) · band: ${str(vss.bandLabel || vss.band)}`,
      `Computed: ${str(vss.computedAt)}`,
      `INTEGRITY: ${integrity.note}`,
    ].join('\n'));

    for (const c of vss.categories || []) {
      add(`vss:${c.key}`, `${c.label} (scorecard category)`, 'score', [
        `${c.sum} of ${c.max} · weight ${c.weight} · ${c.rated} rated, ${c.pending} pending${c.band ? ` · ${c.band}` : ''}`,
        ...(c.subs || []).map((s) => `- ${s.slug}: ${s.score == null ? 'not yet rated' : s.score}${s.note ? ` — ${str(s.note)}` : ''}`),
      ].join('\n'));
    }
  }

  // ── deep research ───────────────────────────────────────────────────────────────────────────────
  // Each research document keeps its own id so a citation points at a page the operator can actually open.
  for (const d of hubSnap.docs.map((x) => x.data()).sort((x, y) => (x.order || 0) - (y.order || 0))) {
    const slug = str(d.name || d.title).trim();
    if (!slug) continue;
    add(`research:${slug}`, str(d.title || slug), 'research', d.body || d.markdown || '', Number(d.order) || 0);
  }

  // ── the manifest: names only, never contents ────────────────────────────────────────────────────
  const manifest = docSnap.docs.map((x) => x.data()).map((d) => ({
    name: str(d.name),
    type: str(d.docType || 'dataroom'),
    readable: d.extraction === 'ok',
  }));
  if (manifest.length) {
    add('manifest', 'Documents the founder supplied', 'manifest', [
      'These are the documents in the data room. THEIR CONTENTS ARE NOT AVAILABLE TO YOU — only the',
      'research above, which is the governed reading of them. If a question needs a figure that is not in',
      'the research, name the document it would be in and say you cannot read it.',
      '',
      ...manifest.map((m) => `- ${m.name} (${m.type}${m.readable ? '' : ', could not be text-extracted'})`),
    ].join('\n'));
  }

  // ── freshness: is this picture current? ─────────────────────────────────────────────────────────
  const room = e.dataRoom || {};
  const rs = e.runState || {};
  const fresh = [];
  if (rs.status) fresh.push(`Last run: ${str(rs.status)}${rs.finishedAt ? ` (finished ${str(rs.finishedAt)})` : ''}.`);
  if (room.pending && (room.pending.added || room.pending.changed)) {
    const n = (room.pending.added || 0) + (room.pending.changed || 0);
    fresh.push(`STALE: ${n} document${n === 1 ? '' : 's'} arrived in the data room AFTER this assessment ran and have not been read — ${(room.pending.names || []).slice(0, 6).join(', ')}. Say so, unprompted, whenever the answer could be affected by them.`);
  }
  if (fresh.length) add('freshness', 'How current this is', 'freshness', fresh.join('\n'));

  const text = blocks.map((b) => `\n===== [${b.id}] ${b.title} =====\n${b.text}`).join('\n');
  const tokens = estTokens(text);

  return {
    ok: true,
    corpus: {
      engagementId,
      ventureName: e.ventureName || e.name || engagementId,
      blocks,
      sourceIds: blocks.map((b) => b.id),
      manifest,
      integrity,
      stale: !!(room.pending && (room.pending.added || room.pending.changed)),
      text,
      tokens,
      oversized: tokens > CORPUS_WARN_TOKENS,
    },
  };
}

// ── CITATION VALIDATION ───────────────────────────────────────────────────────────────────────────────
//
// The model is told to mark every claim with [[id]], where id is one of the corpus's source ids. This
// checks that it did — and, more importantly, that every id it used actually exists.
//
// WHY THIS IS CODE AND NOT A PROMPT. "Cite your sources" in a system prompt is a request; a model under
// pressure to be helpful will invent a plausible-looking id to satisfy it. Checking the ids against the
// corpus turns the instruction into something mechanically enforced: a fabricated citation cannot survive,
// because the id is either in the list or it is not. It is the only anti-drift control here that does not
// depend on the model's good behaviour.
//
// An INVALID citation is not silently stripped — stripping it would leave the sentence standing and looking
// sourced. It is replaced with a visible marker so the operator sees that the model reached for something
// that is not in the assessment, which is a signal worth having.
const CITE_RE = /\[\[\s*([^\]]{1,140}?)\s*\]\]/g;

function validateCitations(answer, sourceIds) {
  const known = new Set(sourceIds || []);
  const used = [];
  const invalid = [];
  let m;
  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(String(answer || ''))) !== null) {
    const id = m[1].trim();
    if (!id) { if (!invalid.includes('(empty)')) invalid.push('(empty)'); continue; }
    if (known.has(id)) { if (!used.includes(id)) used.push(id); }
    else if (!invalid.includes(id)) invalid.push(id);
  }
  const clean = String(answer || '').replace(CITE_RE, (full, raw) =>
    known.has(raw.trim()) ? `[[${raw.trim()}]]` : `[[unverified: ${raw.trim() || 'empty citation'}]]`);
  return { text: clean, used, invalid, ok: invalid.length === 0, cited: used.length > 0 };
}

// ── FITTING THE CORPUS TO THE CONTEXT ─────────────────────────────────────────────────────────────────
//
// Holoclara's corpus measures ~152k tokens against a 200k window, which leaves too little room for a long
// conversation. Rather than let the window silently truncate the END of the prompt (which is where the
// freshness and manifest blocks live — exactly the ones that keep the model honest), we drop whole research
// documents, longest first, and TELL the model which ones are missing so it can say so.
//
// Order of protection: identity, verdict, scorecard, manifest and freshness are never dropped. Research is.
const CORPUS_MAX_TOKENS = 140000;
const NEVER_DROP = new Set(['identity', 'verdict', 'score', 'manifest', 'freshness']);

function fitCorpus(corpus, maxTokens = CORPUS_MAX_TOKENS) {
  if (corpus.tokens <= maxTokens) return { ...corpus, dropped: [] };
  const keep = corpus.blocks.filter((b) => NEVER_DROP.has(b.kind));
  // IN THE ORDER THE RESEARCH PASS PUT THEM IN, dropping from the tail. The first cut dropped the LARGEST
  // document first, which threw out Holoclara's partner-grade Investment Analysis to keep five short
  // side-notes — precisely backwards. hubDocs carry their own `order` (the deal memo is deliberately -1),
  // so that curation already encodes what matters most. Respect it rather than inventing a size heuristic.
  const droppable = corpus.blocks.filter((b) => !NEVER_DROP.has(b.kind))
    .sort((a, b) => (a.rank || 0) - (b.rank || 0) || a.text.length - b.text.length);
  let budget = maxTokens - estTokens(keep.map((b) => b.text).join(''));
  const kept = [], dropped = [];
  let full = false;
  for (const b of droppable) {
    const cost = estTokens(b.text);
    if (!full && cost <= budget) { kept.push(b); budget -= cost; } else { full = true; dropped.push(b); }
  }
  // Restore the author's order rather than the size order we sorted into.
  const order = new Map(corpus.blocks.map((b, i) => [b.id, i]));
  const blocks = [...keep, ...kept].sort((a, b) => order.get(a.id) - order.get(b.id));
  if (dropped.length) {
    blocks.push({
      id: 'omitted', title: 'Research NOT loaded into this conversation', kind: 'freshness',
      text: ['These research documents exist for this venture but were too large to load here. If a question',
        'needs them, say they exist and were not loaded — do not guess at their contents.', '',
        ...dropped.map((b) => `- ${b.title}`)].join('\n'),
    });
  }
  const text = blocks.map((b) => `\n===== [${b.id}] ${b.title} =====\n${b.text}`).join('\n');
  return { ...corpus, blocks, sourceIds: blocks.map((b) => b.id), text, tokens: estTokens(text), dropped: dropped.map((b) => b.title) };
}

// ── THE PROMPT ────────────────────────────────────────────────────────────────────────────────────────
//
// Every rule here is also enforced somewhere else — citations in code, the founder documents by simply not
// being present, the web by there being no tool to reach it. The prompt is the weakest of the controls and
// is written on that assumption: it explains the job, it is not the thing standing between you and drift.
function systemPrompt(corpus) {
  return [
    `You are the assessment assistant for ${corpus.ventureName}. You help one operator think about one venture.`,
    '',
    'WHAT YOU KNOW',
    'Everything you know about this venture is in the SOURCES below — the assessment it produced, its',
    'scorecard, and its deep research. You have no web access and no other information about this company.',
    'You have NOT read the founder\'s own documents: only the research pass did, and what it concluded is',
    'what you have. A manifest lists those documents by name so you can point at them.',
    '',
    'CITING',
    'Mark every factual claim with the source id it came from, like [[verdict]] or [[vss:market]]. Ids are',
    'listed with each source. Never invent an id: a citation that is not in the list is removed and shown to',
    'the operator as unverified, which is worse than having said nothing.',
    '',
    'WHEN YOU DO NOT KNOW',
    'Say so plainly. "The assessment does not cover that" is a complete and useful answer. If the figure',
    'would live in one of the founder\'s documents, name the document and say you cannot read it. Never',
    'close a gap with a plausible guess — the operator cannot tell your guesses from the assessment\'s',
    'findings, and this product\'s whole value is that the two are distinguishable.',
    '',
    'You may use general knowledge to explain a CONCEPT (what a SAFE is, how CAC payback works). You may',
    'not use it to assert a fact about this venture, its market, or its competitors. If you reach for',
    'outside context, label it as yours and uncited.',
    '',
    'HONESTY ABOUT THE SCORE',
    corpus.integrity.note,
    corpus.stale ? 'Documents have arrived since this assessment ran — see the freshness source and raise it unprompted when it could change the answer.' : '',
    '',
    'STYLE',
    'Brief and direct. The operator is a professional investor; do not restate the verdict back at them or',
    'pad with caveats. Lead with the answer.',
    '',
    '===== SOURCES =====',
    `Valid source ids: ${corpus.sourceIds.join(', ')}`,
    corpus.text,
  ].filter((l) => l !== '').join('\n');
}

// Exercises the entire path — corpus, prompt, citation validation, persistence, rendering — with no API key
// and no spend, so Stage 0 is a switch to flip rather than a debugging session. Deliberately echoes real
// source ids AND one fabricated one, so the validator is visibly doing its job in the UI from day one.
function stubAnswer(corpus, question) {
  const real = corpus.sourceIds.find((i) => i === 'verdict') || corpus.sourceIds[0];
  return [
    `**Stub mode — no \`ANTHROPIC_API_KEY\` is set on this environment, so nothing was sent to a model.**`,
    '',
    `You asked: "${String(question).slice(0, 160)}"`,
    '',
    `The corpus for ${corpus.ventureName} loaded correctly: ${corpus.blocks.length} sources, `,
    `${corpus.tokens.toLocaleString()} tokens${corpus.dropped && corpus.dropped.length ? `, ${corpus.dropped.length} research document(s) omitted for size` : ''}. `,
    `A real answer would cite its sources like this [[${real}]].`,
    '',
    `This next citation is deliberately fabricated so you can see the validator catch it: [[research:does-not-exist]].`,
  ].join('');
}

/**
 * Answer one question against one corpus.
 * Returns { text, used, invalid, stub, usage } — never throws for a model-side problem.
 */
async function answer({ corpus, history = [], question, apiKey = process.env.ANTHROPIC_API_KEY, model = 'claude-sonnet-5-5' }) {
  const fitted = fitCorpus(corpus);
  if (!apiKey) {
    const v = validateCitations(stubAnswer(fitted, question), fitted.sourceIds);
    return { ...v, stub: true, usage: null, dropped: fitted.dropped };
  }
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 2000,
      // The corpus is identical on every turn, so cache it: the first question pays to write the cache and
      // every one after it reads at a fraction of the price.
      system: [{ type: 'text', text: systemPrompt(fitted), cache_control: { type: 'ephemeral' } }],
      messages: [...history.slice(-12).map((m) => ({ role: m.role, content: String(m.text || '') })),
        { role: 'user', content: String(question) }],
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`model_error_${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  const raw = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const v = validateCitations(raw, fitted.sourceIds);
  return { ...v, stub: false, usage: data.usage || null, dropped: fitted.dropped };
}

module.exports = {
  buildCorpus, fitCorpus, validateCitations, systemPrompt, answer,
  estTokens, CORPUS_WARN_TOKENS, CORPUS_MAX_TOKENS, INSTRUMENT_FROM,
};
