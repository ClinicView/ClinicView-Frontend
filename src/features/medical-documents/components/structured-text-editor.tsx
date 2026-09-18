'use client';

import { useState } from 'react';
import { Icon } from '@/shared/ui';
import {
  createClinicalTextDraft,
  receiveClinicalText,
  updateClinicalField,
  updateClinicalPreamble,
  updateClinicalSection,
  type ClinicalTextDraft,
} from '../lib/clinical-text-draft';
import styles from './correction-view.module.css';

export interface OcrSuggestion {
  id: string;
  value: string;
}

interface StructuredTextEditorProps {
  text: string;
  disabled: boolean;
  suggestions: OcrSuggestion[];
  onChange: (text: string) => void;
  onDismissSuggestion: (id: string) => void;
}

/**
 * Editor del texto corregido estructurado por secciones de la historia
 * clínica. Conserva los títulos y el orden de la fuente; los cambios se
 * reconstruyen al texto plano para no romper el contrato con el backend.
 * Si el texto no tiene encabezados reconocibles, cae a un textarea libre.
 */
export function StructuredTextEditor({
  text,
  disabled,
  suggestions,
  onChange,
  onDismissSuggestion,
}: StructuredTextEditorProps) {
  const [storedDraft, setStoredDraft] = useState(() => createClinicalTextDraft(text));
  const draft = receiveClinicalText(storedDraft, text);
  if (draft !== storedDraft) setStoredDraft(draft);
  const parsed = draft.parsed;

  function publish(next: ClinicalTextDraft) {
    setStoredDraft(next);
    if (next.emittedText !== null) onChange(next.emittedText);
  }

  if (!text.trim()) {
    return (
      <div>
        <div className={styles.emptyState} role="status">
          <Icon name="scan" size={26} />
          <p>
            {disabled
              ? 'Todavía no hay texto disponible para corregir.'
              : 'El OCR no devolvió texto. Puedes realizar la transcripción manual.'}
          </p>
        </div>
        {!disabled && (
          <div className={styles.manualEntry}>
            <label className={styles.editorFieldLabel} htmlFor="manual-clinical-transcription">
              Transcripción clínica manual
            </label>
            <p id="manual-clinical-transcription-help" className={styles.sectionEmptyHint}>
              Contrasta el contenido con el documento original antes de guardarlo.
            </p>
            <textarea
              id="manual-clinical-transcription"
              className={styles.freeTextarea}
              value={text}
              onChange={(event) => onChange(event.target.value)}
              aria-describedby="manual-clinical-transcription-help"
            />
          </div>
        )}
      </div>
    );
  }

  if (!parsed.isStructured) {
    return (
      <>
        <p className={styles.sectionEmptyHint} style={{ marginBottom: '0.625rem' }}>
          No se detectaron encabezados de sección — edición en texto libre.
        </p>
        <label className={styles.editorFieldLabel} htmlFor="free-clinical-text">
          Texto clínico corregido
        </label>
        <textarea
          id="free-clinical-text"
          className={styles.freeTextarea}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label="Texto corregido por profesional"
        />
      </>
    );
  }

  function updateSection(index: number, content: string) {
    publish(updateClinicalSection(draft, index, content));
  }

  function updatePreamble(content: string) {
    publish(updateClinicalPreamble(draft, content));
  }

  function sectionSuggestions(content: string): OcrSuggestion[] {
    if (!content) return [];
    const lower = content.toLowerCase();
    return suggestions.filter((item) => lower.includes(item.value.toLowerCase()));
  }

  return (
    <div>
      {parsed.preamble.trim() && (
        <div className={styles.sectionBlock}>
          <label className={styles.sectionHeading} htmlFor="clinical-preamble">
            TEXTO SIN CLASIFICAR
          </label>
          <textarea
            id="clinical-preamble"
            className={styles.sectionTextarea}
            value={parsed.preamble}
            onChange={(event) => updatePreamble(event.target.value)}
            disabled={disabled}
            aria-label="Texto sin clasificar"
          />
        </div>
      )}

      {parsed.sections.map((section, index) => {
        // Keep control identity stable while typing. Reparse only external text,
        // not every colon/newline emitted by this editor itself.
        const fields = draft.fields[index];
        const sectionSugg = sectionSuggestions(section.content);

        return (
          <div key={`${section.key}-${index}`} className={styles.sectionBlock}>
            {!fields && (
              <label className={styles.sectionHeading} htmlFor={`clinical-section-${index}`}>
                {section.title}
              </label>
            )}

            {fields && <h3 className={styles.sectionHeading}>{section.title}</h3>}

            {fields ? (
              <div className={styles.fieldGrid}>
                {fields.map((field, fieldIndex) => {
                  const fieldId = `clinical-section-${index}-field-${fieldIndex}`;
                  return (
                  <div key={`${field.label}-${fieldIndex}`} className={styles.fieldRow}>
                    <label className={styles.fieldLabel} htmlFor={fieldId}>{field.label}:</label>
                    <input
                      id={fieldId}
                      className={styles.fieldInput}
                      value={field.value}
                      onChange={(event) => {
                        publish(updateClinicalField(draft, index, fieldIndex, event.target.value));
                      }}
                      disabled={disabled}
                      aria-label={`${section.title} — ${field.label}`}
                    />
                  </div>
                  );
                })}
              </div>
            ) : section.content.trim() ? (
              <textarea
                id={`clinical-section-${index}`}
                className={styles.sectionTextarea}
                value={section.content}
                onChange={(event) => updateSection(index, event.target.value)}
                disabled={disabled}
                aria-label={`Contenido de ${section.title}`}
              />
            ) : (
              <textarea
                id={`clinical-section-${index}`}
                className={styles.sectionTextarea}
                value={section.content}
                onChange={(event) => updateSection(index, event.target.value)}
                disabled={disabled}
                placeholder="Sin contenido registrado en esta sección."
                aria-label={`Contenido de ${section.title}`}
              />
            )}

            {sectionSugg.length > 0 && (
              <ul
                className={styles.suggestionRow}
                aria-label={`Sugerencias OCR para ${section.title}`}
              >
                {sectionSugg.map((item) => (
                  <li key={item.id} className={styles.suggestionBadge}>
                    <mark>{item.value}</mark>
                    Sugerencia OCR
                    <button
                      type="button"
                      className={styles.suggestionDismiss}
                      onClick={() => onDismissSuggestion(item.id)}
                      aria-label={`Descartar sugerencia ${item.value}`}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
