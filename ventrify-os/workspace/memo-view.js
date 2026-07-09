// ============================================================
// memo-view.js — the PURE deal-memo renderer + its helpers.
// Extracted VERBATIM from workspace/program.html so the classic page AND the M3
// assess-next detail produce the identical branded, print-to-PDF deal memo.
// Zero DOM, zero network. (recColor / assessmentConfidence exported for reuse.)
// ============================================================
import { esc } from '../shared/util.js';
import { MAX_POSSIBLE } from '../shared/vss-rubric.js';
const escBrief = esc;

export function recColor(rec) {
  const r = String(rec || '').toLowerCase();
  if (r.startsWith('invest') || r.includes('back')) return '#00897b';
  if (r.startsWith('pass') || r.includes('decline')) return '#C0392B';
  return '#C77700'; // diligence further / conditional
}

export function assessmentConfidence(p, snap) {
  const docN = Math.max((p.founderDocCount || 0), (p.pitchDoc ? 1 : 0));
  const hasDataRoom = Math.max(0, docN - (p.pitchDoc ? 1 : 0)) > 0;
  const sourcesN = (p.assessment && p.assessment.provenance && p.assessment.provenance.sources) || 0;
  const cats = (snap && snap.categories) || [];
  const ratedCount = (snap && snap.ratedCount != null) ? snap.ratedCount
    : cats.reduce((n, c) => n + (c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length), 0);
  const scored = ratedCount > 0;
  const frac = ratedCount / 35;
  const pts = (frac >= 0.8 ? 2 : frac >= 0.55 ? 1 : 0) + (hasDataRoom ? 1 : 0);
  const level = !scored ? '' : (pts >= 3 ? 'High' : pts >= 2 ? 'Medium' : 'Low');
  const inputBadge = hasDataRoom ? `Full data room · ${docN} document${docN === 1 ? '' : 's'}` : (p.pitchDoc ? 'Deck only' : '');
  return { level, scored, docN, hasDataRoom, sourcesN, ratedCount, inputBadge };
}

const DIL_TIERS = { blocker: { label: 'Blocker', dot: 'fill' }, key: { label: 'Key', dot: 'fill' }, standard: { label: 'Standard', dot: 'hollow' } };
const DIL_NORM = {
  critical: 'blocker', blocker: 'blocker', blocking: 'blocker', dealbreaker: 'blocker', must: 'blocker', musthave: 'blocker', p0: 'blocker', urgent: 'blocker', showstopper: 'blocker', gate: 'blocker',
  high: 'key', hi: 'key', important: 'key', major: 'key', p1: 'key', key: 'key', significant: 'key',
  medium: 'standard', med: 'standard', moderate: 'standard', normal: 'standard', p2: 'standard', low: 'standard', lo: 'standard', minor: 'standard', optional: 'standard', p3: 'standard', standard: 'standard', routine: 'standard'
};
function dilTier(pr) {
  const s = String(pr == null ? '' : pr).toLowerCase();
  return DIL_NORM[s.replace(/[^a-z0-9]+/g, '')] || DIL_NORM[(s.split(/[^a-z0-9]+/).filter(Boolean)[0]) || ''] || 'standard';
}
function dilParse(txt) {
  const m = String(txt).match(/^(.*?\S)\s+[—–-]\s+([\s\S]*)$/);
  const label = m ? m[1].trim() : String(txt).trim();
  let clauses = (m ? m[2].trim() : '').split(/\s*;\s*/).map(c => c.trim()).filter(Boolean);
  let noWire = false;
  clauses = clauses.filter(c => { if (/no wire without this/i.test(c)) { noWire = true; return false; } return true; });
  return { label, clauses, noWire };
}

export function dealMemoHTML(p, snap, org, opts) {
  opts = opts || {};
  const shared = !!opts.shared;   // shared (hosted, read-only) vs downloaded (self-print) variant
  const a = p.assessment || {};
  const esc = escBrief;
  const brand = (org && org.primaryColor) || '#0036FF';
  const orgName = (org && org.name) || 'Ventrify';
  const rc = recColor(a.recommendation);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sec = (title, inner) => inner ? `<section class="m-sec"><h2>${esc(title)}</h2>${inner}</section>` : '';
  const list = (items, color) => (items || []).length ? `<ul class="m-list">${items.map(i => `<li${color ? ` style="--mk:${color}"` : ''}>${esc(i)}</li>`).join('')}</ul>` : '';

  // Score
  let scoreBlock = '';
  if (snap && (snap.pct != null || snap.composite != null)) {
    const pct = snap.pct != null ? snap.pct : Math.round((snap.composite / (snap.maxPossible || MAX_POSSIBLE)) * 100);
    const bandWord = String(snap.bandLabel || snap.band || '').split(/\s*[—–-]\s*|\s+/)[0];
    scoreBlock = `<div class="m-score"><div class="m-score-pct">${esc(pct)}<span>%</span></div><div class="m-score-meta">${esc(snap.composite)} / ${esc(snap.maxPossible || MAX_POSSIBLE)}${bandWord ? ` · ${esc(bandWord)}` : ''}<div class="m-score-cap">Investability</div></div></div>`;
  }
  // Confidence line for the forwarded memo (same model as the on-screen verdict).
  const mcf = assessmentConfidence(p, snap);
  const mcfItems = [];
  if (mcf.level) mcfItems.push(`Confidence: ${mcf.level}`);
  if (mcf.inputBadge) mcfItems.push(mcf.inputBadge);
  if (mcf.sourcesN) mcfItems.push(`${mcf.sourcesN} source${mcf.sourcesN === 1 ? '' : 's'} cited`);
  mcfItems.push(mcf.scored ? `${mcf.ratedCount} of 35 signals rated` : 'scored across 35 signals');
  const confBlock = `<p class="m-confidence">${mcfItems.map(esc).join(' · ')}</p>`;
  // Operator sign-off — the human endorsement that turns an AI-assisted read into a
  // reviewed one. Carried into the forwarded memo so the IC sees who stood behind it.
  const so = p.assessmentSignoff;
  const soDate = so && so.at ? new Date(so.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const signoffBlock = (so && so.by)
    ? `<div class="m-signoff"><div class="m-signoff-h"><span class="m-signoff-tick">✓</span> Reviewed &amp; signed off by <strong>${esc(so.by)}</strong>${soDate ? ` · ${esc(soDate)}` : ''}</div>${so.note ? `<div class="m-signoff-n">${esc(so.note)}</div>` : ''}</div>`
    : '';
  const ask = a.theAsk || a.the_ask;
  const risk = a.biggestRisk || a.biggest_risk;
  const must = a.mustBeTrue || a.must_be_true || [];

  // Bull / bear
  const bb = (a.bull || []).length || (a.bear || []).length
    ? `<div class="m-two"><div><h3 style="color:#00897b">The case to invest</h3>${list(a.bull, '#00897b') || '<p class="m-dim">—</p>'}</div><div><h3 style="color:#C0392B">The case to pass</h3>${list(a.bear, '#C0392B') || '<p class="m-dim">—</p>'}</div></div>` : '';

  // Valuation
  const v = a.valuation || {};
  const vComps = (v.comps || []).length ? `<table class="m-tbl"><tbody>${v.comps.map(c => `<tr><td><strong>${esc(c.name || '')}</strong>${c.stage ? ` <span class="m-dim">${esc(c.stage)}</span>` : ''}</td><td>${esc(c.detail || c.valuation || '')}</td></tr>`).join('')}</tbody></table>` : '';
  const valBlock = (v.verdict || v.note || vComps) ? `${v.verdict ? `<p><strong>Verdict:</strong> ${esc(v.verdict)}</p>` : ''}${v.note ? `<p>${esc(v.note)}</p>` : ''}${vComps}` : '';

  // Market + rounds
  const m = a.market || null;
  const rounds = a.rounds || [];
  const tier = (t, l) => t ? `<div class="m-tier"><div class="m-tier-v">${esc(t.value)}</div><div class="m-tier-l">${esc(l)}</div></div>` : '';
  const marketBlock = (m || rounds.length) ? `${m ? `<div class="m-tiers">${tier(m.tam, 'TAM')}${tier(m.sam, 'SAM')}${tier(m.som, 'SOM')}</div>${m.note ? `<p>${esc(m.note)}</p>` : ''}` : ''}${rounds.length ? `<table class="m-tbl"><thead><tr><th>Company</th><th>Stage</th><th>Raised</th><th>Valuation</th><th>Lead / investors</th></tr></thead><tbody>${rounds.map(r => `<tr><td>${esc(r.company || '')}</td><td>${esc(r.stage || '—')}</td><td>${esc(r.amount || '—')}</td><td>${esc(r.valuation || '—')}</td><td>${esc(r.investors || '—')}</td></tr>`).join('')}</tbody></table>` : ''}` : '';

  // Benchmark
  const b = a.benchmark || null;
  const benchBlock = (b && (b.competitors || []).length) ? `${b.note ? `<p class="m-dim">${esc(b.note)}</p>` : ''}<table class="m-tbl"><thead><tr><th>Company</th>${(b.dimensions || []).map(d => `<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${b.competitors.map(c => `<tr${c.isTarget ? ' class="m-target"' : ''}><td><strong>${esc(c.name)}</strong>${c.isTarget ? ' ◂ this' : ''}</td>${(b.dimensions || []).map(d => `<td>${esc((c.cells || {})[d] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';

  // Exit
  const e = a.exit || {};
  const exitBlock = (e.path || (e.acquirers || []).length || e.returns) ? `${(e.acquirers || []).length ? `<p><strong>Likely acquirers:</strong> ${e.acquirers.map(esc).join(' · ')}</p>` : ''}${e.path ? `<p><strong>Path:</strong> ${esc(e.path)}</p>` : ''}${e.returns ? `<p><strong>Returns:</strong> ${esc(e.returns)}</p>` : ''}` : '';

  // Team
  const t = a.team || {};
  const sig = s => s === 'positive' ? '#00A368' : s === 'flag' ? '#C42233' : '#888';
  const teamBlock = ((t.members || []).length || t.summary) ? `${t.summary ? `<p class="m-dim">${esc(t.summary)}</p>` : ''}${(t.members || []).map(mm => `<div class="m-member"><span class="m-dot" style="background:${sig(mm.signal)}"></span><div><strong>${esc(mm.name)}</strong>${mm.role ? ` — ${esc(mm.role)}` : ''}<div class="m-dim">${esc(mm.background || '')}</div></div></div>`).join('')}${(t.gaps || []).length ? `<p style="margin-top:8px"><strong>Gaps:</strong> ${t.gaps.map(esc).join(' · ')}</p>` : ''}` : '';

  // Investability breakdown
  const cats = (snap && snap.categories) || [];
  // Mirror the on-screen scorecard EXACTLY: each category is a fraction of its
  // RATED sub-criteria (sum / rated), not sum / max — build-only signals are
  // nulled by the runner, so dividing by max (5) understates the score and the
  // PDF would disagree with the app (and the headline %).
  const catBlock = cats.length ? `<table class="m-tbl m-cat"><tbody>${cats.map(c => { const rated = c.rated != null ? c.rated : (c.subs || []).filter(s => s.score != null).length; const pc = rated ? Math.round((c.sum / rated) * 100) : 0; return `<tr><td>${esc(c.label)}</td><td class="m-bar"><span style="width:${pc}%;background:${brand}"></span></td><td class="m-num">${esc(c.sum)} / ${esc(rated)}</td></tr>`; }).join('')}</tbody></table>` : '';

  // Diligence
  const dil = a.diligence || [];
  let dilBlock = '';
  if (dil.length) {
    const order = ['blocker', 'key', 'standard'];
    const buckets = { blocker: [], key: [], standard: [] };
    dil.forEach(it => buckets[dilTier(it.priority)].push(it));
    dilBlock = order.filter(k => buckets[k].length).map(k => buckets[k].map(it => {
      const { label, clauses, noWire } = dilParse(it.item || it);
      return `<div class="m-dil"><span class="m-dil-tier m-dil-${k}">${DIL_TIERS[k].label}</span><div><strong>${esc(label)}</strong>${noWire ? ' <em>· no wire without this</em>' : ''}${clauses.length ? `<ul class="m-list">${clauses.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div></div>`;
    }).join('')).join('');
  }

  // Provenance footer
  const pr = a.provenance || {};
  const provItems = [pr.competitors ? `${pr.competitors} competitors benchmarked` : '', pr.rounds ? `${pr.rounds} comparable rounds` : '', pr.marketReports ? `${pr.marketReports} market reports` : '', pr.sources ? `${pr.sources} sources cited` : ''].filter(Boolean);

  const metaChips = [p.stage, ask].filter(Boolean).map(x => `<span class="m-chip">${esc(x)}</span>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.name || 'Venture')} — Deal Memo</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{margin:0;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.55;background:#f3f4f6;}
  .m-page{max-width:760px;margin:0 auto;background:#fff;padding:0 0 40px;}
  .m-toolbar{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#111;color:#fff;padding:10px 18px;font-size:13px;}
  .m-toolbar button{background:${brand};color:#fff;border:none;border-radius:7px;padding:8px 16px;font-weight:600;font-size:13px;cursor:pointer;}
  .m-band{height:6px;background:${brand};}
  .m-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:26px 34px 16px;border-bottom:1px solid #eee;}
  .m-org{font-weight:700;font-size:14px;color:${brand};letter-spacing:-0.01em;}
  .m-org span{color:#9aa0ab;font-weight:500;}
  .m-doc{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8a8f98;margin-top:3px;}
  .m-date{font-size:12px;color:#8a8f98;text-align:right;}
  .m-body{padding:20px 34px 0;}
  h1{font-size:24px;letter-spacing:-0.02em;margin:14px 0 4px;}
  .m-pitch{color:#555;font-size:14px;margin:0 0 10px;}
  .m-chip{display:inline-block;background:#f0f1f4;border-radius:20px;padding:3px 11px;font-size:12px;color:#444;margin-right:6px;}
  .m-verdict{display:flex;align-items:center;gap:18px;flex-wrap:wrap;border:1px solid #eee;border-top:3px solid ${rc};border-radius:12px;padding:16px 18px;margin:16px 0;background:#fcfcfd;}
  .m-rec{background:${rc};color:#fff;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;padding:7px 14px;border-radius:8px;}
  .m-conv{font-size:12px;color:#666;}
  .m-conv strong{color:${rc};}
  .m-score{margin-left:auto;display:flex;align-items:baseline;gap:10px;}
  .m-score-pct{font-size:34px;font-weight:800;line-height:1;color:#141414;}
  .m-score-pct span{font-size:16px;color:#9aa0ab;}
  .m-score-meta{font-size:12px;color:#777;}
  .m-confidence{font-size:11px;color:#9aa0ab;margin:6px 0 0;letter-spacing:0.01em;}
  .m-score-cap{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#aab0b8;}
  .m-signoff{margin:12px 0 4px;padding:10px 13px;border:1px solid #cdeadd;border-left:3px solid #00A368;border-radius:9px;background:#f2fbf6;}
  .m-signoff-h{font-size:12.5px;color:#1f2937;}
  .m-signoff-tick{color:#00A368;font-weight:700;}
  .m-signoff-n{font-size:12px;color:#4b5563;margin-top:5px;font-style:italic;}
  .m-hint{font-size:12px;color:#c9cdd6;}
  .m-sec{margin:22px 0;page-break-inside:avoid;}
  .m-sec h2{font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:${brand};border-bottom:1px solid #eee;padding-bottom:6px;margin:0 0 10px;}
  .m-sec h3{font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px;}
  p{margin:0 0 8px;}
  .m-dim{color:#888;}
  .m-two{display:flex;gap:26px;}
  .m-two>div{flex:1;}
  .m-list{margin:0 0 8px;padding-left:0;list-style:none;}
  .m-list li{position:relative;padding-left:16px;margin-bottom:5px;}
  .m-list li:before{content:'';position:absolute;left:2px;top:7px;width:5px;height:5px;border-radius:50%;background:var(--mk,${brand});}
  .m-tbl{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;}
  .m-tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#999;border-bottom:1px solid #eee;padding:6px 8px;}
  .m-tbl td{border-bottom:1px solid #f1f1f1;padding:6px 8px;vertical-align:top;}
  .m-target{background:rgba(0,54,255,0.04);}
  .m-tiers{display:flex;gap:12px;margin-bottom:8px;}
  .m-tier{flex:1;border:1px solid #eee;border-radius:10px;padding:10px 12px;text-align:center;}
  .m-tier-v{font-size:18px;font-weight:700;}
  .m-tier-l{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;}
  .m-cat td{padding:5px 8px;}
  .m-bar{width:55%;}
  .m-bar span{display:block;height:8px;border-radius:5px;}
  .m-num{text-align:right;font-variant-numeric:tabular-nums;color:#666;white-space:nowrap;}
  .m-member{display:flex;gap:8px;align-items:flex-start;margin-bottom:7px;}
  .m-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex:none;}
  .m-dil{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;}
  .m-dil-tier{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:5px;color:#fff;}
  .m-dil-blocker{background:#C0392B;} .m-dil-key{background:#C77700;} .m-dil-standard{background:#6B7594;}
  .m-foot{margin:28px 34px 0;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#9aa0ab;}
  .m-disclaimer{margin:10px 34px 30px;font-size:9.5px;line-height:1.55;color:#b4b9c2;}
  @media print{ body{background:#fff;} .m-toolbar{display:none;} .m-page{max-width:none;} @page{margin:14mm;} }
</style></head>
<body>
  <div class="m-page">
<div class="m-toolbar"><span>${esc(p.name || 'Venture')} — Deal Memo</span>${shared ? `<span class="m-hint">Read-only · press ⌘/Ctrl&nbsp;+&nbsp;P to save as PDF</span>` : `<button onclick="window.print()">Print / Save as PDF</button>`}</div>
<div class="m-band"></div>
<div class="m-head">
  <div><div class="m-org">${esc(orgName)} <span>Assessment</span></div><div class="m-doc">Investment deal memo · Confidential</div></div>
  <div class="m-date">${esc(today)}</div>
</div>
<div class="m-body">
  <h1>${esc(p.name || 'Venture')}</h1>
  ${p.venturePitch ? `<p class="m-pitch">${esc(p.venturePitch)}</p>` : ''}
  <div>${metaChips}</div>
  <div class="m-verdict">
    ${a.recommendation ? `<span class="m-rec">${esc(a.recommendation)}</span>` : ''}
    ${a.conviction ? `<span class="m-conv">Conviction <strong>${esc(a.conviction)}</strong></span>` : ''}
    ${scoreBlock}
  </div>
  ${confBlock}
  ${signoffBlock}
  ${a.thesis ? `<p>${esc(a.thesis)}</p>` : ''}
  ${risk ? `<p><strong style="color:${rc}">Biggest kill-risk —</strong> ${esc(risk)}</p>` : ''}
  ${must.length ? sec('For the thesis to hold, these must be true', list(must, rc)) : ''}
  ${sec('The case, both ways', bb)}
  ${sec('Deal & valuation', valBlock)}
  ${sec('Market & funding landscape', marketBlock)}
  ${sec('Competitive benchmark', benchBlock)}
  ${sec('Exit & returns', exitBlock)}
  ${sec('Team & founder diligence', teamBlock)}
  ${sec('Investability breakdown', catBlock)}
  ${sec('Diligence checklist', dilBlock)}
</div>
<div class="m-foot">Generated by ${esc(orgName)} on ${esc(today)}${provItems.length ? ` · ${provItems.map(esc).join(' · ')}` : ''} · Powered by Ventrify OS</div>
<div class="m-disclaimer">This report is decision-support, prepared with AI-assisted research and analysis and traceable to the cited sources. It does not constitute investment advice, a recommendation, or an offer or solicitation to transact. Recipients should carry out their own due diligence and take professional advice before making any investment decision.</div>
  </div>
  ${shared ? '' : `<script>window.addEventListener('load', function(){ setTimeout(function(){ try{ window.print(); }catch(e){} }, 300); });<\/script>`}
</body></html>`;
}
