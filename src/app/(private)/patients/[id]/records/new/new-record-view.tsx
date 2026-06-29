'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { createRecord, RecordForm } from '@/features/clinical-records';
import type { CreateRecordData } from '@/features/clinical-records';
import { PageShell } from '@/shared/components/page-shell';
import { ApiError } from '@/shared/services/api-client';

interface NewRecordViewProps {
  patientId: string;
}

export function NewRecordView({ patientId }: NewRecordViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleSubmit(data: CreateRecordData) {
    setIsLoading(true);
    setError(null);
    try {
      const record = await createRecord(patientId, data);
      router.replace(`/patients/${patientId}/records/${record.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al registrar la historia clínica.',
      );
      setIsLoading(false);
    }
  }

  return (
    <PageShell>
      <RecordForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/patients/${patientId}/records`)}
        isLoading={isLoading}
        error={error}
      />
    </PageShell>
  );
}
