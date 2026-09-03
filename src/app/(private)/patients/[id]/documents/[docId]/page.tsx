import { DocumentDetailView } from './document-detail-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;
  return (
    <RequirePermissions allOf={['documents.read']}>
      <DocumentDetailView patientId={id} docId={docId} />
    </RequirePermissions>
  );
}
