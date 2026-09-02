'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { can } from '@/shared/permissions/can';
import { Spinner, EmptyState, Alert, StatusBadge, Icon, type IconName } from '@/shared/ui';
import type { DocumentStatus } from '../types/document';
import { useDocuments } from '../hooks/use-documents';
import styles from './document-list.module.css';

const STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: 'Pendiente de procesamiento',
  PROCESSING: 'Procesando',
  PROCESSED: 'Procesado - pendiente de revisión',
  FAILED: 'Error de procesamiento',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

const ALL_STATUSES = Object.keys(STATUS_LABEL) as DocumentStatus[];

const FLOW_STEPS: { label: string; icon: IconName }[] = [
  { label: 'Subir PDF/imagen', icon: 'upload' },
  { label: 'Procesar documento', icon: 'scan' },
  { label: 'Corregir OCR', icon: 'edit' },
  { label: 'Validar versión final', icon: 'check' },
];

const MIME_LABEL: Record<string, string> = {
  pdf: 'PDF',
  jpeg: 'JPEG',
  jpg: 'JPEG',
  png: 'PNG',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentListProps {
  patientId: string;
  permissions: string[];
}

export function DocumentList({ patientId, permissions }: DocumentListProps) {
  const {
    data, total, page, totalPages, statusFilter,
    isLoading, error, isUploading, uploadError,
    upload, onPageChange, onStatusFilterChange,
  } = useDocuments(patientId);

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = '';
  }

  const mimeExt = (mimeType: string) => {
    const ext = mimeType.split('/')[1] ?? '';
    return MIME_LABEL[ext] ?? ext.toUpperCase();
  };

  return (
    <div className={styles.documentWorkspace}>
      <section className={styles.flowPanel} aria-labelledby="document-flow-title">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionKicker}>Flujo asistido</span>
          <h2 id="document-flow-title" className={styles.sectionTitle}>
            Del archivo físico al registro validado
          </h2>
        </div>

        <ol className={styles.flowSteps}>
          {FLOW_STEPS.map((step, index) => (
            <li className={styles.flowStep} key={step.label}>
              <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
              <span className={styles.stepIcon} aria-hidden="true">
                <Icon name={step.icon} size={19} />
              </span>
              <span className={styles.stepLabel}>
                <span className={styles.srOnly}>Paso {index + 1}: </span>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {can(permissions, 'documents.upload') && (
        <section className={styles.uploadPanel} aria-labelledby="document-upload-title">
          <div className={styles.uploadIcon} aria-hidden="true">
            <Icon name="upload" size={28} />
          </div>
          <div className={styles.uploadCopy}>
            <span className={styles.uploadEyebrow}>Nueva digitalización</span>
            <h2 id="document-upload-title" className={styles.uploadTitle}>
              Sube una historia clínica en PDF, JPG o PNG
            </h2>
            <p className={styles.uploadNote}>
              El archivo se vinculará al paciente seleccionado.
            </p>
            <ul className={styles.fileTypes} aria-label="Formatos permitidos">
              <li>PDF</li>
              <li>JPG</li>
              <li>PNG</li>
            </ul>
          </div>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-busy={isUploading}
          >
            {isUploading ? (
              <span className={styles.buttonSpinner} aria-hidden="true" />
            ) : (
              <Icon name="upload" size={18} />
            )}
            <span>{isUploading ? 'Subiendo...' : 'Subir PDF/imagen'}</span>
          </button>
        </section>
      )}

      <section
        className={styles.library}
        aria-labelledby="document-library-title"
        aria-busy={isLoading}
      >
        <div className={styles.libraryHeader}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionKicker}>Archivo clínico</span>
            <h2 id="document-library-title" className={styles.sectionTitle}>
              Documentos digitalizados
            </h2>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.filterField}>
              <label htmlFor="document-status-filter" className={styles.filterLabel}>
                Estado
              </label>
              <select
                id="document-status-filter"
                className={styles.select}
                value={statusFilter ?? ''}
                onChange={(e) => onStatusFilterChange((e.target.value as DocumentStatus) || undefined)}
                aria-label="Filtrar por estado de digitalización"
              >
                <option value="">Todos los estados</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <span className={styles.resultCount} aria-live="polite">
              {isLoading ? 'Actualizando...' : `${total} archivo${total !== 1 ? 's' : ''}`}
            </span>

            {can(permissions, 'documents.upload') && (
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
              />
            )}
          </div>
        </div>

        {(error || uploadError) && (
          <div className={styles.alertStack}>
            {error && <Alert variant="error">{error}</Alert>}
            {uploadError && <Alert variant="error">{uploadError}</Alert>}
          </div>
        )}

        <div className={styles.tableWrap}>
          {isLoading ? (
            <Spinner label="Cargando historias clínicas digitalizadas..." />
          ) : data.length === 0 ? (
            <EmptyState
              icon="document"
              title={statusFilter ? 'Sin archivos con ese estado' : 'Sin historias clínicas digitalizadas'}
              description={
                statusFilter
                  ? 'Prueba con otro filtro o sube un nuevo PDF o imagen.'
                  : 'Sube una historia clínica física en PDF o imagen para iniciar la digitalización.'
              }
            />
          ) : (
            <table className={styles.table}>
              <caption className={styles.srOnly}>Historias clínicas digitalizadas</caption>
              <thead>
                <tr>
                  <th scope="col">Historia clínica subida</th>
                  <th scope="col">Formato</th>
                  <th scope="col">Tamaño</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Subida</th>
                </tr>
              </thead>
              <tbody>
                {data.map((doc) => {
                  const documentHref = `/patients/${patientId}/documents/${doc.id}`;

                  return (
                    <tr key={doc.id} onClick={() => router.push(documentHref)}>
                      <td data-label="Historia clínica">
                        <Link
                          href={documentHref}
                          className={styles.fileLink}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className={styles.fileIcon} aria-hidden="true">
                            <Icon name="document" size={20} />
                          </span>
                          <span className={styles.fileIdentity}>
                            <span className={styles.fileName}>{doc.originalName}</span>
                            <span className={styles.fileMeta}>Abrir revisión y corrección</span>
                          </span>
                          <span className={styles.rowArrow} aria-hidden="true">
                            <Icon name="chevron-right" size={18} />
                          </span>
                        </Link>
                      </td>
                      <td data-label="Formato">
                        <span className={styles.formatBadge}>{mimeExt(doc.mimeType)}</span>
                      </td>
                      <td data-label="Tamaño" className={styles.metaCell}>{formatSize(doc.sizeBytes)}</td>
                      <td data-label="Estado">
                        <StatusBadge status={doc.status} label={STATUS_LABEL[doc.status]} dot />
                      </td>
                      <td data-label="Subida" className={styles.metaCell}>{formatDate(doc.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && total > 0 && (
          <nav className={styles.pagination} aria-label="Paginación de documentos">
            <span>
              {total} archivo{total !== 1 ? 's' : ''} - página {page} de {totalPages}
            </span>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                <Icon name="chevron-right" size={16} className={styles.previousIcon} />
                Anterior
              </button>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Siguiente
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
