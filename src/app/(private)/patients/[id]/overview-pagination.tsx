import type { ClinicalPageState } from '@/shared/lib/paged-clinical-source';
import { ContextHelp } from '@/shared/ui/context-help';
import styles from './patient-profile.module.css';

interface Source {
  label: string;
  state: ClinicalPageState<{ id: string }>;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
}

export function OverviewPagination({ sources }: { sources: Source[] }) {
  return <section className={styles.overviewPagination} aria-label="Cobertura de la ficha clínica">
    <div className={styles.paginationHeading}>
      <strong>Información cargada en esta ficha</strong>
      <ContextHelp title="Alcance de la ficha clínica" compact>
        <p>Las fuentes se cargan por páginas de 50. Puedes agregar las siguientes sin perder lo ya visible. Los filtros, indicadores y métricas de esta ficha describen solo la información cargada.</p>
        <p>Documentos y registros se ordenan conjuntamente por fecha clínica entre las entradas cargadas. Un documento sin fecha clínica muestra su fecha de carga como referencia, pero no aparece en filtros de fecha clínica.</p>
        <p>Las versiones corregidas y anuladas se conservan e identifican. No representan atenciones vigentes. Si hay cambios en otra sesión, recarga la ficha.</p>
        <p>Exportar historia completa consulta una instantánea independiente en el servidor, incluidas todas las versiones; no se limita a las páginas o filtros visibles.</p>
      </ContextHelp>
    </div>
    <div className={styles.paginationSources}>
      {sources.map(({ label, state, loadMore, reload }) => {
        const incomplete = state.total !== null && state.items.length < state.total;
        const mustReload = state.page === 0 || (!state.hasMore && incomplete);
        return <div key={label} className={styles.paginationSource}>
          <span role="status" aria-live="polite">{label}: {state.items.length} de {state.total ?? '—'}{state.loading ? ' · Cargando…' : incomplete ? ' · Vista parcial' : ''}</span>
          <button type="button" className={styles.btnSmall} disabled={state.loading || (!state.error && !state.hasMore && !mustReload)}
            onClick={() => void (mustReload ? reload() : loadMore())}>
            {state.loading ? 'Cargando…' : mustReload ? `Recargar ${label.toLowerCase()}` : state.error ? `Reintentar ${label.toLowerCase()}` : state.hasMore ? `Cargar más ${label.toLowerCase()}` : 'Todo cargado'}
          </button>
        </div>;
      })}
    </div>
  </section>;
}
