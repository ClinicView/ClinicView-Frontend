'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/shared/components/page-shell';
import { Alert, EmptyState, Icon, Spinner } from '@/shared/ui';
import { useAuditEvents } from '../hooks/use-audit-events';
import {
  countActiveAuditFilters,
  DEFAULT_AUDIT_LIMIT,
  EMPTY_AUDIT_FILTER_DRAFT,
  parseAuditFilterDraft,
} from '../lib/audit-query';
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_OUTCOME_PRESENTATION,
  compactAuditId,
  formatAuditDate,
  formatAuditDuration,
  getAuditActionLabel,
  getAuditPageSummary,
  getAuditResourceLabel,
} from '../lib/audit-presentation';
import type {
  AuditEvent,
  AuditFilterDraft,
  AuditFilterErrors,
  AuditFilterField,
} from '../types/audit';
import styles from './audit-events-view.module.css';

const INITIAL_FILTERS = { limit: DEFAULT_AUDIT_LIMIT } as const;

const FILTER_ERROR_TARGETS: Record<AuditFilterField, { id: string; label: string }> = {
  action: { id: 'audit-action', label: 'Acción' },
  outcome: { id: 'audit-outcome', label: 'Resultado' },
  actorId: { id: 'audit-actor', label: 'ID del actor' },
  patientId: { id: 'audit-patient', label: 'ID del paciente' },
  resourceType: { id: 'audit-resource-type', label: 'Tipo de recurso' },
  resourceId: { id: 'audit-resource', label: 'ID del recurso' },
  requestId: { id: 'audit-request', label: 'ID de solicitud' },
  fromDate: { id: 'audit-from', label: 'Fecha inicial' },
  toDate: { id: 'audit-to', label: 'Fecha final' },
  dateRange: { id: 'audit-from', label: 'Rango de fechas' },
  limit: { id: 'audit-limit', label: 'Resultados por página' },
};

interface CopyableIdProps {
  label: string;
  value?: string | null;
}

function CopyableId({ label, value }: CopyableIdProps) {
  const [feedback, setFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  if (!value) return <span className={styles.notAvailable}>No disponible</span>;
  const copyValue = value;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setFeedback('copied');
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setFeedback('idle'), 1_800);
    } catch {
      setFeedback('failed');
    }
  }

  return (
    <span className={styles.copyableId}>
      <code className={styles.compactId} title={value}>
        <span className={styles.visuallyHidden}>{label}: {value}</span>
        <span aria-hidden="true">{compactAuditId(value)}</span>
      </code>
      <button
        className={`${styles.copyButton} ${feedback === 'failed' ? styles.copyButtonError : ''}`}
        type="button"
        onClick={() => void copyId()}
        aria-label={`Copiar ${label}: ${copyValue}`}
        title={feedback === 'failed'
          ? 'No se pudo copiar. El identificador completo está en el detalle técnico.'
          : undefined}
      >
        {feedback === 'copied' ? 'Copiado' : feedback === 'failed' ? 'Reintentar' : 'Copiar'}
      </button>
      <span className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">
        {feedback === 'copied' ? `${label} copiado.` : ''}
        {feedback === 'failed' ? `No se pudo copiar ${label}; está disponible completo en el detalle técnico.` : ''}
      </span>
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} className={styles.fieldError}>{message}</span>;
}

function TechnicalDetails({ event }: { event: AuditEvent }) {
  return (
    <details className={styles.technicalDetails}>
      <summary>Detalle técnico</summary>
      <div className={styles.technicalBody}>
        <p className={styles.technicalNotice}>
          Las huellas seudonimizadas sirven solo para correlación técnica. No revelan la
          dirección IP ni el navegador original y permanecen ocultas hasta abrir este detalle.
        </p>
        <dl className={styles.technicalList}>
          <div>
            <dt>ID del evento</dt>
            <dd><code>{event.id}</code></dd>
          </div>
          <div>
            <dt>ID de solicitud</dt>
            <dd><code>{event.requestId}</code></dd>
          </div>
          <div>
            <dt>ID del actor</dt>
            <dd><code>{event.actorId ?? 'No disponible'}</code></dd>
          </div>
          <div>
            <dt>ID del paciente</dt>
            <dd><code>{event.patientId ?? 'No disponible'}</code></dd>
          </div>
          <div>
            <dt>ID del recurso</dt>
            <dd><code>{event.resourceId ?? 'No disponible'}</code></dd>
          </div>
          <div>
            <dt>Huella de red</dt>
            <dd><code>{event.ipHash ?? 'No disponible'}</code></dd>
          </div>
          <div>
            <dt>Huella del agente</dt>
            <dd><code>{event.userAgentHash ?? 'No disponible'}</code></dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

function OutcomeBadge({ event }: { event: AuditEvent }) {
  const presentation = AUDIT_OUTCOME_PRESENTATION[event.outcome];
  const icon = event.outcome === 'SUCCESS' ? 'check' : event.outcome === 'DENIED' ? 'lock' : 'warning';

  return (
    <span
      className={`${styles.outcomeBadge} ${styles[`outcome_${event.outcome.toLowerCase()}`]}`}
      title={presentation.description}
    >
      <Icon name={icon} size={14} />
      {presentation.label}
    </span>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <tr>
      <td data-label="Fecha y hora">
        <time className={styles.dateTime} dateTime={event.occurredAt}>
          {formatAuditDate(event.occurredAt)}
        </time>
        <span className={styles.timeZone}>Hora de Lima</span>
      </td>
      <td data-label="Evento">
        <span className={styles.actionLabel}>{getAuditActionLabel(event.action)}</span>
        <code className={styles.actionCode}>{event.action}</code>
      </td>
      <td data-label="Resultado">
        <OutcomeBadge event={event} />
        <span className={styles.statusCode}>HTTP {event.statusCode}</span>
      </td>
      <td data-label="Actor">
        <CopyableId label="ID del actor" value={event.actorId} />
      </td>
      <td data-label="Contexto">
        <span className={styles.resourceType}>{getAuditResourceLabel(event.resourceType)}</span>
        <CopyableId
          label={event.patientId ? 'ID del paciente' : 'ID del recurso'}
          value={event.patientId ?? event.resourceId}
        />
      </td>
      <td data-label="Solicitud">
        <span className={styles.endpoint}>
          <strong>{event.method}</strong>
          <code>{event.route}</code>
        </span>
        <span className={styles.duration}>{formatAuditDuration(event.durationMs)}</span>
      </td>
      <td data-label="Más información">
        <TechnicalDetails event={event} />
      </td>
    </tr>
  );
}

export function AuditEventsView() {
  const [filterDraft, setFilterDraft] = useState<AuditFilterDraft>({
    ...EMPTY_AUDIT_FILTER_DRAFT,
  });
  const [filterErrors, setFilterErrors] = useState<AuditFilterErrors>({});
  const advancedFiltersRef = useRef<HTMLDetailsElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    events,
    filters,
    isLoading,
    error,
    page,
    canGoBack,
    canGoNext,
    applyFilters,
    goNext,
    goBack,
    retry,
  } = useAuditEvents(INITIAL_FILTERS);

  const summary = useMemo(() => getAuditPageSummary(events), [events]);
  const activeFilterCount = countActiveAuditFilters(filters);
  const filterErrorItems = (Object.entries(filterErrors) as Array<[AuditFilterField, string]>)
    .map(([field, message]) => ({ ...FILTER_ERROR_TARGETS[field], field, message }));
  const advancedHasErrors = Boolean(
    filterErrors.actorId
    || filterErrors.patientId
    || filterErrors.resourceType
    || filterErrors.resourceId
    || filterErrors.requestId,
  );

  useEffect(() => {
    if (advancedHasErrors && advancedFiltersRef.current) {
      advancedFiltersRef.current.open = true;
    }
  }, [advancedHasErrors]);

  function updateFilter<K extends keyof AuditFilterDraft>(key: K, value: AuditFilterDraft[K]) {
    setFilterDraft((current) => ({ ...current, [key]: value }));
    setFilterErrors((current) => {
      if (!current[key] && !(key === 'fromDate' || key === 'toDate') && !current.dateRange) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      if (key === 'fromDate' || key === 'toDate') delete next.dateRange;
      return next;
    });
  }

  function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseAuditFilterDraft(filterDraft);
    setFilterErrors(parsed.errors);
    if (!parsed.filters) {
      if (
        parsed.errors.actorId
        || parsed.errors.patientId
        || parsed.errors.resourceType
        || parsed.errors.resourceId
        || parsed.errors.requestId
      ) {
        if (advancedFiltersRef.current) advancedFiltersRef.current.open = true;
      }
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
      });
      return;
    }
    applyFilters(parsed.filters);
  }

  function clearFilters() {
    setFilterDraft({ ...EMPTY_AUDIT_FILTER_DRAFT });
    setFilterErrors({});
    applyFilters({ limit: DEFAULT_AUDIT_LIMIT });
    requestAnimationFrame(() => document.getElementById('audit-action')?.focus());
  }

  return (
    <PageShell>
      <header className={styles.pageHeader}>
        <div className={styles.headerIcon} aria-hidden="true">
          <Icon name="shield" size={23} />
        </div>
        <div>
          <p className={styles.eyebrow}>Seguridad y trazabilidad</p>
          <h1 className={styles.title}>Auditoría del sistema</h1>
          <p className={styles.subtitle}>
            Consulta el historial técnico inmutable de accesos y operaciones. Los actores se
            identifican por UUID para no exponer datos del directorio de usuarios.
          </p>
        </div>
      </header>

      <section className={styles.filterPanel} aria-labelledby="audit-filters-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="audit-filters-title">Filtrar eventos</h2>
            <p>Las fechas se interpretan como días completos en la zona horaria de Lima.</p>
          </div>
          <span className={styles.filterCount} aria-live="polite">
            {activeFilterCount === 0
              ? 'Sin filtros activos'
              : `${activeFilterCount} filtro${activeFilterCount === 1 ? '' : 's'} activo${activeFilterCount === 1 ? '' : 's'}`}
          </span>
        </div>

        <form className={styles.filterForm} onSubmit={submitFilters} noValidate>
          {filterErrorItems.length > 0 && (
            <div
              ref={errorSummaryRef}
              className={styles.errorSummary}
              role="alert"
              tabIndex={-1}
              aria-labelledby="audit-filter-errors-title"
            >
              <p id="audit-filter-errors-title">Revisa los filtros antes de continuar:</p>
              <ul>
                {filterErrorItems.map((item) => (
                  <li key={item.field}>
                    <a href={`#${item.id}`}>
                      <strong>{item.label}:</strong> {item.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.primaryFilters}>
            <div className={styles.field}>
              <label htmlFor="audit-action">Acción</label>
              <input
                id="audit-action"
                type="text"
                list="audit-actions"
                value={filterDraft.action}
                onChange={(event) => updateFilter('action', event.target.value)}
                placeholder="Ej. PATIENT_VIEWED"
                autoComplete="off"
                aria-invalid={filterErrors.action ? true : undefined}
                aria-describedby={filterErrors.action ? 'audit-action-error' : undefined}
              />
              <datalist id="audit-actions">
                {AUDIT_ACTION_OPTIONS.map((action) => <option key={action} value={action} />)}
              </datalist>
              <FieldError id="audit-action-error" message={filterErrors.action} />
            </div>

            <div className={styles.field}>
              <label htmlFor="audit-outcome">Resultado</label>
              <select
                id="audit-outcome"
                value={filterDraft.outcome}
                onChange={(event) => updateFilter('outcome', event.target.value as AuditFilterDraft['outcome'])}
              >
                <option value="">Todos los resultados</option>
                <option value="SUCCESS">Correcto</option>
                <option value="DENIED">Denegado</option>
                <option value="FAILED">Fallido</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="audit-from">Desde</label>
              <input
                id="audit-from"
                type="date"
                value={filterDraft.fromDate}
                onChange={(event) => updateFilter('fromDate', event.target.value)}
                aria-invalid={filterErrors.dateRange ? true : undefined}
                aria-describedby={filterErrors.dateRange ? 'audit-date-error' : undefined}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="audit-to">Hasta</label>
              <input
                id="audit-to"
                type="date"
                value={filterDraft.toDate}
                onChange={(event) => updateFilter('toDate', event.target.value)}
                aria-invalid={filterErrors.dateRange ? true : undefined}
                aria-describedby={filterErrors.dateRange ? 'audit-date-error' : undefined}
              />
              <FieldError id="audit-date-error" message={filterErrors.dateRange} />
            </div>

            <div className={styles.field}>
              <label htmlFor="audit-limit">Por página</label>
              <select
                id="audit-limit"
                value={filterDraft.limit}
                onChange={(event) => updateFilter('limit', event.target.value)}
                aria-invalid={filterErrors.limit ? true : undefined}
                aria-describedby={filterErrors.limit ? 'audit-limit-error' : undefined}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <FieldError id="audit-limit-error" message={filterErrors.limit} />
            </div>
          </div>

          <details ref={advancedFiltersRef} className={styles.advancedFilters}>
            <summary>
              <span>Filtros técnicos</span>
              <span className={styles.advancedHint}>UUID y tipo de recurso</span>
            </summary>
            <div className={styles.advancedGrid}>
              <div className={styles.field}>
                <label htmlFor="audit-actor">ID del actor</label>
                <input
                  id="audit-actor"
                  type="text"
                  value={filterDraft.actorId}
                  onChange={(event) => updateFilter('actorId', event.target.value)}
                  placeholder="UUID del usuario"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={filterErrors.actorId ? true : undefined}
                  aria-describedby={filterErrors.actorId ? 'audit-actor-error' : undefined}
                />
                <FieldError id="audit-actor-error" message={filterErrors.actorId} />
              </div>

              <div className={styles.field}>
                <label htmlFor="audit-patient">ID del paciente</label>
                <input
                  id="audit-patient"
                  type="text"
                  value={filterDraft.patientId}
                  onChange={(event) => updateFilter('patientId', event.target.value)}
                  placeholder="UUID del paciente"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={filterErrors.patientId ? true : undefined}
                  aria-describedby={filterErrors.patientId ? 'audit-patient-error' : undefined}
                />
                <FieldError id="audit-patient-error" message={filterErrors.patientId} />
              </div>

              <div className={styles.field}>
                <label htmlFor="audit-resource-type">Tipo de recurso</label>
                <input
                  id="audit-resource-type"
                  type="text"
                  list="audit-resource-types"
                  value={filterDraft.resourceType}
                  onChange={(event) => updateFilter('resourceType', event.target.value)}
                  placeholder="Ej. DOCUMENT"
                  autoComplete="off"
                  aria-invalid={filterErrors.resourceType ? true : undefined}
                  aria-describedby={filterErrors.resourceType ? 'audit-resource-type-error' : undefined}
                />
                <datalist id="audit-resource-types">
                  {[
                    'USER',
                    'PATIENT',
                    'CLINICAL_RECORD',
                    'MEDICAL_DOCUMENT',
                    'CLINICAL_MEDIA',
                    'ROLE',
                    'AUDIT_EVENT',
                    'DASHBOARD',
                  ].map((resource) => <option key={resource} value={resource} />)}
                </datalist>
                <FieldError id="audit-resource-type-error" message={filterErrors.resourceType} />
              </div>

              <div className={styles.field}>
                <label htmlFor="audit-resource">ID del recurso</label>
                <input
                  id="audit-resource"
                  type="text"
                  value={filterDraft.resourceId}
                  onChange={(event) => updateFilter('resourceId', event.target.value)}
                  placeholder="UUID del recurso"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={filterErrors.resourceId ? true : undefined}
                  aria-describedby={filterErrors.resourceId ? 'audit-resource-error' : undefined}
                />
                <FieldError id="audit-resource-error" message={filterErrors.resourceId} />
              </div>

              <div className={styles.field}>
                <label htmlFor="audit-request">ID de solicitud</label>
                <input
                  id="audit-request"
                  type="text"
                  value={filterDraft.requestId}
                  onChange={(event) => updateFilter('requestId', event.target.value)}
                  placeholder="UUID de correlación"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={filterErrors.requestId ? true : undefined}
                  aria-describedby={filterErrors.requestId ? 'audit-request-error' : undefined}
                />
                <FieldError id="audit-request-error" message={filterErrors.requestId} />
              </div>
            </div>
          </details>

          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="submit">
              <Icon name="search" size={17} />
              Aplicar filtros
            </button>
            <button className={styles.secondaryButton} type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </form>
      </section>

      <section className={styles.resultsPanel} aria-labelledby="audit-results-title" aria-busy={isLoading}>
        <div className={styles.resultsHeader}>
          <div>
            <h2 id="audit-results-title">Eventos registrados</h2>
            <p>Mostrando la página {page} en orden del más reciente al más antiguo.</p>
          </div>
          {!isLoading && !error && (
            <div className={styles.pageSummary} aria-label="Resumen de la página actual">
              <span><strong>{summary.total}</strong> eventos</span>
              <span className={styles.summarySuccess}><strong>{summary.success}</strong> correctos</span>
              <span className={styles.summaryDenied}><strong>{summary.denied}</strong> denegados</span>
              <span className={styles.summaryFailed}><strong>{summary.failed}</strong> fallidos</span>
            </div>
          )}
        </div>

        {error ? (
          <div className={styles.errorState}>
            <Alert variant="error">
              <strong>No se pudo cargar la auditoría.</strong> {error}
            </Alert>
            <button className={styles.retryButton} type="button" onClick={retry}>
              Volver a intentar
            </button>
          </div>
        ) : isLoading ? (
          <div className={styles.loadingState}>
            <Spinner label="Cargando eventos de auditoría…" />
          </div>
        ) : events.length === 0 ? (
          <div className={styles.emptyState}>
            <EmptyState
              icon="shield"
              title="No se encontraron eventos"
              description={activeFilterCount > 0
                ? 'Prueba con un rango más amplio o elimina alguno de los filtros.'
                : 'Todavía no hay eventos visibles en el registro de auditoría.'}
            />
            {activeFilterCount > 0 && (
              <button className={styles.secondaryButton} type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableRegion} role="region" aria-label="Eventos de auditoría" tabIndex={0}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Eventos de auditoría, resultado, actor, recurso, solicitud y detalle técnico
              </caption>
              <thead>
                <tr>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Evento</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Contexto</th>
                  <th scope="col">Solicitud</th>
                  <th scope="col">Información</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => <AuditEventRow key={event.id} event={event} />)}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && events.length > 0 && (
          <nav className={styles.pagination} aria-label="Paginación de auditoría">
            <button
              className={styles.paginationButton}
              type="button"
              onClick={goBack}
              disabled={!canGoBack || isLoading}
            >
              Anterior
            </button>
            <span aria-live="polite" aria-atomic="true">Página {page}</span>
            <button
              className={styles.paginationButton}
              type="button"
              onClick={goNext}
              disabled={!canGoNext || isLoading}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>
    </PageShell>
  );
}
