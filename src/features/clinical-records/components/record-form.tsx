'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DynamicDetailsFields } from '@/app/(private)/patients/[id]/records/new/dynamic-details-fields';
import { HelpDialog } from '@/app/(private)/patients/[id]/records/new/record-form-dialogs';
import {
  COMMON_FIELD_IDS,
  createCorrectionEditorState,
  recordEditorFingerprint,
  toCorrectRecordData,
  validateEditorState,
  type RecordEditorState,
  type RecordFormError,
} from '@/app/(private)/patients/[id]/records/new/record-form-model';
import { currentDateTimeLocal } from '@/shared/lib/date-time';
import { searchProfessionals, type Professional } from '@/shared/services/professionals.service';
import { Icon, type IconName } from '@/shared/ui';
import { useRecordMedia } from '../hooks/use-record-media';
import { getRecordTypeDefinition } from '../lib/record-type-definitions';
import type {
  ClinicalRecord,
  CorrectRecordData,
  RecordDetails,
  RecordPriority,
} from '../types/record';
import type { RecordAttachmentFormReference } from '@/app/(private)/patients/[id]/records/new/record-form-model';
import { RecordMediaUploader } from './record-media-uploader';
import styles from '@/app/(private)/patients/[id]/records/new/manual-record.module.css';

const SERVICES = [
  'Medicina General',
  'Medicina Interna',
  'Cardiología',
  'Pediatría',
  'Ginecología y Obstetricia',
  'Traumatología',
  'Neurología',
  'Dermatología',
  'Psiquiatría',
  'Otro',
];

const PRIORITIES: Array<{ value: RecordPriority; label: string; icon: IconName }> = [
  { value: 'URGENT', label: 'Urgente', icon: 'alert' },
  { value: 'PRIORITY', label: 'Prioritario', icon: 'clock' },
  { value: 'NORMAL', label: 'Normal', icon: 'check' },
  { value: 'ELECTIVE', label: 'Electivo', icon: 'calendar' },
];

interface CorrectRecordFormProps {
  mode: 'correct';
  original: ClinicalRecord;
  onSubmit: (data: CorrectRecordData) => Promise<void>;
  onCancel: () => void;
  onReloadConflict: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isConflict: boolean;
}

function errorMap(errors: RecordFormError[]): Map<string, RecordFormError> {
  return new Map(errors.map((error) => [error.id, error]));
}

function errorDescription(errors: ReadonlyMap<string, RecordFormError>, id: string): string | undefined {
  return errors.has(id) ? `${id}-error` : undefined;
}

export function RecordForm(props: CorrectRecordFormProps) {
  const [form, setForm] = useState<RecordEditorState>(() => createCorrectionEditorState(props.original));
  const initialFingerprintRef = useRef(recordEditorFingerprint(form));
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<RecordFormError[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const [doctorOptions, setDoctorOptions] = useState<Professional[]>([]);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [isDoctorSearching, setIsDoctorSearching] = useState(false);
  const [activeDoctorIndex, setActiveDoctorIndex] = useState(-1);
  const doctorSearchRef = useRef<number | null>(null);
  const doctorWrapRef = useRef<HTMLDivElement>(null);

  const errorsById = useMemo(() => errorMap(validationErrors), [validationErrors]);
  const definition = getRecordTypeDefinition(props.original.recordType);
  const isDirty = recordEditorFingerprint(form) !== initialFingerprintRef.current;
  const media = useRecordMedia({
    patientId: props.original.patientId,
    attachments: form.attachments,
    onAttachmentsChange: updateAttachments,
    initialAssets: (props.original.attachments ?? []).map(({ asset }) => asset),
  });

  useEffect(() => {
    if (!submitted) return;
    const errors = validateEditorState(form, { mode: 'correct' });
    if (media.submissionBlockingMessage) {
      errors.push({
        id: COMMON_FIELD_IDS.attachments,
        label: 'Adjuntos',
        message: media.submissionBlockingMessage,
      });
    }
    setValidationErrors(errors);
  }, [form, media.submissionBlockingMessage, submitted]);

  useEffect(() => {
    if (!props.error) return;
    window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
  }, [props.error]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (doctorWrapRef.current && !doctorWrapRef.current.contains(event.target as Node)) {
        setDoctorOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => () => {
    if (doctorSearchRef.current) window.clearTimeout(doctorSearchRef.current);
  }, []);

  useEffect(() => {
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      if (!isDirty && !media.hasPendingUploads && !media.isRemoving) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [isDirty, media.hasPendingUploads, media.isRemoving]);

  function updateCommon(patch: Partial<Omit<RecordEditorState, 'detailsByType' | 'attachments'>>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateDetails(details: RecordDetails) {
    setForm((current) => ({
      ...current,
      detailsByType: {
        ...current.detailsByType,
        [props.original.recordType]: details,
      },
    }));
  }

  function updateAttachments(attachments: RecordAttachmentFormReference[]) {
    setForm((current) => ({ ...current, attachments }));
  }

  function searchDoctors(query: string) {
    if (doctorSearchRef.current) window.clearTimeout(doctorSearchRef.current);
    const normalized = query.trim();
    if (normalized.length < 2) {
      setDoctorOptions([]);
      setDoctorOpen(false);
      setIsDoctorSearching(false);
      return;
    }
    setIsDoctorSearching(true);
    doctorSearchRef.current = window.setTimeout(async () => {
      try {
        const results = await searchProfessionals(normalized);
        setDoctorOptions(results);
        setActiveDoctorIndex(-1);
        setDoctorOpen(true);
      } catch {
        setDoctorOptions([]);
        setDoctorOpen(true);
      } finally {
        setIsDoctorSearching(false);
      }
    }, 300);
  }

  function selectDoctor(professional: Professional) {
    updateCommon({ professionalId: professional.id, doctorName: professional.fullName });
    setDoctorOpen(false);
    setActiveDoctorIndex(-1);
  }

  function handleDoctorKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && doctorOpen) {
      event.preventDefault();
      setDoctorOpen(false);
      setActiveDoctorIndex(-1);
      return;
    }
    if (!doctorOpen || doctorOptions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveDoctorIndex((current) => {
        const start = current < 0 ? (direction > 0 ? -1 : 0) : current;
        return (start + direction + doctorOptions.length) % doctorOptions.length;
      });
    } else if (event.key === 'Enter' && activeDoctorIndex >= 0) {
      event.preventDefault();
      const selected = doctorOptions[activeDoctorIndex];
      if (selected) selectDoctor(selected);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const errors = validateEditorState(form, { mode: 'correct' });
    if (media.submissionBlockingMessage) {
      errors.push({
        id: COMMON_FIELD_IDS.attachments,
        label: 'Adjuntos',
        message: media.submissionBlockingMessage,
      });
    }
    setValidationErrors(errors);
    if (errors.length > 0) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    const payload = toCorrectRecordData(form, props.original);
    if (!payload) return;
    await props.onSubmit(payload);
  }

  async function handleCancel() {
    if (media.hasPendingUploads || media.isRemoving) return;
    if (isDirty && !window.confirm('Hay cambios sin guardar. ¿Deseas salir de la corrección?')) return;
    setIsCancelling(true);
    try {
      await media.cleanupTemporaryAssets(form.attachments);
      props.onCancel();
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleReloadConflict() {
    if (!window.confirm(
      'Recargar reemplazará lo escrito con la versión más reciente del servidor. ¿Deseas continuar?',
    )) return;
    setIsReloading(true);
    try {
      await media.cleanupTemporaryAssets(form.attachments);
      await props.onReloadConflict();
    } finally {
      setIsReloading(false);
    }
  }

  const disabled = props.isLoading || isReloading || isCancelling;

  return (
    <>
      <form
        className={styles.formCard}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        aria-busy={props.isLoading || isReloading || isCancelling}
      >
        <header className={styles.correctionHeader}>
          <div>
            <span className={styles.eyebrow}>Corrección versionada</span>
            <h1>Corregir registro clínico</h1>
            <p>
              El registro original se conservará y esta corrección generará una nueva versión activa.
            </p>
          </div>
          <button
            className={`${styles.headerButton} ${styles.helpButton}`}
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-haspopup="dialog"
            aria-controls="record-help-dialog"
          >
            <Icon name="info" size={18} /> Ayuda
          </button>
        </header>

        {(props.error || validationErrors.length > 0) && (
          <div
            ref={errorSummaryRef}
            className={styles.errorSummary}
            role="alert"
            tabIndex={-1}
            aria-labelledby="record-correction-errors-title"
          >
            <h2 id="record-correction-errors-title">
              {props.error ? 'No se pudo guardar la corrección' : 'Revisa los campos indicados'}
            </h2>
            {props.error && <p>{props.error}</p>}
            {props.isConflict && (
              <div className={styles.conflictRecovery}>
                <p>Tus cambios siguen en pantalla. Recarga solo cuando decidas reemplazarlos.</p>
                <button type="button" onClick={() => void handleReloadConflict()} disabled={disabled}>
                  {isReloading ? 'Recargando…' : 'Recargar versión reciente'}
                </button>
              </div>
            )}
            {validationErrors.length > 0 && (
              <ul>
                {validationErrors.map((error) => (
                  <li key={error.id}>
                    <a href={`#${error.id}`}>{error.label}: {error.message}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.correctionNotice}>
          <Icon name="shield" size={19} />
          <div>
            <strong>{definition.label} · plantilla clínica estructurada</strong>
            <p>El tipo de registro permanece fijo para evitar reinterpretar el documento original.</p>
          </div>
        </div>

        <section className={styles.formSection} aria-labelledby="correction-common-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionStep}>1</span>
            <div>
              <h2 id="correction-common-title">Datos de la atención</h2>
              <p>Actualiza la información común que debe quedar en la versión corregida.</p>
            </div>
          </div>

          <div className={styles.commonGrid}>
            <div className={styles.field}>
              <span className={styles.label}>Tipo de registro</span>
              <div className={styles.readOnlyField}>
                <Icon name="records" size={16} /> {definition.label}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.attendedAt}>
                Fecha y hora de atención <span className={styles.required} aria-hidden="true">*</span>
              </label>
              <input
                id={COMMON_FIELD_IDS.attendedAt}
                className={styles.input}
                type="datetime-local"
                value={form.attendedAt}
                max={currentDateTimeLocal()}
                onChange={(event) => updateCommon({ attendedAt: event.target.value })}
                disabled={disabled}
                required
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.attendedAt)}
                aria-describedby={`correction-attendedAt-hint${errorsById.has(COMMON_FIELD_IDS.attendedAt) ? ` ${COMMON_FIELD_IDS.attendedAt}-error` : ''}`}
              />
              <p id="correction-attendedAt-hint" className={styles.fieldHint}>
                Si no cambias este valor, se conservará la hora exacta del registro original.
              </p>
              {errorsById.get(COMMON_FIELD_IDS.attendedAt) && (
                <p id={`${COMMON_FIELD_IDS.attendedAt}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.attendedAt)?.message}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.service}>Servicio o especialidad</label>
              <input
                id={COMMON_FIELD_IDS.service}
                className={styles.input}
                list="record-correction-services"
                value={form.service}
                maxLength={120}
                onChange={(event) => updateCommon({ service: event.target.value })}
                disabled={disabled}
                autoComplete="off"
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.service)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.service)}
              />
              <datalist id="record-correction-services">
                {SERVICES.map((service) => <option key={service} value={service} />)}
              </datalist>
              {errorsById.get(COMMON_FIELD_IDS.service) && (
                <p id={`${COMMON_FIELD_IDS.service}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.service)?.message}
                </p>
              )}
            </div>

            <div className={`${styles.field} ${styles.professionalField}`} ref={doctorWrapRef}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.doctorName}>
                Médico o profesional
              </label>
              <div className={styles.combobox}>
                <span className={styles.inputIcon} aria-hidden="true"><Icon name="search" size={16} /></span>
                <input
                  id={COMMON_FIELD_IDS.doctorName}
                  className={styles.input}
                  value={form.doctorName}
                  placeholder="Buscar o conservar el nombre histórico"
                  maxLength={120}
                  disabled={disabled}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={doctorOpen}
                  aria-controls="record-correction-professional-options"
                  aria-activedescendant={activeDoctorIndex >= 0
                    ? `record-correction-professional-${doctorOptions[activeDoctorIndex]?.id}`
                    : undefined}
                  aria-invalid={errorsById.has(COMMON_FIELD_IDS.doctorName)}
                  aria-describedby={[
                    'record-correction-professional-hint',
                    errorDescription(errorsById, COMMON_FIELD_IDS.doctorName) ?? '',
                  ].filter(Boolean).join(' ')}
                  onChange={(event) => {
                    updateCommon({ doctorName: event.target.value, professionalId: '' });
                    searchDoctors(event.target.value);
                  }}
                  onKeyDown={handleDoctorKeyDown}
                />
                {isDoctorSearching && <span className={styles.comboProgress} role="status">Buscando…</span>}
                {doctorOpen && (
                  <div className={styles.comboPopover}>
                    {doctorOptions.length > 0 ? (
                      <ul
                        id="record-correction-professional-options"
                        className={styles.comboList}
                        role="listbox"
                        aria-label="Profesionales encontrados"
                      >
                        {doctorOptions.map((professional, index) => (
                          <li key={professional.id}>
                            <button
                              id={`record-correction-professional-${professional.id}`}
                              className={styles.comboOption}
                              type="button"
                              role="option"
                              aria-selected={activeDoctorIndex === index || form.professionalId === professional.id}
                              onMouseEnter={() => setActiveDoctorIndex(index)}
                              onClick={() => selectDoctor(professional)}
                            >
                              <strong>{professional.fullName}</strong>
                              <span>{professional.profession ?? 'Profesional de salud'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p id="record-correction-professional-options" className={styles.comboEmpty}>
                        Sin coincidencias. El nombre puede conservarse como texto histórico.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p id="record-correction-professional-hint" className={styles.fieldHint}>
                {form.professionalId
                  ? 'Profesional vinculado al directorio actual.'
                  : 'Nombre histórico sin vínculo al directorio actual.'}
              </p>
              {errorsById.get(COMMON_FIELD_IDS.doctorName) && (
                <p id={`${COMMON_FIELD_IDS.doctorName}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.doctorName)?.message}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.professionalLicense}>Colegiatura o registro profesional</label>
              <input
                id={COMMON_FIELD_IDS.professionalLicense}
                className={styles.input}
                value={form.professionalLicense}
                maxLength={80}
                placeholder="Ej. CMP 12345"
                onChange={(event) => updateCommon({ professionalLicense: event.target.value })}
                disabled={disabled}
                autoComplete="off"
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.professionalLicense)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.professionalLicense)}
              />
              {errorsById.get(COMMON_FIELD_IDS.professionalLicense) && (
                <p id={`${COMMON_FIELD_IDS.professionalLicense}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.professionalLicense)?.message}
                </p>
              )}
            </div>

            <fieldset className={`${styles.field} ${styles.priorityFieldset}`} id={COMMON_FIELD_IDS.priority}>
              <legend className={styles.label}>Prioridad</legend>
              <div className={styles.chips} role="radiogroup" aria-label="Prioridad de la corrección">
                {PRIORITIES.map((priority, index) => (
                  <button
                    key={priority.value}
                    className={`${styles.chip} ${styles[`chip_${priority.value}`]} ${form.priority === priority.value ? styles.chipActive : ''}`}
                    type="button"
                    role="radio"
                    aria-checked={form.priority === priority.value}
                    tabIndex={form.priority === priority.value ? 0 : -1}
                    disabled={disabled}
                    onClick={() => updateCommon({ priority: priority.value })}
                    onKeyDown={(event) => {
                      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                      event.preventDefault();
                      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                      const nextIndex = (index + direction + PRIORITIES.length) % PRIORITIES.length;
                      const next = PRIORITIES[nextIndex];
                      if (!next) return;
                      updateCommon({ priority: next.value });
                      event.currentTarget.parentElement
                        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]
                        ?.focus();
                    }}
                  >
                    <Icon name={priority.icon} size={15} /> {priority.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.summary}>
                Resumen clínico <span className={styles.required} aria-hidden="true">*</span>
              </label>
              <textarea
                id={COMMON_FIELD_IDS.summary}
                className={styles.textarea}
                rows={4}
                value={form.summary}
                maxLength={2000}
                onChange={(event) => updateCommon({ summary: event.target.value })}
                disabled={disabled}
                required
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.summary)}
                aria-describedby={`record-correction-summary-counter${errorsById.has(COMMON_FIELD_IDS.summary) ? ` ${COMMON_FIELD_IDS.summary}-error` : ''}`}
              />
              {errorsById.get(COMMON_FIELD_IDS.summary) && (
                <p id={`${COMMON_FIELD_IDS.summary}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.summary)?.message}
                </p>
              )}
              <span id="record-correction-summary-counter" className={styles.counter}>{form.summary.length} / 2000</span>
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.notes}>Notas adicionales</label>
              <textarea
                id={COMMON_FIELD_IDS.notes}
                className={styles.textarea}
                rows={3}
                value={form.notes}
                maxLength={4000}
                onChange={(event) => updateCommon({ notes: event.target.value })}
                disabled={disabled}
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.notes)}
                aria-describedby={`record-correction-notes-counter${errorsById.has(COMMON_FIELD_IDS.notes) ? ` ${COMMON_FIELD_IDS.notes}-error` : ''}`}
              />
              {errorsById.get(COMMON_FIELD_IDS.notes) && (
                <p id={`${COMMON_FIELD_IDS.notes}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.notes)?.message}
                </p>
              )}
              <span id="record-correction-notes-counter" className={styles.counter}>{form.notes.length} / 4000</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.preliminaryDiagnosis}>Diagnóstico preliminar</label>
              <input
                id={COMMON_FIELD_IDS.preliminaryDiagnosis}
                className={styles.input}
                value={form.preliminaryDiagnosis}
                maxLength={300}
                onChange={(event) => updateCommon({ preliminaryDiagnosis: event.target.value })}
                disabled={disabled}
                autoComplete="off"
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.preliminaryDiagnosis)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.preliminaryDiagnosis)}
              />
              {errorsById.get(COMMON_FIELD_IDS.preliminaryDiagnosis) && (
                <p id={`${COMMON_FIELD_IDS.preliminaryDiagnosis}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.preliminaryDiagnosis)?.message}
                </p>
              )}
            </div>

            <div className={`${styles.field} ${styles.planField}`}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.plan}>Indicaciones o plan</label>
              <textarea
                id={COMMON_FIELD_IDS.plan}
                className={styles.textarea}
                rows={3}
                value={form.plan}
                maxLength={2000}
                onChange={(event) => updateCommon({ plan: event.target.value })}
                disabled={disabled}
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.plan)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.plan)}
              />
              {errorsById.get(COMMON_FIELD_IDS.plan) && (
                <p id={`${COMMON_FIELD_IDS.plan}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.plan)?.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby="correction-details-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionStep}>2</span>
            <div>
              <h2 id="correction-details-title">Detalle clínico estructurado</h2>
              <p>Corrige la plantilla del registro sin cambiar su clasificación clínica.</p>
            </div>
          </div>
          <DynamicDetailsFields
            recordType={props.original.recordType}
            details={form.detailsByType[props.original.recordType]}
            errors={errorsById}
            disabled={disabled}
            onChange={updateDetails}
          />
        </section>

        <section className={styles.formSection} aria-labelledby="correction-attachments-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionStep}>3</span>
            <div>
              <h2 id="correction-attachments-title">Adjuntos</h2>
              <p>Conserva, quita o agrega imágenes para la nueva versión del registro.</p>
            </div>
          </div>
          <RecordMediaUploader
            attachments={form.attachments}
            sections={definition.sections}
            controller={media}
            disabled={disabled}
          />
        </section>

        <div className={styles.stickyActions}>
          <span className={styles.dirtyStatus} role="status">
            {isDirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}
          </span>
          <button
            className={styles.btn}
            type="button"
            onClick={() => void handleCancel()}
            disabled={disabled || media.hasPendingUploads || media.isRemoving}
          >
            {isCancelling ? 'Saliendo…' : 'Cancelar'}
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="submit"
            disabled={disabled || !isDirty || media.isSubmissionBlocked}
          >
            <Icon name="check" size={17} /> {props.isLoading ? 'Guardando…' : 'Guardar corrección'}
          </button>
        </div>
      </form>

      {isHelpOpen && (
        <HelpDialog recordType={props.original.recordType} onClose={() => setIsHelpOpen(false)} />
      )}
    </>
  );
}
