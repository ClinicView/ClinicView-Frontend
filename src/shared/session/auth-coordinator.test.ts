import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  AuthOperationCancelledError,
  AuthOperationTimeoutError,
  beginLoginTransition,
  completeLoginTransition,
  getAuthEpoch,
  isSessionRestoreBlocked,
  runExclusiveAuthOperation,
} from './auth-coordinator';

test('serializa operaciones de autenticación dentro de una pestaña', async () => {
  const epoch = getAuthEpoch();
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;

  const first = runExclusiveAuthOperation(epoch, async () => {
    events.push('first:start');
    await new Promise<void>((resolve) => { releaseFirst = resolve; });
    events.push('first:end');
  });
  const second = runExclusiveAuthOperation(epoch, async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['first:start']);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('un cambio de identidad cancela la operación anterior y bloquea restauraciones', async () => {
  const epoch = getAuthEpoch();
  const pending = runExclusiveAuthOperation(epoch, (signal) => new Promise<void>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    void resolve;
  }));

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const loginEpoch = beginLoginTransition();
  await assert.rejects(pending, AuthOperationCancelledError);
  assert.equal(isSessionRestoreBlocked(), true);
  assert.equal(completeLoginTransition(loginEpoch), true);
  assert.equal(isSessionRestoreBlocked(), false);
});

test('limita el tiempo de una mutación de autenticación', async () => {
  const epoch = getAuthEpoch();
  await assert.rejects(
    runExclusiveAuthOperation(
      epoch,
      (signal) => new Promise<void>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')));
        void resolve;
      }),
      5,
    ),
    AuthOperationTimeoutError,
  );
});
