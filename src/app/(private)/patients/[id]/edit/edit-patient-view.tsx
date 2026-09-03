'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { PatientEditForm, updatePatient, usePatient, deactivatePatient } from '@/features/patients';
import type { UpdatePatientData } from '@/features/patients';
import { can } from '@/shared/permissions/can';
import { PageShell } from '@/shared/components/page-shell';
import { Spinner, Alert, Icon } from '@/shared/ui';
import { ApiError } from '@/shared/services/api-client';
import dangerStyles from './danger-zone.module.css';

interface EditPatientViewProps {
  patientId: string;
}

export function EditPatientView({ patientId }: EditPatientViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const { patient, isLoading: loadingPatient, error: loadError } = usePatient(patientId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  if (!user) return null;

  if (loadingPatient) {
    return (
      <PageShell>
        <Spinner label="Cargando datos del paciente…" />
      </PageShell>
    );
  }

  if (loadError || !patient) {
    return (
      <PageShell>
        <Alert variant="error">{loadError ?? 'Paciente no encontrado.'}</Alert>
      </PageShell>
    );
  }

  async function handleSubmit(data: UpdatePatientData) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updatePatient(patientId, data);
      router.replace(`/patients/${patientId}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Error al actualizar el paciente.',
      );
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate() {
    setIsDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivatePatient(patientId);
      router.replace('/patients');
    } catch (err) {
      setDeactivateError(
        err instanceof ApiError ? err.message : 'Error al desactivar el paciente.',
      );
      setIsDeactivating(false);
    }
  }

  return (
    <PageShell>
      <PatientEditForm
        patient={patient}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/patients/${patientId}`)}
        isLoading={isSubmitting}
        error={submitError}
      />

      {can(user.permissions, 'patients.update') && patient.isActive && (
        <section className={dangerStyles.dangerZone} aria-labelledby="danger-zone-title">
          <h2 id="danger-zone-title" className={dangerStyles.dangerHeader}>
            <Icon name="warning" size={16} />
            Zona de peligro
          </h2>
          <div className={dangerStyles.dangerBody}>
            <p className={dangerStyles.dangerText}>
              Desactivar al paciente lo oculta de las listas y bloquea nuevas
              digitalizaciones. Su historia clínica <strong>no se elimina</strong>: se
              conserva por trazabilidad y podrás reactivarlo desde su perfil cuando
              lo necesites.
            </p>
            <label className={dangerStyles.dangerConfirm}>
              <input
                type="checkbox"
                checked={confirmDeactivate}
                onChange={(e) => setConfirmDeactivate(e.target.checked)}
                disabled={isDeactivating}
              />
              Entiendo que {patient.lastName}, {patient.firstName} dejará de aparecer en
              las listas de pacientes.
            </label>
            <button
              className={dangerStyles.dangerBtn}
              type="button"
              onClick={() => void handleDeactivate()}
              disabled={!confirmDeactivate || isDeactivating}
            >
              {isDeactivating ? 'Desactivando…' : 'Desactivar paciente'}
            </button>
            {deactivateError && <p className={dangerStyles.dangerError} role="alert">{deactivateError}</p>}
          </div>
        </section>
      )}
    </PageShell>
  );
}
