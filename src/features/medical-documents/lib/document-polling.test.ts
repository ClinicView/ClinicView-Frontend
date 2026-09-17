import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pollDocument } from './document-polling';

function clock() {
  const timers: Array<{ callback: () => void; delay: number; active: boolean }> = [];
  return {
    schedule: (callback: () => void, delay: number) => {
      const timer = { callback, delay, active: true }; timers.push(timer);
      return () => { timer.active = false; };
    },
    run: async (delay: number) => {
      const next = timers.find((timer) => timer.active && timer.delay === delay);
      assert.ok(next, `expected a ${delay}ms timer`);
      next.active = false; next.callback();
      await Promise.resolve(); await Promise.resolve();
    },
    active: () => timers.filter((timer) => timer.active).map((timer) => timer.delay),
  };
}

test('polling accepts continuing updates and stops at a definitive document state', async () => {
  const time = clock(); let calls = 0;
  const stop = pollDocument({ schedule: time.schedule, read: async () => ++calls === 2 ? 'stop' : 'continue', onError: () => assert.fail('unexpected error') });
  await time.run(1500); assert.deepEqual(time.active(), [5000]);
  await time.run(5000); assert.equal(calls, 2); assert.deepEqual(time.active(), []);
  stop();
});

test('there is only one in-flight read and cleanup aborts it without announcing failure', async () => {
  const time = clock(); let calls = 0; let signal: AbortSignal | undefined; let errors = 0;
  let finish!: (value: 'continue') => void;
  const stop = pollDocument({ schedule: time.schedule,
    read: (received) => { signal = received; calls++; return new Promise((resolve) => { finish = resolve; }); },
    onError: () => { errors++; },
  });
  await time.run(1500); assert.equal(calls, 1); assert.deepEqual(time.active(), [15000]);
  stop(); assert.equal(signal?.aborted, true);
  finish('continue'); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(time.active(), []); assert.equal(errors, 0); assert.equal(calls, 1);
});

test('transient read failures back off, preserve the read loop and reset after recovery', async () => {
  const time = clock(); let calls = 0; let errors = 0;
  const stop = pollDocument({ schedule: time.schedule,
    read: async () => { calls++; if (calls <= 3) throw new Error('offline'); return 'continue'; },
    onError: () => { errors++; },
  });
  await time.run(1500); assert.deepEqual(time.active(), [10000]);
  await time.run(10000); assert.deepEqual(time.active(), [20000]);
  await time.run(20000); assert.deepEqual(time.active(), [30000]);
  await time.run(30000); assert.deepEqual(time.active(), [5000]);
  assert.equal(errors, 3); stop(); assert.deepEqual(time.active(), []);
});

test('a timed out fetch is aborted and subsequent reads remain recoverable', async () => {
  const time = clock(); let errors = 0; let signal: AbortSignal | undefined;
  const stop = pollDocument({ schedule: time.schedule, timeoutMs: 2000,
    read: (received) => { signal = received; return new Promise((_resolve, reject) => { received.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); }); },
    onError: () => { errors++; },
  });
  await time.run(1500); await time.run(2000);
  assert.equal(signal?.aborted, true); assert.equal(errors, 1); assert.deepEqual(time.active(), [10000]);
  stop();
});

test('writes and superseded reads can skip a poll without reporting an OCR failure', async () => {
  const time = clock(); let calls = 0;
  const stop = pollDocument({ schedule: time.schedule, read: async () => { calls++; return 'skip'; }, onError: () => assert.fail('skip is not an error') });
  await time.run(1500); assert.deepEqual(time.active(), [5000]);
  await time.run(5000); assert.equal(calls, 2); stop();
});

test('unmount before the first read cancels scheduled work', () => {
  const time = clock();
  const stop = pollDocument({ schedule: time.schedule, read: async () => assert.fail('must not fetch'), onError: () => assert.fail('must not report') });
  stop(); assert.deepEqual(time.active(), []);
});
