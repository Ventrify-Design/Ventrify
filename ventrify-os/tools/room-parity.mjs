#!/usr/bin/env node
// ============================================================
// room-parity — DS.ROOM_CLASSES must match api/_roomcheck.js's CLASSES, exactly.
//
// _roomcheck.js's own header says it mirrors the rubric and invents nothing, "because a checklist invented
// here would eventually disagree with the score, and the score is the thing being sold". The create screen's
// idle panel needs those same six classes BEFORE anything has been uploaded and before any engagement
// exists to check — and the browser cannot require a CommonJS api/ module, so there is a second copy.
//
// The objection was always to DRIFT, not to a copy. This is what makes the copy safe: change one, change
// both, or the build stops. Key, label and want must all agree, in the same order.
// ============================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { CLASSES } = require('../api/_roomcheck.js');
const { ROOM_CLASSES } = await import('../shared/m3/ds.js');

let fails = 0;
const fail = m => { console.log('  ✗ ' + m); fails++; };

console.log('room-parity — DS.ROOM_CLASSES vs api/_roomcheck.js CLASSES\n');

if (CLASSES.length !== ROOM_CLASSES.length) {
  fail(`count: server has ${CLASSES.length} classes, the DS has ${ROOM_CLASSES.length}`);
}

const n = Math.max(CLASSES.length, ROOM_CLASSES.length);
for (let i = 0; i < n; i++) {
  const sv = CLASSES[i], ds = ROOM_CLASSES[i];
  if (!sv) { fail(`${ds.key}: in the DS but not in the scorer — the panel promises a class nothing checks`); continue; }
  if (!ds) { fail(`${sv.key}: the scorer counts it but the DS panel never names it`); continue; }
  if (sv.key !== ds.key)     fail(`position ${i}: key "${sv.key}" (server) vs "${ds.key}" (DS) — order must match, the panel is read top to bottom`);
  if (sv.label !== ds.label) fail(`${sv.key}.label:\n      server: ${sv.label}\n      DS:     ${ds.label}`);
  if (sv.want !== ds.want)   fail(`${sv.key}.want:\n      server: ${sv.want}\n      DS:     ${ds.want}`);
}

if (!fails) {
  console.log(`  ${CLASSES.length} classes, key + label + want identical and in the same order`);
  for (const c of CLASSES) console.log(`    · ${c.label}`);
}

console.log('');
console.log(fails ? `FAIL — ${fails} drift(s) between the panel and the scorer` : 'PASS — the data-room panel says exactly what the scorer counts');
process.exit(fails ? 1 : 0);
