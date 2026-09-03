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
  const { record, isLoading: loadingRecord, error: loadError, reload } = useRecord(patientId, recordId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);

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
    setIsConflict(false);
    try {
      const corrected = await correctRecord(patientId, recordId, data);
      router.replace(`/patients/${patientId}/records/${corrected.id}`);
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      setIsConflict(conflict);
      setSubmitError(
        conflict
          ? 'Este registro fue actualizado desde que abriste la corrección.'
          : err instanceof ApiError
            ? err.message
            : 'Error al guardar la corrección.',
      );
      setIsSubmitting(false);
    }
  }

  async function handleReloadConflict() {
    setSubmitError(null);
    setIsConflict(false);
    await reload();
  }

  return (
    <PageShell>
      <RecordForm
        key={`${record.id}:${record.version}`}
        mode="correct"
        original={record}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/patients/${patientId}/records/${recordId}`)}
        onReloadConflict={handleReloadConflict}
        isLoading={isSubmitting}
        error={submitError}
        isConflict={isConflict}
      />
    </PageShell>
  );
}
