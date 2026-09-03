'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { createPatient, listPatients } from '@/features/patients';
import type { DocumentType, Patient, Sex } from '@/features/patients';
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

const DRAFT_KEY = 'clinicview:patient-draft';

interface FormState {
  documentType: string;
  documentNumber: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
}

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

function emptyForm(): FormState {
  return {
    documentType: '',
    documentNumber: '',
    lastName: '',
    firstName: '',
    dateOfBirth: '',
    sex: '',
    phone: '',
    email: '',
    address: '',
  };
}

export function NewPatientView() {
  const { user } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Patient | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const dirtyRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        setForm((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<FormState>) }));
        dirtyRef.current = true;
        setDraftNotice('Borrador restaurado');
      }
    } catch {
      // Borrador corrupto — se ignora.
    }
  }, []);

  function update(patch: Partial<FormState>) {
    dirtyRef.current = true;
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      autosaveRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        } catch {
          // best-effort
        }
      }, 600);
      return next;
    });
    if (submitted) {
      setFieldErrors(validateForm({ ...form, ...patch }, duplicate));
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // sin consecuencias
    }
  }

  function saveDraftNow() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setDraftNotice('Borrador guardado');
      setTimeout(() => setDraftNotice(null), 2500);
    } catch {
      setDraftNotice(null);
    }
  }

  function cancelRegistration() {
    if (
      dirtyRef.current &&
      !window.confirm('Se eliminará el borrador de este paciente. ¿Deseas cancelar el registro?')
    ) {
      return;
    }
    clearDraft();
    router.push('/patients');
  }

  // Detección de duplicados: al salir del campo número de documento se
  // consulta si ya existe un paciente con ese tipo + número.
  async function checkDuplicate() {
    setDuplicate(null);
    const number = form.documentNumber.trim();
    if (!form.documentType || number.length < 4) return;
    try {
      const result = await listPatients({
        documentType: form.documentType,
        documentNumber: number,
        limit: 1,
      });
      const match = result.total > 0 ? (result.data[0] ?? null) : null;
      setDuplicate(match);
      if (submitted) setFieldErrors(validateForm(form, match));
    } catch {
      // La verificación es preventiva; el backend rechaza duplicados igualmente.
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const validationErrors = validateForm(form, duplicate);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const patient = await createPatient({
        documentType: form.documentType as DocumentType,
        documentNumber: form.documentNumber.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        sex: form.sex as Sex,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      clearDraft();
      router.replace(`/patients/${patient.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al registrar el paciente. Verifica los datos.',
      );
      setIsLoading(false);
    }
  }

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
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    maxLength={120}
                    disabled={isLoading}
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
                    maxLength={120}
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
              {draftNotice && (
                <span className={styles.draftSaved} role="status">
                  <Icon name="check" size={13} /> {draftNotice}
                </span>
              )}
            </div>
            <div className={styles.actions}>
              <button
                className={styles.btn}
                type="button"
                onClick={cancelRegistration}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                type="button"
                onClick={saveDraftNow}
                disabled={isLoading}
              >
                <Icon name="download" size={15} />
                Guardar borrador
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="submit"
                disabled={isLoading}
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
