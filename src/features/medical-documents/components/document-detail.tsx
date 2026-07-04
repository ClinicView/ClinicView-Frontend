'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/features/auth';
import { usePatient } from '@/features/patients';
import { can } from '@/shared/permissions/can';
import { Alert, Icon, Spinner } from '@/shared/ui';
import { useDocument } from '../hooks/use-document';
import type { CorrectedEntity, DocumentStatus, NerEntity } from '../types/document';
import { DocumentPreview } from './document-preview';
import { DocumentStepper } from './document-stepper';
import { EntitiesPanel } from './entities-panel';
import { MetricsPanel } from './metrics-panel';
import { StructuredTextEditor, type OcrSuggestion } from './structured-text-editor';
import { ValidationPanel } from './validation-panel';
import styles from './correction-view.module.css';

const STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  PROCESSED: 'En corrección',
  FAILED: 'Error OCR',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

const SUGGESTION_CONFIDENCE_THRESHOLD = 0.8;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
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

function fileKind(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/jpeg') return 'JPG';
  if (mimeType === 'image/png') return 'PNG';
  return 'DOC';
}

function computeAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function toCorrectedEntities(entities: Array<NerEntity | CorrectedEntity> | null): CorrectedEntity[] {
  return (entities ?? []).map((entity) => ({
    type: entity.type,
    value: entity.value,
    normalizedValue: entity.normalizedValue ?? '',
  }));
}

type TabId = 'text' | 'entities' | 'validation';

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
  const { user } = useSession();
  const { patient } = usePatient(patientId);

  const [activeTab, setActiveTab] = useState<TabId>('text');
  const [correctedText, setCorrectedText] = useState('');
  const [correctedEntities, setCorrectedEntities] = useState<CorrectedEntity[]>([]);
  const [checkedValidation, setCheckedValidation] = useState<Set<string>>(new Set());
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!document) return;
    setCorrectedText(document.correctedText ?? document.ocrText ?? '');
    setCorrectedEntities(
      document.correctedEntities
        ? toCorrectedEntities(document.correctedEntities)
        : toCorrectedEntities(document.nerEntities),
    );
  }, [document]);

  const suggestions = useMemo<OcrSuggestion[]>(() => {
    if (!document?.nerEntities) return [];
    return document.nerEntities
      .map((entity, index) => ({ entity, id: `${entity.type}-${index}` }))
      .filter(
        ({ entity, id }) =>
          entity.confidence < SUGGESTION_CONFIDENCE_THRESHOLD &&
          entity.value.trim().length > 2 &&
          !dismissedSuggestions.has(id),
      )
      .map(({ entity, id }) => ({ id, value: entity.value }));
  }, [document?.nerEntities, dismissedSuggestions]);

  if (isLoading) return <Spinner label="Cargando documento…" />;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!document) return null;

  const canProcess =
    can(permissions, 'documents.upload') &&
    (document.status === 'PENDING' || document.status === 'FAILED');
  const canCorrect = can(permissions, 'documents.validate') && document.status === 'PROCESSED';
  const canValidate = can(permissions, 'documents.validate') && document.status === 'PROCESSED';
  const canReject = can(permissions, 'documents.reject') && document.status === 'PROCESSED';

  const hasOcr = Boolean(document.ocrText);
  const needsProcessing = document.status === 'PENDING' || document.status === 'FAILED';

  const savedText = document.correctedText ?? document.ocrText ?? '';
  const savedEntities = JSON.stringify(
    document.correctedEntities
      ? toCorrectedEntities(document.correctedEntities)
      : toCorrectedEntities(document.nerEntities),
  );
  const isDirty =
    correctedText !== savedText || JSON.stringify(correctedEntities) !== savedEntities;

  async function handleSave() {
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

  async function handleMarkReviewed() {
    await handleSave();
    setActiveTab('validation');
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

  function toggleValidationItem(id: string) {
    setCheckedValidation((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const patientLine = patient
    ? `${patient.lastName}, ${patient.firstName}`
    : 'Cargando…';
  const patientSub = patient
    ? `${patient.documentNumber} · ${patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'} · ${computeAge(patient.dateOfBirth)} años`
    : '';

  return (
    <div className={styles.page}>
      {/* Cabecera del documento */}
      <section className={styles.headerCard} aria-label="Resumen del documento">
        <div className={styles.fileBlock}>
          <span className={styles.fileIcon} aria-hidden="true">
            <Icon name="document" size={20} />
            {fileKind(document.mimeType)}
          </span>
          <div>
            <p className={styles.fileName} title={document.originalName}>{document.originalName}</p>
            <p className={styles.fileMeta}>
              {fileKind(document.mimeType)} · {formatSize(document.sizeBytes)}
            </p>
          </div>
        </div>

        <div className={styles.headerField}>
          <span className={styles.headerFieldLabel}>Paciente</span>
          <span className={styles.headerFieldValue}>{patientLine}</span>
          {patientSub && <span className={styles.headerFieldSub}>{patientSub}</span>}
        </div>

        <div className={styles.headerField}>
          <span className={styles.headerFieldLabel}>Estado</span>
          <span className={`${styles.statusBadge} ${styles[`status_${document.status}`]}`}>
            {STATUS_LABEL[document.status]}
          </span>
        </div>

        {user && (
          <div className={styles.headerField}>
            <span className={styles.headerFieldLabel}>Asignado a</span>
            <span className={styles.headerFieldValue}>{user.email}</span>
          </div>
        )}

        <DocumentStepper document={document} />
      </section>

      {/* Banners de estado */}
      {needsProcessing && (
        <div className={`${styles.banner} ${styles.bannerWarning}`}>
          <div>
            <p className={styles.bannerTitle}>Este documento todavía necesita procesamiento.</p>
            <p className={styles.bannerText}>
              Ejecuta la digitalización para obtener el texto OCR antes de corregir y validar.
            </p>
          </div>
          {canProcess && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              onClick={() => void process()}
              disabled={isActing}
            >
              <Icon name="scan" size={16} />
              {isActing ? 'Procesando…' : 'Procesar digitalización'}
            </button>
          )}
        </div>
      )}

      {document.status === 'PROCESSING' && (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <div>
            <p className={styles.bannerTitle}>Procesamiento en curso.</p>
            <p className={styles.bannerText}>
              El texto y las entidades aparecerán aquí cuando el motor OCR finalice.
            </p>
          </div>
        </div>
      )}

      {document.rejectReason && (
        <div className={`${styles.banner} ${styles.bannerDanger}`}>
          <div>
            <p className={styles.bannerTitle}>Digitalización rechazada</p>
            <p className={styles.bannerText}>{document.rejectReason}</p>
          </div>
        </div>
      )}

      {/* Split 50/50: visor + corrección */}
      <div className={styles.split}>
        <div className={styles.leftColumn}>
          <DocumentPreview
            patientId={patientId}
            docId={docId}
            mimeType={document.mimeType}
            originalName={document.originalName}
          />

          <details className={styles.collapsible}>
            <summary className={styles.collapsibleSummary}>
              <Icon name="scan" size={16} />
              Ver OCR original
              <span className={styles.collapsibleHint}>
                Transcripción automática completa, conservada para trazabilidad
              </span>
            </summary>
            <div className={styles.collapsibleBody}>
              <div className={styles.ocrBox}>
                {document.ocrText ?? 'Todavía no hay texto reconocido.'}
              </div>
            </div>
          </details>

          <details className={styles.collapsible}>
            <summary className={styles.collapsibleSummary}>
              <Icon name="records" size={16} />
              Ver metadata técnica
              <span className={styles.collapsibleHint}>
                Información del archivo y del procesamiento OCR
              </span>
            </summary>
            <div className={styles.collapsibleBody}>
              <div className={styles.metaList}>
                <span>Tipo: {document.mimeType}</span>
                <span>Tamaño: {formatSize(document.sizeBytes)}</span>
                <span>Subido: {formatDate(document.createdAt)}</span>
                <span>Procesado: {formatDate(document.processedAt)}</span>
                <span>Corregido: {formatDate(document.correctedAt)}</span>
                <span>Revisado: {formatDate(document.reviewedAt)}</span>
              </div>
            </div>
          </details>
        </div>

        {/* Panel de corrección profesional */}
        <section className={styles.correctionPanel} aria-labelledby="correction-title">
          <div className={styles.correctionHeader}>
            <p id="correction-title" className={styles.correctionTitle}>Corrección profesional</p>
            {suggestions.length > 0 && (
              <span className={styles.suggestionsChip}>
                <Icon name="sparkle" size={13} />
                Sugerencias ({suggestions.length})
              </span>
            )}
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Paneles de corrección">
            {(
              [
                { id: 'text', label: 'Texto corregido' },
                { id: 'entities', label: 'Entidades' },
                { id: 'validation', label: 'Validación' },
              ] as Array<{ id: TabId; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.tabBody}>
            {activeTab === 'text' && (
              <StructuredTextEditor
                text={correctedText}
                disabled={!canCorrect || isActing || !hasOcr}
                suggestions={suggestions}
                onChange={setCorrectedText}
                onDismissSuggestion={(id) =>
                  setDismissedSuggestions((prev) => new Set(prev).add(id))
                }
              />
            )}

            {activeTab === 'entities' && (
              <EntitiesPanel
                detected={document.nerEntities}
                corrected={correctedEntities}
                editable={canCorrect && hasOcr}
                isActing={isActing}
                onEntityChange={updateEntity}
                onEntityRemove={removeEntity}
              />
            )}

            {activeTab === 'validation' && (
              <ValidationPanel
                checked={checkedValidation}
                canValidate={canValidate}
                canReject={canReject}
                isActing={isActing}
                showRejectForm={showRejectForm}
                rejectReason={rejectReason}
                onToggle={toggleValidationItem}
                onValidate={() => void validate()}
                onToggleRejectForm={() => setShowRejectForm((value) => !value)}
                onRejectReasonChange={setRejectReason}
                onReject={() => void handleReject()}
              />
            )}
          </div>

          <MetricsPanel metrics={document.metrics} confidenceLevel={document.confidenceLevel} />
        </section>
      </div>

      {/* Barra inferior de acciones */}
      {(canCorrect || canValidate) && (
        <footer className={styles.actionBar}>
          <span
            className={`${styles.saveState} ${isDirty ? styles.saveStateDirty : styles.saveStateSaved}`}
          >
            <Icon name={isDirty ? 'edit' : 'check'} size={15} />
            {isDirty ? 'Cambios sin guardar' : 'Cambios guardados'}
          </span>
          {actionError && <span className={styles.actionError}>{actionError}</span>}

          <div className={styles.actionButtons}>
            {canCorrect && (
              <button
                className={styles.btn}
                type="button"
                onClick={() => void handleSave()}
                disabled={isActing || !hasOcr || !isDirty}
              >
                <Icon name="download" size={15} />
                Guardar borrador
              </button>
            )}
            {canCorrect && (
              <button
                className={styles.btn}
                type="button"
                onClick={() => void handleMarkReviewed()}
                disabled={isActing || !hasOcr}
              >
                <Icon name="check" size={15} />
                Marcar como revisado
              </button>
            )}
            {canValidate && (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                onClick={() => setActiveTab('validation')}
                disabled={isActing || !hasOcr}
              >
                <Icon name="shield" size={15} />
                Validar versión final
              </button>
            )}
          </div>
        </footer>
      )}

      {!canCorrect && !canValidate && actionError && (
        <p className={styles.actionError}>{actionError}</p>
      )}
    </div>
  );
}
