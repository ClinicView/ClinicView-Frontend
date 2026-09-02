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
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        setForm((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<FormState>) }));
        setDraftNotice('Borrador restaurado');
      }
    } catch {
      // Borrador corrupto — se ignora.
    }
  }, []);

  function update(patch: Partial<FormState>) {
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
      if (result.total > 0) setDuplicate(result.data[0]);
    } catch {
      // La verificación es preventiva; el backend rechaza duplicados igualmente.
    }
  }

  const canSubmit =
    form.documentType !== '' &&
    form.documentNumber.trim().length >= 4 &&
    form.lastName.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    form.dateOfBirth !== '' &&
    form.sex !== '' &&
    !duplicate;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    if (!isValidDateOnly(form.dateOfBirth)) {
      setError('La fecha de nacimiento no es válida.');
      return;
    }
    if (isFutureDateOnly(form.dateOfBirth)) {
      setError('La fecha de nacimiento no puede estar en el futuro.');
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

          {/* Identificación */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              <Icon name="records" size={17} /> Identificación
            </p>
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
                      update({ documentType: e.target.value });
                      setDuplicate(null);
                    }}
                    disabled={isLoading}
                    required
                  >
                    <option value="">Seleccionar tipo de documento…</option>
                    {DOC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
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
                      update({ documentNumber: e.target.value });
                      setDuplicate(null);
                    }}
                    onBlur={() => void checkDuplicate()}
                    maxLength={20}
                    disabled={isLoading}
                    required
                  />
                </div>
                {duplicate && (
                  <p className={styles.duplicateWarning} role="alert">
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
                  />
                </div>
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
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              <Icon name="profile" size={17} /> Datos personales
            </p>
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
                  />
                </div>
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
                  >
                    <option value="">Seleccionar sexo…</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              <Icon name="phone" size={17} /> Contacto
            </p>
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
                  />
                </div>
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
                onClick={() => {
                  clearDraft();
                  router.push('/patients');
                }}
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
                disabled={isLoading || !canSubmit}
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
              <p id="reco-title" className={styles.sideTitle}>Recomendaciones</p>
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
