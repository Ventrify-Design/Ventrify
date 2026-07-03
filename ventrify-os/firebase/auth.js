// ============================================================
// Ventrify OS — Email-link ("magic link") auth helpers
//
// Shared by the Workspace (operator) and Studio (founder) sign-in pages.
// Firebase Auth sends the email itself — no SMTP, works on the free plan.
//
// Flow:
//   1. sendMagicLink(email, continueUrl) — Firebase emails a one-time link.
//   2. The user clicks it → lands back on `continueUrl` with auth params.
//   3. completeMagicLinkIfPresent() — call on page load; finishes sign-in.
//   4. watchAuth(cb) — react to the signed-in user (cb(user|null)).
// ============================================================

import { auth } from './firebase.js';
import {
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

// Where we stash the email between "send" and "complete" so the same-device
// return doesn't re-prompt (Firebase email-link best practice).
const EMAIL_KEY = 'ventrify.pendingEmail';

// Send the magic link. `continueUrl` is where Firebase returns the user after
// they click it in their inbox — defaults to the current page. The host of
// continueUrl must be in Auth → Settings → Authorized domains (localhost is
// authorized by default).
export async function sendMagicLink(email, continueUrl) {
  const url = continueUrl || window.location.href;
  // Stash first so same-device return completes without re-prompting.
  window.localStorage.setItem(EMAIL_KEY, email);

  // Primary path: send the branded link via Resend (/api/send-login-link). This
  // avoids Firebase's built-in email-send DAILY QUOTA (auth/quota-exceeded) that
  // repeated testing exhausts. On localhost/dev the function isn't served, so we
  // fall back to Firebase's built-in sender (which is fine there).
  try {
    const surface = /\/studio\//.test(url) ? 'Studio' : 'Workspace';
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'login', email, continueUrl: url, surface })
    });
    if (resp.ok) return;                       // sent via Resend — done
    // Function reachable but errored (e.g. not configured) → fall through.
  } catch (e) { /* function not available (dev) → fall through */ }

  await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
}

// Send a sign-in ("invite") link to SOMEONE ELSE's address — e.g. an operator
// inviting their client/founder. Unlike sendMagicLink, it does NOT stash the
// email locally: the recipient completes it on their own device/browser, where
// completeMagicLinkIfPresent() will prompt them to confirm the address.
export async function sendInviteLink(email, continueUrl) {
  const actionCodeSettings = { url: continueUrl, handleCodeInApp: true };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
}

// Call once on page load. If the current URL is a sign-in link, completes the
// sign-in and returns the user; otherwise returns null. Cleans the auth params
// out of the URL so a refresh doesn't re-trigger.
export async function completeMagicLinkIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  let email = window.localStorage.getItem(EMAIL_KEY);
  if (!email) {
    // Link opened on a different device/browser → confirm the address.
    email = window.prompt('Confirm the email address this invite was sent to:');
  }
  if (!email) return null;
  const cred = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(EMAIL_KEY);
  // Drop Firebase's auth query params, keep our own (e.g. ?id=) intact.
  const url = new URL(window.location.href);
  ['apiKey', 'oobCode', 'mode', 'continueUrl', 'lang', 'tenantId'].forEach(p => url.searchParams.delete(p));
  window.history.replaceState({}, document.title, url.pathname + (url.search || '') + url.hash);
  return cred.user;
}

// Subscribe to auth state. Returns an unsubscribe function.
export function watchAuth(cb) { return onAuthStateChanged(auth, cb); }

export function signOutUser() { return signOut(auth); }

export function pendingEmail() { return window.localStorage.getItem(EMAIL_KEY); }
