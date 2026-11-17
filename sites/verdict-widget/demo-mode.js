/* WHICH MODE IS THIS PAGE IN?

   Both stand-in hosts are public URLs, and the only thing separating "nothing happens" from
   "a real deck, a real email and about $1.22 of API credit" is `?live=1` in the address bar.
   Someone who was sent the link has no way to tell which one they are in: in demo mode they
   can finish the whole flow, see a verdict, and believe they tested the product; in live mode
   they can upload a real company's deck without realising anyone will read it.

   One copy of that decision, included by both host pages, because a rule that is written twice
   is a rule that disagrees with itself by the third partner. It is deliberately NOT in embed.js
   — that file runs on a real partner's site and must never put a ribbon on it.

   There is no link from demo to live. Going live is a deliberate act of sharing a different URL,
   not a button a visitor can press by accident. */
(function () {
  var live = false;
  try { live = new URLSearchParams(location.search).get('live') === '1'; } catch (e) {}
  var ribbon = document.querySelector('.ribbon');
  if (!ribbon) return;

  var chip = document.createElement('b');
  chip.className = 'mode ' + (live ? 'is-live' : 'is-demo');
  chip.textContent = live ? 'LIVE' : 'DEMO';
  var note = document.createElement('span');
  note.className = 'mode-note';
  note.textContent = live
    ? ' — real submission, real email, real cost. '
    : ' — nothing is submitted. ';
  ribbon.insertBefore(note, ribbon.firstChild);
  ribbon.insertBefore(chip, ribbon.firstChild);

  if (live) {
    var out = document.createElement('a');
    out.href = location.pathname;
    out.textContent = 'Leave live mode';
    ribbon.appendChild(document.createTextNode(' \u00b7 '));
    ribbon.appendChild(out);
  }
})();
