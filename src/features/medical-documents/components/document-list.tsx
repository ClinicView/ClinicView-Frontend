'use client';

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
    <div>
      <div className={styles.flowSteps} aria-label="Flujo de digitalización">
        {FLOW_STEPS.map((step, index) => (
          <div className={styles.flowStep} key={step.label}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <Icon name={step.icon} size={18} />
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      {can(permissions, 'documents.upload') && (
        <div className={styles.uploadPanel}>
          <div className={styles.uploadIcon} aria-hidden="true">
            <Icon name="upload" size={28} />
          </div>
          <div className={styles.uploadCopy}>
            <p className={styles.uploadTitle}>Sube una historia clínica en PDF, JPG o PNG</p>
            <p className={styles.uploadNote}>El archivo se vinculará al paciente seleccionado.</p>
          </div>
          <button
            className={styles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Subiendo...' : 'Subir PDF/imagen'}
          </button>
        </div>
      )}

      <div className={styles.toolbar}>
        <select
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

      {error && <Alert variant="error">{error}</Alert>}
      {uploadError && <Alert variant="error">{uploadError}</Alert>}

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
            <thead>
              <tr>
                <th>Historia clínica subida</th>
                <th>Formato</th>
                <th>Tamaño</th>
                <th>Estado</th>
                <th>Subida</th>
              </tr>
            </thead>
            <tbody>
              {data.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => router.push(`/patients/${patientId}/documents/${doc.id}`)}
                >
                  <td>
                    <div className={styles.fileName}>{doc.originalName}</div>
                    <div className={styles.fileMeta}>Abrir revisión y corrección</div>
                  </td>
                  <td>{mimeExt(doc.mimeType)}</td>
                  <td>{formatSize(doc.sizeBytes)}</td>
                  <td>
                    <StatusBadge status={doc.status} label={STATUS_LABEL[doc.status]} dot />
                  </td>
                  <td>{formatDate(doc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && total > 0 && (
        <div className={styles.pagination}>
          <span>
            {total} archivo{total !== 1 ? 's' : ''} - página {page} de {totalPages}
          </span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              Anterior
            </button>
            <button className={styles.pageBtn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
