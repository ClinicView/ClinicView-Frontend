'use client';

import { useSession } from '@/features/auth';
import { RecordDetail } from '@/features/clinical-records';
import { PageShell } from '@/shared/components/page-shell';

interface RecordViewProps {
  patientId: string;
  recordId: string;
}

export function RecordView({ patientId, recordId }: RecordViewProps) {
  const { user } = useSession();

  if (!user) return null;

  return (
    <PageShell>
      <RecordDetail
        patientId={patientId}
        recordId={recordId}
        permissions={user.permissions}
      />
    </PageShell>
  );
}
