/**
 * _corpus — turning a venture's uploaded documents into ONE bounded, deterministic block of text.
 *
 * Extracted from _prescreen.js on 2026-10-31 so the v1 scorer and the v2 engine read the room through the
 * SAME code rather than through two copies that drift. Everything here was measured against real rooms —
 * the per-document cap, the de-duplication, the rubric-led ordering — and the comments record what each
 * number cost to learn. Do not re-derive them; the measurements are in design/prescreen-spec.md §10.
 *
 * Nothing in this file calls a model or knows what a score is. It answers one question: given a room,
 * which text do we read, in what order, inside what budget.
 *
 * The leading underscore keeps this OFF Vercel's function count — the OS project sits at exactly its
 * 12-function cap, so a new api/*.js file would fail the whole deploy. Same reason as _roomcheck / _chat.
 */

// ~4 chars/token is close enough for English prose; this exists to cap the corpus, not to bill anyone.
const estTokens = (s) => Math.round(String(s || '').length / 4);

// §9.1 — 40K tokens is roughly 60 pages. A 200-page upload would blow the latency budget on extraction
// alone, so the cap is stated on screen rather than letting one upload decide whether we keep the promise.
const CORPUS_MAX_TOKENS = 40000;
// No single document may take more than this share of the budget. One oversized spreadsheet would
// otherwise consume everything left and starve every document behind it.
//
// 0.35 → 0.20, MEASURED. On MoneyGym's 39-document room the 50,000-token finance base case took its
// full 35% — 14,000 tokens — as a truncated head, and two more documents took 19,000 between them, so
// three files held 33,000 of the 40,000 budget and the investor memo, market analysis, market sizing
// and all four competitor benchmarks were never read. A spreadsheet's first 14,000 tokens are column
// headers and early rows; this is a TRIAGE read scoring seven categories, and breadth across them beats
// depth in one. 20% still admits a meaningful head of any document while guaranteeing at least five.
const PER_DOC_MAX = Math.round(CORPUS_MAX_TOKENS * 0.20);
// Below this there is no point including a fragment — it costs budget and evidences nothing.
const MIN_USEFUL = 400;

// ── CORPUS ───────────────────────────────────────────────────────────────────────────────────────────
//
// DETERMINISTIC ORDER IS LOAD-BEARING. The prompt cache matches on the opening stretch BYTE FOR BYTE, and
// every probe re-sends the corpus because the API is stateless. If Firestore returned these documents in a
// different order on the second call, every probe would be a fresh prefix at full price — ~$7.50 a run
// instead of ~$1.60, which is over budget. Sort explicitly; never trust query order.
// WHAT THE BUDGET IS SPENT ON MATTERS MORE THAN HOW BIG IT IS.
//
// This used to sort deck-first then ALPHABETICALLY, which is a coin flip dressed up as an order. On
// MoneyGym's 53-document room it spent the whole 40K budget on board minutes, incorporation papers and
// third-party benchmark PDFs, and dropped the financial model, the unit economics and the market
// sizing — the documents the rubric scores hardest on. The pre-screen predicted 41-56; the paid run,
// which read everything, published 76. Containment did not fail because the floor was too high. It
// failed because we read the wrong seventeen documents.
//
// Priority uses _roomcheck's OWN filename patterns, so "the documents that matter" means exactly what
// the scorer means by it and cannot drift into a second opinion. Ordering stays fully deterministic —
// the prompt cache matches byte for byte, so a nondeterministic corpus would silently cost 5x.
// Administrative paperwork a room must hold and a scorer learns nothing from. MoneyGym's room spent
// 2,470 tokens of a 40,000 budget reading an EIN confirmation letter as though it were evidence.
const GOVERNANCE = /(board.?resolution|bylaw|incorporat|articles|written.?consent|minutes|certificate|par.?value|stock.?purchase|share.?issuance|director|resignation|\bein\b|confirmation.?letter|tax|registration|filing.?receipt|\bnda\b|invoice|insurance|engagement.?letter)/i;
const EVIDENCE_VALUE = [
  // A deck that was uploaded into the data room rather than tagged ${docType:'pitch'} is still the
  // single most evidence-dense document a venture has. MoneyGym 2's room holds exactly that: its
  // 'FINAL VC Seed Round Pitch Deck' came in untagged and ranked as 'other', sixth.
  [9, 'memo',      /(pitch.?deck|investor.?deck|seed.?round.*deck|investor.?memo|seed.?memo|executive.?summary|one.?.?pager|business.?plan|thesis)/i],
  [8, 'team',      /(team|founder|cv|r[eé]sum|bio|advisor|org.?chart|hiring|people)/i],
  [7, 'market',    /(market|tam|sam|som|sizing|segment|opportunity|user.?insight|customer|demand|competitiv)/i],
  [6, 'product',   /(product|roadmap|feature|overview|spec|demo|architect|technolog|\bip\b|patent|moat|defensib|differentiat)/i],
  [5, 'execution', /(traction|metric|kpi|cohort|retention|growth|pilot|po[cv]|launch|milestone|engagement)/i],
  [4, 'financial', /(financ|unit.?econ|revenue|pricing|forecast|burn|runway|cost|margin|valuation|cap.?table|p.?and.?l|balance.?sheet)/i],
];
function evidenceTag(name) {
  const n = String(name || '');
  if (GOVERNANCE.test(n)) return { v: 1, k: 'governance' };
  for (const [v, k, re] of EVIDENCE_VALUE) if (re.test(n)) return { v, k };
  return { v: 3, k: 'other' };   // unrecognised — above governance, below anything we can name
}
const evidenceValue = name => evidenceTag(name).v;

// THE SAME DOCUMENT TWICE IS NOT TWICE THE EVIDENCE.
//
// Rooms exported from Drive routinely hold both renderings of a file. MoneyGym's holds
// `MoneyGym_Seed_Investor_Memo_updated.pdf` AND `.docx` — ~4,800 tokens, 12% of the budget, for one
// document, read twice and scored as if corroborated.
//
// Only the EXTENSION and the copy markers are stripped. "NG Founder_Stock_Purchase…",
// "2nd NG Founder_Stock_Purchase…" and "JC Founder_Stock_Purchase…" are three different people's
// agreements and must stay three documents; over-normalising here would silently delete evidence,
// which is far worse than reading something twice.
function dedupeKey(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')          // extension
    .replace(/^copy of\s+/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')            // " (1)"
    .replace(/[\s_\-]+/g, ' ')
    .trim().toLowerCase();
}


// SPREAD THE BUDGET ACROSS THE RUBRIC, HIGHEST-VALUE CATEGORY FIRST.
//
// This used to round-robin the SIX DATA-ROOM CLASSES, on the reasoning that "the range's width IS the
// count of classes we could not evidence". That reasoning was wrong, and it is the deepest cause of the
// pre-screen failing to discriminate between ventures:
//
//   · The width is the count of unevidenced RUBRIC SIGNALS (35, across 7 weighted categories), not of
//     room classes (6, leaning financial and legal).
//   · The room check never reads this corpus. api/ingest-docs.js `room-check` runs over EVERY ingested
//     document independently, so ordering the scoring corpus by room classes bought coverage that was
//     already free, and paid for it in evidence the score actually needed.
//
// Measured on MoneyGym's 39-document room: the class round-robin spent its first slots on a director's
// resignation and two share-purchase agreements, and the budget ran out before the investor memo, the
// market analysis, the market sizing or any of the four competitor benchmarks. The scorer then reported
// "No market growth rates appear" with the market sizing document sitting unread.
//
// So: group by the rubric category a document can speak to, order those groups by weight, and take one
// from each before a second from any. Governance is in the list and always last — it is necessary
// paperwork that evidences almost nothing the rubric scores.
function orderForBudget(clean) {
  const deck = clean.filter(d => d.docType === 'pitch');
  // Drop duplicate renderings before anything is ranked, keeping the LONGEST text of each — the PDF and
  // the DOCX of one memo rarely extract identically and the fuller extraction is the better evidence.
  const best = new Map();
  for (const d of clean.filter(x => x.docType !== 'pitch')) {
    const k = dedupeKey(d.name);
    const prev = best.get(k);
    if (!prev || String(d.text || '').length > String(prev.text || '').length) best.set(k, d);
  }

  const groups = new Map();
  for (const d of best.values()) {
    const { v, k } = evidenceTag(d.name);
    if (!groups.has(k)) groups.set(k, { v, docs: [] });
    groups.get(k).docs.push(d);
  }
  // Stable throughout: the corpus must be byte-identical across all 22 calls or the prompt cache misses
  // and the run costs ~5x. Equal value falls back to the name; never to query order.
  const keys = [...groups.keys()].sort((a, b) => (groups.get(b).v - groups.get(a).v) || a.localeCompare(b));
  for (const k of keys) groups.get(k).docs.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const out = [...deck];
  for (let n = 0; ; n++) {
    const round = keys.map(k => groups.get(k).docs[n]).filter(Boolean);
    if (!round.length) break;
    out.push(...round);
  }
  return out;
}

function buildCorpus(docs = []) {
  const clean = (docs || [])
    .map(d => ({ name: String(d.name || 'document'), text: String(d.text || ''), docType: String(d.docType || 'dataroom') }))
    .filter(d => d.text.trim())
    .sort((a, b) => a.name.localeCompare(b.name));   // stable base order; orderForBudget decides the real one
  const ordered = orderForBudget(clean);

  const parts = [];
  let used = 0, included = 0, dropped = [], truncated = [];
  for (const d of ordered) {
    const head = `\n\n===== ${d.name} (${d.docType}) =====\n`;
    const room = Math.min(CORPUS_MAX_TOKENS - used, PER_DOC_MAX) - estTokens(head);
    if (room < MIN_USEFUL) { dropped.push(d.name); continue; }
    const cost = estTokens(head + d.text);
    if (used + cost <= CORPUS_MAX_TOKENS && estTokens(d.text) <= PER_DOC_MAX) {
      parts.push(head + d.text);
      used += cost; included++;
      continue;
    }
    // TOO BIG TO FIT IS NOT A REASON TO READ NONE OF IT. MoneyGym's financial model — the single
    // document the rubric leans on hardest — is ~50,000 tokens on its own, larger than the whole
    // budget, so it was skipped entirely and `financial` scored as unevidenced on a venture that had
    // supplied it. A head is partial evidence; nothing is no evidence, and the difference is the
    // range's whole ceiling.
    //
    // PER_DOC_MAX also stops one spreadsheet eating the budget: without it the base case would take
    // everything left and the unit economics, cap table and market sizing behind it would all drop.
    parts.push(head + d.text.slice(0, room * 4) + '\n[… truncated — this document is longer than the pre-screen reads]');
    used += room + estTokens(head); included++; truncated.push(d.name);
  }
  return { text: parts.join(''), tokens: used, included, dropped, truncated, total: clean.length };
}

module.exports = {
  estTokens, CORPUS_MAX_TOKENS, PER_DOC_MAX, MIN_USEFUL,
  evidenceTag, evidenceValue, dedupeKey, orderForBudget, buildCorpus,
};
