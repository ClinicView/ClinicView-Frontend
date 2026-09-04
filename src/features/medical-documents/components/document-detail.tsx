'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSession } from '@/features/auth';
import { usePatient } from '@/features/patients';
import { ageFromDateOnly, formatInstant } from '@/shared/lib/date-time';
import { can } from '@/shared/permissions/can';
import { Alert, Icon, Spinner } from '@/shared/ui';
import { useDocument } from '../hooks/use-document';
import type {
  CorrectedEntity,
  DocumentStatus,
  NerEntity,
  ValidationChecklistId,
} from '../types/document';
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
  return formatInstant(iso, {
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

function toCorrectedEntities(entities: Array<NerEntity | CorrectedEntity> | null): CorrectedEntity[] {
  return (entities ?? []).map((entity) => ({
    type: entity.type,
    value: entity.value,
    normalizedValue: entity.normalizedValue ?? '',
  }));
}

type TabId = 'text' | 'entities' | 'validation';

const CORRECTION_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'text', label: 'Texto corregido' },
  { id: 'entities', label: 'Entidades' },
  { id: 'validation', label: 'Validación' },
];

interface DocumentDetailProps {
  patientId: string;
  docId: string;
  permissions: string[];
}

export function DocumentDetail({ patientId, docId, permissions }: DocumentDetailProps) {
  const canReadPatient = can(permissions, 'patients.read');
  const {
    document,
    isLoading,
    error,
    actionError,
    actionErrorStatus,
    isActing,
    process,
    saveCorrection,
    validate,
    reject,
    claimAssignment,
    releaseAssignment,
    reload,
  } = useDocument(patientId, docId);
  const { user } = useSession();
  const { patient, isLoading: isPatientLoading } = usePatient(patientId, {
    enabled: canReadPatient,
  });

  const [activeTab, setActiveTab] = useState<TabId>('text');
  const [correctedText, setCorrectedText] = useState('');
  const [correctedEntities, setCorrectedEntities] = useState<CorrectedEntity[]>([]);
  const [checkedValidation, setCheckedValidation] = useState<Set<ValidationChecklistId>>(
    new Set(),
  );
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!document) return;
    setCorrectedText(document.correctedText ?? document.ocrText ?? '');
    setCorrectedEntities(
      document.correctedEntities
        ? toCorrectedEntities(document.correctedEntities)
        : toCorrectedEntities(document.nerEntities),
    );
    setCheckedValidation(new Set());
  }, [document]);

  const savedText = document?.correctedText ?? document?.ocrText ?? '';
  const savedEntities = JSON.stringify(
    document?.correctedEntities
      ? toCorrectedEntities(document.correctedEntities)
      : toCorrectedEntities(document?.nerEntities ?? null),
  );
  const isDirty = Boolean(
    document &&
      (correctedText !== savedText || JSON.stringify(correctedEntities) !== savedEntities),
  );

  useEffect(() => {
    if (!isDirty) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventAccidentalExit);
    return () => window.removeEventListener('beforeunload', preventAccidentalExit);
  }, [isDirty]);

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
  if (error) {
    return (
      <div className={styles.loadError}>
        <Alert variant="error">{error}</Alert>
        <button className={styles.btn} type="button" onClick={() => void reload()}>
          Reintentar carga
        </button>
      </div>
    );
  }
  if (!document) return null;

  const canProcess =
    can(permissions, 'documents.upload') &&
    (document.status === 'PENDING' || document.status === 'FAILED');
  const isAssignedToCurrentUser = document.assignedReviewerId === user?.sub;
  const canManageAssignment = can(permissions, 'review.assign');
  const canCorrect =
    can(permissions, 'documents.validate') &&
    document.status === 'PROCESSED' &&
    isAssignedToCurrentUser;
  const canValidate = canCorrect;
  const canReject =
    can(permissions, 'documents.reject') &&
    (document.status === 'PENDING' ||
      (document.status === 'PROCESSED' && isAssignedToCurrentUser));

  const needsProcessing = document.status === 'PENDING' || document.status === 'FAILED';

  function normalizedEntities(): CorrectedEntity[] {
    return correctedEntities
      .map((entity) => ({
        type: entity.type,
        value: entity.value.trim(),
        normalizedValue: entity.normalizedValue?.trim() || null,
      }))
      .filter((entity) => entity.value.length > 0);
  }

  async function handleSave() {
    return saveCorrection({
      correctedText,
      correctedEntities: normalizedEntities(),
    });
  }

  async function handleMarkReviewed() {
    const updated = await handleSave();
    if (updated) activateTab('validation', true);
  }

  async function handleValidate() {
    await validate({
      correctedText,
      correctedEntities: normalizedEntities(),
      checklistItems: Array.from(checkedValidation),
      attested: true,
    });
  }

  async function handleReject() {
    const trimmed = rejectReason.trim();
    if (trimmed.length < 10) return;
    const updated = await reject(trimmed);
    if (updated) {
      setShowRejectForm(false);
      setRejectReason('');
    }
  }

  async function handleReleaseAssignment() {
    if (isDirty && !window.confirm('Liberar la revisión descartará los cambios que no hayas guardado. ¿Deseas continuar?')) {
      return;
    }
    await releaseAssignment();
  }

  async function handleReloadLatest() {
    if (
      (isDirty || rejectReason.trim().length > 0) &&
      !window.confirm(
        'Recargar descartará el texto, las entidades y el motivo de rechazo que no hayas guardado. ¿Deseas continuar?',
      )
    ) {
      return;
    }
    await reload();
  }

  function updateEntity(index: number, patch: Partial<CorrectedEntity>) {
    setCheckedValidation(new Set());
    setCorrectedEntities((prev) =>
      prev.map((entity, i) => (i === index ? { ...entity, ...patch } : entity)),
    );
  }

  function removeEntity(index: number) {
    setCheckedValidation(new Set());
    setCorrectedEntities((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCorrectedTextChange(value: string) {
    setCheckedValidation(new Set());
    setCorrectedText(value);
  }

  function toggleValidationItem(id: ValidationChecklistId) {
    setCheckedValidation((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function activateTab(tabId: TabId, moveFocus = false) {
    setActiveTab(tabId);
    if (!moveFocus) return;
    const tabIndex = CORRECTION_TABS.findIndex((tab) => tab.id === tabId);
    window.requestAnimationFrame(() => tabRefs.current[tabIndex]?.focus());
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % CORRECTION_TABS.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + CORRECTION_TABS.length) % CORRECTION_TABS.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = CORRECTION_TABS.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(CORRECTION_TABS[nextIndex].id, true);
  }

  const patientLine = !canReadPatient
    ? 'Datos demográficos restringidos'
    : patient
      ? `${patient.lastName}, ${patient.firstName}`
      : isPatientLoading
        ? 'Cargando…'
        : 'No disponible';
  const patientAge = ageFromDateOnly(patient?.dateOfBirth);
  const patientSub = patient
    ? `${patient.documentNumber} · ${patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'}${patientAge === null ? '' : ` · ${patientAge} años`}`
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
          <span
            className={`${styles.statusBadge} ${styles[`status_${document.status}`]}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {STATUS_LABEL[document.status]}
          </span>
        </div>

        <div className={styles.headerField}>
          <span className={styles.headerFieldLabel}>Responsable de revisión</span>
          <span className={styles.headerFieldValue}>
            {isAssignedToCurrentUser
              ? 'Asignado a ti'
              : document.assignedReviewer?.fullName ?? 'Sin asignar'}
          </span>
          <span className={styles.headerFieldSub}>
            {document.assignedReviewer
              ? `@${document.assignedReviewer.username}`
              : `Prioridad ${document.reviewPriority.toLocaleLowerCase('es-PE')}`}
          </span>
          {document.status === 'PROCESSED' && canManageAssignment && document.assignedReviewerId && (
              <button
                className={styles.inlineAssignmentBtn}
                type="button"
                onClick={() => void handleReleaseAssignment()}
                disabled={isActing}
              >
                Liberar revisión
              </button>
          )}
        </div>

        <DocumentStepper document={document} />
      </section>

      {!canCorrect && !canValidate && actionError && (
        <div className={styles.actionErrorGroup} role="alert">
          <span className={styles.actionError}>{actionError}</span>
          {actionErrorStatus === 409 && (
            <button
              className={`${styles.btn} ${styles.retryButton}`}
              type="button"
              onClick={() => void handleReloadLatest()}
              disabled={isActing}
            >
              Recargar versión actual
            </button>
          )}
        </div>
      )}

      {/* Banners de estado */}
      {needsProcessing && (
        <div className={`${styles.banner} ${styles.bannerWarning}`} role="status">
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
              aria-busy={isActing}
            >
              <Icon name="scan" size={16} />
              {isActing ? 'Procesando…' : 'Procesar digitalización'}
            </button>
          )}
        </div>
      )}

      {document.status === 'PROCESSING' && (
        <div
          className={`${styles.banner} ${styles.bannerInfo}`}
          role="status"
          aria-live="polite"
        >
          <div>
            <p className={styles.bannerTitle}>Procesamiento en curso en segundo plano.</p>
            <p className={styles.bannerText}>
              Puedes seguir navegando por otras secciones: recibirás una notificación
              (campana superior) cuando el OCR termine. Esta vista también se
              actualiza sola.
            </p>
          </div>
        </div>
      )}

      {document.status === 'PROCESSED' && !document.ocrText && (
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
          <div>
            <p className={styles.bannerTitle}>El OCR no devolvió texto utilizable.</p>
            <p className={styles.bannerText}>
              Puedes transcribir el contenido manualmente y completar la revisión clínica sin
              perder el archivo original.
            </p>
          </div>
        </div>
      )}

      {document.status === 'PROCESSED' && !document.assignedReviewerId && (
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
          <div>
            <p className={styles.bannerTitle}>La revisión todavía no tiene responsable.</p>
            <p className={styles.bannerText}>
              Toma el documento antes de corregir, validar o rechazar su contenido.
            </p>
          </div>
          {canManageAssignment && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              onClick={() => void claimAssignment()}
              disabled={isActing}
            >
              {isActing ? 'Asignando…' : 'Tomar revisión'}
            </button>
          )}
        </div>
      )}

      {document.status === 'PROCESSED' && document.assignedReviewerId && !isAssignedToCurrentUser && (
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
          <div>
            <p className={styles.bannerTitle}>Documento asignado a otro revisor.</p>
            <p className={styles.bannerText}>
              Puedes consultar el contenido, pero solo la persona responsable puede modificar o finalizar la revisión.
            </p>
          </div>
        </div>
      )}

      {document.rejectReason && (
        <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
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
            <h2 id="correction-title" className={styles.correctionTitle}>Corrección profesional</h2>
            {suggestions.length > 0 && (
              <span className={styles.suggestionsChip}>
                <Icon name="sparkle" size={13} />
                Sugerencias ({suggestions.length})
              </span>
            )}
          </div>

          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Paneles de corrección"
            aria-orientation="horizontal"
          >
            {CORRECTION_TABS.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                id={`correction-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                aria-controls={`correction-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => activateTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id="correction-panel-text"
            className={styles.tabBody}
            role="tabpanel"
            aria-labelledby="correction-tab-text"
            aria-busy={isActing}
            tabIndex={0}
            hidden={activeTab !== 'text'}
          >
            <StructuredTextEditor
              text={correctedText}
              disabled={!canCorrect || isActing}
              suggestions={suggestions}
              onChange={handleCorrectedTextChange}
              onDismissSuggestion={(id) =>
                setDismissedSuggestions((prev) => new Set(prev).add(id))
              }
            />
          </div>

          <div
            id="correction-panel-entities"
            className={styles.tabBody}
            role="tabpanel"
            aria-labelledby="correction-tab-entities"
            aria-busy={isActing}
            tabIndex={0}
            hidden={activeTab !== 'entities'}
          >
            <EntitiesPanel
              detected={document.nerEntities}
              corrected={correctedEntities}
              editable={canCorrect}
              isActing={isActing}
              onEntityChange={updateEntity}
              onEntityRemove={removeEntity}
            />
          </div>

          <div
            id="correction-panel-validation"
            className={styles.tabBody}
            role="tabpanel"
            aria-labelledby="correction-tab-validation"
            aria-busy={isActing}
            tabIndex={0}
            hidden={activeTab !== 'validation'}
          >
            <ValidationPanel
              checked={checkedValidation}
              canValidate={canValidate}
              canReject={canReject}
              isActing={isActing}
              hasUnsavedChanges={isDirty}
              showRejectForm={showRejectForm}
              rejectReason={rejectReason}
              onToggle={toggleValidationItem}
              onValidate={() => void handleValidate()}
              onToggleRejectForm={() => setShowRejectForm((value) => !value)}
              onRejectReasonChange={setRejectReason}
              onReject={() => void handleReject()}
            />
          </div>

          <MetricsPanel metrics={document.metrics} confidenceLevel={document.confidenceLevel} />
        </section>
      </div>

      {/* Barra inferior de acciones */}
      {(canCorrect || canValidate) && (
        <footer
          className={styles.actionBar}
          aria-label="Acciones de la revisión"
          aria-busy={isActing}
        >
          <span
            className={`${styles.saveState} ${isDirty ? styles.saveStateDirty : styles.saveStateSaved}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <Icon name={isDirty ? 'edit' : 'check'} size={15} />
            {isDirty ? 'Cambios sin guardar' : 'Cambios guardados'}
          </span>
          <span className={styles.srOnly} role="status" aria-live="polite">
            {isActing ? 'Actualizando el documento clínico…' : ''}
          </span>
          {actionError && (
            <div className={styles.actionErrorGroup} role="alert">
              <span className={styles.actionError}>{actionError}</span>
              {actionErrorStatus === 409 && (
                <button
                  className={`${styles.btn} ${styles.retryButton}`}
                  type="button"
                  onClick={() => void handleReloadLatest()}
                  disabled={isActing}
                >
                  {isDirty || rejectReason.trim()
                    ? 'Descartar cambios y recargar'
                    : 'Recargar versión actual'}
                </button>
              )}
            </div>
          )}

          <div className={styles.actionButtons}>
            {canCorrect && (
              <button
                className={styles.btn}
                type="button"
                onClick={() => void handleSave()}
                disabled={isActing || !isDirty}
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
                disabled={isActing || correctedText.trim().length === 0}
              >
                <Icon name="check" size={15} />
                Marcar como revisado
              </button>
            )}
            {canValidate && (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                onClick={() => activateTab('validation', true)}
                disabled={isActing || correctedText.trim().length === 0}
                aria-controls="correction-panel-validation"
              >
                <Icon name="shield" size={15} />
                Validar versión final
              </button>
            )}
          </div>
        </footer>
      )}

    </div>
  );
}
