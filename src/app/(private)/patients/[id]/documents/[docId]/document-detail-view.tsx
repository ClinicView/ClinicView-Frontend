'use client';

import { useSession } from '@/features/auth';
import { DocumentDetail } from '@/features/medical-documents';
import { PageShell } from '@/shared/components/page-shell';

interface DocumentDetailViewProps {
  patientId: string;
  docId: string;
}

export function DocumentDetailView({ patientId, docId }: DocumentDetailViewProps) {
  const { user } = useSession();

  if (!user) return null;

  return (
    <PageShell>
      <DocumentDetail patientId={patientId} docId={docId} permissions={user.permissions} />
    </PageShell>
  );
}
