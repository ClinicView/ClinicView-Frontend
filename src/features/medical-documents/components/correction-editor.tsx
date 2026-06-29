'use client';

import type { CorrectedEntity, NerEntity } from '../types/document';
import styles from './document-detail.module.css';

const ENTITY_TYPES: NerEntity['type'][] = [
  'DIAGNOSIS',
  'SYMPTOM',
  'MEDICATION',
  'PROCEDURE',
  'CLINICAL_DATE',
  'OBSERVATION',
];

interface CorrectionEditorProps {
  correctedText: string;
  correctedEntities: CorrectedEntity[];
  canCorrect: boolean;
  canValidate: boolean;
  canReject: boolean;
  isActing: boolean;
  showRejectForm: boolean;
  rejectReason: string;
  hasOcr: boolean;
  onCorrectedTextChange: (value: string) => void;
  onEntityChange: (index: number, patch: Partial<CorrectedEntity>) => void;
  onEntityRemove: (index: number) => void;
  onSaveCorrection: () => void;
  onValidate: () => void;
  onToggleRejectForm: () => void;
  onRejectReasonChange: (value: string) => void;
  onReject: () => void;
  onCancelReject: () => void;
}

export function CorrectionEditor({
  correctedText,
  correctedEntities,
  canCorrect,
  canValidate,
  canReject,
  isActing,
  showRejectForm,
  rejectReason,
  hasOcr,
  onCorrectedTextChange,
  onEntityChange,
  onEntityRemove,
  onSaveCorrection,
  onValidate,
  onToggleRejectForm,
  onRejectReasonChange,
  onReject,
  onCancelReject,
}: CorrectionEditorProps) {
  const hasReviewActions = canCorrect || canValidate || canReject;

  return (
    <section className={styles.editorPanel} aria-labelledby="correction-editor-title">
      <div className={styles.panelHeader}>
        <div>
          <p id="correction-editor-title" className={styles.sectionTitle}>
            Correccion profesional
          </p>
          <p className={styles.panelHint}>
            Usa la vista del documento original para corregir la transcripcion antes de validar.
          </p>
        </div>
      </div>

      {!hasOcr && (
        <div className={styles.emptyReviewState}>
          Todavia no hay texto reconocido. Ejecuta el procesamiento primero.
        </div>
      )}

      <textarea
        className={styles.correctionTextarea}
        value={correctedText}
        onChange={(event) => onCorrectedTextChange(event.target.value)}
        disabled={!canCorrect || isActing || !hasOcr}
        rows={22}
        aria-label="Texto corregido por profesional"
      />

      {hasReviewActions && (
        <div className={styles.primaryActions}>
          {canCorrect && (
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}
              type="button"
              onClick={onSaveCorrection}
              disabled={isActing || !hasOcr}
            >
              {isActing ? 'Guardando...' : 'Guardar correccion'}
            </button>
          )}

          {canValidate && (
            <button
              className={`${styles.btn} ${styles.btnSuccess} ${styles.btnLarge}`}
              type="button"
              onClick={onValidate}
              disabled={isActing || !hasOcr}
            >
              {isActing ? 'Validando...' : 'Validar version final'}
            </button>
          )}

          {canReject && (
            <button
              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSubtleDanger}`}
              type="button"
              onClick={onToggleRejectForm}
              disabled={isActing}
            >
              Rechazar digitalizacion
            </button>
          )}
        </div>
      )}

      {showRejectForm && (
        <div className={styles.rejectForm}>
          <textarea
            className={styles.rejectTextarea}
            placeholder="Motivo del rechazo (minimo 10 caracteres)..."
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            rows={3}
            aria-label="Motivo del rechazo"
          />
          <div className={`${styles.actions} ${styles.actionsCompact}`}>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              type="button"
              onClick={onReject}
              disabled={isActing || rejectReason.trim().length < 10}
            >
              {isActing ? 'Rechazando...' : 'Confirmar rechazo'}
            </button>
            <button className={styles.btn} type="button" onClick={onCancelReject}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className={`${styles.supportSection} ${styles.entitiesSection}`}>
        <p className={styles.sectionTitle}>Entidades detectadas/corregidas</p>
        <div className={styles.entityEditor}>
          {correctedEntities.map((entity, index) => (
            <div key={`${entity.type}-${index}`} className={styles.entityRow}>
              <select
                className={styles.entitySelect}
                value={entity.type}
                onChange={(event) =>
                  onEntityChange(index, { type: event.target.value as CorrectedEntity['type'] })
                }
                disabled={!canCorrect || isActing || !hasOcr}
                aria-label={`Tipo de entidad ${index + 1}`}
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                className={styles.entityInput}
                value={entity.value}
                onChange={(event) => onEntityChange(index, { value: event.target.value })}
                disabled={!canCorrect || isActing || !hasOcr}
                aria-label={`Valor de entidad ${index + 1}`}
              />
              <input
                className={styles.entityInput}
                value={entity.normalizedValue ?? ''}
                onChange={(event) => onEntityChange(index, { normalizedValue: event.target.value })}
                disabled={!canCorrect || isActing || !hasOcr}
                placeholder="Normalizado"
                aria-label={`Valor normalizado de entidad ${index + 1}`}
              />
              {canCorrect && (
                <button
                  className={styles.entityRemove}
                  type="button"
                  onClick={() => onEntityRemove(index)}
                  disabled={isActing || !hasOcr}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
          {correctedEntities.length === 0 && (
            <p className={styles.entityEmpty}>No hay entidades clinicas detectadas.</p>
          )}
        </div>
      </div>
    </section>
  );
}
