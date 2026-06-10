// ============================================================
// Ventrify OS — Firebase web config
//
// 1. Create your project + Web app in the Firebase console.
// 2. Project settings (⚙ gear, top-left) → General → "Your apps" → Web app
//    → "SDK setup and configuration" → select "Config".
// 3. Paste the firebaseConfig object's values below.
// 4. Set FIREBASE_ENABLED = true.
//
// NOTE: this is PUBLIC client config — safe to commit. It only *identifies*
// the project; it grants no access. Access is enforced by Firebase Auth +
// Firestore/Storage security rules (added in a later phase).
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAMSEW2YwLKZDFe9PUx1bEv8OUU1FPENcA",
  authDomain: "ventrify-os.firebaseapp.com",
  projectId: "ventrify-os",
  storageBucket: "ventrify-os.firebasestorage.app",
  messagingSenderId: "981735214865",
  appId: "1:981735214865:web:c9afc794e32ad5a50086b0"
};

// Live. Set to false to fall every page back to localStorage/demo behaviour.
export const FIREBASE_ENABLED = true;
