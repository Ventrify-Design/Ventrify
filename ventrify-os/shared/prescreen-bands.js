// ============================================================
// PRE-SCREEN BANDS — the three-step verdict, and what each step is allowed to say.
//
// SINGLE SOURCE. This vocabulary was in two places and the two disagreed: ds.js called the steps
// High / Medium / Low with a sentence under each, and workspace/prescreen-view.js — the document a
// colleague who has never seen the product receives — called them "Worth assessing" / "Worth a closer
// look" / "Not yet" with no sentence at all. Same snapshot, same band, two different verdicts
// depending on which surface you read. Pure data, DOM-free, so the renderers and the gates can all
// import it (the shared/vss-rubric.js pattern).
//
// NOT A QUALITY VERDICT. We have read documents; we have never met the team or used the product
// (prescreen-v2-spec §2). None of these three sentences mentions a document, and none of them may —
// tools/prescreen-vocabulary.mjs enforces that.
//
// `i` is the step's position on the three-point scale: how many columns a verdict signal lights.
// There is no fourth entry. "We couldn't tell" is OFF the scale, not the bottom of it (§3.3): an
// unreadable submission is not a verdict on a venture and must never render as the worst one.
// ============================================================

export const PS2_BANDS = {
  HIGH:   { label: 'High',   i: 2, line: 'Worth assessing now.' },
  MEDIUM: { label: 'Medium', i: 1, line: 'Real signal, with things to resolve.' },
  LOW:    { label: 'Low',    i: 0, line: 'The case needs work before it is worth the full read.' },
};

// bandOf — tolerant lookup. Snapshots store the band lower-case ('medium'); the keys are upper.
// Returns null for anything unrecognised, INCLUDING an absent band, so a caller must decide what to
// render for "not enough to read yet" rather than being handed a fourth band that looks like Low.
export function bandOf(band) {
  const k = String(band == null ? '' : band).trim().toUpperCase();
  return PS2_BANDS[k] || null;
}

// How many steps there are, for a renderer drawing the scale. Not a magic 3.
export const BAND_STEPS = Object.keys(PS2_BANDS).length;
