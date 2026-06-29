'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { createPatient, PatientForm } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import { ApiError } from '@/shared/services/api-client';
import type { CreatePatientData } from '@/features/patients';

export function NewPatientView() {
  const { user } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleSubmit(data: CreatePatientData) {
    setIsLoading(true);
    setError(null);
    try {
      const patient = await createPatient(data);
      router.replace(`/patients/${patient.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al registrar el paciente. Verifica los datos.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageShell>
      <PatientForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/patients')}
        isLoading={isLoading}
        error={error}
      />
    </PageShell>
  );
}
