/**
 * _roomcheck — what the data room appears to be MISSING, before a two-hour assessment is spent on it.
 *
 * WHY IT MIRRORS THE RUBRIC AND INVENTS NOTHING. The scorer already decides, on every run, which of six
 * founder artefact classes are present — that IS `financial.files_complete`. This runs the same six classes
 * over the ingested text so the operator learns it in seconds instead of hours, and can go back to the
 * founder BEFORE committing the run. A checklist invented here instead would eventually disagree with the
 * score, and the score is the thing being sold.
 *
 * IT SAYS "WE CANNOT SEE IT", NEVER "YOU ARE MISSING IT". The rubric's UNION RULE lets a class be satisfied
 * inside any document, and its tie-break resolves arguable cases as PRESENT. So a text scan can produce a
 * false absence — a cap table inside a board pack, a price buried in a deck — and sending the operator to
 * chase a document the founder already supplied is worse than saying nothing. Matching is therefore generous,
 * and the wording stays honest about what it is: an indication from a keyword read, not the score.
 *
 * NOT A SCORE, AND IT MUST NEVER BE SHOWN AS ONE. No number comes out of here.
 */

// Each class: the rubric's own minimum test, expressed as patterns. `any` = one hit is enough;
// `need` = how many DISTINCT signal groups must hit (mirrors "at least TWO of these four").
const CLASSES = [
  {
    key: 'financial_model', label: 'Financial model',
    want: 'A projection over three or more periods with at least one revenue line and one cost line',
    groups: [[/\b(revenue|turnover|sales|mrr|arr|bookings)\b/i], [/\b(cost|expense|opex|cogs|burn|payroll|spend)\b/i], [/\b(year\s*[1-5]|fy\s*\d{2}|q[1-4]\s*20\d\d|month\s*\d{1,2}|20(2[5-9]|3\d))\b/i]],
    need: 3, files: /(financial.?model|forecast|projection|base.?case|p&l|budget)/i,
  },
  {
    key: 'unit_economics', label: 'Unit economics',
    want: 'At least two of: price or ARPU, CAC, churn or retention, LTV or payback',
    groups: [[/\b(arpu|acv|price per|pricing|subscription fee|per user per month|£\d|\$\d)/i], [/\b(cac|customer acquisition cost|cost per acquisition|cpa)\b/i], [/\b(churn|retention|cohort|lifetime)\b/i], [/\b(ltv|lifetime value|payback)\b/i]],
    need: 2, files: /(unit.?econ|ltv.?cac|cohort.?analys)/i,
  },
  {
    key: 'cost_basis', label: 'Cost basis',
    want: 'At least one cost line with where it comes from — a named vendor, a quoted rate, or a stated assumption',
    groups: [[/\b(assumption|assumed|quoted|rate card|per seat|per user|unit price|vendor|supplier|tariff|list price)\b/i], [/\b(cost|fee|charge|salary|headcount|licen[cs]e)\b/i]],
    need: 2, files: /(cost.?assumption|cost.?basis|rate.?card|vendor.?quote)/i,
  },
  {
    key: 'ownership', label: 'Ownership / cap table',
    want: 'Any statement of who owns what — a cap table, equity split, share register, SAFE or option schedule',
    groups: [[/\b(cap table|capitalisation table|capitalization table|share register|shareholding|equity split|option pool|safe note|convertible|founder equity|fully diluted|ordinary shares|stock purchase)\b/i]],
    need: 1, files: /(cap.?table|shareholding|share.?register|share.?purchase|stock.?purchase|option.?pool|safe.?note)/i,
  },
  {
    key: 'corporate_legal', label: 'Corporate / legal',
    want: 'Any one of: incorporation document, company number, articles, board minutes, shareholder or IP agreement',
    groups: [[/\b(certificate of incorporation|articles of association|company (number|registration)|companies house|board (resolution|minutes)|shareholders? agreement|ip assignment|bylaws|ein\b|incorporat)/i]],
    need: 1, files: /(incorporat|articles.?of|bylaw|board.?(resolution|minutes)|shareholders?.?agreement|cert.*incorporation|ip.?assignment)/i,
  },
  {
    key: 'observed_metrics', label: 'Observed metrics or primary research',
    want: 'At least one MEASURED number — not a forecast: pilot, waitlist, funnel, cohort, LOI, or primary interviews',
    // FIRST-PERSON ONLY. "Survey of Consumer Finances" (the Federal Reserve's) satisfied an earlier draft of
    // this, and bare words like "actual" or "achieved" appear in every deck ever written. The class asks for
    // a number THIS venture measured, so the evidence has to be the venture's own.
    groups: [[/\b(pilot|proof of concept|poc\b|waitlist|beta users|early access|trial users)\b/i, /\b(we (interviewed|surveyed|ran|piloted|tested)|our (survey|interviews|pilot|beta|waitlist)|primary research|user interviews we|n\s*=\s*\d+\s*(respondents|interviews|users))\b/i]],
    need: 1, files: /(user.?interview|primary.?research|pilot.?result|waitlist|traction|usage.?metrics)/i,
  },
];

// Document types that are not in the six classes, but that named criteria reward. Reported as "would
// strengthen", never as missing — the assessment runs perfectly well without them.
const STRENGTHENERS = [
  { key: 'loi', label: 'A signed LOI, pilot or customer contract', why: 'Demand validation scores highest when a counterparty outside the company has paid or committed in writing', pat: /\b(letter of intent|\bLOI\b|signed (a |an )?(pilot|customer|commercial) (agreement|contract) with|purchase order from)\b/ },
  { key: 'sensitivity', label: 'A sensitivity or scenario analysis', why: 'Full marks need five or more flexed variables and at least one case where two move adversely together', pat: /\b(sensitivity (analysis|table|case)|scenario (analysis|planning)|downside case|stress test)\b/i },
  { key: 'ip', label: 'Patent filings or an IP assignment', why: 'Defensibility scores on a filed patent, a proprietary dataset or a trade secret — not on a claim of being first', pat: /\b(patent (application|filed|pending|granted)|provisional patent|uspto|ip assignment|trade secret)\b/i },
  { key: 'milestones', label: 'A milestone-anchored use of funds', why: 'The ask scores on quantified milestones this round funds, not a runway figure', pat: /\b(use of funds|milestones? (for|this) (this )?round|what this round (funds|buys))\b/i },
];

/**
 * @param docs [{ name, text }] — the ingested data room (and deck).
 * @returns { classes: [{key,label,want,found,seenIn}], strengtheners: [...], docCount }
 */
function checkRoom(docs = []) {
  const corpus = docs.map(d => ({ name: String(d.name || ''), text: String(d.text || '') }));

  // A third-party industry report is not the venture's own evidence. `observed_metrics` asks for a number
  // MEASURED by this venture or its prior product, so benchmark and market papers are excluded from it —
  // otherwise any room containing a downloaded PDF passes a class about the founder's own traction.
  const THIRD_PARTY = /(benchmark|industry|state.?of|market.?report|insights.?report|whitepaper|white.?paper|multiples)/i;

  const hit = (cls) => {
    // A filename that unambiguously names the artefact counts on its own — the rubric's FILENAME RULE.
    const namePool = cls.key === 'observed_metrics' ? corpus.filter(d => !THIRD_PARTY.test(d.name)) : corpus;
    const byName = namePool.find(d => cls.files.test(d.name));
    if (byName) return { found: true, seenIn: byName.name, how: 'filename' };
    // Otherwise: how many distinct signal groups appear anywhere in the room.
    let groupsHit = 0; const where = new Set();
    const pool = cls.key === 'observed_metrics' ? corpus.filter(d => !THIRD_PARTY.test(d.name)) : corpus;
    for (const group of cls.groups) {
      const d = pool.find(doc => group.some(re => re.test(doc.text)));
      if (d) { groupsHit++; where.add(d.name); }
    }
    return groupsHit >= cls.need
      ? { found: true, seenIn: [...where][0] || '', how: 'content' }
      : { found: false, seenIn: '', how: '' };
  };

  return {
    docCount: corpus.length,
    classes: CLASSES.map(c => ({ key: c.key, label: c.label, want: c.want, ...hit(c) })),
    strengtheners: STRENGTHENERS
      .filter(s => !corpus.some(d => s.pat.test(d.text) || s.pat.test(d.name)))
      .map(s => ({ key: s.key, label: s.label, why: s.why })),
  };
}

module.exports = { checkRoom, CLASSES, STRENGTHENERS };
