// ============================================================
// Ventrify OS — provocation-card body renderer (shared)
//
// The agents write cards in Markdown (heading, bold, a numbered "what changes"
// list, a closing "We recommend… you decide" line, and an evidence footnote).
// Both surfaces used to dump that Markdown as raw escaped text, so the symbols
// showed literally. This turns it into clean, readable HTML with the two
// semantic touches that matter for a provocation card:
//   • the "We recommend… / you decide" line  → an accent decision callout
//   • the "[See the evidence: …]" line        → a quiet citation footer
//
// Used by the Workspace (program.html) and the Studio (dashboard.html).
// ============================================================

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline Markdown → HTML (run AFTER escaping): **bold**, *italic*, `code`.
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}

const isOrdered  = l => /^\s*\d+\.\s+/.test(l);
const isBullet   = l => /^\s*[-]\s+/.test(l);
const isEvidence = l => /^\[?\s*See the evidence\b/i.test(l.trim());

// Render a card body Markdown string to HTML. Drops the leading H1 (it's the
// card title, shown in the header already).
export function renderCardBody(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r/g, '').split('\n');

  // Drop leading blanks + the first heading line (the duplicate title).
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length && /^#{1,6}\s/.test(lines[0].trim())) lines.shift();

  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Evidence footer
    if (isEvidence(line)) {
      const inner = line.trim().replace(/^\[?\s*See the evidence[:\s]*/i, '').replace(/\]\s*$/, '');
      const refs = inner.split(/\s*[,;]\s*|\s+·\s+/).map(s => s.trim()).filter(Boolean);
      blocks.push(
        `<div class="cardf-evidence"><span class="cardf-evidence-label">Evidence</span>` +
        refs.map(r => `<span class="cardf-cite">${inline(r)}</span>`).join('<span class="cardf-dot">·</span>') +
        `</div>`
      );
      i++; continue;
    }

    // Ordered list
    if (isOrdered(line)) {
      const items = [];
      while (i < lines.length && isOrdered(lines[i])) { items.push(inline(lines[i].replace(/^\s*\d+\.\s+/, ''))); i++; }
      blocks.push(`<ol class="cardf-list">${items.map(it => `<li>${it}</li>`).join('')}</ol>`);
      continue;
    }
    // Bullet list
    if (isBullet(line)) {
      const items = [];
      while (i < lines.length && isBullet(lines[i])) { items.push(inline(lines[i].replace(/^\s*[-]\s+/, ''))); i++; }
      blocks.push(`<ul class="cardf-list">${items.map(it => `<li>${it}</li>`).join('')}</ul>`);
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para = [];
    while (i < lines.length && lines[i].trim() && !isOrdered(lines[i]) && !isBullet(lines[i]) && !isEvidence(lines[i])) {
      para.push(lines[i].trim()); i++;
    }
    const text = para.join(' ');
    const stripped = text.replace(/\*\*/g, '');
    // The founder's decision prompt → accent callout.
    if (/^we recommend\b/i.test(stripped) || /\b(you decide|your call)\b/i.test(stripped)) {
      blocks.push(`<div class="cardf-rec">${inline(text)}</div>`);
    } else {
      blocks.push(`<p>${inline(text)}</p>`);
    }
  }
  return blocks.join('');
}

// Inject the card-format CSS once per page (idempotent).
export function ensureCardStyles() {
  if (typeof document === 'undefined' || document.getElementById('cardf-styles')) return;
  const s = document.createElement('style');
  s.id = 'cardf-styles';
  s.textContent = `
    .prov-card-body p, .prov-fcard-body p { margin:0.6rem 0; line-height:1.62; }
    .prov-card-body p:first-child, .prov-fcard-body p:first-child { margin-top:0.15rem; }
    .cardf-list { margin:0.55rem 0; padding-left:1.25rem; }
    .cardf-list li { margin:0.32rem 0; line-height:1.55; }
    .cardf-rec { margin:0.9rem 0 0; padding:0.72rem 0.95rem; border-left:3px solid var(--primary,#0036FF);
      background:rgba(0,54,255,0.06);
      background:color-mix(in srgb, var(--primary,#0036FF) 7%, transparent); border-radius:0 8px 8px 0;
      font-size:0.9rem; line-height:1.55; }
    .cardf-evidence { margin-top:0.95rem; padding-top:0.7rem; border-top:1px solid rgba(0,0,0,0.08);
      font-size:0.72rem; color:var(--muted,#6B7594); display:flex; flex-wrap:wrap; gap:0.4rem 0.5rem; align-items:center; }
    .cardf-evidence-label { text-transform:uppercase; letter-spacing:0.07em; font-weight:700; font-size:0.6rem; color:var(--accent,#00B8A0); }
    .cardf-cite { font-family:'JetBrains Mono','SFMono-Regular',monospace; font-size:0.68rem; }
    .cardf-dot { opacity:0.4; }
    .prov-card-body code, .prov-fcard-body code { font-family:'JetBrains Mono',monospace; font-size:0.85em; background:rgba(0,0,0,0.05); padding:0.05em 0.35em; border-radius:4px; }
  `;
  document.head.appendChild(s);
}
