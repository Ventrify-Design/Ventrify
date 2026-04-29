# Ventrify Client Portal — Deploy Guide

The portal feature added to this site is a small, drop-in piece of infrastructure.
No database, no Vercel KV, no build step. Five Vercel serverless functions plus
one HTML page. Markdown content is fetched live from each engagement's GitHub repo.

## What ships in this PR

```
api/
  _lib.js              # shared: HMAC tokens, GitHub API, web3forms email, hub catalogue
  portal-auth.js       # POST  validates access code, sets cookie
  portal-list.js       # GET   returns hub + section catalogue with statuses
  portal-content.js    # GET   fetches markdown from engagement repo via GitHub API
  portal-feedback.js   # POST  emails operator + (optional) commits to engagement repo
  portal-signoff.js    # POST  emails + commits gate sign-off
portal.html            # existing login page — JS now wired to /api/portal-auth
portal-app.html        # NEW — single-page portal UI for clients + investors
```

## One-time setup on Vercel

In your project settings → Environment Variables, add:

### `PORTAL_SECRET` (required)

A random 32+ character string used to sign auth cookies. Generate:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it once and don't change it (changing invalidates all active sessions).

### `PORTAL_CLIENTS` (required)

JSON keyed by client slug. Each engagement adds one entry. Example:

```json
{
  "moneygym-demo": {
    "name": "MoneyGym Demo",
    "oneLiner": "The behavioural-change OS for personal finance.",
    "tier": "Venture Pro",
    "repo": "Ventrify-Design/moneygym-demo",
    "branch": "main",
    "clientCode": "A30844E5",
    "investorCode": "INV-MGYM-7K2X"
  }
}
```

Each engagement's `npm run publish-portal` script prints the exact JSON to add
for that client. Copy-paste, save the env var, redeploy.

### `GITHUB_TOKEN` (optional but recommended)

A GitHub Personal Access Token with **read access to private engagement repos**
(if any are private) and **write access to the `contents` scope** (so the portal
can commit feedback + sign-offs back to the engagement repo).

How to create:

1. github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Repository access: select all engagement repos (or "all repositories" in Ventrify-Design)
3. Permissions: **Contents: Read and write**
4. Copy the token, paste into Vercel env var

If you skip this:

- Portal still works for reading public engagement repos
- Feedback still emails antony@ventrify.io
- Just no automatic commit-back to engagement repos (you keep an email-only audit trail)

### `OPERATOR_EMAIL` (optional)

Defaults to `antony@ventrify.io`. Override if you ever need to route feedback elsewhere.

### `WEB3FORMS_KEY` (optional)

Defaults to the access key already used by the contact form (`0c7e6dc6-...`).
Override to use a different web3forms account if you want portal feedback in a
different inbox.

## Per-engagement workflow

When you start a new client project on the engagement-side workflow:

1. Build the engagement (Phase 0 → Phase 2.5) as normal
2. Push the engagement repo to GitHub:
   ```bash
   gh repo create Ventrify-Design/<slug> --private --source=. --remote=origin --push
   ```
3. Run `npm run publish-portal` in the engagement repo — it prints the exact
   JSON entry to add to `PORTAL_CLIENTS` on Vercel
4. Paste, save, redeploy
5. Send the client `https://ventrify.io/portal` + their access code

That's it. The website fetches markdown from the engagement repo on every page
load (with a 60s cache), so any push to that repo is visible to the client
within ~60 seconds of the next view.

## How auth works

Single login form on `/portal`. The same form accepts both:

- The **client access code** (logs in as `client` scope → full access to all hubs)
- The **investor code** (logs in as `investor` scope → Financials Hub only,
  with `scope-change-recommendations.md` filtered out)

The server doesn't tell the user which scope they got — the redirect target
shows the right view automatically. Tokens are HMAC-signed cookies (no DB)
with a 24-hour expiry.

## How feedback flows back to the workflow

When a client submits feedback or signs off a gate:

1. **Email** lands in `antony@ventrify.io` with project name, hub, section,
   rating, comment, and a direct GitHub link to the source markdown file
2. **(Optional) Commit** to the engagement repo: a single
   `portal-feedback.json` file at the repo root captures every feedback item
   and gate sign-off. Pull the engagement repo to see it locally.

The operator workflow:

1. Read the email
2. Pull the engagement repo (`git pull`)
3. See the new entry in `portal-feedback.json` (if `GITHUB_TOKEN` is configured)
4. Update the relevant markdown file in the engagement repo
5. Push — the client sees the updated content within ~60 seconds

## What's deliberately NOT in this v1

- **No client inline editing.** Clients only submit feedback via the rating form.
  Editing markdown is operator-only via the engagement repo.
- **No 3-layer validation.** Feedback is plain text, no syntactic/semantic
  validation pipeline.
- **No Vercel KV / database.** All state lives in:
  the engagement repo (markdown + portal-feedback.json) and the email inbox.
- **No real-time updates.** Client refreshes; sees latest within ~60 seconds.
- **No registration endpoint.** Operators add clients to PORTAL_CLIENTS
  manually via Vercel UI. Trade-off accepted for simplicity.

## Local development

To run the website locally with the portal:

```bash
npm install
vercel dev
```

The `vercel dev` server runs the API functions locally. Set env vars in
`.env.local`:

```
PORTAL_SECRET=local-dev-secret-please-change
PORTAL_CLIENTS={"local-test":{"name":"Local Test","repo":"Ventrify-Design/Ventrify","branch":"main","clientCode":"test123"}}
```

(Yes, you can point a local-test slug at this very repo for smoke testing —
it'll fetch your own markdown files. Just don't use that in production.)

## Removing a client

When an engagement ends:

1. Edit `PORTAL_CLIENTS` env var → delete that slug
2. Redeploy
3. Their access code stops working immediately on next request

(Their engagement repo is unaffected. If you want to retain their portal access
for a longer period, just leave them in PORTAL_CLIENTS.)
