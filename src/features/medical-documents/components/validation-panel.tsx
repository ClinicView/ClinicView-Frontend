'use client';

import { useEffect, useRef } from 'react';
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
  const rejectTriggerRef = useRef<HTMLButtonElement>(null);
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null);
  const wasRejectOpenRef = useRef(false);

  useEffect(() => {
    if (showRejectForm) {
      rejectReasonRef.current?.focus();
    } else if (wasRejectOpenRef.current && canReject) {
      rejectTriggerRef.current?.focus();
    }
    wasRejectOpenRef.current = showRejectForm;
  }, [canReject, showRejectForm]);

  return (
    <div>
      <fieldset className={styles.checkList}>
        <legend className={styles.checkListLegend}>Comprobaciones obligatorias</legend>
        {VALIDATION_CHECKLIST.map((item) => {
          const isChecked = checked.has(item.id);
          const inputId = `validation-check-${item.id}`;
          const hintId = `${inputId}-hint`;
          return (
            <label
              htmlFor={inputId}
              key={item.id}
              className={`${styles.checkItem} ${isChecked ? styles.checkItemChecked : ''}`}
            >
              <input
                id={inputId}
                type="checkbox"
                className={styles.checkBox}
                checked={isChecked}
                onChange={() => onToggle(item.id)}
                disabled={!canValidate || isActing}
                aria-describedby={hintId}
              />
              <span className={styles.checkText}>
                <span className={styles.checkTitle}>{item.title}</span>
                <span id={hintId} className={styles.checkHint}>{item.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {canValidate && (
        <p id="validation-operation-hint" className={styles.atomicValidationHint}>
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
          aria-describedby={
            allChecked
              ? 'validation-operation-hint'
              : 'validation-operation-hint validation-checklist-help'
          }
        >
          {isActing ? 'Guardando y validando…' : 'Guardar y validar versión final'}
        </button>
      )}
      {!allChecked && canValidate && (
        <p id="validation-checklist-help" className={styles.checkHint} style={{ marginTop: '0.5rem' }}>
          Marca todos los puntos del checklist para habilitar la validación final.
        </p>
      )}

      {canReject && (
        <div className={styles.rejectZone} style={{ marginTop: '1.25rem' }}>
          <button
            ref={rejectTriggerRef}
            className={`${styles.btn} ${styles.btnDanger}`}
            type="button"
            onClick={onToggleRejectForm}
            disabled={isActing}
            aria-expanded={showRejectForm}
            aria-controls="document-reject-form"
          >
            {showRejectForm ? 'Ocultar formulario de rechazo' : 'Rechazar digitalización'}
          </button>
          {showRejectForm && (
            <form
              id="document-reject-form"
              className={styles.rejectForm}
              onSubmit={(event) => {
                event.preventDefault();
                onReject();
              }}
            >
              <label className={styles.editorFieldLabel} htmlFor="document-reject-reason">
                Motivo del rechazo
              </label>
              <textarea
                ref={rejectReasonRef}
                id="document-reject-reason"
                className={styles.rejectTextarea}
                placeholder="Motivo del rechazo (mínimo 10 caracteres)…"
                value={rejectReason}
                onChange={(event) => onRejectReasonChange(event.target.value)}
                minLength={10}
                required
                disabled={isActing}
                aria-describedby="document-reject-help"
              />
              <p id="document-reject-help" className={styles.rejectHelp}>
                Explica la causa con al menos 10 caracteres. {rejectReason.trim().length}/10.
              </p>
              <div className={styles.rejectActions}>
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  type="submit"
                  disabled={isActing || rejectReason.trim().length < 10}
                >
                  {isActing ? 'Rechazando…' : 'Confirmar rechazo'}
                </button>
                <button
                  className={styles.btn}
                  type="button"
                  onClick={onToggleRejectForm}
                  disabled={isActing}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {!canValidate && (
        <span className={styles.srOnly} role="status" aria-live="polite">
          {isActing ? 'Operación clínica en curso.' : ''}
        </span>
      )}
    </div>
  );
}
