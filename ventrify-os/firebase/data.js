// ============================================================
// Ventrify OS — Firestore data-access layer
//
// The single seam between the app and Firestore. Every page reads/writes
// engagements + org through these functions, so swapping localStorage for
// the cloud is contained here. Pure Firestore — callers decide WHEN to use
// it (FIREBASE_ENABLED + signed-in) vs the demo/localStorage fallback.
//
// Model:
//   organisations/{orgId}        { name, slug, primaryColor, logoUrl, tier }
//   engagements/{engagementId}   { orgId, founderEmail, ...program fields, brief }
//
// Single-tenant for now (ORG_ID = 'default'). When multi-org lands, ORG_ID
// becomes the signed-in user's org and the queries already filter on it.
// ============================================================

import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

// The active org for this session. Defaults to 'default' until the signed-in
// operator's org is resolved (multi-tenant) via setOrgContext.
let ORG_ID = 'default';
export function setOrgContext(id) { ORG_ID = id || 'default'; }
export function getOrgContext() { return ORG_ID; }

const orgRef = () => doc(db, 'organisations', ORG_ID);
const engCol  = () => collection(db, 'engagements');
const engRef  = (id) => doc(db, 'engagements', id);

// ---- Organisation ---------------------------------------------------------
export async function getOrganisation() {
  const snap = await getDoc(orgRef());
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveOrganisation(org) {
  await setDoc(orgRef(), { ...org, updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Multi-tenant: org resolution -----------------------------------------
// An operator's org = the org whose operatorEmails contains their email.
export async function findOperatorOrg(email) {
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return null;
  const snap = await getDocs(query(collection(db, 'organisations'), where('operatorEmails', 'array-contains', norm)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}
export async function isSuperAdmin(email) {
  const norm = (email || '').trim().toLowerCase();
  try {
    const snap = await getDoc(doc(db, 'app', 'config'));
    const list = (snap.exists() && snap.data().superAdminEmails) || [];
    return list.map(e => String(e).toLowerCase()).includes(norm);
  } catch (e) { return false; }
}
export async function getOrg(orgId) {
  const snap = await getDoc(doc(db, 'organisations', orgId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function listOrgs() {
  const snap = await getDocs(collection(db, 'organisations'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Engagements ----------------------------------------------------------
// Create using the caller's id (keeps the prg-<slug>-<rand> convention and
// stable Studio URLs). Stamps orgId + timestamps.
export async function createEngagement(engagement) {
  const id = engagement.id;
  if (!id) throw new Error('createEngagement: engagement.id is required');
  await setDoc(engRef(id), {
    ...engagement,
    founderEmail: (engagement.founderEmail || '').trim().toLowerCase(),
    orgId: ORG_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return id;
}

export async function getEngagement(id) {
  const snap = await getDoc(engRef(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// All engagements for the current org (the operator's portfolio).
export async function listEngagements() {
  const snap = await getDocs(query(engCol(), where('orgId', '==', ORG_ID)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Engagements a given founder owns (matched by the email on their invite).
export async function listEngagementsForFounder(email) {
  const norm = (email || '').trim().toLowerCase();
  const snap = await getDocs(query(engCol(), where('founderEmail', '==', norm)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateEngagement(id, patch) {
  await updateDoc(engRef(id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteEngagement(id) {
  await deleteDoc(engRef(id));
}

// Full delete: remove the engagement AND its provocation cards. Cards are
// deleted first (their delete rule reads the still-existing engagement doc),
// then the engagement. Investability snapshots, if any, are left as harmless
// orphans (clients can't delete them under the rules; nothing renders them
// once the engagement is gone). Removing the engagement makes it disappear
// from BOTH surfaces (Workspace + Studio share this Firestore).
export async function deleteEngagementDeep(id) {
  const cardsSnap = await getDocs(query(cardCol(), where('engagementId', '==', id)));
  await Promise.all(cardsSnap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(engRef(id));
}

// Founder submits their brief → stored on the engagement, flips briefSubmitted.
export async function saveBrief(id, brief) {
  await updateDoc(engRef(id), {
    brief,
    briefSubmitted: true,
    briefSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// ---- Run orchestration (web → headless runner trigger) --------------------
// The operator clicks "Run research" → we stamp runState.status='queued' on the
// engagement. The headless runner in the engagement repo (Admin SDK) watches for
// this, flips it to 'running', drives the real Phase-1 agents, and writes
// progress (step/totalSteps/label) + final status back here. The web only ever
// REQUESTS a run — it never executes one — so the surface is runner-agnostic
// (local machine today, GitHub Actions later, same shape).
//
// runState = { status, phase, step, totalSteps, label, requestedAt, startedAt,
//              finishedAt, error, usage }
//   status: queued | running | partial | done | error | limit-paused | idle
const RUN_LOCKED = ['queued', 'running', 'partial'];
export function isRunActive(runState) {
  return !!(runState && RUN_LOCKED.includes(runState.status));
}
export function canRequestRun(runState) {
  return !isRunActive(runState);
}
export async function requestRun(engagementId, phase = 'research', requestedBy = null) {
  await updateDoc(engRef(engagementId), {
    runState: {
      status: 'queued',
      phase,
      step: 0,
      totalSteps: 0,
      progress: 0,
      label: 'Queued — waiting for the engagement runner to pick this up',
      requestedBy: requestedBy || null,
      requestedAt: new Date().toISOString()
    },
    updatedAt: serverTimestamp()
  });
}

// ---- Live subscriptions (real-time cross-surface updates) -----------------
// cb receives the full engagement array on every change. Returns unsubscribe.
export function watchEngagements(cb) {
  return onSnapshot(query(engCol(), where('orgId', '==', ORG_ID)), (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function watchEngagement(id, cb) {
  return onSnapshot(engRef(id), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ---- Provocation cards + founder responses --------------------------------
// L1 provocation cards (generated by the engagement repo's portal-publisher,
// or seeded for now). The founder responds in the Studio; the operator reads
// the response back in the Workspace. founderResponse is embedded on the card.
const cardCol = () => collection(db, 'cards');
const cardRef = (id) => doc(db, 'cards', id);

function sortCards(cards) {
  return cards.sort((a, b) => (a.hub || '').localeCompare(b.hub || '') || (a.order || 0) - (b.order || 0));
}

export async function createCard(card) {
  const id = card.id || ('card-' + Math.random().toString(36).slice(2, 10));
  await setDoc(cardRef(id), {
    level: 'L1', status: 'awaiting-founder', founderResponse: null,
    ...card,
    id, orgId: ORG_ID, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return id;
}

export async function getCard(id) {
  const snap = await getDoc(cardRef(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// All cards for one engagement (sorted by hub then order, client-side, so no
// composite index is needed).
export async function listCardsForEngagement(engagementId) {
  const snap = await getDocs(query(cardCol(), where('engagementId', '==', engagementId)));
  return sortCards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

// Founder answers a card: accept / reject / reshape (+ optional comment).
export async function respondToCard(cardId, response) {
  await updateDoc(cardRef(cardId), {
    founderResponse: { decision: response.decision || 'reshape', comment: response.comment || '', respondedAt: 'just now' },
    status: 'responded',
    updatedAt: serverTimestamp()
  });
}

export async function updateCard(id, patch) {
  await updateDoc(cardRef(id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteCard(id) { await deleteDoc(cardRef(id)); }

// ---- Draft → sent gate ----------------------------------------------------
// Agent-generated cards land as status:'draft' (operator-only). The operator
// reviews them in the Workspace, then RELEASES them to the founder — only then
// do they become 'awaiting-founder' and appear in the Studio. This is the
// human gate between "the agents ran" and "the founder sees it".
export async function listSentCardsForEngagement(engagementId) {
  const cards = await listCardsForEngagement(engagementId);
  return cards.filter(c => c.status && c.status !== 'draft');
}

export async function sendCardToFounder(cardId) {
  await updateDoc(cardRef(cardId), {
    status: 'awaiting-founder', sentAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}

// Welcome pack — operator releases the reviewed draft pack to the founder's Studio.
export async function sendWelcomePack(engagementId) {
  await updateDoc(engRef(engagementId), {
    'welcomePack.status': 'sent', 'welcomePack.sentAt': serverTimestamp(), updatedAt: serverTimestamp()
  });
}

// Release every still-draft card for an engagement in one click. Returns count.
export async function sendDraftsToFounder(engagementId) {
  const drafts = (await listCardsForEngagement(engagementId)).filter(c => c.status === 'draft');
  await Promise.all(drafts.map(c => updateDoc(cardRef(c.id), {
    status: 'awaiting-founder', sentAt: serverTimestamp(), updatedAt: serverTimestamp()
  })));
  return drafts.length;
}

export function watchCardsForEngagement(engagementId, cb) {
  return onSnapshot(query(cardCol(), where('engagementId', '==', engagementId)), (snap) => {
    cb(sortCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  });
}

// ---- Investability snapshots (the living VSS trajectory) -------------------
// Published by the engagement repo (tools/cloud/publish.js) every time the
// operator re-scores. Ordered oldest→newest for the trajectory chart.
export async function listInvestabilitySnapshots(engagementId) {
  const col = collection(db, 'engagements', engagementId, 'investabilitySnapshots');
  const snap = await getDocs(query(col, orderBy('computedAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Data-room L3 hub content (deep research / strategy / financials) ------
// Published by the engagement repo (tools/cloud/publish-hubs.js). Sorted by hub
// then order so both surfaces render a stable data room.
export async function listHubDocs(engagementId) {
  const col = collection(db, 'engagements', engagementId, 'hubDocs');
  const snap = await getDocs(col);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.hub || '').localeCompare(b.hub || '') || (a.order || 0) - (b.order || 0));
}
