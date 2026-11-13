#!/usr/bin/env node
/**
 * tools/setup-partner-org.mjs — stand up the workspace a widget partner's pre-screens land in.
 *
 * WHY THIS IS A SCRIPT AND NOT A ONE-OFF. The whole point of the widget is that the
 * next partner costs a script tag, not a fork. The server side has to match: adding
 * Harbour VC should be this command plus one env var, not an afternoon of reading
 * what was done for TCA and hoping it was written down.
 *
 * WHY A DEDICATED ORG, EVERY TIME. `organisations/default` IS "TCA Venture Group" —
 * the live workspace, with real TCA people on it — and it is also the codebase-wide
 * fallback for an engagement with no orgId. `tca-venture-group-oc` has a real TCA
 * operator on it too. Widget traffic is unvetted by definition: a stranger on a
 * partner's website. It does not belong in a workspace a customer is working in.
 *
 * THE SERVICE OPERATOR is a real account that this org lists, because /api/memo gates
 * every pre-screen phase on org membership and the sweeper goes through that gate
 * rather than around it. Revoking the sweeper is then the same gesture as revoking a
 * colleague: take it off the org.
 *
 *   node tools/setup-partner-org.mjs --partner "TCA Venture Group" --org tca-widget
 *   ...                                                                     --apply
 *
 * Nothing is written without --apply.
 */
import { initAdmin } from './contract-auth.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const APPLY     = process.argv.includes('--apply');
const PARTNER   = arg('partner');
const ORG       = arg('org');
const OPERATOR  = arg('operator', 'sweeper@ventrify.io');
const PRESCREENS = Number(arg('prescreens', 500));

if (!PARTNER || !ORG) {
  console.log('usage: node tools/setup-partner-org.mjs --partner "<name as the widget posts it>" --org <orgId> [--operator <email>] [--apply]');
  process.exit(1);
}

const a = await initAdmin();
const db = a.firestore();

console.log(`\n  partner   ${JSON.stringify(PARTNER)}   (must match the widget's data-partner EXACTLY)`);
console.log(`  org       ${ORG}`);
console.log(`  operator  ${OPERATOR}`);
console.log(`  mode      ${APPLY ? 'APPLY — this writes' : 'dry run — nothing will be written'}\n`);

/* Refuse to point a partner at a workspace someone is already using. The limit on
   widget traffic is a cap in /api/intake, not a customer's goodwill. */
const existing = await db.collection('organisations').doc(ORG).get();
if (existing.exists && !(existing.data().plan || {}).widget) {
  const d = existing.data();
  const engs = await db.collection('engagements').where('orgId', '==', ORG).get();
  console.log(`  ! ${ORG} already exists: ${JSON.stringify(d.name)}, ${engs.size} engagement(s),`);
  console.log(`    operators ${(d.operatorEmails || []).join(', ')}`);
  console.log('    It was not created by this script. Pick an unused orgId rather than');
  console.log('    sharing a workspace between a customer and anonymous widget traffic.\n');
  process.exit(1);
}

/* The account must EXIST for admin.auth().getUserByEmail() to mint the sweeper a
   token. It never signs in interactively and holds no password. */
let user = null;
try { user = await a.auth().getUserByEmail(OPERATOR); console.log(`  ✓ auth user exists  ${OPERATOR} (${user.uid})`); }
catch { console.log(`  · auth user MISSING ${OPERATOR} — ${APPLY ? 'creating it' : 'would be created'}`); }

if (APPLY) {
  if (!user) user = await a.auth().createUser({ email: OPERATOR, emailVerified: true, displayName: 'Ventrify intake sweeper' });
  await db.collection('organisations').doc(ORG).set({
    name: `${PARTNER} (widget)`,
    slug: ORG,
    ownerEmail: OPERATOR,
    operatorEmails: a.firestore.FieldValue.arrayUnion(OPERATOR),
    plan: {
      preset: 'widget', widget: true,
      capabilities: { assess: true, build: false },
      /* The REAL throttle on widget traffic is INTAKE_PARTNER_CAP in /api/intake,
         which is per calendar month. This is a backstop, not the commercial lever. */
      limits: { assessments: 0, builds: 0, prescreens: PRESCREENS },
    },
    createdAt: a.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ org written       ${ORG}`);
}

console.log('\n  Set these on the ventrify-mzil Vercel project (Production), then redeploy:\n');
console.log(`    INTAKE_PARTNER_ORGS   ${PARTNER}=${ORG}`);
console.log(`    INTAKE_RUN_OPERATOR   ${OPERATOR}`);
console.log('\n  (INTAKE_PARTNER_ORGS takes a comma-separated list — append, do not replace,');
console.log('   when you add the next partner.)\n');
if (!APPLY) console.log('  Nothing was written. Re-run with --apply.\n');
