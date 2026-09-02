'use client';

import type { ValidationChecklistId } from '../types/document';
import styles from './correction-view.module.css';

export interface ChecklistItem {
  id: ValidationChecklistId;
  title: string;
  hint: string;
}

export const VALIDATION_CHECKLIST: ChecklistItem[] = [
  {
    id: 'text',
    title: 'Texto corregido y revisado',
    hint: 'Todas las secciones fueron contrastadas con el documento original.',
  },
  {
    id: 'entities',
    title: 'Entidades clínicas verificadas',
    hint: 'Diagnósticos, medicamentos y fechas coinciden con la historia.',
  },
  {
    id: 'sections',
    title: 'Secciones completas',
    hint: 'Identificación, antecedentes, anamnesis y examen físico registrados.',
  },
  {
    id: 'phi',
    title: 'Datos del paciente correctos',
    hint: 'La identificación corresponde al paciente de la ficha.',
  },
];

interface ValidationPanelProps {
  checked: Set<ValidationChecklistId>;
  canValidate: boolean;
  canReject: boolean;
  isActing: boolean;
  hasUnsavedChanges: boolean;
  showRejectForm: boolean;
  rejectReason: string;
  onToggle: (id: ValidationChecklistId) => void;
  onValidate: () => void;
  onToggleRejectForm: () => void;
  onRejectReasonChange: (value: string) => void;
  onReject: () => void;
}

export function ValidationPanel({
  checked,
  canValidate,
  canReject,
  isActing,
  hasUnsavedChanges,
  showRejectForm,
  rejectReason,
  onToggle,
  onValidate,
  onToggleRejectForm,
  onRejectReasonChange,
  onReject,
}: ValidationPanelProps) {
  const allChecked = VALIDATION_CHECKLIST.every((item) => checked.has(item.id));

  return (
    <div>
      <div className={styles.checkList}>
        {VALIDATION_CHECKLIST.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <label
              key={item.id}
              className={`${styles.checkItem} ${isChecked ? styles.checkItemChecked : ''}`}
            >
              <input
                type="checkbox"
                className={styles.checkBox}
                checked={isChecked}
                onChange={() => onToggle(item.id)}
                disabled={!canValidate || isActing}
              />
              <span className={styles.checkText}>
                <span className={styles.checkTitle}>{item.title}</span>
                <span className={styles.checkHint}>{item.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {canValidate && (
        <p className={styles.atomicValidationHint}>
          {hasUnsavedChanges
            ? 'Tus cambios actuales se guardarán junto con la validación en una sola operación.'
            : 'Se validará exactamente la versión guardada que estás revisando.'}
        </p>
      )}

      {canValidate && (
        <button
          className={`${styles.btn} ${styles.btnSuccess}`}
          type="button"
          onClick={onValidate}
          disabled={isActing || !allChecked}
          title={allChecked ? undefined : 'Completa el checklist para validar'}
        >
          {isActing ? 'Guardando y validando…' : 'Guardar y validar versión final'}
        </button>
      )}
      {!allChecked && canValidate && (
        <p className={styles.checkHint} style={{ marginTop: '0.5rem' }}>
          Marca todos los puntos del checklist para habilitar la validación final.
        </p>
      )}

      {canReject && (
        <div className={styles.rejectZone} style={{ marginTop: '1.25rem' }}>
          {!showRejectForm ? (
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              type="button"
              onClick={onToggleRejectForm}
              disabled={isActing}
            >
              Rechazar digitalización
            </button>
          ) : (
            <>
              <textarea
                className={styles.rejectTextarea}
                placeholder="Motivo del rechazo (mínimo 10 caracteres)…"
                value={rejectReason}
                onChange={(event) => onRejectReasonChange(event.target.value)}
                aria-label="Motivo del rechazo"
              />
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  type="button"
                  onClick={onReject}
                  disabled={isActing || rejectReason.trim().length < 10}
                >
                  {isActing ? 'Rechazando…' : 'Confirmar rechazo'}
                </button>
                <button className={styles.btn} type="button" onClick={onToggleRejectForm}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
