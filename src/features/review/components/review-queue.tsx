'use client';

import Link from 'next/link';
import { Spinner, EmptyState, Alert } from '@/shared/ui';
import { useReviewQueue } from '../hooks/use-review-queue';
import styles from './review-queue.module.css';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  } as Intl.DateTimeFormatOptions);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReviewQueue() {
  const { data, total, page, totalPages, isLoading, error, onPageChange } = useReviewQueue();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cola de revisión de historias clínicas digitalizadas</h1>
          <p className={styles.subtitle}>
            Aquí aparecerán los documentos procesados que necesitan revisión profesional.
          </p>
        </div>
        <span className={`${styles.countPill} ${total === 0 ? styles.countPillEmpty : ''}`}>
          {total === 0
            ? 'Sin revisiones pendientes'
            : `${total} historia${total !== 1 ? 's' : ''} por revisar`}
        </span>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <Spinner label="Cargando cola de revisión…" />
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
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Historia clínica digitalizada</th>
                  <th>Procesado</th>
                  <th>Subido</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className={styles.patientName}>
                        {item.patient.lastName}, {item.patient.firstName}
                      </div>
                      <div className={styles.patientDoc}>
                        {item.patient.documentType} {item.patient.documentNumber}
                      </div>
                    </td>
                    <td>
                      <div className={styles.docName}>{item.originalName}</div>
                      <div className={styles.docMeta}>
                        {item.mimeType.split('/')[1]?.toUpperCase()} · {formatSize(item.sizeBytes)}
                      </div>
                    </td>
                    <td>{formatDate(item.processedAt)}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <Link
                        className={styles.actionBtn}
                        href={`/patients/${item.patient.id}/documents/${item.id}`}
                      >
                        Revisar digitalización
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Anterior
              </button>
              <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
