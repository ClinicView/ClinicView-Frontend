import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PagedClinicalSource, type ClinicalPage } from './paged-clinical-source';

type Item = { id: string; value?: string };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('carga más de 50 elementos, conserva páginas y evita doble petición', async () => {
  const calls: number[] = [];
  const pending = deferred<ClinicalPage<Item>>();
  const source = new PagedClinicalSource(true, async (page) => {
    calls.push(page);
    return page === 1 ? { data: Array.from({ length: 50 }, (_, i) => ({ id: String(i) })), total: 51, page, limit: 50 } : pending.promise;
  }, 'registros');
  await source.reload();
  assert.equal(source.getSnapshot().hasMore, true);
  const next = source.loadMore();
  await source.loadMore();
  pending.resolve({ data: [{ id: '50' }], total: 51, page: 2, limit: 50 });
  await next;
  assert.deepEqual(calls, [1, 2]);
  assert.equal(source.getSnapshot().items.length, 51);
  assert.equal(source.getSnapshot().hasMore, false);
});

test('ignora respuestas tardías de una generación anterior', async () => {
  const pending = deferred<ClinicalPage<Item>>();
  let calls = 0;
  const source = new PagedClinicalSource(true, async () => ++calls === 1 ? pending.promise :
    { data: [{ id: 'current' }], total: 1, page: 1, limit: 50 }, 'documentos');
  const stale = source.reload();
  source.cancel();
  await source.reload();
  pending.resolve({ data: [{ id: 'old' }], total: 1, page: 1, limit: 50 });
  await stale;
  assert.deepEqual(source.getSnapshot().items, [{ id: 'current' }]);
});

test('un error conserva datos y permite reintentar exactamente la página fallida', async () => {
  let fail = true;
  const source = new PagedClinicalSource(true, async (page) => {
    if (page === 2 && fail) throw new Error('network');
    return { data: [{ id: String(page) }], total: 2, page, limit: 1 };
  }, 'registros');
  await source.reload();
  await source.loadMore();
  assert.deepEqual(source.getSnapshot().items, [{ id: '1' }]);
  assert.ok(source.getSnapshot().error);
  fail = false;
  await source.loadMore();
  assert.deepEqual(source.getSnapshot().items, [{ id: '1' }, { id: '2' }]);
  assert.equal(source.getSnapshot().error, null);
});

test('no consulta una fuente sin permiso y descarta contenido si el servidor lo revoca', async () => {
  let calls = 0;
  const disabled = new PagedClinicalSource<Item>(false, async () => { calls++; throw new Error(); }, 'registros');
  await disabled.reload();
  await disabled.loadMore();
  assert.equal(calls, 0);
  const source = new PagedClinicalSource(true, async (page) => {
    if (page === 2) throw { status: 403 };
    return { data: [{ id: '1' }], total: 2, page, limit: 1 };
  }, 'registros');
  await source.reload();
  await source.loadMore();
  assert.deepEqual(source.getSnapshot().items, []);
  assert.equal(source.getSnapshot().total, null);
  assert.ok(source.getSnapshot().error);
});

test('elimina duplicados por ID y detiene una paginación que deja de avanzar', async () => {
  const source = new PagedClinicalSource<Item>(true, async (page) => ({
    data: page < 3 ? [{ id: 'same', value: String(page) }] : [], total: 5, page, limit: 1,
  }), 'documentos');
  await source.reload();
  await source.loadMore();
  assert.deepEqual(source.getSnapshot().items, [{ id: 'same', value: '2' }]);
  await source.loadMore();
  assert.equal(source.getSnapshot().hasMore, false);
  assert.equal(source.getSnapshot().total, 5);
});
