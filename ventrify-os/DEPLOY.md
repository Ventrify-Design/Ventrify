# Deploying the Ventrify OS app (Workspace + Studio)

Deploys the OS product — the marketing site, the operator **Workspace**, and the
founder **Studio** — as its OWN site at **os.ventrify.io**, completely separate
from `ventrify.io` and its `/portal` (MoneyGym / Jonathan). Same Git repo, two
different Vercel projects.

## Architecture
```
ventrify.io       → existing Vercel project (repo ROOT)  — agency site + /portal   ✋ UNTOUCHED
os.ventrify.io    → NEW Vercel project, Root Directory = ventrify-os/  — this app
```
Both deploy from `Ventrify-Design/Ventrify`. OS-app work never changes the
portal's files (`api/`, root site), so the portal can't be affected.

## One-time setup

### 1. Vercel — new project
1. Vercel dashboard → **Add New → Project** → import `Ventrify-Design/Ventrify`.
2. **Root Directory:** `ventrify-os` (Edit → pick the folder).
3. Framework Preset: **Other** — it's static (no build command, no output dir).
4. **Deploy**, then Project → **Settings → Domains → add `os.ventrify.io`**.

### 2. DNS
Add the record Vercel shows for `os.ventrify.io` (CNAME → `cname.vercel-dns.com`,
or Vercel's current target). `ventrify.io` root + `/portal` DNS stay as-is.

### 3. Firebase — authorize the live domain  (REQUIRED for magic-link sign-in)
Firebase console → **Authentication → Settings → Authorized domains → Add domain**
→ `os.ventrify.io`. Without this, sign-in links fail in production.

### 4. Firestore security rules  (REQUIRED before real use)
Firebase console → **Firestore → Rules** → paste `firebase/firestore.rules`
from this folder → **Publish**. (Until then the database is world-open.)

## Day-to-day
Edit → commit → push to `main` → Vercel auto-deploys. The OS-app project only
serves `ventrify-os/`, so it cannot affect `/portal`.

## Safety notes
- `firebase/config.js` is PUBLIC client config — safe to commit.
- The Firebase **Admin** service-account key is NOT here — it lives only in the
  engagement-template repo's gitignored `.secrets/`. Nothing secret ships here.
