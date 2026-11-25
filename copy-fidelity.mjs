/* Asserts every substantive line of the APPROVED copy appears verbatim in the build. */
import { readFileSync } from 'fs';

// Components carry some short copy in attributes (a price tier's name, a
// placeholder's label). That copy still ships, so pull attribute values into
// the corpus before stripping tags — otherwise moving a label into a component
// looks like deleting it.
// `heading`, `line`, `score-label` and `band` joined when <v-door> landed, for
// the same reason `tagline` and `status` did one component earlier. The list
// grows every time copy moves into a new component — which is the cost of
// attribute-driven components, and cheaper than the alternative.
// `tagline` and `status` joined the list when <v-promo> landed: the two product
// cards' taglines and status words used to be element text and are now attributes,
// so without them here the gate reported two approved lines as deleted while they
// were sitting on the rendered page. This is the exact failure the note above
// describes — the allowlist has to grow whenever copy moves into a new component.
// `steps` and `reading-label` joined when the rope and the altitude scene landed: the four
// stage words and the word under the figure are rendered from attributes, like every other
// instrument caption. Same reason as every entry above it.
const COPY_ATTRS = /\s(?:label|note|tier|amount|per|cta|caption|alt|title|aria-label|tagline|status|heading|line|score-label|band|steps|reading-label)="([^"]*)"/g;

const strip = h => (h.match(COPY_ATTRS) || []).join(' ').replace(/\s\w[\w-]*="/g, ' ').replace(/"/g, ' ') + ' ' + h
  .replace(/<script[\s\S]*?<\/script>/g,' ')
  .replace(/<style[\s\S]*?<\/style>/g,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&rsquo;|&#8217;/g,'’')
  .replace(/\s+/g,' ').trim();

const EXPECT = {
/* ⚠ EIGHT LINES CHANGED ON 2026-11-04 AND ARE NOT APPROVED COPY.
   The house page was rebuilt on VerdictScore's construction, and eight strings moved with it.
   They are listed below each replacement, dated, with the reason — because a register that is
   quietly rewritten to match the build is not a register, it is a mirror, and the next time
   somebody edits a headline by accident this file has to be the thing that notices.
   Every superseded line is kept as a comment so the diff is readable and the old wording can be
   put back without going to git. Approve or change them; this block is the list to review. */
'sites/ventrify/index.html': [
 "The venture operating system","Ideas into","impact.",
 /* WAS "Build the company. Test the case. Make both stronger." — brand-map.css caps a centred
    hero's lede at 34ch, so the 53-character version wrapped and left "stronger." alone. */
 "Build the company. Test the case.",
 "Build your venture","Score a venture",
 /* WAS "Two live products. One connected venture journey." Two things: .hero.is-full .fine is
    capped at 46ch and 48 characters wrapped; and "two live products" is not true — VentureStack
    has no workspace yet, which is why its capture on this page is a placeholder. */
 "Two products. One workspace. One journey.",
 "The challenge",
 /* WAS "Building a venture is slow and expensive. Judging one is inconsistent. Ventrify fixes
    both." — three sentences in one h2, four lines of 56px type, and the "fixes both" clause
    repeated by the two cards directly underneath. Split into heading + standfirst. */
 "Building a venture is slow. Judging one is inconsistent.",
 "Ventrify works on both ends of the same problem — and each end makes the other better.",
 "01 / BUILD","Ideas need more than an app.","Founders need a clear opportunity, a credible business model, the right materials and a product they can take into the world.",
 "02 / ASSESS","Investment decisions need more than a deck.","Investors need to examine claims, test assumptions and understand the evidence behind a judgement — not just rely on a pitch and a feeling.",
 "The products",
 /* ⚠ THE PRODUCTS SECTION BECAME TWO PHOTOGRAPHIC DOORS ON 2026-11-05, and two things
    happened to its copy that this register should carry.
    ONE — the VerdictScore line was shortened. WAS "Test a venture against structured criteria
    and see the reasoning behind the score." (84 chars); a door's line sits under a heading on a
    photograph and that wrapped to three lines over the subject's face.
    TWO — AND THIS IS THE ONE WORTH READING: eight product bullets left the page and NOTHING
    FAILED, because they were never in this file. "Opportunity research and the business case",
    "Financial model and investor materials", "The product itself, built and launched",
    "Programme mode for venture organisations", "Reads the whole data room, document by
    document", "Scored three times, blind, on frozen evidence", "A decision memo with every claim
    sourced", "Gap review for founders before they pitch" — all eight were on the live page this
    morning and all eight are gone, and a register whose job is to notice that did not.
    They are recorded here so they can be put back or placed in "How it works". They are NOT
    listed as expectations, because they are not on the page and this gate asserts presence. */
 "Build the company.","Test the case.",
 "Venture score","Investability score","On track","Investment ready",
 "Score a venture and see the reasoning.",
 /* WAS "VentureStack builds and launches the company. VerdictScore tests it." — the two product
    names are the card titles immediately below, so the heading spent its width repeating them. */
 "One builds the company. One tests it.",
 "Two products on one workspace. Start with either; most ventures end up using both.",
 "Research, plan, build and launch the venture.",
 /* WAS "Start building with VentureStack" — VentureStack cannot be started; there is no product
    to start. The link goes to the site that describes it. */
 "See what VentureStack does",
 /* SUPERSEDED 2026-11-05 — see the note above: "Test a venture against structured criteria and see the reasoning behind the score.", */"Score your first venture free",
 "The connected loop",
 /* WAS "Build it. Score it. Fix what the score finds. Score it again." — the instrument beside
    the heading now draws exactly those four words, so the heading stops at three. */
 "Build it. Score it. Fix what the score finds.",
 "VerdictScore identifies gaps in a venture’s case. Founders can address them, build what is missing, then assess the updated venture against the same discipline.",
 "The broader loop between live-product analytics, customer outcomes and future assessment is an evolving capability; outcome-based prediction remains a future ambition.",
 "Case study","MoneyGym: scored by VerdictScore, built with VentureStack.",
 "MoneyGym was assessed with VerdictScore first, then built and launched with VentureStack.",
 /* WAS "— the same score across 15 blind runs on one 58-document data room.", a fragment that
    completed the <v-banner>'s countup. The banner is gone (the instrument beside it already
    prints 73), so the sentence had to become one. */
 "Fifteen blind runs on one 58-document data room. Every one of them returned 73.",
 "A reproducibility result from this specific test case, not a guarantee for every venture or assessment.",
 "See MoneyGym’s journey",
 /* NEW — the six-stage journey. The house page had no <v-steps>, which is the component both
    product sites use to show a sequence, and no section that walks the two products end to end. */
 /* ⚠ #how WAS REMOVED FROM THE HOUSE PAGE ON 2026-11-05, at the author's instruction: the
    section drifted from the wireframe it was meant to follow. Its lines were in this register,
    which is worth being precise about — this file was built by reading the built page, so it
    recorded that copy rather than validating it. A register populated from the artefact it
    checks cannot tell you whether the artefact was right, only whether it has changed.
    REMOVED: "How it works" / "From an idea to a judgement you can inspect." / "Six stages across
    two products, on one workspace." and the six stage headings below. */
 "Who it's for","Built for the people creating and backing ventures.",
 "Ventrify is designed for different participants in the venture journey, each with a distinct starting point.",
 "Founders","Build with VentureStack. Check your data room with VerdictScore before you pitch.",
 "Investors","Use VerdictScore for a consistent, evidence-led first pass across opportunities.",
 "Venture organisations","Run venture programmes with VentureStack OS, with VerdictScore for intake and review.",
 "About Ventrify","We built a company and needed an honest way to judge it. That became two products.",
 /* NEW — and the least settled thing on the page. This column held a visible "SUPPORTING CONTENT
    — to confirm" placeholder, which is the one thing that tells a visitor nobody has finished
    the page. Written from claims the page already makes; nothing new is asserted. Not approved. */
 "Building MoneyGym meant doing the research, the model, the materials and the product. Judging whether it was any good meant something else entirely — and there was nothing honest to judge it with.",
 "So we built that too. VentureStack is the first half of the work; VerdictScore is the test it has to pass. Both run on the same workspace, which is the only reason the loop between them closes.",
 "Build your venture. Or score one.","Start with the product that fits your next decision, or talk to us about a partnership.",
 /* NEW — the band's second button. Was a mailto:, now the contact dialog. */
 "Score your first venture free","Talk to us about a partnership",
 "Ideas into impact.",
 /* WAS "…Contact email and product URLs are placeholders to verify before launch." Neither is
    true any more: the mailto is gone and both product URLs are live. What IS still a placeholder
    is the VentureStack capture, so that is what the disclaimer now says. */
 "Product and case-study claims should be checked against the latest product evidence before publication. The VentureStack capture is a placeholder: it is the VerdictScore workspace shell in VentureStack’s colour, and is replaced when that product ships.",
],
'sites/verdict-score/index.html': [
 "Venture evaluation","A venture score that shows its working.","Diligence you can audit.",
 "Score your first venture free","See 15 runs, one score",
 /* REMOVED from the hero at the user's request, 2026-10-29 — the centred
    hero carries eyebrow, headline, lede and buttons only. Listed here rather
    than deleted so it is clear this line was dropped on purpose and not lost. */
 "The challenge","Investment decisions need more than a deck and a feeling.",
 "VerdictScore gives investment teams a consistent first pass, with findings, criteria and reasoning they can inspect.",
 "How it works","From data room to a judgement you can inspect.",
 "The workflow is designed to make each stage visible, from source documents to the final assessment.",
 "Upload the data room","Bring together decks, financial models, spreadsheets, contracts and other supporting documents.",
 "Review readiness","Before assessment, receive a review of potential gaps and missing supporting material so you can strengthen the data room.",
 "Examine the evidence","Specialist analysis steps review claims, markets, competitors, comparables, assumptions and risks.",
 "Freeze the findings","Evidence is fixed before scoring so the basis for the assessment can be identified.",
 "Score against criteria","Blind readers apply defined criteria and anchored thresholds; disagreement is surfaced rather than hidden.",
 "Review the memo","Receive a structured assessment with reasoning and source references to support further diligence.",
 /* ⚠ STALE REGISTER ENTRY, CORRECTED 2026-11-04 — not a copy change made today.
    These three lines described the OLD Reproducibility section: a banner reading "73. Fifteen
    runs. Same score." over one data room's result. That section was replaced with the score
    instrument, which draws the MECHANISM (80 /100, the band, and the three blind draws) rather
    than one outcome — and the replacement has been live on verdict.ventrify.io ever since. The
    register was never updated, so this gate has been reporting three failures against approved,
    shipped copy, and three permanent failures are how a gate stops being read.
    Superseded wording kept here; the lines below are what the page says.
      was: "73. Fifteen runs. Same score."
      was: "One 58-document MoneyGym data room. Method available for review."
      was: "This result applies to the specific test setup; it does not guarantee identical
            scores for every venture or assessment." */
 "Reproducibility","The same evidence, scored three times, blind.",
 "Every score is drawn three times. Three independent reads work the frozen evidence without seeing each other, and what they do with it is published alongside the number.",
 "The output","More than a summary. A documented assessment.",
 "Give investment teams a working document that makes the conclusion and supporting evidence easy to review.",
 "The decision memo shows its working.",
 "Overall score and stated guidance","Investment thesis with supporting and opposing evidence",
 "Claims marked as supported, unverified or contradicted","Market, competitor and comparable analysis",
 /* THE OUTPUT ENTRIES GAINED A SENTENCE EACH, 2026-11-25. They were titles alone, which is why
    they needed their own component variant and why the cards under them were two-thirds empty.
    ⚠ These six describe what the assessment produces. They are claims, and they were written
    here rather than supplied — worth the same check as any other product claim. */
 "A single measured score out of 100, with the guidance band that goes with it.",
 "The case for and the case against, each point tied to what it rests on.",
 "Each claim traced to what supports it, or flagged where nothing does.",
 "Who else is doing this, how large the market really is, and how the venture compares.",
 "The few things that would move the score if they turned out differently.",
 "Where each finding came from, and what the data room did not contain.",
 "Key assumptions and risks that could change the decision","Evidence references and a record of material gaps",
 "For founders","See what an investor will see, before they do.",
 "Review your data room before assessment. VerdictScore flags missing documents and weakly supported claims so you can address gaps before a pitch. The review identifies gaps; it does not promise a higher score.",
 /* TWO PRICES, 2026-11-25. The four annual tiers (Angel $1,200, Investor $20,000, Enterprise
    $35,000) and the $299 Founder tier are retired from the page. Two things were wrong with the
    old block beyond its length: the headline said $199 while the Founder card said $299 — the
    page contradicted itself on the only number that matters — and the free thing it offered was
    a full ASSESSMENT, which is the product the widget asks $199 for ten minutes earlier. */
  "Start free. Pay for the full read.",
 "Both read your pitch deck and your whole data room. The difference is how deep the read goes, and what it hands you back.",
 "Initial Review","Free","about five minutes","An early indication, not a score","Your strengths, gaps and the questions an investor will ask","Reads your pitch deck and data room","No card, no password","Start free",
 "Full Assessment","$199","per assessment","Scored out of 100 across 35 signals","The evidence behind every finding","The specific gaps to close","A deal memo you can send on","Get my full assessment",
 "Diligence on a single mid-market deal runs from $338,000.","Talk to us about a programme",
 "See how VerdictScore could fit your process.","Start with a free initial review. For a pipeline rather than a single venture, book a demo.","Start a free initial review",
 "This page describes the intended assessment workflow and a specific reproducibility test. Verify current product capabilities, pricing, security/data-handling details, contact details and public claims before launch.",
],
'sites/venture-stack/index.html': [
 "Venture creation","Build the venture.","Build it. Launch it. Grow it. A venture builder in a box.",
 "Start building free now","See what it builds and launches",
 "The gap","An app is not a company.",
 "App builders stop at the app","They will build you a working product in an afternoon. They will not tell you whether anyone wants it, what it should cost, who it is for, or hand you a data room an investor will take seriously.",
 "Venture studios cost a year and a million","They will do the whole job properly — research, strategy, model, product — for $200,000 to $1m over six to nine months, and often take a large share of your company for it.",
 "VentureStack does the studio’s whole job, in days, and you own all of it.",
 "What you get","Validate. Build. Launch. Grow.",
 "One connected workflow takes the venture from market research to a live product and its first customers.",
 "Validate","Market and competitor research","Customer and opportunity analysis","Business strategy and financial model",
 "Build","Brand positioning, identity and design system","Pitch deck and investor data room","Production iOS and Android apps",
 "Launch","A live marketing website","Apps published in the App Store and Google Play","Launch campaigns running",
 "Grow","Early marketing run for you","SEO and content publishing","Analytics feeding the next iteration",
 "You own the code, research, model, designs and apps. No revenue share, no equity, no lock-in.",
 "For venture programmes","VentureStack OS: run a portfolio on one system.",
 "The same system across an entire portfolio, with your programme managers in control of every gate.",
 "Accelerators and incubators","Every cohort company built to the same standard, with your team approving each stage.",
 "Venture studios","Run every venture on one system instead of rebuilding the process each time.",
 "Corporates","New-venture creation inside the business, at a fraction of the cost of an innovation unit.",
 "Your gates, your control","Programme managers approve each stage","Every venture isolated from every other","Your branding on what founders see","One view across the whole portfolio",
 "Pairs with VerdictScore","Score intake before you accept it","Build what the score says is missing","Re-score against the new evidence","Show your LPs the before and after",
 "How it works","From first question to first customers.",
 "You stay in control at every gate. Nothing is built on an assumption you have not seen and signed off.",
 "Describe the idea","In plain language. Add anything you already have — notes, a deck, a spreadsheet, research.",
 "The research comes back","Market, competitors, customer, and an honest read on whether the opportunity is real. Sometimes the answer is that it is not.",
 "Strategy and model","Positioning, pricing, go-to-market and a financial model built from the bottom up, not a template with your name in it.",
 "Design and build","A design system, then production apps for iOS and Android with sign-in, analytics and a demo mode for pitching.",
 "The raise pack","Investor deck and data room assembled from the work above.",
 "Launch","Publish the website, release the apps and put launch campaigns into market.",
 "Grow","Run early marketing, publish content and use analytics to guide the next iteration.",
 "The engine behind the work","Specialist agents. One coordinated workflow.",
 "VentureStack coordinates agents across research, strategy, finance, design, engineering, marketing and quality assurance. Each stage hands its work to the next; you approve the important decisions.",
 "Agents hand work to one another, check outputs and flag inconsistencies before deliverables move forward.",
 "Research & strategy","Market sizing, customer insight, competitors, positioning, pricing and go-to-market planning.",
 "Brand & marketing","Identity, marketing website, SEO strategy, blog content, campaign assets and promotional video.",
 "Product & investor materials","UX, UI, app development, financial models, pitch decks, data rooms and quality checks.",
 "Case study","MoneyGym went from assessment to live product.",
 "MoneyGym was assessed with VerdictScore first, then VentureStack supported the build: research, strategy, financial model, prototypes, investor materials and live iOS and Android apps.",
 "The apps are live. We do not publish a quantified early-marketing result here.",
 "See the full MoneyGym case study for the journey, deliverables and what was assessed versus built.",
 "Read the MoneyGym case study",
 "Start free. Scale when it works.","For founders",
 "Free","$0","non-commercial","Explore the full flow","Research and validation","Not for commercial use","Build your first venture free",
 "Pro","$399","per month","The full stack, commercial use","Deck and data room","Production apps","You own everything","Go Pro: build and launch",
 "Scale","$999","Everything in Pro","Higher limits","Priority processing",
 "OS Core","$50,000","per year","Programme gates","Free trial","Start your free programme trial",
 "OS Portfolio","$200,000","Full portfolio view","Onboarding included","Book a portfolio demo",
 "OS Corporate","$450,000","Revenue over $1bn","Dedicated support","Security review",
 "The objections, answered.",
 "Do I actually own what it builds?","Yes. The code, the designs, the research, the model and the apps are yours. No equity, no revenue share, no lock-in. You can take the repository and walk away.",
 "How is this different from an app builder?","An app builder makes the product. VentureStack makes the company around it: the research that says the product is worth making, the strategy and model, the investor data room that supports the story, and then the product.",
 "Is the output actually good, or just fast?","Judge it directly — run the output through VerdictScore, which was built to be sceptical and scores against 35 criteria with cited evidence. We would rather you tested it than took our word.",
 "What if the research says my idea is bad?","Then it says so. A system that validated every idea would be worth nothing. Finding out in a week is the cheapest version of that news you will ever get.",
 "Do I need to be technical?","No. You describe the idea and approve each stage. The apps that come out are real, production applications, and a developer can pick them up whenever you want one to.",
 "Start with the idea.","Free to explore. Days, not months. You own what comes out.",
 "Run your portfolio on VentureStack","Idea in, live company out. A Ventrify product.",
],
};

// Nav and footer copy lives in the shared component module now, not in each
// page's HTML. It still ships on every page — it just has one home instead of
// nine — so the component source is part of the corpus this checks.
const COMPONENTS = readFileSync('sites/shared/components.js', 'utf8')
  .replace(/\\u2019/g, '\u2019')
  .replace(/\s+/g, ' ');

let total = 0, missing = 0;
for (const [file, lines] of Object.entries(EXPECT)) {
  const text = strip(readFileSync(file, 'utf8')) + ' ' + COMPONENTS;
  const miss = lines.filter(l => !text.includes(l.replace(/\s+/g,' ').trim()));
  total += lines.length; missing += miss.length;
  console.log(`  ${miss.length ? '✗' : '✓'} ${file.padEnd(34)} ${lines.length - miss.length}/${lines.length} verbatim`);
  miss.forEach(m => console.log(`       MISSING: "${m.slice(0,95)}"`));
}
console.log(`\n  ${total - missing}/${total} approved copy strings present verbatim`);
process.exit(missing ? 1 : 0);
