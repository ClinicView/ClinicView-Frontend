import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  clearRecordMediaObjectUrls,
  getRecordMediaBlockingMessage,
  isRecordMediaSubmissionBlocked,
  removeRecordMediaObjectUrl,
  replaceRecordMediaObjectUrl,
  retryRecordMediaQueueItem,
} from './record-media-state';

test('bloquea el envío durante cargas, errores, recuperación o eliminación', () => {
  const idle = {
    hasPendingUploads: false,
    hasUploadErrors: false,
    hasMetadataPending: false,
    hasMetadataErrors: false,
    isRemoving: false,
  };
  assert.equal(isRecordMediaSubmissionBlocked(idle), false);

  for (const key of Object.keys(idle) as Array<keyof typeof idle>) {
    assert.equal(isRecordMediaSubmissionBlocked({ ...idle, [key]: true }), true);
    assert.ok(getRecordMediaBlockingMessage({ ...idle, [key]: true }));
  }
  assert.equal(getRecordMediaBlockingMessage(idle), null);
});

test('reintentar conserva el archivo y devuelve solo el error elegido a la cola', () => {
  const queue = [
    { id: 'a', status: 'error', error: 'falló', name: 'a.png' },
    { id: 'b', status: 'rejected', error: 'tipo inválido', name: 'b.gif' },
  ];
  const retried = retryRecordMediaQueueItem(queue, 'a');

  assert.deepEqual(retried[0], { id: 'a', status: 'queued', error: undefined, name: 'a.png' });
  assert.equal(retried[1], queue[1]);
  assert.deepEqual(retryRecordMediaQueueItem(queue, 'b'), queue);
});

test('revoca object URLs reemplazadas, removidas y restantes al limpiar', () => {
  const registry = new Map<string, string>();
  const revoked: string[] = [];
  const revoke = (url: string) => revoked.push(url);

  replaceRecordMediaObjectUrl(registry, 'asset-a', 'blob:first', revoke);
  replaceRecordMediaObjectUrl(registry, 'asset-a', 'blob:second', revoke);
  replaceRecordMediaObjectUrl(registry, 'asset-b', 'blob:third', revoke);
  removeRecordMediaObjectUrl(registry, 'asset-a', revoke);
  clearRecordMediaObjectUrls(registry, revoke);

  assert.deepEqual(revoked, ['blob:first', 'blob:second', 'blob:third']);
  assert.equal(registry.size, 0);
});
