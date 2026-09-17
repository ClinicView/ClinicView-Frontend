type Schedule = (callback: () => void, delay: number) => () => void;

const schedule: Schedule = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

/** One abortable read at a time, with bounded backoff. Writes are never retried. */
export function pollDocument(options: {
  read: (signal: AbortSignal) => Promise<'continue' | 'stop' | 'skip'>;
  onError: () => void;
  schedule?: Schedule;
  timeoutMs?: number;
}): () => void {
  const later = options.schedule ?? schedule;
  let stopped = false;
  let failures = 0;
  let cancelTimer: (() => void) | undefined;
  let controller: AbortController | undefined;

  async function tick() {
    if (stopped) return;
    controller = new AbortController();
    const active = controller;
    const cancelDeadline = later(() => active.abort(), options.timeoutMs ?? 15000);
    try {
      const result = await options.read(active.signal);
      if (stopped) return;
      if (result === 'stop') { stopped = true; return; }
      if (result !== 'skip') failures = 0;
    } catch {
      if (stopped) return;
      failures += 1;
      options.onError();
    } finally {
      cancelDeadline();
      if (!stopped) cancelTimer = later(() => { void tick(); }, Math.min(5000 * 2 ** Math.min(failures, 3), 30000));
    }
  }
  cancelTimer = later(() => { void tick(); }, 1500);
  return () => { stopped = true; cancelTimer?.(); controller?.abort(); };
}
