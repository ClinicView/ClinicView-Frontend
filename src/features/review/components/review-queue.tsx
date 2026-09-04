'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { formatInstant } from '@/shared/lib/date-time';
import { can } from '@/shared/permissions/can';
import { Spinner, EmptyState, Alert, Icon } from '@/shared/ui';
import { useReviewQueue } from '../hooks/use-review-queue';
import type { ReviewPriority, ReviewQueueItem, ReviewQueueScope } from '../types/review';
import styles from './review-queue.module.css';

function formatDate(iso: string | null): string {
  return formatInstant(iso, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || 'PX';
}

function getFileType(mimeType: string): string {
  return mimeType.split('/')[1]?.toUpperCase() || 'ARCHIVO';
}

const PRIORITY_LABEL: Record<ReviewPriority, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  NORMAL: 'Normal',
  LOW: 'Baja',
};

function formatQueueAge(iso: string | null, fallback: string): string {
  const timestamp = Date.parse(iso ?? fallback);
  if (!Number.isFinite(timestamp)) return 'Antiguedad no disponible';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `En cola ${Math.max(1, minutes)} min`;
  if (minutes < 1_440) return `En cola ${Math.floor(minutes / 60)} h`;
  const days = Math.floor(minutes / 1_440);
  return `En cola ${days} dia${days === 1 ? '' : 's'}`;
}

interface ReviewQueueProps {
  permissions: string[];
  userId: string;
}

export function ReviewQueue({ permissions, userId }: ReviewQueueProps) {
  const router = useRouter();
  const canAssign = can(permissions, 'review.assign');
  const {
    data,
    total,
    page,
    totalPages,
    isLoading,
    error,
    actionError,
    actingDocumentId,
    scope,
    priority,
    assignees,
    isLoadingAssignees,
    assigneesError,
    assigneeQuery,
    onPageChange,
    reload,
    retryAssignees,
    setAssigneeQuery,
    setScope,
    setPriority,
    claim,
    assign,
    release,
    updatePriority,
  } = useReviewQueue(canAssign);
  const listTitleRef = useRef<HTMLHeadingElement>(null);
  const previousPageRef = useRef(page);

  useEffect(() => {
    if (previousPageRef.current !== page) {
      listTitleRef.current?.focus();
      previousPageRef.current = page;
    }
  }, [page]);
  const queueLabel = total === 0
    ? 'Sin revisiones pendientes'
    : `${total} historia${total !== 1 ? 's' : ''} por revisar`;
  const canOpenDocuments = can(permissions, 'documents.read');
  const canValidateDocuments = can(permissions, 'documents.validate');

  async function handleClaimAndOpen(item: ReviewQueueItem) {
    if (await claim(item)) {
      router.push(`/patients/${item.patient.id}/documents/${item.id}`);
    }
  }

  return (
    <section className={styles.container} aria-labelledby="review-queue-title">
      <header className={styles.hero}>
        <span className={styles.heroPattern} aria-hidden="true" />
        <span className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            <Icon name="review" size={15} />
            Centro de validación clínica
          </span>
          <h1 className={styles.title} id="review-queue-title">
            Historias digitalizadas, listas para revisión
          </h1>
          <p className={styles.subtitle}>
            Verifica cada documento procesado y accede a su detalle sin perder el contexto del paciente.
          </p>
          <div className={styles.heroSignals} aria-label="Características del flujo de revisión">
            <span><Icon name="shield" size={15} /> Acceso clínico protegido</span>
            <span><Icon name="check" size={15} /> Flujo de revisión trazable</span>
          </div>
        </div>

        <aside className={styles.queueSummary} aria-label="Resumen de la cola de revisión">
          <div className={styles.summaryHeading}>
            <span className={styles.summaryIcon} aria-hidden="true">
              <Icon name="review" size={21} />
            </span>
            <span>Estado de la cola</span>
          </div>
          <div className={styles.summaryMetric}>
            <strong>{isLoading ? '—' : total}</strong>
            <span>pendiente{total !== 1 ? 's' : ''}</span>
          </div>
          <div
            className={`${styles.summaryStatus} ${total === 0 ? styles.summaryStatusEmpty : ''}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.statusDot} aria-hidden="true" />
            {isLoading ? 'Actualizando revisiones' : queueLabel}
          </div>
          {!isLoading && total > 0 && (
            <p className={styles.summaryFootnote}>
              Mostrando {data.length} en la página actual
            </p>
          )}
        </aside>
      </header>

      {error && data.length > 0 && (
        <div className={styles.alertWrap}>
          <Alert variant="error">{error}</Alert>
          <button className={styles.retryBtn} type="button" onClick={reload} disabled={isLoading}>
            {isLoading ? 'Reintentando…' : 'Reintentar carga'}
          </button>
        </div>
      )}

      {actionError && (
        <div className={styles.alertWrap} role="status">
          <Alert variant="error">{actionError}</Alert>
          <button className={styles.retryBtn} type="button" onClick={reload} disabled={isLoading}>
            Actualizar cola
          </button>
        </div>
      )}

      {canAssign && assigneesError && (
        <div className={styles.alertWrap}>
          <Alert variant="error">No se pudo cargar la lista de revisores.</Alert>
          <button
            className={styles.retryBtn}
            type="button"
            onClick={retryAssignees}
            disabled={isLoadingAssignees}
          >
            {isLoadingAssignees ? 'Reintentando…' : 'Reintentar revisores'}
          </button>
        </div>
      )}

      <section
        className={styles.queuePanel}
        aria-labelledby="review-list-title"
        aria-busy={isLoading}
      >
        <header className={styles.panelHeader}>
          <div>
            <span className={styles.panelEyebrow}>
              <span className={styles.panelDot} aria-hidden="true" />
              Trabajo pendiente
            </span>
            <h2
              className={styles.panelTitle}
              id="review-list-title"
              ref={listTitleRef}
              tabIndex={-1}
            >
              Historias por revisar
            </h2>
            <p className={styles.panelSubtitle}>
              Selecciona una digitalización para contrastar y validar su contenido.
            </p>
          </div>
          {!isLoading && data.length > 0 && (
            <span className={styles.visibleCount}>
              {data.length} visible{data.length !== 1 ? 's' : ''}
            </span>
          )}
        </header>

        <div className={styles.filters} aria-label="Filtros de la cola">
          <label className={styles.filterField}>
            <span>Asignacion</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ReviewQueueScope)}
              disabled={isLoading}
            >
              <option value="AVAILABLE">Disponibles para mi</option>
              <option value="MINE">Mis asignados</option>
              <option value="UNASSIGNED">Sin asignar</option>
              <option value="ALL">Todos</option>
            </select>
          </label>

          <label className={styles.filterField}>
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as ReviewPriority | '')}
              disabled={isLoading}
            >
              <option value="">Todas</option>
              <option value="URGENT">Urgente</option>
              <option value="HIGH">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Baja</option>
            </select>
          </label>

          {canAssign && (
            <label className={styles.filterField}>
              <span>Buscar revisor</span>
              <input
                type="search"
                value={assigneeQuery}
                onChange={(event) => setAssigneeQuery(event.target.value)}
                placeholder="Nombre o usuario"
                maxLength={50}
                autoComplete="off"
              />
            </label>
          )}

          <p className={styles.filtersHint} role="status" aria-live="polite">
            {canAssign && assigneeQuery.trim()
              ? isLoadingAssignees
                ? 'Buscando revisores…'
                : assigneesError
                  ? 'Búsqueda de revisores no disponible.'
                  : `${assignees.length} revisor${assignees.length === 1 ? '' : 'es'} encontrado${assignees.length === 1 ? '' : 's'}.`
              : '“Disponibles” reúne documentos libres y los que ya tomaste.'}
          </p>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>
            <Spinner label="Cargando cola de revisión…" />
          </div>
        ) : error && data.length === 0 ? (
          <div className={styles.errorState}>
            <Alert variant="error">{error}</Alert>
            <button className={styles.retryBtn} type="button" onClick={reload}>
              Reintentar carga
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState
              icon="review"
              title="Cola vacía"
              description="No hay historias clínicas digitalizadas pendientes de revisión."
            />
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  Historias clínicas digitalizadas pendientes de revisión profesional
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">Documento digitalizado</th>
                    <th scope="col">Prioridad</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Antigüedad</th>
                    <th scope="col"><span className={styles.srOnly}>Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => {
                    const patientName = `${item.patient.lastName}, ${item.patient.firstName}`;
                    const assigneeOptions = item.assignee && !assignees.some(({ id }) => id === item.assignee?.id)
                      ? [item.assignee, ...assignees]
                      : assignees;

                    return (
                      <tr key={item.id}>
                        <td className={styles.patientCell} data-label="Paciente">
                          <span className={styles.cellContent}>
                            <span className={styles.patientAvatar} aria-hidden="true">
                              {getInitials(item.patient.firstName, item.patient.lastName)}
                            </span>
                            <span className={styles.patientIdentity}>
                              <span className={styles.patientName}>{patientName}</span>
                              <span className={styles.patientDoc}>
                                <span>{item.patient.documentType}</span>
                                {item.patient.documentNumber}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className={styles.documentCell} data-label="Documento digitalizado">
                          <span className={styles.cellContent}>
                            <span className={styles.documentIcon} aria-hidden="true">
                              <Icon name="document" size={18} />
                            </span>
                            <span className={styles.documentIdentity}>
                              <span className={styles.docName}>{item.originalName}</span>
                              <span className={styles.docMeta}>
                                {getFileType(item.mimeType)}
                                <i aria-hidden="true" />
                                {formatSize(item.sizeBytes)}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className={styles.priorityCell} data-label="Prioridad">
                          {canAssign ? (
                            <select
                              className={`${styles.compactSelect} ${styles[`priority_${item.reviewPriority}`]}`}
                              value={item.reviewPriority}
                              onChange={(event) => void updatePriority(item, event.target.value as ReviewPriority)}
                              disabled={actingDocumentId === item.id}
                              aria-label={`Cambiar prioridad de ${item.originalName}`}
                            >
                              <option value="URGENT">Urgente</option>
                              <option value="HIGH">Alta</option>
                              <option value="NORMAL">Normal</option>
                              <option value="LOW">Baja</option>
                            </select>
                          ) : (
                            <span className={`${styles.priorityBadge} ${styles[`priority_${item.reviewPriority}`]}`}>
                              {PRIORITY_LABEL[item.reviewPriority]}
                            </span>
                          )}
                        </td>
                        <td className={styles.assigneeCell} data-label="Responsable">
                          <span className={styles.assigneeState}>
                            <strong>
                              {item.assignmentState === 'MINE'
                                ? 'Asignado a ti'
                                : item.assignee?.fullName ?? 'Sin asignar'}
                            </strong>
                            <span>
                              {item.assignee ? `@${item.assignee.username}` : 'Disponible para tomar'}
                            </span>
                          </span>
                          {canAssign && (
                            <select
                              className={styles.assigneeSelect}
                              value={item.assignee?.id ?? ''}
                              onChange={(event) => {
                                const assigneeId = event.target.value;
                                if (assigneeId) void assign(item, assigneeId);
                              }}
                              disabled={
                                actingDocumentId === item.id ||
                                isLoadingAssignees ||
                                Boolean(assigneesError) ||
                                assignees.length === 0
                              }
                              aria-label={`Asignar ${item.originalName} a un revisor`}
                            >
                              <option value="">
                                {isLoadingAssignees
                                  ? 'Cargando revisores…'
                                  : assigneesError
                                    ? 'Revisores no disponibles'
                                    : assignees.length === 0
                                      ? 'Sin revisores elegibles'
                                      : 'Asignar revisor…'}
                              </option>
                              {assigneeOptions.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                  {assignee.id === userId ? 'Yo' : assignee.fullName} (@{assignee.username})
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className={styles.ageCell} data-label="Antigüedad">
                          <span className={styles.dateValue}>
                            <Icon name="clock" size={15} />
                            <span>{formatQueueAge(item.processedAt, item.createdAt)}</span>
                          </span>
                          <time className={styles.dateDetail} dateTime={item.processedAt ?? item.createdAt}>
                            Desde {formatDate(item.processedAt ?? item.createdAt)}
                          </time>
                        </td>
                        <td className={styles.actionCell}>
                          {item.assignmentState === 'UNASSIGNED' && canAssign && canOpenDocuments ? (
                            <button
                              className={styles.actionBtn}
                              type="button"
                              onClick={() => void handleClaimAndOpen(item)}
                              disabled={actingDocumentId === item.id}
                              aria-label={`Tomar y revisar ${item.originalName} de ${item.patient.firstName} ${item.patient.lastName}`}
                            >
                              {actingDocumentId === item.id ? 'Asignando…' : 'Tomar y revisar'}
                              <Icon name="arrow-right" size={16} />
                            </button>
                          ) : canOpenDocuments ? (
                            <div className={styles.actionStack}>
                              <Link
                                className={styles.actionBtn}
                                href={`/patients/${item.patient.id}/documents/${item.id}`}
                                aria-label={`${canValidateDocuments ? 'Revisar' : 'Ver'} digitalización ${item.originalName} de ${item.patient.firstName} ${item.patient.lastName}`}
                              >
                                {item.assignmentState === 'MINE' && canValidateDocuments
                                  ? 'Continuar revisión'
                                  : 'Ver digitalización'}
                                <Icon name="arrow-right" size={16} />
                              </Link>
                              {canAssign && item.assignee && (
                                <button
                                  className={styles.releaseBtn}
                                  type="button"
                                  onClick={() => void release(item)}
                                  disabled={actingDocumentId === item.id}
                                >
                                  Liberar
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className={styles.actionUnavailable}>
                              <Icon name="lock" size={15} />
                              Sin acceso al documento
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className={styles.pagination} aria-label="Páginas de la cola de revisión">
                <p className={styles.pageInfo} aria-live="polite">
                  Página <strong>{page}</strong> de <strong>{totalPages}</strong>
                  <span aria-hidden="true"> · </span>
                  {total} historia{total !== 1 ? 's' : ''}
                </p>
                <div className={styles.paginationButtons}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Ir a la página anterior"
                  >
                    <Icon name="chevron-right" className={styles.previousIcon} size={15} />
                    Anterior
                  </button>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Ir a la página siguiente"
                  >
                    Siguiente
                    <Icon name="chevron-right" size={15} />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}
