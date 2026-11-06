#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE QUEUE — the "advance to a full assessment" stage must be visible, and must hand over.
//
// The feature is a stage, not a send. An operator who tells a founder "you are through, here is what we
// need" is then WAITING, and the thing that makes that a workflow rather than an email is that the
// Workspace knows it and says so — and stops saying so the moment the founder answers.
//
// Everything here is DERIVED. There is no advance.status to maintain, because a status field is a fourth
// thing that can disagree with the engagement, the room and the queue. The rules:
//
//   advance sent · still a pre-screen · no new documents  ->  "Waiting on <venture>"
//   advance sent · new documents in the room              ->  the dataRoom item takes over, and names
//                                                             the full-assessment request specifically
//   unlocked to `full`                                    ->  the wait is over by construction
//
// Run: node tools/advance-queue.mjs   [--canary]
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANARY = process.argv.includes('--canary');

// agents.js is a browser IIFE that hangs its exports on `window`. Run it in a sandbox with a fake
// window rather than importing it — the point is to exercise the REAL derivation, not a copy of it.
function loadAgents(src) {
  const sandbox = { window: {}, console, Date, Math, JSON };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'agents.js' });
  const A = sandbox.window.WORKSPACE_AGENTS;
  if (!A || typeof A.computeActionQueue !== 'function') throw new Error('agents.js did not expose computeActionQueue');
  return A;
}

const OP = 'op-alex';
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const base = {
  id: 'prg-verdana', name: 'Verdana Bio', engagementType: 'assessment', assignedOperator: OP,
  tier: 'prescreen', pitchDoc: { title: 'deck.pdf' }, lastActivity: '2 days ago',
  runState: { status: 'idle' }, cards: {},
};

const CASES = [
  { label: 'no advance sent',
    p: { ...base },
    want: t => t !== 'assessment-awaiting-founder' },
  { label: 'advance sent, nothing back yet',
    p: { ...base, advance: { sentAt: daysAgo(2), to: 'jane@verdana.bio', asks: 4 } },
    want: t => t === 'assessment-awaiting-founder' },
  { label: 'advance sent 9 days ago — chase',
    p: { ...base, advance: { sentAt: daysAgo(9), to: 'jane@verdana.bio', asks: 4 } },
    want: t => t === 'assessment-awaiting-founder',
    also: a => a.urgency === 'medium' && /chase/i.test(a.detail) },
  { label: 'founder answered — the room item takes over',
    p: { ...base, advance: { sentAt: daysAgo(3), to: 'jane@verdana.bio', asks: 4 },
         dataRoom: { pending: { added: 3, names: ['Cap table.xlsx'], detectedAt: daysAgo(0) } } },
    want: t => t === 'dataroom-new',
    also: a => /full-assessment request/i.test(a.detail) && /run the full assessment/i.test(a.detail) },
  { label: 'unlocked to full — the wait is over',
    p: { ...base, tier: 'full', advance: { sentAt: daysAgo(2), to: 'jane@verdana.bio', asks: 4 } },
    want: t => t !== 'assessment-awaiting-founder' },
  { label: 'answered, but it was a plain docs request',
    p: { ...base, dataRoom: { lastRequestAt: daysAgo(4), pending: { added: 1, names: ['Model.xlsx'], detectedAt: daysAgo(0) } } },
    want: t => t === 'dataroom-new',
    also: a => /document request/i.test(a.detail) && !/full-assessment request/i.test(a.detail) },
];

function run(src) {
  const A = loadAgents(src);
  const out = [];
  for (const c of CASES) {
    const q = A.computeActionQueue([c.p], OP);
    const item = q[0] || null;
    const type = item ? item.type : '(none)';
    let ok = c.want(type);
    if (ok && c.also && item) ok = !!c.also(item);
    out.push({ label: c.label, type, ok, detail: item ? item.detail : '', urgency: item ? item.urgency : '' });
  }
  return out;
}

const src = fs.readFileSync(path.join(ROOT, 'workspace/agents.js'), 'utf8');

if (CANARY) {
  // A gate that cannot fail is decoration. Break the handover both ways.
  const neverWaits = src.replace("if (adv2.sentAt && (p.tier || 'full') === 'prescreen') {", 'if (false) {');
  const alwaysWaits = src.replace("const room = p.dataRoom || {}, pend = room.pending;", 'const room = {}, pend = null;');
  const a = run(neverWaits).filter(r => !r.ok);
  const b = run(alwaysWaits).filter(r => !r.ok);
  const healthy = run(src).filter(r => !r.ok);
  const checks = [
    ['wait item removed', a.length > 0],
    ['handover broken (room item never fires)', b.length > 0],
    ['healthy source clean', healthy.length === 0],
  ];
  checks.forEach(([l, ok]) => console.log(`  canary ${l.padEnd(42)} ${ok ? 'caught' : 'MISSED'}`));
  healthy.forEach(r => console.log(`      unexpected: ${r.label} → ${r.type}`));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

const results = run(src);
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.label.padEnd(42)} → ${r.type}${r.urgency ? ' · ' + r.urgency : ''}`);
  if (!r.ok && r.detail) console.log(`      ${r.detail.slice(0, 110)}`);
}
const bad = results.filter(r => !r.ok).length;
console.log(bad
  ? `\n  FAIL — ${bad} of ${results.length} cases`
  : `  PASS — the wait appears, hands over when the founder answers, and ends when the tier does (${results.length} cases)`);
process.exit(bad ? 1 : 0);
