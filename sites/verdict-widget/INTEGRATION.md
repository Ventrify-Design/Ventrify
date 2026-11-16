# VerdictScore pre-screen — integration note

For the person who looks after tcaventuregroup.com. Everything below is one line of HTML;
the rest of this note is what that line does and how to check it.

---

## 1. What it is

A small button fixed to the bottom corner of your pages. A founder clicks it, fills in four
fields, drops in a deck (and optionally a Drive link to a data room), and gets an emailed
verdict on whether the deck is ready to put in front of TCA.

- The button carries **your** logo, colour, type and corner radius. It is meant to look like
  part of your site, not like an advert on it.
- It is free to the founder. One pre-screen per founder.
- Measured end to end on three real runs: **the verdict email arrives about six minutes after
  submit** (5.8, 6.2 and 6.6 minutes).
- Founders who score 75 or above are told they are eligible for TCA's screening process.

## 2. The line to paste

```html
<script src="https://verdict.ventrify.io/widget/embed.js"
        data-partner="TCA Venture Group"
        data-short="TCA"
        data-logo="https://tcaventuregroup.com/path/to/logo.svg"
        data-theme="light"
        data-accent="#A68B5B"
        data-font="Zilla Slab"
        data-font-body="Open Sans"
        data-radius="2"
        defer></script>
```

Put it immediately before `</body>`, site-wide or on whichever pages founders land on. On
WordPress that is the theme's footer, or any "insert header and footer scripts" plugin — it does
not need a plugin of its own and it does not touch the database.

**Three values to set before go-live:** `data-logo` (a URL on your own domain), `data-accent`
(your bronze — the value above is sampled from the site, not given to us), and the two font
names if the site's are different. Everything else can stay as it is.

## 3. If you run a Content-Security-Policy

Most WordPress sites do not. If yours does, the widget needs:

```
script-src  https://verdict.ventrify.io
frame-src   https://verdict.ventrify.io
```

and, only if you keep `data-font` / `data-font-body`, the Google Fonts pair your site will
already have if it uses them:

```
style-src   https://fonts.googleapis.com
font-src    https://fonts.gstatic.com
```

Drop the two font attributes and the font rules are not needed at all — the widget falls back
to a system stack.

## 4. What it does to your page

| | |
|---|---|
| Weight on first load | one 11 KB script (4.5 KB gzipped) and a button. The form itself loads only when a founder opens it. |
| Cookies | none. |
| Browser storage | none — nothing in localStorage, sessionStorage or IndexedDB. No change to your cookie notice. |
| Your CSS | cannot affect the button (it is in a shadow root) and cannot reach the form (it is in an iframe). A `button {}` rule in your theme will not break it. |
| Your page's data | nothing is read from it. The script looks at its own attributes and nothing else. |
| The founder's deck | uploaded from inside the iframe straight to VerdictScore. It never passes through your page or your server. |
| Mobile | at 640px and below the panel becomes a full screen rather than a floating card. |
| Keyboard / a11y | Esc closes it, focus returns to the button, the accent is contrast-checked against black and white at runtime. |

## 5. Everything you can change

Only `data-partner` is required.

| Attribute | Default | What it does |
|---|---|---|
| `data-partner` | — | Your name, as it appears in the form's copy. **Required**, and it must match the name we have allowlisted. |
| `data-short` | `data-partner` | Short form used in tight copy and on the button mark when there is no logo. |
| `data-logo` | none | Your logo on the button. Any URL; SVG or PNG. |
| `data-theme` | `dark` | `light` or `dark`. |
| `data-accent` | `#7C5CFC` | Your brand colour, as hex. |
| `data-font` | system | Google Font name for headings, e.g. `Zilla Slab`. |
| `data-font-body` | system | Google Font name for body text. |
| `data-radius` | `16` | Corner radius in px, 0–24. 14 or more becomes a pill. |
| `data-label` | `Is your deck ready?` | The button's first line. |
| `data-sub` | `Free pre-screen · 2 min` | The button's second line. |
| `data-side` | `right` | `left` or `right`. |

## 6. Analytics

If `window.dataLayer` exists (GTM, GA4 via GTM), the widget pushes one event per step:

```js
{ event: 'verdictscore_step', step: 'intro' | 'form' | 'running' | 'done' | 'failed' }
```

Nothing is pushed if `dataLayer` is absent, and no third-party analytics are loaded by us.

## 7. Checking it

- **Simulated, no real submission:** <https://verdict.ventrify.io/widget/demo> — the widget on a
  stand-in page, every screen reachable, nothing sent. Use this to agree the styling.
- **Live, on your staging site:** paste the tag. A submission there is a real one: a real email,
  a real pre-screen, and it counts against the monthly allowance.
- A submission that is refused tells you why in the panel. The two you are most likely to meet
  are a deck over 40 MB and a second submission from an address that has already had one.

## 8. Turning it off

Delete the line. There is nothing else to uninstall — no plugin, no database row, no cookie to
expire.

## 9. Who sees what

- **The founder** gets the full verdict, in their own VerdictScore workspace, from an emailed
  sign-in link.
- **TCA** sees the verdict for any founder who ticks the sharing box, in a TCA workspace we will
  set up for your team. TCA never sees the deck or the data room — not by policy alone: the
  permission rules refuse it.
- **VerdictScore** reads the deck to produce the pre-screen.

## 10. Questions

Reply to whoever sent you this note; it reaches the engineer who maintains the widget.
