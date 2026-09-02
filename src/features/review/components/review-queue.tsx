'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { formatInstant } from '@/shared/lib/date-time';
import { Spinner, EmptyState, Alert, Icon } from '@/shared/ui';
import { useReviewQueue } from '../hooks/use-review-queue';
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

export function ReviewQueue() {
  const { data, total, page, totalPages, isLoading, error, onPageChange, reload } = useReviewQueue();
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
                    <th scope="col">Procesado</th>
                    <th scope="col">Subido</th>
                    <th scope="col"><span className={styles.srOnly}>Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => {
                    const patientName = `${item.patient.lastName}, ${item.patient.firstName}`;

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
                        <td className={styles.dateCell} data-label="Procesado">
                          <span className={styles.dateValue}>
                            <Icon name="check" size={15} />
                            <time dateTime={item.processedAt ?? undefined}>
                              {formatDate(item.processedAt)}
                            </time>
                          </span>
                        </td>
                        <td className={styles.dateCell} data-label="Subido">
                          <span className={styles.dateValue}>
                            <Icon name="calendar" size={15} />
                            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                          </span>
                        </td>
                        <td className={styles.actionCell}>
                          <Link
                            className={styles.actionBtn}
                            href={`/patients/${item.patient.id}/documents/${item.id}`}
                            aria-label={`Revisar digitalización ${item.originalName} de ${item.patient.firstName} ${item.patient.lastName}`}
                          >
                            Revisar digitalización
                            <Icon name="arrow-right" size={16} />
                          </Link>
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
