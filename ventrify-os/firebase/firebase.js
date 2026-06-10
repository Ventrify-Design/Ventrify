// ============================================================
// Ventrify OS — Firebase init (shared by Workspace + Studio)
//
// Initializes one Firebase app and exposes auth / db / storage handles.
// CDN/ESM — no build step. Import this from any <script type="module">.
//
// ⚠️ SDK VERSION: the four URLs below are pinned to 11.1.0. When you copy
// your config from the Firebase console, its snippet shows a version like
// `firebasejs/XX.Y.Z`. If it differs, find-and-replace "11.1.0" in THIS file
// to match (otherwise the imports may 404).
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js';

import { firebaseConfig, FIREBASE_ENABLED } from './config.js';

export { FIREBASE_ENABLED };

// Initialize lazily-but-eagerly: importing this module wires the app up.
// With placeholder config these handles are inert until a real call is made,
// so importing is harmless while FIREBASE_ENABLED is false.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
