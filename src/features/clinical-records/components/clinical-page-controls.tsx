import { Alert } from '@/shared/ui';
import type { ClinicalPageState } from '@/shared/lib/paged-clinical-source';
export function ClinicalPageControls({ state, resource }: { state: ClinicalPageState<unknown> & { reload: () => Promise<void>; loadMore: () => Promise<void> }; resource: string }) {
  return <>
    {state.error && <Alert variant="error">{state.error}</Alert>}
    <p role="status">{state.loading ? `Cargando ${resource}…` : `${state.items.length} de ${state.total ?? '—'} ${resource}`}</p>
    <div><button type="button" disabled={state.loading} onClick={() => void state.reload()}>Recargar {resource}</button>{state.hasMore && <button type="button" disabled={state.loading} onClick={() => void state.loadMore()}>{state.error ? 'Reintentar página' : 'Cargar más'}</button>}</div>
  </>;
}
