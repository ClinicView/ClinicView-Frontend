import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  PatientRegistrationDraft,
  SavePatientRegistrationDraftData,
} from '../types/patient';
import {
  emptyPatientRegistrationForm,
  formFromPatientRegistrationDraft,
  getPatientDraftValidationIssue,
  hasMeaningfulPatientRegistrationData,
  PatientRegistrationDraftMutationQueue,
  toPatientRegistrationDraftPayload,
} from './patient-registration-draft';

function draft(version: number): PatientRegistrationDraft {
  return {
    id: '4cd8f450-b61f-4caa-a593-02a5670e2c3d',
    version,
    payload: { firstName: 'María' },
    expiresAt: '2026-09-10T15:00:00.000Z',
    createdAt: '2026-09-03T15:00:00.000Z',
    updatedAt: '2026-09-03T15:00:00.000Z',
  };
}

test('normaliza el payload sin inventar valores y restaura campos vacíos', () => {
  const form = {
    ...emptyPatientRegistrationForm(),
    documentType: 'DNI',
    documentNumber: '12345678',
    firstName: 'María',
  };
  const payload = toPatientRegistrationDraftPayload(form);

  assert.deepEqual(payload, {
    documentType: 'DNI',
    documentNumber: '12345678',
    firstName: 'María',
  });
  assert.deepEqual(formFromPatientRegistrationDraft(payload), form);
  assert.equal(hasMeaningfulPatientRegistrationData(form), true);
  assert.equal(hasMeaningfulPatientRegistrationData(emptyPatientRegistrationForm()), false);
});

test('identifica un correo todavía no guardable sin invalidar el resto del borrador', () => {
  assert.match(
    getPatientDraftValidationIssue({
      ...emptyPatientRegistrationForm(),
      email: 'correo-incompleto',
    }) ?? '',
    /correo electrónico/,
  );
  assert.equal(
    getPatientDraftValidationIssue({
      ...emptyPatientRegistrationForm(),
      email: 'paciente@clinicview.local',
    }),
    null,
  );
});

test('serializa guardados y usa la versión confirmada por la mutación anterior', async () => {
  const requests: SavePatientRegistrationDraftData[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const queue = new PatientRegistrationDraftMutationQueue({
    save: async (data) => {
      requests.push(data);
      if (requests.length === 1) await firstGate;
      return draft(requests.length);
    },
    remove: async () => undefined,
  });

  const first = queue.save({ firstName: 'María' });
  const second = queue.save({ firstName: 'María Elena' });
  await Promise.resolve();
  assert.equal(requests.length, 1);

  releaseFirst?.();
  await Promise.all([first, second]);

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.expectedId, undefined);
  assert.equal(requests[1]?.expectedId, draft(1).id);
  assert.equal(requests[1]?.expectedVersion, 1);
  assert.equal(queue.current()?.version, 2);
});

test('elimina con CAS usando la identidad más reciente y limpia la cola', async () => {
  const removed: Array<[string, number]> = [];
  const queue = new PatientRegistrationDraftMutationQueue({
    save: async () => draft(4),
    remove: async (id, version) => { removed.push([id, version]); },
  });
  queue.replace(draft(3));

  await queue.save({ firstName: 'Ana' });
  await queue.remove();

  assert.deepEqual(removed, [[draft(4).id, 4]]);
  assert.equal(queue.current(), null);
});

test('un fallo conserva la identidad observada hasta una recarga explícita', async () => {
  const requests: SavePatientRegistrationDraftData[] = [];
  const queue = new PatientRegistrationDraftMutationQueue({
    save: async (data) => {
      requests.push(data);
      if (requests.length === 1) throw new Error('conflict');
      return draft(9);
    },
    remove: async () => undefined,
  });
  queue.replace(draft(2));

  await assert.rejects(queue.save({ firstName: 'Local' }), /conflict/);
  assert.equal(queue.current()?.version, 2);

  queue.replace(draft(8));
  await queue.save({ firstName: 'Recargado' });
  assert.equal(requests[1]?.expectedVersion, 8);
});
