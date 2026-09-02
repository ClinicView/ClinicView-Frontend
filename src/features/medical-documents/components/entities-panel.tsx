'use client';

import type { CorrectedEntity, NerEntity } from '../types/document';
import styles from './correction-view.module.css';

const ENTITY_TYPES: NerEntity['type'][] = [
  'DIAGNOSIS',
  'SYMPTOM',
  'MEDICATION',
  'PROCEDURE',
  'CLINICAL_DATE',
  'OBSERVATION',
];

const TYPE_LABEL: Record<NerEntity['type'], string> = {
  DIAGNOSIS: 'Diagnóstico',
  SYMPTOM: 'Síntoma',
  MEDICATION: 'Medicamento',
  PROCEDURE: 'Procedimiento',
  CLINICAL_DATE: 'Fecha clínica',
  OBSERVATION: 'Observación',
};

function confidenceClass(confidence: number): string {
  if (confidence >= 0.8) return styles.conf_high;
  if (confidence >= 0.5) return styles.conf_mid;
  return styles.conf_low;
}

interface EntitiesPanelProps {
  detected: NerEntity[] | null;
  corrected: CorrectedEntity[];
  editable: boolean;
  isActing: boolean;
  onEntityChange: (index: number, patch: Partial<CorrectedEntity>) => void;
  onEntityRemove: (index: number) => void;
}

export function EntitiesPanel({
  detected,
  corrected,
  editable,
  isActing,
  onEntityChange,
  onEntityRemove,
}: EntitiesPanelProps) {
  return (
    <section aria-labelledby="corrected-entities-title">
      {detected && detected.length > 0 && (
        <>
          <h3 className={styles.entityEditorTitle}>
            Entidades detectadas por el motor IA ({detected.length})
          </h3>
          <ul className={styles.entityGrid}>
            {detected.map((entity, index) => (
              <li key={`${entity.type}-${index}`} className={styles.entityCard}>
                <span className={styles.entityType}>
                  {TYPE_LABEL[entity.type]}
                  <span
                    className={`${styles.entityConfidence} ${confidenceClass(entity.confidence)}`}
                    aria-label={`Confianza ${Math.round(entity.confidence * 100)} por ciento`}
                  >
                    {Math.round(entity.confidence * 100)}%
                  </span>
                </span>
                <span className={styles.entityValue}>{entity.value}</span>
                {entity.normalizedValue && entity.normalizedValue !== entity.value && (
                  <span className={styles.entityEmpty}>
                    <span aria-hidden="true">→ </span>
                    <span className={styles.srOnly}>Valor normalizado: </span>
                    {entity.normalizedValue}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 id="corrected-entities-title" className={styles.entityEditorTitle}>
        Entidades corregidas (versión final)
      </h3>
      {corrected.map((entity, index) => (
        <fieldset key={`corrected-${index}`} className={styles.entityRow}>
          <legend className={styles.entityLegend}>Entidad {index + 1}</legend>
          <label className={styles.entityField}>
            <span className={styles.entityFieldLabel}>Tipo</span>
            <select
              className={styles.entitySelect}
              value={entity.type}
              onChange={(event) =>
                onEntityChange(index, { type: event.target.value as CorrectedEntity['type'] })
              }
              disabled={!editable || isActing}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>{TYPE_LABEL[type]}</option>
              ))}
            </select>
          </label>
          <label className={styles.entityField}>
            <span className={styles.entityFieldLabel}>Valor detectado</span>
            <input
              className={styles.entityInput}
              value={entity.value}
              onChange={(event) => onEntityChange(index, { value: event.target.value })}
              disabled={!editable || isActing}
            />
          </label>
          <label className={styles.entityField}>
            <span className={styles.entityFieldLabel}>Valor normalizado</span>
            <input
              className={styles.entityInput}
              value={entity.normalizedValue ?? ''}
              onChange={(event) => onEntityChange(index, { normalizedValue: event.target.value })}
              disabled={!editable || isActing}
            />
          </label>
          {editable && (
            <button
              className={styles.entityRemove}
              type="button"
              onClick={() => onEntityRemove(index)}
              disabled={isActing}
            >
              Quitar
            </button>
          )}
        </fieldset>
      ))}
      {corrected.length === 0 && (
        <p className={styles.entityEmpty}>No hay entidades clínicas registradas.</p>
      )}
    </section>
  );
}
