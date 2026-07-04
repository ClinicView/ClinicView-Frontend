'use client';

import { useMemo } from 'react';
import { Icon } from '@/shared/ui';
import {
  buildClinicalText,
  buildFieldsContent,
  parseClinicalSections,
  tryParseFields,
} from '../lib/clinical-sections';
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
 * clínica. Parsea el texto en secciones canónicas; los cambios se
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
  const parsed = useMemo(() => parseClinicalSections(text), [text]);

  if (!text.trim()) {
    return (
      <div className={styles.emptyState}>
        <Icon name="scan" size={26} />
        <p>Todavía no hay texto reconocido. Ejecuta el procesamiento primero.</p>
      </div>
    );
  }

  if (!parsed.isStructured) {
    return (
      <>
        <p className={styles.sectionEmptyHint} style={{ marginBottom: '0.625rem' }}>
          No se detectaron encabezados de sección — edición en texto libre.
        </p>
        <textarea
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
    const next = {
      ...parsed,
      sections: parsed.sections.map((section, i) =>
        i === index ? { ...section, content } : section,
      ),
    };
    onChange(buildClinicalText(next));
  }

  function updatePreamble(content: string) {
    onChange(buildClinicalText({ ...parsed, preamble: content }));
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
          <p className={styles.sectionHeading}>TEXTO SIN CLASIFICAR</p>
          <textarea
            className={styles.sectionTextarea}
            value={parsed.preamble}
            onChange={(event) => updatePreamble(event.target.value)}
            disabled={disabled}
            aria-label="Texto sin clasificar"
          />
        </div>
      )}

      {parsed.sections.map((section, index) => {
        const fields = tryParseFields(section.content);
        const sectionSugg = sectionSuggestions(section.content);

        return (
          <div key={`${section.key}-${index}`} className={styles.sectionBlock}>
            <p className={styles.sectionHeading}>{section.title}</p>

            {fields ? (
              <div className={styles.fieldGrid}>
                {fields.map((field, fieldIndex) => (
                  <div key={`${field.label}-${fieldIndex}`} className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{field.label}:</span>
                    <input
                      className={styles.fieldInput}
                      value={field.value}
                      onChange={(event) => {
                        const nextFields = fields.map((f, i) =>
                          i === fieldIndex ? { ...f, value: event.target.value } : f,
                        );
                        updateSection(index, buildFieldsContent(nextFields));
                      }}
                      disabled={disabled}
                      aria-label={`${section.title} — ${field.label}`}
                    />
                  </div>
                ))}
              </div>
            ) : section.content.trim() ? (
              <textarea
                className={styles.sectionTextarea}
                value={section.content}
                onChange={(event) => updateSection(index, event.target.value)}
                disabled={disabled}
                aria-label={`Contenido de ${section.title}`}
              />
            ) : (
              <textarea
                className={styles.sectionTextarea}
                value={section.content}
                onChange={(event) => updateSection(index, event.target.value)}
                disabled={disabled}
                placeholder="Sin contenido registrado en esta sección."
                aria-label={`Contenido de ${section.title}`}
              />
            )}

            {sectionSugg.length > 0 && (
              <div className={styles.suggestionRow}>
                {sectionSugg.map((item) => (
                  <span key={item.id} className={styles.suggestionBadge}>
                    <mark>{item.value}</mark>
                    Sugerencia OCR
                    <button
                      type="button"
                      className={styles.suggestionDismiss}
                      onClick={() => onDismissSuggestion(item.id)}
                      aria-label={`Descartar sugerencia ${item.value}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
