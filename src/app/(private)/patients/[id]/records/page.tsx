import { RecordsView } from './records-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function RecordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequirePermissions allOf={['records.read']}>
      <RecordsView patientId={id} />
    </RequirePermissions>
  );
}
