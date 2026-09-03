import { DocumentsView } from './documents-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequirePermissions allOf={['documents.read']}>
      <DocumentsView patientId={id} />
    </RequirePermissions>
  );
}
