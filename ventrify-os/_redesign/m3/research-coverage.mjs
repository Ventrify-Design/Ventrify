// ============================================================
// "NOTHING HIDDEN" GATE — proves the deep-research drill page shows EVERYTHING in the source document.
//
// It drives the REAL agent corpus (the markdown the research agents actually emit) through the REAL
// pipeline — researchRoom → researchDrillOpts → openDrill → renderArticle → DOM — and then diffs the
// rendered page against the source markdown:
//
//   structure : every ATX heading, every pipe table (with its row/col counts), every fenced code block,
//               every thematic break, every list item, every URL.
//   text      : ≥98% of the source's significant word tokens appear in the rendered text.
//   regression: the rendered text contains NO literal markdown (no `|` table rows, no ``` fences,
//               no leading `###`) — i.e. proof that mdToHtml is not on this path.
//   clipping  : nothing inside .art-body is line-clamped or overflow-hidden; no horizontal scroll.
//
// Falls back to the DS fixture bodies if the engagement-template corpus isn't on this machine.
// ============================================================
import puppeteer from '/Users/antonywhenman/Desktop/Ventrify/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PAGE = 'http://localhost:3200/_redesign/m3/assess.html';
const CORPUS = path.join(os.homedir(), 'Desktop/ventrify-engagement-template/engagements/prg-ecora-92y9');

// ---------- load the real corpus ----------
function loadCorpus() {
  const docs = [];
  for (const hub of ['research', 'assessment']) {
    const dir = path.join(CORPUS, hub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
      const body = fs.readFileSync(path.join(dir, f), 'utf8');
      const h1 = (body.match(/^#\s+(.+)$/m) || [])[1] || f.replace(/\.md$/, '');
      docs.push({ hub, name: f.replace(/\.md$/, ''), title: h1.trim(), level: 'L3', tag: 'L3', tagKind: 'info', body });
    }
  }
  return docs;
}

// ---------- source-side parsing (the ground truth) ----------
const STOP = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'not', 'but', 'its', 'has', 'had', 'you', 'all', 'can', 'our', 'their', 'they', 'have', 'been', 'will', 'more', 'than', 'into', 'over', 'only', 'also', 'which', 'when', 'what', 'were', 'them', 'then', 'there', 'would', 'could', 'about']);

function scan(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let fence = false;
  let headings = 0, fences = 0, hrs = 0, listItems = 0;
  let paraOpen = false, inList = false;   // CommonMark list-interruption state (see the ordered-list note)
  const tables = [];
  let cur = null;
  const isDelim = l => /^\s*\|?[\s:|-]{3,}\|?\s*$/.test(l) && l.includes('-');
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').length;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], prev = i > 0 ? lines[i - 1] : '';
    if (/^\s*```/.test(l)) { fence = !fence; if (fence) fences++; paraOpen = inList = false; continue; }
    if (fence) continue;
    if (l.trim() === '') { paraOpen = false; inList = false; continue; }
    if (/^#{1,6}\s+\S/.test(l)) { headings++; paraOpen = inList = false; continue; }
    // a thematic break needs a blank line above it; otherwise `---` is a setext heading
    if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l) && !l.trim().startsWith('|')) {
      if (prev.trim() === '') hrs++; else headings++;   // setext h2
      paraOpen = inList = false; continue;
    }
    // pipe table: header | delimiter | data rows
    if (/^\s*\|/.test(l) && isDelim(lines[i + 1] || '')) {
      cur = { cols: cells(l), rows: 1 };
      let j = i + 2;
      while (j < lines.length && /^\s*\|/.test(lines[j])) { cur.rows++; j++; }
      tables.push(cur); i = j - 1; paraOpen = inList = false; continue;
    }
    // CommonMark list-interruption: a BULLET may interrupt a paragraph, but an ORDERED item may only do
    // so when it starts at 1. So `3. Foo` written straight under a paragraph is paragraph TEXT, not a
    // list item — and `4. Bar` after it is a lazy continuation of that same paragraph. marked renders it
    // exactly this way, and so did the classic reader (also marked). Every word is still on the page —
    // the text-coverage check proves it — only the <li> markup differs. Track real list state, not lookback.
    const bullet = /^\s*[-*+]\s+\S/.test(l) && !l.trim().startsWith('|');
    const ord = l.match(/^\s*(\d+)[.)]\s+\S/);
    if (bullet) { listItems++; inList = true; paraOpen = false; continue; }
    if (ord) {
      if (inList || !paraOpen || ord[1] === '1') { listItems++; inList = true; paraOpen = false; }
      else paraOpen = true;                       // paragraph text, not a list item
      continue;
    }
    if (/^\s{2,}\S/.test(l) && inList) continue;   // indented continuation of a list item
    paraOpen = true; inList = false;
  }
  // every URL that will end up in an href or as autolink text
  const urls = [...md.matchAll(/https?:\/\/[^\s)<>\]]+/g)].map(m => m[0].replace(/[.,;]$/, ''));
  return { headings, fences, hrs, listItems, tables, urls: [...new Set(urls)] };
}

function tokenize(text, { isMarkdown } = {}) {
  let t = text.replace(/\r/g, '');
  if (isMarkdown) {
    t = t
      .replace(/^\s*```.*$/gm, ' ')                     // fence markers (code CONTENT stays — it renders)
      .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, ' ')      // table delimiter rows
      .replace(/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')// thematic breaks
      .replace(/^#{1,6}\s+/gm, ' ')                     // heading markers
      .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, ' $1 ');   // inline links: the URL lives in href, not text
  }
  return new Set(
    t.toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
  );
}

// ---------- run ----------
const corpus = loadCorpus();
const usingReal = corpus.length > 0;
if (!usingReal) console.log('⚠️  engagement-template corpus not found — falling back to the DS fixture bodies\n');

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2200));

// register the corpus as the reading room (or keep the fixture's own)
const registered = await page.evaluate(async docs => {
  const DS = await import('./ds.js');
  if (docs.length) {
    const room = DS.researchRoom(docs);
    window.__room = room;
    window.DRILL_PAGES = {};
    room.all.forEach(d => { window.DRILL_PAGES[d.slug] = () => DS.researchDrillOpts(d, room); });
  }
  return window.__room.all.map(d => ({ slug: d.slug, name: d.name, title: d.title, group: d.groupLabel }));
}, corpus);

const sourceOf = r => usingReal
  ? (corpus.find(c => c.name === r.name) || {}).body
  : null;

const results = [];
for (const r of registered) {
  await page.evaluate(s => window.openResearchDrill(s), r.slug);
  await page.waitForFunction(() => { const a = document.querySelector('.m3-drill .art-body'); return a && !a.hasAttribute('data-fill'); }, { timeout: 15000 }).catch(() => {});
  await new Promise(x => setTimeout(x, 200));

  const dom = await page.evaluate(() => {
    const art = document.querySelector('.m3-drill .art-body');
    if (!art) return null;
    const tables = [...art.querySelectorAll('table.dtbl')].map(t => ({
      rows: t.querySelectorAll('tr').length,
      cols: Math.max(...[...t.querySelectorAll('tr')].map(tr => tr.children.length)),
      wrapped: !!t.closest('.tbl-wrap'),
    }));
    // clipping audit
    const clipped = [...art.querySelectorAll('*')].filter(el => {
      const c = getComputedStyle(el);
      if (c.webkitLineClamp && c.webkitLineClamp !== 'none') return true;
      return c.overflow === 'hidden' && c.maxHeight !== 'none';
    }).map(el => el.tagName + '.' + el.className).slice(0, 5);
    const scroller = document.querySelector('.m3-drill .drill-scroll');
    return {
      headings: art.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
      pre: art.querySelectorAll('pre').length,
      hr: art.querySelectorAll('hr').length,
      li: art.querySelectorAll('li').length,
      tables,
      hrefs: [...art.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
      text: art.innerText,
      clipped,
      toc: document.querySelectorAll('.m3-drill .drill-toc .toc a').length,
      pager: document.querySelectorAll('.m3-drill .doc-pager .pager-side').length,
      drillHOverflow: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
      pageHOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

  const md = sourceOf(r);
  const fails = [];
  if (!dom) { fails.push('drill did not render'); results.push({ r, fails, cov: 0 }); continue; }

  if (md) {
    const s = scan(md);
    if (dom.headings !== s.headings) fails.push(`headings ${dom.headings} ≠ ${s.headings}`);
    if (dom.pre !== s.fences) fails.push(`code blocks ${dom.pre} ≠ ${s.fences}`);
    if (dom.hr !== s.hrs) fails.push(`hr ${dom.hr} ≠ ${s.hrs}`);
    if (dom.tables.length !== s.tables.length) fails.push(`tables ${dom.tables.length} ≠ ${s.tables.length}`);
    else s.tables.forEach((t, i) => {
      if (dom.tables[i].rows !== t.rows) fails.push(`table${i + 1} rows ${dom.tables[i].rows} ≠ ${t.rows}`);
      if (dom.tables[i].cols !== t.cols) fails.push(`table${i + 1} cols ${dom.tables[i].cols} ≠ ${t.cols}`);
      if (!dom.tables[i].wrapped) fails.push(`table${i + 1} not in .tbl-wrap`);
    });
    if (dom.li < s.listItems) fails.push(`list items ${dom.li} < ${s.listItems}`);
    const missingUrls = s.urls.filter(u => !dom.hrefs.some(h => h === u) && !dom.text.includes(u));
    if (missingUrls.length) fails.push(`${missingUrls.length} URL(s) missing e.g. ${missingUrls[0]}`);
  }

  // anti-regression: no literal markdown leaked into the text
  if (/\n\s*\|.*\|/.test(dom.text)) fails.push('literal | table row in rendered text (mdToHtml on the path?)');
  if (dom.text.includes('```')) fails.push('literal ``` fence in rendered text');
  if (/^\s*#{2,}\s/m.test(dom.text)) fails.push('literal ### heading in rendered text');
  if (dom.text.includes('\\~')) fails.push('leaked tilde escape (\\~) in rendered text');

  // clipping / overflow
  if (dom.clipped.length) fails.push(`clipped element(s): ${dom.clipped.join(', ')}`);
  if (dom.drillHOverflow) fails.push('drill scroller overflows horizontally');
  if (dom.pageHOverflow) fails.push('page overflows horizontally');

  // text coverage
  let cov = 1;
  if (md) {
    const S = tokenize(md, { isMarkdown: true });
    const R = tokenize(dom.text, {});
    const missing = [...S].filter(w => !R.has(w));
    cov = S.size ? (S.size - missing.length) / S.size : 1;
    if (cov < 0.98) fails.push(`text coverage ${(cov * 100).toFixed(1)}% — missing e.g. ${missing.slice(0, 8).join(', ')}`);
  }
  results.push({ r, fails, cov, dom });
}

// ---------- report ----------
console.log(`\n════════ RESEARCH COVERAGE GATE ${usingReal ? '(real agent corpus)' : '(DS fixture)'} ════════\n`);
let bad = 0;
for (const { r, fails, cov, dom } of results) {
  const ok = fails.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${r.title}  ${dom ? `[${dom.headings}h ${dom.tables.length}tbl ${dom.pre}pre ${dom.hr}hr ${dom.li}li ${dom.toc}toc]` : ''} ${cov < 1 ? `cov ${(cov * 100).toFixed(1)}%` : ''}`);
  fails.forEach(f => console.log(`      ↳ ${f}`));
}
console.log(`\n${bad === 0 ? '✅ NOTHING HIDDEN' : `❌ ${bad} DOCUMENT(S) LOSE CONTENT`}  (${results.length - bad}/${results.length} documents)`);
if (jsErrors.length) console.log('\nJS errors:', [...new Set(jsErrors)]);
await browser.close();
process.exit(bad ? 1 : 0);
