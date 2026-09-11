import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DocumentRequestGate } from './document-request-gate';

test('a late response from document A cannot populate route B even with equal versions', async () => {
  const gate = new DocumentRequestGate(); gate.setScope('patient-a', 'doc-a');
  const a = gate.begin();
  let finish!: (value: { id: string; patientId: string; version: number }) => void;
  const delayed = new Promise<{ id: string; patientId: string; version: number }>((resolve) => { finish = resolve; });
  gate.setScope('patient-b', 'doc-b'); const b = gate.begin();
  assert.equal(gate.accepts(b, { id: 'doc-b', patientId: 'patient-b', version: 4 }), true);
  finish({ id: 'doc-a', patientId: 'patient-a', version: 4 });
  assert.equal(gate.accepts(a, await delayed), false);
});

test('new reads supersede old reads, and responses cannot change route identity', () => {
  const gate = new DocumentRequestGate(); gate.setScope('p', 'd');
  const old = gate.begin(); const latest = gate.begin();
  assert.equal(gate.accepts(old, { id: 'd', patientId: 'p', version: 2 }), false);
  assert.equal(gate.accepts(latest, { id: 'other', patientId: 'p', version: 2 }), false);
  assert.equal(gate.accepts(latest, { id: 'd', patientId: 'other', version: 2 }), false);
  assert.equal(gate.accepts(latest, { id: 'd', patientId: 'p', version: 2 }), true);
});

test('unmount invalidation and a newer document version reject pending polling', () => {
  const gate = new DocumentRequestGate(); gate.setScope('p', 'd');
  const ticket = gate.begin();
  assert.equal(gate.accepts(ticket, { id: 'd', patientId: 'p', version: 2 }, 3), false);
  gate.invalidate();
  assert.equal(gate.accepts(ticket, { id: 'd', patientId: 'p', version: 4 }), false);
});
