'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import {
  RECORD_TYPE_OPTIONS,
  RecordMediaUploader,
  createRecord,
  getRecordTypeDefinition,
  useRecordDraft,
  useRecordMedia,
  type RecordDetails,
  type RecordPriority,
  type RecordType,
} from '@/features/clinical-records';
import { usePatient } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import {
  ageFromDateOnly,
  currentDateTimeLocal,
  formatDateOnly,
} from '@/shared/lib/date-time';
import { ApiError } from '@/shared/services/api-client';
import { searchProfessionals, type Professional } from '@/shared/services/professionals.service';
import { Alert, Icon, Spinner, type IconName } from '@/shared/ui';
import { DynamicDetailsFields } from './dynamic-details-fields';
import { HelpDialog, HistoryDialog } from './record-form-dialogs';
import {
  COMMON_FIELD_IDS,
  createEmptyEditorState,
  hasMeaningfulEditorData,
  restoreEditorState,
  toCreateRecordData,
  toDraftPayload,
  validateEditorState,
  type RecordAttachmentFormReference,
  type RecordEditorState,
  type RecordFormError,
} from './record-form-model';
import styles from './manual-record.module.css';

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

function errorMap(errors: RecordFormError[]): Map<string, RecordFormError> {
  return new Map(errors.map((error) => [error.id, error]));
}

function errorDescription(errors: ReadonlyMap<string, RecordFormError>, id: string): string | undefined {
  return errors.has(id) ? `${id}-error` : undefined;
}

function patientSex(value: 'M' | 'F' | 'OTHER'): string {
  if (value === 'M') return 'Masculino';
  if (value === 'F') return 'Femenino';
  return 'Otro';
}

interface NewRecordViewProps {
  patientId: string;
}

export function NewRecordView({ patientId }: NewRecordViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientId);
  const draftState = useRecordDraft(patientId);
  const saveDraftOnServer = draftState.save;
  const isDraftSaving = draftState.isSaving;
  const [form, setForm] = useState<RecordEditorState>(createEmptyEditorState);
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<RecordFormError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isReloadingDraft, setIsReloadingDraft] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [templateNotice, setTemplateNotice] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const hydratedRef = useRef(false);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const [doctorOptions, setDoctorOptions] = useState<Professional[]>([]);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [isDoctorSearching, setIsDoctorSearching] = useState(false);
  const [activeDoctorIndex, setActiveDoctorIndex] = useState(-1);
  const doctorSearchRef = useRef<number | null>(null);
  const doctorWrapRef = useRef<HTMLDivElement>(null);

  const errorsById = useMemo(() => errorMap(validationErrors), [validationErrors]);
  const patientAge = useMemo(() => ageFromDateOnly(patient?.dateOfBirth), [patient]);
  const mediaSections = useMemo(() => form.recordType
    ? getRecordTypeDefinition(form.recordType).sections
    : [], [form.recordType]);
  const media = useRecordMedia({
    patientId,
    attachments: form.attachments,
    onAttachmentsChange: updateAttachments,
  });

  useEffect(() => {
    if (draftState.isLoading || hydratedRef.current) return;
    hydratedRef.current = true;
    if (draftState.draft) {
      setForm(restoreEditorState(draftState.draft.payload));
      setSaveStatus('saved');
      setStatusMessage('Borrador del servidor restaurado.');
    }
  }, [draftState.draft, draftState.isLoading]);

  useEffect(() => {
    if (!submitted) return;
    const errors = validateEditorState(form);
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
    if (!hydratedRef.current || isSubmitting || isDiscarding || isReloadingDraft
      || isDraftSaving || media.isSubmissionBlocked
      || revisionRef.current === savedRevisionRef.current
      || !hasMeaningfulEditorData(form)) return;
    const revision = revisionRef.current;
    const timer = window.setTimeout(async () => {
      setSaveStatus('saving');
      setStatusMessage('Guardando borrador seguro…');
      try {
        const saved = await saveDraftOnServer(toDraftPayload(form));
        if (saved && revisionRef.current === revision) {
          savedRevisionRef.current = revision;
          setSaveStatus('saved');
          setStatusMessage('Borrador guardado en el servidor.');
        }
      } catch {
        setSaveStatus('error');
        setStatusMessage('El borrador no se pudo guardar.');
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [form, isDiscarding, isDraftSaving, isReloadingDraft, isSubmitting, media.isSubmissionBlocked, saveDraftOnServer]);

  useEffect(() => {
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      if (
        (revisionRef.current !== savedRevisionRef.current && hasMeaningfulEditorData(form))
        || media.hasPendingUploads
        || media.isRemoving
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [form, media.hasPendingUploads, media.isRemoving]);

  function markChanged(next: RecordEditorState) {
    revisionRef.current += 1;
    setSaveStatus('idle');
    setStatusMessage('Cambios pendientes de guardar.');
    setForm(next);
  }

  function updateCommon(patch: Partial<Omit<RecordEditorState, 'detailsByType'>>) {
    markChanged({ ...form, ...patch });
  }

  function updateDetails(details: RecordDetails) {
    if (!form.recordType) return;
    markChanged({
      ...form,
      detailsByType: { ...form.detailsByType, [form.recordType]: details },
    });
  }

  function updateAttachments(attachments: RecordAttachmentFormReference[]) {
    revisionRef.current += 1;
    setSaveStatus('idle');
    setStatusMessage('Cambios pendientes de guardar.');
    setForm((current) => ({ ...current, attachments }));
  }

  function changeRecordType(type: RecordType | '') {
    if (type !== form.recordType && form.recordType) {
      setTemplateNotice('La información de la plantilla anterior queda conservada durante esta sesión.');
    } else {
      setTemplateNotice('');
    }
    updateCommon({ recordType: type });
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

  async function saveDraftNow(): Promise<boolean> {
    if (media.isSubmissionBlocked) {
      setSaveStatus('error');
      setStatusMessage(media.hasPendingUploads
        ? 'Espera a que terminen las cargas antes de guardar el borrador.'
        : 'Resuelve o quita los archivos con error antes de guardar el borrador.');
      return false;
    }
    if (!hasMeaningfulEditorData(form)) {
      setStatusMessage('Completa al menos un campo antes de guardar el borrador.');
      return false;
    }
    const revision = revisionRef.current;
    setSaveStatus('saving');
    setStatusMessage('Guardando borrador seguro…');
    try {
      const saved = await draftState.save(toDraftPayload(form));
      if (!saved) return false;
      savedRevisionRef.current = revision;
      setSaveStatus('saved');
      setStatusMessage('Borrador guardado en el servidor.');
      return true;
    } catch {
      setSaveStatus('error');
      setStatusMessage('El borrador no se pudo guardar.');
      return false;
    }
  }

  async function leaveForm() {
    if (media.hasPendingUploads || media.isRemoving) {
      setStatusMessage('Espera a que finalice la operación de adjuntos antes de salir.');
      return;
    }
    const hasUnsaved = revisionRef.current !== savedRevisionRef.current
      && hasMeaningfulEditorData(form);
    if (hasUnsaved) {
      const shouldSave = window.confirm(
        'Hay cambios sin guardar. ¿Deseas guardar el borrador en el servidor y salir?',
      );
      if (!shouldSave) return;
      if (!await saveDraftNow()) return;
    }
    router.push(`/patients/${patientId}/records`);
  }

  async function discardDraft() {
    if (!window.confirm('Se eliminará este borrador clínico. Esta acción no se puede deshacer. ¿Continuar?')) {
      return;
    }
    setIsDiscarding(true);
    let deletedBeforeDraft: string[] = [];
    try {
      const draftAttachmentIds = new Set(
        draftState.draft?.payload.attachments?.map(({ assetId }) => assetId) ?? [],
      );
      const beforeDraft = await media.cleanupTemporaryAssets(
        form.attachments.filter(({ assetId }) => !draftAttachmentIds.has(assetId)),
      );
      deletedBeforeDraft = beforeDraft.deletedIds;
      if (draftState.draft) await draftState.remove();
      const afterDraft = await media.cleanupTemporaryAssets(
        form.attachments.filter(({ assetId }) => draftAttachmentIds.has(assetId)),
      );
      const cleanupFailures = [...beforeDraft.failures, ...afterDraft.failures];
      media.clearUploadErrors();
      setForm(createEmptyEditorState());
      revisionRef.current = 0;
      savedRevisionRef.current = 0;
      setValidationErrors([]);
      setSubmitted(false);
      setSaveStatus('idle');
      setStatusMessage(cleanupFailures.length > 0
        ? `Borrador descartado. ${cleanupFailures.length} ${cleanupFailures.length === 1 ? 'imagen temporal no pudo eliminarse' : 'imágenes temporales no pudieron eliminarse'} y caducará automáticamente.`
        : 'Borrador e imágenes temporales descartados.');
    } catch {
      if (deletedBeforeDraft.length > 0) {
        setForm((current) => ({
          ...current,
          attachments: current.attachments.filter(
            ({ assetId }) => !deletedBeforeDraft.includes(assetId),
          ),
        }));
      }
      setSaveStatus('error');
      setStatusMessage(deletedBeforeDraft.length > 0
        ? 'No se pudo eliminar el borrador; las imágenes nuevas que no estaban guardadas sí se descartaron.'
        : 'No se pudo descartar el borrador. No se eliminó ninguna referencia guardada.');
    } finally {
      setIsDiscarding(false);
    }
  }

  async function reloadServerDraft() {
    if (media.hasPendingUploads || media.isRemoving) {
      setStatusMessage('Espera a que finalice la operación de adjuntos antes de recargar el borrador.');
      return;
    }
    if (hasMeaningfulEditorData(form) && !window.confirm(
      'Recargar reemplazará los cambios visibles por la versión guardada en el servidor. ¿Continuar?',
    )) return;
    setIsReloadingDraft(true);
    try {
      const current = await draftState.reload();
      const retainedIds = new Set(current?.payload.attachments?.map(({ assetId }) => assetId) ?? []);
      const cleanup = await media.cleanupTemporaryAssets(
        form.attachments.filter(({ assetId }) => !retainedIds.has(assetId)),
      );
      media.clearUploadErrors();
      setForm(current ? restoreEditorState(current.payload) : createEmptyEditorState());
      revisionRef.current = 0;
      savedRevisionRef.current = 0;
      setSaveStatus(current ? 'saved' : 'idle');
      setStatusMessage(cleanup.failures.length > 0
        ? `${current ? 'Borrador recargado.' : 'No hay un borrador guardado.'} ${cleanup.failures.length} ${cleanup.failures.length === 1 ? 'imagen temporal reemplazada caducará' : 'imágenes temporales reemplazadas caducarán'} automáticamente.`
        : current ? 'Borrador del servidor recargado.' : 'No hay un borrador guardado.');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsReloadingDraft(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const errors = validateEditorState(form);
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
    const data = toCreateRecordData(form, draftState.draft ?? undefined);
    if (!data) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const record = await createRecord(patientId, data);
      savedRevisionRef.current = revisionRef.current;
      router.replace(`/patients/${patientId}/records/${record.id}`);
    } catch (cause) {
      setSubmitError(cause instanceof ApiError ? cause.message : 'No se pudo registrar la atención.');
      setIsSubmitting(false);
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }

  if (!user) return null;

  if (isPatientLoading) {
    return <PageShell><Spinner label="Cargando datos del paciente…" /></PageShell>;
  }

  if (patientError || !patient) {
    return <PageShell><Alert variant="error">{patientError ?? 'Paciente no encontrado.'}</Alert></PageShell>;
  }

  const commonDisabled = isSubmitting || isDiscarding || isReloadingDraft || draftState.isLoading;

  return (
    <PageShell>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href="/patients">Pacientes</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/patients/${patientId}`}>{patient.lastName}, {patient.firstName}</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Nuevo registro</span>
      </nav>

      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Historia clínica</span>
          <h1>Nuevo registro clínico</h1>
          <p>Completa los datos comunes y la plantilla correspondiente a la atención.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.headerButton}
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            aria-haspopup="dialog"
            aria-controls="record-history-dialog"
          >
            <Icon name="records" size={18} /> Ver historia
          </button>
          <button
            className={`${styles.headerButton} ${styles.helpButton}`}
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-haspopup="dialog"
            aria-controls="record-help-dialog"
          >
            <Icon name="info" size={18} /> Ayuda
          </button>
        </div>
      </header>

      <section className={styles.patientStrip} aria-labelledby="record-patient-name">
        <span className={styles.avatar} aria-hidden="true">
          {(patient.firstName[0] ?? '') + (patient.lastName[0] ?? '')}
        </span>
        <div className={styles.patientIdentity}>
          <h2 id="record-patient-name">{patient.lastName}, {patient.firstName}</h2>
          <div className={styles.patientIdentifiers}>
            <span><strong>{patient.documentType}</strong> {patient.documentNumber}</span>
            <span><strong>Nacimiento</strong> {formatDateOnly(patient.dateOfBirth)}{patientAge != null ? ` · ${patientAge} años` : ''}</span>
            <span><strong>Sexo</strong> {patientSex(patient.sex)}</span>
          </div>
        </div>
        <span className={`${styles.patientStatus} ${patient.isActive ? styles.patientActive : styles.patientInactive}`}>
          {patient.isActive ? 'Paciente activo' : 'Paciente inactivo'}
        </span>
      </section>

      <form
        className={styles.formCard}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        aria-busy={isSubmitting || isDiscarding || isReloadingDraft}
      >
        {(submitError || validationErrors.length > 0) && (
          <div
            ref={errorSummaryRef}
            className={styles.errorSummary}
            role="alert"
            tabIndex={-1}
            aria-labelledby="record-create-errors-title"
          >
            <h2 id="record-create-errors-title">
              {submitError ? 'No se pudo registrar la atención' : 'Revisa los campos indicados'}
            </h2>
            {submitError && <p>{submitError}</p>}
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

        {draftState.error && (
          <div className={styles.draftError} role="alert">
            <Icon name="warning" size={18} />
            <span>{draftState.error}</span>
            <button
              type="button"
              onClick={() => void reloadServerDraft()}
              disabled={isReloadingDraft || media.hasPendingUploads || media.isRemoving}
            >
              {isReloadingDraft ? 'Recargando…' : 'Recargar borrador'}
            </button>
          </div>
        )}

        <section className={styles.formSection} aria-labelledby="common-data-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionStep}>1</span>
            <div><h2 id="common-data-title">Datos de la atención</h2><p>Información común para todos los registros.</p></div>
          </div>

          <div className={styles.commonGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.recordType}>
                Tipo de registro <span className={styles.required} aria-hidden="true">*</span>
              </label>
              <select
                id={COMMON_FIELD_IDS.recordType}
                className={styles.select}
                value={form.recordType}
                onChange={(event) => changeRecordType(event.target.value as RecordType | '')}
                disabled={commonDisabled}
                required
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.recordType)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.recordType)}
              >
                <option value="">Seleccionar tipo…</option>
                {RECORD_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errorsById.get(COMMON_FIELD_IDS.recordType) && (
                <p id={`${COMMON_FIELD_IDS.recordType}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.recordType)?.message}
                </p>
              )}
              {templateNotice && <p className={styles.fieldHint} role="status">{templateNotice}</p>}
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
                disabled={commonDisabled}
                required
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.attendedAt)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.attendedAt)}
              />
              {errorsById.get(COMMON_FIELD_IDS.attendedAt) && (
                <p id={`${COMMON_FIELD_IDS.attendedAt}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.attendedAt)?.message}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.service}>Servicio o especialidad</label>
              <select
                id={COMMON_FIELD_IDS.service}
                className={styles.select}
                value={form.service}
                onChange={(event) => updateCommon({ service: event.target.value })}
                disabled={commonDisabled}
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.service)}
                aria-describedby={errorDescription(errorsById, COMMON_FIELD_IDS.service)}
              >
                <option value="">Seleccionar…</option>
                {SERVICES.map((service) => <option key={service} value={service}>{service}</option>)}
              </select>
              {errorsById.get(COMMON_FIELD_IDS.service) && (
                <p id={`${COMMON_FIELD_IDS.service}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.service)?.message}
                </p>
              )}
            </div>

            <div className={`${styles.field} ${styles.professionalField}`} ref={doctorWrapRef}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.doctorName}>
                Médico o profesional <span className={styles.required} aria-hidden="true">*</span>
              </label>
              <div className={styles.combobox}>
                <span className={styles.inputIcon} aria-hidden="true"><Icon name="search" size={16} /></span>
                <input
                  id={COMMON_FIELD_IDS.doctorName}
                  className={styles.input}
                  value={form.doctorName}
                  placeholder="Escribe al menos 2 caracteres"
                  maxLength={120}
                  disabled={commonDisabled}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={doctorOpen}
                  aria-controls="record-professional-options"
                  aria-activedescendant={activeDoctorIndex >= 0
                    ? `record-professional-option-${doctorOptions[activeDoctorIndex]?.id}`
                    : undefined}
                  aria-invalid={errorsById.has(COMMON_FIELD_IDS.doctorName)}
                  aria-describedby={[
                    form.professionalId ? 'record-selected-professional' : '',
                    errorDescription(errorsById, COMMON_FIELD_IDS.doctorName) ?? '',
                  ].filter(Boolean).join(' ') || undefined}
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
                      <ul id="record-professional-options" className={styles.comboList} role="listbox" aria-label="Profesionales encontrados">
                        {doctorOptions.map((professional, index) => (
                          <li key={professional.id}>
                            <button
                              id={`record-professional-option-${professional.id}`}
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
                      <p id="record-professional-options" className={styles.comboEmpty}>
                        Sin coincidencias. Puedes conservar el nombre como texto libre.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {form.professionalId && (
                <p id="record-selected-professional" className={styles.selectedProfessional}>
                  <Icon name="check" size={14} /> Vinculado al profesional del sistema.
                </p>
              )}
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
                disabled={commonDisabled}
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
              <div className={styles.chips} role="radiogroup" aria-label="Prioridad del registro">
                {PRIORITIES.map((priority, index) => (
                  <button
                    key={priority.value}
                    className={`${styles.chip} ${styles[`chip_${priority.value}`]} ${form.priority === priority.value ? styles.chipActive : ''}`}
                    type="button"
                    role="radio"
                    aria-checked={form.priority === priority.value}
                    tabIndex={form.priority === priority.value ? 0 : -1}
                    disabled={commonDisabled}
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
                placeholder="Sintetiza el motivo, los hallazgos relevantes y la conducta clínica."
                onChange={(event) => updateCommon({ summary: event.target.value })}
                disabled={commonDisabled}
                required
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.summary)}
                aria-describedby={`record-summary-counter${errorsById.has(COMMON_FIELD_IDS.summary) ? ` ${COMMON_FIELD_IDS.summary}-error` : ''}`}
              />
              {errorsById.get(COMMON_FIELD_IDS.summary) && (
                <p id={`${COMMON_FIELD_IDS.summary}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.summary)?.message}
                </p>
              )}
              <span id="record-summary-counter" className={styles.counter}>{form.summary.length} / 2000</span>
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.notes}>Notas adicionales</label>
              <textarea
                id={COMMON_FIELD_IDS.notes}
                className={styles.textarea}
                rows={3}
                value={form.notes}
                maxLength={4000}
                placeholder="Información complementaria que no pertenece a la plantilla específica."
                onChange={(event) => updateCommon({ notes: event.target.value })}
                disabled={commonDisabled}
                aria-invalid={errorsById.has(COMMON_FIELD_IDS.notes)}
                aria-describedby={`record-notes-counter${errorsById.has(COMMON_FIELD_IDS.notes) ? ` ${COMMON_FIELD_IDS.notes}-error` : ''}`}
              />
              {errorsById.get(COMMON_FIELD_IDS.notes) && (
                <p id={`${COMMON_FIELD_IDS.notes}-error`} className={styles.fieldError}>
                  {errorsById.get(COMMON_FIELD_IDS.notes)?.message}
                </p>
              )}
              <span id="record-notes-counter" className={styles.counter}>{form.notes.length} / 4000</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={COMMON_FIELD_IDS.preliminaryDiagnosis}>Diagnóstico preliminar</label>
              <input
                id={COMMON_FIELD_IDS.preliminaryDiagnosis}
                className={styles.input}
                value={form.preliminaryDiagnosis}
                maxLength={300}
                onChange={(event) => updateCommon({ preliminaryDiagnosis: event.target.value })}
                disabled={commonDisabled}
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
                disabled={commonDisabled}
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

        <section className={styles.formSection} aria-labelledby="typed-data-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionStep}>2</span>
            <div><h2 id="typed-data-title">Detalle clínico estructurado</h2><p>Los campos cambian según el tipo seleccionado.</p></div>
          </div>
          {form.recordType ? (
            <DynamicDetailsFields
              recordType={form.recordType}
              details={form.detailsByType[form.recordType]}
              errors={errorsById}
              disabled={commonDisabled}
              onChange={updateDetails}
            />
          ) : (
            <div className={styles.templateEmpty}>
              <Icon name="records" size={24} />
              <div><h3>Selecciona un tipo de registro</h3><p>Mostraremos aquí la plantilla clínica correspondiente.</p></div>
            </div>
          )}
        </section>

        <section className={styles.formSection} aria-labelledby="attachments-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionStep}>3</span>
            <div><h2 id="attachments-title">Adjuntos</h2><p>Imágenes clínicas privadas vinculadas a este registro.</p></div>
          </div>
          <RecordMediaUploader
            attachments={form.attachments}
            sections={mediaSections}
            controller={media}
            disabled={commonDisabled}
          />
        </section>

        <div className={styles.draftBar}>
          <span className={`${styles.saveIndicator} ${styles[`save_${saveStatus}`]}`} aria-hidden="true" />
          <div>
            <strong>Borrador privado en servidor</strong>
            <p aria-live="polite" aria-atomic="true">
              {draftState.isLoading ? 'Recuperando borrador…' : statusMessage || 'Se guardará automáticamente al realizar cambios. Caduca en siete días.'}
            </p>
          </div>
          {(draftState.draft || hasMeaningfulEditorData(form)) && (
            <button
              type="button"
              onClick={() => void discardDraft()}
              disabled={commonDisabled || draftState.isSaving || media.hasPendingUploads || media.isRemoving}
            >
              {isDiscarding ? 'Descartando…' : 'Descartar borrador'}
            </button>
          )}
        </div>

        <div className={styles.stickyActions}>
          <button
            className={styles.btn}
            type="button"
            onClick={() => void leaveForm()}
            disabled={isSubmitting || media.hasPendingUploads || media.isRemoving}
          >
            Salir
          </button>
          <button
            className={`${styles.btn} ${styles.btnOutline}`}
            type="button"
            onClick={() => void saveDraftNow()}
            disabled={commonDisabled || draftState.isSaving || media.isSubmissionBlocked || !hasMeaningfulEditorData(form)}
          >
            {draftState.isSaving || saveStatus === 'saving' ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="submit"
            disabled={commonDisabled || media.isSubmissionBlocked}
          >
            <Icon name="check" size={17} /> {isSubmitting ? 'Registrando…' : 'Registrar atención'}
          </button>
        </div>
      </form>

      {isHelpOpen && <HelpDialog recordType={form.recordType} onClose={() => setIsHelpOpen(false)} />}
      {isHistoryOpen && <HistoryDialog patientId={patientId} onClose={() => setIsHistoryOpen(false)} />}
    </PageShell>
  );
}
