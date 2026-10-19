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
  const aliases = {};                 // a more precise id the model may cite → the block that carries it
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
      // EACH SIGNAL IS A CITABLE SOURCE IN ITS OWN RIGHT. The first cut registered ids only down to the
      // category, and the model answered by citing `vss:demand_validation` — a real signal slug, and a
      // MORE precise citation than `vss:market`. The validator called that a fabrication, which was the id
      // scheme being too narrow rather than the model inventing anything. Signals now resolve to their
      // category's block. Slug collisions would make a citation ambiguous, so the first registration wins
      // and a duplicate is simply not aliased.
      for (const sub of c.subs || []) {
        const alias = `vss:${sub.slug}`;
        if (sub.slug && !aliases[alias] && alias !== `vss:${c.key}`) aliases[alias] = `vss:${c.key}`;
      }
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

  // ── open gaps ───────────────────────────────────────────────────────────────────────────────────
  // A GAP is a check the assessment RAN and could not close, so the venture was docked for our miss. These
  // are the only things the operator can file evidence against, and the only place a legitimate gapId comes
  // from — the chat may not invent one, and the proposal card shows the id so a wrong one is visible.
  const gaps = (((e.assessmentGaps || {}).unresolved) || []).filter((g) => g && g.id && g.subject);
  if (gaps.length) {
    add('gaps', 'Open evidence gaps', 'gaps', [
      'Checks the assessment ran and could not close. Each was scored against the venture. The operator can',
      'file a pointer to evidence (a URL) against one of these, which the next run fetches and re-scores —',
      'the score can go either way.',
      '',
      ...gaps.map((g) => `- [${g.id}] ${str(g.subject)}\n    sought: ${str(g.sought).slice(0, 300)}`),
    ].join('\n'));
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
      blocks, aliases,
      gapIds: gaps.map((g) => g.id),
      hasRoom: !!(room.folderId),
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

function validateCitations(answer, sourceIds, aliases = {}) {
  const known = new Set([...(sourceIds || []), ...Object.keys(aliases || {})]);
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
// `gaps` is protected for a reason beyond its size: it is the ONLY legitimate source of a gapId, and the
// file-evidence proposal is built from one. Drop it and the assistant either cannot propose at all or
// starts guessing ids — and a guessed id on a card the operator might press is not a risk worth taking.
const NEVER_DROP = new Set(['identity', 'verdict', 'score', 'manifest', 'freshness', 'gaps']);
// The "research not loaded" notice is appended AFTER the budget is spent, so it has to be paid for up
// front or the fitted corpus lands just over the cap — it did, by 455 tokens.
const OMITTED_NOTICE_TOKENS = 600;

function fitCorpus(corpus, maxTokens = CORPUS_MAX_TOKENS) {
  if (corpus.tokens <= maxTokens) return { ...corpus, dropped: [] };
  const keep = corpus.blocks.filter((b) => NEVER_DROP.has(b.kind));
  // IN THE ORDER THE RESEARCH PASS PUT THEM IN, dropping from the tail. The first cut dropped the LARGEST
  // document first, which threw out Holoclara's partner-grade Investment Analysis to keep five short
  // side-notes — precisely backwards. hubDocs carry their own `order` (the deal memo is deliberately -1),
  // so that curation already encodes what matters most. Respect it rather than inventing a size heuristic.
  const droppable = corpus.blocks.filter((b) => !NEVER_DROP.has(b.kind))
    .sort((a, b) => (a.rank || 0) - (b.rank || 0) || a.text.length - b.text.length);
  let budget = maxTokens - estTokens(keep.map((b) => b.text).join('')) - OMITTED_NOTICE_TOKENS;
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
    'FIGURES',
    'Copy every number EXACTLY as the source writes it, digit for digit. Do not retype one from memory, do',
    'not tidy it, do not reconstruct a precise figure you half-recall — if you are not looking straight at',
    'it, give the rounded form or say you cannot quote it precisely. A number that is one digit out looks',
    'exactly as authoritative as a correct one, and the citation beside it makes it worse, not better.',
    'If you work a figure out yourself, say so in the same sentence ("that is my subtraction"). Every',
    'number is checked against the sources after you answer, and anything that is not in them is marked.',
    '',
    'HONESTY ABOUT THE SCORE',
    corpus.integrity.note,
    corpus.stale ? 'Documents have arrived since this assessment ran — see the freshness source and raise it unprompted when it could change the answer.' : '',
    '',
    'DOING THINGS',
    'You have tools, but none of them act. Each one puts a card in front of the operator with a button; they',
    'decide. Propose only when it is the obvious next step and you have what the tool needs — a real gapId',
    'from the gaps source, a URL the operator actually gave you. Do not propose a re-run casually: it costs',
    'over an hour of compute. Say what you are proposing in your reply too; the card is not the explanation.',
    'Write it as something you are OFFERING, never as something you have done — "there is a card to file',
    'this" or "I can file this", not "I am filing it". Nothing happens until they press the button, and an',
    'operator who believes it is already filed will not press it.',
    '',
    // ── PRODUCT KNOWLEDGE ──────────────────────────────────────────────────────────────────────────
    // ADDED, NOT SUBSTITUTED. The corpus contains no definition of "par", "coverage" or "median of three"
    // — I checked — so until now the honest answer to "what does 0.5 mean?" was "not covered by this
    // assessment", which is true and useless. This block answers that class of question.
    //
    // It is kept strictly apart from the venture's evidence. Everything below describes how Verdict works
    // and is the same for every assessment, so it needs no citation; anything about THIS venture still
    // comes from the sources and still carries one. Without that line the model would reasonably conclude
    // that uncited assertion is now acceptable, and the citation discipline would quietly dissolve.
    //
    // Only what actually exists is described. The brief for this block also defined guidance text and
    // critical blockers, neither of which is built — an assistant confidently explaining features the
    // product does not have is the same credibility problem as one inventing a figure.
    'HOW VERDICT WORKS — background you may state WITHOUT a citation',
    '',
    'This part describes the product, not this venture. It is identical for every assessment, so it needs',
    'no source id. Anything about THIS venture still comes from the sources above and still cites one.',
    '',
    '1. FREEZE — the deck and data room are locked and fingerprinted, so every mark traces to the exact',
    '   documents it judged.',
    '2. RESEARCH — specialist agents check claims, size the market, look at competitors and diligence the',
    '   founders. This is where web access happens. You are not that stage and cannot browse.',
    '3. SCORE — three independent readers each mark the 35 signals using only the venture\'s own documents.',
    '   They cannot browse, cannot see each other\'s marks, and cannot see an earlier score.',
    '4. RECONCILE — each signal takes the MEDIAN of the three marks. If fewer than two readers finish,',
    '   nothing is published: a median of one is a single noisy sample wearing the median\'s name.',
    '5. COMPUTE — signals average into seven weighted categories, then into 0–100. Fixed arithmetic, not a',
    '   judgement. The weights vary by stage.',
    '6. STAMP — the score records which evidence, criteria version and model produced it.',
    '',
    'TERMS',
    '- Investability score / Venture Sentiment Score: the 0–100 composite. It measures THE QUALITY OF THE',
    '  EVIDENCE FILED, not whether the business will succeed. Say so when it matters.',
    '- The seven categories: Team, Market, Product, Moat, Financial, Execution, Evidence Integrity.',
    '- Signal: one of the 35 tests, marked 0, 0.5 or 1 against a written threshold.',
    '- 0.5 / par: what a credible venture at this stage would normally show. 1 is above par. 0 means the',
    '  evidence falls short or is absent.',
    '- Not assessable: the documents cannot answer the signal, so it is excluded rather than marked 0, and',
    '  the remaining category weights renormalise.',
    '- Coverage: how many of the 35 could be rated. A deck-only assessment has low coverage, so the score',
    '  rests on less and moves more.',
    '- Stage: pre-seed, seed, Series A, or Series B and later. Stage changes the category WEIGHTS only —',
    '  never a signal\'s threshold. Early stages weight Team more and Financial/Execution less.',
    '- Bands: 80+ Investment ready · 60–79 Promising · 40–59 High risk · below 40 Potential decline.',
    '  Par on every signal scores 50, which lands in High risk: a venture that stands out on nothing is a',
    '  high-risk profile. Investment ready additionally requires decent coverage and a stable score.',
    '- Score stability: where the three readers SPLIT and a single vote decided the mark, the published',
    '  value is one read away from its opposite. When enough of the weighted score rests on those, the',
    '  assessment says so — and more evidence, not a re-run, is what settles it.',
    '- Evidence Integrity: how rigorous the venture\'s OWN documents are — sourcing, internal consistency.',
    '  It does not grade Ventrify\'s research.',
    '- Supported / unverified / contradicted: the status of a founder claim. Unverified means nothing was',
    '  found either way, which is usually missing material rather than a false claim. Say that plainly.',
    '- Re-score: a new score after new evidence, a stage change or an instrument change. It is always',
    '  labelled with the reason and never presented as the venture improving on its own.',
    '',
    'EXPLAIN, DO NOT ADVISE. Verdict reports what the evidence shows; it never tells anyone to invest or',
    'decline. You may state what the assessment itself concluded, including its recommendation field. You',
    'may not add one of your own, and you do not use "I\'d recommend", "you should invest", "you should',
    'decline", "approve" or "reject" in your own voice.',
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

// ── PROPOSALS: WHAT THE ASSISTANT MAY SUGGEST, AND WHY IT CAN NEVER DO IT ─────────────────────────────
//
// The assistant can act, but only in one direction: it PROPOSES, the operator COMMITS. Nothing here runs a
// tool. The model's tool call is captured, turned into a card, and handed to the browser; the commit then
// goes through the ordinary engagement-actions.js path with the operator's own credentials and the same
// Firestore rules that govern a button click. So the chat can never do anything the operator could not do
// themselves, and never does anything they did not press.
//
// That is also why no tool result is ever returned to the model. The turn ends at the proposal. History is
// rebuilt from stored TEXT only, so an unanswered tool_use can never be replayed into a later request.
//
// AND IT CANNOT MOVE A NUMBER. Filing evidence writes an append-only `filed` record that the NEXT governed
// run fetches, reads and re-scores — the score can fall. The chat puts evidence in front of the scorer; it
// never edits the scorer's output. Re-running is just the existing run, with its existing cost and gates.
const TOOLS = [
  {
    name: 'propose_file_evidence',
    description: 'Propose filing a pointer to evidence against one open gap. Use ONLY when the operator has '
      + 'named a specific source (a URL) that speaks to that gap. The gapId must be one listed in the "gaps" '
      + 'source — never invent one. This does not change the score: the next run fetches the evidence, reads '
      + 'it and re-scores, and the score may go down.',
    input_schema: {
      type: 'object',
      properties: {
        gapId: { type: 'string', description: 'id from the gaps source, e.g. 2ec6a2e5' },
        url: { type: 'string', description: 'the URL the operator gave' },
        note: { type: 'string', description: 'one line on what this evidence shows' },
      },
      required: ['gapId', 'url'],
    },
  },
  {
    name: 'propose_document_request',
    description: 'Propose emailing the founder for the documents the assessment could not find. The content '
      + 'is derived server-side from a fresh check of the data room, not from anything you write.',
    input_schema: { type: 'object', properties: { reason: { type: 'string', description: 'one line on why now' } } },
  },
  {
    name: 'propose_rescan_room',
    description: 'Propose re-reading the linked data room to pick up documents added since the last run. '
      + 'Only when a room is linked. Cheap and fast.',
    input_schema: { type: 'object', properties: { reason: { type: 'string' } } },
  },
  {
    name: 'propose_rerun',
    description: 'Propose re-running the whole assessment. EXPENSIVE — well over an hour of compute. Only '
      + 'propose this when new evidence has actually landed that the current score did not see.',
    input_schema: { type: 'object', properties: { reason: { type: 'string', description: 'what changed that justifies the cost' } } },
  },
];

// What the card says. Written here rather than in the panel so the wording cannot drift from the schema.
const PROPOSAL_COPY = {
  propose_file_evidence: (i, c) => ({
    title: 'File this evidence against a gap',
    detail: `Gap ${i.gapId}: ${(c.gapIds || []).includes(i.gapId) ? 'open on this assessment' : 'NOT A KNOWN GAP — do not commit'}`,
    lines: [i.url, i.note].filter(Boolean),
    warn: !(c.gapIds || []).includes(i.gapId),
    cta: 'File evidence',
  }),
  propose_document_request: (i) => ({
    title: 'Email the founder for the missing documents',
    detail: 'The list is rebuilt from a fresh check of the data room when you send it.',
    lines: [i.reason].filter(Boolean), cta: 'Review and send',
  }),
  propose_rescan_room: (i) => ({
    title: 'Re-read the data room',
    detail: 'Reads only what has changed since last time. Seconds, no model cost.',
    lines: [i.reason].filter(Boolean), cta: 'Re-read now',
  }),
  propose_rerun: (i) => ({
    title: 'Re-run the whole assessment',
    detail: 'Over an hour of compute, and it will publish a new score.',
    lines: [i.reason].filter(Boolean), warn: true, cta: 'Re-run assessment',
  }),
};

function toProposals(blocks, corpus) {
  return (blocks || []).filter((b) => b.type === 'tool_use' && PROPOSAL_COPY[b.name]).map((b) => {
    const input = b.input || {};
    return { tool: b.name, input, ...PROPOSAL_COPY[b.name](input, corpus) };
  });
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
  const finish = (raw, blocks) => {
    const v = validateCitations(raw, fitted.sourceIds, fitted.aliases);
    const f = checkFigures(v.text, fitted.text);
    return {
      ...v, text: f.text, figures: f.figures, unsupportedFigures: f.unsupported,
      proposals: toProposals(blocks, fitted),
      ok: v.ok && f.ok, dropped: fitted.dropped,
    };
  };
  if (!apiKey) return { ...finish(stubAnswer(fitted, question), []), stub: true, usage: null };
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 2000,
      // The corpus is identical on every turn, so cache it: the first question pays to write the cache and
      // every one after it reads at a fraction of the price.
      system: [{ type: 'text', text: systemPrompt(fitted), cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      // HISTORY IS TEXT ONLY, DELIBERATELY. A tool_use block is never answered with a tool_result — the turn
      // ends at the proposal — so replaying one into a later request would be a protocol error. Rebuilding
      // from stored text makes that impossible rather than merely unlikely.
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
  return { ...finish(raw, data.content), stub: false, usage: data.usage || null };
}

// ── FIGURE VALIDATION ─────────────────────────────────────────────────────────────────────────────────
//
// THE GATE FOUND TWO REAL FABRICATIONS AND THEY BOTH WORE A VALID CITATION. One answer said minimum cash
// was "$3,363,774", where the research says $3,363,744 — and then invented a discrepancy between two
// documents to explain the digits it had changed. Another gave "about $613k recognised" against a real
// source id, with 613 appearing nowhere in the corpus. A correct citation beside an incorrect number is
// the worst case this product has: it looks more sourced than an uncited claim, not less.
//
// So numbers get what ids already get — checked in code, at answer time, every time. If a figure is not in
// the corpus it is marked in the text. Nothing is deleted: the operator should see the claim AND the doubt.
//
// DERIVED ARITHMETIC IS NOT A FABRICATION. A model that subtracts two corpus figures and says "that is my
// subtraction, not a figure the research reports" is behaving exactly as it should. Where the sentence
// discloses the derivation the figure is marked as derived rather than unsupported — a quieter signal,
// because an honest calculation and a corrupted quotation deserve different alarm.
const DISCLOSED = /\b(my (own )?(subtraction|arithmetic|calculation|estimate|maths|math)|I (calculated|computed|subtracted|derived|worked (it|this) out)|implied|derived from|not a figure the research reports|back-of-|rounded from)\b/i;

// Years and anything under three digits are discourse ("1 of 5", "in 2026"), not claimed figures.
function figureTokens(text) {
  return (String(text).match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((n) => n.replace(/[.,]$/, ''))
    .filter((n) => {
      const bare = n.replace(/,/g, '');
      if (bare.replace('.', '').length <= 2) return false;
      if (/^(19|20)\d{2}$/.test(bare)) return false;
      return true;
    });
}

// A SUBSTRING SEARCH OF MARKDOWN IS NOT A SEARCH FOR A NUMBER, and this cost a false accusation. The
// research writes emphasised figures as `$3,363,**744**`, so looking for "3,363,744" found nothing and the
// checker reported a fabrication where the model had quoted the source correctly. Research prose is full of
// bold, italics, backticks and non-breaking spaces, and every one of them can land inside a number.
//
// So both sides are reduced to bare digit runs before comparing. The corpus is indexed once per call into
// the set of every number it contains, however it was decorated.
function corpusNumbers(corpusText) {
  const flat = String(corpusText)
    .replace(/[*_`~]/g, '')                 // markdown emphasis, including mid-number
    .replace(/[\u00a0\u202f\u2009\u2007]/g, '');   // non-breaking and thin spaces used as separators
  const set = new Set();
  for (const m of flat.match(/\d[\d,. ]*/g) || []) {
    const bare = m.replace(/[,\s]/g, '').replace(/\.$/, '');
    if (bare) set.add(bare);
    // A figure may be quoted without the fractional part the source carries ("6,776,729.40" → "6,776,729").
    const intPart = bare.split('.')[0];
    if (intPart) set.add(intPart);
  }
  return set;
}

function checkFigures(answer, corpusText, index = null) {
  const text = String(answer || '');
  const nums = index || corpusNumbers(corpusText);
  const found = [];
  const seen = new Set();
  for (const n of figureTokens(text)) {
    if (seen.has(n)) continue;
    seen.add(n);
    const bare = n.replace(/,/g, '');
    if (nums.has(bare) || nums.has(bare.split('.')[0])) continue;
    // Judge disclosure from the figure's own sentence AND THE ONE AFTER IT, but no wider. People disclose
    // a calculation in the following breath — "…gives about 72.5, which rounds to the reported 73. That is
    // my arithmetic, not a source figure." — and a one-sentence window scored that honest answer as a
    // fabrication. Two sentences is still narrow enough that a single "my subtraction" cannot launder every
    // other number in a long reply.
    const at = text.indexOf(n);
    const from = Math.max(0, text.lastIndexOf('.', at) + 1);
    let to = text.indexOf('.', at + n.length);
    if (to !== -1) { const next = text.indexOf('.', to + 1); to = next === -1 ? text.length : next; }
    const window = text.slice(from, to === -1 ? text.length : to + 1);
    found.push({ value: n, disclosed: DISCLOSED.test(window) });
  }
  // Mark in place, without touching digits inside a longer number or inside a citation marker.
  let marked = text;
  for (const f of found) {
    const esc = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    marked = marked.replace(new RegExp(`(?<![\\d.,\\[])${esc}(?![\\d.,])`, 'g'),
      f.disclosed ? `${f.value}⟨derived⟩` : `${f.value}⟨not in sources⟩`);
  }
  const unsupported = found.filter((f) => !f.disclosed);
  return { text: marked, figures: found, unsupported, ok: unsupported.length === 0 };
}

module.exports = {
  buildCorpus, fitCorpus, validateCitations, checkFigures, corpusNumbers, systemPrompt, answer, toProposals, TOOLS,
  estTokens, CORPUS_WARN_TOKENS, CORPUS_MAX_TOKENS, INSTRUMENT_FROM,
};
