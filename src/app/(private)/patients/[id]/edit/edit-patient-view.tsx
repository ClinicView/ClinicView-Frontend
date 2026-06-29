'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { PatientEditForm, updatePatient, usePatient } from '@/features/patients';
import type { UpdatePatientData } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import { Spinner, Alert } from '@/shared/ui';
import { ApiError } from '@/shared/services/api-client';

interface EditPatientViewProps {
  patientId: string;
}

export function EditPatientView({ patientId }: EditPatientViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const { patient, isLoading: loadingPatient, error: loadError } = usePatient(patientId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  return (
    <PageShell>
      <PatientEditForm
        patient={patient}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/patients/${patientId}`)}
        isLoading={isSubmitting}
        error={submitError}
      />
    </PageShell>
  );
}
