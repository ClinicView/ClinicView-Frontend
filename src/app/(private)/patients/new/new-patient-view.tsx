'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import {
  createPatient,
  deleteCurrentPatientRegistrationDraft,
  getCurrentPatientRegistrationDraft,
  listPatients,
  saveCurrentPatientRegistrationDraft,
} from '@/features/patients';
import type {
  DocumentType,
  Patient,
  PatientRegistrationDraft,
  Sex,
} from '@/features/patients';
import {
  emptyPatientRegistrationForm,
  formFromPatientRegistrationDraft,
  getPatientDraftValidationIssue,
  hasMeaningfulPatientRegistrationData,
  patientRegistrationFormSignature,
  PatientRegistrationDraftMutationQueue,
  toPatientRegistrationDraftPayload,
} from '@/features/patients/lib/patient-registration-draft';
import type { PatientRegistrationFormState } from '@/features/patients/lib/patient-registration-draft';
import { PageShell } from '@/shared/components/page-shell';
import { currentDateOnly, isFutureDateOnly, isValidDateOnly } from '@/shared/lib/date-time';
import { Icon } from '@/shared/ui';
import { ApiError } from '@/shared/services/api-client';
import styles from './register-patient.module.css';

const DOC_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: 'DNI', label: 'DNI — Documento Nacional de Identidad' },
  { value: 'CE', label: 'CE — Carné de Extranjería' },
  { value: 'PAS', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro documento' },
];

const LEGACY_DRAFT_KEY = 'clinicview:patient-draft';

type FormState = PatientRegistrationFormState;
type DraftPhase = 'loading' | 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

type FieldErrors = Partial<Record<keyof FormState, string>>;

const FIELD_LABELS: Partial<Record<keyof FormState, string>> = {
  documentType: 'Tipo de documento',
  documentNumber: 'Número de documento',
  lastName: 'Apellidos',
  firstName: 'Nombres',
  dateOfBirth: 'Fecha de nacimiento',
  sex: 'Sexo',
  email: 'Correo electrónico',
};

function validateForm(form: FormState, duplicate: Patient | null): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.documentType) errors.documentType = 'Selecciona un tipo de documento.';
  if (form.documentNumber.trim().length < 4) {
    errors.documentNumber = 'Ingresa un número de documento de al menos 4 caracteres.';
  } else if (duplicate) {
    errors.documentNumber = 'Este documento ya está asociado a otro paciente.';
  }
  if (!form.lastName.trim()) errors.lastName = 'Ingresa los apellidos.';
  if (!form.firstName.trim()) errors.firstName = 'Ingresa los nombres.';
  if (!form.dateOfBirth) errors.dateOfBirth = 'Ingresa la fecha de nacimiento.';
  else if (!isValidDateOnly(form.dateOfBirth)) errors.dateOfBirth = 'Ingresa una fecha válida.';
  else if (isFutureDateOnly(form.dateOfBirth)) {
    errors.dateOfBirth = 'La fecha de nacimiento no puede estar en el futuro.';
  }
  if (!form.sex) errors.sex = 'Selecciona el sexo.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }
  return errors;
}

function formatDraftDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function NewPatientView() {
  const { user } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyPatientRegistrationForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isReloadingDraft, setIsReloadingDraft] = useState(false);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftPhase, setDraftPhase] = useState<DraftPhase>('loading');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftExpiresAt, setDraftExpiresAt] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Patient | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef<Promise<PatientRegistrationDraft | null> | null>(null);
  const formRef = useRef<FormState>(emptyPatientRegistrationForm());
  const savedSignatureRef = useRef(patientRegistrationFormSignature(emptyPatientRegistrationForm()));
  const dirtyRef = useRef(false);
  const draftReadyRef = useRef(false);
  const draftConflictRef = useRef(false);
  const pendingMutationsRef = useRef(0);
  const activeRef = useRef(true);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [draftQueue] = useState(() => new PatientRegistrationDraftMutationQueue({
    save: saveCurrentPatientRegistrationDraft,
    remove: deleteCurrentPatientRegistrationDraft,
  }));

  const rememberDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    if (activeRef.current) setIsDirty(next);
  }, []);

  const applyRemoteDraft = useCallback((draft: PatientRegistrationDraft | null) => {
    const nextForm = draft
      ? formFromPatientRegistrationDraft(draft.payload)
      : emptyPatientRegistrationForm();
    draftQueue.replace(draft);
    formRef.current = nextForm;
    savedSignatureRef.current = patientRegistrationFormSignature(nextForm);
    draftReadyRef.current = true;
    draftConflictRef.current = false;
    setForm(nextForm);
    rememberDirty(false);
    setDraftError(null);
    setDraftExpiresAt(draft?.expiresAt ?? null);
    setLastSavedAt(draft?.updatedAt ?? null);
    setDraftPhase(draft ? 'saved' : 'idle');
    setIsDraftReady(true);
  }, [draftQueue, rememberDirty]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, []);

  useEffect(() => {
    if (!initialLoadRef.current) {
      // Eliminación unidireccional del antiguo borrador con PII. Nunca se lee ni migra.
      try {
        window.localStorage.removeItem(LEGACY_DRAFT_KEY);
      } catch {
        // Un almacenamiento bloqueado no impide recuperar el borrador privado del servidor.
      }
      initialLoadRef.current = getCurrentPatientRegistrationDraft();
    }

    let subscribed = true;
    setDraftPhase('loading');
    initialLoadRef.current
      .then((draft) => {
        if (subscribed) applyRemoteDraft(draft);
      })
      .catch((cause) => {
        if (!subscribed) return;
        setDraftError(
          cause instanceof Error ? cause.message : 'No se pudo recuperar el borrador privado.',
        );
        setDraftPhase('error');
        setIsDraftReady(false);
      });

    return () => { subscribed = false; };
  }, [applyRemoteDraft]);

  useEffect(() => {
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      if (!dirtyRef.current && pendingMutationsRef.current === 0) return;
      event.preventDefault();
    }

    function guardInternalLink(event: MouseEvent) {
      if (!dirtyRef.current && pendingMutationsRef.current === 0) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target : null;
      const anchor = element?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm('Hay cambios del paciente pendientes de guardar. ¿Deseas salir de todos modos?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener('beforeunload', warnBeforeLeave);
    document.addEventListener('click', guardInternalLink, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeave);
      document.removeEventListener('click', guardInternalLink, true);
    };
  }, []);

  const persistDraft = useCallback(async (
    snapshot: FormState,
  ): Promise<PatientRegistrationDraft | null> => {
    const hasData = hasMeaningfulPatientRegistrationData(snapshot);
    if (!hasData && !draftQueue.current()) {
      savedSignatureRef.current = patientRegistrationFormSignature(snapshot);
      rememberDirty(false);
      setDraftError(null);
      setDraftPhase('idle');
      return null;
    }

    const validationIssue = getPatientDraftValidationIssue(snapshot);
    if (validationIssue) {
      setDraftError(validationIssue);
      setDraftPhase('error');
      throw new Error(validationIssue);
    }

    pendingMutationsRef.current += 1;
    setIsDraftSaving(true);
    setDraftError(null);
    setDraftPhase('saving');
    const savedSignature = patientRegistrationFormSignature(snapshot);

    try {
      const saved = await draftQueue.save(toPatientRegistrationDraftPayload(snapshot));
      if (!activeRef.current) return saved;
      savedSignatureRef.current = savedSignature;
      setLastSavedAt(saved.updatedAt);
      setDraftExpiresAt(saved.expiresAt);
      const stillDirty = patientRegistrationFormSignature(formRef.current) !== savedSignature;
      rememberDirty(stillDirty);
      setDraftPhase(stillDirty ? 'pending' : 'saved');
      return saved;
    } catch (cause) {
      if (activeRef.current) {
        if (cause instanceof ApiError && cause.status === 409) {
          draftConflictRef.current = true;
          setDraftPhase('conflict');
          setDraftError(
            'El borrador cambió en otra pestaña o sesión. Tus datos actuales siguen visibles y no se sobrescribieron.',
          );
        } else {
          setDraftPhase('error');
          setDraftError(
            cause instanceof Error ? cause.message : 'No se pudo guardar el borrador privado.',
          );
        }
      }
      throw cause;
    } finally {
      pendingMutationsRef.current -= 1;
      if (pendingMutationsRef.current === 0 && activeRef.current) setIsDraftSaving(false);
    }
  }, [draftQueue, rememberDirty]);

  function update(patch: Partial<FormState>) {
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
    const nextDirty = patientRegistrationFormSignature(next) !== savedSignatureRef.current;
    rememberDirty(nextDirty);

    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    if (draftConflictRef.current) {
      setDraftPhase('conflict');
    } else if (nextDirty && draftReadyRef.current) {
      setDraftError(null);
      setDraftPhase('pending');
      autosaveRef.current = setTimeout(() => {
        void persistDraft(formRef.current).catch(() => undefined);
      }, 800);
    } else if (!nextDirty) {
      setDraftError(null);
      setDraftPhase(draftQueue.current() ? 'saved' : 'idle');
    }

    if (submitted) setFieldErrors(validateForm(next, duplicate));
  }

  async function reloadDraft(confirmReplacement: boolean) {
    if (
      confirmReplacement
      && (dirtyRef.current || hasMeaningfulPatientRegistrationData(formRef.current))
      && !window.confirm(
        'Se reemplazarán los datos visibles por la versión guardada en el servidor. ¿Deseas continuar?',
      )
    ) return;

    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    setIsReloadingDraft(true);
    setDraftError(null);
    try {
      await draftQueue.idle();
      const current = await getCurrentPatientRegistrationDraft();
      if (activeRef.current) applyRemoteDraft(current);
    } catch (cause) {
      if (!activeRef.current) return;
      setDraftError(
        cause instanceof Error ? cause.message : 'No se pudo recargar el borrador privado.',
      );
      setDraftPhase(draftConflictRef.current ? 'conflict' : 'error');
    } finally {
      if (activeRef.current) setIsReloadingDraft(false);
    }
  }

  async function saveDraftNow() {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    if (!dirtyRef.current) {
      setDraftError(null);
      setDraftPhase(draftQueue.current() ? 'saved' : 'idle');
      return;
    }
    try {
      await persistDraft(formRef.current);
    } catch {
      // persistDraft deja un estado recuperable junto al formulario.
    }
  }

  async function cancelRegistration() {
    const hasDraftOrData = Boolean(draftQueue.current())
      || hasMeaningfulPatientRegistrationData(formRef.current);
    if (
      hasDraftOrData
      && !window.confirm('Se eliminará el borrador privado de este paciente. ¿Deseas cancelar el registro?')
    ) return;

    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    setIsDiscarding(true);
    setDraftError(null);
    try {
      await draftQueue.remove();
      rememberDirty(false);
      router.push('/patients');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        draftConflictRef.current = true;
        setDraftPhase('conflict');
        setDraftError(
          'El borrador cambió antes de poder eliminarlo. Recarga la versión guardada y vuelve a intentarlo.',
        );
      } else {
        setDraftPhase('error');
        setDraftError(cause instanceof Error ? cause.message : 'No se pudo eliminar el borrador.');
      }
      setIsDiscarding(false);
    }
  }

  // Detección de duplicados: al salir del campo número de documento se
  // consulta si ya existe un paciente con ese tipo + número.
  async function checkDuplicate() {
    setDuplicate(null);
    const snapshot = formRef.current;
    const number = snapshot.documentNumber.trim();
    if (!snapshot.documentType || number.length < 4) return;
    try {
      const result = await listPatients({
        documentType: snapshot.documentType,
        documentNumber: number,
        limit: 1,
      });
      const match = result.total > 0 ? (result.data[0] ?? null) : null;
      if (
        formRef.current.documentType !== snapshot.documentType
        || formRef.current.documentNumber.trim() !== number
      ) return;
      setDuplicate(match);
      if (submitted) setFieldErrors(validateForm(formRef.current, match));
    } catch {
      // La verificación es preventiva; el backend rechaza duplicados igualmente.
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const snapshot = formRef.current;
    const validationErrors = validateForm(snapshot, duplicate);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setIsLoading(true);
    setError(null);
    let stage: 'draft' | 'patient' = 'draft';
    try {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      const currentDraft = dirtyRef.current || !draftQueue.current()
        ? await persistDraft(snapshot)
        : draftQueue.current();
      if (!currentDraft) throw new Error('No se pudo confirmar el borrador privado.');

      stage = 'patient';
      const patient = await createPatient({
        documentType: snapshot.documentType as DocumentType,
        documentNumber: snapshot.documentNumber.trim(),
        firstName: snapshot.firstName.trim(),
        lastName: snapshot.lastName.trim(),
        dateOfBirth: snapshot.dateOfBirth,
        sex: snapshot.sex as Sex,
        phone: snapshot.phone.trim() || undefined,
        email: snapshot.email.trim() || undefined,
        address: snapshot.address.trim() || undefined,
        draftId: currentDraft.id,
        expectedDraftVersion: currentDraft.version,
      });
      draftQueue.replace(null);
      rememberDirty(false);
      router.replace(`/patients/${patient.id}`);
    } catch (err) {
      if (stage === 'draft') {
        setIsLoading(false);
        return;
      }
      if (
        stage === 'patient'
        && err instanceof ApiError
        && err.status === 409
        && /borrador|draft/i.test(err.message)
      ) {
        draftConflictRef.current = true;
        setDraftPhase('conflict');
        setDraftError(
          'El borrador venció o cambió antes de registrar al paciente. Tus datos siguen visibles; recarga antes de continuar.',
        );
        setIsLoading(false);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al registrar el paciente. Verifica los datos.',
      );
      setIsLoading(false);
    }
  }

  const formattedLastSavedAt = formatDraftDate(lastSavedAt);
  const formattedDraftExpiresAt = formatDraftDate(draftExpiresAt);
  const draftStatusText = draftPhase === 'loading'
    ? 'Recuperando borrador privado…'
    : draftPhase === 'saving'
      ? 'Guardando borrador privado…'
      : draftPhase === 'pending'
        ? 'Cambios pendientes; se guardarán automáticamente.'
        : draftPhase === 'saved'
          ? `Borrador guardado${formattedLastSavedAt ? ` el ${formattedLastSavedAt}` : ''}.`
          : draftPhase === 'idle'
            ? 'Se guardará automáticamente al realizar cambios.'
            : draftPhase === 'conflict'
              ? 'Se necesita resolver un conflicto antes de continuar.'
              : 'El borrador necesita atención.';

  const commonDisabled = isLoading || isDiscarding || isReloadingDraft || !isDraftReady;

  if (!user) return null;

  return (
    <PageShell>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href="/patients">Pacientes</Link>
        <span aria-hidden="true">›</span>
        <span>Registrar paciente</span>
      </nav>

      <div className={styles.layout}>
        {/* ─── Formulario ─── */}
        <form
          className={styles.formCard}
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isLoading || isDiscarding || isReloadingDraft}
        >
          <div className={styles.formHeader}>
            <span className={styles.formHeaderIcon} aria-hidden="true">
              <Icon name="patient" size={26} />
            </span>
            <div>
              <h1 className={styles.formTitle}>Registrar paciente</h1>
              <p className={styles.formSubtitle}>
                Complete los datos del paciente para incorporarlo al flujo clínico y de digitalización.
              </p>
              <span className={styles.newBadge}>
                <Icon name="check" size={12} /> Nuevo paciente
              </span>
            </div>
          </div>

          <div
            className={`${styles.draftStatus} ${
              draftPhase === 'conflict' || draftPhase === 'error' ? styles.draftStatusAttention : ''
            }`}
          >
            <span className={styles.draftStatusIcon} aria-hidden="true">
              <Icon
                name={draftPhase === 'saved' ? 'check' : draftPhase === 'error' || draftPhase === 'conflict' ? 'warning' : 'clock'}
                size={17}
              />
            </span>
            <div>
              <strong
                role={draftPhase === 'conflict' || draftPhase === 'error' ? undefined : 'status'}
                aria-live={draftPhase === 'conflict' || draftPhase === 'error' ? undefined : 'polite'}
                aria-atomic={draftPhase === 'conflict' || draftPhase === 'error' ? undefined : 'true'}
              >
                {draftStatusText}
              </strong>
              <span>
                Se protege con tu sesión en el servidor; no se conserva una copia local del borrador.
              </span>
              {formattedDraftExpiresAt && (
                <span>Caduca el {formattedDraftExpiresAt}.</span>
              )}
            </div>
          </div>

          {draftError && (
            <div className={styles.draftError} role="alert">
              <Icon name="warning" size={18} />
              <div>
                <strong>No pudimos sincronizar el borrador</strong>
                <p>{draftError}</p>
              </div>
              {draftPhase === 'conflict' ? (
                <button
                  type="button"
                  onClick={() => void reloadDraft(true)}
                  disabled={isReloadingDraft || isDiscarding || isLoading}
                >
                  {isReloadingDraft ? 'Recargando…' : 'Recargar versión guardada'}
                </button>
              ) : !isDraftReady ? (
                <button
                  type="button"
                  onClick={() => void reloadDraft(false)}
                  disabled={isReloadingDraft}
                >
                  {isReloadingDraft ? 'Reintentando…' : 'Reintentar recuperación'}
                </button>
              ) : getPatientDraftValidationIssue(form) === null ? (
                <button
                  type="button"
                  onClick={() => void saveDraftNow()}
                  disabled={isDraftSaving || isDiscarding || isLoading}
                >
                  Reintentar guardado
                </button>
              ) : null}
            </div>
          )}

          {error && (
            <p role="alert" className={styles.error}>
              <Icon name="alert" size={16} /> {error}
            </p>
          )}

          {Object.keys(fieldErrors).length > 0 && (
            <div
              ref={errorSummaryRef}
              className={styles.errorSummary}
              role="alert"
              tabIndex={-1}
              aria-labelledby="patient-form-error-title"
            >
              <h2 id="patient-form-error-title">Revisa los campos indicados</h2>
              <ul>
                {Object.entries(fieldErrors).map(([field, message]) => (
                  <li key={field}>
                    <a href={`#${field}`}>
                      {FIELD_LABELS[field as keyof FormState] ?? field}: {message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Identificación */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Icon name="records" size={17} /> Identificación
            </h2>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="documentType">
                  Tipo de documento <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="records" size={16} />
                  </span>
                  <select
                    id="documentType"
                    className={styles.select}
                    value={form.documentType}
                    onChange={(e) => {
                      const value = e.target.value;
                      update({ documentType: value });
                      setDuplicate(null);
                      if (submitted) {
                        setFieldErrors(validateForm({ ...form, documentType: value }, null));
                      }
                    }}
                    disabled={commonDisabled}
                    required
                    aria-invalid={Boolean(fieldErrors.documentType)}
                    aria-describedby={fieldErrors.documentType ? 'documentType-error' : undefined}
                  >
                    <option value="">Seleccionar tipo de documento…</option>
                    {DOC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                {fieldErrors.documentType && (
                  <p id="documentType-error" className={styles.fieldError}>{fieldErrors.documentType}</p>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="documentNumber">
                  Número de documento <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="scan" size={16} />
                  </span>
                  <input
                    id="documentNumber"
                    className={styles.input}
                    placeholder="Ej.: 12345678"
                    value={form.documentNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      update({ documentNumber: value });
                      setDuplicate(null);
                      if (submitted) {
                        setFieldErrors(validateForm({ ...form, documentNumber: value }, null));
                      }
                    }}
                    onBlur={() => void checkDuplicate()}
                    maxLength={20}
                    disabled={commonDisabled}
                    required
                    aria-invalid={Boolean(fieldErrors.documentNumber)}
                    aria-describedby={[
                      fieldErrors.documentNumber ? 'documentNumber-error' : '',
                      duplicate ? 'documentNumber-duplicate' : '',
                    ].filter(Boolean).join(' ') || undefined}
                  />
                </div>
                {fieldErrors.documentNumber && (
                  <p id="documentNumber-error" className={styles.fieldError}>{fieldErrors.documentNumber}</p>
                )}
                {duplicate && (
                  <p id="documentNumber-duplicate" className={styles.duplicateWarning} role="alert">
                    <Icon name="warning" size={15} />
                    <span>
                      Ya existe un paciente con este documento:{' '}
                      <Link href={`/patients/${duplicate.id}`}>
                        {duplicate.lastName}, {duplicate.firstName}
                      </Link>
                      . Verifica antes de crear un duplicado.
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="lastName">
                  Apellidos <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="patient" size={16} />
                  </span>
                  <input
                    id="lastName"
                    className={styles.input}
                    placeholder="Ej.: López Mendoza"
                    value={form.lastName}
                    onChange={(e) => update({ lastName: e.target.value })}
                    maxLength={100}
                    disabled={commonDisabled}
                    required
                    autoComplete="family-name"
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
                  />
                </div>
                {fieldErrors.lastName && (
                  <p id="lastName-error" className={styles.fieldError}>{fieldErrors.lastName}</p>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="firstName">
                  Nombres <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="patient" size={16} />
                  </span>
                  <input
                    id="firstName"
                    className={styles.input}
                    placeholder="Ej.: María Elena"
                    value={form.firstName}
                    onChange={(e) => update({ firstName: e.target.value })}
                    maxLength={100}
                    disabled={commonDisabled}
                    required
                    autoComplete="given-name"
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                  />
                </div>
                {fieldErrors.firstName && (
                  <p id="firstName-error" className={styles.fieldError}>{fieldErrors.firstName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Icon name="profile" size={17} /> Datos personales
            </h2>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="dateOfBirth">
                  Fecha de nacimiento <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="calendar" size={16} />
                  </span>
                  <input
                    id="dateOfBirth"
                    type="date"
                    className={styles.input}
                    value={form.dateOfBirth}
                    max={currentDateOnly()}
                    onChange={(e) => update({ dateOfBirth: e.target.value })}
                    disabled={commonDisabled}
                    required
                    autoComplete="bday"
                    aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                    aria-describedby={fieldErrors.dateOfBirth ? 'dateOfBirth-error' : undefined}
                  />
                </div>
                {fieldErrors.dateOfBirth && (
                  <p id="dateOfBirth-error" className={styles.fieldError}>{fieldErrors.dateOfBirth}</p>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="sex">
                  Sexo <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="profile" size={16} />
                  </span>
                  <select
                    id="sex"
                    className={styles.select}
                    value={form.sex}
                    onChange={(e) => update({ sex: e.target.value })}
                    disabled={commonDisabled}
                    required
                    aria-invalid={Boolean(fieldErrors.sex)}
                    aria-describedby={fieldErrors.sex ? 'sex-error' : undefined}
                  >
                    <option value="">Seleccionar sexo…</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                {fieldErrors.sex && (
                  <p id="sex-error" className={styles.fieldError}>{fieldErrors.sex}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Icon name="phone" size={17} /> Contacto
            </h2>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="phone">Teléfono</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="phone" size={16} />
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    className={styles.input}
                    placeholder="Ej.: 987 654 321"
                    value={form.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                    maxLength={20}
                    disabled={commonDisabled}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">Correo electrónico</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="mail" size={16} />
                  </span>
                  <input
                    id="email"
                    type="email"
                    className={styles.input}
                    placeholder="Ej.: correo@ejemplo.com"
                    value={form.email}
                    onChange={(e) => update({ email: e.target.value })}
                    maxLength={160}
                    disabled={commonDisabled}
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" className={styles.fieldError}>{fieldErrors.email}</p>
                )}
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="address">Dirección</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="location" size={16} />
                  </span>
                  <input
                    id="address"
                    className={styles.input}
                    placeholder="Ej.: Av. Los Cedros 456, La Molina, Lima, Perú"
                    value={form.address}
                    onChange={(e) => update({ address: e.target.value })}
                    maxLength={240}
                    disabled={commonDisabled}
                    autoComplete="street-address"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.formFooter}>
            <div className={styles.footerNotes}>
              <span className={styles.footerNote}>
                <span className={styles.required}>*</span> Los campos marcados con
                <span className={styles.required}> *</span> son obligatorios.
              </span>
              <span className={styles.footerNote}>
                <Icon name="shield" size={13} />
                La información será utilizada únicamente para la atención y gestión clínica autorizada.
              </span>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.btn}
                type="button"
                onClick={() => void cancelRegistration()}
                disabled={commonDisabled}
              >
                {isDiscarding ? 'Eliminando borrador…' : 'Cancelar'}
              </button>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                type="button"
                onClick={() => void saveDraftNow()}
                disabled={commonDisabled || isDraftSaving || draftPhase === 'conflict' || !isDirty}
              >
                <Icon name="check" size={15} />
                {isDraftSaving ? 'Guardando…' : 'Guardar ahora'}
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="submit"
                disabled={commonDisabled || draftPhase === 'conflict'}
              >
                <Icon name="patient" size={16} />
                {isLoading ? 'Registrando…' : 'Registrar paciente'}
              </button>
            </div>
          </div>
        </form>

        {/* ─── Recomendaciones ─── */}
        <aside>
          <section className={styles.sideCard} aria-labelledby="reco-title">
            <div className={styles.sideHeader}>
              <span className={styles.sideIcon} aria-hidden="true">
                <Icon name="sparkle" size={20} />
              </span>
              <h2 id="reco-title" className={styles.sideTitle}>Recomendaciones</h2>
            </div>
            <div className={styles.tipList}>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Verifica que el tipo y número de documento sean correctos.
              </p>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Completa todos los campos obligatorios marcados con *.
              </p>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Asegúrate de que el paciente no esté registrado previamente — el
                sistema te avisará si el documento ya existe.
              </p>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Usa un correo electrónico válido si el paciente lo proporciona.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
