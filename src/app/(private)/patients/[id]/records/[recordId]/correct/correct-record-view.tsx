'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { correctRecord, RecordForm } from '@/features/clinical-records';
import type { CorrectRecordData } from '@/features/clinical-records';
import { useRecord } from '@/features/clinical-records/hooks/use-record';
import { PageShell } from '@/shared/components/page-shell';
import { Spinner, Alert } from '@/shared/ui';
import { ApiError } from '@/shared/services/api-client';

interface CorrectRecordViewProps {
  patientId: string;
  recordId: string;
}

export function CorrectRecordView({ patientId, recordId }: CorrectRecordViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const { record, isLoading: loadingRecord, error: loadError } = useRecord(patientId, recordId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!user) return null;

  if (loadingRecord) {
    return (
      <PageShell>
        <Spinner label="Cargando registro…" />
      </PageShell>
    );
  }

  if (loadError || !record) {
    return (
      <PageShell>
        <Alert variant="error">{loadError ?? 'Registro no encontrado.'}</Alert>
      </PageShell>
    );
  }

  if (record.status !== 'ACTIVE') {
    return (
      <PageShell>
        <Alert variant="warning">
          Solo se pueden corregir registros activos. Estado actual: {record.status}.
        </Alert>
      </PageShell>
    );
  }

  async function handleSubmit(data: CorrectRecordData) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const corrected = await correctRecord(patientId, recordId, data);
      router.replace(`/patients/${patientId}/records/${corrected.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Error al guardar la corrección.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <RecordForm
        mode="correct"
        original={record}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/patients/${patientId}/records/${recordId}`)}
        isLoading={isSubmitting}
        error={submitError}
      />
    </PageShell>
  );
}
