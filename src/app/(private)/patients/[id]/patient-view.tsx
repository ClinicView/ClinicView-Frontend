'use client';

import { useSession } from '@/features/auth';
import { PatientDetail, usePatient } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import { Spinner, Alert } from '@/shared/ui';

interface PatientViewProps {
  id: string;
}

export function PatientView({ id }: PatientViewProps) {
  const { user } = useSession();
  const { patient, isLoading, error } = usePatient(id);

  if (!user) return null;

  return (
    <PageShell>
      {isLoading && <Spinner label="Cargando ficha del paciente…" />}
      {error && <Alert variant="error">{error}</Alert>}
      {patient && <PatientDetail patient={patient} permissions={user.permissions} />}
    </PageShell>
  );
}
