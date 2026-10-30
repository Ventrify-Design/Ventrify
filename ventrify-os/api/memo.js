/**
 * /api/memo — the shareable deal memo + operator sign-off (Track A · Piece 3).
 *
 * One function (to fit the Vercel plan's serverless-function budget) with two modes:
 *
 *   GET  /m/:token  (rewritten to /api/memo?t=:token)   — PUBLIC, no auth.
 *        Serves the FROZEN memo snapshot (created by a POST share) under a strict CSP
 *        that forbids ALL scripts, so operator-authored HTML can't run JS on our origin.
 *        The unguessable token IS the access; nothing in Firestore is publicly readable.
 *
 *   POST /api/memo   { idToken, engagementId, action, ... }  — OPERATOR-gated.
 *        action='share'        freeze `html` at the engagement's STABLE token (reuse if
 *                              it has one → refresh in place; mint on first share).
 *        action='revoke-share' delete the snapshot + clear the link.
 *        action='sign'         stamp an operator endorsement (identity from the VERIFIED
 *                              token, never client input; founders excluded).
 *        action='revoke-sign'  clear the endorsement.
 *
 * A Firestore rule blocks clients from writing assessmentSignoff/shareLink directly, so
 * these Admin-SDK writes are the only path — a founder can't forge either.
 * Env: FIREBASE_SERVICE_ACCOUNT (already set).
 */
const admin = require('firebase-admin');
const crypto = require('crypto');

function ensureAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const MAX_HTML = 900 * 1024;   // stay safely under Firestore's 1MB doc ceiling

// ---- GET: serve a frozen memo (public, no-script CSP) ------------------------
const CSP = [
  "default-src 'none'",        // scripts, connects, frames, everything → blocked by default
  "style-src 'unsafe-inline'", // the memo's inline <style> + style="" attributes
  "img-src data: https:",
  "font-src data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex,nofollow"><title>${title}</title>`
    + `<style>html,body{margin:0;height:100%;font-family:-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;background:#f3f4f6;color:#1a1a1a;}`
    + `.wrap{max-width:520px;margin:0 auto;padding:14vh 24px;text-align:center;}`
    + `h1{font-size:20px;letter-spacing:-0.01em;margin:0 0 8px;}p{color:#6b7280;font-size:14px;line-height:1.6;margin:0;}`
    + `.mk{width:38px;height:38px;border-radius:9px;background:#0036FF;margin:0 auto 18px;}</style></head><body>${body}</body></html>`;
}

function serveNotFound(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).send(shell('Link unavailable', `<div class="wrap"><div class="mk"></div>`
    + `<h1>This shared assessment isn’t available</h1>`
    + `<p>The link may have been revoked, replaced by a newer version, or entered incorrectly. Ask whoever shared it for an up-to-date link.</p></div>`));
}

async function serveMemo(req, res) {
  try {
    const token = String((req.query && req.query.t) || '').trim();
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) { serveNotFound(res); return; }
    ensureAdmin();
    const snap = await admin.firestore().collection('sharedMemos').doc(token).get();
    if (!snap.exists) { serveNotFound(res); return; }
    const html = String(snap.data().html || '');
    if (!html) { serveNotFound(res); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'private, no-store');   // so a revoke takes effect immediately
    res.status(200).send(html);
  } catch (e) {
    serveNotFound(res);
  }
}

// ---- POST: operator-gated management ----------------------------------------
module.exports = async (req, res) => {
  if (req.method === 'GET') { await serveMemo(req, res); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken } = body;
    const engagementId = String(body.engagementId || '').trim();
    const action = String(body.action || '');
    if (!idToken) { res.status(401).json({ error: 'no_token' }); return; }
    if (!engagementId) { res.status(400).json({ error: 'engagement_required' }); return; }
    const ACTIONS = ['share', 'revoke-share', 'sign', 'revoke-sign', 'decide', 'revoke-decision', 'chat', 'prescreen-warm', 'prescreen-category', 'prescreen-finalise', 'prescreen-unlock'];
    if (!ACTIONS.includes(action)) { res.status(400).json({ error: 'bad_action' }); return; }

    ensureAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const caller = (decoded.email || '').toLowerCase();
    if (!caller) { res.status(401).json({ error: 'no_token' }); return; }

    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    const engRef = db.collection('engagements').doc(engagementId);
    const engSnap = await engRef.get();
    if (!engSnap.exists) { res.status(404).json({ error: 'engagement_not_found' }); return; }
    const engData = engSnap.data();
    const orgId = engData.orgId || 'default';

    // Authz — operator of this engagement's org, or super-admin. Founders excluded:
    // an assessed party cannot sign off on, or publish, their own assessment.
    const [orgSnap, cfgSnap] = await Promise.all([
      db.collection('organisations').doc(orgId).get(),
      db.doc('app/config').get()
    ]);
    const ops = ((orgSnap.exists && orgSnap.data().operatorEmails) || []).map(e => String(e).toLowerCase());
    const supers = ((cfgSnap.exists && cfgSnap.data().superAdminEmails) || []).map(e => String(e).toLowerCase());
    if (!ops.includes(caller) && !supers.includes(caller)) { res.status(403).json({ error: 'forbidden' }); return; }

    // ---- unlock: promote a pre-screened engagement to the paid tier --------------------------------
    // The tier is SERVER-SET. A client that could write its own tier could write 'full' and skip the
    // paywall entirely, which is the one thing the paywall exists to stop — so this endpoint, and not the
    // browser, is what makes a venture paid. With BILLING_ENFORCED false it is simply available; when
    // Stripe lands, a verified payment calls the same endpoint and the rest of the flow is unchanged.
    if (action === 'prescreen-unlock') {
      await engRef.set({ tier: 'full', unlockedAt: FieldValue.serverTimestamp(), unlockedBy: caller }, { merge: true });
      res.status(200).json({ ok: true, tier: 'full' });
      return;
    }

    // ---- pre-screen -------------------------------------------------------------------------------
    // Hosted here for the same reason as the chat below: the OS project sits at exactly its 12-function
    // Vercel cap, so a new api/*.js file fails the whole deploy. See design/prescreen-spec.md §6.
    //
    // THE BROWSER ORCHESTRATES, and it has to. Hobby caps one invocation at 60s and the whole run is
    // longer, so the page warms the cache once and then fans out one invocation per category. The
    // constraint produces the better UX anyway — results arrive live instead of behind a spinner.
    //
    // Both actions rebuild the corpus from Firestore rather than accepting it from the client: the cache
    // prefix must be byte-identical across all 22 calls, and a client-supplied corpus could not be
    // trusted to be (nor trusted at all — it is the thing the score is computed from).
    if (action === 'prescreen-warm' || action === 'prescreen-category' || action === 'prescreen-finalise') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.status(503).json({ error: 'model_not_configured' }); return; }
      const PS = require('./_prescreen.js');

      // LOAD THE RUBRIC FIRST, BEFORE ANYTHING IS SPENT. This is the only dynamic ESM import in any
      // deployed function, so whether Vercel's tracer bundles shared/vss-rubric.js is unproven until it
      // runs here. Doing it up front — even for the warm action, which does not need it — means a
      // bundling failure costs nothing instead of surfacing after a ~$0.40 cache write.
      let VSS_RUBRIC;
      try { ({ VSS_RUBRIC } = await import('../shared/vss-rubric.js')); }
      catch (e) { res.status(500).json({ error: 'rubric_unavailable', detail: String(e.message || e) }); return; }

      const fdSnap = await engRef.collection('founderDocs').get();
      const corpus = PS.buildCorpus(fdSnap.docs.map(d => {
        const x = d.data();
        return { name: x.name, text: x.text || '', docType: x.docType };
      }));
      // dispatch-run refuses to start without an ingested deck, and so does this: a pre-screen with no
      // evidence would return a 0-60 range that says nothing about the venture.
      if (!corpus.included) { res.status(400).json({ error: 'no_evidence', reason: 'nothing ingested yet' }); return; }

      try {
        if (action === 'prescreen-warm') {
          // ONE FREE SCORED PRE-SCREEN PER VENTURE (spec §8.6), enforced on the first action that spends
          // anything. Venture identity is the primary key; the deck fingerprint is the backstop for the
          // same company under a new name. SCOPED TO THIS ORG — two firms legitimately pre-screening the
          // same deck is normal, and telling one about the other leaks.
          //
          // The response carries the prior engagement so the UI can offer a route back ("open the
          // existing result, or unlock the full assessment") rather than a dead end: a false positive
          // blocks a genuine new venture, and that costs far more than the $1.60 a false negative does.
          const EN = await import('../shared/entitlements.js');

          // THIS engagement, already scored. The sibling scan below excludes self, so without this a
          // second press of Run re-scored the same venture for free — the cheapest possible way round
          // the rule, and reachable by accident rather than by malice. It mirrors entitlements.rescore
          // (false at prescreen tier), which is what the UI already tells the user; an endpoint that
          // disagrees with its own button is not a rule, it is a suggestion. Unlocking clears it,
          // because a full-tier engagement is paid for and re-scores through the normal path.
          if (engData.prescreen && (engData.tier || 'prescreen') === 'prescreen') {
            res.status(409).json({ error: 'already_prescreened', reason: 'self', engagementId, name: engData.name });
            return;
          }

          const fp = EN.deckFingerprint(corpus.text);
          const vk = EN.ventureKey({ name: engData.name, website: engData.website, founder: engData.founderName });
          const sibs = await db.collection('engagements').where('orgId', '==', orgId).get();

          // A prior counts if it FINISHED (`prescreenRanAt`, permanent) or is STILL IN FLIGHT — a claim
          // taken at warm time and good for CLAIM_LEASE_MS. Without the lease, abandoning a run before
          // finalise left no trace, so the same deck could be re-run under a new engagement forever,
          // spending on every attempt. A lease rather than a permanent claim because a run that dies on
          // our side (a 502 from the model) must not burn the user's one free look at that venture:
          // the claim simply expires and they may try again.
          const CLAIM_LEASE_MS = 30 * 60 * 1000;
          const millis = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v ? Date.parse(v) || 0 : 0);
          const now = Date.now();
          const priors = sibs.docs
            .filter(d => {
              if (d.id === engagementId) return false;
              const x = d.data();
              if (x.prescreenRanAt) return true;
              return (now - millis(x.prescreenClaimedAt)) < CLAIM_LEASE_MS;
            })
            .map(d => ({ id: d.id, name: d.data().name, ventureKey: d.data().prescreenVentureKey, fingerprint: d.data().prescreenFingerprint || [] }));
          const hit = EN.matchesExistingVenture({ ventureKey: vk, fingerprint: fp }, priors);
          if (hit.match) {
            res.status(409).json({ error: 'already_prescreened', reason: hit.reason, engagementId: hit.prior.id, name: hit.prior.name });
            return;
          }
          await engRef.set({ prescreenVentureKey: vk, prescreenFingerprint: fp, prescreenClaimedAt: FieldValue.serverTimestamp() }, { merge: true });

          const warm = await PS.warmCache(corpus.text, apiKey);
          // Reported, not assumed. If `wrote` is 0 across runs a silent invalidator is loose and every
          // probe is paying full price - a ~5x cost bug that is otherwise completely invisible.
          res.status(200).json({ ok: true, corpus: { tokens: corpus.tokens, included: corpus.included, total: corpus.total, dropped: corpus.dropped }, cache: warm });
          return;
        }

        if (action === 'prescreen-finalise') {
          // Composed from what the SERVER stored, never from anything posted — the score is the thing
          // being sold. A partial set is refused rather than published: a range missing a category is
          // not a narrower range, it is a wrong one.
          const stored = await engRef.collection('prescreenCategories').get();
          const byKey = Object.fromEntries(stored.docs.map(d => [d.id, d.data()]));
          const missing = VSS_RUBRIC.filter(c => !byKey[c.key]).map(c => c.key);
          if (missing.length) { res.status(409).json({ error: 'incomplete', missing }); return; }
          const cats = VSS_RUBRIC.map(c => ({ ...c, signals: byKey[c.key].signals || [] }));
          const range = PS.composeRange(cats);
          const snapshot = {
            ...range, ...PS.rangeBand(range.floor, range.ceiling),
            docCount: corpus.included, corpusTokens: corpus.tokens,
            at: new Date().toISOString(), model: PS.MODEL, draws: PS.DRAWS,
          };
          await engRef.set({
            tier: 'prescreen', prescreen: snapshot,
            prescreenRanAt: FieldValue.serverTimestamp(),
            gateStatus: 'Pre-screened',
          }, { merge: true });
          res.status(200).json({ ok: true, prescreen: snapshot });
          return;
        }

        const cat = VSS_RUBRIC.find(c => c.key === String(body.category || ''));
        if (!cat) { res.status(400).json({ error: 'bad_category' }); return; }

        const probe = await PS.probeCategory(cat, corpus.text, apiKey);
        if (!probe.draws.length) {
          // Every draw failed. Say so with the upstream status rather than publishing a category of
          // zeros, which would read as a judgement on the venture instead of a failure of ours.
          res.status(502).json({ error: 'probe_failed', category: cat.key, detail: probe.errors.slice(0, 3) });
          return;
        }
        // PERSISTED SERVER-SIDE, then read back server-side by prescreen-finalise. The browser only
        // orchestrates timing; it never carries a score between calls.
        const signals = PS.consolidate(cat, probe.draws);
        await engRef.collection('prescreenCategories').doc(cat.key).set({
          key: cat.key, label: cat.label, weight: cat.weight,
          signals, drawsUsed: probe.draws.length, at: FieldValue.serverTimestamp(),
        });
        res.status(200).json({
          ok: true, category: cat.key, label: cat.label, weight: cat.weight,
          signals, drawsUsed: probe.draws.length, errors: probe.errors, usage: probe.usage,
        });
        return;
      } catch (e) {
        // A 429 is surfaced WITH its retry-after and never silently downgraded to standard speed:
        // switching speed invalidates the prompt cache, so the rest of the run would pay full price.
        const status = e.status === 429 ? 429 : 502;
        res.status(status).json({ error: e.status === 429 ? 'rate_limited' : 'model_error', retryAfter: e.retryAfter || null, detail: e.detail || String(e.message || e) });
        return;
      }
    }

    // ---- assessment chat ----------------------------------------------------------------------------
    // Hosted here rather than in its own file because the OS project sits at its 12-function Vercel cap
    // (see api/_drive.js). It reads the same assessment objects the rest of this function already works
    // with, and it rides the authz above unchanged — operator or super-admin, founders excluded.
    //
    // THE SERVER WRITES BOTH TURNS. firestore.rules makes engagements/{id}/chat read-only to the browser,
    // so a client cannot forge an assistant message. The UI subscribes to that subcollection and the reply
    // appears when this write lands.
    if (action === 'chat') {
      const question = String(body.question || '').trim();
      if (!question) { res.status(400).json({ error: 'question_required' }); return; }
      if (question.length > 4000) { res.status(400).json({ error: 'question_too_long' }); return; }

      const chat = require('./_chat.js');
      const built = await chat.buildCorpus(db, engagementId);
      if (!built.ok) { res.status(404).json({ error: built.reason }); return; }
      if (!built.corpus.blocks.length) { res.status(409).json({ error: 'nothing_to_discuss', detail: 'This venture has no assessment, scorecard or research yet.' }); return; }

      const chatCol = engRef.collection('chat');
      const prior = await chatCol.orderBy('at', 'desc').limit(12).get();
      const history = prior.docs.map(d => d.data()).reverse()
        .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.text || '' }));

      const asked = new Date().toISOString();
      await chatCol.add({ role: 'user', text: question, by: caller, at: asked });

      let out;
      try {
        out = await chat.answer({ corpus: built.corpus, history, question });
      } catch (e) {
        // The question is already on the record, so the failure belongs there too — a conversation that
        // silently loses a turn is worse than one that shows what went wrong.
        const msg = String((e && e.message) || e).slice(0, 300);
        await chatCol.add({ role: 'assistant', text: 'That question could not be answered: ' + msg, error: true, at: new Date().toISOString() });
        res.status(502).json({ error: 'model_failed', detail: msg });
        return;
      }

      const saved = await chatCol.add({
        role: 'assistant', text: out.text, at: new Date().toISOString(),
        cited: out.used, invalid: out.invalid, stub: !!out.stub,
        unsupportedFigures: out.unsupportedFigures || [], proposals: out.proposals || [],
        dropped: out.dropped || [], usage: out.usage || null,
        corpusTokens: built.corpus.tokens,
      });
      res.status(200).json({ ok: true, id: saved.id, text: out.text, cited: out.used, invalid: out.invalid,
        unsupportedFigures: out.unsupportedFigures || [], proposals: out.proposals || [], stub: !!out.stub, dropped: out.dropped || [] });
      return;
    }

    // ---- sign-off ----
    if (action === 'revoke-sign') {
      await engRef.update({ assessmentSignoff: null, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }
    if (action === 'sign') {
      const note = body.note != null ? String(body.note).slice(0, 2000).trim() : '';
      const score = engData.investability || engData.investabilityScore || null;
      const pct = score && score.pct != null ? score.pct : null;
      const signoff = {
        by: (decoded.name && String(decoded.name).trim()) || caller,
        byEmail: caller,
        at: new Date().toISOString(),
        note: note || null,
      };
      if (pct != null) signoff.pct = pct;
      await engRef.update({ assessmentSignoff: signoff, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, signoff });
      return;
    }

    // ---- operator decision (confirm / decline the assessed deal) — a distinct, two-sided verdict, separate
    //      from sign-off (endorse-only). Identity is stamped from the VERIFIED token, never client input. ----
    if (action === 'revoke-decision') {
      await engRef.update({ assessmentDecision: null, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }
    if (action === 'decide') {
      const verdict = String(body.decision || '').toLowerCase();
      if (verdict !== 'confirmed' && verdict !== 'declined') { res.status(400).json({ error: 'bad_decision' }); return; }
      const note = body.note != null ? String(body.note).slice(0, 2000).trim() : '';
      const score = engData.investability || engData.investabilityScore || null;
      const pct = score && score.pct != null ? score.pct : null;
      const decision = {
        decision: verdict,
        by: (decoded.name && String(decoded.name).trim()) || caller,
        byEmail: caller,
        at: new Date().toISOString(),
        note: note || null,
      };
      if (pct != null) decision.pct = pct;
      await engRef.update({ assessmentDecision: decision, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, decision });
      return;
    }

    // ---- share link ----
    const prevToken = (engData.shareLink && engData.shareLink.token) || null;

    if (action === 'revoke-share') {
      if (prevToken) await db.collection('sharedMemos').doc(prevToken).delete().catch(() => {});
      await engRef.update({ shareLink: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, revoked: true });
      return;
    }

    // action === 'share' — STABLE link. Reuse the engagement's existing token if it has
    // one (refresh in place → same url the IC already has); mint only on first share.
    const html = String(body.html || '');
    if (!html || html.length < 200) { res.status(400).json({ error: 'empty_memo' }); return; }
    if (html.length > MAX_HTML) { res.status(413).json({ error: 'memo_too_large' }); return; }
    const meta = body.meta || {};

    const isRefresh = !!prevToken;
    const token = prevToken || crypto.randomBytes(24).toString('base64url');   // 32 url-safe chars
    const docData = {
      html,
      engagementId,
      orgId,
      name: String(meta.name || engData.name || 'Venture').slice(0, 200),
      pct: (meta.pct != null ? meta.pct : null),
      updatedBy: caller,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (!isRefresh) { docData.createdBy = caller; docData.createdAt = FieldValue.serverTimestamp(); }
    await db.collection('sharedMemos').doc(token).set(docData, { merge: isRefresh });

    const link = { token, by: caller, at: new Date().toISOString() };
    if (meta.pct != null) link.pct = meta.pct;
    await engRef.update({ shareLink: link, updatedAt: FieldValue.serverTimestamp() });

    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'os.ventrify.io');
    res.status(200).json({ ok: true, token, url: `${origin}/m/${token}`, refreshed: isRefresh });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
