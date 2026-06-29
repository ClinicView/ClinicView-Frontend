'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { can } from '@/shared/permissions/can';
import { Alert, Spinner } from '@/shared/ui';
import { useDocument } from '../hooks/use-document';
import type { CorrectedEntity, DocumentStatus, NerEntity } from '../types/document';
import { CorrectionEditor } from './correction-editor';
import { DocumentPreview } from './document-preview';
import { DocumentReviewLayout } from './document-review-layout';
import { OcrOriginalPanel } from './ocr-original-panel';
import styles from './document-detail.module.css';

const STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: 'Pendiente de procesamiento',
  PROCESSING: 'Procesando',
  PROCESSED: 'Procesado - pendiente de revision',
  FAILED: 'Error de procesamiento',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toCorrectedEntities(entities: Array<NerEntity | CorrectedEntity> | null): CorrectedEntity[] {
  return (entities ?? []).map((entity) => ({
    type: entity.type,
    value: entity.value,
    normalizedValue: entity.normalizedValue ?? '',
  }));
}

interface DocumentDetailProps {
  patientId: string;
  docId: string;
  permissions: string[];
}

export function DocumentDetail({ patientId, docId, permissions }: DocumentDetailProps) {
  const {
    document,
    isLoading,
    error,
    actionError,
    isActing,
    process,
    saveCorrection,
    validate,
    reject,
  } = useDocument(patientId, docId);
  const router = useRouter();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [correctedEntities, setCorrectedEntities] = useState<CorrectedEntity[]>([]);

  useEffect(() => {
    if (!document) return;
    setCorrectedText(document.correctedText ?? document.ocrText ?? '');
    setCorrectedEntities(
      document.correctedEntities
        ? toCorrectedEntities(document.correctedEntities)
        : toCorrectedEntities(document.nerEntities),
    );
  }, [document]);

  if (isLoading) return <Spinner label="Cargando documento..." />;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!document) return null;

  const canProcess =
    can(permissions, 'documents.upload') &&
    (document.status === 'PENDING' || document.status === 'FAILED');

  const canCorrect =
    can(permissions, 'documents.validate') && document.status === 'PROCESSED';

  const canValidate =
    can(permissions, 'documents.validate') && document.status === 'PROCESSED';

  const canReject =
    can(permissions, 'documents.reject') && document.status === 'PROCESSED';

  const hasOcr = Boolean(document.ocrText);
  const needsProcessing = document.status === 'PENDING' || document.status === 'FAILED';

  async function handleSaveCorrection() {
    await saveCorrection({
      correctedText,
      correctedEntities: correctedEntities
        .map((entity) => ({
          type: entity.type,
          value: entity.value.trim(),
          normalizedValue: entity.normalizedValue?.trim() || null,
        }))
        .filter((entity) => entity.value.length > 0),
    });
  }

  async function handleReject() {
    const trimmed = rejectReason.trim();
    if (trimmed.length < 10) return;
    await reject(trimmed);
    setShowRejectForm(false);
    setRejectReason('');
  }

  function updateEntity(index: number, patch: Partial<CorrectedEntity>) {
    setCorrectedEntities((prev) =>
      prev.map((entity, i) => (i === index ? { ...entity, ...patch } : entity)),
    );
  }

  function removeEntity(index: number) {
    setCorrectedEntities((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Comparar documento original y correccion</p>
          <p className={styles.title}>{document.originalName}</p>
          <p className={styles.meta}>
            {document.mimeType} - {formatSize(document.sizeBytes)}
          </p>
          <p className={styles.helpText}>
            Usa la vista del documento original para corregir la transcripcion antes de validar.
          </p>
        </div>
        <span className={`${styles.badge} ${styles[document.status]}`}>
          {STATUS_LABEL[document.status]}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Subido</span>
          <span className={styles.fieldValue}>{formatDate(document.createdAt)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Procesado</span>
          <span className={`${styles.fieldValue} ${!document.processedAt ? styles.fieldEmpty : ''}`}>
            {formatDate(document.processedAt)}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Corregido</span>
          <span className={`${styles.fieldValue} ${!document.correctedAt ? styles.fieldEmpty : ''}`}>
            {formatDate(document.correctedAt)}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Revisado</span>
          <span className={`${styles.fieldValue} ${!document.reviewedAt ? styles.fieldEmpty : ''}`}>
            {formatDate(document.reviewedAt)}
          </span>
        </div>
      </div>

      {needsProcessing && (
        <div className={styles.statusActionBox}>
          <div>
            <p className={styles.statusActionTitle}>Este documento todavia necesita procesamiento.</p>
            <p className={styles.statusActionText}>
              Ejecuta la digitalizacion para obtener texto OCR antes de corregir y validar.
            </p>
          </div>
          {canProcess && (
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}
              type="button"
              onClick={() => void process()}
              disabled={isActing}
            >
              {isActing ? 'Procesando...' : 'Procesar digitalizacion'}
            </button>
          )}
        </div>
      )}

      {document.rejectReason && (
        <>
          <hr className={styles.divider} />
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Motivo de rechazo</p>
            <div className={styles.rejectBox}>{document.rejectReason}</div>
          </div>
        </>
      )}

      {document.status === 'PROCESSING' && (
        <>
          <hr className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.processingBox}>
              Procesamiento en curso. El texto y las entidades apareceran aqui cuando finalice.
            </div>
          </div>
        </>
      )}

      <hr className={styles.divider} />
      <DocumentReviewLayout
        preview={
          <DocumentPreview
            patientId={patientId}
            docId={docId}
            mimeType={document.mimeType}
            originalName={document.originalName}
          />
        }
        editor={
          <CorrectionEditor
            correctedText={correctedText}
            correctedEntities={correctedEntities}
            canCorrect={canCorrect}
            canValidate={canValidate}
            canReject={canReject}
            isActing={isActing}
            showRejectForm={showRejectForm}
            rejectReason={rejectReason}
            hasOcr={hasOcr}
            onCorrectedTextChange={setCorrectedText}
            onEntityChange={updateEntity}
            onEntityRemove={removeEntity}
            onSaveCorrection={() => void handleSaveCorrection()}
            onValidate={() => void validate()}
            onToggleRejectForm={() => setShowRejectForm((value) => !value)}
            onRejectReasonChange={setRejectReason}
            onReject={() => void handleReject()}
            onCancelReject={() => setShowRejectForm(false)}
          />
        }
        support={
          <>
            <OcrOriginalPanel ocrText={document.ocrText} />
            <details className={styles.collapsiblePanel}>
              <summary className={styles.collapsibleSummary}>Ver metadata tecnica</summary>
              <div className={styles.metadataList}>
                <span>Tipo: {document.mimeType}</span>
                <span>Tamano: {formatSize(document.sizeBytes)}</span>
                <span>Subido: {formatDate(document.createdAt)}</span>
                <span>Procesado: {formatDate(document.processedAt)}</span>
                <span>Corregido: {formatDate(document.correctedAt)}</span>
                <span>Revisado: {formatDate(document.reviewedAt)}</span>
              </div>
            </details>
          </>
        }
      />

      <hr className={styles.divider} />
      <div className={styles.actions}>
        <button className={styles.btn} type="button" onClick={() => router.back()}>
          Volver
        </button>
      </div>

      {actionError && <p className={styles.actionError}>{actionError}</p>}
    </div>
  );
}
