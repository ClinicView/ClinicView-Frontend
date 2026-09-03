const AUTH_LOCK_NAME = 'clinicview-auth-session-v1';
const AUTH_CHANNEL_NAME = 'clinicview-auth-events-v1';
const AUTH_STATE_KEY = 'clinicview.auth.state.v1';

export const AUTH_OPERATION_TIMEOUT_MS = 12_000;

type AuthState = 'active' | 'logout';
export type AuthChangeType = 'login' | 'logout';

interface AuthStateMessage {
  version: 1;
  eventId: string;
  state: AuthState;
  occurredAt: number;
}

export interface AuthChange {
  type: AuthChangeType;
  occurredAt: number;
}

export class AuthOperationCancelledError extends Error {
  constructor() {
    super('auth_operation_cancelled');
    this.name = 'AuthOperationCancelledError';
  }
}

export class AuthOperationTimeoutError extends Error {
  constructor() {
    super('auth_operation_timeout');
    this.name = 'AuthOperationTimeoutError';
  }
}

let authEpoch = 0;
let operationTail: Promise<void> = Promise.resolve();
let activeController: AbortController | null = null;
let restorationBlocked = false;
let stateHydrated = false;
let channel: BroadcastChannel | null = null;
let storageListener: ((event: StorageEvent) => void) | null = null;

const listeners = new Set<(change: AuthChange) => void>();
const seenEventIds = new Set<string>();
const seenEventOrder: string[] = [];

function canUseBrowserStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function createEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseStateMessage(value: unknown): AuthStateMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AuthStateMessage>;
  if (
    candidate.version !== 1
    || typeof candidate.eventId !== 'string'
    || candidate.eventId.length === 0
    || (candidate.state !== 'active' && candidate.state !== 'logout')
    || typeof candidate.occurredAt !== 'number'
    || !Number.isFinite(candidate.occurredAt)
  ) {
    return null;
  }
  return candidate as AuthStateMessage;
}

function parseStoredState(value: string | null): AuthStateMessage | null {
  if (!value) return null;
  try {
    return parseStateMessage(JSON.parse(value));
  } catch {
    return null;
  }
}

function hydrateState(): void {
  if (stateHydrated) return;
  stateHydrated = true;
  if (!canUseBrowserStorage()) return;
  try {
    const stored = parseStoredState(window.localStorage.getItem(AUTH_STATE_KEY));
    restorationBlocked = stored?.state === 'logout';
  } catch {
    // El almacenamiento puede estar deshabilitado. Se conserva el estado en memoria.
  }
}

function rememberEvent(eventId: string): boolean {
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.add(eventId);
  seenEventOrder.push(eventId);
  if (seenEventOrder.length > 64) {
    const oldest = seenEventOrder.shift();
    if (oldest) seenEventIds.delete(oldest);
  }
  return true;
}

function notifyListeners(message: AuthStateMessage): void {
  const change: AuthChange = {
    type: message.state === 'logout' ? 'logout' : 'login',
    occurredAt: message.occurredAt,
  };
  for (const listener of listeners) listener(change);
}

function acceptExternalMessage(message: AuthStateMessage): void {
  if (!rememberEvent(message.eventId)) return;
  stateHydrated = true;
  restorationBlocked = message.state === 'logout';
  invalidateAuthOperations();
  notifyListeners(message);
}

function ensureTransport(): void {
  if (typeof window === 'undefined') return;

  if (!storageListener) {
    storageListener = (event: StorageEvent) => {
      if (event.key !== AUTH_STATE_KEY) return;
      const message = parseStoredState(event.newValue);
      if (message) acceptExternalMessage(message);
    };
    window.addEventListener('storage', storageListener);
  }

  if (!channel && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.addEventListener('message', (event: MessageEvent<unknown>) => {
        const message = parseStateMessage(event.data);
        if (message) acceptExternalMessage(message);
      });
    } catch {
      channel = null;
    }
  }
}

function releaseTransportWhenUnused(): void {
  if (listeners.size > 0 || typeof window === 'undefined') return;
  channel?.close();
  channel = null;
  if (storageListener) {
    window.removeEventListener('storage', storageListener);
    storageListener = null;
  }
}

function publishState(state: AuthState, notifyCurrentTab: boolean): void {
  const message: AuthStateMessage = {
    version: 1,
    eventId: createEventId(),
    state,
    occurredAt: Date.now(),
  };

  stateHydrated = true;
  restorationBlocked = state === 'logout';
  rememberEvent(message.eventId);

  if (canUseBrowserStorage()) {
    try {
      window.localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(message));
    } catch {
      // El canal sigue disponible y el estado en memoria continúa siendo fail-closed.
    }
  }

  ensureTransport();
  try {
    channel?.postMessage(message);
  } catch {
    // El evento storage seguirá coordinando pestañas cuando esté disponible.
  }

  if (notifyCurrentTab) notifyListeners(message);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationTail.then(operation, operation);
  operationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function withCrossTabLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof window !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(AUTH_LOCK_NAME, { mode: 'exclusive' }, operation);
  }
  return operation();
}

export function getAuthEpoch(): number {
  return authEpoch;
}

export function isAuthEpochCurrent(epoch: number): boolean {
  return authEpoch === epoch;
}

export function invalidateAuthOperations(): number {
  authEpoch += 1;
  activeController?.abort();
  return authEpoch;
}

export function beginLoginTransition(): number {
  const epoch = invalidateAuthOperations();
  // Cambiar de cuenta invalida inmediatamente cualquier identidad anterior.
  // El estado vuelve a `active` solo después de validar la nueva respuesta.
  publishState('logout', true);
  return epoch;
}

export function completeLoginTransition(epoch: number): boolean {
  if (!isAuthEpochCurrent(epoch)) return false;
  publishState('active', false);
  return true;
}

export function beginLogoutTransition(): number {
  const epoch = invalidateAuthOperations();
  publishState('logout', true);
  return epoch;
}

export function isSessionRestoreBlocked(): boolean {
  hydrateState();
  return restorationBlocked;
}

export function subscribeAuthChanges(listener: (change: AuthChange) => void): () => void {
  listeners.add(listener);
  ensureTransport();
  return () => {
    listeners.delete(listener);
    releaseTransportWhenUnused();
  };
}

export function runExclusiveAuthOperation<T>(
  expectedEpoch: number,
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = AUTH_OPERATION_TIMEOUT_MS,
): Promise<T> {
  return enqueue(() => withCrossTabLock(async () => {
    if (!isAuthEpochCurrent(expectedEpoch)) throw new AuthOperationCancelledError();

    const controller = new AbortController();
    activeController = controller;
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await operation(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        if (didTimeout) throw new AuthOperationTimeoutError();
        throw new AuthOperationCancelledError();
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (activeController === controller) activeController = null;
    }
  }));
}
