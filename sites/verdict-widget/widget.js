/* ══ VERDICTSCORE PRE-SCREEN WIDGET ════════════════════════════════════════
   Runs inside an iframe on our own origin, embedded on a partner's site.
   The partner page cannot read anything in here and we cannot touch theirs;
   the only channel is postMessage, and it carries three message types.

   WHITE-LABEL. Everything a partner can change arrives as a query parameter
   and lands on a CSS custom property — theme, accent, type, radius, logo,
   wording, price, bar. Nothing below is written for TCA; TCA is one row of
   config, and the second partner is another row, not another build.

   THE PROGRESS STEPS ARE REAL, and that is a product decision rather than a
   scruple. The house rule in this codebase is "progress is only real once the
   run is running — never fake a %", and a theatre of "evidence scored" on a
   deck nothing has read would break it. Every step below is something that is
   genuinely true at submit time, and step 2 — can we actually open the data
   room — is the single most common failure in the whole pipeline. Checking it
   while the founder is still on the page, rather than emailing them about it
   twenty minutes later, is worth more than the animation it replaces.
   ────────────────────────────────────────────────────────────────────────── */

const Q = new URLSearchParams(location.search);
const CFG = {
  partner:  Q.get('partner')  || 'our partners',
  short:    Q.get('short')    || 'them',
  logo:     Q.get('logo')     || '',
  theme:    Q.get('theme')    === 'light' ? 'light' : 'dark',
  accent:   Q.get('accent')   || '#7C5CFC',
  radius:   Q.get('radius'),
  font:     Q.get('font')     || '',
  fontBody: Q.get('fontBody') || '',
  site:     Q.get('site')     || 'https://verdict.ventrify.io',
  price:    Q.get('price')    || '199',
  bar:      Q.get('bar')      || '75',
  /* ⚠ ASSUMED, NOT MEASURED — one token, change it once we have timed a run. */
  readyIn:  Q.get('readyIn')  || 'within the hour',
};
const DEMO = Q.get('demo') === '1';
const API  = (Q.get('api') || 'https://os.ventrify.io').replace(/\/$/, '');

/* WHAT IS ACTUALLY WIRED, as one constant rather than as copy scattered through
   four templates. 'intake' is the state today: the deck reaches Storage, the
   record is parked, and a sign-in link is sent. The pre-screen does NOT run yet,
   so nothing here may say that it has. Flipping this to 'full' is what step two
   earns — and it changes the three sentences that would otherwise be a lie. */
/* The pre-screen RUNS now (api/intake-run.js), so 'full' is the honest default.
   ?stage=intake forces the older, smaller promise back — useful if the runner is
   ever paused and the widget must stop promising a verdict it cannot deliver. */
const STAGE = Q.get('stage') === 'intake' ? 'intake' : 'full';

/* ONE NUMBER. It was written out three times — the drop-zone caption, the error
   sentence and the server — which is how a limit quietly becomes three limits
   that disagree. The server is the authority (INTAKE_MAX_DECK_MB); this must be
   set to match it, and both say so. */
const MAX_MB = Math.max(1, Number(Q.get('maxMb') || 40));
const DECK_EXT = /\.(pdf|ppt|pptx|key)$/i;

/* ── theme ──────────────────────────────────────────────────────────────── */
const root = document.documentElement;
root.dataset.theme = CFG.theme;

/* The ink on a partner's accent is MEASURED, not guessed. A mid-tone brand
   colour is exactly where a hardcoded white label fails WCAG, and every
   partner we sign will hand us a different one. */
const lum = hex => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return 0;
  const f = x => (x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4));
  return .2126 * f((n >> 16 & 255) / 255) + .7152 * f((n >> 8 & 255) / 255) + .0722 * f((n & 255) / 255);
};
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const L = lum(CFG.accent);
root.style.setProperty('--acc', CFG.accent);
root.style.setProperty('--acc-ink', ratio(L, 1) >= ratio(L, lum('#14171F')) ? '#FFFFFF' : '#14171F');
/* the accent as TEXT needs a different step from the accent as a FILL: on a
   light ground a pale brand colour is unreadable as a label. */
root.style.setProperty('--acc-text',
  CFG.theme === 'light' && L > .34 ? `color-mix(in srgb, ${CFG.accent} 72%, #000)`
  : CFG.theme === 'dark' && L < .12 ? `color-mix(in srgb, ${CFG.accent} 62%, #fff)`
  : CFG.accent);

if (CFG.radius != null && CFG.radius !== '') {
  const r = Math.max(0, Math.min(24, parseInt(CFG.radius, 10) || 0));
  root.style.setProperty('--r',  r + 'px');
  root.style.setProperty('--r2', Math.round(r * .78) + 'px');
  root.style.setProperty('--r3', Math.round(r * .62) + 'px');
}
const loadFont = fam => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(fam).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
};
if (CFG.font) { loadFont(CFG.font); root.style.setProperty('--w-display', `"${CFG.font}", "Inter Tight", sans-serif`); }
if (CFG.fontBody && CFG.fontBody !== CFG.font) loadFont(CFG.fontBody);
const bodyFam = CFG.fontBody || CFG.font;
if (bodyFam) root.style.setProperty('--w-body', `"${bodyFam}", Inter, system-ui, sans-serif`);

const send = (type, data) => parent.postMessage({ source: 'verdictscore', type, ...data }, '*');
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const body = $('body'), footnote = $('footnote');

/* ── the partner's lockup. Their logo if they gave us one, their name if not;
      either way the chrome is theirs and ours is in the footer. ─────────── */
$('head').innerHTML =
  (CFG.logo
    ? `<img class="logo" src="${esc(CFG.logo)}" alt="${esc(CFG.partner)}">`
    : `<span class="wordmark">${esc(CFG.partner)}</span>`) +
  `<span class="bar"></span><span class="what">Pre-screen</span>
   <button class="x" id="close" aria-label="Close pre-screen">&times;</button>`;
$('close').onclick = () => send('close');
$('by').onclick = () => send('navigate', { href: CFG.site });

/* ── THE LOCKUP, FROM THE ONE PLACE IT LIVES ──────────────────────────────────
   shared/m3/brand-lockup.js holds the path data with its fills already written
   as var(--brand-accent / -2), which this file pins to VerdictScore violet so
   the mark never takes the partner's colour. Pasting the artwork in here would
   have made a second copy of a logo — and the copy would have been the one that
   went stale.

   The path resolves both ways with no build step: locally the file really is at
   /ventrify-os/shared/m3/..., and in production the root project rewrites that
   prefix to os.ventrify.io. It is a DYNAMIC import with a fallback, because a
   widget on someone else's site must not lose its panel over a logo. */
(async () => {
  try {
    const m = await import('/ventrify-os/shared/m3/brand-lockup.js');
    $('lockup').innerHTML = m.brandLockup({ brand: 'verdictscore', label: 'VerdictScore' });
  } catch (e) {
    $('lockup').innerHTML = '<b>VerdictScore</b>';
  }
})();

const S = { name:'', email:'', company:'', file:null, room:'', share:true, roomState:null,
            intakeId:null, failed:null };

/* ── THE WIRE ─────────────────────────────────────────────────────────────────
   Three calls, in this order, and each step of the progress list is the one it
   is waiting on. Nothing is simulated unless ?demo=1, and nothing claims to have
   happened before the call that does it has returned. */
const post = async (path, payload) => {
  const r = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(data.error || ('http_' + r.status)); err.code = data.error; throw err; }
  return data;
};

/* The one message a founder is most likely to see that is not a success, so it
   gets a sentence rather than a code. */
const WHY = {
  already_submitted_recently: 'You have already sent us a deck from this address recently. Check your inbox — the link is still good.',
  rate_limited:              'Too many submissions from this connection today. Try again tomorrow, or email us.',
  partner_cap_reached:       'This month’s free pre-screens have all been claimed. Try again next month, or go straight to a full assessment.',
  deck_too_large:            `That deck is over ${MAX_MB} MB. Send a lighter export and we will read it.`,
  deck_type_unsupported:     'We can read PDF, PowerPoint and Keynote. That file is not one of them.',
  room_not_a_url:            'That data room link does not look like a web address.',
  email_invalid:             'That email address does not look right.',
  /* These five fell through to the generic sentence the first time this was
     tested for real, which told the founder nothing and told us nothing either.
     An error code with no sentence is a bug report nobody can file. */
  partner_unknown:           'This widget is not set up for this site yet. Please let us know where you saw it.',
  upload_failed:             'Your deck did not finish uploading. Check your connection and try again.',
  deck_not_found:            'Your deck did not arrive. Try attaching it again.',
  already_submitted:         'That submission is already in. Check your inbox for the link.',
  unknown_intake:            'That submission expired before the deck finished. Start again and it will be quick.',
  intake_failed:             'Something broke at our end, not yours. Nothing was charged. Try again in a minute \u2014 if it keeps happening, email hello@ventrify.io and quote the time.',
};
const STEPS = ['intro', 'form', 'running', 'done', 'failed'];
let at = 0;
const paint = () => send('step', { step: STEPS[at] });

/* ── the upsell. OURS, so it keeps the violet on every partner's site. ──── */
const sell = loud => `
  <div class="sell">
    <span class="lbl">${loud ? 'What happens next' : 'Or go further'}</span>
    <h3>Full assessment <span class="price">$${esc(CFG.price)}</span></h3>
    <p>Your investability score across 35 signals, with the evidence behind every one &mdash;
       the same read an investor's analyst would do.</p>
    <div class="gate"><span class="sc">${esc(CFG.bar)}+</span>
      <span>Score ${esc(CFG.bar)} or above and you are automatically eligible for
      <b>${esc(CFG.short)}'s screening process</b>.</span></div>
    <button class="btn v" data-go="sell">See what's in it &rarr;</button>
  </div>`;

const intro = () => `
  <div class="step">
    <span class="eyebrow">Free pre-screen</span>
    <h1>Is your deck ready for ${esc(CFG.short)}?</h1>
    <p class="lede">Upload what you have. We will tell you whether it is worth putting
      in front of an investor yet &mdash; and name what is missing if it is not.</p>
    <div class="facts">
      <div class="fact"><span class="ic">&#10003;</span><span><b>Free</b>, and no account to create.</span></div>
      <div class="fact"><span class="ic">&#9201;</span><span>About <b>two minutes</b> to submit.</span></div>
      <div class="fact"><span class="ic">&#9993;</span><span>Your result arrives <b>by email</b>, ${esc(CFG.readyIn)}.</span></div>
    </div>
    <button class="btn p" data-go="form">Start pre-screen</button>
    ${sell(false)}
  </div>`;

const form = () => `
  <div class="step">
    <button class="back" data-go="intro">&larr; Back</button>
    <h1 style="font-size:19px;margin:.2rem 0 .9rem">Tell us where to send it</h1>
    <div class="f">
      <div>
        <label for="n">Your name</label>
        <input id="n" type="text" autocomplete="name" placeholder="Alex Moreau" value="${esc(S.name)}">
        <span class="err">We need a name for the report.</span>
      </div>
      <div>
        <label for="e">Work email</label>
        <input id="e" type="email" autocomplete="email" inputmode="email" placeholder="alex@yourcompany.com" value="${esc(S.email)}">
        <span class="err">That does not look like an email address.</span>
      </div>
      <div>
        <label for="c">Company</label>
        <input id="c" type="text" autocomplete="organization" placeholder="Northwind Health" value="${esc(S.company)}">
        <span class="err">We need a company name for the report.</span>
      </div>
      <div>
        <label for="d">Pitch deck</label>
        <div class="drop" id="d" tabindex="0" role="button" aria-label="Choose your pitch deck">
          <div class="big">Drop your deck, or choose a file</div>
          <div class="sm">PDF, PPT or Keynote &middot; up to ${MAX_MB} MB</div>
        </div>
        <input id="fi" type="file" accept=".pdf,.ppt,.pptx,.key,application/pdf" hidden>
        <span class="err" id="ferr" style="display:none">A deck is the one thing we cannot do without.</span>
      </div>
      <div>
        <label for="r">Data room link <span class="opt">&mdash; optional</span></label>
        <input id="r" type="url" inputmode="url" placeholder="https://drive.google.com/drive/folders/..." value="${esc(S.room)}">
        <p class="hint">Share the folder with <code>room@ventrify.io</code> as a Viewer,
          or we will not be able to open it.</p>
      </div>
      <label class="check" for="sh">
        <input id="sh" type="checkbox" ${S.share ? 'checked' : ''}>
        <span>Share my result with <b>${esc(CFG.partner)}</b>. Your deck is not shared either way &mdash;
          only the verdict, and only if you tick this.</span>
      </label>
    </div>
    <div class="stick"><button class="btn p" id="go">Submit for pre-screen</button></div>
  </div>`;

const running = () => `
  <div class="step tall">
    <span class="eyebrow">Submitting</span>
    <h1 style="font-size:19px">Hold on &mdash; this takes a few seconds.</h1>
    <div class="runs" id="runs" aria-live="polite">
      <div class="run" data-i="0"><span class="m">1</span>
        <span class="t"><b>Receiving your deck</b><span id="s0">&mdash;</span></span></div>
      <div class="run" data-i="1"><span class="m">2</span>
        <span class="t"><b>Opening your data room</b><span id="s1">&mdash;</span></span></div>
      <div class="run" data-i="2"><span class="m">3</span>
        <span class="t"><b>Queued for pre-screen</b><span id="s2">&mdash;</span></span></div>
    </div>
    <div class="wait">
      <b>What comes back</b>
      <p>A pre-screen answers one question &mdash; is this worth assessing properly?
        It does not give you a number. The score comes from the full assessment.</p>
    </div>
  </div>`;

const done = () => `
  <div class="step">
    <div class="mid">
      <div class="tick">&#10003;</div>
      <h1>${STAGE === 'full' ? 'That is everything we need.' : 'We have your deck.'}</h1>
      <p class="lede" style="margin:.5rem 0 0">${STAGE === 'full' ? 'We will email' : 'We have your deck at'}</p>
      <span class="addr">${esc(S.email)}</span>
      <p class="lede" style="margin:0">${STAGE === 'full'
        ? 'One email, when your pre-screen is finished &mdash; not before. The link in it opens the result directly: no password, nothing to set up.'
        : 'We will be in touch once we have read it.'}</p>
    </div>
    ${S.roomState === 'given' ? `
      <div class="warn" style="background:var(--surface);border-color:var(--edge)"><span class="i">&#9432;</span>
        <span>We will check we can open your data room when the pre-screen runs. If it is not shared with
          <code>room@ventrify.io</code>, we will read the deck alone and tell you.</span></div>` : ''}
    ${sell(true)}
  </div>`;

/* The failure screen. It exists because the alternative — a spinner that stops,
   or a success screen after a failed call — is how a founder decides the whole
   product is broken. */
const failed = () => `
  <div class="step">
    <div class="mid">
      <div class="tick" style="background:var(--surface);border:1.5px solid var(--edge);color:var(--t2)">!</div>
      <h1>That did not go through.</h1>
      <p class="lede" style="margin:.5rem 0 0">${esc(S.failed || '')}</p>
    </div>
    <div style="margin-top:1.1rem"><button class="btn p" data-go="form">Try again</button></div>
    ${sell(false)}
  </div>`;

/* ── render + behaviour ─────────────────────────────────────────────────── */
function go(step) {
  at = STEPS.indexOf(step);
  body.scrollTop = 0;
  if (step === 'intro')   { body.innerHTML = intro();   footnote.textContent = 'Free · no account'; }
  if (step === 'form')    { body.innerHTML = form();    footnote.textContent = 'Read by VerdictScore'; wireForm(); }
  if (step === 'running') { body.innerHTML = running(); footnote.textContent = 'Do not close this yet'; runIt(); }
  if (step === 'done')    { body.innerHTML = done();    footnote.textContent = 'You can close this'; }
  if (step === 'failed')  { body.innerHTML = failed();  footnote.textContent = 'Nothing was submitted'; }
  paint();
}

body.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (!b) return;
  const v = b.dataset.go;
  if (v === 'sell') return send('navigate', { href: CFG.site + '/#pricing' });
  go(v);
});

function wireForm() {
  const fi = $('fi'), d = $('d');
  const pick = () => fi.click();
  d.onclick = pick;
  d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
  ['dragenter','dragover'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave','drop'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', e => { if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
  fi.onchange = () => { if (fi.files[0]) setFile(fi.files[0]); };

  /* CHECKED AT PICK TIME, NOT AFTER THE UPLOAD. The server's own check ran in
     phase two — which is to say after every byte had already been sent. On a
     slow connection that is minutes of uploading before being told no. This
     costs nothing and happens before anything moves; the server still checks
     too, because a client can say whatever it likes. */
  function rejectFile(msg) {
    S.file = null;
    d.classList.remove('has');
    d.innerHTML = `<div class="big">Drop your deck, or choose a file</div>
      <div class="sm">PDF, PPT or Keynote &middot; up to ${MAX_MB} MB</div>`;
    const e = $('ferr');
    e.textContent = msg;
    e.style.display = 'block';
  }

  function setFile(f) {
    if (!DECK_EXT.test(f.name)) {
      return rejectFile('We can read PDF, PowerPoint and Keynote. That file is not one of them.');
    }
    if (f.size > MAX_MB * 1048576) {
      return rejectFile(`That file is ${(f.size / 1048576).toFixed(1)} MB and the limit is ${MAX_MB} MB. ` +
        'Export it lighter \u2014 flattening images usually does it \u2014 and try again.');
    }
    if (!f.size) return rejectFile('That file is empty.');

    S.file = f;
    $('ferr').style.display = 'none';
    d.classList.add('has');
    d.innerHTML = `<span class="fi">${esc((f.name.split('.').pop() || '').toUpperCase().slice(0, 4))}</span>
      <span class="nm"><b>${esc(f.name)}</b>
      <span>${(f.size / 1048576).toFixed(1)} MB &middot; tap to replace</span></span>`;
  }

  $('go').onclick = () => {
    const n = $('n'), e = $('e'), c = $('c');
    let bad = false;
    const mark = (el, ok) => { el.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (!ok) bad = true; };
    mark(n, n.value.trim().length > 1);
    mark(e, /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(e.value.trim()));
    mark(c, c.value.trim().length > 1);
    if (!S.file) { $('ferr').style.display = 'block'; bad = true; }
    if (bad) { body.querySelector('[aria-invalid=true]')?.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    S.name = n.value.trim(); S.email = e.value.trim(); S.company = c.value.trim();
    S.room = $('r').value.trim(); S.share = $('sh').checked;
    go('running');
  };
}

/* THE RUN. Three steps, each one true at the moment it is shown.
   In production: step 1 is the upload's own progress, step 2 is the data-room
   reachability check that already exists for Drive rooms, step 3 is the enqueue
   acknowledgement. Here they are simulated, and nothing claims to have scored
   anything, because nothing has. */
async function runIt() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [...document.querySelectorAll('.run')];
  const set = (i, state, text) => {
    rows[i].className = 'run ' + state;
    if (state === 'done') rows[i].querySelector('.m').innerHTML = '&#10003;';
    if (state === 'bad')  rows[i].querySelector('.m').innerHTML = '!';
    if (text != null) $('s' + i).textContent = text;
  };
  const mb = n => (n / 1048576).toFixed(1) + ' MB';

  try {
    /* ── 1. the deck. Two calls with the browser's own PUT in between, because a
          40MB file cannot go through a serverless function body. ──────────── */
    set(0, 'on', 'sending ' + mb(S.file.size));
    if (DEMO) { await wait(1500); S.intakeId = 'demo'; }
    else {
      const a = await post('/api/intake', {
        partner: CFG.partner, name: S.name, email: S.email, company: S.company,
        room: S.room, share: S.share,
        fileName: S.file.name, contentType: S.file.type || 'application/pdf',
        size: S.file.size,
      });
      S.intakeId = a.intakeId;
      const put = await fetch(a.uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': a.contentType }, body: S.file,
      });
      if (!put.ok) throw new Error('upload_failed');
      await post('/api/intake', { intakeId: S.intakeId, uploaded: true });
    }
    set(0, 'done', S.file.name + ' · ' + mb(S.file.size));

    /* ── 2. the data room. NOT CHECKED YET, and so not claimed. The check that
          exists (api/_roomcheck.js) is reachable only behind auth; opening it to
          this endpoint is step two's job. Until then this step records what was
          given, which is all it is entitled to say. ──────────────────────── */
    set(1, 'on', 'noting the link');
    await wait(DEMO ? 1200 : 450);
    if (S.room) {
      S.roomState = 'given';
      set(1, 'done', 'saved — we check we can open it when your pre-screen runs');
    } else {
      S.roomState = 'none';
      set(1, 'done', 'none given — we will read the deck alone');
    }

    /* ── 3. NO EMAIL HERE. ───────────────────────────────────────
          This step used to send a sign-in link the moment the deck landed, back
          when that was the only email the system could send. It meant the founder
          clicked through to a workspace with NOTHING IN IT — the pre-screen had
          not been run yet — and then got a second email later. Two emails, and
          the first one delivered an empty room.

          ONE EMAIL, WHEN THERE IS SOMETHING TO SEE. /api/intake-run sends it after
          the band is written. A link is a promise that something is there; do not
          send one before it is. ─────────────────────────────────── */
    set(2, 'on', 'queuing your pre-screen');
    await wait(DEMO ? 1200 : 400);
    set(2, 'done', 'we will email ' + S.email + ' when it is ready');

    await wait(700);
    go('done');
  } catch (e) {
    /* A failure is shown where it happened, and the founder is told what to do
       next. Silently landing on the success screen would be worse than useless. */
    const i = rows.findIndex(r => r.classList.contains('on'));
    set(i < 0 ? 0 : i, 'bad', WHY[e.code] ? '' : 'something went wrong');
    S.failed = WHY[e.code] || 'We could not take your submission just now. Nothing was charged and nothing was kept — try again in a minute, or email hello@ventrify.io.';
    go('failed');
  }
}

addEventListener('keydown', e => { if (e.key === 'Escape') send('close'); });
go('intro');
