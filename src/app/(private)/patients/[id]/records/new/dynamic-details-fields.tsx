'use client';

import {
  getRecordTypeDefinition,
  type RecordFieldDefinition,
} from '@/features/clinical-records/lib/record-type-definitions';
import type { RecordDetails, RecordType } from '@/features/clinical-records/types/record';
import { currentDateTimeLocal } from '@/shared/lib/date-time';
import { Icon } from '@/shared/ui';
import {
  createEmptyRepeatableItem,
  detailFieldId,
  getValueAtPath,
  repeatedFieldId,
  setValueAtPath,
  type RecordFormError,
} from './record-form-model';
import styles from './manual-record.module.css';

interface DynamicDetailsFieldsProps {
  recordType: RecordType;
  details: RecordDetails;
  errors: ReadonlyMap<string, RecordFormError>;
  disabled: boolean;
  onChange: (details: RecordDetails) => void;
}

function describedBy(...ids: Array<string | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

export function DynamicDetailsFields({
  recordType,
  details,
  errors,
  disabled,
  onChange,
}: DynamicDetailsFieldsProps) {
  const definition = getRecordTypeDefinition(recordType);

  function updateValue(path: string, value: unknown) {
    onChange(setValueAtPath(details, path, value) as RecordDetails);
  }

  function renderScalar(field: RecordFieldDefinition) {
    const id = detailFieldId(recordType, field.key);
    const error = errors.get(id);
    const descriptionId = field.description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const rawValue = getValueAtPath(details, field.key);
    const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const commonProps = {
      id,
      name: id,
      className: field.kind === 'textarea' ? styles.textarea : styles.input,
      value,
      disabled,
      required: field.required,
      'aria-invalid': Boolean(error),
      'aria-describedby': describedBy(descriptionId, errorId),
      autoComplete: 'off',
    };

    return (
      <div
        key={field.key}
        className={`${styles.field} ${
          field.kind === 'textarea' ? styles.detailFieldWide : ''
        }`}
      >
        <label className={styles.label} htmlFor={id}>
          {field.label}
          {field.required && <span className={styles.required} aria-hidden="true"> *</span>}
        </label>
        {field.description && (
          <p id={descriptionId} className={styles.fieldHint}>{field.description}</p>
        )}
        {field.kind === 'textarea' ? (
          <textarea
            {...commonProps}
            rows={4}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(event) => updateValue(field.key, event.target.value)}
          />
        ) : field.kind === 'select' ? (
          <select
            {...commonProps}
            className={styles.select}
            onChange={(event) => updateValue(field.key, event.target.value)}
          >
            <option value="">Seleccionar…</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            {...commonProps}
            type={field.kind === 'text' ? 'text' : field.kind}
            min={field.min}
            max={field.kind === 'datetime-local' && field.pastOrPresent
              ? currentDateTimeLocal()
              : field.max}
            step={field.step}
            inputMode={field.inputMode}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(event) => {
              if (field.kind === 'number') {
                updateValue(field.key, event.target.value === '' ? undefined : event.target.valueAsNumber);
              } else {
                updateValue(field.key, event.target.value);
              }
            }}
          />
        )}
        {error && <p id={errorId} className={styles.fieldError}>{error.message}</p>}
      </div>
    );
  }

  function renderRepeatable(field: RecordFieldDefinition) {
    const rootId = detailFieldId(recordType, field.key);
    const rootError = errors.get(rootId);
    const rowsValue = getValueAtPath(details, field.key);
    const rows = Array.isArray(rowsValue) ? rowsValue as Array<Record<string, unknown>> : [];

    function replaceRows(nextRows: Array<Record<string, unknown>>) {
      updateValue(field.key, nextRows);
    }

    return (
      <fieldset
        id={rootId}
        key={field.key}
        className={`${styles.repeatable} ${styles.detailFieldWide}`}
        aria-describedby={rootError ? `${rootId}-error` : undefined}
      >
        <legend className={styles.repeatableLegend}>
          {field.label}
          {field.required && <span className={styles.required} aria-hidden="true"> *</span>}
        </legend>
        {rootError && <p id={`${rootId}-error`} className={styles.fieldError}>{rootError.message}</p>}

        {rows.length === 0 && (
          <p className={styles.repeatableEmpty}>Aún no agregaste elementos.</p>
        )}

        <div className={styles.repeatableList}>
          {rows.map((row, index) => (
            <fieldset key={`${field.key}-${index}`} className={styles.repeatableItem}>
              <legend>{field.itemLabel ?? 'Elemento'} {index + 1}</legend>
              <div className={styles.repeatableItemHeader}>
                <span className={styles.fieldHint}>Completa los datos registrados.</span>
                <button
                  className={styles.iconTextButton}
                  type="button"
                  onClick={() => replaceRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                  disabled={disabled}
                  aria-label={`Eliminar ${field.itemLabel?.toLowerCase() ?? 'elemento'} ${index + 1}`}
                >
                  <Icon name="close" size={16} />
                  <span>Eliminar</span>
                </button>
              </div>
              <div className={styles.repeatableGrid}>
                {field.columns?.map((column) => {
                  const id = repeatedFieldId(recordType, field.key, index, column.key);
                  const error = errors.get(id);
                  const errorId = error ? `${id}-error` : undefined;
                  const cellValue = row[column.key];
                  const stringValue = cellValue === undefined || cellValue === null
                    ? ''
                    : String(cellValue);
                  return (
                    <div key={column.key} className={styles.field}>
                      <label className={styles.label} htmlFor={id}>
                        {column.label}
                        {column.required && <span className={styles.required} aria-hidden="true"> *</span>}
                      </label>
                      {column.kind === 'select' ? (
                        <select
                          id={id}
                          name={id}
                          className={styles.select}
                          value={stringValue}
                          disabled={disabled}
                          required={column.required}
                          aria-invalid={Boolean(error)}
                          aria-describedby={errorId}
                          onChange={(event) => {
                            const nextRows = rows.map((entry, rowIndex) => rowIndex === index
                              ? { ...entry, [column.key]: event.target.value }
                              : entry);
                            replaceRows(nextRows);
                          }}
                        >
                          <option value="">Seleccionar…</option>
                          {column.options?.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          name={id}
                          className={styles.input}
                          type={column.kind === 'number' ? 'number' : 'text'}
                          inputMode={column.inputMode}
                          value={stringValue}
                          placeholder={column.placeholder}
                          maxLength={column.maxLength}
                          disabled={disabled}
                          required={column.required}
                          aria-invalid={Boolean(error)}
                          aria-describedby={errorId}
                          autoComplete="off"
                          onChange={(event) => {
                            const nextRows = rows.map((entry, rowIndex) => rowIndex === index
                              ? { ...entry, [column.key]: event.target.value }
                              : entry);
                            replaceRows(nextRows);
                          }}
                        />
                      )}
                      {error && <p id={errorId} className={styles.fieldError}>{error.message}</p>}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <button
          className={styles.addButton}
          type="button"
          disabled={disabled || Boolean(field.maxItems && rows.length >= field.maxItems)}
          onClick={() => replaceRows([...rows, createEmptyRepeatableItem(field.key)])}
        >
          <span aria-hidden="true">+</span>
          {field.addLabel ?? 'Agregar elemento'}
        </button>
      </fieldset>
    );
  }

  return (
    <div className={styles.detailsRoot}>
      <div className={styles.templateIntro}>
        <span className={styles.templateIcon} aria-hidden="true"><Icon name="records" size={19} /></span>
        <div>
          <h3>{definition.label}</h3>
          <p>{definition.description}</p>
        </div>
      </div>
      {definition.sections.map((section) => (
        <section key={section.id} className={styles.detailSection} aria-labelledby={`${section.id}-title`}>
          <div className={styles.sectionHeading}>
            <h3 id={`${section.id}-title`}>{section.title}</h3>
            {section.description && <p>{section.description}</p>}
          </div>
          <div className={styles.detailsGrid}>
            {section.fields.map((field) => field.kind === 'repeatable'
              ? renderRepeatable(field)
              : renderScalar(field))}
          </div>
        </section>
      ))}
    </div>
  );
}
